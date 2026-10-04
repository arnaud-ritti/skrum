<?php

namespace App\Http\Requests\Onboarding;

use App\Enums\ColumnColor;
use App\Rules\TeamSlugRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class OnboardingTeamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $onboarding = $this->user()?->onboarding;

        return [
            'name' => ['required', 'string', 'max:100'],
            'color' => ['nullable', Rule::enum(ColumnColor::class)],
            'description' => ['nullable', 'string', 'max:200'],
            'slug' => ['nullable', ...TeamSlugRule::rules($onboarding?->workspace, $onboarding?->team_id)],
        ];
    }
}
