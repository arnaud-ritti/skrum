<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspace_invitations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('email');
            $table->string('role');
            $table->string('token_hash', 64)->unique();
            $table->foreignUuid('invited_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->foreignUuid('team_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('team_role', 20)->nullable();
            $table->string('message', 500)->nullable();
            $table->timestamp('declined_at')->nullable();
            $table->timestamps();

            $table->index(['team_id', 'accepted_at']);
            $table->index(['workspace_id', 'email']);
        });
    }
};
