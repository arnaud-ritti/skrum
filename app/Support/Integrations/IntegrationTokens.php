<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use App\Support\Integrations\Linear\LinearClient;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Refreshes run under a cache lock and a row lock, and re-read the row, so
 * two workers never spend the same (rotating) refresh token twice.
 */
class IntegrationTokens
{
    private const RefreshMarginSeconds = 60;

    private const LockSeconds = 30;

    private const LockWaitSeconds = 20;

    public function accessToken(TeamIntegration $integration): string
    {
        $token = $integration->credential('access_token');

        if (! is_string($token) || $token === '') {
            throw new ReconnectRequired($integration->provider, 'missing_access_token');
        }

        if (! $this->expiresSoon($integration->credential('expires_at'))) {
            return $token;
        }

        return $this->refresh($integration, $token);
    }

    public function refresh(TeamIntegration $integration, ?string $staleToken = null): string
    {
        return $integration->withReconnectHandling(function () use ($integration, $staleToken): string {
            try {
                return Cache::lock("integration-token:{$integration->id}", self::LockSeconds)
                    ->block(self::LockWaitSeconds, fn (): string => $this->refreshLocked($integration, $staleToken));
            } catch (LockTimeoutException) {
                throw new ProviderUnavailable($integration->provider, 'token_refresh_busy');
            }
        });
    }

    /**
     * Refreshes an expiring OAuth token before the caller takes row locks.
     * Jira DC personal access tokens and GitHub installations have none.
     */
    public function prepare(TeamIntegration $integration): void
    {
        $refreshes = match ($integration->provider) {
            IntegrationProvider::Jira, IntegrationProvider::Linear => true,
            IntegrationProvider::JiraDataCenter => $integration->setting('authMethod') === JiraDataCenterClient::AuthMethodOAuth,
            default => false,
        };

        if ($refreshes) {
            $this->accessToken($integration);
        }
    }

    private function refreshLocked(TeamIntegration $integration, ?string $staleToken): string
    {
        return DB::transaction(function () use ($integration, $staleToken): string {
            $locked = TeamIntegration::query()->whereKey($integration->id)->lockForUpdate()->firstOrFail();
            $current = $locked->credential('access_token');

            if (is_string($current) && $current !== $staleToken && ! $this->expiresSoon($locked->credential('expires_at'))) {
                $integration->setRawAttributes($locked->getAttributes(), true);

                return $current;
            }

            $refreshToken = $locked->credential('refresh_token');

            if (! is_string($refreshToken) || $refreshToken === '') {
                throw new ReconnectRequired($locked->provider, 'missing_refresh_token');
            }

            $tokens = $this->client($locked->provider)->refreshTokens($refreshToken);

            $locked->forceFill(['credentials' => [
                ...(array) $locked->readableCredentials(),
                'access_token' => $tokens['access_token'],
                'refresh_token' => $tokens['refresh_token'] ?? $refreshToken,
                'expires_at' => $tokens['expires_at'],
            ]])->save();

            $integration->setRawAttributes($locked->getAttributes(), true);

            return $tokens['access_token'];
        });
    }

    private function expiresSoon(mixed $expiresAt): bool
    {
        return is_int($expiresAt) && $expiresAt - self::RefreshMarginSeconds <= now()->getTimestamp();
    }

    private function client(IntegrationProvider $provider): RefreshesTokens
    {
        return match ($provider) {
            IntegrationProvider::Jira => app(JiraClient::class),
            IntegrationProvider::Linear => app(LinearClient::class),
            IntegrationProvider::JiraDataCenter => app(JiraDataCenterClient::class),
            default => throw new ReconnectRequired($provider, 'no_token_refresh'),
        };
    }
}
