<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_survey_respondents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_survey_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('participant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('guest_name', 50)->nullable();
            $table->string('guest_secret_hash', 64)->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedTinyInteger('presence_color')->nullable();
            $table->timestamps();

            $table->unique(['team_survey_id', 'participant_id']);
            $table->unique(['team_survey_id', 'user_id']);
        });

        Schema::table('team_surveys', function (Blueprint $table) {
            $table->foreign('facilitator_respondent_id')->references('id')->on('team_survey_respondents')->nullOnDelete();
        });
    }
};
