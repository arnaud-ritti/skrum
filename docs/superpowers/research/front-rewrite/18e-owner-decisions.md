# Plan 18e — decisions for the product owner

Each line: the question, the plan's default (what is built if nobody answers), the tasks that change if the answer is different, and whether the question blocks work.

Task ids are those of `2026-10-16-plan-18e-front-rewrite-screens.md`. Brief ids (D1, R3…) are those of `18e-briefs/<nn>-*.md`.

## Blocking

| Id | Question | Blocks | Where it is drafted |
|---|---|---|---|
| BLOCK-1 | What is allowed in the new retro phases `actions` and `roti` (highlight, action items, comments, reactions, group naming, suggestions, surveys, cursors)? The spec says "guards updated" and gives no rule. | R10, R11; the `SurveyPhases` constant of S1 | `18e-spec-amendment.md` A1 |
| BLOCK-2 | How is a retro "completed before the change" recognised, so that it keeps ROTI voting? ROTI also leaves `discussing`: confirm. | R11 | amendment A2 |
| BLOCK-3 | Does a self-hosted instance show a marketing landing at all (12-D1)? | group 12 only (task 12.1) | below, group 12 |
| BLOCK-4 | Approve amendment A4 to A9 (folder `components/session/`, pages render their own layout, timer durations per screen, backlog list, corrections). | Task 0.2 onwards (formally: spec first) | amendment A4–A9 |

Everything else has a default and does not stop the plan.

## Cross-group

| Id | Question | Default | Tasks affected otherwise | Blocks |
|---|---|---|---|---|
| X1 | How does a page give its layout the active nav entry, breadcrumbs or session slots? | The page (or its shell) renders the layout and passes typed props, as 18d did for `about` and `admin/*`; `app.tsx` assigns no layout to rewritten pages. | 0.2 and every screen task (alternative: layouts stay assigned in `app.tsx`, pages call `setLayoutProps`; live pages would still render their own) | with BLOCK-4 |
| X2 | Who rewrites the four guest-join pages and `retros/session-ended`? | Each join page with its session group (R2, 3.2, G2, 7.1) on one shared `GuestJoinPage` written in Task 0; `session-ended` in R2. | 0.7, R2, 3.2, G2, 7.1, group 11 | no |
| X3 | "Reconnecting…" as a banner (three briefs) or a pill in the header (whiteboard brief)? | Pill in the header; the banner's sentence "Your cards are kept locally…" is false for poker and games. Expired session stays a banner with Reload. | 0.3 | no |
| X4 | When the timer ends, the new Timer shows `0:00` with an alarm icon and the name "Time's up!"; five tests read the text "Time's up!" inside `[role="timer"]`. | Follow the Timer mockup; the five assertions check the accessible name instead. The toast "Time's up!" is unchanged. | 0.5, R3, 3.1a, 7.2 (alternative: show the words in the pill, no test change, deviates from the mockup) | no |
| X5 | Timer durations: one list for all (1/3/5/10) or what each screen has today? | What each screen has today (amendment A6). | R3, 3.1a, G3, 7.2 | no |
| X6 | The sidebar footer navigation and the settings sub-navigation are both named "Settings". | Sidebar footer landmark renamed "Team and administration"; one line of `Plan18dBrandingTest` changes. | 0.8 | no |
| X7 | Until each live screen is rewritten, its old reactions toolbar stays next to the new `ReactionBar` (two views over one engine). | Accept; the old file is deleted in F1. | 0.6 | no |
| X8 | New test ids: the briefs use five different patterns, and the landing brief reuses `P12`, already taken. | `[P18e-<group>-<nn>]`, group on two digits (`00` for the preparation). | every new test | no |

## Group 1 — session creation

| Id | Question | Default | Tasks affected otherwise | Blocks |
|---|---|---|---|---|
| 1-D1 | Footer button "Create & open" for the three types (today "Start", "Create game", "Create")? | Yes (mockup). 3 poker and 3 whiteboard clicks change. | 1.1–1.3 | no |
| 1-D2 | Three triggers (New retrospective, New game, New whiteboard) or one "New session"? | Three triggers, each preselects its type. | 1.1, 4.1 | no |
| 1-D3 | Full template picker inside the dialog, or five shortcut cards and "Browse"? | Full picker inline. | 1.1 | no |
| 1-D4 | Three session types or the mockup's five (Poll, Icebreaker)? | Three. | 1.1 (five needs two new props on `teams/show`, outside spec §9) | no |
| 1-D5 | Add `Deck.source: 'custom'` (badge "This game only") and a `@theme` token for the always-white whiteboard preview paper? | Both. | 1.2, 1.3 (otherwise `P17b-07` is relaxed) | no |
| 1-D6 | Custom deck field ids: `deck-new-*` in the new-game dialog and `deck-custom-*` in the game settings (two briefs), or one prefix? | One prefix `deck-custom` in both: `#deck-custom-cards` stays as today. | 1.2, 3.1b | no |
| 1-D7 | Saved decks: three briefs rewrite the dialog, two designs. | One owner (1.2), built on `DeckPicker` as the ScreenPokerQueue mockup shows; labels become "Create a deck", "Edit :name", "Delete :name". | 1.2 (alternative: keep the old labels with a hand-made list, no test change) | no |
| 1-D8 | Whiteboard templates manager: confirmation in a dialog, or inline as today? | Inline as today (no mockup, so the tests decide). | 1.3 | no |

