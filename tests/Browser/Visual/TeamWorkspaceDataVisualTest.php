<?php

use App\Enums\ColumnColor;
use App\Enums\RetroPhase;
use App\Enums\TeamActivityKind;
use App\Enums\TeamRole;
use App\Enums\TemplateCategory;
use App\Enums\TemplateVisibility;
use App\Enums\WorkspaceRole;
use App\Jobs\RefreshWhiteboardPreview;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamActivity;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

/**
 * The browser's clock is not the test's: the fixtures are dated from today, so the
 * captures read "today", "current sprint" and relative dates as a person would.
 */
function teamWorkspaceDataVisualMonday(): CarbonImmutable
{
    return CarbonImmutable::today()->startOfWeek(CarbonInterface::MONDAY);
}

/**
 * Sprint $number of the team, two weeks each, sprint 42 holding today.
 */
function teamWorkspaceDataVisualSprint(Team $team, int $number): void
{
    $startsOn = teamWorkspaceDataVisualMonday()->subWeek()->addWeeks(($number - 42) * 2);

    teamSprint($team, $number, $startsOn->toDateString(), $startsOn->addDays(13)->toDateString());
}

/**
 * Nordlys and its team Atlas: an owner (the viewer of most captures), two facilitators, two
 * members and an observer, the retro on Thursday at 14:00, two default facilitators with the
 * rotation on.
 *
 * @param  array<int, int>  $sprints
 * @return array{
 *     workspace: Workspace,
 *     team: Team,
 *     people: array<string, User>
 * }
 */
function teamWorkspaceDataVisualAtlas(array $sprints = [41, 42, 43]): array
{
    config(['app.name' => 'Skrum']);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $workspace = Workspace::factory()->create([
        'name' => 'Nordlys',
        'description' => 'Product and platform teams of Nordlys, Oslo and Lyon.',
    ]);
    $team = Team::factory()->for($workspace)->create([
        'id' => '0199a230-0000-7000-8000-000000000001',
        'name' => 'Atlas',
        'description' => 'Checkout and payments squad',
        'created_at' => '2025-03-12 09:00:00',
        'sprint_length_weeks' => 2,
        'retro_weekday' => 4,
        'retro_time' => '14:00',
        'facilitator_rotation_enabled' => true,
    ]);

    $roles = [
        'Camille Roux' => TeamRole::Owner,
        'Théo Martin' => TeamRole::Facilitator,
        'Inès Benali' => TeamRole::Facilitator,
        'Malik Kone' => TeamRole::Member,
        'Sofia Lindqvist' => TeamRole::Member,
        'Noa Kim' => TeamRole::Observer,
    ];
    $people = [];

    foreach ($roles as $name => $role) {
        $index = count($people);
        $user = User::factory()->create([
            'id' => sprintf('0199a230-0000-7000-8000-0000000001%02d', $index),
            'name' => $name,
            'email' => str($name)->slug('.').'@nordlys.example',
        ]);
        $workspace->members()->attach($user, ['role' => $index === 0 ? WorkspaceRole::Owner->value : WorkspaceRole::Member->value]);
        $team->members()->attach($user, ['role' => $role->value]);
        $people[$name] = $user;
    }

    foreach ($sprints as $number) {
        teamWorkspaceDataVisualSprint($team, $number);
    }

    $team->defaultFacilitators()->attach([
        $people['Théo Martin']->id => ['position' => 0],
        $people['Inès Benali']->id => ['position' => 1],
    ]);

    return ['workspace' => $workspace, 'team' => $team, 'people' => $people];
}

/**
 * A retro of Atlas with four columns and a few cards, facilitated by $facilitator; every
 * person of $participants joins it.
 *
 * @param  array<int, User>  $participants
 */
