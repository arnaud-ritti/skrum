# Database portability: final report

Branch `plan-db-portability` (worktree `.claude/worktrees/laneDb`), from `plan-18e-screens` at `40f6da45`, with
`plan-18e-screens` (`159dab00`) and `plan-18g-cleanup` (`c984b963`) merged in. Final run on 2026-10-03 at
`8ea5ce49` (code), this report committed on top. Not pushed; `main` untouched. Spec: `docs/superpowers/specs/2026-10-19-database-portability-design.md`
(revision 2); plan: `docs/superpowers/plans/2026-10-19-plan-database-portability.md`; audit:
`database-portability-audit.md`; per-run record: `database-portability-baseline.md`.

Goal reached: Skrüm migrates and runs on PostgreSQL, SQLite, MariaDB and MySQL from one code base, with Eloquent,
the standard query builder and the Schema builder only. No raw SQL and no driver branch is left in `app/` or
`database/`, and the architecture test excuses nothing.

## 1. Result

### The matrix (run for this report)

One command at a time in the shared app container, database `testing_l9`, `TEST_DB_PROCESSES=4`.

| Run | Result | Time |
|---|---|---|
| `bin/test-db pgsql` (PostgreSQL 18.6) | `PASS, Tests: 2 skipped, 5937 passed (54506 assertions)` | 3 min 39 |
| `bin/test-db sqlite` (in memory) | `PASS, Tests: 8 skipped, 5931 passed (54493 assertions)` | 1 min 01 |
| `bin/test-db mariadb` (MariaDB 10.11.19) | `PASS, Tests: 1 skipped, 5938 passed (54508 assertions)` | 4 min 04 |
| `bin/test-db mysql` (MySQL 8.4.11) | `PASS, Tests: 1 skipped, 5938 passed (54508 assertions)` | 7 min 44 |
| `bin/test-db pgsql --concurrency` | `PASS, Tests: 1 skipped, 19 passed (85 assertions)` | 1 min 39 |
| `bin/test-db mariadb --concurrency` | `PASS, Tests: 1 skipped, 19 passed (85 assertions)` | 1 min 46 |
| `bin/test-db mysql --concurrency` | `PASS, Tests: 1 skipped, 19 passed (85 assertions)` | 2 min 10 |
| `bin/test-db sqlite-file --concurrency` (SQLite 3.45.1 in the container) | `PASS, Tests: 1 skipped, 19 passed (86 assertions)` | 1 min 40 |
| `bin/test-db sqlite-file -- tests/Feature/Database` | `PASS, Tests: 4 skipped, 191 passed (363 assertions)` | 8 s |
| `bin/check-pg-upgrade` | `PASS, every row is there, and the schemas are equal apart from the five legacy check constraints` | 5 s |
| `skrum:check-database` on `testing_l9` (pgsql, mariadb, mysql) and `database/testing_l9.sqlite` | "The database is ready." on all four | — |
| Arch (`tests/Arch`, inside each whole suite) | green on the four engines | — |
| `composer types:check` (PHPStan level 7, result cache cleared) | `passed`, 0 errors | 30 s |
| `vendor/bin/pint --test` | `passed` | — |
| `php artisan wayfinder:generate --with-form`, then `npm run types:check` (`tsc --noEmit`) | no error | 12 s |

All whole suites ran with four processes (the PostgreSQL one as `bin/test-db pgsql -- --parallel --processes=4`,
the others with `TEST_DB_PROCESSES=4`). Every run of this table was on the final code (`8ea5ce49`; the commit after it
adds this report only). The 5 939 tests are the same on every engine; only the skips differ (§4).

The whole suites contain Unit, Feature, Upgrade and Arch (the arch suite runs inside each of them).
`tests/Upgrade` is not run on a SQLite file: `migrate:fresh` empties a SQLite file by truncating it while the open
WAL connection still holds frames, and every Upgrade test then reads a "malformed" database (12 of 12, Task 17's
finding). It passes on SQLite in memory and on the three servers, inside their whole suites above. The CI
`sqlite-file` job runs `tests/Feature/Database` and the concurrency suite for the same reason.

Not run, by instruction: the browser suite (`bin/test-browser`), and `migrate:fresh --seed` by hand (the agents of
this run may not migrate or seed outside `bin/test-db`). The seed on each engine was last shown by Task 17 (see
criterion 1).

Acceptance greps of Task 15 on the final tree:

