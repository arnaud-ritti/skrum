<?php

use App\Mail\WorkspaceInvitationMail;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationNotification;
use App\Support\Avatars\PresenceColor;
use App\Support\Mail\MailBrand;
use Illuminate\Notifications\AnonymousNotifiable;

function invitationNotification(string $workspace = 'Nordlys', string $inviter = 'Fran'): WorkspaceInvitationNotification
{
    return new WorkspaceInvitationNotification($workspace, $inviter, 'https://skrum.test/invitations/token', now()->addDays(7));
}

it('returns the branded mailable addressed to the invited person', function () {
    $mail = invitationNotification()->toMail((new AnonymousNotifiable)->route('mail', 'new@example.test'));

    expect($mail)->toBeInstanceOf(WorkspaceInvitationMail::class)
        ->and($mail->hasTo('new@example.test'))->toBeTrue()
        ->and($mail->subject)->toBe('Fran invited you to join Nordlys');
});

it('escapes user text in the html part and keeps it literal in the text part', function () {
    $mail = invitationNotification('<script>alert(1)</script>', '[y](https://evil.test)')->toMail(new User);
    $html = (string) $mail->render();

    expect($html)->not->toContain('<script>alert(1)</script>')
        ->not->toContain('href="https://evil.test"')
        ->toContain('&lt;script&gt;')
        ->toContain('href="https://skrum.test/invitations/token"');

    $mail->assertSeeInText('[y](https://evil.test)');
});

it('wears the colour the inviter chose', function () {
    $inviter = User::factory()->create();
    $chosen = PresenceColor::forSeed($inviter->avatarSeed()) % PresenceColor::Count + 1;
    $inviter->forceFill(['presence_color' => $chosen])->save();
    $invitation = WorkspaceInvitation::factory()->create(['invited_by_id' => $inviter->id]);

    $mail = (new WorkspaceInvitationNotification('Nordlys', 'Fran', 'https://skrum.test/invitations/token', now()->addDays(7), $invitation->id))->toMail(new User);

    expect($mail->inviterPresence)->toBe($chosen);
});

it('keeps the subject on one line', function () {
    expect(invitationNotification("Nord\r\nBcc: evil@example.test")->toMail(new User)->subject)->not->toContain("\n");
});

it('is written in the language given to the notification', function () {
    $html = (string) invitationNotification()->locale('fr')->toMail(new User)->locale('fr')->render();

    expect($html)->toContain('<html lang="fr"');
});

it('carries no unsubscribe header', function () {
    $mail = invitationNotification()->toMail(new User);

    $mail->assertHasSubject('Fran invited you to join Nordlys');
    expect(method_exists($mail, 'headers'))->toBeFalse();
});

it('previews the invitation', function () {
    $this->get('/dev/mail/invitation')->assertOk()->assertSee('Accept invitation');
});

it('quotes the message of a workspace invitation in both parts, line breaks kept', function () {
    $invitation = WorkspaceInvitation::factory()->withMessage("See you Thursday.\n<b>Bring</b> coffee.")->create();

    $mail = (new WorkspaceInvitationNotification('Nordlys', 'Fran', 'https://skrum.test/invitations/token', now()->addDays(7), $invitation->id))->toMail(new User);

    expect($mail->subject)->toBe('Fran invited you to join Nordlys')
        ->and((string) $mail->render())->toContain("“See you Thursday.\n&lt;b&gt;Bring&lt;/b&gt; coffee.”")
        ->toContain('white-space:pre-line');
    $mail->assertSeeInText("“See you Thursday.\n<b>Bring</b> coffee.”");
});

it('draws the team mark in the team colour with its initial and its member count', function () {
    $team = Team::factory()->create(['name' => 'atlas', 'color' => 'moss']);
    teamMember($team);
    $invitation = WorkspaceInvitation::factory()->forTeam($team)->create();

    $mail = (new WorkspaceInvitationNotification($team->workspace->name, 'Fran', 'https://skrum.test/invitations/token', now()->addDays(7), $invitation->id))->toMail(new User);
    $html = (string) $mail->render();

    expect($mail->teamColor)->toBe('moss')
        ->and($html)->toContain('background-color:'.MailBrand::Palette['light']['skrum-col-moss'])
        ->toContain('>A</td>')
        ->toContain('1 member</span>')
        ->toContain('.m-c-moss { background-color: '.MailBrand::Palette['dark']['skrum-col-moss']);
    $mail->assertSeeInText('atlas: '.$team->workspace->name.' workspace · 1 member');
});
