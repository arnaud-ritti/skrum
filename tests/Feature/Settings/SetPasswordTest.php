<?php

use App\Models\User;
use App\Support\InstanceSettings;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Inertia\Testing\AssertableInertia as Assert;

it('lets an account without a known password set one with neither the current password nor a confirmation (rule S-1)', function () {
    $user = User::factory()->create(['password_set_at' => null]);

    $this->actingAs($user)
        ->put(route('user-password.update'), ['password' => 'A-new-pass-2026!', 'password_confirmation' => 'A-new-pass-2026!'])
        ->assertSessionHasNoErrors();

    expect(Hash::check('A-new-pass-2026!', $user->fresh()->password))->toBeTrue()
        ->and($user->fresh()->password_set_at)->not->toBeNull();
});

it('still asks a known password for the current one, and dates the change', function () {
    $user = User::factory()->create(['password_set_at' => now()->subYear()]);

    $this->actingAs($user)
        ->put(route('user-password.update'), ['password' => 'A-new-pass-2026!', 'password_confirmation' => 'A-new-pass-2026!'])
        ->assertSessionHasErrors('current_password');

    $this->put(route('user-password.update'), ['current_password' => 'password', 'password' => 'A-new-pass-2026!', 'password_confirmation' => 'A-new-pass-2026!'])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->password_set_at->isToday())->toBeTrue();
});

it('dates a password chosen at registration', function () {
    config(['skrum.signup_mode' => 'open']);

    $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertSessionHasNoErrors();

    expect(User::query()->whereAddress('test@example.com')->sole()->password_set_at)->not->toBeNull();
});

it('dates a password chosen at reset', function () {
    $user = User::factory()->create(['password_set_at' => null]);
    $token = Password::broker()->createToken($user);

    $this->post(route('password.update'), [
        'token' => $token,
        'email' => $user->email,
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertSessionHasNoErrors();

    expect($user->fresh()->password_set_at)->not->toBeNull();
});

it('tells the security section whether the password is known and allowed', function () {
    config(['services.google.client_id' => 'g', 'services.google.client_secret' => 's']);
    $withoutPassword = User::factory()->create(['password_set_at' => null]);

    $this->actingAs($withoutPassword)->withSession(['auth.password_confirmed_at' => time()])->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('security.protected.password', ['isSet' => false, 'changedAt' => null, 'allowed' => true]));

    resolve(InstanceSettings::class)->set('sso_required', true);
    $member = User::factory()->create();

    $this->actingAs($member)->withSession(['auth.password_confirmed_at' => time()])->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('security.protected.password.isSet', true)
            ->where('security.protected.password.allowed', false));
});
