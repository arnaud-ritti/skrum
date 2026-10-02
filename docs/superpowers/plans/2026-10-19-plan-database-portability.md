# Database Portability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Every agent reads **Owner decisions**, **Global Constraints**, **Running the suite** and **Review Focus** before its task. This plan runs its tests: a task is not done until the runs its last steps name have been made and their numbers written into the baseline file.

**Goal:** Skrüm migrates and runs on SQLite, MariaDB, MySQL and PostgreSQL from one code base, every invariant of the product is proved on each of them (with two real connections where a lock matters), and an existing PostgreSQL instance upgrades with one `php artisan migrate` to the schema a fresh install gets.

**Architecture:** Portable by construction rather than by driver branches. Case-insensitive keys are stored columns filled in PHP (`name_key`, `email_key`) under plain indexes. MySQL and MariaDB are configured to behave like PostgreSQL (binary no-pad collation, READ COMMITTED); SQLite serialises write transactions (`BEGIN IMMEDIATE`, WAL, busy timeout). The few SQL fragments that differ go through helpers in `app/Support/Database`, the only folder allowed to look at the driver. An architecture test with a shrinking baseline keeps the rest of the code free of driver-specific constructs.

**Tech Stack:** Laravel 13.34, PHP 8.4, Pest 5, Laravel Sail (PostgreSQL 18, MariaDB 10.11, MySQL 8.4), SQLite bundled with PHP, GitHub Actions. No new dependency.

**Spec:** `.superpowers/sdd/plan-db/2026-10-19-database-portability-design.md`. Audit it rests on: `docs/superpowers/research/database-portability-audit.md`. Sections of the spec are cited as §n.

**Not in this plan:** SQL Server; moving data between engines; accent-insensitive search; the browser suite on a second driver; converting nullable `timestamp` columns (spec §3).

## Autonomous run

Unattended, on the branch `plan-db-portability` (see **Branches**). No merge into `main`, no push. A decision taken on the owner's behalf goes in the report of Task 18. A step that says "stop" means: write what was found in the task report and end the task with `BLOCKED`; do not guess.

## Owner decisions

The spec leaves four assumptions (A1–A4, spec §0) and seven decisions (D1–D7, spec §16) to the owner. Until answered, the plan builds the recommended option of each:

| # | Built as | Task that changes if the owner says otherwise |
|---|---|---|
| A1 | Targets: SQLite, MariaDB, MySQL, PostgreSQL | 1, 16 |
| A2, D7 | SQL Server: best effort, no schema work | none |
| A3 | Tests are run in every task | all |
| A4 | Before the feature roadmap | Branches |
| D1 | SQLite documented for small instances | 17 |
| D2 | PostgreSQL stays the default of `.env.example` and of `compose.production.yaml` | 15 |
| D3 | `composer.json` keeps `^8.3`; `skrum:check-database` refuses SQLite on a PHP older than 8.4. Raising the floor needs the owner's word (a dependency change). | 15 |
| D4 | Minimums: PostgreSQL 14, MariaDB 10.11, MySQL 8.4, SQLite 3.35 | 15, 16, 17 |
| D5 | `users.email_key` | 9 |
| D6 | Whole lists sorted in PHP | 7 |

## Branches

- **Start.** `plan-db-portability` is created from the head of `plan-18e-screens`.
- **Tasks 1 and 2 start at once.** They touch configuration, tooling and `tests/Arch` only. As soon as Task 2 is reviewed, its commits are merged into `plan-18e-screens`: from then on every lane that merges there sees its own driver-specific constructs fail the architecture test (the baseline lists only what existed at Task 2).
- **Tasks 3 to 8 and 10 start when Task 2 is merged back.** Before each of these tasks, `plan-18e-screens` is merged into `plan-db-portability` (never the other way round until the end). After such a merge, run the Arch suite: a new offence brought by a lane is fixed in the task at hand if it is in a file the task owns, otherwise added to the baseline with a line in the task report.
- **Task 9 and scenario C2 of Task 13 wait for `plan-18f-auth` to be merged into `plan-18e-screens`.** They need `LoginAddress`, `User::scopeWhereAddress`, `ConsumeMagicLink` and the 18f migrations. If 18f is not merged when Task 11 is reached, do Tasks 11 to 17 without them, leave the four e-mail lines on the baseline, and do Task 9 and C2 before Task 14.
- **The 18f migrations** (`create_magic_links_table`, `create_email_two_factor_codes_table`) get their three non-null `timestamp()` columns changed to `dateTime()` in Task 9, and the [18f] `SearchWorkspaceContent` gets `TextSearch` there too; both are listed in that task.
- **End.** After Task 18 the branch is merged into the branch that carries the front rewrite to `main` (`plan-18e-screens` or its successor), before plan 18g's clean-up if 18g has not started, and in any case before the first plan of the feature roadmap. The merge is the owner's call; the plan itself merges nothing into `main`.
- **Files this plan shares with the open branches:** `tests/Pest.php` (Task 13 adds one `pest()` block), `app/Providers/AppServiceProvider.php` (Task 6 adds one listener), `bootstrap/app.php` (Task 12 adds one `map`), `CLAUDE.md`, `.env.example`, `compose.yaml`, `.github/workflows/tests.yml`, `phpunit.xml`, `Dockerfile`, and the PHP files of the audit's §2. Each edit is a small, local change; conflicts are resolved by keeping both sides.

## Parallel work

After Task 3 is merged into the plan's branch, these tasks touch disjoint application files and can run at the same time, each in its own worktree created from the plan's branch:

| Group | Tasks | Files they share with another task |
|---|---|---|
| A | 4 (name keys), 5 (raw SQL), 6 (search), 7 (lists), 8 (model rules, dates), 10 (tests that assert PostgreSQL) | `tests/Arch/database-portability-baseline.txt` and `tests/Arch/database-portability-allowed.txt` (each task deletes or lowers only its own lines: one entry per line, so merges are clean); `app/Http/Controllers/WorkspaceTemplatesController.php` (4 and 7); `app/Actions/Games/TeamGameLeaderboard.php` (5 and 7: 5 owns the `selectRaw`, 7 the ordering); `app/Http/Controllers/Admin/AdminCandidatesController.php` (6 and 7) |
| B | 12 (retry and 503), 15 (operations), 17 (documentation) | `CLAUDE.md` (2 and 17), `README.md` |

Sequential: 1 → 2 → 3 → group A → 9 (needs 18f) → 11 (triage, needs group A merged) → 12 → 13 → 14 → 16 → 18. `docs/superpowers/research/database-portability-baseline.md` is written by whoever integrates a task into the plan's branch, never inside a parallel worktree.

## File structure

Created:

| File | Responsibility |
|---|---|
| `bin/test-db` | Run a suite on one engine |
| `bin/check-pg-upgrade` | Prove an existing PostgreSQL install ends like a fresh one |
| `app/Support/Database/Sql.php` | Three conditional SQL fragments |
| `app/Support/Database/TextSearch.php` | Case-insensitive substring search |
| `app/Support/Database/NameKey.php` | The fold behind `name_key` |
| `app/Support/Database/CheckConstraint.php` | Check constraints where the engine can add one |
| `app/Support/Database/InsertOnce.php` | Insert unless a unique key holds the row |
| `app/Support/Database/Transactions.php` | Retry count, concurrency error test |
| `app/Support/Database/SqliteFunctions.php` | Unicode `lower()` on SQLite |
| `app/Support/Database/DatabaseRequirements.php` | What the check command verifies |
| `app/Support/Alphabetical.php` | Alphabetical order in PHP |
| `app/Casts/DateOnly.php` | `Y-m-d` on every engine |
| `app/Exceptions/ModelInvariantViolation.php` | A model rule was broken |
| `app/Console/Commands/CheckDatabaseCommand.php` | `skrum:check-database` |
| `database/migrations/2026_10_19_100000_drop_json_defaults_from_game_rounds.php` | Existing installs equal fresh ones |
| `database/migrations/2026_10_19_100100_add_name_keys_to_named_tables.php` | `name_key`, its indexes, drop of the old ones |
| `database/migrations/2026_10_19_100200_add_email_key_to_users_table.php` [18f] | `email_key` |
| `database/migrations/2026_10_19_100300_normalise_workspace_invitation_emails.php` [18f] | Stored invitation addresses |
| `tests/Arch/DatabasePortabilityTest.php`, `database-portability-baseline.txt`, `database-portability-allowed.txt` | Guard rail |
| `tests/Support/{SqlProbe,DatabaseFailure,UnreachableDatabase}.php` | Test helpers |
| `tests/Feature/Database/*Test.php` | One file per invariant family |
| `tests/Unit/Support/Database/*Test.php`, `tests/Unit/Support/AlphabeticalTest.php`, `tests/Unit/Casts/DateOnlyTest.php` | Helper units |
| `tests/Concurrency/Support/Race.php`, `tests/Concurrency/*Test.php` | Two-connection proofs |
| `tests/Fixtures/pgsql/before-portability.sql` | A PostgreSQL install as it was |
| `compose.production.mariadb.yaml`, `compose.production.sqlite.yaml` | Production alternatives |
| `docs/database.md` | Operators and developers |
| `docs/superpowers/research/database-portability-baseline.md` | Failures per driver, task by task |

Modified: `config/database.php`, `config/cache.php`, `compose.yaml`, `.gitignore`, `.env.example`, `phpunit.xml`, `Dockerfile`, `docker/scripts/prepare`, `.github/workflows/tests.yml`, `CLAUDE.md`, `README.md`, `bootstrap/app.php`, `app/Providers/AppServiceProvider.php`, `tests/Pest.php`, `bin/test-browser`, the `test:browser` script of `composer.json`, twelve historic migrations, five models, and the call sites each task lists.

## Global Constraints

- Minimum versions: PostgreSQL 14, MariaDB 10.11, MySQL 8.4, SQLite 3.35 with PHP 8.4 (spec §4).
- No `DB::getDriverName()`, `getDriverName()`, or any other driver test outside `app/Support/Database`, `tests/Support` and `tests/Concurrency/Support`.
- No new raw SQL outside the helpers of spec §7, except plain aggregates (`count(*)`, `sum`, `avg`, `max`, `count(distinct …)`) and `case when`. Aggregates and booleans read through the base builder are cast in PHP.
- Historic migrations are edited only where the PostgreSQL schema stays the same; anything else is a new migration. Migrations have an `up` method only. Create files with `php artisan make:… --no-interaction` (through Sail).
- New migrations: `dateTime()` for a non-null date-time, `longText()` for content that can pass 64 KB, no database default on a JSON column, no expression or partial index, no `->collation()`.
- Primary and foreign keys are UUIDs (`tests/Feature/UuidPrimaryKeysTest.php`).
- PHP style of the project: early returns, no `else`, happy path last, typed everything, PascalCase constants, no class is `final`, no comment that restates code, no comment in tests, `vendor/bin/pint --dirty --format agent` before each commit, PHPStan at 0 errors (`vendor/bin/sail bin phpstan analyse --no-progress`).
- Arch preset facts that shape this plan: `App\Support` does not use `App\Http` or `App\Mcp`; models do not use `App\Actions`, `App\Http`, `App\Mcp`; `env()` only in config files; console commands end in `Command`.
- Octane is installed: no static per-request state in new classes.
- No new dependency, PHP or JS. No change to the requirements of `composer.json` (D3 is the owner's); Task 16 edits one script of it.
- One commit per task unless the task says otherwise. Stage explicit paths; never `git add -A`; never stage anything under `.superpowers/`, `resources/js/actions`, `resources/js/routes`.
- No merge into `main`, no push.

## Running the suite

Every shell first runs `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"`. Sail is up with PostgreSQL. The other engines are started once: `docker compose --profile mariadb --profile mysql up -d mariadb mysql` (Task 1 adds the services).

| Command | What it runs |
|---|---|
| `bin/test-db pgsql` | Unit, Feature and Arch on PostgreSQL, in parallel |
| `bin/test-db sqlite` | the same on SQLite in memory |
| `bin/test-db mariadb`, `bin/test-db mysql` | the same on MariaDB, on MySQL |
| `bin/test-db <driver> -- tests/Feature/Database/NameKeysTest.php` | one file, not in parallel |
| `bin/test-db <driver> -- --filter="keeps the name unique"` | one test |
| `bin/test-db <pgsql\|mariadb\|mysql\|sqlite-file> --concurrency` | `tests/Concurrency`, never in parallel |
| `bin/check-pg-upgrade` | the PostgreSQL upgrade proof |

"**The task's closing run**" means, in this order: `bin/test-db pgsql` (must be fully green), `bin/test-db sqlite`, `bin/test-db mariadb`. Each prints one summary line; copy the three lines into `docs/superpowers/research/database-portability-baseline.md` under the task's heading, with the names of the test files that still fail on SQLite and MariaDB. The count of failures on SQLite and on MariaDB must not rise from the previous task; if it does, the task is not done. `bin/test-db mysql` is run at Tasks 3, 11 and 18 only (MySQL shares MariaDB's grammar and connector in Laravel).

If a parallel run on PostgreSQL hits `max_locks_per_transaction` while databases are created (infrastructure, not code), rerun with `TEST_DB_PROCESSES=4`.

## Review Focus

Input classes and failure modes the spec implies and that are most likely to bite an operator or a user. Each has its test in the task named.

1. **An operator points the application at a MariaDB server with the default `_ci` collation or REPEATABLE READ.** Expected: the container refuses to start with a sentence naming the setting, instead of running with emoji that collide and caps that can be passed. Test: `CheckDatabaseCommandTest`, Task 15.
2. **An existing PostgreSQL instance holds two templates of one workspace whose names differ only by a trailing space, or by a letter PostgreSQL did not fold.** Expected: the migration succeeds, both rows keep their names, the later one gets a distinct key, and the log says which. Test: `NameKeysMigrationTest`, Task 4, and the fixture of `bin/check-pg-upgrade`, Task 3.
3. **A search term made only of wildcard characters (`%`, `_`, `!`, `\`).** Expected: it matches text that contains those characters and nothing else, on every engine. Test: `TextSearchTest`, Task 6.
4. **Two people act in the same instant on SQLite and the second waits longer than the busy timeout.** Expected: "busy, try again" (503 with `Retry-After`), not a 500 and not a lost write. Test: `ConcurrencyErrorResponseTest`, Task 12, and C3 on SQLite, Task 13.
5. **A row is written outside Eloquent (a job using the query builder, a future import) with a state a model rule forbids.** Expected: refused by the database on PostgreSQL, MariaDB and MySQL; on SQLite it is accepted, and the documentation says so. Test: `CheckConstraintsTest`, Task 3; `docs/database.md`, Task 17.

---

## Task 1: Each driver can run the suite

**Files:**
- Modify: `config/database.php`, `config/cache.php:46`, `compose.yaml`, `.gitignore`
- Create: `bin/test-db`, `tests/Feature/Database/ConnectionSettingsTest.php`, `docs/superpowers/research/database-portability-baseline.md`

**Interfaces:**
- Produces: `bin/test-db <sqlite|sqlite-file|pgsql|mariadb|mysql> [--concurrency] [-- arguments]`, exit code of the suite, one summary line `test-db <driver>: <PASS|FAIL> …`; connections `mysql_locks`, `mariadb_locks`; Compose profiles `mariadb`, `mysql`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Database/ConnectionSettingsTest.php`:

```php
<?php

it('gives each server engine a lock connection that is its twin', function (string $connection) {
    expect(config("database.connections.{$connection}_locks"))
        ->toBe(config("database.connections.{$connection}"));
})->with(['pgsql', 'mysql', 'mariadb']);

it('compares bytes, reads committed rows and speaks UTC on mysql and mariadb', function (string $connection, string $collation) {
    expect(config("database.connections.{$connection}.collation"))->toBe($collation)
        ->and(config("database.connections.{$connection}.isolation_level"))->toBe('READ COMMITTED')
        ->and(config("database.connections.{$connection}.timezone"))->toBe('+00:00');
})->with([
    'mysql' => ['mysql', 'utf8mb4_0900_bin'],
    'mariadb' => ['mariadb', 'utf8mb4_nopad_bin'],
]);

it('makes sqlite take the write lock when a transaction begins and wait for it', function () {
    expect(config('database.connections.sqlite.transaction_mode'))->toBe('IMMEDIATE')
        ->and(config('database.connections.sqlite.journal_mode'))->toBe('wal')
        ->and(config('database.connections.sqlite.busy_timeout'))->toBe(5000)
        ->and(config('database.connections.sqlite.synchronous'))->toBe('normal');
});

it('takes cache locks on the twin connection of a server engine and on the same connection for sqlite', function () {
    $default = config('database.default');
    $expected = array_key_exists("{$default}_locks", config('database.connections')) ? "{$default}_locks" : null;

    expect(config('cache.stores.database.lock_connection'))->toBe($expected);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Database/ConnectionSettingsTest.php`
Expected: FAIL. `mysql_locks` is null; the collation is `utf8mb4_unicode_ci`; `transaction_mode` is `DEFERRED`. The last test passes on PostgreSQL already.

- [ ] **Step 3: Configure the connections**

In `config/database.php`, add before `return [`:

```php
$mysqlOptions = extension_loaded('pdo_mysql') ? array_filter([
    Mysql::ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
]) : [];

$mysql = [
    'driver' => 'mysql',
    'url' => env('DB_URL'),
    'host' => env('DB_HOST', '127.0.0.1'),
    'port' => env('DB_PORT', '3306'),
    'database' => env('DB_DATABASE', 'laravel'),
    'username' => env('DB_USERNAME', 'root'),
    'password' => env('DB_PASSWORD', ''),
    'unix_socket' => env('DB_SOCKET', ''),
    'charset' => env('DB_CHARSET', 'utf8mb4'),
    'collation' => env('DB_COLLATION', 'utf8mb4_0900_bin'),
    'prefix' => '',
    'prefix_indexes' => true,
    'strict' => true,
    'engine' => null,
    'timezone' => '+00:00',
    'isolation_level' => 'READ COMMITTED',
    'options' => $mysqlOptions,
];

$mariadb = [
    ...$mysql,
    'driver' => 'mariadb',
    'collation' => env('DB_COLLATION', 'utf8mb4_nopad_bin'),
];

$pgsql = [
    'driver' => 'pgsql',
    'url' => env('DB_URL'),
    'host' => env('DB_HOST', '127.0.0.1'),
    'port' => env('DB_PORT', '5432'),
    'database' => env('DB_DATABASE', 'laravel'),
    'username' => env('DB_USERNAME', 'root'),
    'password' => env('DB_PASSWORD', ''),
    'charset' => env('DB_CHARSET', 'utf8'),
    'prefix' => '',
    'prefix_indexes' => true,
    'search_path' => 'public',
    'sslmode' => env('DB_SSLMODE', 'prefer'),
];
```

Replace the `sqlite` connection's last four keys and the `mysql`, `mariadb`, `pgsql`, `pgsql_locks` entries:

```php
        'sqlite' => [
            'driver' => 'sqlite',
            'url' => env('DB_URL'),
            'database' => env('DB_DATABASE', database_path('database.sqlite')),
            'prefix' => '',
            'foreign_key_constraints' => env('DB_FOREIGN_KEYS', true),
            'busy_timeout' => 5000,
            'journal_mode' => 'wal',
            'synchronous' => 'normal',
            'transaction_mode' => 'IMMEDIATE',
        ],

        'mysql' => $mysql,

        'mariadb' => $mariadb,

        'pgsql' => $pgsql,

        // Each server engine has a twin connection for cache locks: a lock taken or refused
        // must neither join nor abort the caller's open transaction. SQLite has none: a second
        // connection could not write while the first holds the write lock.
        'pgsql_locks' => $pgsql,
        'mysql_locks' => $mysql,
        'mariadb_locks' => $mariadb,
```

The `sqlsrv` entry stays as it is.

In `config/cache.php`, replace the `lock_connection` line of the `database` store:

```php
            'lock_connection' => env('DB_CACHE_LOCK_CONNECTION', match (env('DB_CONNECTION', 'sqlite')) {
                'pgsql' => 'pgsql_locks',
                'mysql' => 'mysql_locks',
                'mariadb' => 'mariadb_locks',
                default => null,
            }),
```

- [ ] **Step 4: Run the test**

Run: `vendor/bin/sail artisan config:clear && vendor/bin/sail artisan test --compact tests/Feature/Database/ConnectionSettingsTest.php`
Expected: PASS, 7 tests.

- [ ] **Step 5: Add the two engines to Sail**

In `compose.yaml`, after the `pgsql` service and before `networks:`:

```yaml
    mariadb:
        image: 'mariadb:10.11'
        profiles:
            - mariadb
        ports:
            - '${FORWARD_MARIADB_PORT:-3306}:3306'
        environment:
            MYSQL_ROOT_PASSWORD: '${DB_PASSWORD:-password}'
            MYSQL_ROOT_HOST: '%'
            MYSQL_DATABASE: '${DB_DATABASE}'
            MYSQL_USER: '${DB_USERNAME}'
            MYSQL_PASSWORD: '${DB_PASSWORD:-password}'
        volumes:
            - 'sail-mariadb:/var/lib/mysql'
            - './vendor/laravel/sail/database/mariadb/create-testing-database.sh:/docker-entrypoint-initdb.d/10-create-testing-database.sh'
        networks:
            - sail
        healthcheck:
            test:
                - CMD
                - healthcheck.sh
                - '--connect'
                - '--innodb_initialized'
            retries: 3
            timeout: 5s
    mysql:
        image: 'mysql:8.4'
        profiles:
            - mysql
        ports:
            - '${FORWARD_MYSQL_PORT:-3307}:3306'
        environment:
            MYSQL_ROOT_PASSWORD: '${DB_PASSWORD:-password}'
            MYSQL_ROOT_HOST: '%'
            MYSQL_DATABASE: '${DB_DATABASE}'
            MYSQL_USER: '${DB_USERNAME}'
            MYSQL_PASSWORD: '${DB_PASSWORD:-password}'
        volumes:
            - 'sail-mysql:/var/lib/mysql'
            - './vendor/laravel/sail/database/mysql/create-testing-database.sh:/docker-entrypoint-initdb.d/10-create-testing-database.sh'
        networks:
            - sail
        healthcheck:
            test:
                - CMD
                - mysqladmin
                - ping
                - '-p${DB_PASSWORD:-password}'
            retries: 3
            timeout: 5s
```

and under `volumes:` at the end:

```yaml
    sail-mariadb:
        driver: local
    sail-mysql:
        driver: local
```

Sail's two scripts create the database `testing` and grant the application user every database named `testing%`, which covers the per-process databases of a parallel run.

Append to `.gitignore`:

```
/database/testing.sqlite*
/storage/logs/test-db
```

Start them and check the two collations exist (they were read from documentation, not tried):

```bash
docker compose --profile mariadb --profile mysql up -d mariadb mysql
docker compose exec -T mariadb mariadb -uroot -ppassword -N -e "select count(*) from information_schema.collations where collation_name = 'utf8mb4_nopad_bin'"
docker compose exec -T mysql mysql -uroot -ppassword -N -e "select count(*) from information_schema.collations where collation_name = 'utf8mb4_0900_bin'"
```

Expected: `1` twice. If one prints `0`: set that connection's default collation to `utf8mb4_bin` in `config/database.php` and in the test of Step 1, and write in the task report that trailing spaces are then ignored in comparisons on that engine (spec §9, §15).

- [ ] **Step 6: Write `bin/test-db`**

```bash
#!/usr/bin/env bash
#
# Runs the Pest suites against one database engine.
#
#   bin/test-db <sqlite|sqlite-file|pgsql|mariadb|mysql> [--concurrency] [-- arguments of `artisan test`]
#
# Without arguments: Unit, Feature and Arch in parallel (TEST_DB_PROCESSES, default 8).
# With arguments: they are passed to `artisan test`, which then runs in one process.
# --concurrency: tests/Concurrency, in one process, never on SQLite in memory.
#
# Inside Sail by default; the engine must be up (`docker compose --profile mariadb --profile mysql up -d mariadb mysql`).
# TEST_DB_ON_HOST=1 uses the host's PHP and 127.0.0.1 (CI); TEST_DB_PORT, TEST_DB_USERNAME and
# TEST_DB_PASSWORD override the port, the user and the password.

set -u

cd "$(dirname "$0")/.."

driver="${1:-}"
shift || true

concurrency=0

if [ "${1:-}" = "--concurrency" ]; then
    concurrency=1
    shift
fi

if [ "${1:-}" = "--" ]; then
    shift
fi

on_host="${TEST_DB_ON_HOST:-0}"
password="${TEST_DB_PASSWORD:-password}"

server() {
    local sail_host="$1" sail_user="$2" host_port="$3"
    local host="$sail_host" port="${4:-3306}"

    if [ "$on_host" = 1 ]; then
        host=127.0.0.1
        port="${TEST_DB_PORT:-$host_port}"
    fi

    variables=(
        "DB_CONNECTION=$driver"
        "DB_HOST=$host"
        "DB_PORT=$port"
        "DB_DATABASE=testing"
        "DB_USERNAME=${TEST_DB_USERNAME:-$sail_user}"
        "DB_PASSWORD=$password"
    )
}

case "$driver" in
    sqlite)
        variables=("DB_CONNECTION=sqlite" "DB_DATABASE=:memory:")
        ;;
    sqlite-file)
        rm -f database/testing.sqlite*
        : > database/testing.sqlite
        variables=("DB_CONNECTION=sqlite" "DB_DATABASE=database/testing.sqlite")
        ;;
    pgsql)
        server pgsql sail 5432 5432
        ;;
    mariadb)
        server mariadb sail 3306
        ;;
    mysql)
        server mysql sail 3307
        ;;
    *)
        echo "Usage: bin/test-db <sqlite|sqlite-file|pgsql|mariadb|mysql> [--concurrency] [-- arguments of artisan test]" >&2
        exit 2
        ;;
esac

if [ "$concurrency" = 1 ] && [ "$driver" = sqlite ]; then
    echo "The concurrency suite needs a database two processes can open: use sqlite-file." >&2
    exit 2
fi

if [ "$on_host" = 1 ]; then
    run() { env "${variables[@]}" php "$@"; }
else
    flags=()

    for variable in "${variables[@]}"; do
        flags+=(-e "$variable")
    done

    run() { docker compose exec -T -u sail "${flags[@]}" laravel.test php "$@"; }
fi

mkdir -p storage/logs/test-db
log="storage/logs/test-db/$driver$([ "$concurrency" = 1 ] && echo -concurrency).log"

run artisan config:clear --ansi >/dev/null

if [ "$concurrency" = 1 ]; then
    run artisan test --compact tests/Concurrency "$@" 2>&1 | tee "$log"
elif [ $# -gt 0 ]; then
    run artisan test --compact "$@" 2>&1 | tee "$log"
else
    run -d memory_limit=1G artisan test --compact --parallel --processes="${TEST_DB_PROCESSES:-8}" --recreate-databases 2>&1 | tee "$log"
fi

status=${PIPESTATUS[0]}

summary=$(sed -E $'s/\x1b\\[[0-9;]*m//g' "$log" | grep -E 'Tests:' | tail -1 | sed -E 's/^ +//')

if [ "$status" -eq 0 ]; then
    echo "test-db $driver: PASS, ${summary:-no summary line}, log $log"
else
    echo "test-db $driver: FAIL (exit $status), ${summary:-no summary line}, log $log"
fi

exit "$status"
```

Run: `chmod +x bin/test-db && bin/test-db pgsql -- tests/Feature/Database/ConnectionSettingsTest.php`
Expected: `test-db pgsql: PASS, Tests: 7 passed …`.

- [ ] **Step 7: See where each other engine stops**

```bash
bin/test-db sqlite -- tests/Feature/Database/ConnectionSettingsTest.php
bin/test-db mariadb -- tests/Feature/Database/ConnectionSettingsTest.php
bin/test-db mysql -- tests/Feature/Database/ConnectionSettingsTest.php
```

Expected: these tests read configuration only and need no table, so they pass on the three engines (the last one now checks `mariadb_locks`, `mysql_locks` and `null`). Then run a test that migrates:

```bash
bin/test-db sqlite -- tests/Feature/ExampleTest.php
bin/test-db mariadb -- tests/Feature/ExampleTest.php
bin/test-db mysql -- tests/Feature/ExampleTest.php
```

Expected: FAIL while migrating. The audit predicts `2026_10_06_100000_create_game_tables` on SQLite (`'[]'::jsonb`) and `2026_10_01_100300_create_workspace_templates_table` on MariaDB and MySQL (the expression index). Note the migration and the error message each engine really gives.

- [ ] **Step 8: Run PostgreSQL in full and record the baseline**

Run: `bin/test-db pgsql`
Expected: PASS, with the number of tests the branch has today.

Create `docs/superpowers/research/database-portability-baseline.md`:

```markdown
# Database portability — failures per driver

One section per task of `.superpowers/sdd/plan-db/2026-10-19-plan-database-portability.md`, newest last.
Each line is the summary printed by `bin/test-db`. Failing files are listed for SQLite and MariaDB.

## Task 1 — harness (commit <sha>)

| Driver | Result |
|---|---|
| pgsql | <summary line> |
| sqlite | migrations stop at <migration>: <message> |
| mariadb | migrations stop at <migration>: <message> |
| mysql | migrations stop at <migration>: <message> |
```

Fill the four cells from Steps 7 and 8.

- [ ] **Step 9: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add config/database.php config/cache.php compose.yaml .gitignore bin/test-db tests/Feature/Database/ConnectionSettingsTest.php docs/superpowers/research/database-portability-baseline.md
git commit -m "test(database): each engine can run the suite, and the baseline says where it stops"
```

---

## Task 2: Guard rail

**Files:**
- Create: `tests/Arch/DatabasePortabilityTest.php`, `tests/Arch/database-portability-baseline.txt`, `tests/Arch/database-portability-allowed.txt`
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces: `databasePortabilityOffences(): array<string, int>` keyed `"<path>|<rule>"`; the two list files, one `path|rule|count` per line, sorted. Later tasks delete lines of the baseline and lower counts of the allowed list. Task 14 asserts the baseline is empty.

- [ ] **Step 1: Write the test**

Create `tests/Arch/DatabasePortabilityTest.php`:

```php
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
        'like outside TextSearch' => '/->(?:or)?where(?:Not)?Like\(|[\'"](?:not )?like[\'"]/i',
        'driver branch' => '/getDriverName\(/',
        'boolean literal in raw sql' => '/Raw\(\s*[\'"](?:false|true)[\'"]/i',
        'raw sql' => '/->(?:where|orWhere|select|orderBy|having|groupBy|from|join)Raw\(|DB::(?:raw|statement|unprepared|select|selectOne)\(|new Expression\(/',
    ];

    $migrations = [
        'non-null timestamp' => '/->timestamp\((?:(?!->nullable\(|->useCurrent\(|;).)*;/s',
        'expression default' => '/->default\(\s*new Expression/',
        'column collation' => '/->(?:collation|charset)\(/',
        'type that differs per engine' => '/->(?:enum|set|timestampTz|timestampsTz|dateTimeTz|softDeletesTz|ulid|geometry|geography|vector)\(/',
    ];

    $tests = [
        'driver branch' => '/getDriverName\(/',
        'lock syntax' => '/for update|for share|lock in share mode/i',
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
        ...databasePortabilityScan('app', ['app/Support/Database/'], $rules['source']),
        ...databasePortabilityScan('database', [], [...$rules['source'], ...$rules['migrations']]),
        ...databasePortabilityScan('tests', ['tests/Support/', 'tests/Concurrency/Support/', 'tests/Arch/DatabasePortabilityTest.php'], $rules['tests']),
    ];

    ksort($offences);

    return $offences;
}

