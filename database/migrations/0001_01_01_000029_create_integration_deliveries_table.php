<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('integration_deliveries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('channel', 20);
            $table->string('kind', 30);
            $table->string('subject_type');
            $table->uuid('subject_id');
            $table->foreignUuid('requested_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 10);
            $table->unsignedInteger('recipient_count')->nullable();
            $table->string('error', 500)->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->foreignUuid('team_integration_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event', 60)->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->timestamp('last_attempt_at')->nullable();
            $table->uuid('redelivery_of_id')->nullable()->index();
            $table->timestamps();

            $table->index(['subject_type', 'subject_id']);
            $table->index('created_at');
        });

        Schema::table('integration_deliveries', function (Blueprint $table) {
            $table->foreign('redelivery_of_id')->references('id')->on('integration_deliveries')->nullOnDelete();
        });
    }
};
