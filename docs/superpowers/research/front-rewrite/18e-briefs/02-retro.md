# Brief 02 — Retro board (plan 18e, screen group 2)

Read-only research. Sources: spec `docs/superpowers/specs/2026-10-01-front-rewrite-design.md`, `inventory-pages.md` lines 1349-2203, `inventory-components.md` §6-7, `notes-for-18e.md`, the seven mockup READMEs, the `skrum/` sources, the old `components/retro/**`, `tests/Browser/Walkthroughs/*`, and greps over `app/`, `database/`, `tests/`.
Abbreviations: `C/` = `resources/js/components/retro/`, `S/` = `resources/js/components/skrum/`, `AI/` = `resources/js/components/action-items/`, `req` = `retroRequest()` from `lib/retro/api.ts`.
"NV" marks a statement I did not verify in code.

## 1. Scope

| Page | Route | Layout today | Layout after | Mockup |
|---|---|---|---|---|
| `retros/show` | `GET retros/{retro}` `retros.show` (no `auth`, `ResolveRetroParticipant`) | none (`app.tsx` returns `null`) | `SessionLayout` (`layouts/skrum/session-layout.tsx`), rendered BY the container because its slots (`title`, `phases`, `timer`, `presence`, `actions`) are board state; `app.tsx` keeps returning `null` for this page | ScreenRetroWriting, Grouping, Vote, Discussion, Actions, ROTI (frames a/b = ROTI, c/d = session end), MobileRetro |
| `retros/join` | `GET/POST join/{guestToken}` `retros.join.show/store` | `AuthLayout` (old) | `AuthLayout` (skrum) with `S/guest-join.tsx` | GuestJoin README, MobileAccess (owned by group 11; only the join frame concerns us) |
| `retros/session-ended` | rendered by 4 middlewares, no route | `AuthLayout` (old) | `AuthLayout` (skrum) + `EmptyState` | none: designed from ScreenAuth / ScreenErrors |

Phases after B1: health_check (opt.) → icebreaker (opt.) → writing → grouping → voting → discussing → **actions** → **roti** → completed.
No mockup: health check phase, icebreaker phase, results/insights (spec §7 says: HealthCheck inside the ScreenRetro frame; results inside the session-end frame of ScreenRetroROTI).
Out of scope here: surveys inside the retro (brief 08), internals of `components/games/*` (brief 06), `AI/*` on `action-items/index` (brief 05), new-retro dialog (brief 01). Plug points are listed in §4.

`session-layout.tsx` gives a guest no sidebar (`usePage().props.auth.user` null) — matches today (guests have `links.* = null`).

## 2. Commits

Order matters. Until its own commit, a phase keeps rendering its OLD components inside the NEW container (they only need `useBoard()`, which stays in `C/board-context.tsx`). There is never a second version of a component: a file is either old or rewritten in place.

| # | Commit | Content | Old files deleted |
|---|---|---|---|
| R1 | `feat(retro): eight column colours (B10)` | enum, data migration, catalogue, validation, TS `ColumnColor`, `lib/retro/colors.ts` reduced to a legacy-free map; `S/column-color-picker.tsx`, `S/retro-column.tsx`, `S/retro-card.tsx`, `S/retro-template-picker.tsx`, `S/template-editor.tsx` lose their `ServerColumnColor` union. Touches `pages/workspaces/templates.tsx`, `components/templates/template-chips.tsx`, `C/add-column.tsx`, `C/column-header.tsx` (old, still alive) | none |
| R2 | `feat(retro): guest join and session ended` | `pages/retros/join.tsx`, `pages/retros/session-ended.tsx` on `GuestJoin` / `EmptyState` | none (pages rewritten in place; `components/heading.tsx`, `input-error.tsx` are shared, stay) |
| R3 | `feat(retro): session shell` | `C/board.tsx` rewritten as container under `SessionLayout`: topbar (back, title, PhaseStepper, Timer, PresenceStack, cursor toggle, language switch, lock badge, settings, share, facilitator menu), ConnectionState, expired state, BoardEnded, ReactionBar, live cursors, hand-over and delete dialogs | `board-header.tsx`, `phase-stepper.tsx`, `timer-control.tsx`, `facilitator-menu.tsx`, `settings-dialog.tsx`, `guest-link-dialog.tsx`, `share-board-button.tsx`, `board-post-link.tsx`, `handover-dialog.tsx`, `delete-retro-dialog.tsx`, `lock-badge.tsx`, `board-ended.tsx`, `flying-reactions.tsx`, `phase-panel.tsx`. NOT deletable yet (imported by poker / whiteboard / games / teams): `connection-banner.tsx`, `session-expired-banner.tsx`, `timer-display.tsx`, `presence-strip.tsx`, `live-cursor-layer.tsx` (`HideMyCursorKey`), `emoji-picker.tsx`, `ai-summary-switch.tsx`, `icebreaker-game-select.tsx`, `components/realtime/flying-reactions.tsx`, `components/realtime/live-cursors.tsx` — see §10 |
| R4 | `feat(retro): writing phase` | columns, cards, composer, GIF, sortable DnD, column editing, add column, help banner | `retro-column.tsx`, `column-header.tsx`, `add-column.tsx`, `retro-card.tsx`, `card-composer.tsx`, `card-editor.tsx`, `card-gif.tsx`, `gif-picker.tsx`, `card-insight.tsx` (if `insights/*` no longer imports it — else R11), `dnd.tsx` rewritten in place |
| R5 | `feat(retro): health check phase` | `HealthCheckForm` above the columns | `health-check-panel.tsx` |
| R6 | `feat(retro): icebreaker phase` | stage frame around the games panel | `icebreaker-stage.tsx`; `icebreaker-game.tsx` rewritten in place (it wires `components/games/*`, which brief 06 owns) |
| R7 | `feat(retro): grouping phase` | CardGroup, group/ungroup/move DnD, group names, AI names, card comments, card reactions | `group-name.tsx`, `group-name-suggestions.tsx`, `card-comments.tsx`, `card-reactions.tsx`. `comment-thread.tsx` and `reaction-chips.tsx` are rewritten IN PLACE with the same exports (`CommentThreadList`, `ReactionChips`) because `survey-discussion.tsx` (brief 08) imports them |
| R8 | `feat(retro): voting phase` | VoteBudget bar, CardVotes, progress | `vote-controls.tsx`, `vote-progress.tsx` |
| R9 | `feat(retro): discussing phase` | topics list, focus, presentation overlay, sort by votes, suggestions, action items of the topic | `presentation-overlay.tsx`, `suggestions-panel.tsx`, `action-items-panel.tsx` |
| R10 | `feat(retro): actions phase (B1)` | back end B1, TS types, reducer; Actions screen; carried sheet; export dialog | `carried-action-items-panel.tsx` |
| R11 | `feat(retro): ROTI phase (B2)` | back end B2; ROTI screen | `roti-control.tsx` |
| R12 | `feat(retro): session end (B3)` | session-end screen with results, insights, shares, recap e-mail | `results/*` except `survey-result.tsx` (16 files incl. `completed-tabs.tsx`; `results-section.tsx` if unused), `insights/suggestions-list.tsx`, `insights/summary-section.tsx` |
| R13 | `feat(retro): mobile board` | MobileRetro: column tabs, FAB, drawers, compact bars; visual captures of every phase at 390 | none |

Left for brief 08 (surveys): `survey-card.tsx`, `survey-menu.tsx`, `survey-dialog.tsx`, `survey-draft-field.tsx`, `survey-discussion.tsx`, `surveys-column.tsx`, `results/survey-result.tsx`, `lib/retro/survey-api.ts` usage.
B1 lands in R10 and not earlier so that every commit before it runs on the seven current phases; R10 is the commit where the phase-walk tests change.

## 3. Parity table

Hooks: `id`/selector/accessible name the browser suite binds to (count of uses in the retro walkthroughs when known). "—" = none found.

### 3.1 Top bar and session chrome

