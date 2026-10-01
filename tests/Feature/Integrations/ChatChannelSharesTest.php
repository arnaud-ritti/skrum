<?php

use App\Actions\Games\GameRoomShares;
use App\Actions\Integrations\ShareOptions;
use App\Enums\GameKind;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoomChanged;
use App\Jobs\Integrations\DeliverToChannel;
use App\Jobs\Integrations\DeliverToMattermost;
use App\Jobs\Integrations\DeliverToMicrosoftTeams;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\IntegrationDelivery;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost);
});

function connectChatChannels(string $teamId): void
{
    TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $teamId]);
    TeamIntegration::factory()->mattermost()->create(['team_id' => $teamId]);
}

/**
 * @return array{0: Retro, 1: User, 2: Participant}
 */
function chatConnectedRetro(RetroPhase $phase = RetroPhase::Discussing): array
{
    $retro = Retro::factory()->inPhase($phase)->create([
        'title' => 'Sprint *42*',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
    ]);
    connectChatChannels($retro->team_id);
    [$facilitator, $participant] = retroFacilitator($retro);
    $facilitator->forceFill(['name' => 'Fran Facilitator'])->save();

    return [$retro, $facilitator, $participant];
}

/**
 * @return array{0: PokerGame, 1: User}
 */
function chatConnectedPokerGame(): array
{
    $game = PokerGame::factory()->create(['title' => 'Sprint 12 sizing']);
    connectChatChannels($game->team_id);
    [$facilitator] = pokerFacilitator($game);

    return [$game, $facilitator];
}

/**
 * @return array{0: GameRoom, 1: User}
 */
function chatConnectedGameRoom(array $attributes = []): array
{
    $room = GameRoom::factory()->create([
        'name' => 'Friday fun',
        'game' => GameKind::Hangman,
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    connectChatChannels($room->team_id);
    [$host] = gameRoomHost($room);
    $host->forceFill(['name' => 'Hana Host'])->save();

    return [$room, $host];
}

function chatDelivery(IntegrationDeliveryChannel $channel, ?GameRoom $room = null): IntegrationDelivery
{
    $room ??= chatConnectedGameRoom()[0];

    return IntegrationDelivery::factory()->forSubject($room)->create([
        'channel' => $channel,
        'kind' => 'game_room_link',
    ]);
}

function runChatDeliveryJob(DeliverToChannel $job): DeliverToChannel
{
    $job->withFakeQueueInteractions();
    $job->handle();

    return $job;
}

it('queues board links to Teams and Mattermost', function () {
    [$retro, $facilitator] = chatConnectedRetro();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'msteams', 'kind' => 'link'])
        ->assertAccepted()
        ->assertJson(['channel' => 'msteams', 'kind' => 'retro_link', 'status' => 'queued']);
    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'mattermost', 'kind' => 'link'])
        ->assertAccepted();

    Queue::assertPushed(DeliverToMicrosoftTeams::class, fn (DeliverToMicrosoftTeams $job) => $job->message['attachments'][0]['content']['body'][0]['text'] === 'Fran Facilitator invites you to the retrospective "Sprint \*42\*" \(Platform\)'
        && $job->message['attachments'][0]['content']['actions'][0]['url'] === route('retros.show', $retro));
    Queue::assertPushed(DeliverToMattermost::class, fn (DeliverToMattermost $job) => str_contains($job->text, 'Sprint \*42\*')
        && str_ends_with($job->text, '('.route('retros.show', $retro).')'));
});

it('queues the results recap on a completed retro', function () {
    [$retro, $facilitator] = chatConnectedRetro(RetroPhase::Completed);

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'msteams', 'kind' => 'results'])
        ->assertAccepted()
        ->assertJson(['kind' => 'retro_results']);
    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'mattermost', 'kind' => 'results'])
        ->assertAccepted();

    Queue::assertPushed(DeliverToMicrosoftTeams::class, fn (DeliverToMicrosoftTeams $job) => $job->message['attachments'][0]['content']['body'][0]['text'] === 'Results of the retrospective "Sprint \*42\*"');
    Queue::assertPushed(DeliverToMattermost::class, fn (DeliverToMattermost $job) => str_starts_with($job->text, '#### Results of the retrospective "Sprint \*42\*"'));
});

