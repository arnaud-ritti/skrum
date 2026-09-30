# Plan 14b — Integrations extended: generic outgoing webhooks and automatic events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Workspace Owners/Admins connect a team to their own HTTPS endpoint (a "generic webhook"). skrum refuses private or invalid addresses on save and on every send, pins the vetted address and signs each request with an HMAC secret that is shown once and can be rotated. Owners/Admins can test, re-enable and disconnect the webhook. Sharers post board links, poker links, game room invites and results recaps to it as structured JSON. Owners/Admins subscribe it to five automatic events: `retro.completed`, `action_item.created`, `action_item.completed`, `action_item.reopened` and `poker.task.estimated`. skrum sends these with the catalogue's payloads and redaction, retries failed sends with backoff, logs every delivery, disables the webhook after 10 consecutive failures and shows all of this on the webhook's card.

**Architecture:**
- **Release.** `IntegrationProvider::Webhook` leaves the `Unreleased` list, so `OUTGOING_WEBHOOKS_ENABLED=true` turns it on.
- **URL safety.** `Webhook\SafeWebhookUrl` checks the URL's shape (scheme, port, user info) and resolves its host through 14a's `HostResolver`. Every address must pass `PublicAddress::isPublic()` unless the instance allows private networks. It returns a `WebhookTarget` with the vetted address. `App\Rules\OutgoingWebhookUrl` wraps it for validation.
- **Signed client.** `Webhook\WebhookClient` builds the versioned envelope from a `WebhookMessage` and signs `"{timestamp}.{body}"` with the stored secret. It posts through `ProviderHttp::request(10)` pinned with `CURLOPT_RESOLVE`, without following redirects, and reads only the status code. It records each attempt on the delivery row and maps 410 / 429 / 5xx / other codes to the spec 6 exception hierarchy.
- **Health.** `Webhook\WebhookHealth` resets `consecutive_failures` on a 2xx. It counts final failures and disables the webhook (`ReconnectRequired`, `settings.disabledReason`) at 10 failures with no success in 24 h.
- **Connections.** `ConnectOutgoingWebhook` creates (a new secret, no subscriptions), updates (label, URL, `events`, `enabled`) and rotates secrets. It is wired through 14a's `IntegrationUrlsController`, `UpdateTeamIntegration`, `IntegrationTestsController` and `CheckIntegration`, plus two small controllers for the secret and the delivery log.
- **Manual shares.** `ShareContent::toWebhook()` returns the `data` object that `BuildLinkShare` / `BuildRetroRecap::content()` fill. `QueueShare` dispatches `DeliverToWebhook`, a `DeliverToChannel` subclass that uses two new protected hooks.
- **Automatic events.** The listener `QueueWebhookEvents` reacts to the existing after-commit events `RetroCompleted`, `ActionItemCreated`, `ActionItemCompleted`, `ActionItemReopened` and `PokerTaskEstimated`. `ActionItemCompleted` / `ActionItemReopened` gain the acting `actor`. When the team's active webhook is subscribed, the listener builds the payload at event time (`BuildWebhookEventData`), logs a `kind = event` delivery and dispatches `DeliverWebhookEvent`: 7 tries, backoff 30 s → 2 h.
- **Frontend.** The frontend adds a `WebhookIntegration` card with a secret dialog, a rotate-secret confirmation, the "Send automatically" panel and a paginated deliveries table. Share menus need nothing: 14a already lists `webhook` wherever it is available.

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL, Pest, Laravel HTTP client (`Http::`), Inertia v3 + React 19, Wayfinder, Tailwind 4, lucide (all installed).

**Spec:** `docs/superpowers/specs/2026-09-30-integrations-extended-design.md`. Sections covered:
- §2.1 (`OUTGOING_WEBHOOKS_*`)
- §3 (`settings` of the generic webhook, and the `integration_deliveries` / `team_integrations` columns already created by 14a)
- §4.5, §4.6 for `webhook`, §4.7
- §6 (rows for the generic webhook, rotate the secret, choose events / re-enable / view the log, share to the generic webhook, "Trigger automatic webhook events")
- §7:
  - rows `POST {…|webhook}`, `PATCH {integration}` (`url`, `channelLabel`, `events`, `enabled`), `GET {integration}/deliveries`, `POST {integration}/secret`, and share endpoints with `webhook`
  - "Payload and snapshot additions": the `webhook` share boolean and the generic webhook page props
  - the plain events of `RetroCompleted`, `ActionItemCreated`, `ActionItemReopened`, `PokerTaskEstimated`
- §8.1 rows "Teams / Mattermost / generic webhook …" (generic part) and "Generic webhook automatic events", §8.3 invariants
- §9 Generic webhook card and "Send to webhook"
- §10 rows `DeliverToWebhook`, `QueueWebhookEvents`, `DeliverWebhookEvent`
- §11 invalid webhook URL and "Generic webhook events"
- §13 bullets "Game room invites" (webhook), "Teams / Mattermost / generic webhook" (generic part), "Generic webhook events", "Secrets", "Translations"
- §14 criteria 1 (webhook availability), 3 (webhook part), 4, 9 and 10

**Earlier and later plans:** Plan 14a (foundation, Teams, Mattermost) comes first. Plan **14c** covers Jira Data Center, GitHub and MCP; Plan **14d** covers two-way status sync. Parent spec: `docs/superpowers/specs/2026-09-29-integrations-design.md` (spec 6).

## Global Constraints

**Branch and environment**
- Continue on branch `feat/plan-14-integrations-extended` after Plan 14a's last commit. Plans 14c and 14d follow on the same branch.
- Shells: prefix commands with `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH";`.
- Run commands through Sail:
  - `vendor/bin/sail artisan …`
  - `vendor/bin/sail bin pint --dirty --format agent`
  - `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors)
- Run npm on the host.

**Database and dependencies**
- Tests run on PostgreSQL (the Sail `testing` database).
- **This plan adds no migration.** Every column it writes was created by 14a Task 3: `team_integrations.consecutive_failures` / `last_delivery_succeeded_at`, and `integration_deliveries.team_integration_id` / `event` / `attempts` / `response_status` / `last_attempt_at`. A later need for a migration uses the prefix `2026_10_07_1001xx`, `up()` only.
- **No new Composer or npm dependency.**
- Every webhook call goes through `ProviderHttp::request()`, `->withoutRedirecting()`, with a 10 s timeout, pinned with `CURLOPT_RESOLVE` (spec §4.5).
- Every integration test file starts with `Http::preventStrayRequests()` in `beforeEach` and fakes each call explicitly. Tests fake DNS with `outgoingWebhookResolves()` (Task 1) or a `HostResolver` mock; real DNS is never queried.

**Secrets**
- The webhook URL may embed a key, and the signing secret is a credential. Both live only in `credentials` (`url`, `webhookSecret`; encrypted, hidden) and are read through `TeamIntegration::credential()` inside `WebhookClient` at send time.
- The secret appears in exactly two responses: `POST …/integrations/webhook` (connect) and `POST …/{integration}/secret` (rotate).
- Neither the URL nor the secret ever reaches presenters, page props, other JSON responses, job payloads, logs, `last_error` or delivery errors. Errors keep the host only ("Could not reach :host.").
- Job payloads carry the delivery id, the event name, the occurrence time, the pre-built `data` and the locale. Jobs are `ShouldBeEncrypted`.

**Request handling**
- **Authorize before validating:** every new or changed endpoint calls `Gate::authorize()` / `SharePermissions::ensure…()` / `GameRoomShares::ensure()` first, so guests and non-managers get 403 whatever the body. Only then comes provider or kind 404, then validation 422, then not connected / disabled 409.
- **Request fields are snake_case** (`url`, `channel_label`, `events`, `enabled`, `channel`, `include_guest_link`). Responses, page props and webhook bodies are camelCase.
- Throttles always use a named key. New ones: `throttle:10,1,webhookSecrets` and `throttle:60,1,webhookDeliveries`. `integrationUrls`, `shares` and the unnamed test throttle are unchanged.
- JSON tests that send guest cookies chain `->withCredentials()`.

**Jobs**
- Jobs never share state between attempts. A delivery row's status guards against a second run: `pendingDelivery()` only picks `queued` rows.
- No `ShouldBeUnique` is needed, because each job owns one delivery row. `WebhookHealth::failed()` locks the integration row (`lockForUpdate`) so parallel failures count once each.

**Naming, translations and tooling**
- Route names follow `routes/web.php` (dotted, camelCase segments). New routes: `teams.integrations.secret.store` and `teams.integrations.deliveries.index`.
- Every user-facing string goes through `t()` / `__()` with real translations in `lang/{en,fr,es,de}.json`:
  - German uses "du", French uses "vous", Spanish uses "tú".
  - Append new keys at the end of each file, before the closing `}`, and keep every existing value.
  - Each task lists its own rows; add only keys that are missing at execution time.
  - "Webhook" is translated (14a added it). Event names (`retro.completed` …) and JSON field names are never translated.
  - `tests/Feature/TranslationKeysTest.php` stays green.
- Wayfinder: run `vendor/bin/sail artisan wayfinder:generate --with-form` after every route change. `resources/js/actions` and `resources/js/routes` are gitignored; never stage them.
- Frontend checks: run `npm run types:check && npm run check`. Known pre-existing failures are only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`. Format only the files you touched, with `npx vp check --fix <paths>`.
- React:
  - function components with `type Props`, and no default exports except pages;
  - Tailwind and lucide icons;
  - `retroRequest()` from `@/lib/retro/api` for JSON calls, `toast` from `sonner`, and generated Wayfinder controllers (no hard-coded URLs);
  - every busy flag resets in `finally`.
- PHP:
  - constructor promotion and typed everything;
  - array-shape docblocks on presenter and payload return values;
  - early returns, curly braces, class constants in PascalCase;
  - no comments restating code.
- Pest helper functions are global. Every new helper name below was checked and is unique in `tests/` and in Plans 14a/14c: `outgoingWebhookResolves`, `outgoingWebhookSignatureIsValid`, `runOutgoingWebhookJob`, `outgoingWebhookDelivery`, `outgoingWebhookMessage`, `outgoingWebhookAdmin`, `webhookSharingRetro`, `webhookSharingRoom`, `subscribedWebhook`, `pushedWebhookEvents`, `webhookEventRetro`, `webhookEstimateTable`, `webhookTopCard`.

**Commits**
- Stage explicit paths only. Never run `git add -A` / `git add .`.
- Never stage `.junie/mcp/mcp.json`, `resources/js/actions`, `resources/js/routes` or anything under `.superpowers/`. Do not push.
- Commit messages use Conventional Commits and end with the attribution of the model that actually writes the commit, then the session line:
  `Co-Authored-By: <model name> <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Spec amendments made with this plan

Writing this plan found these gaps. Task 7 updates the spec to match, in §3, §4.5, §4.7, §7, §10 and §11:

1. **Request fields are snake_case.** `POST webhook` takes `url` and `channel_label`. `PATCH {integration}` takes `url`, `channel_label`, `events` (array of catalogue names, duplicates → 422) and `enabled` (`accepted`). This follows 14a amendment 1.
2. **Webhook settings.** They are `{host, channelLabel, secretCreatedAt, events, disabledReason?}`; §3 omitted `channelLabel`, which the card and `POST {…|webhook}` already use.
   - `POST` on a team that already has a webhook replaces it with a new secret, no subscriptions and a zeroed counter.
   - `PATCH url` keeps the secret and subscriptions. It re-activates a disabled webhook with the counter at 0, because a new receiver is a reconnect.
3. **Test request.** Test sends `event = "webhook.test"`, `data = {message: "skrum is connected."}` and a random `id`, signed like every request.
   - It is not logged as a delivery and does not touch the failure counter.
   - It is allowed while the webhook is disabled, and a success there does not re-enable it; Re-enable does.
4. **Actor on status events.** `ActionItemCompleted` and `ActionItemReopened` carry the acting `actor` (`ActionItemActor|ExternalSyncActor|null`), which is how `completedBy` and `completedVia` are built.
   - On `action_item.reopened` the item is open, so `completedBy` is null. `completedVia` names the source when the reopen came from sync.
   - §4.7 said "same as completed" and named no actor.
5. **Page props naming** (§7 "Payload and snapshot additions"):
   - `events` and `disabledReason` are `connection.settings.events` and `connection.settings.disabledReason`, next to `secretCreatedAt`.
   - `consecutiveFailures` and `lastDeliverySucceededAt` are `connection.webhook.{consecutiveFailures, lastDeliverySucceededAt}`; `connection.webhook` is null for every other provider.
   - `availableEvents` is the page prop `webhookEvents: [{name, description}]`, null while webhooks are disabled.
6. **Delivery log shape.**
   - `GET {integration}/deliveries` answers `{data: [{id, event, kind, status, attempts, responseStatus, error, createdAt, lastAttemptAt}], currentPage, lastPage, total}`, newest first, 25 per page.
   - It lists the team's `webhook` channel rows, so the history survives a reconnect.
   - Manual shares to the webhook store their `event` too (`retro.link`, `poker.link`, `retro.results`, `game_room.link`).
   - Every share delivery (all channels) now records `team_integration_id`.
7. **Counting failures.**
   - A delivery counts toward the 10 only when it ended `failed` while the webhook was `Active`. "Webhook disabled." and a removed connection do not count.
   - Disabling sets `last_error` "Disabled after 10 failed deliveries in a row.". A 410 sets "The receiver asked skrum to stop.". The card shows either one.
8. **Error texts.**
   - One save-time message, "This URL points to a private or invalid address.", covers every refused URL: scheme, port, user info, unresolvable host, private address.
   - Connection errors read "Could not reach :host.". Other non-2xx answers read "The receiver answered :status." (the body is discarded). The 429 retry wait is capped at 3600 s.
9. **Webhook body formats.** Timestamps (`occurredAt`, `sentAt`, `completedAt`, `createdAt`, `estimatedAt`) are ISO 8601 UTC with `Z`; `dueOn` is `YYYY-MM-DD`; `priority` is `high|medium|low`.
   - Recap `actionItems[]` entries also carry `isCompleted` (the chat recap shows ✓; without it the list is ambiguous).
   - `participants.names` are the recap's names, with guests suffixed "(guest)" in the delivery locale.
   - `actionItem.assignee.name` is the assignee's display name, members and guests alike (spec 3 decision 5).
   - `task.url` is the game URL, and `task.deckName` is the custom deck name or the deck label.
10. **Locale of automatic events.** A `retro.completed` recap is built in the locale of the request that completed the retro, and each event job keeps that locale for its error texts.
11. **Daily check.** `skrum:check-integrations` re-validates the stored webhook URL's shape (scheme, port, user info) against the current env, without DNS and without posting. A URL that no longer passes becomes `ReconnectRequired` with "This webhook URL is no longer allowed. Paste a new one.". This is the webhook counterpart of 14a amendment 6.

## Review Focus

1. **SSRF.**
   - Every resolved address must be public: loopback, RFC 1918, link-local incl. `169.254.169.254`, CGNAT, `0.0.0.0/8`, ULA, `fe80::/10`, multicast and reserved addresses are refused, even when only one of several A/AAAA records is private.
   - The connection is pinned to the vetted address, and redirects are never followed.
   - The same check runs on save and on every send; a failing URL at send time means no request, failed, no retry.
   - The flags `OUTGOING_WEBHOOKS_ALLOW_PRIVATE_NETWORKS` / `_ALLOW_HTTP` are the only bypasses.
   - Pinned in Task 1 ("refuses private, reserved and invalid endpoints", "refuses IP literals without resolving them") and Task 2 ("pins the connection to the vetted address and never follows redirects", "refuses an endpoint that became private without calling it").
2. **Secrets never serialized.** The URL and secret stay out of page props, PATCH/test/log responses, job payloads and errors. The secret appears only in the connect and rotate responses, and rotation invalidates the old secret at once.
   - Pinned in Task 3 ("connects a webhook and shows its signing secret once", "never serializes the URL or the secret on the integrations page", "rotates the signing secret") and Task 4 ("keeps the URL and the secret out of the job payload").
3. **Event redaction.**
   - Card content appears only in `retro.completed`, and only through the recap rules: no card authors, and `participants.names` null on anonymous retros.
   - Action items are always named. Guest actors give `createdBy` / `completedBy` null.
   - Poker events carry the final estimate only: no votes, players or rounds. No emails or comments are sent anywhere.
   - Pinned in Task 5 ("sends action_item.created while the retro is still in Writing", "hides guest actors but still sends their events", "sends retro.completed on each completion with the recap rules", "sends poker.task.estimated when a card is set or changed, never on clear").
4. **Retry, disable and re-enable semantics.**
   - `X-Skrum-Delivery` stays the same across retries while the timestamp and signature change.
   - 5xx, 429 and timeouts retry; other 4xx and redirects fail at once; 410 disables at once.
   - The webhook disables at 10 failures with no success in 24 h; 9 failures or a recent success keep it active; a 2xx resets the counter.
   - While disabled, events are neither queued nor logged, and queued deliveries fail "Webhook disabled." without counting.
   - Pinned in Tasks 2, 4 and 5.
5. **Order of checks and codes.**
   - 403 for guests and non-managers comes before validation.
   - 404 while webhooks are disabled, or for a non-webhook integration on `secret` / `deliveries`.
   - 422 for private URLs, unknown event names and the guest link on a team room.
   - 409 when not connected or disabled. Nothing is queued on refusal.
   - Pinned in Task 3 ("is reserved to workspace owners and admins, before validation") and Task 4 ("answers 404, 409 and 422 for webhook room invites", "refuses guests and non-managers before validating").

## File map

Execution order on the branch: **14a → 14b → 14c → 14d**. Files marked ◆ are also edited by 14a, 14c or 14d. Edit them by the anchors given (never by line numbers) and keep what the other plans added.

| Area | Files |
|---|---|
| Availability & tests setup | ◆ `app/Enums/IntegrationProvider.php` (`Unreleased`); ◆ `database/factories/TeamIntegrationFactory.php` (`webhook()`); ◆ `tests/Pest.php`; ◆ `tests/Feature/Integrations/IntegrationsExtendedAvailabilityTest.php` |
| URL safety & client | `app/Support/Integrations/Webhook/{SafeWebhookUrl,WebhookTarget,WebhookMessage,WebhookClient,WebhookHealth}.php`; `app/Support/Integrations/Exceptions/{UnsafeWebhookUrl,WebhookGone,WebhookDisabled}.php`; `app/Rules/OutgoingWebhookUrl.php` |
| Connections | `app/Enums/WebhookEvent.php`; `app/Actions/Integrations/{ConnectOutgoingWebhook,PresentWebhookDelivery}.php`; ◆ `app/Actions/Integrations/{UpdateTeamIntegration,PresentTeamIntegration,CheckIntegration}.php`; ◆ `app/Http/Controllers/Integrations/{IntegrationUrlsController,IntegrationTestsController,TeamIntegrationsController}.php`; `app/Http/Controllers/Integrations/{WebhookSecretsController,WebhookDeliveriesController}.php`; ◆ `routes/web.php` |
| Manual shares | ◆ `app/Support/Integrations/Messages/{ShareContent,LinkShareContent,RetroRecapContent}.php`; `app/Actions/Integrations/{BuildLinkShare,BuildRetroRecap}.php`; ◆ `app/Actions/Integrations/QueueShare.php`; `app/Http/Controllers/Integrations/RetroSharesController.php`; `app/Jobs/Integrations/DeliverToChannel.php`; `app/Jobs/Integrations/DeliverToWebhook.php` |
| Automatic events | ◆ `app/Events/ActionItems/{ActionItemCompleted,ActionItemReopened}.php`; ◆ `app/Actions/ActionItems/SetActionItemStatus.php`; `app/Actions/Integrations/BuildWebhookEventData.php`; `app/Listeners/QueueWebhookEvents.php`; `app/Jobs/Integrations/DeliverWebhookEvent.php`; ◆ `app/Providers/AppServiceProvider.php` |
| Frontend | ◆ `resources/js/types/integrations.ts`; ◆ `resources/js/pages/teams/integrations.tsx`; `resources/js/components/integrations/{webhook-integration,webhook-secret,webhook-events-panel,webhook-deliveries-panel}.tsx` |
| Tests | new: `tests/Feature/Integrations/{SafeWebhookUrlTest,WebhookClientTest,ConnectOutgoingWebhookTest,WebhookSharesTest,WebhookEventsTest}.php` |
| Translations | ◆ `lang/{en,fr,es,de}.json` (rows inside each task) |
| Spec | ◆ `docs/superpowers/specs/2026-09-30-integrations-extended-design.md` (Task 7) |

Shared-file notes:
- **Plan 14c:**
  - 14c removes `JiraDataCenter` / `GitHub` from `Unreleased` after 14b and then deletes the list.
  - 14c edits the same availability test: 14b only drops `Webhook` from the "hidden" test.
  - 14c may refactor `PresentTeamIntegration` settings into a private `settings()` method. It keeps 14b's `SettingKeys['webhook']` values and the top-level `webhook` key.
- **Plan 14d:**
  - 14d listens to `ActionItemCompleted` / `ActionItemReopened` too; the `actor` property (Task 5) is available to it.
  - 14d adds its own `Event::listen` lines in `AppServiceProvider`, next to 14b's block.
  - 14d appends presenter keys next to `webhook`.

## Contract for Plans 14c and 14d

- `IntegrationProvider::Unreleased` is `[self::JiraDataCenter, self::GitHub]` after 14b.
- `ActionItemCompleted` / `ActionItemReopened`: `__construct(ActionItem $actionItem, ActionItemEventOrigin $origin, ActionItemActor|ExternalSyncActor|null $actor = null)`. `SetActionItemStatus` passes its `$actor`.
- `App\Listeners\QueueWebhookEvents` has methods `on{RetroCompleted,ActionItemCreated,ActionItemCompleted,ActionItemReopened,PokerTaskEstimated}`, registered explicitly in `AppServiceProvider::boot()`. The method names don't start with `handle`, so event discovery ignores them.
  - Other listeners of the same events are independent: the webhook listener never throws for a missing webhook.
- `DeliverToChannel` has these protected hooks, whose default behaviour is unchanged for Slack, Telegram, Teams and Mattermost:
  - `integration(IntegrationDelivery): TeamIntegration`
  - `announce(IntegrationDelivery): void`
  - `afterFailure(IntegrationDelivery, ?Throwable): void`, a no-op by default
- `PresentTeamIntegration` output has a top-level `webhook` key: `{consecutiveFailures, lastDeliverySucceededAt} | null`.
- The page prop `webhookEvents` is `array<{name, description}> | null`.
- `QueueShare` sets `team_integration_id` on every share delivery.

---

### Task 1: Enable outgoing webhooks and check URL safety

**Files:**
- Create: `app/Support/Integrations/Webhook/SafeWebhookUrl.php`, `app/Support/Integrations/Webhook/WebhookTarget.php`, `app/Support/Integrations/Exceptions/UnsafeWebhookUrl.php`, `app/Rules/OutgoingWebhookUrl.php`
- Modify: `app/Enums/IntegrationProvider.php`, `database/factories/TeamIntegrationFactory.php`, `tests/Pest.php`, `tests/Feature/Integrations/IntegrationsExtendedAvailabilityTest.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/SafeWebhookUrlTest.php`

**Interfaces:**
- Consumes (14a):
  - `HostResolver::addresses()`
  - `PublicAddress::isPublic()`
  - `services.outgoing_webhooks.{enabled, allow_private_networks, allow_http}`
  - `enableIntegrations(IntegrationProvider::Webhook)`
- Produces:
  - `SafeWebhookUrl::resolve(string $url): WebhookTarget` (throws `UnsafeWebhookUrl`) and `SafeWebhookUrl::hasAllowedShape(string $url): bool`
  - `WebhookTarget {url, host, port, address}` with `pinnedResolve(): ?string`
  - the rule `OutgoingWebhookUrl`
  - factory state `webhook(array $events = [])` with constants `TeamIntegrationFactory::WebhookUrl` / `WebhookSecret`
  - Pest helper `outgoingWebhookResolves(array $addresses = ['93.184.216.34'])`

- [ ] **Step 1: Add the factory state and the resolver helper**

In `database/factories/TeamIntegrationFactory.php`, next to 14a's `MattermostUrl`:

```php
    public const WebhookUrl = 'https://hooks.example.com/skrum/incoming';

    public const WebhookSecret = '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0';

    /**
     * @param  array<int, string>  $events
     */
    public function webhook(array $events = []): static
    {
        return $this->state(fn () => [
            'provider' => IntegrationProvider::Webhook,
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => ['url' => self::WebhookUrl, 'webhookSecret' => self::WebhookSecret],
            'settings' => [
                'host' => 'hooks.example.com',
                'channelLabel' => null,
                'secretCreatedAt' => '2026-10-01T09:00:00Z',
                'events' => $events,
            ],
            'scopes' => [],
        ]);
    }
