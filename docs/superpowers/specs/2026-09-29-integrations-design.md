# Skrum — Integrations — Design

Date: 2026-09-29
Status: Approved decisions, awaiting spec review
Parent spec: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (tenancy, roles, guests, redaction, i18n and packaging rules apply unless this spec says otherwise — see §14). Latest conventions: `docs/superpowers/specs/2026-09-29-board-engagement-design.md`.
Builds on specs `2026-09-29-retro-flow-extras-design.md` (Results view, summary, ROTI, suggested actions), `2026-09-29-action-items-v2-design.md` (action items, `ActionItemPermissions`, deep link) and `2026-09-29-planning-poker-design.md` (poker tasks with reserved external-reference columns). Their decisions are settled (2026-09-29/30); §1 lists the ones this spec depends on. It also backs the poker tools of the MCP contract `docs/superpowers/research/qretro/mcp-readme.md` (§9.1).
Research: `docs/superpowers/research/qretro/` (QRetro parity roadmap, spec 6 of 7; `docs-inventory.md` § Integrations and § Planning poker, `research.md` § Integrations)

## 1. Intent

Connect a team's retros, poker games and action items to the tools it already uses: post a board link or a results recap to a Slack channel or a Telegram chat, email the results to the team, import poker tasks from Jira Cloud or Linear and write the final estimate back, and export action items as Jira or Linear issues. Everything is optional and self-hosting friendly: an integration exists only when the instance admin configured its credentials, all calls go from the server, and nothing written during the hidden `Writing` phase or identifying an anonymous author ever leaves the instance.

**Success:** every rule below is covered by a feature test (provider APIs faked with `Http::fake()`) or a step of the walkthrough (§15); with no integration env variable set, no integration UI, route or job is reachable and every existing screen works unchanged; suite, phpstan, type-check and lint stay green; no new Composer or npm dependency.

### In scope

- Team-level integrations page, managed by workspace Owners/Admins: connect, test, configure, reconnect, disconnect.
- **Slack**: OAuth install into one channel per team; post a board or poker link; post the results recap; "Reconnect required" state.
- **Telegram**: instance bot (token in env); a chat connects with `/connect@bot <code>`; post a link or the results recap.
- **Email results**: "Send to email" on the Results view, to participants with an account or to all team members.
- **Jira Cloud** and **Linear** (OAuth, read or read+write): poker import (sprint/cycle or query) with title, description, assignee and existing estimate; refresh imported tasks; estimate write-back; action item export as an issue.
- Encrypted credentials, queued deliveries with retries, token refresh, daily connection check, delivery log.

### Out of scope (deferred)

