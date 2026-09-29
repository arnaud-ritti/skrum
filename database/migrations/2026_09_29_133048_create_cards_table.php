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
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('column_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('participant_id')->constrained()->cascadeOnDelete();
            $table->text('content');
            $table->unsignedInteger('position')->default(0);
            $table->uuid('parent_card_id')->nullable();
            $table->timestamps();

            $table->index(['column_id', 'position']);
        });

        Schema::table('cards', function (Blueprint $table) {
            $table->foreign('parent_card_id')->references('id')->on('cards')->nullOnDelete();
        });
    }
};