```

In `tests/Pest.php`, add `use App\Support\Integrations\HostResolver;` if missing, and after `enableIntegrations()`:

```php
/**
 * Fakes DNS for outgoing webhooks: every host resolves to the given addresses.
 *
 * @param  array<int, string>  $addresses
 */
function outgoingWebhookResolves(array $addresses = ['93.184.216.34']): void
{
    app()->instance(HostResolver::class, new class($addresses) extends HostResolver
    {
        /**
         * @param  array<int, string>  $fixed
         */
        public function __construct(private array $fixed) {}

        public function addresses(string $host): array
        {
            return $this->fixed;
        }
    });
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Integrations/SafeWebhookUrlTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Rules\OutgoingWebhookUrl;
use App\Support\Integrations\Exceptions\UnsafeWebhookUrl;
use App\Support\Integrations\HostResolver;
use App\Support\Integrations\Webhook\SafeWebhookUrl;
use App\Support\Integrations\Webhook\WebhookTarget;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Mockery\MockInterface;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Webhook);
});

it('enables outgoing webhooks with their env flag', function () {
    expect(IntegrationProvider::Webhook->isEnabled())->toBeTrue();

    config(['services.outgoing_webhooks.enabled' => false]);

    expect(IntegrationProvider::Webhook->isEnabled())->toBeFalse();
});

it('accepts public endpoints', function (string $url, array $addresses, string $host, int $port) {
    outgoingWebhookResolves($addresses);

    $target = app(SafeWebhookUrl::class)->resolve($url);

    expect($target->url)->toBe($url)
        ->and($target->host)->toBe($host)
        ->and($target->port)->toBe($port)
        ->and($target->address)->toBe($addresses[0]);
})->with([
    'https' => ['https://hooks.example.com/skrum', ['93.184.216.34'], 'hooks.example.com', 443],
    'high port' => ['https://hooks.example.com:8443/skrum', ['93.184.216.34'], 'hooks.example.com', 8443],
    'upper-case host' => ['https://Hooks.Example.com/skrum', ['93.184.216.34'], 'hooks.example.com', 443],
    'public v6' => ['https://hooks.example.com/skrum', ['2606:2800:220:1:248:1893:25c8:1946'], 'hooks.example.com', 443],
]);

it('refuses private, reserved and invalid endpoints', function (string $url, array $addresses) {
    outgoingWebhookResolves($addresses);

    expect(fn () => app(SafeWebhookUrl::class)->resolve($url))->toThrow(UnsafeWebhookUrl::class);
})->with([
    'plain http' => ['http://hooks.example.com/skrum', ['93.184.216.34']],
    'ftp' => ['ftp://hooks.example.com/skrum', ['93.184.216.34']],
    'user info' => ['https://user:pass@hooks.example.com/skrum', ['93.184.216.34']],
    'port 22' => ['https://hooks.example.com:22/skrum', ['93.184.216.34']],
    'port 1023' => ['https://hooks.example.com:1023/skrum', ['93.184.216.34']],
    'not a url' => ['hooks.example.com/skrum', ['93.184.216.34']],
    'unresolvable' => ['https://nowhere.example.com/skrum', []],
    'loopback' => ['https://hooks.example.com/skrum', ['127.0.0.1']],
    'rfc 1918 (10/8)' => ['https://hooks.example.com/skrum', ['10.1.2.3']],
    'rfc 1918 (172.16/12)' => ['https://hooks.example.com/skrum', ['172.16.5.4']],
    'rfc 1918 (192.168/16)' => ['https://hooks.example.com/skrum', ['192.168.1.10']],
    'cloud metadata' => ['https://hooks.example.com/skrum', ['169.254.169.254']],
    'cgnat' => ['https://hooks.example.com/skrum', ['100.64.0.1']],
    'this network' => ['https://hooks.example.com/skrum', ['0.0.0.0']],
    'multicast' => ['https://hooks.example.com/skrum', ['224.0.0.1']],
    'loopback v6' => ['https://hooks.example.com/skrum', ['::1']],
    'unique local v6' => ['https://hooks.example.com/skrum', ['fc00::1']],
    'link-local v6' => ['https://hooks.example.com/skrum', ['fe80::1']],
    'one private record among public ones' => ['https://hooks.example.com/skrum', ['93.184.216.34', '10.0.0.1']],
]);

it('refuses IP literals without resolving them', function () {
    $this->mock(HostResolver::class, fn (MockInterface $mock) => $mock->shouldNotReceive('addresses'));

    expect(fn () => app(SafeWebhookUrl::class)->resolve('https://127.0.0.1/skrum'))->toThrow(UnsafeWebhookUrl::class)
        ->and(fn () => app(SafeWebhookUrl::class)->resolve('https://169.254.169.254/latest/meta-data'))->toThrow(UnsafeWebhookUrl::class)
        ->and(app(SafeWebhookUrl::class)->resolve('https://93.184.216.34/skrum')->pinnedResolve())->toBeNull();
});

it('allows plain http and private networks only when the instance does', function () {
    outgoingWebhookResolves(['10.0.0.5']);
    config([
        'services.outgoing_webhooks.allow_http' => true,
        'services.outgoing_webhooks.allow_private_networks' => true,
    ]);

    $target = app(SafeWebhookUrl::class)->resolve('http://ci.internal:8080/hooks');

    expect($target->port)->toBe(8080)
        ->and($target->address)->toBe('10.0.0.5')
        ->and(SafeWebhookUrl::hasAllowedShape('http://ci.internal/hooks'))->toBeTrue();

    config(['services.outgoing_webhooks.allow_http' => false]);

    expect(SafeWebhookUrl::hasAllowedShape('http://ci.internal/hooks'))->toBeFalse()
        ->and(SafeWebhookUrl::hasAllowedShape('https://ci.internal/hooks'))->toBeTrue();
});

it('pins IPv4 and IPv6 addresses for curl', function () {
    expect((new WebhookTarget('https://hooks.example.com/x', 'hooks.example.com', 443, '93.184.216.34'))->pinnedResolve())
        ->toBe('hooks.example.com:443:93.184.216.34')
        ->and((new WebhookTarget('https://hooks.example.com:8443/x', 'hooks.example.com', 8443, '2606:2800::1'))->pinnedResolve())
        ->toBe('hooks.example.com:8443:[2606:2800::1]');
});

it('validates webhook URLs with a single message', function () {
    outgoingWebhookResolves(['192.168.1.10']);

    $validator = Validator::make(['url' => 'https://hooks.example.com/x'], ['url' => [new OutgoingWebhookUrl]]);

    expect($validator->fails())->toBeTrue()
        ->and($validator->errors()->first('url'))->toBe('This URL points to a private or invalid address.');

    outgoingWebhookResolves();

    expect(Validator::make(['url' => 'https://hooks.example.com/x'], ['url' => [new OutgoingWebhookUrl]])->passes())->toBeTrue();
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/SafeWebhookUrlTest.php`
Expected: FAIL. `enables outgoing webhooks` fails because `Webhook` is still unreleased, and the others fail with `Class "App\Support\Integrations\Webhook\SafeWebhookUrl" not found`.

- [ ] **Step 4: Release the provider**

In `app/Enums/IntegrationProvider.php`, change the constant to:

```php
    private const Unreleased = [self::JiraDataCenter, self::GitHub];
```

In `tests/Feature/Integrations/IntegrationsExtendedAvailabilityTest.php`, change the test `keeps Jira Data Center, GitHub and webhooks hidden until their plans ship` to:

```php
it('keeps Jira Data Center and GitHub hidden until their plans ship', function () {
    disableIntegrations();
    enableIntegrations(IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub);

    expect(IntegrationProvider::JiraDataCenter->isConfigured())->toBeTrue()
        ->and(IntegrationProvider::GitHub->isConfigured())->toBeTrue()
        ->and(IntegrationProvider::JiraDataCenter->isEnabled())->toBeFalse()
        ->and(IntegrationProvider::GitHub->isEnabled())->toBeFalse()
        ->and(IntegrationProvider::anyEnabled())->toBeFalse();
});
```

- [ ] **Step 5: Implement the URL check**

Create `app/Support/Integrations/Webhook/WebhookTarget.php`:

```php
<?php

namespace App\Support\Integrations\Webhook;

/**
 * A webhook URL whose every resolved address passed the safety check; the
 * request is pinned to `address` so DNS cannot change between check and send.
 */
class WebhookTarget
{
    public function __construct(
        public string $url,
        public string $host,
        public int $port,
        public string $address,
    ) {}

    public function pinnedResolve(): ?string
    {
        if (filter_var($this->host, FILTER_VALIDATE_IP) !== false) {
            return null;
        }

        $address = str_contains($this->address, ':') ? "[{$this->address}]" : $this->address;

        return "{$this->host}:{$this->port}:{$address}";
    }
}
```

Create `app/Support/Integrations/Exceptions/UnsafeWebhookUrl.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

use App\Enums\IntegrationProvider;

class UnsafeWebhookUrl extends IntegrationException
{
    public function __construct()
    {
        parent::__construct(IntegrationProvider::Webhook);
    }

    public function status(): int
    {
        return 422;
    }

    public function userMessage(): string
    {
        return __('This webhook URL points to a private or invalid address.');
    }
}
```

Create `app/Support/Integrations/Webhook/SafeWebhookUrl.php`:

```php
<?php

namespace App\Support\Integrations\Webhook;

use App\Support\Integrations\Exceptions\UnsafeWebhookUrl;
use App\Support\Integrations\HostResolver;
use App\Support\Integrations\PublicAddress;

/**
 * Spec 8 §4.5: checked on save and before every send. Every address the
 * host resolves to must be public, unless the instance allows private
 * networks; IP literals are checked as they are.
 */
class SafeWebhookUrl
{
    private const MaxLength = 2048;

    private const MinUnprivilegedPort = 1024;

    private const MaxPort = 65535;

    /**
     * @var array<int, int>
     */
    private const StandardPorts = [80, 443];

    public function __construct(private HostResolver $resolver) {}

    public static function hasAllowedShape(string $url): bool
    {
        return self::hostAndPort($url) !== null;
    }

    public function resolve(string $url): WebhookTarget
    {
        $hostAndPort = self::hostAndPort($url);

        if ($hostAndPort === null) {
            throw new UnsafeWebhookUrl;
        }

        [$host, $port] = $hostAndPort;
        $addresses = filter_var($host, FILTER_VALIDATE_IP) !== false ? [$host] : $this->resolver->addresses($host);

        if ($addresses === []) {
            throw new UnsafeWebhookUrl;
        }

        if (! self::allowsPrivateNetworks()) {
            foreach ($addresses as $address) {
                if (! PublicAddress::isPublic($address)) {
                    throw new UnsafeWebhookUrl;
                }
            }
        }

        return new WebhookTarget($url, $host, $port, $addresses[0]);
    }

    /**
     * @return array{0: string, 1: int}|null
     */
    private static function hostAndPort(string $url): ?array
    {
        if (strlen($url) > self::MaxLength || filter_var($url, FILTER_VALIDATE_URL) === false) {
            return null;
        }

        $parts = parse_url($url);

        if (! is_array($parts)) {
            return null;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));

        if (! in_array($scheme, self::allowedSchemes(), true)) {
            return null;
        }

        if (isset($parts['user']) || isset($parts['pass'])) {
            return null;
        }

        $host = strtolower(trim((string) ($parts['host'] ?? ''), '[]'));

        if ($host === '') {
            return null;
        }

        $port = $parts['port'] ?? ($scheme === 'https' ? 443 : 80);

        if (! self::isAllowedPort($port)) {
            return null;
        }

        return [$host, $port];
    }

    /**
     * @return array<int, string>
     */
    private static function allowedSchemes(): array
    {
        return config('services.outgoing_webhooks.allow_http') === true ? ['https', 'http'] : ['https'];
    }

    private static function isAllowedPort(int $port): bool
    {
        if (in_array($port, self::StandardPorts, true)) {
            return true;
        }

        return $port >= self::MinUnprivilegedPort && $port <= self::MaxPort;
    }

    private static function allowsPrivateNetworks(): bool
    {
        return config('services.outgoing_webhooks.allow_private_networks') === true;
    }
}
```

Create `app/Rules/OutgoingWebhookUrl.php`:

```php
<?php

namespace App\Rules;

use App\Support\Integrations\Exceptions\UnsafeWebhookUrl;
use App\Support\Integrations\Webhook\SafeWebhookUrl;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class OutgoingWebhookUrl implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            $fail(__('This URL points to a private or invalid address.'));

            return;
        }

        try {
            app(SafeWebhookUrl::class)->resolve($value);
        } catch (UnsafeWebhookUrl) {
            $fail(__('This URL points to a private or invalid address.'));
        }
    }
}
```

- [ ] **Step 6: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `This URL points to a private or invalid address.` | `Cette URL pointe vers une adresse privée ou invalide.` | `Esta URL apunta a una dirección privada o no válida.` | `Diese URL verweist auf eine private oder ungültige Adresse.` |
| `This webhook URL points to a private or invalid address.` | `L'URL de ce webhook pointe vers une adresse privée ou invalide.` | `La URL de este webhook apunta a una dirección privada o no válida.` | `Diese Webhook-URL verweist auf eine private oder ungültige Adresse.` |

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/SafeWebhookUrlTest.php tests/Feature/Integrations/IntegrationsExtendedAvailabilityTest.php tests/Feature/Integrations/InboundReachabilityTest.php tests/Feature/Integrations/ConnectUrlChannelTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS. Then run pint and phpstan (0 errors).

- [ ] **Step 8: Commit**

```bash
git add app/Enums/IntegrationProvider.php app/Support/Integrations/Webhook/SafeWebhookUrl.php app/Support/Integrations/Webhook/WebhookTarget.php app/Support/Integrations/Exceptions/UnsafeWebhookUrl.php app/Rules/OutgoingWebhookUrl.php database/factories/TeamIntegrationFactory.php tests/Pest.php tests/Feature/Integrations/SafeWebhookUrlTest.php tests/Feature/Integrations/IntegrationsExtendedAvailabilityTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): enable outgoing webhooks and refuse unsafe endpoints

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 2: The signed webhook client and delivery health

**Files:**
- Create: `app/Support/Integrations/Webhook/{WebhookMessage,WebhookClient,WebhookHealth}.php`, `app/Support/Integrations/Exceptions/{WebhookGone,WebhookDisabled}.php`
- Modify: `tests/Pest.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/WebhookClientTest.php`

**Interfaces:**
- Consumes:
  - `SafeWebhookUrl` (Task 1)
  - `ProviderHttp::request()` / `retryAfter()`
  - `TeamIntegration::credential()` / `withReconnectHandling()`
  - the exception hierarchy
  - `IntegrationDelivery` columns from 14a
- Produces:
  - `WebhookMessage(string $id, string $event, string $occurredAt, array $data)` with `body(Team, CarbonInterface $sentAt): string` and `static test(): self`
  - `WebhookClient`:
    - `send(TeamIntegration, WebhookMessage, ?IntegrationDelivery = null): void`
    - `pendingRequest(WebhookTarget): PendingRequest`
    - `static signature(string $secret, int $timestamp, string $body): string`
    - `ensureUsableUrl(TeamIntegration): void`
  - `WebhookHealth`:
    - `succeeded(TeamIntegration): void`, `failed(TeamIntegration): void`, `reenable(TeamIntegration): void`
    - constants `FailureLimit = 10`, `FailuresReason = 'failures'`, `GoneReason = 'gone'`
  - exceptions `WebhookGone` (a `ReconnectRequired`) and `WebhookDisabled` (409)
  - Pest helper `outgoingWebhookSignatureIsValid(Request $request, string $secret = TeamIntegrationFactory::WebhookSecret): bool`

- [ ] **Step 1: Add the signature helper**

In `tests/Pest.php`, add `use Database\Factories\TeamIntegrationFactory;` and `use Illuminate\Http\Client\Request as HttpClientRequest;` if missing, and after `outgoingWebhookResolves()`:

```php
function outgoingWebhookSignatureIsValid(HttpClientRequest $request, string $secret = TeamIntegrationFactory::WebhookSecret): bool
{
    $timestamp = $request->header('X-Skrum-Timestamp')[0] ?? '';
    $expected = 'sha256='.hash_hmac('sha256', "{$timestamp}.{$request->body()}", $secret);

    return hash_equals($expected, $request->header('X-Skrum-Signature')[0] ?? '');
}
```

(If `tests/Pest.php` already imports `Illuminate\Http\Client\Request` as `Request`, use that alias instead of adding a second one.)

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Integrations/WebhookClientTest.php`:

