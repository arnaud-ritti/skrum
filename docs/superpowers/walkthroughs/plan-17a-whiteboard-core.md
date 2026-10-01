# Walkthrough: whiteboard core (plan 17a)

Run on 2026-10-01 in Chrome against the local Sail stack, after the final-review fixes (commit 241cff2). Member A = Fran Facilitator on `http://localhost`; guest B = "Guest Gia" on `http://127.0.0.1` (separate cookie jar, same Chrome). Ticked lines were observed; unticked lines carry the reason.

## Result

Sections 1–8 pass, with three lines not replayed (image paste, non-member 403, in-board guest action) and two defects found:

- **Library button and help-dialog links still visible.** The rules in `resources/css/app.css` exist but lose to the library's own stylesheet (same specificity, loaded later with the lazy chunk). The "Library" button (top right) and the help dialog's Documentation / blog / issue / YouTube links are shown.
- **Sticky notes are dark in the dark theme.** The canvas dark mode inverts element colours, so a yellow note renders dark brown while its swatch is yellow.

Latency (spec §6.4): 11 `PUT elements` requests during drags took 39–114 ms (median 56 ms), and a drag sends its intermediate states (one element went from version 5 to 49 during a single drag). Local machine, scripted drags rather than a steady 10 s hand drag.

## 1. Create from the team page

- [x] Setup: logged in as a team member, on the team page.
- [x] Action: use "New whiteboard", enter a title, press "Create".
- [x] Expected: you land on the board as its facilitator; going back to the team page lists the board. — board listed on the team page; facilitator confirmed by the snapshot

## 2. Live sync between a member and a guest

- [x] Setup: A (member) and B (guest, via the guest link) open the same board in two browsers. — guest joined through the guest link; presence showed 2 online
- [x] Action: on A add a sticky note, a shape, a connector, a freehand drawing and an image. — sticky note, rectangle, arrow, freehand stroke; image NOT replayed (needs a file picker)
- [x] Expected: each one appears on B within 1 s. — all four were on B at the first check, about 1 s later

## 3. Concurrent drag converges

- [x] Setup: A and B on the same board with one element.
- [x] Action: both drag the same element and release. — one after the other in the same second, not truly simultaneous
- [x] Expected: the element ends at the same position on both sides. — same position on both after the drags and after a reload

## 4. Reload keeps the scene

- [x] Setup: a board with several elements.
- [x] Action: reload A, then B.
- [x] Expected: the scene is identical to before the reload on both. — identical; the reload caused no write (0 PUT, seq unchanged)

## 5. Offline edits replay

- [x] Setup: A and B on the same board.
- [x] Action: put A offline (devtools), edit on A, edit on B, put A back online. — A's requests to the board were blocked from the page (2 blocked) instead of devtools offline; A showed "Reconnecting…"
- [x] Expected: A's offline edits reach B, and B's edits arrive on A. — B's diamond reached A while A was blocked (broadcast); A's ellipse reached B after unblocking

## 6. Guest access off

- [x] Setup: facilitator turns off "Allow guests to join with a link".
- [x] Action: open the guest link; separately open the board URL as a logged-in non-member. — guest link opened; the non-member part was NOT replayed (every demo user can view the team) — covered by WhiteboardAccessTest
- [x] Expected: the guest link shows "This guest link is no longer valid."; the non-member gets 403. — guest link answers 404 "no longer valid"

## 7. Regenerate the guest link

- [x] Setup: guest B is on the board with the current guest link.
- [x] Action: facilitator uses "Replace the guest link", then B performs an action. — link replaced; the guest tab had been closed, so B reloaded the board instead of acting inside it
- [x] Expected: B's next action shows the session-ended state. — session-ended page, snapshot 403, old link "no longer valid"

## 8. Tampering

- [x] Setup: in the browser console of a member, on the board page.
- [x] Action: `fetch` a `PUT elements` with a forged `authorMemberId`; another with an `iframe` type; another with a `javascript:` link; upload an SVG. — also sent: a line without points, a version above the integer range next to a valid element, a facilitator lock
- [x] Expected: none is stored (check with `database-query`). — forged author key dropped and author = the requester; customData reduced to the sticky marker; link stored as null; iframe, pointless line and huge version rejected with 200 while the valid element of the same batch was saved; SVG upload 422; no file stored

## 9. Full board

Covered by `WhiteboardElementWritesTest` ("refuses new elements on a full board"). Not replayed by hand.
