# Skrum — Planning poker — Design

Date: 2026-09-29
Status: Approved decisions, awaiting spec review
Parent spec: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (tenancy, roles, guests, realtime, redaction, i18n and packaging rules apply unless this spec says otherwise). Latest conventions: `docs/superpowers/specs/2026-09-29-board-engagement-design.md`.
Research: `docs/superpowers/research/qretro/` (QRetro parity roadmap, spec 4 of 8; `research.md` § Planning poker, `docs-inventory.md` § Planning poker, `screens/poker-game.png`, `screens/poker-systems.png`)

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
- Scope additions (Decision 9, §3a–§3d): voting timer and facilitator-controlled auto-reveal; spectator role; anonymous (unnamed) reveal; saved custom decks per team; live cursors and flying reactions in the game, reusing spec 1.

### Out of scope (deferred)

- Jira/Linear import and estimate write-back, `needs_sync` flag (spec 6). MCP `poker.*` tools (spec 5).
- CSV export, velocity charts.
- Any LLM-generated content (nothing in this spec needs it).
- Per-task (persisted) emoji reactions and comments in poker; the reactions here are the ephemeral flying ones only.

### Dependencies

- None new. Markdown is rendered with `league/commonmark`, already installed as a Laravel dependency (`Str::markdown`). Drag-and-drop reordering reuses `@dnd-kit/*`. Cursors and reactions reuse `live-cursors` / `live-reactions` and the emoji picker (`frimousse`) already approved and installed by spec 1.
- Scope additions build on: spec 1's whisper transport and layers (`resources/js/lib/retro/whisper-transport.ts`, `resources/js/components/retro/live-cursor-layer.tsx`, `flying-reactions.tsx`, `emoji-picker.tsx`) and `config/reverb.php` (`accept_client_events_from: 'members'`, already set); the retro timer UI (`resources/js/components/retro/timer-control.tsx`, `timer-display.tsx`) and rule shape (`app/Http/Controllers/Retros/RetroTimersController.php`); Reverb's Pusher HTTP API channel-users endpoint (`vendor/laravel/reverb/src/Protocols/Pusher/Http/Controllers/ChannelUsersController.php`), reached through the Pusher client of the `reverb` broadcaster; the queue worker (`docker/s6-rc.d/queue`, `QUEUE_CONNECTION=database`).
- Builds on: guest join and cookie (`app/Http/Controllers/RetroJoinsController.php`, `app/Actions/Retros/GuestCookie.php`), participant resolution (`app/Actions/Retros/ResolveParticipant.php`, `app/Http/Middleware/ResolveRetroParticipant.php`), channel auth (`app/Http/Controllers/BroadcastAuthorizationsController.php`), broadcast base (`app/Events/Retros/RetroBroadcastEvent.php`), vote locking (`app/Http/Controllers/Retros/CardVotesController.php`), realtime hook (`resources/js/hooks/use-retro-channel.ts`), avatars (`Participant::avatarSeed()`), team page (`app/Http/Controllers/TeamsController.php`, `resources/js/pages/teams/show.tsx`), team policy (`app/Policies/TeamPolicy.php`).

## 2. Data model

### Player identity: a parallel `poker_players` table (Decision 1)

`participants` has a non-null `retro_id`, a unique (`retro_id`, `user_id`), a per-retro guest cookie and is referenced by cards, votes, comments and action items. Poker gets its own table with the same shape rather than a polymorphic participant, so no retro query, policy or redaction test changes. Shared behaviour is extracted, not duplicated:

- `app/Concerns/HasGuestIdentity` (trait) — `isGuest()`, `displayName()` ("Former member" fallback), `avatarSeed()`, `avatarUrl()`; used by `Participant` and `PokerPlayer`. Existing retro behaviour is unchanged (same seed formula: user id for members, row id for guests).
- `GuestCookie` gains a scope argument: `GuestCookie::name('retro', $id)` → `retro_guest_{id}` (unchanged), `GuestCookie::name('poker', $id)` → `poker_guest_{id}`.

### Tables

