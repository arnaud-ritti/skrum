<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whiteboards', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->uuid('facilitator_member_id')->nullable();
            $table->boolean('guest_access_enabled')->default(false);
            $table->string('guest_token', 40)->unique();
            $table->boolean('cursors_enabled')->default(true);
            $table->unsignedBigInteger('seq')->default(0);
            $table->unsignedBigInteger('purged_seq')->default(0);
            $table->boolean('reactions_enabled')->default(true);
            $table->boolean('locked')->default(false);
            $table->boolean('follow_enabled')->default(false);
            $table->timestamp('timer_ends_at')->nullable();
            $table->text('title_search')->nullable();
            $table->json('preview')->nullable();
            $table->unsignedInteger('preview_seq')->nullable();
            $table->timestamps();

            $table->index(['team_id', 'updated_at']);
        });
    }
};
