<?php

namespace App\Actions\Admin;

use App\Enums\AuditAction;
use App\Enums\SsoProvider;
use App\Models\User;
use App\Support\InstanceSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;

/**
 * Fetches the discovery document of the values in force (the stored configuration is already applied
 * to this request) and keeps the result as the section's last test (spec §9.3).
 */
class TestOidcDiscovery
{
    private const int TimeoutSeconds = 5;

    public function __construct(
        private InstanceSettings $settings,
        private RecordAuditEvent $recordAuditEvent,
    ) {}

    /**
     * @return array{
     *     ok: bool,
     *     ms: ?int,
     *     issuer: ?string,
     *     error: ?string
     * }
     */
    public function handle(User $admin, SsoProvider $provider): array
    {
        $baseUrl = $this->baseUrl($provider);
        $startedAt = hrtime(true);

        try {
            $response = Http::timeout(self::TimeoutSeconds)->acceptJson()->get("{$baseUrl}/.well-known/openid-configuration");
        } catch (ConnectionException) {
            $response = null;
        }

        $ms = (int) round((hrtime(true) - $startedAt) / 1_000_000);
        $result = $this->result($provider, $baseUrl, $response, $ms);

        $this->settings->set('sso_last_test', [
            'provider' => $provider->value,
            'at' => now()->toIso8601String(),
            'ok' => $result['ok'],
            'ms' => $result['ms'],
            'issuer' => $result['issuer'],
        ]);

        $this->recordAuditEvent->handle(AuditAction::SsoTested, $admin, null, ['provider' => $provider->value, 'ok' => $result['ok']]);

        return $result;
    }

    public static function isTestable(SsoProvider $provider): bool
    {
        return in_array($provider, [SsoProvider::Entra, SsoProvider::Oidc], true);
    }

    private function baseUrl(SsoProvider $provider): string
    {
        return match ($provider) {
            SsoProvider::Oidc => rtrim((string) config('oidc.connections.generic.base_url'), '/'),
            SsoProvider::Entra => 'https://login.microsoftonline.com/'.rawurlencode((string) config('oidc.connections.entra.tenant')).'/v2.0',
            default => throw new InvalidArgumentException("Provider [{$provider->value}] publishes no discovery document."),
        };
    }

    /**
     * @return array{
     *     ok: bool,
     *     ms: ?int,
     *     issuer: ?string,
     *     error: ?string
     * }
     */
    private function result(SsoProvider $provider, string $baseUrl, ?Response $response, int $ms): array
    {
        if ($response === null || ! $response->successful()) {
            return ['ok' => false, 'ms' => null, 'issuer' => null, 'error' => 'unreachable'];
        }

        $document = $response->json();

        if (! is_array($document) || ! $this->describesOidc($document)) {
            return ['ok' => false, 'ms' => $ms, 'issuer' => null, 'error' => 'not_oidc'];
        }

        $issuer = (string) $document['issuer'];

        if (! $this->issuerMatches($provider, $baseUrl, $issuer)) {
            return ['ok' => false, 'ms' => $ms, 'issuer' => $issuer, 'error' => 'issuer_mismatch'];
        }

        return ['ok' => true, 'ms' => $ms, 'issuer' => $issuer, 'error' => null];
    }

    /** @param array<mixed> $document */
    private function describesOidc(array $document): bool
    {
        foreach (['issuer', 'authorization_endpoint', 'token_endpoint'] as $key) {
            if (! is_string($document[$key] ?? null) || $document[$key] === '') {
                return false;
            }
        }

        return true;
    }

    /** Entra's issuer names the tenant's id rather than the tenant asked for: only its host is compared. */
    private function issuerMatches(SsoProvider $provider, string $baseUrl, string $issuer): bool
    {
        if ($provider === SsoProvider::Entra) {
            return parse_url($issuer, PHP_URL_HOST) === parse_url($baseUrl, PHP_URL_HOST);
        }

        return rtrim($issuer, '/') === rtrim($baseUrl, '/');
    }
}
