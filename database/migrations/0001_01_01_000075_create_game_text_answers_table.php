<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_text_answers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_round_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('player_id')->constrained('game_players')->cascadeOnDelete();
            $table->string('text', 120);
            $table->boolean('is_drawn')->default(false);
            $table->timestamps();

            $table->unique(['game_round_id', 'player_id']);
        });
    }
};
