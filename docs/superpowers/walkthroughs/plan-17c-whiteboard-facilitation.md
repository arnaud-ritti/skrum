# Plan 17c — whiteboard facilitation: walkthrough

Not run yet. Replay it in Chrome against the local Sail stack; tick a line only when observed, and leave a line unticked with the reason when it was not replayed. Each line reads Setup, then Action, then Expected; the lines named B5.x, B6.x and B7.x are the browser checks of plan 17c, Tasks 5 to 7.

## Before starting

Run `vendor/bin/sail artisan migrate --no-interaction` and `npm run build`. Accounts, origins and tab rules are those of `.superpowers/sdd/whiteboard-rules.md`:

- Member A: `http://localhost`, logged in as "Fran Facilitator" (`facilitator@skrum.test`, password constant of `database/seeders/DemoSeeder.php`). Team page: Demo Workspace → Demo Team. Create a fresh board for the run (Blank template) and note its id.
- Guest B: `http://127.0.0.1` (separate cookie jar, same Chrome). Enable guest access on the board, read the token with `docker exec skrum-pgsql-1 psql -U sail -d skrum -At -c "select guest_token from whiteboards where id='<board id>'"`, open `http://127.0.0.1/whiteboards/join/<token>`.
- Second member: `member@skrum.test` on `http://127.0.0.1`, only for the lines that say "second member". One account per origin: finish every guest line first, then sign in as the member on that origin (a guest session there ends when you do).
- **A guest is enough for every criterion**: a guest is a non-facilitator, votes, is locked out and follows. The walkthrough therefore does not depend on a second login. Only B7.9's "for a member" and B6.5's take-over need the second member, and each such line says how to check the same thing through `GET snapshot` when that login cannot be made.
- Create and open only your own tabs, and close them when done. Never trigger a native dialog. When a canvas input cannot be driven after two attempts, check the same thing through the board's JSON endpoints (`fetch` with the XSRF header) and say so on the line.
- Reading the countdown: the top-bar timer has `role="timer"`; read its text in both tabs within the same second.


## 1. Given the facilitator starts a 60-second timer, then every browser shows the same countdown and "Time's up" at zero

- [ ] **T1.1** Setup: A facilitates, B is on the board. Action: A starts "1 min". Expected: both show the same remaining time (read the `role="timer"` text in both within the same second, at most one second apart), and both show "Time's up!" at zero.
- [ ] **T1.2** Setup: the timer of T1.1 is running or has ended. Action: in A's and B's tab fetch `GET /whiteboards/<id>/snapshot`. Expected: both bodies carry the same `timerEndsAt`.

- [ ] **B5.1** Facilitator: the top bar shows a timer button and a lock button; a member and a guest see neither. Nothing new lies over the canvas, its shapes toolbar, its bottom controls or the reactions bar, at 1280 px and at 375 px; the canvas still fills the area under the bars.
- [ ] **B5.2** A starts "1 min": within a second every browser shows the same countdown in the top bar (A and B at most one second apart); at zero each shows "Time's up!", a toast, and plays the sound. "Stop timer" removes it everywhere. A browser that opens the board mid-countdown shows the right remaining time.


## 2. Given the board is locked, when a non-facilitator writes an element, then the server answers 403 and the element is unchanged; the facilitator can still edit

- [ ] **L2.1** Setup: one shape on the board, drawn by A. Action: A locks the board; B tries to draw, then sends a `PUT elements` by `fetch` with the XSRF header; A then moves the shape. Expected: B is in view mode; the `fetch` answers 403 with `errors.locked`; the shape in `GET snapshot` is unchanged by B and changed by A.

- [ ] **B5.3** A locks: B's canvas loses its shapes toolbar and the sticky tool (in the toolbar and in the top bar), a drag pans, the status row says "This board is locked."; B can still pan, zoom and send a reaction. A can still draw and B sees it. Unlock: B's tools come back without a reload.
- [ ] **B5.4** From B's console on a locked board, `fetch` a `PUT /whiteboards/<id>/elements` with one element and the XSRF header: 403, body `errors.locked`; the page stays on the board (no "Your access to this board has ended") and the element is not in `GET snapshot`.
- [ ] **B5.5** B starts typing in a text, A locks while B types: B's unsent text disappears, B sees the toast "This board is locked." and stays on the board in view mode, and A's canvas never shows the text.
- [ ] **B5.8** The canvas's own "View mode" entry (context menu on the empty canvas) is still there on an unlocked board.


## 3. Given a locked element, when a non-facilitator moves or unlocks it, then the write is rejected and their canvas returns to the server copy

