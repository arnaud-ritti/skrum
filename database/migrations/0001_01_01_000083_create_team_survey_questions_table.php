<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_survey_questions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_survey_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 20);
            $table->string('label', 200);
            $table->string('short_label', 30)->nullable();
            $table->string('description', 500)->nullable();
            $table->string('builtin', 40)->nullable();
            $table->string('match_key', 64)->nullable();
            $table->unsignedInteger('position');
            $table->boolean('is_required')->default(false);
            $table->boolean('allows_comment')->default(false);
            $table->unsignedTinyInteger('scale_max')->nullable();
            $table->string('scale_min_label', 60)->nullable();
            $table->string('scale_max_label', 60)->nullable();
            $table->timestamps();

            $table->index(['team_survey_id', 'position']);
        });
    }
};
