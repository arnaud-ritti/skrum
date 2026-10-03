<?php

namespace App\Listeners;

use App\Actions\Admin\RecordAuditEvent;
use App\Enums\AuditAction;
use App\Models\User;
use Illuminate\Auth\Events\Login;

class RecordSignInListener
{
    public function __construct(private RecordAuditEvent $recordAuditEvent) {}

    public function handle(Login $event): void
    {
        if (! $event->user instanceof User) {
            return;
        }

        $this->recordAuditEvent->handle(AuditAction::SignedIn, $event->user, $event->user, ['guard' => $event->guard]);
    }
}
