<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['participants', 'poker_players', 'whiteboard_members', 'team_survey_respondents', 'game_players'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table): void {
                $table->unsignedTinyInteger('presence_color')->nullable();
            });
        }
    }
};
