<?php

use App\Actions\Games\EnsureIcebreakerRoom;
use App\Enums\GameKind;
use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoomChanged;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\IntegrationDelivery;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
});

/**
 * @return array{0: GameRoom, 1: User, 2: GamePlayer}
 */
function invitableGameRoom(array $attributes = []): array
{
    $room = GameRoom::factory()->create([
        'name' => 'Friday fun',
        'game' => GameKind::Hangman,
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    TeamIntegration::factory()->slack()->create(['team_id' => $room->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $room->team_id]);
    [$host, $hostPlayer] = gameRoomHost($room);
    $host->forceFill(['name' => 'Hana Host'])->save();

    return [$room, $host, $hostPlayer];
}

it('queues an invite for the host without any game content', function () {
    [$room, $host] = invitableGameRoom();
    [$player] = gameRoomMember($room);
    $player->forceFill(['name' => 'Pat Player'])->save();
    activeGameRound($room, ['word' => 'sprint']);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack'])
        ->assertAccepted()
        ->assertJson(['channel' => 'slack', 'kind' => 'game_room_link', 'status' => 'queued']);
    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'telegram'])
        ->assertAccepted();

    Queue::assertPushed(DeliverToSlack::class, function (DeliverToSlack $job) use ($room) {
        $json = json_encode($job->message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return str_contains($json, 'Hana Host invites you to play Hangman in \"Friday fun\" (Platform)')
            && str_contains($json, 'Join the game')
            && $job->message['blocks'][1]['elements'][0]['url'] === route('games.show', $room)
            && ! str_contains($json, 'Pat Player')
            && ! str_contains($json, 'sprint');
    });
    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => str_contains($job->html, 'Join the game')
        && str_contains($job->html, route('games.show', $room))
        && ! str_contains($job->html, 'Pat Player'));

    expect(IntegrationDelivery::query()->whereMorphedTo('subject', $room)->count())->toBe(2);
});

it('posts the guest link of a link room only on request', function () {
    [$room, $host] = invitableGameRoom(['access' => 'link']);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack', 'include_guest_link' => true])
        ->assertAccepted();
    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'telegram'])
        ->assertAccepted();

    Queue::assertPushed(DeliverToSlack::class, fn (DeliverToSlack $job) => $job->message['blocks'][1]['elements'][0]['url'] === route('games.join.show', $room->guest_token));
    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => ! str_contains($job->html, $room->guest_token));
});

it('refuses the guest link on a team room', function () {
    [$room, $host] = invitableGameRoom();

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack', 'include_guest_link' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['include_guest_link' => 'Guest access is off for this room.']);

    Queue::assertNothingPushed();
});

it('escapes the room name for both chats', function () {
    [$room, $host] = invitableGameRoom(['name' => '<!channel> & <b>fun</b>']);

    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'slack'])->assertAccepted();
    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'telegram'])->assertAccepted();

    Queue::assertPushed(DeliverToSlack::class, fn (DeliverToSlack $job) => str_contains($job->message['text'], '&lt;!channel&gt; &amp; &lt;b&gt;fun&lt;/b&gt;')
        && ! str_contains($job->message['text'], '<!channel>'));
    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => str_contains($job->html, '&lt;!channel&gt; &amp; &lt;b&gt;fun&lt;/b&gt;'));
});

it('lets the creator and workspace admins invite', function () {
    [$room] = invitableGameRoom();
    [$creator] = gameRoomMember($room);
    $room->forceFill(['created_by_user_id' => $creator->id])->save();
    $admin = workspaceManager($room->team->workspace);
    GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $admin->id]);

    $this->actingAs($creator)->postJson(route('games.shares.store', $room), ['channel' => 'slack'])->assertAccepted();
    $this->actingAs($admin)->postJson(route('games.shares.store', $room), ['channel' => 'slack'])->assertAccepted();
});

it('refuses players who do not manage the room and guests', function () {
    [$room] = invitableGameRoom(['access' => 'link']);
    [$member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $this->actingAs($member)
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack'])
        ->assertForbidden();

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))->withCredentials()
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack'])
        ->assertForbidden();

    Queue::assertNothingPushed();
});

it('has no invite for icebreaker rooms', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create();
    [$facilitator] = retroFacilitator($retro);
    $room = app(EnsureIcebreakerRoom::class)->handle($retro->fresh());
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);

    $this->actingAs($facilitator)
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack'])
        ->assertNotFound();
    $this->actingAs($facilitator)
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('share', ['slack' => false, 'telegram' => false])
        ->assertJsonPath('deliveries', []);
});

it('answers 404 for a disabled provider and 409 without an active connection', function () {
    [$room, $host] = invitableGameRoom();
    TeamIntegration::query()->where('provider', 'telegram')->delete();
    TeamIntegration::query()->where('provider', 'slack')->update(['status' => 'reconnect_required']);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'telegram'])
        ->assertConflict()
        ->assertJson(['message' => 'Connect Telegram in the team settings.']);
    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack'])
        ->assertConflict()
        ->assertJson(['message' => 'Reconnect Slack in the team settings.']);

    config(['services.slack.client_id' => null]);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack'])
        ->assertNotFound();
    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'email'])
        ->assertUnprocessable();

    Queue::assertNothingPushed();
});

it('limits invites to five a minute', function () {
    [$room, $host] = invitableGameRoom();

    foreach (range(1, 5) as $attempt) {
        $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'slack'])->assertAccepted();
    }

    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'slack'])->assertTooManyRequests();
});

it('tells the room when a delivery finished', function () {
    Event::fake([GameRoomChanged::class]);
    Http::fake(['hooks.slack.com/*' => Http::response('ok')]);
    [$room] = invitableGameRoom();
    $delivery = IntegrationDelivery::factory()->forSubject($room)->create([
        'team_id' => $room->team_id,
        'channel' => 'slack',
        'kind' => 'game_room_link',
        'status' => 'queued',
    ]);

    $job = new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en');
    $job->withFakeQueueInteractions();
    $job->handle();

    expect($delivery->fresh()->status->value)->toBe('sent');
    Event::assertDispatched(GameRoomChanged::class, fn (GameRoomChanged $event) => $event->roomId === $room->id
        && $event->broadcastOn()->name === "presence-game.{$room->id}");
});

it('shows the invite state to managers only', function () {
    [$room, $host, $hostPlayer] = invitableGameRoom();
    [$member] = gameRoomMember($room);
    IntegrationDelivery::factory()->forSubject($room)->failed('Reconnect Slack in the team settings.')->create([
        'team_id' => $room->team_id,
        'channel' => 'slack',
        'kind' => 'game_room_link',
    ]);

    $this->actingAs($host)
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('share', ['slack' => true, 'telegram' => true])
        ->assertJsonPath('deliveries.0.status', 'failed')
        ->assertJsonPath('room.teamName', 'Platform');
    $this->actingAs($member)
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('share', ['slack' => false, 'telegram' => false])
        ->assertJsonPath('deliveries', []);
});

it('deletes the room deliveries with the room', function () {
    [$room, $host] = invitableGameRoom();
    $room->forceFill(['created_by_user_id' => $host->id])->save();
    IntegrationDelivery::factory()->forSubject($room)->create(['team_id' => $room->team_id, 'channel' => 'slack', 'kind' => 'game_room_link']);

    $this->actingAs($host)->deleteJson(route('games.destroy', $room))->assertNoContent();

    expect(IntegrationDelivery::query()->count())->toBe(0);
});
