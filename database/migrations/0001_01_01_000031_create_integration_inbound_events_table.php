<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('integration_inbound_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('provider', 20);
            $table->foreignUuid('team_integration_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event_key', 191);
            $table->string('event_type', 100);
            $table->string('status', 10);
            $table->string('detail', 500)->nullable();
            $table->dateTime('received_at')->index();

            $table->unique(['provider', 'event_key']);
        });
    }
};
