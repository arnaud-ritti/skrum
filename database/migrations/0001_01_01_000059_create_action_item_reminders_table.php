<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('action_item_reminders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('action_item_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind');
            $table->date('due_on');
            $table->dateTime('sent_at')->index();

            $table->unique(['action_item_id', 'user_id', 'kind', 'due_on']);
        });
    }
};
