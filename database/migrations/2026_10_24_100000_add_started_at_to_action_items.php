<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "In progress" (plan 24, AI-3): when an item was started. Meaningful only while
     * `completed_at` is null; every existing row stays to do or done.
     */
    public function up(): void
    {
        Schema::table('action_items', function (Blueprint $table): void {
            $table->timestamp('started_at')->nullable();
        });
    }
};
