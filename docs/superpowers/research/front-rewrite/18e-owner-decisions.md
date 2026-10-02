# Plan 18e — decisions for the product owner

Each line: the question, the plan's default (what is built if nobody answers), the tasks that change if the answer is different, whether the question blocks work, and the owner's answer.

**Answered on 2026-10-02** (`owner-answers-2026-10-02.md`). The last column of every table carries the answer. "≠ default" marks an answer that differs from the default written here: the spec (B17–B45, §15) and the plan were revised for it, and the task ids in that column are those of the revised plan. A second round of answers came the same day and is marked as such. "Not answered" means the owner listed the decision in neither round.

**Standing rule of the owner, given after the answers** (spec §5 rule 13): the mockup must be faithfully respected. The answers of this file stand as written. Every other default, and every conflict ruling of the plan, follows the mockup; the plan's "Deviations from the mockup" table lists what cannot. The six decisions still unanswered are not mockup matters (file ownership, ids, a folder), or already follow the mockup. Nothing blocks any more.

**Third round (same day).** The reading of that rule is confirmed, with "rewrite first, features after": an element the server cannot feed is omitted, its place is left, and it becomes a feature of a later plan (`feature-roadmap.md`). Answers that change a row below: 1-D4 — four types in plan 18e (retro, poker, whiteboard, icebreaker); the Poll type arrives with the standalone survey of plan 19. 2-D8 — "+2 min" on every timer (retro, poker, games, whiteboard); poker keeps "Custom…". 3-D3 — usage counts start from now, no backfill. 6-D2 — eight theme colours plus black. 6-D6 — the rooms list is live (team-level games channel). 9-D1 — the Poker tab holds workspace-level decks. 11-D2 — an SSO address the provider does not mark verified is refused even with an invitation (plan 18f). The health-check phase stays through plan 18e and becomes a default survey template in plan 19.

Task ids are those of `2026-10-16-plan-18e-front-rewrite-screens.md`. Brief ids (D1, R3…) are those of `18e-briefs/<nn>-*.md`.

## Blocking

| Id | Question | Blocks | Where it is drafted | Answer (2026-10-02) |
|---|---|---|---|---|
| BLOCK-1 | What is allowed in the new retro phases `actions` and `roti` (highlight, action items, comments, reactions, group naming, suggestions, surveys, cursors)? The spec says "guards updated" and gives no rule. | R10, R11; the `SurveyPhases` constant of S1 | `18e-spec-amendment.md` A1 | **Answered.** Proposal accepted: `actions` behaves like `discussing`; `roti` is a read-only board, action items still editable, cursors off; surveys unchanged. Spec §9.1. |
| BLOCK-2 | How is a retro "completed before the change" recognised, so that it keeps ROTI voting? ROTI also leaves `discussing`: confirm. | R11 | amendment A2 | **Answered.** Boolean column on `retros` set by the migration, plus `roti.canVote`. Spec B2. |
| BLOCK-3 | Does a self-hosted instance show a marketing landing at all (12-D1)? | group 12 only (task 12.1) | below, group 12 | **Answered, ≠ recommendation.** (c) redirect: `/` goes to the login page, or to the dashboard when signed in; no landing page. Spec B32; group 12 is one redirect task. |
| BLOCK-4 | Approve amendment A4 to A9 (folder `components/session/`, pages render their own layout, timer durations per screen, backlog list, corrections). | Task 0.2 onwards (formally: spec first) | amendment A4–A9 | **Answered.** Approved: pages render their own layout; `components/session/`. A6 is reversed by X5 (one timer list). |

Everything else has a default and does not stop the plan. The four blocking questions are answered; the plan has no spec gate left.

## Cross-group

