<?php

use App\Actions\Auth\IssueMagicLink;
use App\Actions\Auth\SendEmailTwoFactorCode;
use App\Enums\EmailCodePurpose;
use App\Enums\SecondFactorMethod;
use App\Mail\TwoFactorCodeMail;
use App\Models\EmailTwoFactorCode;
use App\Models\SocialAccount;
use App\Models\User;
use App\Support\Auth\SecondFactors;
use App\Support\Auth\UserAgentSummary;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use PragmaRX\Google2FA\Google2FA;

beforeEach(function () {
    config(['mail.default' => 'smtp']);
    Mail::fake();
});

function lastEmailCode(): string
{
    $code = '';
    Mail::assertQueued(TwoFactorCodeMail::class, function (TwoFactorCodeMail $mail) use (&$code): bool {
        $code = $mail->code;

        return true;
    });

    return $code;
}

function wrongCodeFor(string $code): string
{
    return $code === '000000' ? '111111' : '000000';
}

function startEmailChallenge(User $user): void
{
    test()->post(route('login'), ['email' => $user->email, 'password' => 'password'])->assertRedirect(route('two-factor.login'));
}

function confirmedPassword(): array
{
    return ['auth.password_confirmed_at' => time()];
}

it('challenges on every entry', function (string $entry, string $factor) {
    config(['services.google.client_id' => 'google-id', 'services.google.client_secret' => 'google-secret']);
    $user = $factor === 'totp' ? User::factory()->withTwoFactor()->create() : User::factory()->withEmailSecondFactor()->create();

    $response = match ($entry) {
        'password' => $this->post(route('login'), ['email' => $user->email, 'password' => 'password']),
        'sso' => (function () use ($user) {
            SocialAccount::factory()->for($user)->create(['provider' => 'google', 'provider_user_id' => 'g-1']);
            Socialite::fake('google', SocialiteUser::fake(['id' => 'g-1']));

            return $this->get(route('sso.callback', 'google'));
        })(),
        'magic-link' => $this->post(route('magicLinks.sessions.store', basename((string) parse_url(resolve(IssueMagicLink::class)->handle($user), PHP_URL_PATH)))),
    };

    $response->assertRedirect(route('two-factor.login'));
    $this->assertGuest();
    expect(session('login.id'))->toBe($user->id);
})->with(['password', 'sso', 'magic-link'])->with(['totp', 'email']);

it('lists the e-mail code among the factors', function () {
    $factors = resolve(SecondFactors::class);

    expect($factors->methodsFor(User::factory()->withEmailSecondFactor()->create()))->toBe([SecondFactorMethod::EmailCode])
        ->and($factors->methodsFor(User::factory()->withTwoFactor()->withEmailSecondFactor()->create()))->toBe([SecondFactorMethod::Totp, SecondFactorMethod::EmailCode]);
});

it('sends a code when the challenge starts for an e-mail-only user, and waits for a choice when an app is set too', function () {
    startEmailChallenge(User::factory()->withEmailSecondFactor()->create());
    Mail::assertQueuedCount(1);

    $this->flushSession();
    startEmailChallenge(User::factory()->withTwoFactor()->withEmailSecondFactor()->create());
    Mail::assertQueuedCount(1);
});

it('gives the challenge page its methods and the masked address', function () {
    $user = User::factory()->withEmailSecondFactor()->create(['email' => 'known@example.test']);
    startEmailChallenge($user);

    $this->get(route('two-factor.login'))->assertInertia(fn (Assert $page) => $page
        ->component('auth/two-factor-challenge')
        ->where('methods', ['email'])
        ->where('emailCode.sentTo', 'k…@example.test')
        ->where('emailCode.available', true)
        ->where('emailCode.resendIn', fn (int $seconds): bool => $seconds > 0 && $seconds <= 60));
});

it('signs in with the code, works once, and regenerates the session after the code', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);
    $code = lastEmailCode();
    $before = session()->getId();

    $this->post(route('twoFactor.emailChallenges.store'), ['code' => $code])->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs($user);
    expect(session()->getId())->not->toBe($before)->and(session()->has('login.id'))->toBeFalse();

    auth()->logout();
    $this->flushSession();
    $this->withSession(['login.id' => $user->id])
        ->post(route('twoFactor.emailChallenges.store'), ['code' => $code])
        ->assertRedirect(route('two-factor.login'));
    $this->assertGuest();
});

it('stores an HMAC, not the code', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);
    $code = lastEmailCode();
    $row = EmailTwoFactorCode::query()->sole();

    expect($code)->toMatch('/^\d{6}$/')
        ->and($row->code_hash)->toBe(hash_hmac('sha256', "{$user->id}|login|{$code}", (string) config('app.key')))
        ->and($row->code_hash)->not->toBe(hash('sha256', $code))
        ->and((string) json_encode($row->getAttributes()))->not->toContain("\"{$code}\"")
        ->and(new TwoFactorCodeMail($code, 10, null, '1 Oct, 2:02 pm (UTC)'))->toBeInstanceOf(ShouldBeEncrypted::class);
});

