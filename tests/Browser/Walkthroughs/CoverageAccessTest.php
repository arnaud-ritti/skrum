<?php

use App\Actions\Auth\IssueMagicLink;
use App\Enums\GameRoomAccess;
use App\Enums\OnboardingStep;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Mail\TwoFactorCodeMail;
use App\Models\GameRoom;
use App\Models\Onboarding;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamInviteLink;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Support\InstanceSettings;
use App\Support\Sessions\JoinCodes;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;

const CaPassword = 'a-long-enough-password-42';

beforeEach(function () {
    config(['mail.default' => 'smtp', 'skrum.passwords.breach_check' => false]);
    Mail::fake();
    RateLimiter::for('login', fn (): Limit => Limit::none());
    RateLimiter::for('magicLinks', fn (): Limit => Limit::none());
});

function caMember(string $teamName = 'Atlas'): User
{
    $user = teamMember(Team::factory()->create(['name' => $teamName]));

    $user->forceFill(['name' => 'Mona Member', 'email' => 'mona@example.com', 'locale' => 'en'])->save();

    return $user;
}

function caTeamPath(User $member): string
{
    $team = $member->teams()->sole();

    return route('teams.show', [$team->workspace, $team], false);
}

/**
 * The browser server listens on its own port: a signed URL must be signed for that origin,
 * then followed as a path from the page.
 */
function caSignedPath(mixed $page, callable $sign): string
{
    $origin = (string) $page->script('() => location.origin');

    URL::forceRootUrl($origin);

    try {
        $url = $sign();
    } finally {
        URL::forceRootUrl(null);
    }

    return substr($url, strlen($origin));
}

/**
 * @return array<string, array{0: Closure(): array{join: string, session: string, member: User, model: Retro|PokerGame|Whiteboard|GameRoom|TeamSurvey}, 1: string}>
 */
function caGuestJoinKinds(): array
{
    return [
        'retro' => [function (): array {
            $retro = Retro::factory()->withGuestAccess()->create(['title' => 'Sprint 12 retro']);
            [$member] = retroMember($retro);

            return ['join' => "/join/{$retro->guest_token}", 'session' => "/retros/{$retro->id}", 'member' => $member, 'model' => $retro];
        }, 'Sprint 12 retro'],
        'poker' => [function (): array {
            $game = PokerGame::factory()->withGuestAccess()->create(['title' => 'Sprint 12 estimates']);
            [$member] = pokerMember($game);

            return ['join' => "/poker/join/{$game->guest_token}", 'session' => "/poker/{$game->id}", 'member' => $member, 'model' => $game];
        }, 'Sprint 12 estimates'],
        'whiteboard' => [function (): array {
            $board = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Sprint 12 board']);
            [$member] = whiteboardMember($board);

            return ['join' => route('whiteboards.join.show', $board->guest_token, false), 'session' => route('whiteboards.show', $board, false), 'member' => $member, 'model' => $board];
        }, 'Sprint 12 board'],
        'game' => [function (): array {
            $room = GameRoom::factory()->linkAccess()->create(['name' => 'Friday hangman']);
            [$member] = gameRoomMember($room);

            return ['join' => "/play/{$room->guest_token}", 'session' => "/games/{$room->id}", 'member' => $member, 'model' => $room];
        }, 'Friday hangman'],
        'survey' => [function (): array {
            $survey = TeamSurvey::factory()->open()->withGuestAccess()->create(['title' => 'Q4 team survey']);
            [$member] = surveyMember($survey);

            return ['join' => "/surveys/join/{$survey->guest_token}", 'session' => "/surveys/{$survey->id}", 'member' => $member, 'model' => $survey];
        }, 'Q4 team survey'],
    ];
}

it('[CA-01] sends a visitor of the home page to the log in page and a member to their dashboard', function () {
    $member = caMember();

    visit('/')->assertPathIs('/login')->assertSee('Welcome back');

    $this->signIn($member, '/')
        ->assertPathIsNot('/login')
        ->assertPathIsNot('/')
        ->assertSee('Atlas');
});

