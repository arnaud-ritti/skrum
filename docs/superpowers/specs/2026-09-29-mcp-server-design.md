# Skrum — MCP server — Design

Date: 2026-09-29
Status: Draft — open decisions pending
Parent spec: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (tenancy, roles, redaction, i18n, packaging and Octane rules apply unless this spec says otherwise). Latest conventions: `docs/superpowers/specs/2026-09-29-board-engagement-design.md`.
Builds on the draft specs `2026-09-29-retro-flow-extras-design.md` (spec 2), `2026-09-29-action-items-v2-design.md` (spec 3) and `2026-09-29-planning-poker-design.md` (spec 4). They are not approved yet: this spec assumes their **recommended** option for every open decision (health threshold 3, secret survey ballot, ROTI in `Discussing` + `Completed`, action item permissions à la QRetro, member-or-guest assignee, `poker_players` table, facilitator + members edit poker tasks). If one of those decisions changes, the matching tool rule here changes with it.
Research: `docs/superpowers/research/qretro/` (QRetro parity roadmap, spec 5 of 7; `repos.md` § "mcp-server", `docs-inventory.md` § "MCP", `research.md` § "MCP")

## 1. Intent

Let people use skrum from an AI assistant (Claude, ChatGPT, Cursor, any MCP client): ask "what did the team agree on in the last retro?", "list my overdue action items", "add these five stories to the poker game", "how is the team's health trending?". The skrum instance itself serves a remote MCP server over streamable HTTP at `/mcp`. People connect with OAuth 2.1 (browser sign-in and consent) or with a personal API token. Access is the intersection of what the credential allows and what the user can do in the UI, and every redaction rule of the board applies unchanged.

**Success:** an MCP client connected through OAuth and another through an API token can list teams, retros, cards, action items, health and poker data and perform the write tools of §6; every tool is covered by a feature test that proves scope gating, membership gating and redaction; suite, phpstan, type-check and lint stay green; the only new Composer dependencies are `laravel/mcp` and `laravel/passport` (§1, Dependencies).

### In scope

