<?php

use App\Actions\Teams\TeamTemplateUsage;
use App\Enums\TeamRole;
use App\Enums\TemplateVisibility;
use App\Models\Retro;
use App\Models\Team;
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

it('refuses an unknown template and a personal one', function () {
    $team = Team::factory()->create();
    $facilitator = teamMember($team, TeamRole::Facilitator);
    $personal = WorkspaceTemplate::factory()->for($team->workspace)->create(['visibility' => TemplateVisibility::Personal, 'created_by_user_id' => $facilitator->id]);
    $route = route('teams.defaultRetroTemplate.update', [$team->workspace, $team]);

    $this->actingAs($facilitator)->put($route, ['template' => 'no_such_template'])->assertSessionHasErrors('template');
    $this->actingAs($facilitator)->put($route, ['template' => $personal->catalogueKey()])->assertSessionHasErrors('template');
});

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
