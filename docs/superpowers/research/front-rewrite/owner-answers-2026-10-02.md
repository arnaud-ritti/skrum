# Owner answers — 2026-10-02

Answers given by the product owner to the decisions of plans 18e, 18f and 18g. Ids are those of `18e-owner-decisions.md`, of the "Owner decisions" section of plan 18f, and of the open questions of plan 18g. An answer marked **≠ default** differs from what the plans assume today: the spec amendment and the plans must be revised before execution. Decisions not listed here keep the plan's default.

## Blocking

| Id | Answer |
|---|---|
| BLOCK-1 | Proposal accepted: `actions` behaves like `discussing`; `roti` is a read-only board, action items still editable, cursors off; surveys unchanged. |
| BLOCK-2 | Boolean column on `retros` set by the migration, plus `roti.canVote`. |
| BLOCK-3 (12-D1) | **≠ default**: redirect. `/` redirects (login, or dashboard when signed in); no landing page. Group 12 becomes a redirect and its test. |
| BLOCK-4 / X1 | Approved: pages render their own layout; `components/session/`. |

## Cross-group

| Id | Answer |
|---|---|
| X3 | **≠ default**: banner (full width), with a sentence adapted per session type (the "cards kept locally" sentence only where true). |
| X4 | Mockup: `0:00` + alarm icon; "Time's up!" as accessible name; five assertions change. |
| X5 | **≠ default**: one list 1/3/5/10 on every screen. |

## Group 1 — session creation

| Id | Answer |
|---|---|
| 1-D1 | "Create & open". |
| 1-D2 | **≠ default**: one "New session" trigger; type chosen in the dialog. |
| 1-D3 | **≠ default**: five shortcut cards + "Browse". The five are the team's most used templates, computed on the server from the team's past retros, with a fixed list as fallback (new back-end prop). |
| 1-D4 | **≠ default**: five types (Poll and Icebreaker added; new props on `teams/show`). |

## Group 2 — retro

| Id | Answer |
|---|---|
| 2-D6 | **≠ default**: add the duration (new start-time column on the retro; shown for new retros only). Participation = joined / team members. |
| 2-D7 | Backlog (export PDF / CSV / Markdown). |
| 2-D8 | **≠ default**: build "+2 min" (new back-end action extending a running timer). |
| 2-D9 | **≠ default**: topics list only (mockup), BUT no feature lost: the list is sorted by votes and each topic keeps its controls (comments, reactions, highlight). |
| 2-D11 / 7-D2 | **≠ default for 7-D2**: guest-link controls live in the Share dialog only (retro and whiteboard), with confirmation on "Create a new link"; tests follow. |
| 2-D13 | **≠ default**: confetti built for the session-end screen (CSS, no dependency, off with reduced motion). |
| 2-D15 | Popover "Apply". |

## Group 3 — poker

| Id | Answer |
|---|---|
| 3-D3 | **≠ default**: saved decks as the mockup's full page (new route, default deck, duplicate, usage count; back end to specify). |
| 3-D5 | Spectator badge dropped. |
| 3-D6 | Backlog (CSV export, history filters). |
| 3-D7 | **≠ default**: "Reveal cards"; tests follow. |
| 3-D8 | **≠ default**: Re-vote, Estimate, Save estimate, Next task in the dock (mockup). |

## Group 4 — team page

| Id | Answer |
|---|---|
| 4-D1 | **≠ default**: `/dashboard` redirects to the current team page. |
| 4-D3 | **≠ default**: team mood and ROTI trend (new back-end prop). |
| 4-D4 | **≠ default**: add `avatarUrl` to `members` and `availableMembers`. |
| 4-D5 | **≠ default**: confirmation dialog when removing a member. |
| 4-D2 | Moot: one "New session" trigger (1-D2). |

## Group 5 — action items

| Id | Answer |
|---|---|
| 5-D1 | Side sheet. |
| 5-D3 | **≠ default**: delete with confirmation. |
| 5-D4 / 5-D5 | **≠ default**: build "Group by" (client side) and the header counters per status. |
| 5-D6 | **≠ default**: "New action item" in the topbar. |

