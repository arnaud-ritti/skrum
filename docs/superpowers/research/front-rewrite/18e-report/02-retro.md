# Group 2 — Retro

## Task R1 — Eight column colours (B10)

### Parity (brief 02 §7.4)

| Row | Change | Done |
|---|---|---|
| `ColumnColor` (PHP) | eight cases: `sun`, `apricot`, `coral`, `plum`, `iris`, `sky`, `lagoon`, `moss` | yes |
| Migration (up only) | `2026_10_15_100300_map_column_colors_to_the_eight_theme_colors`: `columns` and `workspace_template_columns`, green→moss, red→coral, blue→sky, amber→sun, purple→plum, slate→iris | yes |
| Built-in catalogue | the 52 templates use the new values, same mapping | yes |
| Column, workspace-template and retro-creation endpoints | no code change (`Rule::enum`); the six old values answer 422 on `color` / `columns.*.color` | yes |
| Factories | `ColumnColor::Moss` | yes |
| Front type | one union, `ColumnColor` of `lib/retro/types.ts`, re-exported by `skrum/column-color-picker.tsx`; `ServerColumnColor`, `DesignColumnColor`, `AnyColumnColor`, `serverColumnColors` are gone | yes |
| Colour list | `columnColors` and `ColumnColorOptions` of `skrum/column-color-picker.tsx` are the only list; `lib/retro/colors.ts` is deleted | yes |
| Add a column on the board | `ColumnColorOptions` in the form (radios named Sun … Moss), default Moss | yes |
| Recolour a column on the board | the eight `menuitemradio` of the column menu, named Sun … Moss | yes |
| Workspace templates page | the colour select lists the eight colours | yes |
| Language files | "Amber" and "Slate" removed (unused); "Green", "Red", "Blue", "Purple" stay: the whiteboard sticky tool and the drawing toolbar still use them | yes |

### Places left

None: R1 changes data and a colour list, not a layout.

### Differences with the mockup

None found on the bench captures (`design-system-retro-column`, `-retro-card`, `-template-editor`, `-card-group`, `-retro-template-picker`, `session-create`). The captures of `card-group` and `retro-template-picker` are byte-identical to the ones before the change, which shows the old values were already drawn with the colours they are now mapped to. The add-column form and the column menu of the board are the old board components until R3 and R4 replace them; they are not compared with a mockup here.

## Task R2 — Guest join and session ended

### Parity (brief 02 §3.6 rows 99–101; brief 11 §3 rows 32, 35–39)

| Row | Feature | Now | Done |
|---|---|---|---|
| 02-99, 11-32 | Join as guest: nickname, max 50, prefilled with the signed-in user's name, POST `join/{guestToken}` | `GuestJoinPage kind="retro"` → `GuestJoin`; `#name`, button "Join", `router.post(RetroJoinsController.store.url(token))` | yes |
| 11-35 | Server error under the nickname | `errors.name` of the page props → `error` of `GuestJoin` | yes |
| 11-36 | Button disabled while the request runs | `processing` of `GuestJoinPage` | yes |
| 02-100, 11-37 | Invalid link, HTTP 404: "Join a retrospective", "This guest link is no longer valid." | `AccessNotice` (through `GuestJoinPage` with `session={null}`) | yes |
| 11-38 | Head title: the retro title, or "Join a retrospective" | `<Head>` in the page | yes |
| 02-101, 11-39 | Session ended: "Your session has ended.", "Guests: ask the facilitator for the guest link.", "Log in" → `login()` | `AccessNotice` with `hint` and a full-width `Button asChild` `Link`; shared by the four session types | yes |
| M28 | Facilitator, people present, state | the `session` prop of R2a (B45) | yes |

### Places left

- Guest colour picker (GU-1) and short session code (GU-2), deviation D-32: both regions are inside `skrum/guest-join.tsx` (`takenColors` / `initialPresence` and `session.code`). `GuestJoinPage` does not pass them today, so nothing is drawn; the later feature passes them and nothing else moves.

### Differences with the mockup