it('queues poker links to both channels', function () {
    [$game, $facilitator] = chatConnectedPokerGame();

    $this->actingAs($facilitator)->postJson(route('poker.shares.store', $game), ['channel' => 'msteams'])->assertAccepted();
    $this->actingAs($facilitator)->postJson(route('poker.shares.store', $game), ['channel' => 'mattermost'])->assertAccepted();

    Queue::assertPushed(DeliverToMicrosoftTeams::class);
    Queue::assertPushed(DeliverToMattermost::class, fn (DeliverToMattermost $job) => str_contains($job->text, 'Sprint 12 sizing'));
});

it('queues game room invites without players or game state', function () {
    [$room, $host] = chatConnectedGameRoom(['access' => 'link']);
    [$player] = gameRoomMember($room);
    $player->forceFill(['name' => 'Pat Player'])->save();
    activeGameRound($room, ['word' => 'sprint']);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'msteams'])
        ->assertAccepted()
        ->assertJson(['channel' => 'msteams', 'kind' => 'game_room_link']);
    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'mattermost', 'include_guest_link' => true])
        ->assertAccepted();

    Queue::assertPushed(DeliverToMicrosoftTeams::class, function (DeliverToMicrosoftTeams $job) use ($room) {
        $json = json_encode($job->message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return str_contains($json, 'Hana Host invites you to play Hangman in \"Friday fun\" \\\\(Platform\\\\)')
            && $job->message['attachments'][0]['content']['actions'][0] === ['type' => 'Action.OpenUrl', 'title' => 'Join the game', 'url' => route('games.show', $room)]
            && ! str_contains($json, 'Pat Player')
            && ! str_contains($json, 'sprint');
    });
    Queue::assertPushed(DeliverToMattermost::class, fn (DeliverToMattermost $job) => str_contains($job->text, '[Join the game]('.route('games.join.show', $room->guest_token).')')
        && ! str_contains($job->text, 'Pat Player'));
});

it('escapes the room name for Teams and Mattermost', function () {
    [$room, $host] = chatConnectedGameRoom(['name' => '@channel ~town-square [x](http://evil)']);

    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'msteams'])->assertAccepted();
    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'mattermost'])->assertAccepted();

    Queue::assertPushed(DeliverToMicrosoftTeams::class, fn (DeliverToMicrosoftTeams $job) => str_contains(
        $job->message['attachments'][0]['content']['body'][0]['text'],
        '"@channel \~town-square \[x\]\(http://evil\)"',
    ));
    Queue::assertPushed(DeliverToMattermost::class, fn (DeliverToMattermost $job) => str_contains(
        $job->text,
        "\"@\u{200B}channel \\~\u{200B}town-square \\[x\\]\\(http://evil\\)\"",
    ) && ! str_contains($job->text, '@channel'));
});

it('answers 404, 409 and 422 for game room invites to :dataset', function (string $channel, string $label) {
    [$room, $host] = chatConnectedGameRoom();
    $provider = IntegrationDeliveryChannel::from($channel)->provider();

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => $channel, 'include_guest_link' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['include_guest_link' => 'Guest access is off for this room.']);

    TeamIntegration::query()->where('provider', $channel)->update(['status' => IntegrationStatus::ReconnectRequired->value]);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => $channel])
        ->assertConflict()
        ->assertJson(['message' => "Reconnect {$label} in the team settings."]);

    TeamIntegration::query()->where('provider', $channel)->delete();

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => $channel])
        ->assertConflict()
        ->assertJson(['message' => "Connect {$label} in the team settings."]);

    disableIntegrations();

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => $channel])
        ->assertNotFound();

    expect($provider?->label())->toBe($label);
    Queue::assertNothingPushed();
})->with([
    'msteams' => ['msteams', 'Microsoft Teams'],
    'mattermost' => ['mattermost', 'Mattermost'],
]);

