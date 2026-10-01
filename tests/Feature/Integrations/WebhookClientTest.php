<?php

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Exceptions\UnsafeWebhookUrl;
use App\Support\Integrations\Webhook\ResponseExcerpt;
use App\Support\Integrations\Webhook\SafeWebhookUrl;
use App\Support\Integrations\Webhook\WebhookClient;
use App\Support\Integrations\Webhook\WebhookHealth;
use App\Support\Integrations\Webhook\WebhookMessage;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Exceptions;
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

function outgoingWebhookDeliveryWithPayload(TeamIntegration $integration): IntegrationDelivery
{
    $delivery = outgoingWebhookDelivery($integration);
    $delivery->payload()->create(['message' => [
        'id' => $delivery->id,
        'event' => 'action_item.created',
        'occurredAt' => '2026-10-07T10:00:00Z',
        'data' => [],
    ]]);

    return $delivery;
}

function outgoingWebhookMessage(string $id = 'delivery-1'): WebhookMessage
{
    return new WebhookMessage($id, 'action_item.created', '2026-10-07T10:00:00Z', [
        'actionItem' => ['id' => 'item-1', 'content' => 'Fix the deploy'],
    ]);
}

it('signs a versioned JSON envelope', function () {
    $this->travelTo(Date::parse('2026-10-07 10:00:05', 'UTC'));
    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);
    $integration = TeamIntegration::factory()->webhook()->create();

    resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage());

    Http::assertSent(fn (Request $request) => $request->url() === TeamIntegrationFactory::WebhookUrl
        && $request->method() === 'POST'
        && $request->header('Content-Type')[0] === 'application/json'
        && $request->header('User-Agent')[0] === 'skrum-webhooks/1'
        && $request->header('X-Skrum-Event')[0] === 'action_item.created'
        && $request->header('X-Skrum-Delivery')[0] === 'delivery-1'
        && $request->header('X-Skrum-Timestamp')[0] === (string) Date::parse('2026-10-07 10:00:05', 'UTC')->getTimestamp()
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
    $options = resolve(WebhookClient::class)
        ->pendingRequest(resolve(SafeWebhookUrl::class)->resolve(TeamIntegrationFactory::WebhookUrl))
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

    expect(fn () => resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery))
        ->toThrow(ProviderUnavailable::class)
        ->and($delivery->fresh()->attempts)->toBe(1)
        ->and($delivery->fresh()->response_status)->toBe(503)
        ->and($integration->fresh()->consecutive_failures)->toBe(4);

    resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery->fresh());

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
        resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage());
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
        resolve(WebhookClient::class)->send(TeamIntegration::factory()->webhook()->create(), outgoingWebhookMessage());
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

    expect(fn () => resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage()))
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
        resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery);
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

    expect(fn () => resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery))
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
        resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery);
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

    expect(fn () => resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery))
        ->toThrow(ReconnectRequired::class)
        ->and($delivery->fresh()->attempts)->toBe(1)
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

    resolve(WebhookHealth::class)->failed($integration);

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

    resolve(WebhookHealth::class)->failed($integration);

    expect($integration->fresh()->consecutive_failures)->toBe(10);

    resolve(WebhookHealth::class)->reenable($integration->fresh());

    $fresh = $integration->fresh();

    expect($fresh->status)->toBe(IntegrationStatus::Active)
        ->and($fresh->consecutive_failures)->toBe(0)
        ->and($fresh->last_error)->toBeNull()
        ->and($fresh->settings)->not->toHaveKey('disabledReason')
        ->and($fresh->setting('events'))->toBe([]);
});

it('resolves the endpoint again before every send', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);
    $integration = TeamIntegration::factory()->webhook()->create();

    resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage());

    outgoingWebhookResolves(['169.254.169.254']);

    expect(fn () => resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage()))
        ->toThrow(UnsafeWebhookUrl::class);

    Http::assertSentCount(1);
});

it('never leaks the url or the secret through errors', function () {
    Http::fake(['*' => Http::failedConnection('cURL error 7: '.TeamIntegrationFactory::WebhookUrl.' '.TeamIntegrationFactory::WebhookSecret)]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDelivery($integration);
    $caught = null;

    try {
        resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery);
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

    resolve(WebhookHealth::class)->succeeded($stale);

    expect($integration->fresh()->consecutive_failures)->toBe(0)
        ->and($integration->fresh()->last_delivery_succeeded_at)->not->toBeNull();
});

it('uses one clock reading for the timestamp header and the sent-at field', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);
    $integration = TeamIntegration::factory()->webhook()->create();

    resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage());

    Http::assertSent(function (Request $request): bool {
        $sentAt = Date::parse(json_decode($request->body(), true)['sentAt'])->getTimestamp();

        return (string) $sentAt === $request->header('X-Skrum-Timestamp')[0];
    });
});

