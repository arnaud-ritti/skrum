# Plan 12a — Integrations foundation and connections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Workspace Owners/Admins can connect each team to Slack (OAuth, one channel), Telegram (instance bot, `/connect` code), Jira Cloud and Linear (OAuth, read or read and write) from a new team integrations page, test and disconnect them, and see "Reconnect required" whenever access is lost — with every table, model, enum, provider client and error type that Plans 12b–12d build sharing, poker import and action item export on.

**Architecture:** One `team_integrations` row per team and provider holds encrypted credentials (`encrypted:array`, hidden), non-secret `settings`, granted `scopes` and an `IntegrationStatus`. Providers are enabled by env (`IntegrationProvider::isEnabled()`, modelled on `SsoProvider`) and every route is guarded by `EnsureIntegrationProviderEnabled` (404 when disabled). Provider HTTP lives in `App\Support\Integrations\{Slack,Telegram,Jira,Linear}\*Client` built on `Http::` through `ProviderHttp`, which maps responses to one exception hierarchy (`ReconnectRequired`, `RateLimited`, `ProviderRejected`, `ProviderUnavailable`, …) whose messages are sanitized by `IntegrationErrors::sanitize`; `TeamIntegration::withReconnectHandling()` turns a lost access into the `ReconnectRequired` status. OAuth connections go through `OAuthState` (session) → `OAuthConnectors` → `ConnectSlack` / `ConnectJira` / `ConnectLinear` → `SaveTeamIntegration`, which also deletes account mappings when the tracker site changes and fires `IntegrationActivated` for write-enabled trackers. Jira/Linear tokens refresh through `IntegrationTokens` under a cache lock plus `lockForUpdate`. Telegram is polled by `skrum:telegram-poll` (scheduler, every minute) and `HandleTelegramUpdate` consumes 15-minute single-use codes. A daily `skrum:check-integrations` re-checks every active connection.

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL, Pest, Laravel HTTP client (`Http::`), cache locks, Inertia v3 + React 19, Wayfinder, Tailwind 4, lucide, Radix dialog/select (all installed).

**Spec:** `docs/superpowers/specs/2026-09-29-integrations-design.md` — §2 (configuration and availability), §3 (all tables and transient state), §4 (all four connections, common rules, daily check), §8 row "View the integrations page, connect, …", §9 "Team integrations" rows page/connect/callback/telegram code/PATCH (`cloudId`, `storyPointFieldId`)/detection/test/DELETE, §10.3, §10.4, §11 "Team page" and "Integrations page" (without the People and Priorities panels), §12 rows `skrum:telegram-poll` and `skrum:check-integrations`, §13 (provider/connection errors), §15 bullets Availability, Permissions (management), OAuth, Telegram, Health check command, Secrets, and §16 criteria 1–4 and the connection parts of 10 and 12. Later plans: 12b sharing (§5), 12c poker import and write-back (§6, §9.1), 12d action item export and account/priority mapping (§7). Parent: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md`.

## Global Constraints

- Work on branch `feat/plan-12-integrations`, created from the current `main` (plans 8–11 are merged there). Plans 12b–12d continue on the same branch.
- Shells: prefix commands with `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH";`. Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host.
- Tests run on PostgreSQL (the Sail `testing` database). Every table uses a UUID primary key (`tests/Feature/UuidPrimaryKeysTest.php` stays green). Migration filenames use the prefix `2026_10_05_1000xx`; only `up()` methods.
- **No new Composer or npm dependency.** Every provider call uses Laravel's HTTP client through `App\Support\Integrations\ProviderHttp` (15 s timeout, 5 s connect timeout; Telegram long polling `timeout + 10` s), following the provider-class pattern of `app/Support/Gifs/`. Socialite is not used. Base URLs are class constants; no user-supplied URL is ever requested (Slack webhook URLs must start with `https://hooks.slack.com/` before storage and before each use).
- Every integration test file starts with `beforeEach(fn () => Http::preventStrayRequests());` and fakes each provider call explicitly.
- Credentials are read only through `TeamIntegration::credential()` / `readableCredentials()`; they are never passed to presenters, page props, JSON responses, logs, exception messages or job payloads. Provider error text is stored or returned only after `IntegrationErrors::sanitize()` (URLs reduced to host + path, query strings, bearer tokens, Slack tokens and webhook paths and the Telegram bot token removed, ≤ 500 characters).
- **Request fields are snake_case** (`access`, `cloud_id`, `story_point_field_id`); responses and page props are camelCase exactly as spec §9.
- Route names follow `routes/web.php` (dotted, camelCase segments): `teams.integrations.index`, `teams.integrations.connect`, `integrations.callback`, `teams.integrations.telegramCode.store`, `teams.integrations.update`, `teams.integrations.destroy`, `teams.integrations.detection.store`, `teams.integrations.test.store`.
- Every user-facing string via `t()` / `__()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"), appended at the end of each file, keeping every existing value. Each task lists its own rows; add only keys that are missing at execution time. Provider names (Slack, Telegram, Jira, Linear) are never translated. `tests/Feature/TranslationKeysTest.php` stays green.
- Wayfinder: run `vendor/bin/sail artisan wayfinder:generate --with-form` after every route change. `resources/js/actions` and `resources/js/routes` are gitignored — never stage them. Frontend imports use the generated controllers (`@/actions/App/Http/Controllers/Integrations/…`), never hard-coded URLs (the only literal URL is `https://t.me/{bot}`).
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp check --fix <paths>`.
- React: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `retroRequest()` from `@/lib/retro/api` for JSON calls (generic despite its name), `usePage().props.locale` for `Intl` formatting, `toast` from `sonner`.
- PHP: constructor promotion, typed everything, array-shape docblocks on presenter return values, early returns, curly braces, no comments restating code, class constants in PascalCase. Test helper functions are global in Pest: every new helper name below is unique in `tests/`.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Spec amendments made with this plan

Plan writing found these gaps; the spec is updated to match (§3, §4.3, §9, §13):

1. **`team_integrations.scopes`** (json, list of granted OAuth scopes) is added so that Plan 12d can answer 409 "Reconnect :provider to enable assignee mapping." on a Jira connection made without `read:jira-user` (§13), and a read connection can be told apart from an upgraded one after partial consent.
2. **Jira settings** gain `numberFields: [{id, name}]` (every numeric custom field, for the story points select) and `storyPointFieldOverride` (the admin's choice, kept first in `storyPointFields` by every re-detection).
3. **`access`** is stored through a backed enum `IntegrationAccess` (`read`, `write`); delivery columns use `IntegrationDeliveryChannel`, `IntegrationDeliveryKind`, `IntegrationDeliveryStatus`. Values are the spec's strings.
4. **Routes are always registered**; `EnsureIntegrationProviderEnabled` answers 404 for a disabled provider (Wayfinder generation and route caching need a static route list). Observable behaviour is the spec's.
5. **Jira reconnect with several sites**: when the currently connected `cloudId` is among the accessible sites, the connection stays `Active` on it (no "Setup required" step); otherwise `SetupRequired` keeps the previous site's settings until the admin picks one, so a later choice of another site still deletes the account mappings.
6. **`POST …/test` failures** use §13's mapping (409 "Reconnect :provider in the team settings.", 429, 422, 502) instead of always 502.
7. **Telegram `/connect@otherbot CODE`** is ignored (it addresses another bot in the same group); `/connect CODE` without a username is accepted.

## Review Focus

1. **An OAuth callback whose state is missing, expired, already used, issued for another provider, or opened by a user who lost the Owner/Admin role meanwhile** → a translated error flash, a redirect (integrations page, or dashboard when the team is gone or unmanageable), and no row created or changed. Pinned in Task 7 ("refuses callbacks with a bad state", "refuses a callback once the user cannot manage the team").
2. **APP_KEY rotated without `APP_PREVIOUS_KEYS`** → reading credentials marks the integration "Reconnect required" and throws `ReconnectRequired`; the integrations page still renders (it never decrypts). Pinned in Task 3 ("marks the integration reconnect-required when credentials cannot be decrypted") and Task 6 ("renders integrations whose credentials cannot be decrypted").
3. **Two workers refreshing the same Jira token** → the second one reuses the token the first stored (no second refresh with a rotated refresh token, so no `invalid_grant`). Pinned in Task 5 ("reuses a token another worker refreshed").
4. **Provider error text carrying secrets** (Telegram bot token in the URL, Slack webhook path, `?code=` query strings, bearer headers) → never stored in `last_error` nor returned in a response. Pinned in Task 2 ("removes secrets from provider errors") and Task 4 ("never exposes the bot token in errors").
5. **Telegram `/connect` misuse** — a code reused, expired or superseded by a newer one, a command addressed to another bot, or a chat that keeps guessing → invalid reply, ignored command, or 1-hour lockout after 5 invalid attempts; no integration row. Pinned in Task 10 ("accepts a code only once and only while it is the newest", "ignores commands for another bot", "locks a chat out after five invalid codes").

## File map

| Area | Files |
|---|---|
| Configuration | `config/services.php`, `.env.example`, `phpunit.xml`, `app/Enums/IntegrationProvider.php`, `app/Support/Integrations/IntegrationAvailability.php` |
| Errors | `app/Support/Integrations/{IntegrationErrors,ProviderHttp,OAuthTokens,RefreshesTokens}.php`, `app/Support/Integrations/Exceptions/{IntegrationException,ReconnectRequired,RateLimited,ProviderRejected,ProviderUnavailable,TelegramConflict,NotConnected,ReadOnlyConnection,ConnectionRefused}.php` |
| Schema & models | `database/migrations/2026_10_05_100000_create_integration_tables.php`, `database/migrations/2026_10_05_100100_add_integration_columns_to_poker_tasks_table.php`; `app/Enums/{IntegrationStatus,IntegrationAccess,IntegrationUserMatch,IntegrationDeliveryChannel,IntegrationDeliveryKind,IntegrationDeliveryStatus}.php`; `app/Models/{TeamIntegration,IntegrationUserMapping,ActionItemExternalLink,IntegrationDelivery}.php`; `app/Models/{Team,ActionItem,PokerTask,Retro,PokerGame}.php`; `database/factories/{TeamIntegrationFactory,IntegrationUserMappingFactory,ActionItemExternalLinkFactory,IntegrationDeliveryFactory,PokerTaskFactory}.php` |
| Provider clients | `app/Support/Integrations/Slack/SlackClient.php`, `app/Support/Integrations/Telegram/{TelegramClient,TelegramBot,TelegramConnectCodes}.php`, `app/Support/Integrations/Jira/JiraClient.php`, `app/Support/Integrations/Linear/LinearClient.php`, `app/Support/Integrations/IntegrationTokens.php` |
| Connections | `app/Support/Integrations/OAuthState.php`; `app/Actions/Integrations/{OAuthConnector,OAuthConnectors,SaveTeamIntegration,ConnectSlack,ConnectJira,ConnectLinear,DetectJiraStoryPointFields,UpdateTeamIntegration,HandleTelegramUpdate,PollTelegramUpdates,CheckIntegration,DisconnectIntegration,PresentTeamIntegration}.php`; `app/Events/Integrations/IntegrationActivated.php` |
| HTTP | `app/Policies/TeamPolicy.php`; `app/Http/Middleware/EnsureIntegrationProviderEnabled.php`; `app/Http/Controllers/Integrations/{TeamIntegrationsController,IntegrationAuthorizationsController,IntegrationCallbacksController,TelegramConnectCodesController,JiraFieldDetectionsController,IntegrationTestsController}.php`; `app/Http/Controllers/TeamsController.php`; `routes/web.php` |
| Console | `app/Console/Commands/{PollTelegramUpdatesCommand,CheckIntegrationsCommand}.php`; `routes/console.php` |
| Frontend | `resources/js/types/{integrations,index}.ts`; `resources/js/lib/integrations.ts`; `resources/js/pages/teams/{integrations,show}.tsx`; `resources/js/components/integrations/{integration-card,integration-status-badge,integration-details,integration-actions,disconnect-integration-dialog,slack-integration,telegram-integration,jira-integration,linear-integration}.tsx` |
| Tests | `tests/Pest.php`; `tests/Feature/Integrations/{IntegrationProviderTest,IntegrationErrorsTest,IntegrationModelsTest,SlackClientTest,TelegramClientTest,IntegrationTokensTest,IntegrationsPageTest,ConnectSlackTest,ConnectJiraTest,ConnectLinearTest,TelegramConnectTest,IntegrationMaintenanceTest}.php` |
| Translations | `lang/{en,fr,es,de}.json` (rows inside each task) |

## Contract for Plans 12b–12d

Plans 12b (sharing), 12c (poker import and write-back) and 12d (export and mapping) build on exactly these names; renaming any of them breaks them.

**Enums (`app/Enums`)**
- `IntegrationProvider` (`Slack='slack'`, `Telegram='telegram'`, `Jira='jira'`, `Linear='linear'`): `static enabled(): array<int, self>`, `static anyEnabled(): bool`, `label(): string` (untranslated), `isEnabled(): bool`, `usesOAuth(): bool`, `isTracker(): bool` (Jira, Linear), `isChannel(): bool` (Slack, Telegram).
- `IntegrationStatus` (`Active='active'`, `SetupRequired='setup_required'`, `ReconnectRequired='reconnect_required'`, `label(): string` translated).
- `IntegrationAccess` (`Read='read'`, `Write='write'`); `IntegrationUserMatch` (`Email='email'`, `Manual='manual'`).
- `IntegrationDeliveryChannel` (`Slack='slack'`, `Telegram='telegram'`, `Email='email'`), `IntegrationDeliveryKind` (`RetroLink='retro_link'`, `PokerLink='poker_link'`, `RetroResults='retro_results'`, `GameRoomLink='game_room_link'`), `IntegrationDeliveryStatus` (`Queued='queued'`, `Sent='sent'`, `Failed='failed'`).

**Tables** (Task 3, all columns of spec §3 already exist; later plans add no migration for them)
- `team_integrations`: `id`, `team_id`, `provider`, `status`, `access`, `credentials` (text, `encrypted:array`, hidden), `settings` (json), `scopes` (json), `connected_by_user_id`, `last_error` (500), `last_checked_at`, timestamps; unique (`team_id`, `provider`).
- `poker_tasks` new: `external_site` (100), `external_key` (50), `external_assignee` (100), `external_estimate` (16), `external_refreshed_at`, `needs_sync` (bool, false), `sync_error` (500), `synced_at` — **not fillable** (write with `forceFill`), casts `external_refreshed_at`/`synced_at` datetime, `needs_sync` boolean. `external_source` stays a plain string (`'jira'`/`'linear'`).
- `action_item_external_links`: `id`, `action_item_id`, `source` (cast `IntegrationProvider`), `external_site`, `external_id`, `external_key`, `external_url`, `created_by_user_id`, timestamps; unique (`action_item_id`, `source`).
- `integration_user_mappings`: `id`, `team_integration_id`, `user_id`, `external_account_id` (nullable = "Never assign" when `matched_by = manual`), `external_display_name`, `matched_by` (cast `IntegrationUserMatch`), `checked_at`, timestamps; unique (`team_integration_id`, `user_id`).
- `integration_deliveries`: `id`, `team_id`, `channel`, `kind`, `subject_type`/`subject_id` (class-name morph, `uuidMorphs`), `requested_by_user_id`, `status`, `recipient_count`, `error` (500), `sent_at`, timestamps. `Retro` and `PokerGame` delete their deliveries in a `deleting` hook (12a); plan 13d adds the same hook to `GameRoom`.

**Models**
- `TeamIntegration`: relations `team()`, `connectedBy()`, `userMappings()`; `accountFor(User): ?IntegrationUserMapping`; `isActive(): bool` (status only), `canWrite(): bool` (active and write), `hasScope(string): bool`, `setting(string $key, mixed $default = null): mixed`, `site(): ?string` (Jira `cloudId`, Linear `organizationId`, else null), `readableCredentials(): ?array`, `credential(string $key): mixed` (throws `ReconnectRequired` after marking when unreadable), `markReconnectRequired(?string $error): void`, `markChecked(): void`, `ensureActive(): void` (throws `ReconnectRequired` or `NotConnected`), `ensureWritable(): void` (`ensureActive` then `ReadOnlyConnection`), `withReconnectHandling(Closure $call): mixed` (marks the row and rethrows on `ReconnectRequired`). **Rule:** a status change made inside an outer `DB::transaction` that later rolls back is lost — catch `ReconnectRequired` outside the transaction and call `markReconnectRequired()` again (12d export does this).
- `Team::integrations(): HasMany`, `Team::integration(IntegrationProvider): ?TeamIntegration`; `ActionItem::externalLinks(): HasMany`.
- `IntegrationUserMapping`: `integration()`, `user()`, `isNeverAssign(): bool`. `ActionItemExternalLink`: `actionItem()`, `createdBy()`. `IntegrationDelivery` (`Prunable`, 90 days): `team()`, `subject()` (morphTo), `requestedBy()`, `markSent(?int $recipientCount = null): void`, `markFailed(string $error): void` (sanitized). **12b adds the `model:prune` schedule entry.**
- Factories: `TeamIntegration::factory()` states `slack()`, `telegram()`, `jira(IntegrationAccess $access = IntegrationAccess::Write)`, `linear(IntegrationAccess $access = IntegrationAccess::Write)`, `setupRequired()` (Jira with two `sites`), `reconnectRequired(string $error = 'token_revoked')`, `expiring()` (token expires in 30 s). Fixtures: Slack webhook `https://hooks.slack.com/services/T000/B000/XXXX`, token `xoxp-test-token`, channel `#retros`; Telegram chat `-100123` "Team chat"; Jira `cloud-1` `https://acme.atlassian.net` "Acme", tokens `jira-access`/`jira-refresh`, `storyPointFields` `[{id: customfield_10016, name: Story point estimate}]`; Linear `org-1` "Acme" `acme`, token `linear-access`. `IntegrationUserMapping::factory()` states `manual()`, `neverAssign()`; `ActionItemExternalLink::factory()` state `linear()`; `IntegrationDelivery::factory()` states `forSubject(Model $subject)`, `sent()`, `failed(string $error = 'boom')`; `PokerTask::factory()->imported(IntegrationProvider $source = IntegrationProvider::Jira, string $site = 'cloud-1')`.

**Support classes (`app/Support/Integrations`)**
- `IntegrationAvailability` (injectable): `emailEnabled(): bool`, `activeIntegration(Team, IntegrationProvider): ?TeamIntegration` (provider enabled and status active).
- `IntegrationErrors::sanitize(string): string`.
- `ProviderHttp`: `static request(int $timeout = 15): PendingRequest`, `static send(IntegrationProvider, Closure(): Response): Response` (connection errors → `ProviderUnavailable` with `timedOut = true`), `static fail(IntegrationProvider, Response, ?string $message = null): never` (429 → `RateLimited`, 5xx → `ProviderUnavailable`, 401 → `ReconnectRequired`, other → `ProviderRejected` with `errors` = the body's `errors`), `static retryAfter(Response, int $default = 30): int`, `static message(Response): string`.
- Exceptions (`App\Support\Integrations\Exceptions`), all extending `IntegrationException` (`public IntegrationProvider $provider`, `detail(): ?string` sanitized, `status(): int`, `userMessage(): string`, `render(Request): JsonResponse` → `{message}`): `ReconnectRequired` (409), `RateLimited` (`public int $retryAfter`, 429), `ProviderRejected` (`public int $httpStatus`, `public array $errors`, 422, message = sanitized provider text), `ProviderUnavailable` (`public bool $timedOut`, 502), `NotConnected` (409 "Connect :provider in the team settings."), `ReadOnlyConnection` (409 "This :provider connection is read-only."), `TelegramConflict` (409). `ConnectionRefused` extends `RuntimeException` (translated message, OAuth callback only).
- `Slack\SlackClient`: `static isWebhookUrl(string): bool`, `authorizationUrl(string $state): string`, `exchangeCode(string): array`, `authTest(TeamIntegration): void`, `revoke(TeamIntegration): void` (best effort), `postMessage(TeamIntegration, array $message): void` (webhook; 403/404/410 → `ReconnectRequired` + status).
- `Telegram\TelegramClient`: `getMe(): array`, `getUpdates(int $offset, int $timeout): array`, `sendMessage(string $chatId, string $html): void` (HTML parse mode, link previews off), `sendMessageTo(TeamIntegration, string $html): void`, `getChat(TeamIntegration): array`, `leaveChat(TeamIntegration): void` (best effort). 403 / "chat not found" → `ReconnectRequired`; 429 → `RateLimited(parameters.retry_after)`.
- `Telegram\TelegramBot`: `username(): ?string` (cached 24 h), `ConflictKey`, `markConflict()`, `clearConflict()`, `hasConflict(): bool`.
- `Jira\JiraClient` (injectable): constants `ApiUrl`, `ReadScopes`, `WriteScopes`; `static scopesFor(IntegrationAccess): array`, `authorizationUrl(string $state, IntegrationAccess): string`, `exchangeCode(string): array`, `refreshTokens(string): array`, `accessibleResources(string $accessToken): array<int, array{cloudId, url, name}>`, **`get(TeamIntegration, string $path, array $query = []): array`, `post(TeamIntegration, string $path, array $body = []): array`, `put(TeamIntegration, string $path, array $body = []): array`** (paths relative to `https://api.atlassian.com/ex/jira/{cloudId}/`, e.g. `rest/api/3/search/jql`; token refresh and one retry on 401 built in; `NotConnected` without `cloudId`). `ProviderRejected::$errors` carries Jira's `errors` map (e.g. `['assignee' => '…']`).
- `Linear\LinearClient` (injectable): `static scopesFor(IntegrationAccess): array`, `authorizationUrl(…)`, `exchangeCode(…)`, `refreshTokens(…)`, `organization(string $accessToken): array{id, name, urlKey}`, **`query(TeamIntegration, string $query, array $variables = []): array`** (returns `data`; `AUTHENTICATION_ERROR` → `ReconnectRequired`, `RATELIMITED` → `RateLimited`, other GraphQL errors → `ProviderRejected` with `errors` = the GraphQL error list), `revoke(TeamIntegration): void`.
- `IntegrationTokens`: `accessToken(TeamIntegration): string`, `refresh(TeamIntegration, ?string $staleToken = null): string`.

**Actions & events**
- `App\Actions\Integrations\SaveTeamIntegration::handle(Team, IntegrationProvider, User, array{status, access, credentials, settings, scopes}): TeamIntegration`.
- `App\Events\Integrations\IntegrationActivated` (`public TeamIntegration $integration`, `public bool $siteChanged`; `ShouldDispatchAfterCommit`) — dispatched when a Jira/Linear integration becomes active with write access (connect, upgrade, reconnect, site choice). **12d registers the listener that dispatches `MatchIntegrationUsers`** (`Event::listen` in `AppServiceProvider::boot`).
- `App\Actions\Integrations\PresentTeamIntegration::handle(TeamIntegration): array{id, provider, status, statusLabel, access, settings, connectedBy, connectedAt, lastCheckedAt, lastError}` with the public constant `SettingKeys` (per-provider whitelist; **12d appends `'priorityMap'` to `jira` and `linear`**).
- `App\Actions\Integrations\UpdateTeamIntegration`: `rules(TeamIntegration): array` and `handle(TeamIntegration, User, array $validated): TeamIntegration`; **12d adds the `priority_map` rule and branch** (both methods already `match` on the provider).
- `CheckIntegration::handle(TeamIntegration): void`, `DisconnectIntegration::handle(TeamIntegration): void`, `DetectJiraStoryPointFields::{handle, handleQuietly, applyOverride}`.

**HTTP**
- `TeamPolicy::manageIntegrations(User, Team): bool` (= `canManage($team->workspace)`).
- `EnsureIntegrationProviderEnabled` (optional parameter `:telegram` etc.; otherwise reads the route's `provider` or `integration`, else requires any provider enabled). All integration routes of 12a live in one `Route::middleware(EnsureIntegrationProviderEnabled::class)->group(…)` inside the `w/{workspace}` group: **12b–12d add their team-integration routes (`targets`, `user-mappings`, `accounts`, `priorities`) inside that group**; routes outside it (retro/poker/workspace) add `->middleware(EnsureIntegrationProviderEnabled::class.':slack')` or check `IntegrationProvider::isEnabled()` themselves.
- Controllers in `app/Http/Controllers/Integrations/`; `{integration}` is scoped to `{team}` (`Team::integrations()`).

**Frontend**
- Types in `resources/js/types/integrations.ts` (exported from `@/types`): `IntegrationProviderKey`, `IntegrationStatus`, `IntegrationAccess`, `IntegrationSettings`, `TeamIntegration`, `IntegrationProviderCard`, `IntegrationScope` (`{workspace: string; team: string}`), `TelegramBotInfo`, `TelegramConnectCode`, `JiraSite`, `JiraField`.
- `resources/js/lib/integrations.ts`: `integrationErrorMessage(error: unknown, fallback: string): string`.
- Components in `resources/js/components/integrations/`: `IntegrationCard` (props `icon`, `card`, `children`, `actions`), `IntegrationDetails` (props `rows`, `connection`), `ConnectLink`, `TestConnectionButton`, `DisconnectIntegrationDialog`, `SlackIntegration`, `TelegramIntegration`, `JiraIntegration`, `LinearIntegration`. **12d mounts its People and Priorities panels in `jira-integration.tsx` and `linear-integration.tsx` right after `<IntegrationDetails …/>`**, shown when `connection.status === 'active' && connection.access === 'write'`.
- Page `teams/integrations` props: `workspace`, `team`, `providers: IntegrationProviderCard[]`, `telegram: TelegramBotInfo | null`. `teams/show` gains `canManageIntegrations: boolean`.

**Pest helpers (`tests/Pest.php`)**: `disableIntegrations(): void`, `enableIntegrations(IntegrationProvider ...$providers): void` (fake credentials: Slack `slack-client`/`slack-secret`, Telegram `123456:telegram-token`, Jira `jira-client`/`jira-secret`, Linear `linear-client`/`linear-secret`), `integrationAdmin(Team): User` (a workspace Admin who is also a team member), `integrationOAuthSession(Team, IntegrationProvider, IntegrationAccess = Write, string $state = …, int $expiresInMinutes = 10): array`.

---
### Task 1: Configuration and `IntegrationProvider`

**Files:**
- Create: `app/Enums/IntegrationProvider.php`, `app/Support/Integrations/IntegrationAvailability.php`
- Modify: `config/services.php`, `.env.example`, `phpunit.xml`, `tests/Pest.php`
- Test: create `tests/Feature/Integrations/IntegrationProviderTest.php`

**Interfaces:**
- Consumes: `config/services.php` (existing `slack.notifications` block untouched), `mail.default`.
- Produces: `IntegrationProvider` (see Contract), `IntegrationAvailability::emailEnabled(): bool`, config keys `services.slack.{client_id,client_secret,redirect}`, `services.telegram.bot_token`, `services.jira.{client_id,client_secret,redirect}`, `services.linear.{client_id,client_secret,redirect}`; Pest helpers `disableIntegrations()`, `enableIntegrations(IntegrationProvider ...$providers)`.

- [ ] **Step 1: Create the branch**

```bash
git switch main
git switch -c feat/plan-12-integrations
```

- [ ] **Step 2: Add the Pest helpers**

In `tests/Pest.php`, add `use App\Enums\IntegrationProvider;` to the imports (alphabetical order) and append at the end of the file:

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
        });
    }
}
```

In `phpunit.xml`, after `<env name="SKRUM_LLM_API_KEY" value=""/>`, add so that a developer's `.env` never enables a provider in tests:

```xml
        <env name="SLACK_CLIENT_ID" value=""/>
        <env name="SLACK_CLIENT_SECRET" value=""/>
        <env name="TELEGRAM_BOT_TOKEN" value=""/>
        <env name="JIRA_CLIENT_ID" value=""/>
        <env name="JIRA_CLIENT_SECRET" value=""/>
        <env name="LINEAR_CLIENT_ID" value=""/>
        <env name="LINEAR_CLIENT_SECRET" value=""/>
```

- [ ] **Step 3: Write the failing test**

Create `tests/Feature/Integrations/IntegrationProviderTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('enables a provider only when its configuration is complete', function (IntegrationProvider $provider, array $config) {
    disableIntegrations();

    expect($provider->isEnabled())->toBeFalse()
        ->and(IntegrationProvider::enabled())->toBe([])
        ->and(IntegrationProvider::anyEnabled())->toBeFalse();

    foreach (array_keys($config) as $missingKey) {
        config([...$config, $missingKey => null]);

        expect($provider->isEnabled())->toBeFalse();
    }

    config($config);

    expect($provider->isEnabled())->toBeTrue()
        ->and(IntegrationProvider::enabled())->toBe([$provider])
        ->and(IntegrationProvider::anyEnabled())->toBeTrue();
})->with([
    'slack' => [IntegrationProvider::Slack, ['services.slack.client_id' => 'id', 'services.slack.client_secret' => 'secret']],
    'telegram' => [IntegrationProvider::Telegram, ['services.telegram.bot_token' => '1:token']],
    'jira' => [IntegrationProvider::Jira, ['services.jira.client_id' => 'id', 'services.jira.client_secret' => 'secret']],
    'linear' => [IntegrationProvider::Linear, ['services.linear.client_id' => 'id', 'services.linear.client_secret' => 'secret']],
]);

it('lists enabled providers in a fixed order', function () {
    enableIntegrations(IntegrationProvider::Linear, IntegrationProvider::Slack);

    expect(IntegrationProvider::enabled())->toBe([IntegrationProvider::Slack, IntegrationProvider::Linear]);
});

it('describes each provider', function () {
    expect(IntegrationProvider::Slack->label())->toBe('Slack')
        ->and(IntegrationProvider::Telegram->label())->toBe('Telegram')
        ->and(IntegrationProvider::Jira->label())->toBe('Jira')
        ->and(IntegrationProvider::Linear->label())->toBe('Linear')
        ->and(IntegrationProvider::Slack->usesOAuth())->toBeTrue()
        ->and(IntegrationProvider::Telegram->usesOAuth())->toBeFalse()
        ->and(IntegrationProvider::Jira->isTracker())->toBeTrue()
        ->and(IntegrationProvider::Linear->isTracker())->toBeTrue()
        ->and(IntegrationProvider::Slack->isTracker())->toBeFalse()
        ->and(IntegrationProvider::Telegram->isChannel())->toBeTrue()
        ->and(IntegrationProvider::Jira->isChannel())->toBeFalse();
});

it('offers email results only with a mailer that delivers', function (string $mailer, bool $expected) {
    config(['mail.default' => $mailer]);

    expect(app(IntegrationAvailability::class)->emailEnabled())->toBe($expected);
})->with([
    'log' => ['log', false],
    'array' => ['array', false],
    'smtp' => ['smtp', true],
    'ses' => ['ses', true],
]);

