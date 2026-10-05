<?php

use App\Actions\Integrations\StoreWebhookPayload;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use App\Models\TeamIntegration;
use Illuminate\Database\DeadlockException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Schema;

/**
 * @param  array<string, mixed>  $attributes
 */
function webhookPayloadDelivery(array $attributes = []): IntegrationDelivery
{
    $integration = TeamIntegration::factory()->webhook()->create();

    return IntegrationDelivery::factory()->create([
        'team_id' => $integration->team_id,
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::Event,
        'event' => 'action_item.completed',
        'team_integration_id' => $integration->id,
        'requested_by_user_id' => null,
        ...$attributes,
    ]);
}

/**
 * @return array{id: string, event: string, occurredAt: string, data: array<string, mixed>}
 */
function webhookPayloadMessage(IntegrationDelivery $delivery): array
{
    return [
        'id' => $delivery->id,
        'event' => 'action_item.completed',
        'occurredAt' => '2026-10-08T10:00:00Z',
        'data' => ['actionItem' => ['content' => 'Fix the deploy']],
    ];
}

it('keeps a delivery payload encrypted at rest', function () {
    $delivery = webhookPayloadDelivery();
    $payload = $delivery->payload()->create([
        'message' => webhookPayloadMessage($delivery),
        'request_headers' => ['X-Skrum-Event' => 'action_item.completed'],
        'request_body' => '{"data":{"actionItem":{"content":"Fix the deploy"}}}',
        'response_status' => 500,
        'response_excerpt' => 'Fix the deploy failed',
    ]);

    $raw = DB::table('integration_delivery_payloads')->where('id', $payload->id)->sole();

    expect($raw->message)->not->toContain('Fix the deploy')
        ->and($raw->request_headers)->not->toContain('action_item.completed')
        ->and($raw->request_body)->not->toContain('Fix the deploy')
        ->and($raw->response_excerpt)->not->toContain('Fix the deploy')
        ->and($payload->fresh()->message)->toBe(webhookPayloadMessage($delivery))
        ->and($payload->fresh()->request_headers)->toBe(['X-Skrum-Event' => 'action_item.completed'])
        ->and($payload->fresh()->response_status)->toBe(500)
        ->and($delivery->fresh()->payload->id)->toBe($payload->id);
});

it('prunes payloads after 30 days and keeps their delivery', function () {
    $old = webhookPayloadDelivery();
    $recent = webhookPayloadDelivery();
    $old->payload()->create(['message' => webhookPayloadMessage($old)])->forceFill(['created_at' => now()->subDays(31)])->save();
    $recent->payload()->create(['message' => webhookPayloadMessage($recent)])->forceFill(['created_at' => now()->subDays(29)])->save();

    $this->artisan('model:prune', ['--model' => [IntegrationDeliveryPayload::class]])->assertSuccessful();

    expect($old->fresh())->not->toBeNull()
        ->and($old->payload()->exists())->toBeFalse()
        ->and($recent->payload()->exists())->toBeTrue();
});

it('links a redelivery to its original and drops payloads with their delivery', function () {
    $original = webhookPayloadDelivery();
    $redelivery = webhookPayloadDelivery([
        'team_id' => $original->team_id,
        'team_integration_id' => $original->team_integration_id,
        'redelivery_of_id' => $original->id,
    ]);
    $redelivery->payload()->create(['message' => webhookPayloadMessage($original)]);

    expect($redelivery->redeliveryOf->id)->toBe($original->id);

    $redelivery->delete();

    expect(IntegrationDeliveryPayload::query()->count())->toBe(0);

    $original->delete();

    expect(IntegrationDelivery::query()->count())->toBe(0);
});

it('makes a payload for a webhook delivery from its factory', function () {
    $payload = IntegrationDeliveryPayload::factory()->create();

    expect($payload->delivery->channel)->toBe(IntegrationDeliveryChannel::Webhook)
        ->and($payload->message['id'])->toBe($payload->integration_delivery_id);
});

