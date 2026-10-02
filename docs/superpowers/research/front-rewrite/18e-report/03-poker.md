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
| 7 | Hide / Show tasks | header button, `aria-expanded`, `aria-controls="poker-tasks"` while the panel is shown (as ScreenPokerQueue), from 1024 px | yes |
| 8 | Open tasks on a small screen | "Tasks" button, bottom `Drawer` (`#poker-tasks`), focus returned on close | yes |
| 9 | Take control | "Take control" in the header (in the bar under it on a phone) | yes |
| 10 | Facilitator menu | `FacilitatorMenu` of `room-topbar.tsx` (3.1b), `[aria-label="Facilitator menu"]` | yes |
| 14 | Copy guest link (member who does not facilitate) | `[aria-label="Copy guest link"]`: in the header from 768 px, in the bar under it on a phone | yes |
| 20 | Hide / Show my cursor | `CursorToggle`, while cursors are shown, from 768 px | yes |
| 21 | Language switcher (guest) | `LanguageSwitcher` in the header | yes |
| 22 | Presence | `SessionPresence`; the spectator eye is dropped (3-D5) | yes |
| 23 | Add task | "Add a task…" + "Add" (title only) and "Add task" (full form, `TaskFormDialog` of `room-dialogs.tsx`); "Add task" of the empty table | yes |
| 24 | Edit / delete task | story card icons, `[aria-label="Edit task"]`, `[aria-label="Delete task"]`, "Delete this task?" in a `ConfirmDialog tone="destructive"` (`alertdialog`) | yes |
| 25 | Select the current task | queue row button, `aria-current="true"`, closes the drawer | yes |
| 26 | Reorder | dnd-kit in the queue `<ol>`, `[aria-label="Drag to reorder"]` | yes |
| 32 | Rounds of the task | `PokerRounds` in the story card, "Rounds (n)", fetched when opened | yes |
| 33 | Estimate on the story | badge "Estimate: 5" | yes |
| 34 | Play / withdraw a card | `PokerDeck selection="toggle"`, `[aria-label="Your cards"]`; "All deck" opens `VoteDrawer` on a phone | yes |
| 35 | Seats | `PokerTable`, `section[aria-label="Players"]`, `[role="img"][aria-label="Bob: Voted"]` | yes |
| 36 | Reveal | "Reveal cards" in the table centre (3-D7), `R` | yes |
| 37 | Timer | `SessionTimer` in the header: 1, 3, 5, 10 min, "Custom…" (`#poker-timer-minutes`), "Stop timer", "+2 min" (X5, B20) | yes |
| 38 | "Time's up!" | toast and beep of `SessionTimer`; the pill is named "Time's up!" (X4) | yes |
| 39 | Re-vote, Estimate, Save estimate, Next task | `FacilitatorBar` in the dock (3-D8), `[data-slot="facilitator-bar"]`; `N` and `⌘/Ctrl ↵` kept, both live once the cards are revealed (as in the old result panel); "Next task" stays a button before the reveal | yes |
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
| No "Atlas · Planning poker" line above the title, no user avatar at the end of the header: the session shell of Task 0 has neither | D-69 |
| "Share" of the header: built in 3.1b (see below) | — |
| The banner keeps the sentence "You're watching — switch to Play to vote" | plan, "Unchanged and checked" |
| The switch of the queue reads "Reveal automatically when everyone has voted or the timer ends" (the mockup: "Auto-reveal when everyone voted", false here: the timer reveals too) | D-68 |
| A queue row shows the bare estimate ("3"), not "3 pts": false on a T-shirt deck, and `P10a-09` reads the badges | D-68 |
| "Votes: n" only on the current task: the server sends the votes of the current round only | D-68 |
| No drop line while dragging: the rows move apart (dnd-kit) | D-68 |
| The figures are in a panel under the table (the plan's composition), with the average, the median and the spread repeated in the oval; the mockups put them in the oval (Queue) or in the dock (After). At 900 px of height the panel is under the fold: a reveal scrolls it into view, and on a phone the deck folds away once revealed | D-64 |
| No final-estimate cards and no "Validate 5 pts · Next story": the Estimate select and two buttons (3-D8) | D-65 |
| Rounds are closed by default (the mockup shows them open): `P10a-09` opens them | D-67 |
| A round lists "name: value"; the mockup lists values only | D-67 |
| Watchers are in a dashed box above the seats, in the flow, not laid over the corner of the table: the seats spread over the whole width | D-66 |
| Seat names are full names cut to the seat, the mockup shows first names; the viewer reads "You" | D-66 |
| On a phone the table is under the story card and is reached by scrolling; the mockup's row of participants is the table's own grid | D-66 |

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
| Share dialog: the description reads ":count present" without the team name (the room does not receive it) | D-69 |
| The header's "Share" shows its label from 96rem; below it is an icon with a tooltip (the header also holds "Watch only" and "Hide tasks", which the mockup's header does not) | D-69 |
| The game settings are a dialog, not a popover anchored to a header button: the entry is the facilitator menu (browser contract "Settings…") | D-70 |
| The deck editor of the settings has no name field: the settings endpoint cannot save a deck | D-70 |
| End and Delete are alert dialogs (`Dialog/README.md`) | — |