it('uses fixed OAuth callback URLs', function () {
    expect(config('services.slack.redirect'))->toEndWith('/integrations/slack/callback')
        ->and(config('services.jira.redirect'))->toEndWith('/integrations/jira/callback')
        ->and(config('services.linear.redirect'))->toEndWith('/integrations/linear/callback')
        ->and(config('services.slack.notifications'))->toBeArray();
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationProviderTest.php`
Expected: FAIL — `Class "App\Enums\IntegrationProvider" not found`.

- [ ] **Step 5: Add the configuration**

In `config/services.php`, replace the `'slack'` block with:

```php
    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
        'client_id' => env('SLACK_CLIENT_ID'),
        'client_secret' => env('SLACK_CLIENT_SECRET'),
        'redirect' => rtrim((string) env('APP_URL', ''), '/').'/integrations/slack/callback',
    ],

    'telegram' => [
        'bot_token' => env('TELEGRAM_BOT_TOKEN'),
    ],

    'jira' => [
        'client_id' => env('JIRA_CLIENT_ID'),
        'client_secret' => env('JIRA_CLIENT_SECRET'),
        'redirect' => rtrim((string) env('APP_URL', ''), '/').'/integrations/jira/callback',
    ],

    'linear' => [
        'client_id' => env('LINEAR_CLIENT_ID'),
        'client_secret' => env('LINEAR_CLIENT_SECRET'),
        'redirect' => rtrim((string) env('APP_URL', ''), '/').'/integrations/linear/callback',
    ],
```

In `.env.example`, insert before the line `# Single sign-on — a provider is enabled when all its values are set.`:

```
# Integrations (optional). A provider appears on each team's integrations page
# (workspace Owners/Admins only) when all its values are set. Every call goes
# from Skrum's server; tokens are stored encrypted with APP_KEY (keep
# APP_PREVIOUS_KEYS when you rotate it, otherwise teams must reconnect).
# Slack: create an app with the "incoming-webhook" scope and the redirect URL
# ${APP_URL}/integrations/slack/callback (Slack requires an HTTPS URL).
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
# Telegram: create a bot with @BotFather. Use it for this Skrum instance only and
# never set a webhook on it: the scheduler polls it every minute.
TELEGRAM_BOT_TOKEN=
# Jira Cloud: an OAuth 2.0 (3LO) app on developer.atlassian.com with the callback
# ${APP_URL}/integrations/jira/callback and the scopes read:jira-work,
# write:jira-work, read:jira-user, read:board-scope:jira-software and
# read:sprint:jira-software.
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=
# Linear: an OAuth application (Linear settings → API) with the callback
# ${APP_URL}/integrations/linear/callback.
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=
# Emailing retrospective results needs a mailer that delivers (not log or array).

```

- [ ] **Step 6: Create the enum and the availability helper**

Create `app/Enums/IntegrationProvider.php`:

```php
<?php

namespace App\Enums;

enum IntegrationProvider: string
{
    case Slack = 'slack';
    case Telegram = 'telegram';
    case Jira = 'jira';
    case Linear = 'linear';

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
        };
    }

    public function isEnabled(): bool
    {
        foreach ($this->requiredConfigKeys() as $key) {
            if (blank(config($key))) {
                return false;
            }
        }

        return true;
    }

    public function usesOAuth(): bool
    {
        return $this !== self::Telegram;
    }

    public function isTracker(): bool
    {
        return $this === self::Jira || $this === self::Linear;
    }

    public function isChannel(): bool
    {
        return $this === self::Slack || $this === self::Telegram;
    }

    /**
     * @return array<int, string>
     */
    private function requiredConfigKeys(): array
    {
        return match ($this) {
            self::Slack => ['services.slack.client_id', 'services.slack.client_secret'],
            self::Telegram => ['services.telegram.bot_token'],
            self::Jira => ['services.jira.client_id', 'services.jira.client_secret'],
            self::Linear => ['services.linear.client_id', 'services.linear.client_secret'],
        };
    }
}
```

Create `app/Support/Integrations/IntegrationAvailability.php`:

```php
<?php

namespace App\Support\Integrations;

class IntegrationAvailability
{
    private const NonDeliveringMailers = ['log', 'array'];

    public function emailEnabled(): bool
    {
        return ! in_array(config('mail.default'), self::NonDeliveringMailers, true);
    }
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationProviderTest.php`
Expected: PASS (5 tests, 15 assertions sets).

- [ ] **Step 8: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Enums/IntegrationProvider.php app/Support/Integrations/IntegrationAvailability.php config/services.php .env.example phpunit.xml tests/Pest.php tests/Feature/Integrations/IntegrationProviderTest.php
git commit -m "feat: add integration providers and their configuration

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 2: Provider errors (`IntegrationErrors`, `ProviderHttp`, exception hierarchy)

**Files:**
- Create: `app/Support/Integrations/IntegrationErrors.php`, `app/Support/Integrations/ProviderHttp.php`, `app/Support/Integrations/Exceptions/{IntegrationException,ReconnectRequired,RateLimited,ProviderRejected,ProviderUnavailable,TelegramConflict,NotConnected,ReadOnlyConnection,ConnectionRefused}.php`
- Modify: `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/IntegrationErrorsTest.php`

**Interfaces:**
- Consumes: `IntegrationProvider::label()` (Task 1).
- Produces: see Contract ("Support classes"). Exceptions never keep the previous exception (a `ConnectionException` message contains the request URL, which may hold the Telegram bot token).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/IntegrationErrorsTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReadOnlyConnection;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Exceptions\TelegramConflict;
use App\Support\Integrations\IntegrationErrors;
use App\Support\Integrations\ProviderHttp;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

function providerFailureFor(string $path): IntegrationException
{
    try {
        ProviderHttp::fail(IntegrationProvider::Jira, Http::get("https://provider.test/{$path}"));
    } catch (IntegrationException $exception) {
        return $exception;
    }

    throw new RuntimeException('ProviderHttp::fail() did not throw.');
}

it('removes secrets from provider errors', function (string $raw, string $expected) {
    expect(IntegrationErrors::sanitize($raw))->toBe($expected);
})->with([
    'query string' => [
        'GET https://api.atlassian.com/ex/jira/abc/rest/api/3/search?jql=secret&code=x failed',
        'GET https://api.atlassian.com/ex/jira/abc/rest/api/3/search failed',
    ],
    'slack webhook' => [
        'POST https://hooks.slack.com/services/T0/B0/XYZ returned 404',
        'POST https://hooks.slack.com/*** returned 404',
    ],
    'telegram bot token' => [
        'cURL error 28 for https://api.telegram.org/bot123456:ABC-def_ghi/getUpdates',
        'cURL error 28 for https://api.telegram.org/bot***/getUpdates',
    ],
    'bearer header' => ['Authorization: Bearer abc.def.ghi rejected', 'Authorization: Bearer *** rejected'],
    'slack token' => ['token xoxp-1234-abcd was revoked', 'token xox*** was revoked'],
    'form secrets' => ['body client_secret=s3cr3t&refresh_token=r1&grant_type=refresh_token', 'body client_secret=***&refresh_token=***&grant_type=refresh_token'],
]);

it('keeps sanitized errors within 500 characters', function () {
    $sanitized = IntegrationErrors::sanitize(str_repeat('a', 800));

    expect(mb_strlen($sanitized))->toBe(500)
        ->and($sanitized)->toEndWith('...');
});

it('renders integration failures as translated JSON errors', function () {
    $cases = [
        [new ReconnectRequired(IntegrationProvider::Slack, 'token_revoked'), 409, 'Reconnect Slack in the team settings.'],
        [new NotConnected(IntegrationProvider::Jira), 409, 'Connect Jira in the team settings.'],
        [new ReadOnlyConnection(IntegrationProvider::Linear), 409, 'This Linear connection is read-only.'],
        [new RateLimited(IntegrationProvider::Jira, 12), 429, 'Too many requests to Jira, wait a moment.'],
        [new ProviderUnavailable(IntegrationProvider::Telegram), 502, 'Telegram did not respond. Try again later.'],
        [new ProviderRejected(IntegrationProvider::Jira, 'The JQL is invalid.'), 422, 'The JQL is invalid.'],
        [new TelegramConflict, 409, 'The Telegram bot is used elsewhere. Remove its webhook or use a dedicated bot.'],
    ];

    foreach ($cases as [$exception, $status, $message]) {
        $response = $exception->render(request());

        expect($response->getStatusCode())->toBe($status)
            ->and($response->getData(true))->toBe(['message' => $message]);
    }
});

it('maps provider responses to integration failures', function () {
    Http::fake([
        'provider.test/rate' => Http::response(['message' => 'slow down'], 429, ['Retry-After' => '12']),
        'provider.test/down' => Http::response('oops', 503),
        'provider.test/auth' => Http::response(['message' => 'expired'], 401),
        'provider.test/bad' => Http::response(['errorMessages' => ['The JQL is invalid.'], 'errors' => ['assignee' => 'Not assignable']], 400),
    ]);

    $rateLimited = providerFailureFor('rate');
    $unavailable = providerFailureFor('down');
    $reconnect = providerFailureFor('auth');
    $rejected = providerFailureFor('bad');

    expect($rateLimited)->toBeInstanceOf(RateLimited::class)
        ->and($rateLimited->retryAfter)->toBe(12)
        ->and($unavailable)->toBeInstanceOf(ProviderUnavailable::class)
        ->and($unavailable->timedOut)->toBeFalse()
        ->and($reconnect)->toBeInstanceOf(ReconnectRequired::class)
        ->and($reconnect->detail())->toBe('expired')
        ->and($rejected)->toBeInstanceOf(ProviderRejected::class)
        ->and($rejected->detail())->toBe('The JQL is invalid.')
        ->and($rejected->httpStatus)->toBe(400)
        ->and($rejected->errors)->toBe(['assignee' => 'Not assignable']);
});

it('reports connection failures without the requested URL secrets', function () {
    Http::fake(['api.telegram.org/*' => Http::failedConnection('cURL error 28 for https://api.telegram.org/bot123456:telegram-token/getMe')]);

    try {
        ProviderHttp::send(IntegrationProvider::Telegram, fn () => Http::get('https://api.telegram.org/bot123456:telegram-token/getMe'));
        $this->fail('No exception was thrown.');
    } catch (ProviderUnavailable $exception) {
        expect($exception->timedOut)->toBeTrue()
            ->and($exception->getMessage())->not->toContain('telegram-token')
            ->and($exception->getPrevious())->toBeNull();
    }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationErrorsTest.php`
Expected: FAIL — `Class "App\Support\Integrations\IntegrationErrors" not found`.

- [ ] **Step 3: Create the sanitizer and the HTTP helper**

Create `app/Support/Integrations/IntegrationErrors.php`:

```php
<?php

namespace App\Support\Integrations;

use Illuminate\Support\Str;

class IntegrationErrors
{
    private const MaxLength = 500;

    /**
     * @var array<string, string>
     */
    private const Patterns = [
        '#https://hooks\.slack\.com/\S+#i' => 'https://hooks.slack.com/***',
        '#bot\d+:[A-Za-z0-9_-]+#' => 'bot***',
        '#\bxox[a-z]-[A-Za-z0-9-]+#i' => 'xox***',
        '#\bBearer\s+[^\s,;"\']+#i' => 'Bearer ***',
        '#\b(access_token|refresh_token|client_secret|code)=[^&\s"\']+#i' => '$1=***',
        '#(https?://[^\s?\#"\']+)[?\#][^\s"\']*#i' => '$1',
    ];

    public static function sanitize(string $message): string
    {
        $clean = $message;

        foreach (self::Patterns as $pattern => $replacement) {
            $clean = preg_replace($pattern, $replacement, $clean) ?? $clean;
        }

        return Str::limit(trim($clean), self::MaxLength - 3, '...');
    }
}
```

Create `app/Support/Integrations/ProviderHttp.php`:

```php
<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationProvider;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use Closure;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class ProviderHttp
{
    private const ConnectTimeoutSeconds = 5;

    /**
     * @var array<int, string>
     */
    private const MessagePaths = ['errorMessages.0', 'message', 'error_description', 'error', 'description', 'errors.0.message'];

    public static function request(int $timeout = 15): PendingRequest
    {
        return Http::timeout($timeout)
            ->connectTimeout(self::ConnectTimeoutSeconds)
            ->acceptJson();
    }

    /**
     * @param  Closure(): Response  $send
     */
    public static function send(IntegrationProvider $provider, Closure $send): Response
    {
        try {
            return $send();
        } catch (ConnectionException $exception) {
            throw new ProviderUnavailable($provider, $exception->getMessage(), timedOut: true);
        }
    }

    public static function fail(IntegrationProvider $provider, Response $response, ?string $message = null): never
    {
        $detail = $message ?? self::message($response);

        if ($response->status() === 429) {
            throw new RateLimited($provider, self::retryAfter($response), $detail);
        }

        if ($response->serverError()) {
            throw new ProviderUnavailable($provider, $detail);
        }

        if ($response->status() === 401) {
            throw new ReconnectRequired($provider, $detail);
        }

        $errors = $response->json('errors');

        throw new ProviderRejected($provider, $detail, $response->status(), is_array($errors) ? $errors : []);
    }

    public static function retryAfter(Response $response, int $default = 30): int
    {
        $header = $response->header('Retry-After');

        return is_numeric($header) ? max(1, (int) $header) : $default;
    }

    public static function message(Response $response): string
    {
        $payload = $response->json();

        if (is_array($payload)) {
            foreach (self::MessagePaths as $path) {
                $value = data_get($payload, $path);

                if (is_string($value) && $value !== '') {
                    return $value;
                }
            }
        }

        return "HTTP {$response->status()}";
    }
}
```

- [ ] **Step 4: Create the exceptions**

Create `app/Support/Integrations/Exceptions/IntegrationException.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

use App\Enums\IntegrationProvider;
use App\Support\Integrations\IntegrationErrors;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * The message is the sanitized provider detail; the previous exception is
 * deliberately dropped because connection errors quote the request URL.
 */
abstract class IntegrationException extends RuntimeException
{
    public function __construct(public IntegrationProvider $provider, ?string $detail = null)
    {
        parent::__construct($detail === null ? '' : IntegrationErrors::sanitize($detail));
    }

    abstract public function status(): int;

    abstract public function userMessage(): string;

    public function detail(): ?string
    {
        return $this->getMessage() === '' ? null : $this->getMessage();
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json(['message' => $this->userMessage()], $this->status());
    }
}
```

Create `app/Support/Integrations/Exceptions/ReconnectRequired.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

class ReconnectRequired extends IntegrationException
{
    public function status(): int
    {
        return 409;
    }

    public function userMessage(): string
    {
        return __('Reconnect :provider in the team settings.', ['provider' => $this->provider->label()]);
    }
}
```

Create `app/Support/Integrations/Exceptions/RateLimited.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

use App\Enums\IntegrationProvider;

class RateLimited extends IntegrationException
{
    public function __construct(IntegrationProvider $provider, public int $retryAfter, ?string $detail = null)
    {
        parent::__construct($provider, $detail);
    }

    public function status(): int
    {
        return 429;
    }

    public function userMessage(): string
    {
        return __('Too many requests to :provider, wait a moment.', ['provider' => $this->provider->label()]);
    }
}
```

Create `app/Support/Integrations/Exceptions/ProviderRejected.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

use App\Enums\IntegrationProvider;

class ProviderRejected extends IntegrationException
{
    /**
     * @param  array<array-key, mixed>  $errors  the provider's structured errors (Jira field map, GraphQL error list)
     */
    public function __construct(IntegrationProvider $provider, string $detail, public int $httpStatus = 422, public array $errors = [])
    {
        parent::__construct($provider, $detail);
    }

    public function status(): int
    {
        return 422;
    }

    public function userMessage(): string
    {
        return $this->detail() ?? __(':provider refused the request.', ['provider' => $this->provider->label()]);
    }
}
```

Create `app/Support/Integrations/Exceptions/ProviderUnavailable.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

use App\Enums\IntegrationProvider;

class ProviderUnavailable extends IntegrationException
{
    public function __construct(IntegrationProvider $provider, ?string $detail = null, public bool $timedOut = false)
    {
        parent::__construct($provider, $detail);
    }

    public function status(): int
    {
        return 502;
    }

    public function userMessage(): string
    {
        return __(':provider did not respond. Try again later.', ['provider' => $this->provider->label()]);
    }
}
```

Create `app/Support/Integrations/Exceptions/TelegramConflict.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

use App\Enums\IntegrationProvider;

class TelegramConflict extends IntegrationException
{
    public function __construct(?string $detail = null)
    {
        parent::__construct(IntegrationProvider::Telegram, $detail);
    }

    public function status(): int
    {
        return 409;
    }

    public function userMessage(): string
    {
        return __('The Telegram bot is used elsewhere. Remove its webhook or use a dedicated bot.');
    }
}
```

Create `app/Support/Integrations/Exceptions/NotConnected.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

class NotConnected extends IntegrationException
{
    public function status(): int
    {
        return 409;
    }

    public function userMessage(): string
    {
        return __('Connect :provider in the team settings.', ['provider' => $this->provider->label()]);
    }
}
```

Create `app/Support/Integrations/Exceptions/ReadOnlyConnection.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

class ReadOnlyConnection extends IntegrationException
{
    public function status(): int
    {
        return 409;
    }

    public function userMessage(): string
    {
        return __('This :provider connection is read-only.', ['provider' => $this->provider->label()]);
    }
}
```

Create `app/Support/Integrations/Exceptions/ConnectionRefused.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

use RuntimeException;

/**
 * An OAuth callback that reached the provider but cannot become a
 * connection; the message is translated and shown to the admin as is.
 */
class ConnectionRefused extends RuntimeException {}
```

- [ ] **Step 5: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `Reconnect :provider in the team settings.` | `Reconnectez :provider dans les paramètres de l'équipe.` | `Vuelve a conectar :provider en los ajustes del equipo.` | `Verbinde :provider in den Teameinstellungen erneut.` |
| `Too many requests to :provider, wait a moment.` | `Trop de requêtes vers :provider, patientez un instant.` | `Demasiadas solicitudes a :provider, espera un momento.` | `Zu viele Anfragen an :provider, warte einen Moment.` |
| `:provider refused the request.` | `:provider a refusé la demande.` | `:provider rechazó la solicitud.` | `:provider hat die Anfrage abgelehnt.` |
| `:provider did not respond. Try again later.` | `:provider n'a pas répondu. Réessayez plus tard.` | `:provider no respondió. Inténtalo más tarde.` | `:provider hat nicht geantwortet. Versuche es später erneut.` |
| `The Telegram bot is used elsewhere. Remove its webhook or use a dedicated bot.` | `Le bot Telegram est utilisé ailleurs. Supprimez son webhook ou utilisez un bot dédié.` | `El bot de Telegram se usa en otro sitio. Elimina su webhook o usa un bot dedicado.` | `Der Telegram-Bot wird anderswo verwendet. Entferne seinen Webhook oder nutze einen eigenen Bot.` |
| `Connect :provider in the team settings.` | `Connectez :provider dans les paramètres de l'équipe.` | `Conecta :provider en los ajustes del equipo.` | `Verbinde :provider in den Teameinstellungen.` |
| `This :provider connection is read-only.` | `Cette connexion :provider est en lecture seule.` | `Esta conexión con :provider es de solo lectura.` | `Diese :provider-Verbindung ist schreibgeschützt.` |

- [ ] **Step 6: Run the test to verify it passes**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationErrorsTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 7: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Integrations lang tests/Feature/Integrations/IntegrationErrorsTest.php
git commit -m "feat: add integration errors with sanitized provider details

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 3: Schema, models and factories

**Files:**
- Create: `database/migrations/2026_10_05_100000_create_integration_tables.php`, `database/migrations/2026_10_05_100100_add_integration_columns_to_poker_tasks_table.php`, `app/Enums/{IntegrationStatus,IntegrationAccess,IntegrationUserMatch,IntegrationDeliveryChannel,IntegrationDeliveryKind,IntegrationDeliveryStatus}.php`, `app/Models/{TeamIntegration,IntegrationUserMapping,ActionItemExternalLink,IntegrationDelivery}.php`, `database/factories/{TeamIntegrationFactory,IntegrationUserMappingFactory,ActionItemExternalLinkFactory,IntegrationDeliveryFactory}.php`
- Modify: `app/Models/{Team,ActionItem,PokerTask,Retro,PokerGame}.php`, `database/factories/PokerTaskFactory.php`, `app/Support/Integrations/IntegrationAvailability.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/IntegrationModelsTest.php`

**Interfaces:**
- Consumes: `IntegrationProvider` (Task 1), `ReconnectRequired`, `NotConnected`, `ReadOnlyConnection`, `IntegrationErrors` (Task 2).
- Produces: the tables, enums, models, factories and states of the Contract; `IntegrationAvailability::activeIntegration(Team, IntegrationProvider): ?TeamIntegration`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/IntegrationModelsTest.php`:

```php
<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\IntegrationUserMatch;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationUserMapping;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\ReadOnlyConnection;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('encrypts credentials at rest and never serializes them', function () {
    $integration = TeamIntegration::factory()->slack()->create();

    $stored = (string) DB::table('team_integrations')->where('id', $integration->id)->value('credentials');

    expect($stored)->not->toContain('xoxp-test-token')
        ->and($stored)->not->toContain('hooks.slack.com')
        ->and($integration->fresh()->credential('access_token'))->toBe('xoxp-test-token')
        ->and($integration->toArray())->not->toHaveKey('credentials')
        ->and($integration->toJson())->not->toContain('xoxp');
});

it('keeps one connection per provider and team', function () {
    $slack = TeamIntegration::factory()->slack()->create();

    expect(fn () => TeamIntegration::factory()->slack()->create(['team_id' => $slack->team_id]))
        ->toThrow(UniqueConstraintViolationException::class);

    $telegram = TeamIntegration::factory()->telegram()->create(['team_id' => $slack->team_id]);

    expect($slack->team->integration(IntegrationProvider::Slack)?->id)->toBe($slack->id)
        ->and($slack->team->integration(IntegrationProvider::Telegram)?->id)->toBe($telegram->id)
        ->and($slack->team->integration(IntegrationProvider::Jira))->toBeNull();
});

it('marks the integration reconnect-required when credentials cannot be decrypted', function () {
    $integration = TeamIntegration::factory()->slack()->create();
    $otherKey = new Encrypter(Encrypter::generateKey((string) config('app.cipher')), (string) config('app.cipher'));

    DB::table('team_integrations')->where('id', $integration->id)->update([
        'credentials' => $otherKey->encrypt(json_encode(['access_token' => 'xoxp-old']), false),
    ]);

    $unreadable = $integration->fresh();

    expect($unreadable->readableCredentials())->toBeNull()
        ->and($unreadable->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($unreadable->fresh()->last_error)->toBe('Stored credentials could not be read. Reconnect.')
        ->and(fn () => $unreadable->fresh()->credential('access_token'))->toThrow(ReconnectRequired::class);
});

it('marks the integration when a provider call loses access', function () {
    $integration = TeamIntegration::factory()->slack()->create();

    expect(fn () => $integration->withReconnectHandling(fn () => throw new ReconnectRequired(IntegrationProvider::Slack, 'token_revoked')))
        ->toThrow(ReconnectRequired::class);

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->last_error)->toBe('token_revoked');
});

it('tells active, writable and readable connections apart', function () {
    $write = TeamIntegration::factory()->jira()->create();
    $read = TeamIntegration::factory()->jira(IntegrationAccess::Read)->create();
    $broken = TeamIntegration::factory()->jira()->reconnectRequired()->create();
    $setup = TeamIntegration::factory()->setupRequired()->create();

    expect($write->canWrite())->toBeTrue()
        ->and($write->site())->toBe('cloud-1')
        ->and($write->hasScope('read:jira-user'))->toBeTrue()
        ->and($read->isActive())->toBeTrue()
        ->and($read->canWrite())->toBeFalse()
        ->and($read->hasScope('read:jira-user'))->toBeFalse()
        ->and($broken->isActive())->toBeFalse()
        ->and(fn () => $broken->ensureActive())->toThrow(ReconnectRequired::class)
        ->and(fn () => $setup->ensureActive())->toThrow(NotConnected::class)
        ->and(fn () => $read->ensureWritable())->toThrow(ReadOnlyConnection::class)
        ->and(TeamIntegration::factory()->linear()->create()->site())->toBe('org-1')
        ->and(TeamIntegration::factory()->telegram()->create()->site())->toBeNull();
});

it('finds the active integration of an enabled provider only', function () {
    $integration = TeamIntegration::factory()->slack()->create();
    $availability = app(IntegrationAvailability::class);

    expect($availability->activeIntegration($integration->team, IntegrationProvider::Slack))->toBeNull();

    enableIntegrations(IntegrationProvider::Slack);

    expect($availability->activeIntegration($integration->team, IntegrationProvider::Slack)?->id)->toBe($integration->id);

    $integration->markReconnectRequired('gone');

    expect($availability->activeIntegration($integration->team, IntegrationProvider::Slack))->toBeNull();
});

it('keeps account mappings per member and deletes them with the integration', function () {
    $integration = TeamIntegration::factory()->jira()->create();
    $user = User::factory()->create();
    $mapping = IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id, 'user_id' => $user->id]);
    $never = IntegrationUserMapping::factory()->neverAssign()->create(['team_integration_id' => $integration->id]);

    expect(fn () => IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id, 'user_id' => $user->id]))
        ->toThrow(UniqueConstraintViolationException::class);

    expect($integration->accountFor($user)?->id)->toBe($mapping->id)
        ->and($mapping->matched_by)->toBe(IntegrationUserMatch::Email)
        ->and($mapping->isNeverAssign())->toBeFalse()
        ->and($never->isNeverAssign())->toBeTrue();

    $integration->delete();

    expect(IntegrationUserMapping::query()->count())->toBe(0);
});

it('links an action item once per source', function () {
    $item = ActionItem::factory()->create();
    $link = ActionItemExternalLink::factory()->create(['action_item_id' => $item->id]);

    expect(fn () => ActionItemExternalLink::factory()->create(['action_item_id' => $item->id]))
        ->toThrow(UniqueConstraintViolationException::class);

    ActionItemExternalLink::factory()->linear()->create(['action_item_id' => $item->id]);

    expect($item->externalLinks()->count())->toBe(2)
        ->and($link->source)->toBe(IntegrationProvider::Jira);
});

it('stores the imported poker task columns', function () {
    $task = PokerTask::factory()->imported()->create();

    $task->forceFill(['needs_sync' => true, 'sync_error' => 'boom', 'synced_at' => now()])->save();

    $fresh = $task->fresh();

    expect($fresh->external_source)->toBe('jira')
        ->and($fresh->external_site)->toBe('cloud-1')
        ->and($fresh->external_key)->toStartWith('PROJ-')
        ->and($fresh->external_refreshed_at)->not->toBeNull()
        ->and($fresh->needs_sync)->toBeTrue()
        ->and($fresh->synced_at)->not->toBeNull();
});

it('records delivery outcomes', function () {
    $delivery = IntegrationDelivery::factory()->create();

    $delivery->markFailed('POST https://hooks.slack.com/services/T0/B0/XYZ returned 404');

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($delivery->fresh()->error)->toBe('POST https://hooks.slack.com/*** returned 404');

    $delivery->markSent(3);

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Sent)
        ->and($delivery->fresh()->recipient_count)->toBe(3)
        ->and($delivery->fresh()->error)->toBeNull()
        ->and($delivery->fresh()->sent_at)->not->toBeNull();
});

it('prunes deliveries older than 90 days', function () {
    IntegrationDelivery::factory()->create(['created_at' => now()->subDays(91)]);
    $recent = IntegrationDelivery::factory()->create(['created_at' => now()->subDays(89)]);

    $this->artisan('model:prune', ['--model' => [IntegrationDelivery::class]])->assertSuccessful();

    expect(IntegrationDelivery::query()->pluck('id')->all())->toBe([$recent->id]);
});

it('deletes deliveries with their retro or poker game', function () {
    $retro = Retro::factory()->create();
    $game = PokerGame::factory()->create(['team_id' => $retro->team_id]);
    IntegrationDelivery::factory()->forSubject($retro)->create();
    $gameDelivery = IntegrationDelivery::factory()->forSubject($game)->create();

    $retro->delete();

    expect(IntegrationDelivery::query()->pluck('id')->all())->toBe([$gameDelivery->id]);

    $game->delete();

    expect(IntegrationDelivery::query()->count())->toBe(0);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationModelsTest.php`
Expected: FAIL — `Class "App\Models\TeamIntegration" not found`.

- [ ] **Step 3: Create the migrations**

Create `database/migrations/2026_10_05_100000_create_integration_tables.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_integrations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 20);
            $table->string('status', 30);
            $table->string('access', 10);
            $table->text('credentials');
            $table->json('settings');
            $table->json('scopes');
            $table->foreignUuid('connected_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('last_error', 500)->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->timestamps();

            $table->unique(['team_id', 'provider']);
            $table->index(['provider', 'status']);
        });

        Schema::create('integration_user_mappings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_integration_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('external_account_id', 128)->nullable();
            $table->string('external_display_name', 255)->nullable();
            $table->string('matched_by', 20);
            $table->timestamp('checked_at');
            $table->timestamps();

            $table->unique(['team_integration_id', 'user_id']);
        });

        Schema::create('action_item_external_links', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('action_item_id')->constrained()->cascadeOnDelete();
            $table->string('source', 20);
            $table->string('external_site', 100);
            $table->string('external_id', 100);
            $table->string('external_key', 50);
            $table->string('external_url', 2048);
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['action_item_id', 'source']);
        });

        Schema::create('integration_deliveries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('channel', 20);
            $table->string('kind', 30);
            $table->uuidMorphs('subject');
            $table->foreignUuid('requested_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 10);
            $table->unsignedInteger('recipient_count')->nullable();
            $table->string('error', 500)->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index('created_at');
        });
    }
};
```

Create `database/migrations/2026_10_05_100100_add_integration_columns_to_poker_tasks_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('poker_tasks', function (Blueprint $table) {
            $table->string('external_site', 100)->nullable();
            $table->string('external_key', 50)->nullable();
            $table->string('external_assignee', 100)->nullable();
            $table->string('external_estimate', 16)->nullable();
            $table->timestamp('external_refreshed_at')->nullable();
            $table->boolean('needs_sync')->default(false);
            $table->string('sync_error', 500)->nullable();
            $table->timestamp('synced_at')->nullable();
        });
    }
};
```

- [ ] **Step 4: Create the enums**

Create `app/Enums/IntegrationStatus.php`:

```php
<?php

namespace App\Enums;

enum IntegrationStatus: string
{
    case Active = 'active';
    case SetupRequired = 'setup_required';
    case ReconnectRequired = 'reconnect_required';

    public function label(): string
    {
        return match ($this) {
            self::Active => __('Connected'),
            self::SetupRequired => __('Setup required'),
            self::ReconnectRequired => __('Reconnect required'),
        };
    }
}
```

Create `app/Enums/IntegrationAccess.php`:

```php
<?php

namespace App\Enums;

enum IntegrationAccess: string
{
    case Read = 'read';
    case Write = 'write';
}
```

Create `app/Enums/IntegrationUserMatch.php`:

```php
<?php

namespace App\Enums;

enum IntegrationUserMatch: string
{
    case Email = 'email';
    case Manual = 'manual';
}
```

Create `app/Enums/IntegrationDeliveryChannel.php`:

```php
<?php

namespace App\Enums;

enum IntegrationDeliveryChannel: string
{
    case Slack = 'slack';
    case Telegram = 'telegram';
    case Email = 'email';
}
```

Create `app/Enums/IntegrationDeliveryKind.php`:

```php
<?php

namespace App\Enums;

enum IntegrationDeliveryKind: string
{
    case RetroLink = 'retro_link';
    case PokerLink = 'poker_link';
    case RetroResults = 'retro_results';
    case GameRoomLink = 'game_room_link';
}
```

Create `app/Enums/IntegrationDeliveryStatus.php`:

```php
<?php

namespace App\Enums;

enum IntegrationDeliveryStatus: string
{
    case Queued = 'queued';
    case Sent = 'sent';
    case Failed = 'failed';
}
```

- [ ] **Step 5: Create the models**

Create `app/Models/TeamIntegration.php`:

```php
<?php

namespace App\Models;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\ReadOnlyConnection;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationErrors;
use Closure;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Credentials are read only through credential()/readableCredentials(), so
 * a key rotation without APP_PREVIOUS_KEYS turns into "Reconnect required"
 * instead of an exception.
 *
 * @property string $id
 * @property string $team_id
 * @property IntegrationProvider $provider
 * @property IntegrationStatus $status
 * @property IntegrationAccess $access
 * @property array<string, mixed> $credentials
 * @property array<string, mixed> $settings
 * @property array<int, string> $scopes
 * @property string|null $connected_by_user_id
 * @property string|null $last_error
 * @property Carbon|null $last_checked_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Team $team
 * @property-read User|null $connectedBy
 */
#[Fillable(['provider', 'status', 'access', 'credentials', 'settings', 'scopes', 'connected_by_user_id', 'last_error', 'last_checked_at'])]
#[Hidden(['credentials'])]
class TeamIntegration extends Model
{
    /** @use HasFactory<TeamIntegrationFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<User, $this> */
    public function connectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'connected_by_user_id');
    }

    /** @return HasMany<IntegrationUserMapping, $this> */
    public function userMappings(): HasMany
    {
        return $this->hasMany(IntegrationUserMapping::class);
    }

    public function accountFor(User $user): ?IntegrationUserMapping
    {
        return $this->userMappings()->where('user_id', $user->id)->first();
    }

    public function isActive(): bool
    {
        return $this->status === IntegrationStatus::Active;
    }

    public function canWrite(): bool
    {
        return $this->isActive() && $this->access === IntegrationAccess::Write;
    }

    public function hasScope(string $scope): bool
    {
        return in_array($scope, $this->scopes, true);
    }

    public function setting(string $key, mixed $default = null): mixed
    {
        return data_get($this->settings, $key, $default);
    }

    public function site(): ?string
    {
        $site = match ($this->provider) {
            IntegrationProvider::Jira => $this->setting('cloudId'),
            IntegrationProvider::Linear => $this->setting('organizationId'),
            default => null,
        };

        return is_string($site) && $site !== '' ? $site : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function readableCredentials(): ?array
    {
        try {
            return $this->credentials;
        } catch (DecryptException) {
            $this->markReconnectRequired(__('Stored credentials could not be read. Reconnect.'));

            return null;
        }
    }

    public function credential(string $key): mixed
    {
        $credentials = $this->readableCredentials();

        if ($credentials === null) {
            throw new ReconnectRequired($this->provider, $this->last_error);
        }

        return $credentials[$key] ?? null;
    }

    public function markReconnectRequired(?string $error): void
    {
        $this->forceFill([
            'status' => IntegrationStatus::ReconnectRequired,
            'last_error' => $error === null ? null : IntegrationErrors::sanitize($error),
        ])->save();
    }

    public function markChecked(): void
    {
        $this->forceFill(['last_checked_at' => now(), 'last_error' => null])->save();
    }

    public function ensureActive(): void
    {
        if ($this->status === IntegrationStatus::ReconnectRequired) {
            throw new ReconnectRequired($this->provider, $this->last_error);
        }

        if (! $this->isActive()) {
            throw new NotConnected($this->provider);
        }
    }

    public function ensureWritable(): void
    {
        $this->ensureActive();

        if ($this->access !== IntegrationAccess::Write) {
            throw new ReadOnlyConnection($this->provider);
        }
    }

    /**
     * @template TResult
     *
     * @param  Closure(): TResult  $call
     * @return TResult
     */
    public function withReconnectHandling(Closure $call): mixed
    {
        try {
            return $call();
        } catch (ReconnectRequired $exception) {
            if ($this->exists && $this->status !== IntegrationStatus::ReconnectRequired) {
                $this->markReconnectRequired($exception->detail() ?? $exception->userMessage());
            }

            throw $exception;
        }
    }

    protected function casts(): array
    {
        return [
            'provider' => IntegrationProvider::class,
            'status' => IntegrationStatus::class,
            'access' => IntegrationAccess::class,
            'credentials' => 'encrypted:array',
            'settings' => 'array',
            'scopes' => 'array',
            'last_checked_at' => 'datetime',
        ];
    }
}
```

Create `app/Models/IntegrationUserMapping.php`:

```php
<?php

