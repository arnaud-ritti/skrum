<?php

use App\Enums\ColumnColor;
use App\Enums\OnboardingStep;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Onboarding;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamInviteLink;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Support\InstanceSettings;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

const InvitationsOnboardingLinkToken = 'theInviteLinkTokenForTheWalkthroughs0001';

const InvitationsOnboardingExpiredLinkToken = 'theExpiredLinkTokenForTheWalkthroughs001';

const InvitationsOnboardingPassword = 'a-long-enough-password-42';

beforeEach(function () {
    RateLimiter::for('login', fn (): Limit => Limit::none());
});

/**
 * Nordlys and its team Atlas (sky, slug atlas): Camille owns both, Théo facilitates the team, Malik is a member.
 *
 * @return array{
 *     workspace: Workspace,
 *     team: Team,
 *     owner: User,
 *     facilitator: User,
 *     member: User
 * }
 */
function invitationsOnboardingAtlas(): array
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas', 'slug' => 'atlas', 'color' => ColumnColor::Sky]);

    $owner = User::factory()->create(['name' => 'Camille Roux', 'email' => 'camille@nordlys.example', 'locale' => 'en']);
    $facilitator = User::factory()->create(['name' => 'Théo Martin', 'email' => 'theo@nordlys.example', 'locale' => 'en']);
    $member = User::factory()->create(['name' => 'Malik Kone', 'email' => 'malik@nordlys.example', 'locale' => 'en']);

    $workspace->members()->attach($owner, ['role' => WorkspaceRole::Owner->value]);
    $workspace->members()->attach($facilitator, ['role' => WorkspaceRole::Member->value]);
    $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);
    $team->members()->attach($facilitator, ['role' => TeamRole::Facilitator->value]);
    $team->members()->attach($member, ['role' => TeamRole::Member->value]);

    return ['workspace' => $workspace, 'team' => $team, 'owner' => $owner, 'facilitator' => $facilitator, 'member' => $member];
}

/**
 * A newcomer whose onboarding is at $step: from the team step on, Nordlys exists and is theirs, and from the invitation step on, Atlas too.
 *
 * @return array{
 *     user: User,
 *     onboarding: Onboarding
 * }
 */
function invitationsOnboardingNewcomer(OnboardingStep $step, string $teamName = 'Atlas'): array
{
    User::factory()->create();

    $user = User::factory()->create(['name' => 'Sofia Laurent', 'email' => 'sofia@nordlys.example', 'locale' => 'en']);

    if ($step === OnboardingStep::Workspace) {
        return ['user' => $user, 'onboarding' => Onboarding::factory()->for($user)->create(['team_name' => $teamName])];
    }

    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Owner)->create(['name' => 'Nordlys', 'locale' => 'en']);

    if ($step === OnboardingStep::Team) {
        return ['user' => $user, 'onboarding' => Onboarding::factory()->for($user)->atStep($step)->create([
            'workspace_id' => $workspace->id,
            'team_name' => $teamName,
        ])];
    }

    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas', 'slug' => 'atlas', 'color' => ColumnColor::Sky]);
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);

    return ['user' => $user, 'onboarding' => Onboarding::factory()->for($user)->atStep($step)->create([
        'workspace_id' => $workspace->id,
        'team_id' => $team->id,
    ])];
}

it('registers a newcomer on "Create your workspace" with a team name, then opens the onboarding at step 1 once the address is verified', function () {
    config(['skrum.signup_mode' => 'open', 'skrum.passwords.breach_check' => false]);
    User::factory()->create();

    $page = browserVisit('/register');

    $page->assertSee('Create your workspace')
        ->assertPresent('[data-slot="register-form"] #team_name')
        ->fill('#name', 'Sofia Laurent')
        ->fill('#team_name', 'Atlas')
        ->fill('#email', 'sofia@nordlys.example')
        ->fill('#password', InvitationsOnboardingPassword)
        ->fill('#password_confirmation', InvitationsOnboardingPassword)
        ->click('@register-user-button')
        ->assertPathIsNot('/register');

    $sofia = User::query()->where('email', 'sofia@nordlys.example')->sole();

    expect($sofia->onboarding->step)->toBe(OnboardingStep::Workspace)
        ->and($sofia->onboarding->team_name)->toBe('Atlas')
        ->and($sofia->workspaces()->count())->toBe(0);

    $page->navigate('/dashboard')->assertPathIs('/email/verify');

    $sofia->markEmailAsVerified();

    $page->navigate('/dashboard')
        ->assertPathIs('/onboarding')
        ->assertSeeIn('[data-slot="workspace-step"]', 'Step 1 of 4')
        ->assertSeeIn('[data-slot="workspace-step"]', 'Name your workspace')
        ->assertAttribute('[data-slot="phase-step"][data-state="current"] [aria-current="step"]', 'aria-current', 'step')
        ->assertSeeIn('[data-slot="phase-step"][data-state="current"]', 'Workspace');
});

