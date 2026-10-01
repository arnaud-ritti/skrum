<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whiteboard_elements', function (Blueprint $table) {
            $table->timestamp('withheld_at')->nullable();
        });
    }
};