/**
 * @return array<string, int>
 */
function databasePortabilityList(string $file): array
{
    $entries = [];

    foreach (file(__DIR__."/{$file}", FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        [$path, $rule, $count] = explode('|', $line);
        $entries["{$path}|{$rule}"] = (int) $count;
    }

    return $entries;
}

it('adds no driver-specific construct to the application, the migrations or the tests', function () {
    $listed = [...databasePortabilityList('database-portability-allowed.txt'), ...databasePortabilityList('database-portability-baseline.txt')];
    $problems = [];

    foreach (databasePortabilityOffences() as $key => $count) {
        if ($count > ($listed[$key] ?? 0)) {
            $problems[] = "{$key}: {$count} found, ".($listed[$key] ?? 0).' listed';
        }
    }

    expect($problems)->toBe([]);
});

it('lists nothing that is no longer there', function () {
    $offences = databasePortabilityOffences();
    $stale = [];

    foreach ([...databasePortabilityList('database-portability-allowed.txt'), ...databasePortabilityList('database-portability-baseline.txt')] as $key => $count) {
        if (($offences[$key] ?? 0) < $count) {
            $stale[] = "{$key}: listed {$count}, found ".($offences[$key] ?? 0);
        }
    }

    expect($stale)->toBe([]);
});

it('keeps raw sql on the allowed list out of the baseline of things to fix', function () {
    $allowedRules = collect(array_keys(databasePortabilityList('database-portability-allowed.txt')))
        ->map(fn (string $key): string => explode('|', $key)[1])
        ->unique()
        ->values()
        ->all();

    expect($allowedRules)->each->toBeIn(['raw sql', 'ddl in a test']);
});
```

Create both list files empty:

```bash
: > tests/Arch/database-portability-baseline.txt
: > tests/Arch/database-portability-allowed.txt
```

- [ ] **Step 2: Run it to see it fail, and read what it finds**

Run: `vendor/bin/sail artisan test --compact tests/Arch/DatabasePortabilityTest.php`
Expected: the first test FAILS and prints every offence with its count. Read the whole list. It must contain at least: `ilike` in `app/Mcp/Tools/Retro/SearchBoards.php` (4) and `app/Http/Controllers/TeamEstimatesController.php` (1); `filter (where` (4) and `nulls first or last` (1) in `app/Actions/ActionItems/ActionItemQuery.php`; `postgres function or clause` in `app/Actions/Games/GameStreaks.php` (2); `insertOrIgnore` in `DrawGameWord.php` and `SendActionItemReminders.php`; `like outside TextSearch` in `AdminCandidatesController.php`; `boolean literal in raw sql` in `TrackedIssues.php` (2); `driver branch` in five migrations and two tests; `cast with ::` and `expression default` (5 each) in `2026_10_06_100000_create_game_tables.php`; `non-null timestamp` in five migrations (7 columns); `lock syntax`, `reads sql text`, `sql error as a failure` and `ddl in a test` in the tests of audit §6. If one of these is absent, the pattern is wrong: fix the pattern before going on. If something unexpected appears (a false match in a comment, a vendor-style helper), narrow the pattern rather than listing it.

- [ ] **Step 3: Write the two lists from the scan**

Pest functions are not available in a bare script, so the lists are generated by a temporary test. Add it at the end of `tests/Arch/DatabasePortabilityTest.php`, run it once, then delete it:

```php
it('writes the lists', function () {
    $allowed = [];
    $baseline = [];

    foreach (databasePortabilityOffences() as $key => $count) {
        [, $rule] = explode('|', $key);

        if ($rule === 'raw sql') {
            $allowed[] = "{$key}|{$count}";

            continue;
        }

        $baseline[] = "{$key}|{$count}";
    }

    file_put_contents(__DIR__.'/database-portability-allowed.txt', implode("\n", $allowed)."\n");
    file_put_contents(__DIR__.'/database-portability-baseline.txt', implode("\n", $baseline)."\n");

    expect(true)->toBeTrue();
});
```

Run: `vendor/bin/sail artisan test --compact tests/Arch/DatabasePortabilityTest.php --filter="writes the lists"`, then remove that test from the file.

The allowed list now holds every file with raw SQL and its count (the audit counts 39 calls in `app/`, plus the migrations). The baseline holds everything else. Both are the starting point: tasks lower them.

- [ ] **Step 4: Run the three tests**

Run: `vendor/bin/sail artisan test --compact tests/Arch`
Expected: PASS (the existing Arch tests and the three new ones).

- [ ] **Step 5: Prove the rail catches a new offence**

Add `->where('title', 'ilike', '%x%')` to any query of `app/Http/Controllers/TeamsController.php`, run `vendor/bin/sail artisan test --compact tests/Arch/DatabasePortabilityTest.php`.
Expected: FAIL with `app/Http/Controllers/TeamsController.php|ilike: 1 found, 0 listed`. Revert the line; run again; PASS.

- [ ] **Step 6: Write the rule for agents**

In `CLAUDE.md`, between the "Workflow" section and "Laravel Boost Guidelines", add:

```markdown
## Database portability

Database code must run unchanged on PostgreSQL, MySQL, MariaDB and SQLite. `tests/Arch/DatabasePortabilityTest.php` enforces most of this; `docs/database.md` explains it.

1. No `ilike`, `::` cast, `filter (where …)`, `nulls first/last`, `date_trunc`, `interval`, `distinct on`, `returning`, `on conflict`, regex operator, `||`, or boolean literal in SQL. No `insertOrIgnore`, `upsert`, `whereJsonContains`, `whereJsonLength`, `whereLike`.
2. No new `whereRaw`, `selectRaw`, `orderByRaw`, `havingRaw`, `groupByRaw`, `DB::raw`, `DB::statement`, `DB::select`. Plain aggregates (`count(*)`, `sum(col)`, `max(col)`) with `groupBy` are the only exception; cast the result in PHP. Conditional counts, NULL placement and "match nothing" go through `App\Support\Database\Sql`.
3. No test of the driver (`getDriverName()`), in code, migrations or tests, outside `app/Support/Database`, `tests/Support` and `tests/Concurrency/Support`. If one seems necessary, stop and ask.
4. Case-insensitive comparison: fold the value in PHP and compare with a column that stores the folded form (`NameKey::of` for names, `LoginAddress::normalise` for addresses). Never rely on the database being case-sensitive or not. Searches go through `App\Support\Database\TextSearch`, never a hand-written `LIKE`.
5. Migrations: schema builder only. `dateTime()` rather than `timestamp()` for a non-null column, `longText()` for anything that can exceed 64 KB, no database default on a JSON column (use the model's `$attributes`), no expression or partial index, no raw constraint except through `CheckConstraint::add()`. An invariant the database cannot express on every engine is enforced in the model.
6. Transactions: lock the aggregate root first, before any other query of the transaction. A statement that may fail inside a transaction runs in its own nested `DB::transaction`. No DDL inside a transaction. Pass `Transactions::Attempts` only when the closure touches nothing but the database.
7. Sorting: add an explicit tie-breaker; never depend on where NULL sorts or on alphabetical order from SQL. Lists read by people are sorted with `App\Support\Alphabetical`.
8. Tests: never read SQL text, quoting or `for update` (use `Tests\Support\SqlProbe`); never use an SQL error such as `select 1 / 0` to simulate a failure (use `Tests\Support\DatabaseFailure`); no `Schema::` change inside a test.
9. Before committing a change to database code, run the tests you touched on PostgreSQL and on one other engine: `bin/test-db pgsql -- <path>` and `bin/test-db mariadb -- <path>`.
```

The classes it names are created by Tasks 3 to 10; the rule is written now so the open lanes read it.

- [ ] **Step 7: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add tests/Arch/DatabasePortabilityTest.php tests/Arch/database-portability-baseline.txt tests/Arch/database-portability-allowed.txt CLAUDE.md
git commit -m "test(arch): driver-specific constructs are listed and none may be added"
```

Then merge this task and Task 1 into `plan-18e-screens` (see **Branches**).

---

## Task 3: The migrations run on the four engines

**Files:**
- Create: `app/Support/Database/CheckConstraint.php`, `database/migrations/2026_10_19_100000_drop_json_defaults_from_game_rounds.php`, `bin/check-pg-upgrade`, `tests/Fixtures/pgsql/before-portability.sql`, `tests/Feature/Database/PortableSchemaTest.php`, `tests/Feature/Database/CheckConstraintsTest.php`
- Modify: `database/migrations/2026_09_29_110028_create_workspace_invitations_table.php:18`, `2026_10_01_100300_create_workspace_templates_table.php:21`, `2026_10_01_110000_create_team_health_statements_table.php:25-34`, `2026_10_02_100000_add_v2_columns_to_action_items_table.php:68-77`, `2026_10_02_100500_create_action_item_reminders_table.php:17`, `2026_10_03_100100_create_poker_decks_table.php:23-27`, `2026_10_05_100000_create_integration_tables.php:36`, `2026_10_06_100000_create_game_tables.php:54-60,65,118,129`, `2026_10_07_100000_extend_integration_tables_for_sync_and_channels.php:61`, `2026_10_08_100000_create_integration_delivery_payloads_table.php:14-18`, `2026_10_10_100000_create_whiteboard_templates_table.php:25-29`, `2026_10_15_100000_add_workspace_to_poker_decks_table.php:17-22`; the two list files of Task 2

**Interfaces:**
- Produces: `App\Support\Database\CheckConstraint::add(string $table, string $name, string $expression): void`, `CheckConstraint::isEnforced(): bool`; `bin/check-pg-upgrade` (exit 0 when the upgraded and the fresh schema are equal and no row was lost).
- After this task and until Task 4, the uniqueness of template and deck names rests on validation alone, on every engine. The two tasks are merged into the plan's branch together.

- [ ] **Step 1: Capture a PostgreSQL install as it is today, before any edit**

This must be done on the task's first commit, with no migration edited yet. It creates a throw-away database, never the development one.

```bash
docker compose exec -T pgsql psql -U sail -d postgres -c 'drop database if exists upgrade_base' -c 'create database upgrade_base'
docker compose exec -T -u sail -e DB_CONNECTION=pgsql -e DB_DATABASE=upgrade_base laravel.test php artisan migrate --force
docker compose exec -T -u sail -e DB_CONNECTION=pgsql -e DB_DATABASE=upgrade_base laravel.test php artisan tinker --execute '
$workspace = App\Models\Workspace::factory()->create();
$team = App\Models\Team::factory()->create(["workspace_id" => $workspace->id]);
$template = App\Models\WorkspaceTemplate::factory()->create(["workspace_id" => $workspace->id, "name" => "Sprint"]);
$twin = (array) DB::table("workspace_templates")->where("id", $template->id)->first();
DB::table("workspace_templates")->insert([...$twin, "id" => (string) Str::uuid7(), "name" => "Sprint "]);
App\Models\WhiteboardTemplate::factory()->create(["workspace_id" => $workspace->id, "name" => "Kick-off"]);
App\Models\SavedPokerDeck::factory()->create(["team_id" => $team->id, "name" => "Scale"]);
App\Models\SavedPokerDeck::factory()->forWorkspace($workspace)->create(["name" => "Scale"]);
App\Models\GameRound::factory()->create();
App\Models\WorkspaceInvitation::factory()->create(["workspace_id" => $workspace->id, "email" => "Ada@Example.test"]);
'
mkdir -p tests/Fixtures/pgsql
docker compose exec -T pgsql pg_dump -U sail --no-owner --no-privileges upgrade_base > tests/Fixtures/pgsql/before-portability.sql
docker compose exec -T pgsql psql -U sail -d postgres -c 'drop database upgrade_base'
```

Expected: a dump of a few thousand lines holding the schema, the `migrations` rows and the sample rows. Check: `grep -c "lower(" tests/Fixtures/pgsql/before-portability.sql` prints 4 (the four expression indexes); `grep -c "'\[\]'::jsonb" tests/Fixtures/pgsql/before-portability.sql` prints 5; `grep -c "Sprint" tests/Fixtures/pgsql/before-portability.sql` prints at least 2.

The two templates named `Sprint` and `Sprint ` (trailing space) are the collision of Review Focus 2: PostgreSQL's old index tells them apart, the PHP key does not.

- [ ] **Step 2: Write `bin/check-pg-upgrade`**

```bash
#!/usr/bin/env bash
#
# Proves that a PostgreSQL install from before the portability work, once migrated,
# has the schema of a fresh install and all its rows.
#
#   bin/check-pg-upgrade
#
# Inside Sail by default. TEST_DB_ON_HOST=1 uses the host's PHP and 127.0.0.1;
# PG_EXEC is then the command that reaches psql and pg_dump of the server's own version
# (CI: `docker exec -i <postgres container>`), PG_USER its user.

set -euo pipefail

cd "$(dirname "$0")/.."

user="${PG_USER:-sail}"
fixture=tests/Fixtures/pgsql/before-portability.sql

if [ "${TEST_DB_ON_HOST:-0}" = 1 ]; then
    read -r -a pg <<< "${PG_EXEC:?Set PG_EXEC to the command that runs psql in the PostgreSQL container}"
    artisan() { DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_DATABASE="$1" php artisan "${@:2}"; }
else
    pg=(docker compose exec -T pgsql)
    artisan() { docker compose exec -T -u sail -e DB_CONNECTION=pgsql -e DB_DATABASE="$1" laravel.test php artisan "${@:2}"; }
fi

sql() { "${pg[@]}" psql -U "$user" -v ON_ERROR_STOP=1 -At -d "$1" -c "$2"; }

schema() {
    "${pg[@]}" pg_dump -U "$user" --schema-only --no-owner --no-privileges "$1" \
        | grep -vE '^(--|\\restrict|\\unrestrict|SET |SELECT pg_catalog)' \
        | grep -vE '^$'
}

rows() {
    for table in workspace_templates whiteboard_templates poker_decks game_rounds workspace_invitations users workspaces teams; do
        echo "$table $(sql "$1" "select count(*) from $table")"
    done

    sql "$1" "select 'workspace_templates', id, name from workspace_templates order by id"
    sql "$1" "select 'whiteboard_templates', id, name from whiteboard_templates order by id"
    sql "$1" "select 'poker_decks', id, name from poker_decks order by id"
}

for database in upgrade_old upgrade_fresh; do
    sql postgres "drop database if exists $database"
    sql postgres "create database $database"
done

"${pg[@]}" psql -U "$user" -v ON_ERROR_STOP=1 -q -d upgrade_old < "$fixture" >/dev/null

before=$(rows upgrade_old)

artisan upgrade_old migrate --force
artisan upgrade_fresh migrate --force

after=$(rows upgrade_old)

status=0

if [ "$before" != "$after" ]; then
    echo "check-pg-upgrade: FAIL, rows changed:"
    diff <(echo "$before") <(echo "$after") || true
    status=1
fi

if ! diff <(schema upgrade_old) <(schema upgrade_fresh) > storage/logs/check-pg-upgrade.diff; then
    echo "check-pg-upgrade: FAIL, the upgraded schema differs from a fresh one (storage/logs/check-pg-upgrade.diff):"
    cat storage/logs/check-pg-upgrade.diff
    status=1
fi

duplicates=$(sql upgrade_old "select count(*) from information_schema.columns where table_name in ('workspace_templates', 'whiteboard_templates', 'poker_decks') and column_name = 'name_key'")

echo "check-pg-upgrade: name_key columns present: $duplicates"

for database in upgrade_old upgrade_fresh; do
    sql postgres "drop database $database"
done

if [ "$status" -eq 0 ]; then
    echo "check-pg-upgrade: PASS, schemas are equal and every row is there"
fi

exit "$status"
```

Run: `chmod +x bin/check-pg-upgrade && bin/check-pg-upgrade`
Expected: PASS. Nothing is edited yet, so both databases are built by the same migrations; this proves the script itself (load, migrate, dump, compare). If the diff is not empty here, the script's filter is wrong (a session line of the dump, for instance): fix the filter, never by dropping a line that describes a table, a column, an index or a constraint.

- [ ] **Step 3: Write the failing tests**

Create `tests/Feature/Database/PortableSchemaTest.php`:

```php
<?php

use App\Models\GameRound;
use App\Models\IntegrationDelivery;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

it('leaves the json columns of a round without a database default', function () {
    $defaults = collect(Schema::getColumns('game_rounds'))
        ->whereIn('name', ['revealed_positions', 'picked_letters', 'picked_by', 'clue', 'drawing'])
        ->pluck('default', 'name')
        ->all();

    expect($defaults)->toBe([
        'revealed_positions' => null,
        'picked_letters' => null,
        'picked_by' => null,
        'clue' => null,
        'drawing' => null,
    ]);
});

it('gives a new round its empty lists from the model', function () {
    $round = GameRound::factory()->create()->fresh();

    expect($round->revealed_positions)->toBe([])
        ->and($round->picked_letters)->toBe([])
        ->and($round->clue)->toBe([])
        ->and($round->drawing)->toBe([]);
});

it('keeps a webhook payload of half a megabyte whole', function () {
    $delivery = IntegrationDelivery::factory()->create();
    $content = str_repeat('a', 524_288);

    DB::table('integration_delivery_payloads')->insert([
        'id' => (string) Str::uuid7(),
        'integration_delivery_id' => $delivery->id,
        'message' => $content,
        'request_headers' => $content,
        'request_body' => $content,
        'response_excerpt' => $content,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $stored = DB::table('integration_delivery_payloads')->where('integration_delivery_id', $delivery->id)->first();

    expect(strlen((string) $stored->message))->toBe(524_288)
        ->and(strlen((string) $stored->request_body))->toBe(524_288);
});

it('does not move the expiry of an invitation when another column changes', function () {
    $invitation = WorkspaceInvitation::factory()->create(['expires_at' => now()->addDays(3)->startOfSecond()]);
    $expiresAt = DB::table('workspace_invitations')->where('id', $invitation->id)->value('expires_at');

    $this->travel(2)->hours();
    DB::table('workspace_invitations')->where('id', $invitation->id)->update(['accepted_at' => now()]);

    expect(DB::table('workspace_invitations')->where('id', $invitation->id)->value('expires_at'))->toBe($expiresAt);
});
```

Create `tests/Feature/Database/CheckConstraintsTest.php`:

```php
<?php

use App\Enums\HealthStatement;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\SavedPokerDeck;
use App\Models\TeamHealthStatement;
use App\Models\User;
use App\Support\Database\CheckConstraint;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    if (! CheckConstraint::isEnforced()) {
        $this->markTestSkipped('This engine cannot add a check constraint to an existing table; the model is the guard.');
    }
});

it('refuses on the database a recurrence without a due date', function () {
    $item = ActionItem::factory()->create();

    expect(fn () => DB::transaction(fn () => DB::table('action_items')->where('id', $item->id)->update(['recurrence' => 'weekly', 'due_on' => null])))
        ->toThrow(QueryException::class);
});

it('refuses on the database a member and a guest assignee at once', function () {
    $guest = Participant::factory()->guest()->create();
    $item = ActionItem::factory()->create(['retro_id' => $guest->retro_id]);

    expect(fn () => DB::transaction(fn () => DB::table('action_items')->where('id', $item->id)->update([
        'assignee_participant_id' => $guest->id,
        'assignee_user_id' => User::factory()->create()->id,
    ])))->toThrow(QueryException::class);
});

it('refuses on the database a guest assignee on an item without a retro', function () {
    $guest = Participant::factory()->guest()->create();
    $team = $guest->retro->team;
    $item = ActionItem::factory()->withoutRetro($team, teamMember($team))->create();

    expect(fn () => DB::transaction(fn () => DB::table('action_items')->where('id', $item->id)->update(['assignee_participant_id' => $guest->id])))
        ->toThrow(QueryException::class);
});

it('refuses on the database a built-in health statement that also has a text', function () {
    $statement = TeamHealthStatement::factory()->create(['builtin' => HealthStatement::Vision, 'text' => null, 'label' => null]);

    expect(fn () => DB::transaction(fn () => DB::table('team_health_statements')->where('id', $statement->id)->update(['text' => 'Reworded', 'label' => 'Vision'])))
        ->toThrow(QueryException::class);
});

it('refuses on the database a deck with both owners or none', function (bool $withTeam, bool $withWorkspace) {
    $deck = SavedPokerDeck::factory()->create();
    $team = $deck->team;

    expect(fn () => DB::transaction(fn () => DB::table('poker_decks')->where('id', $deck->id)->update([
        'team_id' => $withTeam ? $team->id : null,
        'workspace_id' => $withWorkspace ? $team->workspace_id : null,
    ])))->toThrow(QueryException::class);
})->with([
    'both owners' => [true, true],
    'no owner' => [false, false],
]);
```

If a factory used here builds a row another way than assumed (the built-in statement factory, for instance), read the factory and adapt the arrange lines; the assertion stays.

- [ ] **Step 4: Run them to see them fail**

Run: `bin/test-db pgsql -- tests/Feature/Database/PortableSchemaTest.php tests/Feature/Database/CheckConstraintsTest.php`
Expected: FAIL. The first test finds `'[]'::jsonb` defaults; `CheckConstraint` does not exist. The payload and invitation tests pass on PostgreSQL (they are pins for MariaDB and MySQL).

- [ ] **Step 5: Write `CheckConstraint`**

Create `app/Support/Database/CheckConstraint.php` (`vendor/bin/sail artisan make:class Support/Database/CheckConstraint --no-interaction`, then replace its body):

```php
<?php

namespace App\Support\Database;

use Illuminate\Support\Facades\DB;

class CheckConstraint
{
    /**
     * The expression is written once for every engine: no cast, no function, no boolean literal.
     */
    public static function add(string $table, string $name, string $expression): void
    {
        if (! self::isEnforced()) {
            return;
        }

        DB::statement("alter table {$table} add constraint {$name} check ({$expression})");
    }

    /**
     * SQLite accepts a check only when the table is created; there the model enforces the rule alone.
     */
    public static function isEnforced(): bool
    {
        return DB::getDriverName() !== 'sqlite';
    }
}
```

- [ ] **Step 6: Edit the historic migrations (the PostgreSQL schema stays the same)**

`2026_10_06_100000_create_game_tables.php`: remove `use Illuminate\Database\Query\Expression;` and change

```php
            $table->jsonb('revealed_positions')->default(new Expression("'[]'::jsonb"));
            $table->jsonb('picked_letters')->default(new Expression("'[]'::jsonb"));
            $table->jsonb('picked_by')->default(new Expression("'[]'::jsonb"));
```
to
```php
            $table->jsonb('revealed_positions');
            $table->jsonb('picked_letters');
            $table->jsonb('picked_by');
```
and the same for `clue` and `drawing`. In the same file, `$table->timestamp('started_at');` becomes `$table->dateTime('started_at');`, and both `$table->timestamp('created_at');` (tables `game_points` and `game_used_words`) become `$table->dateTime('created_at');`.

One line each, `timestamp` to `dateTime`:

| File | Before | After |
|---|---|---|
| `2026_09_29_110028_create_workspace_invitations_table.php` | `$table->timestamp('expires_at');` | `$table->dateTime('expires_at');` |
| `2026_10_02_100500_create_action_item_reminders_table.php` | `$table->timestamp('sent_at');` | `$table->dateTime('sent_at');` |
| `2026_10_05_100000_create_integration_tables.php` | `$table->timestamp('checked_at');` | `$table->dateTime('checked_at');` |
| `2026_10_07_100000_extend_integration_tables_for_sync_and_channels.php` | `$table->timestamp('received_at');` | `$table->dateTime('received_at');` |

`2026_10_08_100000_create_integration_delivery_payloads_table.php`: the four `$table->text(...)` lines become `$table->longText('message');`, `$table->longText('request_headers')->nullable();`, `$table->longText('request_body')->nullable();`, `$table->longText('response_excerpt')->nullable();`.

`2026_10_01_100300_create_workspace_templates_table.php`: delete the `DB::statement('create unique index …')` line and the `use Illuminate\Support\Facades\DB;` import.

`2026_10_03_100100_create_poker_decks_table.php` and `2026_10_10_100000_create_whiteboard_templates_table.php`: delete from `if (DB::getDriverName() !== 'pgsql') {` to the `DB::statement(...)` line included, and the `DB` import.

`2026_10_01_110000_create_team_health_statements_table.php`: replace the guard and the statement with

```php
        CheckConstraint::add(
            'team_health_statements',
            'team_health_statements_builtin_or_custom',
            '(builtin is not null and text is null and label is null) or (builtin is null and text is not null and label is not null)',
        );
```

and import `App\Support\Database\CheckConstraint` instead of `DB`.

`2026_10_02_100000_add_v2_columns_to_action_items_table.php`: replace the body of `addChecks()` with

```php
        CheckConstraint::add('action_items', 'action_items_single_assignee', 'assignee_user_id is null or assignee_participant_id is null');
        CheckConstraint::add('action_items', 'action_items_guest_assignee_needs_retro', 'retro_id is not null or assignee_participant_id is null');
        CheckConstraint::add('action_items', 'action_items_recurrence_needs_due_date', 'recurrence is null or due_on is not null');
```

and add the import (`DB` stays: `backfill()` uses it).

`2026_10_15_100000_add_workspace_to_poker_decks_table.php`: replace everything after the `Schema::table(...)` call with

```php
        CheckConstraint::add('poker_decks', 'poker_decks_single_owner', '(team_id is null) <> (workspace_id is null)');
```

and replace the `DB` import with `App\Support\Database\CheckConstraint`. The expression is kept as it is so that PostgreSQL stores the same definition; MySQL and MariaDB accept the comparison of two predicates.

- [ ] **Step 7: Bring existing installs to the same schema**

Run: `vendor/bin/sail artisan make:migration drop_json_defaults_from_game_rounds --no-interaction`, rename the file to `2026_10_19_100000_drop_json_defaults_from_game_rounds.php`, and write:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Installs migrated before the defaults left the create migration still have them.
     */
    public function up(): void
    {
        Schema::table('game_rounds', function (Blueprint $table): void {
            $table->jsonb('revealed_positions')->change();
            $table->jsonb('picked_letters')->change();
            $table->jsonb('picked_by')->change();
            $table->jsonb('clue')->change();
            $table->jsonb('drawing')->change();
        });
    }
};
```

- [ ] **Step 8: Run the two test files on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/Database/PortableSchemaTest.php tests/Feature/Database/CheckConstraintsTest.php`
Expected: PASS, 10 tests.

- [ ] **Step 9: Run the upgrade proof**

Run: `bin/check-pg-upgrade`
Expected at this task: the row check passes, and the schema diff shows **only** the four old expression indexes, present in the upgraded database and absent from the fresh one (Task 4 drops them). Any other line in `storage/logs/check-pg-upgrade.diff` means an edit of Step 6 changed PostgreSQL: undo that edit and find another way. Copy the diff into the task report.

- [ ] **Step 10: Migrate on the three other engines**

```bash
bin/test-db sqlite -- tests/Feature/Database
bin/test-db mariadb -- tests/Feature/Database
bin/test-db mysql -- tests/Feature/Database
```

Expected: the migrations run to the end on the three. `PortableSchemaTest` and `ConnectionSettingsTest` pass on the three; `CheckConstraintsTest` passes on MariaDB and MySQL and is skipped on SQLite (6 skipped). If a migration still stops, the message names it: the causes left are a keyword used as an identifier in a check expression (`text`, `label` in the health statement check: quote nothing, rename nothing, report it and stop) or a `change()` MariaDB refuses.

- [ ] **Step 11: Lower the lists**

In `tests/Arch/database-portability-baseline.txt` delete the lines of the twelve migrations edited here whose rule is `driver branch`, `cast with ::`, `expression default` or `non-null timestamp`. In `tests/Arch/database-portability-allowed.txt` delete the `raw sql` lines of the six migrations that no longer call `DB::statement` or `new Expression`, and keep `2026_10_02_100000_add_v2_columns_to_action_items_table.php|raw sql` at the count of its `DB::raw` calls (4).

Run: `vendor/bin/sail artisan test --compact tests/Arch`
Expected: PASS. "lists nothing that is no longer there" tells which line is still too high.

- [ ] **Step 12: The task's closing run, the first with numbers on every engine**

Run `bin/test-db pgsql`, `bin/test-db sqlite`, `bin/test-db mariadb`, `bin/test-db mysql`.
Expected: PostgreSQL fully green **except** the tests that asserted the removed PostgreSQL indexes: `WhiteboardTemplatesTest` "keeps the name unique in the database too" and any deck or template test that expects a `QueryException` on a duplicate name. Do not fix them here: Task 4 restores the uniqueness. List them in the baseline file. On SQLite, MariaDB and MySQL, expect many failures; this is the first real baseline. For each of the three, write in the baseline file the summary line and the failing test files grouped by the first line of their error (`grep -E "FAIL|Error|Exception" storage/logs/test-db/sqlite.log | sort | uniq -c | sort -rn | head -40` helps).

- [ ] **Step 13: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add app/Support/Database/CheckConstraint.php database/migrations bin/check-pg-upgrade tests/Fixtures/pgsql/before-portability.sql tests/Feature/Database/PortableSchemaTest.php tests/Feature/Database/CheckConstraintsTest.php tests/Arch/database-portability-baseline.txt tests/Arch/database-portability-allowed.txt docs/superpowers/research/database-portability-baseline.md
git commit -m "feat(database): the migrations run on SQLite, MariaDB and MySQL, and check constraints follow the engine"
```

---

## Task 4: Names are unique through a stored key

**Files:**
- Create: `app/Support/Database/NameKey.php`, `database/migrations/2026_10_19_100100_add_name_keys_to_named_tables.php`, `tests/Unit/Support/Database/NameKeyTest.php`, `tests/Feature/Database/NameKeysTest.php`, `tests/Feature/Database/NameKeysMigrationTest.php`
- Modify: `app/Models/WorkspaceTemplate.php`, `app/Models/WhiteboardTemplate.php`, `app/Models/SavedPokerDeck.php`, `app/Http/Requests/WorkspaceTemplateRequest.php:100-109`, `app/Actions/Poker/SavedPokerDeckRules.php:31-34`, `app/Actions/Whiteboards/WhiteboardTemplateRules.php:26-31`, `app/Http/Controllers/PokerDeckDuplicatesController.php:37-52`, `tests/Feature/Whiteboards/WhiteboardTemplatesTest.php:144-158`, the two list files

**Interfaces:**
- Consumes: nothing from Task 3 but the migrations without their expression indexes.
- Produces: `App\Support\Database\NameKey::of(string $name): string`; column `name_key` (string 160, not null) on `workspace_templates`, `whiteboard_templates`, `poker_decks`; unique indexes `workspace_templates_workspace_id_name_key_unique`, `whiteboard_templates_workspace_id_name_key_unique`, `poker_decks_team_id_name_key_unique`, `poker_decks_workspace_id_name_key_unique`; the migration class exposes `public function backfill(string $table, array $owners): void` for its test.

- [ ] **Step 1: Write the failing unit test**

Create `tests/Unit/Support/Database/NameKeyTest.php`:

```php
<?php

use App\Support\Database\NameKey;

it('folds case and drops surrounding white space', function (string $name, string $key) {
    expect(NameKey::of($name))->toBe($key);
})->with([
    'capitals' => ['Sprint Map', 'sprint map'],
    'surrounding spaces' => ['  sprint MAP ', 'sprint map'],
    'accented capitals' => ['ÉTÉ Élan', 'été élan'],
    'inner spaces are kept' => ['Sprint  Map', 'sprint  map'],
    'accents are kept' => ['Été', 'été'],
]);

it('keeps two names apart when only an accent differs', function () {
    expect(NameKey::of('peche'))->not->toBe(NameKey::of('pêche'));
});
```

Run: `bin/test-db sqlite -- tests/Unit/Support/Database/NameKeyTest.php`
Expected: FAIL, class `App\Support\Database\NameKey` not found.

- [ ] **Step 2: Write `NameKey`**

```php
<?php

namespace App\Support\Database;

use Illuminate\Support\Str;

class NameKey
{
    /**
     * The form a name is compared by. Computed in PHP so that every engine stores the same key.
     */
    public static function of(string $name): string
    {
        return Str::lower(trim($name));
    }
}
```

Run the unit test again. Expected: PASS, 6 tests.

- [ ] **Step 3: Write the failing feature tests**

Create `tests/Feature/Database/NameKeysTest.php`:

```php
<?php

use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

it('has a plain unique index on each owner and name key', function (string $table, array $columns) {
    expect(Schema::hasIndex($table, $columns, 'unique'))->toBeTrue();
})->with([
    ['workspace_templates', ['workspace_id', 'name_key']],
    ['whiteboard_templates', ['workspace_id', 'name_key']],
    ['poker_decks', ['team_id', 'name_key']],
    ['poker_decks', ['workspace_id', 'name_key']],
]);

it('stores the key of a name whenever the name is set', function () {
    $template = WorkspaceTemplate::factory()->create(['name' => '  Sprint MAP ']);

    expect($template->fresh()->name_key)->toBe('sprint map');

    $template->update(['name' => 'Été']);

    expect($template->fresh()->name_key)->toBe('été');
});

it('refuses in the database a second name that differs only by case', function (Closure $first, Closure $second) {
    $first();

    expect(fn () => DB::transaction($second))->toThrow(UniqueConstraintViolationException::class);
})->with([
    'workspace template' => function () {
        $workspace = Workspace::factory()->create();

        return [
            fn () => WorkspaceTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Sprint Map']),
            fn () => WorkspaceTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'sprint map']),
        ];
    },
    'whiteboard template' => function () {
        $workspace = Workspace::factory()->create();

        return [
            fn () => WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Sprint Map']),
            fn () => WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => ' SPRINT MAP ']),
        ];
    },
    'team deck' => function () {
        $team = Team::factory()->create();

        return [
            fn () => SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Scale']),
            fn () => SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'scale']),
        ];
    },
    'workspace deck' => function () {
        $workspace = Workspace::factory()->create();

        return [
            fn () => SavedPokerDeck::factory()->forWorkspace($workspace)->create(['name' => 'Scale']),
            fn () => SavedPokerDeck::factory()->forWorkspace($workspace)->create(['name' => 'SCALE']),
        ];
    },
]);

