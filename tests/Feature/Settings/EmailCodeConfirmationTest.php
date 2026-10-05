<?php

use App\Enums\EmailCodePurpose;
use App\Mail\TwoFactorCodeMail;
use App\Models\EmailTwoFactorCode;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Features;

beforeEach(function () {
    Features::twoFactorAuthentication(['confirm' => true, 'confirmPassword' => true]);
    Features::passkeys(['confirmPassword' => true]);
    config(['skrum.mcp.enabled' => true, 'mail.default' => 'smtp']);
    Mail::fake();
});

function accountConfirmingWithCode(array $attributes = []): User
{
    $user = User::factory()->withTwoFactor()->create(['password' => Str::password(64), 'password_set_at' => null, ...$attributes]);

    SocialAccount::factory()->for($user)->create();

    return $user;
}

function storedConfirmationCode(User $user, string $code = '123456'): void
{
    EmailTwoFactorCode::query()->forceCreate([
        'user_id' => $user->id,
        'purpose' => EmailCodePurpose::Confirm,
        'code_hash' => EmailTwoFactorCode::hashCode($user->id, EmailCodePurpose::Confirm, $code),
        'sent_at' => now(),
        'expires_at' => now()->addMinutes(EmailTwoFactorCode::LifetimeMinutes),
    ]);
}

it('refuses the sensitive actions of an SSO-only account until it confirms with an e-mail code', function (string $method, string $route, array $payload) {
    $user = accountConfirmingWithCode();

    $this->actingAs($user)->json($method, route($route), $payload)->assertStatus(423);
})->with([
    'turn two-factor off' => ['delete', 'two-factor.disable', []],
    'show the recovery codes' => ['get', 'two-factor.recovery-codes', []],
    'regenerate the recovery codes' => ['post', 'two-factor.regenerate-recovery-codes', []],
    'ask for the options of a new passkey' => ['get', 'passkey.registration-options', []],
    'create an API token' => ['post', 'apiTokens.store', ['name' => 'Laptop', 'expiration' => '90_days']],
    'change the login e-mail' => ['patch', 'profile.update', ['name' => 'Sso', 'email' => 'sso.new@example.test']],
]);

it('mails an SSO-only account a code that confirms the session', function () {
    $user = accountConfirmingWithCode();

    $this->actingAs($user)->postJson(route('confirmationCodes.store'))
        ->assertOk()
        ->assertJson(['sentTo' => $user->email, 'resendIn' => 60]);

    Mail::assertQueued(TwoFactorCodeMail::class, fn (TwoFactorCodeMail $mail): bool => $mail->hasTo($user->email)
        && $mail->purpose === EmailCodePurpose::Confirm);

    $code = '';

    Mail::assertQueued(TwoFactorCodeMail::class, function (TwoFactorCodeMail $mail) use (&$code): bool {
        $code = $mail->code;

        return true;
    });

    $this->actingAs($user)->postJson(route('codeConfirmations.store'), ['code' => $code])->assertCreated();

    expect(session('auth.password_confirmed_at'))->not->toBeNull();

    $this->actingAs($user)->getJson(route('two-factor.recovery-codes'))->assertOk()->assertJson(['recovery-code-1']);

    $this->actingAs($user)->post(route('apiTokens.store'), ['name' => 'Laptop', 'expiration' => '90_days'])->assertSessionHasNoErrors();
    expect($user->tokens()->count())->toBe(1);

    $this->actingAs($user)->delete(route('two-factor.disable'))->assertRedirect();
    expect($user->fresh()->two_factor_secret)->toBeNull();
});

it('leads a page visit back to where it was going once the code is confirmed', function () {
    $user = accountConfirmingWithCode();
    storedConfirmationCode($user);

    $this->actingAs($user)->get(route('security.edit'))->assertRedirect(route('password.confirm'));

    $this->actingAs($user)->post(route('codeConfirmations.store'), ['code' => '123456'])
        ->assertRedirect(route('security.edit'));
});