```php
<?php

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\IntegrationDelivery;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Exceptions\UnsafeWebhookUrl;
use App\Support\Integrations\Webhook\SafeWebhookUrl;
use App\Support\Integrations\Webhook\WebhookClient;
use App\Support\Integrations\Webhook\WebhookHealth;
use App\Support\Integrations\Webhook\WebhookMessage;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Webhook);
    outgoingWebhookResolves();
});

function outgoingWebhookDelivery(TeamIntegration $integration): IntegrationDelivery
{
    return IntegrationDelivery::factory()->create([
        'team_id' => $integration->team_id,
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::Event,
        'event' => 'action_item.created',
        'team_integration_id' => $integration->id,
        'requested_by_user_id' => null,
    ]);
}

function outgoingWebhookMessage(string $id = 'delivery-1'): WebhookMessage
{
    return new WebhookMessage($id, 'action_item.created', '2026-10-07T10:00:00Z', [
        'actionItem' => ['id' => 'item-1', 'content' => 'Fix the deploy'],
    ]);
}

it('signs a versioned JSON envelope', function () {
    $this->travelTo(Carbon::parse('2026-10-07 10:00:05', 'UTC'));
    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);
    $integration = TeamIntegration::factory()->webhook()->create();

    app(WebhookClient::class)->send($integration, outgoingWebhookMessage());

    Http::assertSent(fn (Request $request) => $request->url() === TeamIntegrationFactory::WebhookUrl
        && $request->method() === 'POST'
        && $request->header('Content-Type')[0] === 'application/json'
        && $request->header('User-Agent')[0] === 'skrum-webhooks/1'
        && $request->header('X-Skrum-Event')[0] === 'action_item.created'
        && $request->header('X-Skrum-Delivery')[0] === 'delivery-1'
        && $request->header('X-Skrum-Timestamp')[0] === (string) Carbon::parse('2026-10-07 10:00:05', 'UTC')->getTimestamp()
        && outgoingWebhookSignatureIsValid($request)
        && json_decode($request->body(), true) === [
            'version' => 1,
            'id' => 'delivery-1',
            'event' => 'action_item.created',
            'occurredAt' => '2026-10-07T10:00:00Z',
            'sentAt' => '2026-10-07T10:00:05Z',
            'team' => ['id' => $integration->team->id, 'name' => $integration->team->name],
            'data' => ['actionItem' => ['id' => 'item-1', 'content' => 'Fix the deploy']],
        ]);
});

it('computes the documented signature', function () {
    expect(WebhookClient::signature('secret', 1700000000, '{"a":1}'))
        ->toBe('sha256='.hash_hmac('sha256', '1700000000.{"a":1}', 'secret'));
});

it('pins the connection to the vetted address and never follows redirects', function () {
    $options = app(WebhookClient::class)
        ->pendingRequest(app(SafeWebhookUrl::class)->resolve(TeamIntegrationFactory::WebhookUrl))
        ->getOptions();

    expect($options['curl'][CURLOPT_RESOLVE])->toBe(['hooks.example.com:443:93.184.216.34'])
        ->and($options['allow_redirects'])->toBeFalse()
        ->and($options['timeout'])->toBe(10);
});

it('records attempts and resets the failure counter on success', function () {
    Http::fakeSequence('hooks.example.com/*')->push('', 503)->push('', 200);
    $integration = TeamIntegration::factory()->webhook()->create();
    $integration->forceFill(['consecutive_failures' => 4])->save();
    $delivery = outgoingWebhookDelivery($integration);

    expect(fn () => app(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery))
        ->toThrow(ProviderUnavailable::class);
    expect($delivery->fresh()->attempts)->toBe(1)
        ->and($delivery->fresh()->response_status)->toBe(503)
        ->and($integration->fresh()->consecutive_failures)->toBe(4);

    app(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery->fresh());

    expect($delivery->fresh()->attempts)->toBe(2)
        ->and($delivery->fresh()->response_status)->toBe(200)
        ->and($delivery->fresh()->last_attempt_at)->not->toBeNull()
        ->and($integration->fresh()->consecutive_failures)->toBe(0)
        ->and($integration->fresh()->last_delivery_succeeded_at)->not->toBeNull();
});

it('maps receiver answers without reading their bodies', function (int $status, string $exception) {
    Http::fake(['hooks.example.com/*' => Http::response('internal stack trace', $status, ['Location' => 'http://169.254.169.254/'])]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $caught = null;

    try {
        app(WebhookClient::class)->send($integration, outgoingWebhookMessage());
    } catch (Throwable $thrown) {
        $caught = $thrown;
    }

    expect($caught)->toBeInstanceOf($exception)
        ->and($caught?->getMessage())->toBe("The receiver answered {$status}.")
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::Active);
    Http::assertSentCount(1);
})->with([
    'not found' => [404, ProviderRejected::class],
    'redirect' => [302, ProviderRejected::class],
    'server error' => [500, ProviderUnavailable::class],
]);

it('caps Retry-After at one hour', function (string $retryAfter, int $expected) {
    Http::fake(['hooks.example.com/*' => Http::response('', 429, ['Retry-After' => $retryAfter])]);
    $rateLimited = null;

    try {
        app(WebhookClient::class)->send(TeamIntegration::factory()->webhook()->create(), outgoingWebhookMessage());
    } catch (RateLimited $exception) {
        $rateLimited = $exception;
    }

    expect($rateLimited?->retryAfter)->toBe($expected);
})->with([
    'short' => ['12', 12],
    'long' => ['7200', 3600],
]);

it('disables the webhook when the receiver answers 410', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 410)]);
    $integration = TeamIntegration::factory()->webhook()->create();

    expect(fn () => app(WebhookClient::class)->send($integration, outgoingWebhookMessage()))
        ->toThrow(ReconnectRequired::class, 'The receiver asked skrum to stop.');

    $fresh = $integration->fresh();

    expect($fresh->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($fresh->setting('disabledReason'))->toBe(WebhookHealth::GoneReason)
        ->and($fresh->last_error)->toBe('The receiver asked skrum to stop.');
});

it('keeps only the host of connection errors', function () {
    Http::fake(['*' => Http::failedConnection('cURL error 7: Failed to connect to '.TeamIntegrationFactory::WebhookUrl.'?token=abc')]);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDelivery($integration);
    $unavailable = null;

    try {
        app(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery);
    } catch (ProviderUnavailable $exception) {
        $unavailable = $exception;
    }

    expect($unavailable?->timedOut)->toBeTrue()
        ->and($unavailable?->detail())->toBe('Could not reach hooks.example.com.')
        ->and($delivery->fresh()->attempts)->toBe(1)
        ->and($delivery->fresh()->response_status)->toBeNull();
});

it('refuses an endpoint that became private without calling it', function () {
    outgoingWebhookResolves(['10.0.0.1']);
    $integration = TeamIntegration::factory()->webhook()->create();
    $delivery = outgoingWebhookDelivery($integration);

    expect(fn () => app(WebhookClient::class)->send($integration, outgoingWebhookMessage($delivery->id), $delivery))
        ->toThrow(UnsafeWebhookUrl::class);

    Http::assertNothingSent();
    expect($delivery->fresh()->attempts)->toBe(0)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::Active);
});

it('builds the test message', function () {
    $message = WebhookMessage::test();

    expect($message->event)->toBe('webhook.test')
        ->and($message->data)->toBe(['message' => 'skrum is connected.'])
        ->and(str($message->id)->isUuid())->toBeTrue();
});

it('disables after 10 failures in a row without a success in 24 hours', function (int $previous, ?int $successHoursAgo, bool $disabled) {
    $integration = TeamIntegration::factory()->webhook()->create();
    $integration->forceFill([
        'consecutive_failures' => $previous,
        'last_delivery_succeeded_at' => $successHoursAgo === null ? null : now()->subHours($successHoursAgo),
    ])->save();

    app(WebhookHealth::class)->failed($integration);

    $fresh = $integration->fresh();

    expect($fresh->consecutive_failures)->toBe($previous + 1)
        ->and($fresh->status)->toBe($disabled ? IntegrationStatus::ReconnectRequired : IntegrationStatus::Active)
        ->and($fresh->setting('disabledReason'))->toBe($disabled ? WebhookHealth::FailuresReason : null)
        ->and($fresh->last_error)->toBe($disabled ? 'Disabled after 10 failed deliveries in a row.' : null);
})->with([
    'ninth failure' => [8, null, false],
    'tenth failure' => [9, null, true],
    'tenth after an old success' => [9, 30, true],
    'tenth after a recent success' => [9, 2, false],
    'eleventh once the success is older than a day' => [10, 25, true],
]);

it('stops counting while disabled and re-enables with a clean slate', function () {
    $integration = TeamIntegration::factory()->webhook()->reconnectRequired('Disabled after 10 failed deliveries in a row.')->create();
    $integration->forceFill([
        'consecutive_failures' => 10,
        'settings' => [...$integration->settings, 'disabledReason' => WebhookHealth::FailuresReason],
    ])->save();

    app(WebhookHealth::class)->failed($integration);

    expect($integration->fresh()->consecutive_failures)->toBe(10);

    app(WebhookHealth::class)->reenable($integration->fresh());

    $fresh = $integration->fresh();

    expect($fresh->status)->toBe(IntegrationStatus::Active)
        ->and($fresh->consecutive_failures)->toBe(0)
        ->and($fresh->last_error)->toBeNull()
        ->and(array_key_exists('disabledReason', $fresh->settings))->toBeFalse()
        ->and($fresh->setting('events'))->toBe([]);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookClientTest.php`
Expected: FAIL — `Class "App\Support\Integrations\Webhook\WebhookClient" not found`.

- [ ] **Step 4: Add the exceptions**

Create `app/Support/Integrations/Exceptions/WebhookGone.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

use App\Enums\IntegrationProvider;

/**
 * A 410 from the receiver: skrum stops at once (spec 8 §4.5).
 */
class WebhookGone extends ReconnectRequired
{
    public function __construct()
    {
        parent::__construct(IntegrationProvider::Webhook, __('The receiver asked skrum to stop.'));
    }

    public function userMessage(): string
    {
        return __('The receiver asked skrum to stop.');
    }
}
```

Create `app/Support/Integrations/Exceptions/WebhookDisabled.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

use App\Enums\IntegrationProvider;

class WebhookDisabled extends IntegrationException
{
    public function __construct()
    {
        parent::__construct(IntegrationProvider::Webhook);
    }

    public function status(): int
    {
        return 409;
    }

    public function userMessage(): string
    {
        return __('Webhook disabled.');
    }
}
```

- [ ] **Step 5: Implement the message, the client and the health tracker**

Create `app/Support/Integrations/Webhook/WebhookMessage.php`:

```php
<?php

namespace App\Support\Integrations\Webhook;

use App\Models\Team;
use Carbon\CarbonInterface;
use Illuminate\Support\Str;

/**
 * One webhook body (spec 8 §4.5). `id` is the delivery id, identical on every
 * retry so receivers can de-duplicate; `sentAt` changes per attempt.
 */
class WebhookMessage
{
    public const Version = 1;

    public const TestEvent = 'webhook.test';

    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(
        public string $id,
        public string $event,
        public string $occurredAt,
        public array $data,
    ) {}

    public static function test(): self
    {
        return new self((string) Str::uuid(), self::TestEvent, now()->toIso8601ZuluString(), [
            'message' => __('skrum is connected.'),
        ]);
    }

    public function body(Team $team, CarbonInterface $sentAt): string
    {
        return json_encode([
            'version' => self::Version,
            'id' => $this->id,
            'event' => $this->event,
            'occurredAt' => $this->occurredAt,
            'sentAt' => $sentAt->toIso8601ZuluString(),
            'team' => ['id' => $team->id, 'name' => $team->name],
            'data' => $this->data,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}
```

Create `app/Support/Integrations/Webhook/WebhookHealth.php`:

```php
<?php

namespace App\Support\Integrations\Webhook;

use App\Enums\IntegrationStatus;
use App\Models\TeamIntegration;
use Illuminate\Support\Facades\DB;

/**
 * Spec 8 §4.7: a webhook disables itself after 10 failed deliveries in a
 * row when none succeeded in the last 24 hours; any 2xx resets the count.
 */
class WebhookHealth
{
    public const FailureLimit = 10;

    public const FailuresReason = 'failures';

    public const GoneReason = 'gone';

    private const SuccessGraceHours = 24;

    public function succeeded(TeamIntegration $integration): void
    {
        $integration->forceFill([
            'consecutive_failures' => 0,
            'last_delivery_succeeded_at' => now(),
        ])->save();
    }

    public function failed(TeamIntegration $integration): void
    {
        DB::transaction(function () use ($integration): void {
            $locked = TeamIntegration::query()->lockForUpdate()->find($integration->id);

            if ($locked === null) {
                return;
            }

            if (! $locked->isActive()) {
                return;
            }

            $failures = $locked->consecutive_failures + 1;
            $locked->forceFill(['consecutive_failures' => $failures]);

            if ($this->shouldDisable($locked, $failures)) {
                $locked->forceFill([
                    'status' => IntegrationStatus::ReconnectRequired,
                    'last_error' => __('Disabled after 10 failed deliveries in a row.'),
                    'settings' => [...$locked->settings, 'disabledReason' => self::FailuresReason],
                ]);
            }

            $locked->save();
        });
    }

    public function reenable(TeamIntegration $integration): void
    {
        $settings = $integration->settings;
        unset($settings['disabledReason']);

        $integration->forceFill([
            'status' => IntegrationStatus::Active,
            'last_error' => null,
            'consecutive_failures' => 0,
            'settings' => $settings,
        ])->save();
    }

    private function shouldDisable(TeamIntegration $integration, int $failures): bool
    {
        if ($failures < self::FailureLimit) {
            return false;
        }

        $lastSuccess = $integration->last_delivery_succeeded_at;

        return $lastSuccess === null || $lastSuccess->lt(now()->subHours(self::SuccessGraceHours));
    }
}
```

Create `app/Support/Integrations/Webhook/WebhookClient.php`:

```php
<?php

namespace App\Support\Integrations\Webhook;

use App\Enums\IntegrationProvider;
use App\Models\IntegrationDelivery;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Exceptions\UnsafeWebhookUrl;
use App\Support\Integrations\Exceptions\WebhookGone;
use App\Support\Integrations\ProviderHttp;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;

/**
 * Posts signed JSON to an Owner/Admin's endpoint (spec 8 §4.5). The URL is
 * re-checked and the address pinned on every send; redirects are refused
 * and only the status code of the answer is read.
 */
class WebhookClient
{
    public const TimeoutSeconds = 10;

    public const MaxRetryAfterSeconds = 3600;

    public const UserAgent = 'skrum-webhooks/1';

    private const GoneStatus = 410;

    private const TooManyRequestsStatus = 429;

    public function __construct(
        private SafeWebhookUrl $safeWebhookUrl,
        private WebhookHealth $health,
    ) {}

    public static function signature(string $secret, int $timestamp, string $body): string
    {
        return 'sha256='.hash_hmac('sha256', "{$timestamp}.{$body}", $secret);
    }

    public function send(TeamIntegration $integration, WebhookMessage $message, ?IntegrationDelivery $delivery = null): void
    {
        $integration->withReconnectHandling(function () use ($integration, $message, $delivery): void {
            $target = $this->safeWebhookUrl->resolve($this->url($integration));
            $secret = $this->secret($integration);
            $response = null;

            try {
                $response = $this->post($target, $message, $integration, $secret);
            } finally {
                if ($delivery !== null) {
                    $this->recordAttempt($delivery, $response?->status());
                }
            }

            $this->handleAnswer($integration, $response, $delivery !== null);
        });
    }

    public function pendingRequest(WebhookTarget $target): PendingRequest
    {
        $request = ProviderHttp::request(self::TimeoutSeconds)
            ->withoutRedirecting()
            ->withUserAgent(self::UserAgent);

        $resolve = $target->pinnedResolve();

        if ($resolve === null) {
            return $request;
        }

        return $request->withOptions(['curl' => [CURLOPT_RESOLVE => [$resolve]]]);
    }

    public function ensureUsableUrl(TeamIntegration $integration): void
    {
        $integration->withReconnectHandling(function () use ($integration): void {
            if (! SafeWebhookUrl::hasAllowedShape($this->url($integration))) {
                throw new ReconnectRequired(IntegrationProvider::Webhook, __('This webhook URL is no longer allowed. Paste a new one.'));
            }
        });
    }

    private function post(WebhookTarget $target, WebhookMessage $message, TeamIntegration $integration, string $secret): Response
    {
        $timestamp = now()->getTimestamp();
        $body = $message->body($integration->team, now());

        try {
            return $this->pendingRequest($target)
                ->withHeaders([
                    'X-Skrum-Event' => $message->event,
                    'X-Skrum-Delivery' => $message->id,
                    'X-Skrum-Timestamp' => (string) $timestamp,
                    'X-Skrum-Signature' => self::signature($secret, $timestamp, $body),
                ])
                ->withBody($body, 'application/json')
                ->post($target->url);
        } catch (ConnectionException) {
            throw new ProviderUnavailable(IntegrationProvider::Webhook, __('Could not reach :host.', ['host' => $target->host]), timedOut: true);
        }
    }

    private function handleAnswer(TeamIntegration $integration, Response $response, bool $isDelivery): void
    {
        if ($response->successful()) {
            if ($isDelivery) {
                $this->health->succeeded($integration);
            }

            return;
        }

        $status = $response->status();
        $answered = __('The receiver answered :status.', ['status' => $status]);

        if ($status === self::GoneStatus) {
            $integration->forceFill(['settings' => [...$integration->settings, 'disabledReason' => WebhookHealth::GoneReason]])->save();

            throw new WebhookGone;
        }

        if ($status === self::TooManyRequestsStatus) {
            throw new RateLimited(IntegrationProvider::Webhook, min(ProviderHttp::retryAfter($response), self::MaxRetryAfterSeconds), $answered);
        }

        if ($response->serverError()) {
            throw new ProviderUnavailable(IntegrationProvider::Webhook, $answered);
        }

        throw new ProviderRejected(IntegrationProvider::Webhook, $answered, $status);
    }

    private function recordAttempt(IntegrationDelivery $delivery, ?int $status): void
    {
        $delivery->forceFill([
            'attempts' => $delivery->attempts + 1,
            'last_attempt_at' => now(),
            'response_status' => $status,
        ])->save();
    }

    private function url(TeamIntegration $integration): string
    {
        $url = $integration->credential('url');

        if (! is_string($url)) {
            throw new UnsafeWebhookUrl;
        }

        return $url;
    }

    private function secret(TeamIntegration $integration): string
    {
        $secret = $integration->credential('webhookSecret');

        if (! is_string($secret) || $secret === '') {
            throw new ReconnectRequired(IntegrationProvider::Webhook, $integration->last_error);
        }

        return $secret;
    }
}
```

(`handleAnswer()` receives a non-null response: `post()` either returns one or throws, and the `finally` only records the attempt.)

- [ ] **Step 6: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `The receiver asked skrum to stop.` | `Le destinataire a demandé à skrum d'arrêter.` | `El destinatario pidió a skrum que se detuviera.` | `Der Empfänger hat skrum gebeten aufzuhören.` |
| `The receiver answered :status.` | `Le destinataire a répondu :status.` | `El destinatario respondió :status.` | `Der Empfänger hat mit :status geantwortet.` |
| `Could not reach :host.` | `Impossible de joindre :host.` | `No se pudo contactar con :host.` | `:host war nicht erreichbar.` |
| `Webhook disabled.` | `Webhook désactivé.` | `Webhook desactivado.` | `Webhook deaktiviert.` |
| `Disabled after 10 failed deliveries in a row.` | `Désactivé après 10 envois échoués d'affilée.` | `Desactivado tras 10 envíos fallidos seguidos.` | `Nach 10 fehlgeschlagenen Zustellungen in Folge deaktiviert.` |
| `This webhook URL is no longer allowed. Paste a new one.` | `Cette URL de webhook n'est plus autorisée. Collez-en une nouvelle.` | `Esta URL de webhook ya no está permitida. Pega una nueva.` | `Diese Webhook-URL ist nicht mehr erlaubt. Füge eine neue ein.` |

(`skrum is connected.` exists.)

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookClientTest.php tests/Feature/Integrations/SafeWebhookUrlTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS. Then run pint and phpstan (0 errors).

- [ ] **Step 8: Commit**

```bash
git add app/Support/Integrations/Webhook/WebhookMessage.php app/Support/Integrations/Webhook/WebhookClient.php app/Support/Integrations/Webhook/WebhookHealth.php app/Support/Integrations/Exceptions/WebhookGone.php app/Support/Integrations/Exceptions/WebhookDisabled.php tests/Pest.php tests/Feature/Integrations/WebhookClientTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): sign, pin and track generic webhook requests

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 3: Connect, configure, test, re-enable and inspect a webhook

**Files:**
- Create: `app/Enums/WebhookEvent.php`, `app/Actions/Integrations/ConnectOutgoingWebhook.php`, `app/Actions/Integrations/PresentWebhookDelivery.php`, `app/Http/Controllers/Integrations/WebhookSecretsController.php`, `app/Http/Controllers/Integrations/WebhookDeliveriesController.php` (create both controllers with `vendor/bin/sail artisan make:controller Integrations/<Name> --no-interaction`)
- Modify: `app/Actions/Integrations/{UpdateTeamIntegration,PresentTeamIntegration,CheckIntegration}.php`, `app/Http/Controllers/Integrations/{IntegrationUrlsController,IntegrationTestsController,TeamIntegrationsController}.php`, `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/ConnectOutgoingWebhookTest.php`

**Interfaces:**
- Consumes:
  - `SaveTeamIntegration`, `ConnectUrlChannel::LabelMaxLength`
  - `WebhookClient` / `WebhookHealth` / `WebhookMessage` (Task 2), the `OutgoingWebhookUrl` rule (Task 1)
  - 14a's route `teams.integrations.urls.store`, `TeamPolicy::manageIntegrations`, `EnsureIntegrationProviderEnabled`
- Produces:
  - `WebhookEvent` (five cases, `values()`, `normalize()`, `description()`, `options()`)
  - `ConnectOutgoingWebhook::{rules, handle, update, rotateSecret}`
  - routes `teams.integrations.secret.store` / `teams.integrations.deliveries.index`
  - presenter key `webhook` and settings keys; page prop `webhookEvents`
  - Test and daily-check arms for `Webhook`

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/ConnectOutgoingWebhookTest.php`:

