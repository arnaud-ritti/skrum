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
