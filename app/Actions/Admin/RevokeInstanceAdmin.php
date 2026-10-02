<?php

namespace App\Actions\Admin;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class RevokeInstanceAdmin
{
    /**
     * False when the user is the last admin: the instance keeps them.
     *
     * Every admin row is locked before the count, so two revocations at the same time cannot both see a second admin.
     */
    public function handle(User $user): bool
    {
        return DB::transaction(function () use ($user): bool {
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

            return true;
        });
    }
}
