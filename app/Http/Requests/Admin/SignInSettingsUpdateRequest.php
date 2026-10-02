<?php

namespace App\Http\Requests\Admin;

use App\Support\Auth\SignInPolicy;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SignInSettingsUpdateRequest extends FormRequest
{
    /**
     * @return array<string, array<int, ValidationRule|string>>
     */
    public function rules(): array
    {
        return [
            'sso_required' => ['required', 'boolean'],
        ];
    }

    /**
     * Single sign-on can be required only by an admin for whom it already works, and who keeps a way back.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty() || ! $this->boolean('sso_required')) {
                    return;
                }

                foreach (resolve(SignInPolicy::class)->enablingBlockers($this->user()) as $blocker) {
                    $validator->errors()->add('sso_required', match ($blocker) {
                        SignInPolicy::NoProvider => __('Configure a single sign-on provider before requiring it.'),
                        SignInPolicy::NoSecondFactor => __('Turn on a second factor for your account before requiring single sign-on: it is what lets an administrator sign in with a password if single sign-on fails.'),
                        default => __('Sign in once with single sign-on yourself before requiring it for everyone.'),
                    });
                }
            },
        ];
    }
}
