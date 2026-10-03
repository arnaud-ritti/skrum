<?php

use App\Actions\Auth\IssueMagicLink;
use App\Models\Passkey;
use App\Models\SocialAccount;
use App\Models\User;
use App\Support\Auth\SignInPolicy;
use App\Support\InstanceSettings;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Passkeys\Passkeys;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

beforeEach(function () {
    config([
        'mail.default' => 'smtp',
        'services.google.client_id' => 'google-id',
        'services.google.client_secret' => 'google-secret',
        'services.github.client_id' => null,
        'services.github.client_secret' => null,
        'skrum.signup_mode' => 'open',
    ]);
    Mail::fake();
});

function requireSso(): void
{
    resolve(InstanceSettings::class)->set('sso_required', true);
}

it('is off by default', function () {
    $member = User::factory()->create();

    expect(resolve(SignInPolicy::class)->ssoRequired())->toBeFalse();

    $this->post(route('login.store'), ['email' => $member->email, 'password' => 'password'])->assertRedirect(route('dashboard'));
    $this->assertAuthenticatedAs($member);
});

it('refuses the right password of a member', function () {
    requireSso();
    $member = User::factory()->withTwoFactor()->create();

    $this->from(route('login'))->post(route('login.store'), ['email' => $member->email, 'password' => 'password'])
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => __('auth.failed')]);

    $this->assertGuest();
    expect(session('login.id'))->toBeNull();
});

it('refuses the right password of an instance admin who has no second factor', function () {
    requireSso();
    $admin = User::factory()->instanceAdmin()->create();

    $this->from(route('login'))->post(route('login.store'), ['email' => $admin->email, 'password' => 'password'])
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => __('auth.failed')]);

    $this->assertGuest();
    expect(session('login.id'))->toBeNull();
});

it('challenges an instance admin who has a second factor, and signs in after it', function () {
    requireSso();
    $admin = User::factory()->instanceAdmin()->withTwoFactor()->create();

    $this->post(route('login.store'), ['email' => $admin->email, 'password' => 'password'])
        ->assertRedirect(route('two-factor.login'));

    $this->assertGuest();
    expect(session('login.id'))->toBe($admin->id)->and(session('login.entry'))->toBe('password');

    $this->post(route('two-factor.login.store'), ['recovery_code' => 'recovery-code-1'])
        ->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs($admin);
});

it('gives one answer to a member, to an admin without a second factor and to a wrong password', function () {
    requireSso();
    $member = User::factory()->create();
    $admin = User::factory()->instanceAdmin()->create();
    $answer = function (string $email, string $password): array {
        $response = $this->from(route('login'))->post(route('login.store'), ['email' => $email, 'password' => $password]);
        $answer = [$response->getStatusCode(), $response->headers->get('Location'), $response->getSession()->get('errors')];
        $this->flushSession();

        return $answer;
    };

    $wrong = $answer($member->email, 'not-the-password');

    expect($answer($member->email, 'password'))->toBe($wrong)
        ->and($answer($admin->email, 'password'))->toBe($wrong)
        ->and($answer($admin->email, 'not-the-password'))->toBe($wrong)
        ->and($answer('nobody@example.test', 'password'))->toBe($wrong);
});

it('refuses the password of a demoted admin', function () {
    requireSso();
    $admin = User::factory()->instanceAdmin()->withTwoFactor()->create();
    User::factory()->instanceAdmin()->create();
    $admin->forceFill(['is_instance_admin' => false])->save();

    $this->post(route('login.store'), ['email' => $admin->email, 'password' => 'password'])->assertSessionHasErrors('email');

    $this->assertGuest();
    expect(session('login.id'))->toBeNull();
});

it('refuses to complete a password challenge for an admin demoted meanwhile', function () {
    requireSso();
    $admin = User::factory()->instanceAdmin()->withTwoFactor()->create();
    $this->post(route('login.store'), ['email' => $admin->email, 'password' => 'password'])->assertRedirect(route('two-factor.login'));

    $admin->forceFill(['is_instance_admin' => false])->save();

    $this->post(route('two-factor.login.store'), ['recovery_code' => 'recovery-code-1'])->assertRedirect(route('login'));

    $this->assertGuest();
});

