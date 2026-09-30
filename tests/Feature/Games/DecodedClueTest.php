<?php

use App\Actions\Games\BuildGameSnapshot;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameClueChanged;
use App\Models\GameRoom;
use App\Models\GameRound;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
});

function putClue(GameRoom $room, GameRound $round, mixed $clue): TestResponse
{
    return test()->putJson(route('games.rounds.clue.update', [$room, $round]), ['clue' => $clue]);
}

it('lets the clue giver set up to five emoji', function () {
    $table = wordGuessTable(GameKind::Decoded);
    $clue = ['🚀', '🔥', '👨‍💻', '👍🏽', '🏳️‍🌈'];

    $this->actingAs($table['leaderUser']);

    putClue($table['room'], $table['round'], $clue)
        ->assertOk()
        ->assertExactJson(['roundId' => $table['round']->id, 'clue' => $clue]);

    expect($table['round']->fresh()->clue)->toBe($clue);

    Event::assertDispatched(GameClueChanged::class, fn (GameClueChanged $event) => $event->clue === $clue
        && ! gamePayloadExposesWord($event->broadcastWith(), 'rocket'));
});

it('clears the clue', function () {
    $table = wordGuessTable(GameKind::Decoded, 'rocket', ['clue' => ['🚀']]);

    $this->actingAs($table['leaderUser']);

    putClue($table['room'], $table['round'], [])->assertOk()->assertJsonPath('clue', []);

    expect($table['round']->fresh()->clue)->toBe([]);
});

it('refuses more than five emoji', function () {
    $table = wordGuessTable(GameKind::Decoded);

    $this->actingAs($table['leaderUser']);

    putClue($table['room'], $table['round'], ['🚀', '🔥', '🐛', '🎉', '🧠', '🍕'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['clue' => __('A clue holds five emoji at most.')]);
});

it('refuses letters, digits and letter-like emoji in a clue', function (string $item) {
    $table = wordGuessTable(GameKind::Decoded);

    $this->actingAs($table['leaderUser']);

    putClue($table['room'], $table['round'], ['🚀', $item])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['clue.1' => __('Use emoji only, without letters or digits.')]);

    expect($table['round']->fresh()->clue)->toBe([]);
})->with(['1️⃣', '#️⃣', '🇫🇷', '🅰️', '🆗', 'ℹ️', 'Ⓜ️', '🔤', 'a', 'rocket', '🚀🚀']);

it('refuses a clue that is not a list', function (mixed $clue) {
    $table = wordGuessTable(GameKind::Decoded);

    $this->actingAs($table['leaderUser']);

    putClue($table['room'], $table['round'], $clue)->assertUnprocessable();
})->with([
    'text' => '🚀',
    'keyed' => [['first' => '🚀']],
    'missing' => null,
]);

it('keeps the clue to the clue giver of an active Decoded round', function () {
    $decoded = wordGuessTable(GameKind::Decoded);

    $this->actingAs($decoded['hostUser']);
    putClue($decoded['room'], $decoded['round'], ['🚀'])->assertForbidden();

    $this->actingAs($decoded['guesserUser']);
    putClue($decoded['room'], $decoded['round'], ['🚀'])->assertForbidden();

    $draw = wordGuessTable(GameKind::DrawAndGuess);

    $this->actingAs($draw['leaderUser']);
    putClue($draw['room'], $draw['round'], ['🚀'])->assertUnprocessable();

    $decoded['round']->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Passed])->save();

    $this->actingAs($decoded['leaderUser']);
    putClue($decoded['room'], $decoded['round'], ['🚀'])->assertConflict();

    expect($decoded['round']->fresh()->clue)->toBe([]);
});

it('slows down a clue giver editing too fast', function () {
    $table = wordGuessTable(GameKind::Decoded);

    $this->actingAs($table['leaderUser']);

    foreach (range(1, 5) as $index) {
        putClue($table['room'], $table['round'], ['🚀'])->assertOk();
    }

    putClue($table['room'], $table['round'], ['🔥'])->assertTooManyRequests();
});

it('hands the emoji list location to every player', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    gameRoomHost($room);
    $guest = gameRoomGuest($room);

    expect(app(BuildGameSnapshot::class)->handle($room, $guest)['emojiData'])->toBe([
        'baseUrl' => '/emoji-data/'.config('services.emoji_data.version'),
        'locale' => 'en',
    ]);
});
