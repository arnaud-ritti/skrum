<?php

use App\Models\EmailTwoFactorCode;
use App\Models\MagicLink;
use App\Models\User;
use Illuminate\Support\Facades\Password;

function userWithLoginSecrets(): User
{
    $user = User::factory()->withEmailSecondFactor()->create();
    MagicLink::factory()->for($user)->create();
    EmailTwoFactorCode::factory()->for($user)->create();

    return $user;
}

function loginSecretsOf(User $user): int
{
    return MagicLink::query()->where('user_id', $user->id)->count() + EmailTwoFactorCode::query()->where('user_id', $user->id)->count();
}

it('deletes links and codes when the password is changed', function () {
    $user = userWithLoginSecrets();
    $bystander = userWithLoginSecrets();

    $this->actingAs($user)->put(route('user-password.update'), [
        'current_password' => 'password',
        'password' => 'A-new-long-passphrase-42',
        'password_confirmation' => 'A-new-long-passphrase-42',
    ])->assertSessionHasNoErrors();

    expect(loginSecretsOf($user))->toBe(0)
        ->and(loginSecretsOf($bystander))->toBe(2)
        ->and($user->fresh()->two_factor_email_enabled_at)->not->toBeNull();
});

it('deletes links and codes when the password is reset', function () {
    $user = userWithLoginSecrets();

    $this->post(route('password.update'), [
        'token' => Password::createToken($user),
        'email' => $user->email,
        'password' => 'A-new-long-passphrase-42',
        'password_confirmation' => 'A-new-long-passphrase-42',
    ])->assertSessionHasNoErrors();

    expect(loginSecretsOf($user))->toBe(0);
});

it('deletes links and codes and turns the e-mail factor off when the address changes', function () {
    $user = userWithLoginSecrets();

    $this->actingAs($user)->patch(route('profile.update'), ['name' => $user->name, 'email' => 'moved@example.test'])->assertSessionHasNoErrors();

    expect(loginSecretsOf($user))->toBe(0)
        ->and($user->fresh())->two_factor_email_enabled_at->toBeNull()->email_verified_at->toBeNull();
});

it('keeps everything when the profile is saved with the same address', function () {
    $user = userWithLoginSecrets();

    $this->actingAs($user)->patch(route('profile.update'), ['name' => 'Another Name', 'email' => $user->email])->assertSessionHasNoErrors();

    expect(loginSecretsOf($user))->toBe(2)->and($user->fresh()->two_factor_email_enabled_at)->not->toBeNull();
});

it('deletes the rows with the account', function () {
    $user = userWithLoginSecrets();

    $user->delete();

    expect(loginSecretsOf($user))->toBe(0);
});
