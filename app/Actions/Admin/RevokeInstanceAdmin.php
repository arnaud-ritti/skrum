<?php

namespace App\Actions\Admin;

use App\Enums\AuditAction;
use App\Models\User;
use App\Support\Database\Transactions;
use Illuminate\Support\Facades\DB;

class RevokeInstanceAdmin
{
    public function __construct(private RecordAuditEvent $recordAuditEvent) {}

    /**
     * False when the user is the last active admin: the instance keeps them.
     *
     * Every admin row is locked before the count, so two revocations, or a revocation and a deactivation,
     * at the same time cannot both see a second active admin. A deactivated admin cannot sign in, so only
     * active admins count. The audit event is written only when the user was an admin and is one no more.
     */
    public function handle(User $user, ?User $actor = null): bool
    {
        return DB::transaction(function () use ($user, $actor): bool {
            $admins = User::query()
                ->where('is_instance_admin', true)
                ->orderBy('id')
                ->lockForUpdate()
                ->get(['id', 'deactivated_at']);

            $revokedAdmin = $admins->firstWhere('id', $user->id);

            if ($revokedAdmin === null) {
                return true;
            }

            $activeAdminCount = $admins->whereNull('deactivated_at')->count();

            if ($revokedAdmin->deactivated_at === null && $activeAdminCount === 1) {
                return false;
            }

            User::query()->whereKey($user->id)->update(['is_instance_admin' => false]);

            $this->recordAuditEvent->handle(AuditAction::AdminRevoked, $actor, $user);

            return true;
        }, Transactions::Attempts);
    }
}
