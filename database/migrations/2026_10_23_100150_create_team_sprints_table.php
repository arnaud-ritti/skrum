<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_sprints', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('number');
            $table->date('starts_on');
            $table->date('ends_on');
            $table->timestamps();

            $table->unique(['team_id', 'number']);
            $table->index(['team_id', 'starts_on']);
        });
    }
};