Captures `retro-join-*`, `retro-join-invalid-*`, `retro-session-ended-*` against `components/GuestJoin/preview.html` and `components/MobileAccess`.

| Difference | Covered by |
|---|---|
| No colour picker, no coloured avatar preview (a neutral outline avatar), no session code | D-32 |
| No random nickname ("Loutre pensive"), no "random name" button, and no line "Suggested nickname if you leave it empty" under the preview (it would be false: nothing is suggested; `GuestJoin` now shows it only with `defaultName`). An empty nickname is refused by the server and the error shows under the field | D-32 (GU-1 brings the guest identity); row 11-32 |
| The logo is drawn twice: in the header of the centred `AuthFrame` (with the language switcher) and in the card, as the mockup's card has it | no row — reported; `AuthFrame` and `GuestJoin` are Task 0.7 / 18c components |
| At 390 the action is `sticky` inside the card and sits above the privacy line; the mockup of `MobileAccess` glues it to the bottom of the screen. When the card is shorter than the screen the two look the same but for the order | no row — reported; `GuestJoin stickyAction` is an 18c component |
| The invalid link and the ended session have no mockup: designed from neighbours (`AccessNotice`, brief 11 line 14) | — |

## Task R3 — Session shell of the board

`components/retro/board.tsx` renders `SessionShell kind="retro"`. Every phase body is still the old component, mounted inside the shell (R4 to R12 replace them).

### Parity (brief 02 §3.1 rows 1–29)

| Row | Feature | Now | Done |
|---|---|---|---|
| 1 | Back to the team (members only) | `SessionTitle backHref` in `BoardTitle` | yes |
| 2 | Phase list | `PhaseStepper` in the header (`BoardPhases`); the completed state is the stepper's "Completed" badge, not a step of the rail | yes |
| 3 | Previous phase | `PhaseStepper`: "Previous", always rendered, `aria-disabled` on the first phase | yes |
| 4 | Next / Complete | `PhaseStepper`: "Next", "Complete" on the last phase; and the main button of the facilitator bar (names the next phase, "End session" on the last) | yes |
| 5 | Reopen | `PhaseStepper reopenTo` = the last phase before the completed state | yes |
| 6 | Start timer 1, 3, 5, 10 | `SessionTimer onStart` (`BoardTimer`) | yes |
| 7 | Stop timer | `SessionTimer onStop`; disabled while no timer runs | yes |
| 8 | Countdown, end toast, beep | `SessionTimer` (Task 0.5) | yes |
| new | "+2 min" (2-D8, B20) | `SessionTimer onExtend` posts to `retros.timer.extension.store` and applies the answered `timerEndsAt`; facilitator only, while a timer runs | yes |
| 9 | Presence | `SessionPresence` | yes |
| 10 | Hide / show my cursor | `CursorToggle` in the header from `md`; an entry of the menu below | yes |
| 11 | Language switch (guests) | `LanguageSwitcher` in the header from `md`; in the row under the header below | yes |
| 12 | Lock badge | `Badge` after the title; its text shows from `2xl`, is read by screen readers below | yes |
| 13 | Facilitator menu | `[aria-label="Facilitator menu"]`: "Settings…", "Hand over facilitation…", "Delete retrospective…"; no "Guest link…" (2-D11) | yes |
| 14 | Settings, only changed keys sent | `SessionSettingsPopover` + `useRetroSettingGroups` (`BoardSettings`); "Apply"; opened by the settings button of the header and by the menu entry; read-only for a participant | yes |
| 15 | Settings errors; 401/419 closes | field errors under their row, other refusals as a toast; closes when the session has expired | yes |
| 16 | Allow guests | `ShareDialog` switch (`#guest-access`) | yes |
| 17 | Copy guest link | `ShareDialog` "Copy link", `input[aria-label="Guest link"]`; QR code and "Download the QR code" (M29) | yes |
| 18 | Create a new link | `ShareDialog`, behind a confirmation | yes |
| 19 | Share | "Share" in the header for the facilitator (always: the guest link lives there) and for whoever may post the link; once completed it is the menu entry "Share…" | yes |
| 20 | Post the link to a channel, with or without the guest link | `ShareDialog channels` / `onShareToChannel`; toast "The message is on its way." | yes |
| 21 | Delivery lines | `ShareDialog channelsExtra` = `DeliveryLines` | yes |
| 22 | Hand over facilitation | `FormDialog` + `Select` (`HandoverDialog`); without a candidate, the sentence and Cancel only | yes |
| 23 | Delete retrospective | destructive `ConfirmDialog` (`role="alertdialog"`), with the count of open action items | yes |
| 24 | Reconnecting | the shell's banner and the compact state of the header | yes |
| 25 | Session expired, Reload, inert board | the shell's banner; the facilitator bar and the reaction bar are inside the inert content | yes |
| 26 | Board ended / deleted | `BoardEnded`: the shell with the title only and an `EmptyState` | yes |
| 27 | Flying reactions | `SessionReactions` (`BoardReactions`), above the facilitator bar | yes |
| 28 | Live cursors | `LiveCursors` (`BoardCursors`), off in Voting and once completed | yes |
| 29 | Head title | unchanged (`pages/retros/show.tsx`) | yes |