it('[CA-02] signs a member in with a valid magic link after "Continue", and the same link then no longer works', function () {
    $member = caMember();

    $page = visit('/login');
    $path = caSignedPath($page, fn (): string => resolve(IssueMagicLink::class)->handle($member));

    $page->navigate($path)
        ->assertSee('You are about to sign in as')
        ->assertPresent('[data-test="magic-link-confirm-button"]')
        ->click('[data-test="magic-link-confirm-button"]')
        ->assertPathIs(caTeamPath($member))
        ->assertSee('Atlas');

    $page->navigate('/settings')->assertPathIs('/settings');

    $visitor = visit($path);

    $visitor->assertSee('This link no longer works')
        ->assertNotPresent('[data-test="magic-link-confirm-button"]')
        ->click('Back to log in')
        ->assertPathIs('/login');
});

it('[CA-03] refuses a magic link once it has expired, and one whose signature was changed', function () {
    $member = caMember();

    $page = visit('/login');
    $path = caSignedPath($page, fn (): string => resolve(IssueMagicLink::class)->handle($member));

    $page->navigate(preg_replace('/signature=[0-9a-f]{4}/', 'signature=0000', $path))
        ->assertSee('This link no longer works')
        ->assertNotPresent('[data-test="magic-link-confirm-button"]');

    $this->travel(2)->hours();

    $page->navigate($path)
        ->assertSee('This link no longer works')
        ->assertNotPresent('[data-test="magic-link-confirm-button"]');
});

it('[CA-04] sends a signed-in member who opens a magic link to the application, not to the confirmation', function () {
    $member = caMember();
    $other = User::factory()->create();

    $page = $this->signIn($member);
    $path = caSignedPath($page, fn (): string => resolve(IssueMagicLink::class)->handle($other));

    $page->navigate($path)
        ->assertPathIs(caTeamPath($member))
        ->assertNotPresent('[data-slot="magic-link-confirmation"]');

    $page->navigate('/settings/profile')
        ->assertValue('#email', $member->email);
});

