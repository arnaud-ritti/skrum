<?php

namespace App\Actions\HealthCheck;

use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroHealthStatement;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

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
        $scores = $this->scores($retroIds);

        $points = [];
        $previous = null;

        foreach ($retros as $point) {
            $keys = $keysByRetro->get($point->id)?->all() ?? [];
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
     * Only answers to a statement frozen on their own retro count: the relation matches the key,
     * the constraint matches the retro.
     *
     * @param  Collection<int, string>  $retroIds
     * @return Collection<string, ?float> score of each retro, null when it has no answer to a frozen statement
     */
    public function scores(Collection $retroIds): Collection
    {
        $sameRetro = fn (Builder $answers): Builder => $answers->whereColumn(
            $answers->qualifyColumn('retro_id'),
            (new RetroHealthStatement)->qualifyColumn('retro_id'),
        );

        $statementsByRetro = RetroHealthStatement::query()
            ->whereIn('retro_id', $retroIds)
            ->withCount(['answers' => $sameRetro])
            ->withSum(['answers' => $sameRetro], 'score')
            ->get()
            ->groupBy('retro_id');

        return $retroIds->mapWithKeys(function (string $retroId) use ($statementsByRetro): array {
            $averages = collect($statementsByRetro->get($retroId, []))
                ->filter(fn (RetroHealthStatement $statement): bool => (int) $statement->answers_count > 0)
                ->map(fn (RetroHealthStatement $statement): float => round((float) $statement->answers_sum_score / (int) $statement->answers_count, 1))
                ->values()
                ->all();

            return [$retroId => SummarizeHealthCheck::scoreOf($averages)];
        });
    }

    /**
     * @param  Collection<int, string>  $retroIds
     * @return Collection<string, Collection<int, string>>
     */
    private function statementKeysByRetro(Collection $retroIds): Collection
    {
        return RetroHealthStatement::query()
            ->whereIn('retro_id', $retroIds)
            ->get(['retro_id', 'key'])
            ->toBase()
            ->sortBy('key')
            ->mapToGroups(fn (RetroHealthStatement $statement): array => [$statement->retro_id => $statement->key]);
    }
}
