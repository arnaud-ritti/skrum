<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
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

it('renders the invitation page without overflow', function (string $name, string $token, ?string $account, string $marker) {
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
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $people = [
        'Camille Roux', 'Théo Martin', 'Inès Lopez', 'Max Schmidt', 'Zoé Petit', 'Yann Roy',
        'Lena Weber', 'Omar Haddad', 'Pia Jensen', 'Rui Costa', 'Sam Okafor',
    ];
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);

    foreach ($people as $index => $person) {
        $workspace->members()->attach(
            User::factory()->create(['id' => sprintf('00000000-0000-4000-8000-%012d', $index + 1), 'name' => $person]),
            ['role' => WorkspaceRole::Member->value],
        );
    }

    $inviter = User::query()->where('name', 'Camille Roux')->sole();

    User::factory()->create(['id' => '00000000-0000-4000-8000-000000000101', 'name' => 'Nadia Benali', 'email' => 'nadia@nordlys.io']);
    User::factory()->create(['id' => '00000000-0000-4000-8000-000000000102', 'name' => 'Otto Other', 'email' => 'otto@example.com']);

    WorkspaceInvitation::factory()->withToken('pending-token')->create([
        'workspace_id' => $workspace->id,
        'email' => 'nadia@nordlys.io',
        'invited_by_id' => $inviter->id,
    ]);
    WorkspaceInvitation::factory()->withToken('expired-token')->create([
        'workspace_id' => $workspace->id,
        'email' => 'nadia@nordlys.io',
        'invited_by_id' => $inviter->id,
        'expires_at' => '2026-09-24 12:00:00',
    ]);

    $this->captureVisuals(
        $name,
        "/invitations/{$token}",
        function (string $path, array $options) use ($account, $marker) {
            if ($account === null) {
                return visit($path, $options)->assertPresent($marker);
            }

            User::query()->where('email', $account)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

            $page = visit('/login', $options);

            $page->fill('#email', $account)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIsNot('/login');

            $page->navigate($path);

            return $page->assertPresent($marker);
        },
    );
})->with([
    'logged out' => ['access-invitation-page', 'pending-token', null, '[data-slot="invitation-card"][data-state="logged-out"] [data-slot="sso-buttons"]'],
    'invited account' => ['access-invitation-accept-page', 'pending-token', 'nadia@nordlys.io', '[data-slot="invitation-card"][data-state="accept"]'],
    'another account' => ['access-invitation-wrong-account-page', 'pending-token', 'otto@example.com', '[data-slot="invitation-card"][data-state="wrong-account"]'],
    'expired' => ['access-invitation-expired-page', 'expired-token', null, '[data-slot="access-notice"][data-tone="warning"]'],
    'invalid' => ['access-invitation-invalid-page', 'unknown-token', null, '[data-slot="access-notice"][data-tone="default"]'],
]);
