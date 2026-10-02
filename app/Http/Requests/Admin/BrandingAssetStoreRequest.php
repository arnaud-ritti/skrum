<?php

namespace App\Http\Requests\Admin;

use App\Support\Branding\BrandAssets;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class BrandingAssetStoreRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:'.intdiv(BrandAssets::MaxBytes, 1024)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.max' => __('The image must not be larger than 512 KB.'),
        ];
    }
}