```
$ grep -rnE "Raw\(|DB::raw|DB::statement|DB::unprepared|new Expression|getDriverName|ilike|insertOrIgnore|date_trunc|nulls last|filter \(where" app database
app/Enums/SsoProvider.php:90:        $claims = $user->getRaw();
$ ls tests/Arch
ArchTest.php  BrowserTestRulesTest.php  DatabasePortabilityTest.php  FrontEndPagesTest.php  FrontEndRulesTest.php
```

The one hit is Socialite's `getRaw()` (the provider's claims), not SQL. No baseline file and no allowed list
exist; `DatabasePortabilityTest` asserts it.

## 2. What was built, per task

| Task | What | Commits |
|---|---|---|
| 1 | `bin/test-db <sqlite\|sqlite-file\|pgsql\|mariadb\|mysql> [--concurrency]`; Sail services `mariadb` 10.11 and `mysql` 8.4; connection settings (binary no-pad collations, READ COMMITTED, `+00:00`; SQLite WAL, busy timeout 5 s, `IMMEDIATE`); lock connections per engine; `ConnectionSettingsTest` | `d0ed4ec5` |
| 2 | `tests/Arch/DatabasePortabilityTest.php`: every raw construct, driver branch and engine-specific construct in `app/`, `database/`, `tests/` listed (72 lines then) and none may be added; the rule in `docs/database.md` | `985bf55c` |
| 3 | Migrations with the Schema builder only (twelve historic ones edited, two long index names made explicit); `bin/test-db` preflight (exit 3 naming the migration); `bin/check-pg-upgrade` and its fixture; `tests/Upgrade` | `3731919d`, `cf560a8a`, `36b2f9d6`, `66eae6cc` |
| 4 | Names unique through a stored `name_key` (templates, whiteboard templates, decks) | `dd9f0b06`; fixes at integration `ceb5e64c` |
| 5 | Aggregates, leaderboards and one-time inserts through Eloquent relations and models; `game_points.week_start`; `GameUsedWord` | `e8192f86`, `22223914`, `b27f6684`, `4ba98f79` |
| 6 | The action-item list ordered by a stored `sort_rank` | `4450c89f`; fixes at integration `3b917e50` |
| 7 | Search through stored folded `*_search` columns (`SearchText`, `HasSearchColumns`) | `9a6a6301`, `7a15d639`, `7ab8f2cd`, `1c04f22e` |
| 8 | Lists read by people sorted in PHP (`Alphabetical`) | `d7d96191`, `0bee1cb2`, `513acc4a` |
| 9 | Five rules enforced by the models (`ModelInvariantViolation`); due dates stored as days (`DateOnly`) | `fb0aeadb`, `41d7b406`, `c0315cfa` |
| 10 | `users.email_key`; invitation addresses normalised; the 18f workspace search and the admin search on folded columns; `users:report-duplicate-emails`; PHP ^8.4 | `d48cd72f`, `568363f5`, `defe3b13`, `e783deb1`, `0f54cc43`, `d5359888`, `57c5dfa7`, `cbfb51d6` |
| 11 | Tests stop asserting an engine: `SqlProbe`, `DatabaseFailure`, `UnreachableDatabase`, `MissingTables` | `33310e8b`; fixes at integration `99a4013f`, `4fc09f35`, `a4703d96` |
| 12 | Triage: the 12 MySQL failures were the key order of JSON columns; fixed in the tests (`toBeIgnoringKeyOrder`) | `f4eb8bdd` |
| 13 | A busy database answers 503 with `Retry-After: 1`; ten database-only transactions retried (`Transactions`) | `7bbd836c`, `97041529` |
| 14 | Concurrency suite `tests/Concurrency` (20 tests, `Race`), three real defects fixed | `d1a2d452`, merged `4902557d`; docs `8ea5ce49` |
| 15 | The guard rail closes: baseline file and mechanism removed, two rules added | `32de37f2`, `e8f58c86` |
| 16 | `skrum:check-database`, `DatabaseRequirements`, image on four engines, `compose.production.{mariadb,sqlite}.yaml`, `DB_CONNECTION` required | `44869cfd`, `87e0b107`, `312ecb45`, `f4576819` |
| 17 | `phpunit.xml` defaults to SQLite in memory; `.github/workflows/tests.yml` with the engine matrix | `f179ec0d` |
| 18 | `docs/database.md` (operator and contributor halves), `README.md` | `b5c0ef64` |
| — | PHPStan brought from 65 errors to 0 (14 added by this branch, 51 inherited from the front rewrite) | `22dd1b21`, `afa640ec`, `411d90f2`, `f017d5df` |
| 19 | This report and the last baseline section | `4902557d` (merge of Task 14), `8ea5ce49`, and the commit of this report |

