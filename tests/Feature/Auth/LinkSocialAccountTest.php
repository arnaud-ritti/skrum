<?php

use App\Models\SocialAccount;
use App\Models\User;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

beforeEach(fn () => config(['services.google.client_id' => 'g', 'services.google.client_secret' => 's']));

function providerReturns(string $id, string $email = 'ada@example.test'): void
{
    Socialite::fake('google', SocialiteUser::fake(['id' => $id, 'email' => $email, 'name' => 'Ada']));
}

it('sends a confirmed user to the provider with a link intent', function () {
    providerReturns('google-1');
    $user = User::factory()->create();

    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('linkedAccounts.create', 'google'))
        ->assertRedirect()
        ->assertSessionHas('sso.intent', ['type' => 'link', 'user' => $user->id, 'provider' => 'google']);
});

it('asks an account with a known password for a fresh confirmation before linking', function () {
    $this->actingAs(User::factory()->create())->get(route('linkedAccounts.create', 'google'))->assertRedirect(route('password.confirm'));
});

it('sends an account without a known password to the provider with no confirmation (rule S-1)', function () {
    providerReturns('google-1');
    $user = User::factory()->create(['password_set_at' => null]);

    $this->actingAs($user)->get(route('linkedAccounts.create', 'google'))
        ->assertRedirect()
        ->assertSessionHas('sso.intent', ['type' => 'link', 'user' => $user->id, 'provider' => 'google']);
});

it('links the identity the provider returns and comes back to the security section', function () {
    providerReturns('google-1');
    $user = User::factory()->create();

    $this->actingAs($user)->withSession(['sso.intent' => ['type' => 'link', 'user' => $user->id, 'provider' => 'google']])
        ->get(route('sso.callback', 'google'))
        ->assertRedirect(route('settings.edit').'#security');

    expect($user->socialAccounts()->sole()->provider_user_id)->toBe('google-1');
});

it('refuses an identity linked to another account, and a second identity of the same provider', function () {
    $user = User::factory()->create();
    SocialAccount::factory()->for(User::factory()->create())->create(['provider' => 'google', 'provider_user_id' => 'taken']);
    SocialAccount::factory()->for($user)->create(['provider' => 'google', 'provider_user_id' => 'mine']);

    foreach (['taken' => 'This Google account is already linked to another account.', 'another' => 'Your account is already linked to Google. Unlink it first.'] as $id => $message) {
        providerReturns($id);

        $this->actingAs($user)->withSession(['sso.intent' => ['type' => 'link', 'user' => $user->id, 'provider' => 'google']])
            ->get(route('sso.callback', 'google'))
            ->assertRedirect(route('settings.edit').'#security')
            ->assertInertiaFlash('toast', ['type' => 'error', 'message' => $message]);
    }

    expect($user->socialAccounts()->pluck('provider_user_id')->all())->toBe(['mine']);
});

it('does nothing for a signed-in user without an intent, or with an intent of someone else or for another provider', function (Closure $intent) {
    providerReturns('google-1');
    $user = User::factory()->create();

    $this->actingAs($user)->withSession(array_filter(['sso.intent' => $intent($user)]))
        ->get(route('sso.callback', 'google'))
        ->assertRedirect(route('dashboard'));

    expect(SocialAccount::query()->count())->toBe(0);
})->with([
    'none' => [fn () => null],
    'someone else' => [fn () => ['type' => 'link', 'user' => User::factory()->create()->id, 'provider' => 'google']],
    'another provider' => [fn (User $user) => ['type' => 'link', 'user' => $user->id, 'provider' => 'github']],
]);

it('still signs a visitor in through the callback', function () {
    $user = User::factory()->create();
    SocialAccount::factory()->for($user)->create(['provider' => 'google', 'provider_user_id' => 'google-1']);
    providerReturns('google-1');

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs($user);
});
