<?php

namespace App\Support\Auth;

use App\Enums\SignInEntry;
use App\Enums\SsoProvider;
use App\Models\User;
use App\Support\InstanceSettings;

/**
 * The one answer to "which ways in does this instance accept". Every entry
 * point asks it; none reads the setting by itself.
 */
class SignInPolicy
{
    public const string NoProvider = 'no_provider';

    public const string NoIdentity = 'no_identity';

    public const string NoSecondFactor = 'no_second_factor';

    public function __construct(private InstanceSettings $settings, private SecondFactors $secondFactors) {}

    /**
     * In force only while a provider is enabled (R1).
     */
    public function ssoRequired(): bool
    {
        if (! $this->settings->ssoRequired()) {
            return false;
        }

        return SsoProvider::enabled() !== [];
    }

    /**
     * Stored, and ignored because no provider is enabled (R2).
     */
    public function isIgnored(): bool
    {
        if (! $this->settings->ssoRequired()) {
            return false;
        }

        return SsoProvider::enabled() === [];
    }

    /**
     * Magic link, form registration and passkey: for nobody while the setting is in force.
     */
    public function allowsLocalCredentials(): bool
    {
        return ! $this->ssoRequired();
    }

    /**
     * While the setting is in force a password is the way back of instance
     * admins, and only with a second factor behind it (R4, R5).
     */
    public function allowsPassword(User $user): bool
    {
        if (! $this->ssoRequired()) {
            return true;
        }

        if ($user->is_instance_admin !== true) {
            return false;
        }

        return $this->secondFactors->requiredFor($user);
    }

    /**
     * A second-factor challenge may end only while the way in that opened it
     * is still accepted. A challenge of unknown origin is held to the
     * strictest answer.
     */
    public function allowsCompleting(?SignInEntry $entry, User $user): bool
    {
        return match ($entry) {
            SignInEntry::Sso => true,
            SignInEntry::Password => $this->allowsPassword($user),
            SignInEntry::MagicLink, null => $this->allowsLocalCredentials(),
        };
    }

    public function allowsPasswordReset(User $user): bool
    {
        if (! $this->ssoRequired()) {
            return true;
        }

        return $user->is_instance_admin === true;
    }

    /**
     * What stands in the way of requiring single sign-on, for this admin (R14).
     *
     * @return array<int, string>
     */
    public function enablingBlockers(User $admin): array
    {
        $providers = array_map(fn (SsoProvider $provider): string => $provider->value, SsoProvider::enabled());

        if ($providers === []) {
            return [self::NoProvider];
        }

        return array_values(array_filter([
            $admin->socialAccounts()->whereIn('provider', $providers)->exists() ? null : self::NoIdentity,
            $this->secondFactors->requiredFor($admin) ? null : self::NoSecondFactor,
        ]));
    }
}
