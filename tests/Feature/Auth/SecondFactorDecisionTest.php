<?php

use App\Actions\Auth\CompleteLogin;
use App\Actions\Auth\RedirectIfSecondFactorRequired;
use App\Enums\SecondFactorMethod;
use App\Models\SocialAccount;
use App\Models\User;
use App\Support\Auth\SecondFactors;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Laravel\Fortify\Contracts\RedirectsIfTwoFactorAuthenticatable;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Symfony\Component\Finder\SplFileInfo;

it('lists the second factors of a user', function () {
    $factors = resolve(SecondFactors::class);

    expect($factors->methodsFor(User::factory()->create()))->toBe([])
        ->and($factors->requiredFor(User::factory()->create()))->toBeFalse()
        ->and($factors->methodsFor(User::factory()->withTwoFactor()->create()))->toBe([SecondFactorMethod::Totp])
        ->and($factors->methodsFor(User::factory()->withTwoFactor()->create(['two_factor_confirmed_at' => null])))->toBe([]);
});

it('binds the pipeline step of Fortify to the shared decision', function () {
    expect(resolve(RedirectsIfTwoFactorAuthenticatable::class))->toBeInstanceOf(RedirectIfSecondFactorRequired::class);
});

it('challenges a password login of a user with an authenticator app', function () {
    $user = User::factory()->withTwoFactor()->create();

    $this->post(route('login'), ['email' => $user->email, 'password' => 'password', 'remember' => 'on'])
        ->assertRedirect(route('two-factor.login'));

    $this->assertGuest();
    expect(session('login.id'))->toBe($user->id)->and(session('login.remember'))->toBeTrue();
});

it('signs in a password login without a second factor', function () {
    $user = User::factory()->create();

    $this->post(route('login'), ['email' => $user->email, 'password' => 'password'])->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs($user);
});

it('completes a login through the shared action', function () {
    $plain = User::factory()->create();
    $protected = User::factory()->withTwoFactor()->create();
    $this->startSession();
    $sessionId = session()->getId();
    $request = Request::create('/');
    $request->setLaravelSession(session()->driver());

    $response = resolve(CompleteLogin::class)->handle($request, $protected);

    expect($response->getTargetUrl())->toBe(route('two-factor.login'))
        ->and(auth()->check())->toBeFalse()
        ->and(session('login.id'))->toBe($protected->id)
        ->and(session('login.remember'))->toBeFalse()
        ->and(session('login.local'))->toBeFalse();

    $response = resolve(CompleteLogin::class)->handle($request, $plain);

    expect($response->getTargetUrl())->toBe(route('dashboard'))
        ->and(auth()->id())->toBe($plain->id)
        ->and(session()->getId())->not->toBe($sessionId);
});

it('keeps the single sign-on callback on the shared action', function () {
    config(['services.google.client_id' => 'google-id', 'services.google.client_secret' => 'google-secret']);
    $user = User::factory()->withTwoFactor()->create();
    SocialAccount::factory()->for($user)->create(['provider' => 'google', 'provider_user_id' => 'g-1']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-1']));

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('two-factor.login'));

    $this->assertGuest();
});

it('lets no other file decide whether a challenge is due', function () {
    $allowed = [
        app_path('Support/Auth/SecondFactors.php'),
        app_path('Models/User.php'),
    ];

    $offenders = collect(File::allFiles(app_path()))
        ->reject(fn (SplFileInfo $file): bool => in_array($file->getPathname(), $allowed, true))
        ->filter(fn (SplFileInfo $file): bool => preg_match('/two_factor_secret|two_factor_confirmed_at|two_factor_email_enabled_at|hasEnabledTwoFactorAuthentication/', $file->getContents()) === 1)
        ->map(fn (SplFileInfo $file): string => $file->getRelativePathname())
        ->values()
        ->all();

    expect($offenders)->toBe([
        'Actions/Auth/RevokeLoginSecrets.php',
        'Http/Controllers/Settings/EmailSecondFactorsController.php',
        'Http/Controllers/Settings/SecurityController.php',
    ]);
});
