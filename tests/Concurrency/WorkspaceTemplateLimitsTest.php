<?php

use App\Http\Controllers\WorkspaceTemplatesController;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Tests\Concurrency\Support\Race;

/**
 * @param  array<int, string>  $names
 * @return array<int, int>
 */
function templateRace(Workspace $workspace, array $names): array
{
    $userId = workspaceManager($workspace)->id;
    $uri = route('workspaces.templates.store', $workspace, false);
    $contenders = [];

    foreach ($names as $name) {
        $contenders[] = static fn (): int => Race::request($userId, 'POST', $uri, [
            'name' => $name,
            'category' => 'team_mood',
            'columns' => [['title' => 'Energy', 'color' => 'moss'], ['title' => 'Blockers', 'color' => 'coral']],
        ]);
    }

    return array_column(Race::run($contenders), 'value');
}

it('stops at a hundred templates per workspace', function () {
    $workspace = Workspace::factory()->create();
    WorkspaceTemplate::factory()->count(WorkspaceTemplatesController::MaxTemplates - 1)->for($workspace)->create();

    $statuses = templateRace($workspace, ['Race 1', 'Race 2', 'Race 3', 'Race 4', 'Race 5', 'Race 6']);

    expect(WorkspaceTemplate::query()->where('workspace_id', $workspace->id)->count())->toBe(WorkspaceTemplatesController::MaxTemplates)
        ->and(array_count_values($statuses))->toEqual([302 => 1, 422 => 5]);
});

it('keeps one template when the same name is saved six times at once, and answers the others 422', function () {
    $workspace = Workspace::factory()->create();

    $statuses = templateRace($workspace, ['Team pulse', 'team pulse', 'TEAM PULSE', 'Team pulse', 'Team Pulse', 'team pulse']);

    expect(WorkspaceTemplate::query()->where('workspace_id', $workspace->id)->count())->toBe(1)
        ->and(array_count_values($statuses))->toEqual([302 => 1, 422 => 5]);
});

it('keeps names unique when two templates are renamed to the same name at once, and answers the second 422', function () {
    $workspace = Workspace::factory()->create();
    $userId = workspaceManager($workspace)->id;
    $contenders = [];

    foreach (WorkspaceTemplate::factory()->count(2)->for($workspace)->create() as $template) {
        $uri = route('workspaces.templates.update', [$workspace, $template], false);
        $contenders[] = static fn (): int => Race::request($userId, 'PATCH', $uri, [
            'name' => 'Same name',
            'category' => 'team_mood',
            'columns' => [['title' => 'Energy', 'color' => 'moss']],
        ]);
    }

    $statuses = array_column(Race::run($contenders, Race::firstQueryMentioning('name_key')), 'value');

    expect(WorkspaceTemplate::query()->where('workspace_id', $workspace->id)->where('name', 'Same name')->count())->toBe(1)
        ->and(array_count_values($statuses))->toEqual([302 => 1, 422 => 1]);
});