| Id | Question | Default | Tasks affected otherwise | Blocks | Answer (2026-10-02) |
|---|---|---|---|---|---|
| X1 | How does a page give its layout the active nav entry, breadcrumbs or session slots? | The page (or its shell) renders the layout and passes typed props, as 18d did for `about` and `admin/*`; `app.tsx` assigns no layout to rewritten pages. | 0.2 and every screen task (alternative: layouts stay assigned in `app.tsx`, pages call `setLayoutProps`; live pages would still render their own) | with BLOCK-4 | **Answered.** Approved (default). |
| X2 | Who rewrites the four guest-join pages and `retros/session-ended`? | Each join page with its session group (R2, 3.2, G2, 7.1) on one shared `GuestJoinPage` written in Task 0; `session-ended` in R2. | 0.7, R2, 3.2, G2, 7.1, group 11 | no | Not answered: the default stands (ownership of files, not a mockup matter). |
| X3 | "Reconnecting…" as a banner (three briefs) or a pill in the header (whiteboard brief)? | Pill in the header; the banner's sentence "Your cards are kept locally…" is false for poker and games. Expired session stays a banner with Reload. | 0.3 | no | **Answered, ≠ default.** Full-width banner, with a sentence per session type; the "cards kept locally" sentence only where true (nowhere today). Tasks 0.3, 0.14, R3, 3.1a, G3, 7.2. |
| X4 | When the timer ends, the new Timer shows `0:00` with an alarm icon and the name "Time's up!"; five tests read the text "Time's up!" inside `[role="timer"]`. | Follow the Timer mockup; the five assertions check the accessible name instead. The toast "Time's up!" is unchanged. | 0.5, R3, 3.1a, 7.2 (alternative: show the words in the pill, no test change, deviates from the mockup) | no | **Answered.** Default: `0:00` and the alarm icon, "Time's up!" as accessible name; five assertions change. |
| X5 | Timer durations: one list for all (1/3/5/10) or what each screen has today? | What each screen has today (amendment A6). | R3, 3.1a, G3, 7.2 | no | **Answered, ≠ default.** One list 1/3/5/10 on every screen. Spec ruling 19. Tasks 0.5, 3.1a, G3. |
| X6 | The sidebar footer navigation and the settings sub-navigation are both named "Settings". | Sidebar footer landmark renamed "Team and administration"; one line of `Plan18dBrandingTest` changes. | 0.8 | no | **Answered (second round).** Default: landmark renamed "Team and administration". |
| X7 | Until each live screen is rewritten, its old reactions toolbar stays next to the new `ReactionBar` (two views over one engine). | Accept; the old file is deleted in F1. | 0.6 | no | Not answered: the default stands (a transition state, gone at F1). |
| X8 | New test ids: the briefs use five different patterns, and the landing brief reuses `P12`, already taken. | `[P18e-<group>-<nn>]`, group on two digits (`00` for the preparation). | every new test | no | Not answered: the default stands (test ids). |

## Group 1 — session creation

| Id | Question | Default | Tasks affected otherwise | Blocks | Answer (2026-10-02) |
|---|---|---|---|---|---|
| 1-D1 | Footer button "Create & open" for the three types (today "Start", "Create game", "Create")? | Yes (mockup). 3 poker and 3 whiteboard clicks change. | 1.1–1.3 | no | **Answered.** Default: "Create & open". |
| 1-D2 | Three triggers (New retrospective, New game, New whiteboard) or one "New session"? | Three triggers, each preselects its type. | 1.1, 4.1 | no | **Answered, ≠ default.** One "New session" trigger; the type is chosen in the dialog. Tasks 1.1 to 1.4, 4.1. |
| 1-D3 | Full template picker inside the dialog, or five shortcut cards and "Browse"? | Full picker inline. | 1.1 | no | **Answered, ≠ default.** Five shortcut cards and "Browse"; the five are the team's most used templates, with a fixed fallback. Spec B17; tasks 1.0a, 1.1. |
| 1-D4 | Three session types or the mockup's five (Poll, Icebreaker)? | Three. | 1.1 (five needs two new props on `teams/show`, outside spec §9) | no | **Answered, ≠ default.** Five types: Poll and Icebreaker added. **Third round:** four types in plan 18e; Poll moves to plan 19. Spec B18; tasks 1.0b, 1.4. |
| 1-D5 | Add `Deck.source: 'custom'` (badge "This game only") and a `@theme` token for the always-white whiteboard preview paper? | Both. | 1.2, 1.3 (otherwise `P17b-07` is relaxed) | no | **Answered (second round).** Default: both. |
| 1-D6 | Custom deck field ids: `deck-new-*` in the new-game dialog and `deck-custom-*` in the game settings (two briefs), or one prefix? | One prefix `deck-custom` in both: `#deck-custom-cards` stays as today. | 1.2, 3.1b | no | Not answered: the default stands (element ids). |
| 1-D7 | Saved decks: three briefs rewrite the dialog, two designs. | One owner (1.2), built on `DeckPicker` as the ScreenPokerQueue mockup shows; labels become "Create a deck", "Edit :name", "Delete :name". | 1.2 (alternative: keep the old labels with a hand-made list, no test change) | no | **Answered (second round).** Mockup labels "Create a deck", "Edit :name", "Delete :name", on the full page of 3-D3. Task 1.5. |
| 1-D8 | Whiteboard templates manager: confirmation in a dialog, or inline as today? | Inline as today (no mockup, so the tests decide). | 1.3 | no | **Answered (second round), ≠ default.** The manager confirms a deletion in a dialog. Task 1.3. |

