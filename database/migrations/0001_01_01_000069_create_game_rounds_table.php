<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_rounds', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_room_id')->constrained()->cascadeOnDelete();
            $table->string('game', 20);
            $table->foreignUuid('leader_player_id')->nullable()->constrained('game_players')->nullOnDelete();
            $table->string('word', 24)->nullable();
            $table->jsonb('revealed_positions');
            $table->jsonb('picked_letters');
            $table->jsonb('picked_by');
            $table->unsignedSmallInteger('misses')->default(0);
            $table->jsonb('clue');
            $table->string('question', 200)->nullable();
            $table->jsonb('drawing');
            $table->unsignedInteger('drawing_points')->default(0);
            $table->foreignUuid('winner_player_id')->nullable()->constrained('game_players')->nullOnDelete();
            $table->timestamp('revealed_at')->nullable();
            $table->string('outcome', 20)->nullable();
            $table->dateTime('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->unsignedSmallInteger('number')->nullable();
            $table->unsignedTinyInteger('rounds_total')->nullable();
            $table->json('turn_order')->nullable();
            $table->foreignUuid('turn_player_id')->nullable()->constrained('game_players')->nullOnDelete();
            $table->dateTime('turn_ends_at')->nullable();
            $table->unsignedSmallInteger('turn_seconds')->nullable();
            $table->unsignedSmallInteger('hint_seconds')->nullable();
            $table->unsignedTinyInteger('votes_allowed')->default(1);
            $table->boolean('authors_hidden')->default(false);
            $table->json('statements')->nullable();
            $table->unsignedTinyInteger('lie_index')->nullable();
            $table->unsignedSmallInteger('guessers_total')->nullable();
            $table->unsignedTinyInteger('word_changes')->default(0);
            $table->timestamps();

            $table->index(['game_room_id', 'ended_at']);
        });

        Schema::table('game_rooms', function (Blueprint $table) {
            $table->foreign('current_round_id')->references('id')->on('game_rounds')->nullOnDelete();
        });
    }
};
