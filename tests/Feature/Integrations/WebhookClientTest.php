<?php

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\IntegrationDelivery;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Exceptions\UnsafeWebhookUrl;
use App\Support\Integrations\Webhook\SafeWebhookUrl;
use App\Support\Integrations\Webhook\WebhookClient;
use App\Support\Integrations\Webhook\WebhookHealth;
use App\Support\Integrations\Webhook\WebhookMessage;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Webhook);
    outgoingWebhookResolves();
});

function outgoingWebhookDelivery(TeamIntegration $integration): IntegrationDelivery
{
    return IntegrationDelivery::factory()->create([
        'team_id' => $integration->team_id,
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::Event,
        'event' => 'action_item.created',
        'team_integration_id' => $integration->id,
        'requested_by_user_id' => null,
    ]);
}

function outgoingWebhookMessage(string $id = 'delivery-1'): WebhookMessage
{
    return new WebhookMessage($id, 'action_item.created', '2026-10-07T10:00:00Z', [
        'actionItem' => ['id' => 'item-1', 'content' => 'Fix the deploy'],
    ]);
}

it('signs a versioned JSON envelope', function () {
    $this->travelTo(Carbon::parse('2026-10-07 10:00:05', 'UTC'));
    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);
    $integration = TeamIntegration::factory()->webhook()->create();

    app(WebhookClient::class)->send($integration, outgoingWebhookMessage());

    Http::assertSent(fn (Request $request) => $request->url() === TeamIntegrationFactory::WebhookUrl
        && $request->method() === 'POST'
        && $request->header('Content-Type')[0] === 'application/json'
        && $request->header('User-Agent')[0] === 'skrum-webhooks/1'
        && $request->header('X-Skrum-Event')[0] === 'action_item.created'
        && $request->header('X-Skrum-Delivery')[0] === 'delivery-1'
        && $request->header('X-Skrum-Timestamp')[0] === (string) Carbon::parse('2026-10-07 10:00:05', 'UTC')->getTimestamp()
        && outgoingWebhookSignatureIsValid($request)
        && json_decode($request->body(), true) === [
            'version' => 1,
            'id' => 'delivery-1',
            'event' => 'action_item.created',
            'occurredAt' => '2026-10-07T10:00:00Z',
            'sentAt' => '2026-10-07T10:00:05Z',
            'team' => ['id' => $integration->team->id, 'name' => $integration->team->name],
            'data' => ['actionItem' => ['id' => 'item-1', 'content' => 'Fix the deploy']],
        ]);
});

it('computes the documented signature', function () {
    expect(WebhookClient::signature('secret', 1700000000, '{"a":1}'))
        ->toBe('sha256='.hash_hmac('sha256', '1700000000.{"a":1}', 'secret'));
});

it('pins the connection to the vetted address and never follows redirects', function () {
    $options = app(WebhookClient::class)
        ->pendingRequest(app(SafeWebhookUrl::class)->resolve(TeamIntegrationFactory::WebhookUrl))
        ->getOptions();

    expect($options['curl'][CURLOPT_RESOLVE])->toBe(['hooks.example.com:443:93.184.216.34'])
        ->and($options['allow_redirects'])->toBeFalse()
        ->and($options['timeout'])->toBe(10);
});

it('records attempts and resets the failure counter on success', function () {
    Http::fakeSequence('hooks.example.com/*')->push('', 503)->push('', 200);
    $integration = TeamIntegration::factory()->webhook()->create();
    $integration->forceFill(['consecutive_failures' => 4])->save();
    $delivery = outgoingWebhookDelivery($integration);

    expect(fn () => app(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery))
        ->toThrow(ProviderUnavailable::class);
    expect($delivery->fresh()->attempts)->toBe(1)
        ->and($delivery->fresh()->response_status)->toBe(503)
        ->and($integration->fresh()->consecutive_failures)->toBe(4);

    app(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery->fresh());

    expect($delivery->fresh()->attempts)->toBe(2)
        ->and($delivery->fresh()->response_status)->toBe(200)
        ->and($delivery->fresh()->last_attempt_at)->not->toBeNull()
        ->and($integration->fresh()->consecutive_failures)->toBe(0)
        ->and($integration->fresh()->last_delivery_succeeded_at)->not->toBeNull();
});

it('maps receiver answers without reading their bodies', function (int $status, string $exception) {
    Http::fake(['hooks.example.com/*' => Http::response('internal stack trace', $status, ['Location' => 'http://169.254.169.254/'])]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $caught = null;

    try {
        app(WebhookClient::class)->send($integration, outgoingWebhookMessage());
    } catch (Throwable $thrown) {
        $caught = $thrown;
    }

    expect($caught)->toBeInstanceOf($exception)
        ->and($caught?->getMessage())->toBe("The receiver answered {$status}.")
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::Active);
    Http::assertSentCount(1);
})->with([
    'not found' => [404, ProviderRejected::class],
    'redirect' => [302, ProviderRejected::class],
    'server error' => [500, ProviderUnavailable::class],
]);

