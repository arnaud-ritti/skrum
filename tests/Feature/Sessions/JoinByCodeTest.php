<?php

use App\Models\Retro;
use App\Support\Sessions\JoinCodes;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the page to anyone', function () {
    $this->get(route('joinCodes.create'))->assertOk()->assertInertia(fn (Assert $page) => $page->component('sessions/join-code'));
});

it('sends a code, however it is typed, to the session\'s join page', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $code = resolve(JoinCodes::class)->for($retro);

    $this->post(route('joinCodes.store'), ['code' => strtolower(str_replace('-', ' ', $code))])
        ->assertRedirect(route('retros.join.show', $retro->guest_token));
});

it('answers the same for an unknown code, a session closed to guests and a look-alike', function (Closure $code) {
    $this->from(route('joinCodes.create'))->post(route('joinCodes.store'), ['code' => $code()])
        ->assertRedirect(route('joinCodes.create'))
        ->assertSessionHasErrors(['code' => 'No session matches this code.']);
})->with([
    'unknown' => [fn () => 'AAA-AAAA'],
    'closed' => [function () {
        $retro = Retro::factory()->withGuestAccess()->create();
        $code = resolve(JoinCodes::class)->for($retro);
        $retro->update(['guest_access_enabled' => false]);

        return $code;
    }],
    'look-alike' => [fn () => 'K0Q-P4M2'],
]);

it('throttles guessing', function () {
    foreach (range(1, 10) as $ignored) {
        $this->post(route('joinCodes.store'), ['code' => 'AAA-AAAA']);
    }

    $this->post(route('joinCodes.store'), ['code' => 'AAA-AAAA'])->assertTooManyRequests();
});
