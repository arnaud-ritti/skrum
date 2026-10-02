# Brief 07 — WHITEBOARD (plan 18e, screen group 7)

Read-only research, nothing run (no build, no test, no browser). Sources read: spec §4–§10, inventory-pages (whiteboards/show, join), inventory-components (Part F), notes-for-18e, mockups ScreenWhiteboard / MobileRituals / ExcalidrawTheme / WhiteboardToolbar READMEs, all old files of the group, `skrum/` components used, the four Plan17 walkthroughs + `InteractsWithWhiteboards`. Not verified: the real DOM of Excalidraw 0.18.1 in a browser; `scene-sync.ts` internals beyond the inventory (they are kept as they are); `tests/Browser/Visual/AdminPagesVisualTest.php` (shape for the new visual test); the mobile header at 390px.

## 1. Scope

| Item | Value |
|---|---|
| Pages | `pages/whiteboards/show.tsx` (GET `whiteboards/{board}`, `whiteboards.show`), `pages/whiteboards/join.tsx` (GET/POST `whiteboards/join/{guestToken}`, `whiteboards.join.show` / `.store`) |
| Layout | show: `SessionLayout` (`layouts/skrum/session-layout.tsx`, member = collapsed sidebar, guest = no sidebar). `app.tsx` keeps `null` for `whiteboards/show`: the page wraps itself in `<SessionLayout>` (same pattern as `pages/about.tsx`). join: no layout (`GuestJoin` is its own card); `app.tsx` line `name === 'whiteboards/join'` moves from `AuthLayout` to `null` (see §10, shared). |
| Props | unchanged: `{ snapshot: WhiteboardSnapshot }`; join `{ isInvalid: true } \| { isInvalid: false, guestToken, boardTitle, suggestedName }` |
| Mockups | ScreenWhiteboard (desktop, FR only), MobileRituals first phone (read mode + compact dock), ExcalidrawTheme (theme + 8-colour palette + fallback colour bar), WhiteboardToolbar (colour sub-bar only; the tool bar is NOT rebuilt, spec §6.4), GuestJoin (join) |
| Kept as they are | `lib/whiteboard/{scene-sync,restore,scene-stamp,files,types,appearance,palette}.ts`, `hooks/use-whiteboard{,-channel,-cursors,-follow,-request,-toolbar-slot}.ts`, `lib/retro/api.ts` (`retroRequest`), `lib/realtime/*`, `hooks/use-countdown.ts`, `css/excalidraw-theme.css` (already identical to the README map, imported by `lib/whiteboard/excalidraw.ts:3`) |
| Already built (18c) | `skrum/whiteboard-toolbar.tsx` = `WhiteboardColorBar` + `useColorNames` only (radiogroup "Fill colour", 8 radios named Sun…Moss, `data-color`); `lib/whiteboard/palette.ts` (`POSTIT`, `CANVAS_LIGHT`, `recolorElements`, `postItAppState`); `.skrum-whiteboard--fallback-colors` rule in `excalidraw-theme.css`; dev section `pages/dev/sections/whiteboard-theme.tsx` |

## 2. Commits (order matters: each leaves the build green)

| # | Commit | Rewritten / new | Deleted |
|---|---|---|---|
| 7.1 | `feat(whiteboard): guest join on GuestJoin` | `pages/whiteboards/join.tsx`; new `components/whiteboard/guest-join-form.tsx`; `app.tsx` join case → `null`; lang keys | nothing (old page body replaced; `Heading`, `InputError` stay used elsewhere) |
| 7.2 | `feat(whiteboard): board chrome on the session frame` | `pages/whiteboards/show.tsx` (SessionLayout), `components/whiteboard/board.tsx`, new `board-header.tsx`, `board-timer.tsx`, `board-facilitation.tsx`, `board-notices.tsx`, `board-share.tsx`, rewritten `board-reactions.tsx`, `board-gone.tsx`; CSS rules of app.css for the new reactions wrapper; `Plan17c` timer test; lang | `top-bar.tsx`, `status-bar.tsx`, `facilitator-bar.tsx` |
| 7.3 | `feat(whiteboard): board menu and dialogs on the new primitives` | rewritten `board-menu.tsx`; new `board-dialogs.tsx` (rename, hand over, save template, delete) | `hand-over-dialog.tsx`, `save-template-dialog.tsx` |
| 7.4 | `feat(whiteboard): eight-colour sticky notes and colour bar` | rewritten `sticky-tool.tsx`; new `canvas-colors.tsx`; `board.tsx` (initialData appState, wrapper class); `scene-export.tsx` restyle; app.css; `Plan17*` + helper sticky changes | dead exports `RequiredApi`, `RequiredProps` and unused re-exported types in `lib/whiteboard/excalidraw.ts`; `StickyColors` (old six hex); `StickyColors` consumers |

Not deleted by this group (shared with retro/poker/games, deleted by the last group that stops using them or by 18g): `components/retro/{timer-display,presence-strip,connection-banner,session-expired-banner,emoji-picker}.tsx`, `components/realtime/flying-reactions.tsx` (see §9 R1).

## 3. Parity table (old front → new front)

Hook column: selector / id / accessible name that a Plan17 test or helper binds to. "=" means unchanged.

