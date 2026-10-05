<?php

namespace App\Actions\HealthCheck;

use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Support\Surveys\HealthScale;
use Illuminate\Support\Collection;

class SummarizeHealthCheck
{
    public function __construct(
        private HealthCheckSurvey $healthCheckSurvey,
        private BuildHealthTrend $buildHealthTrend,
    ) {}

    /**
     * The previous averages come from another session of the team, which a guest of this one must not see.
     *
     * @return array{
     *     statements: array<int, array{key: string, label: string, text: string, isBuiltin: bool, average: ?float, count: int, consensus: ?float, previousAverage: ?float, distribution: array{int, int, int, int, int}}>,
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
        $survey = $this->healthCheckSurvey->forRetro($retro);

        if ($survey === null) {
            return null;
        }

        return $this->forSurvey($survey, $retro->participants()->count(), ! ($viewer?->isGuest() ?? false));
    }

    /**
     * Averages on the health scale (spec §11.9): each statement's mean on the
     * scale it was asked on, normalised, rounded once.
     *
     * @return array{
     *     statements: array<int, array{key: string, label: string, text: string, isBuiltin: bool, average: ?float, count: int, consensus: ?float, previousAverage: ?float, distribution: array{int, int, int, int, int}}>,
     *     score: float,
     *     participation: array{respondents: int, participants: int},
     *     topStrength: ?array{key: string, label: string, average: float},
     *     growthArea: ?array{key: string, label: string, average: float},
     *     alignment: array{value: int, level: string, label: string},
     *     assessment: array{band: string, title: string, sentence: string}
     * }|null
     */
    public function forSurvey(TeamSurvey $survey, int $participants, bool $withPrevious = true): ?array
    {
        $questions = $survey->questions()->get();

        $answers = TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $questions->pluck('id'))
            ->whereNotNull('value')
            ->get(['team_survey_question_id', 'team_survey_respondent_id', 'value']);

        $valuesByQuestion = $answers->groupBy('team_survey_question_id');
        $previousAverages = $withPrevious ? $this->previousAverages($survey) : [];

        $statements = $questions->map(function (TeamSurveyQuestion $question) use ($valuesByQuestion, $previousAverages): array {
            $scaleMax = (int) $question->scale_max;
            $values = $valuesByQuestion->get($question->id, collect())->map(fn (TeamSurveyAnswer $answer): int => (int) $answer->value)->values();
            $count = $values->count();
            $mean = $values->avg();
            $squares = $values->sum(fn (int $value): int => $value * $value);

            return [
                'key' => (string) $question->match_key,
                'label' => (string) $question->displayShortLabel(),
                'text' => $question->displayLabel(),
                'isBuiltin' => $question->builtin !== null,
                'average' => $mean === null ? null : HealthScale::average($mean, $scaleMax),
                'count' => $count,
                'consensus' => $mean === null ? null : $this->consensus($squares / $count - $mean ** 2, $scaleMax),
                'previousAverage' => $previousAverages[(string) $question->match_key] ?? null,
                'distribution' => HealthScale::distribution($values->all(), $scaleMax),
            ];
        });

        $reported = $statements->whereNotNull('average')->values();

        if ($reported->isEmpty()) {
            return null;
        }

        $score = (float) self::scoreOf($reported->pluck('average')->all());
        [$topStrength, $growthArea] = $this->extremes($reported);

        return [
            'statements' => $statements->values()->all(),
            'score' => $score,
            'participation' => [
                'respondents' => $answers->pluck('team_survey_respondent_id')->unique()->count(),
                'participants' => $participants,
            ],
            'topStrength' => $topStrength,
            'growthArea' => $growthArea,
            'alignment' => $this->alignment((int) round((float) $reported->avg('consensus'))),
            'assessment' => $this->assessment($score),
        ];
    }

    /**
     * @return array<string, float> average on the health scale by statement key, in the team's previous closed health check
     */
    private function previousAverages(TeamSurvey $survey): array
    {
        if ($survey->closed_at === null) {
            return [];
        }

        $previous = $this->buildHealthTrend->closedHealthChecks($survey->team_id)
            ->whereKeyNot($survey->id)
            ->where('closed_at', '<', $survey->closed_at)
            ->first();

        if ($previous === null) {
            return [];
        }

        $questions = $previous->questions()->get(['id', 'match_key', 'scale_max'])->keyBy('id');

        return TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $questions->keys())
            ->whereNotNull('value')
            ->get(['team_survey_question_id', 'value'])
            ->groupBy('team_survey_question_id')
            ->mapWithKeys(function (Collection $own, string $questionId) use ($questions): array {
                $question = $questions[$questionId];

                return [(string) $question->match_key => HealthScale::averageOf($own, (int) $question->scale_max)];
            })
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

    private function consensus(float $variance, int $scaleMax): float
    {
        $spread = sqrt(max(0.0, $variance));

        return max(0.0, min(10.0, 10 * (1 - $spread / HealthScale::maximumSpread($scaleMax))));
    }

    /**
     * @param  Collection<int, array{key: string, label: string, text: string, isBuiltin: bool, average: ?float, count: int<0, max>, consensus: ?float, previousAverage: ?float, distribution: array{int, int, int, int, int}}>  $reported
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
        return match (HealthScale::band($score)) {
            'excellent' => ['band' => 'excellent', 'title' => __('Excellent'), 'sentence' => __('The team is thriving. Keep doing what works.')],
            'good' => ['band' => 'good', 'title' => __('Good'), 'sentence' => __('Most health scores are above average. Keep the momentum going.')],
            'needs_attention' => ['band' => 'needs_attention', 'title' => __('Needs attention'), 'sentence' => __('Several areas need attention. Pick one to improve next.')],
            default => ['band' => 'critical', 'title' => __('Critical'), 'sentence' => __('The team is struggling. Talk about what would help most.')],
        };
    }
}
