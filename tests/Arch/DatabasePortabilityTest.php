<?php

/**
 * @return array<string, array<string, string>>
 */
function databasePortabilityRules(): array
{
    $source = [
        'ilike' => '/[\'"](?:not )?ilike[\'"]|\bilike\s+[\'?:]/i',
        'cast with ::' => '/(?:\'|\w\))::(?:jsonb?|text|int|integer|bigint|uuid|date|timestamp|timestamptz|numeric|bool|boolean|varchar|citext)\b/',
        'filter (where' => '/filter\s*\(\s*where/i',
        'nulls first or last' => '/nulls\s+(?:first|last)/i',
        'postgres function or clause' => '/date_trunc|\binterval\s+\'|distinct\s+on\b|string_agg|[\'"][^\'"\n]*(?:\bon\s+conflict\b|\breturning\b|~\*|\bextract\s*\()/i',
        'insertOrIgnore' => '/->insertOrIgnore\(/',
        'json contains or length' => '/->(?:or)?where(?:Json(?:Doesnt)?Contain|JsonLength)\w*\(/i',
        'engine-specific operator' => '/->(?:or)?where(?:Not)?\(\s*[^,;]+,\s*[\'"](?:like binary|not like binary|rlike|not rlike|regexp|not regexp|similar to|not similar to|~\*?|!~\*?|@>|<@|\?\||\?&|&&)[\'"]/i',
        'like comparison' => '/[\'"](?:not )?like[\'"]|->(?:or)?where(?:Not)?Like\((?:(?!caseSensitive:\s*true)(?!\)\s*->)[^;])*(?:;|\)\s*->)/i',
        'write without model events' => '/WithoutModelEvents|withoutEvents\(|->(?:save|update|create|createMany|forceCreate|push|delete|forceDelete|restore)Quietly\(/',
        'driver branch' => '/getDriverName\(|getDriverTitle\(|instanceof\s+\\\\?(?:[\w\\\\]*\\\\)?(?:Postgres|MySql|MariaDb|SQLite|SqlServer)\w*|config\(\s*[\'"]database\.default[\'"]\s*\)\s*[=!]==?/',
        'boolean literal in raw sql' => '/Raw\(\s*[\'"](?:false|true)[\'"]/i',
        'whereRaw' => '/->(?:or)?whereRaw\(/',
        'selectRaw' => '/->selectRaw\(/',
        'orderByRaw' => '/->orderByRaw\(/',
        'havingRaw' => '/->(?:or)?havingRaw\(/',
        'groupByRaw' => '/->groupByRaw\(/',
        'fromRaw' => '/->fromRaw\(/',
        'raw expression' => '/DB::raw\(|->raw\(|new Expression\(/',
        'raw statement' => '/(?:DB::|->)(?:statement|unprepared|affectingStatement)\(|DB::(?:select|selectOne|selectResultSets|scalar|cursor|insert|update|delete)\(/',
        'sql string on a connection' => '/->(?:scalar|select|selectOne|statement|unprepared|insert|update|delete|affectingStatement)\(\s*[\'"](?:select|insert|update|delete|alter|create|drop|pragma|set|show)\b/i',
    ];

    $migrations = [
        'non-null timestamp' => '/->timestamp\((?:(?!->nullable\(|->useCurrent\(|;).)*;/s',
        'expression default' => '/->default\(\s*new Expression/',
        'column collation' => '/->(?:collation|charset)\(/',
        'raw index or column' => '/->(?:rawIndex|rawColumn)\(/',
        'type that differs per engine' => '/->(?:enum|set|timestampTz|timestampsTz|dateTimeTz|softDeletesTz|ulid|geometry|geography|vector)\(/',
    ];

    $tests = [
        'driver branch' => '/getDriverName\(/',
        'lock syntax' => '/\bfor update\b|\bfor share\b|\block in share mode\b/i',
        'sql error as a failure' => '/select 1 \/ 0/i',
        'ddl in a test' => '/Schema::(?:drop|dropIfExists|create|table|rename)\(/',
        'reads sql text' => '/\$\w+->sql\b|DB::listen\(|collect\(\s*DB::getQueryLog\(\)|DB::getQueryLog\(\)\s*\[|array_column\(\s*DB::getQueryLog\(\)|->pluck\(\s*[\'"]query[\'"]\s*\)/',
    ];

    return ['source' => $source, 'migrations' => $migrations, 'tests' => $tests];
}

/**
 * @param  array<int, string>  $skipped  path prefixes, relative to the project
 * @param  array<string, string>  $rules
 * @return array<string, int>
 */
function databasePortabilityScan(string $directory, array $skipped, array $rules): array
{
    $root = dirname(__DIR__, 2).'/';
    $offences = [];
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root.$directory, FilesystemIterator::SKIP_DOTS));

    foreach ($files as $file) {
        $path = substr($file->getPathname(), strlen($root));

        if ($file->getExtension() !== 'php' || array_any($skipped, fn (string $prefix): bool => str_starts_with($path, $prefix))) {
            continue;
        }

        $source = (string) file_get_contents($file->getPathname());

        foreach ($rules as $name => $pattern) {
            $count = preg_match_all($pattern, $source);

            if ($count > 0) {
                $offences["{$path}|{$name}"] = $count;
            }
        }
    }

    return $offences;
}