## Group 6 — games

| Id | Answer |
|---|---|
| 6-D1 | Cards. |
| 6-D2 | **≠ default**: eight theme colours for drawing ink (server palette extended; pixel tests redone; old drawings keep their colours). |
| 6-D3 | **≠ default**: ReactionBar in standalone game rooms (live reactions added). |
| 6-D5 | "Winner" mark. |
| 6-D6 | **≠ default**: room status and avatars in the rooms list (new props). |
| 6-D7 | **≠ default**: full Share dialog. |
| 6-D8 | Keyboard by locale. |
| 6-D9 | Prefilled nickname. |

## Group 7 — whiteboard

| Id | Answer |
|---|---|
| 7-D1 | **≠ default**: eight-colour palette AND the built-in template JSON regenerated with the new colours. |
| 7-D3 | **≠ default**: our colour bar everywhere; Excalidraw's native quick picks hidden. |
| 7-D4 | Palette border. |
| 7-D5 | Timer inside the facilitation bar. |

## Group 8 — surveys

| Id | Answer |
|---|---|
| 8-D2 | Settings popover only. |

## Group 9 — workspace

| Id | Answer |
|---|---|
| 9-D1 | **≠ default**: build "Use" (opens session creation with the template) and the Poker / Whiteboard tabs. |
| 9-D4 | Typed-name confirmation for both Delete workspace and Leave. |

## Group 10 — settings

| Id | Answer |
|---|---|
| 10-D1 | Keep "Delete account". |
| 10-D2 | **≠ default**: inline token creation form (mockup); four tests change. |
| 10-D3 | Inline 2FA steps, no Print. |
| 10-D5 | Shared horizontal list on mobile. |
| 10-D6 | Explicit Save. |

## Group 11 — access

