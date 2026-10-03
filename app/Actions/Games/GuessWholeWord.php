<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\GuessResult;
use App\Events\Games\GameGuessMade;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameWord;
use App\Support\Games\GuessMatch;
use App\Support\Games\HangmanRules;
use Illuminate\Support\Facades\DB;

class GuessWholeWord
{
    public function __construct(
        private EndGameRound $endGameRound,
        private AdvanceGameTurn $advanceGameTurn,
    ) {}

    /**
     * Spec §6.6: right solves the round for its guesser; wrong costs a life
     * and is shown to everyone; in turns it is the guesser's turn either way.
     *
     * @return array{result: string, guessId: string, misses: int, ended: ?array<string, mixed>}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, string $text): array
    {
        return DB::transaction(function () use ($room, $round, $player, $text): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::Hangman);
            GameGuard::turn($lockedRound, $player);

            $word = (string) $lockedRound->word;
            $isCorrect = GuessMatch::check($word, $text) === GuessResult::Correct;

            $guess = $lockedRound->guesses()->create([
                'player_id' => $player->id,
                'text' => $text,
                'is_near_miss' => false,
                'is_correct' => $isCorrect,
            ]);

            if ($isCorrect) {
                $lockedRound->forceFill(['revealed_positions' => GameWord::letterPositions($word)])->save();

                return [
                    'result' => 'correct',
                    'guessId' => $guess->id,
                    'misses' => $lockedRound->misses,
                    'ended' => $this->endGameRound->handle($lockedRoom, $lockedRound, GameRoundOutcome::Solved, $player),
                ];
            }

            $lockedRound->forceFill(['misses' => $lockedRound->misses + 1])->save();

            (new GameGuessMade($lockedRoom, [
                'roundId' => $lockedRound->id,
                'guessId' => $guess->id,
                'playerId' => $player->id,
                'text' => $guess->text,
                'misses' => $lockedRound->misses,
            ]))->sendToOthers();

            if ($lockedRound->misses >= HangmanRules::MaxMisses) {
                return [
                    'result' => 'wrong',
                    'guessId' => $guess->id,
                    'misses' => $lockedRound->misses,
                    'ended' => $this->endGameRound->handle($lockedRoom, $lockedRound, GameRoundOutcome::Lost),
                ];
            }

            if ($lockedRound->takesTurns()) {
                $this->advanceGameTurn->handle($lockedRoom, $lockedRound);
            }

            return ['result' => 'wrong', 'guessId' => $guess->id, 'misses' => $lockedRound->misses, 'ended' => null];
        });
    }
}
