<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('saves the preference', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->patch(route('motionPreferences.update'), ['reduce_motion' => true])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($user->fresh()->reduce_motion)->toBeTrue();
});

it('refuses a missing or non-boolean value', function (mixed $value) {
    $this->actingAs(User::factory()->create())
        ->patchJson(route('motionPreferences.update'), ['reduce_motion' => $value])
        ->assertJsonValidationErrors('reduce_motion');
})->with([null, 'often']);

it('marks the root element of every page for a user who reduces motion', function () {
    $user = User::factory()->create(['reduce_motion' => true]);

    $html = $this->actingAs($user)->get(route('settings.edit'))->assertOk()->getContent();

    expect($html)->toMatch('/<html[^>]*class="[^"]*\breduce-motion\b/');
});

it('does not mark it otherwise, nor for a visitor', function () {
    $this->actingAs(User::factory()->create())->get(route('settings.edit'))
        ->assertDontSee('reduce-motion', false);

    auth()->logout();

    $this->get(route('login'))->assertDontSee('reduce-motion', false);
});

it('sends the preference to the appearance section', function () {
    $this->actingAs(User::factory()->create(['reduce_motion' => true]))->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('appearance.reduceMotion', true));
});

it('refuses an unverified account', function () {
    $this->actingAs(User::factory()->unverified()->create())
        ->patch(route('motionPreferences.update'), ['reduce_motion' => true])
        ->assertRedirect(route('verification.notice'));
});
