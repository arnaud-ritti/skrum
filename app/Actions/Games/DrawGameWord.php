<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Support\Games\GameWordBook;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class DrawGameWord
{
    public function __construct(private GameWordBook $gameWordBook) {}

    public function handle(GameRoom $room, bool $drawableOnly): string
    {
        $pool = $this->gameWordBook->words($room->locale, $drawableOnly);
        $available = array_values(array_diff($pool, $this->history($room)->pluck('word')->all()));

        if ($available === []) {
            $previous = $this->history($room)->orderByDesc('created_at')->value('word');

            $this->history($room)->delete();

            $available = array_values(array_diff($pool, [$previous])) ?: $pool;
        }

        /** @var string $word */
        $word = Arr::random($available);

        DB::table('game_used_words')->insertOrIgnore([
            'team_id' => $room->team_id,
            'locale' => $room->locale,
            'word' => $word,
            'created_at' => now(),
        ]);

        return $word;
    }

    private function history(GameRoom $room): Builder
    {
        return DB::table('game_used_words')
            ->where('team_id', $room->team_id)
            ->where('locale', $room->locale);
    }
}
