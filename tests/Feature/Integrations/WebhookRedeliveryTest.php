<?php

use App\Actions\Integrations\LatestDeliveries;
use App\Actions\Integrations\RequestWebhookRedelivery;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Jobs\Integrations\PushActionItemState;
use App\Jobs\Integrations\RedeliverWebhook;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Contracts\Bus\Dispatcher;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Exceptions;
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
    $this->travelTo(Date::parse('2026-10-08 09:00:00', 'UTC'));
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $integration->forceFill(['credentials' => ['url' => TeamIntegrationFactory::WebhookUrl, 'webhookSecret' => 'rotated-secret']])->save();

    $redelivery = resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);

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
    runDeliveryJob($job)->assertNotFailed();

    Http::assertSent(function (Request $request) use ($delivery): bool {
        $body = json_decode($request->body(), true);

        return $request->header('X-Skrum-Delivery')[0] === $delivery->id
            && $request->header('X-Skrum-Redelivery')[0] === 'true'
            && $request->header('X-Skrum-Timestamp')[0] === (string) Date::parse('2026-10-08 09:00:00', 'UTC')->getTimestamp()
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

    expectRedeliveryRefused(fn () => resolve(RequestWebhookRedelivery::class)->handle($integration->fresh(), $delivery->fresh(), $admin), $message);

    Queue::assertNotPushed(RedeliverWebhook::class);
    expect(IntegrationDelivery::query()->count())->toBe(1);
})->with([
    'content pruned' => ['pruned', "This delivery's content is no longer kept."],
    'still being sent' => ['queued', 'This delivery is still being sent.'],
    'webhook disabled' => ['disabled', 'Turn the webhook back on before redelivering.'],
]);

it('redelivers a delivery only once at a time', function () {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();

    resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);

    expectRedeliveryRefused(fn () => resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin), 'This delivery is already being redelivered.');

    Queue::assertPushed(RedeliverWebhook::class, 1);
    expect(IntegrationDelivery::query()->whereNotNull('redelivery_of_id')->count())->toBe(1);
});

it('counts a failed redelivery toward disabling the webhook', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 404)]);
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $integration->forceFill(['consecutive_failures' => 9])->save();

    resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);
    runDeliveryJob(Queue::pushed(RedeliverWebhook::class)->sole())->assertFailed();

    expect($integration->fresh()->consecutive_failures)->toBe(10)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});

