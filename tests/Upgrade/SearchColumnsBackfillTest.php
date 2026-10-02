<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** @param array<string, mixed> $values */
function rowBeforeSearchColumns(string $table, array $values): string
{
    $id = (string) Str::uuid7();

    DB::table($table)->insert(['id' => $id, 'created_at' => now(), 'updated_at' => now(), ...$values]);

    return $id;
}

it('fills the folded columns of the rows that exist when the migration runs', function () {
    $migration = '2026_10_19_100600_add_search_columns.php';
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < $migration)
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);

    $workspace = rowBeforeSearchColumns('workspaces', ['name' => 'Acme', 'slug' => 'acme']);
    $team = rowBeforeSearchColumns('teams', ['workspace_id' => $workspace, 'name' => 'Platform']);
    $summarised = rowBeforeSearchColumns('retros', [
        'team_id' => $team,
        'title' => 'Sprint ÉTÉ',
        'summary' => 'Livré À Temps',
        'template' => 'start_stop_continue',
        'guest_token' => Str::random(40),
    ]);
    $plain = rowBeforeSearchColumns('retros', [
        'team_id' => $team,
        'title' => 'Bilan 100%',
        'template' => 'start_stop_continue',
        'guest_token' => Str::random(40),
    ]);

    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);

    $summarised = DB::table('retros')->where('id', $summarised)->first();
    $plain = DB::table('retros')->where('id', $plain)->first();

    expect($summarised->title_search)->toBe('sprint été')
        ->and($summarised->summary_search)->toBe('livré à temps')
        ->and($summarised->title)->toBe('Sprint ÉTÉ')
        ->and($plain->title_search)->toBe('bilan 100%')
        ->and($plain->summary_search)->toBeNull();
});
