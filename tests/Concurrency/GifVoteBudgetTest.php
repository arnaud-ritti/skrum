<?php

use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use Tests\Concurrency\Support\Race;

it('never gives a player more GIF votes than the round allows', function () {
    [$room] = sprintGifRoom();
    $round = activeGifRound($room, ['revealed_at' => now(), 'votes_allowed' => 2]);
    $answerIds = collect(range(1, 4))->map(fn (int $index): string => GameGifAnswer::factory()->create([
        'game_round_id' => $round->id,
        'player_id' => GamePlayer::factory()->create(['game_room_id' => $room->id])->id,
        'gif_id' => "gif{$index}",
    ])->id)->all();
    [$voterUser, $voter] = gameRoomMember($room);
    $uri = route('games.rounds.vote.update', [$room, $round], false);
    $userId = $voterUser->id;

    [$first, $second, $third, $fourth] = $answerIds;

    $outcomes = Race::run([
        static fn (): int => Race::request($userId, 'PUT', $uri, ['answer_id' => $first]),
        static fn (): int => Race::request($userId, 'PUT', $uri, ['answer_id' => $second]),
        static fn (): int => Race::request($userId, 'PUT', $uri, ['answer_id' => $third]),
        static fn (): int => Race::request($userId, 'PUT', $uri, ['answer_id' => $fourth]),
    ]);

    expect(collect($outcomes)->pluck('value')->countBy()->all())->toEqual([204 => 2, 409 => 2])
        ->and(GameGifVote::query()->where('voter_player_id', $voter->id)->count())->toBe(2);
});
