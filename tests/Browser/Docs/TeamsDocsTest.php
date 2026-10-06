<?php

use App\Enums\ColumnColor;
use App\Enums\RetroPhase;
use App\Enums\TeamActivityKind;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\TeamActivity;
use App\Models\TeamInviteLink;
use App\Models\TeamSurvey;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WorkspaceInvitation;
use App\Notifications\TeamAccessRequestedNotification;
use Carbon\CarbonInterface;
use Database\Factories\PokerTaskFactory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Tests\Browser\Support\DocsWorld;

const DocsTeamsInstanceAddress = 'https://skrum.nordlys.example';

function docsTeamsWorld(): DocsWorld
{
    $world = DocsWorld::create();

    $world->team->update(['color' => ColumnColor::Coral]);

    return $world;
}

function docsTeamsRetro(DocsWorld $world, string $title, string $template, RetroPhase $phase, CarbonInterface $at, int $cards): Retro
{
    $retro = Retro::factory()->for($world->team)->inPhase($phase)->create([
        'title' => $title,
        'template' => $template,
        'started_at' => $at,
        'completed_at' => $phase === RetroPhase::Completed ? $at : null,
        'created_at' => $at,
        'updated_at' => $at,
    ]);

    $facilitator = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $world->person('Théo')->id]);

    Card::factory()->count($cards)->create([
        'retro_id' => $retro->id,
        'column_id' => Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Notes'])->id,
        'participant_id' => $facilitator->id,
        'content' => 'A note written during the session',
    ]);

    Retro::query()->whereKey($retro->id)->update(['facilitator_participant_id' => $facilitator->id, 'updated_at' => $at]);

    return $retro->refresh();
}

/**
 * @param  array<int, int>  $rotiScores
 * @param  array<int, int>  $healthScores
 */
function docsTeamsClosedRetro(DocsWorld $world, string $title, string $template, CarbonInterface $at, int $cards, array $rotiScores, array $healthScores): Retro
{
    $retro = docsTeamsRetro($world, $title, $template, RetroPhase::Completed, $at, $cards);

    foreach ($rotiScores as $score) {
        RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => $score]);
    }

    attachHealthCheck($retro);

    foreach ($healthScores as $score) {
        answerHealthCheck($retro, Participant::factory()->create(['retro_id' => $retro->id]), ['vision' => $score]);
    }

    closeHealthCheck($retro);

    Retro::query()->whereKey($retro->id)->update(['updated_at' => $at]);

    return $retro;
}

/**
 * @param  array<int, string>  $tasks
 */
function docsTeamsPokerGame(DocsWorld $world, string $title, CarbonInterface $at, array $tasks, bool $ended): void
{
    $game = PokerGame::factory()->for($world->team)->create(['title' => $title, 'created_at' => $at, 'updated_at' => $at]);

    foreach ($tasks as $task) {
        PokerTask::factory()
            ->when($ended, fn (PokerTaskFactory $factory): PokerTaskFactory => $factory->estimated('5'))
            ->create(['poker_game_id' => $game->id, 'title' => $task]);
    }

    PokerGame::query()->whereKey($game->id)->update(['ended_at' => $ended ? $at : null, 'updated_at' => $at]);
}

function docsTeamsActivityLine(DocsWorld $world, TeamActivityKind $kind, string $firstName, ?string $title, CarbonInterface $at): void
{
    TeamActivity::factory()->create([
        'team_id' => $world->team->id,
        'kind' => $kind,
        'actor_user_id' => $world->person($firstName)->id,
        'subject_title' => $title,
        'created_at' => $at,
    ]);
}

