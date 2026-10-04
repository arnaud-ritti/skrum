<?php

use App\Support\Teams\TeamSlug;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Off, so that the teams table is not locked while its rows are filled. The work can then
     * stop midway: up() fills only the teams without a slug and can be run again.
     *
     * @var bool
     */
    public $withinTransaction = false;

    public function up(): void
    {
        if (! Schema::hasColumn('teams', 'slug')) {
            Schema::table('teams', function (Blueprint $table): void {
                $table->string('slug', TeamSlug::MaxLength)->nullable();
            });
        }

        DB::table('teams')
            ->whereNull('slug')
            ->distinct()
            ->pluck('workspace_id')
            ->each(fn (string $workspaceId) => $this->fillWorkspace($workspaceId));

        $hasIndex = Schema::hasIndex('teams', ['workspace_id', 'slug'], 'unique');

        Schema::table('teams', function (Blueprint $table) use ($hasIndex): void {
            $table->string('slug', TeamSlug::MaxLength)->nullable(false)->change();

            if (! $hasIndex) {
                $table->unique(['workspace_id', 'slug']);
            }
        });
    }

    /**
     * The order is decided in PHP: where an engine sorts a missing creation date is not left to it.
     * A team without one comes first, then by id.
     */
    private function fillWorkspace(string $workspaceId): void
    {
        $teams = DB::table('teams')->where('workspace_id', $workspaceId)->get(['id', 'name', 'slug', 'created_at']);

        /** @var array<int, string> $taken */
        $taken = $teams->whereNotNull('slug')->pluck('slug')->all();

        $teams->whereNull('slug')
            ->sort(function (object $a, object $b): int {
                $byCreation = strcmp((string) $a->created_at, (string) $b->created_at);

                if ($byCreation !== 0) {
                    return $byCreation;
                }

                return strcmp((string) $a->id, (string) $b->id);
            })
            ->each(function (object $team) use (&$taken): void {
                $slug = TeamSlug::firstFree(TeamSlug::fromName((string) $team->name), $taken);
                $taken[] = $slug;

                DB::table('teams')->where('id', $team->id)->update(['slug' => $slug]);
            });
    }
};
