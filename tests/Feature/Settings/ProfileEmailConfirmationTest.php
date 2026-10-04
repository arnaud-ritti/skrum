<?php

use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Support\Str;

it('asks for the password before the login address changes', function () {
    $user = User::factory()->create(['email' => 'mona@example.test']);

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => 'Mona', 'email' => 'mallory@example.test'])
        ->assertRedirect(route('password.confirm'));

    expect($user->refresh()->email)->toBe('mona@example.test')
        ->and($user->email_verified_at)->not->toBeNull();
});

it('answers 423 to a JSON change of the login address without a confirmed password', function () {
    $user = User::factory()->create(['email' => 'mona@example.test']);

    $this->actingAs($user)
        ->patchJson(route('profile.update'), ['name' => 'Mona', 'email' => 'mallory@example.test'])
        ->assertStatus(423);

    expect($user->refresh()->email)->toBe('mona@example.test');
});

it('asks for the password again once the confirmation is older than the timeout', function () {
    $user = User::factory()->create(['email' => 'mona@example.test']);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time() - config('auth.password_timeout') - 1])
        ->patch(route('profile.update'), ['name' => 'Mona', 'email' => 'mallory@example.test'])
        ->assertRedirect(route('password.confirm'));

    expect($user->refresh()->email)->toBe('mona@example.test');
});

it('changes the login address after the password is confirmed', function () {
    $user = User::factory()->create(['email' => 'mona@example.test']);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->patch(route('profile.update'), ['name' => 'Mona', 'email' => 'mona.new@example.test'])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('settings.edit'));

    expect($user->refresh()->email)->toBe('mona.new@example.test')
        ->and($user->email_verified_at)->toBeNull();
});

it('changes the name without a confirmed password while the address stays', function (string $sameAddress) {
    $user = User::factory()->create(['name' => 'Mona', 'email' => 'mona@example.test']);

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => 'Mona Lisa', 'email' => $sameAddress])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('settings.edit'));

    expect($user->refresh()->name)->toBe('Mona Lisa');
})->with([
    'the same spelling' => ['mona@example.test'],
    'another case' => ['Mona@Example.test'],
]);

it('lets an account without a known password change its login address with no confirmation (rule S-1)', function () {
    $user = User::factory()->create(['email' => 'sso@example.test', 'password' => Str::password(64), 'password_set_at' => null]);
    SocialAccount::factory()->for($user)->create();

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => 'Sso', 'email' => 'sso.new@example.test'])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('settings.edit'));

    expect($user->refresh()->email)->toBe('sso.new@example.test');
});
