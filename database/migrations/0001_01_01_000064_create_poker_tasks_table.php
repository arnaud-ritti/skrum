<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('poker_tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('poker_game_id')->constrained()->cascadeOnDelete();
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->unsignedInteger('position');
            $table->string('estimate', 8)->nullable();
            $table->decimal('estimate_numeric', 8, 2)->nullable();
            $table->timestamp('estimated_at')->nullable();
            $table->string('external_source', 20)->nullable();
            $table->string('external_id', 100)->nullable();
            $table->string('external_url', 2048)->nullable();
            $table->string('external_site', 100)->nullable();
            $table->string('external_key', 150)->nullable();
            $table->string('external_assignee', 100)->nullable();
            $table->string('external_estimate', 16)->nullable();
            $table->timestamp('external_refreshed_at')->nullable();
            $table->boolean('needs_sync')->default(false);
            $table->string('sync_error', 500)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->string('external_status_name', 100)->nullable();
            $table->string('external_status_category', 20)->nullable();
            $table->timestamp('external_updated_at')->nullable();
            $table->timestamp('external_missing_at')->nullable();
            $table->text('title_search')->nullable();
            $table->string('external_type', 60)->nullable();
            $table->json('external_labels')->nullable();
            $table->timestamps();

            $table->index(['external_source', 'external_site', 'external_id']);
            $table->unique(['poker_game_id', 'external_source', 'external_id']);
            $table->index(['poker_game_id', 'position']);
        });

        Schema::table('poker_games', function (Blueprint $table) {
            $table->foreign('current_task_id')->references('id')->on('poker_tasks')->nullOnDelete();
        });
    }
};
