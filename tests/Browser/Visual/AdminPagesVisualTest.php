<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\InstanceSettings;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

function p18dVisualAdmin(): User
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Demo Team']);

    $admin = User::factory()->instanceAdmin()->create([
        'id' => '0199a000-0000-7000-8000-000000000001',
        'name' => 'Fran Facilitator',
        'email' => 'fran@example.com',
    ]);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($admin);

    User::factory()->instanceAdmin()->create([
        'id' => '0199a000-0000-7000-8000-000000000002',
        'name' => 'Ada Lovelace',
        'email' => 'ada.lovelace@example.com',
    ]);
    User::factory()->instanceAdmin()->create([
        'id' => '0199a000-0000-7000-8000-000000000003',
        'name' => 'Maximilian Alexander von Hohenberg-Lichtenstein',
        'email' => 'maximilian.alexander.von.hohenberg@a-rather-long-domain.example.com',
    ]);

    resolve(InstanceSettings::class)->setMany([
        'brand_color' => '#ffd600',
        'avatar_style' => 'fun-emoji',
        'gif_provider' => 'giphy',
        'gif_key' => 'visual-test-key',
    ]);

    return $admin;
}

/**
 * @param  array<string, string>  $options
 */
function p18dVisualVisit(User $admin, string $path, array $options, string $marker): mixed
{
    User::query()->whereKey($admin->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

    $page = visit('/login', $options);

    $page->fill('#email', $admin->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIsNot('/login');

    $page->navigate($path);

    if (str_starts_with($path, '/admin')) {
        $page->assertPathIs('/user/confirm-password')
            ->fill('#password', 'password')
            ->click('@confirm-password-button')
            ->assertPathIs($path);
    }

    return $page->assertPresent($marker)
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
}

it('renders the instance admin pages and the about page without overflow', function (string $name, string $path, string $marker) {
    config(['app.name' => 'Skrum', 'app.key' => 'base64:'.base64_encode(str_repeat('v', 32))]);

    $admin = p18dVisualAdmin();

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        $name,
        $path,
        fn (string $path, array $options) => p18dVisualVisit($admin, $path, $options, $marker),
    );
})->with([
    'branding' => ['admin-branding-page', '/admin/branding', '[data-slot="branding-form"] [data-slot="color-applied-light"]'],
    'admins' => ['admin-admins-page', '/admin/admins', '[data-slot="admins-panel"] [data-slot="admin-row"]'],
    'about' => ['about-page', '/about', '[data-slot="about"] [data-slot="about-attribution"]'],
]);

it('renders the branding page with a stored radius outside the segments and a staged logo without overflow', function () {
    config(['app.name' => 'Skrum', 'app.key' => 'base64:'.base64_encode(str_repeat('v', 32))]);

    $admin = p18dVisualAdmin();

    resolve(InstanceSettings::class)->setMany(['brand_radius' => 6]);

    $logo = sys_get_temp_dir().'/atlas-logo.png';

    file_put_contents($logo, (string) base64_decode(WhiteboardPng, true));

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        'admin-branding-exact-radius-staged',
        '/admin/branding',
        fn (string $path, array $options) => p18dVisualVisit($admin, $path, $options, '[data-slot="radius-exact"] input')
            ->attach('[data-slot="asset-uploader"] input[type="file"]', $logo)
            ->assertPresent('[data-slot="asset-undo"]'),
    );
});
