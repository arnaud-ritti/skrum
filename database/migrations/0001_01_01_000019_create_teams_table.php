<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teams', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('default_poker_deck', 30)->nullable();
            $table->uuid('default_saved_poker_deck_id')->nullable();
            $table->unsignedTinyInteger('sprint_length_weeks')->nullable();
            $table->unsignedTinyInteger('retro_weekday')->nullable();
            $table->string('retro_time', 5)->nullable();
            $table->boolean('facilitator_rotation_enabled')->default(false);
            $table->unsignedInteger('rotation_position')->default(0);
            $table->string('default_retro_template', 80)->nullable();
            $table->string('description', 200)->nullable();
            $table->string('color', 20)->nullable();
            $table->string('slug', 50);
            $table->timestamps();

            $table->unique(['workspace_id', 'slug']);
        });
    }
};
