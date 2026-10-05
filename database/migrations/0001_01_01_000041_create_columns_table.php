<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('columns', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->string('title', 100);
            $table->string('color', 16);
            $table->unsignedInteger('position');
            $table->string('description', 200)->nullable();
            $table->timestamps();

            $table->index(['retro_id', 'position']);
        });
    }
};
