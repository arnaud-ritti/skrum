<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retros', function (Blueprint $table) {
            $table->boolean('health_check_enabled')->default(false);
            $table->boolean('icebreaker_enabled')->default(false);
        });
    }
};
