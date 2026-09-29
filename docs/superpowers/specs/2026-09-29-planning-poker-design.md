# Skrum — Planning poker — Design

Date: 2026-09-29
Status: Draft — open decisions pending
Parent spec: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (tenancy, roles, guests, realtime, redaction, i18n and packaging rules apply unless this spec says otherwise). Latest conventions: `docs/superpowers/specs/2026-09-29-board-engagement-design.md`.
Research: `docs/superpowers/research/qretro/` (QRetro parity roadmap, spec 4 of 7; `research.md` § Planning poker, `docs-inventory.md` § Planning poker, `screens/poker-game.png`, `screens/poker-systems.png`)

## 1. Intent

Give each team a realtime planning-poker room: the facilitator lists tasks, picks the one to estimate, everyone plays a hidden card, the facilitator reveals all cards at once, sees the average and distribution, re-votes if needed and records the final estimate. Guests join by link without an account. Every game, round and vote is kept so the team can look back at its estimates.

**Success:** a team estimates a backlog end-to-end in two browsers (one member, one guest) with no reload; no card value of another player ever reaches a browser before reveal (proved by feature tests over snapshot, endpoint responses and broadcast payloads); suite, phpstan, type-check and lint stay green; no new dependency.

### In scope

- Team-owned poker games: create, rename, end, reopen, delete; list per team.
- Decks: Fibonacci, Modified Fibonacci, T-shirt, Powers of 2, custom.
- Tasks added manually: title + Markdown description; edit, reorder, delete.
- Facilitator flow: select current task → hidden voting → "Show votes" → result (average or distribution) → "Re-vote" (new round) → final estimate.
- Guests by link (own cookie identity), presence, realtime updates, snapshot refetch on reconnect.
- History: every round and vote kept per task; per-task round history in the game; team estimation history page.
- Data model ready to carry an external issue reference (filled by spec 6).

### Out of scope (deferred)

- Jira/Linear import and estimate write-back, `needs_sync` flag (spec 6). MCP `poker.*` tools (spec 5).
- Timer, auto-reveal when everyone has voted, spectator role, anonymous (unnamed) reveal.
- Live cursors and flying reactions inside poker rooms.
- Saved custom decks per team, CSV export, velocity charts.
- Any LLM-generated content (nothing in this spec needs it).

### Dependencies

- None new. Markdown is rendered with `league/commonmark`, already installed as a Laravel dependency (`Str::markdown`). Drag-and-drop reordering reuses `@dnd-kit/*`.
- Builds on: guest join and cookie (`app/Http/Controllers/RetroJoinsController.php`, `app/Actions/Retros/GuestCookie.php`), participant resolution (`app/Actions/Retros/ResolveParticipant.php`, `app/Http/Middleware/ResolveRetroParticipant.php`), channel auth (`app/Http/Controllers/BroadcastAuthorizationsController.php`), broadcast base (`app/Events/Retros/RetroBroadcastEvent.php`), vote locking (`app/Http/Controllers/Retros/CardVotesController.php`), realtime hook (`resources/js/hooks/use-retro-channel.ts`), avatars (`Participant::avatarSeed()`), team page (`app/Http/Controllers/TeamsController.php`, `resources/js/pages/teams/show.tsx`), team policy (`app/Policies/TeamPolicy.php`).

## 2. Data model

### Player identity: a parallel `poker_players` table (Open decision 1)

`participants` has a non-null `retro_id`, a unique (`retro_id`, `user_id`), a per-retro guest cookie and is referenced by cards, votes, comments and action items. Poker gets its own table with the same shape rather than a polymorphic participant, so no retro query, policy or redaction test changes. Shared behaviour is extracted, not duplicated:

- `app/Concerns/HasGuestIdentity` (trait) — `isGuest()`, `displayName()` ("Former member" fallback), `avatarSeed()`, `avatarUrl()`; used by `Participant` and `PokerPlayer`. Existing retro behaviour is unchanged (same seed formula: user id for members, row id for guests).
- `GuestCookie` gains a scope argument: `GuestCookie::name('retro', $id)` → `retro_guest_{id}` (unchanged), `GuestCookie::name('poker', $id)` → `poker_guest_{id}`.

### Tables

