<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_used_words', function (Blueprint $table) {
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('locale', 5);
            $table->string('word', 24);
            $table->dateTime('created_at');

            $table->primary(['team_id', 'locale', 'word']);
        });
    }
};
