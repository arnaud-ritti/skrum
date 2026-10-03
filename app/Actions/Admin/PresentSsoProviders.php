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
        $providers = array_map(function (SsoProvider $provider): array {
            $section = $this->catalogue->section($provider);

            return [
                'provider' => $provider,
                'section' => $section,
                'fields' => $this->configuration->describe($section),
            ];
        }, SsoProvider::cases());

        $secretChangeTimes = $this->secretChangeTimes->handleMany(array_values(array_map(
            fn (array $provider): InstanceSettingKey => $provider['section'],
            array_filter($providers, fn (array $provider): bool => $this->hasStoredSecret($provider['fields'])),
        )), 'client_secret');

        return array_map(fn (array $provider): array => [
            'key' => $provider['provider']->value,
            'label' => $this->label($provider['provider']),
            'configured' => $provider['provider']->isEnabled(),
            'redirectUri' => (string) config($this->redirectConfigKey($provider['provider'])),
            'fields' => $provider['fields'],
            'testable' => TestOidcDiscovery::isTestable($provider['provider']),
            'updateUrl' => route('admin.ssoProviders.update', $provider['provider']->value),
            'secretChangedAt' => ($secretChangeTimes[$provider['section']->value] ?? null)?->toIso8601String(),
        ], $providers);
    }

    /**
     * Only a stored secret has a change time: nothing for a secret from the environment or cleared.
     *
     * @param  array<string, array<string, mixed>>  $fields
     */
    private function hasStoredSecret(array $fields): bool
    {
        return ($fields['client_secret']['source'] ?? null) === 'stored';
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
