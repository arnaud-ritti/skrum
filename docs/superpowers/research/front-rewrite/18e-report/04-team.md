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

Rows 24–31 (health check statements) are Task 4.2, below.

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
| The two-column grid starts at 80rem of viewport (the mockup says about 64rem of content) | to report: with the sidebar, 64rem of viewport leaves 18rem to the main column |
| "Remove" reads "Supprimer" in French on a member row (existing key); the dialog title says "Retirer" | to report |

## Task 4.2 — Health check card on the new manager

`TeamHealthCard` (`components/teams/team-health-card.tsx`) mounts `HealthStatementsManager` inside `#mood` and saves through the five routes of the team. The manager is now a `section` named by its `h2`, like the other cards of the page.

### Parity (brief 04 §3, rows 24–31)

| # | Action | New control | Done |
|---|---|---|---|
| 24 | Reorder statements | handle `[aria-label="Drag to reorder"]`, PUT `teams.healthStatements.order.update` `{ids}`; the manager shows the new order until the props come back; announcement "Moving: :label. Position :position of :total." | yes |
| 25 | Add a statement | `[aria-label="Statement"]`, `[aria-label="Axis label"]`, "Add statement"; the draft stays with the server error under its field when refused | yes |
| 26 | Edit a custom statement | "Edit", `input[name="text"]`, "Save", "Cancel"; no "Edit" on a built-in | yes |
| 27 | Archive | "Archive" per active row | yes |
| 28 | Archived list, restore | "Archived (n)", "Restore" | yes |
| 29 | Read-only list for a member | same card with `canManage` false: no handle, no form, no Archive or Restore | yes |
| 30–31 | Errors of the list (3 to 10 active statements, order) | the manager's alert above the list, cleared by the next success | yes |

### Places left

None in this card.

### Differences with the mockup

