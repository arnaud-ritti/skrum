<?php

namespace App\Actions\HealthCheck;

use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroHealthStatement;
use Illuminate\Support\Collection;

class SummarizeHealthCheck
{
    /** The largest population standard deviation on a 1–10 scale. */
    private const float MaximumSpread = 4.5;

    public function __construct(private PresentHealthStatement $presentHealthStatement) {}

    /**
     * The previous averages come from another retro of the team, which a guest of this one must not see.
     *
     * @return array{
     *     statements: array<int, array{key: string, label: string, text: string, isBuiltin: bool, average: ?float, count: int, consensus: ?float, previousAverage: ?float}>,
     *     score: float,
     *     participation: array{respondents: int, participants: int},
     *     topStrength: ?array{key: string, label: string, average: float},
     *     growthArea: ?array{key: string, label: string, average: float},
     *     alignment: array{value: int, level: string, label: string},
     *     assessment: array{band: string, title: string, sentence: string}
     * }|null
     */
    public function handle(Retro $retro, ?Participant $viewer = null): ?array
    {
        if (! $retro->health_check_enabled) {
            return null;
        }

        $totals = $retro->healthCheckAnswers()
            ->toBase()
            ->selectRaw('statement, count(*) as answers, sum(score) as total, sum(score * score) as squares')
            ->groupBy('statement')
            ->get()
            ->keyBy('statement');

        $previousAverages = $viewer?->isGuest() ? [] : $this->previousAverages($retro);

        $statements = $retro->healthStatements()->get()->map(function (RetroHealthStatement $statement) use ($totals, $previousAverages): array {
            $row = $totals->get($statement->key);
            $count = (int) ($row->answers ?? 0);
            $mean = $count === 0 ? null : (float) $row->total / $count;

            return [
                ...$this->presentHealthStatement->handle($statement),
                'average' => $mean === null ? null : round($mean, 1),
                'count' => $count,
                'consensus' => $mean === null ? null : $this->consensus((float) $row->squares / $count - $mean ** 2),
                'previousAverage' => $previousAverages[$statement->key] ?? null,
            ];
        });

        $reported = $statements->whereNotNull('average')->values();

        if ($reported->isEmpty()) {
            return null;
        }

        $score = (float) self::scoreOf($reported->pluck('average')->all());
        [$topStrength, $growthArea] = $this->extremes($reported);

        return [
            'statements' => $statements->map(fn (array $statement): array => [
                'key' => $statement['key'],
                'label' => $statement['label'],
                'text' => $statement['text'],
                'isBuiltin' => $statement['isBuiltin'],
                'average' => $statement['average'],
                'count' => $statement['count'],
                'consensus' => $statement['consensus'],
                'previousAverage' => $statement['previousAverage'],
            ])->values()->all(),
            'score' => $score,
            'participation' => [
                'respondents' => $retro->healthCheckAnswers()->distinct()->count('participant_id'),
                'participants' => $retro->participants()->count(),
            ],
            'topStrength' => $topStrength,
            'growthArea' => $growthArea,
            'alignment' => $this->alignment((int) round((float) $reported->avg('consensus'))),
            'assessment' => $this->assessment($score),
        ];
    }

    /**
     * @return array<string, float>
     */
    private function previousAverages(Retro $retro): array
    {
        if ($retro->completed_at === null) {
            return [];
        }

        $previous = Retro::query()
            ->where('team_id', $retro->team_id)
            ->whereKeyNot($retro->id)
            ->where('health_check_enabled', true)
            ->where('completed_at', '<', $retro->completed_at)
            ->whereHas('healthCheckAnswers')
            ->orderByDesc('completed_at')
            ->first(['id']);

        if ($previous === null) {
            return [];
        }

        return $previous->healthCheckAnswers()
            ->toBase()
            ->selectRaw('statement, avg(score) as mean')
            ->groupBy('statement')
            ->pluck('mean', 'statement')
            ->map(fn (mixed $mean): float => round((float) $mean, 1))
            ->all();
    }

    /**
     * @param  array<int, float>  $averages  one-decimal statement averages
     */
    public static function scoreOf(array $averages): ?float
    {
        if ($averages === []) {
            return null;
        }

        return round(array_sum($averages) / count($averages), 1);
    }

    private function consensus(float $variance): float
    {
        $spread = sqrt(max(0.0, $variance));

        return max(0.0, min(10.0, 10 * (1 - $spread / self::MaximumSpread)));
    }

    /**
     * @param  Collection<int, array{key: string, label: string, text: string, isBuiltin: bool, average: ?float, count: int, consensus: ?float, previousAverage: ?float}>  $reported
     * @return array{
     *     0: ?array{key: string, label: string, average: float},
     *     1: ?array{key: string, label: string, average: float}
     * }
     */
    private function extremes(Collection $reported): array
    {
        if ($reported->count() < 2) {
            return [null, null];
        }

        $averages = $reported->pluck('average');

        if ($averages->unique()->count() === 1) {
            return [null, null];
        }

        $highest = $reported->first(fn (array $statement): bool => $statement['average'] === $averages->max());
        $lowest = $reported->first(fn (array $statement): bool => $statement['average'] === $averages->min());

        return [$this->extreme($highest), $this->extreme($lowest)];
    }

    /**
     * @param  array{key: string, label: string, average: ?float}  $statement
     * @return array{key: string, label: string, average: float}
     */
    private function extreme(array $statement): array
    {
        return ['key' => $statement['key'], 'label' => $statement['label'], 'average' => (float) $statement['average']];
    }

    /**
     * @return array{value: int, level: string, label: string}
     */
    private function alignment(int $value): array
    {
        return match (true) {
            $value >= 8 => ['value' => $value, 'level' => 'high', 'label' => __('High team consensus')],
            $value >= 5 => ['value' => $value, 'level' => 'moderate', 'label' => __('Moderate consensus')],
            default => ['value' => $value, 'level' => 'divided', 'label' => __('Divided opinions')],
        };
    }

    /**
     * @return array{band: string, title: string, sentence: string}
     */
    private function assessment(float $score): array
    {
        return match (true) {
            $score >= 8 => ['band' => 'excellent', 'title' => __('Excellent'), 'sentence' => __('The team is thriving. Keep doing what works.')],
            $score >= 6 => ['band' => 'good', 'title' => __('Good'), 'sentence' => __('Most health scores are above average. Keep the momentum going.')],
            $score >= 4 => ['band' => 'needs_attention', 'title' => __('Needs attention'), 'sentence' => __('Several areas need attention. Pick one to improve next.')],
            default => ['band' => 'critical', 'title' => __('Critical'), 'sentence' => __('The team is struggling. Talk about what would help most.')],
        };
    }
}
