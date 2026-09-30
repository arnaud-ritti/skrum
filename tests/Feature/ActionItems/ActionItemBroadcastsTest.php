<?php

use App\Actions\ActionItems\BroadcastActionItemChange;
use App\Enums\RetroPhase;
use App\Events\ActionItems\TeamActionItemCommentsChanged;
use App\Events\ActionItems\TeamActionItemDeleted;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Events\Retros\ActionItemCommentsChanged;
use App\Events\Retros\ActionItemDeleted;
use App\Events\Retros\ActionItemSaved;
use App\Events\Retros\CarriedActionItemCommentsChanged;
use App\Events\Retros\CarriedActionItemRemoved;
use App\Events\Retros\CarriedActionItemSaved;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Retro;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('sends board, carried and team events', function () {
    $team = Team::factory()->create();
    $source = Retro::factory()->anonymous()->inPhase(RetroPhase::Discussing)->create(['team_id' => $team->id, 'created_at' => now()->subDays(14)]);
    $running = Retro::factory()->create(['team_id' => $team->id, 'created_at' => now()->subDay()]);
    Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'created_at' => now()->subDays(7)]);
    Retro::factory()->create(['created_at' => now()->subDay()]);
    [$authorUser, $author] = retroMember($source);
    $item = ActionItem::factory()->create(['retro_id' => $source->id, 'created_by_participant_id' => $author->id]);

    app(BroadcastActionItemChange::class)->saved($item);

    Event::assertDispatched(ActionItemSaved::class, fn (ActionItemSaved $event) => $event->retroId === $source->id
        && $event->actionItem['isMine'] === false
        && $event->actionItem['createdBy']['name'] === $authorUser->name);
    Event::assertDispatchedTimes(CarriedActionItemSaved::class, 1);
    Event::assertDispatched(CarriedActionItemSaved::class, fn (CarriedActionItemSaved $event) => $event->retroId === $running->id
        && $event->broadcastOn()->name === "private-retro-members.{$running->id}"
        && $event->broadcastAs() === 'carried-action-item.saved'
        && $event->broadcastWith()['actionItem']['createdBy']['name'] === $authorUser->name);
    Event::assertDispatched(TeamActionItemSaved::class, fn (TeamActionItemSaved $event) => $event->teamId === $team->id
        && $event->broadcastOn()->name === "private-team-action-items.{$team->id}"
        && $event->broadcastAs() === 'team-action-item.saved'
        && $event->broadcastWith()['actionItem']['isMine'] === false);
});

it('sends no board event for completed retros or items without a retro', function () {
    $team = Team::factory()->create();
    $finished = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id]);
    $finishedItem = ActionItem::factory()->create(['retro_id' => $finished->id]);
    $teamItem = ActionItem::factory()->withoutRetro($team, teamMember($team))->create();

    app(BroadcastActionItemChange::class)->saved($finishedItem);
    app(BroadcastActionItemChange::class)->saved($teamItem);

    Event::assertNotDispatched(ActionItemSaved::class);
    Event::assertDispatchedTimes(TeamActionItemSaved::class, 2);
});

it('targets exactly the retros that carry the item', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-01 10:00:00'));
    $team = Team::factory()->create();
    $source = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'created_at' => '2026-09-01 10:00:00']);
    Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-08-01 10:00:00']);
    $beforeCompletion = Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-09-10 10:00:00']);
    $afterCompletion = Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-09-20 10:00:00']);
    Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'created_at' => '2026-09-25 10:00:00']);
    $item = ActionItem::factory()->create(['retro_id' => $source->id, 'completed_at' => '2026-09-15 10:00:00']);
    $teamItem = ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['created_at' => '2026-09-12 10:00:00']);
    $broadcast = app(BroadcastActionItemChange::class);

    expect($broadcast->carryingRetroIds($item->fresh()))->toBe([$beforeCompletion->id])
        ->and($broadcast->carryingRetroIds($teamItem->fresh()))->toBe([$afterCompletion->id]);
});

it('announces deletions and comment counts on every channel', function () {
    $team = Team::factory()->create();
    $source = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['team_id' => $team->id, 'created_at' => now()->subWeek()]);
    $running = Retro::factory()->create(['team_id' => $team->id]);
    $item = ActionItem::factory()->create(['retro_id' => $source->id]);
    ActionItemComment::factory()->count(3)->create(['action_item_id' => $item->id]);
    $broadcast = app(BroadcastActionItemChange::class);

    $broadcast->commentsChanged($item);
    $item->delete();
    $broadcast->deleted($item);

    $counts = ['actionItemId' => $item->id, 'commentCount' => 3];

    Event::assertDispatched(ActionItemCommentsChanged::class, fn (ActionItemCommentsChanged $event) => $event->retroId === $source->id
        && $event->broadcastAs() === 'action-item.comments.changed'
        && $event->broadcastWith() === $counts);
    Event::assertDispatched(CarriedActionItemCommentsChanged::class, fn (CarriedActionItemCommentsChanged $event) => $event->retroId === $running->id
        && $event->broadcastAs() === 'carried-action-item.comments.changed'
        && $event->broadcastWith() === $counts);
    Event::assertDispatched(TeamActionItemCommentsChanged::class, fn (TeamActionItemCommentsChanged $event) => $event->teamId === $team->id
        && $event->broadcastAs() === 'team-action-item.comments.changed'
        && $event->broadcastWith() === $counts);
    Event::assertDispatched(ActionItemDeleted::class, fn (ActionItemDeleted $event) => $event->retroId === $source->id && $event->actionItemId === $item->id);
    Event::assertDispatched(CarriedActionItemRemoved::class, fn (CarriedActionItemRemoved $event) => $event->retroId === $running->id
        && $event->broadcastAs() === 'carried-action-item.removed'
        && $event->broadcastWith() === ['actionItemId' => $item->id]);
    Event::assertDispatched(TeamActionItemDeleted::class, fn (TeamActionItemDeleted $event) => $event->teamId === $team->id
        && $event->broadcastAs() === 'team-action-item.deleted'
        && $event->broadcastWith() === ['actionItemId' => $item->id]);
});
