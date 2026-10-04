<?php

namespace App\Http\Requests\Onboarding;

use App\Enums\ColumnColor;
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
        return [
            'name' => ['required', 'string', 'max:100'],
            'color' => ['nullable', Rule::enum(ColumnColor::class)],
            'description' => ['nullable', 'string', 'max:200'],
        ];
    }
}