- **poker_games**: `id` (UUID), `team_id` (cascade), `title` (string 120), `deck` (enum `PokerDeck`: `fibonacci`, `modified_fibonacci`, `tshirt`, `powers_of_two`, `custom`), `cards` (json array of strings — the deck copied at creation so later code changes never alter history), `facilitator_player_id` (nullable FK → poker_players, set after the creator's player row exists, `nullOnDelete`), `current_task_id` (nullable FK → poker_tasks, `nullOnDelete`), `guest_access_enabled` (bool, default `false`), `guest_token` (unique string 40), `ended_at` (nullable timestamp), timestamps. Index (`team_id`, `ended_at`).
- **poker_players**: `id`, `poker_game_id` (cascade), `user_id` (nullable, `nullOnDelete`), `guest_name` (nullable string 50), `guest_secret_hash` (nullable string 64), timestamps. Unique (`poker_game_id`, `user_id`).
- **poker_tasks**: `id`, `poker_game_id` (cascade), `title` (string 200), `description` (nullable text, Markdown, ≤ 10 000 characters), `position` (int), `estimate` (nullable string 8 — a deck card label), `estimate_numeric` (nullable decimal(8,2) — the card's numeric value, null for non-numeric cards), `estimated_at` (nullable timestamp), `external_source` (nullable string 20), `external_id` (nullable string 100), `external_url` (nullable string 2048), timestamps. Unique (`poker_game_id`, `external_source`, `external_id`). Index (`poker_game_id`, `position`).
- **poker_rounds**: `id`, `poker_task_id` (cascade), `number` (int, 1-based per task), `revealed_at` (nullable timestamp), `version` (unsigned int, default 0 — incremented on every vote change, orders `vote.changed` events like `retros.votes_version`), timestamps. Unique (`poker_task_id`, `number`).
- **poker_votes**: `id`, `poker_round_id` (cascade), `poker_player_id` (cascade), `value` (string 8 — a card label), timestamps. Unique (`poker_round_id`, `poker_player_id`).

### Modelling decisions

- **Deck enum** `PokerDeck` exposes `cards()` and a translated `label()`:
  - Fibonacci `0 1 2 3 5 8 13 21 34 55 89 ? ☕` (default)
  - Modified Fibonacci `0 ½ 1 2 3 5 8 13 20 40 100 ? ☕`
  - T-shirt `XXS XS S M L XL XXL ? ☕`
  - Powers of 2 `0 1 2 4 8 16 32 64 ? ☕`
  - Custom: 2–20 cards given by the creator, each 1–8 characters after trimming, unique (case-sensitive), in the given order. `?` and `☕` are not added automatically; the creation form offers two checkboxes (checked by default) that append them.
- **Special cards** `?` and `☕` are never counted in results, in any deck.
- **Numeric deck**: a deck is numeric when every non-special card parses as a number (`½` = 0.5, otherwise a decimal matching `^\d+(\.\d+)?$`). Built-in decks: all numeric except T-shirt. A custom deck is numeric or not by the same rule. `PokerDeck::numericValue(string $card): ?float` is the single parser.
- **Rounds**: a task has 0..n rounds; only its highest-numbered round (the *latest round*) accepts votes, and only while unrevealed. "Re-vote" creates round n+1; earlier rounds and their votes are kept forever (history).
- **External reference** columns exist so spec 6 can import and write back without a migration on a live table; spec 4 never writes them, validation rejects them from clients, and task payloads carry `external: null` or `{source, id, url}`.
- **Game ended** (`ended_at` set) is read-only for everyone except "Reopen" and "Delete" (§3).

## 3. Roles and rules

### Access

- **Create a game**: any user who can view the team (`TeamPolicy::createPokerGame` = `view`). The creator becomes a player and the facilitator.
- **Enter a game** (`/poker/{game}`): a user who can view the game's team joins as themselves (player row created on first visit, as `ResolveParticipant` does); otherwise a guest with a valid `poker_guest_{id}` cookie while `guest_access_enabled`. Anyone else: logged out → login (or a "session ended" page when guest access is on, mirroring `ResolveRetroParticipant::sendToLogin`); logged in non-member → 403.
- **Guests** join via `/poker/join/{guestToken}` with a display name (1–50). Regenerating the token revokes old links and signs out every guest (secrets cleared; names and votes stay). A logged-in non-member following the link joins as a guest with their name prefilled. Guests never see team or workspace pages.
- **Delete a game**: the facilitator, or a workspace Owner/Admin.

### Facilitator

Initially the creator. Facilitator-only actions: select the current task, reveal, re-vote, set/clear the estimate, delete or reorder tasks, change settings (title, deck, guest access), regenerate the guest link, end/reopen the game.

- **Transfer**: the facilitator hands over to any team member (or workspace Owner/Admin, added as a player if needed). Guests never facilitate.
- **Take over** (Open decision 4): any non-guest player who can view the team may make themselves facilitator at any time ("Take control"). Poker sessions span days and a missing facilitator would otherwise freeze the game; the retro rule (transfer only) stays unchanged.

### Tasks (Open decision 3)

- Add and edit (title, description): the facilitator and any non-guest player. Guests cannot add or edit tasks.
- Delete and reorder: facilitator only. Deleting a task deletes its rounds and votes; deleting the current task clears `current_task_id`.
- At most 200 tasks per game (422 beyond). New tasks are appended (position = max + 1).
- Allowed while the game is not ended; the title and description of a task can be edited in any round state.

### Voting flow

1. **Select** (`PUT current-task`): the facilitator sets `current_task_id` (or `null`). If the task has no round, round 1 is created. Selecting a task whose latest round is unrevealed resumes that round (its hidden votes are kept). Selecting an estimated task shows its latest round; a new vote requires "Re-vote".
2. **Vote** (`PUT rounds/{round}/vote`): any player (members, guests, the facilitator) plays one card from `game.cards` on the latest, unrevealed round of the *current* task. Playing again replaces the value; `DELETE` withdraws it. The player is always the requester: the endpoint takes no player parameter, so nobody can vote for someone else. Votes on a revealed round, a non-latest round, or a round of a task that is not current → 422 "Voting is closed for this round." Value not in the deck → 422.
3. **Reveal** (`POST rounds/{round}/reveal`): facilitator only, on the current task's latest unrevealed round with at least one vote (422 otherwise). Sets `revealed_at`. From then on the round is frozen.
4. **Result**, computed server-side by `PokerResult::for(round)` from countable votes (all except `?` and `☕`):
   - `distribution`: `[{value, count}]` for every played value including `?`/`☕`, in deck order.
   - Numeric deck: `average` = mean of countable values, rounded half-up to 1 decimal; `nearestCard` = the numeric card with the smallest distance to the average, ties → the higher card.
   - Non-numeric deck (T-shirt, non-numeric custom): `average: null`; `mode` = the most-played countable value(s), all of them on a tie.
   - `consensus: true` when there is at least one countable vote and all countable votes are equal.
   - No countable vote → `average: null`, `mode: []`, `consensus: false`.
5. **Re-vote** (`POST tasks/{task}/rounds`): facilitator only, for the current task, only when its latest round is revealed (422 otherwise). Creates the next round; the existing estimate is kept until a new one is set.
6. **Final estimate** (`PUT tasks/{task}/estimate`) (Open decision 2): facilitator only; `value` must be a non-special card of the game's deck; allowed only when the task's latest round is revealed and has at least one countable vote (422 "Reveal the votes before setting an estimate."). Stores `estimate`, `estimate_numeric`, `estimated_at`. `value: null` clears it at any time. The UI preselects `nearestCard` (numeric) or the single mode (non-numeric; none on a tie).

### Settings

- Title (1–120) editable any time the game is not ended.
- Deck (and custom cards) changeable only while the game has no vote at all (422 "The deck can't change once votes exist."), so history always matches its deck.
- Guest access on/off and link regeneration as in the parent spec.
- **End game**: sets `ended_at` and clears `current_task_id`; every mutation except reopen and delete → 403 "This game has ended." **Reopen**: clears `ended_at`.

## 4. Endpoints

Team-scoped (`auth`, `verified`, `w/{workspace}` group with `scopeBindings`, see `routes/web.php`):

| Method | Path | Body / query | Response |
|---|---|---|---|
| POST | `/w/{workspace}/teams/{team}/poker-games` | `{title, deck, customCards?, includeUnknown?, includeCoffee?}` | redirect to the game |
| GET | `/w/{workspace}/teams/{team}/estimates` | `?game=&q=&page=` | Inertia `poker/estimates` |

Game-scoped, prefix `poker/{game}` (`whereUuid`, middleware `ResolvePokerPlayer`, `scopeBindings`):

| Method | Path | Body | Who | Response |
|---|---|---|---|---|
| GET | `/` | — | player | Inertia `poker/show` with snapshot |
| GET | `snapshot` | — | player | snapshot JSON |
| DELETE | `/` | — | facilitator, ws Owner/Admin | 204, `game.deleted` |
| PATCH | `settings` | `{title?, deck?, customCards?, guestAccessEnabled?}` | facilitator | 204, `game.changed` |
| PUT | `status` | `{ended: bool}` | facilitator | 204, `game.changed` |
| POST | `guest-token` | — | facilitator | `{guestUrl}`, `game.changed` |
| PUT | `facilitator` | `{userId}` | facilitator; or a team member with `userId` = self | 204, `game.changed` |
| POST | `tasks` | `{title, description?}` | facilitator, non-guest player | task payload, `task.saved` |
| PATCH | `tasks/{task}` | `{title?, description?}` | same | task payload, `task.saved` |
| DELETE | `tasks/{task}` | — | facilitator | 204, `task.deleted` |
| PUT | `task-order` | `{taskIds: uuid[]}` (all tasks) | facilitator | 204, `tasks.reordered` |
| PUT | `current-task` | `{taskId: uuid\|null}` | facilitator | 204, `round.changed` |
| PUT | `rounds/{round}/vote` | `{value}` | player | `{roundId, myVote, votesCount, version}`, `vote.changed` |
| DELETE | `rounds/{round}/vote` | — | player | same shape, `myVote: null` |
| POST | `rounds/{round}/reveal` | — | facilitator | revealed round payload, `round.changed` |
| POST | `tasks/{task}/rounds` | — | facilitator | new round payload, `round.changed` |
| PUT | `tasks/{task}/estimate` | `{value: string\|null}` | facilitator | task payload, `task.saved` |
| GET | `tasks/{task}/rounds` | — | player | round history (§6) |

Join: `GET /poker/join/{guestToken}` and `POST /poker/join/{guestToken}` (`throttle:10,1`), same behaviour as `RetroJoinsController`; invalid or disabled link → 404 page "This link is no longer valid".

Each mutation: resolve player → authorize → persist in a transaction with `lockForUpdate` on the game row (votes also lock the round row, as `CardVotesController` does) → re-check rules inside the lock → dispatch the event after commit to others. Controllers live in `app/Http/Controllers/Poker/`, actions in `app/Actions/Poker/`, a `PokerGuard` mirrors `RetroGuard` (`facilitator`, `notEnded`, `canEditTasks`, `openRound`).

### Realtime

- Presence channel `presence-poker.{gameId}`; `BroadcastAuthorizationsController` gains a `presence-poker.` branch resolving the player the same way as the page, returning `{id, name, avatarUrl, isGuest}`. No private channel is needed (a player's other tabs refetch, see below). Poker channels accept no whispers in this spec.
- Events extend a new `PokerBroadcastEvent` (same contract as `RetroBroadcastEvent`: `ShouldBroadcastNow`, after commit, `toOthers()`, report-don't-throw):

| Event | Payload | Client reaction |
|---|---|---|
| `task.saved` | task payload | upsert |
| `task.deleted` | `{taskId}` | remove |
| `tasks.reordered` | `{taskIds}` | reorder |
| `vote.changed` | `{roundId, playerId, hasVoted, votesCount, version}` | update face-down card; ignore if `version` ≤ known; refetch when `playerId` is the viewer (own vote from another tab) |
| `round.changed` | `{}` | refetch snapshot (select, reveal, re-vote) |
| `game.changed` | `{}` | refetch snapshot (settings, status, facilitator, guest link) |
| `game.deleted` | `{}` | show "This game was deleted" and link to the team |

- Reveal goes through a refetch like the parent's `PhaseChanged`: values are only ever serialized by the snapshot builder, never pushed in a broadcast.
- On (re)subscription and reconnect the client refetches the snapshot (coalesced, as `use-retro-channel.ts` does); broadcasts received during a refetch are buffered and replayed.
- A player removed from the team (or a signed-out guest) receives 403/401 on the next request and sees the parent's session-ended handling.

## 5. Redaction and privacy

**Invariant: before a round is revealed, no card value of any player other than the viewer leaves the server** — not in the snapshot, the vote endpoints' responses, `vote.changed`, the round history endpoint, the team estimates page, or any log line. This holds for the facilitator too.

| Data | Unrevealed round | Revealed round |
|---|---|---|
| Own vote value | visible to self | visible |
| Others' vote values | never | visible to all players |
| Who has voted | visible (face-down card) (Open decision 7) | visible |
| Vote count | visible | visible |
| Result (average, distribution, mode, consensus) | absent | visible |

- A single `BuildPokerSnapshot` class produces the viewer-specific snapshot; all redaction lives there and in `PresentPokerRound` (used by the snapshot, the reveal/re-vote responses and the round history).
- Rounds that were never revealed (task switched, then deleted or estimated from an earlier round) stay unrevealed forever: history shows "Not revealed · n votes", no values.
- The guest token and guest secrets never appear in payloads; `guestUrl` is included only for non-guest players.
- Markdown descriptions are rendered server-side by `RenderTaskMarkdown` (`Str::markdown` with `html_input: escape`, `allow_unsafe_links: false`, the core `ExternalLinkExtension` adding `rel="noopener noreferrer nofollow"` and `target="_blank"`). Images are rendered as a plain link with the alt text, never as `<img>`, so a description can't make viewers' browsers contact a third-party host. The client inserts only this server-produced HTML.

## 6. Payloads

Snapshot (`GET snapshot` and the Inertia page prop):

```
{
  game: {id, title, deck, deckLabel, cards: string[], isNumeric, facilitatorPlayerId,
         guestAccessEnabled, guestUrl|null, endedAt|null, currentTaskId|null,
         tasksCount, estimatedCount, totalPoints|null},
  me: {playerId, isGuest, isFacilitator, canEditTasks, canTakeControl, canDelete},
  players: [{id, name, avatarUrl, isGuest}],          // everyone who ever joined
  tasks: [{id, title, description, descriptionHtml, position,
           estimate|null, estimatedAt|null, roundsCount, external: null}],
  current: null | {
    taskId,
    round: {id, number, revealedAt|null, version, votesCount,
            votes: [{playerId, value|null}],          // value null for others until reveal
            myVote|null,
            result: null | {average|null, distribution: [{value, count}], mode: string[],
                            consensus, nearestCard|null}}
  }
}
```

- `totalPoints` = sum of `estimate_numeric` of the game's tasks (null when the deck is not numeric).
- Round history (`GET tasks/{task}/rounds`): rounds newest first, each as `round` above (revealed: values and result; unrevealed: `votes: []` and `votesCount` only; `myVote` carries the viewer's own value, never anyone else's).
- Loaded with a constant number of queries regardless of task, round and player counts.

## 7. UI

### Team page (`resources/js/pages/teams/show.tsx`, Open decision 6)

- New "Planning poker" section under Retrospectives: "New game" form (title, default "Poker {date}"; deck select showing each deck with its cards like `screens/poker-systems.png`; custom deck → comma-separated input plus `?`/`☕` checkboxes), then two lists: Active games and Ended games, each row with title, deck, "12 tasks · 9 estimated · 34 points", last activity. Link "Estimation history".

### Game page (`resources/js/pages/poker/show.tsx`, components in `resources/js/components/poker/`)

Layout after `screens/poker-game.png`:

- **Header**: editable title (facilitator), deck label, presence strip (reuses `presence-strip.tsx`), share button (guest link dialog, reusing the retro guest-link UI), facilitator menu (settings, transfer, end/reopen, delete), "Take control" for eligible players, connection banner (reuses `connection-banner.tsx`), "Game ended" badge.
- **Left pane — tasks**: ordered list; each item shows title, first line of description, estimate chip, and on the current task a vote-count badge; current task highlighted. Facilitator selects by clicking, reorders by drag (`@dnd-kit/sortable`). "Add task" opens a form with title and Markdown description (textarea + preview tab using the server-rendered HTML returned on save). Collapsible; on narrow screens it becomes a drawer.
- **Main pane**:
  - Players grid: each online player plus every offline player who voted in the current round (greyed). Card states: empty, face-down (voted), face-up value (revealed). Facilitator marked with a badge.
  - Facilitator toolbar: "Show votes" (disabled with 0 votes), "Re-vote" (after reveal), estimate select + "Save estimate" (after reveal, preselected), "Next task" (selects the next unestimated task by position).
  - Result panel after reveal: average (formatted with `Intl.NumberFormat` in the UI locale) or "Most played: M", distribution bars in deck order, "Consensus" badge.
  - Task detail: title, rendered description, external link placeholder only when `external` is set (never in spec 4), "Rounds" disclosure loading the round history.
  - Hand: the deck's cards along the bottom; the played card is raised; clicking it again withdraws. Disabled when there is no current task, the round is revealed, or the game ended. Keyboard accessible (buttons with `aria-pressed`).
- Empty states: no tasks ("Add the first task"), no current task ("Waiting for the facilitator to pick a task" / facilitator: "Pick a task to start voting").

### Estimation history (`resources/js/pages/poker/estimates.tsx`)

- Team members only. Table of estimated tasks across the team's games, newest `estimated_at` first, 50 per page: task title, game, estimate, rounds, date. Filters: game select, title search (`ILIKE`). A row expands to its revealed rounds (player, value per round, result).

### Join page (`resources/js/pages/poker/join.tsx`)

- Same as `retros/join.tsx`: game title, name field, language switcher; invalid-link state.

### i18n

Every new string (including deck labels, "Show votes", "Re-vote", "Consensus", "Most played", error messages) exists in `lang/{en,fr,es,de}.json`. Card labels (`XS`, `?`, `☕`, numbers) are not translated.

## 8. Error handling

- 403 (not facilitator, guest editing tasks, game ended), 422 (closed round, value not in deck, reveal with no votes, estimate before reveal, deck change with votes, task limit) → translated message, optimistic update rolled back, toast.
- 404 (task or round deleted concurrently) → item removed locally, snapshot refetched.
- Vote after the round was revealed or switched by someone else → 422 + refetch, so the client shows the new state.
- Websocket down → "Reconnecting…" banner; HTTP actions keep working; refetch on reconnect.
- Revoked link / disabled guest access → join page "This link is no longer valid"; an active guest's next request → session-ended page.

## 9. Testing

Pest feature tests in `tests/Feature/Poker/`, `Event::fake()` for broadcasts; unit tests for pure classes.

- **Redaction (main invariant):** with two players having voted in an unrevealed round, the snapshot, round history, estimates page props, vote responses and every `vote.changed` payload seen by the other player *and by the facilitator* contain no value but their own; after reveal all values appear; a never-revealed round never exposes values.
- **Voting rules:** vote only on the current task's latest unrevealed round; replace and withdraw; value must be in the deck (`½`, `☕` accepted where in deck); no player parameter accepted (sending `playerId` has no effect); guests can vote; ended game → 403; concurrent reveal vs vote (vote after reveal → 422).
- **Reveal / re-vote / estimate:** facilitator only; reveal needs ≥ 1 vote; re-vote needs a revealed latest round and keeps old rounds; estimate needs a revealed round with a countable vote, rejects `?`/`☕` and non-deck values, clears with null; `estimate_numeric` null for T-shirt.
- **Results (unit, `PokerResult`, `PokerDeck`):** averages for each numeric deck including `½`; `?`/`☕` excluded; rounding; `nearestCard` ties to higher; T-shirt → no average, mode with ties; consensus; all-special votes; custom deck numeric detection.
- **Tasks:** create/edit by facilitator and members, 403 for guests; delete/reorder facilitator-only; 200-task limit; deleting the current task clears it; client-sent `external*` fields ignored.
- **Markdown:** `<script>` escaped; `javascript:` links dropped; images rendered as links, never `<img>`; external links carry `rel="noopener noreferrer nofollow"`.
- **Access and guests:** team member auto-joins; non-member 403; guest join, cookie resume, regeneration signs guests out, disabled access blocks; guest cannot reach team pages or estimates page; retro guest cookie does not grant poker access and vice versa.
- **Facilitation:** transfer to a team member; take over by a team member; guests can neither.
- **Settings:** deck change blocked once votes exist; end/reopen; delete by facilitator or ws Owner/Admin only.
- **Broadcast auth:** `presence-poker.{id}` authorized for players only, presence data shape; unknown or malformed ids 403.
- **Snapshot:** constant query count as tasks, rounds and players grow.
- **Regression:** existing retro suites untouched and green after the `HasGuestIdentity` / `GuestCookie` extraction.
- **Manual two-browser walkthrough:** member creates a game and tasks, guest joins by link; both vote (face-down cards appear live), reveal, re-vote, estimate; reconnect (toggle network) refetches; ended game is read-only; estimation history lists the task.

## 10. Acceptance criteria

1. A team member can create a game with any of the five decks; the deck's cards are stored with the game; the creator is player and facilitator.
2. Facilitator and non-guest players can add and edit tasks (plain title, Markdown description); only the facilitator deletes, reorders and selects tasks.
3. Any player, including guests and the facilitator, plays exactly one card per round for themselves only, on the current task's latest unrevealed round; they can change or withdraw it until reveal.
4. Before reveal, no response, snapshot or broadcast delivered to any other player (facilitator included) contains another player's card value; who-has-voted and the count are visible.
5. "Show votes" reveals all values at once to every player; the result shows the average (1 decimal, `?`/☕ excluded) and nearest card for numeric decks, or distribution and mode for T-shirt/non-numeric decks, plus consensus.
6. "Re-vote" starts a new round; previous rounds and votes stay visible in the task's round history.
7. The final estimate can be set only by the facilitator, only after the latest round is revealed with a countable vote, and only to a non-special deck card.
8. Guests join via `/poker/join/{token}` without an account; regenerating the link signs them out; disabling guest access blocks them.
9. All changes reach other open browsers within one second locally; reconnecting refetches the snapshot; presence shows online players.
10. Ended games are read-only until reopened; the team page lists active and ended games with task, estimated and point counts; the estimation history page lists estimated tasks with their per-round votes.
11. Task Markdown never renders raw HTML, `javascript:` links or remote images.
12. Tasks have nullable external reference columns, unused and not client-writable in this spec.
13. All new strings are translated in en/fr/es/de; suite, phpstan, type-check and lint are green; the walkthrough passes.

## Open decisions

1. **Player model.** (a) Parallel `poker_players` table + shared `HasGuestIdentity` trait and scoped `GuestCookie` — isolates poker from retro redaction and queries, small duplication of resolution/join code. (b) Generalise `participants` to be polymorphic (`session_type`, `session_id`) — one identity model, but touches every retro query, unique index, policy and test. (c) One workspace-level guest identity reused across sessions — fewer name prompts, but new cross-session tracking and cookie scope. **Recommended: (a).**
2. **Source of the final estimate.** (a) Any non-special deck card, only after reveal, UI preselects nearest card / mode — lets the team settle after discussion (common practice). (b) Only a value someone actually played in the revealed round — strictest reading of "only from revealed votes", but blocks "we agreed on 5 between 3 and 8". (c) Also allow the raw average — non-card estimates break Jira/Linear write-back scales later. **Recommended: (a).**
3. **Who adds and edits tasks.** (a) Facilitator only — QRetro-like (owner controls the game), bottleneck for large backlogs. (b) Facilitator + non-guest players — team members prepare the backlog together; guests can't inject content. (c) Everyone including guests — simplest, but anyone holding the link can add content. **Recommended: (b).**
4. **Absent facilitator.** (a) Transfer only, as in retros — the game stalls when the facilitator is gone. (b) Any non-guest team player can "Take control" — self-service, trust within the team, visible via `game.changed`. (c) Only workspace Owners/Admins can take over — safer, but they are often not in the session. **Recommended: (b).**
5. **Guest access default.** (a) Off, facilitator enables it (same as retros, safer). (b) On at creation — matches QRetro's "share the link" flow, one fewer click. **Recommended: (a)**, for consistency and because the link reveals task descriptions.
6. **Where games live.** (a) Section on the team page + team estimation history page — no new navigation. (b) A workspace-wide "Planning poker" sidebar entry listing games across the user's teams — QRetro parity, more UI to build. **Recommended: (a)**; (b) can come with a future navigation pass.
7. **Show who has voted before reveal.** (a) Yes, face-down cards per player — standard poker UX, helps chase stragglers; reveals participation, not values. (b) Count only — more private, but the facilitator can't see who is missing. **Recommended: (a).**
8. **Reserve external-reference columns now.** (a) Add nullable `external_source/id/url` now, unused — spec 6 needs no migration and payloads already carry `external`. (b) Add them in spec 6 — strict YAGNI, one more migration on a populated table. **Recommended: (a).**
