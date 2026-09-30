<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuidMorphs('tokenable');
            $table->string('name', 60);
            $table->string('token', 64)->unique();
            $table->json('abilities');
            $table->foreignUuid('team_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('token_hint', 4);
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
        });
    }
};
