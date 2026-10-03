<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Retro facilitation (plan 21). Every column is nullable: null keeps the behaviour of before.
     */
    public function up(): void
    {
        Schema::table('retros', function (Blueprint $table): void {
            $table->unsignedInteger('timer_paused_seconds')->nullable();
            $table->unsignedSmallInteger('topic_seconds')->nullable();
            $table->unsignedTinyInteger('max_votes_per_card')->nullable();
            $table->dateTime('roti_revealed_at')->nullable();
        });

        Schema::table('participants', function (Blueprint $table): void {
            $table->dateTime('voting_finished_at')->nullable();
            $table->dateTime('writing_until')->nullable();
        });

        Schema::table('cards', function (Blueprint $table): void {
            $table->dateTime('discussed_at')->nullable();
        });

        Schema::table('action_items', function (Blueprint $table): void {
            $table->foreignUuid('card_id')->nullable()->index()->constrained('cards')->nullOnDelete();
        });
    }
};