## Group 2 — retro

| Id | Question | Default | Tasks affected otherwise | Blocks | Answer (2026-10-02) |
|---|---|---|---|---|---|
| 2-D1 | Card comments, card reactions and group renaming in `actions`? In `roti`? | `actions`: yes. `roti`: no. | R10, R11 | BLOCK-1 | **Answered** with BLOCK-1 (default). |
| 2-D2 | Action items creatable in `discussing` as well as `actions`? Editable in `roti`? | Yes to all three (no phase of an open retro where an item cannot be ticked). | R9, R10, R11 | BLOCK-1 | **Answered** with BLOCK-1 (default). |
| 2-D3 | Highlight and presentation mode in `actions`? | Yes; the highlight survives discussing ↔ actions. | R10 | BLOCK-1 | **Answered** with BLOCK-1 (default). |
| 2-D4 | Marker for retros completed before B2. | Boolean column set by the migration (amendment A2). | R11 | BLOCK-2 | **Answered** with BLOCK-2 (default). |
| 2-D5 | ROTI is no longer offered in `discussing`. | Confirm. | R11, tests `Plan08d` | BLOCK-2 | **Answered** with BLOCK-2 (confirmed). |
| 2-D6 | Session-end statistics: duration from when? Participation out of what? | No duration (the server has no start time). Participation = people who joined / team members. | R12 (amendment A3) | no | **Answered, ≠ default.** Duration added, from a new start-time column; shown for new retros only. Participation = joined / team members. Spec B3, B19; tasks R12a, R12. |
| 2-D7 | Export menu PDF / CSV / Markdown of the session-end mockup. | Not built; added to the backlog. | R12 | no | **Answered.** Backlog (export PDF / CSV / Markdown). |
| 2-D8 | Timer "+2 min". | Not built (start and stop only). | R3 | no | **Answered, ≠ default.** "+2 min" is built: a new action extends a running timer. **Third round:** on every timer. Spec B20; tasks R2b, R3, 3.0c, G0e, 7.0b. |
| 2-D9 | Discussion screen: topics list only (mockup), or topics rail plus the columns? | Topics rail plus the columns view, so card actions and the `retro-column-*` hooks keep a home. | R9 (topics only would change the discussing tests) | no | **Answered, ≠ default.** Topics list only, sorted by votes; each topic keeps its controls (comments, reactions, highlight). Task R9. |
| 2-D10 | Live cursors in `roti`. | Off (as in voting). | R11 | BLOCK-1 (row of the matrix) | **Answered** with BLOCK-1 (off). |
| 2-D11 | Guest link moves into the Share dialog; "Create a new link" asks for confirmation. | Accept; the guest-link tests gain one click. | R3 | no | **Answered.** Default for the retro; and with 7-D2 the guest-link controls live in the Share dialog only, on every session type. Tasks R3, 3.1b, G3, 7.2, 7.3. |
| 2-D12 | The card composer is named "Card text" in the new card; 13 tests use "Add a card…". | The component gets a label override; no test change. | R4 | no | **Answered (second round).** Default: keep "Add a card…". |
| 2-D13 | Confetti on the session-end screen. | Only if the design-system CSS already has the animation; never with reduced motion. | R12 | no | **Answered, ≠ default.** Confetti is built in CSS, no dependency, off with reduced motion. Task R12. |
| 2-D14 | "Send to email" becomes the primary button "Send the recap by e-mail". | Follow the mockup; 3 clicks change. | R12 | no | **Answered (second round).** Default: primary button "Send the recap by e-mail". |
| 2-D15 | Settings: the button is "Apply" in a popover (today "Save" in a dialog). | Follow the mockup; the settings tests change. | R3 | no | **Answered.** Default: popover "Apply". |