function docsTeamsBusyTeam(DocsWorld $world): void
{
    $week = now()->startOfWeek();

    docsTeamsClosedRetro($world, 'Sprint 41 retrospective', 'start_stop_continue', $week->copy()->subDays(23), 11, [3, 4, 4, 3], [3, 3, 4]);
    $postMortem = docsTeamsClosedRetro($world, 'Checkout launch post-mortem', 'mad_sad_glad', $week->copy()->subDays(16), 9, [4, 3, 4, 4], [4, 3, 4]);
    $lastRetro = docsTeamsClosedRetro($world, 'Sprint 42 retrospective', 'four_ls', $week->copy()->subDays(9), 14, [4, 4, 5, 4], [4, 4, 4]);
    docsTeamsRetro($world, 'Sprint 43 retrospective', 'sailboat', RetroPhase::Writing, now(), 6);

    Card::query()->where('retro_id', $postMortem->id)->firstOrFail()->update(['content' => 'The checkout page went down twice during the launch']);

    docsTeamsPokerGame($world, 'Checkout API estimation', $week->copy()->subDays(12), ['Create a payment intent', 'Refund a payment', 'List the saved cards'], true);
    docsTeamsPokerGame($world, 'Sprint 44 refinement', now()->subDay(), ['Retry a failed payment', 'Export the invoices', 'Show the delivery date', 'Archive old carts'], false);

    $enps = closedEnps($world->team, [9, 10, 8, 9, 7, 10, 6, 9, 9], $week->copy()->subDays(20));
    TeamSurvey::query()->whereKey($enps->id)->update([
        'title' => 'eNPS, third quarter',
        'created_at' => $week->copy()->subDays(24),
        'updated_at' => $week->copy()->subDays(20),
    ]);

    $board = Whiteboard::factory()->for($world->team)->create(['title' => 'Checkout flow mapping', 'created_at' => now()->subDays(2)]);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id]);
    Whiteboard::query()->whereKey($board->id)->update(['updated_at' => now()->subDays(2)]);

    $actionItem = fn (string $content, string $firstName, CarbonInterface $dueOn): ActionItem => ActionItem::factory()
        ->assignedTo($world->person($firstName))
        ->create([
            'retro_id' => $lastRetro->id,
            'created_by_participant_id' => $lastRetro->facilitator_participant_id,
            'content' => $content,
            'due_on' => $dueOn->toDateString(),
        ]);

    $actionItem('Fix the flaky checkout tests', 'Malik', ActionItem::today()->subDays(2));
    $actionItem('Share the on-call handbook with new joiners', 'Inès', ActionItem::today()->addDays(3));
    $actionItem('Try a 45-minute time box for refinement', 'Théo', ActionItem::today()->addDays(8));

    docsTeamsActivityLine($world, TeamActivityKind::RetroCompleted, 'Théo', 'Sprint 42 retrospective', $week->copy()->subDays(9));
    docsTeamsActivityLine($world, TeamActivityKind::ActionItemCompleted, 'Malik', 'Add a rollback step to the release checklist', now()->subDays(4));
    docsTeamsActivityLine($world, TeamActivityKind::MemberJoined, 'Lucas', null, now()->subDays(3));
    docsTeamsActivityLine($world, TeamActivityKind::WhiteboardCreated, 'Inès', 'Checkout flow mapping', now()->subDays(2));
    docsTeamsActivityLine($world, TeamActivityKind::RetroStarted, 'Théo', 'Sprint 43 retrospective', now()->subHours(2));
}

/**
 * @param  array<string, int>  $daysAgo
 */
function docsTeamsLastSeen(DocsWorld $world, array $daysAgo): void
{
    $retro = docsTeamsRetro($world, 'Sprint 42 retrospective', 'four_ls', RetroPhase::Completed, now()->startOfWeek()->subDays(9), 12);

    foreach ($daysAgo as $firstName => $days) {
        $person = $world->person($firstName);
        $participant = Participant::query()->where('retro_id', $retro->id)->where('user_id', $person->id)->first()
            ?? Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $person->id]);

        Participant::query()->whereKey($participant->id)->update(['updated_at' => now()->subDays($days)]);
    }
}

