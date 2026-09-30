<?php

namespace App\Actions\Games;

use App\Events\Games\GameVoteChanged;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;

class RetractGifVote
{
    public function handle(GameRoom $room, GameRound $round, GamePlayer $voter): void
    {
        CastGifVote::guard($room, $round);

        DB::transaction(function () use ($room, $round, $voter): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            CastGifVote::guard($lockedRoom, $lockedRound);

            $removed = GameGifVote::query()
                ->where('game_round_id', $lockedRound->id)
                ->where('voter_player_id', $voter->id)
                ->delete();

            if ($removed > 0) {
                (new GameVoteChanged($lockedRoom, $lockedRound->id, $voter->id, false))->sendToOthers();
            }
        });
    }
}
