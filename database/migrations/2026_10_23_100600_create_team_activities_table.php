<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_activities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 40);
            $table->foreignUuid('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_name', 100)->nullable();
            $table->uuid('subject_id')->nullable();
            $table->string('subject_title', 200)->nullable();
            $table->timestamps();

            $table->index(['team_id', 'created_at']);
        });
    }
};
