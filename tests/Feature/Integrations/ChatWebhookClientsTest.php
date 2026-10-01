<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Exceptions\Integrations\ProviderRejected;
use App\Exceptions\Integrations\ProviderUnavailable;
use App\Exceptions\Integrations\RateLimited;
use App\Exceptions\Integrations\ReconnectRequired;
use App\Models\TeamIntegration;
use App\Rules\MattermostWebhookUrl;
use App\Rules\MicrosoftTeamsWebhookUrl;
use App\Support\Integrations\IntegrationErrors;
use App\Support\Integrations\Mattermost\MattermostClient;
use App\Support\Integrations\MicrosoftTeams\MicrosoftTeamsClient;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost);
});

function teamsIntegration(): TeamIntegration
{
    return TeamIntegration::factory()->microsoftTeams()->create();
}

function mattermostIntegration(): TeamIntegration
{
    return TeamIntegration::factory()->mattermost()->create();
}

it('accepts only Teams workflow URLs', function (string $url, bool $valid) {
    expect(MicrosoftTeamsWebhookUrl::isValid($url))->toBe($valid);
})->with([
    'logic apps' => [TeamIntegrationFactory::MicrosoftTeamsUrl, true],
    'power platform' => ['https://default1a2b.3c.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/abc/triggers/manual/paths/invoke?sig=x', true],
    'http' => ['http://prod-12.westeurope.logic.azure.com/workflows/abc', false],
    'other port' => ['https://prod-12.westeurope.logic.azure.com:8443/workflows/abc', false],
    'user info' => ['https://user:pass@prod-12.westeurope.logic.azure.com/workflows/abc', false],
    'suffix trick' => ['https://prod-12.logic.azure.com.evil.example/workflows/abc', false],
    'bare domain' => ['https://logic.azure.com/workflows/abc', false],
    'query trick' => ['https://evil.example/?next=x.logic.azure.com', false],
    'unlisted host' => ['https://teams-proxy.example.com/hook', false],
    'not a url' => ['teams', false],
]);

it('accepts Teams hosts the instance allows', function () {
    config(['services.msteams.allowed_hosts' => ['teams-proxy.example.com']]);

    expect(MicrosoftTeamsWebhookUrl::isValid('https://teams-proxy.example.com/hook'))->toBeTrue()
        ->and(MicrosoftTeamsWebhookUrl::isValid('https://other.example.com/hook'))->toBeFalse();
});

it('accepts only incoming webhooks of the configured Mattermost server', function (string $url, bool $valid) {
    expect(MattermostWebhookUrl::isValid($url))->toBe($valid);
})->with([
    'webhook' => [TeamIntegrationFactory::MattermostUrl, true],
    'digits' => ['https://chat.example.com/hooks/abc123def456ghi789jkl012mn', true],
    '25 characters' => ['https://chat.example.com/hooks/abcdefghijklmnopqrstuvwxy', false],
    '27 characters' => ['https://chat.example.com/hooks/abcdefghijklmnopqrstuvwxyza', false],
    'other server' => ['https://evil.example.com/hooks/abcdefghijklmnopqrstuvwxyz', false],
    'http' => ['http://chat.example.com/hooks/abcdefghijklmnopqrstuvwxyz', false],
    'api path' => ['https://chat.example.com/api/v4/hooks/abcdefghijklmnopqrstuvwxyz', false],
    'query' => ['https://chat.example.com/hooks/abcdefghijklmnopqrstuvwxyz?x=1', false],
    'server prefix trick' => ['https://chat.example.com.evil.example/hooks/abcdefghijklmnopqrstuvwxyz', false],
]);

it('accepts Mattermost servers under a context path', function () {
    config(['services.mattermost.url' => 'https://example.com/mattermost']);

    expect(MattermostWebhookUrl::isValid('https://example.com/mattermost/hooks/abcdefghijklmnopqrstuvwxyz'))->toBeTrue()
        ->and(MattermostWebhookUrl::isValid(TeamIntegrationFactory::MattermostUrl))->toBeFalse();
});

it('posts Teams messages to the stored workflow URL', function () {
    Http::fake(['prod-12.westeurope.logic.azure.com/*' => Http::response('', 202)]);

    resolve(MicrosoftTeamsClient::class)->postMessage(teamsIntegration(), ['type' => 'message', 'attachments' => []]);

    Http::assertSent(fn (Request $request) => $request->url() === str_replace(':443', '', TeamIntegrationFactory::MicrosoftTeamsUrl)
        && $request['type'] === 'message');
});

it('asks to paste a new Teams URL when the workflow is gone', function (int $status) {
    Http::fake(['prod-12.westeurope.logic.azure.com/*' => Http::response('{"error":{"code":"WorkflowNotFound"}}', $status)]);
    $integration = teamsIntegration();

    expect(fn () => resolve(MicrosoftTeamsClient::class)->postMessage($integration, ['type' => 'message']))
        ->toThrow(ReconnectRequired::class)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->last_error)->toBe('The Teams workflow URL no longer works. Paste a new one.');
})->with([400, 401, 403, 404]);

