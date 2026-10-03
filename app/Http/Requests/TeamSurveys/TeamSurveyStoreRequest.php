<?php

namespace App\Http\Requests\TeamSurveys;

use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\Team;
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
            'template' => ['sometimes', 'nullable', 'prohibits:source_survey_id', Rule::enum(TeamSurveyTemplate::class)],
            'source_survey_id' => [
                'sometimes', 'nullable', 'uuid',
                Rule::exists('team_surveys', 'id')
                    ->where('team_id', $this->team()->id)
                    ->whereNot('status', TeamSurveyStatus::Draft)
                    ->whereNull('retro_id'),
            ],
            'guest_access_enabled' => ['sometimes', 'boolean'],
        ];
    }

    private function team(): Team
    {
        /** @var Team */
        return $this->route('team');
    }
}