```php
<?php

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\IntegrationDelivery;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\HostResolver;
use App\Support\Integrations\Webhook\WebhookHealth;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery\MockInterface;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Webhook);
    outgoingWebhookResolves();
});

/**
 * @return array{0: Team, 1: User}
 */
function outgoingWebhookAdmin(): array
{
    $team = Team::factory()->create();

    return [$team, integrationAdmin($team)];
}

it('connects a webhook and shows its signing secret once', function () {
    [$team, $admin] = outgoingWebhookAdmin();

    $response = $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'webhook']), [
            'url' => TeamIntegrationFactory::WebhookUrl,
            'channel_label' => '  Zapier  ',
        ]);

    $response->assertCreated()
        ->assertJson([
            'provider' => 'webhook',
            'status' => 'active',
            'settings' => ['host' => 'hooks.example.com', 'channelLabel' => 'Zapier', 'events' => []],
            'webhook' => ['consecutiveFailures' => 0, 'lastDeliverySucceededAt' => null],
            'connectedBy' => $admin->name,
        ]);

    $secret = $response->json('secret');
    $integration = TeamIntegration::query()->sole();

    expect($secret)->toMatch('/^[0-9a-f]{64}$/')
        ->and($integration->credential('webhookSecret'))->toBe($secret)
        ->and($integration->credential('url'))->toBe(TeamIntegrationFactory::WebhookUrl)
        ->and($integration->getRawOriginal('credentials'))->not->toContain($secret)
        ->and($response->json('settings.secretCreatedAt'))->not->toBeNull()
        ->and($response->getContent())->not->toContain('skrum/incoming');
    Http::assertNothingSent();
});

it('refuses private and invalid endpoints', function (string $url, array $addresses) {
    [$team, $admin] = outgoingWebhookAdmin();
    outgoingWebhookResolves($addresses);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'webhook']), ['url' => $url])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['url' => 'This URL points to a private or invalid address.']);

    expect(TeamIntegration::query()->count())->toBe(0);
})->with([
    'loopback' => ['https://hooks.example.com/x', ['127.0.0.1']],
    'cloud metadata' => ['https://hooks.example.com/x', ['169.254.169.254']],
    'plain http' => ['http://hooks.example.com/x', ['93.184.216.34']],
    'user info' => ['https://user:pass@hooks.example.com/x', ['93.184.216.34']],
    'unresolvable' => ['https://nowhere.example.com/x', []],
]);

it('accepts private http endpoints when the instance allows them', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    outgoingWebhookResolves(['10.0.0.5']);
    config([
        'services.outgoing_webhooks.allow_http' => true,
        'services.outgoing_webhooks.allow_private_networks' => true,
    ]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'webhook']), ['url' => 'http://ci.internal:8080/hooks'])
        ->assertCreated()
        ->assertJson(['settings' => ['host' => 'ci.internal']]);
});

it('answers 404 while outgoing webhooks are disabled', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    config(['services.outgoing_webhooks.enabled' => false]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'webhook']), ['url' => TeamIntegrationFactory::WebhookUrl])
        ->assertNotFound();
});

it('is reserved to workspace owners and admins, before validation', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    $this->mock(HostResolver::class, fn (MockInterface $mock) => $mock->shouldNotReceive('addresses'));

    $this->actingAs($member)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'webhook']), ['url' => 'https://127.0.0.1/x'])
        ->assertForbidden();
    $this->actingAs($member)
        ->patchJson(route('teams.integrations.update', [$team->workspace, $team, $integration]), ['events' => ['nope']])
        ->assertForbidden();
    $this->actingAs($member)
        ->postJson(route('teams.integrations.secret.store', [$team->workspace, $team, $integration]))
        ->assertForbidden();
    $this->actingAs($member)
        ->getJson(route('teams.integrations.deliveries.index', [$team->workspace, $team, $integration]))
        ->assertForbidden();

    expect($integration->fresh()->credential('webhookSecret'))->toBe(TeamIntegrationFactory::WebhookSecret);
});

it('replaces a webhook with a new secret and no subscriptions', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $existing = TeamIntegration::factory()->webhook(['retro.completed'])->create(['team_id' => $team->id]);
    $existing->forceFill(['consecutive_failures' => 5])->save();

    $response = $this->actingAs($admin)
        ->postJson(route('teams.integrations.urls.store', [$team->workspace, $team, 'webhook']), ['url' => 'https://other.example.com/in'])
        ->assertCreated()
        ->assertJson(['settings' => ['host' => 'other.example.com', 'events' => []], 'webhook' => ['consecutiveFailures' => 0]]);

    $integration = TeamIntegration::query()->sole();

    expect($response->json('secret'))->not->toBe(TeamIntegrationFactory::WebhookSecret)
        ->and($integration->id)->toBe($existing->id)
        ->and($integration->credential('webhookSecret'))->toBe($response->json('secret'));
});

it('updates the label, the URL and the subscriptions without changing the secret', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook(['retro.completed'])->create(['team_id' => $team->id]);
    $url = route('teams.integrations.update', [$team->workspace, $team, $integration]);

    $this->actingAs($admin)->patchJson($url, ['channel_label' => 'n8n'])
        ->assertOk()
        ->assertJson(['settings' => ['channelLabel' => 'n8n', 'events' => ['retro.completed']]])
        ->assertJsonMissingPath('secret');

    $this->actingAs($admin)->patchJson($url, ['events' => ['poker.task.estimated', 'retro.completed']])
        ->assertOk()
        ->assertJson(['settings' => ['events' => ['retro.completed', 'poker.task.estimated']]]);

    $this->actingAs($admin)->patchJson($url, ['url' => 'https://other.example.com/in'])
        ->assertOk()
        ->assertJson(['settings' => ['host' => 'other.example.com', 'channelLabel' => 'n8n']]);

    $this->actingAs($admin)->patchJson($url, ['events' => ['card.created']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['events.0']);
    $this->actingAs($admin)->patchJson($url, ['events' => ['retro.completed', 'retro.completed']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['events.0']);
    $this->actingAs($admin)->patchJson($url, ['events' => 'retro.completed'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['events']);

    outgoingWebhookResolves(['10.0.0.1']);

    $this->actingAs($admin)->patchJson($url, ['url' => 'https://internal.example.com/in'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['url' => 'This URL points to a private or invalid address.']);

    $fresh = $integration->fresh();

    expect($fresh->credential('url'))->toBe('https://other.example.com/in')
        ->and($fresh->credential('webhookSecret'))->toBe(TeamIntegrationFactory::WebhookSecret)
        ->and($fresh->setting('events'))->toBe(['retro.completed', 'poker.task.estimated']);
});

it('re-enables a disabled webhook, and ignores re-enabling an active one', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->reconnectRequired('Disabled after 10 failed deliveries in a row.')->create(['team_id' => $team->id]);
    $integration->forceFill([
        'consecutive_failures' => 10,
        'settings' => [...$integration->settings, 'disabledReason' => WebhookHealth::FailuresReason],
    ])->save();
    $url = route('teams.integrations.update', [$team->workspace, $team, $integration]);

    $this->actingAs($admin)->patchJson($url, ['enabled' => true])
        ->assertOk()
        ->assertJson(['status' => 'active', 'lastError' => null, 'webhook' => ['consecutiveFailures' => 0]])
        ->assertJsonMissingPath('settings.disabledReason');

    $this->actingAs($admin)->patchJson($url, ['enabled' => true])
        ->assertOk()
        ->assertJson(['status' => 'active']);
});

it('re-activates a disabled webhook when its URL is replaced', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->reconnectRequired('The receiver asked skrum to stop.')->create(['team_id' => $team->id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'disabledReason' => WebhookHealth::GoneReason]])->save();

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', [$team->workspace, $team, $integration]), ['url' => 'https://other.example.com/in'])
        ->assertOk()
        ->assertJson(['status' => 'active', 'lastError' => null])
        ->assertJsonMissingPath('settings.disabledReason');
});

it('rotates the signing secret', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    Http::fake(['hooks.example.com/*' => Http::response('', 204)]);

    $secret = $this->actingAs($admin)
        ->postJson(route('teams.integrations.secret.store', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->json('secret');

    expect($secret)->toMatch('/^[0-9a-f]{64}$/')
        ->and($secret)->not->toBe(TeamIntegrationFactory::WebhookSecret)
        ->and($integration->fresh()->setting('secretCreatedAt'))->not->toBe('2026-10-01T09:00:00Z');

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $integration]))
        ->assertOk();

    Http::assertSent(fn (Request $request) => outgoingWebhookSignatureIsValid($request, $secret)
        && ! outgoingWebhookSignatureIsValid($request));
});

it('answers 404 for the secret and the log of another kind of integration', function () {
    enableIntegrations(IntegrationProvider::Slack);
    [$team, $admin] = outgoingWebhookAdmin();
    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);

    $this->actingAs($admin)->postJson(route('teams.integrations.secret.store', [$team->workspace, $team, $slack]))->assertNotFound();
    $this->actingAs($admin)->getJson(route('teams.integrations.deliveries.index', [$team->workspace, $team, $slack]))->assertNotFound();
});

it('sends a signed test request that is not logged', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    Http::fake(['hooks.example.com/*' => Http::response('', 200)]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertJsonMissingPath('secret');

    Http::assertSent(fn (Request $request) => $request->header('X-Skrum-Event')[0] === 'webhook.test'
        && json_decode($request->body(), true)['data'] === ['message' => 'skrum is connected.']
        && outgoingWebhookSignatureIsValid($request));
    expect(IntegrationDelivery::query()->count())->toBe(0)
        ->and($integration->fresh()->last_checked_at)->not->toBeNull()
        ->and($integration->fresh()->last_delivery_succeeded_at)->toBeNull();
});

it('tests a disabled webhook without re-enabling it', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->reconnectRequired('Disabled after 10 failed deliveries in a row.')->create(['team_id' => $team->id]);
    Http::fake(['hooks.example.com/*' => Http::response('', 200)]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertJson(['status' => 'reconnect_required', 'lastError' => 'Disabled after 10 failed deliveries in a row.']);
});

it('reports a refused test', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    Http::fake(['hooks.example.com/*' => Http::response('', 404)]);

    $this->actingAs($admin)
        ->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $integration]))
        ->assertUnprocessable()
        ->assertJson(['message' => 'The receiver answered 404.']);

    expect($integration->fresh()->consecutive_failures)->toBe(0);
});

it('lists deliveries newest first, 25 per page', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);
    IntegrationDelivery::factory()->count(30)
        ->sequence(fn ($sequence) => ['created_at' => now()->subMinutes($sequence->index), 'event' => "event-{$sequence->index}"])
        ->create([
            'team_id' => $team->id,
            'channel' => IntegrationDeliveryChannel::Webhook,
            'kind' => IntegrationDeliveryKind::Event,
            'team_integration_id' => $integration->id,
            'attempts' => 2,
            'response_status' => 503,
            'requested_by_user_id' => null,
        ]);
    IntegrationDelivery::factory()->create(['team_id' => $team->id, 'channel' => IntegrationDeliveryChannel::Slack]);
    IntegrationDelivery::factory()->create(['channel' => IntegrationDeliveryChannel::Webhook]);
    $url = route('teams.integrations.deliveries.index', [$team->workspace, $team, $integration]);

    $this->actingAs($admin)->getJson($url)
        ->assertOk()
        ->assertJsonCount(25, 'data')
        ->assertJson([
            'currentPage' => 1,
            'lastPage' => 2,
            'total' => 30,
            'data' => [['event' => 'event-0', 'kind' => 'event', 'status' => 'queued', 'attempts' => 2, 'responseStatus' => 503, 'error' => null]],
        ]);

    $this->actingAs($admin)->getJson("{$url}?page=2")
        ->assertOk()
        ->assertJsonCount(5, 'data')
        ->assertJsonPath('data.4.event', 'event-29');
});

it('never serializes the URL or the secret on the integrations page', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);

    $this->actingAs($admin)
        ->get(route('teams.integrations.index', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/integrations')
            ->where('providers.0.provider', 'webhook')
            ->where('providers.0.label', 'Webhook')
            ->where('providers.0.connection.settings', [
                'host' => 'hooks.example.com',
                'channelLabel' => null,
                'secretCreatedAt' => '2026-10-01T09:00:00Z',
                'events' => [],
            ])
            ->where('providers.0.connection.webhook', ['consecutiveFailures' => 0, 'lastDeliverySucceededAt' => null])
            ->has('webhookEvents', 5)
            ->where('webhookEvents.0', ['name' => 'retro.completed', 'description' => 'A retrospective is completed, with its results recap.']))
        ->assertDontSee(TeamIntegrationFactory::WebhookSecret)
        ->assertDontSee('skrum/incoming');
});

it('disconnects without calling the receiver', function () {
    [$team, $admin] = outgoingWebhookAdmin();
    $integration = TeamIntegration::factory()->webhook()->create(['team_id' => $team->id]);

    $this->actingAs($admin)
        ->deleteJson(route('teams.integrations.destroy', [$team->workspace, $team, $integration]))
        ->assertNoContent();

    expect(TeamIntegration::query()->count())->toBe(0);
    Http::assertNothingSent();
});

it('re-validates stored URLs in the daily check without calling them', function () {
    config(['services.outgoing_webhooks.allow_http' => true]);
    $plain = TeamIntegration::factory()->webhook()->create([
        'credentials' => ['url' => 'http://hooks.example.com/in', 'webhookSecret' => TeamIntegrationFactory::WebhookSecret],
    ]);
    $secure = TeamIntegration::factory()->webhook()->create();
    config(['services.outgoing_webhooks.allow_http' => false]);
    $this->mock(HostResolver::class, fn (MockInterface $mock) => $mock->shouldNotReceive('addresses'));

    $this->artisan('skrum:check-integrations')->assertSuccessful();

    expect($plain->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($plain->fresh()->last_error)->toBe('This webhook URL is no longer allowed. Paste a new one.')
        ->and($secure->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and($secure->fresh()->last_checked_at)->not->toBeNull();
    Http::assertNothingSent();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ConnectOutgoingWebhookTest.php`
