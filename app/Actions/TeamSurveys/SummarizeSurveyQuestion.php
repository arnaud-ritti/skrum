<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyOption;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use App\Support\Alphabetical;
use Illuminate\Support\Collection;

class SummarizeSurveyQuestion
{
    private const int NpsMax = 10;

    private const int FirstPassive = 7;

    private const int FirstPromoter = 9;

    /**
     * Aggregates are computed in PHP: a survey holds a few dozen answers per
     * question, and no SQL expression has to be portable.
     *
     * @param  Collection<int, TeamSurveyAnswer>  $answers  the answers to this question, with their options
     * @return array<string, mixed>
     */
    public function handle(TeamSurveyQuestion $question, Collection $answers, ?TeamSurveyRespondent $viewer = null): array
    {
        $summary = ['responses' => $answers->count()];

        return match ($question->kind) {
            TeamSurveyQuestionKind::Scale => [...$summary, ...$this->scale($question, $answers), 'comments' => $this->sortedTexts($answers, 'comment', $viewer)],
            TeamSurveyQuestionKind::Nps => [...$summary, ...$this->nps($answers), 'comments' => $this->sortedTexts($answers, 'comment', $viewer)],
            TeamSurveyQuestionKind::Single, TeamSurveyQuestionKind::Multiple => [...$summary, 'options' => $this->options($question, $answers)],
            TeamSurveyQuestionKind::Text => [...$summary, 'answers' => $this->sortedTexts($answers, 'text', $viewer)],
        };
    }

    /**
     * @param  Collection<int, TeamSurveyAnswer>  $answers
     * @return array{mean: ?float, mode: ?int, buckets: array<int, array{key: string, label: string, count: int}>}
     */
    private function scale(TeamSurveyQuestion $question, Collection $answers): array
    {
        $buckets = $this->buckets($answers, 1, (int) $question->scale_max);
        $values = $answers->pluck('value')->filter(fn (?int $value): bool => $value !== null);

        return [
            'mean' => $values->isEmpty() ? null : round($values->sum() / $values->count(), 1),
            'mode' => $this->mode($buckets),
            'buckets' => $buckets,
        ];
    }

    /**
     * @param  Collection<int, TeamSurveyAnswer>  $answers
     * @return array{nps: ?int, detractors: int, passives: int, promoters: int, buckets: array<int, array{key: string, label: string, count: int}>}
     */
    private function nps(Collection $answers): array
    {
        $values = $answers->pluck('value')->filter(fn (?int $value): bool => $value !== null);
        $detractors = $values->filter(fn (int $value): bool => $value < self::FirstPassive)->count();
        $promoters = $values->filter(fn (int $value): bool => $value >= self::FirstPromoter)->count();

        return [
            'nps' => $values->isEmpty() ? null : (int) round(($promoters - $detractors) / $values->count() * 100),
            'detractors' => $detractors,
            'passives' => $values->count() - $detractors - $promoters,
            'promoters' => $promoters,
            'buckets' => $this->buckets($answers, 0, self::NpsMax),
        ];
    }

    /**
     * @param  Collection<int, TeamSurveyAnswer>  $answers
     * @return array<int, array{key: string, label: string, count: int}>
     */
    private function buckets(Collection $answers, int $from, int $to): array
    {
        $counts = $answers->countBy(fn (TeamSurveyAnswer $answer): string => (string) $answer->value);

        return array_map(fn (int $value): array => [
            'key' => (string) $value,
            'label' => (string) $value,
            'count' => (int) $counts->get((string) $value, 0),
        ], range($from, $to));
    }

    /**
     * The lowest of the most frequent values, so that a tie reads the same every time.
     *
     * @param  array<int, array{key: string, label: string, count: int}>  $buckets
     */
    private function mode(array $buckets): ?int
    {
        $counts = array_column($buckets, 'count');
        $highest = max([0, ...$counts]);

        return $highest === 0 ? null : (int) $buckets[array_search($highest, $counts, true)]['key'];
    }

    /**
     * @param  Collection<int, TeamSurveyAnswer>  $answers
     * @return array<int, array{id: string, label: string, count: int}>
     */
    private function options(TeamSurveyQuestion $question, Collection $answers): array
    {
        $counts = $answers->flatMap(fn (TeamSurveyAnswer $answer) => $answer->options->pluck('id'))->countBy();

        return $question->options->map(fn (TeamSurveyOption $option): array => [
            'id' => $option->id,
            'label' => $option->label,
            'count' => (int) $counts->get($option->id, 0),
        ])->values()->all();
    }

    /**
     * Ordered by text (`Alphabetical`, the same on the four engines, docs/database.md rule 7) so the order
     * tells neither when nor by whom an answer was written; equal texts keep the order of their random ids.
     *
     * @param  Collection<int, TeamSurveyAnswer>  $answers
     * @return array<int, array{id: string, text: string, isMine: bool}>
     */
    private function sortedTexts(Collection $answers, string $attribute, ?TeamSurveyRespondent $viewer): array
    {
        $filled = $answers
            ->filter(fn (TeamSurveyAnswer $answer): bool => trim((string) $answer->{$attribute}) !== '')
            ->sortBy('id')
            ->values();

        return Alphabetical::sort($filled, fn (TeamSurveyAnswer $answer): string => (string) $answer->{$attribute})
            ->map(fn (TeamSurveyAnswer $answer): array => [
                'id' => $answer->id,
                'text' => (string) $answer->{$attribute},
                'isMine' => $viewer !== null && $answer->team_survey_respondent_id === $viewer->id,
            ])
            ->values()
            ->all();
    }
}
