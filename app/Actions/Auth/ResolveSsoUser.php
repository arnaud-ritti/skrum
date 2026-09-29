<?php

namespace App\Actions\Auth;

use App\Actions\Workspaces\AcceptWorkspaceInvitation;
use App\Enums\SsoProvider;
use App\Exceptions\SsoLoginRefused;
use App\Models\SocialAccount;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Socialite\Contracts\User as SocialiteUser;

class ResolveSsoUser
{
    public function __construct(
        private SignupGate $signupGate,
        private AcceptWorkspaceInvitation $acceptInvitation,
    ) {}

    public function handle(SsoProvider $provider, SocialiteUser $ssoUser, ?WorkspaceInvitation $invitation): User
    {
        $providerUserId = (string) $ssoUser->getId();

        $linkedAccount = SocialAccount::query()
            ->where('provider', $provider->value)
            ->where('provider_user_id', $providerUserId)
            ->first();

        if ($linkedAccount !== null) {
            return $linkedAccount->user;
        }

        $email = trim((string) $ssoUser->getEmail());

        if ($email === '') {
            throw SsoLoginRefused::emailMissing($provider);
        }

        $verifiedEmail = $provider->verifiedEmail($ssoUser);
        $existingUser = User::query()->whereRaw('lower(email) = ?', [Str::lower($email)])->first();

        if ($existingUser !== null && $verifiedEmail === null) {
            throw SsoLoginRefused::emailAlreadyUsed();
        }

        if ($existingUser !== null) {
            return $this->link($existingUser, $provider, $providerUserId);
        }

        $isInvited = $invitation?->isPending() && $invitation->matchesEmail($email);

        if ($verifiedEmail === null && ! $isInvited) {
            throw SsoLoginRefused::emailNotVerified($provider);
        }

        if (! $this->signupGate->allows($email, $invitation)) {
            throw SsoLoginRefused::signupsRestricted();
        }

        return $this->createUser($provider, $ssoUser, $providerUserId, $email, $isInvited ? $invitation : null);
    }

    private function link(User $user, SsoProvider $provider, string $providerUserId): User
    {
        $user->socialAccounts()->create([
            'provider' => $provider->value,
            'provider_user_id' => $providerUserId,
        ]);

        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        return $user;
    }

    private function createUser(
        SsoProvider $provider,
        SocialiteUser $ssoUser,
        string $providerUserId,
        string $email,
        ?WorkspaceInvitation $invitation,
    ): User {
        return DB::transaction(function () use ($provider, $ssoUser, $providerUserId, $email, $invitation): User {
            $isFirstUser = User::query()->doesntExist();

            $user = User::create([
                'name' => $this->displayName($ssoUser, $email),
                'email' => $email,
                'password' => Str::password(64),
                'locale' => app()->getLocale(),
            ]);

            $user->forceFill([
                'email_verified_at' => now(),
                'is_instance_admin' => $isFirstUser,
            ])->save();

            $user->socialAccounts()->create([
                'provider' => $provider->value,
                'provider_user_id' => $providerUserId,
            ]);

            if ($invitation !== null) {
                $this->acceptInvitation->handle($invitation, $user);
            }

            return $user;
        });
    }

    private function displayName(SocialiteUser $ssoUser, string $email): string
    {
        $name = trim((string) $ssoUser->getName());

        if ($name !== '') {
            return $name;
        }

        $nickname = trim((string) $ssoUser->getNickname());

        if ($nickname !== '') {
            return $nickname;
        }

        return Str::before($email, '@');
    }
}
