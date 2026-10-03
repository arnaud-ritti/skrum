# Skrum — Action items: selection and bulk changes, priority, due-date and source filters, "In progress", export — Design

Date: 2026-10-03
Status: Answered. The owner answered the seven questions of §15 on 2026-10-03 (`.superpowers/sdd/roadmap/progress.md`, "Owner answers 2026-10-03", line "Plan 24"). Questions 2 and 6 were answered with another option than the one the draft was written on: "In progress" is synced both ways with a configurable start status (§6.2, §6.7), and a selection can reach every matching item, sent to the server as filters (§6.5). The body below is written on the answers. The pre-build deviations of the plan (P24-01 to P24-12) were answered on 2026-10-03 (`progress.md`, "Pre-build deviations (owner, 2026-10-03)", line "P24"): P24-03 → a "By sprint" grouping is added and is the default (§6.8, §9.3), so this plan runs **after plan 23** (its `team_sprints`); P24-07 → the topbar search field of the mockup filters the action items (§6.3 `q`, §9.1); P24-08 → the sidebar reads "Actions · n overdue" as the mockup (§9.10; this settles D-129 for that entry); every other row approved as listed. Nothing waits for the owner. Verification per plan is PostgreSQL only; the four-engine matrix runs once at the end of the roadmap (owner, 2026-10-03); the code stays portable (Eloquent only).
Parent spec: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` (§5 rule 13: mockup binding for presentation; §9 B25 and B16 for the counters and `filterTeams` of the page).
Owner's word: `docs/superpowers/research/front-rewrite/owner-answers-2026-10-02.md` — group 5 (5-D1 side sheet, 5-D3 delete with confirmation, 5-D4 / 5-D5 "Group by" and the counters, 5-D6 "New action item" in the topbar, 5-D2 export icon, 5-D7 "(Guest)"), third round ("Action items: bulk selection bar, filters (priority, due date, source), status 'In progress', export"), fifth round (working rules, database portability), sixth round (informal register; guests count as participants); `.superpowers/sdd/roadmap/progress.md` (answers of 2026-10-03 to §15, the pre-build deviation answers "P24" of 2026-10-03, the execution order "parallel 20, 21, 26, 27, 29 → 22 → 23 → 24 and 25", and "Lance les 4 bases seulement à la fin").
Sibling spec: `docs/superpowers/specs/2026-10-21-plan-23-team-workspace-data-design.md` §6.3 (`team_sprints`, `TeamSprint::present()`, rule 5 "the sprint of a session is the sprint containing the day it was created"), merged before this plan.
Roadmap rows: AI-1 to AI-4 of `docs/superpowers/research/front-rewrite/feature-roadmap.md`. Deviation rows cleared: D-19 (all but the whiteboard and survey sources), D-118 (the selection part) of `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`; D-129 (the Actions badge wording) of `docs/superpowers/research/front-rewrite/deviations.md`; PB-12 (the search field, on the action items page only).
Mockups (binding for presentation): `docs/design-system/components/ScreenActions` (README and preview: sidebar "Actions · 2 en retard", topbar search "Rechercher une action, un ticket… ⌘K" and "Exporter", "Grouper par" Sprint / Équipe / Responsable / Aucun with sprint group rows, faceted filter bar, table with the selection column, floating bulk bar; phone: list grouped by sprint, long press, bar of three actions + "…"), `ActionItem` (three statuses, the half-disc of "en cours", the status button that advances the status), `MobileDashboard` (the phone list of actions), `Checkbox`, `Popover`, `Command`, `DatePicker`, `DropdownMenu`, `Sonner`. The status mapping panel of the team integrations page has no mockup; it follows its current layout (plan's deviation P24-12).
Database rules: `docs/database.md` ("Rules for database code" 1 to 12; `action_items.sort_rank` is a derived column written by `ActionItem::save()` only).

What was read: the code of `main` at `18d3637e` (plans 18e to 18g, database portability, plan 19): `app/Models/ActionItem.php`, `app/Enums/ActionItemStatus.php`, `ActionItemPriority.php`, `ExternalIssueState.php`, `ExternalStatusCategory.php`, `app/Actions/ActionItems/*` (filters, query, permissions, rules, status, update, delete, broadcast, guard, next occurrence), `app/Actions/Integrations/{ApplyIssueChanges,LinkStatusSync,ExportActionItem,ActionItemExportGuard,ExportActionItemRules,ListExportSources,BuildWebhookEventData}.php`, `app/Support/Integrations/Trackers/{DoneMapping,IssueStatus}.php`, `app/Jobs/Integrations/PushActionItemState.php`, `app/Actions/Retros/PresentActionItem.php`, `app/Mcp/Tools/Retro/{ListActionItems,CompleteAction}.php`, `app/Mcp/Presenters/McpActionItem.php`, `app/Http/Controllers/WorkspaceActionItemsController.php`, `app/Actions/TeamSurveys/ExportSurveyCsv.php` and its controller, the action-item routes of `routes/web.php`, the migrations of `action_items`, `resources/js/components/action-items/*`, `components/skrum/{action-item,action-sheet}.tsx`, `lib/action-items/*`, `lib/retro/types.ts`, the tests of `tests/Feature/ActionItems`, `tests/Feature/Integrations/ApplyIssueChangesTest.php`, `tests/Concurrency`, `tests/Upgrade`. For the answers of 2026-10-03, on `main` at `0c294632`: `app/Support/Integrations/Jira/JiraTransitions.php`, `app/Support/Integrations/Trackers/{JiraIssueTracker,LinearTracker,GitHubTracker,SyncsIssueStatus}.php`, `app/Exceptions/Integrations/StatusPushRejected.php`, `app/Actions/Integrations/{QueueActionItemStatusPushes,UpdateStatusSyncSettings,PresentTeamIntegration}.php`, `app/Listeners/Queue{Completed,Reopened}ActionItemStatusPushesListener.php`, `app/Events/ActionItems/ActionItemReopened.php`, the migration `2026_10_07_100000_extend_integration_tables_for_sync_and_channels.php` (`external_state` and `last_pushed_state` are `string(10)`), `resources/js/components/integrations/status-mapping-panel.tsx`, `resources/js/types/integrations.ts`, `resources/js/lib/retro/api.ts`, `config/octane.php` (`max_execution_time` 30), `tests/Feature/Integrations/{IssueTransitionsTest,ActionItemStatusPushTest,IssueStatusReadsTest,StatusSyncSettingsTest}.php`, the helpers `statusSyncLink`, `statusSyncIssue`, `jiraTransition`, `fakeJiraTransitions` of `tests/Pest.php`. Nothing was run.

## 1. Problem statement

The action items page (plan 18e, Task 5.2) is the mockup's table, filters and side sheet, built with what the server holds. Four parts of ScreenActions were left out, each with its place kept in the page (`slots.selectionCell`, `slots.selectionHead`, `slots.bulkBar`, `slots.extraFacets`, `withDoing`, the `before` place of `NewActionItemButton`):

- **AI-1** No selection and no bulk bar. Every write is one item at a time (`PATCH` and `DELETE workspaces/{workspace}/action-items/{actionItem}`).
- **AI-2** The filters are status (one choice among open, overdue, completed, all), assignee and team (`ActionItemFilters`). The mockup also filters by priority, due date and source.
- **AI-3** An item is open or completed: `ActionItemStatus` has two cases and the state is read from `completed_at`. The mockup's `ActionItem` has a third status, "En cours", drawn as a half disc, and its status button advances to-do → in progress → done. The tracker status sync (`ApplyIssueChanges`, `PushActionItemState`, `LinkStatusSync`) works on two states (`ExternalIssueState`: open, done), and the per-project / per-team mapping knows a complete and a reopen target only. The front component already knows `'doing'` (`components/skrum/action-item.tsx`, prop `withDoing`); the server never sends it.
- **AI-4** No export of the list. The topbar of the mockup has "Exporter".
- **Pre-build answers P24-03, P24-07, P24-08.** The mockup groups by sprint by default, has a search field in the topbar, and words the sidebar badge "2 en retard"; the page groups by None / Team / Assignee (no sprint existed before plan 23), the topbar holds the app-wide palette's field, and the badge is a number.

Verification of the roadmap's "Back end" lines: all four hold. Two precisions: the per-item permissions of a batch already exist in `ActionItemPermissions` (`canEdit`, `canComplete`, `canDelete`) and `ApplyActionItemChanges`, so a batch is a loop over them, not new rules; and `ActionItemStatus` is also the status of a sub-task (`ActionItemSubtaskRules`, `UpdateActionItemSubtask`), which must not gain the third value.

## 2. Goals

1. A member selects rows of the list — or every item matching the filters — and changes their status, assignee, due date or priority, sends them to the team's tracker, or deletes them, in one gesture; each item is checked and changed on its own, and the member is told what was changed and what was refused, and why.
2. The list filters by status (several at once), priority (several at once), due date (one bucket) and source (from a retro, or added outside a retro), alongside the existing team, assignee and "Overdue" filters.
3. An item can be "In progress", everywhere an item's status is shown or changed: the actions page, the side sheet, the retro board, the carried-items panel, the MCP answer. On Jira (Cloud and Data Center) and Linear, "In progress" is synced both ways: a linked item follows its issue into and out of progress, and starting an item moves its issue to the project's or team's start status, which an owner or admin can choose.
4. A member downloads the list as it is filtered, every page of it, as a CSV file.
5. Database code is Eloquent and the standard query builder only and runs unchanged on PostgreSQL, MySQL, MariaDB and SQLite. This plan proves it on PostgreSQL; the four-engine matrix runs once at the end of the roadmap (owner, 2026-10-03).
6. The list groups by sprint by default (the team's sprints of plan 23), searches by text or ticket key from the topbar, and the sidebar names the overdue count in words, as the mockup draws them.

## 3. Non-goals (what stays in the backlog)

- **Whiteboard and survey sources** of an item (the mockup's "Whiteboard · Parcours d'onboarding", "Sondage · Pulse d'équipe"). Whiteboard collaboration (former plan 28) is backlog; a survey source is in the backlog of plan 19 (spec §13). The Source facet is built with the two sources that exist; a new source is one more value of it.
- **A search inside comments, sub-tasks or the retro's title**, and a search of the sprint grouping by name: the topbar field searches an item's text and its ticket keys (§6.3).
- **An "all matching" selection beyond 500 items, a background (queued) bulk change, and exclusions** ("all matching except these three"). Unticking a row leaves the "all matching" mode (§9.3).
- **"Sync to :tracker" for an "all matching" selection.** The tracker loop runs in the browser over ids it holds (decision 3); in "all matching" mode the button is disabled with a tooltip (§9.4).
- **Bulk changes on the retro board** (the Actions phase has its own "Export to Jira" of the retro, RT-10 of plan 21). Bulk changes of this plan are for the workspace page.
- **"In progress" on GitHub.** GitHub issues have no in-progress state: a started item is "open" for a GitHub link, read and pushed as today.
- **An outgoing webhook event for "in progress"**, a status in the retro recap e-mail, an MCP tool that sets "In progress". The webhook payload and the recap keep their two states (open, completed); the MCP tools keep theirs (§6.4).
- **Formats other than CSV** for the export, a "Download selection" action, an export of a retro (owner's backlog).
- **A server-side grouping by sprint** (pages cut at sprint boundaries, a sprint's total across pages). Grouping stays client side over the rows of the current page (owner 5-D4); the group row counts the rows of this page.

## 4. Decisions already taken

| Topic | Decision | Source |
|---|---|---|
| The four features | Bulk bar, filters (priority, due date, source), status "In progress", export | owner, third round, "Features to specify after the rewrite" |
| Delete | With confirmation | owner 5-D3 |
| Details | Side sheet | owner 5-D1 |
| Group by | Client side, over the rows of the current page; Sprint (default) / Team / Assignee / None | owner 5-D4; PB-03; P24-03 answered 2026-10-03 |
| Topbar search | The mockup's field filters the action items list (text and ticket key) | P24-07 answered 2026-10-03 |
| Sidebar badge | "n overdue" in words, as the mockup | P24-08 answered 2026-10-03 (settles D-129 for this entry) |
| Order of plans | Plan 24 runs after plans 22 and 23, in parallel with plan 25 | owner, 2026-10-03 |
| Verification | PostgreSQL per plan; the four engines once at the end of the roadmap | owner, 2026-10-03 |
| Counters | "n open · n overdue · from n rituals" in the header | owner 5-D5; D-116 |
| Tracker export | Icon in the Ticket cell and in the sheet footer | owner 5-D2 |
| Guest label | "(Guest)" with a capital | owner 5-D7 |
| Register | Informal in French, Spanish, German, in every new text | owner, sixth round |
| Data | Eloquent only, portable to the four engines, derived columns written by the model | owner, fifth round; `docs/database.md` |
| Working rules | Tests written and run per task; no browser walkthrough; captures light, 1440, French only | owner, fifth round and plan 19 |
| The seven questions of §15 | Answered 2026-10-03: 1 A, 2 **C**, 3 A, 4 A, 5 A, 6 **B**, 7 A | owner, `.superpowers/sdd/roadmap/progress.md` |

## 5. Rules

1. **One item, one check.** A bulk change is the single-item change applied to each selected item in turn, in its own transaction, under its own row lock, with the single-item permissions and validations (`ApplyActionItemChanges`, `DeleteActionItem`). There is no batch permission (decision 1).
2. **A refusal names its reason.** An item the viewer cannot see, an item deleted meanwhile, a locked board, a missing right, a recurring item asked to lose its due date, an assignee who is not a member of the item's team: each is one refused item with the sentence the single-item endpoint gives today. Missing and invisible items read the same ("This action item no longer exists.") and carry no title.
3. **Three statuses, one completion.** `completed_at` stays the one source of "done": everything that reads completion today (sort rank, counters, overdue, recap, webhooks, reminders, carry-over) keeps reading it. "In progress" is a new nullable `started_at`, meaningful only while `completed_at` is null.
4. **Filters are read by the server.** Every facet, and the topbar search, is a query parameter of the page; counters, pagination, the export, the "all matching" selection and the landing on stored filters all go through `ActionItemFilters` and `ActionItemQuery`. Old URLs and old stored filters keep working (§6.3).
5. **The export is the list.** Same visibility, same filters, same order as the page, every page.
6. **The tracker sync has three states where the tracker has them.** For Jira, Jira Data Center and Linear, an issue is open, started or done, and an item is to do, in progress or done; the existing conflict rules (`skrumWins`, `echoesLastPush`, stale reads) decide between them unchanged, over three values instead of two. For GitHub, a started item is open. A change that came from the source is never pushed back (decision 2).
7. **"All matching" is the filters at the moment of confirmation.** The page sends its filters and the number of items it showed the member; the server counts again, refuses with the new number when it differs, refuses above 500, and otherwise applies rule 1 to each matching item, in the page's order (decision 6).

## 6. Domain and data

### 6.1 Status

| Status (API value) | Stored as | Label (en / fr) |
|---|---|---|
| `open` | `completed_at` null, `started_at` null | To do / À faire |
| `doing` | `completed_at` null, `started_at` set | In progress / En cours |
| `completed` | `completed_at` set (`started_at` kept as it was) | Done / Terminé |

- Migration `2026_10_24_100000_add_started_at_to_action_items.php` (dated after plan 23's `2026_10_23_…` migrations; plans 21 and 29 already use `2026_10_21_…`): `timestamp('started_at')->nullable()`, after the other columns; no index (the status filter combines it with `completed_at`, which the existing indexes lead with `team_id`), no fill: every existing row is `open` or `completed` as before.
- `ActionItemStatus` gains `case Doing = 'doing'`. `ActionItem::currentStatus(): ActionItemStatus` derives it (not named `status()`: an Eloquent attribute read `$item->status` would resolve a method of that name as a relation).
- `SetActionItemStatus::handle($locked, $actor, $status)` takes the three values:

| From → to | Writes | Events |
|---|---|---|
| open → doing | `started_at = now` | `ActionItemProgressChanged`, broadcast |
| doing → open | `started_at = null` | `ActionItemProgressChanged`, broadcast |
| open or doing → completed | `completed_at = now`, `completed_via_source` as today; `started_at` kept | next occurrence, reminders read, `ActionItemCompleted`, broadcast (as today) |
| completed → open | `completed_at = null`, `completed_via_source = null`, `started_at = null` | `ActionItemReopened`, broadcast (as today) |
| completed → doing | `completed_at = null`, `completed_via_source = null`, `started_at` kept or `now` | `ActionItemReopened`, broadcast |
| same status | nothing | nothing |

- `ActionItemProgressChanged` (new, `App\Events\ActionItems`, `ShouldDispatchAfterCommit`, the same fields as `ActionItemReopened`: item, origin, actor) is a domain event, not broadcast and not a webhook. Its one listener queues the tracker pushes of the item (§6.2), as the completion and reopening listeners do.
- Who: the right to change the status is the right to complete today (`canComplete`: author, the retro's facilitator, a workspace owner or admin, the assignee, a facilitator reviewing the team's follow-ups in a running retro), for members and for guests on their retro's board.
- `sort_rank` does not move: "in progress" sorts with the open items. The next occurrence of a recurring item starts `open`.
- Sub-tasks keep two states: `ActionItemSubtaskRules` accepts `open` and `completed` only.

### 6.2 Tracker status sync, both ways (decision 2, option C)

Today a read of a linked issue moves the item to completed (issue done) or open (issue not done) when they differ and the source wins the conflict rule; a change in skrum is pushed as done or open, to the project's or team's configured complete or reopen target, else a default. With this plan the same machinery carries a third state.

**States.**
- `ExternalIssueState` gains `case Started = 'started'` (seven characters: `external_state` and `last_pushed_state` are `string(10)`, no migration).
- `DoneMapping::state()` answers `Done` as today; otherwise `Started` when the provider tracks a start (`DoneMapping::tracksStart()`: Jira, Jira Data Center, Linear) and the status's category is in progress (`DoneMapping::category()` → `ExternalStatusCategory::InProgress`: Jira status category `indeterminate`, Linear state type `started`); otherwise `Open`. A Jira status of the done category that the mapping does not count as done stays `Open`, and a Linear canceled state not treated as done stays `Open`, as today.
- `DoneMapping::itemState(ActionItem $item, IntegrationProvider $provider)` is the item's state for a link of that provider: completed → `Done`; doing → `Started` where the provider tracks a start, `Open` otherwise (GitHub); open → `Open`. `ApplyIssueChanges`, `LinkStatusSync::state()` and `PushActionItemState` read it where they read `isCompleted()` today.

**Reads.** `ApplyIssueChanges` compares the issue's state with the item's state over the three values. When they differ, the existing conflict rule decides; when the source wins, the item takes the source's state (`Done` → completed, `Started` → doing, `Open` → to do) as the system (`ExternalSyncActor`), without a permission or lock check, on a locked board too, like a completion by the source today. So an item still to do follows its issue into progress; a started item follows its issue back to "to do" when the issue's change is the newer one; a completed item reopened by the source into an in-progress status becomes `doing`. When skrum's change wins (an unpushed start newer than the issue's change), it is pushed, as a completion is today.

**Pushes.** Every status change made in skrum (completion, reopening, start, stop) queues `PushActionItemState` for each synced link of the item (`QueueActionItemStatusPushes`, origin skrum only; source changes are never pushed back). The job pushes `DoneMapping::itemState()`:
- `Done` and `Open`: as today (complete target; reopen target, else the first `new` then `indeterminate` Jira transition, else the first `unstarted` then `backlog` Linear state).
- `Started`, Jira and Jira Data Center: the configured start status of the issue's project (`statusMapping.projects.{KEY}.startStatusId`) when a transition reaches it, else the first transition whose target is of category `indeterminate`. A transition screen that requires a field is refused with "Jira requires more fields to start :key. Start it in Jira."; no reachable target is refused with "No transition to an in-progress status is available for :key." (`StatusPushRejected`, recorded on the link as a failed write, as today).
- `Started`, Linear: the configured start state of the issue's team (`statusMapping.teams.{KEY}.startStateId`) when the team still has it, else the first `started` state in workflow order; none is refused with the same sentence.
- GitHub never receives `Started` (a started item is `Open` for it).

**Sync state.** `LinkStatusSync::state()` reads `synced` when the link's last read state equals `DoneMapping::itemState()`, `pending` otherwise, as today.

**Release.** No link row is migrated. A link read before this plan holds `open` for an issue that was in progress; its next read records `started`, and the conflict rule decides as for any change: when skrum's last change was already pushed, the source wins and the open item becomes `doing`. When skrum holds an unpushed "to do" newer than the issue's last change (a reopening whose push failed or is still queued), skrum wins and the issue is moved back to its reopen target: the release note says so (§14).

### 6.3 Filters

`ActionItemFilters` (query parameters of `workspaces.actionItems.index`, the props `filters`, the stored entry `skrum.actionItemFilters.{workspaceId}`, the `filters` body of an "all matching" bulk request):

| Parameter | Values | Default | Reads |
|---|---|---|---|
| `status` | comma list of `todo`, `doing`, `completed` | `todo,doing` | `todo`: not completed, not started; `doing`: not completed, started; `completed`: completed |
| `priority` | comma list of `high`, `medium`, `low` | none (every priority) | `priority` in the list |
| `due` | one of `overdue`, `today`, `week`, `later`, `none` | none | `overdue`: not completed and due before today; `today`: due today; `week`: due from today to today + 6 days; `later`: due after today + 6 days; `none`: no due date (decision 4) |
| `source` | one of `retro`, `outside` | none | `retro`: has a retro; `outside`: added outside a retro |
| `q` | text, trimmed, cut at 100 characters; empty is none | none | the item's text contains it, or one of its ticket keys (`action_item_external_links.external_key`) contains it; case ignored, accents respected (P24-07) |
| `assignee`, `team`, `item` | as today | as today | as today |

- The status token for "to do" is `todo`, not `open`, because `open` is kept as an old value meaning "not done". Old values are read as follows, for links already sent (the reminder digest links to `status=open`) and for stored entries: `status=open` → `todo,doing`; `status=overdue` → `todo,doing` and `due=overdue`; `status=all` → the three; `status=completed` → `completed`. An unknown value falls back to the default, as today. Selecting the three statuses is "every status" and is written as `status=todo,doing,completed`.
- The "Overdue" shortcut beside the facets sets `due=overdue` (it set `status=overdue`); it stays pressed while `due=overdue`.
- Values are deduplicated and kept in the canonical order of the table above, so that a URL is stable.
- `ActionItemFilters::fromQuery(array $query, Collection $visibleTeams)` reads an array of these parameters (the bulk body's `filters`); `fromRequest()` reads the request's query through it.
- Today is `ActionItem::today()` (the application time zone), as for "overdue" today; dates are bound as `Y-m-d` strings (`docs/database.md` rule 11).
- **The search** (`q`) goes through `HasSearchColumns::whereContains()` (`docs/database.md` rule 4): `action_items.content_search` exists; `action_item_external_links` gains `external_key_search` (migration `2026_10_24_100100_add_external_key_search_to_action_item_external_links.php`, filled for existing rows as the earlier search-column migrations do, outside a transaction and re-runnable), and `ActionItemExternalLink` declares `searchColumns()`. The rows SQL returns are not checked again with `SearchText::contains()`: the list, its counters, its export and the "all matching" target must be the same set (rules 5 and 7), and a row check would make the page show fewer items than it counts. The cost is the documented one of rule 4: a term holding `%`, `_`, `*`, `?`, `[`, `]` or `\` may also list a near match (each such character stands for any one character).
- Counters (`counts`: open, overdue, completed, mine, rituals) follow team, assignee, priority, source and the search, and ignore status and due (the "Overdue" badge must count the overdue items whatever the due bucket chosen).
- MCP `retro.actions.list`: its `status` parameter keeps `open`, `overdue`, `completed`, `all` with their meaning and gains `doing`; it builds its filters through the same mapping.

### 6.4 What other readers see

| Reader | Change |
|---|---|
| `PresentActionItem` (page, sheet, board, carried items, broadcasts, MCP through `McpActionItem`) | `status` is `open`, `doing` or `completed`; new `startedAt` (ISO 8601 or null); a link's `state` is `open`, `started`, `done` or null |
| `PresentTeamIntegration` (team integrations page) | `settings.statusMapping` entries gain `startStatusId` (Jira projects) and `startStateId` (Linear teams), null by default |
| Webhook payloads (`BuildWebhookEventData`) | none: `status` stays `open` / `completed` |
| Recap e-mail and webhook (`BuildRetroRecap`), reminders, carry-over (`CarriedActionItems`), team counts | none: they read `completed_at` |
| MCP `retro.actions.complete`, `retro.actions.update` | none (`completed: true/false`; `update` still refuses `status`) |

### 6.5 Bulk changes (AI-1)

`POST workspaces/{workspace}/action-items/bulk-updates` (`workspaces.actionItemBulkUpdates.store`), body with exactly one of two targets:

```json
{ "ids": ["uuid", "…"], "changes": { "status": "doing" } }
{ "filters": { "status": "todo,doing", "team": "uuid" }, "count": 137, "changes": { "status": "doing" } }
```

- `ids`: 1 to 50 distinct UUIDs (50 is the page size, `ActionItemQuery::PerPage`).
- `filters` (decision 6, option B): an object whose keys are among `status`, `priority`, `due`, `source`, `q`, `assignee`, `team` (string values, as the page's query writes them; `item` and `page` are not accepted), read by `ActionItemFilters::fromQuery()` with the viewer's visible teams (an empty object is the landing filters; a team the viewer cannot see is ignored, as on the page); `count`: an integer from 1 to 500, the number of matching items the page showed. `ids` with `filters` or `count`, `filters` without `count`, or neither `ids` nor `count`: 422.
- With `filters`, the server lists the ids of the items visible to the viewer that match, in the page's order (`ActionItemQuery::order`), before changing anything. More than 500 → 422 on `filters` ("More than 500 action items match. Narrow the filters."); a number other than `count` → 422 on `count` ("The list changed: :count action items match now."), and nothing is changed. Otherwise the loop below runs over those ids.
- `changes`: at least one of `status` (`open`, `doing`, `completed`), `priority` (`high`, `medium`, `low`), `due_on` (`Y-m-d` or null), `assignee_user_id` (UUID or null); any other key is refused (422). The values are validated as the single-item update validates them.
- Each id, in order: not visible to the viewer or gone → refused; else locked, checked and changed by `ApplyActionItemChanges` in its own transaction; a refusal of that item (`AuthorizationException`, `ValidationException`, the 423 of a locked board, a row deleted meanwhile) is recorded and the loop goes on.
- Answer 200: `{ "actionItems": [presented items changed or unchanged; empty with filters], "changedCount": n, "refused": [{ "id", "title", "message" }] }`. `title` is the item's text when the viewer can see it, null when it is gone or invisible. Each changed item is broadcast exactly as a single change is (`BroadcastActionItemChange::saved`), and fires the same domain events (completion, next occurrence, assignment, webhook, tracker push).

`POST workspaces/{workspace}/action-items/bulk-deletions` (`workspaces.actionItemBulkDeletions.store`), body `{ "ids": [...] }` or `{ "filters": {...}, "count": n }` with the same rules, the same loop over `DeleteActionItem`; answer 200 `{ "deleted": ["id", …], "refused": [{ "id", "title", "message" }] }`.

Both routes are under the workspace's `auth` group, like the page; guests never reach them.

"Sync to Jira" of the bulk bar (decision 3, option A) needs no new endpoint: the page calls the existing `workspaces.actionItemExports.store` for each selected item that has no link to the chosen tracker, one after the other, after the viewer has picked the target (project and issue type, team, or repository) once, with the loop and the target fields plan 21 built for RT-10 (`runBulkExport`, `itemsToExport`, `ExportTargetFields`), merged before this plan. It is offered for a selection of rows (not "all matching") when every selected item belongs to one team and that team has a tracker the viewer can export to (`exportSources`). Items already linked to that tracker are counted as skipped.

### 6.6 Export (AI-4)

`GET workspaces/{workspace}/action-items/export` (`workspaces.actionItemCsvExports.show`), with the query of the page (status, priority, due, source, q, assignee, team; `item` and `page` ignored). It streams `action-items-{workspace-slug}-{Y-m-d}.csv`, UTF-8 with a byte-order mark, comma separated, one header row in the viewer's language, then one row per item visible to the viewer and matching the filters, in the order of the page:

| Column (en) | Value |
|---|---|
| Action | the text |
| Status | To do / In progress / Done, translated |
| Team | team name |
| Assignee | the member's name, a guest's name with " (guest)" as the recap writes it, empty when unassigned |
| Priority | High / Medium / Low, translated |
| Due date | `Y-m-d` or empty |
| Source | the retro's title, or "Added outside a retro" |
| Created | `Y-m-d` |
| Completed | `Y-m-d` or empty |
| Tickets | the tracker keys, `PROJ-12 | ENG-4` |
| Link | the item's URL (`workspaces.actionItems.index` with `item`) |

A cell that begins with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with an apostrophe (the rule of the survey CSV, moved to a shared `App\Support\CsvCell`). Rows are read in chunks (`lazy`), so the size of the list does not matter for memory. Any member who can open the page may export what the page shows them.

### 6.7 Start status settings (decision 2, option C)

The status mapping of a tracker connection (team integrations page, "Status mapping" panel; `PATCH` of `TeamIntegrationsController@update` through `UpdateStatusSyncSettings`) gains one target per project or team:

| Provider | Request key | Stored as | Rule |
|---|---|---|---|
| Jira, Jira Data Center | `status_mapping.start_status_id` | `statusMapping.projects.{KEY}.startStatusId` | nullable, the Jira status id rule of `complete_status_id` |
| Linear | `status_mapping.start_state_id` | `statusMapping.teams.{KEY}.startStateId` | nullable, the Linear state id rule of `complete_state_id` |

- Null is "Automatic" (§6.2 defaults). A container whose every value is null is removed, as today. Saving a mapping re-reads the tracked issues when sync is on, as today.
- Who: owners and admins of the workspace, as for every status sync setting today (the existing check of the route).
- The panel lists the start target first: "Start to", "Complete to", "Reopen to", each a select of "Automatic" and the container's statuses, as the two existing selects.

### 6.8 The sprint of an item (P24-03, on plan 23's sprints)

- **An item's sprint is the sprint of its team containing the day the item was created** (application time zone; `ActionItem::today()`'s zone), as plan 23 rule 5 reads a session's sprint; none when it was created between two sprints or before the team's first. Nothing is stored on the item: editing a sprint's days regroups the items created in those days, as it relabels sessions.
- The page's `items` prop gains `sprints`: `[{ id, number, startsOn, endsOn, teamId, state, itemIds }]`, where `state` is `current` (its days contain today) or `finished` (it ended before today; a sprint planned after today holds no item yet and is not listed), and `itemIds` lists the rows of this page created in it; and `withoutSprint`: the ids of the rows of this page created outside every sprint of their team. Listed: every sprint holding a row of the page, and the current sprint of each team that has a row on the page (so that a row created live, which is in neither list, lands in its team's current sprint until the next reload). Order: latest first (`starts_on`, then `id`, both descending).
- Read with one Eloquent query on `team_sprints` (`whereIn('team_id', …)`, `ends_on >=` the earliest creation day of the page's rows, `starts_on <=` today, days bound as `Y-m-d` strings, ordered by `starts_on` then `id`): a bounded set, since the page holds at most 50 rows. `App\Actions\ActionItems\ActionItemSprints::forPage(iterable $items): array{sprints, withoutSprint}` builds both; `TeamSprint::present()` gives `id`, `number`, `startsOn`, `endsOn`.
- Who sees what: the sprints of the teams whose rows the viewer sees; no new permission.
- The CSV export, the bulk endpoints and MCP do not carry the sprint.

## 7. Permissions

| Action | Members (workspace member of the item's team) | Workspace owner / admin | Guests |
|---|---|---|---|
| See the page, filter, export | their teams' items | every team's items | no access (workspace routes) |
| Select a row | when they may change its status or manage it (otherwise the box is disabled) | every row | — |
| Select all matching | the matching items of their teams, up to 500; each item is then checked on its own | every team's matching items, up to 500 | — |
| Bulk status (including "In progress") | per item: `canComplete` | always | — |
| Bulk assignee, due date, priority | per item: `canEdit` (author, the retro's facilitator) | always | — |
| Bulk delete | per item: `canDelete` | always | — |
| Bulk "Sync to tracker" (rows only) | per item: the export guard (`canEdit`, a writable connection) | always | — |
| "In progress" on the retro board | — | — | a guest who may complete the item (its assignee, its author, the facilitator) may start it |
| Start status of a project or team | no | yes (status sync settings) | — |

Team roles (TM-6, plan 23) are merged before this plan and live in `ActionItemPermissions`, which every bulk action goes through: an observer of a team (read-only everywhere) gets a disabled box on that team's rows and every bulk change of them refused with the sentence `ActionItemPermissions` gives; the search, the grouping and the export follow what the viewer may see, as the list does.

Assigning in bulk lists "Unassigned" and the members common to every team of the selection (in "all matching" mode: the filter's team, else every team of the page's `filterTeams`); an item whose team does not have that person is refused on its own (rule 2).

## 8. Real time

No new broadcast event and no new channel (`ActionItemProgressChanged` is a domain event only). Each item a bulk request changes or deletes is announced as a single change is: `TeamActionItemSaved` / `TeamActionItemDeleted` on the team channel of the page, `ActionItemSaved` / `ActionItemDeleted` on its running retro's channel, the carried-item events on the running retros that carry it. Payloads carry `status: 'doing'`, `startedAt` and link states `started`. A row the page receives live and finds neither in `items.sprints[].itemIds` nor in `items.withoutSprint` is grouped under its team's current sprint (§6.8), or under "No sprint" when its team has none, until the next reload. A page that sent a request with ids applies the response (each changed row replaced, each deleted row removed); after an "all matching" request it reloads `items` and `counts`. Every page also lets its existing coalesced reload (one second) put counters and order right from the events. Fifty items mean fifty events per channel, five hundred mean five hundred: the page's reload is already coalesced, and the board applies each payload as it does today.

## 9. Screens

Each element follows ScreenActions; "omitted" means not built, with its row in the plan's pre-build deviations.

### 9.1 Topbar

"Export" (outline button, lucide `file-down`) before "New action item", from the `before` place of `NewActionItemButton`; icon alone below 48rem with the accessible name "Export". It downloads the CSV of §6.6 with the current filters. States: idle; while the browser starts the download, nothing (a plain link with `download`); a list with no item still exports the header row.

**Search field (P24-07).** On this page the topbar's search place holds the mockup's field instead of the palette's button: lucide `search`, placeholder "Search an action item, a ticket…", the `Kbd` "⌘K" (Ctrl K off a Mac) at its end, accessible name "Search action items", width as the palette's button today (the place of `AppTopbar`, 10rem to 16.25rem).
- Typing applies `q` 300 ms after the last key (a visit like any facet; the selection rules of §9.3 apply: it clears the selection and "all matching" mode); Enter applies at once; Escape in a non-empty field clears it and applies; the field shows the `q` of the URL on landing. While a visit runs, the table's loading rows show, as for any facet.
- Shortcuts: on this page ⌘K / Ctrl K focuses and selects the field (the mockup's hint), from anywhere on the page, a field included. The app-wide palette stays mounted on this page and opens with "/" (its existing shortcut) or from the keyboard shortcuts dialog; its ⌘K binding is off on this page only, so one key never does two things.
- Below 48rem the topbar keeps the palette's icon button, as on every page, and the field moves to the top of the "Filters" drawer (same name and behaviour; ⌘K is a desktop hint).
- A search counts as an active filter: "Filters · n", "Reset" (which clears it) and the empty state "Nothing matches these filters." include it. The facet bar does not repeat it.
- States: empty, typing (the field's value ahead of the list for 300 ms), applied, no result (the empty state with "Reset").

### 9.2 Filter bar

Order of the mockup: Team, Status, Assignee, Priority, Due date, Source, separator, "Overdue" with its count, "Reset" at the end.

- **Status** becomes a faceted filter with check boxes (Popover + Command): To do, In progress, Done. The mockup draws a narrowed status as an active facet ("Statut 3 sur 4"), so the facet reads "Status · 2 of 3" (or the one status chosen) whenever fewer than the three are chosen, and is plain when the three are. The default (To do, In progress) reads "Status · 2 of 3", active, as the page lands narrowed to what is left to do; it does not count as a change for "Reset". Unticking the last box is refused (the box stays ticked).
- **Priority**: check boxes High, Medium, Low, each with the priority mark; "Priority · High" with one, "Priority · 2 of 3" with two.
- **Due date**: one choice among Overdue, Today, Next 7 days, Later, No due date, and "Any" to clear; the active facet names the bucket. Choosing Overdue here is the same as pressing the shortcut.
- **Source**: one choice among From a retro, Added outside a retro, and "Any".
- A facet shows a cross to clear it when active, as Team does today.
- "Reset" appears when any facet, the search or the grouping differs from the landing state, and restores it (current team, To do + In progress, no search, nothing else, grouped by sprint).
- Phone (below 48rem): the drawer "Filters · n" lists the same facets one per line; the chips row stays "Mine n", "Overdue n", "To do n", "Done" (D-118), where "To do" now selects To do + In progress (the default), and "Done" selects Done.
- States: each facet idle, open, active, cleared; the bar while a visit is in flight (the table's loading rows, as today); the empty state "Nothing matches these filters." with "Reset".

### 9.3 Table (from 80rem)

- **Group by (P24-03).** The header's segmented control reads, in the mockup's order, "Sprint", "Team", "Assignee", "None"; "Sprint" is the default (a stored choice of another grouping is kept; a stored entry of before without a grouping now lands on "Sprint"). By sprint, each group row is the mockup's: chevron (fold, as today), "Sprint 42" — "Atlas · Sprint 42" when the page's rows belong to more than one team —, a badge "In progress" (info) for a current sprint or "Finished" (muted) for a finished one, then in muted text ":count action items · 21 Sep → 4 Oct" for the current sprint, ":count carried over" for a finished sprint holding rows not done (the count of those rows), ":count action items" otherwise, and a destructive badge ":count overdue" when rows of the group are overdue. Groups come in the order of `items.sprints` (latest first); the rows without a sprint come last under "No sprint" with their count. When no row of the page has a sprint (a team that has not started one), "Sprint" draws no group row, as "None". Counts are of this page's rows, as for the other groupings.
- First column: a check box per row (`aria-label` "Select :title"), disabled with a tooltip "You cannot change this action item" when the viewer may neither change its status nor manage it. Header: a three-state box ("Select all on this page" / "Clear selection"), `indeterminate` when some rows are selected (`is-mixed` of the mockup). With a grouping on, each group row has a box that selects or clears its rows.
- **All matching.** When every selectable row of the page is selected and the list has more items than the page (`items.total` above the rows shown), the bulk bar offers "Select all :count matching"; pressing it enters "all matching" mode: every row box reads ticked, the bar reads "All :count matching selected". Above the cap (500, §14) the offer is disabled with the tooltip "Up to :cap at once. Narrow the filters." Unticking any row leaves the mode: the selection becomes the page's selectable rows without that one.
- A selected row has the `is-selected` background of the mockup; a done row keeps its struck title.
- Status cell: the badge "To do" (outline), "In progress" (info), "Done" (success). The badge is the status button, as today (PB-05), and advances the status as the ActionItem mockup does: "Mark as in progress" on To do, "Mark as done" on In progress, "Reopen" on Done.
- Selection of rows is kept while rows change in place; a row that leaves the list (completed under the default filter, deleted elsewhere) leaves the selection; a filter change, a page change or a grouping change clears it. "All matching" mode is cleared by a filter change only: a page change or a grouping change keeps it (the new page's rows read ticked).
- Keyboard: Space on a focused row box toggles it; Escape anywhere on the page clears the selection when the sheet and every menu are closed.

### 9.4 Bulk bar

Floating, centred at the bottom of the content (z `--z-chrome`, `--shadow-modal`), `role="toolbar"`, name "Bulk actions", shown while at least one row is selected or "all matching" is on, with a polite live region announcing "n selected" (or "All n matching selected"):

"**n** selected" [Select all :count matching] | Status ▾ | Assign ▾ | Due date ▾ | Priority ▾ | Sync to :tracker | Delete | ✕ (Clear selection)

- Status: menu To do / In progress / Done. Assign: menu "Unassigned" and the members common to the selection's teams (§7), with avatars, a search field from eight people. Due date: the DatePicker popover with "No due date". Priority: menu High / Medium / Low with the marks.
- "Sync to :tracker" (secondary, with the tracker's mark) when §6.5's condition holds: opens a dialog holding the export's target fields (plan 21's `ExportTargetFields`) to pick the target once, then exports the unlinked items one by one through plan 21's loop; the bar shows "Exporting 3 of 12…" with a progress bar and a "Stop" button; a "reconnect required" answer stops the loop. In "all matching" mode it is disabled with the tooltip "Select rows on this page to sync them."
- Delete: confirmation dialog "Delete n action items?" ("This cannot be undone. Their comments and sub-tasks are deleted too.") with "Delete" (destructive) and "Cancel".
- **Confirmation of an "all matching" change.** Status, Assign, Due date and Priority in "all matching" mode first open a dialog "Apply to :count action items?" ("Every action item matching the filters is changed: :count in all.") with "Apply" and "Cancel"; Delete's confirmation names the same count. When the server answers that the list changed, the dialog shows its sentence ("The list changed: 140 action items match now."), the page reloads `items` and `counts`, and "Apply" sends the new count.
- An action whose right no selected row of the page grants is disabled with a tooltip.
- While a request runs the bar's buttons are disabled and the pressed one shows a spinner; the selection stays.
- Result: a toast — "n action items updated." alone when nothing was refused; "n updated, m not changed." with "Details" opening a list of the refused items (title, or the sentence alone when the server sent no title, and reason) otherwise; the same for deletion. After a full success the selection is cleared; after a partial one only the changed rows leave it, and "all matching" mode is left (the selection is cleared and the list reloaded).
- On a phone the bar is anchored above the bottom edge (safe area), full width, with Status, Assign, Due date and "…" (Priority, Sync, Delete, "Select all :count matching").

### 9.5 List (below 80rem) and phone selection

- From 48rem to 80rem the page shows the `ActionItem` list (D-117), grouped by the same choice as the table (by sprint by default, the mockup's phone "liste groupée par sprint"), each group headed by the label, the badge and the counts of §9.3. A "Select" button at the end of the header enters selection mode: each item shows a box before its status button (44 px touch target), the header button becomes "Finish selecting", and the bulk bar shows. On a touch screen, a long press (500 ms, no move) on an item enters selection mode with that item selected (the mockup's "appui long"); a short tap keeps opening the item.
- The ActionItem's status button shows the half disc for In progress and advances To do → In progress → Done → To do (`withDoing` on).

### 9.6 Side sheet

The Status property is a select of the three values; the footer keeps one-click "Mark as done" / "Reopen", so completing never takes two steps from the sheet. A started item shows "Started :date" under the status. A linked ticket whose issue is in progress reads its status name, as today.

### 9.7 Retro board and carried items

The ActionItem rows of the Actions phase and of the carried-items panel show and cycle the three statuses (`withDoing` on). Counts of "open" items there (`board-dialogs.tsx`, `carried-items-sheet.tsx`) count To do and In progress.

### 9.8 Team integrations: status mapping

The "Status mapping" panel of a Jira or Linear connection shows, once "Edit mapping" has loaded the container's statuses, three selects in this order: "Start to", "Complete to", "Reopen to", each "Automatic" plus the statuses (and "Unknown status (:id)" for a saved id the tracker no longer lists, as the two existing selects do). GitHub shows no mapping, as today. Saving shows "Status mapping saved.", as today.

### 9.9 Bench and captures

The bench section `actions-index` gains the states: `selection` (three rows selected, header box mixed, bar shown with "Select all 137 matching"), `all-matching` (the bar reading "All 137 matching selected", rows ticked, "Sync to Jira" disabled), `confirm-matching` (the "Apply to 137 action items?" dialog), `bulk-result` (the partial toast and its details), `bulk-delete` (the confirmation), `facets` (Status 2 of 3, Priority High, Due date Next 7 days, Source From a retro), `in-progress` (rows with each status), `phone-selection` (the list in selection mode with the bar), `sprint-groups` (Sprint 42 current and Sprint 41 finished with its carried and overdue counts, then "No sprint"), `search` (the topbar field holding "runbook" and the narrowed list). The real page's capture shows the sidebar's "Actions · n overdue". Captures in light, at 1440, in French only; the status mapping panel is captured only if `tests/Browser/Visual` already captures the team integrations page.

### 9.10 Sidebar (P24-08)

The Actions entry's badge reads ":count overdue" ("2 en retard"), destructive pill, as the mockup; above 99 it reads "99+ overdue" with the full count for screen readers; none at zero. The collapsed sidebar keeps its dot. The entry's accessible name stays "Actions, :count overdue". It is the same component on every page with the sidebar (`components/skrum/app-sidebar.tsx`), so the wording changes everywhere.

## 10. Migrations of existing data

`started_at` is added null, and every existing row keeps its state (open when `completed_at` is null, completed otherwise); an Upgrade test proves it (PostgreSQL in this plan, the four engines at the end of the roadmap). `external_key_search` is added and filled from `external_key` for existing links (§6.3), re-runnable; an Upgrade test proves an existing link is found by its key. Stored filters and old links are read by the old-value mapping of §6.3 rather than migrated (they live in browsers and in sent e-mails). Link rows are not migrated: their `external_state` is corrected by the next read (§6.2, "Release"), and stored status mappings without a start target read as "Automatic".

## 11. Routes

| Method, URL (under `workspaces/{workspace}`) | Name | Controller@method |
|---|---|---|
| `POST action-items/bulk-updates` | `workspaces.actionItemBulkUpdates.store` | `WorkspaceActionItemBulkUpdatesController@store` |
| `POST action-items/bulk-deletions` | `workspaces.actionItemBulkDeletions.store` | `WorkspaceActionItemBulkDeletionsController@store` |
| `GET action-items/export` | `workspaces.actionItemCsvExports.show` | `WorkspaceActionItemCsvExportsController@show` |

The existing `PATCH action-items/{actionItem}` and the board's `PATCH retros/{retro}/action-items/{actionItem}` accept `status: doing`. The existing team integration update route accepts the two start keys of §6.7.

## 12. Testing

- Every test touching the database runs on PostgreSQL in this plan: `bin/test-db pgsql -- <path>` per task, the PostgreSQL suites at the end. The four-engine matrix (PostgreSQL, SQLite, MariaDB, MySQL; the races on `sqlite-file` too) runs once, after the last merge of the roadmap into `roadmap` (plans 24 and 25), not in this plan (owner, 2026-10-03; the risk of finding an engine-specific regression late is accepted). The code stays portable: Eloquent and the query builder only, `tests/Arch/DatabasePortabilityTest.php` passes.
- Feature tests: every transition of §6.1 with its writes and events, per actor; sub-tasks refuse `doing`; each filter, the combinations, the old values, the counters' independence from status and due; the bulk endpoints per actor and per refusal reason, the response shape, the events and broadcasts per item, the 50 limit, the unknown key; the "all matching" target (matching ids in order, the 500 cap, the changed count, `ids` with `filters`); the export's header, rows, order, filters, visibility, formula neutralisation, translation; the three-state tracker read (into progress, back to to do when the source is newer, a newer unpushed start pushed, reopening into progress, GitHub unchanged), the start push (configured target, automatic target, refusals, no push for source changes), the start settings (save, reset, validation, presentation); the search (text, ticket key, case, accents, with the other filters, the counters, the export and the "all matching" target, the canonical `q`); the sprints of the page (an item per sprint, between sprints, two teams, the current sprint of a team without a row in it, the states).
- Existing tests whose expectations change, each named in the plan: the two in-progress rows of "maps source states to done or open" (`IssueStatusReadsTest`, now `Started`), "only records the read when both sides agree" (`ApplyIssueChangesTest`, its input becomes a to-do issue; the in-progress case moves to a new test), "saves and resets a status mapping per project" (`StatusSyncSettingsTest`, the stored entry gains `startStatusId: null`).
- Races (`tests/Concurrency`, `Race`, on `pgsql` in this plan; `mariadb`, `mysql`, `sqlite-file` in the end-of-roadmap matrix): two bulk completions of the same recurring items at once create one next occurrence per item and both answer 200; a bulk deletion and a bulk update of the same items at once leave no row and answer 200 twice, never 500; two "all matching" completions of the same filters at once answer 200 or 422 (changed count), never 500, and leave one next occurrence per item.
- Upgrade (`tests/Upgrade`): rows written before the migration read `open` and `completed` after it; a link written before `external_key_search` is found by its key after it.
- Vitest: filter parsing and query building (old stored values included, `q`), the selection reducer (rows and "all matching"), the bulk client (ids and filters targets), the bulk bar's enabled actions per permission and mode, the confirmation and the changed-count answer, the status cycle with `withDoing`, the export URL, the "Start to" select, the grouping by sprint (order, labels, badges, counts, live rows, no sprint), the default grouping and its storage, the search field (debounce, Enter, Escape, ⌘K focus, the palette's ⌘K off on this page), the sidebar badge in words.
- A measurement (not an assertion) of a 500-item bulk completion on PostgreSQL, with queued listeners faked (§14, §16).
- No browser walkthrough is written, edited or run. Captures of §9.9 only.

## 13. Acceptance criteria

1. `PATCH …/action-items/{id}` with `status: doing` on an open item sets `started_at`, answers the item with `status: "doing"` and `startedAt`, broadcasts it and fires `ActionItemProgressChanged` once; with `status: open` on a started item it clears `started_at` and fires it once again; neither fires `ActionItemCompleted` or `ActionItemReopened`.
2. Completing a started item keeps `started_at`, sets `completed_at`, creates the next occurrence of a recurring item (which is `open`), and fires `ActionItemCompleted` once. Reopening a completed item to `open` clears both; to `doing` clears `completed_at` and leaves the item started; both fire `ActionItemReopened` once.
3. A guest assignee may start their item on the retro board; a member who may not complete an item gets 403 when starting it. Sub-tasks refuse `status: doing` with 422.
4. Every existing item reads `open` or `completed` after the migration, with its sort rank unchanged; the Upgrade test passes on PostgreSQL (the four engines in the end-of-roadmap matrix).
5. On a Jira or Linear link with sync on: a read of an issue in the in-progress category moves an open item to `doing` as the system, on a locked board too, queues no push, and the link reads `synced` with state `started`; a read of a to-do issue newer than skrum's last change moves a `doing` item to `open`; an unpushed start newer than the issue's change is kept and pushed; a source that reopens a completed item into an in-progress status leaves it `doing`. On a GitHub link a `doing` item and an open issue read `synced`, and nothing moves.
6. Starting or stopping a linked item in skrum queues a push for each synced link. The push moves a Jira issue to the configured start status of its project, else to the first transition of category `indeterminate`, and a Linear issue to the configured start state of its team, else to the first `started` state; it records `last_pushed_state: started`. A required field or no reachable target records the failed write with its sentence. A start or stop that came from the source queues nothing.
7. An owner or admin saves, then resets, a start status for a Jira project and a start state for a Linear team; a bad id answers 422; a member is refused as for the other status sync settings; the team integrations page presents `startStatusId` / `startStateId`; the panel shows "Start to" first and saves the chosen status.
8. `?status=todo` lists the open items not started, `?status=doing` the started ones, `?status=todo,doing,completed` every item; `?priority=high,low`, `?due=overdue|today|week|later|none` and `?source=retro|outside` narrow the list as §6.3 says, combined with each other and with team and assignee.
9. `?status=open`, `?status=overdue`, `?status=all` and `?status=completed` return the same items as before this plan; an unknown value falls back to the default; the `filters` prop is the canonical form (`status: ['todo','doing']`, `priority: []`, `due: null`, `source: null`, `q: null`).
10. The counters follow team, assignee, priority, source and the search, and do not change with status or due.
11. MCP `retro.actions.list` accepts `doing` and answers the same items for `open`, `overdue`, `completed` and `all` as before; its items carry `status: "doing"` when started.
12. A bulk update of items the viewer may change changes each, answers them all with `changedCount`, refuses none, and sends one `TeamActionItemSaved` per item; completing in bulk creates the next occurrences and fires one completion per item.
13. A bulk update mixing an item of a team the viewer cannot see, a deleted item, an item on a locked board, an item the viewer may not edit, and a recurring item asked to lose its due date changes the others and refuses each of these with its sentence; the invisible and the deleted item carry no title and the same sentence, so nothing about the invisible item leaks.
14. A bulk request with 51 ids, no change, an unknown change key (`content`), a bad value, both `ids` and `filters`, or `filters` without `count` answers 422 and changes nothing.
15. A bulk update or deletion with `filters` and the right `count` changes or deletes every visible matching item, in the page's order, refusing each one it may not change with its sentence and title, and answers `actionItems: []`; with a wrong `count` it answers 422 naming the number that matches now and changes nothing; with more than 500 matching items it answers 422 and changes nothing; a member's filters never reach the items of a team they cannot see.
16. Two bulk completions of the same recurring items at the same moment both answer 200 and leave one next occurrence per item; a bulk deletion and a bulk update of the same items at the same moment both answer 200 and leave no item; two "all matching" completions of the same filters at the same moment answer 200 or 422, never 500, and leave one next occurrence per item. Proved on PostgreSQL in this plan (MariaDB, MySQL and a SQLite file in the end-of-roadmap matrix).
17. A bulk deletion deletes the items the viewer may delete, refuses the others with their sentence, and announces each deletion.
18. The export answers a CSV whose header is in the viewer's language, with one row per visible item matching the filters across every page, in the page's order, the columns of §6.6, and no cell starting with `=`, `+`, `-` or `@`; a member does not receive the items of a team they cannot see; a user who is not a member of the workspace gets 403 (the `can:view,workspace` middleware of the group), on the export and on both bulk routes.
19. On the page from 80rem, a member selects rows (one by one, a group, the page), the bar shows "n selected" and the actions the selection allows, applies a status, an assignee, a due date and a priority, deletes after confirmation, and reads the partial-result toast with its details; the selection clears on a filter or page change and keeps the rows still listed after a partial result. (Vitest with mocked requests.)
20. With the page selected and more items than the page, "Select all :count matching" enters "all matching" mode; a change asks "Apply to :count action items?" and sends the filters and the count; a changed-count answer shows its sentence and sends the new count on "Apply"; unticking a row leaves the mode; a page change keeps it and a filter change clears it; "Sync to :tracker" is disabled in that mode; the offer is disabled above 500. (Vitest with mocked requests.)
21. Below 80rem, "Select" and a long press enter selection mode; the phone bar shows three actions and "…". (Vitest.)
22. "Sync to :tracker" is offered for a one-team selection of rows whose team has a writable tracker, exports the unlinked items one by one with progress, skips the linked ones, and stops on "reconnect required". (Vitest with mocked requests.)
23. The status badge, the ActionItem status button and the sheet's select show and set the three statuses, on the page, in the sheet, on the retro board and in the carried-items panel; the board's and the panel's open counts include started items.
24. Every new string exists in the four languages, informal in French, Spanish and German (`TranslationKeysTest`, `InformalRegisterTest`); the states of §9.9 are captured in light at 1440 in French without horizontal overflow and compared with ScreenActions, each difference fixed or a row of the plan's deviations.
25. The unit, feature, upgrade, arch and concurrency suites pass on PostgreSQL through `bin/test-db pgsql`; `tests/Arch/DatabasePortabilityTest.php` passes. (The four-engine matrix runs at the end of the roadmap, outside this plan.)
26. `?q=runbook` lists the visible items whose text contains "runbook" in any case, and `?q=proj-12` the items linked to `PROJ-12`; `?q=ete` does not find "été"; `q` combines with every other filter, narrows the counters, the CSV export and an "all matching" request (`filters.q`), never reaches a team the viewer cannot see, is cut at 100 characters, and an empty `q` is none (`filters.q` null). A link written before the new column is found by its key after the migration.
27. The page's `items.sprints` lists, latest first, each sprint holding a row of the page with the ids of its rows, and the current sprint of each team with a row on the page; an item created between two sprints is in none and is listed in `items.withoutSprint`; each sprint carries `current` or `finished`; a team the viewer cannot see brings no sprint.
28. "Group by" offers Sprint, Team, Assignee, None in that order, lands on Sprint, keeps a stored other choice, and "Reset" returns to Sprint; by sprint, the table and the list show one group per sprint in the order of `items.sprints` with the label (with the team's name when the page spans several teams), the badge, the counts of §9.3 and "No sprint" last; a live row not in `itemIds` goes to its team's current sprint; a page without any sprint shows no group row. (Vitest.)
29. On the actions page the topbar shows "Search an action item, a ticket…" with "⌘K"; typing applies `q` after 300 ms, Enter at once, Escape clears; ⌘K focuses the field and does not open the palette there, "/" still opens the palette; below 48rem the field is in the "Filters" drawer and the topbar keeps the palette's button; Reset clears the search; on every other page the topbar is unchanged. (Vitest.)
30. The sidebar's Actions entry reads "3 overdue" in its badge, "99+ overdue" above 99 with the full count for screen readers, nothing at zero, and keeps the dot when collapsed. (Vitest.)

## 14. Risks

- **A gesture that changes.** Clicking a "To do" status today completes the item; with the mockup's cycle it starts it, and completing takes a second click, on the board too. The sheet keeps a one-click "Mark as done"; the release note says it. If the owner prefers, the board can keep two states (a one-line change: `withDoing` off there).
- **Tracker sync over three states.** The conflict rules of `ApplyIssueChanges` are subtle; this plan does not change them, it widens the values they compare. Effects: a member who starts an item moves its Jira or Linear issue (a write the tracker's other users see); a workflow whose `indeterminate` statuses mean "blocked" or "in review" makes items read "In progress" (spec §16.5); a Jira workflow with no `new` transition from Done reopens into an in-progress status, so an item reopened in skrum comes back `doing` after the read. Each is tested.
- **The release.** An open item whose unpushed "to do" is newer than its issue's last change, while the issue sits in an in-progress status, has its issue moved back to its reopen target at the first read after the release (before, both read "open"). This needs a reopening whose push failed or is still queued; the release note says it.
- **More pushes.** Every start and stop of a linked item is now a push (one job per link, coalesced per link as today). A bulk start of 500 linked items queues up to 500 pushes per tracker; they are rate limited and retried as today.
- **Event volume.** A bulk change of 50 items sends 50 broadcasts per channel; an "all matching" change of 500 sends 500, plus up to 500 webhook deliveries (completions) and 500 tracker pushes. The page reload is coalesced; webhooks and pushes are queued per item as today. The 500 cap bounds it.
- **Request time.** A bulk request runs its items synchronously, each a small transaction (an item lock, a save and its listeners); completions of recurring items also create items. Octane stops a request at 30 seconds (`config/octane.php`). Fifty items are well within it; five hundred are not known (§16.4): Task 8 of the plan measures a 500-item completion on PostgreSQL. **Ruled (revision of 2026-10-03, so that nothing stops for the owner):** if the request takes more than 15 seconds (half of Octane's limit), the cap is lowered, not replaced by a queued job (a queued bulk change stays in the backlog, §3): the new cap is the largest multiple of 50 at or below `500 × 15 / measured seconds`, at least 50, set in `ActionItemBulkChanges::MatchingCap` and `MatchingCap` of the front, the measurement re-run at the new cap and both numbers written in the commit and the report. Every sentence names the cap through `:cap`, so no text changes. On SQLite each write queues behind the others (`docs/database.md`), still under the busy timeout per transaction, since each item is its own transaction.
- **"All matching" moves under the member's feet.** The set is counted when the member confirms; an item added or changed between the count and the request makes the counts differ, and the request is refused with the new number rather than applied to a set the member did not see. An item that stops matching while the loop runs (changed elsewhere) is still changed: it matched when counted. The count does not catch one case: completing "all matching" recurring items twice (two tabs) completes their next occurrences too, since they match the landing filter in the same number; the bar is disabled while its request runs, so one tab cannot do it.
- **The client-side tracker loop.** Exporting twelve items is twelve provider calls, one after the other, from the browser; leaving the page stops it halfway (what was exported stays exported and linked; the rest is not). The bar says so while it runs.
- **Old filters.** Stored entries and links carry `status=open|overdue|all`; the mapping of §6.3 is tested both on the server and in the front's landing.
- **Shared files with plans 21, 23 and 25.** Plans 21 (RT-8: a card reference on `action_items`, `cardId` in `PresentActionItem`; RT-10: the browser export loop `runBulkExport` and `ExportTargetFields`) and 23 (TM-3: open actions on the team page; TM-6: team roles in `ActionItemPermissions` and `SetActionItemStatus`; the sprints; the role line of `app-sidebar.tsx`) are merged before this plan, which builds on them: the bulk "Sync to :tracker" reuses plan 21's loop, the grouping reads plan 23's sprints. Plan 25 runs in parallel; it touches the onboarding, invitations and team settings, not the action items; whichever of 24 and 25 merges into `roadmap` second rebases (`lang/*.json`, `routes/web.php`, `tests/Pest.php`). Migration dates: plan 24 uses `2026_10_24_…`, after plan 23's `2026_10_23_…` and before plan 25's `2026_10_25_…`.
- **The search takes ⌘K on one page.** On the action items page ⌘K focuses the page's search, as the mockup's hint says; the palette opens there with "/" or from the shortcuts dialog. A member used to ⌘K for the palette meets the page's field instead on that page only; the keyboard shortcuts dialog is unchanged (its "Search" entry still names ⌘K, which still searches).
- **Near matches of a search.** A term with a LIKE wildcard character may list a near match (§6.3); the list, counters, export and "all matching" agree with each other.
- **Grouping by sprint is client side.** A sprint spread over two pages shows a group on each with that page's count, as the other groupings do (owner 5-D4).
- **Open points of the first revision, ruled 2026-10-03.** (1) With no start status configured the push goes to the first `indeterminate` Jira transition or the first `started` Linear state, as the complete and reopen defaults do: kept ("Automatic"). (2) "Both ways" includes a newer to-do change on the issue moving a started item back to "to do": kept, it is what decision 2 C means. (3) The release case of an unpushed reopening: documented in the release note, not mitigated. (4) A Jira workflow with no `new` transition out of Done reopens into progress: kept. (5) The 500 cap: ruled above ("Request time"). (6) "Sync to :tracker" is disabled in "all matching" mode (P24-06, P24-11, approved). (7) Two tabs completing "all matching" recurring items: named above, not mitigated.
- **MCP contract.** `retro.actions.list` gains an enum value and its items a `status` value, a `startedAt` key and a link state `started`; a client that switches on two statuses sees a third.

## 15. Decisions for the owner — answered 2026-10-03

The body above is written on the answers. "Recommended" marks the option the draft was written on.

**1. When a bulk change meets an item it cannot change.** — **Answered: A** (as recommended).
- A. **Recommended. Chosen.** Change every item that can be changed, refuse the others one by one with their reason, and say so in the toast with "Details". The single-item rules apply unchanged; a selection mixing teams or rights still does what it can.
- B. All or nothing: one refused item refuses the whole request (one transaction over every row, locked in id order). Simpler message, but a selection that includes one locked-board item or one item of another author does nothing at all.
- C. Pre-check: the bar disables an action as soon as one selected item would refuse it. No partial result, but the member must hunt for the item that blocks.

**2. "In progress" and the trackers (Jira, Linear, GitHub).** — **Answered: C** (differs from the recommendation; §5 rule 6, §6.2, §6.7).
- A. Skrum only: "In progress" is never read from nor pushed to a tracker; a started item is "open" for the sync. Smallest change; a linked item's status in skrum may lag behind the board the team actually works in.
- B. Recommended. Read only: an open linked item becomes "In progress" when its issue enters the tracker's in-progress category (Jira `indeterminate`, Linear `started`); skrum never pushes "in progress" and never moves a started item back to "to do". Follows the mockup's "the ticket's status is authoritative when linked" for the new state, without new settings; about one task.
- C. **Chosen.** Both ways: a configurable "start" status per Jira project and Linear team (beside today's complete and reopen targets), pushed when an item is started. Needs settings UI on the team integrations page and transition lookups; about four more tasks.

**3. "Sync to Jira" in the bulk bar.** — **Answered: A** (as recommended).
- A. **Recommended. Chosen.** The page exports the selected unlinked items one by one through the existing per-item export, after one target choice; offered for a selection of one team with a writable tracker; linked items skipped. No new back end; shares nothing with RT-10 (plan 21), which can reuse the front loop.
- B. A server batch: one request queues one export job per item and reports through the team channel. Survives leaving the page; needs a job, a failure report surface and a target per team; to be built once with RT-10 of plan 21, so plan 24 would wait for or build it.
- C. Leave the button out (deviation kept); export stays per item.

**4. The due-date buckets.** — **Answered: A** (as recommended).
- A. **Recommended. Chosen.** Overdue, Today, Next 7 days (today to today + 6), Later, No due date. Independent of the locale's first day of the week; "Overdue" is the same as the shortcut.
- B. Calendar weeks: Overdue, This week, Next week, Later, No due date. Reads better in a sprint rhythm; "this week" depends on the first day of the week, which differs between the four languages, and on the server's time zone.
- C. A date range picked in a calendar (from, to). Most flexible; a second control in a facet the mockup draws as a simple menu.

**5. What "Export" downloads.** — **Answered: A** (as recommended).
- A. **Recommended. Chosen.** A CSV of every item matching the current filters, every page, in the page's order, the columns of §6.6.
- B. A CSV of the current page only, or of the selection when there is one. Matches what is on screen; a list of 120 items needs three exports.
- C. A choice of CSV or Markdown (a checklist to paste in a wiki). One more format to keep translated and tested.

**6. How far a selection reaches.** — **Answered: B** (differs from the recommendation; §5 rule 7, §6.5, §9.3, §9.4).
- A. Recommended. The rows of the current page (50 at most); a filter, page or grouping change clears it; the bulk endpoints take 50 ids.
- B. **Chosen.** A "Select all n matching" link after selecting the page, which sends the filters instead of ids; the server applies the change to every matching item. Fits large clean-ups; needs a filter-based variant of each bulk endpoint, a cap, and a confirmation that names the count.

**7. Phone selection.** — **Answered: A** (as recommended).
- A. **Recommended. Chosen.** Long press (the mockup) and a visible "Select" button in the header, for keyboards and screen readers.
- B. Long press only, as drawn. A keyboard or screen-reader user below 80rem has no way into selection.

### Pre-build deviations — answered 2026-10-03

The plan's rows P24-01 to P24-12 (`docs/superpowers/plans/2026-10-21-plan-24-action-items.md`, "Pre-build deviations") were answered by the owner on 2026-10-03 (`progress.md`, line "P24"):

| Row | Answer | Where |
|---|---|---|
| P24-03 Grouping by sprint | **Add "By sprint" grouping, the default**; plan 24 now runs after plan 23 | §6.8, §9.3, §9.5, criteria 27, 28 |
| P24-07 Topbar search field | **Build the mockup's search field filtering action items** | §6.3 (`q`), §9.1, criteria 26, 29 |
| P24-08 Sidebar "Actions · 2 en retard" | **Words, as the mockup**; settles D-129 for this entry | §9.10, criterion 30 |
| P24-01, 02, 04, 05, 06, 09, 10, 11, 12 | Approved as listed | unchanged |

## 16. Not determined by reading

1. ~~Whether plan 21 or plan 23 is merged before this plan.~~ Settled 2026-10-03: both are (order 20, 21, 26, 27, 29 → 22 → 23 → 24 and 25). What remains unknown is only the exact code they left, which each task re-reads.
2. Whether `DatePicker` (`components/ui/calendar.tsx` behind the sheet's due date) can be opened from a menu button of the bulk bar without change; the sheet uses a native date input (plan 18e note on `action-sheet.tsx`).
3. Whether the MCP contract test (`mcpContractToolNames` and the schema snapshots under `tests/Feature/Mcp`) pins the enum of `retro.actions.list` and the item keys; if so it changes in the plan's Task 5 and Task 1.
4. How long a 500-item bulk completion takes on PostgreSQL with the listeners queued, against Octane's 30-second limit; Task 8 of the plan measures it and applies the rule of §14 ("Request time"). The 50-item races give a first number.
5. Whether Linear's `started` state type is what every Linear workspace uses for "In Progress" columns (custom workflows keep the type), and whether any team relies on Jira `indeterminate` statuses that mean "blocked" rather than "in progress". With option C this decides what skrum reads as started and where an automatic start push lands; the "Start to" setting answers the push side per project or team, not the read side.
6. Whether the visual harness can hold a selection state on the real page without a live socket (the bench section is used for that reason).
