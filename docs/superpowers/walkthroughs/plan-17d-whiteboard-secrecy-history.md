# Plan 17d — whiteboard secrecy and history: walkthrough

> **Note, 2026-10-01 — private writing was removed.** After this walkthrough was run the product owner decided to remove private writing (and dot voting) from the whiteboard. The part "Private writing (R9)" below (sections 1 to 4), the "quick vote" regression line, the lines about hidden notes in "Result" and the table of the secrecy invariant at the end describe features that no longer exist; they are kept as the record of what was observed and are not to be replayed. "Version history (R10)" (sections 5 to 7) still applies; what the controller observed for sections 5 and 7 on 2026-10-01, before the removal, is recorded under each.

## Result

Date: 2026-10-01. Commit under test: 42e59a3. Run in Chrome against the local Sail stack on a fresh board "Walkthrough 17d" (`01a0f80f-4e04-7340-ba8f-dae20c767daa`), created from the Demo Team page with the Blank template.

**The run is incomplete: there was no second participant.** Only Fran Facilitator (A, `http://localhost`) was on the board, in two tabs. Every line that needs someone else's note or someone else's browser is unticked below. What the secrecy feature is for (another member's browser never receiving the text) was therefore NOT observed in a browser; it rests on the feature tests alone.

Why no second participant:

- Guest: enabling guest access on the board (`PATCH settings` from the console) was refused by the permission system of the walkthrough agent, so no guest link was opened. The refusal covers the outcome, so the menu entry was not clicked either.
- Second member: `http://127.0.0.1/login` was opened and showed a form the browser had autofilled with a saved account that is not a demo account. Nothing was typed or submitted. The agent's own rules allow a login with the seeder's test account only on the user's request in chat, which a sub-agent cannot see; the login was not made.

Defects: none found in what was replayed. No console error on the board page in either tab (console reading started after the first page load; tab 2 was read from its load).

Counts: 9 passed, 0 failed, 6 not replayed (sections 1, 2, 3, 5, 7 and the regression line "second participant sees them").

Environment, to know before the next run:

- **The queue worker is no longer running.** `php artisan queue:work --tries=1` (started Sep 30, not under supervisor) stopped on `queue:restart` and nothing started it again; it was not restarted by hand. Six `StoreAutomaticWhiteboardVersion` jobs of this board wait in `jobs` (ids 2 to 7), each made available five minutes after the write that queued it.
- Between 15:23:42 and 15:23:54 UTC the server log shows six `settings` requests on this board, and a `versions` request at 15:24:05, that this walkthrough did not send (no click or write was made in that window; a snapshot read at 15:23:43 showed `locked` true, the database showed `private_writing` true at 15:23:52, and everything was off again at 15:23:54). Somebody or something else used the board for those seconds, probably in the same Chrome window. Nothing of the kind was seen afterwards (requests and clicks of tab 1 were logged from 15:25 on).
- Left on the Demo Team: the board "Walkthrough 17d" with five versions ("V1 public only", "V2 saved while hidden", "V3 hidden with green note", two "Before restore · October 1, 2026 3:28 PM").

Seen in passing:

- The name of a "Before restore" version carries the server's time (UTC, "3:28 PM") while the line under it shows the viewer's time ("5:28 PM").
- Two restores in the same minute give two versions with exactly the same name.
- With private writing on, the board menu's "Vote results" entry stays enabled (it lists a closed vote's totals, no note text beyond what was public at the close).
- After clicking a colour of the sticky tool the focus stays on that button: Enter does not open the new note's text (already noted in 17c).
- A click on a top-bar button made while the history sheet is closing lands on the sheet and does nothing.

## Regression of 17a to 17c basics

