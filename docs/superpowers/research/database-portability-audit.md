# Database portability audit

Date: 2026-10-02. Read-only audit: nothing was run (no artisan, no tests, no migration). Every statement below comes from reading the code and the framework sources in `vendor/` (laravel/framework v13.34.0).

Trees read:

- main tree `/Users/aritti/Projects/skrum`, branch `plan-18e-screens` at `192f255d` (plus uncommitted front-end changes, none in PHP database code);
- worktree `.claude/worktrees/laneAuth`, branch `plan-18f-auth` at `320e0893` (findings marked **[18f]**).

Drivers: PG = PostgreSQL, MY = MySQL 8, MA = MariaDB, SL = SQLite, MS = SQL Server.

## 0. Verdict

The application runs on PostgreSQL only. On any other driver **`php artisan migrate` fails before the application starts**:

| Driver | First migration that fails | Why |
|---|---|---|
| SL | `2026_10_06_100000_create_game_tables.php:54` | default `'[]'::jsonb` is a syntax error |
| MY, MA, MS | `2026_10_01_100300_create_workspace_templates_table.php:21` | unconditional `create unique index … (workspace_id, lower(name))`: MY needs `((lower(name)))`, MA and MS have no expression index |

Past the migrations, the code that breaks at run time is small and local (about 20 raw SQL sites). The costly part is what does not fail but behaves differently: collation, isolation level, and the invariants enforced only by PostgreSQL constraints.

Counts:

| Category | Findings |
|---|---|
| 1. Operators, functions, types, collation | 24 |
| 2. Raw SQL call sites | 39 in `app/`, 18 in `database/migrations/`, 3 in `tests/`, 1 more in [18f]; 23 not portable or portable in syntax only |
| 3. Migrations | 5 `pgsql`-only branches (7 constraints and indexes skipped), 1 unconditional expression index, 5 `jsonb` expression defaults, 9 `change()` calls in 6 migrations, 7 non-null `timestamp` columns without default (3 more in [18f]) |
| 4. Transactions and locks | 148 row locks in 110 files, 171 `DB::transaction` in 138 files, 0 with a retry count, 37 after-commit sites |
| 5. Outside SQL | 9 |
| 6. Tests | 17 test sites in 15 files assert PostgreSQL behaviour or SQL text |

## 1. Operators, functions, types, collation

### 1.1 `ILIKE`

| Site | Breaks on |
|---|---|
| `app/Mcp/Tools/Retro/SearchBoards.php:121`, `:146`, `:161`, `:185` | MY, MA, SL, MS: `ilike` is not an operator (syntax error) |
| **[18f]** `app/Actions/Search/SearchWorkspaceContent.php:54`, `:60`, `:61`, `:65`, `:69`, `:73`, `:83` | same |

Replacement: one helper (section 7.2, `TextSearch::contains`). Laravel's `whereLike($column, $value, caseSensitive: false)` compiles to `ilike` on PG and `like` elsewhere, but it adds no `ESCAPE` clause, so it does not solve 1.2.

### 1.2 `LIKE` escaping