it('accepts the same name under two owners, and for a team and its workspace', function () {
    $team = Team::factory()->create();

    SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Scale']);
    SavedPokerDeck::factory()->create(['team_id' => Team::factory()->create()->id, 'name' => 'Scale']);
    SavedPokerDeck::factory()->forWorkspace($team->workspace)->create(['name' => 'Scale']);
    SavedPokerDeck::factory()->forWorkspace(Workspace::factory()->create())->create(['name' => 'Scale']);

    expect(SavedPokerDeck::query()->where('name_key', 'scale')->count())->toBe(4);
});
```

The dataset closures return two closures each; if Pest's lazy datasets do not unpack a returned pair in this version, write the four cases as four `it()` blocks with the same two lines. The assertion does not change.

Create `tests/Feature/Database/NameKeysMigrationTest.php`:

```php
<?php

use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

function nameKeysMigration(): object
{
    return require database_path('migrations/2026_10_19_100100_add_name_keys_to_named_tables.php');
}

it('fills the key of every row and keeps the names', function () {
    $workspace = Workspace::factory()->create();
    $template = WorkspaceTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Sprint Map']);
    DB::table('workspace_templates')->where('id', $template->id)->update(['name_key' => 'stale']);

    nameKeysMigration()->backfill('workspace_templates', ['workspace_id']);

    expect($template->fresh()->name_key)->toBe('sprint map')
        ->and($template->fresh()->name)->toBe('Sprint Map');
});

it('gives a later row with the same key a distinct key, keeps both names and logs it', function () {
    Log::spy();
    $workspace = Workspace::factory()->create();
    $older = WorkspaceTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Sprint']);
    $newer = WorkspaceTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Other']);
    DB::table('workspace_templates')->where('id', $older->id)->update(['name_key' => 'a']);
    DB::table('workspace_templates')->where('id', $newer->id)->update(['name' => 'Sprint ', 'name_key' => 'b']);

    nameKeysMigration()->backfill('workspace_templates', ['workspace_id']);

    expect($older->fresh()->name_key)->toBe('sprint')
        ->and($newer->fresh()->name)->toBe('Sprint ')
        ->and($newer->fresh()->name_key)->toBe('sprint ~'.substr($newer->id, -8));

    Log::shouldHaveReceived('warning')->once();
});

