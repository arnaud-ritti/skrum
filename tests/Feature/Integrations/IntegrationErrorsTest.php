<?php

use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\IntegrationException;
use App\Exceptions\Integrations\NotConnected;
use App\Exceptions\Integrations\ProviderRejected;
use App\Exceptions\Integrations\ProviderUnavailable;
use App\Exceptions\Integrations\RateLimited;
use App\Exceptions\Integrations\ReadOnlyConnection;
use App\Exceptions\Integrations\ReconnectRequired;
use App\Exceptions\Integrations\TelegramConflict;
use App\Support\Integrations\IntegrationErrors;
use App\Support\Integrations\ProviderHttp;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

function providerFailureFor(string $path): IntegrationException
{
    try {
        ProviderHttp::fail(IntegrationProvider::Jira, Http::get("https://provider.test/{$path}"));
    } catch (IntegrationException $exception) {
        return $exception;
    }

    throw new RuntimeException('ProviderHttp::fail() did not throw.');
}

it('removes secrets from provider errors', function (string $raw, string $expected) {
    expect(IntegrationErrors::sanitize($raw))->toBe($expected);
})->with([
    'query string' => [
        'GET https://api.atlassian.com/ex/jira/abc/rest/api/3/search?jql=secret&code=x failed',
        'GET https://api.atlassian.com/ex/jira/abc/rest/api/3/search failed',
    ],
    'url credentials' => [
        'GET https://admin:hunter2@jira.example.com/rest/api/2/myself failed',
        'GET https://***@jira.example.com/rest/api/2/myself failed',
    ],
    'basic auth' => [
        'Authorization: Basic YWRtaW46aHVudGVyMg== was refused',
        'Authorization: Basic *** was refused',
    ],
    'token, password and api key fields' => [
        'token=abc123 password=hunter2 api_key=k-1 {"token":"t-2","password":"p-3","api_key":"k-4"}',
        'token=*** password=*** api_key=*** {"token":"***","password":"***","api_key":"***"}',
    ],
    'slack webhook' => [
        'POST https://hooks.slack.com/services/T0/B0/XYZ returned 404',
        'POST https://hooks.slack.com/*** returned 404',
    ],
    'telegram bot token' => [
        'cURL error 28 for https://api.telegram.org/bot123456:ABC-def_ghi/getUpdates',
        'cURL error 28 for https://api.telegram.org/bot***/getUpdates',
    ],
    'bearer header' => ['Authorization: Bearer abc.def.ghi rejected', 'Authorization: Bearer *** rejected'],
    'slack token' => ['token xoxp-1234-abcd was revoked', 'token xox*** was revoked'],
    'json access token' => ['{"access_token":"abc123","ok":false}', '{"access_token":"***","ok":false}'],
    'json spaced refresh token' => ['{"refresh_token": "r-1"}', '{"refresh_token": "***"}'],
    'json client secret' => ['{"client_secret":"s3cr3t","client_id":"id"}', '{"client_secret":"***","client_id":"id"}'],
    'json authorization header' => ['{"Authorization":"Bearer abc.def"}', '{"Authorization":"Bearer ***"}'],
    'word that ends with bot' => ['abbot12:xyz stays', 'abbot12:xyz stays'],
    'form secrets' => ['body client_secret=s3cr3t&refresh_token=r1&grant_type=refresh_token', 'body client_secret=***&refresh_token=***&grant_type=refresh_token'],
]);

it('keeps sanitized errors within 500 characters', function () {
    $sanitized = IntegrationErrors::sanitize(str_repeat('a', 800));

    expect(mb_strlen($sanitized))->toBe(500)
        ->and($sanitized)->toEndWith('...');
});

it('renders integration failures as translated JSON errors', function () {
    $cases = [
        [new ReconnectRequired(IntegrationProvider::Slack, 'token_revoked'), 409, 'Reconnect Slack in the team settings.'],
        [new NotConnected(IntegrationProvider::Jira), 409, 'Connect Jira in the team settings.'],
        [new ReadOnlyConnection(IntegrationProvider::Linear), 409, 'This Linear connection is read-only.'],
        [new RateLimited(IntegrationProvider::Jira, 12), 429, 'Too many requests to Jira, wait a moment.'],
        [new ProviderUnavailable(IntegrationProvider::Telegram), 502, 'Telegram did not respond. Try again later.'],
        [new ProviderRejected(IntegrationProvider::Jira, 'The JQL is invalid.'), 422, 'The JQL is invalid.'],
        [new TelegramConflict, 409, 'The Telegram bot is used elsewhere. Remove its webhook or use a dedicated bot.'],
    ];

    foreach ($cases as [$exception, $status, $message]) {
        $response = $exception->render(request());

        expect($response->getStatusCode())->toBe($status)
            ->and($response->getData(true))->toBe(['message' => $message]);
    }
});

it('maps provider responses to integration failures', function () {
    Http::fake([
        'provider.test/rate' => Http::response(['message' => 'slow down'], 429, ['Retry-After' => '12']),
        'provider.test/down' => Http::response('oops', 503),
        'provider.test/auth' => Http::response(['message' => 'expired'], 401),
        'provider.test/bad' => Http::response(['errorMessages' => ['The JQL is invalid.'], 'errors' => ['assignee' => 'Not assignable']], 400),
    ]);

    $rateLimited = providerFailureFor('rate');
    $unavailable = providerFailureFor('down');
    $reconnect = providerFailureFor('auth');
    $rejected = providerFailureFor('bad');

    expect($rateLimited)->toBeInstanceOf(RateLimited::class)
        ->and($rateLimited->retryAfter)->toBe(12)
        ->and($unavailable)->toBeInstanceOf(ProviderUnavailable::class)
        ->and($unavailable->timedOut)->toBeFalse()
        ->and($reconnect)->toBeInstanceOf(ReconnectRequired::class)
        ->and($reconnect->detail())->toBe('expired')
        ->and($rejected)->toBeInstanceOf(ProviderRejected::class)
        ->and($rejected->detail())->toBe('The JQL is invalid.')
        ->and($rejected->httpStatus)->toBe(400)
        ->and($rejected->errors)->toBe(['assignee' => 'Not assignable']);
});

it('reports connection failures without the requested URL secrets', function () {
    Http::fake(['api.telegram.org/*' => Http::failedConnection('cURL error 28 for https://api.telegram.org/bot123456:telegram-token/getMe')]);

    try {
        ProviderHttp::send(IntegrationProvider::Telegram, fn () => Http::get('https://api.telegram.org/bot123456:telegram-token/getMe'));
        $this->fail('No exception was thrown.');
    } catch (ProviderUnavailable $exception) {
        expect($exception->timedOut)->toBeTrue()
            ->and($exception->getMessage())->not->toContain('telegram-token')
            ->and($exception->getPrevious())->toBeNull();
    }
});
