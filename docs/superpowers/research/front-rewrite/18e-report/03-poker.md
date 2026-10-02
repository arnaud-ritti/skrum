# Group 3 — Planning poker

## Task 3.1a — Room on the table model: shell, table, dock, queue

### Parity (brief 03 §3, rows 1–10, 14, 20–26, 32–52)

| # | Action | New control | Done |
|---|---|---|---|
| 1 | Back to team | `SessionTitle` back link, `[aria-label="Back to the team"]`; none for a guest | yes |
| 2 | Rename the game in place | `[aria-label="Game title"]` in the header title, blur or Enter saves, Escape cancels | yes |
| 3 | Deck, Game ended, Anonymous votes, Auto-reveal badges | deck badge beside the title; the others, with "Round n · voting / revealed", in the centre of the header (under it below 1024 px) | yes |
| 4 | Watch only (self) | switch `#poker-watch-only` in a pill labelled "Watch only"; the label stays when on (3-D9); absent on an ended game | yes |
| 5 | Make player / Make spectator | `[aria-label="Player options"]` on each seat and each watcher but one's own | yes |
| 6 | "You're watching" notice | banner under the header (`role="status"`), same sentence, with "Join the vote"; the dock says "Deck disabled while you watch only" and shows the deck disabled | yes |
| 7 | Hide / Show tasks | header button, `aria-pressed`, `aria-controls="poker-tasks"`, from 1024 px | yes |
| 8 | Open tasks on a small screen | "Tasks" button, bottom `Drawer` (`#poker-tasks`), focus returned on close | yes |
| 9 | Take control | "Take control" in the header (in the bar under it on a phone) | yes |
| 10 | Facilitator menu | `FacilitatorMenu` of `room-topbar.tsx` (3.1b), `[aria-label="Facilitator menu"]` | yes |
| 14 | Copy guest link (member who does not facilitate) | `[aria-label="Copy guest link"]`, from 768 px | yes |
| 20 | Hide / Show my cursor | `CursorToggle`, while cursors are shown, from 768 px | yes |
| 21 | Language switcher (guest) | `LanguageSwitcher` in the header | yes |
| 22 | Presence | `SessionPresence`; the spectator eye is dropped (3-D5) | yes |
| 23 | Add task | "Add a task…" + "Add" (title only) and "Add task" (full form, `TaskFormDialog` of `room-dialogs.tsx`); "Add task" of the empty table | yes |
| 24 | Edit / delete task | story card icons, `[aria-label="Edit task"]`, `[aria-label="Delete task"]`, "Delete this task?" | yes |
| 25 | Select the current task | queue row button, `aria-current="true"`, closes the drawer | yes |
| 26 | Reorder | dnd-kit in the queue `<ol>`, `[aria-label="Drag to reorder"]` | yes |
| 32 | Rounds of the task | `PokerRounds` in the story card, "Rounds (n)", fetched when opened | yes |
| 33 | Estimate on the story | badge "Estimate: 5" | yes |
| 34 | Play / withdraw a card | `PokerDeck selection="toggle"`, `[aria-label="Your cards"]`; "All deck" opens `VoteDrawer` on a phone | yes |
| 35 | Seats | `PokerTable`, `section[aria-label="Players"]`, `[role="img"][aria-label="Bob: Voted"]` | yes |
| 36 | Reveal | "Reveal cards" in the table centre (3-D7), `R` | yes |
| 37 | Timer | `SessionTimer` in the header: 1, 3, 5, 10 min, "Custom…" (`#poker-timer-minutes`), "Stop timer", "+2 min" (X5, B20) | yes |
| 38 | "Time's up!" | toast and beep of `SessionTimer`; the pill is named "Time's up!" (X4) | yes |
| 39 | Re-vote, Estimate, Save estimate, Next task | `FacilitatorBar` in the dock (3-D8), `[data-slot="facilitator-bar"]`; `N` and `⌘/Ctrl ↵` kept | yes |
| 40 | Result | `PokerResultPanel`, `[aria-labelledby="poker-result"]`: average, nearest card, median, spread, agreement, distribution, who opens the discussion (M14) | yes |
| 41 | Auto-reveal nudge | `auto-reveal-triggers.tsx`, unchanged | yes |
| 42 | Reactions | `SessionReactions variant="inline"` above the deck panel, compact on a phone | yes |
| 43 | Live cursors | `LiveCursors` over the story and the table, between rounds only | yes |
| 44, 45, 47 | Reconnecting, session expired, `data-realtime` | `SessionShell kind="poker"` | yes |
| 46 | Game gone | `EmptyState`, "This game was deleted." / "Your access to this game has ended.", "Back to the team" for a member | yes |
| 48 | Empty states | "Add the first task", "Pick a task to start voting", "Waiting for the facilitator to pick a task" | yes |
| 49 | Ended game | read-only: no switch, no reactions, no cursors, deck disabled, no facilitator bar | yes |
| 50 | Anonymous round | `section[aria-label="Anonymous votes"]`, seats face down, nobody named | yes |
| 51 | Markdown description | story card, server HTML | yes |
| 52 | Page title | `<Head title>` | yes |

Added by the mockup: the place of the task ("3 / 6 in this game"), the points estimated in the queue header, the "Facilitator settings" block of the queue (deck, automatic reveal as a switch, who watches).

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| Type and label chips, description and acceptance criteria of the ticket, under the title of the story | `details` of `StoryCard` (`components/poker/story-card.tsx`) | PK-1 |