## Group 3 — poker

| Id | Question | Default | Tasks affected otherwise | Blocks | Answer (2026-10-02) |
|---|---|---|---|---|---|
| 3-D3 | Saved decks stay a dialog on the team page (mockup: a full page with Default, Duplicate, usage)? | Dialog; Default, Duplicate and usage are backlog. | 1.2 | no | **Answered, ≠ default.** Saved decks as a full page: route, default deck, duplicate, usage count. **Third round:** no backfill of usage. Spec B21; tasks 1.0c, 1.5. |
| 3-D5 | Spectator "eye" badge in the presence stack. | Dropped (the watching row of the table shows who watches). | 3.1a | no | **Answered.** Default: badge dropped. |
| 3-D6 | CSV export and the deck, period and "re-voted only" filters of the estimation history. | Backlog (no back end). | 3.3 | no | **Answered.** Backlog. |
| 3-D7 | Reveal button: "Show votes" (today, 8 tests) or the mockup's "Reveal cards"? | "Show votes". | 3.1a | no | **Answered, ≠ default.** "Reveal cards"; the tests follow. Task 3.1a. |
| 3-D8 | Re-vote, Estimate, Save estimate, Next task: in the result panel of the table (component) or in the dock (mockup)? | Result panel. | 3.1a | no | **Answered, ≠ default.** Re-vote, Estimate, Save estimate, Next task in the dock. Task 3.1a. |
| 3-D9 | "Watch only" stays the label when it is on (old front flipped to "Play"). | Follow the mockup; check `P10b-11`. | 3.1a | no | **Answered (second round).** Default: "Watch only" stays the label. |
| 3-D10 | Join page: spectator control as a checkbox (today) or a switch? | Checkbox. | 3.2 | no | **Answered (second round), ≠ default.** A switch. Task 3.2. |

## Group 4 — team page

| Id | Question | Default | Tasks affected otherwise | Blocks | Answer (2026-10-02) |
|---|---|---|---|---|---|
| 4-D1 | `/dashboard` redirects to the workspace page; with a team-centred sidebar, redirect to the current team? | No change (back-end change outside §9). | none | no | **Answered, ≠ default.** `/dashboard` redirects to the current team page. Spec B22; task 4.0a. |
| 4-D2 | Tile and section button both named "New retrospective" / "New whiteboard": about 24 text clicks become ambiguous. | Keep both; the tile's accessible name is "Start a retrospective" / "Start a whiteboard", so the existing clicks keep one match. | 4.1 (alternative: one trigger only) | no | **Moot.** One "New session" trigger (1-D2); no tiles. |
| 4-D3 | "Mood & ROTI" anchor: add a team trend (new back end) or point to the Health check card? | Health check card only. | 4.2 | no | **Answered, ≠ default.** Team mood and ROTI trend. Spec B23; tasks 4.0b, 4.3. |
| 4-D4 | Add `avatarUrl` to `members` and `availableMembers`. | Not added (outside §9); initials shown. Say yes and 4.1 adds one line in `TeamsController` with its feature test. | 4.1 | no | **Answered, ≠ default.** `avatarUrl` added to `members` and `availableMembers`. Spec B24; tasks 4.0c, 4.1. |
| 4-D5 | Confirmation when removing a member. | None, as today. | 4.1 | no | **Answered, ≠ default.** Confirmation dialog when removing a member. Task 4.1. |
| 4-D6 | "Saved decks" and "Whiteboard templates" as ghost buttons in the section headers (no mockup). | Yes. | 4.1 | no | **Answered (second round), ≠ default.** Both entries live in the "…" actions menu of their section. Task 4.1. |

## Group 5 — action items

