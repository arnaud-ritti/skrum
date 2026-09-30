<?php

use App\Enums\WorkspaceRole;
use App\Models\Column;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
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
            ['title' => 'Energy', 'description' => 'How charged you feel', 'color' => 'green'],
            ['title' => 'Blockers', 'color' => 'red'],
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
            'columns' => [['title' => 'Only one', 'color' => 'blue']],
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
    'eleven columns' => [['columns' => array_fill(0, 11, ['title' => 'X', 'color' => 'green'])], 'columns'],
    'long title' => [['columns' => [['title' => str_repeat('a', 101), 'color' => 'green']]], 'columns.0.title'],
    'long description' => [['columns' => [['title' => 'X', 'description' => str_repeat('a', 201), 'color' => 'green']]], 'columns.0.description'],
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
