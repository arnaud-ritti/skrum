<?php

namespace App\Http\Requests\Admin;

use App\Support\InstanceSettings;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class BrandingPreviewRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'color' => ['required', 'string', 'regex:/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/D'],
            'radius' => ['nullable', 'integer', 'between:'.InstanceSettings::MinRadius.','.InstanceSettings::MaxRadius],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'color.regex' => __('Enter the colour as a 3- or 6-digit hex value, such as #2b63b0.'),
        ];
    }
}
