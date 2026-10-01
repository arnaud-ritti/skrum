<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whiteboards', function (Blueprint $table) {
            $table->boolean('locked')->default(false);
            $table->boolean('follow_enabled')->default(false);
            $table->timestamp('timer_ends_at')->nullable();
        });

        Schema::create('whiteboard_vote_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('whiteboard_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('votes_per_member');
            $table->string('frame_element_id', 40)->nullable();
            $table->boolean('allow_multiple')->default(false);
            $table->json('element_ids');
            $table->foreignUuid('opened_by_member_id')->nullable()->constrained('whiteboard_members')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->timestamp('dismissed_at')->nullable();
            $table->json('results')->nullable();
            $table->timestamps();

            $table->index(['whiteboard_id', 'closed_at']);
        });

        Schema::create('whiteboard_votes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('whiteboard_vote_session_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('whiteboard_member_id')->constrained()->cascadeOnDelete();
            $table->string('element_id', 40);
            $table->unsignedTinyInteger('count');
            $table->timestamps();

            $table->unique(['whiteboard_vote_session_id', 'whiteboard_member_id', 'element_id'], 'whiteboard_votes_member_element_unique');
        });

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('create unique index whiteboard_vote_sessions_one_open on whiteboard_vote_sessions (whiteboard_id) where closed_at is null');
    }
};
