<?php

namespace App\Actions\Poker;

use App\Events\Poker\PokerGameChanged;
use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Contracts\Database\Query\Builder;

class SetPokerSpectator
{
    /**
     * Must run inside the transaction that locked the game row.
     */
    public function handle(PokerGame $locked, PokerPlayer $target, bool $spectator): void
    {
        $player = PokerPlayer::query()
            ->whereKey($target->id)
            ->where('poker_game_id', $locked->id)
            ->lockForUpdate()
            ->firstOrFail();

        if ($player->is_spectator === $spectator) {
            return;
        }

        $player->update(['is_spectator' => $spectator]);

        if ($spectator) {
            $this->withdrawOpenVotes($locked, $player);
        }

        new PokerGameChanged($locked->id)->sendToOthers();
    }

    /**
     * A spectator never holds a vote: every unrevealed round loses theirs,
     * revealed rounds are history and keep it.
     */
    private function withdrawOpenVotes(PokerGame $locked, PokerPlayer $player): void
    {
        $rounds = PokerRound::query()
            ->whereIn('poker_task_id', PokerTask::query()->where('poker_game_id', $locked->id)->select('id'))
            ->whereNull('revealed_at')
            ->whereHas('votes', fn (Builder $query) => $query->where('poker_player_id', $player->id))
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($rounds as $round) {
            $round->votes()->where('poker_player_id', $player->id)->delete();
            $round->increment('version');

            new PokerVoteChanged(
                $locked->id,
                $round->id,
                $player->id,
                false,
                $round->votes()->count(),
                $round->version,
            )->sendToOthers();
        }
    }
}
