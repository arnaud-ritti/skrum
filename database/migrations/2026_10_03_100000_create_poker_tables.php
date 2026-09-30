<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('poker_games', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->string('deck', 30);
            $table->json('cards');
            $table->string('deck_name', 40)->nullable();
            $table->uuid('facilitator_player_id')->nullable();
            $table->uuid('current_task_id')->nullable();
            $table->boolean('guest_access_enabled')->default(false);
            $table->string('guest_token', 40)->unique();
            $table->timestamp('ended_at')->nullable();
            $table->boolean('auto_reveal')->default(false);
            $table->boolean('anonymous_votes')->default(false);
            $table->boolean('cursors_enabled')->default(true);
            $table->boolean('reactions_enabled')->default(true);
            $table->timestamps();

            $table->index(['team_id', 'ended_at']);
        });

        Schema::create('poker_players', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('poker_game_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('guest_name', 50)->nullable();
            $table->string('guest_secret_hash', 64)->nullable();
            $table->boolean('is_spectator')->default(false);
            $table->timestamps();

            $table->unique(['poker_game_id', 'user_id']);
        });

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
            $table->timestamps();

            $table->unique(['poker_game_id', 'external_source', 'external_id']);
            $table->index(['poker_game_id', 'position']);
        });

        Schema::create('poker_rounds', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('poker_task_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('number');
            $table->timestamp('revealed_at')->nullable();
            $table->unsignedInteger('version')->default(0);
            $table->boolean('anonymous')->default(false);
            $table->timestamp('timer_ends_at')->nullable();
            $table->string('reveal_reason', 20)->nullable();
            $table->timestamps();

            $table->unique(['poker_task_id', 'number']);
        });

        Schema::create('poker_votes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('poker_round_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('poker_player_id')->constrained()->cascadeOnDelete();
            $table->string('value', 8);
            $table->timestamps();

            $table->unique(['poker_round_id', 'poker_player_id']);
        });

        Schema::table('poker_games', function (Blueprint $table) {
            $table->foreign('facilitator_player_id')->references('id')->on('poker_players')->nullOnDelete();
            $table->foreign('current_task_id')->references('id')->on('poker_tasks')->nullOnDelete();
        });
    }
};
