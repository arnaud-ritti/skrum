<?php

namespace App\Http\Requests\Settings;

use App\Concerns\PasswordValidationRules;
use App\Support\Auth\PasswordConfirmation;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class PasswordUpdateRequest extends FormRequest
{
    use PasswordValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        if ($this->user()->password_set_at === null) {
            return ['password' => $this->passwordRules([$this->user()->email, $this->user()->name])];
        }

        return [
            'current_password' => $this->currentPasswordRules(),
            'password' => $this->passwordRules([$this->user()->email, $this->user()->name]),
        ];
    }

    /**
     * A first password would confirm every action after it: it is set
     * behind the same confirmation as they are.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->user()->password_set_at !== null) {
                    return;
                }

                if (resolve(PasswordConfirmation::class)->isSatisfied($this)) {
                    return;
                }

                $validator->errors()->add('password', __('Confirm with the code sent by email first.'));
            },
        ];
    }
}
