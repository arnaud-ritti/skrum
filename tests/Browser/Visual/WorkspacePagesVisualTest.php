<?php

use App\Enums\ColumnColor;
use App\Enums\RetroPhase;
use App\Enums\TemplateCategory;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

it('renders the workspace page of an admin without overflow', function () {
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

    $this->captureVisuals('workspace-page', $path, fn (string $path, array $options) => visualSignIn($admin, $path, $options)
        ->assertCount('a[data-slot="team-tile"]', 3)
        ->assertPresent('[data-slot="new-team-tile"]')
        ->assertPresent('[data-slot="workspace-leave"]')
        ->assertCount('[data-slot="team-activity"] li', 9)
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0));

    $this->captureVisuals('workspace-page-leave', $path, fn (string $path, array $options) => visualSignIn($admin, $path, $options)
        ->click('[data-slot="workspace-leave"] button')
        ->assertPresent('[role="alertdialog"][data-slot="leave-workspace-panel"]'));
});

it('renders the states of the workspace page on the bench without overflow', function () {
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
            ->assertCount('[data-state="members"] [data-slot="member-row"]', 5)
            ->assertCount('[data-state="members"] [data-slot="invitation-row"]', 2)
            ->assertPresent('[data-state="members"] [data-slot="invitation-link"]')
            ->assertCount('[data-state="members-admin"] [data-slot="member-row"] [role="combobox"]', 4)
            ->assertCount('[data-state="members-long"] [data-slot="member-row"]', 2)
            ->assertPresent('[data-state="delete-workspace"] [data-slot="settings-card"][data-tone="destructive"]')
            ->assertPresent('[data-state="create"] [data-slot="create-workspace"] #name')
            ->assertCount('[data-state="templates"] [data-slot="retro-template-cards"] [data-slot="template-card"]', 4)
            ->assertCount('[data-state="templates"] [data-slot="poker-deck-cards"] [data-slot="template-card"]', 2)
            ->assertCount('[data-state="templates"] [data-slot="template-card-menu"]', 5)
            ->assertPresent('[data-state="templates"] [data-slot="whiteboard-templates-empty"]')
            ->assertCount('[data-state="templates-member"] [data-slot="template-card-menu"]', 1)
            ->assertPresent('[data-state="templates-retro"] [data-slot="retro-template-picker"] [role="radiogroup"]')
            ->assertPresent('[data-state="templates-empty"] [data-slot="retro-templates-empty"]')
            ->assertPresent('[data-state="templates-empty"] [data-slot="poker-decks-empty"]')
            ->assertCount('[data-state="templates-long"] [data-slot="template-card"]', 3)
            ->assertCount('[data-state="templates-long"] [data-slot="template-card"] button[aria-disabled="true"]', 3),
    );
});

it('renders the workspace creation page of a user without a workspace, without overflow', function () {
    config(['app.name' => 'Skrum']);

    $user = User::factory()->create([
        'id' => '0199a000-0000-7000-8000-000000000990',
        'name' => 'Mona Lindqvist',
        'email' => 'mona@example.com',
    ]);

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals('workspace-create', '/workspaces/create', fn (string $path, array $options) => visualSignIn($user, $path, $options)
        ->assertPresent('[data-slot="create-workspace"] #name')
        ->assertPresent('[data-sidebar="sidebar"]'));
});

it('renders the members page of an owner without overflow', function () {
    config(['app.name' => 'Skrum']);

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $names = [
        'Arnaud Ritti' => WorkspaceRole::Owner,
        'Camille Roux' => WorkspaceRole::Admin,
        'Inès Benali' => WorkspaceRole::Admin,
        'Malik Kone' => WorkspaceRole::Member,
        'Théo Martin' => WorkspaceRole::Member,
    ];
    $index = 60;
    $owner = null;

    foreach ($names as $name => $role) {
        $user = User::factory()->create([
            'id' => sprintf('0199a000-0000-7000-8000-0000000009%02d', $index++),
            'name' => $name,
            'email' => str($name)->slug('.').'@nordlys.example',
        ]);
        $workspace->members()->attach($user, ['role' => $role->value]);
        $owner ??= $user;
    }

    WorkspaceInvitation::factory()->for($workspace)->create([
        'email' => 'lucas.p@nordlys.example',
        'created_at' => '2026-09-26 09:00:00',
    ]);
    WorkspaceInvitation::factory()->for($workspace)->expired()->create([
        'email' => 'sofia.ortega@nordlys.example',
        'role' => WorkspaceRole::Admin,
        'created_at' => '2026-09-12 09:00:00',
    ]);

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $path = route('workspaces.members.index', $workspace, false);

    $this->captureVisuals('workspace-members', $path, fn (string $path, array $options) => visualSignIn($owner, $path, $options)
        ->assertCount('[data-slot="member-row"]', 5)
        ->assertCount('[data-slot="invitation-row"]', 2)
        ->assertPresent('[data-slot="settings-card"][data-tone="destructive"]')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0));

    $this->captureVisuals('workspace-members-invite', $path, fn (string $path, array $options) => visualSignIn($owner, $path, $options)
        ->click('[data-slot="members-header"] button')
        ->assertPresent('[role="dialog"] input[name="email"]'));
});

