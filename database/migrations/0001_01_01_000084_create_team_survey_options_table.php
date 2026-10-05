<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_survey_options', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_survey_question_id')->constrained()->cascadeOnDelete();
            $table->string('label', 100);
            $table->unsignedInteger('position');
            $table->timestamps();

            $table->index(['team_survey_question_id', 'position']);
        });
    }
};
