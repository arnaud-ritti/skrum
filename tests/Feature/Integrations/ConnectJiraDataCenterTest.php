<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use App\Support\Integrations\OAuthState;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::JiraDataCenter);
});

function fakeJiraDataCenterOAuth(): void
{
    Http::fake([
        jiraDataCenterUrl('rest/oauth2/latest/token') => Http::response([
            'access_token' => 'jira-dc-access-new',
            'refresh_token' => 'jira-dc-refresh-new',
            'expires_in' => 7200,
            'token_type' => 'bearer',
            'scope' => 'WRITE',
        ]),
        jiraDataCenterUrl('rest/api/2/serverInfo') => Http::response(['serverTitle' => 'Acme Jira', 'version' => '9.12.2', 'versionNumbers' => [9, 12, 2]]),
        jiraDataCenterUrl('rest/api/2/field') => Http::response([
            ['id' => 'customfield_10002', 'name' => 'Story Points', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.atlassian.jira.plugin.system.customfieldtypes:float']],
        ]),
        jiraDataCenterUrl('rest/api/2/myself') => Http::response(['name' => 'jdoe', 'displayName' => 'Jane Doe']),
    ]);
}

/**
 * @param  array<string, mixed>|null  $session
 */
function jiraDataCenterCallback(User $user, Team $team, IntegrationAccess $access = IntegrationAccess::Write, ?array $session = null): TestResponse
{
    return test()->actingAs($user)
        ->withSession($session ?? integrationOAuthSession($team, IntegrationProvider::JiraDataCenter, $access))
        ->get(route('integrations.jiraDataCenter.callback', ['code' => 'jira-dc-code', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu']));
}

it('asks Jira Data Center for read or write access with PKCE', function (string $access, string $scope) {
    $team = Team::factory()->create();

    $response = $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.connect', [$team->workspace, $team, 'jira_dc', 'access' => $access]));

    $location = (string) $response->headers->get('Location');
    parse_str((string) parse_url($location, PHP_URL_QUERY), $query);

    expect($location)->toStartWith('https://jira.example.com/rest/oauth2/latest/authorize?')
        ->and($query['scope'])->toBe($scope)
        ->and($query['client_id'])->toBe('jira-dc-client')
        ->and($query['redirect_uri'])->toEndWith('/integrations/jira-dc/callback')
        ->and($query['code_challenge_method'])->toBe('S256')
        ->and($query['code_challenge'])->toBe(OAuthState::challenge((string) session('integrations.oauth.codeVerifier')))
        ->and(session('integrations.oauth.codeVerifier'))->toHaveLength(64);
})->with([
    'read' => ['read', 'READ'],
    'write' => ['write', 'WRITE'],
]);

it('connects with OAuth and exchanges the code with its verifier', function () {
    fakeJiraDataCenterOAuth();
    $team = Team::factory()->create();

    jiraDataCenterCallback(integrationAdmin($team), $team)
        ->assertInertiaFlash('toast', ['type' => 'success', 'message' => 'Jira Data Center connected.']);

    $integration = TeamIntegration::query()->sole();

    expect($integration->provider)->toBe(IntegrationProvider::JiraDataCenter)
        ->and($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->access)->toBe(IntegrationAccess::Write)
        ->and($integration->credential('access_token'))->toBe('jira-dc-access-new')
        ->and($integration->site())->toBe(JiraDataCenterServer::key())
        ->and($integration->setting('authMethod'))->toBe('oauth')
        ->and($integration->setting('baseUrl'))->toBe('https://jira.example.com')
        ->and($integration->setting('serverTitle'))->toBe('Acme Jira')
        ->and($integration->setting('version'))->toBe('9.12.2')
        ->and($integration->setting('storyPointFields'))->toBe([['id' => 'customfield_10002', 'name' => 'Story Points']]);

    Http::assertSent(fn (Request $request) => $request->url() === 'https://jira.example.com/rest/oauth2/latest/token'
        && $request['grant_type'] === 'authorization_code'
        && $request['code'] === 'jira-dc-code'
        && $request['code_verifier'] === str_repeat('v', 64)
        && str_ends_with((string) $request['redirect_uri'], '/integrations/jira-dc/callback'));
    Http::assertSent(fn (Request $request) => $request->url() === 'https://jira.example.com/rest/api/2/serverInfo'
        && $request->hasHeader('Authorization', 'Bearer jira-dc-access-new'));
});

it('refuses a callback without a code verifier', function () {
    $team = Team::factory()->create();
    $session = integrationOAuthSession($team, IntegrationProvider::JiraDataCenter);
    unset($session[OAuthState::SessionKey]['codeVerifier']);

    jiraDataCenterCallback(integrationAdmin($team), $team, session: $session)
        ->assertInertiaFlash('toast', ['type' => 'error', 'message' => 'Could not connect Jira Data Center. Try again.']);

    expect(TeamIntegration::query()->count())->toBe(0);
    Http::assertNothingSent();
});

it('replaces a personal access token when connecting with OAuth', function () {
    fakeJiraDataCenterOAuth();
    $team = Team::factory()->create();
    $existing = TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Write, 'pat')->create(['team_id' => $team->id]);
    $existing->forceFill(['settings' => [...$existing->settings, 'priorityMap' => ['high' => null]]])->save();

    jiraDataCenterCallback(integrationAdmin($team), $team)->assertRedirect();

    $integration = $existing->fresh();

    expect($integration?->credential('personalAccessToken'))->toBeNull()
        ->and($integration?->credential('access_token'))->toBe('jira-dc-access-new')
        ->and($integration?->setting('authMethod'))->toBe('oauth')
        ->and($integration?->setting('tokenOwner'))->toBeNull()
        ->and($integration?->setting('tokenSavedAt'))->toBeNull()
        ->and($integration?->setting('priorityMap'))->toBe(['high' => null]);
});

it('refreshes an expiring Data Center token', function () {
    fakeJiraDataCenterOAuth();
    $integration = TeamIntegration::factory()->jiraDataCenter()->expiring()->create();

    app(JiraDataCenterClient::class)->get($integration, 'rest/api/2/myself');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://jira.example.com/rest/oauth2/latest/token'
        && $request['grant_type'] === 'refresh_token'
        && $request['refresh_token'] === 'jira-dc-refresh'
        && $request['client_secret'] === 'jira-dc-secret');
    Http::assertSent(fn (Request $request) => $request->url() === 'https://jira.example.com/rest/api/2/myself'
        && $request->hasHeader('Authorization', 'Bearer jira-dc-access-new'));
    expect($integration->fresh()?->credential('refresh_token'))->toBe('jira-dc-refresh-new');
});

it('never sends credentials to another Jira server than the configured one', function () {
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    config(['services.jira_dc.base_url' => 'https://jira.other.example.com']);

    expect(fn () => app(JiraDataCenterClient::class)->get($integration, 'rest/api/2/myself'))
        ->toThrow(ReconnectRequired::class);

    expect($integration->fresh()?->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()?->last_error)->toBe('skrum is now configured for another Jira server. Reconnect.');
    Http::assertNothingSent();
});

it('does not follow redirects from the Jira server', function () {
    Http::fake([jiraDataCenterUrl('rest/api/2/myself') => Http::response('', 302, ['Location' => 'https://evil.example.com/steal'])]);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();

    expect(fn () => app(JiraDataCenterClient::class)->get($integration, 'rest/api/2/myself'))
        ->toThrow(ProviderRejected::class);

    Http::assertSentCount(1);
});

it('offers OAuth only when it is configured, after authorizing', function () {
    config(['services.jira_dc.client_id' => null]);
    $team = Team::factory()->create();
    $url = route('teams.integrations.connect', [$team->workspace, $team, 'jira_dc']);

    $this->actingAs(teamMember($team))->get($url)->assertForbidden();
    $this->actingAs(integrationAdmin($team))->get($url)->assertNotFound();
});

it('checks a Data Center connection with its myself endpoint', function () {
    fakeJiraDataCenterOAuth();
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->jiraDataCenter()->create(['team_id' => $team->id]);

    $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertJsonPath('provider', 'jira_dc');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://jira.example.com/rest/api/2/myself'
        && $request->hasHeader('Authorization', 'Bearer jira-dc-access'));
});
