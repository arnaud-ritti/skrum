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

## Task 3 — the migrations run on the four engines

Run on 2026-10-02 with `TEST_DB_PROCESSES=6`, database `testing_l9`, after the migration preflight passed on each engine.
The suite has 4 936 tests (Unit, Feature, Upgrade, Arch).

| Driver | Result | Time |
|---|---|---|
| pgsql | `test-db pgsql: FAIL (exit 1), Tests: 7 failed, 1 skipped, 4928 passed (49552 assertions)` | 2 min 09 |
| sqlite | `test-db sqlite: FAIL (exit 2), Tests: 33 failed, 4 skipped, 4899 passed (49446 assertions)` | 36 s |
| mariadb | `test-db mariadb: FAIL (exit 2), Tests: 167 failed, 4 skipped, 4765 passed (48753 assertions)` | 2 min 04 |
| mysql | `test-db mysql: FAIL (exit 2), Tests: 178 failed, 4 skipped, 4754 passed (48725 assertions)` | 4 min 09 |

**PostgreSQL, 7 failures, all tests of what this task removed from the database** (each expects a `QueryException`):
`ActionItems/ActionItemModelTest` 3 (lines 69, 78, 83), `Retros/HealthStatementModelsTest` 1, `Poker/WorkspacePokerDecksTest` 2
(line 271, two datasets): the five check constraints, Task 9. `Whiteboards/WhiteboardTemplatesTest:158`: the unique name, Task 4.

**SQLite, 33 failures**

| Count | Cause | Files | Task |
|---|---|---|---|
| 10 | `ilike` (the MCP tool answers an error) | `Mcp/SearchBoardsTest` 8, `Mcp/ReadPrivacyTest` 1, `Mcp/McpSweepTest` 1 | 7 |
| 1 | 500 on the estimates page (`ilike`, not checked further) | `Poker/PokerEstimatesPageTest` | 7 |
| 7 | `no such function: date_trunc` | `Games/TeamGameLeaderboardTest` (6 errors, 1 missing prop) | 5 |
| 3 | date-only values (reminders selected or sent differently) | `ActionItems/ReminderSelectionTest` | 9 |
| 4 | check constraints and unique name gone | `ActionItems/ActionItemModelTest` 3, `Whiteboards/WhiteboardTemplatesTest` 1 | 9, 4 |
| 4 | tests reading lock syntax or SQL text | `Integrations/ActionItemExportTest`, `Games/IcebreakerRoomTest`, `Admin/InstanceAdminsTest` 2 (one may be the candidate search, Task 7) | 11 |
| 2 | `select 1 / 0` is not an error | `Integrations/WebhookEventsTest`, `Integrations/WebhookSharesTest` | 11 |
| 1 | closed PostgreSQL port expected | `ErrorPagesTest:259` | 11 |
| 1 | reads `information_schema.columns` (not on the arch baseline) | `UuidPrimaryKeysTest` | 11 or 12 |

**MariaDB, 167 failures**

| Count | Cause | Files | Task |
|---|---|---|---|
| 89 | syntax error at `nulls last` (`ActionItemQuery::order`, reached by the board snapshot) | `Retros/BoardSnapshotTest` 34, `Retros/ResultsTest` 15, `Integrations/ShareSnapshotTest` 10, `ActionItems/CarryOverTest` 7, `Retros/SuggestedActionsTest` 6, `Retros/HealthCheckTest` 4, `Retros/RotiTest` 3, `Retros/WritersCountTest` 3, and one each in `Avatars/AvatarStyleTest`, `Llm/LlmTest`, `Retros/AiSummarySettingTest`, `GroupNamesTest`, `GuestJoinTest`, `SurveyPresentationTest`, `VotingTest` | 6 |
| 27 | an MCP tool answers an error (`ilike`, `filter (where`, `nulls last`; not split) | `Mcp/SearchBoardsTest` 8, `Mcp/PromptsTest` 6, `Mcp/RetroListToolsTest` 8, `Mcp/McpSweepTest` 3, `Mcp/ReadPrivacyTest` 2 | 6, 7 |
| 19 | 500 or no Inertia response (same raw SQL behind a page; not split) | `ActionItems/ActionItemsPageTest` 12, `Retros/RetroAccessTest` 3, `Games/GamesPlayedTest`, `Games/IcebreakerRoomTest`, `Integrations/ExternalLinksPresentationTest`, `Poker/PokerEstimatesPageTest` | 5, 6, 7 |
| 7 | `date_trunc` does not exist | `Games/TeamGameLeaderboardTest` | 5 |
| 4 | check constraints and unique name gone | as on SQLite | 9, 4 |
| 2 | `SAVEPOINT trans2 does not exist`: `Schema::drop` in a test commits the transaction | `Branding/BrandInPageTest`, `InstanceSettingsTest` | 11 |
| 9 | tests reading SQL text, lock syntax, `select 1 / 0` | `Admin/InstanceAdminsTest` 3, `Games/GameAccessTest`, `Integrations/ActionItemExportTest`, `WebhookRedeliveryTest`, `WebhookEventsTest`, `WebhookSharesTest`, `SharedPropsTest:158` (cause not read) | 11, 12 |
| 5 | not read: values null where a row was expected | `Games/IcebreakerRoomTest` 5 | 12 (perhaps 5: `insertOrIgnore`) |
| 1 | not read | `Integrations/ExportTargetsTest` | 12 |

