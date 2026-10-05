<?php

use App\Actions\Auth\ResolveSsoUser;
use App\Enums\SsoProvider;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Laravel\Socialite\Two\User as SocialiteUser;

function storedAddress(User $user): string
{
    return DB::table('users')->where('id', $user->id)->value('email');
}

it('stores an address in its normalised form whoever writes it', function () {
    $user = User::factory()->create(['email' => '  Ada.Lovelace@Example.TEST ']);

    expect(storedAddress($user))->toBe('ada.lovelace@example.test');
});

it('stores the normalised address of a person registering', function () {
    config(['skrum.signup_mode' => 'open']);

    $this->post(route('register.store'), [
        'name' => 'Ada',
        'email' => 'Ada@Example.test',
        'password' => 'correct-horse-battery',
        'password_confirmation' => 'correct-horse-battery',
    ])->assertSessionHasNoErrors();

    expect(User::query()->sole()->email)->toBe('ada@example.test');
});

it('refuses a registration whose address differs from an account only by case', function () {
    config(['skrum.signup_mode' => 'open']);
    User::factory()->storedWithAddress('Bob@example.test')->create();

    $this->post(route('register.store'), [
        'name' => 'Bob',
        'email' => 'bob@example.test',
        'password' => 'correct-horse-battery',
        'password_confirmation' => 'correct-horse-battery',
    ])->assertSessionHasErrors(['email' => __('validation.unique', ['attribute' => 'email'])]);

    expect(User::query()->count())->toBe(1);
});

it('stores the normalised address on a profile update', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->patch(route('profile.update'), ['name' => $user->name, 'email' => 'New.Address@Example.test'])
        ->assertSessionHasNoErrors();

    expect(storedAddress($user))->toBe('new.address@example.test');
});

it('refuses a profile address that differs from another account only by case', function (string $stored, string $submitted) {
    User::factory()->storedWithAddress($stored)->create();
    $user = User::factory()->create(['email' => 'mallory@example.test']);

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => $user->name, 'email' => $submitted])
        ->assertSessionHasErrors(['email' => __('validation.unique', ['attribute' => 'email'])]);

    expect(storedAddress($user))->toBe('mallory@example.test');
})->with([
    'capitals submitted' => ['bob@example.test', 'Bob@Example.test'],
    'capitals stored' => ['Bob@example.test', 'bob@example.test'],
]);

it('keeps the verification when a person respells their own address', function () {
    $user = User::factory()->create(['email' => 'ada@example.test']);

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => 'Ada', 'email' => 'Ada@Example.test'])
        ->assertSessionHasNoErrors();

    expect($user->refresh()->email)->toBe('ada@example.test')
        ->and($user->email_verified_at)->not->toBeNull();
});

it('stores the normalised address of an account created by single sign-on, which can then ask for a reset link', function () {
    config(['skrum.signup_mode' => 'open']);
    Notification::fake();

    $user = resolve(ResolveSsoUser::class)->handle(
        SsoProvider::Google,
        SocialiteUser::fake(['id' => 'g-1', 'email' => 'Bob@Example.test', 'email_verified' => true]),
        null,
    );

    expect(storedAddress($user))->toBe('bob@example.test');

    $this->post(route('password.email'), ['email' => 'Bob@Example.test']);

    Notification::assertSentToTimes($user, ResetPassword::class, 1);
});
