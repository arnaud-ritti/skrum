<?php

use App\Actions\Auth\SendEmailTwoFactorCode;
use App\Actions\Integrations\BuildRetroRecap;
use App\Actions\Workspaces\CreateWorkspaceInvitation;
use App\Actions\Workspaces\InvitationTerms;
use App\Enums\ActionItemReminderKind;
use App\Enums\EmailCodePurpose;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Jobs\Auth\SendMagicLink;
use App\Mail\MagicLinkMail;
use App\Mail\TwoFactorCodeMail;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\ActionItemReminderDigestNotification;
use App\Notifications\RetroResultsNotification;
use App\Notifications\WorkspaceInvitationNotification;
use App\Support\Branding\BrandAssets;
use App\Support\Branding\BrandPalette;
use App\Support\InstanceSettings;
use App\Support\Integrations\Messages\RetroRecap;
use App\Support\Integrations\Messages\RetroRecapMail;
use App\Support\Mail\MailBrand;
use Illuminate\Http\UploadedFile;
use Illuminate\Mail\Mailable;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

const MockupFirefoxOnMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0';

beforeEach(function () {
    config([
        'app.name' => 'Skrüm',
        'mail.default' => 'smtp',
        'services.google.client_id' => null,
        'services.google.client_secret' => null,
        'services.github.client_id' => null,
        'services.github.client_secret' => null,
        'skrum.signup_mode' => 'open',
    ]);
    Storage::fake('local');
});

function mockupPng(int $width, int $height = 56): string
{
    ob_start();
    imagepng(imagecreatetruecolor($width, $height));

    return (string) ob_get_clean();
}

function mockupMagicLinkMail(): MagicLinkMail
{
    Mail::fake();
    $user = User::query()->firstWhere('email', 'arnaud@nordlys.io') ?? User::factory()->create(['email' => 'arnaud@nordlys.io']);
    $sent = null;

    dispatch_sync(new SendMagicLink($user->email));

    Mail::assertSent(MagicLinkMail::class, function (MagicLinkMail $mail) use (&$sent): bool {
        $sent = $mail;

        return true;
    });

    return $sent;
}

function mockupCodeMail(): TwoFactorCodeMail
{
    Mail::fake();
    test()->travelTo('2026-10-01 14:02:00');
    $sent = null;

    resolve(SendEmailTwoFactorCode::class)->handle(User::factory()->create(), EmailCodePurpose::Login, MockupFirefoxOnMac);

    Mail::assertQueued(TwoFactorCodeMail::class, function (TwoFactorCodeMail $mail) use (&$sent): bool {
        $sent = $mail;

        return true;
    });

    return new TwoFactorCodeMail('042917', $sent->expiresInMinutes, $sent->device, $sent->requestedAt);
}

function mockupInvitationMail(): Mailable
{
    $inviter = User::factory()->create(['name' => 'Camille Roux']);
    $workspace = Workspace::factory()->withMember($inviter, WorkspaceRole::Admin)->create(['name' => 'Atlas']);
    $workspace->members()->attach(User::factory()->count(10)->create(), ['role' => WorkspaceRole::Member->value]);
    Team::factory()->count(2)->create(['workspace_id' => $workspace->id]);
    $issued = resolve(CreateWorkspaceInvitation::class)->handle($workspace, $inviter, new InvitationTerms('new@example.test', WorkspaceRole::Member));

    return new WorkspaceInvitationNotification($workspace->name, $inviter->name, 'https://skrum.test/invitations/token', $issued->invitation->expires_at, $issued->invitation->id)
        ->toMail((new AnonymousNotifiable)->route('mail', 'new@example.test'));
}

function mockupReminderMail(): Mailable
{
    test()->travelTo('2026-10-01 09:00:00');
    $team = Team::factory()->create(['name' => 'Atlas']);
    $user = teamMember($team);
    $linked = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Quarantine the flaky E2E tests', 'due_on' => '2026-09-26']);
    $plain = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Book a session with the design team', 'due_on' => '2026-09-30']);
    ActionItemExternalLink::factory()->create(['action_item_id' => $linked->id, 'external_key' => 'ATLAS-1302']);

    return new ActionItemReminderDigestNotification(array_map(
        fn (ActionItem $item): array => ['actionItemId' => $item->id, 'kind' => ActionItemReminderKind::Overdue->value],
        [$linked, $plain],
    ))->toMail($user);
}

/**
 * @param  array<int, int>  $rotiScores
 */
