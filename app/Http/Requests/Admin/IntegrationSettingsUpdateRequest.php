<?php

namespace App\Http\Requests\Admin;

use App\Enums\IntegrationProvider;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IntegrationSettingsUpdateRequest extends FormRequest
{
    /**
     * @return array<string, array<int, ValidationRule|string|object>>
     */
    public function rules(): array
    {
        return [
            'disabled' => ['present', 'array'],
            'disabled.*' => ['string', Rule::enum(IntegrationProvider::class)],
        ];
    }

    /** @return array<int, string> */
    public function disabled(): array
    {
        return array_values(array_unique((array) $this->validated('disabled', [])));
    }
}
