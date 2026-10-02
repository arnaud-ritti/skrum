<?php

use App\Actions\Games\EndGameRound;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Events\Games\TeamGameRoomChanged;
use App\Events\Games\TeamGameRoomDeleted;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Support\Facades\Event;
use Tests\Support\FakeGameRules;

beforeEach(function () {
    Event::fake();
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
    bindGameRules(new FakeGameRules(kind: GameKind::Hangman, word: 'engine'));
});

function teamGamesChannelRequest(string $channel): array
{
    return ['socket_id' => '1234.5678', 'channel_name' => $channel];
}

it('sends the new room when a room is created', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->actingAs($user)
        ->post(route('teams.games.store', ['workspace' => $team->workspace->slug, 'team' => $team->id]), [
            'name' => 'Lunch',
            'game' => 'hangman',
            'access' => 'team',
        ])
        ->assertRedirect();

    $room = GameRoom::query()->sole();

    Event::assertDispatchedTimes(TeamGameRoomChanged::class, 1);
    Event::assertDispatched(fn (TeamGameRoomChanged $event) => $event->broadcastOn()->name === "private-team-games.{$team->id}"
        && $event->broadcastAs() === 'team.game-room.changed'
        && $event->broadcastWith()['room']['id'] === $room->id
        && $event->broadcastWith()['room']['status'] === 'waiting'
        && $event->broadcastWith()['room']['playersCount'] === 1
        && $event->broadcastWith()['room']['roundStartedAt'] === null);
});

it('sends the room when it is renamed', function () {
    $room = GameRoom::factory()->create(['name' => 'Lunch']);
    [$host] = gameRoomHost($room);

    $this->actingAs($host)->patchJson(route('games.update', $room), ['name' => 'Coffee'])->assertNoContent();

    Event::assertDispatchedTimes(TeamGameRoomChanged::class, 1);
    Event::assertDispatched(fn (TeamGameRoomChanged $event) => $event->broadcastWith()['room']['name'] === 'Coffee');
});

it('sends the room when its access changes', function () {
    $room = GameRoom::factory()->create();
    [$host] = gameRoomHost($room);

    $this->actingAs($host)->patchJson(route('games.update', $room), ['access' => 'link'])->assertNoContent();

    Event::assertDispatchedTimes(TeamGameRoomChanged::class, 1);
    Event::assertDispatched(fn (TeamGameRoomChanged $event) => $event->broadcastWith()['room']['access'] === 'link');
});

it('sends the room when its host changes', function () {
    $room = GameRoom::factory()->create();
    [$host] = gameRoomHost($room);
    [, $other] = gameRoomMember($room);

    $this->actingAs($host)->putJson(route('games.host.update', $room), ['player_id' => $other->id])->assertNoContent();

    Event::assertDispatchedTimes(TeamGameRoomChanged::class, 1);
});

it('sends the room when its game is switched', function () {
    bindGameRules(new FakeGameRules(kind: GameKind::Hangman), new FakeGameRules(kind: GameKind::DrawAndGuess));
    $room = GameRoom::factory()->create();
    [$host] = gameRoomHost($room);

    $this->actingAs($host)->putJson(route('games.game.update', $room), ['game' => 'draw'])->assertNoContent();

    Event::assertDispatchedTimes(TeamGameRoomChanged::class, 1);
    Event::assertDispatched(fn (TeamGameRoomChanged $event) => $event->broadcastWith()['room']['game'] === 'draw');
});

it('sends the room as playing when a round starts', function () {
    $room = GameRoom::factory()->create();
    [$host] = gameRoomHost($room);

    $this->actingAs($host)->postJson(route('games.rounds.store', $room))->assertCreated();

    $round = GameRound::query()->sole();

    Event::assertDispatchedTimes(TeamGameRoomChanged::class, 1);
    Event::assertDispatched(fn (TeamGameRoomChanged $event) => $event->broadcastWith()['room']['status'] === 'playing'
        && $event->broadcastWith()['room']['roundStartedAt'] === $round->started_at->toIso8601String());
});

it('sends the room once when a round starts over an active one', function () {
    bindGameRules(new FakeGameRules(kind: GameKind::Hangman, nextRoundOutcome: GameRoundOutcome::Abandoned));
    $room = GameRoom::factory()->create();
    [$host] = gameRoomHost($room);
    activeGameRound($room);

    $this->actingAs($host)->postJson(route('games.rounds.store', $room))->assertCreated();

    Event::assertDispatchedTimes(TeamGameRoomChanged::class, 1);
    Event::assertDispatched(fn (TeamGameRoomChanged $event) => $event->broadcastWith()['room']['status'] === 'playing');
});