namespace App\Models;

use App\Enums\IntegrationUserMatch;
use Database\Factories\IntegrationUserMappingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_integration_id
 * @property string $user_id
 * @property string|null $external_account_id
 * @property string|null $external_display_name
 * @property IntegrationUserMatch $matched_by
 * @property Carbon $checked_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read TeamIntegration $integration
 * @property-read User $user
 */
#[Fillable(['user_id', 'external_account_id', 'external_display_name', 'matched_by', 'checked_at'])]
class IntegrationUserMapping extends Model
{
    /** @use HasFactory<IntegrationUserMappingFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<TeamIntegration, $this> */
    public function integration(): BelongsTo
    {
        return $this->belongsTo(TeamIntegration::class, 'team_integration_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isNeverAssign(): bool
    {
        return $this->matched_by === IntegrationUserMatch::Manual && $this->external_account_id === null;
    }

    protected function casts(): array
    {
        return [
            'matched_by' => IntegrationUserMatch::class,
            'checked_at' => 'datetime',
        ];
    }
}
```

Create `app/Models/ActionItemExternalLink.php`:

```php
<?php

namespace App\Models;

use App\Enums\IntegrationProvider;
use Database\Factories\ActionItemExternalLinkFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $action_item_id
 * @property IntegrationProvider $source
 * @property string $external_site
 * @property string $external_id
 * @property string $external_key
 * @property string $external_url
 * @property string|null $created_by_user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read ActionItem $actionItem
 * @property-read User|null $createdBy
 */
#[Fillable(['source', 'external_site', 'external_id', 'external_key', 'external_url', 'created_by_user_id'])]
class ActionItemExternalLink extends Model
{
    /** @use HasFactory<ActionItemExternalLinkFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<ActionItem, $this> */
    public function actionItem(): BelongsTo
    {
        return $this->belongsTo(ActionItem::class);
    }

    /** @return BelongsTo<User, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    protected function casts(): array
    {
        return [
            'source' => IntegrationProvider::class,
        ];
    }
}
```

Create `app/Models/IntegrationDelivery.php`:

```php
<?php

namespace App\Models;

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Support\Integrations\IntegrationErrors;
use Database\Factories\IntegrationDeliveryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property IntegrationDeliveryChannel $channel
 * @property IntegrationDeliveryKind $kind
 * @property string $subject_type
 * @property string $subject_id
 * @property string|null $requested_by_user_id
 * @property IntegrationDeliveryStatus $status
 * @property int|null $recipient_count
 * @property string|null $error
 * @property Carbon|null $sent_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Team $team
 * @property-read Model|null $subject
 * @property-read User|null $requestedBy
 */
#[Fillable(['team_id', 'channel', 'kind', 'subject_type', 'subject_id', 'requested_by_user_id', 'status', 'recipient_count', 'error', 'sent_at'])]
class IntegrationDelivery extends Model
{
    /** @use HasFactory<IntegrationDeliveryFactory> */
    use HasFactory;

    use HasUuids;
    use Prunable;

    private const RetentionDays = 90;

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return MorphTo<Model, $this> */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    /** @return BelongsTo<User, $this> */
    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    public function markSent(?int $recipientCount = null): void
    {
        $this->forceFill([
            'status' => IntegrationDeliveryStatus::Sent,
            'sent_at' => now(),
            'error' => null,
            'recipient_count' => $recipientCount ?? $this->recipient_count,
        ])->save();
    }

    public function markFailed(string $error): void
    {
        $this->forceFill([
            'status' => IntegrationDeliveryStatus::Failed,
            'error' => IntegrationErrors::sanitize($error),
        ])->save();
    }

    /** @return Builder<static> */
    public function prunable(): Builder
    {
        return static::query()->where('created_at', '<', now()->subDays(self::RetentionDays));
    }

    protected function casts(): array
    {
        return [
            'channel' => IntegrationDeliveryChannel::class,
            'kind' => IntegrationDeliveryKind::class,
            'status' => IntegrationDeliveryStatus::class,
            'recipient_count' => 'integer',
            'sent_at' => 'datetime',
        ];
    }
}
```

- [ ] **Step 6: Wire the existing models**

In `app/Models/Team.php`, add the imports `App\Enums\IntegrationProvider` and the two methods after `pokerDecks()`:

```php
    /** @return HasMany<TeamIntegration, $this> */
    public function integrations(): HasMany
    {
        return $this->hasMany(TeamIntegration::class);
    }

    public function integration(IntegrationProvider $provider): ?TeamIntegration
    {
        return $this->integrations()->where('provider', $provider->value)->first();
    }
```

In `app/Models/ActionItem.php`, import `Illuminate\Database\Eloquent\Collection`, add `@property-read Collection<int, ActionItemExternalLink> $externalLinks` to the class docblock, and add after `comments()`:

```php
    /** @return HasMany<ActionItemExternalLink, $this> */
    public function externalLinks(): HasMany
    {
        return $this->hasMany(ActionItemExternalLink::class);
    }
```

In `app/Models/PokerTask.php`, extend the class docblock after `@property string|null $external_url`:

```php
 * @property string|null $external_site
 * @property string|null $external_key
 * @property string|null $external_assignee
 * @property string|null $external_estimate
 * @property Carbon|null $external_refreshed_at
 * @property bool $needs_sync
 * @property string|null $sync_error
 * @property Carbon|null $synced_at
```

and change the first docblock sentence to "The external_*, needs_sync, sync_error and synced_at columns are written only by the tracker imports and write-back of spec 6, never from a request, so they are not fillable." Extend `casts()`:

```php
    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'estimate_numeric' => 'float',
            'estimated_at' => 'datetime',
            'external_refreshed_at' => 'datetime',
            'needs_sync' => 'boolean',
            'synced_at' => 'datetime',
        ];
    }
```

In `app/Models/Retro.php` add (`IntegrationDelivery` is in the same namespace):

```php
    protected static function booted(): void
    {
        static::deleting(function (Retro $retro): void {
            IntegrationDelivery::query()->whereMorphedTo('subject', $retro)->delete();
        });
    }
```

In `app/Models/PokerGame.php` add:

```php
    protected static function booted(): void
    {
        static::deleting(function (PokerGame $game): void {
            IntegrationDelivery::query()->whereMorphedTo('subject', $game)->delete();
        });
    }
```

Extend `app/Support/Integrations/IntegrationAvailability.php`:

```php
<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\Team;
use App\Models\TeamIntegration;

class IntegrationAvailability
{
    private const NonDeliveringMailers = ['log', 'array'];

    public function emailEnabled(): bool
    {
        return ! in_array(config('mail.default'), self::NonDeliveringMailers, true);
    }

    public function activeIntegration(Team $team, IntegrationProvider $provider): ?TeamIntegration
    {
        if (! $provider->isEnabled()) {
            return null;
        }

        $integration = $team->integration($provider);

        return $integration !== null && $integration->isActive() ? $integration : null;
    }
}
```

- [ ] **Step 7: Create the factories**

Create `database/factories/TeamIntegrationFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\Linear\LinearClient;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamIntegration>
 */
class TeamIntegrationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            ...$this->slackAttributes(),
        ];
    }

    public function slack(): static
    {
        return $this->state(fn () => $this->slackAttributes());
    }

    public function telegram(): static
    {
        return $this->state(fn () => [
            'provider' => IntegrationProvider::Telegram,
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => [],
            'settings' => ['chatId' => '-100123', 'chatTitle' => 'Team chat', 'chatType' => 'supergroup'],
            'scopes' => [],
        ]);
    }

    public function jira(IntegrationAccess $access = IntegrationAccess::Write): static
    {
        return $this->state(fn () => [
            'provider' => IntegrationProvider::Jira,
            'status' => IntegrationStatus::Active,
            'access' => $access,
            'credentials' => ['access_token' => 'jira-access', 'refresh_token' => 'jira-refresh', 'expires_at' => now()->addHour()->getTimestamp()],
            'settings' => [
                'cloudId' => 'cloud-1',
                'siteUrl' => 'https://acme.atlassian.net',
                'siteName' => 'Acme',
                'storyPointFields' => [['id' => 'customfield_10016', 'name' => 'Story point estimate']],
                'numberFields' => [['id' => 'customfield_10016', 'name' => 'Story point estimate']],
            ],
            'scopes' => JiraClient::scopesFor($access),
        ]);
    }

    public function linear(IntegrationAccess $access = IntegrationAccess::Write): static
    {
        return $this->state(fn () => [
            'provider' => IntegrationProvider::Linear,
            'status' => IntegrationStatus::Active,
            'access' => $access,
            'credentials' => ['access_token' => 'linear-access', 'refresh_token' => null, 'expires_at' => null],
            'settings' => ['organizationId' => 'org-1', 'organizationName' => 'Acme', 'urlKey' => 'acme'],
            'scopes' => LinearClient::scopesFor($access),
        ]);
    }

    public function setupRequired(): static
    {
        return $this->jira()->state(fn () => [
            'status' => IntegrationStatus::SetupRequired,
            'settings' => ['sites' => [
                ['cloudId' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme'],
                ['cloudId' => 'cloud-2', 'url' => 'https://beta.atlassian.net', 'name' => 'Beta'],
            ]],
        ]);
    }

    public function reconnectRequired(string $error = 'token_revoked'): static
    {
        return $this->state(fn () => ['status' => IntegrationStatus::ReconnectRequired, 'last_error' => $error]);
    }

    public function expiring(): static
    {
        return $this->state(fn (array $attributes) => [
            'credentials' => [...$attributes['credentials'], 'expires_at' => now()->addSeconds(30)->getTimestamp()],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function slackAttributes(): array
    {
        return [
            'provider' => IntegrationProvider::Slack,
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => ['webhook_url' => 'https://hooks.slack.com/services/T000/B000/XXXX', 'access_token' => 'xoxp-test-token'],
            'settings' => [
                'teamId' => 'T000',
                'teamName' => 'Acme',
                'channelId' => 'C000',
                'channelName' => '#retros',
                'configurationUrl' => 'https://acme.slack.com/services/B000',
            ],
            'scopes' => ['incoming-webhook'],
        ];
    }
}
```

`JiraClient::scopesFor()` and `LinearClient::scopesFor()` are created in Task 5; until then create the two classes with only these static methods so the factory resolves (Task 5 fills in the rest of each file):

Create `app/Support/Integrations/Jira/JiraClient.php`:

```php
<?php

namespace App\Support\Integrations\Jira;

use App\Enums\IntegrationAccess;

class JiraClient
{
    public const ReadScopes = ['offline_access', 'read:jira-work', 'read:board-scope:jira-software', 'read:sprint:jira-software'];

    public const WriteScopes = ['write:jira-work', 'read:jira-user'];

    /**
     * @return array<int, string>
     */
    public static function scopesFor(IntegrationAccess $access): array
    {
        return $access === IntegrationAccess::Write ? [...self::ReadScopes, ...self::WriteScopes] : self::ReadScopes;
    }
}
```

Create `app/Support/Integrations/Linear/LinearClient.php`:

```php
<?php

namespace App\Support\Integrations\Linear;

use App\Enums\IntegrationAccess;

class LinearClient
{
    /**
     * @return array<int, string>
     */
    public static function scopesFor(IntegrationAccess $access): array
    {
        return $access === IntegrationAccess::Write ? ['read', 'write'] : ['read'];
    }
}
```

Create `database/factories/IntegrationUserMappingFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\IntegrationUserMatch;
use App\Models\IntegrationUserMapping;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<IntegrationUserMapping>
 */
class IntegrationUserMappingFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_integration_id' => TeamIntegration::factory()->jira(),
            'user_id' => User::factory(),
            'external_account_id' => 'account-'.Str::lower(Str::random(12)),
            'external_display_name' => fake()->name(),
            'matched_by' => IntegrationUserMatch::Email,
            'checked_at' => now(),
        ];
    }

    public function manual(): static
    {
        return $this->state(fn () => ['matched_by' => IntegrationUserMatch::Manual]);
    }

    public function neverAssign(): static
    {
        return $this->state(fn () => [
            'matched_by' => IntegrationUserMatch::Manual,
            'external_account_id' => null,
            'external_display_name' => null,
        ]);
    }
}
```

Create `database/factories/ActionItemExternalLinkFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActionItemExternalLink>
 */
class ActionItemExternalLinkFactory extends Factory
{
    public function definition(): array
    {
        $number = fake()->unique()->numberBetween(1, 99999);

        return [
            'action_item_id' => ActionItem::factory(),
            'source' => IntegrationProvider::Jira,
            'external_site' => 'cloud-1',
            'external_id' => (string) (10000 + $number),
            'external_key' => "PROJ-{$number}",
            'external_url' => "https://acme.atlassian.net/browse/PROJ-{$number}",
        ];
    }

    public function linear(): static
    {
        return $this->state(function () {
            $number = fake()->unique()->numberBetween(1, 99999);

            return [
                'source' => IntegrationProvider::Linear,
                'external_site' => 'org-1',
                'external_id' => fake()->uuid(),
                'external_key' => "ENG-{$number}",
                'external_url' => "https://linear.app/acme/issue/ENG-{$number}",
            ];
        });
    }
}
```

Create `database/factories/IntegrationDeliveryFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Models\IntegrationDelivery;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Model;

/**
 * @extends Factory<IntegrationDelivery>
 */
class IntegrationDeliveryFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'channel' => IntegrationDeliveryChannel::Slack,
            'kind' => IntegrationDeliveryKind::RetroLink,
            'subject_type' => (new Retro)->getMorphClass(),
            'subject_id' => fn (array $attributes) => Retro::factory()->create(['team_id' => $attributes['team_id']])->id,
            'status' => IntegrationDeliveryStatus::Queued,
        ];
    }

    public function forSubject(Model $subject): static
    {
        return $this->state(fn () => [
            'team_id' => $subject->getAttribute('team_id'),
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => $subject->getKey(),
            'kind' => $subject instanceof PokerGame ? IntegrationDeliveryKind::PokerLink : IntegrationDeliveryKind::RetroLink,
        ]);
    }

    public function sent(): static
    {
        return $this->state(fn () => ['status' => IntegrationDeliveryStatus::Sent, 'sent_at' => now()]);
    }

    public function failed(string $error = 'boom'): static
    {
        return $this->state(fn () => ['status' => IntegrationDeliveryStatus::Failed, 'error' => $error]);
    }
}
```

Add to `database/factories/PokerTaskFactory.php` (import `App\Enums\IntegrationProvider`):

```php
    public function imported(IntegrationProvider $source = IntegrationProvider::Jira, string $site = 'cloud-1'): static
    {
        return $this->state(function () use ($source, $site) {
            $number = fake()->unique()->numberBetween(1, 99999);
            $key = $source === IntegrationProvider::Jira ? "PROJ-{$number}" : "ENG-{$number}";

            return [
                'external_source' => $source->value,
                'external_id' => $source === IntegrationProvider::Jira ? (string) (10000 + $number) : fake()->uuid(),
                'external_url' => $source === IntegrationProvider::Jira
                    ? "https://acme.atlassian.net/browse/{$key}"
                    : "https://linear.app/acme/issue/{$key}",
                'external_site' => $site,
                'external_key' => $key,
                'external_refreshed_at' => now(),
            ];
        });
    }
```

- [ ] **Step 8: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `Connected` | `Connecté` | `Conectado` | `Verbunden` |
| `Setup required` | `Configuration requise` | `Configuración necesaria` | `Einrichtung erforderlich` |
| `Reconnect required` | `Reconnexion requise` | `Reconexión necesaria` | `Erneute Verbindung erforderlich` |
| `Stored credentials could not be read. Reconnect.` | `Les identifiants enregistrés sont illisibles. Reconnectez-vous.` | `No se pudieron leer las credenciales guardadas. Vuelve a conectar.` | `Die gespeicherten Zugangsdaten konnten nicht gelesen werden. Verbinde erneut.` |

- [ ] **Step 9: Migrate and run the tests**

Run:
```bash
vendor/bin/sail artisan migrate
vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationModelsTest.php tests/Feature/UuidPrimaryKeysTest.php tests/Feature/TranslationKeysTest.php
```
Expected: PASS.

- [ ] **Step 10: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add database/migrations database/factories app/Enums app/Models app/Support/Integrations lang tests/Feature/Integrations/IntegrationModelsTest.php
git commit -m "feat: add integration tables, models and factories

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 4: Slack and Telegram clients

**Files:**
- Create: `app/Support/Integrations/Slack/SlackClient.php`, `app/Support/Integrations/Telegram/TelegramClient.php`, `app/Support/Integrations/Telegram/TelegramBot.php`
- Test: create `tests/Feature/Integrations/SlackClientTest.php`, `tests/Feature/Integrations/TelegramClientTest.php`

**Interfaces:**
- Consumes: `ProviderHttp`, exceptions (Task 2); `TeamIntegration::{credential, setting, withReconnectHandling}` (Task 3).
- Produces: `SlackClient` and `TelegramClient` methods of the Contract; `TelegramBot::{username(): ?string, markConflict(): void, clearConflict(): void, hasConflict(): bool}`, `TelegramBot::ConflictKey = 'telegram:conflict'`.

- [ ] **Step 1: Write the failing Slack test**

Create `tests/Feature/Integrations/SlackClientTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Slack\SlackClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('posts messages to the stored webhook', function () {
    Http::fake(['hooks.slack.com/*' => Http::response('ok')]);
    $integration = TeamIntegration::factory()->slack()->create();

    app(SlackClient::class)->postMessage($integration, ['text' => 'Hello']);

    Http::assertSent(fn (Request $request) => $request->url() === 'https://hooks.slack.com/services/T000/B000/XXXX'
        && $request['text'] === 'Hello');
});

it('requires a reconnect when the channel is gone', function (int $status, string $body) {
    Http::fake(['hooks.slack.com/*' => Http::response($body, $status)]);
    $integration = TeamIntegration::factory()->slack()->create();

    expect(fn () => app(SlackClient::class)->postMessage($integration, ['text' => 'Hello']))
        ->toThrow(ReconnectRequired::class);

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->last_error)->toBe($body);
})->with([
    'no service' => [404, 'no_service'],
    'channel not found' => [404, 'channel_not_found'],
    'action prohibited' => [403, 'action_prohibited'],
    'general channel' => [403, 'posting_to_general_channel_denied'],
    'archived' => [410, 'channel_is_archived'],
]);

it('keeps the connection on rate limits and server errors', function () {
    Http::fake(['hooks.slack.com/*' => Http::sequence()
        ->push('rate_limited', 429, ['Retry-After' => '30'])
        ->push('internal_error', 500)]);
    $integration = TeamIntegration::factory()->slack()->create();
    $slack = app(SlackClient::class);

    try {
        $slack->postMessage($integration, ['text' => 'Hello']);
        $this->fail('No exception was thrown.');
    } catch (RateLimited $exception) {
        expect($exception->retryAfter)->toBe(30);
    }

    expect(fn () => $slack->postMessage($integration, ['text' => 'Hello']))->toThrow(ProviderUnavailable::class)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::Active);
});

it('refuses a webhook outside hooks.slack.com without calling it', function () {
    $integration = TeamIntegration::factory()->slack()->create();
    $integration->forceFill(['credentials' => ['webhook_url' => 'https://evil.test/hook', 'access_token' => 'xoxp-test-token']])->save();

    expect(fn () => app(SlackClient::class)->postMessage($integration, ['text' => 'Hello']))->toThrow(ReconnectRequired::class);

    Http::assertNothingSent();
});

it('checks the token with auth.test', function () {
    Http::fake(['slack.com/api/auth.test' => Http::response(['ok' => true, 'team' => 'Acme'])]);
    $integration = TeamIntegration::factory()->slack()->create();

    app(SlackClient::class)->authTest($integration);

    Http::assertSent(fn (Request $request) => $request->url() === 'https://slack.com/api/auth.test'
        && $request->hasHeader('Authorization', 'Bearer xoxp-test-token'));
});

it('requires a reconnect when auth.test refuses the token', function (string $error) {
    Http::fake(['slack.com/api/auth.test' => Http::response(['ok' => false, 'error' => $error])]);
    $integration = TeamIntegration::factory()->slack()->create();

    expect(fn () => app(SlackClient::class)->authTest($integration))->toThrow(ReconnectRequired::class)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
})->with(['invalid_auth', 'token_revoked', 'account_inactive']);

it('revokes the token on a best-effort basis', function () {
    Http::fake(['slack.com/api/auth.revoke' => Http::response('down', 500)]);
    $integration = TeamIntegration::factory()->slack()->create();

    app(SlackClient::class)->revoke($integration);

    Http::assertSentCount(1);
});

it('builds the authorization URL with the webhook scope', function () {
    enableIntegrations(IntegrationProvider::Slack);

    $url = app(SlackClient::class)->authorizationUrl('state-value');

    parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

    expect($url)->toStartWith('https://slack.com/oauth/v2/authorize?')
        ->and($query)->toMatchArray([
            'client_id' => 'slack-client',
            'scope' => 'incoming-webhook',
            'redirect_uri' => config('services.slack.redirect'),
            'state' => 'state-value',
        ]);
});
```

- [ ] **Step 2: Write the failing Telegram test**

Create `tests/Feature/Integrations/TelegramClientTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Exceptions\TelegramConflict;
use App\Support\Integrations\Telegram\TelegramBot;
use App\Support\Integrations\Telegram\TelegramClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Telegram);
});

it('sends HTML messages without link previews', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]])]);
    $integration = TeamIntegration::factory()->telegram()->create();

    app(TelegramClient::class)->sendMessageTo($integration, '<b>Hello</b>');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.telegram.org/bot123456:telegram-token/sendMessage'
        && $request['chat_id'] === '-100123'
        && $request['text'] === '<b>Hello</b>'
        && $request['parse_mode'] === 'HTML'
        && $request['link_preview_options'] === ['is_disabled' => true]);
});

it('requires a reconnect when the bot lost the chat', function (int $status, string $description) {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => $status, 'description' => $description], $status)]);
    $integration = TeamIntegration::factory()->telegram()->create();

    expect(fn () => app(TelegramClient::class)->sendMessageTo($integration, 'Hello'))->toThrow(ReconnectRequired::class)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
})->with([
    'blocked' => [403, 'Forbidden: bot was kicked from the supergroup chat'],
    'chat not found' => [400, 'Bad Request: chat not found'],
]);

it('honours the retry delay Telegram asks for', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => 429, 'description' => 'Too Many Requests', 'parameters' => ['retry_after' => 17]], 429)]);
    $integration = TeamIntegration::factory()->telegram()->create();

    try {
        app(TelegramClient::class)->sendMessageTo($integration, 'Hello');
        $this->fail('No exception was thrown.');
    } catch (RateLimited $exception) {
        expect($exception->retryAfter)->toBe(17)
            ->and($integration->fresh()->status)->toBe(IntegrationStatus::Active);
    }
});

it('reports a bot used elsewhere', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => 409, 'description' => 'Conflict: can\'t use getUpdates method while webhook is active'], 409)]);

    expect(fn () => app(TelegramClient::class)->getUpdates(0, 0))->toThrow(TelegramConflict::class);
});

it('long-polls updates with the allowed update types', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => true, 'result' => [['update_id' => 7]]])]);

    $updates = app(TelegramClient::class)->getUpdates(5, 50);

    expect($updates)->toBe([['update_id' => 7]]);
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/getUpdates')
        && $request['offset'] === 5
        && $request['timeout'] === 50
        && $request['allowed_updates'] === ['message', 'channel_post', 'my_chat_member']);
});

it('never exposes the bot token in errors', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => 400, 'description' => 'Bad Request: bot123456:telegram-token is odd'], 400)]);
    $integration = TeamIntegration::factory()->telegram()->create();

    try {
        app(TelegramClient::class)->sendMessageTo($integration, 'Hello');
        $this->fail('No exception was thrown.');
    } catch (IntegrationException $exception) {
        expect($exception->getMessage())->not->toContain('telegram-token');
    }
});

it('caches the bot username for a day', function () {
    Http::fake(['api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']])]);
    $bot = app(TelegramBot::class);

    expect($bot->username())->toBe('skrum_test_bot')
        ->and($bot->username())->toBe('skrum_test_bot');

    Http::assertSentCount(1);
});

it('answers null when the bot cannot be reached', function () {
    Http::fake(['api.telegram.org/*' => Http::response('down', 502)]);

    expect(app(TelegramBot::class)->username())->toBeNull();
});

