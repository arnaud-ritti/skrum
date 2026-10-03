<?php

use App\Actions\Retros\BuildTemplateCatalogue;
use App\Enums\TeamRole;
use App\Enums\TemplateVisibility;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;

function templateBody(array $override = []): array
{
    return [
        'name' => 'Our retro',
        'category' => 'team_mood',
        'columns' => [['title' => 'Energy', 'color' => 'moss']],
        ...$override,
    ];
}

function postTemplate(User $user, Team $team, array $override = []): TestResponse
{
    return test()->actingAs($user)->post(route('workspaces.templates.store', $team->workspace), templateBody($override));
}

it('keeps a template posted by an admin without a visibility as a workspace template', function () {
    $team = Team::factory()->create();

    postTemplate(workspaceManager($team->workspace), $team)->assertRedirect();

    expect(WorkspaceTemplate::query()->sole()->visibility)->toBe(TemplateVisibility::Workspace);
});

it('lets any member keep a personal template that nobody else sees', function () {
    $team = Team::factory()->create();
    $author = teamMember($team);
    $colleague = teamMember($team);

    postTemplate($author, $team, ['visibility' => 'personal'])->assertRedirect();

    $templatesOf = fn (User $user) => test()->actingAs($user)->get(route('workspaces.templates.index', $team->workspace));

    $templatesOf($author)->assertInertia(fn (Assert $page) => $page->has('templates', 1)->where('templates.0.visibility', 'personal'));
    $templatesOf($colleague)->assertInertia(fn (Assert $page) => $page->has('templates', 0));
});

it('lets owners and facilitators share a template with their team only', function () {
    $atlas = Team::factory()->create();
    $borealis = Team::factory()->for($atlas->workspace)->create();
    $facilitator = teamMember($atlas, TeamRole::Facilitator);

    postTemplate(teamMember($atlas), $atlas, ['visibility' => 'team', 'team_id' => $atlas->id])->assertForbidden();
    postTemplate($facilitator, $atlas, ['visibility' => 'team', 'team_id' => $borealis->id])->assertForbidden();
    postTemplate($facilitator, $atlas, ['visibility' => 'team', 'team_id' => $atlas->id])->assertRedirect();

    $template = WorkspaceTemplate::query()->sole();

    expect(teamMember($atlas)->can('view', $template))->toBeTrue()
        ->and(teamMember($borealis)->can('view', $template))->toBeFalse();
});

it('keeps workspace templates to admins', function () {
    $team = Team::factory()->create();

    postTemplate(teamMember($team, TeamRole::Owner), $team, ['visibility' => 'workspace'])->assertForbidden();
});

it('refuses a team on a personal template', function () {
    $team = Team::factory()->create();

    postTemplate(teamMember($team), $team, ['visibility' => 'personal', 'team_id' => $team->id])->assertSessionHasErrors('team_id');
});

it('refuses to start a retro from a personal template of someone else', function () {
    $team = Team::factory()->create();
    $template = WorkspaceTemplate::factory()->for($team->workspace)->create([
        'visibility' => TemplateVisibility::Personal,
        'created_by_user_id' => teamMember($team)->id,
    ]);

    $this->actingAs(teamMember($team))
        ->post(route('teams.retros.store', [$team->workspace, $team]), ['title' => 'Copy', 'template' => $template->catalogueKey()])
        ->assertSessionHasErrors('template');
});

it('lists in the team catalogue the workspace templates, the team ones and the viewer personal ones', function () {
    $atlas = Team::factory()->create();
    $borealis = Team::factory()->for($atlas->workspace)->create();
    $viewer = teamMember($atlas);
    $make = fn (string $name, array $attributes) => WorkspaceTemplate::factory()->for($atlas->workspace)->create(['name' => $name, ...$attributes]);
    $make('Shared', ['visibility' => TemplateVisibility::Workspace]);
    $make('Atlas only', ['visibility' => TemplateVisibility::Team, 'team_id' => $atlas->id]);
    $make('Borealis only', ['visibility' => TemplateVisibility::Team, 'team_id' => $borealis->id]);
    $make('Mine', ['visibility' => TemplateVisibility::Personal, 'created_by_user_id' => $viewer->id]);
    $make('Someone else', ['visibility' => TemplateVisibility::Personal, 'created_by_user_id' => teamMember($atlas)->id]);

    $names = collect(resolve(BuildTemplateCatalogue::class)->handle($atlas->workspace, $viewer, $atlas))
        ->where('isWorkspace', true)->pluck('name')->sort()->values()->all();

    expect($names)->toBe(['Atlas only', 'Mine', 'Shared']);
});

