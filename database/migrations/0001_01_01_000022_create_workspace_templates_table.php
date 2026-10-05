<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspace_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('category');
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name_key', 160);
            $table->string('visibility', 20)->default('workspace');
            $table->foreignUuid('team_id')->nullable()->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['workspace_id', 'name_key']);
            $table->index(['workspace_id', 'visibility']);
        });
    }
};