it('walks a newcomer through the four steps: workspace, team prefilled from registration, two invitations, then the icebreaker dialog on the team page', function () {
    ['user' => $sofia, 'onboarding' => $onboarding] = invitationsOnboardingNewcomer(OnboardingStep::Workspace);

    $chips = '[data-slot="team-invite-form"] [data-slot="email-chips-field"] input';

    $page = $this->signIn($sofia, '/onboarding');

    $page->assertPresent('[data-slot="workspace-step"]')
        ->fill('[data-slot="workspace-step"] >> internal:label="Workspace name"s', 'Nordlys')
        ->click('[data-slot="workspace-step"] button:has-text("Continue")')
        ->assertPresent('[data-slot="team-step"]')
        ->assertSeeIn('[data-slot="team-step"]', 'Step 2 of 4')
        ->assertValue('[data-slot="team-step"] >> internal:label="Team name"s', 'Atlas')
        ->assertSeeIn('[data-slot="team-address-slug"]', 'atlas')
        ->assertSeeIn('[data-slot="team-preview-name"]', 'Atlas')
        ->click('[data-slot="team-step"] [role="radio"][data-color="lagoon"]')
        ->assertAttribute('[data-slot="team-step"] [role="radio"][data-color="lagoon"]', 'aria-checked', 'true')
        ->click('[data-slot="team-step"] button:has-text("Continue")')
        ->assertPresent('[data-slot="invite-step"]')
        ->assertSeeIn('[data-slot="invite-step"]', 'Step 3 of 4')
        ->assertSeeIn('[data-slot="invite-link-block"]', 'Expires in 7 days')
        ->fill($chips, 'nadia@nordlys.example theo@nordlys.example')
        ->keys($chips, 'Enter')
        ->assertCount('[data-slot="email-chips-field"] li', 2)
        ->click('Send 2 invitations')
        ->assertPresent('[data-slot="ritual-step"]')
        ->assertSeeIn('[data-slot="ritual-step"]', 'Step 4 of 4')
        ->assertSee('Create the retro')
        ->click('[data-slot="ritual-step"] [role="radio"][value="icebreaker"]')
        ->assertSee('Create the icebreaker')
        ->click('Create the icebreaker')
        ->assertVisible('#new-icebreaker-name');

    $onboarding->refresh();
    $team = $onboarding->team;

    expect($onboarding->isCompleted())->toBeTrue()
        ->and($sofia->roleIn($onboarding->workspace))->toBe(WorkspaceRole::Owner)
        ->and($team->name)->toBe('Atlas')
        ->and($team->slug)->toBe('atlas')
        ->and($team->color)->toBe(ColumnColor::Lagoon)
        ->and($team->roleOf($sofia))->toBe(TeamRole::Owner)
        ->and($team->invitations()->pluck('email')->sort()->values()->all())->toBe(['nadia@nordlys.example', 'theo@nordlys.example'])
        ->and($team->inviteLinks()->count())->toBe(1);

    $page->assertPathIs(teamPath('teams.show', $team))
        ->navigate('/onboarding')
        ->assertPathIsNot('/onboarding');
});

it('keeps what was saved across "Back" and a reload, and shows a team link the workspace already has under its field', function () {
    ['user' => $sofia, 'onboarding' => $onboarding] = invitationsOnboardingNewcomer(OnboardingStep::Team);
    Team::factory()->for($onboarding->workspace)->create(['name' => 'Atlas Mobile', 'slug' => 'atlas']);

    $page = $this->signIn($sofia, '/onboarding');

    $page->assertPresent('[data-slot="team-step"]')
        ->click('Back')
        ->assertPresent('[data-slot="workspace-step"]')
        ->assertValue('[data-slot="workspace-step"] >> internal:label="Workspace name"s', 'Nordlys')
        ->click('[data-slot="workspace-step"] button:has-text("Continue")')
        ->assertPresent('[data-slot="team-step"]')
        ->refresh()
        ->assertPresent('[data-slot="team-step"]')
        ->assertSeeIn('[data-slot="phase-step"][data-state="done"]', 'Workspace')
        ->click('[data-slot="team-address-field"] button')
        ->fill('[data-slot="team-address-field"] input', 'atlas')
        ->click('[data-slot="team-step"] button:has-text("Continue")')
        ->assertSeeIn('[data-slot="team-address-field"] [data-slot="field-error"]', 'This link is already taken in Nordlys.')
        ->assertNotPresent('[data-sonner-toast]')
        ->fill('[data-slot="team-address-field"] input', 'atlas-web')
        ->click('[data-slot="team-step"] button:has-text("Continue")')
        ->assertPresent('[data-slot="invite-step"]')
        ->refresh()
        ->assertPresent('[data-slot="invite-step"]');

    expect(Workspace::query()->where('name', 'Nordlys')->count())->toBe(1)
        ->and($onboarding->fresh()->team->slug)->toBe('atlas-web');
});