- [ ] **E3.1** Setup: A locks one shape on an unlocked board. Action: B drags it; then B sends a `PUT elements` by `fetch` with `locked: false` and a higher version. Expected: the shape is back in place on B's canvas; the response's `rejected[0].reason` is `locked` and carries the stored copy; B's context menu has no lock entry.

- [ ] **B5.6** A locks a shape (context menu). B right-clicks it and the empty canvas: no "Lock" / "Unlock" / "Unlock all elements" entry; B drags the shape: it returns to its place and the toast "Only the facilitator can change a locked element." shows. A still sees the entries.


## 4. Given follow-me is on, when the facilitator pans, then followers' views follow; a follower who pans sees "Following paused" and "Resume" re-attaches them

- [ ] **F4.1** Setup: a board with content spread over more than one screen, A facilitating, B on the board. Action: run B6.1 to B6.7 below. Expected: each line as written.
- [ ] **F4.2** B6.5's take-over without a second login. Setup: follow-me is on. Action: A hands over facilitation to the second member's name in the board menu, then takes control back. Expected: `followEnabled` is false in `GET snapshot` after each step. (That `PUT facilitator` by the second member switches follow-me off is pinned by `WhiteboardFacilitationTest`.)

- [ ] **B6.1** A switches "Bring everyone to me" on: A's status row says "Everyone follows your view.", B's says "Following the facilitator", and B's view shows what A sees. B does not pause on its own: after ten seconds without touching B, its row still says "Following the facilitator". (If it pauses by itself, the canvas does not report back exactly the numbers it was given: compare with a tolerance of 1e-6 in `use-whiteboard-follow.ts` and say so.)
- [ ] **B6.2** A pans and zooms: B's view follows within about a second, and what A sees is inside B's window when the two windows have different shapes.
- [ ] **B6.3** B pans (or zooms): B's row says "Following paused" with "Resume"; A keeps moving and B's view stays. "Resume" brings B back to A's current view at once.
- [ ] **B6.4** A browser that opens the board while follow-me is on is brought to A's view within about 2 s.
- [ ] **B6.5** A switches it off: both rows lose the notice and B's view is free. A member takes control while it is on: it goes off (snapshot `followEnabled` false) and nobody is pulled to the new facilitator.
- [ ] **B6.6** On a locked board B (view mode) still follows, pauses by dragging, and resumes.
- [ ] **B6.7** Only the facilitator leads: with follow-me on, B's own pans and zooms never move A's view.


## 5. Given an open voting session, then no payload received by any member contains another member's votes or any total, and a member cannot exceed their budget

The secrecy invariant itself is proved by `WhiteboardVotingSecrecyTest` over every surface (snapshot, element fetch, write responses, broadcasts, versions, logs), not by this replay; the lines below observe it from the browser.

- [ ] **V5.1** Setup: a board with at least three sticky notes. Action: A opens a vote with 3 votes; B votes twice. In A's tab read `GET snapshot` and `GET vote-sessions/<id>` by `fetch`, and watch A's page. Expected: A's `voting.myVotes` is empty, there is no total and no other member's vote anywhere in the two bodies; B's fourth vote answers 422.

- [ ] **B7.1** Facilitator: the vote button opens a dialog (votes per participant, scope, several votes per note). A board without notes answers "There are no sticky notes to vote on." inside the dialog, which stays open. With a frame on the board the scope lists "Notes in <frame name>" (or "Notes in Frame 1" for a frame without a name).
- [ ] **B7.2** Vote open: every in-scope note has a vote control at its top-right corner in A and B; a note added afterwards has none. The controls stay on their notes while panning, zooming, and while a note is dragged; a control that scrolls under the shapes toolbar passes **behind** it, and none lies over the canvas's bottom controls or the reactions bar. The canvas still fills its area and the reactions bar sits where it did before this plan. (If a control covers a canvas control, do not raise the canvas controls: clip the overlay to the drawing area and say so.)
- [ ] **B7.3** B votes: B's control shows B's count, the status row counts down "Votes left", A's page shows nothing of B's vote (no count on the note, no change but "x of y finished voting" when B spends the last one). At a budget of zero the "+" or the toggle of other notes is disabled; forcing it (`fetch` the PUT with a higher count) answers 422 "You have no votes left.".
- [ ] **B7.4** While the vote is open no remote cursor is drawn in A or B even with "Show live cursors" on, and the status row says so; they come back when it closes.
- [ ] **B7.7** A second tab of B on the same board shows B's votes within about 2 s of a vote cast in the first tab.
- [ ] **B7.10** A locks the board during an open vote: B can still vote and cannot move a note.


## 6. Given a closed session, then every member sees the same counts on notes and the same ranked list

