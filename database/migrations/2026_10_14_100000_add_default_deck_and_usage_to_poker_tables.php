<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->string('default_poker_deck', 30)->nullable();
            $table->foreignUuid('default_saved_poker_deck_id')->nullable()->constrained('poker_decks')->nullOnDelete();
        });

        Schema::table('poker_games', function (Blueprint $table) {
            $table->foreignUuid('saved_deck_id')->nullable()->constrained('poker_decks')->nullOnDelete();
        });
    }
};
