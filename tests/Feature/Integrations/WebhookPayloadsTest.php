<?php

use App\Actions\Integrations\StoreWebhookPayload;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use App\Models\TeamIntegration;
use Illuminate\Support\Facades\DB;

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
    $redelivery = webhookPayloadDelivery(['team_id' => $original->team_id, 'redelivery_of_id' => $original->id]);
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

    app(StoreWebhookPayload::class)->handle($delivery, $message);

    expect($delivery->payload()->exists())->toBeFalse();
});

it('keeps a message that fits', function () {
    $delivery = webhookPayloadDelivery();

    app(StoreWebhookPayload::class)->handle($delivery, webhookPayloadMessage($delivery));

    expect($delivery->payload->message)->toBe(webhookPayloadMessage($delivery));
});
