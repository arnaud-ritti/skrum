<?php

use App\Enums\ColumnColor;
use App\Enums\OnboardingStep;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Onboarding;
use App\Models\Team;
use App\Models\TeamInviteLink;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

const OnboardingVisualInvitationToken = 'theInvitationTokenForTheVisualCaptures01';

const OnboardingVisualDeclinedToken = 'theDeclinedTokenForTheVisualCaptures0001';

const OnboardingVisualLinkToken = 'theInviteLinkTokenForTheVisualCaptures01';

const OnboardingVisualMessage = "Salut Nadia ! On lance la rétro du sprint 42 jeudi.\nRejoins-nous sur Atlas, on a hâte.";

/**
 * Nordlys and its team Atlas (sky): Camille, owner of both, Théo, facilitator of the team,
 * and Malik, a member.
 *
 * @return array{
 *     workspace: Workspace,
 *     team: Team,
 *     owner: User,
 *     facilitator: User,
 *     member: User
 * }
 */
function onboardingVisualAtlas(): array
{
    config(['app.name' => 'Skrum']);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $owner = User::factory()->create(['name' => 'Camille Roux', 'email' => 'camille.roux@nordlys.example']);
    $facilitator = User::factory()->create(['name' => 'Théo Martin', 'email' => 'theo.martin@nordlys.example']);
    $member = User::factory()->create(['name' => 'Malik Kone', 'email' => 'malik.kone@nordlys.example']);

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create([
        'name' => 'Atlas',
        'color' => ColumnColor::Sky,
        'description' => 'Checkout and payments squad',
    ]);

    $workspace->members()->attach($owner, ['role' => WorkspaceRole::Owner->value]);
    $workspace->members()->attach($facilitator, ['role' => WorkspaceRole::Member->value]);
    $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);
    $team->members()->attach($facilitator, ['role' => TeamRole::Facilitator->value]);
    $team->members()->attach($member, ['role' => TeamRole::Member->value]);

    return ['workspace' => $workspace, 'team' => $team, 'owner' => $owner, 'facilitator' => $facilitator, 'member' => $member];
}

/**
 * A newcomer who registered with "Team name" Atlas and is at $step; from the team step on,
 * Nordlys exists, and from the invitation step on, Atlas too.
 *
 * @return array{
 *     user: User,
 *     onboarding: Onboarding,
 *     team: ?Team
 * }
 */
function onboardingVisualNewcomer(OnboardingStep $step): array
{
    config(['app.name' => 'Skrum']);
    RateLimiter::for('login', fn (): Limit => Limit::none());

    $user = User::factory()->create(['name' => 'Camille Roux', 'email' => 'camille.roux@nordlys.example']);

    if ($step === OnboardingStep::Workspace) {
        return [
            'user' => $user,
            'onboarding' => Onboarding::factory()->for($user)->create(['team_name' => 'Atlas']),
            'team' => null,
        ];
    }

    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Owner)->create(['name' => 'Nordlys', 'locale' => 'fr']);

    if ($step === OnboardingStep::Team) {
        return [
            'user' => $user,
            'onboarding' => Onboarding::factory()->for($user)->atStep($step)->create([
                'workspace_id' => $workspace->id,
                'team_name' => 'Atlas',
            ]),
            'team' => null,
        ];
    }

    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas', 'color' => ColumnColor::Sky]);
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);

    return [
        'user' => $user,
        'onboarding' => Onboarding::factory()->for($user)->atStep($step)->create([
            'workspace_id' => $workspace->id,
            'team_id' => $team->id,
        ]),
        'team' => $team,
    ];
}

it('renders onboarding step 1 with the workspace named without overflow', function () {
    ['user' => $user] = onboardingVisualNewcomer(OnboardingStep::Workspace);

    $this->captureVisuals('onboarding-workspace', '/onboarding', fn (string $path, array $options) => visualSignIn($user, $path, $options)
        ->assertPresent('[data-slot="workspace-step"]')
        ->fill('[data-slot="workspace-step"] input[autocomplete="organization"]', 'Nordlys'));
});

