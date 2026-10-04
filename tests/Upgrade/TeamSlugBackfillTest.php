<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Support\SqlProbe;

const TeamSlugMigration = '2026_10_25_100400_add_slug_to_teams.php';

function migrateUpToTeamSlug(): void
{
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < TeamSlugMigration)
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);
}

function runTeamSlugMigration(): void
{
    Artisan::call('migrate', ['--path' => [database_path('migrations/'.TeamSlugMigration)], '--realpath' => true]);
}

function workspaceBeforeTeamSlug(string $name): string
{
    $id = (string) Str::uuid7();
    DB::table('workspaces')->insert(['id' => $id, 'name' => $name, 'slug' => Str::slug($name).'-'.Str::lower(Str::random(6)), 'created_at' => now(), 'updated_at' => now()]);

    return $id;
}

function teamBeforeTeamSlug(string $workspaceId, string $name, string $createdAt): string
{
    $id = (string) Str::uuid7();
    DB::table('teams')->insert(['id' => $id, 'workspace_id' => $workspaceId, 'name' => $name, 'created_at' => $createdAt, 'updated_at' => $createdAt]);

    return $id;
}

it('gives every existing team a slug, unique in its workspace, in creation order', function () {
    migrateUpToTeamSlug();
    $nordlys = workspaceBeforeTeamSlug('Nordlys');
    $other = workspaceBeforeTeamSlug('Other');
    $newer = teamBeforeTeamSlug($nordlys, 'Atlas', '2026-03-02 10:00:00');
    $older = teamBeforeTeamSlug($nordlys, 'atlas ', '2026-03-01 10:00:00');
    $elsewhere = teamBeforeTeamSlug($other, 'Atlas', '2026-03-03 10:00:00');
    $symbols = teamBeforeTeamSlug($other, '???', '2026-03-03 10:00:00');

    runTeamSlugMigration();

    expect(DB::table('teams')->where('id', $older)->value('slug'))->toBe('atlas')
        ->and(DB::table('teams')->where('id', $newer)->value('slug'))->toBe('atlas-2')
        ->and(DB::table('teams')->where('id', $elsewhere)->value('slug'))->toBe('atlas')
        ->and(DB::table('teams')->where('id', $symbols)->value('slug'))->toBe('team')
        ->and(DB::table('teams')->whereNull('slug')->count())->toBe(0)
        ->and(Schema::hasIndex('teams', ['workspace_id', 'slug'], 'unique'))->toBeTrue()
        ->and(collect(Schema::getColumns('teams'))->firstWhere('name', 'slug')['nullable'])->toBeFalse();
});

it('can run a second time, and then writes no team that already has its slug', function () {
    migrateUpToTeamSlug();
    teamBeforeTeamSlug(workspaceBeforeTeamSlug('Nordlys'), 'Atlas', '2026-03-01 10:00:00');
    runTeamSlugMigration();
    DB::table('migrations')->where('migration', Str::beforeLast(TeamSlugMigration, '.php'))->delete();

    $updates = SqlProbe::updateConditions('teams', fn () => runTeamSlugMigration());

    $indexes = collect(Schema::getIndexes('teams'))->filter(fn (array $index): bool => $index['columns'] === ['workspace_id', 'slug']);

    expect($updates)->toBe([])
        ->and(DB::table('teams')->value('slug'))->toBe('atlas')
        ->and($indexes)->toHaveCount(1);
});

it('fills the slugs outside a transaction, so the teams table is not locked meanwhile', function () {
    $migration = require database_path('migrations/'.TeamSlugMigration);

    expect($migration->withinTransaction)->toBeFalse();
});