it('still completes a challenge that single sign-on started for someone who is not an admin', function () {
    requireSso();
    $member = User::factory()->withTwoFactor()->create();
    SocialAccount::factory()->for($member)->create(['provider' => 'google', 'provider_user_id' => 'g-80']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-80']));
    $this->get(route('sso.callback', 'google'))->assertRedirect(route('two-factor.login'));

    expect(session('login.entry'))->toBe('sso');

    $this->post(route('two-factor.login.store'), ['recovery_code' => 'recovery-code-1'])->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs($member);
});

it('accepts the password of a newly promoted admin who has a second factor', function () {
    requireSso();
    $user = User::factory()->withTwoFactor()->create();
    $user->forceFill(['is_instance_admin' => true])->save();

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])->assertRedirect(route('two-factor.login'));
});

it('is ignored for everyone when no provider is enabled', function () {
    requireSso();
    config(['services.google.client_id' => null]);
    $member = User::factory()->create();

    expect(resolve(SignInPolicy::class)->ssoRequired())->toBeFalse();

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->where('ssoRequired', false)->where('canUseMagicLink', true));
    $this->post(route('login.store'), ['email' => $member->email, 'password' => 'password'])->assertRedirect(route('dashboard'));
    $this->assertAuthenticatedAs($member);
    expect(Passkeys::allowsLogin(Request::create('/'), (new Passkey)->setRelation('user', $member)))->toBeTrue();
});

it('alerts instance admins, and nobody else, while the setting is ignored', function () {
    requireSso();
    $admin = User::factory()->instanceAdmin()->create();
    $member = User::factory()->create();

    $this->actingAs($admin)->get(route('settings.edit'))->assertInertia(fn (Assert $page) => $page->where('signInAlert', null));

    config(['services.google.client_id' => null]);

    $this->actingAs($admin)->get(route('settings.edit'))->assertInertia(fn (Assert $page) => $page->where('signInAlert', 'sso_required_ignored'));
    $this->actingAs($member)->get(route('settings.edit'))->assertInertia(fn (Assert $page) => $page->where('signInAlert', null));

    resolve(InstanceSettings::class)->set('sso_required', false);

    $this->actingAs($admin)->get(route('settings.edit'))->assertInertia(fn (Assert $page) => $page->where('signInAlert', null));
});

it('tells instance admins, and nobody else, that the setting is in force', function () {
    $admin = User::factory()->instanceAdmin()->create();
    $member = User::factory()->create();

    $this->actingAs($admin)->get(route('settings.edit'))->assertInertia(fn (Assert $page) => $page->where('ssoInForce', false));

    requireSso();

    $this->actingAs($admin)->get(route('settings.edit'))->assertInertia(fn (Assert $page) => $page->where('ssoInForce', true));
    $this->actingAs($member)->get(route('settings.edit'))->assertInertia(fn (Assert $page) => $page->where('ssoInForce', false));

    config(['services.google.client_id' => null]);

    $this->actingAs($admin)->get(route('settings.edit'))->assertInertia(fn (Assert $page) => $page->where('ssoInForce', false));
});

it('sends no magic link and keeps the uniform answer', function () {
    requireSso();
    $user = User::factory()->create();

    $this->from(route('login'))->post(route('magicLinks.store'), ['email' => $user->email])
        ->assertRedirect(route('login'))
        ->assertSessionHas('status', 'magic-link-sent')
        ->assertSessionHasNoErrors();

    Mail::assertNothingSent();
});

