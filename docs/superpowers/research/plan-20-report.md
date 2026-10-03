# Plan 20: whiteboard toolbars rebuilt to the mockup (WB-1) — report

Branch `plan-20-whiteboard-toolbars` (worktree `.claude/worktrees/rm20`), cut from `roadmap` at `678bf871`. Spec:
`docs/superpowers/specs/2026-10-21-whiteboard-toolbars-design.md`; plan:
`docs/superpowers/plans/2026-10-21-plan-20-whiteboard-toolbars.md`. The plan's lanes were flattened by the
controller: every task ran in numeric order on this one branch. Final run on 2026-10-03 on the code of `a854d707`;
the commit after it adds this report only. Not pushed; `main` and `roadmap` untouched (the controller merges).

## 1. Result

One command at a time in the shared application container `skrum-laravel.test-1`, database `testing_l20`
(`TEST_DB_DATABASE=testing_l20`, `TEST_DB_WORKDIR=/var/www/html/.claude/worktrees/rm20`), four processes.
PostgreSQL only (owner, 2026-10-03): the four-engine matrix runs once after the last merge into `roadmap`.

| Run | Result |
|---|---|
| `bin/test-db pgsql` (first run, on `0e26a6e8`) | `FAIL, 1 failed, 2 skipped, 6163 passed`: `DesignTokensTest` "starts the stylesheet with the design-system file, unmodified" — see §1.1 |
| `bin/test-db pgsql` (on `a854d707`) | `PASS, Tests: 2 skipped, 6164 passed (55710 assertions)` (4 min 25) |
| `bin/test-db pgsql --concurrency` | `PASS, Tests: 1 skipped, 26 passed (117 assertions)` |
| `composer types:check` (PHPStan) | `[OK] No errors` |
| `vendor/bin/pint --format agent` | `passed` |
| `npm run test` (`vp test run`) | `387 files, 4204 tests passed` |
| `npm run types:check`, `npm run check` | no error; 1092 files formatted, no lint warning in 1075 files |
| `vp build`, then `wayfinder:generate --with-form` | built; nothing to commit afterwards |
| `grep -l "excalidraw" public/build/assets/*.js` | the board chunk, the library's dynamic chunks (its locales, `@excalidraw/mermaid-to-excalidraw` and the mermaid diagram chunks it imports), and `use-sidebar-model`, which holds only the selector string `.excalidraw` of `use-global-shortcuts.ts` (older than this plan), not the library |

