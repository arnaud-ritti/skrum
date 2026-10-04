# Skrum — Action items v2 — Design

Date: 2026-09-29
Status: Approved decisions, awaiting spec review
Parent spec: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (all its rules apply unless this spec changes them explicitly — see §10). Also builds on `docs/superpowers/specs/2026-09-29-board-engagement-design.md` (lock, broadcast conventions).
Research: `docs/superpowers/research/qretro/` (QRetro parity roadmap, spec 3 of 8; `docs-inventory.md` → "Action items", `research.md` → "Tasks drawer", `screens/retro-actions.png`)

## 1. Intent

Turn action items from a per-retro checklist into the team's follow-up list, on par with QRetro: each item has a priority, an optional due date with an overdue flag, an open/completed status, an assignee who is a team member (or a guest of that retro), and a comment thread. A workspace-wide "Action items" page lists every item of the teams the viewer can see, overdue first, with filters, updates live, and lets team members add items outside a retro. Open items from earlier retros of the same team (and items added outside a retro) can be reviewed and completed during the next retro. Assignees get due-date reminders by email and in the app; items can recur and carry a one-level checklist of sub-tasks.

**Success:** every rule below is covered by a feature test or a step of the walkthrough; suite, phpstan, type-check and lint stay green; no new dependency.

### In scope

- New fields: priority, due date (+ derived overdue), status (via `completed_at`), team-member assignee, creator always shown (also on anonymous retros).
- Permission model for editing, completing, deleting and commenting (§4).
- Flat comments on action items.
- Global page `/w/{workspace}/action-items` with status / assignee / team filters, deep link to one item.
- Carry-over: a "Previous action items" panel on the board listing the team's open items from earlier retros, where they can be completed or updated.
- Realtime on the board for the retro's own items, carried items and item comments.
- Stable service classes that the MCP server (spec 5) and Jira/Linear export (spec 6) will reuse (§9).
- *(Scope additions, Decision 8)* Creating items outside a retro on the global page, attached to a team only (§3.1).
- Live updates on the global page through a members-only channel per team (§5).
- Due-date reminders (due soon, overdue) to member assignees by email and in-app, with a notification bell, per-user opt-out, a scheduled command and translated emails (§3.4).
- Recurring items (completion-based regeneration) and one level of sub-tasks (§3.2, §3.3).
- `action_items.theme_name`: a copy of the theme name written at promotion (§2).

### Out of scope (deferred)

- Notifications about assignment, completion or comments (email, in-app or Slack); only due-date reminders are built (§3.4). Slack/Telegram reminders and assignment notifications are deferred by spec 6 too; spec 8 sends created/completed/reopened events to generic webhooks only (spec 8 §4.7).
- Reminders to guests (no account), push/browser notifications, a realtime notification badge (the bell count refreshes on navigation and focus).
- Fixed-calendar recurrence ("every Monday" independent of completion), custom intervals, nested sub-tasks (more than one level), assigning or dating sub-tasks.
- A dedicated "Review" phase (see Decision 3), attachments, reactions or GIFs on items, threaded replies.
- Export to Jira/Linear, MCP tools (specs 6 and 5).
- Per-user time zones: "overdue" uses the instance time zone (§3).

### Dependencies

- None new. Date input uses the native `<input type="date">`; dates are formatted with `Intl.DateTimeFormat` in the active locale.
- Laravel notifications (`mail`, `database` channels, framework) with the `notifications` table (`php artisan make:notifications-table`, adjusted to a UUID `notifiable` morph per parent spec AC0); the queue worker and scheduler services already supervised by s6 (`docker/s6-rc.d/queue`, `docker/s6-rc.d/scheduler`); the existing mailer config (`MAIL_MAILER`).
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
| `theme_id` | nullable `foreignUuid` → `retro_themes` (spec 2 §3), null on delete | Theme the item was promoted from (spec 2 §6.5). Set only by a promotion, never client-writable. Stays `null` after the theme is deleted or regenerated. |
| `theme_name` | nullable string (≤ 80, spec 2 `retro_themes.name`) | Copy of the theme's name, written by `CreateActionItem` whenever a `theme_id` is given (spec 2 `PromoteSuggestedAction`). Never client-writable; survives theme deletion. |
| `retro_id` | existing → **nullable** (still cascade on delete) | `null` = item added outside a retro (§3.1). `team_id` stays required. |
| `created_by_participant_id` | existing → **nullable**, null on delete (was cascade) | Author when created on a board. `null` for items added outside a retro. |
| `created_by_user_id` | nullable `foreignUuid` → `users`, null on delete | Author's user whenever the author is a member (board or workspace). Backfilled from `participants.user_id` of `created_by_participant_id`. |
| `recurrence` | nullable string | Enum `ActionItemRecurrence`: `Weekly` = `weekly`, `EveryTwoWeeks` = `every_two_weeks`, `Monthly` = `monthly`; method `advance(CarbonInterface): CarbonInterface`, `label()`. `null` = not recurring (§3.2). |
| `previous_occurrence_id` | nullable `foreignUuid` → `action_items`, null on delete, **unique** | The completed occurrence this item was generated from (§3.2). The unique index guarantees one successor per occurrence. |

- Backfill, in the same migration: `completed_at = updated_at` where `is_done`; for rows whose `assignee_participant_id` points to a participant with a `user_id`, set `assignee_user_id` to it and clear `assignee_participant_id`. Then drop `is_done`.
- Check constraints: `assignee_user_id` and `assignee_participant_id` are never both non-null; `retro_id IS NOT NULL OR assignee_participant_id IS NULL` (a guest assignee needs a retro); `recurrence IS NULL OR due_on IS NOT NULL`.
- Indexes: (`team_id`, `completed_at`, `due_on`), (`assignee_user_id`, `completed_at`), (`completed_at`, `due_on`) for the reminder scan. The existing `retro_id` index stays.
- The item's **author** is `created_by_participant_id` (board) and/or `created_by_user_id` (member). A request "is by the author" when its participant equals `created_by_participant_id` or its user equals `created_by_user_id`. Items added outside a retro have only `created_by_user_id`; if that user is deleted, `createdBy` is `null` ("Former member").
- Model: `ActionItem` gains `team()`, `author()` (user), `assigneeUser()`, `comments()`, `subtasks()` (ordered by `position`), `theme()`, `previousOccurrence()`, `nextOccurrence()` (has one by `previous_occurrence_id`), casts (`priority` → enum, `recurrence` → enum, `due_on` → `date`, `completed_at` → `datetime`), helpers `isCompleted()`, `isOverdue(CarbonInterface $today)`, `hasRetro()`. `Team` gains `actionItems()`. `retro()` becomes nullable.
- Factory states: `completed()`, `overdue()`, `assignedTo(User)`, `assignedToGuest(Participant)`, `priority(ActionItemPriority)`, `withoutRetro(Team, User)`, `recurring(ActionItemRecurrence)`, `withSubtasks(int)`.

