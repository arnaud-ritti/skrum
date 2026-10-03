<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspace_templates', function (Blueprint $table) {
            $table->string('visibility', 20)->default('workspace');
            $table->foreignUuid('team_id')->nullable()->constrained()->cascadeOnDelete();

            $table->index(['workspace_id', 'visibility']);
        });
    }
};
