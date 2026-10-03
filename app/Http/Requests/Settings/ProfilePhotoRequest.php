<?php

namespace App\Http\Requests\Settings;

use App\Support\InstanceSettings;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ProfilePhotoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return resolve(InstanceSettings::class)->profilePhotos();
    }

    /**
     * @return array<string, array<int, ValidationRule|string>>
     */
    public function rules(): array
    {
        return [
            'photo' => ['required', 'file', 'max:1024', 'mimetypes:image/jpeg,image/png', 'dimensions:max_width=4096,max_height=4096'],
        ];
    }
}
