# Brief 03 — Planning poker (plan 18e, group 3)

Read-only research at HEAD f8ea376d on plan-18d-branding. Sources read: spec, notes-for-18e, inventory-pages slice 03 (L2208-2510) and teams slice (poker rows), inventory-components Part D, mockups ScreenPokerBefore/After/Queue, MobilePoker, PokerTable, PokerCard READMEs, new `skrum/` poker components, old `components/poker/**`, `pages/poker/*`, Pest browser tests. NOT verified: running the old pages, exact `ui/table`/`ui/pagination` props, the `Plan14c/14d` poker assertions beyond selector counts, whether `Switch` forwards `id`.

## 1. Scope

| Page | Route (name) | Layout today -> target | Mockup |
|---|---|---|---|
| `poker/show` | `GET poker/{game}` (`poker.show`), no `auth` (guests) | `null` in app.tsx -> `SessionLayout` (see Decision D1) | ScreenPokerBefore, After, Queue (frames a, b), MobilePoker |
| `poker/join` | `GET/POST poker/join/{guestToken}` (`poker.join.show/store`) | `AuthLayout` (stays) | `GuestJoin` + ScreenAuth/MobileAccess grammar |
| `poker/estimates` | `GET w/{workspace}/teams/{team}/estimates` (`teams.estimates.index`) | `AppLayout` (stays) | ScreenPokerQueue frames c, d (left panel) |
| Saved decks dialog | client dialog on `teams/show`; `teams.pokerDecks.store/update/destroy` | n/a (dialog) | ScreenPokerQueue frames c, d (right panel) |

Also rewritten here because they are poker-only: the game-settings, guest-link, share, hand-over, end/delete dialogs, import dialog, task form. `retros/session-ended` (rendered by `ResolvePokerPlayer`) belongs to group 2. Single model (spec 6.4): oval table, story card on top, queue on the right (20rem), dock at the bottom (ReactionBar above deck, `--space-3` gap, in flow). Old model (tasks left, hand row) is dead.

## 2. Commits (in order)

| # | Commit | Old files deleted |
|---|---|---|
| 3.1 | `feat(poker): room on the table model` — page, container, hook wiring, topbar, story card, queue, dock, dialogs, import | all of `resources/js/components/poker/**` EXCEPT `deck-fields.tsx` (still imported by `components/teams/new-poker-game-dialog.tsx` and `saved-decks-dialog.tsx`); `lib/poker/format.ts` stays (team page). Split into 3.1a room shell + table + dock + queue, 3.1b dialogs (settings, share, guest link, hand-over, end, delete), 3.1c import + task source/sync/conflict if the commit is too big (each commit must leave the room working). |
| 3.2 | `feat(poker): guest join on GuestJoin` | body of `pages/poker/join.tsx` (page rewritten, file kept) |
| 3.3 | `feat(poker): estimation history` | body of `pages/poker/estimates.tsx` (rewritten, file kept) |
| 3.4 | `feat(poker): saved decks dialog on DeckPicker/DeckEditor` | `components/teams/saved-decks-dialog.tsx` body rewritten; then `components/poker/deck-fields.tsx` deleted ONLY if group 1 (new-poker-game dialog on DeckPicker) already merged, else leave it for group 1 / 18g |

Pest browser tests are edited in the commit of their screen (section 8). Lang files: new keys added to en/fr/es/de in every commit.

## 3. Parity table (old front -> new)

Hooks to keep: `[A]` = `[aria-label=...]`, `[D]` = `data-test`. "Game" = `usePokerGame` + `GameProvider` kept (reducer, refetch discipline, `run()`).

