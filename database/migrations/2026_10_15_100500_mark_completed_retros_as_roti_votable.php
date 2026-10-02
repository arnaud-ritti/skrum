<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * A retro completed before the ROTI had its own phase took ratings after
     * its end: it keeps doing so.
     */
    public function up(): void
    {
        DB::table('retros')
            ->where('phase', 'completed')
            ->update(['roti_votable_when_completed' => true]);
    }
};
