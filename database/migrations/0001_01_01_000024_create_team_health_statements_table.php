<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_health_statements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('builtin')->nullable();
            $table->string('text', 150)->nullable();
            $table->string('label', 30)->nullable();
            $table->unsignedSmallInteger('position');
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->unique(['team_id', 'builtin']);
        });
    }
};
