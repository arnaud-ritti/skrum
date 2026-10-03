<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Arr;

class PickRoundQuestion
{
    private const int RecentQuestions = 20;

    /**
     * @param  array<int, string>  $questions
     */
    public function handle(GameRoom $room, array $questions, ?string $current = null): string
    {
        $current = array_filter([$current]);

        $recent = GameRound::query()
            ->where('game_room_id', $room->id)
            ->whereNotNull('question')
            ->latest('started_at')
            ->orderByDesc('id')
            ->limit(self::RecentQuestions)
            ->pluck('question')
            ->all();

        $fresh = array_values(array_diff($questions, $recent, $current));

        if ($fresh === []) {
            $fresh = array_values(array_diff($questions, $current));
        }

        if ($fresh === []) {
            return $questions[0];
        }

        return Arr::random($fresh);
    }
}
