# Plan 17c — whiteboard facilitation: walkthrough

> **Note, 2026-10-01 — dot voting was removed.** After this walkthrough was run the product owner decided to remove dot voting (and private writing) from the whiteboard. Sections 5, 6 and 7 below, the lines B7.x and V/C/S lines they hold, and the voting parts of R2, G5 and of the "Result" section describe a feature that no longer exists; they are kept as the record of what was observed on 2026-10-01 at e6ab183 and 1666178 and are not to be replayed. Sections 1 to 4 (timer, board lock, element lock, follow-me), B5.x, B6.x and the regression lines still apply.

Run on 2026-10-01 in Chrome against the local Sail stack, at commit e6ab183, on a fresh board "Walkthrough 17c" (`01a0f785-c6a2-72a6-825b-9026652a0a6b`). Member A = Fran Facilitator on `http://localhost`; guest B = "Guest Gia" on `http://127.0.0.1` (separate cookie jar, same Chrome). Ticked lines were observed; unticked lines carry the reason. Each line reads Setup, then Action, then Expected; the lines named B5.x, B6.x and B7.x are the browser checks of plan 17c, Tasks 5 to 7.

## Result

Date: 2026-10-01. Commit under test: 1666178 (re-check after the fixes of the three defects of the first run). The three defects are fixed; B5.5, B7.5 and B7.8 are now ticked. No new defect. No console error on the board page in the tabs of A and B (console reading started after the pages had loaded).

The re-check ran on a second fresh board "Walkthrough 17c" (`01a0f7a6-0e17-723b-8bd8-f7e1029527d5`), same accounts and origins as the first run. Only the three lines and what the fix could have touched were replayed; every other tick of this file dates from the first run at e6ab183.

1. **B5.5, fixed.** B typed "unsent words" in a text (stored version 16, seq 1), A locked the board with the top-bar button. Two seconds later `textarea.excalidraw-wysiwyg` was gone from B's page, the focus was on the canvas container in view mode, and the toast "This board is locked." and the status row showed. B then typed " MORE" and "X": no editor, nothing stored (version 16, seq 1). A unlocked, B pressed Escape: B's tools came back and the snapshot was still "unsent words", version 16, seq 1.
2. **B7.5, fixed.** Vote open over three notes. B resized "Alpha" by its corner (200 × 200 → 227 × 227, rectangle `8a54946b…` version 5, seq 11). A double-clicked it, typed " ff", pressed Escape: toast "Notes cannot be edited while a vote is open.", words back to "Alpha", and in `GET snapshot` the rectangle was still 227 × 227 at version 5, the text at version 8, seq 11; same picture in A and B. A second refused edit by A on that note after dragging it (click away instead of Escape) also left it at 227 × 227. The rest of the line was replayed too: B's refused edit of "Beta", B emptying "Beta" and clicking away (words back, toast), B dragging it (rectangle and words both moved by 40, 30), B typing in the wordless note (words gone, toast, note still draggable), A dragging "Alpha" with its words; after the close B's double-click on "Alpha" opened the existing words and stored "Alpha ok" on the same text element, the note still 227 high. Not replayed in this pass: recolouring a note under vote, and A dragging the note B had emptied (A dragged "Alpha" instead).
3. **B7.8, fixed.** Vote closed, results panel open in A and B ("1. Beta 2 votes, 2. Alpha 1 vote"). A selected "Beta" and pressed Delete: A's "Show on the board" button of "Beta" had `disabled` true 50 ms after the key and at 1.2, 2.2 and 3.2 s, without reopening the panel; B's was disabled too; "Alpha" stayed enabled in both and still centred its note. A then undid the deletion: the "Beta" button was enabled again in A and in B.

Limits of the re-check:

- The Chrome window was in the background (`document.visibilityState` "hidden"), as in the first run: toasts do not expire, so "This board is locked." was still on B's screen long after the unlock.
- The sticky notes were given their words by a double-click; nothing was scripted through the endpoints except reading `GET snapshot`, enabling guest access (`PATCH settings`) and reading the guest link.
- Two tabs of the first tab group (B's first board tab and an empty one) fell out of the tools' reach when the group's first tab was closed, and could not be closed by the tools; B's second half of the run was done in a new tab with the same guest session.

Seen in passing during the re-check:

- B's text "unsent words" was drawn as "unsent word" on B's own canvas after the lock closed the editor (stored width 106, too narrow for the words) until B opened and closed it again after the unlock (width 130, version 17). The stored words were right throughout. Not seen in the first run, where the editor stayed open; not judged a defect of the line.
- After clicking a colour of the sticky tool the keyboard focus stays on that button: Enter adds another note instead of opening the new note's text.
- Left on the Demo Team: a second board "Walkthrough 17c".

### First run (commit e6ab183)

All seven criteria of spec §16 "Facilitation" were observed to hold. Three defects were found around them, none on a server rule; all three are fixed at 1666178 (see above). No console error on the board page in any tab.

Defects:

1. **B5.5 — a text being typed survives the lock and is written after the unlock.** B had a text open in the editor; A locked the board; B kept typing " MORE" then "X". Expected: B's unsent text disappears. Observed: the toast "This board is locked." showed, B went to view mode and nothing was stored while the board was locked (snapshot text "unsent words", version 16, seq 4), but the text editor stayed open and focused on B's locked board (`textarea.excalidraw-wysiwyg`, value "unsent words MOREX"), and after A unlocked and B pressed Escape the text was stored as "unsent words MOREX" (version 17, seq 5) and shown to A.
2. **B7.5 — a refused text edit can collapse the note.** With a vote open, B had resized the note "Alpha" (200 → 227 wide, stored version 7). A then double-clicked it, typed " ff" and pressed Escape. Expected: the text snaps back and nothing else changes. Observed: the toast showed and the text stayed "Alpha" (version 9), but the note rectangle was stored at height 35 (version 8, was 227), so the note became a thin strip with its words below it, in A, in B and in `GET snapshot`. The same refused edit by B on the note before it was resized did not do this.
3. **B7.8 — the entry of a deleted note stays enabled for the person who deleted it.** A deleted the note "Beta" with the results panel open. Observed: B's panel disabled the entry's "Show on the board" button; A's panel kept it enabled five seconds later (clicking it did nothing). It was disabled in A once the panel was opened again from the board menu.

Limits of the first run:

- The Chrome window driven by the tools was in the background (`document.visibilityState` "hidden"): timers are throttled to one second and toasts do not expire. The timings below were taken in that state.
- 375 px could not be reached: Chrome's window does not go under 500 px. The narrow checks were made at 500 px.
- No second login was made: where a line needs a plain member, A handed facilitation over to "Max Member" and was observed as a member of its own board, then took control back.
- The scroll wheel did not reach the canvas; pans were made with the hand tool.

Seen in passing, outside the lines of this file:

- With two tabs of the facilitator open on the board, followers are brought to whichever tab whispered last (a follower at 500 px showed the view of the facilitator's 500 px tab until that tab was closed).
- The canvas context menu still has "Add to library" on an element, and the reactions bar is drawn above the context menu when the two meet.
- The "Hand over facilitation" select shows no placeholder before a choice.
- A vote badge shows through a newer note that covers its note (the overlay is above the canvas).
- The "Start a vote" dialog did not close on Escape after its scope list had been opened and closed; "Cancel" closed it. Not checked a second time.
- Left on the Demo Team: boards "Walkthrough 17c", two "Walkthrough 17c (copy)", "Walkthrough 17c template board", and the workspace template "W17c walkthrough template".

## Before starting

Run `vendor/bin/sail artisan migrate --no-interaction` and `npm run build`. Accounts, origins and tab rules are those of `.superpowers/sdd/whiteboard-rules.md`:

- Member A: `http://localhost`, logged in as "Fran Facilitator" (`facilitator@skrum.test`, password constant of `database/seeders/DemoSeeder.php`). Team page: Demo Workspace → Demo Team. Create a fresh board for the run (Blank template) and note its id.
- Guest B: `http://127.0.0.1` (separate cookie jar, same Chrome). Enable guest access on the board, read the token with `docker exec skrum-pgsql-1 psql -U sail -d skrum -At -c "select guest_token from whiteboards where id='<board id>'"`, open `http://127.0.0.1/whiteboards/join/<token>`.
- Second member: `member@skrum.test` on `http://127.0.0.1`, only for the lines that say "second member". One account per origin: finish every guest line first, then sign in as the member on that origin (a guest session there ends when you do).
- **A guest is enough for every criterion**: a guest is a non-facilitator, votes, is locked out and follows. The walkthrough therefore does not depend on a second login. Only B7.9's "for a member" and B6.5's take-over need the second member, and each such line says how to check the same thing through `GET snapshot` when that login cannot be made.
- Create and open only your own tabs, and close them when done. Never trigger a native dialog. When a canvas input cannot be driven after two attempts, check the same thing through the board's JSON endpoints (`fetch` with the XSRF header) and say so on the line.
- Reading the countdown: the top-bar timer has `role="timer"`; read its text in both tabs within the same second.


## 1. Given the facilitator starts a 60-second timer, then every browser shows the same countdown and "Time's up" at zero

- [x] **T1.1** Setup: A facilitates, B is on the board. Action: A starts "1 min". Expected: both show the same remaining time (read the `role="timer"` text in both within the same second, at most one second apart), and both show "Time's up!" at zero. — "1:00" in both 45 ms apart, "0:45" in both 3 ms apart; "Time's up!" in A and B within 250 ms of each other
- [x] **T1.2** Setup: the timer of T1.1 is running or has ended. Action: in A's and B's tab fetch `GET /whiteboards/<id>/snapshot`. Expected: both bodies carry the same `timerEndsAt`. — `2026-10-01T12:55:08+00:00` in both

- [x] **B5.1** Facilitator: the top bar shows a timer button and a lock button; a member and a guest see neither. Nothing new lies over the canvas, its shapes toolbar, its bottom controls or the reactions bar, at 1280 px and at 375 px; the canvas still fills the area under the bars. — guest: board menu only; member: A after handing facilitation over, no timer, lock, follow or vote button; narrow width checked at 500 px, not 375 px
- [x] **B5.2** A starts "1 min": within a second every browser shows the same countdown in the top bar (A and B at most one second apart); at zero each shows "Time's up!", a toast, and plays the sound. "Stop timer" removes it everywhere. A browser that opens the board mid-countdown shows the right remaining time. — the sound was not heard: an oscillator was started in each tab at zero (same millisecond); B reloaded mid-countdown showed "0:45" like A


## 2. Given the board is locked, when a non-facilitator writes an element, then the server answers 403 and the element is unchanged; the facilitator can still edit

- [x] **L2.1** Setup: one shape on the board, drawn by A. Action: A locks the board; B tries to draw, then sends a `PUT elements` by `fetch` with the XSRF header; A then moves the shape. Expected: B is in view mode; the `fetch` answers 403 with `errors.locked`; the shape in `GET snapshot` is unchanged by B and changed by A. — B's move and B's new element both 403 `errors.locked`, seq stayed 2; A's drag stored (x 300 → 250, version 3 → 4, seq 3)

- [x] **B5.3** A locks: B's canvas loses its shapes toolbar and the sticky tool (in the toolbar and in the top bar), a drag pans, the status row says "This board is locked."; B can still pan, zoom and send a reaction. A can still draw and B sees it. Unlock: B's tools come back without a reload. — B's ❤️ arrived on A with "Guest Gia"; A moved the shape instead of drawing a new one and B saw it
- [x] **B5.4** From B's console on a locked board, `fetch` a `PUT /whiteboards/<id>/elements` with one element and the XSRF header: 403, body `errors.locked`; the page stays on the board (no "Your access to this board has ended") and the element is not in `GET snapshot`.
- [x] **B5.5** B starts typing in a text, A locks while B types: B's unsent text disappears, B sees the toast "This board is locked." and stays on the board in view mode, and A's canvas never shows the text. — re-check at 1666178: the editor closes on the lock, what B types afterwards goes nowhere and nothing is stored after the unlock (see Result). First run at e6ab183, **defect 1**, since fixed: toast, view mode and staying on the board were observed, and nothing typed during the lock was stored while it lasted; but the editor stayed open on B and what B typed during the lock was stored after the unlock. Also: what B types before the lock is sent while typing (it was already stored), so "A's canvas never shows the text" can only be about the characters typed after the lock
- [x] **B5.8** The canvas's own "View mode" entry (context menu on the empty canvas) is still there on an unlocked board.


## 3. Given a locked element, when a non-facilitator moves or unlocks it, then the write is rejected and their canvas returns to the server copy

- [x] **E3.1** Setup: A locks one shape on an unlocked board. Action: B drags it; then B sends a `PUT elements` by `fetch` with `locked: false` and a higher version. Expected: the shape is back in place on B's canvas; the response's `rejected[0].reason` is `locked` and carries the stored copy; B's context menu has no lock entry. — the canvas does not let B drag a locked shape at all (the drag made a selection box and sent nothing), so "back in place" was observed with "Delete" from B's context menu: the shape came back. The `fetch` answered 200 with `rejected[0].reason` `locked` and the stored copy (x 250, version 5, locked)

- [x] **B5.6** A locks a shape (context menu). B right-clicks it and the empty canvas: no "Lock" / "Unlock" / "Unlock all elements" entry; B drags the shape: it returns to its place and the toast "Only the facilitator can change a locked element." shows. A still sees the entries. — the "Unlock" entry is in B's DOM with `display: none`; the toast was observed after B's "Delete" (see E3.1), not after a drag; A sees "Lock" then "Unlock" on the shape. "Unlock all elements" was not in A's empty-canvas menu when looked at, probably because the locked shape was still selected: not checked again


## 4. Given follow-me is on, when the facilitator pans, then followers' views follow; a follower who pans sees "Following paused" and "Resume" re-attaches them

- [x] **F4.1** Setup: a board with content spread over more than one screen, A facilitating, B on the board. Action: run B6.1 to B6.7 below. Expected: each line as written.
- [x] **F4.2** B6.5's take-over without a second login. Setup: follow-me is on. Action: A hands over facilitation to the second member's name in the board menu, then takes control back. Expected: `followEnabled` is false in `GET snapshot` after each step. (That `PUT facilitator` by the second member switches follow-me off is pinned by `WhiteboardFacilitationTest`.) — handed over to "Max Member": false; "Take control": false

- [x] **B6.1** A switches "Bring everyone to me" on: A's status row says "Everyone follows your view.", B's says "Following the facilitator", and B's view shows what A sees. B does not pause on its own: after ten seconds without touching B, its row still says "Following the facilitator". (If it pauses by itself, the canvas does not report back exactly the numbers it was given: compare with a tolerance of 1e-6 in `use-whiteboard-follow.ts` and say so.)
- [x] **B6.2** A pans and zooms: B's view follows within about a second, and what A sees is inside B's window when the two windows have different shapes. — zoom 100 → 110 % and a hand-tool pan followed within 2 s (first look); a guest tab at 500 px zoomed out until A's 1280 px view fitted in it
- [x] **B6.3** B pans (or zooms): B's row says "Following paused" with "Resume"; A keeps moving and B's view stays. "Resume" brings B back to A's current view at once.
- [x] **B6.4** A browser that opens the board while follow-me is on is brought to A's view within about 2 s. — B reloaded: at A's view at the first look, 3 s later
- [x] **B6.5** A switches it off: both rows lose the notice and B's view is free. A member takes control while it is on: it goes off (snapshot `followEnabled` false) and nobody is pulled to the new facilitator. — the take-over by a second member was not replayed (no second login); see F4.2
- [x] **B6.6** On a locked board B (view mode) still follows, pauses by dragging, and resumes.
- [x] **B6.7** Only the facilitator leads: with follow-me on, B's own pans and zooms never move A's view.


## 5. Given an open voting session, then no payload received by any member contains another member's votes or any total, and a member cannot exceed their budget

**Removed on 2026-10-01** with dot voting. Record of the run, not to be replayed.

The secrecy invariant itself is proved by `WhiteboardVotingSecrecyTest` over every surface (snapshot, element fetch, write responses, broadcasts, versions, logs), not by this replay; the lines below observe it from the browser.

- [x] **V5.1** Setup: a board with at least three sticky notes. Action: A opens a vote with 3 votes; B votes three times. In A's tab read `GET snapshot` and `GET vote-sessions/<id>` by `fetch`, and watch A's page. Expected: A's `voting.myVotes` is empty, there is no total and no other member's vote anywhere in the two bodies; B's fourth vote answers 422. — four notes in scope; no `count`, no total and no trace of the guest in A's two bodies; B's fourth vote 422 "You have no votes left."

- [x] **B7.1** Facilitator: the vote button opens a dialog (votes per participant, scope, several votes per note). A board without notes answers "There are no sticky notes to vote on." inside the dialog, which stays open. With a frame on the board the scope lists "Notes in <frame name>" (or "Notes in Frame 1" for a frame without a name). — the message was observed with the scope "Notes in Frame 1" on an empty frame (POST 422, dialog open), not on a board without any note; "Notes in Question / Ideas / Top picks" on a board from the Brainstorm template
- [x] **B7.2** Vote open: every in-scope note has a vote control at its top-right corner in A and B; a note added afterwards has none. The controls stay on their notes while panning, zooming, and while a note is dragged; a control that scrolls under the shapes toolbar passes **behind** it, and none lies over the canvas's bottom controls or the reactions bar. The canvas still fills its area and the reactions bar sits where it did before this plan. (If a control covers a canvas control, do not raise the canvas controls: clip the overlay to the drawing area and say so.) — behind the toolbar and behind the reactions bar checked with `elementFromPoint`; the control was on its note after a drag, not watched during the drag
- [x] **B7.3** B votes: B's control shows B's count, the status row counts down "Votes left", A's page shows nothing of B's vote (no count on the note, no change but "x of y finished voting" when B spends the last one). At a budget of zero the "+" or the toggle of other notes is disabled; forcing it (`fetch` the PUT with a higher count) answers 422 "You have no votes left.". — a count of 2 on a voted note answers 422 "Only one vote per note is allowed."
- [x] **B7.4** While the vote is open no remote cursor is drawn in A or B even with "Show live cursors" on, and the status row says so; they come back when it closes.
- [x] **B7.7** A second tab of B on the same board shows B's votes within about 2 s of a vote cast in the first tab. — 2.8 s and 3.1 s, measured twice in background tabs whose timers run once a second
- [x] **B7.10** A locks the board during an open vote: B can still vote and cannot move a note.


## 6. Given a closed session, then every member sees the same counts on notes and the same ranked list

**Removed on 2026-10-01** with dot voting. Record of the run, not to be replayed.

- [x] **C6.1** Setup: the vote of section 5 holds votes from A and B. Action: A closes it. Expected: A and B show the same counts on the notes and the same ranked list. — "1. Alpha 2 votes, 2. Beta 2 votes" and a badge "2" on each, in both

- [x] **B7.8** A closes the vote: in A and B the controls become count badges with the same numbers, and the results panel opens beside the canvas (the canvas shrinks; nothing is covered) with the same ranked list. "Show on the board" centres the note. A deleted note's entry has its button disabled. — re-check at 1666178: disabled in A within 50 ms of the delete and in B, enabled again in both after A's undo; "Show on the board" still centres a note; controls becoming badges and the panel opening were seen again. First run at e6ab183, **defect 3**, since fixed: disabled in B, still enabled in A, who deleted the note. Everything else on the line was observed ("Show on the board" centred the note; the animation is slow in a background tab)
- [x] **B7.9** A hides the results: badges and panel disappear for both. The board menu's "Vote results" shows them again under "Previous votes" for A and for a member; a guest has no such entry and no history. — "for a member" observed with A after handing facilitation over (menu entry present, `votingHistory` of one session); the guest's menu has "Hide my cursor" only and its `votingHistory` is empty
- [x] **B7.11** Dark theme and 375 px width: controls, badges, status row and panel are legible; the panel takes the board area and closes. — the whole run was in the dark theme; width 500 px, not 375 px: the status row wraps on two lines, the panel takes the board area, its cross closes it and a "Vote results" button brings it back


## 7. Given an open session, when a sticky in scope has its text changed, then the write is rejected

**Removed on 2026-10-01** with dot voting. Record of the run, not to be replayed. The fix found here for a note that somebody else resized (B7.5, the note keeps its height when its text is edited) is in the sync and stays.

- [x] **S7.1** Setup: an open vote with a sticky in scope. Action: B sends a `PUT elements` by `fetch` with the sticky's bound text element, its `version` raised by one and its `text` and `originalText` changed. Expected: the response is HTTP 200 (not a 4xx) with `seq` equal to `fromSeq`, `rejected.length === 1`, `rejected[0].id` the id of that text element, `rejected[0].reason === 'voting'` and `rejected[0].element` the stored element with its old `text`, as `WhiteboardVotingWritesTest` pins; the text element is unchanged (same `text`, `originalText` and `version`) in `GET snapshot`. — 200, seq 21 = fromSeq 21, one rejected, `voting`, stored text "Alpha", version 7 before and after

- [x] **B7.5** B double-clicks an in-scope note and types: the text snaps back and the toast "Notes cannot be edited while a vote is open." shows; B can still drag, recolour and resize it, and A sees those. A (facilitator) is refused the same way. Then B double-clicks an in-scope note, deletes all its words and clicks away: the words come back with the same toast; B and then A drag that note and its words move with it in both browsers; after the vote is closed a double-click on it edits the existing words (no second text appears on the note). B double-clicks an in-scope note that has no words and types: the words disappear with the toast, and the note can still be dragged. — re-check at 1666178: A's refused edit of the note B had resized leaves the note at 227 × 227, version unchanged (see Result); recolouring and A's drag of the emptied note were not replayed in the re-check. First run at e6ab183, **defect 2**, since fixed: A's refused edit of the note B had resized collapsed the note. Every other part of the line was observed as written
- [x] **B7.6** A deletes a note B voted for: B's "Votes left" goes back up within about 2 s without a reload. — 0 → 1 in both tabs of B without a reload, read 4 s after the delete; the delay itself was not measured


## Around the criteria


- [x] **B5.7** Board menu of A: "Hand over facilitation" lists the other team members and the workspace's owners and admins by name, never a guest; choosing one makes them facilitator (A's top bar loses the tools without a reload, the snapshot's `facilitatorMemberId` changes); A then takes control back from the menu. With nobody else to choose the dialog says "No one else can facilitate this board yet.". — the list was "Ada Admin", "Max Member"; the empty dialog was not replayed (the demo team always has someone else)
- [x] **B7.12** No library name or link appears in any of the new UI. — no "excalidraw" in the text, the `aria-label`s or the `title`s of the board page, and no outbound link

- [x] **R1** A timer left running disappears from the top bar of a browser that opens the board more than five minutes after its end. Setup: a board whose timer has ended. Action: `docker exec skrum-pgsql-1 psql -U sail -d skrum -At -c "update whiteboards set timer_ends_at = now() - interval '6 minutes' where id = '<id>'"`, then reload B. Expected: no timer in B's top bar and `timerEndsAt` is null in `GET snapshot`.
- [x] **R2** The reactions bar, the shapes toolbar and the canvas's bottom controls are never covered by the status row, the overlay or the panel. Setup: a board with notes, A facilitating. Action: take screenshots at 1280 px and at 375 px with a vote open and with a vote closed (panel shown). Expected: nothing covers those controls in any of the four screenshots. — the narrow pair at 500 px, not 375 px; with the panel shown at 500 px the canvas is not on screen at all

## Regression of 17a and 17b basics

- [x] **G1** A new board from a template still opens. — Brainstorm; also on the new Blank board: a rectangle and a sticky note drawn by A, seen by B on joining, reactions bar present, no library name
- [x] **G2** A sticky note added by A reaches B within a second. — on B's screen 0.85 s after the click
- [x] **G3** A reload keeps the scene with no write-back (no `PUT elements` after reload, same `seq`). — seq 2 before and after, two `GET elements` and no `PUT`
- [x] **G4** "Duplicate this board" and "Save as template" still work from the board menu. — the copy opened; POST template 201, toast "Template saved."
- [x] **G5** Setup: a board with a vote result, a locked shape and a timer. Action: duplicate it. Expected: the copy has no vote, no lock and no timer. — two copies, the second made while the board itself was locked with a timer running: no vote session, `locked` false, `timer_ends_at` null. The locked shape is still locked in the copy (the element's own flag is copied)

## Feature tests that pin these criteria

Since the removal of 2026-10-01 the files `WhiteboardVotingTest`, `WhiteboardVotingWritesTest`, `WhiteboardVoteModelTest` and `WhiteboardVotingSecrecyTest` no longer exist, and `WhiteboardElementWritesTest` no longer holds a text freeze or a refund. The kept cases they held moved: the facilitation defaults of a board to `WhiteboardModelTest`, the refusal of people outside the team on the timer to `WhiteboardTimerTest`, the second write of an element whose id is "0" to `WhiteboardElementWritesTest`.

- `WhiteboardTimerTest`: shared countdown, the five-minute cut-off of the snapshot.
- `WhiteboardLockTest`: board lock on writes and uploads, 403 `errors.locked`.
- `WhiteboardElementWritesTest`: element lock, rejected writes with the stored copy, the text freeze under vote, refund of deleted notes.
- `WhiteboardFacilitationTest`: hand-over, candidates, follow-me switched off on take-over, people outside the team refused.
- `WhiteboardVotingTest`, `WhiteboardVotingWritesTest`, `WhiteboardVoteModelTest`: sessions, budget, one vote per note, close and results.
- `WhiteboardVotingSecrecyTest`: no other member's votes and no total before the close, on every surface.

Follow-me has no server rule to test: its whispers never reach the server. "Blocked while private writing is on" arrives with plan 17d.
