<?php

use App\Support\Auth\LoginAddress;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Off, so that the accounts table is not locked while its rows are filled. The work can then
     * stop midway: up() adds only what is missing and can be run again.
     *
     * @var bool
     */
    public $withinTransaction = false;

    /**
     * The form an address is looked up by, stored so that every engine compares it the same way.
     * Not unique: accounts from before addresses were normalised may share a key.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'email_key')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->string('email_key')->nullable();
            });
        }

        DB::table('users')
            ->whereNull('email_key')
            ->select(['id', 'email'])
            ->lazyById(500)
            ->each(fn (object $user) => DB::table('users')->where('id', $user->id)->update(['email_key' => LoginAddress::normalise((string) $user->email)]));

        $hasIndex = Schema::hasIndex('users', ['email_key']);

        Schema::table('users', function (Blueprint $table) use ($hasIndex): void {
            $table->string('email_key')->nullable(false)->change();

            if (! $hasIndex) {
                $table->index('email_key');
            }
        });
    }
};