it('lets the author edit a personal template, a team facilitator a team one, and refuses the others', function () {
    $team = Team::factory()->create();
    $author = teamMember($team);
    $personal = WorkspaceTemplate::factory()->for($team->workspace)->create(['visibility' => TemplateVisibility::Personal, 'created_by_user_id' => $author->id]);
    $teamTemplate = WorkspaceTemplate::factory()->for($team->workspace)->create(['visibility' => TemplateVisibility::Team, 'team_id' => $team->id]);

    expect($author->can('update', $personal))->toBeTrue()
        ->and(teamMember($team)->can('update', $personal))->toBeFalse()
        ->and(teamMember($team, TeamRole::Facilitator)->can('update', $teamTemplate))->toBeTrue()
        ->and(teamMember($team)->can('delete', $teamTemplate))->toBeFalse();
});

it('shows a personal template whose author is gone to admins only', function () {
    $team = Team::factory()->create();
    $template = WorkspaceTemplate::factory()->for($team->workspace)->create(['visibility' => TemplateVisibility::Personal, 'created_by_user_id' => null]);

    expect(workspaceManager($team->workspace)->can('view', $template))->toBeTrue()
        ->and(teamMember($team)->can('view', $template))->toBeFalse();
});

it('tells the templates page who may share what', function () {
    $team = Team::factory()->create();
    $facilitator = teamMember($team, TeamRole::Facilitator);

    $this->actingAs($facilitator)->get(route('workspaces.templates.index', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('canCreate', true)
            ->where('canShareWorkspace', false)
            ->where('teamTemplateTeams', [['id' => $team->id, 'name' => $team->name]]));
});

it('makes a team template personal to the facilitator who changes its visibility', function () {
    $team = Team::factory()->create();
    $facilitator = teamMember($team, TeamRole::Facilitator);
    $template = WorkspaceTemplate::factory()->for($team->workspace)->create([
        'visibility' => TemplateVisibility::Team,
        'team_id' => $team->id,
        'created_by_user_id' => teamMember($team, TeamRole::Owner)->id,
    ]);

    $this->actingAs($facilitator)
        ->patch(route('workspaces.templates.update', [$team->workspace, $template]), templateBody(['visibility' => 'personal']))
        ->assertRedirect();

    expect($template->refresh())
        ->visibility->toBe(TemplateVisibility::Personal)
        ->team_id->toBeNull()
        ->created_by_user_id->toBe($facilitator->id);
});

it('keeps the team of a team template saved without a visibility, and asks for a team when the visibility says team', function () {
    $team = Team::factory()->create();
    $facilitator = teamMember($team, TeamRole::Facilitator);
    $template = WorkspaceTemplate::factory()->for($team->workspace)->create(['visibility' => TemplateVisibility::Team, 'team_id' => $team->id]);
    $route = route('workspaces.templates.update', [$team->workspace, $template]);

    $this->actingAs($facilitator)->patch($route, templateBody(['name' => 'Renamed']))->assertRedirect()->assertSessionHasNoErrors();

    expect($template->refresh())
        ->name->toBe('Renamed')
        ->team_id->toBe($team->id);

    $this->actingAs($facilitator)->patch($route, templateBody(['visibility' => 'team']))->assertSessionHasErrors('team_id');
    postTemplate($facilitator, $team, ['visibility' => 'team'])->assertSessionHasErrors('team_id');
});

it('drops a template that becomes personal as the default of the teams', function () {
    $team = Team::factory()->create();
    $facilitator = teamMember($team, TeamRole::Facilitator);
    $template = WorkspaceTemplate::factory()->for($team->workspace)->create(['visibility' => TemplateVisibility::Team, 'team_id' => $team->id]);
    $team->update(['default_retro_template' => $template->catalogueKey()]);

    $this->actingAs($facilitator)
        ->patch(route('workspaces.templates.update', [$team->workspace, $template]), templateBody(['visibility' => 'personal']))
        ->assertRedirect();

    expect($team->fresh()->default_retro_template)->toBeNull();
});
