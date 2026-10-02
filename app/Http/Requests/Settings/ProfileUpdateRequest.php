<?php

namespace App\Http\Requests\Settings;

use App\Concerns\ProfileValidationRules;
use App\Support\Avatars\AvatarStyleCatalogue;
use App\Support\InstanceSettings;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProfileUpdateRequest extends FormRequest
{
    use ProfileValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $rules = $this->profileRules($this->user()->id);

        if (! resolve(InstanceSettings::class)->avatarMemberChoice()) {
            return $rules;
        }

        return [
            ...$rules,
            'avatar_style' => ['sometimes', 'nullable', 'string', Rule::in(resolve(AvatarStyleCatalogue::class)->selectable())],
        ];
    }
}