- Remote MCP server at `{APP_URL}/mcp` (streamable HTTP), built on `laravel/mcp`.
- Two credential types: OAuth 2.1 connections (Passport, with dynamic client registration and discovery via `Mcp::oauthRoutes()`) and personal API tokens (skrum's own table).
- Scopes `mcp:read`, `mcp:write`, `mcp:delete`; tools outside the credential's scopes are neither listed nor callable.
- Optional binding of an API token to one team.
- Tools for teams, retros, cards, card comments, action items (+ comments), health check, surveys, results/ROTI, planning poker (§6).
- Prompts `analyze-retro` and `team-health` (§7).
- Settings pages "API tokens" and "Connected applications"; OAuth consent page.
- Rate limiting, `last_used_at` tracking, revocation, instance-level on/off switch.

### Out of scope (deferred)

- MCP resources, MCP Apps (UI in the client), sampling, server-to-client notifications / subscriptions.
- Tools that act as a participant's voice: voting on cards, playing a poker card, setting a final poker estimate, answering the health check, a survey or ROTI, reacting (QRetro deliberately omits these too; §6.7).
- Facilitation tools: phase changes, timer, settings, facilitator transfer, guest links, creating or deleting retros, teams or workspaces, membership management.
- Survey creation, LLM "suggested actions" (not built in skrum), Jira/Linear import and sync (spec 6), games (spec 7).
- An audit log of MCP mutations beyond `last_used_at` (broadcasts already show changes live on boards).
- Admin views of other users' tokens or connections; per-workspace MCP switches.
- Guests: they have no account, so no MCP access at all.

### Dependencies (need user approval)

- **`laravel/mcp`** (Composer, first-party, MIT): server, tools, prompts, `shouldRegister`, `Mcp::web`, `Mcp::oauthRoutes()`, test helpers (`Server::actingAs($user)->tool(...)`).
- **`laravel/passport`** (Composer, first-party, MIT): OAuth 2.1 authorization server required by `Mcp::oauthRoutes()` and the `auth:api` guard. Brings `league/oauth2-server` transitively.
- Not added: `laravel/sanctum` (API tokens use skrum's own table, Open decision 2).
- No new npm dependency.

### Code this spec builds on

- Authorization: `app/Policies/TeamPolicy.php` (`view`), `app/Policies/WorkspacePolicy.php` (`view`), `User::canManage()`.
- Participant resolution: `app/Actions/Retros/ResolveParticipant.php` (creates the member's participant on first visit).
- Redaction: `app/Actions/Retros/PresentCard.php` (accepts a nullable viewer), `PresentComment`, `PresentActionItem`, `SummarizeReactions`, `BuildBoardSnapshot`; spec 2 `SummarizeHealthCheck`, `PresentSurvey`; spec 4 `BuildPokerSnapshot`, `PresentPokerRound`, `PokerResult`.
- Rules: `app/Actions/Retros/RetroGuard.php`; spec 4 `PokerGuard`.
- Actions for reuse: spec 3 §9 (`ActionItemQuery`, `ActionItemPermissions`, `ActionItemActor`, `CreateActionItem`, `UpdateActionItem`, `SetActionItemStatus`, `DeleteActionItem`, `AddActionItemComment`); spec 4 `app/Actions/Poker/*`.
- Settings UI: `routes/settings.php`, `app/Http/Controllers/Settings/*`, `resources/js/layouts/settings/layout.tsx`, `resources/js/pages/settings/*`.
- Packaging: `docker/scripts/prepare`, `compose.production.yaml`, `.env.example`.

## 2. Architecture

### 2.1 Server and route

- `App\Mcp\Servers\SkrumServer` (`#[Name('skrum')]`, `#[Version]` = app version, `#[Instructions]` a short English description of the domain: workspaces → teams → retros → cards; action items; poker games).
- `routes/ai.php` (published by `laravel/mcp`):
  - `Mcp::oauthRoutes()` — only when OAuth is available (§2.3).
  - `Mcp::web('/mcp', SkrumServer::class)->middleware([AuthenticateMcpRequest::class, SetMcpLocale::class, 'throttle:mcp'])`.
- `/mcp` is stateless: no session, no cookies, no CSRF. A browser session cookie alone never authenticates it.
- Unauthenticated or invalid credential → HTTP 401 with `WWW-Authenticate: Bearer resource_metadata="{APP_URL}/.well-known/oauth-protected-resource/mcp"` (the metadata part only when OAuth is available), so OAuth-capable clients start discovery.

### 2.2 Authentication pipeline (`App\Http\Middleware\AuthenticateMcpRequest`)

1. Read `Authorization: Bearer <value>`. Missing → 401.
2. Value starts with `skrum_` → API token path: look up `mcp_tokens` by SHA-256 hash of the value; reject when missing, revoked or expired.
3. Otherwise, when OAuth is available → authenticate through the Passport `api` guard; then load the `mcp_connections` row for (user, OAuth client); reject when missing (the user disconnected the app).
4. Reject when the user's email is not verified (same rule as the `verified` middleware on the web app).
5. Build an `App\Mcp\McpGrant` value object and bind it in the container as a **scoped** instance (Octane-safe, reset per request): `{user, credential: 'token'|'oauth', credentialId, scopes: McpScope[], teamId: ?string}`. Set the authenticated user on the request (`$request->setUserResolver`) so `laravel/mcp`'s `Request::user()` returns it.
6. Record usage (§4.5).

### 2.3 Instance configuration

`config/skrum.php` → `mcp`:

| Key | Env | Default | Meaning |
|---|---|---|---|
| `enabled` | `SKRUM_MCP_ENABLED` | `true` | Off → `routes/ai.php` registers nothing (404 on `/mcp` and OAuth routes), settings pages hidden, existing credentials kept but unusable. |
| `rate_limit` | `SKRUM_MCP_RATE_LIMIT` | `120` | Requests per minute per credential. |
| `write_rate_limit` | `SKRUM_MCP_WRITE_RATE_LIMIT` | `30` | Write/delete tool calls per minute per credential. |

**OAuth availability** = `enabled` and both `PASSPORT_PRIVATE_KEY` and `PASSPORT_PUBLIC_KEY` are set (Passport reads keys from these env vars). The production image has no persistent `storage/` volume (`compose.production.yaml`), so keys must come from env; `.env.example` documents how to generate them (`php artisan passport:keys --force` then copy, or two `openssl` commands). Without keys, OAuth routes are not registered, the "Connected applications" page says "OAuth is not configured on this instance", and API tokens keep working. `docker/scripts/prepare` prints a warning (not an error) when MCP is enabled without keys.

Passport configuration (in `AppServiceProvider::boot`): `Passport::authorizationView(...)` → the consent page (§8.3); access tokens expire after 1 hour, refresh tokens after 90 days, refresh tokens rotate on use; `Passport::enablePasswordGrant()` is **not** called (authorization code + PKCE and refresh only). `passport:purge` is scheduled daily.

### 2.4 Tool base class

`App\Mcp\Tools\SkrumTool` (abstract, extends `Laravel\Mcp\Server\Tool`) declares `requiredScope(): McpScope` and implements:

- `shouldRegister(Request)`: the grant has the required scope (`mcp:read` tools are always registered for an authenticated grant). This hides the tool from `tools/list` and rejects calls, as `laravel/mcp` does for unregistered tools.
- A `handle()` wrapper that re-checks the scope (defence in depth), applies the write rate limit to write/delete tools, runs the tool body, and maps exceptions to tool errors (§10).
- Annotations: read tools `#[IsReadOnly]`; write tools `#[IsReadOnly(false)]`; delete tools `#[IsDestructive]`; all `#[IsOpenWorld(false)]`.
- Results are `Response::structured([...])` (JSON text fallback included by `laravel/mcp`). Keys are camelCase, reusing the web payload shapes; inputs are snake_case.
- Descriptions are English (they are read by models). Error messages are translated (§10).

## 3. Data model

### `mcp_tokens` — new table

| Column | Type | Meaning |
|---|---|---|
| `id` | UUID | |
| `user_id` | `foreignUuid` → users, cascade on delete | Owner |
| `name` | string(60) | Label chosen by the user |
| `token_hash` | string(64), unique | SHA-256 of the plain token |
| `token_hint` | string(4) | Last 4 characters, shown in the list |
| `scopes` | json | Subset of `["mcp:read","mcp:write","mcp:delete"]`, always contains `mcp:read` |
| `team_id` | nullable `foreignUuid` → teams, cascade on delete | Binding to one team |
| `expires_at` | nullable timestamp | `null` = never |
| `last_used_at` | nullable timestamp | §4.5 |
| `revoked_at` | nullable timestamp | Set on revocation (row kept 30 days, then pruned) |
| timestamps | | |

- Plain token format: `skrum_` + 40 characters from `Str::random` (base62). Shown once at creation; never stored or logged.
- Deleting a bound team deletes its tokens (cascade) — the token's purpose is gone.
- Model `App\Models\McpToken` with `scopes` cast to a collection of the `App\Enums\McpScope` enum (`Read = 'mcp:read'`, `Write = 'mcp:write'`, `Delete = 'mcp:delete'`), helpers `isActive(CarbonInterface $now)`. `User::mcpTokens()`.

### `mcp_connections` — new table

| Column | Type | Meaning |
|---|---|---|
| `id` | UUID | |
| `user_id` | `foreignUuid` → users, cascade on delete | |
| `oauth_client_id` | UUID → `oauth_clients.id`, cascade on delete | The connected application |
| `scopes` | json | `["mcp:read"]` or `["mcp:read","mcp:write"]` — never `mcp:delete` |
| `last_used_at` | nullable timestamp | §4.5 |
| timestamps | | |

- Unique (`user_id`, `oauth_client_id`).
- Why a table: `laravel/mcp`'s OAuth integration issues Passport tokens with its single `mcp:use` scope and does not support custom Passport scopes. The access level the user chose on the consent page is therefore stored here and applies to every token of that client for that user.

### Passport tables

- Passport's published migrations are adjusted so every user reference is a UUID (`foreignUuid('user_id')`, `nullableUuidMorphs('owner')`) and client ids are UUIDs, per the parent spec's identifier rule (AC0). These are framework tables but they reference users, like `sessions.user_id`.
- `User` implements Passport's `OAuthenticatable` and uses its `HasApiTokens` trait; `config/auth.php` gains the `api` guard (`driver: passport`).

## 4. Credentials and scopes

### 4.1 Scopes

| Scope | Grants | API token | OAuth |
|---|---|---|---|
| `mcp:read` | every read tool and prompt | always | always |
| `mcp:write` | create / update / complete tools (§6) | opt-in | chosen on consent (Open decision 3) |
| `mcp:delete` | delete tools | opt-in | never |

`mcp:delete` implies nothing else; a token with `mcp:delete` but not `mcp:write` can delete but not create. The creation form enforces nothing more than "read is always on".

### 4.2 API tokens

- Created on the "API tokens" settings page (§8.1) by a verified user, after password confirmation (`RequirePassword`, like the security page).
- Fields: name (1–60, unique per user among non-revoked tokens), permissions (read fixed; "Create and update" and "Delete" checkboxes), team (optional select of every team the user can view, across their workspaces, grouped by workspace), expiration (30 days, 90 days — default, 1 year, never; Open decision 4).
- At most 25 active tokens per user (422 beyond).
- The plain token is returned once through Inertia flash data and shown in a dialog with a copy button, the MCP URL and a client configuration snippet; it is never retrievable again.
- Revocation: "Revoke" sets `revoked_at`; the next request with it gets 401. Revoked and expired tokens stay listed (greyed, with the date) for 30 days, then a daily scheduled command `mcp:prune-tokens` deletes them.
- Tokens are not revoked by a password change (they are independent credentials, as on GitHub); the settings page states it.

### 4.3 OAuth connections

- Discovery and dynamic client registration come from `Mcp::oauthRoutes()`: `/.well-known/oauth-protected-resource/{path?}`, `/.well-known/oauth-authorization-server/{path?}`, `POST /oauth/register`. Registration is throttled to 10 per hour per IP.
- Authorization code with PKCE (S256). The user signs in through the normal login (password, passkey, SSO, then two-factor if enabled), then sees the consent page (§8.3) showing the client name, the redirect host and the access level choice.
- **Approve**: Passport's approve route runs through `App\Http\Middleware\RecordMcpConsent`, which validates `access` (`read` | `write`) and upserts `mcp_connections` for (user, client) with the chosen scopes after Passport issues the code. Approving again for the same client replaces the stored level.
- **Deny**: no row, the client receives `access_denied`.
- OAuth connections cover all teams of the user (no team binding, as in QRetro).
- **Disconnect** ("Connected applications" page): revokes every access and refresh token of that client for the user and deletes the `mcp_connections` row. The next request gets 401 and the client must go through consent again.
- Registered clients that never received a consent are deleted after 7 days by `mcp:prune-clients` (daily).

### 4.4 Access = scope ∩ membership ∩ binding

For every tool, the target resource must be visible to the user **and** inside the grant:

- **Teams visible**: `TeamPolicy::view` (team members; workspace Owners/Admins see all teams of their workspaces). Class `App\Mcp\VisibleTeams::for(McpGrant)` returns the team ids once per request: all teams the user can view, intersected with `teamId` when the token is bound.
- **Retros**: those of visible teams. **Poker games**: those of visible teams. **Action items**: `ActionItemQuery` scoped to visible teams. **Cards, comments, surveys**: those of visible retros.
- A resource outside this set is reported exactly like a missing one: "not found" (§10). No tool reveals the existence of a resource the user cannot see.
- Actor: the user. For rules that need a participant (card ownership, comment authorship, board-side creation), the actor is the user's participant in that retro (§5). For poker, the user's `poker_players` row.
- Permission and phase rules are the UI's rules, through the same guard/permission classes (`RetroGuard`, `ActionItemPermissions`, `PokerGuard`). A tool never bypasses a rule the UI enforces.
- A user removed from a team loses MCP access to it on the next request. A bound token whose team is no longer visible sees nothing (tools return "not found" / empty lists); the settings page flags it "No access to this team anymore".

### 4.5 Usage tracking and rate limits

- `last_used_at` of the token or connection is updated at most once per minute per credential (cache key `mcp-used:{type}:{id}`), outside the tool transaction.
- `RateLimiter::for('mcp')`: `config('skrum.mcp.rate_limit')` requests per minute per credential (`token:{id}` / `oauth:{userId}:{clientId}`). Exceeded → HTTP 429 with `Retry-After`.
- Write rate limit: write and delete tools share `config('skrum.mcp.write_rate_limit')` calls per minute per credential. Exceeded → tool error "Too many changes, wait a moment." (not an HTTP error, so the session stays usable for reads).
- Tool-specific limits: `retros.search` 20 per minute per credential.

## 5. Participants and players acting through MCP

- **Reads never create rows.** When reading a retro, the viewer is the user's existing participant in it, or `null` when they never joined. Presenters already accept a nullable viewer (`PresentCard::handle(Card, Retro, ?Participant)`): with `null`, nothing is "mine", and others' cards are hidden in the phases that hide them.
- **Writes that need a participant** (`comments.create`, `actions.create`) resolve it like `ResolveParticipant` does for a team member opening the board: `firstOrCreate` on (`retro_id`, `user_id`) (Open decision 5). The new participant then appears in the retro's participant list like any member who opened the board.
- **Writes on own content** (`cards.update`, `cards.delete`, `comments.delete`) use the existing participant only; without one there is no own content and the tool answers "not found".
- **Poker**: the user's `poker_players` row, created on first write like the game page does; reads use it when it exists.
- Guests' identities are never used or created through MCP.

## 6. Tools

Naming: `<domain>.<action>` or `<domain>.<sub-resource>.<action>`, lowercase, dots as separators (allowed by the MCP tool-name rules). Domains follow skrum's vocabulary: `me`, `teams`, `retros`, `cards`, `comments`, `actions`, `health`, `surveys`, `poker`. Every id argument is a UUID; a malformed id is a validation error, an unknown or invisible id is "not found".

Lists take `limit` (default 20, max 50 unless stated) and `page` (default 1) and return `{items, page, hasMore}`. Every retro, action item and poker game carries an absolute `url` to open it in skrum (`/retros/{id}`, `/w/{workspace}/action-items?item={id}`, `/poker/{id}`). No payload contains an email address, a guest token, a guest URL or a guest secret.

### 6.1 Account and teams (`mcp:read`)

| Tool | Arguments | Returns |
|---|---|---|
| `me.get` | — | `{user: {id, name, locale}, credential: {type, name, scopes, teamId, expiresAt}, workspaces: [{id, name, slug, role}]}` |
| `teams.list` | `workspace_id?` | visible teams `{id, name, workspaceId, workspaceName, memberCount, isMember}` |
| `teams.members.list` | `team_id` | `[{id, name, avatarUrl}]` (no emails) |

### 6.2 Retros and cards

| Tool | Scope | Arguments | Rules / returns |
|---|---|---|---|
| `retros.list` | read | `team_id?`, `since?`, `until?` (dates), `status?` (`active` \| `completed` \| `all`, default `all`), `limit`, `page` | Newest first. `{id, title, teamId, teamName, phase, isAnonymous, participantCount, cardCount, openActionItemCount, createdAt, completedAt, url}` |
| `retros.search` | read | `query` (2–100), `team_id?`, `limit` (max 20) | Matches retro titles and **visible** card contents (`ILIKE`, wildcards escaped). Cards the viewer could not see on the board are excluded in SQL, not filtered afterwards. Returns `{retro: {...}, matches: [{cardId, snippet}]}` (snippet ≤ 160 characters around the match). |
| `retros.get` | read | `retro_id` | `{retro (as list), columns: [{id, title, description, color}], phases, settings: {isLocked, hideVoteCounts, healthCheckEnabled, votesPerParticipant}, facilitator: {name}, myParticipantId}` |
| `retros.results.get` | read | `retro_id` | Only for `Completed` retros (otherwise a normal result `{status: "not_completed", phase}`). Same content as the Results view (spec 2 §6.2): participants (names), stored LLM summary if any, health aggregates (§6.5), closed survey results, top 5 topics with vote totals and grouped-card count, action items, ROTI aggregate (≥ 3 ratings). Health trend included. |
| `cards.list` | read | `retro_id`, `column_id?`, `sort?` (`position` \| `votes`), `limit` (max 200), `page` | Top-level cards with their grouped children, through `PresentCard` with the viewer of §5: `hidden`, `content`, `author` (null when anonymous, except own), `isMine`, `voteTotal` (only when the snapshot would show totals), `reactions: [{emoji, count}]` (no names on anonymous retros), `commentCount`, `gif: {url}` (proxied skrum URL). `sort=votes` is refused ("Vote totals are not visible yet.") when totals are hidden. |
| `cards.update` | write | `card_id`, `content` (1–1000) | Own card only; same phase and lock rules as `PATCH /retros/{retro}/cards/{card}`. Broadcasts `card.updated` / `own-card.saved`. |
| `cards.delete` | delete | `card_id` | Own card only; same rules as `DELETE …/cards/{card}`. |

### 6.3 Card comments

| Tool | Scope | Arguments | Rules / returns |
|---|---|---|---|
| `comments.list` | read | `card_id` | Visible card only (hidden card → "not found"). Threads as in the snapshot: top-level oldest first with `replies`, `deleted`, author omitted on anonymous retros except own. |
| `comments.create` | write | `card_id`, `content` (1–500), `parent_comment_id?` | Same rules as `POST …/cards/{card}/comments` (from `Grouping`, not `Completed`, not locked, reply-to-reply re-parented). Notifications and broadcasts as in the UI. |
| `comments.delete` | delete | `comment_id` | Author or facilitator, as in the UI; soft-delete rule unchanged. |

### 6.4 Action items (spec 3)

| Tool | Scope | Arguments | Rules / returns |
|---|---|---|---|
| `actions.list` | read | `workspace_id?`, `team_id?`, `status?` (`open` default \| `overdue` \| `completed` \| `all`), `assignee?` (`me` \| `unassigned` \| user id), `limit`, `page` | `ActionItemQuery` per visible workspace (one query per workspace; results merged in the global-page order: overdue first, then due date, priority, created date). Payload = `PresentActionItem`. |
| `actions.get` | read | `action_id` | Item + `comments` (flat, oldest first). |
| `actions.create` | write | `retro_id`, `content`, `priority?`, `due_on?`, `assignee_user_id?` | `CreateActionItem` with the board-side rules: participant of §5, retro in `Discussing`, not locked (Open decision 8). Assignee must be a team member (guests can't be assigned through MCP). |
| `actions.update` | write | `action_id`, any of `content`, `priority`, `due_on` (or `null`), `assignee_user_id` (or `null`) | `UpdateActionItem` with the workspace-side rules (spec 3 §3: no phase rule, 423 when the item's retro is locked and not `Completed`), permissions via `ActionItemPermissions` with `ActionItemActor(user, null)`. |
| `actions.complete` | write | `action_id`, `completed` (bool, default `true`) | `SetActionItemStatus`; managers, assignee or review facilitator (spec 3 §4). `false` reopens. |
| `actions.comments.create` | write | `action_id`, `content` (1–500) | `AddActionItemComment`, author = user (`author_user_id`). |
| `actions.delete` | delete | `action_id` | `DeleteActionItem`, managers only. |
| `actions.comments.delete` | delete | `comment_id` | Comment author or item managers. |

All action item mutations broadcast through `BroadcastActionItemChange` exactly as the workspace endpoints do; with no socket id, every open board receives them.

### 6.5 Health, surveys (spec 2)

| Tool | Scope | Arguments | Rules / returns |
|---|---|---|---|
| `health.get` | read | `retro_id` | Health check disabled or no answers → `{status: "not_run"}` (a normal result, not an error — QRetro rule). Phase `HealthCheck` → `{status: "in_progress", statements: [{key, label, count, answeredBy}]}` (`answeredBy` names, `[]` on anonymous retros) + `myScores` of the user's participant. `Completed` → `{status: "completed", statements: [{key, label, average\|null, count, alignment\|null}], score, participation, topStrength, growthArea, alignment, alignmentLevel, assessment}` from `SummarizeHealthCheck` (minimum 3 answers per statement). Other phases after the check → `{status: "collected", respondents}` (aggregates appear only once the retro is completed, as in the UI). |
| `health.trend.get` | read | `team_id`, `limit?` (max 12, default 6) | Spec 2 §4.5 trend for the team: `[{retroId, title, completedAt, score, delta, url}]`, plus per-statement averages per point. `[]` → `{status: "not_run"}`. |
| `surveys.list` | read | `retro_id` | `PresentSurvey` for the viewer of §5: counts only when the viewer's participant answered or the survey is closed; never who chose what. |

ROTI is part of `retros.results.get` (aggregate only, `Completed`, ≥ 3 ratings); there is no separate ROTI tool.

### 6.6 Planning poker (spec 4)

| Tool | Scope | Arguments | Rules / returns |
|---|---|---|---|
| `poker.games.list` | read | `team_id?`, `status?` (`active` default \| `ended` \| `all`), `limit`, `page` | `{id, title, teamId, deck, tasksCount, estimatedCount, totalPoints, endedAt, url}` |
| `poker.games.get` | read | `game_id` | `BuildPokerSnapshot` for the user's player (or none): game (without `guestUrl`), players (names), tasks, current round with the unrevealed-values redaction of spec 4 §5 (the viewer's own value only). |
| `poker.tasks.list` | read | `game_id` | Tasks in order with `description` (Markdown source), `estimate`, `roundsCount`. |
| `poker.rounds.list` | read | `task_id` | Round history via `PresentPokerRound` (revealed rounds with values and result; unrevealed: count only). |
| `poker.estimates.list` | read | `team_id`, `game_id?`, `query?`, `limit`, `page` | Team estimation history (spec 4 §7). |
| `poker.games.create` | write | `team_id`, `title` (1–120), `deck`, `custom_cards?` (2–20), `include_unknown?`, `include_coffee?` | Same validation as the web form; the user becomes player and facilitator; guest access off. |
| `poker.tasks.add` | write | `game_id`, `tasks: [{title (1–200), description? (≤ 10 000)}]` (1–50 items) | Facilitator or non-guest player; appended in the given order; 200-task limit applies to the total (all-or-nothing). One `task.saved` per task. |
| `poker.tasks.select` | write | `game_id`, `task_id` or `null` | Facilitator only (`PUT current-task` rules). |
| `poker.rounds.reveal` | write | `game_id` | Facilitator only; reveals the current task's latest round (spec 4 reveal rules: ≥ 1 vote). Returns the revealed round with its result. |
| `poker.tasks.delete` | delete | `task_id` | Facilitator only. |

### 6.7 Deliberately absent

No tool casts or retracts a card vote, plays or withdraws a poker card, sets a final poker estimate, answers the health check, a survey or ROTI, adds a reaction, creates a card, or changes phase, timer, settings, facilitation or guest access. These express a person's own judgement or run the meeting; they stay in the UI. A test asserts that no registered tool name matches these capabilities (§12).

### 6.8 Shared actions (change to earlier specs and existing code)

MCP tools must call the same action classes as the controllers. Where logic lives in controllers today it is extracted, with no behaviour change, and the controllers call the actions:

- `app/Actions/Retros/UpdateCard`, `DeleteCard` (from `CardsController`), `CreateCardComment`, `DeleteCardComment` (from `CardCommentsController`), each taking a `Participant` actor and running the existing guards, locks and broadcasts.
- Spec 3 §9 actions (already required there) and spec 4 `app/Actions/Poker/*` (`AddPokerTask`, `SelectPokerTask`, `RevealPokerRound`, `DeletePokerTask`, `CreatePokerGame`).
- Guards throw the existing exceptions (`AuthorizationException` → forbidden, `HttpException(423)` → locked, `ValidationException` → validation, `ModelNotFoundException` → not found); the tool base maps them (§10).

## 7. Prompts

Both require `mcp:read` only, validate their argument against visibility (§4.4), and return a user message containing instructions plus the data as quoted JSON, built with the same presenters as the tools (so redaction is identical). They never call an LLM on the skrum side. The instructions ask the model to answer in the user's language (`users.locale`) and not to guess authors of anonymous content.

| Prompt | Arguments | Content |
|---|---|---|
| `analyze-retro` | `retro_id` | `retros.get` + `cards.list` (sorted by votes when visible) + action items + `retros.results.get` when completed. Instructions: summarise themes, what went well / to improve, check that action items cover the top topics, suggest missing action items (the user adds them with `actions.create` if they agree). |
| `team-health` | `team_id` | `health.trend.get` (6 points) + open and overdue action items of the team + ROTI of the last 6 completed retros. Instructions: describe the trend, strongest and weakest statements, relation to open follow-ups; say "health check not run yet" when there is no data. |

Content embedded in a prompt is capped at 60 000 characters (cards beyond the cap are dropped lowest-voted first, with a note).

## 8. Settings UI

All strings in `lang/{en,fr,es,de}.json`. Settings navigation (`resources/js/layouts/settings/layout.tsx`) gains "API tokens" and "Connected applications" when `skrum.mcp.enabled` (shared Inertia prop `features.mcp: {enabled, oauth}`).

### 8.1 API tokens (`/settings/api-tokens`, `resources/js/pages/settings/api-tokens.tsx`)

- Intro: what MCP is, the server URL `{APP_URL}/mcp` with a copy button.
- "Create token" (behind password confirmation) → dialog: name, "Read" (checked, disabled), "Create and update", "Delete" (with a warning "Lets the client delete action items, cards and comments you are allowed to delete."), team select ("All my teams" default), expiration select.
- After creation: dialog "Copy your token now. You won't be able to see it again." with the token, copy button, and a config snippet tab set (Claude Code: `claude mcp add --transport http skrum {url} --header "Authorization: Bearer {token}"`; generic JSON `{"mcpServers":{"skrum":{"type":"http","url":…,"headers":{"Authorization":"Bearer …"}}}}`).
- Table: name, `skrum_…abcd` hint, permissions badges, team (or "All teams"; "No access to this team anymore" warning), created, expires, last used ("Never"), status (active / expired / revoked), "Revoke" (confirmation dialog).
- Empty state: "No API tokens yet."

### 8.2 Connected applications (`/settings/connected-apps`, `resources/js/pages/settings/connected-apps.tsx`)

- List of `mcp_connections`: client name, redirect host, access ("Read only" / "Read and change"), connected on, last used, "Disconnect" (confirmation).
- Without OAuth keys: notice "OAuth is not configured on this instance. Use an API token instead."
- Empty state: "No connected applications. Add skrum as a connector in your AI assistant using {url}."

### 8.3 Consent page (`resources/js/pages/oauth/authorize.tsx`, auth layout)

- Rendered by `Passport::authorizationView(fn (array $parameters) => Inertia::render('oauth/authorize', …))`. If Passport rejects a non-view response at implementation time, the published `mcp.authorize` Blade view is used instead, restyled with the app's CSS and translated through `__()`; the content below is identical either way.
- Shows: client name, "will be redirected to {host}", signed-in account ("Not you? Log out"), the list of capabilities ("See your teams, retrospectives, action items and poker games"; with write: "Create and update action items, comments and poker tasks"), the access choice radio "Read only" / "Read and change" (Open decision 3 default), the note "Connected applications can never delete anything.", and "Authorize" / "Cancel".
- Warning banner when the client was registered dynamically: "Only authorize applications you trust. skrum did not verify this application."

### 8.4 Endpoints (web, `auth` + `verified`, JSON or Inertia)

| Method | Path | Name | Notes |
|---|---|---|---|
| GET | `/settings/api-tokens` | `apiTokens.index` | Inertia page |
| POST | `/settings/api-tokens` | `apiTokens.store` | `RequirePassword`, `throttle:10,1`; redirect back with flash `newToken` |
| DELETE | `/settings/api-tokens/{mcpToken}` | `apiTokens.destroy` | Own tokens only (404 otherwise) |
| GET | `/settings/connected-apps` | `connectedApps.index` | Inertia page |
| DELETE | `/settings/connected-apps/{mcpConnection}` | `connectedApps.destroy` | Own connections only (404 otherwise) |

Controllers `App\Http\Controllers\Settings\ApiTokensController` (`index`, `store`, `destroy`) and `ConnectedAppsController` (`index`, `destroy`); actions `App\Actions\Mcp\IssueMcpToken`, `RevokeMcpToken`, `DisconnectMcpClient`. All routes 404 when MCP is disabled.

## 9. Redaction and privacy

MCP is one more surface; every invariant of the earlier specs holds, enforced by reusing their presenters, never by re-implementing filters in tools:

- **Writing-phase content** (and `HealthCheck`/`Icebreaker`, spec 2 §2.4): others' cards are hidden in `cards.list`, `comments.list`, `retros.search` and prompts, with the viewer of §5 (`retros.results.get` only answers for `Completed` retros, where nothing is hidden by phase).
- **Anonymity:** card, comment, action-item creator and comment authors are omitted for everyone but the author on anonymous retros; reaction names are never sent on anonymous retros.
- **Voter identity:** never exposed; vote totals only when the board would show them (board-engagement §9).
- **Health check:** individual scores only to their author; aggregates only for `Completed` retros and statements with ≥ 3 answers.
- **Surveys:** secret ballot; counts only after answering or closing.
- **ROTI:** aggregate only, `Completed`, ≥ 3 ratings.
- **Poker:** no card value of another player before reveal, including for the facilitator.
- **Carried action items:** follow spec 3 (members only; MCP users are always members or admins).
- **Identity data:** no emails, guest tokens, guest URLs, secrets, IP addresses or credential values in any tool result, prompt, error or log line. Plain API tokens are never logged; `Authorization` headers are excluded from exception context.
- **Data leaving the instance:** tool results go to the user's own MCP client and, from there, to whatever model the user chose. skrum does not control that; the API tokens and consent pages say "Data you read through this connection is sent to the AI application you use."

## 10. Error handling

Tool failures are MCP tool errors (`Response::error`, `isError: true`) with a translated message in the user's locale (`SetMcpLocale` applies `users.locale`, falling back to `en`); protocol-level failures are HTTP statuses.

| Situation | Result |
|---|---|
| Missing / invalid / revoked / expired credential; disconnected OAuth app; unverified email | HTTP 401 (+ `WWW-Authenticate`) |
| MCP disabled | HTTP 404 |
| Request rate exceeded | HTTP 429 + `Retry-After` |
| Tool not granted by the scopes | not listed; calling it → JSON-RPC "tool not found" (as `laravel/mcp` does) |
| Resource missing, invisible, outside the bound team | tool error "Not found." |
| Policy or permission denied (`AuthorizationException`) | tool error with the UI's translated message (e.g. "Only the facilitator can do this.") |
| Phase rule | tool error "This action is not available in the current phase." |
| Board locked (423) | tool error "The board is closed for editing." |
| Validation | tool error listing the translated field messages |
| Write rate exceeded | tool error "Too many changes, wait a moment." |
| Unexpected exception | tool error "Something went wrong." (reported to the log without arguments' content) |

Consent page: invalid client or redirect → Passport's error page (translated title "This authorization request is invalid."). Token creation errors → inline field errors.

## 11. Packaging

- `composer require laravel/mcp laravel/passport` (after approval); publish `routes/ai.php`, Passport migrations (adjusted, §3), Passport config.
- `.env.example`: `SKRUM_MCP_ENABLED`, `SKRUM_MCP_RATE_LIMIT`, `SKRUM_MCP_WRITE_RATE_LIMIT`, `PASSPORT_PRIVATE_KEY`, `PASSPORT_PUBLIC_KEY` with generation instructions; note that keys must be stable across restarts (rotating them logs out every OAuth client).
- `docker/scripts/prepare`: warning when MCP is enabled without Passport keys.
- Caddy needs no change (`/mcp`, `/oauth/*`, `/.well-known/*` go to Octane). Streamed responses must not be buffered: the plan verifies `/mcp` through Caddy + Octane in the production image.
- Scheduler: `passport:purge` (daily), `mcp:prune-tokens` (daily), `mcp:prune-clients` (daily).
- README: "Connect an AI assistant" section (URL, OAuth vs token, scopes, what is never exposed).

## 12. Testing

Pest feature tests in `tests/Feature/Mcp/`. Tool tests use `laravel/mcp`'s helpers (`SkrumServer::actingAs($user)->tool(Tool::class, [...])`) with an `McpGrant` bound for the test (helper `actingAsMcp(User, scopes, ?team)`); protocol and auth tests post JSON-RPC to `/mcp`. `Event::fake()` for broadcasts; `Passport::actingAsClient` / real token issuance for OAuth.

- **Authentication:** no header → 401 with `WWW-Authenticate`; valid token → 200; wrong, revoked, expired token → 401; session cookie without bearer → 401; OAuth token of a disconnected client → 401; unverified user → 401; MCP disabled → 404; plain token never stored (only its hash) and never in logs.
- **Scope gating:** `tools/list` for read-only, read+write, read+delete, read+write+delete returns exactly the expected tool names; calling a hidden tool fails; OAuth never lists delete tools even if `mcp_connections.scopes` were tampered to include `mcp:delete` (the grant builder strips it).
- **Membership and binding:** a Member cannot read or write another team's retro, card, action item, poker game (→ "Not found."), including through `retros.search` and `actions.list`; Owner/Admin sees all teams of their workspace; a token bound to team A sees nothing of team B; removing the user from team A empties the bound token's results; another workspace is invisible.
- **Rules parity:** for each write/delete tool, the same phase, lock, ownership and facilitator rules as the matching web endpoint (one test per rule, e.g. `cards.update` in `Voting` refused, `actions.update` on a locked in-progress retro → locked message, `poker.rounds.reveal` by a non-facilitator refused, `actions.complete` by the assignee allowed, `actions.delete` by a non-manager refused).
- **Participant creation:** reads never create participants or poker players; `comments.create` / `actions.create` create the participant once; `cards.update` without a participant → "Not found.".
- **Redaction:** `cards.list`, `comments.list`, `retros.search` and `analyze-retro` return no content of others' cards in `Writing` (search does not match hidden content); anonymous retros expose no card, comment or action-item author but the user's own; no vote-by-participant data anywhere; vote totals hidden when the board hides them; `health.get` never returns another participant's score and returns no average under 3 answers or before `Completed`; `surveys.list` counts hidden before answering; `poker.games.get` / `poker.rounds.list` contain no other player's value before reveal (facilitator included); no result contains `@` email addresses, `guest_token` or `guestUrl` (asserted over every tool's output in a data-provider test).
- **Absent tools:** no registered tool name contains `vote`, `estimate` (except `poker.estimates.list`), `react`, `roti`, `phase`, `answer`.
- **Broadcasts:** MCP mutations dispatch the same events as the web endpoints, to everyone (no socket exclusion).
- **Results and health:** `retros.results.get` on a non-completed retro → `not_completed`; `health.get` `not_run` / `in_progress` / `collected` / `completed`; `health.trend.get` matches spec 2's trend.
- **Prompts:** both validate visibility, embed redacted data only, respect the size cap.
- **Tokens UI:** create requires password confirmation; name uniqueness; 25-token limit; team must be viewable; plain token only in the creation response; revoke; other users' tokens → 404; pruning after 30 days.
- **OAuth:** discovery documents served when keys are set and absent otherwise; dynamic registration throttled; consent stores the chosen level; approving twice replaces it; deny stores nothing; disconnect revokes access and refresh tokens and deletes the row; unconsented clients pruned after 7 days; OAuth access tokens expire after 1 hour and refresh.
- **Rate limits:** request limit → 429; write limit → tool error while reads still succeed; `last_used_at` updated at most once per minute.
- **Passport migrations:** user references are UUIDs (extends the identifier test of parent AC0).
- **Translations:** every new key in all four locales (`TranslationKeysTest`).
- **Manual walkthrough:** connect Claude (OAuth, "Read and change") and Claude Code (token bound to one team, read + write + delete) to a local instance; ask for the last retro's summary, list overdue action items, complete one (the open board updates live), add poker tasks and reveal a round as facilitator; confirm hidden Writing-phase cards and anonymous authors never appear; disconnect the app and revoke the token, then confirm both clients are refused.

Type-check and lint stay green; no frontend test runner is added.

## 13. Acceptance criteria

1. `{APP_URL}/mcp` serves an MCP server over streamable HTTP, authenticated only by an API token or an OAuth access token; sessions and cookies never authenticate it; it is absent when `SKRUM_MCP_ENABLED=false`.
2. OAuth 2.1 works with discovery, dynamic client registration, PKCE and a translated consent page where the user picks "Read only" or "Read and change"; OAuth never grants `mcp:delete`; OAuth is available only when Passport keys are configured.
3. API tokens are shown once, stored hashed, always include read, opt into write and delete, optionally bind to one team, expire as chosen, and can be revoked; `last_used_at` is tracked.
4. Tools outside the credential's scopes are neither listed nor callable.
5. Every tool's access is scope ∩ team visibility (∩ bound team), with invisible resources reported as not found; write and delete tools apply exactly the UI's phase, lock, ownership and role rules through shared action classes.
6. The tool catalogue is the one in §6; no tool votes, estimates, answers, reacts or runs the meeting on the user's behalf.
7. Writing-phase content, anonymity, voter identity, individual health scores, survey ballots, ROTI ratings and unrevealed poker values stay hidden through MCP exactly as in the UI; no email address, guest token or secret is ever returned.
8. Prompts `analyze-retro` and `team-health` return redacted data with instructions and never call an LLM from skrum.
9. Settings offer "API tokens" and "Connected applications"; disconnecting an app or revoking a token takes effect on the next request.
10. Request and write rate limits apply per credential.
11. Guests have no MCP access.
12. All new strings are translated in en/fr/es/de; suite, phpstan, type-check and lint are green; the only new dependencies are `laravel/mcp` and `laravel/passport`; the walkthrough passes.

## Open decisions

1. **Credential types.**
   (a) OAuth (Passport) and API tokens — works with every MCP client (claude.ai / ChatGPT connectors need OAuth; CLIs are easiest with a token); adds Passport, keys and a consent page.
   (b) API tokens only, OAuth later — no Passport, far less surface; web-based assistants cannot connect.
   (c) OAuth only — the MCP-spec way, but scripts and CLIs lose the simple bearer path and team binding.
   **Recommendation: (a).**
2. **API token storage.**
   (a) skrum's own `mcp_tokens` table + middleware — no extra package, exactly the fields needed (scopes, team, expiry, hint).
   (b) Laravel Sanctum personal access tokens (abilities, `last_used_at` built in) — second auth package next to Passport, custom model needed for `team_id`.
   (c) Passport personal access clients — one package, but awkward token management and no `last_used_at`.
   **Recommendation: (a).**
3. **OAuth access level.**
   (a) Chosen on the consent page ("Read only" / "Read and change", default "Read and change"), stored per connection — user control, works around `laravel/mcp`'s single `mcp:use` scope.
   (b) Always read + write (QRetro behaviour) — no choice to explain, less control.
   (c) Always read-only — safest, but assistants in claude.ai could never complete an action item.
   **Recommendation: (a).**
4. **API token expiry.**
   (a) Selectable 30 d / 90 d / 1 y / never, default 90 days — limits forgotten tokens, keeps flexibility.
   (b) Never expire (QRetro) — simplest; leaked tokens live until revoked.
   (c) Mandatory expiry, max 1 year — strongest, but long-running automations break yearly.
   **Recommendation: (a).**
5. **Participant rows created by MCP writes.**
   (a) Created on first write, like opening the board — commenting or adding an action item works without visiting the retro; the user appears in "Thanks for participating".
   (b) Require the user to have joined the retro in the browser first — participant list reflects real attendance; tools fail with "Open the retro once in skrum first."
   (c) No participant-bound writes via MCP (comments and action item creation dropped) — simplest, loses the "add the items we discussed" use case.
   **Recommendation: (a).**
6. **Board content writes.**
   (a) QRetro parity: update/delete own cards, create/delete comments — covers "fix my card" and "reply to this thread".
   (b) No card or comment writes; only action items and poker — smaller surface, board content only from humans in the UI.
   (c) Also create cards — assistants could brainstorm into the board, but content would not be the participant's own words during a hidden phase.
   **Recommendation: (a).**
7. **Instance default.**
   (a) MCP on by default, `SKRUM_MCP_ENABLED=false` turns it off — feature discoverable; nothing works without a credential the user creates.
   (b) Off by default, admin opts in — conservative for security-sensitive installs; most users never find it.
   (c) Per-workspace switch by Owners — finer control, needs UI and workspace-scoped grants.
   **Recommendation: (a).**
8. **When `actions.create` is allowed.**
   (a) Same as the board: `Discussing` only, not locked — "same authorization as the UI", no rule change.
   (b) Also in `Completed` (for any surface) — lets an assistant add follow-ups after analysing a finished retro; changes spec 3 and the parent's read-only rule.
   (c) Any phase through MCP only — convenient, but MCP would bypass a UI rule.
   **Recommendation: (a)**; revisit (b) together with spec 3 if post-retro analysis becomes the main use.
