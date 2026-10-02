<?php

use App\Actions\Retros\TopTeamTemplates;
use App\Models\Retro;
use App\Models\Team;
use App\Models\WorkspaceTemplate;
use App\Support\RetroTemplates\TemplateCatalogue;
use Inertia\Testing\AssertableInertia as Assert;

function retrosOn(Team $team, string $template, int $count, array $attributes = []): void
{
    Retro::factory()->count($count)->create([
        'team_id' => $team->id,
        'template' => $template,
        ...$attributes,
    ]);
}

it('gives the shortcuts in order to a team without a retro', function () {
    $team = Team::factory()->create();

    expect(resolve(TopTeamTemplates::class)->handle($team))->toBe(TemplateCatalogue::Shortcuts);
});

it('ranks used templates first and completes from the shortcuts without duplicates', function () {
    $team = Team::factory()->create();
    $workspaceTemplate = WorkspaceTemplate::factory()->create(['workspace_id' => $team->workspace_id]);
    retrosOn($team, 'sailboat', 3);
    retrosOn($team, TemplateCatalogue::Workspace, 1, ['workspace_template_id' => $workspaceTemplate->id]);

    expect(resolve(TopTeamTemplates::class)->handle($team))->toBe([
        'sailboat',
        $workspaceTemplate->catalogueKey(),
        'went_well_to_improve_actions',
        'start_stop_continue',
        'four_ls',
    ]);
});

it('puts the most recently used template first on equal counts', function () {
    $team = Team::factory()->create();

    $this->travelTo(now()->subDays(2));
    retrosOn($team, 'swot', 1);
    $this->travelTo(now()->addDay());
    retrosOn($team, 'kanban', 1);
    $this->travelBack();

    $keys = resolve(TopTeamTemplates::class)->handle($team);

    expect($keys[0])->toBe('kanban')
        ->and($keys[1])->toBe('swot');
});

it('counts the latest hundred retros of the team only', function () {
    $team = Team::factory()->create();
    $this->travelTo('2026-01-01 10:00:00');
    retrosOn($team, 'sailboat', 3);
    $this->travelTo('2026-02-01 10:00:00');
    retrosOn($team, 'four_ls', 99);
    $this->travelTo('2026-03-01 10:00:00');
    retrosOn($team, 'start_stop_continue', 1);

    expect(array_slice(resolve(TopTeamTemplates::class)->handle($team), 0, 2))->toBe(['four_ls', 'start_stop_continue']);
});

it('ignores blank retros and retros whose workspace template is gone', function () {
    $team = Team::factory()->create();
    $workspaceTemplate = WorkspaceTemplate::factory()->create(['workspace_id' => $team->workspace_id]);
    retrosOn($team, TemplateCatalogue::Custom, 4);
    retrosOn($team, TemplateCatalogue::Workspace, 2, ['workspace_template_id' => $workspaceTemplate->id]);
    $workspaceTemplate->delete();

    expect(resolve(TopTeamTemplates::class)->handle($team))->toBe(TemplateCatalogue::Shortcuts);
});

it('ignores a workspace template of another workspace', function () {
    $team = Team::factory()->create();
    $foreign = WorkspaceTemplate::factory()->create();
    retrosOn($team, TemplateCatalogue::Workspace, 2, ['workspace_template_id' => $foreign->id]);

    expect(resolve(TopTeamTemplates::class)->handle($team))->toBe(TemplateCatalogue::Shortcuts);
});

it('ignores a built-in key that left the catalogue', function () {
    $team = Team::factory()->create();
    retrosOn($team, 'retired_template', 3);

    expect(resolve(TopTeamTemplates::class)->handle($team))->toBe(TemplateCatalogue::Shortcuts);
});

it('does not count the retros of another team', function () {
    $team = Team::factory()->create();
    retrosOn(Team::factory()->create(), 'swot', 5);

    expect(resolve(TopTeamTemplates::class)->handle($team))->toBe(TemplateCatalogue::Shortcuts);
});

it('always holds five distinct keys', function () {
    $team = Team::factory()->create();
    foreach (['swot', 'kanban', 'sailboat', 'four_ls', 'okr', 'wrap', 'raid'] as $template) {
        retrosOn($team, $template, 1);
    }

    $keys = resolve(TopTeamTemplates::class)->handle($team);

    expect($keys)->toHaveCount(5)
        ->and(array_unique($keys))->toHaveCount(5);
});

it('sends the top templates with the team page', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    retrosOn($team, 'sailboat', 2);

    $this->actingAs($user)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/show')
            ->where('topTemplates.0', 'sailboat')
            ->has('topTemplates', 5));
});
