<?php

namespace App\Http\Requests\TeamSurveys;

use App\Models\TeamSurvey;
use Illuminate\Foundation\Http\FormRequest;

class TeamSurveyQuestionOrderRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'ids' => ['bail', 'required', 'array', 'max:'.TeamSurvey::MaxQuestions],
            'ids.*' => ['required', 'uuid', 'distinct'],
        ];
    }

    /**
     * @return array<int, string>
     */
    public function questionIds(): array
    {
        return array_values(array_map(strval(...), $this->validated('ids')));
    }
}
