<?php

use App\Actions\Integrations\PokerTaskSync;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;

const JiraDataCenterPastedToken = 'pasted-jira-token-abcdefghijklmnop';

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::JiraDataCenter);
});

/**
 * @param  array<string, mixed>  $body
 */
function postJiraDataCenterToken(User $user, Team $team, array $body = []): TestResponse
{
    return test()->actingAs($user)->postJson(
        route('teams.integrations.jiraDataCenterToken.store', [$team->workspace, $team]),
        ['token' => '  '.JiraDataCenterPastedToken.'  ', 'access' => 'write', 'acknowledged' => true, ...$body],
    );
}

/**
 * @param  array<int, int>  $versionNumbers
 */
function fakeJiraDataCenterTokenCheck(int $myselfStatus = 200, array $versionNumbers = [8, 20, 1]): void
{
    Http::fake([
        jiraDataCenterUrl('rest/api/2/myself') => Http::response(['name' => 'jdoe', 'displayName' => 'Jane Doe', 'emailAddress' => 'jane@example.com'], $myselfStatus),
        jiraDataCenterUrl('rest/api/2/serverInfo') => Http::response(['serverTitle' => 'Acme Jira', 'version' => implode('.', $versionNumbers), 'versionNumbers' => $versionNumbers]),
        jiraDataCenterUrl('rest/api/2/field') => Http::response([]),
    ]);
}

it('saves a personal access token that acts as its owner', function () {
    fakeJiraDataCenterTokenCheck();
    $team = Team::factory()->create();

    $response = postJiraDataCenterToken(integrationAdmin($team), $team)
        ->assertCreated()
        ->assertJsonPath('provider', 'jira_dc')
        ->assertJsonPath('access', 'write')
        ->assertJsonPath('settings.authMethod', 'pat')
        ->assertJsonPath('settings.tokenOwner', 'Jane Doe')
        ->assertJsonPath('settings.serverTitle', 'Acme Jira')
        ->assertJsonPath('settings.version', '8.20.1');

    $integration = TeamIntegration::query()->sole();

    expect($response->getContent())->not->toContain(JiraDataCenterPastedToken)
        ->and($response->json('settings.tokenSavedAt'))->toBeString()
        ->and($integration->credential('personalAccessToken'))->toBe(JiraDataCenterPastedToken)
        ->and((string) DB::table('team_integrations')->value('credentials'))->not->toContain(JiraDataCenterPastedToken)
        ->and($integration->setting('tokenOwner'))->toBe(['name' => 'jdoe', 'displayName' => 'Jane Doe'])
        ->and($integration->scopes)->toBe([]);

    foreach (['rest/api/2/myself', 'rest/api/2/serverInfo', 'rest/api/2/field'] as $path) {
        Http::assertSent(fn (Request $request) => $request->url() === "https://jira.example.com/{$path}"
            && $request->hasHeader('Authorization', 'Bearer '.JiraDataCenterPastedToken));
    }
});

it('requires the acknowledgement that the token acts as a person', function () {
    $team = Team::factory()->create();

    postJiraDataCenterToken(integrationAdmin($team), $team, ['acknowledged' => false])
        ->assertJsonValidationErrors('acknowledged');

    Http::assertNothingSent();
});

it('rejects tokens Jira refuses', function (int $status) {
    fakeJiraDataCenterTokenCheck($status);
    $team = Team::factory()->create();

    postJiraDataCenterToken(integrationAdmin($team), $team)
        ->assertJsonValidationErrors(['token' => "Jira didn't accept this token."]);

    expect(TeamIntegration::query()->count())->toBe(0);
})->with([401, 403]);

it('rejects servers older than Jira 8.14', function () {
    fakeJiraDataCenterTokenCheck(versionNumbers: [8, 13, 5]);
    $team = Team::factory()->create();

    postJiraDataCenterToken(integrationAdmin($team), $team)
        ->assertJsonValidationErrors(['token' => 'Personal access tokens need Jira 8.14 or later.']);
});

it('validates the token length', function (string $token) {
    $team = Team::factory()->create();

    postJiraDataCenterToken(integrationAdmin($team), $team, ['token' => $token])->assertJsonValidationErrors('token');
})->with([
    'too short' => [str_repeat('a', 19)],
    'too long' => [str_repeat('a', 256)],
]);

it('refuses non-admins before validating and answers 404 while tokens are off', function () {
    $team = Team::factory()->create();

    postJiraDataCenterToken(teamMember($team), $team, ['token' => 'x'])->assertForbidden();

    config(['services.jira_dc.personal_tokens' => false]);

    postJiraDataCenterToken(teamMember($team), $team)->assertForbidden();
    postJiraDataCenterToken(integrationAdmin($team), $team)->assertNotFound();
    Http::assertNothingSent();
});