function teamWorkspaceDataVisualRetro(Team $team, string $id, string $title, RetroPhase $phase, User $facilitator, array $participants, CarbonInterface $at): Retro
{
    $retro = Retro::factory()->for($team)->inPhase($phase)->create([
        'id' => $id,
        'title' => $title,
        'template' => 'four_ls',
        'created_at' => $at,
        'updated_at' => $at,
        'completed_at' => $phase === RetroPhase::Completed ? $at->addHour() : null,
    ]);

    $joined = [];

    foreach ([$facilitator, ...$participants] as $person) {
        $joined[$person->id] ??= Participant::factory()->create([
            'retro_id' => $retro->id,
            'user_id' => $person->id,
            'created_at' => $at,
            'updated_at' => $at,
        ]);
    }

    $retro->timestamps = false;
    $retro->forceFill(['facilitator_participant_id' => $joined[$facilitator->id]->id])->save();
    $retro->timestamps = true;

    $columns = [
        ['Liked', ColumnColor::Moss, ['The client demo convinced them.', 'Pairing on reviews']],
        ['Learned', ColumnColor::Sky, ['Feature flags make the release calmer.']],
        ['Lacked', ColumnColor::Coral, ['We discover scope changes mid-sprint.']],
        ['Longed for', ColumnColor::Sun, []],
    ];
    $authors = array_values($joined);

    foreach ($columns as $position => [$columnTitle, $color, $cards]) {
        $column = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $columnTitle,
            'color' => $color,
            'position' => $position,
        ]);

        foreach ($cards as $cardPosition => $content) {
            Card::factory()->create([
                'retro_id' => $retro->id,
                'column_id' => $column->id,
                'participant_id' => $authors[$cardPosition % count($authors)]->id,
                'content' => $content,
                'position' => $cardPosition,
            ]);
        }
    }

    return $retro;
}

/**
 * A board with a few shapes and its thumbnail built.
 */
function teamWorkspaceDataVisualWhiteboard(Team $team, string $title, User $facilitator, CarbonInterface $at): Whiteboard
{
    $board = Whiteboard::factory()->for($team)->create(['title' => $title, 'seq' => 3, 'created_at' => $at, 'updated_at' => $at]);
    $shapes = [
        ['type' => 'rectangle', 'x' => 0, 'y' => 0, 'width' => 160, 'height' => 90, 'backgroundColor' => '#ffd966'],
        ['type' => 'rectangle', 'x' => 200, 'y' => 20, 'width' => 160, 'height' => 90, 'backgroundColor' => '#b6e3c6'],
        ['type' => 'ellipse', 'x' => 110, 'y' => 150, 'width' => 140, 'height' => 80, 'backgroundColor' => '#c9d8ff'],
        ['type' => 'rectangle', 'x' => 400, 'y' => 120, 'width' => 120, 'height' => 120, 'backgroundColor' => '#ffc9c9'],
    ];

    foreach ($shapes as $index => $shape) {
        WhiteboardElement::factory()->for($board)->create([
            'type' => $shape['type'],
            'data' => sceneElement(['id' => "shape-{$index}", 'strokeColor' => '#1e1e1e', ...$shape]),
        ]);
    }

    dispatch_sync(new RefreshWhiteboardPreview($board->id));

    $board->timestamps = false;
    $board->forceFill([
        'facilitator_member_id' => WhiteboardMember::factory()->create([
            'whiteboard_id' => $board->id,
            'user_id' => $facilitator->id,
        ])->id,
        'updated_at' => $at,
    ])->save();

    return $board;
}

/**
 * The team's own 4L, its default retro template, with four columns.
 */
function teamWorkspaceDataVisualTeamTemplate(Team $team, User $author): WorkspaceTemplate
{
    $template = WorkspaceTemplate::factory()->for($team->workspace)->create([
        'id' => '0199a230-0000-7000-8000-000000000301',
        'name' => 'Atlas 4L',
        'category' => TemplateCategory::Essentials,
        'visibility' => TemplateVisibility::Team,
        'team_id' => $team->id,
        'created_by_user_id' => $author->id,
    ]);

    foreach ([['Liked', ColumnColor::Moss], ['Learned', ColumnColor::Sky], ['Lacked', ColumnColor::Coral], ['Longed for', ColumnColor::Sun]] as $position => [$title, $color]) {
        WorkspaceTemplateColumn::factory()->create([
            'workspace_template_id' => $template->id,
            'title' => $title,
            'description' => null,
            'color' => $color,
            'position' => $position,
        ]);
    }

    $team->update(['default_retro_template' => $template->catalogueKey()]);

    return $template;
}