| # | Action | Old control (file) | Route / event | New component and control | Browser hook to preserve | Note |
|---|---|---|---|---|---|---|
| 1 | Back to team | game-header Link | visit `links.team` | Topbar back icon Link (`title` slot of SessionLayout) | `[A=Back to the team]` | Non-guests only. Guest: none. |
| 2 | Rename game inline | game-header TitleEditor | `PATCH poker/{game}/settings {title}` | Same inline `Input` (max 120) in the topbar title slot; save on blur/Enter, Escape cancels | `[A=Game title]` | Fac., not ended. Not in mockup, designed from topbar. |
| 3 | Deck / Game ended / Anonymous votes / Auto-reveal badges | game-header Badge | - | `Badge` in topbar (mockup: deck badge "Fibonacci") | text `Fibonacci`, `Game ended`, `Anonymous votes`, `Auto-reveal` | Badges `Game ended`, `Anonymous votes`, `Auto-reveal` stay (tests assertSee). |
| 4 | Watch only / Play (self) | spectator-toggle | `PUT poker/{game}/players/{p}/spectator` | `Switch` labelled "Watch only" in topbar (pill `skrum-primary-soft` when on) | `click('Watch only')`, `assertSee('Watch only')`, absent when ended | Mockup keeps label "Watch only" when on (old flipped to "Play"): test P10b-11 only clicks "Watch only" then expects deck gone; second click in the same test uses the banner "Join the vote" or the switch (see 8). |
| 5 | Make player / Make spectator (other) | PlayerRoleMenu on seat + watcher | same route | `PokerTable.seatMenu(seat)` renders a `DropdownMenu` trigger | `[A=Player options]`, items "Make spectator"/"Make player" | Fac., not ended, not self. Shared by seats and the watching row (PokerTable passes the same slot). |
| 6 | "You're watching" strip | hand.tsx text | - | `Alert variant=info` role=status, observer banner of ScreenPokerQueue, with "Join the vote" button (same PUT) | text `You're watching — switch to Play to vote` | Keep the exact English sentence (5 assertions); "Join the vote" is the mockup link. Facilitator-watching variant: "Deck disabled while you watch only" in the dock head. |
| 7 | Hide / Show tasks (desktop) | game.tsx button `aria-pressed` | client state | Topbar button `panel-right-close`, `aria-controls="poker-tasks"`, `aria-pressed` | `Hide tasks`/`Show tasks` text | Keep id `poker-tasks` on the queue. Mockup says the button hides the right queue. |
| 8 | Open tasks (mobile) | game.tsx button `lg:hidden` + left Sheet | client state | Same button, `Drawer` (bottom) per MobilePoker/ScreenPokerQueue mobile, `onCloseAutoFocus={useRestoreFocus(open)}` | `Tasks` | Spec 7.3: Drawer, not Sheet. |
| 9 | Take control | take-control-button | `PUT poker/{game}/facilitator {user_id}` | `Button` in topbar actions | `Take control` | `me.canTakeControl`; also on ended game. |
| 10 | Facilitator menu | game-menu DropdownMenu | - | `DropdownMenu` (icon trigger, settings) in topbar | `[A=Facilitator menu]` (26 uses) | Items keep names: `Share…`, `Settings…`, `Guest link…`, `Hand over facilitation…`, `Reopen game`, `End game`, `Delete game…`. Forced closed when `sessionExpired`. |
| 11 | Share… to channel | game-share-dialog -> `post-link-section` | `POST poker/{game}/shares` | `ShareDialog` (`kind='poker'`, `channels`, `onShareToChannel`, `channelsExtra=<DeliveryLines>`) | `Share…` menu item; toast "The message is on its way." | `snapshot.share` -> `channels` (booleans -> `ShareChannel[]`). `delivery-lines` kept as is (shared). |
| 12 | Guest link… (allow, copy) | game-guest-link-dialog | `PATCH settings {guest_access_enabled}`; clipboard | `ShareDialog` link tab: `invite={url: game.guestUrl, allowGuests}`, `onChange({allowGuests})`, `onCopy` | `#poker-guest-link-access` (click), `input[aria-label="Guest link"]`, `assertSee('Copy')` | Input name matches (ShareDialog L942). `#poker-guest-link-access` does NOT exist in ShareDialog (its Switch has no id): add `guestSwitchId?` prop to ShareDialog or edit the test (D4). Omit `defaultRole`, `expiry`, members tab (no back end). |
| 13 | Create a new guest link | same dialog | `POST poker/{game}/guest-token` | `ShareDialog.onRegenerate` (confirm built in) | `click('Create a new link')` | ShareDialog adds a confirm step ("Create a new link?"): test P10a-14 clicks once then asserts value changed -> add confirm click (mockup-imposed, ShareDialog README). |
| 14 | Copy guest link (header icon) | game-header | clipboard | Icon button in topbar | `[A=Copy guest link]` | Non-guest non-facilitator, `guestUrl !== null`. |
| 15 | Settings… | game-settings-dialog + deck-fields | `PATCH settings` (changed keys only), `GET saved-decks` | `SessionSettingsContent` (dev example `usePokerGroups` already has ids) in a `Dialog`, title "Game settings"; deck section as `children` | `#poker-auto-reveal`, `#poker-anonymous-votes`, `#poker-cursors`, `#poker-reactions`, `assertSee('Game settings')`; title input | Does not go through `run()`: keep inline field errors + `InputError`-like message, no toast. Deck locked when `game.hasVotes` with note "The deck can't change once votes exist." Guest-access switch also present in the groups (old dialog had it). |
| 16 | Pick deck in settings | deck-fields radiogroup | part of PATCH (`deck`, `custom_cards[]`, `include_unknown`, `include_coffee`, `saved_deck_id`) | `DeckPicker` (built-in `source:'builtin'` from `deckOptions`, saved from `GET saved-decks`) + `DeckEditor idPrefix="deck-custom"` for Custom | `#deck-custom-cards` (idPrefix gives it), `Your team's decks` | See D3: DeckPicker has no "Custom" radio and no "Your team's decks" heading. Payload builder (`deckPayload`) must move out of deck-fields into `lib/poker` or the container. |
| 17 | Hand over facilitation | transfer-dialog | `PUT facilitator {user_id}` | `FormDialog` + `Select` of `me.transferCandidates`; empty text "No one else can facilitate this game yet." | menu item text | Composed. |
| 18 | End game / Reopen | game-menu + confirm | `PUT status {ended}` | `ConfirmDialog` (End), direct (Reopen) | `End this game?`, dialog button `End game`, `Reopen game` | `[role="dialog"] button:has-text("End game")`. |
| 19 | Delete game | delete-game-dialog | `DELETE poker/{game}` -> `router.visit` | `ConfirmDialog tone=destructive` | `[role="dialog"] button:has-text("Delete")`; lands on team page | `me.canDelete`. |
| 20 | Hide/Show my cursor | game-header icon `aria-pressed` | localStorage `skrum.hideMyCursor` | Icon `Toggle` in topbar, same `useLocalPreference(HideMyCursorKey)` | `[A=Hide my cursor]` / `[A=Show my cursor]` | Only while `showsPokerCursors`. `HideMyCursorKey` lives in `retro/live-cursor-layer` (group 2): import path may move. |
| 21 | Language switcher (guests) | game-header | `PUT` locale | `LanguageSwitcher` in topbar `actions` | `[A=Language]` | Guests only (kept component). |
| 22 | Presence strip | presence-strip | presence channel | `PresenceStack` in `presence` slot; `Participant` from `online` + `snapshot.players` (role, status, avatarUrl) | `[role=group][aria-label="N online"]`, `img[data-presence-id][alt="Visitor"]` | `data-presence-id` must reach the avatar `<img>`: reaction origin (`avatarOrigin`) queries it. Verify `PresenceStack` emits it (not verified). Eye badge for spectators -> `Participant` has no spectator flag: see 6. |
| 23 | Add task | tasks-pane + empty CTA -> task-form-dialog | `POST tasks {title, description}` | Queue footer "Add a task…" input + `Add` (mockup) AND the full `Dialog` form for description (Write/Preview tabs) from the empty state | `#poker-task-title`, `click('Add task')`, `Add the first task` | Mockup quick-add has title only; keep dialog for description + empty state CTA `EmptyState`. Max 200 tasks. |
| 24 | Edit / delete task | task-detail pencil / trash | `PATCH/DELETE tasks/{task}` | Story card icon buttons + `ConfirmDialog` | `[A=Edit task]`, `[A=Delete task]`, `Delete this task?` | Edit manual tasks only; delete fac. |
| 25 | Select current task | tasks-pane row button | `PUT current-task {task_id}` | Queue row button (fac.), `aria-current="true"` | `[D=poker-task-row]` (21 uses), `[aria-current=true]`, `aria-labelledby^="poker-task-"` on story section | Closes mobile drawer. |
| 26 | Reorder (drag) | dnd-kit sortable | `PUT task-order {task_ids[]}` + `.tasks.reordered` | Same dnd-kit in the queue, grip handle (`grip-vertical`), drop indicator `pk-drop` | `li:has-text(X) [aria-label="Drag to reorder"]`, `ol li` order script (KeyboardDragTest) | Queue MUST be an `<ol>` with `<li>`, and no earlier `ol li` in the DOM (check PokerRounds markup). Optimistic reorder + rollback kept. |
| 27 | Import tasks | import-tasks-dialog (600 lines) | `GET imports/{src}/containers|iterations`, `POST preview`, `POST imports/{src}` | Composed `Dialog`: `ToggleGroup` source, mode `Tabs`, `Combobox` container, `Select` iteration, `Checkbox` list, `Button` | `[A=Source]`, `[A=Choose a board|a sprint|a team]`, `Show issues`, `Import 2 tasks`, `2 imported, 0 skipped.` | Debounce 300 ms + stale guards copied unchanged. `button:has-text("Import")` in queue header. |
| 28 | Refresh from source | "More task actions" menu | `POST imports/refresh` | `DropdownMenu` in queue header | `[A=More task actions]`, `Refresh from Jira` | Toasts kept. |
| 29 | Source chip, assignee, source estimate, sync badge, status, Not found, managed note | task-source-chip/details | - | Story card block + `Badge`s; chip on queue rows | `Assignee: Jane Doe`, `Synced to Jira`, `Sync pending`, `Sync failed`, `Jira estimate: 3`, `Story PROJ-1`, `[A=PROJ-1]` | No component: composed. Guests see key chip only. |
| 30 | Sync again / retry | task-source-details | `POST tasks/{t}/sync` | `Button` in story card | `Sync again` | Fac. |
| 31 | Estimate conflict resolve | estimate-conflict | `POST tasks/{t}/estimate-conflict` | `Alert` + two Buttons | `Changed in Jira to 8`, `Use ... estimate`, `Keep skrum estimate` | Composed. |
| 32 | Rounds history (current task) | round-history Collapsible | `GET tasks/{t}/rounds` | `PokerRounds` (`status`, `players`, `count=task.roundsCount`), collapsed on mobile | `Round 1`, `Round 2`, `[A=Show rounds]` is the estimates page | Refetch rules kept (`roundsCount`/round id/`revealedAt`). Trigger text "Rounds (n)". |
| 33 | Estimate shown on story | task-detail | - | Story card badge | `Estimate: 5` (11 uses) | Keep exact text. |
| 34 | Play / withdraw card | hand.tsx | `PUT|DELETE rounds/{r}/vote` | `PokerDeck selection="toggle"` in dock; optimistic `vote.mine` | `[A=Play 5]`, `button[aria-label="Play 8"]`, `[A=Your cards]` group | Digit shortcuts built in (selected digit retracts). Disabled when no round/revealed/ended/busy. Mobile: `VoteDrawer` ("All deck"). |
| 35 | Seats, voted/not voted/value | players-grid + poker-card | `.vote.changed` | `PokerTable` seats (`role=img` "Bob: Voted") | `[role=img][aria-label="Bob: Voted"]`, `"Bob: 8"`, `section[aria-label="Players"]` | Adapter in 4. Test `Plan10aPokerCoreTest` asserts no "5"/"8"/ATLAS-58 in Players section before reveal. |
| 36 | Reveal | facilitator-toolbar | `POST rounds/{r}/reveal` | `PokerTable.onReveal` (center button, `R` key) | `click('Show votes')`, `assertButtonEnabled('Show votes')` | Disabled when `votesCount===0` (component rule `hasVotes`). Mockup label "Reveal cards": DO NOT rename (8 tests). |
| 37 | Timer 30 s/1/2/3 min, Custom, Stop | round-timer-control | `PUT rounds/{r}/timer {seconds}` | `Timer presets=[30,60,120,180]`, `onCustom` opens a `Dialog` (1-60 min), `onStop` | `[A=Timer]`, `30 s`, `[role=timer]`, `#poker-timer-minutes` | Place in topbar `timer` slot (mockup) or `votingTools`; ruling 19 says current presets, not 1/3/5/10. Countdown for everyone via `useCountdown(timerEndsAt, serverOffset)` -> `remainingSeconds`. |
| 38 | "Time's up!" toast + beep | timer-display | client | `Timer.onDone` -> same toast + `beep()` (only if seen running) | text `Time's up!` | `beep()` currently private in `retro/timer-display.tsx` (shared with whiteboard): extract to a shared helper (D2). |
| 39 | Re-vote / Estimate / Save estimate / Next task | facilitator-toolbar | `POST tasks/{t}/rounds`, `PUT tasks/{t}/estimate`, `PUT current-task` | `PokerTable` result panel (`onRevote`, `onAccept(value)`, `onNext`, `estimate`, `estimateValues`, `nextDisabled`) | `Re-vote`, `[A=Estimate]`, `Save estimate`, `Next task` | Next = `nextUnestimatedTask` (lib kept). `N`, `mod+Enter` shortcuts built in. |
| 40 | Result: consensus, average, nearest card, most played, distribution, reveal reason | result-panel, anonymous-values-row | - | `PokerTable.result/anonymous/revealReason/locale` | `Average: 5.5`, `Nearest card: 5`, `5 × 2` (check `:value × :count`), `Consensus`, `Revealed automatically — everyone voted` | Server values only (ruling 10); `median/agreement/outliers` not passed. `section[aria-label="Anonymous votes"]` present. |
| 41 | Auto-reveal nudge | auto-reveal-triggers | `POST rounds/{r}/auto-reveal` | Keep as a headless component (move into `components/poker/`, rewritten file) | no UI | 2 s debounce, `departures` counter via `onLeaving`. |
| 42 | Flying reactions | game-reactions + `realtime/flying-reactions` | whisper `client-reaction` | `ReactionBar variant="inline"` in the dock + shared reaction engine (D2) | `[role=toolbar][aria-label="Reactions"]`, `[A=Send a reaction 🎉]`, `#poker-reactions` toggle removes the bar | Gated `reactionsEnabled && !ended`; keep `data-presence-id` origin. Bar active for spectators. |
| 43 | Live cursors | game-cursors -> `LiveCursors` | whisper `client-cursor` | Keep `realtime/live-cursors` over `<main>` (library `.lc-overlay`) | `.lc-overlay` (20 uses) | Gated by `showsPokerCursors` (no cursor while a round is open). `skrum/live-cursor.tsx` NOT used (notes: decide per screen; keep library). |
| 44 | Connection banner / reconnect | connection-banner | channel status | `ConnectionState variant=banner status=reconnecting` | text `Reconnecting…` (P10a-11) | `ConnectionBanner` is shared (whiteboard, games): until 18g, either keep it or add a thin adapter. |
| 45 | Session expired + Reload; inert area | session-expired-banner | 401/419 | `ConnectionState status=expired onReload` + `inert` wrapper | `role=alert` text | Same shared-file caveat. |
| 46 | Game gone | game-gone | `.game.deleted` / 404 / 403 | `EmptyState` | `This game was deleted.`, `Your access to this game has ended.`, `Back to the team` | Guest: no team link (P10a-14 asserts `assertDontSee('Back to the team')`). |
| 47 | `data-realtime` | game.tsx root | - | Root of the room `data-realtime={realtimeState(connected, online)}` | `data-realtime` | Required by `awaitRealtime`. |
| 48 | Empty states | game.tsx | - | `EmptyState` "Add the first task" / "Pick a task to start voting" / "Waiting for the facilitator to pick a task"; table empty | exact English | PokerTable requires `story`: render EmptyState instead when no current task. |
| 49 | Ended game read-only | everywhere | `endedAt` | Same gates; hide Watch only, reactions, cursors, hand disabled | `Game ended`, no `Watch only` | Menu: Reopen, Delete, Take control only. |
| 50 | Anonymous round | seats stay down | - | PokerTable `anonymous` | `section[aria-label="Anonymous votes"]` | |
| 51 | Markdown description | task-detail dangerouslySetInnerHTML | - | Story card, same `MarkdownClasses` sanitised HTML | P10a-04a (safe render) | `descriptionHtml` is server-rendered; keep as is. |
| 52 | Title/guest stuff on `poker/show` `<Head>` | show.tsx | - | `<Head title={snapshot.game.title}>` | - | |
| 53 | Join (guest) | join.tsx `<Form>` | `POST poker/join/{token}` | `GuestJoin` (`session.kind='poker'`, `initialName=suggestedName`, `error`, `processing`, `onSubmit(data, formData)` -> `router.post(PokerJoinsController.store.url(token), ...)`, `children`=spectator control) | `fill('name')`, `#spectator`, `click('Join')`, `Join as spectator` | `GuestJoin` input id is `name` (ok). `#spectator` must be set by the child checkbox (`name="spectator" value="1"`). `loginUrl` is required: use `login()` Wayfinder. Omit `takenColors` (no colour back end). |
| 54 | Invalid link | join.tsx | 404 | `EmptyState` inside `AuthLayout`, title "Join a planning poker game", text "This guest link is no longer valid." | `assertSee('This guest link is no longer valid.')` | No `GuestJoin` mode for invalid. |
| 55 | History: back to team | estimates.tsx Link | `teams.show` | "Back to the team" link (mockup bar) | text | |
| 56 | History: filter by game | Select | `router.get ?game&q`, `preserveState, replace` | `Select` | `button[aria-label="Game"]`, `[role=option]:has-text(...)`, query `game` | |
| 57 | History: search | form submit | `?q=` | `Input` + submit `Button` | `input[aria-label="Search tasks"]`, `click('Search')` | Re-sync `q` from `filters.q` (old bug, fix). |
| 58 | History: expand rounds | chevron button | client | Row expansion with `PokerRounds open players={row.players}` | `[A=Show rounds]`, `Round 1`, `Ada Facilitator: 5`, `5 × 2`, `Average: 5.5`, `Consensus` | One row open at a time kept. Anonymous: `Anonymous votes`; absent voter `Former member` (PokerRounds does it). |
| 59 | History: pagination | prev/next Links | `?page=n`, `preserveScroll` | `ui/pagination` | `[A=Pagination]` | Only if `lastPage>1`. |
| 60 | History: empty | text | - | `EmptyState` `No estimated tasks yet.` | text | Also used for an empty filter result. |
| 61 | Saved decks: open | Dialog trigger | client | Button "Saved decks" + `Dialog` | `click('Saved decks')`, `No saved decks yet.` | |
| 62 | Create saved deck | DeckDraftForm | `POST teams/{team}/poker-decks {name, cards[], include_unknown, include_coffee}` | `DeckEditor` (`idPrefix` default `deck-new`) from `DeckPicker.onCreate` | `#deck-new-name`, `#deck-new-cards`, `#deck-new-unknown`, `#deck-new-coffee` (`aria checked`), `Save` | Add field takes a comma list (spec). `A deck with this name already exists.` from server errors -> `errors.name`. Max 30 decks. |
| 63 | Edit / delete saved deck | inline form / confirm | `PATCH/DELETE ...poker-decks/{id}` | `DeckPicker.onEdit/onDelete` (confirm inside) | see 8 | `canManage` only; reload `only:['pokerDecks']` on http exception kept. |

