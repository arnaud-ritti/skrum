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
