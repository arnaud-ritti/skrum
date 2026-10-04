# Roadmap plans 20 to 27 and 29: report

Branch `roadmap` (integration worktree `.claude/worktrees/rmInt`), cut from `main` at `0c294632`. Nine plans were
built and merged into it: 20, 21, 26, 29 and 27 (wave A), then 22, 23, 24 and 25 (wave B), followed by the
four-engine matrix. `main` is unchanged and nothing was pushed. The branch adds 30 migrations.

Every plan has its own spec and plan under `docs/superpowers/specs` and `docs/superpowers/plans`. The detailed
reports are in `docs/superpowers/research/plan-NN-report.md`. Plan 21 has no separate report; its rulings are in
its plan's status line and in rows P21-12 to P21-15.

Mandate: the owner said "Oui vas y" on 2026-10-03 to build these plans autonomously, with rulings logged. The
mandate did not cover pushing.

## 1. What was built (user-visible)

| Plan | What a user now sees |
|---|---|
| 20 Whiteboard toolbars | The whiteboard has its own chrome on top of Excalidraw: a ten-tool bar with key letters, a sticky tool (N), Shape and Connector sub-bars, "More tools", undo/redo, a zoom bar (10 % to 3000 %, Fit), a minimap from `lg` whose toggle is remembered, a selection bar (colours, group, align, distribute, lock for the facilitator, delete, "Styles"), the Excalidraw menu entries moved into the board menu (with a "Canvas background" sub-menu), a compact phone bar, and the single-key preference |
| 21 Retro facilitation | "Who is writing" (a server-relayed count with no names on anonymous retros), pause and resume of the retro timer, max votes per card, "I have finished voting" (a new vote takes it back), a topic timer with time per topic, "Mark as discussed", shared topic notes (one writer at a time, stale saves refused, included in the recap mail and the AI summary), action items linked to their topic, ROTI reveal and nudge, and an export of the retro's action items to the tracker in one dialog |
| 22 Sessions page | A Sessions page per team (Live / Upcoming / Finished, paged by 20), creation options (per-phase timer offered to the facilitator, per-task poker timer, change of vote after reveal, a "Write estimates" field), tickets imported at game creation from any connected tracker, and ticket type, labels and an "Acceptance criteria" section on the poker story card |
| 23 Team and workspace data | Team roles (owner, facilitator, member, observer) with read-only observers and "You are observing", "Take control" of open sessions, explicit sprints with "Start the next sprint", default facilitators as a suggestion with rotation, a default retro template, personal / team / workspace templates, team activity, recent sessions, open actions, whiteboard thumbnails, team and workspace descriptions (plus workspace rename), team settings in four tabs, and "Online" in the members table through a per-workspace presence channel |
| 24 Action items | An "In progress" status both ways (with a start status per Jira project / Linear team), multi-value filters, a bulk bar (status, assignee, due date, delete, "Sync to :tracker" one by one in the browser) with "Select all n matching" (capped at 500), selection on phones by long press or a "Select" button, CSV export of the whole filter, text and ticket-key search from the topbar, a "By sprint" grouping (the default), and "Actions · n overdue" in the sidebar |
| 25 Invitations and onboarding | Team invitations (1 to 20 addresses, a role and a message) sent by owners, managers and facilitators; decline; a team invite link (7-day expiry, no use limit); a four-step onboarding (workspace, team, invite, first ritual) with "Skip for now"; team slugs `/t/<slug>`; a "session in progress, join it" banner after joining; an instance default workspace for new SSO accounts |
| 26 Account and guests | Presence colour (12 colours); profile photo cropped in the browser, behind an admin "Profile photos" switch that is off by default; "Reduce animations"; a live breach check while typing a password; active sessions (browser, IP) when sessions are stored in the database; linked SSO accounts; "Set a password" for SSO accounts; guests see the colours already taken; join codes `XXX-XXXX` on `/join` and from the login page |
| 27 Games | A settings card per room, turns, numbered rounds, word themes, the whole-word hangman guess (+5 on the current scale), auto hints, GIF captions with a vote budget, hidden authors and a podium, four new games (Two truths, Mood weather, Guess who?, Quick question), duration and player counts on the game cards, Draw & Guess finders, "New word" and "Redo", and Decoded's list of upcoming puzzles |
| 29 Administration and errors | Admin sections: General (sign-up mode and domains, update check, off by default), Users (list, search, deactivate/reactivate), SSO, SMTP and integration apps editable in the admin (encrypted, falling back to the environment), MCP keys, a 365-day audit log, and an AGPL-3.0 licence card; a 403 page with a team access request; a 503 maintenance page with "Back at" and a message; a public `/status` page; a version line for signed-in users |

