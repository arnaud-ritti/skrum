<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('survey_responses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('survey_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('survey_option_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('participant_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['survey_id', 'participant_id', 'survey_option_id'], 'survey_responses_survey_id_participant_id_survey_option_id_uniq');
        });
    }
};
