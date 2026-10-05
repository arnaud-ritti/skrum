<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('action_item_external_links', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('action_item_id')->constrained()->cascadeOnDelete();
            $table->string('source', 20);
            $table->string('external_site', 100);
            $table->string('external_id', 100);
            $table->string('external_key', 150);
            $table->string('external_url', 2048);
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('external_state', 10)->nullable();
            $table->string('external_status_name', 100)->nullable();
            $table->timestamp('external_updated_at')->nullable();
            $table->timestamp('local_state_changed_at')->nullable();
            $table->string('last_pushed_state', 10)->nullable();
            $table->timestamp('last_pushed_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->string('sync_error', 500)->nullable();
            $table->timestamp('missing_at')->nullable();
            $table->text('external_key_search')->nullable();
            $table->timestamps();

            $table->unique(['action_item_id', 'source']);
            $table->index(['source', 'external_site', 'external_id'], 'action_item_external_links_source_external_site_external_id_ind');
        });
    }
};
