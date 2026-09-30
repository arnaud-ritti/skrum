<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('action_item_reminders_by_email')->default(true);
            $table->boolean('action_item_reminders_in_app')->default(true);
        });
    }
};
