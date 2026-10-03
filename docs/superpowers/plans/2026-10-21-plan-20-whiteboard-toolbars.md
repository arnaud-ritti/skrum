# Whiteboard toolbars rebuilt to the mockup (Plan 20, WB-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Owner decisions**, **Global Constraints**, **Pre-build deviations** and its own task before anything else. A screen task also follows the "Screen task procedure" of `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, with the working rules below (no walkthrough, captures in Task 18 only).

**Status: ready to execute (2026-10-03).** The seven questions of spec §15 are answered, each with the recommended option this plan was written on; the test removals are approved (see **Owner decisions**); every pre-build deviation row P20-01 to P20-10 is approved by the owner on 2026-10-03 (see **Pre-build deviations**). The owner's "Oui vas y" of 2026-10-03 covers running this plan autonomously: rulings logged in the report, a notice to the owner at the end of the plan, no push.

**Goal:** The whiteboard shows the four floating bars of ScreenWhiteboard — a vertical tool bar with sub-bars, a selection bar with an element count, the history at the bottom left, the zoom and a minimap at the bottom right — and the compact bottom bar of MobileRituals on a phone, in place of Excalidraw's own chrome, with every tool, style, menu entry and shortcut of today still reachable.

**Architecture:** Front only. Pure logic in `resources/js/lib/whiteboard/` (`tools.ts`, `viewport.ts`, `minimap.ts`, `selection.ts`, `canvas-commands.ts`), one hook that turns the library's `onChange` into a per-frame snapshot (`hooks/use-canvas-snapshot.ts`), presentational bars in `components/skrum/`, and three containers in `components/whiteboard/` (`canvas-tools.tsx`, `canvas-view.tsx`, `canvas-selection.tsx`) mounted over the canvas by `board.tsx`. Excalidraw 0.18.1 stays the canvas: tools through `api.setActiveTool` (with a custom tool for sticky placement), the view through `api.updateScene` and `api.scrollToContent`; where 0.18.1 has no API (undo/redo state, group, align, distribute, delete, element lock, property panel), the containers press the library's own hidden buttons or dispatch its own shortcuts, through named helpers of `lib/whiteboard/excalidraw.ts` and `canvas-commands.ts`. The library's chrome is hidden with CSS under one wrapper class, never removed.

**Tech Stack:** Inertia 3, React 19, Tailwind 4, `@excalidraw/excalidraw` 0.18.1 (pinned), vite-plus (Vitest, jsdom, `@testing-library/react`), lucide-react; Laravel 13 / Pest only for the translation tests; `bin/test-db` for PHP runs. Read `package.json` before Task 1 and stop if `@excalidraw/excalidraw` is not exactly `0.18.1`.

**Spec:** `docs/superpowers/specs/2026-10-21-plan-20-whiteboard-toolbars-design.md` (renamed to `docs/superpowers/specs/2026-10-21-whiteboard-toolbars-design.md` in Task 19). Parents: `docs/superpowers/specs/2026-10-01-whiteboard-design.md`, `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` §5. Mockups: `docs/design-system/components/ScreenWhiteboard`, `WhiteboardToolbar`, `MobileRituals` (frame 1), `ExcalidrawTheme`, `KeyboardShortcuts` — for each, the `README.md` and the `preview.html`; bar classes in `docs/design-system/components/_preview-bundle.css` (`sk-wbbar`, `sk-wbbar--v`, `sk-tool`, `sk-tool-k`, `sk-minimap`, `sk-minimap-view`, lines 438–444).