it('renders onboarding step 2 with the name and colour typed, the team link following the name and "Skip for now", without overflow', function () {
    ['user' => $user] = onboardingVisualNewcomer(OnboardingStep::Team);

    $this->captureVisuals('onboarding-team', '/onboarding', fn (string $path, array $options) => visualSignIn($user, $path, $options)
        ->assertPresent('[data-slot="team-step"]')
        ->fill('[data-slot="team-step"] input[maxlength="100"]', 'Atlas Paiements')
        ->click('[data-slot="team-step"] [role="radio"][data-color="sky"]')
        ->assertSeeIn('[data-slot="team-address-slug"]', 'atlas-paiements')
        ->assertSeeIn('[data-slot="team-preview-name"]', 'Atlas Paiements')
        ->assertCount('[data-slot="team-step"] [data-slot="step-actions"] button', 3));
});

it('renders onboarding step 2 with the team link being edited without overflow', function () {
    ['user' => $user] = onboardingVisualNewcomer(OnboardingStep::Team);

    $this->captureVisuals('onboarding-team-link-edit', '/onboarding', fn (string $path, array $options) => visualSignIn($user, $path, $options)
        ->assertPresent('[data-slot="team-step"]')
        ->fill('[data-slot="team-step"] input[maxlength="100"]', 'Atlas')
        ->click('[data-slot="team-address-field"] button')
        ->fill('[data-slot="team-address-field"] input', 'atlas-checkout')
        ->assertSeeIn('[data-slot="team-preview-address"]', 'atlas-checkout'));
});

it('renders onboarding step 3 with three addresses, one incomplete, and a link three people joined, without overflow', function () {
    ['user' => $user, 'team' => $team] = onboardingVisualNewcomer(OnboardingStep::Invite);

    TeamInviteLink::factory()->for($team)->withToken(OnboardingVisualLinkToken)->joinedBy(3)->create(['created_by_id' => $user->id]);

    $chips = '[data-slot="team-invite-form"] [data-slot="email-chips-field"] input';

    $this->captureVisuals('onboarding-invite', '/onboarding', fn (string $path, array $options) => visualSignIn($user, $path, $options)
        ->assertPresent('[data-slot="invite-step"] [data-slot="invite-link-block"]')
        ->fill($chips, 'nadia.berg@nordlys.example sofia.lindqvist@nordlys.example malik@nordlys')
        ->keys($chips, 'Enter')
        ->assertCount('[data-slot="email-chips-field"] li', 3)
        ->assertCount('[data-slot="email-chips-field"] li[aria-invalid="true"]', 1)
        ->assertSeeIn('[data-slot="invite-link-block"]', str_starts_with($options['locale'], 'fr') ? '3 ont rejoint' : '3 joined'));
});

it('renders onboarding step 4 without overflow', function () {
    ['user' => $user] = onboardingVisualNewcomer(OnboardingStep::Ritual);

    $this->captureVisuals('onboarding-ritual', '/onboarding', fn (string $path, array $options) => visualSignIn($user, $path, $options)
        ->assertPresent('[data-slot="ritual-step"]'));
});

it('renders the register page with "Team name" without overflow', function () {
    config(['app.name' => 'Skrum']);

    $this->captureVisuals('onboarding-register', '/register', fn (string $path, array $options) => browserVisit($path, $options)
        ->assertPresent('[data-slot="register-form"] #team_name'));
});

it('renders the team invitation card with a message, signed out, without overflow', function () {
    ['team' => $team, 'owner' => $owner] = onboardingVisualAtlas();

    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Member)->withToken(OnboardingVisualInvitationToken)->withMessage(OnboardingVisualMessage)->create([
        'email' => 'nadia.berg@nordlys.example',
        'invited_by_id' => $owner->id,
    ]);

    $this->captureVisuals('invitation-team-signed-out', '/invitations/'.OnboardingVisualInvitationToken, fn (string $path, array $options) => browserVisit($path, $options)
        ->assertPresent('[data-slot="invitation-card"] [data-slot="invitation-team"]')
        ->assertPresent('[data-slot="invitation-message"]')
        ->assertPresent('[data-slot="invitation-decline"]'));
});

it('renders the team invitation card with a message, signed in as the invited address, without overflow', function () {
    ['team' => $team, 'owner' => $owner] = onboardingVisualAtlas();
    $invited = User::factory()->create(['name' => 'Nadia Berg', 'email' => 'nadia.berg@nordlys.example']);

    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Member)->withToken(OnboardingVisualInvitationToken)->withMessage(OnboardingVisualMessage)->create([
        'email' => $invited->email,
        'invited_by_id' => $owner->id,
    ]);

    $this->captureVisuals('invitation-team-signed-in', '/invitations/'.OnboardingVisualInvitationToken, fn (string $path, array $options) => visualSignIn($invited, $path, $options)
        ->assertPresent('[data-slot="invitation-card"] [data-slot="invitation-team"]')
        ->assertPresent('[data-slot="invitation-actions"]')
        ->assertPresent('[data-slot="invitation-message"]'));
});

