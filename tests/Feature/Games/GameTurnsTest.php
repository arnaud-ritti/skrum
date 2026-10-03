<?php

use App\Actions\Games\ExpireGameRound;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameTurnChanged;
use App\Jobs\CloseExpiredGameTurn;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Tests\Support\FakeGameRules;

beforeEach(function () {
    Event::fake();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-27 10:00:00'));
});

/**
 * @param  array<string, mixed>  $roomAttributes
 * @return array{room: GameRoom, hostUser: mixed, host: mixed, aUser: mixed, a: mixed, bUser: mixed, b: mixed}
 */
function turnTable(array $roomAttributes = [], ?FakeGameRules $rules = null): array
{
    bindGameRules($rules ?? new FakeGameRules(takesTurns: true, timesTurns: true, turnOutcome: null));
    $room = GameRoom::factory()->create($roomAttributes);
    [$hostUser, $host] = gameRoomHost($room);
    [$aUser, $a] = gameRoomMember($room);
    [$bUser, $b] = gameRoomMember($room);

    return ['room' => $room, 'hostUser' => $hostUser, 'host' => $host, 'aUser' => $aUser, 'a' => $a, 'bUser' => $bUser, 'b' => $b];
}

function runTurnExpiryJob(string $roundId, string $turnEndsAt): void
{
    (new CloseExpiredGameTurn($roundId, $turnEndsAt))->handle(resolve(ExpireGameRound::class));
}

it('needs a turn order to start a game played in turns, from the players of the room', function () {
    ['room' => $room, 'hostUser' => $hostUser, 'a' => $a] = turnTable();
    $stranger = gameRoomMember(GameRoom::factory()->create())[1];

    $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room))->assertUnprocessable()->assertJsonValidationErrors('turn_order');
    $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room), ['turn_order' => [$a->id, $a->id]])->assertUnprocessable();
    $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room), ['turn_order' => [$stranger->id]])->assertUnprocessable();
});

it('starts with the first player of the order and a deadline from the room\'s time per turn', function () {
    ['room' => $room, 'hostUser' => $hostUser, 'a' => $a, 'b' => $b] = turnTable(['turn_seconds' => 30]);

    $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room), ['turn_order' => [$a->id, $b->id]])
        ->assertCreated()
        ->assertJsonPath('round.turnOrder', [$a->id, $b->id])
        ->assertJsonPath('round.turnPlayerId', $a->id)
        ->assertJsonPath('round.turnSeconds', 30)
        ->assertJsonPath('round.turnEndsAt', now()->addSeconds(30)->toIso8601String());

    Queue::assertPushed(CloseExpiredGameTurn::class, fn (CloseExpiredGameTurn $job) => $job->turnEndsAt === now()->addSeconds(30)->toIso8601String());
});

it('gives a round that is its own turn a deadline, and a game without turn timing none', function () {
    ['room' => $room, 'hostUser' => $hostUser] = turnTable(['turn_seconds' => 80], new FakeGameRules(timesTurns: true));

    $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room))
        ->assertCreated()
        ->assertJsonPath('round.turnOrder', [])
        ->assertJsonPath('round.turnPlayerId', null)
        ->assertJsonPath('round.turnEndsAt', now()->addSeconds(80)->toIso8601String());

    ['room' => $other, 'hostUser' => $otherHost] = turnTable(['turn_seconds' => 80], new FakeGameRules);

    $this->actingAs($otherHost)->postJson(route('games.rounds.store', $other))
        ->assertCreated()
        ->assertJsonPath('round.turnEndsAt', null);
});

it('lets the turn\'s player end the turn, and the host skip it, and moves to the next player', function () {
    ['room' => $room, 'hostUser' => $hostUser, 'aUser' => $aUser, 'a' => $a, 'b' => $b] = turnTable(['turn_seconds' => 30]);
    $round = $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room), ['turn_order' => [$a->id, $b->id]])->json('round');

    $this->travel(5)->seconds();

    $this->actingAs($aUser)->postJson(route('games.rounds.turn.store', [$room, $round['id']]), ['expected_player_id' => $a->id])
        ->assertOk()
        ->assertJsonPath('turn.turnPlayerId', $b->id)
        ->assertJsonPath('turn.turnEndsAt', now()->addSeconds(30)->toIso8601String())
        ->assertJsonPath('ended', null);

    $this->actingAs($hostUser)->postJson(route('games.rounds.turn.store', [$room, $round['id']]), ['expected_player_id' => $b->id])
        ->assertOk()
        ->assertJsonPath('turn.turnPlayerId', $a->id);

    Event::assertDispatchedTimes(GameTurnChanged::class, 2);
});