### Differences with the mockup

| Difference | Row |
|---|---|
| No ticket type, labels, acceptance criteria, Jira description; no spectator eye in presence | D-16 |
| The timer menu keeps "Custom…" | D-02 |
| No "Atlas · Planning poker" line above the title, no user avatar at the end of the header: the session shell of Task 0 has neither | no row: reported |
| "Share" of the header: built in 3.1b (see below) | — |
| The banner keeps the sentence "You're watching — switch to Play to vote" | plan, "Unchanged and checked" |
| The switch of the queue reads "Reveal automatically when everyone has voted or the timer ends" (the mockup: "Auto-reveal when everyone voted", false here: the timer reveals too) | no row: reason F |
| A queue row shows the bare estimate ("3"), not "3 pts": false on a T-shirt deck, and `P10a-09` reads the badges | no row: reason F |
| "Votes: n" only on the current task: the server sends the votes of the current round only | no row: reported |
| No drop line while dragging: the rows move apart (dnd-kit) | no row: reported |
| The figures are in a panel under the table (the plan's composition), with the average, the median and the spread repeated in the oval; the mockups put them in the oval (Queue) or in the dock (After). At 900 px of height the panel is reached by scrolling | plan, 3.1a composition |
| No final-estimate cards and no "Validate 5 pts · Next story": the Estimate select and two buttons (3-D8) | owner 3-D8 |
| Rounds are closed by default (the mockup shows them open): `P10a-09` opens them | browser contract |
| A round lists "name: value"; the mockup lists values only | browser contract (`P10a-09`) |
| Watchers are in a dashed box above the seats, in the flow, not laid over the corner of the table: the seats spread over the whole width | no row: reported |
| Seat names are full names cut to the seat, the mockup shows first names; the viewer reads "You" | no row: reported |
| On a phone the table is under the story card and is reached by scrolling; the mockup's row of participants is the table's own grid | no row: reported |

## Task 3.1b — Room dialogs

### Parity (brief 03 §3, rows 11–13, 15–19)

| # | Action | New control | Done |
|---|---|---|---|
| 10 | Facilitator menu | `FacilitatorMenu`: "Share…" (when a channel is connected; always on a phone, where the header has no Share button), "Settings…", "Hand over facilitation…", "End game" / "Reopen game", "Delete game…". No "Guest link…" (7-D2). Nothing opens once the session has expired | yes |
| 11 | Share to a channel | `ShareDialog` (`kind="poker"`): "Post link to Slack"…, toast "The message is on its way.", `DeliveryLines` under the buttons | yes |
| 12 | Guest link: allow, copy | `ShareDialog`: switch `#poker-guest-link-access`, `input[aria-label="Guest link"]`, "Copy link", QR code with "Download the QR code" | yes |
| 13 | Create a new guest link | "Create a new link", confirmed in an `alertdialog` ("Create a new link?") | yes |
| 15 | Settings | `SessionSettingsContent` in a `Dialog` (`[data-slot="poker-settings"]`), "Game settings": `#poker-title`, `#poker-auto-reveal`, `#poker-anonymous-votes`, `#poker-cursors`, `#poker-reactions`; "Apply (n)"; server messages under their field; "Applies from the next round." when anonymity is turned off | yes |
| 16 | Deck of the game | `DeckPicker` (built-in, saved with the "Saved" / "Workspace" badge, "This game only") and `DeckEditor idPrefix="deck-custom"` behind "Create a deck"; "Manage decks" goes to the saved decks page; locked, with the cards shown, once votes exist | yes |
| 17 | Hand over facilitation | `FormDialog`, `#poker-new-facilitator`, "Hand over"; "No one else can facilitate this game yet." with Cancel only | yes |
| 18 | End game / Reopen | `ConfirmDialog` "End this game?"; "Reopen game" acts from the menu | yes |
| 19 | Delete game | `ConfirmDialog tone="destructive"` "Delete this game?", then the team page | yes |
| 23 | Task form | `FormDialog`: `#poker-task-title`, Markdown description with Write / Preview tabs, "Save" | yes |
| 37 | Custom timer | `FormDialog` "Custom minutes", `#poker-timer-minutes`, "Start timer" | yes |

The guest-access switch left the settings: it is in the Share dialog only (7-D2).

### Places left

None in this task.

### Differences with the mockup

These dialogs have no mockup of their own (brief §6): they follow `ShareDialog/README.md`, `Dialog/README.md`, the settings popover and `DeckPicker/README.md`.

| Difference | Row |
|---|---|
| Share dialog: no session code, default role, expiry, members tab | D-16 (share roles), D-32 (short code) |
| Share dialog: the description reads ":count present" without the team name (the room does not receive it) | no row: reported |
| The header's "Share" shows its label from 96rem; below it is an icon with a tooltip (the header also holds "Watch only" and "Hide tasks", which the mockup's header does not) | no row: reported |
| The game settings are a dialog, not a popover anchored to a header button: the entry is the facilitator menu (browser contract "Settings…") | plan, 3.1b |
| The deck editor of the settings has no name field: the settings endpoint cannot save a deck | no row: reason F |
| End and Delete are alert dialogs (`Dialog/README.md`) | — |
