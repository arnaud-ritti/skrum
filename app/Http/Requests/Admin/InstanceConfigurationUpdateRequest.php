<?php

namespace App\Http\Requests\Admin;

use App\Enums\InstanceSettingKey;
use App\Support\Auth\PasswordConfirmation;
use App\Support\InstanceConfiguration\ConfigurationCatalogue;
use App\Support\InstanceConfiguration\InstanceConfiguration;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * The base of the SSO, SMTP and integration-app Form Requests: rules from the catalogue and a
 * confirmation no older than five minutes (rule S2), which an account without a password does not skip.
 */
abstract class InstanceConfigurationUpdateRequest extends FormRequest
{
    abstract public function section(): InstanceSettingKey;

    public function authorize(): bool
    {
        return $this->user()?->can('manageInstance') ?? false;
    }

    /**
     * @return array<string, array<int, ValidationRule|string|object>>
     */
    public function rules(): array
    {
        $fields = resolve(ConfigurationCatalogue::class)->fields($this->section());
        $rules = [
            'clear' => ['sometimes', 'array'],
            'clear.*' => ['string', Rule::in(array_keys($fields))],
        ];

        foreach ($fields as $name => $field) {
            $rules[$name] = ['sometimes', 'nullable', ...$field->kind->rules()];
        }

        return $rules;
    }

    /** @return array<int, Closure(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (resolve(PasswordConfirmation::class)->isFresh($this, InstanceConfiguration::ConfirmationSeconds)) {
                return;
            }

            $validator->errors()->add('confirmation', __('Confirm your password again to change these settings.'));
        }];
    }

    /** @return array<string, mixed> */
    public function values(): array
    {
        return Arr::except($this->validated(), ['clear']);
    }

    /** @return array<int, string> */
    public function clear(): array
    {
        return array_values((array) $this->validated('clear', []));
    }
}
