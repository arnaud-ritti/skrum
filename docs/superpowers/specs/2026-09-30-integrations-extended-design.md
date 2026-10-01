# Skrum — Integrations extended — Design

Date: 2026-09-30
Status: Approved decisions, awaiting spec review
Parent spec: `docs/superpowers/specs/2026-09-29-integrations-design.md` (spec 6: configuration pattern, `team_integrations`, `action_item_external_links`, `integration_deliveries`, `integration_user_mappings`, poker sync columns, clients, delivery jobs, privacy rules — all apply unless this spec says otherwise). Tenancy, roles, guests, redaction, i18n and packaging follow `docs/superpowers/specs/2026-09-29-retro-board-core-design.md`; latest conventions `docs/superpowers/specs/2026-09-29-board-engagement-design.md`.
Builds on specs `2026-09-29-retro-flow-extras-design.md` (spec 2: `Completed` phase, Results recap), `2026-09-29-action-items-v2-design.md` (spec 3: status, `CreateActionItem`, `SetActionItemStatus`, `ActionItemCompleted`), `2026-09-29-planning-poker-design.md` (spec 4: tasks, decks, `SetPokerEstimate`) and `2026-09-29-mcp-server-design.md` (spec 5: `poker.sources.list` and the other tracker tools).
Research: `docs/superpowers/research/qretro/` (QRetro parity roadmap, spec 8 of 8; `docs-inventory.md` § Integrations, `research.md` § Integrations)

## 1. Intent

Spec 6 ships one-way, one-shot integrations with Slack, Telegram, email, Jira Cloud and Linear. This spec adds what spec 6 deferred: **two-way status sync** — an action item completed in skrum closes its Jira/Linear/GitHub issue and vice versa, and imported poker tasks follow their source automatically — and **more providers**: Jira Server/Data Center, GitHub Issues, Microsoft Teams, Mattermost and generic outgoing webhooks, the latter also carrying **automatic events** a team subscribes to. It only extends spec 6's model and services; the rules there (server-only calls, encrypted credentials, redaction, Owners/Admins manage) stay.

**Success:** every rule below is covered by a feature test (provider APIs faked with `Http::fake()` and `Http::preventStrayRequests()`) or a walkthrough step (§13); with none of this spec's env variables set and status sync off, behaviour is exactly spec 6's; a forged or replayed inbound webhook can at most cause a re-read of an issue skrum already tracks; a generic webhook sends automatic events only for the events an Owner/Admin ticked; suite, phpstan, type-check and lint stay green; no new Composer or npm dependency.

### In scope

- **Two-way status sync** (opt-in per tracker integration): exported action items ↔ issue open/done state; imported poker tasks refreshed automatically (title, description, assignee, source estimate, status). Inbound through signed webhooks when `APP_URL` is publicly reachable, otherwise scheduled polling (user decision "Webhooks + polling fallback"). "Done" mapping per workflow, conflict rules, loop prevention.
- **Jira Server / Data Center**: OAuth 2.0 application link (preferred, Jira DC 8.22+) **and** a personal access token pasted by an Owner/Admin as a fallback for older servers (8.14+) (decision 4). Everything Jira Cloud does in spec 6 (import, refresh, write-back, export with assignee/priority mapping) plus status sync.
- **GitHub Issues** (GitHub App): poker import by milestone or search, estimate write-back into a managed block of the issue body (decision 5), action item export with assignee mapping, status sync.
- **Microsoft Teams** and **Mattermost**: share a board/poker link, a game room invite (spec 7 §3.1) and the results recap, as Slack in spec 6 §5.
- **Generic outgoing webhooks**: the same manual shares (links, game room invites, recap) as signed JSON POSTs to a URL of the team's choice, plus **automatic events** chosen per webhook by Owners/Admins (`retro.completed`, `action_item.created`, `action_item.completed`, `action_item.reopened`, `poker.task.estimated`), with retries, a delivery log and automatic disabling after repeated failures (decision 7).

### Out of scope (deferred)

- Field sync beyond status: content, due date, priority and assignee of an exported action item stay one-shot (spec 6 decision 6 for fields). Comments are never synced.
- Creating skrum action items from tracker issues; importing issues outside poker.
- Automatic event notifications to Slack, Telegram, email, Teams and Mattermost: spec 6 kept them out of scope and so does this spec; only generic webhooks get events (§4.7). Events beyond the catalogue of §4.7 (retro started, item assigned/overdue, card events). `ActionItemAssigned` stays unsubscribed.
- Redelivering a past webhook delivery (payloads are not stored, §4.7).
- GitHub Projects (v2) fields, GitLab, Azure DevOps, Asana, Trello, ClickUp, Google Chat, Discord, Rocket.Chat.
- Several connections per provider per team (spec 6 unique key stays): one Teams webhook, one Mattermost webhook, one generic webhook, one GitHub installation, one Jira DC server per team.
- Several Jira Data Center servers per instance (one base URL in env).
- Teams/Mattermost bots, slash commands, interactive buttons, inbound messages.
- Jira Cloud Connect/Forge apps; Jira DC basic auth (username/password); Jira DC older than 8.14.
- GitHub estimate write-back to labels or Projects (v2) fields.

### Dependencies

- **None new.** All providers are called with Laravel's HTTP client. The GitHub App JWT (RS256) is signed with PHP's `openssl_sign` (ext-openssl, already in the Docker image); `firebase/php-jwt`, present only transitively in `composer.lock`, is not relied on. IP range checks use `filter_var` with `FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE` plus explicit ranges (§4.5). DNS pinning uses Guzzle's `curl` option `CURLOPT_RESOLVE` through `Http::withOptions()`.
- Queue worker and scheduler services as in spec 6.

### Settled by earlier specs

- Spec 6: provider enum `IntegrationProvider` with `isEnabled()` modelled on `App\Enums\SsoProvider::requiredConfigKeys()` (`app/Enums/SsoProvider.php`); `team_integrations` unique (`team_id`, `provider`); `ReconnectRequired` state; token refresh under lock; delivery jobs and retries (§5.5); recap content and exclusions (§5.2, §10); poker import/refresh/write-back (§6); export and `integration_user_mappings` (§7); decision 1 (Owners/Admins manage), decision 4 (automatic write-back), decision 5 (imported title/description read-only), decision 6 (one-shot export — stays the behaviour whenever status sync is off).
- Spec 3: status `open`/`completed` through `completed_at`; `CreateActionItem` creates every item; `SetActionItemStatus` dispatches `ActionItemCompleted` (no listeners until now); action items are always named (decision 5).
- Spec 4: deck card labels are 1–8 characters; `?` and `☕` are never an estimate; `SetPokerEstimate` sets or clears a task's estimate.
- Spec 5: `poker.sources.list` lists "which issue trackers a team has connected and what each can do"; the `Trackers` feature gate (§2.4).

## 2. Configuration and availability

### 2.1 Env variables (`config/services.php`)