- **poker_games**: `id` (UUID), `team_id` (cascade), `title` (string 120), `deck` (enum `PokerDeck`: `fibonacci`, `modified_fibonacci`, `tshirt`, `powers_of_two`, `custom`), `cards` (json array of strings — the deck copied at creation so later code changes never alter history), `facilitator_player_id` (nullable FK → poker_players, set after the creator's player row exists, `nullOnDelete`), `current_task_id` (nullable FK → poker_tasks, `nullOnDelete`), `guest_access_enabled` (bool, default `false`), `guest_token` (unique string 40), `ended_at` (nullable timestamp), timestamps. Index (`team_id`, `ended_at`). Scope additions: `deck_name` (nullable string 40 — the saved deck's name copied at creation or deck change, §3d), `auto_reveal` (bool, default `false`), `anonymous_votes` (bool, default `false`), `cursors_enabled` (bool, default `true`), `reactions_enabled` (bool, default `true`).
- **poker_players**: `id`, `poker_game_id` (cascade), `user_id` (nullable, `nullOnDelete`), `guest_name` (nullable string 50), `guest_secret_hash` (nullable string 64), `is_spectator` (bool, default `false`), timestamps. Unique (`poker_game_id`, `user_id`).
- **poker_tasks**: `id`, `poker_game_id` (cascade), `title` (string 200), `description` (nullable text, Markdown, ≤ 10 000 characters), `position` (int), `estimate` (nullable string 8 — a deck card label), `estimate_numeric` (nullable decimal(8,2) — the card's numeric value, null for non-numeric cards), `estimated_at` (nullable timestamp), `external_source` (nullable string 20), `external_id` (nullable string 100), `external_url` (nullable string 2048), timestamps. Unique (`poker_game_id`, `external_source`, `external_id`). Index (`poker_game_id`, `position`).
- **poker_rounds**: `id`, `poker_task_id` (cascade), `number` (int, 1-based per task), `revealed_at` (nullable timestamp), `version` (unsigned int, default 0 — incremented on every vote change, orders `vote.changed` events like `retros.votes_version`), `anonymous` (bool, default `false`, §3c), `timer_ends_at` (nullable timestamp, §3b), `reveal_reason` (nullable string, enum `PokerRevealReason`: `manual`, `everyone_voted`, `timer`; set with `revealed_at`), timestamps. Unique (`poker_task_id`, `number`).
- **poker_votes**: `id`, `poker_round_id` (cascade), `poker_player_id` (cascade), `value` (string 8 — a card label), timestamps. Unique (`poker_round_id`, `poker_player_id`).
- **poker_decks** (saved custom decks, §3d): `id` (UUID), `team_id` (cascade), `name` (string 40), `cards` (json array of strings), `created_by_user_id` (nullable FK → users, `nullOnDelete`), timestamps. Unique index on (`team_id`, `lower(name)`) (PostgreSQL expression index). No FK from games: games copy `cards` and `deck_name`, so editing or deleting a saved deck never changes a game or its history.

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
- **External reference** columns exist so spec 6 can import and write back without a migration on a live table; spec 4 never writes them, validation rejects them from clients, and task payloads carry `external: null` or `{source, id, url}`. Spec 6 adds the remaining sync columns in its own migration (`external_site`, `external_key`, `external_assignee`, `external_estimate`, `external_refreshed_at`, `needs_sync`, `sync_error`, `synced_at`, spec 6 §3) and extends the `external` payload (spec 6 §6.6); spec 8 adds `external_status_name`, `external_status_category`, `external_updated_at`, `external_missing_at`, the `external_source` values `jira_dc` and `github` (spec 8 §3), and the payload fields `status`, `statusCategory`, `missing`, `estimateConflict`, `syncMode` (spec 8 §7).
- **Game ended** (`ended_at` set) is read-only for everyone except "Reopen" and "Delete" (§3).
- **Anonymity is a round property**: `poker_rounds.anonymous` is copied from `poker_games.anonymous_votes` when the round is created, so switching the game setting off never de-anonymizes a round that was voted under anonymity (§3c).
- **Deck label**: `deckLabel` = `deck_name` when set (saved deck), otherwise the translated `PokerDeck::label()`.

## 3. Roles and rules

### Access

- **Create a game**: any user who can view the team (`TeamPolicy::createPokerGame` = `view`). The creator becomes a player and the facilitator.
- **Enter a game** (`/poker/{game}`): a user who can view the game's team joins as themselves (player row created on first visit, as `ResolveParticipant` does); otherwise a guest with a valid `poker_guest_{id}` cookie while `guest_access_enabled`. Anyone else: logged out → login (or a "session ended" page when guest access is on, mirroring `ResolveRetroParticipant::sendToLogin`); logged in non-member → 403.
- **Guests** join via `/poker/join/{guestToken}` with a display name (1–50). Regenerating the token revokes old links and signs out every guest (secrets cleared; names and votes stay). A logged-in non-member following the link joins as a guest with their name prefilled. Guests never see team or workspace pages.
- **Delete a game**: the facilitator, or a workspace Owner/Admin.

### Facilitator

Initially the creator. Facilitator-only actions: select the current task, reveal, re-vote, set/clear the estimate, delete or reorder tasks, change settings (title, deck, guest access, auto-reveal, anonymous votes, live cursors, flying reactions), set/clear the voting timer, switch another player to or from spectator, regenerate the guest link, end/reopen the game.

- **Transfer**: the facilitator hands over to any team member (or workspace Owner/Admin, added as a player if needed). Guests never facilitate.
- **Take over** (Decision 4): any non-guest player who can view the team may make themselves facilitator at any time ("Take control"). Poker sessions span days and a missing facilitator would otherwise freeze the game; the retro rule (transfer only) stays unchanged.

### Tasks (Decision 3)

- Add and edit (title, description): the facilitator and any non-guest player. Guests cannot add or edit tasks.
- Delete and reorder: facilitator only. Deleting a task deletes its rounds and votes; deleting the current task clears `current_task_id`.
- At most 200 tasks per game (422 beyond). New tasks are appended (position = max + 1).
- Allowed while the game is not ended; the title and description of a task can be edited in any round state, except for tasks imported by spec 6, whose title and description are read-only (spec 6 §6.4).
- Spec 6 adds two more ways to add or update tasks, for the same people (facilitator and non-guest players, game not ended): importing issues from a connected tracker and refreshing imported tasks from their source (spec 6 §6.3–6.4; spec 8 §5.7 refreshes them automatically when status sync is on). The `external_*` columns are written only by these paths, never by clients.

### Voting flow

1. **Select** (`PUT current-task`): the facilitator sets `current_task_id` (or `null`). If the task has no round, round 1 is created. Selecting a task whose latest round is unrevealed resumes that round (its hidden votes are kept). Selecting an estimated task shows its latest round; a new vote requires "Re-vote".
2. **Vote** (`PUT rounds/{round}/vote`): any non-spectator player (members, guests, the facilitator) plays one card from `game.cards` on the latest, unrevealed round of the *current* task. Playing again replaces the value; `DELETE` withdraws it. The player is always the requester: the endpoint takes no player parameter, so nobody can vote for someone else. Votes on a revealed round, a non-latest round, or a round of a task that is not current → 422 "Voting is closed for this round." Value not in the deck → 422. A spectator voting → 403 "Spectators can't vote." (§3a). After the vote is committed, the auto-reveal check of §3b runs.
3. **Reveal** (`POST rounds/{round}/reveal`): facilitator only, on the current task's latest unrevealed round with at least one vote (422 otherwise). Sets `revealed_at` and `reveal_reason = manual`. From then on the round is frozen. `RevealPokerRound` takes the reason, so the automatic reveals of §3b go through the same action.
4. **Result**, computed server-side by `PokerResult::for(round)` from countable votes (all except `?` and `☕`):
   - `distribution`: `[{value, count}]` for every played value including `?`/`☕`, in deck order.
   - Numeric deck: `average` = mean of countable values, rounded half-up to 1 decimal; `nearestCard` = the numeric card with the smallest distance to the average, ties → the higher card.
   - Non-numeric deck (T-shirt, non-numeric custom): `average: null`; `mode` = the most-played countable value(s), all of them on a tie.
   - `consensus: true` when there is at least one countable vote and all countable votes are equal.
   - No countable vote → `average: null`, `mode: []`, `consensus: false`.
5. **Re-vote** (`POST tasks/{task}/rounds`): facilitator only, for the current task, only when its latest round is revealed (422 otherwise). Creates the next round (`anonymous` copied from the game, no timer); the existing estimate is kept until a new one is set. Round 1 created by "Select" takes `anonymous` from the game the same way.
6. **Final estimate** (`PUT tasks/{task}/estimate`) (Decision 2): facilitator only; `value` must be a non-special card of the game's deck; allowed only when the task's latest round is revealed and has at least one countable vote (422 "Reveal the votes before setting an estimate."). Stores `estimate`, `estimate_numeric`, `estimated_at`. `value: null` clears it at any time. The UI preselects `nearestCard` (numeric) or the single mode (non-numeric; none on a tie). Spec 6 dispatches the tracker write-back from this action for imported tasks (spec 6 §6.5); spec 5's `poker.game.task.reveal` chains reveal and this action with the same preselection rule. After commit, `SetPokerEstimate` dispatches the plain (non-broadcast) event `PokerTaskEstimated` (`task`) when the estimate is set or changed to a card, never when it is cleared; this spec adds no listener (spec 8 §4.7 subscribes it for generic-webhook events). Spec 8's "Use :source estimate" conflict resolution goes through `SetPokerEstimate` with the same validation, event and broadcasts.

### Settings

- Title (1–120) editable any time the game is not ended.
- Deck (and custom cards) changeable only while the game has no vote at all (422 "The deck can't change once votes exist."), so history always matches its deck.
- Guest access on/off and link regeneration as in the parent spec.
- Auto-reveal (§3b), anonymous votes (§3c), live cursors and flying reactions (§4 "Live cursors and flying reactions") are switches changeable any time the game is not ended; `anonymous_votes` and `auto_reveal` can also be set in the creation form.
- **End game**: sets `ended_at` and clears `current_task_id`; every mutation except reopen and delete → 403 "This game has ended." A running timer is left as stored but has no effect (no current task). **Reopen**: clears `ended_at`.

### 3a. Spectators

- A spectator is a player with `is_spectator = true`: they join, appear in presence, see the whole table (tasks, face-down cards, reveal, results, round history) exactly as a player does, and cannot vote. Every other right is unchanged: a non-guest spectator still adds and edits tasks, and a spectating facilitator still facilitates.
- **Who switches** (scope decision 4): each player switches themselves ("Watch only" / "Play"); the facilitator can switch any player, guests included. Allowed while the game is not ended.
- **Joining as spectator**: the guest join form has a "Join as spectator" checkbox (unchecked by default) stored on the new player row; members toggle after entering. Resumed guests keep their stored role.
- **Switching to spectator withdraws the player's votes in every unrevealed round of the game** (the open round and any round left unrevealed on another task), incrementing each affected round's `version`, so a spectator never holds a vote. Revealed rounds are history and keep their votes. Switching back to player allows voting again on the open round.
- Spectators are excluded from the players grid's card slots and from the "everyone has voted" set (§3b); they are listed in a "Watching" row.
- Vote endpoints: a spectator → 403 "Spectators can't vote." (re-checked inside the round lock, so a switch racing a vote never leaves a spectator's vote behind).

### 3b. Voting timer and auto-reveal

- **Timer** (`PUT rounds/{round}/timer`, `{seconds: 10–3600 | null}`): facilitator only, on the current task's latest unrevealed round (422 "Voting is closed for this round." otherwise). Stores `poker_rounds.timer_ends_at = now + seconds` (null clears). Only the end time is stored; clients render the countdown locally (as the retro timer). A new round starts without a timer; a reveal leaves `timer_ends_at` untouched but the countdown is no longer shown.
- **Auto-reveal** (`poker_games.auto_reveal`, facilitator switch, off by default): when on, the open round is revealed automatically when either condition holds:
  1. **Everyone has voted**: the set *E* of online non-spectator players is non-empty and every player in *E* has a vote in the round. "Online" means present on `presence-poker.{gameId}` according to Reverb (the channel-users endpoint returns presence ids, which are player ids, deduplicated across tabs); *E* = those ids ∩ the game's players with `is_spectator = false`. Offline players are not waited for; a vote cast by a player who has since gone offline still counts. Reason `everyone_voted`.
  2. **The timer ended** (`timer_ends_at ≤ now`) and the round has at least one vote. Reason `timer`. With auto-reveal off, the end of the timer only shows "Time's up" and plays the soft sound (scope decision 1).
- A round with no vote is never auto-revealed (same rule as the manual reveal).
- **The check** is one action, `AutoRevealPokerRound(round)`: it reads the Reverb roster first, outside any lock (`PokerPresenceRoster` interface; `ReverbPokerPresenceRoster` calls `GET /channels/presence-poker.{id}/users` with a 2 s timeout and returns `null` on any failure), then, inside a transaction with `lockForUpdate` on the game and the round, re-checks: game not ended, `auto_reveal` on, round is the latest round of the current task, unrevealed, ≥ 1 vote, and condition 1 or 2. If they hold it calls `RevealPokerRound` with the reason. A `null` roster disables condition 1 for that check only (logged as a warning with the game id, no player data); condition 2 is still evaluated.
- **Triggers**: after a vote is cast (inline, after commit); after a player switches to spectator; when the facilitator turns `auto_reveal` on; a queued job `RevealPokerRoundOnTimer` dispatched after commit with a delay to `timer_ends_at` whenever a timer is set (it no-ops when the timer was changed or cleared since, i.e. `timer_ends_at` > now or null); and `POST rounds/{round}/auto-reveal`, which any player may call, because the server re-checks every condition. The facilitator's client calls it (debounced 2 s) when a presence member leaves during an open round with auto-reveal on, and when the countdown reaches zero (fallback for a delayed queue). Withdrawing a vote never triggers a reveal.
- The reveal is broadcast as `round.changed` to every client (the job and the endpoint have no socket id; the vote endpoint answers `revealed: true` to the voter, whose client refetches). The result panel shows "Revealed automatically — everyone voted" or "— time's up" from `revealReason`.
- MCP's `poker.game.task.reveal` on a round already auto-revealed answers "These cards are already revealed." (spec 5 rule, unchanged). Auto-reveal never sets the estimate.

### 3c. Anonymous (unnamed) reveal

- **Setting** `anonymous_votes` (facilitator; creation form checkbox "Anonymous votes"). Each round copies it at creation into `poker_rounds.anonymous` (scope decision 3):
  - Turning it **on** also marks every unrevealed round of the game `anonymous = true` (more privacy is always safe).
  - Turning it **off** applies to rounds created afterwards; existing rounds, revealed or not, stay anonymous forever. The settings dialog says "Applies from the next round."
- **Anonymous round, after reveal**: every player sees the values and the result (distribution, average or mode, nearest card, consensus), and who took part (face-down "voted" marks), but never which player played which value. Each player still sees their own value (`myVote`).
- **Redaction** (in `PresentPokerRound`, the only place that serializes votes): for an anonymous round, others' `votes[].value` stays `null` after reveal exactly as before reveal; values reach clients only through `result.distribution`. This holds in the snapshot, the reveal and re-vote responses, the round history, the team estimation history page, `vote.changed`, MCP (`poker.game.get`, `poker.game.tasks.list`, `poker.game.task.reveal`, §11) and log lines — for the facilitator too. No payload orders voters and values the same way (the distribution is in deck order, voters in player order).
- Inherent limit, stated in the settings dialog help: with two voters, each can deduce the other's value from their own; with one voter, the value is theirs. Nothing else links a value to a person.
- Who has voted stays visible before and after reveal (Decision 7).

### 3d. Saved custom decks (per team)

- A team keeps up to 30 saved decks (`poker_decks`, 422 "This team already has 30 saved decks."). Name 1–40 characters after trimming, unique per team case-insensitively (422 "A deck with this name already exists."). Cards follow the custom-deck rule (2–20, 1–8 characters each, unique, in order); the form's `?` / `☕` checkboxes append them before saving, so the saved list is the exact deck.
- **Permissions** (`PokerDeckPolicy`, scope decision 5): any user who can view the team lists, uses and creates saved decks; the deck's creator or a workspace Owner/Admin renames, edits or deletes it. Guests never see saved decks.
- **Use**: the creation form and the game settings dialog (deck change, still only while the game has no vote) offer saved decks next to the built-in ones. Choosing one sets `deck = custom`, copies `cards`, and sets `deck_name` = the saved name. A saved deck of another team → 422. Choosing a built-in deck or plain custom cards clears `deck_name`.
- **Save while creating**: a "Save this deck for the team as…" field under the custom cards input creates the saved deck in the same transaction as the game (validation of both first; nothing is created on a 422).
- Editing or deleting a saved deck never changes a game (cards and name were copied).

## 4. Endpoints

Team-scoped (`auth`, `verified`, `w/{workspace}` group with `scopeBindings`, see `routes/web.php`):

| Method | Path | Body / query | Response |
|---|---|---|---|
| POST | `/w/{workspace}/teams/{team}/poker-games` | `{title, deck, customCards?, includeUnknown?, includeCoffee?, savedDeckId?, saveDeckAs?, anonymousVotes?, autoReveal?}` | redirect to the game |
| GET | `/w/{workspace}/teams/{team}/estimates` | `?game=&q=&page=` | Inertia `poker/estimates` |
| POST | `/w/{workspace}/teams/{team}/poker-decks` | `{name, cards, includeUnknown?, includeCoffee?}` | back, with the list in the team page props |
| PATCH | `/w/{workspace}/teams/{team}/poker-decks/{deck}` | `{name?, cards?, includeUnknown?, includeCoffee?}` | back (creator, workspace Owner/Admin) |
| DELETE | `/w/{workspace}/teams/{team}/poker-decks/{deck}` | — | back (creator, workspace Owner/Admin) |

`savedDeckId` and `customCards` are mutually exclusive (422); `saveDeckAs` requires `customCards`. The team page props gain `pokerDecks: [{id, name, cards, canManage}]`.

Game-scoped, prefix `poker/{game}` (`whereUuid`, middleware `ResolvePokerPlayer`, `scopeBindings`):

| Method | Path | Body | Who | Response |
|---|---|---|---|---|
| GET | `/` | — | player | Inertia `poker/show` with snapshot |
| GET | `snapshot` | — | player | snapshot JSON |
| DELETE | `/` | — | facilitator, workspace Owner/Admin | 204, `game.deleted` |
| PATCH | `settings` | `{title?, deck?, customCards?, savedDeckId?, guestAccessEnabled?, autoReveal?, anonymousVotes?, cursorsEnabled?, reactionsEnabled?}` | facilitator | 204, `game.changed` |
| GET | `saved-decks` | — | facilitator (non-guest by construction) | `[{id, name, cards}]` of the game's team |
| PUT | `players/{player}/spectator` | `{spectator: bool}` | the player themselves, or the facilitator | 204, `game.changed` |
| PUT | `rounds/{round}/timer` | `{seconds: int\|null}` (10–3600) | facilitator | `{timerEndsAt\|null}`, `timer.changed` |
| POST | `rounds/{round}/auto-reveal` | — | player | `{revealed: bool}`; `round.changed` when revealed |
| PUT | `status` | `{ended: bool}` | facilitator | 204, `game.changed` |
| POST | `guest-token` | — | facilitator | `{guestUrl}`, `game.changed` |
| PUT | `facilitator` | `{userId}` | facilitator; or a team member with `userId` = self | 204, `game.changed` |
| POST | `tasks` | `{title, description?}` | facilitator, non-guest player | task payload, `task.saved` |
| PATCH | `tasks/{task}` | `{title?, description?}` | same | task payload, `task.saved` |
| DELETE | `tasks/{task}` | — | facilitator | 204, `task.deleted` |
| PUT | `task-order` | `{taskIds: uuid[]}` (all tasks) | facilitator | 204, `tasks.reordered` |
| PUT | `current-task` | `{taskId: uuid\|null}` | facilitator | 204, `round.changed` |
| PUT | `rounds/{round}/vote` | `{value}` | non-spectator player | `{roundId, myVote, votesCount, version, revealed}`, `vote.changed` (+ `round.changed` when the auto-reveal check revealed it) |
| DELETE | `rounds/{round}/vote` | — | player | same shape, `myVote: null`, `revealed: false` |
| POST | `rounds/{round}/reveal` | — | facilitator | revealed round payload, `round.changed` |
| POST | `tasks/{task}/rounds` | — | facilitator | new round payload, `round.changed` |
| PUT | `tasks/{task}/estimate` | `{value: string\|null}` | facilitator | task payload, `task.saved` |
| GET | `tasks/{task}/rounds` | — | player | round history (§6) |

Join: `GET /poker/join/{guestToken}` and `POST /poker/join/{guestToken}` (`{name, spectator?}`, `throttle:10,1`), same behaviour as `RetroJoinsController`; invalid or disabled link → 404 page "This link is no longer valid".

Each mutation: resolve player → authorize → persist in a transaction with `lockForUpdate` on the game row (votes also lock the round row, as `CardVotesController` does) → re-check rules inside the lock → dispatch the event after commit to others. Controllers live in `app/Http/Controllers/Poker/`, actions in `app/Actions/Poker/` (among them `CreatePokerGame`, `AddPokerTask`, `SelectPokerTask`, `RevealPokerRound`, `SetPokerEstimate`, `AutoRevealPokerRound`, `SetPokerSpectator`, which the MCP tools of spec 5 and the imports of spec 6 reuse), a `PokerGuard` mirrors `RetroGuard` (`facilitator`, `notEnded`, `canEditTasks`, `openRound`, `canVote`). Saved decks: `app/Http/Controllers/PokerDecksController.php` (team-scoped, beside `TeamRetrosController`), `app/Policies/PokerDeckPolicy.php`.

### Realtime

- Presence channel `presence-poker.{gameId}`; `BroadcastAuthorizationsController` gains a `presence-poker.` branch resolving the player the same way as the page, returning `{id, name, avatarUrl, isGuest}` (presence id = player id). The spectator flag is not in the presence data (it changes during the session); clients read it from the snapshot. No private channel is needed (a player's other tabs refetch, see below). The poker presence channel carries exactly two client events (whispers), `cursor` and `reaction` (see "Live cursors and flying reactions" below); Reverb already accepts client events from presence members only (`config/reverb.php`).
- Events extend a new `PokerBroadcastEvent` (same contract as `RetroBroadcastEvent`: `ShouldBroadcastNow`, after commit, `toOthers()`, report-don't-throw):

| Event | Payload | Client reaction |
|---|---|---|
| `task.saved` | task payload | upsert |
| `task.deleted` | `{taskId}` | remove |
| `tasks.reordered` | `{taskIds}` | reorder |
| `vote.changed` | `{roundId, playerId, hasVoted, votesCount, version}` | update face-down card; ignore if `version` ≤ known; refetch when `playerId` is the viewer (own vote from another tab) |
| `round.changed` | `{}` | refetch snapshot (select, reveal — manual or automatic —, re-vote) |
| `timer.changed` | `{roundId, timerEndsAt\|null}` | start, restart or clear the countdown |
| `game.changed` | `{}` | refetch snapshot (settings, status, facilitator, guest link) |
| `game.deleted` | `{}` | show "This game was deleted" and link to the team |

- Reveal goes through a refetch like the parent's `PhaseChanged`: values are only ever serialized by the snapshot builder, never pushed in a broadcast.
- On (re)subscription and reconnect the client refetches the snapshot (coalesced, as `use-retro-channel.ts` does); broadcasts received during a refetch are buffered and replayed.
- A player removed from the team (or a signed-out guest) receives 403/401 on the next request and sees the parent's session-ended handling.
- `game.changed` also covers spectator switches and the new settings (auto-reveal, anonymous votes, cursors, reactions).

### Live cursors and flying reactions (reusing spec 1)

Same transport, identity and abuse rules as spec 1 §3, on `presence-poker.{gameId}` instead of `presence-retro.{retroId}`:

- **Transport**: `whisperTransport` with event names `cursor` and `reaction`; the sender id is Reverb's stamped presence `user_id` (the player id), never the payload. `usePokerChannel` exposes the joined presence channel so it is not joined twice. Nothing is persisted; the server never processes these messages.
- **Receive checks**: sender must be in the current presence roster (`here` / `joining`, minus `leaving`); reactions must pass the client-side single-emoji check and the per-sender token bucket (burst 5, 2/s); failures are dropped silently.
- **Shared code**: the board-agnostic parts of spec 1's layers move to `resources/js/lib/realtime/whisper-transport.ts` and `resources/js/components/realtime/` (`live-cursors.tsx`, `flying-reactions.tsx`, taking `presence`, `container`, `enabled`, `hidden`, `labelFor(senderId)`, `originFor(senderId)` as props). The retro components become thin wrappers over them with unchanged behaviour; poker adds `resources/js/components/poker/game-cursors.tsx` and `game-reactions.tsx`.
- **Cursors**: coordinates in `elementSpace(mainPane)` (the game's main pane scroll container); mouse via the library, touch and pen via spec 1's own sender; 40 ms throttle; TTL 3 s; removed on `leaving`; at most 50. Label = player display name; colour hashed from the player id. Spectators send and see cursors like players.
- **Hidden while votes are hidden** (scope decision 6): no cursor is sent or shown while the current task's latest round is open (unrevealed). The hand of cards sits at a fixed place on the screen, so a named pointer hovering or clicking a card would disclose that player's value before reveal — the same reasoning that makes spec 1 hide cursors during `Voting`. Cursors show when there is no current task and after reveal (the hand is disabled), and never on an ended game (read-only, like `Completed`). The switch happens on the snapshot refetch after `round.changed`; the layer unmounts and sends a leave message.
- **"Hide my cursor"**: switch in the game header, same `localStorage` key `skrum.hideMyCursor` as the retro board (one preference for the person across rooms).
- **Flying reactions**: bar with the six quick emoji plus `+` (the self-hosted `frimousse` picker of spec 1 §3a), bottom-centre of the main pane; rise from above the sender's avatar in the presence strip (random point near the centre when unknown). Allowed for players and spectators, in every round state including open rounds (an emoji carries no card value), never on an ended game. `prefers-reduced-motion` → fade in place.
- **Per-game toggles**: `cursors_enabled` off unmounts the cursor layer for everyone; `reactions_enabled` off hides the bar for everyone and drops incoming reactions. Changed through `PATCH settings` (facilitator), broadcast `game.changed`.
- Anonymous rounds need no extra rule: cursors are already hidden while any round is open, and neither cursors nor reactions ever carry a value.

## 5. Redaction and privacy

**Invariant: before a round is revealed, no card value of any player other than the viewer leaves the server** — not in the snapshot, the vote endpoints' responses, `vote.changed`, the round history endpoint, the team estimates page, or any log line. This holds for the facilitator too.

| Data | Unrevealed round | Revealed round | Revealed anonymous round (§3c) |
|---|---|---|---|
| Own vote value | visible to self | visible | visible to self |
| Others' vote values linked to a player | never | visible to all players | never |
| Values without player (distribution) | never | visible | visible |
| Who has voted | visible (face-down card) (Decision 7) | visible | visible |
| Vote count | visible | visible | visible |
| Result (average, distribution, mode, consensus) | absent | visible | visible |

Spectators see exactly what players see. Timer end time, reveal reason, the spectator flag and the anonymity flag are visible to every player.

- **Second invariant (scope additions): in an anonymous round, no card value of another player is ever linked to that player** — before or after reveal, in every surface listed above and in MCP (§11).
- The Reverb roster read by `AutoRevealPokerRound` stays server-side; no payload says who was waited for.
- Cursors and flying reactions are whispers between presence members only, never persisted or logged; cursors are not sent while a round is open (§4), so a pointer cannot disclose a hidden card.
- Saved decks are visible to the team's members only, never to guests (not in the game snapshot; `GET saved-decks` is facilitator-only and guests never facilitate).

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
         tasksCount, estimatedCount, totalPoints|null,
         autoReveal, anonymousVotes, cursorsEnabled, reactionsEnabled},
  me: {playerId, isGuest, isFacilitator, isSpectator, canVote, canEditTasks,
       canTakeControl, canDelete},
  players: [{id, name, avatarUrl, isGuest, isSpectator}],   // everyone who ever joined
  tasks: [{id, title, description, descriptionHtml, position,
           estimate|null, estimatedAt|null, roundsCount,
           external: null}],   // always null in this spec; spec 6 §6.6 and spec 8 §7 define the object
  current: null | {
    taskId,
    round: {id, number, anonymous, revealedAt|null, revealReason|null, timerEndsAt|null,
            version, votesCount,
            votes: [{playerId, value|null}],   // value null for others until reveal,
                                               // and forever on an anonymous round
            myVote|null,
            result: null | {average|null, distribution: [{value, count}], mode: string[],
                            consensus, nearestCard|null}}
  }
}
```

- `canVote` = not a spectator; the hand also needs an open round of the current task and a game not ended.

- `totalPoints` = sum of `estimate_numeric` of the game's tasks (null when the deck is not numeric).
- Round history (`GET tasks/{task}/rounds`): rounds newest first, each as `round` above (revealed: values and result, except anonymous rounds whose `votes` carry `playerId` with `value: null` and whose values appear only in `result.distribution`; unrevealed: `votes: []` and `votesCount` only; `myVote` carries the viewer's own value, never anyone else's).
- Loaded with a constant number of queries regardless of task, round and player counts.

## 7. UI

### Team page (`resources/js/pages/teams/show.tsx`, Decision 6)

- New "Planning poker" section under Retrospectives: "New game" form (title, default "Poker {date}"; deck select showing each deck with its cards like `screens/poker-systems.png`; custom deck → comma-separated input plus `?`/`☕` checkboxes and an optional "Save this deck for the team as…" name; the team's saved decks listed after the built-in ones with their cards; "Anonymous votes" and "Reveal automatically" checkboxes), then two lists: Active games and Ended games, each row with title, deck, "12 tasks · 9 estimated · 34 points", last activity. Link "Estimation history". A "Saved decks" dialog lists the team's decks (name, cards) with create, and edit/delete where `canManage`.

### Game page (`resources/js/pages/poker/show.tsx`, components in `resources/js/components/poker/`)

Layout after `screens/poker-game.png`:

- **Header**: editable title (facilitator), deck label, presence strip (reuses `presence-strip.tsx`; spectators carry an eye badge), share button (guest link dialog, reusing the retro guest-link UI), "Watch only" / "Play" toggle for the viewer, "Hide my cursor" switch, facilitator menu (settings, transfer, end/reopen, delete), "Take control" for eligible players, connection banner (reuses `connection-banner.tsx`), "Game ended" badge, "Anonymous votes" and "Auto-reveal" badges when on.
- **Settings dialog** (facilitator): title, deck (built-in, saved decks from `GET saved-decks`, custom; disabled once votes exist), guest access, and switches "Reveal automatically when everyone has voted or the timer ends", "Anonymous votes" (help text: "Applies from the next round" when turning off; the two-voter limit of §3c), "Show live cursors", "Show flying reactions".
- **Left pane — tasks**: ordered list; each item shows title, first line of description, estimate chip, and on the current task a vote-count badge; current task highlighted. Facilitator selects by clicking, reorders by drag (`@dnd-kit/sortable`). "Add task" opens a form with title and Markdown description (textarea + preview tab using the server-rendered HTML returned on save). Collapsible; on narrow screens it becomes a drawer.
- **Main pane**:
  - Players grid: each online non-spectator player plus every offline player who voted in the current round (greyed). Card states: empty, face-down (voted), face-up value (revealed). Facilitator marked with a badge. On an anonymous round the players' cards stay face-down with a "voted" check after reveal, and a separate row shows the revealed values face-up in deck order ("Anonymous votes"). A "Watching" row lists online spectators (avatar and name, no card slot).
  - Facilitator toolbar: "Show votes" (disabled with 0 votes), "Timer" (reuses `timer-control.tsx`: presets 30 s, 1, 2, 3 min and custom minutes; clear), "Re-vote" (after reveal), estimate select + "Save estimate" (after reveal, preselected), "Next task" (selects the next unestimated task by position).
  - Countdown (reuses `timer-display.tsx`) for everyone while the round is open and a timer is set; at zero a soft sound and "Time's up" (plus the auto-reveal when on).
  - Result panel after reveal: average (formatted with `Intl.NumberFormat` in the UI locale) or "Most played: M", distribution bars in deck order, "Consensus" badge, and "Revealed automatically — everyone voted" / "— time's up" when `revealReason` is not `manual`.
  - Live cursor layer over the main pane and the flying reactions bar (§4), per the toggles and the open-round rule.
  - Task detail: title, rendered description, external link placeholder only when `external` is set (never in spec 4), "Rounds" disclosure loading the round history.
  - Hand: the deck's cards along the bottom; the played card is raised; clicking it again withdraws. Disabled when there is no current task, the round is revealed, or the game ended; replaced by "You're watching — switch to Play to vote" for spectators. Keyboard accessible (buttons with `aria-pressed`).
- Empty states: no tasks ("Add the first task"), no current task ("Waiting for the facilitator to pick a task" / facilitator: "Pick a task to start voting").

### Estimation history (`resources/js/pages/poker/estimates.tsx`)

- Team members only. Table of estimated tasks across the team's games, newest `estimated_at` first, 50 per page: task title, game, estimate, rounds, date. Filters: game select, title search (`ILIKE`). A row expands to its revealed rounds (player, value per round, result); an anonymous round shows "Anonymous" with its distribution and result only.

### Join page (`resources/js/pages/poker/join.tsx`)

- Same as `retros/join.tsx`: game title, name field, "Join as spectator" checkbox, language switcher; invalid-link state.

### i18n

Every new string (including deck labels, "Show votes", "Re-vote", "Consensus", "Most played", "Watch only", "Play", "Watching", "Join as spectator", "Spectators can't vote.", "Anonymous votes", "Applies from the next round", "Reveal automatically…", "Revealed automatically — everyone voted", "— time's up", "Time's up", "Saved decks", "Save this deck for the team as…", "Show live cursors", "Show flying reactions", "Hide my cursor", error messages) exists in `lang/{en,fr,es,de}.json`. Card labels (`XS`, `?`, `☕`, numbers) and saved deck names are not translated.

## 8. Error handling

- 403 (not facilitator, guest editing tasks, game ended), 422 (closed round, value not in deck, reveal with no votes, estimate before reveal, deck change with votes, task limit) → translated message, optimistic update rolled back, toast.
- 404 (task or round deleted concurrently) → item removed locally, snapshot refetched.
- Vote after the round was revealed or switched by someone else → 422 + refetch, so the client shows the new state.
- Websocket down → "Reconnecting…" banner; HTTP actions keep working; refetch on reconnect.
- Revoked link / disabled guest access → join page "This link is no longer valid"; an active guest's next request → session-ended page.
- Spectator voting → 403 "Spectators can't vote." + refetch (the role may have been changed by the facilitator). Switching another player's role as a non-facilitator → 403.
- Timer on a closed or non-current round → 422 "Voting is closed for this round."; seconds out of range → 422.
- Reverb roster unavailable → no "everyone voted" auto-reveal for that check (warning logged with the game id only); manual reveal and the timer path keep working. A failed or duplicate `RevealPokerRoundOnTimer` run is harmless (re-checks inside the lock).
- `POST auto-reveal` when conditions are not met → 200 `{revealed: false}` (not an error).
- Saved decks: limit, duplicate name, invalid cards, deck of another team, `savedDeckId` with `customCards` → 422 with translated messages; edit/delete by someone else → 403; deleted concurrently → 404 and the list is reloaded.
- Cursor and reaction whispers failing checks are dropped silently (spec 1 §3).

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
- **Settings:** deck change blocked once votes exist; end/reopen; delete by facilitator or workspace Owner/Admin only.
- **Broadcast auth:** `presence-poker.{id}` authorized for players only, presence data shape; unknown or malformed ids 403.
- **Snapshot:** constant query count as tasks, rounds and players grow.
- **Regression:** existing retro suites untouched and green after the `HasGuestIdentity` / `GuestCookie` extraction.
- **Spectators:** self switch and facilitator switch (guests included); another non-facilitator → 403; ended game → 403; spectator vote → 403, also when the switch races the vote (lock); switching to spectator deletes the player's votes in every unrevealed round of the game, bumps their `version`, keeps revealed votes; guest join with `spectator: true` stores the flag; spectator can still add tasks (non-guest) and facilitate; snapshot `players[].isSpectator`, `me.canVote`.
- **Timer:** facilitator only; range 10–3600; null clears; only on the current task's open latest round; `timer.changed` payload; re-vote creates a round without timer; `RevealPokerRoundOnTimer` dispatched with the right delay and no-ops after the timer was changed or cleared (`Queue::fake()` / `Bus::fake()`, `travelTo`).
- **Auto-reveal (`AutoRevealPokerRound`, fake `PokerPresenceRoster`):** off → never reveals; on → reveals when every online non-spectator player voted (reason `everyone_voted`), not while one online non-spectator has not voted, ignores offline players and spectators, dedupes multi-tab ids, never with zero votes; timer expired with ≥ 1 vote → reason `timer`; roster `null` → no everyone-voted reveal, timer path still works; turning `auto_reveal` on and switching the last non-voter to spectator trigger it; withdraw never does; vote response `revealed: true`; `round.changed` broadcast; `POST auto-reveal` by any player re-checks and returns `{revealed: false}` when conditions fail; ended game or non-current round → no reveal; estimate never set.
- **Anonymous reveal (redaction):** with three players in an anonymous round, after reveal the snapshot, reveal response, round history, estimates page props and every `vote.changed` seen by each player *and by the facilitator* carry no other player's value next to a player id, while `result.distribution` has all values; own `myVote` present; turning the setting on marks open rounds anonymous; turning it off keeps existing rounds anonymous and only new rounds named; round 1 and re-vote rounds copy the setting.
- **Saved decks:** create/edit/delete permissions (member creates; creator or Owner/Admin edits/deletes; other member 403; guest no access); 30-deck limit; case-insensitive unique name; card validation; `?`/`☕` appended by the checkboxes; creating a game from a saved deck copies cards and `deck_name`; editing or deleting the saved deck leaves the game unchanged; deck of another team → 422; `saveDeckAs` creates both or nothing; `GET saved-decks` facilitator-only; deck change from a saved deck blocked once votes exist.
- **`PokerTaskEstimated`:** dispatched after commit when an estimate is set or changed to a card, not when cleared, not on a failed validation (`Event::fake()`).
- **Settings:** `autoReveal`, `anonymousVotes`, `cursorsEnabled`, `reactionsEnabled` facilitator-only, rejected on an ended game, broadcast `game.changed`, present in the snapshot.
- **Whispers:** no server test (client-only, as spec 1); covered by the walkthrough, including a forged payload id being ignored and cursors absent while a round is open.
- **Manual two-browser walkthrough:** member creates a game and tasks, guest joins by link; both vote (face-down cards appear live), reveal, re-vote, estimate; reconnect (toggle network) refetches; ended game is read-only; estimation history lists the task. Scope additions: a third browser joins as spectator and cannot vote; auto-reveal on → the round reveals when the last online player votes, and when a non-voter closes their tab; a 30 s timer reveals at zero; an anonymous round shows values without names; cursors (mouse and touch) appear with no current task and after reveal, disappear while voting, respect "Hide my cursor" and the toggle; flying reactions from all three browsers; a game created from a saved deck; the retro board's cursors and reactions still behave as in spec 1.

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
14. A player can watch as a spectator (self-switch, facilitator switch, or "Join as spectator" for guests): spectators see the table and results, cannot vote (403), and switching to spectator removes their votes from unrevealed rounds.
15. The facilitator can set and clear a per-round voting timer (10 s–60 min); everyone sees the same countdown from `timerEndsAt`.
16. With auto-reveal on, the open round is revealed automatically (reason shown) when every online non-spectator player has voted or when the timer ends with at least one vote; never with zero votes; with it off, nothing reveals without the facilitator.
17. In an anonymous round, values are revealed without player names: no snapshot, response, broadcast, history page or MCP result links another player's value to that player, facilitator included; turning the setting off never de-anonymizes an existing round.
18. Team members can save up to 30 custom decks per team and create or re-deck a game from one; games keep a copy, unaffected by later deck edits or deletion; guests never see saved decks.
19. Live cursors and flying reactions work in poker games over the poker presence channel with spec 1's verified-sender, roster, emoji and rate rules; cursors are never sent or shown while a round is open or on an ended game; both follow the per-game toggles and "Hide my cursor"; the retro board behaves as before.

## 11. Changes to other specs

- **Spec 5 (MCP server, `2026-09-29-mcp-server-design.md` §6.2/§6.3/§10, and the contract `research/qretro/mcp-readme.md`)** — payloads read `BuildPokerSnapshot` / `PresentPokerRound`, so the additions must surface consistently; tool names and the contract list are unchanged:
  - `poker.game.get`: `game` gains `autoReveal`, `anonymousVotes` (and `deckLabel` becomes the saved deck's name when set); `players[]` gains `isSpectator`; `currentTask.round` gains `anonymous`, `timerEndsAt|null`, `revealReason|null`; `voters` lists non-spectator players only (spectators never hold votes); `me` gains `isSpectator`.
  - `poker.game.tasks.list`: `latestRound` gains `anonymous` and `revealReason`; for an anonymous round `votes[].value` is `null` for every player except the caller, before and after reveal, and `result` (with `distribution`) carries the values once revealed.
  - `poker.game.task.reveal`: its returned `round` follows the same anonymous rule; a round already revealed automatically → "These cards are already revealed." (unchanged rule).
  - `poker.games.create`: recommended optional `saved_deck_id` (a saved deck of the same team; copies cards and name as the web form; exclusive with `custom_cards`). Auto-reveal, anonymity, timer, spectator role and cursor/reaction toggles get no MCP tool or parameter — they are facilitation settings, already out of MCP scope (spec 5 §1 "facilitation (phases, timer, settings…)"). Games created through MCP use the defaults (`auto_reveal` off, `anonymous_votes` off).
  - Reads still never create a player; MCP writes create a non-spectator player as today.
  - Redaction tests (spec 5 §13) add: an anonymous revealed round exposes no player-linked value through `poker.game.get`, `poker.game.tasks.list` or `poker.game.task.reveal`, facilitator included.
  - *(Applied in spec 5 §5, §6.2, §6.3, §9, §13.)*
- **Spec 1 (board engagement)**: no rule change. Its cursor/reaction layers and `whisperTransport` are extracted to board-agnostic modules (`resources/js/lib/realtime/`, `resources/js/components/realtime/`) that the retro wrappers keep using with identical behaviour; the `skrum.hideMyCursor` preference is shared by both rooms. Spec 7 (games), which imports `whisperTransport` from `resources/js/lib/retro/whisper-transport.ts`, uses the new path. *(Spec 1 is built: the extraction is made by this spec's implementation plan. Spec 7 part applied in spec 7 §1.)*
- **Spec 6 (integrations)**: no change required; imported tasks are voted, auto-revealed and anonymized like any task, and write-back still follows only the facilitator-set estimate.

## Decisions (2026-09-29)

1. Player model: separate `poker_players` table with a shared `HasGuestIdentity` trait and scoped `GuestCookie`.
2. Final estimate: any non-special deck card, only after reveal; the UI preselects the nearest card / mode.
3. Tasks: added and edited by the facilitator and non-guest players; guests cannot.
4. Absent facilitator: any non-guest team player can take control.
5. Guest access: off by default; the facilitator enables it.
6. Navigation: section on the team page plus a team estimation history page; no new sidebar entry.
7. Before reveal: face-down cards show who has voted, never values.
8. External-reference columns (`external_source`, `external_id`, `external_url`) are added now, nullable and unused until spec 6.
9. Scope additions (2026-09-30): voting timer and facilitator-controlled auto-reveal when every online non-spectator player has voted (§3b); spectator role and anonymous (unnamed) reveal with redaction in payloads, broadcasts and MCP (§3a, §3c, §5); saved custom decks per team (§3d); live cursors and flying reactions in poker rooms reusing spec 1, with cursors hidden while a round is open (§4). The choices below ("scope decision N" in the body) were settled by the user on 2026-09-30.

## Decisions (scope additions, 2026-09-30)

All recommended options below were chosen by the user on 2026-09-30.


1. **What the timer's end does.** (a) Reveals only when auto-reveal is on, otherwise "Time's up" only — one switch covers both automatic reveals, the facilitator keeps control by default. (b) Always reveals at zero (with ≥ 1 vote) — simpler mental model, but a timer can no longer be a soft nudge. (c) Never reveals, auto-reveal covers only "everyone voted" — least surprise, but a timer then does nothing a phone timer couldn't. **Chosen: (a).**
2. **Who "everyone" is for auto-reveal.** (a) Online non-spectator players per the Reverb roster at check time — matches who is actually at the table; needs a server call to Reverb and a leave trigger. (b) Every non-spectator player who ever joined the game — no presence dependency, but one absent player blocks auto-reveal forever. (c) Players online when the round started (snapshot of the roster) — stable set, but late joiners aren't waited for and early leavers block. **Chosen: (a).**
3. **Changing anonymity mid-game.** (a) Round-level flag copied at creation; on marks open rounds anonymous, off applies to new rounds only — no retroactive de-anonymization, can change any time. (b) Game-level flag, locked once any vote exists (like the deck) — simplest, but a facilitator can't turn it on mid-session. (c) Game-level, freely changeable, applied retroactively — simplest data, but turning it off exposes names of votes cast under anonymity. **Chosen: (a).**
4. **Who switches the spectator role.** (a) The player themselves and the facilitator — covers self-selection and a facilitator tidying the table (e.g. a PO who forgot). (b) Self only — maximal autonomy, but an idle player can block "everyone voted". (c) Facilitator only — central control, extra work for the facilitator. **Chosen: (a).**
5. **Who manages saved decks.** (a) Any team member creates; creator or workspace Owner/Admin edits/deletes — shared yet protected from casual deletion. (b) Any team member edits and deletes any deck — simplest, team-owned like games. (c) Owner/Admin only — tight control, but members can't save their own scales. **Chosen: (a).**
6. **Cursors while a round is open.** (a) Hidden entirely while the current round is unrevealed — no way for a pointer to disclose a hidden card; cursors mostly show between rounds. (b) Shown, but not sent while the pointer is over the hand — cursors stay alive during discussion of the task, but hover paths approaching the hand and click timing can still hint at a card. (c) Always shown — liveliest, but defeats hidden votes. **Chosen: (a).**