function docsTeamsPendingInvitation(DocsWorld $world, string $email, TeamRole $role, string $token): WorkspaceInvitation
{
    return WorkspaceInvitation::factory()->forTeam($world->team, $role)->withToken($token)->create([
        'email' => $email,
        'invited_by_id' => $world->person('Camille')->id,
        'created_at' => now()->subDays(2),
    ]);
}

function docsTeamsBorealis(DocsWorld $world): Team
{
    $team = Team::factory()->for($world->workspace)->create(['name' => 'Borealis', 'slug' => 'borealis']);

    $team->members()->attach($world->person('Sofia'), ['role' => TeamRole::Owner->value]);
    $team->members()->attach($world->person('Lucas'), ['role' => TeamRole::Member->value]);

    return $team;
}

it('shows the members of the Nordlys workspace with their roles and two invitations', function () {
    $world = docsTeamsWorld();
    $camille = $world->person('Camille');

    $world->workspace->members()->updateExistingPivot($camille->id, ['role' => WorkspaceRole::Owner->value]);
    $world->workspace->members()->updateExistingPivot($world->person('Théo')->id, ['role' => WorkspaceRole::Admin->value]);

    docsTeamsPendingInvitation($world, 'nadia@nordlys.example', TeamRole::Member, 'docs-teams-workspace-invitation');
    WorkspaceInvitation::factory()->for($world->workspace)->expired()->create([
        'email' => 'jonas@nordlys.example',
        'invited_by_id' => $camille->id,
        'created_at' => now()->subDays(12),
    ]);

    $page = $this->docsVisit($camille, route('workspaces.members.index', $world->workspace, false))
        ->assertCount('[data-slot="workspace-members"] [data-slot="member-row"]', 8)
        ->assertCount('[data-slot="workspace-members"] [data-slot="invitation-row"]', 2)
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    $this->docShot($page, 'teams/workspace-members', '[data-slot="workspace-members"]');
});

it('shows the search palette with the sessions, the action item and the card that hold the word typed', function () {
    $world = docsTeamsWorld();
    docsTeamsBusyTeam($world);

    $retro = Retro::query()->where('title', 'Checkout launch post-mortem')->sole();

    $page = $this->docsVisit($world->person('Camille'), route('teams.show', [$world->workspace, $world->team], false))
        ->assertPresent('[data-slot="team-page"]')
        ->click('@command-menu-button')
        ->fill('[data-slot="command-input"]', 'checkout')
        ->assertPresent("[data-slot=\"command-group\"] [data-slot=\"command-item\"][data-value=\"retro-{$retro->id}\"]")
        ->assertSeeIn('[role="dialog"]', 'Fix the flaky checkout tests')
        ->assertSeeIn('[role="dialog"]', 'The checkout page went down twice during the launch');

    $this->docShot($page, 'teams/search', '[role="dialog"]');
});

it('shows the dialog that creates a team from the workspace page', function () {
    $world = docsTeamsWorld();

    $page = $this->docsVisit($world->person('Camille'), route('workspaces.show', $world->workspace, false))
        ->assertPresent('[data-slot="workspace-overview"] a[data-slot="team-tile"]')
        ->click('[data-slot="workspace-header"] button:has-text("New team")')
        ->assertSeeIn('[role="dialog"]', 'New team name')
        ->fill('[role="dialog"] input[name="name"]', 'Borealis');

    $this->docShot($page, 'teams/team-create', '[role="dialog"]');
});

it('shows the Atlas team page with a session in progress, its open actions, its pulse and its activity', function () {
    $world = docsTeamsWorld();
    docsTeamsBusyTeam($world);

    $page = $this->docsVisit($world->person('Camille'), route('teams.show', [$world->workspace, $world->team], false))
        ->resize(1440, 1400)
        ->assertPresent('[data-slot="team-page"] [data-slot="live-session-banner"]')
        ->assertCount('#recent-sessions [data-slot="session-row"]', 5)
        ->assertPresent('#open-actions')
        ->assertPresent('#activity')
        ->assertNotPresent('[data-slot="team-trend-loading"]')
        ->assertPresent('[data-slot="team-pulse"] [data-slot="team-pulse-roti"]')
        ->assertPresent('[data-slot="team-pulse"] [data-slot="team-pulse-health"]')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    $this->docShot($page, 'teams/team-page', '[data-slot="team-page"]');
});

