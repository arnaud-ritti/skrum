# Plan 14a — Integrations extended: foundation, schema and chat channels (Microsoft Teams, Mattermost) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every env value, enum case, capability, column and table of spec 8 exists; `InboundReachability` tells whether `APP_URL` can receive provider webhooks; and workspace Owners/Admins can connect a team to a Microsoft Teams channel (Workflows webhook) and a Mattermost channel (incoming webhook), test and disconnect them, while retro/poker sharers and game room managers post board links, game room invites and results recaps there with spec 6's content rules — with nothing visible for Jira Data Center, GitHub and generic webhooks until Plans 14b–14c ship them.

**Architecture:** `IntegrationProvider` gains five cases, `kind(): IntegrationKind`, `capabilities(): array<IntegrationCapability>`, `isConfigured()` (env complete) and `authMethods()` (Jira DC); `isEnabled()` = configured **and** not in the private `Unreleased` list (Jira DC, GitHub, Webhook), so their env can be documented now without exposing half-built cards. One up-only migration adds every column and table of spec §3; new enums cast them. Teams and Mattermost are "URL channels": `ConnectUrlChannel` validates a pasted URL with `MicrosoftTeamsWebhookUrl` / `MattermostWebhookUrl`, stores it encrypted in `credentials.url` through `SaveTeamIntegration`, and exposes only `settings.host` / `settings.channelLabel`. `MicrosoftTeamsClient` and `MattermostClient` re-validate the stored URL before every post, never follow redirects and map lost URLs to `ReconnectRequired`. `ShareContent` gains `toMicrosoftTeams(): array` (Adaptive Card 1.4 envelope built by `MicrosoftTeamsText`) and `toMattermost(): string` (Markdown built by `MattermostText`); both escape through `MarkdownText` and `RetroRecapContent` shrinks lists, then the summary, then names to fit 28 000 bytes / 16 000 characters. `QueueShare` dispatches `DeliverToMicrosoftTeams` / `DeliverToMattermost` (subclasses of `DeliverToChannel`), and `ShareOptions` returns five channel booleans everywhere a snapshot carries share availability. The frontend adds one `UrlChannelIntegration` card and turns every share menu into a loop over `ShareChannels`.

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL, Pest, Laravel HTTP client (`Http::`), Inertia v3 + React 19, Wayfinder, Tailwind 4, lucide (all installed).

**Spec:** `docs/superpowers/specs/2026-09-30-integrations-extended-design.md` — §2.1 (all env and config keys), §2.2 (capabilities), §2.3 (`InboundReachability::isPublic()` only; inbound mode selection is Plan 14d), §3 (every column and table), §4.3, §4.4, §4.6 for `msteams` and `mattermost`, §6 rows "Connect, configure, test, disconnect … Teams, Mattermost" and "Share to Teams, Mattermost …", §7 rows `POST {msteams|mattermost}`, `PATCH {integration}` (`url`, `channelLabel`), share endpoints and "Payload and snapshot additions" (the three share booleans), §8.1 Teams/Mattermost rows, §8.3 secrets, §9 Integrations page cards for Teams and Mattermost and Share menus, §10 rows `DeliverToMicrosoftTeams`, `DeliverToMattermost`, `model:prune (IntegrationInboundEvent)`, §11 invalid Teams/Mattermost URL, §13 bullets Availability, Game room invites (Teams/Mattermost), Teams / Mattermost (URL validation, escaping, truncation), Secrets, Translations, §14 criteria 1 (availability part), 3 (Teams/Mattermost part), 9 and 10. Later plans: **14b** generic webhooks (§4.5, §4.7), **14c** Jira Data Center, GitHub and MCP (§4.1, §4.2, §7.1), **14d** two-way status sync (§5). Parent: `docs/superpowers/specs/2026-09-29-integrations-design.md` (spec 6).

## Global Constraints

