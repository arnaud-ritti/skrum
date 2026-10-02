<?php

use App\Models\ActionItem;
use App\Models\ActionItemReminder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

it('stores a due date as a date, not as a date and a time', function () {
    $item = ActionItem::factory()->create(['due_on' => '2026-10-10']);
    $reminder = ActionItemReminder::query()->create([
        'action_item_id' => $item->id,
        'user_id' => $item->created_by_user_id,
        'kind' => 'due_soon',
        'due_on' => Carbon::parse('2026-10-10')->startOfDay(),
        'sent_at' => now(),
    ]);

    expect((string) DB::table('action_items')->where('id', $item->id)->value('due_on'))->toBe('2026-10-10')
        ->and((string) DB::table('action_item_reminders')->where('id', $reminder->id)->value('due_on'))->toBe('2026-10-10');
});

it('finds an item by the day it is due, at both ends of a range', function () {
    $item = ActionItem::factory()->create(['due_on' => '2026-10-11']);

    expect(ActionItem::query()->whereBetween('due_on', ['2026-10-04', '2026-10-11'])->whereKey($item->id)->exists())->toBeTrue()
        ->and(ActionItem::query()->whereBetween('due_on', ['2026-10-11', '2026-10-12'])->whereKey($item->id)->exists())->toBeTrue()
        ->and(ActionItem::query()->where('due_on', '2026-10-11')->whereKey($item->id)->exists())->toBeTrue();
});

it('keeps serialising a due date the way it did', function () {
    $item = ActionItem::factory()->create(['due_on' => '2026-10-10']);

    expect($item->fresh()->toArray()['due_on'])->toBe('2026-10-10T00:00:00.000000Z')
        ->and(json_decode((string) json_encode($item->fresh()), true)['due_on'])->toBe('2026-10-10T00:00:00.000000Z')
        ->and($item->fresh()->due_on->toDateString())->toBe('2026-10-10');
});

it('does not see a change when the same day is given again', function () {
    $item = ActionItem::factory()->create(['due_on' => '2026-10-10'])->fresh();

    $item->due_on = Carbon::parse('2026-10-10 18:00:00');

    expect($item->isDirty('due_on'))->toBeFalse();
});
