# Skrüm — Whiteboard toolbars rebuilt to the mockup (WB-1) — Design

Date: 2026-10-03
Status: **Draft — §15 answered by the owner on 2026-10-03 (every answer is the recommended option); the pre-build deviations of §16 are still to approve by the owner** (the autonomy mandate covered plans 18, database portability and 19 only)
Roadmap: plan 20, row WB-1 of `docs/superpowers/research/front-rewrite/feature-roadmap.md`; clears the "toolbars" part of deviation **D-21** and deviation **D-49** (`docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, "Deviations from the mockup").
Parent specs: `docs/superpowers/specs/2026-10-01-whiteboard-design.md` (the board: canvas, sync, access, facilitation) and `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` (rules §5, rulings §6.5). Final location once approved: `docs/superpowers/specs/2026-10-21-whiteboard-toolbars-design.md`.
Mockups (README and `preview.html` of each): `ScreenWhiteboard` (binding for the desktop board), `WhiteboardToolbar` (anatomy, states, keyboard), `MobileRituals` frame 1 (phone), `ExcalidrawTheme` (palette and theme, which stay), `KeyboardShortcuts` (the whiteboard section).

## 1. Problem statement

Plan 18e shipped the whiteboard on Excalidraw 0.18.1 with the library's own chrome, themed: its horizontal tool bar at the top centre, its hamburger menu and property panel at the top left, its zoom and undo controls at the bottom left. The owner decided on 2026-10-02 (third round, "D-21 toolbars") that the toolbars are rebuilt to the mockup in a plan of their own. ScreenWhiteboard draws something else: a vertical tool bar on the left with a shortcut letter in each tool, a floating bar under a selection (colours, group, align, lock, delete) with an element count on the selection frame, the history at the bottom left and the zoom with a minimap at the bottom right. The phone frame of MobileRituals draws a compact bottom bar.

This spec reverses, for the toolbars only, three earlier rulings: the non-goal "Recoding the Excalidraw toolbar" (front-rewrite spec §3), rulings 5 and 29 ("Native Excalidraw toolbar and shortcuts", §6.5) and the sentence of §6.4 "`WhiteboardToolbar` in `skrum/` is the theming wrapper and the colour bar … not a custom tool set". It also replaces the placement of the sticky button of the whiteboard spec §6.1 ("between the image tool and the eraser … or in skrum's top bar").

## 2. Goals

1. The desktop board shows the four floating bars of ScreenWhiteboard, in their places, with their states, built from `skrum/` components on design-system tokens; the library's own tool bar, zoom, undo/redo and hamburger are no longer visible.
2. No feature of the board is lost: every tool, every style control, every menu entry and every shortcut the board has today stays reachable (owner's standing rule, front-rewrite spec §2 goal 2).
3. The phone follows MobileRituals: read mode as today, and in edit mode a compact bottom bar instead of the library's mobile tool bar.
4. Everything is client-side, over Excalidraw's public API where it has one and over the 0.18.1 internals already used by the board where it has none, each such internal named in `resources/js/lib/whiteboard/excalidraw.ts` or `canvas-commands.ts` with the reason.
5. Keyboard and assistive technology: every bar is a `role="toolbar"` with roving focus, every tool names its shortcut, and every new single-character shortcut can be turned off.

## 3. Non-goals (what stays in the backlog)

- **Comments on the board** (ScreenWhiteboard topbar "Comments"), **follow a person** ("Suivre Camille"), **sticky authors** (the name line on a sticky), **convert stickies to action items** (selection bar "Convertir en actions"): the former plan 28 (WB-2 to WB-5), moved to the backlog by the owner on 2026-10-02. No place is reserved for them (the precedent of plan 19, P19-10); the `selectionActions` slot that plan 18e left on `CanvasColors` for WB-5 is removed with that component.
- The "is typing" ring on the presence avatars: not requested for the whiteboard.
- Drawing the canvas content of the mockup (SVG shapes, tokenised connectors, rotation handle drawn by us): the canvas and its selection frame stay Excalidraw's, themed by `ExcalidrawTheme` (frame and handles in `--primary`).
- Any change of the element model, the sync protocol, the server's validation or the facilitation rules (whiteboard spec §6–§11).
- Upgrading Excalidraw: the version stays pinned at 0.18.1.
- A per-board or per-user stored tool, zoom or minimap state on the server.

## 4. Decisions already taken (and where)

| Topic | Decision | Source |
|---|---|---|
| Plan of its own, after 18e | toolbars rebuilt to the mockup: vertical tool bar, selection bar, zoom, minimap | owner, third round, "D-21 toolbars" |
| Mockup is binding for presentation | layout, placement, labels, states follow ScreenWhiteboard; a difference is a deviation row put to the owner | front-rewrite spec §5 rule 13; owner, fifth round |
| Existing features kept | nothing of the board is lost | owner; front-rewrite spec §2 |
| Eight sticky colours, our colour bar everywhere, native quick picks hidden | unchanged; the colour bar moves into the tool sub-bar and the selection bar | 7-D1, 7-D3, 7-D4 |
| Facilitation tools, board menu, reactions bar | stay where 18e put them (header, header, bottom centre) | D-50 (stays) |
| Phone read mode | unchanged: read by default below `md`, "Modifier" / "Lire", local state | 7-D7; D-36 |
| Single-key shortcuts | every single-character shortcut can be turned off (`single_key_shortcuts`, Appearance page) | 18f B35; owner, third round point 12 |
| Informal register, four languages | every new key in `en`, `fr`, `es`, `de`, French "tu", Spanish "tú", German "du" | owner, sixth round |
| Element lock | only the facilitator changes it; the server enforces it | whiteboard spec §11.2 |
| Captures | light, 1440, French only; no browser walkthrough written, edited or run | owner's working rules (plan 19) |
| No new dependency | none needed | owner |
| The seven questions of §15 | answered: sticky key N; "Styles" shows the themed native property panel; the hamburger's entries move into the board menu (with a "Canvas background" sub-menu); Shape / Connector sub-bars and "More tools"; the phone's compact bar of the mockup; minimap open from `lg`, remembered; with the single-key preference off, every single-character key is blocked except while typing | owner, 2026-10-03 |
| Obsolete component tests | the deletion of `canvas-colors.test.tsx` and of the popover cases of `sticky-tool.test.tsx` is approved, their cases moved where a successor exists (plan, "Owner decisions") | owner, 2026-10-03 |

## 5. Rules (constraints on the build)

1. **Front only.** No route, controller, policy, migration, event, channel or prop changes. Verified by reading: the tool, the zoom, the minimap and the selection are local to each browser today (whiteboard spec §6.4, `WhiteboardToolbar/README.md` "Temps réel"); every element our tools create is one of the types the server already accepts (rectangle, diamond, ellipse, arrow, line, freedraw, text, image, frame) or the sticky rectangle with its `customData.skrum.kind = 'sticky'` marker, built by the code that builds it today (`sticky-tool.tsx` `stickyAt`). The only PHP the plan touches is the translation files and the tests that read them (`TranslationKeysTest`, `InformalRegisterTest`).
2. **Public API first.** Tools go through `api.setActiveTool` (including `{type: 'custom', customType}` for the sticky placement mode), the view through `api.updateScene({appState: {scrollX, scrollY, zoom}})` and `api.scrollToContent`, state through `api.onChange`, `api.onScrollChange`, `api.onPointerDown`, `api.getAppState`. Where 0.18.1 has no API (undo and redo with their disabled state, group, ungroup, align, distribute, element lock, delete, showing the property panel, hiding the library's chrome), the board uses the library's own controls or keyboard shortcuts, through named helpers in `lib/whiteboard/excalidraw.ts` and `lib/whiteboard/canvas-commands.ts`, each with the sentence "Check this when the library is upgraded", as the file already does for `ToolbarDom` and `closeTextEditor`. Nothing re-implements a library action (no hand-written align or group).
3. **The library's chrome is hidden with CSS, not removed**, under one wrapper class (`skrum-whiteboard--own-chrome` on `.whiteboard-canvas`), so that its buttons stay in the DOM for the helpers of rule 2 and its dialogs (export, image export, help, search, clear canvas) keep working.
4. Front-rewrite spec §5 rules 1–12 on every file: tokens only, rem, Tailwind scale, no overflow, visible focus, contrast, reduced motion, lucide icons, literal `t('…')`, presentational `skrum/` components.
5. The canvas keeps the full area of `.whiteboard-canvas` (plan 18e Task 7.2): every bar floats over it at `z-10` (`--z-chrome`), never pushes it.

## 6. Domain and data changes

None. No table, column, enum, model, migration or data migration. No migration of existing data: boards, elements and templates are untouched; a board made before this plan opens with the new chrome and the same scene.

Client state added, all local and never sent:

| State | Where | Lifetime |
|---|---|---|
| The current tool and the sub-choices (last shape: rectangle, diamond or ellipse; last connector: arrow or line; sticky colour) | `canvas-tools` container (React state) | the page |
| Minimap open or closed | `useLocalPreference('skrum.whiteboardMinimap', true)` (§15 decision 6) | the browser |
| Property panel shown ("Styles") | `canvas-selection` container (React state) | the page |
| The view (scroll, zoom, size) for the zoom bar and the minimap | `useCanvasView(api)` over `api.onScrollChange` and `api.onChange` | the page |

## 7. Permissions

Unchanged; the bars only reflect them.

| Viewer | Tool bar, sub-bars | Selection bar | History | Zoom, minimap |
|---|---|---|---|---|
| Facilitator | yes | yes, with "Lock" / "Unlock" | yes | yes |
| Member, not facilitator | yes | yes, without "Lock" (whiteboard spec §11.2: the server rejects it anyway; the context-menu entries are already hidden by `app.css`) | yes | yes |
| Guest | as a member (guests edit the canvas, whiteboard spec §8) | as a member | yes | yes |
| Anyone in view mode: board locked for a non-facilitator, or phone read mode | none (no tool can be used) | none | none | zoom yes; minimap yes from `lg` |

A selected element whose stored copy is locked can still be selected by a non-facilitator; the selection bar then shows the colours and "Delete" disabled with the reason "Only the facilitator can change a locked element." (the existing key) as their accessible description, instead of letting the server reject the write.

## 8. Real time

Nothing new on the wire. Interactions with what exists:

- **Follow-me (whiteboard spec §11.3).** A follower who uses the zoom buttons, "Fit", the percentage or the minimap changes the view through `updateScene`; `useWhiteboardFollow` sees a view it did not set and shows "Following paused · Resume", exactly as a wheel zoom does today. A leading facilitator's zoom through these controls fires `onScrollChange`, so the `viewport` whisper carries it as it carries a wheel zoom.
- **Remote changes** keep arriving through `scene-sync.ts`; the minimap and the selection bar recompute from `api.onChange`, throttled to one animation frame.
- **Board lock** (`board.changed`): the bars follow `viewMode` as the library's own chrome did.
- **Undo / redo** stay the library's local history of one's own changes (whiteboard spec §3).

## 9. Screens

### 9.1 Desktop board, edit mode (ScreenWhiteboard)

Placement over the canvas, from the mockup at 1440 × 900:

| Bar | Place | Content, in order | Mockup classes |
|---|---|---|---|
| **Tool bar** `role="toolbar"` "Tools", `aria-orientation="vertical"` | left 1rem, vertically from 10.625rem (centred on the canvas height when the canvas is shorter than the bar plus 2rem) | Selection (V), Hand (H) · separator · Sticky note (N, §15 decision 1), Shape (R), Connector (C), Text (T), Pencil (P), Eraser (E), Frame (F) · separator · Image · "More tools" (§15 decision 4) | `sk-wbbar sk-wbbar--v`, `sk-tool`, `sk-tool-k`, `sk-sep`, active `is-on` |
| **Sub-bar** of the active tool, `role="toolbar"` named after the tool | to the right of the tool bar, aligned on the active tool's row, 0.5rem gap | Sticky note: the eight colours (`WhiteboardColorBar`); Shape: Rectangle, Diamond, Ellipse, then the eight colours; Connector: Arrow, Line; other tools: none | `sk-wbbar` (sub-bar of `WhiteboardToolbar` preview) |
| **History** `role="toolbar"` "History" | bottom-left, 1rem | Undo, Redo (disabled when the library's stack is empty) | `sk-wbbar`, `sk-tool` |
| **Zoom** `role="toolbar"` "Zoom" | bottom-right, 1rem | Zoom out (−), the percentage (a button: "Reset zoom to 100 %"), Zoom in (+) · separator · Fit to screen, Minimap (toggle, `aria-pressed`) | `sk-wbbar`, `wb-zoom-v` |
| **Minimap** `role="img"` named "Minimap" with an interactive viewport (see below) | above the zoom bar, right-aligned, 0.5rem gap; 11.25rem × 7rem | the live elements as rectangles (an element whose fill is one of the eight colours — a sticky, or a shape recoloured from the bar — in that colour's swatch classes, any other element in `--muted-foreground` at 50 % opacity; bound texts are not drawn), the visible area as `sk-minimap-view` | `sk-minimap`, `sk-minimap-view`, `wb-mm-el` |
| **Selection bar** `role="toolbar"` "Selection" | under the selection's bounding box, centred on it, 0.75rem below; above it when there is no room below; kept 1rem inside the canvas | the eight colours (only when the selection has a filled shape) · separator · Group or Ungroup, Align (menu), Lock / Unlock (facilitator), Styles (§15 decision 2), Delete (destructive: icon and label in its tooltip, `--skrum-destructive-text`) | `sk-wbbar`, `wb-swatch`, `sk-vsep`, `sk-tool` |
| **Count chip** | on the top-left corner of the selection's box, above it | "1 element" / ":count elements" | `wb-selcount` |

Tool → library mapping: Selection → `selection`; Hand → `hand`; Sticky note → `{type: 'custom', customType: 'skrum-sticky'}`; Shape → the last of `rectangle` / `diamond` / `ellipse` (rectangle first); Connector → the last of `arrow` / `line` (arrow first); Text → `text`; Pencil → `freedraw`; Eraser → `eraser`; Frame → `frame`; Image → `image` (the library opens the file picker; uploads keep the rules of whiteboard spec §6.5). A tool chosen by the library itself (a native key such as D, O, A, L, K, or the end of a drawing that returns to the selection) is reflected in the bar: `toolOf(appState.activeTool)`; the laser pointer shows no active tool in the bar but "More tools" marks it.

**Sticky note tool.** While it is active, the canvas cursor is a crosshair and a press on the canvas adds a sticky of the chosen colour with its top-left corner under the pointer (`api.onPointerDown` gives the scene point), selects it and returns to the Selection tool (unless the tool is kept, "More tools" → "Keep the tool"). A press (pointer, Enter or Space) on a colour of its sub-bar adds a sticky of that colour in the middle of the view, as the sticky tool does today: the keyboard path. Arrow keys move the choice without adding.

**Selection bar behaviour.** Shown when at least one live element is selected, the board is in edit mode, no text is being edited, nothing is being dragged, resized or rotated, and no library dialog is open; hidden while the pointer drags (it would jitter). Colours recolour the filled shapes of the selection and become the next fill (the existing `recolorElements` + `postItAppState`). Group appears for two or more ungrouped elements, Ungroup for a selection that is one group. Align opens a menu: Align left, Align right, Align top, Align bottom, Distribute horizontally, Distribute vertically (the last two with three or more elements); "Centre" alignments stay in the property panel ("Styles"). Delete removes the selection (the library's delete: tombstones through the existing sync). "Styles" shows the library's property panel (stroke, background picker, fill style, stroke width, stroke style, sloppiness, edges, arrowheads, font, size, text align, opacity, layers, and the actions it holds) next to the tool bar, and hides it again; it is hidden by default.

**States** (each a Vitest case, the main ones a capture): tool active (`is-on`, `aria-pressed="true"`); hover (`--accent`); tooltip with the key (`Tooltip` + `Kbd`, e.g. "Sticky note N"); sub-bar open; undo / redo disabled (50 %); zoom at 10 % and at 3000 % (buttons disabled at the ends; the library's range, so a wheel zoom never falls outside it); minimap open / closed; selection of one element, of several, of a group, of a locked element (non-facilitator), of an element without fill (no colours); count chip; property panel shown; dark theme (tokens; the minimap's sticky colours, like the canvas, are the stored light values shown through the theme's canvas filter, so they match the notes); reduced motion (no transitions; "Fit" does not animate).

**Keyboard.** Each bar is one tab stop with roving `tabindex`; ↑/↓ in the vertical bar, ←/→ in horizontal ones; Home / End. Tool letters (V, H, R, T, P, E, F) are the library's own, answered while the canvas has the focus (as today); while the focus is in the tool bar, the same letters are answered by the bar. The keys the library does not have are ours: the sticky key N, C (Connector: the library has no C), M (minimap), each through `useShortcut` scoped to the board, never while a field or the canvas text editor has the focus. ⇧1 (fit) and ⌘/Ctrl + / − / 0, ⌘/Ctrl Z / ⇧Z stay the library's. Every single-character key of the board, the library's included, obeys the "single-key shortcuts" preference (§15 decision 7). The keyboard shortcuts dialog's Whiteboard section lists exactly these keys (it lists the library's today, and says "The whiteboard uses the shortcuts of its own toolbar.": that note goes).

### 9.2 Desktop board, view mode

Board locked for a non-facilitator (`viewOnly`), or the board opened in read mode: no tool bar, sub-bar, history or selection bar; the zoom bar and the minimap stay (pan and zoom are allowed). The status line "This board is locked." and the follow notices are unchanged (`board-notices.tsx`).

### 9.3 Phone (below `md`), MobileRituals frame 1

- **Read mode** (default): the existing `ReadModeLayer` ("Reading" pill and "Modifier"), the reactions bar (D-58: its own strip), and in the dock, before "Modifier", the mockup's "Fit to screen" (`scan`). The mockup's "Déplacer la vue" (hand) is not rendered: read mode can only pan, and a control with one state is not a control (P20-07). "Réagir" is the reactions bar; "Commentaires" is backlog. Minimap hidden.
- **Edit mode**: a horizontal bar docked at the bottom, centred (`sk-wbbar`, tools 2.75rem, `role="toolbar"` "Tools"): Selection, Sticky note, Pencil, then "…" opening a drawer with the other tools (Hand, Shape with its three kinds, Text, Eraser, Image; Connector and Frame are not offered under `md`, the mockup's "Pas de création de connecteurs sous 768 px"), Undo, Redo and Fit to screen. The library's mobile tool bar is hidden; its property panel stays reachable through the selection bar's "Styles". The sub-bar of the sticky tool opens above the bar. No minimap, no zoom bar (pinch zoom).
- The selection bar is the same component, horizontal, kept inside the screen.

### 9.4 Header and board menu

Unchanged except the board menu (`board-menu.tsx`), which takes the entries of the library's hamburger that is now hidden (§15 decision 3): "Save as image" (opens the library's image export dialog: `openDialog: {name: 'imageExport'}`), "Find on canvas" (opens its search: `api.toggleSidebar({name: 'default', tab: 'search'})`), "Canvas help" (the library's help dialog, `openDialog: {name: 'help'}`, whose link header is already hidden), "Clear canvas" (the library's confirmation), and a "Canvas background" sub-menu of radio items — the default paper (`CANVAS_LIGHT`) and the five picks of the library's own picker in 0.18.1 (`#ffffff`, `#f8f9fa`, `#f5faff`, `#fffce8`, `#fdf8f6`; canvas data, the exemption of ruling 36), local to the browser as today. The library's footer help button (bottom right) is hidden with the rest of its chrome; its dialog stays reachable through "Canvas help" and the `?` key while the canvas has the focus. The header's "Export" keeps opening the JSON export dialog. Guests and members see the same entries as today's hamburger offered them; nothing facilitator-only is added.

### 9.5 Other states

- **Loading** (canvas chunk not ready, `api === null`): no bar is rendered; the existing skeleton shows.
- **Reconnecting / offline**: bars unchanged (edits queue as today).
- **Board deleted or session ended** (`BoardGone`): no canvas, no bar.
- **Board full / rejected writes**: unchanged toasts.

## 10. Components

| Component | Folder | Kind |
|---|---|---|
| `WhiteboardToolbar` (tool bar and sub-bar, vertical or horizontal), `WhiteboardColorBar` (exists) | `components/skrum/whiteboard-toolbar.tsx` | presentational, extended |
| `WhiteboardZoomBar`, `WhiteboardMinimap`, `WhiteboardHistoryBar` | `components/skrum/whiteboard-view-controls.tsx` | presentational, new |
| `WhiteboardSelectionBar`, `WhiteboardSelectionCount` | `components/skrum/whiteboard-selection-bar.tsx` | presentational, new |
| `CanvasTools`, `CanvasView` (zoom, minimap, history), `CanvasSelection`, `PhoneToolbar` | `components/whiteboard/` | containers, new |
| `tools.ts`, `viewport.ts`, `minimap.ts`, `selection.ts`, `canvas-commands.ts` | `lib/whiteboard/` | pure logic, new |
| `sticky-tool.tsx` | `components/whiteboard/` | reduced to `stickyAt` and `addStickyAt` (no popover) |
| `canvas-colors.tsx`, `hooks/use-whiteboard-toolbar-slot.ts` | — | deleted |

## 11. Accessibility

- Names: tool bar "Tools", sub-bars "Sticky note colours" ("Fill colour" radiogroup inside, unchanged name), "Shapes", "Connectors"; "History"; "Zoom"; "Selection". Tool buttons: `aria-label` is the tool name, `aria-keyshortcuts` the key, the tooltip shows both ("Sticky note N"); `aria-pressed` on tools and on the minimap toggle.
- The percentage button's name is "Reset zoom to 100 %" with the current value as its text; a polite live region is not added (the value changes continuously while zooming with the wheel).
- The minimap is `role="img"` named "Minimap" with a description "Shows the whole board; the frame is the part you see."; it is also operable: a press or a drag moves the view (pointer), and for the keyboard its viewport frame is a focusable button "Move the view" whose arrow keys pan by 10 % of the visible area (no `role="application"`, no slider role).
- Contrast: active tool `--skrum-primary-text` on `--skrum-primary-soft` (≥ 4.5:1 in both themes, `ExcalidrawTheme` README), shortcut letter `--muted-foreground` on `--popover` (AA at 0.5625rem is not reached: the letter is decorative, `aria-hidden`, and the key is in the tooltip and in `aria-keyshortcuts`).
- Focus: `outline-2 outline-ring outline-offset-2` on every control.
- Reduced motion: no transition on bars; "Fit" and minimap moves are instant.

## 12. Error handling

Every helper over a library internal fails soft: when the control or the shortcut target it needs is missing (another library version), the action logs once to the console ("whiteboard: <helper> found no <selector>"), the control is rendered disabled, and the canvas keeps working. A Vitest case per helper proves the missing-target path.

## 13. Acceptance criteria

Each criterion names its proof: **V** Vitest (jsdom), **C** a capture of the final task (light, 1440, French) compared with the mockup, **S** the existing browser smoke test of the canvas, **P** a PHP test.

1. On a desktop board in edit mode, the library's tool bar, its zoom and undo controls and its hamburger are not visible, and the vertical tool bar, the history bar and the zoom bar with the minimap are, in the places of ScreenWhiteboard. (C)
2. The tool bar lists Selection, Hand, Sticky note, Shape, Connector, Text, Pencil, Eraser, Frame and Image in that order, each with its key letter, with the separators of the mockup; pressing one sets the matching library tool; a tool changed by the library (a native key, the end of a drawing) is shown active. (V)
3. With the Sticky note tool, a press on the canvas adds a sticky of the chosen colour with the sticky marker at that point, selected, and the tool returns to Selection; a press on a colour of its sub-bar adds one in the middle of the view; the sticky reaches another browser as any element does. (V for the element and the tool switch; S for the sync of a drawn element)
4. The Shape tool's sub-bar offers Rectangle, Diamond and Ellipse and the eight colours; the Connector's offers Arrow and Line; the last choice is kept for the page. (V)
5. Undo and Redo act on the library's history and are disabled exactly when the library's own buttons are. (V)
6. Zoom in and Zoom out step by 10 % around the centre of the view and stop at 10 % and 3000 %; the percentage shows the current zoom rounded and resets it to 100 % around the centre; Fit to screen shows every live element. (V)
7. The minimap draws every live element (bound texts excepted), those filled with one of the eight colours in that colour, and the visible area; a press on it centres the view there; it updates when another browser moves an element; its toggle is remembered in the browser. (V)
8. Selecting elements shows the selection bar under them (above them near the bottom edge, never outside the canvas) and the count chip ("1 element", ":count elements", bound texts not counted); dragging hides it; deselecting removes it. (V)
9. The selection bar's colours recolour the filled shapes of the selection and set the next fill; they are absent when nothing selected has a fill. (V)
10. Group / Ungroup, the four alignments, the two distributions and Delete do what the library's own commands do on the same selection. (V for the dispatched command; S for the stored result of one of them)
11. "Lock" / "Unlock" is shown to the facilitator only; a non-facilitator who selects a locked element sees colours and Delete disabled with the reason. (V)
12. "Styles" shows and hides the library's property panel beside the tool bar; every control of that panel works as before (stroke, background, fill, width, style, sloppiness, edges, arrowheads, font, size, align, opacity, layers). (V for the toggle; C for the panel's place)
13. Every entry of the library's former hamburger is in the board menu and opens the same dialog. (V)
14. A board locked for a non-facilitator, or in read mode, shows only the zoom bar and the minimap of the bars. (V, C)
15. A follower who zooms with the bar or moves the view with the minimap sees "Following paused · Resume"; "Resume" re-attaches. (V on `useWhiteboardFollow` with a fake API)
16. On a phone in read mode the dock shows "Fit to screen" and "Modifier"; in edit mode the bottom bar shows Selection, Sticky note, Pencil and "…", whose drawer holds the other tools offered on a phone, Undo, Redo and Fit; no minimap, no zoom bar; no connector or frame tool. (V)
17. Every bar is one tab stop with arrow-key navigation, Home and End; every tool's name, key (tooltip, `aria-keyshortcuts`) and pressed state are exposed. (V)
18. N (sticky note), C and M work while the canvas or a bar has the focus and never while a field, a dialog or the canvas text editor has it; with "single-key shortcuts" off, no single-character key does anything on the board, the library's included, and typing in the canvas text editor still works. (V)
19. The keyboard shortcuts dialog's Whiteboard section lists the board's keys as built, without the old note. (V)
20. A board created before this plan opens with the same scene and its stickies show their swatch selected in the selection bar. (V with a fixture of today's elements)
21. No new dependency; `npm run types:check`, `npm run check`, `npm run build:front` and `npm run test` pass; `@excalidraw/excalidraw` still loads only on the whiteboard page. (gates)
22. Every new key is in `lang/en.json`, `fr.json`, `es.json`, `de.json`, informal. (P: `TranslationKeysTest`, `InformalRegisterTest` on pgsql and sqlite)
23. The captures of the final task match ScreenWhiteboard and the WhiteboardToolbar mockup, apart from the deviation rows the owner approved; D-21 (toolbars) and D-49 are removed from the 18e table. (C, docs)
24. The whole PHP suite passes on the four engines and the Vitest suite passes at the final task (nothing in PHP changes; the run proves it). (gates)

## 14. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Hiding the library's chrome with CSS relies on 0.18.1 class names (`.App-toolbar-container`, the zoom and undo groups inside `.layer-ui__wrapper__footer-left` — not the whole group, which also holds the touch "Finalize" button —, `.layer-ui__wrapper__footer-right`, `.main-menu-trigger`, `.selected-shape-actions`, the mobile `.App-bottom-bar` tool row) | an upgrade brings the native chrome back on top of ours | every selector in `excalidraw-theme.css` under one commented block; `NativeChrome` (`canvas-commands.ts`) lists them; the version is pinned; a Vitest reads the library's CSS file from `node_modules` and fails when a selector is no longer in it |
| Commands driven by the library's shortcuts (group, align, distribute, delete, lock) or by clicks on its hidden buttons (undo, redo) | an upgrade changes a key or a test id | one table in `canvas-commands.ts`, a Vitest that the dispatched event matches the library's `keyTest` as read in 0.18.1, fail-soft (§12) |
| The library's keydown handler and ours on the same keys | a key doing two things | ours only on keys the library leaves free (N, C, M; S stays the library's, decision 1); a capture listener for the preference (decision 7) |
| The property panel shown beside our tool bar | overlap at small heights | panel placed with a left offset equal to the bar's width + 1rem; `max-height` already set by the library; capture at 1440 |
| The selection bar following a moving selection | jitter, cost | hidden during drags; position recomputed once per frame from `onChange` |
| Minimap cost on a 5 000-element board | slow frames | items recomputed only when the scene stamp changes (`sceneStamp`), drawn as one SVG, throttled to one frame |
| The bottom-centre reactions bar, the bottom-left history and the bottom-right zoom between 48rem and 64rem | overlap | minimap and zoom bar collapse to the zoom bar alone below `lg`; the reaction bar's offsets of `app.css` recomputed; no capture at those widths (owner's rule), proved by a Vitest of the layout classes only — a residual risk |
| The browser walkthroughs `Plan17a`–`Plan17c`, `Plan18eWhiteboardTest` click the library's tool bar, menu and zoom buttons | they go stale | not edited or run (owner's rule); listed in the report; the shared helper `selectWhiteboardTool` of `tests/Browser/Support/InteractsWithWhiteboards.php` and the visual test are updated, since the smoke test and the captures use them |
| Excalidraw's hint line ("Click to start…") lives in the hidden tool bar island | the hints disappear | deviation row P20-08; the shortcut dialog and tooltips carry the help |