## Task 3.1c — Import, source details, sync and conflict

### Parity (brief 03 §3, rows 27–31)

| # | Action | New control | Done |
|---|---|---|---|
| 27 | Import tasks | `Dialog` (`[data-slot="poker-import"]`), "Import tasks": source as a segmented `ToggleGroup` (`[aria-label="Source"]`, when more than one tracker), mode as line `Tabs` (`[aria-label="Import from Jira"]`: Sprint / Query), board search (`#import-container-search`, 300 ms) and its `Select` (`[aria-label="Choose a board"]`), sprint `Select` (`[aria-label="Choose a sprint"]`), `#import-query`, "Show issues", "Select all", one checkbox per issue named by its key, "Already imported", "Showing the first 100. Narrow the query.", "Import n tasks", toast ":imported imported, :skipped skipped." | yes |
| 28 | Refresh from the source | `[aria-label="More task actions"]` of the queue header, "Refresh from Jira" (3.1a, unchanged) | yes |
| 29 | Ticket, assignee, source estimate, sync state, status, not found, managed note | ticket link first in the head of the story (`a[data-slot="ticket"]`, new tab); under the title: "Assignee: …", "Jira estimate: …", the badges "Synced to Jira" / "Sync pending" / "Sync failed" / "Not synced: …", ":status in Jira" / "Done in Jira", "Not found in Jira"; the error of a failed sync; the note "The title and description are managed in Jira…". Ticket chip on a queue row (`[data-slot="badge"]`), with the "Done in Jira" mark. A guest gets the ticket and the note only | yes |
| 30 | Sync again / Retry | outline button in the same line, facilitator, task estimated | yes |
| 31 | Estimate conflict | warning `Alert` (`[data-slot="estimate-conflict"]`, `role="status"`) "Changed in Jira to 8", "Keep skrum estimate", "Use Jira estimate" (disabled, with ":value is not in this deck.", when the deck has no such card) | yes |

### Places left

None in this task (the `details` slot of the story card, 3.1a, is unchanged and sits between the title and the source block).

### Differences with the mockup

The import dialog, the source block and the conflict have no mockup (brief §6). They follow `Dialog/README.md`, `Tabs`, `ToggleGroup`, `Badge` and the `sk-ticket` of ScreenPokerQueue.

