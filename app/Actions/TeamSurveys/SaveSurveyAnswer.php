<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use Illuminate\Validation\Rule;

class SaveSurveyAnswer
{
    /**
     * A field that does not belong to the kind is prohibited, so that a
     * client built for another kind fails loudly instead of saving nothing.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(TeamSurveyQuestion $question): array
    {
        $optionOfThisQuestion = Rule::exists('team_survey_options', 'id')->where('team_survey_question_id', $question->id);
        $comment = $question->allows_comment ? ['nullable', 'string', 'max:500'] : ['prohibited'];

        $otherKinds = array_fill_keys(['value', 'optionId', 'optionIds', 'text', 'comment'], ['prohibited']);

        return [...$otherKinds, ...match ($question->kind) {
            TeamSurveyQuestionKind::Scale => [
                'value' => ['required', 'integer', 'min:1', 'max:'.(int) $question->scale_max],
                'comment' => $comment,
            ],
            TeamSurveyQuestionKind::Nps => [
                'value' => ['required', 'integer', 'min:0', 'max:10'],
                'comment' => $comment,
            ],
            TeamSurveyQuestionKind::Single => [
                'optionId' => ['required', 'uuid', $optionOfThisQuestion],
            ],
            TeamSurveyQuestionKind::Multiple => [
                'optionIds' => ['required', 'array', 'min:1'],
                'optionIds.*' => ['uuid', 'distinct', $optionOfThisQuestion],
            ],
            TeamSurveyQuestionKind::Text => [
                'text' => ['required', 'string', 'max:500'],
            ],
        }];
    }

    /**
     * Runs inside the caller's transaction, after the survey row is locked.
     *
     * @param  array<string, mixed>  $validated
     */
    public function handle(TeamSurveyQuestion $question, TeamSurveyRespondent $respondent, array $validated): TeamSurveyAnswer
    {
        $answer = TeamSurveyAnswer::query()->updateOrCreate(
            ['team_survey_question_id' => $question->id, 'team_survey_respondent_id' => $respondent->id],
            [
                'value' => $validated['value'] ?? null,
                'text' => $validated['text'] ?? null,
                'comment' => $validated['comment'] ?? null,
            ],
        );

        $answer->options()->sync($this->optionIds($question, $validated));

        return $answer->load('options');
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<int, string>
     */
    private function optionIds(TeamSurveyQuestion $question, array $validated): array
    {
        return match ($question->kind) {
            TeamSurveyQuestionKind::Single => [(string) $validated['optionId']],
            TeamSurveyQuestionKind::Multiple => array_values($validated['optionIds']),
            default => [],
        };
    }
}