**Not in this plan:** anything of the former plan 28 (comments, follow a person, sticky authors, convert to actions) — backlog, no place reserved; the `selectionActions` slot of `canvas-colors.tsx` goes with that component; any back-end change; an Excalidraw upgrade; browser walkthroughs (owner's working rule: none is written, edited or run).

**Roadmap order (owner, 2026-10-03):** wave A runs plans 20, 21, 26, 27 and 29 in parallel; then 22; then 23; then 24 and 25. Plan 20 depends on no other roadmap plan and none of the wave-A plans touches the whiteboard files of this plan; the only shared files are `lang/*.json` (keys appended; the controller keeps both sides on a merge conflict into `roadmap`).

**Tasks:** 20. Step A, single writer: 1 to 6 (library contract, pure logic, snapshot hook). Step B, three lanes in worktrees: Tools (7, 8), View (9, 10), Selection (11, 12). Step C, single writer: 13 (board integration), 14 (board menu), 15 (phone), 16 (keyboard), 17 (translations), 18 (captures), 19 (deviations and documents), 20 (full suites and report).

## Branch and run

- Base: the integration branch `roadmap` at `19db587f` or later (it holds `main` at `18d3637e`: plans 18, database portability and 19). Check before Task 1, and stop if one fails: `resources/js/components/whiteboard/board.tsx` mounts `CanvasColors` and `StickyTool`; `resources/js/hooks/use-whiteboard-toolbar-slot.ts` exists; `resources/js/lib/whiteboard/excalidraw.ts` exports `ToolbarDom`; `node_modules/@excalidraw/excalidraw/package.json` says `0.18.1`.
- Branch `plan-20-whiteboard-toolbars` from that base; at the end (Task 20) the controller merges it into `roadmap` and runs the PostgreSQL suite there. **Never push; never merge into `main`** (main is fast-forwarded only when the owner asks).
- Step A runs on the branch with one writer. Lanes run in git worktrees on branches `lane/20-tools`, `lane/20-view`, `lane/20-selection`, cut from the head after Task 6; the controller merges one lane at a time and runs after each merge: `npm run types:check`, `npm run check`, `npm run test -- whiteboard`, `npm run build:front`, and `bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php`.
- From a worktree, `bin/test-db` needs `TEST_DB_CONTAINER` and `TEST_DB_WORKDIR` (see `docs/database.md`, "Running the tests on an engine"). Never run two whole suites at once in the shared container.
- **Every task re-reads the files it touches**; a line number or a method body quoted here that no longer matches is followed in spirit and reported.

## Lanes

| Step / lane | Tasks | Branch | Files it owns | Files it shares (and how) |
|---|---|---|---|---|
| A | 1–6 | `plan-20-whiteboard-toolbars` | `lib/whiteboard/{excalidraw,canvas-commands,tools,viewport,minimap,selection}.ts`, `hooks/use-canvas-snapshot.ts`, their tests | — |
| Tools | 7, 8 | `lane/20-tools` | `components/skrum/whiteboard-toolbar.tsx` (+ test), `components/whiteboard/canvas-tools.tsx` (+ test), `components/whiteboard/sticky-tool.tsx` (+ test) | `lang/*.json` (appends keys at the end: the controller keeps both sides on a conflict) |
| View | 9, 10 | `lane/20-view` | `components/skrum/whiteboard-view-controls.tsx` (+ test), `components/whiteboard/canvas-view.tsx` (+ test) | `lang/*.json` (as above) |
| Selection | 11, 12 | `lane/20-selection` | `components/skrum/whiteboard-selection-bar.tsx` (+ test), `components/whiteboard/canvas-selection.tsx` (+ test) | `lang/*.json` (as above); reads `WhiteboardColorBar` of `skrum/whiteboard-toolbar.tsx` without editing it |
| C | 13–20 | `plan-20-whiteboard-toolbars` | `components/whiteboard/board.tsx`, `board-header.tsx`, `board-menu.tsx`, `read-mode-toggle.tsx`, `phone-toolbar.tsx`, `resources/css/excalidraw-theme.css`, `resources/css/app.css`, `lib/shortcuts/sections.ts`, `tests/Browser/Support/InteractsWithWhiteboards.php`, `tests/Browser/Visual/WhiteboardVisualTest.php`, docs | — |

No two lanes edit the same source file. The lanes only meet in `board.tsx`, which none of them edits: Task 13 mounts what they produced.

## Owner decisions

The seven questions of spec §15, **answered by the owner on 2026-10-03**. Every answer is the recommended option the plan was written on, so no task changes; the tasks below are binding as written.

| # | Question | Owner's answer (2026-10-03) | Tasks that carry it |
|---|---|---|---|
| 1 | Sticky note key | **A** (answered): N; S stays the library's stroke picker | 2 (`StickyKey = 'N'`), 8, 16, 18 |
| 2 | Library's property panel | **A** (answered): "Styles" toggles the themed native panel, hidden by default | 12, 13 |
| 3 | Library's hamburger | **A** (answered): hidden; its entries in the board menu, with a "Canvas background" sub-menu | 13, 14 |
| 4 | Tools the mockup lacks | **A** (answered): Shape and Connector sub-bars + "More tools" (laser, keep the tool, pen mode) | 2, 7, 8 |
| 5 | Phone edit mode | **A** (answered): the compact bottom bar of MobileRituals + drawer | 13, 15 |
| 6 | Minimap default | **A** (answered): open from `lg`, remembered per browser | 10 |
| 7 | Single-key preference | **A** (answered): when off, the board swallows every single-character key, the library's included, except while text is being typed | 16 |

**Tests removed with the component they test — approved by the owner on 2026-10-03** (cases moved where a successor exists; this is the approval the global constraint "no test is deleted" asks for): `resources/js/components/whiteboard/canvas-colors.test.tsx` (5 cases: "shows the eight colours with the current one checked" and "makes the colour the fill of the next shapes when nothing is selected" move to `canvas-tools.test.tsx` (Task 8 case 5), "recolours the selected shapes that have a fill, and only them" moves to `canvas-selection.test.tsx` (Task 12 case 3); "renders nothing while the bar has no use" has no direct successor (its intent is covered by Task 12 case 3, "absent when nothing selected has a fill") and "keeps a place after the bar for the actions on a selection" has none (the `selectionActions` slot is removed, spec §3)) and the four cases of `sticky-tool.test.tsx` that test the popover (`opens the eight colours with Sun chosen`, `adds a selected note … in the middle of the view`, `moves the choice with the arrow keys …`, `has the look of a canvas tool inside the shapes toolbar`): the second and third move to `canvas-tools.test.tsx` (Task 8), the first and fourth have no successor (the popover and the library toolbar slot no longer exist).

## File structure

Created:

| File | Responsibility |
|---|---|
| `resources/js/lib/whiteboard/canvas-commands.ts` | the library's chrome selectors (`NativeChrome`), its hidden undo/redo buttons, and its own shortcuts used as commands (group, ungroup, align ×4, distribute ×2, delete, element lock, clear canvas) |
| `resources/js/lib/whiteboard/tools.ts` | the board's tools, their keys, their mapping to the library's active tool |
| `resources/js/lib/whiteboard/viewport.ts` | zoom steps, zoom around the centre, visible area, centring, panning |
| `resources/js/lib/whiteboard/minimap.ts` | minimap items and the scene ↔ minimap transform |
| `resources/js/lib/whiteboard/selection.ts` | what a selection is (count, units, fill, group, lock) and where its bar goes |
| `resources/js/hooks/use-canvas-snapshot.ts` | the library's `onChange` as one snapshot per animation frame |
| `resources/js/components/skrum/whiteboard-view-controls.tsx` | `WhiteboardZoomBar`, `WhiteboardMinimap`, `WhiteboardHistoryBar` |
| `resources/js/components/skrum/whiteboard-selection-bar.tsx` | `WhiteboardSelectionBar`, `WhiteboardSelectionCount` |
| `resources/js/components/whiteboard/canvas-tools.tsx` | the tool bar, its sub-bars, sticky placement, "More tools", the board's own tool keys |
| `resources/js/components/whiteboard/canvas-view.tsx` | zoom bar, minimap, history bar |
| `resources/js/components/whiteboard/canvas-selection.tsx` | selection bar, count chip, "Styles" |
| `resources/js/components/whiteboard/phone-toolbar.tsx` | the phone's bottom bar and its drawer |
| each with its `.test.ts(x)` | |

Modified: `resources/js/lib/whiteboard/excalidraw.ts` (re-exports `getCommonBounds`; `ToolbarDom` removed in Task 13); `resources/js/components/skrum/whiteboard-toolbar.tsx` (adds `WhiteboardToolbar`; `WhiteboardColorBar` unchanged); `resources/js/components/whiteboard/sticky-tool.tsx` (keeps `stickyAt`, adds `addSticky`, loses the popover in Task 13); `board.tsx`, `board-header.tsx` (the `sticky` slot goes), `board-menu.tsx`, `read-mode-toggle.tsx`; `resources/css/excalidraw-theme.css`, `resources/css/app.css`; `resources/js/lib/shortcuts/sections.ts` (+ test); `lang/en.json`, `fr.json`, `es.json`, `de.json`; `tests/Browser/Support/InteractsWithWhiteboards.php`, `tests/Browser/Visual/WhiteboardVisualTest.php`.

Deleted (Task 13): `resources/js/components/whiteboard/canvas-colors.tsx` and its test; `resources/js/hooks/use-whiteboard-toolbar-slot.ts`; `ToolbarDom` of `excalidraw.ts`.

## Global Constraints

- **Mockup first** (parent spec §5 rule 13). A screen follows ScreenWhiteboard, WhiteboardToolbar and MobileRituals: layout, placement, labels, states. A difference is fixed, or is a row of **Pre-build deviations**, put to the owner before its screen is built. Captures are taken once, in Task 18, in light, at 1440, in French, and compared with the mockups in Task 19.
- **Front rules** of the parent spec §5 on every front file: tokens only (no hex in components; the canvas-data exemption of ruling 36 covers the five canvas background picks of Task 14 and nothing else), rem, Tailwind scale (no arbitrary size; sizes missing from the scale go to `@theme`), no overflow from 20rem to 60rem, visible focus `outline-2 outline-ring outline-offset-2`, contrast, `prefers-reduced-motion`, lucide icons only, the literal call shape `t('…')`, presentational `skrum/` components (no network, no Echo, no router, no Excalidraw import: they receive values and callbacks).
- **Front only.** No route, controller, policy, model, migration, event, channel or prop changes; no PHP outside `lang/*.json`, `tests/Browser/Support/InteractsWithWhiteboards.php` and `tests/Browser/Visual/WhiteboardVisualTest.php`. **Database (owner rule):** Eloquent only — this plan writes no database code; the rule binds any fixture the capture task adds (factories and the helpers of `tests/Pest.php`, no raw SQL, `docs/database.md` rules 1–12).
- **Library internals.** Every selector, test id, class name or shortcut of Excalidraw 0.18.1 that the code relies on is a named constant of `lib/whiteboard/excalidraw.ts` or `lib/whiteboard/canvas-commands.ts`, with the sentence "Check this when the library is upgraded." No hand-written replacement of a library action (no own align, group or delete).
- **Tests, per task (owner's working rules).** Vitest is written first and run per task: `npm run test -- <pattern>`, the red step once, the green step after. A task that adds translation keys runs the PHP translation tests on PostgreSQL: `bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php`. **Engines (owner, 2026-10-03, "Lance les 4 bases seulement à la fin"):** every run of this plan — per task, after each lane merge, in Task 20 and at the merge into `roadmap` — is on PostgreSQL only; the four-engine matrix (pgsql, sqlite, mariadb, mysql) runs once for the whole roadmap, after the last merge into `roadmap` (plans 24 and 25), not in this plan. The portability rules still bind: Eloquent only, no raw SQL (this plan writes no database code anyway).
- **No browser walkthrough** is written, edited or run (`tests/Browser/Walkthroughs`). Captures only, in Task 18, light, 1440, French. The shared browser helper and the whiteboard visual test are updated in Task 18 because the captures and the smoke test use them.
- **No new dependency**, PHP or JS, without the owner's approval. None is needed: `Tooltip`, `Kbd`, `ToggleGroup`, `DropdownMenu`, `Drawer`, `Separator` exist in `components/ui/`.
- **Four languages, informal.** Every new `t('…')` key is added to `lang/en.json`, `fr.json`, `es.json`, `de.json` in the commit that introduces it, in the informal register (French "tu", Spanish "tú", German "du"); a key that exists keeps its value; Task 17 holds the values of every key and reviews them.
- **No test is deleted** without the owner's approval; the deletions this plan needs are listed under **Owner decisions** and were approved on 2026-10-03. Any other deletion is asked first.
- Front gates after every task: `npm run types:check`, `npm run check`, `npm run build:front`.
- One commit per task, in the repository's style (`feat(whiteboard): …`, `test(visual): …`, `docs: …`); a change to a shared `skrum/` component is its own commit inside the task. Every commit message ends with:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE
```

## Review Focus

The inputs the spec implies and no task would exercise without being told, most likely first; each line names the task whose tests pin it.

1. **A key typed into the canvas text editor** (a sticky's label containing "n", "c" or "m") must type the letter, never switch the tool or toggle the minimap — Task 8 (N, C), Task 10 (M), Task 16 (the preference's capture listener).
2. **The board locks while the sticky tool is armed or a selection bar is open** (a `board.changed` arriving mid-gesture): a press must not add a sticky, the bars must vanish — Tasks 8 and 12.
3. **The selected element is deleted or moved by another browser**: the bar and the chip follow or disappear on the next frame, never point at a ghost — Task 5 (summary of a tombstoned selection) and Task 12.
4. **An empty board**: the minimap draws only the visible area, "Fit to screen" does nothing harmful, the selection bar never shows — Tasks 4 and 10.
5. **The ends of the zoom range and a follower**: + at 3000 % and − at 10 % are disabled, and a follower who presses either is paused — Tasks 3 and 10.

---

## Pre-build deviations

Put to the owner before the screens are built (owner's rule of the fifth round). Spec §16. **Answered by the owner on 2026-10-03: every row approved as listed** — P20-07 with the recommendation ("Fit to screen" and the Edit button in the read dock), P20-08 and P20-10 approved by name, the others approved as listed. Nothing to build changes; Task 7 may start after Task 6. Task 19 copies these rows, with this status, into the 18e deviation table.

| # | Mockup element | Built | Reason | Owner (2026-10-03) |
|---|---|---|---|---|
| P20-01 | Topbar "Commentaires"; selection bar "Convertir en actions"; author line on stickies; "Suivre Camille"; "is typing" ring | not rendered, no place reserved | O: backlog (former plan 28) | approved as listed |
| P20-02 | Canvas content of the mockup (SVG shapes, `wb-sel` frame with eight handles and a rotation dot) | the library's canvas and selection frame, themed in `--primary` | S §3 | approved as listed |
| P20-03 | "Post-it (S)" in ScreenWhiteboard | "Sticky note (N)" | O: decision 1 | approved as listed |
| P20-04 | no "Styles" in the selection bar | "Styles" | O: decision 2 (no feature lost) | approved as listed |
| P20-05 | no shape or connector sub-bar, no "More tools" | sub-bars and "More tools" | O: decision 4 | approved as listed |
| P20-06 | one "Aligner" icon | the icon opens a menu of six commands | S: one icon cannot be six commands | approved as listed |
| P20-07 | phone read dock: "Déplacer la vue", "Réagir", "Commentaires" | "Fit to screen" and "Modifier"; reactions keep their own strip; no hand | O: D-58; N (comments) | approved (rec.: Fit + Edit dock) |
| P20-08 | ExcalidrawTheme's centred hint line | not shown (it lives in the hidden library tool bar) | S §5 rule 3 | approved |
| P20-09 | WhiteboardToolbar README: zoom 10 %–400 % | 10 %–3000 % | F | approved as listed |
| P20-10 | minimap at every desktop width | from `lg` only | A (no overlap) | approved |

---

### Task 1: The library contract — hidden chrome, native controls, commands

**Read first:** `resources/js/lib/whiteboard/excalidraw.ts` (whole file); `resources/css/excalidraw-theme.css`; `resources/css/app.css:477-575` (the existing adjustments of 0.18.1); spec §5 rules 2–3 and §14. Then confirm in `node_modules/@excalidraw/excalidraw/dist/dev/index.js` each fact this task encodes (the line numbers are those read for the spec; search by the quoted string): `className: "App-toolbar-container"` (desktop tool bar island, ~21183); `"layer-ui__wrapper__footer-left"` holding `ZoomActions` (class `zoom-actions`), `UndoRedoActions` (`undo-redo-buttons`) and the touch `FinalizeAction` (~16745); `"layer-ui__wrapper__footer-right"` (the help button, ~16781); `"data-testid": "main-menu-trigger"` (~17559); `"selected-shape-actions"` (~21145); `className: "App-bottom-bar"` (~15558); `"data-testid": "button-undo"` / `"button-redo"` with `disabled: isUndoStackEmpty` (~13780, ~13819); `onKeyDown: this.props.handleKeyboardGlobally ? void 0 : this.onKeyDown` on `excalidraw excalidraw-container` (~29858); `ActionManager.handleKeyDown` with no `isTrusted` check (~13912); the `keyTest` of `group`, `ungroup`, `alignLeft|Right|Top|Bottom`, `distributeHorizontally|Vertically`, `deleteSelectedElements`, `toggleElementLock` (~7053, 7161, 7723–7819, 7981, 8011, 1280, 9176); `var isDarwin = /Mac|iPod|iPhone|iPad/.test(navigator.platform)` (`chunk-*.js`). A fact that differs stops the task and is reported.

**Files:**
- Modify: `resources/js/lib/whiteboard/excalidraw.ts` (re-exports `getCommonBounds`; nothing else)
- Create: `resources/js/lib/whiteboard/canvas-commands.ts` (no import of the library or of its CSS, so that jsdom tests load it directly), `resources/js/lib/whiteboard/canvas-commands.test.ts`, `resources/js/lib/whiteboard/excalidraw-contract.test.ts`

**Interfaces:**
- Produces, all in `canvas-commands.ts`: `NativeChrome` (selectors), `NativeControl` (`'undo' | 'redo'`), `pressNativeControl(canvas: HTMLElement | null, control: NativeControl): boolean`, `nativeControlEnabled(canvas: HTMLElement | null, control: NativeControl): boolean`, `CanvasCommand`, `CommandKeys`, `commandEvent(command, apple): KeyboardEventInit`, `runCanvasCommand(canvas: HTMLElement | null, command: CanvasCommand, platform?: string): boolean`, `isApplePlatform(platform: string): boolean`; in `excalidraw.ts`, `getCommonBounds` (re-export). `ToolbarDom` stays until Task 13.

- [ ] **Step 1: Write the failing tests.** `canvas-commands.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    commandEvent,
    isApplePlatform,
    nativeControlEnabled,
    pressNativeControl,
    runCanvasCommand,
} from './canvas-commands';

function canvasWith(markup: string): HTMLElement {
    const canvas = document.createElement('div');

    canvas.innerHTML = markup;
    document.body.append(canvas);

    return canvas;
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('canvas commands', () => {
    it('reads the platform as the library does', () => {
        expect(isApplePlatform('MacIntel')).toBe(true);
        expect(isApplePlatform('iPhone')).toBe(true);
        expect(isApplePlatform('Win32')).toBe(false);
        expect(isApplePlatform('Linux x86_64')).toBe(false);
    });

    it('sends group with the command key on a Mac and Ctrl elsewhere', () => {
        expect(commandEvent('group', true)).toMatchObject({ key: 'g', metaKey: true, ctrlKey: false, shiftKey: false });
        expect(commandEvent('group', false)).toMatchObject({ key: 'g', metaKey: false, ctrlKey: true });
    });

    it('sends the library keys of every command', () => {
        expect(commandEvent('ungroup', false)).toMatchObject({ key: 'G', ctrlKey: true, shiftKey: true });
        expect(commandEvent('alignLeft', false)).toMatchObject({ key: 'ArrowLeft', ctrlKey: true, shiftKey: true });
        expect(commandEvent('alignRight', false)).toMatchObject({ key: 'ArrowRight', ctrlKey: true, shiftKey: true });
        expect(commandEvent('alignTop', false)).toMatchObject({ key: 'ArrowUp', ctrlKey: true, shiftKey: true });
        expect(commandEvent('alignBottom', false)).toMatchObject({ key: 'ArrowDown', ctrlKey: true, shiftKey: true });
        expect(commandEvent('distributeHorizontally', false)).toMatchObject({ code: 'KeyH', altKey: true, ctrlKey: false });
        expect(commandEvent('distributeVertically', false)).toMatchObject({ code: 'KeyV', altKey: true, ctrlKey: false });
        expect(commandEvent('delete', false)).toMatchObject({ key: 'Delete', ctrlKey: false, metaKey: false });
        expect(commandEvent('toggleLock', false)).toMatchObject({ key: 'L', ctrlKey: true, shiftKey: true });
    });

    it('dispatches the key on the library container, bubbling and cancelable', () => {
        const canvas = canvasWith('<div class="excalidraw excalidraw-container"></div>');
        const container = canvas.querySelector('.excalidraw-container') as HTMLElement;
        const seen = vi.fn();

        container.addEventListener('keydown', (event) => seen(event.key, event.ctrlKey, event.bubbles, event.cancelable));

        expect(runCanvasCommand(canvas, 'group', 'Win32')).toBe(true);
        expect(seen).toHaveBeenCalledWith('g', true, true, true);
    });

    it('fails soft without the library container', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(runCanvasCommand(canvasWith('<div></div>'), 'delete', 'Win32')).toBe(false);
        expect(runCanvasCommand(null, 'delete', 'Win32')).toBe(false);
        expect(warn).toHaveBeenCalledTimes(1);
    });
});

describe('native controls', () => {
    it('presses the hidden undo button and reads its state', () => {
        const canvas = canvasWith('<button data-testid="button-undo"></button><button data-testid="button-redo" disabled></button>');
        const undo = vi.fn();

        canvas.querySelector('[data-testid="button-undo"]')?.addEventListener('click', undo);

        expect(nativeControlEnabled(canvas, 'undo')).toBe(true);
        expect(nativeControlEnabled(canvas, 'redo')).toBe(false);
        expect(pressNativeControl(canvas, 'undo')).toBe(true);
        expect(undo).toHaveBeenCalledOnce();
        expect(pressNativeControl(canvas, 'redo')).toBe(false);
    });

    it('treats a missing control as disabled', () => {
        expect(nativeControlEnabled(canvasWith(''), 'undo')).toBe(false);
        expect(pressNativeControl(canvasWith(''), 'undo')).toBe(false);
    });
});
```

`excalidraw-contract.test.ts` — the canary: it reads the installed library's files with `node:fs` and fails when a string this plan relies on is gone, so an upgrade cannot silently bring the native chrome back:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../../../node_modules/@excalidraw/excalidraw');
const script = readFileSync(resolve(root, 'dist/dev/index.js'), 'utf8');
const styles = readFileSync(resolve(root, 'dist/dev/index.css'), 'utf8');
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;

describe('Excalidraw contract of the whiteboard chrome', () => {
    it('is the pinned version', () => {
        expect(version).toBe('0.18.1');
    });

    it.each([
        'App-toolbar-container',
        'layer-ui__wrapper__footer-left',
        'layer-ui__wrapper__footer-right',
        'undo-redo-buttons',
        'main-menu-trigger',
        'selected-shape-actions',
        'App-bottom-bar',
        '"data-testid": "button-undo"',
        '"data-testid": "button-redo"',
        'excalidraw excalidraw-container',
    ])('still renders %s', (needle) => {
        expect(script).toContain(needle);
    });

    it('still styles the zoom group the CSS hides', () => {
        expect(styles).toContain('.zoom-actions');
    });
});
```

- [ ] **Step 2: Run them to see them fail.** `npm run test -- canvas-commands excalidraw-contract` — Expected: FAIL (`canvas-commands` and the new exports do not exist; the contract test passes or fails on facts only — if it fails, stop and report).

- [ ] **Step 3: Implement.** `canvas-commands.ts` (the `NativeChrome` block and the native-control functions below go at its top):

```ts

export type CanvasCommand =
    | 'group'
    | 'ungroup'
    | 'alignLeft'
    | 'alignRight'
    | 'alignTop'
    | 'alignBottom'
    | 'distributeHorizontally'
    | 'distributeVertically'
    | 'delete'
    | 'toggleLock';

type CommandKeysOf = {
    key: string;
    code?: string;
    mod?: boolean;
    shift?: boolean;
    alt?: boolean;
};

/**
 * Excalidraw 0.18.1 has no API for these actions; its own shortcuts reach
 * them (the `keyTest` of each action in `dist/dev/index.js`). The key is
 * sent to the library's container, which listens for it while
 * `handleKeyboardGlobally` is off. Check this when the library is upgraded.
 */
export const CommandKeys: Readonly<Record<CanvasCommand, CommandKeysOf>> = {
    group: { key: 'g', mod: true },
    ungroup: { key: 'G', mod: true, shift: true },
    alignLeft: { key: 'ArrowLeft', mod: true, shift: true },
    alignRight: { key: 'ArrowRight', mod: true, shift: true },
    alignTop: { key: 'ArrowUp', mod: true, shift: true },
    alignBottom: { key: 'ArrowDown', mod: true, shift: true },
    distributeHorizontally: { key: 'h', code: 'KeyH', alt: true },
    distributeVertically: { key: 'v', code: 'KeyV', alt: true },
    delete: { key: 'Delete' },
    toggleLock: { key: 'L', mod: true, shift: true },
};

/** The library's own test of the command key (`isDarwin`). */
export function isApplePlatform(platform: string): boolean {
    return /Mac|iPod|iPhone|iPad/.test(platform);
}

export function commandEvent(
    command: CanvasCommand,
    apple: boolean,
): KeyboardEventInit {
    const keys = CommandKeys[command];
    const mod = keys.mod === true;

    return {
        key: keys.key,
        code: keys.code,
        bubbles: true,
        cancelable: true,
        shiftKey: keys.shift === true,
        altKey: keys.alt === true,
        metaKey: apple && mod,
        ctrlKey: !apple && mod,
    };
}

let warned = false;

export function runCanvasCommand(
    canvas: HTMLElement | null,
    command: CanvasCommand,
    platform: string = navigator.platform,
): boolean {
    const container =
        canvas?.querySelector<HTMLElement>(NativeChrome.container) ?? null;

    if (!container) {
        if (!warned) {
            warned = true;
            console.warn(`whiteboard: runCanvasCommand found no ${NativeChrome.container}`);
        }

        return false;
    }

    container.dispatchEvent(
        new KeyboardEvent('keydown', commandEvent(command, isApplePlatform(platform))),
    );

    return true;
}
```

(The once-only warning is module state; only the "fails soft" case triggers it, so its count of one holds.)

In `excalidraw.ts`, add `getCommonBounds` to the re-exports from `@excalidraw/excalidraw`. At the top of `canvas-commands.ts`:

```ts
/**
 * The chrome of Excalidraw 0.18.1 that the board replaces with its own bars
 * (spec §5 rule 3). It is hidden with CSS under `.skrum-whiteboard--own-chrome`
 * (`resources/css/excalidraw-theme.css`), never removed: the hidden undo and
 * redo buttons are pressed by the history bar, and the property panel is
 * shown again by "Styles". Check this when the library is upgraded.
 */
export const NativeChrome = {
    container: '.excalidraw-container',
    toolbar: '.App-toolbar-container',
    zoom: '.layer-ui__wrapper__footer-left .zoom-actions',
    history: '.layer-ui__wrapper__footer-left .undo-redo-buttons',
    help: '.layer-ui__wrapper__footer-right',
    menu: '.main-menu-trigger',
    properties: '.selected-shape-actions',
    mobileBar: '.App-bottom-bar',
} as const;

export type NativeControl = 'undo' | 'redo';

const NativeControlSelector: Record<NativeControl, string> = {
    undo: '[data-testid="button-undo"]',
    redo: '[data-testid="button-redo"]',
};

function nativeControl(canvas: HTMLElement | null, control: NativeControl): HTMLButtonElement | null {
    return canvas?.querySelector<HTMLButtonElement>(NativeControlSelector[control]) ?? null;
}

/** The library's own button knows whether its history is empty; nothing else exposes it. */
export function nativeControlEnabled(canvas: HTMLElement | null, control: NativeControl): boolean {
    const button = nativeControl(canvas, control);

    return button !== null && !button.disabled;
}

export function pressNativeControl(canvas: HTMLElement | null, control: NativeControl): boolean {
    if (!nativeControlEnabled(canvas, control)) {
        return false;
    }

    nativeControl(canvas, control)?.click();

    return true;
}
```

- [ ] **Step 4: Run the tests.** `npm run test -- canvas-commands excalidraw-contract` — Expected: PASS. Then the front gates.
- [ ] **Step 5: Commit** `feat(whiteboard): the library contract of the rebuilt toolbars`.

### Task 2: The tools

**Files:** Create `resources/js/lib/whiteboard/tools.ts`, `tools.test.ts`.

**Interfaces — produces:** `WbTool`, `ShapeKind`, `ConnectorKind`, `ToolChoices`, `ShapeKinds`, `ConnectorKinds`, `DefaultToolChoices`, `StickyToolType`, `StickyKey`, `ToolGroups`, `PhoneBarTools`, `PhoneDrawerTools`, `ToolKeys`, `BoardToolKeys`, `CanvasActiveTool`, `CanvasToolRequest`, `toolOf(active): WbTool | null`, `choicesAfter(active, choices): ToolChoices`, `canvasToolFor(tool, choices): CanvasToolRequest`.

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, expect, it } from 'vitest';
import {
    BoardToolKeys,
    DefaultToolChoices,
    PhoneBarTools,
    PhoneDrawerTools,
    StickyToolType,
    ToolGroups,
    ToolKeys,
    canvasToolFor,
    choicesAfter,
    toolOf,
} from './tools';

