<?php

use App\Enums\RetroPhase;
use App\Events\Games\GameBroadcastEvent;
use App\Events\Games\GameClueChanged;
use App\Events\Games\GameDrawingCleared;
use App\Events\Games\GameDrawingOpAdded;
use App\Events\Games\GameDrawingUndone;
use App\Events\Games\GameGuessMade;
use App\Events\Games\GameHintRevealed;
use App\Events\Games\GameLetterPicked;
use App\Events\Games\GameRoomChanged;
use App\Events\Games\GameRoomDeleted;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundStarted;
use App\Events\Games\GameTimerChanged;
use App\Models\GameRoom;
use App\Models\Retro;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

it('broadcasts standalone rooms on their presence channel', function () {
    $room = GameRoom::factory()->create();
    $event = new GameRoomChanged($room);

    expect($event)->toBeInstanceOf(ShouldBroadcastNow::class)
        ->and($event)->toBeInstanceOf(ShouldDispatchAfterCommit::class)
        ->and($event->broadcastOn())->toBeInstanceOf(PresenceChannel::class)
        ->and($event->broadcastOn()->name)->toBe("presence-game.{$room->id}");
});

it('broadcasts icebreaker rooms on the retro channel', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    $room = GameRoom::factory()->icebreaker($retro)->create();

    expect((new GameRoomChanged($room))->broadcastOn()->name)->toBe("presence-retro.{$retro->id}");
});

it('names every event and its payload keys', function (Closure $make, string $name, array $keys) {
    $room = GameRoom::factory()->create();

    /** @var GameBroadcastEvent $event */
    $event = $make($room);

    expect($event->broadcastAs())->toBe($name)
        ->and(array_keys($event->broadcastWith()))->toBe($keys);
})->with([
    'room changed' => [fn (GameRoom $room) => new GameRoomChanged($room), 'game.room.changed', []],
    'room deleted' => [fn (GameRoom $room) => new GameRoomDeleted($room), 'game.room.deleted', []],
    'timer changed' => [fn (GameRoom $room) => new GameTimerChanged($room, null), 'game.timer.changed', ['timerEndsAt']],
    'round started' => [fn (GameRoom $room) => new GameRoundStarted($room, ['id' => 'r']), 'game.round.started', ['round']],
    'round ended' => [fn (GameRoom $room) => new GameRoundEnded($room, ['roundId' => 'r', 'points' => []]), 'game.round.ended', ['roundId', 'points']],
    'letter picked' => [fn (GameRoom $room) => new GameLetterPicked($room, ['roundId' => 'r', 'letter' => 'a']), 'game.letter.picked', ['roundId', 'letter']],
    'hint revealed' => [fn (GameRoom $room) => new GameHintRevealed($room, 'r', [null, 'a']), 'game.hint.revealed', ['roundId', 'mask']],
    'guess made' => [fn (GameRoom $room) => new GameGuessMade($room, ['roundId' => 'r', 'guessId' => 'g', 'playerId' => 'p', 'text' => 'kit']), 'game.guess.made', ['roundId', 'guessId', 'playerId', 'text']],
    'drawing op added' => [fn (GameRoom $room) => new GameDrawingOpAdded($room, 'r', ['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 1], 'op-1'), 'game.drawing.op-added', ['roundId', 'op', 'clientOpId']],
    'drawing undone' => [fn (GameRoom $room) => new GameDrawingUndone($room, 'r'), 'game.drawing.undone', ['roundId']],
    'drawing cleared' => [fn (GameRoom $room) => new GameDrawingCleared($room, 'r'), 'game.drawing.cleared', ['roundId']],
    'clue changed' => [fn (GameRoom $room) => new GameClueChanged($room, 'r', ['🚀']), 'game.clue.changed', ['roundId', 'clue']],
]);