- Work on branch `feat/plan-14-integrations-extended`, created from the current `main` (plans 12 and 13 are merged there). Plans 14b–14d continue on the same branch.
- Shells: prefix commands with `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH";`. Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host.
- Tests run on PostgreSQL (the Sail `testing` database). Every table uses a UUID primary key (`tests/Feature/UuidPrimaryKeysTest.php` stays green). Migration filenames use the prefix `2026_10_07_1000xx`; only `up()` methods.
- **No new Composer or npm dependency.** Every provider call goes through `App\Support\Integrations\ProviderHttp`. Teams and Mattermost calls use `->withoutRedirecting()`.
- Every integration test file starts with `Http::preventStrayRequests()` (in `beforeEach`) and fakes each provider call explicitly.
- **Secrets:** a Teams workflow URL and a Mattermost webhook URL are secrets (they embed the key). They live only in `credentials.url` (encrypted, hidden), are read only through `TeamIntegration::credential()` inside the clients at send time, and never reach presenters, page props, JSON responses, job payloads, logs, `last_error` or delivery errors (`IntegrationErrors::sanitize()` strips them). Job payloads carry the delivery id, the pre-built message and the locale only.
- **Authorize before validating:** every new or changed endpoint calls `Gate::authorize()` / `SharePermissions::ensure…()` / `GameRoomShares::ensure()` first, so guests and non-managers get 403 whatever the body.
- **Request fields are snake_case** (`url`, `channel_label`, `channel`, `include_guest_link`); responses, snapshots and page props are camelCase.
- Throttles use a named key: `throttle:10,1,integrationUrls` (new), existing `throttle:5,1,shares` untouched.
- A missing or lost connection answers **409** from `QueueShare` ("Connect :provider in the team settings." / "Reconnect :provider in the team settings."); 422 is only for `include_guest_link` refused (guest access off / team room).
- Route names follow `routes/web.php` (dotted, camelCase segments). New: `teams.integrations.urls.store`.
- Every user-facing string via `t()` / `__()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"), appended at the end of each file before the closing `}`, keeping every existing value. Each task lists its own rows; add only keys that are missing at execution time. Provider names (Slack, Telegram, Jira, Linear, Jira Data Center, GitHub, Microsoft Teams, Mattermost) are never translated; "Webhook" is. `tests/Feature/TranslationKeysTest.php` stays green.
- Wayfinder: run `vendor/bin/sail artisan wayfinder:generate --with-form` after every route change (stale output gives a false TS2345 in `manage-passkeys.tsx`). `resources/js/actions` and `resources/js/routes` are gitignored — never stage them.
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp check --fix <paths>`. Busy flags reset in `finally`.
- React: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `retroRequest()` from `@/lib/retro/api` for JSON calls, `toast` from `sonner`, generated Wayfinder controllers (no hard-coded URLs).
- PHP: constructor promotion, typed everything, array-shape docblocks on presenter return values, early returns, curly braces, no comments restating code, class constants in PascalCase. Pest helper functions are global: every new helper name below is unique in `tests/` (checked: `chatRecap`, `teamsIntegration`, `mattermostIntegration`, `urlChannelAdmin`, `chatConnectedRetro`, `chatConnectedPokerGame`, `chatConnectedGameRoom`, `runChatDeliveryJob`, `chatDelivery`, `fakePublicResolver` do not exist yet).
- Stage explicit paths only — never `git add -A` / `git add .`; never stage `.junie/mcp/mcp.json`, `resources/js/actions`, `resources/js/routes` or anything under `.superpowers/`. Do not push.
- Commit messages: Conventional Commits, ending with the attribution of the model that actually writes the commit, then the session line:
  `Co-Authored-By: <model name> <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Spec amendments made with this plan

Plan writing found these gaps; the spec is updated to match (§2.1, §3, §4.3, §4.4, §7, §9, §10) in Task 10:

1. **Request fields are snake_case**: `POST {msteams|mattermost}` and `PATCH {integration}` take `url` and `channel_label` (§7 wrote `channelLabel`, as spec 6 wrote `cloudId` for what shipped as `cloud_id`).
2. **Staged availability** (transitional, no behaviour change at the end of Plan 14d): `IntegrationProvider::isConfigured()` reports a complete env; `isEnabled()` additionally excludes the private `Unreleased` list (`JiraDataCenter`, `GitHub`, `Webhook`). Plan 14b removes `Webhook`, Plan 14c removes `JiraDataCenter` and `GitHub`; the list is deleted when it is empty.
3. **Mattermost settings gain `host`** (the configured server's host), so the card can show "host and channelLabel" as §7/§9 require; §3 listed `{channelLabel}` only.
4. **Ordered-list escape** is written `1\.` (backslash before the dot): CommonMark ignores a backslash before a digit, so "before a leading `1.`" in §4.3/§4.4 is implemented as escaping the dot. A leading `-` or `+` gets a backslash before it.
5. **Mattermost reconnect message** "The Mattermost webhook no longer works. Paste a new one." (§4.4 named none).
6. **Daily check for Teams and Mattermost** (`skrum:check-integrations`) re-validates the stored URL against the current env (host allowlist, `MATTERMOST_URL`) without posting; a URL that no longer passes becomes `ReconnectRequired`.
7. **Redirects are not followed** for Teams and Mattermost either (a 3xx fails the delivery without retry), as §4.5 states for generic webhooks.
8. **Teams list rendering:** each recap list line is its own `TextBlock` prefixed with "• " (Teams renders Markdown lists inconsistently); the 28 KB limit is measured as 28 000 bytes of the JSON body.
9. **`MATTERMOST_URL`** must be an `http(s)` URL without query, fragment or user info (an optional context path is allowed, as for `JIRA_DC_BASE_URL`); otherwise Mattermost stays disabled.
10. **Integrations page prop** `mattermost: {url} | null` (the configured server URL, not a secret) so the card can say which webhooks it accepts.
11. **Poll interval clamp** lives in `InboundReachability::pollIntervalMinutes()` (reads `services.integrations.poll_minutes`, clamps 1–60) instead of the config file.

## Review Focus

1. **Stored webhook URLs never leak** — not in page props, JSON responses, job payloads, `last_error`, delivery errors or exception messages (a connection error quoting the URL is sanitized to host only). Pinned in Task 5 ("never exposes webhook keys in errors") and Task 6 ("never serializes the stored URL").
2. **User text cannot mention, link or format** in either channel: `@channel`, `@here`, `~town-square`, `[x](http://evil)`, `*bold*`, a leading `-`/`+`/`1.` in titles, action items, cards or room names. Pinned in Task 4 ("escapes Markdown and mentions for Mattermost", "escapes Adaptive Card Markdown") and Task 7 ("escapes the room name for Teams and Mattermost").
3. **URL rules on save and before each send**: Teams only `https`, port 443, no user info, `*.logic.azure.com` / `*.api.powerplatform.com` / `MSTEAMS_ALLOWED_HOSTS`; Mattermost only `{MATTERMOST_URL}/hooks/{26 alphanumerics}`; a stored URL that no longer passes (env changed) → `ReconnectRequired` with no request sent. Pinned in Task 5 ("accepts only Teams workflow URLs", "accepts only incoming webhooks of the configured Mattermost server", "refuses a stored URL the instance no longer allows without calling it").
4. **Share endpoint order and codes for the new channels**: 403 for guests and non-managers before validation, 404 while the provider is disabled, 409 when not connected or reconnect-required, 422 only for the guest link on a team room; nothing queued on refusal. Pinned in Task 7 ("answers 404, 409 and 422 for game room invites to :dataset", "refuses guests and non-managers before validating").
5. **Size limits keep the essentials**: Teams ≤ 28 000 bytes and Mattermost ≤ 16 000 characters, shortening action items and top cards first, then the summary, then participant names; the heading and the open-results action/link are always kept. Pinned in Task 4 ("keeps Teams cards within 28 000 bytes", "keeps Mattermost messages within 16 000 characters", "drops participant names last").

## File map

| Area | Files |
|---|---|
| Configuration | `config/services.php`, `.env.example`, `phpunit.xml`, `tests/Pest.php`; `app/Enums/{IntegrationProvider,IntegrationKind,IntegrationCapability}.php` |
| Reachability | `app/Support/Integrations/{InboundReachability,HostResolver,PublicAddress}.php` |
| Schema & models | `database/migrations/2026_10_07_100000_extend_integration_tables_for_sync_and_channels.php`; `app/Enums/{IntegrationInboundMode,IntegrationWebhookStatus,ExternalIssueState,ExternalStatusCategory,InboundEventStatus,IntegrationUserMatch,IntegrationDeliveryKind,IntegrationDeliveryChannel}.php`; `app/Models/{TeamIntegration,ActionItemExternalLink,PokerTask,IntegrationDelivery,IntegrationInboundEvent}.php`; `database/factories/{IntegrationInboundEventFactory,TeamIntegrationFactory}.php`; `routes/console.php` |
| Messages | `app/Support/Integrations/Messages/{MarkdownText,MicrosoftTeamsText,MattermostText,ShareContent,LinkShareContent,RetroRecapContent}.php` |
| Clients & rules | `app/Rules/{MicrosoftTeamsWebhookUrl,MattermostWebhookUrl}.php`; `app/Support/Integrations/MicrosoftTeams/MicrosoftTeamsClient.php`; `app/Support/Integrations/Mattermost/MattermostClient.php`; `app/Support/Integrations/IntegrationErrors.php` |
| Connections | `app/Actions/Integrations/{ConnectUrlChannel,UpdateTeamIntegration,PresentTeamIntegration,CheckIntegration,DisconnectIntegration}.php`; `app/Http/Controllers/Integrations/{IntegrationUrlsController,TeamIntegrationsController,IntegrationTestsController}.php`; `routes/web.php` |
| Sharing | `app/Actions/Integrations/{QueueShare,ShareOptions}.php`; `app/Actions/Games/GameRoomShares.php`; `app/Jobs/Integrations/{DeliverToMicrosoftTeams,DeliverToMattermost}.php` |
| Frontend | `resources/js/types/integrations.ts`; `resources/js/lib/integrations.ts`; `resources/js/pages/teams/integrations.tsx`; `resources/js/components/integrations/url-channel-integration.tsx`; `resources/js/components/integrations/share/post-link-section.tsx`; `resources/js/components/retro/{share-board-button,results/results-share-menu,results/recap-share-dialog}.tsx`; `resources/js/components/poker/game-menu.tsx`; `resources/js/components/games/room-invite-button.tsx` |
| Tests | `tests/Feature/Integrations/{IntegrationsExtendedAvailabilityTest,InboundReachabilityTest,IntegrationSyncSchemaTest,ChatMessageFormattingTest,ChatWebhookClientsTest,ConnectUrlChannelTest,ChatChannelSharesTest}.php`; updated: `tests/Feature/Integrations/ShareSnapshotTest.php`, `tests/Feature/Games/GameRoomSharesTest.php` |
| Translations | `lang/{en,fr,es,de}.json` (rows inside each task) |
| Spec | `docs/superpowers/specs/2026-09-30-integrations-extended-design.md` (Task 10, amendments above) |

## Contract for Plans 14b–14d

Plans 14b (generic webhooks and events), 14c (Jira Data Center, GitHub, MCP) and 14d (status sync) build on exactly these names; renaming any of them breaks them.

**Configuration (Task 1)** — keys under `config('services.…')`:
- `jira_dc.{base_url, client_id, client_secret, personal_tokens (bool, default true), redirect ({APP_URL}/integrations/jira-dc/callback)}`
- `github_app.{app_id, slug, client_id, client_secret, private_key (PEM with real newlines; '' when unset), private_key_path, webhook_secret, redirect ({APP_URL}/integrations/github/callback)}`
- `msteams.{enabled (bool), allowed_hosts (array<int, string>, lower-case)}`; `mattermost.url` (string, no trailing slash, '' when unset)
- `outgoing_webhooks.{enabled, allow_private_networks, allow_http}` (bools, default false)
- `integrations.{inbound_webhooks ('auto'|'on'|'off' raw string), poll_minutes (raw int)}`; `linear.webhook_secret`
- `phpunit.xml` blanks/false-s every new env variable.

**Enums (`app/Enums`)**
- `IntegrationProvider`: cases `Slack='slack'`, `Telegram='telegram'`, `Jira='jira'`, `Linear='linear'`, `JiraDataCenter='jira_dc'`, `GitHub='github'`, `MicrosoftTeams='msteams'`, `Mattermost='mattermost'`, `Webhook='webhook'` (this order; `enabled()` keeps it). Methods: `static enabled(): array<int, self>`, `static anyEnabled(): bool`, `label(): string` ('Jira Data Center', 'GitHub', 'Microsoft Teams', 'Mattermost', `__('Webhook')`), `isConfigured(): bool`, `isEnabled(): bool` (configured and not in `private const Unreleased = [self::JiraDataCenter, self::GitHub, self::Webhook]` — **14b removes `self::Webhook`, 14c removes the other two and deletes the constant and its check when empty**), `authMethods(): array<int, 'oauth'|'pat'>` (Jira DC only, else `[]`), `kind(): IntegrationKind`, `capabilities(): array<int, IntegrationCapability>`, `can(IntegrationCapability): bool`, `usesOAuth(): bool` (Slack, Jira, Linear, JiraDataCenter, GitHub — **14c may make Jira DC depend on `authMethods()`**), `isTracker(): bool` (= kind Tracker), `isChannel(): bool` (= kind Channel), `connectsWithUrl(): bool` (MicrosoftTeams, Mattermost, Webhook).
- `IntegrationKind`: `Channel='channel'`, `Tracker='tracker'`.
- `IntegrationCapability`: `ShareLink='share_link'`, `ShareRecap='share_recap'`, `PokerImport='poker_import'`, `EstimateWriteBack='estimate_write_back'`, `ActionItemExport='action_item_export'`, `AssigneeMapping='assignee_mapping'`, `PriorityMapping='priority_mapping'`, `StatusSync='status_sync'`, `AutomaticEvents='automatic_events'` (Webhook only).
- `IntegrationInboundMode`: `Webhook='webhook'`, `Polling='polling'`, `Off='off'`. `IntegrationWebhookStatus`: `Pending='pending'`, `Active='active'`, `Failing='failing'`. `ExternalIssueState`: `Open='open'`, `Done='done'`. `ExternalStatusCategory`: `Todo='todo'`, `InProgress='in_progress'`, `Done='done'`. `InboundEventStatus`: `Applied='applied'`, `Ignored='ignored'`, `Rejected='rejected'`, `Failed='failed'`.
- `IntegrationUserMatch` gains `Sso='sso'`. `IntegrationDeliveryKind` gains `Event='event'`. `IntegrationDeliveryChannel` gains `MicrosoftTeams='msteams'`, `Mattermost='mattermost'`, `Webhook='webhook'`; `provider()` maps them; `shareChannels()` returns `[Slack, Telegram, MicrosoftTeams, Mattermost, Webhook]` (Task 7).

**Tables and models (Task 3; later plans add no migration for these columns)**
- `team_integrations` new columns (not fillable — write with `forceFill`): `inbound_mode` (string 10, default `off`, cast `IntegrationInboundMode`, model default `off`), `webhook_status` (nullable, cast `IntegrationWebhookStatus`), `webhook_expires_at`, `last_inbound_at`, `last_polled_at`, `poll_cursor`, `last_delivery_succeeded_at` (nullable timestamps, `datetime`), `consecutive_failures` (unsigned int, default 0, `integer`, model default 0).
- `action_item_external_links` new columns (not fillable): `external_state` / `last_pushed_state` (cast `ExternalIssueState`), `external_status_name` (100), `sync_error` (500), `external_updated_at`, `local_state_changed_at`, `last_pushed_at`, `last_synced_at`, `missing_at` (`datetime`); index (`source`, `external_site`, `external_id`).
- `poker_tasks` new columns (not fillable): `external_status_name` (100), `external_status_category` (cast `ExternalStatusCategory`), `external_updated_at`, `external_missing_at` (`datetime`); index (`external_source`, `external_site`, `external_id`). `external_source` stays a plain string.
- `integration_deliveries` new columns (fillable): `team_integration_id` (nullable uuid, FK null on delete), `event` (nullable string 60), `attempts` (unsigned smallint, default 0, `integer`), `response_status` (nullable, `integer`), `last_attempt_at` (`datetime`); relation `IntegrationDelivery::integration(): BelongsTo<TeamIntegration>`.
- `integration_inbound_events`: `id`, `provider` (cast `IntegrationProvider`), `team_integration_id` (nullable, null on delete), `event_key` (191), `event_type` (100), `status` (cast `InboundEventStatus`), `detail` (nullable 500), `received_at` (`datetime`); unique (`provider`, `event_key`); index `received_at`; no `created_at`/`updated_at`. Model `IntegrationInboundEvent` (`HasUuids`, `Prunable` 7 days on `received_at`, fillable all columns but `id`, relation `integration()`), factory `IntegrationInboundEvent::factory()` (Jira, `jira:issue_updated`, `Applied`, `received_at = now()`). `routes/console.php` prunes it with `IntegrationDelivery`.
- Factory states `TeamIntegration::factory()->microsoftTeams()` (URL `TeamIntegrationFactory::MicrosoftTeamsUrl` = `https://prod-12.westeurope.logic.azure.com:443/workflows/abc123/triggers/manual/paths/invoke?api-version=2016-06-01&sig=teams-signature`, settings `{host: prod-12.westeurope.logic.azure.com, channelLabel: '#retros'}`) and `->mattermost()` (URL `TeamIntegrationFactory::MattermostUrl` = `https://chat.example.com/hooks/abcdefghijklmnopqrstuvwxyz`, settings `{host: chat.example.com, channelLabel: 'town-square'}`). **14b adds `webhook()`, 14c adds `jiraDataCenter()` and `gitHub()`.**

**Support classes (`app/Support/Integrations`)**
- `HostResolver` (injectable, mockable): `addresses(string $host): array<int, string>` (A + AAAA, `[]` on failure). **14b's `Webhook\SafeWebhookUrl` resolves through it.**
- `PublicAddress`: `static isPublic(string $address): bool` (spec §4.5 ranges), `static inRange(string $address, string $cidr): bool`. **14b uses both** (and bypasses them when `allow_private_networks`).
- `InboundReachability` (injectable): `isPublic(): bool` (cached 1 h per `APP_URL`), `static mode(): string` (`'auto'|'on'|'off'`), `static pollIntervalMinutes(): int` (1–60). **14d decides `inbound_mode` with it.**
- `IntegrationErrors::sanitize()` also strips Teams workflow paths (host kept) and `/hooks/{key}` paths.
- `Messages\MarkdownText::escape(string $text, string $specials): string`; `Messages\MicrosoftTeamsText` (`PayloadLimitBytes = 28000`, `escape()`, `block(string $text, array $options = []): array` — escapes, `wrap: true` —, `openUrl(string $title, string $url): array`, `message(array $body, ?array $action = null): array`, `fits(array $message): bool`); `Messages\MattermostText` (`MessageLimit = 16000`, `escape()` — Markdown specials + zero-width space after `@` and `~` —, `link(string $label, string $url): string`).
- `Messages\ShareContent` interface: `toSlack(): array`, `toTelegram(): string`, `toMicrosoftTeams(): array`, `toMattermost(): string`. **14b adds `toWebhook(): array` (the `data` object) and implements it on `LinkShareContent` and `RetroRecapContent`.** `RetroRecapContent` has a private `firstFitting(Closure $build, Closure $fits)` over the shared shrink order (lists → summary 1000 → no names → summary 200).
- Clients: `MicrosoftTeams\MicrosoftTeamsClient::postMessage(TeamIntegration, array $message): void`, `::ensureUsableUrl(TeamIntegration): void`; `Mattermost\MattermostClient::postMessage(TeamIntegration, string $text): void`, `::ensureUsableUrl(TeamIntegration): void`. Both inside `withReconnectHandling`.
- Rules (`app/Rules`): `MicrosoftTeamsWebhookUrl` and `MattermostWebhookUrl` (`ValidationRule`, `static isValid(mixed $url): bool`; Mattermost also `static serverUrl(): string`).

**Actions & HTTP**
- `ConnectUrlChannel`: `rules(IntegrationProvider $provider, bool $isUpdate = false): array` (`url` required string ≤ 2048 + the provider's rule; `channel_label` sometimes nullable string ≤ 80), `handle(Team, IntegrationProvider, User, string $url, ?string $channelLabel): TeamIntegration` (creates or replaces through `SaveTeamIntegration`: `Active`, `Write`, `credentials = {url}`, `settings = {host, channelLabel}`, `scopes = []`), `update(TeamIntegration, User, array $validated): TeamIntegration`. Its private `urlRule()` `match` ends with a `default` that throws — **14b adds the `Webhook` arm (`SafeWebhookUrl`) and its own settings/secret handling (a `Webhook` branch in `handle()` or a dedicated action)**.
- Route `POST w/{workspace}/teams/{team}/integrations/{provider}` → `IntegrationUrlsController@store`, `whereIn('provider', ['msteams', 'mattermost'])`, `throttle:10,1,integrationUrls`, name `teams.integrations.urls.store`, 201 with `PresentTeamIntegration`. **14b adds `'webhook'` to the `whereIn` and returns `{…integration, secret}` for it.**
- `UpdateTeamIntegration::rules()`/`handle()` branch for `MicrosoftTeams`/`Mattermost` via `ConnectUrlChannel` (explicit provider list, not `connectsWithUrl()`). **14b adds the `Webhook` rules (`events`, `enabled`, `url`, `channel_label`), 14d adds `status_sync`, `treat_canceled_as_done`, `status_mapping`, 14c adds `priority_labels`.**
- `PresentTeamIntegration::SettingKeys` has keys for all nine providers (`jira_dc`, `github`, `webhook` empty lists — **14b/14c fill them**). **14d adds `inboundMode`, `webhookStatus`, `lastInboundAt`, `lastPolledAt`, `statusSync` to the presenter output.**
- `CheckIntegration`, `IntegrationTestsController`: arms for `JiraDataCenter`, `GitHub`, `Webhook` throw `NotConnected` (unreachable while unreleased) — **14b/14c replace their arm**. `DisconnectIntegration`: those three (and Teams/Mattermost) only delete the row.
- `QueueShare::handle()` `match` has arms for Slack, Telegram, MicrosoftTeams, Mattermost and a throwing `default` — **14b adds `Webhook => new DeliverToWebhook(…)`**. Jobs `DeliverToMicrosoftTeams(string $deliveryId, array $message, string $locale)` and `DeliverToMattermost(string $deliveryId, string $text, string $locale)` extend `DeliverToChannel`.
- `ShareOptions::NoChannels` (public) and `channels(Team)` return `array{slack, telegram, msteams, mattermost, webhook}` (bools); `retro()` adds `email`. `GameRoomShares` reuses `ShareOptions::NoChannels`. Webhook is already listed: it turns true once 14b enables the provider.
- `TeamIntegrationsController@index` props add `mattermost: {url: string} | null`.

**Frontend**
- Types (`resources/js/types/integrations.ts`): `IntegrationProviderKey` = the nine values; `IntegrationSettings` gains `host?: string`, `channelLabel?: string | null`; `MattermostServerInfo = {url: string}`; `ShareChannel = 'slack' | 'telegram' | 'msteams' | 'mattermost' | 'webhook'`; `ShareAvailability = Record<ShareChannel, boolean>`.
- `resources/js/lib/integrations.ts`: `ShareChannels` (five, in that order), `hasShareChannel(availability)`, `deliveryChannelLabel(channel, t)`, `postLinkLabel(channel, t)`, `shareResultsLabel(channel, t)`, `recapDialogTitle(channel, t)` — all exhaustive over `ShareChannel`, so 14b only adds backend.
- `UrlChannelIntegration` (`resources/js/components/integrations/url-channel-integration.tsx`, props `card`, `scope`, `mattermost`) renders the Teams and Mattermost cards. **14b builds a separate `WebhookIntegration` card and adds a `case 'webhook'` to `pages/teams/integrations.tsx`.**

**Pest helpers (`tests/Pest.php`)**: `disableIntegrations()` also clears every new provider; `enableIntegrations(IntegrationProvider ...$providers)` handles all nine (Teams `msteams.enabled = true`; Mattermost `mattermost.url = https://chat.example.com`; Jira DC `https://jira.example.com` + `jira-dc-client`/`jira-dc-secret` + personal tokens on; GitHub app `12345`, slug `skrum-test`, `github-client`/`github-secret`, key `test-private-key`; Webhook `outgoing_webhooks.enabled = true`). Enabling an unreleased provider sets its config but `isEnabled()` stays false until its plan removes it from `Unreleased`.

---
### Task 1: Configuration, provider kinds and capabilities

**Files:**
- Create: `app/Enums/IntegrationKind.php`, `app/Enums/IntegrationCapability.php`
- Modify: `app/Enums/IntegrationProvider.php`, `config/services.php`, `.env.example`, `phpunit.xml`, `tests/Pest.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/IntegrationsExtendedAvailabilityTest.php`

**Interfaces:**
- Consumes: the existing `IntegrationProvider` (four cases, `requiredConfigKeys()`), `config/services.php` blocks `slack`, `telegram`, `jira`, `linear`; Pest helpers `disableIntegrations()`, `enableIntegrations()`.
- Produces: the configuration keys, enum cases and methods of the Contract ("Configuration", "Enums"); updated Pest helpers.

- [ ] **Step 1: Create the branch**

```bash
git switch main
git switch -c feat/plan-14-integrations-extended
```

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Integrations/IntegrationsExtendedAvailabilityTest.php`:

```php
<?php

use App\Enums\IntegrationCapability;
use App\Enums\IntegrationKind;
use App\Enums\IntegrationProvider;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('behaves as spec 6 while no new variable is set', function () {
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Linear);

    expect(IntegrationProvider::enabled())->toBe([IntegrationProvider::Slack, IntegrationProvider::Linear]);
});

it('enables Microsoft Teams and Mattermost from their env', function () {
    disableIntegrations();

    expect(IntegrationProvider::MicrosoftTeams->isEnabled())->toBeFalse()
        ->and(IntegrationProvider::Mattermost->isEnabled())->toBeFalse();

    config(['services.msteams.enabled' => true, 'services.mattermost.url' => 'https://chat.example.com']);

    expect(IntegrationProvider::enabled())->toBe([IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost]);
});

it('accepts only an http(s) Mattermost server URL', function (string $url, bool $enabled) {
    disableIntegrations();
    config(['services.mattermost.url' => $url]);

    expect(IntegrationProvider::Mattermost->isEnabled())->toBe($enabled);
})->with([
    'https' => ['https://chat.example.com', true],
    'context path' => ['https://example.com/mattermost', true],
    'http with port' => ['http://mattermost.internal:8065', true],
    'ftp' => ['ftp://chat.example.com', false],
    'query' => ['https://chat.example.com?team=a', false],
    'user info' => ['https://user:secret@chat.example.com', false],
    'two path segments' => ['https://example.com/a/b', false],
]);

it('keeps Jira Data Center, GitHub and webhooks hidden until their plans ship', function () {
    disableIntegrations();
    enableIntegrations(IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub, IntegrationProvider::Webhook);

    expect(IntegrationProvider::JiraDataCenter->isConfigured())->toBeTrue()
        ->and(IntegrationProvider::GitHub->isConfigured())->toBeTrue()
        ->and(IntegrationProvider::Webhook->isConfigured())->toBeTrue()
        ->and(IntegrationProvider::JiraDataCenter->isEnabled())->toBeFalse()
        ->and(IntegrationProvider::GitHub->isEnabled())->toBeFalse()
        ->and(IntegrationProvider::Webhook->isEnabled())->toBeFalse()
        ->and(IntegrationProvider::anyEnabled())->toBeFalse();
});

it('detects a complete Jira Data Center configuration', function (array $config, bool $configured, array $methods) {
    disableIntegrations();
    config($config);

    expect(IntegrationProvider::JiraDataCenter->isConfigured())->toBe($configured)
        ->and(IntegrationProvider::JiraDataCenter->authMethods())->toBe($methods);
})->with([
    'oauth and tokens' => [['services.jira_dc.base_url' => 'https://jira.example.com', 'services.jira_dc.client_id' => 'id', 'services.jira_dc.client_secret' => 'secret', 'services.jira_dc.personal_tokens' => true], true, ['oauth', 'pat']],
    'oauth only' => [['services.jira_dc.base_url' => 'https://jira.example.com/jira', 'services.jira_dc.client_id' => 'id', 'services.jira_dc.client_secret' => 'secret', 'services.jira_dc.personal_tokens' => false], true, ['oauth']],
    'tokens only' => [['services.jira_dc.base_url' => 'http://jira.internal:8080', 'services.jira_dc.personal_tokens' => true], true, ['pat']],
    'no method' => [['services.jira_dc.base_url' => 'https://jira.example.com', 'services.jira_dc.client_id' => 'id', 'services.jira_dc.personal_tokens' => false], false, []],
    'no base URL' => [['services.jira_dc.client_id' => 'id', 'services.jira_dc.client_secret' => 'secret', 'services.jira_dc.personal_tokens' => true], false, ['oauth', 'pat']],
    'deep path' => [['services.jira_dc.base_url' => 'https://example.com/a/jira', 'services.jira_dc.personal_tokens' => true], false, ['pat']],
    'query string' => [['services.jira_dc.base_url' => 'https://jira.example.com?x=1', 'services.jira_dc.personal_tokens' => true], false, ['pat']],
]);

it('detects a complete GitHub App configuration', function () {
    disableIntegrations();
    config([
        'services.github_app.app_id' => '12345',
        'services.github_app.slug' => 'skrum-test',
        'services.github_app.client_id' => 'github-client',
        'services.github_app.client_secret' => 'github-secret',
    ]);

    expect(IntegrationProvider::GitHub->isConfigured())->toBeFalse();

    config(['services.github_app.private_key_path' => '/secrets/github.pem']);

    expect(IntegrationProvider::GitHub->isConfigured())->toBeTrue();

    config(['services.github_app.private_key_path' => null, 'services.github_app.private_key' => "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----"]);

    expect(IntegrationProvider::GitHub->isConfigured())->toBeTrue();

    config(['services.github_app.slug' => null]);

    expect(IntegrationProvider::GitHub->isConfigured())->toBeFalse();
});

it('describes the kind and capabilities of every provider', function () {
    $share = [IntegrationCapability::ShareLink, IntegrationCapability::ShareRecap];
    $tracker = [
        IntegrationCapability::PokerImport,
        IntegrationCapability::EstimateWriteBack,
        IntegrationCapability::ActionItemExport,
        IntegrationCapability::AssigneeMapping,
        IntegrationCapability::PriorityMapping,
        IntegrationCapability::StatusSync,
    ];

    foreach ([IntegrationProvider::Slack, IntegrationProvider::Telegram, IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost] as $channel) {
        expect($channel->kind())->toBe(IntegrationKind::Channel)
            ->and($channel->isChannel())->toBeTrue()
            ->and($channel->isTracker())->toBeFalse()
            ->and($channel->capabilities())->toBe($share);
    }

    foreach ([IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter, IntegrationProvider::Linear, IntegrationProvider::GitHub] as $trackerProvider) {
        expect($trackerProvider->kind())->toBe(IntegrationKind::Tracker)
            ->and($trackerProvider->isTracker())->toBeTrue()
            ->and($trackerProvider->capabilities())->toBe($tracker);
    }

    expect(IntegrationProvider::Webhook->kind())->toBe(IntegrationKind::Channel)
        ->and(IntegrationProvider::Webhook->capabilities())->toBe([...$share, IntegrationCapability::AutomaticEvents])
        ->and(IntegrationProvider::Webhook->can(IntegrationCapability::AutomaticEvents))->toBeTrue()
        ->and(IntegrationProvider::MicrosoftTeams->can(IntegrationCapability::AutomaticEvents))->toBeFalse();
});

it('names and classifies the new providers', function () {
    expect(IntegrationProvider::JiraDataCenter->label())->toBe('Jira Data Center')
        ->and(IntegrationProvider::GitHub->label())->toBe('GitHub')
        ->and(IntegrationProvider::MicrosoftTeams->label())->toBe('Microsoft Teams')
        ->and(IntegrationProvider::Mattermost->label())->toBe('Mattermost')
        ->and(IntegrationProvider::Webhook->label())->toBe('Webhook')
        ->and(IntegrationProvider::JiraDataCenter->usesOAuth())->toBeTrue()
        ->and(IntegrationProvider::GitHub->usesOAuth())->toBeTrue()
        ->and(IntegrationProvider::MicrosoftTeams->usesOAuth())->toBeFalse()
        ->and(IntegrationProvider::Mattermost->usesOAuth())->toBeFalse()
        ->and(IntegrationProvider::Webhook->usesOAuth())->toBeFalse()
        ->and(IntegrationProvider::MicrosoftTeams->connectsWithUrl())->toBeTrue()
        ->and(IntegrationProvider::Mattermost->connectsWithUrl())->toBeTrue()
        ->and(IntegrationProvider::Webhook->connectsWithUrl())->toBeTrue()
        ->and(IntegrationProvider::Slack->connectsWithUrl())->toBeFalse()
        ->and(IntegrationProvider::JiraDataCenter->authMethods())->toBeArray()
        ->and(IntegrationProvider::Slack->authMethods())->toBe([]);
});

it('uses fixed callback URLs for Jira Data Center and GitHub', function () {
    expect(config('services.jira_dc.redirect'))->toEndWith('/integrations/jira-dc/callback')
        ->and(config('services.github_app.redirect'))->toEndWith('/integrations/github/callback')
        ->and(config('services.github'))->toBeArray()
        ->and(config('services.msteams.allowed_hosts'))->toBe([])
        ->and(config('services.outgoing_webhooks.allow_private_networks'))->toBeFalse()
        ->and(config('services.outgoing_webhooks.allow_http'))->toBeFalse();
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationsExtendedAvailabilityTest.php`
Expected: FAIL — `Class "App\Enums\IntegrationCapability" not found`.

- [ ] **Step 4: Add the configuration**

In `config/services.php`, add `'webhook_secret' => env('LINEAR_WEBHOOK_SECRET'),` as the last key of the `'linear'` block, and insert after that block (before `'google'`):

```php
    'jira_dc' => [
        'base_url' => env('JIRA_DC_BASE_URL'),
        'client_id' => env('JIRA_DC_CLIENT_ID'),
        'client_secret' => env('JIRA_DC_CLIENT_SECRET'),
        'personal_tokens' => (bool) env('JIRA_DC_PERSONAL_TOKENS', true),
        'redirect' => rtrim((string) env('APP_URL', ''), '/').'/integrations/jira-dc/callback',
    ],

    'github_app' => [
        'app_id' => env('GITHUB_APP_ID'),
        'slug' => env('GITHUB_APP_SLUG'),
        'client_id' => env('GITHUB_APP_CLIENT_ID'),
        'client_secret' => env('GITHUB_APP_CLIENT_SECRET'),
        'private_key' => str_replace('\n', "\n", (string) env('GITHUB_APP_PRIVATE_KEY', '')),
        'private_key_path' => env('GITHUB_APP_PRIVATE_KEY_PATH'),
        'webhook_secret' => env('GITHUB_APP_WEBHOOK_SECRET'),
        'redirect' => rtrim((string) env('APP_URL', ''), '/').'/integrations/github/callback',
    ],

    'msteams' => [
        'enabled' => (bool) env('MSTEAMS_ENABLED', false),
        'allowed_hosts' => array_values(array_filter(array_map(
            fn (string $host): string => strtolower(trim($host)),
            explode(',', (string) env('MSTEAMS_ALLOWED_HOSTS', '')),
        ))),
    ],

    'mattermost' => [
        'url' => rtrim((string) env('MATTERMOST_URL', ''), '/'),
    ],

    'outgoing_webhooks' => [
        'enabled' => (bool) env('OUTGOING_WEBHOOKS_ENABLED', false),
        'allow_private_networks' => (bool) env('OUTGOING_WEBHOOKS_ALLOW_PRIVATE_NETWORKS', false),
        'allow_http' => (bool) env('OUTGOING_WEBHOOKS_ALLOW_HTTP', false),
    ],

    'integrations' => [
        'inbound_webhooks' => env('INTEGRATIONS_INBOUND_WEBHOOKS', 'auto'),
        'poll_minutes' => (int) env('INTEGRATIONS_POLL_MINUTES', 5),
    ],
```

In `.env.example`, insert after `LINEAR_CLIENT_SECRET=` (before `# Emailing retrospective results …`):

```
# Linear status sync webhooks (optional): the signing secret of a Linear webhook
# pointing to ${APP_URL}/integrations/linear/webhook.
LINEAR_WEBHOOK_SECRET=
# Jira Server / Data Center (8.14+): the server's base URL (optionally with its
# context path). OAuth 2.0 (8.22+, preferred): an incoming application link with
# the redirect URL ${APP_URL}/integrations/jira-dc/callback. Without OAuth values,
# Owners/Admins paste a personal access token (set JIRA_DC_PERSONAL_TOKENS=false
# to forbid tokens).
JIRA_DC_BASE_URL=
JIRA_DC_CLIENT_ID=
JIRA_DC_CLIENT_SECRET=
JIRA_DC_PERSONAL_TOKENS=true
# GitHub Issues: a GitHub App with the callback and setup URL
# ${APP_URL}/integrations/github/callback, repository permissions Issues (read and
# write) and Metadata (read), and the webhook URL ${APP_URL}/integrations/github/webhook
# with its secret. The private key is the PEM with "\n" for newlines, or a file path.
GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_PRIVATE_KEY_PATH=
GITHUB_APP_WEBHOOK_SECRET=
# Microsoft Teams: teams paste the URL of a Workflows webhook ("Post to a channel
# when a webhook request is received"). Hosts other than *.logic.azure.com and
# *.api.powerplatform.com must be listed (comma-separated).
MSTEAMS_ENABLED=false
MSTEAMS_ALLOWED_HOSTS=
# Mattermost: the one server teams may post to; they paste an incoming webhook
# of it (${MATTERMOST_URL}/hooks/…).
MATTERMOST_URL=
# Generic outgoing webhooks (signed JSON POSTs). Private networks and plain HTTP
# are refused unless allowed here.
OUTGOING_WEBHOOKS_ENABLED=false
OUTGOING_WEBHOOKS_ALLOW_PRIVATE_NETWORKS=false
OUTGOING_WEBHOOKS_ALLOW_HTTP=false
# Status sync: providers push changes to ${APP_URL}/integrations/{provider}/webhook
# when APP_URL is publicly reachable (auto), always (on) or never (off); otherwise
# skrum polls every INTEGRATIONS_POLL_MINUTES minutes (1–60).
INTEGRATIONS_INBOUND_WEBHOOKS=auto
INTEGRATIONS_POLL_MINUTES=5
```

In `phpunit.xml`, after `<env name="LINEAR_CLIENT_SECRET" value=""/>`, add so that a developer's `.env` never enables a new provider in tests:

```xml
        <env name="LINEAR_WEBHOOK_SECRET" value=""/>
        <env name="JIRA_DC_BASE_URL" value=""/>
        <env name="JIRA_DC_CLIENT_ID" value=""/>
        <env name="JIRA_DC_CLIENT_SECRET" value=""/>
        <env name="JIRA_DC_PERSONAL_TOKENS" value="true"/>
        <env name="GITHUB_APP_ID" value=""/>
        <env name="GITHUB_APP_SLUG" value=""/>
        <env name="GITHUB_APP_CLIENT_ID" value=""/>
        <env name="GITHUB_APP_CLIENT_SECRET" value=""/>
        <env name="GITHUB_APP_PRIVATE_KEY" value=""/>
        <env name="GITHUB_APP_PRIVATE_KEY_PATH" value=""/>
        <env name="GITHUB_APP_WEBHOOK_SECRET" value=""/>
        <env name="MSTEAMS_ENABLED" value="false"/>
        <env name="MSTEAMS_ALLOWED_HOSTS" value=""/>
        <env name="MATTERMOST_URL" value=""/>
        <env name="OUTGOING_WEBHOOKS_ENABLED" value="false"/>
        <env name="OUTGOING_WEBHOOKS_ALLOW_PRIVATE_NETWORKS" value="false"/>
        <env name="OUTGOING_WEBHOOKS_ALLOW_HTTP" value="false"/>
        <env name="INTEGRATIONS_INBOUND_WEBHOOKS" value="auto"/>
        <env name="INTEGRATIONS_POLL_MINUTES" value="5"/>
```

- [ ] **Step 5: Extend the Pest helpers**

In `tests/Pest.php`, replace `disableIntegrations()` and `enableIntegrations()` with:

```php
function disableIntegrations(): void
{
    config([
        'services.slack.client_id' => null,
        'services.slack.client_secret' => null,
        'services.telegram.bot_token' => null,
        'services.jira.client_id' => null,
        'services.jira.client_secret' => null,
        'services.linear.client_id' => null,
        'services.linear.client_secret' => null,
        'services.jira_dc.base_url' => null,
        'services.jira_dc.client_id' => null,
        'services.jira_dc.client_secret' => null,
        'services.jira_dc.personal_tokens' => true,
        'services.github_app.app_id' => null,
        'services.github_app.slug' => null,
        'services.github_app.client_id' => null,
        'services.github_app.client_secret' => null,
        'services.github_app.private_key' => '',
        'services.github_app.private_key_path' => null,
        'services.msteams.enabled' => false,
        'services.msteams.allowed_hosts' => [],
        'services.mattermost.url' => '',
        'services.outgoing_webhooks.enabled' => false,
    ]);
}

function enableIntegrations(IntegrationProvider ...$providers): void
{
    foreach ($providers as $provider) {
        config(match ($provider) {
            IntegrationProvider::Slack => ['services.slack.client_id' => 'slack-client', 'services.slack.client_secret' => 'slack-secret'],
            IntegrationProvider::Telegram => ['services.telegram.bot_token' => '123456:telegram-token'],
            IntegrationProvider::Jira => ['services.jira.client_id' => 'jira-client', 'services.jira.client_secret' => 'jira-secret'],
            IntegrationProvider::Linear => ['services.linear.client_id' => 'linear-client', 'services.linear.client_secret' => 'linear-secret'],
            IntegrationProvider::JiraDataCenter => [
                'services.jira_dc.base_url' => 'https://jira.example.com',
                'services.jira_dc.client_id' => 'jira-dc-client',
                'services.jira_dc.client_secret' => 'jira-dc-secret',
                'services.jira_dc.personal_tokens' => true,
            ],
            IntegrationProvider::GitHub => [
                'services.github_app.app_id' => '12345',
                'services.github_app.slug' => 'skrum-test',
                'services.github_app.client_id' => 'github-client',
                'services.github_app.client_secret' => 'github-secret',
                'services.github_app.private_key' => 'test-private-key',
            ],
            IntegrationProvider::MicrosoftTeams => ['services.msteams.enabled' => true],
            IntegrationProvider::Mattermost => ['services.mattermost.url' => 'https://chat.example.com'],
            IntegrationProvider::Webhook => ['services.outgoing_webhooks.enabled' => true],
        });
    }
}
```

- [ ] **Step 6: Implement the enums**

Create `app/Enums/IntegrationKind.php`:

```php
<?php

namespace App\Enums;

enum IntegrationKind: string
{
    case Channel = 'channel';
    case Tracker = 'tracker';
}
```

Create `app/Enums/IntegrationCapability.php`:

```php
<?php

namespace App\Enums;

enum IntegrationCapability: string
{
    case ShareLink = 'share_link';
    case ShareRecap = 'share_recap';
    case PokerImport = 'poker_import';
    case EstimateWriteBack = 'estimate_write_back';
    case ActionItemExport = 'action_item_export';
    case AssigneeMapping = 'assignee_mapping';
    case PriorityMapping = 'priority_mapping';
    case StatusSync = 'status_sync';
    case AutomaticEvents = 'automatic_events';
}
```

Replace `app/Enums/IntegrationProvider.php` with:

```php
<?php

namespace App\Enums;

enum IntegrationProvider: string
{
    case Slack = 'slack';
    case Telegram = 'telegram';
    case Jira = 'jira';
    case Linear = 'linear';
    case JiraDataCenter = 'jira_dc';
    case GitHub = 'github';
    case MicrosoftTeams = 'msteams';
    case Mattermost = 'mattermost';
    case Webhook = 'webhook';

    /**
     * Configured providers whose connection flow ships in a later plan stay
     * disabled, so an early env value cannot expose a half-built card.
     */
    private const Unreleased = [self::JiraDataCenter, self::GitHub, self::Webhook];

    private const ServerPathPattern = '#^(/[A-Za-z0-9._~-]+)?/?$#';

    /**
     * @return array<int, self>
     */
    public static function enabled(): array
    {
        return array_values(array_filter(self::cases(), fn (self $provider): bool => $provider->isEnabled()));
    }

    public static function anyEnabled(): bool
    {
        return self::enabled() !== [];
    }

    public function label(): string
    {
        return match ($this) {
            self::Slack => 'Slack',
            self::Telegram => 'Telegram',
            self::Jira => 'Jira',
            self::Linear => 'Linear',
            self::JiraDataCenter => 'Jira Data Center',
            self::GitHub => 'GitHub',
            self::MicrosoftTeams => 'Microsoft Teams',
            self::Mattermost => 'Mattermost',
            self::Webhook => __('Webhook'),
        };
    }

    public function isEnabled(): bool
    {
        return $this->isConfigured() && ! in_array($this, self::Unreleased, true);
    }

    public function isConfigured(): bool
    {
        return match ($this) {
            self::Slack => self::hasConfig(['services.slack.client_id', 'services.slack.client_secret']),
            self::Telegram => self::hasConfig(['services.telegram.bot_token']),
            self::Jira => self::hasConfig(['services.jira.client_id', 'services.jira.client_secret']),
            self::Linear => self::hasConfig(['services.linear.client_id', 'services.linear.client_secret']),
            self::JiraDataCenter => self::isServerUrl(config('services.jira_dc.base_url')) && $this->authMethods() !== [],
            self::GitHub => self::hasConfig(['services.github_app.app_id', 'services.github_app.slug', 'services.github_app.client_id', 'services.github_app.client_secret'])
                && (filled(config('services.github_app.private_key')) || filled(config('services.github_app.private_key_path'))),
            self::MicrosoftTeams => config('services.msteams.enabled') === true,
            self::Mattermost => self::isServerUrl(config('services.mattermost.url')),
            self::Webhook => config('services.outgoing_webhooks.enabled') === true,
        };
    }

    /**
     * @return array<int, string>
     */
    public function authMethods(): array
    {
        if ($this !== self::JiraDataCenter) {
            return [];
        }

        $methods = [];

        if (self::hasConfig(['services.jira_dc.client_id', 'services.jira_dc.client_secret'])) {
            $methods[] = 'oauth';
        }

        if (config('services.jira_dc.personal_tokens') === true) {
            $methods[] = 'pat';
        }

        return $methods;
    }

    public function kind(): IntegrationKind
    {
        return match ($this) {
            self::Slack, self::Telegram, self::MicrosoftTeams, self::Mattermost, self::Webhook => IntegrationKind::Channel,
            self::Jira, self::JiraDataCenter, self::Linear, self::GitHub => IntegrationKind::Tracker,
        };
    }

    /**
     * @return array<int, IntegrationCapability>
     */
    public function capabilities(): array
    {
        $share = [IntegrationCapability::ShareLink, IntegrationCapability::ShareRecap];

        return match ($this) {
            self::Slack, self::Telegram, self::MicrosoftTeams, self::Mattermost => $share,
            self::Webhook => [...$share, IntegrationCapability::AutomaticEvents],
            self::Jira, self::JiraDataCenter, self::Linear, self::GitHub => [
                IntegrationCapability::PokerImport,
                IntegrationCapability::EstimateWriteBack,
                IntegrationCapability::ActionItemExport,
                IntegrationCapability::AssigneeMapping,
                IntegrationCapability::PriorityMapping,
                IntegrationCapability::StatusSync,
            ],
        };
    }

    public function can(IntegrationCapability $capability): bool
    {
        return in_array($capability, $this->capabilities(), true);
    }

    public function usesOAuth(): bool
    {
        return in_array($this, [self::Slack, self::Jira, self::Linear, self::JiraDataCenter, self::GitHub], true);
    }

    public function isTracker(): bool
    {
        return $this->kind() === IntegrationKind::Tracker;
    }

    public function isChannel(): bool
    {
        return $this->kind() === IntegrationKind::Channel;
    }

    public function connectsWithUrl(): bool
    {
        return in_array($this, [self::MicrosoftTeams, self::Mattermost, self::Webhook], true);
    }

    /**
     * @param  array<int, string>  $keys
     */
    private static function hasConfig(array $keys): bool
    {
        foreach ($keys as $key) {
            if (blank(config($key))) {
                return false;
            }
        }

        return true;
    }

    /**
     * An http(s) server address with at most one context path segment.
     */
    private static function isServerUrl(mixed $url): bool
    {
        if (! is_string($url) || filter_var($url, FILTER_VALIDATE_URL) === false) {
            return false;
        }

        $parts = parse_url($url);

        if (! is_array($parts) || ! in_array($parts['scheme'] ?? null, ['http', 'https'], true)) {
            return false;
        }

        if (isset($parts['user']) || isset($parts['query']) || isset($parts['fragment'])) {
            return false;
        }

        return preg_match(self::ServerPathPattern, $parts['path'] ?? '') === 1;
    }
}
```

- [ ] **Step 7: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Webhook` | `Webhook` | `Webhook` | `Webhook` |

- [ ] **Step 8: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationsExtendedAvailabilityTest.php tests/Feature/Integrations/IntegrationProviderTest.php tests/Feature/Integrations/IntegrationsPageTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

Then `vendor/bin/sail bin phpstan analyse --no-progress`. It reports every `match ($integration->provider)` without an arm for the five new cases (`CheckIntegration`, `DisconnectIntegration`, `IntegrationTestsController`) and the `PresentTeamIntegration::SettingKeys` lookups. Add the smallest arms now so phpstan is at 0 and nothing can throw `UnhandledMatchError` — Task 6 replaces the Teams/Mattermost ones:
- `CheckIntegration::handle()`: `IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub, IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost, IntegrationProvider::Webhook => throw new NotConnected($integration->provider),`
- `IntegrationTestsController::store()`: the same arm.
- `DisconnectIntegration::handle()`: replace `IntegrationProvider::Jira => fn () => null,` with `IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub, IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost, IntegrationProvider::Webhook => fn () => null,`
- `PresentTeamIntegration::SettingKeys`: append `'jira_dc' => []`, `'github' => []`, `'msteams' => ['host', 'channelLabel']`, `'mattermost' => ['host', 'channelLabel']`, `'webhook' => []`.

Add `use App\Support\Integrations\Exceptions\NotConnected;` where needed. Re-run phpstan: 0 errors. Run `vendor/bin/sail bin pint --dirty --format agent`.

- [ ] **Step 9: Commit**

```bash
git add app/Enums/IntegrationProvider.php app/Enums/IntegrationKind.php app/Enums/IntegrationCapability.php config/services.php .env.example phpunit.xml tests/Pest.php tests/Feature/Integrations/IntegrationsExtendedAvailabilityTest.php app/Actions/Integrations/CheckIntegration.php app/Actions/Integrations/DisconnectIntegration.php app/Actions/Integrations/PresentTeamIntegration.php app/Http/Controllers/Integrations/IntegrationTestsController.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): configure the extended providers and their capabilities

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 2: Inbound reachability, host resolution and public addresses

**Files:**
- Create: `app/Support/Integrations/HostResolver.php`, `app/Support/Integrations/PublicAddress.php`, `app/Support/Integrations/InboundReachability.php`
- Test: create `tests/Feature/Integrations/InboundReachabilityTest.php`

**Interfaces:**
- Consumes: `config('app.url')`, `services.integrations.inbound_webhooks`, `services.integrations.poll_minutes` (Task 1), the cache.
- Produces: `HostResolver::addresses()`, `PublicAddress::isPublic()`/`inRange()`, `InboundReachability::isPublic()`/`mode()`/`pollIntervalMinutes()` (Contract).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/InboundReachabilityTest.php`:

```php
<?php

use App\Support\Integrations\HostResolver;
use App\Support\Integrations\InboundReachability;
use App\Support\Integrations\PublicAddress;
use Illuminate\Support\Facades\Http;
use Mockery\MockInterface;

beforeEach(fn () => Http::preventStrayRequests());

/**
 * @param  array<int, string>  $addresses
 */
function fakePublicResolver(array $addresses, int $times = 1): void
{
    test()->mock(HostResolver::class, fn (MockInterface $mock) => $mock
        ->shouldReceive('addresses')
        ->times($times)
        ->andReturn($addresses));
}

it('tells public addresses from private and reserved ones', function (string $address, bool $public) {
    expect(PublicAddress::isPublic($address))->toBe($public);
})->with([
    'public v4' => ['93.184.216.34', true],
    'public dns' => ['8.8.8.8', true],
    'public v6' => ['2606:4700:4700::1111', true],
    'loopback' => ['127.0.0.1', false],
    'rfc1918 10' => ['10.1.2.3', false],
    'rfc1918 172' => ['172.16.5.4', false],
    'rfc1918 192' => ['192.168.1.1', false],
    'metadata' => ['169.254.169.254', false],
    'cgnat' => ['100.64.0.1', false],
    'this network' => ['0.0.0.0', false],
    'multicast' => ['224.0.0.1', false],
    'broadcast' => ['255.255.255.255', false],
    'v6 loopback' => ['::1', false],
    'v6 ula' => ['fd12:3456::1', false],
    'v6 link local' => ['fe80::1', false],
    'v6 multicast' => ['ff02::1', false],
    'v4 mapped' => ['::ffff:127.0.0.1', false],
    'not an address' => ['example.com', false],
]);

it('matches CIDR ranges on bit boundaries', function () {
    expect(PublicAddress::inRange('100.127.255.255', '100.64.0.0/10'))->toBeTrue()
        ->and(PublicAddress::inRange('100.128.0.0', '100.64.0.0/10'))->toBeFalse()
        ->and(PublicAddress::inRange('fc00::1', 'fc00::/7'))->toBeTrue()
        ->and(PublicAddress::inRange('fe00::1', 'fc00::/7'))->toBeFalse()
        ->and(PublicAddress::inRange('10.0.0.1', 'fc00::/7'))->toBeFalse();
});

it('follows the forced modes whatever APP_URL is', function () {
    config(['app.url' => 'http://localhost']);
    fakePublicResolver([], times: 0);

    config(['services.integrations.inbound_webhooks' => 'on']);
    expect(app(InboundReachability::class)->isPublic())->toBeTrue();

    config(['services.integrations.inbound_webhooks' => 'off', 'app.url' => 'https://skrum.example.com']);
    expect(app(InboundReachability::class)->isPublic())->toBeFalse();
});

it('treats an https host resolving to a public address as public', function () {
    config(['services.integrations.inbound_webhooks' => 'auto', 'app.url' => 'https://skrum.example.com']);
    fakePublicResolver(['10.0.0.5', '93.184.216.34']);

    expect(app(InboundReachability::class)->isPublic())->toBeTrue();
});

it('treats local or private APP_URLs as not public', function (string $url, array $addresses, int $lookups) {
    config(['services.integrations.inbound_webhooks' => 'auto', 'app.url' => $url]);
    fakePublicResolver($addresses, $lookups);

    expect(app(InboundReachability::class)->isPublic())->toBeFalse();
})->with([
    'http' => ['http://skrum.example.com', ['93.184.216.34'], 0],
    'localhost' => ['https://localhost', ['127.0.0.1'], 0],
    'ip literal' => ['https://203.0.113.10', ['203.0.113.10'], 0],
    'ipv6 literal' => ['https://[2606:4700:4700::1111]', ['2606:4700:4700::1111'], 0],
    '.test' => ['https://skrum.test', ['93.184.216.34'], 0],
    '.local' => ['https://skrum.local', ['93.184.216.34'], 0],
    '.localhost' => ['https://app.localhost', ['93.184.216.34'], 0],
    '.internal' => ['https://skrum.corp.internal', ['93.184.216.34'], 0],
    '.lan' => ['https://skrum.lan', ['93.184.216.34'], 0],
    '.home.arpa' => ['https://skrum.home.arpa', ['93.184.216.34'], 0],
    'private only' => ['https://skrum.example.com', ['10.0.0.5', 'fd00::5'], 1],
    'unresolvable' => ['https://skrum.example.com', [], 1],
]);

it('caches the answer for an hour', function () {
    config(['services.integrations.inbound_webhooks' => 'auto', 'app.url' => 'https://skrum.example.com']);
    fakePublicResolver(['93.184.216.34'], times: 2);

    expect(app(InboundReachability::class)->isPublic())->toBeTrue()
        ->and(app(InboundReachability::class)->isPublic())->toBeTrue();

    $this->travel(61)->minutes();

    expect(app(InboundReachability::class)->isPublic())->toBeTrue();
});

it('falls back to auto for an unknown mode and clamps the poll interval', function () {
    config(['services.integrations.inbound_webhooks' => 'sometimes']);

    expect(InboundReachability::mode())->toBe('auto');

    foreach ([[0, 1], [5, 5], [60, 60], [90, 60], [-3, 1]] as [$configured, $expected]) {
        config(['services.integrations.poll_minutes' => $configured]);

        expect(InboundReachability::pollIntervalMinutes())->toBe($expected);
    }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/InboundReachabilityTest.php`
Expected: FAIL — `Class "App\Support\Integrations\HostResolver" not found`.

- [ ] **Step 3: Implement**

Create `app/Support/Integrations/HostResolver.php`:

```php
<?php

namespace App\Support\Integrations;

use ErrorException;

class HostResolver
{
    /**
     * @return array<int, string>
     */
    public function addresses(string $host): array
    {
        try {
            $records = dns_get_record($host, DNS_A | DNS_AAAA);
        } catch (ErrorException) {
            return [];
        }

        if (! is_array($records)) {
            return [];
        }

        $addresses = [];

        foreach ($records as $record) {
            $address = $record['ip'] ?? $record['ipv6'] ?? null;

            if (is_string($address)) {
                $addresses[] = $address;
            }
        }

        return array_values(array_unique($addresses));
    }
}
```

Create `app/Support/Integrations/PublicAddress.php`:

```php
<?php

namespace App\Support\Integrations;

/**
 * Spec 8 §4.5: loopback, RFC 1918, link-local, CGNAT, "this network", ULA,
 * multicast, documentation and reserved ranges are never public.
 */
class PublicAddress
{
    /**
     * @var array<int, string>
     */
    private const BlockedRanges = [
        '0.0.0.0/8',
        '10.0.0.0/8',
        '100.64.0.0/10',
        '127.0.0.0/8',
        '169.254.0.0/16',
        '172.16.0.0/12',
        '192.0.0.0/24',
        '192.0.2.0/24',
        '192.168.0.0/16',
        '198.18.0.0/15',
        '198.51.100.0/24',
        '203.0.113.0/24',
        '224.0.0.0/4',
        '240.0.0.0/4',
        '::/128',
        '::1/128',
        '::ffff:0:0/96',
        '64:ff9b::/96',
        '100::/64',
        '2001:db8::/32',
        'fc00::/7',
        'fe80::/10',
        'ff00::/8',
    ];

    public static function isPublic(string $address): bool
    {
        if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return false;
        }

        foreach (self::BlockedRanges as $range) {
            if (self::inRange($address, $range)) {
                return false;
            }
        }

        return true;
    }

    public static function inRange(string $address, string $cidr): bool
    {
        [$subnet, $bits] = explode('/', $cidr, 2);
        $addressBytes = @inet_pton($address);
        $subnetBytes = @inet_pton($subnet);

        if ($addressBytes === false || $subnetBytes === false || strlen($addressBytes) !== strlen($subnetBytes)) {
            return false;
        }

        $prefixLength = (int) $bits;
        $fullBytes = intdiv($prefixLength, 8);

        if (strncmp($addressBytes, $subnetBytes, $fullBytes) !== 0) {
            return false;
        }

        $remainingBits = $prefixLength % 8;

        if ($remainingBits === 0) {
            return true;
        }

        $mask = (0xFF << (8 - $remainingBits)) & 0xFF;

        return (ord($addressBytes[$fullBytes]) & $mask) === (ord($subnetBytes[$fullBytes]) & $mask);
    }
}
```

(`inet_pton` warns on invalid input; Laravel turns warnings into exceptions, hence `@`. Only `isPublic()` feeds it unvalidated text after `filter_var`, and the CIDR list is constant.)

Create `app/Support/Integrations/InboundReachability.php`:

```php
<?php

namespace App\Support\Integrations;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Spec 8 §2.3: whether providers can reach APP_URL with their webhooks.
 */
class InboundReachability
{
    /**
     * @var array<int, string>
     */
    public const Modes = ['auto', 'on', 'off'];

    private const CacheSeconds = 3600;

    /**
     * @var array<int, string>
     */
    private const PrivateSuffixes = ['.local', '.localhost', '.test', '.internal', '.lan', '.home.arpa'];

    public function __construct(private HostResolver $resolver) {}

    public static function mode(): string
    {
        $mode = strtolower((string) config('services.integrations.inbound_webhooks', 'auto'));

        return in_array($mode, self::Modes, true) ? $mode : 'auto';
    }

    public static function pollIntervalMinutes(): int
    {
        return max(1, min(60, (int) config('services.integrations.poll_minutes', 5)));
    }

    public function isPublic(): bool
    {
        return match (self::mode()) {
            'on' => true,
            'off' => false,
            default => $this->appUrlIsPublic(),
        };
    }

    private function appUrlIsPublic(): bool
    {
        $url = (string) config('app.url');

        return Cache::remember(
            'integrations:inbound-public:'.sha1($url),
            self::CacheSeconds,
            fn (): bool => $this->isPublicUrl($url),
        );
    }

    private function isPublicUrl(string $url): bool
    {
        $parts = parse_url($url);

        if (! is_array($parts) || ($parts['scheme'] ?? null) !== 'https') {
            return false;
        }

        $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));

        if ($host === '' || $host === 'localhost') {
            return false;
        }

        if (filter_var(trim($host, '[]'), FILTER_VALIDATE_IP) !== false) {
            return false;
        }

        if (Str::endsWith($host, self::PrivateSuffixes)) {
            return false;
        }

        foreach ($this->resolver->addresses($host) as $address) {
            if (PublicAddress::isPublic($address)) {
                return true;
            }
        }

        return false;
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/InboundReachabilityTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 5: Commit**

```bash
git add app/Support/Integrations/HostResolver.php app/Support/Integrations/PublicAddress.php app/Support/Integrations/InboundReachability.php tests/Feature/Integrations/InboundReachabilityTest.php
git commit -m "feat(integrations): tell whether APP_URL can receive provider webhooks

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 3: Schema, enums and models for sync, events and new channels

**Files:**
- Create: `database/migrations/2026_10_07_100000_extend_integration_tables_for_sync_and_channels.php` (with `vendor/bin/sail artisan make:migration extend_integration_tables_for_sync_and_channels --no-interaction`, then rename to the fixed prefix), `app/Enums/{IntegrationInboundMode,IntegrationWebhookStatus,ExternalIssueState,ExternalStatusCategory,InboundEventStatus}.php`, `app/Models/IntegrationInboundEvent.php`, `database/factories/IntegrationInboundEventFactory.php`
- Modify: `app/Enums/{IntegrationUserMatch,IntegrationDeliveryKind,IntegrationDeliveryChannel}.php`, `app/Models/{TeamIntegration,ActionItemExternalLink,PokerTask,IntegrationDelivery}.php`, `routes/console.php`
- Test: create `tests/Feature/Integrations/IntegrationSyncSchemaTest.php`

**Interfaces:**
- Consumes: spec 6 tables and models (Plan 12a contract).
- Produces: every column, cast, enum, model and factory in the Contract's "Tables and models"; `IntegrationDeliveryChannel` cases for the three new channels (`shareChannels()` unchanged until Task 7).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/IntegrationSyncSchemaTest.php`:

```php
<?php

use App\Enums\ExternalIssueState;
use App\Enums\ExternalStatusCategory;
use App\Enums\InboundEventStatus;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Enums\IntegrationWebhookStatus;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationInboundEvent;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;

beforeEach(fn () => Http::preventStrayRequests());

it('gives team integrations sync defaults and casts', function () {
    $integration = TeamIntegration::factory()->linear()->create();

    expect($integration->inbound_mode)->toBe(IntegrationInboundMode::Off)
        ->and($integration->consecutive_failures)->toBe(0)
        ->and($integration->webhook_status)->toBeNull()
        ->and($integration->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Off);

    $integration->forceFill([
        'inbound_mode' => IntegrationInboundMode::Polling,
        'webhook_status' => IntegrationWebhookStatus::Failing,
        'webhook_expires_at' => now()->addDays(30),
        'last_inbound_at' => now(),
        'last_polled_at' => now(),
        'poll_cursor' => now()->subMinutes(5),
        'consecutive_failures' => 3,
        'last_delivery_succeeded_at' => now(),
    ])->save();

    $fresh = $integration->fresh();

    expect($fresh->inbound_mode)->toBe(IntegrationInboundMode::Polling)
        ->and($fresh->webhook_status)->toBe(IntegrationWebhookStatus::Failing)
        ->and($fresh->webhook_expires_at?->isFuture())->toBeTrue()
        ->and($fresh->poll_cursor)->not->toBeNull()
        ->and($fresh->consecutive_failures)->toBe(3)
        ->and($fresh->last_delivery_succeeded_at)->not->toBeNull();
});

it('stores the sync state of external links for every tracker', function () {
    $link = ActionItemExternalLink::factory()->create(['source' => IntegrationProvider::GitHub, 'external_site' => '4242']);

    $link->forceFill([
        'external_state' => ExternalIssueState::Done,
        'external_status_name' => 'closed',
        'external_updated_at' => now(),
        'local_state_changed_at' => now(),
        'last_pushed_state' => ExternalIssueState::Open,
        'last_pushed_at' => now(),
        'last_synced_at' => now(),
        'sync_error' => 'Nope',
        'missing_at' => now(),
    ])->save();

    $fresh = $link->fresh();

    expect($fresh->source)->toBe(IntegrationProvider::GitHub)
        ->and($fresh->external_state)->toBe(ExternalIssueState::Done)
        ->and($fresh->last_pushed_state)->toBe(ExternalIssueState::Open)
        ->and($fresh->external_status_name)->toBe('closed')
        ->and($fresh->missing_at)->not->toBeNull()
        ->and(Schema::hasIndex('action_item_external_links', ['source', 'external_site', 'external_id']))->toBeTrue();
});

it('stores the source status of poker tasks', function () {
    $task = PokerTask::factory()->imported(IntegrationProvider::Jira)->create();

    $task->forceFill([
        'external_source' => IntegrationProvider::JiraDataCenter->value,
        'external_status_name' => 'In review',
        'external_status_category' => ExternalStatusCategory::InProgress,
        'external_updated_at' => now(),
        'external_missing_at' => now(),
    ])->save();

    $fresh = $task->fresh();

    expect($fresh->external_source)->toBe('jira_dc')
        ->and($fresh->external_status_category)->toBe(ExternalStatusCategory::InProgress)
        ->and($fresh->external_status_name)->toBe('In review')
        ->and($fresh->external_missing_at)->not->toBeNull()
        ->and(Schema::hasIndex('poker_tasks', ['external_source', 'external_site', 'external_id']))->toBeTrue();
});

it('logs event deliveries against their integration', function () {
    $integration = TeamIntegration::factory()->slack()->create();
    $delivery = IntegrationDelivery::factory()->create([
        'team_id' => $integration->team_id,
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::Event,
        'team_integration_id' => $integration->id,
        'event' => 'action_item.completed',
        'attempts' => 2,
        'response_status' => 503,
        'last_attempt_at' => now(),
        'requested_by_user_id' => null,
    ]);

    expect($delivery->fresh()->integration->is($integration))->toBeTrue()
        ->and($delivery->fresh()->attempts)->toBe(2)
        ->and($delivery->fresh()->response_status)->toBe(503)
        ->and($delivery->fresh()->channel->provider())->toBe(IntegrationProvider::Webhook);

    $integration->delete();

    expect($delivery->fresh()->team_integration_id)->toBeNull();
});

it('maps the new delivery channels to their providers', function () {
    expect(IntegrationDeliveryChannel::MicrosoftTeams->provider())->toBe(IntegrationProvider::MicrosoftTeams)
        ->and(IntegrationDeliveryChannel::Mattermost->provider())->toBe(IntegrationProvider::Mattermost)
        ->and(IntegrationDeliveryChannel::Webhook->provider())->toBe(IntegrationProvider::Webhook)
        ->and(IntegrationUserMatch::from('sso'))->toBe(IntegrationUserMatch::Sso);
});

it('de-duplicates inbound events per provider and prunes them after 7 days', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $kept = IntegrationInboundEvent::factory()->create(['team_integration_id' => $integration->id, 'event_key' => 'delivery-1']);
    IntegrationInboundEvent::factory()->create(['provider' => IntegrationProvider::Linear, 'event_key' => 'delivery-1']);
    $old = IntegrationInboundEvent::factory()->create(['received_at' => now()->subDays(8)]);

    expect(fn () => IntegrationInboundEvent::factory()->create(['event_key' => 'delivery-1']))
        ->toThrow(UniqueConstraintViolationException::class);

    expect($kept->fresh()->status)->toBe(InboundEventStatus::Applied)
        ->and($kept->fresh()->provider)->toBe(IntegrationProvider::Jira)
        ->and($kept->fresh()->integration->is($integration))->toBeTrue();

    $this->artisan('model:prune', ['--model' => [IntegrationInboundEvent::class]])->assertSuccessful();

    expect(IntegrationInboundEvent::query()->find($old->id))->toBeNull()
        ->and(IntegrationInboundEvent::query()->count())->toBe(2);

    $integration->delete();

    expect($kept->fresh()->team_integration_id)->toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationSyncSchemaTest.php`
Expected: FAIL — `Class "App\Enums\ExternalIssueState" not found`.

- [ ] **Step 3: Write the migration**

`database/migrations/2026_10_07_100000_extend_integration_tables_for_sync_and_channels.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('team_integrations', function (Blueprint $table) {
            $table->string('inbound_mode', 10)->default('off');
            $table->string('webhook_status', 10)->nullable();
            $table->timestamp('webhook_expires_at')->nullable();
            $table->timestamp('last_inbound_at')->nullable();
            $table->timestamp('last_polled_at')->nullable();
            $table->timestamp('poll_cursor')->nullable();
            $table->unsignedInteger('consecutive_failures')->default(0);
            $table->timestamp('last_delivery_succeeded_at')->nullable();
        });

        Schema::table('action_item_external_links', function (Blueprint $table) {
            $table->string('external_state', 10)->nullable();
            $table->string('external_status_name', 100)->nullable();
            $table->timestamp('external_updated_at')->nullable();
            $table->timestamp('local_state_changed_at')->nullable();
            $table->string('last_pushed_state', 10)->nullable();
            $table->timestamp('last_pushed_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->string('sync_error', 500)->nullable();
            $table->timestamp('missing_at')->nullable();

            $table->index(['source', 'external_site', 'external_id']);
        });

        Schema::table('poker_tasks', function (Blueprint $table) {
            $table->string('external_status_name', 100)->nullable();
            $table->string('external_status_category', 20)->nullable();
            $table->timestamp('external_updated_at')->nullable();
            $table->timestamp('external_missing_at')->nullable();

            $table->index(['external_source', 'external_site', 'external_id']);
        });

        Schema::table('integration_deliveries', function (Blueprint $table) {
            $table->foreignUuid('team_integration_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event', 60)->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->timestamp('last_attempt_at')->nullable();
        });

        Schema::create('integration_inbound_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('provider', 20);
            $table->foreignUuid('team_integration_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event_key', 191);
            $table->string('event_type', 100);
            $table->string('status', 10);
            $table->string('detail', 500)->nullable();
            $table->timestamp('received_at');

            $table->unique(['provider', 'event_key']);
            $table->index('received_at');
        });
    }
};
```

- [ ] **Step 4: Add the enums**

Create five backed enums in `app/Enums/` exactly as the Contract lists them (`IntegrationInboundMode`, `IntegrationWebhookStatus`, `ExternalIssueState`, `ExternalStatusCategory`, `InboundEventStatus`), each a plain `enum X: string { case … }` like `IntegrationKind`.

Append `case Sso = 'sso';` to `IntegrationUserMatch`, `case Event = 'event';` to `IntegrationDeliveryKind`. In `IntegrationDeliveryChannel`, add after `Email`:

```php
    case MicrosoftTeams = 'msteams';
    case Mattermost = 'mattermost';
    case Webhook = 'webhook';
```

and extend `provider()`:

```php
    public function provider(): ?IntegrationProvider
    {
        return match ($this) {
            self::Slack => IntegrationProvider::Slack,
            self::Telegram => IntegrationProvider::Telegram,
            self::MicrosoftTeams => IntegrationProvider::MicrosoftTeams,
            self::Mattermost => IntegrationProvider::Mattermost,
            self::Webhook => IntegrationProvider::Webhook,
            self::Email => null,
        };
    }
```

- [ ] **Step 5: Update the models**

`app/Models/TeamIntegration.php` — add to the class docblock:

```php
 * @property IntegrationInboundMode $inbound_mode
 * @property IntegrationWebhookStatus|null $webhook_status
 * @property Carbon|null $webhook_expires_at
 * @property Carbon|null $last_inbound_at
 * @property Carbon|null $last_polled_at
 * @property Carbon|null $poll_cursor
 * @property int $consecutive_failures
 * @property Carbon|null $last_delivery_succeeded_at
```

add (after the traits):

```php
    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'inbound_mode' => 'off',
        'consecutive_failures' => 0,
    ];
```

and to `casts()`:

```php
            'inbound_mode' => IntegrationInboundMode::class,
            'webhook_status' => IntegrationWebhookStatus::class,
            'webhook_expires_at' => 'datetime',
            'last_inbound_at' => 'datetime',
            'last_polled_at' => 'datetime',
            'poll_cursor' => 'datetime',
            'consecutive_failures' => 'integer',
            'last_delivery_succeeded_at' => 'datetime',
```

The `#[Fillable]` list stays unchanged (sync columns are written with `forceFill`).

`app/Models/ActionItemExternalLink.php` — docblock `@property ExternalIssueState|null $external_state`, `string|null $external_status_name`, `Carbon|null $external_updated_at`, `Carbon|null $local_state_changed_at`, `ExternalIssueState|null $last_pushed_state`, `Carbon|null $last_pushed_at`, `Carbon|null $last_synced_at`, `string|null $sync_error`, `Carbon|null $missing_at` (import `Illuminate\Support\Carbon` if missing); casts:

```php
            'external_state' => ExternalIssueState::class,
            'last_pushed_state' => ExternalIssueState::class,
            'external_updated_at' => 'datetime',
            'local_state_changed_at' => 'datetime',
            'last_pushed_at' => 'datetime',
            'last_synced_at' => 'datetime',
            'missing_at' => 'datetime',
```

`app/Models/PokerTask.php` — docblock `string|null $external_status_name`, `ExternalStatusCategory|null $external_status_category`, `Carbon|null $external_updated_at`, `Carbon|null $external_missing_at`; casts:

```php
            'external_status_category' => ExternalStatusCategory::class,
            'external_updated_at' => 'datetime',
            'external_missing_at' => 'datetime',
```

`app/Models/IntegrationDelivery.php` — docblock `string|null $team_integration_id`, `string|null $event`, `int $attempts`, `int|null $response_status`, `Carbon|null $last_attempt_at`, `@property-read TeamIntegration|null $integration`; add `'team_integration_id', 'event', 'attempts', 'response_status', 'last_attempt_at'` to `#[Fillable]`; casts:

```php
            'attempts' => 'integer',
            'response_status' => 'integer',
            'last_attempt_at' => 'datetime',
```

and the relation:

```php
    /** @return BelongsTo<TeamIntegration, $this> */
    public function integration(): BelongsTo
    {
        return $this->belongsTo(TeamIntegration::class, 'team_integration_id');
    }
```

Create `app/Models/IntegrationInboundEvent.php`:

```php
<?php

namespace App\Models;

use App\Enums\InboundEventStatus;
use App\Enums\IntegrationProvider;
use Database\Factories\IntegrationInboundEventFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One verified or refused inbound webhook, kept 7 days for de-duplication.
 * The payload is never stored (spec 8 §3, §8.2).
 *
 * @property string $id
 * @property IntegrationProvider $provider
 * @property string|null $team_integration_id
 * @property string $event_key
 * @property string $event_type
 * @property InboundEventStatus $status
 * @property string|null $detail
 * @property Carbon $received_at
 * @property-read TeamIntegration|null $integration
 */
#[Fillable(['provider', 'team_integration_id', 'event_key', 'event_type', 'status', 'detail', 'received_at'])]
class IntegrationInboundEvent extends Model
{
    /** @use HasFactory<IntegrationInboundEventFactory> */
    use HasFactory;

    use HasUuids;
    use Prunable;

    private const RetentionDays = 7;

    public $timestamps = false;

    /** @return BelongsTo<TeamIntegration, $this> */
    public function integration(): BelongsTo
    {
        return $this->belongsTo(TeamIntegration::class, 'team_integration_id');
    }

    /** @return Builder<static> */
    public function prunable(): Builder
    {
        return static::query()->where('received_at', '<', now()->subDays(self::RetentionDays));
    }

    protected function casts(): array
    {
        return [
            'provider' => IntegrationProvider::class,
            'status' => InboundEventStatus::class,
            'received_at' => 'datetime',
        ];
    }
}
```

Create `database/factories/IntegrationInboundEventFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\InboundEventStatus;
use App\Enums\IntegrationProvider;
use App\Models\IntegrationInboundEvent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<IntegrationInboundEvent>
 */
class IntegrationInboundEventFactory extends Factory
{
    public function definition(): array
    {
        return [
            'provider' => IntegrationProvider::Jira,
            'team_integration_id' => null,
            'event_key' => fake()->unique()->uuid(),
            'event_type' => 'jira:issue_updated',
            'status' => InboundEventStatus::Applied,
            'detail' => null,
            'received_at' => now(),
        ];
    }
}
```

In `routes/console.php`, add `use App\Models\IntegrationInboundEvent;` and change the prune entry to `['--model' => [IntegrationDelivery::class, IntegrationInboundEvent::class]]`.

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationSyncSchemaTest.php tests/Feature/Integrations/IntegrationModelsTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 7: Commit**

```bash
git add database/migrations/2026_10_07_100000_extend_integration_tables_for_sync_and_channels.php app/Enums/IntegrationInboundMode.php app/Enums/IntegrationWebhookStatus.php app/Enums/ExternalIssueState.php app/Enums/ExternalStatusCategory.php app/Enums/InboundEventStatus.php app/Enums/IntegrationUserMatch.php app/Enums/IntegrationDeliveryKind.php app/Enums/IntegrationDeliveryChannel.php app/Models/TeamIntegration.php app/Models/ActionItemExternalLink.php app/Models/PokerTask.php app/Models/IntegrationDelivery.php app/Models/IntegrationInboundEvent.php database/factories/IntegrationInboundEventFactory.php routes/console.php tests/Feature/Integrations/IntegrationSyncSchemaTest.php
git commit -m "feat(integrations): add the status sync, event delivery and inbound event schema

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 4: Teams and Mattermost message formats

**Files:**
- Create: `app/Support/Integrations/Messages/{MarkdownText,MicrosoftTeamsText,MattermostText}.php`
- Modify: `app/Support/Integrations/Messages/{ShareContent,LinkShareContent,RetroRecapContent}.php`
- Test: create `tests/Feature/Integrations/ChatMessageFormattingTest.php`

**Interfaces:**
- Consumes: `RetroRecap`, `RecapText`, `TelegramText::MessageLimit`, the existing `RetroRecapContent` Slack/Telegram builders (behaviour unchanged; `RecapFormattingTest` stays green).
- Produces: `MarkdownText`, `MicrosoftTeamsText`, `MattermostText`, `ShareContent::toMicrosoftTeams()`, `ShareContent::toMattermost()` (Contract).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/ChatMessageFormattingTest.php`:

```php
<?php

use App\Support\Integrations\Messages\LinkShareContent;
use App\Support\Integrations\Messages\MattermostText;
use App\Support\Integrations\Messages\MicrosoftTeamsText;
use App\Support\Integrations\Messages\RetroRecap;
use App\Support\Integrations\Messages\RetroRecapContent;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

function chatRecap(array $overrides = []): RetroRecap
{
    return new RetroRecap(...[
        'title' => 'Sprint 42',
        'teamName' => 'Platform',
        'completedOn' => 'September 28, 2026',
        'url' => 'https://skrum.test/retros/1',
        'participantCount' => 3,
        'participantNames' => ['Ada', 'Bob', 'Gus (guest)'],
        'cardCount' => 12,
        'rotiAverage' => 4.5,
        'rotiRespondents' => 2,
        'summary' => 'We shipped a lot.',
        'actionItems' => [['content' => 'Fix the deploy', 'assignee' => 'Ada', 'dueOn' => 'October 15, 2026', 'isCompleted' => false]],
        'hiddenActionItems' => 0,
        'suggestedActions' => ['Automate the release notes'],
        'hiddenSuggestedActions' => 0,
        'topCards' => [['column' => 'Wins', 'content' => 'Faster reviews', 'votes' => 5, 'groupedCount' => 2]],
        ...$overrides,
    ]);
}

/**
 * @return array<int, array{content: string, assignee: ?string, dueOn: ?string, isCompleted: bool}>
 */
function manyChatActionItems(int $count): array
{
    return array_map(fn (int $number) => [
        'content' => str_repeat("Action {$number} ", 30),
        'assignee' => 'Ada',
        'dueOn' => null,
        'isCompleted' => false,
    ], range(1, $count));
}

it('escapes Adaptive Card Markdown', function (string $text, string $escaped) {
    expect(MicrosoftTeamsText::escape($text))->toBe($escaped);
})->with([
    'emphasis' => ['a*b_c', 'a\*b\_c'],
    'link' => ['[x](http://evil)', '\[x\]\(http://evil\)'],
    'code' => ['`code`', '\`code\`'],
    'heading, quote, strike' => ['# title > quote ~strike', '\# title \> quote \~strike'],
    'backslash' => ['back\slash', 'back\\\\slash'],
    'list markers' => ["- one\n+ two\n3. three", "\\- one\n\\+ two\n3\\. three"],
]);

it('escapes Markdown and mentions for Mattermost', function (string $text, string $escaped) {
    expect(MattermostText::escape($text))->toBe($escaped);
})->with([
    'mentions' => ['@channel and @here', "@\u{200B}channel and @\u{200B}here"],
    'channel link' => ['~town-square', "\\~\u{200B}town-square"],
    'link' => ['[x](http://evil)', '\[x\]\(http://evil\)'],
    'table and autolink' => ['a|b <http://x>', 'a\|b \<http://x\>'],
    'list marker' => ['- item', '\- item'],
]);

it('builds a Teams link card with one open action', function () {
    $message = (new LinkShareContent('Ada invites you to "Sprint *42*" (Platform)', 'Open the retrospective', 'https://skrum.test/retros/1'))->toMicrosoftTeams();
    $card = $message['attachments'][0]['content'];

    expect($message['type'])->toBe('message')
        ->and($message['attachments'][0]['contentType'])->toBe('application/vnd.microsoft.card.adaptive')
        ->and($card['type'])->toBe('AdaptiveCard')
        ->and($card['version'])->toBe('1.4')
        ->and($card['body'])->toBe([[
            'type' => 'TextBlock',
            'text' => 'Ada invites you to "Sprint \*42\*" \(Platform\)',
            'wrap' => true,
        ]])
        ->and($card['actions'])->toBe([['type' => 'Action.OpenUrl', 'title' => 'Open the retrospective', 'url' => 'https://skrum.test/retros/1']]);
});

it('builds a Mattermost link message', function () {
    $text = (new LinkShareContent('Ada invites you to "Sprint *42*" (@all)', 'Open the retrospective', 'https://skrum.test/retros/1'))->toMattermost();

    expect($text)->toBe("Ada invites you to \"Sprint \\*42\\*\" \\(@\u{200B}all\\)\n\n[Open the retrospective](https://skrum.test/retros/1)");
});

it('formats a Teams recap', function () {
    $message = (new RetroRecapContent(chatRecap()))->toMicrosoftTeams();
    $card = $message['attachments'][0]['content'];
    $texts = collect($card['body'])->pluck('text')->all();

    expect($card['body'][0])->toBe(['type' => 'TextBlock', 'text' => 'Results of the retrospective "Sprint 42"', 'wrap' => true, 'size' => 'Large', 'weight' => 'Bolder'])
        ->and(collect($card['body'])->every(fn (array $block) => $block['type'] === 'TextBlock' && $block['wrap'] === true))->toBeTrue()
        ->and($texts)->toContain(
            'Platform · completed on September 28, 2026',
            'Participants \(3\): Ada, Bob, Gus \(guest\)',
            'Cards: 12',
            'ROTI: 4.5/5 \(2 answers\)',
            'Summary',
            'We shipped a lot.',
            'Action items',
            '• Fix the deploy — Ada · Due October 15, 2026',
            'Suggested actions',
            '• Automate the release notes',
            'Top card per column',
            '• Wins — Faster reviews \(votes: 5, grouped cards: 2\)',
        )
        ->and($card['actions'])->toBe([['type' => 'Action.OpenUrl', 'title' => 'Open the results', 'url' => 'https://skrum.test/retros/1']]);
});

it('formats a Mattermost recap', function () {
    $text = (new RetroRecapContent(chatRecap()))->toMattermost();

    expect($text)->toStartWith("#### Results of the retrospective \"Sprint 42\"\nPlatform · completed on September 28, 2026")
        ->and($text)->toContain("Participants \\(3\\): Ada, Bob, Gus \\(guest\\)\nCards: 12\nROTI: 4.5/5 \\(2 answers\\)")
        ->and($text)->toContain("**Summary**\nWe shipped a lot.")
        ->and($text)->toContain("**Action items**\n- Fix the deploy — Ada · Due October 15, 2026")
        ->and($text)->toContain("**Suggested actions**\n- Automate the release notes")
        ->and($text)->toContain("**Top card per column**\n- Wins — Faster reviews \\(votes: 5, grouped cards: 2\\)")
        ->and($text)->toEndWith('[Open the results](https://skrum.test/retros/1)');
});

it('shows only a participant count for anonymous retros', function () {
    $recap = chatRecap(['participantNames' => null]);
    $teams = json_encode((new RetroRecapContent($recap))->toMicrosoftTeams(), JSON_UNESCAPED_UNICODE);
    $mattermost = (new RetroRecapContent($recap))->toMattermost();

    expect($teams)->toContain('Participants: 3')->not->toContain('Bob')
        ->and($mattermost)->toContain('Participants: 3')->not->toContain('Bob');
});

it('escapes recap content in both channels', function () {
    $recap = chatRecap([
        'title' => '[click](http://evil) *now*',
        'actionItems' => [['content' => '@channel - ship ~town-square', 'assignee' => null, 'dueOn' => null, 'isCompleted' => false]],
        'topCards' => [['column' => '# Wins', 'content' => '1. first', 'votes' => 1, 'groupedCount' => 0]],
    ]);
    $texts = collect((new RetroRecapContent($recap))->toMicrosoftTeams()['attachments'][0]['content']['body'])->pluck('text');
    $mattermost = (new RetroRecapContent($recap))->toMattermost();

    expect($texts)->toContain('Results of the retrospective "\[click\]\(http://evil\) \*now\*"', '• @channel - ship \~town-square', '• \# Wins — 1. first \(votes: 1\)')
        ->and($mattermost)->toContain("- @\u{200B}channel - ship \\~\u{200B}town-square")
        ->and($mattermost)->not->toContain('[click](http://evil)')
        ->and($mattermost)->not->toContain('@channel');
});

it('keeps Teams cards within 28 000 bytes, shortening lists first', function () {
    $message = (new RetroRecapContent(chatRecap(['actionItems' => manyChatActionItems(200)])))->toMicrosoftTeams();
    $card = $message['attachments'][0]['content'];
    $texts = collect($card['body'])->pluck('text');

    expect(strlen((string) json_encode($message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)))->toBeLessThanOrEqual(28000)
        ->and(MicrosoftTeamsText::fits($message))->toBeTrue()
        ->and($texts)->toContain('We shipped a lot.', 'Participants \(3\): Ada, Bob, Gus \(guest\)')
        ->and($texts->filter(fn (string $text) => preg_match('/^\\\\\+ \d+ more$/', $text) === 1))->toHaveCount(1)
        ->and($card['actions'][0]['url'])->toBe('https://skrum.test/retros/1');
});

it('keeps Mattermost messages within 16 000 characters, shortening lists first', function () {
    $text = (new RetroRecapContent(chatRecap(['actionItems' => manyChatActionItems(200)])))->toMattermost();

    expect(mb_strlen($text))->toBeLessThanOrEqual(MattermostText::MessageLimit)
        ->and($text)->toContain('We shipped a lot.')
        ->and($text)->toContain('Ada, Bob, Gus \(guest\)')
        ->and($text)->toMatch('/\\\\\+ \d+ more/')
        ->and($text)->toEndWith('[Open the results](https://skrum.test/retros/1)');
});

it('drops participant names last', function () {
    $names = array_map(fn (int $number) => "Participant number {$number}", range(1, 1500));
    $recap = chatRecap(['participantCount' => 1500, 'participantNames' => $names, 'actionItems' => manyChatActionItems(50)]);

    $teams = (new RetroRecapContent($recap))->toMicrosoftTeams();
    $mattermost = (new RetroRecapContent($recap))->toMattermost();

    expect(MicrosoftTeamsText::fits($teams))->toBeTrue()
        ->and(json_encode($teams, JSON_UNESCAPED_UNICODE))->toContain('Participants: 1500')
        ->and(mb_strlen($mattermost))->toBeLessThanOrEqual(MattermostText::MessageLimit)
        ->and($mattermost)->toContain('Participants: 1500')
        ->and($mattermost)->toContain('#### Results of the retrospective');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ChatMessageFormattingTest.php`
Expected: FAIL — `Class "App\Support\Integrations\Messages\MicrosoftTeamsText" not found`.

- [ ] **Step 3: Implement the text helpers**

Create `app/Support/Integrations/Messages/MarkdownText.php`:

```php
<?php

namespace App\Support\Integrations\Messages;

class MarkdownText
{
    /**
     * Backslash-escapes the given characters and any leading list marker
     * ("-", "+", "1."), so user text cannot format, link or start a list.
     */
    public static function escape(string $text, string $specials): string
    {
        $escaped = preg_replace('/(['.preg_quote($specials, '/').'])/u', '\\\\$1', $text) ?? $text;
        $escaped = preg_replace('/^(\s*)([-+])/mu', '$1\\\\$2', $escaped) ?? $escaped;

        return preg_replace('/^(\s*\d+)\./mu', '$1\\\\.', $escaped) ?? $escaped;
    }
}
```

Create `app/Support/Integrations/Messages/MicrosoftTeamsText.php`:

```php
<?php

namespace App\Support\Integrations\Messages;

/**
 * Adaptive Card 1.4 messages for a Teams Workflows webhook. Mentions need
 * explicit entities, which skrum never sends, so escaping Markdown is enough.
 */
class MicrosoftTeamsText
{
    public const PayloadLimitBytes = 28000;

    private const Specials = '\\*_[]()#>~`';

    public static function escape(string $text): string
    {
        return MarkdownText::escape($text, self::Specials);
    }

    /**
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public static function block(string $text, array $options = []): array
    {
        return ['type' => 'TextBlock', 'text' => self::escape($text), 'wrap' => true, ...$options];
    }

    /**
     * @return array{type: string, title: string, url: string}
     */
    public static function openUrl(string $title, string $url): array
    {
        return ['type' => 'Action.OpenUrl', 'title' => $title, 'url' => $url];
    }

    /**
     * @param  array<int, array<string, mixed>>  $body
     * @param  array{type: string, title: string, url: string}|null  $action
     * @return array<string, mixed>
     */
    public static function message(array $body, ?array $action = null): array
    {
        $card = [
            '$schema' => 'http://adaptivecards.io/schemas/adaptive-card.json',
            'type' => 'AdaptiveCard',
            'version' => '1.4',
            'body' => $body,
        ];

        if ($action !== null) {
            $card['actions'] = [$action];
        }

        return [
            'type' => 'message',
            'attachments' => [[
                'contentType' => 'application/vnd.microsoft.card.adaptive',
                'content' => $card,
            ]],
        ];
    }

    /**
     * @param  array<string, mixed>  $message
     */
    public static function fits(array $message): bool
    {
        return strlen((string) json_encode($message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) <= self::PayloadLimitBytes;
    }
}
```

Create `app/Support/Integrations/Messages/MattermostText.php`:

```php
<?php

namespace App\Support\Integrations\Messages;

class MattermostText
{
    public const MessageLimit = 16000;

    private const Specials = '\\*_[]()#>~|<`';

    /**
     * A zero-width space after "@" and "~" keeps user text from mentioning
     * people or channels (@channel, @here, ~town-square).
     */
    public static function escape(string $text): string
    {
        return str_replace(['@', '~'], ["@\u{200B}", "~\u{200B}"], MarkdownText::escape($text, self::Specials));
    }

    public static function link(string $label, string $url): string
    {
        return '['.self::escape($label).']('.str_replace(['(', ')', ' '], ['%28', '%29', '%20'], $url).')';
    }
}
```

- [ ] **Step 4: Extend the share contents**

In `app/Support/Integrations/Messages/ShareContent.php`, add:

```php
    /**
     * @return array<string, mixed>
     */
    public function toMicrosoftTeams(): array;

    public function toMattermost(): string;
```

In `LinkShareContent`, add:

```php
    public function toMicrosoftTeams(): array
    {
        return MicrosoftTeamsText::message(
            [MicrosoftTeamsText::block(Str::limit($this->text, self::TextLimit, '…'))],
            MicrosoftTeamsText::openUrl($this->buttonLabel, $this->url),
        );
    }

    public function toMattermost(): string
    {
        return MattermostText::escape(Str::limit($this->text, self::TextLimit, '…'))
            ."\n\n".MattermostText::link($this->buttonLabel, $this->url);
    }
```

In `RetroRecapContent`: update the class docblock to "Chat channels limit message sizes, so lists shrink first (with "+ n more"), then the summary, then the participant names."; add `use Closure;`; rename `telegramAttempts()` to `attempts()` (same body); replace `toTelegram()` and add the two new builders:

```php
    public function toTelegram(): string
    {
        return $this->firstFitting(
            $this->telegramMessage(...),
            fn (string $html): bool => mb_strlen($html) <= TelegramText::MessageLimit,
        );
    }

    public function toMicrosoftTeams(): array
    {
        return $this->firstFitting($this->teamsMessage(...), MicrosoftTeamsText::fits(...));
    }

    public function toMattermost(): string
    {
        return $this->firstFitting(
            $this->mattermostMessage(...),
            fn (string $text): bool => mb_strlen($text) <= MattermostText::MessageLimit,
        );
    }

    /**
     * @template TMessage of string|array<string, mixed>
     *
     * @param  Closure(int, int, int, bool): TMessage  $build
     * @param  Closure(TMessage): bool  $fits
     * @return TMessage
     */
    private function firstFitting(Closure $build, Closure $fits): string|array
    {
        foreach ($this->attempts() as [$actionItems, $topCards, $summaryLimit, $withNames]) {
            $message = $build($actionItems, $topCards, $summaryLimit, $withNames);

            if ($fits($message)) {
                return $message;
            }
        }

        return $build(0, 0, 0, false);
    }

    /**
     * @return array<string, mixed>
     */
    private function teamsMessage(int $actionItems, int $topCards, int $summaryLimit, bool $withNames): array
    {
        $recap = $this->recap;

        $body = [
            MicrosoftTeamsText::block(RecapText::heading($recap), ['size' => 'Large', 'weight' => 'Bolder']),
            MicrosoftTeamsText::block(RecapText::context($recap), ['isSubtle' => true, 'spacing' => 'None']),
        ];

        foreach (array_filter([RecapText::participants($recap, $withNames), RecapText::cards($recap), RecapText::roti($recap)]) as $line) {
            $body[] = MicrosoftTeamsText::block($line, ['spacing' => 'None']);
        }

        if ($recap->summary !== null && $summaryLimit > 0) {
            $body[] = MicrosoftTeamsText::block(__('Summary'), ['weight' => 'Bolder']);
            $body[] = MicrosoftTeamsText::block(Str::limit($recap->summary, $summaryLimit, '…'), ['spacing' => 'None']);
        }

        array_push(
            $body,
            ...$this->teamsList(
                __('Action items'),
                array_map(RecapText::actionItem(...), array_slice($recap->actionItems, 0, $actionItems)),
                $recap->hiddenActionItems + count($recap->actionItems) - $actionItems,
            ),
            ...$this->teamsList(__('Suggested actions'), $recap->suggestedActions, $recap->hiddenSuggestedActions),
            ...$this->teamsList(
                __('Top card per column'),
                array_map(RecapText::topCard(...), array_slice($recap->topCards, 0, $topCards)),
                count($recap->topCards) - $topCards,
            ),
        );

        return MicrosoftTeamsText::message($body, MicrosoftTeamsText::openUrl(RecapText::openLabel(), $recap->url));
    }

    /**
     * @param  array<int, string>  $lines
     * @return array<int, array<string, mixed>>
     */
    private function teamsList(string $heading, array $lines, int $more): array
    {
        if ($lines === [] && $more === 0) {
            return [];
        }

        $blocks = [MicrosoftTeamsText::block($heading, ['weight' => 'Bolder'])];

        foreach ($lines as $line) {
            $blocks[] = MicrosoftTeamsText::block("• {$line}", ['spacing' => 'None']);
        }

        if ($more > 0) {
            $blocks[] = MicrosoftTeamsText::block(RecapText::more($more), ['spacing' => 'None', 'isSubtle' => true]);
        }

        return $blocks;
    }

    private function mattermostMessage(int $actionItems, int $topCards, int $summaryLimit, bool $withNames): string
    {
        $recap = $this->recap;

        $parts = [
            '#### '.MattermostText::escape(RecapText::heading($recap))."\n".MattermostText::escape(RecapText::context($recap)),
            implode("\n", array_map(MattermostText::escape(...), array_filter([
                RecapText::participants($recap, $withNames),
                RecapText::cards($recap),
                RecapText::roti($recap),
            ]))),
        ];

        if ($recap->summary !== null && $summaryLimit > 0) {
            $parts[] = '**'.MattermostText::escape(__('Summary'))."**\n".MattermostText::escape(Str::limit($recap->summary, $summaryLimit, '…'));
        }

        $parts[] = $this->mattermostList(
            __('Action items'),
            array_map(RecapText::actionItem(...), array_slice($recap->actionItems, 0, $actionItems)),
            $recap->hiddenActionItems + count($recap->actionItems) - $actionItems,
        );
        $parts[] = $this->mattermostList(__('Suggested actions'), $recap->suggestedActions, $recap->hiddenSuggestedActions);
        $parts[] = $this->mattermostList(
            __('Top card per column'),
            array_map(RecapText::topCard(...), array_slice($recap->topCards, 0, $topCards)),
            count($recap->topCards) - $topCards,
        );
        $parts[] = MattermostText::link(RecapText::openLabel(), $recap->url);

        return implode("\n\n", array_filter($parts, fn (?string $part): bool => $part !== null && $part !== ''));
    }

    /**
     * @param  array<int, string>  $lines
     */
    private function mattermostList(string $heading, array $lines, int $more): ?string
    {
        if ($lines === [] && $more === 0) {
            return null;
        }

        $text = '**'.MattermostText::escape($heading).'**';

        foreach ($lines as $line) {
            $text .= "\n- ".MattermostText::escape($line);
        }

        if ($more > 0) {
            $text .= "\n".MattermostText::escape(RecapText::more($more));
        }

        return $text;
    }
```

(`firstFitting()` returns the last, smallest attempt when nothing fits — the Telegram behaviour, now shared.)

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ChatMessageFormattingTest.php tests/Feature/Integrations/RecapFormattingTest.php tests/Feature/Integrations/RetroRecapTest.php`
Expected: PASS. Then pint and phpstan (0 errors; if phpstan cannot infer the template through first-class callables, type `firstFitting()` as `@return ($build is Closure(int, int, int, bool): string ? string : array<string, mixed>)` or split it into `firstFittingText()`/`firstFittingCard()` — keep behaviour identical).

- [ ] **Step 6: Commit**

```bash
git add app/Support/Integrations/Messages/MarkdownText.php app/Support/Integrations/Messages/MicrosoftTeamsText.php app/Support/Integrations/Messages/MattermostText.php app/Support/Integrations/Messages/ShareContent.php app/Support/Integrations/Messages/LinkShareContent.php app/Support/Integrations/Messages/RetroRecapContent.php tests/Feature/Integrations/ChatMessageFormattingTest.php
git commit -m "feat(integrations): format links and recaps for Teams and Mattermost

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 5: Webhook URL rules and the Teams and Mattermost clients

**Files:**
- Create: `app/Rules/MicrosoftTeamsWebhookUrl.php`, `app/Rules/MattermostWebhookUrl.php`, `app/Support/Integrations/MicrosoftTeams/MicrosoftTeamsClient.php`, `app/Support/Integrations/Mattermost/MattermostClient.php`
- Modify: `app/Support/Integrations/IntegrationErrors.php`, `database/factories/TeamIntegrationFactory.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/ChatWebhookClientsTest.php`

**Interfaces:**
- Consumes: `ProviderHttp`, `TeamIntegration::credential()` / `withReconnectHandling()`, the exception hierarchy (Plan 12a), `services.msteams.allowed_hosts`, `services.mattermost.url`.
- Produces: the rules, both clients, factory states `microsoftTeams()` / `mattermost()` and constants `MicrosoftTeamsUrl` / `MattermostUrl` (Contract).

- [ ] **Step 1: Add the factory states**

In `database/factories/TeamIntegrationFactory.php`, add the constants and states:

```php
    public const MicrosoftTeamsUrl = 'https://prod-12.westeurope.logic.azure.com:443/workflows/abc123/triggers/manual/paths/invoke?api-version=2016-06-01&sig=teams-signature';

    public const MattermostUrl = 'https://chat.example.com/hooks/abcdefghijklmnopqrstuvwxyz';

    public function microsoftTeams(): static
    {
        return $this->state(fn () => [
            'provider' => IntegrationProvider::MicrosoftTeams,
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => ['url' => self::MicrosoftTeamsUrl],
            'settings' => ['host' => 'prod-12.westeurope.logic.azure.com', 'channelLabel' => '#retros'],
            'scopes' => [],
        ]);
    }

    public function mattermost(): static
    {
        return $this->state(fn () => [
            'provider' => IntegrationProvider::Mattermost,
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => ['url' => self::MattermostUrl],
            'settings' => ['host' => 'chat.example.com', 'channelLabel' => 'town-square'],
            'scopes' => [],
        ]);
    }
```

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Integrations/ChatWebhookClientsTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\TeamIntegration;
use App\Rules\MattermostWebhookUrl;
use App\Rules\MicrosoftTeamsWebhookUrl;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationErrors;
use App\Support\Integrations\Mattermost\MattermostClient;
use App\Support\Integrations\MicrosoftTeams\MicrosoftTeamsClient;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost);
});

function teamsIntegration(): TeamIntegration
{
    return TeamIntegration::factory()->microsoftTeams()->create();
}

function mattermostIntegration(): TeamIntegration
{
    return TeamIntegration::factory()->mattermost()->create();
}

it('accepts only Teams workflow URLs', function (string $url, bool $valid) {
    expect(MicrosoftTeamsWebhookUrl::isValid($url))->toBe($valid);
})->with([
    'logic apps' => [TeamIntegrationFactory::MicrosoftTeamsUrl, true],
    'power platform' => ['https://default1a2b.3c.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/abc/triggers/manual/paths/invoke?sig=x', true],
    'http' => ['http://prod-12.westeurope.logic.azure.com/workflows/abc', false],
    'other port' => ['https://prod-12.westeurope.logic.azure.com:8443/workflows/abc', false],
    'user info' => ['https://user:pass@prod-12.westeurope.logic.azure.com/workflows/abc', false],
    'suffix trick' => ['https://prod-12.logic.azure.com.evil.example/workflows/abc', false],
    'bare domain' => ['https://logic.azure.com/workflows/abc', false],
    'query trick' => ['https://evil.example/?next=x.logic.azure.com', false],
    'unlisted host' => ['https://teams-proxy.example.com/hook', false],
    'not a url' => ['teams', false],
]);

it('accepts Teams hosts the instance allows', function () {
    config(['services.msteams.allowed_hosts' => ['teams-proxy.example.com']]);

    expect(MicrosoftTeamsWebhookUrl::isValid('https://teams-proxy.example.com/hook'))->toBeTrue()
        ->and(MicrosoftTeamsWebhookUrl::isValid('https://other.example.com/hook'))->toBeFalse();
});

it('accepts only incoming webhooks of the configured Mattermost server', function (string $url, bool $valid) {
    expect(MattermostWebhookUrl::isValid($url))->toBe($valid);
})->with([
    'webhook' => [TeamIntegrationFactory::MattermostUrl, true],
    'digits' => ['https://chat.example.com/hooks/abc123def456ghi789jkl012mn', true],
    '25 characters' => ['https://chat.example.com/hooks/abcdefghijklmnopqrstuvwxy', false],
    '27 characters' => ['https://chat.example.com/hooks/abcdefghijklmnopqrstuvwxyza', false],
    'other server' => ['https://evil.example.com/hooks/abcdefghijklmnopqrstuvwxyz', false],
    'http' => ['http://chat.example.com/hooks/abcdefghijklmnopqrstuvwxyz', false],
    'api path' => ['https://chat.example.com/api/v4/hooks/abcdefghijklmnopqrstuvwxyz', false],
    'query' => ['https://chat.example.com/hooks/abcdefghijklmnopqrstuvwxyz?x=1', false],
    'server prefix trick' => ['https://chat.example.com.evil.example/hooks/abcdefghijklmnopqrstuvwxyz', false],
]);

it('accepts Mattermost servers under a context path', function () {
    config(['services.mattermost.url' => 'https://example.com/mattermost']);

    expect(MattermostWebhookUrl::isValid('https://example.com/mattermost/hooks/abcdefghijklmnopqrstuvwxyz'))->toBeTrue()
        ->and(MattermostWebhookUrl::isValid(TeamIntegrationFactory::MattermostUrl))->toBeFalse();
});

it('posts Teams messages to the stored workflow URL', function () {
    Http::fake(['prod-12.westeurope.logic.azure.com/*' => Http::response('', 202)]);

    app(MicrosoftTeamsClient::class)->postMessage(teamsIntegration(), ['type' => 'message', 'attachments' => []]);

    Http::assertSent(fn (Request $request) => $request->url() === TeamIntegrationFactory::MicrosoftTeamsUrl
        && $request['type'] === 'message');
});

it('asks to paste a new Teams URL when the workflow is gone', function (int $status) {
    Http::fake(['prod-12.westeurope.logic.azure.com/*' => Http::response('{"error":{"code":"WorkflowNotFound"}}', $status)]);
    $integration = teamsIntegration();

    expect(fn () => app(MicrosoftTeamsClient::class)->postMessage($integration, ['type' => 'message']))
        ->toThrow(ReconnectRequired::class);

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->last_error)->toBe('The Teams workflow URL no longer works. Paste a new one.');
})->with([400, 401, 403, 404]);

it('maps Teams rate limits, outages and redirects', function () {
    $integration = teamsIntegration();

    Http::fakeSequence('prod-12.westeurope.logic.azure.com/*')
        ->push('', 429, ['Retry-After' => '12'])
        ->push('', 503)
        ->push('', 302, ['Location' => 'https://evil.example/'])
        ->push('', 202);

    $rateLimited = null;

    try {
        app(MicrosoftTeamsClient::class)->postMessage($integration, ['type' => 'message']);
    } catch (RateLimited $exception) {
        $rateLimited = $exception;
    }

    expect($rateLimited?->retryAfter)->toBe(12)
        ->and(fn () => app(MicrosoftTeamsClient::class)->postMessage($integration, ['type' => 'message']))->toThrow(ProviderUnavailable::class)
        ->and(fn () => app(MicrosoftTeamsClient::class)->postMessage($integration, ['type' => 'message']))->toThrow(ProviderRejected::class);

    Http::assertSentCount(3);
    expect($integration->fresh()->status)->toBe(IntegrationStatus::Active);
});

it('refuses a stored URL the instance no longer allows without calling it', function () {
    config(['services.msteams.allowed_hosts' => ['teams-proxy.example.com']]);
    $teams = TeamIntegration::factory()->microsoftTeams()->create(['credentials' => ['url' => 'https://teams-proxy.example.com/hook']]);
    $mattermost = mattermostIntegration();
    config(['services.msteams.allowed_hosts' => [], 'services.mattermost.url' => 'https://mattermost.example.org']);

    expect(fn () => app(MicrosoftTeamsClient::class)->postMessage($teams, ['type' => 'message']))->toThrow(ReconnectRequired::class)
        ->and(fn () => app(MattermostClient::class)->postMessage($mattermost, 'hello'))->toThrow(ReconnectRequired::class);

    Http::assertNothingSent();
    expect($teams->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($mattermost->fresh()->last_error)->toBe('The Mattermost webhook no longer works. Paste a new one.');
});

it('posts Mattermost messages as text', function () {
    Http::fake(['chat.example.com/*' => Http::response('ok')]);

    app(MattermostClient::class)->postMessage(mattermostIntegration(), '**hello**');

    Http::assertSent(fn (Request $request) => $request->url() === TeamIntegrationFactory::MattermostUrl
        && $request->data() === ['text' => '**hello**']);
});

it('asks to paste a new Mattermost webhook only when it is gone', function (int $status, string $body, bool $reconnect) {
    Http::fake(['chat.example.com/*' => Http::response($body, $status)]);
    $integration = mattermostIntegration();

    expect(fn () => app(MattermostClient::class)->postMessage($integration, 'hello'))
        ->toThrow($reconnect ? ReconnectRequired::class : ProviderRejected::class);

    expect($integration->fresh()->status)->toBe($reconnect ? IntegrationStatus::ReconnectRequired : IntegrationStatus::Active);
})->with([
    'invalid webhook' => [400, '{"id":"web.incoming_webhook.invalid.app_error","message":"Invalid webhook"}', true],
    'other 400' => [400, '{"message":"Unable to parse incoming data"}', false],
    'forbidden' => [403, '', true],
    'not found' => [404, '', true],
]);

it('retries Mattermost outages', function () {
    Http::fake(['chat.example.com/*' => Http::response('', 503)]);

    expect(fn () => app(MattermostClient::class)->postMessage(mattermostIntegration(), 'hello'))->toThrow(ProviderUnavailable::class);
});

it('never exposes webhook keys in errors', function () {
    Http::fake(['*' => Http::failedConnection('cURL error 28: timed out for '.TeamIntegrationFactory::MicrosoftTeamsUrl.' and '.TeamIntegrationFactory::MattermostUrl)]);
    $unavailable = null;

    try {
        app(MicrosoftTeamsClient::class)->postMessage(teamsIntegration(), ['type' => 'message']);
    } catch (ProviderUnavailable $exception) {
        $unavailable = $exception;
    }

    expect($unavailable?->timedOut)->toBeTrue()
        ->and($unavailable?->detail())->toContain('prod-12.westeurope.logic.azure.com')
        ->and($unavailable?->detail())->not->toContain('teams-signature')
        ->and($unavailable?->detail())->not->toContain('workflows/abc123')
        ->and($unavailable?->detail())->not->toContain('abcdefghijklmnopqrstuvwxyz')
        ->and(IntegrationErrors::sanitize('POST '.TeamIntegrationFactory::MattermostUrl.' failed'))
        ->toBe('POST https://chat.example.com/hooks/*** failed')
        ->and(IntegrationErrors::sanitize('POST '.TeamIntegrationFactory::MicrosoftTeamsUrl.' failed'))
        ->toBe('POST https://prod-12.westeurope.logic.azure.com:443/*** failed');
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ChatWebhookClientsTest.php`
Expected: FAIL — `Class "App\Rules\MicrosoftTeamsWebhookUrl" not found`.

- [ ] **Step 4: Implement the rules**

Create `app/Rules/MicrosoftTeamsWebhookUrl.php`:

```php
<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Spec 8 §4.3: a Teams Workflows webhook, checked on save and before each send.
 */
class MicrosoftTeamsWebhookUrl implements ValidationRule
{
    private const MaxLength = 2048;

    /**
     * @var array<int, string>
     */
    private const HostSuffixes = ['.logic.azure.com', '.api.powerplatform.com'];

    public static function isValid(mixed $url): bool
    {
        if (! is_string($url) || strlen($url) > self::MaxLength || filter_var($url, FILTER_VALIDATE_URL) === false) {
            return false;
        }

        $parts = parse_url($url);

        if (! is_array($parts) || ($parts['scheme'] ?? null) !== 'https') {
            return false;
        }

        if (isset($parts['user']) || isset($parts['pass'])) {
            return false;
        }

        if (($parts['port'] ?? 443) !== 443) {
            return false;
        }

        $host = strtolower((string) ($parts['host'] ?? ''));

        if (in_array($host, (array) config('services.msteams.allowed_hosts', []), true)) {
            return true;
        }

        foreach (self::HostSuffixes as $suffix) {
            if (str_ends_with($host, $suffix)) {
                return true;
            }
        }

        return false;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! self::isValid($value)) {
            $fail(__('Use the workflow URL from Microsoft Teams.'));
        }
    }
}
```

Create `app/Rules/MattermostWebhookUrl.php`:

```php
<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Spec 8 §4.4: an incoming webhook of the one configured Mattermost server.
 */
class MattermostWebhookUrl implements ValidationRule
{
    public static function serverUrl(): string
    {
        return rtrim((string) config('services.mattermost.url'), '/');
    }

    public static function isValid(mixed $url): bool
    {
        $server = self::serverUrl();

        if (! is_string($url) || $server === '') {
            return false;
        }

        return preg_match('#^'.preg_quote($server, '#').'/hooks/[A-Za-z0-9]{26}$#', $url) === 1;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! self::isValid($value)) {
            $fail(__('Use an incoming webhook of :url.', ['url' => self::serverUrl()]));
        }
    }
}
```

- [ ] **Step 5: Implement the clients**

Create `app/Support/Integrations/MicrosoftTeams/MicrosoftTeamsClient.php`:

```php
<?php

namespace App\Support\Integrations\MicrosoftTeams;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Rules\MicrosoftTeamsWebhookUrl;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\ProviderHttp;

class MicrosoftTeamsClient
{
    /**
     * @var array<int, int>
     */
    private const LostWorkflowStatuses = [400, 401, 403, 404];

    /**
     * @param  array<string, mixed>  $message
     */
    public function postMessage(TeamIntegration $integration, array $message): void
    {
        $integration->withReconnectHandling(function () use ($integration, $message): void {
            $url = $this->workflowUrl($integration);

            $response = ProviderHttp::send(
                IntegrationProvider::MicrosoftTeams,
                fn () => ProviderHttp::request()->withoutRedirecting()->post($url, $message),
            );

            if ($response->successful()) {
                return;
            }

            if (in_array($response->status(), self::LostWorkflowStatuses, true)) {
                throw $this->lostWorkflow();
            }

            ProviderHttp::fail(IntegrationProvider::MicrosoftTeams, $response);
        });
    }

    public function ensureUsableUrl(TeamIntegration $integration): void
    {
        $integration->withReconnectHandling(fn (): string => $this->workflowUrl($integration));
    }

    private function workflowUrl(TeamIntegration $integration): string
    {
        $url = $integration->credential('url');

        if (! is_string($url) || ! MicrosoftTeamsWebhookUrl::isValid($url)) {
            throw $this->lostWorkflow();
        }

        return $url;
    }

    private function lostWorkflow(): ReconnectRequired
    {
        return new ReconnectRequired(IntegrationProvider::MicrosoftTeams, __('The Teams workflow URL no longer works. Paste a new one.'));
    }
}
```

Create `app/Support/Integrations/Mattermost/MattermostClient.php`:

```php
<?php

namespace App\Support\Integrations\Mattermost;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Rules\MattermostWebhookUrl;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\ProviderHttp;
use Illuminate\Http\Client\Response;

class MattermostClient
{
    /**
     * @var array<int, int>
     */
    private const LostWebhookStatuses = [403, 404];

    public function postMessage(TeamIntegration $integration, string $text): void
    {
        $integration->withReconnectHandling(function () use ($integration, $text): void {
            $url = $this->webhookUrl($integration);

            $response = ProviderHttp::send(
                IntegrationProvider::Mattermost,
                fn () => ProviderHttp::request()->withoutRedirecting()->post($url, ['text' => $text]),
            );

            if ($response->successful()) {
                return;
            }

            if ($this->isLostWebhook($response)) {
                throw $this->lostWebhook();
            }

            ProviderHttp::fail(IntegrationProvider::Mattermost, $response);
        });
    }

    public function ensureUsableUrl(TeamIntegration $integration): void
    {
        $integration->withReconnectHandling(fn (): string => $this->webhookUrl($integration));
    }

    private function webhookUrl(TeamIntegration $integration): string
    {
        $url = $integration->credential('url');

        if (! is_string($url) || ! MattermostWebhookUrl::isValid($url)) {
            throw $this->lostWebhook();
        }

        return $url;
    }

    private function isLostWebhook(Response $response): bool
    {
        if (in_array($response->status(), self::LostWebhookStatuses, true)) {
            return true;
        }

        return $response->status() === 400 && str_contains(strtolower($response->body()), 'invalid webhook');
    }

    private function lostWebhook(): ReconnectRequired
    {
        return new ReconnectRequired(IntegrationProvider::Mattermost, __('The Mattermost webhook no longer works. Paste a new one.'));
    }
}
```

In `app/Support/Integrations/IntegrationErrors.php`, add these two entries to `Patterns` right after the Slack one (before the query-string pattern):

```php
        '#(https://[^\s/"\']+\.(?:logic\.azure\.com|api\.powerplatform\.com)(?::\d+)?)/[^\s"\']*#i' => '$1/***',
        '#(https?://[^\s"\']+?)/hooks/[A-Za-z0-9]+#i' => '$1/hooks/***',
```

- [ ] **Step 6: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Use the workflow URL from Microsoft Teams.` | `Utilisez l'URL du workflow fournie par Microsoft Teams.` | `Usa la URL del flujo de trabajo de Microsoft Teams.` | `Verwende die Workflow-URL aus Microsoft Teams.` |
| `Use an incoming webhook of :url.` | `Utilisez un webhook entrant de :url.` | `Usa un webhook entrante de :url.` | `Verwende einen eingehenden Webhook von :url.` |
| `The Teams workflow URL no longer works. Paste a new one.` | `L'URL du workflow Teams ne fonctionne plus. Collez-en une nouvelle.` | `La URL del flujo de trabajo de Teams ya no funciona. Pega una nueva.` | `Die Teams-Workflow-URL funktioniert nicht mehr. Füge eine neue ein.` |
| `The Mattermost webhook no longer works. Paste a new one.` | `Le webhook Mattermost ne fonctionne plus. Collez-en un nouveau.` | `El webhook de Mattermost ya no funciona. Pega uno nuevo.` | `Der Mattermost-Webhook funktioniert nicht mehr. Füge einen neuen ein.` |

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ChatWebhookClientsTest.php tests/Feature/Integrations/IntegrationErrorsTest.php tests/Feature/Integrations/SlackClientTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 8: Commit**

```bash
git add app/Rules/MicrosoftTeamsWebhookUrl.php app/Rules/MattermostWebhookUrl.php app/Support/Integrations/MicrosoftTeams/MicrosoftTeamsClient.php app/Support/Integrations/Mattermost/MattermostClient.php app/Support/Integrations/IntegrationErrors.php database/factories/TeamIntegrationFactory.php tests/Feature/Integrations/ChatWebhookClientsTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): validate and post to Teams and Mattermost webhooks

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 6: Connect, update, test, check and disconnect Teams and Mattermost

**Files:**
- Create: `app/Actions/Integrations/ConnectUrlChannel.php`, `app/Http/Controllers/Integrations/IntegrationUrlsController.php` (with `vendor/bin/sail artisan make:controller Integrations/IntegrationUrlsController --no-interaction`)
- Modify: `app/Actions/Integrations/{UpdateTeamIntegration,CheckIntegration}.php`, `app/Http/Controllers/Integrations/{TeamIntegrationsController,IntegrationTestsController}.php`, `routes/web.php`
- Test: create `tests/Feature/Integrations/ConnectUrlChannelTest.php`

**Interfaces:**
- Consumes: `SaveTeamIntegration`, `PresentTeamIntegration` (Task 1 keys), rules and clients (Task 5), `MicrosoftTeamsText`/`MattermostText` (Task 4), `TeamPolicy::manageIntegrations`, `EnsureIntegrationProviderEnabled`.
- Produces: `ConnectUrlChannel`, route `teams.integrations.urls.store`, the PATCH branch, page prop `mattermost`, Test/Check arms for Teams and Mattermost (Contract).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/ConnectUrlChannelTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost);
});

/**
 * @return array{0: Team, 1: User}
 */
function urlChannelAdmin(): array
{
    $team = Team::factory()->create();

    return [$team, integrationAdmin($team)];
}

it('connects Microsoft Teams with a pasted workflow URL', function () {
    [$team, $admin] = urlChannelAdmin();

    $response = $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'msteams']), [
            'url' => TeamIntegrationFactory::MicrosoftTeamsUrl,
            'channel_label' => '  #retros  ',
        ]);

    $response->assertCreated()
        ->assertJson([
            'provider' => 'msteams',
            'status' => 'active',
            'access' => 'write',
            'settings' => ['host' => 'prod-12.westeurope.logic.azure.com', 'channelLabel' => '#retros'],
            'connectedBy' => $admin->name,
        ]);

    expect($response->getContent())->not->toContain('teams-signature')->not->toContain('workflows');

    $integration = TeamIntegration::query()->sole();
    expect($integration->credential('url'))->toBe(TeamIntegrationFactory::MicrosoftTeamsUrl)
        ->and($integration->getRawOriginal('credentials'))->not->toContain('teams-signature');
    Http::assertNothingSent();
});

it('connects Mattermost with an incoming webhook of the configured server', function () {
    [$team, $admin] = urlChannelAdmin();

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'mattermost']), ['url' => TeamIntegrationFactory::MattermostUrl])
        ->assertCreated()
        ->assertJson(['provider' => 'mattermost', 'settings' => ['host' => 'chat.example.com', 'channelLabel' => null]]);
});

it('refuses URLs that break the rules', function (string $provider, array $body, string $field, string $message) {
    [$team, $admin] = urlChannelAdmin();

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, $provider]), $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);

    expect(TeamIntegration::query()->count())->toBe(0);
})->with([
    'teams host' => ['msteams', ['url' => 'https://evil.example.com/workflows/abc'], 'url', 'Use the workflow URL from Microsoft Teams.'],
    'teams http' => ['msteams', ['url' => 'http://prod-12.westeurope.logic.azure.com/workflows/abc'], 'url', 'Use the workflow URL from Microsoft Teams.'],
    'mattermost server' => ['mattermost', ['url' => 'https://evil.example.com/hooks/abcdefghijklmnopqrstuvwxyz'], 'url', 'Use an incoming webhook of https://chat.example.com.'],
    'missing url' => ['mattermost', [], 'url', 'The url field is required.'],
    'long label' => ['msteams', ['url' => TeamIntegrationFactory::MicrosoftTeamsUrl, 'channel_label' => str_repeat('a', 81)], 'channel_label', 'The channel label field must not be greater than 80 characters.'],
]);

it('answers 404 while the provider is disabled or not a URL channel', function () {
    [$team, $admin] = urlChannelAdmin();
    config(['services.msteams.enabled' => false]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'msteams']), ['url' => TeamIntegrationFactory::MicrosoftTeamsUrl])
        ->assertNotFound();
    $this->actingAs($admin)
        ->postJson("/w/{$team->workspace->slug}/teams/{$team->id}/integrations/slack", ['url' => 'https://hooks.slack.com/x'])
        ->assertNotFound();
    $this->actingAs($admin)
        ->postJson("/w/{$team->workspace->slug}/teams/{$team->id}/integrations/webhook", ['url' => 'https://example.com/hook'])
        ->assertNotFound();
});

it('is reserved to workspace owners and admins, before validation', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'msteams']), ['url' => 'nope'])
        ->assertForbidden();
});

it('replaces a connection and clears reconnect-required', function () {
    [$team, $admin] = urlChannelAdmin();
    TeamIntegration::factory()->mattermost()->reconnectRequired('The Mattermost webhook no longer works. Paste a new one.')->create(['team_id' => $team->id]);
    $newUrl = 'https://chat.example.com/hooks/zyxwvutsrqponmlkjihgfedcba';

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'mattermost']), ['url' => $newUrl, 'channel_label' => 'dev'])
        ->assertCreated()
        ->assertJson(['status' => 'active', 'lastError' => null, 'settings' => ['channelLabel' => 'dev']]);

    $integration = TeamIntegration::query()->sole();
    expect($integration->credential('url'))->toBe($newUrl);
});

it('updates the channel label or the URL', function () {
    [$team, $admin] = urlChannelAdmin();
    $integration = TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);
    $url = route('teams.integrations.update', [$team->workspace, $team, $integration]);

    $this->actingAs($admin)->patchJson($url, ['channel_label' => 'Planning'])
        ->assertOk()
        ->assertJson(['settings' => ['host' => 'prod-12.westeurope.logic.azure.com', 'channelLabel' => 'Planning']]);

    expect($integration->fresh()->credential('url'))->toBe(TeamIntegrationFactory::MicrosoftTeamsUrl);

    $newUrl = 'https://default1a2b.3c.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/new/triggers/manual/paths/invoke?sig=new';

    $this->actingAs($admin)->patchJson($url, ['url' => $newUrl])
        ->assertOk()
        ->assertJson(['settings' => ['host' => 'default1a2b.3c.environment.api.powerplatform.com', 'channelLabel' => 'Planning']]);
    $this->actingAs($admin)->patchJson($url, ['url' => 'https://evil.example.com/x'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['url' => 'Use the workflow URL from Microsoft Teams.']);

    expect($integration->fresh()->credential('url'))->toBe($newUrl);
});

it('never serializes the stored URL on the integrations page', function () {
    [$team, $admin] = urlChannelAdmin();
    TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->mattermost()->create(['team_id' => $team->id]);

    $this->actingAs($admin)
        ->get(route('teams.integrations.index', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/integrations')
            ->where('providers.0.provider', 'msteams')
            ->where('providers.0.usesOAuth', false)
            ->where('providers.0.connection.settings', ['host' => 'prod-12.westeurope.logic.azure.com', 'channelLabel' => '#retros'])
            ->where('providers.1.provider', 'mattermost')
            ->where('providers.1.connection.settings', ['host' => 'chat.example.com', 'channelLabel' => 'town-square'])
            ->where('mattermost', ['url' => 'https://chat.example.com']))
        ->assertDontSee('teams-signature')
        ->assertDontSee('abcdefghijklmnopqrstuvwxyz');
});

it('sends a test message to each channel', function () {
    [$team, $admin] = urlChannelAdmin();
    $teams = TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);
    $mattermost = TeamIntegration::factory()->mattermost()->create(['team_id' => $team->id]);
    Http::fake([
        'prod-12.westeurope.logic.azure.com/*' => Http::response('', 202),
        'chat.example.com/*' => Http::response('ok'),
    ]);

    $this->actingAs($admin)->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $teams]))->assertOk();
    $this->actingAs($admin)->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $mattermost]))->assertOk();

    Http::assertSent(fn (Request $request) => str_contains($request->url(), 'logic.azure.com')
        && $request['attachments'][0]['content']['body'][0]['text'] === 'skrum is connected.'
        && ! isset($request['attachments'][0]['content']['actions']));
    Http::assertSent(fn (Request $request) => str_contains($request->url(), 'chat.example.com')
        && $request['text'] === 'skrum is connected.');
    expect($teams->fresh()->last_checked_at)->not->toBeNull();
});

it('marks a lost Teams workflow when the test fails', function () {
    [$team, $admin] = urlChannelAdmin();
    $integration = TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);
    Http::fake(['prod-12.westeurope.logic.azure.com/*' => Http::response('', 404)]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $integration]))
        ->assertConflict()
        ->assertJson(['message' => 'Reconnect Microsoft Teams in the team settings.']);

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->last_error)->toBe('The Teams workflow URL no longer works. Paste a new one.');
});

it('disconnects without calling the provider', function () {
    [$team, $admin] = urlChannelAdmin();
    $integration = TeamIntegration::factory()->mattermost()->create(['team_id' => $team->id]);

    $this->actingAs($admin)
        ->deleteJson(route('teams.integrations.destroy', [$team->workspace, $team, $integration]))
        ->assertNoContent();

    expect(TeamIntegration::query()->count())->toBe(0);
    Http::assertNothingSent();
});

it('re-validates stored URLs in the daily check without posting', function () {
    $teams = TeamIntegration::factory()->microsoftTeams()->create();
    $mattermost = TeamIntegration::factory()->mattermost()->create();
    config(['services.mattermost.url' => 'https://mattermost.example.org']);

    $this->artisan('skrum:check-integrations')->assertSuccessful();

    expect($teams->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and($teams->fresh()->last_checked_at)->not->toBeNull()
        ->and($mattermost->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
    Http::assertNothingSent();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ConnectUrlChannelTest.php`
Expected: FAIL — `Route [teams.integrations.urls.store] not defined.`

- [ ] **Step 3: Implement the action**

Create `app/Actions/Integrations/ConnectUrlChannel.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Rules\MattermostWebhookUrl;
use App\Rules\MicrosoftTeamsWebhookUrl;
use Illuminate\Contracts\Validation\ValidationRule;
use InvalidArgumentException;

/**
 * Teams and Mattermost connect with a pasted webhook URL (spec 8 §4.3, §4.4).
 * The URL is a secret: only its host and the admin's label are shown.
 */
class ConnectUrlChannel
{
    public const LabelMaxLength = 80;

    public function __construct(private SaveTeamIntegration $saveTeamIntegration) {}

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(IntegrationProvider $provider, bool $isUpdate = false): array
    {
        $url = ['required', 'string', 'max:2048', $this->urlRule($provider)];

        return [
            'url' => $isUpdate ? ['sometimes', ...$url] : $url,
            'channel_label' => ['sometimes', 'nullable', 'string', 'max:'.self::LabelMaxLength],
        ];
    }

    public function handle(Team $team, IntegrationProvider $provider, User $user, string $url, ?string $channelLabel): TeamIntegration
    {
        return $this->saveTeamIntegration->handle($team, $provider, $user, [
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => ['url' => $url],
            'settings' => [
                'host' => strtolower((string) parse_url($url, PHP_URL_HOST)),
                'channelLabel' => self::label($channelLabel),
            ],
            'scopes' => [],
        ]);
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function update(TeamIntegration $integration, User $user, array $validated): TeamIntegration
    {
        $label = array_key_exists('channel_label', $validated)
            ? $validated['channel_label']
            : $integration->setting('channelLabel');
        $label = is_string($label) ? $label : null;

        if (is_string($validated['url'] ?? null)) {
            return $this->handle($integration->team, $integration->provider, $user, $validated['url'], $label);
        }

        $integration->forceFill(['settings' => [...$integration->settings, 'channelLabel' => self::label($label)]])->save();

        return $integration;
    }

    private static function label(?string $label): ?string
    {
        $trimmed = trim((string) $label);

        return $trimmed === '' ? null : $trimmed;
    }

    private function urlRule(IntegrationProvider $provider): ValidationRule
    {
        return match ($provider) {
            IntegrationProvider::MicrosoftTeams => new MicrosoftTeamsWebhookUrl,
            IntegrationProvider::Mattermost => new MattermostWebhookUrl,
            default => throw new InvalidArgumentException("{$provider->value} does not connect with a URL."),
        };
    }
}
```

- [ ] **Step 4: Add the controller and the route**

`app/Http/Controllers/Integrations/IntegrationUrlsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\ConnectUrlChannel;
use App\Actions\Integrations\PresentTeamIntegration;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class IntegrationUrlsController extends Controller
{
    public function store(
        Request $request,
        Workspace $workspace,
        Team $team,
        IntegrationProvider $provider,
        ConnectUrlChannel $connectUrlChannel,
        PresentTeamIntegration $presentTeamIntegration,
    ): JsonResponse {
        Gate::authorize('manageIntegrations', $team);

        $validated = $request->validate($connectUrlChannel->rules($provider));

        $integration = $connectUrlChannel->handle(
            $team,
            $provider,
            $request->user(),
            $validated['url'],
            $validated['channel_label'] ?? null,
        );

        return response()->json($presentTeamIntegration->handle($integration->load('connectedBy')), 201);
    }
}
```

In `routes/web.php`, add `use App\Http\Controllers\Integrations\IntegrationUrlsController;` (alphabetical) and, inside the `Route::middleware(EnsureIntegrationProviderEnabled::class)->group(…)` of the `w/{workspace}` group, right after the `telegramCode.store` route:

```php
                Route::post('teams/{team}/integrations/{provider}', [IntegrationUrlsController::class, 'store'])
                    ->whereIn('provider', ['msteams', 'mattermost'])
                    ->middleware('throttle:10,1,integrationUrls')
                    ->name('teams.integrations.urls.store');
```

(The group's `EnsureIntegrationProviderEnabled` reads `{provider}` and answers 404 while it is disabled; `webhook` and other values do not match the route and also 404.)

- [ ] **Step 5: Wire update, test, check and the page prop**

`UpdateTeamIntegration`: add `private ConnectUrlChannel $connectUrlChannel,` to the constructor; in `rules()` add the arm

```php
            IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost => $this->connectUrlChannel->rules($integration->provider, isUpdate: true),
```

and at the top of `handle()`:

```php
        if (in_array($integration->provider, [IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost], true)) {
            return $this->connectUrlChannel->update($integration, $user, $validated)->refresh();
        }
```

`CheckIntegration`: inject `private MicrosoftTeamsClient $teams, private MattermostClient $mattermost`; replace the Task 1 arm with

```php
            IntegrationProvider::MicrosoftTeams => fn () => $this->teams->ensureUsableUrl($integration),
            IntegrationProvider::Mattermost => fn () => $this->mattermost->ensureUsableUrl($integration),
            IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub, IntegrationProvider::Webhook => throw new NotConnected($integration->provider),
```

`IntegrationTestsController::store()`: add parameters `MicrosoftTeamsClient $teams, MattermostClient $mattermost` and replace the Task 1 arm with

```php
            IntegrationProvider::MicrosoftTeams => fn () => $teams->postMessage($integration, MicrosoftTeamsText::message([MicrosoftTeamsText::block($message)])),
            IntegrationProvider::Mattermost => fn () => $mattermost->postMessage($integration, MattermostText::escape($message)),
            IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub, IntegrationProvider::Webhook => throw new NotConnected($integration->provider),
```

(`isChannel()` is true for both, so the existing `markChecked()` runs after a successful test.)

`TeamIntegrationsController::index()`: add the prop after `'telegram'`:

```php
            'mattermost' => IntegrationProvider::Mattermost->isEnabled() ? ['url' => MattermostWebhookUrl::serverUrl()] : null,
```

Then regenerate Wayfinder: `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ConnectUrlChannelTest.php tests/Feature/Integrations/IntegrationsPageTest.php tests/Feature/Integrations/IntegrationMaintenanceTest.php tests/Feature/Integrations/ConnectJiraTest.php tests/Feature/Integrations/PriorityMappingTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 7: Commit**

```bash
git add app/Actions/Integrations/ConnectUrlChannel.php app/Http/Controllers/Integrations/IntegrationUrlsController.php app/Actions/Integrations/UpdateTeamIntegration.php app/Actions/Integrations/CheckIntegration.php app/Http/Controllers/Integrations/IntegrationTestsController.php app/Http/Controllers/Integrations/TeamIntegrationsController.php routes/web.php tests/Feature/Integrations/ConnectUrlChannelTest.php
git commit -m "feat(integrations): connect teams to Microsoft Teams and Mattermost channels

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 7: Share links, room invites and recaps to Teams and Mattermost

**Files:**
- Create: `app/Jobs/Integrations/DeliverToMicrosoftTeams.php`, `app/Jobs/Integrations/DeliverToMattermost.php`
- Modify: `app/Enums/IntegrationDeliveryChannel.php` (`shareChannels()`), `app/Actions/Integrations/{QueueShare,ShareOptions}.php`, `app/Actions/Games/GameRoomShares.php`, `tests/Feature/Integrations/ShareSnapshotTest.php`, `tests/Feature/Games/GameRoomSharesTest.php`
- Test: create `tests/Feature/Integrations/ChatChannelSharesTest.php`

**Interfaces:**
- Consumes: the share controllers of Plans 12b/13d (unchanged: they validate `channel` against `shareChannels()` and 404 on a disabled provider), `DeliverToChannel`, clients (Task 5), `ShareContent` (Task 4), `BuildLinkShare`, `BuildRetroRecap`.
- Produces: jobs, five-channel `ShareOptions`/`GameRoomShares` availability (Contract).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/ChatChannelSharesTest.php`:

```php
<?php

use App\Actions\Games\GameRoomShares;
use App\Actions\Integrations\ShareOptions;
use App\Enums\GameKind;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoomChanged;
use App\Jobs\Integrations\DeliverToChannel;
use App\Jobs\Integrations\DeliverToMattermost;
use App\Jobs\Integrations\DeliverToMicrosoftTeams;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\IntegrationDelivery;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost);
});

function connectChatChannels(string $teamId): void
{
    TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $teamId]);
    TeamIntegration::factory()->mattermost()->create(['team_id' => $teamId]);
}

