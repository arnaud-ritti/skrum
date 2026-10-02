# Database Portability Implementation Plan (revision 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Every agent reads **The owner rule**, **Owner decisions**, **Global Constraints**, **Running the suite** and **Review Focus** before its task. This plan runs its tests: a task is not done until the runs its last steps name have been made and their numbers written into the baseline file.

**Goal:** Skrüm migrates and runs on SQLite, MariaDB, MySQL and PostgreSQL from one code base, with no raw SQL and no driver branch in `app/` and `database/`; every invariant of the product is proved on each engine (with two real connections where a lock matters); an existing PostgreSQL instance upgrades with one `php artisan migrate`.

**Architecture:** Eloquent, the standard query-builder methods and the Schema builder, and nothing else. What SQL cannot say the same way on four engines is not said in SQL: it is stored in a column the model maintains (`name_key`, `email_key`, `*_search`, `action_items.sort_rank`, `game_points.week_start`), or computed in PHP on a set whose size is bounded and stated. MySQL and MariaDB are configured to compare like PostgreSQL (binary no-pad collation, READ COMMITTED); SQLite serialises write transactions. The five rules that were PostgreSQL check constraints are model guards on every engine. An architecture test lists every raw construct that existed; its list ends empty, and no allowed list exists.

**Tech Stack:** Laravel 13.34, PHP 8.4, Pest 5, Laravel Sail (PostgreSQL 18, MariaDB 10.11, MySQL 8.4), SQLite bundled with PHP, GitHub Actions. No new dependency.

**Spec:** `.superpowers/sdd/plan-db/2026-10-19-database-portability-design.v2.md` (revision 2; sections cited as §n). Audit: `docs/superpowers/research/database-portability-audit.md`. Report of Tasks 1 and 2: `.superpowers/sdd/plan-db/task-1-2-report.md`. Ledger: `.superpowers/sdd/plan-db/progress.md`.

**Not in this plan:** SQL Server; moving data between engines; accent-insensitive search; the browser suite on a second driver; converting nullable `timestamp` columns; database check constraints (spec §3).

**This revision replaces** `docs/superpowers/plans/2026-10-19-plan-database-portability.md`. Tasks 1 and 2 are done and kept as records. Tasks 3 onward are rewritten for the owner rule; the old numbers 6 to 18 moved by one (a task was added for the action-item list).

## The owner rule

"For the databases use Eloquent simply, without raw queries, and respect Laravel conventions." (2026-10-02)

In `app/` and `database/`: no `whereRaw`, `orWhereRaw`, `selectRaw`, `orderByRaw`, `havingRaw`, `groupByRaw`, `fromRaw`; no `DB::raw`, `DB::statement`, `DB::unprepared`; no `DB::select`, `DB::insert`, `DB::update`, `DB::delete` with an SQL string; no `Expression` object; no raw index or constraint SQL in a migration; no `getDriverName()` or other branch on the driver; no helper class that wraps raw SQL. Allowed: Eloquent models, relationships, scopes; `where`, `whereIn`, `whereExists`, `whereHas`, `whereColumn`, `whereLike(..., caseSensitive: true)`; `count`, `sum`, `avg`, `max`, `distinct`; `withCount`, `withSum`, `withAvg`, `withMax`; `increment`; `firstOrCreate`, `createOrFirst`, `updateOrCreate`, `upsert`; `lockForUpdate`, `sharedLock`; `DB::table()` with those same methods; `DB::transaction($callback, $attempts)`; the Schema builder; connection options in `config/database.php`.

`DB::table('x')->where(...)->update([...])` is the query builder and is allowed. `DB::update('update x set …')` is a raw statement and is not.

## Autonomous run

Unattended, on the branch `plan-db-portability`, worktree `.claude/worktrees/laneDb` (lane 9). No merge into `main`, no push. A decision taken on the owner's behalf goes in the report of Task 19. A step that says "stop" means: write what was found in the task report and end the task with `BLOCKED`; do not guess.

## Owner decisions

Ruled in the ledger (the owner may overturn): A1 to A4; D1 SQLite documented for small instances; D2 PostgreSQL stays the default; **D3 `composer.json` raised to `^8.4`, a constraint change to show the owner (Task 16)**; D4 minimum versions; D5 `users.email_key`; D6 lists sorted in PHP; D7 SQL Server best effort. The rule text is not written into `CLAUDE.md` by agents.

Open (spec §16), each built as recommended until the owner answers:

| # | Built as | Task that changes if the owner says otherwise |
|---|---|---|
| D8 | The five check constraints of existing PostgreSQL installs stay; fresh installs have none; the documentation gives the five statements an operator may run | 3 (the upgrade check), 18 |
| D9 | Search through stored folded columns | 7, 10 |
| D10 | Wildcard characters in a search term match any one character in SQL and are checked exactly in PHP | 7 |
| D11 | Top templates of a team counted over its 100 latest retros | 5 |
| D12 | Three lock-order tests kept through `Tests\Support\SqlProbe` | 11 |
| D13 | No arch rule against `function down(` | 15 |
| D14 | The rule stays in `docs/database.md` and the test message; a one-line pointer is proposed for `CLAUDE.md` | 19 (report) |

## Branches

- `plan-db-portability` was created from `plan-18e-screens` at `40f6da45` and holds Tasks 1 (`d0ed4ec5`) and 2 (`985bf55c`).
- **Task 2 is merged into `plan-18e-screens` as soon as the coordinator allows.** From then on every lane that merges there sees its own raw queries fail the architecture test. Lanes that added raw SQL since `40f6da45` fail by design: they fix the code, they do not add a line to the baseline.
- **Before each task from 3 on**, `plan-18e-screens` is merged into `plan-db-portability` (never the other way round until the end). After the merge run `bin/test-db pgsql -- tests/Arch`: an offence brought by a lane is fixed in the task at hand if it is in a file the task owns; otherwise it is fixed in Task 15, and listed in the task report (the baseline never gains a line).
- **Task 10, the [18f] steps of Task 7, and scenario C2 of Task 14 wait for `plan-18f-auth` to be merged into `plan-18e-screens`** (not merged on 2026-10-02: `3f4e5475` is not an ancestor). If 18f is not merged when Task 12 is reached, do Tasks 12 to 18 without them, leave the three e-mail lines and the `AdminCandidatesController` line on the baseline, and do Task 10 and C2 before Task 15.
- **End.** After Task 19 the branch is merged into the branch that carries the front rewrite to `main`. The merge is the owner's call.
- **Files this plan shares with the open branches:** `tests/Pest.php` (Tasks 3 and 14 add one `pest()` block each), `phpunit.xml` (Tasks 3 and 17), `bootstrap/app.php` (Task 13 adds two `render` calls), `.env.example`, `compose.yaml`, `.github/workflows/tests.yml`, `Dockerfile`, `composer.json` (Tasks 16 and 17), and the PHP files each task lists. Each edit is small and local; conflicts are resolved by keeping both sides.

## Parallel work

Each parallel task runs in its own git worktree created from the plan's branch, with its own `TEST_DB_WORKDIR` and its own `TEST_DB_DATABASE` (`testing_l9a`, `testing_l9b`, …; the name must start with `testing`).

| Wave | Tasks, in parallel | Files two of them touch |
|---|---|---|
| 0 | 3, alone | — |
| 1, after 3 is merged into the plan's branch | 4 (name keys), 5 (aggregates and writes), 6 (action-item list), 7 (search), 11 (tests) | `tests/Arch/database-portability-baseline.txt` (each task deletes its own lines only: one entry per line, merges are clean); `app/Models/ActionItem.php` (6: hook and method; 7: one trait); `app/Models/Retro.php` (5: one method; 7: one trait); `app/Models/User.php` (5: one relation; 7: one trait); `app/Models/Card.php` (7 only); `tests/Feature/ActionItems/ActionItemModelTest.php` (3 removed its first test; 9 edits three others) |
| 2, after wave 1 is merged | 8 (lists in PHP), 9 (model rules, dates) | none between them. 8 edits files of wave 1: `TeamGameLeaderboard.php`, `BuildSummaryInput.php`, `WorkspaceTemplatesController.php`, `PokerDecksController.php` (after 5), `AdminCandidatesController.php` (after 7). 9 edits `ActionItem.php` (after 6: both write `booted()`) and `ActionItemReminder.php` (after 5) |
| any time after 3 | 13 (retry and 503), 16 (operations), then 18 (documentation, after 16) | `README.md`; `config/database.php` (16 only) |

Sequential spine: 1 → 2 → 3 → wave 1 → wave 2 → 10 (needs 18f) → 12 (triage, needs waves 1 and 2 merged) → 13 → 14 → 15 → 17 → 19. `docs/superpowers/research/database-portability-baseline.md` is written by whoever integrates a task into the plan's branch, never inside a parallel worktree.

## File structure

Exists (Tasks 1 and 2): `bin/test-db`, `compose.yaml` (services `mariadb`, `mysql`), `config/database.php` and `config/cache.php` (engine settings, lock connections), `tests/TestCase.php` (lock connection follows the parallel database), `tests/Feature/Database/ConnectionSettingsTest.php`, `tests/Arch/DatabasePortabilityTest.php`, `tests/Arch/database-portability-baseline.txt`, `docs/database.md`, `docs/superpowers/research/database-portability-baseline.md`.

Created by Tasks 3 to 19:

| File | Responsibility | Task |
|---|---|---|
| `bin/check-pg-upgrade`, `tests/Fixtures/pgsql/before-portability.sql` | Prove an existing PostgreSQL install keeps its rows and ends like a fresh one | 3 |
| `database/migrations/2026_10_19_100000_drop_json_defaults_from_game_rounds.php` | Existing installs equal fresh ones | 3 |
| `tests/Upgrade/LegacyActionItemsBackfillTest.php` | The legacy backfill, by running the real migration | 3 |
| `app/Support/Database/NameKey.php`, `database/migrations/2026_10_19_100100_add_name_keys_to_named_tables.php` | `name_key` | 4 |
| `app/Models/GameUsedWord.php`, `database/migrations/2026_10_19_100400_add_week_start_to_game_points.php` | Used words through a model; the week of a points row | 5 |
| `database/migrations/2026_10_19_100500_add_sort_rank_to_action_items.php` | The stored order of the action-item list | 6 |
| `app/Support/Database/SearchText.php`, `app/Concerns/HasSearchColumns.php`, `database/migrations/2026_10_19_100600_add_search_columns.php` | Folded search columns | 7 |
| `app/Support/Alphabetical.php` | Alphabetical order in PHP | 8 |
| `app/Casts/DateOnly.php`, `app/Exceptions/ModelInvariantViolation.php` | `Y-m-d` on every engine; a model rule was broken | 9 |
| `database/migrations/2026_10_19_100200_add_email_key_to_users_table.php`, `…100300_normalise_workspace_invitation_emails.php`, `…100700_add_search_columns_for_workspace_search.php` [18f] | `email_key`; the search columns of the 18f search | 10 |
| `tests/Support/{SqlProbe,DatabaseFailure,UnreachableDatabase,MissingTables}.php` | Test helpers, none with SQL of its own | 11 |
| `app/Support/Database/Transactions.php` | Retry count, concurrency error test | 13 |
| `tests/Concurrency/Support/Race.php`, `tests/Concurrency/*Test.php` | Two-connection proofs | 14 |
| `app/Support/Database/DatabaseRequirements.php`, `app/Console/Commands/CheckDatabaseCommand.php`, `compose.production.mariadb.yaml`, `compose.production.sqlite.yaml` | Operations | 16 |
| `tests/Feature/Database/*Test.php`, `tests/Unit/Support/**`, `tests/Unit/Casts/DateOnlyTest.php` | One file per invariant family | 3 to 16 |
| `docs/superpowers/research/database-portability-report.md` | Final report | 19 |

Not created (revision 1 had them): `Sql`, `TextSearch`, `CheckConstraint`, `InsertOnce`, `SqliteFunctions`, `database-portability-allowed.txt`.

Modified: twelve historic migrations, about fifty-five files of `app/` (the sites each task lists), eleven models, `config/database.php`, `phpunit.xml`, `tests/Pest.php`, `bin/test-db`, `Dockerfile`, `docker/scripts/prepare`, `.env.example`, `.github/workflows/tests.yml`, `composer.json`, `README.md`, `docs/database.md`, `bootstrap/app.php`, four language files, eighteen test sites.

## Global Constraints

- **The owner rule above.** A step of this plan never asks for a raw construct; if a fix seems to need one, stop.
- **Until the migrations pass on an engine, run one test file on it, never the suite.** Every database test re-runs `migrate:fresh` when the schema is broken: a whole-suite run on MariaDB took about four hours for one line of information (Task 1). `bin/test-db` refuses to start the suite on a schema that does not migrate from Task 3 Step 1 on; do not bypass it (`TEST_DB_SKIP_PREFLIGHT`) for a whole-suite run.
- Minimum versions: PostgreSQL 14, MariaDB 10.11, MySQL 8.4, SQLite 3.35 with PHP 8.4 (spec §4).
- Derived columns are written by the model (mutator, `saving` or `creating` hook). Before adding one, grep for writes that bypass the model on that table (`DB::table('<table>')`, `::query()->…->update(`, `insert(`, `upsert(`) and make each set the column or go through the model.
- PHP works on bounded sets only. A step that loads rows to count, group or sort them names the bound in the code review note of its commit; an unbounded set gets a builder aggregate or a stored column.
- Aggregates read through `withSum`, `withAvg`, `sum()`, `avg()` are cast in PHP (`(int)`, `(float)`).
- Historic migrations are edited for fresh installs; anything an existing install needs is a new migration. Migrations have an `up` method only, use the Schema builder and query-builder loops only. Create files with `art make:… --no-interaction` (see **Running the suite**).
- New migrations: `dateTime()` for a non-null date-time, `longText()` for content that can pass 64 KB, no database default on a JSON column, no `->collation()`.
- Primary and foreign keys are UUIDs.
- PHP style of the project: early returns, no `else`, happy path last, typed everything, PascalCase constants, no class is `final`, no comment that restates code, no comment in tests, `vendor/bin/pint --dirty --format agent` on the host before each commit (it cannot run in the container from a worktree), PHPStan no worse than at the start of the task (15 errors on the branch in files this plan does not own: do not add one).
- Arch preset facts: `App\Support` does not use `App\Http` or `App\Mcp`; models do not use `App\Actions`, `App\Http`, `App\Mcp`; `env()` only in config files; console commands end in `Command`.
- Octane is installed: no static per-request state in new classes.
- No new dependency, PHP or JS. The only change to `composer.json` requirements is D3 (Task 16).
- One commit per task unless the task says otherwise. Stage explicit paths; never `git add -A`; never stage anything under `.superpowers/`, `resources/js/actions`, `resources/js/routes`.
- A worktree needs `npm run build` once (`public/build/manifest.json`), or one Inertia test answers 409.
- No merge into `main`, no push.

## Running the suite

Every shell first runs:

```bash
export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH" DOCKER_CONTEXT=orbstack
export TEST_DB_CONTAINER=skrum-laravel.test-1 TEST_DB_WORKDIR=/var/www/html/.claude/worktrees/laneDb \
       TEST_DB_DATABASE=testing_l9 TEST_DB_PROCESSES=6
art() { docker exec -u sail -w "$TEST_DB_WORKDIR" "$TEST_DB_CONTAINER" php artisan "$@"; }
```

(a parallel worktree changes `TEST_DB_WORKDIR` and `TEST_DB_DATABASE`). PostgreSQL, MariaDB (`skrum-mariadb-1`) and MySQL (`skrum-mysql-1`) are up since Task 1. From the main tree with Sail up, `bin/test-db <driver>` alone works.

Some tasks are carried over from revision 1, which was written for the main tree. From a worktree, read their commands this way: `docker compose exec -T -u sail <-e …> laravel.test php artisan <command>` is `docker exec -u sail -w "$TEST_DB_WORKDIR" <-e …> "$TEST_DB_CONTAINER" php artisan <command>`, with `DB_DATABASE=$TEST_DB_DATABASE` instead of `testing` and `-e DB_URL=`; `vendor/bin/sail artisan test --compact <path>` is `bin/test-db pgsql -- <path>`; `docker compose exec -T pgsql` is `docker exec -i skrum-pgsql-1`. Pint runs on the host.

| Command | What it runs |
|---|---|
| `bin/test-db <driver> -- tests/Feature/Database/NameKeysTest.php` | one file, one process. **The form to use while a task is in progress** |
| `bin/test-db <driver> -- --filter="keeps the name unique"` | one test |
| `bin/test-db pgsql`, `sqlite`, `mariadb`, `mysql` | Unit, Feature, Upgrade and Arch, in parallel, after the migration preflight |
| `bin/test-db <pgsql\|mariadb\|mysql\|sqlite-file> --concurrency` | `tests/Concurrency`, never in parallel |
| `bin/check-pg-upgrade` | the PostgreSQL upgrade proof |

"**The task's closing run**" means, in this order: `bin/test-db pgsql` (must be fully green), `bin/test-db sqlite`, `bin/test-db mariadb`. Each prints one summary line; copy the three into `docs/superpowers/research/database-portability-baseline.md` under the task's heading, with the names of the test files that still fail on SQLite and MariaDB. The count of failures on SQLite and on MariaDB must not rise from the previous task. `bin/test-db mysql` is run at Tasks 3, 12 and 19 only. A closing run that answers "the migrations stop at …" (exit 3) is a finding of the task, not a result to record and move on from.

Do not run two whole suites at once in the shared container: the PostgreSQL suite took 284 s beside a MariaDB run and 130 s alone. If a parallel run on PostgreSQL hits `max_locks_per_transaction`, rerun with `TEST_DB_PROCESSES=4`.

## Review Focus

