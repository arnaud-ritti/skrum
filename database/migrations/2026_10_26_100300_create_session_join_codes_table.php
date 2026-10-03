<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('session_join_codes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 8)->unique();
            $table->string('session_kind', 16);
            $table->uuid('session_id');
            $table->timestamps();

            $table->unique(['session_kind', 'session_id']);
        });
    }
};
