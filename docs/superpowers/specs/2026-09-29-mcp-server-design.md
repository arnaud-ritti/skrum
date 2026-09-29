# Skrum — MCP server — Design

Date: 2026-09-29 (revised 2026-09-30)
Status: Approved decisions, awaiting spec review
Parent spec: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (tenancy, roles, redaction, i18n, packaging and Octane rules apply unless this spec says otherwise). Latest conventions: `docs/superpowers/specs/2026-09-29-board-engagement-design.md`.
Contract: `docs/superpowers/research/qretro/mcp-readme.md` (QRetro MCP README). It is **binding**: tool names, the tool set, their behaviour, the two prompts, the scope table and the permission rules follow it. The only deviations are listed in §1.3.
Builds on: `2026-09-29-retro-flow-extras-design.md` (spec 2: health check, ROTI, results, AI summary, themes and suggested actions), `2026-09-29-action-items-v2-design.md` (spec 3), `2026-09-29-planning-poker-design.md` (spec 4) and `2026-09-29-integrations-design.md` (spec 6: Jira/Linear, used only by the tracker tools of §6.2/§6.3) — all with approved decisions. §12 lists how this spec relates to them.
Research: `docs/superpowers/research/qretro/` (QRetro parity roadmap, spec 5 of 7; `mcp-readme.md`, `repos.md` § "mcp-server", `docs-inventory.md` § "MCP", `research.md` § "MCP")

## 1. Intent

Let people use skrum from an AI assistant that supports MCP with a bearer header (Claude Code, Cursor, VS Code, scripts, CI): ask "what did the team agree on in the last retro?", "list my overdue action items", "add these five stories to the poker game", "how is the team's health trending?". The skrum instance serves a remote MCP server over streamable HTTP at `/mcp`, exposing exactly the QRetro tool set. People connect with a personal API token. Access is the intersection of what the token allows and what the user can do in the UI, and every redaction rule of the board applies unchanged.

**Success:** an MCP client connected with an API token can use every tool of §6 that its scopes and the instance allow; `tools/list` returns exactly the contract's names; every tool is covered by a feature test that proves scope gating, membership gating, UI-rule parity and redaction; suite, phpstan, type-check and lint stay green; the only new Composer dependencies are `laravel/mcp` and `laravel/sanctum` (§1.4).

### 1.1 In scope

- Remote MCP server at `{APP_URL}/mcp` (streamable HTTP), built on `laravel/mcp`.
- One credential type: personal API tokens (Laravel Sanctum personal access tokens), sent as `Authorization: Bearer <token>`.
- Scopes `mcp:read` (always), `mcp:write`, `mcp:delete` (opt-in); tools outside the token's scopes are neither listed nor callable.
- Optional binding of a token to one team; selectable expiry.
- The 29 tools of the contract, named `domain.scope.action` with domains `retro` and `poker` (§6), and the prompts `analyze-retro` and `team-health` (§7).
- Settings page "API tokens" (§8).
- Rate limiting, `last_used_at` tracking, revocation, instance-level on/off switch.

### 1.2 Out of scope (deferred)

