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

it('deletes and changes the same items at once without a failure, and leaves none', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $ids = ActionItem::factory()->withoutRetro($team, $user)->count(4)->create()->pluck('id')->all();
    $userId = $user->id;
    $update = route('workspaces.actionItemBulkUpdates.store', $team->workspace, false);
    $deletion = route('workspaces.actionItemBulkDeletions.store', $team->workspace, false);

    $outcomes = Race::run([
        'update' => static fn (): int => Race::request($userId, 'POST', $update, ['ids' => $ids, 'changes' => ['status' => 'doing']]),
        'deletion' => static fn (): int => Race::request($userId, 'POST', $deletion, ['ids' => $ids]),
    ]);

    expect($outcomes['update']['value'])->toBe(200)
        ->and($outcomes['deletion']['value'])->toBe(200)
        ->and(ActionItem::query()->whereKey($ids)->count())->toBe(0);
});

it('starts the same matching items twice at once without a failure', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $ids = ActionItem::factory()->withoutRetro($team, $user)->count(4)->create()->pluck('id')->all();
    $userId = $user->id;
    $uri = route('workspaces.actionItemBulkUpdates.store', $team->workspace, false);
    $payload = ['filters' => ['status' => 'todo'], 'count' => 4, 'changes' => ['status' => 'doing']];

    $outcomes = Race::run([
        static fn (): int => Race::request($userId, 'POST', $uri, $payload),
        static fn (): int => Race::request($userId, 'POST', $uri, $payload),
    ]);

    $statuses = array_column($outcomes, 'value');

    expect($statuses)->toContain(200)
        ->and(array_diff($statuses, [200, 422]))->toBeEmpty()
        ->and(ActionItem::query()->whereKey($ids)->whereNull('started_at')->count())->toBe(0);
});
