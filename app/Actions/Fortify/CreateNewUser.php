<?php

namespace App\Actions\Fortify;

use App\Actions\Auth\SignupGate;
use App\Actions\Workspaces\AcceptWorkspaceInvitation;
use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Support\Auth\SignInPolicy;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules;
    use ProfileValidationRules;

    /**
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            ...$this->profileRules(),
            'password' => $this->passwordRules(),
        ])->validate();

        return $this->register($input, WorkspaceInvitation::findByToken(request()->session()->get('invitation_token')));
    }

    /**
     * The account an invitation creates from its card. The address is the
     * invited one, never an input, and the invitation is locked so that it
     * creates one account only (S35).
     *
     * @param  array<string, mixed>  $input
     */
    public function createForInvitation(WorkspaceInvitation $invitation, array $input): User
    {
        $input = [
            'name' => $input['name'] ?? null,
            'email' => $invitation->email,
            'password' => $input['password'] ?? null,
        ];

        Validator::make($input, [
            ...$this->profileRules(),
            'password' => $this->unconfirmedPasswordRules(),
        ])->validate();

        try {
            return DB::transaction(function () use ($invitation, $input): User {
                $lockedInvitation = WorkspaceInvitation::query()->lockForUpdate()->find($invitation->id);

                if ($lockedInvitation?->isPending() !== true) {
                    throw ValidationException::withMessages([
                        'email' => __('This invitation link is no longer valid.'),
                    ]);
                }

                return $this->register($input, $lockedInvitation);
            });
        } catch (UniqueConstraintViolationException) {
            // Two invitations of one address, posted at the same moment, both
            // pass the validation above: the unique index refuses the second.
            throw ValidationException::withMessages([
                'email' => trans('validation.unique', ['attribute' => 'email']),
            ]);
        }
    }

    /**
     * @param  array<string, string>  $input
     */
    private function register(array $input, ?WorkspaceInvitation $invitation): User
    {
        if (! resolve(SignInPolicy::class)->allowsLocalCredentials()) {
            throw ValidationException::withMessages([
                'email' => __('This instance requires single sign-on.'),
            ]);
        }

        if (! resolve(SignupGate::class)->allows($input['email'], $invitation)) {
            throw ValidationException::withMessages([
                'email' => __('Signups are restricted on this instance.'),
            ]);
        }

        return DB::transaction(function () use ($input, $invitation): User {
            $isFirstUser = User::query()->doesntExist();

            $user = User::create([
                'name' => $input['name'],
                'email' => $input['email'],
                'password' => $input['password'],
                'locale' => app()->getLocale(),
            ]);

            $user->forceFill(['is_instance_admin' => $isFirstUser])->save();

            if ($invitation?->isPending() && $invitation->matchesEmail($user->email)) {
                $user->forceFill(['email_verified_at' => now()])->save();

                resolve(AcceptWorkspaceInvitation::class)->handle($invitation, $user);

                request()->session()->forget(['invitation_token', 'url.intended']);
            }

            return $user;
        });
    }
}