| Id | Question | Default | Tasks affected otherwise | Blocks | Answer (2026-10-02) |
|---|---|---|---|---|---|
| 5-D1 | A click on a row opens a side sheet (comments, sub-tasks, edit); `?item=` opens it. | Yes. 6 tests go through the sheet. | 5.2 | no | **Answered.** Default: side sheet. |
| 5-D2 | "Export to Jira" icon stays visible in the row. | Yes (and in the sheet footer). | 5.2 | no | **Answered (second round).** Default: icon in the row and in the sheet footer. |
| 5-D3 | Delete without a confirmation, as today. | Keep. | 5.2, R9 | no | **Answered, ≠ default.** Delete with confirmation. Tasks R8b, R9, 5.2. |
| 5-D4 | "Group by". | Omitted. | 5.2 | no | **Answered, ≠ default.** "Group by" is built on the client. Task 5.2. |
| 5-D5 | Header counters. | Total only. | 5.2 | no | **Answered, ≠ default.** Header counters per status. Spec B25; tasks 5.0, 5.2. |
| 5-D6 | "New action item" in the page header (mockup: topbar). | Page header. | 5.2 | no | **Answered, ≠ default.** "New action item" in the topbar. Task 5.2. |
| 5-D7 | Label "(guest)" (today, asserted) or "(Guest)" (new component)? | "(guest)": the component follows the contract. | R8b | no | **Answered (second round), ≠ default.** "(Guest)" with a capital; the assertions change. Tasks R8b, R9, 5.2. |

## Group 6 — games

| Id | Question | Default | Tasks affected otherwise | Blocks | Answer (2026-10-02) |
|---|---|---|---|---|---|
| 6-D1 | Game choice as cards (mockup, about 9 assertions change) or the "Game" select? | Cards. | G3, G6 | no | **Answered.** Default: cards. |
| 6-D2 | Drawing ink: the six server colours, or eight theme colours (back-end change, pixel tests break)? | Six server colours; they are canvas data, exempt from the token rule. | G4 | no | **Answered, ≠ default.** Eight theme colours for the drawing ink; the server palette is extended, the pixel tests redone, old drawings keep their colours. Spec B26; tasks G0a, G4. |
| 6-D3 | ReactionBar in a standalone game room (none today). | Not added; backlog. | G3 | no | **Answered, ≠ default.** ReactionBar in standalone game rooms. Spec B27; tasks G0b, G3. |
| 6-D4 | Timer durations 1/2/3/5/10 (today) or 1/3/5/10? | Today's (X5). | G3 | no | **Answered by X5, ≠ default.** 1/3/5/10. |
| 6-D5 | Mark the most voted GIF as "Winner" (derived on the client). | Yes. | G5 | no | **Answered.** Default: "Winner" mark. |
| 6-D6 | Room status and avatars in the rooms list (needs back end). | Not shown. | G1 | no | **Answered, ≠ default.** Room status and avatars in the rooms list. **Third round:** live list. Spec B28; tasks G0c, G0d, G1. |
| 6-D7 | Invite dialog: the existing post-link section, or the full Share dialog? | Existing post-link section in a plain dialog. | G3 | no | **Answered, ≠ default.** Full Share dialog. Task G3. |
| 6-D8 | Hangman keyboard by locale (AZERTY, QWERTZ, QWERTY) or alphabetical? | By locale. | G3 | no | **Answered.** Default: keyboard by locale. |
| 6-D9 | Guest nickname: prefilled with the random name (today) or an empty field with the name as placeholder and "Another random nickname" (mockup)? | Prefilled. | G2 (the mockup choice edits `Plan13a` and `Plan13d`) | no | **Answered.** Default: prefilled nickname. |

## Group 7 — whiteboard

