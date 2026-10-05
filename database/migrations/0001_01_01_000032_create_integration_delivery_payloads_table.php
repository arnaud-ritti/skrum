<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('integration_delivery_payloads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('integration_delivery_id')->unique()->constrained('integration_deliveries')->cascadeOnDelete();
            $table->longText('message');
            $table->longText('request_headers')->nullable();
            $table->longText('request_body')->nullable();
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->longText('response_excerpt')->nullable();
            $table->timestamps();

            $table->index('created_at');
        });
    }
};
