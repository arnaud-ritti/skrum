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
        'upsert' => '/->upsert\(/',
        'like comparison' => '/->(?:or)?where(?:Not)?Like\(|[\'"](?:not )?like[\'"]/i',
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
        'reads sql text' => '/\$\w+->sql\b/',
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
 * @return array<string, int>
 */
function databasePortabilityBaseline(): array
{
    $entries = [];

    foreach (file(__DIR__.'/database-portability-baseline.txt', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        [$path, $rule, $count] = explode('|', $line);
        $entries["{$path}|{$rule}"] = (int) $count;
    }

    return $entries;
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
        .'No helper may wrap raw SQL. Tests do not read SQL text, branch on the driver or change the schema. '
        .'The rules are in docs/database.md ("Rules for database code"). Fix the code: '
        .'tests/Arch/database-portability-baseline.txt only shrinks, and ends empty.';
}

it('adds no raw query, driver branch or engine-specific construct to the application, the migrations or the tests', function () {
    $listed = databasePortabilityBaseline();
    $problems = [];

    foreach (databasePortabilityOffences() as $key => $count) {
        if ($count > ($listed[$key] ?? 0)) {
            $problems[] = "{$key}: {$count} found, ".($listed[$key] ?? 0).' listed';
        }
    }

    expect($problems)->toBe([], databasePortabilityMessage('New raw queries, driver branches or engine-specific constructs', $problems));
});

it('lists nothing that is no longer there', function () {
    $offences = databasePortabilityOffences();
    $stale = [];

    foreach (databasePortabilityBaseline() as $key => $count) {
        if (($offences[$key] ?? 0) < $count) {
            $stale[] = "{$key}: listed {$count}, found ".($offences[$key] ?? 0);
        }
    }

    expect($stale)->toBe([], databasePortabilityMessage('Fixed constructs still on the baseline: delete the line or lower its count', $stale));
});
