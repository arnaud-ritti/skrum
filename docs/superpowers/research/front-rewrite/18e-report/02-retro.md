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

## Task R6 — Icebreaker phase in the new frame

`board.tsx` mounts the old stage (`icebreaker-stage.tsx`, `icebreaker-game.tsx`) in the body of the session shell, in place of the columns; Task R3 had already moved the mount with the board, so this task checks it, tests it and captures it. One change was needed: `GamePanel` drew its own `main` inside the `main` of the shell (two landmarks on the page). It now takes `landmark` (default `true`, the game room is unchanged); the icebreaker passes `false` (commit `fix(games): …`). Task G6 rewrites the stage on the mockup and deletes the two retro files.

### Parity (brief 02 row 71; brief 06 §3 rows 57–63)

| Row | Feature | Now | Done |
|---|---|---|---|
| 71 / 57 | The stage replaces the columns in the phase `icebreaker`; a spinner while `board.icebreaker` is null | `BoardBody` returns `IcebreakerStage`: no column, no add-column form, no health form. `section[aria-label="Icebreaker game"]` | yes |
| 58 | Slim bar "Icebreaker", the game select of the facilitator (`[aria-label="Game"]`) or the game badge, "History" | old `icebreaker-game.tsx`, unchanged | yes |
| 59 | The game runs on the retro's presence channel; players unknown to the snapshot are fetched again | old hooks, unchanged | yes |
| 60 | Live cursors over the stage | `BoardCursors` on the stage element; the header's cursor toggle hides one's own | yes |
| 61 | Not mounted: room timer menu, copy link, invite, room menu, presence strip, "Reset scores" | unchanged: the chrome is the board's (`SessionShell`) | yes |
| 62 | The board timer is the game timer; "Time's up" in the stage | `withBoardTimer`, unchanged; the header's `SessionTimer` is the only timer control (in the facilitator bar below `md`). `TimeUpBadge` is not added (G6) | yes |
| 63 | "Games we played" in the results | untouched | yes |
| — | Reaction bar and facilitator bar ("Lock board", "Writing") over the stage | the board's; the body keeps the room of the two bars under the game (`pb-32`) | yes |

### Places left

None: the plan names none for this task.

### Differences with the mockup

Captures `retro-board-icebreaker-*` (facilitator, before the round) and `retro-board-icebreaker-round-*` (participant, a Hangman round running). Looked at by the implementer: light 1440 EN (both names), dark 390 EN and dark 390 FR. The stage is the old one on purpose (plan, Task R6): it is not compared element by element with `ScreenIcebreaker/preview.html`; Task G6 builds that mockup.

| Difference | Covered by |
|---|---|
| The whole stage: the mockup's game cards on the left, the stage card, the players column, the `TimeUpBadge` | Task G6 (the plan keeps the old stage until then) |
| The game is chosen in a select, not by cards | Task G6 (`P13d-06a`, `06b`, `06c` change there) |
| The slim bar "Icebreaker · game · History" has no background of its own over the dotted ground | Task G6 |
| At 390 the players list is under the fold, behind the reaction bar until one scrolls | Task G6 / R13 |

### Browser tests changed

None. `Plan13dIcebreakerScoresInvitesTest.php` passes unchanged. `RetroPagesVisualTest.php` has two more datasets (the captures above); its check "one `main`" is what found the nested landmark.

## Task R7 — Grouping phase

A lead card and the cards grouped under it are drawn by `skrum/CardGroup` (`components/retro/board-group.tsx`, `toGroupProps`): the group is a section around its cards, `#group-{lead id}`. Reactions, comments and the group name are on the props of `RetroCard` and `CardGroup`; `comment-thread.tsx`, `reaction-chips.tsx` and `emoji-picker.tsx` are rewritten in place with the same exports (surveys, games and the session reaction bar still import them). `group-name.tsx`, `group-name-suggestions.tsx`, `card-comments.tsx` and `card-reactions.tsx` are deleted.

### Parity (brief 02 §3.3 rows 49–54, 61–66)

| Row | Feature | Now | Done |
|---|---|---|---|
| 49 | Group two cards by dropping one on the other (pointer and keyboard) | `GroupableCard` around a card or around a whole group; the target shows a dashed outline, a group also its slot "Drop to add to the group" (`CardGroup dropTarget`) | yes |
| 50 | Move a card to another column in Grouping | unchanged: the column is the drop zone (`RetroColumn isDropTarget`) | yes |
| 51 | Ungroup | `CardGroup onUngroup`, in the footer of every card but the lead; Grouping only, open board only | yes |
| 52 | Name, rename, clear the name of a group | `CardGroup onRename` (`null` clears); shown at once, then the answer of the server; Grouping, Voting and Discussing, open board; "Rename group", "Group name", "Name this group" | yes |
| 52 | A group without a name | the text of its first card as title (`CardGroup`), "Name this group" for assistive technology | yes |
| 53 | Suggest group names (anyone, with a provider, an opted-in retro and an unnamed group) | `SuggestGroupNames`: a bar under the Grouping banner with "Card contents of these groups are sent to :provider."; in Voting and Discussing it stays in the row above the board | yes |
| 53 | Suggested name on its group, only for who asked | `CardGroup titleHint`: the chip `[title="Suggested name"]` | yes |
| 54 | "Use this name", "Edit this name" | in the title hint; "Edit this name" opens the title field on the suggestion (`titleDraft`) | yes |
| 53 | "No new names to suggest." | toast | yes |
| 61 | React to a card; chips "👍, 1 reaction", mine pressed; names in a tooltip, none on an anonymous retro | `RetroCard reactions`, `onReact`; shown at once, then the answer of the server | yes |
| 61 | Chips disabled where nobody may react (locked, Writing, completed) | native `disabled`; the names stay reachable on a focusable wrapper | yes |
| 61 | "Add a reaction" | `RetroCard reactionPicker` = `AddReaction`: the menu of six emoji (`[role="menuitem"]`) | yes |
| 62 | Full emoji search | "More emoji…" of the menu opens `EmojiSearchDialog` ("Search emoji…", `button[frimousse-emoji]`) | yes |
| 61 | Reactions off for the retro | no chip, no button | yes |
| 63 | Comments toggle "Comments (n)", `aria-expanded`; hidden on a masked card and in Writing without a comment | `RetroCard commentCount`, `commentsOpen`, `onOpenComments` | yes |
| 63 | Unread dot, read when the thread opens | `UnreadCommentsDot` in the card's `footer` ("Unread comments") | yes |
| 64 | Comment, reply | `CommentThreadList` as the card's `children`; Enter sends, Shift+Enter breaks the line; "Write a comment…", "Write a reply…" | yes |
| 65 | Edit and delete one's comment; the facilitator deletes any; replies folded behind "n replies"; "Comment deleted" | same component | yes |
| 65 | Read-only thread on a locked board and once completed | no field, no button; "No comments yet." when empty | yes |
| 66 | Comment notification toast | unchanged (`use-retro-board.ts`) | yes |
| — | Presentation overlay (old, until R9) | keeps its chips and its comments through `ReactionChips`, `CardThread` and the two hooks of `board-card.tsx` | yes |
| — | Help line of the phase | `GroupingBanner`: the sentence of the mockup, "n groups · n cards", "n online" | yes |
| — | Column counter | every card of the column, grouped ones included, as the mockup counts | yes |

### Places left

| Slot | Where | Roadmap |
|---|---|---|
| `moving` of `BoardColumn` | after the cards of a column: the mockup's "… is moving a card" line | RT-1 |

### Differences with the mockup

Captures `retro-board-grouping-*` (facilitator; one named group, one unnamed, a card with reactions and its comments open) and `retro-board-grouping-locked-*` (participant, anonymous retro, closed board) against `ScreenRetroGrouping`, `CardGroup` and `RetroCard`. Compared by the implementer on light 1440 EN (both names), dark 390 FR, and `design-system-card-group` light 1440 EN.

