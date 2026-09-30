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
            $table->timestamps();

            $table->unique(['team_id', 'provider']);
            $table->index(['provider', 'status']);
        });

        Schema::create('integration_user_mappings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_integration_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('external_account_id', 128)->nullable();
            $table->string('external_display_name', 255)->nullable();
            $table->string('matched_by', 20);
            $table->timestamp('checked_at');
            $table->timestamps();

            $table->unique(['team_integration_id', 'user_id']);
        });

        Schema::create('action_item_external_links', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('action_item_id')->constrained()->cascadeOnDelete();
            $table->string('source', 20);
            $table->string('external_site', 100);
            $table->string('external_id', 100);
            $table->string('external_key', 50);
            $table->string('external_url', 2048);
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['action_item_id', 'source']);
        });

        Schema::create('integration_deliveries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('channel', 20);
            $table->string('kind', 30);
            $table->uuidMorphs('subject');
            $table->foreignUuid('requested_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 10);
            $table->unsignedInteger('recipient_count')->nullable();
            $table->string('error', 500)->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index('created_at');
        });
    }
};
