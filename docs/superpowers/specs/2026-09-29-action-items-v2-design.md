# Skrum — Action items v2 — Design

Date: 2026-09-29
Status: Approved decisions, awaiting spec review
Parent spec: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (all its rules apply unless this spec changes them explicitly — see §10). Also builds on `docs/superpowers/specs/2026-09-29-board-engagement-design.md` (lock, broadcast conventions).
Research: `docs/superpowers/research/qretro/` (QRetro parity roadmap, spec 3 of 7; `docs-inventory.md` → "Action items", `research.md` → "Tasks drawer", `screens/retro-actions.png`)

## 1. Intent

Turn action items from a per-retro checklist into the team's follow-up list, on par with QRetro: each item has a priority, an optional due date with an overdue flag, an open/completed status, an assignee who is a team member (or a guest of that retro), and a comment thread. A workspace-wide "Action items" page lists every item of the teams the viewer can see, overdue first, with filters. Open items from earlier retros of the same team can be reviewed and completed during the next retro.

**Success:** every rule below is covered by a feature test or a step of the walkthrough; suite, phpstan, type-check and lint stay green; no new dependency.

### In scope

- New fields: priority, due date (+ derived overdue), status (via `completed_at`), team-member assignee, creator always shown (also on anonymous retros).
- Permission model for editing, completing, deleting and commenting (§4).
- Flat comments on action items.
- Global page `/w/{workspace}/action-items` with status / assignee / team filters, deep link to one item.
- Carry-over: a "Previous action items" panel on the board listing the team's open items from earlier retros, where they can be completed or updated.
- Realtime on the board for the retro's own items, carried items and item comments.
- Stable service classes that the MCP server (spec 5) and Jira/Linear export (spec 6) will reuse (§9).

### Out of scope (deferred)

- Creating an action item outside a retro (on the global page). Items are always born on a board.
- Email, Slack or in-app notifications about assignment, due dates or comments (spec 6 covers outbound integrations).
- Live updates on the global page (it refreshes on focus and after own mutations).
- A dedicated "Review" phase (see Decision 3), reminders, recurring items, sub-tasks, attachments, reactions or GIFs on items, threaded replies.
- Export to Jira/Linear, MCP tools (specs 6 and 5).
- Per-user time zones: "overdue" uses the instance time zone (§3).

### Dependencies

- None new. Date input uses the native `<input type="date">`; dates are formatted with `Intl.DateTimeFormat` in the active locale.
- Spec 2 (Retro flow extras) adds the optional phases `HealthCheck` and `Icebreaker` before `Writing`; the carry-over panel is phase-independent, so it needs no change for them. Spec 2's Results view replaces `completed-summary.tsx` (§8), and its suggested-action promotion creates items through `CreateActionItem` with a theme reference (§2, §3).

## 2. Data model

### `action_items` — changes (migration `add_v2_columns_to_action_items_table`, up only)

| Column | Type / default | Meaning |
|---|---|---|
| `team_id` | `foreignUuid` → `teams`, cascade on delete | Denormalized from the retro, for team-wide queries. Backfilled from `retros.team_id`. |
| `priority` | string, default `medium` | Enum `ActionItemPriority`: `High` = `high`, `Medium` = `medium`, `Low` = `low`. Method `sortWeight()` (high 0, medium 1, low 2) and `label()` (translated). |
| `due_on` | nullable `date` | Due date, no time part. |
| `completed_at` | nullable timestamp | Status: `null` = open, set = completed. Replaces `is_done`. |
| `assignee_user_id` | nullable `foreignUuid` → `users`, null on delete | Assignee when it is a member (user). |
| `assignee_participant_id` | existing, nullable | Now only used when the assignee is a **guest** participant of the item's own retro. |
| `theme_id` | nullable `foreignUuid` → `retro_themes` (spec 2 §3), null on delete | Theme the item was promoted from (spec 2 §6.5). Set only by a promotion, never client-writable. |

