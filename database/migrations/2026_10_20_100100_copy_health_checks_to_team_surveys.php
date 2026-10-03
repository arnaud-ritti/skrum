<?php

use App\Support\Surveys\ImportHealthChecks;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * The import commits retro by retro, so that a run stopped on a large
     * instance can be started again (docs/database.md, "Upgrading").
     */
    public $withinTransaction = false;

    public function up(): void
    {
        resolve(ImportHealthChecks::class)->handle();
    }
};
