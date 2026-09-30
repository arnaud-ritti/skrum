<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameHintRevealed;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameWord;
use App\Support\Games\WordGuessRules;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RevealGameHint
{
    /**
     * One random hidden letter, up to half the word's letters; separators
     * are always shown already and never count.
     *
     * @return array{roundId: string, mask: array<int, ?string>}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player): array
    {
        return DB::transaction(function () use ($room, $round, $player): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::leader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::DrawAndGuess, GameKind::Decoded);

            $word = (string) $lockedRound->word;
            $revealed = $lockedRound->revealed_positions;
            $hidden = array_values(array_diff(GameWord::letterPositions($word), $revealed));

            if ($hidden === [] || count($revealed) >= WordGuessRules::maxHints($word)) {
                throw ValidationException::withMessages(['hint' => __('No more letters can be revealed for this word.')]);
            }

            $revealed[] = $hidden[array_rand($hidden)];
            sort($revealed);

            $lockedRound->forceFill(['revealed_positions' => $revealed])->save();

            $mask = GameWord::mask($word, $revealed);

            (new GameHintRevealed($lockedRoom, $lockedRound->id, $mask))->sendToOthers();

            return ['roundId' => $lockedRound->id, 'mask' => $mask];
        });
    }
}
