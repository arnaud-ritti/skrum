<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('votes', function (Blueprint $table) {
            $table->index('card_id');
        });

        Schema::table('cards', function (Blueprint $table) {
            $table->index('retro_id');
            $table->index('participant_id');
        });

        Schema::table('columns', function (Blueprint $table) {
            $table->index(['retro_id', 'position']);
        });

        Schema::table('action_items', function (Blueprint $table) {
            $table->index('retro_id');
        });
    }
};