it('"Skip for now" at step 2 ends the onboarding without a team and never shows it again', function () {
    ['user' => $sofia, 'onboarding' => $onboarding] = invitationsOnboardingNewcomer(OnboardingStep::Team);
    $workspace = $onboarding->workspace;

    $page = $this->signIn($sofia, '/onboarding');

    $page->assertCount('[data-slot="team-step"] [data-slot="step-actions"] button', 3)
        ->click('Skip for now')
        ->assertPathIs("/w/{$workspace->slug}");

    expect($onboarding->fresh()->isCompleted())->toBeTrue()
        ->and($workspace->teams()->count())->toBe(0);

    $page->navigate('/onboarding')->assertPathIs("/w/{$workspace->slug}");
});

it('opens a new SSO account of the default workspace at step 2, step 1 done and no "Back"', function () {
    config(['skrum.signup_mode' => 'open']);
    User::factory()->create();
    $default = Workspace::factory()->create(['name' => 'Nordlys Commons']);
    resolve(InstanceSettings::class)->set('default_workspace', $default->id);
    $nadia = newSsoAccount('nadia@nordlys.example');
    $nadia->forceFill(['password' => Hash::make('password'), 'locale' => 'en'])->save();

    $page = $this->signIn($nadia, '/dashboard');

    $page->assertPathIs('/onboarding')
        ->assertSeeIn('[data-slot="team-step"]', 'Step 2 of 4')
        ->assertSeeIn('[data-slot="phase-step"][data-state="done"]', 'Workspace')
        ->assertDontSeeIn('[data-slot="team-step"] [data-slot="step-actions"]', 'Back')
        ->assertCount('[data-slot="team-step"] [data-slot="step-actions"] button', 2)
        ->assertSeeIn('[data-slot="team-step"]', 'You can add more teams to Nordlys Commons later.')
        ->fill('[data-slot="team-step"] >> internal:label="Team name"s', 'Orion')
        ->click('[data-slot="team-step"] button:has-text("Continue")')
        ->assertPresent('[data-slot="invite-step"]');

    $team = $nadia->onboarding()->sole()->team;

    expect($team->workspace_id)->toBe($default->id)
        ->and($team->roleOf($nadia))->toBe(TeamRole::Owner)
        ->and($nadia->roleIn($default))->toBe(WorkspaceRole::Member);
});

it('shows "Invite" to a facilitator, who sends invitations and creates, copies and turns off the team link; a member sees no "Invite"', function () {
    ['team' => $team, 'facilitator' => $theo, 'member' => $malik] = invitationsOnboardingAtlas();

    $chips = '[role="dialog"] [data-slot="email-chips-field"] input';

    $page = $this->signIn($theo, teamPath('teams.members.index', $team));

    $page->click('[data-slot="members-page"] button:has(span:text-is("Invite"))')
        ->assertSeeIn('[role="dialog"]', 'Invite to Atlas')
        ->click('[role="dialog"] [data-slot="invite-link-block"] button:has-text("Create a link")')
        ->assertSeeIn('[role="dialog"] [data-slot="invite-link-block"]', 'Expires in 7 days');

    $link = $team->inviteLinks()->sole();

    $page->assertSeeIn('[role="dialog"] [data-slot="invite-link-block"]', '/invite/')
        ->script('() => { navigator.clipboard.writeText = (text) => { window.copiedLink = text; return Promise.resolve(); }; return true; }');

    $page->click('[role="dialog"] [data-slot="invite-link-block"] button:has-text("Copy")')
        ->assertSeeIn('[role="dialog"] [data-slot="invite-link-block"]', 'Copied');

    expect($page->script('() => window.copiedLink'))->toBe($link->url());

    $page->fill($chips, 'nadia@nordlys.example sofia@nordlys.example')
        ->keys($chips, 'Enter')
        ->click('Send 2 invitations')
        ->assertSee('2 invitations sent.')
        ->assertCount('[role="dialog"] [data-slot="email-chips-field"] li', 0)
        ->click('Turn off the link')
        ->click('[role="alertdialog"] button:has-text("Turn off the link")')
        ->assertSeeIn('[role="dialog"] [data-slot="invite-link-block"]', 'Create a link');

    expect($team->invitations()->where('invited_by_id', $theo->id)->count())->toBe(2)
        ->and($link->fresh()->revoked_at)->not->toBeNull();

    $memberPage = $this->signIn($malik, teamPath('teams.members.index', $team));

    $memberPage->assertPresent('[data-slot="members-page"] [data-test="team-members"]')
        ->assertNotPresent('[data-slot="members-page"] button:has-text("Invite")');
});

