# Skrüm — Database portability — Design

Date: 2026-10-19 (drafted 2026-10-02)
Status: Draft, awaiting the owner's review. Four working assumptions (§0) and seven decisions (§16) are open.
Owner requirement (2026-10-02): "the application must run on SQLite, MariaDB and any other database handled by Eloquent".
Basis: `docs/superpowers/research/database-portability-audit.md` (read-only audit of 2026-10-02: findings with file and line, work packages, helpers, test matrix). Where this spec departs from the audit, §17 says so and why.
Trees read for this spec: main tree on `plan-18e-screens` at `4568a764`; worktree `.claude/worktrees/laneAuth` on `plan-18f-auth` at `d9180f10` (marked **[18f]**); `vendor/laravel/framework` v13.34.0.
Nothing was run to write this spec. Every "fails on" and "works on" is read from the code and from the framework's grammars. §15 lists what only a first run on each driver can tell.
Plan: `.superpowers/sdd/plan-db/2026-10-19-plan-database-portability.md`.

Drivers: PG = PostgreSQL, MY = MySQL, MA = MariaDB, SL = SQLite, MS = SQL Server.

## 0. Working assumptions, to confirm by the owner

These four were taken as given to write the spec. Each changes the plan if the owner says otherwise.

| # | Assumption | If the owner says otherwise |
|---|---|---|
| A1 | Supported and tested targets are SQLite, MariaDB, MySQL and PostgreSQL. | A dropped target removes its CI job and its Sail service; nothing else changes. |
| A2 | SQL Server is best effort, not guaranteed. The shipped schema does not migrate on it (a unique index allows a single NULL, so a second guest could not join a retro; cascade paths are refused at `create table`). The query layer is kept free of constructs SQL Server rejects, at no extra cost. | Supporting it is a second schema (filtered indexes, `NO ACTION` plus deletes in the application): a separate spec. |
| A3 | This plan runs its tests. It exists to prove behaviour on each driver, so every task ends with a suite run, unlike the front rewrite. | Without runs, the plan can only claim what the audit already claims. |
| A4 | This plan comes before the feature roadmap. | Every feature written before it adds raw SQL and migrations to port later. |

## 1. Problem statement

The application migrates on PostgreSQL only. On SQLite `php artisan migrate` stops at `2026_10_06_100000_create_game_tables.php:54` (a `'[]'::jsonb` default); on MySQL and MariaDB it stops at `2026_10_01_100300_create_workspace_templates_table.php:21` (an expression index). Past the migrations, about 25 raw SQL sites use PostgreSQL syntax. The larger problem is what would not fail but would behave differently: collation of equality and unique indexes, isolation level, row locks that SQLite ignores, and five invariants that exist only as PostgreSQL constraints.

Every instance in production runs PostgreSQL. Nothing in this spec may lose their data or change their behaviour.

## 2. Goals

1. `php artisan migrate` and the application run on SQLite, MariaDB, MySQL and PostgreSQL from the same code, with no driver branch outside `App\Support\Database`.
2. Every invariant of the product holds on each of the four drivers, and a test proves it on each driver. Where a lock matters, the proof is a test with two real connections.
3. An existing PostgreSQL instance upgrades with `php artisan migrate`, without data loss, and ends with the same schema as a fresh PostgreSQL install (proved by a schema diff, §6.3).
4. New code stays portable: an architecture test fails on driver-specific constructs, and a rule for agents says how to write database code.
5. An operator can choose a database knowing its limits: documentation says which to pick, the required settings, and what differs.

## 3. Non-goals

- SQL Server support (A2).
- Moving data from one database engine to another (PostgreSQL to SQLite, and so on). An instance keeps the engine it was installed with.
- Accent-insensitive search. Search is case-insensitive and accent-sensitive everywhere (§9).
- Full-text or trigram indexes.
- Running the browser suite on a second driver, or making `bin/test-browser` driver-neutral. The browser suite tests the front end and stays on PostgreSQL (§13).
- Redis, or any change to the cache, session and queue stores beyond their lock connection and the documented SQLite settings.
- Converting every `timestamp` column to `dateTime`. Only the non-null ones change (§6.3); the year-2038 limit of nullable `TIMESTAMP` columns on MySQL and MariaDB is documented.

## 4. Supported matrix

| Engine | Minimum | Tested on every push | Tested nightly | Why this minimum |
|---|---|---|---|---|
| PostgreSQL | 14 | 18 | 14 | No feature used needs more than 12. 14 is the oldest version still maintained upstream on the spec date (end of life November 2026); the floor moves with upstream. |
| MariaDB | 10.11 | 10.11 | 11.8 | Native `uuid` type (10.7; before it, 57 primary keys are `char(36)`). `explicit_defaults_for_timestamp` is on by default from 10.10, so a non-null `TIMESTAMP` is not silently given `ON UPDATE CURRENT_TIMESTAMP`. `CHECK` constraints are enforced from 10.2.1. JSON path functions exist from 10.2. 10.6, the audit's floor, reached end of life in July 2026. |
| MySQL | 8.4 | — | 8.4 | `CHECK` constraints are enforced from 8.0.16; the `utf8mb4_0900_bin` collation exists from 8.0.17. 8.0 reached end of life in April 2026, so the floor is the current LTS. 8.0.17 and later are expected to work and are not tested. |
| SQLite | 3.35, with PHP 8.4 | version bundled with PHP 8.4 | — | Native `drop column` (3.35), used by `2026_10_02_100000` and `2026_10_06_100200`. JSON functions are compiled in by default from 3.38 and in every PHP build that bundles SQLite. `BEGIN IMMEDIATE` is applied by Laravel only on PHP 8.4 and later (`SQLiteConnection.php:30`): on PHP 8.3 the setting is ignored and every concurrent write can fail (§6.6, decision D3). |

Not needed anywhere: `RETURNING`, window functions (none in `app/`), `DISTINCT ON`, hand-written `ON CONFLICT`, recursive queries, generated columns.

## 5. Principles

Portable by construction: the code does not test the driver, it avoids what differs.

