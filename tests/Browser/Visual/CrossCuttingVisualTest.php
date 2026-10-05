<?php

use App\Enums\ActionItemReminderKind;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\SocialAccount;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Notifications\ActionItemReminderNotification;
use App\Notifications\RetroResultsNotification;
use App\Notifications\WorkspaceInvitationReceivedNotification;
use App\Support\InstanceSettings;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;

const P18fViewports = [1440 => 900, 390 => 844];

beforeEach(function () {
    config(['app.name' => 'Skrum', 'mail.default' => 'smtp']);
    Mail::fake();
    RateLimiter::for('login', fn (): Limit => Limit::none());
    RateLimiter::for('magicLinks', fn (): Limit => Limit::none());
});

/**
 * @param  array<string, string>  $options
 */
function p18fLanguage(array $options): string
{
    return str_starts_with($options['locale'], 'fr') ? 'fr' : 'en';
}

function p18fSingleSignOnConfigured(): void
{
    config([
        'services.google.client_id' => 'visual-test',
        'services.google.client_secret' => 'visual-test',
    ]);
}

function p18fMember(): User
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);

    $member = User::factory()->create([
        'id' => '0199a000-0000-7000-8000-000000000020',
        'name' => 'Mona Member',
        'email' => 'mona.member@example.com',
    ]);
    $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($member);

    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 42 retrospective']);

    return $member;
}

/**
 * Signs in through the form, at the width of the capture: the bell, the
 * palette and the login form choose their layout from the width they open at.
 *
 * @param  array<string, string>  $options
 */
function p18fSignIn(User $user, array $options, int $width): mixed
{
    User::query()->whereKey($user->id)->update(['locale' => p18fLanguage($options)]);

    $page = visit('/login', $options);

    $page->fill('#email', $user->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIsNot('/login');

    return $page->resize($width, P18fViewports[$width])
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
}

/**
 * @param  array<string, string>  $options
 */
function p18fConfirmedVisit(User $user, string $path, array $options, int $width, string $marker, ?string $landingPath = null): mixed
{
    $page = p18fSignIn($user, $options, $width);

    $page->navigate($path);

    return $page->assertPathIs('/user/confirm-password')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs($landingPath ?? $path)
        ->assertPresent($marker);
}

function p18fOpenBell(mixed $page): mixed
{
    return $page->click('button:has(+ [data-slot="notifications-live"])')
        ->assertPresent('[data-slot="notifications-panel"]')
        ->assertNotPresent('[data-slot="notifications-loading"]');
}

function p18fOpenPalette(mixed $page, int $width): mixed
{
    return $page->click($width < 768 ? '@command-menu-button-compact' : '@command-menu-button')
        ->assertPresent('[data-slot="command-input"]');
}

function p18fMailSamples(): void
{
    $team = Team::factory()->create(['name' => 'Demo Team']);
    $user = teamMember($team);

    ActionItem::factory()->count(3)->withoutRetro($team, $user)->create(['due_on' => '2026-09-26']);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 42']);
}

dataset('p18fMails', ['magic-link', 'two-factor-code', 'invitation', 'action-reminder', 'retro-recap']);

it('renders the five mails without overflow', function (string $mail) {
    p18fMailSamples();

    $this->captureVisuals(
        "mail-{$mail}",
        "/dev/mail/{$mail}",
        fn (string $path, array $options) => visit($path.'?locale='.p18fLanguage($options), $options),
        appShell: false,
    );
})->with('p18fMails');

it('renders the five mails in the colour of a rebranded instance without overflow', function (string $mail) {
    p18fMailSamples();
    resolve(InstanceSettings::class)->setMany(['brand_color' => '#ffd600']);

    $this->captureVisuals(
        "mail-{$mail}-white-label",
        "/dev/mail/{$mail}",
        fn (string $path, array $options) => visit($path.'?locale='.p18fLanguage($options), $options),
        appShell: false,
    );
})->with('p18fMails');

it('renders the login page with the magic link without overflow', function () {
    $this->captureVisuals(
        'login-with-magic-link',
        '/login',
        fn (string $path, array $options, int $width) => visit($path, $options)
            ->resize($width, P18fViewports[$width])
            ->assertPresent($width < 768 ? '[data-slot="login-method-tabs"]' : '[data-test="magic-link-button"]'),
    );
});

it('renders the login page once the link is sent without overflow', function () {
    $this->captureVisuals(
        'login-magic-link-sent',
        '/login',
        function (string $path, array $options, int $width) {
            $page = visit($path, $options)
                ->resize($width, P18fViewports[$width])
                ->assertPresent('[data-slot="login-form"] #email');

            if ($width < 768) {
                $page->click('[data-slot="login-method-tabs"] [role="tab"]:first-child');
            }

            return $page->fill('#email', 'mona.member@example.com')
                ->click('@magic-link-button')
                ->assertPresent('[data-slot="magic-link-sent"] [data-test="magic-link-resend-button"]');
        },
    );
});

it('renders the page of a link that no longer works without overflow', function () {
    $this->captureVisuals(
        'magic-link-invalid',
        '/magic-link/'.str_repeat('a', 64),
        fn (string $path, array $options) => visit($path, $options)->assertPresent('[data-slot="magic-link-confirmation"]'),
    );
});

it('renders the login page with single sign-on required without overflow', function (string $name, bool $administrator) {
    p18fSingleSignOnConfigured();
    resolve(InstanceSettings::class)->set('sso_required', true);

    $this->captureVisuals(
        $name,
        '/login',
        function (string $path, array $options) use ($administrator) {
            $page = visit($path, $options)
                ->assertPresent('[data-slot="login-form"] [data-slot="login-sso-only"]')
                ->assertNotPresent('[data-test="magic-link-button"]');

            if (! $administrator) {
                return $page->assertNotPresent('#email');
            }

            return $page->click('@admin-sign-in-button')->assertPresent('[data-slot="admin-sign-in"] #password');
        },
    );
})->with([
    'folded' => ['login-sso-required', false],
    'administrator sign-in open' => ['login-sso-required-administrator', true],
]);

it('renders the two-factor challenge in e-mail mode without overflow', function () {
    $this->captureVisuals(
        'two-factor-email-code',
        '/two-factor-challenge',
        function (string $path, array $options, int $width) {
            $member = User::factory()->withEmailSecondFactor()->create(['name' => 'Mona Member', 'email' => p18fVisualEmail($options, $width)]);

            return visit('/login', $options)
                ->fill('#email', $member->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIs($path)
                ->assertPresent('[data-slot="email-code-challenge"]');
        },
    );
});

it('renders the security settings with the e-mail code without overflow', function (string $name, bool $enabled) {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);

    $this->captureVisuals(
        $name,
        '/settings/security',
        function (string $path, array $options, int $width) use ($workspace, $enabled) {
            $member = User::factory()
                ->when($enabled, fn ($factory) => $factory->withEmailSecondFactor())
                ->create(['name' => 'Mona Member', 'email' => p18fVisualEmail($options, $width)]);
            $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);

            if ($enabled) {
                return p18fSignInWithEmailCodeOff($member, $path, $options, $width, '[data-slot="two-factor-row"]', '/settings');
            }

            return p18fConfirmedVisit($member, $path, $options, $width, '[data-slot="two-factor-row"]', '/settings')
                ->click('[data-slot="two-factor-row"] button:has(svg.lucide-mail)')
                ->assertPresent('[data-slot="email-code-enrolment"]');
        },
    );
})->with([
    'enrolment' => ['settings-security-email-code-enrolment', false],
    'turned on' => ['settings-security-email-code-on', true],
]);

