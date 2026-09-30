<?php

use App\Actions\Retros\GuestCookie;
use App\Enums\RetroPhase;
use App\Models\GameRoom;
use App\Models\Retro;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the join form of a link room with a suggested name', function () {
    $room = GameRoom::factory()->linkAccess()->create(['name' => 'Coffee games']);

    $this->get(route('games.join.show', $room->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('isInvalid', false)
            ->where('guestToken', $room->guest_token)
            ->where('roomName', 'Coffee games')
            ->where('gameLabel', __('Hangman'))
            ->where('suggestedName', fn (string $name) => $name !== ''));
});

it('joins as a guest and resumes with the cookie', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $cookieName = GuestCookie::name(GuestCookie::GameScope, $room->id);

    $response = $this->post(route('games.join.store', $room->guest_token), ['name' => 'Happy Otter'])
        ->assertRedirect(route('games.show', $room))
        ->assertCookie($cookieName);

    $guest = $room->players()->where('guest_name', 'Happy Otter')->sole();
    $cookieValue = $response->getCookie($cookieName, decrypt: true)->getValue();

    expect($guest->user_id)->toBeNull()
        ->and(str_starts_with($cookieValue, $guest->id.'|'))->toBeTrue();

    $this->withCookies([$cookieName => $cookieValue])
        ->get(route('games.join.show', $room->guest_token))
        ->assertRedirect(route('games.show', $room));
});

it('sends team members straight to the room', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $user = teamMember($room->team);

    $this->actingAs($user)->get(route('games.join.show', $room->guest_token))->assertRedirect(route('games.show', $room));
});

it('lets a signed-in outsider join as a guest without team access', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $outsider = User::factory()->create();

    $this->actingAs($outsider)
        ->post(route('games.join.store', $room->guest_token), ['name' => 'Visitor'])
        ->assertRedirect(route('games.show', $room));

    expect($room->players()->where('guest_name', 'Visitor')->sole()->user_id)->toBeNull();
});

it('requires a display name of at most 50 characters', function (string $name) {
    $room = GameRoom::factory()->linkAccess()->create();

    $this->post(route('games.join.store', $room->guest_token), ['name' => $name])->assertSessionHasErrors('name');

    expect($room->players()->count())->toBe(0);
})->with(['', '   ', str_repeat('a', 51)]);

it('refuses team rooms, icebreaker rooms and unknown links without revealing the room', function (string $kind) {
    $token = match ($kind) {
        'team' => GameRoom::factory()->create(['name' => 'Private'])->guest_token,
        'icebreaker' => GameRoom::factory()->icebreaker(Retro::factory()->inPhase(RetroPhase::Icebreaker)->create())->create()->guest_token,
        'unknown' => 'unknown-token',
    };

    $this->get(route('games.join.show', $token))
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page->where('isInvalid', true)->missing('roomName'));

    $this->post(route('games.join.store', $token), ['name' => 'Visitor'])->assertNotFound();
})->with(['team', 'icebreaker', 'unknown']);