- **P1 — Query builder first.** Raw SQL is limited to plain aggregates (`count(*)`, `sum(col)`, `avg(col)`, `max(col)`, `count(distinct col)`), `case when`, and the four helpers of §7. No raw SQL names a function or operator that one of the four engines lacks.
- **P2 — Normalise in PHP.** A value compared without regard to case is folded in PHP, once, by one function, and stored. The database compares stored values with plain equality.
- **P3 — Explicit case-insensitive keys.** A case-insensitive uniqueness rule is a stored normalised column (`name_key`, `email_key`) under a plain index. No expression index, no partial index, no reliance on a collation.
- **P4 — Binary, case-sensitive comparison everywhere.** MySQL and MariaDB use a binary, no-pad collation, so `=`, `unique`, `group by` and `distinct` mean on them what they mean on PostgreSQL and SQLite. A case-insensitive comparison is always written out (P2, P3, or the search helper).
- **P5 — READ COMMITTED on MySQL and MariaDB.** Every statement sees the latest committed rows, as on PostgreSQL, and searches take no gap locks. The lock patterns written for PostgreSQL keep their meaning.
- **P6 — SQLite: WAL, a busy timeout, immediate transactions.** One writer at a time. Every `DB::transaction` takes the write lock at `BEGIN`, so read-check-write transactions are serialised and the row locks SQLite ignores are not needed.
- **P7 — Lock the aggregate root first.** The first statement of a transaction that enforces an invariant is the locking read of its root. This is what makes P5 and P6 sufficient.
- **P8 — Retry only what is safe to repeat.** A transaction is retried on a deadlock or a busy database only when its closure has no effect outside the database. Otherwise the error is answered as "busy, try again", never as a 500 (§6.6).
- **P9 — Code for the strictest engine.** PostgreSQL aborts a transaction on any failed statement, rejects a malformed UUID, and enforces column lengths. Code is written for it: a statement allowed to fail runs in its own nested transaction; ids from requests are validated as UUIDs; lengths are validated.
- **P10 — An invariant the schema builder cannot express on every driver is enforced in the model**, and additionally by the database where the engine can.
- **P11 — SQL order is stable, not alphabetical.** A sort has an explicit tie-breaker and never depends on where NULL sorts. A list read by people in alphabetical order is sorted in PHP.
- **P12 — Results are cast in PHP.** Aggregates and booleans read through the base query builder differ in type per driver.

## 6. Design by work package

The packages follow the audit's order. Each gives its design, the invariants it protects, and the test that proves them on each driver.

### 6.0 WP0 — Guard rail

The rule for agents (§12.3) goes into `CLAUDE.md`, which the project owns (`AGENTS.md` is generated by Laravel Boost and would be overwritten). `tests/Arch/DatabasePortabilityTest.php` scans source text (§11). It starts with a baseline file listing the existing violations, one per line; each later package deletes the lines it fixes; the last task asserts the baseline is empty. Driver-independent: it runs in the Arch suite.

### 6.1 WP1 — The suite runs on each driver

- `config/database.php`:
  - `sqlite`: `busy_timeout` 5000, `journal_mode` `wal`, `synchronous` `normal`, `transaction_mode` `IMMEDIATE`. On `:memory:` the journal pragma is a no-op.
  - `mysql`: `collation` `utf8mb4_0900_bin`, `timezone` `+00:00`, `isolation_level` `READ COMMITTED`.
  - `mariadb`: `collation` `utf8mb4_nopad_bin`, `timezone` `+00:00`, `isolation_level` `READ COMMITTED`.
  - `pgsql`: unchanged.
  - `mysql_locks` and `mariadb_locks`: twins of their connection, as `pgsql_locks` already is. `config/cache.php` picks `<driver>_locks` for the three server engines and `null` for SQLite, where a second connection could never write while the first holds the write lock.
  - The collation is a connection setting, not `->collation()` on columns: the PostgreSQL grammar would emit `collate "utf8mb4_bin"` and fail. Laravel applies the connection collation to every `create table` (`MySqlGrammar.php:278-281`) and to `create database`.
- `compose.yaml`: services `mariadb` (`mariadb:10.11`) and `mysql` (`mysql:8.4`) under Compose profiles of the same names, each with Sail's `create-testing-database.sh`. `sail up` starts PostgreSQL only, as today.
- `bin/test-db <sqlite|sqlite-file|pgsql|mariadb|mysql> [--concurrency] [-- pest arguments]` sets the connection variables and runs the suite, inside Sail by default and on the host with `TEST_DB_ON_HOST=1` (CI). Environment variables win over `phpunit.xml`, which sets no `force`.
- Parallel testing: Laravel names each process's database `<DB_DATABASE>_test_<token>` and creates it through the schema builder. PostgreSQL: the Sail user may create databases. MySQL and MariaDB: Sail's `create-testing-database.sh` grants the application user every database named `testing%`, which covers them; CI connects as `root`. SQLite in memory: one database per process, nothing to create. SQLite file: `database/testing.sqlite_test_<token>`, created as an empty file.
- A baseline of failures per driver is recorded in `docs/superpowers/research/database-portability-baseline.md` and updated by each task. Before WP2 it can only say where the migrations stop.

`phpunit.xml` does not change in this package. The default driver of the suite moves to SQLite in memory in WP8, once the suite is green there (§17, point 8).

### 6.2 What "run on PostgreSQL unchanged" means

Historic migrations have already run on production instances. They may be edited only where PostgreSQL would produce the same schema (decision 7.1.4 of the audit, kept). Anything that changes the PostgreSQL schema is a new migration. Two commands prove it:

- `bin/check-pg-upgrade` loads a dump of the PostgreSQL schema as it was before this plan (with sample rows), runs `php artisan migrate`, dumps the schema, and compares it with the dump of a fresh install. The difference must be empty, and the sample rows must all be there with their names unchanged.
- The four-driver `migrate:fresh` job of CI.

### 6.3 WP2 — Migrations

**Edited in place (PostgreSQL result unchanged):**

| Migration | Change | Why PostgreSQL is unchanged |
|---|---|---|
| `2026_10_06_100000_create_game_tables.php:54-60` | The five `->default(new Expression("'[]'::jsonb"))` are removed. `GameRound::$attributes` already sets the five values. | It is not: fresh installs lose the database default. A new migration drops it on existing installs too (below), so both end equal. |
| The seven non-null `timestamp()` columns of audit §1.16, and three in [18f] | `dateTime()` | `PostgresGrammar::typeDateTime` calls `typeTimestamp`: identical DDL. MySQL and MariaDB get `DATETIME`: no auto-update, no session time zone, no 2038 limit. |
| `2026_10_08_100000:14-18` (four payload columns) | `longText()` | `text` on PostgreSQL and SQLite either way; `longtext` on MySQL and MariaDB, where `text` stops at 64 KB and the content reaches 512 KB. |
| The five `if (DB::getDriverName() !== 'pgsql') return;` blocks | The check constraints go through `CheckConstraint::add()` (§7), unconditionally. The four `create unique index … lower(name)` statements are removed. | Same constraint names and expressions. The removed indexes are dropped on existing installs by the new migration, after their replacement exists. |

**New migrations:**

1. `add_name_keys_to_named_tables` — for `workspace_templates`, `whiteboard_templates` and `poker_decks`:
   1. add `name_key` `string(160)`, nullable;
   2. fill it in PHP with `NameKey::of($name)`, by id order. Two rows of one owner with the same key (possible on PostgreSQL where the old index folded with the database locale and did not trim): the oldest keeps the key, each later one gets the key followed by ` ~` and the last eight characters of its id. Names are never changed. Each such row is written to the log;
   3. make the column non-null and create the plain unique indexes: `(workspace_id, name_key)` on the two template tables; `(team_id, name_key)` and `(workspace_id, name_key)` on `poker_decks`. A NULL owner never collides on the four engines, so no partial index is needed;
   4. only then, drop the old expression indexes where `Schema::hasIndex()` finds them (`workspace_templates_workspace_name_unique`, `poker_decks_team_name_unique`, `poker_decks_workspace_name_unique`, `whiteboard_templates_workspace_name_unique`). On a fresh install they never existed and the step does nothing. No driver test is needed.
   
   On PostgreSQL the migration runs in one transaction: either the instance has the new keys and indexes, or nothing changed. The three tables are small (saved decks are capped at 30 per owner, whiteboard templates at 50 per workspace), so the locks are short.