it('remembers a polling conflict for the integrations page', function () {
    $bot = app(TelegramBot::class);

    $bot->markConflict();

    expect($bot->hasConflict())->toBeTrue();

    $bot->clearConflict();

    expect($bot->hasConflict())->toBeFalse();
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/SlackClientTest.php tests/Feature/Integrations/TelegramClientTest.php`
Expected: FAIL — `Class "App\Support\Integrations\Slack\SlackClient" not found`.

- [ ] **Step 4: Create the Slack client**

Create `app/Support/Integrations/Slack/SlackClient.php`:

```php
<?php

namespace App\Support\Integrations\Slack;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\ProviderHttp;

class SlackClient
{
    public const AuthorizeUrl = 'https://slack.com/oauth/v2/authorize';

    public const ApiUrl = 'https://slack.com/api/';

    public const WebhookPrefix = 'https://hooks.slack.com/';

    public const Scope = 'incoming-webhook';

    private const ReconnectErrors = ['invalid_auth', 'not_authed', 'token_revoked', 'token_expired', 'account_inactive'];

    private const LostChannelStatuses = [403, 404, 410];

    public static function isWebhookUrl(string $url): bool
    {
        return str_starts_with($url, self::WebhookPrefix) && filter_var($url, FILTER_VALIDATE_URL) !== false;
    }

    public function authorizationUrl(string $state): string
    {
        return self::AuthorizeUrl.'?'.http_build_query([
            'client_id' => (string) config('services.slack.client_id'),
            'scope' => self::Scope,
            'redirect_uri' => (string) config('services.slack.redirect'),
            'state' => $state,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function exchangeCode(string $code): array
    {
        return $this->call('oauth.v2.access', [
            'client_id' => (string) config('services.slack.client_id'),
            'client_secret' => (string) config('services.slack.client_secret'),
            'code' => $code,
            'redirect_uri' => (string) config('services.slack.redirect'),
        ]);
    }

    public function authTest(TeamIntegration $integration): void
    {
        $integration->withReconnectHandling(fn () => $this->call('auth.test', [], (string) $integration->credential('access_token')));
    }

    public function revoke(TeamIntegration $integration): void
    {
        try {
            $this->call('auth.revoke', [], (string) $integration->credential('access_token'));
        } catch (IntegrationException) {
            // Revocation is best effort: the connection is deleted either way.
        }
    }

    /**
     * @param  array<string, mixed>  $message
     */
    public function postMessage(TeamIntegration $integration, array $message): void
    {
        $integration->withReconnectHandling(function () use ($integration, $message): void {
            $url = $integration->credential('webhook_url');

            if (! is_string($url) || ! self::isWebhookUrl($url)) {
                throw new ReconnectRequired(IntegrationProvider::Slack, 'invalid_webhook_url');
            }

            $response = ProviderHttp::send(IntegrationProvider::Slack, fn () => ProviderHttp::request()->post($url, $message));

            if ($response->successful()) {
                return;
            }

            $error = trim($response->body());

            if (in_array($response->status(), self::LostChannelStatuses, true)) {
                throw new ReconnectRequired(IntegrationProvider::Slack, $error === '' ? "HTTP {$response->status()}" : $error);
            }

            ProviderHttp::fail(IntegrationProvider::Slack, $response, $error === '' ? null : $error);
        });
    }

    /**
     * @param  array<string, string>  $params
     * @return array<string, mixed>
     */
    private function call(string $method, array $params, ?string $token = null): array
    {
        $request = ProviderHttp::request()->asForm();

        if ($token !== null) {
            $request = $request->withToken($token);
        }

        $response = ProviderHttp::send(IntegrationProvider::Slack, fn () => $request->post(self::ApiUrl.$method, $params));

        if (! $response->successful()) {
            ProviderHttp::fail(IntegrationProvider::Slack, $response);
        }

        $payload = $response->json();

        if (! is_array($payload)) {
            throw new ProviderUnavailable(IntegrationProvider::Slack, 'invalid_response');
        }

        if (($payload['ok'] ?? false) === true) {
            return $payload;
        }

        $error = is_string($payload['error'] ?? null) ? $payload['error'] : 'unknown_error';

        if (in_array($error, self::ReconnectErrors, true)) {
            throw new ReconnectRequired(IntegrationProvider::Slack, $error);
        }

        if ($error === 'ratelimited') {
            throw new RateLimited(IntegrationProvider::Slack, ProviderHttp::retryAfter($response), $error);
        }

        throw new ProviderRejected(IntegrationProvider::Slack, $error);
    }
}
```

- [ ] **Step 5: Create the Telegram client and bot**

Create `app/Support/Integrations/Telegram/TelegramClient.php`:

```php
<?php

namespace App\Support\Integrations\Telegram;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Exceptions\TelegramConflict;
use App\Support\Integrations\ProviderHttp;
use Illuminate\Support\Str;

class TelegramClient
{
    public const ApiUrl = 'https://api.telegram.org/bot';

    public const AllowedUpdates = ['message', 'channel_post', 'my_chat_member'];

    private const LongPollMarginSeconds = 10;

    private const DefaultRetryAfterSeconds = 30;

    /**
     * @return array<string, mixed>
     */
    public function getMe(): array
    {
        $result = $this->call('getMe');

        return is_array($result) ? $result : [];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getUpdates(int $offset, int $timeout): array
    {
        $result = $this->call('getUpdates', [
            'offset' => $offset,
            'timeout' => $timeout,
            'allowed_updates' => self::AllowedUpdates,
        ], $timeout + self::LongPollMarginSeconds);

        return array_values(array_filter(is_array($result) ? $result : [], 'is_array'));
    }

    public function sendMessage(string $chatId, string $html): void
    {
        $this->call('sendMessage', [
            'chat_id' => $chatId,
            'text' => $html,
            'parse_mode' => 'HTML',
            'link_preview_options' => ['is_disabled' => true],
        ]);
    }

    public function sendMessageTo(TeamIntegration $integration, string $html): void
    {
        $integration->withReconnectHandling(fn () => $this->sendMessage($this->chatId($integration), $html));
    }

    /**
     * @return array<string, mixed>
     */
    public function getChat(TeamIntegration $integration): array
    {
        return $integration->withReconnectHandling(function () use ($integration): array {
            $result = $this->call('getChat', ['chat_id' => $this->chatId($integration)]);

            return is_array($result) ? $result : [];
        });
    }

    public function leaveChat(TeamIntegration $integration): void
    {
        try {
            $this->call('leaveChat', ['chat_id' => $this->chatId($integration)]);
        } catch (IntegrationException) {
            // Leaving is best effort: the connection is deleted either way.
        }
    }

    private function chatId(TeamIntegration $integration): string
    {
        return (string) $integration->setting('chatId');
    }

    /**
     * @param  array<string, mixed>  $params
     */
    private function call(string $method, array $params = [], int $timeout = 15): mixed
    {
        $url = self::ApiUrl.config('services.telegram.bot_token').'/'.$method;

        $response = ProviderHttp::send(IntegrationProvider::Telegram, fn () => ProviderHttp::request($timeout)->post($url, $params));

        $payload = $response->json();

        if ($response->successful() && is_array($payload) && ($payload['ok'] ?? false) === true) {
            return $payload['result'] ?? null;
        }

        $status = $response->status();
        $description = is_array($payload) && is_string($payload['description'] ?? null) ? $payload['description'] : "HTTP {$status}";

        if ($status === 409) {
            throw new TelegramConflict($description);
        }

        if ($status === 429) {
            $retryAfter = is_array($payload) ? data_get($payload, 'parameters.retry_after') : null;

            throw new RateLimited(IntegrationProvider::Telegram, is_numeric($retryAfter) ? max(1, (int) $retryAfter) : self::DefaultRetryAfterSeconds, $description);
        }

        if ($status === 403 || ($status === 400 && Str::contains($description, 'chat not found', ignoreCase: true))) {
            throw new ReconnectRequired(IntegrationProvider::Telegram, $description);
        }

        if ($status >= 500) {
            throw new ProviderUnavailable(IntegrationProvider::Telegram, $description);
        }

        throw new ProviderRejected(IntegrationProvider::Telegram, $description, $status);
    }
}
```

Create `app/Support/Integrations/Telegram/TelegramBot.php`:

```php
<?php

namespace App\Support\Integrations\Telegram;

use App\Support\Integrations\Exceptions\IntegrationException;
use Illuminate\Support\Facades\Cache;

class TelegramBot
{
    public const ConflictKey = 'telegram:conflict';

    private const UsernameTtlSeconds = 86400;

    private const ConflictTtlMinutes = 10;

    public function __construct(private TelegramClient $telegram) {}

    public function username(): ?string
    {
        $key = 'telegram:bot-username:'.hash('sha256', (string) config('services.telegram.bot_token'));
        $cached = Cache::get($key);

        if (is_string($cached)) {
            return $cached;
        }

        try {
            $username = $this->telegram->getMe()['username'] ?? null;
        } catch (IntegrationException) {
            return null;
        }

        if (! is_string($username) || $username === '') {
            return null;
        }

        Cache::put($key, $username, self::UsernameTtlSeconds);

        return $username;
    }

    public function markConflict(): void
    {
        Cache::put(self::ConflictKey, true, now()->addMinutes(self::ConflictTtlMinutes));
    }

    public function clearConflict(): void
    {
        Cache::forget(self::ConflictKey);
    }

    public function hasConflict(): bool
    {
        return Cache::has(self::ConflictKey);
    }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/SlackClientTest.php tests/Feature/Integrations/TelegramClientTest.php`
Expected: PASS.

- [ ] **Step 7: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Integrations tests/Feature/Integrations/SlackClientTest.php tests/Feature/Integrations/TelegramClientTest.php
git commit -m "feat: add Slack and Telegram clients

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 5: OAuth tokens, token refresh, Jira and Linear clients

**Files:**
- Create: `app/Support/Integrations/{OAuthTokens,RefreshesTokens,IntegrationTokens}.php`
- Modify (replace the Task 3 stubs entirely): `app/Support/Integrations/Jira/JiraClient.php`, `app/Support/Integrations/Linear/LinearClient.php`
- Test: create `tests/Feature/Integrations/IntegrationTokensTest.php`

**Interfaces:**
- Consumes: `ProviderHttp`, exceptions (Task 2); `TeamIntegration` (Task 3).
- Produces: `OAuthTokens::fromResponse(IntegrationProvider, array): array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}`, `OAuthTokens::credentials(array $tokens): array{access_token, refresh_token, expires_at}`, `OAuthTokens::failTokenRequest(IntegrationProvider, Response): never`; interface `RefreshesTokens::refreshTokens(string): array`; `IntegrationTokens::{accessToken, refresh}`; the full `JiraClient` and `LinearClient` of the Contract. Credentials of Jira/Linear rows: `access_token` (string), `refresh_token` (string|null), `expires_at` (Unix timestamp int|null).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/IntegrationTokensTest.php`:

```php
<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\Linear\LinearClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear);
});

function jiraRefreshResponse(): array
{
    return ['access_token' => 'jira-access-2', 'refresh_token' => 'jira-refresh-2', 'expires_in' => 3600, 'scope' => 'offline_access read:jira-work'];
}

it('calls Jira on the connected site with a fresh token', function () {
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/myself' => Http::response(['accountId' => 'me'])]);
    $integration = TeamIntegration::factory()->jira()->create();

    expect(app(JiraClient::class)->get($integration, 'rest/api/3/myself'))->toBe(['accountId' => 'me']);

    Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer jira-access'));
    Http::assertSentCount(1);
});

it('refreshes an expiring Jira token and stores the rotated refresh token', function () {
    Http::fake([
        'auth.atlassian.com/oauth/token' => Http::response(jiraRefreshResponse()),
        'api.atlassian.com/ex/jira/cloud-1/*' => Http::response(['accountId' => 'me']),
    ]);
    $integration = TeamIntegration::factory()->jira()->expiring()->create();

    app(JiraClient::class)->get($integration, 'rest/api/3/myself');

    $credentials = $integration->fresh()->readableCredentials();

    expect($credentials['access_token'])->toBe('jira-access-2')
        ->and($credentials['refresh_token'])->toBe('jira-refresh-2')
        ->and($credentials['expires_at'])->toBeGreaterThan(now()->addMinutes(55)->getTimestamp());

    Http::assertSent(fn (Request $request) => $request->url() === JiraClient::TokenUrl
        && $request['grant_type'] === 'refresh_token'
        && $request['refresh_token'] === 'jira-refresh'
        && $request['client_id'] === 'jira-client');
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/myself')
        && $request->hasHeader('Authorization', 'Bearer jira-access-2'));
});

it('reuses a token another worker refreshed', function () {
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/*' => Http::response(['accountId' => 'me'])]);
    $stale = TeamIntegration::factory()->jira()->expiring()->create();

    TeamIntegration::query()->findOrFail($stale->id)->forceFill(['credentials' => [
        'access_token' => 'jira-access-other-worker',
        'refresh_token' => 'jira-refresh-other-worker',
        'expires_at' => now()->addHour()->getTimestamp(),
    ]])->save();

    app(JiraClient::class)->get($stale, 'rest/api/3/myself');

    Http::assertNotSent(fn (Request $request) => $request->url() === JiraClient::TokenUrl);
    Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer jira-access-other-worker'));
});

it('requires a reconnect when the refresh token is refused', function () {
    Http::fake(['auth.atlassian.com/oauth/token' => Http::response(['error' => 'invalid_grant', 'error_description' => 'Unknown or invalid refresh token.'], 403)]);
    $integration = TeamIntegration::factory()->jira()->expiring()->create();

    expect(fn () => app(JiraClient::class)->get($integration, 'rest/api/3/myself'))->toThrow(ReconnectRequired::class);

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->last_error)->toBe('Unknown or invalid refresh token.');
});

it('refreshes once after a 401 and gives up after a second one', function () {
    Http::fake([
        'auth.atlassian.com/oauth/token' => Http::response(jiraRefreshResponse()),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/one' => Http::sequence()->push([], 401)->push(['ok' => true]),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/two' => Http::response(['message' => 'Unauthorized'], 401),
    ]);
    $retried = TeamIntegration::factory()->jira()->create();
    $revoked = TeamIntegration::factory()->jira()->create();

    expect(app(JiraClient::class)->get($retried, 'rest/api/3/one'))->toBe(['ok' => true])
        ->and($retried->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and(fn () => app(JiraClient::class)->get($revoked, 'rest/api/3/two'))->toThrow(ReconnectRequired::class)
        ->and($revoked->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});

it('refuses Jira calls before a site is chosen', function () {
    $integration = TeamIntegration::factory()->setupRequired()->create();

    expect(fn () => app(JiraClient::class)->get($integration, 'rest/api/3/myself'))->toThrow(NotConnected::class);

    Http::assertNothingSent();
});

it('lists the accessible Jira sites', function () {
    Http::fake(['api.atlassian.com/oauth/token/accessible-resources' => Http::response([
        ['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net/', 'name' => 'Acme', 'scopes' => ['read:jira-work']],
        ['id' => 'conf-1', 'url' => 'https://acme.atlassian.net/wiki', 'name' => 'Acme wiki', 'scopes' => ['read:confluence-content.all']],
    ])]);

    expect(app(JiraClient::class)->accessibleResources('token'))
        ->toBe([['cloudId' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme']]);
});

it('builds authorization URLs with the scopes of each access level', function () {
    parse_str((string) parse_url(app(JiraClient::class)->authorizationUrl('s', IntegrationAccess::Read), PHP_URL_QUERY), $read);
    parse_str((string) parse_url(app(JiraClient::class)->authorizationUrl('s', IntegrationAccess::Write), PHP_URL_QUERY), $write);
    parse_str((string) parse_url(app(LinearClient::class)->authorizationUrl('s', IntegrationAccess::Write), PHP_URL_QUERY), $linear);

    expect($read)->toMatchArray([
        'audience' => 'api.atlassian.com',
        'client_id' => 'jira-client',
        'scope' => 'offline_access read:jira-work read:board-scope:jira-software read:sprint:jira-software',
        'redirect_uri' => config('services.jira.redirect'),
        'state' => 's',
        'response_type' => 'code',
        'prompt' => 'consent',
    ])
        ->and($write['scope'])->toBe('offline_access read:jira-work read:board-scope:jira-software read:sprint:jira-software write:jira-work read:jira-user')
        ->and($linear)->toMatchArray([
            'client_id' => 'linear-client',
            'scope' => 'read,write',
            'redirect_uri' => config('services.linear.redirect'),
            'response_type' => 'code',
            'actor' => 'user',
            'state' => 's',
        ]);
});

it('returns Linear data and maps GraphQL errors', function () {
    Http::fake(['api.linear.app/graphql' => Http::sequence()
        ->push(['data' => ['viewer' => ['id' => 'u1']]])
        ->push(['errors' => [['message' => 'Rate limit exceeded', 'extensions' => ['code' => 'RATELIMITED']]]], 400)
        ->push(['errors' => [['message' => 'Argument invalid', 'extensions' => ['code' => 'INVALID_INPUT']]]], 400)
        ->push(['errors' => [['message' => 'Authentication required', 'extensions' => ['code' => 'AUTHENTICATION_ERROR']]]], 400)]);
    $integration = TeamIntegration::factory()->linear()->create();
    $linear = app(LinearClient::class);

    expect($linear->query($integration, 'query { viewer { id } }'))->toBe(['viewer' => ['id' => 'u1']])
        ->and(fn () => $linear->query($integration, 'query { viewer { id } }'))->toThrow(RateLimited::class)
        ->and(fn () => $linear->query($integration, 'query { viewer { id } }'))->toThrow(ProviderRejected::class, 'Argument invalid')
        ->and(fn () => $linear->query($integration, 'query { viewer { id } }'))->toThrow(ReconnectRequired::class)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);

    Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer linear-access'));
});

it('reads the Linear organization with a new token', function () {
    Http::fake(['api.linear.app/graphql' => Http::response(['data' => ['viewer' => ['organization' => ['id' => 'org-9', 'name' => 'Nine', 'urlKey' => 'nine']]]])]);

    expect(app(LinearClient::class)->organization('fresh-token'))->toBe(['id' => 'org-9', 'name' => 'Nine', 'urlKey' => 'nine']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationTokensTest.php`
Expected: FAIL — `Call to undefined method App\Support\Integrations\Jira\JiraClient::get()`.

- [ ] **Step 3: Create the token helpers**

Create `app/Support/Integrations/OAuthTokens.php`:

```php
<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationProvider;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use Illuminate\Http\Client\Response;

class OAuthTokens
{
    private const RefusedGrantErrors = ['invalid_grant', 'unauthorized_client'];

    /**
     * @param  array<array-key, mixed>  $payload
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}
     */
    public static function fromResponse(IntegrationProvider $provider, array $payload): array
    {
        $accessToken = $payload['access_token'] ?? null;

        if (! is_string($accessToken) || $accessToken === '') {
            throw new ProviderRejected($provider, 'missing_access_token');
        }

        $refreshToken = $payload['refresh_token'] ?? null;
        $expiresIn = $payload['expires_in'] ?? null;
        $scope = $payload['scope'] ?? [];
        $scopes = is_array($scope) ? $scope : (preg_split('/[\s,]+/', (string) $scope, -1, PREG_SPLIT_NO_EMPTY) ?: []);

        return [
            'access_token' => $accessToken,
            'refresh_token' => is_string($refreshToken) && $refreshToken !== '' ? $refreshToken : null,
            'expires_at' => is_numeric($expiresIn) ? now()->getTimestamp() + (int) $expiresIn : null,
            'scopes' => array_values(array_map(fn (mixed $item): string => (string) $item, $scopes)),
        ];
    }

    /**
     * @param  array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}  $tokens
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null}
     */
    public static function credentials(array $tokens): array
    {
        return [
            'access_token' => $tokens['access_token'],
            'refresh_token' => $tokens['refresh_token'],
            'expires_at' => $tokens['expires_at'],
        ];
    }

    public static function failTokenRequest(IntegrationProvider $provider, Response $response): never
    {
        $error = $response->json('error');

        if ($response->status() === 401 || in_array($error, self::RefusedGrantErrors, true)) {
            $description = $response->json('error_description');

            throw new ReconnectRequired($provider, is_string($description) ? $description : (is_string($error) ? $error : 'invalid_grant'));
        }

        ProviderHttp::fail($provider, $response);
    }
}
```

Create `app/Support/Integrations/RefreshesTokens.php`:

```php
<?php

namespace App\Support\Integrations;

interface RefreshesTokens
{
    /**
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}
     */
    public function refreshTokens(string $refreshToken): array;
}
```

Create `app/Support/Integrations/IntegrationTokens.php`:

```php
<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\Linear\LinearClient;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Refreshes run under a cache lock and a row lock, and re-read the row, so
 * two workers never spend the same (rotating) refresh token twice.
 */
class IntegrationTokens
{
    private const RefreshMarginSeconds = 60;

    private const LockSeconds = 30;

    private const LockWaitSeconds = 20;

    public function accessToken(TeamIntegration $integration): string
    {
        $token = $integration->credential('access_token');

        if (! is_string($token) || $token === '') {
            throw new ReconnectRequired($integration->provider, 'missing_access_token');
        }

        if (! $this->expiresSoon($integration->credential('expires_at'))) {
            return $token;
        }

        return $this->refresh($integration, $token);
    }

    public function refresh(TeamIntegration $integration, ?string $staleToken = null): string
    {
        return $integration->withReconnectHandling(function () use ($integration, $staleToken): string {
            try {
                return Cache::lock("integration-token:{$integration->id}", self::LockSeconds)
                    ->block(self::LockWaitSeconds, fn (): string => $this->refreshLocked($integration, $staleToken));
            } catch (LockTimeoutException) {
                throw new ProviderUnavailable($integration->provider, 'token_refresh_busy');
            }
        });
    }

    private function refreshLocked(TeamIntegration $integration, ?string $staleToken): string
    {
        return DB::transaction(function () use ($integration, $staleToken): string {
            $locked = TeamIntegration::query()->whereKey($integration->id)->lockForUpdate()->firstOrFail();
            $current = $locked->credential('access_token');

            if (is_string($current) && $current !== $staleToken && ! $this->expiresSoon($locked->credential('expires_at'))) {
                $integration->setRawAttributes($locked->getAttributes(), true);

                return $current;
            }

            $refreshToken = $locked->credential('refresh_token');

            if (! is_string($refreshToken) || $refreshToken === '') {
                throw new ReconnectRequired($locked->provider, 'missing_refresh_token');
            }

            $tokens = $this->client($locked->provider)->refreshTokens($refreshToken);

            $locked->forceFill(['credentials' => [
                ...(array) $locked->readableCredentials(),
                'access_token' => $tokens['access_token'],
                'refresh_token' => $tokens['refresh_token'] ?? $refreshToken,
                'expires_at' => $tokens['expires_at'],
            ]])->save();

            $integration->setRawAttributes($locked->getAttributes(), true);

            return $tokens['access_token'];
        });
    }

    private function expiresSoon(mixed $expiresAt): bool
    {
        return is_int($expiresAt) && $expiresAt - self::RefreshMarginSeconds <= now()->getTimestamp();
    }

    private function client(IntegrationProvider $provider): RefreshesTokens
    {
        return match ($provider) {
            IntegrationProvider::Jira => app(JiraClient::class),
            IntegrationProvider::Linear => app(LinearClient::class),
            default => throw new ReconnectRequired($provider, 'no_token_refresh'),
        };
    }
}
```

- [ ] **Step 4: Replace the Jira client**

Replace `app/Support/Integrations/Jira/JiraClient.php` with:

```php
<?php

namespace App\Support\Integrations\Jira;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\IntegrationTokens;
use App\Support\Integrations\OAuthTokens;
use App\Support\Integrations\ProviderHttp;
use App\Support\Integrations\RefreshesTokens;
use Illuminate\Http\Client\Response;

class JiraClient implements RefreshesTokens
{
    public const AuthorizeUrl = 'https://auth.atlassian.com/authorize';

    public const TokenUrl = 'https://auth.atlassian.com/oauth/token';

    public const ResourcesUrl = 'https://api.atlassian.com/oauth/token/accessible-resources';

    public const ApiUrl = 'https://api.atlassian.com/ex/jira/';

    public const ReadScopes = ['offline_access', 'read:jira-work', 'read:board-scope:jira-software', 'read:sprint:jira-software'];

    public const WriteScopes = ['write:jira-work', 'read:jira-user'];

    public function __construct(private IntegrationTokens $tokens) {}

    /**
     * @return array<int, string>
     */
    public static function scopesFor(IntegrationAccess $access): array
    {
        return $access === IntegrationAccess::Write ? [...self::ReadScopes, ...self::WriteScopes] : self::ReadScopes;
    }

    public function authorizationUrl(string $state, IntegrationAccess $access): string
    {
        return self::AuthorizeUrl.'?'.http_build_query([
            'audience' => 'api.atlassian.com',
            'client_id' => (string) config('services.jira.client_id'),
            'scope' => implode(' ', self::scopesFor($access)),
            'redirect_uri' => (string) config('services.jira.redirect'),
            'state' => $state,
            'response_type' => 'code',
            'prompt' => 'consent',
        ], '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}
     */
    public function exchangeCode(string $code): array
    {
        return $this->tokenRequest([
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => (string) config('services.jira.redirect'),
        ]);
    }

    public function refreshTokens(string $refreshToken): array
    {
        return $this->tokenRequest(['grant_type' => 'refresh_token', 'refresh_token' => $refreshToken]);
    }

    /**
     * @return array<int, array{cloudId: string, url: string, name: string}>
     */
    public function accessibleResources(string $accessToken): array
    {
        $response = ProviderHttp::send(IntegrationProvider::Jira, fn () => ProviderHttp::request()->withToken($accessToken)->get(self::ResourcesUrl));

        if (! $response->successful()) {
            ProviderHttp::fail(IntegrationProvider::Jira, $response);
        }

        $sites = [];

        foreach ((array) $response->json() as $site) {
            if (! is_array($site) || ! is_string($site['id'] ?? null) || ! is_string($site['url'] ?? null)) {
                continue;
            }

            if (is_array($site['scopes'] ?? null) && ! in_array('read:jira-work', $site['scopes'], true)) {
                continue;
            }

            $sites[] = [
                'cloudId' => $site['id'],
                'url' => rtrim($site['url'], '/'),
                'name' => is_string($site['name'] ?? null) ? $site['name'] : $site['url'],
            ];
        }

        return $sites;
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<array-key, mixed>
     */
    public function get(TeamIntegration $integration, string $path, array $query = []): array
    {
        return $this->request($integration, 'GET', $path, $query);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function post(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->request($integration, 'POST', $path, $body);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function put(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->request($integration, 'PUT', $path, $body);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<array-key, mixed>
     */
    private function request(TeamIntegration $integration, string $method, string $path, array $data): array
    {
        return $integration->withReconnectHandling(function () use ($integration, $method, $path, $data): array {
            $cloudId = $integration->setting('cloudId');

            if (! is_string($cloudId) || $cloudId === '') {
                throw new NotConnected(IntegrationProvider::Jira);
            }

            $url = self::ApiUrl.$cloudId.'/'.ltrim($path, '/');
            $token = $this->tokens->accessToken($integration);
            $response = $this->send($method, $url, $data, $token);

            if ($response->status() === 401) {
                $response = $this->send($method, $url, $data, $this->tokens->refresh($integration, $token));
            }

            if (! $response->successful()) {
                ProviderHttp::fail(IntegrationProvider::Jira, $response);
            }

            $json = $response->json();

            return is_array($json) ? $json : [];
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function send(string $method, string $url, array $data, string $token): Response
    {
        $options = $method === 'GET' ? ['query' => $data] : ['json' => $data];

        return ProviderHttp::send(IntegrationProvider::Jira, fn () => ProviderHttp::request()->withToken($token)->send($method, $url, $options));
    }

    /**
     * @param  array<string, string>  $params
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}
     */
    private function tokenRequest(array $params): array
    {
        $response = ProviderHttp::send(IntegrationProvider::Jira, fn () => ProviderHttp::request()->post(self::TokenUrl, [
            ...$params,
            'client_id' => (string) config('services.jira.client_id'),
            'client_secret' => (string) config('services.jira.client_secret'),
        ]));

        if (! $response->successful()) {
            OAuthTokens::failTokenRequest(IntegrationProvider::Jira, $response);
        }

        return OAuthTokens::fromResponse(IntegrationProvider::Jira, (array) $response->json());
    }
}
```

- [ ] **Step 5: Replace the Linear client**

Replace `app/Support/Integrations/Linear/LinearClient.php` with:

```php
<?php

namespace App\Support\Integrations\Linear;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationTokens;
use App\Support\Integrations\OAuthTokens;
use App\Support\Integrations\ProviderHttp;
use App\Support\Integrations\RefreshesTokens;
use Illuminate\Http\Client\Response;

class LinearClient implements RefreshesTokens
{
    public const AuthorizeUrl = 'https://linear.app/oauth/authorize';

    public const TokenUrl = 'https://api.linear.app/oauth/token';

    public const RevokeUrl = 'https://api.linear.app/oauth/revoke';

    public const GraphqlUrl = 'https://api.linear.app/graphql';

    private const DefaultRetryAfterSeconds = 60;

    public function __construct(private IntegrationTokens $tokens) {}

    /**
     * @return array<int, string>
     */
    public static function scopesFor(IntegrationAccess $access): array
    {
        return $access === IntegrationAccess::Write ? ['read', 'write'] : ['read'];
    }

    public function authorizationUrl(string $state, IntegrationAccess $access): string
    {
        return self::AuthorizeUrl.'?'.http_build_query([
            'client_id' => (string) config('services.linear.client_id'),
            'redirect_uri' => (string) config('services.linear.redirect'),
            'response_type' => 'code',
            'scope' => implode(',', self::scopesFor($access)),
            'state' => $state,
            'actor' => 'user',
            'prompt' => 'consent',
        ], '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}
     */
    public function exchangeCode(string $code): array
    {
        return $this->tokenRequest([
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => (string) config('services.linear.redirect'),
        ]);
    }

    public function refreshTokens(string $refreshToken): array
    {
        return $this->tokenRequest(['grant_type' => 'refresh_token', 'refresh_token' => $refreshToken]);
    }

    /**
     * @return array{id: string, name: string, urlKey: string}
     */
    public function organization(string $accessToken): array
    {
        $data = $this->data(ProviderHttp::send(
            IntegrationProvider::Linear,
            fn () => $this->graphql($accessToken, 'query { viewer { organization { id name urlKey } } }', []),
        ));

        $organization = data_get($data, 'viewer.organization');

        if (! is_array($organization) || ! is_string($organization['id'] ?? null)) {
            throw new ProviderRejected(IntegrationProvider::Linear, 'missing_organization');
        }

        return [
            'id' => $organization['id'],
            'name' => is_string($organization['name'] ?? null) ? $organization['name'] : '',
            'urlKey' => is_string($organization['urlKey'] ?? null) ? $organization['urlKey'] : '',
        ];
    }

    /**
     * @param  array<string, mixed>  $variables
     * @return array<array-key, mixed>
     */
    public function query(TeamIntegration $integration, string $query, array $variables = []): array
    {
        return $integration->withReconnectHandling(function () use ($integration, $query, $variables): array {
            $token = $this->tokens->accessToken($integration);
            $response = ProviderHttp::send(IntegrationProvider::Linear, fn () => $this->graphql($token, $query, $variables));

            if ($response->status() === 401 && is_string($integration->credential('refresh_token'))) {
                $token = $this->tokens->refresh($integration, $token);
                $response = ProviderHttp::send(IntegrationProvider::Linear, fn () => $this->graphql($token, $query, $variables));
            }

            return $this->data($response);
        });
    }

    public function revoke(TeamIntegration $integration): void
    {
        try {
            $token = (string) $integration->credential('access_token');

            ProviderHttp::send(IntegrationProvider::Linear, fn () => ProviderHttp::request()->withToken($token)->post(self::RevokeUrl));
        } catch (IntegrationException) {
            // Revocation is best effort: the connection is deleted either way.
        }
    }

    /**
     * @param  array<string, mixed>  $variables
     */
    private function graphql(string $token, string $query, array $variables): Response
    {
        return ProviderHttp::request()->withToken($token)->post(self::GraphqlUrl, [
            'query' => $query,
            'variables' => (object) $variables,
        ]);
    }

    /**
     * @return array<array-key, mixed>
     */
    private function data(Response $response): array
    {
        $errors = $response->json('errors');

        if (is_array($errors) && $errors !== []) {
            $codes = array_map(fn (mixed $error): mixed => data_get($error, 'extensions.code'), $errors);
            $message = data_get($errors, '0.message');
            $detail = is_string($message) ? $message : 'GraphQL error';

            if ($response->status() === 401 || in_array('AUTHENTICATION_ERROR', $codes, true)) {
                throw new ReconnectRequired(IntegrationProvider::Linear, $detail);
            }

            if ($response->status() === 429 || in_array('RATELIMITED', $codes, true)) {
                throw new RateLimited(IntegrationProvider::Linear, ProviderHttp::retryAfter($response, self::DefaultRetryAfterSeconds), $detail);
            }

            if ($response->serverError()) {
                throw new ProviderUnavailable(IntegrationProvider::Linear, $detail);
            }

            throw new ProviderRejected(IntegrationProvider::Linear, $detail, $response->status(), $errors);
        }

        if (! $response->successful()) {
            ProviderHttp::fail(IntegrationProvider::Linear, $response);
        }

        $data = $response->json('data');

        return is_array($data) ? $data : [];
    }

    /**
     * @param  array<string, string>  $params
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}
     */
    private function tokenRequest(array $params): array
    {
        $response = ProviderHttp::send(IntegrationProvider::Linear, fn () => ProviderHttp::request()->asForm()->post(self::TokenUrl, [
            ...$params,
            'client_id' => (string) config('services.linear.client_id'),
            'client_secret' => (string) config('services.linear.client_secret'),
        ]));

        if (! $response->successful()) {
            OAuthTokens::failTokenRequest(IntegrationProvider::Linear, $response);
        }

        return OAuthTokens::fromResponse(IntegrationProvider::Linear, (array) $response->json());
    }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationTokensTest.php tests/Feature/Integrations/IntegrationModelsTest.php`
Expected: PASS.

- [ ] **Step 7: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Integrations tests/Feature/Integrations/IntegrationTokensTest.php
git commit -m "feat: add Jira and Linear clients with locked token refresh

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 6: Integrations page, policy, provider guard and team page link

**Files:**
- Create: `app/Http/Middleware/EnsureIntegrationProviderEnabled.php`, `app/Actions/Integrations/PresentTeamIntegration.php`, `app/Http/Controllers/Integrations/TeamIntegrationsController.php`, `resources/js/types/integrations.ts`, `resources/js/pages/teams/integrations.tsx`
- Modify: `app/Policies/TeamPolicy.php`, `app/Http/Controllers/TeamsController.php`, `routes/web.php`, `resources/js/types/index.ts`, `resources/js/pages/teams/show.tsx`, `tests/Pest.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/IntegrationsPageTest.php`

**Interfaces:**
- Consumes: `IntegrationProvider`, `TeamIntegration`, `TelegramBot` (Tasks 1–4).
- Produces: `TeamPolicy::manageIntegrations`, `EnsureIntegrationProviderEnabled`, `PresentTeamIntegration` (Contract), route `teams.integrations.index` (`GET w/{workspace}/teams/{team}/integrations`), page `teams/integrations` with props `workspace`, `team`, `providers`, `telegram`; `teams/show` prop `canManageIntegrations`; frontend types of the Contract; Pest helper `integrationAdmin(Team): User`. The page file is a first, list-only version; Task 12 replaces it with the full UI.

- [ ] **Step 1: Add the Pest helper**

Append to `tests/Pest.php`:

```php
function integrationAdmin(Team $team): User
{
    $admin = workspaceManager($team->workspace);
    $team->members()->attach($admin);

    return $admin;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Integrations/IntegrationsPageTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Support\Integrations\Telegram\TelegramBot;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => Http::preventStrayRequests());

function integrationsPageUrl(Team $team): string
{
    return route('teams.integrations.index', [$team->workspace, $team]);
}

it('does not exist while no provider is configured', function () {
    $team = Team::factory()->create();

    $this->actingAs(integrationAdmin($team))->get(integrationsPageUrl($team))->assertNotFound();
});

it('is reserved to workspace owners and admins', function () {
    enableIntegrations(IntegrationProvider::Slack);
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))->get(integrationsPageUrl($team))->assertForbidden();
});

it('lists the enabled providers with their connection', function () {
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Jira);
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id, 'connected_by_user_id' => $admin->id, 'last_checked_at' => now()]);
    TeamIntegration::factory()->linear()->create(['team_id' => $team->id]);

    $response = $this->actingAs($admin)->get(integrationsPageUrl($team));

    $response->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('teams/integrations')
        ->where('team.id', $team->id)
        ->has('providers', 2)
        ->where('providers.0.provider', 'slack')
        ->where('providers.0.label', 'Slack')
        ->where('providers.0.usesOAuth', true)
        ->where('providers.0.isTracker', false)
        ->where('providers.0.connection.status', 'active')
        ->where('providers.0.connection.statusLabel', 'Connected')
        ->where('providers.0.connection.access', 'write')
        ->where('providers.0.connection.connectedBy', $admin->name)
        ->where('providers.0.connection.settings', [
            'teamName' => 'Acme',
            'channelName' => '#retros',
            'configurationUrl' => 'https://acme.slack.com/services/B000',
        ])
        ->where('providers.1.provider', 'jira')
        ->where('providers.1.connection', null)
        ->where('telegram', null));

    expect($response->getContent())->not->toContain('xoxp-test-token')
        ->and($response->getContent())->not->toContain('hooks.slack.com/services')
        ->and($response->getContent())->not->toContain('channelId');
});

it('shows the Telegram bot and a polling conflict', function () {
    enableIntegrations(IntegrationProvider::Telegram);
    Http::fake(['api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']])]);
    app(TelegramBot::class)->markConflict();
    $team = Team::factory()->create();

    $this->actingAs(integrationAdmin($team))->get(integrationsPageUrl($team))
        ->assertInertia(fn (Assert $page) => $page
            ->where('telegram.botUsername', 'skrum_test_bot')
            ->where('telegram.conflict', true));
});

it('renders integrations whose credentials cannot be decrypted', function () {
    enableIntegrations(IntegrationProvider::Slack);
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    $otherKey = new Encrypter(Encrypter::generateKey((string) config('app.cipher')), (string) config('app.cipher'));
    DB::table('team_integrations')->where('id', $integration->id)->update(['credentials' => $otherKey->encrypt('{}', false)]);

    $this->actingAs(integrationAdmin($team))->get(integrationsPageUrl($team))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('providers.0.connection.id', $integration->id));
});

it('offers the integrations link to managers only when a provider is configured', function () {
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    $member = teamMember($team);
    $teamPage = route('teams.show', [$team->workspace, $team]);

    $this->actingAs($admin)->get($teamPage)->assertInertia(fn (Assert $page) => $page->where('canManageIntegrations', false));

    enableIntegrations(IntegrationProvider::Linear);

    $this->actingAs($admin)->get($teamPage)->assertInertia(fn (Assert $page) => $page->where('canManageIntegrations', true));
    $this->actingAs($member)->get($teamPage)->assertInertia(fn (Assert $page) => $page->where('canManageIntegrations', false));
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationsPageTest.php`
Expected: FAIL — `Route [teams.integrations.index] not defined.`

- [ ] **Step 4: Add the policy ability and the guard**

In `app/Policies/TeamPolicy.php`, append:

```php
    public function manageIntegrations(User $user, Team $team): bool
    {
        return $user->canManage($team->workspace);
    }
```

Create `app/Http/Middleware/EnsureIntegrationProviderEnabled.php`:

```php
<?php

namespace App\Http\Middleware;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Integration routes are always registered (Wayfinder, route caching) and
 * answer 404 while their provider is not configured on this instance.
 */
class EnsureIntegrationProviderEnabled
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, ?string $provider = null): Response
    {
        $resolved = $this->provider($request, $provider);

        $enabled = $resolved === null ? IntegrationProvider::anyEnabled() : $resolved->isEnabled();

        abort_unless($enabled, 404);

        return $next($request);
    }

    private function provider(Request $request, ?string $provider): ?IntegrationProvider
    {
        if ($provider !== null) {
            return IntegrationProvider::from($provider);
        }

        $parameter = $request->route('provider');

        if ($parameter instanceof IntegrationProvider) {
            return $parameter;
        }

        if (is_string($parameter)) {
            return IntegrationProvider::tryFrom($parameter) ?? abort(404);
        }

        $integration = $request->route('integration');

        return $integration instanceof TeamIntegration ? $integration->provider : null;
    }
}
```

- [ ] **Step 5: Create the presenter and the controller**

Create `app/Actions/Integrations/PresentTeamIntegration.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\TeamIntegration;
use Illuminate\Support\Arr;

class PresentTeamIntegration
{
    /**
     * Non-secret settings the integrations page may show, per provider.
     *
     * @var array<string, array<int, string>>
     */
    public const SettingKeys = [
        'slack' => ['teamName', 'channelName', 'configurationUrl'],
        'telegram' => ['chatTitle', 'chatType'],
        'jira' => ['cloudId', 'siteName', 'siteUrl', 'sites', 'storyPointFields', 'numberFields'],
        'linear' => ['organizationName', 'urlKey'],
    ];

    /**
     * @return array{
     *     id: string,
     *     provider: string,
     *     status: string,
     *     statusLabel: string,
     *     access: string,
     *     settings: array<string, mixed>,
     *     connectedBy: string|null,
     *     connectedAt: string|null,
     *     lastCheckedAt: string|null,
     *     lastError: string|null
     * }
     */
    public function handle(TeamIntegration $integration): array
    {
        return [
            'id' => $integration->id,
            'provider' => $integration->provider->value,
            'status' => $integration->status->value,
            'statusLabel' => $integration->status->label(),
            'access' => $integration->access->value,
            'settings' => Arr::only($integration->settings, self::SettingKeys[$integration->provider->value] ?? []),
            'connectedBy' => $integration->connectedBy?->name,
            'connectedAt' => $integration->created_at?->toIso8601String(),
            'lastCheckedAt' => $integration->last_checked_at?->toIso8601String(),
            'lastError' => $integration->last_error,
        ];
    }
}
```

Create `app/Http/Controllers/Integrations/TeamIntegrationsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\PresentTeamIntegration;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use App\Support\Integrations\Telegram\TelegramBot;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamIntegrationsController extends Controller
{
    public function __construct(private PresentTeamIntegration $presentTeamIntegration) {}

    public function index(Workspace $workspace, Team $team, TelegramBot $telegramBot): Response
    {
        Gate::authorize('manageIntegrations', $team);

        $integrations = $team->integrations()->with('connectedBy')->get()
            ->keyBy(fn (TeamIntegration $integration): string => $integration->provider->value);

        return Inertia::render('teams/integrations', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'providers' => array_map(function (IntegrationProvider $provider) use ($integrations): array {
                $integration = $integrations->get($provider->value);

                return [
                    'provider' => $provider->value,
                    'label' => $provider->label(),
                    'usesOAuth' => $provider->usesOAuth(),
                    'isTracker' => $provider->isTracker(),
                    'connection' => $integration === null ? null : $this->presentTeamIntegration->handle($integration),
                ];
            }, IntegrationProvider::enabled()),
            'telegram' => IntegrationProvider::Telegram->isEnabled() ? [
                'botUsername' => $telegramBot->username(),
                'conflict' => $telegramBot->hasConflict(),
            ] : null,
        ]);
    }
}
```

In `app/Http/Controllers/TeamsController.php`, import `App\Enums\IntegrationProvider` and add to the `teams/show` props after `'canCreatePokerGame'`:

```php
            'canManageIntegrations' => IntegrationProvider::anyEnabled() && $request->user()->can('manageIntegrations', $team),
```

- [ ] **Step 6: Register the route**

In `routes/web.php`, import `App\Http\Controllers\Integrations\TeamIntegrationsController` and `App\Http\Middleware\EnsureIntegrationProviderEnabled`, and add inside the `w/{workspace}` group, right after the `teams/{team}/poker-decks/{pokerDeck}` delete route:

```php
            Route::middleware(EnsureIntegrationProviderEnabled::class)->group(function () {
                Route::get('teams/{team}/integrations', [TeamIntegrationsController::class, 'index'])->name('teams.integrations.index');
            });
```

Then run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 7: Add the frontend types and the first page**

Create `resources/js/types/integrations.ts`:

```ts
export type IntegrationProviderKey = 'slack' | 'telegram' | 'jira' | 'linear';

export type IntegrationStatus = 'active' | 'setup_required' | 'reconnect_required';

export type IntegrationAccess = 'read' | 'write';

export type JiraSite = { cloudId: string; url: string; name: string };

export type JiraField = { id: string; name: string };

export type IntegrationSettings = {
    teamName?: string;
    channelName?: string;
    configurationUrl?: string;
    chatTitle?: string;
    chatType?: string;
    cloudId?: string | null;
    siteName?: string | null;
    siteUrl?: string | null;
    sites?: JiraSite[];
    storyPointFields?: JiraField[];
    numberFields?: JiraField[];
    organizationName?: string;
    urlKey?: string;
};

export type TeamIntegration = {
    id: string;
    provider: IntegrationProviderKey;
    status: IntegrationStatus;
    statusLabel: string;
    access: IntegrationAccess;
    settings: IntegrationSettings;
    connectedBy: string | null;
    connectedAt: string | null;
    lastCheckedAt: string | null;
    lastError: string | null;
};

export type IntegrationProviderCard = {
    provider: IntegrationProviderKey;
    label: string;
    usesOAuth: boolean;
    isTracker: boolean;
    connection: TeamIntegration | null;
};

export type IntegrationScope = { workspace: string; team: string };

export type TelegramBotInfo = { botUsername: string | null; conflict: boolean };

export type TelegramConnectCode = {
    code: string;
    command: string;
    botUsername: string;
    expiresAt: string;
};
```

Append to `resources/js/types/index.ts`:

```ts
export type * from './integrations';
```

Create `resources/js/pages/teams/integrations.tsx`:

```tsx
import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import { useTrans } from '@/hooks/use-trans';
import type {
    IntegrationProviderCard,
    TeamSummary,
    TelegramBotInfo,
    WorkspaceSummary,
} from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    providers: IntegrationProviderCard[];
    telegram: TelegramBotInfo | null;
};

export default function TeamIntegrations({ team, providers }: Props) {
    const { t } = useTrans();

    return (
        <>
            <Head title={t('Integrations')} />
            <div className="max-w-2xl space-y-6 p-4">
                <Heading
                    title={t('Integrations')}
                    description={t('Connect :team to the tools it already uses.', {
                        team: team.name,
                    })}
                />
                <ul className="space-y-2">
                    {providers.map((card) => (
                        <li
                            key={card.provider}
                            className="flex justify-between rounded-md border p-3 text-sm"
                        >
                            <span>{card.label}</span>
                            <span>
                                {card.connection?.statusLabel ??
                                    t('Not connected')}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </>
    );
}
```

In `resources/js/pages/teams/show.tsx`: import `TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController'`, add `canManageIntegrations: boolean;` to `Props` and to the destructured props, and replace the "Open action items" button block with:

```tsx
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link
                            href={WorkspaceActionItemsController.index(
                                workspace.slug,
                                { query: { team: team.id } },
                            )}
                        >
                            {t('Open action items (:count)', {
                                count: openActionItemCount,
                            })}
                        </Link>
                    </Button>
                    {canManageIntegrations && (
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={TeamIntegrationsController.index(params)}
                            >
                                {t('Integrations')}
                            </Link>
                        </Button>
                    )}
                </div>
```

- [ ] **Step 8: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `Integrations` | `Intégrations` | `Integraciones` | `Integrationen` |
| `Connect :team to the tools it already uses.` | `Connectez :team aux outils qu'elle utilise déjà.` | `Conecta :team con las herramientas que ya usa.` | `Verbinde :team mit den Werkzeugen, die es schon nutzt.` |
| `Not connected` | `Non connecté` | `No conectado` | `Nicht verbunden` |

- [ ] **Step 9: Run the tests and the frontend checks**

Run:
```bash
vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationsPageTest.php tests/Feature/Teams tests/Feature/TranslationKeysTest.php
npm run types:check && npm run check
```
Expected: PASS (no new lint or type error).

- [ ] **Step 10: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
npx vp check --fix resources/js/types/integrations.ts resources/js/types/index.ts resources/js/pages/teams/integrations.tsx resources/js/pages/teams/show.tsx
git add app/Policies/TeamPolicy.php app/Http app/Actions/Integrations routes/web.php resources/js/types resources/js/pages/teams tests/Pest.php tests/Feature/Integrations/IntegrationsPageTest.php lang
git commit -m "feat: add the team integrations page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 7: OAuth flow and Slack connection

**Files:**
- Create: `app/Support/Integrations/OAuthState.php`, `app/Actions/Integrations/{OAuthConnector,OAuthConnectors,SaveTeamIntegration,ConnectSlack}.php`, `app/Events/Integrations/IntegrationActivated.php`, `app/Http/Controllers/Integrations/{IntegrationAuthorizationsController,IntegrationCallbacksController}.php`
- Modify: `routes/web.php`, `tests/Pest.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/ConnectSlackTest.php`

**Interfaces:**
- Consumes: `SlackClient` (Task 4), `TeamIntegration` (Task 3), `EnsureIntegrationProviderEnabled`, `TeamPolicy::manageIntegrations` (Task 6), `ConnectionRefused`, `IntegrationException` (Task 2).
- Produces: `OAuthState::{SessionKey, issue(Request, IntegrationProvider, Team, IntegrationAccess): string, consume(Request, IntegrationProvider, mixed $state): ?array{teamId: string, access: IntegrationAccess}}`; interface `OAuthConnector::{authorizationUrl(string $state, IntegrationAccess): string, connect(Team, User, IntegrationAccess, string $code): TeamIntegration}`; `OAuthConnectors::for(IntegrationProvider): OAuthConnector` (Slack now; Tasks 8 and 9 add Jira and Linear); `SaveTeamIntegration` and `IntegrationActivated` (Contract); routes `teams.integrations.connect` (`GET w/{workspace}/teams/{team}/integrations/{provider}/connect?access=read|write`) and `integrations.callback` (`GET integrations/{provider}/callback`); Pest helper `integrationOAuthSession(...)`.

- [ ] **Step 1: Add the Pest helper**

In `tests/Pest.php` import `App\Enums\IntegrationAccess` and `App\Support\Integrations\OAuthState`, then append:

```php
/**
 * @return array<string, array<string, int|string>>
 */
function integrationOAuthSession(
    Team $team,
    IntegrationProvider $provider,
    IntegrationAccess $access = IntegrationAccess::Write,
    string $state = 'oauth-state-0123456789abcdefghijklmnopqrstu',
    int $expiresInMinutes = 10,
): array {
    return [OAuthState::SessionKey => [
        'state' => $state,
        'provider' => $provider->value,
        'teamId' => $team->id,
        'access' => $access->value,
        'expiresAt' => now()->addMinutes($expiresInMinutes)->getTimestamp(),
    ]];
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Integrations/ConnectSlackTest.php`:

```php
<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\Integrations\IntegrationActivated;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\OAuthState;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Slack);
});

function fakeSlackOAuth(string $webhook = 'https://hooks.slack.com/services/T111/B222/secret'): void
{
    Http::fake(['slack.com/api/oauth.v2.access' => Http::response([
        'ok' => true,
        'access_token' => 'xoxp-new-token',
        'scope' => 'incoming-webhook',
        'team' => ['id' => 'T111', 'name' => 'Acme'],
        'incoming_webhook' => [
            'channel' => '#retros',
            'channel_id' => 'C222',
            'configuration_url' => 'https://acme.slack.com/services/B222',
            'url' => $webhook,
        ],
    ])]);
}

/**
 * @param  array<string, string>  $query
 * @param  array<string, mixed>|null  $session
 */
function slackCallback(User $user, Team $team, array $query = ['code' => 'the-code', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu'], ?array $session = null): TestResponse
{
    return test()->actingAs($user)
        ->withSession($session ?? integrationOAuthSession($team, IntegrationProvider::Slack))
        ->get(route('integrations.callback', ['provider' => 'slack', ...$query]));
}

it('sends admins to Slack with a single-use state', function () {
    $team = Team::factory()->create();

    $response = $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.connect', [$team->workspace, $team, 'slack']));

    $location = (string) $response->headers->get('Location');
    parse_str((string) parse_url($location, PHP_URL_QUERY), $query);
    $stored = session(OAuthState::SessionKey);

    expect($location)->toStartWith('https://slack.com/oauth/v2/authorize?')
        ->and($query['scope'])->toBe('incoming-webhook')
        ->and($query['redirect_uri'])->toBe(config('services.slack.redirect'))
        ->and(strlen($query['state']))->toBe(40)
        ->and($stored['state'])->toBe($query['state'])
        ->and($stored['provider'])->toBe('slack')
        ->and($stored['teamId'])->toBe($team->id)
        ->and($stored['access'])->toBe('write');
});

it('refuses to start a connection for members or disabled providers', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->get(route('teams.integrations.connect', [$team->workspace, $team, 'slack']))
        ->assertForbidden();

    disableIntegrations();

    $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.connect', [$team->workspace, $team, 'slack']))
        ->assertNotFound();
});

it('connects the channel chosen on Slack', function () {
    Event::fake([IntegrationActivated::class]);
    fakeSlackOAuth();
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);

    slackCallback($admin, $team)
        ->assertRedirect(route('teams.integrations.index', [$team->workspace, $team]))
        ->assertInertiaFlash('toast', ['type' => 'success', 'message' => 'Slack connected.']);

    $integration = TeamIntegration::query()->sole();

    expect($integration->team_id)->toBe($team->id)
        ->and($integration->provider)->toBe(IntegrationProvider::Slack)
        ->and($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->access)->toBe(IntegrationAccess::Write)
        ->and($integration->connected_by_user_id)->toBe($admin->id)
        ->and($integration->scopes)->toBe(['incoming-webhook'])
        ->and($integration->settings)->toBe([
            'teamId' => 'T111',
            'teamName' => 'Acme',
            'channelId' => 'C222',
            'channelName' => '#retros',
            'configurationUrl' => 'https://acme.slack.com/services/B222',
        ])
        ->and($integration->credential('webhook_url'))->toBe('https://hooks.slack.com/services/T111/B222/secret')
        ->and($integration->credential('access_token'))->toBe('xoxp-new-token');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://slack.com/api/oauth.v2.access'
        && $request['code'] === 'the-code'
        && $request['client_secret'] === 'slack-secret');
    Event::assertNotDispatched(IntegrationActivated::class);
    expect(session()->has(OAuthState::SessionKey))->toBeFalse();
});

it('reconnects on the same row', function () {
    fakeSlackOAuth();
    $team = Team::factory()->create();
    $existing = TeamIntegration::factory()->slack()->reconnectRequired()->create(['team_id' => $team->id]);

    slackCallback(integrationAdmin($team), $team)->assertRedirect();

    $integration = TeamIntegration::query()->sole();

    expect($integration->id)->toBe($existing->id)
        ->and($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->last_error)->toBeNull()
        ->and($integration->setting('channelName'))->toBe('#retros');
});

it('refuses callbacks with a bad state', function (array $query, ?Closure $session) {
    fakeSlackOAuth();
    $team = Team::factory()->create();

    slackCallback(integrationAdmin($team), $team, $query, $session === null ? null : $session($team))
        ->assertRedirect(route('teams.integrations.index', [$team->workspace, $team]))
        ->assertInertiaFlash('toast', ['type' => 'error', 'message' => 'Could not connect Slack. Try again.']);

    expect(TeamIntegration::query()->count())->toBe(0);
    Http::assertNothingSent();
})->with([
    'state mismatch' => [['code' => 'c', 'state' => 'another-state'], null],
    'provider error' => [['error' => 'access_denied', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu'], null],
    'missing code' => [['state' => 'oauth-state-0123456789abcdefghijklmnopqrstu'], null],
    'expired state' => [['code' => 'c', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu'], fn (Team $team) => integrationOAuthSession($team, IntegrationProvider::Slack, expiresInMinutes: -1)],
    'state of another provider' => [['code' => 'c', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu'], fn (Team $team) => integrationOAuthSession($team, IntegrationProvider::Jira)],
]);

it('accepts a state only once', function () {
    fakeSlackOAuth();
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);

    slackCallback($admin, $team)->assertRedirect();

    $this->actingAs($admin)
        ->get(route('integrations.callback', ['provider' => 'slack', 'code' => 'the-code', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu']))
        ->assertRedirect(route('dashboard'));

    Http::assertSentCount(1);
});

it('refuses a callback once the user cannot manage the team', function () {
    fakeSlackOAuth();
    $team = Team::factory()->create();

    slackCallback(teamMember($team), $team)
        ->assertRedirect(route('dashboard'))
        ->assertInertiaFlash('toast', ['type' => 'error', 'message' => 'Could not connect Slack. Try again.']);

    expect(TeamIntegration::query()->count())->toBe(0);
});

it('refuses a webhook outside hooks.slack.com', function () {
    fakeSlackOAuth('https://evil.test/hook');
    $team = Team::factory()->create();

    slackCallback(integrationAdmin($team), $team)
        ->assertInertiaFlash('toast', ['type' => 'error', 'message' => 'Slack did not return a valid channel webhook. Try again.']);

    expect(TeamIntegration::query()->count())->toBe(0);
});

it('reports a refused code exchange', function () {
    Http::fake(['slack.com/api/oauth.v2.access' => Http::response(['ok' => false, 'error' => 'invalid_code'])]);
    $team = Team::factory()->create();

    slackCallback(integrationAdmin($team), $team)
        ->assertInertiaFlash('toast', ['type' => 'error', 'message' => 'Could not connect Slack. Try again.']);

    expect(TeamIntegration::query()->count())->toBe(0);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ConnectSlackTest.php`
Expected: FAIL — `Class "App\Support\Integrations\OAuthState" not found`.

- [ ] **Step 4: Create the OAuth state store**

Create `app/Support/Integrations/OAuthState.php`:

```php
<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Models\Team;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class OAuthState
{
    public const SessionKey = 'integrations.oauth';

    private const TtlMinutes = 10;

    private const Length = 40;

    public function issue(Request $request, IntegrationProvider $provider, Team $team, IntegrationAccess $access): string
    {
        $state = Str::random(self::Length);

        $request->session()->put(self::SessionKey, [
            'state' => $state,
            'provider' => $provider->value,
            'teamId' => $team->id,
            'access' => $access->value,
            'expiresAt' => now()->addMinutes(self::TtlMinutes)->getTimestamp(),
        ]);

        return $state;
    }

    /**
     * @return array{teamId: string, access: IntegrationAccess}|null
     */
    public function consume(Request $request, IntegrationProvider $provider, mixed $state): ?array
    {
        $stored = $request->session()->pull(self::SessionKey);

        if (! is_array($stored) || ! is_string($state) || ! is_string($stored['state'] ?? null)) {
            return null;
        }

        if (! hash_equals($stored['state'], $state)) {
            return null;
        }

        if (($stored['provider'] ?? null) !== $provider->value) {
            return null;
        }

        if ((int) ($stored['expiresAt'] ?? 0) < now()->getTimestamp()) {
            return null;
        }

        $access = IntegrationAccess::tryFrom((string) ($stored['access'] ?? ''));

        if ($access === null || ! is_string($stored['teamId'] ?? null)) {
            return null;
        }

        return ['teamId' => $stored['teamId'], 'access' => $access];
    }
}
```

- [ ] **Step 5: Create the connection actions and the event**

Create `app/Events/Integrations/IntegrationActivated.php`:

```php
<?php

namespace App\Events\Integrations;

use App\Models\TeamIntegration;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A Jira or Linear connection became active with write access (connect,
 * upgrade, reconnect or site choice).
 */
class IntegrationActivated implements ShouldDispatchAfterCommit
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public TeamIntegration $integration, public bool $siteChanged) {}
}
```

Create `app/Actions/Integrations/OAuthConnector.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;

interface OAuthConnector
{
    public function authorizationUrl(string $state, IntegrationAccess $access): string;

    public function connect(Team $team, User $user, IntegrationAccess $access, string $code): TeamIntegration;
}
```

Create `app/Actions/Integrations/OAuthConnectors.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use InvalidArgumentException;

class OAuthConnectors
{
    public function for(IntegrationProvider $provider): OAuthConnector
    {
        return match ($provider) {
            IntegrationProvider::Slack => app(ConnectSlack::class),
            default => throw new InvalidArgumentException("{$provider->label()} does not connect through OAuth."),
        };
    }
}
```

Create `app/Actions/Integrations/SaveTeamIntegration.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\Integrations\IntegrationActivated;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Creates or replaces a team's connection to a provider. Account mappings
 * are site-specific, so moving to another Jira site or Linear organization
 * deletes them.
 */
class SaveTeamIntegration
{
    /**
     * @param  array{
     *     status: IntegrationStatus,
     *     access: IntegrationAccess,
     *     credentials: array<string, mixed>,
     *     settings: array<string, mixed>,
     *     scopes: array<int, string>
     * }  $attributes
     */
    public function handle(Team $team, IntegrationProvider $provider, User $user, array $attributes): TeamIntegration
    {
        return DB::transaction(function () use ($team, $provider, $user, $attributes): TeamIntegration {
            $existing = TeamIntegration::query()
                ->where('team_id', $team->id)
                ->where('provider', $provider->value)
                ->lockForUpdate()
                ->first();

            $wasActiveWriter = $existing !== null && $existing->canWrite();
            $previousSite = $existing?->site();

            $integration = $existing ?? new TeamIntegration;

            $integration->forceFill([
                'team_id' => $team->id,
                'provider' => $provider,
                ...$attributes,
                'connected_by_user_id' => $user->id,
                'last_error' => null,
                'last_checked_at' => now(),
            ])->save();

            $site = $integration->site();
            $siteChanged = $previousSite !== null && $site !== null && $site !== $previousSite;

            if ($siteChanged) {
                $integration->userMappings()->delete();
            }

            if ($provider->isTracker() && $integration->canWrite() && ($siteChanged || ! $wasActiveWriter)) {
                IntegrationActivated::dispatch($integration, $siteChanged);
            }

            return $integration;
        });
    }
}
```

Create `app/Actions/Integrations/ConnectSlack.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ConnectionRefused;
use App\Support\Integrations\Slack\SlackClient;

class ConnectSlack implements OAuthConnector
{
    public function __construct(private SlackClient $slack, private SaveTeamIntegration $saveTeamIntegration) {}

    public function authorizationUrl(string $state, IntegrationAccess $access): string
    {
        return $this->slack->authorizationUrl($state);
    }

    public function connect(Team $team, User $user, IntegrationAccess $access, string $code): TeamIntegration
    {
        $payload = $this->slack->exchangeCode($code);
        $webhook = data_get($payload, 'incoming_webhook.url');

        if (! is_string($webhook) || ! SlackClient::isWebhookUrl($webhook)) {
            throw new ConnectionRefused(__('Slack did not return a valid channel webhook. Try again.'));
        }

        return $this->saveTeamIntegration->handle($team, IntegrationProvider::Slack, $user, [
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => [
                'webhook_url' => $webhook,
                'access_token' => (string) data_get($payload, 'access_token', ''),
            ],
            'settings' => [
                'teamId' => (string) data_get($payload, 'team.id', ''),
                'teamName' => (string) data_get($payload, 'team.name', ''),
                'channelId' => (string) data_get($payload, 'incoming_webhook.channel_id', ''),
                'channelName' => (string) data_get($payload, 'incoming_webhook.channel', ''),
                'configurationUrl' => (string) data_get($payload, 'incoming_webhook.configuration_url', ''),
            ],
            'scopes' => array_values(array_filter(explode(',', (string) data_get($payload, 'scope', '')))),
        ]);
    }
}
```

- [ ] **Step 6: Create the controllers and routes**

Create `app/Http/Controllers/Integrations/IntegrationAuthorizationsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\OAuthConnectors;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Integrations\OAuthState;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class IntegrationAuthorizationsController extends Controller
{
    public function __construct(private OAuthState $oauthState, private OAuthConnectors $connectors) {}

    public function create(Request $request, Workspace $workspace, Team $team, IntegrationProvider $provider): RedirectResponse
    {
        Gate::authorize('manageIntegrations', $team);

        $validated = $request->validate([
            'access' => ['sometimes', Rule::enum(IntegrationAccess::class)],
        ]);

        $access = $provider->isTracker()
            ? IntegrationAccess::from($validated['access'] ?? IntegrationAccess::Read->value)
            : IntegrationAccess::Write;

        $state = $this->oauthState->issue($request, $provider, $team, $access);

        return redirect()->away($this->connectors->for($provider)->authorizationUrl($state, $access));
    }
}
```

Create `app/Http/Controllers/Integrations/IntegrationCallbacksController.php`. The team stored with the state only decides where the admin is sent back after a failure; nothing is connected without a valid state, and the permission check runs first:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\OAuthConnectors;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Support\Integrations\Exceptions\ConnectionRefused;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\OAuthState;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class IntegrationCallbacksController extends Controller
{
    public function __construct(private OAuthState $oauthState, private OAuthConnectors $connectors) {}

    public function show(Request $request, IntegrationProvider $provider): RedirectResponse
    {
        $stored = $request->session()->get(OAuthState::SessionKey);
        $state = $this->oauthState->consume($request, $provider, $request->query('state'));
        $teamId = $state['teamId'] ?? (is_array($stored) && is_string($stored['teamId'] ?? null) ? $stored['teamId'] : null);
        $team = $teamId === null ? null : Team::query()->with('workspace')->find($teamId);

        if ($team === null || $request->user()->cannot('manageIntegrations', $team)) {
            return $this->failed($provider, null);
        }

        if ($state === null) {
            return $this->failed($provider, $team);
        }

        $code = $request->query('code');

        if ($request->has('error') || ! is_string($code) || $code === '') {
            return $this->failed($provider, $team);
        }

        try {
            $integration = $this->connectors->for($provider)->connect($team, $request->user(), $state['access'], $code);
        } catch (ConnectionRefused $exception) {
            return $this->failed($provider, $team, $exception->getMessage());
        } catch (IntegrationException) {
            return $this->failed($provider, $team);
        }

        Inertia::flash('toast', $integration->status === IntegrationStatus::SetupRequired
            ? ['type' => 'info', 'message' => __('Choose a Jira site to finish connecting.')]
            : ['type' => 'success', 'message' => __(':provider connected.', ['provider' => $provider->label()])]);

        return to_route('teams.integrations.index', [$team->workspace, $team]);
    }

    private function failed(IntegrationProvider $provider, ?Team $team, ?string $message = null): RedirectResponse
    {
        Inertia::flash('toast', [
            'type' => 'error',
            'message' => $message ?? __('Could not connect :provider. Try again.', ['provider' => $provider->label()]),
        ]);

        return $team === null
            ? to_route('dashboard')
            : to_route('teams.integrations.index', [$team->workspace, $team]);
    }
}
```

In `routes/web.php` import the two controllers. Inside the `EnsureIntegrationProviderEnabled` group of Task 6 add:

```php
                Route::get('teams/{team}/integrations/{provider}/connect', [IntegrationAuthorizationsController::class, 'create'])
                    ->whereIn('provider', ['slack', 'jira', 'linear'])
                    ->name('teams.integrations.connect');
```

and inside the top-level `Route::middleware(['auth', 'verified'])` group, after the `notifications/{notification}` route:

```php
    Route::get('integrations/{provider}/callback', [IntegrationCallbacksController::class, 'show'])
        ->whereIn('provider', ['slack', 'jira', 'linear'])
        ->middleware(EnsureIntegrationProviderEnabled::class)
        ->name('integrations.callback');
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 7: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `Could not connect :provider. Try again.` | `Impossible de connecter :provider. Réessayez.` | `No se pudo conectar :provider. Inténtalo de nuevo.` | `:provider konnte nicht verbunden werden. Versuche es erneut.` |
| `:provider connected.` | `:provider est connecté.` | `:provider conectado.` | `:provider ist verbunden.` |
| `Choose a Jira site to finish connecting.` | `Choisissez un site Jira pour terminer la connexion.` | `Elige un sitio de Jira para terminar la conexión.` | `Wähle eine Jira-Site, um die Verbindung abzuschließen.` |
| `Slack did not return a valid channel webhook. Try again.` | `Slack n'a pas renvoyé de webhook de canal valide. Réessayez.` | `Slack no devolvió un webhook de canal válido. Inténtalo de nuevo.` | `Slack hat keinen gültigen Kanal-Webhook geliefert. Versuche es erneut.` |

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ConnectSlackTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Integrations/OAuthState.php app/Actions/Integrations app/Events/Integrations app/Http/Controllers/Integrations routes/web.php tests/Pest.php tests/Feature/Integrations/ConnectSlackTest.php lang
git commit -m "feat: connect Slack channels through OAuth

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 8: Jira Cloud connection (sites, story points, upgrade, settings)

**Files:**
- Create: `app/Actions/Integrations/{ConnectJira,DetectJiraStoryPointFields,UpdateTeamIntegration}.php`, `app/Http/Controllers/Integrations/JiraFieldDetectionsController.php`
- Modify: `app/Actions/Integrations/OAuthConnectors.php`, `app/Http/Controllers/Integrations/TeamIntegrationsController.php` (`update`), `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/ConnectJiraTest.php`

**Interfaces:**
- Consumes: `JiraClient`, `OAuthTokens` (Task 5), `SaveTeamIntegration`, `OAuthConnector`, `IntegrationActivated` (Task 7), `PresentTeamIntegration` (Task 6).
- Produces: `ConnectJira` (+ `static siteSettings(array $current, array{cloudId, url, name} $site): array`), `DetectJiraStoryPointFields::{handle(TeamIntegration): TeamIntegration, handleQuietly(TeamIntegration): void, applyOverride(TeamIntegration): TeamIntegration}`, `UpdateTeamIntegration::{rules, handle}` (Contract), routes `teams.integrations.update` (`PATCH …/integrations/{integration}`, body `{cloud_id?, story_point_field_id?}`, 200 presented integration) and `teams.integrations.detection.store` (`POST …/integrations/{integration}/detection`, 200 presented integration). Jira settings keys: `cloudId`, `siteUrl`, `siteName`, `sites` (setup only), `storyPointFields`, `numberFields`, `storyPointFieldOverride`; 12d adds `exportProjectId`, `exportIssueTypeId`, `priorityMap`, all kept on a same-site reconnect and dropped on a site change.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/ConnectJiraTest.php`:

```php
<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\Integrations\IntegrationActivated;
use App\Models\IntegrationUserMapping;
use App\Models\PokerTask;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira);
});

/**
 * @return array<int, array<string, mixed>>
 */
function jiraFieldsFixture(): array
{
    return [
        ['id' => 'summary', 'name' => 'Summary', 'custom' => false, 'schema' => ['type' => 'string']],
        ['id' => 'customfield_10028', 'name' => 'Story Points', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.atlassian.jira.plugin.system.customfieldtypes:float']],
        ['id' => 'customfield_10016', 'name' => 'Story point estimate', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.pyxis.greenhopper.jira:jsw-story-points']],
        ['id' => 'customfield_10050', 'name' => 'Business value', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.atlassian.jira.plugin.system.customfieldtypes:float']],
        ['id' => 'customfield_10060', 'name' => 'Story points', 'custom' => true, 'schema' => ['type' => 'string']],
    ];
}

/**
 * @param  array<int, array<string, mixed>>  $sites
 * @param  array<int, array<string, mixed>>|null  $fields
 */
function fakeJiraOAuth(array $sites = [['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme', 'scopes' => ['read:jira-work']]], ?array $fields = null): void
{
    Http::fake([
        'auth.atlassian.com/oauth/token' => Http::response([
            'access_token' => 'jira-access-new',
            'refresh_token' => 'jira-refresh-new',
            'expires_in' => 3600,
            'scope' => 'offline_access read:jira-work read:board-scope:jira-software read:sprint:jira-software write:jira-work read:jira-user',
        ]),
        'api.atlassian.com/oauth/token/accessible-resources' => Http::response($sites),
        'api.atlassian.com/ex/jira/*/rest/api/3/field' => Http::response($fields ?? jiraFieldsFixture()),
    ]);
}

function jiraCallback(User $user, Team $team, IntegrationAccess $access = IntegrationAccess::Write): TestResponse
{
    return test()->actingAs($user)
        ->withSession(integrationOAuthSession($team, IntegrationProvider::Jira, $access))
        ->get(route('integrations.callback', ['provider' => 'jira', 'code' => 'jira-code', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu']));
}

/**
 * @param  array<string, mixed>  $body
 */
function patchIntegration(User $user, TeamIntegration $integration, array $body): TestResponse
{
    return test()->actingAs($user)->patchJson(
        route('teams.integrations.update', [$integration->team->workspace, $integration->team, $integration]),
        $body,
    );
}

it('asks for read or read-and-write access', function (string $access, string $scope) {
    $team = Team::factory()->create();

    $response = $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.connect', [$team->workspace, $team, 'jira', 'access' => $access]));

    parse_str((string) parse_url((string) $response->headers->get('Location'), PHP_URL_QUERY), $query);

    expect($query['scope'])->toBe($scope)
        ->and(session('integrations.oauth.access'))->toBe($access);
})->with([
    'read' => ['read', 'offline_access read:jira-work read:board-scope:jira-software read:sprint:jira-software'],
    'write' => ['write', 'offline_access read:jira-work read:board-scope:jira-software read:sprint:jira-software write:jira-work read:jira-user'],
]);

it('connects a single Jira site and detects its story points fields', function () {
    Event::fake([IntegrationActivated::class]);
    fakeJiraOAuth();
    $team = Team::factory()->create();

    jiraCallback(integrationAdmin($team), $team)
        ->assertInertiaFlash('toast', ['type' => 'success', 'message' => 'Jira connected.']);

    $integration = TeamIntegration::query()->sole();

    expect($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->access)->toBe(IntegrationAccess::Write)
        ->and($integration->hasScope('read:jira-user'))->toBeTrue()
        ->and($integration->credential('access_token'))->toBe('jira-access-new')
        ->and($integration->credential('refresh_token'))->toBe('jira-refresh-new')
        ->and($integration->setting('cloudId'))->toBe('cloud-1')
        ->and($integration->setting('siteUrl'))->toBe('https://acme.atlassian.net')
        ->and($integration->setting('siteName'))->toBe('Acme')
        ->and($integration->setting('storyPointFields'))->toBe([
            ['id' => 'customfield_10016', 'name' => 'Story point estimate'],
            ['id' => 'customfield_10028', 'name' => 'Story Points'],
        ])
        ->and($integration->setting('numberFields'))->toBe([
            ['id' => 'customfield_10028', 'name' => 'Story Points'],
            ['id' => 'customfield_10016', 'name' => 'Story point estimate'],
            ['id' => 'customfield_10050', 'name' => 'Business value'],
        ]);

    Http::assertSent(fn (Request $request) => $request->url() === 'https://auth.atlassian.com/oauth/token'
        && $request['grant_type'] === 'authorization_code'
        && $request['code'] === 'jira-code');
    Event::assertDispatched(IntegrationActivated::class, fn (IntegrationActivated $event) => $event->integration->is($integration) && ! $event->siteChanged);
});

it('does not announce read-only connections', function () {
    Event::fake([IntegrationActivated::class]);
    fakeJiraOAuth();
    $team = Team::factory()->create();

    jiraCallback(integrationAdmin($team), $team, IntegrationAccess::Read);

    expect(TeamIntegration::query()->sole()->access)->toBe(IntegrationAccess::Read);
    Event::assertNotDispatched(IntegrationActivated::class);
});

it('asks the admin to choose among several sites', function () {
    Event::fake([IntegrationActivated::class]);
    fakeJiraOAuth([
        ['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme'],
        ['id' => 'cloud-2', 'url' => 'https://beta.atlassian.net', 'name' => 'Beta'],
    ]);
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);

    jiraCallback($admin, $team)
        ->assertInertiaFlash('toast', ['type' => 'info', 'message' => 'Choose a Jira site to finish connecting.']);

    $integration = TeamIntegration::query()->sole();

    expect($integration->status)->toBe(IntegrationStatus::SetupRequired)
        ->and($integration->setting('sites'))->toHaveCount(2);
    Event::assertNotDispatched(IntegrationActivated::class);

    patchIntegration($admin, $integration, ['cloud_id' => 'cloud-2'])
        ->assertOk()
        ->assertJsonPath('status', 'active')
        ->assertJsonPath('settings.siteName', 'Beta')
        ->assertJsonMissingPath('settings.sites');

    expect($integration->fresh()->setting('storyPointFields.0.id'))->toBe('customfield_10016');
    Event::assertDispatched(IntegrationActivated::class);
});

it('keeps the current site when it is among several sites', function () {
    fakeJiraOAuth([
        ['id' => 'cloud-2', 'url' => 'https://beta.atlassian.net', 'name' => 'Beta'],
        ['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme'],
    ]);
    $team = Team::factory()->create();
    TeamIntegration::factory()->jira()->reconnectRequired()->create(['team_id' => $team->id]);

    jiraCallback(integrationAdmin($team), $team);

    $integration = TeamIntegration::query()->sole();

    expect($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->site())->toBe('cloud-1');
});

it('refuses an Atlassian account without a Jira site', function () {
    fakeJiraOAuth([]);
    $team = Team::factory()->create();

    jiraCallback(integrationAdmin($team), $team)
        ->assertInertiaFlash('toast', ['type' => 'error', 'message' => 'This Atlassian account has no Jira site.']);

    expect(TeamIntegration::query()->count())->toBe(0);
});

it('upgrades read access without losing the site or imported references', function () {
    Event::fake([IntegrationActivated::class]);
    fakeJiraOAuth();
    $team = Team::factory()->create();
    $existing = TeamIntegration::factory()->jira(IntegrationAccess::Read)->create([
        'team_id' => $team->id,
        'settings' => [
            'cloudId' => 'cloud-1', 'siteUrl' => 'https://acme.atlassian.net', 'siteName' => 'Acme',
            'storyPointFields' => [], 'numberFields' => [], 'exportProjectId' => '10000',
        ],
    ]);
    $task = PokerTask::factory()->imported()->create();

    jiraCallback(integrationAdmin($team), $team);

    $integration = TeamIntegration::query()->sole();

    expect($integration->id)->toBe($existing->id)
        ->and($integration->access)->toBe(IntegrationAccess::Write)
        ->and($integration->setting('exportProjectId'))->toBe('10000')
        ->and($task->fresh()->external_site)->toBe($integration->site());
    Event::assertDispatched(IntegrationActivated::class, fn (IntegrationActivated $event) => ! $event->siteChanged);
});

it('deletes account mappings when reconnecting to another site only', function () {
    Event::fake([IntegrationActivated::class]);
    Http::fake([
        'auth.atlassian.com/oauth/token' => Http::response(['access_token' => 'jira-access-new', 'refresh_token' => 'jira-refresh-new', 'expires_in' => 3600, 'scope' => 'offline_access read:jira-work write:jira-work read:jira-user']),
        'api.atlassian.com/oauth/token/accessible-resources' => Http::sequence()
            ->push([['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme']])
            ->push([['id' => 'cloud-9', 'url' => 'https://other.atlassian.net', 'name' => 'Other']]),
        'api.atlassian.com/ex/jira/*/rest/api/3/field' => Http::response(jiraFieldsFixture()),
    ]);
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $team->id, 'settings' => [
        'cloudId' => 'cloud-1', 'siteUrl' => 'https://acme.atlassian.net', 'siteName' => 'Acme', 'exportProjectId' => '10000',
    ]]);
    IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id]);

    jiraCallback($admin, $team);

    expect($integration->userMappings()->count())->toBe(1)
        ->and($integration->fresh()->setting('exportProjectId'))->toBe('10000');
    Event::assertNotDispatched(IntegrationActivated::class);

    jiraCallback($admin, $team);

    $fresh = $integration->fresh();

    expect($fresh->site())->toBe('cloud-9')
        ->and($fresh->setting('exportProjectId'))->toBeNull()
        ->and($fresh->userMappings()->count())->toBe(0);
    Event::assertDispatched(IntegrationActivated::class, fn (IntegrationActivated $event) => $event->siteChanged);
});

it('lets the admin choose the story points field and detect again', function () {
    fakeJiraOAuth();
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.detection.store', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertJsonPath('settings.storyPointFields.0.id', 'customfield_10016');

    patchIntegration($admin, $integration->fresh(), ['story_point_field_id' => 'customfield_10050'])
        ->assertOk()
        ->assertJsonPath('settings.storyPointFields', [
            ['id' => 'customfield_10050', 'name' => 'Business value'],
            ['id' => 'customfield_10016', 'name' => 'Story point estimate'],
            ['id' => 'customfield_10028', 'name' => 'Story Points'],
        ]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.detection.store', [$team->workspace, $team, $integration]))
        ->assertJsonPath('settings.storyPointFields.0.id', 'customfield_10050');
});

it('reports a site without story points fields', function () {
    fakeJiraOAuth(fields: [['id' => 'summary', 'name' => 'Summary', 'custom' => false, 'schema' => ['type' => 'string']]]);
    $team = Team::factory()->create();

    jiraCallback(integrationAdmin($team), $team);

    expect(TeamIntegration::query()->sole()->setting('storyPointFields'))->toBe([]);
});

it('validates Jira settings changes', function () {
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    $active = TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);

    patchIntegration($admin, $active, ['cloud_id' => 'cloud-1'])->assertJsonValidationErrors('cloud_id');
    patchIntegration($admin, $active, ['story_point_field_id' => 'customfield_99999'])->assertJsonValidationErrors('story_point_field_id');
    patchIntegration(teamMember($team), $active, ['story_point_field_id' => 'customfield_10016'])->assertForbidden();
});

it('detects story points on Jira connections only', function () {
    enableIntegrations(IntegrationProvider::Slack);
    $team = Team::factory()->create();
    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);

    $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.detection.store', [$team->workspace, $team, $slack]))
        ->assertNotFound();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ConnectJiraTest.php`
Expected: FAIL — `Jira does not connect through OAuth.` (InvalidArgumentException from `OAuthConnectors`).

- [ ] **Step 3: Create the story points detection**

Create `app/Actions/Integrations/DetectJiraStoryPointFields.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Jira\JiraClient;
use Illuminate\Support\Str;

class DetectJiraStoryPointFields
{
    private const StoryPointsSchema = 'com.pyxis.greenhopper.jira:jsw-story-points';

    /**
     * @var array<string, int>
     */
    private const NameRanks = ['story points' => 1, 'story point estimate' => 2];

    public function __construct(private JiraClient $jira) {}

    public function handle(TeamIntegration $integration): TeamIntegration
    {
        $numberFields = [];
        $ranked = [];

        foreach ($this->jira->get($integration, 'rest/api/3/field') as $field) {
            if (! is_array($field) || ($field['custom'] ?? false) !== true || data_get($field, 'schema.type') !== 'number') {
                continue;
            }

            $entry = ['id' => (string) ($field['id'] ?? ''), 'name' => (string) ($field['name'] ?? '')];
            $numberFields[] = $entry;
            $rank = $this->rank($field);

            if ($rank !== null) {
                $ranked[] = ['rank' => $rank, 'field' => $entry];
            }
        }

        usort($ranked, fn (array $first, array $second): int => $first['rank'] <=> $second['rank']);

        $integration->forceFill(['settings' => [
            ...$integration->settings,
            'numberFields' => $numberFields,
            'storyPointFields' => array_column($ranked, 'field'),
        ]])->save();

        return $this->applyOverride($integration);
    }

    public function handleQuietly(TeamIntegration $integration): void
    {
        try {
            $this->handle($integration);
        } catch (IntegrationException) {
            // The connection itself succeeded; "Detect again" retries the detection.
        }
    }

    /**
     * Puts the admin's chosen field first, when it still exists on the site.
     */
    public function applyOverride(TeamIntegration $integration): TeamIntegration
    {
        $override = collect((array) $integration->setting('numberFields', []))
            ->first(fn (mixed $field): bool => is_array($field) && ($field['id'] ?? null) === $integration->setting('storyPointFieldOverride'));

        if (! is_array($override)) {
            return $integration;
        }

        $others = array_values(array_filter(
            (array) $integration->setting('storyPointFields', []),
            fn (mixed $field): bool => is_array($field) && ($field['id'] ?? null) !== $override['id'],
        ));

        $integration->forceFill(['settings' => [...$integration->settings, 'storyPointFields' => [$override, ...$others]]])->save();

        return $integration;
    }

    /**
     * @param  array<array-key, mixed>  $field
     */
    private function rank(array $field): ?int
    {
        if (data_get($field, 'schema.custom') === self::StoryPointsSchema) {
            return 0;
        }

        return self::NameRanks[Str::lower(trim((string) ($field['name'] ?? '')))] ?? null;
    }
}
```

- [ ] **Step 4: Create the Jira connector**

Create `app/Actions/Integrations/ConnectJira.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ConnectionRefused;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\OAuthTokens;
use Illuminate\Support\Arr;

class ConnectJira implements OAuthConnector
{
    public function __construct(
        private JiraClient $jira,
        private SaveTeamIntegration $saveTeamIntegration,
        private DetectJiraStoryPointFields $detectStoryPointFields,
    ) {}

    /**
     * Settings for a chosen site: everything is kept on the same site
     * (export target, priority map, story points choice), nothing on
     * another one.
     *
     * @param  array<string, mixed>  $current
     * @param  array{cloudId: string, url: string, name: string}  $site
     * @return array<string, mixed>
     */
    public static function siteSettings(array $current, array $site): array
    {
        $kept = ($current['cloudId'] ?? null) === $site['cloudId'] ? Arr::except($current, ['sites']) : [];

        return [...$kept, 'cloudId' => $site['cloudId'], 'siteUrl' => $site['url'], 'siteName' => $site['name']];
    }

    public function authorizationUrl(string $state, IntegrationAccess $access): string
    {
        return $this->jira->authorizationUrl($state, $access);
    }

    public function connect(Team $team, User $user, IntegrationAccess $access, string $code): TeamIntegration
    {
        $tokens = $this->jira->exchangeCode($code);
        $sites = $this->jira->accessibleResources($tokens['access_token']);

        if ($sites === []) {
            throw new ConnectionRefused(__('This Atlassian account has no Jira site.'));
        }

        $current = $team->integration(IntegrationProvider::Jira)?->settings ?? [];
        $site = count($sites) === 1
            ? $sites[0]
            : collect($sites)->first(fn (array $candidate): bool => $candidate['cloudId'] === ($current['cloudId'] ?? null));

        $integration = $this->saveTeamIntegration->handle($team, IntegrationProvider::Jira, $user, [
            'status' => $site === null ? IntegrationStatus::SetupRequired : IntegrationStatus::Active,
            'access' => $access,
            'credentials' => OAuthTokens::credentials($tokens),
            'settings' => $site === null ? [...$current, 'sites' => $sites] : self::siteSettings($current, $site),
            'scopes' => $tokens['scopes'],
        ]);

        if ($integration->isActive()) {
            $this->detectStoryPointFields->handleQuietly($integration);
        }

        return $integration;
    }
}
```

In `app/Actions/Integrations/OAuthConnectors.php`, add the arm before `default`:

```php
            IntegrationProvider::Jira => app(ConnectJira::class),
```

- [ ] **Step 5: Create the settings update action**

Create `app/Actions/Integrations/UpdateTeamIntegration.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use Illuminate\Validation\Rule;

class UpdateTeamIntegration
{
    public function __construct(
        private SaveTeamIntegration $saveTeamIntegration,
        private DetectJiraStoryPointFields $detectStoryPointFields,
    ) {}

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(TeamIntegration $integration): array
    {
        return match ($integration->provider) {
            IntegrationProvider::Jira => [
                'cloud_id' => ['sometimes', 'required', 'string', Rule::in($this->ids($integration->setting('sites', []), 'cloudId'))],
                'story_point_field_id' => ['sometimes', 'required', 'string', Rule::in($this->ids($integration->setting('numberFields', []), 'id'))],
            ],
            default => [],
        };
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function handle(TeamIntegration $integration, User $user, array $validated): TeamIntegration
    {
        if (is_string($validated['cloud_id'] ?? null)) {
            $integration = $this->chooseJiraSite($integration, $user, $validated['cloud_id']);
        }

        if (is_string($validated['story_point_field_id'] ?? null)) {
            $integration->forceFill(['settings' => [
                ...$integration->settings,
                'storyPointFieldOverride' => $validated['story_point_field_id'],
            ]])->save();

            $integration = $this->detectStoryPointFields->applyOverride($integration);
        }

        return $integration->refresh();
    }

    private function chooseJiraSite(TeamIntegration $integration, User $user, string $cloudId): TeamIntegration
    {
        $site = collect((array) $integration->setting('sites', []))
            ->first(fn (mixed $candidate): bool => is_array($candidate) && ($candidate['cloudId'] ?? null) === $cloudId);
        $credentials = $integration->readableCredentials();

        if ($credentials === null) {
            throw new ReconnectRequired(IntegrationProvider::Jira, $integration->last_error);
        }

        $saved = $this->saveTeamIntegration->handle($integration->team, IntegrationProvider::Jira, $user, [
            'status' => IntegrationStatus::Active,
            'access' => $integration->access,
            'credentials' => $credentials,
            'settings' => ConnectJira::siteSettings($integration->settings, [
                'cloudId' => $cloudId,
                'url' => (string) data_get($site, 'url', ''),
                'name' => (string) data_get($site, 'name', ''),
            ]),
            'scopes' => $integration->scopes,
        ]);

        $this->detectStoryPointFields->handleQuietly($saved);

        return $saved;
    }

    /**
     * @return array<int, string>
     */
    private function ids(mixed $list, string $key): array
    {
        return collect(is_array($list) ? $list : [])
            ->map(fn (mixed $item): mixed => is_array($item) ? ($item[$key] ?? null) : null)
            ->filter(fn (mixed $id): bool => is_string($id))
            ->values()
            ->all();
    }
}
```

- [ ] **Step 6: Add the controllers and routes**

Add to `app/Http/Controllers/Integrations/TeamIntegrationsController.php` (imports `App\Actions\Integrations\UpdateTeamIntegration`, `App\Models\TeamIntegration`, `Illuminate\Http\JsonResponse`, `Illuminate\Http\Request`):

```php
    public function update(Request $request, Workspace $workspace, Team $team, TeamIntegration $integration, UpdateTeamIntegration $updateTeamIntegration): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        $validated = $request->validate($updateTeamIntegration->rules($integration));

        $updated = $updateTeamIntegration->handle($integration, $request->user(), $validated);

        return response()->json($this->presentTeamIntegration->handle($updated->load('connectedBy')));
    }
```

Create `app/Http/Controllers/Integrations/JiraFieldDetectionsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\DetectJiraStoryPointFields;
use App\Actions\Integrations\PresentTeamIntegration;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class JiraFieldDetectionsController extends Controller
{
    public function store(
        Workspace $workspace,
        Team $team,
        TeamIntegration $integration,
        DetectJiraStoryPointFields $detectStoryPointFields,
        PresentTeamIntegration $presentTeamIntegration,
    ): JsonResponse {
        Gate::authorize('manageIntegrations', $team);

        abort_unless($integration->provider === IntegrationProvider::Jira, 404);

        $integration->ensureActive();

        $detected = $detectStoryPointFields->handle($integration);

        return response()->json($presentTeamIntegration->handle($detected->load('connectedBy')));
    }
}
```

In `routes/web.php` import `JiraFieldDetectionsController` and add inside the `EnsureIntegrationProviderEnabled` group:

```php
                Route::patch('teams/{team}/integrations/{integration}', [TeamIntegrationsController::class, 'update'])
                    ->whereUuid('integration')
                    ->name('teams.integrations.update');
                Route::post('teams/{team}/integrations/{integration}/detection', [JiraFieldDetectionsController::class, 'store'])
                    ->whereUuid('integration')
                    ->name('teams.integrations.detection.store');
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 7: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `This Atlassian account has no Jira site.` | `Ce compte Atlassian n'a aucun site Jira.` | `Esta cuenta de Atlassian no tiene ningún sitio de Jira.` | `Dieses Atlassian-Konto hat keine Jira-Site.` |

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ConnectJiraTest.php tests/Feature/Integrations/ConnectSlackTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Integrations app/Http/Controllers/Integrations routes/web.php tests/Feature/Integrations/ConnectJiraTest.php lang
git commit -m "feat: connect Jira Cloud sites with story points detection

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 9: Linear connection

**Files:**
- Create: `app/Actions/Integrations/ConnectLinear.php`
- Modify: `app/Actions/Integrations/OAuthConnectors.php`
- Test: create `tests/Feature/Integrations/ConnectLinearTest.php`

**Interfaces:**
- Consumes: `LinearClient`, `OAuthTokens` (Task 5), `SaveTeamIntegration`, `OAuthConnector` (Task 7).
- Produces: `ConnectLinear`; `OAuthConnectors::for(IntegrationProvider::Linear)`. Linear settings keys: `organizationId`, `organizationName`, `urlKey`; 12d adds `exportTeamId`, `priorityMap`, kept on a same-organization reconnect and dropped otherwise.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/ConnectLinearTest.php`:

```php
<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\Integrations\IntegrationActivated;
use App\Models\IntegrationUserMapping;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Linear);
});

/**
 * @param  array<string, string>  $organization
 */
function fakeLinearOAuth(array $organization = ['id' => 'org-1', 'name' => 'Acme', 'urlKey' => 'acme']): void
{
    Http::fake([
        'api.linear.app/oauth/token' => Http::response([
            'access_token' => 'linear-access-new',
            'token_type' => 'Bearer',
            'expires_in' => 86399,
            'refresh_token' => 'linear-refresh-new',
            'scope' => 'read write',
        ]),
        'api.linear.app/graphql' => Http::response(['data' => ['viewer' => ['organization' => $organization]]]),
    ]);
}

function linearCallback(User $user, Team $team, IntegrationAccess $access = IntegrationAccess::Write): TestResponse
{
    return test()->actingAs($user)
        ->withSession(integrationOAuthSession($team, IntegrationProvider::Linear, $access))
        ->get(route('integrations.callback', ['provider' => 'linear', 'code' => 'linear-code', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu']));
}

it('sends admins to Linear with the requested scopes', function () {
    $team = Team::factory()->create();

    $response = $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.connect', [$team->workspace, $team, 'linear', 'access' => 'read']));

    parse_str((string) parse_url((string) $response->headers->get('Location'), PHP_URL_QUERY), $query);

    expect((string) $response->headers->get('Location'))->toStartWith('https://linear.app/oauth/authorize?')
        ->and($query['scope'])->toBe('read')
        ->and($query['actor'])->toBe('user');
});

it('connects the Linear workspace', function () {
    Event::fake([IntegrationActivated::class]);
    fakeLinearOAuth();
    $team = Team::factory()->create();

    linearCallback(integrationAdmin($team), $team)
        ->assertInertiaFlash('toast', ['type' => 'success', 'message' => 'Linear connected.']);

    $integration = TeamIntegration::query()->sole();

    expect($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->access)->toBe(IntegrationAccess::Write)
        ->and($integration->scopes)->toBe(['read', 'write'])
        ->and($integration->settings)->toBe(['organizationId' => 'org-1', 'organizationName' => 'Acme', 'urlKey' => 'acme'])
        ->and($integration->credential('access_token'))->toBe('linear-access-new')
        ->and($integration->credential('refresh_token'))->toBe('linear-refresh-new')
        ->and($integration->credential('expires_at'))->toBeGreaterThan(now()->getTimestamp());

    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.linear.app/oauth/token'
        && $request['grant_type'] === 'authorization_code'
        && $request['client_secret'] === 'linear-secret'
        && str_contains($request->header('Content-Type')[0] ?? '', 'application/x-www-form-urlencoded'));
    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.linear.app/graphql'
        && $request->hasHeader('Authorization', 'Bearer linear-access-new'));
    Event::assertDispatched(IntegrationActivated::class, fn (IntegrationActivated $event) => ! $event->siteChanged);
});

it('deletes account mappings when reconnecting to another organization', function () {
    Event::fake([IntegrationActivated::class]);
    fakeLinearOAuth(['id' => 'org-2', 'name' => 'Other', 'urlKey' => 'other']);
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->linear()->create([
        'team_id' => $team->id,
        'settings' => ['organizationId' => 'org-1', 'organizationName' => 'Acme', 'urlKey' => 'acme', 'exportTeamId' => 'team-1'],
    ]);
    IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id]);

    linearCallback(integrationAdmin($team), $team);

    $fresh = $integration->fresh();

    expect($fresh->site())->toBe('org-2')
        ->and($fresh->setting('exportTeamId'))->toBeNull()
        ->and($fresh->userMappings()->count())->toBe(0);
    Event::assertDispatched(IntegrationActivated::class, fn (IntegrationActivated $event) => $event->siteChanged);
});

it('keeps settings and mappings when reconnecting to the same organization', function () {
    fakeLinearOAuth();
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->linear()->reconnectRequired()->create([
        'team_id' => $team->id,
        'settings' => ['organizationId' => 'org-1', 'organizationName' => 'Acme', 'urlKey' => 'acme', 'exportTeamId' => 'team-1'],
    ]);
    IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id]);

    linearCallback(integrationAdmin($team), $team);

    $fresh = $integration->fresh();

    expect($fresh->status)->toBe(IntegrationStatus::Active)
        ->and($fresh->setting('exportTeamId'))->toBe('team-1')
        ->and($fresh->userMappings()->count())->toBe(1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ConnectLinearTest.php`
Expected: FAIL — `Linear does not connect through OAuth.`

- [ ] **Step 3: Create the Linear connector**

Create `app/Actions/Integrations/ConnectLinear.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Linear\LinearClient;
use App\Support\Integrations\OAuthTokens;

class ConnectLinear implements OAuthConnector
{
    public function __construct(private LinearClient $linear, private SaveTeamIntegration $saveTeamIntegration) {}

    public function authorizationUrl(string $state, IntegrationAccess $access): string
    {
        return $this->linear->authorizationUrl($state, $access);
    }

    public function connect(Team $team, User $user, IntegrationAccess $access, string $code): TeamIntegration
    {
        $tokens = $this->linear->exchangeCode($code);
        $organization = $this->linear->organization($tokens['access_token']);

        $current = $team->integration(IntegrationProvider::Linear)?->settings ?? [];
        $kept = ($current['organizationId'] ?? null) === $organization['id'] ? $current : [];

        return $this->saveTeamIntegration->handle($team, IntegrationProvider::Linear, $user, [
            'status' => IntegrationStatus::Active,
            'access' => $access,
            'credentials' => OAuthTokens::credentials($tokens),
            'settings' => [
                ...$kept,
                'organizationId' => $organization['id'],
                'organizationName' => $organization['name'],
                'urlKey' => $organization['urlKey'],
            ],
            'scopes' => $tokens['scopes'],
        ]);
    }
}
```

In `app/Actions/Integrations/OAuthConnectors.php`, add the arm before `default`:

```php
            IntegrationProvider::Linear => app(ConnectLinear::class),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ConnectLinearTest.php`
Expected: PASS.

- [ ] **Step 5: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Integrations tests/Feature/Integrations/ConnectLinearTest.php
git commit -m "feat: connect Linear workspaces through OAuth

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 10: Telegram connection (codes, update handling, polling)

**Files:**
- Create: `app/Support/Integrations/Telegram/TelegramConnectCodes.php`, `app/Actions/Integrations/{HandleTelegramUpdate,PollTelegramUpdates}.php`, `app/Console/Commands/PollTelegramUpdatesCommand.php`, `app/Http/Controllers/Integrations/TelegramConnectCodesController.php`
- Modify: `routes/web.php`, `routes/console.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/TelegramConnectTest.php`

**Interfaces:**
- Consumes: `TelegramClient`, `TelegramBot` (Task 4), `SaveTeamIntegration` (Task 7), `IntegrationException`, `TelegramConflict` (Task 2).
- Produces: `TelegramConnectCodes::{Alphabet, issue(Team, User): array{code: string, expiresAt: CarbonImmutable}, consume(string): ?array{teamId: string, userId: string}}`; `HandleTelegramUpdate::handle(array $update): void`; `PollTelegramUpdates::{OffsetKey, handle(int $timeout): int}`; command `skrum:telegram-poll {--timeout=50}` scheduled every minute without overlapping, in the background, on one server; route `teams.integrations.telegramCode.store` (`POST …/integrations/telegram/code` → `{code, command, botUsername, expiresAt}`, `throttle:10,1`). Telegram settings: `chatId` (string), `chatTitle`, `chatType`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/TelegramConnectTest.php`:

```php
<?php

use App\Actions\Integrations\HandleTelegramUpdate;
use App\Actions\Integrations\PollTelegramUpdates;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Telegram\TelegramBot;
use App\Support\Integrations\Telegram\TelegramConnectCodes;
use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Telegram);
});

/**
 * @param  array<int, array<string, mixed>>  $updates
 */
function fakeTelegramBot(array $updates = []): void
{
    Http::fake([
        'api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']]),
        'api.telegram.org/*/getUpdates' => Http::response(['ok' => true, 'result' => $updates]),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => true]),
    ]);
}

/**
 * @param  array<string, mixed>  $chat
 * @return array<string, mixed>
 */
function telegramUpdate(int $id, string $text, array $chat = ['id' => -100123, 'title' => 'Team chat', 'type' => 'supergroup'], string $kind = 'message'): array
{
    return ['update_id' => $id, $kind => ['message_id' => $id, 'date' => 1_700_000_000, 'chat' => $chat, 'text' => $text]];
}

/**
 * @return array{0: Team, 1: User, 2: string}
 */
function telegramCodeFor(): array
{
    $team = Team::factory()->create(['name' => 'Rocket']);
    $admin = integrationAdmin($team);

    return [$team, $admin, app(TelegramConnectCodes::class)->issue($team, $admin)['code']];
}

/**
 * @return array<int, mixed>
 */
function telegramReplies(): array
{
    return Http::recorded()
        ->filter(fn (array $pair) => str_ends_with($pair[0]->url(), '/sendMessage'))
        ->map(fn (array $pair) => $pair[0]['text'])
        ->values()
        ->all();
}

it('issues an eight-character code with the exact command', function () {
    fakeTelegramBot();
    $team = Team::factory()->create();

    $response = $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.telegramCode.store', [$team->workspace, $team]))
        ->assertOk();

    $code = $response->json('code');

    expect($code)->toMatch('/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/')
        ->and($response->json('command'))->toBe("/connect@skrum_test_bot {$code}")
        ->and($response->json('botUsername'))->toBe('skrum_test_bot')
        ->and(now()->diffInMinutes($response->json('expiresAt')))->toBeGreaterThan(14.9);
});

it('reserves Telegram codes to admins of an instance with a bot', function () {
    fakeTelegramBot();
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->postJson(route('teams.integrations.telegramCode.store', [$team->workspace, $team]))
        ->assertForbidden();

    disableIntegrations();

    $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.telegramCode.store', [$team->workspace, $team]))
        ->assertNotFound();
});

it('connects a group that sends the command', function (string $text, string $kind) {
    fakeTelegramBot();
    [$team, $admin, $code] = telegramCodeFor();

    app(HandleTelegramUpdate::class)->handle(telegramUpdate(1, str_replace('CODE', $code, $text), kind: $kind));

    $integration = TeamIntegration::query()->sole();

    expect($integration->team_id)->toBe($team->id)
        ->and($integration->provider)->toBe(IntegrationProvider::Telegram)
        ->and($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->connected_by_user_id)->toBe($admin->id)
        ->and($integration->settings)->toBe(['chatId' => '-100123', 'chatTitle' => 'Team chat', 'chatType' => 'supergroup'])
        ->and(telegramReplies())->toBe(['Connected to the Rocket team on '.config('app.name').'.']);
})->with([
    'addressed to the bot' => ['/connect@skrum_test_bot CODE', 'message'],
    'bot name in another case' => ['/connect@Skrum_Test_Bot CODE', 'message'],
    'without the bot name' => ['/connect CODE', 'message'],
    'channel post' => ['/connect@skrum_test_bot CODE', 'channel_post'],
]);

it('accepts a code only once and only while it is the newest', function () {
    fakeTelegramBot();
    [$team, $admin, $first] = telegramCodeFor();
    $second = app(TelegramConnectCodes::class)->issue($team, $admin)['code'];
    $handler = app(HandleTelegramUpdate::class);

    $handler->handle(telegramUpdate(1, "/connect {$first}"));

    expect(TeamIntegration::query()->count())->toBe(0);

    $handler->handle(telegramUpdate(2, "/connect {$second}"));
    $handler->handle(telegramUpdate(3, "/connect {$second}", ['id' => -100999, 'title' => 'Other chat', 'type' => 'group']));

    expect(TeamIntegration::query()->sole()->setting('chatId'))->toBe('-100123')
        ->and(telegramReplies())->toBe([
            'This code is invalid or has expired. Create a new one in skrum.',
            'Connected to the Rocket team on '.config('app.name').'.',
            'This code is invalid or has expired. Create a new one in skrum.',
        ]);
});

it('expires codes after fifteen minutes', function () {
    fakeTelegramBot();
    [, , $code] = telegramCodeFor();

    $this->travel(16)->minutes();

    app(HandleTelegramUpdate::class)->handle(telegramUpdate(1, "/connect {$code}"));

    expect(TeamIntegration::query()->count())->toBe(0);
});

it('ignores commands for another bot', function () {
    fakeTelegramBot();
    [, , $code] = telegramCodeFor();

    app(HandleTelegramUpdate::class)->handle(telegramUpdate(1, "/connect@other_bot {$code}"));

    expect(TeamIntegration::query()->count())->toBe(0)
        ->and(telegramReplies())->toBe([]);
});

it('locks a chat out after five invalid codes', function () {
    fakeTelegramBot();
    [, , $code] = telegramCodeFor();
    $handler = app(HandleTelegramUpdate::class);

    foreach (range(1, 5) as $attempt) {
        $handler->handle(telegramUpdate($attempt, '/connect WRONG234'));
    }

    $handler->handle(telegramUpdate(6, "/connect {$code}"));

    expect(TeamIntegration::query()->count())->toBe(0)
        ->and(telegramReplies())->toHaveCount(5);

    $this->travel(61)->minutes();
    $fresh = app(TelegramConnectCodes::class)->issue(Team::query()->sole(), User::query()->first());
    $handler->handle(telegramUpdate(7, "/connect {$fresh['code']}"));

    expect(TeamIntegration::query()->count())->toBe(1);
});

it('answers /start and /help and ignores everything else', function () {
    fakeTelegramBot();
    Log::spy();
    $handler = app(HandleTelegramUpdate::class);

    $handler->handle(telegramUpdate(1, '/start'));
    $handler->handle(telegramUpdate(2, 'our secret launch plan'));
    $handler->handle(['update_id' => 3, 'edited_message' => ['text' => 'x']]);

    expect(telegramReplies())->toHaveCount(1)
        ->and(telegramReplies()[0])->toContain('/connect')
        ->and(TeamIntegration::query()->count())->toBe(0);
    Log::shouldNotHaveReceived('info');
    Log::shouldNotHaveReceived('debug');
    Log::shouldNotHaveReceived('warning');
});

it('follows a group upgraded to a supergroup', function () {
    fakeTelegramBot();
    $integration = TeamIntegration::factory()->telegram()->create(['settings' => ['chatId' => '-4001', 'chatTitle' => 'Team', 'chatType' => 'group']]);

    app(HandleTelegramUpdate::class)->handle(['update_id' => 1, 'message' => [
        'message_id' => 1, 'date' => 1_700_000_000,
        'chat' => ['id' => -4001, 'title' => 'Team', 'type' => 'group'],
        'migrate_to_chat_id' => -1004001,
    ]]);

    expect($integration->fresh()->setting('chatId'))->toBe('-1004001');
});

it('requires a reconnect when the bot leaves or is removed from the chat', function (string $status) {
    fakeTelegramBot();
    $integration = TeamIntegration::factory()->telegram()->create();

    app(HandleTelegramUpdate::class)->handle(['update_id' => 1, 'my_chat_member' => [
        'chat' => ['id' => -100123, 'title' => 'Team chat', 'type' => 'supergroup'],
        'date' => 1_700_000_000,
        'old_chat_member' => ['status' => 'member', 'user' => ['id' => 42, 'is_bot' => true]],
        'new_chat_member' => ['status' => $status, 'user' => ['id' => 42, 'is_bot' => true]],
    ]]);

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->last_error)->toBe('The bot was removed from the Telegram chat.');
})->with(['left', 'kicked']);

it('polls updates and advances the offset', function () {
    fakeTelegramBot([telegramUpdate(7, 'hello'), telegramUpdate(8, 'world')]);

    $this->artisan('skrum:telegram-poll', ['--timeout' => 0])
        ->expectsOutput('Handled 2 Telegram updates.')
        ->assertSuccessful();

    expect(Cache::get(PollTelegramUpdates::OffsetKey))->toBe(9);

    $this->artisan('skrum:telegram-poll', ['--timeout' => 0])->assertSuccessful();

    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/getUpdates') && $request['offset'] === 9);
});

it('warns once per hour when the bot is used elsewhere', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => 409, 'description' => 'Conflict: terminated by other getUpdates request'], 409)]);
    Log::spy();

    $this->artisan('skrum:telegram-poll', ['--timeout' => 0])->assertSuccessful();
    $this->artisan('skrum:telegram-poll', ['--timeout' => 0])->assertSuccessful();

    expect(app(TelegramBot::class)->hasConflict())->toBeTrue();
    Log::shouldHaveReceived('warning')->once();
});

it('does nothing without a bot token', function () {
    disableIntegrations();

    $this->artisan('skrum:telegram-poll')
        ->expectsOutput('Telegram is not configured.')
        ->assertSuccessful();

    Http::assertNothingSent();
});

it('polls every minute without overlapping', function () {
    $event = collect(app(Schedule::class)->events())
        ->first(fn (ScheduledEvent $event) => str_contains((string) $event->command, 'skrum:telegram-poll'));

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('* * * * *')
        ->and($event->withoutOverlapping)->toBeTrue()
        ->and($event->runInBackground)->toBeTrue()
        ->and($event->onOneServer)->toBeTrue();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/TelegramConnectTest.php`
Expected: FAIL — `Route [teams.integrations.telegramCode.store] not defined.`

- [ ] **Step 3: Create the connect codes**

Create `app/Support/Integrations/Telegram/TelegramConnectCodes.php`:

```php
<?php

namespace App\Support\Integrations\Telegram;

use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Single-use codes, stored hashed; issuing a new code for a team
 * invalidates the previous one.
 */
class TelegramConnectCodes
{
    public const Alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    private const Length = 8;

    private const TtlMinutes = 15;

    /**
     * @return array{code: string, expiresAt: CarbonImmutable}
     */
    public function issue(Team $team, User $user): array
    {
        $previous = Cache::get($this->teamKey($team->id));

        if (is_string($previous)) {
            Cache::forget($this->codeKey($previous));
        }

        $code = '';

        for ($index = 0; $index < self::Length; $index++) {
            $code .= self::Alphabet[random_int(0, strlen(self::Alphabet) - 1)];
        }

        $hash = hash('sha256', $code);
        $expiresAt = CarbonImmutable::now()->addMinutes(self::TtlMinutes);

        Cache::put($this->codeKey($hash), ['teamId' => $team->id, 'userId' => $user->id], $expiresAt);
        Cache::put($this->teamKey($team->id), $hash, $expiresAt);

        return ['code' => $code, 'expiresAt' => $expiresAt];
    }

    /**
     * @return array{teamId: string, userId: string}|null
     */
    public function consume(string $code): ?array
    {
        $payload = Cache::pull($this->codeKey(hash('sha256', Str::upper(trim($code)))));

        if (! is_array($payload) || ! is_string($payload['teamId'] ?? null) || ! is_string($payload['userId'] ?? null)) {
            return null;
        }

        Cache::forget($this->teamKey($payload['teamId']));

        return ['teamId' => $payload['teamId'], 'userId' => $payload['userId']];
    }

    private function codeKey(string $hash): string
    {
        return "telegram-connect:{$hash}";
    }

    private function teamKey(string $teamId): string
    {
        return "telegram-connect-team:{$teamId}";
    }
}
```

- [ ] **Step 4: Create the update handler and the poller**

Create `app/Actions/Integrations/HandleTelegramUpdate.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Telegram\TelegramBot;
use App\Support\Integrations\Telegram\TelegramClient;
use App\Support\Integrations\Telegram\TelegramConnectCodes;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Only the commands below are read; other message text is neither stored
 * nor logged.
 */
class HandleTelegramUpdate
{
    private const MaxInvalidAttempts = 5;

    private const LockoutSeconds = 3600;

    private const LeftStatuses = ['left', 'kicked'];

    public function __construct(
        private TelegramClient $telegram,
        private TelegramBot $bot,
        private TelegramConnectCodes $codes,
        private SaveTeamIntegration $saveTeamIntegration,
    ) {}

    /**
     * @param  array<string, mixed>  $update
     */
    public function handle(array $update): void
    {
        if (is_array($update['my_chat_member'] ?? null)) {
            $this->memberChanged($update['my_chat_member']);

            return;
        }

        $message = $update['message'] ?? $update['channel_post'] ?? null;

        if (! is_array($message) || ! is_array($message['chat'] ?? null) || ! isset($message['chat']['id'])) {
            return;
        }

        $chat = $message['chat'];
        $chatId = (string) $chat['id'];

        if (isset($message['migrate_to_chat_id'])) {
            $this->migrate($chatId, (string) $message['migrate_to_chat_id']);

            return;
        }

        $text = trim(is_string($message['text'] ?? null) ? $message['text'] : '');

        if (preg_match('/^\/connect(?:@(\w+))?(?:\s+(\S+))?$/i', $text, $matches) === 1) {
            if ($this->addressedToAnotherBot($matches[1] ?? '')) {
                return;
            }

            $this->connect($chat, $chatId, $matches[2] ?? '');

            return;
        }

        if (preg_match('/^\/(?:start|help)(?:@(\w+))?(?:\s|$)/i', $text, $matches) === 1 && ! $this->addressedToAnotherBot($matches[1] ?? '')) {
            $this->reply($chatId, __('This bot posts retrospective and planning poker links from :app. To connect this chat, create a code on your team\'s integrations page and send /connect with it.', ['app' => config('app.name')]));
        }
    }

    /**
     * @param  array<array-key, mixed>  $chat
     */
    private function connect(array $chat, string $chatId, string $code): void
    {
        $limiterKey = "telegram-connect-attempts:{$chatId}";

        if (RateLimiter::tooManyAttempts($limiterKey, self::MaxInvalidAttempts)) {
            return;
        }

        $payload = $code === '' ? null : $this->codes->consume($code);
        $team = $payload === null ? null : Team::query()->find($payload['teamId']);
        $user = $payload === null ? null : User::query()->find($payload['userId']);

        if ($team === null || $user === null) {
            RateLimiter::hit($limiterKey, self::LockoutSeconds);
            $this->reply($chatId, __('This code is invalid or has expired. Create a new one in skrum.'));

            return;
        }

        $this->saveTeamIntegration->handle($team, IntegrationProvider::Telegram, $user, [
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => [],
            'settings' => [
                'chatId' => $chatId,
                'chatTitle' => $this->chatTitle($chat),
                'chatType' => is_string($chat['type'] ?? null) ? $chat['type'] : 'group',
            ],
            'scopes' => [],
        ]);

        $this->reply($chatId, __('Connected to the :team team on :app.', [
            'team' => $team->name,
            'app' => config('app.name'),
        ], $user->preferredLocale()));
    }

    /**
     * @param  array<array-key, mixed>  $member
     */
    private function memberChanged(array $member): void
    {
        $chatId = data_get($member, 'chat.id');

        if ($chatId === null || ! in_array(data_get($member, 'new_chat_member.status'), self::LeftStatuses, true)) {
            return;
        }

        $this->integrationsForChat((string) $chatId)
            ->each(fn (TeamIntegration $integration) => $integration->markReconnectRequired(__('The bot was removed from the Telegram chat.')));
    }

    private function migrate(string $chatId, string $newChatId): void
    {
        $this->integrationsForChat($chatId)->each(function (TeamIntegration $integration) use ($newChatId): void {
            $integration->forceFill(['settings' => [...$integration->settings, 'chatId' => $newChatId]])->save();
        });
    }

    /**
     * @return Collection<int, TeamIntegration>
     */
    private function integrationsForChat(string $chatId): Collection
    {
        return TeamIntegration::query()
            ->where('provider', IntegrationProvider::Telegram->value)
            ->where('settings->chatId', $chatId)
            ->get();
    }

    private function addressedToAnotherBot(string $username): bool
    {
        if ($username === '') {
            return false;
        }

        $botUsername = $this->bot->username();

        return $botUsername === null || strcasecmp($username, $botUsername) !== 0;
    }

    /**
     * @param  array<array-key, mixed>  $chat
     */
    private function chatTitle(array $chat): string
    {
        if (is_string($chat['title'] ?? null) && $chat['title'] !== '') {
            return $chat['title'];
        }

        $name = trim(((string) ($chat['first_name'] ?? '')).' '.((string) ($chat['last_name'] ?? '')));

        return $name !== '' ? $name : (string) ($chat['username'] ?? __('Private chat'));
    }

    private function reply(string $chatId, string $text): void
    {
        try {
            $this->telegram->sendMessage($chatId, e($text));
        } catch (IntegrationException) {
            // A reply that cannot be delivered changes nothing: the next command gets its own reply.
        }
    }
}
```

Create `app/Actions/Integrations/PollTelegramUpdates.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Support\Integrations\Exceptions\TelegramConflict;
use App\Support\Integrations\Telegram\TelegramBot;
use App\Support\Integrations\Telegram\TelegramClient;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

class PollTelegramUpdates
{
    public const OffsetKey = 'telegram:update-offset';

    private const ConflictWarningKey = 'telegram:conflict-warned';

    public function __construct(
        private TelegramClient $telegram,
        private TelegramBot $bot,
        private HandleTelegramUpdate $handleTelegramUpdate,
    ) {}

    public function handle(int $timeout): int
    {
        try {
            $updates = $this->telegram->getUpdates((int) Cache::get(self::OffsetKey, 0), $timeout);
        } catch (TelegramConflict) {
            $this->bot->markConflict();

            if (Cache::add(self::ConflictWarningKey, true, now()->addHour())) {
                Log::warning('The Telegram bot is used elsewhere: remove its webhook or use a dedicated bot.');
            }

            return 0;
        }

        $this->bot->clearConflict();

        foreach ($updates as $update) {
            try {
                $this->handleTelegramUpdate->handle($update);
            } catch (Throwable $exception) {
                Log::warning('A Telegram update could not be handled.', ['exception' => $exception::class]);
            }

            Cache::forever(self::OffsetKey, (int) ($update['update_id'] ?? 0) + 1);
        }

        return count($updates);
    }
}
```

Create `app/Console/Commands/PollTelegramUpdatesCommand.php`:

```php
<?php

namespace App\Console\Commands;

use App\Actions\Integrations\PollTelegramUpdates;
use App\Enums\IntegrationProvider;
use App\Support\Integrations\Exceptions\IntegrationException;
use Illuminate\Console\Command;

class PollTelegramUpdatesCommand extends Command
{
    protected $signature = 'skrum:telegram-poll {--timeout=50 : Seconds Telegram may hold the request open}';

    protected $description = 'Read the Telegram bot updates (connect codes, removed chats)';

    public function handle(PollTelegramUpdates $pollTelegramUpdates): int
    {
        if (! IntegrationProvider::Telegram->isEnabled()) {
            $this->comment('Telegram is not configured.');

            return self::SUCCESS;
        }

        $this->info('Waiting for Telegram updates…');

        try {
            $handled = $pollTelegramUpdates->handle(max(0, (int) $this->option('timeout')));
        } catch (IntegrationException $exception) {
            $this->warn("Telegram could not be reached: {$exception->getMessage()}");

            return self::SUCCESS;
        }

        $this->comment("Handled {$handled} Telegram updates.");

        return self::SUCCESS;
    }
}
```

In `routes/console.php`, append:

```php
Schedule::command('skrum:telegram-poll')
    ->everyMinute()
    ->withoutOverlapping(5)
    ->runInBackground()
    ->onOneServer();
```

- [ ] **Step 5: Create the code endpoint**

Create `app/Http/Controllers/Integrations/TelegramConnectCodesController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Telegram\TelegramBot;
use App\Support\Integrations\Telegram\TelegramConnectCodes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TelegramConnectCodesController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, TelegramConnectCodes $codes, TelegramBot $bot): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        $username = $bot->username();

        if ($username === null) {
            throw new ProviderUnavailable(IntegrationProvider::Telegram, 'getMe failed');
        }

        $issued = $codes->issue($team, $request->user());

        return response()->json([
            'code' => $issued['code'],
            'command' => "/connect@{$username} {$issued['code']}",
            'botUsername' => $username,
            'expiresAt' => $issued['expiresAt']->toIso8601String(),
        ]);
    }
}
```

In `routes/web.php` import the controller and add inside the `EnsureIntegrationProviderEnabled` group, **before** the `{integration}` routes:

```php
                Route::post('teams/{team}/integrations/telegram/code', [TelegramConnectCodesController::class, 'store'])
                    ->middleware([EnsureIntegrationProviderEnabled::class.':telegram', 'throttle:10,1'])
                    ->name('teams.integrations.telegramCode.store');
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 6: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `Connected to the :team team on :app.` | `Connecté à l'équipe :team sur :app.` | `Conectado al equipo :team en :app.` | `Mit dem Team :team auf :app verbunden.` |
| `This code is invalid or has expired. Create a new one in skrum.` | `Ce code est invalide ou a expiré. Créez-en un nouveau dans skrum.` | `Este código no es válido o ha caducado. Crea uno nuevo en skrum.` | `Dieser Code ist ungültig oder abgelaufen. Erstelle in skrum einen neuen.` |
| `This bot posts retrospective and planning poker links from :app. To connect this chat, create a code on your team's integrations page and send /connect with it.` | `Ce bot publie les liens de rétrospectives et de planning poker de :app. Pour connecter cette discussion, créez un code sur la page des intégrations de votre équipe et envoyez /connect suivi du code.` | `Este bot publica enlaces de retrospectivas y planning poker de :app. Para conectar este chat, crea un código en la página de integraciones de tu equipo y envía /connect con él.` | `Dieser Bot teilt Links zu Retrospektiven und Planning Poker aus :app. Um diesen Chat zu verbinden, erstelle auf der Integrationsseite deines Teams einen Code und sende /connect mit ihm.` |
| `The bot was removed from the Telegram chat.` | `Le bot a été retiré de la discussion Telegram.` | `El bot fue eliminado del chat de Telegram.` | `Der Bot wurde aus dem Telegram-Chat entfernt.` |
| `Private chat` | `Discussion privée` | `Chat privado` | `Privater Chat` |

- [ ] **Step 7: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/TelegramConnectTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 8: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Integrations/Telegram app/Actions/Integrations app/Console/Commands/PollTelegramUpdatesCommand.php app/Http/Controllers/Integrations routes tests/Feature/Integrations/TelegramConnectTest.php lang
git commit -m "feat: connect Telegram chats with single-use codes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 11: Test message, disconnect and daily connection check

**Files:**
- Create: `app/Actions/Integrations/{CheckIntegration,DisconnectIntegration}.php`, `app/Http/Controllers/Integrations/IntegrationTestsController.php`, `app/Console/Commands/CheckIntegrationsCommand.php`
- Modify: `app/Http/Controllers/Integrations/TeamIntegrationsController.php` (`destroy`), `routes/web.php`, `routes/console.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/IntegrationMaintenanceTest.php`

**Interfaces:**
- Consumes: the four clients and `IntegrationTokens` (Tasks 4–5), `TeamIntegration::{ensureActive, markChecked, withReconnectHandling}` (Task 3), `PresentTeamIntegration` (Task 6).
- Produces: `CheckIntegration::handle(TeamIntegration): void` (throws the client exceptions; marks checked on success), `DisconnectIntegration::handle(TeamIntegration): void`; routes `teams.integrations.test.store` (`POST …/integrations/{integration}/test` → 200 presented integration, or the §13 error mapping) and `teams.integrations.destroy` (`DELETE …/integrations/{integration}` → 204); command `skrum:check-integrations` (daily, one server).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/IntegrationMaintenanceTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\IntegrationUserMapping;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram, IntegrationProvider::Jira, IntegrationProvider::Linear);
});

