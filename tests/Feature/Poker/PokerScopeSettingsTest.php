<?php

use App\Actions\Poker\BuildPokerSnapshot;
use App\Events\Poker\PokerGameChanged;
use App\Models\PokerGame;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

dataset('poker switches', [
    'anonymous votes' => ['anonymous_votes', 'anonymousVotes', false],
    'cursors' => ['cursors_enabled', 'cursorsEnabled', true],
    'reactions' => ['reactions_enabled', 'reactionsEnabled', true],
]);

it('lets the facilitator flip each switch', function (string $field, string $snapshotKey, bool $default) {
    $game = PokerGame::factory()->create();
    [$user, $facilitator] = pokerFacilitator($game);

    expect($game->fresh()->{$field})->toBe($default);

    $this->actingAs($user)
        ->patchJson(route('poker.settings.update', $game), [$field => ! $default])
        ->assertNoContent();

    expect($game->fresh()->{$field})->toBe(! $default)
        ->and(resolve(BuildPokerSnapshot::class)->handle($game->fresh(), $facilitator->fresh())['game'][$snapshotKey])->toBe(! $default);

    Event::assertDispatched(fn (PokerGameChanged $event) => $event->gameId === $game->id);
})->with('poker switches');

it('refuses the switches to other players', function (string $field, string $snapshotKey, bool $default) {
    $game = PokerGame::factory()->withGuestAccess()->create();
    pokerFacilitator($game);
    [$memberUser] = pokerMember($game);
    $guest = pokerGuest($game);

    $this->actingAs($memberUser)
        ->patchJson(route('poker.settings.update', $game), [$field => ! $default])
        ->assertForbidden();

    $this->withCookies(pokerGuestCookie($guest))
        ->withCredentials()
        ->patchJson(route('poker.settings.update', $game), [$field => ! $default])
        ->assertForbidden();

    expect($game->fresh()->{$field})->toBe($default);
})->with('poker switches');

it('refuses the switches on an ended game', function (string $field, string $snapshotKey, bool $default) {
    $game = PokerGame::factory()->ended()->create();
    [$user] = pokerFacilitator($game);

    $this->actingAs($user)
        ->patchJson(route('poker.settings.update', $game), [$field => ! $default])
        ->assertForbidden();

    expect($game->fresh()->{$field})->toBe($default);
})->with('poker switches');

it('validates the switches as booleans', function () {
    $game = PokerGame::factory()->create();
    [$user] = pokerFacilitator($game);

    $this->actingAs($user)
        ->patchJson(route('poker.settings.update', $game), ['cursors_enabled' => 'sometimes'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('cursors_enabled');
});
