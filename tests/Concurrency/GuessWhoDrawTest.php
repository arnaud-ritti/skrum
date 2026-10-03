<?php

use App\Enums\GameKind;
use App\Models\GameRoom;
use App\Models\GameTextAnswer;
use Tests\Concurrency\Support\Race;

it('draws one answer when two reveals arrive at once', function () {
    $room = GameRoom::factory()->game(GameKind::GuessWho)->create();
    [$user] = gameRoomHost($room);
    [, $a] = gameRoomMember($room);
    [, $b] = gameRoomMember($room);
    $round = activeGameRound($room, ['word' => null, 'question' => 'First job?']);
    GameTextAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $a->id]);
    GameTextAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $b->id]);
    $uri = route('games.rounds.reveal.store', [$room, $round], false);
    $userId = $user->id;

    $outcomes = Race::run([
        static fn (): int => Race::request($userId, 'POST', $uri),
        static fn (): int => Race::request($userId, 'POST', $uri),
    ]);

    expect(collect($outcomes)->pluck('value')->sort()->values()->all())->toBe([200, 409])
        ->and(GameTextAnswer::query()->where('is_drawn', true)->count())->toBe(1);
});