/**
 * @return array{0: Retro, 1: User, 2: Participant}
 */
function chatConnectedRetro(RetroPhase $phase = RetroPhase::Discussing): array
{
    $retro = Retro::factory()->inPhase($phase)->create([
        'title' => 'Sprint *42*',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
    ]);
    connectChatChannels($retro->team_id);
    [$facilitator, $participant] = retroFacilitator($retro);
    $facilitator->forceFill(['name' => 'Fran Facilitator'])->save();

    return [$retro, $facilitator, $participant];
}

/**
 * @return array{0: PokerGame, 1: User}
 */
function chatConnectedPokerGame(): array
{
    $game = PokerGame::factory()->create(['title' => 'Sprint 12 sizing']);
    connectChatChannels($game->team_id);
    [$facilitator] = pokerFacilitator($game);

    return [$game, $facilitator];
}

/**
 * @return array{0: GameRoom, 1: User}
 */
function chatConnectedGameRoom(array $attributes = []): array
{
    $room = GameRoom::factory()->create([
        'name' => 'Friday fun',
        'game' => GameKind::Hangman,
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    connectChatChannels($room->team_id);
    [$host] = gameRoomHost($room);
    $host->forceFill(['name' => 'Hana Host'])->save();

    return [$room, $host];
}

function chatDelivery(IntegrationDeliveryChannel $channel, ?GameRoom $room = null): IntegrationDelivery
{
    $room ??= chatConnectedGameRoom()[0];

    return IntegrationDelivery::factory()->forSubject($room)->create([
        'channel' => $channel,
        'kind' => 'game_room_link',
    ]);
}

function runChatDeliveryJob(DeliverToChannel $job): DeliverToChannel
{
    $job->withFakeQueueInteractions();
    $job->handle();

    return $job;
}

it('queues board links to Teams and Mattermost', function () {
    [$retro, $facilitator] = chatConnectedRetro();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'msteams', 'kind' => 'link'])
        ->assertAccepted()
        ->assertJson(['channel' => 'msteams', 'kind' => 'retro_link', 'status' => 'queued']);
    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'mattermost', 'kind' => 'link'])
        ->assertAccepted();

    Queue::assertPushed(DeliverToMicrosoftTeams::class, fn (DeliverToMicrosoftTeams $job) => $job->message['attachments'][0]['content']['body'][0]['text'] === 'Fran Facilitator invites you to the retrospective "Sprint \*42\*" \(Platform\)'
        && $job->message['attachments'][0]['content']['actions'][0]['url'] === route('retros.show', $retro));
    Queue::assertPushed(DeliverToMattermost::class, fn (DeliverToMattermost $job) => str_contains($job->text, 'Sprint \*42\*')
        && str_ends_with($job->text, '('.route('retros.show', $retro).')'));
});

