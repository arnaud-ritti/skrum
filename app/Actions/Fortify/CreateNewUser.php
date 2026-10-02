<?php

namespace App\Actions\Fortify;

use App\Actions\Auth\SignupGate;
use App\Actions\Workspaces\AcceptWorkspaceInvitation;
use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Support\Auth\SignInPolicy;
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

        if (! resolve(SignInPolicy::class)->allowsLocalCredentials()) {
            throw ValidationException::withMessages([
                'email' => __('This instance requires single sign-on.'),
            ]);
        }

        $invitation = WorkspaceInvitation::findByToken(request()->session()->get('invitation_token'));

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
