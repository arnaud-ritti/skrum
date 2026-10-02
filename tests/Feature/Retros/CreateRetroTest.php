<?php

use App\Actions\Retros\CreateRetro;
use App\Actions\Retros\NewRetro;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Support\RetroTemplates\TemplateCatalogue;
use Inertia\Testing\AssertableInertia as Assert;

function teamWithMember(WorkspaceRole $role = WorkspaceRole::Member, bool $inTeam = true): array
{
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, $role)->create();
    $team = Team::factory()->for($workspace)->create();

    if ($inTeam) {
        $team->members()->attach($user);
    }

    return [$user, $workspace, $team];
}

it('creates a retro with translated template columns and the creator as facilitator', function () {
    [$user, , $team] = teamWithMember();
    app()->setLocale('fr');

    $retro = resolve(CreateRetro::class)->handle($team, $user, new NewRetro('Sprint 42', 'start_stop_continue'));

    expect($retro->phase)->toBe(RetroPhase::Writing)
        ->and($retro->template)->toBe('start_stop_continue')
        ->and($retro->columns->pluck('title')->all())->toBe(['Commencer', 'Arrêter', 'Continuer'])
        ->and($retro->columns->pluck('description')->all())->toBe([
            'De nouvelles pratiques à essayer au prochain cycle',
            'Des habitudes qui gênent et doivent cesser maintenant',
            'Ce qui fonctionne déjà et doit survivre au prochain changement',
        ])
        ->and($retro->columns->pluck('position')->all())->toBe([0, 1, 2])
        ->and($retro->facilitator->user_id)->toBe($user->id)
        ->and($retro->votes_per_participant)->toBeNull()
        ->and($retro->guest_access_enabled)->toBeFalse()
        ->and(strlen($retro->guest_token))->toBe(40);
});

it('creates a custom retro without columns', function () {
    [$user, , $team] = teamWithMember();

    expect(resolve(CreateRetro::class)->handle($team, $user, new NewRetro('Free form', 'custom'))->columns)->toBeEmpty();
});

it('creates a retro from every catalogue template', function () {
    [$user, , $team] = teamWithMember();
    app()->setLocale('de');

    foreach (TemplateCatalogue::all() as $definition) {
        $retro = resolve(CreateRetro::class)->handle($team, $user, new NewRetro($definition->key, $definition->key));

        expect($retro->columns->map->only(['title', 'description'])->all())
            ->toBe(array_map(fn (array $column) => ['title' => $column['title'], 'description' => $column['description']], $definition->translatedColumns()));
    }
});

it('starts in the first enabled phase with the chosen options', function () {
    [$user, , $team] = teamWithMember();

    $retro = resolve(CreateRetro::class)->handle($team, $user, new NewRetro(
        title: 'Sprint 43',
        template: 'mad_sad_glad',
        isAnonymous: true,
        icebreakerEnabled: true,
        votesPerParticipant: 4,
    ));

    expect($retro->phase)->toBe(RetroPhase::Icebreaker)
        ->and($retro->is_anonymous)->toBeTrue()
        ->and($retro->icebreaker_enabled)->toBeTrue()
        ->and($retro->health_check_enabled)->toBeFalse()
        ->and($retro->votes_per_participant)->toBe(4);

    $healthCheck = resolve(CreateRetro::class)->handle($team, $user, new NewRetro('Sprint 44', 'mad_sad_glad', healthCheckEnabled: true, icebreakerEnabled: true));

    expect($healthCheck->phase)->toBe(RetroPhase::HealthCheck);
});

it('copies the columns of a workspace template and remembers it', function () {
    [$user, $workspace, $team] = teamWithMember();
    $template = WorkspaceTemplate::factory()->for($workspace)->create();
    $template->columns()->create(['title' => 'Energy', 'description' => 'How charged you feel', 'color' => 'moss', 'position' => 0]);
    $template->columns()->create(['title' => 'Blockers', 'description' => null, 'color' => 'coral', 'position' => 1]);

    $retro = resolve(CreateRetro::class)->handle($team, $user, new NewRetro('Pulse', $template->catalogueKey()));

    expect($retro->template)->toBe(TemplateCatalogue::Workspace)
        ->and($retro->workspace_template_id)->toBe($template->id)
        ->and($retro->columns->map(fn ($column) => [$column->title, $column->description, $column->color->value])->all())->toBe([
            ['Energy', 'How charged you feel', 'moss'],
            ['Blockers', null, 'coral'],
        ]);

    $template->columns()->delete();
    $template->update(['name' => 'Renamed']);

    expect($retro->fresh()->columns)->toHaveCount(2);
});

it('lets team members create retros with options from the team page', function () {
    [$user, $workspace, $team] = teamWithMember();

    $response = $this->actingAs($user)->post(route('teams.retros.store', [$workspace, $team]), [
        'title' => 'Sprint 42',
        'template' => 'sailboat',
        'is_anonymous' => true,
        'icebreaker_enabled' => true,
        'votes_per_participant' => null,
    ]);

    $retro = $team->retros()->sole();
    $response->assertRedirect(route('retros.show', $retro));

    expect($retro->only(['template', 'is_anonymous', 'icebreaker_enabled', 'votes_per_participant']))->toBe([
        'template' => 'sailboat',
        'is_anonymous' => true,
        'icebreaker_enabled' => true,
        'votes_per_participant' => null,
    ])->and($retro->phase)->toBe(RetroPhase::Icebreaker);
});

