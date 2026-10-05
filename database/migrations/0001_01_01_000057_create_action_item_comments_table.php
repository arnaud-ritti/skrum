<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('action_item_comments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('action_item_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('author_participant_id')->nullable()->constrained('participants')->nullOnDelete();
            $table->foreignUuid('author_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('content');
            $table->timestamps();

            $table->index(['action_item_id', 'created_at']);
        });
    }
};