function mockupRecapMail(array $rotiScores = [2, 3, 3, 4, 4, 4, 4, 5, 5], bool $anonymous = false): Mailable
{
    $team = Team::factory()->create(['name' => 'Atlas']);
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create([
        'team_id' => $team->id,
        'title' => 'Sprint 42',
        'is_anonymous' => $anonymous,
        'completed_at' => '2025-10-02 10:00:00',
    ]);
    [$facilitator, $facilitating] = retroFacilitator($retro);
    $facilitator->forceFill(['name' => 'Camille Roux'])->save();
    $participants = Participant::factory()->count(8)->create(['retro_id' => $retro->id])->prepend($facilitating)->values();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    Card::factory()->count(34)->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $facilitating->id]);
    $lucas = User::factory()->create(['name' => 'Lucas D']);
    ActionItem::factory()->assignedTo($lucas)->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $facilitating->id,
        'content' => 'Quarantine the flaky E2E tests',
        'due_on' => '2025-10-09',
    ]);
    ActionItem::factory()->count(3)->create(['retro_id' => $retro->id, 'created_by_participant_id' => $facilitating->id]);

    foreach ($rotiScores as $index => $score) {
        RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participants[$index]->id, 'score' => $score]);
    }

    return new RetroResultsNotification($retro->id)->toMail($facilitator);
}

/**
 * @return array<string, Closure(): Mailable>
 */
function mockupMails(): array
{
    return [
        'magic link' => mockupMagicLinkMail(...),
        'invitation' => mockupInvitationMail(...),
        'reminder' => mockupReminderMail(...),
        'recap' => mockupRecapMail(...),
        'code' => mockupCodeMail(...),
    ];
}

it('shows the Skrüm PNG logo, in both themes, with the display name as alt', function () {
    $html = (string) mockupMagicLinkMail()->render();

    expect($html)
        ->toMatch('/<img class="m-logo-light" src="[^"]*brand\/skrum-logo-mail-light\.png" alt="Skrüm" width="'.MailBrand::DefaultLogoWidth.'" height="28"/')
        ->toMatch('/<div class="m-logo-dark"[^>]*display:none[^>]*><img src="[^"]*brand\/skrum-logo-mail-dark\.png" alt="Skrüm"/')
        ->toContain('.m-logo-dark { display: block !important;')
        ->toContain('.m-logo-light { display: none !important; }')
        ->not->toContain('.svg')
        ->and(getimagesize(public_path('brand/skrum-logo-mail-light.png')))->toMatchArray([MailBrand::DefaultLogoWidth * 2, 56])
        ->and(getimagesize(public_path('brand/skrum-logo-mail-dark.png')))->toMatchArray([MailBrand::DefaultLogoWidth * 2, 56]);
});