| Id | Question | Default | Tasks affected otherwise | Blocks | Answer (2026-10-02) |
|---|---|---|---|---|---|
| 7-D1 | Eight-colour sticky palette (13 test call sites, 2 colour assertions; built-in template notes keep old colours). | Yes. | 7.4 | no | **Answered, ≠ default.** Eight-colour palette and the built-in template JSON regenerated. Spec B29; tasks 7.0, 7.4. |
| 7-D2 | Guest-link controls: board menu and the new Share dialog, or move them? | Both. | 7.2, 7.3 | no | **Answered, ≠ default.** Guest-link controls in the Share dialog only, with confirmation on "Create a new link"; the tests follow. Tasks 7.2, 7.3. |
| 7-D3 | Hide Excalidraw's own colour picks and show our bar everywhere, or our bar only in the sticky tool? | Sticky tool only. | 7.4 | no | **Answered, ≠ default.** Our colour bar everywhere; Excalidraw's native quick picks hidden. Task 7.4. |
| 7-D4 | Sticky outline: none (today) or the palette border? | Palette border. | 7.4 | no | **Answered.** Default: palette border. |
| 7-D5 | Facilitator timer: inside the "Facilitation tools" bar or in the header? | Inside the bar (tests unchanged). | 7.2 | no | **Answered.** Default: timer inside the facilitation bar. |
| 7-D6 | Cursor colours from the presence tokens or the current hash colours? | Presence tokens. | 7.2 | no | **Answered (second round).** Default: presence tokens. |
| 7-D7 | Phone "read / edit" mode of the mockup. | Not built. | none | no | **Answered (second round), ≠ default.** Built: read by default on a phone, "Modifier" to edit. Spec §6.4; task 7.5. |

## Group 8 — surveys

| Id | Question | Default | Tasks affected otherwise | Blocks | Answer (2026-10-02) |
|---|---|---|---|---|---|
| 8-D1 | Surveys in `actions` and `roti`. | No (server rule unchanged). | S1, R10 | BLOCK-1 | **Answered** with BLOCK-1 (unchanged). |
| 8-D2 | "Add survey" only in the settings popover (mockup) or also a button on the board? | Popover only; 4 tests open the popover first. | S1 | no | **Answered.** Default: settings popover only. |
| 8-D3 | "Anonymous" badge when names are hidden. | No badge: comments on the same survey show names, the badge would mislead. | S1 | no | **Answered (second round).** Default: no badge. |
| 8-D4 | Multiple-choice results as "n · p%" (mockup) instead of "p% · n". | Accept. | S1 | no | **Answered (second round).** Default: "n · p%". |

## Group 9 — workspace

| Id | Question | Default | Tasks affected otherwise | Blocks | Answer (2026-10-02) |
|---|---|---|---|---|---|
| 9-D1 | Templates page: "Use" button and Poker / Whiteboard tabs. | Omitted. | 9c | no | **Answered, ≠ default.** "Use" (opens session creation with the template) and the Poker / Whiteboard tabs are built. **Third round:** workspace-level decks. Spec B30; tasks 1.0e, 9.0b, 9c. |
| 9-D2 | Workspace-only card grid, or the full template picker with the built-ins? | Card grid. | 9c | no | **Answered (second round), ≠ default.** The page includes the built-in templates (full picker), with "Use" and the Poker / Whiteboard tabs. **Third round:** workspace-level decks. Spec B30; tasks 1.0e, 9.0b, 9c. |
| 9-D4 | Typed-name confirmation for "Delete workspace" and for "Leave" on the members page (mockup shows it for Leave on the workspace page only). | Both. | 9a, 9b | no | **Answered.** Default: typed name for both. |
| 9-D5 | Revoke an invitation without confirmation. | As today, none. | 9b | no | **Answered (second round), ≠ default.** Revoking asks for confirmation. Task 9b. |
| 9-D6 | Members page stays for managers only. | Yes. | 9b | no | **Answered (second round).** Default: managers only. |
| 9-D7 | Template deletion text: the component says "Retros already created from it are not affected.", the test and the translations say "Retrospectives created from it keep their columns." | The component takes the existing sentence. | 9c | no | **Answered (second round), ≠ default.** The component's sentence "Retros already created from it are not affected."; translations and test redone. Task 9c. |

## Group 10 — settings

| Id | Question | Default | Tasks affected otherwise | Blocks | Answer (2026-10-02) |
|---|---|---|---|---|---|
| 10-D1 | Keep "Delete account" (the spec backlog lists it; the app has it). | Keep (amendment A7). | 10.1 | no | **Answered.** Default: keep "Delete account". |
| 10-D2 | API token creation: dialog (today) or inline form (mockup)? | Dialog. | 10.4 (inline edits 4 tests) | no | **Answered, ≠ default.** Inline token creation form; four tests change. Task 10.4. |
| 10-D3 | Two-factor setup as inline steps in the card; a Print button? | Inline steps, no Print. | 10.2 | no | **Answered.** Default: inline steps, no Print. |
| 10-D4 | Team settings sub-navigation: "Team" and "Integrations". | Yes. | 10.5 | no | **Answered (second round).** Default: "Team" and "Integrations". |
| 10-D5 | Mobile sub-navigation: the shared horizontal list (as 18d) or a select? | Shared list. | 10.1 | no | **Answered.** Default: shared horizontal list. |
| 10-D6 | Notifications: explicit Save. | Keep. | 10.3 | no | **Answered.** Default: explicit Save. |

