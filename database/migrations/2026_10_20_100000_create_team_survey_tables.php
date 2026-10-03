<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_surveys', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('retro_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->string('description', 500)->nullable();
            $table->string('template', 40)->nullable();
            $table->string('status', 20)->default('draft');
            $table->uuid('facilitator_respondent_id')->nullable();
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('guest_access_enabled')->default(false);
            $table->string('guest_token', 40)->unique();
            $table->boolean('one_question_at_a_time')->default(true);
            $table->boolean('show_results_after_answer')->default(true);
            $table->unsignedTinyInteger('results_threshold')->default(3);
            $table->uuid('previous_survey_id')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['team_id', 'status']);
            $table->index(['team_id', 'closed_at']);
            $table->index(['retro_id', 'template']);
        });

        Schema::create('team_survey_respondents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_survey_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('participant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('guest_name', 50)->nullable();
            $table->string('guest_secret_hash', 64)->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['team_survey_id', 'user_id']);
            $table->unique(['team_survey_id', 'participant_id']);
        });

        Schema::table('team_surveys', function (Blueprint $table) {
            $table->foreign('facilitator_respondent_id')->references('id')->on('team_survey_respondents')->nullOnDelete();
            $table->foreign('previous_survey_id')->references('id')->on('team_surveys')->nullOnDelete();
        });

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

        Schema::create('team_survey_options', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_survey_question_id')->constrained()->cascadeOnDelete();
            $table->string('label', 100);
            $table->unsignedInteger('position');
            $table->timestamps();

            $table->index(['team_survey_question_id', 'position']);
        });

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

        Schema::create('team_survey_answer_options', function (Blueprint $table) {
            $table->foreignUuid('team_survey_answer_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('team_survey_option_id')->constrained()->cascadeOnDelete();

            $table->primary(['team_survey_answer_id', 'team_survey_option_id'], 'team_survey_answer_options_primary');
        });
    }
};