## 2. Rulings taken under the mandate (the owner may overturn any of them)

Carried from the spec revision passes (ledger):

- P20: the `WhiteboardHarness` smoke test was run once. It is not a walkthrough.
- P21: Task 23 kept its number; `writing_until` is stored as short-lived data.
- P22: the acceptance-criteria heading is matched in English only ("Critères d'acceptation" splits nothing).
- P23: the "Take control" label is kept.
- P24: Cmd-K focuses the search on the action items page; an item's sprint is the one of its creation day.
- P25: a default-workspace newcomer joins as `member`; this applies to SSO-created accounts only; rule D-1.
- P26: "Profile photos" is off by default.
- P27: points use the current scale: 5 points, plus 2 per player fooled, and 5 per finder for the drawer.
- P29: the licence is AGPL-3.0-only; the eye button reveals typed text only; the e-mail fallback switch is locked on;
  the passkey plus SSO combination is accepted (see section 4).
- The per-plan notices were sent grouped at the end of each wave, because the workflow cannot notify in the middle
  of a run.

Taken while building:

- **Plan 20**: the minimap is placed above the zoom bar (P20-11). Three files were added that the plan did not list
  (`board-chrome`, `use-canvas-tools`, `use-canvas-key-guard`). Clear canvas and the background stay out of the menu
  in view mode. On a phone, "Styles" opens the library's panel.
- **Plan 21**: P21-12 (the topic timer row with pause, +2 min and a duration menu), P21-13 ("Mark as discussed"
  beside the votes), P21-14 ("Pause" first in the facilitator bar), P21-15 (the compact stepper shortens the phase
  name at 1440).
- **Plan 22**: P22-16 to P22-20. These are: no page search, the `layers` icon for retros, existing French wordings
  kept, the import tab keeps the in-game browse form, and the help text of "Timer per phase". A malformed cursor
  restarts at page 1. The migrations are dated `2026_10_28`.
- **Plan 23**: "global" presence (P23-07) was read as per workspace, not instance-wide. German uses "Moderator" for
  the facilitator and "Aktionspunkt". Access requests go to workspace owners and admins and to team owners, not to
  facilitators. Every non-GET route of the five session scopes is refused to observers, previews and suggestions
  included. A workspace admin with an observer row keeps full rights. Activity lines are whole sentences. P23-17
  (Members & rituals layout), P23-18 (open actions shown as cards) and P23-19 (ellipsis on the whiteboard line).
- **Plan 24**: P24-13: "Sync to :tracker" is a secondary button with a `send` icon instead of the Jira mark. Bulk
  routes and the export share one limit of 20 requests a minute. A stop out of an in-progress Jira status uses a
  to-do transition only. The "Finished sprint" badge has its own key, with gendered fr/es forms.
- **Plan 25**: a facilitator can invite with any role except owner. `/t/<slug>` looks in the current workspace
  first. A leaked link opens registration in `invite` mode for 7 days; this is kept, and the answer is the
  joined count and "Create a new link". The banner shows the most recently active Live session. A newcomer who then
  joins a team ends the onboarding. Step 3 never re-creates a link that was turned off. P25-18 to P25-23 (wordings
  and layout of the invite steps and rows).
- **Plan 26**: rule S-1 applies to the account settings only; the admin area and account deletion still ask for
  the password. The join throttle is inline (`throttle:10,1,joinCodes`). The S-1 consequences go beyond the three
  the owner was told (section 4).
- **Plan 27**: Guess who? answers have their own rate-limit bucket. Rounds are called "manche" in French. P27-15 to
  P27-19 ("Statements ready", "Tour de :name" without elision, existing keys "Paramètres"/"Deviner", the GIF step
  after the round ends, a tie on the podium names every winner).
- **Plan 29**: P29-14 to P29-23 (the SSO card badge instead of a switch, the connection test without claims, one
  Save per SSO card, the SMTP mailer choice, nine integration providers with letter tiles, the MCP keys columns,
  General / Users / Audit built from the spec, the 403 message as a textarea, the 503 overline). Revoking the last
  *active* admin is refused. A test e-mail sent while mail goes to the log counts as failed.
- **Every plan**: the controller flattened the plan lanes, so all tasks ran in order on one branch. Rector was applied
  only to the files each plan created; `composer rector:check` is still red on older files, as it was on `main`.
- **Matrix**: test fixes only, no app code changed. The MySQL audit test now compares JSON ignoring key order, and
  `bin/test-db` empties the SQLite file after its migration preflight.

## 3. Deviations from the mockups still waiting for the owner

Pre-build rows were answered by the owner on 2026-10-03. The rows found while building have not been read by the
owner yet:

