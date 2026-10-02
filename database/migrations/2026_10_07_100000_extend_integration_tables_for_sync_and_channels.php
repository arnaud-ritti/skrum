<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('team_integrations', function (Blueprint $table) {
            $table->string('inbound_mode', 10)->default('off');
            $table->string('webhook_status', 10)->nullable();
            $table->timestamp('webhook_expires_at')->nullable();
            $table->timestamp('last_inbound_at')->nullable();
            $table->timestamp('last_polled_at')->nullable();
            $table->timestamp('poll_cursor')->nullable();
            $table->unsignedInteger('consecutive_failures')->default(0);
            $table->timestamp('last_delivery_succeeded_at')->nullable();
        });

        Schema::table('action_item_external_links', function (Blueprint $table) {
            $table->string('external_state', 10)->nullable();
            $table->string('external_status_name', 100)->nullable();
            $table->timestamp('external_updated_at')->nullable();
            $table->timestamp('local_state_changed_at')->nullable();
            $table->string('last_pushed_state', 10)->nullable();
            $table->timestamp('last_pushed_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->string('sync_error', 500)->nullable();
            $table->timestamp('missing_at')->nullable();

            $table->index(['source', 'external_site', 'external_id'], 'action_item_external_links_source_external_site_external_id_ind');
        });

        Schema::table('poker_tasks', function (Blueprint $table) {
            $table->string('external_status_name', 100)->nullable();
            $table->string('external_status_category', 20)->nullable();
            $table->timestamp('external_updated_at')->nullable();
            $table->timestamp('external_missing_at')->nullable();

            $table->index(['external_source', 'external_site', 'external_id']);
        });

        Schema::table('integration_deliveries', function (Blueprint $table) {
            $table->foreignUuid('team_integration_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event', 60)->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->timestamp('last_attempt_at')->nullable();
        });

        Schema::create('integration_inbound_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('provider', 20);
            $table->foreignUuid('team_integration_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event_key', 191);
            $table->string('event_type', 100);
            $table->string('status', 10);
            $table->string('detail', 500)->nullable();
            $table->dateTime('received_at');

            $table->unique(['provider', 'event_key']);
            $table->index('received_at');
        });
    }
};
