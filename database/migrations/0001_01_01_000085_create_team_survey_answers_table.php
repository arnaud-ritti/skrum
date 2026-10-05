<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_survey_answers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_survey_question_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('team_survey_respondent_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('value')->nullable();
            $table->text('text')->nullable();
            $table->string('comment', 500)->nullable();
            $table->timestamps();

            $table->unique(['team_survey_question_id', 'team_survey_respondent_id'], 'team_survey_answers_question_respondent_unique');
        });
    }
};
