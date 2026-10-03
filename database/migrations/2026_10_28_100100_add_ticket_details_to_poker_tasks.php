<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('poker_tasks', function (Blueprint $table) {
            $table->string('external_type', 60)->nullable();
            $table->json('external_labels')->nullable();
        });
    }
};
