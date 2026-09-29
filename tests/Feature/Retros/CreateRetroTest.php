<?php

use App\Actions\Retros\CreateRetro;
use App\Enums\RetroPhase;
use App\Enums\RetroTemplate;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
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

    $retro = app(CreateRetro::class)->handle($team, $user, 'Sprint 42', RetroTemplate::StartStopContinue);

    expect($retro->phase)->toBe(RetroPhase::Writing)
        ->and($retro->columns->pluck('title')->all())->toBe(['Commencer', 'Arrêter', 'Continuer'])
        ->and($retro->columns->pluck('position')->all())->toBe([0, 1, 2])
        ->and($retro->facilitator->user_id)->toBe($user->id)
        ->and($retro->guest_access_enabled)->toBeFalse()
        ->and(strlen($retro->guest_token))->toBe(40);
});

it('creates a custom retro without columns', function () {
    [$user, , $team] = teamWithMember();

    expect(app(CreateRetro::class)->handle($team, $user, 'Free form', RetroTemplate::Custom)->columns)->toHaveCount(0);
});

it('lets team members create retros from the team page', function () {
    [$user, $workspace, $team] = teamWithMember();

    $response = $this->actingAs($user)->post(route('teams.retros.store', [$workspace, $team]), [
        'title' => 'Sprint 42',
        'template' => 'mad_sad_glad',
    ]);

    $retro = $team->retros()->sole();
    $response->assertRedirect(route('retros.show', $retro));
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

it('validates the title and template', function (array $payload, string $field) {
    [$user, $workspace, $team] = teamWithMember();

    $this->actingAs($user)
        ->post(route('teams.retros.store', [$workspace, $team]), $payload)
        ->assertSessionHasErrors($field);
})->with([
    [['title' => '', 'template' => 'four_ls'], 'title'],
    [['title' => str_repeat('a', 121), 'template' => 'four_ls'], 'title'],
    [['title' => 'X', 'template' => 'nope'], 'template'],
]);

it('lists the team retros newest first', function () {
    [$user, $workspace, $team] = teamWithMember();
    $older = app(CreateRetro::class)->handle($team, $user, 'Older', RetroTemplate::FourLs);
    $this->travel(1)->minutes();
    $newer = app(CreateRetro::class)->handle($team, $user, 'Newer', RetroTemplate::FourLs);

    $this->actingAs($user)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('retros.0.id', $newer->id)
            ->where('retros.1.id', $older->id)
            ->where('retros.0.phase', 'writing')
            ->where('canCreateRetro', true)
            ->has('templates', 5));
});
