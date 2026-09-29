<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retros', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->string('template');
            $table->string('phase')->default('writing');
            $table->uuid('facilitator_participant_id')->nullable();
            $table->boolean('is_anonymous')->default(false);
            $table->unsignedSmallInteger('votes_per_participant')->default(5);
            $table->boolean('guest_access_enabled')->default(false);
            $table->string('guest_token', 64)->unique();
            $table->timestamp('timer_ends_at')->nullable();
            $table->uuid('highlighted_card_id')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['team_id', 'created_at']);
        });
    }
};
