<?php

namespace App\Support\Integrations\GitHub;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\ProviderHttp;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;

/**
 * GitHub Issues through the GitHub App (spec 8 §4.2). Installation tokens
 * live only in the cache, encrypted, minted under a lock; the user token of
 * the install callback is used once and never kept. Every value placed in
 * a path is validated first.
 */
class GitHubClient
{
    public const ApiUrl = 'https://api.github.com/';

    public const OAuthTokenUrl = 'https://github.com/login/oauth/access_token';

    public const ApiVersion = '2022-11-28';

    private const Provider = IntegrationProvider::GitHub;

    private const TokenMinutes = 50;

    private const LockSeconds = 30;

    private const LockWaitSeconds = 20;

    private const PageSize = 100;

    private const MaxPages = 10;

    private const MaxRetryAfterSeconds = 3600;

    private const IdPattern = '/^\d{1,20}\z/';

    private const LoginPattern = '/^[A-Za-z0-9-]{1,39}\z/';

    private const RepositoryPattern = '/^[A-Za-z0-9._-]{1,100}\z/';

    public function __construct(private GitHubAppJwt $jwt) {}

    public function installationUrl(string $state): string
    {
        return 'https://github.com/apps/'.rawurlencode((string) config('services.github_app.slug')).'/installations/new?'
            .http_build_query(['state' => $state], '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * The person's user token, to be used for the installation check only.
     */
    public function exchangeCode(string $code): string
    {
        $response = ProviderHttp::send(self::Provider, fn () => ProviderHttp::request()->withoutRedirecting()->post(self::OAuthTokenUrl, [
            'client_id' => (string) config('services.github_app.client_id'),
            'client_secret' => (string) config('services.github_app.client_secret'),
            'code' => $code,
            'redirect_uri' => (string) config('services.github_app.redirect'),
        ]));

        $token = $response->json('access_token');

        if (! $response->successful() || ! is_string($token) || $token === '') {
            throw new ProviderRejected(self::Provider, 'code_exchange_failed');
        }

        return $token;
    }

    /**
     * @return array<int, array{id: string, accountLogin: string, accountType: 'Organization'|'User', canWriteIssues: bool}>
     */
    public function userInstallations(string $userToken): array
    {
        $installations = [];

        for ($page = 1; $page <= self::MaxPages; $page++) {
            $response = $this->call('GET', 'user/installations', ['per_page' => self::PageSize, 'page' => $page], $userToken);

            if (! $response->successful()) {
                $this->fail($response);
            }

            foreach ((array) $response->json('installations', []) as $installation) {
                $summary = self::installationSummary($installation);

                if ($summary !== null) {
                    $installations[] = $summary;
                }
            }

            if (! self::hasNextPage($response)) {
                break;
            }
        }

        return $installations;
    }

    /**
     * The installation as the app sees it; an uninstalled or suspended
     * installation needs a reconnect.
     *
     * @return array<array-key, mixed>
     */
    public function installation(TeamIntegration $integration): array
    {
        return $integration->withReconnectHandling(function () use ($integration): array {
            $installationId = $this->installationId($integration);
            $response = $this->call('GET', "app/installations/{$installationId}", [], $this->jwt->token());

            if ($response->status() === 404) {
                throw new ReconnectRequired(self::Provider, $this->uninstalledMessage($integration));
            }

            if (! $response->successful()) {
                $this->fail($response);
            }

            if ($response->json('suspended_at') !== null) {
                throw new ReconnectRequired(self::Provider, $this->suspendedMessage($integration));
            }

            return (array) $response->json();
        });
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<array-key, mixed>
     */
    public function get(TeamIntegration $integration, string $path, array $query = []): array
    {
        return $this->decode($this->response($integration, 'GET', $path, $query));
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function post(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->decode($this->response($integration, 'POST', $path, $body));
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function patch(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->decode($this->response($integration, 'PATCH', $path, $body));
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function response(TeamIntegration $integration, string $method, string $path, array $data = []): Response
    {
        return $integration->withReconnectHandling(function () use ($integration, $method, $path, $data): Response {
            $response = $this->call($method, $path, $data, $this->installationToken($integration));

            if ($response->status() === 401) {
                $this->forgetInstallationToken($this->installationId($integration));
                $response = $this->call($method, $path, $data, $this->installationToken($integration));
            }

            if (! $response->successful()) {
                $this->fail($response);
            }

            return $response;
        });
    }

    /**
     * `owner/repo` re-read by id, so renamed repositories keep working.
     */
    public function repositoryName(TeamIntegration $integration, string $repositoryId): string
    {
        if (preg_match(self::IdPattern, $repositoryId) !== 1) {
            throw new ProviderRejected(self::Provider, 'invalid_repository', 404);
        }

        $fullName = self::safeFullName($this->get($integration, "repositories/{$repositoryId}")['full_name'] ?? null);

        if ($fullName === null) {
            throw new ProviderRejected(self::Provider, 'invalid_repository', 404);
        }

        return $fullName;
    }

    /**
     * Every repository the installation can see (at most 1 000).
     *
     * @return array<int, array{id: string, name: string}>
     */
    public function repositories(TeamIntegration $integration): array
    {
        $repositories = [];

        for ($page = 1; $page <= self::MaxPages; $page++) {
            $response = $this->response($integration, 'GET', 'installation/repositories', ['per_page' => self::PageSize, 'page' => $page]);

            foreach ((array) $response->json('repositories', []) as $repository) {
                $fullName = is_array($repository) ? self::safeFullName($repository['full_name'] ?? null) : null;

                if ($fullName !== null && is_int($repository['id'] ?? null)) {
                    $repositories[] = ['id' => (string) $repository['id'], 'name' => $fullName];
                }
            }

            if (! self::hasNextPage($response)) {
                break;
            }
        }

        return $repositories;
    }

    public function forgetInstallationToken(string $installationId): void
    {
        Cache::forget(self::tokenKey($installationId));
    }

    public static function safeFullName(mixed $fullName): ?string
    {
        if (! is_string($fullName) || substr_count($fullName, '/') !== 1) {
            return null;
        }

        [$owner, $repository] = explode('/', $fullName);

        if (! self::isLogin($owner) || preg_match(self::RepositoryPattern, $repository) !== 1 || in_array($repository, ['.', '..'], true)) {
            return null;
        }

        return $fullName;
    }

    /**
     * @phpstan-assert-if-true non-empty-string $login
     */
    public static function isLogin(mixed $login): bool
    {
        return is_string($login) && preg_match(self::LoginPattern, $login) === 1;
    }

    public static function hasNextPage(Response $response): bool
    {
        return str_contains($response->header('Link'), 'rel="next"');
    }

    /**
     * @return array{id: string, accountLogin: string, accountType: 'Organization'|'User', canWriteIssues: bool}|null
     */
    private static function installationSummary(mixed $installation): ?array
    {
        if (! is_array($installation) || ! is_int($installation['id'] ?? null)) {
            return null;
        }

        $login = data_get($installation, 'account.login');

        if (! self::isLogin($login)) {
            return null;
        }

        return [
            'id' => (string) $installation['id'],
            'accountLogin' => $login,
            'accountType' => data_get($installation, 'account.type') === 'Organization' ? 'Organization' : 'User',
            'canWriteIssues' => data_get($installation, 'permissions.issues') === 'write',
        ];
    }

    private function installationToken(TeamIntegration $integration): string
    {
        $installationId = $this->installationId($integration);
        $key = self::tokenKey($installationId);

        $cached = $this->cachedToken($key);

        if ($cached !== null) {
            return $cached;
        }

        try {
            return Cache::lock("{$key}:lock", self::LockSeconds)->block(
                self::LockWaitSeconds,
                fn (): string => $this->cachedToken($key) ?? $this->mintToken($integration, $installationId, $key),
            );
        } catch (LockTimeoutException) {
            throw new ProviderUnavailable(self::Provider, 'installation_token_busy');
        }
    }

    private function mintToken(TeamIntegration $integration, string $installationId, string $key): string
    {
        $response = $this->call('POST', "app/installations/{$installationId}/access_tokens", [], $this->jwt->token());

        if ($response->status() === 404) {
            throw new ReconnectRequired(self::Provider, $this->uninstalledMessage($integration));
        }

        if ($response->status() === 403) {
            throw new ReconnectRequired(self::Provider, $this->suspendedMessage($integration));
        }

        if (! $response->successful()) {
            $this->fail($response);
        }

        $token = $response->json('token');

        if (! is_string($token) || $token === '') {
            throw new ProviderRejected(self::Provider, 'missing_installation_token');
        }

        Cache::put($key, Crypt::encryptString($token), now()->addMinutes(self::TokenMinutes));

        return $token;
    }

    private function cachedToken(string $key): ?string
    {
        $stored = Cache::get($key);

        if (! is_string($stored)) {
            return null;
        }

        try {
            return Crypt::decryptString($stored);
        } catch (DecryptException) {
            Cache::forget($key);

            return null;
        }
    }

    private function installationId(TeamIntegration $integration): string
    {
        $installationId = $integration->setting('installationId');

        if (! is_string($installationId) || preg_match(self::IdPattern, $installationId) !== 1) {
            throw new NotConnected(self::Provider);
        }

        return $installationId;
    }

    private static function tokenKey(string $installationId): string
    {
        return "github-installation-token:{$installationId}";
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function call(string $method, string $path, array $data, string $token): Response
    {
        $options = $method === 'GET' ? ['query' => $data] : ['json' => $data];

        return ProviderHttp::send(self::Provider, fn () => $this->http()->withToken($token)->send($method, self::ApiUrl.ltrim($path, '/'), $options));
    }

    private function http(): PendingRequest
    {
        return ProviderHttp::request()
            ->withoutRedirecting()
            ->withHeaders(['Accept' => 'application/vnd.github+json', 'X-GitHub-Api-Version' => self::ApiVersion]);
    }

    private function fail(Response $response): never
    {
        $limited = $response->status() === 429
            || ($response->status() === 403 && ($response->header('x-ratelimit-remaining') === '0' || $response->header('Retry-After') !== ''));

        if ($limited) {
            throw new RateLimited(self::Provider, $this->retryAfter($response), ProviderHttp::message($response));
        }

        ProviderHttp::fail(self::Provider, $response);
    }

    private function retryAfter(Response $response): int
    {
        $retryAfter = $response->header('Retry-After');
        $reset = $response->header('x-ratelimit-reset');

        $seconds = match (true) {
            is_numeric($retryAfter) => (int) $retryAfter,
            is_numeric($reset) => (int) $reset - now()->getTimestamp(),
            default => 60,
        };

        return min(self::MaxRetryAfterSeconds, max(1, $seconds));
    }

    private function uninstalledMessage(TeamIntegration $integration): string
    {
        return __('The GitHub App was uninstalled from :account.', ['account' => (string) $integration->setting('accountLogin', 'GitHub')]);
    }

    private function suspendedMessage(TeamIntegration $integration): string
    {
        return __('The GitHub App is suspended on :account.', ['account' => (string) $integration->setting('accountLogin', 'GitHub')]);
    }

    /**
     * @return array<array-key, mixed>
     */
    private function decode(Response $response): array
    {
        $json = $response->json();

        return is_array($json) ? $json : [];
    }
}
