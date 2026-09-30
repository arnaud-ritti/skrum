<?php

use App\Enums\McpScope;
use App\Events\ActionItems\ActionItemCreated;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Events\Poker\PokerRoundChanged;
use App\Events\Poker\PokerTaskSaved;
use App\Events\Retros\ActionItemSaved;
use App\Events\Retros\CardDeleted;
use App\Events\Retros\CardUpdated;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([
        ActionItemSaved::class,
        TeamActionItemSaved::class,
        ActionItemCreated::class,
        CardUpdated::class,
        CardDeleted::class,
        PokerTaskSaved::class,
        PokerRoundChanged::class,
    ]);
});

it('broadcasts action item writes to everyone', function () {
    $world = mcpSweepWorld();

    actingAsMcp($world['user'], McpScope::cases())
        ->tool(mcpToolClass('retro.actions.create'), ['board_id' => $world['discussing']->id, 'content' => 'Broadcast me'])
        ->assertHasNoErrors();

    Event::assertDispatched(ActionItemSaved::class, fn (ActionItemSaved $event): bool => $event->socket === null
        && $event->actionItem['content'] === 'Broadcast me');
    Event::assertDispatched(TeamActionItemSaved::class);
    Event::assertDispatched(ActionItemCreated::class);
});

it('broadcasts own message edits and deletions to everyone', function () {
    $world = mcpSweepWorld();
    $server = actingAsMcp($world['user'], McpScope::cases());

    $server->tool(mcpToolClass('retro.board.messages.update'), ['message_id' => $world['editable']->id, 'content' => 'Changed'])->assertHasNoErrors();
    $server->tool(mcpToolClass('retro.board.messages.delete_own'), ['message_id' => $world['deletable']->id])->assertHasNoErrors();

    Event::assertDispatched(CardUpdated::class, fn (CardUpdated $event): bool => $event->socket === null);
    Event::assertDispatched(CardDeleted::class, fn (CardDeleted $event): bool => $event->socket === null && $event->cardId === $world['deletable']->id);
});

it('broadcasts poker writes to everyone', function () {
    $world = mcpSweepWorld();
    $server = actingAsMcp($world['user'], McpScope::cases());

    $server->tool(mcpToolClass('poker.game.tasks.add'), ['game_id' => $world['game']->id, 'tasks' => [['title' => 'A'], ['title' => 'B']]])->assertHasNoErrors();
    $server->tool(mcpToolClass('poker.game.task.reveal'), ['game_id' => $world['game']->id, 'task_id' => $world['current']->id])->assertHasNoErrors();

    Event::assertDispatchedTimes(PokerTaskSaved::class, 3);
    Event::assertDispatched(PokerRoundChanged::class, fn (PokerRoundChanged $event): bool => $event->socket === null);
});