function testIntegration(User $user, TeamIntegration $integration): TestResponse
{
    return test()->actingAs($user)->postJson(route('teams.integrations.test.store', [$integration->team->workspace, $integration->team, $integration]));
}

function disconnectIntegration(User $user, TeamIntegration $integration): TestResponse
{
    return test()->actingAs($user)->deleteJson(route('teams.integrations.destroy', [$integration->team->workspace, $integration->team, $integration]));
}

it('sends a test message to Slack and Telegram', function () {
    Http::fake([
        'hooks.slack.com/*' => Http::response('ok'),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]]),
    ]);
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    $telegram = TeamIntegration::factory()->telegram()->create(['team_id' => $team->id]);

    testIntegration($admin, $slack)->assertOk()->assertJsonPath('status', 'active');
    testIntegration($admin, $telegram)->assertOk();

    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://hooks.slack.com/') && $request['text'] === 'skrum is connected.');
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/sendMessage') && $request['text'] === 'skrum is connected.');
    expect($slack->fresh()->last_checked_at)->not->toBeNull();
});

it('checks Jira and Linear connections', function () {
    Http::fake([
        'api.atlassian.com/oauth/token/accessible-resources' => Http::response([['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme']]),
        'api.linear.app/graphql' => Http::response(['data' => ['viewer' => ['id' => 'u1']]]),
    ]);
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);

    testIntegration($admin, TeamIntegration::factory()->jira()->create(['team_id' => $team->id]))->assertOk();
    testIntegration($admin, TeamIntegration::factory()->linear()->create(['team_id' => $team->id]))->assertOk();
});

