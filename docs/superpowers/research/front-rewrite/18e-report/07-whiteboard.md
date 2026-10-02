# Group 7 — Whiteboard

## Task 7.1 — Guest join

### Parity (brief 07 §3, rows 56–61)

| # | Action | New control | Done |
|---|---|---|---|
| 56 | Join: name and submit | `GuestJoinPage` (`kind="whiteboard"`): `#name` ("Your nickname"), prefilled with `suggestedName`; "Join" posts `{ name }` to `whiteboards.join.store` | yes |
| 57 | Join: validation error | the shared `errors.name` is shown under the field (`role="alert"`); "Join" is disabled until the name is edited | yes |
| 58 | Join: invalid link (HTTP 404) | `AccessNotice` with "Join a whiteboard" and "This guest link is no longer valid.", no form | yes |
| 59 | Already a member → redirect; 429 | server only, unchanged | yes |
| 60 | Head title | `<Head>` in the page: the board title, or "Join a whiteboard" for an invalid link | yes |
| 61 | Guests see no team link | the page has no link but "Log in" | yes |

Added by rule 13 (M28): the session card shows "Live", the number of participants and "… facilitates" (prop `session` of B45); the join button is pinned to the bottom of the card below 768 px.

The brief's `components/whiteboard/guest-join-form.tsx` is not written (K2): the page uses the shared `GuestJoinPage`.

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| Avatar colour picker | `takenColors` (and `initialPresence`) of `skrum/GuestJoin`; `GuestJoinPage` does not pass them | GU-1 |
| Short session code | `session.code` of `skrum/GuestJoin` | GU-2 |
| Random nickname ("Loutre pensive", "Another random nickname") | `defaultName`, `onRandomName` of `skrum/GuestJoin` | no roadmap row: reported |

### Differences with the mockup

| Difference | Row |
|---|---|
| No colour picker, no short code | D-32 |
| The button reads "Join", the mockup "Rejoindre la session" | browser contract: `joinAsGuest` clicks "Join" (plan, Task 7.1 "Browser tests changed: none") |
| No suggested random nickname: with an empty field the preview shows the generic avatar and the sentence "Suggested nickname if you leave it empty" without a name | no row: reported (the server has no random name for a whiteboard; the sentence comes from `skrum/GuestJoin`) |
| The logo appears twice: in the header of the centred `AuthLayout` and in the card | no row: reported (Task 0.7 frame; the mockup shows the card alone) |
| A language select in the header, "Powered by Skrüm" in the footer | no row: the centred `AuthLayout` of Task 0.7 |
| Invalid link: a notice card, not in the GuestJoin mockup | brief 07 "No mockup" list; `AccessNotice` of Task 0.7 |

### Captures

`tests/Browser/Visual/WhiteboardVisualTest.php`: `whiteboard-join-*` and `whiteboard-join-invalid-*` (light and dark, 390 and 1440, EN and FR), taken on the real page.

## Task 7.2 — Board chrome on the session shell

### Parity (brief 07 §3, rows 1–5, 14–16, 30–43, 53, 55)

