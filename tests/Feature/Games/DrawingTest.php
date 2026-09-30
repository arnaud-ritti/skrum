<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameDrawingCleared;
use App\Events\Games\GameDrawingOpAdded;
use App\Events\Games\GameDrawingUndone;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\DrawingOp;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
});

/**
 * @param  array<string, mixed>  $op
 */
function postDrawingOp(GameRoom $room, GameRound $round, array $op, string $clientOpId = 'op-1'): TestResponse
{
    return test()->postJson(route('games.rounds.drawing-ops.store', [$room, $round]), ['client_op_id' => $clientOpId, 'op' => $op]);
}

/**
 * @return array<string, mixed>
 */
function drawingStroke(int $points = 2, string $color = 'blue', int $size = 10): array
{
    return ['type' => 'stroke', 'color' => $color, 'size' => $size, 'points' => array_fill(0, $points, [100, 200])];
}

it('lets the drawer commit a stroke and broadcasts it', function () {
    $table = wordGuessTable();
    $stroke = ['type' => 'stroke', 'color' => 'blue', 'size' => 10, 'points' => [[0, 0], [1000, 750]]];

    $this->actingAs($table['leaderUser']);

    postDrawingOp($table['room'], $table['round'], $stroke, 'abc-123')
        ->assertCreated()
        ->assertExactJson(['roundId' => $table['round']->id, 'op' => $stroke, 'clientOpId' => 'abc-123']);

    expect($table['round']->fresh())

        ->drawing_points->toBe(2);

    Event::assertDispatched(GameDrawingOpAdded::class, fn (GameDrawingOpAdded $event) => $event->op === $stroke
        && $event->clientOpId === 'abc-123'
        && $event->roundId === $table['round']->id);
});

it('commits fills and eraser strokes', function () {
    $table = wordGuessTable();
    $fill = ['type' => 'fill', 'color' => 'orange', 'x' => 500, 'y' => 375];
    $eraser = drawingStroke(3, 'white', 24);

    $this->actingAs($table['leaderUser']);

    postDrawingOp($table['room'], $table['round'], $fill)->assertCreated();
    postDrawingOp($table['room'], $table['round'], $eraser, 'op-2')->assertCreated();

    expect($table['round']->fresh())
        ->drawing->toEqual([$fill, $eraser])
        ->drawing_points->toBe(3);
});

it('keeps drawing to the drawer', function () {
    $table = wordGuessTable();
    $guest = gameRoomGuest($table['room']);

    foreach ([$table['hostUser'], $table['guesserUser']] as $user) {
        $this->actingAs($user);
        postDrawingOp($table['room'], $table['round'], drawingStroke())->assertForbidden();
        $this->deleteJson(route('games.rounds.drawing-ops.last.destroy', [$table['room'], $table['round']]))->assertForbidden();
        $this->deleteJson(route('games.rounds.drawing.destroy', [$table['room'], $table['round']]))->assertForbidden();
    }

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))->withCredentials()
        ->postJson(route('games.rounds.drawing-ops.store', [$table['room'], $table['round']]), ['client_op_id' => 'x', 'op' => drawingStroke()])
        ->assertForbidden();

    expect($table['round']->fresh()->drawing)->toBe([]);
});

it('refuses drawing in Decoded and on ended rounds', function () {
    $decoded = wordGuessTable(GameKind::Decoded);

    $this->actingAs($decoded['leaderUser']);
    postDrawingOp($decoded['room'], $decoded['round'], drawingStroke())->assertUnprocessable();

    $draw = wordGuessTable();
    $draw['round']->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Passed])->save();

    $this->actingAs($draw['leaderUser']);
    postDrawingOp($draw['room'], $draw['round'], drawingStroke())->assertConflict();
});

