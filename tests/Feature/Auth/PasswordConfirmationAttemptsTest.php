<?php

use App\Models\User;

it('limits the password confirmations of an account to six a minute', function () {
    $user = User::factory()->create();

    foreach (range(1, 6) as $attempt) {
        $this->actingAs($user)->from(route('password.confirm'))
            ->post(route('password.confirm.store'), ['password' => "guess-{$attempt}"])
            ->assertSessionHasErrors('password');
    }

    $this->actingAs($user)->from(route('password.confirm'))
        ->post(route('password.confirm.store'), ['password' => 'password'])
        ->assertRedirect(route('password.confirm'))
        ->assertSessionHasErrors(['password' => 'Too many attempts. Wait a minute and try again.']);

    expect(session('auth.password_confirmed_at'))->toBeNull();
});

it('answers the dialog of the settings with the limit on the password field', function () {
    $user = User::factory()->create();

    foreach (range(1, 6) as $attempt) {
        $this->actingAs($user)->postJson(route('password.confirm.store'), ['password' => "guess-{$attempt}"])
            ->assertUnprocessable();
    }

    $this->actingAs($user)->postJson(route('password.confirm.store'), ['password' => 'password'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['password' => 'Too many attempts. Wait a minute and try again.']);

    expect(session('auth.password_confirmed_at'))->toBeNull();
});

it('counts the confirmations of each account apart', function () {
    $tooHasty = User::factory()->create();

    foreach (range(1, 7) as $attempt) {
        $this->actingAs($tooHasty)->postJson(route('password.confirm.store'), ['password' => "guess-{$attempt}"]);
    }

    $this->actingAs(User::factory()->create())->postJson(route('password.confirm.store'), ['password' => 'password'])
        ->assertCreated();
});

it('refuses a password that is not text instead of failing', function (mixed $password) {
    $user = User::factory()->create();

    $this->actingAs($user)->postJson(route('password.confirm.store'), ['password' => $password])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('password');

    $this->actingAs($user)->from(route('password.confirm'))
        ->post(route('password.confirm.store'), ['password' => $password])
        ->assertRedirect(route('password.confirm'))
        ->assertSessionHasErrors('password');

    expect(session('auth.password_confirmed_at'))->toBeNull();
})->with([
    'a list' => [['password']],
    'a map' => [['value' => 'password']],
]);

it('still confirms the right password', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->postJson(route('password.confirm.store'), ['password' => 'password'])
        ->assertCreated();

    expect(session('auth.password_confirmed_at'))->not->toBeNull();
});