it('shows the members of the Atlas team to its owner, then the list of roles open on one of them', function () {
    $world = docsTeamsWorld();

    docsTeamsPendingInvitation($world, 'nadia@nordlys.example', TeamRole::Member, 'docs-teams-team-invitation');
    docsTeamsLastSeen($world, ['Inès' => 1, 'Lucas' => 3, 'Malik' => 1, 'Noa' => 6, 'Sofia' => 2, 'Théo' => 1, 'Yuki' => 9]);

    $page = $this->docsVisit($world->person('Camille'), route('teams.members.index', [$world->workspace, $world->team], false))
        ->assertCount('[data-slot="members-page"] [data-test="team-members"] tbody tr', 9)
        ->assertSeeIn('[data-slot="members-page"]', 'nadia@nordlys.example')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    $this->docShot($page, 'teams/team-members', '[data-slot="members-page"]');

    $page->click('[aria-label="Role of Malik Kone"]')
        ->assertPresent('[role="listbox"] [role="option"]:has-text("Facilitator")');

    $this->docShot($page, 'teams/role-menu', '[data-slot="members-page"] [data-test="team-members"]');
});

it('shows the page that refuses a team to a member of the workspace and lets them ask for access', function () {
    $world = docsTeamsWorld();
    $borealis = docsTeamsBorealis($world);

    $page = $this->docsVisit($world->person('Noa'), route('teams.show', [$world->workspace, $borealis], false))
        ->assertPresent('[data-slot="error-page"][data-status="403"] [data-slot="access-request"]')
        ->fill('[data-slot="access-request"] input[name="message"]', 'I am joining the mobile project next sprint.');

    $page->script('() => document.activeElement.blur()');

    $this->docShot($page, 'teams/access-request', '[data-slot="error-page"] main');
});

it('shows an access request in the bell of who may answer it', function () {
    $world = docsTeamsWorld();
    $borealis = docsTeamsBorealis($world);
    $camille = $world->person('Camille');

    $request = TeamAccessRequest::factory()->create([
        'team_id' => $borealis->id,
        'user_id' => $world->person('Noa')->id,
        'message' => 'I am joining the mobile project next sprint.',
    ]);

    $camille->notify(new TeamAccessRequestedNotification($request->id));
    DB::table('notifications')->where('notifiable_id', $camille->id)->update(['created_at' => now()->subHours(2)]);

    $page = $this->docsVisit($camille, route('teams.show', [$world->workspace, $world->team], false))
        ->assertPresent('[data-slot="team-page"]')
        ->click('[aria-label="Notifications, 1 unread"]')
        ->assertSeeIn('[data-slot="notifications-panel"]', 'Noa Kim asks to join Borealis')
        ->assertSeeIn('[data-slot="notifications-panel"]', 'Add to the team');

    $this->docShot($page, 'teams/access-request-answer', '[data-slot="notifications-panel"]');
});

it('shows the dialog that invites two people to Atlas by e-mail', function () {
    $world = docsTeamsWorld();
    $chips = '[role="dialog"] [data-slot="email-chips-field"] input';

    $page = $this->docsVisit($world->person('Camille'), route('teams.members.index', [$world->workspace, $world->team], false))
        ->click('[data-slot="members-page"] button:has(span:text-is("Invite"))')
        ->assertSeeIn('[role="dialog"]', 'Invite to Atlas')
        ->fill($chips, 'nadia@nordlys.example leo@nordlys.example')
        ->keys($chips, 'Enter')
        ->fill('[role="dialog"] textarea', 'Welcome to Atlas. Our next retrospective is on Thursday.')
        ->assertSeeIn('[role="dialog"]', 'Send 2 invitations')
        ->assertSeeIn('[role="dialog"] [data-slot="invite-link-block"]', 'Create a link');

    $page->script('() => document.activeElement.blur()');

    $this->docShot($page, 'teams/invite-dialog', '[role="dialog"]');
});

