<?php

namespace App\Actions\Games;

use App\Events\Games\GameHintRevealed;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameWord;
use App\Support\Games\WordGuessRules;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

class RevealHintLetter
{
    /**
     * One random hidden letter, up to half the word's letters; separators
     * are always shown already and never count. The caller holds the locks.
     *
     * @return array<int, ?string>
     */
    public function handle(GameRoom $lockedRoom, GameRound $lockedRound): array
    {
        $word = (string) $lockedRound->word;
        $revealed = $lockedRound->revealed_positions;
        $hidden = array_values(array_diff(GameWord::letterPositions($word), $revealed));

        if ($hidden === [] || count($revealed) >= WordGuessRules::maxHints($word)) {
            throw ValidationException::withMessages(['hint' => __('No more letters can be revealed for this word.')]);
        }

        $revealed[] = Arr::random($hidden);
        sort($revealed);

        $lockedRound->forceFill(['revealed_positions' => $revealed])->save();

        $mask = GameWord::mask($word, $revealed);

        (new GameHintRevealed($lockedRoom, $lockedRound->id, $mask))->sendToOthers();

        return $mask;
    }
}
