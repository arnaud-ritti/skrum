<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Rules\MattermostWebhookUrl;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost);
});

/**
 * @return array{0: Team, 1: User}
 */
function urlChannelAdmin(): array
{
    $team = Team::factory()->create();

    return [$team, integrationAdmin($team)];
}

it('connects Microsoft Teams with a pasted workflow URL', function () {
    [$team, $admin] = urlChannelAdmin();

    $response = $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'msteams']), [
            'url' => TeamIntegrationFactory::MicrosoftTeamsUrl,
            'channel_label' => '  #retros  ',
        ]);

    $response->assertCreated()
        ->assertJson([
            'provider' => 'msteams',
            'status' => 'active',
            'access' => 'write',
            'settings' => ['host' => 'prod-12.westeurope.logic.azure.com', 'channelLabel' => '#retros'],
            'connectedBy' => $admin->name,
        ]);

    expect($response->getContent())->not->toContain('teams-signature')->not->toContain('workflows');

    $integration = TeamIntegration::query()->sole();
    expect($integration->credential('url'))->toBe(TeamIntegrationFactory::MicrosoftTeamsUrl)
        ->and($integration->getRawOriginal('credentials'))->not->toContain('teams-signature');
    Http::assertNothingSent();
});

it('connects Mattermost with an incoming webhook of the configured server', function () {
    [$team, $admin] = urlChannelAdmin();

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'mattermost']), ['url' => TeamIntegrationFactory::MattermostUrl])
        ->assertCreated()
        ->assertJson(['provider' => 'mattermost', 'settings' => ['host' => 'chat.example.com', 'channelLabel' => null]]);
});

it('refuses URLs that break the rules', function (string $provider, array $body, string $field, string $message) {
    [$team, $admin] = urlChannelAdmin();

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, $provider]), $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);

    expect(TeamIntegration::query()->count())->toBe(0);
})->with([
    'teams host' => ['msteams', ['url' => 'https://evil.example.com/workflows/abc'], 'url', 'Use the workflow URL from Microsoft Teams.'],
    'teams http' => ['msteams', ['url' => 'http://prod-12.westeurope.logic.azure.com/workflows/abc'], 'url', 'Use the workflow URL from Microsoft Teams.'],
    'mattermost server' => ['mattermost', ['url' => 'https://evil.example.com/hooks/abcdefghijklmnopqrstuvwxyz'], 'url', 'Use an incoming webhook of https://chat.example.com.'],
    'missing url' => ['mattermost', [], 'url', 'The url field is required.'],
    'long label' => ['msteams', ['url' => TeamIntegrationFactory::MicrosoftTeamsUrl, 'channel_label' => str_repeat('a', 81)], 'channel_label', 'The channel label field must not be greater than 80 characters.'],
]);

it('answers 404 while the provider is disabled or not a URL channel', function () {
    [$team, $admin] = urlChannelAdmin();
    config(['services.msteams.enabled' => false]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'msteams']), ['url' => TeamIntegrationFactory::MicrosoftTeamsUrl])
        ->assertNotFound();
    $this->actingAs($admin)
        ->postJson("/w/{$team->workspace->slug}/teams/{$team->id}/integrations/slack", ['url' => 'https://hooks.slack.com/x'])
        ->assertNotFound();
    $this->actingAs($admin)
        ->postJson("/w/{$team->workspace->slug}/teams/{$team->id}/integrations/webhook", ['url' => 'https://example.com/hook'])
        ->assertNotFound();
});

it('is reserved to workspace owners and admins, before validation', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'msteams']), ['url' => 'nope'])
        ->assertForbidden();
});

it('replaces a connection and clears reconnect-required', function () {
    [$team, $admin] = urlChannelAdmin();
    TeamIntegration::factory()->mattermost()->reconnectRequired('The Mattermost webhook no longer works. Paste a new one.')->create(['team_id' => $team->id]);
    $newUrl = 'https://chat.example.com/hooks/zyxwvutsrqponmlkjihgfedcba';

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'mattermost']), ['url' => $newUrl, 'channel_label' => 'dev'])
        ->assertCreated()
        ->assertJson(['status' => 'active', 'lastError' => null, 'settings' => ['channelLabel' => 'dev']]);

    $integration = TeamIntegration::query()->sole();
    expect($integration->credential('url'))->toBe($newUrl);
});

it('updates the channel label or the URL', function () {
    [$team, $admin] = urlChannelAdmin();
    $integration = TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);
    $url = route('teams.integrations.update', [$team->workspace, $team, $integration]);

    $this->actingAs($admin)->patchJson($url, ['channel_label' => 'Planning'])
        ->assertOk()
        ->assertJson(['settings' => ['host' => 'prod-12.westeurope.logic.azure.com', 'channelLabel' => 'Planning']]);

    expect($integration->fresh()->credential('url'))->toBe(TeamIntegrationFactory::MicrosoftTeamsUrl);

    $newUrl = 'https://default1a2b.3c.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/new/triggers/manual/paths/invoke?sig=new';

    $this->actingAs($admin)->patchJson($url, ['url' => $newUrl])
        ->assertOk()
        ->assertJson(['settings' => ['host' => 'default1a2b.3c.environment.api.powerplatform.com', 'channelLabel' => 'Planning']]);
    $this->actingAs($admin)->patchJson($url, ['url' => 'https://evil.example.com/x'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['url' => 'Use the workflow URL from Microsoft Teams.']);

    expect($integration->fresh()->credential('url'))->toBe($newUrl);
});