## 4. Composition

**Page `pages/poker/show.tsx`** (thin): `<Head>` + `<PokerRoom snapshot deckOptions />`. Inside the container: `<SessionLayout title presence actions timer>` (D1) around the body.

**Containers (`resources/js/components/poker/`)** — all new files, old ones deleted:
- `poker-room.tsx`: `usePokerGame` + `GameProvider` (`game-context.tsx` kept, the file is a hook-style context, not a view), `data-realtime`, session-expired/connection state, `inert`, `GameGone`, layout slots, queue collapse state, cursor preference.
- `room-topbar.tsx`: title editor, badges, watch switch, take control, timer, hide tasks, facilitator menu, copy-guest-link, cursor toggle, language switcher.
- `room-table.tsx`: adapters + `PokerTable` + empty states + story card; `story-card.tsx` (ticket chip, position "n of N", edit/delete, description HTML, source block, conflict, `PokerRounds`).
- `task-queue.tsx` (+ `task-row.tsx`): dnd-kit list (`ol/li`), header "Tasks (n)" with estimated points total (`formatPoints`), Import / Refresh menu, quick add, footer settings link; used in a `<aside id="poker-tasks">` desktop and `Drawer` mobile.
- `room-dock.tsx`: `ReactionBar` (inline) above the deck panel; head text; `PokerDeck`; mobile `VoteDrawer`; spectator variants.
- `room-dialogs.tsx` (or one file each): settings (`SessionSettingsContent` + deck children), share/guest link (`ShareDialog`), hand-over, end/delete `ConfirmDialog`, task form, custom-timer dialog.
- `import-tasks-dialog.tsx` (rewrite), `auto-reveal-triggers.tsx` (kept logic), `room-cursors.tsx` / `room-reactions.tsx` (wrappers on the kept libs).
- `lib/poker/{types,game-reducer,format}.ts`, `hooks/use-poker-game.ts`, `use-poker-channel.ts`, `lib/retro/api.ts` unchanged. Add `lib/poker/deck-payload.ts` (moved `deckPayload`, `deckChoiceFromGame`, `splitCustomCards` from deck-fields).
- `pages/poker/join.tsx` -> `components/poker/join-poker-game.tsx` (container: `GuestJoin` + invalid `EmptyState`).
- `pages/poker/estimates.tsx` -> `components/poker/estimation-history.tsx`.
- `components/teams/saved-decks-dialog.tsx` rewritten (`DeckPicker` + `DeckEditor` in `Dialog`).

