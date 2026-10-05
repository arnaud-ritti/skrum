<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\CreateActionItem;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Actions\Integrations\BuildWebhookEventData;
use App\Actions\Retros\ChangeRetroPhase;
use App\Enums\ActionItemStatus;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\PokerRevealReason;
use App\Enums\RetroPhase;
use App\Enums\WebhookEvent;
use App\Exceptions\Integrations\ProviderUnavailable;
use App\Jobs\Integrations\DeliverWebhookEvent;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Webhook\WebhookHealth;
use Illuminate\Contracts\Bus\Dispatcher;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::Webhook);
    outgoingWebhookResolves();
});

/**
 * @param  array<int, string>|null  $events
 */
function subscribedWebhook(Team $team, ?array $events = null): TeamIntegration
{
    return TeamIntegration::factory()->webhook($events ?? WebhookEvent::values())->create(['team_id' => $team->id]);
}

/**
 * @return Collection<int, DeliverWebhookEvent>
 */
function pushedWebhookEvents(): Collection
{
    return Queue::pushed(DeliverWebhookEvent::class)->values();
}

/**
 * @return array{0: Retro, 1: User, 2: Participant}
 */
function webhookEventRetro(RetroPhase $phase = RetroPhase::Discussing, bool $anonymous = false): array
{
    $factory = Retro::factory()->inPhase($phase);
    $retro = ($anonymous ? $factory->anonymous() : $factory)->create([
        'title' => 'Sprint 42',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
    ]);
    [$facilitator, $participant] = retroFacilitator($retro);
    $facilitator->forceFill(['name' => 'Fran Facilitator'])->save();

    return [$retro, $facilitator, $participant];
}

/**
 * @return array<string, mixed>
 */
function webhookEstimateTable(): array
{
    $table = pokerRevealTable();
    pokerVote($table['round'], $table['facilitatorPlayer'], '5');
    pokerVote($table['round'], $table['memberPlayer'], '8');
    $table['round']->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);
    $table['task'] = $table['round']->task;
    $table['task']->forceFill([
        'title' => 'Login page',
        'external_source' => 'jira',
        'external_key' => 'PROJ-7',
        'external_url' => 'https://acme.atlassian.net/browse/PROJ-7',
    ])->save();
    $table['member']->forceFill(['name' => 'Milo Member'])->save();

    return $table;
}

it('sends nothing without a subscription', function () {
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, []);

    resolve(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Fix the deploy']);

    Queue::assertNotPushed(DeliverWebhookEvent::class);
    expect(IntegrationDelivery::query()->count())->toBe(0);
});

it('sends action_item.created while the retro is still in Writing, with the item named', function () {
    [$retro, $facilitator, $participant] = webhookEventRetro(RetroPhase::Writing, anonymous: true);
    subscribedWebhook($retro->team, ['action_item.created']);
    [$ada] = retroMember($retro);
    $ada->forceFill(['name' => 'Ada Assignee'])->save();

    $item = resolve(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), [
        'content' => 'Fix the deploy',
        'priority' => 'high',
        'due_on' => '2026-10-15',
        'assignee_user_id' => $ada->id,
    ]);

    $job = pushedWebhookEvents()->sole();
    $delivery = IntegrationDelivery::query()->sole();

    expect($delivery->kind)->toBe(IntegrationDeliveryKind::Event)
        ->and($delivery->event)->toBe('action_item.created')
        ->and($delivery->subject_id)->toBe($item->id)
        ->and($delivery->requested_by_user_id)->toBeNull()
        ->and($delivery->status)->toBe(IntegrationDeliveryStatus::Queued)
        ->and($job->deliveryId)->toBe($delivery->id)
        ->and($job->event)->toBe('action_item.created')
        ->and($job->data)->toBe(['actionItem' => [
            'id' => $item->id,
            'content' => 'Fix the deploy',
            'status' => 'open',
            'assignee' => ['name' => 'Ada Assignee'],
            'createdBy' => ['name' => 'Fran Facilitator'],
            'completedBy' => null,
            'dueOn' => '2026-10-15',
            'priority' => 'high',
            'completedAt' => null,
            'url' => route('workspaces.actionItems.index', ['workspace' => $retro->team->workspace, 'team' => $retro->team_id, 'item' => $item->id]),
            'retro' => ['id' => $retro->id, 'title' => 'Sprint 42', 'url' => route('retros.show', $retro)],
            'themeName' => null,
            'createdAt' => $item->created_at?->toIso8601ZuluString(),
        ]])
        ->and(json_encode($job->data))->not->toContain($facilitator->email)
        ->and(json_encode($job->data))->not->toContain($ada->email);
});

