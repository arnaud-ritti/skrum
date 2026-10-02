<?php

use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

function workspaceVisualSignIn(User $user, string $path, array $options): mixed
{
    User::query()->whereKey($user->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

    $page = visit('/login', $options);

    $page->fill('#email', $user->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIsNot('/login');

    return $page->navigate($path);
}

it('[P18e-09-20] renders the workspace page of an admin without overflow', function () {
    config(['app.name' => 'Skrum']);

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $admin = User::factory()->create([
        'id' => '0199a000-0000-7000-8000-000000000921',
        'name' => 'Arnaud Ritti',
        'email' => 'arnaud@example.com',
    ]);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);

    $kestrel = Workspace::factory()->create(['name' => 'Kestrel Labs']);
    $kestrel->members()->attach($admin, ['role' => WorkspaceRole::Member->value]);

    $member = function (string $name, int $index) use ($workspace): User {
        $user = User::factory()->create([
            'id' => sprintf('0199a000-0000-7000-8000-0000000009%02d', $index),
            'name' => $name,
            'email' => str($name)->slug('.').'@nordlys.example',
        ]);
        $workspace->members()->attach($user, ['role' => $index === 30 ? WorkspaceRole::Owner->value : WorkspaceRole::Member->value]);

        return $user;
    };

    $teams = [
        'Atlas' => ['Camille Roux', 'Théo Martin', 'Inès Benali', 'Malik Kone'],
        'Borealis' => ['Bao Lin', 'Hugo Petit', 'Yuki Tanaka'],
        'Comet' => ['Lea Garnier'],
    ];
    $index = 30;
    $created = [];

    foreach ($teams as $teamName => $names) {
        $team = Team::factory()->for($workspace)->create([
            'id' => sprintf('0199a000-0000-7000-8000-0000000008%02d', count($created)),
            'name' => $teamName,
        ]);

        foreach ($names as $name) {
            $team->members()->attach($member($name, $index++));
        }

        $created[$teamName] = $team;
    }

    $created['Atlas']->members()->attach($admin);

    Retro::factory()->for($created['Atlas'])->inPhase(RetroPhase::Writing)->create(['title' => 'Sprint 42']);
    PokerGame::factory()->for($created['Atlas'])->count(3)->create();
    ActionItem::factory()->withoutRetro($created['Atlas'], $admin)->count(5)->create();
    ActionItem::factory()->withoutRetro($created['Atlas'], $admin)->overdue()->count(2)->create();
    Retro::factory()->for($created['Borealis'])->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subDays(3)]);
    ActionItem::factory()->withoutRetro($created['Borealis'], $admin)->count(4)->create();
    Retro::factory()->for($created['Comet'])->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subDays(14)]);
    PokerGame::factory()->for($created['Comet'])->create();

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $path = route('workspaces.show', $workspace, false);

    $this->captureVisuals('workspace-page', $path, fn (string $path, array $options) => workspaceVisualSignIn($admin, $path, $options)
        ->assertCount('a[data-slot="team-tile"]', 3)
        ->assertPresent('[data-slot="new-team-tile"]')
        ->assertPresent('[data-slot="workspace-leave"]')
        ->assertCount('[data-slot="team-activity"] li', 9)
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0));

    $this->captureVisuals('workspace-page-leave', $path, fn (string $path, array $options) => workspaceVisualSignIn($admin, $path, $options)
        ->click('[data-slot="workspace-leave"] button')
        ->assertPresent('[role="alertdialog"][data-slot="leave-workspace-panel"]'));
});

it('[P18e-09-20b] renders the states of the workspace page on the bench without overflow', function () {
    $this->captureVisuals(
        'workspace',
        '/dev/design-system/workspace',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-bench-section="workspace"]')
            ->assertCount('[data-state="manager"] a[data-slot="team-tile"]', 3)
            ->assertPresent('[data-state="manager"] [data-slot="new-team-tile"]')
            ->assertCount('[data-state="member"] a[data-slot="team-tile"]', 1)
            ->assertNotPresent('[data-state="member"] [data-slot="new-team-tile"]')
            ->assertPresent('[data-state="empty-manager"] [data-slot="workspace-teams-empty"]')
            ->assertPresent('[data-state="empty-manager"] [data-slot="new-team-tile"]')
            ->assertNotPresent('[data-state="empty-member"] [data-slot="workspace-teams"]')
            ->assertCount('[data-state="long"] a[data-slot="team-tile"]', 2)
            ->assertCount('[data-state="leave"] [data-slot="leave-consequences"] li', 3)
            ->assertPresent('[data-state="create"] [data-slot="create-workspace"] #name'),
    );
});

it('[P18e-09-20c] renders the workspace creation page of a user without a workspace, without overflow', function () {
    config(['app.name' => 'Skrum']);

    $user = User::factory()->create([
        'id' => '0199a000-0000-7000-8000-000000000990',
        'name' => 'Mona Lindqvist',
        'email' => 'mona@example.com',
    ]);

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals('workspace-create', '/workspaces/create', fn (string $path, array $options) => workspaceVisualSignIn($user, $path, $options)
        ->assertPresent('[data-slot="create-workspace"] #name')
        ->assertPresent('[data-sidebar="sidebar"]'));
});
