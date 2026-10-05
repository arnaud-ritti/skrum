<?php

use App\Jobs\Auth\SendPasswordResetLink;
use App\Models\User;
use App\Support\InstanceSettings;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Mail\MailManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;

function queueMailThatCannotBeSent(): void
{
    Mail::swap(new MailManager(app()));
    Mail::extend('failing', fn (): AbstractTransport => new class extends AbstractTransport
    {
        protected function doSend(SentMessage $message): void
        {
            throw new TransportException('The mail server is down.');
        }

        public function __toString(): string
        {
            return 'failing://';
        }
    });

    config(['queue.default' => 'database', 'mail.default' => 'failing', 'mail.mailers.failing' => ['transport' => 'failing']]);
}

/**
 * Read at once: the session store is shared by the requests of a test.
 *
 * @return array{int, ?string, mixed, bool}
 */
function resetRequestAnswer(string $email): array
{
    $response = test()->from(route('password.request'))->post(route('password.email'), ['email' => $email]);

    if ($response->getStatusCode() >= 500) {
        return [$response->getStatusCode(), null, null, false];
    }

    return [
        $response->getStatusCode(),
        $response->headers->get('Location'),
        session('status'),
        session()->has('errors'),
    ];
}

it('answers a known and an unknown address the same, even when the mail transport fails', function () {
    $user = User::factory()->create();
    queueMailThatCannotBeSent();

    $forKnown = resetRequestAnswer($user->email);
    $forUnknown = resetRequestAnswer('nobody@example.test');

    expect($forKnown)->toBe([302, route('password.request'), __('passwords.sent'), false])
        ->and($forUnknown)->toBe($forKnown);

    $this->artisan('queue:work', ['connection' => 'database', '--stop-when-empty' => true, '--tries' => 1])->assertSuccessful();

    expect(DB::table('failed_jobs')->count())->toBe(1)
        ->and(DB::table('failed_jobs')->value('exception'))->toContain('The mail server is down.');
});

it('answers a second request for the same address like the first', function () {
    $user = User::factory()->create();
    Notification::fake();

    $first = resetRequestAnswer($user->email);
    $second = resetRequestAnswer($user->email);

    expect($first)->toBe([302, route('password.request'), __('passwords.sent'), false])
        ->and($second)->toBe($first);
    Notification::assertSentToTimes($user, ResetPassword::class, 1);
});

it('answers an instance admin and a member the same while single sign-on is required, even when the mail transport fails', function () {
    config(['services.google.client_id' => 'google-id', 'services.google.client_secret' => 'google-secret']);
    resolve(InstanceSettings::class)->set('sso_required', true);
    $member = User::factory()->create();
    $admin = User::factory()->instanceAdmin()->create();
    queueMailThatCannotBeSent();

    $forMember = resetRequestAnswer($member->email);
    $forAdmin = resetRequestAnswer($admin->email);

    expect($forAdmin)->toBe([302, route('password.request'), __('passwords.sent'), false])
        ->and($forMember)->toBe($forAdmin)
        ->and(DB::table('jobs')->count())->toBe(2);
});

it('keeps the reset token out of the readable queue payload', function () {
    $user = User::factory()->create();
    config(['queue.default' => 'database']);

    $user->sendPasswordResetNotification('plain-reset-token');

    expect(new SendPasswordResetLink($user->id, 'plain-reset-token'))->toBeInstanceOf(ShouldBeEncrypted::class)
        ->and(DB::table('jobs')->sole()->payload)->not->toContain('plain-reset-token');
});

it('limits reset requests to ten a minute for one address of origin', function () {
    foreach (range(1, 10) as $attempt) {
        $this->from(route('password.request'))->post(route('password.email'), ['email' => "nobody{$attempt}@example.test"])
            ->assertSessionHasNoErrors();
    }

    $this->from(route('password.request'))->post(route('password.email'), ['email' => 'nobody@example.test'])
        ->assertRedirect(route('password.request'))
        ->assertSessionHasErrors(['email' => 'Too many attempts. Wait a minute and try again.']);
});
