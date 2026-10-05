<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspace_template_columns', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('workspace_template_id')->constrained()->cascadeOnDelete();
            $table->string('title', 100);
            $table->string('description', 200)->nullable();
            $table->string('color');
            $table->unsignedSmallInteger('position');
            $table->timestamps();

            $table->index(['workspace_template_id', 'position']);
        });
    }
};
