# Group 4 — Team page

## Task 4.1 — Team page on the new layout: sessions, members, settings

### Parity (brief 04 §3, rows 1–23, 32–41)

| # | Action | New control | Done |
|---|---|---|---|
| 1 | Open team action items | header link "Open action items (n)": one sentence, the count drawn as a soft badge (`a:has-text("Open action items (1)")` still matches) | yes |
| 2 | Open team games | header link "Games" (`main a[href$="/games"]`) | yes |
| 3 | Open integrations | header link "Integrations" with the gear icon, only with `canManageIntegrations` | yes |
| 4 | Rename team | "Team settings" card: `input[name="name"]` named "Team name", "Rename", error under the field; managers only | yes |
| 5 | Delete team | same card: "Delete team", `ConfirmDialog` "Delete this team?" | yes |
| 6 | Open a retro | `SessionCard`, `a[href="/retros/{id}"]`, phase as the status badge | yes |
| 7 | Retros empty state | `EmptyState` "No retrospectives yet.", before the Planning poker section | yes |
| 8–10 | New retrospective / game / whiteboard | the one "New session" trigger of the header (1-D2, D-09); no trigger per type | yes |
| 11 | Estimation history | ghost link in the Planning poker header | yes |
| 12 | Saved decks | entry of the "…" menu "Planning poker actions" (4-D6), a link to the page of 1.5 | yes |
| 13 | Open a poker game | title link and the row button; "n tasks · n estimated · n points" in one text node | yes |
| 14 | Active and ended games | two groups in one card, "Active games · n", "Ended games · n" | yes |
| 15 | Poker empty state | `EmptyState` "No games yet." | yes |
| 16 | Open a whiteboard | card link `a[href="/whiteboards/{id}"]` holding "Facilitated by :name · date" | yes |
| 17 | Delete a whiteboard | `button[aria-label="Delete :title"]` outside the link; dialog (`role="dialog"`) "Delete this board?", "Delete this board"; `router.reload({ only: ['whiteboards'] })` | yes |
| 18 | Whiteboards empty state | `EmptyState` "No whiteboards yet." | yes |
| 19 | Whiteboard templates | entry of the "…" menu "Whiteboards actions" (4-D6); opens the manager of 1.3; focus goes back to the "…" button | yes |
| 20–23 | Edit, delete, empty state and HTTP errors of the templates manager | unchanged (`whiteboard-templates-dialog.tsx` of 1.3, now opened from outside) | yes |
| 32 | List members | "Members" card with count, avatar (`avatarUrl`, 4-D4), name, e-mail; six rows then "Show n more" | yes |
| 33 | Remove a member | "Remove" per row, then `ConfirmDialog` "Remove :name from :team?" (4-D5) | yes |
| 34 | Add a member | select "Add a member" and "Add" in the card footer, with the server error | yes |
| 35 | Breadcrumb | workspace › Teams › team | yes |
| 36 | Page title | `<Head title={team.name}>` | yes |
| 37 | `/dashboard` | back end, Task 4.0a | yes |
| 38 | Sidebar entries | `#sessions`, `#mood`, `#members`; `aria-current` follows the hash (`useTeamAnchor`) | yes |
| 39 | Lazy props of the creation dialog | unchanged (group 1) | yes |
| 40 | Heading "Retrospectives" | `h2` with icon and count | yes |
| 41 | Headings "Planning poker", "Whiteboards" | `h2` with icon; count on Whiteboards | yes |

Rows 24–31 (health check statements) are Task 4.2: the old section is mounted as it was, in a card inside `#mood`.

Added by rule 13: template, facilitator and ROTI on a retro card (M16); "n in the room" from the deferred `pokerPresence` (M17), a skeleton while it loads, nothing when the presence server does not answer.

### Places left

Slots of `TeamPage` (`slots` prop, type `TeamPageSlots`); nothing is rendered while a slot is undefined.

| Mockup element | Slot | Later |
|---|---|---|
| Sprint and next retro under the team name | `slots.schedule` → `schedule` of `TeamHeader`, end of the meta line | TM-1 |
| Recent sessions table | `slots.recentSessions`, first block of the main column (`#sessions`) | TM-2 |
| Aggregated open actions | `slots.openActions`, first block of the side column | TM-3 |
| Activity feed | `slots.activity`, last block of the main column | TM-4 |
| Participants, cards and actions of a retro card | `slots.retroStatsFor` → `stats` of `SessionCard` | TM-5 |
| Role badge of a member | `slots.roleBadgeFor` → `roleBadgeFor` of `TeamMembersCard`, end of the row | TM-6 |
| Whiteboard thumbnail | `slots.whiteboardThumbnailFor` → `thumbnailFor` of `TeamWhiteboardsSection`, above the name | TM-7 |
| "Invite" in the members card | `slots.inviteAction` → `inviteAction` of `TeamMembersCard`, card header | IN-4 |

The plan names "grid areas" for TM-2, TM-3 and TM-4; they are slots, because an empty grid row would still take its gap.

### Differences with the mockup

| Difference | Covered by |
|---|---|
| No creation tiles and no "New retrospective" / "New game" / "New whiteboard" button in the sections; one "New session" in the header | D-09 |
| No "Invite", sprint and next retro, recent sessions table, aggregated actions, activity feed, counts on a retro card, role badge, whiteboard thumbnail | D-18 |
| "Saved decks" and "Whiteboard templates" in a "…" menu | owner answer 4-D6 |
| No "View all" beside Retrospectives | D-06 (no Sessions page) |
| The gear of the header is a labelled "Integrations" link, not an icon button named "Team settings" | to report: browser contract (`click('Integrations')` of P12a, not in the list of changed tests) |
| The footer word of a retro card is "Join" for every open phase (the mockup has "Join" and "Resume") | to report: the page does not know whether the viewer has joined |
| Badge tones: Voting warning, Completed muted, every other open phase info with the dot (the mockup shows three phases only) | to report |
| A game row keeps "· n points" in its meta line and also has the Points column | to report: browser contract (`3 tasks · 1 estimated · 5 points`, P10a-12) |
| The row button of a game without players is "Open the game", not "Open" | to report: the key "Open" is the status of an action item ("Ouverte") |
| "Join" on a game row only when someone is in the room | mockup, read as such |
| "Ended games" group, the trash of a whiteboard, the add and remove controls of members, the "Team settings" card | no mockup: parity rows 14, 17, 33, 34, 4, 5 |
| Health check card: the old manager, not the compact read-only card | Task 4.2 |
| The two-column grid starts at 80rem of viewport (the mockup says about 64rem of content) | to report: with the sidebar, 64rem of viewport leaves 18rem to the main column |
| "Remove" reads "Supprimer" in French on a member row (existing key); the dialog title says "Retirer" | to report |
