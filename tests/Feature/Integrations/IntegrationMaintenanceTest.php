<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\IntegrationUserMapping;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram, IntegrationProvider::Jira, IntegrationProvider::Linear);
});

function testIntegration(User $user, TeamIntegration $integration): TestResponse
{
    return test()->actingAs($user)->postJson(route('teams.integrations.test.store', [$integration->team->workspace, $integration->team, $integration]));
}

function disconnectIntegration(User $user, TeamIntegration $integration): TestResponse
{
    return test()->actingAs($user)->deleteJson(route('teams.integrations.destroy', [$integration->team->workspace, $integration->team, $integration]));
}

it('sends a test message to Slack and Telegram', function () {
    Http::fake([
        'hooks.slack.com/*' => Http::response('ok'),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]]),
    ]);
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    $telegram = TeamIntegration::factory()->telegram()->create(['team_id' => $team->id]);

    testIntegration($admin, $slack)->assertOk()->assertJsonPath('status', 'active');
    testIntegration($admin, $telegram)->assertOk();

    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://hooks.slack.com/') && $request['text'] === 'skrum is connected.');
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/sendMessage') && $request['text'] === 'skrum is connected.');
    expect($slack->fresh()->last_checked_at)->not->toBeNull();
});

it('checks Jira and Linear connections', function () {
    Http::fake([
        'api.atlassian.com/oauth/token/accessible-resources' => Http::response([['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme']]),
        'api.linear.app/graphql' => Http::response(['data' => ['viewer' => ['id' => 'u1']]]),
    ]);
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);

    testIntegration($admin, TeamIntegration::factory()->jira()->create(['team_id' => $team->id]))->assertOk();
    testIntegration($admin, TeamIntegration::factory()->linear()->create(['team_id' => $team->id]))->assertOk();
});

it('reports failed tests with the matching status', function () {
    Http::fake([
        'hooks.slack.com/*' => Http::response('no_service', 404),
        'api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => 502, 'description' => 'Bad Gateway'], 502),
    ]);
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    $telegram = TeamIntegration::factory()->telegram()->create(['team_id' => $team->id]);

    testIntegration($admin, $slack)->assertStatus(409)->assertJsonPath('message', 'Reconnect Slack in the team settings.');
    testIntegration($admin, $telegram)->assertStatus(502)->assertJsonPath('message', 'Telegram did not respond. Try again later.');
    testIntegration($admin, $slack->fresh())->assertStatus(409);

    expect($slack->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($telegram->fresh()->status)->toBe(IntegrationStatus::Active);
});

it('refuses tests and disconnections to members', function () {
    $team = Team::factory()->create();
    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    $member = teamMember($team);

    testIntegration($member, $slack)->assertForbidden();
    disconnectIntegration($member, $slack)->assertForbidden();
});

it('answers 404 for a disabled provider', function () {
    $team = Team::factory()->create();
    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);

    testIntegration(integrationAdmin($team), $slack)->assertNotFound();
});

it('revokes access when disconnecting', function (Closure $makeIntegration, Closure $fakes, ?string $revokeUrl) {
    Http::fake($fakes());
    $team = Team::factory()->create();
    $integration = $makeIntegration($team);
    IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id]);

    disconnectIntegration(integrationAdmin($team), $integration)->assertNoContent();

    expect(TeamIntegration::query()->count())->toBe(0)
        ->and(IntegrationUserMapping::query()->count())->toBe(0);

    if ($revokeUrl === null) {
        Http::assertNothingSent();

        return;
    }

    Http::assertSent(fn (Request $request) => str_contains($request->url(), $revokeUrl));
})->with([
    'slack' => [fn (Team $team) => TeamIntegration::factory()->slack()->create(['team_id' => $team->id]), fn () => ['slack.com/api/auth.revoke' => Http::response(['ok' => true])], 'slack.com/api/auth.revoke'],
    'slack revoke failing' => [fn (Team $team) => TeamIntegration::factory()->slack()->create(['team_id' => $team->id]), fn () => ['slack.com/api/auth.revoke' => Http::response('down', 500)], 'slack.com/api/auth.revoke'],
    'telegram' => [fn (Team $team) => TeamIntegration::factory()->telegram()->create(['team_id' => $team->id]), fn () => ['api.telegram.org/*' => Http::response(['ok' => true, 'result' => true])], '/leaveChat'],
    'linear' => [fn (Team $team) => TeamIntegration::factory()->linear()->create(['team_id' => $team->id]), fn () => ['api.linear.app/oauth/revoke' => Http::response('', 200)], 'api.linear.app/oauth/revoke'],
    'jira' => [fn (Team $team) => TeamIntegration::factory()->jira()->create(['team_id' => $team->id]), fn () => [], null],
]);

it('checks every active connection daily', function () {
    Http::fake([
        'slack.com/api/auth.test' => fn (Request $request) => $request->hasHeader('Authorization', 'Bearer xoxp-revoked')
            ? Http::response(['ok' => false, 'error' => 'token_revoked'])
            : Http::response(['ok' => true]),
        'api.atlassian.com/oauth/token/accessible-resources' => Http::response([['id' => 'cloud-2', 'url' => 'https://beta.atlassian.net', 'name' => 'Beta']]),
        'api.linear.app/graphql' => Http::response('down', 503),
    ]);
    $healthy = TeamIntegration::factory()->slack()->create();
    $revoked = TeamIntegration::factory()->slack()->create([
        'credentials' => ['webhook_url' => 'https://hooks.slack.com/services/T000/B000/YYYY', 'access_token' => 'xoxp-revoked'],
    ]);
    $movedSite = TeamIntegration::factory()->jira()->create();
    $unreachable = TeamIntegration::factory()->linear()->create();
    $alreadyBroken = TeamIntegration::factory()->slack()->reconnectRequired()->create();

    $this->artisan('skrum:check-integrations')
        ->expectsOutput('Checked 4 integrations: 1 ok, 2 need reconnecting, 1 unreachable.')
        ->assertSuccessful();

    expect($healthy->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and($healthy->fresh()->last_checked_at)->not->toBeNull()
        ->and($revoked->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($movedSite->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($movedSite->fresh()->last_error)->toBe('This Jira site is no longer accessible.')
        ->and($unreachable->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and($alreadyBroken->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});

it('skips connections of disabled providers', function () {
    disableIntegrations();
    TeamIntegration::factory()->slack()->create();

    $this->artisan('skrum:check-integrations')
        ->expectsOutput('Checked 0 integrations: 0 ok, 0 need reconnecting, 0 unreachable.')
        ->assertSuccessful();

    Http::assertNothingSent();
});

it('runs the connection check daily on one server', function () {
    $event = collect(app(Schedule::class)->events())
        ->first(fn (ScheduledEvent $event) => str_contains((string) $event->command, 'skrum:check-integrations'));

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('0 0 * * *')
        ->and($event->onOneServer)->toBeTrue();
});
