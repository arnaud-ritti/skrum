<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retro_health_statements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->string('key', 64);
            $table->foreignUuid('team_health_statement_id')->nullable()->constrained()->nullOnDelete();
            $table->string('builtin')->nullable();
            $table->string('text', 150)->nullable();
            $table->string('label', 30)->nullable();
            $table->unsignedSmallInteger('position');
            $table->timestamps();

            $table->unique(['retro_id', 'key']);
        });
    }
};
