<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Exceptions\Integrations\ProviderUnavailable;
use App\Exceptions\Integrations\RateLimited;
use App\Exceptions\Integrations\ReconnectRequired;
use App\Models\TeamIntegration;
use App\Support\Integrations\Slack\SlackClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('posts messages to the stored webhook', function () {
    Http::fake(['hooks.slack.com/*' => Http::response('ok')]);
    $integration = TeamIntegration::factory()->slack()->create();

    resolve(SlackClient::class)->postMessage($integration, ['text' => 'Hello']);

    Http::assertSent(fn (Request $request) => $request->url() === 'https://hooks.slack.com/services/T000/B000/XXXX'
        && $request['text'] === 'Hello');
});

it('requires a reconnect when the channel is gone', function (int $status, string $body) {
    Http::fake(['hooks.slack.com/*' => Http::response($body, $status)]);
    $integration = TeamIntegration::factory()->slack()->create();

    expect(fn () => resolve(SlackClient::class)->postMessage($integration, ['text' => 'Hello']))
        ->toThrow(ReconnectRequired::class)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->last_error)->toBe($body);
})->with([
    'no service' => [404, 'no_service'],
    'channel not found' => [404, 'channel_not_found'],
    'action prohibited' => [403, 'action_prohibited'],
    'general channel' => [403, 'posting_to_general_channel_denied'],
    'archived' => [410, 'channel_is_archived'],
]);

it('keeps the connection on rate limits and server errors', function () {
    Http::fake(['hooks.slack.com/*' => Http::sequence()
        ->push('rate_limited', 429, ['Retry-After' => '30'])
        ->push('internal_error', 500)]);
    $integration = TeamIntegration::factory()->slack()->create();
    $slack = resolve(SlackClient::class);

    try {
        $slack->postMessage($integration, ['text' => 'Hello']);
        $this->fail('No exception was thrown.');
    } catch (RateLimited $exception) {
        expect($exception->retryAfter)->toBe(30);
    }

    expect(fn () => $slack->postMessage($integration, ['text' => 'Hello']))->toThrow(ProviderUnavailable::class)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::Active);
});

it('refuses a webhook outside hooks.slack.com without calling it', function () {
    $integration = TeamIntegration::factory()->slack()->create();
    $integration->forceFill(['credentials' => ['webhook_url' => 'https://evil.test/hook', 'access_token' => 'xoxp-test-token']])->save();

    expect(fn () => resolve(SlackClient::class)->postMessage($integration, ['text' => 'Hello']))->toThrow(ReconnectRequired::class);

    Http::assertNothingSent();
});

it('checks the token with auth.test', function () {
    Http::fake(['slack.com/api/auth.test' => Http::response(['ok' => true, 'team' => 'Acme'])]);
    $integration = TeamIntegration::factory()->slack()->create();

    resolve(SlackClient::class)->authTest($integration);

    Http::assertSent(fn (Request $request) => $request->url() === 'https://slack.com/api/auth.test'
        && $request->hasHeader('Authorization', 'Bearer xoxp-test-token'));
});

it('requires a reconnect when auth.test refuses the token', function (string $error) {
    Http::fake(['slack.com/api/auth.test' => Http::response(['ok' => false, 'error' => $error])]);
    $integration = TeamIntegration::factory()->slack()->create();

    expect(fn () => resolve(SlackClient::class)->authTest($integration))->toThrow(ReconnectRequired::class)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
})->with(['invalid_auth', 'token_revoked', 'account_inactive']);

it('revokes the token on a best-effort basis', function () {
    Http::fake(['slack.com/api/auth.revoke' => Http::response('down', 500)]);
    $integration = TeamIntegration::factory()->slack()->create();

    resolve(SlackClient::class)->revoke($integration);

    Http::assertSentCount(1);
});

it('builds the authorization URL with the webhook scope', function () {
    enableIntegrations(IntegrationProvider::Slack);

    $url = resolve(SlackClient::class)->authorizationUrl('state-value');

    parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

    expect($url)->toStartWith('https://slack.com/oauth/v2/authorize?')
        ->and($query)->toMatchArray([
            'client_id' => 'slack-client',
            'scope' => 'incoming-webhook',
            'redirect_uri' => config('services.slack.redirect'),
            'state' => 'state-value',
        ]);
});
