<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

const SearchColumnsMigration = '2026_10_19_100600_add_search_columns.php';

/** @param array<string, mixed> $values */
function rowBeforeSearchColumns(string $table, array $values): string
{
    $id = (string) Str::uuid7();

    DB::table($table)->insert(['id' => $id, 'created_at' => now(), 'updated_at' => now(), ...$values]);

    return $id;
}

function migrateUpToSearchColumns(): void
{
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < SearchColumnsMigration)
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);
}

function runSearchColumnsMigration(): int
{
    return Artisan::call('migrate', ['--path' => [database_path('migrations/'.SearchColumnsMigration)], '--realpath' => true]);
}

/** @return array{retro: string, plainRetro: string, card: string, actionItem: string, pokerTask: string, user: string} */
function rowsBeforeSearchColumns(): array
{
    $workspace = rowBeforeSearchColumns('workspaces', ['name' => 'Acme', 'slug' => 'acme']);
    $team = rowBeforeSearchColumns('teams', ['workspace_id' => $workspace, 'name' => 'Platform']);
    $user = rowBeforeSearchColumns('users', ['name' => 'Émile ZOLA', 'email' => 'emile@example.test', 'password' => 'secret']);
    $retro = rowBeforeSearchColumns('retros', [
        'team_id' => $team,
        'title' => 'Sprint ÉTÉ',
        'summary' => 'Livré À Temps',
        'template' => 'start_stop_continue',
        'guest_token' => Str::random(40),
    ]);
    $plainRetro = rowBeforeSearchColumns('retros', [
        'team_id' => $team,
        'title' => 'Bilan 100%',
        'template' => 'start_stop_continue',
        'guest_token' => Str::random(40),
    ]);
    $participant = rowBeforeSearchColumns('participants', ['retro_id' => $retro, 'user_id' => $user]);
    $column = rowBeforeSearchColumns('columns', ['retro_id' => $retro, 'title' => 'Start', 'color' => 'blue', 'position' => 0]);
    $game = rowBeforeSearchColumns('poker_games', [
        'team_id' => $team,
        'title' => 'Sprint 12',
        'deck' => 'fibonacci',
        'cards' => '["1","2","3"]',
        'guest_token' => Str::random(40),
    ]);

    return [
        'retro' => $retro,
        'plainRetro' => $plainRetro,
        'card' => rowBeforeSearchColumns('cards', [
            'retro_id' => $retro,
            'column_id' => $column,
            'participant_id' => $participant,
            'content' => 'Déploiement LENT',
        ]),
        'actionItem' => rowBeforeSearchColumns('action_items', [
            'retro_id' => $retro,
            'team_id' => $team,
            'content' => 'Écrire le RUNBOOK',
            'sort_rank' => 1_000_000_001,
        ]),
        'pokerTask' => rowBeforeSearchColumns('poker_tasks', ['poker_game_id' => $game, 'title' => 'Page de CONNEXION', 'position' => 0]),
        'user' => $user,
    ];
}

it('fills the folded columns of the rows that exist in every searched table when the migration runs', function () {
    migrateUpToSearchColumns();
    $ids = rowsBeforeSearchColumns();

    runSearchColumnsMigration();

    $retro = DB::table('retros')->where('id', $ids['retro'])->first();
    $plainRetro = DB::table('retros')->where('id', $ids['plainRetro'])->first();

    expect($retro->title_search)->toBe('sprint été')
        ->and($retro->summary_search)->toBe('livré à temps')
        ->and($retro->title)->toBe('Sprint ÉTÉ')
        ->and($plainRetro->title_search)->toBe('bilan 100%')
        ->and($plainRetro->summary_search)->toBeNull()
        ->and(DB::table('cards')->where('id', $ids['card'])->value('content_search'))->toBe('déploiement lent')
        ->and(DB::table('action_items')->where('id', $ids['actionItem'])->value('content_search'))->toBe('écrire le runbook')
        ->and(DB::table('poker_tasks')->where('id', $ids['pokerTask'])->value('title_search'))->toBe('page de connexion')
        ->and(DB::table('users')->where('id', $ids['user'])->value('name_search'))->toBe('émile zola');
});

it('fills more rows than it reads at once', function () {
    migrateUpToSearchColumns();
    DB::table('users')->insert(collect(range(1, 501))->map(fn (int $number): array => [
        'id' => (string) Str::uuid7(),
        'name' => "Person {$number}",
        'email' => "person{$number}@example.test",
        'password' => 'secret',
    ])->all());

    runSearchColumnsMigration();

    expect(DB::table('users')->whereNull('name_search')->count())->toBe(0)
        ->and(DB::table('users')->where('email', 'person501@example.test')->value('name_search'))->toBe('person 501');
});

it('finishes the work when it is run again after stopping midway', function () {
    migrateUpToSearchColumns();
    $ids = rowsBeforeSearchColumns();
    runSearchColumnsMigration();
    DB::table('retros')->where('id', $ids['retro'])->update(['title_search' => 'filled before the stop', 'summary_search' => null]);
    DB::table('cards')->update(['content_search' => null]);
    DB::table('migrations')->where('migration', Str::before(SearchColumnsMigration, '.php'))->delete();

    $exitCode = runSearchColumnsMigration();

    $retro = DB::table('retros')->where('id', $ids['retro'])->first();

    expect($exitCode)->toBe(0)
        ->and($retro->title_search)->toBe('filled before the stop')
        ->and($retro->summary_search)->toBe('livré à temps')
        ->and(DB::table('cards')->where('id', $ids['card'])->value('content_search'))->toBe('déploiement lent')
        ->and(DB::table('migrations')->where('migration', Str::before(SearchColumnsMigration, '.php'))->count())->toBe(1);
});
