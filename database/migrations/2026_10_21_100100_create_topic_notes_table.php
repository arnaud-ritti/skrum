<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('topic_notes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('card_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->unsignedInteger('version')->default(0);
            $table->foreignUuid('updated_by_participant_id')->nullable()->constrained('participants')->nullOnDelete();
            $table->timestamps();

            $table->unique('card_id');
        });
    }
};
