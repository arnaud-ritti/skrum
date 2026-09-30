<?php

namespace App\Actions\Poker;

use App\Contracts\PokerPresenceRoster;
use App\Enums\PokerRevealReason;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AutoRevealPokerRound
{
    public function __construct(
        private PokerPresenceRoster $roster,
        private RevealPokerRound $revealPokerRound,
    ) {}

    public function handle(PokerRound $round): bool
    {
        $gameId = PokerTask::query()->whereKey($round->poker_task_id)->value('poker_game_id');
        $game = PokerGame::query()->whereKey($gameId)->first();

        if ($game === null || ! $game->auto_reveal || $game->isEnded()) {
            return false;
        }

        $onlinePlayerIds = $this->roster->playerIds($game);

        return DB::transaction(function () use ($game, $round, $onlinePlayerIds): bool {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $lockedRound = PokerRound::query()->whereKey($round->id)->lockForUpdate()->first();

            if ($lockedRound === null || ! $this->isOpenForAutoReveal($locked, $lockedRound)) {
                return false;
            }

            /** @var array<int, string> $voterIds */
            $voterIds = $lockedRound->votes()->pluck('poker_player_id')->all();

            if ($voterIds === []) {
                return false;
            }

            $reason = $this->reason($locked, $lockedRound, $voterIds, $onlinePlayerIds);

            if ($reason === null) {
                return false;
            }

            $this->revealPokerRound->handle($locked, $lockedRound, $reason);

            return true;
        });
    }

    private function isOpenForAutoReveal(PokerGame $locked, PokerRound $lockedRound): bool
    {
        if ($locked->isEnded() || ! $locked->auto_reveal || $lockedRound->isRevealed()) {
            return false;
        }

        return $locked->latestRoundOfCurrentTask()?->id === $lockedRound->id;
    }

    /**
     * @param  array<int, string>  $voterIds
     * @param  array<int, string>|null  $onlinePlayerIds
     */
    private function reason(PokerGame $locked, PokerRound $lockedRound, array $voterIds, ?array $onlinePlayerIds): ?PokerRevealReason
    {
        if ($onlinePlayerIds !== null && $this->everyoneVoted($locked, $voterIds, $onlinePlayerIds)) {
            return PokerRevealReason::EveryoneVoted;
        }

        if ($lockedRound->timer_ends_at !== null && $lockedRound->timer_ends_at->lte(now())) {
            return PokerRevealReason::Timer;
        }

        return null;
    }

    /**
     * Roster ids are only trusted once matched against this game's playing
     * (non-spectator) players, so foreign or stale ids never count.
     *
     * @param  array<int, string>  $voterIds
     * @param  array<int, string>  $onlinePlayerIds
     */
    private function everyoneVoted(PokerGame $locked, array $voterIds, array $onlinePlayerIds): bool
    {
        $candidateIds = array_values(array_unique(array_filter($onlinePlayerIds, fn (string $id): bool => Str::isUuid($id))));

        if ($candidateIds === []) {
            return false;
        }

        $expected = $locked->players()
            ->where('is_spectator', false)
            ->whereIn('id', $candidateIds)
            ->pluck('id');

        if ($expected->isEmpty()) {
            return false;
        }

        return $expected->diff($voterIds)->isEmpty();
    }
}
