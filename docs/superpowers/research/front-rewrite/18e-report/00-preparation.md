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
