<?php

namespace App\Actions\Admin;

use App\Enums\InstanceSettingKey;
use App\Enums\SsoProvider;
use App\Support\InstanceConfiguration\ConfigurationCatalogue;
use App\Support\InstanceConfiguration\InstanceConfiguration;

class PresentSsoProviders
{
    public function __construct(
        private ConfigurationCatalogue $catalogue,
        private InstanceConfiguration $configuration,
        private SecretChangeTimes $secretChangeTimes,
    ) {}

    /**
     * Every sign-in provider with what its card may show: never a secret's value (rule S5).
     *
     * @return array<int, array{
     *     key: string,
     *     label: string,
     *     configured: bool,
     *     redirectUri: string,
     *     fields: array<string, array<string, mixed>>,
     *     testable: bool,
     *     updateUrl: string,
     *     secretChangedAt: ?string
     * }>
     */
    public function handle(): array
    {
        return array_map(function (SsoProvider $provider): array {
            $section = $this->catalogue->section($provider);
            $fields = $this->configuration->describe($section);

            return [
                'key' => $provider->value,
                'label' => $this->label($provider),
                'configured' => $provider->isEnabled(),
                'redirectUri' => (string) config($this->redirectConfigKey($provider)),
                'fields' => $fields,
                'testable' => TestOidcDiscovery::isTestable($provider),
                'updateUrl' => route('admin.ssoProviders.update', $provider->value),
                'secretChangedAt' => $this->secretChangedAt($section, $fields),
            ];
        }, SsoProvider::cases());
    }

    /**
     * When the stored secret last changed, from the audit log; nothing for a secret from the environment or cleared.
     *
     * @param  array<string, array<string, mixed>>  $fields
     */
    private function secretChangedAt(InstanceSettingKey $section, array $fields): ?string
    {
        if (($fields['client_secret']['source'] ?? null) !== 'stored') {
            return null;
        }

        return $this->secretChangeTimes->handle($section, 'client_secret')?->toIso8601String();
    }

    private function label(SsoProvider $provider): string
    {
        return match ($provider) {
            SsoProvider::Entra => 'Microsoft Entra',
            SsoProvider::Oidc => 'OIDC',
            default => $provider->label(),
        };
    }

    private function redirectConfigKey(SsoProvider $provider): string
    {
        return match ($provider) {
            SsoProvider::Google => 'services.google.redirect',
            SsoProvider::GitHub => 'services.github.redirect',
            SsoProvider::Entra => 'oidc.connections.entra.redirect',
            SsoProvider::Oidc => 'oidc.connections.generic.redirect',
        };
    }
}
