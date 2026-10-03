<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\GuessResult;
use App\Events\Games\GameGuessMade;
use App\Events\Games\GameWordFound;
use App\Models\GameGuess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\DrawAndGuessRules;
use App\Support\Games\GuessMatch;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class MakeGameGuess
{
    public function __construct(private EndGameRound $endGameRound) {}

    /**
     * A correct guess is never broadcast: it ends the round, or, in a Draw &
     * Guess round started with its guessers, makes a finder. The other
     * guesses go to every player without saying whether they were close.
     *
     * @return array{result: string, guessId: string, ended: ?array<string, mixed>, found?: array{playerId: string, seconds: int, points: int}, word?: string}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, string $text): array
    {
        return DB::transaction(function () use ($room, $round, $player, $text): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::notLeader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::DrawAndGuess, GameKind::Decoded);

            if ($lockedRound->guesses()->where('player_id', $player->id)->where('is_correct', true)->exists()) {
                throw new ConflictHttpException(__('You have already found the word.'));
            }

            $result = GuessMatch::check((string) $lockedRound->word, $text);
            $isCorrect = $result === GuessResult::Correct;

            /** @var GameGuess $guess */
            $guess = $lockedRound->guesses()->create([
                'player_id' => $player->id,
                'text' => $text,
                'is_near_miss' => $result === GuessResult::Near,
                'is_correct' => $isCorrect,
                'hints' => $isCorrect ? count($lockedRound->revealed_positions) : null,
            ]);

            if ($isCorrect && $lockedRound->keepsFinding()) {
                return $this->found($lockedRoom, $lockedRound, $player, $guess);
            }

            if ($isCorrect) {
                return [
                    'result' => $result->value,
                    'guessId' => $guess->id,
                    'ended' => $this->endGameRound->handle($lockedRoom, $lockedRound, GameRoundOutcome::Guessed, $player),
                ];
            }

            (new GameGuessMade($lockedRoom, [
                'roundId' => $lockedRound->id,
                'guessId' => $guess->id,
                'playerId' => $player->id,
                'text' => $guess->text,
            ]))->sendToOthers();

            return ['result' => $result->value, 'guessId' => $guess->id, 'ended' => null];
        });
    }

    /**
     * Spec §6.15: the round goes on until every guesser has found; the first
     * finder is the round's winner, as the only finder was before.
     *
     * @return array{result: string, guessId: string, ended: ?array<string, mixed>, found: array{playerId: string, seconds: int, points: int}, word: string}
     */
    private function found(GameRoom $lockedRoom, GameRound $lockedRound, GamePlayer $player, GameGuess $guess): array
    {
        if ($lockedRound->winner_player_id === null) {
            $lockedRound->forceFill(['winner_player_id' => $player->id])->save();
        }

        $entry = DrawAndGuessRules::finderEntry($lockedRound, $guess);

        (new GameWordFound($lockedRoom, ['roundId' => $lockedRound->id, ...$entry]))->sendToOthers();

        $everyoneFound = $lockedRound->guesses()->where('is_correct', true)->count() >= (int) $lockedRound->guessers_total;

        return [
            'result' => GuessResult::Correct->value,
            'guessId' => $guess->id,
            'ended' => $everyoneFound ? $this->endGameRound->handle($lockedRoom, $lockedRound, GameRoundOutcome::Guessed) : null,
            'found' => $entry,
            'word' => (string) $lockedRound->word,
        ];
    }
}