it('[CA-05] signs in an account whose second factor is a code sent by e-mail, after refusing a wrong code', function () {
    $member = User::factory()->withEmailSecondFactor()->create(['name' => 'Mona Member', 'email' => 'mona@example.com', 'locale' => 'en']);
    $member->workspaces()->attach(Workspace::factory()->create(['name' => 'Nordlys']), ['role' => WorkspaceRole::Member->value]);

    $page = visit('/login');

    $page->fill('#email', $member->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIs('/two-factor-challenge')
        ->assertPresent('[data-slot="email-code-challenge"]')
        ->assertSeeIn('[data-slot="email-code-challenge"]', 'm…@example.com');

    $code = '';
    Mail::assertQueued(TwoFactorCodeMail::class, function (TwoFactorCodeMail $mail) use (&$code): bool {
        $code = $mail->code;

        return true;
    });

    $page->fill('[data-slot="email-code-challenge"] input[name="code"]', $code === '000000' ? '111111' : '000000')
        ->assertPresent('[data-slot="email-code-challenge"] [role="alert"]')
        ->assertPathIs('/two-factor-challenge')
        ->typeSlowly('[data-slot="email-code-challenge"] input[name="code"]', $code, 20)
        ->assertPathIsNot('/two-factor-challenge')
        ->assertPathIsNot('/login')
        ->assertSee('Nordlys');
});

it('[CA-06] sends a visitor who opens the two-factor challenge without a password first to the log in page', function () {
    visit('/two-factor-challenge')->assertPathIs('/login');
});

it('[CA-07] resets a password with the link of the mail, signs in with the new one, and refuses a token that does not exist', function () {
    $member = caMember();
    $token = Password::broker()->createToken($member);

    $page = visit('/reset-password/not-a-token?email=mona%40example.com');

    $page->assertValue('#email', 'mona@example.com')
        ->fill('#password', CaPassword)
        ->fill('#password_confirmation', CaPassword)
        ->click('@reset-password-button')
        ->assertSee('This password reset token is invalid.')
        ->assertPathBeginsWith('/reset-password/');

    $page->navigate("/reset-password/{$token}?email=mona%40example.com")
        ->fill('#password', CaPassword)
        ->fill('#password_confirmation', CaPassword)
        ->click('@reset-password-button')
        ->assertPathIs('/login')
        ->fill('#email', $member->email)
        ->fill('#password', CaPassword)
        ->click('@login-button')
        ->assertPathIsNot('/login')
        ->assertSee('Atlas');
});

it('[CA-08] verifies the address of the account that opens its verification link and refuses the link of another account', function () {
    $mona = User::factory()->unverified()->create(['name' => 'Mona Member', 'email' => 'mona@example.com', 'locale' => 'en']);
    $otto = User::factory()->unverified()->create(['name' => 'Otto Other', 'email' => 'otto@example.com', 'locale' => 'en']);

    $page = $this->signIn($mona, '/dashboard');

    $page->assertPathIs('/email/verify')
        ->assertPresent('[data-slot="verify-email-form"]');

    $ottoLink = caSignedPath($page, fn (): string => URL::temporarySignedRoute('verification.verify', now()->addHour(), ['id' => $otto->id, 'hash' => sha1($otto->email)]));
    $monaLink = caSignedPath($page, fn (): string => URL::temporarySignedRoute('verification.verify', now()->addHour(), ['id' => $mona->id, 'hash' => sha1($mona->email)]));

    $page->navigate($ottoLink)
        ->assertPresent('[data-slot="error-page"][data-status="403"]');

    expect($otto->fresh()->hasVerifiedEmail())->toBeFalse();

    $page->navigate($monaLink)
        ->assertPathIsNot('/email/verify');

    expect($mona->fresh()->hasVerifiedEmail())->toBeTrue();
});

it('[CA-09] sends a signed-in member away from the log in, registration and forgotten password pages', function (string $path) {
    $member = caMember();

    $this->signIn($member, $path)
        ->assertPathIsNot($path)
        ->assertSee('Atlas');
})->with(['/login', '/register', '/forgot-password']);

it('[CA-10] answers 403 on the registration page of an instance open on invitation only, once it has users', function () {
    config(['skrum.signup_mode' => 'invite']);
    User::factory()->create();

    visit('/register')
        ->assertPresent('[data-slot="error-page"][data-status="403"]')
        ->assertNotPresent('[data-slot="register-form"]');
});

it('[CA-11] gives the SSO buttons of the log in page the redirect address of their provider', function () {
    config([
        'services.github.client_id' => 'coverage',
        'services.github.client_secret' => 'coverage',
        'services.google.client_id' => 'coverage',
        'services.google.client_secret' => 'coverage',
    ]);

    visit('/login')
        ->assertSeeIn('[data-slot="sso-buttons"] a[href$="/auth/google/redirect"]', 'Continue with Google')
        ->assertSeeIn('[data-slot="sso-buttons"] a[href$="/auth/github/redirect"]', 'GitHub');
});

it('[CA-12] shows the join page of each kind of session to a visitor, who joins it as a guest', function (Closure $session, string $title) {
    ['join' => $join, 'session' => $sessionPath] = $session();

    $page = visit($join);

    $page->assertPresent('[data-slot="guest-join"]')
        ->assertSee($title)
        ->assertSee('Join as a guest')
        ->fill('#name', 'Nadia')
        ->click('Join the session')
        ->assertPathIs($sessionPath)
        ->assertNoJavaScriptErrors();
})->with(caGuestJoinKinds());

it('[CA-13] sends a member of the session who opens its guest link straight to the session', function (Closure $session) {
    ['join' => $join, 'session' => $sessionPath, 'member' => $member] = $session();

    $this->signIn($member, $join)
        ->assertPathIs($sessionPath)
        ->assertNotPresent('[data-slot="guest-join"]');
})->with(caGuestJoinKinds());

it('[CA-14] refuses the guest link of each kind of session once guest access is closed, and a link that never existed', function (Closure $session) {
    ['join' => $join, 'model' => $model] = $session();

    $model instanceof GameRoom
        ? $model->update(['access' => GameRoomAccess::Team])
        : $model->update(['guest_access_enabled' => false]);

    visit($join)
        ->assertSee('This guest link is no longer valid.')
        ->assertNotPresent('[data-slot="guest-join"]');

    visit(preg_replace('/[^\/]+$/', 'a-guest-token-that-does-not-exist', $join))
        ->assertSee('This guest link is no longer valid.')
        ->assertNotPresent('[data-slot="guest-join"]');
})->with(caGuestJoinKinds());

it('[CA-15] leads a visitor who types the code of each kind of session to its join page', function (Closure $session) {
    ['join' => $join, 'model' => $model] = $session();
    $code = resolve(JoinCodes::class)->for($model);

    visit('/join')
        ->fill('#code', $code)
        ->click('[data-slot="join-code-action"] button[type="submit"]')
        ->assertPathIs($join)
        ->assertPresent('[data-slot="guest-join"]');
})->with(caGuestJoinKinds());

it('[CA-16] sends a visitor of the onboarding to the log in page and a member without an onboarding to the application', function () {
    $member = caMember();

    visit('/onboarding')->assertPathIs('/login');

    $this->signIn($member, '/onboarding')
        ->assertPathIsNot('/onboarding')
        ->assertNotPresent('[data-slot="workspace-step"]');
});

it('[CA-17] answers 404 on the team address of a team in a workspace the member is not in', function () {
    $member = caMember();
    $elsewhere = Team::factory()->create(['name' => 'Orion', 'slug' => 'orion']);
    teamMember($elsewhere);

    $this->signIn($member, '/t/orion')
        ->assertPathIs('/t/orion')
        ->assertPresent('[data-slot="error-page"][data-status="404"]')
        ->assertDontSee('Orion');
});

it('[CA-18] shows the invalid card for an invite link that never existed and the notice for one that was turned off', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $owner = teamMember($team, TeamRole::Owner);
    $owner->forceFill(['name' => 'Camille Roux'])->save();
    TeamInviteLink::factory()->for($team)->revoked()->withToken('caRevokedInviteLinkTokenForCoverage00001')->create(['created_by_id' => $owner->id]);

    visit('/invite/caUnknownInviteLinkTokenForCoverage000001')
        ->assertSee('This invitation link is no longer valid.')
        ->assertNotPresent('[data-slot="invite-link-card"]');

    visit('/invite/caRevokedInviteLinkTokenForCoverage00001')
        ->assertSee('This link no longer works.')
        ->assertSee('Ask Camille Roux for a new one.')
        ->assertNotPresent('@join-by-link-button');
});

