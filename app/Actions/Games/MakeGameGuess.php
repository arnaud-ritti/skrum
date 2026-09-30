<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\GuessResult;
use App\Events\Games\GameGuessMade;
use App\Models\GameGuess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GuessMatch;
use Illuminate\Support\Facades\DB;

class MakeGameGuess
{
    public function __construct(private EndGameRound $endGameRound) {}

    /**
     * A correct guess ends the round and is never broadcast; the others go
     * to every player without saying whether they were close.
     *
     * @return array{result: string, guessId: string, ended: ?array<string, mixed>}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, string $text): array
    {
        return DB::transaction(function () use ($room, $round, $player, $text): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::notLeader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::DrawAndGuess, GameKind::Decoded);

            $result = GuessMatch::check((string) $lockedRound->word, $text);

            /** @var GameGuess $guess */
            $guess = $lockedRound->guesses()->create([
                'player_id' => $player->id,
                'text' => $text,
                'is_near_miss' => $result === GuessResult::Near,
                'is_correct' => $result === GuessResult::Correct,
            ]);

            if ($result === GuessResult::Correct) {
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
}
