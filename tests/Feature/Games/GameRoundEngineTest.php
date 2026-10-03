<?php

use App\Actions\Games\AwardRoundPoints;
use App\Actions\Games\EndGameRound;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoomChanged;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundStarted;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Tests\Support\FakeGameRules;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
    $this->rules = new FakeGameRules;
    bindGameRules($this->rules);
});

it('starts a round for the host', function () {
    $room = GameRoom::factory()->create();
    [$user, $host] = gameRoomHost($room);

    $response = $this->actingAs($user)
        ->postJson(route('games.rounds.store', $room))
        ->assertCreated()
        ->assertJsonPath('round.game', 'hangman')
        ->assertJsonPath('round.viewerPlayerId', $host->id)
        ->assertJsonPath('ended', null);

    $round = GameRound::query()->sole();

    expect($response->json('round.id'))->toBe($round->id)
        ->and($round->word)->toBe('engine')
        ->and($round->started_at->toIso8601String())->toBe('2026-10-06T10:00:00+00:00')
        ->and($room->fresh()->current_round_id)->toBe($round->id)
        ->and(gamePayloadExposesWord($response->json(), 'engine'))->toBeFalse();

    Event::assertDispatched(fn (GameRoundStarted $event) => $event->round['id'] === $round->id
        && $event->round['viewerPlayerId'] === null);
});

it('keeps starting rounds to the host', function () {
    $room = GameRoom::factory()->create();
    gameRoomHost($room);
    [$member] = gameRoomMember($room);

    $this->actingAs($member)->postJson(route('games.rounds.store', $room))->assertForbidden();

    expect(GameRound::query()->count())->toBe(0);
});

it('refuses a game without available rules', function () {
    $this->rules->available = false;
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['game' => __('This game is not available.')]);
});

it('refuses a second start while a round is active', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);
    activeGameRound($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))
        ->assertConflict()
        ->assertJsonPath('message', __('A round is already in progress.'));

    expect(GameRound::query()->count())->toBe(1);
});

it('closes the active round first when its rules allow it', function () {
    $this->rules->nextRoundOutcome = GameRoundOutcome::Revealed;
    $room = GameRoom::factory()->create();
    [$user, $host] = gameRoomHost($room);
    $previous = activeGameRound($room);
    $this->rules->points = [$host->id => ['points' => 4, 'isWin' => false]];

    $response = $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated();

    expect($previous->fresh()->outcome)->toBe(GameRoundOutcome::Revealed)
        ->and($response->json('ended.roundId'))->toBe($previous->id)
        ->and($response->json('ended.points'))->toBe([['playerId' => $host->id, 'points' => 4, 'isWin' => false]])
        ->and($room->fresh()->current_round_id)->not->toBe($previous->id);
});

it('validates the leader of a new round', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);
    [, $member] = gameRoomMember($room);
    $stranger = GamePlayer::factory()->create();

    $this->actingAs($user)->postJson(route('games.rounds.store', $room), ['leader_player_id' => $stranger->id])->assertUnprocessable();
    $this->actingAs($user)->postJson(route('games.rounds.store', $room), ['leader_player_id' => $member->id])
        ->assertCreated()
        ->assertJsonPath('round.leaderPlayerId', $member->id);
});

it('keeps the newest twenty ended rounds and their points', function () {
    $room = GameRoom::factory()->create();
    [$user, $host] = gameRoomHost($room);
    $rounds = collect(range(1, 21))->map(fn (int $minutes) => GameRound::factory()->ended()->create([
        'game_room_id' => $room->id,
        'ended_at' => now()->subMinutes(30 - $minutes),
    ]));
    $oldest = $rounds->first();
    $point = GamePoint::factory()->create([
        'team_id' => $room->team_id,
        'game_room_id' => $room->id,
        'game_round_id' => $oldest->id,
        'player_id' => $host->id,
        'points' => 5,
    ]);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated();

    expect(GameRound::query()->whereNotNull('ended_at')->count())->toBe(20)
        ->and(GameRound::query()->find($oldest->id))->toBeNull()
        ->and($point->fresh()->game_round_id)->toBeNull()
        ->and($point->fresh()->points)->toBe(5);
});

it('ends a round once, awarding the points of its rules', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    [$user, $member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);
    $round = activeGameRound($room);
    $this->rules->points = [
        $member->id => ['points' => 7, 'isWin' => true],
        $guest->id => ['points' => 0, 'isWin' => false],
    ];

    $payload = resolve(EndGameRound::class)->handle($room, $round, GameRoundOutcome::Solved, $member);

    expect($payload)->toBe([
        'roundId' => $round->id,
        'outcome' => 'solved',
        'word' => 'sprint',
        'winnerPlayerId' => $member->id,
        'leaderPlayerId' => null,
        'number' => null,
        'roundsTotal' => null,
        'fakeExtra' => true,
        'points' => [
            ['playerId' => $member->id, 'points' => 7, 'isWin' => true],
            ['playerId' => $guest->id, 'points' => 0, 'isWin' => false],
        ],
    ]);

    $memberPoint = GamePoint::query()->where('player_id', $member->id)->sole();

    expect($memberPoint->user_id)->toBe($user->id)
        ->and($memberPoint->team_id)->toBe($room->team_id)
        ->and($memberPoint->game)->toBe(GameKind::Hangman)
        ->and($memberPoint->is_win)->toBeTrue()
        ->and(GamePoint::query()->where('player_id', $guest->id)->sole()->user_id)->toBeNull()
        ->and(resolve(EndGameRound::class)->handle($room, $round->fresh(), GameRoundOutcome::Passed))->toBeNull()
        ->and(GamePoint::query()->count())->toBe(2)
        ->and($round->fresh()->outcome)->toBe(GameRoundOutcome::Solved);

    Event::assertDispatchedTimes(GameRoundEnded::class, 1);
});