### `action_item_subtasks` — new table

- `id` (UUID), `action_item_id` (cascade on delete), `content` (string, 1–200 characters), `position` (unsigned int), `completed_at` (nullable timestamp), timestamps. Index (`action_item_id`, `position`).
- One level only (no `parent_id`), at most 20 per item. Model `ActionItemSubtask`, factory state `completed()`.

### `action_item_reminders` — new table (reminder log, §3.4)

- `id` (UUID), `action_item_id` (cascade on delete), `user_id` (cascade on delete), `kind` (string: `due_soon`, `overdue`), `due_on` (date: the due date the reminder was about), `sent_at` (timestamp).
- Unique (`action_item_id`, `user_id`, `kind`, `due_on`): a reminder is sent once per item, assignee, kind and due date; moving the due date or reassigning makes the item eligible again.

### `notifications` — new table (Laravel database notifications)

- Framework schema with UUID `id`, `uuidMorphs('notifiable')` and a `json` (not `text`) `data` column, so reminders can be matched by `data->actionItemId` (mark read, §3.4). Only `ActionItemReminderNotification` writes to it; its `data` is `{kind: 'due_soon'|'overdue', actionItemId, workspaceId, dueOn}` — **no item content**: text is loaded live, with the permission check, when the list is read (§3.4).

### `users` — new columns (migration `add_notification_preferences_to_users_table`, up only)

- `action_item_reminders_by_email` boolean, default `true`.
- `action_item_reminders_in_app` boolean, default `true`.

### `action_item_comments` — new table

- `id` (UUID), `action_item_id` (cascade on delete), `author_participant_id` (nullable FK → `participants`, null on delete), `author_user_id` (nullable FK → `users`, null on delete), `content` (text, 1–500 characters), timestamps.
- Exactly one author reference is set at creation: `author_participant_id` when written from the item's board (member or guest), `author_user_id` when written from the global page or the carry-over panel (a member, who may not be a participant of the item's retro). No database check constraint (both columns are null-on-delete, which a `CHECK` would reject): `AddActionItemComment` always sets exactly one; both may become null later through deletions (the comment then shows "Former member").
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

For a retro R of team T, **carried items** are the action items of T that either belong to another retro created before R (`retros.created_at < R.created_at`), or have no retro and were created before R (`action_items.created_at < R.created_at`, §3.1), and which are either open, or were completed at or after `R.created_at` (so an item completed during the review stays visible, struck through, instead of vanishing). Ordered like the global page (§6), capped at 200; when more exist the panel shows "View all on the action items page". An item added outside a retro while R is running therefore shows up in the team's next retro, not in R.

### Where items can be changed

| Surface | Items | Phase / lock rule |
|---|---|---|
| Board endpoints `/retros/{retro}/action-items…` | the retro's own items | Create, edit, complete, delete, comment only in `Discussing` (unchanged); 423 when locked. `Completed` board is read-only (unchanged). |
| Workspace endpoints `/w/{workspace}/action-items…` (global page and carry-over panel) | any item of a team the user can view; creation of items without a retro (§3.1) | No phase rule. 423 when the item's retro is locked **and** not `Completed` (the board is frozen mid-meeting); never for items without a retro. |

Guests have no access to workspace endpoints (they are not authenticated users of the workspace), so a guest acts only on their own retro's items, only in `Discussing`.

**Promotion exception (spec 2 §6.5):** promoting a suggested action calls `CreateActionItem` with the suggestion's content and `theme_id`, in `Discussing` (same lock rule as the board) or in `Completed` (facilitator and workspace Owners/Admins only, lock ignored). This is the only way an item is created in a `Completed` retro. `CreateActionItem` copies the theme's `name` into `theme_name` in the same insert.

### 3.1 Items added outside a retro

- Created on the global page with `POST /w/{workspace}/action-items` and a required `team_id`: `retro_id = null`, `created_by_user_id` = the user, `created_by_participant_id = null`, `theme_id`/`theme_name = null`.
- **Who can create:** members of that team (`team_user`). A workspace Owner/Admin who is not a team member can view and edit these items but not create them (403) — they join the team first. `team_id` of another workspace, unknown, or of a team the user cannot view → 422 (validation, no existence leak); a visible team the user is not a member of → 403.
- **Fields:** same as board items (content, priority, due date, recurrence), assignee = a current member of the team (`assignee_user_id`) or none; `assignee_participant_id` → 422 (no guests: there is no retro whose guests could be assigned).
- **Managers** (§4): the author and workspace Owners/Admins (no facilitator exists). Complete/reopen additionally: the assignee and the review facilitator of any in-progress retro of the team (the item is carried there).
- **Anonymity:** not applicable — always named (author and comment authors), like every action item.
- **Display:** shown as "Added outside a retro" wherever the source retro would appear (global page source column, carry-over group, `source: null` in payloads).
- **Carry-over:** listed in the "Previous action items" panel of the team's retros created after the item (§3), in a group "Added outside a retro".
- **Lifecycle:** deleted with the team (cascade on `team_id`); never touched by retro deletion; never reachable through board endpoints (they are scoped to a retro, so a retro-less id → 404).

### 3.2 Recurrence (completion-based)