- Event notifications (retro started, action item assigned/overdue, "important events" to Telegram). The `ActionItemAssigned` / `ActionItemCompleted` events from spec 3 remain unsubscribed.
- Two-way sync: status changes in Jira/Linear never flow back; imported tasks are refreshed only on demand (§6.4). No inbound webhooks from Slack, Jira or Linear.
- Jira Server / Data Center, GitHub Issues, Microsoft Teams, Mattermost, generic webhooks.
- Slack slash commands or interactive buttons; Slack user sign-in (SSO is the core spec's business).
- Several Slack channels or Telegram chats per team; several Jira sites or Linear workspaces per team.
- Assignee mapping on export (skrum users → Jira/Linear accounts), Jira priority mapping, reporter import.
- Game room invites (not in spec 7 either; a later change can reuse the link share of §5.1).
- Personal (per-user) integrations; MCP tools for Slack, Telegram, email and action item export (the MCP tools this spec backs are the poker ones, §9.1).

### Dependencies

- **None new.** OAuth 2.0 flows, the Slack, Telegram, Jira and Linear APIs, and Jira ADF conversion are written against Laravel's HTTP client (`Http::`), following the provider-interface pattern of `app/Support/Gifs/GifProvider.php`. Socialite (installed for SSO) is not used: it models a user signing in, not a team-owned token with refresh and scopes, and a Slack/Atlassian/Linear driver would need `socialiteproviders/*` packages. No Slack, Atlassian or Linear SDK.
- Uses the existing queue worker (`docker/s6-rc.d/queue/run`, database queue) and scheduler services, and Laravel's `encrypted:array` cast (APP_KEY; `APP_PREVIOUS_KEYS` keeps old credentials readable after key rotation).

### Settled by earlier specs

- Spec 2 (retro flow extras): Results view exists for `Completed` retros with `results.changed` refetch; health and ROTI averages are always shown whatever the number of answers (decisions 1, 9); the survey "Show who answered" switch is forced off on anonymous retros (decision 2); the AI summary is generated automatically on completion by a queued job unless the retro opted out (`ai_summary_enabled`) or no provider is configured, stored in `retros.summary` with `summary_status` (decision 8); themes, suggested actions and card sentiment/category come from the same job (decision 10).
- Spec 3 (action items v2): assignees are team members or guests of the retro (decision 1); managers = author, facilitator, workspace Owner/Admin (`ActionItemPermissions::canEdit`, decision 2); action items and their comments are always named, even on anonymous retros, while card authorship stays hidden (decision 5); `?item=` deep link on `/w/{workspace}/action-items`.
- Spec 4 (planning poker): separate `poker_players` (decision 1); final estimate is any non-special deck card, set by `SetPokerEstimate` (decision 2); facilitator and non-guest players add tasks (decision 3); `poker_tasks.external_source/external_id/external_url` exist (decision 8).
- MCP contract (`docs/superpowers/research/qretro/mcp-readme.md`): the poker tools `poker.sources.list`, `poker.iterations.list`, `poker.game.tasks.import` and `poker.game.task.sync` are backed by this spec's services (§9.1).

## 2. Configuration and availability

### 2.1 Env variables (`config/services.php`)

| Provider | Env | Config keys | Enabled when |
|---|---|---|---|
| Slack | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | `services.slack.client_id`, `services.slack.client_secret` (the existing `services.slack.notifications` block is untouched) | both set |
| Telegram | `TELEGRAM_BOT_TOKEN` | `services.telegram.bot_token` | set |
| Jira Cloud | `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET` | `services.jira.*` | both set |
| Linear | `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` | `services.linear.*` | both set |
| Email results | existing `MAIL_*` | `mail.default` | mailer is not `log` or `array` |

- Enum `App\Enums\IntegrationProvider` (`Slack = 'slack'`, `Telegram = 'telegram'`, `Jira = 'jira'`, `Linear = 'linear'`) with `isEnabled()` / `enabled()` / `label()`, modelled on `App\Enums\SsoProvider::requiredConfigKeys()`.
- A disabled provider: its routes return 404, its UI is absent, its jobs are never dispatched, and existing rows for it are kept but ignored (re-enabling the env restores them).
- OAuth redirect URIs are fixed: `{APP_URL}/integrations/{slack|jira|linear}/callback`. `.env.example` documents each variable, the redirect URI, the scopes to enable in each provider's developer console (§4), that Slack requires an HTTPS redirect URI, and that a Telegram bot token must be used by one skrum instance only (§4.2).
- The Telegram bot username is read with `getMe` and cached for 24 h (no extra env variable).

### 2.2 Where integrations appear

- Team integrations page: only enabled providers are listed. With none enabled, the "Integrations" link on the team page is hidden.
- Share / import / export controls appear only when the relevant integration is enabled **and** connected with status `active` for the team that owns the retro, poker game or action item.

## 3. Data model

All tables use UUID primary keys and `foreignUuid`, as the rest of the schema. Migrations are up-only.

### `team_integrations` — new

| Column | Type | Meaning |
|---|---|---|
| `team_id` | FK → teams, cascade | Owner team |
| `provider` | string | `IntegrationProvider` |
| `status` | string | Enum `IntegrationStatus`: `Active` (`active`), `SetupRequired` (`setup_required`, Jira with several sites, §4.3), `ReconnectRequired` (`reconnect_required`) |
| `access` | string | `read` or `write` (Jira/Linear); `write` for Slack/Telegram |
| `credentials` | text, `encrypted:array` cast, `$hidden` | Slack: `webhook_url`, `access_token`. Jira/Linear: `access_token`, `refresh_token`, `expires_at`. Telegram: none (bot token is instance-wide) |
| `settings` | json | Non-secret metadata, see below |
| `connected_by_user_id` | FK → users, null on delete | Who connected |
| `last_error` | nullable string 500 | Last provider error, sanitized (§10.4) |
| `last_checked_at` | nullable timestamp | Last successful check or use |
| timestamps | | |

- Unique (`team_id`, `provider`): one connection per provider per team.
- `settings` by provider — Slack: `{teamId, teamName, channelId, channelName, configurationUrl}`; Telegram: `{chatId, chatTitle, chatType}`; Jira: `{cloudId, siteUrl, siteName, sites?: [{cloudId, url, name}], storyPointFields: [{id, name}], exportProjectId?, exportIssueTypeId?}`; Linear: `{organizationId, organizationName, urlKey, exportTeamId?}`.
- Model `TeamIntegration` with `team()`, casts, `isActive()`, `canWrite()`. `Team` gains `integrations()` and `integration(IntegrationProvider): ?TeamIntegration`.

### `poker_tasks` — new columns (the reserved `external_source`, `external_id`, `external_url` become used)

| Column | Type | Meaning |
|---|---|---|
| `external_site` | nullable string 100 | Jira `cloudId` or Linear organization id the task was imported from |
| `external_key` | nullable string 50 | Human key (`PROJ-123`, `ENG-42`) |
| `external_assignee` | nullable string 100 | Assignee display name at import/refresh time |
| `external_estimate` | nullable string 16 | Estimate found in the source at import/refresh time |
| `external_refreshed_at` | nullable timestamp | Last import or refresh |
| `needs_sync` | bool, default `false` | Estimate changed since the last successful write-back |
| `sync_error` | nullable string 500 | Last write-back error (translated message key + provider detail) |
| `synced_at` | nullable timestamp | Last successful write-back |

`external_source` ∈ `jira`, `linear`; `external_id` is the Jira issue id or the Linear issue UUID.

### `action_item_external_links` — new (hook announced in spec 3 §9)

- `id`, `action_item_id` (cascade), `source` (`jira`|`linear`), `external_site`, `external_id`, `external_key`, `external_url`, `created_by_user_id` (null on delete), timestamps.
- Unique (`action_item_id`, `source`): an item is exported at most once per provider.

### `integration_deliveries` — new

- `id`, `team_id` (cascade), `channel` (`slack`|`telegram`|`email`), `kind` (`retro_link`|`poker_link`|`retro_results`), `subject_type` / `subject_id` (morph: `Retro`, `PokerGame`; cascade handled by a model `deleting` hook on both), `requested_by_user_id` (null on delete), `status` (`queued`|`sent`|`failed`), `recipient_count` (nullable int, email only), `error` (nullable string 500), `sent_at` (nullable), timestamps.
- `Prunable`: rows older than 90 days are pruned by the daily `model:prune` schedule.

### Transient state (cache / session, no table)

- OAuth state: session key `integrations.oauth` = `{state, provider, teamId, access, expiresAt}` (10 min).
- Telegram connect code: cache `telegram-connect:{sha256(code)}` → `{teamId, userId}` for 15 min, plus `telegram-connect-team:{teamId}` → hash, so issuing a new code invalidates the previous one.
- Telegram update offset: cache `telegram:update-offset` (forever).

## 4. Connections

### 4.1 Slack (OAuth v2, incoming webhook — decision 2)

- Connect → redirect to `https://slack.com/oauth/v2/authorize` with `client_id`, `scope=incoming-webhook`, `redirect_uri`, `state`. Slack's own consent screen asks the installer for the workspace and **channel**; that is the channel picker. Changing channel = "Reconnect".
- Callback exchanges the code at `https://slack.com/api/oauth.v2.access`; stores `incoming_webhook.url` (validated to start with `https://hooks.slack.com/`, otherwise the connection is refused) and `access_token` in `credentials`, and `team`, `incoming_webhook.channel/channel_id/configuration_url` in `settings`.
- Sending: `POST` the Block Kit JSON to the webhook URL (§5.4). Status `404 no_service` / `channel_not_found`, `403 action_prohibited` / `posting_to_general_channel_denied`, `410 channel_is_archived` → the integration becomes `ReconnectRequired` and the delivery fails without retry.
- Check: `auth.test` with the access token; `invalid_auth`, `token_revoked`, `account_inactive` → `ReconnectRequired`.
- Disconnect: `auth.revoke` (best effort, failure ignored), then the row is deleted.

### 4.2 Telegram (instance bot, long polling — decision 3)

- The instance admin creates a bot with BotFather and sets `TELEGRAM_BOT_TOKEN`. skrum never receives inbound HTTP from Telegram: `php artisan skrum:telegram-poll` calls `getUpdates` (long poll, `timeout=50`, `allowed_updates=["message","channel_post","my_chat_member"]`) and is scheduled every minute with `withoutOverlapping()->runInBackground()`, so commands are handled within seconds.
- If Telegram answers `409 Conflict` (a webhook is set on the bot, or another instance polls it), the command logs one warning per hour and the integrations page shows "The Telegram bot is used elsewhere. Remove its webhook or use a dedicated bot."
- **Connect flow:** an Owner/Admin clicks "Connect" → `POST …/integrations/telegram/code` returns an 8-character code (alphabet without `0 O 1 I L`), valid 15 min, single use, and the exact command `/connect@{botUsername} {code}` with a copy button and a `https://t.me/{botUsername}` link. The admin adds the bot to a group, supergroup or channel (as admin for channels), or opens a private chat, and sends the command. The page polls every 5 s (Inertia `usePoll`) while the code is pending.
- **Handled updates** (`App\Support\Integrations\Telegram\HandleTelegramUpdate`):
  - `/connect[@bot] CODE` in `message` or `channel_post`: a valid code creates or replaces the team's Telegram integration with `{chatId, chatTitle, chatType}` and replies "Connected to the :team team on :app." An invalid or expired code replies "This code is invalid or has expired. Create a new one in skrum." After 5 invalid attempts from a chat within an hour, further `/connect` messages from it are ignored for that hour.
  - `/start` or `/help`: replies with a one-line explanation.
  - `migrate_to_chat_id` (group upgraded to supergroup): updates `chatId`.
  - `my_chat_member` where the bot's new status is `left` or `kicked`: the matching integration becomes `ReconnectRequired`.
  - Anything else is ignored; message text other than these commands is neither stored nor logged.
- Sending: `sendMessage` with `parse_mode=HTML` (§5.4). `403` (bot blocked or removed) or `400 chat not found` → `ReconnectRequired`, no retry; `429` → released after `parameters.retry_after`.
- Check: `getChat(chatId)`, same error mapping. Disconnect: the bot leaves the chat (`leaveChat`, best effort) and the row is deleted.

### 4.3 Jira Cloud (OAuth 2.0 3LO)

- Connect asks the admin to choose **Read only** (import) or **Read and write** (import, estimate write-back, export). Redirect to `https://auth.atlassian.com/authorize` with `audience=api.atlassian.com`, `prompt=consent`, `response_type=code` and scopes `offline_access read:jira-work read:board-scope:jira-software read:sprint:jira-software`, plus `write:jira-work` for write.
- Callback exchanges the code at `https://auth.atlassian.com/oauth/token`, then calls `/oauth/token/accessible-resources`. One site → `Active` with its `cloudId`, `url`, `name`. Several sites → `SetupRequired` with `sites` listed; the admin picks one (`PATCH` settings) and the status becomes `Active`. No site → the connection is refused ("This Atlassian account has no Jira site.").
- **Upgrading access** (read → write) runs the OAuth flow again from the same card; the row, its site and all imported references are kept. Downgrading is not offered (disconnect and reconnect read-only).
- All API calls go to `https://api.atlassian.com/ex/jira/{cloudId}/…`; `siteUrl` is used only to build browse links (`{siteUrl}/browse/{key}`).
- **Story points field detection** (on connect, and on "Detect again"): `GET /rest/api/3/field`, numeric custom fields only; candidates ordered: `schema.custom = com.pyxis.greenhopper.jira:jsw-story-points` first, then name (case-insensitive) "Story Points", then "Story point estimate". Stored as `storyPointFields`. The admin can choose a different numeric custom field as the first candidate. No candidate → write-back is unavailable for Jira and the card says "No story points field found."
- Check: `accessible-resources` must still contain `cloudId`. Disconnect deletes the row; Atlassian has no public revocation endpoint, so the confirmation dialog tells the admin to remove the app under "Connected apps" in their Atlassian account.

### 4.4 Linear (OAuth 2.0)

- Connect with **Read only** (`scope=read`) or **Read and write** (`scope=read,write`), redirect to `https://linear.app/oauth/authorize` (`actor=user`), exchange at `https://api.linear.app/oauth/token`, then the GraphQL `viewer { organization { id name urlKey } }` fills `settings`. Upgrade works as for Jira.
- GraphQL endpoint `https://api.linear.app/graphql`. GraphQL `errors` with `AUTHENTICATION_ERROR` → `ReconnectRequired`.
- Disconnect: `POST https://api.linear.app/oauth/revoke` (best effort), then delete.

### 4.5 Common rules

- **OAuth state**: 40 random characters in the session, compared with `hash_equals`, single use, 10 min. The callback re-checks that the current user may still manage the team's integrations. A mismatch, expiry, provider `error` parameter or failed exchange redirects to the integrations page (or the dashboard when the team is gone) with a translated flash "Could not connect :provider. Try again."
- **Token refresh** (Jira; Linear when the token response includes `refresh_token` and `expires_in`): before each call, if `expires_at` is within 60 s, refresh under `Cache::lock("integration-token:{id}", 30)` and a `lockForUpdate` on the row, re-reading the row inside the lock so concurrent jobs never use a rotated refresh token twice. `invalid_grant` → `ReconnectRequired`.
- **Status transitions**: any 401 from a provider after one refresh attempt, or the provider-specific errors above → `ReconnectRequired` with `last_error`. A successful reconnect for the same site/workspace/chat keeps the row and returns it to `Active`. Reconnecting Jira to a different `cloudId` (or Linear to a different organization) is allowed; tasks and links from the old site keep their stored references but are no longer synced or refreshed (their `external_site` no longer matches).
- **Daily check**: `php artisan skrum:check-integrations` (scheduled daily) runs the provider check for every `Active` integration of an enabled provider, updating `last_checked_at` or the status. Network errors and 5xx do not change the status.
- **Clients**: `App\Support\Integrations\{Slack,Telegram,Jira,Linear}\*Client`, built on `Http::` with a 15 s timeout (60 s for Telegram long polling), resolved per call (no static state, Octane-safe). Base URLs are constants; no user-supplied URL is ever requested (Slack webhook URLs are checked against `https://hooks.slack.com/` before storage and before each use).

## 5. Sharing

### 5.1 Board and poker links

- **Retro** (any phase except `Completed`): message "{sharer} invites you to the retrospective "{title}" ({team})" with a button/link to `/retros/{id}` (team members sign in). When guest access is enabled, the dialog offers "Include the guest link (anyone in the channel can join)", off by default; when checked, the `/join/{guestToken}` URL is used instead.
- **Poker game** (not ended): same with `/poker/{id}` and optionally `/poker/join/{guestToken}`.
- Nothing else about the board is sent: no card, column, participant or vote data.

### 5.2 Results recap (Slack and Telegram)

Allowed only for `Completed` retros. Built once at dispatch by `App\Actions\Integrations\BuildRetroRecap` from the data the Results view shows (spec 2 §6), in the sharer's locale:

1. Title, team, completion date, link to the retro (Results tab).
2. Participants: count; names only when the retro is not anonymous (decision 8; display names, guests suffixed "(guest)"). Anonymous retro: count only.
3. Cards: number of cards (top-level and grouped).
4. ROTI: average and respondent count whenever at least one rating exists (no threshold, spec 2 decision 9); the distribution is not sent.
5. Summary: the stored `retros.summary` when `summary_status` is `ready`. Since the summary is generated automatically at completion (spec 2 decision 8), a recap requested right after completion may find it `pending`: the share dialog then says "The summary is still being generated and will not be included." and the sharer may wait or send without it. Opted-out retros, retros without a provider and `failed` generations simply have no summary line. Sharing never triggers a generation.
6. Action items: up to 10 (open first, then by priority), each with content, assignee name and due date; "+ n more" beyond. Action items are always named (spec 3 decision 5), so assignee names are sent as stored, also on anonymous retros ("(guest)" suffix for guest assignees). The creator is not included (not needed; see §10.1).
7. Suggested actions: up to 5 `pending` suggestions (spec 2 §6.5), content only, "+ n more" beyond; omitted when there are none. They are derived from revealed content and carry no author information.
8. Top card per column: for each column, the top-level card with the most votes (ties → lowest position), content truncated to 300 characters, vote total and grouped-card count. Columns without voted cards are skipped. Card authors are never included, named or anonymous retro alike.

Surveys, health-check scores, comments (card and action item), reactions, GIFs, themes and card sentiment/category are not part of the recap.

### 5.3 Email results

- "Send to email" on the Results view (`Completed` only). Audience chosen in the dialog: **Participants** (members who have a participant row in the retro; default) or **All team members**. Recipients are always current team members with a verified email; guests (no account) are never emailed, and removed members are excluded at send time.
- One queued `RetroResultsNotification` (mail, `ShouldQueue`, `ShouldBeEncrypted`) per recipient, rendered in the recipient's locale (`User::preferredLocale()`), containing the recap of §5.2 plus the health score (`x.x/10`, shown whatever the number of answers, spec 2 decision 1) and participation. The mail links to the Results view (sign-in required).
- At most one email send per retro per 10 minutes (429 "The results were emailed a few minutes ago."). The delivery row records `recipient_count`.

### 5.4 Message formatting and escaping

- **Slack**: Block Kit (`header`, `section`, `context`, `divider`, one `actions` button for the link); `text` fallback set. All user content escaped (`&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`) so card text cannot produce mentions (`<!channel>`), links or user pings. Section text ≤ 3000 characters and ≤ 50 blocks, truncating the action-item and top-card lists first.
- **Telegram**: HTML parse mode with `htmlspecialchars` on all user content; ≤ 4096 characters, truncated the same way; `link_preview_options.is_disabled = true`.
- **Email**: Laravel Markdown mail; user content escaped by the mail template.

### 5.5 Delivery

- Endpoints create an `integration_deliveries` row (`queued`) and dispatch `DeliverToSlack` / `DeliverToTelegram` (after commit, `ShouldBeEncrypted`, message pre-built in the payload) or the notifications. They return 202 with the delivery.
- Jobs: `tries = 4`, `backoff = [10, 60, 300]`; 429 → `release(retry_after)`; 5xx and connection errors → retry; the provider errors mapped in §4 → fail immediately. On success `status = sent`, `sent_at`; on final failure `status = failed`, `error`. Either way `results.changed` (retro) or `game.changed` (poker) is broadcast so the sharer's view refreshes the delivery line.

## 6. Planning poker import and write-back

### 6.1 Who and where

- Import and refresh: players allowed to add tasks (poker spec §3: facilitator and non-guest players), only when the game's team has an `Active` Jira or Linear integration, while the game is not ended. Guests never see import controls or source metadata beyond what §6.5 allows.
- Write-back retry: facilitator.

### 6.2 Browsing the source (synchronous, 15 s timeout)

| Mode | Jira | Linear |
|---|---|---|
| Containers | `GET /rest/agile/1.0/board` (scrum boards, name filter, 50 per page) | `teams` |
| Iterations | `GET /rest/agile/1.0/board/{id}/sprint?state=active,future` | `team.cycles` where not completed (active and upcoming) |
| Issues of an iteration | `POST /rest/api/3/search/jql` with `sprint = {id}` | `cycle.issues` |
| Query | `POST /rest/api/3/search/jql` with the user's JQL (Jira's error messages are returned on 400) | `searchIssues(term)` |