| Difference | Row |
|---|---|
| No ticket type badge ("Story") after the ticket of the story | D-16 |
| The board is a search field and a select, not a `Combobox` (brief row 27): the search is done by the tracker (300 ms debounce, kept), `Combobox` filters its own options and has no query callback, and `[aria-label="Choose a board"]` then `[role="option"]` is the browser contract | D-71 |
| The ticket of a queue row shows a check when the issue is done in its tracker; the mockup's ticket has no state | D-71 |
| The story of an imported task carries a block the mockup does not draw (assignee, tracker estimate, sync state, status, note): parity rows 29–31 | D-71 |

## Task 3.2 — Guest join

### Parity (brief 03 §3, rows 53–54; brief 11 §3, row 33)

| # | Action | New control | Done |
|---|---|---|---|
| 53 | Join as a guest | `GuestJoinPage kind="poker"`: `#name` ("Your nickname", prefilled with the name of a signed-in user), "Join", posts to `poker/join/{token}`; the session card shows the game title, "Live", the number of players and who facilitates (M28); "Log in" link | yes |
| 33 | Join as spectator | `Switch#spectator` (`role="switch"`, `name="spectator" value="1"`) with its label "Join as spectator" (3-D10); the POST carries `spectator=1` only when on (`P10b-03` reads `is_spectator` in the database) | yes |
| 54 | Invalid link | `AccessNotice` in the centred `AuthLayout`: "Join a planning poker game", "This guest link is no longer valid.", HTTP 404, no form | yes |

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| Avatar colour picker | `takenColors` of `GuestJoin` (not passed) | GU-1 |
| Session code | `session.code` of `GuestJoin` (not passed) | GU-2 |

Both belong to the shared component of Task 0.7; this page adds no slot of its own.

### Differences with the mockup

Compared with `GuestJoin/preview.html` on `poker-join-*` and `poker-join-invalid-*` (light and dark, 390 and 1440).

| Difference | Row |
|---|---|
| No colour picker, no code; the avatar of the preview is neutral | D-32 |
| The button reads "Join", the mockup "Join the session" | browser contract (`joinAsGuest` clicks "Join") |
| "Join as spectator" switch between the preview and the button: the mockup has no poker variant | owner 3-D10 |
| The logo is shown twice, in the frame and in the card | shared component; fixed on the integration branch by `550323e9`, which this lane does not hold |
| The mark of the session is the poker spade on the iris tone, the mockup shows the retro icon on the primary tone | `GuestJoin` picks icon and tone per session type |
| The invalid link is a notice card; no mockup draws it | brief row 54 |

## Task 3.3 — Estimation history

### Parity (brief 03 §3, rows 55–60)

| # | Action | New control | Done |
|---|---|---|---|
| 55 | Back to the team | "Back to the team" link above the heading; the team is also the first breadcrumb of `AppLayout` | yes |
| 56 | Filter by game | `Select` (`button[aria-label="Game"]`, "All games"), query `game`, `preserveState`, `replace` | yes |
| 57 | Search | `input[aria-label="Search tasks"]` with the search icon and the "Search" button, query `q`; the field shows the search of the server again after a visit (old bug fixed) | yes |
| 58 | Rounds of a task | the Rounds cell: the count (warning pill when the task was voted again) and `[aria-label="Show rounds"]` / "Hide rounds" (`aria-expanded`); one task open at a time; `PokerRounds open statistics` under the row: "name: value", "Anonymous votes", "Former member", "Average", "Consensus", and per round the distribution ("5 × 2"), the median and the agreement (3.0a) | yes |
| 59 | Pagination | `nav[aria-label="Pagination"]` with Previous / Next (`preserveScroll`), only when there is more than one page; the range "1–50 of 64" always | yes |
| 60 | Empty | `EmptyState` "No estimated tasks yet.", also for an empty filter result, then with "Clear filters" | yes |

