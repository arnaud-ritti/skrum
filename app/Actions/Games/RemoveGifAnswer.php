<?php

namespace App\Actions\Games;

use App\Events\Games\GameAnswerChanged;
use App\Models\GameGifAnswer;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;

class RemoveGifAnswer
{
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player): void
    {
        SetGifAnswer::guard($room, $round);

        DB::transaction(function () use ($room, $round, $player): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            SetGifAnswer::guard($lockedRoom, $lockedRound);

            $removed = GameGifAnswer::query()
                ->where('game_round_id', $lockedRound->id)
                ->where('player_id', $player->id)
                ->delete();

            if ($removed > 0) {
                new GameAnswerChanged($lockedRoom, $lockedRound->id, $player->id, false)->sendToOthers();
            }
        });
    }
}