it('renders the team page with its sprint, recent sessions, open actions, activity and roles without overflow', function () {
    ['workspace' => $workspace, 'team' => $team, 'people' => $people] = teamWorkspaceDataVisualAtlas([41, 42, 43]);
    $owner = $people['Camille Roux'];
    $sprintStart = teamWorkspaceDataVisualMonday()->subWeek();

    teamWorkspaceDataVisualRetro($team, '0199a230-0000-7000-8000-000000000201', 'Sprint 42 retro', RetroPhase::Writing, $people['Théo Martin'], [$owner, $people['Malik Kone'], $people['Sofia Lindqvist']], now()->subMinutes(20));
    teamWorkspaceDataVisualRetro($team, '0199a230-0000-7000-8000-000000000202', 'Q3 release post-mortem', RetroPhase::Voting, $people['Inès Benali'], [$owner, $people['Malik Kone']], now()->subHours(3));
    teamWorkspaceDataVisualRetro($team, '0199a230-0000-7000-8000-000000000203', 'Sprint 41 retro', RetroPhase::Completed, $owner, [$people['Théo Martin'], $people['Inès Benali'], $people['Malik Kone'], $people['Sofia Lindqvist']], $sprintStart->subDays(1)->setTime(14, 0));

    $refinement = PokerGame::factory()->for($team)->create(['title' => 'Sprint 43 refinement', 'updated_at' => now()->subHour()]);
    PokerTask::factory()->count(4)->create(['poker_game_id' => $refinement->id]);

    teamWorkspaceDataVisualWhiteboard($team, 'Checkout journey map', $owner, now()->subHours(2));
    teamWorkspaceDataVisualWhiteboard($team, 'Payment retries architecture', $people['Théo Martin'], now()->subDays(2));
    teamWorkspaceDataVisualWhiteboard($team, 'Q4 roadmap brainstorm', $people['Inès Benali'], now()->subDays(6));

    GameRoom::factory()->for($team)->create(['name' => 'Friday hangman', 'updated_at' => now()->subMinutes(40)]);

    $actionItems = [
        ['Write the payment retry runbook', 'Sofia Lindqvist', true],
        ['Remove the legacy card form', 'Sofia Lindqvist', true],
        ['Add an alert on failed captures', 'Malik Kone', false],
        ['Pair on the 3-D Secure flow', 'Malik Kone', false],
        ['Share the checkout funnel every Monday', 'Malik Kone', false],
        ['Book a demo with the support team', 'Inès Benali', false],
        ['Split the refunds epic', 'Inès Benali', false],
    ];

    foreach ($actionItems as [$title, $assignee, $isOverdue]) {
        $factory = ActionItem::factory()->withoutRetro($team, $owner)->assignedTo($people[$assignee]);

        ($isOverdue ? $factory->overdue() : $factory)->create(['content' => $title]);
    }

    $lines = [
        [TeamActivityKind::RetroStarted, 'Théo Martin', 'Sprint 42 retro', 20],
        [TeamActivityKind::ActionItemCompleted, 'Malik Kone', 'Write the payment retry runbook', 55],
        [TeamActivityKind::PokerStarted, 'Inès Benali', 'Sprint 43 refinement', 70],
        [TeamActivityKind::WhiteboardCreated, 'Camille Roux', 'Checkout journey map', 130],
        [TeamActivityKind::RetroStarted, 'Inès Benali', 'Q3 release post-mortem', 190],
        [TeamActivityKind::SurveyPublished, 'Camille Roux', 'Team pulse — September', 60 * 26],
        [TeamActivityKind::MemberJoined, 'Sofia Lindqvist', null, 60 * 30],
        [TeamActivityKind::WhiteboardCreated, 'Théo Martin', 'Payment retries architecture', 60 * 48],
        [TeamActivityKind::RetroCompleted, 'Camille Roux', 'Sprint 41 retro', 60 * 24 * 8],
        [TeamActivityKind::PokerEnded, 'Inès Benali', 'Billing epic sizing', 60 * 24 * 9],
    ];

    foreach ($lines as [$kind, $actor, $subject, $minutesAgo]) {
        TeamActivity::factory()->for($team)->create([
            'kind' => $kind,
            'actor_user_id' => $people[$actor]->id,
            'subject_title' => $subject,
            'created_at' => now()->subMinutes($minutesAgo),
        ]);
    }

    $this->captureVisuals('team-page-data', route('teams.show', [$workspace, $team], false), fn (string $path, array $options) => visualSignIn($owner, $path, $options)
        ->assertPresent('[data-slot="team-header"] [data-slot="team-schedule"]')
        ->assertCount('#recent-sessions [data-slot="session-row"]', 5)
        ->assertPresent('[data-slot="open-actions-overdue"]')
        ->assertCount('[data-test="activity-line"]', 5)
        ->assertNotPresent('[data-slot="team-trend-loading"]')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0));
});