it('sends action_item.completed and action_item.reopened with origin and actor', function () {
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.completed', 'action_item.reopened']);
    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Fix the deploy',
        'created_by_participant_id' => $participant->id,
        'created_by_user_id' => $participant->user_id,
    ]);
    ActionItemComment::factory()->create(['action_item_id' => $item->id, 'content' => 'Secret discussion']);
    $actor = ActionItemActor::forParticipant($participant);

    resolve(SetActionItemStatus::class)->handle($item, $actor, ActionItemStatus::Completed);
    resolve(SetActionItemStatus::class)->handle($item->fresh(), $actor, ActionItemStatus::Open);
    resolve(SetActionItemStatus::class)->handle($item->fresh(), new ExternalSyncActor('jira', 'PROJ-12'), ActionItemStatus::Completed);

    [$completed, $reopened, $external] = pushedWebhookEvents()->all();

    expect($completed->event)->toBe('action_item.completed')
        ->and($completed->data['origin'])->toBe('skrum')
        ->and($completed->data['completedVia'])->toBeNull()
        ->and($completed->data['actionItem']['status'])->toBe('completed')
        ->and($completed->data['actionItem']['completedBy'])->toBe(['name' => 'Fran Facilitator'])
        ->and($completed->data['actionItem']['completedAt'])->not->toBeNull()
        ->and($reopened->event)->toBe('action_item.reopened')
        ->and($reopened->data['origin'])->toBe('skrum')
        ->and($reopened->data['actionItem']['status'])->toBe('open')
        ->and($reopened->data['actionItem']['completedBy'])->toBeNull()
        ->and($external->event)->toBe('action_item.completed')
        ->and($external->data['origin'])->toBe('external')
        ->and($external->data['completedVia'])->toBe(['source' => 'jira', 'key' => 'PROJ-12'])
        ->and($external->data['actionItem']['completedBy'])->toBeNull()
        ->and(json_encode(pushedWebhookEvents()->map->data->all()))->not->toContain('Secret discussion');
});

it('hides guest actors but still sends their events', function () {
    [$retro] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.created', 'action_item.completed']);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Gus']);

    $created = resolve(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($guest), ['content' => 'Guest idea']);
    $assigned = ActionItem::factory()->assignedToGuest($guest)->create(['content' => 'Guest task']);
    resolve(SetActionItemStatus::class)->handle($assigned, ActionItemActor::forParticipant($guest), ActionItemStatus::Completed);

    [$createdJob, $completedJob] = pushedWebhookEvents()->all();

    expect($createdJob->data['actionItem']['id'])->toBe($created->id)
        ->and($createdJob->data['actionItem']['createdBy'])->toBeNull()
        ->and($completedJob->data['actionItem']['id'])->toBe($assigned->id)
        ->and($completedJob->data['actionItem']['completedBy'])->toBeNull()
        ->and($completedJob->data['actionItem']['assignee'])->toBe(['name' => 'Gus (guest)']);
});

