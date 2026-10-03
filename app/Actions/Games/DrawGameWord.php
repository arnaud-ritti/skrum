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

    /**
     * @param  ?string  $except  the word being replaced, never drawn again here
     */
    public function handle(GameRoom $room, bool $drawableOnly, ?string $except = null): string
    {
        $pool = $this->pool($room, $drawableOnly, $except);

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

    /**
     * The words the room's themes allow.
     *
     * @param  ?string  $except  the word being replaced, left out
     * @return array<int, string>
     */
    public function pool(GameRoom $room, bool $drawableOnly, ?string $except = null): array
    {
        return array_values(array_diff($this->gameWordBook->words($room->locale, $drawableOnly, $room->wordThemes()), [$except]));
    }

    /** @return Builder<GameUsedWord> */
    private function history(GameRoom $room): Builder
    {
        return GameUsedWord::query()
            ->where('team_id', $room->team_id)
            ->where('locale', $room->locale);
    }
}
