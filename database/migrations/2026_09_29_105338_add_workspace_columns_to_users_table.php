<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_instance_admin')->default(false);
            $table->foreignUuid('current_workspace_id')->nullable()->constrained('workspaces')->nullOnDelete();
        });
    }
};
