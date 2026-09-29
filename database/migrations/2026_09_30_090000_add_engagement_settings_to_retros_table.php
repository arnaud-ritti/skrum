<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retros', function (Blueprint $table) {
            $table->boolean('reactions_enabled')->default(true);
            $table->boolean('cursors_enabled')->default(true);
            $table->boolean('gifs_enabled')->default(true);
            $table->boolean('hide_vote_counts')->default(false);
            $table->boolean('is_locked')->default(false);
            $table->boolean('presentation_mode')->default(false);
        });
    }
};
