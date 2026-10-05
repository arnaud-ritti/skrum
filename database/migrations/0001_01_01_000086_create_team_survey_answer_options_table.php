<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_survey_answer_options', function (Blueprint $table) {
            $table->foreignUuid('team_survey_answer_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('team_survey_option_id')->constrained()->cascadeOnDelete();

            $table->primary(['team_survey_answer_id', 'team_survey_option_id']);
        });
    }
};