| Difference | Covered by |
|---|---|
| The card is the manager (handles, "Archive", the add form, "Archived (n)"), not the compact list with a "Manage" link | to report: brief 04 §4, parity rows 24–28; there is no other page to manage the statements |
| Title "Health check statements", not "Health check" | to report: browser contract (P08b-01a, 01b) and `HealthCheck/README.md` |
| No sentence "6 statements asked at the end of each retro, scored 1–5" | F: the count varies, the phase comes first and the scale is 1 to 10 (as D-44) |
| The note "Changes apply…" is above the list, the "Built-in" badge is outlined, the statement is on its own line under the label | `HealthCheck/README.md` (the component's anatomy) |

## Task 4.3 — Mood and ROTI trend card

`TeamMoodCard` (`components/teams/team-mood-card.tsx`) is the first card of `#mood`, above the health check statements. It draws `MoodTrendChart` (`period="retro"`, heading of level 2) from the deferred prop `moodTrend` through `lib/teams/mood-adapter.ts`. The tabs "Mood" / "ROTI" sit in the card header, before the period tabs (new `controls` slot of the chart).

### Parity

No row of brief 04: the card is new (owner answer 4-D3, spec B23, criterion 20).

| Element | Control | Done |
|---|---|---|
| Mood of the last retros | tab "Mood": one point per retro with a health check score, on 0 to 10, "x/10" | yes |
| ROTI of the last retros | tab "ROTI": one point per retro with ROTI votes, on the chart's ROTI scale (1 to 5, "okay" threshold) | yes |
| Change | badge ":delta since the previous retro" (last point against the one before), absent under two points | yes |
| Open a retro | each point and each table row links to the retro | yes |
| Table view | "View as table" of the chart, same values and voters | yes |
| Loading | pulsing skeleton card (`data-slot="team-mood-loading"`, status "Loading chart") until the prop arrives | yes |
| No data | "No health check results yet." / "No ROTI results yet." | yes |

The card opens on "Mood", or on "ROTI" when no retro of the trend has a health check score. During a later visit to the same page (a member added, a statement saved) the deferred prop is fetched again: the last trend stays on screen, no skeleton.

### Places left

None in this card.

### Differences with the mockup (ScreenDashboard, "Tendance du moral")

| Difference | Covered by |
|---|---|
| Two tabs "Mood" / "ROTI"; the mockup draws the ROTI only | owner answer 4-D3 and third round, point 10 ("Health-check score + ROTI"); plan Task 4.3 |
| The chart is `MoodTrendChart`: KPI and its retro in the header, period tabs, legend, "View as table", ROTI levels as coloured dots, "okay" threshold; no fill under the line, no value bubble on the last point | `MoodTrendChart/README.md` (anatomy; "avoid gradients under the line, labelling each point") |
| Subtitle "Last 8 retros · Voters per retro: n", not "Average end-of-retro ROTI, out of 5" | `MoodTrendChart` (its subtitle); the metric is named in the legend and the table |
| Badge "since the previous retro", not "since S35" | plan Task 4.3 (P18e-04-09), spec B23: there is no sprint |
| The x axis shows retro titles and leaves out those that would overlap (one label in the 22.5rem column) | `MoodTrendChart` (label collision rule); there is no sprint number (D-18, TM-1) |
| The mood axis goes from 0 to 10 (answers go from 1 to 10) | to report: whole-number ticks, as the health trend of the chart's bench |
| The card is in the side column, above the health check, not in the main column beside the open actions | brief 04 §1 (the page follows ScreenTeam; `#mood` is the aside); spec §6.3 |
| Under three points: dots without a line and "Not enough data for a trend yet. It appears from 3 retros." | `MoodTrendChart/README.md` (state "little data") |


## Integration of wave 2b

Merged at `91251891`, after the lane's fix pass. Captures opened after the merge: `team-page` light 1440 EN and dark 390 FR, compared with a rendering of `ScreenTeam` and `ScreenDashboard` (`preview.html` with `_preview-bundle.css`, in `/tmp` only; structure and content, not colours or spacing). The eight bench captures (`team-*`) were not opened.

No small clear difference was found beyond those the lane listed. Every "to report" line above now has a row in the plan's Deviations table:

| Difference | Row |
|---|---|
| "Integrations" link instead of the gear; "Join" for every open phase; badge tones | D-73 |
| "Open the game"; points twice on a game row; "Ended games" group | D-74 |
| Two columns from 80rem; whiteboard trash, member controls, "Team settings" card | D-75 |
| The health check card is the manager, titled "Health check statements", without the count sentence | D-76 |
| Mood card: two tabs, chart anatomy, side column, 0 to 10 axis, one x label, no `<Deferred>` | D-77 |

Fix later (defects, not deviations):

- A member row reads "Supprimer" in French while its dialog says "Retirer": the key "Remove" is shared with other screens, so a new key is the owner's wording decision.
- If the deferred fetch of `moodTrend` fails, the skeleton stays ("Loading chart"), with no message.
- The sidebar entry "Team settings" points to the integrations page, which answers 404 while no provider is configured (`use-sidebar-model.ts`, outside this lane; `P12a-01c` asserts the link only inside `main`). For the settings lane.
- At 390 the full-page capture shows the fixed tab bar across the page: an artefact of the capture.

## RW-T1 — Team header gear, "Join" / "Resume", "Retirer" (second rework run)

Built:

- Header: an outline icon button (a link) named "Team settings" after "Games", as the mockup; the labelled "Integrations" link is gone. It leads where the sidebar entry leads: the integrations page for who manages them while a provider is configured, the settings card of the page (`#settings`) for a manager otherwise. A member who can change nothing of the team has no gear.
- Retro cards: `retros[].viewerHasJoined` (one `exists` aggregate on the participants of the viewer, no query per retro); "Resume" on an open retro the viewer has joined, "Join" otherwise, "Summary" once closed.
- Member removal: key "Remove from team" on the row and in the dialog — "Retirer" in French; "Remove" stays "Supprimer" on the other screens. The English label becomes "Remove from team" (key = English text); the accessible name of the row button stays "Remove :name".

Differences with the mockup that remain:

| Difference | Row |
|---|---|
| Phase tones: every open phase other than Voting is info with a dot; no gear for a plain member; "New session" after the gear | D-73 (reworded) |

Tests written or changed, not run (owner's rule): `TeamRetroCardsTest` (two tests added), `team-header.test.tsx`, `team-page.test.tsx`, `team-retros-section.test.tsx`, `team-members-card.test.tsx`; browser `[P12a-01a]` (clicks the gear), `[P18e-04-03]`, `[P18e-04-03b]` (new), `[P18e-04-05]`, `[P18e-04-06]`. Captures not regenerated.

The "Fix later" line above about "Supprimer" on the member row is done by this task.

## RW-T2 — Health check card compact, a management page, ROTI curve in the main column (second rework run)

Built:

- Side column: `TeamHealthCard` is the mockup's compact list (`skrum/health-check-summary.tsx`): title "Health check", link at the end of the heading row, the sentence ":count statements asked at the end of each retro, scored 1–10." with the number of active statements, one row per active statement (short label, "Built-in" or "Custom" badge, statement), the note "Changes apply to retros that have not collected answers yet." in its muted box. No control on the team page.
- Page `teams/health-check` (`GET /w/{workspace}/teams/{team}/health-check`, `teams.healthCheck.show`, `TeamHealthChecksController@show`): `AppLayout` (sidebar entry "Mood & ROTI" in use, breadcrumb workspace › Teams › team › Health check), the full manager (`TeamHealthManager`, the former `TeamHealthCard`, unchanged: reorder, add, reword, archive, restore, "Archived (n)") and the Mood trend (health score on 0 to 10, period tabs, legend, "View as table", links to the retros). Authorisation as on the team page before: `view` on the team opens the page, `update` on the team (`canManageHealthStatements`) gives the controls; a member reads the same list without them. The five write routes are unchanged.
- Main column: `TeamRotiCard` → `skrum/roti-trend-card.tsx`, the ScreenDashboard card: "Mood trend", "Average ROTI at the end of the retro, out of 5", badge "+0.9 since :first" (change from the first to the last point), grid 1 to 5, filled curve, hollow dots (the last one larger), dark bubble "4.1 / 5" on the last point. No tabs, no legend, no table. It sits under the three session sections, before the place left for the activity feed, and carries `id="mood"` (the sidebar entry lands on it). The "Mood" / "ROTI" tabs are gone; `preferredMetric` and `moodScale` left `lib/teams/mood-adapter.ts` with them.
- Deferred prop: both pages read `moodTrend` through `<Deferred>` (`components/teams/trend-states.tsx`, `DeferredTrend`). The prop is sent with `rescue: true`: a trend the server fails to build is reported and gives the page its error state ("The trend could not be loaded." and "Retry", which reloads `moodTrend` alone) instead of an endless skeleton. The last trend received stays on screen while a later visit fetches it again, as before.

Parity (rows 24–29 of the brief): every control of the statements is on the health check page; row 29 (read-only list for a member) holds on both pages.

Differences with the mockup that remain:

| Difference | Row |
|---|---|
| Health card: "scored 1–10" and the real count (owner answer); a "Custom" badge for a team's own statement; the link reads "Details" for a member who cannot manage (the page is read-only for them); French title "Bilan de santé" (the product's translation; the mockup keeps "Health check" in French) | D-76 (reworded) |
| ROTI card: the x axis shows the day the retro closed, and the badge reads "since :day" (no sprint number); labels are thinned out when they would collide; the card is under the session sections of the team page, the mockup shows it in the right column of ScreenDashboard beside "Open actions" (owner answer: main column) | D-77 (reworded) |
| The health check page has no mockup: built from the manager and the chart, two columns from 80rem | new row |

Review round (fixes and points left to the owner):

- Authorisation of the health check page: it opens on `view`, not on `update` as the plan text reads; requiring `update` would take the read-only list and the Mood trend away from plain members. Recorded in D-76, to confirm by the owner.
- ROTI card: the old ROTI tab had "View as table", a link per retro and the number of voters; the card keeps none of them (mockup strict, recorded in D-77). A visually hidden list beside the curve gives "retro · value / 5" for every point.
- Sidebar: the health check page marks "Mood & ROTI" as the entry in use, while that entry leads to `#mood` of the team page, now the ROTI card. The Mood trend chart is reached only through "Manage" / "Details" of the health check card. Accepted as built; a link from the ROTI card to the health check page is the alternative.
- "Team settings": the gear and the sidebar entry now read one helper (`lib/teams/settings-href.ts`); a Vitest case pins the two to the same address.
- Health check card: one active statement reads "1 statement asked…" (singular key in the four languages).
- "Remove from team": the key written to get "Retirer" in French also changed the English label of the row button and of the dialog confirm from "Remove" to "Remove from team". Left as built; the owner chooses between the longer English label and an `en` value of "Remove".
- A rescued deferred prop is not sent as null: it stays absent and is listed in `rescuedProps`. The feature test now asserts `missing('moodTrend')` after the reload.

Tests written or changed, not run (owner's rule): feature `TeamHealthCheckPageTest` (new, 7 cases with the dataset); Vitest `roti-trend-card.test.tsx`, `health-check-summary.test.tsx`, `team-health-card.test.tsx`, `team-roti-card.test.tsx`, `trend-states.test.tsx`, `team-health-check-page.test.tsx` (new), `team-health-manager.test.tsx` (the former `team-health-card.test.tsx`, renamed with its component, cases unchanged), `team-mood-card.test.tsx`, `team-page.test.tsx`, `mood-adapter.test.ts` (rewritten for the new elements); browser `[P08b-01a]`, `[P08b-01b]` (start on the team card, follow its link), `[P08b-07]` (opens the health check page), `[P18e-04-09]` (ROTI on the team page, mood on the health check page), `[P18e-04-02]`, `[P18e-04-02b]` (new selectors and bench states). Captures not regenerated.

The "Fix later" line above about the failed deferred fetch is done by this task for a failure on the server; a request that never gets an answer (network) still leaves the skeleton.