2. `drop_json_defaults_from_game_rounds` — the five columns through `->change()` without a default. Brings existing PostgreSQL installs to the fresh schema.
3. **[18f]** `add_email_key_to_users_table` and `normalise_workspace_invitation_emails` (§6.5).

The model fills `name_key` whenever `name` is set (an attribute mutator on `name`), so no caller can forget it; the column being non-null makes a write that bypasses the model fail loudly.

**Rule kept from the audit:** on SQLite a `change()` rebuilds the table from introspection. Raw DDL on a table must come after its last `change()`. After this package no raw DDL is left except the check constraints, which SQLite does not get.

**Invariants and proof:**

| Invariant | Mechanism | Test, run on each driver |
|---|---|---|
| A template or deck name is unique per owner, whatever its case and surrounding spaces | unique index on `name_key` | `tests/Feature/Database/NameKeysTest.php`: a second row with `'sprint map'` after `'Sprint Map'` raises `UniqueConstraintViolationException`; two decks named alike under two owners are accepted; a team deck and a workspace deck named alike are accepted |
| The four key indexes exist | schema builder | same file, `Schema::hasIndex` |
| An existing PostgreSQL install ends like a fresh one, with its rows | new migrations | `bin/check-pg-upgrade` (PostgreSQL job of CI) |
| The schema migrates from nothing | — | `migrate:fresh --seed` on the four drivers in CI |

### 6.4 WP3 — Raw SQL

| Site | Today | Design |
|---|---|---|
| `ActionItemQuery.php:56-59` | `count(*) filter (where …)` | `Sql::countWhen('…')`: `sum(case when … then 1 else 0 end)`. The existing `(int)` casts turn the NULL of an empty set into 0. The aliases become `open_total`, `overdue_total`, `completed_total`, `mine_total`, `rituals_total`: `open` is a keyword on MySQL and MariaDB. |
| `ActionItemQuery.php:124` | `(completed_at is not null)` as a sort key | `case when action_items.completed_at is null then 0 else 1 end` |
| `ActionItemQuery.php:126` | `… asc nulls last` | `Sql::nullsLast($expression)` as its own sort key before the expression: `case when <expr> is null then 1 else 0 end` |
| `TrackedIssues.php:34`, `:53` | `whereRaw('false')` | `Sql::never()`: `1 = 0` |
| `RoomLeaderboard.php:35`, `TeamGameLeaderboard.php:48` | `case when is_win then …` | `Sql::countWhen('is_win = ?')` with a bound `true` |
| `GameStreaks.php:30-31` | `date_trunc('week', created_at)` | select `user_id, created_at` and compute the Monday in PHP; the method already converts to Carbon. The read is bounded: rows of the team and the given users only. |
| `DrawGameWord.php:31`, `SendActionItemReminders.php:104` | `insertOrIgnore` | `InsertOnce::into($table, $values): bool` (§7): the insert in a nested transaction, `UniqueConstraintViolationException` caught. Unlike `insert ignore` on MySQL it hides no other error. |
| `SearchBoards.php:121,146,161,185`, `TeamEstimatesController.php:39`, `AdminCandidatesController.php:22-23`, **[18f]** `SearchWorkspaceContent.php` (7 sites) | `ilike`, `whereLike`, three private escapers, `LikePattern::contains` | `TextSearch::contains()` (§7). `LikePattern::snippet` stays; `LikePattern::contains` and the two `escapeLike` methods are deleted. |
| `BuildSummaryInput.php:228`, `TeamGameLeaderboard.php:51` | `orderByRaw('lower(…)')` | stable SQL order with a tie-breaker, then `Alphabetical::sort()` in PHP (P11) |
| The seven `lower(name)` and `lower(email)` lookups | `whereRaw('lower(…) = ?')` | `name_key` (§6.3) and `email_key` (§6.5) |
| `GameHostsController.php:31`, `GameRoundsController.php:33` | an id validated as `'string'` reaches an `exists` query | add the `uuid` rule (a malformed id is a 500 on PostgreSQL only) |

**Search semantics, identical on the four drivers:** a term matches when the lower-cased column contains the lower-cased term; `%`, `_` and `!` in the term are literal. The SQL is `lower(<column>) like ? escape '!'`, the term lowered and escaped in PHP. SQLite's built-in `lower()` folds ASCII only, so the application registers its own `lower()` on every SQLite connection, backed by `mb_strtolower` (`SqliteFunctions::register`, on the `ConnectionEstablished` event): `ÉTÉ` then matches `été` on SQLite as elsewhere. PostgreSQL folds by the database locale: a database created with the `C` locale folds ASCII only; the operator documentation and `skrum:check-database` say so.

**Proof, on each driver:** `tests/Feature/Database/TextSearchTest.php` (a term with `%`, with `_`, with `!`, with a backslash; `Été` found by `ÉTÉ` and by `été`; `e` does not find `é`), the existing feature tests of each site, and `tests/Unit/Support/Database/SqlTest.php` for the three fragments.

### 6.5 WP4 and WP5 — Invariants in the model, dates, collation, e-mail

**Check constraints.** Five rules exist only as PostgreSQL constraints. Each becomes a `saving` guard on its model that throws `App\Exceptions\ModelInvariantViolation`, and stays a database constraint on PostgreSQL, MySQL and MariaDB through `CheckConstraint::add()`. SQLite cannot add a constraint to an existing table; there the model is the only guard, and rows written outside Eloquent are unchecked (§9).

| Model | Rule |
|---|---|
| `ActionItem` | not both `assignee_user_id` and `assignee_participant_id` |
| `ActionItem` | `assignee_participant_id` needs `retro_id` |
| `ActionItem` | `recurrence` needs `due_on` |
| `TeamHealthStatement` | built-in without text and label, or custom with both |
| `SavedPokerDeck` | exactly one of `team_id`, `workspace_id` |

Proof on each driver: the existing tests (`ActionItemModelTest:108-126`, `HealthStatementModelsTest:62`, `WorkspacePokerDecksTest:261`) lose their skips and expect `ModelInvariantViolation`. A second test per rule writes through the query builder and expects a `QueryException`; it is skipped where `CheckConstraint::isEnforced()` is false, a capability, not a driver name.

