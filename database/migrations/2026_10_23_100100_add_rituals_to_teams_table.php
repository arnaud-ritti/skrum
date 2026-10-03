<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->unsignedTinyInteger('sprint_length_weeks')->nullable();
            $table->unsignedTinyInteger('retro_weekday')->nullable();
            $table->string('retro_time', 5)->nullable();
            $table->boolean('facilitator_rotation_enabled')->default(false);
            $table->unsignedInteger('rotation_position')->default(0);
        });
    }
};
