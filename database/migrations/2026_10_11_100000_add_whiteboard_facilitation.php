<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whiteboards', function (Blueprint $table) {
            $table->boolean('locked')->default(false);
            $table->boolean('follow_enabled')->default(false);
            $table->timestamp('timer_ends_at')->nullable();
        });
    }
};
