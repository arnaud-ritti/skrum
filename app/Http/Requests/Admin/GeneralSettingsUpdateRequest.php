<?php

namespace App\Http\Requests\Admin;

use App\Enums\ConfigurationFieldKind;
use App\Enums\SignupMode;
use App\Support\InstanceSettings;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class GeneralSettingsUpdateRequest extends FormRequest
{
    public const int MaxAllowedEmailDomains = 20;

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
            'allowed_email_domains.*' => ['string', 'max:253', 'regex:'.ConfigurationFieldKind::HostNamePattern],
            'maintenance_message' => ['sometimes', 'nullable', 'string', 'max:'.InstanceSettings::MaintenanceMessageMaxLength],
            'update_check_enabled' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * The rule above sees only a submitted list: a form that leaves the list out keeps the stored
     * one, and domain mode with neither a stored nor a configured domain would let nobody sign up.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                if ($this->input('signup_mode') !== SignupMode::Domain->value) {
                    return;
                }

                if ($this->has('allowed_email_domains')) {
                    return;
                }

                if ((resolve(InstanceSettings::class)->allowedEmailDomains() ?? []) !== []) {
                    return;
                }

                if (config('skrum.allowed_email_domains') !== []) {
                    return;
                }

                $validator->addFailure('allowed_email_domains', 'required');
            },
        ];
    }
}