What the old header also held, until the task of its phase gives it a place: vote progress (R8), carried action items (R10), group name suggestions (R7) and "Add survey" (S1) sit in a row above the board (`[data-slot="retro-phase-tools"]`).

Facilitator bar (ruling 28), `facilitatorActions(phase, board, tools)`: Lock board in Health check, Icebreaker, Writing and Grouping; Lock board and Hide vote counts in Voting; Presentation mode in Discussing; nothing once completed. The main button names the next phase; "End session" from the last one.

### Places left

| Slot | Where | Roadmap |
|---|---|---|
| `start` of `FacilitatorDock` | after the role chip: the mockup's Pause | backlog (D-10) |
| actions of the phase | `facilitatorActions` returns the list of a phase: "Anonymity: on" (R4), "Reveal the votes" (R8), "Everyone follows", Previous / Next topic (R9); "Reveal the cards", "Undo last group" | R4, R8, R9; backlog (D-10) |
| subline of the title | `SessionTitle` takes one line; the mockup's "team · sprint" line above the title | TM-1 (sprint name) |

### Differences with the mockup

Captures `retro-board-facilitator-*` (Writing), `retro-board-participant-*` (Voting, locked board), `retro-board-completed-*` against `ScreenRetroWriting`, `ScreenRetroVote`, `FacilitatorBar`, `PhaseStepper`, `SessionSettingsPopover`, `ShareDialog` and `MobileRetro`. The real page is captured (signed in, realtime connected); there is no bench section, because the board only exists with its channel. Compared by the implementer on light 1440 EN, light 1440 FR, dark 1440 EN and dark 390 FR, against the markup of the previews.

