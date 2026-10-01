<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\Linear\LinearClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear);
});

function jiraRefreshResponse(): array
{
    return ['access_token' => 'jira-access-2', 'refresh_token' => 'jira-refresh-2', 'expires_in' => 3600, 'scope' => 'offline_access read:jira-work'];
}

it('calls Jira on the connected site with a fresh token', function () {
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/myself' => Http::response(['accountId' => 'me'])]);
    $integration = TeamIntegration::factory()->jira()->create();

    expect(app(JiraClient::class)->get($integration, 'rest/api/3/myself'))->toBe(['accountId' => 'me']);

    Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer jira-access'));
    Http::assertSentCount(1);
});

it('refreshes an expiring Jira token and stores the rotated refresh token', function () {
    Http::fake([
        'auth.atlassian.com/oauth/token' => Http::response(jiraRefreshResponse()),
        'api.atlassian.com/ex/jira/cloud-1/*' => Http::response(['accountId' => 'me']),
    ]);
    $integration = TeamIntegration::factory()->jira()->expiring()->create();

    app(JiraClient::class)->get($integration, 'rest/api/3/myself');

    $credentials = $integration->fresh()->readableCredentials();

    expect($credentials['access_token'])->toBe('jira-access-2')
        ->and($credentials['refresh_token'])->toBe('jira-refresh-2')
        ->and($credentials['expires_at'])->toBeGreaterThan(now()->addMinutes(55)->getTimestamp());

    Http::assertSent(fn (Request $request) => $request->url() === JiraClient::TokenUrl
        && $request['grant_type'] === 'refresh_token'
        && $request['refresh_token'] === 'jira-refresh'
        && $request['client_id'] === 'jira-client');
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/myself')
        && $request->hasHeader('Authorization', 'Bearer jira-access-2'));
});

