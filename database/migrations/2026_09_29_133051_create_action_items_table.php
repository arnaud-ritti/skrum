<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('action_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->string('content', 500);
            $table->foreignUuid('assignee_participant_id')->nullable()->constrained('participants')->nullOnDelete();
            $table->foreignUuid('created_by_participant_id')->constrained('participants')->cascadeOnDelete();
            $table->boolean('is_done')->default(false);
            $table->timestamps();
        });
    }
};