- **OAuth sign-in** (the contract's "no token needed" connection, dynamic client registration, consent page, "Connected applications"): later, as a separate spec (§1.3).
- MCP resources, MCP Apps, sampling, server-to-client notifications / subscriptions.
- Any tool not in the contract: card comments, surveys, card creation, reactions, facilitation (phases, timer, settings, facilitator transfer, guest links), creating or deleting retros, teams or workspaces, membership management, poker re-vote, deleting action items or poker tasks.
- Publishing a `server.json` to the MCP Registry (skrum instances are self-hosted).
- An audit log of MCP mutations beyond `last_used_at` (broadcasts already show changes live on boards).
- Admin views of other users' tokens; per-workspace MCP switches.
- Guests: they have no account, so no MCP access at all.

### 1.3 Contract mapping and deviations

| Contract term | skrum concept |
|---|---|
| board | retro (`retros`) |
| message | card (`cards`), top-level or grouped |
| template column | retro column (`columns`) |
| action item / agreement | action item (spec 3) |
| summary | spec 2 results summary (`retros.summary`) + participants |
| insights: semantic clusters, suggested follow-ups, message sentiment and category | spec 2 themes (`retro_themes`), suggested actions (`suggested_actions`) and card `sentiment` / `category`, generated with the results summary (spec 2 §6.5) |
| health: score per category | spec 2 health statements (answers 1–10, averages reported on the contract's 0–10 scale) |
| ROTI | spec 2 ROTI (1–5) |
| game, task, scale, estimate | spec 4 poker game, task, deck, estimate |
| sources, iterations, import, sync | spec 6 Jira Cloud / Linear connections, sprints / cycles, import, estimate write-back |
| user's permission in a team | workspace role (`owner` / `admin` / `member`) of a team member |

Deliberate deviations (user decisions 2026-09-30):

1. **No OAuth sign-in.** The contract's primary connection ("one address, no token needed: the client opens the sign-in page itself") is not supported. Only the contract's alternative, an access token sent as `Authorization: Bearer`, exists. Consequence: web connectors that require OAuth (claude.ai, ChatGPT connectors) cannot connect; header-token clients (Claude Code, Cursor, VS Code, scripts) can. The scope table's "Sign-in (OAuth)" column therefore does not apply; its rule "`mcp:delete` never via OAuth" holds trivially.
2. **Tracker tools depend on spec 6.** `poker.sources.list`, `poker.iterations.list`, `poker.game.tasks.import` and `poker.game.task.sync` are specified here but offered only once spec 6 is implemented and the conditions of §2.4 hold.
3. **Insights depend on an LLM provider.** `retro.board.insights.list` and `retro.board.suggested_actions.promote|reject` are offered only when an LLM provider is configured (spec 2 §9) and return empty results for a retro without generated insights (§6.1, §6.3).
4. No registry manifest (§1.2).

### 1.4 Dependencies (approved by the user on 2026-09-30)

- **`laravel/mcp`** (Composer, first-party, MIT; already in `composer.lock` through Boost, becomes a direct `require`): server, tools, prompts, `shouldRegister`, `Mcp::web`, test helpers (`Server::actingAs($user)->tool(...)`).
- **`laravel/sanctum`** (Composer, first-party, MIT): personal access tokens (hashed storage, abilities, `last_used_at`, `expires_at`, `sanctum:prune-expired`), with a custom token model (§3).
- Not added: `laravel/passport` (OAuth dropped, §1.3).
- No new npm dependency.

### 1.5 Code this spec builds on

- Authorization: `app/Policies/TeamPolicy.php` (`view`), `app/Policies/WorkspacePolicy.php` (`view`), `User::canManage()`.
- Participant resolution: `app/Actions/Retros/ResolveParticipant.php` (creates the member's participant on first visit).
- Redaction: `app/Actions/Retros/PresentCard.php` (accepts a nullable viewer), `PresentActionItem`, `SummarizeReactions`, `BuildBoardSnapshot`; spec 2 `SummarizeHealthCheck`, ROTI aggregates, health trend; spec 4 `BuildPokerSnapshot`, `PresentPokerRound`, `PokerResult`, `PokerDeck`.
- Rules: `app/Actions/Retros/RetroGuard.php`; spec 3 `ActionItemPermissions`, `ActionItemActor`; spec 4 `PokerGuard`; spec 6 §8 permissions.
- Actions for reuse: spec 2 §6.5 (`PromoteSuggestedAction`, `RejectSuggestedAction`); spec 3 §9 (`ActionItemQuery`, `CreateActionItem`, `UpdateActionItem`, `SetActionItemStatus`); spec 4 `app/Actions/Poker/*`; spec 6 `app/Actions/Integrations/*`.
- Settings UI: `routes/settings.php`, `app/Http/Controllers/Settings/*`, `resources/js/layouts/settings/layout.tsx`, `resources/js/pages/settings/*`.
- Packaging: `docker/scripts/prepare`, `compose.production.yaml`, `.env.example`.

## 2. Architecture

### 2.1 Server and route

- `App\Mcp\Servers\SkrumServer` (`#[Name('skrum')]`, `#[Version]` = app version, `#[Instructions]` a short English description of the domain: teams → boards (retrospectives) → messages (cards) by column; action items; health check and ROTI; planning poker games → tasks → rounds).
- `routes/ai.php` (published by `laravel/mcp`): `Mcp::web('/mcp', SkrumServer::class)->middleware([AuthenticateMcpRequest::class, SetMcpLocale::class, 'throttle:mcp'])`. No `Mcp::oauthRoutes()`.
- `/mcp` is stateless: no session, no cookies, no CSRF. A browser session cookie never authenticates it.
- Missing or invalid credential → HTTP 401 with `WWW-Authenticate: Bearer realm="skrum"` (no `resource_metadata`: there is no OAuth discovery, §1.3).

### 2.2 Authentication pipeline (`App\Http\Middleware\AuthenticateMcpRequest`)

1. Read `Authorization: Bearer <value>`. Missing → 401.
2. Authenticate through the `sanctum` guard. `config/sanctum.php` sets `guard => []` and `stateful => []`, so Sanctum never falls back to the session guard: only a token authenticates. The authenticated user's `currentAccessToken()` must be an `App\Models\PersonalAccessToken` (not a `TransientToken`), unexpired (Sanctum checks `expires_at`) and carry `mcp:read`. Otherwise → 401.
3. Reject when the user's email is not verified (same rule as the `verified` middleware on the web app) → 401.
4. Build an `App\Mcp\McpGrant` value object and bind it in the container as a **scoped** instance (Octane-safe, reset per request): `{user, tokenId, scopes: McpScope[], teamId: ?string}`. `laravel/mcp`'s `Request::user()` returns the Sanctum user.
5. Sanctum records `last_used_at` (§4.4).

No other route uses `auth:sanctum`; the tokens are MCP credentials only.

### 2.3 Instance configuration

`config/skrum.php` → `mcp`:

| Key | Env | Default | Meaning |
|---|---|---|---|
| `enabled` | `SKRUM_MCP_ENABLED` | `true` | Off → `routes/ai.php` registers nothing (404 on `/mcp`), the settings page is hidden, existing tokens are kept but unusable. |
| `rate_limit` | `SKRUM_MCP_RATE_LIMIT` | `120` | Requests per minute per token. |
| `write_rate_limit` | `SKRUM_MCP_WRITE_RATE_LIMIT` | `30` | Write/delete tool calls per minute per token. |

### 2.4 Tool base class and availability

`App\Mcp\Tools\SkrumTool` (abstract, extends `Laravel\Mcp\Server\Tool`) declares `requiredScope(): McpScope` and an optional `requiredFeature(): ?McpFeature`, and implements:

- `shouldRegister(Request)`: the grant has the required scope **and** the required feature is available. An unregistered tool is absent from `tools/list` and a call to it fails as `laravel/mcp` does for unknown tools ("Tools without permission are not offered").
- A `handle()` wrapper that re-checks scope and feature (defence in depth), applies the write rate limit to write/delete tools, runs the tool body, and maps exceptions to tool errors (§10).
- Annotations: read tools `#[IsReadOnly]`; write tools `#[IsReadOnly(false)]`; the delete tool `#[IsDestructive]`; all `#[IsOpenWorld(false)]` except the tracker tools (`#[IsOpenWorld]`, they call Jira/Linear).
- Results are `Response::structured([...])` (JSON text fallback included by `laravel/mcp`). Output keys are camelCase; inputs are snake_case.
- Descriptions are English (read by models) and restate each tool's contract sentence. Error messages are translated (§10).

Features (`App\Mcp\McpFeature`), evaluated once per request:

| Feature | Available when | Tools |
|---|---|---|
| `Insights` | an LLM provider is configured (spec 2 §9: provider, key and model set) | `retro.board.insights.list`, `retro.board.suggested_actions.promote`, `retro.board.suggested_actions.reject` |
| `Trackers` | spec 6 is installed, Jira or Linear is enabled on the instance (spec 6 §2.1), **and** at least one team visible to the grant (§4.3) has an `Active` Jira or Linear integration | `poker.sources.list`, `poker.iterations.list`, `poker.game.tasks.import`, `poker.game.task.sync` |

A call for a specific team or game whose team has no `Active` tracker → tool error "This team has no connected tracker." (the tool stays listed because another visible team has one).

## 3. Data model

### `personal_access_tokens` — new table (Sanctum)

Sanctum's published migration, adjusted to the parent spec's identifier rule (AC0) and extended:

| Column | Type | Meaning |
|---|---|---|
| `id` | UUID, primary | Sanctum's `id` column made a UUID (model `HasUuids`) |
| `tokenable_type`, `tokenable_id` | `uuidMorphs('tokenable')` | Always a `User` |
| `name` | string(60) | Label chosen by the user |
| `token` | string(64), unique | SHA-256 of the secret part (Sanctum) |
| `abilities` | json | Scopes: subset of `["mcp:read","mcp:write","mcp:delete"]`, always containing `mcp:read`; `*` is never issued |
| `team_id` | nullable `foreignUuid` → teams, cascade on delete | skrum addition: binding to one team |
| `token_hint` | string(4) | skrum addition: last 4 characters of the plain token, for the list |
| `last_used_at` | nullable timestamp | Sanctum |
| `expires_at` | nullable timestamp, indexed | Sanctum; `null` = never |
| timestamps | | |

- Model `App\Models\PersonalAccessToken extends Laravel\Sanctum\PersonalAccessToken` (`HasUuids`, `team()` relation, `scopes()` returning `McpScope[]`, `isExpired(CarbonInterface $now)`). Registered with `Sanctum::usePersonalAccessTokenModel()`.
- `User` uses Sanctum's `HasApiTokens`.
- Enum `App\Enums\McpScope` (`Read = 'mcp:read'`, `Write = 'mcp:write'`, `Delete = 'mcp:delete'`).
- Plain token format (Sanctum): `{id}|skrum_{40 random characters}{crc32 checksum}` (`sanctum.token_prefix = 'skrum_'`, which also makes leaked tokens detectable by secret scanners). Shown once at creation; only its hash is stored; never logged.
- The list shows `skrum_…` plus `token_hint` (not secret: 4 characters of 48).
- Deleting a bound team deletes its tokens (cascade): the token's purpose is gone.
- `config/sanctum.php`: `guard => []`, `stateful => []`, `expiration => null` (expiry is per token), `token_prefix => 'skrum_'`.

The spec 2 and spec 3 data this spec reads (themes, suggested actions, card sentiment and category, action item `theme_id`) are defined in spec 2 §3 / §6.5 and spec 3 §2 (§12).

## 4. Credentials and scopes

### 4.1 Scopes (contract table, token column)

| Scope | Allows | Token |
|---|---|---|
| `mcp:read` | every read tool and both prompts: retrospectives, messages, action items, metrics, poker games | always |
| `mcp:write` | create and update action items, messages and poker games: every tool of §6.3 | opt-in |
| `mcp:delete` | delete your own messages: `retro.board.messages.delete_own` | opt-in |

`mcp:delete` implies nothing else: a token with `mcp:delete` but not `mcp:write` can delete its own messages but not edit them.

### 4.2 API tokens

- Created on the "API tokens" settings page (§8) by a verified user, after password confirmation (`RequirePassword`, like the security page).
- Fields: name (1–60, unique per user among the user's tokens), permissions (Read fixed; "Create and update" and "Delete my messages" checkboxes), team (optional select of every team the user can view, grouped by workspace; default "All my teams"), expiration (30 days, 90 days — default, 1 year, never).
- At most 25 unexpired tokens per user (422 beyond).
- Issued with `$user->createToken($name, $abilities, $expiresAt)` plus `team_id` and `token_hint`, in `App\Actions\Mcp\IssueMcpToken`. The plain token is returned once through Inertia flash data and shown in a dialog with a copy button, the MCP URL and client configuration snippets; it is never retrievable again.
- **Revoke** deletes the token row (Sanctum convention); the next request with it gets 401.
- Expired tokens stay listed (greyed, "Expired on …") and are deleted 30 days after expiry by the scheduled `sanctum:prune-expired --hours=720` (daily).
- Tokens are not revoked by a password change (independent credentials, as on GitHub); the settings page states it.

### 4.3 Access = token grant ∩ team visibility ∩ binding

For every tool, the target resource must be visible to the user **and** inside the grant:

- **Teams visible**: `TeamPolicy::view` (team members; workspace Owners/Admins see every team of their workspaces, as in the UI — "permissions match the interface exactly"). `App\Mcp\VisibleTeams::for(McpGrant)` returns the team ids once per request, intersected with `teamId` when the token is bound.
- **Boards, poker games, tracker connections**: those of visible teams. **Action items**: `ActionItemQuery` scoped to visible teams. **Messages, suggestions**: those of visible boards.
- A resource outside this set is reported exactly like a missing one: "Not found." (§10). No tool reveals the existence of a resource the user cannot see.
- **UI parity for writes:** every write goes through the same guard/permission classes and action classes as the matching web endpoint (`RetroGuard`, `ActionItemPermissions`, `PokerGuard`, spec 6 §8): same phase, lock, ownership, facilitator and role rules, same validation, same broadcasts. A tool never bypasses a rule the UI enforces and never allows what the UI refuses.
- **UI parity for reads:** every read goes through the same presenters as the board (§9). A tool never returns what the user could not see on the same board at the same moment.
- A user removed from a team loses MCP access to it on the next request. A bound token whose team is no longer visible sees nothing (tools return "Not found." / empty lists); the settings page flags it "No access to this team anymore".

### 4.4 Usage tracking and rate limits

- `last_used_at` is updated by Sanctum on each authenticated request.
- `RateLimiter::for('mcp')`: `config('skrum.mcp.rate_limit')` requests per minute per token (`token:{id}`). Exceeded → HTTP 429 with `Retry-After`.
- Write rate limit: write and delete tools share `config('skrum.mcp.write_rate_limit')` calls per minute per token. Exceeded → tool error "Too many changes, wait a moment." (not an HTTP error, so reads keep working).
- Tool-specific limits: `retro.boards.search` 20 per minute per token; `poker.iterations.list` and `poker.game.tasks.import` share spec 6's browse limit (30 per minute per player).

## 5. Participants and players acting through MCP

- **Reads never create rows.** When reading a board, the viewer is the user's existing participant in it, or `null` when they never joined. Presenters accept a nullable viewer (`PresentCard::handle(Card, Retro, ?Participant)`): with `null`, nothing is "mine", and others' cards are hidden in the phases that hide them.
- **Writes that need a participant** (`retro.actions.create`, `retro.board.suggested_actions.promote|reject`) resolve it like `ResolveParticipant` does for a team member opening the board: `firstOrCreate` on (`retro_id`, `user_id`) (Decision 6). The new participant then appears in the board's participant list like any member who opened it.
- **Writes on own content** (`retro.board.messages.update`, `retro.board.messages.delete_own`) use the existing participant only; without one the user has no message on that board and the tool answers "Not found.".
- **Poker**: the user's `poker_players` row, created on first write like the game page does (spec 4 §3); reads use it when it exists and never create it.
- Guests' identities are never used or created through MCP.

## 6. Tools

The tool set is exactly the contract's 29 tools; no other tool is registered (§6.5). Every id argument is a UUID (tracker ids excepted); a malformed id is a validation error, an unknown or invisible id is "Not found.".

Lists take `limit` (default 20, max 50 unless stated) and `page` (default 1) and return `{items, page, hasMore}`. Every board, action item and poker game carries an absolute `url` to open it in skrum (`/retros/{id}`, `/w/{workspace}/action-items?item={id}`, `/poker/{id}`). No payload contains an email address, a retro guest token or guest URL, a guest secret, or any credential.

Shared shapes:

- **Board**: `{id, title, teamId, teamName, phase, isFinished, isAnonymous, participantCount, messageCount, openActionItemCount, createdAt, completedAt, url}` (`isFinished` = phase `Completed`).
- **Action item**: spec 3 `PresentActionItem` (id, `retroId` exposed as `boardId`, teamId, content, priority, dueOn, isOverdue, status, completedAt, assignee `{kind: member|guest, id, name, avatarUrl, isTeamMember}`, createdBy, isMine, commentCount, source, themeId, themeName, createdAt; `externalLinks` once spec 6 exists) plus `url`. Always named, including on anonymous boards (spec 3 Decision 5).

### 6.1 Retrospectives — read (`mcp:read`)

| Tool | Arguments | Behaviour / returns |
|---|---|---|
| `retro.teams.list` | `workspace_id?` | Visible teams, alphabetical: `{id, name, workspaceId, workspaceName, isMember, finishedBoards, unfinishedBoards}` (counts of `Completed` and not-`Completed` retros). |
| `retro.team.members.list` | `team_id` | The team's roster (`team_user`), each with the workspace role as `permission` (`owner` \| `admin` \| `member`): `[{userId, name, avatarUrl, permission}]`. These user ids are the valid `assignee_user_id` values (spec 3: assignees must be team members). No emails. |
| `retro.boards.list` | `team_id`, `since?`, `until?` (dates, on `created_at`), `finished_only?` (bool, default false), `limit`, `page` | The team's retros, newest first, as Board. |
| `retro.boards.search` | `query` (2–100), `team_id?`, `limit` (max 20) | Case-insensitive keyword search (`ILIKE`, wildcards escaped) across board titles, spec 2 summaries, action item contents and message contents. Messages the viewer could not see on the board (hidden-phase cards of others) are excluded in SQL, not filtered afterwards. Returns `[{board, matches: [{kind: title\|summary\|action\|message, id, snippet}]}]` (snippet ≤ 160 characters around the match; `id` null for title and summary). |
| `retro.actions.list` | `team_id?`, `workspace_id?`, `status?` (`open` default \| `overdue` \| `completed` \| `all`), `assignee?` (`me` \| `unassigned` \| user id), `limit`, `page` | Action items across every board of the visible teams at once: `ActionItemQuery` per visible workspace, results merged in spec 3 §6 order (overdue first, then due date, priority, created date). |
| `retro.board.messages.list` | `board_id`, `column_id?`, `sort?` (`position` \| `votes`), `limit` (max 200), `page` | Messages grouped by template column: `{columns: [{id, title, description, messages: [Message]}]}`. **Message** = top-level card through `PresentCard` with the viewer of §5: `{id, hidden, content, author (null on anonymous boards except own), isMine, votes (total, null when the board hides totals), sentiment, category, reactions: [{emoji, count}], commentCount, gif: {url} \| null, grouped: [Message]}`. `sentiment` (`positive` \| `neutral` \| `negative`) and `category` (short label, ≤ 40 characters) are the spec 2 card columns (§6.5) and are `null` when unavailable (no provider, opted out, not generated yet, or hidden card). `sort=votes` is refused ("Vote totals are not visible yet.") while totals are hidden. |
| `retro.board.summary.get` | `board_id` | `{board, summary: {text, generatedAt, provider} \| null, summaryStatus: pending\|ready\|failed\|null, participants: [{name, avatarUrl}]}`. `summary` is the spec 2 results summary; it is `null` when the board is not `Completed`, when it was opted out, when no provider is configured, or while not `ready`. Participants are listed on anonymous boards too (spec 2 §6.2: who joined, never who wrote what). |
| `retro.board.actions.list` | `board_id` | The board's action items, in board order (`created_at`), with status, priority and assignee. |
| `retro.board.insights.list` | `board_id` | Feature `Insights`. Mirrors the board snapshot's `insights` (spec 2 §10.3). Board before `Discussing` → `{status: "not_available", themes: [], suggestedActions: []}` (a normal result). Otherwise `{status, generatedAt\|null, themes: [{id, name, messageCount, messageIds, sentiment: {positive, neutral, negative}}], suggestedActions: [{id, content, themeId\|null, themeName\|null, status: pending\|promoted\|rejected, actionItemId\|null}]}` where `status` is the retro's `summary_status` (`pending` \| `ready` \| `failed`, `not_available` when never requested or removed) and the lists are empty when nothing was generated (opted out, pending, failed, removed; handled suggestions stay listed, as on the board). `sentiment` counts the theme's cards per sentiment. |
| `retro.board.health.get` | `board_id` | Health check disabled with no answers, or no answers → `{status: "not_run"}` (normal result). Phase `HealthCheck` → `{status: "in_progress", categories: [{key, label, answers, answeredBy}]}` (`answeredBy` names, `[]` on anonymous boards) + `myScores` of the user's participant. Past `HealthCheck`, not `Completed` → `{status: "collected", respondents}` (averages appear only on completion, as in the UI). `Completed` → `{status: "completed", categories: [{key, label, average\|null, answers, alignment\|null}], score, alignment, alignmentLevel, turnout: {respondents, participants}, topStrength, growthArea, assessment, trend: [{boardId, title, completedAt, score, delta, url}]}` from `SummarizeHealthCheck` and the spec 2 §4.5 trend. Every category with at least one answer reports its average, whatever the number of answers (spec 2 Decision 1). |
| `retro.board.roti.get` | `board_id` | Before `Discussing` → `{status: "not_started"}`. `Discussing` → `{status: "collecting", respondents, myScore}`. `Completed` → `{status: "completed", average\|null, distribution: [{score: 1..5, count}], respondents, myScore, trend}` where `trend` = the last 6 `Completed` boards of the team with at least one rating (this one included), oldest first: `[{boardId, title, completedAt, average, respondents, url}]`. Average and distribution are shown whatever the number of ratings (spec 2 Decision 9). |

### 6.2 Planning poker — read (`mcp:read`)

| Tool | Arguments | Behaviour / returns |
|---|---|---|
| `poker.sources.list` | `team_id` | Feature `Trackers`. The team's Jira/Linear integrations (spec 6 §3), enabled providers only: `[{source: jira\|linear, siteName, status: active\|setup_required\|reconnect_required, access: read\|write, canImport, canWriteBack, writeBackUnavailableReason\|null}]`. `canImport` = `status` active; `canWriteBack` = active and `write` access (and, for Jira, a story points field found). `[]` for a team without trackers. Credentials and `last_error` details are never returned. |
| `poker.iterations.list` | `team_id`, `source`, `container_id?` | Feature `Trackers`; same permission as spec 6 browsing (a non-guest who can add tasks, i.e. any team viewer). Without `container_id` → `{containers: [{id, name}], iterations: []}` (Jira scrum boards / Linear teams, first 50, spec 6 §6.2). With it → `{containers: null, iterations: [{id, name, state: active\|upcoming, startsOn\|null, endsOn\|null}]}` (Jira sprints `active,future`; Linear cycles not completed). |
| `poker.games.list` | `team_id`, `status?` (`active` default \| `ended` \| `all`), `limit`, `page` | Newest first: `{id, title, deck, tasksCount, estimatedCount, totalPoints\|null, endedAt\|null, createdAt, url}`. |
| `poker.game.get` | `game_id` | `{game: {id, title, deck, deckLabel, cards, isNumeric, endedAt, tasksCount, estimatedCount, totalPoints, url, guestJoinUrl\|null}, facilitator: {name}, players: [{name, avatarUrl, isGuest}], currentTask: null \| {id, title, round: {number, revealed, votesCount, voters: [{name, hasVoted}], myVote\|null, result\|null}}, me: {isPlayer, isFacilitator, canEditTasks}}`. `url` is the join link for team members; `guestJoinUrl` is the guest link, present only when guest access is on (the UI's share dialog shows it to every non-guest player). Unrevealed values are redacted by `BuildPokerSnapshot` (spec 4 §5). |
| `poker.game.tasks.list` | `game_id` | Tasks in order: `{id, title, description (Markdown source), position, isCurrent, estimate\|null, estimatedAt\|null, roundsCount, latestRound: {number, revealed, votes: [{player, value\|null}], result\|null} \| null, external: null \| {source, key, url, syncState, syncError}}`. `votes` carry every value of a revealed round and, for an unrevealed round, only who has voted (`value: null`) except the viewer's own value. `external` follows spec 6 §6.6 for non-guest players and is `null` until spec 6 exists. |

### 6.3 Write — requires `mcp:write`

| Tool | Arguments | Rules / returns |
|---|---|---|
| `retro.actions.create` | `board_id`, `content` (1–500), `priority?`, `due_on?`, `assignee_user_id?` \| `assignee_participant_id?` | `CreateActionItem` with the **board** rules (Decision 9): participant of §5, board in `Discussing`, not locked (423). Assignee: a member of the board's team (`assignee_user_id`) or a participant of this board (`assignee_participant_id`, normalized to the user id for members, so only guests stay participant-assigned) — spec 3 §3. The item is created under the user's name even on anonymous boards (the tool description says so). Returns the action item. |
| `retro.actions.update` | `action_id`, any of `content`, `priority`, `due_on` (or `null`), `assignee_user_id` (or `null`), `assignee_participant_id` | `UpdateActionItem` with the **workspace** surface rules (spec 3 §3: no phase rule, 423 when the item's board is locked and not `Completed`); permissions via `ActionItemPermissions::canEdit` with `ActionItemActor(user, participant?)` (managers). `assignee_participant_id` (a guest of the item's board) is accepted only under the board rules (board in `Discussing`, not locked), because the UI offers guest assignment only there. |
| `retro.actions.complete` | `action_id`, `completed` (bool, default `true`) | `SetActionItemStatus`, workspace surface rules; allowed for managers, the assignee and the review facilitator (spec 3 §4). `false` reopens. Idempotent. |
| `retro.board.suggested_actions.promote` | `board_id`, `suggested_action_id` | Feature `Insights`. Spec 2's `PromoteSuggestedAction` with the board's rules (spec 2 §6.5, Decision 10): suggestion `pending` (else "This suggestion was already handled."); board in `Discussing` (any participant, i.e. the user's participant of §5; locked → 423) or `Completed` (only the board's facilitator or a workspace Owner/Admin; the lock does not apply); other phases refused. Creates the action item through spec 3's `CreateActionItem` with the suggestion's `content` unchanged and its `theme_id`, priority Medium, unassigned, author = the user's participant; marks the suggestion `promoted` with `action_item_id`, `handled_by_participant_id`, `handled_at`. Returns `{suggestedAction, actionItem}`. |
| `retro.board.suggested_actions.reject` | `board_id`, `suggested_action_id` | Feature `Insights`. Spec 2's `RejectSuggestedAction`: same permission, phase, lock and state rules; marks the suggestion `rejected`. Returns `{suggestedAction}`. |
| `retro.board.messages.update` | `message_id`, `content` (1–1000) | Own message only (card of the user's participant); `UpdateCard` with the same phase and lock rules as `PATCH /retros/{retro}/cards/{card}`. The card's GIF is unchanged. Broadcasts as the web endpoint. Returns the message. |
| `poker.games.create` | `team_id`, `title` (1–120), `deck` (`fibonacci` \| `modified_fibonacci` \| `tshirt` \| `powers_of_two` \| `custom`), `custom_cards?` (2–20), `include_unknown?`, `include_coffee?` (default true) | `CreatePokerGame`, same validation as the web form; the user becomes player and facilitator; guest access off. Returns the game as in `poker.game.get`. |
| `poker.game.tasks.add` | `game_id`, `tasks: [{title (1–200), description? (≤ 10 000, Markdown)}]` (1–50 items) | `AddPokerTask` per task: facilitator or non-guest player, game not ended; appended in the given order; the 200-task limit applies to the total (all-or-nothing). One `task.saved` per task. |
| `poker.game.tasks.import` | `game_id`, `source` (`jira` \| `linear`), exactly one of `iteration_id` (+ `container_id` for Jira) or `query` (1–1000: JQL for Jira, search term for Linear) | Feature `Trackers`. Spec 6 §6.3 through its import action: players who can add tasks, game not ended, `Active` integration of that source on the game's team. The server fetches the issues (as the spec 6 preview, at most 100) and imports all of them in source order; already imported issues are skipped; the 200-task limit applies to the batch. Returns `{imported, skipped, truncated}` (`truncated` when the source had more than 100 matches). |
| `poker.game.task.select` | `game_id`, `task_id` (or `null`) | `SelectPokerTask`: facilitator only, game not ended (spec 4 `PUT current-task` rules; round 1 created when missing). Returns `currentTask` as in `poker.game.get`. |
| `poker.game.task.reveal` | `game_id`, `task_id` | Facilitator only; `task_id` must be the current task ("This task is not on the table."); its latest round must be unrevealed ("These cards are already revealed.") with at least one vote (spec 4 reveal rules). Reveals through `RevealPokerRound`, then computes the estimate from the votes cast: the card the UI would preselect — `nearestCard` for a numeric deck, the single `mode` for a non-numeric deck — stored with the spec 4 estimate action (`estimate`, `estimate_numeric`, `estimated_at`; spec 6 write-back follows automatically for imported tasks). When no card is determined (no countable vote, or a tie between modes) the estimate is left unchanged. Returns `{round (revealed, with values and result), estimate\|null, estimateSet: bool, reason\|null}`. The facilitator can still change the estimate in the UI. |
| `poker.game.task.sync` | `task_id` | Feature `Trackers`. Facilitator only (spec 6 §8). Imported task with an estimate; the integration of its source is `Active`, `write`, same site. Same service as spec 6's `POST tasks/{task}/sync` (§6.5, §9.1): dispatches `SyncTaskEstimate` whether `needs_sync` is true (retry) or false (forced rewrite of the current estimate) and returns `{syncState: "pending"}`. No estimate, or unsupported (non-numeric deck, read-only access, other site) → tool error with the spec 6 reason. |

All action item mutations broadcast through `BroadcastActionItemChange` exactly as the web endpoints do; with no socket id, every open board receives them. Poker mutations dispatch the spec 4/6 events.

### 6.4 Delete — requires `mcp:delete`

| Tool | Arguments | Rules / returns |
|---|---|---|
| `retro.board.messages.delete_own` | `message_id` | Own message only; `DeleteCard` with the same rules as `DELETE /retros/{retro}/cards/{card}`. Returns `{deleted: true}`. |

### 6.5 Closed tool set and deliberately impossible actions

- The registered tool names are exactly the 29 names above; a test compares `tools/list` (all scopes, all features) with this list.
- Deliberately impossible (contract): **setting a poker estimate directly** — no tool takes an estimate value; the only way an estimate is written through MCP is `poker.game.task.reveal` computing it from revealed votes; — and **voting on the user's behalf** — no tool plays or withdraws a poker card. Beyond the contract list, and for the same reason (a person's own judgement or running the meeting), there is no tool to vote on cards, answer the health check, a survey or ROTI, react, comment, create cards, re-vote, or change phase, timer, settings, facilitation or guest access.

### 6.6 Shared actions (change to earlier specs and existing code)

MCP tools call the same action classes as the controllers. Where logic lives in controllers today it is extracted, with no behaviour change, and the controllers call the actions:

- `app/Actions/Retros/UpdateCard`, `DeleteCard` (from `CardsController`), each taking a `Participant` actor and running the existing guards, locks and broadcasts.
- Spec 3 §9 actions; spec 4 `app/Actions/Poker/*` (`CreatePokerGame`, `AddPokerTask`, `SelectPokerTask`, `RevealPokerRound`, `SetPokerEstimate`); spec 6 import and sync actions; spec 2 §6.5 `PromoteSuggestedAction`, `RejectSuggestedAction`.
- Guards throw the existing exceptions (`AuthorizationException` → forbidden, `HttpException(423)` → locked, `ValidationException` → validation, `ModelNotFoundException` → not found); the tool base maps them (§10).

## 7. Prompts

Both require `mcp:read` only, validate their argument against visibility (§4.3), and return a user message containing instructions plus the data as quoted JSON, built by calling the read tools' presenters (so redaction is identical). They never call an LLM on the skrum side. The instructions ask the model to answer in the user's language (`users.locale`) and never to guess authors of anonymous messages.

| Prompt | Arguments | Content |
|---|---|---|
| `analyze-retro` | `board_id` | `retro.board.summary.get` + `retro.board.insights.list` (themes and suggested actions, when the feature is available) + `retro.board.actions.list` (agreements) + `retro.board.health.get` + `retro.board.roti.get` + `retro.board.messages.list` (sorted by votes when visible). Instructions: key themes, risks, what to change next time; check that the agreements cover the top themes; point to pending suggestions the user may promote. |
| `team-health` | `team_id` | For the team's last 6 `Completed` boards: health score trend (with per-category averages), ROTI trend, agreements created and how many are completed (count and ratio, plus the currently open and overdue items), and recurring themes (spec 2 themes per board when available, otherwise the top 5 most-voted messages per board). Instructions: describe the trends, strongest and weakest categories, how many agreements get closed, what keeps repeating; say "health check not run yet" when there is no data. |

Content embedded in a prompt is capped at 60 000 characters (messages beyond the cap are dropped lowest-voted first, with a note).

## 8. Settings UI

All strings in `lang/{en,fr,es,de}.json`. Settings navigation (`resources/js/layouts/settings/layout.tsx`) gains "API tokens" when `skrum.mcp.enabled` (shared Inertia prop `features.mcp`).

### 8.1 API tokens (`/settings/api-tokens`, `resources/js/pages/settings/api-tokens.tsx`)

- Intro: what MCP is, the server URL `{APP_URL}/mcp` with a copy button, and the note "Use a client that can send an Authorization header (Claude Code, Cursor, VS Code…). Web connectors that require a sign-in are not supported yet."
- "Create token" (behind password confirmation) → dialog: name, "Read" (checked, disabled), "Create and update", "Delete my messages" (with the hint "Lets the client delete messages you wrote."), team select ("All my teams" default), expiration select (30 days, 90 days, 1 year, Never).
- After creation: dialog "Copy your token now. You won't be able to see it again." with the token, copy button, and a snippet tab set (Claude Code: `claude mcp add --transport http skrum {url} --header "Authorization: Bearer {token}"`; generic JSON `{"mcpServers":{"skrum":{"type":"http","url":…,"headers":{"Authorization":"Bearer …"}}}}`).
- Table: name, `skrum_…abcd` hint, permission badges, team (or "All teams"; "No access to this team anymore" warning), created, expires ("Never"), last used ("Never"), status (active / expired), "Revoke" (confirmation dialog).
- Notices: "Data you read through this connection is sent to the AI application you use." and "Tokens stay valid after a password change. Revoke them here."
- Empty state: "No API tokens yet."

### 8.2 Endpoints (web, `auth` + `verified`)

| Method | Path | Name | Notes |
|---|---|---|---|
| GET | `/settings/api-tokens` | `apiTokens.index` | Inertia page |
| POST | `/settings/api-tokens` | `apiTokens.store` | `RequirePassword`, `throttle:10,1`; redirect back with flash `newToken` |
| DELETE | `/settings/api-tokens/{token}` | `apiTokens.destroy` | Own tokens only (404 otherwise) |

Controller `App\Http\Controllers\Settings\ApiTokensController` (`index`, `store`, `destroy`); actions `App\Actions\Mcp\IssueMcpToken`, `RevokeMcpToken`. All routes 404 when MCP is disabled.

### 8.3 Results view (spec 2) — suggested actions

The UI counterpart of the suggestion tools is spec 2's "Suggestions" panel (`Discussing`) and Results view section (`Completed`), spec 2 §6.5 and §13; the tools follow the same rules.

## 9. Redaction and privacy

MCP is one more surface; every invariant of the earlier specs holds, enforced by reusing their presenters, never by re-implementing filters in tools:

- **Writing-phase content** (and `HealthCheck`/`Icebreaker`, spec 2 §2.4): others' messages are hidden in `retro.board.messages.list`, `retro.boards.search` and prompts, with the viewer of §5. Their `sentiment` and `category` are `null` too.
- **Anonymous boards:** message authors are omitted for everyone but the author; reaction names are never sent. Action items and their creators and assignees are **always named**, even on anonymous boards (spec 3 Decision 5).
- **Voter identity on cards:** never exposed; vote totals only when the board would show them (board-engagement §9).
- **Health check:** individual scores only to their author (`myScores`); during `HealthCheck` counts and, on non-anonymous boards, who answered; averages, alignment and trend only once `Completed`, for every category with at least one answer (spec 2 Decision 1).
- **ROTI:** individual ratings never; average and distribution only once `Completed`, whatever the number of ratings (spec 2 Decision 9).
- **Surveys:** not exposed through MCP (no survey tool in the contract); `retro.board.summary.get` returns the stored summary text, which by spec 2 contains survey counts only, never voters.
- **Insights:** generated only at `Completed` from revealed content without author information (spec 2 §6.3 and §6.5 input rules apply unchanged); sentiment and category describe a card, never its author, and there is no per-participant aggregate.
- **Poker:** no card value of another player before reveal, including for the facilitator; revealed values are named, as in the game.
- **Identity data:** no emails, retro guest tokens or URLs, guest secrets, IP addresses or credential values in any tool result, prompt, error or log line. The poker guest link (`guestJoinUrl`) is returned only by `poker.game.get`, only when guest access is on, because the game UI shows it to every non-guest player. Plain API tokens are never logged; `Authorization` headers are excluded from exception context.
- **Trackers:** integration credentials and raw provider errors are never returned; `poker.sources.list` returns status and capabilities only.
- **Data leaving the instance:** tool results go to the user's own MCP client and, from there, to whatever model the user chose. skrum does not control that; the API tokens page says "Data you read through this connection is sent to the AI application you use."

## 10. Error handling

Tool failures are MCP tool errors (`Response::error`, `isError: true`) with a translated message in the user's locale (`SetMcpLocale` applies `users.locale`, falling back to `en`); protocol-level failures are HTTP statuses.

| Situation | Result |
|---|---|
| Missing / invalid / revoked / expired token; token without `mcp:read`; unverified email | HTTP 401 + `WWW-Authenticate: Bearer realm="skrum"` |
| MCP disabled | HTTP 404 |
| Request rate exceeded | HTTP 429 + `Retry-After` |
| Tool not granted by the scopes, or its feature unavailable | not listed; calling it → JSON-RPC "tool not found" (as `laravel/mcp` does) |
| Resource missing, invisible, outside the bound team | tool error "Not found." |
| Policy or permission denied (`AuthorizationException`) | tool error with the UI's translated message (e.g. "Only the facilitator can do this.") |
| Phase rule | tool error "This action is not available in the current phase." |
| Board locked (423) | tool error "The board is closed for editing." |
| Suggestion already handled | tool error "This suggestion was already handled." |
| Team without a connected tracker | tool error "This team has no connected tracker." |
| Tracker call failed (spec 6 502, 15 s timeout) | tool error with spec 6's translated message and sanitized provider detail |
| Validation | tool error listing the translated field messages |
| Write rate exceeded | tool error "Too many changes, wait a moment." |
| Unexpected exception | tool error "Something went wrong." (reported to the log without the arguments' content) |

Token creation errors → inline field errors.

## 11. Packaging

- `composer require laravel/mcp laravel/sanctum`; publish `routes/ai.php`, Sanctum's config and migration (adjusted, §3). `php artisan install:api` is not used (no `routes/api.php`).
- `.env.example`: `SKRUM_MCP_ENABLED`, `SKRUM_MCP_RATE_LIMIT`, `SKRUM_MCP_WRITE_RATE_LIMIT`.
- Caddy needs no change (`/mcp` goes to Octane). Streamed responses must not be buffered: the plan verifies `/mcp` through Caddy + Octane in the production image.
- Scheduler: `sanctum:prune-expired --hours=720` (daily).
- README: "Connect an AI assistant" section (URL, token creation, scopes, supported clients, OAuth not supported yet, what is never exposed).

## 12. Changes to other specs

### 12.1 Spec 2 (retro flow extras)

- No change. Themes, suggested actions and card `sentiment` / `category` are spec 2's (§3, §6.5, Decision 10): tables `retro_themes`, `retro_theme_cards`, `suggested_actions`, columns `cards.sentiment` / `cards.category`, state in `retros.summary_status`. The suggestion tools call spec 2's `PromoteSuggestedAction` / `RejectSuggestedAction` with its permission, phase and lock rules; the board UI (Suggestions panel, Results view, card chips) is spec 2's.

### 12.2 Spec 3 (action items v2)

- No change. `action_items.theme_id`, `themeId` / `themeName` in `PresentActionItem` and the promotion path of `CreateActionItem` are defined in spec 3 §2, §3 and §5.

### 12.3 Specs 4 and 6

- No rule change. `poker.game.task.reveal` chains the existing reveal and estimate actions with the preselection rule of spec 4 §3 (step 6); spec 6's write-back follows from the estimate change as in spec 6 §6.5. `poker.game.task.sync` and `poker.sources.list` use spec 6's services and payloads (§9.1).

### 12.4 Core and board engagement specs

- No rule change. `CardsController` logic is extracted into `UpdateCard` / `DeleteCard` (§6.6) with identical behaviour for the board.

## 13. Testing

Pest feature tests in `tests/Feature/Mcp/`. Tool tests use `laravel/mcp`'s helpers (`SkrumServer::actingAs($user)->tool(Tool::class, [...])`) with an `McpGrant` bound for the test (helper `actingAsMcp(User, scopes, ?team)`); protocol and auth tests post JSON-RPC to `/mcp` with a real Sanctum token. `Event::fake()` for broadcasts; `Http::fake()` with `Http::preventStrayRequests()` for tracker tools; `config()` overrides for the LLM provider and integrations.

- **Authentication:** no header → 401 with `WWW-Authenticate`; valid token → 200; wrong, revoked (deleted), expired token → 401; session cookie without bearer → 401 (Sanctum session fallback disabled); unverified user → 401; MCP disabled → 404; only the token hash is stored and the plain token never appears in logs.
- **Tool catalogue:** with all scopes and features, `tools/list` equals the 29 contract names exactly; prompt list equals `analyze-retro`, `team-health`.
- **Scope gating:** `tools/list` for read, read+write, read+delete, read+write+delete returns exactly the expected names; calling a hidden tool fails.
- **Feature gating:** without an LLM provider the three insight tools are absent; with a provider, `retro.board.insights.list` on a board without insights → `not_available` with empty lists and promote/reject → "Not found."; without spec 6 providers, or when no visible team has an `Active` Jira/Linear integration, the four tracker tools are absent; with one team connected, a call for another team → "This team has no connected tracker."
- **Membership and binding:** a Member cannot read or write another team's board, message, action item, suggestion, poker game (→ "Not found."), including through `retro.boards.search`, `retro.actions.list` and the prompts; Owner/Admin sees all teams of their workspace; a token bound to team A sees nothing of team B; removing the user from team A empties the bound token's results; another workspace is invisible.
- **Rules parity (one test per rule):** `retro.actions.create` outside `Discussing` refused and when locked → locked message; guest assignee of the board accepted, guest of another board refused; `retro.actions.update` on a locked in-progress board → locked message, by a non-manager refused, `assignee_participant_id` outside `Discussing` refused; `retro.actions.complete` by the assignee allowed; promote/reject before `Discussing` refused, in `Discussing` by any team member allowed and refused while locked, in `Completed` by a member who is neither the facilitator nor a workspace Owner/Admin refused (lock ignored), twice → "already handled"; promote creates an item with the unchanged wording and the suggestion's `theme_id`; `retro.board.messages.update` on another's message → "Not found.", in a phase the UI refuses → refused; `delete_own` on another's message → "Not found."; `poker.game.task.select` / `reveal` / `sync` by a non-facilitator refused; `poker.game.tasks.add` beyond 200 tasks → nothing added; ended game → refused.
- **Reveal estimate:** numeric deck → nearest card stored (tie → higher card); T-shirt → single mode stored; tied modes or only `?`/`☕` → estimate unchanged and `estimateSet: false`; non-current task and already revealed round refused; zero votes refused; no tool accepts an estimate value or a vote.
- **Tracker tools:** sources list status/capabilities without credentials; iterations with and without `container_id`; import skips existing issues, reports `truncated`, respects the 200 limit; sync dispatches when `needs_sync` is true (retry) and false (forced rewrite), refuses a task without estimate and unsupported tasks.
- **Participant creation:** reads never create participants or poker players; `retro.actions.create` and promote create the participant once; `retro.board.messages.update` without a participant → "Not found.".
- **Redaction:** `retro.board.messages.list`, `retro.boards.search` and `analyze-retro` return no content, sentiment or category of others' cards in `Writing` (search does not match hidden content); anonymous boards expose no message author but the user's own, while action items are named; no vote-by-participant data anywhere; vote totals hidden when the board hides them; `retro.board.health.get` never returns another participant's score and no average before `Completed`, and returns an average with a single answer once `Completed`; `retro.board.roti.get` returns no distribution before `Completed`; `poker.game.get` / `poker.game.tasks.list` contain no other player's value before reveal (facilitator included); no result contains an email address, a retro `guest_token` or guest URL (asserted over every tool's output in a data-provider test); `guestJoinUrl` only when poker guest access is on.
- **Broadcasts:** MCP mutations dispatch the same events as the web endpoints, to everyone (no socket exclusion).
- **Summary and health:** `retro.board.summary.get` returns `null` summary when opted out, without provider, and while pending; `retro.board.health.get` `not_run` / `in_progress` / `collected` / `completed`; health trend matches spec 2; ROTI trend lists the last 6 completed boards with ratings.
- **Prompts:** both validate visibility, embed redacted data only, respect the size cap, and omit insights when the feature is unavailable.
- **Insights (spec 2 data):** `retro.board.insights.list` and `retro.board.messages.list` return the themes, suggestions and card `sentiment` / `category` stored by spec 2's job (faked provider response), `not_available` before `Discussing`, and the same pending/handled states as the board snapshot; promoting or rejecting through MCP and through spec 2's endpoints produces the same rows and broadcasts.
- **Tokens UI:** create requires password confirmation; name uniqueness; 25-token limit; team must be viewable; abilities always include `mcp:read` and never `*`; expiry options; plain token only in the creation response; revoke deletes; other users' tokens → 404; expired tokens pruned 30 days after expiry.
- **Rate limits:** request limit → 429; write limit → tool error while reads still succeed.
- **Migration:** `personal_access_tokens` uses UUID ids and UUID morphs (extends the identifier test of parent AC0).
- **Translations:** every new key in all four locales (`TranslationKeysTest`).
- **Manual walkthrough:** connect Claude Code with a token bound to one team (read + write + delete) to a local instance; ask for the last retro's summary and insights, promote a suggestion, list overdue action items, complete one (the open board updates live), add poker tasks, select one, vote in the browser, reveal through MCP and see the estimate appear; confirm hidden Writing-phase cards and anonymous authors never appear; revoke the token and confirm the client is refused.

Type-check and lint stay green; no frontend test runner is added.

## 14. Acceptance criteria

1. `{APP_URL}/mcp` serves an MCP server over streamable HTTP, authenticated only by a Sanctum API token sent as a bearer header; sessions and cookies never authenticate it; it is absent when `SKRUM_MCP_ENABLED=false`.
2. OAuth sign-in is not offered (deliberate deviation from the contract, §1.3).
3. API tokens are shown once, stored hashed, always include `mcp:read`, opt into `mcp:write` and `mcp:delete`, optionally bind to one team, expire as chosen (default 90 days) and can be revoked; `last_used_at` is tracked.
4. The tool set is exactly the contract's 29 tools with its names; the prompts are exactly `analyze-retro(board_id)` and `team-health(team_id)`.
5. Tools outside the token's scopes, insight tools without an LLM provider, and tracker tools without spec 6 and a connected tracker on a visible team are neither listed nor callable.
6. Every tool's access is scope ∩ team visibility (∩ bound team), with invisible resources reported as not found; every write applies exactly the UI's phase, lock, ownership, facilitator and role rules through shared action classes (`retro.actions.create` in `Discussing` only).
7. No tool sets a poker estimate directly or votes; `poker.game.task.reveal` stores the card the UI would preselect from the revealed votes.
8. Writing-phase content, anonymous message authors, card voter identity, individual health scores and ROTI ratings, and unrevealed poker values stay hidden through MCP exactly as in the UI; action items stay named; no email address, retro guest token or secret is ever returned.
9. Themes, suggested actions, card sentiment and category are spec 2's (§6.5); promote creates an action item keeping wording and theme, reject dismisses, with spec 2's rules; each suggestion is handled once.
10. Prompts return redacted data with instructions and never call an LLM from skrum.
11. Settings offer "API tokens"; revoking a token takes effect on the next request.
12. Request and write rate limits apply per token. Guests have no MCP access.
13. All new strings are translated in en/fr/es/de; suite, phpstan, type-check and lint are green; the only new dependencies are `laravel/mcp` and `laravel/sanctum`; the walkthrough passes.

## Decisions (2026-09-30)

1. **Credentials:** Sanctum API tokens only (Passport and OAuth dropped by user decision 2026-09-30).
2. **Dependencies approved:** `laravel/mcp`, `laravel/sanctum`.
3. **Token storage:** Laravel Sanctum personal access tokens (abilities = MCP scopes, built-in `last_used_at` and `expires_at`), with a custom token model adding the nullable `team_id` binding (and the display hint).
4. (removed — no OAuth)
5. **Token expiry:** selectable 30 days / 90 days / 1 year / never, default 90 days.
6. **Participant rows:** created on first write, like opening the board.
7. **Board writes:** per the QRetro contract — update and delete own messages only; no comment tools. This supersedes the earlier answer "own cards + comments" because the contract is binding.
8. **Instance default:** MCP on; `SKRUM_MCP_ENABLED=false` disables it.
9. **`retro.actions.create`:** same rule as the UI — `Discussing` only, not locked.
10. **Contract:** tool set, names, scopes and prompts follow `docs/superpowers/research/qretro/mcp-readme.md`; the only deviations are those of §1.3 (no OAuth sign-in, tracker and insight tools conditional, no registry manifest).