it('reports failed tests with the matching status', function () {
    Http::fake([
        'hooks.slack.com/*' => Http::response('no_service', 404),
        'api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => 502, 'description' => 'Bad Gateway'], 502),
    ]);
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    $telegram = TeamIntegration::factory()->telegram()->create(['team_id' => $team->id]);

    testIntegration($admin, $slack)->assertStatus(409)->assertJsonPath('message', 'Reconnect Slack in the team settings.');
    testIntegration($admin, $telegram)->assertStatus(502)->assertJsonPath('message', 'Telegram did not respond. Try again later.');
    testIntegration($admin, $slack->fresh())->assertStatus(409);

    expect($slack->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($telegram->fresh()->status)->toBe(IntegrationStatus::Active);
});

it('refuses tests and disconnections to members', function () {
    $team = Team::factory()->create();
    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    $member = teamMember($team);

    testIntegration($member, $slack)->assertForbidden();
    disconnectIntegration($member, $slack)->assertForbidden();
});

it('answers 404 for a disabled provider', function () {
    $team = Team::factory()->create();
    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);

    testIntegration(integrationAdmin($team), $slack)->assertNotFound();
});

it('revokes access when disconnecting', function (Closure $makeIntegration, Closure $fakes, ?string $revokeUrl) {
    Http::fake($fakes());
    $team = Team::factory()->create();
    $integration = $makeIntegration($team);
    IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id]);

    disconnectIntegration(integrationAdmin($team), $integration)->assertNoContent();

    expect(TeamIntegration::query()->count())->toBe(0)
        ->and(IntegrationUserMapping::query()->count())->toBe(0);

    if ($revokeUrl === null) {
        Http::assertNothingSent();

        return;
    }

    Http::assertSent(fn (Request $request) => str_contains($request->url(), $revokeUrl));
})->with([
    'slack' => [fn (Team $team) => TeamIntegration::factory()->slack()->create(['team_id' => $team->id]), fn () => ['slack.com/api/auth.revoke' => Http::response(['ok' => true])], 'slack.com/api/auth.revoke'],
    'slack revoke failing' => [fn (Team $team) => TeamIntegration::factory()->slack()->create(['team_id' => $team->id]), fn () => ['slack.com/api/auth.revoke' => Http::response('down', 500)], 'slack.com/api/auth.revoke'],
    'telegram' => [fn (Team $team) => TeamIntegration::factory()->telegram()->create(['team_id' => $team->id]), fn () => ['api.telegram.org/*' => Http::response(['ok' => true, 'result' => true])], '/leaveChat'],
    'linear' => [fn (Team $team) => TeamIntegration::factory()->linear()->create(['team_id' => $team->id]), fn () => ['api.linear.app/oauth/revoke' => Http::response('', 200)], 'api.linear.app/oauth/revoke'],
    'jira' => [fn (Team $team) => TeamIntegration::factory()->jira()->create(['team_id' => $team->id]), fn () => [], null],
]);

