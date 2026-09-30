<?php

namespace App\Actions\Poker;

use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerVote;

/**
 * The only place that turns votes into payloads: before reveal a player
 * sees their own value only, whoever they are (facilitator included).
 *
 * @phpstan-type Round array{
 *     id: string,
 *     number: int,
 *     anonymous: bool,
 *     revealedAt: ?string,
 *     revealReason: ?string,
 *     timerEndsAt: ?string,
 *     version: int,
 *     votesCount: int,
 *     votes: array<int, array{playerId: string, value: ?string}>,
 *     myVote: ?string,
 *     result: ?array{
 *         average: ?float,
 *         distribution: array<int, array{value: string, count: int}>,
 *         mode: array<int, string>,
 *         consensus: bool,
 *         nearestCard: ?string
 *     }
 * }
 */
class PresentPokerRound
{
    /**
     * @return Round
     */
    public function handle(PokerRound $round, PokerGame $game, ?string $viewerPlayerId, bool $listUnrevealedVoters = true): array
    {
        $isRevealed = $round->isRevealed();
        $joinOrder = $game->players->pluck('id')->flip();
        $votes = $round->votes
            ->sortBy(fn (PokerVote $vote): int => (int) ($joinOrder[$vote->poker_player_id] ?? PHP_INT_MAX))
            ->values();
        $myVote = $viewerPlayerId === null ? null : $votes->firstWhere('poker_player_id', $viewerPlayerId);
        $listsVoters = $isRevealed || $listUnrevealedVoters;

        return [
            'id' => $round->id,
            'number' => $round->number,
            'anonymous' => $round->anonymous,
            'revealedAt' => $round->revealed_at?->toIso8601String(),
            'revealReason' => $round->reveal_reason?->value,
            'timerEndsAt' => $round->timer_ends_at?->toIso8601String(),
            'version' => $round->version,
            'votesCount' => $votes->count(),
            'votes' => $listsVoters
                ? $votes->map(fn (PokerVote $vote): array => [
                    'playerId' => $vote->poker_player_id,
                    'value' => $this->visibleValue($round, $vote, $viewerPlayerId),
                ])->all()
                : [],
            'myVote' => $myVote?->value,
            'result' => $isRevealed ? PokerResult::for($round, $game) : null,
        ];
    }

    /**
     * Before reveal only the viewer's own value is shown; in an anonymous
     * round that stays true forever, so values reach others only through
     * the result's distribution.
     */
    private function visibleValue(PokerRound $round, PokerVote $vote, ?string $viewerPlayerId): ?string
    {
        if ($viewerPlayerId !== null && $vote->poker_player_id === $viewerPlayerId) {
            return $vote->value;
        }

        if ($round->anonymous) {
            return null;
        }

        return $round->isRevealed() ? $vote->value : null;
    }
}
