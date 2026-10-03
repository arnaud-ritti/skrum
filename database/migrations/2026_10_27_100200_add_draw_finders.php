<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('game_rounds', function (Blueprint $table) {
            $table->unsignedSmallInteger('guessers_total')->nullable();
            $table->unsignedTinyInteger('word_changes')->default(0);
        });

        Schema::table('game_guesses', function (Blueprint $table) {
            $table->unsignedTinyInteger('hints')->nullable();
        });
    }
};