| Difference | Covered by |
|---|---|
| The columns, cards, composer, help banner and the bodies of every phase are the old components | not a difference of this task: R4 to R12 |
| The optional Health check phase is a step of the rail | D-03 |
| The facilitator bar has no Pause, no "Reveal the cards", no "Undo last group" | D-10 |
| The facilitator bar has no "Anonymity: on", "Reveal the votes" (today the toggle "Hide vote counts"), "Everyone follows" and Previous / Next topic (today the toggle "Presentation mode") | built by R4 (M4), R8 (M5), R9 (M6) |
| "End session" is the main button in Discussing, the last phase until B1 | D-04 once R10 and R11 add Actions and ROTI |
| The reaction picker also offers "More emoji…" | D-01 |
| The compact connection state of the header is hidden from assistive technology | D-05 |
| "+2 min", and the menu that starts and stops the timer, sit beside the countdown in the header; the mockups put "+2 min" in the facilitator bar | no row — as the plan's Task 0.5 and R3 interface say (`SessionTimer onExtend`). For the owner |
| The header also holds "Previous" and "Next" (the `PhaseStepper` of 18c), the settings button, the cursor toggle and the "…" facilitator menu; the mockup's topbar has the rail, the timer, the people and Share only | spec ruling 27 (settings and share in every phase), brief rows 3, 4, 10, 13; the browser suite binds `press('Next')`. No row — for the owner |
| At 1440 the rail shows numbered markers and the label of the current phase only (the stepper shows every label from 56rem of room; the header leaves it about 46rem). The mockup shows the seven labels. At 1728 every label shows | no row — the stepper's own rule (`PhaseStepper/README.md`); reported |
| No "team · sprint" line above the title | no row — the snapshot holds no team name and the product has no sprint (TM-1). Reported |
| "Lock board" is in the bar from Health check to Voting; the mockups show it in Grouping only | ruling 28 (every existing facilitator action has a slot) |
| The reaction bar is on every phase; the Writing mockup draws none | ruling 27 |
| Vote progress, "Add survey", the carried action items and the group-name suggestions sit in a row above the board | transitional: R7, R8, R10, S1 place them |
| Live cursors keep the look of the `live-cursors` library | brief 02 risk 7 (kept by decision of the brief; `.lc-overlay` is bound by 17 assertions) |
| Phone: the stepper, with "Previous" and "Next", is a row under the header; no phase subtitle under the title; columns scroll sideways; the facilitator's timer is in the facilitator bar; Share, the settings and the cursor toggle are in the "…" menu | R13 builds the phone board (tabs, FAB, drawers); the header budget is the one of `18e-report/00-preparation.md` |
| The board that ended or was deleted has no mockup: the shell with the title and an `EmptyState` | plan Task 0.3 |

### Browser tests changed

Listed by the plan: the settings flow (`Plan04`, `Plan06`, `Plan07`, `Plan08a`, `Plan08b`, `Plan08d`, `Plan08e`, `Plan09a`: "Apply", then Escape, because the popover stays open after applying; `Plan13d` has no such flow); the guest link in the Share dialog with its confirmation (`Plan04` `P04-10`, `P04-14d`; `Plan12b` `P12b-01c`); `Time's up!` as the accessible name of the timer (`Plan04` `P04-08b`).

Not listed, imposed by the shell and its components:

| Test | Change | Cause |
|---|---|---|
| every `header > h1` of the retro files (22 uses) | `header >> h1` | the frame wraps the title (plan Task 0.3). `header h1`, which the plan gives, has no CSS character: Pest reads it as a text to find, so it cannot be used |
| `P04-04` | `[role="progressbar"][aria-label="Votes cast"]` | `PhaseStepper` has a progress bar of its own |
| `P04-15a` | the scrolling board is `[data-slot="retro-columns"]`; at 375 the stepper is under the header, at 1440 inside it; the page never scrolls sideways | the frame owns `<main>` and a header of fixed height |
| `P07-01a` | the scrolling board is `[data-slot="retro-columns"]` | same |
| `P08a-02a`, `P08a-04c` | "Previous" is present and `aria-disabled` on the first phase | `PhaseStepper` keeps its buttons mounted |
| `P08a-01b`, `P08a-02a`, `P08a-04c`, `P08b-02` | the phase order is read from `[data-slot="phase-step"]` and no longer ends with "Completed" | the completed state is the stepper's badge, not a step |
| `P08a-05` | Escape instead of "Cancel" | the settings popover has no Cancel |
| `P09a-05` | `[role="alertdialog"]` | the delete confirmation is a `ConfirmDialog` |
| `Plan12b`, `Plan14a`, `Plan14b` (7 uses) | "Share the board" → "Post a link" | the Share dialog is titled "Invite to :title" |
| `P12b-01c` | the facilitator has "Share" without any channel, and the dialog shows no "Post a link" | the guest link lives in the Share dialog only (2-D11) |

No test was removed.

## Task R4 — Writing phase

`components/retro/columns-board.tsx`, `board-column.tsx` and `board-card.tsx` draw the columns and the cards of every phase on `skrum/RetroColumn` and `skrum/RetroCard`; `lib/retro/adapters.ts` maps the snapshot to their props. Votes, reactions, comments, the group name and "Ungroup" keep their old controls, mounted in the card's `footer` and `children` slots, until R7, R8 and R9 move them onto the card's own props.

