<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyOption;
use App\Models\TeamSurveyQuestion;

class PresentSurveyQuestion
{
    /**
     * @return array{
     *     id: string,
     *     kind: string,
     *     label: string,
     *     shortLabel: ?string,
     *     description: ?string,
     *     position: int,
     *     isRequired: bool,
     *     allowsComment: bool,
     *     scaleMax: ?int,
     *     scaleLabels: ?array{0: ?string, 1: ?string},
     *     isBuiltin: bool,
     *     options: array<int, array{id: string, label: string}>,
     *     myAnswer: ?array{value: ?int, optionIds: array<int, string>, text: ?string, comment: ?string}
     * }
     */
    public function handle(TeamSurveyQuestion $question, ?TeamSurveyAnswer $myAnswer = null): array
    {
        $question->loadMissing(['options', 'survey']);

        return [
            'id' => $question->id,
            'kind' => $question->kind->value,
            'label' => $question->displayLabel(),
            'shortLabel' => $question->displayShortLabel(),
            'description' => $question->description,
            'position' => $question->position,
            'isRequired' => $question->is_required,
            'allowsComment' => $question->allows_comment,
            'scaleMax' => $question->scale_max,
            'scaleLabels' => $this->scaleLabels($question),
            'isBuiltin' => $question->builtin !== null,
            'options' => $question->options->map(fn (TeamSurveyOption $option): array => [
                'id' => $option->id,
                'label' => $option->label,
            ])->values()->all(),
            'myAnswer' => $this->answer($myAnswer),
        ];
    }

    /**
     * @return array{value: ?int, optionIds: array<int, string>, text: ?string, comment: ?string}|null
     */
    public function answer(?TeamSurveyAnswer $answer): ?array
    {
        if ($answer === null) {
            return null;
        }

        $answer->loadMissing('options');

        /** @var array<int, string> $optionIds */
        $optionIds = $answer->options->pluck('id')->values()->all();

        return [
            'value' => $answer->value,
            'optionIds' => $optionIds,
            'text' => $answer->text,
            'comment' => $answer->comment,
        ];
    }

    /**
     * A health check's ends are the HealthCheck mockup's, translated for each
     * reader; they are not stored, so a French team reads them in French and
     * a guest in their own language.
     *
     * @return array{0: ?string, 1: ?string}|null
     */
    private function scaleLabels(TeamSurveyQuestion $question): ?array
    {
        if ($question->kind !== TeamSurveyQuestionKind::Scale) {
            return null;
        }

        if ($question->survey->isHealthCheck()) {
            return [__('Strongly disagree'), __('Strongly agree')];
        }

        return [$question->scale_min_label, $question->scale_max_label];
    }
}