it('keeps no content for a message too large to store', function () {
    $delivery = webhookPayloadDelivery();
    $message = [...webhookPayloadMessage($delivery), 'data' => ['notes' => str_repeat('a', 260 * 1024)]];

    resolve(StoreWebhookPayload::class)->handle($delivery, $message);

    expect($delivery->payload()->exists())->toBeFalse();
});

it('keeps a message that fits', function () {
    $delivery = webhookPayloadDelivery();

    resolve(StoreWebhookPayload::class)->handle($delivery, webhookPayloadMessage($delivery));

    expect($delivery->payload->message)->toBe(webhookPayloadMessage($delivery));
});

it('indexes the link from a redelivery to its original', function () {
    $indexedColumns = array_column(Schema::getIndexes('integration_deliveries'), 'columns');

    expect($indexedColumns)->toContain(['redelivery_of_id']);
});

it('keeps a redelivery without its link once the original is deleted', function () {
    $original = webhookPayloadDelivery();
    $redelivery = webhookPayloadDelivery([
        'team_id' => $original->team_id,
        'team_integration_id' => $original->team_integration_id,
        'redelivery_of_id' => $original->id,
    ]);
    $redelivery->payload()->create(['message' => webhookPayloadMessage($original)]);

    $original->delete();

    expect($redelivery->fresh()->redelivery_of_id)->toBeNull()
        ->and($redelivery->payload()->exists())->toBeTrue();
});

it('keeps a message up to the 512 KB limit and nothing beyond it', function (int $extraBytes, bool $kept) {
    $delivery = webhookPayloadDelivery();
    $largestMessageBytes = (StoreWebhookPayload::MaxBytes - 4096) / 2;
    $emptyMessage = [...webhookPayloadMessage($delivery), 'data' => ['notes' => '']];
    $padding = $largestMessageBytes - strlen(json_encode($emptyMessage, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) + $extraBytes;

    resolve(StoreWebhookPayload::class)->handle($delivery, [...$emptyMessage, 'data' => ['notes' => str_repeat('a', $padding)]]);

    expect($delivery->payload()->exists())->toBe($kept);
})->with([
    'exactly at the limit' => [0, true],
    'one byte over' => [1, false],
]);

it('leaves the content out when a payload is turned into an array', function () {
    $payload = IntegrationDeliveryPayload::factory()->create([
        'request_headers' => ['X-Skrum-Event' => 'action_item.completed'],
        'request_body' => '{"id":"x"}',
        'response_status' => 500,
        'response_excerpt' => 'Service Unavailable',
    ]);

    expect(array_keys($payload->fresh()->toArray()))->toBe(['id', 'integration_delivery_id', 'response_status', 'created_at', 'updated_at']);
});

it('keeps a message since the date it is given', function () {
    $this->travelTo(now()->startOfSecond());
    $delivery = webhookPayloadDelivery();

    resolve(StoreWebhookPayload::class)->handle($delivery, webhookPayloadMessage($delivery), now()->subDays(29));

    expect($delivery->payload->created_at->equalTo(now()->subDays(29)))->toBeTrue();
});

it('reports only the kind of failure when a message cannot be kept and carries on', function () {
    Exceptions::fake();
    $delivery = webhookPayloadDelivery();
    $message = [...webhookPayloadMessage($delivery), 'data' => ['notes' => "Fix the deploy \xB1\x31"]];

    resolve(StoreWebhookPayload::class)->keepIfPossible($delivery, $message);

    expect($delivery->payload()->exists())->toBeFalse();
    Exceptions::assertReported(fn (RuntimeException $exception) => $exception->getMessage() === "Could not keep the webhook message of delivery {$delivery->id} (JsonException).");
});

it('does not carry on after a deadlock while keeping a message', function () {
    Exceptions::fake();
    $delivery = webhookPayloadDelivery();
    IntegrationDeliveryPayload::creating(fn () => throw new DeadlockException('deadlock detected'));

    expect(fn () => resolve(StoreWebhookPayload::class)->keepIfPossible($delivery, webhookPayloadMessage($delivery)))
        ->toThrow(DeadlockException::class);

    Exceptions::assertNothingReported();
});
