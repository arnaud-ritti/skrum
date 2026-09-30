<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retros', function (Blueprint $table) {
            $table->text('summary')->nullable();
            $table->timestamp('summary_generated_at')->nullable();
            $table->string('summary_status')->nullable();
            $table->timestamp('summary_requested_at')->nullable();
        });

        Schema::table('cards', function (Blueprint $table) {
            $table->string('sentiment')->nullable();
            $table->string('category', 40)->nullable();
        });

        Schema::create('retro_themes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->unsignedSmallInteger('position');
            $table->timestamps();
        });

        Schema::create('retro_theme_cards', function (Blueprint $table) {
            $table->foreignUuid('theme_id')->constrained('retro_themes')->cascadeOnDelete();
            $table->foreignUuid('card_id')->unique()->constrained()->cascadeOnDelete();
            $table->primary(['theme_id', 'card_id']);
        });

        Schema::create('suggested_actions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('theme_id')->nullable()->constrained('retro_themes')->nullOnDelete();
            $table->string('content', 500);
            $table->unsignedSmallInteger('position');
            $table->string('status')->default('pending');
            $table->foreignUuid('action_item_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('handled_by_participant_id')->nullable()->constrained('participants')->nullOnDelete();
            $table->timestamp('handled_at')->nullable();
            $table->timestamps();
            $table->index(['retro_id', 'status']);
        });

        Schema::table('action_items', function (Blueprint $table) {
            $table->foreignUuid('theme_id')->nullable()->constrained('retro_themes')->nullOnDelete();
            $table->string('theme_name', 80)->nullable();
        });
    }
};