1. **An operator configures MariaDB with a `_ci` collation or without READ COMMITTED.** Expected: the container refuses to start with a sentence naming the setting. Test: `CheckDatabaseCommandTest`, Task 16.
2. **An existing PostgreSQL instance holds two templates whose names differ only by a trailing space.** Expected: the migration succeeds, both rows keep their names, the later one gets a distinct key, the log says which. Test: `NameKeysMigrationTest`, Task 4, and the fixture of `bin/check-pg-upgrade`.
3. **A search term made of wildcard characters (`%`, `_`, `\`, `*`, `?`, `[`).** Expected: it finds text that contains those characters and nothing else, on every engine. Test: `SearchColumnsTest`, Task 7.
4. **A row is written without going through the model** (a future import, a job using `DB::table`). Expected today: none exists; each task that adds a derived column greps for one. The derived columns are `NOT NULL` where the source is, so such a write fails loudly instead of leaving a row that search, order or uniqueness cannot see. Tests: `NameKeysTest`, `ActionItemOrderTest`, `WeekStartTest`.
5. **Two people act in the same instant on SQLite and the second waits longer than the busy timeout.** Expected: 503 with `Retry-After`, not a 500 and not a lost write. Test: `ConcurrencyErrorResponseTest`, Task 13, and C3 on SQLite, Task 14.
6. **An action item changes state** (completed, reopened, due date removed, priority changed). Expected: it moves to its place in the list on the next read, on every page. Test: `ActionItemOrderTest`, Task 6.
7. **A relationship aggregate replaces a grouped query on a hot path** (the board snapshot). Expected: the same numbers, and no more queries than before; the query-count tests say so. Task 5 Step 3.

---

## Task 1: Each driver can run the suite — DONE (`d0ed4ec5`)

Kept as a record; nothing to do.

Produced: `bin/test-db <sqlite|sqlite-file|pgsql|mariadb|mysql> [--concurrency] [-- arguments of artisan test]`, one summary line, log in `storage/logs/test-db/<driver>.log`; variables `TEST_DB_DATABASE`, `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USERNAME`, `TEST_DB_PASSWORD`, `TEST_DB_ON_HOST`, `TEST_DB_CONTAINER`, `TEST_DB_WORKDIR`. `compose.yaml`: services `mariadb` (`mariadb:10.11`, host port 3306) and `mysql` (`mysql:8.4`, host port 3307) under profiles of the same names. `config/database.php`: MySQL `utf8mb4_0900_bin`, MariaDB `utf8mb4_nopad_bin`, both READ COMMITTED and `+00:00`; SQLite `busy_timeout` 5000, WAL, `synchronous` normal, `transaction_mode` IMMEDIATE; `mysql_locks`, `mariadb_locks` beside `pgsql_locks`. `config/cache.php` picks `<driver>_locks`, `null` on SQLite. `tests/TestCase.php`: the lock connection follows the per-process database of a parallel run. `tests/Feature/Database/ConnectionSettingsTest.php` (7 tests). `docs/superpowers/research/database-portability-baseline.md`.

Measured (six processes): PostgreSQL `PASS, 1 skipped, 4927 passed`. SQLite `4663 failed, 264 passed`, all at `2026_10_06_100000_create_game_tables.php:48` (`'[]'::jsonb`). MariaDB and MySQL stop at `2026_10_01_100300_create_workspace_templates_table.php:21` (`lower(name)` in an index); one file, 7 of 7 failed; the whole suite was not completed.

Learnt: both collation names exist; SQLite's `lower()` cannot be replaced on the PDO object Laravel opens; under `--parallel` only the default connection is renamed; `ConnectionSettingsTest` cannot pass off PostgreSQL until the migrations do (Task 3); a whole-suite run on an engine whose migrations fail takes hours.

## Task 2: Guard rail — DONE (`985bf55c`)

Kept as a record; nothing to do.

Produced: `tests/Arch/DatabasePortabilityTest.php` with two tests ("adds no raw query, driver branch or engine-specific construct…", "lists nothing that is no longer there") and `tests/Arch/database-portability-baseline.txt`: 72 lines, 116 occurrences, `path|rule|count` (37 lines for `app/`, 21 for `database/`, 14 for `tests/`). No allowed list. No folder of `app/` is exempt. `docs/database.md`: how to run the suite per engine, and "Rules for database code" with the owner rule. The failure message of the test carries the rule.

How every later task uses it: when a site is fixed, delete its line from the baseline (or lower its count); the second test fails until you do. Never add a line, never raise a count.

---

## Task 3: The migrations run on the four engines, with the Schema builder only

**Files:**
- Create: `database/migrations/2026_10_19_100000_drop_json_defaults_from_game_rounds.php`, `bin/check-pg-upgrade`, `tests/Fixtures/pgsql/before-portability.sql`, `tests/Feature/Database/PortableSchemaTest.php`, `tests/Upgrade/LegacyActionItemsBackfillTest.php`
- Modify: `bin/test-db`, `phpunit.xml` (one testsuite), `tests/Pest.php` (one block), `tests/Feature/ActionItems/ActionItemModelTest.php:16-56` (the first test moves), `database/migrations/2026_09_29_110028_create_workspace_invitations_table.php:18`, `2026_10_01_100300_create_workspace_templates_table.php:21`, `2026_10_01_110000_create_team_health_statements_table.php:25-34`, `2026_10_02_100000_add_v2_columns_to_action_items_table.php:46-77`, `2026_10_02_100500_create_action_item_reminders_table.php:17`, `2026_10_03_100100_create_poker_decks_table.php:23-27`, `2026_10_05_100000_create_integration_tables.php:36`, `2026_10_06_100000_create_game_tables.php:54-60,65,118,129`, `2026_10_07_100000_extend_integration_tables_for_sync_and_channels.php:61`, `2026_10_08_100000_create_integration_delivery_payloads_table.php:14-18`, `2026_10_10_100000_create_whiteboard_templates_table.php:25-29`, `2026_10_15_100000_add_workspace_to_poker_decks_table.php:17-22`; the baseline file

**Interfaces:**
- Produces: `bin/test-db` exits 3 with `test-db <driver>: FAIL, the migrations stop at <migration>` before any test runs; `bin/check-pg-upgrade` (exit 0 when no row was lost and the upgraded schema equals a fresh one, the five legacy check constraints aside); the suite `Upgrade`.
- After this task and until Task 4, the uniqueness of template and deck names rests on validation alone, on every engine; until Task 9 the five model rules rest on validation alone on a fresh install. The three tasks are merged into the plan's branch before anything is released.

- [ ] **Step 1: `bin/test-db` stops early when the schema does not migrate**

In `bin/test-db`, add to the header comment:

```bash
# Before the tests, the schema is migrated once on <TEST_DB_DATABASE>. If a migration fails, the
# script says which and exits 3 without running a test: every database test would fail on it and
# re-run the migrations, which takes hours on a server engine. TEST_DB_SKIP_PREFLIGHT=1 skips it.
```

add `"DB_URL="` to every `variables=(…)` list (the two SQLite ones and the one in `server()`), and insert between `run artisan config:clear --ansi >/dev/null` and the `if [ "$concurrency" = 1 ]` block:

```bash
case "$database" in
    testing*) ;;
    *)
        echo "TEST_DB_DATABASE must start with 'testing': the preflight wipes it." >&2
        exit 2
        ;;
esac

if [ "${TEST_DB_SKIP_PREFLIGHT:-0}" != 1 ]; then
    preflight="storage/logs/test-db/$driver-migrate.log"

    if ! run artisan migrate:fresh --force --no-interaction > "$preflight" 2>&1; then
        stopped=$(sed -E $'s/\x1b\\[[0-9;]*m//g' "$preflight" | grep -oE '[0-9]{4}_[0-9]{2}_[0-9]{2}_[0-9]{6}_[a-z0-9_]+' | tail -1)
        echo "test-db $driver: FAIL, the migrations stop at ${stopped:-an unknown migration}. No test was run. Log $preflight"
        exit 3
    fi
fi
```

Run, before any migration is edited:

```bash
time bin/test-db mariadb; echo "exit $?"
time bin/test-db sqlite; echo "exit $?"
bin/test-db pgsql -- tests/Feature/Database/ConnectionSettingsTest.php
```

Expected: MariaDB answers `FAIL, the migrations stop at 2026_10_01_100300_create_workspace_templates_table`, exit 3, in under a minute; SQLite answers `… stop at 2026_10_06_100000_create_game_tables`, exit 3; PostgreSQL passes, 7 tests. This is the red state the rest of the task turns green. If the name printed is not the failing migration (the output format of `migrate:fresh` differs), read the log and fix the `grep`, not the expectation.

Commit this step alone, so that every lane has it at once:

```bash
git add bin/test-db
git commit -m "test(database): bin/test-db stops before the suite when the schema does not migrate"
```

- [ ] **Step 2: Capture a PostgreSQL install as it is today, before any edit**

On a throw-away database, never the development one. No migration is edited yet.

```bash
pg() { docker exec -i skrum-pgsql-1 "$@"; }
pg psql -U sail -d postgres -c 'drop database if exists testing_l9_upgrade_base' -c 'create database testing_l9_upgrade_base'
docker exec -u sail -w "$TEST_DB_WORKDIR" -e DB_CONNECTION=pgsql -e DB_DATABASE=testing_l9_upgrade_base -e DB_URL= "$TEST_DB_CONTAINER" php artisan migrate --force
docker exec -u sail -w "$TEST_DB_WORKDIR" -e DB_CONNECTION=pgsql -e DB_DATABASE=testing_l9_upgrade_base -e DB_URL= "$TEST_DB_CONTAINER" php artisan tinker --execute '
$workspace = App\Models\Workspace::factory()->create();
$team = App\Models\Team::factory()->create(["workspace_id" => $workspace->id]);
$template = App\Models\WorkspaceTemplate::factory()->create(["workspace_id" => $workspace->id, "name" => "Sprint"]);
$twin = (array) DB::table("workspace_templates")->where("id", $template->id)->first();
DB::table("workspace_templates")->insert([...$twin, "id" => (string) Str::uuid7(), "name" => "Sprint "]);
App\Models\WhiteboardTemplate::factory()->create(["workspace_id" => $workspace->id, "name" => "Kick-off"]);
App\Models\SavedPokerDeck::factory()->create(["team_id" => $team->id, "name" => "Scale"]);
App\Models\SavedPokerDeck::factory()->forWorkspace($workspace)->create(["name" => "Scale"]);
App\Models\GameRound::factory()->create();
App\Models\GamePoint::factory()->count(3)->create();
App\Models\ActionItem::factory()->count(3)->create();
App\Models\Card::factory()->count(3)->create();
App\Models\WorkspaceInvitation::factory()->create(["workspace_id" => $workspace->id, "email" => "Ada@Example.test"]);
'
mkdir -p tests/Fixtures/pgsql
pg pg_dump -U sail --no-owner --no-privileges testing_l9_upgrade_base > tests/Fixtures/pgsql/before-portability.sql
pg psql -U sail -d postgres -c 'drop database testing_l9_upgrade_base'
```

Check: `grep -c "lower(" tests/Fixtures/pgsql/before-portability.sql` prints 4 (the expression indexes); `grep -c "'\[\]'::jsonb" …` prints 5; `grep -c " CHECK " …` prints 5; `grep -c "Sprint" …` prints at least 2. `Sprint` and `Sprint ` (trailing space) are the collision of Review Focus 2. The points, items and cards are rows the backfills of Tasks 5, 6 and 7 must fill.

- [ ] **Step 3: Write `bin/check-pg-upgrade`**

```bash
#!/usr/bin/env bash
#
# Proves that a PostgreSQL install from before the portability work, once migrated, has all its
# rows and the schema of a fresh install. One difference is expected and asserted: the five check
# constraints the old migrations added. The Schema builder cannot drop a check constraint, so
# existing installs keep them; a fresh install has none (docs/database.md, "Upgrading").
#
#   bin/check-pg-upgrade
#
# Inside Sail by default. From a git worktree: TEST_DB_CONTAINER and TEST_DB_WORKDIR as for
# bin/test-db, PG_CONTAINER (default skrum-pgsql-1). TEST_DB_ON_HOST=1 uses the host's PHP and
# 127.0.0.1; PG_EXEC is then the command that reaches psql and pg_dump (CI:
# `docker exec -i <postgres container>`). PG_USER is the database user (default sail).

set -euo pipefail

cd "$(dirname "$0")/.."

user="${PG_USER:-sail}"
base="${TEST_DB_DATABASE:-testing}"
old="${base}_upgrade_old"
fresh="${base}_upgrade_fresh"
fixture=tests/Fixtures/pgsql/before-portability.sql
legacy_checks="action_items_guest_assignee_needs_retro action_items_recurrence_needs_due_date action_items_single_assignee poker_decks_single_owner team_health_statements_builtin_or_custom"

if [ "${TEST_DB_ON_HOST:-0}" = 1 ]; then
    read -r -a pg <<< "${PG_EXEC:?Set PG_EXEC to the command that runs psql in the PostgreSQL container}"
    artisan() { DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_URL= DB_DATABASE="$1" php artisan "${@:2}"; }
elif [ -n "${TEST_DB_CONTAINER:-}" ]; then
    pg=(docker exec -i "${PG_CONTAINER:-skrum-pgsql-1}")
    artisan() { docker exec -u sail -w "${TEST_DB_WORKDIR:-/var/www/html}" -e DB_CONNECTION=pgsql -e DB_URL= -e DB_DATABASE="$1" "$TEST_DB_CONTAINER" php artisan "${@:2}"; }
else
    pg=(docker compose exec -T pgsql)
    artisan() { docker compose exec -T -u sail -e DB_CONNECTION=pgsql -e DB_URL= -e DB_DATABASE="$1" laravel.test php artisan "${@:2}"; }
fi

sql() { "${pg[@]}" psql -U "$user" -v ON_ERROR_STOP=1 -At -d "$1" -c "$2"; }

checks() { sql "$1" "select conname from pg_constraint where contype = 'c' order by conname" | tr '\n' ' ' | sed 's/ $//'; }

schema() {
    "${pg[@]}" pg_dump -U "$user" --schema-only --no-owner --no-privileges "$1" \
        | grep -vE '^(--|\\restrict|\\unrestrict|SET |SELECT pg_catalog)' \
        | grep -vE "CONSTRAINT (${legacy_checks// /|}) CHECK" \
        | sed -E 's/,$//' \
        | grep -vE '^$'
}

rows() {
    for table in workspace_templates whiteboard_templates poker_decks game_rounds game_points action_items cards workspace_invitations users workspaces teams; do
        echo "$table $(sql "$1" "select count(*) from $table")"
    done

    sql "$1" "select 'workspace_templates', id, name from workspace_templates order by id"
    sql "$1" "select 'whiteboard_templates', id, name from whiteboard_templates order by id"
    sql "$1" "select 'poker_decks', id, name from poker_decks order by id"
}

for database in "$old" "$fresh"; do
    sql postgres "drop database if exists $database"
    sql postgres "create database $database"
done

"${pg[@]}" psql -U "$user" -v ON_ERROR_STOP=1 -q -d "$old" < "$fixture" >/dev/null

before=$(rows "$old")

artisan "$old" migrate --force
artisan "$fresh" migrate --force

after=$(rows "$old")

status=0

if [ "$before" != "$after" ]; then
    echo "check-pg-upgrade: FAIL, rows changed:"
    diff <(echo "$before") <(echo "$after") || true
    status=1
fi

mkdir -p storage/logs

if ! diff <(schema "$old") <(schema "$fresh") > storage/logs/check-pg-upgrade.diff; then
    echo "check-pg-upgrade: FAIL, the upgraded schema differs from a fresh one (storage/logs/check-pg-upgrade.diff):"
    cat storage/logs/check-pg-upgrade.diff
    status=1
fi

if [ "$(checks "$old")" != "$legacy_checks" ] || [ -n "$(checks "$fresh")" ]; then
    echo "check-pg-upgrade: FAIL, check constraints: upgraded has [$(checks "$old")], fresh has [$(checks "$fresh")]; expected the five legacy ones and none."
    status=1
fi

for database in "$old" "$fresh"; do
    sql postgres "drop database $database"
done

if [ "$status" -eq 0 ]; then
    echo "check-pg-upgrade: PASS, every row is there, and the schemas are equal apart from the five legacy check constraints"
fi

exit "$status"
```

The script is tooling: it talks to `psql` and `pg_dump`, it is not application code and holds no query of the application.

Run: `chmod +x bin/check-pg-upgrade && bin/check-pg-upgrade`
Expected now, with nothing edited: the row check and the schema check pass (both databases are built by the same migrations) and the constraint check **fails** with "fresh has [the five names]". That failure is the red state of the constraint edit of Step 5. If the schema diff is not empty here, the script's filter is wrong: fix the filter, never by dropping a line that describes a table, a column or an index.

- [ ] **Step 4: Write the failing tests**

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

it('has no index that only one engine could build', function (string $table, string $index) {
    expect(Schema::hasIndex($table, $index))->toBeFalse();
})->with([
    ['workspace_templates', 'workspace_templates_workspace_name_unique'],
    ['whiteboard_templates', 'whiteboard_templates_workspace_name_unique'],
    ['poker_decks', 'poker_decks_team_name_unique'],
    ['poker_decks', 'poker_decks_workspace_name_unique'],
]);
```

The legacy backfill test moves out of `ActionItemModelTest.php` (it adds a column inside a test) and runs the real migration instead. Add to `phpunit.xml`, after the `Feature` testsuite:

```xml
        <testsuite name="Upgrade">
            <directory>tests/Upgrade</directory>
        </testsuite>
```

to `tests/Pest.php`, after the `Feature` block (and import `Illuminate\Foundation\Testing\DatabaseMigrations`):

```php
pest()->extend(TestCase::class)
    ->use(DatabaseMigrations::class)
    ->in('Upgrade');
```

`DatabaseMigrations` gives the test its own database in a parallel run and makes the next `RefreshDatabase` test of the process migrate afresh. Create `tests/Upgrade/LegacyActionItemsBackfillTest.php`:

```php
<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

function migrationsBefore(string $migration): array
{
    return collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < $migration)
        ->values()
        ->all();
}

it('backfills the new columns from legacy rows by running the migration itself', function () {
    $migration = '2026_10_02_100000_add_v2_columns_to_action_items_table.php';

    Artisan::call('migrate:fresh', ['--path' => migrationsBefore($migration), '--realpath' => true]);

    [$retro, $member, $guest, $done, $open] = legacyBoardWithTwoItems();

    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);

    $done = DB::table('action_items')->where('id', $done)->first();
    $open = DB::table('action_items')->where('id', $open)->first();

    expect($done->team_id)->toBe($retro->team_id)
        ->and(substr((string) $done->completed_at, 0, 19))->toBe('2026-09-01 10:00:00')
        ->and($done->assignee_user_id)->toBe($member->user_id)
        ->and($done->assignee_participant_id)->toBeNull()
        ->and($done->created_by_user_id)->toBe($member->user_id)
        ->and($open->team_id)->toBe($retro->team_id)
        ->and($open->completed_at)->toBeNull()
        ->and($open->assignee_participant_id)->toBe($guest->id)
        ->and($open->assignee_user_id)->toBeNull()
        ->and($open->created_by_user_id)->toBeNull();
});
```