it('caps Retry-After at one hour', function (string $retryAfter, int $expected) {
    Http::fake(['hooks.example.com/*' => Http::response('', 429, ['Retry-After' => $retryAfter])]);
    $rateLimited = null;

    try {
        app(WebhookClient::class)->send(TeamIntegration::factory()->webhook()->create(), outgoingWebhookMessage());
    } catch (RateLimited $exception) {
        $rateLimited = $exception;
    }

    expect($rateLimited?->retryAfter)->toBe($expected);
})->with([
    'short' => ['12', 12],
    'long' => ['7200', 3600],
]);

it('disables the webhook when the receiver answers 410', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 410)]);
    $integration = TeamIntegration::factory()->webhook()->create();

    expect(fn () => app(WebhookClient::class)->send($integration, outgoingWebhookMessage()))
        ->toThrow(ReconnectRequired::class, 'The receiver asked skrum to stop.');

    $fresh = $integration->fresh();

    expect($fresh->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($fresh->setting('disabledReason'))->toBe(WebhookHealth::GoneReason)
        ->and($fresh->last_error)->toBe('The receiver asked skrum to stop.');
});

it('keeps only the host of connection errors', function () {
    Http::fake(['*' => Http::failedConnection('cURL error 7: Failed to connect to '.TeamIntegrationFactory::WebhookUrl.'?token=abc')]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDelivery($integration);
    $unavailable = null;

    try {
        app(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery);
    } catch (ProviderUnavailable $exception) {
        $unavailable = $exception;
    }

    expect($unavailable?->timedOut)->toBeTrue()
        ->and($unavailable?->detail())->toBe('Could not reach hooks.example.com.')
        ->and($delivery->fresh()->attempts)->toBe(1)
        ->and($delivery->fresh()->response_status)->toBeNull();
});

it('refuses an endpoint that became private without calling it', function () {
    outgoingWebhookResolves(['10.0.0.1']);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDelivery($integration);

    expect(fn () => app(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery))
        ->toThrow(UnsafeWebhookUrl::class);

    Http::assertNothingSent();
    expect($delivery->fresh()->attempts)->toBe(1)
        ->and($delivery->fresh()->last_attempt_at)->not->toBeNull()
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::Active);
});

it('retries instead of failing when the host cannot be resolved at send time', function () {
    outgoingWebhookResolves([]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDelivery($integration);
    $caught = null;

    try {
        app(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery);
    } catch (Throwable $thrown) {
        $caught = $thrown;
    }

    Http::assertNothingSent();
    expect($caught)->toBeInstanceOf(ProviderUnavailable::class)
        ->and($caught->getMessage())->toBe('Could not reach hooks.example.com.')
        ->and($integration->fresh()->consecutive_failures)->toBe(0)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::Active);
});

it('records the attempt when the signing secret is missing', function () {
    $integration = TeamIntegration::factory()->webhook()->create();
    $integration->forceFill(['credentials' => ['url' => TeamIntegrationFactory::WebhookUrl]])->save();
    $delivery = outgoingWebhookDelivery($integration);

    expect(fn () => app(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery))
        ->toThrow(ReconnectRequired::class);

    expect($delivery->fresh()->attempts)->toBe(1)
        ->and($delivery->fresh()->last_attempt_at)->not->toBeNull()
        ->and($delivery->fresh()->response_status)->toBeNull();
});

it('builds the test message', function () {
    $message = WebhookMessage::test();

    expect($message->event)->toBe('webhook.test')
        ->and($message->data)->toBe(['message' => 'skrum is connected.'])
        ->and(str($message->id)->isUuid())->toBeTrue();
});

it('disables after 10 failures in a row without a success in 24 hours', function (int $previous, ?int $successHoursAgo, bool $disabled) {
    $integration = TeamIntegration::factory()->webhook()->create();
    $integration->forceFill([
        'consecutive_failures' => $previous,
        'last_delivery_succeeded_at' => $successHoursAgo === null ? null : now()->subHours($successHoursAgo),
    ])->save();

    app(WebhookHealth::class)->failed($integration);

    $fresh = $integration->fresh();

    expect($fresh->consecutive_failures)->toBe($previous + 1)
        ->and($fresh->status)->toBe($disabled ? IntegrationStatus::ReconnectRequired : IntegrationStatus::Active)
        ->and($fresh->setting('disabledReason'))->toBe($disabled ? WebhookHealth::FailuresReason : null)
        ->and($fresh->last_error)->toBe($disabled ? 'Disabled after 10 failed deliveries in a row.' : null);
})->with([
    'ninth failure' => [8, null, false],
    'tenth failure' => [9, null, true],
    'tenth after an old success' => [9, 30, true],
    'tenth after a recent success' => [9, 2, false],
    'eleventh once the success is older than a day' => [10, 25, true],
]);

