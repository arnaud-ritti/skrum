<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyQuestion;
use App\Support\Alphabetical;
use App\Support\Surveys\HealthScale;
use Illuminate\Support\Collection;

class CompareSurveys
{
    public function __construct(private BuildSurveyResults $buildSurveyResults) {}

    public function defaultFor(TeamSurvey $survey): ?TeamSurvey
    {
        if (! $survey->isHealthCheck()) {
            return $survey->previous()->where('status', TeamSurveyStatus::Closed)->first();
        }

        return TeamSurvey::query()
            ->where('team_id', $survey->team_id)
            ->whereKeyNot($survey->id)
            ->where('template', TeamSurveyTemplate::HealthCheck)
            ->where('status', TeamSurveyStatus::Closed)
            ->where('closed_at', '<', $survey->closed_at ?? now())
            ->orderByDesc('closed_at')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * @return array<string, mixed>
     */
    public function handle(TeamSurvey $current, TeamSurvey $other): array
    {
        $header = [
            'other' => ['id' => $other->id, 'title' => $other->title, 'closedAt' => $other->closed_at?->toIso8601String()],
            'belowThreshold' => false,
            'pairs' => [],
            'onlyHere' => [],
            'onlyThere' => [],
        ];

        if ($this->isBelowThreshold($other)) {
            return [...$header, 'belowThreshold' => true];
        }

        if ($this->isBelowThreshold($current)) {
            return [...$header, 'belowThreshold' => true];
        }

        $currentQuestions = $current->questions()->with('options')->get();
        $otherQuestions = $other->questions()->with('options')->get();
        $currentSummaries = $this->buildSurveyResults->summaries($current);
        $otherSummaries = $this->buildSurveyResults->summaries($other);
        $matches = $this->matches($currentQuestions, $otherQuestions);
        $pairs = [];
        $onlyHere = [];

        foreach ($currentQuestions as $question) {
            $match = $matches[$question->id] ?? null;

            if ($match === null) {
                $onlyHere[] = $this->lone($question);

                continue;
            }

            $pairs[] = $this->pair($question, $match, $currentSummaries[$question->id], $otherSummaries[$match->id]);
        }

        $taken = array_map(fn (TeamSurveyQuestion $match): string => $match->id, array_values($matches));

        return [
            ...$header,
            'pairs' => $pairs,
            'onlyHere' => $onlyHere,
            'onlyThere' => $otherQuestions
                ->reject(fn (TeamSurveyQuestion $question): bool => in_array($question->id, $taken, true))
                ->map(fn (TeamSurveyQuestion $question): array => $this->lone($question))
                ->values()
                ->all(),
        ];
    }

    private function isBelowThreshold(TeamSurvey $survey): bool
    {
        return $survey->responseCount() < $survey->results_threshold;
    }

    /**
     * Every key is paired before any label, so that a label never takes the
     * question another one would have matched by key (spec §6.6).
     *
     * @param  Collection<int, TeamSurveyQuestion>  $currentQuestions
     * @param  Collection<int, TeamSurveyQuestion>  $otherQuestions
     * @return array<string, TeamSurveyQuestion>
     */
    private function matches(Collection $currentQuestions, Collection $otherQuestions): array
    {
        $matches = [];
        $candidates = $otherQuestions->keyBy('id');

        foreach ($currentQuestions as $question) {
            $byKey = $candidates->first(fn (TeamSurveyQuestion $candidate): bool => $question->match_key !== null
                && $candidate->match_key === $question->match_key
                && $candidate->kind === $question->kind);

            if ($byKey === null) {
                continue;
            }

            $matches[$question->id] = $byKey;
            $candidates->forget($byKey->id);
        }

        foreach ($currentQuestions as $question) {
            if (isset($matches[$question->id])) {
                continue;
            }

            $byLabel = $candidates->first(fn (TeamSurveyQuestion $candidate): bool => $candidate->kind === $question->kind
                && $this->normalised($candidate->label) === $this->normalised($question->label));

            if ($byLabel === null) {
                continue;
            }

            $matches[$question->id] = $byLabel;
            $candidates->forget($byLabel->id);
        }

        return $matches;
    }

    private function normalised(string $label): string
    {
        return Alphabetical::key(trim($label));
    }

    /**
     * @return array{questionId: string, label: string, kind: string}
     */
    private function lone(TeamSurveyQuestion $question): array
    {
        return ['questionId' => $question->id, 'label' => $question->displayLabel(), 'kind' => $question->kind->value];
    }

    /**
     * @param  array<string, mixed>  $current
     * @param  array<string, mixed>  $other
     * @return array<string, mixed>
     */
    private function pair(TeamSurveyQuestion $question, TeamSurveyQuestion $match, array $current, array $other): array
    {
        $values = match ($question->kind) {
            TeamSurveyQuestionKind::Scale => $this->scale($question, $match, $current, $other),
            TeamSurveyQuestionKind::Nps => [
                'current' => ['nps' => $current['nps'], 'responses' => $current['responses']],
                'other' => ['nps' => $other['nps'], 'responses' => $other['responses']],
                'delta' => $current['nps'] === null || $other['nps'] === null ? null : $current['nps'] - $other['nps'],
            ],
            TeamSurveyQuestionKind::Single, TeamSurveyQuestionKind::Multiple => $this->choice($current, $other),
            TeamSurveyQuestionKind::Text => [
                'current' => ['responses' => $current['responses']],
                'other' => ['responses' => $other['responses']],
                'delta' => $current['responses'] - $other['responses'],
            ],
        };

        return [
            'questionId' => $question->id,
            'otherQuestionId' => $match->id,
            'kind' => $question->kind->value,
            'label' => $question->displayLabel(),
            ...$values,
        ];
    }

    /**
     * @param  array<string, mixed>  $current
     * @param  array<string, mixed>  $other
     * @return array<string, mixed>
     */
    private function scale(TeamSurveyQuestion $question, TeamSurveyQuestion $match, array $current, array $other): array
    {
        $currentMean = $this->onHealthScale($current['buckets'], (int) $question->scale_max);
        $otherMean = $this->onHealthScale($other['buckets'], (int) $match->scale_max);

        return [
            'current' => ['mean' => $currentMean, 'responses' => $current['responses']],
            'other' => ['mean' => $otherMean, 'responses' => $other['responses']],
            'delta' => $currentMean === null || $otherMean === null ? null : round($currentMean - $otherMean, 1),
        ];
    }

    /**
     * Both means on five (spec §6.6, §11.9), from the raw counts of the
     * summary's buckets, so that a mean is rounded once: a builder scale of
     * five reads as it was answered, a health check of ten reads halved.
     *
     * @param  array<int, array{key: string, label: string, count: int}>  $buckets
     */
    private function onHealthScale(array $buckets, int $scaleMax): ?float
    {
        $answers = array_sum(array_column($buckets, 'count'));

        if ($answers === 0) {
            return null;
        }

        $total = array_sum(array_map(fn (array $bucket): int => (int) $bucket['key'] * $bucket['count'], $buckets));

        return HealthScale::average($total / $answers, $scaleMax);
    }

    /**
     * @param  array<string, mixed>  $current
     * @param  array<string, mixed>  $other
     * @return array<string, mixed>
     */
    private function choice(array $current, array $other): array
    {
        $currentOptions = $this->percents($current);
        $otherOptions = $this->percents($other);
        $otherByLabel = collect($otherOptions)->keyBy(fn (array $option): string => $this->normalised($option['label']));

        $delta = collect($currentOptions)
            ->filter(fn (array $option): bool => $otherByLabel->has($this->normalised($option['label'])))
            ->map(fn (array $option): array => [
                'optionId' => $option['id'],
                'label' => $option['label'],
                'delta' => $option['percent'] - $otherByLabel[$this->normalised($option['label'])]['percent'],
            ])
            ->values()
            ->all();

        return [
            'current' => ['responses' => $current['responses'], 'options' => $currentOptions],
            'other' => ['responses' => $other['responses'], 'options' => $otherOptions],
            'delta' => $delta,
        ];
    }

    /**
     * @param  array<string, mixed>  $summary
     * @return array<int, array{id: string, label: string, percent: int}>
     */
    private function percents(array $summary): array
    {
        return array_map(fn (array $option): array => [
            'id' => $option['id'],
            'label' => $option['label'],
            'percent' => $summary['responses'] === 0 ? 0 : (int) round($option['count'] / $summary['responses'] * 100),
        ], $summary['options']);
    }
}