Integration merges: `674ba306` (18e), `6c2db032`, `dab1a015`, `4e3ae4cb`, `9e71dd27`, `e649b409` (wave 1),
`842d5fef` and `fe22056d` (18g), `c3db8b65`, `7d8a3e2b`, `22da3938`, `43a6717d`, `3f063bb6` (wave 2), `4902557d`
(Task 14).

Files changed by the plan (`git diff c984b963 HEAD`, i.e. after the front rewrite): 233 files, +11 333 / −837.
`app/` 100 (Actions 36, Http 22, Models 21, Support 9, the rest 12), `database/` 25 (23 migrations), `tests/` 78
(Feature 50, Concurrency 10, Upgrade 6, Support 4, Unit 4, Arch 1, Pest/TestCase/fixture 3), configuration and
operations 16, documentation 5, language files 4. The plan estimated about 55 files of `app/` and eleven models:
the real count is higher because the PHPStan clean-up (`afa640ec`, `411d90f2`, `f017d5df`) typed files the plan did
not own, and Task 14 fixed three controllers and an action.

## 3. Acceptance criteria (spec §14)

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | `migrate:fresh --seed` on PostgreSQL 18, MariaDB 10.11, MySQL 8.4, SQLite memory and file | this run: `migrate:fresh` (no seed) by the `bin/test-db` preflight on all five, and `skrum:check-database` "ready" on four; the seed was run by Task 17 on pgsql 18.6, mariadb 10.11.19, mysql 8.4.11 and SQLite (memory and file), and `DatabaseSeeder` is exercised by `SearchColumnsTest` "gives the user created by the default seeder a folded name" on four engines | **met** (the seed step not repeated in this run: agents may not seed by hand) |
| 2 | Feature, Upgrade, Unit, Arch pass on SQLite memory, PostgreSQL 18, MariaDB 10.11 with the same tests; skips per engine by capability only | whole suites §1: 5 939 tests each, 0 failed | **met**; skips in §4 (one more capability than the spec named: the isolation-level check) |
| 3 | Feature suite passes on MySQL 8.4 | `bin/test-db mysql`: 5 938 passed, 1 skipped | **met** |
| 4 | Concurrency suite C0–C8 on PostgreSQL, MariaDB, MySQL, SQLite file; a red run for each of C1–C8 | §1 (19 passed + 1 capability skip on each); red runs §6 (Task 14, three green runs per engine there, one more here) | **met** |
| 5 | `bin/check-pg-upgrade`: same rows, unchanged names, schema equal to fresh except the five legacy checks | §1, PASS | **met** |
| 6 | Baseline empty and no allowed list | neither file exists; `DatabasePortabilityTest` "excuses nothing" green on four engines | **met** (the file is deleted rather than empty) |
| 7 | The acceptance grep returns nothing | §1: one hit, Socialite's `$user->getRaw()` | **met in substance** (the pattern `Raw\(` matches a non-SQL method name) |
| 8 | Duplicate names (case, spaces) refused by the form (422) and the model (`UniqueConstraintViolationException`) on each driver | `NameKeysTest` (database), `SavedPokerDecksTest`, `WorkspacePokerDecksTest`, template tests (form); concurrent: C5, C5t, C6 | **met** |
| 9 | Two different emoji of one participant on one card; removing one keeps the other | `CollationTest` "keeps two different emoji…", C7 | **met** |
| 10 | `100%` finds `100%` not `1000`; `ÉTÉ` finds `été`; `ete` does not | `SearchColumnsTest` ("treats wildcard characters of the term as text", "finds a text whatever the case…", "does not find an accented letter by its plain form"), `SearchTextTest` | **met** |
| 11 | An item due tomorrow is reminded once; a second run the same day reminds nobody | `ReminderSelectionTest`, `ReminderCommandTest`, `DateOnlyStorageTest` | **met** |
| 12 | The five model rules refuse the row with `ModelInvariantViolation` | `ModelInvariantsTest` | **met** |
| 13 | Address in any case; legacy duplicates refused by SSO and the magic link; a new account cannot take a legacy address | `EmailKeyTest`, `ResolveSsoUserTest`, `MagicLinkTest`, `EmailAddressNormalisationTest`; C2 for the magic link's single use | **met** |
| 14 | 503 + `Retry-After` in JSON, a toast for Inertia, the 503 page for a browser | `ConcurrencyErrorResponseTest` (9 tests), C3r, C3s; front end: `maintenance-reload.test.ts` (Task 13) | **met as built**; the Inertia behaviour (toast, page kept, no replay) awaits the owner |
| 15 | `skrum:check-database` exits 0 on four configurations, non-zero naming the setting for `utf8mb4_unicode_ci`, no READ COMMITTED, SQLite `journal_mode` `delete` | `CheckDatabaseCommandTest` (10 tests); this run: "ready" on four `testing_l9` databases; image refusals in Task 16 | **met** |
| 16 | CI has the jobs of §13 and the required ones pass on the branch | `.github/workflows/tests.yml` written; never run on GitHub | **written, not observed** |
| 17 | `docs/database.md` with §12's sections; `README.md` links; `.env.example` four blocks | files read for this report; `Race` paragraph corrected after the Task 14 merge (`8ea5ce49`) | **met** |
| 18 | The image starts on PostgreSQL, MariaDB, SQLite, migrates, serves `/up` | Task 16 step 7 (`tasks-16-17-18` report): PostgreSQL 18.6, MariaDB 11.8.9, SQLite 3.53.4, and MySQL 8.4.11; refusals shown | **met** (Task 16's run, not repeated here) |
| 19 | The browser suite passes on PostgreSQL after the last task | not run (owner's instruction to this run) | **not shown** |
| 20 | Action-item order on first and second page; the same twenty on the team leaderboard; streaks count the same weeks | `ActionItemOrderTest` "keeps the order across the page boundary", `TeamGameLeaderboardTest` (leaderboard and streaks), `WeekStartTest`, on four engines | **met** |
| 21 | `bin/test-db <driver>` on a schema that does not migrate exits 3 in under a minute and names the migration | Task 3: MariaDB 2 s, SQLite 0.5 s, MySQL 4 s, naming the migration; not repeated (the schema now migrates everywhere) | **met** (Task 3's run) |

## 4. Skips per engine (all capability skips)

| Engine | Skips | Which, and why |
|---|---|---|
| SQLite (memory) | 8 | the three lock-order tests (`InstanceAdminsTest`, `ActionItemExportTest`, `IcebreakerRoomTest`) and the probe's two own tests (`TestSupportTest`): no row lock, write transactions are serialised; `CacheLockConnectionTest`: one writer, the lock lives on the caller's connection by design; `CheckDatabaseCommandTest` isolation case: no isolation level option; `BrandPaletteTest`: no comma-decimal locale in the container (every engine) |
| PostgreSQL | 2 | `CheckDatabaseCommandTest` isolation case (the pgsql connection has no `isolation_level` option); `BrandPaletteTest` |
| MariaDB, MySQL | 1 | `BrandPaletteTest` |
| Concurrency, server engines | 1 each | C3s (the busy SQLite file): a server engine waits for a row, not for the database |
| Concurrency, SQLite file | 1 | C3r (a real deadlock): `BEGIN IMMEDIATE` takes the one write lock at the start, no deadlock can be made |

Spec §14.2 expected only the row-lock and cache-lock skips to differ per engine; the isolation-level check test
also differs (the option exists on MariaDB and MySQL only). It is a capability, not a gap.

## 5. Real defects found along the way

Not portability differences: bugs that existed on PostgreSQL too, or that the new engines exposed.

| # | Defect | Where found | Fix |
|---|---|---|---|
| 1 | Saved decks and workspace templates: the name was checked before the owner lock, so two requests creating the same name at once both passed validation; the loser hit the unique index: **500** on every engine | Task 14, C5 / C5t (5 × 500 of 6) | name checked again under the owner's row lock (`SavedPokerDeckRules::ensureNameIsFree()`, `WorkspaceTemplateRequest::nameIsTaken()`) |
| 2 | The same on **rename**: deck updates had no transaction; the template update locked only the template: 302 + 500 | Task 14, C5r | lock the owner (`SavedPokerDeckRules::lockOwner()`), re-check, then save |
| 3 | `SaveTeamIntegration` locked an integration row that did not exist yet: the first connection of an integration, sent several times at once, gave unique violations to 5 of 6 callers | Task 14, C8 | lock the team row first |
| 4 | Emoji reactions under a `_ci` collation: every emoji compares equal, so a second reaction is refused as a duplicate and removing one removes "both" | Task 14, C7 with `utf8mb4_unicode_ci` | binary no-pad collations in `config/database.php`; `skrum:check-database` refuses a non-`_bin` collation and non-binary tables |
| 5 | Limits counted under REPEATABLE READ read a stale snapshot: 51 whiteboard templates where 50 is the cap, and a unique violation for the name | Task 14, C6 on MariaDB and MySQL at their default isolation | READ COMMITTED on the connection; checked by `skrum:check-database` |
| 6 | The team mood trend counted participants who answered in another retro | Task 5 review | the inner `whereHas` tied to `participants.retro_id` (`22223914`) |
| 7 | A reminder already logged was not found again on SQLite (date with a time part): reminded twice the same day | Task 3 baseline, Task 5 / 9 | `DateOnly` cast; due dates bound as day strings |
| 8 | `DatabaseSeeder` uses `WithoutModelEvents`, so a seeded user had no `name_search` | Task 7 review | the folded column filled when missing |
| 9 | `ActionItem` rank recomputed from a partial read (`select('id', 'content')`) ranked the item as an undated low; a new item without priority ranked low but stored medium | Task 6 review | `3b917e50` |
| 10 | `GameAccessTest` "survives a concurrent first visit" no longer raced after the front-end merge (the shared Inertia props open a transaction before the controller) | integration of wave 1 | the rival row is written when `FindGamePlayer` opens its transaction (`4fc09f35`); a test defect, not a product one |
| 11 | Two index names longer than 64 characters: PostgreSQL had silently cut them, MariaDB and MySQL refused the migration | Task 3 | explicit names, the ones PostgreSQL already had |
| 12 | Handing over hosting or naming a round leader with a malformed id answered 500 (an error on PostgreSQL, no row elsewhere) | wave 1 | a `uuid` rule: 422 |

## 6. Red runs of the concurrency suite (protection removed locally, nothing committed)

From the Task 14 report; each run restored and verified with `git diff --stat`.

| # | Protection removed | Failure seen |
|---|---|---|
| C1 last admin | `lockForUpdate` on the admin rows | pgsql, mariadb, mysql: **0 admins left**; SQLite with `DEFERRED` and no retries: one contender ends in an exception |
| C2 magic link | conditional update replaced by read-then-save | **6 winners** on all four engines |
| C3 vote limit | the two row locks | pgsql 8 votes, mariadb 4, mysql 4 (limit 3) |
| C3r deadlock retry | `Transactions::Attempts` on the vote | 503 and no broadcast on pgsql, mariadb, mysql |
| C3s busy SQLite | busy timeout raised to 10 s | 201 instead of 503 (the test then fails as intended) |
| C4 saved decks cap | team row lock | pgsql 32, mariadb 32, mysql 35 (cap 30) |
| C5 / C5r / C5t names | re-check under the owner lock | 5 × 500 on create; 302 + 500 on rename (before the fix) |
| C6 whiteboard template cap | READ COMMITTED (REPEATABLE READ instead) or the workspace lock | 51 templates and a unique violation |
| C7 emoji | binary collation (`utf8mb4_unicode_ci` instead) | one row for two emoji |
| C8 first integration | team row lock (before the fix) | unique violation for 5 of 6 callers |

### What replaced each kind of raw SQL (116 occurrences on 72 baseline lines at Task 2)

| Kind (Task 2 count) | Replaced by |
|---|---|
| Grouped `selectRaw` aggregates (13), conditional counts (5), leaderboards (2) | relationship aggregates (`withCount`, `withSum`, `withAvg`, `withMax`, cast in PHP) and plain `count()` on clones of a scope; bounded reads counted in PHP where no builder form exists (top templates: 100 latest retros, D11) |
| `date_trunc` (2) | stored `game_points.week_start` |
| `whereRaw('lower(x) = ?')` (7) | stored `name_key` / `email_key` and a plain `where` |
| `whereRaw('false')` (2) | `whereIn('id', [])` or an early return |
| `orderByRaw` with `nulls last` and computed keys (4) | stored `action_items.sort_rank` |
| `orderByRaw('lower(…)')` (2) | `Alphabetical::sort()` in PHP on the loaded set |
| `DB::raw` (2) | `whereExists` with a real column; `increment()` |
| `insertOrIgnore` (2) | `createOrFirst` on two small models (`GameUsedWord`, …) |
| `ilike` / `like` (8, plus 7 in the 18f search) | stored `*_search` columns, `whereLike(..., caseSensitive: true)` and an exact check in PHP (`SearchText`) |
| Migrations: expression indexes (4), check constraints (5), `::jsonb` defaults (5), raw backfill (4), driver branches (5), non-null `timestamp` (7) | Schema builder only: `name_key` unique indexes, model guards, model `$attributes`, `lazyById` query-builder loops, `dateTime()` |
| Tests reading SQL text, lock syntax, driver branches (14 lines) | `SqlProbe` (grammar-driven), model events, `DatabaseFailure` |

## 7. Behaviour changes users and operators will see

- **Alphabetical order** (Task 8): name lists are sorted in PHP, the same on every engine: case ignored, accents
  folded (`adam, Bob, Élodie, Émile, eve, Zoe`). It can differ slightly from the former PostgreSQL locale order
  (punctuation, `ß` → `ss`, `Æ` → `AE`); names with no Latin form (CJK, emoji) come after the Latin ones by code
  point; equal names keep id order. A limited query (which five members show on a card, which "other admin" is
  named, the fallback workspace) still picks its rows in SQL order, then the shown rows are sorted. Survey text
  answers, recap names and Jira projects follow the same order; a survey with more than 50 text answers sends the
  first 50 alphabetically to the summary.
- **Model guards** (Task 9): a row breaking one of the five rules throws `ModelInvariantViolation` (500) on every
  engine, where PostgreSQL threw a `QueryException` and the others wrote silently.
- **E-mail keys** (Task 10): addresses are looked up through `users.email_key` (hidden from serialised users);
  invitation addresses are stored lower-case and trimmed (`Invited@Example.com` shows as `invited@example.com`);
  admin candidate search reads at most 200 accounts.
- **Busy database** (Task 13): a deadlock, lock-wait timeout or busy SQLite that survives the retries answers
  **503 with `Retry-After: 1`**, "The database is busy. Try again." in JSON; an Inertia form receives the header
  `X-Database-Busy` and shows an **error toast while keeping the page** (the action is not replayed: option (b) of
  Task 13). **This last choice still needs the owner's confirmation.** A plain browser request sees the 503 page
  with the busy wording. French: "La base de données est occupée. Réessaie." (informal register, after the 18g
  tutoiement).
- **Names**: workspace template names are compared trimmed, like decks and whiteboard templates. Concurrent
  creation or rename to one name now answers 422 to the loser instead of 500.
- **Search**: case ignored on every engine, accents kept (`ete` does not find `Été`); wildcard characters are
  matched exactly (on the estimates page such a term can give a short page, D10).
- **Top templates** of a team count its 100 latest retros (D11).
- **Operators**: `php artisan skrum:check-database` runs at every container start before the migrations and stops
  the container with one sentence per problem (collation, isolation, SQLite modes, foreign keys, server version,
  non-binary tables, unsupported engine). **`DB_CONNECTION` is now required** (and `DB_DATABASE` for SQLite).
  **`composer.json` requires PHP `^8.4`** (D3). Two new Compose files (MariaDB, SQLite; the SQLite one keeps
  sessions and cache in the container: recreating it logs everyone out).

## 8. Decisions taken on the owner's behalf, and how to overturn each

| # | Built as | To overturn |
|---|---|---|
| D1 | SQLite documented as supported for small instances, one-writer limit stated | reword `docs/database.md` "Which database to choose" |
| D2 | PostgreSQL stays the default of a fresh install (`.env.example`, `compose.production.yaml`) | swap the uncommented block in `.env.example` |
| D3 | `composer.json` `php: ^8.4` (approved by the owner in round 8; shown again here) | revert `e783deb1` / `87e0b107` (`content-hash` only in the lock); SQLite's `transaction_mode` needs 8.4 |
| D4 | Minimum versions PostgreSQL 14, MariaDB 10.11, MySQL 8.4, SQLite 3.35 (`minimum_version` per connection) | edit the four `minimum_version` keys in `config/database.php` and the docs table |
| D5 | `users.email_key` stored column; legacy duplicates refused, reported by `users:report-duplicate-emails` | a new migration and `User` changes; no smaller switch |
| D6 | Lists sorted in PHP through `Alphabetical` | replace `Alphabetical::sort()` calls by `orderBy('name')` (accepting per-engine order) |
| D7 | SQL Server not supported (no `minimum_version`, refused by the check) | a separate plan |
| D8 | Existing PostgreSQL installs keep their five check constraints; docs give the five `drop constraint` statements | option (b) of the spec: a migration with `dropUnique()` guarded by `Schema::hasIndex()`; (d) raw statements only on the owner's word |
| D9 | Search through stored folded columns | (b) PHP filter over `lazy()` reads, dropping the nine columns |
| D10 | Wildcards match one character in SQL and are checked exactly in PHP | (b) strip them from the term in `SearchText` |
| D11 | Top templates over the 100 latest retros | raise the bound in `TopTeamTemplates`, or (c) a stored counter |
| D12 | Three lock-order tests kept through `SqlProbe` | delete the three assertions; the concurrency suite still proves the invariants |
| D13 | No arch rule against `function down(` | add the rule and rewrite the three stock migrations |
| D14 | The rule lives in `docs/database.md` and the arch test message; `CLAUDE.md` untouched | paste the line below into `CLAUDE.md` |

Proposed line for `CLAUDE.md` (not written by agents): "Database code: Eloquent and the query builder only, no raw
SQL, no driver test; rules in `docs/database.md`; `tests/Arch/DatabasePortabilityTest.php` enforces them."

Taken by the agents during the run:

| Decision | Why | To overturn |
|---|---|---|
| The MySQL JSON key order is fixed in the tests (`toBeIgnoringKeyOrder`), not in code | no code depends on key order (rendered as JSON or read by key) | normalise the order on read in the casts |
| The arch test "lists nothing that is no longer there" was **deleted** with the baseline file (a test deletion the owner should know) | meaningless without a baseline; replaced by "excuses nothing: no baseline and no allowed list exist" | restore from `32de37f2^` together with a baseline |
| Two arch rules beyond the plan: `engine-specific operator` (`like binary`, `regexp`, `~*`, `@>`…) and a wider `reads sql text` (`collect(DB::getQueryLog())`, `pluck('query')`, `DB::listen`) | the `like comparison` rule missed operator strings; the query log was being read around the rule | remove the patterns from `DatabasePortabilityTest` |
| `upsert` removed from the forbidden list | a standard method supported by the four grammars, named by the owner rule | add it back |
| Alphabetical details: names without a Latin form after the Latin ones by code point; ties by id; the visible rows of a limited query chosen in SQL order | stable and identical on four engines | change `Alphabetical` |
| Five duplicated model-rule tests kept (`ActionItemModelTest`, `WorkspacePokerDecksTest`, `HealthStatementModelsTest` vs `ModelInvariantsTest`) | deleting tests needs the owner | delete them |
| Rename races (C5r) fixed beyond the plan, which listed them as a known limit ("answers 500") | same defect as create | — |
| French busy message in the informal register ("Réessaie.") | follows the 18g tutoiement | `lang/fr.json` |
| Inertia busy behaviour: option (b), toast and keep the page, no replay | **awaits the owner** | Task 13's alternatives: reload, or replay the visit |

## 9. What differs between engines, as observed

- **Collation**: confirmed. With a `_ci` collation MariaDB treats every emoji as equal (C7 red); `utf8mb4_nopad_bin`
  (MariaDB 10.11.19) and `utf8mb4_0900_bin` (MySQL 8.4.11) exist and the tables carry them; a stock MySQL server
  (`_ai_ci`, REPEATABLE READ) is fine because the connection settings decide (image run, Task 16).
- **Isolation**: confirmed. REPEATABLE READ on MariaDB/MySQL breaks a cap counted after a lock (C6).
- **SQLite concurrency**: one writer; `IMMEDIATE` serialises read-check-write; a writer that waits past 5 s gets
  503 (C3s). A check made outside any transaction is not protected even on SQLite (C2 red there too).
- **Deadlocks**: PostgreSQL detects after `deadlock_timeout` (1 s), InnoDB at once and picks the lighter
  transaction; the retry writes once (C3r).
- **JSON**: MySQL returns objects with keys reordered (12 tests). Not predicted by the spec.
- **`GLOB` (SQLite) and `like binary` (MariaDB/MySQL)** for `whereLike(..., caseSensitive: true)`: ran in
  `SearchColumnsTest` and the search tests on all engines, multi-byte terms included; no misbehaviour seen.
- **Index names**: PostgreSQL cuts at 63 characters silently; MariaDB/MySQL refuse over 64. Not in the spec's list.
- **SQLite file and `migrate:fresh`**: truncating the file under an open WAL connection corrupts it (tests/Upgrade).
- **Malformed UUID**, **aborted transaction on PostgreSQL**, **aggregate types**: handled as the spec says
  (`uuid` rules, code written for PostgreSQL, casts in PHP); no failure seen.
- **Timestamps after 2038** on MariaDB/MySQL: not exercised.

## 10. Known limits

- Existing PostgreSQL installs keep five check constraints a fresh install lacks (D8).
- A write that bypasses the models (`DB::table`, mass `update()`, `saveQuietly`, `Event::fake()` in tests) is
  unchecked and must set `name_key`, `email_key`, `*_search`, `sort_rank`, `week_start` itself. Documented
  (rule 9); no arch rule can see it.
- Legacy duplicate addresses stay until an operator resolves them (`users:report-duplicate-emails`).
- A wildcard character in a search term on the estimates page can shorten a page and count a near miss (D10).
- Top templates count the latest hundred retros (D11).
- Nullable `timestamp()` columns end in 2038 on MySQL and MariaDB.
- SQL Server does not migrate.
- A lock wait on MariaDB/MySQL can hold a worker up to 3 × 50 s before the 503.
- The SQLite production Compose file keeps sessions and cache in the container.

## 11. Not verified

- **CI has never run on GitHub.** The workflow was parsed and its `plan` job's script run locally; criterion 16 is
  "written, not observed".
- **Branch protection**: the owner must mark `ci`, `database (pgsql 18)`, `database (mariadb 10.11)` and
  `sqlite-file` as required checks; YAML cannot.
- **PostgreSQL 14, MariaDB 11.8, MySQL 8.0** were never run (the nightly jobs would); MySQL 8.0 and MariaDB 10.6 are
  below the minimums and not supported. The image ran on PostgreSQL 18.6, MariaDB 11.8.9, MySQL 8.4.11, SQLite
  3.53.4 (Task 16).
- **`tests/Upgrade` on a SQLite file** (see §1).
- **No production data was migrated.** The upgrade is proved on the fixture `before-portability.sql` and on a
  generated 100 000-card table (14 s for the search columns, PostgreSQL 18 on a laptop).
- **Upgrade of a populated MariaDB, MySQL or SQLite install**: none exists; only PostgreSQL has a fixture.
- **The browser suite** (criterion 19) was not run in this plan's final state.
- **`migrate:fresh --seed`** was not run in this final run (forbidden to this agent); last shown by Task 17 on
  pgsql 18.6, mariadb 10.11.19, mysql 8.4.11, SQLite in memory and in a file.
- Query count and time of `BuildBoardSnapshot` before and after the relationship aggregates (Review Focus 7): the
  query-count tests pass, the timing was never measured.

## 12. Operator notes: upgrading an existing PostgreSQL install

Full text in `docs/database.md`, "Upgrading an existing PostgreSQL instance". In short:

1. Back up. Use maintenance mode on a large instance (a row written by the old release while the search columns
   fill stays out of search until its next save).
2. Start the new image: `skrum:check-database` runs, then `php artisan migrate`. It adds `name_key`, `email_key`,
   the `*_search` columns, `action_items.sort_rank`, `game_points.week_start`; fills them one update per row
   (about 15 s per 100 000 rows of cards, action items, retros and users, measured on a laptop); adds their
   indexes; drops four `lower(name)` unique indexes and five JSON column defaults of `game_rounds`; lower-cases and
   trims invitation addresses. The large fills run outside a transaction and resume where they stopped.
3. Two names of one owner that collide once case and spaces are ignored are both kept; the later row gets its own
   key and the log names it.
4. The five check constraints stay (`action_items_single_assignee`, `action_items_guest_assignee_needs_retro`,
   `action_items_recurrence_needs_due_date`, `team_health_statements_builtin_or_custom`, `poker_decks_single_owner`);
   the five `alter table … drop constraint` statements are in the docs, optional.
5. Run `php artisan users:report-duplicate-emails`: accounts that share an address once normalised are refused by
   SSO and the magic link until an operator changes or removes the extra ones.
6. PostgreSQL needs no collation setting (folding is done in PHP). For a move to MariaDB or MySQL (a new install,
   not a migration of data): the connection collation must be `utf8mb4_nopad_bin` / `utf8mb4_0900_bin` and the
   isolation READ COMMITTED (both set by `config/database.php`); tables created with another collation are
   reported by the check. Changing engine with data is not supported.