- Backfill, in the same migration: `completed_at = updated_at` where `is_done`; for rows whose `assignee_participant_id` points to a participant with a `user_id`, set `assignee_user_id` to it and clear `assignee_participant_id`. Then drop `is_done`.
- Check constraint: `assignee_user_id` and `assignee_participant_id` are never both non-null.
- Indexes: (`team_id`, `completed_at`, `due_on`), (`assignee_user_id`, `completed_at`). The existing `retro_id` index stays.
- `created_by_participant_id` is unchanged. The item's **author** is that participant; for a member, the author is also matched by `participant.user_id` when acting outside the board.
- Model: `ActionItem` gains `team()`, `assigneeUser()`, `comments()`, `theme()`, casts (`priority` → enum, `due_on` → `date`, `completed_at` → `datetime`), helpers `isCompleted()`, `isOverdue(CarbonInterface $today)`. `Team` gains `actionItems()`.
- Factory states: `completed()`, `overdue()`, `assignedTo(User)`, `assignedToGuest(Participant)`, `priority(ActionItemPriority)`.

### `action_item_comments` — new table

- `id` (UUID), `action_item_id` (cascade on delete), `author_participant_id` (nullable FK → `participants`, null on delete), `author_user_id` (nullable FK → `users`, null on delete), `content` (text, 1–500 characters), timestamps.
- Exactly one author reference is set at creation: `author_participant_id` when written from the item's board (member or guest), `author_user_id` when written from the global page or the carry-over panel (a member, who may not be a participant of the item's retro). Check constraint: not both null at insert (they may both become null later through deletions; the comment then shows "Former member").
- Flat list (no replies), oldest first.

## 3. Rules

### Fields and validation

- `content`: required, 1–500 characters (unchanged).
- `priority`: one of `high`, `medium`, `low`; defaults to `medium` on create.
- `due_on`: nullable, `date_format:Y-m-d`, between `2000-01-01` and `2100-12-31`. Past dates are accepted (an old item may be dated retroactively); there is no "not in the past" rule.
- **Overdue**: `completed_at` is null **and** `due_on` < today, where today is the current date in `config('app.timezone')` (the instance time zone, `APP_TIMEZONE`, default UTC). Computed server-side and returned as `isOverdue`; `.env.example` documents that `APP_TIMEZONE` drives it.
- `status`: `open` | `completed`. Completing sets `completed_at = now()`; reopening clears it. Setting the current status again is a no-op (idempotent, still 200).

### Assignee

- An item is unassigned, assigned to a **member** (`assignee_user_id`), or assigned to a **guest** (`assignee_participant_id`).
- Request fields `assignee_user_id` and `assignee_participant_id` are mutually exclusive (both present and non-null → 422).
- `assignee_user_id` must be a current member of the item's team (`team_user`). The workspace Owner/Admin who is not a team member cannot be assigned.
- `assignee_participant_id` (board endpoints only) must be a participant of the item's own retro. A member participant is normalized: its `user_id` is stored in `assignee_user_id` instead. Only guest participants end up in `assignee_participant_id`. The workspace endpoints reject `assignee_participant_id` (422): a guest can be assigned only from their own board.
- When an assigned member later leaves the team, the item keeps them as assignee; payloads flag `assignee.isTeamMember: false` and the UI shows "(not in team)". The assignee select then lists current members plus the current assignee.
- When the assigned user is deleted, the item becomes unassigned (null on delete).
- Guest-assigned items appear on the global page as "Name (guest)". Members allowed to edit can reassign them to a team member; they cannot assign another guest from there.

### Carry-over (which items the next retro sees)

For a retro R of team T, **carried items** are the action items of T whose retro is not R and was created before R (`retros.created_at < R.created_at`), and which are either open, or were completed at or after `R.created_at` (so an item completed during the review stays visible, struck through, instead of vanishing). Ordered like the global page (§6), capped at 200; when more exist the panel shows "View all on the action items page".

### Where items can be changed

| Surface | Items | Phase / lock rule |
|---|---|---|
| Board endpoints `/retros/{retro}/action-items…` | the retro's own items | Create, edit, complete, delete, comment only in `Discussing` (unchanged); 423 when locked. `Completed` board is read-only (unchanged). |
| Workspace endpoints `/w/{workspace}/action-items…` (global page and carry-over panel) | any item of a team the user can view | No phase rule. 423 when the item's retro is locked **and** not `Completed` (the board is frozen mid-meeting). |