| # | Action | New control | Done |
|---|---|---|---|
| 1 | Lazy canvas, skeleton, error and Retry | `pages/whiteboards/show.tsx`: the skeleton and the error render inside `SessionLayout` with the board title; the error is an `EmptyState` ("The canvas could not be loaded.", "Retry") | yes |
| 2 | Page title | `<Head title>` in the page | yes |
| 3 | Back to the team | `SessionTitle` `backHref`: `a[aria-label="Back to the team"]`; absent for a guest | yes |
| 4 | Board title | the page's `h1`, truncated; the facilitator renames it in place (M21) | yes |
| 5 | Who is online | `SessionPresence`: five avatars and the counter, the counter alone below 640 px; presence colour from `presence-slot.ts` | yes |
| 14 | Send a reaction | `SessionReactions` (`.whiteboard-reactions`, no digit shortcuts, compact below 768 px) | yes |
| 15 | Receive a reaction with the sender's name | the `.lr-overlay` layer of `SessionReactions`, origin at the sender's avatar | yes |
| 16 | Reactions off: bar unmounted | `BoardReactions` returns nothing; key `boardId:channelKey` kept | yes |
| 30 | Start a timer, 1 / 3 / 5 / 10 min | `SessionTimer` in the `start` slot of `FacilitatorBar` (7-D5): `[aria-label="Timer"]`, five menu items | yes |
| 31 | Stop timer | same menu; disabled without a timer | yes |
| 32 | Countdown for everyone | facilitator: in the facilitation bar; others: the header's `timer` slot | yes |
| 33 | "Time's up!" toast and beep, once | `useTimerAlarm` of `SessionTimer`; the pill shows `0:00` and is named "Time's up!" (X4) | yes |
| — | "+2 min" (B20) | `SessionTimer` `onExtend` posts to `whiteboards.timer.extension.store`; shown to the facilitator while a timer runs | yes |
| 34 | Lock / unlock | `FacilitatorBar` toggle "Lock the board" / "Unlock the board", `aria-pressed` | yes |
| 35 | Bring everyone to me | `FacilitatorBar` toggle, `aria-pressed` | yes |
| 36 | Facilitation tools for the facilitator only | `BoardFacilitation` is rendered for `me.isFacilitator`: in the header from 768 px, in a strip under it below | yes |
| 37 | Status: locked | `BoardNotices`, a `div[role="status"]` | yes |
| 38 | Status: leading, following, paused and Resume | `BoardNotices` | yes |
| 39 | Pause by pan or zoom | `use-whiteboard-follow`, unchanged | yes |
| 40 | "Reconnecting…" | `SessionShell` (`kind="whiteboard"`): the compact state in the topbar and the banner with the whiteboard sentence | yes |
| 41 | Session expired | `SessionShell`: alert banner with "Reload", content `inert` | yes |
| 42 | Board deleted / access ended | `BoardGone`: `EmptyState` in `SessionLayout`, "Back to the team"; no realtime root | yes |
| 43 | Rejection toasts | `board.tsx`, unchanged | yes |
| 53 | Realtime attribute and scene stamp | `SessionShell` root: one `[data-realtime]`, `data-scene` through `rootRef` | yes |
| 55 | Share | `BoardShare` on `ShareDialog`: the only place of the guest link (7-D2). Facilitator: "Allow guests" (`#whiteboard-guest-access`), "Copy link", the QR code, "Create a new link" with its confirmation. Member: the link, "Copy link" and the QR code. Guest: no Share button | yes |
| 11 | Export | header button "Export" opens the canvas's export dialog ("Download board data"); the native menu entry stays (M21) | yes |
| 26–28 | Guest link in the board menu | removed from the menu in this task (7-D2); the rest of the menu is Task 7.3 | yes |

Cursor colours come from the presence tokens (7-D6): `presenceCursorColor` reads `--skrum-presence-N` of the member's slot, the same slot as the avatar.

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| "Comments" button, before "Export" | `comments` of `BoardActions` (`board-header.tsx`) | WB-2 |
| "Follow :name" pill | `follow` of `BoardPresence` (`board-header.tsx`), rendered next to the stack; the stack's popover has no slot yet (`skrum/PresenceStack`) | WB-3 |
| Rebuilt tool bar, selection bar, zoom, minimap | the `.whiteboard-canvas` wrapper keeps the whole area under the header and the notices | WB-1 |

### Differences with the mockup

| Difference | Row |
|---|---|
| Excalidraw's own tool bar, zoom and history; no selection bar, minimap, dot grid, comments, sticky authors, "is writing" ring | D-21 |
| The topbar has the application rail and a back arrow, not the logo and the breadcrumb "team › Whiteboards › name": the title alone is shown and renamed in place | no row: the session frame of Task 0 (`SessionFrame`, `SessionTitle`); the snapshot has no team name. Reported |
| No "Synced" state while connected: the topbar state appears only while reconnecting | no row: `ConnectionState` renders nothing when connected (its README: "invisible when all is well"). Reported |
| The facilitation tools (timer, lock, follow) sit in the header between the presence stack and the separator; a board menu follows "Share"; a reaction bar floats at the bottom | brief 07 §6 "no mockup": existing features |
| Below 1024 px "Export" and "Share" are icon buttons; below 768 px "Export" is not in the header (the canvas menu has it) and the facilitation tools are a strip under the header | header budget of Task 0.14 |
| Phone: no "Reading" pill, no "Edit" button, no "Follow" pill, no subtitle "Whiteboard · n online" | Task 7.5; WB-3 |
| Dark theme: sticky colours are the canvas's filtered colours | Task 7.4 (`ExcalidrawTheme`) |

