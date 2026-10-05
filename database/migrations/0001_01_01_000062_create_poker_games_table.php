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
            $table->foreignUuid('saved_deck_id')->nullable()->constrained('poker_decks')->nullOnDelete();
            $table->text('title_search')->nullable();
            $table->boolean('revote_after_reveal')->default(false);
            $table->unsignedSmallInteger('task_timer_seconds')->nullable();
            $table->boolean('writes_estimates')->default(true);
            $table->string('estimate_field_id', 100)->nullable();
            $table->timestamps();

            $table->index(['team_id', 'ended_at']);
        });
    }
};
