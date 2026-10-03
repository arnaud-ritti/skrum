<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Support\Games\GameWordBook;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Event::fake();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-27 10:00:00'));
    app()->instance(GameWordBook::class, new GameWordBook(prompts: ['en' => ['What was your first job?', 'Your perfect weekend?']]));
});

/**
 * @return array{room: GameRoom, round: array<string, mixed>, hostUser: mixed, host: mixed, aUser: mixed, a: mixed, b: mixed}
 */
function quickQuestionTable(array $roomAttributes = []): array
{
    $room = GameRoom::factory()->game(GameKind::QuickQuestion)->create($roomAttributes);
    [$hostUser, $host] = gameRoomHost($room);
    [$aUser, $a] = gameRoomMember($room);
    [, $b] = gameRoomMember($room);
    $round = test()->actingAs($hostUser)->postJson(route('games.rounds.store', $room), ['turn_order' => [$a->id, $b->id, $host->id]])->assertCreated()->json('round');

    return ['room' => $room, 'round' => $round, 'hostUser' => $hostUser, 'host' => $host, 'aUser' => $aUser, 'a' => $a, 'b' => $b];
}

it('needs a speaking order and draws a prompt', function () {
    $room = GameRoom::factory()->game(GameKind::QuickQuestion)->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertUnprocessable();

    ['round' => $round, 'a' => $a] = quickQuestionTable();

    expect($round['question'])->toBeIn(['What was your first job?', 'Your perfect weekend?'])
        ->and($round['turnPlayerId'])->toBe($a->id);
});

it('passes the word along the order and finishes after the last speaker', function () {
    ['room' => $room, 'round' => $round, 'hostUser' => $hostUser, 'host' => $host, 'aUser' => $aUser, 'a' => $a, 'b' => $b] = quickQuestionTable();
    $turn = route('games.rounds.turn.store', [$room, $round['id']]);

    $this->actingAs($aUser)->postJson($turn, ['expected_player_id' => $a->id])->assertOk()->assertJsonPath('turn.turnPlayerId', $b->id);
    $this->actingAs($hostUser)->postJson($turn, ['expected_player_id' => $b->id])->assertOk()->assertJsonPath('turn.turnPlayerId', $host->id);
    $this->actingAs($hostUser)->postJson($turn, ['expected_player_id' => $host->id])
        ->assertOk()
        ->assertJsonPath('ended.outcome', GameRoundOutcome::Finished->value)
        ->assertJsonPath('ended.question', $round['question']);

    expect(GamePoint::query()->count())->toBe(3)
        ->and(GamePoint::query()->sum('points'))->toBe(0);
});

it('lets the host change the question until the first turn ends', function () {
    ['room' => $room, 'round' => $round, 'hostUser' => $hostUser, 'aUser' => $aUser, 'a' => $a] = quickQuestionTable();
    $question = route('games.rounds.question.update', [$room, $round['id']]);

    $this->actingAs($hostUser)->putJson($question, ['text' => 'Your favourite season?'])->assertOk()->assertJsonPath('question', 'Your favourite season?');
    $this->actingAs($aUser)->postJson(route('games.rounds.turn.store', [$room, $round['id']]), ['expected_player_id' => $a->id]);
    $this->actingAs($hostUser)->putJson($question, [])->assertConflict();
});

it('gives each speaker the time per person, and moves on when it runs out', function () {
    ['room' => $room, 'round' => $round, 'aUser' => $aUser, 'b' => $b] = quickQuestionTable(['turn_seconds' => 120]);

    expect($round['turnEndsAt'])->toBe(now()->addSeconds(120)->toIso8601String());

    $this->travel(121)->seconds();
    $this->actingAs($aUser)->getJson(route('games.snapshot.show', $room))->assertJsonPath('round.turnPlayerId', $b->id);
});

it('counts as played everyone whose turn came when the host passes the round', function () {
    ['room' => $room, 'round' => $round, 'hostUser' => $hostUser, 'aUser' => $aUser, 'a' => $a, 'b' => $b] = quickQuestionTable();
    $this->actingAs($aUser)->postJson(route('games.rounds.turn.store', [$room, $round['id']]), ['expected_player_id' => $a->id]);

    $this->actingAs($hostUser)->postJson(route('games.rounds.pass.store', [$room, $round['id']]))->assertOk();

    expect(GamePoint::query()->pluck('player_id')->sort()->values()->all())->toBe(collect([$a->id, $b->id])->sort()->values()->all());
});
