<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Models\GameUsedWord;
use App\Support\Games\GameWordBook;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;

class DrawGameWord
{
    public function __construct(private GameWordBook $gameWordBook) {}

    public function handle(GameRoom $room, bool $drawableOnly): string
    {
        $pool = $this->gameWordBook->words($room->locale, $drawableOnly);
        $available = array_values(array_diff($pool, $this->history($room)->pluck('word')->all()));

        if ($available === []) {
            $previous = $this->history($room)->latest()->value('word');

            $this->history($room)->delete();

            $available = array_values(array_diff($pool, [$previous])) ?: $pool;
        }

        /** @var string $word */
        $word = Arr::random($available);

        GameUsedWord::query()->firstOrCreate(['team_id' => $room->team_id, 'locale' => $room->locale, 'word' => $word]);

        return $word;
    }

    /** @return Builder<GameUsedWord> */
    private function history(GameRoom $room): Builder
    {
        return GameUsedWord::query()
            ->where('team_id', $room->team_id)
            ->where('locale', $room->locale);
    }
}
