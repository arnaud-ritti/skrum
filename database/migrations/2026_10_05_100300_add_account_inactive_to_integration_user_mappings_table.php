<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('integration_user_mappings', function (Blueprint $table) {
            $table->boolean('account_inactive')->default(false)->after('matched_by');
        });
    }
};
