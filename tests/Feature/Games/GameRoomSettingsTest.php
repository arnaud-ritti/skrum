<?php

use App\Actions\Games\EnsureIcebreakerRoom;
use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoomChanged;
use App\Models\GameRoom;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(fn () => Event::fake());

it('lets the host change every setting, and tells the other players', function () {
    $room = GameRoom::factory()->create();
    [$user, $host] = gameRoomHost($room);

    $this->actingAs($user)->patchJson(route('games.update', $room), [
        'word_themes' => ['work', 'food', 'work'],
        'turn_seconds' => 30,
        'auto_hints' => true,
        'takes_turns' => true,
        'rounds_per_game' => 3,
        'gif_votes' => 2,
        'gif_authors_hidden' => true,
    ])->assertUnprocessable()->assertJsonValidationErrors('word_themes.2');

    $this->actingAs($user)->patchJson(route('games.update', $room), [
        'word_themes' => ['food', 'work'],
        'turn_seconds' => 30,
        'auto_hints' => true,
        'takes_turns' => true,
        'rounds_per_game' => 3,
        'gif_votes' => 2,
        'gif_authors_hidden' => true,
    ])->assertNoContent();

    expect(gameSnapshotFor($room->fresh(), $host)['room']['settings'])->toBe([
        'wordThemes' => ['work', 'food'],
        'turnSeconds' => 30,
        'autoHints' => true,
        'takesTurns' => true,
        'roundsPerGame' => 3,
        'gifVotes' => 2,
        'gifAuthorsHidden' => true,
    ]);

    Event::assertDispatched(GameRoomChanged::class);
});

it('clears the themes, the time per turn and the number of rounds with null or an empty list', function () {
    $room = GameRoom::factory()->create(['word_themes' => ['food'], 'turn_seconds' => 30, 'rounds_per_game' => 5]);
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->patchJson(route('games.update', $room), ['word_themes' => [], 'turn_seconds' => null, 'rounds_per_game' => null])->assertNoContent();

    expect($room->fresh())
        ->word_themes->toBeNull()
        ->turn_seconds->toBeNull()
        ->rounds_per_game->toBeNull();
});

it('refuses values outside the lists', function (array $input) {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);

    $before = $room->fresh()->only(array_keys($input));

    $this->actingAs($user)->patchJson(route('games.update', $room), $input)
        ->assertUnprocessable()
        ->assertOnlyJsonValidationErrors(array_map(fn (string $field): string => $field === 'word_themes' ? 'word_themes.0' : $field, array_keys($input)));

    expect($room->fresh()->only(array_keys($input)))->toBe($before);
})->with([
    'unknown theme' => [['word_themes' => ['films']]],
    'odd time' => [['turn_seconds' => 25]],
    'too many rounds' => [['rounds_per_game' => 21]],
    'no round' => [['rounds_per_game' => 0]],
    'too many votes' => [['gif_votes' => 4]],
    'no vote' => [['gif_votes' => 0]],
    'not a switch' => [['takes_turns' => 'maybe']],
]);

it('refuses the settings to a player who does not manage the room, and to a guest', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    gameRoomHost($room);
    [$member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $this->actingAs($member)->patchJson(route('games.update', $room), ['turn_seconds' => 30])->assertForbidden();

    resolve('auth')->forgetGuards();

    $this->withCredentials()->withCookies(gameGuestCookie($guest))
        ->patchJson(route('games.update', $room), ['turn_seconds' => 30])
        ->assertForbidden();

    expect($room->fresh()->turn_seconds)->toBeNull();
});

it('lets the facilitator set an icebreaker room, without its language, and still refuses its name', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [$user] = retroFacilitator($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs($user)->patchJson(route('games.update', $room), ['takes_turns' => true, 'turn_seconds' => 45])->assertNoContent();
    $this->actingAs($user)->patchJson(route('games.update', $room), ['name' => 'Nope', 'takes_turns' => false])->assertUnprocessable();
    $this->actingAs($user)->patchJson(route('games.update', $room), [])->assertUnprocessable();

    expect($room->fresh())->takes_turns->toBeTrue()->turn_seconds->toBe(45);
});

it('lets the facilitator turn the time per turn of an icebreaker room off', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [$user] = retroFacilitator($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create(['turn_seconds' => 30]);

    $this->actingAs($user)->patchJson(route('games.update', $room), ['turn_seconds' => null])->assertNoContent();

    expect($room->fresh()->turn_seconds)->toBeNull();
});

it('starts a new room with turns in hangman, two GIF votes and hidden authors', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);
    $team = $room->team;

    $this->actingAs($user)->post(route('teams.games.store', [$team->workspace, $team]), [
        'name' => 'Friday', 'game' => GameKind::Hangman->value, 'access' => GameRoomAccess::Team->value,
    ])->assertRedirect();

    expect(GameRoom::query()->where('name', 'Friday')->sole())
        ->takes_turns->toBeTrue()
        ->gif_votes->toBe(2)
        ->gif_authors_hidden->toBeTrue()
        ->turn_seconds->toBeNull()
        ->rounds_per_game->toBeNull();
});

it('starts an icebreaker room with the same defaults', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    retroFacilitator($retro);

    $room = resolve(EnsureIcebreakerRoom::class)->handle($retro->fresh());

    expect($room->fresh())->takes_turns->toBeTrue()->gif_votes->toBe(2)->gif_authors_hidden->toBeTrue();
});