**Dates.** `action_items.due_on` and `action_item_reminders.due_on` use the cast `App\Casts\DateOnly`, which stores and reads `Y-m-d` on every driver. Eloquent's `date` cast writes `Y-m-d H:i:s`, which SQLite keeps as text: `whereBetween` then skips items due on the upper bound and the reminder's unique key no longer matches between its two writers. Proof on each driver: an item due tomorrow is in the reminder run; a second run the same day sends nothing; the raw stored value is ten characters long.

**Collation (P4).** With the binary, no-pad collations of §6.1, two different emoji are two values, `pêche` and `péché` are two words, and `Ada` and `ada` are two token names, on the four engines. Proof on each driver, in `tests/Feature/Database/CollationTest.php`: one participant adds two different emoji to a card and both are stored; removing one keeps the other; two personal access tokens whose names differ by case are both accepted; two whiteboard elements whose ids differ by case are two rows; `'a'` and `'a '` are two values in a unique column.

**E-mail [18f].** Plan 18f stores addresses normalised (`LoginAddress::normalise`, a mutator on `User::email`) and looks them up with `lower(email) = ?`, because rows from before may hold capitals and two legacy accounts may share an address once normalised. `ResolveSsoUser` and `SendMagicLink` read up to two matches and refuse when there are two: that refusal is a security rule and is kept.

- `users.email_key` `string(255)`, filled by the same mutator and by a migration for every existing row, under a plain, non-unique index (legacy duplicates share a key). `User::scopeWhereAddress()` becomes `where('email_key', LoginAddress::normalise($email))`: indexed, and the same comparison on every driver. No SQL `lower()` is left.
- Uniqueness of new addresses stays where it is: the plain unique index on `users.email`, which holds normalised values for every row written since 18f, plus the `UniqueEmailAddress` rule, which now reads `email_key` and so still refuses an address a legacy row uses.
- `workspace_invitations.email` is normalised on write by the same function, and a migration normalises existing rows (no unique index is involved, so no collision can stop it). `CreateWorkspaceInvitation` then deletes pending invitations with a plain equality.
- Vendor lookups (Fortify, the password broker) compare `email` with what the request holds. They behave alike on the four drivers once the collation is binary; what they do with a mixed-case input is 18f's concern, and a test per driver pins that the outcome is the same everywhere.

This package waits for `plan-18f-auth` to be merged. Before the merge, the three main-tree lookups (`WorkspaceInvitationsController:32,44`, `ResolveSsoUser:46`, `CreateWorkspaceInvitation:22`) stay on the baseline of the architecture test.

### 6.6 WP6 — Concurrency

**Settings** (§6.1) give the three server engines the same model: row locks under READ COMMITTED. SQLite serialises write transactions.

**Retry policy (P8).**

- `App\Support\Database\Transactions::Attempts = 3`. A call site passes it to `DB::transaction($callback, Transactions::Attempts)` only if its closure touches nothing but the database (no HTTP call, no mail, no file; broadcasts and jobs are dispatched after commit and are safe). Initial list: `RevokeInstanceAdmin`, `CreateWorkspaceInvitation`, `IssueMcpToken`, the card vote, reaction, deck and retro template transactions. Not retried: `SaveWhiteboardTemplate` (it copies files), `SaveTeamIntegration` (it fires an event whose listener was not read), anything that calls a provider. Laravel retries only an outermost transaction; inside another one a deadlock is rethrown as `DeadlockException`, which is correct (MySQL has rolled the whole transaction back).
- SQLite waits up to five seconds for the write lock (`busy_timeout`); after that the statement fails with "database is locked", which Laravel classifies as a concurrency error like a deadlock.
- A concurrency error that survives its retries is answered **503 with `Retry-After: 1`**, not 500: `bootstrap/app.php` maps it to `ServiceUnavailableHttpException`. JSON clients get the JSON 503; pages get the existing static 503 view.
- Transactions that call a provider while holding a lock (`IntegrationTokens.php:85`) are never retried.

**Invariants and their proof with two real connections.** `tests/Concurrency` is a suite of its own. Each test starts several PHP processes through Laravel's process concurrency driver, each with its own connection; all wait for the same instant, and every contender pauses 200 ms after its first statement, so that without protection they all read the same state. It uses `DatabaseTruncation`, not a wrapping transaction: rows must be committed to be seen by the other processes. It runs on PostgreSQL, MariaDB, MySQL and SQLite in a file, never on SQLite in memory and never in parallel.

| # | Invariant | Scenario | Expected on each driver |
|---|---|---|---|
| C1 | An instance keeps at least one admin | two admins, each revoked by one process at the same time | exactly one admin left; one call returns `false` |
| C2 | **[18f]** A magic link signs in once | six processes consume one token | exactly one gets the user, five get `null` |
| C3 | A participant never exceeds the vote limit | limit 3, eight processes vote for the same participant | exactly 3 votes; five answers 422 |
| C4 | A team has at most 30 saved decks | 29 decks, six processes create one each, distinct names | exactly 30 |
| C5 | A deck name is unique per team | six processes create the same name | exactly one row; the others answer 422, none 500 |
| C6 | A workspace has at most 50 whiteboard templates | 49 templates, saves from two boards of the workspace | exactly 50 |
| C7 | A reaction is unique per card, participant and emoji | one participant, six processes: three add 👍, three add 🎉 | exactly two rows, one per emoji; no 500 |
| C8 | One integration per team and provider | six first connections of one provider | exactly one row; no 500 |
| C0 | The harness really overlaps | each contender records when it starts and ends | the latest start is before the earliest end |

Two of these scenarios do not hold today, on PostgreSQL either, and are fixed by this plan (§17, point 13):

- **C5.** A deck name and a retro template name are validated before the owner's row is locked (`PokerDecksController.php:108-118`, `WorkspacePokerDecksController::store`, `WorkspaceTemplatesController::store`). Two identical submissions both pass validation; the unique index stops the second, as a 500. The name is checked again once the owner is locked (`SavedPokerDeckRules::ensureNameIsFree`, as whiteboard templates already do). A rename raced with another stays protected by the index alone.
- **C8.** `SaveTeamIntegration` locks a row that may not exist yet, which locks nothing: on PostgreSQL the losers fail on the unique index, on MySQL at REPEATABLE READ they deadlock. The team row is locked first (P7).