it('never serializes the stored URL on the integrations page', function () {
    [$team, $admin] = urlChannelAdmin();
    TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->mattermost()->create(['team_id' => $team->id]);

    $this->actingAs($admin)
        ->get(route('teams.integrations.index', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/integrations')
            ->where('providers.0.provider', 'msteams')
            ->where('providers.0.usesOAuth', false)
            ->where('providers.0.connection.settings', ['host' => 'prod-12.westeurope.logic.azure.com', 'channelLabel' => '#retros'])
            ->where('providers.1.provider', 'mattermost')
            ->where('providers.1.connection.settings', ['host' => 'chat.example.com', 'channelLabel' => 'town-square'])
            ->where('mattermost', ['url' => 'https://chat.example.com']))
        ->assertDontSee('teams-signature')
        ->assertDontSee('abcdefghijklmnopqrstuvwxyz');
});

it('sends a test message to each channel', function () {
    [$team, $admin] = urlChannelAdmin();
    $teams = TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);
    $mattermost = TeamIntegration::factory()->mattermost()->create(['team_id' => $team->id]);
    Http::fake([
        'prod-12.westeurope.logic.azure.com/*' => Http::response('', 202),
        'chat.example.com/*' => Http::response('ok'),
    ]);

    $this->actingAs($admin)->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $teams]))->assertOk();
    $this->actingAs($admin)->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $mattermost]))->assertOk();

    Http::assertSent(fn (Request $request) => str_contains($request->url(), 'logic.azure.com')
        && $request['attachments'][0]['content']['body'][0]['text'] === 'skrum is connected.'
        && ! isset($request['attachments'][0]['content']['actions']));
    Http::assertSent(fn (Request $request) => str_contains($request->url(), 'chat.example.com')
        && $request['text'] === 'skrum is connected.');
    expect($teams->fresh()->last_checked_at)->not->toBeNull();
});

it('marks a lost Teams workflow when the test fails', function () {
    [$team, $admin] = urlChannelAdmin();
    $integration = TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);
    Http::fake(['prod-12.westeurope.logic.azure.com/*' => Http::response('', 404)]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $integration]))
        ->assertConflict()
        ->assertJson(['message' => 'Reconnect Microsoft Teams in the team settings.']);

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->last_error)->toBe('The Teams workflow URL no longer works. Paste a new one.');
});

it('disconnects without calling the provider', function () {
    [$team, $admin] = urlChannelAdmin();
    $integration = TeamIntegration::factory()->mattermost()->create(['team_id' => $team->id]);

    $this->actingAs($admin)
        ->deleteJson(route('teams.integrations.destroy', [$team->workspace, $team, $integration]))
        ->assertNoContent();

    expect(TeamIntegration::query()->count())->toBe(0);
    Http::assertNothingSent();
});

it('re-validates stored URLs in the daily check without posting', function () {
    $teams = TeamIntegration::factory()->microsoftTeams()->create();
    $mattermost = TeamIntegration::factory()->mattermost()->create();
    config(['services.mattermost.url' => 'https://mattermost.example.org']);

    $this->artisan('skrum:check-integrations')->assertSuccessful();

    expect($teams->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and($teams->fresh()->last_checked_at)->not->toBeNull()
        ->and($mattermost->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
    Http::assertNothingSent();
});

it('keeps a non-default port in the Mattermost host', function () {
    [$team, $admin] = urlChannelAdmin();
    config(['services.mattermost.url' => 'https://chat.example.com:8065']);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'mattermost']), ['url' => 'https://chat.example.com:8065/hooks/abcdefghijklmnopqrstuvwxyz'])
        ->assertCreated()
        ->assertJson(['settings' => ['host' => 'chat.example.com:8065']]);
});

it('refuses control characters in the channel label on store and update', function () {
    [$team, $admin] = urlChannelAdmin();
    $integration = TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'msteams']), ['url' => TeamIntegrationFactory::MicrosoftTeamsUrl, 'channel_label' => "retros\nplanning"])
        ->assertJsonValidationErrors(['channel_label']);
    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', [$team->workspace, $team, $integration]), ['channel_label' => "a\tb"])
        ->assertJsonValidationErrors(['channel_label']);
});

it('refuses a Mattermost URL with a trailing newline', function () {
    config(['services.mattermost.url' => 'https://chat.example.com']);

    expect(MattermostWebhookUrl::isValid('https://chat.example.com/hooks/abcdefghijklmnopqrstuvwxyz'))->toBeTrue()
        ->and(MattermostWebhookUrl::isValid("https://chat.example.com/hooks/abcdefghijklmnopqrstuvwxyz\n"))->toBeFalse();
});

it('keeps the update route reserved to admins before validation', function () {
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);

    $this->actingAs(teamMember($team))
        ->patchJson(route('teams.integrations.update', [$team->workspace, $team, $integration]), ['channel_label' => str_repeat('a', 500)])
        ->assertForbidden();
});

it('answers 404 on update while the provider is disabled', function () {
    [$team, $admin] = urlChannelAdmin();
    $integration = TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);
    config(['services.msteams.enabled' => false]);

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', [$team->workspace, $team, $integration]), ['channel_label' => 'x'])
        ->assertNotFound();
});

it('refuses a too long channel label on update', function () {
    [$team, $admin] = urlChannelAdmin();
    $integration = TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', [$team->workspace, $team, $integration]), ['channel_label' => str_repeat('a', 81)])
        ->assertJsonValidationErrors(['channel_label' => 'The channel label field must not be greater than 80 characters.']);
});