it('never shows the token on the integrations page', function () {
    $team = Team::factory()->create();
    TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Write, 'pat')->create(['team_id' => $team->id]);

    $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.index', [$team->workspace, $team]))
        ->assertOk()
        ->assertDontSee(TeamIntegrationFactory::JiraDataCenterToken)
        ->assertInertia(fn (Assert $page) => $page
            ->where('providers.0.provider', 'jira_dc')
            ->where('providers.0.authMethods', ['oauth', 'pat'])
            ->where('providers.0.connection.settings.tokenOwner', 'Jane Doe')
            ->where('providers.0.connection.settings.tokenSavedAt', '2026-10-01T09:00:00+00:00'));
});

it('offers only the token when OAuth is not configured', function () {
    config(['services.jira_dc.client_id' => null]);
    $team = Team::factory()->create();

    $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.index', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('providers.0.authMethods', ['pat']));
});

it('lets read-only tokens write nothing', function () {
    $integration = TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Read, 'pat')->create();

    expect(PokerTaskSync::writeBackUnavailableReason(IntegrationProvider::JiraDataCenter, $integration))
        ->toBe('This Jira Data Center connection is read-only.');
});

it('asks for a new token once Jira revokes it', function () {
    Http::fake([jiraDataCenterUrl('rest/api/2/myself') => Http::response(['errorMessages' => ['Unauthorized']], 401)]);
    $integration = TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Write, 'pat')->create();

    expect(fn () => app(JiraDataCenterClient::class)->get($integration, 'rest/api/2/myself'))->toThrow(ReconnectRequired::class);

    expect($integration->fresh()?->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()?->last_error)->toBe('The Jira personal access token was revoked or has expired. Paste a new one.');
    Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer '.TeamIntegrationFactory::JiraDataCenterToken));
});

it('stops using stored tokens once they are turned off', function () {
    config(['services.jira_dc.personal_tokens' => false]);
    $integration = TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Write, 'pat')->create();

    expect(fn () => app(JiraDataCenterClient::class)->get($integration, 'rest/api/2/myself'))->toThrow(ReconnectRequired::class);

    Http::assertNothingSent();
});

it('removes the token with the connection', function () {
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Write, 'pat')->create(['team_id' => $team->id]);

    $this->actingAs(integrationAdmin($team))
        ->deleteJson(route('teams.integrations.destroy', [$team->workspace, $team, $integration]))
        ->assertNoContent();

    expect(TeamIntegration::query()->count())->toBe(0);
    Http::assertNothingSent();
});

it('never flashes the token back into the session when validation fails', function () {
    fakeJiraDataCenterTokenCheck(401);
    $team = Team::factory()->create();

    $this->actingAs(integrationAdmin($team))
        ->post(route('teams.integrations.jiraDataCenterToken.store', [$team->workspace, $team]), ['token' => JiraDataCenterPastedToken, 'access' => 'write', 'acknowledged' => '1'])
        ->assertSessionHasErrors('token')
        ->assertSessionHasInput('access', 'write')
        ->assertSessionMissing('_old_input.token');
});

it('answers neutrally when the server does not report its version', function () {
    Http::fake([
        jiraDataCenterUrl('rest/api/2/myself') => Http::response(['name' => 'jdoe', 'displayName' => 'Jane Doe']),
        jiraDataCenterUrl('rest/api/2/serverInfo') => Http::response(['serverTitle' => 'Acme Jira']),
    ]);
    $team = Team::factory()->create();

    postJiraDataCenterToken(integrationAdmin($team), $team)
        ->assertJsonValidationErrors(['token' => "We couldn't read the Jira version."]);

    expect(TeamIntegration::query()->count())->toBe(0);
});

it('saves nothing when checking the token times out or the server fails', function (mixed $answer) {
    Http::fake([
        jiraDataCenterUrl('rest/api/2/myself') => $answer,
        jiraDataCenterUrl('rest/api/2/serverInfo') => Http::response(['versionNumbers' => [8, 20, 1]]),
    ]);
    $team = Team::factory()->create();

    $response = postJiraDataCenterToken(integrationAdmin($team), $team);

    expect($response->isSuccessful())->toBeFalse()
        ->and($response->getContent())->not->toContain(JiraDataCenterPastedToken)
        ->and(TeamIntegration::query()->count())->toBe(0);
})->with([
    'timeout' => [fn () => Http::failedConnection('cURL error 28: Operation timed out')],
    'server error' => [fn () => Http::response(['message' => 'Internal error'], 500)],
]);