it('reuses a token another worker refreshed', function () {
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/*' => Http::response(['accountId' => 'me'])]);
    $stale = TeamIntegration::factory()->jira()->expiring()->create();

    TeamIntegration::query()->findOrFail($stale->id)->forceFill(['credentials' => [
        'access_token' => 'jira-access-other-worker',
        'refresh_token' => 'jira-refresh-other-worker',
        'expires_at' => now()->addHour()->getTimestamp(),
    ]])->save();

    app(JiraClient::class)->get($stale, 'rest/api/3/myself');

    Http::assertNotSent(fn (Request $request) => $request->url() === JiraClient::TokenUrl);
    Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer jira-access-other-worker'));
});

it('requires a reconnect when the refresh token is refused', function () {
    Http::fake(['auth.atlassian.com/oauth/token' => Http::response(['error' => 'invalid_grant', 'error_description' => 'Unknown or invalid refresh token.'], 403)]);
    $integration = TeamIntegration::factory()->jira()->expiring()->create();

    expect(fn () => app(JiraClient::class)->get($integration, 'rest/api/3/myself'))->toThrow(ReconnectRequired::class);

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->last_error)->toBe('Unknown or invalid refresh token.');
});

it('refreshes once after a 401 and gives up after a second one', function () {
    Http::fake([
        'auth.atlassian.com/oauth/token' => Http::response(jiraRefreshResponse()),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/one' => Http::sequence()->push([], 401)->push(['ok' => true]),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/two' => Http::response(['message' => 'Unauthorized'], 401),
    ]);
    $retried = TeamIntegration::factory()->jira()->create();
    $revoked = TeamIntegration::factory()->jira()->create();

    expect(app(JiraClient::class)->get($retried, 'rest/api/3/one'))->toBe(['ok' => true])
        ->and($retried->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and(fn () => app(JiraClient::class)->get($revoked, 'rest/api/3/two'))->toThrow(ReconnectRequired::class)
        ->and($revoked->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});

it('refuses Jira calls before a site is chosen', function () {
    $integration = TeamIntegration::factory()->setupRequired()->create();

    expect(fn () => app(JiraClient::class)->get($integration, 'rest/api/3/myself'))->toThrow(NotConnected::class);

    Http::assertNothingSent();
});

it('lists the accessible Jira sites', function () {
    Http::fake(['api.atlassian.com/oauth/token/accessible-resources' => Http::response([
        ['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net/', 'name' => 'Acme', 'scopes' => ['read:jira-work']],
        ['id' => 'conf-1', 'url' => 'https://acme.atlassian.net/wiki', 'name' => 'Acme wiki', 'scopes' => ['read:confluence-content.all']],
    ])]);

    expect(app(JiraClient::class)->accessibleResources('token'))
        ->toBe([['cloudId' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme']]);
});

it('builds authorization URLs with the scopes of each access level', function () {
    parse_str((string) parse_url(app(JiraClient::class)->authorizationUrl('s', IntegrationAccess::Read), PHP_URL_QUERY), $read);
    parse_str((string) parse_url(app(JiraClient::class)->authorizationUrl('s', IntegrationAccess::Write), PHP_URL_QUERY), $write);
    parse_str((string) parse_url(app(LinearClient::class)->authorizationUrl('s', IntegrationAccess::Write), PHP_URL_QUERY), $linear);

    expect($read)->toMatchArray([
        'audience' => 'api.atlassian.com',
        'client_id' => 'jira-client',
        'scope' => 'offline_access read:jira-work read:board-scope:jira-software read:sprint:jira-software manage:jira-webhook',
        'redirect_uri' => config('services.jira.redirect'),
        'state' => 's',
        'response_type' => 'code',
        'prompt' => 'consent',
    ])
        ->and($write['scope'])->toBe('offline_access read:jira-work read:board-scope:jira-software read:sprint:jira-software manage:jira-webhook write:jira-work read:jira-user')
        ->and($linear)->toMatchArray([
            'client_id' => 'linear-client',
            'scope' => 'read,write',
            'redirect_uri' => config('services.linear.redirect'),
            'response_type' => 'code',
            'actor' => 'user',
            'state' => 's',
        ]);
});

it('returns Linear data and maps GraphQL errors', function () {
    Http::fake(['api.linear.app/graphql' => Http::sequence()
        ->push(['data' => ['viewer' => ['id' => 'u1']]])
        ->push(['errors' => [['message' => 'Rate limit exceeded', 'extensions' => ['code' => 'RATELIMITED']]]], 400)
        ->push(['errors' => [['message' => 'Argument invalid', 'extensions' => ['code' => 'INVALID_INPUT']]]], 400)
        ->push(['errors' => [['message' => 'Authentication required', 'extensions' => ['code' => 'AUTHENTICATION_ERROR']]]], 400)]);
    $integration = TeamIntegration::factory()->linear()->create();
    $linear = app(LinearClient::class);

    expect($linear->query($integration, 'query { viewer { id } }'))->toBe(['viewer' => ['id' => 'u1']])
        ->and(fn () => $linear->query($integration, 'query { viewer { id } }'))->toThrow(RateLimited::class)
        ->and(fn () => $linear->query($integration, 'query { viewer { id } }'))->toThrow(ProviderRejected::class, 'Argument invalid')
        ->and(fn () => $linear->query($integration, 'query { viewer { id } }'))->toThrow(ReconnectRequired::class)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);

    Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer linear-access'));
});

it('reads the Linear organization with a new token', function () {
    Http::fake(['api.linear.app/graphql' => Http::response(['data' => ['viewer' => ['organization' => ['id' => 'org-9', 'name' => 'Nine', 'urlKey' => 'nine']]]])]);

    expect(app(LinearClient::class)->organization('fresh-token'))->toBe(['id' => 'org-9', 'name' => 'Nine', 'urlKey' => 'nine']);
});

it('refreshes an expiring Linear token with a form request', function () {
    Http::fake([
        'api.linear.app/oauth/token' => Http::response(['access_token' => 'linear-access-2', 'refresh_token' => 'linear-refresh-2', 'expires_in' => 86399, 'scope' => 'read write']),
        'api.linear.app/graphql' => Http::response(['data' => ['viewer' => ['id' => 'u1']]]),
    ]);
    $integration = TeamIntegration::factory()->linear()->create([
        'credentials' => ['access_token' => 'linear-access', 'refresh_token' => 'linear-refresh', 'expires_at' => now()->addSeconds(30)->getTimestamp()],
    ]);

    app(LinearClient::class)->query($integration, 'query { viewer { id } }');

    $credentials = $integration->fresh()->readableCredentials();

    expect($credentials['access_token'])->toBe('linear-access-2')
        ->and($credentials['refresh_token'])->toBe('linear-refresh-2');

    Http::assertSent(fn (Request $request) => $request->url() === LinearClient::TokenUrl
        && $request['grant_type'] === 'refresh_token'
        && $request['refresh_token'] === 'linear-refresh'
        && $request['client_id'] === 'linear-client'
        && $request['client_secret'] === 'linear-secret'
        && str_contains($request->header('Content-Type')[0] ?? '', 'application/x-www-form-urlencoded'));
    Http::assertSent(fn (Request $request) => $request->url() === LinearClient::GraphqlUrl
        && $request->hasHeader('Authorization', 'Bearer linear-access-2'));
});

it('refreshes a Linear token once after a 401 and retries the query', function () {
    Http::fake([
        'api.linear.app/oauth/token' => Http::response(['access_token' => 'linear-access-2', 'refresh_token' => 'linear-refresh-2', 'expires_in' => 86399, 'scope' => 'read write']),
        'api.linear.app/graphql' => Http::sequence()
            ->push(['errors' => [['message' => 'Authentication required', 'extensions' => ['code' => 'AUTHENTICATION_ERROR']]]], 401)
            ->push(['data' => ['viewer' => ['id' => 'u1']]])
            ->push(['errors' => [['message' => 'Authentication required', 'extensions' => ['code' => 'AUTHENTICATION_ERROR']]]], 401)
            ->push(['errors' => [['message' => 'Authentication required', 'extensions' => ['code' => 'AUTHENTICATION_ERROR']]]], 401),
    ]);
    $credentials = ['access_token' => 'linear-access', 'refresh_token' => 'linear-refresh', 'expires_at' => now()->addHour()->getTimestamp()];
    $retried = TeamIntegration::factory()->linear()->create(['credentials' => $credentials]);
    $revoked = TeamIntegration::factory()->linear()->create(['credentials' => $credentials]);
    $linear = app(LinearClient::class);

    expect($linear->query($retried, 'query { viewer { id } }'))->toBe(['viewer' => ['id' => 'u1']])
        ->and($retried->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and($retried->fresh()->credential('access_token'))->toBe('linear-access-2')
        ->and(fn () => $linear->query($revoked, 'query { viewer { id } }'))->toThrow(ReconnectRequired::class)
        ->and($revoked->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);

    Http::assertSent(fn (Request $request) => $request->url() === LinearClient::GraphqlUrl
        && $request->hasHeader('Authorization', 'Bearer linear-access-2'));
});

it('keeps a transaction usable when a database cache lock is contended', function () {
    $store = Cache::store('database');
    $otherWorker = $store->lock('integration-token:contended', 10);
    $otherWorker->get();

    try {
        $acquired = DB::transaction(function () use ($store): bool {
            $acquired = $store->lock('integration-token:contended', 10)->get();

            TeamIntegration::factory()->linear()->create();

            return $acquired;
        });
    } finally {
        $otherWorker->release();
    }

    expect($acquired)->toBeFalse()
        ->and(TeamIntegration::query()->count())->toBe(1);
});