| Difference | Covered by |
|---|---|
| No duplicate suggestion, no "Likely duplicate" pill, no "Undo last group" | D-10 |
| No "… is moving a card", no cursor holding a card | D-10 (RT-1) |
| The suggestion bar under the banner is the AI group names (sentence and "Suggest group names"), drawn in the frame of the mockup's duplicate suggestion; it shows to everyone, without the Facilitator chip | parity row 53. No row — reported |
| Every card has a "Comments (n)" button, and, where reacting is open, a dashed "Add a reaction" chip on a line of its own; the mockup's cards show the author and the grip only | parity rows 61, 63 (the suite binds both on cards without reactions). No row — reported |
| The grip is on the cards that can be dragged: a card alone. A group is dragged by its whole section and the cards inside it are not draggable (they leave with "Ungroup"); the mockup draws a grip on every card | parity (`P04-03` asserts that a grouped card has no handle). No row — for the owner |
| The dragged card follows the pointer as `CardPreview` (text and author); its place keeps the dashed ghost | as R4 |
| A card that is a drop target has the dashed outline of a group, without a slot | no mockup for a card as target |
| "+2 min" beside the countdown; "Lock board" in the bar | reported in R3 |
| "Add survey" above the banner | transitional (S1) |
| The header rail shows the current label only at 1440 | reported in R3 |
| Phone: columns scroll sideways; no "Add to group…" drawer; an own card keeps an empty line for its hidden edit and delete buttons | R13 |
| The comment thread has no mockup: designed from the card (avatar, name, text, icon buttons, field) | — |

### Browser tests changed

Listed by the plan (group markup, `CardGroup/README.md`): `#card-{lead} …` → `#group-{lead} …` for "Name this group", "Rename group", `[title="Suggested name"]`, "Use this name", "Edit this name" and `#card-{x} #card-{y}` in `Plan04` (`P04-03`) and `Plan08e` (`P08e-02b`, `P08e-06`, `P08e-10c`). `Plan06` and `Plan07` needed no change.

Not listed:

| Test | Change | Cause |
|---|---|---|
| `Plan08d` `P08d-01a`, `01b`, `01c`, `02a` | the same re-anchoring on `#group-{lead}` | same cause; the plan's count of five `#card-{x} #card-{y}` includes the three of this file, which its list of files leaves out |
| `P04-03`, `P04-07` | "Drag cards onto each other to group them." → "Drag a card onto another to group them. Click a title to rename it." | the sentence of the mockup's help banner |

Component fixes, in their own commits: `CardGroup` (`renderCard`, `titleDraft`, `onEditingTitleChange`, drop slot, keys of the title field); `RetroCard` (native `disabled` on chips nobody may press, as `P07-08a` and `P07-08b` read; the names tooltip keeps `data-slot="tooltip-content"`, as `P07-03a` reads).

No test was removed.

## Task R8 — Voting phase

The vote is on the props of `RetroCard` (`votes`, `canVote`, `canUnvote`, `onVote`) and, for a group, on the "Group vote" line of `CardGroup` (`voteControls` = `CardVotes`). `components/retro/phase-voting-bar.tsx` holds the bar above the columns (`PhaseVotingBar`), the request of a vote (`useCardVote`) and the reason of a closed vote; `cardVoting` and `votingProgress` of `lib/retro/adapters.ts` say what a card takes. `vote-controls.tsx` and `vote-progress.tsx` are deleted.

### Parity (brief 02 §3.3 rows 55–57)

| Row | Feature | Now | Done |
|---|---|---|---|
| 55 | Add a vote on a card | `RetroCard onVote(1)`: the thumb button "Add a vote", or `V` on the card; shown at once (`votes.tally`), then the answer of the server | yes |
| 55 | Take a vote back | "Remove a vote" beside my dots, or `Shift+V`; offered on the cards that hold one of my votes, also when the budget is spent (`canUnvote`) | yes |
| 55 | My votes on a card | dots named "Your votes: n" | yes |
| 55 | Budget spent: no vote added | "Add a vote" natively `disabled`; its wrapper says "You have used all your votes" | yes |
| 55 | Closed board: no vote either way | "Add a vote" `disabled` with "Board closed for editing"; no "Remove a vote" | yes |
| 55 | Vote on a group (the lead card on the server) | the line "Group vote" of the group: my dots, "Remove a vote", "Add a vote"; the cards of a group have no vote button | yes |
| 55 | A press made while the last one is on its way | dropped (the old buttons were disabled meanwhile) | yes |
| 56 | Total of a card, live | in the vote button; named "n vote(s)" for assistive technology and the suite (`[aria-label="2 votes"]` inside `#card-{id}`) | yes |
| 56 | Totals hidden (`hide_vote_counts`) | no number, no named total; the bar says "Votes hidden until the reveal" | yes |
| 56 | Totals in Discussing and Completed | unchanged: the badge of the card (R9, R12) | yes |
| 57 | Votes left | `VoteBudget`: "n votes left", one dot per vote, "of n"; the sentence "Votes left: n" stays for the suite, off screen | yes |
| 57 | Progress of the room | "n of m vote(s) cast" over a progress bar named "Votes cast" (`aria-valuenow`, `aria-valuemax`) | yes |
| M5 | "n votes / person" in the FacilitatorBar | a state, not a control (the server locks the limit once voting has started) | yes |
| M5 | "Reveal the votes" / "Hide the votes" in the FacilitatorBar | writes `hide_vote_counts`, as `#retro-hide-vote-counts` of the settings does | yes |
| — | "Lock board" in the FacilitatorBar | unchanged | yes |
| — | Group names in Voting (rename, AI suggestions) | unchanged (R7) | yes |
| — | Live cursors | off in Voting, as before: a pointer over a card tells a vote | yes |

### Places left

| Slot | Where | Roadmap |
|---|---|---|
| `finished` of `PhaseVotingBar` | end of the vote bar, after the progress: "x/y have finished" | RT-4 |
| `done` of `PhaseVotingBar` | end of the vote bar: the participant's "I have finished voting" | RT-4 |
| `cap` of `PhaseVotingBar` | inside the budget, after "of n": "· max n per card" (`VoteBudget detail`); `CardVotes maxPerCard` already exists for the group line, `RetroCard labels.voteBlocked` takes the reason on a card | RT-3 |

### Differences with the mockup

Captures `retro-board-voting-*` (facilitator, totals hidden, two groups, 3 of 5 votes spent) and `retro-board-participant-*` (participant, closed board, totals shown) against `ScreenRetroVote`, `VoteDots`, `RetroCard`, `CardGroup` and `FacilitatorBar`. Compared by the implementer on light 1440 EN (both names) and dark 390 FR (both names).

| Difference | Covered by |
|---|---|
| No "max 2 per card", no "5/8 have finished", no "I have finished voting" | D-11 (RT-3, RT-4) |
| At the end of the bar, where the mockup has "5/8 have finished": "n of m votes cast" over a progress bar | parity row 57 (the suite reads the sentence and the progress bar). No row — reported |
| The vote button is the thumb with the total (`RetroCard` and `VoteDots` mockups); the screen mockup draws "+ Vote" | the component mockups. No row — reported |
| The budget is drawn as `VoteDots` draws it (icon, "n votes left", dots), then "of 5"; the screen mockup puts the dots first | the component mockup |
| "n votes / person" is a state with the vote icon, not a settings button | plan M5 (read-only) |
| "Reveal the votes" is a ghost action of `FacilitatorBar`; the mockup draws it outlined | `FacilitatorBar` has one style of action |
| No live cursor | existing rule: cursors are off in Voting (secrecy of the vote). No row — reported |
| A group line has a "Remove a vote" button beside the dots; the mockup removes a vote by pressing a dot | `VoteDots` mockup (button "−") |
| Every card has "Comments (n)" and, where reacting is open, "Add a reaction" | reported in R7 |
| "+2 min" beside the countdown; "Lock board" in the bar | reported in R3 |
| "Add survey" above the bar | transitional (S1) |
| The header rail shows the current label only at 1440 for the facilitator | reported in R3 |
| Phone: the budget is not stuck to the top, columns scroll sideways, the vote button is not 44 px | R13 |

