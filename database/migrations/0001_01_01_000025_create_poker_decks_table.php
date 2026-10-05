<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('poker_decks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->nullable()->index()->constrained()->cascadeOnDelete();
            $table->string('name', 40);
            $table->json('cards');
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('workspace_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name_key', 160);
            $table->timestamps();

            $table->unique(['team_id', 'name_key']);
            $table->unique(['workspace_id', 'name_key']);
        });

        Schema::table('teams', function (Blueprint $table) {
            $table->foreign('default_saved_poker_deck_id')->references('id')->on('poker_decks')->nullOnDelete();
        });
    }
};