it('queues the results recap on a completed retro', function () {
    [$retro, $facilitator] = chatConnectedRetro(RetroPhase::Completed);

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'msteams', 'kind' => 'results'])
        ->assertAccepted()
        ->assertJson(['kind' => 'retro_results']);
    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'mattermost', 'kind' => 'results'])
        ->assertAccepted();

    Queue::assertPushed(DeliverToMicrosoftTeams::class, fn (DeliverToMicrosoftTeams $job) => $job->message['attachments'][0]['content']['body'][0]['text'] === 'Results of the retrospective "Sprint \*42\*"');
    Queue::assertPushed(DeliverToMattermost::class, fn (DeliverToMattermost $job) => str_starts_with($job->text, '#### Results of the retrospective "Sprint \*42\*"'));
});

it('queues poker links to both channels', function () {
    [$game, $facilitator] = chatConnectedPokerGame();

    $this->actingAs($facilitator)->postJson(route('poker.shares.store', $game), ['channel' => 'msteams'])->assertAccepted();
    $this->actingAs($facilitator)->postJson(route('poker.shares.store', $game), ['channel' => 'mattermost'])->assertAccepted();

    Queue::assertPushed(DeliverToMicrosoftTeams::class);
    Queue::assertPushed(DeliverToMattermost::class, fn (DeliverToMattermost $job) => str_contains($job->text, 'Sprint 12 sizing'));
});