- Requested fields only: Jira `summary`, `description`, `assignee`, `status`, the story-point candidate fields; Linear `id identifier title description url assignee { displayName } estimate`.
- A preview returns at most 100 issues `{externalId, key, title, assignee, estimate, status, alreadyImported}` and `truncated: true` when more exist ("Showing the first 100. Narrow the query.").

### 6.3 Importing

- `POST …/imports/{source}` with the selected `externalIds` (1–100). The server re-fetches those issues (never trusts client-sent titles), then creates tasks appended in the given order, in one transaction with the game locked:
  - `title` = summary/title trimmed to 200 characters; `description` = Markdown (Linear as is; Jira ADF converted by `App\Support\Integrations\Jira\AdfToMarkdown`: paragraphs, headings, marks, links, lists, code blocks, quotes, rules, mentions and emoji as text, tables as pipe rows, media dropped with "[attachment]"), truncated to 10 000 characters with "…" appended; `external_*` columns filled; `external_estimate` from the first non-null story-point candidate (Jira) or `estimate` (Linear).
  - Already imported issues (unique `poker_game_id, external_source, external_id`) are skipped and counted.
  - The 200-task limit applies to the whole batch (422 "This game can hold 200 tasks at most." when exceeded, nothing imported).
- Response `{imported, skipped}`; broadcast `game.changed` (clients refetch the snapshot).
- The source's existing estimate is shown for reference only; it never becomes the skrum estimate.