it('keeps concurrent settings edits and explains a 410 even when already disabled', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 410)]);
    $integration = TeamIntegration::factory()->webhook()->reconnectRequired('Disabled after 10 failed deliveries in a row.')->create();
    $stale = TeamIntegration::find($integration->id);
    $integration->forceFill(['settings' => [...$integration->settings, 'events' => ['retro.completed']]])->save();

    expect(fn () => resolve(WebhookClient::class)->send($stale, outgoingWebhookMessage()))
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
        resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage());
    } catch (ReconnectRequired $exception) {
        $caught = $exception;
    }

    expect($caught?->getMessage())->toBe('The signing secret is missing. Rotate it to continue.')
        ->and($integration->fresh()->last_error)->toBe('The signing secret is missing. Rotate it to continue.');
});

it('flags a missing stored url during the check', function () {
    $integration = TeamIntegration::factory()->webhook()->create();
    $integration->forceFill(['credentials' => ['webhookSecret' => TeamIntegrationFactory::WebhookSecret]])->save();

    expect(fn () => resolve(WebhookClient::class)->ensureUsableUrl($integration))->toThrow(ReconnectRequired::class)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});

it('discards the response body instead of buffering it', function () {
    $options = resolve(WebhookClient::class)
        ->pendingRequest(resolve(SafeWebhookUrl::class)->resolve(TeamIntegrationFactory::WebhookUrl))
        ->getOptions();

    expect($options['curl'][CURLOPT_WRITEFUNCTION]('handle', 'abcdef'))->toBe(6);
});

it('keeps what it sent and the start of the answer for a delivery with a stored message', function () {
    $this->travelTo(Date::parse('2026-10-07 10:00:05', 'UTC'));
    Http::fake(['hooks.example.com/*' => Http::response(str_repeat('é', 1500), 500)]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDeliveryWithPayload($integration);

    expect(fn () => resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery))
        ->toThrow(ProviderUnavailable::class);

    $payload = $delivery->payload()->sole();
    $sent = Http::recorded()->first()[0];

    expect($payload->request_body)->toBe($sent->body())
        ->and($payload->request_headers)->toBe([
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
            'User-Agent' => 'skrum-webhooks/1',
            'X-Skrum-Event' => 'action_item.created',
            'X-Skrum-Delivery' => $delivery->id,
            'X-Skrum-Timestamp' => (string) Date::parse('2026-10-07 10:00:05', 'UTC')->getTimestamp(),
            'X-Skrum-Signature' => 'sha256=…'.substr($sent->header('X-Skrum-Signature')[0], -6),
        ])
        ->and($payload->response_status)->toBe(500)
        ->and(strlen((string) $payload->response_excerpt))->toBe(2048)
        ->and((string) $payload->response_excerpt)->toBe(str_repeat('é', 1024));
});

it('masks the signature when the receiver echoes it back', function () {
    Http::fake(['hooks.example.com/*' => fn (Request $request) => Http::response('you sent '.$request->header('X-Skrum-Signature')[0], 400)]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDeliveryWithPayload($integration);

    expect(fn () => resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery))
        ->toThrow(ProviderRejected::class);

    $signature = Http::recorded()->first()[0]->header('X-Skrum-Signature')[0];
    $excerpt = (string) $delivery->payload()->sole()->response_excerpt;

    expect($excerpt)->toBe('you sent sha256=…'.substr($signature, -6))
        ->and($excerpt)->not->toContain($signature);
});

it('masks an echoed signature whatever its letter case', function () {
    Http::fake(['hooks.example.com/*' => fn (Request $request) => Http::response('you sent '.strtoupper($request->header('X-Skrum-Signature')[0]), 400)]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDeliveryWithPayload($integration);

    expect(fn () => resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery))
        ->toThrow(ProviderRejected::class);

    $signature = Http::recorded()->first()[0]->header('X-Skrum-Signature')[0];

    expect((string) $delivery->payload()->sole()->response_excerpt)->toBe('you sent sha256=…'.substr($signature, -6));
});

it('stores nothing for a delivery without a stored message or for a test message', function () {
    Http::fake(['hooks.example.com/*' => Http::response('ok', 200)]);
    $integration = TeamIntegration::factory()->webhook()->create();

    resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage(), outgoingWebhookDelivery($integration));
    resolve(WebhookClient::class)->send($integration, WebhookMessage::test());

    expect(IntegrationDeliveryPayload::query()->count())->toBe(0);
});

it('marks a redelivered message and only that one', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);
    $integration = TeamIntegration::factory()->webhook()->create();

    resolve(WebhookClient::class)->send($integration, new WebhookMessage('delivery-1', 'action_item.created', '2026-10-07T10:00:00Z', [], redelivery: true));
    resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage('delivery-2'));

    Http::assertSent(fn (Request $request) => $request->header('X-Skrum-Delivery')[0] === 'delivery-1'
        && $request->header('X-Skrum-Redelivery')[0] === 'true'
        && outgoingWebhookSignatureIsValid($request));
    Http::assertSent(fn (Request $request) => $request->header('X-Skrum-Delivery')[0] === 'delivery-2'
        && ! $request->hasHeader('X-Skrum-Redelivery'));
});

