<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\GitHub\GitHubAppJwt;
use App\Support\Integrations\GitHub\GitHubClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::GitHub);
});

/**
 * @param  array<string, string>  $query
 */
function gitHubCallback(User $user, Team $team, array $query = []): TestResponse
{
    return test()->actingAs($user)
        ->withSession(integrationOAuthSession($team, IntegrationProvider::GitHub, IntegrationAccess::Read))
        ->get(route('integrations.callback', [
            'provider' => 'github',
            'code' => 'github-code',
            'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu',
            'installation_id' => '4242',
            'setup_action' => 'install',
            ...$query,
        ]));
}

/**
 * @param  array<int, array<string, mixed>>  $installations
 */
function fakeGitHubUserInstallations(array $installations): void
{
    Http::fake([
        'github.com/login/oauth/access_token' => Http::response(['access_token' => 'ghu_user_token', 'token_type' => 'bearer']),
        'api.github.com/user/installations*' => Http::response(['total_count' => count($installations), 'installations' => $installations]),
    ]);
}

it('sends admins to the GitHub App installation page', function () {
    $team = Team::factory()->create();

    $response = $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.connect', [$team->workspace, $team, 'github']));

    expect((string) $response->headers->get('Location'))
        ->toBe('https://github.com/apps/skrum-test/installations/new?state='.session('integrations.oauth.state'));
});

it('connects the installation listed for the person and never stores their token', function () {
    fakeGitHubUserInstallations([
        ['id' => 4242, 'account' => ['login' => 'acme', 'type' => 'Organization'], 'permissions' => ['issues' => 'write', 'metadata' => 'read']],
    ]);
    $team = Team::factory()->create();

    gitHubCallback(integrationAdmin($team), $team)
        ->assertInertiaFlash('toast', ['type' => 'success', 'message' => 'GitHub connected.']);

    $integration = TeamIntegration::query()->sole();

    expect($integration->provider)->toBe(IntegrationProvider::GitHub)
        ->and($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->access)->toBe(IntegrationAccess::Write)
        ->and($integration->site())->toBe('4242')
        ->and($integration->settings)->toEqual(['installationId' => '4242', 'accountLogin' => 'acme', 'accountType' => 'Organization'])
        ->and($integration->readableCredentials())->toBe([])
        ->and((string) DB::table('team_integrations')->value('credentials'))->not->toContain('ghu_user_token')
        ->and(Cache::has('github-installation-token:4242'))->toBeFalse();

    Http::assertSent(fn (Request $request) => $request->url() === 'https://github.com/login/oauth/access_token'
        && $request['code'] === 'github-code'
        && $request['client_secret'] === 'github-secret');
    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/user/installations')
        && $request->hasHeader('Authorization', 'Bearer ghu_user_token')
        && $request->hasHeader('X-GitHub-Api-Version', '2022-11-28'));
});

it('refuses an installation the person cannot see', function (string $installationId) {
    fakeGitHubUserInstallations([
        ['id' => 999, 'account' => ['login' => 'someone-else', 'type' => 'User'], 'permissions' => ['issues' => 'write']],
    ]);
    $team = Team::factory()->create();

    gitHubCallback(integrationAdmin($team), $team, ['installation_id' => $installationId])
        ->assertInertiaFlash('toast', ['type' => 'error', 'message' => "This GitHub installation isn't available to your account."]);

    expect(TeamIntegration::query()->count())->toBe(0);
})->with(['forged id' => ['4242'], 'not a number' => ['../4242']]);

it('connects read only when the app cannot write issues', function () {
    fakeGitHubUserInstallations([
        ['id' => 4242, 'account' => ['login' => 'jane', 'type' => 'User'], 'permissions' => ['issues' => 'read']],
    ]);
    $team = Team::factory()->create();

    gitHubCallback(integrationAdmin($team), $team);

    expect(TeamIntegration::query()->sole()->access)->toBe(IntegrationAccess::Read)
        ->and(TeamIntegration::query()->sole()->setting('accountType'))->toBe('User');
});

