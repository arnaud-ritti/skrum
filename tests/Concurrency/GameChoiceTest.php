<?php

use App\Enums\GameKind;
use App\Models\GameChoice;
use App\Models\GameRoom;
use Tests\Concurrency\Support\Race;

it('keeps one weather per player when two picks arrive at once', function () {
    $room = GameRoom::factory()->game(GameKind::MoodWeather)->create();
    gameRoomHost($room);
    [$user, $player] = gameRoomMember($room);
    $round = activeGameRound($room, ['word' => null]);
    $uri = route('games.rounds.choice.update', [$room, $round], false);
    $userId = $user->id;

    $outcomes = Race::run([
        static fn (): int => Race::request($userId, 'PUT', $uri, ['choice' => 'sunny']),
        static fn (): int => Race::request($userId, 'PUT', $uri, ['choice' => 'rainy']),
    ]);

    expect(collect($outcomes)->pluck('value')->all())->toBe([204, 204])
        ->and(GameChoice::query()->where('player_id', $player->id)->count())->toBe(1);
});
