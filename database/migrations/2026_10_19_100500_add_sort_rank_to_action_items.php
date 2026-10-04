<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Each step commits on its own and is skipped once done: a run that stopped half-way resumes
     * on the open rows still at the default rank.
     *
     * @var bool
     */
    public $withinTransaction = false;

    /**
     * The ranks as ActionItem::sortRankFor computed them when this migration was written, frozen here so
     * that a later change of that formula cannot change what this migration writes.
     */
    private const int CompletedSortRank = 2_000_000_000;

    private const int UndatedSortRank = 1_000_000_000;

    private const array PriorityWeights = ['high' => 0, 'medium' => 1, 'low' => 2];

    /**
     * The order of the action-item list, as a column: no engine-specific sort expression is needed.
     * Completed rows already hold their rank, the default of the new column; only open ones are written.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('action_items', 'sort_rank')) {
            Schema::table('action_items', function (Blueprint $table): void {
                $table->unsignedInteger('sort_rank')->default(self::CompletedSortRank);
            });
        }

        DB::table('action_items')
            ->whereNull('completed_at')
            ->where('sort_rank', self::CompletedSortRank)
            ->select(['id', 'due_on', 'priority'])
            ->lazyById(500)
            ->each(fn (object $item) => DB::table('action_items')->where('id', $item->id)->update([
                'sort_rank' => $this->openRank($item->due_on === null ? null : (string) $item->due_on, (string) $item->priority),
            ]));

        Schema::table('action_items', function (Blueprint $table): void {
            $table->unsignedInteger('sort_rank')->default(null)->change();
        });

        if (! Schema::hasIndex('action_items', ['team_id', 'sort_rank'])) {
            Schema::table('action_items', function (Blueprint $table): void {
                $table->index(['team_id', 'sort_rank']);
            });
        }
    }

    private function openRank(?string $dueOn, string $priority): int
    {
        $weight = self::PriorityWeights[$priority] ?? self::PriorityWeights['low'];

        if ($dueOn === null) {
            return self::UndatedSortRank + $weight;
        }

        return (int) str_replace('-', '', substr($dueOn, 0, 10)) * 10 + $weight;
    }
};
