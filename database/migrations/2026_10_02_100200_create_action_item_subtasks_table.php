<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('action_item_subtasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('action_item_id')->constrained()->cascadeOnDelete();
            $table->string('content', 200);
            $table->unsignedInteger('position');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['action_item_id', 'position']);
        });
    }
};
