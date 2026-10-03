<?php

namespace App\Http\Requests\TeamSurveys;

use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurveyQuestion;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TeamSurveyQuestionRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $kind = TeamSurveyQuestionKind::tryFrom((string) $this->input('kind'));
        $isChoice = $kind?->isChoice() ?? false;
        $isScale = $kind === TeamSurveyQuestionKind::Scale;
        $isNumeric = $kind?->isNumeric() ?? false;

        return [
            'kind' => ['required', Rule::enum(TeamSurveyQuestionKind::class)],
            'label' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_required' => ['sometimes', 'boolean'],
            'allows_comment' => ['sometimes', 'boolean', Rule::prohibitedIf(! $isNumeric && $this->boolean('allows_comment'))],
            'scale_min_label' => ['nullable', 'string', 'max:60', Rule::prohibitedIf(! $isScale)],
            'scale_max_label' => ['nullable', 'string', 'max:60', Rule::prohibitedIf(! $isScale)],
            'options' => $isChoice
                ? ['required', 'array', 'min:'.TeamSurveyQuestion::MinOptions, 'max:'.TeamSurveyQuestion::MaxOptions]
                : ['prohibited'],
            'options.*' => ['required', 'string', 'max:100'],
        ];
    }

    /**
     * @return array{
     *     kind: TeamSurveyQuestionKind,
     *     label: string,
     *     description: ?string,
     *     is_required: bool,
     *     allows_comment: bool,
     *     scale_max: ?int,
     *     scale_min_label: ?string,
     *     scale_max_label: ?string
     * }
     */
    public function attributesForQuestion(): array
    {
        $kind = TeamSurveyQuestionKind::from((string) $this->validated('kind'));
        $isScale = $kind === TeamSurveyQuestionKind::Scale;

        return [
            'kind' => $kind,
            'label' => (string) $this->validated('label'),
            'description' => $this->validated('description'),
            'is_required' => $this->boolean('is_required'),
            'allows_comment' => $kind->isNumeric() && $this->boolean('allows_comment'),
            'scale_max' => $isScale ? TeamSurveyQuestion::BuilderScaleMax : null,
            'scale_min_label' => $isScale ? $this->validated('scale_min_label') : null,
            'scale_max_label' => $isScale ? $this->validated('scale_max_label') : null,
        ];
    }

    /**
     * @return array<int, string>
     */
    public function optionLabels(): array
    {
        return array_values(array_map(strval(...), $this->validated('options') ?? []));
    }
}