it('treats the same key under two owners as no collision', function () {
    $first = WorkspaceTemplate::factory()->create(['name' => 'Sprint']);
    $second = WorkspaceTemplate::factory()->create(['name' => 'sprint']);

    nameKeysMigration()->backfill('workspace_templates', ['workspace_id']);

    expect($first->fresh()->name_key)->toBe('sprint')
        ->and($second->fresh()->name_key)->toBe('sprint');
});
```

Run: `bin/test-db pgsql -- tests/Feature/Database/NameKeysTest.php tests/Feature/Database/NameKeysMigrationTest.php`
Expected: FAIL, the migration file and the column do not exist.

- [ ] **Step 4: Write the migration**

Run `vendor/bin/sail artisan make:migration add_name_keys_to_named_tables --no-interaction`, rename to `2026_10_19_100100_add_name_keys_to_named_tables.php`:

```php
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

    /**
     * The key replaces the unique indexes on lower(name) that only PostgreSQL had.
     * They are dropped last, once the new indexes exist.
     */
    public function up(): void
    {
        foreach (self::Owners as $table => $owners) {
            Schema::table($table, function (Blueprint $blueprint): void {
                $blueprint->string('name_key', 160)->nullable();
            });

            $this->backfill($table, $owners);

            Schema::table($table, function (Blueprint $blueprint) use ($owners): void {
                $blueprint->string('name_key', 160)->nullable(false)->change();

                foreach ($owners as $owner) {
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
     * same owner with the same key gets a suffix. Names are never changed.
     *
     * @param  array<int, string>  $owners
     */
    public function backfill(string $table, array $owners): void
    {
        $taken = [];

        foreach (DB::table($table)->orderBy('id')->lazyById(500) as $row) {
            $key = NameKey::of((string) $row->name);
            $scope = implode('|', array_map(fn (string $owner): string => (string) $row->{$owner}, $owners));

            if (isset($taken[$scope][$key])) {
                $key = "{$key} ~".substr((string) $row->id, -8);

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
```

Ids are UUID version 7, so id order is creation order.

- [ ] **Step 5: Fill the key from the models**

In each of `app/Models/WorkspaceTemplate.php`, `app/Models/WhiteboardTemplate.php`, `app/Models/SavedPokerDeck.php`, add the property line `@property string $name_key` to the docblock, the imports `App\Support\Database\NameKey` and `Illuminate\Database\Eloquent\Casts\Attribute`, and this method:

```php
    /**
     * The key always follows the name: no caller sets it.
     *
     * @return Attribute<string, string>
     */
    protected function name(): Attribute
    {
        return Attribute::make(
            set: fn (string $name): array => ['name' => $name, 'name_key' => NameKey::of($name)],
        );
    }
```

`App\Support` may be used by models (the Arch test forbids `App\Actions`, `App\Http`, `App\Mcp` only).

- [ ] **Step 6: Compare keys in the three rules**

`app/Http/Requests/WorkspaceTemplateRequest.php`, in `nameIsTaken()`:

```php
        return $this->workspace()->templates()
            ->where('name_key', NameKey::of((string) $this->input('name')))
            ->when($ignoredId !== null, fn ($query) => $query->whereKeyNot($ignoredId))
            ->exists();
```

`app/Actions/Poker/SavedPokerDeckRules.php`, in `nameRules()`:

```php
                $isTaken = $owner->pokerDecks()
                    ->where('name_key', NameKey::of($value))
                    ->when($ignore !== null, fn ($query) => $query->whereKeyNot($ignore?->id))
                    ->exists();
```

`app/Actions/Whiteboards/WhiteboardTemplateRules.php`, in `ensureNameIsFree()`:

```php
        $isTaken = $lockedWorkspace->whiteboardTemplates()
            ->where('name_key', NameKey::of($name))
            ->when($ignore !== null, fn ($query) => $query->whereKeyNot($ignore?->id))
            ->exists();
```

Import `App\Support\Database\NameKey` in the three files.

`app/Http/Controllers/PokerDeckDuplicatesController.php`, `availableName()`, folds names itself with `mb_strtolower`; use the key so that one fold exists:

```php
        $takenKeys = $team->pokerDecks()->pluck('name_key');
        $baseName = __('Copy of :name', ['name' => $originalName]);

        $name = Str::limit($baseName, 40, '');
        $number = 2;

        while ($takenKeys->contains(NameKey::of($name))) {
```

(the body of the loop is unchanged).

- [ ] **Step 7: Update the two tests that named the database's fold**

In `tests/Feature/Whiteboards/WhiteboardTemplatesTest.php`, rename `it('refuses a name the database folds to one already used', …)` to `it('refuses a name that folds to one already used', …)` (body unchanged), and in `it('keeps the name unique in the database too', …)` replace `->toThrow(QueryException::class)` with `->toThrow(UniqueConstraintViolationException::class)`, wrapping the second create in `DB::transaction(fn () => …)` and importing `Illuminate\Database\UniqueConstraintViolationException` and `DB`.

- [ ] **Step 8: Run the tests of this task**

Run: `bin/test-db pgsql -- tests/Unit/Support/Database/NameKeyTest.php tests/Feature/Database/NameKeysTest.php tests/Feature/Database/NameKeysMigrationTest.php tests/Feature/Whiteboards/WhiteboardTemplatesTest.php tests/Feature/Poker tests/Feature/Workspaces`
Expected: PASS. Then the same command with `sqlite` and with `mariadb`; expected: the three `Database` files and `NameKeyTest` pass on both. Other files may still fail for reasons of later tasks; they must not fail on a name rule.

- [ ] **Step 9: The upgrade proof is now complete for names**

Run: `bin/check-pg-upgrade`
Expected: PASS, an empty schema diff: the four expression indexes are gone from the upgraded database, the four key indexes are in both. The row list is unchanged: `Sprint` and `Sprint ` are both there. Then check the collision was handled:

```bash
grep -c "share a name once case and spaces are ignored" storage/logs/laravel.log
```

Expected: at least 1 (the fixture's twin). If the log is on another channel in Sail, read `docker compose logs laravel.test | grep "share a name"`.

- [ ] **Step 10: Lower the lists**

Delete from the allowed list the `raw sql` lines of `WorkspaceTemplateRequest.php`, `SavedPokerDeckRules.php` and `WhiteboardTemplateRules.php` (each had one `whereRaw`). Run `vendor/bin/sail artisan test --compact tests/Arch`. Expected: PASS.

- [ ] **Step 11: The task's closing run**

As defined in **Running the suite**. Expected: PostgreSQL fully green again (the tests Task 3 left red pass). Record the three lines.

- [ ] **Step 12: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add app/Support/Database/NameKey.php app/Models/WorkspaceTemplate.php app/Models/WhiteboardTemplate.php app/Models/SavedPokerDeck.php app/Http/Controllers/PokerDeckDuplicatesController.php app/Http/Requests/WorkspaceTemplateRequest.php app/Actions/Poker/SavedPokerDeckRules.php app/Actions/Whiteboards/WhiteboardTemplateRules.php database/migrations/2026_10_19_100100_add_name_keys_to_named_tables.php tests/Unit/Support/Database/NameKeyTest.php tests/Feature/Database/NameKeysTest.php tests/Feature/Database/NameKeysMigrationTest.php tests/Feature/Whiteboards/WhiteboardTemplatesTest.php tests/Arch/database-portability-allowed.txt docs/superpowers/research/database-portability-baseline.md
git commit -m "feat(database): template and deck names are unique through a stored key, on every engine"
```


---

## Task 5: Raw SQL that only PostgreSQL understands

**Files:**
- Create: `app/Support/Database/Sql.php`, `app/Support/Database/InsertOnce.php`, `tests/Unit/Support/Database/SqlTest.php`, `tests/Feature/Database/InsertOnceTest.php`
- Modify: `app/Actions/ActionItems/ActionItemQuery.php:52-70,119-135`, `app/Actions/Integrations/TrackedIssues.php:34,53`, `app/Actions/Games/RoomLeaderboard.php:35`, `app/Actions/Games/TeamGameLeaderboard.php:48`, `app/Actions/Games/GameStreaks.php:11-41`, `app/Actions/Games/DrawGameWord.php:31-36`, `app/Actions/ActionItems/SendActionItemReminders.php:102-112`, `app/Http/Controllers/Games/GameHostsController.php:31`, `app/Http/Controllers/Games/GameRoundsController.php:33`, the two list files

**Interfaces:**
- Produces: `App\Support\Database\Sql::countWhen(string $condition): string`, `Sql::nullsLast(string $expression): string`, `Sql::never(): string`; `App\Support\Database\InsertOnce::into(string $table, array $values): bool`.

- [ ] **Step 1: See the existing tests fail on another engine**

Run: `bin/test-db mariadb -- tests/Feature/ActionItems tests/Feature/Games tests/Feature/Integrations`
Expected: failures whose message quotes `filter (where`, `nulls last`, `date_trunc`. On SQLite (`bin/test-db sqlite -- tests/Feature/Games`), `date_trunc` fails too. These are the red tests of this task; note their names in the task report.

- [ ] **Step 2: Write the failing unit and feature tests**

Create `tests/Unit/Support/Database/SqlTest.php`:

```php
<?php

use App\Support\Database\Sql;

it('counts the rows that meet a condition with a sum over a case', function () {
    expect(Sql::countWhen('completed_at is null'))->toBe('sum(case when completed_at is null then 1 else 0 end)');
});

it('ranks a null expression after the others', function () {
    expect(Sql::nullsLast('action_items.due_on'))->toBe('case when action_items.due_on is null then 1 else 0 end');
});

it('matches nothing without a boolean literal', function () {
    expect(Sql::never())->toBe('1 = 0');
});
```

Create `tests/Feature/Database/InsertOnceTest.php`:

```php
<?php

use App\Models\Team;
use App\Support\Database\InsertOnce;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

function usedWord(Team $team, string $word): array
{
    return ['team_id' => $team->id, 'locale' => 'en', 'word' => $word, 'created_at' => now()];
}

it('inserts a row and says so', function () {
    $team = Team::factory()->create();

    expect(InsertOnce::into('game_used_words', usedWord($team, 'rocket')))->toBeTrue()
        ->and(DB::table('game_used_words')->where('team_id', $team->id)->count())->toBe(1);
});

it('leaves the first row and answers false when the key is taken', function () {
    $team = Team::factory()->create();
    InsertOnce::into('game_used_words', usedWord($team, 'rocket'));

    expect(InsertOnce::into('game_used_words', usedWord($team, 'rocket')))->toBeFalse()
        ->and(DB::table('game_used_words')->where('team_id', $team->id)->count())->toBe(1);
});

it('leaves the open transaction usable after a refused insert', function () {
    $team = Team::factory()->create();

    DB::transaction(function () use ($team): void {
        InsertOnce::into('game_used_words', usedWord($team, 'rocket'));
        InsertOnce::into('game_used_words', usedWord($team, 'rocket'));
        InsertOnce::into('game_used_words', usedWord($team, 'planet'));
    });

    expect(DB::table('game_used_words')->where('team_id', $team->id)->count())->toBe(2);
});

it('does not hide an error that is not a duplicate', function () {
    expect(fn () => DB::transaction(fn () => InsertOnce::into('game_used_words', ['locale' => 'en', 'word' => 'rocket', 'created_at' => now()])))
        ->toThrow(QueryException::class);
});
```

Run: `bin/test-db pgsql -- tests/Unit/Support/Database/SqlTest.php tests/Feature/Database/InsertOnceTest.php`
Expected: FAIL, the two classes do not exist.

- [ ] **Step 3: Write the two helpers**

`app/Support/Database/Sql.php`:

```php
<?php

namespace App\Support\Database;

/**
 * The conditional fragments that every engine accepts, in place of
 * `filter (where …)`, `nulls last` and a boolean literal.
 */
class Sql
{
    public static function countWhen(string $condition): string
    {
        return "sum(case when {$condition} then 1 else 0 end)";
    }

    /**
     * A sort key to put before the expression itself.
     */
    public static function nullsLast(string $expression): string
    {
        return "case when {$expression} is null then 1 else 0 end";
    }

    public static function never(): string
    {
        return '1 = 0';
    }
}
```

`app/Support/Database/InsertOnce.php`:

```php
<?php

namespace App\Support\Database;

use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class InsertOnce
{
    /**
     * False when a unique key already holds the row. The insert runs in its own nested
     * transaction: on PostgreSQL a refused insert would otherwise abort the caller's.
     *
     * @param  array<string, mixed>  $values
     */
    public static function into(string $table, array $values): bool
    {
        try {
            DB::transaction(fn (): bool => DB::table($table)->insert($values));
        } catch (UniqueConstraintViolationException) {
            return false;
        }

        return true;
    }
}
```

Run the two test files on `pgsql`, `sqlite` and `mariadb`. Expected: PASS on the three (7 tests).

- [ ] **Step 4: `ActionItemQuery`**

In `counts()`:

```php
        $totals = $this->filterByScope($this->visibleTo($user, $workspace), $user, $filters)
            ->toBase()
            ->selectRaw(Sql::countWhen('completed_at is null').' as open_total')
            ->selectRaw(Sql::countWhen('completed_at is null and due_on is not null and due_on < ?').' as overdue_total', [$today])
            ->selectRaw(Sql::countWhen('completed_at is not null').' as completed_total')
            ->selectRaw(Sql::countWhen('completed_at is null and assignee_user_id = ?').' as mine_total', [$user->id])
            ->selectRaw('count(distinct retro_id) as rituals_total')
            ->first();

        return [
            'open' => (int) $totals->open_total,
            'overdue' => (int) $totals->overdue_total,
            'completed' => (int) $totals->completed_total,
            'mine' => (int) $totals->mine_total,
            'rituals' => (int) $totals->rituals_total,
        ];
```

The aliases change because `open` is a keyword on MySQL and MariaDB; the array the method returns does not change.

In `order()`:

```php
        $today = ActionItem::today()->toDateString();
        $dueOnWhileOpen = 'case when action_items.completed_at is null then action_items.due_on end';

        return $query
            ->orderByRaw('case when action_items.completed_at is null then 0 else 1 end')
            ->orderByRaw('case when action_items.completed_at is null and action_items.due_on < ? then 0 else 1 end', [$today])
            ->orderByRaw(Sql::nullsLast($dueOnWhileOpen))
            ->orderByRaw($dueOnWhileOpen)
            ->orderByRaw(
                'case when action_items.completed_at is null then (case action_items.priority when ? then 0 when ? then 1 else 2 end) end',
                [ActionItemPriority::High->value, ActionItemPriority::Medium->value],
            )
            ->latest('action_items.completed_at')
            ->latest('action_items.created_at')
            ->orderBy('action_items.id');
```

Where NULL sorts no longer matters: within the open items the third key separates "has a due date" from "has none"; within the completed ones every remaining NULL key is a tie, broken by `completed_at`, `created_at` and `id`. Import `App\Support\Database\Sql`.

- [ ] **Step 5: `TrackedIssues`, the two leaderboards**

`TrackedIssues.php`, both sites: `->whereRaw('false')` becomes `->whereRaw(Sql::never())`.

`RoomLeaderboard.php`:

```php
            ->selectRaw('player_id, sum(points) as total_points, '.Sql::countWhen('is_win = ?').' as wins, count(*) as rounds_played', [true])
```

`TeamGameLeaderboard.php` (the ordering lines belong to Task 7):

```php
            ->selectRaw('game_points.user_id, users.name, sum(game_points.points) as total_points, '.Sql::countWhen('game_points.is_win = ?').' as wins, count(*) as rounds_played', [true])
```

In both queries the binding of the `selectRaw` comes before the bindings of the `where` clauses in the SQL text, which is where Laravel puts select bindings. Import `Sql` in the three files.

- [ ] **Step 6: `GameStreaks` buckets weeks in PHP**

Replace the class docblock's last sentence ("Read with one grouped query, never stored.") with "Weeks are computed in PHP from the dates read, so every engine gives the same Monday; never stored." and the query of `forUsers()` with:

```php
        $weeks = GamePoint::query()
            ->where('team_id', $team->id)
            ->whereIn('user_id', $userIds)
            ->toBase()
            ->get(['user_id', 'created_at'])
            ->groupBy('user_id')
            ->map(fn ($rows): array => $rows
                ->map(fn (object $row): string => CarbonImmutable::parse((string) $row->created_at, 'UTC')
                    ->startOfWeek(CarbonInterface::MONDAY)
                    ->toDateString())
                ->unique()
                ->values()
                ->all());
```

The read is served by the index `(team_id, user_id, created_at)` and returns two small columns per point.

- [ ] **Step 7: `insertOrIgnore`**

`DrawGameWord.php`:

```php
        InsertOnce::into('game_used_words', [
            'team_id' => $room->team_id,
            'locale' => $room->locale,
            'word' => $word,
            'created_at' => now(),
        ]);
```

`SendActionItemReminders.php`, `log()`:

```php
        return InsertOnce::into('action_item_reminders', [
            'id' => (string) Str::uuid(),
            'action_item_id' => $item->id,
            'user_id' => $user->id,
            'kind' => $this->kind($item, $today)->value,
            'due_on' => (string) $item->due_on?->toDateString(),
            'sent_at' => now(),
        ]);
```

Remove the `DB` import from `DrawGameWord` only if `history()` no longer needs it (it does: keep it). `SendActionItemReminders.php:80` keeps `DB::raw(1)`: it is portable and stays on the allowed list.

- [ ] **Step 8: An id from a request is a UUID before it reaches a query**

`GameHostsController.php:31`: `'player_id' => ['required', 'string', 'uuid', Rule::exists('game_players', 'id')->where('game_room_id', $room->id)],`
`GameRoundsController.php:33`: `'leader_player_id' => ['nullable', 'string', 'uuid', Rule::exists('game_players', 'id')->where('game_room_id', $room->id)],`

Add to the existing feature test of each controller (find it with `grep -rln "games.hosts\|games.rounds.store" tests/Feature/Games`) one test each, in that file's style:

```php
it('answers 422, not 500, for a player id that is not a uuid', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)
        ->postJson(route('games.rounds.store', $room), ['leader_player_id' => 'not-a-uuid'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('leader_player_id');
});
```

and the same with the host route and `player_id`. Read the route names in `routes/web.php` (`grep -n "GameHostsController\|GameRoundsController" routes/web.php`) and use them as they are. Run each on `pgsql` before the rule is added: expected FAIL with a 500 (PostgreSQL rejects the malformed id); after: PASS.

- [ ] **Step 9: Run what Step 1 saw fail**

Run: `bin/test-db mariadb -- tests/Feature/ActionItems tests/Feature/Games tests/Feature/Integrations`, then the same on `sqlite` and `pgsql`.
Expected: no failure quotes `filter (where`, `nulls last`, `date_trunc`, `false` or `insert ignore` any more. Failures that remain belong to Tasks 8 and 10 (dates, tests that read SQL); list them.

- [ ] **Step 10: Lower the lists**

Baseline: delete the lines of `ActionItemQuery.php` (`filter (where`, `nulls first or last`), `GameStreaks.php` (`postgres function or clause`), `TrackedIssues.php` (`boolean literal in raw sql`), `DrawGameWord.php` and `SendActionItemReminders.php` (`insertOrIgnore`). Allowed list: `GameStreaks.php|raw sql` is deleted (no raw call left); the counts of the other files stay (the calls are still raw, now portable). Run `vendor/bin/sail artisan test --compact tests/Arch`. Expected: PASS.

- [ ] **Step 11: The task's closing run, then commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add app/Support/Database/Sql.php app/Support/Database/InsertOnce.php app/Actions/ActionItems/ActionItemQuery.php app/Actions/ActionItems/SendActionItemReminders.php app/Actions/Integrations/TrackedIssues.php app/Actions/Games app/Http/Controllers/Games/GameHostsController.php app/Http/Controllers/Games/GameRoundsController.php tests/Unit/Support/Database/SqlTest.php tests/Feature/Database/InsertOnceTest.php tests/Feature/Games tests/Arch docs/superpowers/research/database-portability-baseline.md
git commit -m "refactor(database): conditional counts, null placement, week buckets and insert-once work on every engine"
```

---

## Task 6: One search, the same on every engine

**Files:**
- Create: `app/Support/Database/TextSearch.php`, `app/Support/Database/SqliteFunctions.php`, `tests/Feature/Database/TextSearchTest.php`
- Modify: `app/Providers/AppServiceProvider.php` (`boot()`), `app/Mcp/Tools/Retro/SearchBoards.php:83-190`, `app/Mcp/Support/LikePattern.php` (or `app/Support/LikePattern.php` once 18f is merged), `app/Http/Controllers/TeamEstimatesController.php:39,138-141`, `app/Http/Controllers/Admin/AdminCandidatesController.php:15-41`, and, if it exists on the branch, `app/Actions/Search/SearchWorkspaceContent.php`; the two list files

**Interfaces:**
- Produces: `App\Support\Database\TextSearch::contains(Builder $query, string|array $columns, string $term): void` where `Builder` is `Illuminate\Contracts\Database\Query\Builder`; `TextSearch::pattern(string $term): string`; `App\Support\Database\SqliteFunctions::register(Connection $connection): void`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Database/TextSearchTest.php`:

```php
<?php

use App\Models\Retro;
use App\Models\Team;
use App\Support\Database\TextSearch;

function retrosTitled(string ...$titles): Team
{
    $team = Team::factory()->create();

    foreach ($titles as $title) {
        Retro::factory()->create(['team_id' => $team->id, 'title' => $title]);
    }

    return $team;
}

/**
 * @return array<int, string>
 */
function titlesFound(Team $team, string $term): array
{
    $query = Retro::query()->where('team_id', $team->id);

    TextSearch::contains($query, 'title', $term);

    return $query->orderBy('title')->pluck('title')->all();
}

it('finds a term whatever its case', function (string $term) {
    $team = retrosTitled('Sprint Review', 'Planning');

    expect(titlesFound($team, $term))->toBe(['Sprint Review']);
})->with(['sprint', 'SPRINT', 'rint rev']);

it('folds accented capitals like plain ones', function (string $term) {
    $team = retrosTitled('Bilan de l’ÉTÉ', 'Bilan de l’hiver');

    expect(titlesFound($team, $term))->toBe(['Bilan de l’ÉTÉ']);
})->with(['été', 'ÉTÉ', 'Été']);

it('does not match a letter with its accented form', function () {
    $team = retrosTitled('Bilan de l’été');

    expect(titlesFound($team, 'ete'))->toBe([]);
});

it('treats wildcard characters of the term as text', function (string $term, array $expected) {
    $team = retrosTitled('100% done', '100 done', 'a_b', 'axb', 'wow!', 'wow', 'back\\slash', 'backslash');

    expect(titlesFound($team, $term))->toBe($expected);
})->with([
    'percent' => ['100%', ['100% done']],
    'underscore' => ['a_b', ['a_b']],
    'the escape character itself' => ['wow!', ['wow!']],
    'backslash' => ['back\\s', ['back\\slash']],
    'only a percent' => ['%', ['100% done']],
    'only an underscore' => ['_', ['a_b']],
]);

it('searches several columns as one condition that does not leak out of its group', function () {
    $team = retrosTitled('Alpha', 'Beta');
    $other = retrosTitled('Alpha');

    $query = Retro::query()->where('team_id', $team->id);
    TextSearch::contains($query, ['title', 'summary'], 'alpha');

    expect($query->pluck('team_id')->unique()->all())->toBe([$team->id]);
});

```

`retros.summary` is the nullable text column the board search already reads; if the column has another name, use the second text column of `retros`.

Run: `bin/test-db pgsql -- tests/Feature/Database/TextSearchTest.php`
Expected: FAIL, `TextSearch` not found.

- [ ] **Step 2: Write `TextSearch`**

```php
<?php

namespace App\Support\Database;

use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

/**
 * Substring search that ignores case and takes the term literally, with the same SQL on every engine.
 */
class TextSearch
{
    private const string Escape = '!';

    /**
     * @param  string|array<int, string>  $columns
     */
    public static function contains(Builder $query, string|array $columns, string $term): void
    {
        $pattern = self::pattern($term);

        $query->where(function (Builder $group) use ($columns, $pattern): void {
            foreach (Arr::wrap($columns) as $column) {
                $group->orWhereRaw('lower('.self::wrap($group, $column).") like ? escape '".self::Escape."'", [$pattern]);
            }
        });
    }

    public static function pattern(string $term): string
    {
        $escaped = str_replace(
            [self::Escape, '%', '_'],
            [self::Escape.self::Escape, self::Escape.'%', self::Escape.'_'],
            Str::lower($term),
        );

        return "%{$escaped}%";
    }

    private static function wrap(Builder $query, string $column): string
    {
        if ($query instanceof Relation) {
            $query = $query->getQuery();
        }

        if ($query instanceof EloquentBuilder) {
            return $query->getQuery()->getGrammar()->wrap($query->qualifyColumn($column));
        }

        /** @var QueryBuilder $query */
        return $query->getGrammar()->wrap($column);
    }
}
```

A backslash needs no escaping: once `escape '!'` is given, it is an ordinary character on the four engines.

Run the test on `pgsql`. Expected: PASS (14 tests). Run it on `mariadb`. Expected: PASS. Run it on `sqlite`. Expected: the three "folds accented capitals" cases with a capital on one side FAIL: SQLite's `lower()` folds ASCII only. That is the red of the next step.

- [ ] **Step 3: Give SQLite a `lower()` that folds like PHP**

`app/Support/Database/SqliteFunctions.php`:

```php
<?php

namespace App\Support\Database;

use Illuminate\Database\Connection;
use Illuminate\Database\SQLiteConnection;
use PDO;
use Pdo\Sqlite;

class SqliteFunctions
{
    /**
     * SQLite's own lower() folds ASCII letters only; this one folds as PHP does, so a search
     * ignores the case of accented letters on SQLite as on the other engines.
     */
    public static function register(Connection $connection): void
    {
        if (! $connection instanceof SQLiteConnection) {
            return;
        }

        $pdo = $connection->getPdo();
        $lower = static fn (mixed $value): mixed => is_string($value) ? mb_strtolower($value, 'UTF-8') : $value;

        if ($pdo instanceof Sqlite) {
            $pdo->createFunction('lower', $lower, 1, Sqlite::DETERMINISTIC);

            return;
        }

        $pdo->sqliteCreateFunction('lower', $lower, 1, PDO::SQLITE_DETERMINISTIC);
    }
}
```

On PHP 8.4 and later Laravel opens the connection with `PDO::connect()`, which returns a `Pdo\Sqlite`; the second branch serves an older PHP.

In `app/Providers/AppServiceProvider.php`, in `boot()`, after the existing `Event::listen(IntegrationActivated::class, …)` line:

```php
        Event::listen(ConnectionEstablished::class, fn (ConnectionEstablished $event) => SqliteFunctions::register($event->connection));
```

with the imports `Illuminate\Database\Events\ConnectionEstablished` and `App\Support\Database\SqliteFunctions`.

Run: `bin/test-db sqlite -- tests/Feature/Database/TextSearchTest.php`
Expected: PASS, 14 tests. If SQLite refuses to replace the built-in `lower` (an error naming the function at connection time), stop using that name: register the function as `skrum_lower`, and in `TextSearch::contains` emit `skrum_lower(` instead of `lower(` when the query's connection is a `SQLiteConnection` (a private method `fold(Builder $query): string` in `TextSearch`, which lives in the folder allowed to look at the driver). Say so in the task report: it changes spec §6.4.

Then run `bin/test-db sqlite -- tests/Feature/Database` and `bin/test-db pgsql -- tests/Feature/Database`: the listener must break nothing.

- [ ] **Step 4: `SearchBoards`**

In `run()`, delete `$pattern = LikePattern::contains($term);` and drop `$pattern` from the four calls:

```php
        $matches = collect()
            ->concat($this->titles($retroIds, $term))
            ->concat($this->summaries($retroIds, $term))
            ->concat($this->actions($retroIds, $term))
            ->concat($this->messages($retroIds, $term, $grant))
            ->groupBy('retroId');
```

Each private method loses its `string $pattern` parameter and its `->where('…', 'ilike', $pattern)` line, and applies the search with `->tap()`:

```php
    private function titles(Builder $retroIds, string $term): Collection
    {
        return Retro::query()
            ->whereIn('id', $retroIds)
            ->tap(fn (Builder $query) => TextSearch::contains($query, 'title', $term))
            ->latest()
            ->limit(self::MaxRowsPerKind)
            ->get(['id', 'title'])
            ->map(fn (Retro $retro): array => ['retroId' => $retro->id, 'kind' => 'title', 'id' => null, 'snippet' => LikePattern::snippet($retro->title, $term)]);
    }
```

The same replacement in `summaries()` (column `summary`), `actions()` (column `content`) and `messages()` (column `content`; the `tap` goes where the `ilike` line was, before the visibility group). `Builder` in this file is the Eloquent builder already imported.

In `LikePattern`, delete the method `contains()`; `snippet()` stays.

- [ ] **Step 5: `TeamEstimatesController` and `AdminCandidatesController`**

`TeamEstimatesController.php:39`:

```php
            ->when($search !== '', fn ($query) => $query->tap(fn ($tasks) => TextSearch::contains($tasks, 'title', $search)))
```

and delete the private method `escapeLike()`.

`AdminCandidatesController::index()`:

```php
        $candidates = User::query()
            ->where('is_instance_admin', false)
            ->tap(fn ($query) => TextSearch::contains($query, ['name', 'email'], $request->string('query')->toString()))
            ->orderBy('name')
            ->orderBy('id')
            ->limit(self::MaxResults)
            ->get()
```

Delete `$pattern`, the private `escapeLike()` and the import `Illuminate\Contracts\Database\Query\Builder` if nothing else uses it. This search was case-sensitive on PostgreSQL; it now ignores case everywhere, which is what the screen needs. Add to the admin candidates feature test (`grep -rln "admin.admins.candidates\|AdminCandidates" tests/Feature/Admin`):

```php
it('finds a candidate whatever the case of the query, and takes a percent sign literally', function () {
    actingAsInstanceAdmin($this);
    User::factory()->create(['name' => 'Émilie Durand', 'email' => 'emilie@example.test']);
    User::factory()->create(['name' => '100% Remote', 'email' => 'remote@example.test']);

    $found = fn (string $query): array => $this->getJson(route('admin.admins.candidates', ['query' => $query]))->assertOk()->json('candidates.*.name');

    expect($found('émilie'))->toBe(['Émilie Durand'])
        ->and($found('DURAND'))->toBe(['Émilie Durand'])
        ->and($found('%'))->toBe(['100% Remote']);
});
```

Use the route name and the sign-in helper that file already uses (`actingAsInstanceAdmin` is the helper of `InstanceAdminsTest`; if it is local to that file, sign in the way the candidates test does).

- [ ] **Step 6: [18f] `SearchWorkspaceContent`, if it is on the branch**

If `app/Actions/Search/SearchWorkspaceContent.php` exists, apply the same change: delete `$pattern = LikePattern::contains($term);`, and replace each `->where('<column>', 'ilike', $pattern)` with `->tap(fn (Builder $query) => TextSearch::contains($query, '<column>', $term))`. The poker games query becomes:

```php
        $games = PokerGame::query()->whereIn('team_id', $teamIds)
            ->where(fn (Builder $query) => $query
                ->tap(fn (Builder $titles) => TextSearch::contains($titles, 'title', $term))
                ->orWhereHas('tasks', fn (Builder $tasks) => TextSearch::contains($tasks, 'title', $term)))
```

If the file is not on the branch yet, Task 9 does this step.

- [ ] **Step 7: Run the search tests on three engines**

Run: `bin/test-db pgsql -- tests/Feature/Database/TextSearchTest.php tests/Feature/Mcp/SearchBoardsTest.php tests/Feature/Admin tests/Feature/Poker` then with `sqlite`, then `mariadb` (and `tests/Feature/SearchTest.php` if 18f is merged).
Expected: PASS on the three, apart from failures already listed for other tasks.

- [ ] **Step 8: Lower the lists, closing run, commit**

Baseline: delete the `ilike` lines of `SearchBoards.php` and `TeamEstimatesController.php` and the `like outside TextSearch` line of `AdminCandidatesController.php` (and of `SearchWorkspaceContent.php` if Step 6 ran). Run the Arch suite, then the task's closing run.

```bash
vendor/bin/sail bin pint --dirty --format agent
git add app/Support/Database/TextSearch.php app/Support/Database/SqliteFunctions.php app/Providers/AppServiceProvider.php app/Mcp app/Support app/Http/Controllers/TeamEstimatesController.php app/Http/Controllers/Admin/AdminCandidatesController.php tests/Feature/Database/TextSearchTest.php tests/Feature/Admin tests/Arch docs/superpowers/research/database-portability-baseline.md
git commit -m "feat(search): one case-insensitive, literal search with the same result on every engine"
```

(Add `app/Actions/Search/SearchWorkspaceContent.php` if Step 6 ran.)

---

## Task 7: Lists read by people are sorted in PHP (decision D6)

Skip this task if the owner chose option (b) of D6; then only Step 4 is done, inside Task 5.

**Files:**
- Create: `app/Support/Alphabetical.php`, `tests/Unit/Support/AlphabeticalTest.php`, `tests/Feature/Database/AlphabeticalListsTest.php`
- Modify: the sites of the table in Step 3; `app/Actions/Retros/BuildSummaryInput.php:228`, `app/Actions/Games/TeamGameLeaderboard.php:49-52`; the two list files

**Interfaces:**
- Produces: `App\Support\Alphabetical::key(string $value): string`; `Alphabetical::sort(Collection $items, callable $by): Collection` (values re-indexed from 0; an Eloquent collection stays one).

- [ ] **Step 1: Write the failing unit test**

`tests/Unit/Support/AlphabeticalTest.php`:

```php
<?php

use App\Support\Alphabetical;

it('sorts names as a person would, whatever their case and accents', function () {
    $names = collect(['Zoe', 'adam', 'Émile', 'eve', 'Bob', 'Élodie']);

    expect(Alphabetical::sort($names, fn (string $name): string => $name)->all())
        ->toBe(['adam', 'Bob', 'Élodie', 'Émile', 'eve', 'Zoe']);
});

it('orders two names that fold alike by their raw form, so the order is stable', function () {
    $names = collect(['eve', 'Eve', 'ève']);

    expect(Alphabetical::sort($names, fn (string $name): string => $name)->all())
        ->toBe(Alphabetical::sort($names->reverse(), fn (string $name): string => $name)->all());
});

it('re-indexes the result', function () {
    expect(Alphabetical::sort(collect([5 => 'b', 9 => 'a']), fn (string $name): string => $name)->keys()->all())->toBe([0, 1]);
});
```

Run: `bin/test-db sqlite -- tests/Unit/Support/AlphabeticalTest.php`. Expected: FAIL, class not found.

- [ ] **Step 2: Write `Alphabetical`**

```php
<?php

namespace App\Support;

use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Alphabetical order decided in PHP: SQL order differs between engines and collations.
 */
class Alphabetical
{
    public static function key(string $value): string
    {
        return Str::lower(Str::ascii($value));
    }

    /**
     * @template TKey of array-key
     * @template TValue
     *
     * @param  Collection<TKey, TValue>  $items
     * @param  callable(TValue): string  $by
     * @return Collection<int, TValue>
     */
    public static function sort(Collection $items, callable $by): Collection
    {
        return $items
            ->sort(function (mixed $first, mixed $second) use ($by): int {
                $firstValue = $by($first);
                $secondValue = $by($second);

                return [self::key($firstValue), $firstValue] <=> [self::key($secondValue), $secondValue];
            })
            ->values();
    }
}
```

Run the unit test. Expected: PASS, 3 tests.

- [ ] **Step 3: Write the failing feature test, then change the sites**

`tests/Feature/Database/AlphabeticalListsTest.php`:

```php
<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use Inertia\Testing\AssertableInertia;

it('lists the members of a team alphabetically on every engine', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);

    foreach (['Zoe', 'adam', 'Émile'] as $name) {
        $member = User::factory()->create(['name' => $name]);
        $team->workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($member);
    }

    $this->actingAs($admin)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('members.0.name', 'adam')->where('members.1.name', 'Émile')->where('members.2.name', 'Zoe'));
});

it('lists the templates of a workspace alphabetically on every engine', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);

    foreach (['Zoom out', 'agenda', 'Équipe'] as $name) {
        WorkspaceTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => $name]);
    }

    $this->actingAs($admin)
        ->get(route('workspaces.templates.index', $team->workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('templates.0.name', 'agenda')->where('templates.1.name', 'Équipe')->where('templates.2.name', 'Zoom out'));
});
```

Read the route names from `routes/web.php` (`teams.show` may be named otherwise) and the prop names from the controllers (`members` in `TeamsController::show`, `templates` in `WorkspaceTemplatesController::index`).

Run: `bin/test-db sqlite -- tests/Feature/Database/AlphabeticalListsTest.php`
Expected: FAIL on SQLite and MariaDB (capitals first, `É` last); it may pass on PostgreSQL, whose locale sorts linguistically.

Now the sites. List them: `grep -rnE "orderBy\('(\w+\.)?(name|title)'\)|sortBy\('name'\)" app` (33 lines on `plan-18e-screens` at `4568a764`; a merged lane may add some). For each line, read the query to its end and apply the rule of its kind:

| Kind | How to recognise it | Change |
|---|---|---|
| A whole list | the query ends with `->get()` (or `->get([...])`), with no `limit`, `take`, `paginate`, `first`, `cursor` | remove `->orderBy('name')`; wrap the result: `Alphabetical::sort(<query>->get(), fn (Model $row): string => $row->name)`; then the existing `->map(...)` |
| An eager-load constraint for a whole relation | `->load(['members' => fn ($query) => $query->orderBy('name')])` or `with([...])`, no limit | keep the closure without the order, and re-set the relation sorted: `$teams->each(fn (Team $team) => $team->setRelation('members', Alphabetical::sort($team->members, fn (User $member): string => $member->name)))` |
| A collection already in memory | `->sortBy('name')` | `Alphabetical::sort($collection, fn ($row): string => $row->name)` |
| A limited, paginated or single read | `limit`, `take`, `paginate`, `first()` follows | keep the SQL order and make sure a tie-breaker follows it (`->orderBy('id')`); if the whole page is then shown as a list, also sort the page with `Alphabetical::sort`. The choice of which rows make the page follows the engine: accepted (spec §9). |
| A second sort key | `->orderBy('position')->orderBy('name')` or a name used only to break ties of another order | leave it |

Three worked examples, one per kind:

`TeamsController.php:81`

```php
            'members' => Alphabetical::sort($team->members()->get(), fn (User $member): string => $member->name)
                ->map(fn (User $member): array => [...$member->only(['id', 'name', 'email']), 'avatarUrl' => $member->avatarUrl()]),
```

`WorkspaceActionItemsController.php:51`

```php
        $teams = $workspace->teamsVisibleTo($user)->load('members');
        $teams->each(fn (Team $team) => $team->setRelation('members', Alphabetical::sort($team->members, fn (User $member): string => $member->name)));
```

`WorkspacesController.php:40` (first five members of each team: a limited read)

```php
            ->load(['members' => fn ($members) => $members->orderBy('users.name')->orderBy('users.id')->limit(5)]);
```

`Workspace::teamsVisibleTo()` (`app/Models/Workspace.php:90`) feeds several of the other sites; change it once:

```php
        $teams = $this->teams();

        if (! $user->canManage($this)) {
            $teams->whereHas('members', fn (Builder $query) => $query->whereKey($user->id));
        }

        return Alphabetical::sort($teams->get(), fn (Team $team): string => $team->name);
```

and then `CurrentTeamResolver.php:57`, `CurrentWorkspaceController.php:21` and `WorkspaceActionItemsController.php:68` no longer need their `->sortBy('name')`: read each and remove it if it sorts what `teamsVisibleTo()` returned.

The lines at 4568a764, to be re-read one by one: `Mcp/Tools/Retro/ListTeamMembers.php:43`, `ListTeams.php:59-60`, `Models/Workspace.php:90`, `Support/CurrentTeamResolver.php:57`, `Http/Middleware/HandleInertiaRequests.php:140`, `TeamsController.php:81,84,133,174`, `WorkspaceTemplatesController.php:30,102,126`, `WorkspaceMembersController.php:27`, `CurrentWorkspaceController.php:15,21`, `PokerDecksController.php:89`, `InvitationLinksController.php:79`, `WorkspaceActionItemsController.php:51,68`, `WorkspacesController.php:40`, `Poker/PokerSavedDecksController.php:22`, `Settings/ApiTokensController.php:142`, `Admin/AdminCandidatesController.php:24`, `Admin/AdminsController.php:21`, `Actions/Poker/BuildPokerSnapshot.php:180`, `Actions/Integrations/PresentIntegrationUserMappings.php:30`, `Actions/Retros/BuildBoardSnapshot.php:205,280`, `Actions/Retros/BuildTemplateCatalogue.php:24`, `Actions/Whiteboards/BuildWhiteboardSnapshot.php:130`, `BuildWhiteboardGallery.php:44`, `Actions/Games/TeamGameLeaderboard.php:52`.

Write in the task report one line per site: file, line, kind, what was done. A site that fits no kind is reported and left.

- [ ] **Step 4: The two raw `lower()` sorts**

`BuildSummaryInput.php:228`: `'textAnswers' => fn ($query) => $query->orderBy('id'),` and, where the answers are read a few lines below:

```php
                    return [...$entry, 'answers' => Alphabetical::sort($survey->textAnswers, fn (SurveyTextAnswer $answer): string => $answer->content)
                        ->take(self::MaxTextAnswersPerSurvey)
                        ->map(fn (SurveyTextAnswer $answer) => $answer->content)
                        ->values()->all()];
```

`TeamGameLeaderboard.php`: replace the two lines `->orderByRaw('lower(users.name)')` and `->orderBy('users.name')` with `->orderBy('users.name')->orderBy('game_points.user_id')` (a limited read: SQL decides who is in the top, with a tie-breaker), and sort the ties of the result in PHP. The final `->map(...)` chain becomes:

```php
        return $rows
            ->sort(fn (object $first, object $second): int => [(int) $second->total_points, (int) $second->wins, Alphabetical::key((string) $first->name), (string) $first->name]
                <=> [(int) $first->total_points, (int) $first->wins, Alphabetical::key((string) $second->name), (string) $second->name])
            ->map(fn (object $row): array => [
```

(the rest of the map is unchanged). `game_points.user_id` is in the `group by`, so it may be ordered by.

- [ ] **Step 5: Run**

Run: `bin/test-db sqlite -- tests/Feature/Database/AlphabeticalListsTest.php tests/Unit/Support/AlphabeticalTest.php`, then `mariadb`, then `pgsql`.
Expected: PASS on the three. Then `bin/test-db pgsql -- tests/Feature/Teams tests/Feature/Workspaces tests/Feature/Poker tests/Feature/Games tests/Feature/Retros tests/Feature/Mcp tests/Feature/Settings tests/Feature/Admin`: a test that asserted the order PostgreSQL gave for names that differ by case or accent is updated to the alphabetical order, in this commit, and named in the report.

- [ ] **Step 6: Lower the lists, closing run, commit**

Allowed list: `BuildSummaryInput.php|raw sql` goes down by one, `TeamGameLeaderboard.php|raw sql` by one. Arch suite, closing run.

```bash
vendor/bin/sail bin pint --dirty --format agent
git add app tests/Unit/Support/AlphabeticalTest.php tests/Feature/Database/AlphabeticalListsTest.php tests/Feature tests/Arch docs/superpowers/research/database-portability-baseline.md
git commit -m "feat(lists): names are sorted alphabetically in PHP, the same on every engine"
```

(`git add app` is allowed here only because this task's edits are spread over about thirty files of `app/`; run `git status` first and check that nothing else is modified.)

---

## Task 8: Rules the database cannot hold everywhere live in the model; dates are stored as dates

**Files:**
- Create: `app/Exceptions/ModelInvariantViolation.php`, `app/Casts/DateOnly.php`, `tests/Unit/Casts/DateOnlyTest.php`, `tests/Feature/Database/ModelInvariantsTest.php`, `tests/Feature/Database/DateOnlyStorageTest.php`
- Modify: `app/Models/ActionItem.php`, `app/Models/ActionItemReminder.php`, `app/Models/TeamHealthStatement.php`, `app/Models/SavedPokerDeck.php`, `tests/Feature/ActionItems/ActionItemModelTest.php:108-126`, `tests/Feature/Retros/HealthStatementModelsTest.php:60-62`, `tests/Feature/Poker/WorkspacePokerDecksTest.php:260-275`, the baseline list

**Interfaces:**
- Consumes: `CheckConstraint::isEnforced()` (Task 3), through the tests of Task 3 only.
- Produces: `App\Exceptions\ModelInvariantViolation::because(Model $model, string $rule): self`; `App\Casts\DateOnly` (reads `Illuminate\Support\Carbon` at midnight, writes `Y-m-d`).

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Database/ModelInvariantsTest.php`:

```php
<?php

use App\Enums\HealthStatement;
use App\Exceptions\ModelInvariantViolation;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use App\Models\User;

it('refuses a member and a guest assignee at once', function () {
    $guest = Participant::factory()->guest()->create();

    expect(fn () => ActionItem::factory()->create([
        'retro_id' => $guest->retro_id,
        'assignee_participant_id' => $guest->id,
        'assignee_user_id' => User::factory()->create()->id,
    ]))->toThrow(ModelInvariantViolation::class);
});

it('refuses a guest assignee on an item without a retro', function () {
    $guest = Participant::factory()->guest()->create();
    $team = $guest->retro->team;

    expect(fn () => ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['assignee_participant_id' => $guest->id]))
        ->toThrow(ModelInvariantViolation::class);
});

it('refuses a recurrence without a due date', function () {
    expect(fn () => ActionItem::factory()->create(['recurrence' => 'weekly', 'due_on' => null]))
        ->toThrow(ModelInvariantViolation::class);
});

it('refuses a recurrence that loses its due date on update', function () {
    $item = ActionItem::factory()->create(['recurrence' => 'weekly', 'due_on' => '2026-10-10']);

    expect(fn () => $item->update(['due_on' => null]))->toThrow(ModelInvariantViolation::class)
        ->and($item->fresh()->due_on?->toDateString())->toBe('2026-10-10');
});

it('refuses a built-in team statement that also has a text, and a custom one without a label', function (array $attributes) {
    expect(fn () => TeamHealthStatement::factory()->create($attributes))->toThrow(ModelInvariantViolation::class);
})->with([
    'built-in with a text' => [['builtin' => HealthStatement::Vision, 'text' => 'Reworded', 'label' => 'Vision']],
    'custom without a label' => [['builtin' => null, 'text' => 'We ship weekly', 'label' => null]],
    'neither' => [['builtin' => null, 'text' => null, 'label' => null]],
]);

it('refuses a deck with both owners or none', function (bool $withTeam, bool $withWorkspace) {
    $team = Team::factory()->create();

    expect(fn () => SavedPokerDeck::factory()->create([
        'team_id' => $withTeam ? $team->id : null,
        'workspace_id' => $withWorkspace ? $team->workspace_id : null,
    ]))->toThrow(ModelInvariantViolation::class);
})->with([
    'both owners' => [true, true],
    'no owner' => [false, false],
]);

it('accepts the rows the rules allow', function () {
    $team = Team::factory()->create();

    expect(SavedPokerDeck::factory()->create(['team_id' => $team->id])->exists)->toBeTrue()
        ->and(SavedPokerDeck::factory()->forWorkspace($team->workspace)->create()->exists)->toBeTrue()
        ->and(TeamHealthStatement::factory()->create(['team_id' => $team->id, 'builtin' => HealthStatement::Vision, 'text' => null, 'label' => null])->exists)->toBeTrue()
        ->and(ActionItem::factory()->create(['recurrence' => 'weekly', 'due_on' => '2026-10-10'])->exists)->toBeTrue();
});
```

`SavedPokerDeck`'s `team_id` and `workspace_id` are not fillable; the factory sets them through its state, which is why the test goes through the factory. If `SavedPokerDeck::factory()->create(['workspace_id' => …])` ignores the attribute, build the row with `SavedPokerDeck::factory()->make()->forceFill([...])->save()` inside the closure.

`tests/Unit/Casts/DateOnlyTest.php`:

```php
<?php

use App\Casts\DateOnly;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

function dateOnlyModel(): Model
{
    return new class extends Model {};
}

it('writes ten characters whatever it is given', function (mixed $value, ?string $stored) {
    expect((new DateOnly)->set(dateOnlyModel(), 'due_on', $value, []))->toBe($stored);
})->with([
    'a date string' => ['2026-10-10', '2026-10-10'],
    'a date and time string' => ['2026-10-10 15:30:00', '2026-10-10'],
    'a carbon instance' => [fn () => Carbon::parse('2026-10-10 23:59:59'), '2026-10-10'],
    'null' => [null, null],
    'an empty string' => ['', null],
]);

it('reads midnight of the stored day, from the short and from the long form', function (string $stored) {
    $read = (new DateOnly)->get(dateOnlyModel(), 'due_on', $stored, []);

    expect($read)->toBeInstanceOf(Carbon::class)
        ->and($read->toDateTimeString())->toBe('2026-10-10 00:00:00');
})->with(['2026-10-10', '2026-10-10 00:00:00']);

it('reads null as null', function () {
    expect((new DateOnly)->get(dateOnlyModel(), 'due_on', null, []))->toBeNull();
});
```

`tests/Feature/Database/DateOnlyStorageTest.php`:

```php
<?php

use App\Models\ActionItem;
use Illuminate\Support\Facades\DB;

it('stores a due date as a date, not as a date and a time', function () {
    $item = ActionItem::factory()->create(['due_on' => '2026-10-10']);

    expect(substr((string) DB::table('action_items')->where('id', $item->id)->value('due_on'), 0, 10))->toBe('2026-10-10')
        ->and(strlen((string) DB::table('action_items')->where('id', $item->id)->value('due_on')))->toBe(10);
});

it('finds an item by the day it is due, at both ends of a range', function () {
    $item = ActionItem::factory()->create(['due_on' => '2026-10-11']);

    expect(ActionItem::query()->whereBetween('due_on', ['2026-10-04', '2026-10-11'])->whereKey($item->id)->exists())->toBeTrue()
        ->and(ActionItem::query()->whereBetween('due_on', ['2026-10-11', '2026-10-12'])->whereKey($item->id)->exists())->toBeTrue()
        ->and(ActionItem::query()->where('due_on', '2026-10-11')->whereKey($item->id)->exists())->toBeTrue();
});

it('keeps serialising a due date the way it did', function () {
    $item = ActionItem::factory()->create(['due_on' => '2026-10-10']);

    expect($item->fresh()->toArray()['due_on'])->toStartWith('2026-10-10')
        ->and($item->fresh()->due_on->toDateString())->toBe('2026-10-10');
});
```

Run: `bin/test-db sqlite -- tests/Feature/Database/DateOnlyStorageTest.php tests/Feature/ActionItems/ReminderSelectionTest.php`
Expected: FAIL on SQLite: the stored value is 19 characters long and the upper end of the range is missed. On PostgreSQL these pass already. Before changing anything, run on `pgsql` and write down the exact value of `$item->fresh()->toArray()['due_on']` (add a temporary `dump`): the cast must give the same string afterwards.

Run: `bin/test-db pgsql -- tests/Feature/Database/ModelInvariantsTest.php tests/Unit/Casts/DateOnlyTest.php`
Expected: FAIL, the two classes do not exist.

- [ ] **Step 2: Write the exception and the cast**

`app/Exceptions/ModelInvariantViolation.php`:

```php
<?php

namespace App\Exceptions;

use DomainException;
use Illuminate\Database\Eloquent\Model;

/**
 * A row would break a rule its table holds. Raised by the model on every engine,
 * before the database constraint of the engines that have one.
 */
class ModelInvariantViolation extends DomainException
{
    public static function because(Model $model, string $rule): self
    {
        return new self(class_basename($model).": {$rule}");
    }
}
```

`app/Casts/DateOnly.php`:

```php
<?php

namespace App\Casts;

use DateTimeInterface;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A calendar day. Eloquent's own date cast writes a date and a time, which an engine
 * without a date type keeps as written; this one writes the day alone.
 *
 * @implements CastsAttributes<Carbon, DateTimeInterface|string>
 */
class DateOnly implements CastsAttributes
{
    private const string Format = 'Y-m-d';

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): ?Carbon
    {
        if ($value === null) {
            return null;
        }

        return Carbon::createFromFormat('!'.self::Format, substr((string) $value, 0, 10));
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return Carbon::parse($value)->format(self::Format);
    }
}
```

In `ActionItem::casts()` and `ActionItemReminder::casts()`: `'due_on' => DateOnly::class,`.

Run the unit test and `DateOnlyStorageTest` on `sqlite` and on `pgsql`. Expected: PASS. If `toArray()['due_on']` is not the string written down in Step 1, make the cast also implement `Illuminate\Contracts\Database\Eloquent\SerializesCastableAttributes`, whose `serialize(Model $model, string $key, mixed $value, array $attributes)` returns `Carbon::instance($value)->startOfDay()->toJSON()` (the form Eloquent's date cast gave), and tighten the third storage test to the exact string.

- [ ] **Step 3: Guard the three models**

`app/Models/ActionItem.php`:

```php
    protected static function booted(): void
    {
        static::saving(function (ActionItem $item): void {
            if ($item->assignee_user_id !== null && $item->assignee_participant_id !== null) {
                throw ModelInvariantViolation::because($item, 'an item is assigned to a member or to a guest, never both');
            }

            if ($item->retro_id === null && $item->assignee_participant_id !== null) {
                throw ModelInvariantViolation::because($item, 'a guest assignee needs a retro');
            }

            if ($item->recurrence !== null && $item->due_on === null) {
                throw ModelInvariantViolation::because($item, 'a recurrence needs a due date');
            }
        });
    }
```

If the model already has a `booted()` method, add the listener to it.

`app/Models/TeamHealthStatement.php`:

```php
    protected static function booted(): void
    {
        static::saving(function (TeamHealthStatement $statement): void {
            $isBuiltin = $statement->builtin !== null && $statement->text === null && $statement->label === null;
            $isCustom = $statement->builtin === null && $statement->text !== null && $statement->label !== null;

            if (! $isBuiltin && ! $isCustom) {
                throw ModelInvariantViolation::because($statement, 'a statement is built-in without text and label, or custom with both');
            }
        });
    }
```

`app/Models/SavedPokerDeck.php`:

```php
    protected static function booted(): void
    {
        static::saving(function (SavedPokerDeck $deck): void {
            if (($deck->team_id === null) === ($deck->workspace_id === null)) {
                throw ModelInvariantViolation::because($deck, 'a deck belongs to a team or to a workspace, never both or neither');
            }
        });
    }
```

Import `App\Exceptions\ModelInvariantViolation` in the three.

- [ ] **Step 4: Move the old tests to the model exception and drop their skips**

`tests/Feature/ActionItems/ActionItemModelTest.php`, the three tests at `:108-126`: each `expect(fn () => DB::transaction(fn () => …))->toThrow(QueryException::class)` becomes `expect(fn () => …)->toThrow(ModelInvariantViolation::class)` (no nested transaction: nothing reaches the database).

`tests/Feature/Retros/HealthStatementModelsTest.php:60-62`: `->throws(QueryException::class)->skip(fn () => DB::getDriverName() !== 'pgsql', '…')` becomes `->throws(ModelInvariantViolation::class)`.

`tests/Feature/Poker/WorkspacePokerDecksTest.php:260-275`: delete the three lines of the `if (DB::getDriverName() !== 'pgsql')` block, rename the test `it('refuses a deck with both owners or none', …)` and expect `ModelInvariantViolation::class`.

Remove imports that become unused. The database-level refusal of each rule is already tested by `CheckConstraintsTest` (Task 3), which writes through the query builder.

- [ ] **Step 5: Run on three engines**

Run: `bin/test-db pgsql -- tests/Feature/Database tests/Unit/Casts tests/Feature/ActionItems tests/Feature/Retros/HealthStatementModelsTest.php tests/Feature/Poker`, then `sqlite`, then `mariadb`.
Expected: PASS on the three for `ModelInvariantsTest` (11 tests), `DateOnlyTest`, `DateOnlyStorageTest`, the reminder tests and the three edited files. A feature test that now fails on PostgreSQL with `ModelInvariantViolation` is a code path that saved a row the constraint would have refused anyway: read it; if it is a factory building an invalid row, fix the factory; otherwise stop.

- [ ] **Step 6: Lower the baseline, closing run, commit**

Baseline: delete the `driver branch` lines of `HealthStatementModelsTest.php` and `WorkspacePokerDecksTest.php`.

```bash
vendor/bin/sail bin pint --dirty --format agent
git add app/Exceptions/ModelInvariantViolation.php app/Casts/DateOnly.php app/Models/ActionItem.php app/Models/ActionItemReminder.php app/Models/TeamHealthStatement.php app/Models/SavedPokerDeck.php tests/Unit/Casts/DateOnlyTest.php tests/Feature/Database/ModelInvariantsTest.php tests/Feature/Database/DateOnlyStorageTest.php tests/Feature/ActionItems/ActionItemModelTest.php tests/Feature/Retros/HealthStatementModelsTest.php tests/Feature/Poker/WorkspacePokerDecksTest.php tests/Arch/database-portability-baseline.txt docs/superpowers/research/database-portability-baseline.md
git commit -m "feat(models): five rules are enforced by the model on every engine, and a due date is stored as a day"
```

---

## Task 9: Collation, cache locks, and addresses (waits for plan-18f-auth)

Steps 1 to 3 need nothing from 18f and may be done as soon as Task 3 is merged. Steps 4 to 9 need `plan-18f-auth` merged into the plan's branch (see **Branches**).

**Files:**
- Create: `tests/Feature/Database/CollationTest.php`, `tests/Feature/Database/CacheLockConnectionTest.php`, `tests/Feature/Database/EmailKeyTest.php`, `database/migrations/2026_10_19_100200_add_email_key_to_users_table.php`, `database/migrations/2026_10_19_100300_normalise_workspace_invitation_emails.php`
- Modify [18f]: `app/Models/User.php` (`email()`, `scopeWhereAddress()`), `app/Models/WorkspaceInvitation.php`, `app/Actions/Workspaces/CreateWorkspaceInvitation.php:21-25`, `database/migrations/2026_10_14_100000_create_magic_links_table.php:15`, `database/migrations/2026_10_15_100001_create_email_two_factor_codes_table.php:17-18`, `app/Actions/Search/SearchWorkspaceContent.php` (if Task 6 Step 6 did not run), the two list files

**Interfaces:**
- Consumes [18f]: `App\Support\Auth\LoginAddress::normalise(string): string`, `User::scopeWhereAddress(Builder, string): void`.
- Produces: column `users.email_key` (string, not null, index `users_email_key_index`); `User::whereAddress()` compares `email_key`; `WorkspaceInvitation::email` is stored normalised.

- [ ] **Step 1: Write the collation tests**

`tests/Feature/Database/CollationTest.php`:

```php
<?php

use App\Models\Card;
use App\Models\CardReaction;
use App\Models\Participant;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use Illuminate\Support\Facades\DB;

it('keeps two different emoji of one participant on one card, and removes only the one asked', function () {
    $card = Card::factory()->create();
    $participant = Participant::factory()->create(['retro_id' => $card->retro_id]);
    $reaction = fn (string $emoji): array => ['retro_id' => $card->retro_id, 'card_id' => $card->id, 'participant_id' => $participant->id, 'emoji' => $emoji];

    CardReaction::factory()->create($reaction('👍'));
    CardReaction::factory()->create($reaction('🎉'));

    expect(CardReaction::query()->where('card_id', $card->id)->where('emoji', '👍')->count())->toBe(1);

    CardReaction::query()->where('card_id', $card->id)->where('participant_id', $participant->id)->where('emoji', '👍')->delete();

    expect(CardReaction::query()->where('card_id', $card->id)->pluck('emoji')->all())->toBe(['🎉']);
});

it('finds the reaction that exists rather than taking another emoji for it', function () {
    $card = Card::factory()->create();
    $participant = Participant::factory()->create(['retro_id' => $card->retro_id]);
    CardReaction::factory()->create(['retro_id' => $card->retro_id, 'card_id' => $card->id, 'participant_id' => $participant->id, 'emoji' => '👍']);

    $card->reactions()->firstOrCreate(['participant_id' => $participant->id, 'emoji' => '🎉'], ['retro_id' => $card->retro_id]);

    expect($card->reactions()->count())->toBe(2);
});

it('tells apart two token names that differ by case', function () {
    $user = User::factory()->create();
    $user->createToken('Ada');
    $user->createToken('ada');

    expect($user->tokens()->where('name', 'ada')->count())->toBe(1)
        ->and($user->tokens()->count())->toBe(2);
});

it('tells apart words that differ by an accent, by case, or by a trailing space, in a key', function () {
    $team = Team::factory()->create();

    foreach (['peche', 'pêche', 'péché', 'Peche', 'a', 'a '] as $word) {
        DB::table('game_used_words')->insert(['team_id' => $team->id, 'locale' => 'fr', 'word' => $word, 'created_at' => now()]);
    }

    expect(DB::table('game_used_words')->where('team_id', $team->id)->count())->toBe(6)
        ->and(DB::table('game_used_words')->where('team_id', $team->id)->where('word', 'peche')->count())->toBe(1)
        ->and(DB::table('game_used_words')->where('team_id', $team->id)->where('word', 'a')->count())->toBe(1);
});

it('tells apart two whiteboard element ids that differ by case', function () {
    $board = Whiteboard::factory()->create();

    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'AbC123']);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'abc123']);

    expect(DB::table('whiteboard_elements')->where('whiteboard_id', $board->id)->count())->toBe(2)
        ->and(DB::table('whiteboard_elements')->where('whiteboard_id', $board->id)->where('element_id', 'abc123')->count())->toBe(1);
});
```

Add `use App\Models\WhiteboardElement;` to the imports. If the element factory names the client id otherwise, read `database/factories/WhiteboardElementFactory.php` and use its key.

Run: `bin/test-db pgsql -- tests/Feature/Database/CollationTest.php`, then `sqlite`, `mariadb`, `mysql`.
Expected: PASS on the four. These tests are the proof that the collations of Task 1 do what the spec says; they have no red step of their own on these engines. To see them red once, run on MariaDB with the old collation: `docker compose exec -T -u sail -e DB_CONNECTION=mariadb -e DB_HOST=mariadb -e DB_DATABASE=testing -e DB_USERNAME=sail -e DB_PASSWORD=password -e DB_COLLATION=utf8mb4_unicode_ci laravel.test php artisan test --compact tests/Feature/Database/CollationTest.php`. Expected: FAIL, the second emoji and `pêche` are refused as duplicates. Put the output in the task report. If the trailing-space case fails on MariaDB or MySQL with the collation of Task 1, the fallback `utf8mb4_bin` was used there: remove `'a '` from that test's list for now and write the limit in `docs/database.md` (Task 17).

- [ ] **Step 2: Write the cache lock test**

`tests/Feature/Database/CacheLockConnectionTest.php`:

```php
<?php

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

it('holds a cache lock outside the transaction of the caller', function () {
    $lock = Cache::store('database')->lock('portability-probe', 30);

    DB::beginTransaction();
    $taken = $lock->get();
    DB::rollBack();

    $stillHeld = ! Cache::store('database')->lock('portability-probe', 30)->get();
    $lock->release();

    expect($taken)->toBeTrue()
        ->and($stillHeld)->toBeTrue();
})->skip(fn () => config('cache.stores.database.lock_connection') === null, 'This engine has one writer: the lock lives on the connection of the caller, by design.');
```

Run on `pgsql`, `mariadb`, `mysql`: expected PASS. On `sqlite`: skipped. To see it red, run on MariaDB with `-e DB_CACHE_LOCK_CONNECTION=mariadb` (the lock then joins the caller's transaction and is rolled back with it): expected FAIL on `$stillHeld`.

- [ ] **Step 3: Commit the two test files**

```bash
git add tests/Feature/Database/CollationTest.php tests/Feature/Database/CacheLockConnectionTest.php
git commit -m "test(database): keys compare bytes and cache locks stay out of the caller's transaction, on every engine"
```

- [ ] **Step 4: [18f] Write the failing address tests**

`tests/Feature/Database/EmailKeyTest.php`:

```php
<?php

use App\Actions\Workspaces\CreateWorkspaceInvitation;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Rules\UniqueEmailAddress;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

function legacyTwin(User $user, string $storedAddress): User
{
    $twin = User::factory()->create();
    DB::table('users')->where('id', $twin->id)->update(['email' => $storedAddress, 'email_key' => $user->email_key]);

    return $twin->fresh();
}

it('stores the key of an address whenever the address is set', function () {
    $user = User::factory()->create(['email' => '  Ada@Example.TEST ']);

    expect($user->fresh()->email)->toBe('ada@example.test')
        ->and($user->fresh()->email_key)->toBe('ada@example.test');
});

it('has an index on the key', function () {
    expect(Schema::hasIndex('users', ['email_key']))->toBeTrue();
});

it('finds an account by its address in any case', function (string $typed) {
    $user = User::factory()->create(['email' => 'ada@example.test']);

    expect(User::query()->whereAddress($typed)->sole()->id)->toBe($user->id);
})->with(['ada@example.test', 'ADA@EXAMPLE.TEST', ' Ada@Example.test ']);

it('finds both accounts when a legacy row shares the address once normalised', function () {
    $user = User::factory()->create(['email' => 'ada@example.test']);
    legacyTwin($user, 'ADA@example.test');

    expect(User::query()->whereAddress('Ada@example.test')->count())->toBe(2);
});

it('refuses a new account on an address a legacy row uses', function () {
    $user = User::factory()->create(['email' => 'ada@example.test']);
    DB::table('users')->where('id', $user->id)->update(['email' => 'ADA@example.test']);

    $validator = Validator::make(['email' => 'ada@example.test'], ['email' => [new UniqueEmailAddress]]);

    expect($validator->fails())->toBeTrue();
});

it('stores an invitation address normalised and replaces a pending one whatever its case', function () {
    $workspace = Workspace::factory()->create();
    $invitation = WorkspaceInvitation::factory()->create(['workspace_id' => $workspace->id, 'email' => 'Bob@Example.TEST']);

    expect($invitation->fresh()->email)->toBe('bob@example.test');

    resolve(CreateWorkspaceInvitation::class)->handle($workspace, workspaceManager($workspace), 'BOB@example.test', WorkspaceRole::Member);

    expect($workspace->invitations()->whereNull('accepted_at')->count())->toBe(1);
});
```

Run: `bin/test-db pgsql -- tests/Feature/Database/EmailKeyTest.php`
Expected: FAIL, no `email_key` column.

- [ ] **Step 5: [18f] The two migrations**

`2026_10_19_100200_add_email_key_to_users_table.php`:

```php
<?php

use App\Support\Auth\LoginAddress;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The form an address is looked up by, stored so that every engine compares it the same way.
     * Not unique: accounts from before addresses were normalised may share a key.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('email_key')->nullable();
        });

        foreach (DB::table('users')->select(['id', 'email'])->orderBy('id')->lazyById(500) as $user) {
            DB::table('users')->where('id', $user->id)->update(['email_key' => LoginAddress::normalise((string) $user->email)]);
        }

        Schema::table('users', function (Blueprint $table): void {
            $table->string('email_key')->nullable(false)->change();
            $table->index('email_key');
        });
    }
};
```

`2026_10_19_100300_normalise_workspace_invitation_emails.php`:

```php
<?php