it('fails a redelivery to an endpoint that became unsafe without touching the original', function () {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();

    resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);
    outgoingWebhookResolves(['10.0.0.5']);
    runDeliveryJob(Queue::pushed(RedeliverWebhook::class)->sole())->assertFailed();

    $redelivery = IntegrationDelivery::query()->whereNotNull('redelivery_of_id')->sole();

    expect($redelivery->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($redelivery->error)->toBe('This webhook URL points to a private or invalid address.')
        ->and($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($delivery->fresh()->error)->toBeNull();
    Http::assertNothingSent();
});

it('fails a redelivery whose content disappeared without counting it', function () {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();

    $redelivery = resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);
    $redelivery->payload()->delete();
    runDeliveryJob(Queue::pushed(RedeliverWebhook::class)->sole())->assertFailed();

    expect($redelivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($redelivery->fresh()->error)->toBe("This delivery's content is no longer kept.")
        ->and($integration->fresh()->consecutive_failures)->toBe(0);
    Http::assertNothingSent();
});

it('shows an Owner or Admin what was sent and answered', function () {
    [$team, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $delivery->payload->forceFill([
        'request_headers' => ['X-Skrum-Event' => 'action_item.completed', 'X-Skrum-Signature' => 'sha256=…a1b2c3'],
        'request_body' => '{"id":"x"}',
        'response_status' => 503,
        'response_excerpt' => 'Service Unavailable',
    ])->save();

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.deliveries.show', [$team->workspace, $team, $integration, $delivery->id]))
        ->assertOk()
        ->assertExactJson([
            'id' => $delivery->id,
            'event' => 'action_item.completed',
            'status' => 'failed',
            'attempts' => 7,
            'redeliveryOf' => null,
            'request' => [
                'headers' => ['X-Skrum-Event' => 'action_item.completed', 'X-Skrum-Signature' => 'sha256=…a1b2c3'],
                'body' => '{"id":"x"}',
            ],
            'response' => ['status' => 503, 'excerpt' => 'Service Unavailable'],
        ]);
});

it('shows a response excerpt cut inside a character', function () {
    [$team, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $delivery->payload->forceFill(['response_status' => 500, 'response_excerpt' => 'Erreur '.substr('é', 0, 1)])->save();

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.deliveries.show', [$team->workspace, $team, $integration, $delivery->id]))
        ->assertOk()
        ->assertJsonPath('response.excerpt', 'Erreur ?');
});

it('keeps payloads to Owners and Admins', function () {
    [$team, , $integration, $delivery] = redeliverableWebhookDelivery();
    $member = teamMember($team);

    $this->actingAs($member)
        ->getJson(route('teams.integrations.deliveries.show', [$team->workspace, $team, $integration, $delivery->id]))
        ->assertForbidden();
    $this->actingAs($member)
        ->postJson(route('teams.integrations.deliveries.redelivery.store', [$team->workspace, $team, $integration, $delivery->id]))
        ->assertForbidden();

    Queue::assertNotPushed(RedeliverWebhook::class);
});

it('answers 404 for deliveries outside the team\'s webhook log', function () {
    [$team, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    [, , , $foreign] = redeliverableWebhookDelivery();
    $slack = IntegrationDelivery::factory()->create(['team_id' => $team->id, 'channel' => IntegrationDeliveryChannel::Slack]);
    $show = fn (string $id) => route('teams.integrations.deliveries.show', [$team->workspace, $team, $integration, $id]);

    $this->actingAs($admin)->getJson($show($foreign->id))->assertNotFound();
    $this->actingAs($admin)->getJson($show($slack->id))->assertNotFound();
    $this->actingAs($admin)
        ->postJson(route('teams.integrations.deliveries.redelivery.store', [$team->workspace, $team, $integration, $foreign->id]))
        ->assertNotFound();

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.deliveries.redelivery.store', [$team->workspace, $team, $integration, $slack->id]))
        ->assertNotFound();

    $delivery->payload()->delete();

    $this->actingAs($admin)->getJson($show($delivery->id))->assertNotFound();
});

it('answers 404 on both routes while the webhook provider is off', function () {
    [$team, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    config(['services.outgoing_webhooks.enabled' => false]);

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.deliveries.show', [$team->workspace, $team, $integration, $delivery->id]))
        ->assertNotFound();
    $this->actingAs($admin)
        ->postJson(route('teams.integrations.deliveries.redelivery.store', [$team->workspace, $team, $integration, $delivery->id]))
        ->assertNotFound();

    Queue::assertNotPushed(RedeliverWebhook::class);
});

it('refuses non-managers before looking the delivery up', function () {
    [$team, , $integration, $delivery] = redeliverableWebhookDelivery();
    [, , , $foreign] = redeliverableWebhookDelivery();
    $delivery->payload()->delete();
    $nonManagers = [teamMember($team), User::factory()->create()];

    foreach ($nonManagers as $user) {
        foreach ([$delivery->id, $foreign->id, '7b6e1c1e-0000-4000-8000-000000000000'] as $id) {
            $this->actingAs($user)
                ->getJson(route('teams.integrations.deliveries.show', [$team->workspace, $team, $integration, $id]))
                ->assertForbidden();
            $this->actingAs($user)
                ->postJson(route('teams.integrations.deliveries.redelivery.store', [$team->workspace, $team, $integration, $id]))
                ->assertForbidden();
        }
    }
});

it('redelivers through the endpoint and lists the redelivery', function () {
    [$team, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $this->travel(5)->seconds();

    $response = $this->actingAs($admin)
        ->postJson(route('teams.integrations.deliveries.redelivery.store', [$team->workspace, $team, $integration, $delivery->id]))
        ->assertAccepted()
        ->assertJson(['event' => 'action_item.completed', 'status' => 'queued', 'attempts' => 0, 'redeliveryOf' => $delivery->id, 'hasContent' => true]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.deliveries.redelivery.store', [$team->workspace, $team, $integration, $delivery->id]))
        ->assertConflict()
        ->assertJson(['message' => 'This delivery is already being redelivered.']);

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.deliveries.index', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertJsonPath('data.0.id', $response->json('id'))
        ->assertJsonPath('data.0.redeliveryOf', $delivery->id)
        ->assertJsonPath('data.0.hasContent', true)
        ->assertJsonPath('data.1.id', $delivery->id)
        ->assertJsonPath('data.1.hasContent', true);
    Queue::assertPushed(RedeliverWebhook::class, 1);
});

it('redelivers a delivery made through an earlier connection', function () {
    [$team, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $integration->delete();
    $current = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.deliveries.show', [$team->workspace, $team, $current, $delivery->id]))
        ->assertOk();
    $this->actingAs($admin)
        ->postJson(route('teams.integrations.deliveries.redelivery.store', [$team->workspace, $team, $current, $delivery->id]))
        ->assertAccepted();

    expect(IntegrationDelivery::query()->whereNotNull('redelivery_of_id')->sole()->team_integration_id)->toBe($current->id);
});

it('throttles redeliveries per user', function () {
    [$team, $admin, $integration] = redeliverableWebhookDelivery();
    $url = fn (IntegrationDelivery $delivery) => route('teams.integrations.deliveries.redelivery.store', [$team->workspace, $team, $integration, $delivery->id]);
    $deliveries = collect(range(1, 11))->map(function () use ($team, $integration) {
        $delivery = IntegrationDelivery::factory()->failed()->create([
            'team_id' => $team->id,
            'channel' => IntegrationDeliveryChannel::Webhook,
            'kind' => IntegrationDeliveryKind::Event,
            'event' => 'action_item.completed',
            'team_integration_id' => $integration->id,
            'requested_by_user_id' => null,
        ]);
        IntegrationDeliveryPayload::factory()->create(['integration_delivery_id' => $delivery->id, 'message' => ['id' => $delivery->id, 'event' => 'action_item.completed', 'occurredAt' => '2026-10-07T10:00:00Z', 'data' => []]]);

        return $delivery;
    });

    $deliveries->take(10)->each(fn (IntegrationDelivery $delivery) => $this->actingAs($admin)->postJson($url($delivery))->assertAccepted());

    $this->actingAs($admin)->postJson($url($deliveries->last()))->assertTooManyRequests();
});

it('keeps the original share as the latest delivery of its subject after a redelivery', function () {
    [$team, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $retro = Retro::factory()->create(['team_id' => $team->id]);
    $delivery->forceFill(['kind' => IntegrationDeliveryKind::RetroLink, 'event' => null, 'created_at' => now()->subMinute()])->subject()->associate($retro)->save();

    $redelivery = resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);

    expect($redelivery->subject->is($retro))->toBeTrue()
        ->and(array_column(resolve(LatestDeliveries::class)->handle($retro, [IntegrationDeliveryKind::RetroLink]), 'id'))->toBe([$delivery->id]);
});

it('points the redelivery of a redelivery to the first delivery', function () {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $first = resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);
    $first->forceFill(['status' => IntegrationDeliveryStatus::Sent])->save();

    $second = resolve(RequestWebhookRedelivery::class)->handle($integration, $first, $admin);

    expect($second->redelivery_of_id)->toBe($delivery->id)
        ->and($second->payload->message['id'])->toBe($delivery->id);
});

it('refuses to redeliver a redelivery while the first delivery is being redelivered', function () {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $first = resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);
    $first->forceFill(['status' => IntegrationDeliveryStatus::Sent])->save();
    resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);

    expectRedeliveryRefused(fn () => resolve(RequestWebhookRedelivery::class)->handle($integration, $first, $admin), 'This delivery is already being redelivered.');

    Queue::assertPushed(RedeliverWebhook::class, 2);
});

it('does not redeliver a delivery outside the webhook log of its team', function (string $case) {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();

    match ($case) {
        'other team' => $delivery->forceFill(['team_id' => Team::factory()->create()->id])->save(),
        'other channel' => $delivery->forceFill(['channel' => IntegrationDeliveryChannel::Slack])->save(),
    };

    expect(fn () => resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin))
        ->toThrow(fn (HttpException $exception) => expect($exception->getStatusCode())->toBe(404));

    Queue::assertNotPushed(RedeliverWebhook::class);
})->with(['other team', 'other channel']);

it('refuses to redeliver through a webhook disabled since the page was loaded', function () {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    TeamIntegration::query()->findOrFail($integration->id)->markReconnectRequired('Disabled after 10 failed deliveries in a row.');

    expectRedeliveryRefused(fn () => resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin), 'Turn the webhook back on before redelivering.');
});

it('marks the redelivery failed when its job cannot be queued, and lets the delivery be redelivered again', function () {
    Exceptions::fake();
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $workingDispatcher = resolve(Dispatcher::class);
    $this->mock(Dispatcher::class, fn ($mock) => $mock->shouldReceive('dispatch')->once()->andThrow(new RuntimeException('queue down')));

    expect(fn () => resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin))
        ->toThrow(fn (HttpException $exception) => expect($exception->getStatusCode())->toBe(503)
            ->and($exception->getMessage())->toBe('The redelivery could not be queued. Try again.'));

    $redelivery = IntegrationDelivery::query()->whereNotNull('redelivery_of_id')->sole();

    expect($redelivery->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($redelivery->error)->toBe('The message could not be delivered.');
    Exceptions::assertReported(fn (RuntimeException $exception) => $exception->getMessage() === 'queue down');

    $this->instance(Dispatcher::class, $workingDispatcher);

    expect(resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin)->status)->toBe(IntegrationDeliveryStatus::Queued);
    Queue::assertPushed(RedeliverWebhook::class, 1);
});

it('stops waiting for a redelivery queued more than 6 hours ago', function (int $minutesAgo, bool $allowed) {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $lost = resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);
    $lost->forceFill(['created_at' => now()->subMinutes($minutesAgo)])->save();

    if (! $allowed) {
        expectRedeliveryRefused(fn () => resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin), 'This delivery is already being redelivered.');

        return;
    }

    $redelivery = resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);

    expect($redelivery->redelivery_of_id)->toBe($delivery->id);
    Queue::assertPushed(RedeliverWebhook::class, 2);
})->with([
    'just under 6 hours' => [359, false],
    'just over 6 hours' => [361, true],
]);

