<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->string('description', 200)->nullable();
        });

        Schema::table('workspaces', function (Blueprint $table) {
            $table->string('description', 200)->nullable();
        });
    }
};