### Browser tests changed

None. New: `[P18e-02-11]` in `Plan18eRetroTest.php`; capture `retro-board-voting` in `RetroPagesVisualTest.php` (its board has groups and votes in Voting, which redraws `retro-board-participant`).

Component changes, in their own commits: `VoteBudget` (`detail`; "1 vote left"), `CardVotes` (`disabledReason`, `hiddenTotalNote`, focus after the last vote is taken back), `RetroCard` (`canUnvote`: before, a spent budget removed "Remove a vote"), `CardGroup` (`voteControls`).

No test was removed.

## Task R8b — Shared action-item containers

No screen changes: the retro panels and the action items page still mount the twelve old files of `components/action-items/`, which stay until 5.2. The new files sit beside them under new names and are used from R9 on.

| File | What it gives |
|---|---|
| `action-item-adapters.ts` | `toActionItemData` (server item → props of `ActionItem` and `ActionSheet`, with `canComplete`), `patchToPayload` (only what changed), `newItemToPayload`, `ownerOptions`, `toActionItemOwner`; types `NewActionItem`, `ActionItemContext` |
| `use-action-item-mutations.ts` | `useActionItemMutations(endpoints, onSaved, options?)` → `busyId`, `patch`, `setStatus`, `remove`, `retrySync`, `run`, `value`; `ActionItemMutationsContext`; type `RunMutation` |
| `item-subtasks.tsx` | `ItemSubtasks` (slot `children` of `ActionItem` and `ActionSheet`) |
| `item-comments.tsx` | `ItemComments` (slot `comments`) |
| `item-export.tsx` | `ItemExport` (slot `actions`), `ItemExportDialog`, type `IntegrationScope` |
| `item-create-form.tsx` | `ItemCreateForm` |
| `item-delete-confirm.tsx` | `ItemDeleteConfirm` |
| `item-parts.tsx` | `useInlineEscape` (Escape cancels an inline edit and leaves the sheet or dialog open), `AnonymousNote` |
| `test/action-items.ts` | fixtures of the Vitest files of R9, R10, R12 and 5.2 |

How a container wires them: `const mutations = useActionItemMutations(endpoints, onSaved, { run, resync, onRemoved, onCommentCount })`, then `<ActionItemMutationsContext value={mutations.value}>` around the list. `ItemSubtasks`, `ItemComments`, `ItemExport` and `ItemExportDialog` read `run`, `onSaved`, `onCommentCount` and the endpoints of the export from that context and throw without it. On the board, `options.run` is `ctx.run` (it knows the locked board and the expired session); on the page, `options.resync` is the partial reload.

### Parity (brief 05 §3 rows 12–40; brief 02 §3.4 rows 74–82)

"Done" is for the container; the row is done on a screen when R9, R10, R12 or 5.2 mounts it.

| Row | Feature | Now | Done |
|---|---|---|---|
| 05-12, 02-74 | Create: content (500, required), priority (medium), due date (2000-01-01 to 2100-12-31), recurrence (off without a date), assignee | `ItemCreateForm`: "Add an action item…", "Assignee", "Due date" (native date input, a browser test fills it), "Priority", "Repeat"; `newItemToPayload` writes the body of both store endpoints | yes |
| 05-13, 02-75 | Complete, reopen | `setStatus(item, status)`; `canComplete` from `toActionItemData` | yes |
| 05-14 to 18, 02-76 | Edit content, priority, due date, recurrence, assignee | `patch(item, patch)` over `patchToPayload`: an unchanged or empty title sends nothing; clearing the date also stops the recurrence; a member travels as a user, a guest as a participant | yes |
| 05-19, 02-77 | Delete | `ItemDeleteConfirm` ("Delete this action item?", destructive, icon and label), then `remove(item)` (5-D3) | yes |
| 05-20 to 24, 02-78 | Sub-tasks: add (200, hidden at 20), tick, rename, move up and down, delete | `ItemSubtasks`: `ul` "Sub-tasks", a checkbox named by its text, "Add a sub-task", "Move up", "Move down", "Edit sub-task", "Delete sub-task" | yes |
| 05-25 | "n of m sub-tasks done" | printed by `ActionItem` and `ActionSheet` from `subtasks` (off-screen sentence beside `n/m`), not by the checklist | yes |
| 05-26 to 31, 02-79 | Comments: load, retry, add (500), edit by the author, delete by the author or a manager, "Former member", date, refetch on a comment event | `ItemComments` (`revision`); the toggle and `#action-item-{id}-comments` are `ActionItem`'s | yes |
| 05-32, 02-80 | Export: one tracker = a button "Export to :provider", several = a menu "Export"; a tracker already used is left out | `ItemExport` | yes |
| 05-33 to 38 | Export dialog: targets, search after 300 ms, "No project found.", the selected project kept in the options, preview lines, "Manage people" for a workspace manager, 45 s, "Exported as :key.", warnings | `ItemExportDialog`, a port of the old dialog on `Dialog`, `Alert`, `Label`, `LoadingButton` | yes |
| 05-39, 02-81 | Tracker chip | `ActionItem links` (from `toActionItemData`) | yes |
| 05-40, 02-81 | Retry the sync | `retrySync(item, link)`, toast "Sync requested." | yes |
| 02-82 | Anonymous notice | `AnonymousNote` in the create form and above the comment field (`showAnonymousNotice`) | yes |
| 05-49 | Toast and resync on a failed request | `run` of the hook: timeout sentence, message of the server, generic sentence; then `options.resync` | yes |
| 05-50 | Manager, assignee, reviewer | `canComplete` in `toActionItemData`; the container passes `onChange`, `onDelete`, `members`, `ItemExport` only to a manager (`canManageActionItem`) | yes |
| M6 | "Create the ticket in :provider" | `ItemCreateForm exportSources onCreatedWithTicket`: a checkbox for one tracker, a select "Ticket" for several; the item is created, then handed over with its source so that the container opens `ItemExportDialog` on it | yes |

### Places left

| Slot | Where | Roadmap |
|---|---|---|
| `linkedTo` of `ItemCreateForm` | first line of the form: "Linked to #2 · topic" | RT-8 |

### Differences with the mockup

No capture: no screen mounts these files yet, and the task has no bench section. The create form was written against the "New action" block of `ScreenRetroDiscussion` and the quick form of `ScreenRetroActions` and has not been looked at in a browser; R9 captures it.

| Difference | Covered by |
|---|---|
| The due date is a native date input, not the select-like date picker | brief 05 R5 (the suite fills `[aria-label="Due date"]`); `ActionItem` and `ActionSheet` do the same |
| A "Repeat" select beside the three fields of the mockup | parity rows 05-12, 05-17 |
| The ticket is a checkbox "Create the ticket in :provider", not a key field "ATLAS-…" | plan R9 (create, then the existing export) |
| No "⌘ J creates the Jira ticket too" hint or shortcut (`ScreenRetroActions`) | no row — reported for R10 |

### Browser tests changed

None. No test was removed.

## Task R9 — Discussing phase