it('stops waiting for a delivery queued more than 6 hours ago', function (int $minutesAgo, bool $allowed) {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery(IntegrationDeliveryStatus::Queued);
    $delivery->forceFill(['created_at' => now()->subMinutes($minutesAgo)])->save();

    if (! $allowed) {
        expectRedeliveryRefused(fn () => resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin), 'This delivery is still being sent.');

        return;
    }

    expect(resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin)->redelivery_of_id)->toBe($delivery->id);
})->with([
    'just under 6 hours' => [359, false],
    'just over 6 hours' => [361, true],
]);

it('lets the content of a redelivery expire with the first delivery', function () {
    $this->travelTo(Date::parse('2026-10-08 09:00:00', 'UTC'));
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();

    $this->travel(29)->days();
    $redelivery = resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);

    expect($redelivery->payload->created_at->equalTo($delivery->payload->created_at))->toBeTrue();

    $this->artisan('model:prune', ['--model' => [IntegrationDeliveryPayload::class]])->assertSuccessful();

    expect($redelivery->payload()->exists())->toBeTrue();

    $this->travel(1)->days();
    $this->travel(1)->seconds();
    $this->artisan('model:prune', ['--model' => [IntegrationDeliveryPayload::class]])->assertSuccessful();

    expect($redelivery->payload()->exists())->toBeFalse()
        ->and($delivery->payload()->exists())->toBeFalse()
        ->and($redelivery->fresh())->not->toBeNull();
});