it('queues game room invites without players or game state', function () {
    [$room, $host] = chatConnectedGameRoom(['access' => 'link']);
    [$player] = gameRoomMember($room);
    $player->forceFill(['name' => 'Pat Player'])->save();
    activeGameRound($room, ['word' => 'sprint']);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'msteams'])
        ->assertAccepted()
        ->assertJson(['channel' => 'msteams', 'kind' => 'game_room_link']);
    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'mattermost', 'include_guest_link' => true])
        ->assertAccepted();

    Queue::assertPushed(DeliverToMicrosoftTeams::class, function (DeliverToMicrosoftTeams $job) use ($room) {
        $json = json_encode($job->message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return str_contains($json, 'Hana Host invites you to play Hangman in \"Friday fun\" \\\\(Platform\\\\)')
            && $job->message['attachments'][0]['content']['actions'][0] === ['type' => 'Action.OpenUrl', 'title' => 'Join the game', 'url' => route('games.show', $room)]
            && ! str_contains($json, 'Pat Player')
            && ! str_contains($json, 'sprint');
    });
    Queue::assertPushed(DeliverToMattermost::class, fn (DeliverToMattermost $job) => str_contains($job->text, '[Join the game]('.route('games.join.show', $room->guest_token).')')
        && ! str_contains($job->text, 'Pat Player'));
});