**skrum/ + ui/ used**: PokerTable (+ PokerResultPanel inside), PokerDeck/PokerCard, PokerRounds, DeckPicker, DeckEditor, Timer, ReactionBar, ReactionPicker (`picker` slot with frimousse), VoteDrawer, PresenceStack, ConnectionState, ShareDialog, GuestJoin, SessionSettingsContent, ConfirmDialog, FormDialog, EmptyState, Badge, Switch, Button, Select, Combobox, Tabs, Table, Pagination, Dialog, Drawer, DropdownMenu, Alert, Collapsible, Skeleton, Toggle.

**Composed from primitives (no component)**: task queue and rows, story card, ticket chip, source/sync/conflict block, quick add, task form (Write/Preview), import dialog, hand-over dialog, custom-timer dialog, observer banner, dock head, estimation table (mockup: Table with title+ticket, estimate pill, date, voters pile, rounds badge), "Back to the team" bars.

**Adapters (server -> props)**
- Seat: for each `snapshot.players` seated (online, or offline and voted, or spectator who voted in a revealed non-anonymous round): `{user:{id:p.id, name:p.name, avatarUrl:p.avatarUrl, presence: member?.presence, isMe: p.id===me.playerId}, state: voted? 'voted' : 'waiting'; spectator online -> 'watching'; offline & no vote -> excluded (old rule); value: revealed && !round.anonymous ? vote.value : null; offline: !onlineIds.has(p.id)}`. Spectator who voted before a non-anonymous reveal -> `state:'voted'` (notes-for-18e).
- `PokerTable`: `story={key: task.external?.key, title: task.title, url: task.external?.url}`, `revealed=round.revealedAt!==null`, `result=round.result`, `anonymous=round.anonymous`, `revealReason`, `facilitatorId=game.facilitatorPlayerId`, `isFacilitator=me.isFacilitator`, `isNumeric=game.isNumeric`, `estimate=task.estimate ?? undefined`, `estimateValues=game.cards.filter(!isSpecialCard)`, `nextDisabled=nextUnestimatedTask(snapshot)===null`, `busy`, `locale` (shared prop), `tableLabel` default.
- `PokerDeck`: `values=game.cards`, `value=round.myVote`, `disabled=!round||revealed||ended||busy||!me.canVote`, `onChange=play`, `onRetract=withdraw`.
- `Timer`: `remainingSeconds=useCountdown(round.timerEndsAt, serverOffset)`, `totalSeconds` kept in a ref when the timer starts (the server sends only `timerEndsAt`), `onStart/onCustom/onStop` only for facilitator on an open round.
- `PokerRounds`: `rounds` from `GET rounds`, `players=snapshot.players`, `count=task.roundsCount`, `status` from the fetch state.
- `PresenceStack`: `Participant{id, name, avatarUrl, presence, role: facilitator/guest/member, status:'online'}` from `online` joined with `players` (`isGuest`, `facilitatorPlayerId`).
- `ShareDialog`: `session{id: game.id, kind:'poker', title}`, `invite{url: game.guestUrl, allowGuests: game.guestAccessEnabled}`, `canManage=me.isFacilitator && !ended`, `channels` from `snapshot.share` keys that are true.
- Estimates: `EstimatedTaskRow` -> table row; voters count = `row.players.length`; rounds badge warning when `roundsCount>1`; `PokerRounds rounds={row.rounds}` (revealed only; header count `roundsCount`).
- Saved decks: `SavedPokerDeck{id,name,cards[],canManage}` -> `Deck{id,name,values: cards.filter(!special), unknownCard: includes('?'), breakCard: includes('☕'), source:'saved', canManage}`; built-ins from `pokerDeckOptions` (`source:'builtin'`) optional (D3).

