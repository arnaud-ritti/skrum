<?php

namespace App\Support\Auth;

use App\Enums\SsoProvider;
use App\Models\SocialAccount;
use App\Models\User;
use App\Support\Integrations\IntegrationAvailability;
use Laravel\Fortify\Features;

/**
 * What would still sign a user in, read against the instance's rules
 * (`SignInPolicy`): the answer to "may this way in be removed".
 */
class SignInMethods
{
    public function __construct(
        private SignInPolicy $policy,
        private IntegrationAvailability $availability,
    ) {}

    /**
     * @return array<int, string>
     */
    public function remaining(User $user, ?SocialAccount $without = null): array
    {
        $accounts = $user->socialAccounts();

        if ($without !== null) {
            $accounts->whereKeyNot($without->id);
        }

        $providers = $accounts
            ->orderBy('provider')
            ->orderBy('id')
            ->pluck('provider')
            ->filter(fn (string $provider): bool => SsoProvider::tryFrom($provider)?->isEnabled() === true)
            ->unique()
            ->map(fn (string $provider): string => "sso:{$provider}")
            ->values()
            ->all();

        return array_values(array_filter([
            ...$providers,
            $this->allowsPassword($user) ? 'password' : null,
            $this->allowsMagicLink($user) ? 'magic_link' : null,
            $this->allowsPasskey($user) ? 'passkey' : null,
        ]));
    }

    /**
     * While only single sign-on signs in, the identities it relies on belong to the admin's rule.
     */
    public function isManagedByAdmin(SocialAccount $account): bool
    {
        if (! $this->policy->ssoRequired()) {
            return false;
        }

        return SsoProvider::tryFrom($account->provider)?->isEnabled() === true;
    }

    private function allowsPassword(User $user): bool
    {
        if ($user->password_set_at === null) {
            return false;
        }

        return $this->policy->allowsPassword($user);
    }

    private function allowsMagicLink(User $user): bool
    {
        if (! $this->policy->allowsLocalCredentials()) {
            return false;
        }

        if (! $this->availability->emailEnabled()) {
            return false;
        }

        return $user->hasVerifiedEmail();
    }

    private function allowsPasskey(User $user): bool
    {
        if (! $this->policy->allowsLocalCredentials()) {
            return false;
        }

        if (! Features::canManagePasskeys()) {
            return false;
        }

        return $user->passkeys()->exists();
    }
}
