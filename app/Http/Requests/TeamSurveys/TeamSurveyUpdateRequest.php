<?php

namespace App\Http\Requests\TeamSurveys;

use Illuminate\Foundation\Http\FormRequest;

class TeamSurveyUpdateRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'guest_access_enabled' => ['sometimes', 'boolean'],
            'one_question_at_a_time' => ['sometimes', 'boolean'],
            'show_results_after_answer' => ['sometimes', 'boolean'],
        ];
    }
}