### Parity (brief 02 §3.2 rows 30–39, §3.3 rows 40–48 and 67)

| Row | Feature | Now | Done |
|---|---|---|---|
| 30 | Add a column (title and colour) | `AddColumnForm` in `columns-board.tsx`: `Input` "Column title", `ColumnColorOptions`, "Add column"; facilitator, until Writing ends; resets after a column is added | yes |
| 31 | Rename a column | `RetroColumn onRename`; disabled with the reason when the column has cards | yes |
| 32 | Edit the description | `RetroColumn onDescriptionChange` (`FormDialog`, "Save"); stays open when the server refuses | yes |
| 33 | Recolour | `RetroColumn onColorChange`: the eight colours are a "Color" submenu of radio items named Sun … Moss | yes |
| 34 | Move left / right | `RetroColumn onMove`, `canMoveLeft`, `canMoveRight` | yes |
| 35 | Delete a column | `RetroColumn onDelete` (`ConfirmDialog`, `role="alertdialog"`); stays open with the toast when the column has received a card meanwhile | yes |
| 36 | Description, card count | `RetroColumn description` (shown under the title, no longer in a tooltip), `count` | yes |
| 37 | `data-test="retro-column-{id}"` | rest prop of `RetroColumn`; the columns are inside the frame's `<main>` | yes |
| 38 | Sort by votes (Discussing, Completed) | `RetroColumn sortedByVotes`, `onSortByVotesChange`; on by default | yes |
| 39 | Empty board | `EmptyState` "No columns yet." with a sentence for the facilitator and one for the others | yes |
| 40 | Write a card | `CardComposer`: a `RetroCard` in editing, always open, in a `<form>`; the field is named "Add a card…" (2-D12); Enter or "Add"; empties itself and keeps the focus after a card is published | yes |
| 41 | Attach a GIF | "GIF" in the editor tools opens `GifSearchDialog` (0.13) with `isolation={dragIsolation}`; "Remove GIF"; the preview is the card's `gif` | yes |
| 42 | Edit a card | `RetroCard editing`, `onEditStart`, `onEdit`, `onEditCancel`; Enter or "Save", Esc or "Cancel"; the toast "The phase changed before your edit was saved." is kept | yes |
| 43 | Delete a card | `RetroCard onDelete`; one request on a double click; the snapshot is taken again (writers count) | yes |
| 44 | Reorder or move one's card | `SortableCard` (`dnd.tsx`) around the card; `data-test="retro-card-handle-{id}"`, `aria-pressed`, `aria-disabled` | yes |
| 45 | `#card-{id}`, masked state | `RetroCard` default id, `masked`; the sentence is the component's "Hidden until the reveal" | yes |
| 46 | "You", author, anonymous | `RetroCard isMine`, `author` (avatar and first name, full name as title), "Anonymous" without author | yes |
| 47 | GIF at full size | `RetroCard onGifOpen` and `CardGifDialog` | yes |
| 48 | Card insight | `RetroCard insight` | yes |
| 67 | Drag overlay, announcements, isolation | `dnd.tsx` rewritten in place: same ids, same announcements, `dragIsolation` unchanged; the column is the drop zone (`RetroColumn isDropTarget`, "Drop here"); the preview is `CardPreview`, outside `<main>` | yes |
| M4 | "n cards · x/y have written" | `WritingBanner`: `writersCount` over the people present (never fewer than the writers) | yes |
| M4 | "Visible only to you" | under one's own cards in Writing | yes |
| M4 | "Anonymity: on" | a state in the facilitator bar (`end` slot), in Writing on an anonymous retro | yes |

### Places left

| Slot | Where | Roadmap |
|---|---|---|
| `typing` of `ColumnsBoard` → `WritingBanner` | in the help banner, before the counter | RT-1 |
| `typing` of `BoardColumn` | after the cards of a column: the mockup's "… is writing a card" line | RT-1 |
| avatar ring "writing" | `SessionPresence presenceFor` (Task 0.4) | RT-1 |
| "Pause" | `facilitatorActions` is a list: the action goes first, before the timer's "+2 min" | RT-2 |