it('checks every active connection daily', function () {
    Http::fake([
        'slack.com/api/auth.test' => fn (Request $request) => $request->hasHeader('Authorization', 'Bearer xoxp-revoked')
            ? Http::response(['ok' => false, 'error' => 'token_revoked'])
            : Http::response(['ok' => true]),
        'api.atlassian.com/oauth/token/accessible-resources' => Http::response([['id' => 'cloud-2', 'url' => 'https://beta.atlassian.net', 'name' => 'Beta']]),
        'api.linear.app/graphql' => Http::response('down', 503),
    ]);
    $healthy = TeamIntegration::factory()->slack()->create();
    $revoked = TeamIntegration::factory()->slack()->create([
        'credentials' => ['webhook_url' => 'https://hooks.slack.com/services/T000/B000/YYYY', 'access_token' => 'xoxp-revoked'],
    ]);
    $movedSite = TeamIntegration::factory()->jira()->create();
    $unreachable = TeamIntegration::factory()->linear()->create();
    $alreadyBroken = TeamIntegration::factory()->slack()->reconnectRequired()->create();

    $this->artisan('skrum:check-integrations')
        ->expectsOutput('Checked 4 integrations: 1 ok, 2 need reconnecting, 1 unreachable.')
        ->assertSuccessful();

    expect($healthy->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and($healthy->fresh()->last_checked_at)->not->toBeNull()
        ->and($revoked->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($movedSite->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($movedSite->fresh()->last_error)->toBe('This Jira site is no longer accessible.')
        ->and($unreachable->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and($alreadyBroken->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});

it('skips connections of disabled providers', function () {
    disableIntegrations();
    TeamIntegration::factory()->slack()->create();

    $this->artisan('skrum:check-integrations')
        ->expectsOutput('Checked 0 integrations: 0 ok, 0 need reconnecting, 0 unreachable.')
        ->assertSuccessful();

    Http::assertNothingSent();
});

it('runs the connection check daily on one server', function () {
    $event = collect(app(Schedule::class)->events())
        ->first(fn (ScheduledEvent $event) => str_contains((string) $event->command, 'skrum:check-integrations'));

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('0 0 * * *')
        ->and($event->onOneServer)->toBeTrue();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IntegrationMaintenanceTest.php`
Expected: FAIL — `Route [teams.integrations.test.store] not defined.`

- [ ] **Step 3: Create the check and disconnect actions**

Create `app/Actions/Integrations/CheckIntegration.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationTokens;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\Linear\LinearClient;
use App\Support\Integrations\Slack\SlackClient;
use App\Support\Integrations\Telegram\TelegramClient;

class CheckIntegration
{
    public function __construct(
        private SlackClient $slack,
        private TelegramClient $telegram,
        private JiraClient $jira,
        private LinearClient $linear,
        private IntegrationTokens $tokens,
    ) {}

    public function handle(TeamIntegration $integration): void
    {
        $check = match ($integration->provider) {
            IntegrationProvider::Slack => fn () => $this->slack->authTest($integration),
            IntegrationProvider::Telegram => fn () => $this->telegram->getChat($integration),
            IntegrationProvider::Jira => fn () => $this->checkJiraSite($integration),
            IntegrationProvider::Linear => fn () => $this->linear->query($integration, 'query { viewer { id } }'),
        };

        $check();

        $integration->markChecked();
    }

    private function checkJiraSite(TeamIntegration $integration): void
    {
        $integration->withReconnectHandling(function () use ($integration): void {
            $sites = $this->jira->accessibleResources($this->tokens->accessToken($integration));

            if (! in_array($integration->setting('cloudId'), array_column($sites, 'cloudId'), true)) {
                throw new ReconnectRequired(IntegrationProvider::Jira, __('This Jira site is no longer accessible.'));
            }
        });
    }
}
```

Create `app/Actions/Integrations/DisconnectIntegration.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Linear\LinearClient;
use App\Support\Integrations\Slack\SlackClient;
use App\Support\Integrations\Telegram\TelegramClient;

/**
 * Atlassian offers no revocation endpoint: the admin removes the app under
 * "Connected apps" in their Atlassian account (the dialog says so).
 */
class DisconnectIntegration
{
    public function __construct(
        private SlackClient $slack,
        private TelegramClient $telegram,
        private LinearClient $linear,
    ) {}

    public function handle(TeamIntegration $integration): void
    {
        $revoke = match ($integration->provider) {
            IntegrationProvider::Slack => fn () => $this->slack->revoke($integration),
            IntegrationProvider::Telegram => fn () => $this->telegram->leaveChat($integration),
            IntegrationProvider::Linear => fn () => $this->linear->revoke($integration),
            IntegrationProvider::Jira => fn () => null,
        };

        $revoke();

        $integration->delete();
    }
}
```

- [ ] **Step 4: Create the endpoints**

Create `app/Http/Controllers/Integrations/IntegrationTestsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\CheckIntegration;
use App\Actions\Integrations\PresentTeamIntegration;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use App\Support\Integrations\Slack\SlackClient;
use App\Support\Integrations\Telegram\TelegramClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class IntegrationTestsController extends Controller
{
    public function store(
        Workspace $workspace,
        Team $team,
        TeamIntegration $integration,
        SlackClient $slack,
        TelegramClient $telegram,
        CheckIntegration $checkIntegration,
        PresentTeamIntegration $presentTeamIntegration,
    ): JsonResponse {
        Gate::authorize('manageIntegrations', $team);

        $integration->ensureActive();

        $message = __('skrum is connected.');

        $test = match ($integration->provider) {
            IntegrationProvider::Slack => fn () => $slack->postMessage($integration, ['text' => $message]),
            IntegrationProvider::Telegram => fn () => $telegram->sendMessageTo($integration, e($message)),
            IntegrationProvider::Jira, IntegrationProvider::Linear => fn () => $checkIntegration->handle($integration),
        };

        $test();

        if ($integration->provider->isChannel()) {
            $integration->markChecked();
        }

        return response()->json($presentTeamIntegration->handle($integration->refresh()->load('connectedBy')));
    }
}
```

Add to `app/Http/Controllers/Integrations/TeamIntegrationsController.php` (imports `App\Actions\Integrations\DisconnectIntegration` and `Illuminate\Http\Response as EmptyResponse`, since `Inertia\Response` is already imported):

```php
    public function destroy(Workspace $workspace, Team $team, TeamIntegration $integration, DisconnectIntegration $disconnectIntegration): EmptyResponse
    {
        Gate::authorize('manageIntegrations', $team);

        $disconnectIntegration->handle($integration);

        return response()->noContent();
    }
```

Create `app/Console/Commands/CheckIntegrationsCommand.php`:

```php
<?php

namespace App\Console\Commands;

use App\Actions\Integrations\CheckIntegration;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use Illuminate\Console\Command;

class CheckIntegrationsCommand extends Command
{
    protected $signature = 'skrum:check-integrations';

    protected $description = 'Check that every active team integration still has access';

    public function handle(CheckIntegration $checkIntegration): int
    {
        $providers = array_map(fn (IntegrationProvider $provider): string => $provider->value, IntegrationProvider::enabled());
        $counts = ['checked' => 0, 'ok' => 0, 'reconnect' => 0, 'unreachable' => 0];

        TeamIntegration::query()
            ->where('status', IntegrationStatus::Active->value)
            ->whereIn('provider', $providers)
            ->lazyById()
            ->each(function (TeamIntegration $integration) use ($checkIntegration, &$counts): void {
                $this->info("Checking {$integration->provider->label()} integration `{$integration->id}`…");
                $counts['checked']++;

                try {
                    $checkIntegration->handle($integration);
                    $counts['ok']++;
                } catch (ReconnectRequired) {
                    $counts['reconnect']++;
                } catch (IntegrationException) {
                    $counts['unreachable']++;
                }
            });

        $this->comment("Checked {$counts['checked']} integrations: {$counts['ok']} ok, {$counts['reconnect']} need reconnecting, {$counts['unreachable']} unreachable.");

        return self::SUCCESS;
    }
}
```

`CheckIntegration` marks the row "Reconnect required" before `ReconnectRequired` reaches the command (through `withReconnectHandling` in every client), and rate limits, 5xx and network errors (`IntegrationException` subclasses other than `ReconnectRequired`) leave the status unchanged.

In `routes/web.php` import `IntegrationTestsController` and add inside the `EnsureIntegrationProviderEnabled` group:

```php
                Route::delete('teams/{team}/integrations/{integration}', [TeamIntegrationsController::class, 'destroy'])
                    ->whereUuid('integration')
                    ->name('teams.integrations.destroy');
                Route::post('teams/{team}/integrations/{integration}/test', [IntegrationTestsController::class, 'store'])
                    ->whereUuid('integration')
                    ->middleware('throttle:10,1')
                    ->name('teams.integrations.test.store');
```

In `routes/console.php`, append:

```php
Schedule::command('skrum:check-integrations')
    ->daily()
    ->onOneServer();
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 5: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `skrum is connected.` | `skrum est connecté.` | `skrum está conectado.` | `skrum ist verbunden.` |
| `This Jira site is no longer accessible.` | `Ce site Jira n'est plus accessible.` | `Este sitio de Jira ya no es accesible.` | `Diese Jira-Site ist nicht mehr erreichbar.` |

- [ ] **Step 6: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations tests/Feature/TranslationKeysTest.php`
Expected: PASS (the whole integrations folder).

- [ ] **Step 7: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Integrations app/Http/Controllers/Integrations app/Console/Commands/CheckIntegrationsCommand.php routes tests/Feature/Integrations/IntegrationMaintenanceTest.php lang
git commit -m "feat: test, disconnect and check integrations daily

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 12: Integrations page UI

**Files:**
- Create: `resources/js/lib/integrations.ts`, `resources/js/components/integrations/{integration-status-badge,integration-card,integration-details,integration-actions,disconnect-integration-dialog,slack-integration,telegram-integration,jira-integration,linear-integration}.tsx`
- Modify: `resources/js/pages/teams/integrations.tsx` (replace), `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: page props of Task 6; Wayfinder controllers `Integrations/{TeamIntegrationsController, IntegrationAuthorizationsController, TelegramConnectCodesController, JiraFieldDetectionsController, IntegrationTestsController}`; `retroRequest`, `RetroRequestError` (`@/lib/retro/api`); `useClipboard`, `useCountdown`, `formatSeconds`; `usePoll` (`@inertiajs/react`).
- Produces: the components of the Contract ("Frontend"). No frontend test runner exists: the checks are `npm run types:check && npm run check`, the feature tests of Tasks 6–11 (which assert the props these components read) and the manual walkthrough of Task 13.

- [ ] **Step 1: Create the shared helpers and building blocks**

Create `resources/js/lib/integrations.ts`:

```ts
import { RetroRequestError } from '@/lib/retro/api';

export function integrationErrorMessage(
    error: unknown,
    fallback: string,
): string {
    if (error instanceof RetroRequestError && error.status !== 0) {
        return error.message;
    }

    return fallback;
}
```

Create `resources/js/components/integrations/integration-status-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type { TeamIntegration } from '@/types';

type Props = {
    connection: TeamIntegration | null;
};

export function IntegrationStatusBadge({ connection }: Props) {
    const { t } = useTrans();

    if (connection === null) {
        return <Badge variant="outline">{t('Not connected')}</Badge>;
    }

    if (connection.status === 'reconnect_required') {
        return <Badge variant="destructive">{connection.statusLabel}</Badge>;
    }

    return (
        <Badge
            variant={connection.status === 'active' ? 'default' : 'secondary'}
        >
            {connection.statusLabel}
        </Badge>
    );
}
```

Create `resources/js/components/integrations/integration-card.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import type { IntegrationProviderCard } from '@/types';
import { IntegrationStatusBadge } from './integration-status-badge';

type Props = {
    icon: LucideIcon;
    card: IntegrationProviderCard;
    children?: ReactNode;
    actions?: ReactNode;
};

export function IntegrationCard({ icon: Icon, card, children, actions }: Props) {
    const connection = card.connection;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                    <Icon className="size-4" aria-hidden />
                    {card.label}
                </CardTitle>
                <IntegrationStatusBadge connection={connection} />
            </CardHeader>
            <CardContent className="space-y-4">
                {connection?.status === 'reconnect_required' &&
                    connection.lastError !== null && (
                        <p className="text-sm text-destructive">
                            {connection.lastError}
                        </p>
                    )}
                {children}
                {actions && (
                    <div className="flex flex-wrap gap-2">{actions}</div>
                )}
            </CardContent>
        </Card>
    );
}
```

Create `resources/js/components/integrations/integration-details.tsx`:

```tsx
import { usePage } from '@inertiajs/react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type { TeamIntegration } from '@/types';

export type IntegrationDetailRow = {
    label: string;
    value: ReactNode;
};

type Props = {
    rows: IntegrationDetailRow[];
    connection: TeamIntegration;
};

export function IntegrationDetails({ rows, connection }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;

    const formatDate = (value: string | null): string =>
        value === null
            ? t('Never')
            : new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
              }).format(new Date(value));

    const allRows: IntegrationDetailRow[] = [
        ...rows,
        {
            label: t('Connected by'),
            value: connection.connectedBy ?? t('Former member'),
        },
        {
            label: t('Last checked'),
            value: formatDate(connection.lastCheckedAt),
        },
    ];

    return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {allRows.map((row) => (
                <Fragment key={row.label}>
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="min-w-0 break-words">{row.value}</dd>
                </Fragment>
            ))}
        </dl>
    );
}
```

Create `resources/js/components/integrations/integration-actions.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import IntegrationAuthorizationsController from '@/actions/App/Http/Controllers/Integrations/IntegrationAuthorizationsController';
import IntegrationTestsController from '@/actions/App/Http/Controllers/Integrations/IntegrationTestsController';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationAccess,
    IntegrationProviderKey,
    IntegrationScope,
    TeamIntegration,
} from '@/types';

type ConnectLinkProps = {
    scope: IntegrationScope;
    provider: Exclude<IntegrationProviderKey, 'telegram'>;
    label: string;
    access?: IntegrationAccess;
    variant?: 'default' | 'outline';
};

/**
 * A plain link: the server answers with a redirect to the provider's
 * consent screen, which Inertia must not follow as a visit.
 */
export function ConnectLink({
    scope,
    provider,
    label,
    access,
    variant = 'default',
}: ConnectLinkProps) {
    const href = IntegrationAuthorizationsController.create.url(
        { ...scope, provider },
        access ? { query: { access } } : undefined,
    );

    return (
        <Button variant={variant} size="sm" asChild>
            <a href={href}>{label}</a>
        </Button>
    );
}

type TestConnectionButtonProps = {
    scope: IntegrationScope;
    connection: TeamIntegration;
    label: string;
    successMessage: string;
};

export function TestConnectionButton({
    scope,
    connection,
    label,
    successMessage,
}: TestConnectionButtonProps) {
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);

    const run = async () => {
        setBusy(true);

        try {
            await retroRequest(
                IntegrationTestsController.store({
                    ...scope,
                    integration: connection.id,
                }),
            );
            toast.success(successMessage);
        } catch (error) {
            toast.error(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
            router.reload({ only: ['providers'] });
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void run()}
        >
            {busy && <Spinner />}
            {label}
        </Button>
    );
}
```

Create `resources/js/components/integrations/disconnect-integration-dialog.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    TeamIntegration,
} from '@/types';

type Props = {
    scope: IntegrationScope;
    card: IntegrationProviderCard;
    connection: TeamIntegration;
    description: string;
};

export function DisconnectIntegrationDialog({
    scope,
    card,
    connection,
    description,
}: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const disconnect = async () => {
        setBusy(true);

        try {
            await retroRequest(
                TeamIntegrationsController.destroy({
                    ...scope,
                    integration: connection.id,
                }),
            );
            setOpen(false);
            toast.success(
                t(':provider disconnected.', { provider: card.label }),
            );
            router.reload({ only: ['providers'] });
        } catch (error) {
            toast.error(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                    {t('Disconnect')}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>
                    {t('Disconnect :provider?', { provider: card.label })}
                </DialogTitle>
                <DialogDescription>{description}</DialogDescription>
                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button variant="secondary">{t('Cancel')}</Button>
                    </DialogClose>
                    <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void disconnect()}
                    >
                        {busy && <Spinner />}
                        {t('Disconnect')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Create the Slack and Linear cards**

Create `resources/js/components/integrations/slack-integration.tsx`:

```tsx
import { ExternalLink, Hash } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import type { IntegrationProviderCard, IntegrationScope } from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { ConnectLink, TestConnectionButton } from './integration-actions';
import { IntegrationCard } from './integration-card';
import { IntegrationDetails } from './integration-details';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
};

export function SlackIntegration({ card, scope }: Props) {
    const { t } = useTrans();
    const connection = card.connection;

    if (connection === null) {
        return (
            <IntegrationCard
                icon={Hash}
                card={card}
                actions={
                    <ConnectLink
                        scope={scope}
                        provider="slack"
                        label={t('Connect')}
                    />
                }
            >
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Post board links and results to a Slack channel. Slack asks for the channel while connecting; reconnect to change it.',
                    )}
                </p>
            </IntegrationCard>
        );
    }

    const { settings } = connection;

    return (
        <IntegrationCard
            icon={Hash}
            card={card}
            actions={
                <>
                    <ConnectLink
                        scope={scope}
                        provider="slack"
                        label={t('Reconnect')}
                        variant="outline"
                    />
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
                            'Posting to :channel stops and the Slack access is revoked.',
                            { channel: settings.channelName ?? '' },
                        )}
                    />
                </>
            }
        >
            <IntegrationDetails
                connection={connection}
                rows={[
                    { label: t('Slack workspace'), value: settings.teamName },
                    {
                        label: t('Channel'),
                        value: settings.configurationUrl ? (
                            <a
                                href={settings.configurationUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 underline"
                            >
                                {settings.channelName}
                                <ExternalLink
                                    className="size-3"
                                    aria-hidden
                                />
                            </a>
                        ) : (
                            settings.channelName
                        ),
                    },
                ]}
            />
        </IntegrationCard>
    );
}
```

Create `resources/js/components/integrations/linear-integration.tsx`:

```tsx
import { ListTodo } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import type { IntegrationProviderCard, IntegrationScope } from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { ConnectLink, TestConnectionButton } from './integration-actions';
import { IntegrationCard } from './integration-card';
import { IntegrationDetails } from './integration-details';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
};

export function LinearIntegration({ card, scope }: Props) {
    const { t } = useTrans();
    const connection = card.connection;

    if (connection === null) {
        return (
            <IntegrationCard
                icon={ListTodo}
                card={card}
                actions={
                    <>
                        <ConnectLink
                            scope={scope}
                            provider="linear"
                            access="read"
                            label={t('Connect (read only)')}
                            variant="outline"
                        />
                        <ConnectLink
                            scope={scope}
                            provider="linear"
                            access="write"
                            label={t('Connect (read and write)')}
                        />
                    </>
                }
            >
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Import issues into planning poker. With write access, estimates are written back and action items can be exported.',
                    )}
                </p>
            </IntegrationCard>
        );
    }

    return (
        <IntegrationCard
            icon={ListTodo}
            card={card}
            actions={
                <>
                    <ConnectLink
                        scope={scope}
                        provider="linear"
                        access={connection.access}
                        label={t('Reconnect')}
                        variant="outline"
                    />
                    {connection.access === 'read' && (
                        <ConnectLink
                            scope={scope}
                            provider="linear"
                            access="write"
                            label={t('Upgrade to read and write')}
                            variant="outline"
                        />
                    )}
                    {connection.status === 'active' && (
                        <TestConnectionButton
                            scope={scope}
                            connection={connection}
                            label={t('Test the connection')}
                            successMessage={t('The connection works.')}
                        />
                    )}
                    <DisconnectIntegrationDialog
                        scope={scope}
                        card={card}
                        connection={connection}
                        description={t(
                            'Imported tasks and exported issues keep their links but are no longer synced, and the people and priority mappings are deleted. skrum revokes its Linear access.',
                        )}
                    />
                </>
            }
        >
            <IntegrationDetails
                connection={connection}
                rows={[
                    {
                        label: t('Linear workspace'),
                        value: connection.settings.organizationName,
                    },
                    {
                        label: t('Access'),
                        value:
                            connection.access === 'write'
                                ? t('Read and write')
                                : t('Read only'),
                    },
                ]}
            />
        </IntegrationCard>
    );
}
```

- [ ] **Step 3: Create the Jira card**

Create `resources/js/components/integrations/jira-integration.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { ExternalLink, ListChecks, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import JiraFieldDetectionsController from '@/actions/App/Http/Controllers/Integrations/JiraFieldDetectionsController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    TeamIntegration,
} from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { ConnectLink, TestConnectionButton } from './integration-actions';
import { IntegrationCard } from './integration-card';
import { IntegrationDetails } from './integration-details';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
};