| Provider / feature | Env | Config keys | Enabled when |
|---|---|---|---|
| Jira Data Center | `JIRA_DC_BASE_URL`, optional `JIRA_DC_CLIENT_ID` + `JIRA_DC_CLIENT_SECRET` (OAuth), `JIRA_DC_PERSONAL_TOKENS` (default `true`) | `services.jira_dc.*` | base URL set (http(s), no path beyond an optional context path) **and** at least one method available: OAuth (both client values set) or personal tokens (`JIRA_DC_PERSONAL_TOKENS` true) |
| GitHub Issues | `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY` (PEM, `\n`-escaped) or `GITHUB_APP_PRIVATE_KEY_PATH`, optional `GITHUB_APP_WEBHOOK_SECRET` | `services.github_app.*` (distinct from SSO's `services.github`) | id, slug, client id/secret and a key set |
| Microsoft Teams | `MSTEAMS_ENABLED=true`, optional `MSTEAMS_ALLOWED_HOSTS` (comma list added to the default allowlist, §4.3) | `services.msteams.*` | `enabled` true |
| Mattermost | `MATTERMOST_URL` (`http(s)`, no query, fragment or user info; an optional context path is allowed) | `services.mattermost.url` | set and valid |
| Generic webhooks | `OUTGOING_WEBHOOKS_ENABLED=true`, `OUTGOING_WEBHOOKS_ALLOW_PRIVATE_NETWORKS` (default false), `OUTGOING_WEBHOOKS_ALLOW_HTTP` (default false) | `services.outgoing_webhooks.*` | `enabled` true |
| Inbound webhooks | `INTEGRATIONS_INBOUND_WEBHOOKS` = `auto` (default) \| `on` \| `off`; optional `LINEAR_WEBHOOK_SECRET` | `services.integrations.inbound_webhooks`, `services.linear.webhook_secret` | — |
| Polling | `INTEGRATIONS_POLL_MINUTES` (default 5; clamped to 1–60 by `InboundReachability::pollIntervalMinutes()`) | `services.integrations.poll_minutes` | — |

- `IntegrationProvider` gains `JiraDataCenter = 'jira_dc'`, `GitHub = 'github'`, `MicrosoftTeams = 'msteams'`, `Mattermost = 'mattermost'`, `Webhook = 'webhook'`, and methods `kind(): IntegrationKind` (`Channel` for Slack, Telegram, Teams, Mattermost, Webhook; `Tracker` for Jira, Jira DC, Linear, GitHub) and `capabilities(): array` matching §2.2.
- Disabled providers behave as in spec 6 §2.1 (404, no UI, rows kept and ignored).
- `isConfigured()` reports a complete env; `isEnabled()` is what gates routes and UI. Availability of every provider depends on the env alone (no staged-release list remains).
- `IntegrationProvider::JiraDataCenter` exposes `authMethods(): array` (`['oauth', 'pat']`, `['oauth']` or `['pat']` from the env above).
- Redirect URIs: `{APP_URL}/integrations/jira-dc/callback`, `{APP_URL}/integrations/github/callback` (also the GitHub App "Setup URL"). `.env.example` documents every variable, redirect and webhook URL, and the provider-side setup of §4.

### 2.2 Capabilities

| Provider | Share link (board, poker, game room) | Share recap | Poker import / refresh | Estimate write-back | Action item export | Assignee mapping | Priority mapping | Status sync |
|---|---|---|---|---|---|---|---|---|
| Slack, Telegram (spec 6) | ✓ | ✓ | — | — | — | — | — | — |
| Jira Cloud, Linear (spec 6) | — | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (this spec) |
| Jira Data Center | — | — | ✓ | ✓ (story points) | ✓ | ✓ | ✓ | ✓ |
| GitHub Issues | — | — | ✓ | ✓ (managed block in the issue body, §4.2) | ✓ | ✓ (SSO link or manual) | labels, optional | ✓ |
| Microsoft Teams | ✓ | ✓ | — | — | — | — | — | — |
| Mattermost | ✓ | ✓ | — | — | — | — | — | — |
| Generic webhook | ✓ | ✓ | — | — | — | — | — | — |

Game room invites (`game_room_link`, spec 7 §3.1) are share links: every provider marked ✓ under "Share link" supports them. Generic webhooks additionally send the automatic events of §4.7 that the team subscribed to; no other channel sends automatic events.

### 2.3 Inbound mode (webhooks or polling)

- `App\Support\Integrations\InboundReachability::isPublic()`: with `INTEGRATIONS_INBOUND_WEBHOOKS=on` → true; `off` → false; `auto` → true only when `APP_URL` is `https`, its host is not an IP literal, not `localhost`, does not end in `.local`, `.localhost`, `.test`, `.internal`, `.lan`, `.home.arpa`, and resolves to at least one public address (same range rules as §4.5; result cached 1 h).
- Per tracker integration with status sync on, `inbound_mode` is `webhook` when `isPublic()` **and** the provider's inbound channel is configured (Jira Cloud: always; Jira DC: webhook registered, §4.1; Linear: `LINEAR_WEBHOOK_SECRET` set; GitHub: `GITHUB_APP_WEBHOOK_SECRET` set), else `polling`. Status sync off → `off`.
- `webhook` mode still polls hourly as reconciliation (§5.4). A webhook that stops delivering falls back to the polling interval automatically (`webhook_status = failing`, §5.3).

## 3. Data model (extensions only)

Migrations are up-only; UUIDs as elsewhere.

### `team_integrations` — new columns

| Column | Type | Meaning |
|---|---|---|
| `inbound_mode` | string, default `off` | `webhook` \| `polling` \| `off` (§2.3) |
| `webhook_status` | nullable string | `pending` \| `active` \| `failing` (trackers with webhooks) |
| `webhook_expires_at` | nullable timestamp | Jira Cloud dynamic webhooks (30-day expiry) |
| `last_inbound_at` | nullable timestamp | Last verified inbound event |
| `last_polled_at` | nullable timestamp | Last completed poll |
| `poll_cursor` | nullable timestamp | Start time of the last successful incremental poll |
| `consecutive_failures` | unsigned int, default 0 | Generic webhook: deliveries in a row that ended `failed` (§4.7) |
| `last_delivery_succeeded_at` | nullable timestamp | Generic webhook: last 2xx |

- `credentials` (encrypted) gains: `webhookToken` (Jira Cloud/DC URL token, 40 chars), `webhookSecret` (Jira DC HMAC secret; generic webhook signing secret), `url` (Teams, Mattermost, generic webhook — these URLs embed keys and are treated as secrets), `personalAccessToken` (Jira DC PAT method only; never logged, serialized or returned).
- `settings` gains, for trackers: `statusSync: bool` (default false), `treatCanceledAsDone: bool` (default true, Linear and GitHub), `statusMapping` (§5.2), `webhookIds` (Jira Cloud), and non-secret bookkeeping `statusSyncSince`, `webhookRegisteredAt`, `webhookProjects` (project keys the registered webhook covers), `webhookManual` (Jira DC: registered by a Jira administrator by hand, §4.1); Jira DC: `{authMethod: oauth|pat, tokenOwner?: {name, displayName} (PAT only), serverKey, baseUrl, serverTitle, version, storyPointFields, exportProjectId?, exportIssueTypeId?, priorityMap?}`; GitHub: `{installationId, accountLogin, accountType: User|Organization, exportRepositoryId?, priorityLabels?: {high, medium, low: string|null}}`; Teams: `{host, channelLabel}`; Mattermost: `{host, channelLabel}` (`host` = the configured server's host); generic webhook: `{host, channelLabel, secretCreatedAt, events: string[] (default [], §4.7), disabledReason?: 'failures'|'gone'}`.
- Jira DC site identity: `settings.serverKey` = the first 40 hex characters of `sha256(rtrim(JIRA_DC_BASE_URL, '/'))` is the connection's site and the `external_site` of its imported tasks and exported links (a base URL can exceed the 100-character column); `settings.baseUrl` keeps the URL for display.

### `action_item_external_links` — new columns

| Column | Type | Meaning |
|---|---|---|
| `external_state` | nullable string | `open` \| `done` as last seen in the source (§5.2) |
| `external_status_name` | nullable string 100 | Source status name ("In review", "Done", "closed") |
| `external_updated_at` | nullable timestamp | Source `updated` time of the last read |
| `local_state_changed_at` | nullable timestamp | When the skrum status last changed (set by the listener, §5.6) |
| `last_pushed_state` | nullable string | `open` \| `done` last written to the source |
| `last_pushed_at` | nullable timestamp | |
| `last_synced_at` | nullable timestamp | Last successful read or write |
| `sync_error` | nullable string 500 | Sanitized as spec 6 §10.4 |
| `missing_at` | nullable timestamp | Issue deleted or no longer visible |

- `source` accepts `jira_dc`, `github`. Index (`source`, `external_site`, `external_id`) for inbound lookup.
- `external_key` widens to 150 characters (GitHub keys are `owner/repo#n`, up to 39 + 1 + 100 + 11 characters).

### `poker_tasks` — new columns

`external_status_name` (nullable string 100), `external_status_category` (nullable: `todo` \| `in_progress` \| `done`), `external_updated_at` (nullable timestamp), `external_missing_at` (nullable timestamp — persists spec 6 §6.4's "Not found in :source"). `external_source` accepts `jira_dc`, `github`; `external_key` widens to 150 characters. Index (`external_source`, `external_site`, `external_id`).

### `action_items` — new column

`completed_via_source` (nullable string 20): the provider whose status sync completed the item, set when `ExternalSyncActor` completes it and cleared on any other status change. Presented as `completedVia` (§7).

### `integration_deliveries`, `integration_user_mappings`

- `channel` accepts `msteams`, `mattermost`, `webhook`.
- `integration_deliveries` gains `kind` value `event` and columns `team_integration_id` (nullable uuid, null on delete), `event` (nullable string 60, e.g. `action_item.completed`), `attempts` (unsigned smallint, default 0), `response_status` (nullable unsigned smallint), `last_attempt_at` (nullable timestamp). `subject_type` also accepts `ActionItem` and `PokerTask`; `requested_by_user_id` is null for events. Every share delivery (all channels) records `team_integration_id`, and manual shares to a webhook store their `event` (`retro.link`, `poker.link`, `retro.results`, `game_room.link`). It is the generic webhook's **delivery log** (§4.7); pruning after 90 days as spec 6. Payloads are never stored.
- Mappings are reused for Jira DC (`external_account_id` = Jira user `name`) and GitHub (`external_account_id` = numeric GitHub user id, `external_display_name` = login). `IntegrationUserMatch` gains `Sso` (`sso`, GitHub via `social_accounts`, §4.2).

### `integration_inbound_events` — new

- `id`, `provider`, `team_integration_id` (nullable, null on delete), `event_key` string 191 (provider delivery id, else sha256 of the raw body; rejected requests use `rejected:{sha256(body)}`, so a forged request never occupies a genuine delivery id), `event_type` string 100, `status` (`applied` \| `ignored` \| `rejected` \| `failed`), `detail` nullable string 500, `received_at`.
- Unique (`provider`, `event_key`) for de-duplication. `Prunable` after 7 days. Payloads are never stored.

## 4. New providers

### 4.1 Jira Server / Data Center (OAuth 2.0 application link, personal access token fallback — decision 4)

Two authentication methods; a team's connection uses exactly one (`settings.authMethod`). **OAuth is preferred:** when both are available, the card offers "Connect with Jira" (OAuth) as the primary action and "Older Jira server? Use a personal access token" as a secondary link; connecting with OAuth replaces a stored PAT (the `personalAccessToken` credential is erased in the same update); a stored PAT is never used for a connection whose `authMethod` is `oauth`.

**OAuth 2.0 application link**

- Requires Jira Data Center 8.22 or later (OAuth 2.0 provider). The Jira admin creates an incoming application link ("External application", OAuth 2.0) with redirect `{APP_URL}/integrations/jira-dc/callback` and sets the three env variables. The base URL is admin-trusted: private hosts are allowed and it is the only Jira DC host skrum calls.
- Connect with **Read only** (`scope=READ`) or **Read and write** (`scope=WRITE`): `{base}/rest/oauth2/latest/authorize` with `client_id`, `redirect_uri`, `response_type=code`, `state`, PKCE `S256`; token at `{base}/rest/oauth2/latest/token`; refresh and lock as spec 6 §4.5. `GET /rest/api/2/serverInfo` fills `serverTitle`, `version`.
**Personal access token (fallback)**

- Available when `JIRA_DC_PERSONAL_TOKENS` is true. Requires Jira 8.14 or later (first release with personal access tokens).
- An Owner/Admin creates a token in Jira (Profile → Personal Access Tokens) and pastes it with **Read only** or **Read and write** (`POST …/integrations/jira-dc/token`, route `teams.integrations.jiraDataCenterToken.store`, `throttle:10,1`; `{token, access}`; token 20–255 characters, trimmed). skrum calls `GET /rest/api/2/myself` and `GET /rest/api/2/serverInfo` with `Authorization: Bearer {token}`: 401/403 → 422 "Jira didn't accept this token."; `versionNumbers` below 8.14 → 422 "Personal access tokens need Jira 8.14 or later."; otherwise the row is created or replaced `Active` with `authMethod = pat`, `tokenOwner = {name, displayName}`, `serverTitle`, `version`, `access`.
- The token is stored encrypted at rest in `credentials.personalAccessToken`, never returned (the card shows the owner and "Token saved on :date" only), excluded from logs, job payloads and exception context. `read` access makes skrum refuse every write itself (Jira would allow what the person may do).
- **It acts as that person.** Every import, estimate write-back, export, status push and webhook registration happens as `tokenOwner`: Jira shows them as author, reporter or editor, and skrum can reach only what they can see. Before saving the owner is not known yet, so the dialog says "its owner"/"them"; the connected card shows: "This token acts as :name in Jira. Everything skrum does — imports, estimates, exported issues, status changes — will appear as done by :name, and skrum sees only what :name can see. Prefer OAuth when your Jira supports it." The save dialog requires ticking "I understand" (client-side; the server requires `acknowledged: true`).
- **Revocation:** "Remove token" (Owners/Admins, confirmation) deletes the row and the token; the dialog tells :name to also revoke it in Jira (Profile → Personal Access Tokens). A token revoked or expired in Jira gives 401 on the next call → `ReconnectRequired` ("The Jira personal access token was revoked or has expired. Paste a new one."). "Replace token" pastes a new one through the same endpoint. No refresh exists for PATs.
- A `pat` connection while `JIRA_DC_PERSONAL_TOKENS` is false becomes `ReconnectRequired` ("Personal access tokens are turned off on this skrum instance. Connect with OAuth.") before any call.
- Everything else in this section (API differences, check, inbound) is identical for both methods.

**Common to both methods**

- API differences from Jira Cloud (spec 6), in `App\Support\Integrations\JiraDataCenter\JiraDataCenterClient`:
  - REST v2 (`/rest/api/2/…`); agile endpoints as Cloud (`/rest/agile/1.0/…`); search `POST /rest/api/2/search` (`jql`, `startAt`, `maxResults`, `fields`).
  - Descriptions are wiki markup: `WikiMarkupToMarkdown` for import (headings, `*bold*`, `_italic_`, `{code}`, `{noformat}`, `{quote}`, lists, `[text|url]` links, `||` tables, `!image!` → "[attachment]"); export bodies are built by `MarkdownToWikiMarkup` (paragraphs, links, plain text) with wiki specials `{ } [ ] * _ - + ^ ~ ! | #` backslash-escaped in user content.
  - Users are identified by `name`; assignee `{"name": "…"}`. Email matching: `GET /rest/api/2/user/search?username={email}&maxResults=2`, accepted when exactly one active result has `emailAddress` equal to the member's email (case-insensitive). Account search the same with the typed text.
  - Story points detection, priorities (`GET /rest/api/2/priority`), createmeta (`GET /rest/api/2/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}`) and transitions as Cloud; browse links `{base}/browse/{key}`.
- Check: `GET /rest/api/2/myself`. A connection whose `serverKey` differs from the configured base URL's becomes `ReconnectRequired` ("skrum is now configured for another Jira server. Reconnect.") before any credential is sent, and refreshing an OAuth token is refused for such a connection (the refresh token is never sent to a server other than the one it was issued by). Disconnect deletes the row; the dialog tells the admin to revoke skrum under their Jira profile's authorized applications (OAuth) or to delete the personal access token (PAT).
- **Inbound:** Data Center webhooks require a Jira administrator. If the connecting user (OAuth) or the token owner (PAT) has `ADMINISTER` (`GET /rest/api/2/mypermissions?permissions=ADMINISTER`), skrum registers the webhook with `POST /rest/webhooks/1.0/webhook` (`events: ["jira:issue_updated", "jira:issue_deleted"]`, `filters.issue-related-events-section` = the JQL of §5.3). Otherwise the card shows the URL `{APP_URL}/integrations/webhooks/jira-dc/{integration}/{webhookToken}`, the events to tick, the JQL filter and the secret (for Jira versions that sign with `X-Hub-Signature`), with copy buttons and "I've registered it" (sets `webhook_status = pending`; the first verified event makes it `active`). These details (URL with its token, secret, events, JQL) are served on demand by `GET {integration}/webhook` (Owners/Admins, `Cache-Control: no-store`), never in page props; the card's `inboundHint` is `manual`. skrum never changes a manually registered webhook.

### 4.2 GitHub Issues (GitHub App)

- **Instance setup** (documented in `.env.example`): the admin creates a GitHub App with repository permissions Issues read & write, Metadata read, organization permission Members read; events `issues`, `installation`, `installation_repositories`; webhook URL `{APP_URL}/integrations/webhooks/github` with a secret (webhook deactivated when skrum is not public); callback and setup URL `{APP_URL}/integrations/github/callback`; "Request user authorization (OAuth) during installation" on.
- **Connect:** Owner/Admin → `https://github.com/apps/{slug}/installations/new?state=…`. The callback receives `installation_id`, `code`, `state`; skrum exchanges `code` at `https://github.com/login/oauth/access_token`, calls `GET /user/installations` and accepts the installation only if it is listed for that user (proof of access, so a forged `installation_id` is refused); the user token is then discarded, never stored. `access` = `write` when the installation grants `issues: write`, else `read`. Selecting an existing installation (already installed on the org) goes through the same URL.
- **API auth:** app JWT (RS256, `iat` = now − 60 s, `exp` = now + 9 min, `iss` = app id) → `POST /app/installations/{id}/access_tokens`; the 1-hour token is cached 50 min under `github-installation-token:{installationId}`, encrypted with `Crypt::encryptString`, minted under `Cache::lock`. Headers `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`. Base URL constant `https://api.github.com` (GitHub Enterprise Server is out of scope).
- **Poker import:** containers = installation repositories (`GET /installation/repositories`, name filter, 50 per page); iterations = open milestones (`GET /repos/{o}/{r}/milestones?state=open`) — the open milestone with the earliest `due_on` on or after today is `active`, the others `upcoming`; issues of a milestone `GET /repos/{o}/{r}/issues?milestone={n}&state=open&per_page=100`, pull requests excluded. Container id = repository id; iteration id = `{repositoryId}/{milestoneNumber}`. The repository list is cached for 5 minutes per installation. Issue numbers above 2 147 483 647 are refused, and an issue answering 301 (transferred to another repository) is treated as not found. Query mode requires a repository (`container` on the web, `container_id` in MCP; without one → 422 "Choose a repository to search in."); search results are also restricted to the chosen repository; the server removes the user's `repo:`, `org:` and `user:` qualifiers and appends `repo:{owner}/{repo} is:issue` for `GET /search/issues`. `external_site` = installation id; `external_id` = `{repositoryId}/{number}` (re-fetched by repository id, which survives renames: refresh and polls read up to 100 issues of a repository per GraphQL request, aliased `issue(number:)` fields, while the estimate write-back reads `GET /repositories/{repositoryId}/issues/{number}`); `external_key` = `{owner}/{repo}#{number}`; description = issue body (Markdown) with the managed estimate block removed, through `RenderTaskMarkdown`; assignee = first assignee login; source estimate = the value inside the managed estimate block when present (below), else none.
- **Estimate write-back (decision 5): a managed block in the issue body.** GitHub Issues has no estimate field, so skrum writes the estimate as text into the issue body, in one clearly delimited block it owns:

  ```
  <!-- skrum:estimate -->
  **Estimate:** 5
  <!-- /skrum:estimate -->
  ```

  - `App\Support\Integrations\GitHub\EstimateBlock` parses and rewrites bodies. A block is the text from `<!-- skrum:estimate -->` to the next `<!-- /skrum:estimate -->` (markers matched case-sensitively, surrounding whitespace on their lines tolerated). The value is the text after `**Estimate:**` on the block's line, trimmed.
  - **Insert once:** a body without a block gets `"\n\n"` + the block appended after its trimmed end (an empty body becomes the block alone).
  - **Update in place:** a body with a block has the first block's content replaced; any further blocks (copied by hand) are removed with their surrounding blank line, so exactly one block remains. The block is never duplicated.
  - **Rest of the body untouched:** every byte outside the block(s) is preserved (line endings included); skrum never reformats, trims or re-escapes it.
  - **Clearing:** an estimate cleared in skrum removes the block and the blank line skrum inserted before it; a body without a block is not written.
  - **Values:** the estimate is the deck card's label as text, so **every deck syncs, including T-shirt and custom non-numeric decks** (unlike Jira and Linear numeric fields, spec 6 §6.5); `½` is written as `½`. Labels (1–8 characters, spec 4) are written with Markdown specials (`\ * _ [ ] ( ) # < > ~ |` and backtick) backslash-escaped. `?` and `☕` are never estimates (spec 4) and never written (`EstimateBlock` refuses them: "This card is not an estimate.", a guard unreachable through spec 4).
  - **Concurrent body edits:** each write is read-modify-write on the freshest body: `GET /repositories/{repositoryId}/issues/{number}` → rewrite only the block → `PATCH /repos/{o}/{r}/issues/{number}` `{body}` → the response's `body` is parsed again and must contain exactly one block with the written value and, outside the block, the text that was read; otherwise (an edit landed in between) the sequence restarts, at most 3 times, then fails with "The issue description kept changing. Try again." GitHub offers no conditional update for issues, so an edit made in the sub-second window between skrum's read and write can be lost; this residual risk is accepted and documented in `.env.example`.
  - **No-op:** when the block already holds the value (for example skrum's own echo), nothing is written.
  - Limits: a resulting body over 65 536 characters → failed "The issue description is too long to add the estimate."; a locked or closed issue is still written (GitHub allows it with `issues: write`); read access → `syncState: 'unsupported'`, "This GitHub connection is read-only."
  - Everything else follows spec 6 §6.5 (automatic dispatch after `SetPokerEstimate`, `ShouldBeUnique` per task, retries, `syncState`, facilitator retry/force). Edits appear in the issue's history as the GitHub App (`{slug}[bot]`).
- **Export:** target repository (`repository_id`, digits; saved as `exportRepositoryId`), `POST /repos/{owner}/{repo}/issues` with title and a body built from the same text as Linear's (spec 6 §7) plus "Due: {date}" when a due date is set (GitHub issues have none). Unlike Linear, the whole body, including the origin line with the retro title, is escaped as untrusted text: Markdown and HTML specials are backslash-escaped or entity-encoded, every `@` is followed by a zero-width space and a `#` directly followed by a digit is neutralised, so an action item can neither format the issue, nor mention GitHub users or teams, nor link to other issues. Exported text therefore shows literal escapes where it contained formatting. Assignee: `assignees: [login]`, the login re-read with `GET /user/{id}` from the mapping's numeric id (a failed lookup exports unassigned with `assigneeRejected`); GitHub drops assignees without access silently, so the response's `assignees` is compared and a missing one yields warning `assigneeRejected`. Priority: the label in `priorityLabels.{level}` when set and present in the repository (`GET /repos/{o}/{r}/labels/{name}`), else not sent with `priorityUnavailable` (when a label was configured). Labels are never created by skrum. `priority_labels` is validated as `{high, medium, low: string ≤ 50 | null}`, never `.` or `..`.
- **Assignee mapping:** automatic matching uses the SSO link — a member with a `social_accounts` row of provider `github` (`database/migrations/2026_09_29_120125_create_social_accounts_table.php`, `provider_user_id` = GitHub user id) is mapped with `matched_by = sso`; no email lookup (GitHub emails are mostly private). Manual search lists organization members (`GET /orgs/{org}/members`, paged up to 10 pages of 100 and filtered in memory) or, for a user account, collaborators of the export repository (`GET /repos/{o}/{r}/collaborators`). No avatar URLs are returned.
- **Status:** `open` / `closed` with `state_reason` (`completed`, `not_planned`, `reopened`).
- **Check:** `GET /app/installations/{id}` (app JWT); 404 → `ReconnectRequired` ("The GitHub App was uninstalled from :account."); `suspended_at` set → `ReconnectRequired` ("The GitHub App is suspended on :account."). Disconnect deletes the row only (the installation may serve other teams); the dialog links to the installation's settings page on github.com.
- **Inbound:** app webhook; `installation` `deleted`/`suspend` → every integration with that installation becomes `ReconnectRequired`; `installation_repositories` `removed` → the tracked issues of those repositories are re-read at once (they come back 404 and are marked missing); `issues` events drive §5.3.

### 4.3 Microsoft Teams (Workflows webhook)

- Office 365 connectors are retired; skrum posts to a Teams **Workflows** webhook ("Post to a channel when a webhook request is received"). An Owner/Admin pastes the workflow URL and a channel label (decision 6).
- Validation (`MicrosoftTeamsWebhookUrl`): `https`, port 443, no userinfo, host ending in `.logic.azure.com` or `.api.powerplatform.com`, or listed in `MSTEAMS_ALLOWED_HOSTS`; checked on save and before each send. Stored in `credentials.url`; `settings.host` for display.
- Message: `{"type": "message", "attachments": [{"contentType": "application/vnd.microsoft.card.adaptive", "content": <AdaptiveCard 1.4>}]}` with `TextBlock`s (`wrap: true`) and one `Action.OpenUrl`. User content is escaped for Adaptive Card Markdown (backslash before `\ * _ [ ] ( ) # > ~` and backtick, a leading `-` or `+` gets a backslash before it and a leading `1.` is written `1\.`, since CommonMark ignores a backslash before a digit); mentions require explicit entities, so none can be produced. Each recap list line is its own `TextBlock` prefixed with "• " (Teams renders Markdown lists inconsistently). Payload ≤ 28 000 bytes of JSON, truncating the action-item and top-card lists first (spec 6 §5.4). Redirects are not followed (a 3xx fails without retry). The host is never user-chosen (Microsoft suffixes or the admin's `MSTEAMS_ALLOWED_HOSTS`), so the public-address check and address pinning of §4.5 do not apply.
- Errors: 400, 401, 403, 404 → `ReconnectRequired` ("The Teams workflow URL no longer works. Paste a new one."); 429 → release after `Retry-After`; 5xx/timeouts → retry. "Reconnect" = paste a new URL. Test sends "skrum is connected."
- The daily check (`skrum:check-integrations`) re-validates the stored URL against the current env (host allowlist) without posting; a URL that no longer passes becomes `ReconnectRequired`.

### 4.4 Mattermost (incoming webhook)

- `MATTERMOST_URL` names the one Mattermost server teams may post to (admin-trusted; private hosts allowed). An Owner/Admin pastes an incoming webhook URL that must match `{MATTERMOST_URL}/hooks/{26 alphanumeric characters}`, and a channel label.
- Message: `{"text": <Markdown>}` (the webhook's own channel and name). User content: Markdown specials backslash-escaped, and a zero-width space inserted after every `@` and `~` so card text cannot mention (`@channel`, `@here`, `@all`, `@user`) or link channels. ≤ 16 000 characters, same truncation.
- Same list escaping as §4.3 (`1\.`, backslash before a leading `-`/`+`); redirects are not followed; no public-address check or pinning, since the host is the admin's `MATTERMOST_URL` and may be on a private network.
- Errors: 400 "invalid webhook", 403, 404 → `ReconnectRequired` ("The Mattermost webhook no longer works. Paste a new one."); 5xx/timeouts → retry.
- The daily check re-validates the stored URL against the current `MATTERMOST_URL` without posting, as §4.3.

### 4.5 Generic outgoing webhooks

- An Owner/Admin enters a URL and a channel label; skrum generates a signing secret (32 random bytes, hex) shown once with a copy button; "Rotate secret" replaces it (the old one stops working immediately). Saving a webhook on a team that already has one replaces it (new secret, no subscriptions, counter 0). Changing only the URL (`PATCH url`) keeps the secret and subscriptions and re-activates a disabled webhook with the counter at 0 (a new receiver is a reconnect).
- One save-time message covers every refused URL (scheme, port, user info, unresolvable host, private address): "This URL points to a private or invalid address."
- **URL safety** (`App\Support\Integrations\Webhook\SafeWebhookUrl`), on save and on every send: `https` only unless `OUTGOING_WEBHOOKS_ALLOW_HTTP`; no userinfo; port 443, 80 or 1024–65535; non-standard numeric IPv4 host forms (`2130706433`, `0x7f.1`, `127.1`, which curl reads as addresses) are refused; the host is resolved and **every** address must be public — loopback, RFC 1918, link-local (incl. `169.254.169.254`), CGNAT `100.64.0.0/10`, `0.0.0.0/8`, ULA `fc00::/7`, `fe80::/10`, multicast and reserved ranges are refused unless `OUTGOING_WEBHOOKS_ALLOW_PRIVATE_NETWORKS`; the connection is pinned to the vetted address (`CURLOPT_RESOLVE`, an IPv4 address preferred when the host has one) against DNS rebinding; redirects are not followed; timeout 10 s; the response body is discarded (status code only).
- **Request:** `POST` JSON, headers `Content-Type: application/json`, `User-Agent: skrum-webhooks/1`, `X-Skrum-Event`, `X-Skrum-Delivery` (delivery id), `X-Skrum-Timestamp` (Unix seconds), `X-Skrum-Signature: sha256=` + hex HMAC-SHA256 of `"{timestamp}.{rawBody}"` with the secret. The card shows how to verify (reject timestamps older than 5 minutes).
- **Body** (`version: 1`): `{version, id, event, occurredAt, sentAt, team: {id, name}, data}`; `id` = the delivery id (same on every retry of that delivery); for manual shares `event` is `retro.link`|`poker.link`|`game_room.link`|`retro.results` and `occurredAt` = the share request time; automatic events are listed in §4.7. `data` for links: `{title, url, sharedBy}`; for `game_room.link`: `{title, game, team, url, sharedBy}` (`url` is the member link `/games/{room}` or, on the sharer's opt-in for a `link` room, the guest link `/play/{token}`); for results: the spec 6 §5.2 recap as structured fields `{title, url, completedAt, participants: {count, names|null}, cardCount, roti: {average, respondents}|null, summary|null, actionItems: [{content, assignee|null, dueOn|null, priority, isCompleted}], moreActionItems, suggestedActions: [string], topCards: [{column, content, votes, groupedCount}]}` — identical inclusion and exclusion rules (names null on anonymous retros, guests suffixed "(guest)" in the delivery locale; no card authors, voters, comments, surveys).
- **Formats:** timestamps (`occurredAt`, `sentAt`, `completedAt`, `createdAt`, `estimatedAt`) are ISO 8601 UTC with `Z`; `dueOn` is `YYYY-MM-DD`; `priority` is `high|medium|low`.
- **Test** sends `event = "webhook.test"`, `data = {message: "skrum is connected."}` and a random `id`, signed like every request. It is not logged as a delivery and does not touch the failure counter; it is allowed while the webhook is disabled, and a success does not re-enable it (only Re-enable does).
- Errors: 2xx success; 410 → `ReconnectRequired` with `disabledReason = gone` ("The receiver asked skrum to stop."); other 4xx → failed without retry ("The receiver answered :status."; the body is discarded); connection errors read "Could not reach :host."; 5xx, timeouts and connection errors → retry (spec 6 §5.5); a URL failing the safety check at send time → failed, no retry, "This webhook URL points to a private or invalid address."
- The daily check re-validates the stored URL's shape (scheme, port, user info) against the current env, without DNS and without posting; a URL that no longer passes becomes `ReconnectRequired` ("This webhook URL is no longer allowed. Paste a new one.").

### 4.6 Sharing through the new channels

Spec 6 §5 applies unchanged, including the game room invite of spec 7 §3.1 (`kind = game_room_link`, same guest-link rule and permissions): the share endpoints (retro, poker and `POST /games/{room}/shares`) accept `channel` ∈ `slack|telegram|msteams|mattermost|webhook`; `BuildRetroRecap` builds the content once; jobs `DeliverToMicrosoftTeams`, `DeliverToMattermost`, `DeliverToWebhook` follow `DeliverToSlack` (tries, backoff, 429, `ShouldBeEncrypted`, read the URL from the model at run time, `results.changed` / `game.changed` / `game.room.changed` after the outcome). A room invite reads on Teams as an Adaptive Card with one "Join the game" `Action.OpenUrl`, on Mattermost as Markdown with a link, on a webhook as the `game_room.link` body.

### 4.7 Generic webhook automatic events (decision 7)

Spec 6 kept automatic event notifications out of scope for Slack, Telegram and email; they stay out for those and for Teams and Mattermost. This section adds them **for generic webhooks only**.

**Subscription.** `settings.events` lists the subscribed event names; default `[]` (a new webhook sends manual shares only). Owners/Admins tick events on the webhook card ("Send automatically") and save through `PATCH {integration}` `{events: [...]}`; unknown names → 422. Events are sent only while the integration is `Active`.

**Catalogue** (event name → trigger → `data`). Every trigger is a plain Laravel event dispatched after commit; a listener `QueueWebhookEvents` looks up the subject's team's generic webhook, checks the subscription, builds the payload **at event time** and dispatches `DeliverWebhookEvent`.

| Event | Trigger | `data` |
|---|---|---|
| `retro.completed` | `RetroCompleted` (new, spec 2 change): each transition of a retro into `Completed` (a reopened then re-completed retro sends it again; consumers dedupe on `data.retro.id` + `data.completedAt`) | the spec 6 §5.2 recap structure of §4.5 (`{title, url, completedAt, participants, cardCount, roti, summary, actionItems, moreActionItems, suggestedActions, topCards}`) plus `retro: {id}` |
| `action_item.created` | `ActionItemCreated` (new, spec 3 change) from `CreateActionItem` (board, promotion, workspace list, MCP) | `{actionItem}` |
| `action_item.completed` | `ActionItemCompleted` (any `origin`) | `{actionItem, origin: skrum\|external, completedVia: {source, key}\|null}` |
| `action_item.reopened` | `ActionItemReopened` (any `origin`) | same as completed; the item is open, so `completedBy` is null, and `completedVia` names the source when the reopen came from sync |
| `poker.task.estimated` | `PokerTaskEstimated` (new, spec 4 change) from `SetPokerEstimate` when the estimate is set or changed to a card (clearing does not fire) | `{game: {id, title, url}, task: {id, title, url, estimate, deckName, external: {source, key, url}\|null}, estimatedAt}` |

- `actionItem` = `{id, content, status: open|completed, assignee: {name}|null, createdBy: {name}|null, completedBy: {name}|null, dueOn|null, priority, completedAt|null, url, retro: {id, title, url}|null, themeName|null, createdAt}`; `completedBy` is null when the source completed it (`origin = external`). `ActionItemCompleted` and `ActionItemReopened` carry the acting `actor` (`ActionItemActor|ExternalSyncActor|null`), from which `origin`, `completedBy` and `completedVia` are built. `assignee.name` is the assignee's display name, members and guests alike (guests suffixed "(guest)"); `task.url` of `poker.task.estimated` is the game URL and `task.deckName` the custom deck name or the deck label. Sub-tasks, comments and recurrence are not sent.
- URLs are deep links for members (the retro, the team's action item list, the poker game); never guest links.
- Envelope, headers, signature and formats as §4.5 (`X-Skrum-Event` = the event name). `occurredAt` = the trigger time; the order of deliveries is not guaranteed.
- A `retro.completed` recap is built in the locale of the request that completed the retro; each event job keeps that locale for its error texts.

**Redaction** (same review as spec 6 §10, applied when the payload is built):
- Writing-phase card content never leaves: no event carries card content except `retro.completed`, which fires only on `Completed` and uses the recap's rules (top cards without authors or voters).
- Anonymous retros: no card author and no participant name (`participants.names` null), as in the recap.
- Action items are always named (spec 3 decision 5): assignee, creator and completer names are sent even for anonymous retros, and events for items created while their retro is in `Writing` are sent, since action items are visible to every participant when created.
- Poker: never individual votes, round history or player names; only the final estimate.
- Guest actors: an item created or completed by a guest still fires its event, but `createdBy`/`completedBy` is null (guest identities are never sent, as spec 6 §10.1).
- No email addresses, user ids other than skrum object ids, or tracker credentials.

**Delivery.** `DeliverWebhookEvent` (`ShouldBeEncrypted`, payload pre-built, `tries = 7`, `backoff = [30, 120, 600, 1800, 3600, 7200]` s, about 3.5 h in total). One `integration_deliveries` row per event per webhook (`kind = event`, `event`, `subject`), created `queued`; every attempt increments `attempts` and records `last_attempt_at`, `response_status`, `error` (sanitized, host only). Retry on 5xx, 429 (after `Retry-After`, capped at 3600 s), timeouts and connection errors; no retry on other 4xx or a URL failing the safety check (§4.5); 410 disables at once. The signature and `X-Skrum-Timestamp` are recomputed per attempt; `X-Skrum-Delivery` stays the same. Final outcome `sent` or `failed`.

**Disabling after repeated failures.** Each delivery ending `failed` (events and manual shares) while the webhook is `Active` increments `consecutive_failures` ("Webhook disabled." and a removed connection do not count); any 2xx resets it to 0 and sets `last_delivery_succeeded_at`. When it reaches **10** and no success happened in the last 24 hours, the integration becomes `ReconnectRequired` with `disabledReason = failures` and `last_error` "Disabled after 10 failed deliveries in a row." (a 410 sets "The receiver asked skrum to stop."); queued deliveries of that webhook fail with "Webhook disabled."; new events are neither queued nor logged while disabled. The card shows "Disabled after 10 failed deliveries in a row." with **Re-enable** (Owners/Admins, `PATCH {enabled: true}`: status back to `Active`, counter 0) and Test. No email or in-app notice is sent; the state is shown on the Integrations page.

**Delivery log.** The webhook card lists the latest deliveries (`GET {integration}/deliveries`, 25 per page, newest first, Owners/Admins): time, event or share kind, status, attempts, response code, error. Response `{data: [{id, event, kind, status, attempts, responseStatus, error, createdAt, lastAttemptAt}], currentPage, lastPage, total}`; it lists the team's `webhook` channel rows, so the history survives a reconnect. Payloads are not stored, so there is no redelivery (deferred); the receiver can dedupe on `id`.

## 5. Two-way status sync

### 5.1 Scope and opt-in

- A tracker integration (Jira, Jira DC, Linear, GitHub) has a "Sync status" switch (`settings.statusSync`, default off — decision 1), managed by Owners/Admins. Off → spec 6 behaviour exactly (decision 6: one-shot export; manual refresh only).
- On:
  - **Action items:** every link of the integration whose `external_site` matches the current site syncs open/done both ways (§5.5, §5.6). Exports require `write` access (spec 6 §7), so every link can be written; if the integration is later read-only, outbound pushes stop with "This :provider connection is read-only." and inbound continues.
  - **Poker:** imported tasks of games that are not ended are refreshed automatically from the source (§5.7), with read or write access. The manual "Refresh from :source" stays.
- Turning sync on runs a full read of all tracked issues (§5.4) and **does not** push skrum's state: the first read reconciles with the conflict rule of §5.8 treating the source as the more recent side **only** for links never pushed (`last_pushed_at` null); a link already pushed keeps the conflict rule, so skrum's newer unpushed change still wins. The switch asks for confirmation first (§9): the first sync takes the tracker's state and may complete or reopen linked items. A read that finds no status for an issue (`issueStatus` null) treats it as found with unknown status, never as missing, and a source without an update time never beats an unpushed skrum change.

### 5.2 "Done" mapping per workflow

| Provider | Issue is `done` when | Complete in skrum → source | Reopen in skrum → source |
|---|---|---|---|
| Jira Cloud / DC | status category `done`, restricted to `doneStatusIds` when configured for the project | transition to `completeStatusId` if configured and available, else the first available transition whose target has category `done` (preferring target names "Done", "Closed", "Resolved") | transition to `reopenStatusId` if configured, else the first transition to category `new`, else to `indeterminate` |
| Linear | state type `completed`; `canceled` too when `treatCanceledAsDone` (decision 3) | team's `completeStateId` if configured, else its `completed` state with the lowest `position` | team's `reopenStateId`, else its `unstarted` state with the lowest position, else `backlog` |
| GitHub | `closed` with `state_reason` `completed`; `not_planned` (and `duplicate`, which was not done) too when `treatCanceledAsDone` | `PATCH state=closed, state_reason=completed` | `PATCH state=open` |

- `settings.statusMapping` is keyed by Jira **project key** and Linear **team key** (links and tasks store `PROJ-12` / `ENG-7`): Jira `{projects: {PROJ: {doneStatusIds: [id]|null, completeStatusId|null, reopenStatusId|null}}}` (statuses from `GET /rest/api/3/project/{key}/statuses`, v2 on DC); Linear `{teams: {ENG: {completeStateId|null, reopenStateId|null}}}` (from `team.states`). Defaults (null) are the rules in the table. Only projects/teams with at least one tracked issue are listed in the UI. Changing a mapping or "Treat canceled as done" while sync is on queues a full read.
- Jira transitions with required fields: when the chosen transition's screen requires `resolution`, skrum sends `resolution: {name}` using "Done", else "Fixed", else the first allowed value; any other required field without a default → push fails with "Jira requires more fields to close :key. Close it in Jira." No transition to the target category → "No transition to a done status is available for :key." / "No transition to an open status is available for :key."; reopening with required fields → "Jira requires more fields to reopen :key. Reopen it in Jira."; Linear refusing the update → "Linear did not accept this status change."; any other write failure → "The status could not be written. Try again." followed by a sanitized detail (the specific messages above are kept for refused status changes, reconnects and read-only connections)
- Jira batch reads (`id in (…)`) fall back to `GET issue/{id}` one by one when Jira refuses the whole query (400: an id was deleted): it first retries without the ids the error names, then bisects the batch before going issue by issue; 403/404 means absent, so deletions are detected.
- Poker `external_status_category`: Jira `new` → `todo`, `indeterminate` → `in_progress`, `done` → `done`; Linear `triage`/`backlog`/`unstarted` → `todo`, `started` → `in_progress`, `completed`/`canceled` → `done`; GitHub open → `todo`, closed → `done`.

### 5.3 Inbound webhooks

| Route (no session, CSRF-exempt, `throttle:120,1` per IP, body ≤ 1 MB else 413) | Verification | Routing |
|---|---|---|
| `POST /integrations/webhooks/jira/{integration}/{token}` | `hash_equals` on `credentials.webhookToken`; a JWT in `Authorization`, when Atlassian sends one, is verified HS256 with `JIRA_CLIENT_SECRET` and rejected if invalid | the integration in the path |
| `POST /integrations/webhooks/jira-dc/{integration}/{token}` | URL token; `X-Hub-Signature` (`sha256=` HMAC of the raw body with `webhookSecret`) verified when present | the integration in the path |
| `POST /integrations/webhooks/linear` | `Linear-Signature` = hex HMAC-SHA256 of the raw body with `LINEAR_WEBHOOK_SECRET`; `webhookTimestamp` within 60 s | `organizationId` → every Linear integration of that organization |
| `POST /integrations/webhooks/github` | `X-Hub-Signature-256` with `GITHUB_APP_WEBHOOK_SECRET` | `installation.id` → every GitHub integration of that installation |

- The routes live in `routes/webhooks.php` and are registered only when the provider is enabled and inbound mode can be `webhook` for it (else 404); a Jira `{token}` that is not 40 alphanumerics → 404, an unknown integration → 401 like a wrong token. Verification failure → 401, an `integration_inbound_events` row `rejected` (no payload), and a warning logged at most once per provider per hour.
- **GitHub installation events** (`installation`, `installation_repositories`) are confirmed with `GET /app/installations/{id}` before any state change; `installation_repositories` `removed` re-reads the tracked issues of those repositories at once (they come back 404 and are marked missing). Jira delivery keys are scoped per integration, so one integration's delivery id never hides another's. The optional Atlassian JWT is verified leniently: the URL token is the real authentication.
- **Webhooks are hints, the API is the truth.** The controller only extracts the event key (`X-GitHub-Delivery`, `Linear-Delivery`, `X-Atlassian-Webhook-Identifier`, else sha256 of the body), event type and issue id(s); a duplicate key → 200 without work; otherwise it stores the event row and dispatches `ApplyInboundIssueChanges(integrationId, externalIds)` and answers 202. The job re-fetches each issue with the integration's credentials and applies §5.5/§5.7. Issues skrum does not track are ignored (`ignored`). A valid but replayed or crafted event can therefore only trigger a re-read.
- **Jira Cloud registration:** when sync is turned on in `webhook` mode, skrum registers a dynamic webhook `POST /rest/api/3/webhook` `{url, webhooks: [{events: ["jira:issue_updated", "jira:issue_deleted"], jqlFilter: "project in (…)"}]}` for the projects holding tracked issues (re-registered when a new project appears; ids in `settings.webhookIds`). This needs the `manage:jira-webhook` OAuth scope: connections made without it keep polling and the card says "Reconnect Jira to receive live updates." (`inboundHint = reconnect`). After each successful incremental poll, a Jira Cloud or auto-registered Jira DC webhook whose `webhookProjects` differ from the tracked projects is re-registered. They expire after 30 days: the daily check refreshes them with `PUT /rest/api/3/webhook/refresh` when fewer than 7 days remain. Turning sync off or disconnecting deletes them (`DELETE /rest/api/3/webhook`, best effort).
- **Health:** `webhook_status` is `pending` after every (re-)registration until the first verified event (Linear and GitHub: when sync is turned on in webhook mode), `active` after the first verified event, `failing` when registration or refresh fails, or when an hourly reconciliation (§5.4) finds source changes that no inbound event reported and nothing was received for 24 h (counted from `last_inbound_at`, else `webhookRegisteredAt`, else `statusSyncSince`). "Healthy" means webhook mode with `pending` or `active`; anything else polls at `INTEGRATIONS_POLL_MINUTES`. `failing` switches the integration to the polling interval until an inbound event arrives again. The card shows the state (§9).

### 5.4 Polling fallback and reconciliation

- `php artisan skrum:poll-integrations` runs every minute (`withoutOverlapping()->runInBackground()`) and processes each tracker integration with sync on, `Active`, and due: `last_polled_at` older than `INTEGRATIONS_POLL_MINUTES` in `polling` mode (or `webhook` with `failing`), older than 60 min in healthy `webhook` mode (decision 8: 5-minute default, 1–60, hourly reconciliation).
- **Tracked issues:** links whose item is open, or completed within the last 90 days; tasks of games not ended. Others are no longer read.
- **Incremental poll** (issues updated since `poll_cursor − 2 min`), in batches of 100: Jira `issuekey in (…) AND updated >= "-{n}m"` (relative minutes, time-zone safe); Linear `issues(filter: {id: {in: […]}, updatedAt: {gte: cursor}})`; GitHub `GET /repos/{o}/{r}/issues?since={cursor}&state=all&per_page=100` per repository with tracked issues, matched in memory. Success sets `poll_cursor` to the run's start time.
- Polls and full reads run in the job `ReadTrackedIssues` (unique per integration and kind; the initial read of a sync turn-on has its own unique key so the daily full read never drops it). Turning sync on stores a random `initialReadPending` token in the settings; it is cleared only when the first (source-wins) read completes, so a first read that keeps failing is queued again by the poller (a failing read pauses that integration's polls for 30 minutes), and a switch off and on during a read keeps the newer first read owed. A registration refused with a 4xx backs off 24 h, or until the tracked projects change.
- **Full read** (all tracked ids, no `updated` filter; detects deletions): once a day, when sync is turned on, and when the mapping changes (§5.2). Issues not returned → `missing_at` / `external_missing_at` set; they reappear if found again.
- Provider 429 stops the integration's run; its next run is due after `Retry-After`. Auth failures follow spec 6 §4.5 (`ReconnectRequired`, polling stops).

### 5.5 Applying inbound changes to action items

For each link of a re-fetched issue:

1. Update `external_state`, `external_status_name`, `external_updated_at`, `last_synced_at`; clear `missing_at`.
2. If `external_state` equals the item's state (open ↔ `completed_at` null) → nothing else. This also absorbs the echo of skrum's own push.
3. Otherwise apply the conflict rule (§5.8). When the source wins, `SetActionItemStatus` runs with the system actor `ExternalSyncActor(source, key)` (bypasses `ActionItemPermissions`, keeps validation), completing (`completed_at = now()`) or reopening; `action-item.saved` is broadcast per spec 3; `ActionItemCompleted` / `ActionItemReopened` carry `origin = external`, so the outbound listener does not push back.
4. Board phase and lock do not block it (a lock governs participants, not the system).

A deleted or inaccessible issue sets `missing_at` and leaves the item unchanged ("Not found in :source").

### 5.6 Outbound changes (action items)

- A listener on `ActionItemCompleted` and `ActionItemReopened` with `origin = skrum` sets `local_state_changed_at = now()` on every link of the item and, for each link whose integration has sync on, is `Active`, has `write` access and the same `external_site`, dispatches `PushActionItemState` after commit.
- `PushActionItemState` (`ShouldBeUniqueUntilProcessing` per link, so a change made during a push still queues the next one, with `WithoutOverlapping` per link, `maxExceptions = 5`, `retryUntil` 1 h, `backoff = [10, 30, 120, 600]`) reads the item's **current** state at run time, fetches the issue, does nothing if it is already in that state, otherwise transitions it (§5.2). Success: `last_pushed_state`, `last_pushed_at`, `external_state`, `external_status_name`, `last_synced_at` updated, `sync_error` cleared. Final failure: `sync_error` set; the chip shows "Sync failed" with Retry. Either way `action-item.saved` is broadcast.
- `POST …/action-items/{actionItem}/external-links/{link}/sync` (managers of the item) re-dispatches the push; it is also the way to resolve a conflict in skrum's favour. 409 "Turn on status sync for :provider first." when sync is off; 409 "This issue belongs to another :provider site." for a link of another site.
- Deleting an item never touches the source (spec 6 §7).

### 5.7 Poker tasks

- With sync on, every inbound change or poll of an imported task of a game that is not ended applies spec 6 §6.4's refresh (title, description, assignee, source estimate, `external_refreshed_at`) plus `external_status_name`, `external_status_category`, `external_updated_at`, clearing `external_missing_at`. One `task.saved` per changed task, or one `game.changed` when more than 10 tasks of a game change in one job.
- Tasks are not reordered or removed when done in the source; they show a "Done in :source" chip. Ended games are frozen.
- Direction skrum → source stays the estimate write-back of spec 6 §6.5 (GitHub: the managed block of §4.2); no status is written for poker tasks.

### 5.8 Conflict rules

- **Action item status (decision 2):** a conflict exists when the re-fetched `external_state` differs from the item's state **and** skrum has an unpushed local change (`local_state_changed_at` later than `last_pushed_at`, or a pending/failed push). The side with the most recent change wins: `external_updated_at` vs `local_state_changed_at`; a tie goes to skrum. The losing side is overwritten (a push is dispatched when skrum wins; the item is updated when the source wins). Without an unpushed local change, the source state is applied.
- **Poker estimate:** the skrum estimate stays authoritative for write-back. When the source estimate changes after `synced_at` (or after import for never-synced tasks) and differs from the task's skrum estimate, the payload flags `estimateConflict: {sourceEstimate, matchingCard}` (`matchingCard` null disables "Use :source estimate"): badge "Changed in :source to 8". No conflict is flagged while a write-back is pending or unsupported. Nothing is overwritten automatically. The facilitator chooses "Keep skrum estimate" (forces spec 6's sync) or "Use :source estimate" (calls `SetPokerEstimate::fromSource()` with the matching deck card, which checks the deck but not the revealed-round rule; disabled with "8 is not in this deck" when no card matches). Tasks without a skrum estimate have no conflict. GitHub's source estimate is the managed block's text (§4.2), matched to a card label exactly (case-sensitive); a block removed by hand in GitHub is "no source estimate" (no conflict; the next write-back re-inserts it).
- **Title, description, assignee of poker tasks:** the source always wins (managed fields, spec 6 decision 5).
- **Action item fields other than status:** never synced.

### 5.9 Loop prevention and idempotency

- Events carry `origin` (`skrum` \| `external`); only `skrum` origin pushes.
- Inbound equal-state reads are no-ops (§5.5 step 2); pushes check the source state first.
- `ApplyInboundIssueChanges` and `PushActionItemState` are unique per integration batch / link; inbound events are de-duplicated by key.

## 6. Permissions

| Action | Allowed for |
|---|---|
| Connect, configure, test, disconnect Jira DC, GitHub, Teams, Mattermost, generic webhook; rotate the webhook secret; register webhooks | Workspace Owners/Admins (`TeamPolicy::manageIntegrations`) |
| Paste, replace or remove a Jira DC personal access token | Workspace Owners/Admins |
| Turn status sync on/off, edit status mapping, "Treat canceled as done" | Workspace Owners/Admins |
| Choose generic webhook events, re-enable a disabled webhook, view its delivery log | Workspace Owners/Admins |
| Share to Teams, Mattermost, generic webhook | Spec 6 §8 sharers (retro facilitator who is a member, Owners/Admins; poker facilitator); game room invites: spec 7 §3.1 managers (host, creator, Owners/Admins, team members only) |
| Import from Jira DC / GitHub | Spec 6 §8 (players who can add tasks) |
| Export to Jira DC / GitHub | Spec 6 §8 (`ActionItemPermissions::canEdit`) |
| Retry an action item push | Managers of the item (`canEdit`) |
| Resolve a poker estimate conflict | The game's facilitator |
| Trigger automatic webhook events | Nobody directly: they follow the actions of §4.7 by whoever may perform them |
| Inbound webhook routes | No user; signature/token verification only |

Guests: 403 on every endpoint above; payload restrictions of spec 6 §6.6 unchanged.

## 7. Endpoints and events

Controllers in `app/Http/Controllers/Integrations/`, actions in `app/Actions/Integrations/`, clients in `app/Support/Integrations/{JiraDataCenter,GitHub,MicrosoftTeams,Mattermost,Webhook}/`. Routes registered only for enabled providers.

### Team integrations (`w/{workspace}/teams/{team}/integrations`, as spec 6 §9)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `{jira_dc\|github}/connect` | `?access=read\|write` (Jira DC) | redirect |
| POST | `jira-dc/token` | `{token, access: read\|write, acknowledged: true}` | 201 integration (creates or replaces; PAT method, §4.1); 422 on invalid token or old server |
| POST | `{msteams\|mattermost\|webhook}` | `{url, channel_label?}` (label ≤ 80) | 201 integration (creates or replaces; generic webhook also returns `{secret}` once) |
| PATCH | `{integration}` (`throttle:60,1,integrationUpdates`) | spec 6 fields plus `{status_sync?, treat_canceled_as_done?, status_mapping?, priority_labels?: {high, medium, low: string ≤ 50 \| null} (GitHub, snake_case, never `.`/`..`), url?, channel_label?, events?: string[], enabled?: true}` (`events` without duplicates, `enabled`: generic webhook; `status_mapping` covers one container: `{container, done_status_ids, complete_status_id, reopen_status_id}` for Jira, `{container, complete_state_id, reopen_state_id}` for Linear, an omitted value resetting it to the default rule) | 200 integration |
| GET | `{integration}/deliveries` | `?page=` | generic webhook delivery log (§4.7), 25 per page |
| POST | `{integration}/secret` | — | 200 `{secret}` (generic webhook; shown once) |
| GET | `{integration}/statuses` | `?container=` | without `container`: `{containers: string[]}` (keys of tracked issues); with it: `{statuses: [{id, name, category}]}` |
| GET | `{integration}/webhook` | — | Jira DC manual webhook details `{url, secret, events, jql}` (Owners/Admins, `no-store`) |
| POST | `{integration}/webhook` | `{registered?: true}` (Jira DC manual confirmation) | 202; (re)registers or marks `pending`; 409 "Turn on status sync for :provider first." or "This skrum instance can't receive webhooks; it checks :provider regularly instead." |

`GET /integrations/{jira-dc|github}/callback` (`auth`), with spec 6 §4.5 state rules. Request fields are snake_case throughout. The connect routes keep the enum values (`jira_dc/connect`, `github/connect`); the PAT route is kebab-case (`jira-dc/token`).

### Inbound (no auth)

The four routes of §5.3.

### Retro, workspace and poker

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/retros/{retro}/shares`, `/poker/{game}/shares`, `/games/{room}/shares` (spec 7) | `channel` also `msteams\|mattermost\|webhook` | 202 delivery |
| POST | `/retros/{retro}/action-items/{actionItem}/external-links/{externalLink}/sync` and `/w/{workspace}/action-items/{actionItem}/external-links/{externalLink}/sync` | — | 202 |
| POST | `/poker/{game}/tasks/{task}/estimate-conflict` | `{resolution: keepSkrum\|useSource}` | 200 task |
| — | `imports/{source}/…` (spec 6) | `source` also `jira_dc\|github`; the preview also accepts `container` (GitHub: required in query mode) | as spec 6 |

### Payload and snapshot additions

- `externalLinks[]` (spec 6 §7): `{id, source, key, url, state: open|done|null, statusName|null, syncState: 'off'|'synced'|'pending'|'failed'|'missing', syncError|null, lastSyncedAt|null}` for those who see the item as a member (empty for guests, as before). `syncState`: `off` (no sync for this link: provider disabled, not connected or not active, sync off, other site), `missing` (`missing_at`), `failed` (`sync_error`), `pending` (never read, or source state ≠ item state), else `synced`. Link states reach boards live through the existing members-only `action-item.external-links.changed`; the workspace action items page refreshes them on its next load.
- Action items gain `completedVia` (provider value or null, §3) for members; guests and viewer-less payloads (broadcasts) get null, and clients keep the known value while the item stays completed.
- Poker `external` (spec 6 §6.6) for non-guest players: adds `status|null`, `statusCategory|null`, `missing: bool`, `estimateConflict: {sourceEstimate, matchingCard}|null`, and `syncMode: 'webhook'|'polling'|'off'`. Guests' reduced object unchanged.
- Retro/poker snapshot `integrations` / `share` and the game room snapshot `share` (spec 7 §7) gain `msteams`, `mattermost`, `webhook` booleans (true only when available **and** the viewer may share).
- Integrations page props per provider add `inboundMode`, `webhookStatus`, `lastInboundAt`, `lastPolledAt`, `statusSync`, `inboundHint: 'reconnect'|'manual'|null`, and the page gets `pollMinutes`; Jira DC adds `authMethod`, `authMethods`, `tokenOwner` (display name only), `tokenSavedAt`; generic webhook adds `connection.settings.events` and `connection.settings.disabledReason` (next to `secretCreatedAt`) and `connection.webhook.{consecutiveFailures, lastDeliverySucceededAt}` (`connection.webhook` null for every other provider); the page prop `webhookEvents: [{name, description}]` (null while webhooks are disabled) lists the catalogue; `mattermost: {url}|null` names the configured server (not a secret). Webhook URLs, secrets and tokens are never serialized (Teams/Mattermost/generic show `host` and `channelLabel` only).
- No new broadcast event. New plain (non-broadcast) events dispatched after commit: `RetroCompleted`, `ActionItemCreated`, `ActionItemReopened`, `PokerTaskEstimated` (§4.7, §5.6, §12).

### 7.1 MCP (spec 5) — `poker.sources.list` and tracker tools

| Tool | Change |
|---|---|
| `poker.sources.list` | Lists every tracker kind (`jira`, `jira_dc`, `linear`, `github`) the team has connected on an enabled provider — never channels (Slack, Telegram, Teams, Mattermost, webhook). Item shape: spec 5 §6.2's `{source, siteName, status, access, canImport, canWriteBack, writeBackUnavailableReason}` plus `canSyncStatus` (sync on and `Active`) and `syncMode: webhook|polling|off` (the integration's `inbound_mode`; `false`/`off` until status sync ships). `siteName` = Jira DC `serverTitle`, GitHub `accountLogin`. GitHub: `canWriteBack` = `Active` and `write` access (estimate written to the issue body's managed block, §4.2; every deck, unlike Jira/Linear); read access → `false` with "This GitHub connection is read-only." |
| `poker.iterations.list` | `source` accepts `jira_dc` (as Jira) and `github` (containers = repositories, iterations = open milestones with `active`/`upcoming`, `startsOn: null`, `endsOn` = due date). |
| `poker.game.tasks.import` | `source` accepts `jira_dc`, `github`; GitHub query mode requires `container_id`. |
| `poker.game.task.sync` | `source` also `jira_dc` and `github` (GitHub rewrites the managed block, §4.2). |
| `poker.game.tasks.list` | Exposes `external.statusCategory`, `external.missing` and `external.estimateConflict`. |

The `Trackers` feature gate (spec 5 §2.4) counts Jira DC and GitHub integrations. The services stay spec 6 §9.1's (`ListPokerSources`, `ListPokerIterations`, `ImportPokerTasks`, sync dispatch), extended per provider; nothing is reimplemented in the MCP layer.

## 8. Data crossing the instance boundary

### 8.1 Outbound (additions to spec 6 §10.1)

| Destination | Sent | Never sent |
|---|---|---|
| Teams / Mattermost / generic webhook link (board, poker, game room invite) | as Slack (spec 6 §5.1, spec 7 §3.1: room name, game, team, sharer, URL; guest URL only on opt-in) | any board content, players, words, questions, drawings, GIFs, scores |
| Teams / Mattermost / generic webhook recap | exactly spec 6 §5.2's content (generic: as structured JSON) | everything spec 6 §10.1 excludes |
| Jira / Jira DC / Linear / GitHub status push | the target open/done transition for a linked issue (and `resolution` when Jira requires it) | who changed it in skrum, comments, any other field |
| GitHub estimate write-back | the final estimate's card label, inside the managed block of the issue body (§4.2) | votes, round history, player names, any change outside the block |
| Jira DC with a personal access token | the same calls as OAuth, authenticated as the token owner | — |
| Generic webhook automatic events (§4.7) | only the subscribed events, with the `data` of the catalogue | card content outside `retro.completed`'s recap, card authors and participant names on anonymous retros, votes, comments, sub-tasks, emails, guest identities |
| Jira DC / GitHub export | as Jira Cloud/Linear export (content, due date, mapped priority/label, mapped account, retro title/date, deep link) | as spec 6 |
| Jira DC email matching | members' verified emails to the configured Jira DC server (spec 6 decision A applies) | — |
| GitHub | installation and repository ids, issue numbers, search text | emails (matching uses SSO links only) |

### 8.2 Inbound

- Stored from sources: status name/category, `updated` time, missing flag, and for poker tasks the fields spec 6 already imports. Raw webhook payloads are never stored or logged; `integration_inbound_events` keeps key, type, status and a sanitized detail only.
- Imported GitHub bodies pass through `RenderTaskMarkdown` (spec 4), so no script runs and no browser loads a third-party image.

### 8.3 Invariants

- Writing-phase content never leaves; recaps and `retro.completed` require `Completed` (spec 6 §10.2), whatever the channel.
- Action items are always named (spec 3 decision 5), in shares and in webhook events alike.
- Anonymous retros: no card author or participant name in any channel or webhook body.
- Guests never trigger, receive or are mapped.
- Browsers never contact providers: no provider avatars; GitHub/Teams/Mattermost/webhook URLs are server-side only; the only browser navigations are OAuth/installation consent and links the user opens.
- Secrets: webhook URLs, OAuth tokens, Jira DC personal access tokens and signing secrets are encrypted at rest, hidden, excluded from logs and job payloads; errors store the host only (spec 6 §10.4).

## 9. UI

All new strings in `lang/{en,fr,es,de}.json`; provider names not translated.

- **Integrations page** (`resources/js/pages/teams/integrations.tsx`):
  - Cards for Jira Data Center (server title, version, access, story points field, People and Priorities panels as Jira; not connected: "Connect (read only)" / "Connect (read and write)" when OAuth is configured, as the Jira Cloud card and, when personal tokens are allowed, "Older Jira server? Use a personal access token" — the only action when OAuth isn't configured — opening a dialog with the token field, Read only / Read and write, the acting-as warning of §4.1 and the "I understand" checkbox; connected with a PAT: a persistent warning "Acting as :name in Jira", "Token saved on :date", Replace token, Remove token, which uses the same disconnect dialog as the other connections), GitHub (account, access, export repository, People panel with "Linked via GitHub sign-in" badge, Priorities panel with three text inputs for the high/medium/low labels), Microsoft Teams and Mattermost (paste URL, channel label, host shown — Mattermost also names the accepted server —, Test, Replace URL, Disconnect), Generic webhook (URL, "Secret created on …", Rotate secret with confirmation, one-time secret dialog with copy, verification snippet, Test; **Send automatically** checkboxes for the five events of §4.7 with a one-line description each and a "Payload reference" disclosure; disabled banner ("Disabled after 10 failed deliveries in a row." or "The receiver asked skrum to stop.") with Re-enable; **Deliveries** table — time, event, status, attempts, response code, error — with pagination).
  - Tracker cards gain a **Status sync** section: switch; mode line "Live updates (webhooks)" / "Checking every :n minutes" / "Webhooks aren't reaching skrum; checking every :n minutes."; last sync time; "Treat canceled as done" (Linear, GitHub); a confirmation dialog when the switch is turned on (the first sync takes the tracker's state and may complete or reopen linked items); per project/team selects for done statuses, complete and reopen targets (Jira, Linear). Jira DC manual webhook panel (§4.1) with "Show webhook details", copy buttons and "I've registered it"; Jira Cloud connections without the webhook scope show "Reconnect Jira to receive live updates."
- **Share menus** (Results view, board, poker and game room share dialogs): "Share to Microsoft Teams", "Share to Mattermost", "Send to webhook", with the same dialogs and delivery lines as Slack.
- **Action item chip**: `PROJ-12 ↗` plus a state dot (open/done) and, when sync is on, tooltip "Done in Jira · synced 3 min ago" / "Sync pending" / "Sync failed: … — Retry" (Retry for managers) / "Not found in Jira". An item completed from the source shows "Completed in :source" next to its completion time.
- **Poker task**: status chip ("In progress in Jira", "Done in GitHub"), "Not found in :source", conflict badge "Changed in :source to 8" with "Keep skrum estimate" / "Use :source estimate" for the facilitator; GitHub tasks show the spec 6 sync states ("Synced to GitHub", "Sync pending", "Sync failed: … — Retry") with tooltip "Written to the issue description."
- **Import dialog**: source tabs gain "Jira Data Center" and "GitHub" (repository + milestone, or repository + query).

## 10. Jobs, schedule and failure states

| Job / command | Trigger | Retries |
|---|---|---|
| `DeliverToMicrosoftTeams`, `DeliverToMattermost`, `DeliverToWebhook` | share endpoints | as `DeliverToSlack` |
| `QueueWebhookEvents` (listener) | `RetroCompleted`, `ActionItemCreated`, `ActionItemCompleted`, `ActionItemReopened`, `PokerTaskEstimated` | — (builds payloads, dispatches after commit) |
| `DeliverWebhookEvent` | subscribed event | 7 tries, backoff 30 s/2/10/30/60/120 min; 429 honours `Retry-After` ≤ 1 h |
| GitHub estimate write-back (spec 6's `SyncTaskEstimate` job, GitHub branch) | estimate set/cleared, facilitator retry | as spec 6 §6.5; up to 3 read-modify-write restarts inside one attempt |
| `ApplyInboundIssueChanges` | inbound event | `maxExceptions = 3`, backoff 10/60 s, unique per integration + batch |
| `ReadTrackedIssues` | poll, full read | unique per integration and kind |
| `PushActionItemState` | item completed/reopened, retry endpoint, conflict won by skrum | `maxExceptions = 5`, `retryUntil` 1 h, backoff 10/30/120/600 s, unique until processing and without overlapping per link |
| `RegisterTrackerWebhooks` | sync turned on, new project, daily refresh | 3 tries |
| `skrum:poll-integrations` | every minute, without overlapping | next run |
| `skrum:check-integrations` (spec 6) | daily | also refreshes Jira Cloud webhooks, checks GitHub installations, re-validates Teams/Mattermost/webhook URLs without posting, runs the daily full read |
| `model:prune` (`IntegrationInboundEvent`) | daily | — |

Jobs whose integration is gone, disabled, `ReconnectRequired` or has sync off (sync jobs only) fail immediately without calling the provider.

## 11. Error handling

- Spec 6 §13 applies. Additions:
  - Invalid Teams/Mattermost/webhook URL on save → 422 with the rule broken ("Use the workflow URL from Microsoft Teams.", "Use an incoming webhook of :url.", "This URL points to a private or invalid address." for every refused generic webhook URL).
  - GitHub search without a repository → 422 "Choose a repository to search in."
  - GitHub callback with an installation not visible to the user → flash "This GitHub installation isn't available to your account." and nothing stored.
  - Push failures → `sync_error` with translated reason (§5.2) plus sanitized provider detail; retry 202 or 409 when the integration is read-only / not `Active`.
  - Estimate conflict resolution on a task without conflict → 409 "This estimate is already in sync."; `useSource` with no matching card → 422.
  - Jira DC PAT: 422 "Jira didn't accept this token.", 422 "Personal access tokens need Jira 8.14 or later.", 422 without `acknowledged`; 404 when `JIRA_DC_PERSONAL_TOKENS` is false; later 401 → `ReconnectRequired`.
  - GitHub estimate: "The issue description kept changing. Try again.", "The issue description is too long to add the estimate.", 404/410 issue → "Not found in GitHub"; all shown as spec 6's failed sync state with Retry.
  - Jira DC: "skrum is now configured for another Jira server. Reconnect." and "Personal access tokens are turned off on this skrum instance. Connect with OAuth." (`ReconnectRequired`, §4.1).
  - Generic webhook events: 422 for unknown or duplicate event names; `failed` deliveries keep status code and sanitized reason; disabled after 10 consecutive failures (§4.7); PATCH `{enabled: true}` on a webhook not disabled → 200 no-op.
  - Status sync: 409 "Turn on status sync for :provider first.", 409 "This issue belongs to another :provider site.", 409 "This skrum instance can't receive webhooks; it checks :provider regularly instead.", and the push messages of §5.2.
  - Inbound: 401 on bad signature or unknown integration, 404 when the route is disabled or the token is malformed, 413 over 1 MB, 202 accepted, 200 duplicate.

## 12. Changes to other specs

- **Integrations (spec 6)**: `IntegrationProvider` and its tables gain the values/columns of §2–§3; share endpoints accept the new channels; `ListPokerSources`, `ListPokerIterations`, `ImportPokerTasks` and the write-back dispatch handle `jira_dc` and `github`; the "Not found in :source" state is persisted in `external_missing_at`; `IntegrationUserMatch` gains `Sso`; the daily check gains webhook refresh and the full read; §6.5 write-back gains a GitHub branch (managed body block, every deck including T-shirt, §4.2); `integration_deliveries` gains `kind = event` and the columns of §3; the out-of-scope entry "automatic event notifications" stays true for Slack, Telegram and email and gains a pointer to this spec's generic-webhook events (§4.7). Decision 6 remains the behaviour whenever status sync is off. (Spec 6 already points its "two-way sync" and "more providers" out-of-scope entries here.) *(Applied in spec 6 §1, §2.1, §3, §4.5, §6.4, §6.5, §7, §7.1, §9.)*
- **Action items v2 (spec 3)**: `SetActionItemStatus` accepts a system actor `ExternalSyncActor`; `CreateActionItem` dispatches a new plain event `ActionItemCreated` after commit; a new plain event `ActionItemReopened`; both `ActionItemCompleted` and `ActionItemReopened` carry `origin` (`skrum` | `external`) and are now subscribed by this spec's listener; `PresentActionItem.externalLinks` gains the fields of §7; completion shows "Completed in :source" when set by sync. *(Applied in spec 3 §4, §5, §8, §9.)*
- **Planning poker (spec 4)**: `SetPokerEstimate` dispatches a new plain event `PokerTaskEstimated` after commit when the estimate is set or changed to a card (not when cleared); task payload `external` gains `status`, `statusCategory`, `missing`, `estimateConflict`, `syncMode`; the facilitator's "Use :source estimate" goes through `SetPokerEstimate` (same validation and broadcasts). *(Applied in spec 4 §2, §3, §6.)*
- **MCP (spec 5)**: §7.1 of this spec — `poker.sources.list` item shape gains `canSyncStatus` and `syncMode`; for GitHub the estimate write-back capability (`canWriteBack`) is `true` when `Active` with write access (reason null), `false` with "This GitHub connection is read-only." otherwise; `poker.game.task.sync` accepts GitHub tasks; `source` values gain `jira_dc` and `github` across the tracker tools, channels are never listed, and the `Trackers` gate counts the new trackers. *(Applied in spec 5 §1.3, §2.4, §6.2, §6.3, §13.)*
- **Games (spec 7)**: §3.1's room invite accepts `msteams|mattermost|webhook` (`DeliverToMicrosoftTeams`, `DeliverToMattermost`, `DeliverToWebhook`, `game_room.link`); the room snapshot `share` gains the three booleans. *(Applied in spec 7 §3.1, §7, §9, §14, §15.)*
- **Retro flow extras (spec 2)**: the Results share menu lists the new channels; the phase change into `Completed` dispatches a new plain event `RetroCompleted` after commit (each time, also after a reopen). *(Applied in spec 2 §1, §6.1, §10.2.)*
- **Core, board engagement**: no change.

## 13. Testing

Pest feature tests in `tests/Feature/Integrations/`, providers faked with `Http::fake()` + `Http::preventStrayRequests()`, `Queue::fake()`, `Event::fake()`; unit tests for converters, URL safety and signature checks.

- **Availability:** each new provider appears exactly when its env is complete; inbound routes 404 when disabled or not applicable; with no new env and sync off, spec 6 tests pass unchanged.
- **Jira DC:** OAuth with PKCE, READ/WRITE, refresh; PAT: saved only with `acknowledged`, validated with `myself`/`serverInfo` (401 → 422, version < 8.14 → 422), stored encrypted (ciphertext ≠ token), sent as `Bearer`, absent from props/JSON/logs/jobs, `read` access refuses writes, 401 later → `ReconnectRequired`, remove deletes it, OAuth connect erases a stored PAT, endpoint 404 when `JIRA_DC_PERSONAL_TOKENS` false, only PAT offered when OAuth env missing; v2 search import; wiki markup ↔ Markdown cases (escaping of `{code}`, `[x|y]`, `!img!`); story points write-back; export with `name` assignee and priority; email matching (exact one active with equal email); automatic vs manual webhook registration by `ADMINISTER`.
- **GitHub:** forged `installation_id` refused (not in `/user/installations`); user token not stored; JWT claims and RS256 signature verifiable with the public key; installation token cached encrypted and reused; milestone `active`/`upcoming`; PRs excluded; query restricted to the repository; export body with due line; dropped assignee → `assigneeRejected`; missing label → `priorityUnavailable`; SSO match via `social_accounts`; estimate block: inserted once at the end, updated in place, duplicates collapsed to one, rest of the body byte-identical (CRLF, trailing text, Markdown kept), removed on clear, no write when unchanged or when clearing a body without block, T-shirt and custom labels written escaped, `?`/`☕` never written, concurrent edit detected → restart, 3 failures → error, > 65 536 → error, read access → unsupported; import strips the block from the description and reads it as source estimate; installation deleted/suspended → `ReconnectRequired`.
- **Game room invites:** for each of `msteams`, `mattermost`, `webhook`: 404 when the provider is disabled, 409 when not connected ("Connect/Reconnect :provider in the team settings.") and 422 only for `includeGuestLink` on a `team` room, 403 for guests and non-managers; a `game_room_link` delivery and job are created; the message carries room, game, team, sharer and `/games/{room}` or, on opt-in, `/play/{token}`, escaped, no player names; generic body is `event = game_room.link` with `data {title, game, team, url, sharedBy}`, signed; job completion broadcasts `game.room.changed`.
- **Teams / Mattermost / generic webhook:** URL validation (hosts, schemes, ports, userinfo, Mattermost prefix and key length); generic webhook only: private, loopback, link-local, CGNAT, IPv6 ULA refused (allowed with the env flag) and DNS pinning option set (Teams and Mattermost hosts are admin-confined and skip both); redirects not followed; Adaptive Card and Mattermost escaping (`@channel`, `~town-square`, Markdown links neutralized); size truncation; generic signature = HMAC of `timestamp.body`, secret shown once, rotation invalidates; body matches recap rules on anonymous and named retros (no authors, names null when anonymous); 410 → `ReconnectRequired`, other 4xx no retry, 5xx retry.
- **Generic webhook events:** nothing sent without a subscription; each of the five events sent when subscribed, with the catalogue's `data`; `retro.completed` on each transition into `Completed`; `poker.task.estimated` not on clear; anonymous retro → no card authors, `participants.names` null, action item names present; guest actor → `createdBy`/`completedBy` null; no votes, comments, emails; payload built at event time (item deleted before delivery still delivered); `X-Skrum-Delivery` stable across retries, signature recomputed; retries on 5xx/timeout/429, none on other 4xx; delivery row `attempts`/`response_status`; 10 consecutive failures without success in 24 h → `ReconnectRequired` + `disabledReason = failures`, 9 failures or a recent success → still active, 2xx resets; re-enable resets; events while disabled not queued; delivery log Owner/Admin only, paginated; Teams/Mattermost/Slack never receive events; unknown event names → 422.
- **Inbound:** valid signatures accepted per provider, invalid → 401 + `rejected` row without payload; Linear stale `webhookTimestamp` refused; duplicates → 200 without job; untracked issue → `ignored`; the job re-fetches (a payload claiming "done" for an issue the API returns open changes nothing); routing by organization/installation to several teams; Jira dynamic webhook registration, refresh under 7 days, deletion on sync off; `failing` detection switches to the polling interval.
- **Polling:** due-ness per mode and interval; incremental filter and cursor; full read marks missing and clears on reappearance; only tracked issues (open or completed < 90 days, games not ended); 429 postpones.
- **Status sync:** done mapping per provider incl. `doneStatusIds`, `treatCanceledAsDone` both ways; transition choice (configured, preferred names, category fallback), required `resolution` filled, other required field → failure message; skrum complete/reopen pushes, source already in state → no call; inbound applies via system actor with `origin = external` and no push-back; conflict: unpushed local change newer wins, source newer wins, tie → skrum; read-only integration stops pushes but not inbound; sync off → no listener dispatch, no polling (spec 6 behaviour); turning on performs a full read without pushing; retry endpoint for managers only, guests 403.
- **Poker sync:** automatic refresh of fields and status; ended games untouched; `game.changed` above 10 changed tasks; estimate conflict flagged only after `synced_at`, both resolutions, no matching card → 422; facilitator only.
- **MCP:** `poker.sources.list` returns trackers only (never Teams/Mattermost/webhook), includes `jira_dc`/`github`, `canSyncStatus`, `syncMode`, GitHub `canWriteBack` true with write access and false with the read-only reason, no credentials; iterations for GitHub; `poker.game.task.sync` on a GitHub task dispatches the block write.
- **Secrets:** URLs, tokens and secrets absent from props, JSON, logs and serialized jobs; errors keep host only.
- **Translations:** `TranslationKeysTest` passes.
- **Manual walkthrough:** Jira DC test server with OAuth (connect, import, estimate, export, register webhook, close issue in Jira → item completed in skrum), then reconnected with a personal access token (warning shown, issues created as the token owner, revoke the token in Jira → reconnect required); GitHub App on a test org (import a milestone, estimate with a Fibonacci and a T-shirt game and see the block in the issue body, edit the body around it in GitHub and re-estimate, export with SSO-mapped assignee, close/reopen both ways with webhooks, then with the webhook secret removed and polling); Teams workflow and Mattermost channel recap from an anonymous retro; generic webhook to a request inspector with signature verified, then subscribed to all five events (complete a retro, create/complete/reopen an item, estimate a task) and the delivery log checked; a receiver returning 500 shows retries and, after 10 failures, the disabled state; `APP_URL=http://localhost` shows polling mode.

Type-check and lint stay green; no frontend test runner is added.

## 14. Acceptance criteria

1. Jira Data Center, GitHub Issues, Microsoft Teams, Mattermost and generic webhooks are available only when their env configuration is complete, and only Owners/Admins connect and configure them; with none configured and status sync off, skrum behaves exactly as with spec 6.
2. Jira DC connects through OAuth 2.0 (preferred) or, as a fallback, a personal access token that Owners/Admins paste, which is stored encrypted, never shown again, clearly labelled as acting as its owner, and removable; it supports import, refresh, story-points write-back, export with assignee and priority mapping, and status sync. GitHub supports import by milestone or search, estimate write-back into a single managed block of the issue body (inserted once, updated in place, removed on clear, rest of the body untouched, any deck but never `?`/`☕`), export with SSO-linked or manual assignee mapping and optional priority labels, and status sync.
3. Teams, Mattermost and generic webhooks receive board/poker links, game room invites (spec 7 §3.1, `game_room.link` for webhooks) and results recaps with exactly spec 6's content rules; generic webhook requests are HMAC-signed and never reach private addresses unless the admin allows it.
4. A generic webhook sends the automatic events its Owners/Admins subscribed to (`retro.completed`, `action_item.created`, `action_item.completed`, `action_item.reopened`, `poker.task.estimated`) and nothing else, with the documented payloads and redaction (no card authors on anonymous retros, no Writing-phase content, action items named); failed deliveries are retried with backoff, every delivery appears in the delivery log, and the webhook disables itself after 10 consecutive failures until re-enabled. No other channel sends automatic events.
5. With status sync on, completing or reopening an exported action item in skrum moves the issue to the configured done/open status, and closing or reopening the issue in the source completes or reopens the item, within seconds with webhooks or within the polling interval otherwise; conflicts resolve by most recent change, ties to skrum; nothing loops.
6. Imported poker tasks of running games follow their source automatically (fields and status); a source estimate that diverges from the skrum estimate is flagged for the facilitator, never overwritten silently.
7. Inbound webhooks are verified (signature or secret URL token), de-duplicated, never stored, and only trigger a re-read of issues skrum tracks; when `APP_URL` is not public or webhooks stop arriving, polling takes over.
8. `poker.sources.list` lists every connected issue tracker (Jira, Jira DC, Linear, GitHub) with what it can do (import, write-back — true for GitHub with write access — status sync, sync mode) and never lists chat channels or credentials.
9. All calls are server-side; no raw webhook payload, secret, personal access token or URL key reaches the browser, a log or a job payload.
10. All new strings are translated in en/fr/es/de; suite, phpstan, type-check and lint are green; no new dependency; the walkthrough passes.

Plan-writing amendments (2026-10-01): applied in §2.1, §3, §4.1, §4.2, §4.3, §4.4, §4.5, §4.7, §5.2, §5.3, §5.4, §5.6, §5.8, §7, §7.1, §9, §10, §11 (plans 14a–14d, "Spec amendments made with this plan", and their plan-writing rulings: `completedVia` hidden from guests; GitHub issue reads batched).

## Decisions (2026-09-30)

1. **Status sync default:** opt-in per tracker integration, off by default.
2. **Status conflict rule:** the most recent change wins; a tie goes to skrum.
3. **Canceled / not planned issues:** count as done, switchable per integration ("Treat canceled as done").
4. **Jira Data Center authentication:** both — OAuth 2.0 application link (env, preferred, DC 8.22+) and an Owner/Admin-pasted personal access token as fallback (DC 8.14+, encrypted, acts as its owner with a UI warning, removable); OAuth wins when both are possible.
5. **GitHub estimate write-back:** into the issue body, as one managed `<!-- skrum:estimate -->` block inserted once, updated in place, removed on clear; any deck label, never `?`/`☕`.
6. **Microsoft Teams mechanism:** Workflows webhook URL pasted by an Owner/Admin, host allowlist.
7. **Generic webhooks:** manual shares and automatic events subscribed per webhook (five-event catalogue, signed, retried, logged, auto-disabled after 10 consecutive failures); other channels get no automatic events.
8. **Polling interval:** every 5 minutes (configurable 1–60), hourly reconciliation in webhook mode.