it('lets a signed-out visitor of the team link sign in, come back, join the team, and be offered the session in progress', function () {
    ['team' => $team, 'owner' => $camille] = invitationsOnboardingAtlas();
    $retro = Retro::factory()->for($team)->started()->create(['title' => 'Sprint 24']);
    $link = TeamInviteLink::factory()->for($team)->withToken(InvitationsOnboardingLinkToken)->create(['created_by_id' => $camille->id]);
    $nadia = User::factory()->create(['name' => 'Nadia Benali', 'email' => 'nadia@elsewhere.example', 'locale' => 'en']);

    $page = browserVisit('/invite/'.InvitationsOnboardingLinkToken);

    $page->assertAttribute('[data-slot="invite-link-card"]', 'data-state', 'logged-out')
        ->assertSee('Atlas')
        ->click('Sign in')
        ->assertPathIs('/login')
        ->fill('#email', $nadia->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIs('/invite/'.InvitationsOnboardingLinkToken)
        ->assertSee('Join Atlas as Nadia Benali?')
        ->assertSeeIn('@join-by-link-button', 'Join Atlas')
        ->click('@join-by-link-button')
        ->assertPathIs(teamPath('teams.show', $team))
        ->assertSeeIn('[data-slot="live-session-banner"]', 'A session is in progress: Sprint 24')
        ->assertPresent('[data-slot="live-session-banner"] a[href$="/retros/'.$retro->id.'"]')
        ->assertNotPresent('[data-slot="live-session-banner"] [aria-label="Dismiss"]')
        ->refresh()
        ->assertSee('Atlas')
        ->assertPresent('[data-slot="live-session-banner"] a[href$="/retros/'.$retro->id.'"]');

    expect($team->roleOf($nadia))->toBe(TeamRole::Member)
        ->and($nadia->roleIn($team->workspace))->toBe(WorkspaceRole::Member)
        ->and($link->fresh()->uses_count)->toBe(1);
});

it('tells the visitor of a link that expired that it no longer works, naming who created it', function () {
    ['team' => $team, 'owner' => $camille] = invitationsOnboardingAtlas();
    TeamInviteLink::factory()->for($team)->expired()->withToken(InvitationsOnboardingExpiredLinkToken)->create(['created_by_id' => $camille->id]);

    $page = browserVisit('/invite/'.InvitationsOnboardingExpiredLinkToken);

    $page->assertSee('This link no longer works.')
        ->assertSee('Ask Camille Roux for a new one.')
        ->assertNotPresent('[data-slot="invite-link-card"]');
});

it('a signed-out invitee reads the team invitation and declines it, and the inviter\'s open bell rings without a reload', function () {
    ['team' => $team, 'owner' => $camille] = invitationsOnboardingAtlas();

    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Facilitator)->withToken('team-invitation')->withMessage('Join us for Thursday\'s retro!')->create([
        'email' => 'nadia@elsewhere.example',
        'invited_by_id' => $camille->id,
    ]);

    $inviterPage = awaitBellSubscription($this->signIn($camille, teamPath('teams.show', $team)));
    $inviterPage->assertPresent('[aria-label="Notifications"]');

    $inviteePage = browserVisit('/invitations/team-invitation');

    $inviteePage->assertSeeIn('[data-slot="invitation-sentence"]', 'Camille Roux invited you to join the Atlas team in the Nordlys workspace')
        ->assertPresent('[data-slot="invitation-team"]')
        ->assertSeeIn('[data-slot="invitation-members"]', '3 members · you join as Facilitator')
        ->assertSeeIn('[data-slot="invitation-message"]', 'Join us for Thursday\'s retro!')
        ->assertSeeIn('@create-invitation-account-button', 'Create my account and join Atlas')
        ->assertSeeIn('[data-slot="invitation-decline"]', 'Camille Roux will be notified. The link stops working.')
        ->click('Decline invitation')
        ->assertSee('Invitation declined')
        ->assertSee('Camille Roux has been notified. You can close this page.')
        ->assertNotPresent('[data-slot="invitation-card"]');

    $inviterPage->assertPresent('[aria-label="Notifications, 1 unread"]')
        ->click('[aria-label="Notifications, 1 unread"]')
        ->assertSee('nadia@elsewhere.example declined your invitation to join Atlas');

    $inviteePage->navigate('/invitations/team-invitation')
        ->assertSee('Invitation declined');
});

