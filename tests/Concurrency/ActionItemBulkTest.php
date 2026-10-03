<?php

use App\Enums\ActionItemRecurrence;
use App\Models\ActionItem;
use App\Models\Team;
use Tests\Concurrency\Support\Race;

it('completes the same recurring items twice at once and leaves one next occurrence each', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $ids = ActionItem::factory()->withoutRetro($team, $user)->recurring(ActionItemRecurrence::Weekly)->count(4)->create()->pluck('id')->all();
    $userId = $user->id;
    $uri = route('workspaces.actionItemBulkUpdates.store', $team->workspace, false);
    $payload = ['ids' => $ids, 'changes' => ['status' => 'completed']];

    $outcomes = Race::run([
        static fn (): int => Race::request($userId, 'POST', $uri, $payload),
        static fn (): int => Race::request($userId, 'POST', $uri, $payload),
    ]);

    expect(array_column($outcomes, 'value'))->toBe([200, 200])
        ->and(ActionItem::query()->whereIn('previous_occurrence_id', $ids)->count())->toBe(4)
        ->and(ActionItem::query()->whereKey($ids)->whereNull('completed_at')->count())->toBe(0);
});
