<?php

use App\Actions\Teams\TeamTemplateUsage;
use App\Enums\TeamRole;
use App\Enums\TemplateCategory;
use App\Enums\TemplateVisibility;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use App\Support\RetroTemplates\TemplateCatalogue;
use Inertia\Testing\AssertableInertia as Assert;

it('lets a facilitator choose the default template and refuses a member', function () {
    $team = Team::factory()->create();
    $route = route('teams.defaultRetroTemplate.update', [$team->workspace, $team]);

    $this->actingAs(teamMember($team))->put($route, ['template' => 'four_ls'])->assertForbidden();
    $this->actingAs(teamMember($team, TeamRole::Facilitator))->put($route, ['template' => 'start_stop_continue'])->assertRedirect();

    expect($team->fresh()->default_retro_template)->toBe('start_stop_continue');
});

it('refuses a template the team cannot use and keeps the default as it was', function (Closure $template) {
    $team = Team::factory()->create();
    $facilitator = teamMember($team, TeamRole::Facilitator);

    $this->actingAs($facilitator)
        ->put(route('teams.defaultRetroTemplate.update', [$team->workspace, $team]), ['template' => $template($team, $facilitator)])
        ->assertSessionHasErrors('template');

    expect($team->fresh()->default_retro_template)->toBeNull();
})->with([
    'unknown' => [fn () => 'no_such_template'],
    'personal' => [fn (Team $team, User $facilitator) => WorkspaceTemplate::factory()->for($team->workspace)->create(['visibility' => TemplateVisibility::Personal, 'created_by_user_id' => $facilitator->id])->catalogueKey()],
    'of another team' => [fn (Team $team) => WorkspaceTemplate::factory()->for($team->workspace)->create(['visibility' => TemplateVisibility::Team, 'team_id' => Team::factory()->for($team->workspace)->create()->id])->catalogueKey()],
    'of another workspace' => [fn () => WorkspaceTemplate::factory()->create()->catalogueKey()],
]);

it('sends the default to the team page while it is available, and nothing once it is gone', function () {
    $team = Team::factory()->create();
    $template = WorkspaceTemplate::factory()->for($team->workspace)->create();
    $team->update(['default_retro_template' => $template->catalogueKey()]);
    $member = teamMember($team);
    $page = fn () => $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]));

    $page()->assertInertia(fn (Assert $page) => $page->where('defaultRetroTemplate', $template->catalogueKey()));

    $template->delete();

    $page()->assertInertia(fn (Assert $page) => $page->where('defaultRetroTemplate', null));
});

it('counts the team retros only, lists the default beyond the top five, and says who may edit the columns', function () {
    $team = Team::factory()->create();
    $other = Team::factory()->for($team->workspace)->create();
    $teamTemplate = WorkspaceTemplate::factory()->for($team->workspace)->create(['visibility' => TemplateVisibility::Team, 'team_id' => $team->id]);
    Retro::factory()->for($team)->count(2)->create(['template' => TemplateCatalogue::Workspace, 'workspace_template_id' => $teamTemplate->id]);
    Retro::factory()->for($other)->create(['template' => TemplateCatalogue::Workspace, 'workspace_template_id' => $teamTemplate->id]);
    Retro::factory()->for($team)->create(['template' => 'start_stop_continue']);
    $team->update(['default_retro_template' => 'kudos']);
    $facilitator = teamMember($team, TeamRole::Facilitator);

    $rows = collect(resolve(TeamTemplateUsage::class)->handle($team->fresh(), $facilitator))->keyBy('key');

    expect($rows)->toHaveCount(6)
        ->and($rows[$teamTemplate->catalogueKey()]['usageCount'])->toBe(2)
        ->and($rows[$teamTemplate->catalogueKey()]['canEdit'])->toBeTrue()
        ->and($rows['start_stop_continue']['usageCount'])->toBe(1)
        ->and($rows['start_stop_continue']['canEdit'])->toBeFalse()
        ->and($rows['kudos']['isDefault'])->toBeTrue()
        ->and($rows['kudos']['usageCount'])->toBe(0);
});

it('gives each row of the team templates its category, for the columns saved from the settings', function () {
    $team = Team::factory()->create();
    $teamTemplate = WorkspaceTemplate::factory()->for($team->workspace)->create(['visibility' => TemplateVisibility::Team, 'team_id' => $team->id, 'category' => TemplateCategory::Ideas]);
    $team->update(['default_retro_template' => $teamTemplate->catalogueKey()]);
    Retro::factory()->for($team)->create(['template' => 'start_stop_continue']);

    $rows = collect(resolve(TeamTemplateUsage::class)->handle($team->fresh(), teamMember($team, TeamRole::Facilitator)))->keyBy('key');

    expect($rows[$teamTemplate->catalogueKey()]['category'])->toBe('ideas')
        ->and($rows['start_stop_continue']['category'])->toBe('essentials');
});