| # | Action / behaviour | Old control (file) | Route / event | New component and control | Hook to preserve | Note |
|---|---|---|---|---|---|---|
| 1 | Back to team | arrow `Link` (`board-header.tsx`) | Inertia GET `links.team` | `SessionFrame` title slot, ghost icon `Button asChild` + `<Link>` | name "Back to the team" (1) | members only |
| 2 | Phase list | `<ol aria-label="Phases">` (`phase-stepper.tsx`) | display | `S/phase-stepper.tsx` `phases`, `current` | `header ol[aria-label="Phases"]`, `[aria-current="step"]` (49) | the stepper must stay inside `<header>` |
| 3 | Previous phase | "Previous" | `PUT retros/{retro}/phase` | `PhaseStepper interactive onPhaseChange` | `header button:has-text("Previous")` | uses `aria-disabled` now |
| 4 | Next / Complete | "Next" / "Complete" | same | same | `press('Next')` (12), `press('Complete')` (11) | ruling 26: in Actions the primary FacilitatorBar action is "Next phase"; the stepper still shows Next |
| 5 | Reopen | "Reopen" | same, target = previous phase | `PhaseStepper reopenTo` | `press('Reopen')` (2) | target becomes `roti` after B1 |
| 6 | Start timer 1/3/5/10 | `TimerControl` dropdown | `PUT retros/{retro}/timer {seconds}` | `S/timer.tsx` `onStart(seconds)`, default presets | `[aria-label="Timer"]` (6), `click('1 min')` (3) | no `onPause`/`onResume` passed: the endpoint has no pause |
| 7 | Stop timer | "Stop timer" item | same `{seconds:null}` | `Timer onStop` | `click('Stop timer')` | |
| 8 | Timer display, end toast, beep | `timer-display.tsx` | client (`use-countdown`, server offset) | `Timer remainingSeconds` fed by `useCountdown`; `onDone` → toast + beep kept in container | `[role="timer"]` (10) | beep code moves to `C/use-timer-alarm.ts` (new hook, client only) |
| 9 | Presence | `presence-strip.tsx` | presence channel | `S/presence-stack.tsx` | `[role="group"][aria-label="2 online"]` (15), `img[data-presence-id]` | adapter §4 |
| 10 | Hide / show my cursor | toggle `aria-pressed` | localStorage `skrum.hideMyCursor` | icon `Button` in `actions` slot | names "Hide my cursor" (5), "Show my cursor" (3) | key constant must stay exported for poker until brief 03 |
| 11 | Language switch (guests) | `LanguageSwitcher` | shared | same component in `actions` slot | `header [aria-label="Language"]` | |
| 12 | Lock badge | `lock-badge.tsx` | display | `ui/badge` in title slot | text "Board closed for editing" | |
| 13 | Facilitator menu | `facilitator-menu.tsx` | client | `ui/dropdown-menu` in `actions` slot, same four items | `[aria-label="Facilitator menu"]` (22), items "Settings…" (10), "Guest link…", "Hand over facilitation…", "Delete retrospective…" (2) | ruling 27 also wants a settings icon in every phase: the icon opens the same popover; the menu item stays |
| 14 | Settings: 13 fields, only changed keys sent | `settings-dialog.tsx` | `PATCH retros/{retro}/settings` | `S/session-settings-popover.tsx` with `useRetroSettingGroups(context)`; `onApply(patch)` | ids `#retro-locked` (14), `#retro-icebreaker` (7), `#retro-ai-summary` (7), `#retro-reactions`, `#retro-hide-vote-counts`, `#retro-health-check` (6 each), `#retro-cursors` (5), `#retro-votes-auto`, `#retro-gifs` (4), `#retro-presentation` (3) — all present in the component | submit button is "Apply", not a `type="submit"` "Save": tests change (§8) |
| 15 | Settings inline errors, 401/419 closes | same | same | `errors` prop; container closes on expiry | — | |
| 16 | Guest link: allow guests | checkbox (`guest-link-dialog.tsx`) | `PATCH settings {guest_access_enabled}` | `S/share-dialog.tsx` `invite.allowGuests`, `onChange` | "Allow guests" | one ShareDialog replaces guest-link dialog + share dialog |
| 17 | Copy guest link | read-only input + Copy | clipboard | `ShareDialog onCopy('url')` | `input[aria-label="Guest link"]`, "Copy guest link" | |
| 18 | Create a new link | button + warning | `POST retros/{retro}/guest-token` | `ShareDialog onRegenerate` (ConfirmDialog inside) | `press('Create a new link')` | now behind a confirmation: test gains one press |
| 19 | Share the board | "Share" button → dialog | client | `Button` "Share" in `actions` → `ShareDialog` | `click('Share')` (9) | hidden when completed or no channel and not facilitator |
| 20 | Post link to a channel (+ include guest link) | `post-link-section.tsx` | `POST retros/{retro}/shares {channel, kind:'link', include_guest_link}` | `ShareDialog channels`, `onShareToChannel(channel, includeGuestLink)` | "Post link to Slack" (8), "…Telegram" (3), "…Microsoft Teams", "…Mattermost", "Send link to webhook" | button labels inside ShareDialog NV |
| 21 | Delivery lines | `integrations/share/delivery-lines.tsx` | `results.changed` → refetch | `ShareDialog channelsExtra` | `[role="dialog"] ul[aria-live="polite"]` (4) | file shared with poker: stays |
| 22 | Hand over facilitation | `handover-dialog.tsx` | `PUT retros/{retro}/facilitator {user_id}` | `S/confirm-dialog.tsx` `FormDialog` + `ui/select` | `[role="listbox"]`, option by name | composed |
| 23 | Delete retrospective | `delete-retro-dialog.tsx` | `DELETE retros/{retro}` → visit team | `ConfirmDialog` destructive | `press('Delete')` (2) | keeps "also deletes N open action items" |
| 24 | Reconnecting banner | `connection-banner.tsx` | Echo status | `S/connection-state.tsx` `status`, `variant="banner"`, `realtime` | `[data-realtime]` = `connecting|connected` | `realtime` prop emits the attribute |
| 25 | Session expired + Reload, board `inert` | `session-expired-banner.tsx` | 401/419 | `ConnectionState status="expired" onReload` | `[role="alert"]:has-text("Your session has expired.")` (2), `click('Reload')` (2) | text and role NV in the new component |
| 26 | Board ended / deleted | `board-ended.tsx` | `retro.deleted`, refetch 403/404 | `S/empty-state.tsx` in `C/board-ended.tsx` | texts "This retrospective has been deleted." / "Your access to this retrospective has ended." | |
| 27 | Send flying reaction | `realtime/flying-reactions.tsx` toolbar | whisper `client-reaction` | `S/reaction-bar.tsx` `onReact`, `picker` = `S/reaction-picker.tsx` (frimousse) | `[role="toolbar"][aria-label="Reactions"]` (5), "Send a reaction 🎉" (5), `click('More emoji…')` (3), `[role="gridcell"][aria-label="Rocket"]`, `button[frimousse-emoji]` | flight animation stays in the `live-reactions` library |
| 28 | Live cursors | `live-cursor-layer.tsx` | whisper `client-cursor` | keep the `live-cursors` library layer | `.lc-overlay` (17 in retro tests), `.lc-cursor` (5) | do NOT switch to `S/live-cursor.tsx` here (notes-for-18e) |
| 29 | Head title | `<Head title>` initial | — | same | — | |

### 3.2 Columns (writing; editing also allowed in health_check)

| # | Action | Old control | Route | New | Hook | Note |
|---|---|---|---|---|---|---|
| 30 | Add column (title + colour) | `add-column.tsx` | `POST retros/{retro}/columns` | composed form: `ui/input` + `S/column-color-picker.tsx` `ColumnColorOptions` | `button:has-text("Add column")`, `input[aria-label="Column title"]` (3), colour radios by name (old "Green", "Blue" → new names) | colour names change with B10 |
| 31 | Rename column | menu → inline input | `PATCH …/columns/{column} {title}` | `RetroColumn onRename` | `[aria-label="Column menu"]` (5), "Column title" | disabled with cards: `editDisabledReason` |
| 32 | Edit description | menu → dialog | same `{description}` | `RetroColumn onDescriptionChange` | `[role="menuitem"]:has-text("Edit description")` (2) | |
| 33 | Recolour | 6 `menuitemradio` | same `{color}` | `RetroColumn colorOptions`, `onColorChange` | radio names | 8 colours |
| 34 | Move left / right | menu items | `PUT …/column-order {column_ids}` | `RetroColumn onMove`, `canMoveLeft/Right` | — | |
| 35 | Delete column | menu → confirm | `DELETE …/columns/{column}` | `RetroColumn onDelete` | `[role="menuitem"]:has-text("Delete column")` (2) | only empty columns |
| 36 | Description tooltip, card count | header | display | `RetroColumn description`, `count` | `[data-slot="tooltip-content"]` | |
| 37 | Column test id | `data-test="retro-column-{id}"` | — | passed as a rest prop of `RetroColumn` (it spreads `<section>` props; it does not emit it itself) | `[data-test^="retro-column-"]` (20), `main:has([data-test^="retro-column-"])` (5) | the columns must stay inside a `<main>` |
| 38 | Sort by votes (discussing → completed) | toggle | client | `RetroColumn sortedByVotes`, `onSortByVotesChange` | `data-test="retro-sort-by-votes"` (emitted by the component) | default ON |
| 39 | Empty board | "No columns yet." | — | `EmptyState` | text | |

### 3.3 Cards

