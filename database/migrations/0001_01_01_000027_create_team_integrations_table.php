<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_integrations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 20);
            $table->string('status', 30);
            $table->string('access', 10);
            $table->text('credentials');
            $table->json('settings');
            $table->json('scopes');
            $table->foreignUuid('connected_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('last_error', 500)->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->string('inbound_mode', 10)->default('off');
            $table->string('webhook_status', 10)->nullable();
            $table->timestamp('webhook_expires_at')->nullable();
            $table->timestamp('last_inbound_at')->nullable();
            $table->timestamp('last_polled_at')->nullable();
            $table->timestamp('poll_cursor')->nullable();
            $table->unsignedInteger('consecutive_failures')->default(0);
            $table->timestamp('last_delivery_succeeded_at')->nullable();
            $table->timestamps();

            $table->index(['provider', 'status']);
            $table->unique(['team_id', 'provider']);
        });
    }
};