it('shows the mail logo of the instance, then its PNG or JPEG logo, then the name as text', function () {
    $assets = resolve(BrandAssets::class);
    $render = fn (): string => (string) new MagicLinkMail('https://skrum.test/magic-link/token', 'ada@example.test', 15)->render();

    resolve(InstanceSettings::class)->set('display_name', 'Atlas Corp Retro');

    expect($render())->not->toContain('<img')
        ->not->toContain('skrum-logo-mail')
        ->toContain('Atlas Corp Retro</p>');

    $assets->store('logo-light', UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>'));

    expect($render())->not->toContain('<img')->toContain('Atlas Corp Retro</p>');

    $assets->store('logo-light', UploadedFile::fake()->createWithContent('logo.png', mockupPng(200, 50)));

    expect($render())->toContain('src="'.url($assets->url('logo-light')).'" alt="Atlas Corp Retro" width="112" height="28"')
        ->not->toContain('m-logo-dark"');

    $assets->store('logo-dark', UploadedFile::fake()->createWithContent('logo.png', mockupPng(100, 50)));

    expect($render())->toContain('<img src="'.url($assets->url('logo-dark')).'" alt="Atlas Corp Retro" width="56" height="28"')
        ->toContain('src="'.url($assets->url('logo-light')).'" alt="Atlas Corp Retro" width="112" height="28"');

    $assets->store('logo-mail', UploadedFile::fake()->createWithContent('logo.png', mockupPng(256)));

    expect($render())->toContain('src="'.url($assets->url('logo-mail')).'" alt="Atlas Corp Retro" width="128" height="28"')
        ->not->toContain(url($assets->url('logo-light')))
        ->not->toContain('skrum-logo-mail');
});

it('ends every mail with the reason, the instance and the credit', function (string $mail, ?string $reason) {
    $html = (string) mockupMails()[$mail]()->render();
    $footer = substr($html, (int) strrpos($html, '</h1>'));

    expect($footer)->toContain('Skrüm · '.parse_url(url('/'), PHP_URL_HOST).'</p>')
        ->toContain('Powered by Skrüm');

    $reason === null
        ? expect($footer)->not->toContain('You get this')
        : expect($footer)->toContain($reason);

    resolve(InstanceSettings::class)->set('powered_by', false);

    expect((string) mockupMails()[$mail]()->render())->not->toContain('Powered by Skrüm');
})->with([
    ['magic link', 'You get this email because you have an account on this instance.'],
    ['invitation', null],
    ['reminder', 'You get this reminder because action items are assigned to you.'],
    ['recap', 'You get this summary because you took part in this retro or belong to its team.'],
    ['code', 'You get this email because you have an account on this instance.'],
]);

it('writes the magic link mail as the mockup', function () {
    $mail = mockupMagicLinkMail();
    $html = (string) $mail->render();

    $mail->assertHasSubject('Your sign-in link for Skrüm');

    expect($html)
        ->toContain('overflow:hidden;">Valid for 15 minutes, works once.</div>')
        ->toContain('<title>Your sign-in link for Skrüm</title>')
        ->toContain('>Sign in to Skrüm</h1>')
        ->toContain('Use the button below to sign in as <strong>arnaud@nordlys.io</strong>. The link works once and expires in 15 minutes.')
        ->toContain('Button not working? Paste this link into your browser:')
        ->toContain(e("Didn't ask for this? Ignore this email — nobody can sign in without the link."))
        ->and(substr_count($html, '<h1'))->toBe(1);

    $mail->assertSeeInText('Button not working? Paste this link into your browser:');
});

it('writes the invitation mail as the mockup', function () {
    $mail = mockupInvitationMail();
    $html = (string) $mail->render();

    $mail->assertHasSubject('Camille Roux invited you to join Atlas');

    preg_match('/<td class="m-p(\d+)"[^>]*background-color:(#[0-9a-f]{6});color:(#[0-9a-f]{6});[^>]*>CR<\/td>/', $html, $avatar);

    expect($avatar)->toHaveCount(4)
        ->and($avatar[2])->toBe(MailBrand::Palette['light']["skrum-presence-{$avatar[1]}"])
        ->and($avatar[3])->toBe(MailBrand::Palette['light']["skrum-presence-{$avatar[1]}-foreground"])
        ->and((int) $avatar[1])->toBeBetween(1, 12)
        ->and($html)->toContain('>Camille Roux invited you to join the Atlas workspace</h1>')
        ->toContain('>Atlas</strong>')
        ->toContain('>2 teams · 11 members</span>')
        ->toContain('Atlas runs its retros, planning poker and icebreakers on Skrüm.')
        ->toContain('>Accept invitation</a>')
        ->toContain(e("The invitation is valid for 7 days. Don't know Camille? Just ignore this email."))
        ->not->toContain('List-Unsubscribe')
        ->and(method_exists($mail, 'headers'))->toBeFalse();
});

it('counts one team and one member in the singular', function () {
    $inviter = User::factory()->create();
    $workspace = Workspace::factory()->withMember($inviter, WorkspaceRole::Admin)->create();
    Team::factory()->create(['workspace_id' => $workspace->id]);
    $issued = resolve(CreateWorkspaceInvitation::class)->handle($workspace, $inviter, new InvitationTerms('new@example.test', WorkspaceRole::Member));

    $html = (string) new WorkspaceInvitationNotification($workspace->name, $inviter->name, 'https://skrum.test/invitations/token', $issued->invitation->expires_at, $issued->invitation->id)
        ->toMail(new AnonymousNotifiable)
        ->render();

    expect($html)->toContain('>1 team · 1 member</span>');
});

it('adapts the join sentence to what the instance offers', function (bool $hasProvider, bool $ssoRequired, string $sentence) {
    if ($hasProvider) {
        config(['services.google.client_id' => 'google-id', 'services.google.client_secret' => 'google-secret']);
    }

    resolve(InstanceSettings::class)->set('sso_required', $ssoRequired);

    $html = (string) mockupInvitationMail()->render();

    expect($html)->toContain("on Skrüm. {$sentence}</p>");
})->with([
    'provider and registration' => [true, false, 'Join with your company SSO or create an account in a minute.'],
    'single sign-on required' => [true, true, 'Join with your company SSO.'],
    'no provider' => [false, false, 'Create an account in a minute.'],
]);

it('writes the reminder rows as the mockup', function () {
    $mail = mockupReminderMail();
    $html = (string) $mail->render();
    $late = MailBrand::Palette['light']['skrum-destructive-text'];

    $mail->assertHasSubject('2 action items are overdue');

    expect($html)
        ->toContain('>2 action items are overdue</h1>')
        ->toContain('Agreed by your team in retro. Mark them done, change the due date, or hand them over.')
        ->toMatch('/<a class="m-text" href="[^"]+"[^>]*>Quarantine the flaky E2E tests<\/a>/')
        ->toMatch('/<span class="m-danger" style="[^"]*color:'.$late.';">Atlas · due 26 Sep · 5 days late<\/span>/')
        ->toMatch('/<span class="m-danger" style="[^"]*color:'.$late.';">Atlas · due 30 Sep · 1 day late<\/span>/')
        ->toMatch('/font-family:\'JetBrains Mono\'[^>]*>ATLAS-1302<\/td>/')
        ->toContain('>Open my action items</a>')
        ->toMatch('/>Manage notifications<\/a> · <a [^>]*>Unsubscribe from reminders<\/a>/')
        ->and(substr_count($html, "font-family:'JetBrains Mono'"))->toBe(1);
});

it('writes the due-soon rows in the same style without a delay', function () {
    $this->travelTo('2026-10-01 09:00:00');
    $team = Team::factory()->create(['name' => 'Atlas']);
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create(['due_on' => '2026-10-02']);

    $html = (string) new ActionItemReminderDigestNotification([['actionItemId' => $item->id, 'kind' => ActionItemReminderKind::DueSoon->value]])
        ->toMail($user)
        ->render();

    expect($html)->toContain('>Atlas · due 2 Oct</span>')->not->toContain('late');
});

it('writes the recap as the mockup', function () {
    $mail = mockupRecapMail();
    $html = (string) $mail->render();
    $palette = MailBrand::Palette['light'];

    $mail->assertHasSubject('Sprint 42 · Atlas — 4 actions, ROTI 3.8');

    expect($html)
        ->toContain('overflow:hidden;">9 participants, 34 cards, facilitated by Camille Roux.</div>')
        ->toContain('>Sprint 42 is done</h1>')
        ->toContain('Facilitated by Camille Roux on Thursday 2 October. Here is what the team decided.')
        ->toMatch('/>LD<\/td>.*?<strong[^>]*>Quarantine the flaky E2E tests<\/strong><br>\s*<span[^>]*>Lucas D · due 9 Oct<\/span>/s')
        ->toContain('>Return on time invested · 9 votes</p>')
        ->toContain('>Open the full summary</a>');

    foreach ([['9', 'Participants'], ['34', 'Cards'], ['4', 'Actions'], ['3.8', 'ROTI /5']] as [$value, $label]) {
        expect($html)->toMatch('/>'.preg_quote($value, '/').'<\/span>\s*<span[^>]*>'.preg_quote($label, '/').'<\/span>/');
    }

    foreach ([1 => [0, null], 2 => [1, 25], 3 => [2, 50], 4 => [4, 100], 5 => [2, 50]] as $score => [$count, $width]) {
        $row = '/background-color:'.$palette["skrum-roti-{$score}"].';color:'.$palette['skrum-roti-foreground'].';[^>]*>'.$score.'<\/td>.*?'
            .($width === null ? '' : 'width="'.$width.'%"[^>]*><tr><td class="m-r'.$score.'"[^>]*background-color:'.$palette["skrum-roti-{$score}"].';.*?')
            .'text-align:right;[^>]*>'.$count.'<\/td>/s';

        expect($html)->toMatch($row);
    }

    expect(substr_count($html, 'width="0%"'))->toBe(0);
});

it('hides the ROTI stat and bars under three votes, and the facilitator on an anonymous retro', function () {
    $mail = mockupRecapMail(rotiScores: [4, 5], anonymous: true);
    $html = (string) $mail->render();

    $mail->assertHasSubject('Sprint 42 · Atlas — 4 actions');

    expect($html)
        ->not->toContain('ROTI /5')
        ->not->toContain('Return on time invested')
        ->not->toContain('skrum-roti')
        ->not->toContain('Facilitated by')
        ->not->toContain('facilitated by')
        ->toContain('Completed on Thursday 2 October. Here is what the team decided.')
        ->toContain('overflow:hidden;">9 participants, 34 cards.</div>')
        ->and(substr_count($html, 'width="33%"'))->toBe(3)
        ->and(resolve(BuildRetroRecap::class)->handle(Retro::query()->sole())->rotiCounts)->toBeNull();
});

it('keeps the product content the mockup does not show', function () {
    $recap = new RetroRecap(
        title: 'Sprint 42',
        teamName: 'Atlas',
        completedOn: 'October 2, 2025',
        url: 'https://skrum.test/retros/1',
        participantCount: 9,
        participantNames: null,
        cardCount: 34,
        rotiAverage: null,
        rotiRespondents: 0,
        summary: "The sprint went well.\n\nReviews were slow.",
        actionItems: [['content' => 'Ship <b>it</b>', 'assignee' => null, 'dueOn' => null, 'isCompleted' => true]],
        hiddenActionItems: 2,
        suggestedActions: ['Pair on reviews'],
        hiddenSuggestedActions: 0,
        topCards: [['column' => 'Went well', 'content' => 'Good demo', 'votes' => 3, 'groupedCount' => 0]],
    );

    $mail = resolve(RetroRecapMail::class)->build($recap, ['score' => 3.8, 'participation' => ['respondents' => 6, 'participants' => 9]]);
    $html = (string) $mail->render();
    $positionOf = fn (string $text): int => (int) strpos($html, $text);

    $mail->assertHasSubject('Sprint 42 · Atlas — 3 actions');

    expect($html)
        ->toContain('>The sprint went well.</p>')
        ->toContain('>Reviews were slow.</p>')
        ->toContain('>Pair on reviews</td>')
        ->toContain('Went well — Good demo (votes: 3)')
        ->toContain('Health check: 3.8/5 (6 of 9 participants answered)')
        ->toContain('✓ Ship &lt;b&gt;it&lt;/b&gt;')
        ->toContain('>Unassigned</span>')
        ->toContain('+ 2 more')
        ->and($positionOf('>Actions</span>'))->toBeLessThan($positionOf('>Summary</p>'))
        ->and($positionOf('>Summary</p>'))->toBeLessThan($positionOf('>Suggested actions</p>'))
        ->and($positionOf('Health check:'))->toBeLessThan($positionOf('>Open the full summary</a>'));
});

it('writes the code mail as the mockup', function () {
    $mail = mockupCodeMail();
    $html = (string) $mail->render();

    $mail->assertHasSubject('Your Skrüm verification code: 042 917');

    expect($html)
        ->toContain('>Your verification code</h1>')
        ->toContain('aria-label="0 4 2 9 1 7"')
        ->toContain('>042&nbsp;917</p>')
        ->toContain('>Requested from Firefox on macOS · 1 Oct, 2:02 pm (UTC)</p>')
        ->toMatch('/Not you\? Someone has your password: <a [^>]*href="'.preg_quote(route('security.edit'), '/').'"[^>]*>change it now<\/a>\. They can&#039;t sign in without this code\./')
        ->not->toContain('Strasbourg')
        ->not->toContain('France')
        ->not->toContain('127.0.0.1')
        ->and(method_exists($mail, 'headers'))->toBeFalse();
});

it('says when the code was requested even without a known browser', function () {
    $html = (string) new TwoFactorCodeMail('042917', 10, null, '1 Oct, 2:02 pm (UTC)')->render();

    expect($html)->toContain('>Requested on 1 Oct, 2:02 pm (UTC)</p>');
});

it('puts the address where each language puts it in the magic link mail', function (string $locale, string $html, string $text) {
    app()->setLocale($locale);

    $mail = mockupMagicLinkMail()->locale($locale);

    expect((string) $mail->render())->toContain($html);
    $mail->assertSeeInText($text);
})->with([
    ['en', 'Use the button below to sign in as <strong>arnaud@nordlys.io</strong>.', 'Use the button below to sign in as arnaud@nordlys.io.'],
    ['de', 'Melde dich über die Schaltfläche unten als <strong>arnaud@nordlys.io</strong> an.', 'Melde dich über die Schaltfläche unten als arnaud@nordlys.io an.'],
]);

it('writes every mail in French with the informal address', function (string $mail, ?string $subject, array $sentences) {
    app()->setLocale('fr');

    $mailable = mockupMails()[$mail]()->locale('fr');
    $html = (string) $mailable->render();

    if ($subject !== null) {
        $mailable->assertHasSubject($subject);
    }

    foreach ($sentences as $sentence) {
        expect($html)->toContain(e($sentence));
    }

    expect($html)->toContain('<html lang="fr"');
})->with([
    ['magic link', 'Ton lien de connexion à Skrüm', [
        'Utilise le bouton ci-dessous pour te connecter en tant que',
        'Le bouton ne fonctionne pas ? Colle ce lien dans ton navigateur :',
        "Tu n'as rien demandé ? Ignore cet e-mail : personne ne peut se connecter sans ce lien.",
        'Tu reçois cet e-mail car tu as un compte sur cette instance.',
    ]],
    ['invitation', "Camille Roux t'invite à rejoindre Atlas", [
        "Camille Roux t'invite à rejoindre l'espace Atlas",
        '2 équipes · 11 membres',
        'Atlas fait ses rétros, son planning poker et ses icebreakers sur Skrüm.',
        "L'invitation est valable 7 jours. Tu ne connais pas Camille ? Ignore simplement cet e-mail.",
    ]],
    ['reminder', '2 actions sont en retard', [
        "Décidées par ton équipe en rétro. Marque-les terminées, change l'échéance ou confie-les à quelqu'un.",
        'Atlas · échéance 26 sept. · 5 jours de retard',
        'Atlas · échéance 30 sept. · 1 jour de retard',
        'Ouvrir mes actions',
        'Gérer mes notifications',
    ]],
    ['recap', 'Sprint 42 · Atlas — 4 actions, ROTI 3,8', [
        'Sprint 42 est terminée',
        "Facilitée par Camille Roux le jeudi 2 octobre. Voici ce que l'équipe a décidé.",
        'Lucas D · échéance 9 oct.',
        'Retour sur le temps investi · 9 votes',
        'Ouvrir le compte rendu complet',
    ]],
    ['code', null, [
        'Ton code de vérification',
        'Demandé depuis Firefox sur macOS · 1 oct., 14:02 (UTC)',
        "Ce n'est pas toi ? Quelqu'un connaît ton mot de passe :",
        'change-le maintenant',
        'Sans ce code, il ne peut pas se connecter.',
    ]],
]);

it('stays within the hex table', function (string $mail, ?string $brandColor) {
    if ($brandColor !== null) {
        resolve(InstanceSettings::class)->set('brand_color', $brandColor);
    }

    $html = (string) mockupMails()[$mail]()->render();
    $allowed = collect([
        ...array_values(MailBrand::Palette['light']),
        ...array_values(MailBrand::Palette['dark']),
        ...($brandColor === null ? [] : array_values(BrandPalette::derive($brandColor)->toHex()['light'])),
        ...($brandColor === null ? [] : array_values(BrandPalette::derive($brandColor)->toHex()['dark'])),
    ]);

    preg_match_all('/#[0-9a-fA-F]{3,8}\b(?!;)/', $html, $colours);

    expect($html)->not->toMatch('/var\(|oklch|color-mix|rgb\(|hsl\(|calc\(/')
        ->and(count($colours[0]))->toBeGreaterThan(20)
        ->and(collect($colours[0])->unique()->reject(fn (string $colour): bool => $allowed->contains($colour))->values()->all())->toBeEmpty();
})->with(['magic link', 'invitation', 'reminder', 'recap', 'code'])->with([null, '#2B63B0']);

it('escapes user text in the blocks of the mockup', function () {
    $inviter = User::factory()->create(['name' => '<i>Eve</i> [y](https://evil.test)']);
    $workspace = Workspace::factory()->withMember($inviter, WorkspaceRole::Admin)->create(['name' => "<script>alert(1)</script>\nBcc: evil@example.test"]);
    $issued = resolve(CreateWorkspaceInvitation::class)->handle($workspace, $inviter, new InvitationTerms('new@example.test', WorkspaceRole::Member));

    $mail = new WorkspaceInvitationNotification($workspace->name, $inviter->name, 'https://skrum.test/invitations/token', $issued->invitation->expires_at, $issued->invitation->id)
        ->toMail(new AnonymousNotifiable);
    $html = (string) $mail->render();

    expect($html)->not->toContain('<script>alert(1)</script>')
        ->not->toContain('<i>Eve</i>')
        ->not->toContain('href="https://evil.test"')
        ->toContain('&lt;script&gt;alert(1)&lt;/script&gt; Bcc: evil@example.test</strong>')
        ->and($mail->subject)->not->toContain("\n");
});