- [x] A board is created from the team page. — "New whiteboard", title "Walkthrough 17d", Blank; landed on the board as facilitator
- [x] A rectangle and a sticky note are drawn. — rectangle by drag, yellow note from the sticky tool, "Public note" typed by double-click; snapshot seq 4
- [ ] A second participant sees them. — not replayed: no second participant. A's second tab showed both, and later showed a new note and both restores without a reload
- [x] A reload keeps the scene with no write-back. — tab 2 reloaded: `GET` board, `GET snapshot`, two `GET elements?since=4`, no `PUT`; seq 4 before and after
- [x] The reactions bar is present. — six reaction buttons bottom-centre
- [x] No canvas-library branding is visible. — no "excalidraw" in the text, `aria-label`s, `title`s or links of the board page, of the history sheet or of the preview dialog; no outbound link
- [x] A quick vote: open, one vote, close, results. — 3 votes each, one vote on "Public note" ("Votes left: 2"), close: badge "1" and panel "1. Public note 1 vote" in both tabs; "Hide the results" removed them. While the vote was open, "Private writing" answered the toast "Close the vote first."
- [x] Lock and unlock. — top-bar button: snapshot `locked` true then false, button label "Unlock the board" then "Lock the board". What a non-facilitator can do on a locked board was not seen (no second participant)

## Before starting

Run `vendor/bin/sail artisan migrate --no-interaction` and `npm run build`. Keep a queue worker running for the automatic versions: `vendor/bin/sail artisan queue:work`. Accounts and origins are those of `.superpowers/sdd/whiteboard-rules.md`: facilitator A (Fran Facilitator) on `http://localhost`, member B (member@skrum.test, or a guest) on `http://127.0.0.1`. Unticked lines are not yet replayed. Console calls use `fetch` with the XSRF header against the board's JSON endpoints (`snapshot`, `elements`, `versions`, `duplicate`, `template`, vote sessions).

## Private writing (R9)

**Removed on 2026-10-01.** Sections 1 to 4 are the record of the run at 42e59a3 and are not to be replayed: the switch, the masked notes, the reveal and the "Reveal the notes first." refusals no longer exist.

### 1. A masked note carries no text for anyone but its author (removed)

Given private writing is on, when member A writes a sticky, then member B and the facilitator see a masked note at the same place and no payload they receive contains its text.

- [ ] Setup: facilitator A and member B on the same board, private writing on (B7.1). — not replayed: no B (see Result). Private writing was switched on by A with the top-bar button
- [ ] Action: B writes a note "Secret idea"; A fetches `GET snapshot` and `GET elements?since=0` from the console. — not replayed: A wrote the note, nobody else was there to receive it
- [ ] Expected: A sees the note masked with "•••" at the same place, same size and colour (B7.2, B7.3); neither response contains "Secret idea" (B7.2); B's second tab shows the text (B7.6); the status sentence (B7.1) and the "Hidden note" mark (B7.2) are shown. — not replayed: masking, the "•••" and the "Hidden note" mark need another member's note. Observed with A as author only: the note and its text are stored with `is_private` true; A's second tab shows "Secret idea" (B7.6); the status row says "Notes are hidden until the facilitator reveals them. Other elements stay visible." with "The size of a note hints at the length of its text."; the button becomes "Reveal the notes". Pinned by "masks a private note for everyone but its author"
- [ ] B7.5 — Action: before switching private writing on, B writes a note "Old note"; with the switch on, B types more into it, then adds a plain text and a rectangle with a label. Expected: A reads "Old note" and what B types into it, the plain text and the rectangle's label; none of them is masked. — not replayed: no B (see Result)
- [ ] B7.10 — Action: with the switch on, A and B each type in a hidden note of their own at the same time for a minute. Expected: neither browser shows the "Reconnecting…" banner; each sees its own text and the other's "•••" mark. — not replayed: no B (see Result)

### 2. A masked note cannot be changed by another member (removed)

Given a masked note, when another member edits or deletes it, then the write is rejected and the author's text is intact.