/**
 * @return array<string, int>
 */
function databasePortabilityOffences(): array
{
    $rules = databasePortabilityRules();

    $offences = [
        ...databasePortabilityScan('app', [], $rules['source']),
        ...databasePortabilityScan('database', [], [...$rules['source'], ...$rules['migrations']]),
        ...databasePortabilityScan('tests', ['tests/Support/', 'tests/Concurrency/Support/', 'tests/Arch/DatabasePortabilityTest.php'], $rules['tests']),
    ];

    ksort($offences);

    return $offences;
}

/**
 * @param  array<int, string>  $lines
 */
function databasePortabilityMessage(string $heading, array $lines): string
{
    return "{$heading} (path|rule: count):\n  ".implode("\n  ", $lines)."\n\n"
        .'Owner rule: use Eloquent simply, without raw queries, and respect Laravel conventions. '
        .'In app/ and database/ (migrations, seeders, factories): no whereRaw, orWhereRaw, selectRaw, orderByRaw, havingRaw, '
        .'groupByRaw, fromRaw, DB::raw, DB::statement, DB::unprepared, no DB::select/insert/update/delete with an SQL string, '
        .'no Expression object, no raw index or constraint SQL in a migration, and no getDriverName() or other branch on the driver. '
        .'Only Eloquent models, relationships, scopes, the standard methods of the query builder, and the Schema builder in migrations; '
        .'what SQL cannot say the same way on PostgreSQL, MySQL, MariaDB and SQLite is done in PHP. '
        .'No write skips the model events (WithoutModelEvents, withoutEvents, saveQuietly, …): the derived columns are written by them. '
        .'No helper may wrap raw SQL. Tests do not read SQL text, branch on the driver or change the schema. '
        .'The rules are in docs/database.md ("Rules for database code"). Fix the code: nothing is excused, '
        .'there is no baseline and no allowed list.';
}

it('adds no raw query, driver branch or engine-specific construct to the application, the migrations or the tests', function () {
    $problems = array_map(
        fn (string $key, int $count): string => "{$key}: {$count} found",
        array_keys(databasePortabilityOffences()),
        databasePortabilityOffences(),
    );

    expect($problems)->toBe([], databasePortabilityMessage('Raw queries, driver branches or engine-specific constructs', $problems));
});

it('excuses nothing: no baseline and no allowed list exist', function () {
    expect(glob(__DIR__.'/database-portability-baseline*'))->toBe([])
        ->and(glob(__DIR__.'/database-portability-allowed*'))->toBe([])
        ->and(function_exists('databasePortabilityBaseline'))->toBeFalse();
});

it('checks every like comparison of a statement, not only the first', function () {
    $rule = databasePortabilityRules()['source']['like comparison'];
    $folded = "\$query->whereLike('title_search', \$pattern, caseSensitive: true)";

    expect(preg_match_all($rule, "{$folded}->orWhereLike('email', \$pattern)->get();"))->toBe(1)
        ->and(preg_match_all($rule, "\$query->whereLike('email', \$pattern)->orWhereLike('title_search', \$pattern, caseSensitive: true);"))->toBe(1)
        ->and(preg_match_all($rule, "{$folded}->orWhereLike('summary_search', \$pattern, caseSensitive: true);"))->toBe(0)
        ->and(preg_match_all($rule, "{$folded};"))->toBe(0);
});

it('refuses a write that skips the model events', function (string $code) {
    expect($code)->toMatch(databasePortabilityRules()['source']['write without model events']);
})->with([
    'use WithoutModelEvents;',
    'User::withoutEvents(fn () => $user->save());',
    '$user->saveQuietly();',
    'User::factory()->createQuietly();',
]);

it('refuses sql handed over as text and an operator of one engine', function (string $group, string $rule, string $code) {
    expect($code)->toMatch(databasePortabilityRules()[$group][$rule]);
})->with([
    ['source', 'sql string on a connection', "DB::connection()->scalar('select @@transaction_isolation');"],
    ['source', 'sql string on a connection', '$connection->statement("pragma journal_mode = wal");'],
    ['source', 'engine-specific operator', "\$query->where('email', 'like binary', \$pattern);"],
    ['source', 'engine-specific operator', "\$query->orWhere('title', '~*', \$pattern);"],
    ['tests', 'reads sql text', "collect(DB::getQueryLog())->pluck('query');"],
    ['tests', 'reads sql text', 'DB::listen(fn (QueryExecuted $query) => $seen[] = $query);'],
]);

it('lets a test count queries without reading them', function () {
    expect(preg_match(databasePortabilityRules()['tests']['reads sql text'], 'expect(DB::getQueryLog())->toHaveCount(1); return count(DB::getQueryLog());'))->toBe(0);
});
