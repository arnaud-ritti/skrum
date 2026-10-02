<?php

use App\Support\Auth\LoginAddress;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Addresses that several accounts share once normalised are left as
     * stored: `users:report-duplicate-emails` lists them for an operator.
     */
    public function up(): void
    {
        $idsByAddress = [];

        foreach (DB::table('users')->select(['id', 'email'])->orderBy('id')->lazy() as $user) {
            $idsByAddress[LoginAddress::normalise($user->email)][$user->id] = $user->email;
        }

        foreach ($idsByAddress as $address => $storedById) {
            if (count($storedById) > 1) {
                continue;
            }

            $stored = reset($storedById);

            if ($stored === $address) {
                continue;
            }

            DB::table('users')->where('id', key($storedById))->where('email', $stored)->update(['email' => $address]);
        }
    }
};
