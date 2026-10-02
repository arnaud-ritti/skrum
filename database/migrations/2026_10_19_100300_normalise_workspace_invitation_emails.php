<?php

use App\Support\Auth\LoginAddress;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * An invitation is found by a plain equality on its address from now on: the rows written
     * before the model normalised it are brought to the same form.
     */
    public function up(): void
    {
        foreach (DB::table('workspace_invitations')->select(['id', 'email'])->lazyById(500) as $invitation) {
            $normalised = LoginAddress::normalise((string) $invitation->email);

            if ($normalised === $invitation->email) {
                continue;
            }

            DB::table('workspace_invitations')->where('id', $invitation->id)->update(['email' => $normalised]);
        }
    }
};