it('escapes the room name for Teams and Mattermost', function () {
    [$room, $host] = chatConnectedGameRoom(['name' => '@channel ~town-square [x](http://evil)']);

    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'msteams'])->assertAccepted();
    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'mattermost'])->assertAccepted();

    Queue::assertPushed(DeliverToMicrosoftTeams::class, fn (DeliverToMicrosoftTeams $job) => str_contains(
        $job->message['attachments'][0]['content']['body'][0]['text'],
        '"@channel \~town-square \[x\]\(http://evil\)"',
    ));
    Queue::assertPushed(DeliverToMattermost::class, fn (DeliverToMattermost $job) => str_contains(
        $job->text,
        "\"@\u{200B}channel \\~\u{200B}town-square \\[x\\]\\(http://evil\\)\"",
    ) && ! str_contains($job->text, '@channel'));
});

it('answers 404, 409 and 422 for game room invites to :dataset', function (string $channel, string $label) {
    [$room, $host] = chatConnectedGameRoom();
    $provider = IntegrationDeliveryChannel::from($channel)->provider();

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => $channel, 'include_guest_link' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['include_guest_link' => 'Guest access is off for this room.']);

    TeamIntegration::query()->where('provider', $channel)->update(['status' => IntegrationStatus::ReconnectRequired->value]);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => $channel])
        ->assertConflict()
        ->assertJson(['message' => "Reconnect {$label} in the team settings."]);

    TeamIntegration::query()->where('provider', $channel)->delete();

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => $channel])
        ->assertConflict()
        ->assertJson(['message' => "Connect {$label} in the team settings."]);

    disableIntegrations();

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => $channel])
        ->assertNotFound();

    expect($provider?->label())->toBe($label);
    Queue::assertNothingPushed();
})->with([
    'msteams' => ['msteams', 'Microsoft Teams'],
    'mattermost' => ['mattermost', 'Mattermost'],
]);

