<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The primary keys lead with the team or the workspace: finding the memberships of a user needs its own
     * index. MySQL and MariaDB already made one for the foreign key, so it is only added where missing.
     */
    public function up(): void
    {
        foreach (['team_user', 'workspace_user'] as $table) {
            if (Schema::hasIndex($table, ['user_id'])) {
                continue;
            }

            Schema::table($table, function (Blueprint $table): void {
                $table->index('user_id');
            });
        }
    }
};