it('does not confirm the session with a wrong code, a sign-in code or an expired code', function (Closure $arrange) {
    $user = accountConfirmingWithCode();
    $arrange($user);

    $this->actingAs($user)->postJson(route('codeConfirmations.store'), ['code' => '123456'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('code');

    expect(session('auth.password_confirmed_at'))->toBeNull();

    $this->actingAs($user)->getJson(route('two-factor.recovery-codes'))->assertStatus(423);
})->with([
    'a wrong code' => [fn (User $user) => storedConfirmationCode($user, '654321')],
    'a sign-in code' => [fn (User $user) => EmailTwoFactorCode::query()->forceCreate([
        'user_id' => $user->id,
        'purpose' => EmailCodePurpose::Login,
        'code_hash' => EmailTwoFactorCode::hashCode($user->id, EmailCodePurpose::Login, '123456'),
        'sent_at' => now(),
        'expires_at' => now()->addMinutes(10),
    ])],
    'an expired code' => [function (User $user) {
        storedConfirmationCode($user);
        EmailTwoFactorCode::query()->update(['expires_at' => now()->subMinute()]);
    }],
]);

it('keeps the password confirmation for an account with a password', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->postJson(route('confirmationCodes.store'))->assertNotFound();
    $this->actingAs($user)->postJson(route('codeConfirmations.store'), ['code' => '123456'])->assertNotFound();

    Mail::assertNothingQueued();

    $this->actingAs($user)->get(route('password.confirm'))
        ->assertInertia(fn (Assert $page) => $page->component('auth/confirm-password')->where('confirmsWith', 'password'));

    $this->actingAs($user)->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('profile.confirmsWith', 'password'));
});

it('tells the pages that an SSO-only account confirms with a code', function () {
    $user = accountConfirmingWithCode();

    $this->actingAs($user)->get(route('password.confirm'))
        ->assertInertia(fn (Assert $page) => $page->component('auth/confirm-password')->where('confirmsWith', 'code'));

    $this->actingAs($user)->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('profile.confirmsWith', 'code')
            ->where('security.locked', true)
            ->where('security.protected', null));
});

it('deletes an SSO-only account only once the session is confirmed with a code', function () {
    $user = accountConfirmingWithCode();

    $this->actingAs($user)->from(route('settings.edit'))->delete(route('profile.destroy'))
        ->assertSessionHasErrors('password');

    expect($user->fresh())->not->toBeNull();

    storedConfirmationCode($user);
    $this->actingAs($user)->postJson(route('codeConfirmations.store'), ['code' => '123456'])->assertCreated();

    $this->actingAs($user)->delete(route('profile.destroy'))->assertSessionHasNoErrors();

    expect($user->fresh())->toBeNull();
});

it('lets an SSO-only account set its first password only once the session is confirmed with a code', function () {
    $user = accountConfirmingWithCode();
    $password = ['password' => 'A-new-pass-2026!', 'password_confirmation' => 'A-new-pass-2026!'];

    $this->actingAs($user)->from(route('settings.edit'))->put(route('user-password.update'), $password)
        ->assertSessionHasErrors('password');

    expect($user->fresh()->password_set_at)->toBeNull();

    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->put(route('user-password.update'), $password)
        ->assertSessionHasNoErrors();

    expect(Hash::check('A-new-pass-2026!', $user->fresh()->password))->toBeTrue();
});

it('changes the login e-mail of an SSO-only account once the session is confirmed with a code', function () {
    $user = accountConfirmingWithCode(['email' => 'sso@example.test']);

    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->patch(route('profile.update'), ['name' => 'Sso', 'email' => 'sso.new@example.test'])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->email)->toBe('sso.new@example.test');
});

it('says in the mail that a code confirming an action is not a sign-in', function () {
    $html = (string) new TwoFactorCodeMail('042917', 10, null, '1 Oct, 2:02 pm (UTC)', EmailCodePurpose::Confirm)->render();

    expect($html)->toContain('Someone is signed in to your account')
        ->not->toContain('Someone has your password');
});
