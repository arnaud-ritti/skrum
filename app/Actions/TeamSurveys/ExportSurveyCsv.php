<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyOption;
use App\Models\TeamSurveyQuestion;
use App\Support\CsvCell;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ExportSurveyCsv
{
    /**
     * The header, then one row per respondent who answered. Rows are
     * ordered by their content so that the order tells neither when nor
     * by whom a response was given; the numbering follows that order.
     *
     * @return array<int, array<int, string>>
     */
    public function rows(TeamSurvey $survey): array
    {
        $questions = $survey->questions()->with('options')->get();

        $answersByRespondent = TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $questions->pluck('id'))
            ->with('options')
            ->get()
            ->groupBy('team_survey_respondent_id');

        $rows = $answersByRespondent
            ->map(fn (Collection $answers): array => $this->cells($questions, $answers->keyBy('team_survey_question_id')))
            ->sort(fn (array $first, array $second): int => $first <=> $second)
            ->values()
            ->map(fn (array $cells, int $index): array => [__('Respondent :number', ['number' => $index + 1]), ...$cells])
            ->all();

        return [$this->header($questions), ...$rows];
    }

    public function fileName(TeamSurvey $survey): string
    {
        $slug = Str::slug($survey->title) ?: 'survey';

        return "survey-{$slug}-".now()->format('Y-m-d').'.csv';
    }

    /**
     * @param  Collection<int, TeamSurveyQuestion>  $questions
     * @return array<int, string>
     */
    private function header(Collection $questions): array
    {
        $header = [__('Respondent')];

        foreach ($questions->values() as $index => $question) {
            $number = $index + 1;
            $header[] = "Q{$number} · {$question->displayLabel()}";

            if ($question->allows_comment) {
                $header[] = "Q{$number} · ".__('comment');
            }
        }

        return $header;
    }

    /**
     * @param  Collection<int, TeamSurveyQuestion>  $questions
     * @param  Collection<string, TeamSurveyAnswer>  $answers  keyed by question id
     * @return array<int, string>
     */
    private function cells(Collection $questions, Collection $answers): array
    {
        $cells = [];

        foreach ($questions as $question) {
            $answer = $answers->get($question->id);
            $cells[] = CsvCell::safe($this->value($question, $answer));

            if ($question->allows_comment) {
                $cells[] = CsvCell::safe((string) $answer?->comment);
            }
        }

        return $cells;
    }

    private function value(TeamSurveyQuestion $question, ?TeamSurveyAnswer $answer): string
    {
        if ($answer === null) {
            return '';
        }

        return match ($question->kind) {
            TeamSurveyQuestionKind::Scale, TeamSurveyQuestionKind::Nps => (string) $answer->value,
            TeamSurveyQuestionKind::Text => (string) $answer->text,
            TeamSurveyQuestionKind::Single, TeamSurveyQuestionKind::Multiple => $question->options
                ->filter(fn (TeamSurveyOption $option): bool => $answer->options->contains('id', $option->id))
                ->map(fn (TeamSurveyOption $option): string => $option->label)
                ->implode(' | '),
        };
    }
}