## 5. Realtime

One presence channel `poker.{gameId}` via `use-poker-channel` (unchanged); events `.task.saved .task.deleted .tasks.reordered .vote.changed .round.changed .game.changed .game.deleted .timer.changed` handled by `use-poker-game` (unchanged) and land in `PokerRoom` state; no event is listened to in presentational components. Presence -> `online` (seats, watching row, `PresenceStack`, whisper allow-list, `departures`). Whispers: `client-cursor` (`LiveCursors` over `<main>`), `client-reaction` (engine behind `ReactionBar`, origin = avatar with `data-presence-id`; receive limit burst 5, 2/s kept). Reconnect: `here`/error resync 250 ms; `data-realtime`. Two-browser checks that must keep passing: vote hidden then revealed for both (P10a-07/08), reorder across browsers (KeyboardDragTest), timer countdown on both (P10b-08), auto-reveal when last voter votes or leaves (P10b-06/07), cursors named between rounds only and none while a round is open (P10b-04/05), reactions toggled off for everyone (P10b-12), guest regenerate link ends guest access (P10a-14), ended/reopen sync (P10a-12).

## 6. Mockup elements not rendered / elements with no mockup

**Not rendered (spec 10 or no back end)**: ticket type and label chips, acceptance criteria block, "similar stories", Jira JQL import and story-description import (backlog), Jira description in the story, "Dispersion"/"écart"/outlier ring and "open discussion with extremes" (`outliers`, `median`, `agreement` not computed by the server, ruling 10: pass nothing; spread line derives from distribution only), `Round n · vote en cours` badge is fine (round number exists), "Réfléchit" wording follows PokerTable. Estimation history: deck filter, period filter, "Re-voted only", deck column, **Export CSV** (no route, not in spec 9 and not clearly in 10: gap to report), voters pile with avatars (rows carry only names: show count, avatars via `players` names only if cheap). Saved decks: "Default" deck, usage count, **Duplicate**, locked built-in cards (no routes) — render DeckPicker without them. ShareDialog: role, expiry, members tab, QR download unless free. Seat "Spectator Eye badge in presence strip": `Participant` has no flag; keep Eye via `labels`/avatar title or drop (decide D5).

