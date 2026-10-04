<?php

namespace App\Actions\Auth;

use App\Actions\Onboarding\JoinDefaultWorkspace;
use App\Actions\Workspaces\AcceptWorkspaceInvitation;
use App\Enums\SsoProvider;
use App\Exceptions\InvitationUnavailable;
use App\Exceptions\SocialAccountRefused;
use App\Exceptions\SsoLoginRefused;
use App\Models\SocialAccount;
use App\Models\TeamInviteLink;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Socialite\AbstractUser;

class ResolveSsoUser
{
    public function __construct(
        private SignupGate $signupGate,
        private AcceptWorkspaceInvitation $acceptInvitation,
        private JoinDefaultWorkspace $joinDefaultWorkspace,
        private LinkSocialAccount $linkSocialAccount,
    ) {}

    /**
     * @throws SsoLoginRefused
     * @throws InvitationUnavailable when the invitation stopped being pending between the check and the acceptance
     */
    public function handle(SsoProvider $provider, AbstractUser $ssoUser, ?WorkspaceInvitation $invitation, ?TeamInviteLink $link = null): User
    {
        $providerUserId = (string) $ssoUser->getId();

        if ($providerUserId === '') {
            throw SsoLoginRefused::providerFailed($provider);
        }

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
        $matchingUsers = User::query()->whereAddress($email)->limit(2)->get();

        if ($matchingUsers->count() > 1) {
            throw SsoLoginRefused::emailAlreadyUsed();
        }

        $existingUser = $matchingUsers->first();

        if ($existingUser !== null && ($verifiedEmail === null || $existingUser->email_verified_at === null)) {
            throw SsoLoginRefused::emailAlreadyUsed();
        }

        if ($existingUser?->isDeactivated() === true) {
            throw SsoLoginRefused::accountDeactivated();
        }

        if ($existingUser !== null) {
            return $this->link($existingUser, $provider, $providerUserId);
        }

        if ($verifiedEmail === null) {
            throw SsoLoginRefused::emailNotVerified($provider);
        }

        $isInvited = $invitation?->isPending() && $invitation->matchesEmail($email);

        if (! $this->signupGate->allows($email, $invitation, $link)) {
            throw SsoLoginRefused::signupsRestricted();
        }

        return $this->createUser($provider, $ssoUser, $providerUserId, $email, $isInvited ? $invitation : null, $link);
    }

    /**
     * @throws SsoLoginRefused
     */
    private function link(User $user, SsoProvider $provider, string $providerUserId): User
    {
        try {
            $this->linkSocialAccount->handle($user, $provider, $providerUserId);
        } catch (SocialAccountRefused $exception) {
            throw new SsoLoginRefused($exception->getMessage(), $exception->getCode(), previous: $exception);
        }

        return $user;
    }

    private function createUser(
        SsoProvider $provider,
        AbstractUser $ssoUser,
        string $providerUserId,
        string $email,
        ?WorkspaceInvitation $invitation,
        ?TeamInviteLink $link,
    ): User {
        return DB::transaction(function () use ($provider, $ssoUser, $providerUserId, $email, $invitation, $link): User {
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

            if ($invitation === null && $link?->isUsable() !== true) {
                $this->joinDefaultWorkspace->handle($user);
            }

            return $user;
        });
    }

    private function displayName(AbstractUser $ssoUser, string $email): string
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