Expected: FAIL. Webhook posts get 404 (the route's `whereIn` excludes `webhook`), and `Route [teams.integrations.secret.store] not defined.`

- [ ] **Step 3: Add the event catalogue**

Create `app/Enums/WebhookEvent.php`:

```php
<?php

namespace App\Enums;

/**
 * The automatic events a generic webhook can subscribe to (spec 8 §4.7).
 */
enum WebhookEvent: string
{
    case RetroCompleted = 'retro.completed';
    case ActionItemCreated = 'action_item.created';
    case ActionItemCompleted = 'action_item.completed';
    case ActionItemReopened = 'action_item.reopened';
    case PokerTaskEstimated = 'poker.task.estimated';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(fn (self $event): string => $event->value, self::cases());
    }

    /**
     * Keeps known names once, in catalogue order.
     *
     * @param  array<array-key, mixed>  $names
     * @return array<int, string>
     */
    public static function normalize(array $names): array
    {
        return array_values(array_filter(self::values(), fn (string $name): bool => in_array($name, $names, true)));
    }

    /**
     * @return array<int, array{name: string, description: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $event): array => [
            'name' => $event->value,
            'description' => $event->description(),
        ], self::cases());
    }

    public function description(): string
    {
        return match ($this) {
            self::RetroCompleted => __('A retrospective is completed, with its results recap.'),
            self::ActionItemCreated => __('An action item is created.'),
            self::ActionItemCompleted => __('An action item is completed, in skrum or in a linked tracker.'),
            self::ActionItemReopened => __('An action item is reopened.'),
            self::PokerTaskEstimated => __('A planning poker task gets its final estimate.'),
        };
    }
}
```

- [ ] **Step 4: Implement the connection action**

Create `app/Actions/Integrations/ConnectOutgoingWebhook.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\WebhookEvent;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Rules\OutgoingWebhookUrl;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Webhook\WebhookHealth;
use Illuminate\Validation\Rule;

/**
 * A generic webhook: the URL and the signing secret are credentials; the
 * secret leaves the server only in the connect and rotate responses.
 */
class ConnectOutgoingWebhook
{
    private const SecretBytes = 32;

    public function __construct(
        private SaveTeamIntegration $saveTeamIntegration,
        private WebhookHealth $health,
    ) {}

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(bool $isUpdate = false): array
    {
        $url = ['required', 'string', 'max:2048', new OutgoingWebhookUrl];
        $rules = [
            'url' => $isUpdate ? ['bail', 'sometimes', ...$url] : ['bail', ...$url],
            'channel_label' => ['sometimes', 'nullable', 'string', 'max:'.ConnectUrlChannel::LabelMaxLength],
        ];

        if (! $isUpdate) {
            return $rules;
        }

        return [
            ...$rules,
            'events' => ['sometimes', 'array'],
            'events.*' => ['required', 'string', 'distinct', Rule::in(WebhookEvent::values())],
            'enabled' => ['sometimes', 'accepted'],
        ];
    }

    public function handle(Team $team, User $user, string $url, ?string $channelLabel): TeamIntegration
    {
        $integration = $this->saveTeamIntegration->handle($team, IntegrationProvider::Webhook, $user, [
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => ['url' => $url, 'webhookSecret' => self::newSecret()],
            'settings' => [
                'host' => self::host($url),
                'channelLabel' => self::label($channelLabel),
                'secretCreatedAt' => now()->toIso8601ZuluString(),
                'events' => [],
            ],
            'scopes' => [],
        ]);

        $integration->forceFill(['consecutive_failures' => 0, 'last_delivery_succeeded_at' => null])->save();

        return $integration;
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function update(TeamIntegration $integration, array $validated): TeamIntegration
    {
        $settings = $integration->settings;

        if (array_key_exists('channel_label', $validated)) {
            $settings['channelLabel'] = self::label(is_string($validated['channel_label']) ? $validated['channel_label'] : null);
        }

        if (is_array($validated['events'] ?? null)) {
            $settings['events'] = WebhookEvent::normalize($validated['events']);
        }

        $newUrl = is_string($validated['url'] ?? null) ? $validated['url'] : null;

        if ($newUrl !== null) {
            $integration->forceFill(['credentials' => [...$this->credentials($integration), 'url' => $newUrl]]);
            $settings['host'] = self::host($newUrl);
        }

        $integration->forceFill(['settings' => $settings])->save();

        $reactivate = $newUrl !== null || array_key_exists('enabled', $validated);

        if ($reactivate && ! $integration->isActive()) {
            $this->health->reenable($integration);
        }

        return $integration;
    }

    public function rotateSecret(TeamIntegration $integration): string
    {
        $secret = self::newSecret();

        $integration->forceFill([
            'credentials' => [...$this->credentials($integration), 'webhookSecret' => $secret],
            'settings' => [...$integration->settings, 'secretCreatedAt' => now()->toIso8601ZuluString()],
        ])->save();

        return $secret;
    }

    /**
     * @return array<string, mixed>
     */
    private function credentials(TeamIntegration $integration): array
    {
        return $integration->readableCredentials() ?? throw new ReconnectRequired(IntegrationProvider::Webhook, $integration->last_error);
    }

    private static function newSecret(): string
    {
        return bin2hex(random_bytes(self::SecretBytes));
    }

    private static function host(string $url): string
    {
        return strtolower((string) parse_url($url, PHP_URL_HOST));
    }

    private static function label(?string $label): ?string
    {
        $trimmed = trim((string) $label);

        return $trimmed === '' ? null : $trimmed;
    }
}
```

(`readableCredentials()` returns `array<string, mixed>|null` today; if phpstan reports another shape, adapt the docblock only.)

- [ ] **Step 5: Controllers, presenter and routes**

Replace `app/Http/Controllers/Integrations/IntegrationUrlsController.php` (14a's version plus the webhook branch):

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\ConnectOutgoingWebhook;
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
        ConnectOutgoingWebhook $connectOutgoingWebhook,
        PresentTeamIntegration $presentTeamIntegration,
    ): JsonResponse {
        Gate::authorize('manageIntegrations', $team);

        if ($provider === IntegrationProvider::Webhook) {
            $validated = $request->validate($connectOutgoingWebhook->rules());
            $integration = $connectOutgoingWebhook->handle($team, $request->user(), $validated['url'], $validated['channel_label'] ?? null);

            return response()->json([
                ...$presentTeamIntegration->handle($integration->load('connectedBy')),
                'secret' => $integration->credential('webhookSecret'),
            ], 201);
        }

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

`app/Http/Controllers/Integrations/WebhookSecretsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\ConnectOutgoingWebhook;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class WebhookSecretsController extends Controller
{
    public function store(Workspace $workspace, Team $team, TeamIntegration $integration, ConnectOutgoingWebhook $connectOutgoingWebhook): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        abort_unless($integration->provider === IntegrationProvider::Webhook, 404);

        return response()->json(['secret' => $connectOutgoingWebhook->rotateSecret($integration)]);
    }
}
```

`app/Actions/Integrations/PresentWebhookDelivery.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\IntegrationDelivery;

class PresentWebhookDelivery
{
    /**
     * @return array{
     *     id: string,
     *     event: string|null,
     *     kind: string,
     *     status: string,
     *     attempts: int,
     *     responseStatus: int|null,
     *     error: string|null,
     *     createdAt: string|null,
     *     lastAttemptAt: string|null
     * }
     */
    public function handle(IntegrationDelivery $delivery): array
    {
        return [
            'id' => $delivery->id,
            'event' => $delivery->event,
            'kind' => $delivery->kind->value,
            'status' => $delivery->status->value,
            'attempts' => $delivery->attempts,
            'responseStatus' => $delivery->response_status,
            'error' => $delivery->error,
            'createdAt' => $delivery->created_at?->toIso8601String(),
            'lastAttemptAt' => $delivery->last_attempt_at?->toIso8601String(),
        ];
    }
}
```

`app/Http/Controllers/Integrations/WebhookDeliveriesController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\PresentWebhookDelivery;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\IntegrationDelivery;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * The team's generic webhook log, across reconnections (spec 8 §4.7).
 */
class WebhookDeliveriesController extends Controller
{
    private const PerPage = 25;

    public function index(Workspace $workspace, Team $team, TeamIntegration $integration, PresentWebhookDelivery $presentWebhookDelivery): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        abort_unless($integration->provider === IntegrationProvider::Webhook, 404);

        $deliveries = IntegrationDelivery::query()
            ->where('team_id', $team->id)
            ->where('channel', IntegrationDeliveryChannel::Webhook->value)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(self::PerPage);

        return response()->json([
            'data' => array_map($presentWebhookDelivery->handle(...), $deliveries->items()),
            'currentPage' => $deliveries->currentPage(),
            'lastPage' => $deliveries->lastPage(),
            'total' => $deliveries->total(),
        ]);
    }
}
```

In `routes/web.php`, add the imports `WebhookDeliveriesController` and `WebhookSecretsController` (alphabetical). In the `teams.integrations.urls.store` route, change `->whereIn('provider', ['msteams', 'mattermost'])` to `->whereIn('provider', ['msteams', 'mattermost', 'webhook'])`. After the `teams.integrations.test.store` route, inside the same `EnsureIntegrationProviderEnabled` group, add:

```php
                Route::post('teams/{team}/integrations/{integration}/secret', [WebhookSecretsController::class, 'store'])
                    ->whereUuid('integration')
                    ->middleware('throttle:10,1,webhookSecrets')
                    ->name('teams.integrations.secret.store');
                Route::get('teams/{team}/integrations/{integration}/deliveries', [WebhookDeliveriesController::class, 'index'])
                    ->whereUuid('integration')
                    ->middleware('throttle:60,1,webhookDeliveries')
                    ->name('teams.integrations.deliveries.index');
```

- [ ] **Step 6: Wire update, presenter, page prop, test and daily check**

`UpdateTeamIntegration`:
- Add `private ConnectOutgoingWebhook $connectOutgoingWebhook,` to the constructor.
- In `rules()`, add the arm (before `default`):

  ```php
              IntegrationProvider::Webhook => $this->connectOutgoingWebhook->rules(isUpdate: true),
  ```

- At the top of `handle()`, next to 14a's Teams/Mattermost branch:

  ```php
          if ($integration->provider === IntegrationProvider::Webhook) {
              return $this->connectOutgoingWebhook->update($integration, $validated)->refresh();
          }
  ```

`PresentTeamIntegration`:
- Set `'webhook' => ['host', 'channelLabel', 'secretCreatedAt', 'events', 'disabledReason'],` in `SettingKeys`, replacing 14a's empty list.
- Add `'webhook' => $this->webhookHealth($integration),` after `'lastError'` in `handle()`, and extend the return docblock with `webhook: array{consecutiveFailures: int, lastDeliverySucceededAt: string|null}|null`.
- Add `use App\Enums\IntegrationProvider;` and:

  ```php
      /**
       * @return array{consecutiveFailures: int, lastDeliverySucceededAt: string|null}|null
       */
      private function webhookHealth(TeamIntegration $integration): ?array
      {
          if ($integration->provider !== IntegrationProvider::Webhook) {
              return null;
          }

          return [
              'consecutiveFailures' => $integration->consecutive_failures,
              'lastDeliverySucceededAt' => $integration->last_delivery_succeeded_at?->toIso8601String(),
          ];
      }
  ```

`TeamIntegrationsController::index()`: add `use App\Enums\WebhookEvent;` and the prop after 14a's `'mattermost'`:

```php
            'webhookEvents' => IntegrationProvider::Webhook->isEnabled() ? WebhookEvent::options() : null,
```

`IntegrationTestsController::store()`:
- Add the parameter `WebhookClient $webhooks` (import `App\Support\Integrations\Webhook\WebhookClient` and `App\Support\Integrations\Webhook\WebhookMessage`).
- Replace `$integration->ensureActive();` with:

  ```php
          if ($integration->provider !== IntegrationProvider::Webhook) {
              $integration->ensureActive();
          }
  ```

- In the `match`, remove `IntegrationProvider::Webhook` from 14a's throwing arm and add:

  ```php
              IntegrationProvider::Webhook => fn () => $webhooks->send($integration, WebhookMessage::test()),
  ```

- Change the `markChecked()` condition to `if ($integration->provider->isChannel() && $integration->isActive()) {` so a test on a disabled webhook keeps its `last_error`.

`CheckIntegration`: inject `private WebhookClient $webhooks`. Remove `IntegrationProvider::Webhook` from the throwing arm and add:

```php
            IntegrationProvider::Webhook => fn () => $this->webhooks->ensureUsableUrl($integration),
```

Then regenerate Wayfinder: `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 7: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `A retrospective is completed, with its results recap.` | `Une rétrospective est terminée, avec le récapitulatif de ses résultats.` | `Se completa una retrospectiva, con el resumen de sus resultados.` | `Eine Retrospektive wird abgeschlossen, mit der Zusammenfassung ihrer Ergebnisse.` |
| `An action item is created.` | `Une action à mener est créée.` | `Se crea una acción a realizar.` | `Ein Aktionspunkt wird erstellt.` |
| `An action item is completed, in skrum or in a linked tracker.` | `Une action à mener est terminée, dans skrum ou dans un outil de suivi lié.` | `Se completa una acción a realizar, en skrum o en un gestor de incidencias vinculado.` | `Ein Aktionspunkt wird erledigt, in skrum oder in einem verknüpften Tracker.` |
| `An action item is reopened.` | `Une action à mener est rouverte.` | `Se reabre una acción a realizar.` | `Ein Aktionspunkt wird wieder geöffnet.` |
| `A planning poker task gets its final estimate.` | `Une tâche de planning poker reçoit son estimation finale.` | `Una tarea de planning poker recibe su estimación final.` | `Eine Planning-Poker-Aufgabe erhält ihre endgültige Schätzung.` |

- [ ] **Step 8: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ConnectOutgoingWebhookTest.php tests/Feature/Integrations/ConnectUrlChannelTest.php tests/Feature/Integrations/IntegrationsPageTest.php tests/Feature/Integrations/IntegrationMaintenanceTest.php tests/Feature/Integrations/PriorityMappingTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS. Then run pint and phpstan (0 errors).

- [ ] **Step 9: Commit**

```bash
git add app/Enums/WebhookEvent.php app/Actions/Integrations/ConnectOutgoingWebhook.php app/Actions/Integrations/PresentWebhookDelivery.php app/Actions/Integrations/UpdateTeamIntegration.php app/Actions/Integrations/PresentTeamIntegration.php app/Actions/Integrations/CheckIntegration.php app/Http/Controllers/Integrations/IntegrationUrlsController.php app/Http/Controllers/Integrations/WebhookSecretsController.php app/Http/Controllers/Integrations/WebhookDeliveriesController.php app/Http/Controllers/Integrations/IntegrationTestsController.php app/Http/Controllers/Integrations/TeamIntegrationsController.php routes/web.php tests/Feature/Integrations/ConnectOutgoingWebhookTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): connect, configure, test and inspect generic webhooks

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 4: Share links, room invites and recaps to the webhook

**Files:**
- Create: `app/Jobs/Integrations/DeliverToWebhook.php`
- Modify:
  - `app/Support/Integrations/Messages/{ShareContent,LinkShareContent,RetroRecapContent}.php`
  - `app/Actions/Integrations/{BuildLinkShare,BuildRetroRecap,QueueShare}.php`
  - `app/Http/Controllers/Integrations/RetroSharesController.php`
  - `app/Jobs/Integrations/DeliverToChannel.php`
  - `tests/Pest.php`
- Test: create `tests/Feature/Integrations/WebhookSharesTest.php`

**Interfaces:**
- Consumes:
  - `WebhookClient`, `WebhookHealth`, `WebhookMessage`, `WebhookDisabled` (Task 2)
  - the share controllers of Plans 12b/13d: they validate `channel` against `shareChannels()`, which already includes `webhook`, and answer 404 on a disabled provider
  - `ShareOptions` (14a, already five channels)
- Produces:
  - `ShareContent::toWebhook(): array`
  - `LinkShareContent(…, array $webhookData = [])` and `RetroRecapContent(RetroRecap $recap, array $webhookData = [])`
  - `BuildRetroRecap::content(Retro): RetroRecapContent`
  - `DeliverToWebhook(string $deliveryId, string $event, string $occurredAt, array $data, string $locale)`
  - the `DeliverToChannel` hooks of the Contract
  - Pest helpers `runOutgoingWebhookJob(DeliverToChannel $job): DeliverToChannel` and `webhookTopCard(Retro, Participant $author, Participant $voter): void`

- [ ] **Step 1: Add the job and top-card helpers**

In `tests/Pest.php`, add `use App\Jobs\Integrations\DeliverToChannel;`, `use App\Models\Card;`, `use App\Models\Column;` and `use App\Models\Vote;` if missing (`Participant` and `Retro` are already imported). After `outgoingWebhookSignatureIsValid()`, add both helpers; Task 5's events test uses the top-card helper too:

```php
function runOutgoingWebhookJob(DeliverToChannel $job): DeliverToChannel
{
    $job->withFakeQueueInteractions();
    $job->handle();

    return $job;
}

/**
 * One voted card "Faster reviews" in a "Wins" column, written by $author.
 */
function webhookTopCard(Retro $retro, Participant $author, Participant $voter): void
{
    $column = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Wins']);
    $card = Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => 'Faster reviews',
    ]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $voter->id]);
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Integrations/WebhookSharesTest.php`:

```php
<?php

use App\Actions\Integrations\ShareOptions;
use App\Enums\ActionItemPriority;
use App\Enums\GameKind;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoomChanged;
use App\Jobs\Integrations\DeliverToWebhook;
use App\Models\ActionItem;
use App\Models\GameRoom;
use App\Models\IntegrationDelivery;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::Webhook);
    outgoingWebhookResolves();
});

/**
 * @return array{0: Retro, 1: User, 2: Participant}
 */
function webhookSharingRetro(RetroPhase $phase = RetroPhase::Discussing, bool $anonymous = false): array
{
    $factory = Retro::factory()->inPhase($phase);
    $retro = ($anonymous ? $factory->anonymous() : $factory)->create([
        'title' => 'Sprint 42',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
    ]);
    TeamIntegration::factory()->webhook()->create(['team_id' => $retro->team_id]);
    [$facilitator, $participant] = retroFacilitator($retro);
    $facilitator->forceFill(['name' => 'Fran Facilitator'])->save();

    return [$retro, $facilitator, $participant];
}

/**
 * @return array{0: GameRoom, 1: User}
 */
function webhookSharingRoom(array $attributes = []): array
{
    $room = GameRoom::factory()->create([
        'name' => 'Friday fun',
        'game' => GameKind::Hangman,
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    TeamIntegration::factory()->webhook()->create(['team_id' => $room->team_id]);
    [$host] = gameRoomHost($room);
    $host->forceFill(['name' => 'Hana Host'])->save();

    return [$room, $host];
}

it('queues a board link as retro.link', function () {
    [$retro, $facilitator] = webhookSharingRetro();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'webhook', 'kind' => 'link'])
        ->assertAccepted()
        ->assertJson(['channel' => 'webhook', 'kind' => 'retro_link', 'status' => 'queued']);

    $delivery = IntegrationDelivery::query()->sole();

    expect($delivery->event)->toBe('retro.link')
        ->and($delivery->team_integration_id)->toBe(TeamIntegration::query()->sole()->id);
    Queue::assertPushed(DeliverToWebhook::class, fn (DeliverToWebhook $job) => $job->deliveryId === $delivery->id
        && $job->event === 'retro.link'
        && $job->data === ['title' => 'Sprint 42', 'url' => route('retros.show', $retro), 'sharedBy' => 'Fran Facilitator']);
});

it('queues the results recap as structured fields without card authors', function () {
    [$retro, $facilitator, $facilitatorParticipant] = webhookSharingRetro(RetroPhase::Completed, anonymous: true);
    [$ada] = retroMember($retro);
    $ada->forceFill(['name' => 'Ada Assignee'])->save();
    [$carla, $carlaParticipant] = retroMember($retro);
    $carla->forceFill(['name' => 'Carla Author'])->save();
    webhookTopCard($retro, $carlaParticipant, $facilitatorParticipant);
    ActionItem::factory()->assignedTo($ada)->priority(ActionItemPriority::High)->create([
        'retro_id' => $retro->id,
        'content' => 'Fix the deploy',
        'due_on' => '2026-10-15',
        'created_by_participant_id' => $facilitatorParticipant->id,
        'created_by_user_id' => $facilitator->id,
    ]);

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'webhook', 'kind' => 'results'])
        ->assertAccepted()
        ->assertJson(['kind' => 'retro_results']);

    Queue::assertPushed(DeliverToWebhook::class, function (DeliverToWebhook $job) use ($retro) {
        $data = $job->data;

        return $job->event === 'retro.results'
            && $data['title'] === 'Sprint 42'
            && $data['url'] === route('retros.show', $retro)
            && is_string($data['completedAt'])
            && $data['participants'] === ['count' => 3, 'names' => null]
            && $data['cardCount'] === 1
            && $data['roti'] === null
            && $data['summary'] === null
            && $data['actionItems'] === [['content' => 'Fix the deploy', 'assignee' => 'Ada Assignee', 'dueOn' => '2026-10-15', 'priority' => 'high', 'isCompleted' => false]]
            && $data['moreActionItems'] === 0
            && $data['suggestedActions'] === []
            && $data['topCards'] === [['column' => 'Wins', 'content' => 'Faster reviews', 'votes' => 1, 'groupedCount' => 0]]
            && ! str_contains((string) json_encode($data), 'Carla Author');
    });
});

it('names participants on a named retro recap', function () {
    [$retro, $facilitator] = webhookSharingRetro(RetroPhase::Completed);
    [$ada] = retroMember($retro);
    $ada->forceFill(['name' => 'Ada Assignee'])->save();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'webhook', 'kind' => 'results'])
        ->assertAccepted();

    Queue::assertPushed(DeliverToWebhook::class, fn (DeliverToWebhook $job) => $job->data['participants'] === [
        'count' => 2,
        'names' => ['Ada Assignee', 'Fran Facilitator'],
    ]);
});

it('queues poker links as poker.link', function () {
    $game = PokerGame::factory()->create(['title' => 'Sprint 12 sizing']);
    TeamIntegration::factory()->webhook()->create(['team_id' => $game->team_id]);
    [$facilitator] = pokerFacilitator($game);

    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'webhook'])
        ->assertAccepted()
        ->assertJson(['kind' => 'poker_link']);

    Queue::assertPushed(DeliverToWebhook::class, fn (DeliverToWebhook $job) => $job->event === 'poker.link'
        && $job->data === ['title' => 'Sprint 12 sizing', 'url' => route('poker.show', $game), 'sharedBy' => $facilitator->name]);
});

it('queues game room invites as game_room.link without players or game state', function () {
    [$room, $host] = webhookSharingRoom(['access' => 'link']);
    [$player] = gameRoomMember($room);
    $player->forceFill(['name' => 'Pat Player'])->save();
    activeGameRound($room, ['word' => 'sprint']);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'webhook'])
        ->assertAccepted()
        ->assertJson(['channel' => 'webhook', 'kind' => 'game_room_link']);
    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'webhook', 'include_guest_link' => true])
        ->assertAccepted();

    $jobs = Queue::pushed(DeliverToWebhook::class)->values();

    expect($jobs)->toHaveCount(2)
        ->and($jobs[0]->event)->toBe('game_room.link')
        ->and($jobs[0]->data)->toBe([
            'title' => 'Friday fun',
            'game' => 'Hangman',
            'team' => 'Platform',
            'url' => route('games.show', $room),
            'sharedBy' => 'Hana Host',
        ])
        ->and($jobs[1]->data['url'])->toBe(route('games.join.show', $room->guest_token))
        ->and(json_encode($jobs->map->data->all()))->not->toContain('Pat Player')
        ->and(json_encode($jobs->map->data->all()))->not->toContain('sprint');
});

it('answers 404, 409 and 422 for webhook room invites', function () {
    [$room, $host] = webhookSharingRoom();

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'webhook', 'include_guest_link' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['include_guest_link' => 'Guest access is off for this room.']);

    TeamIntegration::query()->update(['status' => IntegrationStatus::ReconnectRequired->value]);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'webhook'])
        ->assertConflict()
        ->assertJson(['message' => 'Reconnect Webhook in the team settings.']);

    TeamIntegration::query()->delete();

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'webhook'])
        ->assertConflict()
        ->assertJson(['message' => 'Connect Webhook in the team settings.']);

    disableIntegrations();

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'webhook'])
        ->assertNotFound();

    Queue::assertNothingPushed();
    expect(IntegrationDelivery::query()->count())->toBe(0);
});

it('refuses guests and non-managers before validating', function () {
    [$room] = webhookSharingRoom(['access' => 'link']);
    [$member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $this->actingAs($member)
        ->postJson(route('games.shares.store', $room), ['channel' => 'bogus'])
        ->assertForbidden();

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))->withCredentials()
        ->postJson(route('games.shares.store', $room), ['channel' => 'webhook'])
        ->assertForbidden();

    Queue::assertNothingPushed();
});

it('offers the webhook channel once it is connected', function () {
    [$retro] = webhookSharingRetro();

    expect(app(ShareOptions::class)->channels($retro->team)['webhook'])->toBeTrue();

    config(['services.outgoing_webhooks.enabled' => false]);

    expect(app(ShareOptions::class)->channels($retro->fresh()->team)['webhook'])->toBeFalse();
});

it('delivers a signed share and tells the room', function () {
    Event::fake([GameRoomChanged::class]);
    Http::fake(['hooks.example.com/*' => Http::response('', 202)]);
    [$room] = webhookSharingRoom();
    $delivery = IntegrationDelivery::factory()->forSubject($room)->create([
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::GameRoomLink,
        'event' => 'game_room.link',
    ]);
    $data = ['title' => 'Friday fun', 'game' => 'Hangman', 'team' => 'Platform', 'url' => route('games.show', $room), 'sharedBy' => 'Hana Host'];

    runOutgoingWebhookJob(new DeliverToWebhook($delivery->id, 'game_room.link', '2026-10-07T10:00:00Z', $data, 'en'))
        ->assertNotFailed()
        ->assertNotReleased();

    Http::assertSent(fn (Request $request) => $request->header('X-Skrum-Event')[0] === 'game_room.link'
        && $request->header('X-Skrum-Delivery')[0] === $delivery->id
        && outgoingWebhookSignatureIsValid($request)
        && json_decode($request->body(), true)['id'] === $delivery->id
        && json_decode($request->body(), true)['occurredAt'] === '2026-10-07T10:00:00Z'
        && json_decode($request->body(), true)['data'] === $data);
    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Sent)
        ->and($delivery->fresh()->attempts)->toBe(1)
        ->and($delivery->fresh()->response_status)->toBe(202);
    Event::assertDispatched(GameRoomChanged::class);
});

it('fails a share the receiver refuses and counts it', function () {
    Http::fake(['hooks.example.com/*' => Http::response('', 404)]);
    [$room] = webhookSharingRoom();
    $delivery = IntegrationDelivery::factory()->forSubject($room)->create([
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::GameRoomLink,
        'event' => 'game_room.link',
    ]);

    runOutgoingWebhookJob(new DeliverToWebhook($delivery->id, 'game_room.link', '2026-10-07T10:00:00Z', ['title' => 'Friday fun'], 'en'))
        ->assertFailed();

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($delivery->fresh()->error)->toBe('The receiver answered 404.')
        ->and($delivery->fresh()->response_status)->toBe(404)
        ->and(TeamIntegration::query()->sole()->consecutive_failures)->toBe(1);
});

it('waits for Retry-After on 429, retries outages and counts the final failure', function () {
    Http::fakeSequence('hooks.example.com/*')
        ->push('', 429, ['Retry-After' => '12'])
        ->push('', 503);
    [$room] = webhookSharingRoom();
    $delivery = IntegrationDelivery::factory()->forSubject($room)->create([
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::GameRoomLink,
        'event' => 'game_room.link',
    ]);
    $job = fn () => new DeliverToWebhook($delivery->id, 'game_room.link', '2026-10-07T10:00:00Z', ['title' => 'Friday fun'], 'en');

    runOutgoingWebhookJob($job())->assertReleased(delay: 12);

    $exception = null;

    try {
        runOutgoingWebhookJob($job());
    } catch (ProviderUnavailable $thrown) {
        $exception = $thrown;
    }

    expect($exception)->not->toBeNull()
        ->and($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Queued)
        ->and($delivery->fresh()->attempts)->toBe(2);

    $job()->failed($exception);

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and(TeamIntegration::query()->sole()->consecutive_failures)->toBe(1);
});

it('fails queued shares of a disabled webhook without counting them', function () {
    [$room] = webhookSharingRoom();
    TeamIntegration::query()->update(['status' => IntegrationStatus::ReconnectRequired->value, 'consecutive_failures' => 10]);
    $delivery = IntegrationDelivery::factory()->forSubject($room)->create([
        'channel' => IntegrationDeliveryChannel::Webhook,
        'kind' => IntegrationDeliveryKind::GameRoomLink,
        'event' => 'game_room.link',
    ]);

    runOutgoingWebhookJob(new DeliverToWebhook($delivery->id, 'game_room.link', '2026-10-07T10:00:00Z', ['title' => 'Friday fun'], 'en'))
        ->assertFailed();

    Http::assertNothingSent();
    expect($delivery->fresh()->error)->toBe('Webhook disabled.')
        ->and(TeamIntegration::query()->sole()->consecutive_failures)->toBe(10);
});

it('keeps the URL and the secret out of the job payload', function () {
    [$room, $host] = webhookSharingRoom();

    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'webhook'])->assertAccepted();

    Queue::assertPushed(DeliverToWebhook::class, fn (DeliverToWebhook $job) => ! str_contains(serialize($job), TeamIntegrationFactory::WebhookSecret)
        && ! str_contains(serialize($job), 'skrum/incoming'));
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookSharesTest.php`
Expected: FAIL. The job class is missing: `Class "App\Jobs\Integrations\DeliverToWebhook" not found`, or `webhook is not a share channel.`

- [ ] **Step 4: Give share contents a webhook form**

In `app/Support/Integrations/Messages/ShareContent.php`, add:

```php
    /**
     * The `data` object of a generic webhook body (spec 8 §4.5).
     *
     * @return array<string, mixed>
     */
    public function toWebhook(): array;
```

In `LinkShareContent`, extend the constructor and add the method:

```php
    /**
     * @param  array<string, mixed>  $webhookData
     */
    public function __construct(
        public string $text,
        public string $buttonLabel,
        public string $url,
        public array $webhookData = [],
    ) {}

    public function toWebhook(): array
    {
        return $this->webhookData;
    }
```

In `RetroRecapContent`, replace the constructor and add the method:

```php
    /**
     * @param  array<string, mixed>  $webhookData
     */
    public function __construct(public RetroRecap $recap, public array $webhookData = []) {}

    public function toWebhook(): array
    {
        return $this->webhookData;
    }
```

- [ ] **Step 5: Build the webhook data once**

`BuildLinkShare`: compute the URL first and pass the data. The three methods become:

```php
    public function retro(Retro $retro, User $sharer, bool $includeGuestLink): LinkShareContent
    {
        $url = $includeGuestLink ? route('retros.join.show', $retro->guest_token) : route('retros.show', $retro);

        return new LinkShareContent(
            __(':sharer invites you to the retrospective ":title" (:team)', [
                'sharer' => $sharer->name,
                'title' => $retro->title,
                'team' => $retro->team->name,
            ]),
            __('Open the retrospective'),
            $url,
            ['title' => $retro->title, 'url' => $url, 'sharedBy' => $sharer->name],
        );
    }

    public function pokerGame(PokerGame $game, User $sharer, bool $includeGuestLink): LinkShareContent
    {
        $url = $includeGuestLink ? route('poker.join.show', $game->guest_token) : route('poker.show', $game);

        return new LinkShareContent(
            __(':sharer invites you to the planning poker game ":title" (:team)', [
                'sharer' => $sharer->name,
                'title' => $game->title,
                'team' => $game->team->name,
            ]),
            __('Open the game'),
            $url,
            ['title' => $game->title, 'url' => $url, 'sharedBy' => $sharer->name],
        );
    }

    /**
     * A room invite names the room, its game and team, never the players or
     * the game state (spec 7 §3.1).
     */
    public function gameRoom(GameRoom $room, User $sharer, bool $includeGuestLink): LinkShareContent
    {
        $url = $includeGuestLink ? route('games.join.show', $room->guest_token) : route('games.show', $room);

        return new LinkShareContent(
            __(':sharer invites you to play :game in ":room" (:team)', [
                'sharer' => $sharer->name,
                'game' => $room->game->label(),
                'room' => (string) $room->name,
                'team' => $room->team->name,
            ]),
            __('Join the game'),
            $url,
            [
                'title' => (string) $room->name,
                'game' => $room->game->label(),
                'team' => $room->team->name,
                'url' => $url,
                'sharedBy' => $sharer->name,
            ],
        );
    }
```

`BuildRetroRecap`: add `use App\Support\Integrations\Messages\RetroRecapContent;`. Split the query of `actionItems()` into `sortedActionItems()`, and add `content()` and `webhookData()`:

```php
    /**
     * The recap for every channel, with the structured form the generic
     * webhook sends (spec 8 §4.5), from one read of the retro.
     */
    public function content(Retro $retro): RetroRecapContent
    {
        $recap = $this->handle($retro);

        return new RetroRecapContent($recap, $this->webhookData($retro, $recap));
    }

    /**
     * @return Collection<int, ActionItem>
     */
    private function sortedActionItems(Retro $retro): Collection
    {
        return $retro->actionItems()
            ->with(['assigneeUser', 'assigneeParticipant.user'])
            ->get()
            ->sortBy([
                fn (ActionItem $first, ActionItem $second): int => $first->isCompleted() <=> $second->isCompleted(),
                fn (ActionItem $first, ActionItem $second): int => $first->priority->sortWeight() <=> $second->priority->sortWeight(),
                fn (ActionItem $first, ActionItem $second): int => $first->created_at <=> $second->created_at,
            ])
            ->values();
    }

    /**
     * @return Collection<int, array{content: string, assignee: ?string, dueOn: ?string, isCompleted: bool}>
     */
    private function actionItems(Retro $retro): Collection
    {
        return $this->sortedActionItems($retro)
            ->map(fn (ActionItem $item): array => [
                'content' => Str::squish($item->content),
                'assignee' => $this->assignee($item),
                'dueOn' => $item->due_on === null ? null : $this->date($item->due_on),
                'isCompleted' => $item->isCompleted(),
            ])
            ->values();
    }

    /**
     * @return array<string, mixed>
     */
    private function webhookData(Retro $retro, RetroRecap $recap): array
    {
        $actionItems = $this->sortedActionItems($retro);

        return [
            'title' => $recap->title,
            'url' => $recap->url,
            'completedAt' => ($retro->completed_at ?? now())->toIso8601ZuluString(),
            'participants' => ['count' => $recap->participantCount, 'names' => $recap->participantNames],
            'cardCount' => $recap->cardCount,
            'roti' => $recap->rotiAverage === null ? null : [
                'average' => round($recap->rotiAverage, 1),
                'respondents' => $recap->rotiRespondents,
            ],
            'summary' => $recap->summary,
            'actionItems' => $actionItems->take(self::ActionItemLimit)
                ->map(fn (ActionItem $item): array => [
                    'content' => Str::squish($item->content),
                    'assignee' => $this->assignee($item),
                    'dueOn' => $item->due_on?->toDateString(),
                    'priority' => $item->priority->value,
                    'isCompleted' => $item->isCompleted(),
                ])
                ->values()
                ->all(),
            'moreActionItems' => max(0, $actionItems->count() - self::ActionItemLimit),
            'suggestedActions' => $recap->suggestedActions,
            'topCards' => $recap->topCards,
        ];
    }
```

(`handle()` keeps calling `actionItems()`; its behaviour and `RetroRecapTest` are unchanged. If phpstan cannot see `sortBy()` keep the Eloquent collection type, type the helper's return as `\Illuminate\Support\Collection<int, ActionItem>`.)

In `RetroSharesController::store()`, replace `new RetroRecapContent($this->buildRetroRecap->handle($retro))` with `$this->buildRetroRecap->content($retro)`, and remove the now-unused `RetroRecapContent` import.

- [ ] **Step 6: Queue webhook shares**

`QueueShare::handle()`:
- Keep the integration returned by `requireIntegration()`:

  ```php
          $integration = $this->requireIntegration($team, $provider);
  ```

- Add these two lines to the `IntegrationDelivery::query()->create([...])` attributes, after `'kind' => $kind,`:

  ```php
              'team_integration_id' => $integration->id,
              'event' => $provider === IntegrationProvider::Webhook ? $this->webhookEvent($kind) : null,
  ```

- Add the arm before `default`:

  ```php
              IntegrationProvider::Webhook => new DeliverToWebhook($delivery->id, (string) $delivery->event, now()->toIso8601ZuluString(), $content->toWebhook(), $locale),
  ```

- Add the helper, and import `App\Jobs\Integrations\DeliverToWebhook`:

  ```php
      private function webhookEvent(IntegrationDeliveryKind $kind): string
      {
          return match ($kind) {
              IntegrationDeliveryKind::RetroLink => 'retro.link',
              IntegrationDeliveryKind::PokerLink => 'poker.link',
              IntegrationDeliveryKind::RetroResults => 'retro.results',
              IntegrationDeliveryKind::GameRoomLink => 'game_room.link',
              IntegrationDeliveryKind::Event => throw new InvalidArgumentException('Automatic events are not shares.'),
          };
      }
  ```

`DeliverToChannel`:
- Change `private function integration(` and `private function announce(` to `protected function`.
- Add `$this->afterFailure($delivery, $exception);` as the last line of `finishFailed()`.
- Add the hook:

  ```php
      /**
       * Runs once a delivery ended failed, after the subject was told.
       */
      protected function afterFailure(IntegrationDelivery $delivery, ?Throwable $exception): void {}
  ```

Create `app/Jobs/Integrations/DeliverToWebhook.php`:

```php
<?php

namespace App\Jobs\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\IntegrationDelivery;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\WebhookDisabled;
use App\Support\Integrations\Webhook\WebhookClient;
use App\Support\Integrations\Webhook\WebhookHealth;
use App\Support\Integrations\Webhook\WebhookMessage;
use Throwable;

/**
 * Posts one pre-built webhook body; the URL and secret are read from the
 * database at run time. A delivery that ends failed while the webhook is
 * active counts toward the automatic disabling (spec 8 §4.7).
 */
class DeliverToWebhook extends DeliverToChannel
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(
        string $deliveryId,
        public string $event,
        public string $occurredAt,
        public array $data,
        string $locale,
    ) {
        parent::__construct($deliveryId, $locale);
    }

    protected function provider(): IntegrationProvider
    {
        return IntegrationProvider::Webhook;
    }

    protected function integration(IntegrationDelivery $delivery): TeamIntegration
    {
        $integration = IntegrationProvider::Webhook->isEnabled() ? $delivery->team->integration(IntegrationProvider::Webhook) : null;

        if ($integration === null) {
            throw new NotConnected(IntegrationProvider::Webhook);
        }

        if (! $integration->isActive()) {
            throw new WebhookDisabled;
        }

        return $integration;
    }

    protected function send(TeamIntegration $integration): void
    {
        app(WebhookClient::class)->send(
            $integration,
            new WebhookMessage($this->deliveryId, $this->event, $this->occurredAt, $this->data),
            IntegrationDelivery::query()->findOrFail($this->deliveryId),
        );
    }

    protected function afterFailure(IntegrationDelivery $delivery, ?Throwable $exception): void
    {
        if ($exception instanceof NotConnected || $exception instanceof WebhookDisabled) {
            return;
        }

        $integration = $delivery->team->integration(IntegrationProvider::Webhook);

        if ($integration === null) {
            return;
        }

        app(WebhookHealth::class)->failed($integration);
    }
}
```

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookSharesTest.php tests/Feature/Integrations/ChatChannelSharesTest.php tests/Feature/Integrations/ChatMessageFormattingTest.php tests/Feature/Integrations/RecapFormattingTest.php tests/Feature/Integrations/RetroRecapTest.php tests/Feature/Integrations/RetroSharesTest.php tests/Feature/Integrations/PokerSharesTest.php tests/Feature/Integrations/QueueShareTest.php tests/Feature/Integrations/DeliveryJobsTest.php tests/Feature/Games/GameRoomSharesTest.php tests/Feature/Integrations/ShareSnapshotTest.php`
Expected: PASS. Then run pint and phpstan (0 errors).

- [ ] **Step 8: Commit**

```bash
git add app/Jobs/Integrations/DeliverToWebhook.php app/Jobs/Integrations/DeliverToChannel.php app/Support/Integrations/Messages/ShareContent.php app/Support/Integrations/Messages/LinkShareContent.php app/Support/Integrations/Messages/RetroRecapContent.php app/Actions/Integrations/BuildLinkShare.php app/Actions/Integrations/BuildRetroRecap.php app/Actions/Integrations/QueueShare.php app/Http/Controllers/Integrations/RetroSharesController.php tests/Pest.php tests/Feature/Integrations/WebhookSharesTest.php
git commit -m "feat(integrations): share links, room invites and recaps to generic webhooks

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 5: Automatic events for subscribed webhooks

**Files:**
- Create: `app/Actions/Integrations/BuildWebhookEventData.php`, `app/Listeners/QueueWebhookEvents.php`, `app/Jobs/Integrations/DeliverWebhookEvent.php`
- Modify: `app/Events/ActionItems/{ActionItemCompleted,ActionItemReopened}.php`, `app/Actions/ActionItems/SetActionItemStatus.php`, `app/Providers/AppServiceProvider.php`
- Test: create `tests/Feature/Integrations/WebhookEventsTest.php`

**Interfaces:**
- Consumes:
  - the existing after-commit events `RetroCompleted` (from `ChangeRetroPhase`), `ActionItemCreated` (from `CreateActionItem`), `ActionItemCompleted` / `ActionItemReopened` (from `SetActionItemStatus`) and `PokerTaskEstimated` (from `SetPokerEstimate`, set or changed only)
  - `BuildRetroRecap::content()` (Task 4), `DeliverToWebhook` (Task 4), `WebhookEvent` (Task 3)
- Produces:
  - `BuildWebhookEventData::{retroCompleted, actionItemCreated, actionItemStatusChanged, pokerTaskEstimated}`
  - `QueueWebhookEvents` (Contract)
  - `DeliverWebhookEvent` (7 tries, backoff `[30, 120, 600, 1800, 3600, 7200]`)
  - the `actor` on status events

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/WebhookEventsTest.php`:

```php
<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\CreateActionItem;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Actions\Retros\ChangeRetroPhase;
use App\Enums\ActionItemStatus;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\PokerRevealReason;
use App\Enums\RetroPhase;
use App\Enums\WebhookEvent;
use App\Events\ActionItems\ActionItemAssigned;
use App\Jobs\Integrations\DeliverToMattermost;
use App\Jobs\Integrations\DeliverToMicrosoftTeams;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverWebhookEvent;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\IntegrationDelivery;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Webhook\WebhookHealth;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::Webhook);
    outgoingWebhookResolves();
});