/**
 * One address per capture, the same on every run: the pages show it, masked or not.
 *
 * @param  array<string, string>  $options
 */
function p18fVisualEmail(array $options, int $width): string
{
    return "mona.{$options['colorScheme']}.{$options['locale']}.{$width}@example.com";
}

/**
 * A member whose e-mail code is on would meet the challenge at the login
 * form: the factor is taken off for the sign-in and put back before the page
 * is opened.
 *
 * @param  array<string, string>  $options
 */
function p18fSignInWithEmailCodeOff(User $member, string $path, array $options, int $width, string $marker, ?string $landingPath = null): mixed
{
    $enabledAt = $member->two_factor_email_enabled_at;

    User::query()->whereKey($member->id)->update(['two_factor_email_enabled_at' => null]);

    $page = p18fSignIn($member, $options, $width);

    User::query()->whereKey($member->id)->update(['two_factor_email_enabled_at' => $enabledAt]);

    $page->navigate($path);

    return $page->assertPathIs('/user/confirm-password')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs($landingPath ?? $path)
        ->assertPresent($marker);
}

it('renders the bell with the three kinds of notification without overflow', function () {
    $member = p18fMember();
    $team = $member->teams()->sole();
    $retro = Retro::query()->where('team_id', $team->id)->sole();

    $inviter = User::factory()->create(['name' => 'Camille Roux']);
    $invitation = WorkspaceInvitation::factory()->withToken('bell-token')->create([
        'workspace_id' => Workspace::factory()->withMember($inviter, WorkspaceRole::Admin)->create(['name' => 'Acme'])->id,
        'email' => $member->email,
        'invited_by_id' => $inviter->id,
    ]);
    $item = ActionItem::factory()->withoutRetro($team, $member)->assignedTo($member)->create([
        'content' => 'Document the on-call rotation',
        'due_on' => now()->subDays(2)->toDateString(),
    ]);

    $member->notify(new ActionItemReminderNotification($item->id, ActionItemReminderKind::Overdue, $team->workspace_id, now()->subDays(2)->toDateString()));
    $member->notify(new WorkspaceInvitationReceivedNotification($invitation->id, 'bell-token'));
    $member->notify(new RetroResultsNotification($retro->id));

    $this->captureVisuals(
        'bell-three-kinds',
        '/dashboard',
        fn (string $path, array $options, int $width) => p18fOpenBell(p18fSignIn($member, $options, $width))
            ->assertPresent('[data-slot="notification-item"]'),
    );
});

