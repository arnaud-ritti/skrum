<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Models\GameUsedWord;
use App\Support\Games\GameWordBook;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

class DrawGameWord
{
    public function __construct(private GameWordBook $gameWordBook) {}

    public function handle(GameRoom $room, bool $drawableOnly): string
    {
        $pool = $this->gameWordBook->words($room->locale, $drawableOnly, $room->wordThemes());

        if ($pool === []) {
            throw ValidationException::withMessages(['game' => __('No word fits these themes.')]);
        }

        $used = $this->history($room)->whereIn('word', $pool)->pluck('word')->all();
        $available = array_values(array_diff($pool, $used));

        if ($available === []) {
            $previous = $this->history($room)->whereIn('word', $pool)->latest()->orderByDesc('word')->value('word');

            $this->history($room)->whereIn('word', $pool)->delete();

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
