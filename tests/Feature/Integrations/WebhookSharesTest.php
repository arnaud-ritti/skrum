<?php

use App\Actions\Integrations\BuildLinkShare;
use App\Actions\Integrations\BuildRetroRecap;
use App\Actions\Integrations\QueueShare;
use App\Actions\Integrations\ShareOptions;
use App\Enums\ActionItemPriority;
use App\Enums\GameKind;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoomChanged;
use App\Jobs\Integrations\DeliverToWebhook;
use App\Models\ActionItem;
use App\Models\GameRoom;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Messages\LinkShareContent;
use App\Support\Integrations\Webhook\WebhookHealth;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
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
 * @return array{0: Retro, 1: User, 2: Participant}
 */
function webhookSharingRetro(RetroPhase $phase = RetroPhase::Discussing, bool $anonymous = false): array
{
    $factory = Retro::factory()->inPhase($phase);
    $retro = ($anonymous ? $factory->anonymous() : $factory)->create([
        'title' => 'Sprint 42',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
    ]);
    TeamIntegration::factory()->webhook()->create(['team_id' => $retro->team_id]);
    [$facilitator, $participant] = retroFacilitator($retro);
    $facilitator->forceFill(['name' => 'Fran Facilitator'])->save();

    return [$retro, $facilitator, $participant];
}

/**
 * @return array{0: GameRoom, 1: User}
 */
function webhookSharingRoom(array $attributes = []): array
{
    $room = GameRoom::factory()->create([
        'name' => 'Friday fun',
        'game' => GameKind::Hangman,
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    TeamIntegration::factory()->webhook()->create(['team_id' => $room->team_id]);
    [$host] = gameRoomHost($room);
    $host->forceFill(['name' => 'Hana Host'])->save();

    return [$room, $host];
}

it('queues a board link as retro.link', function () {
    [$retro, $facilitator] = webhookSharingRetro();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'webhook', 'kind' => 'link'])
        ->assertAccepted()
        ->assertJson(['channel' => 'webhook', 'kind' => 'retro_link', 'status' => 'queued']);

    $delivery = IntegrationDelivery::query()->sole();

    expect($delivery->event)->toBe('retro.link')
        ->and($delivery->team_integration_id)->toBe(TeamIntegration::query()->sole()->id);
    Queue::assertPushed(DeliverToWebhook::class, fn (DeliverToWebhook $job) => $job->deliveryId === $delivery->id
        && $job->event === 'retro.link'
        && $job->data === ['title' => 'Sprint 42', 'url' => route('retros.show', $retro), 'sharedBy' => 'Fran Facilitator']);
});

it('queues the results recap as structured fields without card authors', function () {
    [$retro, $facilitator, $facilitatorParticipant] = webhookSharingRetro(RetroPhase::Completed, anonymous: true);
    [$ada] = retroMember($retro);
    $ada->forceFill(['name' => 'Ada Assignee'])->save();
    [$carla, $carlaParticipant] = retroMember($retro);
    $carla->forceFill(['name' => 'Carla Author'])->save();
    webhookTopCard($retro, $carlaParticipant, $facilitatorParticipant);
    ActionItem::factory()->assignedTo($ada)->priority(ActionItemPriority::High)->create([
        'retro_id' => $retro->id,
        'content' => 'Fix the deploy',
        'due_on' => '2026-10-15',
        'created_by_participant_id' => $facilitatorParticipant->id,
        'created_by_user_id' => $facilitator->id,
    ]);

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'webhook', 'kind' => 'results'])
        ->assertAccepted()
        ->assertJson(['kind' => 'retro_results']);

    Queue::assertPushed(DeliverToWebhook::class, function (DeliverToWebhook $job) use ($retro) {
        $data = $job->data;

        return $job->event === 'retro.results'
            && $data['title'] === 'Sprint 42'
            && $data['url'] === route('retros.show', $retro)
            && is_string($data['completedAt'])
            && $data['participants'] === ['count' => 3, 'names' => null]
            && $data['cardCount'] === 1
            && $data['roti'] === null
            && $data['summary'] === null
            && $data['actionItems'] === [['content' => 'Fix the deploy', 'assignee' => 'Ada Assignee', 'dueOn' => '2026-10-15', 'priority' => 'high', 'isCompleted' => false]]
            && $data['moreActionItems'] === 0
            && $data['suggestedActions'] === []
            && $data['topCards'] === [['column' => 'Wins', 'content' => 'Faster reviews', 'votes' => 1, 'groupedCount' => 0]]
            && ! str_contains((string) json_encode($data), 'Carla Author');
    });
});