it('refuses guests and non-managers before validating', function () {
    [$room] = chatConnectedGameRoom(['access' => 'link']);
    [$member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $this->actingAs($member)
        ->postJson(route('games.shares.store', $room), ['channel' => 'bogus'])
        ->assertForbidden();

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))->withCredentials()
        ->postJson(route('games.shares.store', $room), ['channel' => 'msteams'])
        ->assertForbidden();

    Queue::assertNothingPushed();
});

it('offers the new channels only when available and allowed', function () {
    [$retro, , $facilitatorParticipant] = chatConnectedRetro();
    [, $memberParticipant] = retroMember($retro);
    [$room] = chatConnectedGameRoom();
    $hostPlayer = GamePlayer::query()->where('game_room_id', $room->id)->sole();

    expect(app(ShareOptions::class)->channels($retro->team))->toBe([
        'slack' => false, 'telegram' => false, 'msteams' => true, 'mattermost' => true, 'webhook' => false,
    ])
        ->and(app(ShareOptions::class)->retro($retro, $memberParticipant))->toBe([
            'slack' => false, 'telegram' => false, 'msteams' => false, 'mattermost' => false, 'webhook' => false, 'email' => false,
        ])
        ->and(app(GameRoomShares::class)->availability($room, $hostPlayer))->toBe([
            'slack' => false, 'telegram' => false, 'msteams' => true, 'mattermost' => true, 'webhook' => false,
        ]);

    config(['services.mattermost.url' => '']);
    TeamIntegration::query()->where('team_id', $retro->team_id)->where('provider', 'msteams')->update(['status' => 'reconnect_required']);

    expect(app(ShareOptions::class)->retro($retro->fresh(), $facilitatorParticipant)['msteams'])->toBeFalse()
        ->and(app(ShareOptions::class)->retro($retro->fresh(), $facilitatorParticipant)['mattermost'])->toBeFalse();
});

it('delivers to Teams and tells the room', function () {
    Event::fake([GameRoomChanged::class]);
    Http::fake(['prod-12.westeurope.logic.azure.com/*' => Http::response('', 202)]);
    $delivery = chatDelivery(IntegrationDeliveryChannel::MicrosoftTeams);

    runChatDeliveryJob(new DeliverToMicrosoftTeams($delivery->id, ['type' => 'message', 'attachments' => []], 'en'))
        ->assertNotFailed()
        ->assertNotReleased();

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Sent);
    Event::assertDispatched(GameRoomChanged::class);
});

it('fails a Mattermost delivery whose webhook is gone and marks the connection', function () {
    Http::fake(['chat.example.com/*' => Http::response('', 404)]);
    $delivery = chatDelivery(IntegrationDeliveryChannel::Mattermost);

    runChatDeliveryJob(new DeliverToMattermost($delivery->id, 'hello', 'en'))->assertFailed();

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($delivery->fresh()->error)->toBe('Reconnect Mattermost in the team settings.')
        ->and(TeamIntegration::query()->where('provider', 'mattermost')->sole()->last_error)->toBe('The Mattermost webhook no longer works. Paste a new one.');
});

it('waits for Retry-After on 429 and retries outages', function () {
    Http::fakeSequence('prod-12.westeurope.logic.azure.com/*')
        ->push('', 429, ['Retry-After' => '12'])
        ->push('', 503);
    $delivery = chatDelivery(IntegrationDeliveryChannel::MicrosoftTeams);
    $job = new DeliverToMicrosoftTeams($delivery->id, ['type' => 'message'], 'en');

    runChatDeliveryJob($job)->assertReleased(delay: 12);

    expect(fn () => runChatDeliveryJob(new DeliverToMicrosoftTeams($delivery->id, ['type' => 'message'], 'en')))
        ->toThrow(ProviderUnavailable::class);
    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Queued);
});

it('keeps the webhook URL out of the job payload', function () {
    [$room, $host] = chatConnectedGameRoom();

    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'msteams'])->assertAccepted();
    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'mattermost'])->assertAccepted();

    Queue::assertPushed(DeliverToMicrosoftTeams::class, fn (DeliverToMicrosoftTeams $job) => ! str_contains(serialize($job), 'teams-signature'));
    Queue::assertPushed(DeliverToMattermost::class, fn (DeliverToMattermost $job) => ! str_contains(serialize($job), 'abcdefghijklmnopqrstuvwxyz'));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ChatChannelSharesTest.php`
Expected: FAIL — `Class "App\Jobs\Integrations\DeliverToMicrosoftTeams" not found`.

- [ ] **Step 3: Add the jobs**

Create `app/Jobs/Integrations/DeliverToMicrosoftTeams.php`:

```php
<?php

namespace App\Jobs\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\MicrosoftTeams\MicrosoftTeamsClient;

class DeliverToMicrosoftTeams extends DeliverToChannel
{
    /**
     * @param  array<string, mixed>  $message
     */
    public function __construct(string $deliveryId, public array $message, string $locale)
    {
        parent::__construct($deliveryId, $locale);
    }

    protected function provider(): IntegrationProvider
    {
        return IntegrationProvider::MicrosoftTeams;
    }

    protected function send(TeamIntegration $integration): void
    {
        app(MicrosoftTeamsClient::class)->postMessage($integration, $this->message);
    }
}
```

Create `app/Jobs/Integrations/DeliverToMattermost.php`:

```php
<?php

namespace App\Jobs\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Mattermost\MattermostClient;

class DeliverToMattermost extends DeliverToChannel
{
    public function __construct(string $deliveryId, public string $text, string $locale)
    {
        parent::__construct($deliveryId, $locale);
    }

    protected function provider(): IntegrationProvider
    {
        return IntegrationProvider::Mattermost;
    }

    protected function send(TeamIntegration $integration): void
    {
        app(MattermostClient::class)->postMessage($integration, $this->text);
    }
}
```

- [ ] **Step 4: Route shares to the new channels**

`IntegrationDeliveryChannel::shareChannels()`:

```php
        return [self::Slack, self::Telegram, self::MicrosoftTeams, self::Mattermost, self::Webhook];
```

(`Webhook` is refused with 404 by the share controllers while the provider is disabled — Plan 14b enables it.)

`QueueShare::handle()` — add the arms before `default`:

```php
            IntegrationProvider::MicrosoftTeams => new DeliverToMicrosoftTeams($delivery->id, $content->toMicrosoftTeams(), $locale),
            IntegrationProvider::Mattermost => new DeliverToMattermost($delivery->id, $content->toMattermost(), $locale),
```

`ShareOptions` — replace the constant, `channels()` and the docblocks:

```php
    public const NoChannels = ['slack' => false, 'telegram' => false, 'msteams' => false, 'mattermost' => false, 'webhook' => false];

    /**
     * @return array{slack: bool, telegram: bool, msteams: bool, mattermost: bool, webhook: bool}
     */
    public function channels(Team $team): array
    {
        $team->loadMissing('integrations');

        return [
            'slack' => $this->isActive($team, IntegrationProvider::Slack),
            'telegram' => $this->isActive($team, IntegrationProvider::Telegram),
            'msteams' => $this->isActive($team, IntegrationProvider::MicrosoftTeams),
            'mattermost' => $this->isActive($team, IntegrationProvider::Mattermost),
            'webhook' => $this->isActive($team, IntegrationProvider::Webhook),
        ];
    }
```

and widen the `@return` shapes of `retro()` (`array{slack: bool, telegram: bool, msteams: bool, mattermost: bool, webhook: bool, email: bool}`) and `pokerGame()` (the five-key shape).

`GameRoomShares`: delete its private `NoChannels`, return `ShareOptions::NoChannels` in `availability()`, and widen its `@return` to the five-key shape.

- [ ] **Step 5: Update the existing exact assertions**

In `tests/Feature/Integrations/ShareSnapshotTest.php` and `tests/Feature/Games/GameRoomSharesTest.php`, every exact availability array gains the three keys in this order, e.g. `['slack' => true, 'telegram' => true]` → `['slack' => true, 'telegram' => true, 'msteams' => false, 'mattermost' => false, 'webhook' => false]` and `['slack' => true, 'telegram' => true, 'email' => true]` → `['slack' => true, 'telegram' => true, 'msteams' => false, 'mattermost' => false, 'webhook' => false, 'email' => true]` (find them with `grep -rn "'telegram' => \(true\|false\)" tests`). No other expectation changes.

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ChatChannelSharesTest.php tests/Feature/Integrations/ShareSnapshotTest.php tests/Feature/Games/GameRoomSharesTest.php tests/Feature/Integrations/RetroSharesTest.php tests/Feature/Integrations/PokerSharesTest.php tests/Feature/Integrations/QueueShareTest.php tests/Feature/Integrations/DeliveryJobsTest.php tests/Feature/Games/GameSnapshotTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 7: Commit**

```bash
git add app/Jobs/Integrations/DeliverToMicrosoftTeams.php app/Jobs/Integrations/DeliverToMattermost.php app/Enums/IntegrationDeliveryChannel.php app/Actions/Integrations/QueueShare.php app/Actions/Integrations/ShareOptions.php app/Actions/Games/GameRoomShares.php tests/Feature/Integrations/ChatChannelSharesTest.php tests/Feature/Integrations/ShareSnapshotTest.php tests/Feature/Games/GameRoomSharesTest.php
git commit -m "feat(integrations): share links, room invites and recaps to Teams and Mattermost

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 8: Teams and Mattermost cards on the integrations page

