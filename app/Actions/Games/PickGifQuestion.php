<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Arr;

class PickGifQuestion
{
    private const int RecentQuestions = 20;

    public function __construct(private GameWordBook $gameWordBook) {}

    public function handle(GameRoom $room, ?string $current = null): string
    {
        $questions = $this->gameWordBook->questions($room->locale);
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
