<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameTurnChanged;
use App\Models\GameRoom;
use App\Models\GameRound;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Event::fake();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-27 10:00:00'));
});

/**
 * @return array{room: GameRoom, round: GameRound, hostUser: mixed, aUser: mixed, a: mixed, bUser: mixed, b: mixed}
 */
function hangmanTurnTable(string $word = 'zanzibar', array $roomAttributes = []): array
{
    $room = GameRoom::factory()->game(GameKind::Hangman)->create(['takes_turns' => true, ...$roomAttributes]);
    [$hostUser] = gameRoomHost($room);
    [$aUser, $a] = gameRoomMember($room);
    [$bUser, $b] = gameRoomMember($room);
    $round = activeGameRound($room, [
        'word' => $word,
        'turn_order' => [$a->id, $b->id],
        'turn_player_id' => $a->id,
        'turn_seconds' => $roomAttributes['turn_seconds'] ?? null,
        'turn_ends_at' => isset($roomAttributes['turn_seconds']) ? now()->addSeconds($roomAttributes['turn_seconds']) : null,
    ]);

    return compact('room', 'round', 'hostUser', 'aUser', 'a', 'bUser', 'b');
}

it('starts a room that takes turns only with an order', function () {
    $room = GameRoom::factory()->game(GameKind::Hangman)->create(['takes_turns' => true]);
    [$user, $host] = gameRoomHost($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertUnprocessable();
    $this->actingAs($user)->postJson(route('games.rounds.store', $room), ['turn_order' => [$host->id]])
        ->assertCreated()
        ->assertJsonPath('round.turnPlayerId', $host->id);
});

it('lets only the turn\'s player pick, and passes the turn after a hit or a miss', function () {
    ['room' => $room, 'round' => $round, 'aUser' => $aUser, 'bUser' => $bUser, 'a' => $a, 'b' => $b] = hangmanTurnTable();

    $this->actingAs($bUser)->postJson(route('games.rounds.letters.store', [$room, $round]), ['letter' => 'a'])->assertForbidden();

    $this->actingAs($aUser)->postJson(route('games.rounds.letters.store', [$room, $round]), ['letter' => 'a'])
        ->assertOk()
        ->assertJsonPath('hit', true)
        ->assertJsonPath('turnPlayerId', $b->id);

    $this->actingAs($bUser)->postJson(route('games.rounds.letters.store', [$room, $round]), ['letter' => 'q'])
        ->assertOk()
        ->assertJsonPath('hit', false)
        ->assertJsonPath('turnPlayerId', $a->id);

    Event::assertDispatchedTimes(GameTurnChanged::class, 2);
});

it('does not pass the turn on the letter that solves the word', function () {
    ['room' => $room, 'round' => $round, 'aUser' => $aUser, 'a' => $a] = hangmanTurnTable('aaa');

    $this->actingAs($aUser)->postJson(route('games.rounds.letters.store', [$room, $round]), ['letter' => 'a'])
        ->assertOk()
        ->assertJsonPath('ended.outcome', GameRoundOutcome::Solved->value)
        ->assertJsonPath('turnPlayerId', $a->id);

    Event::assertNotDispatched(GameTurnChanged::class);
});

it('passes an expired turn without a miss', function () {
    ['room' => $room, 'round' => $round, 'aUser' => $aUser, 'b' => $b] = hangmanTurnTable('zanzibar', ['turn_seconds' => 30]);

    $this->travel(31)->seconds();
    $this->actingAs($aUser)->getJson(route('games.snapshot.show', $room))->assertJsonPath('round.turnPlayerId', $b->id);

    expect($round->fresh()->misses)->toBe(0);
});

it('lets anyone pick in a round without turns, as before', function () {
    $room = GameRoom::factory()->game(GameKind::Hangman)->create(['takes_turns' => false]);
    gameRoomHost($room);
    [$aUser] = gameRoomMember($room);
    [$bUser] = gameRoomMember($room);
    $round = activeGameRound($room, ['word' => 'zanzibar']);

    $this->actingAs($aUser)->postJson(route('games.rounds.letters.store', [$room, $round]), ['letter' => 'a'])->assertOk()->assertJsonPath('turnPlayerId', null);
    $this->actingAs($bUser)->postJson(route('games.rounds.letters.store', [$room, $round]), ['letter' => 'z'])->assertOk();
});