use App\Support\Auth\LoginAddress;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach (DB::table('workspace_invitations')->select(['id', 'email'])->orderBy('id')->lazyById(500) as $invitation) {
            $normalised = LoginAddress::normalise((string) $invitation->email);

            if ($normalised === $invitation->email) {
                continue;
            }

            DB::table('workspace_invitations')->where('id', $invitation->id)->update(['email' => $normalised]);
        }
    }
};
```

- [ ] **Step 6: [18f] The models and the action**

`app/Models/User.php`:

```php
    protected function email(): Attribute
    {
        return Attribute::make(
            set: function (string $email): array {
                $address = LoginAddress::normalise($email);

                return ['email' => $address, 'email_key' => $address];
            },
        );
    }

    /**
     * Compares the stored key, so rows from before addresses were normalised are found too,
     * and two of them sharing an address are both returned.
     *
     * @param  Builder<self>  $query
     */
    public function scopeWhereAddress(Builder $query, string $email): void
    {
        $query->where($query->qualifyColumn('email_key'), LoginAddress::normalise($email));
    }
```

Add `@property string $email_key` to the class docblock. `app/Models/WorkspaceInvitation.php` gets the same kind of mutator, without a key:

```php
    /**
     * @return Attribute<string, string>
     */
    protected function email(): Attribute
    {
        return Attribute::make(
            set: fn (string $email): string => LoginAddress::normalise($email),
        );
    }
```

`CreateWorkspaceInvitation.php`: `->whereRaw('lower(email) = ?', [LoginAddress::normalise($email)])` becomes `->where('email', LoginAddress::normalise($email))`.

Search for what bypasses the mutator: `grep -rn "'email' =>" app | grep -v "validated\|rules\|Rule::"` and `grep -rn "update(\[" app/Actions/Auth app/Http/Controllers/Settings`. A `User::query()->update(['email' => …])` or a `DB::table('users')` write must set `email_key` too; a model `->update()` or `->forceFill()` goes through the mutator and needs nothing.

- [ ] **Step 7: [18f] The three non-null timestamps and the search**

`2026_10_14_100000_create_magic_links_table.php`: `$table->timestamp('expires_at')->index();` becomes `$table->dateTime('expires_at')->index();`.
`2026_10_15_100001_create_email_two_factor_codes_table.php`: `$table->timestamp('sent_at');` and `$table->timestamp('expires_at')->index();` become `dateTime`.

If `SearchWorkspaceContent` still uses `ilike`, do Task 6 Step 6 now.

- [ ] **Step 8: [18f] Run, and pin what the vendor lookups do**

Run: `bin/test-db pgsql -- tests/Feature/Database/EmailKeyTest.php tests/Feature/Auth tests/Feature/Workspaces`, then `sqlite`, `mariadb`.
Expected: PASS on the three (`EmailKeyTest`: 8 tests; `EmailAddressNormalisationTest` of 18f included).

Then one characterisation test, added to `EmailKeyTest.php`. Run it on PostgreSQL first, read what it prints, and write the expectation to match; the point is that the three other engines then give the same answer.

```php
it('gives the password broker the same answer on every engine for a mixed-case address', function () {
    $user = User::factory()->create(['email' => 'ada@example.test']);

    $found = Password::broker()->getUser(['email' => 'ADA@Example.test']);

    expect($found?->getAuthIdentifier())->toBe(null);
});
```

If on PostgreSQL the broker finds the user (18f normalises before the broker), replace `null` with `$user->id`. Whatever PostgreSQL answers is the expectation; a different answer on another engine is a portability bug: stop and report it.

Run `bin/check-pg-upgrade`. Expected: PASS (both new migrations run on the old and on the fresh database; the fixture's `Ada@Example.test` invitation is stored `ada@example.test` afterwards, so the row counts are unchanged and the template names too).

- [ ] **Step 9: [18f] Lower the lists, closing run, commit**

Baseline: delete the `non-null timestamp` lines of the two 18f migrations. Allowed list: delete `User.php|raw sql` and `CreateWorkspaceInvitation.php|raw sql`; `WorkspaceInvitationsController.php` and `ResolveSsoUser.php` have no raw call left after 18f (they call `whereAddress`): delete their lines if they are still listed.

```bash
vendor/bin/sail bin pint --dirty --format agent
git add app/Models/User.php app/Models/WorkspaceInvitation.php app/Actions/Workspaces/CreateWorkspaceInvitation.php database/migrations tests/Feature/Database/EmailKeyTest.php tests/Arch docs/superpowers/research/database-portability-baseline.md
git commit -m "feat(auth): an address is looked up by a stored key, the same on every engine"
```

---

## Task 10: Tests stop asserting PostgreSQL

**Files:**
- Create: `tests/Support/SqlProbe.php`, `tests/Support/DatabaseFailure.php`, `tests/Support/UnreachableDatabase.php`, `tests/Support/MissingTables.php`, `tests/Feature/Database/SqlProbeTest.php`
- Modify: `tests/Feature/Games/IcebreakerRoomTest.php:194-209`, `tests/Feature/Integrations/ActionItemExportTest.php:259-275`, `tests/Feature/Admin/InstanceAdminsTest.php:158-176`, `tests/Feature/Games/GameAccessTest.php:179-200`, `tests/Feature/Integrations/WebhookRedeliveryTest.php:524-540`, `tests/Feature/Integrations/WebhookSharesTest.php:465`, `tests/Feature/Integrations/WebhookEventsTest.php:464`, `tests/Feature/ErrorPagesTest.php:28-47`, `tests/Feature/InstanceSettingsTest.php:172-186`, `tests/Feature/Branding/BrandInPageTest.php:182-195`, `tests/Feature/ActionItems/ActionItemModelTest.php:16`, every other test file the baseline lists under `reads sql text`; the two list files

**Interfaces:**
- Produces:
  - `Tests\Support\SqlProbe::lockingQueries(Closure $during): array<int, array{table: string, sql: string, level: int}>` (SQL lower-cased, identifier quoting removed)
  - `SqlProbe::lockedTables(Closure $during): array<int, string>`
  - `SqlProbe::reads(string $sql, string $table): bool`
  - `SqlProbe::rowLocksExist(): bool`
  - `Tests\Support\DatabaseFailure::provoke(): void`
  - `Tests\Support\UnreachableDatabase::config(): array<string, mixed>`
  - `Tests\Support\MissingTables::during(Closure $callback): mixed`

- [ ] **Step 1: Write the failing test of the probe**

`tests/Feature/Database/SqlProbeTest.php`:

```php
<?php

use App\Models\Team;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\Support\DatabaseFailure;
use Tests\Support\MissingTables;
use Tests\Support\SqlProbe;
use Tests\Support\UnreachableDatabase;

it('recognises a select from a table whatever the quoting', function (string $sql, bool $expected) {
    expect(SqlProbe::reads($sql, 'game_players'))->toBe($expected);
})->with([
    'postgres and sqlite' => ['select * from "game_players" where "game_room_id" = ?', true],
    'mysql and mariadb' => ['select * from `game_players` where `game_room_id` = ?', true],
    'sql server' => ['select * from [game_players] where [game_room_id] = ?', true],
    'another table' => ['select * from "game_players_archive" where "id" = ?', false],
    'an insert' => ['insert into "game_players" ("id") values (?)', false],
]);

it('reports the tables locked, in order, with the transaction level', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $levelOutside = DB::transactionLevel();

    $queries = SqlProbe::lockingQueries(fn () => DB::transaction(function () use ($team, $user): void {
        Team::query()->whereKey($team->id)->lockForUpdate()->first();
        User::query()->whereKey($user->id)->lockForUpdate()->first();
        User::query()->whereKey($user->id)->first();
    }));

    expect(array_column($queries, 'table'))->toBe(['teams', 'users'])
        ->and($queries[0]['level'])->toBe($levelOutside + 1)
        ->and($queries[0]['sql'])->toContain('from teams where');
})->skip(fn () => ! SqlProbe::rowLocksExist(), 'This engine has no row lock: its write transactions are serialised instead.');

it('stops recording when the closure returns', function () {
    $team = Team::factory()->create();
    SqlProbe::lockedTables(fn () => null);

    DB::transaction(fn () => Team::query()->whereKey($team->id)->lockForUpdate()->first());

    expect(SqlProbe::lockedTables(fn () => null))->toBe([]);
});

it('provokes a real error of the engine', function () {
    expect(fn () => DB::transaction(fn () => DatabaseFailure::provoke()))->toThrow(QueryException::class);
    expect(User::query()->count())->toBe(0);
});

it('describes a connection that cannot be opened', function () {
    config(['database.connections.unreachable' => UnreachableDatabase::config()]);

    expect(fn () => DB::connection('unreachable')->select('select 1'))->toThrow(PDOException::class);

    DB::purge('unreachable');
});

it('makes every table missing while a closure runs, and gives them back', function () {
    User::factory()->create();

    $failed = MissingTables::during(function (): bool {
        try {
            User::query()->count();
        } catch (QueryException) {
            return true;
        }

        return false;
    });

    expect($failed)->toBeTrue()
        ->and(User::query()->count())->toBe(1);
});
```

Run: `bin/test-db pgsql -- tests/Feature/Database/SqlProbeTest.php`. Expected: FAIL, classes not found.

- [ ] **Step 2: Write the four helpers**

`tests/Support/SqlProbe.php`:

```php
<?php

namespace Tests\Support;

use Closure;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;

/**
 * The one place where a test reads the text of a query. Quoting and lock syntax
 * differ per engine; tests ask this class instead of matching SQL themselves.
 */
class SqlProbe
{
    private const string LockClause = '/\bfor update\b|\bfor share\b|\block in share mode\b|with\s*\(\s*rowlock/i';

    /**
     * The locking reads made while $during runs: SQL lower-cased, identifier quoting removed.
     *
     * @return array<int, array{table: string, sql: string, level: int}>
     */
    public static function lockingQueries(Closure $during): array
    {
        $recorded = [];
        $active = true;

        DB::listen(function (QueryExecuted $query) use (&$recorded, &$active): void {
            if (! $active || preg_match(self::LockClause, $query->sql) !== 1) {
                return;
            }

            $sql = strtolower(self::unquoted($query->sql));
            preg_match('/\bfrom\s+(\w+)/', $sql, $matches);

            $recorded[] = ['table' => $matches[1] ?? '', 'sql' => $sql, 'level' => DB::transactionLevel()];
        });

        try {
            $during();
        } finally {
            $active = false;
        }

        return $recorded;
    }

    /**
     * @return array<int, string>
     */
    public static function lockedTables(Closure $during): array
    {
        return array_column(self::lockingQueries($during), 'table');
    }

    /**
     * Calls $callback each time a select reads the table while $during runs.
     */
    public static function onRead(string $table, Closure $callback, Closure $during): void
    {
        $active = true;

        DB::listen(function (QueryExecuted $query) use ($table, $callback, &$active): void {
            if ($active && self::reads($query->sql, $table)) {
                $callback();
            }
        });

        try {
            $during();
        } finally {
            $active = false;
        }
    }

    public static function reads(string $sql, string $table): bool
    {
        return preg_match('/^\s*select\b.*\bfrom\s+'.preg_quote($table, '/').'\b/is', self::unquoted($sql)) === 1;
    }

    /**
     * False on an engine whose grammar compiles no lock clause.
     */
    public static function rowLocksExist(): bool
    {
        return DB::table('users')->lockForUpdate()->toSql() !== DB::table('users')->toSql();
    }

    private static function unquoted(string $sql): string
    {
        return str_replace(['"', '`', '[', ']'], '', $sql);
    }
}
```

Each call registers its own listener, switched off when its closure returns; listeners die with the application at the end of the test.

`tests/Support/DatabaseFailure.php`:

```php
<?php

namespace Tests\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DatabaseFailure
{
    /**
     * A statement every engine refuses: a user without its required columns.
     * On PostgreSQL it also aborts the open transaction, which is what the callers test.
     */
    public static function provoke(): void
    {
        DB::table('users')->insert(['id' => (string) Str::uuid7()]);
    }
}
```

`tests/Support/UnreachableDatabase.php`:

```php
<?php

namespace Tests\Support;

