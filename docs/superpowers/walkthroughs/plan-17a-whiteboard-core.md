# Walkthrough: whiteboard core (plan 17a)

Not run yet. Every box below is unticked until a human (or the plan 16 browser harness) replays it with two browsers.

Setup common to all sections: a team with a member A (facilitator-capable) and a second browser B (guest or member, as stated).

## 1. Create from the team page

- [ ] Setup: logged in as a team member, on the team page.
- [ ] Action: use "New whiteboard", enter a title, press "Create".
- [ ] Expected: you land on the board as its facilitator; going back to the team page lists the board.

## 2. Live sync between a member and a guest

- [ ] Setup: A (member) and B (guest, via the guest link) open the same board in two browsers.
- [ ] Action: on A add a sticky note, a shape, a connector, a freehand drawing and an image.
- [ ] Expected: each one appears on B within 1 s.

## 3. Concurrent drag converges

- [ ] Setup: A and B on the same board with one element.
- [ ] Action: both drag the same element and release.
- [ ] Expected: the element ends at the same position on both sides.

## 4. Reload keeps the scene

- [ ] Setup: a board with several elements.
- [ ] Action: reload A, then B.
- [ ] Expected: the scene is identical to before the reload on both.

## 5. Offline edits replay

- [ ] Setup: A and B on the same board.
- [ ] Action: put A offline (devtools), edit on A, edit on B, put A back online.
- [ ] Expected: A's offline edits reach B, and B's edits arrive on A.

## 6. Guest access off

- [ ] Setup: facilitator turns off "Allow guests to join with a link".
- [ ] Action: open the guest link; separately open the board URL as a logged-in non-member.
- [ ] Expected: the guest link shows "This guest link is no longer valid."; the non-member gets 403.

## 7. Regenerate the guest link

- [ ] Setup: guest B is on the board with the current guest link.
- [ ] Action: facilitator uses "Replace the guest link", then B performs an action.
- [ ] Expected: B's next action shows the session-ended state.

## 8. Tampering

- [ ] Setup: in the browser console of a member, on the board page.
- [ ] Action: `fetch` a `PUT elements` with a forged `authorMemberId`; another with an `iframe` type; another with a `javascript:` link; upload an SVG.
- [ ] Expected: none is stored (check with `database-query`).

## 9. Full board

Covered by `WhiteboardElementWritesTest` ("refuses new elements on a full board"). Not replayed by hand.
