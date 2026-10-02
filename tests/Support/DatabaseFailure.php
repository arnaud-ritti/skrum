<?php

namespace Tests\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DatabaseFailure
{
    /**
     * A statement every engine refuses: a user without its required columns.
     * On PostgreSQL it also aborts the open transaction, which is what the callers test.
     */
    public static function provoke(): void
    {
        DB::table('users')->insert(['id' => (string) Str::uuid7()]);
    }
}
