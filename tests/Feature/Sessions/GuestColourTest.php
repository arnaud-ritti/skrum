<?php

use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use Inertia\Testing\AssertableInertia as Assert;

dataset('guest sessions', [
    'retro' => [fn () => Retro::factory()->withGuestAccess()->create(), 'retros.join.show', 'retros.join.store', 'participants', 'retros/join'],
    'poker' => [fn () => PokerGame::factory()->withGuestAccess()->create(), 'poker.join.show', 'poker.join.store', 'players', 'poker/join'],
    'whiteboard' => [fn () => Whiteboard::factory()->withGuestAccess()->create(), 'whiteboards.join.show', 'whiteboards.join.store', 'members', 'whiteboards/join'],
    'survey' => [fn () => TeamSurvey::factory()->open()->withGuestAccess()->create(), 'surveys.join.show', 'surveys.join.store', 'respondents', 'surveys/join'],
    'game' => [fn () => GameRoom::factory()->linkAccess()->create(), 'games.join.show', 'games.join.store', 'players', 'games/join'],
]);

it('lists the colours already taken in the session', function (Closure $make, string $show, string $store, string $relation, string $component) {
    $session = $make();
    $session->{$relation}()->create(['guest_name' => 'Ada', 'presence_color' => 5]);
    $session->{$relation}()->create(['guest_name' => 'Lin', 'presence_color' => 2]);

    $this->get(route($show, $session->guest_token))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component($component)->where('takenColors', [2, 5])->where('suggestedPresence', null));
})->with('guest sessions');

it('counts a member of the session with the colour of their account', function (Closure $make, string $show, string $store, string $relation) {
    $session = $make();
    $session->{$relation}()->create(['user_id' => User::factory()->create(['presence_color' => 11])->id]);

    $this->get(route($show, $session->guest_token))
        ->assertInertia(fn (Assert $page) => $page->where('takenColors', [11]));
})->with('guest sessions');

it('suggests the colour of a signed-in visitor while it is free', function (Closure $make, string $show, string $store, string $relation) {
    $session = $make();
    $session->{$relation}()->create(['guest_name' => 'Ada', 'presence_color' => 5]);

    $this->actingAs(User::factory()->create(['presence_color' => 7]))
        ->get(route($show, $session->guest_token))
        ->assertInertia(fn (Assert $page) => $page->where('takenColors', [5])->where('suggestedPresence', 7));

    $this->actingAs(User::factory()->create(['presence_color' => 5]))
        ->get(route($show, $session->guest_token))
        ->assertInertia(fn (Assert $page) => $page->where('suggestedPresence', null));
})->with('guest sessions');

it('disables nothing once the twelve colours are taken', function (Closure $make, string $show, string $store, string $relation) {
    $session = $make();

    foreach (range(1, 12) as $colour) {
        $session->{$relation}()->create(['guest_name' => "Guest {$colour}", 'presence_color' => $colour]);
    }

    $this->get(route($show, $session->guest_token))->assertInertia(fn (Assert $page) => $page->where('takenColors', []));
})->with('guest sessions');

it('stores the colour a guest picks', function (Closure $make, string $show, string $store, string $relation) {
    $session = $make();

    $this->post(route($store, $session->guest_token), ['name' => 'Otter', 'presence' => 8])->assertRedirect();

    expect($session->{$relation}()->where('guest_name', 'Otter')->sole()->presence_color)->toBe(8);
})->with('guest sessions');

it('keeps the derived colour when the guest picks none', function (Closure $make, string $show, string $store, string $relation) {
    $session = $make();

    $this->post(route($store, $session->guest_token), ['name' => 'Otter'])->assertRedirect();

    expect($session->{$relation}()->where('guest_name', 'Otter')->sole()->presence_color)->toBeNull();
})->with('guest sessions');

it('refuses a colour outside the twelve', function (Closure $make, string $show, string $store, string $relation, string $component, int $colour) {
    $session = $make();

    $this->postJson(route($store, $session->guest_token), ['name' => 'Otter', 'presence' => $colour])->assertJsonValidationErrors('presence');
})->with('guest sessions')->with([0, 13]);
