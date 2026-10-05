<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retros', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->string('template');
            $table->string('phase')->default('writing');
            $table->uuid('facilitator_participant_id')->nullable();
            $table->boolean('is_anonymous')->default(false);
            $table->unsignedSmallInteger('votes_per_participant')->nullable();
            $table->boolean('guest_access_enabled')->default(false);
            $table->string('guest_token', 64)->unique();
            $table->timestamp('timer_ends_at')->nullable();
            $table->uuid('highlighted_card_id')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedInteger('votes_version')->default(0);
            $table->boolean('reactions_enabled')->default(true);
            $table->boolean('cursors_enabled')->default(true);
            $table->boolean('gifs_enabled')->default(true);
            $table->boolean('hide_vote_counts')->default(false);
            $table->boolean('is_locked')->default(false);
            $table->boolean('presentation_mode')->default(false);
            $table->boolean('icebreaker_enabled')->default(false);
            $table->foreignUuid('workspace_template_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('ai_summary_enabled')->default(false);
            $table->text('summary')->nullable();
            $table->timestamp('summary_generated_at')->nullable();
            $table->string('summary_status')->nullable();
            $table->timestamp('summary_requested_at')->nullable();
            $table->string('icebreaker_game', 20)->default('draw');
            $table->timestamp('started_at')->nullable();
            $table->text('title_search')->nullable();
            $table->text('summary_search')->nullable();
            $table->unsignedInteger('timer_paused_seconds')->nullable();
            $table->unsignedSmallInteger('topic_seconds')->nullable();
            $table->unsignedTinyInteger('max_votes_per_card')->nullable();
            $table->dateTime('roti_revealed_at')->nullable();
            $table->json('phase_durations')->nullable();
            $table->timestamps();

            $table->index(['team_id', 'created_at']);
        });
    }
};