describe('tools', () => {
    it('lists the tools of ScreenWhiteboard in its order and groups', () => {
        expect(ToolGroups).toEqual([
            ['select', 'hand'],
            ['sticky', 'shape', 'connector', 'text', 'pen', 'eraser', 'frame'],
            ['image'],
        ]);
        expect(ToolKeys).toEqual({
            select: 'V', hand: 'H', sticky: 'N', shape: 'R', connector: 'C',
            text: 'T', pen: 'P', eraser: 'E', frame: 'F', image: null,
        });
        expect(BoardToolKeys).toEqual(['sticky', 'connector']);
    });

    it('offers no connector and no frame on a phone', () => {
        expect(PhoneBarTools).toEqual(['select', 'sticky', 'pen']);
        expect(PhoneDrawerTools).toEqual(['hand', 'shape', 'text', 'eraser', 'image']);
    });

    it('reads the library tool as one of the board tools', () => {
        expect(toolOf({ type: 'selection' })).toBe('select');
        expect(toolOf({ type: 'diamond' })).toBe('shape');
        expect(toolOf({ type: 'line' })).toBe('connector');
        expect(toolOf({ type: 'freedraw' })).toBe('pen');
        expect(toolOf({ type: 'custom', customType: StickyToolType })).toBe('sticky');
        expect(toolOf({ type: 'custom', customType: 'other' })).toBeNull();
        expect(toolOf({ type: 'laser' })).toBeNull();
    });

    it('asks the library for the remembered shape and connector', () => {
        const choices = { ...DefaultToolChoices, shape: 'ellipse' as const, connector: 'line' as const };

        expect(canvasToolFor('shape', choices)).toEqual({ type: 'ellipse' });
        expect(canvasToolFor('connector', choices)).toEqual({ type: 'line' });
        expect(canvasToolFor('sticky', choices)).toEqual({ type: 'custom', customType: StickyToolType });
        expect(canvasToolFor('select', choices)).toEqual({ type: 'selection' });
        expect(canvasToolFor('pen', choices)).toEqual({ type: 'freedraw' });
        expect(canvasToolFor('image', choices)).toEqual({ type: 'image' });
    });

    it('remembers a shape or a connector chosen with the library keys', () => {
        expect(choicesAfter({ type: 'diamond' }, DefaultToolChoices).shape).toBe('diamond');
        expect(choicesAfter({ type: 'line' }, DefaultToolChoices).connector).toBe('line');
        expect(choicesAfter({ type: 'text' }, DefaultToolChoices)).toBe(DefaultToolChoices);
    });
});
```

- [ ] **Step 2: Run it** (`npm run test -- lib/whiteboard/tools`) — Expected: FAIL (module missing).
- [ ] **Step 3: Implement.**

```ts
import { DEFAULT_POSTIT_COLOR, type PostItColor } from './palette';

export type WbTool =
    | 'select' | 'hand' | 'sticky' | 'shape' | 'connector'
    | 'text' | 'pen' | 'eraser' | 'frame' | 'image';
export type ShapeKind = 'rectangle' | 'diamond' | 'ellipse';
export type ConnectorKind = 'arrow' | 'line';
export type ToolChoices = { shape: ShapeKind; connector: ConnectorKind; sticky: PostItColor };

export const ShapeKinds: readonly ShapeKind[] = ['rectangle', 'diamond', 'ellipse'];
export const ConnectorKinds: readonly ConnectorKind[] = ['arrow', 'line'];
export const DefaultToolChoices: ToolChoices = {
    shape: 'rectangle',
    connector: 'arrow',
    sticky: DEFAULT_POSTIT_COLOR,
};

/** The library's custom tool (`setActiveTool({type: 'custom'})`) that places a sticky note. */
export const StickyToolType = 'skrum-sticky';

/** Owner decision 1 (spec §15): N; the library's S opens its stroke picker. */
export const StickyKey = 'N';

/** ScreenWhiteboard's vertical bar, separators between the groups. */
export const ToolGroups: readonly (readonly WbTool[])[] = [
    ['select', 'hand'],
    ['sticky', 'shape', 'connector', 'text', 'pen', 'eraser', 'frame'],
    ['image'],
];

/** MobileRituals: the bottom bar; the drawer of "…" holds the rest, without connector or frame under `md`. */
export const PhoneBarTools: readonly WbTool[] = ['select', 'sticky', 'pen'];
export const PhoneDrawerTools: readonly WbTool[] = ['hand', 'shape', 'text', 'eraser', 'image'];

export const ToolKeys: Readonly<Record<WbTool, string | null>> = {
    select: 'V', hand: 'H', sticky: StickyKey, shape: 'R', connector: 'C',
    text: 'T', pen: 'P', eraser: 'E', frame: 'F', image: null,
};

/** The keys of `ToolKeys` the library does not answer to: the board answers them (Task 8). */
export const BoardToolKeys: readonly WbTool[] = ['sticky', 'connector'];

export type CanvasActiveTool = { type: string; customType?: string | null };
export type CanvasToolRequest =
    | { type: 'custom'; customType: string }
    | { type: 'selection' | 'hand' | ShapeKind | ConnectorKind | 'text' | 'freedraw' | 'eraser' | 'frame' | 'image' };

const ToolOfType: Readonly<Record<string, WbTool>> = {
    selection: 'select', hand: 'hand',
    rectangle: 'shape', diamond: 'shape', ellipse: 'shape',
    arrow: 'connector', line: 'connector',
    text: 'text', freedraw: 'pen', eraser: 'eraser', frame: 'frame', image: 'image',
};

export function toolOf(active: CanvasActiveTool): WbTool | null {
    if (active.type === 'custom') {
        return active.customType === StickyToolType ? 'sticky' : null;
    }

    return ToolOfType[active.type] ?? null;
}

export function choicesAfter(active: CanvasActiveTool, choices: ToolChoices): ToolChoices {
    const shape = ShapeKinds.find((kind) => kind === active.type);

    if (shape && shape !== choices.shape) {
        return { ...choices, shape };
    }

    const connector = ConnectorKinds.find((kind) => kind === active.type);

    if (connector && connector !== choices.connector) {
        return { ...choices, connector };
    }

    return choices;
}

export function canvasToolFor(tool: WbTool, choices: ToolChoices): CanvasToolRequest {
    switch (tool) {
        case 'select':
            return { type: 'selection' };
        case 'sticky':
            return { type: 'custom', customType: StickyToolType };
        case 'shape':
            return { type: choices.shape };
        case 'connector':
            return { type: choices.connector };
        case 'pen':
            return { type: 'freedraw' };
        default:
            return { type: tool };
    }
}
```

- [ ] **Step 4: Run it** — Expected: PASS; front gates.
- [ ] **Step 5: Commit** `feat(whiteboard): the tools of the rebuilt tool bar`.

### Task 3: The view — zoom, centre, pan

**Files:** Create `resources/js/lib/whiteboard/viewport.ts`, `viewport.test.ts`.

**Interfaces — produces:** `CanvasView`, `ViewPatch`, `Point`, `Rect`, `MinZoom`, `MaxZoom`, `clampZoom`, `steppedZoom(zoom, direction)`, `canZoom(zoom, direction)`, `zoomAroundCentre(view, zoom): ViewPatch`, `visibleArea(view): Rect`, `centredOn(view, point): ViewPatch`, `pannedBy(view, fractionX, fractionY): ViewPatch`, `zoomPercent(zoom): number`. The library's view: a scene point `p` is drawn at `(p.x + scrollX) × zoom` (the same convention as `useWhiteboardFollow`, which sends `x: -scrollX`).

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, expect, it } from 'vitest';
import {
    MaxZoom, MinZoom, canZoom, centredOn, pannedBy,
    steppedZoom, visibleArea, zoomAroundCentre, zoomPercent,
} from './viewport';

const view = { scrollX: 0, scrollY: 0, zoom: 1, width: 1000, height: 800 };

describe('viewport', () => {
    it('steps by ten percent from wherever the zoom is', () => {
        expect(steppedZoom(1, 1)).toBe(1.1);
        expect(steppedZoom(1, -1)).toBe(0.9);
        expect(steppedZoom(0.85, 1)).toBe(0.9);
        expect(steppedZoom(0.85, -1)).toBe(0.8);
        expect(steppedZoom(0.3, 1)).toBe(0.4);
    });

    it('stops at the ends of the library range', () => {
        expect(steppedZoom(MinZoom, -1)).toBe(MinZoom);
        expect(steppedZoom(MaxZoom, 1)).toBe(MaxZoom);
        expect(canZoom(MinZoom, -1)).toBe(false);
        expect(canZoom(MaxZoom, 1)).toBe(false);
        expect(canZoom(1, 1)).toBe(true);
    });

    it('keeps the centre of the view where it was', () => {
        const patch = zoomAroundCentre(view, 2);

        expect(patch).toEqual({ zoom: 2, scrollX: -250, scrollY: -200 });
        expect(visibleArea({ ...view, ...patch })).toEqual({ x: 250, y: 200, width: 500, height: 400 });
    });

    it('centres the view on a scene point at the same zoom', () => {
        expect(centredOn({ ...view, zoom: 2 }, { x: 100, y: 50 })).toEqual({ zoom: 2, scrollX: 150, scrollY: 150 });
    });

    it('pans by a share of the visible area', () => {
        expect(pannedBy(view, 0.1, 0)).toEqual({ zoom: 1, scrollX: -100, scrollY: 0 });
        expect(pannedBy({ ...view, zoom: 2 }, 0, -0.1)).toEqual({ zoom: 2, scrollX: 0, scrollY: 40 });
    });

    it('shows the zoom as a rounded percentage', () => {
        expect(zoomPercent(0.8)).toBe(80);
        expect(zoomPercent(1.234)).toBe(123);
    });
});
```

- [ ] **Step 2: Run it** — Expected: FAIL.
- [ ] **Step 3: Implement.**