The whole suite holds Unit, Feature, Upgrade and Arch (`phpunit.xml`); `TranslationKeysTest`,
`InformalRegisterTest` and the arch rules passed inside it. Browser walkthroughs were not written, read or run
(owner's rule); this task ran no capture and no smoke test.

### 1.1 The one failure, fixed

Tasks 7 and 11 added the text sizes `text-3xs` (the key letter of a tool) and `text-2xs` (the count chip) inside
the `@theme` block that `resources/css/app.css` copies verbatim from `docs/design-system/app.css`. The per-task
runs never ran `DesignTokensTest`, which requires that copy to be unmodified. Commit `a854d707` moves both sizes to
a "Plan 20 additions to @theme" block at the end of `app.css`, like the additions of plans 18b to 18e; the build
still emits `.text-2xs` and `.text-3xs`, and the whole suite passes after it.

## 2. Acceptance criteria (spec §13)

Vitest files ran in `npm run test`; PHP tests in the PostgreSQL suite.

| # | Criterion | Proved by |
|---|---|---|
| 1 | Library chrome hidden; tool bar, history, zoom bar and minimap in place | `board-chrome.test.tsx` ("shows the tool bar, the selection bar, the history and the zoom bar in edit mode", "wears its own chrome…"); `whiteboard-theme.test.ts`; `excalidraw-contract.test.ts` ("still styles the zoom group the CSS hides"); capture `whiteboard-toolbars-light-1440-fr.png` |
| 2 | Ten tools in order with keys and separators; sets the library tool; follows a library change | `tools.test.ts` ("lists the tools of ScreenWhiteboard in its order and groups", "reads the library tool as one of the board tools"); `whiteboard-toolbar.test.tsx`; `canvas-tools.test.tsx` ("sets the tool of the library for each tool of the bar, and shows the library tool as pressed") |
| 3 | Sticky placement, centre from the sub-bar, back to Selection; sync | `canvas-tools.test.tsx` ("adds a selected sticky of the chosen colour under the pointer, then returns to the selection", "adds a sticky in the middle of the view from a colour of the sub-bar…", "returns to the selection once when the placing pointer is cancelled…"); `sticky-tool.test.tsx`; S: `tests/Browser/Smoke/WhiteboardHarnessTest.php` is Task 18's proof — not run by this task |
| 4 | Shape and Connector sub-bars, eight colours, last choice kept | `canvas-tools.test.tsx` ("chooses the kind of shape and of connector in their sub-bars", "keeps the shape and the connector the library last used…", "shows the eight colours of the shape tool…", "makes the colour the fill of the next shapes"); `tools.test.ts` |
| 5 | Undo / Redo on the library's history, disabled as its buttons | `canvas-commands.test.ts` ("presses the hidden undo button and reads its state", "treats a missing control as disabled"); `canvas-view.test.tsx` ("undoes and redoes through the hidden buttons of the library, enabled as they are") |
| 6 | 10 % steps around the centre, 10 %–3000 %, reset to 100 %, Fit | `viewport.test.ts`; `canvas-view.test.tsx` (zoom, two presses in one frame, disabled ends, reset, fit, empty board) |
| 7 | Minimap: live elements, colours, visible area, press to centre, remote moves, remembered toggle | `minimap.test.ts`; `canvas-view.test.tsx` ("draws the live elements and the visible area, recomputed only when the scene changes", "centres the view on a press in the minimap…", "opens the minimap by default and remembers its toggle in the browser", "keeps the frame of the minimap still while its view is dragged"); `use-canvas-snapshot.test.ts` (remote changes reach the bars through `onChange`) |
| 8 | Selection bar under / above, inside the canvas; count chip; hidden while dragging | `selection.test.ts`; `canvas-selection.test.tsx` ("places the bar under the common bounds…", "hides the bar while the selection is dragged…", "renders nothing … when the selected element is a tombstone") |
| 9 | Colours recolour filled shapes and set the next fill; absent without fill | `canvas-selection.test.tsx` ("recolours the selected shapes that have a fill, and only them, and makes it the next fill", "shows no colours when nothing selected has a fill") |
| 10 | Group, align ×4, distribute ×2, Delete do the library's command | `canvas-commands.test.ts` ("sends the library keys of every command", "dispatches the key on the library container…"); `canvas-selection.test.tsx` ("sends the library its own shortcut for group, each alignment, delete and lock…"); `excalidraw-contract.test.ts`. S (the stored result of one command): not run — walkthroughs are out by the owner's rule |
| 11 | Lock for the facilitator only; locked element disables colours and Delete with the reason | `canvas-selection.test.tsx` ("offers Lock to the facilitator only, and disables colours and Delete on a locked element for the others"); `whiteboard-selection-bar.test.tsx` |
| 12 | "Styles" toggles the native panel | `canvas-selection.test.tsx` ("toggles the styles panel, and closes it when the selection goes"); `board-chrome.test.tsx`; `whiteboard-theme.test.ts` ("keeps the closed property panel laid out…"); capture `whiteboard-styles-light-1440-fr.png`. That every control of the panel still works is not proved by a test: the panel is the library's own, shown again |
| 13 | Hamburger entries in the board menu | `board-menu.test.tsx` ("gives %s the canvas entries before the deletion", "runs \"%s\" on the canvas", "chooses the canvas background among the paper and the five picks", "leaves out what changes the canvas while it is read only", "has no canvas entry until the canvas is ready"); `palette.test.ts` ("matches DEFAULT_CANVAS_BACKGROUND_PICKS of the pinned library"); `excalidraw-contract.test.ts` (canvas search tab). The wiring of each entry to its dialog (`board.tsx`: `openDialog` `imageExport` and `help`, `toggleSidebar`, `clearCanvas`) has no test of its own; capture `whiteboard-board-menu-light-1440-fr.png` |
| 14 | Locked non-facilitator or read mode: zoom bar and minimap only | `board-chrome.test.tsx` ("shows only the zoom bar, and the minimap from lg, in view mode", "shows no bar on a phone to a viewer the lock keeps out"); `canvas-tools.test.tsx` and `canvas-selection.test.tsx` (nothing in view mode); capture `whiteboard-board-locked-guest-light-1440-fr.png` |
| 15 | A follower who zooms or pans is paused | `canvas-view.test.tsx` ("pauses a follower who zooms from the bar", with `useWhiteboardFollow` and a fake API). The pause comes from the library's `onScrollChange`, which a minimap move also fires; no separate case presses the minimap as a follower |
| 16 | Phone: read dock Fit + Modifier; edit bar Selection, Sticky, Pencil, "…"; drawer; no minimap, zoom bar, connector or frame | `phone-toolbar.test.tsx`; `board-chrome.test.tsx` (the two phone cases); `read-mode-toggle.test.tsx` ("puts the dock actions before the toggle"); `tools.test.ts` ("offers no connector and no frame on a phone"); `whiteboard-theme.test.ts` ("hides the library tool row of the phone layout…") |
| 17 | One tab stop, arrows, Home and End; name, key, pressed state exposed | `whiteboard-toolbar.test.tsx`, `whiteboard-view-controls.test.tsx`, `whiteboard-selection-bar.test.tsx` (the roving and naming cases of each bar) |
| 18 | N, C, M only with the canvas or a bar focused; preference off swallows single keys; typing still works | `canvas-tools.test.tsx` ("arms the sticky tool with N and the connector with C…", "answers N and C neither in the text editor, a field, a dialog…"); `canvas-view.test.tsx` (M, both cases); `use-canvas-key-guard.test.ts`; `board-chrome.test.tsx` ("stops the single keys at the canvas while the single-key shortcuts are off") |
| 19 | Shortcuts dialog lists the board's keys, without the old note | `sections.test.ts` ("lists the keys of the whiteboard's tool bar", which also asserts no note) |
| 20 | A board of before this plan: same scene, stickies show their swatch selected | `canvas-selection.test.tsx` ("recolours the selected shapes…": a stored rectangle with the Sun fill and hachure, as today's stickies are, shows Sun checked); `canvas-colors.test.ts` (`colorBarState`, its cases kept). The scene loading of `board.tsx` is not changed by this plan |
| 21 | No new dependency; front gates; library only on the whiteboard page | `package.json` unchanged by the plan; §1 above |
| 22 | New keys in four languages, informal | `TranslationKeysTest`, `InformalRegisterTest` in the PostgreSQL suite (§1) |
| 23 | Captures match the mockups apart from approved rows; D-21 (toolbars) and D-49 removed | Task 18 captures (§3); Task 19 commit `0e26a6e8` (18e table, `deviations.md`) |
| 24 | Whole PHP suite on PostgreSQL, Vitest suite | §1 above; the run after the merge into `roadmap` is the controller's |

## 3. Differences that remain with the mockups

Every row is in the 18e table "Deviations from the mockup" (Task 19), with its status:

- **P20-01 to P20-10**, approved by the owner on 2026-10-03 before the build (comments, convert to actions, follow,
  sticky authors and the typing ring not rendered; the library's canvas and selection frame; "Sticky note (N)";
  "Styles"; Shape and Connector sub-bars and "More tools"; the Align menu of six commands; the phone's read dock with
  Fit and Modifier; no hint line; zoom range 10 %–3000 %; minimap from `lg` only).
- **P20-11** — ScreenWhiteboard draws the zoom bar above the minimap; built as the spec §9.1 places it, the minimap
  above the zoom bar, so the zoom bar and its Minimap toggle keep one place. Kept as built on the owner's behalf:
  **to approve by the owner**.
- **P20-12** — the WhiteboardToolbar preview shows five sticky colours in the sub-bar; built with the eight
  colours, covered by 7-D1.
- **D-21** keeps only its backlog part (comments, convert to actions, follow, sticky authors — former plan 28);
  **D-49** is removed.

Captures were taken in one configuration only (light, 1440, French). The dark, 390 and English captures of the
whiteboard screens still in `tests/visual/__screenshots__` were not retaken: they show the board before this plan
and are stale until the next full visual run.

## 4. Existing tests edited or removed

Removed, approved by the owner on 2026-10-03 (plan, **Owner decisions**):

- `resources/js/components/whiteboard/canvas-colors.test.tsx` (5 cases), with `canvas-colors.tsx`: "shows the eight
  colours with the current one checked" and "makes the colour the fill of the next shapes when nothing is selected"
  moved to `canvas-tools.test.tsx`; "recolours the selected shapes that have a fill, and only them" moved to
  `canvas-selection.test.tsx`; "renders nothing while the bar has no use" covered by "shows no colours when nothing
  selected has a fill"; "keeps a place after the bar for the actions on a selection" has no successor (the slot is
  gone; `canvas-selection.test.tsx` "keeps no place for actions on a selection" pins its absence).
- `sticky-tool.test.tsx`, four popover cases: "adds a selected note … in the middle of the view" and "moves the
  choice with the arrow keys …" moved to `canvas-tools.test.tsx`; "opens the eight colours with Sun chosen" and "has
  the look of a canvas tool inside the shapes toolbar" have no successor (the popover and the library toolbar slot
  are gone). The file keeps two cases on `addSticky`.

