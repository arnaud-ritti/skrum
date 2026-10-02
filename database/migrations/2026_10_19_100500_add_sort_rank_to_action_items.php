<?php

use App\Enums\ActionItemPriority;
use App\Models\ActionItem;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The order of the action-item list, as a column: no engine-specific sort expression is needed.
     * Completed rows already hold their rank, the default of the new column; only open ones are written.
     */
    public function up(): void
    {
        Schema::table('action_items', function (Blueprint $table): void {
            $table->unsignedInteger('sort_rank')->default(ActionItem::CompletedSortRank);
        });

        DB::table('action_items')->whereNull('completed_at')->select(['id', 'completed_at', 'due_on', 'priority'])->lazyById(500)->each(
            fn (object $item) => DB::table('action_items')->where('id', $item->id)->update([
                'sort_rank' => ActionItem::sortRankFor(
                    $item->completed_at !== null,
                    $item->due_on === null ? null : (string) $item->due_on,
                    ActionItemPriority::tryFrom((string) $item->priority),
                ),
            ]),
        );

        Schema::table('action_items', function (Blueprint $table): void {
            $table->unsignedInteger('sort_rank')->default(null)->change();
            $table->index(['team_id', 'sort_rank']);
        });
    }
};