it('names participants on a named retro recap', function () {
    [$retro, $facilitator] = webhookSharingRetro(RetroPhase::Completed);
    [$ada] = retroMember($retro);
    $ada->forceFill(['name' => 'Ada Assignee'])->save();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'webhook', 'kind' => 'results'])
        ->assertAccepted();

    Queue::assertPushed(DeliverToWebhook::class, fn (DeliverToWebhook $job) => $job->data['participants'] === [
        'count' => 2,
        'names' => ['Ada Assignee', 'Fran Facilitator'],
    ]);
});

it('queues poker links as poker.link', function () {
    $game = PokerGame::factory()->create(['title' => 'Sprint 12 sizing']);
    TeamIntegration::factory()->webhook()->create(['team_id' => $game->team_id]);
    [$facilitator] = pokerFacilitator($game);

    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'webhook'])
        ->assertAccepted()
        ->assertJson(['kind' => 'poker_link']);

    Queue::assertPushed(DeliverToWebhook::class, fn (DeliverToWebhook $job) => $job->event === 'poker.link'
        && $job->data === ['title' => 'Sprint 12 sizing', 'url' => route('poker.show', $game), 'sharedBy' => $facilitator->name]);
});

it('queues game room invites as game_room.link without players or game state', function () {
    [$room, $host] = webhookSharingRoom(['access' => 'link']);
    [$player] = gameRoomMember($room);
    $player->forceFill(['name' => 'Pat Player'])->save();
    activeGameRound($room, ['word' => 'sprint']);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'webhook'])
        ->assertAccepted()
        ->assertJson(['channel' => 'webhook', 'kind' => 'game_room_link']);
    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'webhook', 'include_guest_link' => true])
        ->assertAccepted();

    $jobs = Queue::pushed(DeliverToWebhook::class)->values();

    expect($jobs)->toHaveCount(2)
        ->and($jobs[0]->event)->toBe('game_room.link')
        ->and($jobs[0]->data)->toBe([
            'title' => 'Friday fun',
            'game' => 'Hangman',
            'team' => 'Platform',
            'url' => route('games.show', $room),
            'sharedBy' => 'Hana Host',
        ])
        ->and($jobs[1]->data['url'])->toBe(route('games.join.show', $room->guest_token))
        ->and(json_encode($jobs->map->data->all()))->not->toContain('Pat Player')
        ->and(json_encode($jobs->map->data->all()))->not->toContain('sprint');
});

it('answers 404, 409 and 422 for webhook room invites', function () {
    [$room, $host] = webhookSharingRoom();

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'webhook', 'include_guest_link' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['include_guest_link' => 'Guest access is off for this room.']);

    TeamIntegration::query()->update(['status' => IntegrationStatus::ReconnectRequired->value]);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'webhook'])
        ->assertConflict()
        ->assertJson(['message' => 'Reconnect Webhook in the team settings.']);

    TeamIntegration::query()->delete();

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'webhook'])
        ->assertConflict()
        ->assertJson(['message' => 'Connect Webhook in the team settings.']);

    disableIntegrations();

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'webhook'])
        ->assertNotFound();

    Queue::assertNothingPushed();
    expect(IntegrationDelivery::query()->count())->toBe(0);
});

it('refuses guests and non-managers before validating', function () {
    [$room] = webhookSharingRoom(['access' => 'link']);
    [$member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $this->actingAs($member)
        ->postJson(route('games.shares.store', $room), ['channel' => 'bogus'])
        ->assertForbidden();

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))->withCredentials()
        ->postJson(route('games.shares.store', $room), ['channel' => 'webhook'])
        ->assertForbidden();

    Queue::assertNothingPushed();
});

it('offers the webhook channel once it is connected', function () {
    [$retro] = webhookSharingRetro();

    expect(app(ShareOptions::class)->channels($retro->team)['webhook'])->toBeTrue();

    config(['services.outgoing_webhooks.enabled' => false]);

    expect(app(ShareOptions::class)->channels($retro->fresh()->team)['webhook'])->toBeFalse();
});

