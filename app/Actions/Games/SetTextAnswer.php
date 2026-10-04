<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameAnswerChanged;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\GameTextAnswer;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class SetTextAnswer
{
    /**
     * @return array{id: string, text: string}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, string $text): array
    {
        return DB::transaction(function () use ($room, $round, $player, $text): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            self::guard($lockedRoom, $lockedRound);

            $answer = GameTextAnswer::query()->updateOrCreate(
                ['game_round_id' => $lockedRound->id, 'player_id' => $player->id],
                ['text' => $text],
            );

            if ($answer->wasRecentlyCreated) {
                new GameAnswerChanged($lockedRoom, $lockedRound->id, $player->id, true)->sendToOthers();
            }

            return ['id' => $answer->id, 'text' => $answer->text];
        });
    }

    /**
     * Answers can change until the draw, never after.
     */
    public static function guard(GameRoom $lockedRoom, GameRound $lockedRound): void
    {
        GameGuard::mutable($lockedRoom);
        GameGuard::activeRound($lockedRoom, $lockedRound);
        GameGuard::roundGame($lockedRound, GameKind::GuessWho);

        if ($lockedRound->revealed_at !== null) {
            throw new ConflictHttpException(__('An answer has already been drawn.'));
        }
    }
}