Each scenario is first run against a build where its protection is removed (the lock line commented out, or the isolation level left at the engine's default) to see it fail; the plan says how, test by test. A concurrency test that cannot be made to fail proves nothing.

### 6.7 WP7 — Tests that assert PostgreSQL

| Site | Design |
|---|---|
| Lock order read from SQL text (`IcebreakerRoomTest:200`, `ActionItemExportTest:265`, `InstanceAdminsTest:165`) | `Tests\Support\SqlProbe::lockedTables()` strips identifier quoting and recognises each engine's lock clause. Skipped where `SqlProbe::rowLocksExist()` is false (SQLite compiles no lock clause; there the order of row locks has no meaning). |
| A table named in SQL text (`GameAccessTest:186`, `WebhookRedeliveryTest:530`) | `SqlProbe::reads($sql, 'table')` |
| `select 1 / 0` (`WebhookSharesTest:465`, `WebhookEventsTest:464`) | `DatabaseFailure::provoke()`: an insert that violates a NOT NULL constraint. A real error on the four engines, which also aborts the PostgreSQL transaction as the test needs. |
| Unreachable database (`ErrorPagesTest:32-47`) | `UnreachableDatabase::config()`: port 1 for a server engine, a directory path for SQLite. Both raise a `PDOException` on connect. |
| `Schema::drop` in a test (`InstanceSettingsTest:173`, `BrandInPageTest:183`) | `MissingTables::during()`: the connection looks for its tables under the prefix `missing_` while the closure runs; they are absent on every engine and no DDL runs |
| `Schema::table` in a test (`ActionItemModelTest:17`, the legacy backfill) | skipped where the schema grammar reports no transactional DDL (`supportsSchemaTransactions()`). The backfill it tests only ever runs on PostgreSQL installs. |
| Constraint and index tests skipped off PostgreSQL | §6.5 and §6.3 |

### 6.8 Triage of what only shows on another driver

After WP2 the suite runs on SQLite and MariaDB for the first time. Failures not predicted by the audit are sorted into six causes, each with its fix: result type (cast in PHP), order (tie-breaker or `Alphabetical`), NULL position (`Sql::nullsLast`), collation (expected by P4: fix the test, or normalise in PHP), date or time format (`DateOnly`, or compare as Carbon), test that asserts an engine (WP7). A failure that fits none stops the task and is reported with its SQL and both engines' results.

### 6.9 WP8 — CI, operations, documentation

§10, §12, §13.

## 7. Helpers

One of each. All live under `app/Support/Database` unless said otherwise; that folder is the only place where a driver may be tested.

| Helper | Signature | Role |
|---|---|---|
| `Sql` | `countWhen(string $condition): string`; `nullsLast(string $expression): string`; `never(): string` | The three conditional fragments. `countWhen('completed_at is null')` gives `sum(case when completed_at is null then 1 else 0 end)`. |
| `TextSearch` | `contains(Builder $query, string\|array $columns, string $term): void`; `pattern(string $term): string` | Case-insensitive substring search with literal `%`, `_`, `!`. Several columns are OR-ed inside one group. `Builder` is the query contract, so Eloquent and base builders both pass. |
| `NameKey` | `of(string $name): string` | `Str::lower(trim($name))`. The one fold for `name_key`. |
| `App\Support\Auth\LoginAddress` **[18f]** | `normalise(string $email): string` | The one fold for `email_key` and for invitations. Exists in 18f; reused. |
| `App\Casts\DateOnly` | `CastsAttributes` | Stores and reads `Y-m-d`. |
| `CheckConstraint` | `add(string $table, string $name, string $expression): void`; `isEnforced(): bool` | Emits `alter table … add constraint … check (…)` where the engine can add one; does nothing on SQLite. |
| `InsertOnce` | `into(string $table, array $values): bool` | Insert, or `false` when a unique key already holds the row. |
| `Transactions` | `Attempts = 3`; `isConcurrencyError(Throwable $e): bool` | The retry count, and the test used by the 503 mapping (delegates to Laravel's detector). |
| `SqliteFunctions` | `register(Connection $connection): void` | Unicode `lower()` on SQLite connections. |
| `DatabaseRequirements` | `problems(Connection $connection): array<int, string>`; `warnings(Connection $connection): array<int, string>`; `MinimumVersions` | What `skrum:check-database` reports (§10). |
| `App\Support\Alphabetical` | `key(string $value): string`; `sort(Collection $items, callable $by): Collection` | The PHP alphabetical order: lower-cased, transliterated, ties by the raw value. |
| `Tests\Support\SqlProbe` | `lockingQueries(Closure $during): array`; `lockedTables(Closure $during): array`; `onRead(string $table, Closure $callback, Closure $during): void`; `reads(string $sql, string $table): bool`; `rowLocksExist(): bool` | The one reader of SQL text in the tests. |
| `Tests\Support\DatabaseFailure` | `provoke(): void` | A statement that fails on every engine. |
| `Tests\Support\UnreachableDatabase` | `config(): array` | A connection that cannot be opened. |
| `Tests\Support\MissingTables` | `during(Closure $callback): mixed` | Runs a closure while no table can be found, without DDL (a table prefix that does not exist). |
| `Tests\Concurrency\Support\Race` | `run(array $contenders, string $pauseAfter = Race::FirstQueryInTransaction): array`; `request(?string $userId, string $method, string $uri, array $payload = []): int` | Starts the contenders together and returns each outcome. |

The audit named seven helpers. Added here: `InsertOnce` (the audit described it without naming it), `Transactions`, `SqliteFunctions`, `DatabaseRequirements`, `Alphabetical`, and four test helpers beside `SqlProbe`.

## 8. Invariants per driver

| Invariant | PostgreSQL | MySQL, MariaDB | SQLite | Proof |
|---|---|---|---|---|
| Name unique per owner, ignoring case | unique index on `name_key` | same | same | `NameKeysTest`, C5 |
| Address lookup ignores case; a legacy duplicate is seen as two | index on `email_key` | same | same | `EmailAddressNormalisationTest` [18f], run per driver |
| Emoji, accents and case are distinct in keys | native | binary no-pad collation | native | `CollationTest`, C7 |
| Five model rules | model guard and check constraint | model guard and check constraint | model guard | §6.5 tests |
| Caps and "last one" rules (C1, C3, C4, C6) | row lock on the root, READ COMMITTED | row lock on the root, READ COMMITTED set by the connection | `BEGIN IMMEDIATE` | concurrency suite |
| Single use (C2) | one conditional `update`, atomic | same | same | C2 |
| At most one row for a key that may not exist yet (C7, C8) | unique index; the loser's insert fails in a savepoint | unique index; no gap lock under READ COMMITTED | unique index; serialised | C7, C8 |
| A cache lock is visible to others at once and never joins the caller's transaction | `pgsql_locks` | `mysql_locks`, `mariadb_locks` | same connection (one writer) | `tests/Feature/Database/CacheLockConnectionTest.php` |
| A date-only value compares as a date | native `date` | native `date` | `DateOnly` stores ten characters | reminder tests |
| A failed optional statement does not break the caller | nested transaction (savepoint) | same, harmless | same, harmless | existing `WebhookSharesTest`, with `DatabaseFailure` |

## 9. What cannot be identical, and the rule

| Difference | Rule |
|---|---|
| Alphabetical order from SQL (linguistic on PostgreSQL, by code point elsewhere) | SQL order is only stable. Lists read by people are sorted by `Alphabetical` in PHP. Where a query is limited or paginated before the sort, the page content follows the engine's order; documented. |
| Accent-insensitive search | Not offered. `e` does not find `é` on any engine. |
| Case folding of special letters (`İ`, `ß`) | Uniqueness uses PHP's fold everywhere and is identical. Search uses each engine's `lower()`: ordinary letters fold alike; special ones may differ. PostgreSQL with the `C` locale folds ASCII only. |
| Concurrency model | Server engines: row locks, many writers. SQLite: one writer, others wait up to five seconds. Same invariants, different throughput. |
| Database-level check constraints | Enforced by the model everywhere, and by the database except on SQLite. |
| A malformed UUID in a query | An error on PostgreSQL, no row elsewhere. Every id from a request passes a `uuid` rule or a route pattern. |
| A failed statement inside a transaction | Aborts the transaction on PostgreSQL only. Code is written for PostgreSQL (P9). |
| Aggregate and boolean result types | Cast in PHP (P12). |
| DDL inside a transaction | Commits implicitly on MySQL and MariaDB. Never in application code; never in a test. |
| `TIMESTAMP` range on MySQL and MariaDB | Nullable `timestamp()` columns and `timestamps()` end in 2038 there. New columns use `dateTime()`. |
| Trailing spaces | Significant everywhere with the no-pad collations. With an operator-chosen pad collation they are not; `skrum:check-database` reports it. |
| SQL Server | Does not migrate (A2). |

## 10. Operations

- **`.env.example`** keeps PostgreSQL as the active block (decision D2) and gains commented blocks for MariaDB, MySQL and SQLite with the values that matter (`DB_CONNECTION`, host, port; for SQLite `DB_DATABASE` as an absolute path and `SESSION_DRIVER=file`, `CACHE_STORE=file`, which keep session and cache writes off the single writer).
- **Sail**: `vendor/bin/sail --profile mariadb up -d`, `--profile mysql`.
- **Image**: the `Dockerfile` installs `pdo_mysql` and `pdo_sqlite` beside `pdo_pgsql`. `docker/scripts/prepare` requires `DB_PASSWORD` only when the connection is not SQLite, creates the SQLite file when absent, and runs `php artisan skrum:check-database` before migrating.
- **Production Compose**: `compose.production.yaml` stays PostgreSQL. `compose.production.mariadb.yaml` and `compose.production.sqlite.yaml` are complete alternatives (a Compose override cannot remove the `pgsql` dependency). The SQLite one mounts a named volume for the database file.
- **`php artisan skrum:check-database`** (`CheckDatabaseCommand`) prints the engine and version and fails on: a version under the minimum; MySQL or MariaDB with a collation that is not binary or an isolation level that is not READ COMMITTED; SQLite without WAL on a file database, with foreign keys off, or on PHP under 8.4. It warns on PostgreSQL with the `C` locale and on a pad collation. Its queries are the only raw engine-specific SQL of the application and live in `DatabaseRequirements`.
- **Deploying this change on an existing PostgreSQL instance**: one `php artisan migrate`. The migrations add three columns, fill them, add indexes, drop four indexes and five column defaults, inside one transaction per migration. No table is rewritten except by the nullable-to-non-null changes on tables of at most a few hundred rows. A failure leaves the instance as it was.

## 11. Architecture test

`tests/Arch/DatabasePortabilityTest.php` reads the text of every PHP file under `app/`, `database/` and `tests/` and fails on a match that is not on the baseline. The baseline is empty at the end of the plan; a later exception needs a line in an allow-list in the test file, with its reason, reviewed like any code.

Under `app/` and `database/`, outside `app/Support/Database`:

| Pattern (regular expression, case-insensitive unless said) | Construct |
|---|---|
| `['"](not )?ilike['"]` and `\bilike\b` inside a string | `ILIKE` |
| `['")\s]::[a-z]` (case-sensitive) | a `::` cast (a PHP static call always has an identifier before `::`) |
| `filter\s*\(\s*where` | aggregate filter |
| `nulls\s+(first\|last)` | NULL placement |
| `date_trunc`, `\binterval\s+'`, `distinct\s+on`, `\breturning\b` inside a string, `on\s+conflict`, `string_agg`, `~\*`, `\bextract\s*\(` | PostgreSQL functions and clauses |
| `->insertOrIgnore\(`, `->whereJsonContains\(`, `->whereJsonLength\(`, `->upsert\(` | builder methods that differ or throw per engine |
| `->(or)?where(Not)?Like\(`, `['"](not )?like['"]` | a `LIKE` outside `TextSearch` |
| `getDriverName\(` | a driver branch |
| `whereRaw\(['"](false\|true)['"]\)` | boolean literal |
| `->(whereRaw\|orWhereRaw\|selectRaw\|orderByRaw\|havingRaw\|groupByRaw\|fromRaw\|joinRaw)\(`, `DB::(raw\|statement\|unprepared\|select\|selectOne)\(`, `new Expression\(` | raw SQL, allowed only in the files of the allow-list, each with the number of calls it has today (a ratchet: the count may fall, not rise) |

Under `database/migrations` in addition:

| Pattern | Construct |
|---|---|
| `->timestamp\(` on a statement with neither `->nullable()` nor `->useCurrent()` | a non-null `TIMESTAMP` |
| `->default\(new Expression` | a function default |
| `->collation\(`, `->charset\(` | a per-column collation |
| `->(enum\|set\|timestampTz\|timestampsTz\|dateTimeTz\|softDeletesTz\|ulid\|geometry\|geography\|vector)\(` | types that differ or are missing per engine |
| `function down\(` in a migration of this project | the project writes `up` only |

Under `tests/`, outside `tests/Support` and `tests/Concurrency/Support`:

| Pattern | Construct |
|---|---|
| `getDriverName\(` | a driver branch |
| `for update`, `for share`, `lock in share mode` | lock syntax in an assertion |
| `select 1 / 0` | an SQL error used as a failure |
| `Schema::(drop\|dropIfExists\|create\|table\|rename)\(` | DDL in a test (allow-list: the legacy backfill test) |
| `\$\w+->sql\b` | a test that reads the text of a query (quoting and lock syntax differ); `SqlProbe` is the one reader |

## 12. Documentation

### 12.1 For operators — `docs/database.md`, linked from `README.md`

- **Which database to choose.** PostgreSQL: the default and the reference; choose it unless there is a reason not to. MariaDB or MySQL: when that is what the organisation already runs and backs up. SQLite: one container and no database server, for a small instance (D1 sets the wording): one team or a few, sessions with up to a few dozen people. It has one writer: every vote, card, reaction and whiteboard stroke of every live session queues behind the others, and when the queue exceeds five seconds the action fails with "busy, try again". The file must be on a local disk (not a network share), and is backed up with SQLite's backup command, not by copying a file in use.
- **Required settings per engine**, as `skrum:check-database` checks them, and what happens if they are changed.
- **Minimum versions** (§4) and what is tested.
- **What differs between engines** (§9), in the operator's words.
- **Changing engine** is not supported (§3).
- **Upgrading an existing PostgreSQL instance** (§10, last point).

### 12.2 For developers — `docs/database.md`, second half

How to run the suite on a driver (`bin/test-db`), the concurrency suite, the PostgreSQL upgrade check, how to add a migration, and the helpers of §7.

### 12.3 Rule for agents — `CLAUDE.md`

The audit's eight points (§9 of the audit), with three changes: the search helper and the stored-key rule name `TextSearch`, `NameKey` and `LoginAddress`; point 3 allows a driver test inside `App\Support\Database`, `tests/Support` and `tests/Concurrency/Support` only; a ninth point says that a change to database code is run on PostgreSQL and on one other driver (`bin/test-db pgsql`, `bin/test-db mariadb`) before it is committed.

## 13. Test matrix and CI

| Suite | SQLite memory | PostgreSQL 18 | MariaDB 10.11 | SQLite file | Nightly |
|---|---|---|---|---|---|
| Lint, types, Unit, Arch | every push | — | — | — | — |
| Feature | every push (the default of `phpunit.xml`) | every push | every push | — | MySQL 8.4, PostgreSQL 14, MariaDB 11.8 |
| Concurrency | — | every push | every push | every push | MySQL 8.4 |
| `migrate:fresh --seed` and `skrum:check-database` | every push | every push | every push | every push | MySQL 8.4, PostgreSQL 14, MariaDB 11.8 |
| `bin/check-pg-upgrade` | — | every push | — | — | — |
| Browser | — | every push | — | — | — |

This is the matrix the owner proposed, with three additions and the reasons:

- SQLite in memory is the fastest and the most permissive engine (no column length, no type strictness, no transaction abort, no row lock). It is the default because it needs no service, and it can never be the only gate. PostgreSQL is required because it is the strictest and what production runs; MariaDB because it differs most (collation, isolation, DDL).
- The concurrency suite also runs on SQLite in a file on every push: it is the only proof of P6, and it is quick.
- The nightly run also covers the other end of each version range (PostgreSQL 14, MariaDB 11.8). A minimum version nobody tests is a guess.
- MySQL shares MariaDB's grammar and connector in Laravel; nightly is enough. The browser suite exercises the front end and stays on PostgreSQL: `bin/test-browser`, the `test:browser` Composer script and the `browser` job name the engine themselves, since `phpunit.xml` no longer leaves it to `.env`.

Because the local default becomes SQLite, a developer or agent who runs `php artisan test` no longer exercises PostgreSQL. Rule 9 of §12.3 covers it, and CI is the gate.

## 14. Acceptance criteria

1. `php artisan migrate:fresh --seed` succeeds on PostgreSQL 18, MariaDB 10.11, MySQL 8.4, and SQLite in memory and in a file.
2. The Feature, Unit and Arch suites pass on SQLite in memory, PostgreSQL 18 and MariaDB 10.11 with the same number of tests run. A test skipped on one driver is skipped by a capability (`CheckConstraint::isEnforced()`, `SqlProbe::rowLocksExist()`, `supportsSchemaTransactions()`), and the final report lists every such skip per driver.
3. The Feature suite passes on MySQL 8.4.
4. The concurrency suite (C0 to C8) passes on PostgreSQL, MariaDB, MySQL and SQLite in a file. For each of C1 to C8 the report shows the run where the test failed with its protection removed.
5. `bin/check-pg-upgrade` reports an empty schema difference between an upgraded pre-plan PostgreSQL database and a fresh one, and the same rows before and after, with unchanged names.
6. No `getDriverName()` exists outside `app/Support/Database`, `tests/Support` and `tests/Concurrency/Support`. The baseline of `DatabasePortabilityTest` is empty.
7. `grep -rn "ilike\|insertOrIgnore\|date_trunc\|nulls last\|filter (where" app database` returns nothing.
8. On each driver: a template, a whiteboard template and a saved deck cannot be created twice under names that differ only by case or surrounding spaces, through the form (422) and through the model (`UniqueConstraintViolationException`).
9. On each driver: one participant can add two different emoji to one card, and removing one leaves the other.
10. On each driver: a search for `100%` finds only text containing `100%`; a search for `ÉTÉ` finds `été`; a search for `ete` does not.
11. On each driver: an action item due tomorrow is reminded once, and a second run the same day reminds nobody.
12. On each driver: the five model rules of §6.5 refuse the row with `ModelInvariantViolation`; on PostgreSQL, MariaDB and MySQL a write through the query builder is refused by the database too.
13. **[18f]** On each driver: an account is found by its address in any case; two legacy accounts that share an address once normalised are refused by SSO sign-in and by the magic link; a new account cannot take an address a legacy row uses.
14. A deadlock or a busy database that survives its retries is answered 503 with `Retry-After`, in JSON for a JSON request.
15. `php artisan skrum:check-database` exits 0 on the four configurations of Sail and CI, and non-zero, with a sentence naming the setting, on MariaDB with `utf8mb4_unicode_ci`, on MariaDB at REPEATABLE READ, and on a SQLite file with `journal_mode` `delete`.
16. The CI workflow has the jobs of §13; the required ones pass on the plan's branch.
17. `docs/database.md` exists with the sections of §12; `README.md` links to it; `.env.example` has the four blocks; `CLAUDE.md` has the rule.
18. The production image starts on PostgreSQL, on MariaDB and on SQLite with the three Compose files, migrates, and serves `/up`.
19. The browser suite passes on PostgreSQL after the last task.

## 15. Risks, and what cannot be known before the first run

- **Unknown failures.** 3 212 feature tests have never run on another engine. The audit predicts the causes, not the count. §6.8 has a stop rule; the plan has a triage task with no fixed size. This is the main uncertainty of the estimate.
- **Collation names.** `utf8mb4_nopad_bin` (MariaDB) and `utf8mb4_0900_bin` (MySQL) are read from the engines' documentation, not tried. Task 1 of the plan creates a table with each; the fallback is `utf8mb4_bin` on both, with the pad rule of §9 documented.
- **`pg_dump` text.** The upgrade check compares dumps. If PostgreSQL prints an equal schema in two ways (constraint order, for instance), the script sorts or normalises; it never ignores a real difference.
- **SQLite `lower()` override.** Registering a function named like a built-in is allowed by SQLite; whether the PDO driver of PHP 8.4 and 8.5 accepts it for `lower` is checked by the first search test on SQLite. The fallback is a function named `skrum_lower` emitted by `TextSearch` on SQLite only.
- **`DateOnly` and serialisation.** A custom cast may serialise differently from Eloquent's `date` in `toArray()`. Every presenter read uses `toDateString()`; the action item and reminder tests are the check.
- **Model guards meet existing code.** A code path that saves a transient invalid state would already fail on PostgreSQL, so none should exist; the suite on PostgreSQL is the check.
- **Open branches.** The lanes of plan 18e and `plan-18f-auth` add PHP. The audit did not read the lanes. The architecture test, merged into `plan-18e-screens` first, makes every later merge show its own violations.
- **SQLite on PHP 8.3.** `composer.json` allows PHP 8.3, where immediate transactions are not applied (D3).
- **Process-based concurrency tests** depend on timing (a start instant and a pause). C0 detects a machine too slow to overlap; the pause is a constant of `Race`.
- **Not determined by reading, carried from the audit §8:** whether the `ci` job passes today without a database service (it is rewritten); queries issued by Fortify, Sanctum, Socialite and the password broker under each collation (pinned by tests in WP5); `whereIn` list sizes against SQLite's bound-parameter limit (32 766 from SQLite 3.32; no list in the application approaches it by design, unverified); how many of the 23 query-count tests depend on an engine.
- **Resolved by reading for this spec** (audit §8.4 and §8.5): `chatId` is cast to a string before it is stored (`HandleTelegramUpdate.php:55`), so the JSON lookup matches on SQLite; `SummarizeHealthCheck.php:106` sorts rows already filtered by `completed_at < ?` (`:103`), which excludes NULL.

## 16. Decisions for the owner

Each is built as recommended unless the owner says otherwise.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | What the documentation says about SQLite | (a) supported for production without qualification; (b) supported for small instances, with the limit stated; (c) development and evaluation only | **(b)**. It is tested as thoroughly as the others, but it has one writer and live sessions are write-heavy. Saying "small instance: a few teams, a few dozen people at once" is honest; (a) invites a 200-person retro on a file. |
| D2 | Default engine of a fresh install (`.env.example`, production Compose) | (a) PostgreSQL, as today; (b) SQLite, zero configuration | **(a)**. Existing instances and the browser suite are on it, and it has no single-writer limit. SQLite is one documented file away. |
| D3 | PHP 8.3 and SQLite | (a) raise `composer.json` to `^8.4` (the image, CI and Sail already run 8.4 or 8.5); (b) keep `^8.3` and let `skrum:check-database` refuse SQLite on 8.3 | **(a)**. One floor to explain. It is a dependency change, so it needs the owner's word; until then the plan builds (b). |
| D4 | Minimum versions | (a) the oldest version maintained upstream: PostgreSQL 14, MariaDB 10.11, MySQL 8.4; (b) the audit's feature floors: PostgreSQL 14, MariaDB 10.6, MySQL 8.0.16 | **(a)**. The audit's floors are past end of life on the spec date and would be claimed untested. |
| D5 | **[18f]** How an address is looked up | (a) a stored `email_key` under an index (this spec); (b) plain equality on `email`, no new column: simpler, but two legacy accounts sharing an address are no longer detected, which silently drops a refusal 18f made on purpose; (c) keep `lower(email)`: no schema change, but a full scan of `users` at every sign-in and one raw SQL site left | **(a)**. |
| D6 | Alphabetical lists (33 `orderBy('name')` sites) | (a) sort in PHP now, at every site that returns a whole list (about 28), and keep SQL order with a tie-breaker where the query is limited; (b) only fix the two raw `lower()` sorts and what the triage finds; the rest sorts by code point on three engines (`Zoe` before `adam`, accents after `z`) | **(a)**. It is mechanical with one helper, and it is the kind of silent difference this plan exists to remove. It adds one task. |
| D7 | SQL Server | (a) best effort as in A2; (b) a second spec for a forked schema | **(a)**. No user has asked for it; the cost is a second schema to maintain for ever. |

## 17. Where this spec departs from the audit

1. **A fifth `ilike` site and a third escaper were missed.** `app/Http/Controllers/TeamEstimatesController.php:39` uses `ilike` with its own `escapeLike` (`:138`), in both trees. It joins `TextSearch` in WP3.
2. **Name-ordered queries are 33, not 20** (`grep -rnE "orderBy\('(\w+\.)?name'\)|sortBy\('name'\)" app`). See D6.
3. **Minimum versions** (D4): MariaDB 10.6 and MySQL 8.0 are past end of life.
4. **`BEGIN IMMEDIATE` needs PHP 8.4.** `SQLiteConnection::executeBeginTransactionStatement()` reads `transaction_mode` only on PHP 8.4 and later. The audit's SQLite fix does nothing on PHP 8.3, which `composer.json` allows (D3).
5. **`utf8mb4_bin` pads.** The audit says it makes MySQL and MariaDB "compare like" PostgreSQL. It ignores trailing spaces, which PostgreSQL and SQLite do not. This spec uses the no-pad binary collations and keeps `utf8mb4_bin` as the fallback.
6. **The e-mail advice would drop a security refusal of 18f.** The audit proposes `where('email', normalise($email))`. At its current head 18f reads two matches on purpose and refuses when two legacy accounts share an address (`ResolveSsoUser.php:46`, `SendMagicLink.php:37`). Hence `email_key` (D5). The audit read 18f at `320e0893`; the head is `d9180f10`.
7. **No new driver branch in migrations.** The audit proposes making the unguarded index of `2026_10_01_100300:21` PostgreSQL-only in the historic file, a sixth driver branch against its own rule 3. Here the raw index statements are removed from the historic files and the new migration drops the old indexes where `Schema::hasIndex()` finds them.
8. **`phpunit.xml` moves to SQLite last, not first.** In the audit's WP1 it would turn the default suite red until WP7.
9. **`bin/test-browser` is left alone.** The audit rewrites its database creation to be driver-neutral; the browser suite stays on PostgreSQL, so that is work without a user.
10. **Constraint tests cannot simply be "un-skipped".** Once the model guards the rule, the refusal is a `ModelInvariantViolation`, not the `QueryException` the tests expect. The tests change, and a second test reaches the database constraint directly.
11. **The upgrade of existing installs is proved, not argued.** The audit states which edits leave PostgreSQL unchanged. Dropping the five JSON defaults does not; this spec adds the migration that makes existing installs equal, and the schema diff that checks it.
12. **Two "not determined" points are determined** (§15, last point).
13. **The owner's row is not locked around every name check.** Audit §3.1 says the name rules are safe from a race because the caller holds the owner's row lock, and cites four sites. That is true of `SaveWhiteboardTemplate` only. In `PokerDecksController::store`, `WorkspacePokerDecksController::store` and `WorkspaceTemplatesController::store` the name is validated first and the lock taken after, so the race exists, on PostgreSQL too, where the unique index turns it into a 500. And `SaveTeamIntegration.php:47`, which the audit lists as protecting "a row that may not exist", protects nothing on PostgreSQL in that case. Both are fixed in §6.6.

Confirmed against the code while writing: the 39 raw SQL lines of `app/` (same count), the five guarded migrations and the unguarded index, the five `::jsonb` defaults and the matching `$attributes`, `SQLiteGrammar::compileLock` returning an empty string, `MySqlConnector` applying `isolation_level` and `timezone`, `PostgresGrammar::typeDateTime` and `typeLongText`, the base grammar throwing on `insertOrIgnore`, `Schema::hasIndex` matching an index by name, the lock sites of `RevokeInstanceAdmin`, `CardVotesController`, `PokerDecksController`, `SaveWhiteboardTemplate` and `SaveTeamIntegration`, the single conditional `update` of `ConsumeMagicLink` [18f], and the tests of audit §6 at the lines given.