it('a signed-in invitee accepts a team invitation, lands on the team page and is offered the session in progress', function () {
    ['team' => $team, 'owner' => $camille] = invitationsOnboardingAtlas();
    $retro = Retro::factory()->for($team)->started()->create(['title' => 'Sprint 24']);
    $nadia = User::factory()->create(['name' => 'Nadia Benali', 'email' => 'nadia@elsewhere.example', 'locale' => 'en']);

    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Observer)->withToken('accept-invitation')->create([
        'email' => $nadia->email,
        'invited_by_id' => $camille->id,
    ]);

    $page = $this->signIn($nadia, '/invitations/accept-invitation');

    $page->assertAttribute('[data-slot="invitation-card"]', 'data-state', 'accept')
        ->assertSee('Join Atlas as Nadia Benali?')
        ->assertSeeIn('@accept-invitation-button', 'Join Atlas')
        ->click('@accept-invitation-button')
        ->assertPathIs(teamPath('teams.show', $team))
        ->assertSeeIn('[data-slot="live-session-banner"]', 'A session is in progress: Sprint 24')
        ->click('[data-slot="live-session-banner"] a')
        ->assertPathIs("/retros/{$retro->id}");

    expect($team->roleOf($nadia))->toBe(TeamRole::Observer)
        ->and($nadia->roleIn($team->workspace))->toBe(WorkspaceRole::Member);
});

it('lets a signed-out invitee create the account on the invitation card, join the team with its role and be offered the session in progress', function () {
    config(['skrum.passwords.breach_check' => false]);
    ['team' => $team, 'owner' => $camille] = invitationsOnboardingAtlas();
    Retro::factory()->for($team)->started()->create(['title' => 'Sprint 24']);

    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Facilitator)->withToken('account-invitation')->create([
        'email' => 'nadia@elsewhere.example',
        'invited_by_id' => $camille->id,
    ]);

    $page = browserVisit('/invitations/account-invitation');

    $page->assertAttribute('[data-slot="invitation-card"]', 'data-state', 'logged-out')
        ->assertValue('#email', 'nadia@elsewhere.example')
        ->fill('#name', 'Nadia Benali')
        ->fill('#password', InvitationsOnboardingPassword)
        ->click('@create-invitation-account-button')
        ->assertPathIs(teamPath('teams.show', $team))
        ->assertSeeIn('[data-slot="live-session-banner"]', 'A session is in progress: Sprint 24');

    $nadia = User::query()->where('email', 'nadia@elsewhere.example')->sole();

    expect($nadia->name)->toBe('Nadia Benali')
        ->and($nadia->hasVerifiedEmail())->toBeTrue()
        ->and($team->roleOf($nadia))->toBe(TeamRole::Facilitator)
        ->and($nadia->roleIn($team->workspace))->toBe(WorkspaceRole::Member)
        ->and($nadia->onboarding)->toBeNull();
});

