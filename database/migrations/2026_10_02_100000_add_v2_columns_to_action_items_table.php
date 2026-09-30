<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('action_items', function (Blueprint $table) {
            $table->foreignUuid('team_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('priority')->default('medium');
            $table->date('due_on')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignUuid('assignee_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('recurrence')->nullable();
            $table->foreignUuid('previous_occurrence_id')->nullable()->unique()->constrained('action_items')->nullOnDelete();
        });

        $this->backfill();

        Schema::table('action_items', function (Blueprint $table) {
            $table->dropForeign(['created_by_participant_id']);
        });

        Schema::table('action_items', function (Blueprint $table) {
            $table->uuid('team_id')->nullable(false)->change();
            $table->uuid('retro_id')->nullable()->change();
            $table->uuid('created_by_participant_id')->nullable()->change();
            $table->foreign('created_by_participant_id')->references('id')->on('participants')->nullOnDelete();
            $table->dropColumn('is_done');
            $table->index(['team_id', 'completed_at', 'due_on']);
            $table->index(['assignee_user_id', 'completed_at']);
            $table->index(['completed_at', 'due_on']);
        });

        $this->addChecks();
    }

    /**
     * Public so a test can run it against rows shaped like the legacy table.
     */
    public function backfill(): void
    {
        DB::table('action_items')->whereNotNull('retro_id')->update([
            'team_id' => DB::raw('(select retros.team_id from retros where retros.id = action_items.retro_id)'),
        ]);

        DB::table('action_items')->where('is_done', true)->update([
            'completed_at' => DB::raw('action_items.updated_at'),
        ]);

        DB::table('action_items')->whereNull('created_by_user_id')->whereNotNull('created_by_participant_id')->update([
            'created_by_user_id' => DB::raw('(select participants.user_id from participants where participants.id = action_items.created_by_participant_id)'),
        ]);

        DB::table('action_items')
            ->whereIn('assignee_participant_id', DB::table('participants')->select('id')->whereNotNull('user_id'))
            ->update([
                'assignee_user_id' => DB::raw('(select participants.user_id from participants where participants.id = action_items.assignee_participant_id)'),
                'assignee_participant_id' => null,
            ]);
    }

    private function addChecks(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('alter table action_items add constraint action_items_single_assignee check (assignee_user_id is null or assignee_participant_id is null)');
        DB::statement('alter table action_items add constraint action_items_guest_assignee_needs_retro check (retro_id is not null or assignee_participant_id is null)');
        DB::statement('alter table action_items add constraint action_items_recurrence_needs_due_date check (recurrence is null or due_on is not null)');
    }
};
