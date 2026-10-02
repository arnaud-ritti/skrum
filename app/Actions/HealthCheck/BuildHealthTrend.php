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
    private const int Points = 6;

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
        $keysByRetro = $this->statementKeysByRetro($retroIds);
        $scores = $this->scoresWithKeys($retroIds, $keysByRetro);

        $points = [];
        $previous = null;

        foreach ($retros as $point) {
            $keys = $keysByRetro->get($point->id, []);
            $score = $scores->get($point->id);

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

    /**
     * @param  Collection<int, string>  $retroIds
     * @return Collection<string, ?float> score of each retro, null when it has no answer to a frozen statement
     */
    public function scores(Collection $retroIds): Collection
    {
        return $this->scoresWithKeys($retroIds, $this->statementKeysByRetro($retroIds));
    }

    /**
     * @param  Collection<int, string>  $retroIds
     * @return Collection<string, array<int, string>>
     */
    private function statementKeysByRetro(Collection $retroIds): Collection
    {
        return RetroHealthStatement::query()
            ->whereIn('retro_id', $retroIds)
            ->get(['retro_id', 'key'])
            ->groupBy('retro_id')
            ->map(fn (Collection $statements) => $statements->pluck('key')->sort()->values()->all());
    }

    /**
     * @param  Collection<int, string>  $retroIds
     * @param  Collection<string, array<int, string>>  $keysByRetro
     * @return Collection<string, ?float>
     */
    private function scoresWithKeys(Collection $retroIds, Collection $keysByRetro): Collection
    {
        $meansByRetro = HealthCheckAnswer::query()
            ->toBase()
            ->whereIn('retro_id', $retroIds)
            ->selectRaw('retro_id, statement, sum(score) as total, count(*) as answers')
            ->groupBy('retro_id', 'statement')
            ->get()
            ->groupBy('retro_id');

        return $retroIds->mapWithKeys(function (string $retroId) use ($keysByRetro, $meansByRetro): array {
            $keys = $keysByRetro->get($retroId, []);

            $averages = collect($meansByRetro->get($retroId, []))
                ->filter(fn (stdClass $row): bool => in_array($row->statement, $keys, true))
                ->map(fn (stdClass $row): float => round((float) $row->total / (int) $row->answers, 1))
                ->values()
                ->all();

            return [$retroId => SummarizeHealthCheck::scoreOf($averages)];
        });
    }
}