it('renders the General tab of the team settings of an owner without overflow', function () {
    ['workspace' => $workspace, 'team' => $team, 'people' => $people] = teamWorkspaceDataVisualAtlas([42]);

    $this->captureVisuals('team-settings-general', route('teams.settings.show', [$workspace, $team], false), fn (string $path, array $options) => visualSignIn($people['Camille Roux'], $path, $options)
        ->assertPresent('[data-slot="team-settings-shell"]')
        ->assertPresent('[data-slot="team-settings-facts"]'));
});

it('renders Members, Sprints and Retrospectives of an owner, the viewer online, without overflow', function () {
    ['workspace' => $workspace, 'team' => $team, 'people' => $people] = teamWorkspaceDataVisualAtlas([40, 41, 42]);
    $owner = $people['Camille Roux'];

    teamWorkspaceDataVisualTeamTemplate($team, $owner);
    $retro = teamWorkspaceDataVisualRetro($team, '0199a230-0000-7000-8000-000000000211', 'Sprint 41 retro', RetroPhase::Completed, $people['Théo Martin'], [$people['Inès Benali'], $people['Malik Kone']], now()->subDays(9));
    Retro::withoutTimestamps(fn (): bool => $retro->forceFill(['template' => 'workspace', 'workspace_template_id' => '0199a230-0000-7000-8000-000000000301'])->save());
    Participant::query()->where('retro_id', $retro->id)->where('user_id', $people['Malik Kone']->id)->update(['updated_at' => now()->subDays(3)]);
    $previousRetro = teamWorkspaceDataVisualRetro($team, '0199a230-0000-7000-8000-000000000212', 'Sprint 40 retro', RetroPhase::Completed, $people['Sofia Lindqvist'], [], now()->subDays(23));
    Retro::withoutTimestamps(fn (): bool => $previousRetro->forceFill(['template' => 'start_stop_continue'])->save());
    PokerGame::factory()->for($team)->create(['title' => 'Sprint 42 refinement'])
        ->players()->create(['user_id' => $people['Inès Benali']->id, 'name' => 'Inès Benali', 'updated_at' => now()->subHours(5)]);

    $this->captureVisuals('team-settings-members', route('teams.members.index', [$workspace, $team], false), fn (string $path, array $options) => visualSignIn($owner, $path, $options)
        ->assertCount('[data-test="team-members"] [data-test="member-last-activity"]', 6)
        ->assertPresent('[data-test="member-last-activity"][data-online="true"]')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0));

    $this->captureVisuals('team-settings-sprints', route('teams.sprints.index', [$workspace, $team], false), fn (string $path, array $options) => visualSignIn($owner, $path, $options)
        ->assertCount('[data-test="team-sprints"] [data-sprint-id]', 3)
        ->assertPresent('[data-test="current-sprint"]'));

    $this->captureVisuals('team-settings-retros', route('teams.retroSettings.show', [$workspace, $team], false), fn (string $path, array $options) => visualSignIn($owner, $path, $options)
        ->assertCount('[data-slot="facilitator-chip"]', 2)
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0));
});

it('renders the Sprints card with the next sprint planned and the edit dialog open without overflow', function () {
    ['workspace' => $workspace, 'team' => $team, 'people' => $people] = teamWorkspaceDataVisualAtlas([41, 42, 43]);
    $planned = $team->sprints()->where('number', 43)->value('id');

    $this->captureVisuals('team-settings-sprints-planned', route('teams.sprints.index', [$workspace, $team], false), fn (string $path, array $options) => visualSignIn($people['Camille Roux'], $path, $options)
        ->assertPresent('#sprints button[disabled]')
        ->click("[data-sprint-id=\"{$planned}\"] button[aria-haspopup=\"menu\"]")
        ->click('[role="menuitem"]:first-child')
        ->assertValue('[role="dialog"] input[name="number"]', '43'));
});

it('renders Data & export with two closed surveys without overflow', function () {
    ['workspace' => $workspace, 'team' => $team, 'people' => $people] = teamWorkspaceDataVisualAtlas([42]);
    $owner = $people['Camille Roux'];

    TeamSurvey::factory()->for($team)->closed()->withoutThreshold()->create(['title' => 'Team pulse — September', 'created_by_user_id' => $owner->id, 'closed_at' => now()->subDays(4)]);
    TeamSurvey::factory()->for($team)->closed()->withoutThreshold()->create(['title' => 'Onboarding feedback', 'created_by_user_id' => $owner->id, 'closed_at' => now()->subDays(30)]);

    $this->captureVisuals('team-settings-data', route('teams.data.show', [$workspace, $team], false), fn (string $path, array $options) => visualSignIn($owner, $path, $options)
        ->assertCount('[data-test="survey-export"]', 2)
        ->assertPresent('[data-test="action-items-link"]'));
});

