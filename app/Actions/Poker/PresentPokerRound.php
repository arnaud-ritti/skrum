<?php

namespace App\Actions\Poker;

use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerVote;

/**
 * The only place that turns votes into payloads: before reveal a player
 * sees their own value only, whoever they are (facilitator included).
 */
class PresentPokerRound
{
    /**
     * @return array{
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
                    'value' => $isRevealed || $vote->poker_player_id === $viewerPlayerId ? $vote->value : null,
                ])->all()
                : [],
            'myVote' => $myVote?->value,
            'result' => $isRevealed ? PokerResult::for($round, $game) : null,
        ];
    }
}
