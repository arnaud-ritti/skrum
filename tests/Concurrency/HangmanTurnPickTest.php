<?php

use App\Enums\GameKind;
use App\Models\GameRoom;
use App\Models\GameRound;
use Tests\Concurrency\Support\Race;

it('picks one letter when the turn\'s player double-clicks two keys', function () {
    $room = GameRoom::factory()->game(GameKind::Hangman)->create(['takes_turns' => true]);
    gameRoomHost($room);
    [$aUser, $a] = gameRoomMember($room);
    [, $b] = gameRoomMember($room);
    $round = activeGameRound($room, ['word' => 'zanzibar', 'turn_order' => [$a->id, $b->id], 'turn_player_id' => $a->id]);
    $uri = route('games.rounds.letters.store', [$room, $round], false);
    $userId = $aUser->id;

    $outcomes = Race::run([
        static fn (): int => Race::request($userId, 'POST', $uri, ['letter' => 'a']),
        static fn (): int => Race::request($userId, 'POST', $uri, ['letter' => 'z']),
    ]);

    expect(collect($outcomes)->pluck('value')->sort()->values()->all())->toBe([200, 403])
        ->and(GameRound::query()->find($round->id)->picked_letters)->toHaveCount(1);
});
