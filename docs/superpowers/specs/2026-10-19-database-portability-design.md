# Skrüm — Database portability — Design (revision 2)

Date: 2026-10-19 (drafted 2026-10-02, revised 2026-10-02 evening)
Status: Revision 2, awaiting the owner's review. It replaces `docs/superpowers/specs/2026-10-19-database-portability-design.md`. Seven decisions are open (§16); the rest is ruled in the ledger (`.superpowers/sdd/plan-db/progress.md`).
Owner requirement (2026-10-02): "the application must run on SQLite, MariaDB and any other database handled by Eloquent".
**Owner rule (2026-10-02, evening): "for the databases use Eloquent simply, without raw queries, and respect Laravel conventions."** This revision exists to apply it.
Basis: `docs/superpowers/research/database-portability-audit.md`; the report of Tasks 1 and 2, which ran (`.superpowers/sdd/plan-db/task-1-2-report.md`); the worktree `.claude/worktrees/laneDb` at `985bf55c` (branch `plan-db-portability`); the worktree `.claude/worktrees/laneAuth` at `3f4e5475` (branch `plan-18f-auth`, marked **[18f]**, not merged into `plan-18e-screens`); `vendor/laravel/framework` v13.34.0.
What was run: Tasks 1 and 2 only. Their facts are used here as facts (§15). Everything else is read from the code and from the framework's grammars.
Plan: `.superpowers/sdd/plan-db/2026-10-19-plan-database-portability.v2.md`.

Drivers: PG = PostgreSQL, MY = MySQL, MA = MariaDB, SL = SQLite, MS = SQL Server.

## 0. What the owner rule changes

Target state: **zero raw SQL in `app/` and `database/`**. No `whereRaw`, `orWhereRaw`, `selectRaw`, `orderByRaw`, `havingRaw`, `groupByRaw`, `fromRaw`; no `DB::raw`, `DB::statement`, `DB::unprepared`; no `DB::select`, `DB::insert`, `DB::update`, `DB::delete` with an SQL string; no `Expression` object; no raw index or constraint SQL in a migration; no `getDriverName()` and no other branch on the driver; **no helper class that wraps raw SQL**. Only Eloquent models, relationships, scopes, the standard methods of the query builder, and the Schema builder.

| Revision 1 | Revision 2 |
|---|---|
| `Sql::countWhen`, `Sql::nullsLast`, `Sql::never` | gone. Plain `count()` queries; a stored sort column; `whereKey([])` |
| `TextSearch` (`lower(col) like ? escape '!'`) and `SqliteFunctions` (a replaced `lower()` on SQLite) | gone. Stored folded search columns, `whereLike(..., caseSensitive: true)` (§6.4.3). Task 1 showed the `lower()` replacement is impossible on the PDO object Laravel opens |
| `CheckConstraint::add()` and database check constraints on three engines | gone. The five rules live in the model on every engine (§6.5) |
| `InsertOnce` | gone. `firstOrCreate` / `createOrFirst` on a model |
| An "allowed list" of raw calls with a ratchet | gone. One baseline, which ends empty; no allowed list exists |
| A driver test allowed inside `App\Support\Database` | not allowed anywhere in `app/` or `database/` |
| `DatabaseRequirements` sending `select @@…` and `pragma …` | reads configuration, `getServerVersion()` and `Schema::getTables()` only (§10) |
| Grouped aggregates through `selectRaw` (allowed as "plain aggregates") | relationship aggregates (`withCount`, `withSum`), plain `count()` / `avg()`, or PHP over a bounded set (§6.4.1) |

What stays: stored normalised keys (`name_key`, `email_key`), the binary no-pad collations, READ COMMITTED, SQLite's immediate transactions, the model guards, `DateOnly`, the PHP sort of lists, the retry policy, the concurrency suite, the upgrade proof, CI, the documentation.

Working assumptions A1 to A4 of revision 1 are unchanged and ruled (targets: SQLite, MariaDB, MySQL, PostgreSQL; SQL Server best effort; this plan runs its tests; it comes before the feature roadmap).

## 1. Problem statement

The application migrates on PostgreSQL only. Task 1 measured it: on SQLite every database test stops at `2026_10_06_100000_create_game_tables.php:48` (the five `'[]'::jsonb` defaults); on MySQL and MariaDB at `2026_10_01_100300_create_workspace_templates_table.php:21` (an expression index). The architecture test of Task 2 lists 116 occurrences in 72 lines of raw SQL, driver branches and engine-specific constructs: 39 raw calls and 19 engine-specific matches in `app/`, 9 raw statements, 9 raw expressions, 5 driver branches and 7 non-null timestamps in the migrations, 18 sites in the tests. The larger problem is what would not fail but would behave differently: collation, isolation level, row locks SQLite ignores, and five invariants that exist only as PostgreSQL constraints.

Every instance in production runs PostgreSQL. Nothing in this spec may lose their data or change their behaviour.

## 2. Goals

1. `php artisan migrate` and the application run on SQLite, MariaDB, MySQL and PostgreSQL from the same code, **with no raw SQL and no driver branch in `app/` and `database/`**.
2. Every invariant of the product holds on each of the four drivers, and a test proves it on each. Where a lock matters, the proof is a test with two real connections.
3. An existing PostgreSQL instance upgrades with `php artisan migrate`, without data loss, and ends with the schema of a fresh install, except five legacy check constraints that the Schema builder cannot drop (decision D8, §6.2).
4. New code stays that way: the architecture test fails on any raw construct, its baseline is empty at the end, and no allowed list exists.
5. An operator can choose a database knowing its limits.

## 3. Non-goals

- SQL Server support.
- Moving data from one engine to another.
- Accent-insensitive search. Search ignores case and respects accents, on every engine (§9).
- Full-text or trigram indexes.
- The browser suite on a second driver.
- Redis, or any change to cache, session and queue stores beyond their lock connection and the SQLite settings.
- Converting nullable `timestamp` columns to `dateTime`.
- Database-level check constraints (the rule excludes them: the Schema builder has none).

## 4. Supported matrix

Unchanged from revision 1 and ruled (D4): PostgreSQL 14 (tested on 18, nightly on 14), MariaDB 10.11 (nightly 11.8), MySQL 8.4 (nightly), SQLite 3.35 with PHP 8.4 (ruled D3: `composer.json` goes to `^8.4`, a constraint change to show the owner).

The reason "`CHECK` constraints are enforced from …" no longer matters. Still not needed anywhere: `RETURNING`, window functions, `DISTINCT ON`, hand-written `ON CONFLICT`, recursive queries, generated columns.

## 5. Principles

