# Plan 17d — whiteboard secrecy and history: walkthrough

## Before starting

Run `vendor/bin/sail artisan migrate --no-interaction` and `npm run build`. Keep a queue worker running for the automatic versions: `vendor/bin/sail artisan queue:work`. Accounts and origins are those of `.superpowers/sdd/whiteboard-rules.md`: facilitator A (Fran Facilitator) on `http://localhost`, member B (member@skrum.test, or a guest) on `http://127.0.0.1`. Unticked lines are not yet replayed. Console calls use `fetch` with the XSRF header against the board's JSON endpoints (`snapshot`, `elements`, `versions`, `duplicate`, `template`, vote sessions).

## Private writing (R9)

### 1. A masked note carries no text for anyone but its author

Given private writing is on, when member A writes a sticky, then member B and the facilitator see a masked note at the same place and no payload they receive contains its text.

- [ ] Setup: facilitator A and member B on the same board, private writing on (B7.1).
- [ ] Action: B writes a note "Secret idea"; A fetches `GET snapshot` and `GET elements?since=0` from the console.
- [ ] Expected: A sees the note masked with "•••" at the same place, same size and colour (B7.2, B7.3); neither response contains "Secret idea" (B7.5); B's second tab shows the text (B7.6); the status sentence and the "Hidden note" mark are shown (B7.10).

### 2. A masked note cannot be changed by another member

Given a masked note, when another member edits or deletes it, then the write is rejected and the author's text is intact.

- [ ] Setup: as 1.
- [ ] Action: A drags, erases and types on B's note; A sends `PUT elements` from the console with the masked text at `version + 1` and `text: "Overwritten"`.
- [ ] Expected: each attempt returns to the masked note (B7.4, B7.11); the console call answers `rejected[0].reason = "private"` with an element whose `text` is empty (B7.12); `select data->>'text' from whiteboard_elements where element_id = '<text id>'` still reads "Secret idea".

### 3. The reveal shows every note to every member

Given the facilitator reveals, then every member sees every note's text without reloading.

- [ ] Setup: as 1, plus a second hidden note B deleted.
- [ ] Action: A clicks "Reveal the notes".
- [ ] Expected: every browser shows "Secret idea" within about a second; the deleted note does not come back; the banner and the marks are gone (B7.7).

### 4. Features that would leak a hidden note are refused

While private writing is on, voting, version history, duplicate and save-as-template answer 422 "Reveal the notes first."

- [ ] Setup: private writing on.
- [ ] Action: from A's console, `POST duplicate`, `POST template`, `GET versions`, `GET versions/<id>`, `POST versions/<id>/restore`, `POST versions/<id>/copy`, and opening a vote.
- [ ] Expected: 422 with that message for each; the menu entries, "Start a vote" and the history button are disabled (B7.8, B7.9, B8.1). `POST versions` (saving) answers 201: it returns nothing of a scene (spec §9).

## Version history (R10)

### 5. Automatic versions

Given edits over more than 5 minutes, then automatic versions exist, at most one per 5 minutes, and never more than 50.

- [ ] Setup: a board, the queue worker running.
- [ ] Action: edit, wait five minutes, edit again, wait five minutes; read `select name, seq, created_at from whiteboard_versions where whiteboard_id = '<id>' order by created_at`.
- [ ] Expected: one automatic version per five-minute window of activity, none while idle (B8.2). The cap of 50 is pinned by `WhiteboardAutomaticVersionsTest` ("keeps the last fifty automatic versions and every named one") and not replayed by hand (B8.9).

### 6. Restore

Given a version, when the facilitator restores it, then every connected browser shows that scene and a "Before restore" version exists that restores the prior state.

- [ ] Setup: A and B on a board with a saved version, then more edits.
- [ ] Action: A restores the version, then restores "Before restore · …".
- [ ] Expected: both browsers show the version, then the previous state, each time without a reload (B8.3, B8.4, B8.5, B8.6, B8.7, B8.8, B8.10, B8.11).

### 7. Guests have no history

A guest gets 403 on every version endpoint.

- [ ] Setup: guest on 127.0.0.1.
- [ ] Action: from the guest's console, the seven version requests (`GET versions`, `POST versions`, `GET`, `PATCH`, `DELETE versions/<id>`, `POST …/restore`, `POST …/copy`).
- [ ] Expected: 403 "Guests cannot do this." for each; no history button.

## Feature tests that pin these criteria

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