The Game column of the old table is the second line of the Task cell. Added by the mockup and B40: Deck column, voters as avatars (three and the count; the count alone for an anonymous round), the estimate pill, the summary ":count tasks estimated by :team". Below 768 px the table is a list of cards (README, "Mobile").

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| "Export CSV" at the end of the heading | `actions` of `EstimationHistory` (`components/poker/estimation-history.tsx`) | backlog (D-17) |
| Deck and period filters, "Re-voted only" | `extraFilters` of `EstimationHistory`, after the game filter | backlog (D-17) |

### Differences with the mockup

Compared with frames c and d of `ScreenPokerQueue/preview.html` on `poker-estimates-*`, `poker-estimates-rounds-*` and `poker-estimates-empty-*` (light and dark, 390 and 1440).

| Difference | Row |
|---|---|
| No deck filter, period filter, "Re-voted only", "Export CSV" | D-17 |
| The page is under `AppLayout` (sidebar, breadcrumb in the topbar), not a panel with its own bar; the saved decks page is a page of its own, not a second panel | D-72 |
| Under the title of a task: the name of its game, not a ticket key. The row does not carry the key of an imported task | D-72 |
| The summary reads "6 tasks estimated by Atlas", without "across 12 games": the page knows the games of the team, not how many of them hold an estimate; with a filter it reads the team name only | D-72 |
| A "Search" button after the field; the placeholder is "Search tasks" (the search reads titles only) | D-72 |
| The Rounds cell has a chevron button beside the count, and the row opens on the rounds; the mockup's rows do not open | D-72 |
| Previous / Next carry chevrons (`Pagination`), the mockup arrows; absent on a single page | D-72 |
| The date reads "Sep 30" in English (the locale's order) and carries the year when it is not the current one | D-72 |
| The avatars of the voters sit about 2 px above the line of the count | no row: a defect to fix, not a deviation |

## Review fixes of lane P

- Rows D-64 to D-72 of the plan's "Deviations from the mockup" now carry the differences above that had no row. They were written in the review and none has the owner's word yet.
- Focus: a reveal or a re-vote made from the dock moves focus to the result, or to the deck (to the seats for a watcher), when the pressed control leaves.
- The result panel is scrolled into view when the cards are revealed; on a phone the deck folds away once revealed and the facilitator bar loses its separator.
- "Copy guest link" is in the phone bar; the story card is keyed by its task; the role menu reads the player's role; `N` is live after the reveal only; "Hide tasks" carries `aria-expanded`; the custom timer dialog stays open when refused and says the range; "Delete this task?" is an alert dialog.
- Browser tests changed: `P18e-03-01` (member at 390 reads "Copy guest link"), `P18e-03-03` (`aria-expanded`, no `aria-controls` once collapsed), `P10a-10` (`[role="alertdialog"]` for the task deletion).
- Read against the mockup and not a difference: a queue row of ScreenPokerQueue holds the ticket and the title, no description line.

## Integration of wave 2b

Captures opened after the merge, light 1440 and dark 390: room voting, room revealed, source and conflict, import, settings, share, join, estimation history (list and rounds). Compared with renderings of `ScreenPokerQueue`, `ScreenPokerBefore`, `ScreenPokerAfter`, `MobilePoker` and `GuestJoin` (`preview.html` with `_preview-bundle.css`, files in `/tmp` only; the renderings lack the fonts and the tokens, so structure and content were compared, not colours or spacing).

Fixed at the integration:

| Difference | Fix |
|---|---|
| The join page showed the logo twice | merged with `550323e9` of wave 2a: one logo; the 16 `poker-join-*` captures are regenerated |
| The join page had no document title (the old page had one) | `<Head>`: the game title, or "Join a planning poker game" for a dead link |
| The Share dialog showed a "Post a link" heading with nothing under it when the team has no channel | the block is passed only when a delivery exists |
| The Share dialog read "1 présents" | new key "1 present" in the four languages, used by every Share dialog |
| Closing guest access with a guest in the game cut the guest off at once | asks first ("Turn off guest access?"), as the games room and the whiteboard do |

Remaining, all with a row:

| Difference | Row |
|---|---|
| Result panel under the fold at 1440 × 900, and behind the reactions strip at 390 until the reveal scrolls it into view | D-64 |
| No final-estimate cards | D-65 |
| Watchers box in the flow, full names on the seats, phone grid under the story | D-66 |
| Rounds closed by default, "name: value" | D-67 |
| Bare estimate in a queue row, "Votes: n" on the current task only, the long auto-reveal sentence | D-68 |
| No overline, no user avatar, "Share" as an icon below 96rem | D-69 |
| Settings as a dialog | D-70 |
| Import, source and conflict have no mockup | D-71 |
| Estimation history: game title under the task, no "across n games", "Search" button, chevrons | D-72 |
| No deck or period filter, no "Re-voted only", no "Export CSV" | D-17 |

Fix later (defects, not deviations):

- The voter avatars of the estimation history sit about 2 px above their count.
- In a real-page capture only the viewer is online, so the other seats read "Offline" and their "…" menu shows under the name; at 1440 the bottom seats' menu is cut by the reactions strip until the stage is scrolled.
- The settings dialog names itself twice to a screen reader (hidden dialog title, then the panel heading).

## Rework RW-P1 — result in the oval and the dock, final-estimate cards (owner, fourth round)

Rows D-64 and D-65. Built:

- No result panel under the table (`PokerTable` takes `showResult={false}`). The oval keeps the average, the median and the spread.
- The dock holds the result once the cards are revealed, in place of the deck (`RoomResult` on `skrum/PokerResultBar`): "Result · n votes", the nearest card, the reason of an automatic reveal, the viewer's card, the agreement, the distribution (with its table view) and the line naming the extremes. The section keeps `aria-labelledby="poker-result"`.
- Facilitator: the final-estimate cards (radio group "Final estimate": the deck without "?" and the break, the saved estimate or the nearest card chosen), "Validate :value · Next story" ("Validate :value" when no other task waits) and "Re-vote". The button calls `PokerTaskEstimatesController@update` then `PokerCurrentTasksController@update`; when the second fails the estimate stays saved and the error shows. Ctrl/Cmd + Enter validates.
- Focus goes to the result on a reveal when it was on the control that left (the Reveal button, a card of the deck) or on the page; focus that stands in a dialog or a field is left alone.
- Phone (MobilePoker): the result is a card of the page under the seats, with the final-estimate cards; the dock keeps "Re-vote" (icon) and the validate button.

### Parity

| Feature before | Now |
|---|---|
| Average, median, spread | oval |
| Nearest card, agreement, distribution, table view, extremes, reveal reason | dock (card on a phone) |
| "Most played" figure | read in the agreement ("50 % on 5") and, on a deck without numbers, in the oval |
| Estimate select | final-estimate cards |
| "Save estimate" | "Validate :value" (and the next story when one waits) |
| "Next task" after the reveal | the validate button; N still moves on without saving; the queue opens any task |
| "Next task" before the reveal | unchanged |
| Disabled deck after the reveal, with the played card pressed | the deck gives its place to the result; "Your card · n" in its heading line |
| Anonymous votes listed under the seats | unchanged |

### Differences with the mockup

| Difference | Row |
|---|---|
| The dock does not repeat the average and the median; "Spread" is a badge of the oval | D-64 |
| "Nearest card", the reveal reason, "Your card" and "View as table" in the dock | D-64 |
| Every card of the deck as a final estimate, in a scrolling row centred on the chosen card | D-65 |
| "Validate 5 · Next story" without "pts"; no "discuss with the extremes" button | D-65 |
| At 1440 × 900 with the watchers box and the banner, the bottom row of seats is under the fold (the stage scrolls); the oval and the dock are in view | D-66 (watchers box in the flow) |
| On a phone the result card is under the seats: a reveal that takes focus brings it into view, otherwise the page is scrolled by hand | D-66 (RW-P2 turns the seats into one scrolling row) |
