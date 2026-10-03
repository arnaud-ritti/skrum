<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameWordChanged;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\DrawAndGuessRules;
use App\Support\Games\GameWord;
use App\Support\Games\WordGuessRules;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ChangeDrawWord
{
    public function __construct(private DrawGameWord $drawGameWord) {}

    /**
     * Spec §6.15: once per round, before anyone found; the drawing and the
     * letters shown go with the old word.
     *
     * @return array{roundId: string, word: string, mask: array<int, ?string>, maxHints: int, wordChangesLeft: int}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player): array
    {
        return DB::transaction(function () use ($room, $round, $player): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::roundGame($lockedRound, GameKind::DrawAndGuess);
            GameGuard::leader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);

            if ($lockedRound->word_changes >= DrawAndGuessRules::WordChangesAllowed) {
                throw new ConflictHttpException(__('You have already changed the word.'));
            }

            if ($lockedRound->hasFinders()) {
                throw new ConflictHttpException(__('Someone has already found the word.'));
            }

            $word = $this->drawGameWord->handle($lockedRoom, true, $lockedRound->word);

            $lockedRound->forceFill([
                'word' => $word,
                'revealed_positions' => [],
                'drawing' => [],
                'drawing_points' => 0,
                'word_changes' => $lockedRound->word_changes + 1,
            ])->save();

            $mask = GameWord::mask($word, []);
            $maxHints = WordGuessRules::maxHints($word);

            (new GameWordChanged($lockedRoom, ['roundId' => $lockedRound->id, 'mask' => $mask, 'maxHints' => $maxHints]))->sendToOthers();

            return [
                'roundId' => $lockedRound->id,
                'word' => $word,
                'mask' => $mask,
                'maxHints' => $maxHints,
                'wordChangesLeft' => max(0, DrawAndGuessRules::WordChangesAllowed - $lockedRound->word_changes),
            ];
        });
    }
}
