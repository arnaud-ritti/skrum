<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cards', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->index()->constrained()->cascadeOnDelete();
            $table->foreignUuid('column_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('participant_id')->index()->constrained()->cascadeOnDelete();
            $table->text('content')->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->uuid('parent_card_id')->nullable();
            $table->string('gif_id', 64)->nullable();
            $table->string('group_name', 60)->nullable();
            $table->string('sentiment')->nullable();
            $table->string('category', 40)->nullable();
            $table->text('content_search')->nullable();
            $table->dateTime('discussed_at')->nullable();
            $table->timestamps();

            $table->index(['column_id', 'position']);
        });

        Schema::table('retros', function (Blueprint $table) {
            $table->foreign('highlighted_card_id')->references('id')->on('cards')->nullOnDelete();
        });

        Schema::table('cards', function (Blueprint $table) {
            $table->foreign('parent_card_id')->references('id')->on('cards')->nullOnDelete();
        });
    }
};