it('sends retro.completed on each completion with the recap rules', function () {
    [$retro, , $facilitatorParticipant] = webhookEventRetro(RetroPhase::Roti, anonymous: true);
    subscribedWebhook($retro->team, ['retro.completed']);
    [$carla, $carlaParticipant] = retroMember($retro);
    $carla->forceFill(['name' => 'Carla Author'])->save();
    webhookTopCard($retro, $carlaParticipant, $facilitatorParticipant);

    resolve(ChangeRetroPhase::class)->handle($retro->fresh(), RetroPhase::Completed);
    resolve(ChangeRetroPhase::class)->handle($retro->fresh(), RetroPhase::Roti);
    resolve(ChangeRetroPhase::class)->handle($retro->fresh(), RetroPhase::Completed);

    $jobs = pushedWebhookEvents();

    expect($jobs)->toHaveCount(2)
        ->and($jobs[0]->event)->toBe('retro.completed')
        ->and($jobs[0]->data['retro'])->toBe(['id' => $retro->id])
        ->and($jobs[0]->data['title'])->toBe('Sprint 42')
        ->and($jobs[0]->data['participants'])->toBe(['count' => 2, 'names' => null])
        ->and($jobs[0]->data['topCards'])->toBe([['column' => 'Wins', 'content' => 'Faster reviews', 'votes' => 1, 'groupedCount' => 0]])
        ->and($jobs[0]->data['completedAt'])->toBeString()
        ->and(json_encode($jobs->map->data->all()))->not->toContain('Carla Author');
});

it('sends poker.task.estimated when a card is set or changed, never on clear', function () {
    $table = webhookEstimateTable();
    $game = $table['game'];
    subscribedWebhook($game->team, ['poker.task.estimated']);
    $url = route('poker.tasks.estimate.update', [$game, $table['task']]);
    $this->actingAs($table['facilitator']);

    $this->putJson($url, ['value' => '8'])->assertOk();
    $this->putJson($url, ['value' => '8'])->assertOk();
    $this->putJson($url, ['value' => null])->assertOk();
    $this->putJson($url, ['value' => '5'])->assertOk();

    $jobs = pushedWebhookEvents();

    expect($jobs)->toHaveCount(2)
        ->and($jobs[0]->event)->toBe('poker.task.estimated')
        ->and($jobs[0]->data['game'])->toBe(['id' => $game->id, 'title' => $game->title, 'url' => route('poker.show', $game)])
        ->and($jobs[0]->data['task'])->toBe([
            'id' => $table['task']->id,
            'title' => 'Login page',
            'url' => route('poker.show', $game),
            'estimate' => '8',
            'deckName' => $game->deckLabel(),
            'external' => ['source' => 'jira', 'key' => 'PROJ-7', 'url' => 'https://acme.atlassian.net/browse/PROJ-7'],
        ])
        ->and($jobs[0]->data['estimatedAt'])->toBeString()
        ->and($jobs[1]->data['task']['estimate'])->toBe('5')
        ->and(json_encode($jobs->map->data->all()))->not->toContain('Milo Member')
        ->and(json_encode($jobs->map->data->all()))->not->toContain('votes');
});

