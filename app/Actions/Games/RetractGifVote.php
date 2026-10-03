<?php

namespace App\Actions\Games;

use App\Events\Games\GameVoteChanged;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Withdraws the vote for one GIF, or every vote of the player without one.
 * "Not voted" is broadcast only when the player has no vote left.
 */
class RetractGifVote
{
    public function handle(GameRoom $room, GameRound $round, GamePlayer $voter, ?string $answerId = null): void
    {
        CastGifVote::guard($room, $round);

        DB::transaction(function () use ($room, $round, $voter, $answerId): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            CastGifVote::guard($lockedRoom, $lockedRound);

            $removed = GameGifVote::query()
                ->where('game_round_id', $lockedRound->id)
                ->where('voter_player_id', $voter->id)
                ->when($answerId !== null, fn (Builder $votes) => $votes->where('answer_id', $answerId))
                ->delete();

            if ($removed === 0) {
                return;
            }

            $hasVotesLeft = GameGifVote::query()
                ->where('game_round_id', $lockedRound->id)
                ->where('voter_player_id', $voter->id)
                ->exists();

            if (! $hasVotesLeft) {
                (new GameVoteChanged($lockedRoom, $lockedRound->id, $voter->id, false))->sendToOthers();
            }
        });
    }
}
