<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('action_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->nullable()->index()->constrained()->cascadeOnDelete();
            $table->string('content', 500);
            $table->foreignUuid('assignee_participant_id')->nullable()->constrained('participants')->nullOnDelete();
            $table->foreignUuid('created_by_participant_id')->nullable()->constrained('participants')->nullOnDelete();
            $table->foreignUuid('theme_id')->nullable()->constrained('retro_themes')->nullOnDelete();
            $table->string('theme_name', 80)->nullable();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('priority')->default('medium');
            $table->date('due_on')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignUuid('assignee_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('recurrence')->nullable();
            $table->uuid('previous_occurrence_id')->nullable()->unique();
            $table->string('completed_via_source', 20)->nullable();
            $table->unsignedInteger('sort_rank');
            $table->text('content_search')->nullable();
            $table->foreignUuid('card_id')->nullable()->index()->constrained()->nullOnDelete();
            $table->timestamp('started_at')->nullable();
            $table->timestamps();

            $table->index(['assignee_user_id', 'completed_at']);
            $table->index(['completed_at', 'due_on']);
            $table->index(['team_id', 'completed_at', 'due_on']);
            $table->index(['team_id', 'sort_rank']);
        });

        Schema::table('action_items', function (Blueprint $table) {
            $table->foreign('previous_occurrence_id')->references('id')->on('action_items')->nullOnDelete();
        });
    }
};
