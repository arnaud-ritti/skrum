# Plan 18e — Task 0, preparation

Written at the integration of wave 1 from the task reports of 0.2 to 0.15. No mockup comparison was made by a human yet (gate G-visual).

## Admin pages of plan 18d (Task 0.15)

### Places left

| Slot | Where | Roadmap |
|---|---|---|
| AD-1, other admin sections | the `entries` list of `resources/js/components/admin/admin-shell.tsx`; a new section is one more entry | AD-1 |
| AD-2, version line | under `[data-slot="admin-host"]` in the admin navigation column | AD-2 |

### Differences with the mockup

| Difference | Row |
|---|---|
| Sections other than Branding and Admins, and the version line, are absent | D-35 |
| The "Self-host" badge sits at the end of the topbar, before the unsaved-changes bar, not beside the breadcrumbs; breadcrumbs read "Administration > section", not "host > Administration" | none: `AppLayout` has one `actions` slot. For the owner (G-deviations) |
| Below `lg` the admin navigation is a "Section" select and the host is hidden; below `md` the badge is hidden and the unsaved count is for screen readers only | the mockup README (mobile) |
| The colour notice is always shown (neutral without a warning) and has a second-theme line | none: kept for the slots `color-entered`, `color-applied-light`, `color-applied-dark` of `P18d-01`. For the owner |
| "Sign-in pages", "Powered by Skrüm" and GIFs are cards under the Branding block; the member-choice switch sits under the avatar grid | M30 as built; for the owner |
| Radius: a stored 10 (the product default) shows "Standard" (8) selected | none. For the owner: map Standard to 10, or select nothing when the stored value is not a segment |
| A staged image removal can only be undone by the global Cancel | none. For the owner |

Compared side by side by the implementer on light 1440 FR and dark 390 EN only.

## Session shell (Tasks 0.3 to 0.6, bench of 0.14)

Bench: `/dev/design-system/session-shell`; captures `tests/visual/__screenshots__/session-shell-*.png`.

What the header holds at its worst case (120-character title, two badges, nine phases, facilitator timer, twelve people, cursor toggle, Share, menu):

- From `md`: everything fits in 3.5rem once the title is capped (the bench caps it at 12rem, 20rem from `xl`) and the badges show from `xl`. Without a cap the title starves the stepper: `SessionFrame` lets the title take the room. The stepper is then in its "Phase n/m" form; the full rail of nine phases needs 56rem.
- Below `md`: the row fits the back link, a truncated title, a timer without its controls, the presence counter and one menu. The bench puts the stepper under the header, Share in the menu and drops the cursor toggle. A facilitator's timer controls do not fit in the header at 390: the mobile board (R13) has to place them elsewhere.
- `PresenceStack` wraps its guests badge under the header unless it is given `flex-nowrap shrink-0`.

### Differences with the mockup

| Difference | Row |
|---|---|
| The reaction picker also offers "More emoji…" | D-01 |
| The topbar connection state is hidden from assistive technology, and hidden below `md` | D-05; below `md` the banner alone fits |
| "Time's up!" is announced twice to screen readers (the timer's live region and the toast) | none. For the owner |
| The GIF search is a modal dialog around `GifPicker`, not a popover (desktop) and a drawer (phone) | none. R4 and G5 may revisit it |

## Rework RW-C2 (owner round 4): session header

Built on every session screen of this branch (poker room, game room, whiteboard; the retro picks it at its merge):

| Element of the mockups | Where | Done |
|---|---|---|
| "team · session type" above the title | `SessionTitle` `overline`; poker "Atlas · Planning poker", game room "Atlas · Games" ("Atlas · Icebreaker" for the room of a retro) | done |
| User avatar at the end of the topbar; a guest's avatar for a guest | `SessionShell` `self`, drawn by `SessionLayout` (falls back to the signed-in user) | done |
| "Synced" while connected | `SessionShell`, `ConnectionState status="synced"`, in the new `status` slot of `SessionFrame`, before the timer; never carries `data-realtime` | done |
| Whiteboard: logo, breadcrumb "team › Whiteboards › name", rename in place | `SessionShell chrome="logo" homeHref`, `SessionTitle crumbs`; no application rail on this screen | done |
| Team name in the snapshots | `game.teamName` (poker), `board.teamName` (whiteboard), null for a guest as `room.teamName` already was | done |

New props, all optional (nothing existing changed): `SessionFrame` `logo`, `status`, `avatar`; `SessionLayout` `status`, `chrome`, `homeHref`, `self`; `SessionShell` `chrome`, `homeHref`, `self`; `SessionTitle` `overline`, `crumbs`; `ConnectionState` status `synced` and `labelClassName`; `PresenceStack` marks its guests badge `data-slot="presence-stack-guests"`.

Header budget, as built: below 48rem the overline, the breadcrumb, "Synced", the viewer's avatar, the guests badge and a guest's logo are not shown; from 48rem to 80rem "Synced" is its dot (label for screen readers); the whiteboard's facilitation tools show labels from 96rem.

### Differences with the mockup

| Difference | Row |
|---|---|
| A guest reads the session type alone ("Planning poker", "Games", "Whiteboards › name"): no team name | D-47, D-69 |
| "Synced" is a dot between 48rem and 80rem, absent on a phone | D-48 |
| The mockups of the retro and of the first poker screens show no "Synced" and no avatar at the end; the owner asked for both on every session screen (round 4) | owner answer |
| Whiteboard: the current crumb is 0.875rem in the header, 1rem on a phone and in its rename field | fix later |
| Whiteboard: no "Comments" button (place WB-2), facilitation tools kept | D-50 |
| Whiteboard at 390: logo, name, counter, Share and the menu; the mockup's phone header has a subtitle "Whiteboard · n online" | D-63, `07-whiteboard.md` |
| Poker: "Share" is an icon below 96rem | D-69 |
| Game room: "Back to the team", not "Back to games" | D-57 (RW-G1) |
| The viewer's avatar at the end is not a menu; on the whiteboard, which has no rail, the account menu is reached from the team page | to report: no row yet |
