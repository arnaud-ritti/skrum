<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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
