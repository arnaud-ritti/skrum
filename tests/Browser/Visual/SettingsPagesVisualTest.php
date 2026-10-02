<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

function p18eSettingsMember(bool $verified = true): User
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);

    $member = User::factory()->create([
        'id' => '0199a000-0000-7000-8000-000000000010',
        'name' => 'Mona Member',
        'email' => 'mona.member@example.com',
        'email_verified_at' => $verified ? now() : null,
    ]);
    $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($member);

    return $member;
}

/**
 * @param  array<string, string>  $options
 */
function p18eSettingsVisit(User $member, string $path, array $options, string $marker): mixed
{
    User::query()->whereKey($member->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

    $page = visit('/login', $options);

    $page->fill('#email', $member->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIsNot('/login');

    $page->navigate($path);

    return $page->assertPresent($marker)
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
}

it('renders the profile settings without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = p18eSettingsMember();

    $this->captureVisuals(
        'settings-profile-page',
        '/settings/profile',
        fn (string $path, array $options) => p18eSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-slot="profile-email-verified"]',
        ),
    );
});

it('renders the account deletion dialog without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = p18eSettingsMember();

    $this->captureVisuals(
        'settings-profile-delete-dialog',
        '/settings/profile',
        fn (string $path, array $options) => p18eSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-test="delete-user-button"]',
        )->click('@delete-user-button')
            ->assertPresent('[role="dialog"] #password'),
    );
});

it('renders the profile of an unverified member without overflow', function () {
    config(['app.name' => 'Skrum', 'skrum.mcp.enabled' => true]);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $member = p18eSettingsMember(verified: false);

    $this->captureVisuals(
        'settings-profile-unverified',
        '/settings/profile',
        fn (string $path, array $options) => p18eSettingsVisit(
            $member,
            $path,
            $options,
            '[data-slot="settings-shell"] [data-slot="alert"]',
        ),
    );
});
