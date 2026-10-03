<?php

use App\Actions\Auth\IssueMagicLink;
use App\Mail\TwoFactorCodeMail;
use App\Models\Passkey;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Passkeys\Actions\VerifyPasskey;
use Laravel\Passkeys\Contracts\PasskeyUser;
use Laravel\Passkeys\Passkey as BasePasskey;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use ParagonIE\ConstantTime\Base64UrlSafe;
use Webauthn\PublicKeyCredential;
use Webauthn\PublicKeyCredentialRequestOptions;

it('stamps the time of a password sign-in', function () {
    $this->travelTo(now()->setDateTime(2026, 10, 3, 9, 0, 0));
    $user = User::factory()->create(['password' => 'password']);

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password']);

    expect($user->fresh()->last_signed_in_at?->toIso8601String())->toBe('2026-10-03T09:00:00+00:00');
});

it('stamps the time of a magic-link sign-in', function () {
    config(['mail.default' => 'smtp']);
    Mail::fake();
    $user = User::factory()->create();
    $token = basename((string) parse_url(resolve(IssueMagicLink::class)->handle($user), PHP_URL_PATH));

    $this->post(route('magicLinks.sessions.store', $token))->assertRedirect(route('dashboard'));

    expect($user->fresh()->last_signed_in_at)->not->toBeNull();
});

it('stamps the time once the e-mail code is accepted, not after the password alone', function () {
    config(['mail.default' => 'smtp']);
    Mail::fake();
    $user = User::factory()->withEmailSecondFactor()->create();

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])->assertRedirect(route('two-factor.login'));

    expect($user->fresh()->last_signed_in_at)->toBeNull();

    $code = '';
    Mail::assertQueued(TwoFactorCodeMail::class, function (TwoFactorCodeMail $mail) use (&$code): bool {
        $code = $mail->code;

        return true;
    });

    $this->post(route('twoFactor.emailChallenges.store'), ['code' => $code])->assertRedirect(route('dashboard'));

    expect($user->fresh()->last_signed_in_at)->not->toBeNull();
});

it('stamps the time of an SSO sign-in', function () {
    config([
        'services.google.client_id' => 'google-id',
        'services.google.client_secret' => 'google-secret',
    ]);
    $user = User::factory()->create();
    SocialAccount::factory()->for($user)->create(['provider' => 'google', 'provider_user_id' => 'g-1']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-1']));

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('dashboard'));

    expect($user->fresh()->last_signed_in_at)->not->toBeNull();
});

it('stamps the time of a passkey sign-in', function () {
    $user = User::factory()->create();
    $this->app->instance(VerifyPasskey::class, new class($user) extends VerifyPasskey
    {
        public function __construct(private User $user) {}

        public function __invoke(PublicKeyCredential $credential, PublicKeyCredentialRequestOptions $options, ?PasskeyUser $user = null): BasePasskey
        {
            return (new Passkey)->setRelation('user', $this->user);
        }
    });

    $this->getJson(route('passkey.login-options'))->assertOk();
    $this->postJson(route('passkey.login'), ['credential' => [
        'id' => 'AQID',
        'rawId' => 'AQID',
        'type' => 'public-key',
        'response' => [
            'clientDataJSON' => Base64UrlSafe::encodeUnpadded((string) json_encode(['type' => 'webauthn.get', 'challenge' => 'AAAA', 'origin' => 'http://localhost'])),
            'authenticatorData' => Base64UrlSafe::encodeUnpadded(str_repeat("\0", 37)),
            'signature' => 'AQID',
        ],
    ]])->assertSuccessful();

    expect($user->fresh()->last_signed_in_at)->not->toBeNull();
});

it('leaves the other columns of the account untouched', function () {
    $user = User::factory()->create(['password' => 'password']);
    $updatedAt = $user->updated_at?->toIso8601String();
    $this->travel(5)->minutes();

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password']);

    expect($user->fresh()->updated_at?->toIso8601String())->toBe($updatedAt);
});

it('knows a deactivated account', function () {
    expect(User::factory()->deactivated()->create()->isDeactivated())->toBeTrue()
        ->and(User::factory()->create()->isDeactivated())->toBeFalse();
});

it('shares the version with a signed-in user only', function () {
    config(['skrum.version' => '1.8.2']);

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->where('instanceVersion', null));

    $this->actingAs(User::factory()->create())
        ->get(route('about.show'))
        ->assertInertia(fn (Assert $page) => $page->where('instanceVersion', '1.8.2'));
});

it('shares the update status with instance admins only', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('about.show'))
        ->assertInertia(fn (Assert $page) => $page->where('instanceVersionStatus', null));

    $this->actingAs(User::factory()->instanceAdmin()->create())
        ->get(route('about.show'))
        ->assertInertia(fn (Assert $page) => $page->where('instanceVersionStatus.state', 'unknown'));
});
