<?php

use Illuminate\Database\Migrations\Migration;
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
            $table->boolean('reactions_enabled')->default(true);
            $table->text('name_search')->nullable();
            $table->json('word_themes')->nullable();
            $table->unsignedSmallInteger('turn_seconds')->nullable();
            $table->boolean('auto_hints')->default(false);
            $table->boolean('takes_turns')->default(false);
            $table->unsignedTinyInteger('rounds_per_game')->nullable();
            $table->unsignedTinyInteger('gif_votes')->default(1);
            $table->boolean('gif_authors_hidden')->default(false);
            $table->unsignedInteger('rounds_played')->default(0);
            $table->timestamps();

            $table->index(['team_id', 'retro_id']);
        });
    }
};
