<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->unsignedTinyInteger('presence_color')->nullable();
            $table->string('avatar_photo_path', 64)->nullable();
            $table->boolean('reduce_motion')->default(false);
            $table->dateTime('password_set_at')->nullable();
        });
    }
};