it('builds the payload at event time', function () {
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.created']);
    Http::fake(['hooks.example.com/*' => Http::response('', 200)]);

    $item = resolve(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Short-lived']);
    $job = pushedWebhookEvents()->sole();
    $item->delete();

    runDeliveryJob($job)->assertNotFailed();

    Http::assertSent(fn (Request $request) => json_decode($request->body(), true)['data']['actionItem']['content'] === 'Short-lived');
    expect(IntegrationDelivery::query()->sole()->status)->toBe(IntegrationDeliveryStatus::Sent);
});

it('keeps X-Skrum-Delivery across retries and signs each attempt', function () {
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.created']);
    Http::fakeSequence('hooks.example.com/*')->push('', 503)->push('', 200);
    resolve(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Retry me']);
    $job = pushedWebhookEvents()->sole();
    $retry = fn () => new DeliverWebhookEvent($job->deliveryId, $job->event, $job->occurredAt, $job->data, $job->locale);

    expect(fn () => runDeliveryJob($retry()))->toThrow(ProviderUnavailable::class);

    $this->travel(2)->minutes();
    runDeliveryJob($retry())->assertNotFailed();

    $requests = collect(Http::recorded())->map(fn (array $pair) => $pair[0]);

    expect($requests)->toHaveCount(2)
        ->and($requests->map(fn (Request $request) => $request->header('X-Skrum-Delivery')[0])->unique()->all())->toBe([$job->deliveryId])
        ->and($requests[0]->header('X-Skrum-Timestamp')[0])->not->toBe($requests[1]->header('X-Skrum-Timestamp')[0])
        ->and($requests->every(fn (Request $request) => outgoingWebhookSignatureIsValid($request)))->toBeTrue()
        ->and(IntegrationDelivery::query()->sole()->attempts)->toBe(2)
        ->and(IntegrationDelivery::query()->sole()->response_status)->toBe(200);
});

it('retries for about three and a half hours, waiting for Retry-After up to an hour', function () {
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.created']);
    Http::fake(['hooks.example.com/*' => Http::response('', 429, ['Retry-After' => '86400'])]);
    resolve(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Busy receiver']);
    $job = pushedWebhookEvents()->sole();

    expect($job->maxExceptions)->toBe(7)
        ->and($job->backoff())->toBe([30, 120, 600, 1800, 3600, 7200])
        ->and($job->retryUntil())->toBeGreaterThan(now()->addSeconds(array_sum($job->backoff())));

    runDeliveryJob($job)->assertReleased(delay: 3600);
});

it('does not retry other client errors', function () {
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.created']);
    Http::fake(['hooks.example.com/*' => Http::response('', 422)]);
    resolve(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Refused']);

    runDeliveryJob(pushedWebhookEvents()->sole())->assertFailed();

    expect(IntegrationDelivery::query()->sole()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and(IntegrationDelivery::query()->sole()->error)->toBe('The receiver answered 422.');
});

it('disables the webhook after 10 failed deliveries in a row, then stops queueing', function () {
    [$retro, , $participant] = webhookEventRetro();
    $integration = subscribedWebhook($retro->team, ['action_item.created']);
    $integration->forceFill(['consecutive_failures' => 9, 'last_delivery_succeeded_at' => now()->subDays(2)])->save();
    Http::fake(['hooks.example.com/*' => Http::response('', 404)]);
    $actor = ActionItemActor::forParticipant($participant);

    resolve(CreateActionItem::class)->handle($retro->team, $retro, $actor, ['content' => 'First']);
    resolve(CreateActionItem::class)->handle($retro->team, $retro, $actor, ['content' => 'Second']);
    [$first, $second] = pushedWebhookEvents()->all();

    runDeliveryJob($first)->assertFailed();

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->setting('disabledReason'))->toBe(WebhookHealth::FailuresReason)
        ->and($integration->fresh()->consecutive_failures)->toBe(10);

    runDeliveryJob($second)->assertFailed();

    expect(IntegrationDelivery::query()->where('id', $second->deliveryId)->sole()->error)->toBe('Webhook disabled.');
    Http::assertSentCount(1);

    resolve(CreateActionItem::class)->handle($retro->team, $retro, $actor, ['content' => 'Third']);

    expect(pushedWebhookEvents())->toHaveCount(2)
        ->and(IntegrationDelivery::query()->count())->toBe(2);
});

it('keeps sending after a failure when a delivery succeeded recently', function () {
    [$retro, , $participant] = webhookEventRetro();
    $integration = subscribedWebhook($retro->team, ['action_item.created']);
    $integration->forceFill(['consecutive_failures' => 9, 'last_delivery_succeeded_at' => now()->subHour()])->save();
    Http::fake(['hooks.example.com/*' => Http::response('', 404)]);

    resolve(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Once']);
    runDeliveryJob(pushedWebhookEvents()->sole())->assertFailed();

    expect($integration->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and($integration->fresh()->consecutive_failures)->toBe(10);
});

it('never sends automatic events to Slack, Telegram, Teams or Mattermost', function () {
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram, IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost);
    [$retro, , $participant] = webhookEventRetro();
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->mattermost()->create(['team_id' => $retro->team_id]);

    $item = resolve(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'No chat']);
    resolve(SetActionItemStatus::class)->handle($item, ActionItemActor::forParticipant($participant), ActionItemStatus::Completed);

    Queue::assertNotPushed(DeliverWebhookEvent::class);

    subscribedWebhook($retro->team);
    resolve(SetActionItemStatus::class)->handle($item->fresh(), ActionItemActor::forParticipant($participant), ActionItemStatus::Open);

    Queue::assertPushed(DeliverWebhookEvent::class, 1);
    expect(IntegrationDelivery::query()->pluck('channel')->unique()->all())->toBe([IntegrationDeliveryChannel::Webhook]);
});

it('keeps the action and later listeners alive when building an event fails', function () {
    Exceptions::fake();
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.created']);
    $this->mock(BuildWebhookEventData::class, fn ($mock) => $mock->shouldReceive('actionItemCreated')->andThrow(new RuntimeException('boom')));

    $item = resolve(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Fix the deploy']);

    expect($item->exists)->toBeTrue()
        ->and(IntegrationDelivery::query()->count())->toBe(0);
    Queue::assertNotPushed(DeliverWebhookEvent::class);
    Exceptions::assertReported(fn (RuntimeException $exception) => $exception->getMessage() === 'boom');
});

it('marks the delivery failed when queuing the event fails', function () {
    Exceptions::fake();
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.created']);
    $this->mock(Dispatcher::class, fn ($mock) => $mock->shouldReceive('dispatch')->andThrow(new RuntimeException('queue down')));

    $item = resolve(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Fix the deploy']);

    expect($item->exists)->toBeTrue()
        ->and(IntegrationDelivery::query()->sole()->status)->toBe(IntegrationDeliveryStatus::Failed);
    Exceptions::assertReported(fn (RuntimeException $exception) => $exception->getMessage() === 'queue down');
});

it('sends nothing to the webhook of another team', function () {
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook(Team::factory()->create());

    resolve(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Fix the deploy']);

    Queue::assertNotPushed(DeliverWebhookEvent::class);
    expect(IntegrationDelivery::query()->count())->toBe(0);
});

it('tells an external reopen apart with completedVia', function () {
    [$retro] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.reopened']);
    $item = ActionItem::factory()->completed()->create(['retro_id' => $retro->id]);

    resolve(SetActionItemStatus::class)->handle($item, new ExternalSyncActor('jira', 'PROJ-12'), ActionItemStatus::Open);

    $job = pushedWebhookEvents()->sole();

    expect($job->event)->toBe('action_item.reopened')
        ->and($job->data['origin'])->toBe('external')
        ->and($job->data['completedVia'])->toBe(['source' => 'jira', 'key' => 'PROJ-12']);
});

it('sends the guest suffix untranslated whatever the locale', function () {
    app()->setLocale('fr');
    [$retro] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.completed']);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Gus']);
    $assigned = ActionItem::factory()->assignedToGuest($guest)->create(['content' => 'Guest task']);

    resolve(SetActionItemStatus::class)->handle($assigned, ActionItemActor::forParticipant($guest), ActionItemStatus::Completed);

    expect(pushedWebhookEvents()->sole()->data['actionItem']['assignee'])->toBe(['name' => 'Gus (guest)']);
});

it('keeps the message of an automatic event for its delivery log', function () {
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.created']);

    resolve(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Fix the deploy']);

    $job = pushedWebhookEvents()->sole();
    $delivery = IntegrationDelivery::query()->sole();

    expect($delivery->payload->message)->toBe([
        'id' => $delivery->id,
        'event' => 'action_item.created',
        'occurredAt' => $job->occurredAt,
        'data' => $job->data,
    ]);
});

it('still sends an event whose message cannot be kept, without leaving a row nobody sends', function () {
    Exceptions::fake();
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.created']);
    IntegrationDeliveryPayload::creating(provokeDatabaseFailure(...));

    $item = resolve(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Fix the deploy']);

    $delivery = IntegrationDelivery::query()->sole();

    expect($item->exists)->toBeTrue()
        ->and($delivery->status)->toBe(IntegrationDeliveryStatus::Queued)
        ->and($delivery->payload()->exists())->toBeFalse()
        ->and(pushedWebhookEvents()->sole()->deliveryId)->toBe($delivery->id);
    Exceptions::assertReported(fn (RuntimeException $exception) => $exception->getMessage() === "Could not keep the webhook message of delivery {$delivery->id} (QueryException).");
});