- [ ] Setup: as 1. — not replayed: no other member (see Result); the three lines of this section rest on "refuses every change another member makes to a private note and keeps the text"
- [ ] Action: A drags, erases and types on B's note; A sends `PUT elements` from the console with the masked text at `version + 1` and `text: "Overwritten"`.
- [ ] Expected: each attempt returns to the masked note with the toast "Only its author can change a hidden note." (B7.4); the console call answers `rejected[0].reason = "private"` with an element whose `text` is empty; `select data->>'text' from whiteboard_elements where element_id = '<text id>'` still reads "Secret idea".
- [ ] B7.11 — Action: with the switch on, A and B each add a sticky note within the same second (before either browser has fetched the other's note) and both keep typing in their own. If that cannot be done by hand, from A's console send `PUT elements` with A's masked copy of B's note text at a new index and `version + 1`. Expected: neither sees the toast "Only its author can change a hidden note.", neither text editor closes, and each network log shows a few `PUT elements` at most, not one per flush; `select element_id, data->>'index', version from whiteboard_elements where whiteboard_id = '<id>' order by data->>'index'` shows four different indices once both are idle and both texts are intact; the forced call answers `rejected: []` and B still reads the text. Then B closes the tab while A's canvas still holds B's note: A's `PUT elements` do not repeat. — not replayed: no B (see Result); rests on "takes the new index a canvas gives a hidden note of someone else, and nothing else"
- [ ] B7.12 — Action: while B is typing in one hidden note of B's, A drags B's other hidden note; then, while A is typing in a note of A's in one tab, A drags B's note from a second tab. Expected: A gets the toast; B's editor stays open; the editor of A's first tab stays open. — not replayed: no B (see Result)

### 3. The reveal shows every note to every member (removed)

Given the facilitator reveals, then every member sees every note's text without reloading.

- [ ] Setup: as 1, plus a second hidden note B deleted. — not replayed as written: A wrote and deleted the second hidden note ("Deleted secret", green)
- [ ] Action: A clicks "Reveal the notes". — done by A, with only A's two tabs connected
- [ ] Expected: every browser shows "Secret idea" within about a second; the deleted note does not come back; the banner and the marks are gone (B7.7). — not replayed for another member. Observed in A's two tabs: banner gone in both without a reload, `privateWriting` false, the deleted note did not come back (still a tombstone in `GET elements?since=0`, absent from the snapshot), and the preview of "V3 hidden with green note", saved while that note was on the board, shows the board without it

### 4. Features that would leak a hidden note are refused (removed)

While private writing is on, voting, version history, duplicate and save-as-template answer 422 "Reveal the notes first."

- [x] Setup: private writing on.
- [x] Action: from A's console, `POST duplicate`, `POST template`, `GET versions`, `GET versions/<id>`, `POST versions/<id>/restore`, `POST versions/<id>/copy`, and opening a vote. — the vote was tried as `POST vote-sessions` from the console; its button is disabled
- [x] Expected: 422 with that message for each; the menu entries, "Start a vote" and the history button are disabled (B7.8, B7.9, B8.1). `POST versions` (saving) answers 201: it returns nothing of a scene (spec §9). — seven 422 "Reveal the notes first."; "Duplicate this board" and "Save as template" are `aria-disabled`, "Start a vote" and "Version history" are disabled with the title "Reveal the notes first."; `POST versions` 201 twice, body `{id, name, createdAt, createdByName, automatic}`

## Version history (R10)

### 5. Automatic versions

Given edits over more than 5 minutes, then automatic versions exist, at most one per 5 minutes, and never more than 50.

- [ ] Setup: a board, the queue worker running. — not replayed: the worker did not come back after `queue:restart` (see Result)
- [ ] Action: edit, wait five minutes, edit again, wait five minutes; read `select name, seq, created_at from whiteboard_versions where whiteboard_id = '<id>' order by created_at`.
- [ ] Expected: one automatic version per five-minute window of activity, none while idle (B8.2). The cap of 50 is pinned by `WhiteboardAutomaticVersionsTest` ("keeps the last fifty automatic versions and every named one") and not replayed by hand (B8.9). — not replayed. Observed without a worker: the first write queued `StoreAutomaticWhiteboardVersion` with `available_at` five minutes later, and so did the first write after each saved or "Before restore" version; no automatic version exists. `WhiteboardAutomaticVersionsTest` passes at 42e59a3 (run with `WhiteboardPrivateWritingTest` and `WhiteboardVersionsTest`: 52 passed)

Observed by the controller in Chrome on 2026-10-01, before the removal of dot voting and private writing: after the queue worker was restarted, it created one automatic version of the board. The five-minute cadence over several windows of activity was not observed, so the lines above stay unticked.

### 6. Restore

Given a version, when the facilitator restores it, then every connected browser shows that scene and a "Before restore" version exists that restores the prior state.

- [x] Setup: A and B on a board with a saved version, then more edits. — B was A's second tab, not another person. "V1 public only" saved from the history sheet with the rectangle and "Public note"; then the note "Secret idea" was added
- [x] Action: A restores the version, then restores "Before restore · …".
- [x] Expected: both browsers show the version, then the previous state, each time without a reload (B8.3, B8.4, B8.5, B8.6, B8.7, B8.8, B8.10, B8.11). — restore from the version's menu, in-page confirmation "Restore this version?", toast "Version restored."; the second tab lost "Secret idea" after one `GET elements?since=14` and one `GET snapshot`, no reload (seq 16); "Before restore · October 1, 2026 3:28 PM" appeared at the top of the list; restoring it brought "Secret idea" back in both tabs (seq 18) and not the note deleted while hidden. Also seen: the list (name, date, author), the read-only preview dialog, the menu "Copy to a new board / Restore / Rename / Delete". Not replayed: rename, delete, copy to a new board, a restore with a vote open, and a member who is not the facilitator

### 7. Guests have no history

A guest gets 403 on every version endpoint.

- [ ] Setup: guest on 127.0.0.1. — not replayed: guest access could not be enabled (see Result); the three lines of this section rest on the guest cases of `WhiteboardVersionsTest` and `WhiteboardVersionRestoreTest`
- [ ] Action: from the guest's console, the seven version requests (`GET versions`, `POST versions`, `GET`, `PATCH`, `DELETE versions/<id>`, `POST …/restore`, `POST …/copy`).
- [ ] Expected: 403 "Guests cannot do this." for each; no history button.

Observed by the controller in Chrome on 2026-10-01, before the removal of dot voting and private writing, with a guest on the board and the id of a real version: all seven version requests (`GET versions`, `POST versions`, `GET`, `PATCH` and `DELETE versions/<id>`, `POST …/restore`, `POST …/copy`) answered 403 "Guests cannot do this."; the guest's top bar had no history button; and the guest's change of the settings (`PATCH settings`) answered 403. The three lines above were not ticked by the walkthrough agent and are covered by this observation.

## Feature tests that pin these criteria

Since the removal of 2026-10-01: `WhiteboardPrivateWritingTest` and `WhiteboardPrivateWritingSwitchTest` no longer exist, `WhiteboardSecrecyModelTest` is now `WhiteboardVersionModelTest`, and the table below (the surfaces of the secrecy invariant) names tests that were removed with the feature. Version history is pinned by `WhiteboardAutomaticVersionsTest`, `WhiteboardVersionsTest`, `WhiteboardVersionRestoreTest` and `WhiteboardVersionModelTest`.

- `WhiteboardPrivateWritingTest`
- `WhiteboardPrivateWritingSwitchTest`
- `WhiteboardAutomaticVersionsTest`
- `WhiteboardVersionsTest`
- `WhiteboardVersionRestoreTest`
- `WhiteboardSecrecyModelTest`

| Surface of the invariant | Test |
|---|---|
| Snapshot, Inertia page and `GET elements` | "masks a private note for everyone but its author" |
| `rejected` copies | "refuses every change another member makes to a private note and keeps the text" |
| The index repair | "takes the new index a canvas gives a hidden note of someone else, and nothing else"; "takes nothing but an index from the canvas of another member" |
| `elements.changed` | "never broadcasts the elements of a write that touches a private note"; "reveals every live private note and makes every client fetch it" |
| Versions | "keeps the history closed while the notes are hidden"; "refuses to copy a version for guests, outsiders and while the notes are hidden"; "never previews a note that was deleted before the reveal"; "never restores or copies a note that was deleted before the reveal"; "keeps a note deleted while hidden out of a version when its id is used again" |
| Voting | "refuses to hide the notes while a vote is open"; "refuses to open a vote while the notes are hidden" |
| Duplicate and template | "refuses duplicate and save as template until the notes are revealed"; "copies the notes once they are revealed, and never one deleted while hidden" |
| Export | client-side from the masked copies (B7.8) |
| Log lines | "keeps the text of a note out of the log, even when the database refuses the write"; "keeps the scene out of the log when a version cannot be stored" |
