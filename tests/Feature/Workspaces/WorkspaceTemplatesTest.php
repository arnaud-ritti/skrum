<?php

use App\Enums\WorkspaceRole;
use App\Models\Column;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

function templatesWorkspace(WorkspaceRole $role = WorkspaceRole::Admin): array
{
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, $role)->create();

    return [$user, $workspace];
}

function templatePayload(array $overrides = []): array
{
    return [
        'name' => 'Team pulse',
        'category' => 'team_mood',
        'columns' => [
            ['title' => 'Energy', 'description' => 'How charged you feel', 'color' => 'moss'],
            ['title' => 'Blockers', 'color' => 'coral'],
        ],
        ...$overrides,
    ];
}

it('shows the workspace templates to every member and loads the catalogue on demand', function () {
    [$member, $workspace] = templatesWorkspace(WorkspaceRole::Member);
    $template = WorkspaceTemplate::factory()->withColumns()->for($workspace)->create(['name' => 'Ours']);

    $this->actingAs($member)
        ->get(route('workspaces.templates.index', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->component('workspaces/templates')
            ->where('templates.0.id', $template->id)
            ->has('templates.0.columns', 2)
            ->has('categories', 5)
            ->where('canManage', false)
            ->missing('catalogue')
            ->reloadOnly('catalogue', fn (Assert $reload) => $reload
                ->has('catalogue', 54)
                ->where('catalogue.0.key', "workspace:{$template->id}")
                ->where('catalogue.0.isWorkspace', true)
                ->where('catalogue.1.key', 'went_well_to_improve_actions')
                ->where('catalogue.1.isCommon', true)
                ->where('catalogue.53.key', 'custom')));
});

it('lets owners and admins create a template with its columns', function (WorkspaceRole $role) {
    [$user, $workspace] = templatesWorkspace($role);

    $this->actingAs($user)
        ->post(route('workspaces.templates.store', $workspace), templatePayload())
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $template = $workspace->templates()->sole();

    expect($template->only(['name', 'created_by_user_id']))->toBe(['name' => 'Team pulse', 'created_by_user_id' => $user->id])
        ->and($template->category->value)->toBe('team_mood')
        ->and($template->columns->map->only(['title', 'description', 'position'])->all())->toBe([
            ['title' => 'Energy', 'description' => 'How charged you feel', 'position' => 0],
            ['title' => 'Blockers', 'description' => null, 'position' => 1],
        ]);
})->with([WorkspaceRole::Owner, WorkspaceRole::Admin]);

it('replaces the columns when a template is updated', function () {
    [$admin, $workspace] = templatesWorkspace();
    $template = WorkspaceTemplate::factory()->withColumns(3)->for($workspace)->create();

    $this->actingAs($admin)
        ->patch(route('workspaces.templates.update', [$workspace, $template]), templatePayload([
            'name' => $template->name,
            'columns' => [['title' => 'Only one', 'color' => 'sky']],
        ]))
        ->assertSessionHasNoErrors();

    expect($template->fresh()->columns->pluck('title')->all())->toBe(['Only one']);
});

it('deletes a template without touching retros created from it', function () {
    [$admin, $workspace] = templatesWorkspace();
    $template = WorkspaceTemplate::factory()->withColumns()->for($workspace)->create();
    $retro = Retro::factory()->for(Team::factory()->for($workspace))->create([
        'workspace_template_id' => $template->id,
    ]);
    Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Copied']);

    $this->actingAs($admin)->delete(route('workspaces.templates.destroy', [$workspace, $template]))->assertRedirect();

    expect(WorkspaceTemplate::find($template->id))->toBeNull()
        ->and($retro->fresh()->workspace_template_id)->toBeNull()
        ->and($retro->fresh()->columns->pluck('title')->all())->toBe(['Copied']);
});

it('forbids plain members from managing templates', function () {
    [$member, $workspace] = templatesWorkspace(WorkspaceRole::Member);
    $template = WorkspaceTemplate::factory()->withColumns()->for($workspace)->create();

    $this->actingAs($member)->post(route('workspaces.templates.store', $workspace), templatePayload())->assertForbidden();
    $this->actingAs($member)->patch(route('workspaces.templates.update', [$workspace, $template]), templatePayload())->assertForbidden();
    $this->actingAs($member)->delete(route('workspaces.templates.destroy', [$workspace, $template]))->assertForbidden();
});

it('returns 404 for a template of another workspace', function () {
    [$admin, $workspace] = templatesWorkspace();
    $foreign = WorkspaceTemplate::factory()->withColumns()->create();

    $this->actingAs($admin)->patch(route('workspaces.templates.update', [$workspace, $foreign]), templatePayload())->assertNotFound();
    $this->actingAs($admin)->delete(route('workspaces.templates.destroy', [$workspace, $foreign]))->assertNotFound();
});

it('validates templates', function (array $overrides, string $field) {
    [$admin, $workspace] = templatesWorkspace();

    $this->actingAs($admin)
        ->post(route('workspaces.templates.store', $workspace), templatePayload($overrides))
        ->assertSessionHasErrors($field);

    expect($workspace->templates()->count())->toBe(0);
})->with([
    'no name' => [['name' => ''], 'name'],
    'long name' => [['name' => str_repeat('a', 81)], 'name'],
    'unknown category' => [['category' => 'fun'], 'category'],
    'no columns' => [['columns' => []], 'columns'],
    'eleven columns' => [['columns' => array_fill(0, 11, ['title' => 'X', 'color' => 'moss'])], 'columns'],
    'long title' => [['columns' => [['title' => str_repeat('a', 101), 'color' => 'moss']]], 'columns.0.title'],
    'old color name' => [['columns' => [['title' => 'X', 'color' => 'green']]], 'columns.0.color'],
    'long description' => [['columns' => [['title' => 'X', 'description' => str_repeat('a', 201), 'color' => 'moss']]], 'columns.0.description'],
    'unknown color' => [['columns' => [['title' => 'X', 'color' => 'pink']]], 'columns.0.color'],
]);

it('refuses a duplicate name whatever its case, except for the template itself', function () {
    [$admin, $workspace] = templatesWorkspace();
    $existing = WorkspaceTemplate::factory()->withColumns()->for($workspace)->create(['name' => 'Team Pulse']);

    $this->actingAs($admin)
        ->post(route('workspaces.templates.store', $workspace), templatePayload(['name' => 'team pulse']))
        ->assertSessionHasErrors(['name' => 'A template with this name already exists.']);

    $this->actingAs($admin)
        ->patch(route('workspaces.templates.update', [$workspace, $existing]), templatePayload(['name' => 'TEAM PULSE']))
        ->assertSessionHasNoErrors();
});

it('refuses a 101st template', function () {
    [$admin, $workspace] = templatesWorkspace();
    WorkspaceTemplate::factory()->count(100)->for($workspace)->create();

    $this->actingAs($admin)
        ->post(route('workspaces.templates.store', $workspace), templatePayload())
        ->assertSessionHasErrors(['name' => 'This workspace already has 100 templates.']);
});

it('lists the whiteboard templates of the workspace with their preview and who may manage them', function () {
    [$member, $workspace] = templatesWorkspace(WorkspaceRole::Member);
    $admin = workspaceManager($workspace);
    $preview = ['width' => 10, 'height' => 20, 'shapes' => []];
    $own = WhiteboardTemplate::factory()->for($workspace)->create(['name' => 'Alpha', 'description' => 'Mine', 'preview' => $preview, 'created_by_user_id' => $member->id]);
    $other = WhiteboardTemplate::factory()->for($workspace)->create(['name' => 'Beta']);
    WhiteboardTemplate::factory()->create(['name' => 'Foreign']);

    $this->actingAs($member)
        ->get(route('workspaces.templates.index', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->has('whiteboardTemplates', 2)
            ->where('whiteboardTemplates.0.id', $own->id)
            ->where('whiteboardTemplates.0.description', 'Mine')
            ->where('whiteboardTemplates.0.preview', $preview)
            ->where('whiteboardTemplates.0.canManage', true)
            ->where('whiteboardTemplates.1.id', $other->id)
            ->where('whiteboardTemplates.1.canManage', false));

    $this->actingAs($admin)
        ->get(route('workspaces.templates.index', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('whiteboardTemplates.0.canManage', true)
            ->where('whiteboardTemplates.1.canManage', true));
});

it('lists only the decks of the workspace, by name', function () {
    [$member, $workspace] = templatesWorkspace(WorkspaceRole::Member);
    $team = Team::factory()->for($workspace)->create();
    SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Team deck']);
    SavedPokerDeck::factory()->forWorkspace(Workspace::factory()->create())->create(['name' => 'Other workspace deck']);
    $zulu = SavedPokerDeck::factory()->forWorkspace($workspace)->create(['name' => 'Zulu', 'cards' => ['1', '2']]);
    $alpha = SavedPokerDeck::factory()->forWorkspace($workspace)->create(['name' => 'Alpha']);

    $this->actingAs($member)
        ->get(route('workspaces.templates.index', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->has('pokerDecks', 2)
            ->where('pokerDecks.0.id', $alpha->id)
            ->where('pokerDecks.1.id', $zulu->id)
            ->where('pokerDecks.1.cards', ['1', '2'])
            ->where('pokerDecks.1.usageCount', 0)
            ->where('pokerDecks.1.canManage', false));
});

it('lets only a workspace manager manage decks and create one', function (WorkspaceRole $role, bool $allowed) {
    [$user, $workspace] = templatesWorkspace($role);
    SavedPokerDeck::factory()->forWorkspace($workspace)->create();

    $this->actingAs($user)
        ->get(route('workspaces.templates.index', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('pokerDecks.0.canManage', $allowed)
            ->where('canCreatePokerDeck', $allowed));
})->with([
    'owner' => [WorkspaceRole::Owner, true],
    'admin' => [WorkspaceRole::Admin, true],
    'member' => [WorkspaceRole::Member, false],
]);

it('counts the games of the teams the user can view in the usage of a deck', function () {
    [$member, $workspace] = templatesWorkspace(WorkspaceRole::Member);
    $visibleTeam = Team::factory()->for($workspace)->create();
    $hiddenTeam = Team::factory()->for($workspace)->create();
    $visibleTeam->members()->attach($member);
    $deck = SavedPokerDeck::factory()->forWorkspace($workspace)->create();

    foreach ([$visibleTeam, $visibleTeam, $hiddenTeam] as $team) {
        PokerGame::factory()->create(['team_id' => $team->id])->forceFill(['saved_deck_id' => $deck->id])->save();
    }

    $this->actingAs($member)
        ->get(route('workspaces.templates.index', $workspace))
        ->assertInertia(fn (Assert $page) => $page->where('pokerDecks.0.usageCount', 2));

    $this->actingAs(workspaceManager($workspace))
        ->get(route('workspaces.templates.index', $workspace))
        ->assertInertia(fn (Assert $page) => $page->where('pokerDecks.0.usageCount', 3));
});

it('gives the author of a template and of a deck with an avatar, or null when the account is gone', function () {
    [$member, $workspace] = templatesWorkspace(WorkspaceRole::Member);
    $author = User::factory()->create(['name' => 'Ada Lovelace']);
    WorkspaceTemplate::factory()->for($workspace)->create(['name' => 'A', 'created_by_user_id' => $author->id]);
    WorkspaceTemplate::factory()->for($workspace)->create(['name' => 'B', 'created_by_user_id' => null]);
    SavedPokerDeck::factory()->forWorkspace($workspace)->create(['name' => 'A', 'created_by_user_id' => $author->id]);
    SavedPokerDeck::factory()->forWorkspace($workspace)->create(['name' => 'B', 'created_by_user_id' => null]);

    $this->actingAs($member)
        ->get(route('workspaces.templates.index', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('templates.0.author', ['name' => 'Ada Lovelace', 'avatarUrl' => $author->avatarUrl()])
            ->where('templates.1.author', null)
            ->where('pokerDecks.0.author', ['name' => 'Ada Lovelace', 'avatarUrl' => $author->avatarUrl()])
            ->where('pokerDecks.1.author', null));
});

it('counts the retros created from a template', function () {
    [$member, $workspace] = templatesWorkspace(WorkspaceRole::Member);
    $team = Team::factory()->for($workspace)->create();
    $used = WorkspaceTemplate::factory()->for($workspace)->create(['name' => 'A']);
    WorkspaceTemplate::factory()->for($workspace)->create(['name' => 'B']);
    Retro::factory()->count(2)->create([
        'team_id' => $team->id,
        'template' => 'workspace',
        'workspace_template_id' => $used->id,
    ]);
    Retro::factory()->create(['team_id' => $team->id]);

    $this->actingAs($member)
        ->get(route('workspaces.templates.index', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('templates.0.usageCount', 2)
            ->where('templates.1.usageCount', 0));
});

it('runs a constant number of queries whatever the number of templates and decks', function () {
    [$member, $workspace] = templatesWorkspace(WorkspaceRole::Member);

    $countQueries = function () use ($member, $workspace): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->actingAs($member)->get(route('workspaces.templates.index', $workspace))->assertOk();

        return count(DB::getQueryLog());
    };

    WorkspaceTemplate::factory()->withColumns()->for($workspace)->create();
    WhiteboardTemplate::factory()->for($workspace)->create();
    SavedPokerDeck::factory()->forWorkspace($workspace)->create();

    $countQueries();
    $before = $countQueries();

    WorkspaceTemplate::factory()->withColumns()->for($workspace)->count(3)->create();
    WhiteboardTemplate::factory()->for($workspace)->count(3)->create();
    SavedPokerDeck::factory()->forWorkspace($workspace)->count(3)->create();

    expect($countQueries())->toBe($before);
});
