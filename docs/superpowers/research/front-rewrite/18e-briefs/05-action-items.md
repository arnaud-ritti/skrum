# Brief 05 — Action items index (plan 18e, screen group 5)

Read-only research at branch `plan-18d-branding` (f8ea376d). Paths relative to /Users/aritti/Projects/skrum; `js/` = `resources/js/`.
Sources: spec 2026-10-01 §4-§10; inventory-pages.md §"pages/action-items/index.tsx" (l.415-583); notes-for-18e.md; mockups `ScreenActions` (README + preview.html), `MobileDashboard` (Actions phone, m-chip / m-action), `ActionItem/README.md`; sources of `skrum/action-item.tsx` (1277 l.), `skrum/action-sheet.tsx` (934 l.), `ui/table.tsx`, `ui/pagination.tsx`; old page and 12 old components; Pest browser tests.

## 1. Scope

| Item | Value |
|---|---|
| Page | `js/pages/action-items/index.tsx` (722 l.), route `workspaces.actionItems.index` = `GET w/{workspace}/action-items`, controller `WorkspaceActionItemsController@index` |
| Query | `status` (open default / overdue / completed / all), `assignee` (me / unassigned / user uuid), `team` (uuid), `item` (deep link), `page` (50 per page). Deep links must keep working: bell, reminder mail, MCP, webhooks, tracker back-link (`?item=`), `teams.show` and board snapshot (`?team=`) |
| Layout | `AppLayout` (default branch of `js/app.tsx`; nothing to change there) |
| Mutations (all JSON, `retroRequest`, `X-Socket-ID`) | `store`, `update`, `destroy`, subtasks store/update/destroy, comments index/store/update/destroy, exports preview/store, targets, external-link sync, via `workspaceActionItemEndpoints(slug)` (`lib/action-items/endpoints.ts`, kept) |
| Realtime | private `team-action-items.{teamId}` per id of `realtimeTeamIds`, 3 events, `data-realtime` on the root |
| Mockups | `ScreenActions` desktop (title + filter toolbar + table in a card + floating bulk bar); phone: list of `ActionItem`, chips row, filters drawer (README "Mobile"; `MobileDashboard` Actions board) |
| New components | `skrum/action-item.tsx` (ActionItem, ActionPriorityMark, ActionStatusBadge, ActionItemLinkChip, useActionItemLabels, formatActionDay), `skrum/action-sheet.tsx`, `ui/table.tsx` (Table, TableRow `done/late/selected`, TableHead, TableEmpty, TableLoading), `ui/pagination.tsx` (Pagination with `href`), `ui/select`, `ui/popover`+`ui/command`, `ui/drawer`, `ui/dialog`, `skrum/empty-state`, `skrum/date-picker`, `skrum/confirm-dialog`, `skrum/skeletons` |
| Not in scope | sidebar entry / overdue badge (`js/components/app-sidebar.tsx`, `skrum/app-sidebar.tsx`, layout group); `⌘K`, topbar Export button; retro Actions phase (group 2) |

**Shared-prop collision (B16).** Controller line 63 sends page prop `teams` (`{id, name, members[]}`); `HandleInertiaRequests` line 70 now shares `teams` (`{id, name}[]`, declared in `js/types/global.d.ts` l.31). An Inertia page prop wins over a shared prop of the same key, so the sidebar would receive the member-laden list. Rename in this group's commit (back end included): `teams` -> `filterTeams` (page prop; same shape; the user's visible teams; used for the team filter, team badge, assignee groups, export sources). `creatableTeams` keeps its name and shape. Consumers to edit: `WorkspaceActionItemsController.php` l.63 (`'teams' =>`), `tests/Feature/ActionItems/ActionItemsPageTest.php` l.166-167 (`where('teams.0.name'...)`), the page (`teamsById`). Grep before editing: no other front file reads the page's `teams` (the Inertia `usePage().props.teams` read of other screens is the shared one). `retro/carried-action-items-panel.tsx` builds its own `teams` and is not concerned.

## 2. Commits (order)

| # | Commit | Content | Deletes |
|---|---|---|---|
| 5.1 | `feat(action-items): shared containers and server-to-component adapters` | `js/components/action-items/`: `use-action-item-mutations.ts`, `action-item-adapters.ts`, `action-item-comments.tsx`, `subtask-checklist.tsx`, `export-action-item.tsx` (menu + dialog), `action-item-create-dialog.tsx`; Vitest for adapters, permissions mapping, comments, subtasks. No page change yet. Coordinate with group 2 (see risk R1): whoever lands first writes these files; the other imports them | nothing yet (old files still imported by `components/retro/*`) |
| 5.2 | `feat(action-items): action items page on the new table, sheet and filters` | page + `action-items-table.tsx`, `action-items-list.tsx` (mobile), `action-item-filters.tsx`, `action-item-filters-drawer.tsx`, `action-item-sheet.tsx` (container around `ActionSheet`), `use-action-items-realtime.ts`, `use-action-item-filters.ts`; back-end prop rename; Feature test fix; browser tests updated (§8); lang keys x4 | the 12 files of `components/action-items/` that have no remaining importer (see below), plus `pages/action-items/index.tsx` old body |
| 5.3 | `test(action-items): dev section and visual captures` | `js/pages/dev/sections/actions-index.tsx` (rows, empty, loading, overdue, sheet open), `tests/Browser/Visual/ActionsPageVisualTest.php` (pattern of `AdminPagesVisualTest.php`: FR + EN, 1440 + 390, light + dark), screenshots in `tests/visual/__screenshots__/` | none |