**No mockup (designed from neighbours)**: facilitator menu and all its dialogs, settings dialog (SessionSettingsContent + dev example), share/guest-link, hand-over, end/delete, task form (Write/Preview), import dialog, source/sync/conflict block, quick-add vs dialog, title editor, take control, cursor toggle, language switcher, game gone, session expired, empty states, custom timer dialog, invalid join page, estimation history expansion rows. Method: ScreenPokerQueue grammar (Card, `Badge`, `Alert`, `DropdownMenu`) and the ScreenSettings dialogs.

## 7. Back-end changes

None required by spec 9. Gaps to report (do not plan): Export CSV, deck/period/re-voted filters on estimates, Duplicate/Default/usage on saved decks, `median/agreement/outliers` in `PokerResult`, spectator flag for presence.

## 8. Browser tests

Files: `Walkthroughs/Plan10aPokerCoreTest.php` (20 tests, `P10a-*`), `Plan10bPokerAdditionsTest.php` (~28), `Plan12cPokerTrackersTest.php` (14), `Plan14cTrackersTest.php` + `Plan14dStatusSyncTest.php` (poker rows: `Sync pending`, `Synced to Jira/GitHub`, `Export to ...` aria labels belong to action items; poker side `[A=Source]`), `Smoke/KeyboardDragTest.php`, `Smoke/RealtimeTest.php`, `Smoke/QueuedBroadcastTest.php`, `Plan12bIntegrationsSharingTest.php` (Share…), `Plan14bOutgoingWebhooksTest.php` (poker events), `Support/InteractsWithBrowser.php` (`awaitRealtime`, `joinAsGuest`, `dragWithKeyboard`).