it('[CA-19] sends a member of the team who opens its invite link to the team page without counting a join', function () {
    $member = caMember();
    $team = $member->teams()->sole();
    $link = TeamInviteLink::factory()->for($team)->withToken('caMemberInviteLinkTokenForCoverage000001')->create();

    $this->signIn($member, '/invite/caMemberInviteLinkTokenForCoverage000001')
        ->assertPathIs(route('teams.show', [$team->workspace, $team], false))
        ->assertNotPresent('[data-slot="invite-link-card"]');

    expect($link->fresh()->uses_count)->toBe(0);
});

it('[CA-20] stops the reminder e-mails from their signed link and refuses a link whose signature was changed', function () {
    $member = caMember();
    $member->forceFill(['action_item_reminders_by_email' => true])->save();

    $page = visit('/login');
    $path = caSignedPath($page, fn (): string => URL::signedRoute('reminderUnsubscribes.show', ['user' => $member->id]));

    $page->navigate(preg_replace('/signature=[0-9a-f]{4}/', 'signature=0000', $path))
        ->assertPresent('[data-slot="error-page"][data-status="403"]')
        ->assertNotPresent('[data-test="unsubscribe-button"]');

    $page->navigate($path)
        ->assertSee('Stop the action item reminders sent by e-mail?')
        ->click('[data-test="unsubscribe-button"]')
        ->assertSee('You no longer receive action item reminders by e-mail.')
        ->assertNotPresent('[data-test="unsubscribe-button"]');

    expect($member->fresh()->action_item_reminders_by_email)->toBeFalse();
});