it('expires after 10 minutes', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);
    $code = lastEmailCode();

    $this->travel(10)->minutes();
    $this->travel(1)->seconds();

    $this->post(route('twoFactor.emailChallenges.store'), ['code' => $code])->assertRedirect(route('two-factor.login'));
    $this->assertGuest();
});

it('the fifth wrong attempt kills the code', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);
    $code = lastEmailCode();
    $this->withoutMiddleware(ThrottleRequests::class);

    foreach (range(1, 5) as $attempt) {
        $this->post(route('twoFactor.emailChallenges.store'), ['code' => wrongCodeFor($code)])
            ->assertRedirect(route('two-factor.login'));
    }

    $this->post(route('twoFactor.emailChallenges.store'), ['code' => $code])
        ->assertRedirect(route('two-factor.login'));
    $this->assertGuest();

    $this->travel(61)->seconds();
    $this->post(route('twoFactor.emailCodes.store'))->assertRedirect();
    Mail::assertQueuedCount(2);
});

it('throttles code attempts by challenge', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);

    foreach (range(1, 5) as $attempt) {
        $this->post(route('twoFactor.emailChallenges.store'), ['code' => '000000']);
    }

    $this->post(route('twoFactor.emailChallenges.store'), ['code' => '000000'])->assertTooManyRequests();
});

it('does not resend within 60 seconds, and a resend invalidates the previous code', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);
    $first = lastEmailCode();

    $this->post(route('twoFactor.emailCodes.store'))->assertRedirect()->assertSessionHasNoErrors();
    Mail::assertQueuedCount(1);

    $this->travel(61)->seconds();
    $this->post(route('twoFactor.emailCodes.store'))->assertRedirect();
    Mail::assertQueuedCount(2);

    expect(EmailTwoFactorCode::query()->count())->toBe(1);
    $second = EmailTwoFactorCode::query()->sole();

    if ($second->code_hash !== EmailTwoFactorCode::hashCode($user->id, EmailCodePurpose::Login, $first)) {
        $this->post(route('twoFactor.emailChallenges.store'), ['code' => $first])->assertRedirect(route('two-factor.login'));
        $this->assertGuest();
    }
});

it('stops at five codes an hour', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    $send = resolve(SendEmailTwoFactorCode::class);

    $sent = collect(range(1, 7))->map(function () use ($send, $user): bool {
        $result = $send->handle($user, EmailCodePurpose::Login, null);
        $this->travel(61)->seconds();

        return $result;
    });

    expect($sent->filter()->count())->toBe(5);

    $this->travel(1)->hours();

    expect($send->handle($user, EmailCodePurpose::Login, null))->toBeTrue();
});

it('a code of another purpose or user is refused', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    $other = User::factory()->withEmailSecondFactor()->create();
    resolve(SendEmailTwoFactorCode::class)->handle($user, EmailCodePurpose::Enable, null);
    $enableCode = lastEmailCode();

    $this->withSession(['login.id' => $user->id])
        ->post(route('twoFactor.emailChallenges.store'), ['code' => $enableCode])
        ->assertRedirect(route('two-factor.login'));
    $this->withSession(['login.id' => $other->id])
        ->post(route('twoFactor.emailChallenges.store'), ['code' => $enableCode])
        ->assertRedirect(route('two-factor.login'));

    $this->assertGuest();
});

it('a challenge for a deleted user goes back to login', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);
    $user->delete();

    $this->post(route('twoFactor.emailChallenges.store'), ['code' => '123456'])->assertRedirect();
    $this->post(route('twoFactor.emailCodes.store'))->assertRedirect();
    $this->get(route('two-factor.login'))->assertRedirect(route('login'));
    $this->assertGuest();
});

it('refuses a code that is not six digits', function (mixed $code) {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);

    $this->post(route('twoFactor.emailChallenges.store'), ['code' => $code])->assertSessionHasErrors('code');
    $this->assertGuest();
})->with(['', '12345', '1234567', 'abcdef', '12 456', [['123456']]]);

it('the authenticator route refuses an e-mail code without a server error', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);
    $code = lastEmailCode();

    $this->post(route('two-factor.login.store'), ['code' => $code])->assertRedirect(route('two-factor.login'));
    $this->post(route('two-factor.login.store'), ['recovery_code' => 'anything'])->assertRedirect(route('two-factor.login'));
    $this->assertGuest();
});

it('the authenticator route refuses the code and the recovery code of an app that was never confirmed', function () {
    $secret = resolve(Google2FA::class)->generateSecretKey();
    $user = User::factory()->withTwoFactor()->withEmailSecondFactor()->create([
        'two_factor_secret' => encrypt($secret),
        'two_factor_confirmed_at' => null,
    ]);
    startEmailChallenge($user);

    $this->post(route('two-factor.login.store'), ['code' => resolve(Google2FA::class)->getCurrentOtp($secret)])->assertRedirect(route('two-factor.login'));
    $this->post(route('two-factor.login.store'), ['recovery_code' => 'recovery-code-1'])->assertRedirect(route('two-factor.login'));
    $this->assertGuest();
});