Bound selectors summary: `[A=Play N]`, `[A=Your cards]`, `[A=Facilitator menu]`, `[A=Estimate]`, `[A=Timer]`, `[A=Reactions]`, `[A=Send a reaction E]`, `[A=Hide/Show my cursor]`, `[A=Guest link]`, `[A=Back to the team]`, `[A=Players]`, `[A=Player options]`, `[A=N online]`, `[A=Drag to reorder]`, `[A=Delete task]`, `[A=More task actions]`, `[A=Source]`, `[A=Choose a board/sprint/team]`, `[D=poker-task-row]`, `[role=img][aria-label="Bob: Voted"]`, `section[aria-label="Anonymous votes"]`, `[role=timer]`, `.lc-overlay`, `[data-presence-id]`, ids `#poker-task-title #poker-timer-minutes #poker-guest-link-access #poker-auto-reveal #poker-anonymous-votes #poker-cursors #poker-reactions #spectator #deck-new-* #deck-custom-cards #poker-tasks`, and texts in section 3.

**Tests that MUST change (mockup/component imposed)**
1. P10b-01, 02a, 02b (Saved decks): `New deck` -> `Create a deck`/tile "Create a custom deck"; `Edit deck`/`Delete deck` become `Edit <name>`/`Delete <name>` (DeckPicker L256/273); chips selector `[role="dialog"] li span.font-mono` (DeckPreviewStrip markup differs); confirm "Delete this deck?" / button "Delete deck" stays (L329-334). Cite ScreenPokerQueue frame c/d "tuile Create a custom deck".
2. P10a-02, P10a-03 (`[role=radio]:has-text("Custom")`): new-game dialog = group 1; the same radio does not exist in DeckPicker. Coordinate with group 1; if the settings dialog is used here, P10b-02c/16 `Your team's decks` -> DeckPicker headings "Built-in"/"Saved" (or pass a label, D3).
3. P10a-05, P10a-14 (`#poker-guest-link-access`, `Create a new link`): add `guestSwitchId` to ShareDialog (preferred, no test change) or edit; the confirm step adds one click.
4. P10b-11 second `click('Watch only')` of a watching player: label stays "Watch only" (switch); verify the test still reads.
5. P10a-04b / KeyboardDragTest: stays if queue is `<ol><li>` (see risks).
6. P10a-15 (estimates): `button[aria-label="Game"]` stays (Select trigger name), `Search` button stays; `5 × 2` and `Ada Facilitator: 5` come from PokerRounds (L276-293: `:name: :value` format to verify).
7. P10a-06/P10b-03 join: `click('Join')` and `fill('name')` survive; add assertion for kind label.

