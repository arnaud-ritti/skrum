<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whiteboard_elements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('whiteboard_id')->constrained()->cascadeOnDelete();
            $table->string('element_id', 40);
            $table->string('type', 20);
            $table->json('data');
            $table->unsignedInteger('version');
            $table->unsignedBigInteger('version_nonce');
            $table->foreignUuid('author_member_id')->nullable()->constrained('whiteboard_members')->nullOnDelete();
            $table->boolean('is_sticky')->default(false);
            $table->boolean('is_deleted')->default(false);
            $table->unsignedBigInteger('seq');
            $table->timestamps();

            $table->unique(['whiteboard_id', 'element_id']);
            $table->index(['whiteboard_id', 'seq']);
        });
    }
};
