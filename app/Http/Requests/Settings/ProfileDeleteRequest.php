<?php

namespace App\Http\Requests\Settings;

use App\Concerns\PasswordValidationRules;
use App\Enums\WorkspaceRole;
use App\Models\Workspace;
use App\Support\Auth\PasswordConfirmation;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Collection;
use Illuminate\Validation\Validator;

class ProfileDeleteRequest extends FormRequest
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
            return [];
        }

        return [
            'password' => $this->currentPasswordRules(),
        ];
    }

    /** @return array<int, callable(Validator): void> */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                if ($this->user()->password_set_at === null && ! resolve(PasswordConfirmation::class)->isSatisfied($this)) {
                    $validator->errors()->add('password', __('Confirm with the code sent by email first.'));

                    return;
                }

                if ($this->soleOwnedWorkspacesWithOtherMembers()->isNotEmpty()) {
                    $validator->errors()->add(
                        'password',
                        __('Transfer ownership of your workspaces before deleting your account.'),
                    );
                }
            },
        ];
    }

    /** @return Collection<int, Workspace> */
    private function soleOwnedWorkspacesWithOtherMembers(): Collection
    {
        $user = $this->user();

        return $user->workspaces()
            ->wherePivot('role', WorkspaceRole::Owner->value)
            ->get()
            ->filter(fn (Workspace $workspace): bool => $workspace->owners()->count() === 1 && $workspace->members()->count() > 1);
    }
}