Guests have no access to workspace endpoints (they are not authenticated users of the workspace), so a guest acts only on their own retro's items, only in `Discussing`.

**Promotion exception (spec 2 §6.5):** promoting a suggested action calls `CreateActionItem` with the suggestion's content and `theme_id`, in `Discussing` (same lock rule as the board) or in `Completed` (facilitator and workspace Owners/Admins only, lock ignored). This is the only way an item is created in a `Completed` retro.

## 4. Permissions

Model (Decision 2): QRetro parity — the author, the facilitator and workspace Owners/Admins edit and delete; the assignee completes; the facilitator can do everything during the meeting.

Let the **managers** of an item be: its author (the creating participant; for members also any request by the same user), the facilitator of the item's retro, and workspace Owners/Admins.

| Action | Allowed for |
|---|---|
| Create | Any participant of the retro, on the board, in `Discussing`; promotions per §3 |
| Edit content, priority, due date, assignee | Managers |
| Delete | Managers |
| Complete / reopen | Managers, the assignee (member: same user; guest: same participant), and the facilitator of any retro of the same team that is not `Completed` (the "review facilitator") |
| Read | Participants of the item's retro (board); users who can view the item's team (global page, carry-over panel). Guests never see carried items (Decision 4). |
| Comment | Anyone who can read the item on that surface |
| Edit own comment | Its author |
| Delete comment | Its author and the item's managers |

- Board endpoints resolve the acting participant (`Participant::current`); workspace endpoints use the authenticated user. Both call one class, `App\Actions\ActionItems\ActionItemPermissions`, with `canEdit`, `canComplete`, `canDelete`, `canComment` taking an `ActionItemActor` value object (`?User $user`, `?Participant $participant`). The workspace endpoints additionally require `Gate::authorize('view', $item->team)` and `$item->team->workspace_id === $workspace->id` (404 otherwise, via scoped binding).
- Denied → 403 with a translated message ("Only the author, the facilitator or an admin can change this action item." / "Only the assignee or a manager can complete this action item.").
- This replaces parent AC30's "any participant can … edit, complete and delete" (see §10).

## 5. Endpoints and events

### Board endpoints (participant resolved per request; JSON)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/retros/{retro}/action-items` | `{content, priority?, due_on?, assignee_user_id? \| assignee_participant_id?}` | 201 `{actionItem}` |
| PATCH | `/retros/{retro}/action-items/{actionItem}` | any of `content, priority, due_on, assignee_user_id, assignee_participant_id, status` | 200 `{actionItem}` |
| DELETE | `/retros/{retro}/action-items/{actionItem}` | — | 204 |
| GET | `/retros/{retro}/action-items/{actionItem}/comments` | — | `{comments: CommentPayload[]}` |
| POST | `/retros/{retro}/action-items/{actionItem}/comments` | `{content}` | 201 `{comment}` |
| PATCH | `/retros/{retro}/action-item-comments/{comment}` | `{content}` | 200 `{comment}` |
| DELETE | `/retros/{retro}/action-item-comments/{comment}` | — | 204 |

`is_done` is no longer accepted (replaced by `status`). The board's `assignee_user_id` must be a member of the retro's team; `assignee_participant_id` a participant of this retro. The GET comments endpoint is allowed in every phase (read); writes follow §3.

