<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whiteboards', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->uuid('facilitator_member_id')->nullable();
            $table->boolean('guest_access_enabled')->default(false);
            $table->string('guest_token', 40)->unique();
            $table->boolean('cursors_enabled')->default(true);
            $table->unsignedBigInteger('seq')->default(0);
            $table->unsignedBigInteger('purged_seq')->default(0);
            $table->timestamps();

            $table->index(['team_id', 'updated_at']);
        });

        Schema::create('whiteboard_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('whiteboard_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('guest_name', 50)->nullable();
            $table->string('guest_secret_hash', 64)->nullable();
            $table->timestamps();

            $table->unique(['whiteboard_id', 'user_id']);
        });

        Schema::table('whiteboards', function (Blueprint $table) {
            $table->foreign('facilitator_member_id')->references('id')->on('whiteboard_members')->nullOnDelete();
        });

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

        Schema::create('whiteboard_files', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('whiteboard_id')->constrained()->cascadeOnDelete();
            $table->string('file_id', 64);
            $table->string('path');
            $table->string('mime_type', 40);
            $table->unsignedInteger('size');
            $table->foreignUuid('uploaded_by_member_id')->nullable()->constrained('whiteboard_members')->nullOnDelete();
            $table->timestamps();

            $table->unique(['whiteboard_id', 'file_id']);
        });
    }
};
