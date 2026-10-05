<?php

namespace App\Actions\Fortify;

use App\Actions\Auth\RevokeLoginSecrets;
use App\Concerns\PasswordValidationRules;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\ResetsUserPasswords;

class ResetUserPassword implements ResetsUserPasswords
{
    use PasswordValidationRules;

    /**
     * Validate and reset the user's forgotten password.
     *
     * @param  array<string, string>  $input
     */
    public function reset(User $user, array $input): void
    {
        Validator::make($input, [
            'password' => $this->passwordRules([$user->email, $user->name]),
        ])->validate();

        $user->forceFill([
            'password' => $input['password'],
            'password_set_at' => now(),
        ])->save();

        resolve(RevokeLoginSecrets::class)->handle($user);
    }
}
