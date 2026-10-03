<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameVoteChanged;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * Up to the round's budget of votes, one per GIF; with one vote, a new vote
 * replaces it. The budget is counted under the round lock. Only "voted" is
 * broadcast: whom a player voted for stays secret until the round ends.
 */
class CastGifVote
{
    public function handle(GameRoom $room, GameRound $round, GamePlayer $voter, string $answerId): void
    {
        self::guard($room, $round);

        DB::transaction(function () use ($room, $round, $voter, $answerId): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            self::guard($lockedRoom, $lockedRound);

            $answer = GameGifAnswer::query()
                ->where('game_round_id', $lockedRound->id)
                ->whereKey($answerId)
                ->first();

            if ($answer === null) {
                throw ValidationException::withMessages(['answer_id' => __('This GIF is not part of this round.')]);
            }

            if ($answer->player_id === $voter->id) {
                throw new AuthorizationException(__('You cannot vote for your own GIF.'));
            }

            $myVotes = GameGifVote::query()
                ->where('game_round_id', $lockedRound->id)
                ->where('voter_player_id', $voter->id)
                ->get();

            if ($myVotes->contains('answer_id', $answer->id)) {
                return;
            }

            if ($lockedRound->votes_allowed > 1 && $myVotes->count() >= $lockedRound->votes_allowed) {
                throw new ConflictHttpException(__('You have used all your votes.'));
            }

            if ($lockedRound->votes_allowed <= 1) {
                GameGifVote::query()->updateOrCreate(
                    ['game_round_id' => $lockedRound->id, 'voter_player_id' => $voter->id],
                    ['answer_id' => $answer->id],
                );
            }

            if ($lockedRound->votes_allowed > 1) {
                GameGifVote::query()->create([
                    'game_round_id' => $lockedRound->id,
                    'voter_player_id' => $voter->id,
                    'answer_id' => $answer->id,
                ]);
            }

            if ($myVotes->isEmpty()) {
                (new GameVoteChanged($lockedRoom, $lockedRound->id, $voter->id, true))->sendToOthers();
            }
        });
    }

    /**
     * Votes are open between the reveal and the close.
     */
    public static function guard(GameRoom $room, GameRound $round): void
    {
        GameGuard::mutable($room);
        GameGuard::activeRound($room, $round);
        GameGuard::roundGame($round, GameKind::SprintGif);

        if ($round->revealed_at === null) {
            throw new ConflictHttpException(__('Voting has not started.'));
        }
    }
}
