<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('poker_decks', function (Blueprint $table) {
            $table->foreignUuid('workspace_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignUuid('team_id')->nullable()->change();
        });

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('alter table poker_decks add constraint poker_decks_single_owner check ((team_id is null) <> (workspace_id is null))');
        DB::statement('create unique index poker_decks_workspace_name_unique on poker_decks (workspace_id, lower(name)) where workspace_id is not null');
    }
};
