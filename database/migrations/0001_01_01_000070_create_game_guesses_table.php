<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_guesses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_round_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('player_id')->constrained('game_players')->cascadeOnDelete();
            $table->string('text', 50);
            $table->boolean('is_near_miss')->default(false);
            $table->boolean('is_correct')->default(false);
            $table->timestamp('created_at')->nullable();
            $table->unsignedTinyInteger('hints')->nullable();

            $table->index(['game_round_id', 'created_at']);
        });
    }
};
