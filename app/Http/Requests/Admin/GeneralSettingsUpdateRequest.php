<?php

namespace App\Http\Requests\Admin;

use App\Enums\SignupMode;
use App\Support\InstanceSettings;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GeneralSettingsUpdateRequest extends FormRequest
{
    public const int MaxAllowedEmailDomains = 20;

    public const string DomainPattern = '/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i';

    /**
     * @return array<string, array<int, ValidationRule|string|object>>
     */
    public function rules(): array
    {
        return [
            'signup_mode' => ['sometimes', 'nullable', Rule::enum(SignupMode::class)],
            'allowed_email_domains' => [
                'sometimes',
                'nullable',
                'array',
                'max:'.self::MaxAllowedEmailDomains,
                Rule::requiredIf(fn (): bool => $this->input('signup_mode') === SignupMode::Domain->value && config('skrum.allowed_email_domains') === []),
            ],
            'allowed_email_domains.*' => ['string', 'max:253', 'regex:'.self::DomainPattern],
            'maintenance_message' => ['sometimes', 'nullable', 'string', 'max:'.InstanceSettings::MaintenanceMessageMaxLength],
            'update_check_enabled' => ['sometimes', 'boolean'],
        ];
    }
}