### Workspace endpoints (`auth`, `verified`, `can:view,workspace`)

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/w/{workspace}/action-items` | `status=open\|overdue\|completed\|all` (default `open`), `assignee=me\|unassigned\|{userId}`, `team={teamId}`, `item={actionItemId}`, `page` | Inertia page `action-items/index` |
| PATCH | `/w/{workspace}/action-items/{actionItem}` | any of `content, priority, due_on, assignee_user_id, status` | 200 `{actionItem}` |
| DELETE | `/w/{workspace}/action-items/{actionItem}` | — | 204 |
| GET | `/w/{workspace}/action-items/{actionItem}/comments` | — | `{comments}` |
| POST | `/w/{workspace}/action-items/{actionItem}/comments` | `{content}` | 201 `{comment}` |
| PATCH | `/w/{workspace}/action-item-comments/{comment}` | `{content}` | 200 `{comment}` |
| DELETE | `/w/{workspace}/action-item-comments/{comment}` | — | 204 |

- Controllers: `App\Http\Controllers\WorkspaceActionItemsController` (`index`, `update`, `destroy`), `WorkspaceActionItemCommentsController` (`index`, `store`, `update`, `destroy`), `App\Http\Controllers\Retros\ActionItemCommentsController` (same four). Routes named `workspaces.actionItems.*`, `workspaces.actionItemComments.*`, `retros.action-items.comments.*` following the existing naming in `routes/web.php`.
- Unknown filter values → ignored (default applied), not 422. `team` of a team the user cannot view → ignored. `item` of an item the user cannot see → ignored.
- Pagination: 50 per page (length-aware paginator).

### Presenting an item (`PresentActionItem`, extended)

```
{
  id, retroId, teamId, content, priority, dueOn: 'YYYY-MM-DD'|null, isOverdue,
  status: 'open'|'completed', completedAt,
  assignee: {kind: 'member'|'guest', id, name, avatarUrl, isTeamMember} | null,
  createdBy: {name, avatarUrl} | null,     // always present, even on anonymous retros (Decision 5); null only if the author is unknown
  isMine: bool,                            // viewer is the author
  commentCount,
  source: {retroTitle, retroCreatedAt, retroUrl|null},  // retroUrl null for viewers who cannot open the retro
  themeId: uuid|null, themeName: string|null,          // spec 2 theme the item was promoted from
  createdAt
}
```

- `assignee.id` is the user id (`member`) or participant id (`guest`).
- Broadcast payloads always carry `isMine: false`; clients keep their known `isMine` for existing items (same pattern as `mine` on reactions).
- The client derives permissions from `isMine`, `viewer.canManageActionItems` (facilitator or workspace Owner/Admin; new snapshot/page field), `viewer.isReviewFacilitator` (carried items), and whether the assignee is the viewer (`viewer.userId` / `viewer.participantId`). The server stays the authority.

### Comment payload

`{id, actionItemId, content, author: {name, avatarUrl} | null, isMine, createdAt, updatedAt}`. `author` is always present, even on items of anonymous retros (Decision 5); it shows "Former member" when both author references are gone.

### Broadcast events (via `RetroBroadcastEvent`: after commit, `toOthers()`, report-don't-throw)

| Event | Channel | Payload | When |
|---|---|---|---|
| `action-item.saved` (existing, new shape) | `presence-retro.{itemRetroId}` | `{actionItem}` | Any create/update of an item, from either surface, while its retro is not `Completed` |
| `action-item.deleted` (existing) | `presence-retro.{itemRetroId}` | `{actionItemId}` | Delete, same condition |
| `action-item.comments.changed` | `presence-retro.{itemRetroId}` | `{actionItemId, commentCount}` | Comment created/updated/deleted, same condition |
| `carried-action-item.saved` | `private-retro-members.{retroId}` | `{actionItem}` | For each other retro of the same team that is not `Completed` and for which the item is carried (§3) |
| `carried-action-item.removed` | `private-retro-members.{retroId}` | `{actionItemId}` | Item deleted, or no longer carried |
| `carried-action-item.comments.changed` | `private-retro-members.{retroId}` | `{actionItemId, commentCount}` | Comment change on a carried item |

- New private channel `retro-members.{retroId}`: `BroadcastAuthorizationsController` authorizes it only for a resolved participant of that retro who is **not** a guest. Guests are on the presence channel, so carried items never travel there.
- Clients with an open comment thread refetch it on `*.comments.changed`; others update the count.
- Fan-out is bounded by the number of in-progress retros of one team; one class `BroadcastActionItemChange` computes the target retros and dispatches.
- Workspace-endpoint mutations also use `toOthers()`: when called from a board's carry-over panel the request carries the `X-Socket-ID` header and the sender is excluded; from the global page there is no socket, so every board receives the event.

### Snapshot additions (`BuildBoardSnapshot`)

- `actionItems`: new shape; ordered by `created_at` (unchanged order on the board).
- `carriedActionItems`: presented carried items (§3) for non-guest viewers; `[]` for guests. Loaded with a constant number of queries.
- `viewer.userId` (null for guests), `viewer.canManageActionItems`, `viewer.isReviewFacilitator`.
- `teamMembers`: `[{id, name, avatarUrl}]` of the retro's team, for the assignee select. Guests receive it too (they can assign on the board), without emails.
- `links.actionItems`: global page URL filtered to the team (`null` for guests).

## 6. Global page ordering and filters

- Scope: items of teams in `{workspace}` that the user can view (`TeamPolicy::view`: team members; Owners/Admins see all teams).
- Order: open before completed; among open: overdue first, then by `due_on` ascending (nulls last), then priority (high → low), then `created_at` descending. Among completed: `completed_at` descending.
- `status=overdue` = open and overdue. `assignee=me` matches `assignee_user_id = user`. `assignee=unassigned` matches both assignee columns null.
- Default query: `status=open`, all teams, any assignee. The page remembers the last filters in `localStorage` (`skrum.actionItemFilters.{workspaceId}`) and applies them when opened without a query string (e.g. from the sidebar).
- Query in one class `App\Actions\ActionItems\ActionItemQuery` (`forUser(User, Workspace, ActionItemFilters)`), eager-loading team, retro, author and assignee — constant query count per page.

## 7. Redaction and privacy

- Action items and action-item comments are **always named**, including on anonymous retros (`is_anonymous`): creator, comment authors and assignee are shown to everyone who can read the item, on every surface, including snapshots, responses, broadcasts and the global page (Decision 5). Anonymity of cards and card comments (other specs) is unchanged.
- Because of that, the action-item create form and comment box show a notice on anonymous retros so nobody is surprised (§8).
- Guests: see only their own retro's items and comments; never carried items (neither in the snapshot nor on any channel they can join); never team member emails.
- Global page and carry-over only show items of teams the user can view; a Member removed from a team loses access to its items immediately.
- `source.retroUrl` is set only if the viewer may open the retro (team view permission).
- Deleting a retro deletes its action items and their comments (cascade, unchanged; Decision 6). The delete-retro dialog shows "This also deletes N open action items." when N > 0.
- No change to vote or card redaction.

## 8. UI

All new strings in `lang/{en,fr,es,de}.json`, including "Action items are not anonymous: your name is shown." and "This also deletes N open action items.".

### Board action item panel (`action-items-panel.tsx`, `Discussing`)

- Create form: content, priority select (icons: arrow-up red High, circle amber Medium, arrow-down slate Low), due date input, assignee select grouped "In this retro" (participants; guests suffixed "(guest)") and "Team" (members not in the retro).
- Item card, as in `screens/retro-actions.png`: creator avatar + name (always shown), content, complete toggle, priority select, assignee select, due date chip ("Due 3 Oct", red "Overdue" badge when `isOverdue`), edit (pencil opens inline edit) and delete buttons, comment button with count opening an inline flat thread (list + textarea, edit/delete own; delete for managers).
- On anonymous retros (`is_anonymous`), the create form and the comment box show the notice "Action items are not anonymous: your name is shown." (translated, above the input; not shown on named retros).
- Controls the viewer may not use are hidden (edit/delete) or disabled (complete), per §4.

### Carry-over panel (new `carried-action-items-panel.tsx`)

- Header button "Previous action items (n)" (n = open carried items), shown to non-guest participants in every phase except `Completed`, when the list is not empty.
- Opens a side sheet listing carried items grouped by source retro (title + date, newest retro first; items inside ordered as §6), with the same item card (complete, edit fields, comments) through the workspace endpoints.
- Opens automatically once per viewer and retro, on first load while the phase is `Writing` (`localStorage` `skrum.carriedSeen.{retroId}`), so the review happens at the start.
- Footer link "Open the action items page".

### Results view — action items (spec 2 §6.2, which replaces `completed-summary.tsx`)

- Lists the retro's items with priority, due date, overdue badge, assignee, status and theme name when set (read-only), plus link "View the team's action items" (members only).

### Global page (`resources/js/pages/action-items/index.tsx`)

- Sidebar entry "Action items" (all roles) below "Teams".
- Filter bar: status (Open / Overdue / Completed / All), assignee (Anyone / Me / Unassigned / member list of visible teams), team (All teams / each visible team). Filters are query-string driven (Inertia visits with `preserveState`).
- Rows: complete toggle, content, priority, due date + overdue badge, assignee avatar/name ("(guest)", "(not in team)"), team name, source retro link and date, creator, comment count. Clicking a row expands its comments and an edit form (per permissions).
- `?item={id}` scrolls to and expands that item (deep link used later by MCP and integrations).
- Refreshes via Inertia partial reload on window focus and after each own mutation.
- Empty states: "No open action items." / "Nothing matches these filters."
- Team page (`teams/show.tsx`) gains "Open action items (n)" linking to the global page filtered by that team.

## 9. Future hooks (not built here)

- **MCP (spec 5)**: tools `retro.actions.list/create/update/complete`, `retro.board.actions.list` map onto `ActionItemQuery`, `ActionItemPermissions`, and new single-purpose actions `CreateActionItem`, `UpdateActionItem`, `SetActionItemStatus`, `DeleteActionItem`, `AddActionItemComment` in `app/Actions/ActionItems/`. Controllers must call these actions (no logic in controllers) so MCP reuses the same validation, permissions and broadcasts. `ActionItemActor` already accepts a user without a participant. `CreateActionItem` also serves spec 2's promotion (§3), with an optional `theme_id`.
- **Jira/Linear export (spec 6)**: adds its own table `action_item_external_links` and `PresentActionItem.externalLinks` (spec 6 §3, §7); nothing is reserved here. The deep link `?item=` and `PresentActionItem` give a stable URL and payload for the issue body.
- **Notifications**: `SetActionItemStatus` and `UpdateActionItem` dispatch plain Laravel events `ActionItemAssigned`, `ActionItemCompleted` (non-broadcast, no listeners) for a later integration to subscribe to; spec 6 leaves them unsubscribed (event notifications are deferred there).

## 10. Changes to the parent spec

- Parent AC30 ("any participant can create, edit, complete and delete action items and assign them to a participant") becomes: any participant creates in `Discussing`; edit/delete/complete follow §4; assignees are team members or guests of the retro (§3). The parent spec gets a note pointing here, as for the vote-totals change.
- Parent "Out of scope: action-item carry-over across retros" is delivered by this spec.
- Parent AC16 ("Completed retros are read-only"): besides spec 2's exceptions, the workspace endpoints (§3) change items of a `Completed` retro; the board stays read-only.

## 11. Error handling

- 403 permission / phase → translated message, optimistic change rolled back + toast (existing pattern).
- 404 item or comment deleted concurrently → removed locally; on the global page, the row disappears after reload.
- 422 validation (content length, priority, date, assignee not in team, both assignee fields) → inline field error.
- 423 locked retro → toast "The board is closed for editing." (board and carry-over panel).
- Workspace endpoint called for an item of another workspace or a team the user cannot view → 404 (no existence leak).

## 12. Testing

Pest feature tests in `tests/Feature/Retros/ActionItemsTest.php` (extended), new `tests/Feature/ActionItems/*`. `Carbon::setTestNow` for overdue; `Event::fake()` for broadcasts.

- **Migration backfill**: `is_done` → `completed_at`; member participant assignee → `assignee_user_id`; guest stays in `assignee_participant_id`; `team_id` set.
- **Fields**: priority default and enum validation; `due_on` format and range; `isOverdue` true only when open and before today in `APP_TIMEZONE`, false on the due day and once completed; status toggle idempotent.
- **Assignee**: member id must be a team member; participant id must be of this retro and is normalized for members; both fields → 422; workspace endpoints reject `assignee_participant_id`; member leaving team → `isTeamMember: false`; user deleted → unassigned.
- **Permissions matrix** (board and workspace): author, facilitator, workspace Owner/Admin, assignee (member, guest), review facilitator, other member, other guest × edit / complete / delete / comment / delete comment.
- **Surfaces**: board rules unchanged for phases (create only in `Discussing`, `Completed` read-only); workspace endpoints work in any phase; 423 when the item's retro is locked and not `Completed`; guests get 401/403 on workspace endpoints; 404 across workspaces and for teams the user cannot view.
- **Carry-over**: included = earlier retros of the same team, open or completed since R started; excluded = own retro, later retros, other teams, items completed before R; cap 200; guests get `[]`.
- **Broadcasts**: board and workspace mutations send `action-item.saved/deleted` to the item's retro only when not `Completed`; carried events go to `private-retro-members.*` of each in-progress carrying retro and never to a presence channel; channel auth refuses guests on `retro-members.*`; broadcast payloads carry `isMine: false`.
- **Anonymity**: on anonymous retros `createdBy` and comment `author` are present (named) for every viewer in snapshot, responses, broadcasts (`action-item.saved`, `carried-action-item.saved`) and the global page; the create form and comment box render the "Action items are not anonymous" notice on anonymous retros and not on named ones.
- **Global page**: ordering; each filter; default `status=open`; unknown values ignored; `item` deep link; constant query count; Members see only their teams, Owners/Admins all teams.
- **Comments**: create/edit/delete with validation (1–500); author-only edit; manager delete; from board (participant author) and workspace (user author); count in payloads; cascade on item deletion.
- **Retro deletion** removes its items and comments.
- **Theme**: `theme_id` is ignored when sent to any board or workspace endpoint; `themeId`/`themeName` are presented when set and become `null` when the theme is deleted (promotion itself is tested in spec 2).
- **Walkthrough** (two browsers, a member and a guest): create items with priority, due date (one overdue), member and guest assignees; guest completes their own item; complete retro; start a new retro of the same team → panel opens in `Writing`, member completes a carried item and the other member's panel updates live, guest sees no panel; global page filters, deep link, reassign the guest item to a member; on an anonymous retro the notice shows and creators and comment authors are named.

Type-check and lint stay green; no frontend test runner is added.

## 13. Acceptance criteria

1. Action items have priority (default Medium), optional due date, open/completed status and an overdue flag computed in the instance time zone (§3).
2. Assignees are team members or guests of the item's own retro, with the normalization and restrictions in §3; existing data is migrated without loss.
3. Edit, delete, complete and comment rights follow §4 on every surface; everything else is rejected with 403.
4. Board endpoints keep their phase and lock rules; workspace endpoints ignore phases and return 423 only for locked, not-completed retros.
5. `/w/{workspace}/action-items` lists exactly the items of teams the user can view, ordered and filtered as in §6, with a working `?item=` deep link.
6. A new retro shows its team's carried items (§3) to members in the "Previous action items" panel, opening once automatically in `Writing`; guests never receive carried items in any snapshot or broadcast.
7. Changes to items and item comments reach open boards in realtime through the events in §5.
8. Item creators and comment authors are always named, including on anonymous retros, in payloads and broadcasts; on anonymous retros the create form and comment box show the translated notice "Action items are not anonymous: your name is shown." (§7, §8).
9. All new strings are translated in en/fr/es/de.
10. Suite, phpstan, type-check and lint are green; walkthrough passes.

## Decisions (2026-09-29)

1. **Assignee identity:** a team member (user) or a guest participant of the item's retro.
2. **Permissions:** QRetro model — author, facilitator and workspace Owners/Admins edit/delete; the assignee can complete; the facilitator can do everything during the meeting.
3. **Carry-over form:** phase-independent "Previous action items" panel, auto-opened in `Writing`; no new phase.
4. **Guests and carried items:** carried items from previous retros are hidden from guests.
5. **Anonymity:** action items and action-item comments are always named, even on anonymous retros (deliberately not the recommendation); the create form and comment box show a notice on anonymous retros. Card and card-comment anonymity is unchanged.
6. **Retro deletion:** cascade, with a warning showing the open item count.
7. **Global page scope:** workspace-wide page with a team filter.