it('renders a declined team invitation without overflow', function () {
    ['team' => $team, 'owner' => $owner] = onboardingVisualAtlas();

    WorkspaceInvitation::factory()->forTeam($team)->withToken(OnboardingVisualDeclinedToken)->declined()->create([
        'email' => 'nadia.berg@nordlys.example',
        'invited_by_id' => $owner->id,
    ]);

    $this->captureVisuals('invitation-team-declined', '/invitations/'.OnboardingVisualDeclinedToken, fn (string $path, array $options) => browserVisit($path, $options)
        ->assertPresent('[data-slot="access-notice"]'));
});

it('renders the invite link page signed out without overflow', function () {
    ['team' => $team, 'owner' => $owner] = onboardingVisualAtlas();

    TeamInviteLink::factory()->for($team)->withToken(OnboardingVisualLinkToken)->create(['created_by_id' => $owner->id]);

    $this->captureVisuals('invite-link-signed-out', '/invite/'.OnboardingVisualLinkToken, fn (string $path, array $options) => browserVisit($path, $options)
        ->assertPresent('[data-slot="invite-link-card"]'));
});

it('renders the invite link page signed in without overflow', function () {
    ['team' => $team, 'owner' => $owner] = onboardingVisualAtlas();
    $visitor = User::factory()->create(['name' => 'Nadia Berg', 'email' => 'nadia.berg@nordlys.example']);

    TeamInviteLink::factory()->for($team)->withToken(OnboardingVisualLinkToken)->create(['created_by_id' => $owner->id]);

    $this->captureVisuals('invite-link-signed-in', '/invite/'.OnboardingVisualLinkToken, fn (string $path, array $options) => visualSignIn($visitor, $path, $options)
        ->assertPresent('[data-slot="invite-link-card"] [data-slot="invite-link-account"]'));
});

it('renders the invite dialog of the Members page with the link three people joined without overflow', function () {
    ['workspace' => $workspace, 'team' => $team, 'owner' => $owner] = onboardingVisualAtlas();

    TeamInviteLink::factory()->for($team)->withToken(OnboardingVisualLinkToken)->joinedBy(3)->create(['created_by_id' => $owner->id]);

    $this->captureVisuals('team-invite-dialog', route('teams.members.index', [$workspace, $team], false), fn (string $path, array $options) => visualSignIn($owner, $path, $options)
        ->assertPresent('[data-slot="members-page"]')
        ->click('[data-slot="members-page"] button:has(span:text-is("'.(str_starts_with($options['locale'], 'fr') ? 'Inviter' : 'Invite').'"))')
        ->assertPresent('[role="dialog"] [data-slot="team-invite-form"]')
        ->assertPresent('[role="dialog"] [data-slot="invite-link-block"]'), fullPage: false);
});

it('renders the team members card with a pending, an expired and a declined invitation, as an owner and as a facilitator, without overflow', function (string $viewer) {
    $atlas = onboardingVisualAtlas();
    ['workspace' => $workspace, 'team' => $team, 'owner' => $owner] = $atlas;

    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Member)->create(['email' => 'nadia.berg@nordlys.example', 'invited_by_id' => $owner->id]);
    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Observer)->expired()->create(['email' => 'lea.dubois@nordlys.example', 'invited_by_id' => $owner->id]);
    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Facilitator)->declined()->create(['email' => 'jonas.weber@nordlys.example', 'invited_by_id' => $owner->id]);

    $this->captureVisuals("team-members-invitations-{$viewer}", route('teams.members.index', [$workspace, $team], false), fn (string $path, array $options) => visualSignIn($atlas[$viewer], $path, $options)
        ->assertCount('[data-slot="pending-invitation"]', 3));
})->with(['owner', 'facilitator']);

it('renders the General tab with the team link field without overflow', function () {
    ['workspace' => $workspace, 'team' => $team, 'owner' => $owner] = onboardingVisualAtlas();

    $this->captureVisuals('team-settings-general-link', route('teams.settings.show', [$workspace, $team], false), fn (string $path, array $options) => visualSignIn($owner, $path, $options)
        ->assertPresent('[data-slot="team-address-field"]')
        ->assertSeeIn('[data-slot="team-address-slug"]', 'atlas'));
});
