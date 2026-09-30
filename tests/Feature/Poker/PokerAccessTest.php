<?php

use App\Actions\Retros\GuestCookie;
use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('lets team members in as themselves', function () {
    $game = PokerGame::factory()->create();
    $user = teamMember($game->team);

    $this->actingAs($user)
        ->get(route('poker.show', $game))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('poker/show')
            ->where('snapshot.game.id', $game->id)
            ->where('snapshot.me.isGuest', false)
            ->has('deckOptions', 5));

    $this->actingAs($user)->getJson(route('poker.snapshot.show', $game))->assertOk();

    expect($game->players()->where('user_id', $user->id)->count())->toBe(1);
});

it('lets workspace managers open any team game', function () {
    $game = PokerGame::factory()->create();
    $admin = workspaceManager($game->team->workspace);

    $this->actingAs($admin)->get(route('poker.show', $game))->assertOk();
});

it('sends logged-out visitors to login', function () {
    $this->get(route('poker.show', PokerGame::factory()->create()))->assertRedirect(route('login'));
});

it('shows the session-ended page for guest-enabled games', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();

    $this->get(route('poker.show', $game))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('retros/session-ended'))
        ->assertSessionHas('url.intended', route('poker.show', $game));
});

it('refuses non-members with 403', function () {
    $game = PokerGame::factory()->create();
    $outsider = User::factory()->create();
    $game->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->get(route('poker.show', $game))->assertForbidden();
    $this->actingAs($outsider)
        ->getJson(route('poker.snapshot.show', $game))
        ->assertForbidden()
        ->assertJsonPath('message', 'You no longer have access to this game.');

    expect($game->players()->count())->toBe(0);
});

it('answers logged-out json requests with 401', function () {
    $this->getJson(route('poker.snapshot.show', PokerGame::factory()->create()))
        ->assertUnauthorized()
        ->assertJsonPath('message', 'Your session has expired.');
});

it('revokes removed members and signed-out guests', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    [$user] = pokerMember($game);
    $guest = pokerGuest($game);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->getJson(route('poker.snapshot.show', $game))
        ->assertOk();

    $guest->update(['guest_secret_hash' => null]);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->getJson(route('poker.snapshot.show', $game))
        ->assertForbidden();

    $otherGuest = pokerGuest($game);
    $game->update(['guest_access_enabled' => false]);

    $this->withCookies(pokerGuestCookie($otherGuest))->withCredentials()
        ->getJson(route('poker.snapshot.show', $game))
        ->assertForbidden();

    $this->actingAs($user)->getJson(route('poker.snapshot.show', $game))->assertOk();

    $game->team->members()->detach($user);

    $this->actingAs($user)->getJson(route('poker.snapshot.show', $game))->assertForbidden();
});

it('keeps retro and poker guest cookies apart', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $pokerGuest = pokerGuest($game);

    $this->withCookies([GuestCookie::name(GuestCookie::RetroScope, $game->id) => "{$pokerGuest->id}|secret"])
        ->withCredentials()
        ->getJson(route('poker.snapshot.show', $game))
        ->assertUnauthorized();

    $retro = Retro::factory()->withGuestAccess()->create();
    $retroGuest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies([GuestCookie::name(GuestCookie::PokerScope, $retro->id) => "{$retroGuest->id}|secret"])
        ->withCredentials()
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertUnauthorized();
});

it('gives members the guest link only while guest access is on', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    [$user] = pokerMember($game);

    $this->actingAs($user)
        ->getJson(route('poker.snapshot.show', $game))
        ->assertJsonPath('game.guestUrl', route('poker.join.show', $game->guest_token));

    $game->update(['guest_access_enabled' => false]);

    $this->actingAs($user)
        ->getJson(route('poker.snapshot.show', $game))
        ->assertJsonPath('game.guestUrl', null);
});