export function JiraIntegration({ card, scope }: Props) {
    const { t } = useTrans();
    const connection = card.connection;

    if (connection === null) {
        return (
            <IntegrationCard
                icon={ListChecks}
                card={card}
                actions={
                    <>
                        <ConnectLink
                            scope={scope}
                            provider="jira"
                            access="read"
                            label={t('Connect (read only)')}
                            variant="outline"
                        />
                        <ConnectLink
                            scope={scope}
                            provider="jira"
                            access="write"
                            label={t('Connect (read and write)')}
                        />
                    </>
                }
            >
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Import issues into planning poker. With write access, estimates are written back and action items can be exported.',
                    )}
                </p>
            </IntegrationCard>
        );
    }

    return <ConnectedJira card={card} scope={scope} connection={connection} />;
}

function ConnectedJira({
    card,
    scope,
    connection,
}: Props & { connection: TeamIntegration }) {
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { settings } = connection;
    const sites = settings.sites ?? [];
    const numberFields = settings.numberFields ?? [];
    const storyPointFields = settings.storyPointFields ?? [];
    const target = { ...scope, integration: connection.id };

    const send = async (
        request: Promise<unknown>,
        successMessage: string,
    ) => {
        setBusy(true);

        try {
            await request;
            toast.success(successMessage);
            router.reload({ only: ['providers'] });
        } catch (error) {
            toast.error(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    const chooseSite = (cloudId: string) =>
        void send(
            retroRequest(TeamIntegrationsController.update(target), {
                cloud_id: cloudId,
            }),
            t('Jira connected.'),
        );

    const chooseField = (fieldId: string) =>
        void send(
            retroRequest(TeamIntegrationsController.update(target), {
                story_point_field_id: fieldId,
            }),
            t('Story points field saved.'),
        );

    const detect = () =>
        void send(
            retroRequest(JiraFieldDetectionsController.store(target)),
            t('Fields detected again.'),
        );

    return (
        <IntegrationCard
            icon={ListChecks}
            card={card}
            actions={
                <>
                    <ConnectLink
                        scope={scope}
                        provider="jira"
                        access={connection.access}
                        label={t('Reconnect')}
                        variant="outline"
                    />
                    {connection.access === 'read' && (
                        <ConnectLink
                            scope={scope}
                            provider="jira"
                            access="write"
                            label={t('Upgrade to read and write')}
                            variant="outline"
                        />
                    )}
                    {connection.status === 'active' && (
                        <TestConnectionButton
                            scope={scope}
                            connection={connection}
                            label={t('Test the connection')}
                            successMessage={t('The connection works.')}
                        />
                    )}
                    <DisconnectIntegrationDialog
                        scope={scope}
                        card={card}
                        connection={connection}
                        description={t(
                            'Imported tasks and exported issues keep their links but are no longer synced, and the people and priority mappings are deleted. Atlassian does not let skrum revoke its access: remove the app under "Connected apps" in your Atlassian account settings.',
                        )}
                    />
                </>
            }
        >
            {connection.status === 'setup_required' ? (
                <div className="space-y-2">
                    <p className="text-sm">
                        {t('Choose the Jira site this team uses:')}
                    </p>
                    <Select disabled={busy} onValueChange={chooseSite}>
                        <SelectTrigger
                            className="w-full sm:w-72"
                            aria-label={t('Jira site')}
                        >
                            <SelectValue placeholder={t('Choose a site')} />
                        </SelectTrigger>
                        <SelectContent>
                            {sites.map((site) => (
                                <SelectItem
                                    key={site.cloudId}
                                    value={site.cloudId}
                                >
                                    {site.name} ({site.url})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            ) : (
                <>
                    <IntegrationDetails
                        connection={connection}
                        rows={[
                            {
                                label: t('Jira site'),
                                value: settings.siteUrl ? (
                                    <a
                                        href={settings.siteUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 underline"
                                    >
                                        {settings.siteName}
                                        <ExternalLink
                                            className="size-3"
                                            aria-hidden
                                        />
                                    </a>
                                ) : (
                                    settings.siteName
                                ),
                            },
                            {
                                label: t('Access'),
                                value:
                                    connection.access === 'write'
                                        ? t('Read and write')
                                        : t('Read only'),
                            },
                        ]}
                    />
                    <div className="space-y-2">
                        <p className="text-sm font-medium">
                            {t('Story points field')}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            {numberFields.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {t('No story points field found.')}
                                </p>
                            ) : (
                                <Select
                                    disabled={busy}
                                    value={storyPointFields[0]?.id}
                                    onValueChange={chooseField}
                                >
                                    <SelectTrigger
                                        className="w-full sm:w-72"
                                        aria-label={t('Story points field')}
                                    >
                                        <SelectValue
                                            placeholder={t('Choose a field')}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {numberFields.map((field) => (
                                            <SelectItem
                                                key={field.id}
                                                value={field.id}
                                            >
                                                {field.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            {connection.status === 'active' && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={busy}
                                    onClick={detect}
                                >
                                    <RefreshCw className="size-4" aria-hidden />
                                    {t('Detect again')}
                                </Button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </IntegrationCard>
    );
}
```

- [ ] **Step 4: Create the Telegram card**

Create `resources/js/components/integrations/telegram-integration.tsx`:

```tsx
import { usePoll } from '@inertiajs/react';
import { Copy, ExternalLink, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import TelegramConnectCodesController from '@/actions/App/Http/Controllers/Integrations/TelegramConnectCodesController';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useClipboard } from '@/hooks/use-clipboard';
import { formatSeconds, useCountdown } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    TelegramBotInfo,
    TelegramConnectCode,
} from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { TestConnectionButton } from './integration-actions';
import { IntegrationCard } from './integration-card';
import { IntegrationDetails } from './integration-details';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
    telegram: TelegramBotInfo | null;
};

type PendingCode = {
    code: TelegramConnectCode;
    lastCheckedAt: string | null;
};

export function TelegramIntegration({ card, scope, telegram }: Props) {
    const { t } = useTrans();
    const connection = card.connection;
    const [pending, setPending] = useState<PendingCode | null>(null);
    const [busy, setBusy] = useState(false);
    const [copied, copy] = useClipboard();
    const remaining = useCountdown(pending?.code.expiresAt ?? null, 0);
    const { start, stop } = usePoll(
        5000,
        { only: ['providers'] },
        { autoStart: false },
    );

    const connectedSinceCode =
        pending !== null &&
        connection?.status === 'active' &&
        connection.lastCheckedAt !== pending.lastCheckedAt;
    const expired = pending !== null && remaining === 0;

    useEffect(() => {
        if (connectedSinceCode) {
            stop();
            toast.success(t('Telegram connected.'));
        }
    }, [connectedSinceCode, stop, t]);

    useEffect(() => {
        if (expired) {
            stop();
        }
    }, [expired, stop]);

    const createCode = async () => {
        setBusy(true);

        try {
            const code = await retroRequest<TelegramConnectCode>(
                TelegramConnectCodesController.store(scope),
            );
            setPending({
                code,
                lastCheckedAt: connection?.lastCheckedAt ?? null,
            });
            start();
        } catch (error) {
            toast.error(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    const connectButton = (
        <Button
            size="sm"
            variant={connection === null ? 'default' : 'outline'}
            disabled={busy || telegram?.botUsername === null}
            onClick={() => void createCode()}
        >
            {busy && <Spinner />}
            {connection === null ? t('Connect') : t('Connect another chat')}
        </Button>
    );

    return (
        <IntegrationCard
            icon={Send}
            card={card}
            actions={
                connection === null ? (
                    connectButton
                ) : (
                    <>
                        {connectButton}
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
                                'The bot leaves :chat and nothing is posted there anymore.',
                                { chat: connection.settings.chatTitle ?? '' },
                            )}
                        />
                    </>
                )
            }
        >
            {telegram?.conflict && (
                <p className="text-sm text-destructive">
                    {t(
                        'The Telegram bot is used elsewhere. Remove its webhook or use a dedicated bot.',
                    )}
                </p>
            )}
            {telegram?.botUsername === null && (
                <p className="text-sm text-destructive">
                    {t(
                        'Telegram did not answer. Check the bot token of this instance.',
                    )}
                </p>
            )}
            {connection === null ? (
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Post board links and results to a Telegram group, channel or private chat.',
                    )}
                </p>
            ) : (
                <IntegrationDetails
                    connection={connection}
                    rows={[
                        {
                            label: t('Chat'),
                            value: connection.settings.chatTitle,
                        },
                    ]}
                />
            )}
            {pending !== null && !connectedSinceCode && (
                <div className="space-y-2 rounded-md border p-3 text-sm">
                    <p>
                        {t(
                            'Add the bot to your group or channel (as an administrator for channels) or open a private chat with it, then send this command:',
                        )}
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 rounded bg-muted px-2 py-1 font-mono break-all">
                            {pending.code.command}
                        </code>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void copy(pending.code.command)}
                        >
                            <Copy className="size-4" aria-hidden />
                            {copied === pending.code.command
                                ? t('Copied')
                                : t('Copy')}
                        </Button>
                    </div>
                    <a
                        href={`https://t.me/${pending.code.botUsername}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 underline"
                    >
                        {t('Open @:bot in Telegram', {
                            bot: pending.code.botUsername,
                        })}
                        <ExternalLink className="size-3" aria-hidden />
                    </a>
                    <p className="text-muted-foreground">
                        {expired
                            ? t('This code has expired. Create a new one.')
                            : t('Waiting for the command… (:time left)', {
                                  time: formatSeconds(remaining ?? 0),
                              })}
                    </p>
                </div>
            )}
        </IntegrationCard>
    );
}
```

- [ ] **Step 5: Replace the page**

Replace `resources/js/pages/teams/integrations.tsx` with:

```tsx
import { Head, Link } from '@inertiajs/react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import Heading from '@/components/heading';
import { JiraIntegration } from '@/components/integrations/jira-integration';
import { LinearIntegration } from '@/components/integrations/linear-integration';
import { SlackIntegration } from '@/components/integrations/slack-integration';
import { TelegramIntegration } from '@/components/integrations/telegram-integration';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    TeamSummary,
    TelegramBotInfo,
    WorkspaceSummary,
} from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    providers: IntegrationProviderCard[];
    telegram: TelegramBotInfo | null;
};

export default function TeamIntegrations({
    workspace,
    team,
    providers,
    telegram,
}: Props) {
    const { t } = useTrans();
    const scope: IntegrationScope = {
        workspace: workspace.slug,
        team: team.id,
    };

    return (
        <>
            <Head title={t('Integrations')} />
            <div className="max-w-2xl space-y-6 p-4">
                <Heading
                    title={t('Integrations')}
                    description={t('Connect :team to the tools it already uses.', {
                        team: team.name,
                    })}
                />
                <Button variant="outline" size="sm" asChild>
                    <Link href={TeamsController.show(scope)}>
                        {t('Back to the team')}
                    </Link>
                </Button>
                {providers.map((card) => {
                    switch (card.provider) {
                        case 'slack':
                            return (
                                <SlackIntegration
                                    key={card.provider}
                                    card={card}
                                    scope={scope}
                                />
                            );
                        case 'telegram':
                            return (
                                <TelegramIntegration
                                    key={card.provider}
                                    card={card}
                                    scope={scope}
                                    telegram={telegram}
                                />
                            );
                        case 'jira':
                            return (
                                <JiraIntegration
                                    key={card.provider}
                                    card={card}
                                    scope={scope}
                                />
                            );
                        case 'linear':
                            return (
                                <LinearIntegration
                                    key={card.provider}
                                    card={card}
                                    scope={scope}
                                />
                            );
                        default:
                            return null;
                    }
                })}
            </div>
        </>
    );
}
```

- [ ] **Step 6: Add the translations**

Append to `lang/{en,fr,es,de}.json` (skip keys that already exist — `Never`, `Former member`, `Copy`, `Copied`, `Cancel`, `Back to the team`, `Something went wrong.` do):

| Key (en) | fr | es | de |
|---|---|---|---|
| `Connected by` | `Connecté par` | `Conectado por` | `Verbunden von` |
| `Last checked` | `Dernière vérification` | `Última comprobación` | `Zuletzt geprüft` |
| `Connect` | `Connecter` | `Conectar` | `Verbinden` |
| `Reconnect` | `Reconnecter` | `Volver a conectar` | `Erneut verbinden` |
| `Disconnect` | `Déconnecter` | `Desconectar` | `Trennen` |
| `Disconnect :provider?` | `Déconnecter :provider ?` | `¿Desconectar :provider?` | `:provider trennen?` |
| `:provider disconnected.` | `:provider est déconnecté.` | `:provider desconectado.` | `:provider ist getrennt.` |
| `Send a test message` | `Envoyer un message de test` | `Enviar un mensaje de prueba` | `Testnachricht senden` |
| `Test message sent.` | `Message de test envoyé.` | `Mensaje de prueba enviado.` | `Testnachricht gesendet.` |
| `Test the connection` | `Tester la connexion` | `Probar la conexión` | `Verbindung testen` |
| `The connection works.` | `La connexion fonctionne.` | `La conexión funciona.` | `Die Verbindung funktioniert.` |
| `Post board links and results to a Slack channel. Slack asks for the channel while connecting; reconnect to change it.` | `Publiez les liens des tableaux et les résultats dans un canal Slack. Slack demande le canal pendant la connexion ; reconnectez-vous pour le changer.` | `Publica enlaces de tableros y resultados en un canal de Slack. Slack pide el canal al conectar; vuelve a conectar para cambiarlo.` | `Teile Board-Links und Ergebnisse in einem Slack-Kanal. Slack fragt beim Verbinden nach dem Kanal; verbinde erneut, um ihn zu ändern.` |
| `Posting to :channel stops and the Slack access is revoked.` | `Les publications dans :channel s'arrêtent et l'accès à Slack est révoqué.` | `Se dejará de publicar en :channel y se revocará el acceso a Slack.` | `Es wird nicht mehr in :channel gepostet und der Slack-Zugriff wird widerrufen.` |
| `Slack workspace` | `Espace de travail Slack` | `Espacio de trabajo de Slack` | `Slack-Workspace` |
| `Channel` | `Canal` | `Canal` | `Kanal` |
| `Connect (read only)` | `Connecter (lecture seule)` | `Conectar (solo lectura)` | `Verbinden (nur lesen)` |
| `Connect (read and write)` | `Connecter (lecture et écriture)` | `Conectar (lectura y escritura)` | `Verbinden (lesen und schreiben)` |
| `Import issues into planning poker. With write access, estimates are written back and action items can be exported.` | `Importez des tickets dans le planning poker. Avec l'accès en écriture, les estimations sont renvoyées et les actions peuvent être exportées.` | `Importa incidencias al planning poker. Con acceso de escritura, las estimaciones se devuelven y las acciones se pueden exportar.` | `Importiere Issues ins Planning Poker. Mit Schreibzugriff werden Schätzungen zurückgeschrieben und Aktionen können exportiert werden.` |
| `Upgrade to read and write` | `Passer en lecture et écriture` | `Ampliar a lectura y escritura` | `Auf Lesen und Schreiben erweitern` |
| `Imported tasks and exported issues keep their links but are no longer synced, and the people and priority mappings are deleted. skrum revokes its Linear access.` | `Les tâches importées et les tickets exportés gardent leurs liens mais ne sont plus synchronisés, et les correspondances de personnes et de priorités sont supprimées. skrum révoque son accès à Linear.` | `Las tareas importadas y las incidencias exportadas conservan sus enlaces pero dejan de sincronizarse, y se eliminan las correspondencias de personas y prioridades. skrum revoca su acceso a Linear.` | `Importierte Aufgaben und exportierte Issues behalten ihre Links, werden aber nicht mehr synchronisiert, und die Personen- und Prioritätszuordnungen werden gelöscht. skrum widerruft seinen Linear-Zugriff.` |
| `Imported tasks and exported issues keep their links but are no longer synced, and the people and priority mappings are deleted. Atlassian does not let skrum revoke its access: remove the app under "Connected apps" in your Atlassian account settings.` | `Les tâches importées et les tickets exportés gardent leurs liens mais ne sont plus synchronisés, et les correspondances de personnes et de priorités sont supprimées. Atlassian ne permet pas à skrum de révoquer son accès : retirez l'application sous « Applications connectées » dans les paramètres de votre compte Atlassian.` | `Las tareas importadas y las incidencias exportadas conservan sus enlaces pero dejan de sincronizarse, y se eliminan las correspondencias de personas y prioridades. Atlassian no permite que skrum revoque su acceso: quita la aplicación en «Aplicaciones conectadas» en los ajustes de tu cuenta de Atlassian.` | `Importierte Aufgaben und exportierte Issues behalten ihre Links, werden aber nicht mehr synchronisiert, und die Personen- und Prioritätszuordnungen werden gelöscht. Atlassian erlaubt skrum nicht, den Zugriff zu widerrufen: Entferne die App unter „Verbundene Apps“ in deinen Atlassian-Kontoeinstellungen.` |
| `Linear workspace` | `Espace de travail Linear` | `Espacio de trabajo de Linear` | `Linear-Workspace` |
| `Access` | `Accès` | `Acceso` | `Zugriff` |
| `Read and write` | `Lecture et écriture` | `Lectura y escritura` | `Lesen und schreiben` |
| `Read only` | `Lecture seule` | `Solo lectura` | `Nur lesen` |
| `Jira connected.` | `Jira est connecté.` | `Jira conectado.` | `Jira ist verbunden.` |
| `Story points field saved.` | `Champ de story points enregistré.` | `Campo de story points guardado.` | `Story-Points-Feld gespeichert.` |
| `Fields detected again.` | `Champs détectés à nouveau.` | `Campos detectados de nuevo.` | `Felder erneut erkannt.` |
| `Choose the Jira site this team uses:` | `Choisissez le site Jira utilisé par cette équipe :` | `Elige el sitio de Jira que usa este equipo:` | `Wähle die Jira-Site, die dieses Team nutzt:` |
| `Jira site` | `Site Jira` | `Sitio de Jira` | `Jira-Site` |
| `Choose a site` | `Choisir un site` | `Elige un sitio` | `Site wählen` |
| `Story points field` | `Champ de story points` | `Campo de story points` | `Story-Points-Feld` |
| `No story points field found.` | `Aucun champ de story points trouvé.` | `No se encontró ningún campo de story points.` | `Kein Story-Points-Feld gefunden.` |
| `Choose a field` | `Choisir un champ` | `Elige un campo` | `Feld wählen` |
| `Detect again` | `Détecter à nouveau` | `Detectar de nuevo` | `Erneut erkennen` |
| `Telegram connected.` | `Telegram est connecté.` | `Telegram conectado.` | `Telegram ist verbunden.` |
| `Connect another chat` | `Connecter une autre discussion` | `Conectar otro chat` | `Anderen Chat verbinden` |
| `The bot leaves :chat and nothing is posted there anymore.` | `Le bot quitte :chat et plus rien n'y est publié.` | `El bot sale de :chat y ya no se publica nada allí.` | `Der Bot verlässt :chat und dort wird nichts mehr gepostet.` |
| `Telegram did not answer. Check the bot token of this instance.` | `Telegram n'a pas répondu. Vérifiez le jeton du bot de cette instance.` | `Telegram no respondió. Revisa el token del bot de esta instancia.` | `Telegram hat nicht geantwortet. Prüfe das Bot-Token dieser Instanz.` |
| `Post board links and results to a Telegram group, channel or private chat.` | `Publiez les liens des tableaux et les résultats dans un groupe, un canal ou une discussion privée Telegram.` | `Publica enlaces de tableros y resultados en un grupo, canal o chat privado de Telegram.` | `Teile Board-Links und Ergebnisse in einer Telegram-Gruppe, einem Kanal oder einem privaten Chat.` |
| `Chat` | `Discussion` | `Chat` | `Chat` |
| `Add the bot to your group or channel (as an administrator for channels) or open a private chat with it, then send this command:` | `Ajoutez le bot à votre groupe ou canal (en tant qu'administrateur pour les canaux) ou ouvrez une discussion privée avec lui, puis envoyez cette commande :` | `Añade el bot a tu grupo o canal (como administrador en los canales) o abre un chat privado con él y envía este comando:` | `Füge den Bot deiner Gruppe oder deinem Kanal hinzu (bei Kanälen als Administrator) oder öffne einen privaten Chat mit ihm und sende dann diesen Befehl:` |
| `Open @:bot in Telegram` | `Ouvrir @:bot dans Telegram` | `Abrir @:bot en Telegram` | `@:bot in Telegram öffnen` |
| `This code has expired. Create a new one.` | `Ce code a expiré. Créez-en un nouveau.` | `Este código ha caducado. Crea uno nuevo.` | `Dieser Code ist abgelaufen. Erstelle einen neuen.` |
| `Waiting for the command… (:time left)` | `En attente de la commande… (:time restantes)` | `Esperando el comando… (quedan :time)` | `Warte auf den Befehl … (noch :time)` |

- [ ] **Step 7: Run the checks**

Run:
```bash
vendor/bin/sail artisan wayfinder:generate --with-form
npx vp check --fix resources/js/lib/integrations.ts resources/js/components/integrations resources/js/pages/teams/integrations.tsx
npm run types:check && npm run check
vendor/bin/sail artisan test --compact tests/Feature/Integrations tests/Feature/TranslationKeysTest.php
```
Expected: no type or lint error; all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add resources/js/lib/integrations.ts resources/js/components/integrations resources/js/pages/teams/integrations.tsx lang
git commit -m "feat: build the team integrations page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 13: Verification

**Files:** none new (fixes only where a check fails).

- [ ] **Step 1: Full backend checks**

Run:
```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
vendor/bin/sail artisan test --compact tests/Feature/Integrations tests/Feature/Teams tests/Feature/TranslationKeysTest.php tests/Feature/UuidPrimaryKeysTest.php tests/Feature/Poker tests/Feature/Retros
```
Expected: 0 phpstan errors; all PASS. Then ask the user to run the complete suite with `vendor/bin/sail artisan test --compact`.

- [ ] **Step 2: Frontend checks**

Run: `npm run types:check && npm run check && npm run build`
Expected: no new error (known pre-existing lint failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`).

- [ ] **Step 3: Invariant sweep**

Run and inspect each result; every hit must be justified or fixed:
```bash
grep -rn "credentials" app/Http app/Actions/Integrations/PresentTeamIntegration.php resources/js
grep -rn "Log::" app/Actions/Integrations app/Support/Integrations app/Console/Commands/PollTelegramUpdatesCommand.php
grep -rn "Http::" app --include=*.php | grep -v "app/Support/Integrations/ProviderHttp.php\|app/Support/Gifs\|app/Support/Llm"
```
Expected: no presenter/controller/page reads `credentials`; no log line contains a message text, token or URL (only the Telegram conflict warning and the update failure class name); every integration HTTP call goes through `ProviderHttp`.

- [ ] **Step 4: Spec criteria walk (§16 of the spec, the parts this plan owns)**

For each, point to the passing test:
1. Criterion 1 — `IntegrationProviderTest` ("enables a provider only when…"), `IntegrationsPageTest` ("does not exist while no provider is configured", "offers the integrations link…"), `IntegrationMaintenanceTest` ("answers 404 for a disabled provider").
2. Criterion 2 — `IntegrationsPageTest` ("is reserved to workspace owners and admins", credentials absent), `IntegrationModelsTest` ("encrypts credentials…", "keeps one connection per provider and team"), `IntegrationMaintenanceTest` ("refuses tests and disconnections to members").
3. Criterion 3 — `ConnectSlackTest`, `TelegramConnectTest`, `ConnectJiraTest` ("asks for read or read-and-write access", "upgrades read access…"), `ConnectLinearTest`.
4. Criterion 4 — `SlackClientTest` ("requires a reconnect when the channel is gone"), `TelegramConnectTest` ("requires a reconnect when the bot leaves…"), `IntegrationTokensTest` ("requires a reconnect when the refresh token is refused"), `IntegrationMaintenanceTest` ("checks every active connection daily").
5. Criteria 10 and 12 (connection parts) — all provider calls in `app/Support/Integrations` (sweep of Step 3), translations green, no new dependency (`git diff main -- composer.json package.json` is empty).

- [ ] **Step 5: Manual walkthrough (with the user)**

With real developer apps configured in `.env` (Slack app with an HTTPS tunnel URL, a Telegram bot, an Atlassian 3LO app, a Linear OAuth app) and `vendor/bin/sail artisan schedule:work` running:
1. As a workspace Admin open a team → "Integrations"; only configured providers appear.
2. Connect Slack, pick a channel on Slack's screen, "Send a test message" → "skrum is connected." arrives in the channel.
3. Telegram: "Connect", add the bot to a group, send the shown `/connect@bot CODE` → the page switches to "Connected" within seconds; "Send a test message" arrives.
4. Jira: "Connect (read only)" → site and story points field shown; "Upgrade to read and write"; change the story points field; "Detect again".
5. Linear: connect read and write; "Test the connection".
6. Revoke Skrum from Slack's app management page, run `vendor/bin/sail artisan skrum:check-integrations` → the Slack card shows "Reconnect required" with the error.
7. Disconnect every provider; the Telegram bot leaves the group.

- [ ] **Step 6: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "fix: address plan 12a verification findings

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```