## Group 11 — access

| Id | Question | Default | Tasks affected otherwise | Blocks | Answer (2026-10-02) |
|---|---|---|---|---|---|
| 11-D1 | A centred variant of the auth frame for guest join, invitation and notices. | Yes (built in 0.7). | 0.7 | no | Not answered: the default stands; it is what the GuestJoin and invitation mockups show. |
| 11-D2 | SSO buttons on the invitation page (needs a new prop). | Not added. | 11.5 | no | **Answered, ≠ default.** SSO buttons on the invitation page (`ssoProviders`); accepting through SSO is authentication work, reviewed under plan 18f's security rules. **Third round:** an unverified SSO address is refused (plan 18f). Spec B31; tasks 11.5a, 11.5. |
| 11-D3 | Request id on the 500 page. | Not shown. | 11.7 | no | **Answered (second round), ≠ default.** Request id on the 500 page: generated per request, written to the log, shown. Spec B36; tasks 11.6, 11.7. |
| 11-D4 | Login aside on a rebranded instance: Skrüm's promise or the brand logo only? | Brand logo only when the instance has its own brand; the promise otherwise. | 11.2 | no | **Answered.** Default: brand logo only on a rebranded instance. |
| 11-D5 | "Remember me" (mockup says "30 days", which is false). | "Remember me". | 11.2 | no | **Answered (second round).** Default: "Remember me". |
| 11-D7 | Maintenance page and the "status" / "help" links. | Framework default; links not rendered. | 11.7 | no | **Answered (second round), ≠ default.** 503 redesigned as a static Blade page without database; the "status" and "help" links stay out (no target). Spec B15; task 11.7. |
| 11-D9 | Folder of the error page container. | `components/auth/`. | 11.7 | no | Not answered: the default stands (a folder). |
| 11-D10 | Pages for 419 and 429. | Framework behaviour. | 11.7 | no | **Answered (second round), ≠ default.** 419 and 429 are design-system error pages. Spec B15; task 11.7. |

## Group 12 — landing

| Id | Question | Default | Tasks affected otherwise | Blocks | Answer (2026-10-02) |
|---|---|---|---|---|---|
| 12-D1 | On a self-hosted instance: (a) the marketing landing, (b) a minimal entry page (instance name and logo, Log in, Register when sign-up is open, Dashboard), or (c) a redirect to the login page? | None. Recommendation: (b). | 12.1 is written for (b); (a) adds the mockup sections; (c) replaces the task by a redirect and its test | BLOCK-3 | **Answered, ≠ recommendation.** (c) redirect. See BLOCK-3. |
| 12-D2 | Licence name (mockup AGPL-3.0, `composer.json` MIT, no LICENSE file). | Not mentioned on the page. | 12.1 | only if (a) | **Moot.** No landing page (12-D1). |
| 12-D3 | Install snippet: image path, Helm chart. | No snippet. | 12.1 | only if (a) | **Moot.** No landing page (12-D1). |
| 12-D4 | Footer and nav links (docs, changelog, legal, GitHub). | Only links with a real target. | 12.1 | no | **Moot.** No landing page (12-D1). |
| 12-D5 | Language switcher on the page. | Yes, the existing one. | 12.1 | no | **Moot.** No landing page (12-D1). |
| 12-D6 | Feature claims (NPS, sprint trends, Jira import in poker, magic link, SAML/SCIM). | None of the unbuilt ones. | 12.1 | only if (a) | **Moot.** No landing page (12-D1). |
| 12-D7 | What a visitor sees when sign-up is by invitation. | Log in only, with the line "Sign-up is by invitation". | 12.1 | no | **Moot.** No landing page (12-D1). |