/**
 * @param  array<int, string>|null  $events
 */
function subscribedWebhook(Team $team, ?array $events = null): TeamIntegration
{
    return TeamIntegration::factory()->webhook($events ?? WebhookEvent::values())->create(['team_id' => $team->id]);
}

/**
 * @return Collection<int, DeliverWebhookEvent>
 */
function pushedWebhookEvents(): Collection
{
    return Queue::pushed(DeliverWebhookEvent::class)->values();
}

/**
 * @return array{0: Retro, 1: User, 2: Participant}
 */
function webhookEventRetro(RetroPhase $phase = RetroPhase::Discussing, bool $anonymous = false): array
{
    $factory = Retro::factory()->inPhase($phase);
    $retro = ($anonymous ? $factory->anonymous() : $factory)->create([
        'title' => 'Sprint 42',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
    ]);
    [$facilitator, $participant] = retroFacilitator($retro);
    $facilitator->forceFill(['name' => 'Fran Facilitator'])->save();

    return [$retro, $facilitator, $participant];
}

/**
 * @return array<string, mixed>
 */
function webhookEstimateTable(): array
{
    $table = pokerRevealTable();
    pokerVote($table['round'], $table['facilitatorPlayer'], '5');
    pokerVote($table['round'], $table['memberPlayer'], '8');
    $table['round']->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);
    $table['task'] = $table['round']->task;
    $table['task']->forceFill([
        'title' => 'Login page',
        'external_source' => 'jira',
        'external_key' => 'PROJ-7',
        'external_url' => 'https://acme.atlassian.net/browse/PROJ-7',
    ])->save();
    $table['member']->forceFill(['name' => 'Milo Member'])->save();

    return $table;
}

it('sends nothing without a subscription', function () {
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, []);

    app(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Fix the deploy']);

    Queue::assertNotPushed(DeliverWebhookEvent::class);
    expect(IntegrationDelivery::query()->count())->toBe(0);
});

it('sends action_item.created while the retro is still in Writing, with the item named', function () {
    [$retro, $facilitator, $participant] = webhookEventRetro(RetroPhase::Writing, anonymous: true);
    subscribedWebhook($retro->team, ['action_item.created']);
    [$ada] = retroMember($retro);
    $ada->forceFill(['name' => 'Ada Assignee'])->save();

    $item = app(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), [
        'content' => 'Fix the deploy',
        'priority' => 'high',
        'due_on' => '2026-10-15',
        'assignee_user_id' => $ada->id,
    ]);

    $job = pushedWebhookEvents()->sole();
    $delivery = IntegrationDelivery::query()->sole();

    expect($delivery->kind)->toBe(IntegrationDeliveryKind::Event)
        ->and($delivery->event)->toBe('action_item.created')
        ->and($delivery->subject_id)->toBe($item->id)
        ->and($delivery->requested_by_user_id)->toBeNull()
        ->and($delivery->status)->toBe(IntegrationDeliveryStatus::Queued)
        ->and($job->deliveryId)->toBe($delivery->id)
        ->and($job->event)->toBe('action_item.created')
        ->and($job->data)->toBe(['actionItem' => [
            'id' => $item->id,
            'content' => 'Fix the deploy',
            'status' => 'open',
            'assignee' => ['name' => 'Ada Assignee'],
            'createdBy' => ['name' => 'Fran Facilitator'],
            'completedBy' => null,
            'dueOn' => '2026-10-15',
            'priority' => 'high',
            'completedAt' => null,
            'url' => route('workspaces.actionItems.index', ['workspace' => $retro->team->workspace, 'team' => $retro->team_id, 'item' => $item->id]),
            'retro' => ['id' => $retro->id, 'title' => 'Sprint 42', 'url' => route('retros.show', $retro)],
            'themeName' => null,
            'createdAt' => $item->created_at?->toIso8601ZuluString(),
        ]])
        ->and(json_encode($job->data))->not->toContain($facilitator->email)
        ->and(json_encode($job->data))->not->toContain($ada->email);
});

it('sends action_item.completed and action_item.reopened with origin and actor', function () {
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.completed', 'action_item.reopened']);
    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Fix the deploy',
        'created_by_participant_id' => $participant->id,
        'created_by_user_id' => $participant->user_id,
    ]);
    ActionItemComment::factory()->create(['action_item_id' => $item->id, 'content' => 'Secret discussion']);
    $actor = ActionItemActor::forParticipant($participant);

    app(SetActionItemStatus::class)->handle($item, $actor, ActionItemStatus::Completed);
    app(SetActionItemStatus::class)->handle($item->fresh(), $actor, ActionItemStatus::Open);
    app(SetActionItemStatus::class)->handle($item->fresh(), new ExternalSyncActor('jira', 'PROJ-12'), ActionItemStatus::Completed);

    [$completed, $reopened, $external] = pushedWebhookEvents()->all();

    expect($completed->event)->toBe('action_item.completed')
        ->and($completed->data['origin'])->toBe('skrum')
        ->and($completed->data['completedVia'])->toBeNull()
        ->and($completed->data['actionItem']['status'])->toBe('completed')
        ->and($completed->data['actionItem']['completedBy'])->toBe(['name' => 'Fran Facilitator'])
        ->and($completed->data['actionItem']['completedAt'])->not->toBeNull()
        ->and($reopened->event)->toBe('action_item.reopened')
        ->and($reopened->data['origin'])->toBe('skrum')
        ->and($reopened->data['actionItem']['status'])->toBe('open')
        ->and($reopened->data['actionItem']['completedBy'])->toBeNull()
        ->and($external->event)->toBe('action_item.completed')
        ->and($external->data['origin'])->toBe('external')
        ->and($external->data['completedVia'])->toBe(['source' => 'jira', 'key' => 'PROJ-12'])
        ->and($external->data['actionItem']['completedBy'])->toBeNull()
        ->and(json_encode(pushedWebhookEvents()->map->data->all()))->not->toContain('Secret discussion');
});

it('hides guest actors but still sends their events', function () {
    [$retro] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.created', 'action_item.completed']);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Gus']);

    $created = app(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($guest), ['content' => 'Guest idea']);
    $assigned = ActionItem::factory()->assignedToGuest($guest)->create(['content' => 'Guest task']);
    app(SetActionItemStatus::class)->handle($assigned, ActionItemActor::forParticipant($guest), ActionItemStatus::Completed);

    [$createdJob, $completedJob] = pushedWebhookEvents()->all();

    expect($createdJob->data['actionItem']['id'])->toBe($created->id)
        ->and($createdJob->data['actionItem']['createdBy'])->toBeNull()
        ->and($completedJob->data['actionItem']['id'])->toBe($assigned->id)
        ->and($completedJob->data['actionItem']['completedBy'])->toBeNull()
        ->and($completedJob->data['actionItem']['assignee'])->toBe(['name' => 'Gus']);
});

it('sends retro.completed on each completion with the recap rules', function () {
    [$retro, , $facilitatorParticipant] = webhookEventRetro(anonymous: true);
    subscribedWebhook($retro->team, ['retro.completed']);
    [$carla, $carlaParticipant] = retroMember($retro);
    $carla->forceFill(['name' => 'Carla Author'])->save();
    webhookTopCard($retro, $carlaParticipant, $facilitatorParticipant);

    app(ChangeRetroPhase::class)->handle($retro->fresh(), RetroPhase::Completed);
    app(ChangeRetroPhase::class)->handle($retro->fresh(), RetroPhase::Discussing);
    app(ChangeRetroPhase::class)->handle($retro->fresh(), RetroPhase::Completed);

    $jobs = pushedWebhookEvents();

    expect($jobs)->toHaveCount(2)
        ->and($jobs[0]->event)->toBe('retro.completed')
        ->and($jobs[0]->data['retro'])->toBe(['id' => $retro->id])
        ->and($jobs[0]->data['title'])->toBe('Sprint 42')
        ->and($jobs[0]->data['participants'])->toBe(['count' => 2, 'names' => null])
        ->and($jobs[0]->data['topCards'])->toBe([['column' => 'Wins', 'content' => 'Faster reviews', 'votes' => 1, 'groupedCount' => 0]])
        ->and($jobs[0]->data['completedAt'])->toBeString()
        ->and(json_encode($jobs->map->data->all()))->not->toContain('Carla Author');
});

it('sends poker.task.estimated when a card is set or changed, never on clear', function () {
    $table = webhookEstimateTable();
    $game = $table['game'];
    subscribedWebhook($game->team, ['poker.task.estimated']);
    $url = route('poker.tasks.estimate.update', [$game, $table['task']]);
    $this->actingAs($table['facilitator']);

    $this->putJson($url, ['value' => '8'])->assertOk();
    $this->putJson($url, ['value' => '8'])->assertOk();
    $this->putJson($url, ['value' => null])->assertOk();
    $this->putJson($url, ['value' => '5'])->assertOk();

    $jobs = pushedWebhookEvents();

    expect($jobs)->toHaveCount(2)
        ->and($jobs[0]->event)->toBe('poker.task.estimated')
        ->and($jobs[0]->data['game'])->toBe(['id' => $game->id, 'title' => $game->title, 'url' => route('poker.show', $game)])
        ->and($jobs[0]->data['task'])->toBe([
            'id' => $table['task']->id,
            'title' => 'Login page',
            'url' => route('poker.show', $game),
            'estimate' => '8',
            'deckName' => $game->deck_name ?? $game->deck->label(),
            'external' => ['source' => 'jira', 'key' => 'PROJ-7', 'url' => 'https://acme.atlassian.net/browse/PROJ-7'],
        ])
        ->and($jobs[0]->data['estimatedAt'])->toBeString()
        ->and($jobs[1]->data['task']['estimate'])->toBe('5')
        ->and(json_encode($jobs->map->data->all()))->not->toContain('Milo Member')
        ->and(json_encode($jobs->map->data->all()))->not->toContain('votes');
});