it('refuses a turn end from another player, for a turn that moved on, or in a game without turns', function () {
    ['room' => $room, 'hostUser' => $hostUser, 'bUser' => $bUser, 'host' => $host, 'a' => $a, 'b' => $b] = turnTable();
    $round = $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room), ['turn_order' => [$a->id, $b->id]])->json('round');

    $this->actingAs($bUser)->postJson(route('games.rounds.turn.store', [$room, $round['id']]), ['expected_player_id' => $a->id])->assertForbidden();
    $this->actingAs($bUser)->postJson(route('games.rounds.turn.store', [$room, $round['id']]), ['expected_player_id' => $host->id])->assertForbidden();
    $this->actingAs($bUser)->postJson(route('games.rounds.turn.store', [$room, $round['id']]), ['expected_player_id' => $b->id])->assertConflict();
    $this->actingAs($hostUser)->postJson(route('games.rounds.turn.store', [$room, $round['id']]), ['expected_player_id' => $b->id])->assertConflict();

    ['room' => $plain, 'hostUser' => $plainHost, 'host' => $host] = turnTable([], new FakeGameRules);
    $plainRound = $this->actingAs($plainHost)->postJson(route('games.rounds.store', $plain))->json('round');

    $this->actingAs($plainHost)->postJson(route('games.rounds.turn.store', [$plain, $plainRound['id']]), ['expected_player_id' => $host->id])->assertUnprocessable();
});

it('ends an expired turn from its job, and a stale job does nothing', function () {
    ['room' => $room, 'hostUser' => $hostUser, 'a' => $a, 'b' => $b] = turnTable(['turn_seconds' => 30]);
    $round = $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room), ['turn_order' => [$a->id, $b->id]])->json('round');
    $firstDeadline = now()->addSeconds(30)->toIso8601String();

    $this->travel(31)->seconds();
    runTurnExpiryJob($round['id'], $firstDeadline);

    expect(GameRound::query()->find($round['id'])->turn_player_id)->toBe($b->id);

    runTurnExpiryJob($round['id'], $firstDeadline);

    expect(GameRound::query()->find($round['id'])->turn_player_id)->toBe($b->id);
});

it('ends an expired turn on the next request of anyone, as the room timer does', function () {
    ['room' => $room, 'hostUser' => $hostUser, 'aUser' => $aUser, 'a' => $a, 'b' => $b] = turnTable(['turn_seconds' => 30]);
    $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room), ['turn_order' => [$a->id, $b->id]]);

    $this->travel(31)->seconds();

    $this->actingAs($aUser)->withHeader('X-Socket-ID', '111.222')->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('round.turnPlayerId', $b->id);

    Event::assertDispatched(fn (GameTurnChanged $event): bool => $event->payload['turnPlayerId'] === $b->id && $event->socket === null);
});

it('ends a round that is its own turn when its deadline passes', function () {
    ['room' => $room, 'hostUser' => $hostUser] = turnTable(['turn_seconds' => 30], new FakeGameRules(timesTurns: true));
    $round = $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room))->json('round');

    $this->travel(31)->seconds();
    $this->actingAs($hostUser)->getJson(route('games.snapshot.show', $room))->assertJsonPath('round', null);

    expect(GameRound::query()->find($round['id'])->outcome)->toBe(GameRoundOutcome::TimedOut);
});

it('plays the four existing games without turns, as before', function (GameKind $game) {
    $room = GameRoom::factory()->game($game)->create(['turn_seconds' => 30, 'takes_turns' => true]);
    $rules = resolve(GameRulesRegistry::class)->for($game);

    expect($rules->takesTurns($room))->toBe($game === GameKind::Hangman)
        ->and($rules->timesTurns())->toBe($game !== GameKind::SprintGif);
})->with([GameKind::DrawAndGuess, GameKind::SprintGif, GameKind::Hangman, GameKind::Decoded]);