it('lets a signed-out visitor of a team link register with no team field and no onboarding, then come back to the link page to join', function () {
    config(['skrum.signup_mode' => 'open', 'skrum.passwords.breach_check' => false]);
    ['team' => $team, 'owner' => $camille] = invitationsOnboardingAtlas();
    TeamInviteLink::factory()->for($team)->withToken(InvitationsOnboardingLinkToken)->create(['created_by_id' => $camille->id]);

    $page = browserVisit('/invite/'.InvitationsOnboardingLinkToken);

    $page->assertAttribute('[data-slot="invite-link-card"]', 'data-state', 'logged-out')
        ->click('Create an account')
        ->assertPathIs('/register')
        ->assertPresent('[data-slot="register-form"]')
        ->assertNotPresent('#team_name')
        ->fill('#name', 'Nadia Benali')
        ->fill('#email', 'nadia@elsewhere.example')
        ->fill('#password', InvitationsOnboardingPassword)
        ->fill('#password_confirmation', InvitationsOnboardingPassword)
        ->click('@register-user-button')
        ->assertPathIs('/invite/'.InvitationsOnboardingLinkToken)
        ->assertSee('Verify your address to join Atlas');

    $nadia = User::query()->where('email', 'nadia@elsewhere.example')->sole();

    expect($nadia->onboarding)->toBeNull()
        ->and($team->members()->whereKey($nadia->id)->exists())->toBeFalse();

    $nadia->markEmailAsVerified();

    $page->refresh()
        ->click('@join-by-link-button')
        ->assertPathIs(teamPath('teams.show', $team));

    expect($team->roleOf($nadia))->toBe(TeamRole::Member)
        ->and($nadia->fresh()->onboarding)->toBeNull();
});

it('moves from step 3 to step 4 on "Skip" without sending, and "Go to the dashboard instead" completes the onboarding on the team page', function () {
    ['user' => $sofia, 'onboarding' => $onboarding] = invitationsOnboardingNewcomer(OnboardingStep::Invite);
    $team = $onboarding->team;

    $page = $this->signIn($sofia, '/onboarding');

    $page->assertPresent('[data-slot="invite-step"]')
        ->click('[data-slot="invite-step"] button:has-text("Skip")')
        ->assertPresent('[data-slot="ritual-step"]')
        ->assertSeeIn('[data-slot="ritual-step"]', 'Step 4 of 4');

    expect($team->invitations()->count())->toBe(0)
        ->and($onboarding->fresh()->step)->toBe(OnboardingStep::Ritual);

    $page->click('Go to the dashboard instead')
        ->assertPathIs(teamPath('teams.show', $team))
        ->assertNotPresent('[role="dialog"]');

    expect($onboarding->fresh()->isCompleted())->toBeTrue();

    $page->navigate('/onboarding')->assertPathIsNot('/onboarding');
});

it('sends a signed-out visitor of a team address through sign-in to the team page', function () {
    ['team' => $team, 'member' => $malik] = invitationsOnboardingAtlas();

    $page = browserVisit('/t/atlas');

    $page->assertPathIs('/login')
        ->fill('#email', $malik->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIs(teamPath('teams.show', $team))
        ->navigate('/t/no-such-team')
        ->assertSeeIn('[data-slot="error-page"][data-status="404"]', 'ERROR 404');
});

it('fits onboarding step 2 in a phone: compact stepper, no preview, actions docked at the bottom', function () {
    ['user' => $sofia] = invitationsOnboardingNewcomer(OnboardingStep::Team);

    $page = $this->signIn($sofia, '/onboarding');

    $page->resize(390, 844)
        ->assertPresent('[data-slot="team-step"]')
        ->assertVisible('[data-slot="phase-stepper"]')
        ->assertMissing('[data-slot="team-preview"]')
        ->assertScript("getComputedStyle(document.querySelector('[data-slot=\"team-step\"] [data-slot=\"step-actions\"]')).position", 'sticky')
        ->assertVisible('[data-slot="team-step"] button:has-text("Continue")');

    expect($this->overflowingElements($page))->toBe([]);
});

it('renders onboarding step 3 on the dark background token', function () {
    ['user' => $sofia] = invitationsOnboardingNewcomer(OnboardingStep::Invite);

    $page = $this->signIn($sofia, '/onboarding', ['colorScheme' => 'dark']);

    $page->assertPresent('[data-slot="invite-step"]')
        ->assertScript("document.documentElement.classList.contains('dark')", true)
        ->assertScript('getComputedStyle(document.body).backgroundColor', 'oklch(0.165 0.008 55)');

    expect($this->overflowingElements($page))->toBe([]);
});

it('speaks to a French account informally on onboarding step 1', function () {
    ['user' => $sofia] = invitationsOnboardingNewcomer(OnboardingStep::Workspace);
    $sofia->update(['locale' => 'fr']);

    $page = $this->signIn($sofia, '/onboarding', ['locale' => 'fr-FR']);

    $page->assertScript('document.documentElement.lang', 'fr')
        ->assertSee('Nomme ton espace de travail')
        ->assertSee('Langue par défaut')
        ->assertSee('Premier rituel')
        ->assertSee('Se déconnecter')
        ->assertDontSee('Name your workspace');
});
