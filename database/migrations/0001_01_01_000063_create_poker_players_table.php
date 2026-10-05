<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('poker_players', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('poker_game_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('guest_name', 50)->nullable();
            $table->string('guest_secret_hash', 64)->nullable();
            $table->boolean('is_spectator')->default(false);
            $table->unsignedTinyInteger('presence_color')->nullable();
            $table->timestamps();

            $table->unique(['poker_game_id', 'user_id']);
        });

        Schema::table('poker_games', function (Blueprint $table) {
            $table->foreign('facilitator_player_id')->references('id')->on('poker_players')->nullOnDelete();
        });
    }
};
