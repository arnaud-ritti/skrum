<?php

namespace App\Actions\Admin;

use App\Enums\AuditAction;
use App\Models\User;
use App\Support\Database\Transactions;
use Illuminate\Support\Facades\DB;

class ReactivateUser
{
    public function __construct(private RecordAuditEvent $recordAuditEvent) {}

    /**
     * The audit event is written only when the account was deactivated and is active now.
     */
    public function handle(User $admin, User $user): void
    {
        DB::transaction(function () use ($admin, $user): void {
            $reactivated = User::query()
                ->whereKey($user->id)
                ->whereNotNull('deactivated_at')
                ->update(['deactivated_at' => null]);

            if ($reactivated === 1) {
                $this->recordAuditEvent->handle(AuditAction::UserReactivated, $admin, $user);
            }
        }, Transactions::Attempts);
    }
}