| # | Action | Old control | Route | New | Hook | Note |
|---|---|---|---|---|---|---|
| 40 | Compose card | `card-composer.tsx` textarea | `POST retros/{retro}/cards` | `RetroColumn onAdd` + `RetroCard editing` with `editorTools` (GIF button) | `[aria-label="Add a card…"]` (13) | the new editing textarea is named "Card text" and the column button "Add a card": see risk 1 |
| 41 | Attach GIF | `gif-picker.tsx` → `gifs/gif-search-dialog.tsx` | `GET retros/{retro}/gifs?q=` | `S/gif-picker.tsx` (`results`, `status`, `onQueryChange`, `provider`) | "GIF" (7), "Search GIFs…", "Choose this GIF", "Remove GIF" | `gif-search-dialog.tsx` stays (games use it) |
| 42 | Edit card | pencil → `card-editor.tsx` | `PATCH …/cards/{card}` | `RetroCard editing`, `onEdit`, `onEditStart/Cancel` | `#card-{id} textarea` (6), "Edit card" (5) | unsaved-edit toast on phase change stays in container |
| 43 | Delete card | trash | `DELETE …/cards/{card}` + refetch | `RetroCard onDelete` | "Delete card" (4) | |
| 44 | Reorder / move own card | `dnd.tsx` `SortableCard` | `PUT …/cards/{card}/position` | dnd-kit wrapper around `RetroCard` (ref and rest props forwarded) | `data-test="retro-card-handle-{id}"` (`@retro-card-handle-…`, 4 tests), `aria-pressed`, `aria-disabled` | handle is container markup |
| 45 | Card DOM id, masked state | `id="card-{id}"`, "Hidden until writing ends" | — | `RetroCard` (default `id="card-{id}"`), `masked` | `#card-{id}` (154), `article[id^="card-"]` (6) | masked text NV in new component |
| 46 | "You" badge, author, anonymous | card header | — | `RetroCard isMine`, `author` | text "You" | |
| 47 | Open GIF full size | `card-gif.tsx` dialog | client | `RetroCard gif`, `onGifOpen` + `ui/dialog` | `[role="dialog"] img` | |
| 48 | Card insight (sentiment, category) | `card-insight.tsx` | display | `RetroCard insight` | names "Positive", "Negative" (5), "Neutral" | |
| 49 | Group cards (drop on card) | `GroupableCard` | `PUT …/cards/{card}/group` | dnd-kit + `S/card-group.tsx` `dropTarget` | keyboard drag helper `dragWithKeyboard(..., handleRemains: false)` | |
| 50 | Move card to a column in grouping | drop on column | position route | `RetroColumn isDropTarget` | — | |
| 51 | Ungroup | icon on child | `DELETE …/cards/{card}/group` | `CardGroup onUngroup(cardId)` | "Ungroup" (3) | |
| 52 | Name / rename group | `group-name.tsx` | `PUT/DELETE …/cards/{card}/group-name` | `CardGroup onRename(title|null)`, `canEdit` | "Rename group" (12), "Group name" (3), "Name this group" | selector `#card-{lead} [aria-label="Rename group"]` no longer matches: §8 |
| 53 | Suggest group names (AI) | `SuggestGroupNamesButton` | `POST …/group-name-suggestions` | FacilitatorBar-independent `Button` in help banner; suggestion in `CardGroup titleHint` | `click('Suggest group names')`, `[title="Suggested name"]` | available to everyone, so not a facilitator action |
| 54 | Use / edit suggested name | two buttons | `PUT …/group-name` / client | buttons inside `titleHint` | "Use this name", "Edit this name" | |
| 55 | Vote + / − | `vote-controls.tsx` | `POST/DELETE …/cards/{card}/votes` | `RetroCard votes`, `canVote`, `onVote(±1)`; group: `CardGroup votes` | "Add a vote" (12), "Remove a vote" (4), sr "Your votes: n" | optimistic `votes.tally` unchanged |
| 56 | Vote total | badge | display | `RetroCard votes.total` (null hides) | aria-label `/^\d+ votes?$/` ("1 vote", "2 votes", "3 votes") | |
| 57 | Votes left + progress | `vote-progress.tsx` | display | `S/vote-dots.tsx` `VoteBudget total remaining` + `ui/progress` | `[role="progressbar"]` (2) | |
| 58 | Discuss (highlight) | toggle `aria-pressed` | `PUT retros/{retro}/highlight` | `RetroCard onFocusToggle`, `focused` | `#card-{id} button[aria-pressed=…]`, text "Discuss" NV | facilitator |
| 59 | Presentation overlay / stop | `presentation-overlay.tsx` | same `{card_id:null}` / client dismiss | composed `ui/dialog` with `RetroCard`/`CardGroup` | `press('Stop presenting')`, `[role="dialog"]` | |
| 60 | Scroll to highlighted card | effect | `card.highlighted` | same effect in container | — | |
| 61 | React to card | `card-reactions.tsx` → `reaction-chips.tsx` | `PUT/DELETE …/cards/{card}/reactions` | `RetroCard reactions`, `onReact`, `reactionPicker` | "Add a reaction" (7), "👍, 1 reaction" (2), `[role="menuitem"]:has-text("🎉")` (3) | chip names NV in the new card ("React with :emoji" exists) |
| 62 | Full emoji picker | `emoji-picker.tsx` (frimousse) | `GET emoji-data/…` | `S/reaction-picker.tsx` | "Search emoji…", `button[frimousse-emoji]` | |
| 63 | Toggle comments, unread dot | `card-comments.tsx` | client + localStorage | `RetroCard commentCount`, `commentsOpen`, `onOpenComments`, `footer` (dot) | "Comments (1)" (14), "Comments (0)", "Comments (2)", "Unread comments" | |
| 64 | Add comment / reply | `comment-thread.tsx` | `POST …/cards/{card}/comments` | composed thread as `RetroCard children` | "Write a comment…" (8), "Write a reply…" (2) | |
| 65 | Edit / delete comment, expand replies | same | `PATCH/DELETE …/comments/{comment}` | same | "Edit comment" (2), "Delete comment" (5) | |
| 66 | Comment notification toast | hook | `comment.notification` | unchanged (`use-retro-board.ts`) | `[data-sonner-toast]` (3) | |
| 67 | Drag overlay, a11y announcements, drag isolation | `dnd.tsx` | — | rewritten in place, same behaviour | — | |

### 3.4 Phase bodies

| # | Action | Old control | Route | New | Hook | Note |
|---|---|---|---|---|---|---|
| 68 | Health: score 1..10 | `health-check-panel.tsx` | `PUT retros/{retro}/health-check/{statement}` | `S/health-check-form.tsx` `onAnswer(key, value)` | `ol > li [role="radiogroup"]`, `[role="radio"][aria-checked="true"]`, "Score n", "Answered" (2) | the `ol > li` structure is NV in the new form |
| 69 | Health: clear | "Clear" | `DELETE` same | `onClear(key)` | name is now "Clear: :label" — old tests press "Clear" NV | |
| 70 | Health: respondents avatars, count | panel | `health.answered` | statement `answeredBy`, `count` | `ol > li:has([role="radiogroup"]) img` (2) | |
| 71 | Icebreaker stage | `icebreaker-stage.tsx`, `icebreaker-game.tsx` | game routes; events on `presence-retro` | frame + `GamePanel`, `GameSwitcher`, `HistoryDrawer` from `components/games` | `section[aria-label="Icebreaker game"]` (12), `[aria-label="Game"]` (8), `[role="group"][aria-label="Letters"]` | game internals: brief 06 |
| 72 | Surveys column, Add survey | `surveys-column.tsx` | survey routes | OLD components mounted as first child of the board `<main>`; `SessionSettingsPopover onAddSurvey` + the existing `AddSurveyButton` | `section[aria-label="Surveys"]`, `click('Add survey')` (3) | brief 08 |
| 73 | Suggestions panel (themes, promote, reject, dismissed) | `suggestions-panel.tsx`, `insights/suggestions-list.tsx` | `POST …/suggested-actions/{id}/promotion`, `DELETE …/suggested-actions/{id}` | composed `ui/card` + `ui/accordion` (Dismissed) | `aside[aria-label="Suggestions"]` (3) | phases: discussing, actions, completed |
| 74 | Create action item | `AI/action-item-form.tsx` | `POST retros/{retro}/action-items` | composed quick form (ScreenRetroActions) | `[aria-label="Add an action item…"]` (18), `[data-test="retro-action-items-panel"]` (9), "Priority", "Due date", "Repeat", "Assignee" | |
| 75 | Done / reopen | checkbox | `PATCH …/action-items/{id} {status}` | `S/action-item.tsx` `onStatusChange` | "Mark as done" (21), "Reopen" (13), `#action-item-{id}` (35) | `id` passed as rest prop |
| 76 | Edit content, priority, due date, recurrence, assignee | inline controls | same PATCH | `ActionItem onChange(patch)`, `members`, `editing` | "Edit action item" (3) | adapter §4 |
| 77 | Delete action item | trash | `DELETE …/action-items/{id}` | `ActionItem onDelete` | "Delete action item" (4) | |
| 78 | Sub-tasks add / tick / rename / move / delete | `AI/subtask-checklist.tsx` | subtasks routes | composed list as `ActionItem children` | "Sub-tasks" (2), "Add a sub-task", "Move up" (2), "Move down", "Edit sub-task", "Delete sub-task", "1 of 3 sub-tasks done" | |
| 79 | Action item comments | `AI/action-item-comments.tsx` | comments routes | `ActionItem comments`, `onToggleComments` | `#action-item-{id}-comments` (3) | |
| 80 | Export to tracker + preview + targets | `AI/export-action-item-button.tsx`, `export-action-item-dialog.tsx` | exports routes, targets route | `ActionItem actions` slot + composed dialog | "Export" (3), "Export to Linear" (3), "Export to Jira", `[role="dialog"] button:has-text("Export")` (8), "Linear team", "Issue type", "Project" | |
| 81 | External link chips, retry sync | `AI/external-link-chips.tsx` | sync route | `ActionItem links`, `onRetrySync` | `#action-item-{id} a[href=…]` (4), `a[title=…]` | |
| 82 | Anonymous notice | `AI/anonymous-notice.tsx` | — | `ui/alert` above form | text | |
| 83 | Carried items sheet (auto-open once) | `carried-action-items-panel.tsx` | workspace action-item routes; `private-retro-members` | `ui/sheet` + `ActionItem` list | `button:has-text("Previous action items (1)")`, `(0)` | `onCloseAutoFocus={useRestoreFocus(open)}` |
| 84 | ROTI: rate 1..5, click again removes | `roti-control.tsx` | `PUT/DELETE retros/{retro}/roti` | `S/roti-widget.tsx` `mode="vote"`, `value`, `onVote` (same value → DELETE) | `[role="group"][aria-label="How was this retro?"]` (3), `button[aria-pressed]` | phase `roti` after B2 |
| 85 | ROTI respondent count | ":count rating(s)" | `roti.changed` | "Who voted" card: count only (see §6) | text | |

