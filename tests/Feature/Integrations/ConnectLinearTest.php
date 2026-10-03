<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\Integrations\IntegrationActivated;
use App\Jobs\MatchIntegrationUsers;
use App\Models\IntegrationUserMapping;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::Linear);
});

/**
 * @param  array<string, string>  $organization
 */
function fakeLinearOAuth(array $organization = ['id' => 'org-1', 'name' => 'Acme', 'urlKey' => 'acme']): void
{
    Http::fake([
        'api.linear.app/oauth/token' => Http::response([
            'access_token' => 'linear-access-new',
            'token_type' => 'Bearer',
            'expires_in' => 86399,
            'refresh_token' => 'linear-refresh-new',
            'scope' => 'read write',
        ]),
        'api.linear.app/graphql' => Http::response(['data' => ['viewer' => ['organization' => $organization]]]),
    ]);
}

function linearCallback(User $user, Team $team, IntegrationAccess $access = IntegrationAccess::Write): TestResponse
{
    return test()->actingAs($user)
        ->withSession(integrationOAuthSession($team, IntegrationProvider::Linear, $access))
        ->get(route('integrations.callback', ['provider' => 'linear', 'code' => 'linear-code', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu']));
}

it('sends admins to Linear with the requested scopes', function () {
    $team = Team::factory()->create();

    $response = $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.connect', [$team->workspace, $team, 'linear', 'access' => 'read']));

    parse_str((string) parse_url((string) $response->headers->get('Location'), PHP_URL_QUERY), $query);

    expect((string) $response->headers->get('Location'))->toStartWith('https://linear.app/oauth/authorize?')
        ->and($query['scope'])->toBe('read')
        ->and($query['actor'])->toBe('user');
});

it('connects the Linear workspace', function () {
    Event::fake([IntegrationActivated::class]);
    fakeLinearOAuth();
    $team = Team::factory()->create();

    linearCallback(integrationAdmin($team), $team)
        ->assertInertiaFlash('toast', ['type' => 'success', 'message' => 'Linear connected.']);

    $integration = TeamIntegration::query()->sole();

    expect($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->access)->toBe(IntegrationAccess::Write)
        ->and($integration->scopes)->toBe(['read', 'write'])
        ->and($integration->settings)->toBeIgnoringKeyOrder(['organizationId' => 'org-1', 'organizationName' => 'Acme', 'urlKey' => 'acme'])
        ->and($integration->credential('access_token'))->toBe('linear-access-new')
        ->and($integration->credential('refresh_token'))->toBe('linear-refresh-new')
        ->and($integration->credential('expires_at'))->toBeGreaterThan(now()->getTimestamp());

    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.linear.app/oauth/token'
        && $request['grant_type'] === 'authorization_code'
        && $request['client_secret'] === 'linear-secret'
        && str_contains($request->header('Content-Type')[0] ?? '', 'application/x-www-form-urlencoded'));
    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.linear.app/graphql'
        && $request->hasHeader('Authorization', 'Bearer linear-access-new'));
    Event::assertDispatched(fn (IntegrationActivated $event) => ! $event->siteChanged);
});

it('deletes account mappings when reconnecting to another organization', function () {
    Event::fake([IntegrationActivated::class]);
    fakeLinearOAuth(['id' => 'org-2', 'name' => 'Other', 'urlKey' => 'other']);
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->linear()->create([
        'team_id' => $team->id,
        'settings' => ['organizationId' => 'org-1', 'organizationName' => 'Acme', 'urlKey' => 'acme', 'exportTeamId' => 'team-1'],
    ]);
    IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id]);

    linearCallback(integrationAdmin($team), $team);

    $fresh = $integration->fresh();

    expect($fresh->site())->toBe('org-2')
        ->and($fresh->setting('exportTeamId'))->toBeNull()
        ->and($fresh->userMappings()->count())->toBe(0);
    Event::assertDispatched(fn (IntegrationActivated $event) => $event->siteChanged);
});

it('keeps settings and mappings when reconnecting to the same organization', function () {
    fakeLinearOAuth();
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->linear()->reconnectRequired()->create([
        'team_id' => $team->id,
        'settings' => ['organizationId' => 'org-1', 'organizationName' => 'Acme', 'urlKey' => 'acme', 'exportTeamId' => 'team-1'],
    ]);
    IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id]);

    linearCallback(integrationAdmin($team), $team);

    $fresh = $integration->fresh();

    expect($fresh->status)->toBe(IntegrationStatus::Active)
        ->and($fresh->setting('exportTeamId'))->toBe('team-1')
        ->and($fresh->userMappings()->count())->toBe(1);
    Queue::assertPushed(MatchIntegrationUsers::class);
});