it('sends the room once when its game is switched during a round', function () {
    bindGameRules(new FakeGameRules(kind: GameKind::Hangman), new FakeGameRules(kind: GameKind::DrawAndGuess));
    $room = GameRoom::factory()->create();
    [$host] = gameRoomHost($room);
    activeGameRound($room);

    $this->actingAs($host)->putJson(route('games.game.update', $room), ['game' => 'draw'])->assertNoContent();

    Event::assertDispatchedTimes(TeamGameRoomChanged::class, 1);
    Event::assertDispatched(fn (TeamGameRoomChanged $event) => $event->broadcastWith()['room']['game'] === 'draw'
        && $event->broadcastWith()['room']['status'] === 'waiting');
});

it('sends the room as waiting when a round ends', function () {
    $room = GameRoom::factory()->create();
    gameRoomHost($room);
    $round = activeGameRound($room);

    resolve(EndGameRound::class)->handle($room->fresh(), $round, GameRoundOutcome::TimedOut);

    Event::assertDispatchedTimes(TeamGameRoomChanged::class, 1);
    Event::assertDispatched(fn (TeamGameRoomChanged $event) => $event->broadcastWith()['room']['status'] === 'waiting'
        && $event->broadcastWith()['room']['roundsCount'] === 1);
});

it('sends the room when a guest joins', function () {
    $room = GameRoom::factory()->linkAccess()->create();

    $this->post(route('games.join.store', $room->guest_token), ['name' => 'Happy Otter'])->assertRedirect();

    Event::assertDispatchedTimes(TeamGameRoomChanged::class, 1);
    Event::assertDispatched(fn (TeamGameRoomChanged $event) => $event->broadcastWith()['room']['playersCount'] === 1);
});

it('sends the room when a team member opens it for the first time', function () {
    $room = GameRoom::factory()->create();
    $member = teamMember($room->team);

    $this->actingAs($member)->get(route('games.snapshot.show', $room))->assertOk();
    $this->actingAs($member)->get(route('games.snapshot.show', $room))->assertOk();

    Event::assertDispatchedTimes(TeamGameRoomChanged::class, 1);
});

it('sends the id of a deleted room', function () {
    $room = GameRoom::factory()->create();
    [$host] = gameRoomHost($room);
    $room->forceFill(['created_by_user_id' => $host->id])->save();

    $this->actingAs($host)->deleteJson(route('games.destroy', $room))->assertNoContent();

    Event::assertDispatched(fn (TeamGameRoomDeleted $event) => $event->broadcastOn()->name === "private-team-games.{$room->team_id}"
        && $event->broadcastAs() === 'team.game-room.deleted'
        && $event->broadcastWith() === ['roomId' => $room->id]);
});

it('sends nothing for an icebreaker room', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    $room = GameRoom::factory()->icebreaker($retro)->create();
    $round = activeGameRound($room);

    resolve(EndGameRound::class)->handle($room->fresh(), $round, GameRoundOutcome::TimedOut);

    Event::assertNotDispatched(TeamGameRoomChanged::class);
    Event::assertNotDispatched(TeamGameRoomDeleted::class);
});

it('keeps every secret out of the payload', function () {
    $room = GameRoom::factory()->create();
    [$host] = gameRoomHost($room);

    $this->actingAs($host)->postJson(route('games.rounds.store', $room))->assertCreated();

    Event::assertDispatched(fn (TeamGameRoomChanged $event) => ! gamePayloadExposesWord($event->broadcastWith(), 'engine'));
});

it('lets a team member join the team games channel', function () {
    $team = Team::factory()->create();

    $response = $this->actingAs(teamMember($team))
        ->postJson(route('broadcasting.auth'), teamGamesChannelRequest("private-team-games.{$team->id}"))
        ->assertOk();

    expect($response->json('auth'))->toStartWith('test-key:');
});

it('keeps other teams, other workspaces, room guests and visitors out of the team games channel', function (string $who) {
    $room = GameRoom::factory()->linkAccess()->create();
    $team = $room->team;
    $request = match ($who) {
        'other team' => $this->actingAs(teamMember(Team::factory()->create(['workspace_id' => $team->workspace_id]))),
        'other workspace' => $this->actingAs(teamMember(Team::factory()->create())),
        'guest' => $this->withCookies(gameGuestCookie(GamePlayer::factory()->guest()->create(['game_room_id' => $room->id])))->withCredentials(),
        'visitor' => $this,
    };

    $request->postJson(route('broadcasting.auth'), teamGamesChannelRequest("private-team-games.{$team->id}"))
        ->assertForbidden();
})->with(['other team', 'other workspace', 'guest', 'visitor']);
