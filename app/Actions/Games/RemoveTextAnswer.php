<?php

namespace App\Actions\Games;

use App\Events\Games\GameAnswerChanged;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\GameTextAnswer;
use Illuminate\Support\Facades\DB;

class RemoveTextAnswer
{
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player): void
    {
        DB::transaction(function () use ($room, $round, $player): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            SetTextAnswer::guard($lockedRoom, $lockedRound);

            $removed = GameTextAnswer::query()
                ->where('game_round_id', $lockedRound->id)
                ->where('player_id', $player->id)
                ->delete();

            if ($removed > 0) {
                (new GameAnswerChanged($lockedRoom, $lockedRound->id, $player->id, false))->sendToOthers();
            }
        });
    }
}
