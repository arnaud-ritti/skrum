<?php

use App\Enums\IntegrationProvider;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Support\Integrations\Telegram\TelegramBot;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => Http::preventStrayRequests());

function integrationsPageUrl(Team $team): string
{
    return route('teams.integrations.index', [$team->workspace, $team]);
}

it('does not exist while no provider is configured', function () {
    $team = Team::factory()->create();

    $this->actingAs(integrationAdmin($team))->get(integrationsPageUrl($team))->assertNotFound();
});

it('is reserved to workspace owners and admins', function () {
    enableIntegrations(IntegrationProvider::Slack);
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))->get(integrationsPageUrl($team))->assertForbidden();
});

it('lists the enabled providers with their connection', function () {
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Jira);
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id, 'connected_by_user_id' => $admin->id, 'last_checked_at' => now()]);
    TeamIntegration::factory()->linear()->create(['team_id' => $team->id]);

    $response = $this->actingAs($admin)->get(integrationsPageUrl($team));

    $response->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('teams/integrations')
        ->where('team.id', $team->id)
        ->has('providers', 2)
        ->where('providers.0.provider', 'slack')
        ->where('providers.0.label', 'Slack')
        ->where('providers.0.usesOAuth', true)
        ->where('providers.0.isTracker', false)
        ->where('providers.0.connection.status', 'active')
        ->where('providers.0.connection.statusLabel', 'Connected')
        ->where('providers.0.connection.access', 'write')
        ->where('providers.0.connection.connectedBy', $admin->name)
        ->where('providers.0.connection.settings', [
            'teamName' => 'Acme',
            'channelName' => '#retros',
            'configurationUrl' => 'https://acme.slack.com/services/B000',
        ])
        ->where('providers.1.provider', 'jira')
        ->where('providers.1.connection', null)
        ->where('telegram', null));

    expect($response->getContent())->not->toContain('xoxp-test-token')
        ->and($response->getContent())->not->toContain('hooks.slack.com/services')
        ->and($response->getContent())->not->toContain('channelId');
});

it('shows the Telegram bot and a polling conflict', function () {
    enableIntegrations(IntegrationProvider::Telegram);
    Http::fake(['api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']])]);
    resolve(TelegramBot::class)->markConflict();
    $team = Team::factory()->create();

    $this->actingAs(integrationAdmin($team))->get(integrationsPageUrl($team))
        ->assertInertia(fn (Assert $page) => $page
            ->where('telegram.botUsername', 'skrum_test_bot')
            ->where('telegram.conflict', true));
});

it('exposes the Telegram chat the team is connected to', function () {
    enableIntegrations(IntegrationProvider::Telegram);
    Http::fake(['api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']])]);
    $team = Team::factory()->create();
    TeamIntegration::factory()->telegram()->create(['team_id' => $team->id]);

    $this->actingAs(integrationAdmin($team))->get(integrationsPageUrl($team))
        ->assertInertia(fn (Assert $page) => $page->where('providers.0.connection.settings', [
            'chatId' => '-100123',
            'chatTitle' => 'Team chat',
            'chatType' => 'supergroup',
        ]));
});

it('renders integrations whose credentials cannot be decrypted', function () {
    enableIntegrations(IntegrationProvider::Slack);
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    $otherKey = new Encrypter(Encrypter::generateKey((string) config('app.cipher')), (string) config('app.cipher'));
    DB::table('team_integrations')->where('id', $integration->id)->update(['credentials' => $otherKey->encrypt('{}', false)]);

    $this->actingAs(integrationAdmin($team))->get(integrationsPageUrl($team))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('providers.0.connection.id', $integration->id));
});

it('offers the integrations link to managers only when a provider is configured', function () {
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    $member = teamMember($team);
    $teamPage = route('teams.show', [$team->workspace, $team]);

    $this->actingAs($admin)->get($teamPage)->assertInertia(fn (Assert $page) => $page->where('canManageIntegrations', false));

    enableIntegrations(IntegrationProvider::Linear);

    $this->actingAs($admin)->get($teamPage)->assertInertia(fn (Assert $page) => $page->where('canManageIntegrations', true));
    $this->actingAs($member)->get($teamPage)->assertInertia(fn (Assert $page) => $page->where('canManageIntegrations', false));
});

it('shares whether a provider is configured, for the "Team settings" entry of the sidebar', function () {
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    $teamPage = route('teams.show', [$team->workspace, $team]);

    $this->actingAs($admin)->get($teamPage)->assertInertia(fn (Assert $page) => $page->where('features.integrations', false));

    enableIntegrations(IntegrationProvider::Linear);

    $this->actingAs($admin)->get($teamPage)->assertInertia(fn (Assert $page) => $page->where('features.integrations', true));
});