| Id | Answer |
|---|---|
| 11-D2 | **≠ default**: SSO buttons on the invitation page (`ssoProviders` prop; accepting an invitation through SSO is authentication work — handle with 18f's security rules). |
| 11-D4 | Brand logo only on a rebranded instance. |

## Plan 18f

| Topic | Answer |
|---|---|
| Magic link audience | Every verified account; no link to an unverified account (plan default). |
| Forced SSO | **≠ default**: add the instance setting "SSO required" (hides password and magic link). |
| E-mail code as second factor | Accepted for everyone, instance admins included. |
| Recovery codes for e-mail-code-only users | None. |
| Search | Titles + card text, current workspace, `ILIKE`. |
| Mail templates | Plain Blade. |
| Recap unsubscribe | **≠ default**: yes (new user preference, signed link). Spec B14 to amend. |
| Shortcuts without handler (G, F, C, ⇧R, ⌘→) and "disable single-letter shortcuts" | **≠ default**: build them. |

## Plan 18g

| Topic | Answer |
|---|---|
| Dead-code evidence | `knip` through a one-off `npx` (not installed). |
| `@testing-library/user-event` | Declare it as a dev dependency. |
| Capture languages | FR and EN. |
| Manual accessibility checklist | Run by an agent with a real browser; the owner reads the report. |

## Second round (same day)

Decisions the first round had left on their default. **≠ default** as above.

| Id | Answer |
|---|---|
| X6 | Sidebar footer landmark renamed "Team and administration". |
| 1-D5 | Both: `Deck.source: 'custom'` badge "This game only"; `@theme` token for the always-white whiteboard preview paper. |
| 1-D7 | Mockup labels: "Create a deck", "Edit :name", "Delete :name" (on the full page of 3-D3). |
| 1-D8 | **≠ default**: whiteboard templates manager confirms deletion in a dialog. |
| 2-D12 | Keep "Add a card…" (label override; no test change). |
| 2-D14 | "Send the recap by e-mail" as primary button. |
| 3-D9 | "Watch only" stays the label when on. |
| 3-D10 | **≠ default**: spectator control on the join page is a switch. |
| 4-D6 | **≠ default**: "Saved decks" and "Whiteboard templates" live in a "…" actions menu of their section, not ghost buttons. |
| 5-D2 | Jira export icon in the row and in the sheet footer. |
| 5-D7 | **≠ default**: "(Guest)" with a capital; assertions change. |
| 7-D6 | Cursor colours from the presence tokens. |
| 7-D7 | **≠ default**: build the phone read / edit mode (read by default on a phone, "Modifier" button to edit). |
| 8-D3 | No "Anonymous" badge. |
| 8-D4 | "n · p%". |
| 9-D2 | **≠ default**: workspace templates page includes the built-in templates (full picker), with "Use" and the Poker / Whiteboard tabs (9-D1). |
| 9-D5 | **≠ default**: revoking an invitation asks for confirmation. |
| 9-D6 | Members page stays manager-only. |
| 9-D7 | **≠ default**: the component's sentence "Retros already created from it are not affected."; translations and test redone. |
| 10-D4 | Team settings sub-navigation "Team" + "Integrations". |
| 11-D3 | **≠ default**: request id on the 500 page (generated per request, written to the log, shown on the page). |
| 11-D5 | "Remember me". |
| 11-D7 / 11-D10 | **≠ default**: redesign 503 (static Blade, no database), 419 and 429 as design-system error pages. |
| 18f lifetimes | Magic link 15 min, e-mail code 10 min; 60 s cooldown, 5 per hour per address. |
| 18f cross-device | Allowed: the link signs in the device that opens it, after the confirmation page. |
| 18f remember | Normal session, no long-lived cookie. |
| 18f code mail context | Browser and time, no location. |
| 18g boundary | **≠ default**: old view components still imported after 18e are rewritten in 18g; none remains at the end. |

## Third round (same day) — open points, security, deviations

### Reading of rule 13 and ordering

- The rewrite (18e–18g) delivers every existing screen faithful to the mockup, built with whatever the server already holds; a mockup element with no data is omitted there and listed as a deviation.
- **Then** every such element becomes a feature with its own spec and plan (19, 20, …), in an order the owner sets. "Rewrite first, features after." The screens leave the element's place so it can be added without a new layout.

### Security

| Topic | Answer |
|---|---|
| `sso_required` and passkeys | Passkeys are refused too: only SSO signs in. |
| `sso_required` break-glass | Both: instance admins can always sign in with password (+ second factor); and when no SSO provider is enabled the setting is ignored for everyone, with an alert shown to instance admins. |
| Invitation through SSO | An SSO address the provider does not mark verified is refused, even with a matching invitation (today it creates a verified account). |
| Invitation in the bell | The notification links to the existing invitation page; no token-less accept route (drop S33's route). |

### Open points of spec §15

| Point | Answer |
|---|---|
| 1 Poll | A standalone survey entity, specified apart, after 18e (plan 19). Until then session creation offers four types (retro, poker, whiteboard, icebreaker); the Poll entry arrives with plan 19. |
| Health check | Becomes a default survey template (no dedicated retro phase), with plan 19. Plan 18e keeps the health-check phase as it is (deviation D-03 stands until then). |
| 2 Start of a retro | First activity (first card, health answer, timer start or phase change). |
| 3 / 4 Timer | "+2 min" on every timer (retro, poker, games, whiteboard); poker keeps "Custom…" beside 1/3/5/10. |
| 5 Default deck | As proposed, but usage counts start from now: no backfill. |
| 6 Poker tab of the templates page | Workspace-level decks (new: decks shared across the workspace), not a per-team list. |
| 7 Drawing ink | Eight theme colours plus black. |
| 8 Rooms list | Live (new team-level games channel). |
| 10 Mood | Health-check score + ROTI. |
| 12 Single-key shortcuts | "Accessibility" card on the Appearance page; also turns off `?`. |
| 16 Built-in templates | "Duplicate" beside "Use". |
| 9, 13, 14, 15, 17 | As written in the spec (17 superseded by the security answer above). |

### Deviations kept by decision

| Row | Answer |
|---|---|
| D-01 | "More emoji…" kept. |
| D-04 | "Next phase" to ROTI (not "Close the retro"). |
| D-21 toolbars | Whiteboard toolbars rebuilt to the mockup (vertical tool bar, selection bar, zoom, minimap) in a separate plan after 18e; 18e ships themed Excalidraw. |

### Features to specify after the rewrite (owner wants all of these built)

Retro: "is writing… / is moving…" indicators and Pause; max votes per card and "I have finished voting"; per-topic timer, shared notes, "discussed" flag, action items linked to a card; ROTI reveal and nudge; bulk export to Jira.
Sessions: Sessions index page and scheduling ("Schedule…", "starts in 5 min" notification); advanced creation options (max per card, timer per phase / per task, re-vote after reveal, Jira import, write estimates to Jira).
Team page: sprint and next retro, recent sessions table, aggregated open actions, activity feed, per-retro counts, member role, whiteboard thumbnails.
Onboarding: the four-step onboarding.
Action items: bulk selection bar, filters (priority, due date, source), status "In progress", export.
Games: settings card, turn order and rounds, GIF captions and podium, the four games the engine lacks.
Whiteboard: comments, "follow", sticky authors, convert to actions; rebuilt toolbars.
Poker: Jira ticket details in the room (type, labels, acceptance criteria, description).
Surveys: standalone survey, multi-question builder, scale and NPS questions, compare, CSV; health check as a default template.
Account: photo upload, active sessions, linked accounts, presence colours, "reduce animations", breach check.
Workspace and team: descriptions, template usage and visibility, remaining team-settings tabs.
Invitations: team invitations, inviter's message, "Decline", team invite link.
Admin and errors: remaining admin sections, version line, status page, access request on the 403 page, maintenance message.
Mentions and their notifications. Guest colour picker and short session code.

Not requested (stay backlog): "Team name" on register, terms and privacy pages, version in the footer; export PDF/CSV/Markdown of a retro; poker CSV export and history filters.

## Approval (same day)

The owner approved the amended spec and the three plans ("Go"), with the recommendations on the open items: spec §15 points 1–4 as written; 18f: invitation notification kept with its link (token stored encrypted in the notification), private user channel kept for live arrival, bell and palette data kept in 18f. Speed levers approved ("ok go"): parallel lanes in worktrees, back-end tasks first in parallel, per-task narrow tests, one review and one full browser run per group, non-blocking visual review, 18f back end in parallel with 18e.

## Fourth round (same day, after the merge of wave 2a) — deviations D-37 to D-63 and open decisions

"REWORK" = code changes; "stays" = deviation approved.

## Deviations decided

| Row | Answer |
|---|---|
| D-37, D-38, D-39 | REWORK. Poker deck choice in session creation: the mockup's four small tiles (values in mono) and a "New deck" button in the header of the Deck section; the Tasks block visible without scrolling at 1440. |
| D-62 | stays (GIFs animated, no still under reduced motion). Accepted accessibility deviation; proxy extension stays backlog. |
| D-47, D-48, D-69 (+ games header) | REWORK. Session header on every session screen: "team · type" line above the title (server sends the team name), user avatar at the end, visible "Synced" state when connected. Whiteboard: logo and editable breadcrumb "team › Whiteboards › name". On a phone only the title and the essentials remain. |
| D-57 | REWORK. Game room: each game follows its mockup layout (players on the left for Draw and GIF, one Scores list on the right, "In play" on the selected card). |
| D-58 | stays: the reaction bar keeps its own strip under the stage (must not cover the keyboard or the guess field). |
| D-61 | REWORK. Sprint in one GIF: picker open on the stage, draft then "Send my GIF". |
| D-54 | REWORK (under 18f security rules). Invitation, logged out: inline "Create a password" and "Create my account and join" on the card. The "Ask for a new invitation" button stays backlog. |
| D-67 | REWORK. Poker past rounds: open by default, names kept ("name: value"). |
| D-66 | REWORK. Poker on a phone: scrolling row of participants; first names on the seats (first word of the display name). |
| D-64 | REWORK. Poker result: everything in the oval and the dock (agreement, distribution, extremes join the dock); no panel under the table. |
| D-65 | REWORK. Poker dock after reveal: final-estimate cards and one button "Validate n pts · Next story". |
| D-68 | REWORK. Poker queue: "Votes: n" on every row (new back-end prop: votes per task) and the mockup's drop line while dragging. "pts" stays omitted (false on a T-shirt deck). |
| D-51 | REWORK. Guest join: suggested random nickname on every session type; button "Join the session" (walkthroughs follow). |
| D-55 (404 search) | Never: no "Search sessions ⌘K" on the 404 page. Other D-55 points stay. |
| D-52 | "Create your account" stays through the rewrite. Registration creating a workspace and a team (mockup: "Create your workspace", "Team name") is specified with the onboarding (plan 25): add to the feature roadmap. |
| D-44 | stays: server defaults (auto reveal off, anonymous guests off). |
| D-40, D-41, D-42, D-43, D-45, D-46, D-50, D-53, D-56, D-59, D-60, D-63 | not asked one by one: approved as proposed in the table (D-42 gets eight colours with R1; D-63 fixed with the header rework). |

## Other decisions

| Topic | Answer |
|---|---|
| Recovery codes | Keep "a used code is removed" (dc8e94b2); add a low-count alert and the regenerate button; amend spec B43 / 18f B13. |
| "Powered by Skrüm" hidden on a default install | Normal, stays. |
| Maintenance | An Inertia visit during maintenance forces a full reload so the real 503 page shows. REWORK (small). |
| GIF "Ready" bar | stays (online players only). |
| Whiteboard read mode | stays (decided when the board opens). |
| Branding | REWORK (small): a stored radius outside the segments shows its exact value; undo per staged image removal. |
| Expired invitation | The page shows the workspace name and the inviter (mockup), so the visitor knows whom to ask. Spec criterion 43 aligned. REWORK (small, back end + card). |
| French "Modifier" / "Lire" everywhere | not asked: kept. |

## Round 4b — the rows first approved in bulk, now answered one by one (these replace the bulk line above)

| Row | Answer |
|---|---|
| D-40 | stays: "Automatic" switch on votes per person and the icebreaker switch are kept. |
| D-41 | REWORK. "Automatic AI summary" (retro) and "Anonymous votes" (poker) leave the creation dialog and live in the session's settings (settable once the session exists; server defaults apply at creation). |
| D-42 | REWORK. Column colours as swatches alone, as the mockup: no visible name; the name in a tooltip and for screen readers. Eight colours with R1. |
| D-43 | stays as proposed (full picker in the dialog, read-only preview, catalogue category on a shortcut). |
| D-45, D-46 | stays as proposed (saved decks page). |
| D-50 | stays: whiteboard facilitation tools, board menu and reactions bar kept. |
| D-53 | stays: "Sign in with a passkey" kept. |
| D-56 | stays as proposed (rounds, "Open by link" / "Team only", "n rounds · n wins", streak badges). |
| D-59 | Whole-word guess (+50 pts): feature roadmap (games). REWORK now: on a phone the hangman keyboard is a docked panel. |
| D-60 | REWORK: on a phone the guesses of Draw & Guess are in a drawer. "Fill" kept; pencil tag colour stays. |
| D-55 | 403 "this page" stays. REWORK: the static 503 reloads by itself every 30 s (small inline script) and shows the mockup's sentence. 404 search: never. |
| French "Modifier" / "Lire" | agreed, everywhere. |
| D-63 | fixed with the session header rework. |

## Fifth round (same day, after integration 2b) — D-70 to D-77, roadmap changes, working rules

| Row | Answer |
|---|---|
| D-70 | REWORK. Poker room settings: a popover anchored to a header button (mockup), like the retro settings popover; tests follow. |
| D-71 | stays as proposed (import and source: search field + select, done check, tracker block). |
| D-72 | REWORK + back end: the ticket key under the task title and "across n games" in the summary (two props; the server holds both). Other points of the row stay. |
| D-73 | REWORK + back end: gear icon button "Team settings" in the team header; "Join" / "Resume" on an open retro ("Resume" when the viewer has already joined: new prop). Tests follow (P12a `click('Integrations')`). |
| D-74 | stays ("Open the game", points under the name, "Ended games"). |
| D-75 | stays (two columns from 80rem of viewport; existing controls kept). |
| D-76 | REWORK. Health check card: compact list with a "Manage" link (mockup); the sentence uses the real values (actual count, scale 1–10). "Manage" opens a page of its own with the full manager. |
| D-77 | REWORK. Trend on the team page: mockup strict — the ROTI curve alone, in the main column, filled, with the bubble on the last point. The Mood trend (health score) moves to the health-check management page. Fix the deferred-fetch failure state (use `<Deferred>` or an error state). |
| "Supprimer" / "Retirer" (member row) | "Retirer" everywhere: a new key for removing a member. |
| `links.decks` in the poker snapshot | Remove it: the front builds the link itself (Wayfinder). |
| Translations (es, de, part of fr) | Reviewed by an agent at the end of 18e: one pass per language (term consistency, lengths, register), with a report of doubtful cases. |

Second rework run (after the first one merges): RW-P3 (D-70, links.decks removal), RW-P4 (D-72), RW-T1 (D-73, "Retirer"), RW-T2 (D-76, D-77, health-check management page with the Mood trend), plus the deferred items of the first addendum (D-51 guest join after retro; recovery-code alert after settings).

## Roadmap change (same day)
Plan 30 (mentions and their notifications, feature MN-1) is removed from the feature roadmap by the owner: move it to the backlog (spec §10) and drop plan 30 from feature-roadmap.md. To apply in docs when the main tree is free.
Plan 28 (whiteboard collaboration: comments, "follow", sticky authors, convert to actions) is removed from the feature roadmap too: move to the backlog (spec §10). Places left for these elements in the whiteboard screen (task 7.x "Places left" lines) become plain backlog notes. Roadmap = plans 19–27 and 29.
Plan 22: scheduling is removed ("Schedule…", session start time, "starts in 5 min" notification): move to the backlog (spec §10). Plan 22 keeps the Sessions index page, the advanced creation options and the poker Jira ticket details. The four extra games (GM-4) stay in plan 27 (owner confirmed).

### Working rules decided the same day

- No test runs during the work (feature, Vitest, browser), per task or per merge: types, lint and build only; one full run at the end of each phase. Risk accepted by the owner. Exceptions kept by the controller unless the owner says otherwise: the 18f security tests, and the database-portability plan (its purpose is to prove behaviour per driver).
- Deviations between mockup and plan are put to the owner before a screen is built.
- New requirement: the application must run on SQLite, MariaDB/MySQL and any database Eloquent supports. Audit: docs/superpowers/research/database-portability-audit.md.

## Sixth round

| Subject | Decision |
|---|---|
| Language register | "Langue : tutoiement partout." Every user-facing text addresses the user informally in every language that has the distinction: French "tu", Spanish "tú" (mails included, which said "usted"), German "du"; English unchanged. It applies to screens, validation messages, notifications, mails (subjects and bodies), error pages, the static 503 page and the MCP and API messages. The decision overrides the wording of the mockups. A plural "vous" stays only where the text addresses several people at once (listed in translations-review.md). |
| Participation of a retro | "Invité compte dans les participants." In the session-end statistics a guest counts as a participant. Participation = everyone who joined (team members, guests, people outside the team) out of everyone expected (the members of the team plus the participants who are not members), so the ratio never exceeds 100%. It replaces the rule of the close of plan 18e (team members only). Spec B3 amended; `results.stats.participation` is `{participants, expected}`. |
