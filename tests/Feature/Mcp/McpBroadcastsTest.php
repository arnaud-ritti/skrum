<?php

use App\Enums\McpScope;
use App\Events\ActionItems\ActionItemCreated;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Events\Poker\PokerRoundChanged;
use App\Events\Poker\PokerTaskSaved;
use App\Events\Retros\ActionItemSaved;
use App\Events\Retros\CardDeleted;
use App\Events\Retros\CardUpdated;
use App\Events\Retros\InsightsChanged;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([
        ActionItemSaved::class,
        TeamActionItemSaved::class,
        ActionItemCreated::class,
        CardUpdated::class,
        CardDeleted::class,
        InsightsChanged::class,
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

it('broadcasts action item updates and completions to everyone', function () {
    $world = mcpSweepWorld();
    $server = actingAsMcp($world['user'], McpScope::cases());

    $server->tool(mcpToolClass('retro.actions.update'), ['action_id' => $world['actionItem']->id, 'content' => 'Reworded'])->assertHasNoErrors();

    Event::assertDispatched(ActionItemSaved::class, fn (ActionItemSaved $event): bool => $event->socket === null
        && $event->retroId === $world['discussing']->id
        && $event->actionItem['content'] === 'Reworded');

    $server->tool(mcpToolClass('retro.actions.complete'), ['action_id' => $world['actionItem']->id])->assertHasNoErrors();

    Event::assertDispatched(ActionItemSaved::class, fn (ActionItemSaved $event): bool => $event->socket === null
        && $event->actionItem['id'] === $world['actionItem']->id
        && $event->actionItem['status'] === 'completed');
    Event::assertDispatched(TeamActionItemSaved::class, fn (TeamActionItemSaved $event): bool => $event->socket === null);
});

it('broadcasts suggestion promotions and rejections to everyone', function () {
    configureLlm();
    $world = mcpSweepWorld();
    $server = actingAsMcp($world['user'], McpScope::cases());

    $server->tool(mcpToolClass('retro.board.suggested_actions.promote'), ['board_id' => $world['discussing']->id, 'suggested_action_id' => $world['promote']->id])->assertHasNoErrors();

    Event::assertDispatched(InsightsChanged::class, fn (InsightsChanged $event): bool => $event->socket === null && $event->retroId === $world['discussing']->id);
    Event::assertDispatched(ActionItemSaved::class, fn (ActionItemSaved $event): bool => $event->socket === null && $event->actionItem['content'] === 'Promote me');

    $server->tool(mcpToolClass('retro.board.suggested_actions.reject'), ['board_id' => $world['discussing']->id, 'suggested_action_id' => $world['reject']->id])->assertHasNoErrors();

    Event::assertDispatchedTimes(InsightsChanged::class, 2);
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

it('broadcasts a task selection to everyone', function () {
    $world = mcpSweepWorld();

    actingAsMcp($world['user'], McpScope::cases())
        ->tool(mcpToolClass('poker.game.task.select'), ['game_id' => $world['game']->id, 'task_id' => $world['next']->id])
        ->assertHasNoErrors();

    Event::assertDispatched(PokerRoundChanged::class, fn (PokerRoundChanged $event): bool => $event->socket === null && $event->gameId === $world['game']->id);
});

it('does not exclude a socket when the request carries an X-Socket-ID header', function () {
    $world = mcpSweepWorld();
    $token = issueTestMcpToken($world['user'], [McpScope::Write]);

    postMcp(
        $token,
        mcpToolCallPayload('retro.actions.create', ['board_id' => $world['discussing']->id, 'content' => 'Socket header']),
        ['X-Socket-ID' => '1234.5678'],
    )->assertOk();

    Event::assertDispatched(ActionItemSaved::class, fn (ActionItemSaved $event): bool => $event->socket === null
        && $event->actionItem['content'] === 'Socket header');
});
