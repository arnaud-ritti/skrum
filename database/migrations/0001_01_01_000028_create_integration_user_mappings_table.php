<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('integration_user_mappings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_integration_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('external_account_id', 128)->nullable();
            $table->string('external_display_name')->nullable();
            $table->string('matched_by', 20);
            $table->dateTime('checked_at');
            $table->boolean('account_inactive')->default(false);
            $table->timestamps();

            $table->unique(['team_integration_id', 'user_id']);
        });
    }
};