## 15. Decisions for the owner

**Answered by the owner on 2026-10-03: option A for each of the seven questions, the recommended option on which the plan was written.** The other options are kept below for the record; none of them applies.

| # | Answer |
|---|---|
| 1 | A — N everywhere |
| 2 | A — "Styles" shows the library's panel, themed, beside the tool bar; hidden by default |
| 3 | A — hamburger hidden; its entries in the board menu, with a "Canvas background" sub-menu |
| 4 | A — Shape and Connector sub-bars, "More tools" (laser, keep the tool, pen mode) |
| 5 | A — MobileRituals' compact bottom bar and its drawer |
| 6 | A — open by default from `lg`, remembered per browser |
| 7 | A — with the preference off, every single-character key is swallowed before the library sees it, except while text is being typed |

Each question is a product choice the mockups and the standing rules do not settle.

1. **The sticky note's key.** ScreenWhiteboard writes "Post-it (S)"; WhiteboardToolbar and KeyboardShortcuts write N. In Excalidraw 0.18.1, S with a selection opens the stroke colour picker (and ⇧S is the stroke eyedropper).
   - A. **N** everywhere (two mockups of three; no clash with the library). *Recommended.*
   - B. S as ScreenWhiteboard, taking the key from the library (its stroke picker stays reachable through "Styles").
   - C. Both S and N.
