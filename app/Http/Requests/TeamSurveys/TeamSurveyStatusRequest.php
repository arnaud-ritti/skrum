<?php

namespace App\Http\Requests\TeamSurveys;

use App\Enums\TeamSurveyStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TeamSurveyStatusRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::enum(TeamSurveyStatus::class)],
        ];
    }
}