it('leaves no challenge state in the session once signed in', function (string $factor) {
    $user = $factor === 'totp' ? User::factory()->withTwoFactor()->create() : User::factory()->withEmailSecondFactor()->create();
    $this->post(route('login'), ['email' => $user->email, 'password' => 'password'])->assertRedirect(route('two-factor.login'));

    expect(session('login.entry'))->toBe('password');

    $factor === 'totp'
        ? $this->post(route('two-factor.login.store'), ['recovery_code' => 'recovery-code-1'])
        : $this->post(route('twoFactor.emailChallenges.store'), ['code' => lastEmailCode()]);

    $this->assertAuthenticatedAs($user);

    expect(session()->has('login.entry'))->toBeFalse()
        ->and(session()->has('login.id'))->toBeFalse();
})->with(['totp', 'email']);

it('still accepts a recovery code for a user with an authenticator app', function () {
    $user = User::factory()->withTwoFactor()->withEmailSecondFactor()->create();
    $this->post(route('login'), ['email' => $user->email, 'password' => 'password']);

    $this->post(route('two-factor.login.store'), ['recovery_code' => 'recovery-code-1'])->assertRedirect(route('dashboard'));
    $this->assertAuthenticatedAs($user);
});

it('fails closed when mail does not deliver', function () {
    config(['mail.default' => 'log']);
    $user = User::factory()->withEmailSecondFactor()->create();

    startEmailChallenge($user);

    Mail::assertNothingQueued();
    $this->assertGuest();
    $this->get(route('two-factor.login'))->assertInertia(fn (Assert $page) => $page->where('emailCode.available', false));
});

it('enabling needs password confirmation and a received code', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post(route('emailSecondFactor.codes.store'))->assertRedirect(route('password.confirm'));
    $this->actingAs($user)->post(route('emailSecondFactor.store'), ['code' => '123456'])->assertRedirect(route('password.confirm'));

    $this->actingAs($user)->withSession(confirmedPassword())->post(route('emailSecondFactor.codes.store'))->assertRedirect();
    $code = lastEmailCode();

    $this->actingAs($user)->withSession(confirmedPassword())
        ->post(route('emailSecondFactor.store'), ['code' => wrongCodeFor($code)])
        ->assertSessionHasErrors('code');
    expect($user->fresh()->two_factor_email_enabled_at)->toBeNull();

    $this->actingAs($user)->withSession(confirmedPassword())
        ->post(route('emailSecondFactor.store'), ['code' => $code])
        ->assertSessionHasNoErrors();
    expect($user->fresh()->two_factor_email_enabled_at)->not->toBeNull();
});

it('refuses to enable for a guest or an unverified account', function () {
    $this->post(route('emailSecondFactor.codes.store'))->assertRedirect(route('login'));

    $this->actingAs(User::factory()->unverified()->create())->withSession(confirmedPassword())
        ->post(route('emailSecondFactor.codes.store'))
        ->assertRedirect(route('verification.notice'));
});

it('disabling needs password confirmation', function () {
    $user = User::factory()->withEmailSecondFactor()->create();

    $this->actingAs($user)->delete(route('emailSecondFactor.destroy'))->assertRedirect(route('password.confirm'));
    expect($user->fresh()->two_factor_email_enabled_at)->not->toBeNull();

    $this->actingAs($user)->withSession(confirmedPassword())->delete(route('emailSecondFactor.destroy'))->assertRedirect();
    expect($user->fresh()->two_factor_email_enabled_at)->toBeNull();
});

it('gives the security page the state of the e-mail factor', function () {
    $user = User::factory()->withEmailSecondFactor()->create(['email' => 'known@example.test']);

    $this->actingAs($user)->withSession(confirmedPassword())->get(route('security.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('emailSecondFactor.available', true)
            ->where('emailSecondFactor.enabled', true)
            ->where('emailSecondFactor.address', 'known@example.test')
            ->where('emailSecondFactor.resendIn', 0));
});

it('writes the code mail with the code in the subject, grouped, without an unsubscribe header', function () {
    $mail = new TwoFactorCodeMail('042917', 10, 'Firefox on macOS', '1 Oct, 2:02 pm (UTC)');

    $mail->assertHasSubject('Your '.config('app.name').' verification code: 042 917');
    $mail->assertSeeInHtml('042&nbsp;917', false);
    $mail->assertSeeInHtml('Requested from Firefox on macOS · 1 Oct, 2:02 pm (UTC)');
    expect(method_exists($mail, 'headers'))->toBeFalse();
});

it('reduces a user agent to fixed labels', function (?string $userAgent, ?string $expected) {
    expect(UserAgentSummary::describe($userAgent))->toBe($expected);
})->with([
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0', 'Firefox on macOS'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0', 'Edge on Windows'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'Safari on iOS'],
    ['<script>alert(1)</script>', null],
    [null, null],
]);

it('limits asking for a new code to six a minute', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    $this->post(route('login'), ['email' => $user->email, 'password' => 'password'])->assertRedirect(route('two-factor.login'));

    foreach (range(1, 6) as $attempt) {
        $this->post(route('twoFactor.emailCodes.store'))->assertRedirect(route('two-factor.login'));
    }

    $this->post(route('twoFactor.emailCodes.store'))->assertTooManyRequests();
});