it('renders the templates page of an admin without overflow', function () {
    config(['app.name' => 'Skrum']);

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $authors = [];

    foreach (['Camille Roux' => WorkspaceRole::Admin, 'Arnaud Ritti' => WorkspaceRole::Owner, 'Malik Kone' => WorkspaceRole::Member] as $name => $role) {
        $user = User::factory()->create([
            'id' => sprintf('0199a000-0000-7000-8000-0000000009%02d', 70 + count($authors)),
            'name' => $name,
            'email' => str($name)->slug('.').'@nordlys.example',
        ]);
        $workspace->members()->attach($user, ['role' => $role->value]);
        $authors[$name] = $user;
    }

    $admin = $authors['Camille Roux'];
    $atlas = Team::factory()->for($workspace)->create([
        'id' => '0199a000-0000-7000-8000-000000000870',
        'name' => 'Atlas',
    ]);
    $atlas->members()->attach($admin);

    $templates = [
        ['4L', 'Camille Roux', TemplateCategory::Essentials, [['Liked', ColumnColor::Moss], ['Learned', ColumnColor::Sky], ['Lacked', ColumnColor::Coral], ['Longed for', ColumnColor::Sun]], 12],
        ['Start / Stop / Continue', 'Arnaud Ritti', TemplateCategory::Essentials, [['Start', ColumnColor::Moss], ['Stop', ColumnColor::Coral], ['Continue', ColumnColor::Sky]], 9],
        ['Mad / Sad / Glad', 'Malik Kone', TemplateCategory::TeamMood, [['Mad', ColumnColor::Coral], ['Sad', ColumnColor::Iris], ['Glad', ColumnColor::Sun]], 4],
    ];

    foreach ($templates as $index => [$name, $author, $category, $columns, $uses]) {
        $template = WorkspaceTemplate::factory()->create([
            'id' => sprintf('0199a000-0000-7000-8000-0000000007%02d', $index),
            'workspace_id' => $workspace->id,
            'name' => $name,
            'category' => $category,
            'created_by_user_id' => $authors[$author]->id,
        ]);

        foreach ($columns as $position => [$title, $color]) {
            WorkspaceTemplateColumn::factory()->create([
                'workspace_template_id' => $template->id,
                'title' => $title,
                'description' => null,
                'color' => $color,
                'position' => $position,
            ]);
        }

        Retro::factory()->for($atlas)->count($uses)->create([
            'template' => 'workspace',
            'workspace_template_id' => $template->id,
        ]);
    }

    SavedPokerDeck::factory()->forWorkspace($workspace)->create([
        'id' => '0199a000-0000-7000-8000-000000000760',
        'name' => 'Fibonacci + coffee',
        'cards' => ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'],
        'created_by_user_id' => $admin->id,
    ]);
    SavedPokerDeck::factory()->forWorkspace($workspace)->create([
        'id' => '0199a000-0000-7000-8000-000000000761',
        'name' => 'T-shirt sizing',
        'cards' => ['XS', 'S', 'M', 'L', 'XL', '?'],
        'created_by_user_id' => $authors['Malik Kone']->id,
    ]);

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $path = route('workspaces.templates.index', $workspace, false);

    $this->captureVisuals('workspace-templates', $path, fn (string $path, array $options) => visualSignIn($admin, $path, $options)
        ->assertCount('[data-slot="retro-template-cards"] [data-slot="template-card"]', 3)
        ->assertCount('[data-slot="poker-deck-cards"] [data-slot="template-card"]', 2)
        ->assertPresent('[data-slot="whiteboard-templates-empty"]')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0));

    $this->captureVisuals('workspace-templates-retro', $path, fn (string $path, array $options) => visualSignIn($admin, $path, $options)
        ->click('[data-slot="templates-tabs"] [role="tab"]:nth-of-type(2)')
        ->assertPresent('[data-slot="retro-template-picker"] [role="radiogroup"]')
        ->assertPresent('section[data-slot="template-detail"]'));

    $this->captureVisuals('workspace-templates-editor', $path, fn (string $path, array $options) => visualSignIn($admin, $path, $options)
        ->click('[data-slot="workspace-templates-page"] > header button')
        ->assertPresent('[role="dialog"] #template-name')
        ->assertPresent('[role="dialog"] #template-source'));
});
