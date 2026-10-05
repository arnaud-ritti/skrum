<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retro_theme_cards', function (Blueprint $table) {
            $table->foreignUuid('theme_id')->constrained('retro_themes')->cascadeOnDelete();
            $table->foreignUuid('card_id')->unique()->constrained()->cascadeOnDelete();

            $table->primary(['theme_id', 'card_id']);
        });
    }
};
