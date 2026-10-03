<?php

namespace App\Http\Requests\TeamSurveys;

use App\Enums\TeamSurveyTemplate;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TeamSurveyStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('createSurvey', $this->route('team')) ?? false;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:120'],
            'template' => ['sometimes', 'nullable', Rule::enum(TeamSurveyTemplate::class)],
            'guest_access_enabled' => ['sometimes', 'boolean'],
        ];
    }
}
