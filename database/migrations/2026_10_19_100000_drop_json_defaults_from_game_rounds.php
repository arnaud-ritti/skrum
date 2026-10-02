<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Installs migrated before the defaults left the create migration still have them.
     */
    public function up(): void
    {
        Schema::table('game_rounds', function (Blueprint $table): void {
            $table->jsonb('revealed_positions')->change();
            $table->jsonb('picked_letters')->change();
            $table->jsonb('picked_by')->change();
            $table->jsonb('clue')->change();
            $table->jsonb('drawing')->change();
        });
    }
};
