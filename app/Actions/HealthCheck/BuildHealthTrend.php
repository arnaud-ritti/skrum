<?php

namespace App\Actions\HealthCheck;

use App\Enums\RetroPhase;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroHealthStatement;
use Illuminate\Support\Collection;
use stdClass;

class BuildHealthTrend
{
    private const Points = 6;

    /**
     * Guests of one retro must not see the team's other retros.
     *
     * @return array<int, array{retroId: string, title: string, completedAt: string, score: float, url: string, delta: ?float, sameStatements: bool}>|null
     */
    public function forViewer(Retro $retro, Participant $viewer): ?array
    {
        if ($viewer->isGuest()) {
            return null;
        }

        return $this->handle($retro);
    }

    /**
     * @return array<int, array{retroId: string, title: string, completedAt: string, score: float, url: string, delta: ?float, sameStatements: bool}>
     */
    public function handle(Retro $retro): array
    {
        $retros = Retro::query()
            ->where('team_id', $retro->team_id)
            ->where('phase', RetroPhase::Completed)
            ->where('health_check_enabled', true)
            ->whereNotNull('completed_at')
            ->when($retro->completed_at, fn ($query, $completedAt) => $query->where('completed_at', '<=', $completedAt))
            ->whereHas('healthCheckAnswers')
            ->orderByDesc('completed_at')
            ->limit(self::Points)
            ->get(['id', 'title', 'completed_at'])
            ->reverse()
            ->values();

        $retroIds = $retros->pluck('id');

        $keysByRetro = RetroHealthStatement::query()
            ->whereIn('retro_id', $retroIds)
            ->get(['retro_id', 'key'])
            ->groupBy('retro_id')
            ->map(fn (Collection $statements) => $statements->pluck('key')->sort()->values()->all());

        $meansByRetro = HealthCheckAnswer::query()
            ->toBase()
            ->whereIn('retro_id', $retroIds)
            ->selectRaw('retro_id, statement, sum(score) as total, count(*) as answers')
            ->groupBy('retro_id', 'statement')
            ->get()
            ->groupBy('retro_id');

        $points = [];
        $previous = null;

        foreach ($retros as $point) {
            $keys = $keysByRetro->get($point->id, []);

            $averages = collect($meansByRetro->get($point->id, []))
                ->filter(fn (stdClass $row) => in_array($row->statement, $keys, true))
                ->map(fn (stdClass $row) => round((float) $row->total / (int) $row->answers, 1))
                ->values()
                ->all();

            $score = SummarizeHealthCheck::scoreOf($averages);

            if ($score === null) {
                continue;
            }

            $points[] = [
                'retroId' => $point->id,
                'title' => $point->title,
                'completedAt' => $point->completed_at->toIso8601String(),
                'score' => $score,
                'url' => route('retros.show', $point->id),
                'delta' => $previous === null ? null : round($score - $previous['score'], 1),
                'sameStatements' => $previous === null || $previous['keys'] === $keys,
            ];

            $previous = ['score' => $score, 'keys' => $keys];
        }

        return $points;
    }
}