### 6.4 Imported tasks and refresh (decision 5)

- Title and description of an imported task are read-only in skrum (422 "This task is managed in :source." on edit); they are refreshed from the source with "Refresh from :source" (game-level button), which re-fetches every imported task of the game from the connected site in batches of 100 (`id in (…)` / `issues(filter: {id: {in: […]}})`), updates title, description, assignee, source estimate and `external_refreshed_at`, and broadcasts `game.changed`. Issues deleted or no longer visible in the source keep their data and show "Not found in :source".
- Deleting an imported task in skrum never touches the source.

### 6.5 Estimate write-back (decision 4)

- When the facilitator sets or clears the estimate of an imported task (`PUT tasks/{task}/estimate`, poker spec §3), `needs_sync` becomes true and `SyncTaskEstimate` is dispatched after commit, **if** the team's integration for `external_source` is `Active`, has `write` access and the same `external_site`. The job is `ShouldBeUnique` per task, reads the latest estimate at run time (several quick changes produce one write), `tries = 5`, `backoff = [10, 30, 120, 600]`.
- **Cannot sync** (no job, `syncState: 'unsupported'` with a reason): non-numeric deck (T-shirt, non-numeric custom) — "T-shirt estimates can't be written to :source."; read-only access; integration missing or on another site. `?` and `☕` can never be an estimate (poker spec), so they are never written.
- **Jira**: `GET /rest/api/3/issue/{id}/editmeta`; the first `storyPointFields` candidate present on the issue's edit screen is written with `PUT /rest/api/3/issue/{id}` `{"fields": {"customfield_x": number|null}}` (`½` → 0.5; a cleared estimate writes `null`). No candidate on the screen → failure "This issue has no story points field on its edit screen."
- **Linear**: the issue's team settings (`issueEstimationType`, `issueEstimationAllowZero`) are read first. `notUsed` → failure "Estimates are turned off for this Linear team." The value must be a whole number between 0 and 64 (Linear's maximum); `½` or fractions → failure "Linear only accepts whole-number estimates." `0` is sent as `0` when the team allows zero estimates and as `null` (clears the estimate) otherwise; a cleared skrum estimate sends `null`. Values Linear rejects for its scale come back as "Linear rejected this estimate: {message}".
- Success: `needs_sync = false`, `synced_at = now`, `sync_error = null`. Final failure: `sync_error` set, `needs_sync` stays true. Either way `task.saved` is broadcast to the game (`toOthers()` is not applicable from a job, so every client updates).
- `POST tasks/{task}/sync` (facilitator) is the retry/force path: it re-dispatches the job for an imported task that has an estimate and is syncable, whether `needs_sync` is true (retry after failure) or false (force a rewrite of the current estimate). The same service backs the MCP tool `poker.game.task.sync` (§9.1). A task without an estimate or in the `unsupported` state → 422 with the reason.