/**
 * The workspace page: Atlas with a live retro in sprint 42, Borealis with boards
 * edited today, Comet with neither; each team has a description.
 *
 * @return array{
 *     workspace: Workspace,
 *     admin: User
 * }
 */
function teamWorkspaceDataVisualWorkspaceWithTeams(): array
{
    ['workspace' => $workspace, 'team' => $atlas, 'people' => $people] = teamWorkspaceDataVisualAtlas([41, 42]);
    $admin = User::factory()->create([
        'id' => '0199a230-0000-7000-8000-000000000150',
        'name' => 'Arnaud Ritti',
        'email' => 'arnaud@example.com',
    ]);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);
    $atlas->members()->attach($admin);

    teamWorkspaceDataVisualRetro($atlas, '0199a230-0000-7000-8000-000000000221', 'Sprint 42 retro', RetroPhase::Writing, $people['Théo Martin'], [$people['Malik Kone']], now()->subMinutes(30));
    ActionItem::factory()->withoutRetro($atlas, $admin)->count(4)->create();
    ActionItem::factory()->withoutRetro($atlas, $admin)->overdue()->create();

    $borealis = Team::factory()->for($workspace)->create([
        'id' => '0199a230-0000-7000-8000-000000000002',
        'name' => 'Borealis',
        'description' => 'Mobile apps, iOS and Android',
    ]);
    $comet = Team::factory()->for($workspace)->create([
        'id' => '0199a230-0000-7000-8000-000000000003',
        'name' => 'Comet',
        'description' => 'Data platform and reporting',
    ]);

    foreach (['Bao Lin', 'Hugo Petit', 'Yuki Tanaka', 'Lea Garnier'] as $index => $name) {
        $user = User::factory()->create([
            'id' => sprintf('0199a230-0000-7000-8000-0000000001%02d', 60 + $index),
            'name' => $name,
            'email' => str($name)->slug('.').'@nordlys.example',
        ]);
        $workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
        ($index < 3 ? $borealis : $comet)->members()->attach($user);
    }

    $bao = User::query()->where('name', 'Bao Lin')->sole();
    Whiteboard::factory()->for($borealis)->count(2)->create(['updated_at' => now()->subMinutes(15)]);
    Retro::factory()->for($borealis)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subDays(3)]);
    ActionItem::factory()->withoutRetro($borealis, $bao)->count(2)->create();
    Retro::factory()->for($comet)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subDays(14)]);

    return ['workspace' => $workspace, 'admin' => $admin];
}

it('renders the workspace page with its description and the team tiles without overflow', function () {
    ['workspace' => $workspace, 'admin' => $admin] = teamWorkspaceDataVisualWorkspaceWithTeams();

    $this->captureVisuals('workspace-page-descriptions', route('workspaces.show', $workspace, false), fn (string $path, array $options) => visualSignIn($admin, $path, $options)
        ->assertPresent('[data-slot="workspace-description"]')
        ->assertCount('a[data-slot="team-tile"]', 3)
        ->assertCount('[data-slot="team-description"]', 3)
        ->assertPresent('[data-slot="team-whiteboards"]')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0));
});

it('renders the workspace dialog of an admin, name and description, without overflow', function () {
    ['workspace' => $workspace, 'admin' => $admin] = teamWorkspaceDataVisualWorkspaceWithTeams();

    $this->captureVisuals('workspace-details-dialog', route('workspaces.show', $workspace, false), fn (string $path, array $options) => visualSignIn($admin, $path, $options)
        ->click('[data-slot="workspace-header"] h1 + button')
        ->assertPresent('[role="dialog"] textarea'));
});

