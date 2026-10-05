<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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
    }
};