### 6.6 Payload

The poker spec's `external: null | {source, id, url}` becomes, for non-guest players:

```
external: null | {source, key, url, assignee|null, sourceEstimate|null, refreshedAt,
                  syncState: 'synced'|'pending'|'failed'|'unsupported'|null,
                  syncError|null, unsupportedReason|null, isManaged: true}
```

Guests receive `{source, key, url, isManaged: true}` only (assignee names from the source are team-internal). Snapshot adds `integrations: {jira: {connected, canWrite} | null, linear: … | null}` for non-guest players, `null` for guests.

## 7. Action item export (decision 6)

- **Who**: an authenticated team member who may edit the item (`ActionItemPermissions::canEdit` from spec 3: author, facilitator, workspace Owner/Admin). Guests never export. Allowed from the board (any phase, the item's retro not locked-and-in-progress, same 423 rule as spec 3's workspace endpoints) and from the global page. Requires an `Active` integration with `write` access on the item's team.
- **Target**: Jira → project (`GET /rest/api/3/project/search`) and issue type (`GET /rest/api/3/issuetype/project?projectId=`, "Task" preselected when present); Linear → team. The last choice is saved in the integration `settings` and preselected next time.
- **Created issue** (synchronous, 15 s timeout, so the user sees the key immediately):
  - Title: item content, first line, ≤ 255 characters.
  - Description: full content, then "From the retrospective "{title}" on {date}: {link}" where link is `/w/{workspace}/action-items?item={id}` (Jira as ADF, Linear as Markdown). Never the creator, comments, or other items.
  - Due date: `duedate` (Jira) / `dueDate` (Linear) when set. Linear priority: High → 2, Medium → 3, Low → 4. Jira priority and assignees are not set.
- The link row is inserted first inside a transaction with `lockForUpdate` on the item, so a double click cannot create two issues; a provider failure rolls it back (502 with the provider message). A timeout after the request was sent returns 502 "The issue may have been created. Check :source before trying again."
- Export is one-way and one-shot: later edits, completion or deletion in skrum or in the source do not propagate.
- `PresentActionItem` gains `externalLinks: [{source, key, url}]` (empty for guests); the board broadcasts `action-item.saved` after an export, per spec 3.

## 8. Permissions

| Action | Allowed for |
|---|---|
| View the integrations page, connect, reconnect, upgrade, configure, test, disconnect | Workspace Owners/Admins (`TeamPolicy::manageIntegrations` = `canManage($team->workspace)`) (decision 1) |
| Post a retro link, results recap to Slack/Telegram, email the results | The retro's facilitator when they are a team member, and workspace Owners/Admins (decision 7) |
| Post a poker link | The game's facilitator (non-guest) and workspace Owners/Admins |
| Browse, import, refresh (poker) | Players who can add tasks (facilitator, non-guest players) |
| Retry an estimate sync | The game's facilitator |
| Export an action item | Team members who can edit the item (§7) |
| See delivery status lines | Those who can share on that surface |

Guests are refused (403) on every integration endpoint; they never receive integration metadata except the reduced `external` object (§6.6).

## 9. Endpoints and events

Controllers in `app/Http/Controllers/Integrations/`, actions in `app/Actions/Integrations/`, provider clients in `app/Support/Integrations/`. Every route is registered only when its provider is enabled (else 404). Route names follow `routes/web.php` conventions.

### Team integrations (`auth`, `verified`, `w/{workspace}` group, `scopeBindings`)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/w/{workspace}/teams/{team}/integrations` | — | Inertia `teams/integrations` |
| GET | `…/integrations/{provider}/connect` | `?access=read\|write` | redirect to provider (Slack, Jira, Linear) |
| POST | `…/integrations/telegram/code` | — | `{code, command, botUsername, expiresAt}` (`throttle:10,1`) |
| PATCH | `…/integrations/{integration}` | Jira: `{cloudId?, storyPointFieldId?}` | 200 integration |
| POST | `…/integrations/{integration}/detection` | — | Jira: re-detect story-point fields |
| POST | `…/integrations/{integration}/test` | — | Slack/Telegram: sends "skrum is connected." to the channel; Jira/Linear: runs the check. 200 or 502 |
| DELETE | `…/integrations/{integration}` | — | 204 |
| GET | `…/integrations/{integration}/targets` | — | Jira projects + issue types / Linear teams (export dialog; any team member who can export) |