- **P1 — Eloquent, and nothing raw.** A query is written with models, relationships, scopes and the standard builder methods. What the builder cannot say is not said in SQL: it is stored (P2, P3), or computed in PHP on a set whose size has a stated bound (P13).
- **P2 — Normalise in PHP.** A value compared without regard to case is folded in PHP, once, by one function, and stored.
- **P3 — Derived columns are maintained by the model.** `name_key`, `email_key`, the `*_search` columns, `action_items.sort_rank`, `game_points.week_start` are written by a mutator or a `saving` / `creating` hook, never by a caller. A write that bypasses the model must set them itself; the plan greps for such writes and found none today.
- **P4 — Binary, case-sensitive comparison everywhere.** MySQL and MariaDB use a binary, no-pad collation (set by the connection, exists on both: Task 1), so `=`, `unique`, `group by` and `distinct` mean what they mean on PostgreSQL and SQLite. Confirmed for revision 2: nothing in the new design needs a `_ci` collation or a column-level `->collation()` (§6.4.3).
- **P5 — READ COMMITTED on MySQL and MariaDB**, set by the connection option `isolation_level`.
- **P6 — SQLite: WAL, a busy timeout, immediate transactions**, all four set by connection options.
- **P7 — Lock the aggregate root first** (`lockForUpdate()`).
- **P8 — Retry only what is safe to repeat**, through `DB::transaction($callback, $attempts)`.
- **P9 — Code for the strictest engine.**
- **P10 — An invariant the Schema builder cannot express is enforced in the model**, on every engine alike. The database holds foreign keys, `NOT NULL` and unique indexes only.
- **P11 — SQL order is stable, not alphabetical.** A sort has a tie-breaker and never depends on where NULL sorts. A list read by people in alphabetical order is sorted in PHP.
- **P12 — Results are cast in PHP.** Aggregates read through `withSum`, `withAvg`, `sum()`, `avg()` differ in type per driver.
- **P13 — PHP processes bounded sets only.** Each place that loads rows to count, group or sort them states its bound (§6.4.1). Where the set grows without bound, the aggregate stays in SQL through a builder method, or a derived column is stored.

## 6. Design by work package

### 6.0 WP0 — Guard rail (done, Task 2)

`tests/Arch/DatabasePortabilityTest.php` scans `app/`, `database/` and `tests/` and fails on any construct of §11 that is not on `tests/Arch/database-portability-baseline.txt` (72 lines, `path|rule|count`). The file only shrinks and ends empty. There is no allowed list. The rule for agents is in `docs/database.md` and in the test's failure message; `CLAUDE.md` is the owner's file and is not edited (the rule text is proposed to the owner in the final report).

### 6.1 WP1 — The suite runs on each driver (done, Task 1)

Built and run: `bin/test-db`, the Compose services `mariadb` (10.11) and `mysql` (8.4), the connection settings (collations `utf8mb4_nopad_bin` and `utf8mb4_0900_bin`, both exist; READ COMMITTED; `+00:00`; SQLite `busy_timeout` 5000, WAL, `synchronous` normal, `transaction_mode` IMMEDIATE), the lock connections `<driver>_locks` and `null` on SQLite. Learnt by running: under `--parallel` Laravel renames the database of the default connection only, so `tests/TestCase.php` copies `url` and `database` to `<default>_locks`.

Added by this revision (plan Task 3): **`bin/test-db` stops before the suite when the schema does not migrate.** It runs `migrate:fresh` once; on failure it prints the migration that stopped and exits 3. Reason: every database test re-runs `migrate:fresh` when the schema is broken; a whole-suite run on MariaDB then takes about four hours for one line of information (Task 1).

### 6.2 What "run on PostgreSQL unchanged" means

Historic migrations have already run on production instances. Editing one changes fresh installs only; anything an existing install needs is a new migration. `bin/check-pg-upgrade` loads a dump of the PostgreSQL schema as it was before this plan (with sample rows), runs `php artisan migrate`, and compares the result with a fresh install: same rows, same schema, except what D8 decides for the five check constraints. With D8 (a), the script asserts exactly that difference: five check constraints on the upgraded database, none on the fresh one, nothing else.

### 6.3 WP2 — Migrations: the Schema builder only

**Edited in place** (fresh installs; all four engines get the same schema):

| Migration | Change |
|---|---|
| `2026_10_06_100000_create_game_tables.php:54-60` | The five `->default(new Expression("'[]'::jsonb"))` are removed. `GameRound::$attributes` (`app/Models/GameRound.php:55`) already gives the five values |
| `2026_10_01_100300:21`, `2026_10_03_100100:23-27`, `2026_10_10_100000:25-29`, `2026_10_15_100000:22` | The four `create unique index … lower(name)` statements and their driver branches are removed (replaced by `name_key`, below) |
| `2026_10_01_110000:25-34`, `2026_10_02_100000:68-77`, `2026_10_15_100000:17-21` | The five `alter table … add constraint … check` statements and their driver branches are removed. Nothing replaces them in the database (§6.5) |
| `2026_10_02_100000:46-66`, `backfill()` | The four `DB::raw` correlated subqueries become query-builder loops (below) |
| The seven non-null `timestamp()` columns (five migrations) and three in [18f] | `dateTime()`. Identical DDL on PostgreSQL (`typeDateTime` calls `typeTimestamp`); `DATETIME` on MySQL and MariaDB |
| `2026_10_08_100000:14-18` | `longText()` for the four payload columns |