### 3.5 Completed (session end)

| # | Action | Old control | Route | New | Hook | Note |
|---|---|---|---|---|---|---|
| 86 | Results / Board tabs | `results/completed-tabs.tsx` | client | `ui/tabs` with the same ids | `#completed-tab-results` (7), `#completed-tab-board` (9), `[role="tabpanel"]` | reset to Results on phase change |
| 87 | Completed date, participants | `results-view.tsx`, `participants-section.tsx` | — | header + `S/avatar-stack.tsx` / list | "Thanks for participating" NV | |
| 88 | Summary generate / retry / regenerate / remove | `insights/summary-section.tsx` | `POST/DELETE retros/{retro}/summary` | composed `ui/card`, `Skeleton` while pending | `[aria-labelledby="results-summary"]` (7) | facilitator only |
| 89 | Health results (radar, stats, trend, statements) | `health-section.tsx`, `health-radar.tsx`, `health-trend.tsx` | — | `S/health-check-results.tsx` (`results`, `summary`, `children` = radar + trend) | `svg[aria-label="Team health radar"]` (4), `svg[aria-label="Trend across retros"]` (2) | radar SVG is kept as a container-side component: no `skrum/` radar |
| 90 | Top topics | `top-topics.tsx` | — | composed list (`CardGroup collapsed` / `RetroCard`) | text "Top topics" | |
| 91 | Action items (read only) + link to team items | `action-items-results.tsx` | — | `ActionItem` without handlers | `li[id^="action-item-"]` NV, "Done" (2) | |
| 92 | Games played, podium, replay | `games-played-*.tsx`, `round-replay-dialog.tsx` | `GET games/{room}/rounds/{round}` | `S/games-leaderboard.tsx` + composed rounds list | `[role="tabpanel"] li:has-text("Casey") [aria-label="6 points"]`, "Points of this round", "Drawing of rocket" | selectors bound to `<li>` and to `tabpanel` |
| 93 | ROTI results + still votable (legacy) | `roti-section.tsx` | §84 | `ROTIWidget mode="result"` (+ vote mode when the server allows) | "How was this retro?" | B2 |
| 94 | Share results to channel | `results-share-menu.tsx`, `recap-share-dialog.tsx` | `POST …/shares {kind:'results'}` | `ui/dropdown-menu` "Share" + composed dialog | `click('Share to Slack')`, `click('Share to Telegram')`, `[role="dialog"] button:has-text("Send")` (3) | |
| 95 | E-mail the results | `email-results-dialog.tsx` | `POST …/results-email {audience}` | primary button "Send the recap by e-mail" opening the same dialog | `click('Send to email')` (3) | mockup makes it a primary button: label change (§8) |
| 96 | Delivery lines | `delivery-lines.tsx` | refetch | same component | `ul[aria-live="polite"]` | |
| 97 | Survey results | `results/survey-result.tsx` | — | old component mounted | `article[aria-label=…]` | brief 08 |
| 98 | Read-only board tab | board `<main>` | — | same columns without handlers | `main:has([data-test^="retro-column-"])` | |

### 3.6 Join and session ended

| # | Action | Old control | Route | New | Hook | Note |
|---|---|---|---|---|---|---|
| 99 | Join as guest | Inertia `<Form>` (`pages/retros/join.tsx`) | `POST join/{guestToken}` | `GuestJoin session={{kind:'retro', title}} initialName onSubmit` → `router.post` | `#name` (4), `click('Join')` (2) (helper `joinAsGuest`) | field id and button label NV in `guest-join.tsx` |
| 100 | Invalid link | heading | 404 props | `EmptyState` | text "This guest link is no longer valid." | |
| 101 | Session ended → Log in | `Button asChild` `Link` | `login()` | `EmptyState` primary action | texts "Your session has ended.", "Log in" | page is shared by poker, games, whiteboard |

101 rows. Survey actions (inventory §1, 20 rows) are covered by brief 08 and only appear as rows 72 and 97.

## 4. Composition

### 4.1 Containers (all under `resources/js/components/retro/`)

| File | Role | `skrum/` + `ui/` used |
|---|---|---|
| `board.tsx` (rewritten) | `useRetroBoard(snapshot)`, `BoardProvider`, `SessionLayout`, phase switch, DnD context, `data-realtime` | `SessionLayout`, `ConnectionState` |
| `board-context.tsx` (kept) | context, unchanged shape | — |
| `board-topbar.tsx` | title, back, lock badge; builds `phases`, `timer`, `presence`, `actions` slots | `PhaseStepper`, `Timer`, `PresenceStack`, `Button`, `Badge`, `DropdownMenu` |
| `board-settings.tsx` | settings values, patch, errors | `SessionSettingsPopover`, `useRetroSettingGroups` |
| `board-share.tsx` | guest link + channel posts | `ShareDialog`, `delivery-lines` |
| `board-dialogs.tsx` | hand-over, delete | `FormDialog`, `ConfirmDialog`, `Select` |
| `board-reactions.tsx` | whisper transport ↔ bar | `ReactionBar`, `ReactionPicker` |
| `board-cursors.tsx` | `live-cursors` layer (moved from `live-cursor-layer.tsx` once poker is rewritten) | — |
| `facilitator-dock.tsx` | per-phase `FacilitatorAction[]` + ReactionBar stacked with `space-3` (ruling 27/28) | `FacilitatorBar`, `ReactionBar` |
| `columns-board.tsx`, `board-column.tsx`, `board-card.tsx` | columns and cards for writing → voting and the completed board tab | `RetroColumn`, `RetroCard`, `CardGroup`, `GifPicker`, `ColumnColorOptions` |
| `card-thread.tsx` (in place: `comment-thread.tsx`) | comment threads | `TextareaField`, `Button`, `Avatar` |
| `phase-health.tsx` | health form | `HealthCheckForm` |
| `phase-icebreaker.tsx` | stage | `components/games/*` |
| `phase-voting-bar.tsx` | budget and progress | `VoteBudget`, `Progress`, `Badge` |
| `phase-discussing.tsx` | topics list, focus, overlay, suggestions, actions of topic | `CardGroup`, `RetroCard`, `ActionItem`, `Dialog` |
| `phase-actions.tsx`, `action-items-list.tsx`, `action-item-create.tsx`, `carried-items-sheet.tsx`, `export-dialog.tsx` | Actions phase | `ActionItem`, `Sheet`, `Select`, `DatePicker`, `Combobox` |
| `phase-roti.tsx` | ROTI | `ROTIWidget`, `PresenceStack`/`AvatarStack`, `Progress` |
| `session-end.tsx` + `results/*` (new, smaller set) | completed | `StatCard`, `ActionItem`, `ROTIWidget`, `HealthCheckResults`, `GamesLeaderboard`, `Tabs`, `DropdownMenu` |

FacilitatorBar actions per phase (ruling 28; only actions that exist today):

