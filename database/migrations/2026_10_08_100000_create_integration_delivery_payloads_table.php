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
            $table->foreignUuid('integration_delivery_id')->unique()->constrained()->cascadeOnDelete();
            $table->text('message');
            $table->text('request_headers')->nullable();
            $table->text('request_body')->nullable();
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->text('response_excerpt')->nullable();
            $table->timestamps();

            $table->index('created_at');
        });

        Schema::table('integration_deliveries', function (Blueprint $table) {
            $table->foreignUuid('redelivery_of_id')->nullable()->constrained('integration_deliveries')->nullOnDelete();
        });
    }
};