Deletion rule (verified by grep): files of `js/components/action-items/` still imported outside the folder and the page: `retro/action-items-panel.tsx` (ActionItemCard, ExportContext, ActionItemForm, boardAssigneeGroups), `retro/carried-action-items-panel.tsx` (ActionItemCard, teamAssigneeGroups, ExportContext), `retro/results/action-items-results.tsx` (assigneeLabel, DueDateChip, PriorityIcon). Also `lib/action-items/format.ts` is imported by `notification-bell.tsx`, `integrations/share/delivery-lines.tsx` and `skrum/action-item.tsx`; `lib/action-items/order.ts` by `lib/retro/board-reducer.ts`. Therefore: `lib/action-items/*` all stay. If group 2 (retro) is already merged and its panels no longer import the old components, 5.2 deletes all 12: `action-item-card, action-item-comments, action-item-form, anonymous-notice, assignee-select, due-date-chip, export-action-item-button, export-action-item-dialog, external-link-chips, priority-select, recurrence-select, subtask-checklist`. If not, 5.2 deletes none of them and the retro group deletes them (anonymous-notice is used only by the card and the form). The spec order (2 before 5) makes the first case the expected one; run `grep -rnE "components/action-items" js` at the start of 5.2 to decide. The new containers of 5.1 reuse the file names where useful (`subtask-checklist.tsx`, `action-item-comments.tsx`): write the new file over the old only if no importer is left, else use a new name and let group 2 delete.

## 3. Parity table (old front -> new)

Old page = `pages/action-items/index.tsx` (`P`); card = `components/action-items/action-item-card.tsx` (`C`). "Row" = desktop table row (`TableRow id="action-item-{id}"`), "Sheet" = `ActionSheet`, "Item" = mobile `ActionItem`.

