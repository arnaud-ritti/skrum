<?php

use App\Enums\GameKind;
use App\Events\Games\GameRoundStarted;
use App\Events\Games\GameStatementsChanged;
use App\Events\Games\GameVoteChanged;
use App\Models\GameRoom;
use Illuminate\Support\Facades\Event;

beforeEach(fn () => Event::fake());

it('gives a set to its author only before its round, the lie to the teller only, and another player\'s vote to nobody, until the end', function () {
    $room = GameRoom::factory()->game(GameKind::TwoTruths)->create();
    [$hostUser, $host] = gameRoomHost($room);
    [$tellerUser, $teller] = gameRoomMember($room);
    [$aUser, $a] = gameRoomMember($room);
    [, $b] = gameRoomMember($room);

    $this->actingAs($tellerUser)->putJson(route('games.statements.update', $room), ['statements' => ['I ski', 'I sing', 'I fly'], 'lie_index' => 2]);

    foreach ([$host, $a, $b] as $viewer) {
        expect(gamePayloadExposesWord(gameSnapshotFor($room, $viewer), 'I sing'))->toBeFalse();
    }

    Event::assertDispatched(GameStatementsChanged::class, fn (GameStatementsChanged $event) => ! gamePayloadExposesWord($event->broadcastWith(), 'I sing') && ! array_key_exists('lieIndex', $event->broadcastWith()));

    $round = $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room), ['leader_player_id' => $teller->id])->json('round');
    $this->actingAs($aUser)->putJson(route('games.rounds.choice.update', [$room, $round['id']]), ['choice' => '1']);

    expect(gameSnapshotFor($room, $teller)['round']['lieIndex'])->toBe(2);

    foreach ([$host, $a, $b] as $viewer) {
        $snapshot = gameSnapshotFor($room, $viewer);

        expect($snapshot['round'])->not->toHaveKey('lieIndex')
            ->and($snapshot['round']['voters'])->toBe([$a->id])
            ->and($snapshot['round']['myChoice'])->toBe($viewer->is($a) ? 1 : null)
            ->and($snapshot['truthSets']['mine'])->toBeNull();
    }

    Event::assertDispatched(GameRoundStarted::class, fn (GameRoundStarted $event) => ! array_key_exists('lieIndex', $event->round));
    Event::assertDispatched(GameVoteChanged::class, fn (GameVoteChanged $event) => ! array_key_exists('choice', $event->broadcastWith()));
});
