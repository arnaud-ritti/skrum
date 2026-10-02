# Database portability — failures per driver

One section per task of `docs/superpowers/plans/2026-10-19-plan-database-portability.md`, newest last.
Each line is the summary printed by `bin/test-db`. Failing files are listed for SQLite and MariaDB.

## Task 1 — harness (on top of 40f6da45)

Run on 2026-10-02 with `TEST_DB_PROCESSES=6`, PHP 8.5.11, PostgreSQL 18, MariaDB 10.11.19, MySQL 8.4.11, SQLite 3.45.1.
The suite has 4 928 tests (Unit, Feature, Arch). 264 of them need no database and pass everywhere; one is skipped everywhere.

| Driver | Result |
|---|---|
| pgsql | `test-db pgsql: PASS, Tests: 1 skipped, 4927 passed (49540 assertions)` |
| sqlite | `test-db sqlite: FAIL (exit 2), Tests: 4663 failed, 1 skipped, 264 passed (3552 assertions)`. The migrations stop at `2026_10_06_100000_create_game_tables.php:48` (`create table "game_rounds"`): `SQLSTATE[HY000]: General error: 1 unrecognized token: ":"`, from the five `default '[]'::jsonb` columns. All 4 663 failures are this one. |
| mariadb | The migrations stop at `2026_10_01_100300_create_workspace_templates_table.php:21`: `SQLSTATE[42000]: Syntax error or access violation: 1064 … near 'name))'`, statement `create unique index workspace_templates_workspace_name_unique on workspace_templates (workspace_id, lower(name))`. One file: `Tests: 7 failed (0 assertions)`, 32 s. Whole suite: not finished when this was written (see below). |
| mysql | Same migration, same statement, same error 1064 (`… MySQL server version … near 'name))'`). One file: `Tests: 7 failed (0 assertions)`, 38 s. Whole suite: not run (see below). |

Every test that uses the database fails while migrating, so the list of failing files is "all of `tests/Feature`"
and the few database tests of `tests/Unit`: 4 663 tests on SQLite.

**Why the whole suite was not completed on MariaDB and MySQL.** `RefreshDatabase` runs `migrate:fresh` again for every
test as long as it fails. On MariaDB and MySQL that is about thirty `create table` and `alter table` statements and a
`drop table` of everything, per test: 4 to 5 seconds alone, about 16 seconds with six processes. The parallel run on
MariaDB had failed 338 tests after 18 minutes, with none passing beyond the 229 that need no database; at that pace
the 4 663 take about four hours per engine, to print the same error 4 663 times. The count is therefore the one of
SQLite (same tests need the database), and the cause is the one statement above. The whole suite is run on both
engines in Task 3, once the migrations pass.

Not predicted by the plan: `tests/Feature/Database/ConnectionSettingsTest.php` reads configuration only, but every
test of `tests/Feature` uses `RefreshDatabase` (`tests/Pest.php`), so it migrates and fails with the rest on the three
engines until Task 3.