class UnreachableDatabase
{
    /**
     * The default connection, pointed at a port nothing listens on, or, for an engine
     * that has no server, at a directory, which cannot be opened as a database.
     *
     * @return array<string, mixed>
     */
    public static function config(): array
    {
        $config = config('database.connections.'.config('database.default'));

        if ($config['driver'] === 'sqlite') {
            return [...$config, 'database' => storage_path('framework')];
        }

        return [...$config, 'url' => null, 'host' => '127.0.0.1', 'port' => 1];
    }
}
```

`tests/Support/MissingTables.php`:

```php
<?php

namespace Tests\Support;

use Closure;
use Illuminate\Support\Facades\DB;

class MissingTables
{
    /**
     * Runs the closure while no table can be found, without any DDL: the connection looks
     * for every table under a prefix that does not exist. The nested transaction is rolled
     * back afterwards, which also clears the aborted state PostgreSQL is left in.
     */
    public static function during(Closure $callback): mixed
    {
        $connection = DB::connection();
        $prefix = $connection->getTablePrefix();

        DB::beginTransaction();
        $connection->setTablePrefix('missing_');

        try {
            return $callback();
        } finally {
            $connection->setTablePrefix($prefix);
            DB::rollBack();
        }
    }
}
```

Run: `bin/test-db pgsql -- tests/Feature/Database/SqlProbeTest.php`, then `sqlite`, `mariadb`.
Expected: PASS on the three (10 tests, 11 after Step 4; 1 skipped on SQLite). If "describes a connection that cannot be opened" does not throw on SQLite (the driver opened something in the directory), use `storage_path('framework/no-such-directory/database.sqlite')` and expect `Illuminate\Database\SQLiteDatabaseDoesNotExistException|PDOException`: then also read how `ErrorPageResponder` recognises an unreachable database and make sure it recognises that exception; if it does not, stop and report (that is a real gap for SQLite operators).

- [ ] **Step 3: The three lock-order tests**

`IcebreakerRoomTest.php`, replace the listener and the assertion:

```php
it('locks the retro then the icebreaker room when the board timer changes', function () {
    Queue::fake();
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    activeGameRound($room);

    $lockedTables = SqlProbe::lockedTables(fn () => $this->actingAs($facilitator)->putJson(route('retros.timer.update', $retro), ['seconds' => 60])->assertOk());

    expect($lockedTables)->toBe(['retros', 'game_rooms']);
})->skip(fn () => ! SqlProbe::rowLocksExist(), 'This engine has no row lock: its write transactions are serialised instead.');
```

`ActionItemExportTest.php`:

```php
    $lockedTables = SqlProbe::lockedTables(fn () => $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))->assertCreated());

    expect($lockedTables)->toContain('action_items')->not->toContain('retros');
})->skip(fn () => ! SqlProbe::rowLocksExist(), 'This engine has no row lock: its write transactions are serialised instead.');
```

`InstanceAdminsTest.php`:

```php
it('locks the admin rows inside a transaction before it counts them', function () {
    $admin = User::factory()->instanceAdmin()->create();
    $other = User::factory()->instanceAdmin()->create();
    $levelOutside = DB::transactionLevel();
    $revoked = null;

    $lockingQueries = SqlProbe::lockingQueries(function () use ($other, &$revoked): void {
        $revoked = resolve(RevokeInstanceAdmin::class)->handle($other);
    });

    expect($revoked)->toBeTrue()
        ->and($lockingQueries)->toHaveCount(1)
        ->and($lockingQueries[0]['sql'])->toContain('is_instance_admin = ')
        ->and($lockingQueries[0]['level'])->toBe($levelOutside + 1)
        ->and(resolve(RevokeInstanceAdmin::class)->handle($admin))->toBeFalse()
        ->and($admin->fresh()->is_instance_admin)->toBeTrue();
})->skip(fn () => ! SqlProbe::rowLocksExist(), 'This engine has no row lock: its write transactions are serialised instead.');
```

The behaviour these three tests describe (which rows are protected) is proved on every engine, SQLite included, by the concurrency suite of Task 13; here they pin the order of row locks where row locks exist.

- [ ] **Step 4: The two tests that named a table in SQL**

Both listened to queries themselves and matched `"table"` in the text. They hand the listening to the probe, so no test file reads `->sql`.

`GameAccessTest.php`, "survives a concurrent first visit of the same member": the `DB::listen(...)` block and the request that follows it become

```php
    SqlProbe::onRead('game_players', function () use (&$raced, $room, $user): void {
        if ($raced) {
            return;
        }

        $raced = true;

        DB::table('game_players')->insert([
            'id' => (string) Str::uuid(),
            'game_room_id' => $room->id,
            'user_id' => $user->id,
            'created_at' => now(),
        ]);
    }, function () use ($room, $user): void {
        $this->actingAs($user)->get(route('games.show', $room))->assertOk();
    });
```

Keep inside the last closure the request and the response assertions the test has today, and after the call the assertions it makes on the database.

`WebhookRedeliveryTest.php`, "reads the stored message once per attempt":

```php
    $payloadReads = 0;

    SqlProbe::onRead('integration_delivery_payloads', function () use (&$payloadReads): void {
        $payloadReads++;
    }, fn () => runOutgoingWebhookJob(Queue::pushed(RedeliverWebhook::class)->sole())->assertNotFailed());

    expect($payloadReads)->toBe(1);
```

Add to `SqlProbeTest.php`:

```php
it('calls back once for each select that reads the table', function () {
    $reads = 0;

    SqlProbe::onRead('users', function () use (&$reads): void {
        $reads++;
    }, function (): void {
        User::query()->count();
        Team::query()->count();
    });

    expect($reads)->toBe(1);
});
```

- [ ] **Step 5: The two tests that used `select 1 / 0`**

`WebhookSharesTest.php:465` and `WebhookEventsTest.php:464`: `IntegrationDeliveryPayload::creating(fn () => DB::statement('select 1 / 0'));` becomes `IntegrationDeliveryPayload::creating(fn () => DatabaseFailure::provoke());`.

- [ ] **Step 6: The unreachable database**

`ErrorPagesTest.php`, in `withUnreachableDatabase()`:

```php
    config([
        'database.connections.unreachable' => UnreachableDatabase::config(),
        'database.default' => 'unreachable',
    ]);
```

- [ ] **Step 7: The two tests that dropped a table**

`InstanceSettingsTest.php`:

```php
it('answers with the defaults and caches nothing while the table is missing', function () {
    MissingTables::during(function (): void {
        $settings = freshInstanceSettings();

        expect($settings->displayName())->toBe('Configured Name')
            ->and($settings->brandColor())->toBeNull()
            ->and($settings->gifKey())->toBe('config-gif-key')
            ->and($settings->all()['gif_rating'])->toBe('pg')
            ->and(Cache::has(InstanceSettings::CacheKey))->toBeFalse();
    });
```

Keep whatever the test asserts after the old `DB::rollBack()` below the closing `});`.

`BrandInPageTest.php`:

```php
it('still renders the page while the settings table is missing', function () {
    $response = MissingTables::during(function () {
        app()->forgetScopedInstances();

        return $this->get(route('login'));
    });

    $response->assertOk()
```

All tables are missing during the closure, not only the settings table. The login page of a guest should read nothing else (sessions and cache are in memory in tests). If this test fails because the page reads another table, do not weaken it: stop and report the query. The plan could not decide that case by reading.

- [ ] **Step 8: The legacy backfill test**

`ActionItemModelTest.php`, the first test: add at its end

```php
})->skip(fn () => ! DB::connection()->getSchemaGrammar()->supportsSchemaTransactions(), 'Adds a column inside the test transaction, which this engine would commit. The backfill it tests ran on PostgreSQL installs only.');
```

Check the method name in `vendor/laravel/framework/src/Illuminate/Database/Schema/Grammars/Grammar.php` (`grep -n "function supportsSchemaTransactions" …`); it reads the grammar's `$transactions` property (true for PostgreSQL and SQLite). Move this file's `ddl in a test` line from the baseline to the allowed list.

- [ ] **Step 9: Every other reader of SQL text**

Open `tests/Arch/database-portability-baseline.txt` and take each remaining line whose rule is `reads sql text`, `lock syntax` or `ddl in a test`. For each file: if it counts queries, it does not need the text (use `DB::enableQueryLog()` and `count(DB::getQueryLog())`, as the 23 query-count tests do); if it looks for a table, use `SqlProbe::onRead`; if it looks for a lock, use `SqlProbe::lockingQueries`. Write one line per file in the task report.

- [ ] **Step 10: Run on three engines, lower the lists, closing run, commit**

Run: `bin/test-db pgsql -- tests/Feature/Database/SqlProbeTest.php tests/Feature/Games tests/Feature/Integrations tests/Feature/Admin tests/Feature/ErrorPagesTest.php tests/Feature/InstanceSettingsTest.php tests/Feature/Branding tests/Feature/ActionItems`, then `sqlite`, then `mariadb`.
Expected: PASS on the three, with the skips named above on SQLite (4) and on MariaDB (1, the legacy backfill).

Baseline: no line with a rule of the `tests` group is left, except what a later task owns. Arch suite, closing run.

```bash
vendor/bin/sail bin pint --dirty --format agent
git add tests/Support tests/Feature tests/Arch docs/superpowers/research/database-portability-baseline.md
git commit -m "test: tests ask a probe about locks and tables instead of reading SQL, and fail the database for real"
```

---

## Task 11: Triage of what only fails on another engine

This task has no fixed size. It starts when Tasks 4 to 8 and 10 are merged into the plan's branch (Task 9 too if 18f is merged). Its input is the baseline file; its output is a suite green on SQLite and MariaDB, or a list of what is left with the reason.

**Files:**
- Modify: whatever the triage finds, within the rules below; `docs/superpowers/research/database-portability-baseline.md`
- Create: nothing, unless a fix needs a test

**Interfaces:**
- Consumes: every helper of Tasks 3 to 10.
- Produces: `bin/test-db sqlite`, `bin/test-db mariadb` and `bin/test-db mysql` pass; a section "Triage" in the baseline file, one line per failure found, with its cause and its fix.

- [ ] **Step 1: Collect the failures**

```bash
bin/test-db pgsql
bin/test-db sqlite
bin/test-db mariadb
bin/test-db mysql
for driver in sqlite mariadb mysql; do
    sed -E $'s/\x1b\\[[0-9;]*m//g' "storage/logs/test-db/$driver.log" | grep -E '^\s+(FAILED|⨯)' | sort > "storage/logs/test-db/$driver.failures"
    wc -l "storage/logs/test-db/$driver.failures"
done
comm -12 storage/logs/test-db/sqlite.failures storage/logs/test-db/mariadb.failures | wc -l
```

Expected: PostgreSQL green. The three other counts are what this task brings to zero. Write the three counts and the count common to SQLite and MariaDB in the baseline file.

- [ ] **Step 2: Sort each failure by cause**

Take the failures one test file at a time, the file with the most failures first. Run it alone on the engine where it fails (`bin/test-db mariadb -- tests/Feature/<file>`), read the first failing assertion, and give it one cause of this table. Write the line in the baseline file before fixing.

| # | Cause | How it shows | Fix, in the application unless said |
|---|---|---|---|
| 1 | Result type | `"3"` is not `3`, `1` is not `true`, `"4.5000"` is not `4.5`: an aggregate or a boolean read through `toBase()`, `DB::table()`, `pluck()` on an aggregate, `value()` | cast where the value is read: `(int)`, `(float)`, `(bool)`. In a test that compares a raw value, compare the cast value. |
| 2 | Order | two rows come in another order; the query has no `orderBy`, or its last key has ties | add the tie-breaker `->orderBy('id')` to the query. If the order is by a name shown to people, `Alphabetical::sort` (Task 7). |
| 3 | NULL position | a row with a NULL sort value is first on one engine and last on another | `->orderByRaw(Sql::nullsLast('<column>'))` before the column, or filter the NULLs out if the list should not hold them |
| 4 | Collation | a test expected two strings that differ by case or accent to be equal, or sorted them | the binary comparison is the rule (spec P4): fix the test's expectation; if the feature really needs to ignore case, fold in PHP and compare a stored key (stop and ask before adding a key column) |
| 5 | Date or time format | `2026-10-10` is not `2026-10-10 00:00:00`; a time has or lacks fractions; a comparison of two times fails by under a second | a date-only column: cast `DateOnly`. A time: compare Carbon values, or truncate with `startOfSecond()` where the value is created (the code already does at 8 sites) |
| 6 | A test that asserts an engine | SQL text, an error message of one engine, a `QueryException` where the model now refuses first, a JSON column compared as a string | the helpers of Task 10; `ModelInvariantViolation` (Task 8); for JSON, compare decoded arrays |
| 7 | JSON path lookup | a `where('settings->key', $value)` finds nothing on SQLite | the stored JSON value and the binding must have the same type: store a string and bind a string (as `chatId` and `installationId` do) |
| 8 | Length or strictness | PostgreSQL or MariaDB refuses a value SQLite accepted (too long, wrong type, a missing NOT NULL column in a raw insert of a test) | the value is wrong: fix the test data or add the validation the code lacks |

A failure that fits none of the eight: stop working on it, write in the baseline file its test name, the SQL (`DB::enableQueryLog()` around the call), and the result on PostgreSQL and on the failing engine. Go on with the next failure. At the end of the task these are the "unexplained" list; if there is one, the task ends `DONE_WITH_CONCERNS` and the owner is asked.

- [ ] **Step 3: Fix, cause by cause**

For each cause with more than one occurrence, fix one occurrence, run its file on the three engines, then apply the same fix to the others. After each file: `bin/test-db pgsql -- <file>`, `bin/test-db sqlite -- <file>`, `bin/test-db mariadb -- <file>`. A fix must never make PostgreSQL fail and must never add a driver test (`getDriverName`), a skip by driver, or a per-engine expectation. A skip is allowed only through one of the three capabilities (`CheckConstraint::isEnforced()`, `SqlProbe::rowLocksExist()`, `supportsSchemaTransactions()`) and each new skip is listed with its reason.

Commit per cause, not per file:

```bash
git add <the files of that cause>
git commit -m "fix(database): <cause>, found by running the suite on SQLite and MariaDB"
```

- [ ] **Step 4: MySQL**

Run `bin/test-db mysql`. Expected: the same result as MariaDB. A failure on MySQL only is sorted with the same table; the likely ones are a keyword used as an alias or a column name, and JSON values that MySQL returns with reordered keys (cause 6).

- [ ] **Step 5: Count the skips**

```bash
for driver in pgsql sqlite mariadb mysql; do
    sed -E $'s/\x1b\\[[0-9;]*m//g' "storage/logs/test-db/$driver.log" | grep -E 'Tests:' | tail -1
done
```

Expected: the same number of tests on the four engines; the numbers of skipped tests differ only by the capability skips (SQLite: 6 check constraints, 4 lock-order tests, the cache lock test; MariaDB and MySQL: the legacy backfill test). Write the four lines and the list of skips per engine in the baseline file. Any other skip is a finding.

- [ ] **Step 6: The closing run and the last commit of the task**

`bin/test-db pgsql`, `sqlite`, `mariadb`, `mysql`: all green.

```bash
git add docs/superpowers/research/database-portability-baseline.md
git commit -m "docs(database): the suite passes on four engines; triage record"
```

---

## Task 12: A busy database is answered "try again", and safe transactions are retried

**Files:**
- Create: `app/Support/Database/Transactions.php`, `tests/Feature/Database/ConcurrencyErrorResponseTest.php`, `tests/Feature/Database/RetriedTransactionsTest.php`
- Modify: `bootstrap/app.php` (`withExceptions`), `lang/fr.json`, `lang/es.json`, `lang/de.json`, `lang/en.json`, and the call sites of Step 5

**Interfaces:**
- Produces: `App\Support\Database\Transactions::Attempts` (int, 3); `Transactions::isConcurrencyError(Throwable $e): bool`; `Transactions::busyMessage(): string`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Database/ConcurrencyErrorResponseTest.php`:

```php
<?php

use Illuminate\Database\DeadlockException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Route;

function failingRoute(Throwable $exception): string
{
    Route::middleware('web')->post('/portability-probe/busy', fn () => throw $exception);

    return '/portability-probe/busy';
}

it('answers 503 with a retry delay when the database is busy or deadlocked', function (string $message) {
    $uri = failingRoute(new QueryException('testing', 'update retros set votes_version = ?', [1], new PDOException($message)));

    $this->postJson($uri)
        ->assertServiceUnavailable()
        ->assertHeader('Retry-After', '1')
        ->assertJsonPath('message', 'The database is busy. Try again.');
})->with([
    'mysql and mariadb deadlock' => 'SQLSTATE[40001]: Serialization failure: 1213 Deadlock found when trying to get lock; try restarting transaction',
    'mysql and mariadb lock wait' => 'SQLSTATE[HY000]: General error: 1205 Lock wait timeout exceeded; try restarting transaction',
    'postgresql deadlock' => 'SQLSTATE[40P01]: Deadlock detected: 7 ERROR:  deadlock detected',
    'sqlite busy' => 'SQLSTATE[HY000]: General error: 5 database is locked',
]);

it('answers 503 when a deadlock is rethrown from a nested transaction', function () {
    $this->postJson(failingRoute(new DeadlockException('Deadlock found when trying to get lock')))
        ->assertServiceUnavailable()
        ->assertHeader('Retry-After', '1');
});

it('still answers 500 for any other database error', function () {
    $uri = failingRoute(new QueryException('testing', 'select * from nowhere', [], new PDOException('SQLSTATE[42P01]: Undefined table')));

    $this->postJson($uri)->assertInternalServerError();
});

it('answers the busy page to a browser', function () {
    $uri = failingRoute(new QueryException('testing', 'update x', [], new PDOException('database is locked')));

    $this->post($uri)->assertServiceUnavailable()->assertHeader('Retry-After', '1');
});
```

Run: `bin/test-db pgsql -- tests/Feature/Database/ConcurrencyErrorResponseTest.php`
Expected: FAIL, six of the seven cases answer 500 (only "still answers 500 for any other database error" passes).

- [ ] **Step 2: Write `Transactions`**

```php
<?php

namespace App\Support\Database;

use Illuminate\Database\ConcurrencyErrorDetector;
use Throwable;

class Transactions
{
    /**
     * For `DB::transaction($callback, Transactions::Attempts)`, only where the callback touches
     * nothing but the database: a retried callback runs again from its first line.
     */
    public const int Attempts = 3;

    /**
     * A deadlock, a lock wait that timed out, or a busy SQLite file: the request did nothing wrong
     * and would succeed if repeated.
     */
    public static function isConcurrencyError(Throwable $exception): bool
    {
        return (new ConcurrencyErrorDetector)->causedByConcurrencyError($exception);
    }

    public static function busyMessage(): string
    {
        return __('The database is busy. Try again.');
    }
}
```

- [ ] **Step 3: Answer 503**

In `bootstrap/app.php`, inside `withExceptions`, before the `respond` call:

```php
        $busy = fn (Throwable $exception, Request $request): ?Response => Transactions::isConcurrencyError($exception)
            ? resolve(ExceptionHandler::class)->render($request, new ServiceUnavailableHttpException(1, Transactions::busyMessage(), $exception))
            : null;

        $exceptions->render(fn (QueryException $exception, Request $request): ?Response => $busy($exception, $request));
        $exceptions->render(fn (DeadlockException $exception, Request $request): ?Response => $busy($exception, $request));
```

with the imports `App\Support\Database\Transactions`, `Illuminate\Contracts\Debug\ExceptionHandler`, `Illuminate\Database\DeadlockException`, `Illuminate\Database\QueryException`, `Symfony\Component\HttpKernel\Exception\ServiceUnavailableHttpException`. The original exception is still reported (logged) as before: only what the client receives changes. The handler renders the 503 through the same path as `abort(503)`, so JSON clients get JSON and pages get the static 503 view.

Add the message to the three translation files (in `lang/en.json` the value is the key, as for every other key):

| File | Value |
|---|---|
| `lang/fr.json` | `La base de données est occupée. Réessayez.` |
| `lang/es.json` | `La base de datos está ocupada. Inténtalo de nuevo.` |
| `lang/de.json` | `Die Datenbank ist ausgelastet. Bitte erneut versuchen.` |

- [ ] **Step 4: Run**

Run: `bin/test-db pgsql -- tests/Feature/Database/ConcurrencyErrorResponseTest.php tests/Feature/ErrorPagesTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS (7 tests in the new file). If the browser case renders something other than the static 503 view, read `App\Http\ErrorPageResponder`: it decides the page for a 503; do not change it, assert what it gives.

- [ ] **Step 5: Retry the transactions that touch nothing but the database**

Write the failing test `tests/Feature/Database/RetriedTransactionsTest.php`:

```php
<?php

it('retries the transactions that touch nothing but the database', function (string $file) {
    expect(file_get_contents(base_path($file)))->toContain('Transactions::Attempts');
})->with([
    'app/Actions/Admin/RevokeInstanceAdmin.php',
    'app/Actions/Workspaces/CreateWorkspaceInvitation.php',
    'app/Actions/Mcp/IssueMcpToken.php',
    'app/Http/Controllers/Retros/CardVotesController.php',
    'app/Http/Controllers/Retros/CardReactionsController.php',
    'app/Http/Controllers/Retros/SurveyReactionsController.php',
    'app/Http/Controllers/PokerDecksController.php',
    'app/Http/Controllers/WorkspacePokerDecksController.php',
    'app/Http/Controllers/PokerDeckDuplicatesController.php',
    'app/Http/Controllers/WorkspaceTemplatesController.php',
]);

it('never retries a transaction that copies files or calls a provider', function (string $file) {
    expect(file_get_contents(base_path($file)))->not->toContain('Transactions::Attempts');
})->with([
    'app/Actions/Whiteboards/SaveWhiteboardTemplate.php',
    'app/Actions/Integrations/SaveTeamIntegration.php',
    'app/Support/Integrations/IntegrationTokens.php',
]);
```

Check the last path with `grep -rln "class IntegrationTokens" app` and use the real one.

Run it: FAIL on the ten files. Then, in each of the ten files, every `DB::transaction(function () … { … });` whose closure passes the check below gets the second argument:

```php
        return DB::transaction(function () use ($user): bool {
            …
        }, Transactions::Attempts);
```

The check, made by reading each closure and everything it calls: it issues queries, throws validation errors, and dispatches events or jobs that are sent after commit (`sendToOthers()`, `ShouldDispatchAfterCommit`, `->afterCommit()`); it makes no HTTP call, sends no mail directly, writes no file, and changes no state outside the database that a second run would repeat (a counter in the cache, a rate limiter hit). A closure that fails the check is left alone and removed from the test's first list, with a line in the task report. In `CardVotesController`, `CardReactionsController`, `SurveyReactionsController`, `PokerDecksController` and `WorkspaceTemplatesController`, both the `store` (or `update`) and the `destroy` transactions are candidates; apply the check to each.

Laravel retries only an outermost transaction. Under `RefreshDatabase` every transaction is nested, so the feature suite never exercises a retry; Task 13 does.

Run: `bin/test-db pgsql -- tests/Feature/Database/RetriedTransactionsTest.php tests/Feature/Retros tests/Feature/Poker tests/Feature/Admin tests/Feature/Workspaces tests/Feature/Mcp`
Expected: PASS.

- [ ] **Step 6: Closing run and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add app/Support/Database/Transactions.php bootstrap/app.php lang app/Actions/Admin/RevokeInstanceAdmin.php app/Actions/Workspaces/CreateWorkspaceInvitation.php app/Actions/Mcp/IssueMcpToken.php app/Http/Controllers tests/Feature/Database/ConcurrencyErrorResponseTest.php tests/Feature/Database/RetriedTransactionsTest.php docs/superpowers/research/database-portability-baseline.md
git commit -m "feat(database): a busy database answers 503 with a retry delay, and database-only transactions are retried"
```

---

## Task 13: The concurrency suite

**Files:**
- Create: `tests/Concurrency/Support/Race.php`, `tests/Concurrency/HarnessTest.php`, `tests/Concurrency/LastInstanceAdminTest.php`, `tests/Concurrency/VoteLimitTest.php`, `tests/Concurrency/SavedDeckLimitsTest.php`, `tests/Concurrency/WhiteboardTemplateLimitTest.php`, `tests/Concurrency/ReactionUniquenessTest.php`, `tests/Concurrency/FirstIntegrationTest.php`, `tests/Concurrency/MagicLinkSingleUseTest.php` [18f]
- Modify: `tests/Pest.php`, `app/Actions/Poker/SavedPokerDeckRules.php`, `app/Http/Controllers/PokerDecksController.php:117-121`, `app/Http/Controllers/WorkspacePokerDecksController.php:17-21`, `app/Http/Controllers/WorkspaceTemplatesController.php:44-50`, `app/Http/Requests/WorkspaceTemplateRequest.php`, `app/Actions/Integrations/SaveTeamIntegration.php:44`

**Interfaces:**
- Consumes: `Transactions::Attempts` (Task 12), `NameKey` (Task 4), `bin/test-db <driver> --concurrency` (Task 1), [18f] `App\Actions\Auth\ConsumeMagicLink::handle(string $token): ?User`, `MagicLink::hashToken()`.
- Produces: `Tests\Concurrency\Support\Race::run(array $contenders, string $pauseAfter = Race::FirstQueryInTransaction): array` returning, per contender, `array{ok: bool, value: mixed, error: ?string, message: ?string, startedAt: float, endedAt: float}`; `Race::request(?string $userId, string $method, string $uri, array $payload = []): int` (the HTTP status); `SavedPokerDeckRules::ensureNameIsFree(Team|Workspace $lockedOwner, string $name, ?SavedPokerDeck $ignore = null): void`.