## Group 2 — retro

| Id | Question | Default | Tasks affected otherwise | Blocks |
|---|---|---|---|---|
| 2-D1 | Card comments, card reactions and group renaming in `actions`? In `roti`? | `actions`: yes. `roti`: no. | R10, R11 | BLOCK-1 |
| 2-D2 | Action items creatable in `discussing` as well as `actions`? Editable in `roti`? | Yes to all three (no phase of an open retro where an item cannot be ticked). | R9, R10, R11 | BLOCK-1 |
| 2-D3 | Highlight and presentation mode in `actions`? | Yes; the highlight survives discussing ↔ actions. | R10 | BLOCK-1 |
| 2-D4 | Marker for retros completed before B2. | Boolean column set by the migration (amendment A2). | R11 | BLOCK-2 |
| 2-D5 | ROTI is no longer offered in `discussing`. | Confirm. | R11, tests `Plan08d` | BLOCK-2 |
| 2-D6 | Session-end statistics: duration from when? Participation out of what? | No duration (the server has no start time). Participation = people who joined / team members. | R12 (amendment A3) | no |
| 2-D7 | Export menu PDF / CSV / Markdown of the session-end mockup. | Not built; added to the backlog. | R12 | no |
| 2-D8 | Timer "+2 min". | Not built (start and stop only). | R3 | no |
| 2-D9 | Discussion screen: topics list only (mockup), or topics rail plus the columns? | Topics rail plus the columns view, so card actions and the `retro-column-*` hooks keep a home. | R9 (topics only would change the discussing tests) | no |
| 2-D10 | Live cursors in `roti`. | Off (as in voting). | R11 | BLOCK-1 (row of the matrix) |
| 2-D11 | Guest link moves into the Share dialog; "Create a new link" asks for confirmation. | Accept; the guest-link tests gain one click. | R3 | no |
| 2-D12 | The card composer is named "Card text" in the new card; 13 tests use "Add a card…". | The component gets a label override; no test change. | R4 | no |
| 2-D13 | Confetti on the session-end screen. | Only if the design-system CSS already has the animation; never with reduced motion. | R12 | no |
| 2-D14 | "Send to email" becomes the primary button "Send the recap by e-mail". | Follow the mockup; 3 clicks change. | R12 | no |
| 2-D15 | Settings: the button is "Apply" in a popover (today "Save" in a dialog). | Follow the mockup; the settings tests change. | R3 | no |

## Group 3 — poker

| Id | Question | Default | Tasks affected otherwise | Blocks |
|---|---|---|---|---|
| 3-D3 | Saved decks stay a dialog on the team page (mockup: a full page with Default, Duplicate, usage)? | Dialog; Default, Duplicate and usage are backlog. | 1.2 | no |
| 3-D5 | Spectator "eye" badge in the presence stack. | Dropped (the watching row of the table shows who watches). | 3.1a | no |
| 3-D6 | CSV export and the deck, period and "re-voted only" filters of the estimation history. | Backlog (no back end). | 3.3 | no |
| 3-D7 | Reveal button: "Show votes" (today, 8 tests) or the mockup's "Reveal cards"? | "Show votes". | 3.1a | no |
| 3-D8 | Re-vote, Estimate, Save estimate, Next task: in the result panel of the table (component) or in the dock (mockup)? | Result panel. | 3.1a | no |
| 3-D9 | "Watch only" stays the label when it is on (old front flipped to "Play"). | Follow the mockup; check `P10b-11`. | 3.1a | no |
| 3-D10 | Join page: spectator control as a checkbox (today) or a switch? | Checkbox. | 3.2 | no |

## Group 4 — team page

