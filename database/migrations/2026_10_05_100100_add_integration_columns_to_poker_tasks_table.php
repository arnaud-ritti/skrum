<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('poker_tasks', function (Blueprint $table) {
            $table->string('external_site', 100)->nullable();
            $table->string('external_key', 50)->nullable();
            $table->string('external_assignee', 100)->nullable();
            $table->string('external_estimate', 16)->nullable();
            $table->timestamp('external_refreshed_at')->nullable();
            $table->boolean('needs_sync')->default(false);
            $table->string('sync_error', 500)->nullable();
            $table->timestamp('synced_at')->nullable();
        });
    }
};