How a race is made: every contender is a separate PHP process (Laravel's process concurrency driver starts `php artisan invoke-serialized-closure` for each), with its own connection. All wait for one instant, then run. Each pauses 200 ms after its first query inside a transaction: with a lock, the others queue behind it; without one, they have all read the same state by the time the first one writes. A contender closure must be `static` and capture scalars only (ids, strings): it is serialised, and a closure bound to the test case cannot be.

- [ ] **Step 1: Write the harness and its own test**

`tests/Concurrency/Support/Race.php`:

```php
<?php

namespace Tests\Concurrency\Support;

use App\Models\User;
use Closure;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Concurrency;
use Illuminate\Support\Facades\DB;
use Throwable;

class Race
{
    public const string FirstQueryInTransaction = 'transaction';

    public const string FirstQuery = 'any';

    private const int PauseMicroseconds = 200_000;

    /**
     * @param  array<int|string, Closure(): mixed>  $contenders  static closures that capture scalars only
     * @return array<int|string, array{ok: bool, value: mixed, error: ?string, message: ?string, startedAt: float, endedAt: float}>
     */
    public static function run(array $contenders, string $pauseAfter = self::FirstQueryInTransaction): array
    {
        $startAt = microtime(true) + (float) env('RACE_LEAD_SECONDS', 4);
        $tasks = [];

        foreach ($contenders as $key => $contender) {
            $tasks[$key] = static fn (): array => Race::contend($contender, $startAt, $pauseAfter);
        }

        return Concurrency::driver('process')->run($tasks);
    }

    /**
     * Runs in the contender's own process.
     *
     * @return array{ok: bool, value: mixed, error: ?string, message: ?string, startedAt: float, endedAt: float}
     */
    public static function contend(Closure $contender, float $startAt, string $pauseAfter): array
    {
        $paused = false;

        DB::listen(function () use (&$paused, $pauseAfter): void {
            if ($paused || ($pauseAfter === self::FirstQueryInTransaction && DB::transactionLevel() === 0)) {
                return;
            }

            $paused = true;

            usleep(self::PauseMicroseconds);
        });

        DB::connection()->getPdo();

        $wait = (int) (($startAt - microtime(true)) * 1_000_000);

        if ($wait > 0) {
            usleep($wait);
        }

        $startedAt = microtime(true);

        try {
            $value = $contender();
        } catch (Throwable $exception) {
            return ['ok' => false, 'value' => null, 'error' => $exception::class, 'message' => $exception->getMessage(), 'startedAt' => $startedAt, 'endedAt' => microtime(true)];
        }

        return ['ok' => true, 'value' => $value, 'error' => null, 'message' => null, 'startedAt' => $startedAt, 'endedAt' => microtime(true)];
    }

    /**
     * Sends a JSON request through the HTTP kernel of the contender's process, as the given user.
     * Returns the status: a contender reports what a client would see.
     *
     * @param  array<string, mixed>  $payload
     */
    public static function request(?string $userId, string $method, string $uri, array $payload = []): int
    {
        if ($userId !== null) {
            Auth::guard('web')->setUser(User::query()->findOrFail($userId));
        }

        $request = Request::create($uri, $method, $payload, [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], (string) json_encode($payload));

        return resolve(Kernel::class)->handle($request)->getStatusCode();
    }
}
```

`env()` is used here because the class is test support read outside any cached configuration; the Arch rule on `env()` covers `app/` only.

In `tests/Pest.php`, after the `Browser` block:

```php
pest()->extend(TestCase::class)
    ->use(DatabaseTruncation::class)
    ->beforeEach(function (): void {
        if (config('database.connections.'.config('database.default').'.database') === ':memory:') {
            $this->markTestSkipped('The concurrency suite needs a database that several processes can open: run it with bin/test-db <driver> --concurrency.');
        }
    })
    ->in('Concurrency');
```

with `use Illuminate\Foundation\Testing\DatabaseTruncation;`. Rows must be committed to be seen by the other processes, so this suite truncates the tables between tests instead of wrapping each test in a transaction. It uses the database `testing` itself (the parallel feature runs use `testing_test_<n>`), and is never run in parallel.

`tests/Concurrency/HarnessTest.php`:

```php
<?php

use App\Models\User;
use Tests\Concurrency\Support\Race;

it('runs its contenders at the same time, each in its own process', function () {
    $outcomes = Race::run(array_fill(0, 4, static function (): int {
        usleep(300_000);

        return (int) getmypid();
    }));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(array_unique(array_column($outcomes, 'value')))->toHaveCount(4)
        ->and(max(array_column($outcomes, 'startedAt')))->toBeLessThan(min(array_column($outcomes, 'endedAt')));
});

it('gives a contender the database of the test', function () {
    $userId = User::factory()->create()->id;

    $outcomes = Race::run([static fn (): bool => User::query()->whereKey($userId)->exists()]);

    expect($outcomes[0])->toMatchArray(['ok' => true, 'value' => true]);
});

it('reports an exception of a contender instead of failing the run', function () {
    $outcomes = Race::run([static fn () => throw new RuntimeException('boom')]);

    expect($outcomes[0])->toMatchArray(['ok' => false, 'error' => RuntimeException::class, 'message' => 'boom']);
});
```

Run: `bin/test-db pgsql --concurrency -- tests/Concurrency/HarnessTest.php` (the extra path narrows the run; without it the whole folder runs).
Expected: PASS, 3 tests. If the first test fails on the overlap, the machine starts the processes too slowly: set `RACE_LEAD_SECONDS=8` in the environment of the run and say so in the report. If a contender cannot be serialised ("Serialization of 'Closure' is not allowed", or of the test case), a closure is not `static` or captures an object. If the second test fails, the contender process does not see the test's database: it inherits the environment of `bin/test-db` (`DB_*`) and of `phpunit.xml` (`APP_ENV=testing`, `CACHE_STORE=array`); print `config('database.connections')` from a contender to see which one it lost, and stop if it cannot be fixed in `Race` alone.

Then run the same on `mariadb`, `mysql` and `sqlite-file`. Expected: PASS on the four.

- [ ] **Step 2: C1, the last instance admin**

`tests/Concurrency/LastInstanceAdminTest.php`:

```php
<?php

use App\Actions\Admin\RevokeInstanceAdmin;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('keeps one instance admin when the last two are revoked at the same time', function () {
    $firstId = User::factory()->instanceAdmin()->create()->id;
    $secondId = User::factory()->instanceAdmin()->create()->id;

    $outcomes = Race::run([
        static fn (): bool => resolve(RevokeInstanceAdmin::class)->handle(User::query()->findOrFail($firstId)),
        static fn (): bool => resolve(RevokeInstanceAdmin::class)->handle(User::query()->findOrFail($secondId)),
    ]);

    $answers = array_column($outcomes, 'value');
    sort($answers);

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(User::query()->where('is_instance_admin', true)->count())->toBe(1)
        ->and($answers)->toBe([false, true]);
});
```

Red first. In `RevokeInstanceAdmin`, comment out `->lockForUpdate()` and the `Transactions::Attempts` argument, then run `bin/test-db pgsql --concurrency -- tests/Concurrency/LastInstanceAdminTest.php` and the same on `mariadb`.
Expected: FAIL, 0 admins left and both answers `true`. On `sqlite-file` the test passes even so (its write transactions are serialised whatever the code asks): to see it red there, set `'transaction_mode' => 'DEFERRED'` in `config/database.php` for the run; expected: one contender fails with "database is locked". Restore the three lines.

Green: run on `pgsql`, `mariadb`, `mysql`, `sqlite-file`. Expected: PASS on the four. Copy the red and the green output into the task report; do the same for every scenario below.

- [ ] **Step 3: C3, the vote limit**

`tests/Concurrency/VoteLimitTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Retro;
use App\Models\Vote;
use Tests\Concurrency\Support\Race;

it('never gives a participant more votes than the limit', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => 3]);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $userId = $user->id;
    $uri = route('retros.cards.votes.store', [$retro, $card], false);

    $outcomes = Race::run(array_fill(0, 8, static fn (): int => Race::request($userId, 'POST', $uri)));

    $statuses = array_count_values(array_column($outcomes, 'value'));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(Vote::query()->where('participant_id', $participant->id)->count())->toBe(3)
        ->and($statuses)->toBe([201 => 3, 422 => 5]);
});
```

`array_count_values` orders its keys by first appearance; compare with `expect($statuses[201] ?? 0)->toBe(3)->and($statuses[422] ?? 0)->toBe(5)` if the order varies.

Red: in `CardVotesController::store`, comment out both `->lockForUpdate()` (retro and participant). Expected on `pgsql` and `mariadb`: FAIL with 8 votes. Restore. Green on the four engines.

On SQLite, eight write transactions queue for one lock, each holding it 200 ms: the last waits about 1.6 s, under the 5 s busy timeout. If a contender answers 503 there, the timeout was reached: that is the documented behaviour (Review Focus 4), but in this test it means the pause is too long for the machine; lower the number of contenders to 6 and say so.

- [ ] **Step 4: C4 and C5, the deck cap and the deck name**

`tests/Concurrency/SavedDeckLimitsTest.php`:

```php
<?php

use App\Models\SavedPokerDeck;
use App\Models\Team;
use Tests\Concurrency\Support\Race;

function deckRace(Team $team, array $names): array
{
    $userId = integrationAdmin($team)->id;
    $uri = route('teams.pokerDecks.store', [$team->workspace, $team], false);
    $contenders = [];

    foreach ($names as $name) {
        $contenders[] = static fn (): int => Race::request($userId, 'POST', $uri, ['name' => $name, 'cards' => ['1', '2', '3']]);
    }

    return Race::run($contenders);
}

it('stops at thirty saved decks per team', function () {
    $team = Team::factory()->create();
    SavedPokerDeck::factory()->count(29)->create(['team_id' => $team->id]);

    $outcomes = deckRace($team, ['Race 1', 'Race 2', 'Race 3', 'Race 4', 'Race 5', 'Race 6']);
    $statuses = array_column($outcomes, 'value');

    expect(SavedPokerDeck::query()->where('team_id', $team->id)->count())->toBe(30)
        ->and(array_filter($statuses, fn (int $status): bool => $status === 422))->toHaveCount(5)
        ->and(array_filter($statuses, fn (int $status): bool => $status >= 500))->toBe([]);
});

it('keeps one deck when the same name is saved six times at once, and answers the others 422', function () {
    $team = Team::factory()->create();

    $outcomes = deckRace($team, array_fill(0, 6, 'Fibonacci plus'));
    $statuses = array_column($outcomes, 'value');

    expect(SavedPokerDeck::query()->where('team_id', $team->id)->count())->toBe(1)
        ->and(array_filter($statuses, fn (int $status): bool => $status === 422))->toHaveCount(5)
        ->and(array_filter($statuses, fn (int $status): bool => $status >= 500))->toBe([]);
});
```

Use the request body of the first `store` test of `tests/Feature/Poker/SavedPokerDecksTest.php` if `cards` needs another shape, and the user that test signs in if `integrationAdmin()` may not create a deck.

Run on `pgsql`. Expected: the cap test passes (the team row is locked before the count). **The name test fails**: the name is validated before the transaction (`PokerDecksController.php:108-114`, then the lock at `:118`), so six requests pass validation together, one insert succeeds and five hit the unique index: five 500. The index keeps the data right; the answer is wrong. The audit states the owner's row is locked around the name check; that is true of whiteboard templates only.

Fix: check the name again once the owner is locked. In `SavedPokerDeckRules`:

```php
    /**
     * Call with the owner row locked, inside the transaction that writes the deck:
     * the rule of nameRules() ran before the lock and may have raced.
     */
    public static function ensureNameIsFree(Team|Workspace $lockedOwner, string $name, ?SavedPokerDeck $ignore = null): void
    {
        $isTaken = $lockedOwner->pokerDecks()
            ->where('name_key', NameKey::of($name))
            ->when($ignore !== null, fn ($query) => $query->whereKeyNot($ignore?->id))
            ->exists();

        if (! $isTaken) {
            return;
        }

        throw ValidationException::withMessages(['name' => __('A deck with this name already exists.')]);
    }
```

and call it after `ensureRoom` in `PokerDecksController::store` (`SavedPokerDeckRules::ensureNameIsFree($lockedTeam, $validated['name']);`) and after `ensureRoomInWorkspace` in `WorkspacePokerDecksController::store` (`SavedPokerDeckRules::ensureNameIsFree($lockedWorkspace, (string) $request->validated('name'));`).

`WorkspaceTemplatesController::store` has the same shape (the form request validates the name, then the controller locks the workspace). Make `WorkspaceTemplateRequest::nameIsTaken()` public and call it under the lock, after the count check:

```php
            if ($request->nameIsTaken()) {
                throw ValidationException::withMessages(['name' => __('A template with this name already exists.')]);
            }
```

Use the message the request's own rule gives today (read it in `WorkspaceTemplateRequest`), so both paths answer alike.

Red for the cap: comment out `->lockForUpdate()` in `PokerDecksController::store`; expected on `pgsql` and `mariadb`: more than 30 decks. Restore. Green: both tests on the four engines.

- [ ] **Step 5: C6, the whiteboard template cap from two boards**

`tests/Concurrency/WhiteboardTemplateLimitTest.php`:

```php
<?php

use App\Actions\Whiteboards\SaveWhiteboardTemplate;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardTemplate;
use Illuminate\Validation\ValidationException;
use Tests\Concurrency\Support\Race;

it('stops at fifty whiteboard templates when two boards of one workspace save at the same time', function () {
    $team = Team::factory()->create();
    $otherTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    WhiteboardTemplate::factory()->count(49)->create(['workspace_id' => $team->workspace_id]);
    $userId = workspaceManager($team->workspace)->id;
    $firstBoardId = Whiteboard::factory()->create(['team_id' => $team->id])->id;
    $secondBoardId = Whiteboard::factory()->create(['team_id' => $otherTeam->id])->id;

    $save = static fn (string $boardId, string $name): Closure => static fn (): string => resolve(SaveWhiteboardTemplate::class)
        ->handle(Whiteboard::query()->findOrFail($boardId), User::query()->findOrFail($userId), $name, null)->id;

    $outcomes = Race::run([$save($firstBoardId, 'From the first board'), $save($secondBoardId, 'From the second board')]);

    expect(WhiteboardTemplate::query()->where('workspace_id', $team->workspace_id)->count())->toBe(50)
        ->and(array_filter(array_column($outcomes, 'ok')))->toHaveCount(1)
        ->and(collect($outcomes)->firstWhere('ok', false)['error'])->toBe(ValidationException::class);
});
```

`$save` returns a closure built from scalars; write the two contenders out in full if the nested static closure does not serialise.

This is the case the audit found (`SaveWhiteboardTemplate.php:25-29`): the transaction reads the board's team before it takes the workspace lock, so on MySQL and MariaDB at REPEATABLE READ the count comes from a snapshot older than the lock.

Red: set `'isolation_level' => null` in the `$mysql` array of `config/database.php` (the engine's default, REPEATABLE READ, then applies) and run `bin/test-db mariadb --concurrency -- tests/Concurrency/WhiteboardTemplateLimitTest.php`. Expected: FAIL with 51 templates. Restore the setting. On `pgsql`, red is obtained by commenting out the workspace `->lockForUpdate()`. Green on the four engines.

- [ ] **Step 6: C7, reactions with emoji**

`tests/Concurrency/ReactionUniquenessTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\CardReaction;
use App\Models\Retro;
use Tests\Concurrency\Support\Race;

it('stores one reaction per emoji when one participant sends two emoji three times each at once', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $userId = $user->id;
    $uri = route('retros.cards.reactions.update', [$retro, $card], false);
    $contenders = [];

    foreach (['👍', '🎉', '👍', '🎉', '👍', '🎉'] as $emoji) {
        $contenders[] = static fn (): int => Race::request($userId, 'PUT', $uri, ['emoji' => $emoji]);
    }

    $outcomes = Race::run($contenders);
    $stored = CardReaction::query()->where('card_id', $card->id)->where('participant_id', $participant->id)->pluck('emoji')->sort()->values()->all();
    $expected = ['👍', '🎉'];
    sort($expected);

    expect(array_column($outcomes, 'value'))->each->toBe(200)
        ->and($stored)->toBe($expected);
});
```

Set up the retro the way `tests/Feature/Retros/CardReactionsTest.php` does if reactions need a setting or another phase.

Red: on `mariadb` with `-e DB_COLLATION=utf8mb4_unicode_ci` (as in Task 9 Step 1). Expected: FAIL, one row: every emoji is the same value under that collation. Green on the four engines.

- [ ] **Step 7: C8, the first connection of an integration**

`tests/Concurrency/FirstIntegrationTest.php`:

```php
<?php

use App\Actions\Integrations\SaveTeamIntegration;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('keeps one integration when a provider is connected six times at once for the first time', function () {
    $team = Team::factory()->create();
    $teamId = $team->id;
    $userId = integrationAdmin($team)->id;

    $outcomes = Race::run(array_fill(0, 6, static fn (): string => resolve(SaveTeamIntegration::class)->handle(
        Team::query()->findOrFail($teamId),
        IntegrationProvider::Telegram,
        User::query()->findOrFail($userId),
        [
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => [],
            'settings' => ['chatId' => '42', 'chatTitle' => 'Team chat', 'chatType' => 'group'],
            'scopes' => [],
        ],
    )->id));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(TeamIntegration::query()->where('team_id', $teamId)->count())->toBe(1)
        ->and(array_unique(array_column($outcomes, 'value')))->toHaveCount(1);
});
```

The attributes are those `HandleTelegramUpdate.php:102-112` passes.

Run on `pgsql`. Expected: FAIL. `SaveTeamIntegration` locks a row that does not exist yet, which locks nothing: six inserts, one succeeds, five violate the unique index `(team_id, provider)` and throw. The data is right; five callers get an error for a harmless race, and on MySQL at REPEATABLE READ the same race deadlocks instead.

Fix (spec P7): lock the aggregate root first. In `SaveTeamIntegration::handle()`, as the first statement of the transaction:

```php
            Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();
```

The existing `->lockForUpdate()` on the integration query stays: it protects the row against the other writers of that row (`mergeSettings`, the token refresh), which do not lock the team.

Green on the four engines. Then `bin/test-db pgsql -- tests/Feature/Integrations`: expected PASS (a lock-order test there may now see `teams` before `team_integrations`: update its expected list).

- [ ] **Step 8: [18f] C2, the magic link**

`tests/Concurrency/MagicLinkSingleUseTest.php`:

```php
<?php

use App\Actions\Auth\ConsumeMagicLink;
use App\Models\MagicLink;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('signs in once when one link is consumed six times at the same instant', function () {
    $user = User::factory()->create();
    $token = 'race-token-0123456789abcdefghijklmnopqrstuvwxyz';
    MagicLink::factory()->create(['user_id' => $user->id, 'token_hash' => MagicLink::hashToken($token)]);

    $outcomes = Race::run(
        array_fill(0, 6, static fn (): ?string => resolve(ConsumeMagicLink::class)->handle($token)?->id),
        Race::FirstQuery,
    );

    $winners = array_filter(array_column($outcomes, 'value'));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and($winners)->toHaveCount(1)
        ->and(array_values($winners)[0])->toBe($user->id)
        ->and(MagicLink::query()->whereNotNull('consumed_at')->count())->toBe(1);
});
```

`Race::FirstQuery` is used because the action runs no transaction: it claims the link with one conditional `update`, which every engine applies atomically.

Red: replace, for the run, the body of `ConsumeMagicLink::handle()` by a read followed by a write (`$link = MagicLink::findUsable($token); if ($link === null) { return null; } $link->forceFill(['consumed_at' => now()])->save(); return $link->user;`). Expected on every engine but SQLite: FAIL, six winners (each paused after its read). Restore. Green on the four engines.

If 18f is not merged, skip this step and come back to it with Task 9 (see **Branches**).

- [ ] **Step 9: The whole suite on the four engines, and the feature suite on three**

```bash
bin/test-db pgsql --concurrency
bin/test-db mariadb --concurrency
bin/test-db mysql --concurrency
bin/test-db sqlite-file --concurrency
```

Expected: PASS on the four (10 tests, 9 without C2). Run each twice: a concurrency test that passes once and fails once is not done. Then the task's closing run, since Steps 4 and 7 changed application code.

- [ ] **Step 10: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add tests/Concurrency tests/Pest.php app/Actions/Poker/SavedPokerDeckRules.php app/Http/Controllers/PokerDecksController.php app/Http/Controllers/WorkspacePokerDecksController.php app/Http/Controllers/WorkspaceTemplatesController.php app/Http/Requests/WorkspaceTemplateRequest.php app/Actions/Integrations/SaveTeamIntegration.php tests/Feature docs/superpowers/research/database-portability-baseline.md
git commit -m "test(concurrency): eight invariants are proved with real concurrent connections on four engines"
```

---

## Task 14: The guard rail closes

**Files:**
- Modify: `tests/Arch/DatabasePortabilityTest.php`, `tests/Arch/database-portability-baseline.txt`, `tests/Arch/database-portability-allowed.txt`

**Interfaces:**
- Consumes: the lists as Tasks 3 to 13 left them.
- Produces: an empty baseline, asserted; an allowed list whose every line is a reviewed, portable raw call.

- [ ] **Step 1: Write the failing test**

Add to `tests/Arch/DatabasePortabilityTest.php`:

```php
it('has nothing left to fix', function () {
    expect(databasePortabilityList('database-portability-baseline.txt'))->toBe([]);
});

it('allows raw sql only where it is a plain aggregate, a case expression or a helper', function () {
    $root = dirname(__DIR__, 2).'/';
    $suspect = [];

    foreach (array_keys(databasePortabilityList('database-portability-allowed.txt')) as $key) {
        [$path, $rule] = explode('|', $key);

        if ($rule !== 'raw sql') {
            continue;
        }

        preg_match_all('/Raw\(\s*([\'"])(.*?)\1/s', (string) file_get_contents($root.$path), $matches);

        foreach ($matches[2] as $sql) {
            if (preg_match('/^[\w\s.,()*?=<>!]+$/', $sql) !== 1 || preg_match('/\b(?:lower|upper|coalesce|concat|now|cast|ifnull|nullif|greatest|least|json_\w+|strftime|date_format|to_char)\s*\(/i', $sql) === 1) {
                $suspect[] = "{$path}: {$sql}";
            }
        }
    }

    expect($suspect)->toBe([]);
});
```

The second test reads each raw string of an allowed file: it may hold words, dots, commas, parentheses, `*`, `?` and comparison signs, and no function other than the aggregates and `case`.

Run: `vendor/bin/sail artisan test --compact tests/Arch/DatabasePortabilityTest.php`
Expected: the first new test fails if a line is left on the baseline; the second fails on any raw string that is more than an aggregate.

- [ ] **Step 2: Empty the baseline**

For each line left on the baseline, open the file and fix it with the helper of its rule (the table of spec §11 names the construct, §7 the helper). A line that belongs to code merged from a lane after its task ran is fixed here. If Task 9 has not run (18f not merged), the lines of the four e-mail lookups and of `SearchWorkspaceContent` stay: move them to a third file `tests/Arch/database-portability-waiting-for-18f.txt`, read by `databasePortabilityList()` in the first test only, and delete that file in Task 9.

For each suspect of the second test: if the string is a `case when` built by hand, leave it and widen the test only if the string holds no function (the `case` keyword is already accepted by the character class); if it calls a function, replace it (`lower` → a stored key or `TextSearch`; a date function → PHP).

- [ ] **Step 3: Review the allowed list by hand**

Print it: `cat tests/Arch/database-portability-allowed.txt`. Every line is a file and a count. For each file, read its raw calls once more against rule 2 of the `CLAUDE.md` section. Write in the task report the final list with one phrase per file ("counts per card", "sum and count per player").

- [ ] **Step 4: Run, commit**

Run: `vendor/bin/sail artisan test --compact tests/Arch` then `grep -rn "ilike\|insertOrIgnore\|date_trunc\|nulls last\|filter (where" app database`.
Expected: PASS; the grep prints nothing (acceptance criterion 7). `grep -rn "getDriverName" app database tests | grep -v "app/Support/Database\|tests/Support\|tests/Concurrency/Support\|tests/Arch/DatabasePortabilityTest"` prints nothing (criterion 6).

```bash
git add tests/Arch
git commit -m "test(arch): no driver-specific construct is left, and none may come back"
```

---

## Task 15: Operations

**Files:**
- Create: `app/Support/Database/DatabaseRequirements.php`, `app/Console/Commands/CheckDatabaseCommand.php`, `tests/Feature/Database/CheckDatabaseCommandTest.php`, `compose.production.mariadb.yaml`, `compose.production.sqlite.yaml`
- Modify: `Dockerfile:15,39`, `docker/scripts/prepare`, `.env.example:26-31`

**Interfaces:**
- Produces: `App\Support\Database\DatabaseRequirements::problems(Connection $connection): array<int, string>`, `DatabaseRequirements::warnings(Connection $connection): array<int, string>`, `DatabaseRequirements::MinimumVersions`; the command `skrum:check-database` (exit 0 or 1).

- [ ] **Step 1: Write the failing test**

`tests/Feature/Database/CheckDatabaseCommandTest.php`:

```php
<?php

use App\Support\Database\DatabaseRequirements;
use Illuminate\Support\Facades\DB;

it('finds nothing wrong with the database the suite runs on', function () {
    expect(DatabaseRequirements::problems(DB::connection()))->toBe([]);

    $this->artisan('skrum:check-database')->assertSuccessful();
});

it('refuses a mysql or mariadb connection that ignores case or reads repeatable snapshots', function () {
    $default = config('database.default');

    config(['database.connections.loose' => [
        ...config("database.connections.{$default}"),
        'collation' => 'utf8mb4_unicode_ci',
        'isolation_level' => null,
    ]]);

    $problems = implode("\n", DatabaseRequirements::problems(DB::connection('loose')));
    DB::purge('loose');

    expect($problems)->toContain('utf8mb4_unicode_ci')
        ->toContain('READ COMMITTED');
})->skip(fn () => ! array_key_exists('isolation_level', config('database.connections.'.config('database.default'))), 'Applies to MySQL and MariaDB.');

it('refuses a sqlite file that is not in write-ahead mode or does not take the write lock at begin', function () {
    $path = tempnam(sys_get_temp_dir(), 'skrum-check-');

    config(['database.connections.plain_file' => [
        ...config('database.connections.sqlite'),
        'database' => $path,
        'journal_mode' => 'delete',
        'transaction_mode' => 'DEFERRED',
    ]]);

    $problems = implode("\n", DatabaseRequirements::problems(DB::connection('plain_file')));
    DB::purge('plain_file');
    unlink($path);

    expect($problems)->toContain('journal_mode')
        ->toContain('IMMEDIATE');
});

it('refuses a version under the minimum', function () {
    $connection = Mockery::mock(DB::connection())->makePartial();
    $connection->shouldReceive('getServerVersion')->andReturn('1.0.0');

    expect(implode("\n", DatabaseRequirements::problems($connection)))->toContain('1.0.0');
});

it('fails the command and names the problem', function () {
    $default = config('database.default');
    $path = tempnam(sys_get_temp_dir(), 'skrum-check-');

    config([
        'database.connections.plain_file' => [...config('database.connections.sqlite'), 'database' => $path, 'journal_mode' => 'delete'],
        'database.default' => 'plain_file',
    ]);

    $this->artisan('skrum:check-database')->expectsOutputToContain('journal_mode')->assertFailed();

    config(['database.default' => $default]);
    DB::purge('plain_file');
    unlink($path);
});
```

Run: `bin/test-db pgsql -- tests/Feature/Database/CheckDatabaseCommandTest.php`. Expected: FAIL, class and command not found.

- [ ] **Step 2: Write `DatabaseRequirements`**

```php
<?php

namespace App\Support\Database;

use Illuminate\Database\Connection;

/**
 * What Skrum needs from its database, engine by engine. The only place of the application
 * that sends engine-specific SQL.
 */
class DatabaseRequirements
{
    /** @var array<string, string> */
    public const array MinimumVersions = [
        'pgsql' => '14.0',
        'mariadb' => '10.11.0',
        'mysql' => '8.4.0',
        'sqlite' => '3.35.0',
    ];

    /**
     * @return array<int, string>
     */
    public static function problems(Connection $connection): array
    {
        $driver = $connection->getDriverName();
        $minimum = self::MinimumVersions[$driver] ?? null;

        if ($minimum === null) {
            return ["{$connection->getDriverTitle()} is not supported. Use PostgreSQL, MariaDB, MySQL or SQLite."];
        }

        $problems = [];
        $version = $connection->getServerVersion();

        if (version_compare($version, $minimum, '<')) {
            $problems[] = "{$connection->getDriverTitle()} {$version} is older than the minimum, {$minimum}.";
        }

        return [...$problems, ...match ($driver) {
            'mysql', 'mariadb' => self::mysqlProblems($connection, $driver),
            'sqlite' => self::sqliteProblems($connection),
            default => [],
        }];
    }

    /**
     * @return array<int, string>
     */
    public static function warnings(Connection $connection): array
    {
        $driver = $connection->getDriverName();

        if ($driver === 'pgsql') {
            $locale = (string) $connection->scalar('select datcollate from pg_database where datname = current_database()');

            return in_array($locale, ['C', 'POSIX'], true)
                ? ["The database locale is {$locale}: search ignores the case of unaccented letters only. Create the database with a UTF-8 locale to fold accented letters too."]
                : [];
        }

        if (in_array($driver, ['mysql', 'mariadb'], true) && $connection->getConfig('collation') === 'utf8mb4_bin') {
            return ['The collation utf8mb4_bin ignores trailing spaces in comparisons. Prefer '.($driver === 'mysql' ? 'utf8mb4_0900_bin' : 'utf8mb4_nopad_bin').'.'];
        }

        return [];
    }

    /**
     * @return array<int, string>
     */
    private static function mysqlProblems(Connection $connection, string $driver): array
    {
        $isolationVariable = $driver === 'mariadb' ? '@@tx_isolation' : '@@transaction_isolation';
        $collation = (string) $connection->scalar('select @@collation_connection');
        $isolation = (string) $connection->scalar("select {$isolationVariable}");
        $problems = [];

        if (! str_ends_with($collation, '_bin')) {
            $problems[] = "The connection collation is {$collation}. Skrum needs a binary collation (DB_COLLATION): with this one, different emoji and words that differ by case or accent are treated as equal.";
        }

        if ($isolation !== 'READ-COMMITTED') {
            $problems[] = "The isolation level is {$isolation}. Skrum needs READ COMMITTED: limits and uniqueness checks can otherwise be passed by two requests at once.";
        }

        return $problems;
    }

    /**
     * @return array<int, string>
     */
    private static function sqliteProblems(Connection $connection): array
    {
        $problems = [];

        if (version_compare(PHP_VERSION, '8.4.0', '<')) {
            $problems[] = 'SQLite needs PHP 8.4 or later: on PHP '.PHP_VERSION.' transactions do not take the write lock when they begin, and concurrent writes fail.';
        }

        if ($connection->getConfig('transaction_mode') !== 'IMMEDIATE') {
            $problems[] = 'The transaction_mode of the sqlite connection must be IMMEDIATE.';
        }

        if ((int) $connection->scalar('pragma foreign_keys') !== 1) {
            $problems[] = 'Foreign keys are off (DB_FOREIGN_KEYS): deleting a team or a retro would leave its rows behind.';
        }

        $journalMode = strtolower((string) $connection->scalar('pragma journal_mode'));

        if ($connection->getConfig('database') !== ':memory:' && $journalMode !== 'wal') {
            $problems[] = "The journal_mode is {$journalMode}. Skrum needs wal: readers would otherwise block the writer.";
        }

        return $problems;
    }
}
```

`@@tx_isolation` is the variable MariaDB 10.11 has; `@@transaction_isolation` is MySQL's. If MariaDB 11.8 (the nightly) rejects `@@tx_isolation`, read `@@transaction_isolation` there when the version is 11.1 or later.

- [ ] **Step 3: Write the command**

`vendor/bin/sail artisan make:command CheckDatabaseCommand --no-interaction`, then:

```php
<?php

namespace App\Console\Commands;

use App\Support\Database\DatabaseRequirements;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

#[Description('Check that the database engine, its version and its settings are ones Skrum supports')]
#[Signature('skrum:check-database')]
class CheckDatabaseCommand extends Command
{
    public function handle(): int
    {
        $connection = DB::connection();

        $this->info("Checking {$connection->getDriverTitle()} {$connection->getServerVersion()}...");

        foreach (DatabaseRequirements::warnings($connection) as $warning) {
            $this->warn($warning);
        }

        $problems = DatabaseRequirements::problems($connection);

        foreach ($problems as $problem) {
            $this->error($problem);
        }

        if ($problems !== []) {
            return self::FAILURE;
        }

        $this->comment('The database is ready.');

        return self::SUCCESS;
    }
}
```

Run the test on `pgsql`, `sqlite`, `mariadb`, `mysql`. Expected: PASS on the four (the second test runs on MariaDB and MySQL only). Review Focus 1 is this test.

- [ ] **Step 4: The image and its start script**

`Dockerfile`, both `install-php-extensions` lines: add `pdo_mysql pdo_sqlite` (`bcmath intl opcache pcntl pdo_mysql pdo_pgsql pdo_sqlite zip` in the base stage, the same without `opcache` in the build stage).

`docker/scripts/prepare`: replace the `for variable in APP_KEY … DB_PASSWORD; do` line and add the SQLite file and the check:

```sh
connection="${DB_CONNECTION:-sqlite}"
required="APP_KEY REVERB_APP_ID REVERB_APP_KEY REVERB_APP_SECRET"

if [ "$connection" != "sqlite" ]; then
    required="$required DB_PASSWORD"
fi

for variable in $required; do
```

and, between `php artisan optimize` and the migration block:

```sh
if [ "$connection" = "sqlite" ]; then
    database="${DB_DATABASE:-/app/database/database.sqlite}"

    mkdir -p "$(dirname "$database")"
    chown www-data:www-data "$(dirname "$database")"

    if [ ! -f "$database" ]; then
        s6-setuidgid www-data touch "$database"
    fi
fi

s6-setuidgid www-data php artisan skrum:check-database
```

`set -e` at the top of the script stops the start when the check fails, with its sentence in the container log.

- [ ] **Step 5: The two production alternatives**

`compose.production.mariadb.yaml`: a copy of `compose.production.yaml` where the `app` service has `DB_CONNECTION: mariadb`, `DB_HOST: mariadb`, `DB_PORT: '3306'`, `depends_on: mariadb`, and the database service is:

```yaml
    mariadb:
        image: 'mariadb:11.8'
        restart: unless-stopped
        command:
            - '--character-set-server=utf8mb4'
            - '--collation-server=utf8mb4_nopad_bin'
            - '--transaction-isolation=READ-COMMITTED'
        environment:
            MARIADB_DATABASE: '${DB_DATABASE:-skrum}'
            MARIADB_USER: '${DB_USERNAME:-skrum}'
            MARIADB_PASSWORD: '${DB_PASSWORD:?Set DB_PASSWORD in your env file}'
            MARIADB_RANDOM_ROOT_PASSWORD: 'yes'
        volumes:
            - 'mariadb-data:/var/lib/mysql'
        healthcheck:
            test: ['CMD', 'healthcheck.sh', '--connect', '--innodb_initialized']
            interval: 5s
            timeout: 5s
            retries: 10
```

with the volume `mariadb-data` in place of `pgsql-data`.

`compose.production.sqlite.yaml`: the `app` service alone, no `depends_on`, with

```yaml
        environment:
            APP_ENV: production
            APP_DEBUG: 'false'
            LOG_CHANNEL: stderr
            DB_CONNECTION: sqlite
            DB_DATABASE: /app/database/data/skrum.sqlite
            SESSION_DRIVER: file
            CACHE_STORE: file
```

followed by the Reverb variables of the original file, and the extra volume `'sqlite-data:/app/database/data'` (declared under `volumes:`). Sessions and the cache go to files so that their writes do not queue behind the single writer; the queue stays in the database.

Check both files parse: `docker compose -f compose.production.mariadb.yaml config >/dev/null && docker compose -f compose.production.sqlite.yaml config >/dev/null` (with `DB_PASSWORD=x` in the environment for the first).

- [ ] **Step 6: `.env.example`**

Replace the six `DB_` lines with:

```dotenv
# Database. PostgreSQL is the default and the reference; MariaDB, MySQL and SQLite are supported too.
# docs/database.md says which to choose and what each needs. `php artisan skrum:check-database` verifies it.
DB_CONNECTION=pgsql
DB_HOST=pgsql
DB_PORT=5432
DB_DATABASE=skrum
DB_USERNAME=sail
DB_PASSWORD=password

# MariaDB 10.11 or later (Sail: `sail --profile mariadb up -d`)
# DB_CONNECTION=mariadb
# DB_HOST=mariadb
# DB_PORT=3306

# MySQL 8.4 or later (Sail: `sail --profile mysql up -d`)
# DB_CONNECTION=mysql
# DB_HOST=mysql
# DB_PORT=3306

# SQLite, for a small instance: one file, one writer at a time. Needs PHP 8.4.
# DB_CONNECTION=sqlite
# DB_DATABASE=/absolute/path/to/skrum.sqlite
# SESSION_DRIVER=file
# CACHE_STORE=file
```

- [ ] **Step 7: Start the image on three engines (acceptance criterion 18)**

```bash
docker build -t skrum-portability .
```

then, for each of `compose.production.yaml`, `compose.production.mariadb.yaml`, `compose.production.sqlite.yaml`, with a throw-away env file holding `APP_KEY`, the Reverb variables, `DB_PASSWORD` and `SKRUM_IMAGE=skrum-portability`, on a free port (`SKRUM_HTTP_PORT=8088`, `SKRUM_HTTPS_PORT=8443`) and a project name of its own so that no volume of the development stack is touched:

```bash
docker compose -p skrum-check -f <file> --env-file <env file> up -d
docker compose -p skrum-check -f <file> logs app | grep -E "Checking|The database is ready|migrat"
curl -fsS http://localhost:8088/up >/dev/null && echo up
docker compose -p skrum-check -f <file> down -v
```

Expected for each: the check line, "The database is ready.", the migrations, and `up`. This is the only step of the plan that builds the image; if Docker cannot build on the machine of the run (no network for the base images), say so and leave criterion 18 marked "not run" in the report: do not claim it.

- [ ] **Step 8: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add app/Support/Database/DatabaseRequirements.php app/Console/Commands/CheckDatabaseCommand.php tests/Feature/Database/CheckDatabaseCommandTest.php Dockerfile docker/scripts/prepare compose.production.mariadb.yaml compose.production.sqlite.yaml .env.example
git commit -m "feat(ops): the image runs on PostgreSQL, MariaDB, MySQL and SQLite, and refuses a database it cannot trust"
```

---

## Task 16: Continuous integration, and SQLite as the default of the suite

**Files:**
- Modify: `phpunit.xml:30`, `.github/workflows/tests.yml`, `bin/test-browser:86-90`, `composer.json` (the `test:browser` script only)

**Interfaces:**
- Consumes: `bin/test-db` with `TEST_DB_ON_HOST=1`, `bin/check-pg-upgrade` with `PG_EXEC`, `skrum:check-database`.
- Produces: jobs `ci`, `plan`, `database (pgsql 18)`, `database (mariadb 10.11)`, `sqlite-file`, `browser`, and on the schedule `database (mysql 8.4)`, `database (pgsql 14)`, `database (mariadb 11.8)`.

- [ ] **Step 1: `phpunit.xml`**

Replace `<env name="DB_DATABASE" value="testing"/>` with:

```xml
        <env name="DB_CONNECTION" value="sqlite"/>
        <env name="DB_DATABASE" value=":memory:"/>
```

Neither has `force`, so the variables `bin/test-db` and CI set still win. `vendor/bin/sail artisan test` now runs on SQLite in memory; PostgreSQL is `bin/test-db pgsql`.

Run: `vendor/bin/sail artisan test --compact --parallel --processes=8`
Expected: PASS, the same numbers as `bin/test-db sqlite` at the end of Task 11.

The browser suite stays on PostgreSQL, and until now it took the engine from `.env`; `phpunit.xml` would now give it SQLite. Name the engine where the suite is started:

`bin/test-browser`, in the loop that starts the shards, add one line above `DB_HOST=127.0.0.1 \`:

```bash
    DB_CONNECTION=pgsql \
```

`composer.json`, script `test:browser`, add two lines before `"pest tests/Browser"`:

```json
            "@putenv DB_CONNECTION=pgsql",
            "@putenv DB_DATABASE=testing",
```

Only the script changes; no requirement of `composer.json` does.

- [ ] **Step 2: The workflow**

Replace `.github/workflows/tests.yml` (the action versions pinned today are kept):

```yaml
name: tests

on:
  push:
    branches:
      - main
  pull_request:
  schedule:
    - cron: '17 3 * * *'

permissions:
  contents: read

jobs:
  ci:
    if: github.event_name != 'schedule'
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Setup PHP
        uses: shivammathur/setup-php@f3e473d116dcccaddc5834248c87452386958240 # v2
        with:
          php-version: '8.4'
          extensions: sockets, pdo_sqlite
          tools: composer:v2
          coverage: none

      - name: Setup Node
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: '22'

      - name: Setup Application
        env:
          DB_CONNECTION: sqlite
          DB_DATABASE: database/database.sqlite
        run: |
          touch database/database.sqlite
          composer setup

      - name: Run CI Checks
        run: composer ci:check

  plan:
    runs-on: ubuntu-latest
    outputs:
      databases: ${{ steps.databases.outputs.list }}

    steps:
      - name: Choose the engines of this run
        id: databases
        env:
          EVENT: ${{ github.event_name }}
        run: |
          postgres='"port":5432,"username":"skrum","health":"pg_isready -U skrum -d testing"'
          mariadb='"port":3306,"username":"root","health":"healthcheck.sh --connect --innodb_initialized"'
          mysql='"port":3306,"username":"root","health":"mysqladmin ping -ppassword"'

          every_push='{"driver":"pgsql","image":"postgres:18-alpine","label":"pgsql 18","upgrade":true,'"$postgres"'},{"driver":"mariadb","image":"mariadb:10.11","label":"mariadb 10.11","upgrade":false,'"$mariadb"'}'
          nightly='{"driver":"mysql","image":"mysql:8.4","label":"mysql 8.4","upgrade":false,'"$mysql"'},{"driver":"pgsql","image":"postgres:14-alpine","label":"pgsql 14","upgrade":false,'"$postgres"'},{"driver":"mariadb","image":"mariadb:11.8","label":"mariadb 11.8","upgrade":false,'"$mariadb"'}'

          if [ "$EVENT" = schedule ]; then
              echo "list=[$nightly]" >> "$GITHUB_OUTPUT"
          else
              echo "list=[$every_push]" >> "$GITHUB_OUTPUT"
          fi

  database:
    name: database (${{ matrix.label }})
    needs: plan
    runs-on: ubuntu-latest
    timeout-minutes: 45

    strategy:
      fail-fast: false
      matrix:
        include: ${{ fromJSON(needs.plan.outputs.databases) }}

    services:
      database:
        image: ${{ matrix.image }}
        env:
          POSTGRES_DB: testing
          POSTGRES_USER: skrum
          POSTGRES_PASSWORD: password
          MARIADB_ROOT_PASSWORD: password
          MARIADB_DATABASE: testing
          MYSQL_ROOT_PASSWORD: password
          MYSQL_DATABASE: testing
        ports:
          - ${{ matrix.port }}:${{ matrix.port }}
        options: >-
          --health-cmd "${{ matrix.health }}"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 20

    env:
      TEST_DB_ON_HOST: 1
      TEST_DB_PORT: ${{ matrix.port }}
      TEST_DB_USERNAME: ${{ matrix.username }}
      TEST_DB_PASSWORD: password
      TEST_DB_PROCESSES: 4

    steps:
      - name: Checkout code
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Setup PHP
        uses: shivammathur/setup-php@f3e473d116dcccaddc5834248c87452386958240 # v2
        with:
          php-version: '8.4'
          extensions: sockets, pdo_pgsql, pdo_mysql, pdo_sqlite, pcntl
          tools: composer:v2
          coverage: none

      - name: Setup Node
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: '22'

      - name: Install dependencies and build
        run: |
          composer install --no-interaction --prefer-dist
          npm ci
          npm run build
          cp .env.example .env
          php artisan key:generate

      - name: Check the database and migrate from nothing
        env:
          DB_CONNECTION: ${{ matrix.driver }}
          DB_HOST: 127.0.0.1
          DB_PORT: ${{ matrix.port }}
          DB_DATABASE: testing
          DB_USERNAME: ${{ matrix.username }}
          DB_PASSWORD: password
        run: |
          php artisan skrum:check-database
          php artisan migrate:fresh --seed --force

      - name: Feature, Unit and Arch suites
        run: bin/test-db ${{ matrix.driver }}

      - name: Concurrency suite
        run: bin/test-db ${{ matrix.driver }} --concurrency

      - name: An existing PostgreSQL install upgrades to the fresh schema
        if: matrix.upgrade
        env:
          PG_EXEC: docker exec -i ${{ job.services.database.id }}
          PG_USER: skrum
          DB_PORT: ${{ matrix.port }}
          DB_USERNAME: skrum
          DB_PASSWORD: password
        run: bin/check-pg-upgrade

      - name: Upload logs
        if: failure()
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: test-db-${{ matrix.label }}
          path: storage/logs
          if-no-files-found: ignore

  sqlite-file:
    if: github.event_name != 'schedule'
    runs-on: ubuntu-latest
    timeout-minutes: 20

    env:
      TEST_DB_ON_HOST: 1

    steps:
      - name: Checkout code
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Setup PHP
        uses: shivammathur/setup-php@f3e473d116dcccaddc5834248c87452386958240 # v2
        with:
          php-version: '8.4'
          extensions: sockets, pdo_sqlite, pcntl
          tools: composer:v2
          coverage: none

      - name: Install dependencies
        run: |
          composer install --no-interaction --prefer-dist
          cp .env.example .env
          php artisan key:generate

      - name: Check the database and migrate from nothing
        env:
          DB_CONNECTION: sqlite
          DB_DATABASE: database/ci.sqlite
        run: |
          touch database/ci.sqlite
          php artisan skrum:check-database
          php artisan migrate:fresh --seed --force

      - name: Database tests on a file
        run: bin/test-db sqlite-file -- tests/Feature/Database

      - name: Concurrency suite
        run: bin/test-db sqlite-file --concurrency
```

and keep the `browser` job exactly as it is, with `if: github.event_name != 'schedule'` added under its name. Its `env` block sets `DB_CONNECTION: pgsql` and the rest; add `DB_DATABASE: testing` there, because `phpunit.xml` now says `:memory:` and the browser suite needs the PostgreSQL service.

A job-level `if:` cannot read `matrix`, which is why a first job, `plan`, chooses the rows: the two required engines on a push or a pull request, the three others on the nightly schedule.

Two things to check, because the workflow was written without a run:

- `CheckDatabaseCommandTest` opens a SQLite file on every engine, so `pdo_sqlite` is in every job.
- `migrate:fresh --seed` runs in a job whose `.env` came from `.env.example`: the seeder must not need a service the job lacks. If it does, drop `--seed` there and say so in the report.

- [ ] **Step 3: Run what can be run locally**

```bash
TEST_DB_ON_HOST=1 bin/test-db sqlite -- tests/Feature/Database
TEST_DB_ON_HOST=1 bin/test-db sqlite-file --concurrency
```

Expected: PASS, if the host has PHP 8.4 with `pdo_sqlite`; otherwise run them through Sail and note that the host path is proved by CI only. Validate the YAML: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest` if the image is available; otherwise `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/tests.yml'))"`.

- [ ] **Step 4: Commit**

```bash
git add phpunit.xml .github/workflows/tests.yml
git commit -m "ci: the suite runs on SQLite, PostgreSQL and MariaDB on every push, on MySQL and on the oldest and newest versions nightly"
```

The workflow first runs for real when the branch reaches a pull request; nothing is pushed by this plan. The report of Task 18 says that the CI jobs are written and not yet observed.

---

## Task 17: Documentation

**Files:**
- Create: `docs/database.md`
- Modify: `README.md` (the configuration section and the `DB_PASSWORD` row), `CLAUDE.md` (the last line of the "Database portability" section, if a class name changed since Task 2)

- [ ] **Step 1: Write `docs/database.md`**

Sections, in this order, with this content. Numbers and names come from the code as it stands at this task (`DatabaseRequirements::MinimumVersions`, `config/database.php`), not from this plan, if they differ.

1. **Which database to choose.** A table of four rows:

   | Engine | Choose it when | Know that |
   |---|---|---|
   | PostgreSQL 14+ | by default | it is what Skrüm is developed on and what the browser tests run on |
   | MariaDB 10.11+ | it is what you already run and back up | Skrüm sets a binary collation and READ COMMITTED on its connection and refuses to start without them |
   | MySQL 8.4+ | same | same; tested nightly rather than on every change |
   | SQLite 3.35+, PHP 8.4 | you want one container and no database server, for a small instance | one writer at a time (see below) |

2. **SQLite: what "small" means.** One paragraph, in these terms: every write (a card, a vote, a reaction, a whiteboard stroke, a session, a queued job) waits for the one before it. A few teams and sessions of a few dozen people are fine. When writes queue for more than five seconds, the action fails with "The database is busy. Try again." (HTTP 503) and nothing is lost. The file must be on a local disk, never a network share. Back it up with `sqlite3 skrum.sqlite ".backup 'copy.sqlite'"`, not by copying the file while the application runs (two more files, `-wal` and `-shm`, belong to it). Keep sessions and cache out of it (`SESSION_DRIVER=file`, `CACHE_STORE=file`). Check constraints are enforced by the application only: a row written by hand with the `sqlite3` tool is not checked.

3. **Settings Skrüm needs, and why.** One row per setting, with what goes wrong without it: MariaDB and MySQL collation (`utf8mb4_nopad_bin`, `utf8mb4_0900_bin`; with a `_ci` collation every emoji is the same reaction and `Ada` is `ada`), isolation (READ COMMITTED; otherwise two requests can both pass a limit), time zone (`+00:00`); SQLite `journal_mode` wal, `busy_timeout` 5000, `transaction_mode` IMMEDIATE, foreign keys on; PostgreSQL: a UTF-8 locale for the database (with `C`, search ignores the case of unaccented letters only). Then: `php artisan skrum:check-database` verifies all of it and the container runs it at start.

4. **What differs between engines.** The table of spec §9 in the operator's words: order of capital and accented names in lists that are paginated; search is accent-sensitive everywhere; check constraints on SQLite; dates beyond 2038 in a few nullable columns on MariaDB and MySQL; throughput.

5. **Installing.** The three Compose files and the four blocks of `.env.example`.

6. **Upgrading an existing PostgreSQL instance.** `php artisan migrate` (the container does it at start). What it does: three key columns, their indexes, four old indexes dropped, five column defaults dropped; each migration is one transaction; nothing to do by hand. If two templates of one workspace had names that differ only by case or a trailing space, both are kept and the log names them.

7. **Changing engine.** Not supported: there is no tool to move data from one engine to another.

8. **For developers.** `bin/test-db` and its five targets; the concurrency suite and how a race is written (`static` closures, scalars only, the 200 ms pause); `bin/check-pg-upgrade`; the helpers of `app/Support/Database` in one table (name, when to use it); how to add a migration (the five rules of the `CLAUDE.md` section); the three capability skips and when a test may use one.

Write it in full sentences, in the present tense, without "simply" or "just"; a product name is written Skrüm in prose.

- [ ] **Step 2: `README.md`**

In the configuration section, replace the sentence that presents PostgreSQL as the database with two sentences: PostgreSQL is the default; MariaDB, MySQL and SQLite are supported, see `docs/database.md`. In the variables table, the `DB_PASSWORD` row becomes "Database password. Required, except with SQLite." Add a row `DB_CONNECTION` — "`pgsql` (default), `mariadb`, `mysql` or `sqlite`. See `docs/database.md`."

- [ ] **Step 3: Check the links and the names**

```bash
grep -o '`[A-Za-z\\]*::[a-zA-Z]*' docs/database.md | sort -u
grep -n "docs/database.md" README.md CLAUDE.md .env.example
```

Expected: every class and method the document names exists (`grep -rn "function <name>" app/Support/Database`); the three files link to it.

- [ ] **Step 4: Commit**

```bash
git add docs/database.md README.md CLAUDE.md
git commit -m "docs: which database to choose, what each needs, and how to test on each"
```

---

## Task 18: The full matrix and the report

**Files:**
- Create: `docs/superpowers/research/database-portability-report.md`
- Modify: `docs/superpowers/research/database-portability-baseline.md`

- [ ] **Step 1: Merge the rewrite branch one last time**

Merge `plan-18e-screens` (or the branch that replaced it) into `plan-db-portability`. Run `vendor/bin/sail artisan test --compact tests/Arch`. An offence brought by the merge is fixed now, with its helper. If `plan-18f-auth` arrived with this merge and Task 9 had not run, run Task 9 and Step 8 of Task 13 before going on.

- [ ] **Step 2: Run everything**

```bash
bin/test-db pgsql
bin/test-db sqlite
bin/test-db mariadb
bin/test-db mysql
bin/test-db pgsql --concurrency
bin/test-db mariadb --concurrency
bin/test-db mysql --concurrency
bin/test-db sqlite-file --concurrency
bin/test-db sqlite-file -- tests/Feature/Database
bin/check-pg-upgrade
vendor/bin/sail bin phpstan analyse --no-progress
vendor/bin/sail bin pint --test
npm run build && bin/test-browser
```

Expected: every line passes. The browser suite runs on PostgreSQL, as Task 16 made explicit in `bin/test-browser`.

For each engine, migrate from nothing and seed, outside the test suite:

```bash
for driver in pgsql mariadb mysql; do
    docker compose exec -T -u sail -e DB_CONNECTION=$driver -e DB_HOST=$driver -e DB_DATABASE=testing -e DB_USERNAME=sail -e DB_PASSWORD=password laravel.test php artisan migrate:fresh --seed --force
    docker compose exec -T -u sail -e DB_CONNECTION=$driver -e DB_HOST=$driver -e DB_DATABASE=testing -e DB_USERNAME=sail -e DB_PASSWORD=password laravel.test php artisan skrum:check-database
done
docker compose exec -T -u sail -e DB_CONNECTION=sqlite -e DB_DATABASE=database/testing.sqlite laravel.test php artisan migrate:fresh --seed --force
```

- [ ] **Step 3: Go through the acceptance criteria**

Open spec §14. For each of the nineteen criteria, write in the report: the criterion, the command or test that shows it, its result on this run. A criterion without evidence from this run is written "not shown", never "done". Criterion 16 (CI) is "written, not observed" until a pull request exists; criterion 18 (the image) is the result of Task 15 Step 7.

- [ ] **Step 4: Write the report**

`docs/superpowers/research/database-portability-report.md`, sections in this order:

1. **Result.** The four summary lines of `bin/test-db`, the four of the concurrency suite, the line of `bin/check-pg-upgrade`.
2. **Acceptance criteria**, the table of Step 3.
3. **Skips per engine**, each with its capability and its reason.
4. **What the suite found that the audit had not**: the triage table of Task 11, counted by cause; the two races of Task 13 (deck and template names validated before the lock; the first connection of an integration).
5. **Red runs of the concurrency suite**: for C1 to C8, the protection removed and the failure seen.
6. **Decisions taken on the owner's behalf**: A1 to A4 and D1 to D7 as built, and anything decided during the run.
7. **What differs between engines, as observed** (not as predicted): the list of spec §9 with what the runs confirmed or contradicted.
8. **Known limits**: updates of a deck or template name are protected by the unique index only (a rename raced with another answers 500, the data stays right); legacy duplicate addresses stay until an operator resolves them; nullable timestamps end in 2038 on MySQL and MariaDB; SQL Server does not migrate.
9. **Not shown**: every claim of the spec this run did not exercise (the CI jobs, PostgreSQL 14 and MariaDB 11.8 if not run locally, the image if it could not be built).
10. **Files changed**, counted by kind, against the estimate of the plan.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/research/database-portability-report.md docs/superpowers/research/database-portability-baseline.md
git commit -m "docs: database portability report"
```

No merge into `main`, no push.

---

## Self-review (done while writing; kept for the reader)

**Spec coverage.** §6.0 → Tasks 2, 14. §6.1 → Task 1. §6.2 → Task 3 (`bin/check-pg-upgrade`), Tasks 4 and 9 (it stays empty). §6.3 → Tasks 3, 4. §6.4 → Tasks 5, 6, 7. §6.5 → Tasks 8, 9. §6.6 → Tasks 12, 13. §6.7 → Task 10. §6.8 → Task 11. §6.9, §10 → Tasks 15, 16. §7: `Sql`, `InsertOnce` → 5; `TextSearch`, `SqliteFunctions` → 6; `NameKey` → 4; `DateOnly` → 8; `CheckConstraint` → 3; `Transactions` → 12; `DatabaseRequirements` → 15; `Alphabetical` → 7; `SqlProbe`, `DatabaseFailure`, `UnreachableDatabase` → 10; `Race` → 13. §11 → Tasks 2, 14. §12 → Tasks 2 (rule), 17. §13 → Task 16. §14: criterion 1 → Tasks 3, 16, 18; 2, 3 → 11, 18; 4 → 13; 5 → 3, 4, 9; 6, 7 → 14; 8 → 4, 13; 9 → 9, 13; 10 → 6; 11 → 8; 12 → 3, 8; 13 → 9; 14 → 12; 15 → 15; 16 → 16; 17 → 2, 15, 17; 18 → 15; 19 → 18.

**Two fixes that change behaviour on PostgreSQL too** (spec §6.6, §17 point 13), found by reading the controllers for Task 13: deck and template names are validated before the owner's lock is taken, so C5 needs a second check under the lock (`SavedPokerDeckRules::ensureNameIsFree`, `WorkspaceTemplateRequest::nameIsTaken()` made public); `SaveTeamIntegration` locks a row that may not exist, so C8 needs the team locked first. A 500 on a raced double submit becomes a 422 or a success.

**Not run.** No code of this plan was executed while writing it: the repository was read-only for the planning session, and other agents were at work in the worktrees. Every "Expected" is a prediction. The ones most likely to be wrong, each with what the task says to do then: the two collation names (Task 1 Step 5); replacing SQLite's `lower()` (Task 6 Step 3); the process concurrency driver handing the test's database and a serialised nested closure to its children (Task 13 Step 1); `if:` reading `matrix` at job level (Task 16 Step 2); `pg_dump` output being comparable line by line (Task 3 Step 2); `Carbon`-returning custom casts serialising like Eloquent's `date` (Task 8 Step 2); `setTablePrefix` making tables missing for a whole page render (Task 10 Step 7).

**Where the plan gives a recipe instead of every line.** Task 7 lists the 33 name-ordered sites and gives the rule and three worked examples, not thirty edits: each site must be read to its end to know its kind. Task 10 Step 9 and Task 14 Step 2 handle "every remaining line of the baseline", which only the scan of Task 2 can enumerate. Task 11 is a procedure by nature. Task 12 Step 5 gives the check a closure must pass rather than a verdict per closure, because the closures of five controllers were not all read. Task 17 gives the content of each section of `docs/database.md` rather than its final prose. In Tasks 5 and 6, two new feature tests are given with route names read from memory of the route file's pattern; the step says to read the real names.

**Read on the repository** (at `4568a764`, and 18f at `d9180f10`): `config/database.php`, `config/cache.php`, `phpunit.xml`, `compose.yaml`, `compose.production.yaml`, `Dockerfile`, `docker/scripts/prepare`, `.github/workflows/tests.yml`, `bin/test-browser`, `tests/Pest.php`, `tests/Arch/*`, the twelve migrations this plan edits, `ActionItemQuery`, `GameStreaks`, `TrackedIssues`, both leaderboards, `SearchBoards`, `LikePattern`, `TeamEstimatesController`, `AdminCandidatesController`, the three name rules and their three models, `PokerDecksController`, `WorkspacePokerDecksController`, `PokerDeckDuplicatesController`, `WorkspaceTemplatesController::store`, `SaveWhiteboardTemplate`, `RevokeInstanceAdmin`, `CardVotesController`, `CardReactionsController`, `SaveTeamIntegration`, `IssueMcpToken`, `DrawGameWord`, `SendActionItemReminders`, `HandleTelegramUpdate`, `InstanceSettings::rows`, `bootstrap/app.php`, the tests of audit §6 at the lines given, and in 18f `LoginAddress`, `User`, `UniqueEmailAddress`, `SearchWorkspaceContent`, `ConsumeMagicLink`, `MagicLink`, the three 18f migrations; in the framework, `SQLiteConnector`, `SQLiteConnection`, `MySqlConnector`, `ManagesTransactions`, `ConcurrencyErrorDetector`, the `whereLike` and `insertOrIgnore` grammars, `TestDatabases`, `RefreshDatabase`, `ProcessDriver`, `InvokeSerializedClosureCommand`, `Schema\Builder::hasIndex`, the PostgreSQL index query. Not read: the lanes other than 18f, the 138 transaction files beyond those named, `ErrorPageResponder`, the factories beyond the six quoted, the feature tests of the sites of Tasks 5 to 7.

**Type consistency.** `NameKey::of(string): string` in Tasks 4, 13 and the migration. `CheckConstraint::add(string, string, string): void` and `isEnforced(): bool` in Task 3 and its test; no other task calls `add`. `Sql::countWhen`, `nullsLast`, `never` return strings in Tasks 5 and 11. `InsertOnce::into(string, array): bool` in Task 5 at both call sites. `TextSearch::contains(Builder, string|array, string): void` in Task 6 at every site and in Task 9. `Alphabetical::sort(Collection, callable): Collection` in Task 7. `ModelInvariantViolation::because(Model, string): self` in Task 8. `Transactions::Attempts` in Tasks 12 and 13. `Race::run(array, string): array` and `Race::request(?string, string, string, array): int` in every file of Task 13. `SqlProbe::lockedTables`, `lockingQueries`, `onRead`, `reads`, `rowLocksExist` in Task 10 as defined in its Step 2. `DatabaseRequirements::problems(Connection): array` and `warnings(Connection): array` in Task 15 and its command. `bin/test-db` takes the driver first, then `--concurrency`, then `--` and arguments, in every task and in the workflow.

**Size.** 18 tasks. About 95 files: 14 new application classes and one command; 4 new migrations and 14 edited (12 in the main tree, 2 of 18f); 5 models; about 45 application files edited (17 with raw SQL, about 28 name-ordered sites, 10 retried transactions, with overlaps); 25 new test files and about 15 edited; 2 scripts, 2 Compose files, the workflow, `phpunit.xml`, `Dockerfile`, the start script, `.env.example`, 3 documents. Without the triage, which cannot be sized before the first run on another engine: 9 to 12 working sessions of an agent, of which Tasks 4 to 8 and 10 can overlap. The audit estimated 65 to 75 files; the difference is the name-ordered lists (D6), the operations task and the concurrency suite written out.