it('[CA-21] stops the recap e-mails from their signed link and refuses a link whose signature was changed', function () {
    $member = caMember();
    $member->forceFill(['recap_emails' => true])->save();

    $page = visit('/login');
    $path = caSignedPath($page, fn (): string => URL::signedRoute('recapUnsubscribes.show', ['user' => $member->id]));

    $page->navigate(preg_replace('/signature=[0-9a-f]{4}/', 'signature=0000', $path))
        ->assertPresent('[data-slot="error-page"][data-status="403"]')
        ->assertNotPresent('[data-test="unsubscribe-button"]');

    $page->navigate($path)
        ->click('[data-test="unsubscribe-button"]')
        ->assertNotPresent('[data-test="unsubscribe-button"]');

    expect($member->fresh()->recap_emails)->toBeFalse();
});

it('[CA-22] sends a visitor of the About page to the log in page and shows it to a member', function () {
    $member = caMember();

    visit('/about')->assertPathIs('/login');

    $this->signIn($member, '/about')
        ->assertPathIs('/about')
        ->assertPresent('[data-slot="about"]');
});

it('[CA-23] fits the magic link confirmation in a phone, in the dark theme', function () {
    $member = caMember();

    $page = visit('/login', ['colorScheme' => 'dark']);
    $path = caSignedPath($page, fn (): string => resolve(IssueMagicLink::class)->handle($member));

    $page->navigate($path)
        ->resize(390, 844)
        ->assertVisible('[data-test="magic-link-confirm-button"]')
        ->assertScript("document.documentElement.classList.contains('dark')", true);

    expect($this->overflowingElements($page))->toBe([]);
});

/**
 * Nordlys and its team Atlas: Camille owns both, Théo facilitates the team.
 *
 * @return array{
 *     workspace: Workspace,
 *     team: Team,
 *     owner: User,
 *     facilitator: User
 * }
 */
function caAtlas(): array
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas', 'slug' => 'atlas']);
    $owner = User::factory()->create(['name' => 'Camille Roux', 'email' => 'camille@nordlys.example', 'locale' => 'en']);
    $facilitator = User::factory()->create(['name' => 'Théo Martin', 'email' => 'theo@nordlys.example', 'locale' => 'en']);

    $workspace->members()->attach($owner, ['role' => WorkspaceRole::Owner->value]);
    $workspace->members()->attach($facilitator, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);
    $team->members()->attach($facilitator, ['role' => TeamRole::Facilitator->value]);

    return ['workspace' => $workspace, 'team' => $team, 'owner' => $owner, 'facilitator' => $facilitator];
}

it('[CA-P25-05] shows the message of a workspace invitation without a team on the invitation card', function () {
    ['workspace' => $workspace, 'owner' => $camille] = caAtlas();

    WorkspaceInvitation::factory()->withToken('ca-workspace-invitation')->withMessage('Welcome aboard, see you Monday!')->create([
        'workspace_id' => $workspace->id,
        'email' => 'nadia@elsewhere.example',
        'invited_by_id' => $camille->id,
    ]);

    visit('/invitations/ca-workspace-invitation')
        ->assertSeeIn('[data-slot="invitation-sentence"]', 'Camille Roux invited you to join Nordlys')
        ->assertNotPresent('[data-slot="invitation-team"]')
        ->assertSeeIn('[data-slot="invitation-message"]', 'Welcome aboard, see you Monday!')
        ->assertSeeIn('@create-invitation-account-button', 'Create my account and join Nordlys');
});

