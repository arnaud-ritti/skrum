# Group 5 — Action items

## Task 5.2 — Action items page on the new table, sheet and filters

Built on the rulings of `pre-build-deviations.md` (PB-01 to PB-12, option A of each "decide" row), which win over the text of the plan. No test was run (working rule of the fifth round); the browser walkthroughs were neither read nor edited.

### Parity (brief 05 §3)

"Row" is a row of the table (from 80rem of viewport); "Item" is an `ActionItem` of the list below that width; "Sheet" is `ActionSheet`.

| # | Action | New control | Done |
|---|---|---|---|
| 1 | Filter by status | facet "Status" (`[aria-label="Status"]`, a `Select` drawn as a facet) with "To do", "Done", "All" (PB-04); "Overdue" is the shortcut beside the facets, with its count, and sets `status=overdue` | yes |
| 2 | Filter by assignee | facet "Assignee": Anyone, Me, Unassigned, each person with the avatar | yes |
| 3 | Filter by team | facet "Team"; a cross ("Show all teams") on the active facet | yes |
| 4 | Persist filters | `use-action-item-filters.ts`, same key and shape; the grouping is the key `group` of the same entry | yes |
| 5 | Restore filters on a visit without query | same hook; without a stored entry the page lands on the current team (PB-01) | yes |
| 6 | Reset | "Reset" at the end of the toolbar, shown when a facet narrows the list: bare URL, stored entry removed, grouping back to None | yes |
| 7 | Pagination | `Pagination` with the server URLs, "Page x of y", in the footer of the table card | yes |
| 8 | Heading | `h1` "Action items" and one line "n open · n overdue · from n rituals"; no subtitle (PB-02) | yes |
| 9 | Empty state | `EmptyState` with the two texts, in the table or in place of the list | yes |
| 10 | "New action item" | button of the topbar (5-D6), icon alone on a phone, only with a team the viewer belongs to | yes |
| 11–12 | Creation dialog | `action-item-create-dialog.tsx`: team select, then `ItemCreateForm` (R8b), reset when the team changes | yes |
| 13 | Complete / reopen | Row: the status badge is the button, named "Mark as done" / "Reopen" (PB-05); Item: its status button; Sheet: status select and footer button | yes |
| 14 | Edit the title | Row: "Edit" of the "…" menu opens the Sheet; Sheet: pencil "Edit action item"; Item: pencil, in place | yes |
| 15–18 | Priority, due date, repeat, assignee | Sheet properties; Item editor | yes |
| 19 | Delete | Row: "Delete" of the "…" menu; Sheet footer; Item button; each asks `ItemDeleteConfirm` first (5-D3) | yes |
| 20–25 | Sub-tasks | `ItemSubtasks` in the Sheet and under an Item | yes |
| 26–31 | Comments | `ItemComments` in the Sheet (always open) and under an Item (toggle) | yes |
| 32–38 | Export to a tracker | `ItemExport`: the icon in the Ticket cell of a Row (5-D2), in the Sheet footer, in the actions of an Item | yes |
| 39–40 | Tracker links, retry of a failed sync | `ActionItemLinkChip` in the Ticket cell, the Sheet and the Item | yes |
| 41 | Source retro | link under the title of a Row, "Added outside a retro" otherwise; "Retrospective" property of the Sheet | yes |
| 42 | Team and assignee | Row: team before the source while no team filter is on (PB-06), Assignee column; "(Guest)" (5-D7) | yes |
| 43 | Creator, follow-up, theme, "Completed in" | Sheet (PB-06); Item meta. A Row shows the repeat as an icon in the Due cell | yes |
| 45 | `?item=` | opens the Sheet (table) or the comments (list), row scrolled into view | yes |
| 46 | Linked item outside the page | section "Linked action item" with one row | yes |
| 47–49 | Reload on focus, coalesced reload, error toast and resync | `use-action-items-realtime.ts`, `useActionItemMutations(…, { resync })`; `counts` is reloaded with `items` | yes |
| 50 | Rights | no "…" menu and no editable field without the right to manage; status button disabled without the right to complete; Sheet read only without either | yes |
| 51 | Locked running retro | server refusal as a toast | yes |
| 52–53 | `data-realtime`, three live events | root of `ActionItemsPage`; an item deleted elsewhere shows "This action item was deleted." in an open Sheet | yes |
| 54 | Accessible names | kept; the table is named "Action items" | yes |

### Places left

| Mockup element | Place | Later |
|---|---|---|
| Selection boxes | first column of the table, empty: `slots.selectionCell`, `slots.selectionHead` of `ActionItemsPage` | AI-1 |
| Floating bulk bar | `slots.bulkBar`, after the list | AI-1 |
| Priority, Due date, Source facets | `slots.extraFacets` → `extraFacets` of `ActionItemFilterBar`, after Assignee | AI-2 |
| "In progress" | `withDoing` of `ActionItem` and `ActionSheet`; a value of the Status facet | AI-3 |
| "Export" in the topbar | `before` of `NewActionItemButton` | AI-4 |
| "Sprint" in "Group by" | one more entry of `ActionItemGroupings` (`lib/action-items/grouping.ts`) | TM-1 |

### Differences with the mockup

Not compared on captures: the bench section and the captures are Task 5.3.

| Difference | Row |
|---|---|
| No selection, bulk bar, sprint groups and badges, priority / due date / source facets, "In progress", topbar "Export", whiteboard and survey sources | D-19 |
| "Group by" is Team / Assignee / None, None selected; the count of a group says "on this page" when the list has several pages | D-19, PB-03, PB-09 |
| Status facet is one choice among To do / Done / All | PB-04 |
| The export icon sits in the Ticket cell where the mockup has "Lier"; the "…" menu holds Edit and Delete | PB-07 |
| Pagination, "Linked action item", side sheet, creation dialog | PB-11 |
| No search field in the topbar | PB-12 |
| The header line says "n open", not "n open or recent" | new row |
| The table starts at 80rem of viewport; from 48rem to 80rem the page shows the faceted toolbar over the list of `ActionItem` | new row |
| On a phone the chips read "Mine n", "Overdue n", "To do n", "Done" (the mockup: "Open", "Completed"), after PB-04; the list is grouped by the "Group by" control, not by retro; no long press, no bottom tab change | new row |
| "Edit" of the "…" menu opens the sheet; the title is edited from its pencil there | new row |
| The ticket chip is `ActionItemLinkChip` (provider and key), not the square and round marks | new row |
| A date within three days reads "Fri, Oct 3 · in 3 days" (browser wording), not "· dans 3 j" | new row |