it('resets the failure counter of the webhook after a successful redelivery', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    $integration->forceFill(['consecutive_failures' => 9])->save();

    resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);
    runDeliveryJob(Queue::pushed(RedeliverWebhook::class)->sole())->assertNotFailed();

    expect($integration->fresh()->consecutive_failures)->toBe(0)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::Active);
});

it('fails a redelivery whose content can no longer be decrypted without counting it', function () {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();

    $redelivery = resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);
    DB::table('integration_delivery_payloads')->where('integration_delivery_id', $redelivery->id)->update(['message' => 'written-with-another-key']);
    runDeliveryJob(Queue::pushed(RedeliverWebhook::class)->sole())->assertFailed();

    expect($redelivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($redelivery->fresh()->error)->toBe("This delivery's content is no longer kept.")
        ->and($integration->fresh()->consecutive_failures)->toBe(0);
    Http::assertNothingSent();
});

it('answers 404 when the content of a delivery can no longer be decrypted', function () {
    [$team, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    DB::table('integration_delivery_payloads')->where('integration_delivery_id', $delivery->id)->update(['request_body' => 'written-with-another-key']);

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.deliveries.show', [$team->workspace, $team, $integration, $delivery->id]))
        ->assertNotFound();
});

it('reads the stored message once per attempt', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin);
    $payloadReads = 0;

    IntegrationDeliveryPayload::retrieved(function () use (&$payloadReads): void {
        $payloadReads++;
    });

    runDeliveryJob(Queue::pushed(RedeliverWebhook::class)->sole())->assertNotFailed();

    expect($payloadReads)->toBe(1);
});