Edited:

- `sections.test.ts`: "lists the keys the whiteboard canvas answers to" became "lists the keys of the whiteboard's
  tool bar", with the board's keys as built and no note.
- `board-menu.test.tsx`, `read-mode-toggle.test.tsx`, `palette.test.ts`, `whiteboard-theme.test.ts`,
  `whiteboard-toolbar.test.tsx`, `utils.test.ts`: cases added, none changed or removed.
- `tests/Browser/Support/InteractsWithWhiteboards.php`: `selectWhiteboardTool` and `addWhiteboardSticky` press the
  board's own tool bar and sub-bar. `tests/Browser/Visual/WhiteboardVisualTest.php`: the new cases of Task 18; the
  captures of the removed colour bar and sticky popover went, with their sixteen PNG files
  (`whiteboard-board-colors-*`, `whiteboard-board-sticky-colors-*`).

## 5. Library internals the board now relies on

All pinned to `@excalidraw/excalidraw` 0.18.1, each marked "Check this when the library is upgraded":

- `NativeChrome` (`lib/whiteboard/canvas-commands.ts`): `.excalidraw-container`, `.App-toolbar-container`,
  `.layer-ui__wrapper__footer-left .zoom-actions`, `.layer-ui__wrapper__footer-left .undo-redo-buttons`,
  `.layer-ui__wrapper__footer-right`, `.main-menu-trigger`, `.selected-shape-actions`, `.App-bottom-bar`, and
  `.excalidraw--mobile .App-bottom-bar .App-toolbar-content`; hidden with CSS under `.skrum-whiteboard--own-chrome`
  in `resources/css/excalidraw-theme.css`, never removed.
