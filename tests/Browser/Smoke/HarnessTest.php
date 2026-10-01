<?php

use App\Models\Retro;

it('signs a member in through the login form', function () {
    $retro = Retro::factory()->create();
    [$member] = retroFacilitator($retro);
    $member->update(['name' => 'Mona Member', 'locale' => 'en']);

    $page = $this->signIn($member);

    $page->assertSee('Mona Member');
});

it('keeps a guest context apart from a signed-in member', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    [$member] = retroFacilitator($retro);
    $member->update(['name' => 'Mona Member', 'locale' => 'en']);

    $memberPage = $this->signIn($member);
    $guestPage = $this->joinAsGuest("/join/{$retro->guest_token}", 'Gus Guest');

    $guestPage->assertPathIs("/retros/{$retro->id}");
    $guestPage->navigate('/dashboard')->assertPathIs('/login');
    $memberPage->navigate('/dashboard')->assertSee('Mona Member');
});