| Phase | `actions` | `primary` |
|---|---|---|
| health_check, icebreaker, writing | Lock board (`is_locked` toggle), Anonymous is NOT togglable once cards exist → omitted | Next phase |
| grouping | Lock board | Next phase |
| voting | Lock board, Hide vote counts toggle (`hide_vote_counts`; this is the mockup's "Reveal votes") | Next phase |
| discussing | Presentation mode toggle, Stop presenting | Next phase |
| actions | — | Next phase (ruling 26) |
| roti | — | Complete ("End the session") |
| completed | none: no FacilitatorBar; ReactionBar alone is also not rendered (reactions are off when completed today) | — |

Timer controls stay in the top-bar `Timer` (start, stop). "+2 min" is offered through `Timer onAdd` only if the PO accepts a client-side "remaining + n" PUT (Decisions needed).

### 4.2 Composed from primitives (no dedicated component)

Card composer (RetroCard `editing` + `editorTools`), add-column form, comment threads, suggestions panel, action-item create form and sub-task checklist, export dialog, carried-items sheet, presentation overlay, results blocks (participants, summary, top topics, games rounds, radar, trend), recap share and e-mail dialogs, hand-over and delete dialogs, vote progress, unread-comment dot, help banner per phase, topics list of Discussion/Actions, "Who voted" card, session-end stats row and header.

### 4.3 Adapters (server shape → component props)

| Target | Field mapping |
|---|---|
| `PhaseStepper.phases` | `retro.phases.map(p => ({ id: p, label: t(PhaseLabels[p]) }))`; `current = retro.phase`; `interactive = viewer.isFacilitator`; `reopenTo = previous phase id` (after B1: `roti`); `leaderName` = facilitator participant name; `onPhaseChange(p)` → `req(RetroPhasesController.update)` then `refetch()`. `PhaseLabels` moves to `lib/retro/phases.ts` and gains `actions: 'Actions'`, `roti: 'ROTI'` (both keys already exist in `lang/en.json`) |
| `Timer` | `remainingSeconds = timerEndsAt ? useCountdown(timerEndsAt, offset) : null`; `onStart(s)` → `PUT timer {seconds:s}`; `onStop` → `{seconds:null}`; handlers only for the facilitator and `phase !== 'completed'` |
| `PresenceStack.participants` | from `online` (`PresenceMember {id,name,avatarUrl,isGuest}`): `role = id === retro.facilitatorParticipantId ? 'facilitator' : isGuest ? 'guest' : 'member'`, `status: 'online'`, `isMe = id === viewer.participantId`. `presence` colour: none on the server (ruling 7) → omit |
| `RetroColumn` | `id, title, description, color, count = top-level cards`; `canAdd = phase==='writing' && isEditable`; `editDisabledReason` when the column has cards; `colorOptions` = the 8 colours after B10; `data-test={`retro-column-${id}`}` |
| `RetroCard` | `text = content`, `masked = hidden`, `author = author ? {id,name,avatarUrl: participants.find(id).avatarUrl} : null`, `gif = gif && {previewUrl, url}`, `isMine`, `insight = {sentiment, category}`, `reactions` (as is), `votes = {total: votes, mine: myVotes}`, `canVote = phase==='voting' && isEditable && remainingVotes>0`, `canEdit = isMine && phase in (writing, grouping) && isEditable`, `commentCount`, `focused = id === highlightedCardId`, `maxLength = 1000` |
| `CardGroup` | lead card + `childrenOf(lead)`: `id = lead.id`, `title = lead.groupName ?? ''`, `cards = [lead, ...children]` mapped as above, `votes` = the lead's, `canEdit = phase in NamingPhases && isEditable`, `titleMaxLength = 60`; a lead with no child renders as a plain `RetroCard` |
| `VoteBudget` | `total = retro.votesPerParticipant`, `remaining = viewer.remainingVotes` |
| `HealthCheckForm` | `statements = healthCheck.statements` (`key`, `label`/`text`, `myScore`, `count`, `answeredBy`) — exact server field names to re-read in `PresentHealthCheck` (NV); `disabled = !isEditable` |
| `HealthCheckResults` | `results = results.health.statements` (`average`, `key`), `respondents/participants = health.participation.*`, `summary = {score, topStrength, growthArea, alignment:{value,label}, assessment:{title,sentence}}`, `minimumRespondents = 0` |
| `ROTIWidget` | vote: `value = roti.myScore`, `onVote(v)` → `v === myScore ? DELETE : PUT {score:v}`. result: `{ mean: results.roti.average, votes: results.roti.respondents, distribution: {1..5} from distribution[] }`, `minimumRespondents = 0` |
| `ActionItem` | `title = content`, `owner = assignee && {id, name, kind, isTeamMember}`, `dueDate = dueOn`, `links = externalLinks`, `source = {label: retro title, retroId}`, `subtasks`, `commentCount`, `completedVia`, `themeName`, `recurrence`, `canComplete`/manage from `lib/action-items/permissions.ts`; never pass `withDoing` (status `doing` is backlog) |
| `ShareDialog` | `session = {id, kind:'retro', title}`, `invite = {url: retro.guestUrl, allowGuests: retro.guestAccessEnabled}`, `canManage = viewer.isFacilitator`, `channels` from `integrations`, no `members`/`onInvite` (backlog), no `code`, no `expiry` |
| `SessionSettingsPopover` | `value: RetroSettingsValues` from `retro.*` (snake_case keys as the endpoint expects), `groups = useRetroSettingGroups({phase, isAnonymous, icebreakerGame, votesPerParticipant, hasCards, hasAnswers, icebreakerGames, gifProvider, llmProvider: features.llmProvider})`, `readOnly = !viewer.isFacilitator` |
| `GuestJoin` | `session = {kind:'retro', title: retroTitle}`, `initialName = suggestedName`, `error = errors.name && {field:'name', message}`, `loginUrl = login().url`, no `takenColors` |
| `StatCard` ×5 (session end) | B3 props, §7 |

### 4.4 Reused as they are

`hooks/use-retro-board.ts`, `use-retro-channel.ts`, `use-comment-notifications.ts`, `use-countdown.ts`, `use-local-preference.ts`, `use-clipboard.ts`, `use-trans.ts`; `lib/retro/api.ts`, `board-reducer.ts`, `emoji.ts`, `survey-api.ts`; `lib/action-items/*`; `lib/realtime/whisper-transport.ts`; `lib/integrations.ts`. Changed only for B1/B10: `lib/retro/types.ts` (`RetroPhase`, `ColumnColor`), `lib/retro/colors.ts`, and the single phase test in `use-retro-board.ts:341`.

## 5. Realtime

Hook chain unchanged: `useRetroChannel` → `useRetroBoard` → `boardReducer`. Channels `presence-retro.{id}`, `private-participant.{id}`, `private-retro-members.{id}` (non-guests).

| Event / whisper | Lands in |
|---|---|
| `card.*`, `cards.moved`, `card.grouped/ungrouped/group-named` | `columns-board.tsx` → `RetroCard` / `CardGroup` props |
| `vote.cast`, `vote.retracted` | `phase-voting-bar.tsx` (progress), card `votes` |
| `card.reactions.changed`, `comment.*`, `own-card.saved`, `own-comment.saved` | `board-card.tsx`, `card-thread.tsx` |
| `comment.notification` | toast (hook) + unread dot (`RetroCard footer`) |
| `timer.changed` | top-bar `Timer`; in icebreaker also the game timer |
| `card.highlighted` | `phase-discussing.tsx` / `phase-actions.tsx`: focus ring, scroll, overlay |
| `columns.changed` | `columns-board.tsx` |
| `phase.changed`, `settings.changed` | full refetch → whole tree, stepper, FacilitatorBar |
| `retro.deleted` | `board-ended.tsx` |
| `action-item.*`, `carried-action-item.*`, `action-item.external-links.changed` | `action-items-list.tsx`, `carried-items-sheet.tsx` |
| `health.answered` | `phase-health.tsx` |
| `roti.changed` | `phase-roti.tsx`; `use-retro-board.ts:341` refetches only in `completed` — with B2 the ROTI phase shows only a respondent count, so no change needed there |
| `insights.changed`, `results.changed` | debounced refetch → `session-end.tsx`, `board-share.tsx` (deliveries) |
| `survey.*` | old survey components (brief 08) |
| `game.*` | `phase-icebreaker.tsx` via `subscribeGameEvents` |
| whisper `client-cursor` | `live-cursors` library layer over the board `<main>` and the icebreaker stage; off in voting and completed |
| whisper `client-reaction` | `board-reactions.tsx`: `ReactionBar onReact` sends; receive filter (roster, single emoji, token bucket) and the flight from `[data-presence-id]` stay as in `realtime/flying-reactions.tsx` |

Decide for the new phases: cursors in `actions` (yes, like discussing) and `roti` (proposal: off, like voting — a pointer over a score reveals a vote).

Two-browser checks that must keep passing (member + guest, no reload): presence count and avatars; a card written by A appears masked for B and revealed on Grouping; group and rename; vote counts hidden then shown; highlight scrolls B; action item created by a guest; phase walk through `actions` and `roti` to `completed` (acceptance criterion 9); guest-link rotation ends the guest's board; lock disables B's controls; flying reaction from A rises from A's avatar on B; cursor label "Participant" on anonymous retros.

## 6. Mockup elements not rendered, and elements with no mockup

Not rendered (spec §10 or no back end):

| Mockup | Element | Reason |
|---|---|---|
| Writing | counter "6/8 have written", "Inès is writing a card…" typing indicator, avatar ring "writing" | no typing whisper, no per-participant card count for hidden cards |
| Writing | FacilitatorBar Pause, "+2 min", "Reveal the cards" | no pause endpoint; reveal = next phase; +2 min see Decisions |
| Writing | "Visible only to you" per-card anonymity | anonymity is a retro setting |
| Grouping | duplicate detection, "Group duplicates automatically", "Probable duplicate" pill | §10 |
| Grouping | "Undo last group" | §10 |
| Grouping | "Yuki is moving a card…", cursor holding a dragged card | no drag whisper |
| Vote | "max 2 per card" rule, "5/8 have finished", "I have finished voting" | no per-card cap on the server; "finished voting" flag is §10 |
| Vote | "Votes per person" in the FacilitatorBar | locked once voting started (server rule); stays in settings |
| Discussion | per-topic timer, estimated time, "Everyone follows" toggle and "Back to the topic", shared discussion notes | per-phase timers and collaborative notes are §10; follow = existing highlight + presentation mode only |
| Discussion / Actions | Jira ticket field in the create form, ⌘J, "Export to Jira" bulk button | export is per item through the existing dialog; bulk sync is §10 |
| Actions | "Action created" toast with Undo | no undo endpoint; plain success toast is allowed |
| Actions | "Close the retro" in the FacilitatorBar | ruling 26: "Next phase" |
| ROTI | hidden-votes block until reveal, "Reveal the ROTI", "Nudge the last 2", per-participant "Voted / Thinking" list | the server sends only `respondents` (a count); ROTI nudge is §10. Rendered instead: "n of m voted" with a progress bar |
| Session end | Export menu PDF / CSV / Markdown | no such route (only per-item tracker export). Not in §10 either: reported as a gap |
| Session end | ROTI delta vs previous sprint, ROTI sparkline (`MoodTrendChart`) | no ROTI trend prop (`healthTrend` only) |
| Session end | health "delta vs previous retro" per statement | only if `previousAverage` can be derived from `healthTrend` (NV) |
| Session end | confetti | allowed by the spec (criterion 12) but needs `animate-confetti` in `app.css`; presence in the design-system CSS NV |
| MobileRetro | swipe between columns | tabs only unless a swipe handler is accepted; assignee as avatar chips, Jira ticket creation in the drawer |

No mockup, designed from neighbours:

| Element | How |
|---|---|
| Health check phase | `HealthCheckForm` in a centred card above the columns area of the ScreenRetroWriting frame; help banner reuses the Writing banner |
| Icebreaker phase | ScreenIcebreaker stage inside the retro frame (title, game switcher, history) |
| Surveys column | stays as today until brief 08 |
| Results: participants, summary, top topics, games, survey results, health radar/trend | cards under the stats row of the session-end frame, in the order of the old `ResultsView`; tabs Results / Board under the header |
| Suggestions panel | right column card, like "Actions du sujet" in ScreenRetroDiscussion |
| Carried items sheet, export dialog, hand-over, delete, recap dialogs | Sheet / Dialog READMEs |
| Board ended, session ended, invalid join link | `EmptyState` (ScreenErrors) |
| Presentation overlay | Dialog with the focused `CardGroup` of ScreenRetroDiscussion |

## 7. Back-end changes (B1, B2, B3, B10)

### 7.1 B1 — `RetroPhase::Actions = 'actions'`, `RetroPhase::Roti = 'roti'` (between `Discussing` and `Completed`)

No data migration: `retros.phase` is a string; open retros in `discussing` simply get two more "Next". Every PHP consumer found by `grep -rn RetroPhase app database routes config` (54 files):

Must change:

| File:line | Today | Change |
|---|---|---|
| `app/Enums/RetroPhase.php` | 7 cases, `label()` | add both cases in order, labels `__('Actions')`, `__('ROTI')` (keys exist in the four lang files — check fr/es/de values) |
| `app/Models/Retro.php:95` `showsVoteTotals()` | Discussing, Completed | add Actions, Roti (else totals vanish after discussing) |
| `app/Actions/Retros/ChangeRetroPhase.php:94-101` `move()` | clears `highlighted_card_id` when leaving Discussing | keep the highlight Discussing ↔ Actions, clear when leaving that pair |
| `app/Http/Controllers/Retros/RetroHighlightsController.php:24,39` | Discussing | add Actions ("Next topic" of ScreenRetroActions) |
| `app/Http/Controllers/Concerns/LocksDiscussingRetro.php:14` (used by `Retros/ActionItemsController`, `ActionItemSubtasksController`, `ActionItemCommentsController`, 9 call sites) | Discussing | Discussing + Actions (+ Roti: Decisions) |
| `app/Actions/Retros/SuggestionGuard.php:35,37,48,52` | Discussing (anyone, unlocked) / Completed (facilitator, admin) | treat Actions (and Roti) like Discussing |
| `app/Actions/Retros/BuildInsights.php:30` | Discussing, Completed | add Actions, Roti |
| `app/Actions/Retros/RetroGuard.php:37` `groupNaming()` | Grouping, Voting, Discussing | add Actions (Decisions) |
| `app/Http/Controllers/Retros/CardReactionsController.php:75` | Grouping, Voting, Discussing | add Actions (Decisions) |
| `app/Http/Controllers/Retros/CardCommentsController.php:147` | same | add Actions (Decisions) |
| `app/Actions/Surveys/SurveyGuard.php:17` | Writing … Discussing | brief 08 decides; surveys auto-close only on Completed, so today's behaviour implies adding Actions and Roti |
| `app/Mcp/Tools/Retro/CreateAction.php:81,89` + description `:34` | Discussing | follow `LocksDiscussingRetro`; reword "only while the board is in the Discussing phase" |
| `app/Mcp/Tools/Retro/UpdateAction.php:91` + descriptions `:36,:53` | Discussing | same |
| `app/Mcp/Tools/Retro/ListInsights.php:57` | Discussing, Completed | follow `BuildInsights` |
| `app/Mcp/Tools/Retro/PromoteSuggestion.php:29` (description) | "While the board is discussing…" | reword |
| `app/Mcp/Servers/SkrumServer.php:44` (instructions) | lists seven phases | add actions, roti |
| `app/Mcp/Presenters/McpBoard.php:50` | exposes `phase` value | no code change; PUBLIC payload gains two values — document |
| `app/Http/Controllers/TeamsController.php:81-82` | `phase`, `phaseLabel` | no code change; new labels appear on the team page |
| `app/Http/Controllers/Retros/RetroPhasesController.php:27` | `Rule::enum` | no code change; accepts the new values |
| `app/Actions/Retros/BuildBoardSnapshot.php:96-97` | `phase`, `phases` | no code change; payload gains two values |
| `app/Events/Retros/PhaseChanged.php` | `{phase}` | none (payload ignored by the client) |

Front: `lib/retro/types.ts:15` (`RetroPhase`), `PhaseLabels`, phase lists in the new containers (`NamingPhases`, `CommentPhases`, reaction phases, cursor phases, `ColumnEditPhases`), `S/session-settings-popover.tsx:182` (already tolerant: `SessionPhase` is a string). `board-reducer.ts` has no phase logic (grep: none).

No change (compare with HealthCheck, Icebreaker, Writing, Grouping, Voting or Completed only; read from the grep line, not each method): `ActionItems/ActionItemPermissions.php:213,224`, `ActionItems/BroadcastActionItemChange.php:108,119`, `ActionItems/WorkspaceActionItemGuard.php:35`, `Games/GameGuard.php:30`, `Games/ScheduleIcebreakerExpiry.php:21`, `HealthCheck/BuildHealthTrend.php:38`, `HealthCheck/ManageTeamHealthStatements.php:147`, `Retros/BuildResults.php:50`, `Retros/ClearRetroInsights.php:56`, `Retros/StoreRetroInsights.php:22`, `Retros/DeleteCard.php`, `Retros/UpdateCard.php`, `ChangeRetroPhase.php` other methods (summary, icebreaker, surveys, completion), `BuildBoardSnapshot.php:126,167,310`, controllers `CardGroupsController`, `CardPositionsController`, `CardVotesController`, `CardsController`, `ColumnOrdersController`, `ColumnsController`, `HealthCheckAnswersController`, `RetroGifsController`, `RetroSettingsController:74,124-125`, `RetroSummariesController:82`, `Integrations/RetroSharesController:73`, `Integrations/RetroResultsEmailsController:50`, `WorkspaceActionItemsController:77`, `Jobs/GenerateRetroSummary.php:81`, `Notifications/RetroResultsNotification.php:43`, MCP `GetHealth`, `GetSummary`, `ListBoards`, `ListTeams`, `SearchBoards`, `Prompts/TeamHealth`, `database/factories/RetroFactory.php`, `routes/web.php`.
Webhooks and exports: `grep -rniE "phase" app/Actions/Integrations app/Notifications app/Support/Integrations` finds no phase in an outgoing payload; `RetroCompleted` still fires on Completed only. Recap content (`BuildRetroRecap`) not read (NV).

Tests: 105 files under `tests/` mention `RetroPhase`. Those that encode the neighbour rule or the phase list and must change: `tests/Feature/Retros/RetroModelTest.php` (`phases()`, `isOpen`, neighbours), `FacilitationTest.php`, `RetroGuardTest.php`, `ActionItemsTest.php`, `SuggestedActionsTest.php`, `BoardSnapshotTest.php`, `ResultsTest.php`, `RetroCompletedTest.php`, `tests/Feature/Mcp/ActionItemWriteToolsTest.php`, `InsightsHealthRotiTest.php`, `SuggestionToolsTest.php`, `McpSweepTest.php`. New feature tests: neighbour walk through the nine phases; action items writable in `actions`; highlight kept across discussing ↔ actions; vote totals visible in `actions`/`roti`.

### 7.2 B2 — ROTI in phase `roti`

| File:line | Today | Change |
|---|---|---|
| `app/Http/Controllers/Retros/RetroRotiController.php:63` | Discussing, Completed | Roti; Completed only for retros completed before the change |
| `app/Mcp/Tools/Retro/GetRoti.php:50,58` | Discussing (pending), Completed | Roti (pending), Completed |
| `BuildBoardSnapshot::roti()` `:291` | always `{myScore, respondents}` | unchanged (readable in completed) |
| `tests/Feature/Retros/RotiTest.php:52-64`, `tests/Feature/Mcp/InsightsHealthRotiTest.php` | phases datasets | update |

"Completed before the change" needs a marker the spec does not name: see Decisions.

### 7.3 B3 — session-end props

Mockup needs: duration ("58 min"), actions created, participation "8 of 9", cards, groups, votes cast. Only data the server holds:

| Stat | Source | New prop? |
|---|---|---|
| Actions created | `actionItems.length` | no |
| Cards, groups | `cards` (top-level count, leads with children) | no |
| Participation | `results.participants.length` vs team size (`results.emailRecipients.team` is sharer-only) | proposal: `results.stats.participation {participants, teamMembers}` |
| Votes cast | `votesCast` is sent only in phase voting (`BuildBoardSnapshot.php:167`) | proposal: `results.stats.votesCast` |
| Duration | `retros.created_at` → `completed_at` (no `started_at`) | proposal: `results.stats.durationMinutes`; meaning of "start" is a Decision |

Proposal: one key `results.stats { durationMinutes, votesCast, participation }` in `BuildResults`, typed in `lib/retro/types.ts`, covered by `ResultsTest`.

### 7.4 B10 — `ColumnColor` = `sun, apricot, coral, plum, iris, sky, lagoon, moss`

| File | Change |
|---|---|
| `app/Enums/ColumnColor.php` | eight cases (PascalCase names) |
| new migration (up only) | `UPDATE columns` and `workspace_template_columns`: green→moss, red→coral, blue→sky, amber→sun, purple→plum, slate→iris. `columns.color` is `string(16)` (longest new value: 7) |
| `app/Support/RetroTemplates/TemplateCatalogue.php:21-72` | 52 built-in templates use the six old literals via `ColumnColor::from()`: rewrite every literal with the same mapping |
| `app/Http/Controllers/Retros/ColumnsController.php:33,53`, `app/Http/Requests/WorkspaceTemplateRequest.php:32` | `Rule::enum(ColumnColor::class)`: no code change; an old value now fails validation (public contract of the JSON endpoints) |
| `app/Models/Column.php:45`, `WorkspaceTemplateColumn.php:38` (casts), `WorkspaceTemplate.php:74`, `Actions/Retros/PresentColumns.php:25`, `Actions/Retros/CreateRetro.php:78-87`, `Support/RetroTemplates/TemplateDefinition.php` | no code change; emitted values change (board snapshot, `columns.changed`, template props) |
| `database/factories/ColumnFactory.php:20`, `WorkspaceTemplateColumnFactory.php:21` | `ColumnColor::Green` → `ColumnColor::Moss` |
| MCP, webhooks, exports | `grep -rniE "colou?r" app/Mcp app/Actions/Integrations app/Notifications` → nothing: no MCP or webhook payload exposes the column colour today, contrary to the wording of B10. Nothing to change there |
| Front | `lib/retro/types.ts:23`, `lib/retro/colors.ts` (old Tailwind palette maps `columnAccent`, `columnSwatch`, `columnColorLabel`, `ColumnColors`: delete or reduce), `types/workspaces.ts:61`, `S/column-color-picker.tsx` (`serverColumnColors`, `AnyColumnColor`), `S/retro-column.tsx:86-96,217`, `S/retro-card.tsx`, `S/card-group.tsx`, `S/retro-template-picker.tsx:31-47`, `S/template-editor.tsx:186,683` (default `colors = serverColumnColors`), `pages/workspaces/templates.tsx:28-29`, `components/templates/template-chips.tsx`, `C/add-column.tsx:21` (default `'green'`), `C/column-header.tsx`, `pages/dev/sections/*` that demo server colours; lang keys Green…Slate become unused |
| Tests | `tests/Feature/Retros/ColumnsTest.php`, `CreateRetroTest.php`, `RetroModelTest.php`, `TemplateCatalogueTest.php`, `tests/Feature/Workspaces/WorkspaceTemplatesTest.php`, `tests/Browser/Walkthroughs/Plan06PolishPassTest.php`, `Plan08aFlowAndTemplatesTest.php` (radio names "Green", "Blue"). New: migration test with one row per old value in both tables |

B10 touches screens of briefs 01 (new-retro dialog, template picker) and 09 (`workspaces/templates`): R1 must land before them or be coordinated.

## 8. Browser tests

Files covering the group (`tests/Browser/Walkthroughs/`, 205 tests): `Plan04RetroCoreTest` (24), `Plan06PolishPassTest` (12), `Plan07BoardEngagementTest` (18), `Plan08aFlowAndTemplatesTest` (14), `Plan08bHealthCheckTest` (11), `Plan08cSurveysTest` (10, brief 08 but it walks phases), `Plan08dResultsTest` (14), `Plan08eLlmTest` (20), `Plan09aActionItemsCoreTest` (9), `Plan09bActionItemsAdditionsTest` (13), `Plan12bIntegrationsSharingTest` (8), `Plan12dActionItemExportTest` (8), `Plan13dIcebreakerScoresInvitesTest` (19), `Plan14dStatusSyncTest` (25, retro action items), plus retro helpers in `Plan14aTeamsMattermostTest`, `Plan14bOutgoingWebhooksTest`, `Plan14cTrackersTest`, `Plan15WebhookRedeliveryTest`, `tests/Pest.php` (4 uses), `Smoke/RealtimeTest`, `Smoke/KeyboardDragTest`, `Support/InteractsWithBrowser.php` (`joinAsGuest`: `#name`, "Join"; `awaitRealtime`: `[data-realtime]`; `dragWithKeyboard`: `aria-pressed` on the handle).

Bindings to keep: all hooks of §3 (ids `#card-*`, `#action-item-*`, `#retro-*`, `#completed-tab-*`, `#name`; `data-test` `retro-column-*`, `retro-card-handle-*`, `retro-sort-by-votes`, `retro-action-items-panel`; `data-realtime`; `data-presence-id`; `.lc-overlay`, `.lc-cursor`; `button[frimousse-emoji]`; the accessible names listed).

Tests that MUST change, with the cause:

| Tests | Change | Imposed by |
|---|---|---|
| `press('Complete')` from a board created in Discussing: `Plan04` :364,:375; `Plan08c` :617; `Plan08d` :327,:564; `Plan08e` :194,:495,:570,:635,:732,:795,:849; `Plan14b` :407 | create the board in `Roti`, or press Next, Next, Complete | B1 + spec §6.4 |
| `press('Reopen')` then `assertSeeIn(current, 'Discussing')`: `Plan04` :370; `Plan08c` :632-655; `Plan08d` :557 | reopen lands on ROTI | B1 |
| `[P04-07]` full phase walk | add Actions and ROTI steps | B1, ScreenRetroActions / ScreenRetroROTI |
| ROTI control asserted in Discussing: `Plan08d` :259 (and :478,:499 if not completed) | board in `Roti` | B2, ScreenRetroROTI |
| Action-item tests on boards in Discussing (`Plan09a`, `Plan09b`, `Plan12d`, `Plan14c`, `Plan14d`, `Plan04` :276-296) | none if Discussing keeps the action-items panel (§7.1); otherwise switch to `Actions` | ScreenRetroDiscussion keeps "Actions du sujet" |
| Group selectors `#card-{lead} [aria-label="Rename group"]`, `#card-{x} #card-{y}` (5), `#card-{x} button[aria-label="Ungroup"]` | group is a `<section>` around its cards: pass `domId` and re-anchor | CardGroup README (notes-for-18e) |
| Settings flow: `[aria-label="Facilitator menu"]` → "Settings…" → `[role="dialog"] button[type="submit"]` / `press('Save')` | button is "Apply"; panel is a popover (`role="dialog"` present at `session-settings-popover.tsx:1324`) | SessionSettingsPopover README |
| "Guest link…" dialog tests (`Plan04`, `Plan07`, `Plan12b`) | the link lives in ShareDialog; "Create a new link" asks for confirmation | ShareDialog README |
| Colour radios "Green", "Blue" (`Plan06`, `Plan08a`) | new colour names | B10 |
| `click('Send to email')` | primary button label of the session-end header | ScreenRetroROTI frame c/d |
| `[role="alert"]:has-text("Your session has expired.")` | only if `ConnectionState expired` uses another role/text (NV) | ConnectionState README |

New tests (convention `[P18e-R-nn]`):

- `[P18e-R-01]` member + guest walk Writing → Grouping → Voting → Discussing → Actions → ROTI → Completed without reload (criterion 9).
- `[P18e-R-02]` Actions phase: create, assign, complete an action item; guest sees it live; highlight "next topic" follows.
- `[P18e-R-03]` ROTI phase: vote, change, retract; respondent count live; refused in Discussing.
- `[P18e-R-04]` session end: stats row, tabs, recap e-mail dialog, share to channel, reopen to ROTI.
- `[P18e-R-05]` a board with the eight colours renders and recolours; a migrated `green` column shows as Moss.
- `[P18e-R-06]` mobile 390: one column per tab, add card from the FAB, vote, action drawer.
- `[P18e-R-07]` `prefers-reduced-motion`: no flying reaction, no confetti (criterion 12).
- Visual: `tests/Browser/Visual/RetroPagesVisualTest.php` — each phase + join + session-ended, light/dark, 1440/390, EN/FR, overflow check.
- Vitest: adapters (`lib/retro/adapters.test.ts`: card → RetroCard props, group building, ROTI result, action item), FacilitatorBar actions per phase.

## 9. Risks and open questions

1. **Composer accessible name.** 13 assertions use `[aria-label="Add a card…"]`; the new editing textarea is named "Card text" (`S/retro-card.tsx:580`) and the column button "Add a card" (`S/retro-column.tsx:714`). Either `RetroCard` gains a label override for the composer, or 13 selectors change with no mockup reason. Same question for "Add an action item…" (18) on the composed form (free to keep).
2. **Shared old files cannot be deleted in this group.** `connection-banner`, `session-expired-banner`, `timer-display`, `presence-strip`, `live-cursor-layer`, `emoji-picker`, `ai-summary-switch`, `icebreaker-game-select`, `realtime/*`, `gifs/gif-search-dialog`, `integrations/share/*`, `AI/*` are imported by poker, whiteboard, games, teams, `action-items/index`. The retro stops using them in R3-R10; the last consumer's brief deletes them. Knip stays dirty until then.
3. **`lib/retro/api.ts` is imported by ~100 files outside the retro** (`retroRequest`, `RetroRequestError`) and `use-retro-channel.ts` exports `useSafeConnectionStatus` to four other hooks/pages: these files must not be moved or renamed here.
4. **`action-items` domain overlap.** `AI/action-item-card.tsx` & co. serve the retro and `action-items/index` (brief 05). If the retro composes its own list on `S/action-item.tsx` in R9/R10 while brief 05 still uses the old card, two renderings of an action item coexist for a while (not two versions of one component, but two containers). Agree with brief 05 on shared containers in `components/action-items/` (form, sub-tasks, comments, export dialog) and who writes them first.
5. **B1 widens guards by judgement.** The spec says "guards, visibility rules updated" without a matrix. §7.1 proposes one; comments, reactions, group naming and surveys in `actions`/`roti` are product choices.
6. **B2 legacy rule has no marker.** `RetroRotiController` cannot tell "completed before the change" from "completed after" without a date or a column.
7. **Live cursors.** 17 retro assertions on `.lc-overlay` and the anonymity label: keep the library layer; `S/live-cursor.tsx` is not used on this screen. The mockups' cursor look (name pill, colour) is therefore not reproduced beyond CSS on `.lc-cursor`.
8. **Discussion layout vs today's board.** ScreenRetroDiscussion replaces the columns by a topics list + focused topic. Card actions that exist in discussing today (comments, reactions, group naming, sort by votes per column, `data-test="retro-sort-by-votes"`, `[data-test^="retro-column-"]` assertions in discussing tests) need a home: proposal — the topics list is an additional left rail and the focused topic shows full cards; a "Board" toggle keeps the columns view. Otherwise many discussing tests lose their column selectors.
9. **`SessionLayout` inside the container.** The page is assigned `null` in `app.tsx`; `SessionLayout` reads `usePage().props.auth` and `useSidebarModel('sessions')` (shared props B16). A guest with no `auth.user` gets no sidebar: verified in `session-layout.tsx`; `useSidebarModel` behaviour for a member of another team NV.
10. **Icebreaker timer.** The board timer drives the game timer (`withBoardTimer`); the new `Timer` must stay the single control during the icebreaker.
11. **ShareDialog replaces two dialogs**: facilitator-only parts (guest link) and sharer-only parts (channels) have different audiences (`viewer.isFacilitator` vs `integrations.*`). `canManage` covers the first; a sharer who is not the facilitator (workspace admin) must still see channels and no link management.
12. **Health form markup.** Tests bind `ol > li [role="radiogroup"]`; whether `HealthCheckForm` renders an `<ol><li>` was not checked.
13. **Size.** About 8 700 lines of old TSX (76 files) and 205 browser tests bound to them; R3 alone replaces 14 files while every later phase still runs old components inside the new shell.

Not verified: label texts inside `ShareDialog`, `ConnectionState`, `GuestJoin`, `HealthCheckForm` beyond the greps quoted; `PresentHealthCheck` field names; `BuildRetroRecap`; whether `animate-confetti` exists in `app.css`; the fr/es/de values of "Actions" and "ROTI"; nothing was run.

### Decisions needed (product owner)

1. Phase `actions`: are card comments, card reactions and group renaming still allowed (as in discussing)? And in `roti`?
2. Are action items still creatable in `discussing` (mockup Discussion shows "Create an action") as well as in `actions`? And still editable in `roti`?
3. Highlight / presentation mode in `actions` ("Next topic" of the mockup): yes or no?
4. B2: how to recognise a retro "completed before the change" (proposal: `completed_at` earlier than the migration's run time stored in a new nullable column `retros.roti_closed_at`, or simply keep ROTI votable in every completed retro)?
5. ROTI in `discussing` disappears: confirm (today it is offered there).
6. Session-end duration: from `created_at` or from the first phase change? Participation denominator: team members or participants who joined?
7. Export menu PDF / CSV / Markdown of the session-end mockup: backlog (not in §10) or new back-end item?
8. Timer "+2 min" (mockups) by re-sending "remaining + n" to the existing endpoint: accept, or keep start/stop only (ruling 19)?
9. Discussion screen: topics rail + column view toggle (risk 8), or topics only?
10. Cursors in `roti`: off (proposal) or on?
11. Guest link moves from its own dialog into the share dialog; "Create a new link" gains a confirmation: accept the test changes?

## 10. Size

| Item | Count |
|---|---|
| Commits | 13 |
| Containers / container-side files to write | about 30 (`components/retro/`), 2 pages rewritten, 1 page thinned |
| Old files deleted in this group | about 50 of 76 under `components/retro/` (R3: 14, R4: 9, R5: 1, R6: 1, R7: 4, R8: 2, R9: 3, R10: 1, R11: 1, R12: 18). Rewritten in place: `board.tsx`, `dnd.tsx`, `icebreaker-game.tsx`, `comment-thread.tsx`, `reaction-chips.tsx`. Kept: `board-context.tsx`. Left to other briefs: 8 survey files, 8 shared files, `realtime/*` (2) |
| Back end | 2 enums, 1 migration, about 16 PHP files edited for B1/B2, 1 for B3, 3 for B10 (+52 catalogue lines), about 20 feature-test files |
| Browser tests touched | about 35 tests edited across 9 files; 7 new walkthroughs + 1 visual file |
| Parity rows | 101 |

Parallelism: R2 (join, session-ended) is independent. R1 (B10) must precede or be coordinated with briefs 01 and 09. R3-R13 cannot run in parallel with brief 08 (surveys: same tree, `comment-thread.tsx`, `reaction-chips.tsx`), and conflict with briefs 03, 06, 07 only through the shared files of risk 2 (they are not edited here, only no longer imported). Shared files this group edits: `lib/retro/types.ts`, `lib/retro/colors.ts`, `lang/{en,fr,es,de}.json` (new keys in every commit — merge conflicts with any parallel group), `types/workspaces.ts`, `S/*` colour unions (R1), `hooks/use-retro-board.ts` (one line at most). `app.tsx` is not edited (the page keeps a `null` layout). `pages/retros/session-ended.tsx` is rendered by poker, games and whiteboard middlewares too: briefs 03, 06, 07 must not redo it.