**Files:**
- Create: `resources/js/components/integrations/url-channel-integration.tsx`
- Modify: `resources/js/types/integrations.ts`, `resources/js/pages/teams/integrations.tsx`, `resources/js/components/integrations/integration-actions.tsx` (type of `ConnectLink.provider` only), `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: routes `teams.integrations.urls.store` and `teams.integrations.update` (Wayfinder `IntegrationUrlsController.store`, `TeamIntegrationsController.update`), page prop `mattermost` (Task 6), `IntegrationCard`, `IntegrationDetails`, `TestConnectionButton`, `DisconnectIntegrationDialog`, `InputError`, `RetroRequestError.errors`.
- Produces: frontend types and `UrlChannelIntegration` (Contract).

No frontend test runner exists (spec §13); the backend behaviour is covered by Task 6. Verify with type-check, lint and the walkthrough in Task 10.

- [ ] **Step 1: Extend the types**

In `resources/js/types/integrations.ts`:

```ts
export type IntegrationProviderKey =
    | 'slack'
    | 'telegram'
    | 'jira'
    | 'linear'
    | 'jira_dc'
    | 'github'
    | 'msteams'
    | 'mattermost'
    | 'webhook';
```

add `host?: string;` and `channelLabel?: string | null;` to `IntegrationSettings`, and after `TelegramBotInfo`:

```ts
export type MattermostServerInfo = { url: string };
```

In `integration-actions.tsx`, narrow `ConnectLinkProps.provider` to `'slack' | 'jira' | 'linear'` (the only values its route accepts today; Plan 14c widens it for `jira_dc`/`github`).

- [ ] **Step 2: Create the card**

Create `resources/js/components/integrations/url-channel-integration.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { MessageCircle, MessagesSquare } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import IntegrationUrlsController from '@/actions/App/Http/Controllers/Integrations/IntegrationUrlsController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    MattermostServerInfo,
} from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { TestConnectionButton } from './integration-actions';
import { IntegrationCard } from './integration-card';
import { IntegrationDetails } from './integration-details';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
    mattermost: MattermostServerInfo | null;
};

type FieldErrors = { url?: string; channel_label?: string };

/**
 * Microsoft Teams and Mattermost connect with a pasted webhook URL. The URL
 * is never sent back to the browser, so replacing it means pasting it again.
 */
export function UrlChannelIntegration({ card, scope, mattermost }: Props) {
    const { t } = useTrans();
    const urlId = useId();
    const labelId = useId();
    const connection = card.connection;
    const isTeams = card.provider === 'msteams';
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [url, setUrl] = useState('');
    const [channelLabel, setChannelLabel] = useState('');
    const [errors, setErrors] = useState<FieldErrors>({});

    const description = isTeams
        ? t(
              'Post board links, game invites and results to a Microsoft Teams channel through a Workflows webhook.',
          )
        : t(
              'Post board links, game invites and results to a Mattermost channel through an incoming webhook of :url.',
              { url: mattermost?.url ?? '' },
          );
    const help = isTeams
        ? t(
              'In Teams, add the workflow "Post to a channel when a webhook request is received" to the channel and paste its URL.',
          )
        : t(
              'In Mattermost, create an incoming webhook for the channel and paste its URL.',
          );

    const openDialog = () => {
        setUrl('');
        setChannelLabel(connection?.settings.channelLabel ?? '');
        setErrors({});
        setOpen(true);
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setErrors({});

        const label = channelLabel.trim();

        try {
            await retroRequest(
                connection === null
                    ? IntegrationUrlsController.store({
                          ...scope,
                          provider: card.provider,
                      })
                    : TeamIntegrationsController.update({
                          ...scope,
                          integration: connection.id,
                      }),
                { url, channel_label: label === '' ? null : label },
            );
            setOpen(false);
            toast.success(
                t(':provider connected.', { provider: card.label }),
            );
            router.reload({ only: ['providers'] });
        } catch (error) {
            if (error instanceof RetroRequestError && error.status === 422) {
                setErrors({
                    url: error.errors.url?.[0],
                    channel_label: error.errors.channel_label?.[0],
                });
            } else {
                toast.error(
                    integrationErrorMessage(error, t('Something went wrong.')),
                );
            }
        } finally {
            setBusy(false);
        }
    };

    const destination =
        connection?.settings.channelLabel ?? connection?.settings.host ?? '';

    return (
        <IntegrationCard
            icon={isTeams ? MessagesSquare : MessageCircle}
            card={card}
            actions={
                connection === null ? (
                    <Button size="sm" onClick={openDialog}>
                        {t('Connect')}
                    </Button>
                ) : (
                    <>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={openDialog}
                        >
                            {t('Replace URL')}
                        </Button>
                        {connection.status === 'active' && (
                            <TestConnectionButton
                                scope={scope}
                                connection={connection}
                                label={t('Send a test message')}
                                successMessage={t('Test message sent.')}
                            />
                        )}
                        <DisconnectIntegrationDialog
                            scope={scope}
                            card={card}
                            connection={connection}
                            description={t(
                                'Nothing is posted to :channel anymore. Delete the webhook in :provider if you no longer need it.',
                                { channel: destination, provider: card.label },
                            )}
                        />
                    </>
                )
            }
        >
            {connection === null ? (
                <p className="text-sm text-muted-foreground">{description}</p>
            ) : (
                <IntegrationDetails
                    connection={connection}
                    rows={[
                        { label: t('Host'), value: connection.settings.host },
                        {
                            label: t('Channel'),
                            value: connection.settings.channelLabel ?? '—',
                        },
                    ]}
                />
            )}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <form className="space-y-4" onSubmit={submit}>
                        <DialogTitle>
                            {connection === null
                                ? t('Connect :provider', {
                                      provider: card.label,
                                  })
                                : t('Replace the URL')}
                        </DialogTitle>
                        <DialogDescription>{help}</DialogDescription>
                        <div className="space-y-2">
                            <Label htmlFor={urlId}>{t('Webhook URL')}</Label>
                            <Input
                                id={urlId}
                                type="url"
                                required
                                autoComplete="off"
                                value={url}
                                onChange={(event) => setUrl(event.target.value)}
                            />
                            <InputError message={errors.url} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={labelId}>
                                {t('Channel label (optional)')}
                            </Label>
                            <Input
                                id={labelId}
                                maxLength={80}
                                value={channelLabel}
                                onChange={(event) =>
                                    setChannelLabel(event.target.value)
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                {t(
                                    'Shown on this page only, to remember where messages go.',
                                )}
                            </p>
                            <InputError message={errors.channel_label} />
                        </div>
                        <DialogFooter className="gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setOpen(false)}
                            >
                                {t('Cancel')}
                            </Button>
                            <Button type="submit" disabled={busy}>
                                {busy && <Spinner />}
                                {connection === null
                                    ? t('Connect')
                                    : t('Save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </IntegrationCard>
    );
}
```

(When connected, the PATCH body always carries the pasted `url`; the dialog's `required` URL field makes "Replace URL" the only way to change the label too. That keeps one dialog; PATCH still accepts a label-only change, tested in Task 6.)

- [ ] **Step 3: Mount it on the page**

In `resources/js/pages/teams/integrations.tsx`: import `UrlChannelIntegration` and `MattermostServerInfo`; add `mattermost: MattermostServerInfo | null;` to `Props` and destructure it; add before `default:`:

```tsx
                        case 'msteams':
                        case 'mattermost':
                            return (
                                <UrlChannelIntegration
                                    key={card.provider}
                                    card={card}
                                    scope={scope}
                                    mattermost={mattermost}
                                />
                            );
```

- [ ] **Step 4: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Post board links, game invites and results to a Microsoft Teams channel through a Workflows webhook.` | `Publiez les liens des tableaux, les invitations aux jeux et les résultats dans un canal Microsoft Teams via un webhook Workflows.` | `Publica enlaces de tableros, invitaciones a juegos y resultados en un canal de Microsoft Teams mediante un webhook de Workflows.` | `Teile Board-Links, Spieleinladungen und Ergebnisse über einen Workflows-Webhook in einem Microsoft-Teams-Kanal.` |
| `Post board links, game invites and results to a Mattermost channel through an incoming webhook of :url.` | `Publiez les liens des tableaux, les invitations aux jeux et les résultats dans un canal Mattermost via un webhook entrant de :url.` | `Publica enlaces de tableros, invitaciones a juegos y resultados en un canal de Mattermost mediante un webhook entrante de :url.` | `Teile Board-Links, Spieleinladungen und Ergebnisse über einen eingehenden Webhook von :url in einem Mattermost-Kanal.` |
| `In Teams, add the workflow "Post to a channel when a webhook request is received" to the channel and paste its URL.` | `Dans Teams, ajoutez au canal le workflow « Publier dans un canal lorsqu'une requête webhook est reçue » et collez son URL.` | `En Teams, añade al canal el flujo de trabajo «Publicar en un canal cuando se reciba una solicitud de webhook» y pega su URL.` | `Füge in Teams dem Kanal den Workflow „In einem Kanal posten, wenn eine Webhook-Anforderung empfangen wird“ hinzu und füge seine URL ein.` |
| `In Mattermost, create an incoming webhook for the channel and paste its URL.` | `Dans Mattermost, créez un webhook entrant pour le canal et collez son URL.` | `En Mattermost, crea un webhook entrante para el canal y pega su URL.` | `Erstelle in Mattermost einen eingehenden Webhook für den Kanal und füge seine URL ein.` |
| `Connect :provider` | `Connecter :provider` | `Conectar :provider` | `:provider verbinden` |
| `Replace URL` | `Remplacer l'URL` | `Reemplazar URL` | `URL ersetzen` |
| `Replace the URL` | `Remplacer l'URL` | `Reemplazar la URL` | `URL ersetzen` |
| `Webhook URL` | `URL du webhook` | `URL del webhook` | `Webhook-URL` |
| `Channel label (optional)` | `Nom du canal (facultatif)` | `Nombre del canal (opcional)` | `Kanalbezeichnung (optional)` |
| `Shown on this page only, to remember where messages go.` | `Affiché uniquement sur cette page, pour savoir où partent les messages.` | `Solo se muestra en esta página, para recordar adónde van los mensajes.` | `Wird nur auf dieser Seite angezeigt, damit du weißt, wohin Nachrichten gehen.` |
| `Nothing is posted to :channel anymore. Delete the webhook in :provider if you no longer need it.` | `Plus rien n'est publié dans :channel. Supprimez le webhook dans :provider si vous n'en avez plus besoin.` | `Ya no se publicará nada en :channel. Elimina el webhook en :provider si ya no lo necesitas.` | `In :channel wird nichts mehr gepostet. Lösche den Webhook in :provider, wenn du ihn nicht mehr brauchst.` |

(The English key contains straight double quotes: write it as `"In Teams, add the workflow \"Post to a channel when a webhook request is received\" to the channel and paste its URL."` in the JSON files. `:provider connected.`, `Connect`, `Save`, `Cancel`, `Host`, `Channel`, `Send a test message`, `Test message sent.`, `Something went wrong.` exist already.)

- [ ] **Step 5: Verify**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: no type errors; lint clean except the known pre-existing files; PASS. Format with `npx vp check --fix resources/js/components/integrations/url-channel-integration.tsx resources/js/pages/teams/integrations.tsx resources/js/types/integrations.ts resources/js/components/integrations/integration-actions.tsx`.

- [ ] **Step 6: Commit**

```bash
git add resources/js/components/integrations/url-channel-integration.tsx resources/js/types/integrations.ts resources/js/pages/teams/integrations.tsx resources/js/components/integrations/integration-actions.tsx lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): Teams and Mattermost cards on the integrations page

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 9: Share menus list every available channel

**Files:**
- Modify: `resources/js/types/integrations.ts`, `resources/js/lib/integrations.ts`, `resources/js/components/integrations/share/post-link-section.tsx`, `resources/js/components/retro/share-board-button.tsx`, `resources/js/components/retro/results/results-share-menu.tsx`, `resources/js/components/retro/results/recap-share-dialog.tsx`, `resources/js/components/poker/game-menu.tsx`, `resources/js/components/games/room-invite-button.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: the five-key share availability of Task 7 (retro `integrations`, poker `share`, game room `share`), `DeliveryLines`.
- Produces: `ShareChannel` with five values and the helpers of the Contract's "Frontend".

- [ ] **Step 1: Widen the types**

In `resources/js/types/integrations.ts`:

```ts
export type ShareChannel =
    | 'slack'
    | 'telegram'
    | 'msteams'
    | 'mattermost'
    | 'webhook';
```

(`DeliveryChannel`, `ShareAvailability` derive from it.)

- [ ] **Step 2: Centralize the channel labels**

Replace `ShareChannels` and `deliveryChannelLabel` in `resources/js/lib/integrations.ts` and add the helpers:

```ts
type Translate = (key: string) => string;

export const ShareChannels: ShareChannel[] = [
    'slack',
    'telegram',
    'msteams',
    'mattermost',
    'webhook',
];

export function hasShareChannel(availability: ShareAvailability): boolean {
    return ShareChannels.some((channel) => availability[channel]);
}

export function deliveryChannelLabel(
    channel: DeliveryChannel,
    t: Translate,
): string {
    switch (channel) {
        case 'slack':
            return 'Slack';
        case 'telegram':
            return 'Telegram';
        case 'msteams':
            return 'Microsoft Teams';
        case 'mattermost':
            return 'Mattermost';
        case 'webhook':
            return t('Webhook');
        case 'email':
            return t('Email');
    }
}

export function postLinkLabel(channel: ShareChannel, t: Translate): string {
    switch (channel) {
        case 'slack':
            return t('Post link to Slack');
        case 'telegram':
            return t('Post link to Telegram');
        case 'msteams':
            return t('Post link to Microsoft Teams');
        case 'mattermost':
            return t('Post link to Mattermost');
        case 'webhook':
            return t('Send link to webhook');
    }
}

export function shareResultsLabel(channel: ShareChannel, t: Translate): string {
    switch (channel) {
        case 'slack':
            return t('Share to Slack');
        case 'telegram':
            return t('Share to Telegram');
        case 'msteams':
            return t('Share to Microsoft Teams');
        case 'mattermost':
            return t('Share to Mattermost');
        case 'webhook':
            return t('Send to webhook');
    }
}

export function recapDialogTitle(channel: ShareChannel, t: Translate): string {
    switch (channel) {
        case 'slack':
            return t('Share the results to Slack');
        case 'telegram':
            return t('Share the results to Telegram');
        case 'msteams':
            return t('Share the results to Microsoft Teams');
        case 'mattermost':
            return t('Share the results to Mattermost');
        case 'webhook':
            return t('Send the results to the webhook');
    }
}
```

(import `ShareAvailability` next to `DeliveryChannel, ShareChannel`.)

- [ ] **Step 3: Use them in the share UI**

- `post-link-section.tsx`: the button label becomes `{postLinkLabel(channel, t)}` (drop the Slack/Telegram ternary).
- `share-board-button.tsx`: the guard becomes `retro.phase === 'completed' || !hasShareChannel(integrations)`.
- `game-menu.tsx`: `const canShare = hasShareChannel(share);`.
- `room-invite-button.tsx`: `const canInvite = hasShareChannel(snapshot.share);`.
- `results-share-menu.tsx`: the early return becomes `if (!hasShareChannel(integrations) && !integrations.email)`, and the two hard-coded Slack/Telegram items are replaced by

```tsx
                    {ShareChannels.filter(
                        (channel) => integrations[channel],
                    ).map((channel) => (
                        <DropdownMenuItem
                            key={channel}
                            onSelect={() => setOpen({ kind: 'recap', channel })}
                        >
                            {shareResultsLabel(channel, t)}
                        </DropdownMenuItem>
                    ))}
```

- `recap-share-dialog.tsx`: the title becomes `{channel === null ? null : recapDialogTitle(channel, t)}`, and `send()` resets the busy flag in `finally`:

```tsx
        setBusy(true);

        let delivery: IntegrationDelivery | undefined;

        try {
            delivery = await ctx.run(
                retroRequest<IntegrationDelivery>(
                    RetroSharesController.store(retro.id),
                    { channel, kind: 'results' },
                ),
            );
        } finally {
            setBusy(false);
        }

        if (delivery === undefined) {
            return;
        }
```

- [ ] **Step 4: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Post link to Microsoft Teams` | `Publier le lien sur Microsoft Teams` | `Publicar el enlace en Microsoft Teams` | `Link in Microsoft Teams posten` |
| `Post link to Mattermost` | `Publier le lien sur Mattermost` | `Publicar el enlace en Mattermost` | `Link in Mattermost posten` |
| `Send link to webhook` | `Envoyer le lien au webhook` | `Enviar el enlace al webhook` | `Link an den Webhook senden` |
| `Share to Microsoft Teams` | `Partager sur Microsoft Teams` | `Compartir en Microsoft Teams` | `In Microsoft Teams teilen` |
| `Share to Mattermost` | `Partager sur Mattermost` | `Compartir en Mattermost` | `In Mattermost teilen` |
| `Send to webhook` | `Envoyer au webhook` | `Enviar al webhook` | `An den Webhook senden` |
| `Share the results to Microsoft Teams` | `Partager les résultats sur Microsoft Teams` | `Compartir los resultados en Microsoft Teams` | `Ergebnisse in Microsoft Teams teilen` |
| `Share the results to Mattermost` | `Partager les résultats sur Mattermost` | `Compartir los resultados en Mattermost` | `Ergebnisse in Mattermost teilen` |
| `Send the results to the webhook` | `Envoyer les résultats au webhook` | `Enviar los resultados al webhook` | `Ergebnisse an den Webhook senden` |

- [ ] **Step 5: Verify**

Run: `npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: no type errors (every `switch` over `ShareChannel`/`DeliveryChannel` is exhaustive); lint clean except the known files; PASS. Format the touched files with `npx vp check --fix <paths>`.

- [ ] **Step 6: Commit**

```bash
git add resources/js/types/integrations.ts resources/js/lib/integrations.ts resources/js/components/integrations/share/post-link-section.tsx resources/js/components/retro/share-board-button.tsx resources/js/components/retro/results/results-share-menu.tsx resources/js/components/retro/results/recap-share-dialog.tsx resources/js/components/poker/game-menu.tsx resources/js/components/games/room-invite-button.tsx lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): list Teams and Mattermost in every share menu

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 10: Verification and spec alignment

**Files:**
- Modify: `docs/superpowers/specs/2026-09-30-integrations-extended-design.md` (amendments 1–11 of "Spec amendments made with this plan", each at the section it names)

- [ ] **Step 1: Full checks**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
vendor/bin/sail artisan wayfinder:generate --with-form
npm run types:check
npm run check
npm run build
vendor/bin/sail artisan test --compact --parallel --processes=4
```

Expected: pint clean, phpstan 0 errors, no type errors, lint clean except `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`, build succeeds, whole suite green (rerun any Postgres `max_locks_per_transaction` failure without `--parallel` — infrastructure, not code).

- [ ] **Step 2: Acceptance walk (automated evidence)**

Check each item against a passing test and note the test name in the task report:
- With no new env and status sync off, spec 6 behaviour is unchanged (`IntegrationsExtendedAvailabilityTest` "behaves as spec 6…", the untouched spec 6 suites).
- Teams/Mattermost appear only when enabled, and only Owners/Admins connect, update, test and disconnect them (`ConnectUrlChannelTest`).
- Links, room invites and recaps reach Teams/Mattermost with spec 6's content rules, escaped and within size (`ChatChannelSharesTest`, `ChatMessageFormattingTest`).
- No webhook URL in props, JSON, job payloads or errors (`ConnectUrlChannelTest` "never serializes…", `ChatChannelSharesTest` "keeps the webhook URL out of the job payload", `ChatWebhookClientsTest` "never exposes webhook keys in errors").
- Every column and table of spec §3 exists (`IntegrationSyncSchemaTest`).

- [ ] **Step 3: Amend the spec**

Apply amendments 1–11 to `docs/superpowers/specs/2026-09-30-integrations-extended-design.md` (§2.1 row Mattermost and the staged-availability note, §2.3 poll clamp, §3 Mattermost settings `host`, §4.3/§4.4 escaping wording, Mattermost reconnect message and redirects, §7 `url`/`channel_label` fields and the `mattermost` page prop, §9 Teams list rendering, §10 daily check row). Keep each change to the sentence it corrects.

- [ ] **Step 4: Manual walkthrough (pending for the user)**

Record in the report as not run unless a Teams workflow and a Mattermost server are available: connect a Teams Workflows webhook and a Mattermost incoming webhook on a team, send a test message to each, share a board link and a game room invite, complete an anonymous retro and share its recap to both (names shown as a count, action items named, `@channel` in a card rendered literally), break the Teams URL (delete the workflow) and see "Reconnect required" after the next share.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-30-integrations-extended-design.md
git commit -m "docs(integrations): align the extended integrations spec with plan 14a

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
## Self-review

- **Spec coverage (14a scope):** §2.1 env/config for every provider (Task 1); §2.2 kinds and capabilities (Task 1); §2.3 `InboundReachability::isPublic()` and poll interval (Task 2); §3 every column/table/enum value (Task 3); §4.3/§4.4 URL rules, message formats, escaping, size limits, error mapping, Test (Tasks 4–6); §4.6 retro/poker/game room shares via `msteams`/`mattermost` (Task 7; `webhook` is accepted by validation and refused with 404 until 14b); §6 permissions for connect and share (Tasks 6–7); §7 `POST {msteams|mattermost}`, PATCH `url`/`channel_label`, snapshot booleans (Tasks 6–7); §8.3 secrets (Tasks 5–7); §9 cards and share menus (Tasks 8–9); §10 jobs and prune (Tasks 3, 7); §11 URL errors (Tasks 5–6); §13 availability, Teams/Mattermost and game room invite bullets (Tasks 1, 4–7). Out of scope here and named in the Contract: generic webhooks and events (14b), Jira DC/GitHub/MCP (14c), inbound mode selection, presenter sync fields, status sync (14d).
- **Placeholder scan:** every step names exact files, code and commands; the only `<model name>` is the commit trailer, filled by the model that writes the commit (standing ruling).
- **Type consistency:** `IntegrationProvider::MicrosoftTeams` value `msteams` is used identically by `IntegrationDeliveryChannel`, route `whereIn`, `ShareOptions` keys, `PresentTeamIntegration::SettingKeys`, TS `IntegrationProviderKey`/`ShareChannel`; `ShareOptions::NoChannels` key order matches `channels()` and the updated test arrays; `ShareContent` methods match the jobs' constructor types (`array` for Teams, `string` for Mattermost).
- **Known risks for reviewers:** phpstan inference of `RetroRecapContent::firstFitting()` (fallback noted in Task 4 Step 5); Adaptive Card rendering of backslash escapes is only verifiable in the walkthrough; `dns_get_record` is mocked in tests (`HostResolver`), so real DNS is exercised only by the walkthrough's `APP_URL`.