### Differences with the mockup

Captures `retro-board-facilitator-*` and `retro-board-anonymous-*` (Writing) against `ScreenRetroWriting`, `RetroColumn` and `RetroCard`. Compared by the implementer on light 1440 EN (both names) and dark 390 FR (both names), against the markup of the previews.

| Difference | Covered by |
|---|---|
| Each column ends with a card kept open for writing, with "GIF" and "Add"; the mockup has the dashed "Add a card" button and one card in editing | owner answer 2-D12 (the 13 uses of `[aria-label="Add a card…"]` stay). No row — for the owner |
| The editing card has "Add" (composer) or "Cancel" and "Save" (edit), and "GIF"; the mockup has the two key hints and the counter only | parity rows 40–42 (a touch screen has no Esc; the suite binds the buttons). No row — reported |
| "Visible only to you" is on its own line under the author, right-aligned; the mockup has it on the author's line | the card's footer also holds "You", edit and delete: a 300px card has no room. No row — reported |
| My card on an anonymous retro shows my name and "You", not "Anonymous" | the server sends its author to the author only; the mockup's per-card anonymity is not a concept of the product (brief 02 §6). No row — reported |
| No "… is writing a card", no ring on the avatar | D-10 (RT-1) |
| No Pause, no "Reveal the cards" in the facilitator bar | D-10 |
| "+2 min" is beside the countdown, not in the bar | reported in R3 |
| The counter is 1000 characters, the mockup's 280 | the server rule (`max:1000`) |
| The dragged card leaves a dimmed card, not the dashed ghost | the ghost of `RetroCard` drops the reactions and comments still mounted under the card: the board would move under the drag. R7 can use the ghost once they are props. No row — reported |
| A column in a phase other than Writing, or on a locked board, shows the padlock "Adding cards is locked" | `RetroColumn/README.md` |
| The add-column form (facilitator) is a fifth box and the columns stay at 300px at 1440 | no mockup (parity row 30) |
| "Add survey" above the banner | transitional (S1) |
| Phone: the columns scroll sideways, the reaction bar floats over the composer | R13 |

### Browser tests changed

The plan lists none. Imposed by `RetroCard` and `RetroColumn` (their README), and by the caption of M4:

| Test | Change | Cause |
|---|---|---|
| `Plan04` (10), `Plan06` (3), `Plan07` (1), `Plan08a` (7) | "Hidden until writing ends" → "Hidden until the reveal"; the three translations of `plan04Locales` | the masked card of `RetroCard` ("Masquée jusqu'à la révélation") |
| `P04-05b` | `class` contains `ring-primary` → `data-focused="true"` | the facilitator's focus ring is `--skrum-info` (`RetroCard/README.md`) |
| `P04-09` | "Bob Stone" in the card → the `title` of `[data-slot="retro-card-author"]` | the card shows the first name |
| `P04-17a`, `P06-03` | "You" is read in `[data-slot="retro-card-mine"]` | "Visible only to you" (M4) also holds the word |
| `P06-06` | `[role="dialog"]` → `[role="alertdialog"]` | the column is deleted through `ConfirmDialog` |
| `P08a` (`p08aColumnTitles`, `P08a-02b`, `P08a-06`) | `h2` → `h3` | the column title of `RetroColumn` |
| `P18e-02-05` | open "Color", then the radio item by its text | the colours are a submenu of `RetroColumn` |

New: `[P18e-02-10]` (named and anonymous retro); capture `retro-board-anonymous`. No test was removed.

## Task R5 — Health check phase

`components/retro/phase-health.tsx` draws the health check on `skrum/HealthCheckForm`, above the columns (which stay editable by the facilitator in this phase); `toHealthStatements` of `lib/retro/adapters.ts` maps the snapshot. `health-check-panel.tsx` is deleted.

### Parity (brief 02 §3.4 rows 68–70)

