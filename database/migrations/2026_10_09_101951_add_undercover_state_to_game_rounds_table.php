<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('game_rounds', function (Blueprint $table): void {
            $table->json('undercover_state')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('game_rounds', function (Blueprint $table): void {
            $table->dropColumn('undercover_state');
        });
    }
};