it('refuses guests and non-managers before validating', function () {
    [$room] = chatConnectedGameRoom(['access' => 'link']);
    [$member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $this->actingAs($member)
        ->postJson(route('games.shares.store', $room), ['channel' => 'bogus'])
        ->assertForbidden();

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))->withCredentials()
        ->postJson(route('games.shares.store', $room), ['channel' => 'msteams'])
        ->assertForbidden();

    Queue::assertNothingPushed();
});

it('offers the new channels only when available and allowed', function () {
    [$retro, , $facilitatorParticipant] = chatConnectedRetro();
    [, $memberParticipant] = retroMember($retro);
    [$room] = chatConnectedGameRoom();
    $hostPlayer = GamePlayer::query()->where('game_room_id', $room->id)->sole();

    expect(app(ShareOptions::class)->channels($retro->team))->toBe([
        'slack' => false, 'telegram' => false, 'msteams' => true, 'mattermost' => true, 'webhook' => false,
    ])
        ->and(app(ShareOptions::class)->retro($retro, $memberParticipant))->toBe([
            'slack' => false, 'telegram' => false, 'msteams' => false, 'mattermost' => false, 'webhook' => false, 'email' => false,
        ])
        ->and(app(GameRoomShares::class)->availability($room, $hostPlayer))->toBe([
            'slack' => false, 'telegram' => false, 'msteams' => true, 'mattermost' => true, 'webhook' => false,
        ]);

    config(['services.mattermost.url' => '']);
    TeamIntegration::query()->where('team_id', $retro->team_id)->where('provider', 'msteams')->update(['status' => 'reconnect_required']);

    expect(app(ShareOptions::class)->retro($retro->fresh(), $facilitatorParticipant)['msteams'])->toBeFalse()
        ->and(app(ShareOptions::class)->retro($retro->fresh(), $facilitatorParticipant)['mattermost'])->toBeFalse();
});

it('delivers to Teams and tells the room', function () {
    Event::fake([GameRoomChanged::class]);
    Http::fake(['prod-12.westeurope.logic.azure.com/*' => Http::response('', 202)]);
    $delivery = chatDelivery(IntegrationDeliveryChannel::MicrosoftTeams);

    runChatDeliveryJob(new DeliverToMicrosoftTeams($delivery->id, ['type' => 'message', 'attachments' => []], 'en'))
        ->assertNotFailed()
        ->assertNotReleased();

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Sent);
    Event::assertDispatched(GameRoomChanged::class);
});

it('fails a Mattermost delivery whose webhook is gone and marks the connection', function () {
    Http::fake(['chat.example.com/*' => Http::response('', 404)]);
    $delivery = chatDelivery(IntegrationDeliveryChannel::Mattermost);

    runChatDeliveryJob(new DeliverToMattermost($delivery->id, 'hello', 'en'))->assertFailed();

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($delivery->fresh()->error)->toBe('Reconnect Mattermost in the team settings.')
        ->and(TeamIntegration::query()->where('provider', 'mattermost')->sole()->last_error)->toBe('The Mattermost webhook no longer works. Paste a new one.');
});

it('waits for Retry-After on 429 and retries outages', function () {
    Http::fakeSequence('prod-12.westeurope.logic.azure.com/*')
        ->push('', 429, ['Retry-After' => '12'])
        ->push('', 503);
    $delivery = chatDelivery(IntegrationDeliveryChannel::MicrosoftTeams);
    $job = new DeliverToMicrosoftTeams($delivery->id, ['type' => 'message'], 'en');

    runChatDeliveryJob($job)->assertReleased(delay: 12);

    expect(fn () => runChatDeliveryJob(new DeliverToMicrosoftTeams($delivery->id, ['type' => 'message'], 'en')))
        ->toThrow(ProviderUnavailable::class);
    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Queued);
});

it('keeps the webhook URL out of the job payload', function () {
    [$room, $host] = chatConnectedGameRoom();

    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'msteams'])->assertAccepted();
    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'mattermost'])->assertAccepted();

    Queue::assertPushed(DeliverToMicrosoftTeams::class, fn (DeliverToMicrosoftTeams $job) => ! str_contains(serialize($job), 'teams-signature'));
    Queue::assertPushed(DeliverToMattermost::class, fn (DeliverToMattermost $job) => ! str_contains(serialize($job), 'abcdefghijklmnopqrstuvwxyz'));
});