it('renders the templates page with a personal, a team and a workspace template without overflow', function () {
    ['workspace' => $workspace, 'team' => $team, 'people' => $people] = teamWorkspaceDataVisualAtlas([42]);
    $owner = $people['Camille Roux'];

    teamWorkspaceDataVisualTeamTemplate($team, $people['Théo Martin']);

    $others = [
        ['0199a230-0000-7000-8000-000000000302', 'My sailboat', TemplateVisibility::Personal, null, $owner, [['Wind', ColumnColor::Moss], ['Anchors', ColumnColor::Coral], ['Rocks', ColumnColor::Iris], ['Island', ColumnColor::Sun]]],
        ['0199a230-0000-7000-8000-000000000303', 'Start / Stop / Continue', TemplateVisibility::Workspace, null, $owner, [['Start', ColumnColor::Moss], ['Stop', ColumnColor::Coral], ['Continue', ColumnColor::Sky]]],
    ];

    foreach ($others as [$id, $name, $visibility, $teamId, $author, $columns]) {
        $template = WorkspaceTemplate::factory()->for($workspace)->create([
            'id' => $id,
            'name' => $name,
            'visibility' => $visibility,
            'team_id' => $teamId,
            'created_by_user_id' => $author->id,
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
    }

    $this->captureVisuals('workspace-templates-visibility', route('workspaces.templates.index', $workspace, false), fn (string $path, array $options) => visualSignIn($owner, $path, $options)
        ->assertCount('[data-slot="template-card"] [data-test="template-visibility"]', 3)
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0));
});

it('renders the template editor of a facilitator of two teams, Team chosen, team select open, without overflow', function () {
    ['workspace' => $workspace, 'people' => $people] = teamWorkspaceDataVisualAtlas([42]);
    $facilitator = $people['Théo Martin'];
    $borealis = Team::factory()->for($workspace)->create([
        'id' => '0199a230-0000-7000-8000-000000000002',
        'name' => 'Borealis',
    ]);
    $borealis->members()->attach($facilitator, ['role' => TeamRole::Facilitator->value]);

    $this->captureVisuals('template-editor-visibility', route('workspaces.templates.index', $workspace, false), fn (string $path, array $options, int $width) => visualSignIn($facilitator, $path, $options)
        ->resize($width, 900)
        ->click('[data-slot="workspace-templates-page"] header button')
        ->assertPresent('[role="dialog"] [data-slot="template-editor"]')
        ->click('[role="dialog"] [role="radiogroup"] [role="radio"]:nth-child(2)')
        ->click('#template-team')
        ->assertCount('[role="listbox"] [role="option"]', 2));
});

it('renders a retro in Voting seen by an observer without overflow', function () {
    ['team' => $team, 'people' => $people] = teamWorkspaceDataVisualAtlas([42]);
    $observer = $people['Noa Kim'];
    $retro = teamWorkspaceDataVisualRetro($team, '0199a230-0000-7000-8000-000000000231', 'Sprint 42 retro', RetroPhase::Voting, $people['Théo Martin'], [$people['Malik Kone'], $observer], now()->subMinutes(30));

    $this->captureVisuals('retro-observer', "/retros/{$retro->id}", fn (string $path, array $options) => visualSignIn($observer, $path, $options)
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->assertPresent('[data-slot="observer-notice"]')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0));
});

it('renders the board menu of a team facilitator on "Take control" of a retro in Writing without overflow', function () {
    ['team' => $team, 'people' => $people] = teamWorkspaceDataVisualAtlas([42]);
    $facilitator = $people['Inès Benali'];
    $retro = teamWorkspaceDataVisualRetro($team, '0199a230-0000-7000-8000-000000000241', 'Sprint 42 retro', RetroPhase::Writing, $people['Théo Martin'], [$facilitator, $people['Malik Kone']], now()->subMinutes(30));

    $this->captureVisuals('retro-take-control', "/retros/{$retro->id}", fn (string $path, array $options) => visualSignIn($facilitator, $path, $options)
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->click('header button[aria-haspopup="menu"][aria-label]:not([data-sidebar])')
        ->assertPresent('[role="menu"] [role="menuitem"] svg.lucide-crown'));
});

it('renders the retro form of the "New session" dialog with the suggested facilitator open without overflow', function () {
    ['workspace' => $workspace, 'team' => $team, 'people' => $people] = teamWorkspaceDataVisualAtlas([41, 42]);

    teamWorkspaceDataVisualTeamTemplate($team, $people['Camille Roux']);

    $this->captureVisuals('new-retro-facilitator', route('teams.show', [$workspace, $team, 'new' => 'retro'], false), fn (string $path, array $options, int $width) => visualSignIn($people['Camille Roux'], $path, $options)
        ->resize($width, 900)
        ->assertNotPresent('[data-slot="team-trend-loading"]')
        ->assertNotPresent('[data-slot="poker-presence-loading"]')
        ->assertPresent('[role="dialog"] #new-retro-facilitator')
        ->click('#new-retro-facilitator')
        ->assertPresent('[role="listbox"] [role="option"]')
        ->assertAttribute('#new-retro-facilitator', 'aria-expanded', 'true'), fullPage: false);
});
