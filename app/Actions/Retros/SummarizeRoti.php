<?php

namespace App\Actions\Retros;

use App\Models\Retro;

class SummarizeRoti
{
    /**
     * @return array{
     *     distribution: array<int, array{score: int, count: int}>,
     *     average: ?float,
     *     respondents: int
     * }
     */
    public function handle(Retro $retro): array
    {
        $totals = $retro->rotiVotes()
            ->selectRaw('score, count(*) as total')
            ->groupBy('score')
            ->pluck('total', 'score')
            ->mapWithKeys(fn (mixed $total, int|string $score): array => [(int) $score => (int) $total]);

        $respondents = (int) $totals->sum();
        $weighted = $totals->map(fn (int $total, int $score): int => $score * $total)->sum();

        return [
            'distribution' => collect(range(1, 5))
                ->map(fn (int $score): array => ['score' => $score, 'count' => $totals->get($score, 0)])
                ->all(),
            'average' => $respondents === 0 ? null : round($weighted / $respondents, 1),
            'respondents' => $respondents,
        ];
    }
}