it('refuses to redeliver content that can no longer be decrypted', function () {
    [, $admin, $integration, $delivery] = redeliverableWebhookDelivery();
    DB::table('integration_delivery_payloads')->where('integration_delivery_id', $delivery->id)->update(['message' => 'written-with-another-key']);

    expectRedeliveryRefused(fn () => resolve(RequestWebhookRedelivery::class)->handle($integration, $delivery, $admin), "This delivery's content is no longer kept.");

    Queue::assertNotPushed(RedeliverWebhook::class);
    expect(IntegrationDelivery::query()->count())->toBe(1);
});

it('tells the log which deliveries can be redelivered', function (string $status, int $minutesAgo, bool $hasContent, bool $redeliverable) {
    [$team, $admin, $integration, $delivery] = redeliverableWebhookDelivery(IntegrationDeliveryStatus::from($status));
    $delivery->forceFill(['created_at' => now()->subMinutes($minutesAgo)])->save();

    if (! $hasContent) {
        $delivery->payload()->delete();
    }

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.deliveries.index', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertJsonPath('data.0.hasContent', $hasContent)
        ->assertJsonPath('data.0.redeliverable', $redeliverable);
})->with([
    'failed with content' => ['failed', 1, true, true],
    'sent with content' => ['sent', 1, true, true],
    'failed without content' => ['failed', 1, false, false],
    'queued just under 6 hours ago' => ['queued', 359, true, false],
    'queued just over 6 hours ago' => ['queued', 361, true, true],
    'queued long ago without content' => ['queued', 361, false, false],
]);

it('tells the log whether missing content expired or was never kept', function (int $daysAgo, bool $expired) {
    [$team, $admin, $integration, $delivery] = redeliverableWebhookDelivery(IntegrationDeliveryStatus::Failed);
    $delivery->forceFill(['created_at' => now()->subDays($daysAgo)])->save();
    $delivery->payload()->delete();

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.deliveries.index', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertJsonPath('data.0.contentExpired', $expired);
})->with([
    'within the retention' => [IntegrationDeliveryPayload::RetentionDays - 1, false],
    'past the retention' => [IntegrationDeliveryPayload::RetentionDays + 1, true],
]);