it('shows the invite link of Atlas with its expiry and how many people joined through it', function () {
    $world = docsTeamsWorld();

    TeamInviteLink::factory()->for($world->team)->withToken('docs-teams-atlas-invite-link')->joinedBy(3)->create([
        'created_by_id' => $world->person('Camille')->id,
    ]);

    $page = $this->docsVisit($world->person('Camille'), route('teams.members.index', [$world->workspace, $world->team], false))
        ->assertPresent('[data-slot="members-page"]');

    URL::forceRootUrl(DocsTeamsInstanceAddress);

    $page->click('[data-slot="members-page"] button:has-text("Invitation link")')
        ->assertSeeIn('[role="dialog"] [data-slot="invite-link-block"]', '/invite/docs-teams-atlas-invite-link')
        ->assertSeeIn('[role="dialog"] [data-slot="invite-link-block"]', '3 joined');

    $this->docShot($page, 'teams/invite-link', '[role="dialog"] [data-slot="invite-link-block"]');
});

it('shows the invitation to Atlas as the invited person sees it before signing in', function () {
    $world = docsTeamsWorld();

    WorkspaceInvitation::factory()
        ->forTeam($world->team, TeamRole::Member)
        ->withToken('docs-teams-invitation-page')
        ->withMessage('Welcome to Atlas. Our next retrospective is on Thursday.')
        ->create(['email' => 'nadia@nordlys.example', 'invited_by_id' => $world->person('Camille')->id]);

    $page = $this->docsOpen(route('invitations.show', 'docs-teams-invitation-page', false))
        ->assertSeeIn('[data-slot="invitation-card"]', 'Camille Roux invited you to join the Atlas team in the Nordlys workspace')
        ->assertPresent('[data-slot="invitation-card"] [data-slot="invitation-decline"]');

    $this->docShot($page, 'teams/invitation-page', '[data-slot="invitation-card"]');
});

it('shows the general settings of the Atlas team with its link and the card that deletes it', function () {
    $world = docsTeamsWorld();

    Team::query()->whereKey($world->team->id)->update([
        'description' => 'Payments and checkout',
        'created_at' => '2025-03-10 09:00:00',
    ]);

    $page = $this->docsVisit($world->person('Camille'), route('teams.show', [$world->workspace, $world->team], false))
        ->assertPresent('[data-slot="team-page"]');

    URL::forceRootUrl(DocsTeamsInstanceAddress);

    $page->click('[data-sidebar="sidebar"] a:has-text("Settings")')
        ->assertSeeIn('[data-slot="team-settings-shell"]', 'skrum.nordlys.example/t/')
        ->assertPresent('[data-slot="team-settings-shell"] [data-slot="team-settings"]');

    $this->docShot($page, 'teams/team-settings', '[data-slot="team-settings-shell"]');
});

it('shows the sprints of Atlas with the current one, the next start and the retro day', function () {
    $world = docsTeamsWorld();

    Team::query()->whereKey($world->team->id)->update(['sprint_length_weeks' => 2, 'retro_weekday' => 4, 'retro_time' => '14:00']);

    $page = $this->docsVisit($world->person('Camille'), route('teams.sprints.index', [$world->workspace, $world->team], false))
        ->assertCount('#sprints [data-test="team-sprints"] tbody tr', 3)
        ->assertSeeIn('#sprints [data-test="current-sprint"]', 'Sprint 43')
        ->assertPresent('#sprints [data-test="next-retro-preview"]');

    $this->docShot($page, 'teams/sprints', '#sprints');
});
