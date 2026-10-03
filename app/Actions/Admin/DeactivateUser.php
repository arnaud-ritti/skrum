<?php

namespace App\Actions\Admin;

use App\Enums\AuditAction;
use App\Models\User;
use App\Support\Database\Transactions;
use Illuminate\Support\Facades\DB;

class DeactivateUser
{
    public function __construct(private RecordAuditEvent $recordAuditEvent) {}

    /**
     * False when refused: an admin keeps their own account, and the instance keeps one active admin.
     *
     * Every active admin row is locked before the count, as RevokeInstanceAdmin does, so two
     * deactivations at the same time cannot both see a second active admin. The audit event is
     * written only when the account was active and is deactivated now.
     */
    public function handle(User $admin, User $user): bool
    {
        if ($admin->is($user)) {
            return false;
        }

        return DB::transaction(function () use ($admin, $user): bool {
            $activeAdminIds = User::query()
                ->where('is_instance_admin', true)
                ->whereNull('deactivated_at')
                ->orderBy('id')
                ->lockForUpdate()
                ->pluck('id');

            if ($activeAdminIds->contains($user->id) && $activeAdminIds->count() === 1) {
                return false;
            }

            $deactivated = User::query()
                ->whereKey($user->id)
                ->whereNull('deactivated_at')
                ->update(['deactivated_at' => now()]);

            if ($deactivated === 1) {
                $this->recordAuditEvent->handle(AuditAction::UserDeactivated, $admin, $user);
            }

            return true;
        }, Transactions::Attempts);
    }
}
