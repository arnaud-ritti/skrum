<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('surveys', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('created_by_participant_id')->nullable()->constrained('participants')->nullOnDelete();
            $table->string('kind')->default('single');
            $table->string('question', 200);
            $table->string('description', 500)->nullable();
            $table->unsignedInteger('position');
            $table->boolean('is_closed')->default(false);
            $table->boolean('show_voters')->default(false);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
            $table->index(['retro_id', 'position']);
        });
    }
};
