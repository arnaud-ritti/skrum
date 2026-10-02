<?php

use App\Support\Auth\LoginAddress;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The form an address is looked up by, stored so that every engine compares it the same way.
     * Not unique: accounts from before addresses were normalised may share a key. Each step looks
     * at what is already there, so a run that stopped midway on an engine without transactional
     * DDL can be run again.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'email_key')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->string('email_key')->nullable();
            });
        }

        foreach (DB::table('users')->select(['id', 'email'])->lazyById(500) as $user) {
            DB::table('users')->where('id', $user->id)->update(['email_key' => LoginAddress::normalise((string) $user->email)]);
        }

        $hasIndex = Schema::hasIndex('users', ['email_key']);

        Schema::table('users', function (Blueprint $table) use ($hasIndex): void {
            $table->string('email_key')->nullable(false)->change();

            if (! $hasIndex) {
                $table->index('email_key');
            }
        });
    }
};