it('delivers a signed share and tells the room', function () {
    Event::fake([GameRoomChanged::class]);
    Http::fake(['hooks.example.com/*' => Http::response('', 202)]);
    [$room] = webhookSharingRoom();
    $delivery = IntegrationDelivery::factory()->forSubject($room)->create([
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::GameRoomLink,
        'event' => 'game_room.link',
    ]);
    $data = ['title' => 'Friday fun', 'game' => 'Hangman', 'team' => 'Platform', 'url' => route('games.show', $room), 'sharedBy' => 'Hana Host'];

    runOutgoingWebhookJob(new DeliverToWebhook($delivery->id, 'game_room.link', '2026-10-07T10:00:00Z', $data, 'en'))
        ->assertNotFailed()
        ->assertNotReleased();

    Http::assertSent(fn (Request $request) => $request->header('X-Skrum-Event')[0] === 'game_room.link'
        && $request->header('X-Skrum-Delivery')[0] === $delivery->id
        && outgoingWebhookSignatureIsValid($request)
        && json_decode($request->body(), true)['id'] === $delivery->id
        && json_decode($request->body(), true)['occurredAt'] === '2026-10-07T10:00:00Z'
        && json_decode($request->body(), true)['data'] === $data);
    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Sent)
        ->and($delivery->fresh()->attempts)->toBe(1)
        ->and($delivery->fresh()->response_status)->toBe(202);
    Event::assertDispatched(GameRoomChanged::class);
});

it('fails a share the receiver refuses and counts it', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 404)]);
    [$room] = webhookSharingRoom();
    $delivery = IntegrationDelivery::factory()->forSubject($room)->create([
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::GameRoomLink,
        'event' => 'game_room.link',
    ]);

    runOutgoingWebhookJob(new DeliverToWebhook($delivery->id, 'game_room.link', '2026-10-07T10:00:00Z', ['title' => 'Friday fun'], 'en'))
        ->assertFailed();

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($delivery->fresh()->error)->toBe('The receiver answered 404.')
        ->and($delivery->fresh()->response_status)->toBe(404)
        ->and(TeamIntegration::query()->sole()->consecutive_failures)->toBe(1);
});

it('waits for Retry-After on 429, retries outages and counts the final failure', function () {
    Http::fakeSequence('hooks.example.com/*')
        ->push('', 429, ['Retry-After' => '12'])
        ->push('', 503);
    [$room] = webhookSharingRoom();
    $delivery = IntegrationDelivery::factory()->forSubject($room)->create([
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::GameRoomLink,
        'event' => 'game_room.link',
    ]);
    $job = fn () => new DeliverToWebhook($delivery->id, 'game_room.link', '2026-10-07T10:00:00Z', ['title' => 'Friday fun'], 'en');

    runOutgoingWebhookJob($job())->assertReleased(delay: 12);

    $exception = null;

    try {
        runOutgoingWebhookJob($job());
    } catch (ProviderUnavailable $thrown) {
        $exception = $thrown;
    }

    expect($exception)->not->toBeNull()
        ->and($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Queued)
        ->and($delivery->fresh()->attempts)->toBe(2);

    $job()->failed($exception);

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and(TeamIntegration::query()->sole()->consecutive_failures)->toBe(1);
});

it('fails queued shares of a disabled webhook without counting them', function () {
    [$room] = webhookSharingRoom();
    TeamIntegration::query()->update(['status' => IntegrationStatus::ReconnectRequired->value, 'consecutive_failures' => 10]);
    $delivery = IntegrationDelivery::factory()->forSubject($room)->create([
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::GameRoomLink,
        'event' => 'game_room.link',
    ]);

    runOutgoingWebhookJob(new DeliverToWebhook($delivery->id, 'game_room.link', '2026-10-07T10:00:00Z', ['title' => 'Friday fun'], 'en'))
        ->assertFailed();

    Http::assertNothingSent();
    expect($delivery->fresh()->error)->toBe('Webhook disabled.')
        ->and(TeamIntegration::query()->sole()->consecutive_failures)->toBe(10);
});

it('keeps the URL and the secret out of the job payload', function () {
    [$room, $host] = webhookSharingRoom();

    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'webhook'])->assertAccepted();

    Queue::assertPushed(DeliverToWebhook::class, fn (DeliverToWebhook $job) => ! str_contains(serialize($job), TeamIntegrationFactory::WebhookSecret)
        && ! str_contains(serialize($job), 'skrum/incoming'));
});

it('creates no delivery when a webhook share has no event name', function () {
    [$room, $host] = webhookSharingRoom();
    $content = app(BuildLinkShare::class)->gameRoom($room, $host, false);

    expect(fn () => app(QueueShare::class)->handle($room, IntegrationDeliveryChannel::Webhook, IntegrationDeliveryKind::Event, $host, $content))
        ->toThrow(InvalidArgumentException::class, 'Automatic events are not shares.');

    Queue::assertNothingPushed();
    expect(IntegrationDelivery::query()->count())->toBe(0);
});

it('refuses email as a share channel before creating a delivery', function () {
    [$room, $host] = webhookSharingRoom();
    $content = app(BuildLinkShare::class)->gameRoom($room, $host, false);

    expect(fn () => app(QueueShare::class)->handle($room, IntegrationDeliveryChannel::Email, IntegrationDeliveryKind::GameRoomLink, $host, $content))
        ->toThrow(InvalidArgumentException::class);

    expect(IntegrationDelivery::query()->count())->toBe(0);
});

