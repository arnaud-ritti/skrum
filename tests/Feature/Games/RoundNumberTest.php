<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GameRoom;
use App\Models\GameRound;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-27 10:00:00'));
});

function startHangman(GameRoom $room, mixed $user): array
{
    return test()->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated()->json('round');
}

function endCurrentRound(GameRoom $room): void
{
    GameRound::query()->whereKey($room->fresh()->current_round_id)->update(['outcome' => GameRoundOutcome::Solved, 'ended_at' => now()]);
    test()->travel(1)->seconds();
}

it('numbers the rounds of a game and starts again after the last one', function () {
    $room = GameRoom::factory()->game(GameKind::Hangman)->create(['rounds_per_game' => 2]);
    [$user] = gameRoomHost($room);

    expect(startHangman($room, $user))->number->toBe(1)->roundsTotal->toBe(2);
    endCurrentRound($room);
    expect(startHangman($room, $user))->number->toBe(2)->roundsTotal->toBe(2);
    endCurrentRound($room);
    expect(startHangman($room, $user))->number->toBe(1);
});

it('counts on without end when the room has no number of rounds', function () {
    $room = GameRoom::factory()->game(GameKind::Hangman)->create();
    [$user] = gameRoomHost($room);

    foreach ([1, 2, 3] as $expected) {
        expect(startHangman($room, $user))->number->toBe($expected)->roundsTotal->toBeNull();
        endCurrentRound($room);
    }
});

it('starts again at 1 after a game switch, a round from before the release, or a smaller number of rounds', function () {
    $room = GameRoom::factory()->game(GameKind::Hangman)->create();
    [$user] = gameRoomHost($room);
    GameRound::factory()->ended()->create(['game_room_id' => $room->id, 'game' => GameKind::DrawAndGuess, 'number' => 4, 'started_at' => now()->subMinute()]);

    expect(startHangman($room, $user))->number->toBe(1);
    endCurrentRound($room);

    GameRound::factory()->ended()->create(['game_room_id' => $room->id, 'game' => GameKind::Hangman, 'number' => null, 'started_at' => now()]);
    $this->travel(1)->seconds();

    expect(startHangman($room, $user))->number->toBe(1);
    endCurrentRound($room);
    expect(startHangman($room, $user))->number->toBe(2);
    endCurrentRound($room);

    $room->update(['rounds_per_game' => 2]);

    expect(startHangman($room, $user))->number->toBe(1)->roundsTotal->toBe(2);
});

it('carries the number in the history and in the end of a round', function () {
    $room = GameRoom::factory()->game(GameKind::Hangman)->create(['rounds_per_game' => 3]);
    [$user] = gameRoomHost($room);
    $round = startHangman($room, $user);

    $this->actingAs($user)->postJson(route('games.rounds.pass.store', [$room, $round['id']]))
        ->assertOk()
        ->assertJsonPath('ended.number', 1)
        ->assertJsonPath('ended.roundsTotal', 3);

    $this->actingAs($user)->getJson(route('games.rounds.index', $room))
        ->assertJsonPath('0.number', 1)
        ->assertJsonPath('0.roundsTotal', 3);
});
