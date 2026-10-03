<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('game_rooms', function (Blueprint $table) {
            $table->json('word_themes')->nullable();
            $table->unsignedSmallInteger('turn_seconds')->nullable();
            $table->boolean('auto_hints')->default(false);
            $table->boolean('takes_turns')->default(false);
            $table->unsignedTinyInteger('rounds_per_game')->nullable();
            $table->unsignedTinyInteger('gif_votes')->default(1);
            $table->boolean('gif_authors_hidden')->default(false);
        });

        Schema::table('game_rounds', function (Blueprint $table) {
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
        });

        Schema::table('game_gif_answers', function (Blueprint $table) {
            $table->string('caption', 60)->nullable();
        });

        // The new key first: MySQL keeps an index for the round's foreign key at every step.
        Schema::table('game_gif_votes', function (Blueprint $table) {
            $table->unique(['game_round_id', 'voter_player_id', 'answer_id']);
        });

        Schema::table('game_gif_votes', function (Blueprint $table) {
            $table->dropUnique(['game_round_id', 'voter_player_id']);
        });
    }
};