it('maps Teams rate limits, outages and redirects', function () {
    $integration = teamsIntegration();

    Http::fakeSequence('prod-12.westeurope.logic.azure.com/*')
        ->push('', 429, ['Retry-After' => '12'])
        ->push('', 503)
        ->push('', 302, ['Location' => 'https://evil.example/'])
        ->push('', 202);

    $rateLimited = null;

    try {
        resolve(MicrosoftTeamsClient::class)->postMessage($integration, ['type' => 'message']);
    } catch (RateLimited $exception) {
        $rateLimited = $exception;
    }

    expect($rateLimited?->retryAfter)->toBe(12)
        ->and(fn () => resolve(MicrosoftTeamsClient::class)->postMessage($integration, ['type' => 'message']))->toThrow(ProviderUnavailable::class)
        ->and(fn () => resolve(MicrosoftTeamsClient::class)->postMessage($integration, ['type' => 'message']))->toThrow(ProviderRejected::class);

    Http::assertSentCount(3);
    expect($integration->fresh()->status)->toBe(IntegrationStatus::Active);
});

it('refuses a stored URL the instance no longer allows without calling it', function () {
    config(['services.msteams.allowed_hosts' => ['teams-proxy.example.com']]);
    $teams = TeamIntegration::factory()->microsoftTeams()->create(['credentials' => ['url' => 'https://teams-proxy.example.com/hook']]);
    $mattermost = mattermostIntegration();
    config(['services.msteams.allowed_hosts' => [], 'services.mattermost.url' => 'https://mattermost.example.org']);

    expect(fn () => resolve(MicrosoftTeamsClient::class)->postMessage($teams, ['type' => 'message']))->toThrow(ReconnectRequired::class)
        ->and(fn () => resolve(MattermostClient::class)->postMessage($mattermost, 'hello'))->toThrow(ReconnectRequired::class);

    Http::assertNothingSent();
    expect($teams->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($mattermost->fresh()->last_error)->toBe('The Mattermost webhook no longer works. Paste a new one.');
});

it('posts Mattermost messages as text', function () {
    Http::fake(['chat.example.com/*' => Http::response('ok')]);

    resolve(MattermostClient::class)->postMessage(mattermostIntegration(), '**hello**');

    Http::assertSent(fn (Request $request) => $request->url() === TeamIntegrationFactory::MattermostUrl
        && $request->data() === ['text' => '**hello**']);
});

it('asks to paste a new Mattermost webhook only when it is gone', function (int $status, string $body, bool $reconnect) {
    Http::fake(['chat.example.com/*' => Http::response($body, $status)]);
    $integration = mattermostIntegration();

    expect(fn () => resolve(MattermostClient::class)->postMessage($integration, 'hello'))
        ->toThrow($reconnect ? ReconnectRequired::class : ProviderRejected::class)
        ->and($integration->fresh()->status)->toBe($reconnect ? IntegrationStatus::ReconnectRequired : IntegrationStatus::Active);
})->with([
    'invalid webhook' => [400, '{"id":"web.incoming_webhook.invalid.app_error","message":"Invalid webhook"}', true],
    'other 400' => [400, '{"message":"Unable to parse incoming data"}', false],
    'forbidden' => [403, '', true],
    'not found' => [404, '', true],
]);

it('retries Mattermost outages', function () {
    Http::fake(['chat.example.com/*' => Http::response('', 503)]);

    expect(fn () => resolve(MattermostClient::class)->postMessage(mattermostIntegration(), 'hello'))->toThrow(ProviderUnavailable::class);
});

it('never exposes webhook keys in errors', function () {
    Http::fake(['*' => Http::failedConnection('cURL error 28: timed out for '.TeamIntegrationFactory::MicrosoftTeamsUrl.' and '.TeamIntegrationFactory::MattermostUrl)]);
    $unavailable = null;

    try {
        resolve(MicrosoftTeamsClient::class)->postMessage(teamsIntegration(), ['type' => 'message']);
    } catch (ProviderUnavailable $exception) {
        $unavailable = $exception;
    }

    expect($unavailable?->timedOut)->toBeTrue()
        ->and($unavailable?->detail())->toContain('prod-12.westeurope.logic.azure.com')
        ->and($unavailable?->detail())->not->toContain('teams-signature')
        ->and($unavailable?->detail())->not->toContain('workflows/abc123')
        ->and($unavailable?->detail())->not->toContain('abcdefghijklmnopqrstuvwxyz')
        ->and(IntegrationErrors::sanitize('POST '.TeamIntegrationFactory::MattermostUrl.' failed'))
        ->toBe('POST https://chat.example.com/hooks/*** failed')
        ->and(IntegrationErrors::sanitize('POST '.TeamIntegrationFactory::MicrosoftTeamsUrl.' failed'))
        ->toBe('POST https://prod-12.westeurope.logic.azure.com:443/*** failed');
});