it('validates the operation and its id', function (array $body) {
    $table = wordGuessTable();

    $this->actingAs($table['leaderUser'])
        ->postJson(route('games.rounds.drawing-ops.store', [$table['room'], $table['round']]), $body)
        ->assertUnprocessable();

    expect($table['round']->fresh()->drawing)->toBe([]);
})->with([
    'missing op' => [['client_op_id' => 'op-1']],
    'missing id' => [['op' => ['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 1]]],
    'id with spaces' => [['client_op_id' => 'op 1', 'op' => ['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 1]]],
    'id too long' => [['client_op_id' => str_repeat('a', 65), 'op' => ['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 1]]],
    'pink' => [['client_op_id' => 'op-1', 'op' => ['type' => 'stroke', 'color' => 'pink', 'size' => 4, 'points' => [[1, 1]]]]],
    'size five' => [['client_op_id' => 'op-1', 'op' => ['type' => 'stroke', 'color' => 'red', 'size' => 5, 'points' => [[1, 1]]]]],
    'outside' => [['client_op_id' => 'op-1', 'op' => ['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [[1001, 1]]]]],
    'decimal' => [['client_op_id' => 'op-1', 'op' => ['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => [[1.5, 1]]]]],
    'too long stroke' => [['client_op_id' => 'op-1', 'op' => ['type' => 'stroke', 'color' => 'red', 'size' => 4, 'points' => array_fill(0, 1001, [1, 1])]]],
]);

it('accepts the last operation and point the budget allows', function () {
    $table = wordGuessTable(GameKind::DrawAndGuess, 'rocket', [
        'drawing' => array_fill(0, DrawingOp::MaxOps - 1, ['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 1]),
        'drawing_points' => DrawingOp::MaxPoints - 2,
    ]);

    $this->actingAs($table['leaderUser']);

    postDrawingOp($table['room'], $table['round'], drawingStroke(2))->assertCreated();

    expect($table['round']->fresh())
        ->drawing->toHaveCount(DrawingOp::MaxOps)
        ->drawing_points->toBe(DrawingOp::MaxPoints);
});

it('refuses operations beyond the budget', function (array $roundAttributes, array $op) {
    $table = wordGuessTable(GameKind::DrawAndGuess, 'rocket', $roundAttributes);

    $this->actingAs($table['leaderUser']);

    postDrawingOp($table['room'], $table['round'], $op)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['op' => __('The drawing is full. Clear it to keep drawing.')]);
})->with([
    'too many operations' => [
        ['drawing' => array_fill(0, 500, ['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 1])],
        ['type' => 'fill', 'color' => 'blue', 'x' => 2, 'y' => 2],
    ],
    'too many points' => [
        ['drawing' => [drawingStroke(1000)], 'drawing_points' => 19999],
        drawingStroke(2),
    ],
]);

it('undoes the last operation and frees its points', function () {
    $first = drawingStroke(3, 'red');
    $second = drawingStroke(5, 'green');
    $table = wordGuessTable(GameKind::DrawAndGuess, 'rocket', ['drawing' => [$first, $second], 'drawing_points' => 8]);

    $this->actingAs($table['leaderUser'])
        ->deleteJson(route('games.rounds.drawing-ops.last.destroy', [$table['room'], $table['round']]))
        ->assertNoContent();

    expect($table['round']->fresh())
        ->drawing->toEqual([$first])
        ->drawing_points->toBe(3);

    Event::assertDispatched(GameDrawingUndone::class, fn (GameDrawingUndone $event) => $event->roundId === $table['round']->id);
});

it('ignores an undo on an empty drawing', function () {
    $table = wordGuessTable();

    $this->actingAs($table['leaderUser'])
        ->deleteJson(route('games.rounds.drawing-ops.last.destroy', [$table['room'], $table['round']]))
        ->assertNoContent();

    Event::assertNotDispatched(GameDrawingUndone::class);
});

it('clears the drawing', function () {
    $table = wordGuessTable(GameKind::DrawAndGuess, 'rocket', ['drawing' => [drawingStroke(4)], 'drawing_points' => 4]);

    $this->actingAs($table['leaderUser'])
        ->deleteJson(route('games.rounds.drawing.destroy', [$table['room'], $table['round']]))
        ->assertNoContent();

    expect($table['round']->fresh())
        ->drawing->toBe([])
        ->drawing_points->toBe(0);

    Event::assertDispatched(GameDrawingCleared::class);
});

it('slows down a drawer sending too many operations', function () {
    $table = wordGuessTable();

    $this->actingAs($table['leaderUser']);

    foreach (range(1, 20) as $index) {
        postDrawingOp($table['room'], $table['round'], drawingStroke(), "op-{$index}")->assertCreated();
    }

    postDrawingOp($table['room'], $table['round'], drawingStroke(), 'op-21')->assertTooManyRequests();

    $this->travel(120)->milliseconds();

    postDrawingOp($table['room'], $table['round'], drawingStroke(), 'op-21')->assertCreated();
    postDrawingOp($table['room'], $table['round'], drawingStroke(), 'op-22')->assertCreated();
    postDrawingOp($table['room'], $table['round'], drawingStroke(), 'op-23')->assertTooManyRequests();
});
