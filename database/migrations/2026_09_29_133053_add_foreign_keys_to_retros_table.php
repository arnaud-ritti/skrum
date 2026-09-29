<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retros', function (Blueprint $table) {
            $table->foreign('facilitator_participant_id')->references('id')->on('participants')->nullOnDelete();
            $table->foreign('highlighted_card_id')->references('id')->on('cards')->nullOnDelete();
        });
    }
};
