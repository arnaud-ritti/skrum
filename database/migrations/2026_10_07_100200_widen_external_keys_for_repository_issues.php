<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * GitHub issue keys are `owner/repo#number` (spec 8 §4.2).
     */
    public function up(): void
    {
        Schema::table('poker_tasks', function (Blueprint $table) {
            $table->string('external_key', 150)->nullable()->change();
        });

        Schema::table('action_item_external_links', function (Blueprint $table) {
            $table->string('external_key', 150)->change();
        });
    }
};
