# Spec amendment for plan 18e — draft for owner approval

Target: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md`.
Status: DRAFT. Nothing below is approved. Project rule: spec first, then plan, then code.

What waits for what:

| Section of this draft | Must be approved before |
|---|---|
| A1 (guard matrix for `actions` and `roti`) | plan task R10 (and R11, S1) |
| A2 (B2 legacy marker) | plan task R11 |
| A3 (B3 session-end stats) | plan task R12 (default "no new prop" needs no approval) |
| A4 to A9 (wording, folders, backlog) | plan task 0.2 (they describe what Task 0 builds) |

Each section gives the current text, the problem found in the code or in a brief, and the proposed text.

---

## A1. §9 B1 — what is allowed in phases `actions` and `roti`

**Current text.** "`RetroPhase` gains `Actions` and `Roti` between `Discussing` and `Completed`. Neighbour rule, `Retro::phases()`, guards, visibility rules, `phase` payloads, TS types and reducer updated."

**Problem.** "guards, visibility rules updated" names no rule. 54 PHP files use `RetroPhase`; the guards below name `Discussing` explicitly, so each one needs a decision (brief 02 §7.1, verified by `grep -rnE "RetroPhase::(Discussing|Completed)" app`). Briefs 02 and 08 disagree on surveys (02: extend to both phases; 08: leave unchanged).

**Proposed text, added under B1.**

Principle: `actions` behaves like `discussing` for everything that touches cards and action items. `roti` is a rating step: the board is read-only, action items stay editable so there is no phase in which an open retro's items cannot be ticked.

| Capability | Guard (file) | discussing | actions | roti | completed |
|---|---|---|---|---|---|
| Neighbour rule | `Retro::phases()`, `canMoveTo()` | … ↔ discussing ↔ actions | ↔ roti | ↔ completed | Reopen lands on `roti` |
| Vote totals visible | `Retro::showsVoteTotals()` (`app/Models/Retro.php:95`) | yes | **yes** | **yes** | yes |
| Highlight a card, presentation mode | `RetroHighlightsController:24,39` | yes | **yes** | no | no |
| Highlight kept when the phase changes | `ChangeRetroPhase::move()` (`:94-101`) | kept between `discussing` and `actions`; cleared on any other move | | | |
| Action items: create, update, delete, sub-tasks, comments (board routes) | `LocksDiscussingRetro::guardDiscussing()` (9 call sites) | yes, unless locked | **yes, unless locked** | **yes, unless locked** | no (workspace routes, as today) |
| MCP `CreateAction`, `UpdateAction` | `app/Mcp/Tools/Retro/CreateAction.php:81,89`, `UpdateAction.php:91` | yes | **yes** | **yes** | as today |
| Suggested actions: promote, reject | `SuggestionGuard:35-52` | anyone, unless locked | **as discussing** | **as discussing** | facilitator or admin |
| Insights readable | `BuildInsights:30`, MCP `ListInsights:57` | yes | **yes** | **yes** | yes |
| Group naming | `RetroGuard::groupNaming()` (`:37`) | yes | **yes** | no | no |
| Card reactions | `CardReactionsController:75` | yes | **yes** | no | no |
| Card comments | `CardCommentsController:147` | yes | **yes** | no | no |
| Surveys answerable, creatable | `SurveyGuard::activePhase()` (`:17`) | yes | no (unchanged) | no (unchanged) | no (closed on completion, as today) |
| ROTI vote and retract | `RetroRotiController:63` | **no** (was yes) | no | **yes** | only for legacy retros, see A2 |
| MCP `GetRoti` | `GetRoti.php:50,58` | **not available** (was "pending") | not available | "pending" | results |
| Timer, settings, lock, guest link, hand-over, delete | guards based on `RetroPhase::isOpen()` | yes | yes | yes | as today |
| Cards: write, edit, move, group, vote | guards naming `writing`, `grouping`, `voting` | as today | no | no | no |
| Live cursors (front rule `showsCursors`) | `components/session` container | on | **on** | **off** (a pointer on a score reveals a vote, as in voting) | off |
| Flying reactions (front rule) | retro container | on | **on** | **on** | off |

Renames that follow: `LocksDiscussingRetro` keeps its name in 18e (9 call sites, rename left to 18g); it reads a new `RetroPhase::takesActionItems(): bool` (`Discussing`, `Actions`, `Roti`).

Public payloads: the `phase` value and the `phases` list of the board snapshot, of `TeamsController` (`phase`, `phaseLabel`) and of the MCP board presenter (`McpBoard`) gain `actions` and `roti`. No webhook or outgoing payload carries a phase (brief 02 §7.1, grep). The MCP server instructions (`SkrumServer.php:44`) and the three tool descriptions that say "only while the board is in the Discussing phase" are reworded.

Labels: `RetroPhase::label()` returns `__('Actions')` and `__('ROTI')`.

Data: no migration. `retros.phase` is a string; a retro in `discussing` gets two more steps. A retro in `discussing` that already holds ROTI votes keeps them and can change them in `roti`.

Consequence to accept: a survey still open when the facilitator leaves `discussing` can no longer be answered; it is closed, and its results shown, on completion as today.

**Alternatives the owner may prefer** (each changes R10 only): reactions and comments also in `roti`; action items read-only in `roti`; surveys answerable in `actions`.

---

## A2. §9 B2 — which completed retros keep ROTI voting

**Current text.** "Voting on ROTI in `completed` stays allowed for retros completed before the change, so nothing is lost."

**Problem.** Nothing in the schema says "completed before the change" (`retros` has `completed_at`, no deploy date). `RetroRotiController::guard()` cannot tell the two cases apart (brief 02 risk 6).

**Proposed text, replacing that sentence.**

"A boolean column `retros.roti_votable_when_completed` (default `false`) marks the retros that were already completed when B2 was deployed: the migration that adds the column sets it to `true` where `phase = 'completed'`. ROTI voting is allowed in phase `roti`, and in `completed` only when the column is `true`. The board snapshot's `roti` object gains `canVote: bool` so the front end shows the vote control or the result only. A legacy retro that is reopened and completed again keeps the mark."

Options not retained: (b) allow ROTI voting in every completed retro (no schema change; ROTI results could change after the recap e-mail, as today); (c) compare `completed_at` with a date stored in configuration (a date to maintain per instance).

---

## A3. §9 B3 — session-end statistics

**Current text.** "Props are added only if the mockup needs data that the server already holds (duration, participation, counts)."

**Problem.** The server holds no start time (`retros.created_at` is the creation of the board, often days before the meeting; there is no `started_at`). "Participation" has two possible denominators (brief 02 §7.3).

**Proposed text.**

"`results.stats` is added to the completed snapshot: `votesCast` (number of votes), `participation` (`participants`: people who joined the retro; `teamMembers`: members of the team at completion). Cards, groups and action items are counted on the client from data already sent. Duration is not shown: the server holds no start time (backlog)."

---

## A4. §9 B10 — consumers of the column colour

**Current text.** "Built-in template catalogue, validation rules, MCP and export payloads that expose the colour are updated."

**Problem.** `grep -rniE "colou?r" app/Mcp app/Actions/Integrations app/Notifications` finds no column colour: no MCP tool, webhook or export exposes it. The real consumers are the board snapshot and the `columns.changed` event (`PresentColumns.php:25`), the template props, 52 built-in templates in `TemplateCatalogue.php`, two factories, and the JSON endpoints that validate with `Rule::enum(ColumnColor::class)`.

**Proposed text.**

"`ColumnColor` becomes `sun`, `apricot`, `coral`, `plum`, `iris`, `sky`, `lagoon`, `moss`. Data migration for `columns` and `workspace_template_columns` (green→moss, red→coral, blue→sky, amber→sun, purple→plum, slate→iris). The built-in template catalogue and the factories use the new values. The board snapshot, the `columns.changed` event and the template props emit the new values. The column and workspace-template endpoints reject the six old values with a validation error. No MCP tool, webhook or export carries a column colour. The eight built-in whiteboard templates keep their own sticky colours (they are scene data, not `ColumnColor`)."

---

## A5. §6.1 — folders and layout assignment

**Current text.** Containers "per domain, in `resources/js/components/<domain>/`: `retro`, `poker`, `games`, `whiteboard`, `action-items`, `teams`, `workspaces`, `settings`, `auth`, `integrations`, `admin`". "No new base folder." Layouts are "assigned centrally in `app.tsx`, as today".

**Problem.** (1) Retro, poker, games and whiteboard share the connection banner, the expired-session banner, presence, the timer alarm, live cursors, the reaction engine and the guest-join page. Today these files live under `components/retro/` and `components/realtime/` and are imported across domains. (2) The landing has containers and no domain. (3) A live page cannot receive its header slots (phases, timer, presence) from a layout assigned by name: they are board state. Plan 18d already made `about` and `admin/*` render their own layout.

**Proposed text.**

"Domains: `retro`, `poker`, `games`, `whiteboard`, `action-items`, `teams`, `workspaces`, `settings`, `auth`, `integrations`, `admin`, plus `session` (containers shared by the four live session types) and `landing`. Error pages use `components/auth/`.

A page renders its own layout: the page, or the shell of its domain (`AdminShell`, `SettingsShell`, `SessionShell`), wraps the content in the layout and passes typed props. `app.tsx` returns no layout for these pages; the list is `resources/js/lib/page-layouts.ts` until every page is rewritten, after which `app.tsx` assigns no layout at all."

Known cost: a layout is no longer kept mounted between two visits (the sidebar re-renders; its open state comes from the cookie).

---

## A6. §6.5 ruling 19 — timer durations

**Current text.** "Timer increments follow what the timer endpoint and current UI offer (1, 3, 5, 10 minutes)."

**Problem.** The current UI differs per screen: retro and whiteboard 1/3/5/10 min; poker 30 s, 1, 2, 3 min and a custom value of 1 to 60 min; games 1/2/3/5/10 min. Browser tests bind "30 s" and "1 min".

**Proposed text.** "Timer durations follow what each screen offers today: retro and whiteboard 1, 3, 5, 10 minutes; poker 30 seconds, 1, 2, 3 minutes and a custom value; games 1, 2, 3, 5, 10 minutes. No pause, no '+ n minutes'."

---

## A7. §10 — backlog list

Remove (they exist in the old front end, so goal 2 keeps them):
- "account deletion" (the profile page deletes the account today: `DELETE profile.destroy`).
- "manual action creation outside a retro" (the action-items page has "New action item" today).

Add (shown by a mockup, no back end, not rendered):
- Retro: export of a finished retro as PDF, CSV or Markdown; session duration; ROTI trend against earlier retros; typing and "is moving a card" indicators.
- Poker: CSV export and the deck, period and "re-voted only" filters of the estimation history; default deck, duplicate and usage count of saved decks; spectator flag in presence.
- Team page: retro participant, card and action counts; member role; aggregated action list; team mood and ROTI trend.
- Action items: per-status counters, filters by priority, due date and source, grouping.
- Games: room status and players in the rooms list; `DeckSaved` / `DeckDeleted` and team-games realtime events; game settings beyond name, access and language.
- Workspace: team description and activity on team tiles; template description, visibility, defaults, usage.
- Access: SSO on the invitation page; declining an invitation; request id on the 500 page; pages for 419 and 429; a maintenance page.
- Whiteboard: regenerating the built-in templates with the eight sticky colours.

---

## A8. Corrections of fact

| Where | Current | Correction |
|---|---|---|
| §7 row 10 | "`settings/*` (5), `teams/integrations`, Admin › Branding" | Admin › Branding was built in plan 18d; row 10 is `settings/*` and `teams/integrations` |
| §7 row 1 | "dialogs of `teams/show`" | the "New room" dialog of `games/index` belongs to row 6 |
| §7 rows 2, 3, 6, 7, 11 | join pages listed with their session type | confirmed: each join page is rewritten with its session group, on the shared `GuestJoinPage`; `retros/session-ended` with row 2 |
| §11 | "The whiteboard has no browser test today." | It has four walkthrough files (`Plan17a` to `Plan17d`) and a smoke test; they are part of the contract |
| §9 B16 | "renamed when plan 18e rewrites those screens" | names: `teamGroups` on `settings/api-tokens` (done in the preparation task of 18e, because the new sidebar reads the shared `teams`), `filterTeams` on `action-items/index` |

---

## A9. §9 B15 — limits of the error pages

Add: "The handler leaves JSON requests untouched (`expectsJson()`), so the JSON endpoints of the live pages and the MCP server keep their status codes and bodies. The 500 and 503 pages render without database-backed shared props. In debug mode 500 keeps the framework page. 419 and 429 keep the framework behaviour. `php artisan down` keeps the framework maintenance page (Inertia is not booted)."