`legacyBoardWithTwoItems()` is a function of the same file. It inserts, with `DB::table(…)->insert([...])` only (the factories describe today's tables, not the legacy ones): one workspace, one team, one user, one retro of the team, a member participant (`user_id` set) and a guest participant (`user_id` null), and two action items of the retro in the legacy shape: one `is_done` true, `updated_at` `2026-09-01 10:00:00`, created by and assigned to the member participant; one open, created by and assigned to the guest. It returns the retro and the two participants as objects (`DB::table(...)->where('id', …)->first()`) and the two item ids. To know the columns each legacy table requires, migrate a throw-away database to that point and read them:

```bash
docker exec -u sail -w "$TEST_DB_WORKDIR" -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: "$TEST_DB_CONTAINER" php artisan tinker --execute '
Artisan::call("migrate:fresh", ["--path" => collect(glob(database_path("migrations/*.php")))->filter(fn ($p) => basename($p) < "2026_10_02_100000")->values()->all(), "--realpath" => true]);
foreach (["workspaces", "teams", "users", "retros", "participants", "action_items"] as $t) { dump($t, collect(Schema::getColumns($t))->where("nullable", false)->pluck("type_name", "name")->all()); }
'
```

(this runs only once Step 5 has made the earlier migrations pass on SQLite; on PostgreSQL use a throw-away `testing_l9_legacy` database). If the helper grows past about sixty lines, stop and report: the alternative, deleting a test of a backfill that has already run on every install, needs the owner's approval.

In `tests/Feature/ActionItems/ActionItemModelTest.php` delete the first test (`it('backfills the new columns from legacy rows', …)`, lines 16-56) and the two imports it alone used (`Blueprint`, `Schema`). This is a move, not a deletion: the assertions are the ones above.

Run: `bin/test-db pgsql -- tests/Feature/Database/PortableSchemaTest.php tests/Upgrade`
Expected: FAIL. `PortableSchemaTest`: the defaults are `'[]'::jsonb` and the four indexes exist. The upgrade test may pass already on PostgreSQL (the migration is unchanged); it is the pin for Step 6.

- [ ] **Step 5: Edit the historic migrations: no raw statement, no expression, no driver branch**

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
and the same for `clue` and `drawing`. `GameRound::$attributes` (`app/Models/GameRound.php:55`) already sets the five. In the same file, `$table->timestamp('started_at');` becomes `$table->dateTime('started_at');`, and both `$table->timestamp('created_at');` (tables `game_points` and `game_used_words`) become `$table->dateTime('created_at');`.

One line each, `timestamp` to `dateTime`:

| File | Before | After |
|---|---|---|
| `2026_09_29_110028_create_workspace_invitations_table.php` | `$table->timestamp('expires_at');` | `$table->dateTime('expires_at');` |
| `2026_10_02_100500_create_action_item_reminders_table.php` | `$table->timestamp('sent_at');` | `$table->dateTime('sent_at');` |
| `2026_10_05_100000_create_integration_tables.php` | `$table->timestamp('checked_at');` | `$table->dateTime('checked_at');` |
| `2026_10_07_100000_extend_integration_tables_for_sync_and_channels.php` | `$table->timestamp('received_at');` | `$table->dateTime('received_at');` |

`2026_10_08_100000_create_integration_delivery_payloads_table.php`: the four `$table->text(...)` lines become `$table->longText('message');`, `$table->longText('request_headers')->nullable();`, `$table->longText('request_body')->nullable();`, `$table->longText('response_excerpt')->nullable();`.

The six files with raw statements lose them entirely, with the `DB` import where nothing else uses it:

| File | Delete |
|---|---|
| `2026_10_01_100300_create_workspace_templates_table.php` | the `DB::statement('create unique index …')` line; the `DB` import |
| `2026_10_03_100100_create_poker_decks_table.php` | from `if (DB::getDriverName() !== 'pgsql') {` to the `DB::statement(...)` line included; the `DB` import |
| `2026_10_10_100000_create_whiteboard_templates_table.php` | the same block; the `DB` import |
| `2026_10_01_110000_create_team_health_statements_table.php` | the driver test and the `DB::statement(<<<'SQL' … SQL);` block; the `DB` import |
| `2026_10_15_100000_add_workspace_to_poker_decks_table.php` | everything after the `Schema::table(...)` call (the driver test, the check constraint, the partial index); the `DB` import |
| `2026_10_02_100000_add_v2_columns_to_action_items_table.php` | the `$this->addChecks();` call and the whole `addChecks()` method. `DB` stays: `backfill()` uses `DB::table()` |

The names become unique again in Task 4 (`name_key`); the five rules are enforced by the models in Task 9.

- [ ] **Step 6: Rewrite the legacy backfill with the query builder**

In `2026_10_02_100000_add_v2_columns_to_action_items_table.php`, replace the body of `backfill()`:

```php
    public function backfill(): void
    {
        DB::table('retros')->select(['id', 'team_id'])->orderBy('id')->lazyById(500)->each(
            fn (object $retro) => DB::table('action_items')->where('retro_id', $retro->id)->update(['team_id' => $retro->team_id]),
        );

        DB::table('action_items')->where('is_done', true)->select(['id', 'updated_at'])->orderBy('id')->lazyById(500)->each(
            fn (object $item) => DB::table('action_items')->where('id', $item->id)->update(['completed_at' => $item->updated_at]),
        );

        DB::table('participants')->whereNotNull('user_id')->select(['id', 'user_id'])->orderBy('id')->lazyById(500)->each(function (object $participant): void {
            DB::table('action_items')
                ->where('created_by_participant_id', $participant->id)
                ->whereNull('created_by_user_id')
                ->update(['created_by_user_id' => $participant->user_id]);

            DB::table('action_items')
                ->where('assignee_participant_id', $participant->id)
                ->update(['assignee_user_id' => $participant->user_id, 'assignee_participant_id' => null]);
        });
    }
```

The docblock "Public so a test can run it…" goes (the test now runs the migration); make the method `private`. The second loop filters on the column it does not change, so `lazyById` is safe.

Run: `bin/test-db pgsql -- tests/Upgrade`. Expected: PASS.

- [ ] **Step 7: Bring existing installs to the same schema**

Run `art make:migration drop_json_defaults_from_game_rounds --no-interaction`, rename the file to `2026_10_19_100000_drop_json_defaults_from_game_rounds.php`, and write:

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

- [ ] **Step 8: Run on PostgreSQL, then the upgrade proof**

Run: `bin/test-db pgsql -- tests/Feature/Database tests/Upgrade tests/Feature/ActionItems/ActionItemModelTest.php`
Expected: `PortableSchemaTest` (8 tests), `ConnectionSettingsTest` and the upgrade test pass. In `ActionItemModelTest`, the three tests "refuses …" at the old lines 104-127 now fail on PostgreSQL (no constraint, no model guard yet): expected, Task 9 owns them; name them in the baseline file. The same for `HealthStatementModelsTest:60` and `WorkspacePokerDecksTest:260`.

Run: `bin/check-pg-upgrade`
Expected at this task: rows unchanged; constraints as expected (five on the upgraded database, none on the fresh one); the schema diff shows **only** the four old expression indexes, present in the upgraded database and absent from the fresh one (Task 4 drops them). Any other line means an edit of Step 5 changed PostgreSQL: undo that edit. Copy the diff into the task report.

- [ ] **Step 9: Migrate on the three other engines, one directory at a time**

```bash
bin/test-db sqlite -- tests/Feature/Database tests/Upgrade
bin/test-db mariadb -- tests/Feature/Database tests/Upgrade
bin/test-db mysql -- tests/Feature/Database tests/Upgrade
```

Expected: the preflight passes on the three (the first time the schema exists on them), and `PortableSchemaTest`, `ConnectionSettingsTest` and the upgrade test pass. If the preflight still stops, it names the migration: read the statement in `storage/logs/test-db/<driver>-migrate.log`. The causes left are a `change()` MariaDB refuses, or an index name over 64 characters on MySQL; fix it with the Schema builder (a shorter explicit index name), never with a driver test; if neither applies, stop.

Only when the three preflights pass is a whole suite run on these engines (Step 11).

- [ ] **Step 10: Lower the baseline**

Delete from `tests/Arch/database-portability-baseline.txt` the 21 lines that start with `database/migrations/` and the line `tests/Feature/ActionItems/ActionItemModelTest.php|ddl in a test|1`.

Run: `bin/test-db pgsql -- tests/Arch`
Expected: PASS. "lists nothing that is no longer there" names any line left too high; "adds no raw query…" names anything the edits introduced (`DB::table` is not on the list; `DB::raw` is).

- [ ] **Step 11: The task's closing run, the first with numbers on every engine**

Run `bin/test-db pgsql`, `bin/test-db sqlite`, `bin/test-db mariadb`, `bin/test-db mysql`, one after the other.
Expected: PostgreSQL green **except** the tests that asserted what this task removed and later tasks restore: the name uniqueness tests (`WhiteboardTemplatesTest` "keeps the name unique in the database too", deck and template duplicates: Task 4) and the five rule tests (Task 9). List them in the baseline file. On SQLite, MariaDB and MySQL, expect many failures; this is the first real baseline. For each, write the summary line and the failing files grouped by the first line of their error (`sed -E $'s/\x1b\\[[0-9;]*m//g' storage/logs/test-db/sqlite.log | grep -E "FAIL|Error|Exception" | sort | uniq -c | sort -rn | head -40`).

- [ ] **Step 12: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add database/migrations bin/check-pg-upgrade tests/Fixtures/pgsql/before-portability.sql tests/Feature/Database/PortableSchemaTest.php tests/Upgrade tests/Pest.php phpunit.xml tests/Feature/ActionItems/ActionItemModelTest.php tests/Arch/database-portability-baseline.txt docs/superpowers/research/database-portability-baseline.md
git commit -m "feat(database): the migrations use the Schema builder only and run on SQLite, MariaDB and MySQL"
```

---

## Task 4: Names are unique through a stored key

From revision 1, unchanged in design (it was already Schema builder and query builder only). Changed: the baseline step, and what the upgrade proof expects.

**Files:**
- Create: `app/Support/Database/NameKey.php`, `database/migrations/2026_10_19_100100_add_name_keys_to_named_tables.php`, `tests/Unit/Support/Database/NameKeyTest.php`, `tests/Feature/Database/NameKeysTest.php`, `tests/Feature/Database/NameKeysMigrationTest.php`
- Modify: `app/Models/WorkspaceTemplate.php`, `app/Models/WhiteboardTemplate.php`, `app/Models/SavedPokerDeck.php`, `app/Http/Requests/WorkspaceTemplateRequest.php:100-109`, `app/Actions/Poker/SavedPokerDeckRules.php:31-34`, `app/Actions/Whiteboards/WhiteboardTemplateRules.php:26-31`, `app/Http/Controllers/PokerDeckDuplicatesController.php:37-52`, `tests/Feature/Whiteboards/WhiteboardTemplatesTest.php:144-158`, the baseline file

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

Run `art make:migration add_name_keys_to_named_tables --no-interaction`, rename to `2026_10_19_100100_add_name_keys_to_named_tables.php`:

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
Expected: PASS: the four expression indexes are gone from the upgraded database (dropped with `dropIndex` where `Schema::hasIndex` found them), the four key indexes are in both, and the only difference left is the five legacy check constraints the script expects. The row list is unchanged: `Sprint` and `Sprint ` are both there. Then check the collision was handled:

```bash
grep -c "share a name once case and spaces are ignored" storage/logs/laravel.log
```

Expected: at least 1 (the fixture's twin). If the log is on another channel in Sail, read `docker compose logs laravel.test | grep "share a name"`.

- [ ] **Step 10: Lower the baseline**

Delete from `tests/Arch/database-portability-baseline.txt` the three lines `app/Http/Requests/WorkspaceTemplateRequest.php|whereRaw|1`, `app/Actions/Poker/SavedPokerDeckRules.php|whereRaw|1` and `app/Actions/Whiteboards/WhiteboardTemplateRules.php|whereRaw|1`. Run `bin/test-db pgsql -- tests/Arch`. Expected: PASS.

- [ ] **Step 11: The task's closing run**

As defined in **Running the suite**. Expected: on PostgreSQL the name tests Task 3 left red pass again; the five rule tests stay red until Task 9. Record the three lines.

- [ ] **Step 12: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Support/Database/NameKey.php app/Models/WorkspaceTemplate.php app/Models/WhiteboardTemplate.php app/Models/SavedPokerDeck.php app/Http/Controllers/PokerDeckDuplicatesController.php app/Http/Requests/WorkspaceTemplateRequest.php app/Actions/Poker/SavedPokerDeckRules.php app/Actions/Whiteboards/WhiteboardTemplateRules.php database/migrations/2026_10_19_100100_add_name_keys_to_named_tables.php tests/Unit/Support/Database/NameKeyTest.php tests/Feature/Database/NameKeysTest.php tests/Feature/Database/NameKeysMigrationTest.php tests/Feature/Whiteboards/WhiteboardTemplatesTest.php tests/Arch/database-portability-baseline.txt docs/superpowers/research/database-portability-baseline.md
git commit -m "feat(database): template and deck names are unique through a stored key, on every engine"
```

---

## Task 5: Aggregates and writes through Eloquent

Every `selectRaw`, `groupByRaw`, `DB::raw` and `insertOrIgnore` of `app/` except the action-item list (Task 6), the name lookups (Task 4), the search (Task 7) and the two `lower()` sorts (Task 8). Design and bounds: spec §6.4.1.

**Files:**
- Create: `app/Models/GameUsedWord.php`, `database/migrations/2026_10_19_100400_add_week_start_to_game_points.php`, `tests/Feature/Database/EloquentAggregatesTest.php`, `tests/Feature/Database/WeekStartTest.php`
- Modify: `app/Models/Retro.php`, `app/Models/GamePlayer.php`, `app/Models/GamePoint.php`, `app/Models/User.php`, `app/Models/RetroHealthStatement.php`, `app/Models/Participant.php`, `app/Mcp/Presenters/McpMessage.php:45-53`, `app/Actions/Retros/BuildBoardSnapshot.php:245-259`, `app/Actions/Retros/BuildSummaryInput.php:152-155,258-275`, `app/Http/Controllers/WorkspaceTemplatesController.php:123-143`, `app/Http/Controllers/PokerDecksController.php:54-67`, `app/Actions/HealthCheck/SummarizeHealthCheck.php:36-41,109-116`, `app/Actions/HealthCheck/BuildHealthTrend.php:106-128`, `app/Actions/Teams/BuildTeamMoodTrend.php:31-62`, `app/Actions/Retros/SummarizeRoti.php:18-23`, `app/Actions/Retros/TopTeamTemplates.php:28-54`, `app/Actions/Games/RoomLeaderboard.php:24-49`, `app/Actions/Games/TeamGameLeaderboard.php:40-72`, `app/Actions/Games/GameStreaks.php:21-40`, `app/Actions/Games/DrawGameWord.php`, `app/Actions/Integrations/TrackedIssues.php:34,53,130-145`, `app/Actions/ActionItems/SendActionItemReminders.php:79-84,102-112`, `app/Actions/Surveys/CloseOpenSurveys.php:12-15`, `app/Http/Controllers/Games/GameHostsController.php:31`, `app/Http/Controllers/Games/GameRoundsController.php:33`; the baseline file

**Interfaces:**
- Produces: `Retro::voteCountsByCard(?Participant $voter = null): Collection<string, int>`; relations `GamePlayer::points()`, `User::gamePoints()`, `RetroHealthStatement::answers()`, `Participant::healthCheckAnswers()` (create the last only if it does not exist); model `GameUsedWord`; column `game_points.week_start` (`date`, not null, index `game_points_team_id_user_id_week_start_index`), set by `GamePoint::creating`.
- The safety net is the existing feature tests of each site: they pass on PostgreSQL before the change and must pass after it, unchanged. A test that counted queries may need its number changed; name each in the report.

- [ ] **Step 1: Write the failing tests of what is new**

`tests/Feature/Database/EloquentAggregatesTest.php`:

```php
<?php

use App\Models\Card;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameUsedWord;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\Vote;
use Illuminate\Support\Facades\DB;

it('counts the votes of each card of a retro, and those of one participant', function () {
    $retro = Retro::factory()->create();
    [$first, $second, $silent] = Card::factory()->count(3)->create(['retro_id' => $retro->id]);
    $ada = Participant::factory()->create(['retro_id' => $retro->id]);
    $bob = Participant::factory()->create(['retro_id' => $retro->id]);

    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $first->id, 'participant_id' => $ada->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $first->id, 'participant_id' => $bob->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $second->id, 'participant_id' => $bob->id]);

    expect($retro->voteCountsByCard()->all())->toEqualCanonicalizing([$first->id => 3, $second->id => 1])
        ->and($retro->voteCountsByCard($ada)->all())->toBe([$first->id => 2])
        ->and($retro->voteCountsByCard()->has($silent->id))->toBeFalse();
});

it('counts the votes of a retro with one query however many cards voted', function () {
    $retro = Retro::factory()->create();
    Card::factory()->count(5)->create(['retro_id' => $retro->id])
        ->each(fn (Card $card) => Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]));

    DB::enableQueryLog();
    $retro->voteCountsByCard();

    expect(DB::getQueryLog())->toHaveCount(1);
});

it('sums the points, wins and rounds of a player through its relation', function () {
    $player = GamePlayer::factory()->create();
    GamePoint::factory()->create(['game_room_id' => $player->game_room_id, 'player_id' => $player->id, 'points' => 3, 'is_win' => true]);
    GamePoint::factory()->create(['game_room_id' => $player->game_room_id, 'player_id' => $player->id, 'points' => 2, 'is_win' => false]);

    $read = GamePlayer::query()->whereKey($player->id)
        ->withSum('points as total_points', 'points')
        ->withCount(['points as wins' => fn ($points) => $points->where('is_win', true), 'points as rounds_played'])
        ->sole();

    expect((int) $read->total_points)->toBe(5)
        ->and((int) $read->wins)->toBe(1)
        ->and((int) $read->rounds_played)->toBe(2);
});

it('records a used word once, whoever asks twice', function () {
    $team = Team::factory()->create();
    $key = ['team_id' => $team->id, 'locale' => 'fr', 'word' => 'pêche'];

    GameUsedWord::query()->firstOrCreate($key);
    DB::transaction(fn () => GameUsedWord::query()->createOrFirst($key));

    expect(GameUsedWord::query()->where($key)->count())->toBe(1);
});
```

If `Vote::factory()` or `GamePoint::factory()` need other keys, read the factory and adapt the arrange lines; the assertions stay.

`tests/Feature/Database/WeekStartTest.php`:

```php
<?php

use App\Actions\Games\GameStreaks;
use App\Models\GamePoint;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

it('stores the monday of the week a points row was created in', function (string $createdAt, string $monday) {
    $this->travelTo(CarbonImmutable::parse($createdAt, 'UTC'));

    $point = GamePoint::factory()->create();

    expect(substr((string) DB::table('game_points')->where('id', $point->id)->value('week_start'), 0, 10))->toBe($monday);
})->with([
    'a wednesday' => ['2026-10-07 12:00:00', '2026-10-05'],
    'a monday at midnight' => ['2026-10-05 00:00:00', '2026-10-05'],
    'a sunday at the last second' => ['2026-10-11 23:59:59', '2026-10-05'],
]);

it('has the index the streak reads', function () {
    expect(Schema::hasIndex('game_points', ['team_id', 'user_id', 'week_start']))->toBeTrue();
});

it('counts consecutive weeks from the stored week, reading one row per week', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create();

    foreach (['2026-09-22', '2026-09-29', '2026-09-30', '2026-10-06'] as $day) {
        $this->travelTo(CarbonImmutable::parse("{$day} 10:00:00", 'UTC'));
        GamePoint::factory()->create(['team_id' => $team->id, 'user_id' => $user->id]);
    }

    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00:00', 'UTC'));

    expect(resolve(GameStreaks::class)->forUsers($team, [$user->id]))->toBe([$user->id => 3]);
});
```

Run: `bin/test-db pgsql -- tests/Feature/Database/EloquentAggregatesTest.php tests/Feature/Database/WeekStartTest.php`
Expected: FAIL: the method, the relations, the model and the column do not exist.

Before changing any site, run the existing tests of the sites on PostgreSQL and keep the summary line: `bin/test-db pgsql -- tests/Feature/Retros tests/Feature/Mcp tests/Feature/Poker tests/Feature/Games tests/Feature/Teams tests/Feature/HealthCheck tests/Feature/Integrations tests/Feature/ActionItems tests/Feature/Surveys tests/Feature/Workspaces` (drop a path that does not exist). It must be the same line after Step 6.

- [ ] **Step 2: The relations, the method and the model**

`app/Models/Retro.php` (imports `App\Models\Participant` is in the same namespace; `Illuminate\Database\Eloquent\Builder`, `Illuminate\Support\Collection`):

```php
    /**
     * Cards without a vote are absent. Counted in SQL through the relation.
     *
     * @return Collection<string, int>
     */
    public function voteCountsByCard(?Participant $voter = null): Collection
    {
        $cast = fn (Builder $votes): Builder => $votes->when($voter !== null, fn (Builder $own) => $own->where('participant_id', $voter?->id));

        return $this->cards()
            ->select('id')
            ->whereHas('votes', $cast)
            ->withCount(['votes' => $cast])
            ->get()
            ->mapWithKeys(fn (Card $card): array => [$card->id => (int) $card->votes_count])
            ->toBase();
    }
```

`app/Models/GamePlayer.php`:

```php
    /** @return HasMany<GamePoint, $this> */
    public function points(): HasMany
    {
        return $this->hasMany(GamePoint::class, 'player_id');
    }
```

`app/Models/User.php`:

```php
    /** @return HasMany<GamePoint, $this> */
    public function gamePoints(): HasMany
    {
        return $this->hasMany(GamePoint::class);
    }
```

`app/Models/RetroHealthStatement.php`:

```php
    /**
     * Answers name their statement by its key, in any retro: constrain the retro where this is read
     * (BuildHealthTrend does, with a whereColumn on the two retro ids).
     *
     * @return HasMany<HealthCheckAnswer, $this>
     */
    public function answers(): HasMany
    {
        return $this->hasMany(HealthCheckAnswer::class, 'statement', 'key');
    }
```

`app/Models/Participant.php`, only if `grep -n "function healthCheckAnswers" app/Models/Participant.php` finds nothing:

```php
    /** @return HasMany<HealthCheckAnswer, $this> */
    public function healthCheckAnswers(): HasMany
    {
        return $this->hasMany(HealthCheckAnswer::class);
    }
```

`art make:model GameUsedWord --no-interaction`, then:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $team_id
 * @property string $locale
 * @property string $word
 */
class GameUsedWord extends Model
{
    public const UPDATED_AT = null;

    public $incrementing = false;

    protected $primaryKey = null;
}
```

The table's key is `(team_id, locale, word)`; Eloquent only inserts, reads and mass-deletes these rows, never updates or deletes one by key. Mass assignment: follow what `GamePoint` does (read it: the project sets fillable or unguards in one way; do the same). If an Arch or feature test requires every model to use `HasUuids` or a factory, read its message and stop: the alternative is `DB::table('game_used_words')->where($key)->exists()` followed by `insert` inside `DB::transaction`, catching `UniqueConstraintViolationException`, which is builder-only too.

- [ ] **Step 3: The votes of a retro (four sites)**

`McpMessage::countVotes()`:

```php
        return $retro->voteCountsByCard()->all();
```

`BuildBoardSnapshot::readVotes()` keeps its transaction and its shared lock; the two grouped queries become:

```php
            $retro->voteCountsByCard(),
            $retro->voteCountsByCard($viewer),
```

`BuildSummaryInput::cardsWithinBudget()`: `$voteTotals = $retro->voteCountsByCard();`.

Run: `bin/test-db pgsql -- tests/Feature/Retros tests/Feature/Mcp`. Expected: PASS. A test that counts the queries of the board snapshot must keep its number (two grouped queries became two relation queries); if it rises, read the SQL with `DB::enableQueryLog()` and stop if the cause is not obvious. Review Focus 7: note in the report the time of `BuildBoardSnapshot` on a retro of 60 cards and 300 votes before and after (`Benchmark::measure` in `tinker` on the test database), on PostgreSQL.

- [ ] **Step 4: Usage counts, ROTI, health check, templates**

`WorkspaceTemplatesController::pokerDecks()`:

```php
        $canManage = $user->canManage($workspace);
        $visibleTeamIds = $workspace->teamsVisibleTo($user)->modelKeys();

        return $workspace->pokerDecks()
            ->withCount(['games as usage_count' => fn (Builder $games) => $games->whereIn('team_id', $visibleTeamIds)])
            ->orderBy('name')
            ->orderBy('id')
            ->get()
            ->map(fn (SavedPokerDeck $deck): array => [
                'id' => $deck->id,
                'name' => $deck->name,
                'cards' => $deck->cards,
                'usageCount' => (int) $deck->usage_count,
                'canManage' => $canManage,
            ])
            ->all();
```

`PokerDecksController::builtInDecks()`: delete the `$gamesPerDeck` query; in the `array_map`:

```php
            'usageCount' => $team->pokerGames()->where('deck', $deck->value)->count(),
```

(four built-in decks, four count queries, no row loaded).

`SummarizeRoti::handle()`:

```php
        $totals = $retro->rotiVotes()->pluck('score')
            ->countBy()
            ->mapWithKeys(fn (int $total, int|string $score): array => [(int) $score => $total]);
```

`BuildSummaryInput::roti()`:

```php
        $scores = $retro->rotiVotes()->pluck('score');

        if ($scores->isEmpty()) {
            return null;
        }
```

then `'respondents' => $scores->count()` and the average from `(float) $scores->avg()` where `$aggregate->getAttribute('average')` was read. Bound: one integer per participant of the retro.

`SummarizeHealthCheck::handle()`:

```php
        $totals = $retro->healthCheckAnswers()
            ->get(['statement', 'score'])
            ->groupBy('statement')
            ->map(fn (Collection $answers): object => (object) [
                'answers' => $answers->count(),
                'total' => $answers->sum('score'),
                'squares' => $answers->sum(fn (HealthCheckAnswer $answer): int => $answer->score ** 2),
            ]);
```

and in `previousAverages()`:

```php
        return $previous->healthCheckAnswers()
            ->get(['statement', 'score'])
            ->groupBy('statement')
            ->map(fn (Collection $answers): float => round((float) $answers->avg('score'), 1))
            ->all();
```

Bound: participants × statements of one retro; the sum of squares has no builder form.

`BuildHealthTrend::scoresWithKeys()`:

```php
        $sameRetro = fn (Builder $answers): Builder => $answers->whereColumn(
            $answers->qualifyColumn('retro_id'),
            (new RetroHealthStatement)->qualifyColumn('retro_id'),
        );

        $statementsByRetro = RetroHealthStatement::query()
            ->whereIn('retro_id', $retroIds)
            ->withCount(['answers' => $sameRetro])
            ->withSum(['answers' => $sameRetro], 'score')
            ->get()
            ->groupBy('retro_id');

        return $retroIds->mapWithKeys(function (string $retroId) use ($statementsByRetro): array {
            $averages = collect($statementsByRetro->get($retroId, []))
                ->filter(fn (RetroHealthStatement $statement): bool => (int) $statement->answers_count > 0)
                ->map(fn (RetroHealthStatement $statement): float => round((float) $statement->answers_sum_score / (int) $statement->answers_count, 1))
                ->values()
                ->all();

            return [$retroId => SummarizeHealthCheck::scoreOf($averages)];
        });
```

The `$keysByRetro` parameter is no longer needed by this method (a statement row is a frozen key by construction); keep `statementKeysByRetro()` for `handle()`, which still compares the key sets. **Before deleting the old query**, add a temporary assertion in a test that both give the same scores on a retro with three statements, two participants and one answer to a key that is not frozen; run it on PostgreSQL; then delete the old query and the temporary assertion. If they differ, stop.

`BuildTeamMoodTrend::handle()`: delete the `$voters` query; add to the retro query `->withCount(['participants as mood_voters_count' => fn (Builder $participants) => $participants->whereHas('healthCheckAnswers')])` (before `->orderByDesc`), and read `(int) $retro->mood_voters_count` where `$voters->get($retro->id, 0)` was. First check that an answer's participant belongs to the answer's retro: read the migration that creates `health_check_answers` and the code that writes one. If an answer can name a participant of another retro, stop.

`TopTeamTemplates::usedKeys()` (decision D11, a window of the 100 latest retros):

```php
    private const int Window = 100;
```

```php
        $keys = Retro::query()
            ->where('team_id', $team->id)
            ->where('template', '!=', TemplateCatalogue::Custom)
            ->latest()
            ->orderByDesc('id')
            ->limit(self::Window)
            ->get(['template', 'workspace_template_id', 'created_at'])
            ->groupBy(fn (Retro $retro): string => "{$retro->template}|{$retro->workspace_template_id}")
            ->map(fn (Collection $uses): array => ['retro' => $uses->first(), 'uses' => $uses->count(), 'lastUsedAt' => $uses->max('created_at')])
            ->sort(fn (array $first, array $second): int => [$second['uses'], $second['lastUsedAt']] <=> [$first['uses'], $first['lastUsedAt']])
            ->map(function (array $group) use ($workspaceTemplateIds): ?string {
                $row = $group['retro'];
```

(the body of the old `map` closure follows unchanged, reading `$row`). Change the class docblock or add one line saying the count is over the latest hundred retros.

Run: `bin/test-db pgsql -- tests/Feature/Retros tests/Feature/Teams tests/Feature/HealthCheck tests/Feature/Poker tests/Feature/Workspaces`. Expected: PASS.

- [ ] **Step 5: Leaderboards and streaks**

Migration: `art make:migration add_week_start_to_game_points --no-interaction`, renamed `2026_10_19_100400_add_week_start_to_game_points.php`:

```php
<?php

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The Monday (UTC) of the week a row was created in, stored so that streaks group by a plain column.
     */
    public function up(): void
    {
        Schema::table('game_points', function (Blueprint $table): void {
            $table->date('week_start')->nullable();
        });

        DB::table('game_points')->select(['id', 'created_at'])->orderBy('id')->lazyById(500)->each(
            fn (object $point) => DB::table('game_points')->where('id', $point->id)->update([
                'week_start' => CarbonImmutable::parse((string) $point->created_at, 'UTC')->startOfWeek(CarbonInterface::MONDAY)->toDateString(),
            ]),
        );

        Schema::table('game_points', function (Blueprint $table): void {
            $table->date('week_start')->nullable(false)->change();
            $table->index(['team_id', 'user_id', 'week_start']);
        });
    }
};
```

`app/Models/GamePoint.php` (add `@property string $week_start` to the docblock; no cast: the value is the ten characters `Y-m-d` on every engine):

```php
    protected static function booted(): void
    {
        static::creating(function (GamePoint $point): void {
            $point->created_at ??= $point->freshTimestamp();
            $point->week_start = CarbonImmutable::parse($point->created_at)->utc()->startOfWeek(CarbonInterface::MONDAY)->toDateString();
        });
    }
```

Grep for writes that bypass the model: `grep -rn "game_points" app database/seeders | grep -v "Models/GamePoint"`. Today: none (`AwardRoundPoints.php:44` uses `GamePoint::query()->create`).

`GameStreaks::forUsers()`, the query:

```php
        $weeks = GamePoint::query()
            ->where('team_id', $team->id)
            ->whereIn('user_id', $userIds)
            ->select(['user_id', 'week_start'])
            ->distinct()
            ->toBase()
            ->get()
            ->groupBy('user_id')
            ->map(fn ($rows): array => $rows
                ->map(fn (object $row): string => substr((string) $row->week_start, 0, 10))
                ->all());
```

and the class docblock: "Read as one row per user and week played, from the stored week."

`RoomLeaderboard::handle()`, from `$rows =` to the `->map(`:

```php
        $since = fn (Builder $points): Builder => $points->when($resetAt !== null, fn (Builder $recent) => $recent->where('created_at', '>', $resetAt));

        return $room->players()
            ->whereHas('points', $since)
            ->withSum(['points as total_points' => $since], 'points')
            ->withCount(['points as wins' => fn (Builder $points) => $since($points)->where('is_win', true), 'points as rounds_played' => $since])
            ->get()
            ->map(fn (GamePlayer $player): array => [
                'playerId' => $player->id,
                'points' => (int) $player->total_points,
                'wins' => (int) $player->wins,
                'roundsPlayed' => (int) $player->rounds_played,
            ])
```

(the existing `->sort(...)->values()->all()` follows). The class docblock: "one query over the players, each with the sums of its points rows".

`TeamGameLeaderboard::handle()`, whole body:

```php
        $since = $period === '30d' ? now()->subDays(30) : null;
        $inScope = fn (Builder $points): Builder => $points
            ->where('team_id', $team->id)
            ->when($since !== null, fn (Builder $recent) => $recent->where('created_at', '>=', $since));

        $members = $team->members()
            ->whereHas('gamePoints', $inScope)
            ->withSum(['gamePoints as total_points' => $inScope], 'points')
            ->withCount(['gamePoints as wins' => fn (Builder $points) => $inScope($points)->where('is_win', true), 'gamePoints as rounds_played' => $inScope])
            ->get()
            ->sort(fn (User $first, User $second): int => [(int) $second->total_points, (int) $second->wins, $first->name, $first->id]
                <=> [(int) $first->total_points, (int) $first->wins, $second->name, $second->id])
            ->take(self::Size)
            ->values();

        $streaks = $this->gameStreaks->forUsers($team, $members->modelKeys());

        return $members
            ->map(fn (User $member): array => [
                'userId' => $member->id,
                'name' => $member->name,
                'avatarUrl' => $member->avatarUrl(),
                'points' => (int) $member->total_points,
                'wins' => (int) $member->wins,
                'roundsPlayed' => (int) $member->rounds_played,
                'streak' => $streaks[$member->id] ?? 0,
            ])
            ->all();
```

`Builder` is `Illuminate\Database\Eloquent\Builder` in both files. Bound: the members of one team who scored in the period; summed in SQL, sorted in PHP so that the twenty are the same on every engine. Task 8 replaces `$first->name` by its alphabetical key.

Run: `bin/test-db pgsql -- tests/Feature/Games tests/Feature/Database/WeekStartTest.php tests/Feature/Database/EloquentAggregatesTest.php`. Expected: PASS.

- [ ] **Step 6: The remaining raw calls**

`TrackedIssues::links()` and `tasks()`: `->when($site === null, fn (Builder $none) => $none->whereKey([]))`.

`TrackedIssues::externalIds()`: delete the `if ($repositoryIds !== []) { $query->where(function …) }` block; the loop becomes

```php
            $prefixes = array_map(fn (string $repositoryId): string => "{$repositoryId}/", $repositoryIds);

            foreach ($query->pluck('external_id') as $id) {
                if (! is_string($id) || $id === '') {
                    continue;
                }

                if ($prefixes !== [] && ! Str::startsWith($id, $prefixes)) {
                    continue;
                }

                $found[$id] = true;
            }
```

(keep whatever the loop did after `$found[$id] = true`; compute `$prefixes` once before the outer loop). Bound: the tracked links and tasks of one integration, which the method already loads when no repository is given.

`SendActionItemReminders::dueItems()`: delete the line `->select(DB::raw(1))`.

`SendActionItemReminders::log()`:

```php
        return ActionItemReminder::query()->createOrFirst(
            [
                'action_item_id' => $item->id,
                'user_id' => $user->id,
                'kind' => $this->kind($item, $today),
                'due_on' => (string) $item->due_on?->toDateString(),
            ],
            ['sent_at' => now()],
        )->wasRecentlyCreated;
```

Read `ActionItemReminder`: the table has no `created_at` / `updated_at`, so the model needs `public $timestamps = false;` if it does not have it; `HasUuids` gives the id. On SQLite the lookup after a collision matches only once `due_on` is stored as ten characters (`DateOnly`, Task 9): the reminder tests are asserted on SQLite there, on PostgreSQL here.

`DrawGameWord`: `history()` returns `GameUsedWord::query()->where('team_id', $room->team_id)->where('locale', $room->locale)` (return type `Illuminate\Database\Eloquent\Builder`), and the insert becomes

```php
        GameUsedWord::query()->firstOrCreate(['team_id' => $room->team_id, 'locale' => $room->locale, 'word' => $word]);
```

`CloseOpenSurveys::handle()`:

```php
        $locked->surveys()->where('is_closed', false)->increment('version', 1, ['is_closed' => true]);
```

`GameHostsController.php:31` and `GameRoundsController.php:33`: add `'uuid'` to the rules of the id that reaches an `exists` query (a malformed id is a 500 on PostgreSQL only); add one test each: a non-UUID id answers 422.

Remove imports that became unused (`DB`, `Str`, `stdClass`, `Illuminate\Database\Query\Builder`).

- [ ] **Step 7: Run on three engines, one directory at a time**

Run the command of Step 1 on `pgsql`: the same summary line as before the change, plus the new tests. Then `bin/test-db sqlite -- tests/Feature/Database tests/Feature/Games tests/Feature/Retros` and the same on `mariadb`.
Expected: the new tests pass on the three. Other files may still fail off PostgreSQL for reasons of later tasks; none may fail on a query of this task (`SQLSTATE` naming `filter`, `date_trunc`, `is_win`, an alias).

- [ ] **Step 8: Lower the baseline, closing run, commit**

Delete these 23 lines from `tests/Arch/database-portability-baseline.txt`: every line of `SendActionItemReminders.php` (2), `DrawGameWord.php`, `GameStreaks.php` (3), `RoomLeaderboard.php`, `TeamGameLeaderboard.php` (2), `BuildHealthTrend.php`, `SummarizeHealthCheck.php`, `TrackedIssues.php` (3), `BuildBoardSnapshot.php`, `BuildSummaryInput.php|selectRaw|2`, `SummarizeRoti.php`, `TopTeamTemplates.php`, `CloseOpenSurveys.php`, `BuildTeamMoodTrend.php`, `PokerDecksController.php`, `WorkspaceTemplatesController.php`, `McpMessage.php`. `BuildSummaryInput.php|orderByRaw|1` stays for Task 8.

`bin/test-db pgsql -- tests/Arch`: PASS. Then the task's closing run.

```bash
vendor/bin/pint --dirty --format agent
git status --short
git add app/Models app/Mcp/Presenters/McpMessage.php app/Actions/Retros app/Actions/HealthCheck app/Actions/Teams/BuildTeamMoodTrend.php app/Actions/Games app/Actions/Integrations/TrackedIssues.php app/Actions/ActionItems/SendActionItemReminders.php app/Actions/Surveys/CloseOpenSurveys.php app/Http/Controllers/WorkspaceTemplatesController.php app/Http/Controllers/PokerDecksController.php app/Http/Controllers/Games database/migrations/2026_10_19_100400_add_week_start_to_game_points.php tests/Feature/Database/EloquentAggregatesTest.php tests/Feature/Database/WeekStartTest.php tests/Feature tests/Arch/database-portability-baseline.txt docs/superpowers/research/database-portability-baseline.md
git commit -m "refactor(database): aggregates, leaderboards and one-time inserts go through Eloquent relations and models"
```

(check with `git status --short` that the directories staged hold only this task's edits.)

---

## Task 6: The action-item list: plain counts and a stored order

Spec §6.4.2. The list is paginated and unbounded, so its order cannot be computed in PHP; it is stored.

**Files:**
- Create: `database/migrations/2026_10_19_100500_add_sort_rank_to_action_items.php`, `tests/Feature/Database/ActionItemOrderTest.php`
- Modify: `app/Models/ActionItem.php`, `app/Actions/ActionItems/ActionItemQuery.php:50-69,110-133`; the baseline file

**Interfaces:**
- Produces: column `action_items.sort_rank` (`unsignedInteger`, not null, index `action_items_team_id_sort_rank_index`); `ActionItem::sortRankFor(bool $isCompleted, ?string $dueOn, ?ActionItemPriority $priority): int`; `ActionItem::CompletedSortRank`; `ActionItemQuery::order()` unchanged in signature and in the order it gives.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Database/ActionItemOrderTest.php`:

```php
<?php

use App\Actions\ActionItems\ActionItemQuery;
use App\Enums\ActionItemPriority;
use App\Models\ActionItem;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

function orderedTitles(Team $team): array
{
    return ActionItemQuery::order(ActionItem::query()->where('team_id', $team->id))->pluck('content')->all();
}

it('computes the rank from the state, the due date and the priority', function (bool $isCompleted, ?string $dueOn, ActionItemPriority $priority, int $rank) {
    expect(ActionItem::sortRankFor($isCompleted, $dueOn, $priority))->toBe($rank);
})->with([
    'open, due, high' => [false, '2026-10-05', ActionItemPriority::High, 202610050],
    'open, due, low' => [false, '2026-10-05', ActionItemPriority::Low, 202610052],
    'open, no date, medium' => [false, null, ActionItemPriority::Medium, 1_000_000_001],
    'completed, whatever the rest' => [true, '2026-10-05', ActionItemPriority::High, 2_000_000_000],
]);

it('lists open items by due date then priority, undated ones after, completed ones last by completion', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 09:00:00'));
    $team = Team::factory()->create();
    $item = fn (string $content, array $attributes) => ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['content' => $content, ...$attributes]);

    $item('completed yesterday', ['completed_at' => '2026-10-09 10:00:00', 'due_on' => '2026-10-01']);
    $item('undated low', ['due_on' => null, 'priority' => ActionItemPriority::Low]);
    $item('due tomorrow medium', ['due_on' => '2026-10-11', 'priority' => ActionItemPriority::Medium]);
    $item('overdue low', ['due_on' => '2026-10-02', 'priority' => ActionItemPriority::Low]);
    $item('completed today', ['completed_at' => '2026-10-10 08:00:00', 'due_on' => null]);
    $item('due tomorrow high', ['due_on' => '2026-10-11', 'priority' => ActionItemPriority::High]);
    $item('undated high', ['due_on' => null, 'priority' => ActionItemPriority::High]);

    expect(orderedTitles($team))->toBe([
        'overdue low',
        'due tomorrow high',
        'due tomorrow medium',
        'undated high',
        'undated low',
        'completed today',
        'completed yesterday',
    ]);
});

it('moves an item when its state, its date or its priority changes', function () {
    $team = Team::factory()->create();
    $first = ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['content' => 'first', 'due_on' => '2026-10-11']);
    $second = ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['content' => 'second', 'due_on' => '2026-10-12']);

    $first->update(['due_on' => null]);
    expect(orderedTitles($team))->toBe(['second', 'first']);

    $second->update(['completed_at' => now()]);
    expect(orderedTitles($team))->toBe(['first', 'second']);

    $second->update(['completed_at' => null, 'due_on' => null, 'priority' => ActionItemPriority::High]);
    $first->update(['priority' => ActionItemPriority::Low]);
    expect(orderedTitles($team))->toBe(['second', 'first']);
});

it('keeps the order across the page boundary', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    foreach (range(1, ActionItemQuery::PerPage + 1) as $day) {
        ActionItem::factory()->withoutRetro($team, $member)->create(['content' => "item {$day}", 'due_on' => CarbonImmutable::parse('2027-01-01')->addDays($day)->toDateString()]);
    }

    $query = fn () => ActionItemQuery::order(ActionItem::query()->where('team_id', $team->id));

    expect($query()->paginate(ActionItemQuery::PerPage, ['*'], 'page', 1)->first()->content)->toBe('item 1')
        ->and($query()->paginate(ActionItemQuery::PerPage, ['*'], 'page', 2)->pluck('content')->all())->toBe(['item '.(ActionItemQuery::PerPage + 1)]);
});

it('stores a rank on every row', function () {
    $item = ActionItem::factory()->create(['due_on' => '2026-10-05', 'priority' => ActionItemPriority::High]);

    expect((int) DB::table('action_items')->where('id', $item->id)->value('sort_rank'))->toBe(202610050);
});

it('counts open, overdue, completed, mine and rituals', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 09:00:00'));
    $team = Team::factory()->create();
    $member = teamMember($team);
    $admin = workspaceManager($team->workspace);

    ActionItem::factory()->withoutRetro($team, $member)->create(['due_on' => '2026-10-02', 'assignee_user_id' => $admin->id]);
    ActionItem::factory()->withoutRetro($team, $member)->create(['due_on' => null]);
    ActionItem::factory()->withoutRetro($team, $member)->create(['completed_at' => now()]);
    ActionItem::factory()->create(['team_id' => $team->id]);

    $counts = resolve(ActionItemQuery::class)->counts($admin, $team->workspace, App\Actions\ActionItems\ActionItemFilters::fromRequest(request()));

    expect($counts)->toBe(['open' => 3, 'overdue' => 1, 'completed' => 1, 'mine' => 1, 'rituals' => 1]);
});
```

Read `ActionItemFilters` for the way to build empty filters (`fromRequest` is a guess) and `ActionItemFactory` for how an item of a given team with a retro is made (the last `create` must give an item whose retro belongs to `$team`). Adapt the arrange lines; the expectations stay. The second and the last test pass on PostgreSQL today (they pin the behaviour the rewrite must keep); run them first, alone, to see that:

Run: `bin/test-db pgsql -- tests/Feature/Database/ActionItemOrderTest.php`
Expected: tests 2, 3, 4 and 6 PASS (the order and the counts are right on PostgreSQL today); tests 1 and 5 FAIL (no method, no column). Then `bin/test-db sqlite -- tests/Feature/Database/ActionItemOrderTest.php`: tests 2, 3, 4 and 6 FAIL on the raw SQL.

- [ ] **Step 2: The rank on the model**

`app/Models/ActionItem.php`:

```php
    public const int CompletedSortRank = 2_000_000_000;

    private const int UndatedSortRank = 1_000_000_000;
```

```php
    /**
     * The list's first sort key, stored (ActionItemQuery::order): open items by due date then
     * priority, undated ones after them, completed ones last. An overdue date is an earlier
     * date, so "overdue first" needs no key of its own and the rank does not depend on today.
     */
    public static function sortRankFor(bool $isCompleted, ?string $dueOn, ?ActionItemPriority $priority): int
    {
        if ($isCompleted) {
            return self::CompletedSortRank;
        }

        $weight = $priority?->sortWeight() ?? ActionItemPriority::Low->sortWeight();

        if ($dueOn === null) {
            return self::UndatedSortRank + $weight;
        }

        return (int) str_replace('-', '', substr($dueOn, 0, 10)) * 10 + $weight;
    }

    protected static function booted(): void
    {
        static::saving(function (ActionItem $item): void {
            $item->sort_rank = self::sortRankFor($item->completed_at !== null, $item->due_on?->toDateString(), $item->priority);
        });
    }
```

Add `@property int $sort_rank` to the docblock and `'sort_rank' => 'integer'` to `casts()`. If `booted()` exists (Task 9 adds guards to it), add the listener to it; the guards come first. Check that the priority column is never NULL (`2026_10_02_100000` gives it the default `medium`), and that nothing writes these three columns without the model: `grep -rnE "DB::table\('action_items'\)|ActionItem::query\(\)[^;]*->update\(" app database/seeders`. Today: none.

- [ ] **Step 3: The migration**

`art make:migration add_sort_rank_to_action_items --no-interaction`, renamed `2026_10_19_100500_add_sort_rank_to_action_items.php`:

```php
<?php

use App\Enums\ActionItemPriority;
use App\Models\ActionItem;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The order of the action-item list, as a column: no engine-specific sort expression is needed.
     */
    public function up(): void
    {
        Schema::table('action_items', function (Blueprint $table): void {
            $table->unsignedInteger('sort_rank')->default(ActionItem::CompletedSortRank);
        });

        DB::table('action_items')->select(['id', 'completed_at', 'due_on', 'priority'])->orderBy('id')->lazyById(500)->each(
            fn (object $item) => DB::table('action_items')->where('id', $item->id)->update([
                'sort_rank' => ActionItem::sortRankFor(
                    $item->completed_at !== null,
                    $item->due_on === null ? null : (string) $item->due_on,
                    ActionItemPriority::tryFrom((string) $item->priority),
                ),
            ]),
        );

        Schema::table('action_items', function (Blueprint $table): void {
            $table->unsignedInteger('sort_rank')->default(null)->change();
            $table->index(['team_id', 'sort_rank']);
        });
    }
};
```

The default exists only while the column is filled; the last block removes it, so that a later write that forgets the model fails on the `NOT NULL` column instead of sorting wrongly. If `->default(null)->change()` leaves a default on one engine (check with `Schema::getColumns('action_items')` in the test below), write the last column line as `$table->unsignedInteger('sort_rank')->change();`.

Add to `ActionItemOrderTest.php`:

```php
it('leaves no database default on the rank', function () {
    expect(collect(Schema::getColumns('action_items'))->firstWhere('name', 'sort_rank')['default'])->toBeNull();
});
```

(import `Illuminate\Support\Facades\Schema`).

- [ ] **Step 4: `ActionItemQuery`**

`counts()`:

```php
        $today = ActionItem::today()->toDateString();
        $scope = fn (): Builder => $this->filterByScope($this->visibleTo($user, $workspace), $user, $filters);
        $open = fn (): Builder => $scope()->whereNull('completed_at');

        return [
            'open' => $open()->count(),
            'overdue' => $open()->whereNotNull('due_on')->where('due_on', '<', $today)->count(),
            'completed' => $scope()->whereNotNull('completed_at')->count(),
            'mine' => $open()->where('assignee_user_id', $user->id)->count(),
            'rituals' => $scope()->distinct()->count('retro_id'),
        ];
```

Five count queries instead of one; the prop is loaded lazily (`ActionItemsPageTest > loads the counts lazily`). A test that counts the queries of that prop changes its number: name it in the report.

`order()`:

```php
    /**
     * Open before completed; by due date (overdue ones are the earliest, undated ones last), then
     * priority; completed ones by completion, newest first. The first key is stored on the row
     * (ActionItem::sortRankFor), so every key is a plain column.
     *
     * @param  Builder<ActionItem>  $query
     * @return Builder<ActionItem>
     */
    public static function order(Builder $query): Builder
    {
        return $query
            ->orderBy('action_items.sort_rank')
            ->latest('action_items.completed_at')
            ->latest('action_items.created_at')
            ->orderBy('action_items.id');
    }
```

Rows with the same rank are all open (`completed_at` is NULL for each) or all completed (never NULL), so where NULL sorts never decides. Remove the `ActionItemPriority` import if it is no longer used.

- [ ] **Step 5: Run on three engines**

Run: `bin/test-db pgsql -- tests/Feature/Database/ActionItemOrderTest.php tests/Feature/ActionItems tests/Feature/Mcp tests/Feature/Retros`, then `sqlite` and `mariadb` with `tests/Feature/Database/ActionItemOrderTest.php tests/Feature/ActionItems`.
Expected: `ActionItemOrderTest` passes on the three (7 tests). On PostgreSQL the existing action-item, MCP (`ListActionItems`) and carried-items tests pass unchanged: the order is the same order. A test that fails only because two items had the same due date, priority and creation second now order by id: fix the test data, not the query.

Run `bin/check-pg-upgrade`: PASS apart from what Task 4 still owns; the three fixture items have a rank.

- [ ] **Step 6: Lower the baseline, closing run, commit**

Delete the four `ActionItemQuery.php` lines from the baseline. `bin/test-db pgsql -- tests/Arch`: PASS. Closing run.

```bash
vendor/bin/pint --dirty --format agent
git add app/Models/ActionItem.php app/Actions/ActionItems/ActionItemQuery.php database/migrations/2026_10_19_100500_add_sort_rank_to_action_items.php tests/Feature/Database/ActionItemOrderTest.php tests/Feature/ActionItems tests/Arch/database-portability-baseline.txt docs/superpowers/research/database-portability-baseline.md
git commit -m "feat(action-items): the list is ordered by a stored rank and counted with plain queries, on every engine"
```

---

## Task 7: Search through stored folded columns

Spec §6.4.3. `whereLike` without `caseSensitive: true` follows the collation on MySQL and MariaDB and folds ASCII only on SQLite; no collation serves both search and keys; a column-level `->collation()` breaks `create table` on PostgreSQL. So the folded text is stored, and the match is case-sensitive on the four engines.

**Files:**
- Create: `app/Support/Database/SearchText.php`, `app/Concerns/HasSearchColumns.php`, `database/migrations/2026_10_19_100600_add_search_columns.php`, `tests/Unit/Support/Database/SearchTextTest.php`, `tests/Feature/Database/SearchColumnsTest.php`
- Modify: `app/Models/Retro.php`, `app/Models/Card.php`, `app/Models/ActionItem.php`, `app/Models/PokerTask.php`, `app/Models/User.php`, `app/Mcp/Tools/Retro/SearchBoards.php`, `app/Mcp/Support/LikePattern.php` (`contains()` is deleted), `app/Http/Controllers/TeamEstimatesController.php:39,138-141`, `app/Http/Controllers/Admin/AdminCandidatesController.php`, `tests/Arch/DatabasePortabilityTest.php` (one rule), `docs/database.md` (rule 4); the baseline file
- Modify [18f], in Step 7: `app/Actions/Search/SearchWorkspaceContent.php`, `app/Models/PokerGame.php`, `app/Models/Whiteboard.php`, `app/Models/GameRoom.php`; create `database/migrations/2026_10_19_100700_add_search_columns_for_workspace_search.php`

**Interfaces:**
- Produces: `SearchText::fold(?string $text): ?string`; `SearchText::pattern(string $term): string`; `SearchText::contains(?string $text, string $term): bool`; trait `HasSearchColumns` with the abstract `searchColumns(): array<string, string>` and the scopes `whereContains(string $column, string $term)`, `orWhereContains(string $column, string $term)`; columns `retros.title_search`, `retros.summary_search`, `cards.content_search`, `action_items.content_search`, `poker_tasks.title_search`, `users.name_search` (all `text`, nullable).

- [ ] **Step 1: Write the failing unit test**

`tests/Unit/Support/Database/SearchTextTest.php`:

```php
<?php

use App\Support\Database\SearchText;

it('folds case and keeps accents', function () {
    expect(SearchText::fold('ÉTÉ à Paris'))->toBe('été à paris')
        ->and(SearchText::fold(null))->toBeNull();
});

it('builds a pattern in which a wildcard character stands for any one character', function (string $term, string $pattern) {
    expect(SearchText::pattern($term))->toBe($pattern);
})->with([
    'plain' => ['Été', '%été%'],
    'percent' => ['100%', '%100_%'],
    'underscore' => ['a_b', '%a_b%'],
    'backslash' => ['a\\b', '%a_b%'],
    'glob characters' => ['a*b?c[d]', '%a_b_c_d_%'],
]);

it('checks a text exactly, whatever the case', function (string $text, string $term, bool $expected) {
    expect(SearchText::contains($text, $term))->toBe($expected);
})->with([
    ['We shipped 100% of it', '100%', true],
    ['We shipped 1000 of it', '100%', false],
    ['Été indien', 'ÉTÉ', true],
    ['ete', 'été', false],
    ['a_b', 'A_B', true],
    ['axb', 'a_b', false],
]);

it('finds nothing in a missing text', function () {
    expect(SearchText::contains(null, 'a'))->toBeFalse();
});
```

Run: `bin/test-db sqlite -- tests/Unit/Support/Database/SearchTextTest.php`. Expected: FAIL, class not found.

- [ ] **Step 2: Write `SearchText` and the trait**

`app/Support/Database/SearchText.php`:

```php
<?php

namespace App\Support\Database;

use Illuminate\Support\Str;

/**
 * The fold behind every *_search column and every search term. Computed in PHP, so the four
 * engines store and compare the same bytes: no engine's own lower() or collation is involved.
 */
class SearchText
{
    /**
     * Characters with a meaning in LIKE or GLOB. No grammar of the framework emits an escape
     * clause, so they cannot be made literal in SQL on every engine.
     *
     * @var array<int, string>
     */
    private const array Wildcards = ['\\', '%', '_', '*', '?', '[', ']'];

    public static function fold(?string $text): ?string
    {
        return $text === null ? null : Str::lower($text);
    }

    /**
     * Each wildcard character of the term becomes "any one character": what SQL returns is then
     * every true match and, rarely, a near one, which contains() removes.
     */
    public static function pattern(string $term): string
    {
        return '%'.str_replace(self::Wildcards, '_', Str::lower($term)).'%';
    }

    public static function contains(?string $text, string $term): bool
    {
        return $text !== null && str_contains(Str::lower($text), Str::lower($term));
    }
}
```

`app/Concerns/HasSearchColumns.php` (beside `HasGuestIdentity`):

```php
<?php

namespace App\Concerns;

use App\Support\Database\SearchText;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Keeps a folded copy of the columns a model is searched by, and searches it. The match is
 * case-sensitive on purpose: both sides are already lower-case, and a case-sensitive LIKE is the
 * one form that means the same on PostgreSQL, MySQL, MariaDB and SQLite.
 *
 * @mixin Model
 */
trait HasSearchColumns
{
    /**
     * @return array<string, string> searched column => folded column
     */
    abstract public function searchColumns(): array;

    public static function bootHasSearchColumns(): void
    {
        static::saving(function (Model $model): void {
            foreach ($model->searchColumns() as $column => $folded) {
                if ($model->exists && ! $model->isDirty($column)) {
                    continue;
                }

                $model->setAttribute($folded, SearchText::fold($model->getAttribute($column)));
            }
        });
    }

    public function initializeHasSearchColumns(): void
    {
        $this->makeHidden(array_values($this->searchColumns()));
    }

    /**
     * @param  Builder<static>  $query
     */
    public function scopeWhereContains(Builder $query, string $column, string $term): void
    {
        $query->whereLike($query->qualifyColumn($this->searchColumns()[$column]), SearchText::pattern($term), caseSensitive: true);
    }

    /**
     * @param  Builder<static>  $query
     */
    public function scopeOrWhereContains(Builder $query, string $column, string $term): void
    {
        $query->orWhereLike($query->qualifyColumn($this->searchColumns()[$column]), SearchText::pattern($term), caseSensitive: true);
    }
}
```

`App\Concerns` may use `App\Support`; check the Arch preset (`grep -n "Concerns" tests/Arch/ArchTest.php`) and, if a rule forbids it, stop and report.

In each model, `use HasSearchColumns;` on its own line and:

| Model | `searchColumns()` returns |
|---|---|
| `Retro` | `['title' => 'title_search', 'summary' => 'summary_search']` |
| `Card` | `['content' => 'content_search']` |
| `ActionItem` | `['content' => 'content_search']` |
| `PokerTask` | `['title' => 'title_search']` |
| `User` | `['name' => 'name_search']` |

with the docblock `/** @return array<string, string> */`. Read `casts()` of the five models: the searched attributes must be plain strings. If one has a cast (an encrypted or object cast), stop and report: a folded copy of it needs a decision.

Run the unit test: PASS, 14 tests.

- [ ] **Step 3: Write the failing feature test**

`tests/Feature/Database/SearchColumnsTest.php`:

```php
<?php

use App\Models\Card;
use App\Models\Retro;
use App\Models\User;
use App\Support\Database\SearchText;
use Illuminate\Support\Facades\DB;

function cardsFound(Retro $retro, string $term): array
{
    return Card::query()->where('retro_id', $retro->id)->whereContains('content', $term)->get()
        ->filter(fn (Card $card): bool => SearchText::contains($card->content, $term))
        ->pluck('content')->sort()->values()->all();
}

it('stores the folded text when a model is created and when its text changes', function () {
    $retro = Retro::factory()->create(['title' => 'Sprint ÉTÉ']);

    expect(DB::table('retros')->where('id', $retro->id)->value('title_search'))->toBe('sprint été');

    $retro->update(['title' => 'Bilan']);

    expect(DB::table('retros')->where('id', $retro->id)->value('title_search'))->toBe('bilan');
});

it('leaves the folded text alone when another column changes', function () {
    $retro = Retro::factory()->create(['title' => 'Sprint']);
    DB::table('retros')->where('id', $retro->id)->update(['title_search' => 'marker']);

    $retro->fresh()->update(['summary' => 'Done']);

    expect(DB::table('retros')->where('id', $retro->id)->value('title_search'))->toBe('marker')
        ->and(DB::table('retros')->where('id', $retro->id)->value('summary_search'))->toBe('done');
});

it('does not show the folded columns when a model is serialised', function () {
    expect(Retro::factory()->create()->fresh()->toArray())->not->toHaveKey('title_search');
});

it('finds a text whatever the case of the term and of the text, accents included', function (string $term) {
    $retro = Retro::factory()->create();
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Un Été indien']);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Un ete sans accent']);

    expect(cardsFound($retro, $term))->toBe(['Un Été indien']);
})->with(['été', 'ÉTÉ', 'Été']);

it('does not find an accented letter by its plain form', function () {
    $retro = Retro::factory()->create();
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Un Été indien']);

    expect(cardsFound($retro, 'ete'))->toBe([]);
});

it('treats wildcard characters of the term as text', function (string $term, string $match, string $nearMiss) {
    $retro = Retro::factory()->create();
    Card::factory()->create(['retro_id' => $retro->id, 'content' => $match]);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => $nearMiss]);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'nothing alike']);

    expect(cardsFound($retro, $term))->toBe([$match]);
})->with([
    'percent' => ['100%', 'done at 100% today', 'done at 1000 today'],
    'underscore' => ['a_b', 'see a_b here', 'see axb here'],
    'backslash' => ['a\\b', 'path a\\b', 'path a-b'],
    'star' => ['a*b', 'glob a*b', 'glob a.b'],
    'question mark' => ['why?', 'but why? really', 'but whyy really'],
    'bracket' => ['[x]', 'todo [x] done', 'todo -x- done'],
]);

it('returns from sql at most the near misses of a wildcard, never an unrelated row', function () {
    $retro = Retro::factory()->create();
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'done at 100% today']);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'done at 1000 today']);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'nothing alike']);

    expect(Card::query()->where('retro_id', $retro->id)->whereContains('content', '100%')->count())->toBe(2);
});

it('searches people by name in any case', function () {
    User::factory()->create(['name' => 'Émile Zola']);

    expect(User::query()->whereContains('name', 'émile z')->count())->toBe(1)
        ->and(User::query()->whereContains('name', 'ZOLA')->count())->toBe(1);
});
```

Run: `bin/test-db pgsql -- tests/Feature/Database/SearchColumnsTest.php`. Expected: FAIL, no `title_search` column.

- [ ] **Step 4: The migration**

`art make:migration add_search_columns --no-interaction`, renamed `2026_10_19_100600_add_search_columns.php`:

```php
<?php

use App\Support\Database\SearchText;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<string, array<string, string>> */
    private const array Columns = [
        'retros' => ['title' => 'title_search', 'summary' => 'summary_search'],
        'cards' => ['content' => 'content_search'],
        'action_items' => ['content' => 'content_search'],
        'poker_tasks' => ['title' => 'title_search'],
        'users' => ['name' => 'name_search'],
    ];

    /**
     * A lower-cased copy of each searched column, so that search compares the same bytes on every
     * engine. Existing rows are filled here, one update per row.
     */
    public function up(): void
    {
        foreach (self::Columns as $table => $columns) {
            Schema::table($table, function (Blueprint $blueprint) use ($columns): void {
                foreach ($columns as $folded) {
                    $blueprint->text($folded)->nullable();
                }
            });

            DB::table($table)->select(['id', ...array_keys($columns)])->orderBy('id')->lazyById(500)->each(
                fn (object $row) => DB::table($table)->where('id', $row->id)->update(
                    collect($columns)->mapWithKeys(fn (string $folded, string $column): array => [$folded => SearchText::fold($row->{$column})])->all(),
                ),
            );
        }
    }
};
```

The columns stay nullable (`cards.content` and `retros.summary` are nullable) and have no index: no index serves `%term%`. Grep for writes that bypass the models on the five tables: `grep -rnE "DB::table\('(retros|cards|action_items|poker_tasks|users)'\)|->update\(\[[^]]*'(title|content|summary|name)'" app database/seeders`. A mass `->update(['title' => …])` on a builder must set the `_search` column too or go through the model. Today: none (`StoreRetroInsights` and `ClearRetroInsights` mass-update other columns of `cards`).

Run `SearchColumnsTest` on `pgsql`, `sqlite`, `mariadb`, `mysql`. Expected: PASS on the four (19 tests). This is the first run of `whereLike(..., caseSensitive: true)` on SQLite (`GLOB`) and of `like binary`; if a case fails on one engine only, print `Card::query()->whereContains('content', $term)->toRawSql()` there and put the SQL and the engine's answer in the report. If the accented or the multi-byte case fails on SQLite, stop: the fallback (decision D9 (b), reading candidates with `lazy()` and matching with `SearchText::contains()`) is the owner's call.

- [ ] **Step 5: The sites of the main tree**

`SearchBoards.php`: the four private methods lose their `$pattern` parameter (and `handle()` its `LikePattern::contains($term)` line). Each `->where('<column>', 'ilike', $pattern)` becomes `->whereContains('<column>', $term)`, and each `->get([...])` is followed by the exact check before the existing `map`:

```php
            ->get(['id', 'title'])
            ->filter(fn (Retro $retro): bool => SearchText::contains($retro->title, $term))
```

(`$retro->summary` in `summaries()`, `$item->content` in `actions()`, `$card->content` in `messages()`; in `actions()` and `messages()` the filter goes right after `get()`, before `reverse()` / `sortBy()`). `LikePattern::snippet()` stays; delete `LikePattern::contains()` once `grep -rn "LikePattern::contains" app` finds nothing ([18f] still uses it until Step 7: then leave it and delete it there).

`TeamEstimatesController::index()`:

```php
            ->when($search !== '', fn ($query) => $query->whereContains('title', $search))
```

and where the page is presented:

```php
            'tasks' => collect($tasks->items())
                ->when($search !== '', fn (Collection $page) => $page->filter(fn (PokerTask $task): bool => SearchText::contains($task->title, $search)))
                ->map(fn (PokerTask $task): array => $this->presentRow($task, $user))
                ->values(),
```

Delete `escapeLike()`. A term holding a wildcard character can give a page shorter than fifty and a total that counts a near-miss (decision D10); a term without one is exact.

`AdminCandidatesController::index()`, the name half now, the e-mail half when `users.email_key` exists (Task 10):

```php
        $term = $request->string('query')->toString();

        $candidates = User::query()
            ->where('is_instance_admin', false)
            ->where(fn (Builder $query) => $query
                ->whereContains('name', $term)
                ->orWhereLike('email', '%'.$this->escapeLike($term).'%'))
```

`Builder` becomes `Illuminate\Database\Eloquent\Builder`. The `orWhereLike('email', …)` and `escapeLike()` stay until Step 7, and the file stays on the baseline with a count of 1. If `plan-18f-auth` is already merged, do Step 7 now instead and write the final form at once.

Run: `bin/test-db pgsql -- tests/Feature/Mcp tests/Feature/Poker tests/Feature/Admin tests/Feature/Database/SearchColumnsTest.php`. Expected: PASS.

- [ ] **Step 6: The arch rule and the developer rule**

In `tests/Arch/DatabasePortabilityTest.php`, the `like comparison` rule becomes:

```php
        'like comparison' => '/[\'"](?:not )?like[\'"]|->(?:or)?where(?:Not)?Like\((?:(?!caseSensitive:\s*true)[^;])*;/i',
```

It still refuses the operator string `'like'` and any `whereLike` family call whose statement does not say `caseSensitive: true`; the two calls of the trait pass. Check it both ways: `bin/test-db pgsql -- tests/Arch` passes; add a throw-away line `User::query()->whereLike('name', 'a')->get();` to a file of `app/`, run again, see it fail, remove the line.

In `docs/database.md`, rule 4 becomes: "Case-insensitive search goes through the scope `whereContains()` of `App\Concerns\HasSearchColumns` (a folded `*_search` column, a term folded in PHP), followed by `SearchText::contains()` on the rows. `whereLike` is used only with `caseSensitive: true` and only on a folded column; the operator strings `'like'` and `'ilike'` are not used. Case-insensitive equality: fold the value in PHP and compare with a stored key (`name_key`, `email_key`). `insertOrIgnore`, `whereJsonContains` and `whereJsonLength` are not used: their meaning differs per engine." Rule 2 gains: "PHP works on bounded sets only; where a set grows without bound, use a relationship aggregate (`withCount`, `withSum`) or store a derived column the model maintains."

- [ ] **Step 7: [18f] The workspace search and the e-mail half (when `plan-18f-auth` is merged; otherwise from Task 10)**

`art make:migration add_search_columns_for_workspace_search --no-interaction`, renamed `2026_10_19_100700_add_search_columns_for_workspace_search.php`: the same migration as Step 4 with

```php
    private const array Columns = [
        'poker_games' => ['title' => 'title_search'],
        'whiteboards' => ['title' => 'title_search'],
        'game_rooms' => ['name' => 'name_search'],
    ];
```

`PokerGame`, `Whiteboard` and `GameRoom` use the trait with those maps. In `SearchWorkspaceContent::handle()`, delete `$pattern`; the seven `->where('<column>', 'ilike', $pattern)` become `->whereContains('<column>', $term)` (inside the `orWhereHas('tasks', …)` closure: `$tasks->whereContains('title', $term)`; the closure of the group becomes `$query->whereContains('title', $term)->orWhereHas(...)`), and each `->get([...])` is followed by `->filter(fn (...) => SearchText::contains(<the searched text>, $term))`. For poker games, a game matches by its own title or by a task's: filter with `SearchText::contains($game->title, $term) || $game->tasks()->whereContains('title', $term)->get(['title'])->contains(fn (PokerTask $task): bool => SearchText::contains($task->title, $term))` only when the term holds a wildcard character (`SearchText::pattern($term) !== '%'.Str::lower($term).'%'`); otherwise SQL was exact and no filter is needed for that kind. Delete `LikePattern::contains()`.

`AdminCandidatesController`: the e-mail half reads the key Task 10 adds:

```php
                ->orWhereLike('email_key', SearchText::pattern($term), caseSensitive: true))
            ->orderBy('name')
            ->orderBy('id')
            ->limit(self::MaxResults)
            ->get()
            ->filter(fn (User $user): bool => SearchText::contains($user->name, $term) || SearchText::contains($user->email, $term))
```

and `escapeLike()` is deleted. Add to `SearchColumnsTest`: a person is found by a part of their address in any case.

Run the 18f search tests and `SearchColumnsTest` on `pgsql`, `sqlite`, `mariadb`.

- [ ] **Step 8: Run on three engines, lower the baseline, closing run, commit**

Run: `bin/test-db sqlite -- tests/Feature/Database/SearchColumnsTest.php tests/Feature/Mcp tests/Feature/Admin` and the same on `mariadb`. Expected: the search tests pass on both.

Run `bin/check-pg-upgrade`: rows unchanged; the fixture's cards and items have their folded text.

Baseline: delete `SearchBoards.php|ilike|4` and `TeamEstimatesController.php|ilike|1`; `AdminCandidatesController.php|like comparison|2` becomes `|1` (deleted in Step 7). Closing run.

```bash
vendor/bin/pint --dirty --format agent
git add app/Support/Database/SearchText.php app/Concerns/HasSearchColumns.php app/Models app/Mcp app/Http/Controllers/TeamEstimatesController.php app/Http/Controllers/Admin/AdminCandidatesController.php database/migrations/2026_10_19_100600_add_search_columns.php tests/Unit/Support/Database/SearchTextTest.php tests/Feature/Database/SearchColumnsTest.php tests/Arch docs/database.md docs/superpowers/research/database-portability-baseline.md
git commit -m "feat(search): search ignores case through stored folded columns, the same on every engine"
```

---

## Task 8: Lists read by people are sorted in PHP (decision D6)

From revision 1 (D6 is ruled: whole lists are sorted in PHP). `Alphabetical` is PHP only. Changed: Step 4, because Task 5 already rewrote the leaderboard; the baseline step. Runs after Tasks 5 and 7, whose files it edits.

**Files:**
- Create: `app/Support/Alphabetical.php`, `tests/Unit/Support/AlphabeticalTest.php`, `tests/Feature/Database/AlphabeticalListsTest.php`
- Modify: the sites of the table in Step 3; `app/Actions/Retros/BuildSummaryInput.php:228`, `app/Actions/Games/TeamGameLeaderboard.php:49-52`; the baseline file

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

`TeamGameLeaderboard.php`: Task 5 reads the members with their sums and sorts them in PHP by points, wins, name and id. Only the name key changes here, so that ties are in alphabetical order:

```php
            ->sort(fn (User $first, User $second): int => [(int) $second->total_points, (int) $second->wins, Alphabetical::key($first->name), $first->name, $first->id]
                <=> [(int) $first->total_points, (int) $first->wins, Alphabetical::key($second->name), $second->name, $second->id])
```

The whole set (the members of one team who scored) is sorted before `take(20)`, so the twenty are the same on every engine.

- [ ] **Step 5: Run**

Run: `bin/test-db sqlite -- tests/Feature/Database/AlphabeticalListsTest.php tests/Unit/Support/AlphabeticalTest.php`, then `mariadb`, then `pgsql`.
Expected: PASS on the three. Then `bin/test-db pgsql -- tests/Feature/Teams tests/Feature/Workspaces tests/Feature/Poker tests/Feature/Games tests/Feature/Retros tests/Feature/Mcp tests/Feature/Settings tests/Feature/Admin`: a test that asserted the order PostgreSQL gave for names that differ by case or accent is updated to the alphabetical order, in this commit, and named in the report.

- [ ] **Step 6: Lower the baseline, closing run, commit**

Baseline: delete `app/Actions/Retros/BuildSummaryInput.php|orderByRaw|1` (the leaderboard line went with Task 5). Arch suite, closing run.

```bash
vendor/bin/pint --dirty --format agent
git add app tests/Unit/Support/AlphabeticalTest.php tests/Feature/Database/AlphabeticalListsTest.php tests/Feature tests/Arch docs/superpowers/research/database-portability-baseline.md
git commit -m "feat(lists): names are sorted alphabetically in PHP, the same on every engine"
```

(`git add app` is allowed here only because this task's edits are spread over about thirty files of `app/`; run `git status` first and check that nothing else is modified.)

---

## Task 9: Five rules live in the model, on every engine; dates are stored as dates

From revision 1. Changed: no database constraint stands behind the model guards any more (Task 3 removed them from the migrations), so there is no "database twin" test; `ActionItem::booted()` already holds the rank listener of Task 6. Runs after Tasks 5 and 6. The line numbers given for `ActionItemModelTest.php` are those before Task 3 removed its first test: the three tests are about forty lines higher.

**Files:**
- Create: `app/Exceptions/ModelInvariantViolation.php`, `app/Casts/DateOnly.php`, `tests/Unit/Casts/DateOnlyTest.php`, `tests/Feature/Database/ModelInvariantsTest.php`, `tests/Feature/Database/DateOnlyStorageTest.php`
- Modify: `app/Models/ActionItem.php`, `app/Models/ActionItemReminder.php`, `app/Models/TeamHealthStatement.php`, `app/Models/SavedPokerDeck.php`, `tests/Feature/ActionItems/ActionItemModelTest.php:108-126`, `tests/Feature/Retros/HealthStatementModelsTest.php:60-62`, `tests/Feature/Poker/WorkspacePokerDecksTest.php:260-275`, the baseline list

**Interfaces:**
- Consumes: nothing.
- Produces: `App\Exceptions\ModelInvariantViolation::because(Model $model, string $rule): self`; `App\Casts\DateOnly` (reads midnight of the day as a `Carbon\CarbonInterface` built by the `Date` facade, so the class set by `Date::use` is the one returned, as with Eloquent's own date cast: `CarbonImmutable` in this application; writes `Y-m-d`; keeps no cast object on the model, `$withoutObjectCaching = true`, so a date changed in place is never written back and a value just assigned is read back at midnight; serialises a date instance without going through its string form). The rule columns of a guarded model must be loaded when one of them is written: a stored row is checked on the attributes it holds.

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
use Carbon\CarbonInterface;
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

    expect($read)->toBeInstanceOf(CarbonInterface::class)
        ->and($read->toDateTimeString())->toBe('2026-10-10 00:00:00');
})->with(['2026-10-10', '2026-10-10 00:00:00']);

it('reads null as null', function () {
    expect((new DateOnly)->get(dateOnlyModel(), 'due_on', null, []))->toBeNull();
});
```

The unit test boots no application, so it sees the facade's default class; `DateOnlyStorageTest` asserts `CarbonImmutable` on a model, that a date changed in place leaves the attribute clean, that a timed value just assigned is read back at midnight, and that serialisation does not depend on the string format of Carbon.

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
 * A row would break a rule of its model. Raised by the model on every engine: the Schema builder
 * has no check constraint, so no database constraint stands behind these rules on a fresh install.
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

use Carbon\CarbonInterface;
use DateTimeInterface;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Contracts\Database\Eloquent\SerializesCastableAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Date;

/**
 * A calendar day. Eloquent's own date cast writes a date and a time, which an engine
 * without a date type keeps as written; this one writes the day alone.
 *
 * @implements CastsAttributes<CarbonInterface, DateTimeInterface|string>
 */
class DateOnly implements CastsAttributes, SerializesCastableAttributes
{
    private const string Format = 'Y-m-d';

    /**
     * Eloquent keeps the object a class cast returns and writes it back on save. Without that,
     * a date changed in place is never stored, and a value just assigned is read back at midnight.
     */
    public bool $withoutObjectCaching = true;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): ?CarbonInterface
    {
        if ($value === null) {
            return null;
        }

        return Date::createFromFormat('!'.self::Format, substr((string) $value, 0, 10));
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return Date::parse($value)->format(self::Format);
    }

    /**
     * The form Eloquent's date cast gives, so pages and API answers do not change.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function serialize(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return Date::instance($value)->startOfDay()->toJSON();
        }

        return $this->get($model, $key, $value, $attributes)?->toJSON();
    }
}
```

In `ActionItem::casts()` and `ActionItemReminder::casts()`: `'due_on' => DateOnly::class,`.

Run the unit test and `DateOnlyStorageTest` on `sqlite` and on `pgsql`. Expected: PASS. The cast implements `SerializesCastableAttributes` so `toArray()['due_on']` keeps the form Eloquent's date cast gave; the third storage test asserts the exact string.

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

The model already has a `booted()` method (Task 6 sets `sort_rank` there): add this listener before the rank listener, in the same method.

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

Remove imports that become unused. There is no database-level twin of these tests: the model is the guard on every engine (spec §6.5). In `SendActionItemReminders::log()` (Task 5) the `createOrFirst` lookup now matches on SQLite too, since `due_on` is stored as ten characters.

- [ ] **Step 5: Run on three engines**

Run: `bin/test-db pgsql -- tests/Feature/Database tests/Unit/Casts tests/Feature/ActionItems tests/Feature/Retros/HealthStatementModelsTest.php tests/Feature/Poker`, then `sqlite`, then `mariadb`.
Expected: PASS on the three for `ModelInvariantsTest` (11 tests), `DateOnlyTest`, `DateOnlyStorageTest`, the reminder tests (`tests/Feature/ActionItems`, a second run the same day sends nothing: on SQLite this is the first engine-level proof of `createOrFirst` on reminders) and the three edited files. A feature test that now fails on PostgreSQL with `ModelInvariantViolation` is a code path that saved a row the constraint would have refused anyway: read it; if it is a factory building an invalid row, fix the factory; otherwise stop.

- [ ] **Step 6: Lower the baseline, closing run, commit**

Baseline: delete the `driver branch` lines of `HealthStatementModelsTest.php` and `WorkspacePokerDecksTest.php`.

```bash
vendor/bin/pint --dirty --format agent
git add app/Exceptions/ModelInvariantViolation.php app/Casts/DateOnly.php app/Models/ActionItem.php app/Models/ActionItemReminder.php app/Models/TeamHealthStatement.php app/Models/SavedPokerDeck.php tests/Unit/Casts/DateOnlyTest.php tests/Feature/Database/ModelInvariantsTest.php tests/Feature/Database/DateOnlyStorageTest.php tests/Feature/ActionItems/ActionItemModelTest.php tests/Feature/Retros/HealthStatementModelsTest.php tests/Feature/Poker/WorkspacePokerDecksTest.php tests/Arch/database-portability-baseline.txt docs/superpowers/research/database-portability-baseline.md
git commit -m "feat(models): five rules are enforced by the model on every engine, and a due date is stored as a day"
```

---

## Task 10: Collation, cache locks, and addresses (waits for plan-18f-auth)

From revision 1, unchanged in design: `email_key` is a stored key under a plain index, filled by the mutator and by a query-builder loop. Changed: the search step points at Task 7 Step 7; the baseline step.

Steps 1 to 3 need nothing from 18f and may be done as soon as Task 3 is merged. Steps 4 to 9 need `plan-18f-auth` merged into the plan's branch (see **Branches**).

**Files:**
- Create: `tests/Feature/Database/CollationTest.php`, `tests/Feature/Database/CacheLockConnectionTest.php`, `tests/Feature/Database/EmailKeyTest.php`, `database/migrations/2026_10_19_100200_add_email_key_to_users_table.php`, `database/migrations/2026_10_19_100300_normalise_workspace_invitation_emails.php`
- Modify [18f]: `app/Models/User.php` (`email()`, `scopeWhereAddress()`), `app/Models/WorkspaceInvitation.php`, `app/Actions/Workspaces/CreateWorkspaceInvitation.php:21-25`, `database/migrations/2026_10_14_100000_create_magic_links_table.php:15`, `database/migrations/2026_10_15_100001_create_email_two_factor_codes_table.php:17-18`, `app/Actions/Search/SearchWorkspaceContent.php` and the e-mail half of `AdminCandidatesController.php` (Task 7 Step 7, if it did not run), the baseline file

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
Expected: PASS on the four. These tests are the proof that the collations of Task 1 do what the spec says; they have no red step of their own on these engines. To see them red once, run on MariaDB with the old collation: `docker compose exec -T -u sail -e DB_CONNECTION=mariadb -e DB_HOST=mariadb -e DB_DATABASE=testing -e DB_USERNAME=sail -e DB_PASSWORD=password -e DB_COLLATION=utf8mb4_unicode_ci laravel.test php artisan test --compact tests/Feature/Database/CollationTest.php`. Expected: FAIL, the second emoji and `pêche` are refused as duplicates. Put the output in the task report. If the trailing-space case fails on MariaDB or MySQL with the collation of Task 1, the fallback `utf8mb4_bin` was used there: remove `'a '` from that test's list for now and write the limit in `docs/database.md` (Task 18).

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

If `SearchWorkspaceContent` still uses `ilike`, do Task 7 Step 7 now: the three search columns of the 18f search, its seven sites, and the e-mail half of the admin search, which reads `email_key`.

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

- [ ] **Step 9: [18f] Lower the baseline, closing run, commit**

Baseline: the merge of 18f brought its own offences, which fail the first Arch test until they are fixed here (the baseline gains no line): `User.php` (the `whereRaw` of `scopeWhereAddress`), the two 18f migrations (`non-null timestamp`), `SearchWorkspaceContent.php` (`ilike`). After this step none is left. Delete the lines `app/Actions/Auth/ResolveSsoUser.php|whereRaw|1`, `app/Actions/Workspaces/CreateWorkspaceInvitation.php|whereRaw|1`, `app/Http/Controllers/WorkspaceInvitationsController.php|whereRaw|2` and, once Task 7 Step 7 is done, `app/Http/Controllers/Admin/AdminCandidatesController.php|like comparison|1`.

```bash
vendor/bin/pint --dirty --format agent
git add app/Models/User.php app/Models/WorkspaceInvitation.php app/Actions/Workspaces/CreateWorkspaceInvitation.php database/migrations tests/Feature/Database/EmailKeyTest.php tests/Arch docs/superpowers/research/database-portability-baseline.md
git commit -m "feat(auth): an address is looked up by a stored key, the same on every engine"
```

---

## Task 11: Tests stop asserting an engine

Spec §6.7. Eighteen sites on the baseline (14 lines), plus two tests the baseline does not list but that only pass on PostgreSQL.

**Files:**
- Create: `tests/Support/SqlProbe.php`, `tests/Support/DatabaseFailure.php`, `tests/Support/UnreachableDatabase.php`, `tests/Support/MissingTables.php`, `tests/Feature/Database/TestSupportTest.php`
- Modify: `tests/Feature/Games/IcebreakerRoomTest.php:194-209`, `tests/Feature/Integrations/ActionItemExportTest.php:259-275`, `tests/Feature/Admin/InstanceAdminsTest.php:158-176`, `tests/Feature/Games/GameAccessTest.php:180-200`, `tests/Feature/Integrations/WebhookRedeliveryTest.php:524-538`, `tests/Feature/Integrations/WebhookSharesTest.php:465`, `tests/Feature/Integrations/WebhookEventsTest.php:464`, `tests/Feature/ErrorPagesTest.php:28-47`, `tests/Feature/InstanceSettingsTest.php:172-186`, `tests/Feature/Branding/BrandInPageTest.php:182-195`, `tests/Feature/UuidPrimaryKeysTest.php:10-20`; the baseline file

(`ActionItemModelTest.php:17` was moved by Task 3; the two driver-branch skips belong to Task 9.)

**Interfaces:**
- Produces:
  - `Tests\Support\SqlProbe::locks(Closure $during): array<int, array{table: string, level: int}>`, `SqlProbe::lockedTables(Closure $during): array<int, string>`, `SqlProbe::rowLocksExist(): bool`. The probe takes the lock clause and the quoting from the connection's grammar: it holds no SQL and no driver name.
  - `Tests\Support\DatabaseFailure::provoke(): void`
  - `Tests\Support\UnreachableDatabase::config(): array<string, mixed>`
  - `Tests\Support\MissingTables::during(Closure $callback): mixed`

- [ ] **Step 1: Write the failing test of the helpers**

`tests/Feature/Database/TestSupportTest.php`:

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

it('records the tables locked for update, in order, with the transaction level', function () {
    $user = User::factory()->create();
    $team = Team::factory()->create();
    $outside = DB::transactionLevel();

    $locks = SqlProbe::locks(function () use ($user, $team): void {
        DB::transaction(function () use ($user, $team): void {
            User::query()->whereKey($user->id)->lockForUpdate()->first();
            Team::query()->whereKey($team->id)->lockForUpdate()->first();
            User::query()->whereKey($user->id)->first();
        });
    });

    expect($locks)->toBe([
        ['table' => 'users', 'level' => $outside + 1],
        ['table' => 'teams', 'level' => $outside + 1],
    ]);
})->skip(fn () => ! SqlProbe::rowLocksExist(), 'This engine has no row lock: its write transactions are serialised instead.');

it('records nothing once its closure has returned', function () {
    $user = User::factory()->create();

    $locks = SqlProbe::locks(fn () => null);
    DB::transaction(fn () => User::query()->whereKey($user->id)->lockForUpdate()->first());

    expect($locks)->toBe([]);
});

it('provokes a failure the database itself raises', function () {
    expect(fn () => DB::transaction(fn () => DatabaseFailure::provoke()))->toThrow(QueryException::class);
});

it('describes a connection that cannot be opened', function () {
    config(['database.connections.unreachable' => UnreachableDatabase::config()]);

    expect(fn () => DB::connection('unreachable')->getPdo())->toThrow(Exception::class);

    DB::purge('unreachable');
});

it('hides every table while a closure runs and gives them back', function () {
    User::factory()->create();

    expect(fn () => MissingTables::during(fn () => User::query()->count()))->toThrow(QueryException::class)
        ->and(User::query()->count())->toBe(1);
});
```

Run: `bin/test-db pgsql -- tests/Feature/Database/TestSupportTest.php`. Expected: FAIL, classes not found.

- [ ] **Step 2: Write the four helpers**

`tests/Support/SqlProbe.php`:

```php
<?php

namespace Tests\Support;

use Closure;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tells which tables a piece of code locked for update, and in which order. It knows no SQL of
 * its own: the lock clause and the quoting of a table come from the grammar of the connection.
 */
class SqlProbe
{
    /**
     * @return array<int, array{table: string, level: int}>
     */
    public static function locks(Closure $during): array
    {
        $clause = self::lockClause();
        $grammar = DB::connection()->getQueryGrammar();
        $tables = array_column(Schema::getTables(), 'name');
        $recorded = [];
        $active = $clause !== '';

        DB::listen(function (QueryExecuted $query) use ($clause, $grammar, $tables, &$recorded, &$active): void {
            if (! $active || ! str_ends_with($query->sql, $clause)) {
                return;
            }

            foreach ($tables as $table) {
                if (str_contains($query->sql, 'from '.$grammar->wrapTable($table).' ')) {
                    $recorded[] = ['table' => $table, 'level' => DB::transactionLevel()];

                    return;
                }
            }
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
        return array_column(self::locks($during), 'table');
    }

    /**
     * False on an engine whose grammar compiles no lock clause.
     */
    public static function rowLocksExist(): bool
    {
        return self::lockClause() !== '';
    }

    private static function lockClause(): string
    {
        $plain = DB::table('users')->toSql();

        return trim(substr(DB::table('users')->lockForUpdate()->toSql(), strlen($plain)));
    }
}
```

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
     * The default connection, pointed at a port nothing listens on and at a database file in a
     * directory that does not exist: one of the two stops every engine, with or without a server.
     *
     * @return array<string, mixed>
     */
    public static function config(): array
    {
        return [
            ...config('database.connections.'.config('database.default')),
            'url' => null,
            'host' => '127.0.0.1',
            'port' => 1,
            'database' => storage_path('framework/no-such-directory/database.sqlite'),
        ];
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

Run: `bin/test-db pgsql -- tests/Feature/Database/TestSupportTest.php`, then `sqlite`, `mariadb`.
Expected: PASS on the three (5 tests; 1 skipped on SQLite). If "describes a connection that cannot be opened" does not throw on one engine, read how `App\Http\ErrorPageResponder` recognises an unreachable database and which exception that engine raised; if the responder does not recognise it, stop and report (a real gap for that engine's operators).

- [ ] **Step 3: The three lock-order tests**

`IcebreakerRoomTest.php`:

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

    $locks = SqlProbe::locks(function () use ($other, &$revoked): void {
        $revoked = resolve(RevokeInstanceAdmin::class)->handle($other);
    });

    expect($revoked)->toBeTrue()
        ->and($locks)->toBe([['table' => 'users', 'level' => $levelOutside + 1]])
        ->and(resolve(RevokeInstanceAdmin::class)->handle($admin))->toBeFalse()
        ->and($admin->fresh()->is_instance_admin)->toBeTrue();
})->skip(fn () => ! SqlProbe::rowLocksExist(), 'This engine has no row lock: its write transactions are serialised instead.');
```

Remove the `QueryExecuted` imports that become unused. What these tests describe (which rows are protected) is proved on every engine, SQLite included, by the concurrency suite of Task 14; here they pin the order of row locks where row locks exist (decision D12).

- [ ] **Step 4: The two tests that named a table in SQL become model events**

`GameAccessTest.php`, "survives a concurrent first visit of the same member": the `DB::listen(...)` block becomes a listener on the model's own insert, which puts the rival row in place just before it:

```php
    $raced = false;

    GamePlayer::creating(function () use (&$raced, $room, $user): void {
        if ($raced) {
            return;
        }

        $raced = true;

        DB::table('game_players')->insert([
```

(the array of the rival row and everything after it are unchanged). It is the same race: the request found no player, and another request created one before its insert. Check first that the request creates its player through Eloquent (`grep -rn "players()->\(create\|firstOrCreate\|createOrFirst\)\|GamePlayer::query()" app`); if the path under test inserts with `DB::table`, stop and report.

`WebhookRedeliveryTest.php`, "reads the stored message once per attempt":

```php
    $payloadReads = 0;

    IntegrationDeliveryPayload::retrieved(function () use (&$payloadReads): void {
        $payloadReads++;
    });

    runOutgoingWebhookJob(Queue::pushed(RedeliverWebhook::class)->sole())->assertNotFailed();

    expect($payloadReads)->toBe(1);
```

The `retrieved` event fires once per model read from the database. If the job reads the payload without the model, stop and report.

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

All tables are missing during the closure, not only the settings table. If this test fails because the login page reads another table, do not weaken it: stop and report the query.

- [ ] **Step 8: The test that read PostgreSQL's catalogue**

`UuidPrimaryKeysTest.php`, "has no integer key columns on application tables", reads `information_schema.columns` of the schema `public`. With the Schema builder:

```php
it('has no integer key columns on application tables', function () {
    $integerKeyColumns = collect(Schema::getTables())
        ->pluck('name')
        ->reject(fn (string $table): bool => in_array($table, ['migrations', 'jobs', 'failed_jobs', 'job_batches'], true))
        ->flatMap(fn (string $table) => collect(Schema::getColumns($table))
            ->filter(fn (array $column): bool => $column['name'] === 'id' || str_ends_with($column['name'], '_id'))
            ->filter(fn (array $column): bool => str_contains(strtolower($column['type_name']), 'int'))
            ->map(fn (array $column): string => "{$table}.{$column['name']}"));

    expect($integerKeyColumns)->toBeEmpty();
});
```

Run it on `pgsql` first: it must pass with the same tables as before. On SQLite a UUID column is `varchar`; on MariaDB `uuid`; on MySQL `char`: none contains `int`. If a column that is not a key ends in `_id` and is an integer on purpose (an external numeric id), the old test would have caught it too.

- [ ] **Step 9: Every other reader of SQL text**

Open the baseline and take each remaining line of the `tests` group. Each must be gone after this task except the two `driver branch` lines of Task 9. For a file not named above (a lane may have added one): if it counts queries, it does not need the text (`DB::enableQueryLog()` and `count(DB::getQueryLog())`); if it waits for a read or a write of a model, use the model's `retrieved`, `creating` or `saved` event; if it looks for a lock, `SqlProbe::locks`. One line per file in the task report.

- [ ] **Step 10: Run on three engines, lower the baseline, closing run, commit**

Run: `bin/test-db pgsql -- tests/Feature/Database/TestSupportTest.php tests/Feature/Games tests/Feature/Integrations tests/Feature/Admin tests/Feature/ErrorPagesTest.php tests/Feature/InstanceSettingsTest.php tests/Feature/Branding tests/Feature/UuidPrimaryKeysTest.php`, then `sqlite`, then `mariadb`.
Expected: PASS on the three, with four skips on SQLite (the three lock-order tests and the probe's own) and none on MariaDB.

Baseline: delete the lines of `InstanceAdminsTest.php` (2), `BrandInPageTest.php`, `GameAccessTest.php`, `IcebreakerRoomTest.php` (2), `InstanceSettingsTest.php`, `ActionItemExportTest.php` (2), `WebhookEventsTest.php`, `WebhookRedeliveryTest.php`, `WebhookSharesTest.php`. Arch suite, closing run.

```bash
vendor/bin/pint --dirty --format agent
git add tests/Support tests/Feature tests/Arch/database-portability-baseline.txt docs/superpowers/research/database-portability-baseline.md
git commit -m "test: tests use model events and a grammar-driven probe instead of reading SQL, and fail the database for real"
```

---

## Task 12: Triage of what only fails on another engine

From revision 1. Changed: the fixes of causes 3 and 6 and the allowed skips, which named helpers that no longer exist. **Never run the whole suite on an engine whose preflight fails.**

This task has no fixed size. It starts when Tasks 4 to 9 and 11 are merged into the plan's branch (Task 10 too if 18f is merged). Its input is the baseline file; its output is a suite green on SQLite and MariaDB, or a list of what is left with the reason.

**Files:**
- Modify: whatever the triage finds, within the rules below; `docs/superpowers/research/database-portability-baseline.md`
- Create: nothing, unless a fix needs a test

**Interfaces:**
- Consumes: every helper of Tasks 3 to 11.
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
| 2 | Order | two rows come in another order; the query has no `orderBy`, or its last key has ties | add the tie-breaker `->orderBy('id')` to the query. If the order is by a name shown to people, `Alphabetical::sort` (Task 8). |
| 3 | NULL position | a row with a NULL sort value is first on one engine and last on another | no raw `nulls last`. Filter the NULLs out if the list should not hold them; or order first by a column that is never NULL; or read the rows with a value and the rows without in two builder queries and concatenate them when the list is not paginated; for a paginated list, a stored rank maintained by the model, as `action_items.sort_rank` (stop and ask before adding a column) |
| 4 | Collation | a test expected two strings that differ by case or accent to be equal, or sorted them | the binary comparison is the rule (spec P4): fix the test's expectation; if the feature really needs to ignore case, fold in PHP and compare a stored key (stop and ask before adding a key column) |
| 5 | Date or time format | `2026-10-10` is not `2026-10-10 00:00:00`; a time has or lacks fractions; a comparison of two times fails by under a second | a date-only column: cast `DateOnly`. A time: compare Carbon values, or truncate with `startOfSecond()` where the value is created (the code already does at 8 sites) |
| 6 | A test that asserts an engine | SQL text, an error message of one engine, a `QueryException` where the model now refuses first, a JSON column compared as a string | the helpers of Task 11; `ModelInvariantViolation` (Task 9); for JSON, compare decoded arrays |
| 7 | JSON path lookup | a `where('settings->key', $value)` finds nothing on SQLite | the stored JSON value and the binding must have the same type: store a string and bind a string (as `chatId` and `installationId` do) |
| 8 | Length or strictness | PostgreSQL or MariaDB refuses a value SQLite accepted (too long, wrong type, a missing NOT NULL column in a raw insert of a test) | the value is wrong: fix the test data or add the validation the code lacks |

A failure that fits none of the eight: stop working on it, write in the baseline file its test name, the SQL (`DB::enableQueryLog()` around the call), and the result on PostgreSQL and on the failing engine. Go on with the next failure. At the end of the task these are the "unexplained" list; if there is one, the task ends `DONE_WITH_CONCERNS` and the owner is asked.

- [ ] **Step 3: Fix, cause by cause**

For each cause with more than one occurrence, fix one occurrence, run its file on the three engines, then apply the same fix to the others. After each file: `bin/test-db pgsql -- <file>`, `bin/test-db sqlite -- <file>`, `bin/test-db mariadb -- <file>`. A fix must never make PostgreSQL fail and must never add raw SQL, a driver test (`getDriverName`), a skip by driver, or a per-engine expectation: the Arch suite is run after each fix. A skip is allowed only through `SqlProbe::rowLocksExist()` or the absence of a lock connection (`config('cache.stores.database.lock_connection') === null`), and each new skip is listed with its reason.

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

Expected: the same number of tests on the four engines; the numbers of skipped tests differ only by the capability skips (SQLite: the three lock-order tests, the probe's own test and the cache lock test; none on MariaDB and MySQL). Write the four lines and the list of skips per engine in the baseline file. Any other skip is a finding.

- [ ] **Step 6: The closing run and the last commit of the task**

`bin/test-db pgsql`, `sqlite`, `mariadb`, `mysql`: all green.

```bash
git add docs/superpowers/research/database-portability-baseline.md
git commit -m "docs(database): the suite passes on four engines; triage record"
```

---

## Task 13: A busy database is answered "try again", and safe transactions are retried

From revision 1, unchanged. Retries are `DB::transaction($callback, Transactions::Attempts)`, a standard method; `Transactions` holds a constant and delegates to Laravel's `ConcurrencyErrorDetector`; it wraps no SQL. Isolation and the SQLite write lock are connection options of `config/database.php` (Task 1; spec §6.6 lists what options can and cannot express).

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

Laravel retries only an outermost transaction. Under `RefreshDatabase` every transaction is nested, so the feature suite never exercises a retry; Task 14 does.

Run: `bin/test-db pgsql -- tests/Feature/Database/RetriedTransactionsTest.php tests/Feature/Retros tests/Feature/Poker tests/Feature/Admin tests/Feature/Workspaces tests/Feature/Mcp`
Expected: PASS.

- [ ] **Step 6: Closing run and commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Support/Database/Transactions.php bootstrap/app.php lang app/Actions/Admin/RevokeInstanceAdmin.php app/Actions/Workspaces/CreateWorkspaceInvitation.php app/Actions/Mcp/IssueMcpToken.php app/Http/Controllers tests/Feature/Database/ConcurrencyErrorResponseTest.php tests/Feature/Database/RetriedTransactionsTest.php docs/superpowers/research/database-portability-baseline.md
git commit -m "feat(database): a busy database answers 503 with a retry delay, and database-only transactions are retried"
```

---

## Task 14: The concurrency suite

From revision 1, unchanged: its code uses models, `lockForUpdate()` and HTTP requests only. It also carries the proof of the three lock-order tests of Task 11 on every engine, SQLite included. Run it on one engine at a time, and only on engines whose `bin/test-db` preflight passes.

**Files:**
- Create: `tests/Concurrency/Support/Race.php`, `tests/Concurrency/HarnessTest.php`, `tests/Concurrency/LastInstanceAdminTest.php`, `tests/Concurrency/VoteLimitTest.php`, `tests/Concurrency/SavedDeckLimitsTest.php`, `tests/Concurrency/WhiteboardTemplateLimitTest.php`, `tests/Concurrency/ReactionUniquenessTest.php`, `tests/Concurrency/FirstIntegrationTest.php`, `tests/Concurrency/MagicLinkSingleUseTest.php` [18f]
- Modify: `tests/Pest.php`, `app/Actions/Poker/SavedPokerDeckRules.php`, `app/Http/Controllers/PokerDecksController.php:117-121`, `app/Http/Controllers/WorkspacePokerDecksController.php:17-21`, `app/Http/Controllers/WorkspaceTemplatesController.php:44-50`, `app/Http/Requests/WorkspaceTemplateRequest.php`, `app/Actions/Integrations/SaveTeamIntegration.php:44`

**Interfaces:**
- Consumes: `Transactions::Attempts` (Task 13), `NameKey` (Task 4), `bin/test-db <driver> --concurrency` (Task 1), [18f] `App\Actions\Auth\ConsumeMagicLink::handle(string $token): ?User`, `MagicLink::hashToken()`.
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

Red: on `mariadb` with `-e DB_COLLATION=utf8mb4_unicode_ci` (as in Task 10 Step 1). Expected: FAIL, one row: every emoji is the same value under that collation. Green on the four engines.

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

If 18f is not merged, skip this step and come back to it with Task 10 (see **Branches**).

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
vendor/bin/pint --dirty --format agent
git add tests/Concurrency tests/Pest.php app/Actions/Poker/SavedPokerDeckRules.php app/Http/Controllers/PokerDecksController.php app/Http/Controllers/WorkspacePokerDecksController.php app/Http/Controllers/WorkspaceTemplatesController.php app/Http/Requests/WorkspaceTemplateRequest.php app/Actions/Integrations/SaveTeamIntegration.php tests/Feature docs/superpowers/research/database-portability-baseline.md
git commit -m "test(concurrency): eight invariants are proved with real concurrent connections on four engines"
```

---

## Task 15: The guard rail closes: an empty baseline, and no allowed list

**Files:**
- Modify: `tests/Arch/DatabasePortabilityTest.php`, `tests/Arch/database-portability-baseline.txt`

**Interfaces:**
- Consumes: the baseline as Tasks 3 to 14 left it.
- Produces: an empty baseline, asserted by a test; no allowed list, asserted by the same test.

- [ ] **Step 1: Write the failing test**

Add to `tests/Arch/DatabasePortabilityTest.php`:

```php
it('excuses nothing: the baseline is empty and no allowed list exists', function () {
    expect(databasePortabilityBaseline())->toBe([])
        ->and(glob(__DIR__.'/database-portability-allowed*'))->toBe([]);
});
```

Run: `bin/test-db pgsql -- tests/Arch/DatabasePortabilityTest.php`
Expected: FAIL if a line is left (it prints them); PASS at once if every task lowered its lines.

- [ ] **Step 2: Empty the baseline**

For each line left: it belongs to a task that did not delete it, or to a lane merged since. Read the site and fix it with the patterns of this plan (a stored column, a relationship aggregate, a bounded read in PHP, a model event in a test). Nothing is moved to another list: there is none. A site that seems to need raw SQL: stop and report it with its query; it is a decision for the owner, like D8.

The three e-mail lines and `AdminCandidatesController.php` wait for Task 10 (18f): if 18f is still not merged, this task ends `BLOCKED` on them and says so; do not weaken the test.

- [ ] **Step 3: Two rule changes the revision decided (spec §11)**

In `databasePortabilityRules()`:

- delete the `'upsert'` rule: `upsert()` is a standard method the four grammars compile, and the owner rule names it;
- add, in `$source`: `'sql string on a connection' => '/->(?:scalar|select|selectOne|statement|unprepared|insert|update|delete|affectingStatement)\(\s*[\'"](?:select|insert|update|delete|alter|create|drop|pragma|set|show)\b/i',` — a string of SQL handed to a connection object, the form `DB::connection()->scalar('select @@…')` that the facade rules do not see.

Run the Arch suite: PASS (the second rule matches nothing if Task 16 was built as written).

- [ ] **Step 4: The greps of the acceptance criteria**

```bash
grep -rnE "Raw\(|DB::raw|DB::statement|DB::unprepared|new Expression|getDriverName|ilike|insertOrIgnore|date_trunc|nulls last|filter \(where" app database
ls tests/Arch
ls app/Support/Database
```

Expected: the grep prints nothing; `tests/Arch` holds `ArchTest.php`, `BrowserTestRulesTest.php`, `DatabasePortabilityTest.php` and the empty `database-portability-baseline.txt`; `app/Support/Database` holds `NameKey.php`, `SearchText.php`, `Transactions.php`, `DatabaseRequirements.php` (if Task 16 is done) and nothing named `Sql`, `TextSearch`, `CheckConstraint`, `InsertOnce`, `SqliteFunctions`.

- [ ] **Step 5: Commit**

```bash
git add tests/Arch
git commit -m "test(arch): no raw query, driver branch or engine-specific construct is left, and none is excused"
```

---

## Task 16: Operations

**Files:**
- Create: `app/Support/Database/DatabaseRequirements.php`, `app/Console/Commands/CheckDatabaseCommand.php`, `tests/Feature/Database/CheckDatabaseCommandTest.php`, `compose.production.mariadb.yaml`, `compose.production.sqlite.yaml`
- Modify: `config/database.php` (one option per connection), `tests/Feature/Database/ConnectionSettingsTest.php`, `Dockerfile:15,39`, `docker/scripts/prepare`, `.env.example:26-31`, `composer.json` and `composer.lock` (decision D3)

**Interfaces:**
- Produces: `App\Support\Database\DatabaseRequirements::problems(Connection $connection): array<int, string>`; the connection option `minimum_version`; the command `skrum:check-database` (exit 0 or 1). The class sends no SQL: it reads the connection's options, `getServerVersion()` and `Schema::getTables()`.

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

it('refuses a connection configured to ignore case or to read repeatable snapshots', function () {
    $default = config('database.default');

    config(['database.connections.loose' => [
        ...config("database.connections.{$default}"),
        'collation' => 'utf8mb4_unicode_ci',
        'isolation_level' => 'REPEATABLE READ',
    ]]);

    $problems = implode("\n", DatabaseRequirements::problems(DB::connection('loose')));
    DB::purge('loose');

    expect($problems)->toContain('utf8mb4_unicode_ci')
        ->toContain('READ COMMITTED');
})->skip(fn () => ! array_key_exists('isolation_level', config('database.connections.'.config('database.default'))), 'Applies to connections that have an isolation level option.');

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

it('refuses a connection that declares no minimum version', function () {
    $default = config('database.default');
    config(["database.connections.{$default}.minimum_version" => null]);
    DB::purge($default);

    expect(implode("\n", DatabaseRequirements::problems(DB::connection())))->toContain('minimum_version');
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

Add to `ConnectionSettingsTest.php`:

```php
it('declares the oldest version each engine is supported from', function () {
    expect(config('database.connections.pgsql.minimum_version'))->toBe('14.0')
        ->and(config('database.connections.mariadb.minimum_version'))->toBe('10.11.0')
        ->and(config('database.connections.mysql.minimum_version'))->toBe('8.4.0')
        ->and(config('database.connections.sqlite.minimum_version'))->toBe('3.35.0');
});
```

Run: `bin/test-db pgsql -- tests/Feature/Database/CheckDatabaseCommandTest.php tests/Feature/Database/ConnectionSettingsTest.php`. Expected: FAIL, class, command and option not found.

- [ ] **Step 2: Write `DatabaseRequirements`**

In `config/database.php`, add `'minimum_version' => '3.35.0',` to `sqlite`, `'8.4.0'` to `mysql`, `'10.11.0'` to `mariadb`, `'14.0'` to `pgsql` (and the same value to each `<driver>_locks` twin, which copies its connection). Connectors ignore options they do not know.

```php
<?php

namespace App\Support\Database;

use Illuminate\Database\Connection;

/**
 * What Skrum needs from its database. It asks the server nothing engine-specific: the connectors
 * apply the options of config/database.php at every connect, so the options are what the session
 * runs with; the version and the tables are read through the framework.
 */
class DatabaseRequirements
{
    /**
     * @return array<int, string>
     */
    public static function problems(Connection $connection): array
    {
        $config = $connection->getConfig();
        $name = $connection->getName();
        $minimum = $config['minimum_version'] ?? null;

        if ($minimum === null) {
            return ["The connection {$name} declares no minimum_version: it is not one of the engines Skrum supports (PostgreSQL, MariaDB, MySQL, SQLite)."];
        }

        $problems = [];
        $version = $connection->getServerVersion();

        if (version_compare($version, $minimum, '<')) {
            $problems[] = "The server version {$version} is older than the minimum, {$minimum}.";
        }

        $collation = $config['collation'] ?? null;

        if ($collation !== null && ! str_ends_with($collation, '_bin')) {
            $problems[] = "The connection collation is {$collation}. Skrum needs a binary collation (DB_COLLATION): with this one, different emoji and words that differ by case or accent are treated as equal.";
        }

        if (array_key_exists('isolation_level', $config) && $config['isolation_level'] !== 'READ COMMITTED') {
            $problems[] = 'The isolation_level of the connection must be READ COMMITTED: limits and uniqueness checks can otherwise be passed by two requests at once.';
        }

        if (array_key_exists('transaction_mode', $config) && $config['transaction_mode'] !== 'IMMEDIATE') {
            $problems[] = 'The transaction_mode of the connection must be IMMEDIATE: transactions otherwise take the write lock too late and concurrent writes fail.';
        }

        if (array_key_exists('journal_mode', $config) && $config['database'] !== ':memory:' && strtolower((string) $config['journal_mode']) !== 'wal') {
            $problems[] = "The journal_mode is {$config['journal_mode']}. Skrum needs wal: readers would otherwise block the writer.";
        }

        if (array_key_exists('foreign_key_constraints', $config) && ! $config['foreign_key_constraints']) {
            $problems[] = 'Foreign keys are off (DB_FOREIGN_KEYS): deleting a team or a retro would leave its rows behind.';
        }

        $looseTables = collect($connection->getSchemaBuilder()->getTables())
            ->filter(fn (array $table): bool => ($table['collation'] ?? null) !== null && ! str_ends_with($table['collation'], '_bin'))
            ->pluck('name');

        if ($looseTables->isNotEmpty()) {
            $problems[] = "{$looseTables->count()} tables were created with a collation that is not binary ({$looseTables->take(5)->implode(', ')}): they were created before the collation was set, and compare without regard to case.";
        }

        return $problems;
    }
}
```

`getSchemaBuilder()->getTables()` gives a `collation` for each table on MySQL and MariaDB and `null` elsewhere. If the SQLite connection has no `foreign_key_constraints` key under that name, read `config/database.php` and use the key it has.

- [ ] **Step 3: Write the command**

`art make:command CheckDatabaseCommand --no-interaction`, then:

```php
<?php

namespace App\Console\Commands;

use App\Support\Database\DatabaseRequirements;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

#[Description('Check that the database version and the connection settings are ones Skrum supports')]
#[Signature('skrum:check-database')]
class CheckDatabaseCommand extends Command
{
    public function handle(): int
    {
        $connection = DB::connection();

        $this->info("Checking the connection {$connection->getName()}, server version {$connection->getServerVersion()}...");

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

Follow a sibling command for the attribute style if the project's commands declare their signature otherwise. Run the tests on `pgsql`, `sqlite`, `mariadb`, `mysql`: PASS on the four (the second test runs where the connection has an isolation level option). Review Focus 1 is this test.

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

- [ ] **Step 8: PHP 8.4 (decision D3, ruled; a change of a requirement, shown to the owner in the report)**

`composer.json`: `"php": "^8.3"` becomes `"php": "^8.4"`. Then `docker exec -u sail -w "$TEST_DB_WORKDIR" "$TEST_DB_CONTAINER" composer update --lock --no-interaction`: only the content hash of `composer.lock` may change. `git diff --stat composer.lock`: a few lines; if a package version moved, undo and stop. SQLite's immediate transactions need PHP 8.4 (`SQLiteConnection.php:30`); with one floor the check command has no PHP test to make.

- [ ] **Step 9: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Support/Database/DatabaseRequirements.php app/Console/Commands/CheckDatabaseCommand.php config/database.php tests/Feature/Database/CheckDatabaseCommandTest.php tests/Feature/Database/ConnectionSettingsTest.php Dockerfile docker/scripts/prepare compose.production.mariadb.yaml compose.production.sqlite.yaml .env.example composer.json composer.lock
git commit -m "feat(ops): the image runs on PostgreSQL, MariaDB, MySQL and SQLite, and refuses settings it cannot trust"
```

---

## Task 17: Continuous integration, and SQLite as the default of the suite

From revision 1. Changed: `phpunit.xml` already has the `Upgrade` testsuite (Task 3); `composer.json` already requires PHP 8.4 (Task 16), so the workflow's PHP version must be 8.4 or later in every job; `bin/test-db` now runs a migration preflight in every job that uses it, and `bin/check-pg-upgrade` asserts the five legacy check constraints. Where a job runs the suite, add the `Upgrade` directory to what it runs if the job names directories.

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
Expected: PASS, the same numbers as `bin/test-db sqlite` at the end of Task 12.

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

The workflow first runs for real when the branch reaches a pull request; nothing is pushed by this plan. The report of Task 19 says that the CI jobs are written and not yet observed.

---

## Task 18: Documentation

**Files:**
- Modify: `docs/database.md` (it exists since Task 2 with the developer rules; this task adds the operator's half and brings the rules up to date), `README.md` (the configuration section and the `DB_PASSWORD` row)

`CLAUDE.md` is the owner's file and is not edited (decision D14).

- [ ] **Step 1: Write the operator's half of `docs/database.md`**

Sections, in this order, before "Running the tests on an engine". Numbers and names come from the code as it stands at this task (`config/database.php`), not from this plan, if they differ.

1. **Which database to choose.** A table of four rows:

   | Engine | Choose it when | Know that |
   |---|---|---|
   | PostgreSQL 14+ | by default | it is what Skrüm is developed on and what the browser tests run on |
   | MariaDB 10.11+ | it is what you already run and back up | Skrüm sets a binary collation and READ COMMITTED on its connection and refuses to start without them |
   | MySQL 8.4+ | same | same; tested nightly rather than on every change |
   | SQLite 3.35+ | you want one container and no database server, for a small instance | one writer at a time (see below) |

2. **SQLite: what "small" means.** Every write (a card, a vote, a reaction, a whiteboard stroke, a session, a queued job) waits for the one before it. A few teams and sessions of a few dozen people are fine. When writes queue for more than five seconds, the action fails with "The database is busy. Try again." (HTTP 503) and nothing is lost. The file must be on a local disk, never a network share. Back it up with `sqlite3 skrum.sqlite ".backup 'copy.sqlite'"`, not by copying the file while the application runs. Keep sessions and cache out of it (`SESSION_DRIVER=file`, `CACHE_STORE=file`).

3. **Settings Skrüm needs, and why.** One row per setting with what goes wrong without it: MariaDB and MySQL collation (`utf8mb4_nopad_bin`, `utf8mb4_0900_bin`; with a `_ci` collation every emoji is the same reaction and `Ada` is `ada`), isolation (READ COMMITTED), time zone (`+00:00`); SQLite `journal_mode` wal, `busy_timeout` 5000, `transaction_mode` IMMEDIATE, foreign keys on. Skrüm sets them on its own connection; `php artisan skrum:check-database` verifies the configuration, the server version and the collation of the tables, and the container runs it at start. PostgreSQL needs no setting: search and name comparison are folded by the application, so the locale of the database does not matter.

4. **What differs between engines.** The table of spec §9 in the operator's words: the order of capital and accented names in paginated lists; search respects accents everywhere; a search term with `%`, `_`, `*`, `?`, `[`, `]` or `\` on the paginated estimates page; dates beyond 2038 in a few nullable columns on MariaDB and MySQL; throughput.

5. **The database holds keys, not rules.** Skrüm writes through its models, which enforce its rules (who may be assigned, what a recurrence needs, who owns a deck) and maintain the columns search, order and uniqueness read (`name_key`, `email_key`, `*_search`, `sort_rank`, `week_start`). A row written by hand or by another tool is not checked and must set those columns itself.

6. **Installing.** The three Compose files and the four blocks of `.env.example`.

7. **Upgrading an existing PostgreSQL instance.** `php artisan migrate` (the container does it at start). What it does: adds the key, search, rank and week columns and fills them, one update per row, inside the migration (on a large instance, plan a window: give the time measured on the fixture and the rule of thumb per 100 000 cards); adds their indexes; drops four old indexes and five column defaults. If two templates of one workspace had names that differ only by case or a trailing space, both are kept and the log names them. **Five check constraints from earlier versions stay on your database**; a fresh install does not have them, and they duplicate rules the application enforces. They are harmless. To remove them (optional), run as the database owner:

   ```sql
   alter table action_items drop constraint action_items_single_assignee;
   alter table action_items drop constraint action_items_guest_assignee_needs_retro;
   alter table action_items drop constraint action_items_recurrence_needs_due_date;
   alter table team_health_statements drop constraint team_health_statements_builtin_or_custom;
   alter table poker_decks drop constraint poker_decks_single_owner;
   ```

   (This paragraph is decision D8 (a) with (c). The statements live in the documentation, not in the code.)

8. **Changing engine.** Not supported: there is no tool to move data from one engine to another.

Then bring the developer half up to date: rule 4 and rule 2 as Task 7 wrote them; rule 8 ("tests do not read SQL text; `Tests\Support\SqlProbe` is the one place that looks at a query, for lock order, and it takes the lock clause from the grammar"); the sentence about the baseline becomes "the baseline is empty: nothing is excused, and no allowed list exists"; add `bin/check-pg-upgrade`, the concurrency suite and how a race is written (`static` closures, scalars only, the 200 ms pause), the suite `Upgrade`, the preflight of `bin/test-db` and the rule "one file per engine until the migrations pass", and a table of what lives in `app/Support/Database` and `app/Concerns` (name, when to use it).

Write it in full sentences, in the present tense, without "simply" or "just"; the product name is written Skrüm in prose.

- [ ] **Step 2: `README.md`**

In the configuration section, replace the sentence that presents PostgreSQL as the database with two sentences: PostgreSQL is the default; MariaDB, MySQL and SQLite are supported, see `docs/database.md`. In the variables table, the `DB_PASSWORD` row becomes "Database password. Required, except with SQLite." Add a row `DB_CONNECTION` — "`pgsql` (default), `mariadb`, `mysql` or `sqlite`. See `docs/database.md`."

- [ ] **Step 3: Check the links and the names**

```bash
grep -o '`[A-Za-z\\]*::[a-zA-Z]*' docs/database.md | sort -u
grep -n "docs/database.md" README.md .env.example
```

Expected: every class and method the document names exists; the two files link to it.

- [ ] **Step 4: Commit**

```bash
git add docs/database.md README.md
git commit -m "docs: which database to choose, what each needs, what an upgrade does, and how to test on each"
```

---

## Task 19: The full matrix and the report

**Files:**
- Create: `docs/superpowers/research/database-portability-report.md`
- Modify: `docs/superpowers/research/database-portability-baseline.md`

- [ ] **Step 1: Merge the rewrite branch one last time**

Merge `plan-18e-screens` (or the branch that replaced it) into `plan-db-portability`. Run `bin/test-db pgsql -- tests/Arch`. An offence brought by the merge is fixed now, with the patterns of this plan. If `plan-18f-auth` arrived with this merge and Task 10 had not run, run Task 10, Step 7 of Task 7 and Step 8 of Task 14 before going on.

- [ ] **Step 2: Run everything, one command at a time**

```bash
bin/test-db pgsql
bin/test-db sqlite
bin/test-db mariadb
bin/test-db mysql
bin/test-db pgsql --concurrency
bin/test-db mariadb --concurrency
bin/test-db mysql --concurrency
bin/test-db sqlite-file --concurrency
bin/test-db sqlite-file -- tests/Feature/Database tests/Upgrade
bin/check-pg-upgrade
vendor/bin/pint --test
npm run build && bin/test-browser
```

and PHPStan in the container (`docker exec -u sail -w "$TEST_DB_WORKDIR" "$TEST_DB_CONTAINER" vendor/bin/phpstan analyse --no-progress`): no error in a file this plan created or edited; the count is not above the 15 the branch started with. Expected: every other line passes. The browser suite runs on PostgreSQL, as Task 17 made explicit in `bin/test-browser`.

For each engine, migrate from nothing and seed, outside the test suite (database `testing_l9`, never `skrum`):

```bash
for driver in pgsql mariadb mysql; do
    docker exec -u sail -w "$TEST_DB_WORKDIR" -e DB_CONNECTION=$driver -e DB_HOST=$driver -e DB_PORT= -e DB_URL= -e DB_DATABASE=testing_l9 -e DB_USERNAME=sail -e DB_PASSWORD=password "$TEST_DB_CONTAINER" php artisan migrate:fresh --seed --force
    docker exec -u sail -w "$TEST_DB_WORKDIR" -e DB_CONNECTION=$driver -e DB_HOST=$driver -e DB_PORT= -e DB_URL= -e DB_DATABASE=testing_l9 -e DB_USERNAME=sail -e DB_PASSWORD=password "$TEST_DB_CONTAINER" php artisan skrum:check-database
done
docker exec -u sail -w "$TEST_DB_WORKDIR" -e DB_CONNECTION=sqlite -e DB_URL= -e DB_DATABASE=database/testing_l9.sqlite "$TEST_DB_CONTAINER" php artisan migrate:fresh --seed --force
```

(an empty `DB_PORT` lets each connection use its default; if the configuration reads it as 0, give 5432 or 3306.) A seeder that fails off PostgreSQL is a finding: fix it with the patterns of this plan.

- [ ] **Step 3: Go through the acceptance criteria**

Open spec §14. For each of the twenty-one criteria, write in the report: the criterion, the command or test that shows it, its result on this run. A criterion without evidence from this run is written "not shown", never "done". Criterion 16 (CI) is "written, not observed" until a pull request exists; criterion 18 (the image) is the result of Task 16 Step 7.

- [ ] **Step 4: Write the report**

`docs/superpowers/research/database-portability-report.md`, sections in this order:

1. **Result.** The four summary lines of `bin/test-db`, the four of the concurrency suite, the line of `bin/check-pg-upgrade`, and the output of the greps of Task 15 Step 4 (empty).
2. **Acceptance criteria**, the table of Step 3.
3. **Skips per engine**, each with its capability and its reason (expected: SQLite, the three lock-order tests, the probe's own test and the cache lock test; none elsewhere).
4. **What the suite found that the audit had not**: the triage table of Task 12, counted by cause; the two races of Task 14.
5. **Red runs of the concurrency suite**: for C1 to C8, the protection removed and the failure seen.
6. **What replaced each kind of raw SQL**, counted: relationship aggregates, plain counts, stored columns (with the rows each backfill wrote on the fixture and its time), bounded reads in PHP (each with its bound), model events in tests.
7. **Decisions for the owner**: D3 (`composer.json` now requires PHP 8.4); D8 to D14 as built, each with what changes if the owner chooses otherwise; the one line proposed for `CLAUDE.md` ("Database code: Eloquent and the query builder only, no raw SQL, no driver test; rules in `docs/database.md`; `tests/Arch/DatabasePortabilityTest.php` enforces them."); anything decided during the run.
8. **What differs between engines, as observed** (not as predicted): the list of spec §9 with what the runs confirmed or contradicted, including the first runs of `GLOB` and `like binary`.
9. **Known limits**: existing PostgreSQL installs keep five check constraints; a write that bypasses the models is unchecked and must set the derived columns; a rename of a deck or template raced with another answers 500 (the data stays right); legacy duplicate addresses stay until an operator resolves them; a wildcard character in a search on the estimates page can shorten a page; the top templates count the latest hundred retros; nullable timestamps end in 2038 on MySQL and MariaDB; SQL Server does not migrate.
10. **Not shown**: every claim of the spec this run did not exercise (the CI jobs, PostgreSQL 14 and MariaDB 11.8 if not run locally, the image if it could not be built).
11. **Files changed**, counted by kind, against the estimate of the plan.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/research/database-portability-report.md docs/superpowers/research/database-portability-baseline.md
git commit -m "docs: database portability report"
```

No merge into `main`, no push.

---

## Self-review (done while revising; kept for the reader)

**Coverage of the baseline (72 lines).** `app/` (37 lines): Task 4 takes 3 (`WorkspaceTemplateRequest`, `SavedPokerDeckRules`, `WhiteboardTemplateRules`); Task 5 takes 23; Task 6 takes 4 (`ActionItemQuery`); Task 7 takes 3 (`SearchBoards`, `TeamEstimatesController`, `AdminCandidatesController`, the last finished with 18f); Task 8 takes 1 (`BuildSummaryInput|orderByRaw`); Task 10 takes 3 (`ResolveSsoUser`, `CreateWorkspaceInvitation`, `WorkspaceInvitationsController`). `database/` (21 lines): Task 3. `tests/` (14 lines): Task 3 takes 1, Task 9 takes 2, Task 11 takes 11. Total 72. Task 15 asserts the file is empty.

**Spec coverage.** §6.0 → Tasks 2, 15. §6.1 → Tasks 1, 3 (preflight). §6.2, §6.3 → Tasks 3, 4, 5, 6, 7, 10. §6.4.1 → Task 5. §6.4.2 → Task 6. §6.4.3 → Tasks 7, 10. §6.5 → Tasks 9, 10. §6.6 → Tasks 13, 14. §6.7 → Tasks 3, 9, 11. §6.8 → Task 12. §10 → Task 16. §11 → Tasks 2, 7, 15. §12 → Tasks 2, 7, 18. §13 → Task 17. §14: criterion 1 → 3, 17, 19; 2, 3 → 12, 19; 4 → 14; 5 → 3 to 10; 6, 7 → 15; 8 → 4, 14; 9 → 10, 14; 10 → 7; 11 → 5, 9; 12 → 9; 13 → 10; 14 → 13; 15 → 16; 16 → 17; 17 → 18; 18 → 16; 19 → 19; 20 → 5, 6; 21 → 3. §18: row 1 → Task 3 (the upgrade check asserts the difference) and 18; rows 2, 3 → 7; row 4 → 5; row 5 → 6; row 6 → 5; row 7 → 16; row 9 → 3, 11.

**Not run.** Tasks 1 and 2 ran; nothing else did. Every "Expected" from Task 3 on is a prediction. The ones most likely to be wrong, each with what the task says to do then: the output format the preflight greps (Task 3 Step 1); the text `pg_dump` prints for a check constraint (Task 3 Step 3: fix the filter); `->default(null)->change()` on four engines (Task 6 Step 3); `whereLike(..., caseSensitive: true)` on SQLite and MySQL (Task 7 Step 4: stop, D9); `RetroHealthStatement::answers()` against the old query (Task 5 Step 4: compare before deleting); whether a participant of an answer always belongs to the answer's retro (Task 5 Step 4: stop if not); mass assignment and `HasUuids` rules on the new `GameUsedWord` model (Task 5 Step 2); the legacy columns the upgrade test must insert (Task 3 Step 4); factories named in the new tests.

**Copied from revision 1 with their numbers moved and their list steps rewritten:** Tasks 4, 8, 9, 10, 12, 13, 14, Steps 4 to 7 of Task 16, and Task 17. Their code was already builder-only; what changed in them is named at the top of each.

**Type consistency.** `NameKey::of(string): string` in Tasks 4, 14 and its migration. `SearchText::fold(?string): ?string`, `pattern(string): string`, `contains(?string, string): bool` in Tasks 7, 10 and two migrations. `HasSearchColumns::searchColumns(): array<string, string>` on eight models. `ActionItem::sortRankFor(bool, ?string, ?ActionItemPriority): int` in Task 6 and its migration. `Retro::voteCountsByCard(?Participant): Collection<string, int>` at four sites. `SqlProbe::locks(Closure): array<int, array{table: string, level: int}>`, `lockedTables(Closure): array<int, string>`, `rowLocksExist(): bool` in Task 11. `DatabaseRequirements::problems(Connection): array<int, string>` in Task 16 (no `warnings()`). `Transactions::Attempts`, `isConcurrencyError(Throwable): bool`, `busyMessage(): string` in Tasks 13, 14. `Alphabetical::key(string): string`, `sort(Collection, callable): Collection` in Tasks 8, 12.

**Estimated size.** Seventeen tasks remain. About 55 files of `app/` edited, 11 models, 12 historic migrations edited, 8 new migrations (5 with a backfill), about 25 new test files, 18 test sites rewritten, 4 scripts or workflow files. Against revision 1's Tasks 3 to 18 this is roughly a third more work in Tasks 5 to 7 (three stored columns with their migrations, backfills and tests; relationship aggregates site by site) and a little less elsewhere (five helpers and their tests are gone; the check-constraint twin tests are gone). The triage (Task 12) keeps no fixed size and remains the main uncertainty.
