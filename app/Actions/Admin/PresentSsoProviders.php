<?php

namespace App\Actions\Admin;

use App\Enums\SsoProvider;
use App\Support\InstanceConfiguration\ConfigurationCatalogue;
use App\Support\InstanceConfiguration\InstanceConfiguration;

class PresentSsoProviders
{
    public function __construct(
        private ConfigurationCatalogue $catalogue,
        private InstanceConfiguration $configuration,
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
     *     updateUrl: string
     * }>
     */
    public function handle(): array
    {
        return array_map(fn (SsoProvider $provider): array => [
            'key' => $provider->value,
            'label' => $this->label($provider),
            'configured' => $provider->isEnabled(),
            'redirectUri' => (string) config($this->redirectConfigKey($provider)),
            'fields' => $this->configuration->describe($this->catalogue->section($provider)),
            'testable' => TestOidcDiscovery::isTestable($provider),
            'updateUrl' => route('admin.ssoProviders.update', $provider->value),
        ], SsoProvider::cases());
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
