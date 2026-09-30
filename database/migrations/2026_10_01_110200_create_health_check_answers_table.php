<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('health_check_answers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('participant_id')->constrained()->cascadeOnDelete();
            $table->string('statement', 64);
            $table->unsignedTinyInteger('score');
            $table->timestamps();

            $table->unique(['retro_id', 'participant_id', 'statement']);
            $table->index(['retro_id', 'statement']);
        });
    }
};