2. **The library's property panel** (stroke, fill style, width, sloppiness, edges, arrowheads, font, size, text align, opacity, layers, centre alignments). The mockup's selection bar has no place for them; dropping them loses features.
   - A. A "Styles" button in the selection bar shows the library's panel, themed, beside the tool bar; hidden by default. *Recommended* (keeps everything, small).
   - B. Rebuild these controls in a "Styles" popover of our own (about six more tasks; every control re-implemented over `updateScene`).
   - C. Keep the library's panel always shown on a selection, as today (no button; the mockup's clean canvas is not met).
3. **The library's hamburger menu** (Export, Save as image, Find on canvas, Help, Clear canvas, Canvas background). The mockup has none.
   - A. Hidden; its entries move into the board menu of the header ("Save as image", "Find on canvas", "Canvas help", "Clear canvas", a "Canvas background" sub-menu; "Export" is already the header's button). *Recommended.*
   - B. Kept, themed, at the top left above the tool bar.
   - C. Hidden, and only "Save as image" and "Find on canvas" moved (Clear canvas and Canvas background dropped).
4. **Tools the mockup's bar does not show** (Diamond, Ellipse, Line, laser pointer, "keep the tool active", the stylus pen mode).
   - A. Diamond and Ellipse in the Shape sub-bar, Line in the Connector sub-bar, and a "More tools" button at the end of the bar with Laser pointer (K), Keep the tool (Q) and, when a stylus is detected, Pen mode. *Recommended* (ten visible tools, as the README asks; nothing lost).
   - B. Sub-bars only; laser, keep-tool and pen mode by keyboard only (listed in the shortcuts dialog).
   - C. Sub-bars only; laser, keep-tool and pen mode dropped.
5. **Phone edit mode.**
   - A. MobileRituals' compact bottom bar (Selection, Sticky note, Pencil, "…") with the drawer of §9.3; the library's mobile tool bar hidden. *Recommended.*
   - B. Keep the library's own mobile UI in edit mode (a deviation from the mockup on the phone).
6. **The minimap's default.**
   - A. Open by default from `lg`, its toggle remembered per browser. *Recommended* (the mockup shows it open).
   - B. Closed by default, remembered per browser.
7. **Single-character keys and the "single-key shortcuts" preference** (WCAG 2.1.4). Today the library's letters (V, R, T, P, 1–9…) ignore the preference.
   - A. With the preference off, the board swallows every single-character key before the library sees it (a capture listener on the canvas wrapper), except while text is being typed. *Recommended* (the preference then means what it says).
   - B. Only our own keys (N, C, M) obey it; the library's stay on (a deviation recorded as accepted).

## 16. Deviations expected (to approve before the screens are built)

Status of every row: **to approve by the owner** (not asked yet; the answers of §15 do not approve them).

Reasons as in plan 18e: **F** false or unsafe, **A** accessibility, **N** no such data or concept, **S** this spec, **O** an owner's answer.

| # | Mockup element | Built | Reason |
|---|---|---|---|
| P20-01 | Topbar "Commentaires"; selection bar "Convertir en actions"; author line on stickies; "Suivre Camille"; "is typing" ring | not rendered, no place reserved | O: backlog (former plan 28) |
| P20-02 | Canvas content drawn by the mockup (SVG shapes, `wb-sel` frame with eight handles and rotation dot) | the library's canvas and selection frame, themed in `--primary` | S §3 |
| P20-03 | "Post-it (S)" (ScreenWhiteboard) | "Sticky note (N)" | O: decision 1 |
| P20-04 | No "Styles" in the selection bar | "Styles" (decision 2) | O / parity |
| P20-05 | No sub-bars for shapes and connectors; no "More tools" | Shape and Connector sub-bars, "More tools" (decision 4) | O / parity |
| P20-06 | Align icon alone | a menu of six commands (the mockup's icon opens it) | S: one icon cannot be six commands |
| P20-07 | Phone read dock: "Déplacer la vue", "Réagir", "Commentaires" | "Fit to screen" and "Modifier" in the dock; reactions keep their own strip (D-58); no hand (read mode only pans); comments backlog | O: D-58; N |
| P20-08 | ExcalidrawTheme's centred hint line | not shown (it lives in the library's hidden tool bar) | S §5 rule 3 |
| P20-09 | WhiteboardToolbar README: zoom 10 %–400 % | 10 %–3000 %, the library's range (a wheel zoom reaches it anyway) | F: a bar that stops at 400 % while the canvas is at 900 % would show a false state |
| P20-10 | Minimap shown at every width (desktop frame) | from `lg` (64rem) only; below, the zoom bar alone | A: no overlap with the reactions bar (§5 rule 4) |

## 17. Not determined by reading

- Whether every hidden-chrome selector of §14 and every command of `canvas-commands.ts` behaves in a real browser as the 0.18.1 source read for this spec says (keydown handler on the container, `actionManager.handleKeyDown` with no `isTrusted` check, `[data-testid="button-undo"]` with `disabled`, `setActiveTool({type: 'image'})` opening the picker, `{type: 'custom'}` with `onPointerDown`): Task 1 of the plan re-reads the source and the final task's captures and smoke test exercise them; no walkthrough will.
- The exact place of the library's property panel once moved beside the tool bar at heights under 900 px.
- Whether the owner counts `tests/Browser/Smoke/WhiteboardHarnessTest.php` as a walkthrough (the plan updates its helper and runs it once in the capture task; it is not in `tests/Browser/Walkthroughs`).