it('[CA-P25-02] refuses an incomplete address in the team invite dialog and sends nothing', function () {
    ['team' => $team, 'owner' => $camille] = caAtlas();

    $chips = '[role="dialog"] [data-slot="email-chips-field"] input';

    $this->signIn($camille, route('teams.show', [$team->workspace, $team], false))
        ->click('[data-slot="team-page"] button:has-text("Invite")')
        ->fill($chips, 'nadia@')
        ->keys($chips, 'Enter')
        ->assertSee('“nadia@” looks incomplete.')
        ->assertNoJavaScriptErrors();

    expect($team->invitations()->count())->toBe(0);
});

it('[CA-P25-13] refuses a team link of the wrong form at onboarding step 2, under its field', function () {
    $sofia = User::factory()->create(['name' => 'Sofia Laurent', 'email' => 'sofia@nordlys.example', 'locale' => 'en']);
    $workspace = Workspace::factory()->withMember($sofia, WorkspaceRole::Owner)->create(['name' => 'Nordlys']);
    Onboarding::factory()->for($sofia)->atStep(OnboardingStep::Team)->create(['workspace_id' => $workspace->id, 'team_name' => 'Atlas']);

    $this->signIn($sofia, '/onboarding')
        ->assertPresent('[data-slot="team-step"]')
        ->click('[data-slot="team-address-field"] button')
        ->fill('[data-slot="team-address-field"] input', 'Atlas Team!')
        ->assertSeeIn('[data-slot="team-address-field"] [data-slot="field-error"]', 'Use lower-case letters, digits and hyphens.')
        ->click('[data-slot="team-step"] button:has-text("Continue")')
        ->assertPresent('[data-slot="team-step"]')
        ->assertNotPresent('[data-slot="invite-step"]');

    expect($workspace->teams()->count())->toBe(0);
});

it('[CA-P25-18] lets a facilitator resend and, after a confirmation, revoke an invitation of the team from the Members tab', function () {
    ['workspace' => $workspace, 'team' => $team, 'owner' => $camille, 'facilitator' => $theo] = caAtlas();
    $invitation = WorkspaceInvitation::factory()->forTeam($team, TeamRole::Member)->create(['email' => 'nadia@elsewhere.example', 'invited_by_id' => $camille->id]);

    $row = '[data-slot="pending-invitation"]:has-text("nadia@elsewhere.example")';

    $page = $this->signIn($theo, route('teams.members.index', [$workspace, $team], false));

    $page->assertSeeIn($row, 'Invitation pending')
        ->click("{$row} [aria-label=\"Resend the invitation of nadia@elsewhere.example\"]")
        ->assertSee('Invitation sent again to nadia@elsewhere.example.');

    $resent = $team->invitations()->sole();

    expect($resent->token_hash)->not->toBe($invitation->token_hash);

    $page->click("{$row} [aria-label=\"Revoke the invitation of nadia@elsewhere.example\"]")
        ->assertSeeIn('[role="alertdialog"]', 'Revoke the invitation of nadia@elsewhere.example?')
        ->click('[role="alertdialog"] button:has-text("Revoke")')
        ->assertNotPresent($row);

    expect($team->invitations()->count())->toBe(0);
});

it('[CA-P25-19] invites from the workspace members page with a team, its role and a message, and lists the team on the row', function () {
    ['workspace' => $workspace, 'team' => $team, 'owner' => $camille] = caAtlas();

    $row = '[data-slot="invitation-row"][data-invitation-email="nadia@elsewhere.example"]';

    $this->signIn($camille, route('workspaces.members.index', $workspace, false))
        ->click('[data-slot="members-header"] button:has-text("Invite")')
        ->fill('[role="dialog"] input[name="email"]', 'nadia@elsewhere.example')
        ->click('#invitation-team')
        ->click('[role="option"]:has-text("Atlas")')
        ->assertPresent('#invitation-team-role')
        ->fill('#invitation-message', 'Join us on Atlas!')
        ->click('@send-invitation')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($row, 'Invitation pending')
        ->assertSeeIn("{$row} [data-slot=\"invitation-details\"]", 'Atlas');

    $invitation = $workspace->invitations()->sole();

    expect($invitation->team_id)->toBe($team->id)
        ->and($invitation->team_role)->toBe(TeamRole::Member)
        ->and($invitation->message)->toBe('Join us on Atlas!');
});

