<?php

namespace App\Http\Requests\TeamSurveys;

use Illuminate\Foundation\Http\FormRequest;

class TeamSurveyQuestionOrderRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'ids' => ['required', 'array'],
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
