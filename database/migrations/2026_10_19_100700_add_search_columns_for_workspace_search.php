<?php

use App\Support\Database\SearchText;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<string, array<string, string>> */
    private const array Columns = [
        'poker_games' => ['title' => 'title_search'],
        'whiteboards' => ['title' => 'title_search'],
        'game_rooms' => ['name' => 'name_search'],
    ];

    /**
     * Off, so that no table stays locked while its rows are filled. The work can then stop midway:
     * up() adds only what is missing and can be run again.
     */
    public $withinTransaction = false;

    /**
     * A lower-cased copy of the columns the workspace search reads, as the earlier migration did for
     * the board search. Existing rows are filled here, one update per row still to fill.
     */
    public function up(): void
    {
        foreach (self::Columns as $table => $columns) {
            $missing = array_filter($columns, fn (string $folded): bool => ! Schema::hasColumn($table, $folded));

            if ($missing !== []) {
                Schema::table($table, function (Blueprint $blueprint) use ($missing): void {
                    foreach ($missing as $folded) {
                        $blueprint->text($folded)->nullable();
                    }
                });
            }

            DB::table($table)
                ->select(['id', ...array_keys($columns), ...array_values($columns)])
                ->where(function (Builder $query) use ($columns): void {
                    foreach ($columns as $column => $folded) {
                        $query->orWhere(fn (Builder $unfilled) => $unfilled->whereNull($folded)->whereNotNull($column));
                    }
                })
                ->lazyById(500)
                ->each(fn (object $row) => DB::table($table)->where('id', $row->id)->update(
                    collect($columns)
                        ->filter(fn (string $folded): bool => $row->{$folded} === null)
                        ->mapWithKeys(fn (string $folded, string $column): array => [$folded => SearchText::fold($row->{$column})])
                        ->all(),
                ));
        }
    }
};