it('lets workspace managers create retros in any team', function () {
    [$admin, $workspace, $team] = teamWithMember(WorkspaceRole::Admin, inTeam: false);

    $this->actingAs($admin)
        ->post(route('teams.retros.store', [$workspace, $team]), ['title' => 'X', 'template' => 'four_ls'])
        ->assertRedirect();
});

it('forbids members outside the team', function () {
    [$member, $workspace, $team] = teamWithMember(inTeam: false);

    $this->actingAs($member)
        ->post(route('teams.retros.store', [$workspace, $team]), ['title' => 'X', 'template' => 'four_ls'])
        ->assertForbidden();
});

it('validates the title, template and vote limit', function (array $payload, string $field) {
    [$user, $workspace, $team] = teamWithMember();

    $this->actingAs($user)
        ->post(route('teams.retros.store', [$workspace, $team]), $payload)
        ->assertSessionHasErrors($field);
})->with([
    [['title' => '', 'template' => 'four_ls'], 'title'],
    [['title' => str_repeat('a', 121), 'template' => 'four_ls'], 'title'],
    [['title' => 'X', 'template' => 'nope'], 'template'],
    [['title' => 'X', 'template' => 'four_ls', 'votes_per_participant' => 21], 'votes_per_participant'],
    [['title' => 'X', 'template' => 'four_ls', 'votes_per_participant' => 0], 'votes_per_participant'],
]);

it('refuses templates outside the catalogue and the workspace', function (Closure $template) {
    [$user, $workspace, $team] = teamWithMember();

    $this->actingAs($user)
        ->post(route('teams.retros.store', [$workspace, $team]), ['title' => 'X', 'template' => $template()])
        ->assertSessionHasErrors(['template' => 'Choose a template from the list.']);

    expect(Retro::count())->toBe(0);
})->with([
    'the workspace marker' => [fn () => 'workspace'],
    'a malformed id' => [fn () => 'workspace:not-a-uuid'],
    'an unknown id' => [fn () => 'workspace:'.fake()->uuid()],
    'another workspace' => [fn () => WorkspaceTemplate::factory()->withColumns()->create()->catalogueKey()],
]);

it('lists the team retros newest first and loads the catalogue on demand', function () {
    [$user, $workspace, $team] = teamWithMember();
    $older = resolve(CreateRetro::class)->handle($team, $user, new NewRetro('Older', 'four_ls'));
    $this->travel(1)->minutes();
    $newer = resolve(CreateRetro::class)->handle($team, $user, new NewRetro('Newer', 'four_ls'));
    $template = WorkspaceTemplate::factory()->withColumns()->for($workspace)->create();

    $this->actingAs($user)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('retros.0.id', $newer->id)
            ->where('retros.1.id', $older->id)
            ->where('retros.0.phase', 'writing')
            ->where('canCreateRetro', true)
            ->has('templateCategories', 5)
            ->missing('templates')
            ->missing('catalogue')
            ->reloadOnly('catalogue', fn (Assert $reload) => $reload
                ->has('catalogue', 54)
                ->where('catalogue.0.key', $template->catalogueKey())
                ->where('catalogue.1.name', 'Went well, To improve, Action ideas')
                ->where('catalogue.1.columns.0.description', 'What worked and is worth repeating on purpose next sprint')));
});

it('creates a retro with the given columns in order and keeps the template key', function () {
    [$user, $workspace, $team] = teamWithMember();

    $this->actingAs($user)->post(route('teams.retros.store', [$workspace, $team]), [
        'title' => 'Custom',
        'template' => 'sailboat',
        'columns' => [
            ['title' => 'Wind', 'description' => 'What pushes us', 'color' => 'moss'],
            ['title' => 'Anchor', 'description' => null, 'color' => 'coral'],
            ['title' => 'Rocks', 'color' => 'sky'],
        ],
    ])->assertRedirect();

    $retro = $team->retros()->sole();

    expect($retro->template)->toBe('sailboat')
        ->and($retro->columns->map(fn ($column) => [$column->title, $column->description, $column->color->value, $column->position])->all())->toBe([
            ['Wind', 'What pushes us', 'moss', 0],
            ['Anchor', null, 'coral', 1],
            ['Rocks', null, 'sky', 2],
        ]);
});

it('refuses invalid columns', function (array $columns, string $field) {
    [$user, $workspace, $team] = teamWithMember();

    $this->actingAs($user)
        ->post(route('teams.retros.store', [$workspace, $team]), ['title' => 'X', 'template' => 'four_ls', 'columns' => $columns])
        ->assertSessionHasErrors($field);

    expect(Retro::count())->toBe(0);
})->with([
    'unknown colour' => [[['title' => 'A', 'color' => 'chartreuse']], 'columns.0.color'],
    'empty title' => [[['title' => '', 'color' => 'moss']], 'columns.0.title'],
    'old color name' => [[['title' => 'A', 'color' => 'green']], 'columns.0.color'],
    'too many columns' => [fn () => array_fill(0, 11, ['title' => 'A', 'color' => 'moss']), 'columns'],
    'no column' => [[], 'columns'],
]);

it('stores the guest access flag of a retro, false by default', function () {
    [$user, $workspace, $team] = teamWithMember();
    $url = route('teams.retros.store', [$workspace, $team]);

    $this->actingAs($user)->post($url, ['title' => 'Open', 'template' => 'four_ls', 'guest_access_enabled' => true]);
    $this->actingAs($user)->post($url, ['title' => 'Closed', 'template' => 'four_ls']);

    expect($team->retros()->where('title', 'Open')->sole()->guest_access_enabled)->toBeTrue()
        ->and($team->retros()->where('title', 'Closed')->sole()->guest_access_enabled)->toBeFalse();
});