**MySQL, 178 failures**: the 167 of MariaDB, the same files and counts, plus 11 "two arrays are identical":
`Integrations/TelegramConnectTest` 4, `Whiteboards/WhiteboardElementWritesTest` 4, `Integrations/ConnectLinearTest` 1,
`Whiteboards/WhiteboardTemplatesTest` 1, `Integrations/StatusSyncSettingsTest` 1. Not read; MySQL's `json` type reorders
object keys, which MariaDB's (a `longtext`) does not: the likely cause, for Task 12.

Preflight: `bin/test-db` on the tree before the edits answered exit 3 in 2 s (MariaDB, `2026_10_01_100300_create_workspace_templates_table`),
0.5 s (SQLite, `2026_10_06_100000_create_game_tables`) and 4 s (MySQL). After the edits a second stop appeared on MariaDB and MySQL,
`2026_10_01_120200_create_survey_responses_table` (index name of 65 characters), fixed with an explicit name.

## Wave 1 — Tasks 4, 5, 6, 7, 11 merged, then the finished front-end rewrite (plans 18e, 18f, 18g)

Run on 2026-10-02 with `TEST_DB_PROCESSES=6`, database `testing_l9`. The suite has 5 580 tests (Unit, Feature, Upgrade, Arch).

| Driver | Result | Time |
|---|---|---|
| pgsql | `test-db pgsql: FAIL (exit 1), Tests: 6 failed, 1 skipped, 5573 passed (52858 assertions)` | 2 min 32 |
| sqlite | `test-db sqlite: FAIL (exit 1), Tests: 23 failed, 9 skipped, 5548 passed (52741 assertions)` | 42 s |
| mariadb | `test-db mariadb: FAIL (exit 1), Tests: 21 failed, 4 skipped, 5555 passed (52759 assertions)` | 5 min 16 |
| mysql | `test-db mysql: FAIL (exit 1), Tests: 33 failed, 4 skipped, 5543 passed (52723 assertions)` | 9 min 53 |

| Cause | Files | pgsql | sqlite | mariadb | mysql | Task |
|---|---|---|---|---|---|---|
| The check constraints are gone, the model guards are not there yet | `ActionItems/ActionItemModelTest` 3; on PostgreSQL only (the tests branch on the driver) `Retros/HealthStatementModelsTest` 1, `Poker/WorkspacePokerDecksTest` 2 | 6 | 3 | 3 | 3 | 9 |
| Date-only values stored with a time part | `ActionItems/ReminderSelectionTest` 3 | | 3 | | | 9 |
| `ilike` in the workspace search of plan 18f (every request answers 500) | `SearchTest` 17 | | 17 | 17 | 17 | 7 step 7, with 10 |
| A test reads SQL text with PostgreSQL quoting | `Auth/MagicLinkTest` 1 | | | 1 | 1 | 10, then scenario C2 of 14 |
| Key order of an array read back from a `json` column | `Integrations/TelegramConnectTest` 4, `Whiteboards/WhiteboardElementWritesTest` 4, `Integrations/ConnectLinearTest` 1, `Integrations/StatusSyncSettingsTest` 1, `Whiteboards/WhiteboardTemplatesTest` 1, `Notifications/BellNotificationsTest` 1 (new with 18f) | | | | 12 | 12 |

Nothing is left for Tasks 4, 5, 6 and 11. The whole-suite time on MariaDB and MySQL rose because `tests/Upgrade`
now holds seven tests that each run `migrate:fresh` (about 35 s each on MariaDB, 60 s on MySQL, in one worker).
`bin/check-pg-upgrade` passes on the merged tree.

## Wave 2 — Tasks 9, 8, 10, 13, 16 merged

Run on 2026-10-03 with `TEST_DB_PROCESSES=4`, database `testing_l9`, one engine at a time. The suite has 5 715 tests.

| Driver | Result | Time |
|---|---|---|
| pgsql | `test-db pgsql: PASS, Tests: 2 skipped, 5713 passed (53153 assertions)` | 4 min 21 |
| sqlite | `test-db sqlite: PASS, Tests: 8 skipped, 5707 passed (53140 assertions)` | 1 min 01 |
| mariadb | `test-db mariadb: PASS, Tests: 1 skipped, 5714 passed (53155 assertions)` | 8 min 43 |
| mysql | `test-db mysql: FAIL (exit 1), Tests: 12 failed, 1 skipped, 5702 passed (53119 assertions)` | about 14 min 40 |

| Cause | Files | mysql | Task |
|---|---|---|---|
| Key order of an array read back from a `json` column | `Integrations/TelegramConnectTest` 4, `Whiteboards/WhiteboardElementWritesTest` 4, `Integrations/ConnectLinearTest` 1, `Integrations/StatusSyncSettingsTest` 1, `Whiteboards/WhiteboardTemplatesTest` 1, `Notifications/BellNotificationsTest` 1 | 12 | 12 |

PostgreSQL, SQLite and MariaDB are green. The arch baseline is empty. `bin/check-pg-upgrade` passes on the merged tree.