```ts
export type CanvasView = { scrollX: number; scrollY: number; zoom: number; width: number; height: number };
export type ViewPatch = { scrollX: number; scrollY: number; zoom: number };
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

/** The library's range (`MIN_ZOOM`, `MAX_ZOOM` of 0.18.1); a wheel zoom reaches it, so the bar does too (P20-09). */
export const MinZoom = 0.1;
export const MaxZoom = 30;
const StepsPerUnit = 10;
const Epsilon = 1e-9;

export function clampZoom(zoom: number): number {
    return Math.min(MaxZoom, Math.max(MinZoom, zoom));
}

export function steppedZoom(zoom: number, direction: 1 | -1): number {
    const steps = zoom * StepsPerUnit;
    const next = direction === 1 ? Math.floor(steps + Epsilon) + 1 : Math.ceil(steps - Epsilon) - 1;

    return clampZoom(next / StepsPerUnit);
}

export function canZoom(zoom: number, direction: 1 | -1): boolean {
    return direction === 1 ? zoom < MaxZoom - Epsilon : zoom > MinZoom + Epsilon;
}

export function visibleArea(view: CanvasView): Rect {
    return { x: -view.scrollX, y: -view.scrollY, width: view.width / view.zoom, height: view.height / view.zoom };
}

export function centredOn(view: CanvasView, point: Point): ViewPatch {
    return {
        zoom: view.zoom,
        scrollX: view.width / 2 / view.zoom - point.x,
        scrollY: view.height / 2 / view.zoom - point.y,
    };
}

export function zoomAroundCentre(view: CanvasView, zoom: number): ViewPatch {
    const area = visibleArea(view);
    const centre = { x: area.x + area.width / 2, y: area.y + area.height / 2 };

    return centredOn({ ...view, zoom: clampZoom(zoom) }, centre);
}

export function pannedBy(view: CanvasView, fractionX: number, fractionY: number): ViewPatch {
    const area = visibleArea(view);

    return {
        zoom: view.zoom,
        scrollX: view.scrollX - fractionX * area.width,
        scrollY: view.scrollY - fractionY * area.height,
    };
}

export function zoomPercent(zoom: number): number {
    return Math.round(zoom * 100);
}
```

- [ ] **Step 4: Run it** — Expected: PASS; front gates.
- [ ] **Step 5: Commit** `feat(whiteboard): view arithmetic for the zoom bar and the minimap`.

### Task 4: The minimap model

**Files:** Create `resources/js/lib/whiteboard/minimap.ts`, `minimap.test.ts`.

**Interfaces — consumes:** `postItFromBackground`, `PostItColor` (`palette.ts`); `Point`, `Rect` (Task 3). **Produces:** `MinimapElement`, `MinimapItem`, `MinimapFrame`, `minimapItems(elements)`, `minimapFrame(items, visible, size, padding?)`, `toMinimap(rect, frame): Rect`, `fromMinimap(point, frame): Point`.

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, expect, it } from 'vitest';
import { POSTIT } from './palette';
import { fromMinimap, minimapFrame, minimapItems, toMinimap } from './minimap';

const base = { isDeleted: false, containerId: null, backgroundColor: 'transparent' };

describe('minimap', () => {
    it('keeps live elements, drops tombstones and bound texts, and colours the eight fills', () => {
        const items = minimapItems([
            { ...base, id: 'note', type: 'rectangle', x: 0, y: 0, width: 100, height: 50, backgroundColor: POSTIT.sky.bg },
            { ...base, id: 'label', type: 'text', x: 10, y: 10, width: 40, height: 20, containerId: 'note' },
            { ...base, id: 'gone', type: 'ellipse', x: 0, y: 0, width: 10, height: 10, isDeleted: true },
            { ...base, id: 'title', type: 'text', x: 300, y: 0, width: 80, height: 30 },
        ]);

        expect(items).toEqual([
            { id: 'note', rect: { x: 0, y: 0, width: 100, height: 50 }, color: 'sky' },
            { id: 'title', rect: { x: 300, y: 0, width: 80, height: 30 }, color: null },
        ]);
    });

    it('measures a line from its points', () => {
        const [line] = minimapItems([
            { ...base, id: 'arrow', type: 'arrow', x: 100, y: 100, width: 50, height: 30, points: [[0, 0], [-50, 30]] },
        ]);

        expect(line.rect).toEqual({ x: 50, y: 100, width: 50, height: 30 });
    });

    it('fits the board and the visible area in the minimap, centred', () => {
        const items = [{ id: 'a', rect: { x: 0, y: 0, width: 100, height: 50 }, color: null }];
        const frame = minimapFrame(items, { x: 0, y: 0, width: 200, height: 100 }, { width: 180, height: 112 });

        expect(frame.scale).toBeCloseTo(0.82);
        expect(toMinimap(items[0].rect, frame)).toEqual({ x: 8, y: 15, width: 82, height: 41 });
        expect(fromMinimap({ x: 90, y: 56 }, frame).x).toBeCloseTo(100);
        expect(fromMinimap({ x: 90, y: 56 }, frame).y).toBeCloseTo(50);
    });

    it('draws only the visible area on an empty board', () => {
        const frame = minimapFrame([], { x: -500, y: -400, width: 1000, height: 800 }, { width: 180, height: 112 });

        expect(toMinimap({ x: -500, y: -400, width: 1000, height: 800 }, frame).width).toBeCloseTo(120);
    });
});
```

- [ ] **Step 2: Run it** — Expected: FAIL.
- [ ] **Step 3: Implement.**

```ts
import { postItFromBackground, type PostItColor } from './palette';
import type { Point, Rect } from './viewport';

export type MinimapElement = {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isDeleted?: boolean;
    containerId?: string | null;
    backgroundColor?: string;
    points?: readonly (readonly [number, number])[];
};
export type MinimapItem = { id: string; rect: Rect; color: PostItColor | null };
export type MinimapFrame = { origin: Point; scale: number; offset: Point };
type Size = { width: number; height: number };

const MinSide = 1;

function rectOf(element: MinimapElement): Rect {
    if (element.points && element.points.length > 0) {
        const xs = element.points.map(([x]) => element.x + x);
        const ys = element.points.map(([, y]) => element.y + y);
        const x = Math.min(...xs);
        const y = Math.min(...ys);

        return { x, y, width: Math.max(Math.max(...xs) - x, MinSide), height: Math.max(Math.max(...ys) - y, MinSide) };
    }

    return {
        x: Math.min(element.x, element.x + element.width),
        y: Math.min(element.y, element.y + element.height),
        width: Math.max(Math.abs(element.width), MinSide),
        height: Math.max(Math.abs(element.height), MinSide),
    };
}

export function minimapItems(elements: readonly MinimapElement[]): MinimapItem[] {
    return elements
        .filter((element) => element.isDeleted !== true && !(element.type === 'text' && element.containerId))
        .map((element) => ({
            id: element.id,
            rect: rectOf(element),
            color: element.backgroundColor ? postItFromBackground(element.backgroundColor) : null,
        }));
}

function union(rects: readonly Rect[]): Rect {
    const left = Math.min(...rects.map((rect) => rect.x));
    const top = Math.min(...rects.map((rect) => rect.y));
    const right = Math.max(...rects.map((rect) => rect.x + rect.width));
    const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));

    return { x: left, y: top, width: right - left, height: bottom - top };
}

export function minimapFrame(items: readonly MinimapItem[], visible: Rect, size: Size, padding = 8): MinimapFrame {
    const world = union([visible, ...items.map((item) => item.rect)]);
    const inner = { width: size.width - padding * 2, height: size.height - padding * 2 };
    const scale = Math.min(inner.width / world.width, inner.height / world.height);

    return {
        origin: { x: world.x, y: world.y },
        scale,
        offset: {
            x: padding + (inner.width - world.width * scale) / 2,
            y: padding + (inner.height - world.height * scale) / 2,
        },
    };
}

export function toMinimap(rect: Rect, frame: MinimapFrame): Rect {
    return {
        x: (rect.x - frame.origin.x) * frame.scale + frame.offset.x,
        y: (rect.y - frame.origin.y) * frame.scale + frame.offset.y,
        width: rect.width * frame.scale,
        height: rect.height * frame.scale,
    };
}

export function fromMinimap(point: Point, frame: MinimapFrame): Point {
    return {
        x: (point.x - frame.offset.x) / frame.scale + frame.origin.x,
        y: (point.y - frame.offset.y) / frame.scale + frame.origin.y,
    };
}
```

- [ ] **Step 4: Run it** — Expected: PASS (if the floating results of the third case differ in the last digits, the test uses `toBeCloseTo` on each number rather than changing the code); front gates.
- [ ] **Step 5: Commit** `feat(whiteboard): minimap model`.

### Task 5: The selection model and the bar's place

**Files:** Create `resources/js/lib/whiteboard/selection.ts`, `selection.test.ts`.

**Interfaces — consumes:** `CanvasView`, `Rect` (Task 3). **Produces:** `SelectableElement`, `SelectionState`, `SelectionSummary`, `selectionSummary(elements, state): SelectionSummary | null`, `selectionBarShown(state): boolean`, `selectionBarPlacement(bounds, view, bar): Placement`, `selectionCountPlacement(bounds, view): Point`, `BarGap`, `ChipHeight`, `EdgeMargin`. The colours of the bar stay `colorBarState` of `lib/whiteboard/canvas-colors.ts` (unchanged, tested).

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, expect, it } from 'vitest';
import { selectionBarPlacement, selectionBarShown, selectionCountPlacement, selectionSummary } from './selection';

const element = (id: string, extra: Record<string, unknown> = {}) => ({
    id, type: 'rectangle', isDeleted: false, locked: false, groupIds: [] as string[],
    containerId: null, backgroundColor: '#fdf1c2', ...extra,
});
const view = { scrollX: 0, scrollY: 0, zoom: 1, width: 1440, height: 844 };

describe('selection', () => {
    it('is nothing when nothing live is selected', () => {
        expect(selectionSummary([element('a')], { selectedElementIds: {} })).toBeNull();
        expect(selectionSummary([element('a', { isDeleted: true })], { selectedElementIds: { a: true } })).toBeNull();
    });

    it('counts the selected elements, not their bound texts', () => {
        const summary = selectionSummary(
            [element('a'), element('b'), element('t', { type: 'text', containerId: 'a' })],
            { selectedElementIds: { a: true, b: true, t: true } },
        );

        expect(summary).toMatchObject({ ids: ['a', 'b'], count: 2, units: 2, hasFill: true, canGroup: true, canUngroup: false });
    });

    it('sees a group as one unit that can be ungrouped', () => {
        const summary = selectionSummary(
            [element('a', { groupIds: ['g'] }), element('b', { groupIds: ['g'] })],
            { selectedElementIds: { a: true, b: true } },
        );

        expect(summary).toMatchObject({ count: 2, units: 1, canGroup: false, canUngroup: true });
    });

    it('knows a selection without fill and a locked one', () => {
        const summary = selectionSummary(
            [element('l', { type: 'line', locked: true })],
            { selectedElementIds: { l: true } },
        );

        expect(summary).toMatchObject({ hasFill: false, hasLocked: true, allLocked: true });
    });

    it('hides the bar while editing text, dragging, resizing, rotating, drawing or in a dialog', () => {
        const ids = { selectedElementIds: { a: true } };

        expect(selectionBarShown(ids)).toBe(true);
        expect(selectionBarShown({ ...ids, editingTextElement: {} })).toBe(false);
        expect(selectionBarShown({ ...ids, selectedElementsAreBeingDragged: true })).toBe(false);
        expect(selectionBarShown({ ...ids, isResizing: true })).toBe(false);
        expect(selectionBarShown({ ...ids, isRotating: true })).toBe(false);
        expect(selectionBarShown({ ...ids, newElement: {} })).toBe(false);
        expect(selectionBarShown({ ...ids, openDialog: { name: 'help' } })).toBe(false);
    });

    it('puts the bar under the selection, centred, inside the canvas', () => {
        expect(selectionBarPlacement({ x: 100, y: 546, width: 580, height: 140 }, view, { width: 400, height: 44 }))
            .toEqual({ left: 190, top: 698, side: 'below' });
        expect(selectionBarPlacement({ x: 0, y: 100, width: 100, height: 100 }, view, { width: 400, height: 44 }).left).toBe(16);
    });

    it('puts the bar above the selection and its count when there is no room below', () => {
        expect(selectionBarPlacement({ x: 100, y: 700, width: 200, height: 100 }, view, { width: 200, height: 44 }))
            .toEqual({ left: 100, top: 700 - 26 - 12 - 44, side: 'above' });
    });

    it('follows the scroll and the zoom of the view', () => {
        expect(selectionCountPlacement({ x: 100, y: 200, width: 10, height: 10 }, { ...view, scrollX: -50, scrollY: 10, zoom: 2 }))
            .toEqual({ x: 100, y: 420 - 26 });
    });
});
```

- [ ] **Step 2: Run it** — Expected: FAIL.
- [ ] **Step 3: Implement.**

```ts
import type { CanvasView, Point, Rect } from './viewport';

export type SelectableElement = {
    id: string;
    type: string;
    isDeleted?: boolean;
    locked?: boolean;
    groupIds: readonly string[];
    containerId?: string | null;
    backgroundColor: string;
};

export type SelectionState = {
    selectedElementIds: Readonly<Record<string, boolean>>;
    editingTextElement?: unknown;
    selectedElementsAreBeingDragged?: boolean;
    isResizing?: boolean;
    isRotating?: boolean;
    newElement?: unknown;
    openDialog?: unknown;
};

export type SelectionSummary = {
    ids: string[];
    count: number;
    /** Groups count once: what align and distribute move. */
    units: number;
    hasFill: boolean;
    canGroup: boolean;
    canUngroup: boolean;
    hasLocked: boolean;
    allLocked: boolean;
};

export type Placement = { left: number; top: number; side: 'below' | 'above' };

/** Pixels on screen: 0.75rem, the count chip's 1.625rem, 1rem. */
export const BarGap = 12;
export const ChipHeight = 26;
export const EdgeMargin = 16;

const Filled: readonly string[] = ['rectangle', 'diamond', 'ellipse'];

export function selectionSummary(elements: readonly SelectableElement[], state: SelectionState): SelectionSummary | null {
    const counted = elements.filter(
        (element) =>
            state.selectedElementIds[element.id] === true &&
            element.isDeleted !== true &&
            !(element.type === 'text' && element.containerId),
    );

    if (counted.length === 0) {
        return null;
    }

    const units = new Set(counted.map((element) => element.groupIds.at(-1) ?? `element:${element.id}`)).size;

    return {
        ids: counted.map((element) => element.id),
        count: counted.length,
        units,
        hasFill: counted.some((element) => Filled.includes(element.type)),
        canGroup: units >= 2,
        canUngroup: counted.some((element) => element.groupIds.length > 0),
        hasLocked: counted.some((element) => element.locked === true),
        allLocked: counted.every((element) => element.locked === true),
    };
}

export function selectionBarShown(state: SelectionState): boolean {
    return !(
        state.editingTextElement ||
        state.selectedElementsAreBeingDragged ||
        state.isResizing ||
        state.isRotating ||
        state.newElement ||
        state.openDialog
    );
}

function toScreen(point: Point, view: CanvasView): Point {
    return { x: (point.x + view.scrollX) * view.zoom, y: (point.y + view.scrollY) * view.zoom };
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), Math.max(min, max));
}

export function selectionBarPlacement(bounds: Rect, view: CanvasView, bar: { width: number; height: number }): Placement {
    const topLeft = toScreen({ x: bounds.x, y: bounds.y }, view);
    const bottomRight = toScreen({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }, view);
    const centre = (topLeft.x + bottomRight.x) / 2;
    const left = clamp(centre - bar.width / 2, EdgeMargin, view.width - EdgeMargin - bar.width);
    const below = bottomRight.y + BarGap;

    if (below + bar.height <= view.height - EdgeMargin) {
        return { left, top: below, side: 'below' };
    }

    return { left, top: Math.max(EdgeMargin, topLeft.y - ChipHeight - BarGap - bar.height), side: 'above' };
}

export function selectionCountPlacement(bounds: Rect, view: CanvasView): Point {
    const topLeft = toScreen({ x: bounds.x, y: bounds.y }, view);

    return { x: topLeft.x, y: topLeft.y - ChipHeight };
}
```

