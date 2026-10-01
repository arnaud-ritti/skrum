<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "Completed in :source" (spec 8 §9): the tracker whose status sync
     * completed the item; cleared by any other status change.
     */
    public function up(): void
    {
        Schema::table('action_items', function (Blueprint $table) {
            $table->string('completed_via_source', 20)->nullable();
        });
    }
};
