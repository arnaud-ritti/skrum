<?php

use App\Actions\Integrations\RequestWebhookRedelivery;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Jobs\Integrations\PushActionItemState;
use App\Jobs\Integrations\RedeliverWebhook;
use App\Models\IntegrationDelivery;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Symfony\Component\HttpKernel\Exception\HttpException;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::Webhook);
    outgoingWebhookResolves();
});

/**
 * @return array{0: Team, 1: User, 2: TeamIntegration, 3: IntegrationDelivery}
 */
function redeliverableWebhookDelivery(IntegrationDeliveryStatus $status = IntegrationDeliveryStatus::Failed): array
{
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = integrationAdmin($team);
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    $delivery = IntegrationDelivery::factory()->create([
        'team_id' => $team->id,
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::Event,
        'event' => 'action_item.completed',
        'team_integration_id' => $integration->id,
        'requested_by_user_id' => null,
        'status' => $status,
        'attempts' => 7,
        'response_status' => 503,
    ]);
    $delivery->payload()->create(['message' => [
        'id' => $delivery->id,
        'event' => 'action_item.completed',
        'occurredAt' => '2026-10-07T10:00:00Z',
        'data' => ['actionItem' => ['id' => 'item-1', 'content' => 'Fix the deploy']],
    ]]);

    return [$team, $admin, $integration, $delivery];
}

function expectRedeliveryRefused(Closure $redeliver, string $message): void
{
    try {
        $redeliver();
    } catch (HttpException $exception) {
        expect($exception->getStatusCode())->toBe(409)
            ->and($exception->getMessage())->toBe($message);

        return;
    }

    test()->fail('The redelivery was not refused.');
}

it('redelivers the stored message with the same id, a fresh time and the current secret', function () {
    $this->travelTo(Carbon::parse('2026-10-08 09:00:00', 'UTC'));
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $integration->forceFill(['credentials' => ['url' => TeamIntegrationFactory::WebhookUrl, 'webhookSecret' => 'rotated-secret']])->save();

    $redelivery = app(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);

    expect($redelivery->redelivery_of_id)->toBe($delivery->id)
        ->and($redelivery->kind)->toBe(IntegrationDeliveryKind::Event)
        ->and($redelivery->event)->toBe('action_item.completed')
        ->and($redelivery->team_integration_id)->toBe($integration->id)
        ->and($redelivery->requested_by_user_id)->toBe($admin->id)
        ->and($redelivery->status)->toBe(IntegrationDeliveryStatus::Queued)
        ->and($redelivery->payload->message)->toBe($delivery->payload->message);

    $job = Queue::pushed(RedeliverWebhook::class)->sole();

    expect(serialize($job))->not->toContain('Fix the deploy');

    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);
    runOutgoingWebhookJob($job)->assertNotFailed();

    Http::assertSent(function (Request $request) use ($delivery) {
        $body = json_decode($request->body(), true);

        return $request->header('X-Skrum-Delivery')[0] === $delivery->id
            && $request->header('X-Skrum-Redelivery')[0] === 'true'
            && outgoingWebhookSignatureIsValid($request, 'rotated-secret')
            && $body['id'] === $delivery->id
            && $body['occurredAt'] === '2026-10-07T10:00:00Z'
            && $body['sentAt'] === '2026-10-08T09:00:00Z'
            && $body['data'] === ['actionItem' => ['id' => 'item-1', 'content' => 'Fix the deploy']];
    });
    expect($redelivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Sent)
        ->and($redelivery->payload()->sole()->request_headers['X-Skrum-Redelivery'])->toBe('true')
        ->and($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($delivery->fresh()->attempts)->toBe(7);
    Queue::assertNotPushed(PushActionItemState::class);
});

it('refuses a delivery it cannot redeliver', function (string $case, string $message) {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();

    match ($case) {
        'pruned' => $delivery->payload()->delete(),
        'queued' => $delivery->forceFill(['status' => IntegrationDeliveryStatus::Queued])->save(),
        'disabled' => $integration->markReconnectRequired('Disabled after 10 failed deliveries in a row.'),
    };

    expectRedeliveryRefused(fn () => app(RequestWebhookRedelivery::class)->handle($integration->fresh(), $delivery->fresh(), $admin), $message);

    Queue::assertNotPushed(RedeliverWebhook::class);
    expect(IntegrationDelivery::query()->count())->toBe(1);
})->with([
    'content pruned' => ['pruned', "This delivery's content is no longer kept."],
    'still being sent' => ['queued', 'This delivery is still being sent.'],
    'webhook disabled' => ['disabled', 'Turn the webhook back on before redelivering.'],
]);

it('redelivers a delivery only once at a time', function () {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();

    app(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);

    expectRedeliveryRefused(fn () => app(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin), 'This delivery is already being redelivered.');

    Queue::assertPushed(RedeliverWebhook::class, 1);
    expect(IntegrationDelivery::query()->whereNotNull('redelivery_of_id')->count())->toBe(1);
});

it('counts a failed redelivery toward disabling the webhook', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 404)]);
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $integration->forceFill(['consecutive_failures' => 9])->save();

    app(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);
    runOutgoingWebhookJob(Queue::pushed(RedeliverWebhook::class)->sole())->assertFailed();

    expect($integration->fresh()->consecutive_failures)->toBe(10)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});

it('fails a redelivery to an endpoint that became unsafe without touching the original', function () {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();

    app(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);
    outgoingWebhookResolves(['10.0.0.5']);
    runOutgoingWebhookJob(Queue::pushed(RedeliverWebhook::class)->sole())->assertFailed();

    $redelivery = IntegrationDelivery::query()->whereNotNull('redelivery_of_id')->sole();

    expect($redelivery->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($redelivery->error)->toBe('This webhook URL points to a private or invalid address.')
        ->and($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($delivery->fresh()->error)->toBeNull();
    Http::assertNothingSent();
});

it('fails a redelivery whose content disappeared without counting it', function () {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();

    $redelivery = app(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);
    $redelivery->payload()->delete();
    runOutgoingWebhookJob(Queue::pushed(RedeliverWebhook::class)->sole())->assertFailed();

    expect($redelivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($redelivery->fresh()->error)->toBe("This delivery's content is no longer kept.")
        ->and($integration->fresh()->consecutive_failures)->toBe(0);
    Http::assertNothingSent();
});
