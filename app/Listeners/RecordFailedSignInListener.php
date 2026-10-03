<?php

namespace App\Listeners;

use App\Actions\Admin\RecordAuditEvent;
use App\Enums\AuditAction;
use App\Models\User;
use App\Support\Auth\LoginAddress;
use Illuminate\Auth\Events\Failed;

class RecordFailedSignInListener
{
    public function __construct(private RecordAuditEvent $recordAuditEvent) {}

    public function handle(Failed $event): void
    {
        $address = $event->credentials['email'] ?? null;

        $this->recordAuditEvent->handle(
            AuditAction::SignInFailed,
            null,
            $event->user instanceof User ? $event->user : null,
            is_string($address) ? ['email' => LoginAddress::normalise($address)] : [],
        );
    }
}