`GET /integrations/{slack|jira|linear}/callback` (`auth`) — OAuth callback (§4.5).

### Retro (under `/retros/{retro}`, participant resolved)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `shares` | `{channel: slack\|telegram, kind: link\|results, includeGuestLink?}` | 202 delivery (`throttle:5,1` per user) |
| POST | `results-email` | `{audience: participants\|team}` | 202 delivery |
| POST | `action-items/{actionItem}/exports` | `{source, projectId?, issueTypeId?, teamId?}` | 201 `{actionItem}` |

### Poker (under `/poker/{game}`, player resolved)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `shares` | `{channel, includeGuestLink?}` | 202 delivery |
| GET | `imports/{source}/containers` | `?q=&page=` | boards / teams |
| GET | `imports/{source}/iterations` | `?container=` | sprints / cycles |
| POST | `imports/{source}/preview` | `{mode: iteration\|query, iterationId?, query?}` (query 1–1000) | `{issues, truncated}` |
| POST | `imports/{source}` | `{externalIds: string[1..100]}` | 201 `{imported, skipped}` |
| POST | `imports/refresh` | — | `{refreshed, missing}` |
| POST | `tasks/{task}/sync` | — | 202 |

Browse endpoints are throttled at 30 requests/minute per player.

### 9.1 Services shared with the MCP server (spec 5)

The MCP poker tools are thin adapters over the same actions the HTTP controllers call, with the same permission checks (§8) and errors (§13); nothing is reimplemented in the MCP layer.

| MCP tool | Service | Notes |
|---|---|---|
| `poker.sources.list` | `ListPokerSources` (team) | Per enabled Jira/Linear provider with a connection for the team, the shape of spec 5 §6.2: `{source, siteName, status, access, canImport, canWriteBack, writeBackUnavailableReason}` (`canImport` = `active`; `canWriteBack` = `active`, `write` access and, for Jira, a story points field found); empty when none. Never returns credentials or settings beyond the site name. |
| `poker.iterations.list` | `ListPokerIterations` (team, source, container?) | The containers/iterations calls of §6.2 (active and upcoming sprints/cycles). |
| `poker.game.tasks.import` | `ImportPokerTasks` (game, source, externalIds or iteration/query) | The import of §6.3: same 100-per-call and 200-task limits, duplicates skipped. Whole-iteration import resolves the ids through §6.2 (capped at 100, `truncated` reported). Requires the player to be allowed to add tasks. |
| `poker.game.task.sync` | `SyncTaskEstimate` dispatch action (§6.5) | Retry/force of the automatic write-back; facilitator only; never sets the estimate. |

`poker.game.tasks.list` reads the task payload of §6.6 (tracker key, `syncState`). Setting an estimate directly stays impossible through MCP (poker spec).

### Workspace

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/w/{workspace}/action-items/{actionItem}/exports` | same as the retro route | 201 `{actionItem}` |

### Events and snapshot additions

- No new broadcast event. Deliveries trigger `results.changed` (retro, spec 2) or `game.changed` (poker); imports and refresh `game.changed`; write-back `task.saved`; exports `action-item.saved`.
- Retro snapshot: `integrations: {slack, telegram, email}` (booleans, true only when available **and** the viewer may share; all false for others); `results.deliveries`: the latest delivery per channel `{channel, kind, status, error, sentAt, requestedBy}` for viewers who may share, else `[]`.
- Poker snapshot: `integrations` (§6.6), `share: {slack, telegram}` for those who may share, and the latest delivery per channel.
- Integrations page props: per enabled provider `{provider, label, status, access, settings (non-secret), connectedBy, connectedAt, lastCheckedAt, lastError}`; `credentials` are never serialized.

## 10. Data leaving the instance and privacy

### 10.1 What is sent where

| Destination | Sent | Never sent |
|---|---|---|
| Slack / Telegram link | retro/game title, team name, sharer's name, URL (guest URL only on explicit opt-in) | any board content |
| Slack / Telegram recap | §5.2 items (incl. named action items and their assignees, pending suggested actions, the stored summary) | card authors, voters, individual votes/scores/ratings, comments (card and action item), surveys, themes and card sentiment, emails, guest tokens (except opt-in link) |
| Email | §5.3, to team members only | guest contacts; same exclusions as the recap |
| Jira / Linear import | JQL / search text, ids of selected issues | nothing from skrum |
| Jira / Linear write-back | the final numeric estimate for that issue | individual votes, round history, player names |
| Jira / Linear export | item content, due date, priority (Linear), retro title and date, deep link | creator, assignee, comments (withheld as data minimisation: action items are named in skrum, so this is a choice, not a redaction rule) |

### 10.2 Redaction invariants

- **Writing-phase content never leaves**: recaps and emails require `Completed` (all content revealed); link shares contain no board content; poker write-back sends only the final estimate, which exists only after a reveal.
- **Anonymous retros**: no card author name is ever sent (top cards); the recap lists the participant count only. Action items and their assignees are always named in skrum (spec 3 decision 5) and are sent named, also on anonymous retros; the share dialog says so.
- **Generated content**: the summary, suggested actions and themes were produced from revealed content without author information (spec 2 §6.5); the recap adds no author link to them.
- **Voter identity**: never sent; top cards carry totals only.
- **Guests**: never trigger an integration; never emailed; get no source metadata beyond key and URL.
- Imported descriptions pass through the poker spec's `RenderTaskMarkdown` (escaped HTML, images as links), so a Jira or Linear description cannot run script or make viewers' browsers contact a third party.

### 10.3 Server-only calls

Browsers never call Slack, Telegram, Atlassian or Linear APIs. The only browser navigation to a provider is the OAuth consent redirect (inherent to OAuth) and links the user chooses to open (issue URLs, `t.me` bot link, Slack configuration URL).

### 10.4 Secrets

- Credentials are encrypted at rest (`encrypted:array`, APP_KEY), hidden from serialization, and never included in payloads, logs, exception messages or job failure records (jobs carrying a webhook URL or token read it from the model at run time; message jobs use `ShouldBeEncrypted`).
- Provider errors are sanitized before storage in `last_error` / `sync_error` / delivery `error`: URLs are reduced to host + path, query strings and `Authorization` values removed, length ≤ 500.
- Rotating APP_KEY without `APP_PREVIOUS_KEYS` makes credentials unreadable: the integration becomes `ReconnectRequired` (decrypt exception caught) rather than throwing.

## 11. UI

All new strings in `lang/{en,fr,es,de}.json`. Provider names are not translated.

- **Team page** (`teams/show.tsx`): "Integrations" link for Owners/Admins when at least one provider is enabled.
- **Integrations page** (`resources/js/pages/teams/integrations.tsx`): one card per enabled provider with icon, status badge ("Not connected", "Connected", "Setup required", "Reconnect required" in red with `last_error`), connection details (Slack workspace and `#channel`; Telegram chat title; Jira site + access level + story points field select + "Detect again"; Linear workspace + access), and actions Connect / Reconnect / Upgrade to read and write / Send a test message / Disconnect (confirmation dialog stating what is removed, and for Jira the Atlassian revocation hint). Telegram card shows the code panel (§4.2) with countdown. Jira with several sites shows a site select.
- **Results view** (spec 2): header "Share" menu for sharers — "Send to email" (audience dialog, recipient count preview), "Share to Slack", "Share to Telegram"; the recap dialog shows what is included (with "The summary is still being generated and will not be included." while `summary_status` is `pending`) and, on an anonymous retro, "Participants are shown as a count. Action items are shown with names."; below the header a muted line per channel "Shared to Slack · 2 min ago" / "Slack: failed — reconnect required".
- **Board header share dialog** (existing guest-link dialog): "Post link to Slack / Telegram" buttons for sharers, with the guest-link checkbox when guest access is on.
- **Poker**: share dialog gains the same buttons; tasks pane "Import" button opening a dialog with source tabs (Jira / Linear), mode (Sprint/Cycle with container + iteration selects, or Query), result list with checkboxes (already imported greyed), "Import n tasks"; "Refresh from :source" in the tasks pane menu. Task items show the key chip; task detail shows key link, assignee, "Jira estimate: 5", read-only notice, sync badge (Synced / Pending / Failed + Retry for the facilitator / "Not synced: T-shirt deck").
- **Action item card** (board and global page): "Export to Jira/Linear" in the item menu → dialog with target selects; exported items show a `PROJ-12 ↗` chip.