- `recurrence` ∈ `weekly` (+7 days), `every_two_weeks` (+14 days), `monthly` (+1 calendar month, clamped to the month's last day), or `null`. Requires a `due_on` (422 "A recurring action item needs a due date." otherwise; clearing `due_on` on a recurring item → same 422). Set/changed by managers on either surface.
- **Regeneration:** when `SetActionItemStatus` completes a recurring item that has no successor yet (`nextOccurrence` is null), it creates, in the same transaction, the next occurrence: same `team_id`, `content`, `priority`, `recurrence`, author fields, `theme_id`/`theme_name`, author fields (`created_by_participant_id`, `created_by_user_id`) copied unchanged, assignee **if it is a member still in the team** (guest or former member → unassigned); `retro_id = null` (it is a team follow-up, shown as "Added outside a retro" with "Recurring"); `previous_occurrence_id` = the completed item; sub-tasks copied unchecked, in order; comments not copied. New `due_on` = the old `due_on` advanced by the interval, repeatedly, until it is ≥ today (an overdue weekly item completed three weeks late does not spawn an already-overdue copy).
- Reopening the completed occurrence does not delete its successor; completing it again creates no second one (unique `previous_occurrence_id` plus the `nextOccurrence` check under a row lock on the completed item).
- **Stopping:** set `recurrence` to `null` on the open occurrence (the "Repeat" select → "Does not repeat"); past occurrences are unchanged. Deleting an occurrence does not delete others (`previous_occurrence_id` null on delete).
- Payload: `recurrence`, `previousOccurrenceId`; the UI shows a repeat icon with "Repeats weekly/every 2 weeks/monthly" and, on a generated occurrence, "Follows up the item completed on :date" (`:date` = the successor's `createdAt`, i.e. the completion moment of the previous occurrence).
- The successor is broadcast as a created item (§5) and is a carried item for the team's later retros by §3.

### 3.3 Sub-tasks

- A checklist of 0–20 sub-tasks per item, one level: `content` 1–200 characters, open/checked via `completed_at`, ordered by `position` (new ones appended).
- **Add, edit text, reorder, delete:** the item's managers (§4). **Check/uncheck:** whoever may complete the item (§4). Same surface rules as the item: board endpoints only in `Discussing` for the retro's own items (423 when locked), workspace endpoints any phase (423 per §3 table).
- Completing or reopening the item does not change its sub-tasks, and checking all sub-tasks does not complete the item (no hidden automation); the item card shows progress "2/5".
- 21st sub-task → 422 "An action item can have at most 20 sub-tasks."
- Sub-task changes update the item's `updated_at` and broadcast the whole item (`action-item.saved` and the team/carried events of §5), whose payload includes the sub-tasks.

### 3.4 Reminders (email and in-app)

- **Who:** only a **member** assignee (`assignee_user_id`) who is still a member of the item's team, has a verified email, and has not opted out of the channel. Guests (no account) never get reminders; unassigned items get none.
- **When:** the command `action-items:send-reminders` runs daily at `config('skrum.action_item_reminders.time')` (`SKRUM_ACTION_ITEM_REMINDER_TIME`, default `08:00`) in `config('app.timezone')`, registered in `routes/console.php` with `Schedule::command(...)->dailyAt(...)->timezone(...)->withoutOverlapping()->onOneServer()`. `SKRUM_ACTION_ITEM_REMINDERS=false` disables it (`config('skrum.action_item_reminders.enabled')`). Both keys are documented in `.env.example`.
- **What is due**, for open items, "today" in the instance time zone (§3):
  - `due_soon` — `due_on` is today or tomorrow ("due today" / "due tomorrow" wording).
  - `overdue` — `due_on` is between today − 7 days and yesterday (one reminder; the 7-day window avoids mailing items that were dated retroactively long ago, and catches up if the scheduler missed runs).
  - Skipped when a row already exists in `action_item_reminders` for (item, assignee, kind, `due_on`). The row is inserted (`insertOrIgnore`) before dispatch, so re-running the command the same day sends nothing twice.
- **Delivery:** per user and run, one queued **digest email** `ActionItemReminderDigestNotification` (`mail` channel, `ShouldQueue`, `ShouldBeEncrypted`) listing "Overdue" then "Due soon" items (content, team, source retro or "Added outside a retro", due date formatted `isoFormat('LL')`), at most 20 with "and :count more", each linking to `/w/{workspace}/action-items?item={id}`, plus "View my open action items" (`?assignee=me&status=open`, in the workspace of the digest's first item) and the footer "You can turn off these reminders in your notification settings." linking to `/settings/notifications`. Plus one **in-app** `ActionItemReminderNotification` (`database` channel) per item. Each channel is sent only if the user's matching preference is on; nothing is logged for a user who opted out of both.
- **Translations:** subjects ("Action items need your attention", "1 action item is overdue"-style `trans_choice` keys), lines and buttons in `lang/{en,fr,es,de}.json`, rendered in the recipient's locale (`HasLocalePreference`, parent spec i18n).
- **In-app:** a bell in the app header with the unread count (shared Inertia prop `notifications.unreadCount`, computed per request with one indexed count query, only for authenticated users) and a dropdown of the latest 30 notifications. The list endpoint loads the referenced items with `ActionItemQuery` permissions: a notification whose item was deleted or is no longer viewable is deleted and not returned. Opening one marks it read and visits the deep link. Completing an item marks its unread reminder notifications read.
- The sidebar "Action items" entry shows a red badge with the number of open items assigned to the viewer that are overdue in the current workspace (shared prop `actionItems.overdueAssignedCount`, one indexed count query).
- **Opt-out:** `/settings/notifications` page with two switches, "Email me about due and overdue action items" and "Show due and overdue action items in the notification bell", both on by default.
- **Housekeeping:** the same daily command, after sending, deletes notifications whose action item no longer exists, read notifications older than 30 days, any notification older than 90 days, and `action_item_reminders` rows older than 90 days. It prints progress per user ("Reminding user `…` about N items…") and a summary ("Sent N reminders to M users.").

## 4. Permissions

Model (Decision 2): QRetro parity — the author, the facilitator and workspace Owners/Admins edit and delete; the assignee completes; the facilitator can do everything during the meeting.

Let the **managers** of an item be: its author (§2: the creating participant, or the same user), the facilitator of the item's retro (none for items without a retro, §3.1), and workspace Owners/Admins.

| Action | Allowed for |
|---|---|
| Create | Any participant of the retro, on the board, in `Discussing`; promotions per §3; without a retro: members of the team, on the global page (§3.1) |
| Edit content, priority, due date, assignee | Managers |
| Delete | Managers |
| Complete / reopen | Managers, the assignee (member: same user; guest: same participant), and the facilitator of any retro of the same team that is not `Completed` (the "review facilitator") |
| Read | Participants of the item's retro (board); users who can view the item's team (global page, carry-over panel). Guests never see carried items (Decision 4). |
| Comment | Anyone who can read the item on that surface |
| Edit own comment | Its author |
| Delete comment | Its author and the item's managers |
| Set recurrence; add, edit, reorder, delete sub-tasks | Managers |
| Check / uncheck a sub-task | Same as complete / reopen |

- Board endpoints resolve the acting participant (`Participant::current`); workspace endpoints use the authenticated user. Both call one class, `App\Actions\ActionItems\ActionItemPermissions`, with `canCreateWithoutRetro(User, Team)`, `canEdit`, `canComplete`, `canDelete`, `canComment` taking an `ActionItemActor` value object (`?User $user`, `?Participant $participant`). The workspace endpoints additionally require `Gate::authorize('view', $item->team)` and `$item->team->workspace_id === $workspace->id` (404 otherwise, via scoped binding).
- Denied → 403 with a translated message ("Only the author, the facilitator or an admin can change this action item." / "Only the assignee or a manager can complete this action item." / "Only team members can add action items to this team.").
- This replaces parent AC30's "any participant can … edit, complete and delete" (see §10).
- **System actor (spec 8 status sync):** `SetActionItemStatus` also accepts `ExternalSyncActor(source, key)`, used only by spec 8's inbound status sync (spec 8 §5.5). It bypasses `ActionItemPermissions` and the board phase/lock rules (a lock governs participants, not the system) but keeps validation, recurrence regeneration (§3.2) and broadcasts. No HTTP endpoint or MCP tool can pass it.

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

`is_done` is no longer accepted (replaced by `status`). The board's `assignee_user_id` must be a member of the retro's team; `assignee_participant_id` a participant of this retro. The GET comments endpoint is allowed in every phase (read); writes follow §3. The board create/update bodies also accept `recurrence` (managers only on update). Sub-tasks on the board:

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/retros/{retro}/action-items/{actionItem}/subtasks` | `{content}` | 201 `{actionItem}` |
| PATCH | `/retros/{retro}/action-item-subtasks/{subtask}` | any of `content, status (open\|completed), position` | 200 `{actionItem}` |
| DELETE | `/retros/{retro}/action-item-subtasks/{subtask}` | — | 200 `{actionItem}` |

Sub-task responses return the whole presented item, so clients replace it in one step.

### Workspace endpoints (`auth`, `verified`, `can:view,workspace`)

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/w/{workspace}/action-items` | `status=open\|overdue\|completed\|all` (default `open`), `assignee=me\|unassigned\|{userId}`, `team={teamId}`, `item={actionItemId}`, `page` | Inertia page `action-items/index` |
| POST | `/w/{workspace}/action-items` | `{team_id, content, priority?, due_on?, recurrence?, assignee_user_id?}` | 201 `{actionItem}` (item without a retro, §3.1) |
| PATCH | `/w/{workspace}/action-items/{actionItem}` | any of `content, priority, due_on, recurrence, assignee_user_id, status` | 200 `{actionItem}` |
| DELETE | `/w/{workspace}/action-items/{actionItem}` | — | 204 |
| GET | `/w/{workspace}/action-items/{actionItem}/comments` | — | `{comments}` |
| POST | `/w/{workspace}/action-items/{actionItem}/comments` | `{content}` | 201 `{comment}` |
| PATCH | `/w/{workspace}/action-item-comments/{comment}` | `{content}` | 200 `{comment}` |
| DELETE | `/w/{workspace}/action-item-comments/{comment}` | — | 204 |
| POST | `/w/{workspace}/action-items/{actionItem}/subtasks` | `{content}` | 201 `{actionItem}` |
| PATCH | `/w/{workspace}/action-item-subtasks/{subtask}` | any of `content, status, position` | 200 `{actionItem}` |
| DELETE | `/w/{workspace}/action-item-subtasks/{subtask}` | — | 200 `{actionItem}` |

### Notification and settings endpoints (`auth`, `verified`)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/notifications` | — | `{notifications: [{id, kind, wording, readAt, createdAt, actionItem: {id, content, teamName, dueOn, isOverdue, url}}], unreadCount}` (latest 30, own only; `wording` ∈ `overdue\|due_today\|due_tomorrow`, due soon judged against the day it was sent, instance time zone) |
| PATCH | `/notifications/{notification}` | `{read: true}` | 200 `{unreadCount}`; another user's id → 404 |
| POST | `/notifications/read-all` | — | 200 `{unreadCount: 0}` |
| GET | `/settings/notifications` | — | Inertia page `settings/notifications` with both preferences |
| PATCH | `/settings/notifications` | `{action_item_reminders_by_email: bool, action_item_reminders_in_app: bool}` | redirect back with flash "Notification settings saved." |

- Controllers: `NotificationsController` (`index`, `update`), `ReadAllNotificationsController` (`store`), `Settings\NotificationPreferencesController` (`edit`, `update`) in `routes/settings.php`; route names `notifications.index`, `notifications.update`, `notifications.readAll`, `notificationPreferences.edit`, `notificationPreferences.update`. Settings navigation gains "Notifications".

- Controllers: `App\Http\Controllers\WorkspaceActionItemsController` (`index`, `store`, `update`, `destroy`), `WorkspaceActionItemSubtasksController` and `Retros\ActionItemSubtasksController` (`store`, `update`, `destroy`), `WorkspaceActionItemCommentsController` (`index`, `store`, `update`, `destroy`), `App\Http\Controllers\Retros\ActionItemCommentsController` (same four). Routes named `workspaces.actionItems.*`, `workspaces.actionItemComments.*`, `retros.action-items.comments.*` following the existing naming in `routes/web.php`.
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
  source: {retroTitle, retroCreatedAt, retroUrl} | null,  // retroUrl never null: every reader can open the retro; null = added outside a retro
  themeId: uuid|null, themeName: string|null,          // themeName read from action_items.theme_name, kept after theme deletion
  recurrence: 'weekly'|'every_two_weeks'|'monthly'|null, previousOccurrenceId: uuid|null,
  subtasks: [{id, content, isCompleted, position}],    // ordered by position
  externalLinks: [{source, key, url, …}],              // spec 6 §7, extended by spec 8 §7 (state, statusName, syncState, syncError, lastSyncedAt); [] for guests
  createdAt
}
```

- `retroId` is `null` for items added outside a retro (and recurring successors, §3.2).

- `assignee.id` is the user id (`member`) or participant id (`guest`).
- Broadcast payloads always carry `isMine: false`; clients keep their known `isMine` for existing items (same pattern as `mine` on reactions).
- The client derives permissions from `isMine`, `viewer.canManageActionItems` (facilitator or workspace Owner/Admin; snapshot field), `viewer.isWorkspaceManager`, `viewer.facilitatedRetroIds` (facilitator of the item's own retro manages it), `viewer.isReviewFacilitator` (board) / `viewer.reviewTeamIds` (global page), and whether the assignee is the viewer (`viewer.userId` / `viewer.participantId`). The server stays the authority.

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
| `team-action-item.saved` | `private-team-action-items.{teamId}` | `{actionItem}` | Every create/update of an item of the team (incl. sub-tasks, recurring successors), any surface, any phase |
| `team-action-item.deleted` | `private-team-action-items.{teamId}` | `{actionItemId}` | Every delete (not sent for cascades from retro or team deletion; open pages reconcile on the next reload) |
| `team-action-item.comments.changed` | `private-team-action-items.{teamId}` | `{actionItemId, commentCount}` | Every comment change |

- New private channel `retro-members.{retroId}`: `BroadcastAuthorizationsController` authorizes it only for a resolved participant of that retro who is **not** a guest. Guests are on the presence channel, so carried items never travel there.
- New private channel `team-action-items.{teamId}` (global page live updates, Decision 8, scope decision 1): authorized only for an authenticated user (`$request->user()`, never a guest participant cookie) with `Gate::allows('view', $team)`. Per team, so a Member never receives items of teams they cannot view. Authorization happens at subscribe time; a member removed from a team keeps receiving that team's events until their page reloads or the socket reconnects (the next reload, focus refresh or reconnect re-checks access). Payloads carry `isMine: false`.
- Items without a retro send no `action-item.*` presence events (they have no board) — only carried and team events.
- Clients with an open comment thread refetch it on `*.comments.changed`; others update the count.
- Fan-out is bounded by the number of in-progress retros of one team plus one team event; one class `BroadcastActionItemChange` computes the targets and dispatches.
- Workspace-endpoint mutations also use `toOthers()`: from a board's carry-over panel or the global page the request carries the `X-Socket-ID` header (the global page now holds a socket) and the sender is excluded.

### Plain domain events (non-broadcast, dispatched after commit)

| Event | Dispatched by | Payload | Subscribers |
|---|---|---|---|
| `ActionItemCreated` | `CreateActionItem`, on every path (board, promotion, workspace/global page, recurring successor, MCP) | `actionItem` | spec 8 generic-webhook events (`action_item.created`) |
| `ActionItemCompleted` | `SetActionItemStatus` when an item becomes completed | `actionItem`, `origin: skrum \| external` (`external` only for `ExternalSyncActor`, §4) | spec 8 status push (origin `skrum` only) and webhook events |
| `ActionItemReopened` | `SetActionItemStatus` when a completed item is reopened | `actionItem`, `origin` | same as `ActionItemCompleted` |

A no-op status change (idempotent, §3) dispatches nothing.

### Snapshot additions (`BuildBoardSnapshot`)

- `actionItems`: new shape; ordered by `created_at` (unchanged order on the board).
- `carriedActionItems`: presented carried items (§3, including items without a retro) for non-guest viewers; `[]` for guests. Loaded with a constant number of queries (sub-tasks eager-loaded).
- `carriedActionItemsHasMore`: `true` when more than 200 items are carried (panel shows "View all on the action items page").
- `retro.teamId`.
- `viewer.userId` (null for guests), `viewer.canManageActionItems`, `viewer.isWorkspaceManager`, `viewer.isReviewFacilitator` (facilitator of this retro while not `Completed`), `viewer.facilitatedRetroIds` (retros of this team the viewer facilitates).
- `teamMembers`: `[{id, name, avatarUrl, participantId}]` of the retro's team (`participantId` = the member's participant in this retro or `null`), for the assignee select. Guests receive it too (they can assign on the board), without emails.
- `links.actionItems`: global page URL filtered to the team; `links.workspace`: workspace slug for the workspace endpoints of the carry-over panel (both `null` for guests).

## 6. Global page ordering and filters

- Scope: items of teams in `{workspace}` that the user can view (`TeamPolicy::view`: team members; Owners/Admins see all teams).
- Order: open before completed; among open: overdue first, then by `due_on` ascending (nulls last), then priority (high → low), then `created_at` descending. Among completed: `completed_at` descending.
- `status=overdue` = open and overdue. `assignee=me` matches `assignee_user_id = user`. `assignee=unassigned` matches both assignee columns null.
- Default query: `status=open`, all teams, any assignee. The page remembers the last filters in `localStorage` (`skrum.actionItemFilters.{workspaceId}`) and applies them when opened without a query string (e.g. from the sidebar).
- Query in one class `App\Actions\ActionItems\ActionItemQuery` (`forUser(User, Workspace, ActionItemFilters)`), eager-loading team, retro (nullable), author, assignee and sub-tasks — constant query count per page. Items without a retro are included, filtered by `team_id` like the others.
- Page props: `workspace`, `filters {status, assignee, team, item}`, `items {data, currentPage, lastPage, total, prevPageUrl, nextPageUrl}`, `focusedItem` (the `item` deep-link target when visible, else `null`), `teams` (visible teams, same shape as `creatableTeams`, for per-row assignee selects), `creatableTeams` (`[{id, name, members: [{id, name, avatarUrl}]}]`, teams of the workspace the viewer is a member of) for the "New action item" form, `assignees` (`[{id, name}]`, members of visible teams, for the filter), `realtimeTeamIds` (visible teams matching the team filter) for channel subscriptions, and `viewer {userId, isWorkspaceManager, facilitatedRetroIds, reviewTeamIds}`.

## 7. Redaction and privacy

- Action items and action-item comments are **always named**, including on anonymous retros (`is_anonymous`): creator, comment authors and assignee are shown to everyone who can read the item, on every surface, including snapshots, responses, broadcasts and the global page (Decision 5). Anonymity of cards and card comments (other specs) is unchanged.
- Because of that, the action-item create form and comment box show a notice on anonymous retros so nobody is surprised (§8).
- Guests: see only their own retro's items and comments; never carried items (neither in the snapshot nor on any channel they can join); never team member emails.
- Global page and carry-over only show items of teams the user can view; a Member removed from a team loses access to its items immediately.
- `source.retroUrl` is always set: whoever can read an item can open its retro (participants of it, or viewers of its team).
- Deleting a retro deletes its action items and their comments (cascade, unchanged; Decision 6). The delete-retro dialog shows "This also deletes N open action items." when N > 0.
- No change to vote or card redaction.
- **Items without a retro** follow the same visibility as the others (team viewers); they never reach guests because guests only read their own retro's items.
- **Team channel** `team-action-items.{teamId}` is members-only (authenticated user who can view the team); guests never subscribe (§5).
- **Reminders** go only to the member assignee; the email contains the item content, team, source retro title and due date — nothing the assignee cannot already read — and no comments, author or other assignees. In-app notification rows store ids only; content is loaded live with a permission check, so a user who lost access to the team no longer sees it. Reminder emails go through the instance's own mailer; no third party is contacted beyond it.
- **Sub-tasks and recurrence** carry no author data; they follow the item's visibility.

## 8. UI

All new strings in `lang/{en,fr,es,de}.json`, including "Action items are not anonymous: your name is shown." and "This also deletes N open action items.".

### Board action item panel (`action-items-panel.tsx`, `Discussing`)

- Create form: content, priority select (icons: arrow-up red High, circle amber Medium, arrow-down slate Low), due date input, assignee select grouped "In this retro" (team members who joined this retro, and guests suffixed "(guest)") and "Team" (members not in the retro). Workspace Owners/Admins outside the team are not listed (422 if sent, §3).
- Item card, as in `screens/retro-actions.png`: creator avatar + name (always shown), content, complete toggle, priority select, assignee select, due date chip ("Due 3 Oct", red "Overdue" badge when `isOverdue`), edit (pencil opens inline edit) and delete buttons, comment button with count opening an inline flat thread (list + textarea, edit/delete own; delete for managers).
- On anonymous retros (`is_anonymous`), the create form and the comment box show the notice "Action items are not anonymous: your name is shown." (translated, above the input; not shown on named retros).
- Controls the viewer may not use are hidden (edit/delete) or disabled (complete), per §4.
- Exported items show the `PROJ-12 ↗` chip of spec 6 §11 (with spec 8's state dot and sync tooltip); an item completed by spec 8's status sync shows "Completed in :source" next to its completion time.
- "Repeat" select (Does not repeat / Weekly / Every 2 weeks / Monthly), enabled once a due date is set, in the create form and edit mode; a repeat icon with the label on recurring items.
- Sub-task checklist under the content: checkbox + text per sub-task, "Add a sub-task" input (managers), inline edit and delete (managers), drag handle or up/down buttons for reordering (managers), progress "2/5" on the collapsed card.

### Carry-over panel (new `carried-action-items-panel.tsx`)

- Header button "Previous action items (n)" (n = open carried items), shown to non-guest participants in every phase except `Completed`, when the list is not empty.
- Opens a side sheet listing carried items grouped by source retro (title + date, newest retro first; items inside ordered as §6), with the same item card (complete, edit fields, comments) through the workspace endpoints.
- Opens automatically once per viewer and retro, only when the board is first loaded while the phase is `Writing` (not on a later switch into `Writing`) (`localStorage` `skrum.carriedSeen.{retroId}`), so the review happens at the start.
- Footer link "Open the action items page".
- Items without a retro (§3.1, including recurring successors) appear in a group "Added outside a retro", after the retro groups.

### Results view — action items (spec 2 §6.2, which replaces `completed-summary.tsx`)

- Lists the retro's items with priority, due date, overdue badge, assignee, status and theme name when set (read-only), plus link "View the team's action items" (members only).

### Global page (`resources/js/pages/action-items/index.tsx`)

- Sidebar entry "Action items" (all roles) below "Teams".
- Filter bar: status (Open / Overdue / Completed / All), assignee (Anyone / Me / Unassigned / member list of visible teams), team (All teams / each visible team). Filters are query-string driven (Inertia visits with `preserveState`).
- "New action item" button (shown when `creatableTeams` is not empty): dialog with team select (defaults to the team filter), content, priority, due date, repeat, assignee (members of the chosen team). Creates via `POST /w/{workspace}/action-items`.
- Rows: complete toggle, content, priority, due date + overdue badge, repeat icon, sub-task progress, assignee avatar/name ("(guest)", "(not in team)"), team name, source retro link and date or "Added outside a retro", creator, comment count. Clicking a row expands its sub-tasks, comments and an edit form (per permissions).
- `?item={id}` scrolls to and expands that item (deep link used later by MCP and integrations); when the current filters or page hide it, it is pinned above the list as "Linked action item" (`focusedItem`).
- **Live updates:** subscribes to `private-team-action-items.{teamId}` for each id in `realtimeTeamIds` (re-subscribes when the team filter changes). On `team-action-item.saved` for an item on the page it replaces the row in place; on `.comments.changed` it updates the count (and refetches an open thread). Any saved/deleted event also schedules a debounced (1 s) Inertia partial reload of the list, so filters, ordering, pagination and new items stay correct; expanded rows and unsaved edit forms are preserved. It still reloads on window focus and after own mutations.
- Empty states: "No open action items." / "Nothing matches these filters."
- Team page (`teams/show.tsx`) gains "Open action items (n)" linking to the global page filtered by that team.
- Sidebar "Action items" entry shows the red overdue-assigned-to-me badge (§3.4) when > 0.

### Notification bell and settings

- Bell icon in the header of the sidebar layout (the default authenticated layout; the unused header layout gets none) with an unread count badge (hidden at 0, "9+" above 9). Opening it fetches `/notifications`: rows "Overdue: :content" / "Due today: :content" / "Due tomorrow: :content" (from `wording`) with team name and relative time, unread in bold; "Mark all as read"; empty state "No notifications.". Clicking a row marks it read and visits its deep link.
- `resources/js/pages/settings/notifications.tsx`: the two switches of §3.4 (rendered as checkboxes: no switch component, no new dependency) with a short explanation ("Reminders are sent at :time for action items assigned to you."), saved with a Wayfinder form.

## 9. Future hooks (not built here)

- **MCP (spec 5)**: tools `retro.actions.list/create/update/complete`, `retro.board.actions.list` map onto `ActionItemQuery`, `ActionItemPermissions`, and new single-purpose actions `CreateActionItem`, `UpdateActionItem`, `SetActionItemStatus`, `DeleteActionItem`, `AddActionItemComment` in `app/Actions/ActionItems/`. Controllers must call these actions (no logic in controllers) so MCP reuses the same validation, permissions and broadcasts. `ActionItemActor` already accepts a user without a participant. `CreateActionItem` also serves spec 2's promotion (§3), with an optional `theme_id` (it writes `theme_name`), and items without a retro (§3.1, `?Retro` + required `Team`). Sub-tasks use `AddActionItemSubtask`, `UpdateActionItemSubtask`, `DeleteActionItemSubtask`; recurrence regeneration lives in `SetActionItemStatus`; reminders in `SendActionItemReminders` (called by the command).
- **Jira/Linear export (spec 6)**: adds its own table `action_item_external_links` and `PresentActionItem.externalLinks` (spec 6 §3, §7; extended by spec 8 §3, §7 for status sync, Jira Data Center and GitHub); nothing else is reserved here. The deep link `?item=` and `PresentActionItem` give a stable URL and payload for the issue body; an item without a retro is described as "Added outside a retro" there (spec 6 §7).
- **Domain events**: `CreateActionItem` and `SetActionItemStatus` dispatch the plain events of §5 (`ActionItemCreated`, `ActionItemCompleted`, `ActionItemReopened`, the last two with `origin`). This spec adds no listener; spec 6 subscribes none; spec 8 subscribes `ActionItemCreated`, `ActionItemCompleted` and `ActionItemReopened` (status push and generic-webhook events). An assignment event was dropped as dead code (2026-10-05 hardening); a later integration that needs one adds it. Due-date reminders are built here (§3.4) and do not use these events.

## 10. Changes to the parent spec and other specs

The parent (core) spec is built: the items that target it are changes this spec's implementation plan makes.

- Parent AC30 ("any participant can create, edit, complete and delete action items and assign them to a participant") becomes: any participant creates in `Discussing`; edit/delete/complete follow §4; assignees are team members or guests of the retro (§3). The parent spec gets a note pointing here, as for the vote-totals change.
- Parent "Out of scope: action-item carry-over across retros" is delivered by this spec.
- Parent AC16 ("Completed retros are read-only"): besides spec 2's exceptions, the workspace endpoints (§3) change items of a `Completed` retro; the board stays read-only.
- Parent data model: `action_items.retro_id` and `created_by_participant_id` become nullable (items without a retro, §3.1); a framework `notifications` table (UUID morph, AC0) and two `users` preference columns are added; the settings area gains a "Notifications" page; the s6 scheduler service now runs `action-items:send-reminders`; `.env.example` documents `SKRUM_ACTION_ITEM_REMINDERS` and `SKRUM_ACTION_ITEM_REMINDER_TIME`.
- **Spec 2 (Retro flow extras)** §6.5 Promote: no behaviour change; add that `CreateActionItem` stores the theme's name in `action_items.theme_name` so the Results view keeps showing it after themes are regenerated or cleared (`themeId` then `null`, `themeName` kept). *(Applied in spec 2 §6.5.)*
- **Spec 5 (MCP server)**: `retro.actions.create` accepts `team_id` without `retro_id` (member of the team, §3.1); `retro.actions.update` accepts `recurrence`; the presented item gains `source: null`, `recurrence`, `previousOccurrenceId`, `subtasks`, `themeName`; optional tools `retro.actions.subtasks.add|update|delete` map onto the sub-task actions. No MCP tool for reminders or notification preferences. *(Applied in spec 5 §1.3, §6, §6.3, except the sub-task tools: the MCP contract's tool set is closed, so sub-tasks are exposed read-only in the action item payload and changed only in the UI.)*
- **Spec 6 (Integrations)**: its out-of-scope line "action item assigned/overdue" notifications — overdue and due-soon reminders by email and in-app now exist here (§3.4); Slack/Telegram reminders and assignment notifications stay deferred. Jira/Linear export must handle `source: null` ("Added outside a retro") in the issue body; each recurring occurrence is a separate item and exported separately. *(Applied in spec 6 §1, §7, §10.1.)*

## 11. Error handling

- 403 permission / phase → translated message, optimistic change rolled back + toast (existing pattern).
- 404 item or comment deleted concurrently → removed locally; on the global page, the row disappears after reload.
- 422 validation (content length, priority, date, assignee not in team, both assignee fields) → inline field error.
- 423 locked retro → toast "The board is closed for editing." (board and carry-over panel).
- Workspace endpoint called for an item of another workspace or a team the user cannot view → 404 (no existence leak).
- Create without a retro: `team_id` missing/unknown/other workspace → 422; team visible but viewer not a member → 403; `assignee_participant_id` → 422.
- Recurrence without a due date, or clearing the due date of a recurring item → 422 inline error. Regeneration runs in the completion transaction: if it fails, the completion is rolled back (500 reported, toast "Something went wrong.").
- Sub-tasks: content length and the 20 limit → 422; sub-task of an item on another board/workspace → 404.
- Notifications: a notification of another user → 404; a notification whose item is gone is dropped from the list (no error).
- Reminder delivery: a failed mail job retries per the worker default (3 tries) and lands in `failed_jobs`; the reminder row stays, so no duplicate is sent on the next run. Mailer `log`/`array` still logs the emails (useful in development).
- Realtime channel auth denied (guest, removed member) → 403 on subscribe; the global page keeps working with focus refresh.

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
- **Domain events** (`Event::fake()`): `ActionItemCreated` on every creation path; `ActionItemCompleted` / `ActionItemReopened` with `origin = skrum` from both surfaces and MCP, `origin = external` with `ExternalSyncActor`; nothing on a no-op status change; `ExternalSyncActor` completes regardless of phase, lock and permissions and still regenerates a recurring item.
- **Theme**: `theme_id` and `theme_name` are ignored when sent to any board or workspace endpoint; `CreateActionItem` with a theme writes `theme_name`; after the theme is deleted `themeId` is `null` and `themeName` is still presented (promotion itself is tested in spec 2).
- **Items without a retro**: team member creates (201, `retroId`/`source` null, `created_by_user_id` set); Owner/Admin non-member → 403; other workspace/unknown team → 422; guest assignee → 422; author and Owners/Admins edit/delete, others 403; assignee and review facilitator complete; carried into retros created after the item, not into a retro already running; board endpoints → 404; team deletion removes them; migration backfills `created_by_user_id`.
- **Recurrence**: requires a due date; completing creates exactly one successor (also when completed, reopened and completed again) with advanced `due_on` ≥ today (weekly, two weeks, monthly with month-end clamp), same content/priority/recurrence/theme, member assignee kept, guest or former member dropped, sub-tasks copied unchecked, no comments, `retro_id` null, `previousOccurrenceId` set; setting `recurrence` null stops it; only managers change it.
- **Sub-tasks**: add/edit/reorder/delete by managers only, check by completers; 1–200 characters; 20 max; board phase/lock rules; item completion leaves sub-tasks alone; payload order; cascade on item deletion.
- **Global page realtime**: every mutation (both surfaces, any phase, sub-tasks, successors) dispatches `team-action-item.*` on `private-team-action-items.{teamId}` with `isMine: false`; channel auth allows team members and Owners/Admins, refuses members of other teams, unauthenticated requests and guest participant cookies.
- **Reminders** (`Carbon::setTestNow`, `Notification::fake()`): due today/tomorrow → `due_soon`; due 1–7 days ago → `overdue`; 8+ days ago, completed, unassigned, guest-assigned, assignee no longer in the team, unverified email → nothing; running twice the same day sends once; changing `due_on` or reassigning makes it eligible again; email opt-out → no mail but in-app; in-app opt-out → mail only; both off → nothing and no log row; one digest per user with all their items, capped at 20 with "and N more"; rendered in the user's locale (fr); `SKRUM_ACTION_ITEM_REMINDERS=false` → command does nothing; schedule registered at the configured time and time zone; housekeeping deletes old and orphaned rows.
- **Notifications endpoints**: list own only, drops and deletes notifications of deleted/unviewable items, mark one read (another user's → 404), read all, `unreadCount` shared prop; completing an item marks its reminders read; `overdueAssignedCount` counts only open overdue items assigned to the viewer in the current workspace.
- **Settings**: `/settings/notifications` shows and saves both preferences (booleans validated).
- **Translations**: the existing locale-completeness test covers the new keys, including email subjects and `trans_choice` strings.
- **Walkthrough** (two browsers, a member and a guest): create items with priority, due date (one overdue), member and guest assignees; guest completes their own item; complete retro; start a new retro of the same team → panel opens in `Writing`, member completes a carried item and the other member's panel updates live, guest sees no panel; global page filters, deep link, reassign the guest item to a member; on an anonymous retro the notice shows and creators and comment authors are named. Then: add an item outside a retro on the global page and see it appear live in the second member's global page; add sub-tasks and check them; make a weekly item, complete it, see the next occurrence; run `php artisan action-items:send-reminders` with `MAIL_MAILER=log` → digest logged in the recipient's language, bell shows the count, opening a notification deep-links to the item; turn email reminders off in settings and rerun for a new due date → only the bell entry.

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
9. All new strings are translated in en/fr/es/de, including reminder emails.
10. Suite, phpstan, type-check and lint are green; walkthrough passes.
11. Team members can add an item to their team outside a retro from the global page; it is shown as "Added outside a retro", managed by its author and workspace Owners/Admins, assignable only to team members, and carried into the team's retros created afterwards (§3.1).
12. The global page updates live through `private-team-action-items.{teamId}`, which only authenticated users who can view the team may join; guests never subscribe (§5).
13. Member assignees receive at most one due-soon and one overdue reminder per item and due date, by email (daily digest, recipient's locale) and in the notification bell, each unless opted out in `/settings/notifications`; guests and unassigned items receive none (§3.4).
14. Completing a recurring item creates exactly one next occurrence with the next due date on or after today; setting "Does not repeat" stops the series (§3.2).
15. Items have up to 20 one-level sub-tasks, edited by managers and checked by whoever may complete the item (§3.3).
16. `themeName` stays visible after the promoting theme is deleted, from `action_items.theme_name` (§2).

## Decisions (2026-09-29)

1. **Assignee identity:** a team member (user) or a guest participant of the item's retro.
2. **Permissions:** QRetro model — author, facilitator and workspace Owners/Admins edit/delete; the assignee can complete; the facilitator can do everything during the meeting.
3. **Carry-over form:** phase-independent "Previous action items" panel, auto-opened in `Writing`; no new phase.
4. **Guests and carried items:** carried items from previous retros are hidden from guests.
5. **Anonymity:** action items and action-item comments are always named, even on anonymous retros (deliberately not the recommendation); the create form and comment box show a notice on anonymous retros. Card and card-comment anonymity is unchanged.
6. **Retro deletion:** cascade, with a warning showing the open item count.
7. **Global page scope:** workspace-wide page with a team filter.
8. **Scope additions (2026-09-30):** moved into scope by the user — (a) creating action items outside a retro on the global page (`retro_id` nullable, `team_id` required, shown as "Added outside a retro"; created by team members; managed by author + workspace Owners/Admins; member assignees only; always named; carried into the team's next retro); (b) live updates on the global page through a members-only channel, guests never subscribe; (c) due-date and overdue reminders to the assignee by email and in-app (bell/badge), per-user opt-out in settings, queued and scheduled, translated emails, none for guests; (d) recurring items and one level of sub-tasks; plus `action_items.theme_name` (copy written at promotion, `theme_id` nulled on theme deletion, `themeName` in payloads). The remaining choices, listed below, were settled by the user on 2026-09-30 and are applied in the body.

## Decisions (scope additions, 2026-09-30)

All recommended options below were chosen by the user on 2026-09-30.


1. **Global page channel granularity.** (a) One private channel per team `team-action-items.{teamId}`, page subscribes to each visible team — no data a Member cannot see ever reaches them; Owners/Admins with many teams hold many subscriptions. (b) One channel per workspace carrying full items — one subscription, but Members would receive items of teams they cannot view (privacy leak), so unusable as is. (c) One per-workspace channel carrying only `{teamId, actionItemId}` pings, client refetches — one subscription, no content leak, but leaks item/team ids and doubles requests. **Chosen: (a).**
2. **Reminder cadence.** (a) One "due soon" (due today/tomorrow) + one "overdue" (first run after the due date, within 7 days). (b) (a) plus a weekly overdue repeat until completed — harder to ignore, noisier. (c) Overdue only — quietest, no warning before the deadline. **Chosen: (a).**
3. **Email format.** (a) One daily digest per user listing all due/overdue items — few emails; one item's urgency is diluted. (b) One email per item and kind — precise, noisy for busy assignees. **Chosen: (a)** (in-app stays per item).
4. **Recurrence model.** (a) Completion-based: completing creates the next occurrence with the next due date ≥ today — simple, never piles up duplicates. (b) Fixed schedule: the scheduler creates an occurrence each period even if the previous one is open — true calendar cadence, but open copies accumulate. **Chosen: (a).**
5. **Where a recurring successor lives.** (a) Detached from any retro (`retro_id = null`, "Added outside a retro", "Recurring") — never pollutes a completed retro's Results view, carried naturally; loses the direct source-retro link (kept via `previousOccurrenceId`). (b) Same `retro_id` as the original — keeps the source link, but a completed retro's Results view would keep growing and guest assignees could stay. **Chosen: (a).**
6. **Reminder opt-out granularity.** (a) Two switches (email, in-app). (b) One switch for both — simplest settings page, but no "bell only" option. **Chosen: (a).**

## Decisions (plan, 2026-10-01)

Settled while writing Plans 9a/9b; applied in the body.

1. `action_item_comments` has no check constraint (null-on-delete authors); `AddActionItemComment` sets exactly one author (§2).
2. `notifications.data` is `json` so reminders can be matched by item (§2, §3.4).
3. `source.retroUrl` is never `null` (§5, §7).
4. A hidden `?item=` target is pinned as "Linked action item" via the page prop `focusedItem` (§6, §8).
5. Create outside a retro: invisible team → 422, visible team but not a member → 403 (§3.1).
6. Recurring successors copy the author fields; "Follows up the item completed on :date" uses the successor's `createdAt` (§3.2).
7. The digest's "View my open action items" targets the first item's workspace (§3.4).
8. The carry-over panel auto-opens only on the first board load in `Writing` (§8).
9. Notification settings use checkboxes (§8).
10. The bell lives only in the sidebar-layout header (§8).
11. Board assignee select: "In this retro" = joined team members + guests; Owners/Admins outside the team excluded (§8, §3).
12. Extra payload fields for the client: snapshot `carriedActionItemsHasMore`, `retro.teamId`, `viewer.isWorkspaceManager`, `viewer.facilitatedRetroIds`, `teamMembers[].participantId`, `links.workspace`; global page props `teams`, `assignees`, `viewer`, `focusedItem`; notification `wording` (§5, §6).