it('sends the guest suffix untranslated in a recap, whatever the locale', function () {
    app()->setLocale('fr');
    [$retro] = webhookSharingRetro(RetroPhase::Completed);
    Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Gus']);
    ActionItem::factory()->assignedToGuest(Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Gia']))->create(['retro_id' => $retro->id]);

    $data = app(BuildRetroRecap::class)->content($retro)->toWebhook();

    expect($data['participants']['names'])->toContain('Gus (guest)')
        ->and($data['actionItems'][0]['assignee'])->toBe('Gia (guest)');
});

it('disables the webhook when a share gets a 410', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 410)]);
    [$room] = webhookSharingRoom();
    $delivery = IntegrationDelivery::factory()->forSubject($room)->create([
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::GameRoomLink,
        'event' => 'game_room.link',
    ]);

    runOutgoingWebhookJob(new DeliverToWebhook($delivery->id, 'game_room.link', '2026-10-07T10:00:00Z', ['title' => 'Friday fun'], 'en'))
        ->assertFailed();

    $integration = TeamIntegration::query()->sole();

    expect($integration->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->setting('disabledReason'))->toBe(WebhookHealth::GoneReason)
        ->and($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed);
});

it('disables the webhook on the 10th failed share in a row', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 404)]);
    [$room] = webhookSharingRoom();
    TeamIntegration::query()->update(['consecutive_failures' => 9, 'last_delivery_succeeded_at' => now()->subDays(2)]);
    $delivery = IntegrationDelivery::factory()->forSubject($room)->create([
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::GameRoomLink,
        'event' => 'game_room.link',
    ]);

    runOutgoingWebhookJob(new DeliverToWebhook($delivery->id, 'game_room.link', '2026-10-07T10:00:00Z', ['title' => 'Friday fun'], 'en'))
        ->assertFailed();

    $integration = TeamIntegration::query()->sole();

    expect($integration->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->setting('disabledReason'))->toBe(WebhookHealth::FailuresReason)
        ->and($integration->consecutive_failures)->toBe(10);
});

it('keeps the message of a webhook share for its delivery log', function () {
    [$retro, $facilitator] = webhookSharingRetro();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'webhook', 'kind' => 'link'])
        ->assertAccepted();

    $delivery = IntegrationDelivery::query()->sole();
    $message = $delivery->payload->message;

    expect($message)->toBe([
        'id' => $delivery->id,
        'event' => 'retro.link',
        'occurredAt' => $message['occurredAt'],
        'data' => ['title' => 'Sprint 42', 'url' => route('retros.show', $retro), 'sharedBy' => 'Fran Facilitator'],
    ]);
    Queue::assertPushed(DeliverToWebhook::class, fn (DeliverToWebhook $job) => $job->occurredAt === $message['occurredAt']
        && $job->data === $message['data']);
});

it('still queues a share whose message cannot be kept', function () {
    Exceptions::fake();
    [$retro, $facilitator] = webhookSharingRetro();
    $content = new LinkShareContent('Open the board', 'Open', route('retros.show', $retro), ['title' => "Sprint \xB1\x31"]);

    $delivery = app(QueueShare::class)->handle($retro, IntegrationDeliveryChannel::Webhook, IntegrationDeliveryKind::RetroLink, $facilitator, $content);

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Queued)
        ->and($delivery->payload()->exists())->toBeFalse();
    Queue::assertPushed(DeliverToWebhook::class, fn (DeliverToWebhook $job) => $job->deliveryId === $delivery->id);
    Exceptions::assertReported(fn (RuntimeException $exception) => $exception->getMessage() === "Could not keep the webhook message of delivery {$delivery->id} (JsonException).");
});

it('still queues a share when the database refuses its content', function () {
    Exceptions::fake();
    [$retro, $facilitator] = webhookSharingRetro();
    IntegrationDeliveryPayload::creating(fn () => DB::statement('select 1 / 0'));

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'webhook', 'kind' => 'link'])
        ->assertAccepted();

    $delivery = IntegrationDelivery::query()->sole();

    expect($delivery->status)->toBe(IntegrationDeliveryStatus::Queued)
        ->and($delivery->payload()->exists())->toBeFalse();
    Queue::assertPushed(DeliverToWebhook::class, 1);
    Exceptions::assertReported(fn (RuntimeException $exception) => $exception->getMessage() === "Could not keep the webhook message of delivery {$delivery->id} (QueryException).");
});
