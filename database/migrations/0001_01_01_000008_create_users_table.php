<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->text('two_factor_secret')->nullable();
            $table->text('two_factor_recovery_codes')->nullable();
            $table->timestamp('two_factor_confirmed_at')->nullable();
            $table->string('locale', 5)->nullable();
            $table->boolean('is_instance_admin')->default(false);
            $table->foreignUuid('current_workspace_id')->nullable()->constrained('workspaces')->nullOnDelete();
            $table->boolean('action_item_reminders_by_email')->default(true);
            $table->boolean('action_item_reminders_in_app')->default(true);
            $table->string('avatar_style')->nullable();
            $table->timestamp('two_factor_email_enabled_at')->nullable();
            $table->boolean('recap_emails')->default(true);
            $table->boolean('single_key_shortcuts')->default(true);
            $table->boolean('recap_in_app')->default(true);
            $table->string('email_key')->index();
            $table->text('name_search')->nullable();
            $table->dateTime('deactivated_at')->nullable();
            $table->dateTime('last_signed_in_at')->nullable();
            $table->unsignedTinyInteger('presence_color')->nullable();
            $table->string('avatar_photo_path', 64)->nullable();
            $table->boolean('reduce_motion')->default(false);
            $table->dateTime('password_set_at')->nullable();
            $table->timestamps();
        });
    }
};
