<?php

namespace App\Enums;

use Laravel\Socialite\Contracts\User as SocialiteUser;

enum SsoProvider: string
{
    case Google = 'google';
    case GitHub = 'github';
    case Entra = 'entra';
    case Oidc = 'oidc';

    /**
     * @return array<int, self>
     */
    public static function enabled(): array
    {
        return array_values(array_filter(self::cases(), fn (self $provider) => $provider->isEnabled()));
    }

    /**
     * @return array<int, array{
     *     key: string,
     *     label: string
     * }>
     */
    public static function options(): array
    {
        return array_map(fn (self $provider) => [
            'key' => $provider->value,
            'label' => $provider->label(),
        ], self::enabled());
    }

    public function driver(): string
    {
        return match ($this) {
            self::Google => 'google',
            self::GitHub => 'github',
            self::Entra => 'oidc_entra',
            self::Oidc => 'oidc_generic',
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Google => 'Google',
            self::GitHub => 'GitHub',
            self::Entra => 'Microsoft',
            self::Oidc => (string) (config('oidc.connections.generic.label') ?: __('Single sign-on')),
        };
    }

    public function isEnabled(): bool
    {
        foreach ($this->requiredConfigKeys() as $key) {
            if (blank(config($key))) {
                return false;
            }
        }

        return true;
    }

    public function verifiedEmail(SocialiteUser $user): ?string
    {
        $email = $user->getEmail();

        if (blank($email)) {
            return null;
        }

        $claims = $user->getRaw();

        $isVerified = match ($this) {
            self::Google, self::Oidc => self::isTruthyClaim($claims['email_verified'] ?? null),
            self::GitHub => true,
            self::Entra => self::isTruthyClaim($claims['xms_edov'] ?? null),
        };

        return $isVerified ? $email : null;
    }

    /**
     * @return array<int, string>
     */
    private function requiredConfigKeys(): array
    {
        return match ($this) {
            self::Google => ['services.google.client_id', 'services.google.client_secret'],
            self::GitHub => ['services.github.client_id', 'services.github.client_secret'],
            self::Entra => ['oidc.connections.entra.client_id', 'oidc.connections.entra.client_secret'],
            self::Oidc => ['oidc.connections.generic.base_url', 'oidc.connections.generic.client_id', 'oidc.connections.generic.client_secret'],
        };
    }

    private static function isTruthyClaim(mixed $value): bool
    {
        return in_array($value, [true, 1, '1', 'true'], true);
    }
}
