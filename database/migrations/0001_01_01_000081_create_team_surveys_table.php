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

            $table->index(['retro_id', 'template']);
            $table->index(['team_id', 'closed_at']);
            $table->index(['team_id', 'status']);
        });

        Schema::table('team_surveys', function (Blueprint $table) {
            $table->foreign('previous_survey_id')->references('id')->on('team_surveys')->nullOnDelete();
        });
    }
};
