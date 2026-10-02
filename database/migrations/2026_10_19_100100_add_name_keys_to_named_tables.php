<?php

use App\Support\Database\NameKey;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<string, array<int, string>> */
    private const array Owners = [
        'workspace_templates' => ['workspace_id'],
        'whiteboard_templates' => ['workspace_id'],
        'poker_decks' => ['team_id', 'workspace_id'],
    ];

    /** @var array<string, array<int, string>> */
    private const array ExpressionIndexes = [
        'workspace_templates' => ['workspace_templates_workspace_name_unique'],
        'whiteboard_templates' => ['whiteboard_templates_workspace_name_unique'],
        'poker_decks' => ['poker_decks_team_name_unique', 'poker_decks_workspace_name_unique'],
    ];

    private const int KeyLength = 160;

    private const int SuffixLength = 10;

    /**
     * The key replaces the unique indexes on lower(name) that only PostgreSQL had.
     * They are dropped last, once the new indexes exist. Each step looks at what is already
     * there, so a run that stopped midway on an engine without transactional DDL can be run again.
     */
    public function up(): void
    {
        foreach (self::Owners as $table => $owners) {
            if (! Schema::hasColumn($table, 'name_key')) {
                Schema::table($table, function (Blueprint $blueprint): void {
                    $blueprint->string('name_key', self::KeyLength)->nullable();
                });
            }

            $this->backfill($table, $owners);

            $missingIndexes = array_filter($owners, fn (string $owner): bool => ! Schema::hasIndex($table, [$owner, 'name_key'], 'unique'));

            Schema::table($table, function (Blueprint $blueprint) use ($missingIndexes): void {
                $blueprint->string('name_key', self::KeyLength)->nullable(false)->change();

                foreach ($missingIndexes as $owner) {
                    $blueprint->unique([$owner, 'name_key']);
                }
            });

            foreach (self::ExpressionIndexes[$table] as $index) {
                if (! Schema::hasIndex($table, $index)) {
                    continue;
                }

                Schema::table($table, function (Blueprint $blueprint) use ($index): void {
                    $blueprint->dropIndex($index);
                });
            }
        }
    }

    /**
     * Public so a test can run it. Oldest row first: it keeps the plain key, a later row of the
     * same owner with the same key gets a suffix. Names are never changed. The keys seen are
     * held in memory: at most 100 templates and 50 whiteboard templates per workspace, and the
     * saved decks of each owner, which SavedPokerDeckRules caps.
     *
     * @param  array<int, string>  $owners
     */
    public function backfill(string $table, array $owners): void
    {
        $taken = [];

        foreach (DB::table($table)->lazyById(500) as $row) {
            $key = NameKey::of((string) $row->name);
            $scope = implode('|', array_map(fn (string $owner): string => (string) $row->{$owner}, $owners));

            if (isset($taken[$scope][$key])) {
                $key = mb_substr($key, 0, self::KeyLength - self::SuffixLength).' ~'.substr((string) $row->id, -8);

                Log::warning("Two rows of {$table} share a name once case and spaces are ignored; row {$row->id} keeps its name and gets its own key.", [
                    'table' => $table,
                    'id' => $row->id,
                    'name' => $row->name,
                ]);
            }

            $taken[$scope][$key] = true;

            DB::table($table)->where('id', $row->id)->update(['name_key' => $key]);
        }
    }
};
