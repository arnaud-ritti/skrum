<?php

use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

it('renders the access pages without overflow', function (string $name, string $path, string $marker) {
    config([
        'app.name' => 'Skrum',
        'oidc.connections.generic.base_url' => 'https://sso.example.com',
        'oidc.connections.generic.client_id' => 'visual-test',
        'oidc.connections.generic.client_secret' => 'visual-test',
        'oidc.connections.generic.label' => 'SSO (OIDC)',
        'services.google.client_id' => 'visual-test',
        'services.google.client_secret' => 'visual-test',
        'services.github.client_id' => 'visual-test',
        'services.github.client_secret' => 'visual-test',
    ]);

    $this->captureVisuals(
        $name,
        $path,
        fn (string $path, array $options) => visit($path, $options)->assertPresent($marker),
    );
})->with([
    'login' => ['access-login-page', '/login', '[data-slot="login-form"] [data-slot="sso-buttons"]'],
    'register' => ['access-register-page', '/register', '[data-slot="register-form"] [data-slot="sso-buttons"]'],
    'forgot password' => ['access-forgot-password-page', '/forgot-password', '[data-slot="forgot-password-form"] #email'],
    'reset password' => ['access-reset-password-page', '/reset-password/visual-token?email=mona.member%40example.com', '[data-slot="reset-password-form"] #password_confirmation'],
]);

it('renders the e-mail verification page without overflow', function () {
    config(['app.name' => 'Skrum']);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = User::factory()->unverified()->create([
        'name' => 'Mona Member',
        'email' => 'mona.member@example.com',
    ]);

    $this->captureVisuals(
        'access-verify-email-page',
        '/email/verify',
        function (string $path, array $options) use ($member) {
            User::query()->whereKey($member->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

            $page = visit('/login', $options);

            $page->fill('#email', $member->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIsNot('/login');

            $page->navigate($path);

            return $page->assertPresent('[data-slot="verify-email-form"]');
        },
    );
});

it('renders the two-factor challenge without overflow', function (string $name, bool $recovery) {
    config(['app.name' => 'Skrum']);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = User::factory()->withTwoFactor()->create([
        'name' => 'Mona Member',
        'email' => 'mona.member@example.com',
    ]);

    $this->captureVisuals(
        $name,
        '/two-factor-challenge',
        function (string $path, array $options) use ($member, $recovery) {
            $page = visit('/login', $options);

            $page->fill('#email', $member->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIs($path)
                ->assertPresent('[data-slot="two-factor-form"] input[name="code"]');

            if (! $recovery) {
                return $page;
            }

            return $page->click('[data-slot="two-factor-mode"]')
                ->assertPresent('[data-slot="two-factor-form"] input[name="recovery_code"]');
        },
    );
})->with([
    'authentication code' => ['access-two-factor-page', false],
    'recovery code' => ['access-two-factor-recovery-page', true],
]);

it('renders the password confirmation without overflow', function () {
    config(['app.name' => 'Skrum']);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = User::factory()->create([
        'name' => 'Mona Member',
        'email' => 'mona.member@example.com',
    ]);

    $this->captureVisuals(
        'access-confirm-password-page',
        '/user/confirm-password',
        function (string $path, array $options) use ($member) {
            User::query()->whereKey($member->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

            $page = visit('/login', $options);

            $page->fill('#email', $member->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIsNot('/login');

            $page->navigate($path);

            return $page->assertPresent('[data-slot="confirm-password-form"] #password');
        },
    );
});