- [ ] **C6.1** Setup: the vote of section 5 holds votes from A and B. Action: A closes it. Expected: A and B show the same counts on the notes and the same ranked list.

- [ ] **B7.8** A closes the vote: in A and B the controls become count badges with the same numbers, and the results panel opens beside the canvas (the canvas shrinks; nothing is covered) with the same ranked list. "Show on the board" centres the note. A deleted note's entry has its button disabled.
- [ ] **B7.9** A hides the results: badges and panel disappear for both. The board menu's "Vote results" shows them again under "Previous votes" for A and for a member; a guest has no such entry and no history.
- [ ] **B7.11** Dark theme and 375 px width: controls, badges, status row and panel are legible; the panel takes the board area and closes.


## 7. Given an open session, when a sticky in scope has its text changed, then the write is rejected

- [ ] **S7.1** Setup: an open vote with a sticky in scope. Action: B sends a `PUT elements` by `fetch` with the sticky's bound text element, its `version` raised by one and its `text` and `originalText` changed. Expected: the response is HTTP 200 (not a 4xx) with `seq` equal to `fromSeq`, `rejected.length === 1`, `rejected[0].id` the id of that text element, `rejected[0].reason === 'voting'` and `rejected[0].element` the stored element with its old `text`, as `WhiteboardVotingWritesTest` pins; the text element is unchanged (same `text`, `originalText` and `version`) in `GET snapshot`.

- [ ] **B7.5** B double-clicks an in-scope note and types: the text snaps back and the toast "Notes cannot be edited while a vote is open." shows; B can still drag, recolour and resize it, and A sees those. A (facilitator) is refused the same way. Then B double-clicks an in-scope note, deletes all its words and clicks away: the words come back with the same toast; B and then A drag that note and its words move with it in both browsers; after the vote is closed a double-click on it edits the existing words (no second text appears on the note). B double-clicks an in-scope note that has no words and types: the words disappear with the toast, and the note can still be dragged.
- [ ] **B7.6** A deletes a note B voted for: B's "Votes left" goes back up within about 2 s without a reload.


## Around the criteria


- [ ] **B5.7** Board menu of A: "Hand over facilitation" lists the other team members and the workspace's owners and admins by name, never a guest; choosing one makes them facilitator (A's top bar loses the tools without a reload, the snapshot's `facilitatorMemberId` changes); A then takes control back from the menu. With nobody else to choose the dialog says "No one else can facilitate this board yet.".
- [ ] **B7.12** No library name or link appears in any of the new UI.

- [ ] **R1** A timer left running disappears from the top bar of a browser that opens the board more than five minutes after its end. Setup: a board whose timer has ended. Action: `docker exec skrum-pgsql-1 psql -U sail -d skrum -At -c "update whiteboards set timer_ends_at = now() - interval '6 minutes' where id = '<id>'"`, then reload B. Expected: no timer in B's top bar and `timerEndsAt` is null in `GET snapshot`.
- [ ] **R2** The reactions bar, the shapes toolbar and the canvas's bottom controls are never covered by the status row, the overlay or the panel. Setup: a board with notes, A facilitating. Action: take screenshots at 1280 px and at 375 px with a vote open and with a vote closed (panel shown). Expected: nothing covers those controls in any of the four screenshots.

## Regression of 17a and 17b basics

- [ ] **G1** A new board from a template still opens.
- [ ] **G2** A sticky note added by A reaches B within a second.
- [ ] **G3** A reload keeps the scene with no write-back (no `PUT elements` after reload, same `seq`).
- [ ] **G4** "Duplicate this board" and "Save as template" still work from the board menu.
- [ ] **G5** Setup: a board with a vote result, a locked shape and a timer. Action: duplicate it. Expected: the copy has no vote, no lock and no timer.

## Feature tests that pin these criteria

- `WhiteboardTimerTest`: shared countdown, the five-minute cut-off of the snapshot.
- `WhiteboardLockTest`: board lock on writes and uploads, 403 `errors.locked`.
- `WhiteboardElementWritesTest`: element lock, rejected writes with the stored copy, the text freeze under vote, refund of deleted notes.
- `WhiteboardFacilitationTest`: hand-over, candidates, follow-me switched off on take-over, people outside the team refused.
- `WhiteboardVotingTest`, `WhiteboardVotingWritesTest`, `WhiteboardVoteModelTest`: sessions, budget, one vote per note, close and results.
- `WhiteboardVotingSecrecyTest`: no other member's votes and no total before the close, on every surface.

Follow-me has no server rule to test: its whispers never reach the server. "Blocked while private writing is on" arrives with plan 17d.
