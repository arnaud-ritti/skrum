<?php

namespace App\Actions\Admin;

use App\Enums\AuditAction;
use App\Mail\InstanceTestMail;
use App\Models\User;
use App\Support\InstanceSettings;
use App\Support\Mail\MailBrand;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Throwable;

/**
 * Sends the test e-mail now, through the mail configuration in force for this request (saved values
 * included), and keeps the result as the section's last test. The server's own answer is never kept
 * or shown: a failure is a code the page turns into a sentence. A mailer that does not deliver
 * (log, array) sends nothing, so its test is kept as a failure rather than a false success.
 */
class SendInstanceTestMail
{
    public function __construct(
        private InstanceSettings $settings,
        private RecordAuditEvent $recordAuditEvent,
    ) {}

    /**
     * @return array{
     *     ok: bool,
     *     error: ?string
     * }
     */
    public function handle(User $admin, string $to): array
    {
        $error = $this->send($to);
        $ok = $error === null;

        $this->settings->set('mail_last_test', [
            'at' => now()->toIso8601String(),
            'ok' => $ok,
            'to' => $to,
            'error' => $error,
        ]);

        $this->recordAuditEvent->handle(AuditAction::MailTested, $admin, null, ['ok' => $ok]);

        return ['ok' => $ok, 'error' => $error];
    }

    private function send(string $to): ?string
    {
        if (! PresentMailSettings::delivering()) {
            return 'log';
        }

        try {
            Mail::to($to)->send(new InstanceTestMail(resolve(MailBrand::class)->name()));
        } catch (TransportExceptionInterface) {
            return 'transport';
        } catch (Throwable $exception) {
            report($exception);

            return 'unknown';
        }

        return null;
    }
}