`app/Mcp/Support/LikePattern.php:9` (moved to `app/Support/LikePattern.php` in [18f]) escapes `\`, `%`, `_` with a backslash and relies on the default escape character.

- PG, MY, MA: backslash is the default escape. Works.
- SL: `LIKE` has **no** default escape character. A term containing `%` or `_` matches as a wildcard and `\` is searched literally.
- MS: no default escape, and `[` is a wildcard too.

`app/Http/Controllers/Admin/AdminCandidatesController.php:19-23` has the same flaw through its own `escapeLike` and `whereLike`/`orWhereLike`.

Replacement: always emit `like ? escape '!'` with `!`, `%`, `_` (and `[` on MS) escaped by `!`. A non-backslash escape character avoids the dialect difference in how `'\'` is written as a literal (MY needs `'\\'`).

### 1.3 `LIKE` case sensitivity — what each lookup needs

| Driver | `like` behaviour |
|---|---|
| PG | case-sensitive, accent-sensitive |
| MY, MA with `utf8mb4_unicode_ci` (the configured default, `config/database.php:57`, `:77`) | case-insensitive **and accent-insensitive** (`e` matches `é`) |
| SL | case-insensitive for ASCII only; `É` does not match `é` |
| MS | follows the database collation, by default case-insensitive, accent-sensitive |

All four searches (MCP board search, [18f] workspace search, admin candidates, both on names, titles, content) need case-insensitive matching. Today the admin candidates search is case-sensitive on PG and case-insensitive elsewhere. Portable form: `lower(column) like ? escape '!'` with the term lowered in PHP. Remaining difference, to document rather than fix: accent folding on MY/MA under a `_ci` collation (not under `utf8mb4_bin`, see 1.6), and `lower()` being ASCII-only on SL (see 1.4).

### 1.4 `lower()` in raw SQL

Syntax is portable everywhere. Semantics are not:

- SL: built-in `lower()` folds ASCII only.
- PG: depends on the database locale (`C` locale folds ASCII only; the Sail image default `en_US.utf8` folds Unicode).
- PHP `mb_strtolower`/`Str::lower` folds full Unicode. Sites that lower the binding in PHP and the column in SQL disagree on SL for any non-ASCII name: the duplicate is not detected.
- No index is used anywhere (no functional index on `lower(email)` even on PG).

| Site | Purpose |
|---|---|
| `app/Http/Requests/WorkspaceTemplateRequest.php:106` | template name uniqueness (PHP-lowered binding) |
| `app/Actions/Poker/SavedPokerDeckRules.php:32` | deck name uniqueness (PHP-lowered binding) |
| `app/Actions/Whiteboards/WhiteboardTemplateRules.php:29` | template name uniqueness (`lower(name) = lower(?)`, both sides in SQL) |
| `app/Http/Controllers/WorkspaceInvitationsController.php:32`, `:44` | member and user lookup by e-mail |
| `app/Actions/Auth/ResolveSsoUser.php:46` | account lookup by e-mail |
| `app/Actions/Workspaces/CreateWorkspaceInvitation.php:22` | pending invitation lookup by e-mail |
| `app/Actions/Retros/BuildSummaryInput.php:228` | `orderByRaw('lower(content)')` |
| `app/Actions/Games/TeamGameLeaderboard.php:51` | `orderByRaw('lower(users.name)')` |
| **[18f]** `app/Models/User.php:114` (`scopeWhereAddress`) | every account lookup by e-mail, used by `app/Rules/UniqueEmailAddress.php:25` |
| **[18f]** `app/Actions/Workspaces/CreateWorkspaceInvitation.php` | same lookup with `LoginAddress::normalise` |

Replacement: for uniqueness, a normalised shadow column written by PHP (section 7.2, `name_key`); for e-mail, compare the stored normalised value (1.5); for ordering, sort in PHP or accept the documented collation rule (1.8).

### 1.5 E-mail uniqueness and lookups

`users.email` has a plain unique index (`0001_01_01_000000_create_users_table.php:17`).

| Driver | Unique index and `where email = ?` |
|---|---|
| PG, SL | case-sensitive: `Ada@x.io` and `ada@x.io` are two accounts |
| MY, MA (`utf8mb4_unicode_ci`) | case-insensitive, accent-insensitive, trailing spaces ignored: `josé@x.io` and `jose@x.io` collide |
| MS (default collation) | case-insensitive, accent-sensitive |

- `app/Concerns/ProfileValidationRules.php:47-48` uses `Rule::unique(User::class)`: case-sensitive on PG and SL, case-insensitive on MY, MA, MS.
- `config/fortify.php:63` lowers the username at login, so on PG a mixed-case stored address cannot log in today.
- **[18f]** fixes the case half: `User::email` mutator lowers on write (`app/Models/User.php:99-102`), migration `2026_10_17_100000_lower_case_user_email_addresses.php` lowers existing rows in PHP (portable), `UniqueEmailAddress` replaces the unique rule. It still compares with `lower(email) = ?` in SQL, which is ASCII-only on SL and unindexed everywhere.

Replacement: once [18f] is merged, look up with `where('email', LoginAddress::normalise($email))` (indexed, identical on all drivers) and keep a `lower()` fallback only for the legacy duplicate rows the migration leaves untouched, or remove the fallback once `users:report-duplicate-emails` reports none. The accent difference on MY/MA disappears with a binary collation (1.6).

`workspace_invitations.email` (`2026_09_29_110028:14`, indexed with `workspace_id`) is stored as typed; normalise it on write the same way.

### 1.6 Collation of equality and unique indexes on MySQL and MariaDB

`config/database.php:57` and `:77` default to `utf8mb4_unicode_ci`. Under that collation:

- **All supplementary-plane characters compare equal, so every emoji equals every other emoji.** `card_reactions` and `survey_reactions` store the emoji itself with `unique(['card_id', 'participant_id', 'emoji'])` (`2026_09_30_090100:18`, `2026_10_01_120400:18`). `app/Http/Controllers/Retros/CardReactionsController.php:50-57` and `SurveyReactionsController.php:49` do `firstOrCreate(['participant_id', 'emoji'])` and `where('emoji', …)->delete()`. Result on MY/MA: a second, different emoji from the same person returns the first row, and removing one emoji removes them all. `SummarizeReactions.php:32` groups in PHP and is not affected.
- Case-insensitive and accent-insensitive equality on every string key: `guest_token`, `token_hash`, `whiteboard_elements.element_id` (case-sensitive client ids, unique with `whiteboard_id`), `game_used_words` primary key (`pêche`/`péché`), `health_check_answers.statement`, `personal_access_tokens.name` (`app/Http/Controllers/Settings/ApiTokensController.php:60`, `app/Actions/Mcp/IssueMcpToken.php:47`).

Replacement: make MY and MA compare like PG and SL by setting the connection collation to a binary one (`utf8mb4_bin`; MY 8 may use `utf8mb4_0900_bin`), and express every wanted case-insensitive comparison explicitly (1.3, 1.4). Per-column `->collation()` is not usable: the PG grammar emits `collate "utf8mb4_bin"` and fails. MS needs a database created with a binary UTF-8 collation (`Latin1_General_100_BIN2_UTF8`); document, not code.

### 1.7 Casts `::`

Only in migrations: `2026_10_06_100000_create_game_tables.php:54`, `:55`, `:56`, `:58`, `:60` (`new Expression("'[]'::jsonb")`). Fails on MY, MA, SL, MS. `app/Models/GameRound.php:55-61` already sets the same defaults in `$attributes`, so the database default can be dropped (on PG a new migration `alter column … drop default` is optional; the edited create migration only has to stay equivalent for the other drivers).

### 1.8 Ordering

- `nulls last`: `app/Actions/ActionItems/ActionItemQuery.php:126`. PG and SL ≥ 3.30 only. Replacement: `case when <expr> is null then 1 else 0 end, <expr> asc`.
- Boolean expression as sort key: `ActionItemQuery.php:124` `(action_items.completed_at is not null)`. Fails on MS. Replacement: `case when … then 1 else 0 end`.
- Default position of NULL: PG sorts NULL last ascending and **first descending**; MY, MA, SL, MS sort NULL first ascending and last descending. Sorts on nullable columns found: `ActionItemQuery.php:131` (harmless, ties only), `Mcp/Prompts/TeamHealth.php:94`, `Mcp/Tools/Retro/GetRoti.php:91`, `TeamEstimatesController.php:45`, `Games/BuildGamesPlayed.php:52`, `Games/PickGifQuestion.php:24`, `Games/StartGameRound.php:100`, `Games/PresentGameRoundHistory.php:60`, `HealthCheck/BuildHealthTrend.php:43`, `Teams/BuildTeamMoodTrend.php:38`: each has a `whereNotNull` or a completed scope within the 12 lines above it. `HealthCheck/SummarizeHealthCheck.php:106` has none in that window: to verify.
- Text order (`orderBy('name')`, 20 sites, for instance `WorkspaceMembersController.php:27`, `TeamsController.php:81`): linguistic on PG (database locale), binary on SL and on MY/MA once the collation is binary, so `Zoe` sorts before `adam`. Rule: user-visible alphabetical lists sort in PHP (`sortBy(fn => Str::lower(Str::ascii($name)))`) or on a normalised column; SQL text order is only a stable order, never an alphabetical one.

### 1.9 Aggregates and conditional counts

- `count(*) filter (where …)`: `ActionItemQuery.php:56`, `:57`, `:58`, `:59`. PG and SL ≥ 3.30. Fails on MY, MA, MS. Replacement: `sum(case when … then 1 else 0 end)` (the existing `(int)` casts absorb the NULL of an empty set).
- `case when is_win then 1 else 0 end`: `app/Actions/Games/RoomLeaderboard.php:35`, `TeamGameLeaderboard.php:48`. Fails on MS (a `bit` is not a condition). Replacement: `case when is_win = ? then …` with a bound `true`.
- `whereRaw('false')`: `app/Actions/Integrations/TrackedIssues.php:34`, `:53`. Fails on MS. Replacement: `whereRaw('1 = 0')`.
- Result types differ: `sum`/`avg` return a numeric string on PG and MY/MA, an int or float on SL; `avg` of an integer column is truncated to an integer on MS (`SummarizeHealthCheck.php:115`, `BuildSummaryInput.php:262`); booleans read through `toBase()` are `true/false` on PG and `1/0` elsewhere. Rule: cast every aggregate in PHP (already done at the sites read).

### 1.10 Date functions

`date_trunc('week', created_at)`: `app/Actions/Games/GameStreaks.php:30`, `:31`. PG only. Replacement: select `user_id, created_at` (bounded by a `where created_at >= …` window) and bucket by Monday in PHP; the method already converts to Carbon.

No `interval`, `extract`, `now()` in SQL, `string_agg`, `||`, regex operator, `DISTINCT ON`, `RETURNING`, or hand-written `ON CONFLICT` anywhere in `app/`, `routes/`, `config/`.

### 1.11 `date` columns on SQLite

`action_items.due_on` and `action_item_reminders.due_on` are cast `'date'` (`app/Models/ActionItem.php:184`, `ActionItemReminder.php:33`). Eloquent writes a `date` cast with the model date format, so SL stores `2026-10-10 00:00:00` while PG, MY, MA, MS truncate to `2026-10-10`. Consequences on SL:

- `SendActionItemReminders.php:78` `whereBetween('due_on', [a, b])`: the upper bound `2026-10-11` is smaller than the stored `2026-10-11 00:00:00`, items due tomorrow are skipped.
- `SendActionItemReminders.php:104-109` inserts `Y-m-d` through `DB::table`, while a row written through the model holds the long form: the unique key `(action_item_id, user_id, kind, due_on)` no longer matches between the two writers.
- `<` comparisons (`ActionItemQuery.php:57`, `:125`, `:154`, `HandleInertiaRequests.php:245`) happen to be right.

Replacement: a small cast that stores `Y-m-d` (section 7.2, `DateOnly`), or `whereDate()` at every comparison. The cast is one place.

### 1.12 JSON

- Column types: `json` everywhere except five `jsonb` columns in `game_rounds`. PG `json` has no equality operator (no `distinct`/`group by` on it, none found). MA stores JSON as `longtext`; MY reorders object keys; SL stores text. No code depends on key order.
- JSON path conditions, all through the query builder and portable on the five drivers: `app/Console/Commands/PollIntegrationsCommand.php:43` (`settings->statusSync`, boolean), `app/Actions/Integrations/HandleTelegramUpdate.php:149`, `DisconnectIntegration.php:50` (`settings->chatId`), `app/Support/Integrations/Inbound/ReadInboundEvent.php:93` (`settings->organizationId`), `:120` (`settings->installationId`), `app/Actions/ActionItems/MarkActionItemRemindersRead.php:16` (`data->actionItemId`), `app/Actions/Whiteboards/PruneWhiteboardFiles.php:52` (`data->fileId`).
- Trap on SL: `json_extract` returns a typed value, and an integer never equals a text binding. PG (`->>`) and MY compare as text. The bindings are strings, so the stored JSON value must be a string. `installationId` is (validated by regex as a string, `ConnectGitHub.php:33`). `chatId` is written at `HandleTelegramUpdate.php:107` from a variable whose type was not traced: to verify (Telegram chat ids are integers).
- `whereJsonContains`, `whereJsonLength`: not used. Keep it that way (`whereJsonContains` is unsupported on MS < 2016 semantics and slow on SL).

### 1.13 Upserts and "insert or ignore"

- `insertOrIgnore`: `app/Actions/Games/DrawGameWord.php:31`, `app/Actions/ActionItems/SendActionItemReminders.php:104`. PG `on conflict do nothing`, SL `insert or ignore`, MY/MA `insert ignore` (which also downgrades truncation and foreign-key errors to warnings), **MS throws `RuntimeException`** (base grammar). Replacement: `createOrFirst`-style insert wrapped in a savepoint and catching `UniqueConstraintViolationException`.
- `createOrFirst` / `firstOrCreate` / `updateOrCreate` (22 sites): portable; the framework wraps the insert in a savepoint and maps each driver's duplicate-key error.
- No `upsert()` call.

### 1.14 Boolean literals

Only through bindings and the builder, portable. The raw ones are listed in 1.9.

### 1.15 Column types

- UUID: 57 models use `HasUuids` (ordered UUIDv7). Column type is `uuid` on PG and MA ≥ 10.7, `char(36)` on MY, `varchar` on SL, `uniqueidentifier` on MS. MS returns UUIDs in upper case and sorts them by its own byte order: every PHP comparison with a lower-case id and the 27 `orderBy('id')` tie-breakers change. PG rejects a malformed UUID with a query error where the others return no row; validation rules that reach `exists` without a `uuid` rule (`GameHostsController.php:31`, `GameRoundsController.php:33`, both `'string'`) fail with a 500 on PG only.
- `text` is 65 535 bytes on MY/MA. `integration_delivery_payloads.message`, `request_headers`, `request_body`, `response_excerpt` (`2026_10_08_100000:14-18`) hold encrypted content up to `StoreWebhookPayload::MaxBytes = 524288` (`app/Actions/Integrations/StoreWebhookPayload.php:14`): "Data too long" on MY/MA. Replacement: `longText` (identical to `text` on PG and SL). Other `text` columns are bounded by validation under 64 KB (`poker_tasks.description` max 10 000 characters, comments 500, summary 2 000).
- `string(n)` is not enforced on SL; validation already bounds every field read.
- Index key length: the longest composite keys (`failed_jobs` connection+queue, `social_accounts` provider+provider_user_id, `notifications` morph index) stay under 3072 bytes (InnoDB) and 1700 bytes (MS). No index on a `text` column. No finding.
- No `enum`, no `timestampTz`, no ULID, no generated column.

### 1.16 Timestamps

- All `timestamp` columns are without time zone at second precision; `config/app.php:68` is UTC. The code already truncates to the second where it compares (`startOfSecond()` at 8 app sites).
- MY/MA `TIMESTAMP` is converted through the session time zone and ends in 2038. Set `'timezone' => '+00:00'` on both connections.
- **MA < 10.10 and MY with `explicit_defaults_for_timestamp = OFF`**: a `TIMESTAMP NOT NULL` column without default is altered silently. When it is the first `TIMESTAMP` column of its table it gets `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` and is rewritten on every update of the row: `workspace_invitations.expires_at` (`2026_09_29_110028:18`, reset when the invitation is accepted), `action_item_reminders.sent_at` (`2026_10_02_100500:17`), `integration_user_mappings.checked_at` (`2026_10_05_100000:36`), `game_points.created_at` (`2026_10_06_100000:118`), `game_used_words.created_at` (`:129`), `integration_inbound_events.received_at` (`2026_10_07_100000:61`), **[18f]** `magic_links.expires_at` (`:15`), `email_two_factor_codes.sent_at` (`:17`). When another `TIMESTAMP` column precedes it, it gets the default `0000-00-00 00:00:00`, which strict mode refuses at `create table`: `game_rounds.started_at` (`2026_10_06_100000:65`, after `revealed_at`), **[18f]** `email_two_factor_codes.expires_at` (`:18`). Seven columns in the main tree, three in [18f].
- Replacement: write `dateTime()` instead of `timestamp()` in migrations. On PG both compile to `timestamp(0) without time zone` (`PostgresGrammar::typeDateTime` calls `typeTimestamp`), on SL both are `datetime`: no schema change on the existing PostgreSQL installs, and MY/MA get `DATETIME` (no auto-update, no 2038 limit, no session time zone).

### 1.17 SQL Server only

- A unique index treats NULL as a value: `participants (retro_id, user_id)`, `poker_players`, `game_players` (two indexes), `whiteboard_members`, `team_health_statements (team_id, builtin)`, `poker_tasks (poker_game_id, external_source, external_id)`, `action_items.previous_occurrence_id`, `game_rooms.retro_id`, `game_points (game_round_id, player_id)` each allow one NULL row only: a second guest cannot join a retro.
- "Multiple cascade paths" and self-referencing cascades are refused at `create table`: `cards` (retro and column), `votes`, `card_comments.parent_comment_id`, most child tables.
- Both need filtered indexes and `NO ACTION` plus application deletes: a schema fork, not a fix.

## 2. Every raw SQL call

Verdict: **P** portable; **S** syntax portable, behaviour differs (see reference); **N** not portable.

### 2.1 `app/`

| # | Site | SQL | Verdict |
|---|---|---|---|
| 1 | `Mcp/Presenters/McpMessage.php:48` | `card_id, count(*) as total` | P |
| 2 | `Http/Requests/WorkspaceTemplateRequest.php:106` | `lower(name) = ?` | S (1.4) |
| 3 | `Http/Controllers/WorkspaceTemplatesController.php:131` | `saved_deck_id, count(*) as aggregate` | P |
| 4 | `Http/Controllers/WorkspaceInvitationsController.php:32` | `lower(users.email) = ?` | S (1.4, 1.5) |
| 5 | `Http/Controllers/WorkspaceInvitationsController.php:44` | `lower(email) = ?` | S |
| 6 | `Http/Controllers/PokerDecksController.php:57` | `deck, count(*) as games_count` | P |
| 7 | `Actions/ActionItems/SendActionItemReminders.php:80` | `DB::raw(1)` | P |
| 8–11 | `Actions/ActionItems/ActionItemQuery.php:56`, `:57`, `:58`, `:59` | `count(*) filter (where …)` | N: MY, MA, MS (1.9) |
| 12 | `ActionItemQuery.php:60` | `count(distinct retro_id)` | P |
| 13 | `ActionItemQuery.php:124` | `(completed_at is not null)` as sort key | N: MS (1.8) |
| 14 | `ActionItemQuery.php:125` | `case when … then 0 else 1 end` | P |
| 15 | `ActionItemQuery.php:126` | `… asc nulls last` | N: MY, MA, MS (1.8) |
| 16 | `ActionItemQuery.php:127-130` | nested `case` on priority | P |
| 17 | `Actions/Poker/SavedPokerDeckRules.php:32` | `lower(name) = ?` | S |
| 18 | `Actions/HealthCheck/BuildHealthTrend.php:112` | `sum(score)`, `count(*)` | P (types, 1.9) |
| 19 | `Actions/Auth/ResolveSsoUser.php:46` | `lower(email) = ?` | S |
| 20 | `Actions/Workspaces/CreateWorkspaceInvitation.php:22` | `lower(email) = ?` | S |
| 21 | `Actions/HealthCheck/SummarizeHealthCheck.php:38` | `count`, `sum(score)`, `sum(score * score)` | P (types) |
| 22 | `SummarizeHealthCheck.php:115` | `avg(score) as mean` | S: integer average on MS |
| 23 | `Actions/Retros/SummarizeRoti.php:19` | `score, count(*)` | P |
| 24–25 | `Actions/Integrations/TrackedIssues.php:34`, `:53` | `whereRaw('false')` | N: MS (1.9) |
| 26–27 | `Actions/Retros/BuildBoardSnapshot.php:250`, `:255` | `card_id, count(*)` | P |
| 28 | `Actions/Whiteboards/WhiteboardTemplateRules.php:29` | `lower(name) = lower(?)` | S |
| 29 | `Actions/Retros/BuildSummaryInput.php:153` | `card_id, count(*)` | P |
| 30 | `BuildSummaryInput.php:228` | `orderByRaw('lower(content)')` | S (1.8) |
| 31 | `BuildSummaryInput.php:262` | `count(*)`, `avg(score)` | S: integer average on MS |
| 32 | `Actions/Retros/TopTeamTemplates.php:37` | `count(*)`, `max(created_at)` | P |
| 33 | `Actions/Games/RoomLeaderboard.php:35` | `sum(case when is_win then 1 else 0 end)` | N: MS |
| 34 | `Actions/Teams/BuildTeamMoodTrend.php:46` | `count(distinct participant_id)` | P |
| 35 | `Actions/Surveys/CloseOpenSurveys.php:14` | `DB::raw('version + 1')` | P |
| 36 | `Actions/Games/TeamGameLeaderboard.php:48` | sums with `case when game_points.is_win` | N: MS |
| 37 | `TeamGameLeaderboard.php:51` | `orderByRaw('lower(users.name)')` | S |
| 38–39 | `Actions/Games/GameStreaks.php:30`, `:31` | `date_trunc('week', created_at)` | N: MY, MA, SL, MS (1.10) |
| — | **[18f]** `Models/User.php:114` | `lower(<email>) = ?` | S |

Not raw but driver-bound: `'ilike'` operator at the 4 + 7 sites of 1.1 (N: MY, MA, SL, MS).

No `havingRaw`, `DB::select`, `DB::statement`, `DB::unprepared`, `fromRaw`, `joinRaw` in `app/`, `routes/`, `config/`, `bin/`.

### 2.2 `database/migrations/`

| Site | SQL | Verdict |
|---|---|---|
| `2026_10_01_100300_create_workspace_templates_table.php:21` | `create unique index … (workspace_id, lower(name))`, **not guarded** | N: MY (needs `((lower(name)))`), MA, MS. Runs on PG, SL |
| `2026_10_01_110000_create_team_health_statements_table.php:29-34` | `alter table … add constraint … check (…)`, pgsql only | N as written: SL cannot add a constraint to an existing table |
| `2026_10_02_100000_add_v2_columns_to_action_items_table.php:49`, `:57`, `:63` | correlated sub-select in `update … set` | P |
| `…:53` | `DB::raw('action_items.updated_at')` | P |
| `…:74`, `:75`, `:76` | three `add constraint … check`, pgsql only | N as written: SL |
| `2026_10_03_100100_create_poker_decks_table.php:27` | `create unique index … (team_id, lower(name))`, pgsql only | N: MY syntax, MA, MS |
| `2026_10_06_100000_create_game_tables.php:54`, `:55`, `:56`, `:58`, `:60` | `Expression("'[]'::jsonb")` | N: MY, MA, SL, MS |
| `2026_10_10_100000_create_whiteboard_templates_table.php:29` | `create unique index … (workspace_id, lower(name))`, pgsql only | N: MY syntax, MA, MS |
| `2026_10_15_100000_add_workspace_to_poker_decks_table.php:21` | `check ((team_id is null) <> (workspace_id is null))`, pgsql only | N: SL (alter), MS (boolean comparison) |
| `…:22` | partial unique index `… where workspace_id is not null`, pgsql only | N: MY, MA (no partial index) |

### 2.3 `tests/`

`tests/Feature/Integrations/WebhookSharesTest.php:465`, `WebhookEventsTest.php:464` (`select 1 / 0`), `tests/Feature/ErrorPagesTest.php:259` (`select 1`). See section 6.

## 3. Migrations

### 3.1 `if (DB::getDriverName() !== 'pgsql') return;`

| Migration | Skipped off PostgreSQL | Invariant then unenforced |
|---|---|---|
| `2026_10_01_110000:25` | check `team_health_statements_builtin_or_custom` | a statement is either built-in (no text, no label) or custom (text and label) |
| `2026_10_02_100000:70` | checks `action_items_single_assignee`, `…_guest_assignee_needs_retro`, `…_recurrence_needs_due_date` | one assignee kind at most; a guest assignee needs a retro; a recurrence needs a due date |
| `2026_10_03_100100:23` | unique `(team_id, lower(name))` | deck names unique per team, case-insensitive |
| `2026_10_10_100000:25` | unique `(workspace_id, lower(name))` | whiteboard template names unique per workspace |
| `2026_10_15_100000:17` | check `poker_decks_single_owner`, partial unique `(workspace_id, lower(name))` | a deck belongs to a team or a workspace, never both or neither; deck names unique per workspace |

Off PostgreSQL the name rules rest on the validation query alone, which races unless the caller holds the owner's row lock (it does: `PokerDecksController.php:118`, `WorkspacePokerDecksController.php:18`, `WorkspaceTemplatesController.php:45`, `SaveWhiteboardTemplate.php:27`) and unless the read after the lock is fresh (it is not on MY/MA at the default isolation level, see 4.2).

Replacement:

- Name uniqueness: a `name_key` column filled in PHP and a plain `unique([owner, 'name_key'])`. NULL owners never collide on PG, MY, MA, SL, so the partial predicate is unnecessary. Identical on four drivers.
- Check constraints: PG, MY ≥ 8.0.16, MA ≥ 10.2 accept `alter table … add constraint … check`. SL only at `create table`. Either a helper that emits the DDL per driver and is skipped on SL, with the rule also enforced in the model (`saving` guard) so SL is covered, or the model guard alone. The model guard must exist in both cases, since the tests of section 6 expect a refusal.

### 3.2 `change()`, drops, renames

| Site | Operation | Notes |
|---|---|---|
| `2026_09_30_090300:12` | `cards.content` nullable | SL rebuilds the table (create temp, copy, drop, rename). Supported by the framework. |
| `2026_10_01_100100:12` | `retros.votes_per_participant` nullable | same |
| `2026_10_01_100200:12` | `columns.title` to 100 | same |
| `2026_10_02_100000:26` | `dropForeign(['created_by_participant_id'])` | SL: handled by rebuild (by column list only, not by name: fine here) |
| `2026_10_02_100000:30-34` | three `change()`, one `foreign()`, `dropColumn('is_done')`, three indexes in one closure | SL: two rebuilds plus a native `drop column` (≥ 3.35). MY/MA: DDL is not transactional; a failure midway leaves the table half-migrated (PG rolls back) |
| `2026_10_06_100200:12` | `dropColumn('updated_at')` | fine |
| `2026_10_07_100200:15`, `:19` | widen `external_key` | `poker_tasks.external_key` is part of no index; fine |
| `2026_10_15_100000:14` | `poker_decks.team_id` nullable | SL rebuild. The rebuild re-creates indexes from introspection: an expression index or a raw `check` created earlier on that table would not survive. With `name_key` (plain index) nothing is lost. Rule: on SL, raw DDL on a table must come after its last `change()`. |

No column rename, no table rename. Foreign keys added to existing tables (`2026_09_29_133053`, cards, comments, poker, games, whiteboards): SL handles them by rebuild; enforcement on SL depends on `foreign_key_constraints` (`config/database.php:40`, on by default).

`down()` exists only in the three framework migrations and the Fortify one; nothing to port.

### 3.3 Defaults using functions

`useCurrent()` on `failed_jobs.failed_at` and **[18f]** `magic_links.created_at`: portable. The `'[]'::jsonb` defaults: 1.7.

### 3.4 Column types that differ

See 1.15 and 1.16: `uuid`, `json`/`jsonb`, `text` size, `timestamp`.

### 3.5 [18f] migrations

`2026_10_14_100000_create_magic_links_table.php`, `2026_10_15_100001_create_email_two_factor_codes_table.php`: portable except the non-null `timestamp` columns (1.16). `2026_10_17_100000_lower_case_user_email_addresses.php`: done in PHP row by row, portable; on MY/MA its `where('email', $stored)` is case-insensitive, harmless since it also filters by id.

## 4. Transactions and locks

### 4.1 Row locks by purpose

148 locking reads (147 `lockForUpdate`, 1 `sharedLock`) in 110 files.

| Purpose | Count | Representative sites | Invariant |
|---|---|---|---|
| Aggregate root serialises every write of a session | Retro 50, PokerGame 26, GameRoom 12, Whiteboard 11 | `CardVotesController.php:28`, `PlayPokerCard.php:29`, `StartGameRound.php:31`, `WriteWhiteboardElements.php:37` | vote limit, phase and lock checks, positions, `votes_version`/`seq` counters, one current round, facilitator hand-over |
| Owner row serialises a cap or a name check | Team 5, Workspace 5, User 1 | `CreatePokerGame.php:19`, `PokerDecksController.php:118`, `WorkspaceTemplatesController.php:45`, `WorkspaceMembersController.php:110` (last owner), `IssueMcpToken.php:26` (25 tokens, unique name) | counts and uniqueness with no database constraint behind them |
| Read-modify-write of one row | TeamIntegration 10, ActionItem 3, ActionItemExternalLink 2, IntegrationDelivery 1, PokerTask 1 | `TeamIntegration.php:125` (`mergeSettings`), `IntegrationTokens.php:86`, `WebhookHealth.php:41`, `RequestWebhookRedelivery.php:34` | no lost update on JSON settings, tokens, counters |
| Child row locked after its root | PokerRound 6, GameRound 4, PokerPlayer 1, Participant 1, survey 1, vote 1 | `PokerRevealsController.php:32`, `LockGameRound.php:19`, `CardVotesController.php:39`, `:79` | consistent lock order root then child |
| Set of rows locked by a non-key condition | 7 | `RevokeInstanceAdmin.php:21`, `ProfileController.php:96` (all instance admins), `SaveTeamIntegration.php:47` (row that may not exist), `SetPokerSpectator.php:50`, `ApplyPokerTaskIssues.php:39`, `ApplyIssueChanges.php:192` | at least one instance admin remains; one integration per team and provider |
| Shared lock for a consistent read | 1 | `BuildBoardSnapshot.php:248` | `votes_version` and the vote counts belong together |

### 4.2 MySQL and MariaDB

- Default isolation is REPEATABLE READ. A locking read always returns the latest committed row, but every plain `select` of the transaction reads the snapshot taken at its **first** plain `select`. The dominant pattern (lock the root as the first statement, then read) is safe: the snapshot is taken after the lock is held.
- It is not safe when a plain read precedes a later lock. Confirmed case: `app/Actions/Whiteboards/SaveWhiteboardTemplate.php:25-29`: locks the whiteboard, reads `$locked->team` (snapshot taken here), waits for the workspace lock, then `ensureRoom` and `ensureNameIsFree` count from the stale snapshot. Two saves from two boards of one workspace both pass the cap of 50 and the name check, and off PostgreSQL no index stops the duplicate. The same shape is possible wherever a transaction takes a second lock on another aggregate or is entered from an outer transaction that already read: `ManageTeamHealthStatements.php:130`/`:151`, `Mcp/Tools/Retro/UpdateAction.php:84`, `AbandonIcebreakerRound.php:21`, `ScheduleIcebreakerExpiry.php:25`, `ClearRetroInsights.php:46`, `ApplyIssueChanges.php:109-192`, and every action called inside a controller transaction. The 138 transaction files were not all traced.
- Gap locks: under REPEATABLE READ a `for update` on a missing row or on a non-unique condition locks gaps. `SaveTeamIntegration.php:47` (two first connections deadlock instead of one unique violation), `RevokeInstanceAdmin.php:21` and `ProfileController.php:96` (no index on `is_instance_admin`: every row of `users` is locked).
- A deadlock (error 1213) rolls back the **whole** transaction on the server while Laravel still counts the nesting level; `StoreWebhookPayload.php:58` rethrows `DeadlockException` for that reason, which stays correct.
- Fix for all three: `'isolation_level' => 'READ COMMITTED'` on the `mysql` and `mariadb` connections (`MySqlConnector.php:96` applies it per session). It gives PostgreSQL's semantics: fresh statement snapshots and no gap locks on searches. It needs row-based or mixed binary logging, the default on both servers.

### 4.3 SQLite

- `SQLiteGrammar::compileLock` returns an empty string: `lockForUpdate` and `sharedLock` do nothing. The database has one writer at a time.
- `config/database.php:41-44`: `busy_timeout` null, `journal_mode` null, `transaction_mode` `DEFERRED`. A deferred transaction starts as a reader; when it writes after another connection committed, SQLite returns `SQLITE_BUSY` at once, whatever the busy timeout. Every read-check-write transaction of 4.1 can fail that way under concurrency, and none is retried.
- With `transaction_mode => 'IMMEDIATE'`, `journal_mode => 'wal'`, `busy_timeout => 5000`, each `DB::transaction` takes the write lock at `BEGIN`: transactions are serialised and every invariant of 4.1 holds without row locks. Cost: one writer for the whole instance, and read-only transactions (`BuildBoardSnapshot.php:247`) also queue. Acceptable for the small self-hosted instance SQLite is meant for; document it.
- Checks made outside a transaction then written (none seen among the files read, not exhaustively verified) would race on SQLite exactly as elsewhere.

### 4.4 SQL Server

`lockForUpdate` compiles to `with(rowlock,updlock,holdlock)`, default isolation READ COMMITTED with blocking readers. The lock pattern works as on PG.

### 4.5 Savepoints and failed statements

PostgreSQL aborts the whole transaction on any failed statement; MY, MA, SL, MS fail the statement only.

- `InstanceSettings::rows()`: in the main tree (`app/Support/InstanceSettings.php:390-396`) the read is caught without a savepoint. **[18f]** `:406-416` runs it under a savepoint when a transaction is open. On MY, MA, SL, MS the savepoint is unnecessary but harmless: `savepoint` / `rollback to savepoint` are supported by all four grammars, the caller's transaction survives, the method returns null. Correct on every driver.
- `StoreWebhookPayload::keepIfPossible` (`:53-64`): nested `DB::transaction` as savepoint, catches everything but a deadlock. Correct on every driver.
- `createOrFirst`, `firstOrCreate` (22 sites): the framework adds the savepoint. Correct on every driver.
- The reverse risk is new code written and tested on SQLite or MariaDB that catches a `QueryException` inside a transaction and carries on: it passes there and aborts on PostgreSQL. Rule in section 9.

### 4.6 After-commit hooks

37 sites: 12 event classes implementing `ShouldDispatchAfterCommit`, `DB::afterCommit` in `app/Events/Concerns/SendsToOthers.php:11` and `app/Support/InstanceSettings.php:345`, `->afterCommit()` on 9 job dispatches. Framework-level, identical on all drivers. One caveat on MY/MA: a DDL statement inside a transaction commits it implicitly; no DDL exists in `app/`.

### 4.7 Deadlock and busy retry

None of the 171 `DB::transaction` calls passes an attempt count. A deadlock or a `database is locked` error surfaces as a 500. With 4.2 and 4.3 applied the remaining risk is the same as on PostgreSQL today. Retrying is safe only for closures without external effects; broadcasts are deferred to commit, HTTP calls inside transactions (integration token refresh, `IntegrationTokens.php:85`) are not.

## 5. Outside SQL

| Item | Finding |
|---|---|
| Queue `database` (`config/queue.php:16`, `.env.example:41`) | Works on all drivers. On SL the worker's pop is a read then an update inside a deferred transaction: needs `IMMEDIATE` (4.3); one worker. |
| Session `database` (`.env.example:33`) | Works on all. One write per request, so on SL it competes with every other writer. |
| Cache `database` (`.env.example:43`) | Works on all. Cache writes on the default connection join the caller's open transaction and are rolled back with it, on every driver. |
| Cache locks (`config/cache.php:46`, `config/database.php:102-117`) | `lock_connection` is the dedicated `pgsql_locks` connection only when `DB_CONNECTION=pgsql`. On MY/MA the lock row is inserted inside the caller's transaction: a competing request blocks on the uncommitted row for up to `innodb_lock_wait_timeout` instead of failing fast, and the lock exists for others only after commit. Used by `IntegrationTokens.php:51`, `GitHubClient.php:376`, `GameRateLimit.php:20`, the unique jobs, `WithoutOverlapping`, and the scheduler's `onOneServer`/`withoutOverlapping` (`routes/console.php`). Needs a `<driver>_locks` twin for `mysql`, `mariadb`, `sqlsrv`. On SL the lock must stay on the same connection: a second connection can never write while the first holds the write lock. |
| `phpunit.xml` | Sets `DB_DATABASE=testing` and no `DB_CONNECTION`: the suite uses whatever `.env` names, PostgreSQL today. |
| `.env.example:26-31`, `compose.yaml:27-38`, `compose.production.yaml:12-46`, `Dockerfile:15`, `:39` | PostgreSQL only: Sail service, production service, `pg_isready` health check, only `pdo_pgsql` installed in the image. |
| `bin/test-browser:41-58` | Creates one database per shard with `docker exec … psql` / `createdb` and reads `pg_database`. PostgreSQL and Docker only. |
| `tests/BrowserTestCase.php:90`, `tests/Browser/Support/BrowserShard.php` | `ParallelTesting::resolveTokenUsing` only names the shard; the database name comes from `DB_DATABASE` set by the script. Driver-neutral. `artisan test --parallel` creates `<database>_test_<n>` through the schema builder on PG, MY, MA, SL (file or memory). |
| `.github/workflows/tests.yml` | The `browser` job runs on a `postgres:18-alpine` service. The `ci` job has **no** database service while `composer setup` copies `.env.example` (pgsql, host `pgsql`) and runs `migrate`: whether that job passes today could not be determined by reading. |
| `pg_` calls, full-text, trigram, advisory locks, sequences, `LISTEN/NOTIFY` | None in `app/`, `config/`, `routes/`. Search is `ILIKE '%term%'` only (1.1). |
| Time zones | Section 1.16. |

## 6. Tests

3 212 tests in `tests/Feature`, `tests/Unit`, `tests/Arch` (313 feature files), 554 in `tests/Browser` (52 files), all under `RefreshDatabase` (`tests/Pest.php:75-81`).

| Site | Assumption | Off PostgreSQL |
|---|---|---|
| `tests/Feature/Games/IcebreakerRoomTest.php:200-201` | lock order read from SQL text `from "(\w+)".* for update` | no `for update` on SL and MS; back-tick or bracket quoting on MY, MA, MS |
| `tests/Feature/Integrations/ActionItemExportTest.php:265-266` | same regex | same |
| `tests/Feature/Admin/InstanceAdminsTest.php:165`, `:172` | `for update` and `"is_instance_admin" = ` in the SQL | same |
| `tests/Feature/Games/GameAccessTest.php:186` | `"game_players"` in the SQL to inject a race | quoting on MY, MA, MS |
| `tests/Feature/Integrations/WebhookRedeliveryTest.php:530` | `"integration_delivery_payloads"` in the SQL | same |
| `tests/Feature/Integrations/WebhookSharesTest.php:465`, `WebhookEventsTest.php:464` | `select 1 / 0` raises a query error | returns NULL without error on MY, MA, SL: the tested failure never happens |
| `tests/Feature/ErrorPagesTest.php:32-47`, `:259` | an unreachable database is the default connection with port 1 | SL ignores host and port: the database stays reachable |
| `tests/Feature/InstanceSettingsTest.php:173-174`, `tests/Feature/Branding/BrandInPageTest.php:183` | `Schema::drop` inside the test transaction is rolled back | MY/MA commit implicitly on DDL: the table stays dropped for the rest of the run |
| `tests/Feature/ActionItems/ActionItemModelTest.php:17` | `Schema::table` adds a column inside the test transaction | same implicit commit on MY/MA |
| `tests/Feature/ActionItems/ActionItemModelTest.php:108-126` (3 tests) | check constraints refuse the row | no constraint off PG, not skipped: the tests fail |
| `tests/Feature/Whiteboards/WhiteboardTemplatesTest.php:153-158` | the unique index on `lower(name)` refuses the row | index is pgsql-only, not skipped |
| `tests/Feature/Whiteboards/WhiteboardTemplatesTest.php:144-150` | "a name the database folds" (`İstanbul`) | folding differs per driver (1.4) |
| `tests/Feature/Retros/HealthStatementModelsTest.php:62`, `tests/Feature/Poker/WorkspacePokerDecksTest.php:261` | skipped unless pgsql | the invariant goes untested elsewhere |
| `tests/Feature/Mcp/SearchBoardsTest.php`, **[18f]** `tests/Feature/SearchTest.php` | case-insensitive search and literal `%`/`_` | 1.1, 1.2 |
| **[18f]** `tests/Feature/Auth/EmailAddressNormalisationTest.php` | case handling of addresses | 1.5 |

Portable as they are: the 23 files that count queries with `DB::enableQueryLog()`, the `UniqueConstraintViolationException` tests (`IntegrationModelsTest.php:44`, `:120`, `:136`, `IntegrationSyncSchemaTest.php:136`), `Schema::hasIndex`/`getIndexes` tests, and the tests that wrap an expected `QueryException` in `DB::transaction` (a savepoint, needed on PG, harmless elsewhere).

Factories: no driver-specific value. `database/factories/GameRoundFactory.php:23`, `:44` truncate to the second, which every driver needs.

## 7. Remediation plan

### 7.1 Decisions to take first

1. **SQL Server**: best effort, not a supported target of this spec. It needs a forked schema (1.17), upper-case UUID handling, and has no `insertOrIgnore`. Recommendation: make the query layer SQL-Server-clean (it costs nothing once the helpers exist), document the schema blockers, do not gate releases on it.
2. **Collation on MySQL/MariaDB**: binary (`utf8mb4_bin`), so equality and uniqueness mean the same on four drivers. The alternative (keep `_ci`) leaves the emoji bug and accent-insensitive uniqueness.
3. **Isolation on MySQL/MariaDB**: READ COMMITTED, so the 138 transaction files need no individual review.
4. **Existing PostgreSQL installs**: historic migrations may be edited only when the PostgreSQL result is unchanged (`dateTime` for `timestamp`, `longText` for `text`, dropping a guard). Anything that changes the PostgreSQL schema is a new migration (`name_key`).
5. **Minimum versions**: PostgreSQL 14, MySQL 8.0.16, MariaDB 10.6 (10.7 for native `uuid`), SQLite 3.35.

### 7.2 Helpers to introduce (one of each)

| Helper | Role |
|---|---|
| `App\Support\Database\TextSearch::contains(Builder, string|array $columns, string $term)` | `lower(col) like ? escape '!'`, term lowered and escaped in PHP. Replaces `LikePattern::contains`, the `ilike` sites, `AdminCandidatesController::escapeLike`. |
| `App\Support\Database\NameKey::of(string)` plus a `name_key` column on `workspace_templates`, `poker_decks`, `whiteboard_templates` | trim, Unicode case fold in PHP; plain unique index; the three name rules compare `name_key`. |
| `App\Rules\UniqueEmailAddress` and `User::whereAddress` (from [18f]) | the single case-insensitive e-mail comparison, on the stored normalised value. |
| `App\Casts\DateOnly` | stores and reads `Y-m-d` on every driver. |
| `App\Support\Database\Sql` (small static grammar helpers) | `countWhen($condition)`, `nullsLast($expression)`, `never()`: the three conditional constructs of 1.8 and 1.9, so no caller writes dialect SQL. |
| `App\Support\Database\CheckConstraint::add(table, name, expression)` | emits the DDL on PG, MY, MA; no-op on SL; used by migrations. |
| `tests/Support/SqlProbe` | `lockedTables()`, `touches(table)`: strips identifier quoting and recognises each driver's lock syntax; on SL it asserts the transaction level instead. Replaces the five SQL-text assertions. |

### 7.3 Work packages, in order

**WP0 — Guard rail (half a day).** The rule of section 9 in `AGENTS.md`/`CLAUDE.md`, and an Arch test in `tests/Arch/ArchTest.php` that fails on `'ilike'`, `::` inside a raw string, `filter (where`, `nulls last`, `date_trunc`, `DB::getDriverName()` outside `App\Support\Database`, and on `whereRaw`/`selectRaw`/`orderByRaw` outside an allow-list of the existing portable sites. Proof: the Arch suite, driver-independent.

**WP1 — Test harness on several drivers.** `phpunit.xml` gains `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:` (no `force`, so CI environment variables win). `config/database.php`: SQLite `busy_timeout`, `journal_mode`, `transaction_mode`; MySQL/MariaDB `isolation_level`, `timezone`, collation; lock connections per driver; `config/cache.php:46` picks `<driver>_locks` except on SQLite. `compose.yaml` gains `mariadb` and `mysql` services under profiles. `bin/test-browser` creates shard databases through a PHP entry point (`Schema::createDatabase`, or one file per shard on SQLite) instead of `docker exec psql`. `Dockerfile` installs `pdo_mysql` and `pdo_sqlite`. Proof: `migrate:fresh` reaches the first failing migration on each driver, which WP2 then fixes.

**WP2 — Migrations.** Edit in place (PostgreSQL result unchanged): drop the five `::jsonb` defaults; `timestamp` to `dateTime` on the non-null columns of 1.16; `text` to `longText` on the four payload columns; guard-free check constraints through `CheckConstraint::add`. New migration: `name_key` on three tables, backfilled in PHP, plain unique indexes, and on PostgreSQL the drop of the four `lower(name)` indexes; the unconditional index of `2026_10_01_100300:21` becomes pgsql-only in the historic file so the other drivers pass it, then the new migration supersedes it. Proof: a schema test per driver asserting `Schema::hasIndex` for the unique keys, plus the existing constraint tests un-skipped.

**WP3 — Raw SQL.** The 23 N/S sites of section 2 through the helpers: `ActionItemQuery` (7 expressions), `GameStreaks`, `TrackedIssues`, `RoomLeaderboard`, `TeamGameLeaderboard`, `SearchBoards`, [18f] `SearchWorkspaceContent`, `AdminCandidatesController`, the seven `lower()` lookups, `DrawGameWord` and `SendActionItemReminders` (`insertOrIgnore`). Proof: existing feature tests of each feature, run on every driver; new tests for a term containing `%`, `_`, `!` and a non-ASCII upper-case letter.

**WP4 — Invariants in the model.** `saving` guards for the four check-constraint rules (action items ×3, health statements, deck owner) so SQLite refuses the same rows; `DateOnly` cast on the two `due_on` columns. Proof: `ActionItemModelTest:108-126`, `HealthStatementModelsTest:62`, `WorkspacePokerDecksTest:261` un-skipped and green on every driver; a reminder test with an item due tomorrow.

**WP5 — Collation and e-mail.** Binary collation on MySQL/MariaDB; e-mail lookups on the normalised stored value; invitation e-mail normalised on write. Depends on [18f] being merged. Proof: a reaction test with two different emoji from one participant; `EmailAddressNormalisationTest` on every driver; a token-name test with two names differing by case.

**WP6 — Concurrency.** A small suite outside `RefreshDatabase` that opens two real connections (two processes) and replays: two votes at the limit, two template saves at the cap from two boards, two last-admin revocations, two first connections of an integration. Runs on PG, MySQL, MariaDB, and file SQLite; not on in-memory SQLite. It proves 4.2 and 4.3 rather than assuming them.

**WP7 — Tests that assert PostgreSQL.** The 17 sites of section 6: `SqlProbe` for SQL text, a thrown `QueryException` instead of `select 1 / 0`, a non-existent file path for the unreachable SQLite database, `DatabaseMigrations` or a throw-away connection for the three tests that run DDL.

**WP8 — CI and documentation.** Matrix below; README section on supported databases, required settings, and the differences that remain (7.4).

### 7.4 What cannot be made identical, and the rule instead

| Difference | Rule |
|---|---|
| Alphabetical order of text | SQL order is stable, not alphabetical. Lists shown to people are sorted in PHP. |
| Accent-insensitive search | Search is case-insensitive and accent-sensitive on every driver (binary collation plus `lower`). On SQLite the case folding of non-ASCII letters is ASCII-only unless the term and the column are compared through a `*_key` column. |
| Concurrency model | PG, MySQL, MariaDB: row locks under READ COMMITTED. SQLite: one writer, `BEGIN IMMEDIATE`. Same invariants, different throughput. |
| Database-level check constraints | Enforced by the model on every driver; additionally by the database on PG, MySQL, MariaDB. Rows written outside Eloquent are unchecked on SQLite. |
| Malformed UUID in a query | Error on PG, no row elsewhere. Every id from a request passes a `uuid` rule or a route pattern first. |
| Failed statement inside a transaction | Aborts the transaction on PG only. Code is written for PG: a statement allowed to fail runs under a savepoint. |
| Aggregate result types | Always cast in PHP. |
| DDL inside a transaction | Never in application code; in tests only through a dedicated mechanism. |
| SQL Server | Not supported by the shipped schema. |

### 7.5 Test matrix (recommendation)

| Suite | SQLite memory | PostgreSQL | MariaDB | MySQL 8.4 | SQLite file | SQL Server |
|---|---|---|---|---|---|---|
| Unit, Arch | local default, CI | — | — | — | — | — |
| Feature (3 212) | local default, CI on every push | CI on every push | CI on every push | CI nightly | — | nightly, allowed to fail |
| Concurrency (WP6) | — | CI | CI | CI nightly | CI | — |
| Browser (554) | — | CI on every push | — | — | smoke subset nightly | — |
| `migrate:fresh` + seed | CI | CI | CI | CI | CI | nightly, allowed to fail |

Why: SQLite in memory makes the feature suite fast and removes the need for a database service locally and in the `ci` job, but it is the most permissive engine (no column length, no type strictness, no transaction abort, no row lock), so it can never be the only gate: PostgreSQL stays required because it is the strictest and the production default, MariaDB is required because it differs most (no expression index, collation, isolation). MySQL shares MariaDB's code path, nightly is enough. The browser suite exercises the front end and stays on one driver.

### 7.6 Size

- Application and configuration: about 30 files (17 with raw SQL, 3 models for `name_key`, 2 for the date cast, 5 for model guards, `config/database.php`, `config/cache.php`, 7 new helper classes).
- Migrations: 8 edited, 1 new (2 more edited once [18f] is merged).
- Tests: 15 existing files edited, about 8 new files with 40 to 60 tests, plus the concurrency suite.
- Tooling: `phpunit.xml`, `bin/test-browser`, `compose.yaml`, `Dockerfile`, `.env.example`, `.github/workflows/tests.yml`, README.
- Total: 65 to 75 files. Unknown on top: failures that only appear when the 3 212 feature tests first run on SQLite and MariaDB (type strictness of raw reads, order assumptions); reserve a triage pass after WP3.

## 8. Not determined by reading

1. Nothing was executed: every "fails on" above is derived from the grammar sources and the engines' documented behaviour, not observed.
2. Whether the `ci` job of `.github/workflows/tests.yml` passes today without a database service.
3. Read-before-lock inside the 138 transaction files: only the multi-lock files were read; READ COMMITTED on MySQL/MariaDB makes the question moot, otherwise each must be traced.
4. The PHP type of `chatId` stored in `team_integrations.settings` (`HandleTelegramUpdate.php:107`), which decides whether the JSON lookup matches on SQLite.
5. `SummarizeHealthCheck.php:106`: whether `completed_at` can be NULL in that sort.
6. Queries issued by Fortify, Sanctum, Socialite and the password broker (e-mail lookups in `vendor/`) under each collation.
7. The locale of deployed PostgreSQL databases (a `C` locale makes `lower()` ASCII-only there too).
8. How the SQLite table rebuild treats an expression index or a raw check on Laravel 13.34 (assumed lost; avoided by the plan).
9. `whereIn` list sizes against SQLite's and SQL Server's bound-parameter limits.
10. The other lane worktrees (`laneBackA`, `laneBackB`, `laneBackC`, `lanePoker`, `lanePrepB`, `laneSettings`, `laneTeam`) were not read; diffs seen from [18f] show lock sites and `selectRaw` calls that differ from the main tree.
11. How many of the 23 query-count tests and the 3 212 feature tests depend on PostgreSQL result types or default ordering.

## 9. Rule for agents, effective now

> Database code must run unchanged on PostgreSQL, MySQL, MariaDB and SQLite.
>
> 1. No `ilike`, `::` cast, `filter (where …)`, `nulls first/last`, `date_trunc`, `interval`, `distinct on`, `returning`, `on conflict`, regex operator, `||`, or boolean literal in SQL. No `insertOrIgnore`, no `whereJsonContains`/`whereJsonLength`.
> 2. No new `whereRaw`, `selectRaw`, `orderByRaw`, `havingRaw`, `groupByRaw`, `DB::raw`, `DB::statement`, `DB::select`. Plain aggregates (`count(*)`, `sum(col)`, `max(col)`) with `groupBy` are the only exception; cast the result in PHP.
> 3. No `DB::getDriverName()` branch, in code, migrations or tests. If one seems necessary, stop and ask.
> 4. Case-insensitive comparison: lower the value in PHP and compare with a column that stores the normalised form. Never rely on the database being case-sensitive or case-insensitive. `LIKE` searches go through the single search helper, never a hand-written pattern.
> 5. Migrations: schema builder only. `dateTime()` rather than `timestamp()` for a non-null column, `longText()` for anything that can exceed 64 KB, no database default on a JSON column (use the model's `$attributes`), no expression or partial index, no raw constraint. An invariant the database cannot express on every driver is enforced in the model.
> 6. Transactions: lock the aggregate root first, before any other query of the transaction. A statement that may fail inside a transaction runs in its own nested `DB::transaction`. No DDL inside a transaction.
> 7. Sorting: add an explicit tie-breaker; never depend on where NULL sorts or on alphabetical order from SQL.
> 8. Tests: never assert SQL text, quoting, or `for update`; never use an SQL error such as `select 1 / 0` to simulate a failure; no `Schema::` change inside a test.