The backfill of `2026_10_02_100000`, with the builder only:

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
        DB::table('action_items')->where('created_by_participant_id', $participant->id)->whereNull('created_by_user_id')
            ->update(['created_by_user_id' => $participant->user_id]);

        DB::table('action_items')->where('assignee_participant_id', $participant->id)
            ->update(['assignee_user_id' => $participant->user_id, 'assignee_participant_id' => null]);
    });
}
```

`DB::table()` is the query builder, not a raw statement. This migration has run on every existing install; on a fresh install the table is empty. Its test stops adding a column inside a test (§6.7).

**New migrations** (all four engines run them; each is Schema builder plus query-builder loops):

1. `drop_json_defaults_from_game_rounds` — the five columns through `->change()` with no default, so that existing installs equal fresh ones.
2. `add_name_keys_to_named_tables` — for `workspace_templates`, `whiteboard_templates`, `poker_decks`: add `name_key` `string(160)` nullable; fill it in PHP with `NameKey::of($name)` in id order (a later row of the same owner with the same key gets the key followed by ` ~` and the last eight characters of its id; names never change; each such row is logged); make it non-null and add the plain unique indexes `(workspace_id, name_key)`, `(team_id, name_key)`; then drop the old expression indexes **where `Schema::hasIndex($table, $name)` finds them**, with `$table->dropIndex($name)`. No driver test: on an engine or an install that never had them the step does nothing.
3. `add_week_start_to_game_points` (§6.4.1), `add_sort_rank_to_action_items` (§6.4.2), `add_search_columns` (§6.4.3): add the column, fill it by chunks, add its index.
4. **[18f]** `add_email_key_to_users_table`, `normalise_workspace_invitation_emails`, `add_search_columns_for_workspace_search` (§6.5, §6.4.3).

**The check constraints of existing PostgreSQL installs.** The Schema builder has no method that names a check constraint: no `check()`, no `dropCheck()`, and `Schema::hasIndex()` does not see one. So a migration cannot remove them and stay within the rule. Decision D8; recommended: they stay on those installs. They are strictly redundant with the model guards (same five rules), they only ever refuse a write that bypasses the model, and a fresh install does not have them. `docs/database.md` says so, and says that a later change to one of the five rules must come with the removal of the matching constraint on old installs (options in D8).

**Invariants and proof:**

| Invariant | Mechanism | Test, run on each driver |
|---|---|---|
| A template or deck name is unique per owner, whatever its case and surrounding spaces | unique index on `name_key` | `NameKeysTest` |
| The four key indexes exist | Schema builder | same file, `Schema::hasIndex` |
| No JSON column of a round has a database default; a new round gets its empty lists | `GameRound::$attributes` | `PortableSchemaTest` |
| The legacy backfill gives the same rows as before | query-builder loops | `tests/Upgrade/LegacyActionItemsBackfillTest.php`: migrates up to the migration before, inserts legacy rows, runs the real migration (§6.7) |
| An existing PostgreSQL install keeps its rows and ends like a fresh one, the five constraints aside | new migrations | `bin/check-pg-upgrade` |
| The schema migrates from nothing | — | the preflight of `bin/test-db`; `migrate:fresh --seed` on the four drivers in CI |

### 6.4 WP3 — Queries: every raw call becomes Eloquent

#### 6.4.1 Aggregates, conditional counts, leaderboards, weeks

The builder has `count()`, `sum()`, `avg()`, `max()`, `distinct()->count($column)` and, from a parent model, `withCount`, `withSum`, `withAvg`, `withMax` with constrained closures and aliases. It has no grouped aggregate with an alias. Each `selectRaw` therefore becomes one of three things. "Bound" is the number of rows PHP receives.

| Site (laneDb `985bf55c`) | Today | Replacement | Bound |
|---|---|---|---|
| `Mcp/Presenters/McpMessage.php:48`, `Actions/Retros/BuildBoardSnapshot.php:250,255`, `Actions/Retros/BuildSummaryInput.php:153` | `card_id, count(*)` over a retro's votes | `Retro::voteCountsByCard(?Participant $voter = null)`: `$this->cards()->select('id')->whereHas('votes', $by)->withCount(['votes' => $by])->get()` mapped to `id => (int) votes_count` | cards of one retro that have a vote; counted in SQL |
| `Http/Controllers/WorkspaceTemplatesController.php:131` | `saved_deck_id, count(*)` | `$workspace->pokerDecks()->withCount(['games as usage_count' => fn ($games) => $games->whereIn('team_id', $visibleTeamIds)])` (`SavedPokerDeck::games()` exists) | decks of one workspace (at most 30); counted in SQL |
| `Http/Controllers/PokerDecksController.php:57` | `deck, count(*)` over a team's games | one `$team->pokerGames()->where('deck', $deck->value)->count()` per built-in deck | 4 queries (the enum has four built-in decks), no row loaded |
| `Actions/HealthCheck/SummarizeHealthCheck.php:38` | `statement, count(*), sum(score), sum(score * score)` | `$retro->healthCheckAnswers()->get(['statement', 'score'])`, grouped in PHP (the sum of squares has no builder form) | participants × statements of one retro |
| `SummarizeHealthCheck.php:111` | `statement, avg(score)` of the previous retro | the same read on the previous retro, `->groupBy('statement')->map->avg('score')` | participants × statements of one retro |
| `Actions/HealthCheck/BuildHealthTrend.php:112` | `retro_id, statement, sum(score), count(*)` | new relation `RetroHealthStatement::answers()` (`hasMany(HealthCheckAnswer::class, 'statement', 'key')`), read with `withCount(['answers' => $sameRetro])->withSum(['answers' => $sameRetro], 'score')`, `$sameRetro` being a `whereColumn` on the two `retro_id` columns | statements of the retros asked for (the same rows `statementKeysByRetro()` loads today); summed in SQL |
| `Actions/Teams/BuildTeamMoodTrend.php:46` | `retro_id, count(distinct participant_id)` | on the retro query already there: `->withCount(['participants as mood_voters_count' => fn ($participants) => $participants->whereHas('healthCheckAnswers')])` (new relation `Participant::healthCheckAnswers()`) | none; counted in SQL |
| `Actions/Retros/SummarizeRoti.php:20` | `score, count(*)` | `$retro->rotiVotes()->pluck('score')->countBy()` | one integer per participant of one retro |
| `Actions/Retros/BuildSummaryInput.php:262` | `count(*), avg(score)` | `$scores = $retro->rotiVotes()->pluck('score')`, then `count()` and `avg()` | one integer per participant of one retro |
| `Actions/Retros/TopTeamTemplates.php:37` | `template, workspace_template_id, count(*), max(created_at)` over every retro of the team | the **100 latest** retros of the team, three columns, grouped and sorted in PHP | 100 rows. A team's retros grow without bound, so the whole set is not loaded: decision D11 (a window instead of all time) |
| `Actions/ActionItems/ActionItemQuery.php:56-60` | four `count(*) filter (where …)` and `count(distinct retro_id)` | five `count()` on clones of the scope; `->distinct()->count('retro_id')` for the last | none: five count queries (the prop is deferred) |
| `Actions/Games/RoomLeaderboard.php:35` | `player_id, sum(points), sum(case when is_win …), count(*)` | new relation `GamePlayer::points()`; `$room->players()->whereHas('points', $since)->withSum(['points as total_points' => $since], 'points')->withCount(['points as wins' => $won, 'points as rounds_played' => $since])`; the PHP sort that exists stays | players of one room; summed in SQL |
| `Actions/Games/TeamGameLeaderboard.php:48-51` | join, grouped sums, `order by total desc, wins desc, lower(name)`, `limit 20` | new relation `User::gamePoints()`; `$team->members()->whereHas('gamePoints', $inScope)->withSum(…)->withCount(…)->get()`, sorted in PHP by points, wins, alphabetical name, id, then `take(20)` | members of one team who scored in the period; summed in SQL. Sorting in PHP makes the top twenty the same on every engine |
| `Actions/Games/GameStreaks.php:30-31` | `date_trunc('week', created_at)` grouped | stored column `game_points.week_start` (`date`, the Monday in UTC, set by `GamePoint::creating`, index `(team_id, user_id, week_start)`); read with `->select(['user_id', 'week_start'])->distinct()` | users asked for × distinct weeks played. Without the column the read would be every points row of the team, which grows with every round: rejected |

Other raw calls of `app/`:

| Site | Today | Replacement |
|---|---|---|
| `Actions/Integrations/TrackedIssues.php:34,53` | `whereRaw('false')` | `->when($site === null, fn (Builder $none) => $none->whereKey([]))` (an empty `whereIn` compiles to `0 = 1` on every grammar) |
| `TrackedIssues.php:135` | `orWhere('external_id', 'like', "{$repositoryId}/%")` | no `like`: the method already plucks every tracked id; the repository filter becomes `Str::startsWith($id, $prefixes)` in the loop. Bound: the tracked links and tasks of one integration |
| `Actions/ActionItems/SendActionItemReminders.php:80` | `->select(DB::raw(1))` inside `whereExists` | delete the line; `whereExists` needs no select |
| `SendActionItemReminders.php:104` | `DB::table('action_item_reminders')->insertOrIgnore(...) === 1` | `ActionItemReminder::query()->createOrFirst([unique key], ['sent_at' => now()])->wasRecentlyCreated`. `createOrFirst` runs the insert in a savepoint and catches the unique violation only |
| `Actions/Games/DrawGameWord.php:31` | `DB::table('game_used_words')->insertOrIgnore(...)` | new model `GameUsedWord`; `firstOrCreate([team_id, locale, word])` |
| `Actions/Surveys/CloseOpenSurveys.php:14` | `'version' => DB::raw('version + 1')` in a mass update | `->increment('version', 1, ['is_closed' => true])` |
| `Actions/Retros/BuildSummaryInput.php:228`, `TeamGameLeaderboard.php:51` | `orderByRaw('lower(…)')` | stable SQL order, then `Alphabetical::sort()` in PHP (P11) |
| `Http/Controllers/Games/GameHostsController.php:31`, `GameRoundsController.php:33` | an id validated as `'string'` | add the `uuid` rule (a malformed id is a 500 on PostgreSQL only) |

#### 6.4.2 The action-item list: computed order before pagination

`ActionItemQuery::order()` (`:117-133`) sorts open items before completed ones; open items overdue first, then by due date with undated last, then by priority; completed items by completion, newest first; then newest, then id. It uses four `orderByRaw`, one with `nulls last`, and the list is paginated 50 per page and unbounded (completed items accumulate). It is also used by `CarriedActionItems` (a limit) and the MCP tool `ListActionItems`.

Options considered:

- *Sort in PHP.* Rejected: the set is unbounded, and pagination must cut after the sort.
- *Two or three ordered queries merged* (open dated, open undated, completed), paging across them by counts. Builder-only and correct, but each page costs three counts and up to three reads, the paginator is hand-built at three call sites, and the priority key still has no builder form (`high`, `medium`, `low` do not sort alphabetically).
- *A stored sort column maintained on save.* **Chosen.** One integer, `action_items.sort_rank`, written by the model's `saving` hook from `completed_at`, `due_on` and `priority`:

| State | `sort_rank` |
|---|---|
| open, due on `Y-m-d` | `Ymd × 10 + weight` (for example 2026-10-05, medium: `202610051`) |
| open, no due date | `1 000 000 000 + weight` |
| completed | `2 000 000 000` |

`weight` is `ActionItemPriority::sortWeight()` (0 high, 1 medium, 2 low), which exists. The query becomes `->orderBy('sort_rank')->latest('completed_at')->latest('created_at')->orderBy('id')`: plain columns, one query, ordinary `paginate()`.

Why it is the same order: "overdue first, then by due date" is the due date ascending (an overdue date is an earlier date), so the order does not depend on today and can be stored. Within one `sort_rank` all rows are open (their `completed_at` is NULL for all) or all completed (never NULL), so the position of NULL never decides anything. The largest value is below 2³¹. An index `(team_id, sort_rank)` serves the list, which today sorts without one.

Invariant: `sort_rank` equals the function of the three columns for every row. Enforced by `ActionItem::saving`; rows are only written through the model (checked by grep in the plan); the migration fills existing rows by chunks with the same function. Test on each driver: the order of a list holding every state, the second page of 51 items, and the rank following an update of each of the three columns.

#### 6.4.3 Case-insensitive search

Sites: the five `ilike` (`Mcp/Tools/Retro/SearchBoards.php:121,146,161,185` on `retros.title`, `retros.summary`, `action_items.content`, `cards.content`; `Http/Controllers/TeamEstimatesController.php:39` on `poker_tasks.title`), the two `whereLike` of `Admin/AdminCandidatesController.php:22-23` (`users.name`, `users.email`), and **[18f]** the seven `ilike` of `Actions/Search/SearchWorkspaceContent.php:54-83` (`retros.title`, `poker_games.title`, `poker_tasks.title`, `whiteboards.title`, `game_rooms.name`, `action_items.content`, `cards.content`).

What the builder compiles (`Query/Grammars/*`, v13.34.0):

| Call | PostgreSQL | MySQL, MariaDB | SQLite | SQL Server |
|---|---|---|---|---|
| `whereLike($c, $p)` (case-insensitive, the default) | `ilike` | `like`: follows the collation | `like`: folds ASCII letters only | `like`: follows the collation |
| `whereLike($c, $p, caseSensitive: true)` | `like` | `like binary` | `glob`, the pattern rewritten (`%` → `*`, `_` → `?`, `*` → `[*]`, `?` → `[?]`) | throws |

No grammar emits an `escape` clause. The default escape character is the backslash on PostgreSQL, MySQL and MariaDB; SQLite's `LIKE` has none, and its `GLOB` has no escape for what Laravel turned into `*` and `?`.

**Option (a), `whereLike` case-insensitive, is wrong on three engines.** Under the binary collations of P4 it is case-sensitive on MySQL and MariaDB. With a `_ci` collation instead, it would work there, but then every `=` and every unique index ignores case too: two whiteboard element ids that differ by case collide, `Ada` and `ada` are one token name; and with the older `utf8mb4_unicode_ci` every emoji is the same reaction (`utf8mb4_0900_ai_ci` and MariaDB's `uca1400` collations do tell emoji apart, but still fold case and accents in keys). A column-level `->collation()` on the searched columns only is a Schema builder method, but it is not portable: `PostgresGrammar::modifyCollate` and `SQLiteGrammar` emit `collate "utf8mb4_…"` and the `create table` fails there. And on SQLite `like` folds ASCII only whatever is done: `ÉTÉ` does not find `été`. No collation satisfies search and keys together.

**Option (b), a stored folded column and a case-sensitive `whereLike`, is correct on the four engines and is chosen.** The collation choice of P4 stands; reaction emoji stay distinct; no `->collation()` call is needed.

- Each searched column `x` gets a sibling `x_search` (`text`, nullable), holding `Str::lower($x)` (PHP, UTF-8). The trait `App\Concerns\HasSearchColumns` fills it in a `saving` hook and hides it from serialisation; the model lists its columns.
- The term is folded by the same function and matched with `whereLike('x_search', $pattern, caseSensitive: true)`: `like` on PostgreSQL, `like binary` on MySQL and MariaDB (bytes, whatever the collation), `glob` on SQLite (bytes). Both sides are already lower-case, so a case-sensitive match is the case-insensitive search wanted, identical everywhere: `ÉTÉ` finds `été`, `e` does not find `é`.
- `users.email` is searched through `email_key` ([18f]), which is the same fold; no `email_search`.
- Columns: `retros.title_search`, `retros.summary_search`, `cards.content_search`, `action_items.content_search`, `poker_tasks.title_search`, `users.name_search`; [18f] `poker_games.title_search`, `whiteboards.title_search`, `game_rooms.name_search`. They are `text` because lower-casing can lengthen a string (`İ`) and no index can serve `%term%` anyway.
- **Wildcard characters in the term.** Without an escape clause that works on SQLite, `%`, `_`, `\`, `*`, `?`, `[`, `]` cannot be made literal through the builder. `SearchText::pattern()` replaces each of them by `_`, which matches any one character on every engine (one byte under `like binary`; the seven characters are one byte each). The SQL result is then a superset of the true matches, and the rows are filtered in PHP with `SearchText::contains()` (`str_contains` on the folded text). For a term without those characters, which is nearly every term, the SQL result is exact and the filter removes nothing. The estimates page is paginated in SQL, so for such a term a page can hold fewer than 50 rows and its total can count a near-miss: decision D10.
- Existing rows are filled by a migration, table by table, in chunks. On a large instance it rewrites every card once; `docs/database.md` says so.

Proof, on each driver, `tests/Feature/Database/SearchColumnsTest.php`: the column follows the source on create and update; `ÉTÉ` and `été` find `Été`; `ete` does not; a term `100%` finds `100%` and not `1000`; `a_b` finds `a_b` and not `axb`; a term with `*`, `?`, `[`, `\`; plus the existing feature tests of each site.

### 6.5 WP4 and WP5 — Invariants in the model, dates, collation, e-mail

**The five rules.** They existed only as PostgreSQL constraints. Each becomes a `saving` guard on its model that throws `App\Exceptions\ModelInvariantViolation`, on every engine, and is the only enforcement on a fresh install.

| Model | Invariant | Where a user reaches it (validation) | Test |
|---|---|---|---|
| `ActionItem` | never both `assignee_user_id` and `assignee_participant_id` | `ActionItemRules` | `ModelInvariantsTest`, on each driver |
| `ActionItem` | `assignee_participant_id` needs `retro_id` | `ActionItemRules` (`allowsGuests`) | same |
| `ActionItem` | `recurrence` needs `due_on` | `ActionItemRules` | same, on create and on update |
| `TeamHealthStatement` | built-in without text and label, or custom with both | `ManageTeamHealthStatements` | same |
| `SavedPokerDeck` | exactly one of `team_id`, `workspace_id` | the two deck controllers (the owner comes from the route) | same |

The model guard is the backstop; the form validation is what answers a user with a 422. Rows written outside Eloquent are unchecked on every engine (§9); the plan found no such write.

**Dates.** `action_items.due_on` and `action_item_reminders.due_on` use the cast `App\Casts\DateOnly` (`Y-m-d` on every driver). Eloquent's `date` cast writes `Y-m-d H:i:s`, which SQLite keeps as text: ranges then miss their upper bound, and `createOrFirst` on a reminder would not find the row it collided with. A custom cast is a Laravel convention, not raw SQL.

**Collation (P4).** Unchanged: `CollationTest` proves on each driver that two emoji are two reactions, `pêche` and `péché` two words, `Ada` and `ada` two token names, `'a'` and `'a '` two values.

**E-mail [18f].** Unchanged from revision 1 (D5, ruled): `users.email_key` filled by the `email` mutator and by a migration, under a plain non-unique index; `User::scopeWhereAddress()` becomes `where('email_key', LoginAddress::normalise($email))`; `workspace_invitations.email` is normalised on write and by a migration; `CreateWorkspaceInvitation` deletes pending invitations with a plain equality. Before 18f is merged, `WorkspaceInvitationsController:32,44`, `ResolveSsoUser:46` and `CreateWorkspaceInvitation:22` stay on the baseline.

### 6.6 WP6 — Concurrency

**What configuration alone expresses** (`config/database.php` options are conventions, read by the framework's connectors):

| Engine | Option | Effect (connector) |
|---|---|---|
| MySQL, MariaDB | `isolation_level` | `SET SESSION TRANSACTION ISOLATION LEVEL …` at connect (`MySqlConnector.php:96`) |
| PostgreSQL | `isolation_level` | `set session characteristics as transaction isolation level …` (`PostgresConnector.php:168`). Not set: READ COMMITTED is the server default |
| SQLite | `busy_timeout`, `journal_mode`, `synchronous` | pragmas at connect (`SQLiteConnector.php:112-148`) |
| SQLite | `transaction_mode` | `BEGIN IMMEDIATE` (`SQLiteConnection.php:31`), on PHP 8.4 and later only |
| all | `DB::transaction($callback, $attempts)` | retries on a deadlock or a busy database (`ConcurrencyErrorDetector`) |

Not expressible by an option, and therefore not set: a lock wait timeout on MySQL, MariaDB (50 s by default) and PostgreSQL (none). The alternative is a PDO init command, which is an SQL string in a config file; the 503 mapping below covers the MySQL timeout when it happens.

**Retry policy (P8)**, **503 with `Retry-After: 1`** for a concurrency error that survives its retries, and the **concurrency suite C0 to C8** with two real connections are unchanged from revision 1 §6.6, including the two fixes it found on PostgreSQL too (C5: the name is checked again once the owner is locked; C8: the team row is locked first). `App\Support\Database\Transactions` holds the retry count and delegates the error test to Laravel's detector; it wraps no SQL. Row locks are `lockForUpdate()` and `sharedLock()`, builder methods on the four engines (SQLite compiles nothing and serialises instead).

### 6.7 WP7 — The 18 test sites that read SQL or branch on the driver

| Site | Today | Design |
|---|---|---|
| `Poker/WorkspacePokerDecksTest.php:261`, `Retros/HealthStatementModelsTest.php:62` | skipped unless `pgsql`, expect a `QueryException` | no skip; expect `ModelInvariantViolation` (§6.5). Also `ActionItems/ActionItemModelTest.php:104-127` |
| `Integrations/WebhookSharesTest.php:465`, `WebhookEventsTest.php:464` | `DB::statement('select 1 / 0')` | `Tests\Support\DatabaseFailure::provoke()`: a query-builder insert of a user without its required columns, a real error on the four engines |
| `Games/GameAccessTest.php:186` (2 reads) | injects a rival insert when it sees a `select` on `"game_players"` | a `GamePlayer::creating` listener inserts the rival row just before the model's own insert: same race, no SQL read |
| `Integrations/WebhookRedeliveryTest.php:530` (2 reads) | counts `select` on `"integration_delivery_payloads"` | counts the Eloquent `retrieved` event of `IntegrationDeliveryPayload` |
| `Games/IcebreakerRoomTest.php:200`, `Integrations/ActionItemExportTest.php:265`, `Admin/InstanceAdminsTest.php:165` (lock syntax 3, reads 4) | match `for update` and a quoted table in SQL | `Tests\Support\SqlProbe::locks()`: it takes the lock clause and the quoted table name **from the connection's grammar** (`lockForUpdate()->toSql()` minus the plain query; `wrapTable()`), so it holds no SQL of its own and no driver name. Where the grammar compiles no lock clause (SQLite) the three tests are skipped by `SqlProbe::rowLocksExist()`; the invariants themselves are proved on every engine by the concurrency suite. Decision D12 |
| `InstanceSettingsTest.php:173`, `Branding/BrandInPageTest.php:183` | `Schema::drop` in a test | `Tests\Support\MissingTables::during()`: the connection looks for its tables under a prefix that does not exist (`setTablePrefix`), no DDL |
| `ActionItems/ActionItemModelTest.php:17` | `Schema::table` adds the legacy column, then calls `backfill()` | moved to `tests/Upgrade/LegacyActionItemsBackfillTest.php`: `migrate:fresh` with the paths of the migrations before `2026_10_02_100000`, legacy rows inserted, then `migrate` with that file: the real migration on real legacy rows, on every engine, no DDL written in the test, no skip. The suite `Upgrade` does not use `RefreshDatabase`; it migrates fully again afterwards |
| `ErrorPagesTest.php:32-47` (not on the baseline; PostgreSQL port) | a connection to a closed PostgreSQL port | `Tests\Support\UnreachableDatabase::config()`: one configuration for every engine (port 1, and a database path in a directory that does not exist), no driver test |

### 6.8 Triage of what only shows on another driver

Unchanged in method. The causes and their fixes, without raw SQL: result type (cast in PHP); order (tie-breaker, or `Alphabetical`); NULL position (filter the NULLs out, order by a column that is never NULL, or a stored rank as in §6.4.2 — never `nulls last`); collation (fix the test, or a stored key); date or time format (`DateOnly`, or compare Carbon values); a test that asserts an engine (§6.7); JSON path lookups; length or strictness. A failure that fits none stops and is reported.

### 6.9 WP8 — CI, operations, documentation

§10, §12, §13.

## 7. Helpers that remain

None of them holds SQL or tests the driver.

| Helper | Signature | Role |
|---|---|---|
| `App\Support\Database\NameKey` | `of(string $name): string` | `Str::lower(trim($name))`: the fold behind `name_key` |
| `App\Support\Auth\LoginAddress` **[18f]** | `normalise(string $email): string` | the fold behind `email_key` |
| `App\Support\Database\SearchText` | `fold(?string $text): ?string`; `pattern(string $term): string`; `contains(?string $text, string $term): bool` | the fold behind `*_search`, the pattern, and the exact check in PHP |
| `App\Concerns\HasSearchColumns` | trait: `searchColumns(): array<string, string>` (abstract), `scopeWhereContains`, `scopeOrWhereContains` | fills and hides the search columns; the one place that calls `whereLike` |
| `App\Casts\DateOnly` | `CastsAttributes` | `Y-m-d` on every engine |
| `App\Exceptions\ModelInvariantViolation` | `because(Model $model, string $rule): self` | a model rule was broken |
| `App\Support\Database\Transactions` | `Attempts = 3`; `isConcurrencyError(Throwable $e): bool`; `busyMessage(): string` | retry count; delegates to Laravel's detector |
| `App\Support\Database\DatabaseRequirements` | `problems(Connection $connection): array<int, string>` | reads configuration, `getServerVersion()`, `Schema::getTables()` (§10) |
| `App\Support\Alphabetical` | `key(string $value): string`; `sort(Collection $items, callable $by): Collection` | alphabetical order in PHP |
| Model methods | `Retro::voteCountsByCard()`, `ActionItem::sortRankFor()`, relations `GamePlayer::points()`, `User::gamePoints()`, `RetroHealthStatement::answers()`, `Participant::healthCheckAnswers()`, model `GameUsedWord` | §6.4 |
| `Tests\Support\SqlProbe` | `locks(Closure $during): array<int, array{table: string, level: int}>`; `lockedTables(Closure $during): array<int, string>`; `rowLocksExist(): bool` | lock order, derived from the grammar |
| `Tests\Support\DatabaseFailure`, `UnreachableDatabase`, `MissingTables` | as §6.7 | |
| `Tests\Concurrency\Support\Race` | `run(array $contenders, …): array`; `request(…): int` | two-connection proofs |

Removed since revision 1: `Sql`, `TextSearch`, `CheckConstraint`, `InsertOnce`, `SqliteFunctions`.

## 8. Invariants per driver

One column now: the mechanism is the same on the four engines unless said.

| Invariant | Mechanism | Proof |
|---|---|---|
| Name unique per owner, ignoring case | unique index on `name_key` | `NameKeysTest`, C5 |
| Address lookup ignores case; a legacy duplicate is seen as two | index on `email_key` | `EmailKeyTest` [18f] |
| Emoji, accents and case are distinct in keys | native on PG and SL; binary no-pad collation on MY and MA | `CollationTest`, C7 |
| Search ignores case, respects accents, treats wildcards as text | folded column, case-sensitive `whereLike`, exact check in PHP | `SearchColumnsTest` |
| Five model rules | model guard (old PostgreSQL installs also keep their constraint, D8) | `ModelInvariantsTest` |
| The action-item list is in its order, on every page | stored `sort_rank` | `ActionItemOrderTest` |
| A streak counts consecutive weeks | stored `week_start` | `GameStreaksTest` (existing), `WeekStartTest` |
| Caps and "last one" rules (C1, C3, C4, C6) | row lock on the root under READ COMMITTED; `BEGIN IMMEDIATE` on SL | concurrency suite |
| Single use (C2) | one conditional `update` | C2 |
| At most one row for a key that may not exist yet (C7, C8) | unique index; the loser's insert fails in a savepoint (`createOrFirst`) | C7, C8 |
| A cache lock never joins the caller's transaction | `<driver>_locks`; same connection on SL | `CacheLockConnectionTest` |
| A date-only value compares as a date | `DateOnly` | reminder tests, `DateOnlyStorageTest` |

## 9. What cannot be identical, and the rule

| Difference | Rule |
|---|---|
| Alphabetical order from SQL | SQL order is only stable. Lists read by people are sorted by `Alphabetical` in PHP. A limited or paginated query follows the engine's order for which rows make the page; documented |
| Accent-insensitive search | Not offered on any engine |
| Case folding of special letters (`İ`, `ß`) | PHP's fold everywhere, for keys and for search: identical on the four engines (in revision 1 search used each engine's `lower()`) |
| Wildcard characters in a search term | They match any one character in SQL and are checked exactly in PHP (§6.4.3, D10) |
| Concurrency model | Server engines: row locks, many writers. SQLite: one writer, others wait up to five seconds |
| Database-level check constraints | None on a fresh install, on any engine. Old PostgreSQL installs keep five (D8). The model enforces the rules; a write outside Eloquent is unchecked |
| Derived columns | Written by the model. A write outside Eloquent must set `name_key`, `email_key`, `*_search`, `sort_rank`, `week_start` itself |
| A malformed UUID in a query | An error on PostgreSQL, no row elsewhere. Every id from a request passes a `uuid` rule or a route pattern |
| A failed statement inside a transaction | Aborts the transaction on PostgreSQL only. Code is written for PostgreSQL (P9) |
| Aggregate and boolean result types | Cast in PHP (P12) |
| DDL inside a transaction | Commits implicitly on MySQL and MariaDB. Never in application code; never in a test of the Feature suite |
| `TIMESTAMP` range on MySQL and MariaDB | Nullable `timestamp()` columns end in 2038 there. New columns use `dateTime()` |
| SQL Server | Does not migrate; `whereLike(..., caseSensitive: true)` throws there |

## 10. Operations

- `.env.example`, Sail profiles, the image (`pdo_mysql`, `pdo_sqlite`), `docker/scripts/prepare`, the two alternative production Compose files: unchanged from revision 1 §10.
- **`php artisan skrum:check-database`** no longer sends any engine-specific SQL. `DatabaseRequirements::problems()` reads:
  - `getServerVersion()` against the connection's own `minimum_version` option (a new key in each connection of `config/database.php`: `14.0`, `10.11.0`, `8.4.0`, `3.35.0`), so no driver name is looked at;
  - the connection options: `collation`, when the connection has one, ends with `_bin`; `isolation_level`, when the connection has the key, is `READ COMMITTED`; `transaction_mode`, when the connection has the key, is `IMMEDIATE`; `journal_mode` is `wal`; `foreign_key_constraints` is on. The connectors apply these options at every connect, so the configuration is what the session runs with;
  - `Schema::getTables()`: a table whose `collation` is not null and does not end with `_bin` was created before the setting and is reported.
  - The warning about a PostgreSQL database in the `C` locale is gone: search folds in PHP.
- **Deploying on an existing PostgreSQL instance**: one `php artisan migrate`. It adds eleven columns, fills them (every card, action item, retro, saved template and deck, user and points row is rewritten once, in chunks, inside the migration's transaction), adds indexes, drops four indexes and five column defaults. The five check constraints stay (D8). `docs/database.md` gives the order of magnitude of the fill (one update per row) so that an operator of a large instance plans the window.

## 11. Architecture test

`tests/Arch/DatabasePortabilityTest.php` (Task 2) reads every PHP file under `app/`, `database/` and `tests/`. No folder of `app/` or `database/` is exempt. Its baseline ends empty; no allowed list exists.

Under `app/` and `database/` (as built; the three changes of this revision are marked):

| Rule | Construct |
|---|---|
| `whereRaw`, `selectRaw`, `orderByRaw`, `havingRaw`, `groupByRaw`, `fromRaw` | raw clauses (also `orWhereRaw`, `orHavingRaw`) |
| `raw expression` | `DB::raw(`, `->raw(`, `new Expression(` |
| `raw statement` | `DB::statement`, `unprepared`, `affectingStatement`, `DB::select`, `selectOne`, `selectResultSets`, `scalar`, `cursor`, `DB::insert`, `DB::update`, `DB::delete` |
| `driver branch` | `getDriverName(`, `getDriverTitle(`, `instanceof` a connection or grammar class, `config('database.default') ===` |
| `ilike`, `cast with ::`, `filter (where`, `nulls first or last`, `postgres function or clause`, `boolean literal in raw sql` | PostgreSQL syntax inside a string |
| `insertOrIgnore`, `json contains or length` | builder methods whose meaning differs per engine (`insert ignore` hides every error on MySQL; JSON containment is absent from SQLite) |
| `like comparison` (**changed**, plan Task 7) | the operator strings `'like'`, `'not like'`; a `whereLike` family call whose statement does not say `caseSensitive: true` |
| `upsert` (**removed**, plan Task 15) | `upsert()` is a standard method supported by the four grammars and the owner rule names it; nothing uses it today |
| `sql string on a connection` (**added**, plan Task 15) | `->scalar('select …')`, `->select('…')`, `->statement('…')` and the like with a string of SQL on a connection object, the form revision 1's `DatabaseRequirements` used and the facade rules do not see |

Under `database/migrations` in addition: `non-null timestamp`, `expression default`, `column collation` (`->collation(`, `->charset(`), `raw index or column` (`rawIndex`, `rawColumn`), `type that differs per engine`.

Under `tests/`, outside `tests/Support` and `tests/Concurrency/Support`: `driver branch`, `lock syntax`, `sql error as a failure`, `ddl in a test`, `reads sql text`.

A rule `function down(` in migrations (revision 1) is not added: three stock Laravel migrations have a `down` (decision D13).

## 12. Documentation

`docs/database.md` exists since Task 2 with the developer rules. The last documentation task adds the operator's half (which engine to choose, required settings, minimum versions, what differs, upgrading an existing PostgreSQL instance including the five constraints and the one-off fill) and rewrites rule 4 (search through `whereContains`; `whereLike` only with `caseSensitive: true` on a folded column) and rule 2 (PHP only on bounded sets; otherwise a derived column). `README.md` links to it. The rule text for `CLAUDE.md` is proposed to the owner, not written by agents.

## 13. Test matrix and CI

Unchanged from revision 1 §13, plus the suite `Upgrade` (one test today) in every Feature column, and the preflight of `bin/test-db` in every job that uses it.

| Suite | SQLite memory | PostgreSQL 18 | MariaDB 10.11 | SQLite file | Nightly |
|---|---|---|---|---|---|
| Lint, types, Unit, Arch | every push | — | — | — | — |
| Feature, Upgrade | every push (default of `phpunit.xml`, set last) | every push | every push | — | MySQL 8.4, PostgreSQL 14, MariaDB 11.8 |
| Concurrency | — | every push | every push | every push | MySQL 8.4 |
| `migrate:fresh --seed`, `skrum:check-database` | every push | every push | every push | every push | MySQL 8.4, PostgreSQL 14, MariaDB 11.8 |
| `bin/check-pg-upgrade` | — | every push | — | — | — |
| Browser | — | every push | — | — | — |

Rule learnt in Task 1, part of the plan's constraints: **until the migrations pass on an engine, run one test file on it, never the suite.**

## 14. Acceptance criteria

1. `php artisan migrate:fresh --seed` succeeds on PostgreSQL 18, MariaDB 10.11, MySQL 8.4, and SQLite in memory and in a file.
2. The Feature, Upgrade, Unit and Arch suites pass on SQLite in memory, PostgreSQL 18 and MariaDB 10.11 with the same number of tests run. The only skips that differ per engine are by capability: `SqlProbe::rowLocksExist()` (three lock-order tests) and the cache lock connection test. The final report lists them.
3. The Feature suite passes on MySQL 8.4.
4. The concurrency suite (C0 to C8) passes on PostgreSQL, MariaDB, MySQL and SQLite in a file; for each of C1 to C8 the report shows the run where it failed with its protection removed.
5. `bin/check-pg-upgrade` reports the same rows before and after, unchanged names, and a schema equal to a fresh one except the five legacy check constraints (D8 (a)).
6. **`tests/Arch/database-portability-baseline.txt` is empty and no allowed list exists.**
7. `grep -rnE "Raw\(|DB::raw|DB::statement|DB::unprepared|new Expression|getDriverName|ilike|insertOrIgnore|date_trunc|nulls last|filter \(where" app database` returns nothing.
8. On each driver: a template, a whiteboard template and a saved deck cannot be created twice under names that differ only by case or surrounding spaces, through the form (422) and through the model (`UniqueConstraintViolationException`).
9. On each driver: one participant can add two different emoji to one card, and removing one leaves the other.
10. On each driver: a search for `100%` finds text containing `100%` and not `1000`; a search for `ÉTÉ` finds `été`; a search for `ete` does not.
11. On each driver: an action item due tomorrow is reminded once, and a second run the same day reminds nobody.
12. On each driver: the five model rules refuse the row with `ModelInvariantViolation`.
13. **[18f]** On each driver: an account is found by its address in any case; two legacy accounts that share an address once normalised are refused by SSO sign-in and by the magic link; a new account cannot take an address a legacy row uses.
14. A deadlock or a busy database that survives its retries is answered 503 with `Retry-After`, in JSON for a JSON request.
15. `php artisan skrum:check-database` exits 0 on the four configurations, and non-zero, with a sentence naming the setting, when the MariaDB connection is configured with `utf8mb4_unicode_ci`, without READ COMMITTED, and when the SQLite connection has `journal_mode` `delete`.
16. The CI workflow has the jobs of §13; the required ones pass on the plan's branch.
17. `docs/database.md` has the sections of §12; `README.md` links to it; `.env.example` has the four blocks.
18. The production image starts on PostgreSQL, on MariaDB and on SQLite, migrates, and serves `/up`.
19. The browser suite passes on PostgreSQL after the last task.
20. On each driver: the action-item list is in the order of §6.4.2 on its first and second page; the team leaderboard shows the same twenty people; a streak counts the same weeks.
21. `bin/test-db <driver>` on a schema that does not migrate exits 3 in under a minute and names the migration.

## 15. Risks, and what is known since Tasks 1 and 2 ran

Known (no longer risks): both collation names exist (MariaDB 10.11.19, MySQL 8.4.11); the server defaults are `_ci` collations and REPEATABLE READ, so the connection settings are what makes the difference; replacing SQLite's `lower()` is impossible on the PDO object Laravel opens on PHP 8.5 (moot: no SQL `lower()` is left); `migrate:fresh` costs 4 to 5 seconds on MariaDB and MySQL in these containers; a worktree needs `npm run build` for one Inertia test; PHPStan reports 15 errors on the branch in files this work did not touch.

Open:

- **Unknown failures.** The feature tests have never run on another engine; the triage task has no fixed size. The main uncertainty of the estimate.
- **`whereLike(..., caseSensitive: true)` on SQLite is `GLOB`.** Read from the grammar, not run. The first run of `SearchColumnsTest` on SQLite is the check; if `GLOB` misbehaves on a multi-byte character, the fallback keeps the stored column and filters in PHP over `lazy()` reads (D9 (b)).
- **`like binary` and `_` on MySQL and MariaDB** matches one byte: the pattern only uses `_` for one-byte characters, by construction.
- **Relationship aggregates change the SQL.** `withCount` / `withSum` are correlated subqueries where there was one grouped query. On the board snapshot (every board load) the plan measures the query count and time on PostgreSQL before and after; the tests that count queries (23) may need their numbers updated, each named in the report.
- **`RetroHealthStatement::answers()`** joins on `statement = key` and needs the `whereColumn` on `retro_id`; the plan's test compares its result with the old query's on PostgreSQL before the old query is removed.
- **`BuildTeamMoodTrend`**: counting participants who answered equals `count(distinct participant_id)` only if an answer's participant belongs to the answer's retro. The plan checks the foreign keys and stops if not.
- **Backfill time** on a large instance (one update per row for cards). Chunked; measured on the fixture; documented.
- **Model guards meet existing code**, **`DateOnly` and serialisation**, **open branches**, **process-based concurrency tests**, **`pg_dump` text**: as revision 1 §15.
- **Old PostgreSQL installs keep five check constraints** (D8 (a)): a future change of one of those rules must deal with them.

## 16. Decisions for the owner

Ruled in the ledger on 2026-10-02 (the owner may overturn): D1 SQLite documented for small instances; D2 PostgreSQL stays the default; **D3 `composer.json` raised to `^8.4`, a constraint change the owner must see**; D4 minimum versions; D5 `users.email_key`; D6 lists sorted in PHP; D7 SQL Server best effort.

Settled by the owner rule, no longer decisions: raw aggregates and `case when` (out); a driver test inside `App\Support\Database` (out); database check constraints through a helper (out); option (c) of D5, keeping `lower(email)` (out); the allowed list (out); `upsert()` (a standard method: allowed).

Created by the rule, open, each built as recommended unless the owner says otherwise:

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D8 | The five check constraints that existing PostgreSQL installs have. The Schema builder cannot drop a check constraint | (a) leave them: old installs keep five constraints a fresh install lacks, redundant with the model guards; documented; the upgrade check asserts exactly this difference. (b) drop them with `$table->dropUnique('<constraint name>')`, which on PostgreSQL compiles to `alter table … drop constraint`, guarded by `Schema::hasIndex()` on the old expression index as the mark of an old PostgreSQL install: builder-only, but it uses a method for what it is not meant for and leans on a detail of the grammar. (c) no code: `docs/database.md` gives operators the five `alter table … drop constraint` statements to run by hand if they want identical schemas. (d) one migration with five raw statements, as the single exception to the rule | **(a)**, with (c)'s paragraph in the documentation. (b) is the fallback if identical schemas matter more than the oddity; (d) only on the owner's explicit word |
| D9 | How search ignores case without raw SQL | (a) stored folded columns (nine columns; the text of cards, action items and summaries is stored twice). (b) no column: read candidates with `lazy()` and match in PHP: no storage, but every search reads every row of its scope. (c) the builder's case-insensitive `whereLike`: no column, but case-sensitive on MySQL and MariaDB, ASCII-only on SQLite | **(a)**. (c) is not correct on three engines |
| D10 | Wildcard characters typed in a search (`%`, `_`, `\`, `*`, `?`, `[`, `]`) | (a) they match any one character in SQL and the rows are checked exactly in PHP; on the paginated estimates page such a term can give a short page and a total that counts a near-miss. (b) remove those characters from the term before searching (`100%` searches `100`) | **(a)** |
| D11 | "Top templates of a team" counted over every retro of the team | (a) over the 100 latest retros (bounded, read in PHP). (b) over all of them, loaded in PHP (unbounded). (c) a stored usage counter per team and template | **(a)**: a suggestion list is better served by recent use anyway. It is a small behaviour change |
| D12 | Three tests assert the order of row locks from the SQL text | (a) keep them through `Tests\Support\SqlProbe`, which derives the lock clause and the quoting from the grammar and is skipped where the grammar has no lock clause. (b) delete the three assertions and rely on the concurrency suite | **(a)**: the suite proves the invariant, these tests pin the lock order that prevents a deadlock |
| D13 | A rule against `function down(` in migrations | (a) not added: three stock Laravel migrations have one. (b) added, with those three rewritten | **(a)** |
| D14 | The rule for agents in `CLAUDE.md` | (a) the owner pastes the nine lines of `docs/database.md` ("Rules for database code") or a pointer to them. (b) it stays in `docs/database.md` and the test message only | **(a)**, a pointer: one line |

## 17. Where this spec departs from the audit and from revision 1

Points 1 to 13 of revision 1 §17 stand, except: point 1 (the fifth `ilike` site joins the stored-column search, not `TextSearch`); point 10 (the constraint tests expect `ModelInvariantViolation` and have no database twin). New in this revision:

14. **A sixth `like` site**: `TrackedIssues.php:135`, a case-sensitive prefix match, not in the audit. Removed, not ported (§6.4.1).
15. **No database check constraint anywhere on a fresh install.** The audit and revision 1 kept them on three engines.
16. **Search no longer depends on any engine's `lower()`**, so its fold is identical on the four engines, special letters included, and the PostgreSQL `C` locale no longer matters.
17. **"Overdue first" is not a separate sort key**: it is the due date ascending. That is what makes the action-item order storable.
18. **Leaderboard and streak** are restated as relationship aggregates and a stored week; revision 1 kept `sum(case when …)` and loaded every points row of the team for streaks.
19. **`skrum:check-database` reads configuration**, not server variables.
20. **The legacy backfill test runs the real migration** on every engine instead of being skipped off PostgreSQL.

## 18. Where "no raw SQL at all" cannot be met by Laravel's builder alone

| # | What | Why the builder cannot | What is done |
|---|---|---|---|
| 1 | Dropping the five check constraints of existing PostgreSQL installs | the Schema builder has no check-constraint method | D8: left in place (recommended) |
| 2 | Literal `%` and `_` in a search term on SQLite | no grammar emits `escape`; SQLite has no default escape; `GLOB` has none for the rewritten wildcards | superset in SQL, exact check in PHP (D10) |
| 3 | Case-insensitive `like` on the four engines | `whereLike` follows the collation on MySQL and MariaDB and folds ASCII only on SQLite | stored folded columns, case-sensitive `whereLike` (D9) |
| 4 | Grouped aggregates with an alias; a sum of squares; `count(distinct)` per group | no builder method | relationship aggregates, plain `count()`, or PHP on a bounded set (§6.4.1) |
| 5 | `nulls last` and computed sort keys before pagination | no builder method | stored `sort_rank` (§6.4.2) |
| 6 | Truncating a date to its week | no builder method | stored `week_start` |
| 7 | Reading the server's collation, isolation level and pragmas | they are engine-specific statements | configuration is checked instead, plus `Schema::getTables()` (§10) |
| 8 | A lock wait timeout on MySQL, MariaDB, PostgreSQL | no connection option | not set; a timeout is answered 503 |
| 9 | Tooling outside `app/` and `database/` | `bin/check-pg-upgrade` and CI call `psql` and `pg_dump`; `tests/Support/SqlProbe` reads the text of queries the framework wrote | kept: the rule covers application and migration code; the scripts and the probe hold no query of the application (D12 for the probe) |

Nothing else in the 116 baseline occurrences needs anything but Eloquent, the query builder and the Schema builder.