it('awards nothing for abandoned rounds', function () {
    $room = GameRoom::factory()->create();
    [, $member] = gameRoomMember($room);
    $round = activeGameRound($room);
    $this->rules->points = [$member->id => ['points' => 3, 'isWin' => false]];

    $payload = resolve(EndGameRound::class)->handle($room, $round, GameRoundOutcome::Abandoned);

    expect($payload['points'])->toBe([])
        ->and(GamePoint::query()->count())->toBe(0);
});

it('copies the participant user of icebreaker players and ignores players of other rooms', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [$user, $participant] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();
    $player = GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);
    $stranger = GamePlayer::factory()->create();
    $round = activeGameRound($room);
    $this->rules->points = [
        $player->id => ['points' => 2, 'isWin' => false],
        $stranger->id => ['points' => 9, 'isWin' => true],
    ];

    $awarded = resolve(AwardRoundPoints::class)->handle($room, $round);

    expect($awarded)->toBe([['playerId' => $player->id, 'points' => 2, 'isWin' => false]])
        ->and(GamePoint::query()->sole()->user_id)->toBe($user->id);
});

it('lets the host or the leader pass', function (string $who) {
    $room = GameRoom::factory()->create();
    [$hostUser] = gameRoomHost($room);
    [$leaderUser, $leader] = gameRoomMember($room);
    $round = activeGameRound($room, ['leader_player_id' => $leader->id]);
    $actor = $who === 'host' ? $hostUser : $leaderUser;

    $this->actingAs($actor)
        ->postJson(route('games.rounds.pass.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('ended.outcome', 'passed')
        ->assertJsonPath('ended.word', 'sprint');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Passed);
    Event::assertDispatched(GameRoundEnded::class);
})->with(['host', 'leader']);

it('refuses a pass from other players and on ended rounds', function () {
    $room = GameRoom::factory()->create();
    [$hostUser] = gameRoomHost($room);
    [$member] = gameRoomMember($room);
    $round = activeGameRound($room);

    $this->actingAs($member)->postJson(route('games.rounds.pass.store', [$room, $round]))->assertForbidden();

    $round->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Solved])->save();

    $this->actingAs($hostUser)->postJson(route('games.rounds.pass.store', [$room, $round]))
        ->assertConflict()
        ->assertJsonPath('message', __('This round is over.'));
});

it('switches the game and abandons the active round without points', function () {
    bindGameRules($this->rules, new FakeGameRules(kind: GameKind::Decoded));
    $room = GameRoom::factory()->create();
    [$user, $host] = gameRoomHost($room);
    $round = activeGameRound($room);
    $this->rules->points = [$host->id => ['points' => 3, 'isWin' => false]];

    $this->actingAs($user)->putJson(route('games.game.update', $room), ['game' => 'decoded'])->assertNoContent();

    expect($room->fresh()->game)->toBe(GameKind::Decoded)
        ->and($round->fresh()->outcome)->toBe(GameRoundOutcome::Abandoned)
        ->and(GamePoint::query()->count())->toBe(0);

    Event::assertDispatched(fn (GameRoundEnded $event) => $event->payload['word'] === 'sprint');
    Event::assertDispatched(GameRoomChanged::class);
});

it('refuses unavailable games and non-hosts when switching', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);
    [$member] = gameRoomMember($room);

    $this->actingAs($user)->putJson(route('games.game.update', $room), ['game' => 'gif'])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('games.game.update', $room), ['game' => 'chess'])->assertUnprocessable();
    $this->actingAs($member)->putJson(route('games.game.update', $room), ['game' => 'hangman'])->assertForbidden();
});

it('lists ended rounds and shows one with its game details', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);
    $ended = GameRound::factory()->ended()->word('kite')->create(['game_room_id' => $room->id]);
    $active = activeGameRound($room, ['word' => 'hidden']);

    $index = $this->actingAs($user)->getJson(route('games.rounds.index', $room))->assertOk();

    expect(array_column($index->json(), 'id'))->toBe([$ended->id])
        ->and(gamePayloadExposesWord($index->json(), 'hidden'))->toBeFalse();

    $this->actingAs($user)->getJson(route('games.rounds.show', [$room, $ended]))
        ->assertOk()
        ->assertJsonPath('word', 'kite')
        ->assertJsonPath('fakeDetail', true);

    $this->actingAs($user)->getJson(route('games.rounds.show', [$room, $active]))->assertNotFound();
});

it('scopes rounds to their room', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);
    $foreign = GameRound::factory()->ended()->create();

    $this->actingAs($user)->getJson(route('games.rounds.show', [$room, $foreign]))->assertNotFound();
});

it('plays an icebreaker only during the icebreaker phase and while unlocked', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$user] = retroFacilitator($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))
        ->assertForbidden()
        ->assertJsonPath('message', __('The game can only be played during the icebreaker.'));

    $retro->update(['phase' => RetroPhase::Icebreaker, 'is_locked' => true]);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertStatus(423);

    $retro->update(['is_locked' => false]);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated();
});