## 12. Jobs, schedule and failure states

| Job / command | Trigger | Retries |
|---|---|---|
| `DeliverToSlack`, `DeliverToTelegram` | share endpoints | 4 tries, backoff 10/60/300 s, 429 honours retry-after |
| `RetroResultsNotification` (per recipient) | email endpoint | 3 tries (worker default) |
| `SyncTaskEstimate` | estimate saved / retry | 5 tries, backoff 10/30/120/600 s, unique per task |
| `skrum:telegram-poll` | every minute, without overlapping | next run |
| `skrum:check-integrations` | daily | next day |
| `model:prune` (`IntegrationDelivery`) | daily | — |

- Jobs whose integration disappeared or became `ReconnectRequired` fail immediately with the reconnect message; nothing is retried against a revoked token.
- `failed()` hooks set the delivery / task error and broadcast as in §5.5 / §6.5.
- `routes/console.php` gains the three schedule entries.

## 13. Error handling

- Provider not enabled → 404. Integration missing or not `Active` → 409 "Connect :provider in the team settings." / "Reconnect :provider in the team settings." (shown as toast with a link for admins).
- Read-only integration on a write action → 409 "This :provider connection is read-only."
- Provider 4xx on interactive calls → 422 with the provider message (JQL errors) or 502 ":provider did not respond. Try again later." for 5xx and timeouts. 429 from the provider → 429 "Too many requests to :provider, wait a moment."
- skrum rate limits → 429 with a translated message.
- Export conflicts (already exported) → 409 "Already exported as :key."
- Edits of managed tasks → 422 (§6.4). Import over 200 tasks → 422.
- OAuth failures → flash on the integrations page (§4.5).
- Every error message is translated; provider messages are appended verbatim after sanitizing.

## 14. Changes to other specs

- **Core spec**: "Out of scope: Integrations (Jira, Slack, …)" is delivered here; team settings gain an integrations page.
- **Retro flow extras (spec 2)**: the Results view gains the Share menu and delivery lines (deferred there to spec 6); `results.changed` also fires after deliveries. The recap reads `summary_status`/`retros.summary`, `ai_summary_enabled` and pending `suggested_actions` without changing them; ROTI and health are read without threshold.
- **Action items v2 (spec 3)**: `PresentActionItem` gains `externalLinks`; the `action_item_external_links` table is the one announced in its §9; action items stay named on anonymous retros, and the recap and export use that.
- **Planning poker (spec 4)**: the reserved `external_*` columns are written by import (still never client-writable); imported tasks' title/description become read-only; the task payload `external` object is extended (§6.6); "Add and edit tasks" gains the import/refresh paths.
- **MCP (spec 5)**: `poker.sources.list`, `poker.iterations.list`, `poker.game.tasks.import` and `poker.game.task.sync` call this spec's services (§9.1); `poker.game.tasks.list` exposes the §6.6 fields (`external.key`, `syncState`). Slack, Telegram, email and export have no MCP tool.
- **Games (spec 7)**: no change; nothing is built for rooms here (a later change can reuse the link share of §5.1 and `DeliverToSlack` / `DeliverToTelegram`).

## 15. Testing

Pest feature tests in `tests/Feature/Integrations/`, provider APIs faked with `Http::fake()` (with `Http::preventStrayRequests()`), `Queue::fake()`, `Notification::fake()`, `Event::fake()`; unit tests for pure classes.

