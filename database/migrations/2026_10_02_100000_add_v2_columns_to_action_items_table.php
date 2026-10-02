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
    }

    private function backfill(): void
    {
        DB::table('retros')->select(['id', 'team_id'])->lazyById(500)->each(
            fn (object $retro) => DB::table('action_items')->where('retro_id', $retro->id)->update(['team_id' => $retro->team_id]),
        );

        DB::table('action_items')->where('is_done', true)->select(['id', 'updated_at'])->lazyById(500)->each(
            fn (object $item) => DB::table('action_items')->where('id', $item->id)->update(['completed_at' => $item->updated_at]),
        );

        DB::table('participants')->whereNotNull('user_id')->select(['id', 'user_id'])->lazyById(500)->each(function (object $participant): void {
            DB::table('action_items')
                ->where('created_by_participant_id', $participant->id)
                ->whereNull('created_by_user_id')
                ->update(['created_by_user_id' => $participant->user_id]);

            DB::table('action_items')
                ->where('assignee_participant_id', $participant->id)
                ->update(['assignee_user_id' => $participant->user_id, 'assignee_participant_id' => null]);
        });
    }
};