| Id | Question | Default | Tasks affected otherwise | Blocks |
|---|---|---|---|---|
| 4-D1 | `/dashboard` redirects to the workspace page; with a team-centred sidebar, redirect to the current team? | No change (back-end change outside §9). | none | no |
| 4-D2 | Tile and section button both named "New retrospective" / "New whiteboard": about 24 text clicks become ambiguous. | Keep both; the tile's accessible name is "Start a retrospective" / "Start a whiteboard", so the existing clicks keep one match. | 4.1 (alternative: one trigger only) | no |
| 4-D3 | "Mood & ROTI" anchor: add a team trend (new back end) or point to the Health check card? | Health check card only. | 4.2 | no |
| 4-D4 | Add `avatarUrl` to `members` and `availableMembers`. | Not added (outside §9); initials shown. Say yes and 4.1 adds one line in `TeamsController` with its feature test. | 4.1 | no |
| 4-D5 | Confirmation when removing a member. | None, as today. | 4.1 | no |
| 4-D6 | "Saved decks" and "Whiteboard templates" as ghost buttons in the section headers (no mockup). | Yes. | 4.1 | no |

## Group 5 — action items

| Id | Question | Default | Tasks affected otherwise | Blocks |
|---|---|---|---|---|
| 5-D1 | A click on a row opens a side sheet (comments, sub-tasks, edit); `?item=` opens it. | Yes. 6 tests go through the sheet. | 5.2 | no |
| 5-D2 | "Export to Jira" icon stays visible in the row. | Yes (and in the sheet footer). | 5.2 | no |
| 5-D3 | Delete without a confirmation, as today. | Keep. | 5.2, R9 | no |
| 5-D4 | "Group by". | Omitted. | 5.2 | no |
| 5-D5 | Header counters. | Total only. | 5.2 | no |
| 5-D6 | "New action item" in the page header (mockup: topbar). | Page header. | 5.2 | no |
| 5-D7 | Label "(guest)" (today, asserted) or "(Guest)" (new component)? | "(guest)": the component follows the contract. | R8b | no |

## Group 6 — games

| Id | Question | Default | Tasks affected otherwise | Blocks |
|---|---|---|---|---|
| 6-D1 | Game choice as cards (mockup, about 9 assertions change) or the "Game" select? | Cards. | G3, G6 | no |
| 6-D2 | Drawing ink: the six server colours, or eight theme colours (back-end change, pixel tests break)? | Six server colours; they are canvas data, exempt from the token rule. | G4 | no |
| 6-D3 | ReactionBar in a standalone game room (none today). | Not added; backlog. | G3 | no |
| 6-D4 | Timer durations 1/2/3/5/10 (today) or 1/3/5/10? | Today's (X5). | G3 | no |
| 6-D5 | Mark the most voted GIF as "Winner" (derived on the client). | Yes. | G5 | no |
| 6-D6 | Room status and avatars in the rooms list (needs back end). | Not shown. | G1 | no |
| 6-D7 | Invite dialog: the existing post-link section, or the full Share dialog? | Existing post-link section in a plain dialog. | G3 | no |
| 6-D8 | Hangman keyboard by locale (AZERTY, QWERTZ, QWERTY) or alphabetical? | By locale. | G3 | no |
| 6-D9 | Guest nickname: prefilled with the random name (today) or an empty field with the name as placeholder and "Another random nickname" (mockup)? | Prefilled. | G2 (the mockup choice edits `Plan13a` and `Plan13d`) | no |

## Group 7 — whiteboard

| Id | Question | Default | Tasks affected otherwise | Blocks |
|---|---|---|---|---|
| 7-D1 | Eight-colour sticky palette (13 test call sites, 2 colour assertions; built-in template notes keep old colours). | Yes. | 7.4 | no |
| 7-D2 | Guest-link controls: board menu and the new Share dialog, or move them? | Both. | 7.2, 7.3 | no |
| 7-D3 | Hide Excalidraw's own colour picks and show our bar everywhere, or our bar only in the sticky tool? | Sticky tool only. | 7.4 | no |
| 7-D4 | Sticky outline: none (today) or the palette border? | Palette border. | 7.4 | no |
| 7-D5 | Facilitator timer: inside the "Facilitation tools" bar or in the header? | Inside the bar (tests unchanged). | 7.2 | no |
| 7-D6 | Cursor colours from the presence tokens or the current hash colours? | Presence tokens. | 7.2 | no |
| 7-D7 | Phone "read / edit" mode of the mockup. | Not built. | none | no |

## Group 8 — surveys

