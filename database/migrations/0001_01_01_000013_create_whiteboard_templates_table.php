<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whiteboard_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('workspace_id')->index()->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('description', 300)->nullable();
            $table->json('scene');
            $table->json('preview');
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name_key', 160);
            $table->timestamps();

            $table->unique(['workspace_id', 'name_key']);
        });
    }
};
