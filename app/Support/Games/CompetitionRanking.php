<?php

namespace App\Support\Games;

class CompetitionRanking
{
    /**
     * Rank 1 for the highest score; equal scores share a rank and the next
     * rank skips (1, 2, 2, 4). A missing score has no rank.
     *
     * @param  array<string, ?int>  $scores
     * @return array<string, ?int>
     */
    public static function of(array $scores): array
    {
        $known = array_filter($scores, fn (?int $score): bool => $score !== null);

        return array_map(
            fn (?int $score): ?int => $score === null
                ? null
                : 1 + count(array_filter($known, fn (int $other): bool => $other > $score)),
            $scores,
        );
    }
}
