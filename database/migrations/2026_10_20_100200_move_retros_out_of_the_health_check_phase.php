<?php

use App\Support\Surveys\ImportHealthChecks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The import commits retro by retro and can be run again after a failure.
     */
    public $withinTransaction = false;

    public function up(): void
    {
        resolve(ImportHealthChecks::class)->handle();

        DB::table('retros')
            ->where('phase', 'health_check')
            ->where('icebreaker_enabled', true)
            ->update(['phase' => 'icebreaker']);

        DB::table('retros')
            ->where('phase', 'health_check')
            ->update(['phase' => 'writing']);
    }
};