- The undo and redo test ids `button-undo`, `button-redo` (pressed by the history bar; their `disabled` is the
  history state).
- `CommandKeys` (`canvas-commands.ts`), the library's own shortcuts sent to its container: group mod+G, ungroup
  mod+shift+G, align left/right/top/bottom mod+shift+arrows, distribute alt+H / alt+V, delete Delete, lock
  mod+shift+L, clear canvas mod+Delete (opens the library's confirmation); `isApplePlatform` follows the
  library's `isDarwin`.
- `MinZoom` 0.1 and `MaxZoom` 30 (`viewport.ts`), the library's `MIN_ZOOM` / `MAX_ZOOM`.
- `CanvasBackgrounds` (`palette.ts`): the paper and `DEFAULT_CANVAS_BACKGROUND_PICKS`.
- `CanvasSearchSidebar` (`excalidraw.ts`): `DEFAULT_SIDEBAR` and `CANVAS_SEARCH_TAB`; the dialogs `imageExport` and
  `help` opened through `appState.openDialog`.
- The closed property panel stays laid out (hidden with `visibility`), because the library measures the opacity
  slider's width.
- `excalidraw-contract.test.ts` reads the library's files in `node_modules` and fails when the version, the
  canvas search names or the hidden zoom group change; `palette.test.ts` checks the background picks.

## 6. Stale walkthroughs

Not edited or run (owner's rule). They click the library's tool bar, main menu, zoom buttons or the old sticky
trigger and are expected to fail until rewritten: `tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php`,
`Plan17bWhiteboardTemplatesTest.php`, `Plan17cWhiteboardFacilitationTest.php`, `Plan18eWhiteboardTest.php`.
`Plan17dWhiteboardSecrecyTest.php` may be affected as well; it was not opened.

## 7. Decisions taken on the owner's behalf

- The lanes were flattened (controller): Tasks 7 to 12 ran on the plan branch, not in lane worktrees.
- Running `tests/Browser/Smoke/WhiteboardHarnessTest.php` in Task 18: the smoke test is not a walkthrough (plan,
  Task 18 Step 3).
- P20-11, the minimap above the zoom bar: kept as built, to approve (§3).
- Files the plan's file structure did not list, added to keep `board.tsx` and the containers small:
  `components/whiteboard/board-chrome.tsx` (the canvas wrapper and the bars, with its test),
  `components/whiteboard/use-canvas-tools.ts` (the tool logic shared by the tool bar and the phone bar) and
  `components/whiteboard/use-canvas-key-guard.ts` (the single-key preference, with its test).
- Clear canvas and Canvas background stay out of the board menu in view mode, as in the library's own menu.
- The four canvas entries of the board menu name the board in French, Spanish and German (tableau, tablero, Board),
  as the plan's key table gives them.
- On a phone, "Styles" opens the library's panel of shape actions; the reactions bar goes above the compact bar
  and gives way to an open sticky or shape sub-bar.
- The two text sizes of the bars live in a plan 20 `@theme` block after the design-system copy (§1.1).
