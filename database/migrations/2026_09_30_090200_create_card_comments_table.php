<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('card_comments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('card_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('participant_id')->constrained()->cascadeOnDelete();
            $table->uuid('parent_comment_id')->nullable();
            $table->text('content')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
            $table->index(['card_id', 'created_at']);
            $table->index('retro_id');
        });

        Schema::table('card_comments', function (Blueprint $table) {
            $table->foreign('parent_comment_id')->references('id')->on('card_comments')->cascadeOnDelete();
        });
    }
};