- **Availability**: with no env, every integration route 404s, the team page has no link, snapshots carry all-false/`null` integration fields; each provider appears exactly when its env is complete; email hidden with `log`/`array` mailers.
- **Permissions**: Owner/Admin manage; Member 403 on the integrations page and every management endpoint; share endpoints allow facilitator (member) and Owner/Admin, refuse other members and guests; import allowed for non-guest players, 403 for guests; export follows `canEdit`, 403 for guests.
- **OAuth**: state mismatch, expiry, reuse and provider `error` refused; callback re-checks permission; Slack webhook URL not on `hooks.slack.com` refused; Jira multi-site → `SetupRequired` then `Active`; upgrade keeps the row; token refresh rotates and persists the new refresh token; `invalid_grant` → `ReconnectRequired`; concurrent refresh uses the lock (second caller reads the refreshed token).
- **Telegram**: code format, expiry, single use, new code invalidates old; `/connect@bot CODE` and `/connect CODE` in group and channel posts connect; invalid code reply; 5-attempt lockout; supergroup migration; bot kicked → `ReconnectRequired`; non-command text not stored; offset advances; 409 handled.
- **Recap content**: built from a completed retro with fixtures — contains title, counts, ROTI average with a single rating (no threshold, no distribution), stored summary when `ready` (omitted when `pending`, `failed`, opted out or no provider; sharing never dispatches generation), up to 5 pending suggested actions, top card per column with totals, action items capped at 10 with assignee names; on an anonymous retro no participant name and no card author appears anywhere in the Slack JSON, Telegram text or email body while action item assignee names do appear; no creator names; no comments, themes or sentiment; no Writing content possible (endpoint 403/422 outside `Completed`); Slack escaping turns `<!channel>` and `<http://x|y>` into literal text; Telegram HTML escaping; length limits truncate lists.
- **Link share**: no board content; guest URL only with opt-in and only when guest access is enabled; retro `Completed` → 422 for link; ended poker game → 403.
- **Email**: audiences (participants with accounts vs team), guests and removed members excluded, recipient locale, 10-minute limit.
- **Delivery jobs**: success marks `sent` and broadcasts; 429 released with retry-after; 5xx retried; Slack 404/403/410 and Telegram 403 → `ReconnectRequired` without retry; final failure recorded; no credential or webhook URL in the serialized job, delivery row or logs.
- **Import**: Jira sprint and JQL, Linear cycle and search mapped to tasks; ADF conversion cases (marks, lists, code, mention, media, table); descriptions rendered safely (`<script>`, remote image); duplicates skipped; 200 limit atomic; client-sent titles ignored; 100 cap and `truncated`; JQL 400 surfaced as 422.
- **Refresh**: updates fields, marks missing issues, keeps local estimate; edits of managed tasks → 422.
- **MCP services**: `ListPokerSources`, `ListPokerIterations`, `ImportPokerTasks` and the sync dispatch return the same results and refuse the same callers (guests, players who cannot add tasks, non-facilitator for sync) as the HTTP endpoints; `poker.game.task.sync` forces a rewrite when `needs_sync` is false, retries when true, and refuses a task without estimate or `unsupported` (422); sources list carries no credentials.
- **Write-back**: dispatched only for imported tasks with write access and matching site; unsupported for T-shirt/non-numeric decks; Jira editmeta fallback to the second candidate, no field → failure; `½` → 0.5 for Jira, refused for Linear; Linear `notUsed`, zero rule, > 64 refused, API rejection surfaced; clearing writes `null`; uniqueness coalesces; retry endpoint facilitator-only and also forces a rewrite when `needs_sync` is false; payload never contains votes.
- **Export**: Jira ADF and Linear Markdown bodies contain content, retro title, date, deep link, due date, Linear priority, and never the creator; double submit → one issue (409 on the second); failure rolls back the link; read-only → 409; target defaults saved.
- **Health check command**: status transitions for auth errors, unchanged on 5xx.
- **Secrets**: `credentials` absent from every page prop and JSON response; stored ciphertext differs from plaintext; APP_KEY mismatch → `ReconnectRequired`.
- **Translations**: `TranslationKeysTest` passes.
- **Manual walkthrough** (real Slack workspace, Telegram group, Jira Cloud and Linear test workspaces): connect each; post a link and a recap from an anonymous and a named retro and check the channel output; email results to participants; import a sprint and a cycle, estimate, see the value in Jira/Linear; T-shirt game shows "not synced"; export an action item to each; revoke Slack from Slack's app page and see "Reconnect required" after the next share; disconnect all.

Type-check and lint stay green; no frontend test runner is added.

## 16. Acceptance criteria

1. Each integration (Slack, Telegram, Jira, Linear, email) is reachable only when its env configuration is complete; with none configured the application behaves exactly as before.
2. Only workspace Owners/Admins can connect, configure, test and disconnect a team's integrations; one connection per provider per team; credentials are encrypted at rest and never serialized, logged or sent to the browser.
3. Slack connects through OAuth to one channel chosen on Slack's consent screen; Telegram connects a chat through a 15-minute single-use `/connect` code; Jira and Linear connect through OAuth with read or read-and-write access, upgradable without losing references.
4. Losing access (revoked token, removed bot, archived channel, failed refresh) puts the integration in "Reconnect required", visible on the integrations page, and stops further calls.
5. The facilitator or an Owner/Admin can post a board or poker link (guest link only on opt-in) and, for completed retros, a results recap with participants (names unless the retro is anonymous), card count, ROTI average (no threshold), the summary when ready, action items with assignee names, pending suggested actions and top card per column; recaps never contain Writing-phase content, card author names, participant names on anonymous retros, voter identity or comments.
6. "Send to email" delivers the results to participants with accounts or all team members, in each recipient's locale, never to guests.
7. Poker players who can add tasks import Jira issues by sprint or JQL and Linear issues by cycle or search, with title, description, assignee and source estimate; duplicates are skipped and the 200-task limit holds; imported tasks are refreshed from the source.
8. A saved estimate on an imported task is written back automatically when access allows: Jira through the detected story-points field, Linear within its scale (whole numbers 0–64, zero rule); T-shirt and non-numeric decks never sync; failures are shown with a retry, which can also force a rewrite.
9. Action items can be exported once per provider as a Jira or Linear issue by team members who can edit them, with a link back to the item; no creator or comment leaves the instance.
10. All outbound calls are made by the server; deliveries and write-backs run as queued jobs with the retry rules of §12.
11. The poker MCP tools `poker.sources.list`, `poker.iterations.list`, `poker.game.tasks.import` and `poker.game.task.sync` are served by the same services and permission checks as the interface.
12. All new strings are translated in en/fr/es/de; suite, phpstan, type-check and lint are green; no new dependency; the walkthrough passes.

## Decisions (2026-09-30)

1. **Who manages integrations:** workspace Owners/Admins.
2. **Slack mechanism:** incoming webhook (`incoming-webhook` scope); reconnect to change channel.
3. **Telegram updates:** long polling from the scheduler.
4. **Estimate write-back:** automatic when the facilitator saves the estimate, with pending/failed state and retry.
5. **Imported task editing:** title and description read-only, refreshed from the source on demand.
6. **Action item export:** one-shot per provider with the link stored, no status sync.
7. **Who may share and email results:** the retro's facilitator (team member) and workspace Owners/Admins.
8. **Participant names in the recap:** names unless the retro is anonymous, count only on anonymous retros.
