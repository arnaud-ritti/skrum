<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('sends the current colour to the profile', function () {
    $user = User::factory()->create(['presence_color' => 4]);

    $this->actingAs($user)->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('profile.presenceColor', 4));
});

it('saves a chosen colour with the profile', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => $user->name, 'email' => $user->email, 'presence_color' => 9])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('settings.edit'));

    expect($user->fresh()->presence_color)->toBe(9);
});

it('refuses a colour outside the twelve', function (mixed $colour) {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => $user->name, 'email' => $user->email, 'presence_color' => $colour])
        ->assertSessionHasErrors('presence_color');
})->with([0, 13, 'red']);
