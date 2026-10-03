<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('turns single-key shortcuts on by default and shares the preference with every page', function () {
    $user = User::factory()->create()->fresh();

    expect($user->single_key_shortcuts)->toBeTrue();

    $this->actingAs($user)->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('auth.user.single_key_shortcuts', true));
});

it('saves the preference of the signed-in user only', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    $this->actingAs($user)
        ->from(route('appearance.edit'))
        ->patch(route('shortcutPreferences.update'), ['single_key_shortcuts' => false])
        ->assertRedirect(route('appearance.edit'))
        ->assertSessionHasNoErrors();

    expect($user->fresh()->single_key_shortcuts)->toBeFalse()
        ->and($other->fresh()->single_key_shortcuts)->toBeTrue();

    $this->actingAs($user)->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('auth.user.single_key_shortcuts', false));
});

it('refuses a value that is not a boolean', function (mixed $value) {
    $this->actingAs(User::factory()->create())
        ->patch(route('shortcutPreferences.update'), ['single_key_shortcuts' => $value])
        ->assertSessionHasErrors('single_key_shortcuts');
})->with(['maybe', null]);

it('is for signed-in users', function () {
    $this->patch(route('shortcutPreferences.update'), ['single_key_shortcuts' => false])->assertRedirect(route('login'));
});
