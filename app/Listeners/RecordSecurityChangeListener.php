<?php

namespace App\Listeners;

use App\Actions\Admin\RecordAuditEvent;
use App\Enums\AuditAction;
use App\Enums\SecondFactorMethod;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Laravel\Fortify\Events\TwoFactorAuthenticationConfirmed;
use Laravel\Fortify\Events\TwoFactorAuthenticationDisabled;

class RecordSecurityChangeListener
{
    public function __construct(private RecordAuditEvent $recordAuditEvent) {}

    public function handle(TwoFactorAuthenticationConfirmed|TwoFactorAuthenticationDisabled|PasswordReset $event): void
    {
        match (true) {
            $event instanceof TwoFactorAuthenticationConfirmed => $this->record(AuditAction::TwoFactorEnabled, $event->user, ['method' => SecondFactorMethod::Totp->value]),
            $event instanceof TwoFactorAuthenticationDisabled => $this->record(AuditAction::TwoFactorDisabled, $event->user, ['method' => SecondFactorMethod::Totp->value]),
            $event instanceof PasswordReset => $this->record(AuditAction::PasswordChanged, $event->user, ['via' => 'reset']),
        };
    }

    /**
     * @param  array<string, mixed>  $properties
     */
    private function record(AuditAction $action, mixed $user, array $properties = []): void
    {
        if (! $user instanceof User) {
            return;
        }

        $this->recordAuditEvent->handle($action, $user, $user, $properties);
    }
}
