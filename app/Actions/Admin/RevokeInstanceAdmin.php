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
     * False when the user is the last admin: the instance keeps them.
     *
     * Every admin row is locked before the count, so two revocations at the same time cannot both see a second admin.
     * The audit event is written only when the user was an admin and is one no more.
     */
    public function handle(User $user, ?User $actor = null): bool
    {
        return DB::transaction(function () use ($user, $actor): bool {
            $adminIds = User::query()
                ->where('is_instance_admin', true)
                ->orderBy('id')
                ->lockForUpdate()
                ->pluck('id');

            if ($adminIds->doesntContain($user->id)) {
                return true;
            }

            if ($adminIds->count() === 1) {
                return false;
            }

            User::query()->whereKey($user->id)->update(['is_instance_admin' => false]);

            $this->recordAuditEvent->handle(AuditAction::AdminRevoked, $actor, $user);

            return true;
        }, Transactions::Attempts);
    }
}