Check the first placement case by hand before running: centre = (100 + 680) / 2 = 390, left = 390 − 200 = 190; below = 686 + 12 = 698, 698 + 44 = 742 ≤ 844 − 16. Second: centre 50 − 200 < 16 → 16. Third: below = 800 + 12 = 812, 856 > 828 → above = 700 − 26 − 12 − 44 = 618; left = 200 − 100 = 100. Fourth: x = (100 − 50) × 2 = 100, y = (200 + 10) × 2 − 26 = 394.

- [ ] **Step 4: Run it** — Expected: PASS; front gates.
- [ ] **Step 5: Commit** `feat(whiteboard): selection model and the place of its bar`.

### Task 6: One snapshot of the canvas per frame

**Files:** Create `resources/js/hooks/use-canvas-snapshot.ts`, `use-canvas-snapshot.test.ts`.

**Interfaces — consumes:** `ExcalidrawImperativeAPI` (`api.onChange(callback): () => void`, `api.getSceneElementsIncludingDeleted()`, `api.getAppState()`), `CanvasView` (Task 3). **Produces:**

```ts
export type CanvasSnapshot = {
    elements: readonly SceneElement[];
    appState: CanvasAppState;
    view: CanvasView;
    /** `sceneStamp(elements)`: changes when a live element changes; the minimap keys its work on it. */
    stamp: string;
};

/** The library's `onChange` as one state per animation frame; null until the canvas is ready. */
export function useCanvasSnapshot(api: ExcalidrawImperativeAPI | null): CanvasSnapshot | null;
```

`CanvasAppState` is the subset the bars read: `activeTool`, `selectedElementIds`, `editingTextElement`, `selectedElementsAreBeingDragged`, `isResizing`, `isRotating`, `newElement`, `openDialog`, `viewModeEnabled`, `penMode`, `penDetected`, `currentItemBackgroundColor`, `currentItemStrokeColor`, and `scrollX`, `scrollY`, `zoom: {value}`, `width`, `height` (folded into `view`).

