<?php

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Each step commits on its own, so the table is not locked while the rows are filled, and every step
     * is skipped once done: a run that stopped half-way resumes on the rows still without a week.
     *
     * @var bool
     */
    public $withinTransaction = false;

    /**
     * The Monday (UTC) of the week a row was created in, stored so that streaks group by a plain column.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('game_points', 'week_start')) {
            Schema::table('game_points', function (Blueprint $table): void {
                $table->date('week_start')->nullable();
            });
        }

        DB::table('game_points')->whereNull('week_start')->select(['id', 'created_at'])->chunkById(500, function (Collection $points): void {
            $points
                ->groupBy(fn (object $point): string => CarbonImmutable::parse((string) $point->created_at, 'UTC')->startOfWeek(CarbonInterface::MONDAY)->toDateString())
                ->each(fn (Collection $ofTheWeek, string $monday) => DB::table('game_points')
                    ->whereIn('id', $ofTheWeek->pluck('id')->all())
                    ->update(['week_start' => $monday]));
        });

        Schema::table('game_points', function (Blueprint $table): void {
            $table->date('week_start')->nullable(false)->change();
        });

        if (! Schema::hasIndex('game_points', ['team_id', 'user_id', 'week_start'])) {
            Schema::table('game_points', function (Blueprint $table): void {
                $table->index(['team_id', 'user_id', 'week_start']);
            });
        }
    }
};
