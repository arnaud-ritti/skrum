<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('poker_votes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('poker_round_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('poker_player_id')->constrained()->cascadeOnDelete();
            $table->string('value', 8);
            $table->timestamps();

            $table->unique(['poker_round_id', 'poker_player_id']);
        });
    }
};
