# Database

Skrüm is being made to run on PostgreSQL, MariaDB, MySQL and SQLite from one code base
(spec: `docs/superpowers/specs/2026-10-19-database-portability-design.md`). The operator's half of this
document (which engine to choose, required settings, minimum versions) is written when that work ends.

## Running the tests on an engine

`bin/test-db <sqlite|sqlite-file|pgsql|mariadb|mysql> [--concurrency] [-- arguments of artisan test]`

PostgreSQL runs with Sail. MariaDB and MySQL are started once, by name:
`docker compose up -d mariadb mysql`. Without arguments the script runs Unit, Feature and Arch in parallel
and prints one line, `test-db <driver>: PASS|FAIL, Tests: …`; with arguments it runs them in one process.
The header of `bin/test-db` lists the variables that change the host, the port, the database name and the
container (needed from a git worktree).

## Rules for database code

Owner rule: **use Eloquent simply, without raw queries, and respect Laravel conventions.** Database code must run
unchanged on PostgreSQL, MySQL, MariaDB and SQLite.

`tests/Arch/DatabasePortabilityTest.php` enforces most of this in `app/`, `database/` (migrations, seeders,
factories) and `tests/`. What existed before the rule is listed in `tests/Arch/database-portability-baseline.txt`,
one `path|rule|count` per line. The list only shrinks: a count may fall, never rise, no line is added, and the
portability plan ends with the file empty.

1. No raw query. No `whereRaw`, `orWhereRaw`, `selectRaw`, `orderByRaw`, `havingRaw`, `groupByRaw`, `fromRaw`, `DB::raw`, `DB::statement`, `DB::unprepared`, no `DB::select`, `DB::insert`, `DB::update` or `DB::delete` with an SQL string, no `Expression` object. Only Eloquent models, relationships, scopes and the standard methods of the query builder (`withCount`, `withSum`, `count()`, `sum()`, `groupBy`, `lockForUpdate`, …). No helper wraps raw SQL.
2. What SQL cannot say the same way on the four engines is done in PHP, on the rows or the collection: conditional counts, computed sort keys, where NULL sorts, date truncation, case folding.
3. No test of the driver: no `getDriverName()`, no comparison of the connection name, no `instanceof` on a connection or grammar class, in code, migrations, seeders, factories or tests.
4. No engine-specific construct through the builder either: `ilike`, `insertOrIgnore`, `upsert`, `whereJsonContains`, `whereJsonLength`, and `like` / `whereLike` (its case sensitivity follows the engine and the collation). Case-insensitive comparison: fold the value in PHP and compare with a column that stores the folded form. Never rely on the database being case-sensitive or not.
5. Migrations: Schema builder only, `up` only. No raw index or constraint SQL, no expression or partial index, no `->collation()`, no database default on a JSON column (use the model's `$attributes`). `dateTime()` rather than `timestamp()` for a non-null column, `longText()` for anything that can exceed 64 KB. An invariant the Schema builder cannot express on every engine is enforced in the model.
6. Transactions: lock the aggregate root first (`lockForUpdate()`), before any other query of the transaction. A statement that may fail inside a transaction runs in its own nested `DB::transaction`. No DDL inside a transaction.
7. Sorting: add an explicit tie-breaker; never depend on where NULL sorts or on alphabetical order from SQL. Lists read by people are sorted in PHP.
8. Tests: never read SQL text, quoting or `for update`; never use an SQL error such as `select 1 / 0` to simulate a failure; no `Schema::` change inside a test.
9. Before committing a change to database code, run the tests you touched on PostgreSQL and on one other engine: `bin/test-db pgsql -- <path>` and `bin/test-db mariadb -- <path>`.
