<?php

use App\Support\Database\SearchText;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<string, array<string, string>> */
    private const array Columns = [
        'retros' => ['title' => 'title_search', 'summary' => 'summary_search'],
        'cards' => ['content' => 'content_search'],
        'action_items' => ['content' => 'content_search'],
        'poker_tasks' => ['title' => 'title_search'],
        'users' => ['name' => 'name_search'],
    ];

    /**
     * A lower-cased copy of each searched column, so that search compares the same bytes on every
     * engine. Existing rows are filled here, one update per row.
     */
    public function up(): void
    {
        foreach (self::Columns as $table => $columns) {
            Schema::table($table, function (Blueprint $blueprint) use ($columns): void {
                foreach ($columns as $folded) {
                    $blueprint->text($folded)->nullable();
                }
            });

            DB::table($table)->select(['id', ...array_keys($columns)])->lazyById(500)->each(
                fn (object $row) => DB::table($table)->where('id', $row->id)->update(
                    collect($columns)->mapWithKeys(fn (string $folded, string $column): array => [$folded => SearchText::fold($row->{$column})])->all(),
                ),
            );
        }
    }
};
