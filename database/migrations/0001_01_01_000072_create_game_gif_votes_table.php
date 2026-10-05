<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_gif_votes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_round_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('voter_player_id')->constrained('game_players')->cascadeOnDelete();
            $table->foreignUuid('answer_id')->constrained('game_gif_answers')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['game_round_id', 'voter_player_id', 'answer_id']);
        });
    }
};