it('renders the empty bell without overflow', function () {
    $member = p18fMember();

    $this->captureVisuals(
        'bell-empty',
        '/dashboard',
        fn (string $path, array $options, int $width) => p18fOpenBell(p18fSignIn($member, $options, $width))
            ->assertPresent('[data-slot="notifications-empty"]'),
    );
});

it('renders the command palette without overflow', function (string $name, ?string $search, string $marker) {
    $member = p18fMember();

    $this->captureVisuals(
        $name,
        '/dashboard',
        function (string $path, array $options, int $width) use ($member, $search, $marker) {
            $page = p18fOpenPalette(p18fSignIn($member, $options, $width), $width);

            if ($search !== null) {
                $page->fill('[data-slot="command-input"]', $search);
            }

            return $page->assertPresent($marker)->assertNotPresent('[data-slot="command-loading"]');
        },
    );
})->with([
    'empty' => ['command-palette-empty', null, '[data-slot="command-group"]'],
    'results' => ['command-palette-results', 'Sprint', '[data-slot="command-item"] [data-slot="command-match"]'],
    'no result' => ['command-palette-no-result', 'zzzzqq', '[data-slot="command-empty"]'],
]);

it('renders the keyboard shortcuts dialog without overflow', function (string $name, ?string $search, string $marker) {
    $member = p18fMember();

    $this->captureVisuals(
        $name,
        '/dashboard',
        function (string $path, array $options, int $width) use ($member, $search, $marker) {
            $page = p18fSignIn($member, $options, $width)
                ->assertPresent('[data-test="command-menu-button"]');

            $page->keys('html > body', '?');
            $page->assertPresent('[data-slot="keyboard-shortcuts"] [data-slot="keyboard-shortcuts-body"]');

            if ($search !== null) {
                $page->fill('[data-slot="keyboard-shortcuts"] input', $search);
            }

            return $page->assertPresent($marker);
        },
    );
})->with([
    'default' => ['keyboard-shortcuts-dialog', null, '[data-slot="keyboard-shortcuts-row"]'],
    'filtered' => ['keyboard-shortcuts-dialog-filtered', 'k', '[data-slot="keyboard-shortcuts-row"]'],
    'no result' => ['keyboard-shortcuts-dialog-no-result', 'zzzzqq', '[data-slot="keyboard-shortcuts-empty"]'],
]);

it('renders the sign-in settings of the instance without overflow', function (string $name, bool $provider, bool $ableToRequire, bool $required, string $marker) {
    config(['app.key' => 'base64:'.base64_encode(str_repeat('v', 32))]);

    if ($provider) {
        p18fSingleSignOnConfigured();
    }

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $admin = User::factory()->instanceAdmin()->create([
        'id' => '0199a000-0000-7000-8000-000000000021',
        'name' => 'Fran Facilitator',
        'email' => 'fran@example.com',
    ]);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Member->value]);
    User::factory()->count(3)->create();

    if ($ableToRequire) {
        SocialAccount::factory()->for($admin)->create(['provider' => 'google']);
    }

    $this->captureVisuals(
        $name,
        '/admin/sign-in',
        function (string $path, array $options, int $width) use ($admin, $ableToRequire, $required, $marker) {
            $this->travel(1)->minutes();

            User::query()->whereKey($admin->id)->update(['two_factor_email_enabled_at' => null]);
            resolve(InstanceSettings::class)->set('sso_required', false);

            $page = p18fSignIn($admin, $options, $width);

            User::query()->whereKey($admin->id)->update(['two_factor_email_enabled_at' => $ableToRequire ? now() : null]);
            resolve(InstanceSettings::class)->set('sso_required', $required);

            $page->navigate($path);

            return $page->assertPathIs('/user/confirm-password')
                ->fill('#password', 'password')
                ->click('@confirm-password-button')
                ->assertPathIs($path)
                ->assertPresent("[data-slot=\"sign-in-settings-form\"] {$marker}");
        },
    );
})->with([
    'off' => ['admin-sign-in-off', true, true, false, '[data-slot="sign-in-way-back"]'],
    'blocked' => ['admin-sign-in-blocked', true, false, false, '[data-slot="sign-in-blockers"]'],
    'on' => ['admin-sign-in-on', true, true, true, '[data-slot="sign-in-way-back"]'],
    'stored but not in force' => ['admin-sign-in-not-in-force', false, false, true, '[data-slot="sign-in-not-in-force"]'],
]);

it('renders the recap unsubscribe page without overflow', function () {
    $member = User::factory()->create(['name' => 'Mona Member', 'email' => 'mona.member@example.com']);

    $this->captureVisuals(
        'recap-unsubscribe-page',
        "/recap-unsubscribe/{$member->id}",
        function (string $path, array $options) use ($member) {
            User::query()->whereKey($member->id)->update(['locale' => p18fLanguage($options)]);

            $origin = (string) visit('/login', $options)->script('() => location.origin');

            URL::forceRootUrl($origin);
            $signedUrl = URL::signedRoute('recapUnsubscribes.show', ['user' => $member->id]);
            URL::forceRootUrl(null);

            return visit(substr($signedUrl, strlen($origin)), $options)->assertPresent('[data-test="unsubscribe-button"]');
        },
    );
});
