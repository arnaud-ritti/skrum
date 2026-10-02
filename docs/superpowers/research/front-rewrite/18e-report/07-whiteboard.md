# Group 7 — Whiteboard

## Task 7.1 — Guest join

### Parity (brief 07 §3, rows 56–61)

| # | Action | New control | Done |
|---|---|---|---|
| 56 | Join: name and submit | `GuestJoinPage` (`kind="whiteboard"`): `#name` ("Your nickname"), prefilled with `suggestedName`; "Join" posts `{ name }` to `whiteboards.join.store` | yes |
| 57 | Join: validation error | the shared `errors.name` is shown under the field (`role="alert"`); "Join" is disabled until the name is edited | yes |
| 58 | Join: invalid link (HTTP 404) | `AccessNotice` with "Join a whiteboard" and "This guest link is no longer valid.", no form | yes |
| 59 | Already a member → redirect; 429 | server only, unchanged | yes |
| 60 | Head title | `<Head>` in the page: the board title, or "Join a whiteboard" for an invalid link | yes |
| 61 | Guests see no team link | the page has no link but "Log in" | yes |

Added by rule 13 (M28): the session card shows "Live", the number of participants and "… facilitates" (prop `session` of B45); the join button is pinned to the bottom of the card below 768 px.

The brief's `components/whiteboard/guest-join-form.tsx` is not written (K2): the page uses the shared `GuestJoinPage`.

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| Avatar colour picker | `takenColors` (and `initialPresence`) of `skrum/GuestJoin`; `GuestJoinPage` does not pass them | GU-1 |
| Short session code | `session.code` of `skrum/GuestJoin` | GU-2 |
| Random nickname ("Loutre pensive", "Another random nickname") | `defaultName`, `onRandomName` of `skrum/GuestJoin` | no roadmap row: reported |

### Differences with the mockup

| Difference | Row |
|---|---|
| No colour picker, no short code | D-32 |
| The button reads "Join", the mockup "Rejoindre la session" | browser contract: `joinAsGuest` clicks "Join" (plan, Task 7.1 "Browser tests changed: none") |
| No suggested random nickname: with an empty field the preview shows the generic avatar and the sentence "Suggested nickname if you leave it empty" without a name | no row: reported (the server has no random name for a whiteboard; the sentence comes from `skrum/GuestJoin`) |
| The logo appears twice: in the header of the centred `AuthLayout` and in the card | no row: reported (Task 0.7 frame; the mockup shows the card alone) |
| A language select in the header, "Powered by Skrüm" in the footer | no row: the centred `AuthLayout` of Task 0.7 |
| Invalid link: a notice card, not in the GuestJoin mockup | brief 07 "No mockup" list; `AccessNotice` of Task 0.7 |

### Captures

`tests/Browser/Visual/WhiteboardVisualTest.php`: `whiteboard-join-*` and `whiteboard-join-invalid-*` (light and dark, 390 and 1440, EN and FR), taken on the real page.
