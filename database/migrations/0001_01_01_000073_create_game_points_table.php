<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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
            $table->dateTime('created_at');
            $table->date('week_start');

            $table->index(['game_room_id', 'created_at']);
            $table->unique(['game_round_id', 'player_id']);
            $table->index(['team_id', 'user_id', 'created_at']);
            $table->index(['team_id', 'user_id', 'week_start']);
        });
    }
};
