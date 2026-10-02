<?php

use App\Mail\WorkspaceInvitationMail;
use App\Models\User;
use App\Notifications\WorkspaceInvitationNotification;
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
