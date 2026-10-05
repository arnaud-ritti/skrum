<?php

namespace App\Concerns;

use App\Rules\DifferentFromIdentity;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rules\Password;

trait PasswordValidationRules
{
    /**
     * Get the validation rules used to validate passwords.
     *
     * @param  array<int, mixed>  $identity  the e-mail and the name of the account
     * @return array<int, Password|ValidationRule|array<mixed>|string>
     */
    protected function passwordRules(array $identity): array
    {
        return [...$this->unconfirmedPasswordRules($identity), 'confirmed'];
    }

    /**
     * The same password rule for a form that asks for the password once.
     *
     * @param  array<int, mixed>  $identity  the e-mail and the name of the account
     * @return array<int, Password|ValidationRule|array<mixed>|string>
     */
    protected function unconfirmedPasswordRules(array $identity): array
    {
        return ['required', 'string', Password::default(), new DifferentFromIdentity($identity)];
    }

    /**
     * Get the validation rules used to validate the current password.
     *
     * @return array<int, Password|ValidationRule|array<mixed>|string>
     */
    protected function currentPasswordRules(): array
    {
        return ['required', 'string', 'current_password'];
    }
}