| # | Action / behaviour | Old control (file) | Route / event | New component and control | Hook to preserve | Note |
|---|---|---|---|---|---|---|
| 1 | Lazy-load canvas, skeleton, error + Retry | `show.tsx` (Suspense, `ChunkBoundary`, `CanvasError`) | client | same in `show.tsx`, inside `SessionLayout`; `Skeleton` fills `main`; error = `EmptyState` + `Button` "Retry" | text "The canvas could not be loaded.", "Retry" | `ChunkBoundary` swallows render errors too: keep |
| 2 | Page title | `<Head title={board.title}>` | — | same | — | |
| 3 | Back to the team | `top-bar.tsx` icon link | Inertia visit `links.team` | `Button asChild variant="ghost" size="icon"` + `Link` in `SessionFrame` `title` slot, before the title | `a[aria-label="Back to the team"]` | null for guests: not rendered |
| 4 | Board title shown | `top-bar.tsx` h1 | — | `title` slot: `Breadcrumb` (team link › title) is NOT possible for guests (no team URL): render title text, truncate | — | mockup "editable breadcrumb" = rename, see #19 |
| 5 | Who is online | `PresenceStrip` | presence `here/joining/leaving` | `skrum/PresenceStack` in `presence` slot; adapter §4 | `[role="group"][aria-label="N online"]`, `header img[data-presence-id][alt="Name"]` | stack shows `max` avatars; popover lists the rest. `data-presence-id` feeds `avatarOrigin` |
| 6 | Draw/edit/move/delete/undo, all native tools | `<Excalidraw onChange>` | `PUT whiteboards/{board}/elements` | unchanged `sceneSync.handleChange` | `.whiteboard-canvas`, `canvas.excalidraw__canvas.interactive`, `[data-testid="toolbar-*"]`, `.App-toolbar label:has(...)` | native toolbar kept (single model) |
| 7 | Add / load image | native + `files.ts` | `POST/GET whiteboards/{board}/files` | unchanged | — | |
| 8 | Add sticky (colour choice) | `sticky-tool.tsx` DropdownMenu of 6 hex | client `updateScene` | popover with `WhiteboardColorBar`, trigger injected in toolbar slot; commit 7.4 | trigger `button[aria-label="Sticky note"]`; colour control name changes (see §8) | `customData.skrum.kind='sticky'` marker unchanged (server `is_sticky`) |
| 9 | Sticky fallback button when toolbar slot absent | `board.tsx:187` | — | same condition, `Button variant="outline" size="sm"` in header `actions` | `button[aria-label="Sticky note"]` | hidden when `viewOnly` |
| 10 | Lock/unlock an element | native context menu, hidden for non-facilitators by CSS | element PUT, reject `locked` | unchanged; CSS kept verbatim | `.context-menu li[data-testid="toggleElementLock"]`, `unlockAllElements`, `.whiteboard-canvas[data-facilitator]` | `data-facilitator` stays on `.whiteboard-canvas` |
| 11 | Export dialog "Download board data" | `scene-export.tsx` in `UIOptions.canvasActions.export.renderCustomUI` | client | same logic, restyled with `Button` | `[data-testid="json-export-button"]`, `.ImageExportModal button[aria-label="Export to PNG"/"Export to SVG"/"Copy PNG to clipboard"]`, file `{title}.whiteboard.json` | no top-bar "Export" button (mockup): native menu covers it, §6 |
| 12 | Main menu limited to 7 entries | `board.tsx` `<MainMenu>` | client | unchanged | `[data-testid="main-menu-trigger"]`, `[data-testid="help-menu-item"]`, no `a[href]` | |
| 13 | Hide library button, help header, search tabs, extra tools after laser | app.css `.excalidraw .default-sidebar-trigger…` | CSS | unchanged | P17a-09, P17c-07, P17b-22 | |
| 14 | Send flying reaction (6 quick + picker) | `FlyingReactions` toolbar | whisper `client-reaction` | `skrum/ReactionBar` (floating, `className="whiteboard-reactions"`, `shortcuts={false}`) fed by `live-reactions` `useReactions` | `.whiteboard-reactions[role="toolbar"][aria-label="Reactions"]`, 6 × `[aria-label^="Send a reaction "]`, `[aria-label="Send a reaction 👍"]`, bar centred, bottom 0–40px | picker slot = `skrum/ReactionPicker` (frimousse) |
| 15 | Receive flying reaction with sender name, from avatar | `LiveReactions` overlay | whisper | keep `LiveReactions` overlay (not `ReactionBar.incoming`) | `.lr-overlay` contains emoji + sender name | see R1 |
| 16 | Reactions off → bar unmounted, incoming dropped | `BoardReactions` | `board.reactionsEnabled` | same | `assertNotPresent` bar after switch off | key `boardId:channelKey` kept |
| 17 | Open board menu | `board-menu.tsx` icon button | client | `DropdownMenu` + `Button size="icon" variant="outline"` in header `actions`, `aria-label="Board menu"` | `[aria-label="Board menu"]`, `[role="menu"]` | `openWhiteboardMenu` asserts no `[role="menu"]` before: any popover must be closed |
| 18 | Hide my cursor | checkbox item | `localStorage skrum.hideMyCursor` | `DropdownMenuCheckboxItem` | `[role="menuitemcheckbox"]:has-text("Hide my cursor")` | |
| 19 | Rename | menu item + Dialog | `PATCH …/settings {title}` + refetch | `FormDialog` (submit "Save"), `Input aria-label="Title" maxLength=120 required` | menu item "Rename" | closes only on success (FormDialog `run`) |
| 20 | Take control | menu item (`canTakeControl && userId`) | `PUT …/facilitator {user_id}` + refetch | same | `[role="menuitem"]:has-text("Take control")` | |
| 21 | Hand over facilitation | `HandOverDialog` | `PUT …/facilitator`, refetch | `FormDialog` title "Hand over facilitation", submit "Hand over", `Select` id `whiteboard-new-facilitator`; empty state "No one else can facilitate this board yet." | `#whiteboard-new-facilitator`, `[role="listbox"] [role="option"]:has-text("Max Member")`, `[role="dialog"] button:text-is("Hand over")`, `button:text-is("Cancel")` | with no candidate: no submit button (FormDialog needs `submitLabel`: render `ConfirmDialog`-less `Dialog` or `unavailableMessage`, see R5) |
| 22 | Duplicate this board | menu item | `POST …/duplicate` → `router.visit(url)` | same, `!me.isGuest` | `[role="menuitem"]:has-text("Duplicate this board")` / FR "Dupliquer ce tableau" | |
| 23 | Save as template | `SaveTemplateDialog` | `POST …/template {name, description\|null}`, toast "Template saved.", 422 inline | `FormDialog` title "Save as template", description "Everyone in the workspace can start a board from it.", `TextField` Name (`maxLength=80`, required, error under it), `TextField` Description (`maxLength=300`) | `[role="dialog"] input[maxlength="80"]`, `[maxlength="300"]`, `[role="dialog"] form button:text-is("Save")`, text "A template with this name already exists." in `[role="dialog"]` | field error state lives in the container; `FormDialog.error` only for non-field errors (toast stays for them) |
| 24 | Show live cursors | checkbox item | `PATCH …/settings {cursors_enabled}` + refetch | same | `menuitemcheckbox` text | facilitator |
| 25 | Show flying reactions | checkbox item | `PATCH {reactions_enabled}` | same | `[role="menuitemcheckbox"]:has-text("Show flying reactions")` | |
| 26 | Allow guests via link | checkbox item | `PATCH {guest_access_enabled}` | same | `[role="menuitemcheckbox"]:has-text("Allow guests to join with a link")` | stays in menu (D2) |
| 27 | Replace guest link | menu item (guest access on) | `POST …/guest-token` + refetch | same | `[role="menuitem"]:has-text("Replace the guest link")` | expels guests: keep as is, no confirm (as before) |
| 28 | Copy guest link | menu item | clipboard + toast "Link copied." | same; add try/catch with error toast (old: none) | `has-text("Copy the guest link")` | tiny hardening only |
| 29 | Delete board | menu item + confirm Dialog | `DELETE whiteboards/{board}` → visit `links.team` | `ConfirmDialog` tone destructive, title "Delete this board?", description "Everything on it is removed for everyone.", confirm "Delete this board" | `[role="dialog"] button:text-is("Delete this board")` | `me.canDelete` |
| 30 | Start timer 1/3/5/10 min | `FacilitatorBar` DropdownMenu | `PUT …/timer {seconds}` → `state.setTimer` | `skrum/Timer` `onStart` (default presets), no `onCustom` | `[aria-label="Timer"]` inside `[role="toolbar"][aria-label="Facilitation tools"]`, 5 `[role="menuitem"]`, `:text-is("1 min")` | server accepts 10..3600 |
| 31 | Stop timer | same | `PUT {seconds:null}` | `Timer` `onStop`; item disabled when no timer | `[role="menuitem"]:has-text("Stop timer")` `aria-disabled` | |
| 32 | Countdown shown to everyone, same end time | `TimerDisplay` | `board.timerEndsAt`, `serverOffset` | `Timer` with `remainingSeconds` from `useCountdown(endsAt, offset)` | `[role="timer"]` text `m:ss` | `Timer` pill has `role="timer"`, text in an `aria-hidden` span: `textContent` still `m:ss` (P17c helper reads it) |
| 33 | "Time's up!" toast + beep once, only if seen running | `TimerDisplay` effect | client | container `board-timer.tsx`: same refs logic on `onDone` / `remaining===0`, `toast(t("Time's up!"))`, WebAudio beep | `[data-sonner-toast]:has-text("Time's up!")` | `[role="timer"]` text "Time's up!" no longer there: test change (§8) |
| 34 | Lock / unlock board | facilitator toggle | `PATCH {locked}` + refetch | `skrum/FacilitatorBar` action `kind:'toggle'`, `pressed=board.locked`, label flips "Lock the board"/"Unlock the board" | `button[aria-label="Lock the board"][aria-pressed="false"]`, `Unlock the board` `true` | |
| 35 | Bring everyone to me | facilitator toggle | `PATCH {follow_enabled}` + refetch | FacilitatorBar toggle "Bring everyone to me" | `[aria-label="Bring everyone to me"][aria-pressed]` | |
| 36 | Facilitator tools only for facilitator | `me.isFacilitator` | — | same condition around `FacilitatorBar` | `assertNotPresent` toolbar for member/guest | |
| 37 | Status: locked | `StatusBar` | `locked && !isFacilitator` | `board-notices.tsx` `<div role="status">` with `Lock` icon | `div[role="status"]:has-text("This board is locked.")` | must be a `div` (selector) and render nothing when empty |
| 38 | Status: "Everyone follows your view." / "Following the facilitator" / "Following paused" + Resume | `StatusBar` | follow hook | same container | `div[role="status"]:has-text(…)`, `div[role="status"] button:text-is("Resume")` | |
| 39 | Pause following by manual pan/zoom | `use-whiteboard-follow` | client | unchanged | P17c-04a | |
| 40 | "Reconnecting…" while offline / HTTP failing | `ConnectionBanner` | `reconnecting \|\| offline` | `skrum/ConnectionState` `status={… ? 'reconnecting' : 'connected'}` `variant="pill"` in `actions`/header | text "Reconnecting…" | never map to `'offline'` (label differs); no `attempt` prop; no `realtime` prop (see #54) |
| 41 | Session expired | `SessionExpiredBanner` + `inert` | 401/419 | `ConnectionState status="expired" variant="banner" onReload={() => location.reload()}`; content `inert` | `role="alert"`, "Your session has expired.", "Reload" | |
| 42 | Board deleted / access ended screens | `BoardGone` | `board.deleted`, 403/404 | `EmptyState` (icon, title, `Button asChild` "Back to the team") inside `SessionLayout` | "This board was deleted.", "Your access to this board has ended.", "Back to the team" | P17b-28 binds the text |
| 43 | Rejection toasts | `board.tsx` | reject reasons | unchanged `toast.error(..., {id})` | `[data-sonner-toast]:has-text("This board is locked.")`, "Only the facilitator can change a locked element." | |
| 44 | View mode when locked, close text editor, clear selection | `board.tsx` effect | client | unchanged | `.excalidraw--view-mode`, `textarea.excalidraw-wysiwyg` | |
| 45 | Live cursors (Excalidraw collaborators) | `use-whiteboard-cursors` | whisper `client-cursor` | unchanged; `skrum/LiveCursor` NOT used (§5) | — | colour: D7 |
| 46 | Follow-me viewport | `use-whiteboard-follow` | whisper `client-viewport` | unchanged | zoom buttons `.zoom-in-button`, `.reset-zoom-button` | |
| 47 | Elements delta/resync/recover | `scene-sync` | `GET elements`, `GET snapshot`, 409 | unchanged | P17a-05, P17b-29/30 | |
| 48 | Poll deltas every 5 s when socket down | `board.tsx` effect | client | unchanged | P17a-05b | |
| 49 | board.changed / timer.changed / board.deleted / elements.changed | `use-whiteboard` | presence channel | unchanged | — | |
| 50 | Theme + locale sync | `appearance.ts`, `langCode` | client | unchanged (`MutationObserver` on `<html class>`); canvas background from `CANVAS_LIGHT` in `initialData.appState` (new) | — | local only, not synced |
| 51 | Ctrl+Shift+S disabled | `HiddenSaveToDiskAction` | client | unchanged | — | |
| 52 | Sticky tool injected in shapes toolbar | `use-whiteboard-toolbar-slot` + `ToolbarDom` | DOM | unchanged hook; portal content new (#8) | `.App-toolbar [data-testid="toolbar-eraser"]` | |
| 53 | Realtime attribute + scene stamp | root `<div data-realtime data-scene>` | — | wrapper `<div>` inside `main` carrying both, `data-scene` still set by `setAttribute` in `onChange` | `[data-realtime="connected"]`, `[data-scene^="N:"]` | exactly ONE `[data-realtime]` element: do not pass `realtime` to `ConnectionState` |
| 54 | Colour bar for new items and selection (new, mockup) | — | client `updateScene` | `WhiteboardColorBar` via `canvas-colors.tsx`; `recolorElements`, `postItAppState` | — | D3; no feature lost if native quick picks stay visible |
| 55 | Share (new, mockup "Partager") | — | existing guest-link endpoints | `skrum/ShareDialog` (`kind:'whiteboard'`, `invite.url=board.guestUrl`, `allowGuests`, `onChange`→settings, `onRegenerate`→guest-token, `onCopy`) in header `actions`, non-guests | — | duplicates #26–28 in the menu: D2 |
| 56 | Join: name + submit | `join.tsx` `Form` + `Input#name` | `POST whiteboards/join/{guestToken}` | `GuestJoin` `session.kind='whiteboard'`, `initialName=suggestedName`, `onSubmit` → `router.post(WhiteboardJoinsController.store.url(guestToken), { name })` | `#name`, button "Join" (`joinAsGuest` helper) | no `takenColors` (backlog, no server field) |
| 57 | Join: validation error | `InputError` | 422 `errors.name` | `GuestJoin` `error={{field:'name', message}}`, `processing` | — | |
| 58 | Join: invalid link (HTTP 404) | `Heading` "Join a whiteboard" + "This guest link is no longer valid." | `isInvalid` | `EmptyState` with both texts, no form | text kept | |
| 59 | Join: already member → redirect, 429 throttle | server | — | server only | — | unchanged, 429 not handled (as before) |
| 60 | Join: head title | `<Head title={boardTitle}>` | — | same | — | |
| 61 | Guests see no team link, no template/duplicate, no guest link | conditions on `me`/`links` | — | same conditions | P17b-16, P17a-07 | |
| 62 | Live a11y: status/alert roles, `inert` when expired | — | — | kept | — | |

62 rows.

## 4. Composition

### 4.1 `show` (commits 7.2–7.4)
Page (`pages/whiteboards/show.tsx`): keeps the lazy `Board`, `ChunkBoundary`, `CanvasError`. New: wraps the lazy tree in nothing; the layout cannot take slots from the lazy child (slots need `useWhiteboard` state). Therefore the `Board` default export renders `<SessionLayout title=… timer=… presence=… actions=…>` itself (page stays thin; the chunk is the container). `Skeleton` and `CanvasError` render inside a bare `SessionLayout` with the title from `snapshot.board.title`.

`components/whiteboard/board.tsx` (rewritten, keeps all hooks/effects of the old one verbatim: `useWhiteboard`, `createSceneSync`, polling, view-only effect, cursors, follow, toolbar slot, `data-scene`):
- `SessionLayout` slots: `title` = `<BoardTitle>` (back link + truncated title); `timer` = `<BoardTimer>` for non-facilitators only; `presence` = `PresenceStack`; `actions` = [`ConnectionState` pill, facilitator: `FacilitatorBar` (compact below `md`, `start`=`<BoardTimer>` so the Timer menu lives inside the "Facilitation tools" toolbar), sticky fallback button, `Share` button, `BoardMenu`].
- `main` content: `<div data-realtime data-scene class="flex h-full flex-col">` → `<BoardNotices>` (the `div[role=status]`) → `div.whiteboard-canvas.relative.min-h-0.flex-1[data-facilitator]` (+ class `skrum-whiteboard--fallback-colors` only if D3 = yes) → `<Excalidraw>` (props unchanged except `initialData.appState` = `{ viewBackgroundColor: CANVAS_LIGHT, ...postItAppState('sun'), currentItemRoughness: 1 }`) → `<CanvasColors>` → `<BoardReactions>` as a SIBLING after the canvas div.
- expired: `ConnectionState status="expired" variant="banner"` above `main` content; content wrapper `inert`.

Adapters (field by field):
| Server shape | → Component prop |
|---|---|
| `PresenceMember {id,name,avatarUrl,isGuest}` → `Participant` | `id`; `name`; `avatarUrl`; `role = id===board.facilitatorMemberId ? 'facilitator' : isGuest ? 'guest' : 'member'`; `status='online'`; `presence = 1 + hash(id) % 12` (same hash helper as cursors, extracted to `lib/whiteboard/palette.ts`? no: new small `lib/whiteboard/presence-slot.ts`); `isMe = id===me.id` |
| `board.timerEndsAt`, `state.serverOffset` → `Timer` | `remainingSeconds = useCountdown(endsAt, offset)` (null → no pill); `onStart={(s)=>setTimer(s)}`; `onStop={()=>setTimer(null)}` (both facilitator only; absent for others so the control is not rendered) |
| `board.locked`, `board.followEnabled` → `FacilitatorBar.actions` | `{id:'lock', kind:'toggle', pressed:locked, label:t(locked?'Unlock the board':'Lock the board'), icon:locked?Lock:LockOpen}`; `{id:'follow', kind:'toggle', pressed:followEnabled, label:t('Bring everyone to me'), icon:Presentation}` |
| `state.reconnecting \|\| offline` → `ConnectionState.status` | `'reconnecting'` / `'connected'`; `state.sessionExpired` → `'expired'` |
| `board.guestUrl/guestAccessEnabled`, `me.isFacilitator` → `ShareDialog` | `invite={{url: guestUrl, allowGuests: guestAccessEnabled}}`, `canManage=me.isFacilitator`, `session={{id: board.id, kind:'whiteboard', title: board.title, presentCount: online.length}}`; `onChange({allowGuests})`→`PATCH settings`; `onRegenerate`→`POST guest-token`; `onCopy('url')`→clipboard+toast |
| `useWhiteboard` presence + `online` → reactions | unchanged `FlyingReactions` props (`presence`, `selfId`, `online`, `labelFor`, `originFor=avatarOrigin`) |

`board-timer.tsx`: wraps `skrum/Timer`; keeps the old `TimerDisplay` refs (`announced`, `sawRunning`) so the toast and beep fire once per `endsAt` and only if this client saw it running; `useIsMounted` guard (SSR safe).
`board-facilitation.tsx`: builds the `actions` array and calls `useWhiteboardRequest` + `retroRequest` exactly as the old file; `busy` state disables Timer items (Timer has no `busy` prop: ignore presses while busy in the handlers).
`board-notices.tsx`: composed from primitives (no skrum component fits): `div role="status"` with `bg-muted text-sm`, tokens only, `Lock`, `Button size="sm" variant="outline"` "Resume"; returns null when empty.
`board-reactions.tsx`: unchanged logic; passes `className:'whiteboard-reactions'` through `toolbarProps` to the `ReactionBar` toolbar `div`; mobile: `compact` via `useIsMobile()`.
`board-gone.tsx`: `EmptyState` + `Button asChild><Link>`.

Compose-from-primitives list: BoardNotices, BoardTitle (back link + h1-like text; no Breadcrumb because a guest has no team link), sticky popover, rename/hand-over/save/delete dialogs (on `FormDialog`/`ConfirmDialog`), canvas colour dock.

### 4.2 `board-menu.tsx` + `board-dialogs.tsx` (7.3)
Same menu entries and conditions as the old file (rows 17–29). `attempt`/`run`/`updateSettings` helpers unchanged. Dialogs: `FormDialog` (rename, save template, hand over) and `ConfirmDialog` (delete); bodies mounted only while open stays true because `FormDialog` renders content only when open (Radix). Save-template field errors: container state `{name?, description?}` from `RetroRequestError.errors`, shown through `TextField error=`; other errors toast.

### 4.3 Canvas theming (7.4)
- `sticky-tool.tsx`: trigger unchanged (ToolbarDom classes, `title`/`aria-label` "Sticky note"). Content = `Popover` (not DropdownMenu: a radiogroup inside a `role=menu` breaks roving) with `WhiteboardColorBar value={lastColor} onChange={add}`; `add(color)` builds the same 200x200 rectangle with `POSTIT[color].bg`; stroke per D4; closes after adding. Dark filter class `CanvasDarkFilterClass` is no longer needed (swatches are our tokens, `WhiteboardColorBar` uses `bg-skrum-col-*` which are theme-aware; the old inverted-hex trick existed because the swatches showed canvas hex).
- `canvas-colors.tsx`: floating `WhiteboardColorBar orientation="vertical"` at the canvas left edge (hidden on mobile and when `viewOnly`), `value` from `postItFromBackground(appState.currentItemBackgroundColor) ?? 'sun'`; `onChange` → `api.updateScene({ elements: recolorElements(...selected), appState: postItAppState(color) })`. Needs `appState.selectedElementIds` from `onChange` (store in ref + state, not synced).
- `excalidraw-theme.css`, `palette.ts`, `whiteboard-toolbar.tsx`: reused untouched.
- app.css (Excalidraw block lines 477-546) edits: the reactions rules use `:has(~ .whiteboard-reactions)` and `~ .whiteboard-reactions` (sibling of the canvas). `ReactionBar` puts `className` on the inner toolbar, the outer wrapper `[data-slot="reaction-bar"]` is the sibling: rewrite the three rules on `[data-slot='reaction-bar']`; recompute offsets (new bar: `bottom-6` = 24px + 44px buttons + `p-1` + 1px borders ≈ 78px tall stack top at ~102px; scroll-back button bottom ≥ 112px desktop; mobile: bar offset above the Excalidraw bottom toolbar 78px+safe-area → use `offsetBottom` prop, scroll-back +prior delta). `.whiteboard-canvas[data-facilitator='false'] .context-menu …` and the `.excalidraw .default-sidebar-trigger…` rule stay byte-identical.

## 5. Realtime
| Channel / event | Hook | Lands in |
|---|---|---|
| presence `whiteboard.{id}` (`here/joining/leaving/error`) | `useWhiteboardChannel` via `useWhiteboard` | `online` → PresenceStack adapter, cursors roster, reactions roster; `connected/reconnecting` → ConnectionState |
| `.elements.changed` | `listeners.current.onElementsChanged` | `createSceneSync.handleRemote` (unchanged, in `Board`) |
| `.timer.changed` | `state.setTimer` | `BoardTimer` (`Timer.remainingSeconds`) |
| `.board.changed` | `state.refetch()` | `snapshot.board/me/members/links` → header, menu, FacilitatorBar toggles, notices |
| `.board.deleted` | `status='deleted'` | `BoardGone` |
| whisper `client-cursor` | `useWhiteboardCursors` | Excalidraw `collaborators` (library draws them; `skrum/LiveCursor` and `.lc-overlay` are NOT used on this screen) |
| whisper `client-viewport` | `useWhiteboardFollow` | `updateScene appState` + notices |
| whisper `client-reaction` | `FlyingReactions` (`live-reactions` `useReactions`) | `LiveReactions` overlay (`.lr-overlay`) + `ReactionBar` |
Two-browser behaviour that must keep working (member + guest): sticky/shape/stroke appear without reload, drag convergence, lock/unlock, timer sync (same end), follow-me with pause/resume, reactions both ways with sender name, guest expulsion on link replace, delete tab message, offline replay. Those are exactly Plan17a/c/d.

## 6. Mockup elements not rendered / without mockup

Not rendered (spec §10 backlog or no back end): comments button; "convert selected stickies to actions"; "Suivre Camille" (follow a user) pill; breadcrumb inline rename (rename stays a menu dialog); sticky authors; "N elements" selection counter and contextual selection bar (grouper/aligner/verrouiller/convertir: Excalidraw native); vertical rebuilt `WhiteboardToolbar` with 7 tools, undo/redo, zoom, minimap (native Excalidraw UI is the single model, spec §6.4/§6.5 #5, #29); SVG mock layer; mobile "Lecture / Modifier" explicit mode (not an existing feature; Excalidraw's own view mode toggle is kept and `viewModeEnabled` stays driven by the board lock only); top-bar "Exporter" button (native main menu Export + Save as image are kept, and the JSON export dialog).
No mockup, designed from neighbours: header notices (locked/follow/paused) from `ConnectionState` pill language and `FacilitatorBar` tokens; FacilitatorBar placement and its Timer (ScreenRetro topbar timer + FacilitatorBar README); board menu (CardMenu/DropdownMenu patterns, ScreenWhiteboard "..." absent); gone / expired screens (ScreenErrors + EmptyState); join invalid state (EmptyState); save-template and hand-over dialogs (FormDialog).

## 7. Back-end changes
None required by spec §9 for this group. Gaps to report, not to plan: (a) the eight built-in templates under `resources/whiteboard-templates/*.json` use the old six sticky hex (`#fff3bf`…): sample notes will not match the new palette (D1); (b) the server has no presence-colour index for whiteboard members (cursor/avatar colour is client-derived, ruling #7 says keep).

## 8. Browser tests

Files covering the group: `tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php`, `Plan17bWhiteboardTemplatesTest.php` (board part only: P17b-08/09/16/17/19/20/22/23-30; gallery tests belong to the team group), `Plan17cWhiteboardFacilitationTest.php`, `Plan17dWhiteboardSecrecyTest.php`, `Smoke/WhiteboardHarnessTest.php`, helper `Support/InteractsWithWhiteboards.php`, `Support/InteractsWithBrowser.php::joinAsGuest` (shared: `#name`, "Join").

Bound selectors (preserve): `.whiteboard-canvas`, `canvas.excalidraw__canvas.interactive`, `[data-testid=…]` of Excalidraw, `[data-scene]`, `[data-realtime]`, `[role="toolbar"][aria-label="Facilitation tools"]`, `[aria-label="Timer"|"Lock the board"|"Unlock the board"|"Bring everyone to me"|"Board menu"]`, `[aria-pressed]`, `[role="timer"]`, `div[role="status"]`, `[role="menu"]/[role="menuitem"]/[role="menuitemcheckbox"]`, `[role="dialog"] input[maxlength="80"|"300"]`, `#whiteboard-new-facilitator`, `a[aria-label="Back to the team"]`, `[role="group"][aria-label="N online"]`, `header img[data-presence-id][alt]`, `.whiteboard-reactions[role="toolbar"][aria-label="Reactions"]`, `[aria-label^="Send a reaction "]`, `.lr-overlay`, `[data-sonner-toast]`, `button[aria-label="Sticky note"]`.

Tests that MUST change (mockup imposes):
| Test | Change | Cite |
|---|---|---|
| Helper `addWhiteboardSticky` (default `'Yellow'`) and 17a (lines 89, 114, 116, 317, 447, 556, 560, 589), 17c (213, 238, 262), 17d (15) | colour names `Yellow→Sun`, `Blue→Sky`, `Green→Moss`; click `button[aria-label="Sticky note"]` then `[role="radiogroup"][aria-label="Fill colour"] [role="radio"][aria-label="<Name>"]` instead of `[aria-label="Add a sticky note: <Name>"]` | ExcalidrawTheme README palette (8 named colours) + WhiteboardToolbar README colour sub-bar |
| P17a-02a line 101, P17a-11 line 569 | `'#fff3bf'` → `'#fdf1c2'` (Sun background; if D4 = border stroke, also assert `#ddc362`) | ExcalidrawTheme palette table |
| P17c-01c | replace `assertSeeIn('[role="timer"]', "Time's up!")` by `assertAttribute('[role="timer"]','data-state','done')` (and `aria-label="Time's up!"`); the toast assertion stays | Timer README/`timer.tsx` done state shows `0:00` |
| P17c-01a/b | none if Timer is the `start` slot of FacilitatorBar (D5); otherwise selector `P17cTools.' [aria-label="Timer"]'` → `[aria-label="Timer"]` | |
Fixture hex in 17a:231, 17c:439, 17b:92 are server-written elements: unchanged.

New tests (id convention): `[P18e7-01]` guest join page renders `GuestJoin` (name prefilled with `suggestedName`, "Join" works, invalid link shows the message); `[P18e7-02]` header: back link, title, PresenceStack count, FacilitatorBar in order, Share opens ShareDialog with the guest link and toggling "allow guests" matches the menu state (only if D2 = keep both); `[P18e7-03]` colour bar recolours a selected shape for the member and the guest sees `#…` of the chosen colour (only if D3 = yes); `[P18e7-04]` reactions bar not overlapping Excalidraw's scroll-back button (bounding boxes) on desktop and 390px; `[P18e7-05]` visual test file `tests/Browser/Visual/WhiteboardVisualTest.php` (shape of `AdminPagesVisualTest`): show as member, as locked guest, join page; light/dark, 1440/390, FR/EN; no horizontal overflow. Vitest: `board-timer.test.tsx` (toast once, only if seen running), participant adapter, `presence-slot` hash, `canvas-colors` recolour; existing `palette.test.ts`, `whiteboard-theme.test.ts`, `whiteboard-toolbar.test.tsx` stay.

## 9. Risks and open questions

| # | Risk | Evidence |
|---|---|---|
| R1 | Shared `components/realtime/flying-reactions.tsx` (retro, poker, games, whiteboard) must become `ReactionBar` + `live-reactions` overlay. P17a-10 and P17c-06 bind `.lr-overlay` and the sender name; `ReactionBar.incoming` renders its own layer (`data-slot="reaction-fly"`) and would break them. Whoever lands first (group 2 retro) owns the file; this group reuses it and only adds the `whiteboard-reactions` class. If not landed, 7.2 writes it and group 2 adopts it. | `flying-reactions.tsx`, `skrum/reaction-bar.tsx` |
| R2 | CSS built on a sibling relation to the reactions bar (`.whiteboard-canvas:has(~ .whiteboard-reactions)`) and on pixel offsets of the old bar (46px tall, `bottom-4`) breaks with `ReactionBar` (outer wrapper, `bottom-6`, 44px buttons). Excalidraw internals (`.scroll-back-to-content`, `.excalidraw--mobile`, `.App-mobile-menu`) are 0.18.1 only. | `app.css:477-546` |
| R3 | `SessionFrame` header is `h-14`, `z-30`, overflow hidden: Timer + FacilitatorBar (rounded bar, borders) + PresenceStack + Share + menu may not fit at 390px or at 1024px with a long title. Needs compact FacilitatorBar below `md`, PresenceStack `max`, Share as icon. Excalidraw's own top-left hamburger/top toolbar sit under the header: check overlap. | `skrum/frames.tsx` |
| R4 | `main` is `relative min-h-0 flex-1`, Excalidraw needs a sized parent (`h-full`) and the tests measure `.whiteboard-canvas` size; `Inset` is `h-svh overflow-hidden bg-skrum-canvas`. Wrong chain = zero-height canvas. | `frames.tsx` Inset |
| R5 | `FormDialog` always renders a submit button: the hand-over dialog with zero candidates ("No one else can facilitate this board yet.") needs `unavailableMessage` or a plain `Dialog`. P17c-05b asserts the message. | `confirm-dialog.tsx` |
| R6 | `Timer` has no `busy`/`disabled` prop and renders `role="status"` (a `span`, `aria-live`) which does not collide with `div[role="status"]` selectors, but the sr-only announcement duplicates "Time's up!" for `assertSee` (still fine). Test P17c-01c changes (§8). | `skrum/timer.tsx` |
| R7 | Color bar fallback + `skrum-whiteboard--fallback-colors` hides Excalidraw's native top picks: users lose quick access to default colours (not to the "more colours" picker). Elements drawn in other colours still render. | `excalidraw-theme.css` last rule |
| R8 | Template sample notes (8 built-in JSON, plus workspace templates and duplicates) keep old hex: a recolour or the colour bar's active swatch shows none selected (`postItFromBackground` returns null → falls back to `sun`). | `resources/whiteboard-templates/*.json` |
| R9 | `PresenceStack` shows only 5 avatars by default and sorts a popover list; old strip showed 8. P17 tests need ≤3 avatars. At 390px mockup wants a counter. | `presence-stack.tsx` |
| R10 | `data-realtime`: `ConnectionState` renders its own `[data-realtime]` span when given `realtime`; two elements would make `assertAttribute('[data-realtime]', …)` read the wrong one. | `connection-state.tsx:109` |
| R11 | `GuestJoin` has no invalid-link state and always shows the logo/"Join as a guest" copy: invalid page composed with `EmptyState`. `loginUrl` required: use `login()` from `@/routes`. | `guest-join.tsx` |
| R12 | `Popover` for the sticky colours inside Excalidraw's toolbar: portal outside `.excalidraw`, so Excalidraw may treat the click as "outside" and deselect or switch tool (the old DropdownMenu had the same portal and worked). Verify pointer events and `onCloseAutoFocus` (focus must not jump to canvas and trigger text editing). | `sticky-tool.tsx` |
| R13 | ReactionBar digits 1–6 vs Excalidraw tool digits: keep `shortcuts={false}` here (the hook is scoped to the toolbar, but focus after a click stays on it). | ExcalidrawTheme "Accessibilité" |

### Decisions needed (product owner)
| # | Question | Recommendation |
|---|---|---|
| D1 | Sticky colours: adopt the 8-colour palette (Sun… Moss) for new notes, as the mockup and spec §6.4 say? This changes stored colours (`#fff3bf`→`#fdf1c2`) and 13 test call sites; built-in template notes keep old colours until their JSON is regenerated (back-end data, outside §9). | Yes; regenerate the template JSON in a separate back-end task |
| D2 | The mockup has a Share button; the guest-link controls (allow guests, replace, copy) live in the board menu today and the browser suite binds them there. Keep them in the menu AND add the Share dialog (two entry points), or move them (tests P17a-06/07, P17b-16 change)? | Both for now |
| D3 | Hide Excalidraw's native colour quick picks and show the 8-colour bar (README fallback), or keep native pickers and use the bar only inside the sticky tool? | Bar inside the sticky tool only; floating bar later |
| D4 | Sticky stroke: keep `transparent` (today) or the palette border colour (`#ddc362` for Sun, mockup look)? | Palette border |
| D5 | Where does the Timer live for the facilitator: inside the "Facilitation tools" toolbar (tests unchanged) or in the header `timer` slot (test selector `P17cTools.' [aria-label="Timer"]'` changes)? | Inside the toolbar |
| D6 | Cursor colour: keep `hsl(hash)` (not a token) or derive from `--skrum-presence-N` so cursor and avatar match (ScreenWhiteboard `--cur`)? | Presence tokens, resolved at runtime |
| D7 | Phone read mode with explicit "Modifier": not built (no back end concept). Confirm. | Not built |

## 10. Size and parallelism
- Containers to write: 11 (`board`, `board-header`, `board-timer`, `board-facilitation`, `board-notices`, `board-share`, `board-reactions`, `board-gone`, `board-menu`, `board-dialogs`, `sticky-tool`, `canvas-colors`) plus `guest-join-form`; 1 small lib file (`presence-slot`).
- Old files deleted: 5 (`top-bar`, `status-bar`, `facilitator-bar`, `hand-over-dialog`, `save-template-dialog`) + dead exports in `lib/whiteboard/excalidraw.ts`; 5 more rewritten in place.
- Tests touched: helper + 4 Plan17 files (~16 lines), `Smoke/WhiteboardHarnessTest.php` check; new: 1 Pest browser file, 1 visual file, ~4 Vitest files.
- Parallelism: can run in parallel with groups that do not touch shared files. Shared files: `resources/js/app.tsx` (join case → `null`; same edit as retro/poker/games join), `lang/{en,fr,es,de}.json` (all four, one commit each; conflicts are line-level), `components/realtime/flying-reactions.tsx` (R1, coordinate with group 2), `resources/css/app.css` Excalidraw block (mine alone), `tests/Browser/Support/InteractsWithBrowser.php::joinAsGuest` (shared, unchanged unless GuestJoin button text changes: it is "Join"), `skrum/frames.tsx` / `session-layout.tsx` (read only; fixes to the frame found here go to whoever owns it first). Types: none (`lib/whiteboard/types.ts` unchanged).