it('builds the payload at event time', function () {
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.created']);
    Http::fake(['hooks.example.com/*' => Http::response('', 200)]);

    $item = app(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Short-lived']);
    $job = pushedWebhookEvents()->sole();
    $item->delete();

    runOutgoingWebhookJob($job)->assertNotFailed();

    Http::assertSent(fn (Request $request) => json_decode($request->body(), true)['data']['actionItem']['content'] === 'Short-lived');
    expect(IntegrationDelivery::query()->sole()->status)->toBe(IntegrationDeliveryStatus::Sent);
});

it('keeps X-Skrum-Delivery across retries and signs each attempt', function () {
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.created']);
    Http::fakeSequence('hooks.example.com/*')->push('', 503)->push('', 200);
    app(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Retry me']);
    $job = pushedWebhookEvents()->sole();
    $retry = fn () => new DeliverWebhookEvent($job->deliveryId, $job->event, $job->occurredAt, $job->data, $job->locale);

    expect(fn () => runOutgoingWebhookJob($retry()))->toThrow(ProviderUnavailable::class);

    $this->travel(2)->minutes();
    runOutgoingWebhookJob($retry())->assertNotFailed();

    $requests = collect(Http::recorded())->map(fn (array $pair) => $pair[0]);

    expect($requests)->toHaveCount(2)
        ->and($requests->map(fn (Request $request) => $request->header('X-Skrum-Delivery')[0])->unique()->all())->toBe([$job->deliveryId])
        ->and($requests[0]->header('X-Skrum-Timestamp')[0])->not->toBe($requests[1]->header('X-Skrum-Timestamp')[0])
        ->and($requests->every(fn (Request $request) => outgoingWebhookSignatureIsValid($request)))->toBeTrue()
        ->and(IntegrationDelivery::query()->sole()->attempts)->toBe(2)
        ->and(IntegrationDelivery::query()->sole()->response_status)->toBe(200);
});

it('retries for about three and a half hours, waiting for Retry-After up to an hour', function () {
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.created']);
    Http::fake(['hooks.example.com/*' => Http::response('', 429, ['Retry-After' => '86400'])]);
    app(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Busy receiver']);
    $job = pushedWebhookEvents()->sole();

    expect($job->tries)->toBe(7)
        ->and($job->backoff())->toBe([30, 120, 600, 1800, 3600, 7200]);

    runOutgoingWebhookJob($job)->assertReleased(delay: 3600);
});

it('does not retry other client errors', function () {
    [$retro, , $participant] = webhookEventRetro();
    subscribedWebhook($retro->team, ['action_item.created']);
    Http::fake(['hooks.example.com/*' => Http::response('', 422)]);
    app(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Refused']);

    runOutgoingWebhookJob(pushedWebhookEvents()->sole())->assertFailed();

    expect(IntegrationDelivery::query()->sole()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and(IntegrationDelivery::query()->sole()->error)->toBe('The receiver answered 422.');
});

it('disables the webhook after 10 failed deliveries in a row, then stops queueing', function () {
    [$retro, , $participant] = webhookEventRetro();
    $integration = subscribedWebhook($retro->team, ['action_item.created']);
    $integration->forceFill(['consecutive_failures' => 9, 'last_delivery_succeeded_at' => now()->subDays(2)])->save();
    Http::fake(['hooks.example.com/*' => Http::response('', 404)]);
    $actor = ActionItemActor::forParticipant($participant);

    app(CreateActionItem::class)->handle($retro->team, $retro, $actor, ['content' => 'First']);
    app(CreateActionItem::class)->handle($retro->team, $retro, $actor, ['content' => 'Second']);
    [$first, $second] = pushedWebhookEvents()->all();

    runOutgoingWebhookJob($first)->assertFailed();

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->setting('disabledReason'))->toBe(WebhookHealth::FailuresReason)
        ->and($integration->fresh()->consecutive_failures)->toBe(10);

    runOutgoingWebhookJob($second)->assertFailed();

    expect(IntegrationDelivery::query()->where('id', $second->deliveryId)->sole()->error)->toBe('Webhook disabled.');
    Http::assertSentCount(1);

    app(CreateActionItem::class)->handle($retro->team, $retro, $actor, ['content' => 'Third']);

    expect(pushedWebhookEvents())->toHaveCount(2)
        ->and(IntegrationDelivery::query()->count())->toBe(2);
});

it('keeps sending after a failure when a delivery succeeded recently', function () {
    [$retro, , $participant] = webhookEventRetro();
    $integration = subscribedWebhook($retro->team, ['action_item.created']);
    $integration->forceFill(['consecutive_failures' => 9, 'last_delivery_succeeded_at' => now()->subHour()])->save();
    Http::fake(['hooks.example.com/*' => Http::response('', 404)]);

    app(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Once']);
    runOutgoingWebhookJob(pushedWebhookEvents()->sole())->assertFailed();

    expect($integration->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and($integration->fresh()->consecutive_failures)->toBe(10);
});

it('never sends automatic events to Slack, Telegram, Teams or Mattermost', function () {
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost);
    [$retro, , $participant] = webhookEventRetro();
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->mattermost()->create(['team_id' => $retro->team_id]);

    $item = app(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'No chat']);
    app(SetActionItemStatus::class)->handle($item, ActionItemActor::forParticipant($participant), ActionItemStatus::Completed);

    Queue::assertNotPushed(DeliverWebhookEvent::class);
    Queue::assertNotPushed(DeliverToSlack::class);
    Queue::assertNotPushed(DeliverToMicrosoftTeams::class);
    Queue::assertNotPushed(DeliverToMattermost::class);

    subscribedWebhook($retro->team);
    app(SetActionItemStatus::class)->handle($item->fresh(), ActionItemActor::forParticipant($participant), ActionItemStatus::Open);

    Queue::assertPushed(DeliverWebhookEvent::class, 1);
    Queue::assertNotPushed(DeliverToSlack::class);
    Queue::assertNotPushed(DeliverToMicrosoftTeams::class);
    Queue::assertNotPushed(DeliverToMattermost::class);
});

it('ignores assignments', function () {
    [$retro] = webhookEventRetro();
    subscribedWebhook($retro->team);

    ActionItemAssigned::dispatch(ActionItem::factory()->create(['retro_id' => $retro->id]));

    Queue::assertNotPushed(DeliverWebhookEvent::class);
});
```

(`webhookTopCard()` and `runOutgoingWebhookJob()` live in `tests/Pest.php` since Task 4.) Check `ActionItemComment::factory()` and its `content` column name against `database/factories/ActionItemCommentFactory.php`. If the column is `body`, use it. If no factory exists, create the comment with `$item->comments()->create([...])` using the fillable columns.

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookEventsTest.php`
Expected: FAIL — `Class "App\Jobs\Integrations\DeliverWebhookEvent" not found`.

- [ ] **Step 3: Carry the actor on status events**

`app/Events/ActionItems/ActionItemCompleted.php` and `ActionItemReopened.php`: add `use App\Actions\ActionItems\ActionItemActor;` and `use App\Actions\ActionItems\ExternalSyncActor;`, then change the constructor to:

```php
    public function __construct(
        public ActionItem $actionItem,
        public ActionItemEventOrigin $origin,
        public ActionItemActor|ExternalSyncActor|null $actor = null,
    ) {}
```

In `SetActionItemStatus::handle()`, pass the actor: `ActionItemCompleted::dispatch($locked, $origin, $actor);` and `ActionItemReopened::dispatch($locked, $origin, $actor);`.

- [ ] **Step 4: Build the event payloads**

Create `app/Actions/Integrations/BuildWebhookEventData.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Enums\ActionItemEventOrigin;
use App\Models\ActionItem;
use App\Models\PokerTask;
use App\Models\Retro;

/**
 * The `data` of each automatic event (spec 8 §4.7), built when the event
 * happens. Action items are always named; guest actors, votes, players,
 * comments, sub-tasks and emails are never sent.
 */
class BuildWebhookEventData
{
    public function __construct(private BuildRetroRecap $buildRetroRecap) {}

    /**
     * @return array<string, mixed>
     */
    public function retroCompleted(Retro $retro): array
    {
        return [...$this->buildRetroRecap->content($retro)->toWebhook(), 'retro' => ['id' => $retro->id]];
    }

    /**
     * @return array{actionItem: array<string, mixed>}
     */
    public function actionItemCreated(ActionItem $item): array
    {
        return ['actionItem' => $this->actionItem($item, null)];
    }

    /**
     * @return array{actionItem: array<string, mixed>, origin: string, completedVia: array{source: string, key: string}|null}
     */
    public function actionItemStatusChanged(ActionItem $item, ActionItemEventOrigin $origin, ActionItemActor|ExternalSyncActor|null $actor): array
    {
        $completedBy = $item->isCompleted() && $actor instanceof ActionItemActor ? $actor->user?->name : null;

        return [
            'actionItem' => $this->actionItem($item, $completedBy),
            'origin' => $origin->value,
            'completedVia' => $actor instanceof ExternalSyncActor ? ['source' => $actor->source, 'key' => $actor->key] : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function pokerTaskEstimated(PokerTask $task): array
    {
        $game = $task->game;
        $gameUrl = route('poker.show', $game);

        return [
            'game' => ['id' => $game->id, 'title' => $game->title, 'url' => $gameUrl],
            'task' => [
                'id' => $task->id,
                'title' => $task->title,
                'url' => $gameUrl,
                'estimate' => $task->estimate,
                'deckName' => $game->deck_name ?? $game->deck->label(),
                'external' => $task->external_source === null ? null : [
                    'source' => $task->external_source,
                    'key' => $task->external_key,
                    'url' => $task->external_url,
                ],
            ],
            'estimatedAt' => ($task->estimated_at ?? now())->toIso8601ZuluString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function actionItem(ActionItem $item, ?string $completedBy): array
    {
        $item->loadMissing(['team.workspace', 'retro', 'author', 'assigneeUser', 'assigneeParticipant.user']);
        $retro = $item->retro;
        $assignee = $item->assigneeUser?->name ?? $item->assigneeParticipant?->displayName();

        return [
            'id' => $item->id,
            'content' => $item->content,
            'status' => $item->isCompleted() ? 'completed' : 'open',
            'assignee' => $assignee === null ? null : ['name' => $assignee],
            'createdBy' => $item->author === null ? null : ['name' => $item->author->name],
            'completedBy' => $completedBy === null ? null : ['name' => $completedBy],
            'dueOn' => $item->due_on?->toDateString(),
            'priority' => $item->priority->value,
            'completedAt' => $item->completed_at?->toIso8601ZuluString(),
            'url' => route('workspaces.actionItems.index', [
                'workspace' => $item->team->workspace,
                'team' => $item->team_id,
                'item' => $item->id,
            ]),
            'retro' => $retro === null ? null : ['id' => $retro->id, 'title' => $retro->title, 'url' => route('retros.show', $retro)],
            'themeName' => $item->theme_name,
            'createdAt' => $item->created_at?->toIso8601ZuluString(),
        ];
    }
}
```

- [ ] **Step 5: The listener and the job**

Create `app/Jobs/Integrations/DeliverWebhookEvent.php`:

```php
<?php

namespace App\Jobs\Integrations;

use App\Models\IntegrationDelivery;

/**
 * One automatic event (spec 8 §4.7): 7 tries over about 3.5 hours; the
 * subject's viewers are not told, since events are not shares.
 */
class DeliverWebhookEvent extends DeliverToWebhook
{
    public int $tries = 7;

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [30, 120, 600, 1800, 3600, 7200];
    }

    protected function announce(IntegrationDelivery $delivery): void {}
}
```

Create `app/Listeners/QueueWebhookEvents.php`:

```php
<?php

namespace App\Listeners;

use App\Actions\Integrations\BuildWebhookEventData;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\WebhookEvent;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemCreated;
use App\Events\ActionItems\ActionItemReopened;
use App\Events\Poker\PokerTaskEstimated;
use App\Events\RetroCompleted;
use App\Jobs\Integrations\DeliverWebhookEvent;
use App\Models\IntegrationDelivery;
use App\Models\Team;
use App\Models\TeamIntegration;
use Closure;
use Illuminate\Database\Eloquent\Model;

/**
 * Queues the automatic events a team's generic webhook subscribed to.
 * Methods are named `on…` so event discovery leaves them to the explicit
 * registration in AppServiceProvider.
 */
class QueueWebhookEvents
{
    public function __construct(private BuildWebhookEventData $buildWebhookEventData) {}

    public function onRetroCompleted(RetroCompleted $event): void
    {
        $retro = $event->retro;

        $this->queue($retro->team, WebhookEvent::RetroCompleted, $retro, fn (): array => $this->buildWebhookEventData->retroCompleted($retro));
    }

    public function onActionItemCreated(ActionItemCreated $event): void
    {
        $item = $event->actionItem;

        $this->queue($item->team, WebhookEvent::ActionItemCreated, $item, fn (): array => $this->buildWebhookEventData->actionItemCreated($item));
    }

    public function onActionItemCompleted(ActionItemCompleted $event): void
    {
        $item = $event->actionItem;

        $this->queue($item->team, WebhookEvent::ActionItemCompleted, $item, fn (): array => $this->buildWebhookEventData->actionItemStatusChanged($item, $event->origin, $event->actor));
    }

    public function onActionItemReopened(ActionItemReopened $event): void
    {
        $item = $event->actionItem;

        $this->queue($item->team, WebhookEvent::ActionItemReopened, $item, fn (): array => $this->buildWebhookEventData->actionItemStatusChanged($item, $event->origin, $event->actor));
    }

    public function onPokerTaskEstimated(PokerTaskEstimated $event): void
    {
        $task = $event->task;

        $this->queue($task->game->team, WebhookEvent::PokerTaskEstimated, $task, fn (): array => $this->buildWebhookEventData->pokerTaskEstimated($task));
    }

    /**
     * @param  Closure(): array<string, mixed>  $buildData
     */
    private function queue(Team $team, WebhookEvent $event, Model $subject, Closure $buildData): void
    {
        $integration = $this->subscribedWebhook($team, $event);

        if ($integration === null) {
            return;
        }

        $data = $buildData();

        $delivery = IntegrationDelivery::query()->create([
            'team_id' => $team->id,
            'channel' => IntegrationDeliveryChannel::Webhook,
            'kind' => IntegrationDeliveryKind::Event,
            'team_integration_id' => $integration->id,
            'event' => $event->value,
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => $subject->getKey(),
            'requested_by_user_id' => null,
            'status' => IntegrationDeliveryStatus::Queued,
        ]);

        dispatch(new DeliverWebhookEvent($delivery->id, $event->value, now()->toIso8601ZuluString(), $data, app()->getLocale()))->afterCommit();
    }

    private function subscribedWebhook(Team $team, WebhookEvent $event): ?TeamIntegration
    {
        if (! IntegrationProvider::Webhook->isEnabled()) {
            return null;
        }

        $integration = $team->integration(IntegrationProvider::Webhook);

        if ($integration === null) {
            return null;
        }

        if (! $integration->isActive()) {
            return null;
        }

        $events = (array) $integration->setting('events', []);

        return in_array($event->value, $events, true) ? $integration : null;
    }
}
```

In `app/Providers/AppServiceProvider.php`, add the imports (`QueueWebhookEvents`, `RetroCompleted`, `ActionItemCreated`, `ActionItemCompleted`, `ActionItemReopened`, `PokerTaskEstimated`). Then, right after the existing `Event::listen(IntegrationActivated::class, …)` line:

```php
        Event::listen(RetroCompleted::class, [QueueWebhookEvents::class, 'onRetroCompleted']);
        Event::listen(ActionItemCreated::class, [QueueWebhookEvents::class, 'onActionItemCreated']);
        Event::listen(ActionItemCompleted::class, [QueueWebhookEvents::class, 'onActionItemCompleted']);
        Event::listen(ActionItemReopened::class, [QueueWebhookEvents::class, 'onActionItemReopened']);
        Event::listen(PokerTaskEstimated::class, [QueueWebhookEvents::class, 'onPokerTaskEstimated']);
```

Run `vendor/bin/sail artisan event:list --event=ActionItemCompleted` and check that `QueueWebhookEvents@onActionItemCompleted` appears exactly once.

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/WebhookEventsTest.php tests/Feature/Integrations/WebhookSharesTest.php tests/Feature/ActionItems/ActionItemActionsTest.php tests/Feature/ActionItems/RecurrenceTest.php tests/Feature/Poker/PokerEstimateTest.php tests/Feature/Poker/PokerEventsTest.php tests/Feature/Retros/RetroPhaseTest.php tests/Feature/Mcp/ActionItemWriteToolsTest.php tests/Feature/Mcp/PokerWriteToolsTest.php`
Expected: PASS. Then run pint and phpstan (0 errors). If a listed file does not exist under that exact name, find the phase tests with `grep -rln "ChangeRetroPhase\|retros.phase.update" tests` and run those instead.

- [ ] **Step 7: Commit**

```bash
git add app/Actions/Integrations/BuildWebhookEventData.php app/Listeners/QueueWebhookEvents.php app/Jobs/Integrations/DeliverWebhookEvent.php app/Events/ActionItems/ActionItemCompleted.php app/Events/ActionItems/ActionItemReopened.php app/Actions/ActionItems/SetActionItemStatus.php app/Providers/AppServiceProvider.php tests/Feature/Integrations/WebhookEventsTest.php
git commit -m "feat(integrations): send subscribed automatic events to generic webhooks

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 6: The webhook card on the integrations page

**Files:**
- Create: `resources/js/components/integrations/{webhook-integration,webhook-secret,webhook-events-panel,webhook-deliveries-panel}.tsx`
- Modify: `resources/js/types/integrations.ts`, `resources/js/pages/teams/integrations.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes:
  - routes `teams.integrations.urls.store`, `teams.integrations.update`, `teams.integrations.secret.store`, `teams.integrations.deliveries.index` (Wayfinder `IntegrationUrlsController.store`, `TeamIntegrationsController.update`, `WebhookSecretsController.store`, `WebhookDeliveriesController.index`)
  - the page prop `webhookEvents`
  - `IntegrationCard`, `IntegrationDetails`, `TestConnectionButton`, `DisconnectIntegrationDialog`, `InputError`, `useClipboard`, `Checkbox`, `Collapsible`
- Produces: the TS types of the Contract and `WebhookIntegration`

There is no frontend test runner (spec §13). Task 3 covers the backend behaviour. Verify the frontend with type-check, lint and the walkthrough in Task 7.

- [ ] **Step 1: Extend the types**

In `resources/js/types/integrations.ts`, after `MattermostServerInfo`:

```ts
export type WebhookEventName =
    | 'retro.completed'
    | 'action_item.created'
    | 'action_item.completed'
    | 'action_item.reopened'
    | 'poker.task.estimated';

export type WebhookEventOption = { name: WebhookEventName; description: string };

export type WebhookDisabledReason = 'failures' | 'gone';

export type WebhookHealth = {
    consecutiveFailures: number;
    lastDeliverySucceededAt: string | null;
};

export type WebhookDelivery = {
    id: string;
    event: string | null;
    kind: string;
    status: DeliveryStatus;
    attempts: number;
    responseStatus: number | null;
    error: string | null;
    createdAt: string | null;
    lastAttemptAt: string | null;
};

export type WebhookDeliveryPage = {
    data: WebhookDelivery[];
    currentPage: number;
    lastPage: number;
    total: number;
};
```

Add `secretCreatedAt?: string;`, `events?: WebhookEventName[];` and `disabledReason?: WebhookDisabledReason;` to `IntegrationSettings`. Add `webhook: WebhookHealth | null;` to `TeamIntegration`. Add:

```ts
export type ConnectedWebhook = TeamIntegration & { secret: string };
```

If `DeliveryStatus` is declared below these lines, move the new block after it.

- [ ] **Step 2: The secret dialog and the rotate button**

Create `resources/js/components/integrations/webhook-secret.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import WebhookSecretsController from '@/actions/App/Http/Controllers/Integrations/WebhookSecretsController';
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
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationScope, TeamIntegration } from '@/types';

const VerificationSnippet = `signed   = X-Skrum-Timestamp + "." + raw request body
expected = "sha256=" + hex(HMAC-SHA256(secret, signed))
accept only if expected == X-Skrum-Signature
        and |now - X-Skrum-Timestamp| <= 300 seconds`;

type SecretDialogProps = {
    secret: string | null;
    onClose: () => void;
};

/**
 * The signing secret leaves the server only in the connect and rotate
 * responses, so this dialog is the one chance to copy it.
 */
export function WebhookSecretDialog({ secret, onClose }: SecretDialogProps) {
    const { t } = useTrans();
    const [, copy] = useClipboard();

    if (secret === null) {
        return null;
    }

    const copySecret = async () => {
        if (await copy(secret)) {
            toast(t('Secret copied.'));

            return;
        }

        toast.error(t('Something went wrong. Please try again.'));
    };

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent
                className="sm:max-w-xl"
                onEscapeKeyDown={(event) => event.preventDefault()}
                onInteractOutside={(event) => event.preventDefault()}
            >
                <DialogTitle>{t('Signing secret')}</DialogTitle>
                <DialogDescription>
                    {t(
                        "Copy this secret now. You won't be able to see it again.",
                    )}
                </DialogDescription>
                <div className="flex gap-2">
                    <Input
                        readOnly
                        value={secret}
                        aria-label={t('Signing secret')}
                        className="font-mono"
                        onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => void copySecret()}
                    >
                        {t('Copy')}
                    </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Verify each request: compute the signature with your secret and reject requests older than 5 minutes.',
                    )}
                </p>
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                    {VerificationSnippet}
                </pre>
                <DialogFooter>
                    <Button type="button" onClick={onClose}>
                        {t("I've saved the secret")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type RotateProps = {
    scope: IntegrationScope;
    connection: TeamIntegration;
    onRotated: (secret: string) => void;
};

export function RotateWebhookSecretButton({
    scope,
    connection,
    onRotated,
}: RotateProps) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const rotate = async () => {
        setBusy(true);

        try {
            const response = await retroRequest<{ secret: string }>(
                WebhookSecretsController.store({
                    ...scope,
                    integration: connection.id,
                }),
            );
            setOpen(false);
            onRotated(response.secret);
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
                <Button size="sm" variant="outline">
                    {t('Rotate secret')}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>{t('Rotate the signing secret?')}</DialogTitle>
                <DialogDescription>
                    {t(
                        'The current secret stops working immediately. Update your endpoint with the new one.',
                    )}
                </DialogDescription>
                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            {t('Cancel')}
                        </Button>
                    </DialogClose>
                    <Button
                        type="button"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void rotate()}
                    >
                        {busy && <Spinner />}
                        {t('Rotate secret')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 3: The events panel**

Create `resources/js/components/integrations/webhook-events-panel.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationScope,
    TeamIntegration,
    WebhookEventName,
    WebhookEventOption,
} from '@/types';

const PayloadExample = `{
  "version": 1,
  "id": "4f1c2e9a-8d3b-4b8e-9f51-2a7c0d6e5b13",
  "event": "action_item.completed",
  "occurredAt": "2026-10-07T10:00:00Z",
  "sentAt": "2026-10-07T10:00:02Z",
  "team": { "id": "…", "name": "Platform" },
  "data": {
    "actionItem": {
      "id": "…",
      "content": "Fix the deploy",
      "status": "completed",
      "assignee": { "name": "Ada" },
      "createdBy": { "name": "Fran" },
      "completedBy": { "name": "Ada" },
      "dueOn": "2026-10-15",
      "priority": "high",
      "completedAt": "2026-10-07T10:00:00Z",
      "url": "https://skrum.example.com/w/acme/action-items?item=…",
      "retro": { "id": "…", "title": "Sprint 42", "url": "…" },
      "themeName": null,
      "createdAt": "2026-10-01T09:30:00Z"
    },
    "origin": "skrum",
    "completedVia": null
  }
}`;

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
    events: WebhookEventOption[];
};

export function WebhookEventsPanel({ scope, connection, events }: Props) {
    const { t } = useTrans();
    const saved = connection.settings.events ?? [];
    const [selected, setSelected] = useState<WebhookEventName[]>(saved);
    const [busy, setBusy] = useState(false);
    const changed =
        selected.length !== saved.length ||
        selected.some((name) => !saved.includes(name));

    const toggle = (name: WebhookEventName, checked: boolean) =>
        setSelected((current) =>
            checked
                ? [...current, name]
                : current.filter((selectedName) => selectedName !== name),
        );

    const save = async () => {
        setBusy(true);

        try {
            await retroRequest(
                TeamIntegrationsController.update({
                    ...scope,
                    integration: connection.id,
                }),
                { events: selected },
            );
            toast.success(t('Events saved.'));
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
        <section className="space-y-3">
            <div>
                <h3 className="text-sm font-medium">
                    {t('Send automatically')}
                </h3>
                <p className="text-xs text-muted-foreground">
                    {t('Only the events you tick are sent, as they happen.')}
                </p>
            </div>
            <ul className="space-y-2">
                {events.map((event) => {
                    const id = `webhook-event-${event.name}`;

                    return (
                        <li key={event.name} className="flex items-start gap-2">
                            <Checkbox
                                id={id}
                                checked={selected.includes(event.name)}
                                onCheckedChange={(checked) =>
                                    toggle(event.name, checked === true)
                                }
                            />
                            <Label
                                htmlFor={id}
                                className="grid gap-0.5 font-normal"
                            >
                                <code className="text-xs">{event.name}</code>
                                <span className="text-sm text-muted-foreground">
                                    {event.description}
                                </span>
                            </Label>
                        </li>
                    );
                })}
            </ul>
            <Collapsible>
                <CollapsibleTrigger asChild>
                    <Button variant="link" size="sm" className="px-0">
                        {t('Payload reference')}
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                        {PayloadExample}
                    </pre>
                </CollapsibleContent>
            </Collapsible>
            <Button
                size="sm"
                disabled={!changed || busy}
                onClick={() => void save()}
            >
                {busy && <Spinner />}
                {t('Save events')}
            </Button>
        </section>
    );
}
```

- [ ] **Step 4: The deliveries panel**

Create `resources/js/components/integrations/webhook-deliveries-panel.tsx`:

```tsx
import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import WebhookDeliveriesController from '@/actions/App/Http/Controllers/Integrations/WebhookDeliveriesController';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    DeliveryStatus,
    IntegrationScope,
    TeamIntegration,
    WebhookDeliveryPage,
} from '@/types';

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

export function WebhookDeliveriesPanel({ scope, connection }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [page, setPage] = useState<WebhookDeliveryPage | null>(null);

    const load = async (pageNumber: number) => {
        setBusy(true);

        try {
            setPage(
                await retroRequest<WebhookDeliveryPage>(
                    WebhookDeliveriesController.index(
                        { ...scope, integration: connection.id },
                        { query: { page: pageNumber } },
                    ),
                ),
            );
        } catch (error) {
            toast.error(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    const toggle = () => {
        const next = !open;
        setOpen(next);

        if (next) {
            void load(1);
        }
    };

    const statusLabel = (status: DeliveryStatus): string => {
        switch (status) {
            case 'sent':
                return t('Sent');
            case 'failed':
                return t('Failed');
            default:
                return t('Queued');
        }
    };

    const formatTime = (value: string | null): string =>
        value === null
            ? '—'
            : new Intl.DateTimeFormat(locale, {
                  dateStyle: 'short',
                  timeStyle: 'medium',
              }).format(new Date(value));

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{t('Deliveries')}</h3>
                <Button variant="link" size="sm" onClick={toggle}>
                    {open ? t('Hide deliveries') : t('Show deliveries')}
                </Button>
            </div>
            {open && busy && page === null && <Spinner />}
            {open && page !== null && page.data.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    {t('No deliveries yet.')}
                </p>
            )}
            {open && page !== null && page.data.length > 0 && (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="text-muted-foreground">
                                <tr>
                                    <th className="py-1 pr-3 font-medium">
                                        {t('Time')}
                                    </th>
                                    <th className="py-1 pr-3 font-medium">
                                        {t('Event')}
                                    </th>
                                    <th className="py-1 pr-3 font-medium">
                                        {t('Status')}
                                    </th>
                                    <th className="py-1 pr-3 font-medium">
                                        {t('Attempts')}
                                    </th>
                                    <th className="py-1 pr-3 font-medium">
                                        {t('Response')}
                                    </th>
                                    <th className="py-1 font-medium">
                                        {t('Error')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {page.data.map((delivery) => (
                                    <tr key={delivery.id} className="border-t">
                                        <td className="py-1 pr-3 whitespace-nowrap">
                                            {formatTime(
                                                delivery.lastAttemptAt ??
                                                    delivery.createdAt,
                                            )}
                                        </td>
                                        <td className="py-1 pr-3">
                                            <code>
                                                {delivery.event ??
                                                    delivery.kind}
                                            </code>
                                        </td>
                                        <td className="py-1 pr-3">
                                            {statusLabel(delivery.status)}
                                        </td>
                                        <td className="py-1 pr-3">
                                            {delivery.attempts}
                                        </td>
                                        <td className="py-1 pr-3">
                                            {delivery.responseStatus ?? '—'}
                                        </td>
                                        <td className="py-1 break-words">
                                            {delivery.error ?? '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={busy || page.currentPage <= 1}
                            onClick={() => void load(page.currentPage - 1)}
                        >
                            {t('Previous')}
                        </Button>
                        <span className="text-muted-foreground">
                            {t('Page :page of :pages', {
                                page: page.currentPage,
                                pages: page.lastPage,
                            })}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={busy || page.currentPage >= page.lastPage}
                            onClick={() => void load(page.currentPage + 1)}
                        >
                            {t('Next')}
                        </Button>
                    </div>
                </>
            )}
        </section>
    );
}
```

(If `useTrans().t` types replacement values as strings only, pass `String(page.currentPage)` / `String(page.lastPage)`.)

- [ ] **Step 5: The card**

Create `resources/js/components/integrations/webhook-integration.tsx`:

```tsx
import { router, usePage } from '@inertiajs/react';
import { Webhook } from 'lucide-react';
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
    ConnectedWebhook,
    IntegrationProviderCard,
    IntegrationScope,
    TeamIntegration,
    WebhookEventOption,
} from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { TestConnectionButton } from './integration-actions';
import { IntegrationCard } from './integration-card';
import { IntegrationDetails } from './integration-details';
import { WebhookDeliveriesPanel } from './webhook-deliveries-panel';
import { WebhookEventsPanel } from './webhook-events-panel';
import { RotateWebhookSecretButton, WebhookSecretDialog } from './webhook-secret';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
    events: WebhookEventOption[];
};

type FieldErrors = { url?: string; channel_label?: string };

/**
 * A generic webhook: a signed POST to the team's own endpoint. The URL and
 * the secret are never sent back to the browser after they are saved.
 */
export function WebhookIntegration({ card, scope, events }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const urlId = useId();
    const labelId = useId();
    const connection = card.connection;
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [url, setUrl] = useState('');
    const [channelLabel, setChannelLabel] = useState('');
    const [errors, setErrors] = useState<FieldErrors>({});
    const [secret, setSecret] = useState<string | null>(null);

    const formatDate = (value: string | null | undefined): string =>
        value === null || value === undefined
            ? t('Never')
            : new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
              }).format(new Date(value));

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
        const body = { url, channel_label: label === '' ? null : label };

        try {
            if (connection === null) {
                const created = await retroRequest<ConnectedWebhook>(
                    IntegrationUrlsController.store({
                        ...scope,
                        provider: 'webhook',
                    }),
                    body,
                );
                setSecret(created.secret);
            } else {
                await retroRequest(
                    TeamIntegrationsController.update({
                        ...scope,
                        integration: connection.id,
                    }),
                    body,
                );
            }

            setOpen(false);
            toast.success(t(':provider connected.', { provider: card.label }));
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

    return (
        <IntegrationCard
            icon={Webhook}
            card={card}
            actions={
                connection === null ? (
                    <Button size="sm" onClick={openDialog}>
                        {t('Connect')}
                    </Button>
                ) : (
                    <>
                        {connection.status === 'reconnect_required' && (
                            <ReenableWebhookButton
                                scope={scope}
                                connection={connection}
                            />
                        )}
                        <Button size="sm" variant="outline" onClick={openDialog}>
                            {t('Replace URL')}
                        </Button>
                        <TestConnectionButton
                            scope={scope}
                            connection={connection}
                            label={t('Send a test message')}
                            successMessage={t('Test message sent.')}
                        />
                        <RotateWebhookSecretButton
                            scope={scope}
                            connection={connection}
                            onRotated={setSecret}
                        />
                        <DisconnectIntegrationDialog
                            scope={scope}
                            card={card}
                            connection={connection}
                            description={t(
                                'Nothing is sent to :host anymore. Remove the endpoint on your side if you no longer need it.',
                                { host: connection.settings.host ?? '' },
                            )}
                        />
                    </>
                )
            }
        >
            {connection === null ? (
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Send board links, game invites, results and the events you choose to your own HTTPS endpoint, signed with a secret.',
                    )}
                </p>
            ) : (
                <>
                    <IntegrationDetails
                        connection={connection}
                        rows={[
                            { label: t('Host'), value: connection.settings.host },
                            {
                                label: t('Label'),
                                value: connection.settings.channelLabel ?? '—',
                            },
                            {
                                label: t('Secret created on'),
                                value: formatDate(
                                    connection.settings.secretCreatedAt,
                                ),
                            },
                            {
                                label: t('Last successful delivery'),
                                value: formatDate(
                                    connection.webhook?.lastDeliverySucceededAt,
                                ),
                            },
                        ]}
                    />
                    <WebhookEventsPanel
                        key={(connection.settings.events ?? []).join(',')}
                        scope={scope}
                        connection={connection}
                        events={events}
                    />
                    <WebhookDeliveriesPanel
                        scope={scope}
                        connection={connection}
                    />
                </>
            )}
            <WebhookSecretDialog
                secret={secret}
                onClose={() => setSecret(null)}
            />
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
                        <DialogDescription>
                            {t(
                                'Paste the URL of an endpoint that accepts POST requests with a JSON body.',
                            )}
                        </DialogDescription>
                        <div className="space-y-2">
                            <Label htmlFor={urlId}>{t('Endpoint URL')}</Label>
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
                                {t('Label (optional)')}
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
                                {connection === null ? t('Connect') : t('Save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </IntegrationCard>
    );
}

type ReenableProps = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

function ReenableWebhookButton({ scope, connection }: ReenableProps) {
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);

    const reenable = async () => {
        setBusy(true);

        try {
            await retroRequest(
                TeamIntegrationsController.update({
                    ...scope,
                    integration: connection.id,
                }),
                { enabled: true },
            );
            toast.success(t('Webhook re-enabled.'));
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
        <Button size="sm" disabled={busy} onClick={() => void reenable()}>
            {busy && <Spinner />}
            {t('Re-enable')}
        </Button>
    );
}
```

(The `key` on `WebhookEventsPanel` re-mounts it after a reload changes the saved events, so its local selection follows the server. `IntegrationCard` already shows `lastError` — "Disabled after 10 failed deliveries in a row." / "The receiver asked skrum to stop." — above the details while the status is `reconnect_required`.)

- [ ] **Step 6: Mount it on the page**

In `resources/js/pages/teams/integrations.tsx`:
- Import `WebhookIntegration` and `WebhookEventOption`.
- Add `webhookEvents: WebhookEventOption[] | null;` to `Props` and destructure it.
- Add before `default:`:

  ```tsx
                          case 'webhook':
                              return (
                                  <WebhookIntegration
                                      key={card.provider}
                                      card={card}
                                      scope={scope}
                                      events={webhookEvents ?? []}
                                  />
                              );
  ```

- [ ] **Step 7: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Send board links, game invites, results and the events you choose to your own HTTPS endpoint, signed with a secret.` | `Envoyez les liens des tableaux, les invitations aux jeux, les résultats et les événements de votre choix à votre propre point de terminaison HTTPS, signés avec un secret.` | `Envía enlaces de tableros, invitaciones a juegos, resultados y los eventos que elijas a tu propio endpoint HTTPS, firmados con un secreto.` | `Sende Board-Links, Spieleinladungen, Ergebnisse und die Ereignisse deiner Wahl an deinen eigenen HTTPS-Endpunkt, signiert mit einem Secret.` |
| `Paste the URL of an endpoint that accepts POST requests with a JSON body.` | `Collez l'URL d'un point de terminaison qui accepte des requêtes POST avec un corps JSON.` | `Pega la URL de un endpoint que acepte solicitudes POST con un cuerpo JSON.` | `Füge die URL eines Endpunkts ein, der POST-Anfragen mit JSON-Body annimmt.` |
| `Endpoint URL` | `URL du point de terminaison` | `URL del endpoint` | `Endpunkt-URL` |
| `Label (optional)` | `Libellé (facultatif)` | `Etiqueta (opcional)` | `Bezeichnung (optional)` |
| `Label` | `Libellé` | `Etiqueta` | `Bezeichnung` |
| `Signing secret` | `Secret de signature` | `Secreto de firma` | `Signatur-Secret` |
| `Secret created on` | `Secret créé le` | `Secreto creado el` | `Secret erstellt am` |
| `Last successful delivery` | `Dernier envoi réussi` | `Último envío correcto` | `Letzte erfolgreiche Zustellung` |
| `Copy this secret now. You won't be able to see it again.` | `Copiez ce secret maintenant. Vous ne pourrez plus le voir.` | `Copia este secreto ahora. No podrás volver a verlo.` | `Kopiere dieses Secret jetzt. Du wirst es nicht noch einmal sehen können.` |
| `Secret copied.` | `Secret copié.` | `Secreto copiado.` | `Secret kopiert.` |
| `I've saved the secret` | `J'ai enregistré le secret` | `He guardado el secreto` | `Ich habe das Secret gespeichert` |
| `Verify each request: compute the signature with your secret and reject requests older than 5 minutes.` | `Vérifiez chaque requête : calculez la signature avec votre secret et rejetez les requêtes de plus de 5 minutes.` | `Verifica cada solicitud: calcula la firma con tu secreto y rechaza las solicitudes de hace más de 5 minutos.` | `Prüfe jede Anfrage: Berechne die Signatur mit deinem Secret und lehne Anfragen ab, die älter als 5 Minuten sind.` |
| `Rotate secret` | `Renouveler le secret` | `Renovar el secreto` | `Secret erneuern` |
| `Rotate the signing secret?` | `Renouveler le secret de signature ?` | `¿Renovar el secreto de firma?` | `Signatur-Secret erneuern?` |
| `The current secret stops working immediately. Update your endpoint with the new one.` | `Le secret actuel cesse de fonctionner immédiatement. Mettez à jour votre point de terminaison avec le nouveau.` | `El secreto actual deja de funcionar de inmediato. Actualiza tu endpoint con el nuevo.` | `Das aktuelle Secret funktioniert sofort nicht mehr. Aktualisiere deinen Endpunkt mit dem neuen.` |
| `Send automatically` | `Envoyer automatiquement` | `Enviar automáticamente` | `Automatisch senden` |
| `Only the events you tick are sent, as they happen.` | `Seuls les événements cochés sont envoyés, au moment où ils se produisent.` | `Solo se envían los eventos que marques, en cuanto ocurren.` | `Nur die angehakten Ereignisse werden gesendet, sobald sie eintreten.` |
| `Payload reference` | `Référence du contenu envoyé` | `Referencia del contenido enviado` | `Referenz der Nutzdaten` |
| `Save events` | `Enregistrer les événements` | `Guardar eventos` | `Ereignisse speichern` |
| `Events saved.` | `Événements enregistrés.` | `Eventos guardados.` | `Ereignisse gespeichert.` |
| `Re-enable` | `Réactiver` | `Reactivar` | `Wieder aktivieren` |
| `Webhook re-enabled.` | `Webhook réactivé.` | `Webhook reactivado.` | `Webhook wieder aktiviert.` |
| `Deliveries` | `Envois` | `Envíos` | `Zustellungen` |
| `Show deliveries` | `Afficher les envois` | `Mostrar envíos` | `Zustellungen anzeigen` |
| `Hide deliveries` | `Masquer les envois` | `Ocultar envíos` | `Zustellungen ausblenden` |
| `No deliveries yet.` | `Aucun envoi pour l'instant.` | `Aún no hay envíos.` | `Noch keine Zustellungen.` |
| `Time` | `Heure` | `Hora` | `Zeit` |
| `Event` | `Événement` | `Evento` | `Ereignis` |
| `Attempts` | `Tentatives` | `Intentos` | `Versuche` |
| `Response` | `Réponse` | `Respuesta` | `Antwort` |
| `Error` | `Erreur` | `Error` | `Fehler` |
| `Sent` | `Envoyé` | `Enviado` | `Gesendet` |
| `Failed` | `Échec` | `Fallido` | `Fehlgeschlagen` |
| `Queued` | `En attente` | `En cola` | `In Warteschlange` |
| `Page :page of :pages` | `Page :page sur :pages` | `Página :page de :pages` | `Seite :page von :pages` |
| `Nothing is sent to :host anymore. Remove the endpoint on your side if you no longer need it.` | `Plus rien n'est envoyé à :host. Supprimez le point de terminaison de votre côté si vous n'en avez plus besoin.` | `Ya no se enviará nada a :host. Elimina el endpoint por tu parte si ya no lo necesitas.` | `An :host wird nichts mehr gesendet. Entferne den Endpunkt auf deiner Seite, wenn du ihn nicht mehr brauchst.` |

These keys already exist, from main or 14a: `Connect`, `Save`, `Cancel`, `Copy`, `Host`, `Status`, `Previous`, `Next`, `Never`, `Send a test message`, `Test message sent.`, `Something went wrong.`, `Something went wrong. Please try again.`, `:provider connected.`, `Connect :provider`, `Replace URL`, `Replace the URL`, `Shown on this page only, to remember where messages go.`, `Webhook`.

- [ ] **Step 8: Verify**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php tests/Feature/Integrations/ConnectOutgoingWebhookTest.php`
Expected: no type errors; lint clean except the known pre-existing files; tests PASS.

Format the touched files with `npx vp check --fix resources/js/components/integrations/webhook-integration.tsx resources/js/components/integrations/webhook-secret.tsx resources/js/components/integrations/webhook-events-panel.tsx resources/js/components/integrations/webhook-deliveries-panel.tsx resources/js/pages/teams/integrations.tsx resources/js/types/integrations.ts`.

- [ ] **Step 9: Commit**

```bash
git add resources/js/components/integrations/webhook-integration.tsx resources/js/components/integrations/webhook-secret.tsx resources/js/components/integrations/webhook-events-panel.tsx resources/js/components/integrations/webhook-deliveries-panel.tsx resources/js/types/integrations.ts resources/js/pages/teams/integrations.tsx lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): generic webhook card with secret, events and deliveries

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 7: Verification and spec alignment

**Files:**
- Modify: `docs/superpowers/specs/2026-09-30-integrations-extended-design.md`. Apply amendments 1–11 of "Spec amendments made with this plan", each at the section it names.

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

Expected:
- pint clean and phpstan 0 errors;
- no type errors, and lint clean except `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`;
- the build succeeds and the whole suite is green. Rerun any Postgres `max_locks_per_transaction` failure without `--parallel`: that is infrastructure, not code.

- [ ] **Step 2: Acceptance walk (automated evidence)**

Check each item against a passing test and note the test name in the task report:
- **Availability:** webhooks appear only with `OUTGOING_WEBHOOKS_ENABLED`, and only Owners/Admins connect, configure, rotate, re-enable, test, read the log and disconnect.
  - `SafeWebhookUrlTest` "enables outgoing webhooks with their env flag"
  - `ConnectOutgoingWebhookTest` "answers 404 while outgoing webhooks are disabled", "is reserved to workspace owners and admins, before validation"
- **Unsafe endpoints** are refused on save and before each send; the request is pinned and redirects are not followed.
  - `SafeWebhookUrlTest`
  - `WebhookClientTest` "pins the connection…", "refuses an endpoint that became private…", "maps receiver answers…"
- **Signed shares:** links, room invites and recaps are signed and follow spec 6's content rules.
  - `WebhookSharesTest`
  - `WebhookClientTest` "signs a versioned JSON envelope"
- **Automatic events:** only the subscribed events are sent, with the catalogue's payloads and redaction; the webhook retries, logs and disables itself; no other channel gets events.
  - `WebhookEventsTest`
  - `WebhookClientTest` "disables after 10 failures…"
  - `ConnectOutgoingWebhookTest` "lists deliveries…", "re-enables a disabled webhook…"
- **Secrets:** no URL or secret in props, JSON (except connect and rotate), job payloads or errors.
  - `ConnectOutgoingWebhookTest` "never serializes…", "connects a webhook and shows its signing secret once"
  - `WebhookSharesTest` "keeps the URL and the secret out of the job payload"
  - `WebhookClientTest` "keeps only the host of connection errors"

- [ ] **Step 3: Amend the spec**

Apply amendments 1–11 to `docs/superpowers/specs/2026-09-30-integrations-extended-design.md`:
- §3: the webhook `settings` with `channelLabel`.
- §4.5:
  - the test request, the `isCompleted` recap field, the body formats and the error texts;
  - replace-versus-update of the URL and the secret;
  - failure counting, and `last_error` on disabling.
- §4.7:
  - the status events' actor, with `completedBy` null on reopen;
  - the locale of automatic events, and the log shape.
- §7: snake_case request fields, the page prop names, and the log response.
- §10: the daily check for the webhook URL.
- §11: the single save-time message.

Keep each change to the sentence it corrects.

- [ ] **Step 4: Manual walkthrough (pending for the user)**

Record this in the report as not run, unless a public request inspector (e.g. a webhook.site-style endpoint) is available:
- Connect a webhook, copy the secret, send Test, and verify the signature with the snippet.
- Share a board link, a game room invite and an anonymous retro's recap.
- Subscribe to all five events, then complete a retro, create, complete and reopen an item, and estimate a task. Check the delivery log.
- Point the webhook at a receiver answering 500: watch the retries and, after 10 failures, the disabled state and Re-enable.
- Answer 410 and see "The receiver asked skrum to stop.".
- Rotate the secret and see the old one fail verification.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-30-integrations-extended-design.md
git commit -m "docs(integrations): align the extended integrations spec with plan 14b

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

## Self-review

- **Spec coverage (14b scope):**
  - §2.1 the flags (Task 1); §3 settings and delivery columns (Tasks 2–5, no migration).
  - §4.5 URL safety (Task 1), signing, headers, envelope and error mapping (Task 2), secret shown once and rotation (Task 3).
  - §4.6 webhook shares, including `game_room.link` with `data {title, game, team, url, sharedBy}` (Task 4).
  - §4.7:
    - subscriptions (Task 3);
    - the catalogue, listener, redaction, delivery retries and backoff, and disabling (Tasks 2, 5);
    - the delivery log (Task 3).
  - §6 permissions (Tasks 3–4); §7 endpoints and props (Task 3); §8 redaction and secrets (Tasks 2–5).
  - §9 card and share menus (Task 6; the share menus came with 14a); §10 jobs and listener (Tasks 4–5); §11 errors (Tasks 1–3).
  - §13 the webhook bullets (Tasks 1–5).
  - Out of scope: Jira DC, GitHub and MCP are 14c; status sync is 14d. `ActionItemAssigned` stays unsubscribed (tested).
- **Placeholder scan:** every step names exact files, code and commands. The only `<model name>` is the commit trailer, filled by the model that writes the commit (standing ruling).
  - Two steps give an explicit fallback tied to real code: the `ActionItemComment` factory column in Task 5, and the name of the phase test file in the Task 5 test run. Each says exactly what to check.
- **Type consistency:**
  - `WebhookEvent` values match the TS `WebhookEventName`, `settings.events`, the listener and the tests.
  - `DeliverToWebhook(deliveryId, event, occurredAt, data, locale)` is built identically by `QueueShare`, `QueueWebhookEvents` (via `DeliverWebhookEvent`) and the tests.
  - `WebhookHealth::FailuresReason` / `GoneReason` match TS `WebhookDisabledReason`.
  - The presenter's `webhook` key matches `TeamIntegration.webhook`.
  - The log item keys match `WebhookDelivery`.
- **Known risks for reviewers:**
  - `FILTER_VALIDATE_URL` may reject bracketed IPv6 literals. That is safe: they are refused, and hostnames with AAAA records are covered.
  - `PendingRequest::getOptions()` is how pinning is asserted, because `Http::fake()` bypasses curl, so the real pinning is exercised only in the walkthrough.
  - `ChangeRetroPhase` is called outside the controller's transaction in tests; its after-commit event still dispatches, as in the existing phase tests.
  - The recap for `retro.completed` runs one extra action-item query (`sortedActionItems()` twice). It is cheap, and chosen over widening `RetroRecap`.
