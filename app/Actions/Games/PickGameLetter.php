<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameLetterPicked;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameWord;
use App\Support\Games\HangmanRules;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class PickGameLetter
{
    public function __construct(private EndGameRound $endGameRound) {}

    /**
     * @return array{
     *     roundId: string,
     *     playerId: string,
     *     letter: string,
     *     hit: bool,
     *     mask: array<int, ?string>,
     *     misses: int,
     *     ended: ?array<string, mixed>
     * }
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, string $letter): array
    {
        return DB::transaction(function () use ($room, $round, $player, $letter): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::Hangman);

            if (in_array($letter, $lockedRound->picked_letters, true)) {
                throw new ConflictHttpException(__('This letter was already picked.'));
            }

            $word = (string) $lockedRound->word;
            $positions = GameWord::positionsOf($word, $letter);
            $hit = $positions !== [];
            $revealed = array_values(array_unique([...$lockedRound->revealed_positions, ...$positions]));

            sort($revealed);

            $lockedRound->forceFill([
                'picked_letters' => [...$lockedRound->picked_letters, $letter],
                'picked_by' => [...$lockedRound->picked_by, $player->id],
                'revealed_positions' => $revealed,
                'misses' => $lockedRound->misses + ($hit ? 0 : 1),
            ])->save();

            $payload = [
                'roundId' => $lockedRound->id,
                'playerId' => $player->id,
                'letter' => $letter,
                'hit' => $hit,
                'mask' => GameWord::mask($word, $revealed),
                'misses' => $lockedRound->misses,
            ];

            (new GameLetterPicked($lockedRoom, $payload))->sendToOthers();

            $ended = match (true) {
                GameWord::isFullyRevealed($word, $revealed) => $this->endGameRound->handle($lockedRoom, $lockedRound, GameRoundOutcome::Solved, $player),
                $lockedRound->misses >= HangmanRules::MaxMisses => $this->endGameRound->handle($lockedRoom, $lockedRound, GameRoundOutcome::Lost),
                default => null,
            };

            return [...$payload, 'ended' => $ended];
        });
    }
}
