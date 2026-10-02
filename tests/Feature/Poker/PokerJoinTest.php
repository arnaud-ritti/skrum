<?php

use App\Actions\Retros\GuestCookie;
use App\Models\PokerGame;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the join form for an enabled guest link', function () {
    $game = PokerGame::factory()->withGuestAccess()->create(['title' => 'Sprint 12 sizing']);

    $this->get(route('poker.join.show', $game->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('poker/join')
            ->where('isInvalid', false)
            ->where('guestToken', $game->guest_token)
            ->where('gameTitle', 'Sprint 12 sizing')
            ->where('suggestedName', fn (string $name) => $name !== '' && mb_strlen($name) <= 50)
            ->missing('randomName')
            ->reloadOnly('randomName', fn (Assert $reload) => $reload
                ->where('randomName', fn (string $name) => $name !== '' && mb_strlen($name) <= 50)));
});

it('joins as a guest and resumes with the cookie', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $cookieName = GuestCookie::name(GuestCookie::PokerScope, $game->id);

    $response = $this->post(route('poker.join.store', $game->guest_token), ['name' => 'Visitor'])
        ->assertRedirect(route('poker.show', $game))
        ->assertCookie($cookieName);

    $guest = $game->players()->where('guest_name', 'Visitor')->sole();
    $cookieValue = $response->getCookie($cookieName, decrypt: true)->getValue();

    expect($guest->user_id)->toBeNull()
        ->and(str_starts_with($cookieValue, $guest->id.'|'))->toBeTrue()
        ->and($guest->guest_secret_hash)->not->toContain(explode('|', $cookieValue)[1]);

    $this->withCookies([$cookieName => $cookieValue])
        ->get(route('poker.join.show', $game->guest_token))
        ->assertRedirect(route('poker.show', $game));

    $this->withCookies([$cookieName => $cookieValue])
        ->get(route('poker.show', $game))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('snapshot.me.isGuest', true));
});

it('requires a display name', function (string $name) {
    $game = PokerGame::factory()->withGuestAccess()->create();

    $this->post(route('poker.join.store', $game->guest_token), ['name' => $name])->assertSessionHasErrors('name');

    expect($game->players()->count())->toBe(0);
})->with(['', '   ', str_repeat('a', 51)]);

it('refuses disabled or unknown links without revealing the game', function (string $kind) {
    $game = PokerGame::factory()->create(['title' => 'Private']);
    $token = $kind === 'disabled' ? $game->guest_token : 'unknown-token';

    $this->get(route('poker.join.show', $token))
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page
            ->component('poker/join')
            ->where('isInvalid', true)
            ->missing('gameTitle'));

    $this->post(route('poker.join.store', $token), ['name' => 'X'])->assertNotFound();
})->with(['disabled', 'unknown']);

it('lets a logged-in non-member join as a guest with their name prefilled', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $outsider = User::factory()->create(['name' => 'Olga Outside']);

    $this->actingAs($outsider)
        ->get(route('poker.join.show', $game->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('suggestedName', 'Olga Outside'));

    $this->actingAs($outsider)
        ->post(route('poker.join.store', $game->guest_token), ['name' => 'Olga Outside'])
        ->assertRedirect(route('poker.show', $game));

    $guest = $game->players()->sole();

    expect($guest->user_id)->toBeNull()
        ->and($guest->guest_name)->toBe('Olga Outside');
});

it('sends team members straight to the game as themselves', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $user = teamMember($game->team);

    $this->actingAs($user)
        ->get(route('poker.join.show', $game->guest_token))
        ->assertRedirect(route('poker.show', $game));

    expect($game->players()->where('user_id', $user->id)->exists())->toBeTrue();
});