it('keeps only the first 2 KB of the answer it reads', function () {
    $excerpt = new ResponseExcerpt;
    $options = resolve(WebhookClient::class)
        ->pendingRequest(resolve(SafeWebhookUrl::class)->resolve(TeamIntegrationFactory::WebhookUrl), $excerpt)
        ->getOptions();

    expect($options['curl'][CURLOPT_WRITEFUNCTION]('handle', str_repeat('a', 1500)))->toBe(1500)
        ->and($options['curl'][CURLOPT_WRITEFUNCTION]('handle', str_repeat('b', 1500)))->toBe(1500)
        ->and($excerpt->value())->toBe(str_repeat('a', 1500).str_repeat('b', 548))
        ->and($options['curl'][CURLOPT_RESOLVE])->toBe(['hooks.example.com:443:93.184.216.34'])
        ->and($options['allow_redirects'])->toBeFalse();
});

it('reports a failure to keep the attempt without failing a successful send', function () {
    Exceptions::fake();
    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDeliveryWithPayload($integration);
    IntegrationDeliveryPayload::saving(fn () => throw new LogicException('insert failed with bindings: kept content'));

    resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery);

    Exceptions::assertReported(fn (RuntimeException $exception) => $exception->getMessage() === "Could not keep the webhook attempt of delivery {$delivery->id} (LogicException)."
        && $exception->getPrevious() === null);
    Exceptions::assertNotReported(LogicException::class);
    expect($delivery->fresh()->attempts)->toBe(1)
        ->and($delivery->payload()->sole()->request_body)->toBeNull();
});

it('shows nothing sent when the last attempt failed before sending', function () {
    Http::fake(['hooks.example.com/*' => Http::response('upstream broke', 500)]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDeliveryWithPayload($integration);

    expect(fn () => resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery))
        ->toThrow(ProviderUnavailable::class)
        ->and($delivery->payload()->sole()->response_excerpt)->toBe('upstream broke');

    outgoingWebhookResolves([]);

    expect(fn () => resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery->fresh()))
        ->toThrow(ProviderUnavailable::class);

    $payload = $delivery->payload()->sole();

    Http::assertSentCount(1);
    expect($payload->request_headers)->toBeNull()
        ->and($payload->request_body)->toBeNull()
        ->and($payload->response_status)->toBeNull()
        ->and($payload->response_excerpt)->toBeNull()
        ->and($payload->message['id'])->toBe($delivery->id);
});

it('keeps the request without an answer when the receiver cannot be reached', function () {
    Http::fake(['*' => Http::failedConnection()]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDeliveryWithPayload($integration);

    expect(fn () => resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery))
        ->toThrow(ProviderUnavailable::class);

    $payload = $delivery->payload()->sole();

    expect(json_decode((string) $payload->request_body, true)['id'])->toBe($delivery->id)
        ->and($payload->request_headers['X-Skrum-Delivery'])->toBe($delivery->id)
        ->and($payload->response_status)->toBeNull()
        ->and($payload->response_excerpt)->toBeNull();
});

it('replaces the previous attempt with the last one', function () {
    Http::fakeSequence('hooks.example.com/*')->push('first answer', 503)->push('second answer', 200);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDeliveryWithPayload($integration);

    $this->travelTo(Date::parse('2026-10-07 10:00:05', 'UTC'));
    expect(fn () => resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery))
        ->toThrow(ProviderUnavailable::class);

    $this->travelTo(Date::parse('2026-10-07 10:00:15', 'UTC'));
    resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery->fresh());

    $payload = $delivery->payload()->sole();

    expect($payload->response_status)->toBe(200)
        ->and($payload->response_excerpt)->toBe('second answer')
        ->and($payload->request_headers['X-Skrum-Timestamp'])->toBe((string) Date::parse('2026-10-07 10:00:15', 'UTC')->getTimestamp())
        ->and(json_decode((string) $payload->request_body, true)['sentAt'])->toBe('2026-10-07T10:00:15Z');
});

it('keeps an excerpt cut in the middle of a character byte for byte', function () {
    Http::fake(['hooks.example.com/*' => Http::response('a'.str_repeat('é', 1024), 200)]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDeliveryWithPayload($integration);

    resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery);

    $excerpt = (string) $delivery->payload()->sole()->response_excerpt;

    expect($excerpt)->toBe('a'.str_repeat('é', 1023)."\xC3")
        ->and(strlen($excerpt))->toBe(2048)
        ->and(mb_check_encoding($excerpt, 'UTF-8'))->toBeFalse();
});

it('reports a failure to count the attempt without failing a successful send', function () {
    Exceptions::fake();
    Http::fake(['hooks.example.com/*' => Http::response('ok', 200)]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDeliveryWithPayload($integration);
    IntegrationDelivery::saving(fn () => throw new LogicException('update failed'));

    resolve(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery);

    Exceptions::assertReported(fn (RuntimeException $exception) => $exception->getMessage() === "Could not record the webhook attempt of delivery {$delivery->id} (LogicException)."
        && $exception->getPrevious() === null);
    expect($delivery->payload()->sole()->response_status)->toBe(200)
        ->and($delivery->payload()->sole()->response_excerpt)->toBe('ok');
});
