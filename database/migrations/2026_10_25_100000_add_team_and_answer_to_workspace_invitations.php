<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspace_invitations', function (Blueprint $table) {
            $table->foreignUuid('team_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('team_role', 20)->nullable();
            $table->string('message', 500)->nullable();
            $table->timestamp('declined_at')->nullable();

            $table->index(['team_id', 'accepted_at']);
        });
    }
};
