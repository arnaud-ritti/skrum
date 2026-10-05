<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Jobs\MatchIntegrationUsers;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\OAuthState;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Slack);
});

function fakeSlackOAuth(string $webhook = 'https://hooks.slack.com/services/T111/B222/secret'): void
{
    Http::fake(['slack.com/api/oauth.v2.access' => Http::response([
        'ok' => true,
        'access_token' => 'xoxp-new-token',
        'scope' => 'incoming-webhook',
        'team' => ['id' => 'T111', 'name' => 'Acme'],
        'incoming_webhook' => [
            'channel' => '#retros',
            'channel_id' => 'C222',
            'configuration_url' => 'https://acme.slack.com/services/B222',
            'url' => $webhook,
        ],
    ])]);
}

/**
 * @param  array<string, string>  $query
 * @param  array<string, mixed>|null  $session
 */
function slackCallback(User $user, Team $team, array $query = ['code' => 'the-code', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu'], ?array $session = null): TestResponse
{
    return test()->actingAs($user)
        ->withSession($session ?? integrationOAuthSession($team, IntegrationProvider::Slack))
        ->get(route('integrations.callback', ['provider' => 'slack', ...$query]));
}

it('sends admins to Slack with a single-use state', function () {
    $team = Team::factory()->create();

    $response = $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.connect', [$team->workspace, $team, 'slack']));

    $location = (string) $response->headers->get('Location');
    parse_str((string) parse_url($location, PHP_URL_QUERY), $query);
    $stored = session(OAuthState::SessionKey);

    expect($location)->toStartWith('https://slack.com/oauth/v2/authorize?')
        ->and($query['scope'])->toBe('incoming-webhook')
        ->and($query['redirect_uri'])->toBe(config('services.slack.redirect'))
        ->and(strlen($query['state']))->toBe(40)
        ->and($stored['state'])->toBe($query['state'])
        ->and($stored['provider'])->toBe('slack')
        ->and($stored['teamId'])->toBe($team->id)
        ->and($stored['access'])->toBe('write');
});

it('refuses to start a connection for members or disabled providers', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->get(route('teams.integrations.connect', [$team->workspace, $team, 'slack']))
        ->assertForbidden();

    disableIntegrations();

    $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.connect', [$team->workspace, $team, 'slack']))
        ->assertNotFound();
});

it('connects the channel chosen on Slack', function () {
    Queue::fake();
    fakeSlackOAuth();
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);

    slackCallback($admin, $team)
        ->assertRedirect(route('teams.integrations.index', [$team->workspace, $team]))
        ->assertInertiaFlash('toast', ['type' => 'success', 'message' => 'Slack connected.']);

    $integration = TeamIntegration::query()->sole();

    expect($integration->team_id)->toBe($team->id)
        ->and($integration->provider)->toBe(IntegrationProvider::Slack)
        ->and($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->access)->toBe(IntegrationAccess::Write)
        ->and($integration->connected_by_user_id)->toBe($admin->id)
        ->and($integration->scopes)->toBe(['incoming-webhook'])
        ->and($integration->settings)->toBe([
            'teamId' => 'T111',
            'teamName' => 'Acme',
            'channelId' => 'C222',
            'channelName' => '#retros',
            'configurationUrl' => 'https://acme.slack.com/services/B222',
        ])
        ->and($integration->credential('webhook_url'))->toBe('https://hooks.slack.com/services/T111/B222/secret')
        ->and($integration->credential('access_token'))->toBe('xoxp-new-token');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://slack.com/api/oauth.v2.access'
        && $request['code'] === 'the-code'
        && $request['client_secret'] === 'slack-secret');
    Queue::assertNotPushed(MatchIntegrationUsers::class);
    expect(session()->has(OAuthState::SessionKey))->toBeFalse();
});

it('reconnects on the same row', function () {
    fakeSlackOAuth();
    $team = Team::factory()->create();
    $existing = TeamIntegration::factory()->slack()->reconnectRequired()->create(['team_id' => $team->id]);

    slackCallback(integrationAdmin($team), $team)->assertRedirect();

    $integration = TeamIntegration::query()->sole();

    expect($integration->id)->toBe($existing->id)
        ->and($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->last_error)->toBeNull()
        ->and($integration->setting('channelName'))->toBe('#retros');
});

it('refuses callbacks with a bad state', function (array $query, ?Closure $session) {
    fakeSlackOAuth();
    $team = Team::factory()->create();

    slackCallback(integrationAdmin($team), $team, $query, $session === null ? null : $session($team))
        ->assertRedirect(route('teams.integrations.index', [$team->workspace, $team]))
        ->assertInertiaFlash('toast', ['type' => 'error', 'message' => 'Could not connect Slack. Try again.']);

    expect(TeamIntegration::query()->count())->toBe(0);
    Http::assertNothingSent();
})->with([
    'state mismatch' => [['code' => 'c', 'state' => 'another-state'], null],
    'provider error' => [['error' => 'access_denied', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu'], null],
    'missing code' => [['state' => 'oauth-state-0123456789abcdefghijklmnopqrstu'], null],
    'expired state' => [['code' => 'c', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu'], fn (Team $team) => integrationOAuthSession($team, IntegrationProvider::Slack, expiresInMinutes: -1)],
    'state of another provider' => [['code' => 'c', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu'], fn (Team $team) => integrationOAuthSession($team, IntegrationProvider::Jira)],
]);

it('accepts a state only once', function () {
    fakeSlackOAuth();
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);

    slackCallback($admin, $team)->assertRedirect();

    $this->actingAs($admin)
        ->get(route('integrations.callback', ['provider' => 'slack', 'code' => 'the-code', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu']))
        ->assertRedirect(route('dashboard'));

    Http::assertSentCount(1);
});

it('refuses a callback once the user cannot manage the team', function () {
    fakeSlackOAuth();
    $team = Team::factory()->create();

    slackCallback(teamMember($team), $team)
        ->assertRedirect(route('dashboard'))
        ->assertInertiaFlash('toast', ['type' => 'error', 'message' => 'Could not connect Slack. Try again.']);

    expect(TeamIntegration::query()->count())->toBe(0);
});

it('refuses a webhook outside hooks.slack.com', function () {
    fakeSlackOAuth('https://evil.test/hook');
    $team = Team::factory()->create();

    slackCallback(integrationAdmin($team), $team)
        ->assertInertiaFlash('toast', ['type' => 'error', 'message' => 'Slack did not return a valid channel webhook. Try again.']);

    expect(TeamIntegration::query()->count())->toBe(0);
});

it('reports a refused code exchange', function () {
    Http::fake(['slack.com/api/oauth.v2.access' => Http::response(['ok' => false, 'error' => 'invalid_code'])]);
    $team = Team::factory()->create();

    slackCallback(integrationAdmin($team), $team)
        ->assertInertiaFlash('toast', ['type' => 'error', 'message' => 'Could not connect Slack. Try again.']);

    expect(TeamIntegration::query()->count())->toBe(0);
});
