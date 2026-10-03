<?php

use App\Enums\GameKind;
use App\Models\GameRoom;
use App\Models\GameRound;
use Tests\Concurrency\Support\Race;

it('moves one turn when the player and the host end it at the same moment', function () {
    $room = GameRoom::factory()->create(['takes_turns' => true, 'game' => GameKind::Hangman]);
    [$hostUser, $host] = gameRoomHost($room);
    [$aUser, $a] = gameRoomMember($room);
    [, $b] = gameRoomMember($room);
    $round = activeGameRound($room, ['word' => 'rocket', 'turn_order' => [$a->id, $b->id, $host->id], 'turn_player_id' => $a->id]);
    $uri = route('games.rounds.turn.store', [$room, $round], false);
    $payload = ['expected_player_id' => $a->id];
    $hostUserId = $hostUser->id;
    $aUserId = $aUser->id;

    $outcomes = Race::run([
        static fn (): int => Race::request($aUserId, 'POST', $uri, $payload),
        static fn (): int => Race::request($hostUserId, 'POST', $uri, $payload),
    ]);

    expect(collect($outcomes)->pluck('value')->sort()->values()->all())->toBe([200, 409])
        ->and(GameRound::query()->find($round->id)->turn_player_id)->toBe($b->id);
});