The board in Discussing no longer shows the columns (owner's answer 2-D9). `components/retro/phase-discussing.tsx` holds the phase: `DiscussionProvider` (who looks at which topic), `PhaseDiscussing` (the three columns) and `PresentationOverlay` (the presentation mode, on `Dialog`). `topics-list.tsx` is the left list, `topic-focus.tsx` the topic in front of the viewer (`BoardGroup` or `BoardCard`, unchanged, so every control and id of the board is there) and "Up next", `action-items-list.tsx` the action items of the retro on the shared containers of R8b, `suggestions-panel.tsx` the suggestions as a panel. `lib/retro/topics.ts` gives `topicsFrom`, `topicOfCard`, `stepTopic`.

How the focus works: everyone browses the topics for themselves (a press in the list, "Previous topic", "Next topic"). A card the facilitator highlights ("Discuss") becomes the topic of everyone, as the highlight scrolled everyone to the card before. "Everyone follows" is the presentation mode (`presentation_mode`): while it is on, the facilitator's own moves highlight their topic, the highlighted topic is presented over the board of everyone (the overlay of before), and a participant who went elsewhere reads "Everyone is looking at another topic." with "Back to the topic".

### Parity (brief 02 §3.3 rows 58–60, §3.4 rows 73–82)

| Row | Feature | Now | Done |
|---|---|---|---|
| 2-D9 | Cards sorted by votes | the Topics list (`data-test="retro-topics"`, an `ol`): one row per group and per lone card, the most voted first, ties by column then card position; rank, colour mark of the column, title, votes | yes |
| 2-D9 | Sort toggle of a column (`retro-sort-by-votes`) | gone in Discussing (the list is the order); it stays on the Board tab of a completed retro | yes |
| 56 | Vote total of a card | the badge of the card (`[aria-label="3 votes"]`), the row of the list, the pill of the focus header | yes |
| 58 | Highlight a card ("Discuss", `aria-pressed`) | on the card of the topic in focus, facilitator only; the row of the list is marked "Now", the card has its ring | yes |
| 59 | Presentation overlay | `PresentationOverlay`: the highlighted topic as its group or card, with reactions and comments; "Stop presenting" for the facilitator, whose close stops it for everyone; a participant closes it for themselves; it opens again on the next highlight | yes |
| 59 | — | new in the overlay, for the facilitator: "Previous topic", "Next topic" (the bar is behind the dialog) | yes |
| 60 | Scroll to the highlighted card | the highlighted topic comes in front of every viewer, and its card is scrolled into view | yes |
| 61–65 | Reactions, emoji picker, comments, replies, edit and delete of a comment, unread dot | unchanged: `BoardCard` | yes |
| 47, 48 | GIF full size, insight | unchanged: `BoardCard` | yes |
| 52–54 | Rename a group, suggested names | unchanged: `BoardGroup`; "Suggest group names" stays above the board | yes |
| 73 | Suggestions panel | `aside[aria-label="Suggestions"]`, a card of the right column; the list inside is the old one (it is shared with the results, R12) | yes |
| 74 | Create an action item | `ItemCreateForm` under "Create an action" (open by default; "Cancel" closes it): title, assignee, due date, priority, repeat | yes |
| M6 | "Create the ticket in :provider" | a member whose team has a tracker: the item is created, then `ItemExportDialog` opens on it | yes |
| 75 | Done, reopen | `ActionItem onStatusChange`; disabled for who may not | yes |
| 76 | Edit content, priority, due date, recurrence, assignee | "Edit action item" opens the editor of `ActionItem` (before: controls always shown on the card); the assignee options keep their two headings, "In this retro" and "Team" | yes |
| 77 | Delete | "Delete action item", then the confirmation (5-D3) | yes |
| 78 | Sub-tasks | `ItemSubtasks` | yes |
| 79 | Comments of an item | `ItemComments`, `#action-item-{id}-comments` | yes |
| 80 | Export | `ItemExport` ("Export to :provider", or the "Export" menu) | yes |
| 81 | Tracker chips, retry of a sync | `ActionItem links`, `onRetrySync` | yes |
| 82 | Anonymous notice | in the form and above the comment field | yes |
| 5-D7 | "(Guest)" | the owner name beside the item and in the options | yes |
| 84, 85 | ROTI in Discussing | `RotiControl`, unchanged, as the last-but-one panel of the right column, until R11 gives it its phase | yes |
| 72 | Surveys | `SurveysColumn`, unchanged, as the last panel of the right column; "Add survey" stays above the board (S1) | yes |
| 83 | Previous action items | unchanged, above the board (R10) | yes |
| — | Live cursors | over the topic stage (the centre column) | yes |
| — | Lock, anonymity, guest | unchanged rules (`isEditable`, `canManageActionItem`) | yes |

### Places left

| Slot | Where | Roadmap |
|---|---|---|
| `timer` of `PhaseDiscussing` | between "Previous topic" and "Next topic" | RT-5 |
| `estimate` of `TopicsList` and of `TopicUpNext` | beside "Topic n of m"; in "Up next" | RT-5 |
| `notes` of `PhaseDiscussing` | first panel of the right column, above the action items (the column is a list of panels) | RT-6 |
| `topicMeta` of `PhaseDiscussing` (`rowMeta` of `TopicsList`) | second line of a topic row: "Discussed · n actions" | RT-7, RT-8 |
| `linkedTo` of `PhaseDiscussing` (`ActionItemsList`, `ItemCreateForm`) | first line of the form: "Linked to #2 · topic" | RT-8 |
| `following` of `PhaseDiscussing` | in the focus banner: the people who follow, "8/8" | backlog |

### Differences with the mockup

Captures `retro-board-discussing-*` (facilitator) and `retro-board-discussing-locked-*` (participant, closed board) against `ScreenRetroDiscussion`, `CardGroup`, `RetroCard`, `ActionItem` and `FacilitatorBar`. Compared by the implementer on light 1440 EN, dark 1440 FR (participant), light 390 EN and dark 390 FR.

| Difference | Covered by |
|---|---|
| No timer of the topic, no "~ 20 min left", no "5 min per topic", no shared notes, no "Discussed · 2 actions", no "8/8" | D-12 |
| The title of a group is the title of its `CardGroup` (with rename and collapse), larger than on the board; the header above it holds the rank, "Group of n cards · column", and the votes. The mockup has one header with the title in it | plan R9: "rendered as its `CardGroup` or `RetroCard` with all its controls". No row — reported |
| The cards of the focus sit side by side when there is room (two in the capture); the mockup draws three of 10rem | the group has two cards |
| Each card keeps "Comments (n)", "Add a reaction", "Discuss", the vote badge | owner 2-D9 (no feature lost) |
| The right card is "Action items" of the whole retro, not "Topic actions" | F: an item is not linked to a topic (RT-8) |
| An item shows its status badge, edit, "Delete", the sub-task field and its comments | parity rows 75–79; `ActionItem` mockup |
| The form has a native date, a "Repeat" select, no "Linked to", and the ticket is a checkbox | reported in R8b |
| The focus banner shows only while "Everyone follows" is on and a topic is highlighted (not in the captures) | plan R9 |
| A presentation overlay (dialog) exists while everyone follows | brief 02 row 59; plan R9. No row — reported |
| FacilitatorBar: "Previous topic" and "Next topic" carry their label; the mockup has icons | `FacilitatorBar` has no icon-only action outside its compact mode. No row — reported |
| FacilitatorBar primary: "End session", not "Actions" | R10 (B1) |
| A rating panel and, when there are surveys, a surveys panel under the action items; "Add survey" above the board | transitional (R11, S1) |
| No live cursor in the captures (one browser); the cursors are the library's | reported in R3 |
| The header rail shows the current label only | reported in R3 |
| Phone: the list is above the topic, not a "2/6" selector; no drawer, no swipe | R13 |

### Browser tests changed

| Test | Change | Why |
|---|---|---|
| `Plan04` `P04-05a` | rewritten: the order of `[data-test="retro-topics"]`, first the most voted, last the least; no sort toggle, no column | plan R9 (2-D9) |
| `Plan04` `P04-05b` | the facilitator focuses the topic, then "Discuss"; the other browser had not the card and now has it, highlighted and in view | plan R9 |
| `Plan04` `P04-05c` | confirms the delete in `[role="alertdialog"]` | plan R9 (5-D3) |
| `Plan04` `P04-09` (Discussing) | focuses the topic of each card before reading it | plan R9 |
| `Plan04` `P04-15a` | `[data-slot="retro-columns"]` → `[data-test="retro-topics"]`; the sideways scroll of the columns is no longer asserted | plan R9 |
| `Plan07` `P07-08a` | focuses "Slow CI" before reading its reaction chip | plan R9 |
| `Plan07` `P07-09` | the full name of the author is read from the `title` of the card author (the card prints the first name); the second topic is presented by a press in the list | `RetroCard` mockup; not listed |
| `Plan08d` `P08d-02b` | the group name is read from the group title, not from a `p` | `CardGroup`; not listed |
| `Plan09a` `P09a-01a` | priority read on `[data-slot="action-item-priority"]`, not on a select | `ActionItem` mockup; not listed |
| `Plan09a` `P09a-01b` | assigning goes through "Edit action item" and "Save"; the name is read beside the item; "(Guest)" | `ActionItem` mockup; 5-D7 |
| `Plan09a` `P09a-01c` | the guest has no "Priority" control (was: disabled) | `ActionItem` mockup; not listed |
| `Plan09a` `P09a-05` | "Delete" pressed inside the alert dialog (an item has a "Delete" button of its own now) | `ActionItem` (rule 6); not listed |

`Plan09a` `P09a-03c` (line 380, "(guest)" in the results of a completed retro) is not changed: the results still use the old card until R12. `Plan09b` :302–306 are on the action items page (5.2).

New: `[P18e-02-12]`, `[P18e-02-13]`, `[P18e-02-14]` in `Plan18eRetroTest.php`; captures `retro-board-discussing` and `retro-board-discussing-locked` in `RetroPagesVisualTest.php`.

Component changes, in their own commits: `ActionItem` (`group` of an owner: the assignee options under headings; the sync state of a tracker chip is in its text again). No test was removed.

## Task R10 — Actions phase (B1)

`RetroPhase` has two more cases between `Discussing` and `Completed`: `Actions` and `Roti`. No migration: a retro in `discussing` gets two more steps. `components/retro/phase-actions.tsx` holds the Actions phase: the most voted topics on the left, the actions card on the right. `carried-items-sheet.tsx` replaces `carried-action-items-panel.tsx` on the shared containers of R8b. `action-item-rows.tsx` is the list of rows that `action-items-list.tsx` and the carried items share.

How the focus works in Actions: nobody browses. The topic "In discussion" is the highlighted card of the retro, the same for everyone. A press on a topic by the facilitator, or "Next topic" in the facilitator bar, highlights it; with no topic highlighted yet, "Next topic" opens on the most voted one. The highlight is kept between Discussing and Actions and cleared on any other move. The presentation overlay never opens in Actions.

The ROTI phase has no screen of its own yet: until R11 it shows the columns of the board, read-only, and the rating control stays in Discussing.

### Back end (spec §9.1)

| Capability | Guard | Done |
|---|---|---|
| Neighbour rule, phase list, labels | `RetroPhase` (`Actions`, `Roti`, `label()`), `Retro::phases()` unchanged in code | yes |
| Vote totals visible in `actions` and `roti` | `Retro::showsVoteTotals()` | yes |
| Highlight in `discussing` and `actions` | `RetroHighlightsController` | yes |
| Highlight kept between `discussing` and `actions`, cleared on any other move | `ChangeRetroPhase::move()` reads the new `RetroPhase::showsTopics()` | yes |
| Action items on the board routes in `discussing`, `actions`, `roti`, unless locked | `LocksDiscussingRetro` reads `RetroGuard::takesActionItems()` → `RetroPhase::takesActionItems()` | yes |
| MCP `CreateAction`, `UpdateAction` | same guard; descriptions reworded | yes |
| Suggested actions: `actions` and `roti` as `discussing` | `SuggestionGuard`; `PromoteSuggestion` description reworded | yes |
| Insights readable | `BuildInsights`, MCP `ListInsights` | yes |
| Group naming, card reactions, card comments: `actions` yes, `roti` no | `RetroGuard::groupNaming()`, `CardReactionsController`, `CardCommentsController` | yes |
| Surveys | `SurveyGuard` unchanged: refused in `actions` and `roti` | yes |
| MCP server instructions | the phase list names `actions` and `roti` | yes |
| ROTI vote in `roti` only; MCP `GetRoti` | not in this task | R11 (B2) |

### Parity (brief 02 §3.4 rows 73–83)

| Row | Feature | Now | Done |
|---|---|---|---|
| 2-D9 | Topics by votes | `ol[data-test="retro-topics"]`: one card per group and per lone card, rank, title, votes, the first card of a named group as its excerpt, the colour of its column | yes |
| 58, 60 | Highlight | the topic "In discussion" (`aria-current`, the info ring and badge); the facilitator presses a topic or "Next topic" | yes |
| 73 | Suggestions panel | `aside[aria-label="Suggestions"]`, under the actions card | yes |
| 74 | Create an action item | the "Quick add" form, always open, first in the card | yes |
| M6 | "Create the ticket in :provider" | unchanged (`ItemCreateForm`) | yes |
| M7 | "Action created" with "Undo" | toast after a creation in this phase, with the name of the owner; "Undo" deletes through the existing route, without a confirmation; the new item has a success ring | yes |
| 75–82 | Done, reopen, edit, delete with its confirmation, sub-tasks, comments, export, tracker chips, anonymous notice | unchanged: the rows of R9, now `ActionItemRows` | yes |
| 83 | Previous action items | `CarriedItemsSheet`: same button, same sheet (`[role="dialog"]`, `#action-item-{id}`, groups by retro, "Added outside a retro", "Open the action items page"), same automatic opening once in Writing; rows on `ActionItem` with their sub-tasks, comments and export, through the workspace routes | yes |
| 83 | — | new in Actions: the follow-ups of earlier retros are also listed in the actions card, after the items of the retro, each with the name and date of its retro, and are counted in the badge (the mockup lists the late action of "Rétro sprint 41" there). Their DOM id is `carried-item-{id}` | yes |
| — | Card comments, reactions, group names in Actions | accepted by the server (matrix); no control on screen: the mockup shows no card in Actions | yes |
| — | Live cursors | on in Actions, over the whole phase body; off in ROTI | yes |
| — | Flying reactions | on in Actions and ROTI | yes |
| 4 | Facilitator bar | "Next topic", then "Next phase" (to ROTI). From Discussing the main button now names "Actions"; "End session" is the main button of ROTI | yes |
| 5 | Reopen | a completed retro reopens on ROTI | yes |
| — | "Suggest group names" | not offered in Actions (no group on screen) | yes |

### Places left

| Slot | Where | Roadmap |
|---|---|---|
| `exportAll` of `PhaseActions` (`headerActions` of `ActionItemsList`) | header of the actions card, right of the title | RT-10 |
| `linkedTo` of `PhaseActions` | first line of the form, after "Quick add": "linked to « topic »" | RT-8 |
| `itemTopic` of `PhaseActions` (`itemMeta` of `ActionItemsList`, `metaFor` of `ActionItemRows`) | meta line of an item: its topic | RT-8 |
| `topicMeta` of `PhaseActions` | foot of a topic card: "n linked actions" | RT-8 |

### Differences with the mockup

Captures `retro-board-actions-*` (facilitator, a topic in discussion, a follow-up of an earlier retro) and `retro-board-actions-locked-*` (participant, closed board) against `ScreenRetroActions`, `ActionItem` and `FacilitatorBar`. Compared by the implementer on light 1440 EN, dark 1440 FR (participant) and dark 390 FR.

| Difference | Covered by |
|---|---|
| No "Export to Jira" in the header of the card | D-13 |
| No "linked to « topic »", no topic on an item, no "n linked actions" on a topic | N: an item is not linked to a topic (RT-8); places left |
| Main button "Next phase", not "Close the retro" | D-04 |
| The facilitator bar is at the bottom centre, under the reaction bar, as in every phase; the mockup puts it at the bottom left, under the topics, and shows no reaction bar | spec §6.4 (one ReactionBar, stacked above the FacilitatorBar), ruling 27. No row — reported |
| The sentence of the card reads "Give each action an owner and a due date. They stay visible on the action items page of the team."; the mockup says "Each action has an owner and a due date. They stay visible on the team dashboard." | F: neither is required; the page that lists them is the action items page |
| The form has a native date, a "Repeat" select and no ticket field (a "Create the ticket in :provider" checkbox when the team has a tracker); the hint says "↵ to create" only | reported in R8b; D-07 for ⌘J |
| The toast names the owner only ("Bob Stone"); the mockup adds "ATLAS-1302 created in Jira" | F: the ticket does not exist when the item is created |
| An item shows its status badge, edit, "Delete", the sub-task field and its comments; the mockup has a "…" button | parity rows 75–79; `ActionItem` mockup |
| A "Previous action items (n)" button sits above the board, and the suggestions panel under the card | brief rows 83 and 73 (no mockup) |
| The topics are cards of the column colour without the `RetroCard` chrome (no author, no reactions) | as the mockup draws them |
| The header rail shows the current label only | reported in R3 |
| Phone: the topics are stacked above the card, not a collapsible list; the form is not in a drawer | R13 |
| The toast is not in the captures | — |

### Browser tests changed

Listed by the plan (B1, spec §6.4):

| Test | Change |
|---|---|
| `Plan04` `P04-07` | walks Actions and ROTI; "Reopen" lands on ROTI; the action-item form after the reopen is read in Actions ("Previous" from ROTI), then "Next", "Complete" |
| `Plan08c` `P08c-07` | Next, Next, Complete; "Reopen" lands on ROTI, then "Previous" twice to Discussing, where the closed surveys are read |
| `Plan08d` `P08d-04a` | Next, Next, Complete |
| `Plan08d` `P08d-05b` | "Reopen" lands on ROTI; the action-item form is read in Actions; Next, Complete |
| `Plan08e` (7 tests), `Plan14b` (1) | Next, Next, Complete from a board in Discussing |

New: `[P18e-02-02]` in `Plan18eRetroTest.php`. Captures: two datasets added to `RetroPagesVisualTest.php`; the captures of every other phase changed with the two new steps of the rail.

Feature tests changed outside the plan's list: `tests/Feature/Integrations/WebhookEventsTest.php` (the retro completes from ROTI and reopens on it), `RetroStartTest.php`, `RetroSummaryJobTest.php`, `SurveyAnswersTest.php`, `BoardLockTest.php` (same cause).

## Task R11 — ROTI phase (B2)

The rating is collected in the phase `roti` and nowhere else on an open retro. `components/retro/phase-roti.tsx` is the screen: the vote on the left (`ROTIWidget` in its new `row` layout, with the hidden distribution under it), "Who has voted" on the right. `roti-control.tsx` is deleted; the rating panel of Discussing is gone. A retro that was already completed when B2 is deployed keeps its vote control beside its results (`roti.canVote`).

### Back end (spec §9 B2, §9.1)

| Change | Where | Done |
|---|---|---|
| Column `retros.roti_votable_when_completed` (boolean, default false) | `2026_10_15_100400_add_roti_votable_when_completed_to_retros_table` (up only) | yes |
| The retros completed at deployment are marked | `2026_10_15_100500_mark_completed_retros_as_roti_votable` (up only; a second migration so that the marking can be run on its own by its test) | yes |
| Vote and retract: `roti`, and `completed` only when marked | `Retro::takesRotiVotes()`, `RetroGuard::takesRotiVotes()`, `RetroRotiController` | yes |
| `roti.canVote` in the board snapshot | `BuildBoardSnapshot::roti()` | yes |
| MCP `GetRoti`: "not_started" until `roti`, "collecting" in `roti`, results once completed | `GetRoti` | yes |
| A reopened legacy retro keeps its mark | nothing writes the column after the migration; feature test | yes |
| Factory state | `RetroFactory::legacyRoti()` | yes |

### Parity (brief 02 §3.4 rows 84–85, row 93)

| Row | Feature | Now | Done |
|---|---|---|---|
| 84 | Rate 1 to 5; a press on the given score takes it back | `ROTIWidget mode="vote" layout="row"`; `useRotiVote()` sends `PUT` or `DELETE retros/{retro}/roti`; `[role="group"][aria-label="How was this retro?"]`, `button[aria-pressed]`; keys 1 to 5 and the arrows inside the group | yes |
| 84 | Confirmation | "Vote saved · you can change it until the session ends" (`role="status"`) | yes |
| 85 | Respondent count, live | "Who has voted": the badge "n/m" and its progress bar, from `roti.voterIds` and the people present; `roti.changed` moves it for everyone | yes |
| M8 | "Who has voted" list | everyone present, the viewer first with "(you)", each "Voted" or "Thinking…"; never a score. On a phone, the stack of those who have voted | yes |
| D-14 | Distribution hidden until the end | "Votes hidden until the end", "Anonymous · nobody sees who voted what", the striped bar and five "?" counters; the distribution shows in the results once the session ends | yes |
| 93 | Results; still votable on a legacy retro | `results/roti-section.tsx`: the results and the count ":count ratings"; the vote (`RotiVote`, the widget's list layout) only when `roti.canVote` | yes |
| 4 | Facilitator bar | "Lock board", then "End session" | yes |
| — | Rating on a locked board | accepted, as before | yes |
| — | Live cursors | off in ROTI (a pointer on a score would show a vote) | yes |
| — | Flying reactions | on | yes |
| 83 | Previous action items | the button above the board, as in every phase | yes |
| — | Action items of the retro in ROTI | the server accepts them (matrix §9.1); the ROTI mockup shows none and the screen lists none. They are reachable with "Previous" (Actions) | yes |

### Places left

| Slot | Where | Roadmap |
|---|---|---|
| `roti.nudge` of `FacilitatorDock` (`RotiTools`) | facilitator bar of ROTI, after "Lock board": "Nudge the last n" | RT-9 |
| `roti.reveal` of `FacilitatorDock` (`RotiTools`) | facilitator bar of ROTI, before "End session": "Reveal ROTI" | RT-9 |

### Differences with the mockup

Captures `retro-board-roti-*` (facilitator, has voted) and `retro-board-roti-participant-*` (participant, has not voted, closed board) against frames a and b of `ScreenRetroROTI` and `ROTIWidget`. Compared by the implementer on light 1440 EN, dark 1440 FR (participant), light 390 EN (participant) and dark 390 FR.

| Difference | Covered by |
|---|---|
| No "Nudge the last 2", no "Reveal ROTI" in the facilitator bar | D-14; places left |
| The question reads "How was this retro?"; the mockup says "Was this time together worth it?" | no row — the plan gives `[aria-label="How was this retro?"]` verbatim and three browser tests bind it. Reported |
| The five labels are "Time wasted", "Not really worth it", "Break-even", "Good use of time", "Excellent use of time"; the mockup says "Waste of time", "Not very useful", "OK", "Useful", "Excellent" | no row — the labels of the 18c `ROTIWidget`, bound by `Plan08d` (`P08d-03`, `04e`, `05a`) and by the results. Reported |
| The options are toggle buttons in a group (`aria-pressed`); the mockup marks them `role="radio"` in a `radiogroup` | the plan's interface (`[role="group"]`, `button[aria-pressed]`); a radio cannot be unchecked, and a second press takes the vote back |
| The question is an `h2`; the mockup has an `h1` | A: the page has one `h1`, the title of the session |
| "Thinking…" with the two dots and an ellipsis; the mockup writes "Thinking" | the plan's label, verbatim |
| The list holds who is connected, and the count is "voted among those connected"; a voter who left the room is not in it | M8 as the plan words it ("every participant present") |
| "Lock board" in the bar | ruling 28 |
| No countdown in the capture | no timer is running in the fixture; the timer is the shell's |
| The captures show one person: one browser is connected | — |
| The header rail shows the current label only for the facilitator | reported in R3 |
| Phone: the stepper row under the header, the facilitator's timer in the bar | R13 |

### Browser tests changed

Listed by the plan (B2, ScreenRetroROTI):

| Test | Change |
|---|---|
| `Plan08d` `P08d-03` | the board is created in `Roti` |

Not listed, imposed by B2 and by the mockup:

| Test | Change | Cause |
|---|---|---|
| `Plan08d` `P08d-03` | "0 ratings", "1 rating", "2 ratings" → the badge `[data-slot="retro-roti-count"]` "0/2", "1/2", "2/2"; `assertDontSee('Return on time invested')` → no results section, and the hidden distribution is present | M8: the count is "n/m"; the eyebrow of the mockup says "ROTI (return on time invested)" |
| `Plan08d` `P08d-04e`, `P08d-05a` | the completed board is created with `roti_votable_when_completed` | B2: these two tests rate on a completed retro, which only a legacy retro still allows |

New: `[P18e-02-03]`, `[P18e-02-01]` in `Plan18eRetroTest.php`. Captures: two datasets added to `RetroPagesVisualTest.php`.

Feature tests changed outside the plan's list: `tests/Feature/Mcp/McpSweepTest.php` (the board of the sweep is in Discussing, where `GetRoti` now answers "not_started").

No test was removed. The Vitest case of `phase-discussing.test.tsx` that found the rating beside the topic now asserts it is absent.

## Task R12 — Session end (B3)

A completed retro shows `components/retro/session-end.tsx`: the header ("Session ended · duration · date", the title, the participants and the promise), the actions (Back to the team, Share, "Send the recap by e-mail"), the tabs Results / Board, then under Results the five figures and the cards. The old `results/*` (16 files) and `insights/summary-section.tsx` are deleted; `insights/suggestions-list.tsx` moved to `components/retro/suggestions-list.tsx` (the Discussing panel still uses it), its markup unchanged.

### Parity (brief 02 §3.5 rows 86–98)

| Row | Feature | Now | Done |
|---|---|---|---|
| 86 | Results / Board tabs, back to Results on a phase change | `ui/tabs` with `#completed-tab-results`, `#completed-tab-board`, `[role="tabpanel"]` labelled by its tab; `BoardBody` resets the view | yes |
| 87 | Completed date, participants | header line with `<time>`; "n participants"; card "Thanks for participating" (name, "Guest") | yes |
| new | Duration (2-D6, B19) | "58 min", "1 h 12 min" from `results.stats.durationSeconds`; nothing for a retro without a start time | yes |
| new | Five figures (B3, M9) | `StatCard layout="inline"`: actions created, participation "n of m · p %", cards, groups, votes cast "n of m" (`lib/retro/session-end.ts`) | yes |
| 88 | Summary: generate, retry, regenerate, remove; themes and suggested actions | `results/summary.tsx`, `[aria-labelledby="results-summary"]`, `Skeleton` while pending; facilitator only | yes |
| 89 | Health: figures, radar, trend, statements | `HealthCheckResults` with the radar and the trend as children; each statement with its move since the previous retro (`previousAverage`), "compared with :retro" for a member | yes |
| 90 | Top topics | `results/top-topics.tsx`: five, by votes, group name and grouped count | yes |
| 91 | Action items, read only, link to the team's | `ActionItem` without handlers (`#action-item-{id}`), count badge, "n linked to Jira · all have an owner and a due date" | yes |
| 92 | Games played: podium, "Show all", rounds, replay | `results/games-played.tsx` (composed: the podium of `GamesLeaderboard` is not exported and has period tabs) | yes |
| 93 | ROTI results; vote on a legacy retro | `ROTIWidget mode="result"`; `RotiVote` above it when `roti.canVote` | yes |
| 94 | Share the results to a channel | "Share" menu in the header → `FormDialog` saying what the recap holds | yes |
| 95 | E-mail the results | primary button "Send the recap by e-mail" (2-D14) → `FormDialog` with the two audiences; a refusal shows in the dialog | yes |
| 96 | Delivery lines | `DeliveryLines` under the header | yes |
| 97 | Survey results | old `SurveyResult` mounted in a "Surveys" card (S2) | yes |
| 98 | Read-only board | `ColumnsBoard` in the Board tab | yes |
| 2-D13 | Confetti | `SessionConfetti`: forty pieces, `animate-confetti`, the colours of the columns, once, only for who sees the phase turn to completed; never mounted with `prefers-reduced-motion`, where a toast says "Session ended — n actions created" | yes |
| mockup | Reaction bar at the session end | `showsRetroReactions` follows the setting alone; on a phone the bar sits above the actions bar | yes |

### Places left

None requested by the plan (Export menu and ROTI trend are backlog, D-15). The header keeps the order ghost / outline / primary of the mockup: an export menu would sit beside "Share".

### Differences with the mockup

Captures `retro-board-completed-*` (facilitator, with health check, ROTI, action items, mail on) against frames c and d of `ScreenRetroROTI`. Compared by the implementer on light 1440 EN and dark 390 FR, and on two tall temporary captures (1440 light, 390 dark) to see below the fold.

| Difference | Covered by |
|---|---|
| No Export menu; "Share" (to a chat channel) holds its place when a channel is connected | D-15; brief row 94 |
| No ROTI delta badge and no sparkline | D-15 |
| The ROTI card is the `ROTIWidget` result: the five rows under the stacked bar | plan interface (`ROTIWidget mode="result"`) |
| The health card is `HealthCheckResults` (title "Health check results · :retro", figures, radar, trend, one block per statement, scale of 10, alert under 6) and not the six compact rows of the mockup | plan interface; brief row 89. No row — reported |
| "Session ended" line: the primary button reads "Send the recap by e-mail" | O: 2-D14 |
| Subline "n participants." without the team name | the snapshot of this lane holds no team name (RW-C2 is on another branch). Reported |
| Title ":title, wrapped up" is an `h2` | A: one `h1`, the session title of the header |
| Tabs Results / Board, cards Summary, Top topics, Surveys, Games, Thanks for participating | no mockup: brief 02 §6 |
| Confetti is not frozen on screen: it plays 1.4 s and fades; forty pieces (plan) and not 24 | ruling 37; plan |
| Action rows are the `ActionItem` of 18c (status, "To do" badge, creator line) | 18c component |
| Phone: "Back to the team" and Share are in a "…" menu beside the e-mail button only when mail is on; without mail they are plain buttons in the bar | mockup README names the case with mail only |
| Participation can read "3 of 2 · 100%": guests are participants, the team count is members; the percentage is capped at 100 | B3 as specified. For the owner |
| The reaction bar floats above the cards at the bottom centre | mockup (docked bar) |

### Browser tests changed

Listed by the plan: `Plan12b` (the results share and e-mail tests) — "Send to email" inside the Share menu → the button "Send the recap by e-mail" (2-D14).

Not listed, imposed by the mockup, 2-D14 or the components the plan names:

| Test | Change | Cause |
|---|---|---|
| `Plan04` `P04-06`, `Plan08d` `P08d-04a`, `Plan09a` `P09a-03c` (2), `Plan12b` (3), `Plan14a` (1) | "Retrospective completed on" → "Session ended" | header of the mockup |
| `Plan04` `P04-06`, `Plan08d` `P08d-04a`, `04d` | section "Action items" → "Actions created" | mockup |
| `Plan08d` `P08d-04b` | the figures no longer hold "Participation"; "2 answers from 3 participants" is asserted | `HealthCheckResults` |
| `Plan08d` `P08d-04e`, `05a`; `Plan18e` `P18e-02-01` | "Average: 4.5/5", "n ratings", "No ratings yet.", the rows and bars → `[data-slot="roti-mean"]`, "n votes", "Nobody has voted yet.", `li[data-rating]` (5 first) | `ROTIWidget mode="result"` |
| `Plan08d` `P08d-06` | the ROTI bars of the widget have no transition in either mode: the test asserts they are still in both, and that no confetti is mounted with reduced motion; the title is found by its section (it is read by screen readers only) | `ROTIWidget` |
| `Plan09a` `P09a-03c` | priority, overdue, status and guest label are read on the `ActionItem` row (`data-priority`, `data-status`, "(Guest)", disabled status button) | brief row 91; 5-D7 |
| `Plan13d` `P13d-11a` | order: Actions created, ROTI, Top topics, Games we played | mockup: actions, then ROTI |

New: `[P18e-02-04]`, `[P18e-02-04b]`, `[P18e-02-07]`, `[P18e-02-15]`. No test was removed; the Vitest file `results/roti-section.test.tsx` went with its component and its two cases are in `session-end.test.tsx`.

## Task R13 — Mobile board

Below `md` (767 px, `useIsMobile`) the board is a phone board. Nothing changes from `md`.

### Parity (brief 02, commit R13; every row of R4 to R12 keeps its control on a phone)

| Feature | On a phone | Done |
|---|---|---|
| Columns (Health check, Writing, Grouping, Voting, the Board tab of a completed retro) | `ColumnTabs` (`skrum/column-tabs.tsx`): one tab per column with its colour and its count, the line of dots, one column on screen (`role="tabpanel"`, `[data-slot="retro-columns"]`). Arrows, Home and End move between tabs | yes |
| Swipe between columns (M10) | `useSwipe` (`hooks/use-swipe.ts`) on the panel: past a quarter of its width, more horizontal than vertical; ignored while a card is dragged, from a text field and from a dialog opened from the panel. The new column slides in; no slide with `prefers-reduced-motion` | yes |
| Column menu, description, lock, `data-test="retro-column-{id}"` | the `RetroColumn` of the tab keeps its header | yes |
| Add a card | round button `[data-slot="retro-add-card"]`, "Add a card in :column", opens a drawer with the composer (GIF tools included); it closes on the card added. `N` on the column opens it too | yes |
| Add a column (facilitator) | last tab "Add column" | yes |
| Surveys column (old component until S1) | first tab "Surveys" when the retro has one | yes |
| Group cards | a card alone has "Add to group…" in its menu: a drawer lists the groups, then the lone cards of its column (`group-target-drawer.tsx`, same request as a drop). The banner says so instead of "Drag a card…" | yes |
| Votes | the budget stays stuck above the tabs; the hidden-totals pill and the progress scroll with the cards; the vote and its take-back are 44 px targets (`RetroCard`, `CardVotes`) | yes |
| Highlighted card | its column comes in front | yes |
| Discussing: topics list | a selector "n/m · title" stuck at the top opens the `TopicsList` in a drawer; a swipe on the topic goes to the next or the previous one; "Previous topic" / "Next topic" stay | yes |
| Discussing and Actions: create an action item | "Create an action" opens a drawer: title, assignee as avatar chips (radios), priority as three segments, due date, repeat, ticket; it closes on the item created (M10) | yes |
| Actions: topics | folded behind their heading (open at first) | yes |
| Facilitator bar, reaction bar | `FacilitatorBar compact`, `SessionReactions compact` (R3) | yes |
| Captures at 390 | every phase (`[P18e-R3-01]`), and the three drawers (`[P18e-R13-01]`, `retro-phone-*`) | yes |

### Places left

None new. The slots of R4 to R12 (`typing`, `moving`, `cap`, `finished`, `done`, `timer`, `notes`, `linkedTo`, `topicMeta`) are passed through unchanged; `PhoneColumns` takes the Writing and Grouping banners as its `banner`.

### Differences with the mockup

Captures `retro-board-*-390-*`, `retro-phone-add-card-*`, `retro-phone-topics-*`, `retro-phone-action-*` and `design-system-column-tabs-*` against `MobileRetro/preview.html` and the "Mobile" line of the README of each phase. Compared by the implementer on light 390 EN (Writing, Voting, Actions, the three drawers) and dark 390 FR (Writing, Grouping, Discussing, the topics drawer).

| Difference | Covered by |
|---|---|
| Header: no phase subtitle under the title ("Atlas · 7 online"), the sidebar button of the frame shows, presence is the counter alone | Task 0.3 / 0.4 (`SessionTitle` takes one line, K17); no row — reported in R3 |
| The stepper is the phone form of `PhaseStepper` ("Phase n/m", the label, Previous, Next, a progress bar) and not the compact rail of markers | `PhaseStepper/README.md` (the rail needs 36rem); the suite presses "Next". No row — reported in R3 |
| The column of a tab keeps its own header (title, count, menu): the title is said twice | parity: column menu, description, lock |
| No "… is writing" line, no typing ring on an avatar | D-10 |
| The facilitator bar has no "Reveal"; its main button names the next phase | D-10; R3 |
| Votes: a button with the total and a "−" beside it, both 44 px, not the "− n +" stepper; the budget is the `VoteBudget` pill, not a full-width bar; no "I have finished voting" | D-11 for the last; the first two: no row — the 18c components, reported |
| "Totals hidden until the end of the vote" is a pill under the tabs, not a line above the footer | R8 |
| Actions: the topics are the cards of R10 (rank, votes, excerpt), without the "n actions" badge | D-12 (action count per topic) |
| Action drawer: no "From « topic » · n votes" line | D-12 (the `linkedTo` place) |
| Action drawer: the title is a one-line field (Enter creates), the due date is a date field with "Repeat" beside it, not "End of sprint 43" with "Change" | N: no sprint (TM-1); parity rows of R8b |
| Action drawer: the ticket is the checkbox or the select of R8b ("Create the ticket in :provider"), not a switch with the project | R8b; D-13 |
| Action drawer: an "Unassigned" chip before the people | parity: an item may have no assignee |
| Discussing: the notes and the action items are not in a tabbed drawer: the panels stay under the topic, only the form is a drawer | D-12 (no notes); the plan names the topics drawer and the action drawer |
| Grouping: "Add to group…" is in the menu of the card, not behind a long press; no duplicate suggestion | D-10 for the suggestion; the long press: no row — a menu entry is reachable from the keyboard (rule 5) |
| "Add survey" and "Previous action items" sit above the tabs | transitional (S1); no mockup for the carried items |
| The reaction bar floats above the facilitator bar | ruling 27 |

### Browser tests changed

Not listed by the plan (it says "none: the suite runs at desktop width"), imposed by the topics drawer the plan asks for:

| Test | Change | Cause |
|---|---|---|
| `Plan04` `P04-15a` | at 375 the topics are no longer in `main`: the test asserts the selector `[data-slot="retro-topics-selector"]`, the panel under it, and the list inside the drawer; at 1440 it also asserts the list is back in `main` and the selector gone | plan R13: "the topics list of R9 as a drawer"; `ScreenRetroDiscussion` README, "Mobile" |

New: `[P18e-02-06]`, `[P18e-R13-01]`. No test was removed.
