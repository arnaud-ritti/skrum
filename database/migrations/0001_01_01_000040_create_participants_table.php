<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('participants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('guest_name', 50)->nullable();
            $table->string('guest_secret_hash', 64)->nullable();
            $table->dateTime('voting_finished_at')->nullable();
            $table->dateTime('writing_until')->nullable();
            $table->unsignedTinyInteger('presence_color')->nullable();
            $table->timestamps();

            $table->unique(['retro_id', 'user_id']);
        });

        Schema::table('retros', function (Blueprint $table) {
            $table->foreign('facilitator_participant_id')->references('id')->on('participants')->nullOnDelete();
        });
    }
};