- [ ] **Step 1: Write the failing test** with a fake API whose `onChange` stores the callback, and fake timers with `requestAnimationFrame` stubbed by `vi.stubGlobal('requestAnimationFrame', (run) => setTimeout(run, 16))`:
  - null while `api` is null;
  - the first snapshot is read from `getAppState()` and `getSceneElementsIncludingDeleted()` as soon as `api` is set (`view` = `{scrollX, scrollY, zoom: zoom.value, width, height}`);
  - three `onChange` calls inside one frame give one new state, the last one's;
  - `stamp` follows `sceneStamp`;
  - unmount unsubscribes (the fake's returned function was called) and cancels a pending frame.
- [ ] **Step 2: Run it** (`npm run test -- use-canvas-snapshot`) — Expected: FAIL.
- [ ] **Step 3: Implement** with `useSyncExternalStore`-free React state: an effect on `api` that sets the first snapshot, subscribes `api.onChange((elements, appState) => { latest = …; if (frame === null) frame = requestAnimationFrame(flush) })`, and returns `() => { unsubscribe(); if (frame !== null) cancelAnimationFrame(frame) }`. `flush` sets the state from `latest`. No other logic.
- [ ] **Step 4: Run it** — Expected: PASS; front gates.
- [ ] **Step 5: Commit** `feat(whiteboard): one canvas snapshot per frame for the bars`.

---

## Step B — lanes (worktrees, after Task 6)

### Task 7 (lane Tools): `WhiteboardToolbar` — the tool bar and its sub-bar

**Mockup:** WhiteboardToolbar (anatomy, states, keyboard; `preview.html` "variante verticale" and the sub-bar), ScreenWhiteboard (`sk-wbbar--v` at left 1rem, the order and separators, `sk-tool-k`). Spec §9.1, §11.

**Files:** Modify `resources/js/components/skrum/whiteboard-toolbar.tsx` (add; `WhiteboardColorBar` and `useColorNames` unchanged), `whiteboard-toolbar.test.tsx` (add cases).

**Interfaces — produces:**

```ts
export type ToolbarItem = {
    id: string;
    label: string;          // "Sticky note"
    icon: LucideIcon;
    shortcut?: string;      // "N": shown in the corner (aria-hidden), in the tooltip with <Kbd>, and as aria-keyshortcuts
    pressed?: boolean;      // aria-pressed; undefined for a plain button (Undo, "…")
    disabled?: boolean;
    onPress: () => void;
};

export type WhiteboardToolbarProps = {
    label: string;                          // accessible name of the role="toolbar"
    groups: readonly (readonly ToolbarItem[])[]; // a separator between groups (sk-sep vertical, sk-vsep horizontal)
    orientation?: 'vertical' | 'horizontal';
    size?: 'default' | 'touch';             // 2.25rem tools; 2.75rem on a phone (MobileRituals)
    trailing?: ReactNode;                   // "More tools" trigger, or the phone's "Modifier" — inside the toolbar, in the roving order
    className?: string;
};

export function WhiteboardToolbar(props: WhiteboardToolbarProps): ReactElement;

/** The sub-bar of a tool, beside it: a labelled toolbar holding radios (shapes, connectors) and/or a WhiteboardColorBar. */
export function WhiteboardSubBar(props: { label: string; children: ReactNode; className?: string }): ReactElement;
```

**Composition:** `div[role=toolbar][aria-orientation]` with the classes of `sk-wbbar` / `sk-wbbar--v` written in Tailwind on tokens (`rounded-xl border border-border bg-popover p-1 shadow-raised`, `flex-col` when vertical, `gap-0.5`); a tool is a `button` `size-9` (`size-11` for touch) `rounded-md` with the lucide icon `size-4.5` (add `--spacing` value to `@theme` if 1.125rem is not in the scale — rule 3), the letter in a `span[aria-hidden]` at the bottom right (`text-3xs font-mono text-muted-foreground`; add `--text-3xs: 0.5625rem` to `@theme` if absent), the pressed state `bg-skrum-primary-soft text-skrum-primary-text ring-1 ring-inset ring-primary`, hover `bg-accent`, disabled `opacity-50`. Each tool is wrapped in `Tooltip` (`components/ui/tooltip.tsx`) whose content is the label then `<Kbd>{shortcut}</Kbd>`; the tooltip side is `right` for the vertical bar, `top` for horizontal. Separators: `components/ui/separator.tsx`.

**Behaviours (each a Vitest case, written first):**
1. renders one `toolbar` with the given name and orientation, the items in order and one separator between groups;
2. a pressed item has `aria-pressed="true"`, the others `"false"`; an item without `pressed` has no `aria-pressed`;
3. `aria-keyshortcuts="N"` on an item with a shortcut, the letter in the corner hidden from assistive technology;
4. roving focus: only the first enabled item (or the pressed one) has `tabIndex=0`; ↓/↑ (vertical) or →/← (horizontal) move focus, wrapping; Home/End; disabled items are skipped; `trailing` content takes part (it receives `data-roving-item` and the hook reads `[data-roving-item]` inside the toolbar);
5. Enter and Space press an item (`onPress`), a click too; a disabled item does nothing;
6. hovering or focusing a tool shows its tooltip with the label and the key;
7. `WhiteboardSubBar` renders a `toolbar` with its name around its children;
8. the presentational rule: the file imports nothing from `@/lib/whiteboard/excalidraw`, `@inertiajs/react` (except none) or `laravel-echo` (a test reads the source with `node:fs` and asserts it, as the other `skrum/` tests do where they exist — otherwise the reviewer checks it).

- [ ] Step 1: write the cases above in `whiteboard-toolbar.test.tsx` (render with `renderWithProviders`, `fireEvent.keyDown`); run `npm run test -- skrum/whiteboard-toolbar` — FAIL.
- [ ] Step 2: implement; run — PASS; front gates.
- [ ] Step 3: commit `feat(skrum): WhiteboardToolbar, the tool bar and its sub-bar` (a shared `skrum/` component: its own commit).

### Task 8 (lane Tools): `CanvasTools` — tools, sub-bars, sticky placement, "More tools", N and C

**Read first:** `components/whiteboard/sticky-tool.tsx` (whole), `sticky-tool.test.tsx`, `canvas-colors.tsx` and its test (the behaviours that move here), `lib/whiteboard/canvas-colors.ts` (`colorBarState`, `strokeForTool`), `board.tsx:300-341` (how the stroke follows the tool today: that stays in `board.tsx`), `hooks/use-shortcut.ts` (options `scope`, `enableOnFormTags`, `enableInOverlays`; it already obeys `singleKeyShortcutsEnabled()` for character keys), spec §9.1 "Sticky note tool".

**Files:**
- Create: `resources/js/components/whiteboard/canvas-tools.tsx`, `canvas-tools.test.tsx`
- Modify: `resources/js/components/whiteboard/sticky-tool.tsx` (add `addSticky`; `StickyTool` stays until Task 13), `sticky-tool.test.tsx` (add the cases of `addSticky`)

**Interfaces:**
- Consumes: Tasks 2 (`ToolGroups`, `ToolKeys`, `BoardToolKeys`, `canvasToolFor`, `toolOf`, `choicesAfter`, `DefaultToolChoices`, `ShapeKinds`, `ConnectorKinds`, `StickyToolType`), 6 (`CanvasSnapshot`), 7 (`WhiteboardToolbar`, `WhiteboardSubBar`); `WhiteboardColorBar`; `colorBarState`, `postItAppState`; `useShortcut`.
- Produces:

```ts
/** Adds a sticky of `color` with its top-left corner at `at` (scene), or centred in the view when `at` is omitted; selects it. */
export function addSticky(api: ExcalidrawImperativeAPI, color: PostItColor, at?: Point): string; // returns the new id

export function CanvasTools(props: {
    api: ExcalidrawImperativeAPI;
    snapshot: CanvasSnapshot;
    /** The board's canvas wrapper: scope of the N and C keys. */
    canvas: RefObject<HTMLElement | null>;
    /** Owner decision 4: laser, keep the tool, pen mode. */
    moreTools?: boolean;          // true
}): ReactElement | null;          // null in view mode
```

**Composition:** an absolutely positioned column at `left-4`, its top at `10.625rem` (`top-42.5`, or an `@theme` value), `z-10`, `pointer-events-none` with `pointer-events-auto` on the bars: `WhiteboardToolbar` (label `t('Tools')`, vertical, items from `ToolGroups` with the icons `MousePointer2`, `Hand`, `StickyNote`, `Shapes`, `Spline`, `Type`, `Pencil`, `Eraser`, `Frame`, `Image` and the labels `Selection`, `Hand`, `Sticky note`, `Shape`, `Connector`, `Text`, `Pencil`, `Eraser`, `Frame`, `Image`; `trailing` = "More tools" (`Ellipsis`) opening a `DropdownMenu` with `menuitemcheckbox` "Laser pointer" (K), "Keep the tool" (Q: `setActiveTool({...current, locked: !locked})`), and "Pen mode" only when `appState.penDetected` (`updateScene({appState: {penMode: !penMode}})`)); beside the active tool, the sub-bar: sticky → `WhiteboardSubBar` "Sticky note colours" with `WhiteboardColorBar` (`value` = the sticky colour choice, `onChange` keeps it, `onActivate` = `addSticky(api, color)` — the keyboard path); shape → "Shapes" with three radios (`Square`, `Diamond`, `Circle`: Rectangle, Diamond, Ellipse) and `WhiteboardColorBar` bound like `CanvasColors` was for a tool (`colorBarState(...).value`, `onChange` = `updateScene({appState: postItAppState(color)})`); connector → "Connectors" with Arrow (`MoveUpRight`) and Line (`Minus`). The sub-bar's top is aligned on its tool's row (measured with `offsetTop` of the tool button).

**Behaviours (Vitest, written first; a fake API with `setActiveTool`, `updateScene`, `getAppState`, `getSceneElementsIncludingDeleted`, `onPointerDown` storing its callback):**
1. pressing each tool calls `setActiveTool` with `canvasToolFor` of it; the tool of `snapshot.appState.activeTool` is the pressed one (a library-chosen `diamond` shows Shape pressed and Diamond checked in the sub-bar);
2. the shape and connector choices follow the library (`choicesAfter`) and are kept for the page;
3. sticky placement: with `activeTool = {type: 'custom', customType: StickyToolType}`, the stored `onPointerDown` callback called with `pointerDownState.origin = {x: 120, y: 80}` makes `updateScene` receive a new rectangle with `customData.skrum.kind = 'sticky'`, the chosen colour's fill and stroke (`POSTIT`), `x: 120, y: 80`, selected, and then `setActiveTool({type: 'selection'})`; with `activeTool.locked` it stays on the sticky tool;
4. a press on a colour of the sticky sub-bar adds a sticky in the middle of the view (moved from `sticky-tool.test.tsx` "adds a selected note … in the middle of the view"); the arrow keys move the choice without adding (moved from "moves the choice with the arrow keys …");
5. the shape sub-bar's colours make the colour the fill of the next shapes (moved from `canvas-colors.test.tsx` "makes the colour the fill of the next shapes when nothing is selected") and show the current one checked (moved from "shows the eight colours with the current one checked");
6. N arms the sticky tool and C the connector while the focus is in the canvas wrapper or a bar; neither acts while a `textarea.excalidraw-wysiwyg`, an `input` or a dialog has the focus (Review Focus 1), nor when `singleKeyShortcutsEnabled()` is false;
7. view mode (`snapshot.appState.viewModeEnabled` or the prop the board passes) renders nothing, and a pending `onPointerDown` callback does nothing (Review Focus 2: the board locked while the sticky tool was armed);
8. "More tools": Laser pointer sets `{type: 'laser'}` and is checked while active; Keep the tool toggles `locked`; Pen mode is absent unless `penDetected`;
9. `addSticky` (in `sticky-tool.test.tsx`): the element keeps the shape of `stickyAt` (the existing case "adds a selected note with the fill and the border of the pressed colour" is kept, re-pointed at `addSticky`), at the given point or centred.

- [ ] Step 1: write the cases; `npm run test -- canvas-tools sticky-tool` — FAIL.
- [ ] Step 2: implement `addSticky` (extract the body of `StickyTool.add` into it; `StickyTool` calls it) and `CanvasTools`. The sticky placement subscribes `api.onPointerDown((activeTool, state) => …)` in an effect and ignores every tool but the sticky one.
- [ ] Step 3: new keys (`Tools`, `Sticky note colours`, `Shapes`, `Connectors`, `Diamond`, `Ellipse`, `Line`, `Frame`, `More tools`, `Laser pointer`, `Keep the tool`, `Pen mode`) in the four `lang/*.json`, values from Task 17's table; run `bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php` — PASS.
- [ ] Step 4: `npm run test -- canvas-tools sticky-tool` — PASS; front gates.
- [ ] Step 5: commit `feat(whiteboard): the tool bar of the board, sticky placement and its keys`.

### Task 9 (lane View): `WhiteboardZoomBar`, `WhiteboardMinimap`, `WhiteboardHistoryBar`

**Mockup:** ScreenWhiteboard (zoom `sk-wbbar` with `minus`, `wb-zoom-v`, `plus`, `sk-vsep`, `scan`, `map` `is-on`; `sk-minimap` 11.25rem × 7rem with `wb-mm-el` and `sk-minimap-view`; history `undo-2`, `redo-2`), WhiteboardToolbar (the percentage is a button resetting to 100 %). Spec §9.1, §11.

**Files:** Create `resources/js/components/skrum/whiteboard-view-controls.tsx`, `whiteboard-view-controls.test.tsx`.

**Interfaces — produces:**

```ts
export function WhiteboardZoomBar(props: {
    percent: number;
    canZoomIn: boolean;
    canZoomOut: boolean;
    minimapOpen?: boolean;          // undefined: no minimap toggle (below lg, phone)
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
    onFit: () => void;
    onMinimapToggle?: () => void;
    className?: string;
}): ReactElement;

export type MinimapShape = { id: string; x: number; y: number; width: number; height: number; color: PostItColor | null }; // minimap pixels
export function WhiteboardMinimap(props: {
    shapes: readonly MinimapShape[];
    view: { x: number; y: number; width: number; height: number };   // minimap pixels
    onMoveTo: (point: { x: number; y: number }) => void;            // minimap pixels; the container converts
    onPan: (fractionX: number, fractionY: number) => void;          // keyboard on the frame: ±0.1
    className?: string;
}): ReactElement;

export function WhiteboardHistoryBar(props: { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; className?: string }): ReactElement;
```

All three build on `WhiteboardToolbar` (Task 7 is in another lane: this lane builds its bars on the same token classes with its own `role="toolbar"` markup and the same roving behaviour through a shared hook only if Task 7 has merged first; otherwise it writes the markup inline and the controller folds the duplication in Task 13 — note it in the merge notes).

**Composition:** zoom bar `role="toolbar"` "Zoom": Zoom out (`Minus`), the percentage `button` (`text-sm font-bold tabular-nums min-w-13`, name "Reset zoom to 100 %", text "80 %" with a narrow no-break space as the French typography of the mockup), Zoom in (`Plus`), separator, "Fit to screen" (`Scan`), "Minimap" (`Map`, `aria-pressed`). Minimap: `div[role=img]` named "Minimap" with `aria-describedby` "Shows the whole board; the frame is the part you see.", `w-45 h-28 rounded-lg border bg-card shadow-raised overflow-hidden relative`; shapes as absolutely positioned `span`s (`rounded-[1px]` is an arbitrary size: use `rounded-xs`), a palette colour with the swatch classes of `WhiteboardColorBar` (`bg-skrum-col-<c> border border-skrum-col-<c>-border`), others `bg-muted-foreground/50`; the view frame a `button` "Move the view" (`border-[1.5px]` is a stroke ≤ 2px: allowed in px per rule 2; `border-primary bg-primary/10 rounded-sm`) taking ←→↑↓ (`onPan`); pointer down / move on the minimap (`setPointerCapture`) calls `onMoveTo` with the point relative to the minimap. History: `role="toolbar"` "History" with Undo (`Undo2`) and Redo (`Redo2`).

**Behaviours (Vitest, written first):** names and order of every control; disabled states (`canZoomIn=false` disables Zoom in, etc.); the percentage reads "80 %" and calls `onReset`; Minimap toggle `aria-pressed` and absent when `minimapOpen` is undefined; minimap shapes count and colour classes; a pointer down at (50, 30) calls `onMoveTo({x: 50, y: 30})` (with `getBoundingClientRect` stubbed); arrows on the frame call `onPan(±0.1, 0)` / `(0, ±0.1)`; history buttons disabled per props; roving focus inside each toolbar.

- [ ] Step 1: tests; `npm run test -- whiteboard-view-controls` — FAIL. Step 2: implement — PASS; front gates. Step 3: commit `feat(skrum): zoom bar, minimap and history bar of the whiteboard`.

### Task 10 (lane View): `CanvasView` — zoom, fit, minimap, history

**Files:** Create `resources/js/components/whiteboard/canvas-view.tsx`, `canvas-view.test.tsx`.

**Interfaces:**
- Consumes: Tasks 1 (`pressNativeControl`, `nativeControlEnabled` of `canvas-commands.ts`), 3, 4, 6, 9; `useLocalPreference`; `useShortcut`; `hooks/use-mobile` breakpoints (`lg` through a `matchMedia('(min-width: 64rem)')` hook — reuse one if `hooks/` has it, otherwise a small `useMediaQuery` in this file).
- Produces: `CanvasView(props: { api: ExcalidrawImperativeAPI; snapshot: CanvasSnapshot; canvas: RefObject<HTMLElement | null>; editing: boolean }): ReactElement` — history only when `editing`; zoom bar always; minimap from `lg` when open.

**Behaviours (Vitest, written first; fake API with `updateScene`, `scrollToContent`, `getSceneElements`):**
1. Zoom in at 1 → `updateScene({appState: zoomAroundCentre(view, 1.1) mapped to {scrollX, scrollY, zoom: {value}}})`; at `MaxZoom` the button is disabled (Review Focus 5); Zoom out mirrors it;
2. the percentage resets to 1 around the centre;
3. Fit → `api.scrollToContent(api.getSceneElements(), {fitToViewport: true, viewportZoomFactor: 0.9, animate: !prefersReducedMotion})`; on an empty board (`getSceneElements()` empty) nothing is called (Review Focus 4);
4. the minimap toggle is remembered under `skrum.whiteboardMinimap` (default `true`, owner decision 6) and the minimap is not rendered below `lg`;
5. the minimap draws `minimapItems(snapshot.elements)` through `minimapFrame` / `toMinimap` with the view's `visibleArea`; items are recomputed only when `snapshot.stamp` changes (`useMemo` on the stamp; a test counts calls through a spy on the module);
6. a minimap press centres the view on `fromMinimap(point)` (`centredOn`); the frame's arrows pan with `pannedBy`;
7. history: Undo / Redo press the hidden native buttons (`pressNativeControl`) and are disabled when `nativeControlEnabled` is false; the state is re-read on every snapshot and by a `MutationObserver` on the native buttons' `disabled` attribute (the library changes it without a scene change);
8. M toggles the minimap while the focus is in the canvas wrapper or a bar, never while typing (Review Focus 1), and obeys `singleKeyShortcutsEnabled()`;
9. a follower (Review Focus 5): with `useWhiteboardFollow` running on the same fake API, a zoom from the bar triggers the fake's `onScrollChange` listeners with a view the hook did not apply, and `paused` becomes true — written in `resources/js/hooks/use-whiteboard-follow.test.ts` if that file exists, otherwise in `canvas-view.test.tsx` with both hooks rendered.

- [ ] Step 1: tests; `npm run test -- canvas-view use-whiteboard-follow` — FAIL. Step 2: implement — PASS. Step 3: keys `Zoom`, `Reset zoom to 100 %`, `Fit to screen`, `Minimap`, `Shows the whole board; the frame is the part you see.`, `Move the view` in the four files; PHP translation tests on PostgreSQL (`bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php`) — PASS. Step 4: front gates. Step 5: commit `feat(whiteboard): zoom, minimap and history over the canvas`.

### Task 11 (lane Selection): `WhiteboardSelectionBar`, `WhiteboardSelectionCount`

**Mockup:** ScreenWhiteboard (`sk-wbbar wb-float` "Sélection": `wb-swatch` ×8 with `is-on`, `sk-vsep`, `group`, `align-horizontal-distribute-center`, `lock`, `list-checks` — not built, P20-01 —, `trash-2` in `--skrum-destructive-text`; `wb-selcount` "3 éléments" on `--ring` with `--primary-foreground`).

**Files:** Create `resources/js/components/skrum/whiteboard-selection-bar.tsx`, `whiteboard-selection-bar.test.tsx`.

**Interfaces — produces:**

```ts
export type AlignCommand = 'alignLeft' | 'alignRight' | 'alignTop' | 'alignBottom' | 'distributeHorizontally' | 'distributeVertically';

export function WhiteboardSelectionBar(props: {
    colour?: { value: PostItColor | null; onChange: (color: PostItColor) => void; disabled?: boolean }; // absent: no fill in the selection
    group: { kind: 'group' | 'ungroup'; onPress: () => void } | null;
    align: { enabled: boolean; distribute: boolean; onCommand: (command: AlignCommand) => void };
    lock?: { locked: boolean; onPress: () => void };       // facilitator only
    styles: { shown: boolean; onToggle: () => void };
    remove: { onPress: () => void; disabled?: boolean; reason?: string };
    style?: CSSProperties;                                   // left / top from selectionBarPlacement
    onSize?: (size: { width: number; height: number }) => void; // measured once mounted and on resize (ResizeObserver)
}): ReactElement;

export function WhiteboardSelectionCount(props: { count: number; style?: CSSProperties }): ReactElement;
```

**Composition:** `role="toolbar"` "Selection", horizontal: `WhiteboardColorBar` (its own radiogroup "Fill colour", unchanged) when `colour` is given, separator, then `Group` (`Group` icon) or `Ungroup` (`Ungroup`), "Align" (`AlignHorizontalDistributeCenter`) opening a `DropdownMenu` with six items (`AlignStartVertical` "Align left", `AlignEndVertical` "Align right", `AlignStartHorizontal` "Align top", `AlignEndHorizontal` "Align bottom", `AlignHorizontalSpaceAround` "Distribute horizontally", `AlignVerticalSpaceAround` "Distribute vertically"; the last two disabled unless `distribute`), "Lock" / "Unlock" (`Lock` / `LockOpen`, `aria-pressed` = locked), "Styles" (`Palette`, `aria-pressed` = shown), "Delete" (`Trash2`, `text-skrum-destructive-text`, the name in its tooltip; `aria-describedby` the reason when disabled). The count chip: `span` `rounded-xs bg-ring px-1.75 text-2xs font-bold leading-4.5 text-primary-foreground` (sizes added to `@theme` when missing), text "1 element" or ":count elements".

**Behaviours (Vitest, written first):** the order of the controls; no colours when `colour` is absent; Group vs Ungroup; the six align items and the disabled distributions; Lock absent without `lock`; Delete disabled with its reason as description; Styles pressed state; roving focus; `onSize` reports the measured box (ResizeObserver stubbed); the chip's singular and plural.

- [ ] Step 1: tests — FAIL. Step 2: implement — PASS; front gates. Step 3: commit `feat(skrum): selection bar and count chip of the whiteboard`.

### Task 12 (lane Selection): `CanvasSelection` — bar, chip, commands, "Styles"

**Files:** Create `resources/js/components/whiteboard/canvas-selection.tsx`, `canvas-selection.test.tsx`.

**Interfaces:**
- Consumes: Tasks 1 (`runCanvasCommand` of `canvas-commands.ts`, `getCommonBounds` of `excalidraw.ts`), 5, 6, 11; `colorBarState`, `filledSelection` (`lib/whiteboard/canvas-colors.ts`); `recolorElements`, `postItAppState` (`palette.ts`); `CaptureUpdateAction`.
- Produces: `CanvasSelection(props: { api: ExcalidrawImperativeAPI; snapshot: CanvasSnapshot; canvas: RefObject<HTMLElement | null>; isFacilitator: boolean; editing: boolean; stylesShown: boolean; onStylesChange: (shown: boolean) => void }): ReactElement | null`. `stylesShown` is lifted to the board, which sets the wrapper class that shows the library's panel (Task 13).

**Behaviours (Vitest, written first; fake API and a canvas `div` holding `.excalidraw-container` whose `keydown` events are recorded):**
1. nothing without a selection, in view mode (`editing=false`), or when `selectionBarShown` is false (Review Focus 2 and 3: a snapshot where the selected element became a tombstone renders nothing);
2. placement: the bar's `style` is `selectionBarPlacement(bounds, view, measured size)` where `bounds` comes from `getCommonBounds(selected elements)` (`[minX, minY, maxX, maxY]` → `Rect`); the chip at `selectionCountPlacement`;
3. colours recolour the selected filled shapes and set the next fill (moved from `canvas-colors.test.tsx` "recolours the selected shapes that have a fill, and only them"), with `captureUpdate: IMMEDIATELY`; absent when nothing selected has a fill; checked colour from `colorBarState`;
4. Group / Ungroup / each alignment / Delete / Lock dispatch the matching `CommandKeys` event on `.excalidraw-container` (`runCanvasCommand`), with the platform's modifier;
5. Lock only when `isFacilitator`; for a non-facilitator a selection with `hasLocked` disables the colours and Delete with "Only the facilitator can change a locked element." (spec §7);
6. "Styles" calls `onStylesChange(!stylesShown)`; deselecting calls `onStylesChange(false)`;
7. the bar is hidden while `selectedElementsAreBeingDragged` and comes back at the new place on the next snapshot;
8. the place kept by 18e for "Convert to actions" is gone: no `selectionActions` prop exists (spec §3).

- [ ] Step 1: tests — FAIL. Step 2: implement — PASS. Step 3: keys `Selection` (exists), `Group`, `Align`, `Align left`, `Align right`, `Align top`, `Align bottom`, `Distribute horizontally`, `Distribute vertically`, `Lock`, `Unlock`, `Styles`, `1 element`, `:count elements` in the four files; PHP translation tests on PostgreSQL (`bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php`) — PASS. Step 4: front gates. Step 5: commit `feat(whiteboard): the selection bar of the board`.

---

## Step C — single writer, after the three lanes are merged

### Task 13: The board wears its own chrome

**Read first:** `board.tsx` (whole), `board-header.tsx:250-290` (`BoardActions` and its `sticky` slot), `resources/css/excalidraw-theme.css`, `resources/css/app.css:477-575`, the merge notes of the lanes.

**Files:** Modify `board.tsx`, `board-header.tsx` (+ test: the `sticky` slot and its case go), `sticky-tool.tsx` (the `StickyTool` popover goes; `stickyAt`, `addSticky` stay), `sticky-tool.test.tsx` (the popover cases go, per **Owner decisions**), `resources/css/excalidraw-theme.css`, `resources/css/app.css` (reaction-bar offsets), `lib/whiteboard/excalidraw.ts` (`ToolbarDom` goes); delete `canvas-colors.tsx`, `canvas-colors.test.tsx`, `hooks/use-whiteboard-toolbar-slot.ts`.

**What it does:**
- `board.tsx`: `const snapshot = useCanvasSnapshot(api)`; `const [stylesShown, setStylesShown] = useState(false)`; the wrapper becomes `className={cn('whiteboard-canvas skrum-whiteboard--fallback-colors skrum-whiteboard--own-chrome relative min-h-0 flex-1', stylesShown && 'skrum-whiteboard--styles')}`; inside it, after `<Excalidraw>`: `{api && snapshot && <CanvasView … editing={!viewMode} />}`, `{api && snapshot && !viewMode && !isPhone && <CanvasTools … />}`, `{api && snapshot && <CanvasSelection … editing={!viewMode} isFacilitator={me.isFacilitator} />}`; the `colors` state, `stickyOpen`, `toolbarSlot`, the portal and the `sticky` prop of `BoardActions` go; `strokeForTool` and `appliedStroke` stay as they are (the border follows the fill for a new shape). Every other hook and effect is kept verbatim.
- `excalidraw-theme.css`, one commented block "Plan 20: the board's own chrome (spec §5 rule 3) — Check this when the library is upgraded":

```css
.skrum-whiteboard--own-chrome .excalidraw .App-toolbar-container,
.skrum-whiteboard--own-chrome .excalidraw .layer-ui__wrapper__footer-left .zoom-actions,
.skrum-whiteboard--own-chrome .excalidraw .layer-ui__wrapper__footer-left .undo-redo-buttons,
.skrum-whiteboard--own-chrome .excalidraw .layer-ui__wrapper__footer-right,
.skrum-whiteboard--own-chrome .excalidraw .main-menu-trigger,
.skrum-whiteboard--own-chrome:not(.skrum-whiteboard--styles) .excalidraw .selected-shape-actions {
    display: none !important;
}

/* "Styles": the library's panel beside our tool bar (left 1rem, 2.25rem tools, 0.25rem padding, 1px border), not under it. */
.skrum-whiteboard--own-chrome.skrum-whiteboard--styles .excalidraw .App-menu_top__left {
    margin-left: calc(1rem + 2.75rem + 2px + 1rem);
}
```

  (`!important` for the reason the block of `app.css` gives: the library's stylesheet loads later with the canvas chunk. The phone rule for `.App-bottom-bar` is added in Task 15.)
- `app.css`: the reaction-bar rules that refer to the library's bottom controls keep working; the "scroll back to content" offset is unchanged; check at 1440 that the history bar (bottom-left), the reactions bar (bottom-centre) and the zoom bar + minimap (bottom-right) do not overlap — the capture's overflow check proves it in Task 18.
- `lib/whiteboard/excalidraw.ts`: `ToolbarDom` and its comment go (its only users are deleted).

**Tests (Vitest, written first):** `board-header.test.tsx` without the sticky slot; a new `board-chrome.test.tsx` that renders `CanvasTools`, `CanvasView`, `CanvasSelection` composed as `board.tsx` composes them over a fake API and asserts: in edit mode the four bars are present; in view mode only the zoom bar (and the minimap at `lg`); none while `snapshot` is null (loading); "Styles" toggles `skrum-whiteboard--styles` on the wrapper. (`board.tsx` itself loads the Excalidraw chunk, which jsdom cannot render: the composition is tested through an exported `BoardChrome` component that `board.tsx` renders, holding exactly the three containers and the wrapper class logic.)

- [ ] Step 1: tests — FAIL. Step 2: implement and delete. Step 3: `npm run test -- whiteboard` — PASS; `npx knip`-free check: `grep -rn "use-whiteboard-toolbar-slot\|ToolbarDom\|CanvasColors" resources/js` returns nothing. Step 4: front gates. Step 5: commit `feat(whiteboard): the board wears the rebuilt toolbars`.

### Task 14: The library's menu entries in the board menu

**Read first:** `board-menu.tsx` (whole) and its test; spec §9.4; decision 3.

**Files:** Modify `board-menu.tsx`, `board-menu.test.tsx`, `board.tsx` (passes `api` to the header's menu through `BoardActions`, which already receives `onExport`: add `canvasActions?: BoardCanvasActions`).

**Interfaces — produces:**

```ts
export type BoardCanvasActions = {
    saveAsImage: () => void;        // api.updateScene({appState: {openDialog: {name: 'imageExport'}}})
    findOnCanvas: () => void;       // api.toggleSidebar({name: 'default', tab: 'search'})
    canvasHelp: () => void;         // api.updateScene({appState: {openDialog: {name: 'help'}}})
    clearCanvas: () => void;        // the library's confirmation: runCanvasCommand is not it; dispatch mod+Delete (keyTest of 0.18.1, `activeConfirmDialogAtom` "clearCanvas") — add 'clearCanvas' to CanvasCommand in Task 1's table with { key: 'Delete', mod: true } and its test case
    background: string;             // appState.viewBackgroundColor
    setBackground: (color: string) => void; // api.updateScene({appState: {viewBackgroundColor: color}})
};
```

Canvas background choices (canvas data, ruling 36): `[{key: 'Paper', value: CANVAS_LIGHT}, {key: 'White', value: '#ffffff'}, {key: 'Light grey', value: '#f8f9fa'}, {key: 'Light blue', value: '#f5faff'}, {key: 'Light yellow', value: '#fffce8'}, {key: 'Light beige', value: '#fdf8f6'}]` in `lib/whiteboard/palette.ts` as `CanvasBackgrounds` (with a test that `#ffffff`, `#f8f9fa`, `#f5faff`, `#fffce8`, `#fdf8f6` are the library's `DEFAULT_CANVAS_BACKGROUND_PICKS`, read from `dist/dev/chunk-*.js` as in the contract test).

**Behaviours (Vitest, written first):** the menu shows "Save as image", "Find on canvas", "Canvas help", "Clear canvas" and the "Canvas background" sub-menu (`menuitemradio`, the current one checked) to a member, a guest and the facilitator alike, after the existing entries and before "Delete this board"; each calls its action; the entries are absent while `canvasActions` is undefined (canvas not ready).

- [ ] Steps: tests — FAIL; implement — PASS; keys `Save as image`, `Find on canvas`, `Canvas help`, `Clear canvas`, `Canvas background`, `Paper`, `Light grey`, `Light blue`, `Light yellow`, `Light beige` (`White` exists) in the four files; PHP translation tests on PostgreSQL (`bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php`); front gates; commit `feat(whiteboard): the canvas entries move into the board menu`.

### Task 15: The phone — compact bar in edit mode, "Fit" in read mode

**Mockup:** MobileRituals frame 1 (`wb-dock` with `sk-wbbar` and `sk-btn` "Modifier", tools 2.75rem), ScreenWhiteboard README "Mobile". Spec §9.3; decision 5.

**Read first:** `read-mode-toggle.tsx` (whole: `ReadModeLayer`, `data-slot="read-mode-dock"`), `use-read-mode.ts`, `app.css:500-560` (the dock and the reactions bar on `.excalidraw--mobile`).

**Files:** Create `components/whiteboard/phone-toolbar.tsx`, `phone-toolbar.test.tsx`; modify `read-mode-toggle.tsx` (+ test: a `dockActions` slot before the toggle), `board.tsx` (on a phone: `PhoneToolbar` in edit mode, "Fit to screen" in the read dock), `excalidraw-theme.css` (on `.excalidraw--mobile` inside `.skrum-whiteboard--own-chrome`: the library's bottom tool row hidden — the exact child of `.App-bottom-bar` that holds the tools, read from the 0.18.1 source in Step 1 and added to `NativeChrome` in `canvas-commands.ts`; the shape-actions panel it opens on a selection stays, shown by "Styles" as on desktop), `app.css` (the reactions bar's bottom offset above the new bar: the bar is 2.75rem + 0.5rem + 2px tall at 1rem from the bottom).

**Interfaces — produces:** `PhoneToolbar(props: { api; snapshot; canvas; choices… }): ReactElement` — `WhiteboardToolbar` horizontal, `size="touch"`, items `PhoneBarTools`, `trailing` "More tools" opening a `Drawer` (`components/ui/drawer.tsx`) titled "More tools" with `PhoneDrawerTools` as a grid of labelled buttons, then Undo, Redo and "Fit to screen"; the sticky sub-bar opens above the bar. It reuses the tool logic of `CanvasTools` through a hook extracted in this task: `useCanvasTools(api, snapshot)` (moved out of `canvas-tools.tsx`, which then calls it; its tests stay green).

**Behaviours (Vitest, written first):** read mode: the dock shows "Fit to screen" then "Modifier" and no tool bar, no zoom bar, no minimap; edit mode: the bottom bar with Selection, Sticky note, Pencil and "More tools"; the drawer lists Hand, Shape, Text, Eraser, Image, Undo, Redo, Fit to screen — no Connector, no Frame; pressing a drawer tool sets it and closes the drawer; a locked board for a non-facilitator shows no bar (the toggle is already hidden for that viewer).

- [ ] Steps: read the source for the bottom row's class and write it into `NativeChrome.mobileTools` (`canvas-commands.ts`) (with a contract-test line); tests — FAIL; implement — PASS; front gates; commit `feat(whiteboard): the phone's compact tool bar`.

### Task 16: Keys — the single-key preference on the canvas, and the shortcuts dialog

**Read first:** `lib/shortcuts/preference.ts`, `hooks/use-shortcut.ts:1-60` (`isEditableTarget`), `lib/shortcuts/sections.ts:160-195` and its test; spec §9.1 "Keyboard"; decision 7.

**Files:** Create `components/whiteboard/use-canvas-key-guard.ts`, `use-canvas-key-guard.test.ts`; modify `board.tsx` (one call), `lib/shortcuts/sections.ts`, `sections.test.ts`.

**What it does:**
- `useCanvasKeyGuard(canvas: RefObject<HTMLElement | null>)`: a `keydown` listener **in the capture phase** on the canvas wrapper; when `singleKeyShortcutsEnabled()` is false and the key is one printable character without Ctrl, Meta or Alt (`isCharacterKeyCombo` semantics), and the target is not editable (`isEditableTarget`: the canvas text editor is a `textarea`), it calls `stopPropagation()` — the library's React handler, attached at the root and reached in the bubble phase, never sees it. It never calls `preventDefault()` (typing elsewhere is untouched).
- `sections.ts`, Whiteboard: the items become Selection V, Hand H, Sticky note N, Shape R, Connector C, Text T, Pencil P, Eraser E, Frame F, Minimap M, Fit to screen ⇧1, Pan Space + drag, Undo mod Z, Redo shift mod Z, Zoom in mod +, Zoom out mod −; the note "The whiteboard uses the shortcuts of its own toolbar." goes (the key stays in the files if another caller uses it; otherwise it is left unused for the translation review of Task 17 to report).

**Tests (written first):** guard — with the preference on, a `keydown` "r" dispatched on a child of the wrapper reaches a bubble listener on `document`; with it off, it does not; "Enter", "Escape", Ctrl+Z and "r" on a `textarea` inside the wrapper always pass (Review Focus 1); `sections.test.ts` — the case "lists the keys the whiteboard canvas answers to" becomes "lists the keys of the whiteboard's tool bar" with the new id list `['select', 'hand', 'sticky', 'shape', 'connector', 'text', 'pencil', 'eraser', 'frame', 'minimap', 'fit', 'pan', 'undo', 'redo', 'zoom-in', 'zoom-out']` and no note.

- [ ] Steps: tests — FAIL; implement — PASS; front gates; commit `feat(whiteboard): every single-key shortcut of the board obeys the preference`.

### Task 17: Translations

**Files:** `lang/en.json`, `fr.json`, `es.json`, `de.json` (values reviewed; keys already added by Tasks 8, 10, 12, 14).

Every key this plan adds, with its values (informal register; French typography with a narrow no-break space before "%"):

| Key (en) | fr | es | de |
|---|---|---|---|
| Tools | Outils | Herramientas | Werkzeuge |
| Sticky note colours | Couleurs du post-it | Colores de la nota | Farben der Haftnotiz |
| Shapes | Formes | Formas | Formen |
| Connectors | Connecteurs | Conectores | Verbinder |
| Diamond | Losange | Rombo | Raute |
| Ellipse | Ellipse | Elipse | Ellipse |
| Line | Ligne | Línea | Linie |
| Frame | Cadre | Marco | Rahmen |
| More tools | Plus d'outils | Más herramientas | Weitere Werkzeuge |
| Laser pointer | Pointeur laser | Puntero láser | Laserpointer |
| Keep the tool | Garder l'outil | Mantener la herramienta | Werkzeug beibehalten |
| Pen mode | Mode stylet | Modo lápiz | Stiftmodus |
| Zoom | Zoom | Zoom | Zoom |
| Reset zoom to 100 % | Revenir au zoom 100 % | Volver al zoom 100 % | Zoom auf 100 % zurücksetzen |
| Fit to screen | Ajuster à l'écran | Ajustar a la pantalla | An Bildschirm anpassen |
| Minimap | Minimap | Minimapa | Minikarte |
| Shows the whole board; the frame is the part you see. | Montre tout le tableau ; le cadre est la partie que tu vois. | Muestra todo el tablero; el marco es la parte que ves. | Zeigt das ganze Board; der Rahmen ist der Teil, den du siehst. |
| Move the view | Déplacer la vue | Mover la vista | Ansicht verschieben |
| Group | Grouper | Agrupar | Gruppieren |
| Align | Aligner | Alinear | Ausrichten |
| Align left | Aligner à gauche | Alinear a la izquierda | Links ausrichten |
| Align right | Aligner à droite | Alinear a la derecha | Rechts ausrichten |
| Align top | Aligner en haut | Alinear arriba | Oben ausrichten |
| Align bottom | Aligner en bas | Alinear abajo | Unten ausrichten |
| Distribute horizontally | Répartir horizontalement | Distribuir horizontalmente | Horizontal verteilen |
| Distribute vertically | Répartir verticalement | Distribuir verticalmente | Vertikal verteilen |
| Lock | Verrouiller | Bloquear | Sperren |
| Unlock | Déverrouiller | Desbloquear | Entsperren |
| Styles | Styles | Estilos | Stile |
| 1 element | 1 élément | 1 elemento | 1 Element |
| :count elements | :count éléments | :count elementos | :count Elemente |
| Save as image | Enregistrer en image | Guardar como imagen | Als Bild speichern |
| Find on canvas | Chercher sur le tableau | Buscar en el tablero | Auf dem Board suchen |
| Canvas help | Aide du tableau | Ayuda del tablero | Hilfe zum Board |
| Clear canvas | Vider le tableau | Vaciar el tablero | Board leeren |
| Canvas background | Fond du tableau | Fondo del tablero | Hintergrund des Boards |
| Paper | Papier | Papel | Papier |
| Light grey | Gris clair | Gris claro | Hellgrau |
| Light blue | Bleu clair | Azul claro | Hellblau |
| Light yellow | Jaune clair | Amarillo claro | Hellgelb |
| Light beige | Beige clair | Beige claro | Hellbeige |

- [ ] Check every key of the table is in the four files with these values (a task earlier may have written a first value: this table wins); check no key that existed changed value (`git diff main -- lang/` shows additions only, except none).
- [ ] Run `bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php` — Expected: PASS (PostgreSQL only: the owner's rule of 2026-10-03, see **Global Constraints**).
- [ ] Commit `feat(whiteboard): translations of the rebuilt toolbars`.

### Task 18: Captures (light, 1440, French)

The owner's working rule: no browser walkthrough is written, edited or run. Captures only, in one configuration — light theme, 1440 wide, French — through the visual harness of `tests/Browser/Visual` (`CapturesVisuals::captureVisuals`, which honours `VISUAL_ONLY`). Nothing in `tests/Browser/Walkthroughs` is touched; `Plan17aWhiteboardCoreTest`, `Plan17bWhiteboardTemplatesTest`, `Plan17cWhiteboardFacilitationTest` and `Plan18eWhiteboardTest` click the library's tool bar, main menu, zoom buttons or the old sticky trigger and are listed in the report as stale.

**Files:** Modify `tests/Browser/Support/InteractsWithWhiteboards.php` (`selectWhiteboardTool`: clicks `[role="toolbar"][aria-label="Outils"] button[aria-keyshortcuts="<key>"]` — or by the English name when the page is in English: the helper takes the tool id and maps it with a table `['rectangle' => 'R', 'ellipse' => …]`, choosing the sub-bar radio for diamond, ellipse and line — and asserts `aria-pressed="true"`; `addWhiteboardSticky`: the sticky tool's sub-bar colour instead of `button[aria-label="Sticky note"]`), `tests/Browser/Visual/WhiteboardVisualTest.php` (`p18eVisualLeaveCanvasToolbarOut` goes: the library's tool bar is hidden; the export case opens the board menu's "Enregistrer en image" instead of the library's main menu; new cases below).

- [ ] **Step 1: Cases** (fixtures by factories and the existing helpers `whiteboardWithFacilitator`, `p18eVisualSticky`; fixed ids and names):

| Name | Screen |
|---|---|
| `whiteboard-toolbars` | the facilitator's board with five stickies, three of them selected: tool bar, selection bar with the count chip, history, zoom and minimap (ScreenWhiteboard) |
| `whiteboard-sticky-tool` | the Sticky note tool active with its colour sub-bar (WhiteboardToolbar preview) |
| `whiteboard-shape-tool` | the Shape tool with its sub-bar |
| `whiteboard-styles` | a selected sticky with "Styles" on: the library's panel beside the tool bar |
| `whiteboard-align-menu` | the selection bar's Align menu open |
| `whiteboard-board-menu` | the board menu with the canvas entries and the background sub-menu open |
| `whiteboard-locked-guest` | a guest on a locked board: zoom and minimap only |

- [ ] **Step 2: Run.** `npm run build:front`, then `docker compose exec -e VISUAL_ONLY=light-1440-fr laravel.test php artisan test --compact tests/Browser/Visual/WhiteboardVisualTest.php` (from a worktree, the container and working directory as `bin/test-db` documents them). The overflow check of the harness must pass. Only `-light-1440-fr.png` files are written.
- [ ] **Step 3:** Run once `tests/Browser/Smoke/WhiteboardHarnessTest.php` (it draws a rectangle through `selectWhiteboardTool` and checks the server stores it: the one browser proof that a tool of the new bar reaches the canvas and the sync) — Expected: PASS. Ruling (2026-10-03, on the owner's behalf, logged in the report): the smoke test is not a walkthrough — it lives in `tests/Browser/Smoke`, not `tests/Browser/Walkthroughs`, and the owner's rule names walkthroughs — so it is run.
- [ ] **Step 4:** Commit `test(visual): whiteboard toolbars, light, 1440, French`.

### Task 19: Deviations and documents

- [ ] For each capture of Task 18, open it beside ScreenWhiteboard's or WhiteboardToolbar's `preview.html` (light, 1440, French) and write the remaining differences. Each is fixed, or is a row of **Pre-build deviations** with the owner's word. A difference that fits no reason stops the task.
- [ ] Documents, in one commit:
  - rename the spec `docs/superpowers/specs/2026-10-21-plan-20-whiteboard-toolbars-design.md` to `docs/superpowers/specs/2026-10-21-whiteboard-toolbars-design.md` (this plan stays where it is); the owner's answers to spec §15 and to the pre-build deviations are already in both, so only the differences found in the step above are folded in;
  - `docs/superpowers/research/front-rewrite/feature-roadmap.md`: row WB-1 marked done, plan 20; rows WB-2 to WB-5 untouched (backlog by the owner's note at the top);
  - `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, table "Deviations from the mockup": D-21 reduced to "comments, convert to actions, follow; sticky authors — backlog (former plan 28)"; D-49 removed; the P20 rows approved by the owner added after D-127 with their status; `docs/superpowers/research/front-rewrite/deviations.md` counts updated;
  - `docs/superpowers/specs/2026-10-01-front-rewrite-design.md`: §3 non-goal "Recoding the Excalidraw toolbar" and §6.4 "Whiteboard", rulings 5 and 29, each with a pointer to the new spec;
  - `docs/superpowers/specs/2026-10-01-whiteboard-design.md` §6.1 (the sticky button's place) and §13 (the board page: the bars) with the pointer;
  - `docs/design-system/components/ExcalidrawTheme/README.md` is a mockup: not edited.
- [ ] Commit `docs: plan 20 — spec and plan in place, roadmap and deviation rows updated`.

### Task 20: Full suites and report

- [ ] `vendor/bin/pint --format agent`; `vendor/bin/sail composer types:check` (nothing in PHP changed: it must stay green).
- [ ] `bin/test-db pgsql` — Expected: `test-db pgsql: PASS`. PostgreSQL only (owner, 2026-10-03): sqlite, mariadb and mysql are not run here; the four-engine matrix runs once after the last merge into `roadmap` (plans 24 and 25).
- [ ] `bin/test-db pgsql --concurrency` (unchanged code; run because the owner's rule asks for the whole suites at the end of a plan) — Expected: PASS.
- [ ] `npm run test`, `npm run types:check`, `npm run check`, `npm run build:front` — Expected: PASS; and `grep -l "excalidraw" public/build/assets/*.js` lists only the whiteboard chunk(s) (spec criterion 21).
- [ ] Report `docs/superpowers/research/plan-20-report.md`: per acceptance criterion of spec §13 the test or capture that proves it; the differences that remain with each mockup; every existing test edited or removed and why (the removals approved by the owner on 2026-10-03); every library internal the board now relies on (`NativeChrome` and `CommandKeys` of `canvas-commands.ts`); the stale walkthrough files; every decision taken on the owner's behalf.
- [ ] Commit `docs: plan 20 report`.
- [ ] The controller merges `plan-20-whiteboard-toolbars` into `roadmap` (other wave-A plans may have merged first: on a `lang/*.json` conflict keep both sides, then re-run `npm run test`, `npm run build:front` and `bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php`), runs `bin/test-db pgsql` on `roadmap` — Expected: PASS — and sends the owner the end-of-plan notice pointing at the report. **No merge into `main`, no push.**

---

## Self-review (done while writing; kept for the reader)

**Spec coverage.** §2 goal 1 (four bars): Tasks 7–13; goal 2 (nothing lost): sub-bars and "More tools" (8), "Styles" (12, 13), menu entries (14), keys (16); goal 3 (phone): 15; goal 4 (internals named): 1, 13, 15; goal 5 (keyboard): 7, 8, 10, 16. §5 rule 1 (front only): no task touches PHP but translations and browser support; rule 2: Task 1; rule 3: Task 13; rule 5: Task 13's composition. §6 local state: Tasks 8 (choices), 10 (minimap preference), 12/13 (styles), 6 (view). §7 permissions: Tasks 8 (view mode), 12 (lock, locked elements), 13 (view mode composition), 15 (phone, locked). §8 real time: Task 10 case 9 (follow), Task 6 (remote changes through `onChange`), Task 12 case 1 (remote deletion). §9.1: 7–13; §9.2: 13; §9.3: 15; §9.4: 14; §9.5: 13 (loading). §11: 7, 9, 11, 16. §12 fail-soft: Task 1 cases. §13 criteria: 1 → 13, 18; 2 → 2, 7, 8; 3 → 8, 18 (smoke); 4 → 2, 8; 5 → 1, 10; 6 → 3, 10; 7 → 4, 10; 8 → 5, 12; 9 → 12; 10 → 1, 12; 11 → 12; 12 → 12, 13, 18; 13 → 14; 14 → 13, 18; 15 → 10; 16 → 15; 17 → 7, 9, 11; 18 → 8, 10, 16; 19 → 16; 20 → 12 (a fixture of today's elements: `colorBarState` on a template sticky) and 18; 21 → 20; 22 → 17; 23 → 18, 19; 24 → 20.

**Gaps found and closed while writing.** The library's footer also holds the touch "Finalize" button: Task 13 hides the zoom and undo groups, not the whole footer. "Clear canvas" has no API: it is the library's own `mod+Delete` shortcut, added to `CommandKeys` in Task 14 with its test. The canvas background picker of the hamburger has no exported component: Task 14 lists the library's five picks plus the paper, tested against the library's source. `colorBarState` is kept and reused (Tasks 8 and 12) so its fourteen cases stay; only the container `CanvasColors` and its five cases go, three of them moved.

**Placeholders.** Pure logic (Tasks 1–5) carries its tests and code; Task 6 carries its contract and cases. Screen tasks carry their interfaces, composition and behaviours, not full component code: they follow the screen procedure of plan 18e, where the mockup is the specification of the markup. Two facts are left to be read at execution, each with the place to read them: the class of the library's mobile tool row (Task 15 Step 1) and the confirmation that every line of Task 1's "Read first" still holds.

**Type consistency.** `CanvasSnapshot` (Task 6) is what Tasks 8, 10, 12, 13, 15 take; `CanvasView` and `Rect` come from `viewport.ts` (Task 3) everywhere; `CanvasCommand` gains `clearCanvas` in Task 14 (the table and its test, in `canvas-commands.ts`); `AlignCommand` (Task 11) is a subset of `CanvasCommand`; `ToolKeys.sticky` = `StickyKey` is read by Tasks 7, 8, 16 and 18.

**Revision with the owner's answers (2026-10-03).** All seven answers of spec §15 equal the option the plan was written on; the test removals are approved. Changed: the status line, the **Owner decisions** table (answers and the tasks carrying them, in place of the "otherwise" column), the test-deletion global constraint, the spec path (the committed `docs/` copy), Task 19 (the spec is renamed, the plan stays) and Task 20's report line. No task, code block, test case, lane or task count changed: still 20 tasks. Pre-build deviations stayed to approve at that point (approved since: see the next paragraph). Fixed while revising: **Owner decisions** said all five cases of `canvas-colors.test.tsx` move, while "Gaps found" and Tasks 8 and 12 move three; the list now names each of the five cases, checked against the file on `main`.

**Second revision with the pre-build deviation answers (2026-10-03).** Every row P20-01 to P20-10 is approved (P20-07 with the recommendation, P20-08 and P20-10 by name, the rest as listed): no task, code block, test case or lane changes; still 20 tasks. Changed: the status line (no gate left), the **Pre-build deviations** table (an owner column, Task 7 no longer waits), the base and merge target (`roadmap`), the roadmap order note (wave A: 20, 21, 26, 27, 29 in parallel), the engines (PostgreSQL only per task, per lane merge, in Task 20 and at the merge into `roadmap`; the four-engine matrix runs once at the end of the roadmap), Task 18 Step 3 (the smoke test is run, ruled not a walkthrough), Task 19 (nothing left to fold from the deviations) and Task 20 (merge into `roadmap`, end-of-plan notice). Checked against the spec: criteria 22 and 24 now say PostgreSQL, matching Tasks 8, 10, 12, 14, 17 and 20.

**Known weak points of this draft.** Nothing was run. The library facts were read in `dist/dev`; the browser build uses the `production` export condition (`dist/prod`, minified), which holds the same code: the contract test reads `dist/dev` because it is legible, and Task 1 checks that `package.json`'s `exports` point both conditions at the same version. Between 48rem and 64rem the history, reactions and zoom bars share the bottom edge and no capture covers that width (owner's rule: 1440 only).