it('signs a verifiable app JWT', function () {
    $this->freezeTime();

    [$header, $payload, $signature] = explode('.', app(GitHubAppJwt::class)->token());
    $decode = fn (string $segment): array => json_decode((string) base64_decode(strtr($segment, '-_', '+/')), true);
    $publicKey = openssl_pkey_get_details(openssl_pkey_get_private(gitHubTestPrivateKey()))['key'];

    expect($decode($header))->toBe(['alg' => 'RS256', 'typ' => 'JWT'])
        ->and($decode($payload))->toBe(['iat' => now()->getTimestamp() - 60, 'exp' => now()->getTimestamp() + 540, 'iss' => 12345])
        ->and(openssl_verify("{$header}.{$payload}", (string) base64_decode(strtr($signature, '-_', '+/')), $publicKey, OPENSSL_ALGO_SHA256))->toBe(1);
});

it('caches the installation token encrypted and reuses it', function () {
    fakeGitHubInstallationToken();
    Http::fake(['api.github.com/installation/repositories*' => Http::response([
        'total_count' => 1,
        'repositories' => [['id' => 9001, 'full_name' => 'acme/api']],
    ])]);
    $integration = TeamIntegration::factory()->gitHub()->create();
    $client = app(GitHubClient::class);

    expect($client->repositories($integration))->toBe([['id' => '9001', 'name' => 'acme/api']])
        ->and($client->repositories($integration))->toBe([['id' => '9001', 'name' => 'acme/api']]);

    $cached = Cache::get('github-installation-token:4242');

    expect($cached)->toBeString()->not->toBe('ghs_installation_token')
        ->and(Crypt::decryptString($cached))->toBe('ghs_installation_token');
    Http::assertSentCount(3);
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/app/installations/4242/access_tokens')
        && str_starts_with((string) $request->header('Authorization')[0], 'Bearer eyJ'));
    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/installation/repositories')
        && $request->hasHeader('Authorization', 'Bearer ghs_installation_token')
        && $request->hasHeader('Accept', 'application/vnd.github+json'));
});

it('mints a new token once GitHub refuses the cached one', function () {
    Cache::put('github-installation-token:4242', Crypt::encryptString('ghs_stale'), now()->addMinutes(10));
    fakeGitHubInstallationToken('ghs_fresh');
    Http::fake(['api.github.com/installation/repositories*' => Http::sequence()
        ->push(['message' => 'Bad credentials'], 401)
        ->push(['total_count' => 0, 'repositories' => []])]);
    $integration = TeamIntegration::factory()->gitHub()->create();

    expect(app(GitHubClient::class)->repositories($integration))->toBe([]);

    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/installation/repositories')
        && $request->hasHeader('Authorization', 'Bearer ghs_fresh'));
    expect(Crypt::decryptString(Cache::get('github-installation-token:4242')))->toBe('ghs_fresh');
});

it('asks to reconnect uninstalled and suspended installations', function (array $response, int $status, string $error) {
    Http::fake(['api.github.com/app/installations/4242' => Http::response($response, $status)]);
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $team->id]);

    $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $integration]))
        ->assertConflict();

    expect($integration->fresh()?->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()?->last_error)->toBe($error);
})->with([
    'uninstalled' => [['message' => 'Not Found'], 404, 'The GitHub App was uninstalled from acme.'],
    'suspended' => [['id' => 4242, 'suspended_at' => '2026-10-01T09:00:00Z'], 200, 'The GitHub App is suspended on acme.'],
]);

it('turns GitHub rate limits into a wait', function () {
    $this->freezeTime();
    fakeGitHubInstallationToken();
    Http::fake(['api.github.com/installation/repositories*' => Http::response(['message' => 'API rate limit exceeded'], 403, [
        'x-ratelimit-remaining' => '0',
        'x-ratelimit-reset' => (string) (now()->getTimestamp() + 120),
    ])]);
    $integration = TeamIntegration::factory()->gitHub()->create();

    try {
        app(GitHubClient::class)->repositories($integration);
        $this->fail('The rate limit was not reported.');
    } catch (RateLimited $exception) {
        expect($exception->retryAfter)->toBe(120);
    }
});
