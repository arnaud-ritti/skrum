<?php

use App\Models\SocialAccount;

dataset('settingsWriteRoutes', [
    'profile update' => ['patch', fn () => route('profile.update')],
    'photo upload' => ['post', fn () => route('profilePhotos.store')],
    'photo removal' => ['delete', fn () => route('profilePhotos.destroy')],
    'account deletion' => ['delete', fn () => route('profile.destroy')],
    'password update' => ['put', fn () => route('user-password.update')],
    'one session sign-out' => ['delete', fn () => route('browserSessions.destroy', str_repeat('a', 64))],
    'other sessions sign-out' => ['delete', fn () => route('otherBrowserSessions.destroy')],
    'account link' => ['get', fn () => route('linkedAccounts.create', 'google')],
    'account unlink' => ['delete', fn () => route('linkedAccounts.destroy', SocialAccount::factory()->create())],
    'notification preferences' => ['patch', fn () => route('notificationPreferences.update')],
    'motion preference' => ['patch', fn () => route('motionPreferences.update')],
]);

it('sends a visitor to the login page from every change of the account settings', function (string $method, string $url) {
    $this->{$method}($url)->assertRedirect(route('login'));
})->with('settingsWriteRoutes');

it('keeps the identity a visitor tried to unlink', function () {
    $socialAccount = SocialAccount::factory()->create();

    $this->delete(route('linkedAccounts.destroy', $socialAccount))->assertRedirect(route('login'));

    expect($socialAccount->fresh())->not->toBeNull();
});