| # | Action / behaviour | Old control | Route / event | New component and control | Browser hook to keep | Note |
|---|---|---|---|---|---|---|
| 1 | Filter by status (Open / Overdue / Completed / All) | `Select` aria "Status" (P:583) | `router.get` index, `preserveState, preserveScroll`, omit `status=open`, drop `item` | Facet filter "Status" (Popover + Command single choice or `Select` styled as `.ac-filter`) in a `role="toolbar" aria-label="Filters"`; the shortcut "Overdue" with count = same filter set to `overdue` | trigger `[aria-label="Status"]` showing the selected label ("Completed", "Open", "All"); options `[role="option"]` | mockup status values (to do / doing / done) differ: keep the 4 server values; no "doing" (§10) |
| 2 | Filter by assignee (Anyone / Me / Unassigned / each) | `Select` "Assignee" (P:605) | same | Facet filter "Assignee", same options, avatars in options | `[aria-label="Assignee"]` text "Me", "Anyone"; `[role="option"]:has-text("Me")` | list = `assignees[]` |
| 3 | Filter by team (All teams / each) | `Select` "Team" (P:635) | same | Facet filter "Team" over `filterTeams` | `[aria-label="Team"]`, options "All teams", "Mobile" | the mockup shows it with an x when active: x resets to All teams |
| 4 | Persist filters | `localStorage skrum.actionItemFilters.{workspace.id}` (P:95-148) | client | `use-action-item-filters.ts` (move the 3 helpers `filterStorageKey, filterQuery, readStoredFilters, storeFilters` as they are) | `JSON.parse(localStorage.getItem('skrum.actionItemFilters.{id}')).team` (P09b-02a) | keep key and JSON shape |
| 5 | Restore filters on mount when `location.search === ''` | effect P:466-484 | `router.get ... replace` | same hook | P09b-02a (`click sidebar` -> back with `status=all&team=`) | |
| 6 | Reset filters | none | - | "Reset" link button of the toolbar (mockup `Réinitialiser`): navigates to the index with no query and clears storage | new `[P05-..]` | derived from existing filter state, no new back end. Hidden when default filters |
| 7 | Pagination Previous / Next + "Page x of y" (when `lastPage > 1`) | `nav aria-label="Pagination"` + `Link preserveScroll` (P:680) | GET `prevPageUrl` / `nextPageUrl` | `Pagination` (`ui/pagination`, `href` mode: `PaginationPrevious`/`Next` with the server urls; page numbers need a url builder: use `items.currentPage ± ` urls only, or build `?page=n` with `withQueryString` semantics) | `nav[aria-label="Pagination"]`, texts "Previous", "Next", "Page :page of :total" | the server gives only prev/next urls: render Previous / Next + "Page x of y" text (no numbered links) unless a url builder is added on the client from the current query |
| 8 | Page heading + subtitle "Follow-ups of every team you can see" | `Heading` (P:556) | - | page header: `h1` "Action items" + counts line (mockup: "28 open · 4 overdue") | `assertSee`/`click('Follow-ups of every team you can see')` in P09b-05 (used as a blur target!) | keep the subtitle text as the description; counts: only `items.total` exists (see §6) |
| 9 | Empty state | `<p>` "No open action items." / "Nothing matches these filters." | - | `EmptyState` inside `TableEmpty` (desktop) / in the list (mobile), same two texts | `assertSee('No open action items.')`, `'Nothing matches these filters.'` | |
| 10 | "New action item" button (only if `creatableTeams.length > 0`) | `Button` (P:574) | client | `Button` "New action item" (mockup topbar `Nouvelle action`, rendered in the page header, not the topbar) | `click('New action item')` | feature kept although §10 lists "manual action creation outside a retro": the back end exists and it is parity (spec goal 2) |
| 11 | New-action dialog: team select | `Select` "Team" in `Dialog` (P:288) | client | `Dialog` (`size="sm"` or default) with `Select` aria "Team"; default team = `filters.team` if creatable else first | `[role="dialog"] [aria-label="Team"]` text "Platform" | keep the reset-on-team-change via `key={teamId}` |
| 12 | Create (content max 500 required, priority default medium, due date min 2000-01-01 max 2100-12-31, recurrence disabled without due date, assignee of the chosen team) | `ActionItemForm` (action-item-form.tsx) | `POST workspaces.actionItems.store` `{team_id, content, priority, due_on, recurrence, assignee_user_id, assignee_participant_id:null}`; then reload + close | `action-item-create-dialog.tsx` composed from `Input`, `Select` x3, `DatePicker` (or native date input; see R5), `Button type=submit` "Create" | `[role="dialog"] [aria-label="Add an action item…"]`, `[role="dialog"] button[type="submit"]`; priority/recurrence/assignee labels "Priority", "Repeat", "Assignee" | the retro `ActionItemForm` is also used by group 2: share one form if both groups need it (R1) |
| 13 | Complete / reopen | `Checkbox` "Mark as done"/"Reopen" (C:177) | `PATCH update {status}` | Row: `ActionItem`'s status button is for lists; in the table, a status `TableCheckbox`-like toggle with the same names; Item: `ActionItem` status button; Sheet footer button | `[aria-label="Mark as done"]`, `[aria-label="Reopen"]`, `assertDisabled(... "Mark as done")` when not allowed | `canComplete` from `canCompleteActionItem`; `aria-label` names are fixed by `useActionItemLabels().statusAction`; "Mark as in progress" never shown (`withDoing` false) |
| 14 | Edit content (pencil, Enter saves, Esc cancels, empty/unchanged = no request) | pencil "Edit action item" (C:189-216) | `PATCH {content}` | Row/Item: pencil `onEditStart` -> `ActionItem editing` (title input "Action title", Save/Cancel); Sheet: pencil "Edit action item" + title editor | `button[aria-label="Edit action item"]`; absent for non-managers (`assertNotPresent`, P09b-04) | `ActionItemPatch.title` -> `{content}`; `titleMaxLength=500` |
| 15 | Change priority | `PrioritySelect` (C:318) | `PATCH {priority}` | Sheet property "Priority" select; Item editor select "Priority" | `[aria-label="Priority"]` | `ActionItemPatch.priority` |
| 16 | Change due date (saved on blur only when changed and complete, revert on failure) | native date input "Due date" (C:157-169) | `PATCH {due_on}` | Sheet property "Due date" (the sheet's own date input, same on-blur rule at `saveDueDate`); Item editor "Due date" | `fill('[aria-label="Due date"]', 'YYYY-MM-DD')` then blur, `Due {M j}` text in row (P09b-05) | clearing the date also sends `recurrence:null` (the sheet does it); the server 422 for recurrence without due date stays |
| 17 | Change recurrence | `RecurrenceSelect` (C:340), disabled without due date | `PATCH {recurrence}` | Sheet property "Repeat" select; Item editor "Repeat"; options "Does not repeat / Weekly / Every 2 weeks / Monthly" | `[aria-label="Repeat"]`, `assertDisabled` without due date (verify the sheet disables it: not verified) | `Repeats weekly` text in meta (`action-item-recurrence` slot) |
| 18 | Change assignee (Unassigned, team members group, guest or non-member shown disabled) | `AssigneeSelect` (C:345) | `PATCH {assignee_user_id, assignee_participant_id}` via `assigneePayload` | Sheet property "Assignee" select (values `actionOwnerValue` = `kind:id`; the sheet shows an unlisted owner as disabled option); Item editor "Assignee" | `[aria-label="Assignee"]` with text "Carol Guest (guest)", `[role="option"][aria-disabled="true"]:has-text("Carol Guest (guest)")` (P09b-02c) | `members` prop = team members of `item.teamId` as `ActionItemOwner`; the label "(guest)" vs the new `labels.ownerName` "(Guest)": see §8 and R4 |
| 19 | Delete action item (no confirmation) | trash "Delete action item" (C:295) | `DELETE destroy` -> 204 | Row: row menu / trash; Item: `onDelete` button "Delete action item"; Sheet footer "Delete action item" | `[aria-label="Delete action item"]` | keep no confirmation? mockup/design say destructive needs icon+label (present). A `ConfirmDialog` would break P09a delete tests: Decision D3 |
| 20 | Add sub-task (input max 200, hidden at 20) | `SubtaskChecklist` input "Add a sub-task" + Add | `POST subtasks.store` | `subtask-checklist.tsx` composed in `ActionSheet` `children` (Section "Sub-tasks") and `ActionItem` `children` | `[aria-label="Add a sub-task"]` (fill + Enter), cleared after add | `MaxSubtasks = 20` |
| 21 | Tick / untick sub-task | `Checkbox` aria = text | `PATCH subtasks.update {status}` | same checklist | `[role="checkbox"][aria-label="{text}"]` + `aria-checked` | needs `canComplete` |
| 22 | Rename sub-task | pencil "Edit sub-task" | `PATCH {content}` | same | `[aria-label="Edit sub-task"]`; absent for non-managers | |
| 23 | Move sub-task up / down | arrows "Move up" / "Move down" | `PATCH {position}` | same (buttons, no dnd) | `ul[aria-label="Sub-tasks"] > li ... [aria-label="Move up"]`; list order via `[role="checkbox"]` order | keep `ul aria-label="Sub-tasks"` |
| 24 | Delete sub-task | trash "Delete sub-task" | `DELETE subtasks.destroy` | same | `[aria-label="Delete sub-task"]` | |
| 25 | Sub-task progress | `done/total` with aria "1 of 3 sub-tasks done" | - | `action-item-subtasks` slot in `ActionItem`; `action-sheet-subtasks` in sheet | `[aria-label="1 of 3 sub-tasks done"]` containing `1/3` (P09b-04/05) | the new components use an `sr-only` span for the long text and `aria-hidden` for `1/3`: the old `aria-label` element does not exist; see §8 |
| 26 | Toggle comments ("1 comment" / ":count comments", aria-expanded/controls) | button (C:352-365) | opens thread `GET comments.index` | `ActionItem` `onToggleComments` + `commentsOpen` + `comments` slot (Item); Sheet "Comments" section always open (no toggle) | `button[aria-expanded="true"]` inside `#action-item-{id}` (P09b-02b, 06b), `#action-item-{id}-comments` text "No comments yet." | on desktop the comments live in the Sheet: `?item=` deep link must open the Sheet on load (D1) |
| 27 | Retry loading comments | "Retry" | GET again | `action-item-comments.tsx` (composed: `Alert` + `Button`) | text "Could not load the comments." / "Retry" | |
| 28 | Add comment (textarea max 500, "Comment") | `Textarea` + button | `POST comments.store` | `TextareaField`/`Textarea` + `LoadingButton` in comments container | `button:has-text("Comment")` (P09a-02) | count pushed up through `commentCount` |
| 29 | Edit comment (author only) | pencil "Edit comment", Save / Cancel | `PATCH comments.update` | same container | `[aria-label="Edit comment"]` | `comment.isMine` |
| 30 | Delete comment (author or manager, no confirmation) | trash "Delete comment" | `DELETE comments.destroy` | same | `[aria-label="Delete comment"]` | `canDeleteActionItemComment` |
| 31 | Comment thread states | "Loading…", error, "No comments yet.", "Former member", `<time>` | - | same container (skeleton rows for loading) | texts | refetch on `item.id`, `commentsRevision`, retry counter |
| 32 | Export to tracker (one tracker = direct button "Export to :provider"; several = menu "Export") | `ExportActionItemButton` (export-action-item-button.tsx) | client | `export-action-item.tsx` (`Button size="icon-sm"` / `DropdownMenu`) passed through `ActionItem.actions` (Item), Sheet `actions` (footer) and a row-menu entry or inline button in the table's last cell | `#action-item-{id} [aria-label="Export to Jira"]` visible without opening anything; `assertNotPresent` once linked | the Plan12d test needs the button visible on the row: keep an icon button in the actions cell of the table row (mockup has a row menu `...`: see D2) |
| 33 | Export dialog: load targets | on open / project change / search | `GET teams.integrations.targets.index` | `Dialog` container `export-action-item.tsx` (port of `export-action-item-dialog.tsx`, 540 l.) | `[role="dialog"] [aria-label="Issue type"]` text "Task" | port as is, token-only styling |
| 34 | Export dialog: search projects/repositories (300 ms debounce, spinner, "No project found.") | `Input` "Search projects" / "Search repositories" | same GET `q` | `Input` + `Spinner` + `Command`-less list | labels | `SearchDelayMs = 300` |
| 35 | Export dialog: choose target (Jira project + issue type; GitHub repository; Linear team) | `Select`s "Project", "Issue type", "Repository", "Linear team" | client | `Select` x1-2 | the 4 labels | selected project absent from results stays in options |
| 36 | Export dialog: preview lines (assignee state, "Priority: Medium", "Unassigned") | text lines | `GET exports.preview` | same | `assertSee('Unassigned')`, `'Priority: Medium'` | failures swallowed |
| 37 | "Manage people" link (workspace managers only) | `Link` to `teams.integrations.index` | GET | `Button asChild` + `Link` | text "Manage people" | |
| 38 | Export submit / Cancel, toasts "Exported as :key.", warnings | `Export` button + toasts | `POST exports.store` (45 s) | `LoadingButton` "Export" | `[role="dialog"] button:has-text("Export")`, toast text `Exported as PROJ-42.` | dialog closes, chip appears |
| 39 | Open tracker issue (chip with key, status dot, tooltip) | `ExternalLinkChips` | external `<a target=_blank>` | `ActionItemLinkChip` (Row ticket column, Item side group, Sheet header + "External links" section) | `#action-item-{id} a[href="https://acme.atlassian.net/browse/PROJ-42"]` text "PROJ-42" | `links` is `null` for guests/broadcast: the component hides the section |
| 40 | Retry tracker sync (failed only) | refresh icon "Retry the sync of :key" | `POST actionItemLinkSyncs.store` -> toast "Sync requested." | `onRetrySync` of `ActionItem`/`ActionSheet` -> container posts | `[aria-label="Retry the sync of PROJ-1"]` | 409 message shown by `run` |
| 41 | Open source retro / "Added outside a retro" | `RowMeta` link / span | `retros.show` | Row: source cell link under the title (`ActionItemSourceRef.url`); Item `meta`; Sheet "Source" property | text `Added outside a retro` inside `#action-item-{id}` (P09b-03, 05, 02c) | `source.label` = retro title (+ ` · date` via `formatShortDate`); null source -> pass a `meta` span "Added outside a retro" (the new component does not print it: verify in `action-item.tsx` l.1126-1140, not verified) |
| 42 | Team badge and assignee label in meta (":name (guest)", ":name (not in team)") | `RowMeta` | - | Row: team name in the source cell; Item: `teamName` prop + `showOwnerName`; owner column text | `Carol Guest (guest)` in the Assignee control | see R4 |
| 43 | Meta row: priority, due chip ("Overdue · date" / "Due :date"), recurrence + follow-up, sub-task progress, creator avatar+name ("Former member"), theme badge, "Completed in :source" | `DueDateChip`, `RecurrenceBadge` etc. | - | `ActionPriorityMark`, `action-item-due`, `action-item-recurrence`, `action-item-creator`, `Theme: :name`, `action-item-completed-via` slots of `ActionItem`; table cells reuse the exported helpers | P09b-03/05 read the text of `#action-item-{id}`: "Added outside a retro", "Alice Martin", "Repeats weekly", "Due {M j}", "Follows up the item completed on" | the desktop table must render the same texts in the row (creator and recurrence in the Action cell second line, tooltip-free) |
| 45 | Focused item `?item=`: scrolled into view, comments expanded | effect P:486 `scrollIntoView` on `#action-item-{id}` | - | desktop: open the Sheet for `filters.item` on mount; mobile: `commentsOpen` initially; both scroll the row/item into view | `#action-item-{id}` exists in DOM; `button[aria-expanded="true"]` (P09b-02b/06b/12d) | D1 |
| 46 | Focused item not in the filtered page is pinned above the list under "Linked action item" | `section` + `Heading` (P:660) | - | keep: a `section` with `h2` "Linked action item" holding one extra row/Item | `section:has-text("Linked action item") #action-item-{id}`; `assertCount('li[id^="action-item-"]', 2)` | the table rows are `tr`; the test counts `li`: §8 |
| 47 | Window focus reload | `window.focus` -> `router.reload({only})` | partial reload `items, focusedItem, actionItems, notifications` | `use-action-items-realtime.ts` (kept) | none direct | keep `ReloadProps` |
| 48 | Delayed coalesced reload (1 s) after save / delete / realtime | `scheduleReload` (P:359) | partial reload | same hook | live updates in P09b-03/04 | keeps the sidebar overdue badge fresh |
| 49 | Error toast + resync on failed mutation | `useToastRun` (P:174) | `toast.error` + reload | move to `use-action-item-mutations.ts` as is | `assertSee` of toast text (P09a-03b is retro) | timeout, server message, generic fallback texts |
| 50 | Role-conditional UI: manages (author, workspace manager, retro facilitator) vs completes (+ assignee, review team) | `canManageActionItem`, `canCompleteActionItem` | - | `lib/action-items/permissions.ts` kept; `ActionItemProps.canComplete`; edit/delete/priority/date/recurrence/assignee/subtasks/export hidden for non-managers; Sheet `readOnly` when neither manages nor completes | `assertNotPresent("button[aria-label=\"Edit action item\"]")`, `assertDisabled("[aria-label=\"Mark as done\"]")` | the old UI disabled select controls and hid pencil/trash: the sheet hides non-editable selects or shows read-only values (R3) |
| 51 | Controls on an item of a locked running retro | not reflected, server rejects, toast | 4xx message | same | none on this page | |
| 52 | Connection state attribute | `data-realtime` root attr | `realtimeState(connected, subscribedChannels)` | same attribute on the page root `div` | `awaitRealtime()` waits on `[data-realtime="connected"]` | keep exactly (count of subscribed = count of `realtimeTeamIds`) |
| 53 | Live: saved / deleted / comments changed | 3 listeners | see §5 | `use-action-items-realtime.ts` | P09b-03/04, P09a-02 | |
| 54 | a11y labels | aria-labels, `nav` "Pagination", `ul` "Sub-tasks", `aria-expanded/controls` | - | kept names; `TableHead` scope; row `aria-label` | as above | |

(Row 44 intentionally unused; 54 rows, numbering contiguous except 44.)

## 4. Composition

### Containers to write (`js/components/action-items/`)
| File | Role |
|---|---|
| `action-item-adapters.ts` | server `ActionItem` -> `ActionItemData` (below); `ownerOptions(team)`; `patchToPayload(patch, item)`; pure, Vitest |
| `use-action-item-mutations.ts` | `useToastRun` (moved from the page), `patch / remove / addSubtask ...` thin wrappers over `retroRequest(endpoints.*)`; `busy` per item; returns saved item to the page |
| `use-action-items-realtime.ts` | the inline effect of the page (l.405-452) + `replaceActionItem` + `scheduleReload` + window focus; returns `{rows, setRows, focused, subscribedChannels}` helpers |
| `use-action-item-filters.ts` | `Filters` type, query builder, localStorage store/restore, `applyFilters`, `resetFilters` |
| `action-item-filters.tsx` | toolbar: 3 facet filters + "Overdue" shortcut + Reset; composed from `Popover`, `Command`, `Button`, `Badge` (no `FacetedFilter` exists); `.ac-filter` look (dashed to solid when active) in Tailwind tokens; labels truncate; `role="toolbar" aria-label="Filters"` |
| `action-item-filters-drawer.tsx` | phone: `Drawer` with the same 3 filters + "Filters · n" button + `m-chip`-like chips row (Mine / Overdue / Open / Completed mapped to existing filters) |
| `action-items-table.tsx` | desktop `Table` in a card (`rounded-xl border bg-card shadow-card overflow-hidden`): columns Action (title + source/creator/recurrence line) / Status badge / Assignee / Priority / Due / Ticket (links + export icon) / row actions; `TableRow done late`; `TableEmpty`; `TableLoading` while a partial reload runs (`router` `onStart`) |
| `action-items-list.tsx` | phone: `<ul>` of `ActionItem` (`id="action-item-{id}"`, `meta`, `actions`, `children` = checklist, `comments`) |
| `action-item-sheet.tsx` | container around `ActionSheet`: maps item -> props, `savingField`, `deleted` (item removed by realtime while open), slots `children` = checklist, `comments` = thread, `actions` = export button; `side="right"`; passes `onCloseAutoFocus` handled by the component; `readOnly = !manages && !completes` |
| `subtask-checklist.tsx`, `action-item-comments.tsx`, `export-action-item.tsx`, `action-item-create-dialog.tsx` | see parity rows 12, 20-38; ports of the old files restyled on tokens, no copy of old markup |
| `pages/action-items/index.tsx` | thin: props, hooks, `use-mobile` switch between table and list, create dialog, sheet, pagination, `data-realtime` root |

Responsive switch: `hooks/use-mobile.tsx` (exists) chooses table (desktop) or list (phone), so ids `#action-item-{id}` are never duplicated. Check its breakpoint matches the 390 capture (not verified).

### skrum/ and ui/ used
`ActionItem`, `ActionSheet`, `ActionPriorityMark`, `ActionStatusBadge`, `ActionItemLinkChip`, `useActionItemLabels`, `formatActionDay`, `resolveActionOverdue`; `Table*`, `Pagination*`, `Select`, `Popover`, `Command`, `Drawer`, `Sheet`, `Dialog`, `DropdownMenu`, `Badge`, `Button`, `Checkbox`, `Input`, `Textarea`/`TextareaField`, `PersonAvatar`, `EmptyState`, `ConfirmDialog` (only if D3 = yes), `LoadingButton`, `Spinner`, `Alert`, `Skeleton`, `Tooltip`.

### Composed from primitives (no dedicated component)
Facet filter, filters drawer, mobile chips, desktop table row, bulk-free toolbar, sub-task checklist, comment thread, export dialog and menu, create dialog, "Linked action item" section, pagination footer text, counts line.

### Adapter: server `ActionItem` (`lib/retro/types.ts` l.203) -> `ActionItemData`
| Component field | From |
|---|---|
| `title` | `content` |
| `status` | `status` (`open`/`completed`; `doing` never) |
| `priority` | `priority` |
| `dueDate` | `dueOn` |
| `overdue` | `isOverdue` |
| `doneAt` | `completedAt` |
| `completedVia` | `completedVia` |
| `owner` | `assignee` -> `{id, name, kind, isTeamMember, avatarUrl}` |
| `createdBy` | `createdBy` (`null` = Former member; keep `undefined` only if not shown) |
| `themeName` | `themeName` |
| `teamName` | `filterTeams` lookup by `teamId` |
| `source` | `{label: retroTitle + ' · ' + formatShortDate(retroCreatedAt, locale), url: retroUrl, retroId}`; `null` when no retro |
| `recurrence` | `recurrence` |
| `followUpDate` | `previousOccurrenceId ? createdAt : null` (old `RecurrenceBadge` rule) |
| `subtasks` | `subtasks` (`isCompleted` is enough) |
| `commentCount` | `commentCount` |
| `links` | `externalLinks` (shape fits `ActionItemLink`; `null` stays `null`) |
| `members` | `filterTeams[teamId].members` -> `{id, name, kind: 'member', isTeamMember: true, avatarUrl}` |
| `locale` | shared prop `locale` |
| `canComplete` | `canCompleteActionItem(item, viewer)` |
| manage handlers | passed only when `canManageActionItem` (so the pencil, trash, selects are absent otherwise) |
| `onChange(patch)` | `title`->`content`, `priority`, `dueDate`->`due_on`, `recurrence`, `owner`->`assigneePayload(actionOwnerValue(owner))` |
| client-only `commentsRevision` | kept on the row object (not in `ActionItemData`), passed to the comments container |

### Reused as they are
`lib/action-items/{endpoints,permissions,assignees,format,order}.ts`; `lib/retro/api.ts` (`retroRequest`, `RetroRequestError`); `lib/retro/board-reducer.ts` `countActionItemComments`; `lib/realtime/realtime-state.ts`; `hooks/use-retro-channel.ts` `useSafeConnectionStatus`; generated `@/actions/App/Http/Controllers/WorkspaceActionItemsController`; `useTrans`, `useShortcut`.

## 5. Realtime
| Item | Where it lands |
|---|---|
| Channels | `echo().private('team-action-items.{id}')` for each id of `realtimeTeamIds` (wire name `private-team-action-items.{id}`); effect keyed on `realtimeTeamIds.join(',')`; cleanup `echo().leave(name)`; unchanged (`use-action-items-realtime.ts`) |
| `.team-action-item.saved` `{actionItem}` | `replaceActionItem` keeps local `isMine`, `commentsRevision`, `externalLinks` (when incoming null), `completedVia`; updates table row / list item and the open Sheet (same row object); schedules reload (1 s, coalesced) |
| `.team-action-item.deleted` `{actionItemId}` | schedule reload; if the Sheet shows that id set `deleted` (the `ActionSheet` shows "This action item was deleted.") |
| `.team-action-item.comments.changed` `{actionItemId, commentCount}` | `countActionItemComments(..., refresh true)` -> count + `commentsRevision`++ -> open thread refetches (Sheet or Item) |
| `data-realtime` | root `div` of the page: `connecting` until socket up and all channels confirmed (`subscribed()`), then `connected` |
| Two browsers to keep working | create from A appears at B (P09b-03); sub-task add/reorder/tick at A shows at B and vice versa (P09b-04); status/comment count updates (P09a-02 is on the retro board, same events); no whispers, no presence, tracker sync only after reload |
| Not broadcast | external-link changes (known limit, unchanged) |

## 6. Mockup elements not rendered / without mockup

Not rendered (spec §10 or no back end):
| Mockup element | Reason |
|---|---|
| "Group by" Sprint / Team / Owner / None tabs, sprint group rows with state badges | sprint entity is backlog; server pagination makes client grouping wrong; Team/Owner grouping on 50-row pages misleads. Rows are flat, in server order (open before completed, overdue first). See D4 |
| Row selection checkboxes, select-all with mixed state, `ac-bulk` floating bar (Status, Assign, Due, Priority, Sync to Jira, Delete, clear) | "bulk action update and bulk Jira sync" backlog; `TableCheckbox`, `TableSelectAll`, `TableBulkBar` not used; mobile long-press selection not built |
| Filters Priority, Due date, Source | no query params nor server filtering (`ActionItemFilters` has status, assignee, team, item only) |
| Status "doing" / "In progress" filter value and badge | `doing` backlog; filter keeps Open / Overdue / Completed / All |
| Topbar "Export" button (`file-down`) | no bulk export endpoint |
| Header counts "28 open or recent · 4 overdue · from 9 rituals" | only `items.total` is sent (and `actionItems.overdueAssignedCount` = overdue assigned to the viewer, a different number). Render "{total} action items" only. Real counts per status would be a back-end gap |
| Source icons for whiteboard / survey ("Whiteboard · ...", "Sondage · ...") | actions only come from retros or outside a retro (§10) |
| Sprint badge in the Action cell | no sprint |
| Chip counts on the phone chips ("Mine 6", "Overdue 2", "Open 24") | no per-filter counts from the server; chips without numbers |
| Linear/Jira square/round marks as the ticket glyph | `ActionItemLinkChip` renders provider and key from `ExternalLink`; use it |

Without mockup (designed from neighbours):
- Create dialog: from `FormDialog`/`Dialog` of ScreenTeam and the sheet's fields (same selects, same labels).
- "Linked action item" pinned section: a `section` with the page's `h2` style above the table (desktop) or list (phone), one row.
- Export dialog, comments thread, sub-task checklist: restyled from the Sheet sections (`Section` h3 style) and `Dialog`.
- Loading state of the table (partial reload): `TableLoading`.
- Pagination: `Pagination` footer inside the card, right aligned; text "Page x of y".

## 7. Back-end changes

| Change | Spec | Note |
|---|---|---|
| Rename page prop `teams` -> `filterTeams` in `WorkspaceActionItemsController::index` and update `tests/Feature/ActionItems/ActionItemsPageTest.php` | B16 (explicit) | same shape; `creatableTeams`, `assignees`, `realtimeTeamIds`, `exportSources`, `viewer` unchanged |
| Nothing else | - | Gaps to report, not plan: per-status counts, overdue count of the whole filter, priority/due/source filters, bulk endpoints, grouping |

## 8. Browser tests

Tests that exercise the page: `tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php` (02a, 02b, 02c, 03, 04, 05, 06b hit the page; 01a-c, 06a, 07, 08 are retro/mail/bell), `Plan12dActionItemExportTest.php` ([P12d-06] only; 03-05 are the board), `Plan09aActionItemsCoreTest.php` (all retro board, links to `/action-items?team=` at l.383/390), `Plan14dStatusSyncTest.php` and `Plan14cTrackersTest.php` (board; not verified whether they open the index). Feature test: `tests/Feature/ActionItems/ActionItemsPageTest.php` (prop names).

Selectors bound by the page tests (must survive): `#action-item-{id}` (on the row/item), `div.grid > [aria-label="Status|Assignee|Team"]` (helper `p09bFilter`), `[role="listbox"]`/`[role="option"]`, `#action-item-{id} [aria-label="Mark as done|Reopen|Assignee|Due date|Repeat|Add a sub-task|Move up|Edit sub-task|Delete sub-task|Edit action item|Export to Jira"]`, `ul[aria-label="Sub-tasks"] [role="checkbox"][aria-label=...]`, `[aria-label="n of m sub-tasks done"]`, `#action-item-{id}-comments`, `button[aria-expanded]`, `section:has-text("Linked action item")`, `li[id^="action-item-"]` count, texts "No open action items.", "Nothing matches these filters.", "Follow-ups of every team you can see", "Added outside a retro", "Due {M j}", "Repeats weekly", "Follows up the item completed on", "Exported as PROJ-42.", `[data-realtime]`.

Tests that MUST change (mockup imposes the structure, cite `ScreenActions` README "Table" and "Zones"):
| Test | Why | Change |
|---|---|---|
| P09b-02a, 02b, 05 filter helper `div.grid > [aria-label=...]` | filters become a `role="toolbar"` of facet filters, no `div.grid` | `p09bFilter` -> `[role="toolbar"][aria-label="Filters"] [aria-label="Status"]` (names kept). Also the sidebar assertion `'Teams / Action items / Templates'` (l.218) is owned by the layout/sidebar group (mockup sidebar: Dashboard, Sessions, Actions, ...); coordinate, do not fix here |
| P09b-02b `li[id^="action-item-"]` count 2 and `section ... #action-item-{id} button[aria-expanded="true"]` | table rows are `tr`; comments open in the Sheet | `tr[id^="action-item-"]` (desktop run); expanded -> the Sheet is open (`[role="dialog"][data-slot="action-sheet"]`) with `#...-comments`-equivalent text "No comments yet." |
| P09b-02c (assignee select in the card) | assignee is a Sheet property, not in the row | open the sheet (click the row title), then `[data-slot="action-sheet"] [aria-label="Assignee"]`; text "Carol Guest (Guest)" if the component label is used (R4) |
| P09b-04 (sub-tasks inline in the card) | sub-tasks live in the Sheet `children` | open the sheet first, scope selectors to the sheet; `[aria-label="1 of 3 sub-tasks done"]` becomes the `sr-only` text of `action-sheet-subtasks` (`assertSeeIn` of `1/3` is `aria-hidden`: use the sr-only text or the visible `1/3`) |
| P09b-05 (Due date, Repeat inline; texts of the card) | same | edit via the Sheet; assertions on row text "Due {M j}", "Repeats weekly", "Follows up..." read the row (renders the same slots); `click('Follow-ups of every team you can see')` stays valid if the subtitle is kept |
| P09b-06b `#action-item-{id} button[aria-expanded="true"]` | bell link `?item=` now opens the Sheet | assert the sheet is open with the item title |
| P12d-06 `#action-item-{id} [aria-label="Export to Jira"]` visible | same id + label required on the row (D2) | unchanged if the icon button stays in the row |

New tests (ids to continue the convention, file `tests/Browser/Walkthroughs/Plan18eActionItemsTest.php`):
| Id | Covers |
|---|---|
| [P18e-05a] | desktop: table columns, status/priority/due/ticket cells, overdue row styling, pagination Previous/Next with 51+ items |
| [P18e-05b] | filters toolbar: facet filters, "Overdue" shortcut, Reset clears query and localStorage |
| [P18e-05c] | row click opens the Sheet; edits title, priority, due, repeat, assignee; closes with Escape and returns focus to the row |
| [P18e-05d] | phone (390): list of `ActionItem`, filters drawer, status toggle, comments expand |
| [P18e-05e] | two browsers: status change and comment at A visible at B; item deleted at A while B's Sheet is open shows "This action item was deleted." |
| [P18e-05f] | `?item=` of an item outside the page opens the Sheet and pins "Linked action item" |
Vitest: adapters, `canComplete`/manage mapping, filter query/restore helper, checklist (order, max 20), comments states, create dialog (recurrence disabled without date).

## 9. Risks and open questions

| # | Risk | Evidence |
|---|---|---|
| R1 | Shared containers collide with group 2: the retro Actions phase and the carried-items sheet render the same card, form, checklist, comments and export dialog (`components/retro/action-items-panel.tsx`, `carried-action-items-panel.tsx`, `results/action-items-results.tsx` import `components/action-items/*`). Two groups writing the same files in parallel = conflicts, and deleting the old ones is blocked until both are migrated | grep of imports at §2 |
| R2 | New `ActionItem` row has no inline selects: priority, due date, repeat, assignee appear only while `editing` (Item) or inside the Sheet. Every inline-control test must go through the Sheet (§8). Time-box: the browser suite is 7 tests of P09b + P12d-06 | `skrum/action-item.tsx` l.790-930 (editor), `action-sheet.tsx` l.480-720 |
| R3 | Old UI showed disabled selects to non-managers; the Sheet either hides or renders read-only values (not verified which). A guest/assignee-only user can still complete: check `readOnly` vs `canComplete` combination in the Sheet footer (`hasFooter`, `completes`) | `action-sheet.tsx` l.255-265 |
| R4 | Label drift: old assignee label ":name (guest)" lowercase; `useActionItemLabels().ownerName` prints "(Guest)". Test P09b-02c asserts "Carol Guest (guest)" and `:has-text("(guest)")` count. Either change the test (mockup/component imposes capital) or the key; keep `:name (not in team)` | `action-item.tsx` l.270-277, P09b-02c |
| R5 | Date input: old code uses a native `<input type=date>` filled by Playwright `fill('[aria-label="Due date"]', 'YYYY-MM-DD')` with on-blur save; the Sheet's `Due date` control must remain a fillable input (it keeps `draftDue`/`saveDueDate(partialInput)` so likely native; the `DatePicker` popover would break `fill`). Not verified which element the sheet renders at l.595 | `action-sheet.tsx` l.595 |
| R6 | Realtime payload merge on the new rows: `replaceActionItem` rules (keep `isMine`, `externalLinks`, `completedVia`) must stay; a saved item not on the page is not inserted before the reload | inventory §5 |
| R7 | Overflow at 390: 7-column table must not render below the breakpoint; Sheet width on phone; filter toolbar wraps or scrolls (rule 4) | spec §5 |
| R8 | Focus return: Sheet opened from a row must restore focus to the row/title button (component handles `openerRef`); `useRestoreFocus` note in notes-for-18e if opened without a trigger | `action-sheet.tsx` l.322-335 |
| R9 | `ExportSource` type and `exportSources` `[]` (empty array, not object) when no provider: keep `?? []` | controller, `types/integrations.ts` l.278 |

Decisions needed (product owner):
| # | Question | Proposal |
|---|---|---|
| D1 | Desktop details: row click opens a right-side Sheet (comments, sub-tasks, edit, export, delete) instead of the old inline expandable card; `?item=` deep links open the Sheet. OK? | yes (the mockups and `ActionSheet` exist for this; the table cannot hold the checklist and thread) |
| D2 | Keep an "Export to Jira" icon button visible in the row's last cell (as the old card, bound by P12d-06) or move it to the row menu and the Sheet footer only? | keep the icon button in the row, plus the Sheet footer |
| D3 | Delete without confirmation (current) vs `ConfirmDialog` | keep as today (parity; a confirm needs test updates in P09a) unless the owner wants one |
| D4 | "Group by": omit entirely (proposal) or offer client-side grouping by Team / Assignee within the current page | omit; revisit with the sprint entity |
| D5 | Counters in the header (open / overdue / total): back end gives only `items.total` | show total only; adding counts needs a spec item |
| D6 | Mockup puts "New action" in the topbar next to Export; here it is a page-header button because the topbar belongs to the layout | page header |

## 10. Size
| Metric | Count |
|---|---|
| New containers / hooks / adapters | 14 (files of §4) + page |
| Vitest files | ~8 |
| Old files deleted | up to 13 (12 components + old page body); only 1 if group 2 has not landed |
| Tests touched | 8 browser tests (P09b-02a, 02b, 02c, 04, 05, 06b; P12d-06; sidebar line of 02a owned by layout) + 1 Feature test; ~6 new browser tests |
| Lang | ~25 new keys x4 files (`lang/en|fr|es|de.json`): "Filters", "Reset", "Filters · :count", "Linked action item" (exists), "This action item was deleted." (exists in component), counts line, drawer texts; verify existing ones in `useActionItemLabels` first |
| Back end | 1 prop rename + 1 Feature test line |

Parallelism: can run in parallel with groups 1, 3, 6-8, 9-12 if it only touches its folder. Shared files it must NOT edit alone: `js/app.tsx` (nothing to change), `lang/*.json` (append-only, merge conflicts likely: coordinate or rebase), `js/types/global.d.ts` (no change), `lib/retro/types.ts` and `lib/action-items/*` (kept, read-only), `skrum/action-item.tsx` and `skrum/action-sheet.tsx` (if a gap needs a fix, make it a separate commit and tell groups 2 and 4, which also use `ActionItem`). Must be sequenced against group 2 (retro, spec order 2 before 5) because of R1 and the deletions; group 4 (`teams/show`, "My actions" / `?team=` link and `ActionItem` use) only reads the page route.

Not verified: that `hooks/use-mobile.tsx` breakpoint equals the phone mockup width; whether the Sheet's due-date control is a native input (R5) and whether it disables Repeat without a due date; whether `ActionItem` prints "Added outside a retro" when `source` is null; Plan14c/14d use of the index; the exact `Pagination` props for server urls (`ui/pagination.tsx` l.560-580 exports `Pagination`, `PaginationPrevious/Next`; I read only the head).