- P20-11, P20-12
- P21-12 to P21-15
- P22-16 to P22-20
- P23-17 to P23-19
- P24-13
- P25-18 to P25-23
- P27-15 to P27-19
- P29-14 to P29-23

Each row is described in its plan's **Pre-build deviations** table and in its report.

## 4. What was NOT verified

- **Browser walkthroughs**: not read, written or run in any plan (owner's rule). Several are known to be stale and
  expected to fail: the whiteboard walkthroughs (17a, 17b, 17c, 18e, possibly 17d), the games walkthroughs (13a to 13d,
  18e), and the action-item walkthroughs (the status button now cycles To do → In progress → Done).
- **No human visual review**: captures were taken in one configuration only (light, 1440, French) and compared by
  agents. Dark mode, 390 px and English captures were not retaken. Several captures are missing or out of date:
  - the three plan 25 screens after its Tasks 26 to 29 (the default-workspace step 2, the live-session banner, and
    the admin default-workspace card), because the browser harness run was refused;
  - the plan 27 screens added by Tasks 28 to 31;
  - the plan 29 `admin-sso-stored-secret` capture, which lacks "Secret changed".
- **Not checked in a real browser or against real services**: photo cropping to JPEG, OAuth callbacks for a
  signed-in user, the Docker image's version, whether Reverb is reachable for `/status`, the public GitHub release
  for the update check, and whether every Linear workspace uses `started` for its "In Progress" columns.
- **Accepted risks** (owner's decisions, kept as built):
  - *SSO accounts without a password need no confirmation in security (rule S-1, plan 26).* Anyone holding a
    signed-in session of such an account can turn 2FA off, read the recovery codes, create API tokens, register
    a passkey, link their own SSO identity, sign out the other devices and set a password. The 60-second backfill
    heuristic may classify some accounts wrongly. Combined with plan 29, a passkey registered this way satisfies
    the fresh confirmation the admin needs before changing SSO or SMTP settings.
  - *SSO, SMTP and integration-app settings are editable in the admin (plan 29).* An admin session can redirect
    sign-in or mail. The safeguards are a fresh confirmation (300 s), an audit event naming the changed fields, an
    alert mail to every admin for SSO and SMTP changes, and a refusal of any change that would lock everyone out.
  - *Licence change to AGPL-3.0-only (plan 29).* `composer.json` and `LICENSE` now declare AGPL-3.0-only instead
    of MIT. This is the owner's legal decision.
  - *Four engines once, at the end*: an engine-specific regression was found late. One was found (MySQL key order,
    a test defect).
- **MySQL whole suite after the fix**: not re-run as a whole. The failing file then passed on all four engines.
  PostgreSQL was re-run as a whole after both fixes.
- **sqlite-file concurrency**: plan 19's report records a pass after the preflight was added, which the matrix
  could not explain.

## 5. Final test counts

Whole suite (Unit, Feature, Upgrade, Arch), `--parallel --processes=4`, on the final `roadmap`:

| Engine | Whole suite | Concurrency | `tests/Feature/Database` |
|---|---|---|---|
| PostgreSQL | 7501 passed, 2 skipped, 0 failed (re-run after the fixes: same) | 62 passed, 1 skipped | 194 passed, 1 skipped |
| SQLite (memory) | 7495 passed, 8 skipped, 0 failed | — | 191 passed, 4 skipped |
| SQLite file | — | 62 passed, 1 skipped (after `ca255e4b`; first run: 63 failed, "database is locked") | 191 passed, 4 skipped |
| MariaDB | 7502 passed, 1 skipped, 0 failed | 62 passed, 1 skipped | 195 passed |
| MySQL | 7501 passed, 1 skipped, 1 failed; the failing file passes after `c885d34b` | 62 passed, 1 skipped | 195 passed |

Front end (after the last merge): Vitest 564 files, 5755 tests passed; `npm run types:check` and `npm run check`
clean (1445 files); `vp build` OK; Wayfinder unchanged. PHPStan 0 errors; Pint passed.

## 6. Owner's next steps

1. Review: read sections 2 to 4, the open deviation rows, and the captures in `tests/visual/__screenshots__`. Walk
   through the new screens by hand. Overturn any ruling you disagree with.
2. When you ask, fast-forward `main` to `roadmap` (`git checkout main && git merge --ff-only roadmap`). This was
   not done.
3. Push when you choose. Nothing has been pushed.
4. Run `php artisan migrate` on the dev database yourself: 30 new migrations, including the team role and slug
   backfills. The dev database was not touched.
5. Later: rewrite the stale walkthroughs, retake the missing captures, run the MySQL whole suite once more, and
   decide what to do about the red `rector:check` baseline.
