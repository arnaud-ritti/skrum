<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_rooms', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('retro_id')->nullable()->unique()->constrained()->cascadeOnDelete();
            $table->string('name', 60)->nullable();
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->uuid('host_player_id')->nullable();
            $table->string('game', 20)->default('draw');
            $table->string('locale', 5);
            $table->string('access', 10)->default('team');
            $table->string('guest_token', 40)->unique();
            $table->timestamp('timer_ends_at')->nullable();
            $table->uuid('current_round_id')->nullable();
            $table->timestamp('scores_reset_at')->nullable();
            $table->timestamps();

            $table->index(['team_id', 'retro_id']);
        });

        Schema::create('game_players', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_room_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('participant_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('guest_name', 50)->nullable();
            $table->string('guest_secret_hash', 64)->nullable();
            $table->timestamps();

            $table->unique(['game_room_id', 'user_id']);
            $table->unique(['game_room_id', 'participant_id']);
        });

        Schema::table('game_rooms', function (Blueprint $table) {
            $table->foreign('host_player_id')->references('id')->on('game_players')->nullOnDelete();
        });

        Schema::create('game_rounds', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_room_id')->constrained()->cascadeOnDelete();
            $table->string('game', 20);
            $table->foreignUuid('leader_player_id')->nullable()->constrained('game_players')->nullOnDelete();
            $table->string('word', 24)->nullable();
            $table->jsonb('revealed_positions')->default(new Expression("'[]'::jsonb"));
            $table->jsonb('picked_letters')->default(new Expression("'[]'::jsonb"));
            $table->jsonb('picked_by')->default(new Expression("'[]'::jsonb"));
            $table->unsignedSmallInteger('misses')->default(0);
            $table->jsonb('clue')->default(new Expression("'[]'::jsonb"));
            $table->string('question', 200)->nullable();
            $table->jsonb('drawing')->default(new Expression("'[]'::jsonb"));
            $table->unsignedInteger('drawing_points')->default(0);
            $table->foreignUuid('winner_player_id')->nullable()->constrained('game_players')->nullOnDelete();
            $table->timestamp('revealed_at')->nullable();
            $table->string('outcome', 20)->nullable();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->index(['game_room_id', 'ended_at']);
        });

        Schema::table('game_rooms', function (Blueprint $table) {
            $table->foreign('current_round_id')->references('id')->on('game_rounds')->nullOnDelete();
        });

        Schema::create('game_guesses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_round_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('player_id')->constrained('game_players')->cascadeOnDelete();
            $table->string('text', 50);
            $table->boolean('is_near_miss')->default(false);
            $table->boolean('is_correct')->default(false);
            $table->timestamps();

            $table->index(['game_round_id', 'created_at']);
        });

        Schema::create('game_gif_answers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_round_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('player_id')->constrained('game_players')->cascadeOnDelete();
            $table->string('gif_id', 64);
            $table->timestamps();

            $table->unique(['game_round_id', 'player_id']);
        });

        Schema::create('game_gif_votes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_round_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('voter_player_id')->constrained('game_players')->cascadeOnDelete();
            $table->foreignUuid('answer_id')->constrained('game_gif_answers')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['game_round_id', 'voter_player_id']);
        });

        Schema::create('game_points', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('game_room_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('game_round_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('player_id')->constrained('game_players')->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('game', 20);
            $table->unsignedSmallInteger('points');
            $table->boolean('is_win')->default(false);
            $table->timestamp('created_at');

            $table->unique(['game_round_id', 'player_id']);
            $table->index(['game_room_id', 'created_at']);
            $table->index(['team_id', 'user_id', 'created_at']);
        });

        Schema::create('game_used_words', function (Blueprint $table) {
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('locale', 5);
            $table->string('word', 24);
            $table->timestamp('created_at');

            $table->primary(['team_id', 'locale', 'word']);
        });
    }
};