it('refuses a link issued before the setting was turned on', function () {
    $member = User::factory()->create();
    $url = resolve(IssueMagicLink::class)->handle($member);
    $token = basename((string) parse_url($url, PHP_URL_PATH));
    requireSso();

    $this->get($url)->assertInertia(fn (Assert $page) => $page->where('confirmUrl', null)->where('email', null));
    $this->post(route('magicLinks.sessions.store', $token))->assertRedirect(route('login'))->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('refuses to complete a magic-link challenge once single sign-on is required', function (bool $isAdmin) {
    $user = User::factory()->withTwoFactor()->create(['is_instance_admin' => $isAdmin]);
    $url = resolve(IssueMagicLink::class)->handle($user);
    $token = basename((string) parse_url($url, PHP_URL_PATH));
    $this->post(route('magicLinks.sessions.store', $token))->assertRedirect(route('two-factor.login'));

    requireSso();

    $this->post(route('two-factor.login.store'), ['recovery_code' => 'recovery-code-1'])
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors('email');

    $this->assertGuest();
    expect(session('login.id'))->toBeNull();
})->with([false, true]);

it('tells the login page what is offered', function () {
    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page
        ->where('ssoRequired', false)
        ->where('canUseMagicLink', true)
        ->where('canRegister', true)
        ->where('canResetPassword', true));

    requireSso();

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page
        ->where('ssoRequired', true)
        ->where('canUseMagicLink', false)
        ->where('canRegister', false)
        ->where('canResetPassword', true)
        ->has('ssoProviders', 1));
});

it('closes form registration', function () {
    User::factory()->instanceAdmin()->create();
    requireSso();

    $this->get(route('register'))->assertForbidden();
    $this->post(route('register.store'), [
        'name' => 'Ada',
        'email' => 'ada@example.test',
        'password' => 'a-long-enough-password',
        'password_confirmation' => 'a-long-enough-password',
    ])->assertSessionHasErrors('email');

    $this->assertGuest();
    expect(User::query()->where('email', 'ada@example.test')->exists())->toBeFalse();
});

it('mails a reset link to an instance admin only and answers everyone the same', function () {
    requireSso();
    $member = User::factory()->create();
    $admin = User::factory()->instanceAdmin()->create();
    Notification::fake();

    $forMember = $this->post(route('password.email'), ['email' => $member->email]);
    $forAdmin = $this->post(route('password.email'), ['email' => $admin->email]);

    Notification::assertNotSentTo($member, ResetPassword::class);
    Notification::assertSentTo($admin, ResetPassword::class);
    $forMember->assertSessionHasNoErrors();
    expect($forMember->getStatusCode())->toBe($forAdmin->getStatusCode())
        ->and($forMember->getSession()->get('status'))->toBe($forAdmin->getSession()->get('status'));
    $this->get(route('password.request'))->assertOk();
});

it('refuses a passkey for everyone while the setting is in force', function (bool $isAdmin) {
    $passkey = (new Passkey)->setRelation('user', User::factory()->withTwoFactor()->create(['is_instance_admin' => $isAdmin]));

    expect(Passkeys::allowsLogin(Request::create('/'), $passkey))->toBeTrue();

    requireSso();

    expect(Passkeys::allowsLogin(Request::create('/'), $passkey))->toBeFalse();
})->with(['member' => false, 'instance admin' => true]);

it('signs in through single sign-on and links an account that had no SSO identity', function () {
    requireSso();
    $member = User::factory()->create(['email' => 'member@example.test']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-77', 'email' => 'Member@example.test', 'email_verified' => true]));

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs($member);
    expect(SocialAccount::query()->where('user_id', $member->id)->where('provider_user_id', 'g-77')->exists())->toBeTrue();
});

it('still asks for the second factor after single sign-on', function () {
    requireSso();
    $member = User::factory()->withTwoFactor()->create();
    SocialAccount::factory()->for($member)->create(['provider' => 'google', 'provider_user_id' => 'g-79']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-79']));

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('two-factor.login'));

    $this->assertGuest();
});

it('does not send a refused single sign-on to the password when the setting is in force', function () {
    requireSso();
    User::factory()->unverified()->create(['email' => 'pending@example.test']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-78', 'email' => 'pending@example.test', 'email_verified' => true]));

    $this->get(route('sso.callback', 'google'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => 'An account already uses this email address and could not be matched to your single sign-on identity. Ask an administrator of this instance.']);

    $this->assertGuest();
});