| Row | Feature | Now | Done |
|---|---|---|---|
| 68 | Score 1 to 10, saved at once | `HealthCheckForm onAnswer` → `PUT retros/{retro}/health-check/{statement}`; the score shows at once and the answered progress replaces the counts. One request per statement at a time: a score chosen while one is on its way waits, and the last one chosen is sent | yes |
| 68 | Keyboard | arrows and the digits (0 is 10) on the focused scale, from the form | yes |
| 68 | Closed board | `disabled`: the 10 scores of every statement are disabled, no "Clear" | yes |
| 68 | Refusal (closed board, other phase) | the toast and a new snapshot, through `ctx.run` | yes |
| 69 | Clear the own answer | `onClear` → `DELETE`; the button reads "Clear" and is named "Clear: :label" | yes |
| 70 | Who answered, how many | `answeredBy` resolved to the participants (picture with the name as its text), `count`; the count alone on an anonymous retro | yes |
| — | "Answered" on the statements one has scored | a check after the label, named "Answered" | yes |
| — | The sentence "Rate each statement from 1 (Awful) to 10 (Great). Only you see your own scores." | the help line above the form | yes |

### Places left

None: the plan names none for this task. `HealthCheckForm onSubmit` (the mockup's "Submit answers") is not passed, so the button is not drawn; the footer keeps the progress on its left and the button's place on its right.

### Differences with the mockup

Captures `retro-board-health-*` (facilitator) and `retro-board-health-locked-*` (participant, closed board) against the "Vue réponse participant" of `HealthCheck/preview.html`. The phase itself has no screen mockup (brief 02 §6: the form in a centred card of the ScreenRetroWriting frame). Compared by the implementer on light 1440 EN (both names) and dark 390 FR.

| Difference | Covered by |
|---|---|
| The phase exists and is a step of the rail | D-03 |
| The scale is 1 to 10 with the ends "Awful" and "Great"; the mockup has 1 to 5, "Strongly disagree" and "Strongly agree". Below 32rem of card the ten scores are two rows of five | the server rule (`score` 1..10) and `P08b-03c`. No row — reported |
| No "Submit answers": each score is saved on its own and can be changed until the phase ends | N: no submit endpoint (the component's `onSubmit` is its place). No row — reported |
| Under each scale: the pictures of who answered, "n answered", and "Clear" on one's own answers | parity rows 69 and 70. No row — reported |
| A check after the label of a statement one has scored | parity row 68 ("Answered" is bound by `P08b-03a`). No row — reported |
| "Anonymous" and "Your answers are anonymous. Only the team average is shown." are shown on every retro; on a named retro the pictures say who has answered, never what | as the mockup; the scores are never sent to anyone else. For the owner |
| A help line above the card repeats that only the viewer sees their scores | brief 02 §6; `P08b-02` reads the sentence |
| The columns, the add-column form and the reaction bar are under and over the form | parity (columns are editable in this phase), ruling 27 |

### Browser tests changed

The plan left it to the reading of `Plan08bHealthCheckTest.php` against `HealthCheckForm`. The form did not render what the tests bind; by the plan's rule, what the HealthCheck README does not impose was fixed in the component (commit `fix(skrum): health check form …`), and what it imposes changed the test.

| Binding | Was in the form | Fix |
|---|---|---|
| `ol > li` around a statement | a `div` of `fieldset` | component: an `ol`, one `li` per `fieldset` |
| `[role="radiogroup"][aria-label="<statement>"]` | named by the short label | component: named by the statement |
| `[aria-label="Answered"]` only on one's own answers | the name of the list of respondents | component: a check named "Answered" in the legend; the list is named "n answered" |
| `img[alt="<name>"]` | no `img` with a text | component: `imgProps` of `PersonAvatar` |
| `[role="radio"]:disabled` on a closed board | `aria-disabled` | component: `disabled` disables; a sent form (`submitted`) stays `aria-disabled` and focusable |
| `ol > li > [role="radiogroup"]` (`p08bBoardStatements`) | — | test: `ol > li [role="radiogroup"]`, because the README imposes the `fieldset` and its `legend` between the two |

No test was removed.
