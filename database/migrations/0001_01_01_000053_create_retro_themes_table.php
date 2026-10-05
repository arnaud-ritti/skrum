<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retro_themes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->unsignedSmallInteger('position');
            $table->timestamps();
        });
    }
};
