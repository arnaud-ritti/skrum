<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('poker_rounds', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('poker_task_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('number');
            $table->timestamp('revealed_at')->nullable();
            $table->unsignedInteger('version')->default(0);
            $table->boolean('anonymous')->default(false);
            $table->timestamp('timer_ends_at')->nullable();
            $table->string('reveal_reason', 20)->nullable();
            $table->timestamps();

            $table->unique(['poker_task_id', 'number']);
        });
    }
};