### Captures

`tests/Browser/Visual/WhiteboardVisualTest.php`: `whiteboard-board-*` (the facilitator) and `whiteboard-board-locked-guest-*` (a guest, locked board, finished timer), light and dark, 390 and 1440, EN and FR, taken on the real page. The overflow check leaves out Excalidraw's own tool bar: at 390 px, with the sticky tool in it, its last trigger is clipped by the library's island (same before this task).

## Task 7.3 — Board menu and dialogs

### Parity (brief 07 §3, rows 17–29)

| # | Action | New control | Done |
|---|---|---|---|
| 17 | Open the board menu | `BoardMenu`: outline icon button `[aria-label="Board menu"]` ("…") at the end of the header, `DropdownMenu` of the wide size; every action has its icon, groups are separated, the deletion is last | yes |
| 18 | Hide my cursor | checkbox item, first entry, for everyone | yes |
| 19 | Rename | menu item → `RenameBoardDialog` (`FormDialog`, "Save"): field "Title", `maxLength` 120, required, starts from the current title; closes on success only. The in-place rename of the header (M21) stays | yes |
| 20 | Take control | menu item, for `canTakeControl` with a user id | yes |
| 21 | Hand over facilitation | menu item → `HandOverDialog` (`FormDialog`, "Hand over"): select `#whiteboard-new-facilitator`; "Hand over" is disabled until someone is chosen; with no candidate the dialog has no submit button and says "No one else can facilitate this board yet." | yes |
| 22 | Duplicate this board | menu item, not for a guest; opens the copy | yes |
| 23 | Save as template | menu item, not for a guest → `SaveTemplateDialog` (`FormDialog`, "Save"): "Name" (80, required) and "Description" (300); a refused field shows its message under the field; toast "Template saved." | yes |
| 24 | Show live cursors | checkbox item, facilitator | yes |
| 25 | Show flying reactions | checkbox item, facilitator | yes |
| 26–28 | Guest link | not in the menu (7-D2): the Share dialog of Task 7.2 | yes |
| 29 | Delete this board | menu item, `canDelete` → `DeleteBoardDialog` (`ConfirmDialog`, destructive, `role="alertdialog"`): "Delete this board?", "Everything on it is removed for everyone."; then the team page | yes |

Changed on purpose: a refusal of a dialog's request (rename, hand over, save as template when it is not about a field, delete) is shown inside the dialog, above its footer (`error` of `FormDialog` / `ConfirmDialog`, as the Dialog mockup's error state), not in a toast. The direct menu actions (take control, duplicate, the two settings) keep their toast.

### Places left

None: the mockup has no element in the menu or in these dialogs that a later plan builds.

### Differences with the mockup

| Difference | Row |
|---|---|
| The ScreenWhiteboard mockup has no board menu: its topbar ends with "Share". The menu holds existing features and follows the DropdownMenu mockup (icon on every action, separators edge to edge, destructive entry last) | brief 07 §6 "no mockup": existing features |
| No section labels and no shortcuts in the menu | the DropdownMenu mockup shows them on a card menu; this menu has no shortcut and its groups are short. No row: reported |
| Hand-over dialog: the select opens empty, without a placeholder | same as before; no mockup of this dialog |
| At 390 the footer of a dialog stacks its buttons full width, the main action first | the Dialog primitive of plan 18c |

### Captures

`tests/Browser/Visual/WhiteboardVisualTest.php`: `whiteboard-board-menu-*`, `whiteboard-board-save-template-*`, `whiteboard-board-hand-over-*`, `whiteboard-board-delete-*` (the facilitator, light and dark, 390 and 1440, EN and FR), taken on the real page. The `whiteboard-board-*` captures change by the menu trigger's icon only.

## Task 7.4 — Eight-colour sticky notes and colour bar

### Parity (brief 07 §3, rows 8–9, 11, 50, 52, 54)

