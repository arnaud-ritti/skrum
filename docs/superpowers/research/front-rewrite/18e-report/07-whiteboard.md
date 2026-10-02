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