| Id | Question | Default | Tasks affected otherwise | Blocks |
|---|---|---|---|---|
| 8-D1 | Surveys in `actions` and `roti`. | No (server rule unchanged). | S1, R10 | BLOCK-1 |
| 8-D2 | "Add survey" only in the settings popover (mockup) or also a button on the board? | Popover only; 4 tests open the popover first. | S1 | no |
| 8-D3 | "Anonymous" badge when names are hidden. | No badge: comments on the same survey show names, the badge would mislead. | S1 | no |
| 8-D4 | Multiple-choice results as "n · p%" (mockup) instead of "p% · n". | Accept. | S1 | no |

## Group 9 — workspace

| Id | Question | Default | Tasks affected otherwise | Blocks |
|---|---|---|---|---|
| 9-D1 | Templates page: "Use" button and Poker / Whiteboard tabs. | Omitted. | 9c | no |
| 9-D2 | Workspace-only card grid, or the full template picker with the built-ins? | Card grid. | 9c | no |
| 9-D4 | Typed-name confirmation for "Delete workspace" and for "Leave" on the members page (mockup shows it for Leave on the workspace page only). | Both. | 9a, 9b | no |
| 9-D5 | Revoke an invitation without confirmation. | As today, none. | 9b | no |
| 9-D6 | Members page stays for managers only. | Yes. | 9b | no |
| 9-D7 | Template deletion text: the component says "Retros already created from it are not affected.", the test and the translations say "Retrospectives created from it keep their columns." | The component takes the existing sentence. | 9c | no |

## Group 10 — settings

| Id | Question | Default | Tasks affected otherwise | Blocks |
|---|---|---|---|---|
| 10-D1 | Keep "Delete account" (the spec backlog lists it; the app has it). | Keep (amendment A7). | 10.1 | no |
| 10-D2 | API token creation: dialog (today) or inline form (mockup)? | Dialog. | 10.4 (inline edits 4 tests) | no |
| 10-D3 | Two-factor setup as inline steps in the card; a Print button? | Inline steps, no Print. | 10.2 | no |
| 10-D4 | Team settings sub-navigation: "Team" and "Integrations". | Yes. | 10.5 | no |
| 10-D5 | Mobile sub-navigation: the shared horizontal list (as 18d) or a select? | Shared list. | 10.1 | no |
| 10-D6 | Notifications: explicit Save. | Keep. | 10.3 | no |

## Group 11 — access

| Id | Question | Default | Tasks affected otherwise | Blocks |
|---|---|---|---|---|
| 11-D1 | A centred variant of the auth frame for guest join, invitation and notices. | Yes (built in 0.7). | 0.7 | no |
| 11-D2 | SSO buttons on the invitation page (needs a new prop). | Not added. | 11.5 | no |
| 11-D3 | Request id on the 500 page. | Not shown. | 11.7 | no |
| 11-D4 | Login aside on a rebranded instance: Skrüm's promise or the brand logo only? | Brand logo only when the instance has its own brand; the promise otherwise. | 11.2 | no |
| 11-D5 | "Remember me" (mockup says "30 days", which is false). | "Remember me". | 11.2 | no |
| 11-D7 | Maintenance page and the "status" / "help" links. | Framework default; links not rendered. | 11.7 | no |
| 11-D9 | Folder of the error page container. | `components/auth/`. | 11.7 | no |
| 11-D10 | Pages for 419 and 429. | Framework behaviour. | 11.7 | no |

## Group 12 — landing

| Id | Question | Default | Tasks affected otherwise | Blocks |
|---|---|---|---|---|
| 12-D1 | On a self-hosted instance: (a) the marketing landing, (b) a minimal entry page (instance name and logo, Log in, Register when sign-up is open, Dashboard), or (c) a redirect to the login page? | None. Recommendation: (b). | 12.1 is written for (b); (a) adds the mockup sections; (c) replaces the task by a redirect and its test | BLOCK-3 |
| 12-D2 | Licence name (mockup AGPL-3.0, `composer.json` MIT, no LICENSE file). | Not mentioned on the page. | 12.1 | only if (a) |
| 12-D3 | Install snippet: image path, Helm chart. | No snippet. | 12.1 | only if (a) |
| 12-D4 | Footer and nav links (docs, changelog, legal, GitHub). | Only links with a real target. | 12.1 | no |
| 12-D5 | Language switcher on the page. | Yes, the existing one. | 12.1 | no |
| 12-D6 | Feature claims (NPS, sprint trends, Jira import in poker, magic link, SAML/SCIM). | None of the unbuilt ones. | 12.1 | only if (a) |
| 12-D7 | What a visitor sees when sign-up is by invitation. | Log in only, with the line "Sign-up is by invitation". | 12.1 | no |
