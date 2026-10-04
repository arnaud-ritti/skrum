# Coverage: action items

Date: 2026-10-04. Branch `tests/coverage-actions`. Browser tests: Pest browser on PostgreSQL. Feature tests: `bin/test-db pgsql`.

New in this pass:
- `tests/Browser/Walkthroughs/CoverageActionItemsTest.php` (CVA-01 to CVA-10).
- `tests/Feature/ActionItems/WorkspaceActionItemReadAccessTest.php`.

## GET routes

| Route | Kind | Renders for | Refused for | Tests |
| --- | --- | --- | --- | --- |
| `GET w/{workspace}/action-items` (`workspaces.actionItems.index`) | page | team member: CVA-01, R24-05 to R24-12, P09b-02a; observer, read only: R24-01e | visitor → `/login`, other workspace → 403, member of another team sees none of the team's items and no deep-linked sheet: CVA-01; feature: `WorkspaceActionItemReadAccessTest`, `ActionItemsPageTest` | browser + feature |
| `GET w/{workspace}/action-items/export` (`workspaces.actionItemCsvExports.show`) | CSV | R24-08 (download link, filters, every page) | feature `ActionItemCsvExportTest` (outsider 403, visitor → login, observed team) | browser + feature |
| `GET w/{workspace}/action-items/{actionItem}/comments` (`workspaces.actionItemComments.index`) | JSON | P09b (sheet threads) | feature `WorkspaceActionItemReadAccessTest` (visitor 401, other workspace 403), `WorkspaceActionItemsTest` (other team 404, member who left 404) | feature |
| `GET w/{workspace}/action-items/{actionItem}/exports/preview` (`workspaces.actionItemExports.preview`) | JSON | P12d-06 (side sheet export) | feature `WorkspaceActionItemReadAccessTest` (visitor 401, other team 404, other workspace 403), `ExportResolutionTest` | feature |
| `GET retros/{retro}/action-items/{actionItem}/comments` (`retros.action-items.comments.index`) | JSON | P09a-02 (board threads) | feature `ActionItemCommentsTest`, `WorkspaceActionItemsTest` | feature |
| `GET retros/{retro}/action-items/{actionItem}/exports/preview` (`retros.action-items.exports.preview`) | JSON | P12d-03, P12d-04 | feature `ExportResolutionTest` (member who may not export 403, guest 403), `GitHubExportTest` | feature |

Phone 390 × 844: R24-10, CVA-04. Dark theme: R24-11. English and informal French: R24-12, CVA-10.

## Mockups

Captures in a temp folder outside the repo: each preview at 1440 with `app.css`, `_preview-bundle.css` and the Lucide icons inlined; the real page seeded like ScreenActions (Atlas, sprints 42 and 41, Jira and Linear tickets), light and dark, French; the bench sections `action-item`, `date-picker`, `pagination`, `table`. No preview has a dark variant: the app's dark page was checked alone.

| Mockup | Status | Notes |
| --- | --- | --- |
| ScreenActions | fixed, open | **Fixed:** the done status read "Terminé"; it reads "Fait" (a `Done status` key in the four languages). **Open (already listed by the walkthrough lane):** the ticket chip ("↗ Jira · ATLAS-1287" in a monospace chip vs the tracker mark "J ATLAS-1287"), which also widens the Ticket column so titles wrap; the search width (spec 24 §9.1 sets the palette's width, the mockup 18.75rem); the breadcrumb (workspace vs team); the badge case ("En cours" / "Terminé" vs "en cours" / "terminé"); the source line ("Atlas · Rétro sprint 42 · 4 oct. 2026" vs "Rétro sprint 42"); the date format ("ven. 9 oct." vs "Ven. 10 oct."). **Open (new):** the header counts read "7 ouvertes · …" where the mockup reads "28 actions ouvertes ou récentes · …"; the assignee reads the full name where the mockup abbreviates it ("Inès B."). |
| ActionItem | fixed, open | **Fixed:** "Fait" as above. **Open (already listed):** dense rows; the page's list rows always show the sub-task field and the comments, the mockup's rows show the meta line only; the due date reads "Échéance 10 oct." where the mockup reads "Ven. 10 oct."; the same ticket chip as above. |
| DatePicker | matches | Calendar, trigger states (empty, filled, overdue with "En retard de 2 jours", invalid, disabled), French week from Monday, range filter with presets and footer. The preset column is 8rem with ellipsis in both. Small: the active preset is a bordered box in the app, a soft background with a tick in the mockup's range filter. |
| Table | matches | Muted header, mixed header box, selected rows on the soft primary, struck done rows, row menu. The real table follows ScreenActions. The Table mockup's footer ("2 sur 22 actions sélectionnées", "Page 1 / 6" with icon chevrons) differs from the actions page footer ("Page 2 sur 2" with "Précédent" / "Suivant"), which ScreenActions does not draw: open, owner's call. |
| Pagination | matches | Numbered, first and last page, both ellipses, narrow containers, compact, counter with page size, "Charger plus" states, French labels. |

## Spec 24 acceptance criteria visible in a browser

| Criterion | Tests |
| --- | --- |
| 7. "Start to" first in the status mapping, saved | CVA-09 |
| 19. Select rows, the bar, apply status, assignee, due date, priority, delete after confirmation, partial result with details, selection kept or cleared | R24-01a, R24-01b, R24-01c, R24-01d, R24-01e |
| 20. "All matching": offer, confirmation, changed count, unticking leaves the mode, sync disabled | R24-02 |
| 20. A page change keeps the mode, a filter change clears it | CVA-03 (found and fixed a bug: the pagination remounted the page) |
| 20. Offer disabled above 500 with its reason | CVA-02 |
| 21. Below 80rem: "Select", phone bar of three actions and "…" | R24-10 |
| 21. Long press enters selection mode with the item selected; a short tap does not | CVA-04 |
| 22. Sync to Jira, one by one, linked rows skipped | R24-04 |
| 22. Sync stops on "reconnect required" | CVA-05 |
| 23. Three statuses on the page, the sheet, the board and the carried-items panel; open counts include started items | R24-09, R24-01b, P09b-01a, P09b-01b, P04 (guest on the board), P18e (board row), CVA-10 (French label) |
| 28. Grouping by sprint: label, badge, counts, "No sprint" last, Reset to Sprint | R24-07 |
| 28. Order Sprint, Team, Assignee, None; a stored choice kept; the team named when the page spans two teams | CVA-06 |
| 29. Search field: placeholder, ⌘K hint, delay, Enter, Escape, Reset, ⌘K focuses without the palette; phone: field in the drawer | R24-06, R24-10 |
| 29. "/" still opens the palette on this page; other pages keep the palette button and ⌘K | CVA-07 |
| 30. Sidebar badge "n overdue" | R24-12, P09b-06b |
| 30. "99+ overdue" with the full count for screen readers, the dot when collapsed, nothing at zero | CVA-08 |
| 8, 9, 10, 26. Filters, old values, counters, search | R24-05, R24-05b, R24-06 (browser); `ActionItemFiltersTest`, `ActionItemSearchTest` (feature) |
| 18. CSV export | R24-08; `ActionItemCsvExportTest` |
| 1 to 6, 11 to 17, 25, 27 | server side only: feature, upgrade, concurrency and MCP tests named in the plan 24 report |
