<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retros', function (Blueprint $table) {
            $table->json('phase_durations')->nullable();
        });

        Schema::table('poker_games', function (Blueprint $table) {
            $table->boolean('revote_after_reveal')->default(false);
            $table->unsignedSmallInteger('task_timer_seconds')->nullable();
            $table->boolean('writes_estimates')->default(true);
            $table->string('estimate_field_id', 100)->nullable();
        });
    }
};
