<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('poker_decks', function (Blueprint $table) {
            $table->foreignUuid('workspace_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignUuid('team_id')->nullable()->change();
        });

    }
};
