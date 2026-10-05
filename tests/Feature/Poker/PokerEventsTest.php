<?php

use App\Actions\Poker\PresentPokerTask;
use App\Events\Poker\PokerBroadcastEvent;
use App\Events\Poker\PokerGameChanged;
use App\Events\Poker\PokerGameDeleted;
use App\Events\Poker\PokerRoundChanged;
use App\Events\Poker\PokerTaskDeleted;
use App\Events\Poker\PokerTaskEstimated;
use App\Events\Poker\PokerTaskSaved;
use App\Events\Poker\PokerTasksReordered;
use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerGame;
use App\Models\PokerTask;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

it('broadcasts on the poker presence channel', function () {
    $event = new PokerRoundChanged('game-id');

    expect($event)->toBeInstanceOf(ShouldBroadcastNow::class)
        ->and($event)->toBeInstanceOf(ShouldDispatchAfterCommit::class)
        ->and($event->broadcastOn())->toBeInstanceOf(PresenceChannel::class)
        ->and($event->broadcastOn()->name)->toBe('presence-poker.game-id');
});

it('never puts a card value in a broadcast payload', function (PokerBroadcastEvent $event, string $name, array $keys) {
    expect($event->broadcastAs())->toBe($name)
        ->and(array_keys($event->broadcastWith()))->toBe($keys);
})->with([
    'task saved' => [fn () => new PokerTaskSaved('g', ['id' => 't']), 'task.saved', ['task']],
    'task deleted' => [fn () => new PokerTaskDeleted('g', 't'), 'task.deleted', ['taskId']],
    'tasks reordered' => [fn () => new PokerTasksReordered('g', ['a', 'b']), 'tasks.reordered', ['taskIds']],
    'vote changed' => [fn () => new PokerVoteChanged('g', 'r', 'p', true, 2, 3), 'vote.changed', ['roundId', 'playerId', 'hasVoted', 'votesCount', 'version']],
    'round changed' => [fn () => new PokerRoundChanged('g'), 'round.changed', []],
    'game changed' => [fn () => new PokerGameChanged('g'), 'game.changed', []],
    'game deleted' => [fn () => new PokerGameDeleted('g'), 'game.deleted', []],
]);

it('keeps votes out of task payloads', function () {
    $game = PokerGame::factory()->create();
    [, $player] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $player, '13');

    $payload = resolve(PresentPokerTask::class)->handle($round->task->fresh());

    expect(array_keys($payload))->toBe(['id', 'title', 'description', 'descriptionHtml', 'acceptanceCriteriaHtml', 'position', 'estimate', 'estimatedAt', 'roundsCount', 'votesCount', 'external'])
        ->and($payload['roundsCount'])->toBe(1)
        ->and($payload['votesCount'])->toBe(1)
        ->and(payloadJson($payload))->not->toContain('"13"')
        ->and($payload['external'])->toBeNull();
});

it('dispatches the estimate event after commit', function () {
    $task = PokerTask::factory()->create();

    expect(new PokerTaskEstimated($task))->toBeInstanceOf(ShouldDispatchAfterCommit::class)
        ->and((new PokerTaskEstimated($task))->task->is($task))->toBeTrue();
});