**New tests (`[P18e3-nn]`, one file `Plan18e3PokerRewriteTest.php`)**: 01 mobile 390 queue drawer opens/closes and votes via VoteDrawer; 02 observer banner "Join the vote" returns the deck; 03 Hide tasks collapses `#poker-tasks` (`aria-pressed`); 04 reactions bar sits above the deck without overlap (bounding boxes); 05 estimation history table row shows voters count and rounds badge; 06 saved deck duplicate-name error; 07 dark/light visual captures of the room (reveal before/after, observer) in `Visual/` with FR+EN. Vitest: adapter tests (`seatsFrom`, `deckFrom`, `deckPayload`, `nextUnestimatedTask` already covered).

## 9. Risks and open questions

- `SessionLayout` takes slot props (`title, phases, timer, presence, actions`) but app.tsx assigns layouts by name with no slot channel; live state (online, timer, title edit) lives in the page container. Shared with groups 2, 6, 7. See D1.
- `components/realtime/flying-reactions.tsx` couples engine and toolbar (fixed `bottom-28`); the new `ReactionBar` must replace the toolbar. Used by retro, whiteboard (`board-reactions.tsx`), poker. Owner must be group 2 (first in order); poker waits or duplicates (forbidden: two versions).
- `retro/{connection-banner,session-expired-banner,presence-strip,timer-display,live-cursor-layer}` and `emoji-picker` are shared with whiteboard/games/retro. Poker must not delete them; if group 2 deletes them first poker breaks at build. Order or a shared "shell" commit needed.
- `components/poker/deck-fields.tsx` is imported by `components/teams/new-poker-game-dialog.tsx` (group 1) and `saved-decks-dialog.tsx` (mine). Delete only after both migrated; `lib/poker/format.ts` stays for the team page (group 4).
- `PokerTable` places Re-vote/Estimate/Save/Next in its result panel, while the mockup puts them in the dock beside the deck (Queue frame a). Using the component as is is my default; the dock then only holds reactions + deck + head text.
- Queue markup: `document.querySelectorAll("ol li")` in KeyboardDragTest indexes the first matching list; `PokerRounds` or seats must not use `ol/li` earlier in the DOM (PokerRounds/PokerTable markup not checked).
- `PresenceStack`'s `data-presence-id` on avatars (reaction origin, `img[data-presence-id][alt="Visitor"]`, 5 test uses) not verified in `presence-stack.tsx`.
- `Timer` total for the ring: server sends only `timerEndsAt`; store the chosen seconds locally (late joiners have no ring fraction) — pass `totalSeconds` undefined then (fraction hidden).
- Settings dialog bypasses `run()` by design (inline errors); keep, else P10b tests on errors change.
- Drawer controlled without trigger: use `useRestoreFocus` (notes).
- `GuestJoin.loginUrl` required but the poker props have none: use Wayfinder `login()`; confirm design intent for a guest already signed out.
- Poker `Head` title uses the initial prop (old behaviour); keep.
- 600-line import dialog: highest regression risk (12c/14c tests); copy logic verbatim, restyle only.
- Size of commit 3.1 (~25 files); split as 3.1a/b/c, each must keep the room functional.

**Decisions needed (product owner)**
- D1 (shared, technical): how pages feed `SessionLayout` slots: page renders `<SessionLayout>` itself with `layout: null` kept (my default, no app.tsx change, loses layout persistence) vs `setLayoutProps` in effect. Needs one answer for groups 2, 3, 6, 7.
- D2: who extracts the shared reaction engine and `beep()` helper (default: group 2, before poker).
- D3: Saved decks stay a dialog on the team page (default; no new route) while the mockup shows full pages with Default, Duplicate, usage. Render built-in decks (locked) in the dialog? Custom radio in the game settings: replace by "Create a deck" tile (default).
- D4: add `guestSwitchId` to ShareDialog (default) vs edit tests P10a-05/14.
- D5: spectator Eye badge in the presence stack: drop or add a `Participant.spectator` flag.
- D6: Export CSV and estimation-history filters (deck, period, re-voted only) are shown in the mockup but have no back end: confirm they are backlog.
- D7: label of the reveal button: keep "Show votes" (default, 8 tests) vs mockup "Reveal cards".

## 10. Size

~20 containers/files to write (poker-room, topbar, table, story-card, queue, row, dock, 6 dialogs, import, auto-reveal, cursors, reactions, join, history, saved-decks, deck-payload helper), plus ~6 Vitest files. Deleted: 32 files of `components/poker/` (all but `deck-fields.tsx` initially) + `components/poker/game-context.tsx` kept = ~31, plus old bodies of 3 pages and the saved-decks dialog. Tests touched: ~10 existing browser tests edited, 1 new file (~7 tests), visual captures. Lang keys: ~60 new, 4 files.

Parallelism: group 3 can run alone on `components/poker/**`, `pages/poker/**`, `components/teams/saved-decks-dialog.tsx`. Shared files it touches or depends on: `layouts/skrum/session-layout.tsx` and `app.tsx` (only if D1 chooses `setLayoutProps`), `components/realtime/flying-reactions.tsx`, `retro/{connection-banner,session-expired-banner,presence-strip,timer-display,live-cursor-layer}.tsx`, `components/skrum/share-dialog.tsx` (guest switch id), `lang/*.json` (merge conflicts), `components/teams/new-poker-game-dialog.tsx` (group 1). Run after group 2 starts its shared extractions, before group 4 merges (team page imports `formatPoints`).
