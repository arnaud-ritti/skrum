<?php

namespace App\Http\Requests\Admin;

use App\Actions\Admin\TestOidcDiscovery;
use App\Enums\SsoProvider;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SsoConnectionTestStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manageInstance') ?? false;
    }

    /**
     * @return array<string, array<int, ValidationRule|Closure|string|object>>
     */
    public function rules(): array
    {
        return [
            'provider' => [
                'bail',
                'required',
                'string',
                Rule::enum(SsoProvider::class),
                function (string $attribute, mixed $value, Closure $fail): void {
                    $provider = SsoProvider::tryFrom((string) $value);

                    if ($provider === null) {
                        return;
                    }

                    if (! TestOidcDiscovery::isTestable($provider)) {
                        $fail(__('This provider cannot be tested.'));

                        return;
                    }

                    if (! $provider->isEnabled()) {
                        $fail(__('Configure this provider before testing it.'));
                    }
                },
            ],
        ];
    }

    public function provider(): SsoProvider
    {
        return SsoProvider::from((string) $this->validated('provider'));
    }
}