it('[CA-P25-20] names the team of a team invitation in the bell of the invitee, with a link to the invitation and no accept or decline', function () {
    ['team' => $team, 'owner' => $camille] = caAtlas();
    $nadia = User::factory()->create(['name' => 'Nadia Benali', 'email' => 'nadia@elsewhere.example', 'locale' => 'en']);
    Workspace::factory()->withMember($nadia, WorkspaceRole::Member)->create(['name' => 'Elsewhere']);
    $chips = '[role="dialog"] [data-slot="email-chips-field"] input';

    $this->signIn($camille, route('teams.show', [$team->workspace, $team], false))
        ->click('[data-slot="team-page"] button:has-text("Invite")')
        ->fill($chips, $nadia->email)
        ->keys($chips, 'Enter')
        ->click('Send one invitation')
        ->assertSee('One invitation sent.');

    $this->signIn($nadia)
        ->click('[aria-label="Notifications, 1 unread"]')
        ->assertSee('Camille Roux invited you to join Atlas')
        ->assertSee('View invitation')
        ->assertNotPresent('[role="dialog"] button:has-text("Accept"), [data-radix-popper-content-wrapper] button:has-text("Accept")');
});

it('[CA-P25-22] lets the team owner change the team link on the General tab, which the team address then follows', function () {
    ['workspace' => $workspace, 'team' => $team, 'owner' => $camille] = caAtlas();

    $page = $this->signIn($camille, route('teams.settings.show', [$workspace, $team], false));

    $page->click('[data-slot="team-address-field"] button')
        ->fill('[data-slot="team-address-field"] input', 'atlas-web')
        ->click('button[type="submit"]:has-text("Save")')
        ->assertSee('Team saved.');

    expect($team->fresh()->slug)->toBe('atlas-web');

    $page->navigate('/t/atlas-web')
        ->assertPathIs(route('teams.show', [$workspace, $team->fresh()], false));
});

it('[CA-P25-26] lets an instance admin set and clear the default workspace of new SSO accounts, and refuses the page to a member', function () {
    ['workspace' => $workspace, 'owner' => $camille] = caAtlas();
    $admin = User::factory()->instanceAdmin()->create(['name' => 'Arnaud Ritti', 'locale' => 'en']);

    $page = $this->signIn($admin, '/admin/sign-in');

    $page->assertPathIs('/user/confirm-password')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs('/admin/sign-in')
        ->assertSeeIn('[data-slot="default-workspace-card"]', 'New SSO accounts')
        ->assertDisabled('[data-slot="default-workspace-card"] button[type="submit"]')
        ->click('[data-slot="default-workspace-card"] [role="combobox"]')
        ->click('[role="option"]:has-text("Nordlys")')
        ->click('[data-slot="default-workspace-card"] button[type="submit"]')
        ->assertDisabled('[data-slot="default-workspace-card"] button[type="submit"]');

    expect(resolve(InstanceSettings::class)->defaultWorkspaceId())->toBe($workspace->id);

    $page->click('[data-slot="default-workspace-card"] [role="combobox"]')
        ->click('[role="option"]:has-text("None")')
        ->click('[data-slot="default-workspace-card"] button[type="submit"]')
        ->assertDisabled('[data-slot="default-workspace-card"] button[type="submit"]');

    expect(resolve(InstanceSettings::class)->defaultWorkspaceId())->toBeNull();

    $this->signIn($camille, '/admin/sign-in')
        ->assertPresent('[data-slot="error-page"][data-status="403"]')
        ->assertNotPresent('[data-slot="default-workspace-card"]');
});