| # | Action | New control | Done |
|---|---|---|---|
| 8 | Add a sticky note, with its colour | `StickyTool`: the trigger `button[aria-label="Sticky note"]` in the canvas's shapes toolbar opens the eight colours (`WhiteboardColorBar`, radiogroup "Fill colour", Sun … Moss) as the sub-bar of the tool. A press on a colour adds a 200 × 200 note in the middle of the view, selected; the arrow keys move the choice without adding, and the choice is kept for the next note. Fill and border are the literal light values of the colour (7-D1, 7-D4); the marker `customData.skrum.kind = 'sticky'` is unchanged | yes |
| 9 | Sticky button when the toolbar slot is absent | same condition in `board.tsx`: the outline button "Sticky note" in the header actions, hidden in view mode | yes |
| 11 | Export dialog "Download board data" | `scene-export.tsx`: same file and name, shown as a card (icon, sentence, button) | yes |
| 50 | Canvas background | `initialData.appState.viewBackgroundColor = CANVAS_LIGHT`, local to the browser, not synced; the library inverts it in the dark theme | yes |
| 52 | Sticky tool in the shapes toolbar | `use-whiteboard-toolbar-slot`, unchanged | yes |
| 54 | Colour bar for new shapes and for the selection (7-D3) | `CanvasColors` under the tool bar: shown for the rectangle, diamond and ellipse tools and for a selection that holds such a shape. A colour recolours the selected filled shapes (fill and border, version bumped, one undo step) and becomes the fill of the next ones. The checked radio is the colour of the selection, or of the next shape; none is checked for a fill outside the eight or a selection of several colours. Hidden in view mode, while a dialog of the canvas is open, and while the sticky tool's colours are open (one radiogroup at a time). The wrapper class `skrum-whiteboard--fallback-colors` hides the canvas's quick picks; its colour picker ("more colours") stays | yes |

A new filled shape is a Sun note with the Sun border (`ExcalidrawTheme` README). The current stroke follows the tool (`strokeForTool`): the border of the fill for rectangle, diamond and ellipse, Excalidraw's default stroke for every other tool. A stroke the user chose in the picker is left alone.

Dead code removed: `StickyColors` (the six old hex), `CanvasDarkFilterClass`, `RequiredApi`, `RequiredProps` and the unused type re-exports of `lib/whiteboard/excalidraw.ts`.

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| "Convert to actions" on a selection (and the other actions of the mockup's selection bar) | `selectionActions` of `CanvasColors` (`canvas-colors.tsx`), rendered after the colours in the same floating row | WB-5 |
| Author of a sticky | no region of this plan's chrome: the author is drawn on the note by the canvas. The server already stores `author_member_id` per element, and `stickyAt` (`sticky-tool.tsx`) is the one place a note is built | WB-4 |

### Differences with the mockup

| Difference | Row |
|---|---|
| The colour bar is alone under the tool bar: no "n elements" counter, no group / align / lock / convert / delete beside it (the canvas's own panel has them) | D-21 |
| The colour bar sits under the canvas's hint line, 6rem from the top of the canvas, not right under the tool bar: the library writes its hint there | D-21 (the library's tool bar is kept) |
| The canvas's property panel keeps its "Stroke" and "Background" rows, each reduced to its picker button (and the library's separator before it); the picker still offers the library's own colours. The mockup shows the eight swatches inside the panel | no row: answer 7-D3 and the README's fallback ("hide the native picks and show the sub-bar"). Reported |
| The mockup's sub-bar of the sticky tool shows five colours; built: the eight | answer 7-D1 |
| A new filled shape has the border of its colour and lines, arrows, pencil and text keep the default stroke. The README's snippet sets the Sun border as the current stroke for every tool, which would write text and lines in a pale yellow that cannot be read | A (contrast); the README's own line "free strokes: `--foreground`". Reported |
| `currentItemFontFamily: 5` is not set: it is the library's default in 0.18.1 | none needed |
| The swatches of the bar are the theme tokens; in the dark theme the canvas shows the stored light colours through the library's filter, so a swatch and its note differ slightly | `ExcalidrawTheme` README ("the dark canvas is derived") |
| Sticky notes keep sharp corners and no author | D-21 (WB-4) |

### Captures

`tests/Browser/Visual/WhiteboardVisualTest.php`: `whiteboard-board-colors-*` (the rectangle tool: the colour bar and the canvas's panel without its quick picks) and `whiteboard-board-sticky-colors-*` (the colours of the sticky tool) and `whiteboard-board-export-*` (the export card; at 390 in French its button label is cut with an ellipsis), the facilitator, light and dark, 390 and 1440, EN and FR, taken on the real page. The earlier `whiteboard-board-*` captures change by the canvas background.