it('stops counting while disabled and re-enables with a clean slate', function () {
    $integration = TeamIntegration::factory()->webhook()->reconnectRequired('Disabled after 10 failed deliveries in a row.')->create();
    $integration->forceFill([
        'consecutive_failures' => 10,
        'settings' => [...$integration->settings, 'disabledReason' => WebhookHealth::FailuresReason],
    ])->save();

    app(WebhookHealth::class)->failed($integration);

    expect($integration->fresh()->consecutive_failures)->toBe(10);

    app(WebhookHealth::class)->reenable($integration->fresh());

    $fresh = $integration->fresh();

    expect($fresh->status)->toBe(IntegrationStatus::Active)
        ->and($fresh->consecutive_failures)->toBe(0)
        ->and($fresh->last_error)->toBeNull()
        ->and(array_key_exists('disabledReason', $fresh->settings))->toBeFalse()
        ->and($fresh->setting('events'))->toBe([]);
});

it('resolves the endpoint again before every send', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);
    $integration = TeamIntegration::factory()->webhook()->create();

    app(WebhookClient::class)->send($integration, outgoingWebhookMessage());

    outgoingWebhookResolves(['169.254.169.254']);

    expect(fn () => app(WebhookClient::class)->send($integration, outgoingWebhookMessage()))
        ->toThrow(UnsafeWebhookUrl::class);

    Http::assertSentCount(1);
});

it('never leaks the url or the secret through errors', function () {
    Http::fake(['*' => Http::failedConnection('cURL error 7: '.TeamIntegrationFactory::WebhookUrl.' '.TeamIntegrationFactory::WebhookSecret)]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDelivery($integration);
    $caught = null;

    try {
        app(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery);
    } catch (ProviderUnavailable $exception) {
        $caught = $exception;
    }

    expect($caught?->getMessage())->not->toContain('hooks.example.com/skrum')
        ->and($caught?->getMessage())->not->toContain(TeamIntegrationFactory::WebhookSecret)
        ->and($caught?->getPrevious())->toBeNull();
});

it('resets the failure counter even when the loaded model still holds zero', function () {
    $integration = TeamIntegration::factory()->webhook()->create();
    $stale = TeamIntegration::find($integration->id);
    TeamIntegration::whereKey($integration->id)->update(['consecutive_failures' => 5]);

    app(WebhookHealth::class)->succeeded($stale);

    expect($integration->fresh()->consecutive_failures)->toBe(0)
        ->and($integration->fresh()->last_delivery_succeeded_at)->not->toBeNull();
});

it('uses one clock reading for the timestamp header and the sent-at field', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);
    $integration = TeamIntegration::factory()->webhook()->create();

    app(WebhookClient::class)->send($integration, outgoingWebhookMessage());

    Http::assertSent(function (Request $request) {
        $sentAt = Carbon::parse(json_decode($request->body(), true)['sentAt'])->getTimestamp();

        return (string) $sentAt === $request->header('X-Skrum-Timestamp')[0];
    });
});

it('keeps concurrent settings edits and explains a 410 even when already disabled', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 410)]);
    $integration = TeamIntegration::factory()->webhook()->reconnectRequired('Disabled after 10 failed deliveries in a row.')->create();
    $stale = TeamIntegration::find($integration->id);
    $integration->forceFill(['settings' => [...$integration->settings, 'events' => ['retro.completed']]])->save();

    expect(fn () => app(WebhookClient::class)->send($stale, outgoingWebhookMessage()))
        ->toThrow(ReconnectRequired::class);

    $fresh = $integration->fresh();

    expect($fresh->setting('events'))->toBe(['retro.completed'])
        ->and($fresh->setting('disabledReason'))->toBe(WebhookHealth::GoneReason)
        ->and($fresh->last_error)->toBe('The receiver asked skrum to stop.');
});

it('explains a missing signing secret', function () {
    $integration = TeamIntegration::factory()->webhook()->create();
    $integration->forceFill(['credentials' => ['url' => TeamIntegrationFactory::WebhookUrl]])->save();
    $caught = null;

    try {
        app(WebhookClient::class)->send($integration, outgoingWebhookMessage());
    } catch (ReconnectRequired $exception) {
        $caught = $exception;
    }

    expect($caught?->getMessage())->toBe('The signing secret is missing. Rotate it to continue.')
        ->and($integration->fresh()->last_error)->toBe('The signing secret is missing. Rotate it to continue.');
});

it('flags a missing stored url during the check', function () {
    $integration = TeamIntegration::factory()->webhook()->create();
    $integration->forceFill(['credentials' => ['webhookSecret' => TeamIntegrationFactory::WebhookSecret]])->save();

    expect(fn () => app(WebhookClient::class)->ensureUsableUrl($integration))->toThrow(ReconnectRequired::class);
    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});

it('discards the response body instead of buffering it', function () {
    $options = app(WebhookClient::class)
        ->pendingRequest(app(SafeWebhookUrl::class)->resolve(TeamIntegrationFactory::WebhookUrl))
        ->getOptions();

    expect($options['curl'][CURLOPT_WRITEFUNCTION]('handle', 'abcdef'))->toBe(6);
});
