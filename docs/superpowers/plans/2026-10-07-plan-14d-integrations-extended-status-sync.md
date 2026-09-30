# Plan 14d — Integrations extended: two-way status sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ] `) syntax for tracking.

**Goal:** With "Sync status" turned on for a tracker connection (Jira Cloud, Jira Data Center, Linear, GitHub), completing or reopening an exported action item moves its issue to the mapped done/open status, closing or reopening the issue completes or reopens the item (seconds with webhooks, the polling interval otherwise, most recent change wins, ties to skrum, no loops), imported poker tasks of running games follow their source automatically with a status chip, and a source estimate that diverges from skrum's is flagged for the facilitator — with inbound webhooks verified, de-duplicated, never stored and only ever triggering a re-read.

**Architecture:** Every tracker read now carries an `IssueStatus` (status id, name, provider category, project/team key, `updated` time) on `TrackerIssue`; `DoneMapping` turns it into `ExternalIssueState` (open/done, honouring `doneStatusIds` and `treatCanceledAsDone`) and `ExternalStatusCategory`. The trackers implement a new `SyncsIssueStatus` interface: `changedIssues()` (incremental poll), `statuses()` (mapping editor) and `transition()` (outbound push, Jira via `JiraTransitions`). Inbound changes — from `ApplyInboundIssueChanges` (webhooks) and `ReadTrackedIssues` (polls, daily and initial full reads) — all end in `ApplyIssueChanges`, which locks each item row then its links, applies the conflict rule and completes/reopens through `SetActionItemStatus` with `ExternalSyncActor` (origin `external`), and refreshes poker tasks through `ApplyPokerTaskIssues` (shared with the manual refresh). Outbound, the `QueueActionItemStatusPushes` listener reacts to `origin = skrum` events and queues `PushActionItemState` per link. Webhooks arrive on `routes/webhooks.php` (no session, no CSRF, `EnsureInboundWebhooks` 404s when the provider cannot receive them) and are read by `ReadInboundEvent`; `TrackerWebhooks` registers, refreshes and removes Jira Cloud dynamic and Jira DC webhooks. `ToggleStatusSync`/`UpdateStatusSyncSettings` drive the opt-in; `InboundModes` decides `inbound_mode` and `IntegrationPolls` due-ness. Payloads gain link sync states (`LinkStatusSync`), `completedVia`, and poker `status`/`statusCategory`/`missing`/`estimateConflict`/`syncMode`; the frontend adds a Status sync section with mapping editor, link chips with Retry and the poker conflict badge.

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL, Pest, Laravel HTTP client, queues (`ShouldBeUnique*`, `WithoutOverlapping`), Inertia v3 + React 19, Wayfinder, Tailwind 4, lucide (all installed).

**Spec:** `docs/superpowers/specs/2026-09-30-integrations-extended-design.md` — §2.3 (inbound mode selection), §5 entirely (§5.1 opt-in, §5.2 done mapping, §5.3 inbound webhooks, §5.4 polling and reconciliation, §5.5 applying inbound changes, §5.6 outbound, §5.7 poker tasks, §5.8 conflicts, §5.9 loops), §6 rows "Turn status sync on/off, edit status mapping…", "register webhooks", "Retry an action item push", "Resolve a poker estimate conflict", "Inbound webhook routes", §7 rows `PATCH {integration}` (`statusSync`, `treatCanceledAsDone`, `statusMapping`), `GET {integration}/statuses`, `POST {integration}/webhook`, the inbound routes, `…/external-links/{link}/sync`, `…/estimate-conflict`, "Payload and snapshot additions" (externalLinks, poker `external`, page props), §7.1 (`poker.game.tasks.list` fields; `canSyncStatus`/`syncMode` already from 14c), §8.2, §9 (Status sync section, action item chip, poker status chip and conflict badge), §10 rows `ApplyInboundIssueChanges`, `PushActionItemState`, `RegisterTrackerWebhooks`, `skrum:poll-integrations`, `skrum:check-integrations` additions, §11 push/retry/conflict/inbound errors, §13 bullets Inbound, Polling, Status sync, Poker sync, §14 criteria 5, 6, 7 and the sync parts of 1 and 9. Earlier plans: 14a (schema, enums, `InboundReachability`), 14b (event `actor`, listener pattern), 14c (Jira DC, GitHub, `JiraApi`, trackers, MCP `canSyncStatus`).

## Global Constraints

Plan 14a's Global Constraints apply unchanged (branch `feat/plan-14-integrations-extended` continued after Plans 14a, 14b and 14c, Sail commands, PostgreSQL tests, UUID keys, no new dependency, `ProviderHttp` for every call, `Http::preventStrayRequests()` in every integration test, secrets never serialized, authorize before validating, snake_case request fields / camelCase responses, named throttles, translations appended before the closing `}` of `lang/{en,fr,es,de}.json` keeping existing values, Wayfinder `--with-form` after route changes, frontend checks, React and PHP conventions, explicit staging, Conventional Commits with the attribution trailer of the model that writes the commit and the `Claude-Session` line). Plan 14c's path rule applies to every id this plan places in a provider URL path. Additionally:

- Migration filenames use the prefix `2026_10_07_1003xx`; only `up()`. This plan adds exactly one migration (Task 4).
- **Jobs:** every new job is unique (`ShouldBeUnique` or `ShouldBeUniqueUntilProcessing` with `uniqueFor`), runs its provider work under `WithoutOverlapping` keyed by the link or integration, counts failures with `maxExceptions` + `retryUntil` (a `WithoutOverlapping` release must not burn an attempt), and returns without any provider call when its integration is gone, disabled, not `Active`, `ReconnectRequired` or has sync off.
- **Locks:** inbound application locks the action item row, then that item's link rows; poker application locks the game row, then its task rows; `PushActionItemState` locks only the link row, and only after the provider call. Never hold a row lock during a provider call. Integration settings are merged under a row lock (`TeamIntegration::mergeSettings()`, Task 7), never written from a stale model.
- **Secrets:** `credentials.webhookToken` and `credentials.webhookSecret` are generated server-side (40 random alphanumerics), read only through `TeamIntegration::credential()`/`readableCredentials()`, never placed in page props, integration JSON, job payloads, logs or `integration_inbound_events`. The only response carrying them is `GET {integration}/webhook` (Owners/Admins of a Jira DC connection, `Cache-Control: no-store`). Raw webhook bodies are never stored or logged.
- **Inbound routes** live in `routes/webhooks.php`, loaded outside the `web` group (no session, cookies or CSRF), throttled with `throttle:120,1,integrationWebhooks`.
- **Ids sent to Postgres** are strings: array keys of `array<string, TrackerIssue>` become integers for numeric ids, so every `whereIn('external_id', …)` goes through `array_map('strval', …)`.
- New Pest helper names (checked unique in `tests/` at plan time, including Plans 14a–14c): in `tests/Pest.php` `statusSyncIssue`, `statusSyncLink`, `runStatusPush`, `jiraTransition`, `fakeJiraTransitions`; local to their test files `jiraTransitionRequest`, `jiraSyncIntegration`, `applyStatusSyncIssues`, `syncedPokerTable`, `pollingIntegration`, `trackedJiraLink`, `runTrackedRead`, `jiraWebhookToken`, `inboundJiraUrl`, `jiraWebhookBody`, `postInboundWebhook`, `signedLinearWebhook`, `signedGitHubWebhook`, `hs256Jwt`, `withStatusSync`, `webhookIntegration`, `runWebhookRegistration`, `syncSettingsIntegration`, `syncSettingsRoute`, `conflictingTask`, `conflictRoute`; test constant `InboundJiraToken`.

## Spec amendments made with this plan

Plan writing found these gaps; Task 12 updates the spec (§3, §5.2–§5.8, §7, §9, §10, §11) to match:

1. **Mapping keys:** `settings.statusMapping` is keyed by Jira **project key** and Linear **team key** (links and tasks store `PROJ-12` / `ENG-7`, not project or team ids): `{projects: {PROJ: {doneStatusIds, completeStatusId, reopenStatusId}}}`, `{teams: {ENG: {completeStateId, reopenStateId}}}`. `GET {integration}/statuses` without `container` answers `{containers: string[]}` (the keys of tracked issues); with `?container=PROJ` it answers `{statuses: [{id, name, category}]}`. `PATCH {integration}` takes one container at a time: `status_mapping: {container, done_status_ids, complete_status_id, reopen_status_id}` (Jira) or `{container, complete_state_id, reopen_state_id}` (Linear); an omitted value resets it to the default rule. Request fields are snake_case (`status_sync`, `treat_canceled_as_done`).
2. **Jira Cloud webhooks need the `manage:jira-webhook` OAuth scope.** It joins `JiraClient::ReadScopes`; connections made before keep polling and the card says "Reconnect Jira to receive live updates." (`inboundHint = 'reconnect'`).
3. **Jira DC manual webhook details** (URL with its token, secret, events, JQL) are served on demand by `GET {integration}/webhook` (Owners/Admins, `no-store`), never in page props. `inboundHint = 'manual'` when the connecting account is not a Jira administrator. Non-secret bookkeeping settings: `webhookManual`, `webhookProjects`, `webhookRegisteredAt`, `statusSyncSince`.
4. **Webhook health for Linear and GitHub:** turning sync on in webhook mode sets `webhook_status = pending`; the first verified event makes it `active`. "Healthy" means webhook mode with `pending` or `active`; anything else polls at `INTEGRATIONS_POLL_MINUTES`. "Nothing received for 24 h" counts from `last_inbound_at`, else `webhookRegisteredAt`, else `statusSyncSince`.
5. **Rejected events** are stored under the key `rejected:{sha256(body)}`, so a forged request can never occupy a genuine delivery id. Unknown integrations answer 401 like a wrong token; a `{token}` that is not 40 alphanumerics answers 404.
6. **`externalLinks[]` items gain `id`** (the retry route addresses the link); the retry routes use the scoped parameter `{externalLink}`.
7. **"Completed in :source"** is persisted: `action_items.completed_via_source` (nullable string 20, migration `2026_10_07_100300`), set when `ExternalSyncActor` completes the item and cleared on any other status change, presented as `completedVia` (provider value or null) to members only: guests get `null` (they never receive integration metadata beyond a poker task's key and URL), and broadcasts (no viewer) carry `null`, which clients merge like `externalLinks` (keep the known value while the item stays completed).
8. **Estimate conflicts:** `estimateConflict = {sourceEstimate, matchingCard}` (`matchingCard` null disables "Use :source estimate"); no conflict is flagged while a write-back is pending or unsupported. "Use :source estimate" calls `SetPokerEstimate::fromSource()`, which checks the deck but not the revealed-round rule (the task already has an estimate).
9. **Job semantics:** `PushActionItemState` is `ShouldBeUniqueUntilProcessing` (a change made during a push still queues the next one) with `WithoutOverlapping` per link, `maxExceptions = 5`, `retryUntil` 1 h and backoff 10/30/120/600 s (the spec's 5 tries, as `SyncTaskEstimate`). `ApplyInboundIssueChanges` uses `maxExceptions = 3`, backoff 10/60 s. Polls and full reads run in `ReadTrackedIssues` (unique per integration and kind).
10. **Jira batch reads** fall back to `GET issue/{id}` one by one when Jira refuses a whole `id in (…)` query (400: an id was deleted); 403/404 means absent, so deletions are detected.
11. **Extra messages:** "No transition to an open status is available for :key.", "Jira requires more fields to reopen :key. Reopen it in Jira.", "Linear did not accept this status change.", "Turn on status sync for :provider first." (409 on retry and webhook registration), "This issue belongs to another :provider site." (409), "The status could not be written. Try again.", "This skrum instance can't receive webhooks; it checks :provider regularly instead." (409).
12. **New project:** after each successful incremental poll, a Jira Cloud or auto-registered Jira DC webhook whose `webhookProjects` differ from the tracked projects is re-registered. Manual Jira DC webhooks are never changed by skrum.
13. **Mapping changes re-read:** changing "Treat canceled as done" or a status mapping while sync is on queues a full read (not an initial one).
14. **GitHub `installation_repositories` `removed`** re-reads the tracked issues of those repositories at once (they come back 404 and are marked missing) instead of at the next read.
15. **Link `syncState`:** `off` (no sync for this link: provider disabled, not connected/active, sync off, other site), `missing` (`missing_at`), `failed` (`sync_error`), `pending` (never read, or source state ≠ item state), else `synced`.
16. **Live updates of link states** reach the boards through the existing members-only `action-item.external-links.changed`; the workspace action items page refreshes them on its next load (no new broadcast event, §7).

## Review Focus

1. **Inbound requests are proofs, not data.** URL token (`hash_equals`), optional Atlassian JWT (HS256, `exp`), Jira DC `X-Hub-Signature`, Linear `Linear-Signature` + 60 s `webhookTimestamp`, GitHub `X-Hub-Signature-256`; failures answer 401 with a payload-free `rejected` row and at most one warning per provider per hour; duplicates answer 200 without a job; untracked issues are `ignored`; the job re-reads the API, so a payload claiming "done" for an issue the API returns open changes nothing. Pinned in Task 6 ("refuses a wrong token and logs once an hour", "verifies the Atlassian JWT when one is sent", "refuses stale or badly signed Linear deliveries", "answers duplicates with 200 and no job", "ignores issues skrum does not track") and Task 6 job test ("trusts the API, not the payload").
2. **Nothing loops.** `origin = external` never queues a push; inbound equal-state reads change nothing but the link's read fields; pushes read the item's current state and skip the call when the source is already there. Pinned in Task 3 ("does not push changes that came from the source", "skips the transition when the issue is already in that state"), Task 2 ("skips the transition when the issue is already there") and Task 4 ("only records the read when both sides agree").
3. **The conflict rule.** Unpushed local change newer → skrum wins and a push is queued; source newer → the item follows; tie → skrum; the first read after turning sync on lets the source win. Pinned in Task 4 ("keeps a newer unpushed skrum change and pushes it", "lets a newer source change win", "gives a tie to skrum", "lets the source win on the first read").
4. **Secrets and payload privacy.** Webhook tokens/secrets absent from page props, integration JSON, job payloads and inbound rows; link sync fields only for members (guests `[]`, broadcasts `null`). Pinned in Task 7 ("never exposes the webhook token or secret outside the details endpoint"), Task 8 ("presents the sync state without secrets") and Task 9 ("gives guests no links and broadcasts none").
5. **System actor vs invariants and permissions.** The sync completes items on locked or finished boards and still creates the next occurrence of recurring items; the retry endpoint and conflict resolution answer 403 to guests and non-managers before validating, 409 when read-only/not active/sync off, and conflict resolution is facilitator-only. Pinned in Task 4 ("completes an item on a locked board as the system"), Task 3 ("lets managers retry a failed push", "refuses guests and non-managers before anything else") and Task 10 ("reserves conflict resolution to the facilitator").

## File map

Execution order on the branch: **14a → 14b → 14c → 14d**. Files marked ◆ are also edited by 14a, 14b or 14c; edit them by the anchors given (never by line numbers) and keep what the earlier plans added.

| Area | Files |
|---|---|
| Status reads | `app/Support/Integrations/Trackers/{IssueStatus,DoneMapping,SyncsIssueStatus}.php`; ◆ `app/Support/Integrations/Trackers/{TrackerIssue,JiraIssueTracker,LinearTracker,GitHubTracker,Trackers}.php` |
| Transitions | `app/Support/Integrations/Jira/JiraTransitions.php`; `app/Support/Integrations/Exceptions/StatusPushRejected.php` |
| Outbound | `app/Support/Integrations/StatusSync.php`; `app/Actions/Integrations/{LinkStatusSync,RequestActionItemPush}.php`; `app/Listeners/QueueActionItemStatusPushes.php`; `app/Jobs/Integrations/PushActionItemState.php`; `app/Http/Controllers/Integrations/{RetroActionItemLinkSyncsController,WorkspaceActionItemLinkSyncsController}.php`; ◆ `app/Providers/AppServiceProvider.php`; ◆ `routes/web.php` |
| Inbound apply | `database/migrations/2026_10_07_100300_add_completed_via_source_to_action_items.php`; `app/Actions/Integrations/{TrackedIssues,ApplyIssueChanges,ApplyPokerTaskIssues}.php`; ◆ `app/Actions/ActionItems/SetActionItemStatus.php`; `app/Models/ActionItem.php`; `app/Actions/Integrations/{RefreshPokerTasks,ImportPokerTasks}.php` |
| Polling | `app/Support/Integrations/{InboundModes,IntegrationPolls}.php`; `app/Jobs/Integrations/ReadTrackedIssues.php`; `app/Console/Commands/{PollIntegrationsCommand,CheckIntegrationsCommand}.php`; ◆ `routes/console.php` |
| Inbound endpoints | `routes/webhooks.php`; `bootstrap/app.php`; `app/Http/Middleware/EnsureInboundWebhooks.php`; `app/Http/Controllers/Integrations/InboundWebhooksController.php`; `app/Support/Integrations/Inbound/{InboundEvent,ReadInboundEvent,InboundSignatureInvalid,JiraWebhookJwt}.php`; `app/Jobs/Integrations/ApplyInboundIssueChanges.php`; `app/Support/Integrations/IntegrationErrors.php` |
| Registration | ◆ `app/Support/Integrations/Jira/{JiraApi,JiraClient}.php`; ◆ `app/Support/Integrations/JiraDataCenter/JiraDataCenterClient.php`; `app/Support/Integrations/TrackerWebhooks.php`; `app/Jobs/Integrations/{RegisterTrackerWebhooks,RemoveTrackerWebhooks}.php`; `app/Http/Controllers/Integrations/TrackerWebhooksController.php`; ◆ `app/Actions/Integrations/DisconnectIntegration.php` |
| Settings | `app/Actions/Integrations/{ToggleStatusSync,UpdateStatusSyncSettings}.php`; ◆ `app/Actions/Integrations/{UpdateTeamIntegration,PresentTeamIntegration}.php`; `app/Http/Controllers/Integrations/IntegrationStatusesController.php`; ◆ `app/Http/Controllers/Integrations/TeamIntegrationsController.php` |
| Payloads | `app/Actions/Retros/PresentActionItem.php`; `app/Events/Retros/ActionItemExternalLinksChanged.php`; ◆ `app/Actions/Integrations/PokerTaskSync.php`; `app/Actions/Poker/{PresentPokerTask,SetPokerEstimate}.php`; `app/Actions/Integrations/ResolvePokerEstimateConflict.php`; `app/Http/Controllers/Integrations/PokerEstimateConflictsController.php`; `app/Mcp/Presenters/McpPokerGame.php` |
| Frontend | ◆ `resources/js/types/integrations.ts`; `resources/js/lib/retro/types.ts`; ◆ `resources/js/lib/poker/types.ts`; `resources/js/lib/action-items/endpoints.ts`; `resources/js/components/action-items/{external-link-chips,action-item-card}.tsx`; `resources/js/components/integrations/{status-sync-section,status-mapping-panel,jira-data-center-webhook-panel}.tsx`; `resources/js/components/integrations/{jira-integration,linear-integration}.tsx`; ◆ `resources/js/pages/teams/integrations.tsx`; ◆ `resources/js/components/poker/task-source-details.tsx`; `resources/js/components/poker/{task-source-chip,estimate-conflict}.tsx` |
| Tests | new: `tests/Feature/Integrations/{IssueStatusReadsTest,IssueTransitionsTest,ActionItemStatusPushTest,ApplyIssueChangesTest,PollIntegrationsTest,InboundWebhooksTest,TrackerWebhooksTest,StatusSyncSettingsTest,ActionItemSyncPayloadTest,PokerStatusSyncTest}.php`; updated: ◆ `tests/Pest.php`, `tests/Feature/Integrations/{IssueTrackersTest,ExternalLinksPresentationTest,ActionItemExportTest,PokerTaskExternalTest,ConnectJiraTest,IntegrationTokensTest}.php`, `tests/Feature/ActionItems/PresentActionItemTest.php` |
| Translations | ◆ `lang/{en,fr,es,de}.json` (rows inside each task) |
| Spec | ◆ `docs/superpowers/specs/2026-09-30-integrations-extended-design.md` (Task 12) |

---

### Task 1: Issue status in every tracker read

Every tracker read carries where the issue stands in its workflow; `DoneMapping` decides open/done and the poker category; trackers answer incremental and status-list reads.

**Files:**
- Create: `app/Support/Integrations/Trackers/IssueStatus.php`, `app/Support/Integrations/Trackers/DoneMapping.php`, `app/Support/Integrations/Trackers/SyncsIssueStatus.php`, `tests/Feature/Integrations/IssueStatusReadsTest.php`
- Modify: `app/Support/Integrations/Trackers/{TrackerIssue,JiraIssueTracker,LinearTracker,GitHubTracker,Trackers}.php`, `tests/Feature/Integrations/IssueTrackersTest.php`

**Interfaces:**
- Consumes: 14a enums `ExternalIssueState`, `ExternalStatusCategory`; 14c `JiraIssueTracker` (`api()`, `requestedFields()`, `issue()`, `searchJql()`), `GitHubTracker::{issueReference, fullName}`, `GitHubClient::{repositoryName, response, hasNextPage}`; Pest helpers `fakeJiraTrackerApi`, `jiraTrackerIssue`, `jiraApiUrl`, `fakeLinearGraphql`, `linearTrackerIssue`, `jiraDataCenterUrl`, `fakeGitHubTrackerApi`, `gitHubIssue`.
- Produces: `IssueStatus` (`id`, `name`, `kind`, `container`, `updatedAt`; constants `GitHubOpen`, `GitHubCompleted`, `GitHubNotPlanned`; `static time(mixed): ?CarbonImmutable`); `TrackerIssue::$issueStatus` (last constructor argument, nullable); `DoneMapping::{state, category, treatsCanceledAsDone, doneStatusIds, configured}`; `SyncsIssueStatus::{changedIssues, statuses}` (Task 2 adds `transition`); `Trackers::syncing(IntegrationProvider): SyncsIssueStatus`; `JiraIssueTracker::ProjectKeyPattern`, `LinearTracker::TeamKeyPattern` (public).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/IssueStatusReadsTest.php`:

```php
<?php

use App\Enums\ExternalIssueState;
use App\Enums\ExternalStatusCategory;
use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\DoneMapping;
use App\Support\Integrations\Trackers\IssueStatus;
use App\Support\Integrations\Trackers\Trackers;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
});

it('reads the status, project and update time of Jira Cloud issues', function () {
    enableIntegrations(IntegrationProvider::Jira);
    $integration = TeamIntegration::factory()->jira()->create();
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', [
        'status' => ['id' => '10003', 'name' => 'In Review', 'statusCategory' => ['key' => 'indeterminate']],
        'project' => ['id' => '10000', 'key' => 'PROJ'],
        'updated' => '2026-10-07T12:15:30.000+0200',
    ])]);

    $issue = app(Trackers::class)->for(IntegrationProvider::Jira)->issues($integration, ['10001'])['10001'];

    expect($issue->status)->toBe('In Review')
        ->and($issue->issueStatus?->id)->toBe('10003')
        ->and($issue->issueStatus?->kind)->toBe('indeterminate')
        ->and($issue->issueStatus?->container)->toBe('PROJ')
        ->and($issue->issueStatus?->updatedAt?->toIso8601String())->toBe('2026-10-07T10:15:30+00:00');

    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/rest/api/3/search/jql')
        && in_array('updated', $request['fields'], true)
        && in_array('project', $request['fields'], true));
});

it('reads the status of Jira Data Center issues through REST v2', function () {
    enableIntegrations(IntegrationProvider::JiraDataCenter);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    Http::fake([jiraDataCenterUrl('rest/api/2/search') => Http::response(['issues' => [jiraTrackerIssue('10001', 'OPS-4', [
        'description' => 'Plain text',
        'status' => ['id' => '6', 'name' => 'Closed', 'statusCategory' => ['key' => 'done']],
        'project' => ['key' => 'OPS'],
        'updated' => '2026-10-07T09:00:00.000+0000',
    ])], 'total' => 1])]);

    $issue = app(Trackers::class)->for(IntegrationProvider::JiraDataCenter)->issues($integration, ['10001'])['10001'];

    expect($issue->issueStatus?->kind)->toBe('done')
        ->and($issue->issueStatus?->container)->toBe('OPS')
        ->and(DoneMapping::state($integration, $issue->issueStatus))->toBe(ExternalIssueState::Done);
});

it('reads the state type, team and update time of Linear issues', function () {
    enableIntegrations(IntegrationProvider::Linear);
    $integration = TeamIntegration::factory()->linear()->create();
    fakeLinearGraphql(['issues(' => ['issues' => ['nodes' => [linearTrackerIssue('lin-1', 'ENG-7', [
        'state' => ['id' => 'state-canceled', 'name' => 'Canceled', 'type' => 'canceled'],
        'team' => ['key' => 'ENG'],
        'updatedAt' => '2026-10-07T08:00:00.000Z',
    ])]]]]);

    $issue = app(Trackers::class)->for(IntegrationProvider::Linear)->issues($integration, ['lin-1'])['lin-1'];

    expect($issue->status)->toBe('Canceled')
        ->and($issue->issueStatus?->kind)->toBe('canceled')
        ->and($issue->issueStatus?->container)->toBe('ENG')
        ->and($issue->issueStatus?->updatedAt?->toIso8601String())->toBe('2026-10-07T08:00:00+00:00');
});

it('reads open and closed GitHub issues with their state reason', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    $integration = TeamIntegration::factory()->gitHub()->create();
    fakeGitHubTrackerApi([
        'api.github.com/graphql' => gitHubGraphqlIssues([7 => gitHubIssue(7, [
            'state' => 'closed',
            'state_reason' => 'not_planned',
            'updated_at' => '2026-10-07T07:00:00Z',
        ])]),
    ]);

    $issue = app(Trackers::class)->for(IntegrationProvider::GitHub)->issues($integration, ['9001/7'])['9001/7'];

    expect($issue->issueStatus?->kind)->toBe(IssueStatus::GitHubNotPlanned)
        ->and($issue->issueStatus?->container)->toBe('9001')
        ->and($issue->issueStatus?->updatedAt?->toIso8601String())->toBe('2026-10-07T07:00:00+00:00');
});

it('maps source states to done or open', function (IntegrationProvider $provider, array $settings, string $kind, string $statusId, ExternalIssueState $expected) {
    $integration = TeamIntegration::factory()->make(['provider' => $provider, 'settings' => $settings]);

    expect(DoneMapping::state($integration, new IssueStatus($statusId, null, $kind, 'PROJ', null)))->toBe($expected);
})->with([
    'jira done' => [IntegrationProvider::Jira, [], 'done', '10002', ExternalIssueState::Done],
    'jira in progress' => [IntegrationProvider::Jira, [], 'indeterminate', '3', ExternalIssueState::Open],
    'jira done status listed' => [IntegrationProvider::Jira, ['statusMapping' => ['projects' => ['PROJ' => ['doneStatusIds' => ['10002']]]]], 'done', '10002', ExternalIssueState::Done],
    'jira done status not listed' => [IntegrationProvider::Jira, ['statusMapping' => ['projects' => ['PROJ' => ['doneStatusIds' => ['10002']]]]], 'done', '10005', ExternalIssueState::Open],
    'jira dc done' => [IntegrationProvider::JiraDataCenter, [], 'done', '6', ExternalIssueState::Done],
    'linear completed' => [IntegrationProvider::Linear, [], 'completed', 's1', ExternalIssueState::Done],
    'linear canceled by default' => [IntegrationProvider::Linear, [], 'canceled', 's2', ExternalIssueState::Done],
    'linear canceled not done' => [IntegrationProvider::Linear, ['treatCanceledAsDone' => false], 'canceled', 's2', ExternalIssueState::Open],
    'linear started' => [IntegrationProvider::Linear, [], 'started', 's3', ExternalIssueState::Open],
    'github completed' => [IntegrationProvider::GitHub, [], 'completed', 'closed', ExternalIssueState::Done],
    'github not planned by default' => [IntegrationProvider::GitHub, [], 'not_planned', 'closed', ExternalIssueState::Done],
    'github not planned not done' => [IntegrationProvider::GitHub, ['treatCanceledAsDone' => false], 'not_planned', 'closed', ExternalIssueState::Open],
    'github open' => [IntegrationProvider::GitHub, [], 'open', 'open', ExternalIssueState::Open],
]);

it('maps source states to poker status categories', function (IntegrationProvider $provider, string $kind, ExternalStatusCategory $expected) {
    expect(DoneMapping::category($provider, $kind))->toBe($expected);
})->with([
    [IntegrationProvider::Jira, 'new', ExternalStatusCategory::Todo],
    [IntegrationProvider::Jira, 'indeterminate', ExternalStatusCategory::InProgress],
    [IntegrationProvider::JiraDataCenter, 'done', ExternalStatusCategory::Done],
    [IntegrationProvider::Linear, 'triage', ExternalStatusCategory::Todo],
    [IntegrationProvider::Linear, 'backlog', ExternalStatusCategory::Todo],
    [IntegrationProvider::Linear, 'unstarted', ExternalStatusCategory::Todo],
    [IntegrationProvider::Linear, 'started', ExternalStatusCategory::InProgress],
    [IntegrationProvider::Linear, 'completed', ExternalStatusCategory::Done],
    [IntegrationProvider::Linear, 'canceled', ExternalStatusCategory::Done],
    [IntegrationProvider::GitHub, 'open', ExternalStatusCategory::Todo],
    [IntegrationProvider::GitHub, 'completed', ExternalStatusCategory::Done],
    [IntegrationProvider::GitHub, 'not_planned', ExternalStatusCategory::Done],
]);

it('asks Jira only for tracked issues updated since the cursor', function () {
    enableIntegrations(IntegrationProvider::Jira);
    $integration = TeamIntegration::factory()->jira()->create();
    fakeJiraTrackerApi([jiraTrackerIssue('10002', 'PROJ-2', ['updated' => '2026-10-07T10:25:00.000+0000'])]);

    $changed = app(Trackers::class)->syncing(IntegrationProvider::Jira)
        ->changedIssues($integration, ['10001', '10002'], CarbonImmutable::parse('2026-10-07 10:13:00'));

    expect(array_map('strval', array_keys($changed)))->toBe(['10002']);
    Http::assertSent(fn (Request $request) => $request['jql'] === 'id in (10001,10002) AND updated >= "-17m"');
});

it('reads Jira issues one by one when a deleted id makes the batch fail', function () {
    enableIntegrations(IntegrationProvider::Jira);
    $integration = TeamIntegration::factory()->jira()->create();
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['errorMessages' => ["An issue with key '10009' does not exist for field 'id'."]], 400),
        jiraApiUrl('rest/api/3/issue/10001*') => Http::response(jiraTrackerIssue('10001', 'PROJ-1')),
        jiraApiUrl('rest/api/3/issue/10009*') => Http::response(['errorMessages' => ['Issue does not exist']], 404),
    ]);

    $issues = app(Trackers::class)->for(IntegrationProvider::Jira)->issues($integration, ['10001', '10009']);

    expect(array_map('strval', array_keys($issues)))->toBe(['10001']);
    Http::assertSent(fn (Request $request) => str_contains($request->url(), '/rest/api/3/issue/10001?fields='));
});

it('filters Linear issues by id and update time', function () {
    enableIntegrations(IntegrationProvider::Linear);
    $integration = TeamIntegration::factory()->linear()->create();
    $variables = null;
    fakeLinearGraphql(['updatedAt: {gte' => function (array $given) use (&$variables) {
        $variables = $given;

        return ['issues' => ['nodes' => [linearTrackerIssue('lin-2', 'ENG-2', [
            'state' => ['id' => 'st-9', 'name' => 'Done', 'type' => 'completed'],
            'team' => ['key' => 'ENG'],
            'updatedAt' => '2026-10-07T10:20:00.000Z',
        ])]]];
    }]);

    $changed = app(Trackers::class)->syncing(IntegrationProvider::Linear)
        ->changedIssues($integration, ['lin-1', 'lin-2'], CarbonImmutable::parse('2026-10-07 10:13:00'));

    expect(array_keys($changed))->toBe(['lin-2'])
        ->and($variables)->toBe(['ids' => ['lin-1', 'lin-2'], 'since' => '2026-10-07T10:13:00Z']);
});

it('lists changed GitHub issues per repository and keeps the tracked ones', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    $integration = TeamIntegration::factory()->gitHub()->create();
    fakeGitHubTrackerApi([
        'api.github.com/repos/acme/api/issues?*' => Http::response([
            gitHubIssue(1, ['state' => 'closed', 'state_reason' => 'completed', 'updated_at' => '2026-10-07T10:20:00Z']),
            gitHubIssue(2),
            gitHubIssue(5, ['pull_request' => ['url' => 'https://api.github.com/repos/acme/api/pulls/5']]),
        ]),
    ]);

    $changed = app(Trackers::class)->syncing(IntegrationProvider::GitHub)
        ->changedIssues($integration, ['9001/1', '9001/5'], CarbonImmutable::parse('2026-10-07 10:13:00'));

    expect(array_keys($changed))->toBe(['9001/1']);
    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/repos/acme/api/issues?')
        && $request['since'] === '2026-10-07T10:13:00Z'
        && $request['state'] === 'all');
});

it('lists the statuses of a Jira project and the states of a Linear team', function () {
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear);
    $jira = TeamIntegration::factory()->jira()->create();
    $linear = TeamIntegration::factory()->linear()->create();
    Http::fake([jiraApiUrl('rest/api/3/project/PROJ/statuses') => Http::response([
        ['id' => '1', 'name' => 'Story', 'statuses' => [
            ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']],
            ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']],
        ]],
        ['id' => '2', 'name' => 'Bug', 'statuses' => [['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']]]],
    ])]);
    fakeLinearGraphql(['teams(first: 1' => ['teams' => ['nodes' => [['states' => ['nodes' => [
        ['id' => 'st-2', 'name' => 'Done', 'type' => 'completed', 'position' => 3],
        ['id' => 'st-1', 'name' => 'Todo', 'type' => 'unstarted', 'position' => 1],
    ]]]]]]]);
    $trackers = app(Trackers::class);

    expect($trackers->syncing(IntegrationProvider::Jira)->statuses($jira, 'PROJ'))->toBe([
        ['id' => '10000', 'name' => 'To Do', 'category' => 'todo'],
        ['id' => '10002', 'name' => 'Done', 'category' => 'done'],
    ])
        ->and($trackers->syncing(IntegrationProvider::Linear)->statuses($linear, 'ENG'))->toBe([
            ['id' => 'st-1', 'name' => 'Todo', 'category' => 'todo'],
            ['id' => 'st-2', 'name' => 'Done', 'category' => 'done'],
        ])
        ->and($trackers->syncing(IntegrationProvider::Jira)->statuses($jira, '../x'))->toBe([]);
});
```

`GitHubTracker::issues()` reads through 14c's batched GraphQL request (`fetchMany()`), which already reshapes `stateReason`/`updatedAt` to the REST keys; "reads open and closed GitHub issues…" fakes it with 14c's `gitHubGraphqlIssues()`.

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IssueStatusReadsTest.php`
Expected: FAIL — `Class "App\Support\Integrations\Trackers\DoneMapping" not found` / unknown named parameter `issueStatus`.

- [ ] **Step 3: Status value, mapping and interface**

Create `app/Support/Integrations/Trackers/IssueStatus.php`:

```php
<?php

namespace App\Support\Integrations\Trackers;

use Carbon\CarbonImmutable;
use Carbon\Exceptions\InvalidFormatException;

/**
 * Where an issue stands in its source workflow (spec 8 §5.2): the status
 * id and name, the provider's own category (`kind`: Jira status category
 * key, Linear state type, GitHub open/completed/not_planned) and the Jira
 * project or Linear team key whose mapping applies.
 */
class IssueStatus
{
    public const GitHubOpen = 'open';

    public const GitHubCompleted = 'completed';

    public const GitHubNotPlanned = 'not_planned';

    public function __construct(
        public string $id,
        public ?string $name,
        public string $kind,
        public ?string $container,
        public ?CarbonImmutable $updatedAt,
    ) {}

    public static function time(mixed $value): ?CarbonImmutable
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return CarbonImmutable::parse($value)->utc();
        } catch (InvalidFormatException) {
            return null;
        }
    }
}
```

In `app/Support/Integrations/Trackers/TrackerIssue.php`, add the last constructor argument after `public ?string $status,`:

```php
        public ?IssueStatus $issueStatus = null,
```

Create `app/Support/Integrations/Trackers/DoneMapping.php`:

```php
<?php

namespace App\Support\Integrations\Trackers;

use App\Enums\ExternalIssueState;
use App\Enums\ExternalStatusCategory;
use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;

/**
 * Spec 8 §5.2: when an issue counts as done, and which poker category its
 * status belongs to. Mapping settings are keyed by Jira project key and
 * Linear team key.
 */
class DoneMapping
{
    public static function state(TeamIntegration $integration, IssueStatus $status): ExternalIssueState
    {
        $done = match ($integration->provider) {
            IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter => self::jiraDone($integration, $status),
            IntegrationProvider::Linear => $status->kind === 'completed'
                || ($status->kind === 'canceled' && self::treatsCanceledAsDone($integration)),
            IntegrationProvider::GitHub => $status->kind === IssueStatus::GitHubCompleted
                || ($status->kind === IssueStatus::GitHubNotPlanned && self::treatsCanceledAsDone($integration)),
            default => false,
        };

        return $done ? ExternalIssueState::Done : ExternalIssueState::Open;
    }

    public static function category(IntegrationProvider $provider, string $kind): ExternalStatusCategory
    {
        return match ($provider) {
            IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter => match ($kind) {
                'done' => ExternalStatusCategory::Done,
                'indeterminate' => ExternalStatusCategory::InProgress,
                default => ExternalStatusCategory::Todo,
            },
            IntegrationProvider::Linear => match ($kind) {
                'started' => ExternalStatusCategory::InProgress,
                'completed', 'canceled' => ExternalStatusCategory::Done,
                default => ExternalStatusCategory::Todo,
            },
            IntegrationProvider::GitHub => $kind === IssueStatus::GitHubOpen ? ExternalStatusCategory::Todo : ExternalStatusCategory::Done,
            default => ExternalStatusCategory::Todo,
        };
    }

    public static function treatsCanceledAsDone(TeamIntegration $integration): bool
    {
        return $integration->setting('treatCanceledAsDone', true) !== false;
    }

    /**
     * @return array<int, string>|null null when every status of the done category counts
     */
    public static function doneStatusIds(TeamIntegration $integration, ?string $project): ?array
    {
        if ($project === null) {
            return null;
        }

        $ids = $integration->setting("statusMapping.projects.{$project}.doneStatusIds");

        return is_array($ids) && $ids !== [] ? array_values(array_map('strval', $ids)) : null;
    }

    /**
     * A configured target (`completeStatusId`, `reopenStatusId`,
     * `completeStateId`, `reopenStateId`) of a project or team.
     */
    public static function configured(TeamIntegration $integration, ?string $container, string $key): ?string
    {
        if ($container === null) {
            return null;
        }

        $group = in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true) ? 'projects' : 'teams';
        $value = $integration->setting("statusMapping.{$group}.{$container}.{$key}");

        return is_string($value) && $value !== '' ? $value : null;
    }

    private static function jiraDone(TeamIntegration $integration, IssueStatus $status): bool
    {
        if ($status->kind !== 'done') {
            return false;
        }

        $doneIds = self::doneStatusIds($integration, $status->container);

        return $doneIds === null || in_array($status->id, $doneIds, true);
    }
}
```

Create `app/Support/Integrations/Trackers/SyncsIssueStatus.php`:

```php
<?php

namespace App\Support\Integrations\Trackers;

use App\Models\TeamIntegration;
use Carbon\CarbonImmutable;

/**
 * The status sync surface of a tracker (spec 8 §5): incremental reads for
 * polling and the statuses a mapping can choose from.
 */
interface SyncsIssueStatus
{
    /**
     * Tracked issues updated since `$since`; issues the source did not
     * return are unchanged, not missing.
     *
     * @param  array<int, string>  $externalIds
     * @return array<string, TrackerIssue>
     */
    public function changedIssues(TeamIntegration $integration, array $externalIds, CarbonImmutable $since): array;

    /**
     * @return array<int, array{id: string, name: string, category: string}>
     */
    public function statuses(TeamIntegration $integration, string $container): array;
}
```

In `app/Support/Integrations/Trackers/Trackers.php`, add after `for()`:

```php
    public function syncing(IntegrationProvider $provider): SyncsIssueStatus
    {
        $tracker = $this->for($provider);

        if (! $tracker instanceof SyncsIssueStatus) {
            throw new InvalidArgumentException("{$provider->value} cannot sync statuses.");
        }

        return $tracker;
    }
```

- [ ] **Step 4: Jira (Cloud and Data Center)**

In `app/Support/Integrations/Trackers/JiraIssueTracker.php`:

1. Add the imports `use App\Support\Integrations\Exceptions\ProviderRejected;` and `use Carbon\CarbonImmutable;`, and declare `abstract class JiraIssueTracker implements IssueTracker, SyncsIssueStatus`.
2. Replace `private const BaseFields = ['summary', 'description', 'assignee', 'status'];` with:

```php
    private const BaseFields = ['summary', 'description', 'assignee', 'status', 'updated', 'project'];

    public const ProjectKeyPattern = '/^[A-Z][A-Z0-9_]{0,49}\z/';
```

3. Replace the body of `issues()` with `return $this->issuesMatching($integration, $externalIds, null);`.
4. In `issue()`, add after the `status:` argument of `new TrackerIssue(`:

```php
            issueStatus: $this->issueStatus($fields),
```

5. Add after `writeEstimate()`:

```php
    public function changedIssues(TeamIntegration $integration, array $externalIds, CarbonImmutable $since): array
    {
        return $this->issuesMatching($integration, $externalIds, $since);
    }

    public function statuses(TeamIntegration $integration, string $container): array
    {
        if (preg_match(self::ProjectKeyPattern, $container) !== 1) {
            return [];
        }

        $statuses = [];

        foreach ($this->api()->get($integration, $this->api()->apiPath("project/{$container}/statuses")) as $issueType) {
            foreach ((array) (is_array($issueType) ? ($issueType['statuses'] ?? []) : []) as $status) {
                $id = is_array($status) ? ($status['id'] ?? null) : null;

                if (! is_string($id) && ! is_int($id)) {
                    continue;
                }

                $statuses[(string) $id] = [
                    'id' => (string) $id,
                    'name' => is_string($status['name'] ?? null) ? $status['name'] : (string) $id,
                    'category' => DoneMapping::category($integration->provider, (string) data_get($status, 'statusCategory.key', 'new'))->value,
                ];
            }
        }

        return array_values($statuses);
    }
```

6. Add before `estimate()`:

```php
    /**
     * Jira refuses a whole `id in (…)` query when one of the ids no longer
     * exists; that chunk is then read issue by issue, so deleted or hidden
     * issues are simply absent.
     *
     * @param  array<int, string>  $externalIds
     * @return array<string, TrackerIssue>
     */
    private function issuesMatching(TeamIntegration $integration, array $externalIds, ?CarbonImmutable $updatedSince): array
    {
        $ids = array_values(array_unique(array_filter($externalIds, fn (string $id): bool => ctype_digit($id))));
        $updated = $updatedSince === null ? '' : ' AND updated >= "-'.self::minutesSince($updatedSince).'m"';
        $issues = [];

        foreach (array_chunk($ids, self::PreviewLimit) as $chunk) {
            try {
                $found = $this->searchJql($integration, 'id in ('.implode(',', $chunk).')'.$updated)->issues;
            } catch (ProviderRejected $exception) {
                if ($exception->httpStatus !== 400) {
                    throw $exception;
                }

                $found = $this->readOneByOne($integration, $chunk, $updatedSince);
            }

            foreach ($found as $issue) {
                $issues[$issue->externalId] = $issue;
            }
        }

        return $issues;
    }

    /**
     * @param  array<int, string>  $ids  digits only
     * @return array<int, TrackerIssue>
     */
    private function readOneByOne(TeamIntegration $integration, array $ids, ?CarbonImmutable $updatedSince): array
    {
        $issues = [];

        foreach ($ids as $id) {
            try {
                $raw = $this->api()->get($integration, $this->api()->apiPath("issue/{$id}"), [
                    'fields' => implode(',', $this->requestedFields($integration)),
                ]);
            } catch (ProviderRejected $exception) {
                if (in_array($exception->httpStatus, [403, 404], true)) {
                    continue;
                }

                throw $exception;
            }

            $issue = $this->issue($integration, $raw);
            $updatedAt = $issue?->issueStatus?->updatedAt;

            if ($issue === null || ($updatedSince !== null && ($updatedAt === null || $updatedAt->lt($updatedSince)))) {
                continue;
            }

            $issues[] = $issue;
        }

        return $issues;
    }

    /**
     * Relative minutes keep the query independent of the Jira user's time zone.
     */
    private static function minutesSince(CarbonImmutable $since): int
    {
        return max(1, (int) ceil($since->diffInSeconds(now(), true) / 60));
    }

    /**
     * @param  array<array-key, mixed>  $fields
     */
    private function issueStatus(array $fields): ?IssueStatus
    {
        $id = data_get($fields, 'status.id');

        if (! is_string($id) && ! is_int($id)) {
            return null;
        }

        $kind = data_get($fields, 'status.statusCategory.key');
        $project = data_get($fields, 'project.key');

        return new IssueStatus(
            id: (string) $id,
            name: TrackerIssue::shorten(data_get($fields, 'status.name'), TrackerIssue::AssigneeLength),
            kind: is_string($kind) ? $kind : 'undefined',
            container: is_string($project) ? $project : null,
            updatedAt: IssueStatus::time($fields['updated'] ?? null),
        );
    }
```

In `tests/Feature/Integrations/IssueTrackersTest.php`, change the asserted field list `['summary', 'description', 'assignee', 'status', 'customfield_10016']` to `['summary', 'description', 'assignee', 'status', 'updated', 'project', 'customfield_10016']`; update any other assertion of the requested Jira fields the same way (`grep -rn "'assignee', 'status'" tests`).

- [ ] **Step 5: Linear**

In `app/Support/Integrations/Trackers/LinearTracker.php`:

1. Add `use Carbon\CarbonImmutable;` and declare `class LinearTracker implements IssueTracker, SyncsIssueStatus`.
2. Replace the `IssueFields` constant and add the key pattern:

```php
    private const IssueFields = 'id identifier title description url estimate updatedAt assignee { displayName } state { id name type } team { key }';

    public const TeamKeyPattern = '/^[A-Z][A-Z0-9_]{0,49}\z/';
```

3. In `issue()`, add after the `status:` argument: `issueStatus: $this->issueStatus($node),`.
4. Add after `writeEstimate()`:

```php
    public function changedIssues(TeamIntegration $integration, array $externalIds, CarbonImmutable $since): array
    {
        $issues = [];

        foreach (array_chunk(array_values(array_unique($externalIds)), self::PreviewLimit) as $chunk) {
            $data = $this->client->query(
                $integration,
                'query($ids: [ID!], $since: DateTimeOrDuration) { issues(first: '.self::PreviewLimit.', filter: {id: {in: $ids}, updatedAt: {gte: $since}}) { nodes { '.self::IssueFields.' } } }',
                ['ids' => $chunk, 'since' => $since->utc()->toIso8601ZuluString()],
            );

            foreach ($this->list((array) data_get($data, 'issues', []))->issues as $issue) {
                $issues[$issue->externalId] = $issue;
            }
        }

        return $issues;
    }

    public function statuses(TeamIntegration $integration, string $container): array
    {
        if (preg_match(self::TeamKeyPattern, $container) !== 1) {
            return [];
        }

        $data = $this->client->query(
            $integration,
            'query($key: String!) { teams(first: 1, filter: {key: {eq: $key}}) { nodes { states(first: 100) { nodes { id name type position } } } } }',
            ['key' => $container],
        );

        return array_map(fn (array $state): array => [
            'id' => $state['id'],
            'name' => $state['name'],
            'category' => DoneMapping::category($integration->provider, $state['type'])->value,
        ], self::states((array) data_get($data, 'teams.nodes.0.states.nodes', [])));
    }

    /**
     * Workflow states ordered by their position in the team's workflow.
     *
     * @param  array<array-key, mixed>  $nodes
     * @return array<int, array{id: string, name: string, type: string, position: float}>
     */
    private static function states(array $nodes): array
    {
        $states = [];

        foreach ($nodes as $state) {
            if (is_array($state) && is_string($state['id'] ?? null) && is_string($state['type'] ?? null)) {
                $states[] = [
                    'id' => $state['id'],
                    'name' => is_string($state['name'] ?? null) ? $state['name'] : $state['id'],
                    'type' => $state['type'],
                    'position' => is_numeric($state['position'] ?? null) ? (float) $state['position'] : 0.0,
                ];
            }
        }

        usort($states, fn (array $first, array $second): int => $first['position'] <=> $second['position']);

        return $states;
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function issueStatus(array $node): ?IssueStatus
    {
        $id = data_get($node, 'state.id');

        if (! is_string($id)) {
            return null;
        }

        $type = data_get($node, 'state.type');
        $team = data_get($node, 'team.key');

        return new IssueStatus(
            id: $id,
            name: TrackerIssue::shorten(data_get($node, 'state.name'), TrackerIssue::AssigneeLength),
            kind: is_string($type) ? $type : 'unstarted',
            container: is_string($team) ? $team : null,
            updatedAt: IssueStatus::time($node['updatedAt'] ?? null),
        );
    }
```

- [ ] **Step 6: GitHub**

In `app/Support/Integrations/Trackers/GitHubTracker.php`:

1. Add `use Carbon\CarbonImmutable;` and declare `class GitHubTracker implements IssueTracker, SyncsIssueStatus`; add `private const ChangedPages = 10;`.
2. In `issue()`, add after the `status:` argument: `issueStatus: $this->issueStatus($repositoryId, $raw),`.
3. Add after `writeEstimate()`:

```php
    /**
     * One listing per repository with tracked issues, matched in memory:
     * GitHub cannot filter issues by number and update time together.
     */
    public function changedIssues(TeamIntegration $integration, array $externalIds, CarbonImmutable $since): array
    {
        $numbersByRepository = [];

        foreach (array_unique($externalIds) as $externalId) {
            $reference = self::issueReference($externalId);

            if ($reference !== null) {
                $numbersByRepository[$reference[0]][$reference[1]] = true;
            }
        }

        $issues = [];

        foreach ($numbersByRepository as $repositoryId => $numbers) {
            foreach ($this->changedInRepository($integration, (string) $repositoryId, $since) as $raw) {
                if (! isset($numbers[(string) $raw['number']])) {
                    continue;
                }

                $issue = $this->issue((string) $repositoryId, $raw);

                if ($issue !== null) {
                    $issues[$issue->externalId] = $issue;
                }
            }
        }

        return $issues;
    }

    public function statuses(TeamIntegration $integration, string $container): array
    {
        return [];
    }

    /**
     * @return array<int, array<array-key, mixed>> issues (never pull requests) updated since `$since`
     */
    private function changedInRepository(TeamIntegration $integration, string $repositoryId, CarbonImmutable $since): array
    {
        try {
            $fullName = $this->client->repositoryName($integration, $repositoryId);
        } catch (ProviderRejected $exception) {
            if ($exception->httpStatus === 404) {
                return [];
            }

            throw $exception;
        }

        $changed = [];

        for ($page = 1; $page <= self::ChangedPages; $page++) {
            $response = $this->client->response($integration, 'GET', "repos/{$fullName}/issues", [
                'since' => $since->utc()->toIso8601ZuluString(),
                'state' => 'all',
                'sort' => 'updated',
                'direction' => 'desc',
                'per_page' => self::PreviewLimit,
                'page' => $page,
            ]);

            foreach ((array) $response->json() as $raw) {
                if (is_array($raw) && ! isset($raw['pull_request']) && is_int($raw['number'] ?? null)) {
                    $changed[] = $raw;
                }
            }

            if (! GitHubClient::hasNextPage($response)) {
                break;
            }
        }

        return $changed;
    }

    /**
     * Accepts the REST shape (`state_reason`, `updated_at`) and the GraphQL
     * one (`stateReason`, `updatedAt`, upper case).
     *
     * @param  array<array-key, mixed>  $raw
     */
    private function issueStatus(string $repositoryId, array $raw): ?IssueStatus
    {
        $state = strtolower((string) ($raw['state'] ?? ''));

        if (! in_array($state, ['open', 'closed'], true)) {
            return null;
        }

        $reason = strtolower((string) ($raw['state_reason'] ?? $raw['stateReason'] ?? ''));

        $kind = match (true) {
            $state === 'open' => IssueStatus::GitHubOpen,
            $reason === 'not_planned' => IssueStatus::GitHubNotPlanned,
            default => IssueStatus::GitHubCompleted,
        };

        return new IssueStatus(
            id: $state,
            name: $state,
            kind: $kind,
            container: $repositoryId,
            updatedAt: IssueStatus::time($raw['updated_at'] ?? $raw['updatedAt'] ?? null),
        );
    }
```

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IssueStatusReadsTest.php tests/Feature/Integrations/IssueTrackersTest.php tests/Feature/Integrations/PokerImportTest.php tests/Feature/Integrations/PokerEstimateSyncTest.php tests/Feature/Integrations/JiraDataCenterTrackerTest.php tests/Feature/Integrations/GitHubTrackerTest.php tests/Feature/Mcp/TrackerToolsTest.php`
Expected: PASS. Then `vendor/bin/sail bin pint --dirty --format agent` and `vendor/bin/sail bin phpstan analyse --no-progress` (0 errors).

- [ ] **Step 8: Commit**

```bash
git add app/Support/Integrations/Trackers tests/Feature/Integrations/IssueStatusReadsTest.php tests/Feature/Integrations/IssueTrackersTest.php
git commit -m "feat(integrations): read issue statuses and changed issues from every tracker"
```

(Attribution trailer and `Claude-Session` line per Global Constraints on every commit.)

---

### Task 2: Moving issues to done or open in each tracker

`transition()` reads the issue, does nothing when it is already in the target state, and otherwise moves it with the rules of spec §5.2.

**Files:**
- Create: `app/Support/Integrations/Jira/JiraTransitions.php`, `app/Support/Integrations/Exceptions/StatusPushRejected.php`, `tests/Feature/Integrations/IssueTransitionsTest.php`
- Modify: `app/Support/Integrations/Trackers/{SyncsIssueStatus,JiraIssueTracker,LinearTracker,GitHubTracker}.php`

**Interfaces:**
- Consumes: Task 1 (`IssueStatus`, `DoneMapping`, `SyncsIssueStatus`, `LinearTracker::states()`); 14c `GitHubTracker::fetch()` (private, same class), `GitHubClient::patch()`.
- Produces: `SyncsIssueStatus::transition(TeamIntegration, string $externalId, ExternalIssueState $target): ?TrackerIssue` (null = the source no longer has the issue; throws `StatusPushRejected` with the user-facing reason); `StatusPushRejected::unavailable(IntegrationProvider, string $key, ExternalIssueState)`; `JiraTransitions::{choose, requiredFields}`.

- [ ] **Step 1: Write the failing test**

Add to `tests/Pest.php` (Task 3 reuses them; `HttpRequest` is the existing alias of `Illuminate\Http\Client\Request` there):

```php
/**
 * @param  array<string, mixed>  $fields
 * @return array<string, mixed>
 */
function jiraTransition(string $id, string $toId, string $toName, string $category, array $fields = []): array
{
    return ['id' => $id, 'name' => $toName, 'to' => ['id' => $toId, 'name' => $toName, 'statusCategory' => ['key' => $category]], 'fields' => $fields];
}

/**
 * Jira Cloud issue 10001 (PROJ-1) reads as `$before`, then as `$after`
 * once a transition was posted.
 *
 * @param  array<string, mixed>  $before
 * @param  array<string, mixed>  $after
 * @param  array<int, array<string, mixed>>  $transitions
 */
function fakeJiraTransitions(array $before, array $after, array $transitions): void
{
    $posted = false;

    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => function () use (&$posted, $before, $after) {
            return Http::response(['issues' => [jiraTrackerIssue('10001', 'PROJ-1', $posted ? $after : $before)], 'isLast' => true]);
        },
        jiraApiUrl('rest/api/3/issue/10001/transitions*') => function (HttpRequest $request) use (&$posted, $transitions) {
            if ($request->method() === 'POST') {
                $posted = true;

                return Http::response(null, 204);
            }

            return Http::response(['transitions' => $transitions]);
        },
    ]);
}
```

Create `tests/Feature/Integrations/IssueTransitionsTest.php`:

```php
<?php

use App\Enums\ExternalIssueState;
use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\StatusPushRejected;
use App\Support\Integrations\Trackers\Trackers;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    $this->jiraOpen = ['status' => ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']], 'project' => ['key' => 'PROJ']];
    $this->jiraDone = ['status' => ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']], 'project' => ['key' => 'PROJ']];
});

function jiraTransitionRequest(): ?Request
{
    return collect(Http::recorded())
        ->map(fn (array $pair): Request => $pair[0])
        ->first(fn (Request $request): bool => $request->method() === 'POST' && str_ends_with($request->url(), '/transitions'));
}

function jiraSyncIntegration(array $settings = []): TeamIntegration
{
    enableIntegrations(IntegrationProvider::Jira);
    $integration = TeamIntegration::factory()->jira()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => true, ...$settings]])->save();

    return $integration;
}

it('moves a Jira issue through the preferred done transition', function () {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraOpen, $this->jiraDone, [
        jiraTransition('11', '3', 'In Progress', 'indeterminate'),
        jiraTransition('21', '10005', 'Closed', 'done'),
        jiraTransition('31', '10002', 'Done', 'done'),
    ]);

    $issue = app(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done);

    expect(jiraTransitionRequest()?->data())->toBe(['transition' => ['id' => '31']])
        ->and($issue?->issueStatus?->kind)->toBe('done');
    Http::assertSent(fn (Request $request) => $request->method() === 'GET'
        && str_contains($request->url(), '/rest/api/3/issue/10001/transitions?expand=transitions.fields'));
});

it('uses the configured complete status, else only the listed done statuses', function (array $mapping, string $expected) {
    $integration = jiraSyncIntegration(['statusMapping' => ['projects' => ['PROJ' => $mapping]]]);
    fakeJiraTransitions($this->jiraOpen, $this->jiraDone, [
        jiraTransition('21', '10005', 'Closed', 'done'),
        jiraTransition('31', '10002', 'Done', 'done'),
    ]);

    app(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done);

    expect(jiraTransitionRequest()?->data())->toBe(['transition' => ['id' => $expected]]);
})->with([
    'configured target' => [['completeStatusId' => '10005'], '21'],
    'listed done statuses' => [['doneStatusIds' => ['10005']], '21'],
]);

it('reopens to the configured status, else the first new then in-progress one', function (array $mapping, array $transitions, string $expected) {
    $integration = jiraSyncIntegration(['statusMapping' => ['projects' => ['PROJ' => $mapping]]]);
    fakeJiraTransitions($this->jiraDone, $this->jiraOpen, $transitions);

    app(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Open);

    expect(jiraTransitionRequest()?->data())->toBe(['transition' => ['id' => $expected]]);
})->with([
    'first new' => [[], [jiraTransition('41', '3', 'In Progress', 'indeterminate'), jiraTransition('51', '10000', 'To Do', 'new')], '51'],
    'in progress when no new' => [[], [jiraTransition('41', '3', 'In Progress', 'indeterminate')], '41'],
    'configured' => [['reopenStatusId' => '3'], [jiraTransition('41', '3', 'In Progress', 'indeterminate'), jiraTransition('51', '10000', 'To Do', 'new')], '41'],
]);

it('fills a required resolution', function (array $allowed, string $expected) {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraOpen, $this->jiraDone, [jiraTransition('31', '10002', 'Done', 'done', [
        'resolution' => ['required' => true, 'hasDefaultValue' => false, 'allowedValues' => $allowed],
    ])]);

    app(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done);

    expect(jiraTransitionRequest()?->data())->toBe(['transition' => ['id' => '31'], 'fields' => ['resolution' => ['name' => $expected]]]);
})->with([
    'done first' => [[['name' => "Won't Do"], ['name' => 'Fixed'], ['name' => 'Done']], 'Done'],
    'fixed next' => [[['name' => "Won't Do"], ['name' => 'Fixed']], 'Fixed'],
    'first otherwise' => [[['name' => 'Duplicate'], ['name' => "Won't Do"]], 'Duplicate'],
]);

it('refuses a transition that needs other fields', function () {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraOpen, $this->jiraDone, [jiraTransition('31', '10002', 'Done', 'done', [
        'customfield_10050' => ['required' => true, 'hasDefaultValue' => false],
    ])]);

    expect(fn () => app(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done))
        ->toThrow(StatusPushRejected::class, 'Jira requires more fields to close PROJ-1. Close it in Jira.');
    expect(jiraTransitionRequest())->toBeNull();
});

it('explains when no transition reaches the target', function () {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraOpen, $this->jiraDone, [jiraTransition('11', '3', 'In Progress', 'indeterminate')]);

    expect(fn () => app(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done))
        ->toThrow(StatusPushRejected::class, 'No transition to a done status is available for PROJ-1.');
});

it('skips the transition when the issue is already there', function () {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraDone, $this->jiraDone, []);

    $issue = app(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Done);

    expect($issue?->key)->toBe('PROJ-1');
    Http::assertNotSent(fn (Request $request) => str_contains($request->url(), '/transitions'));
});

it('transitions Jira Data Center issues through REST v2', function () {
    enableIntegrations(IntegrationProvider::JiraDataCenter);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    $posted = false;
    Http::fake([
        jiraDataCenterUrl('rest/api/2/search') => function () use (&$posted) {
            return Http::response(['total' => 1, 'issues' => [jiraTrackerIssue('10001', 'OPS-1', [
                'description' => null,
                'project' => ['key' => 'OPS'],
                'status' => $posted
                    ? ['id' => '6', 'name' => 'Closed', 'statusCategory' => ['key' => 'done']]
                    : ['id' => '1', 'name' => 'Open', 'statusCategory' => ['key' => 'new']],
            ])]]);
        },
        jiraDataCenterUrl('rest/api/2/issue/10001/transitions*') => function (Request $request) use (&$posted) {
            $posted = $posted || $request->method() === 'POST';

            return $request->method() === 'POST'
                ? Http::response(null, 204)
                : Http::response(['transitions' => [jiraTransition('2', '6', 'Closed', 'done')]]);
        },
    ]);

    $issue = app(Trackers::class)->syncing(IntegrationProvider::JiraDataCenter)->transition($integration, '10001', ExternalIssueState::Done);

    expect($issue?->status)->toBe('Closed');
    Http::assertSent(fn (Request $request) => $request->method() === 'POST' && $request->url() === 'https://jira.example.com/rest/api/2/issue/10001/transitions');
});

it('moves Linear issues to the first completed or unstarted state', function (array $settings, ExternalIssueState $target, string $expected) {
    enableIntegrations(IntegrationProvider::Linear);
    $integration = TeamIntegration::factory()->linear()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => true, ...$settings]])->save();
    $current = $target === ExternalIssueState::Done ? 'unstarted' : 'completed';
    $mutations = [];
    fakeLinearGraphql([
        'issueUpdate' => function (array $variables) use (&$mutations, &$current, $target) {
            $mutations[] = $variables;
            $current = $target === ExternalIssueState::Done ? 'completed' : 'unstarted';

            return ['issueUpdate' => ['success' => true]];
        },
        'states(first' => ['issue' => ['team' => ['states' => ['nodes' => [
            ['id' => 'st-done-late', 'name' => 'Shipped', 'type' => 'completed', 'position' => 5],
            ['id' => 'st-done', 'name' => 'Done', 'type' => 'completed', 'position' => 2],
            ['id' => 'st-todo', 'name' => 'Todo', 'type' => 'unstarted', 'position' => 1],
            ['id' => 'st-backlog', 'name' => 'Backlog', 'type' => 'backlog', 'position' => 0],
        ]]]]],
        'issues(' => function () use (&$current) {
            return ['issues' => ['nodes' => [linearTrackerIssue('lin-1', 'ENG-1', [
                'state' => ['id' => "st-{$current}", 'name' => $current, 'type' => $current],
                'team' => ['key' => 'ENG'],
            ])]]];
        },
    ]);

    app(Trackers::class)->syncing(IntegrationProvider::Linear)->transition($integration, 'lin-1', $target);

    expect($mutations)->toBe([['id' => 'lin-1', 'stateId' => $expected]]);
})->with([
    'complete' => [[], ExternalIssueState::Done, 'st-done'],
    'complete configured' => [['statusMapping' => ['teams' => ['ENG' => ['completeStateId' => 'st-done-late']]]], ExternalIssueState::Done, 'st-done-late'],
    'reopen' => [[], ExternalIssueState::Open, 'st-todo'],
]);

it('closes GitHub issues as completed and reopens them', function (string $state, ExternalIssueState $target, array $expected) {
    enableIntegrations(IntegrationProvider::GitHub);
    $integration = TeamIntegration::factory()->gitHub()->create();
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/3' => Http::response(gitHubIssue(3, ['state' => $state])),
        'api.github.com/repos/acme/api/issues/3' => fn (Request $request) => Http::response(gitHubIssue(3, [
            'state' => $request['state'],
            'state_reason' => $request['state_reason'] ?? null,
        ])),
    ]);

    $issue = app(Trackers::class)->syncing(IntegrationProvider::GitHub)->transition($integration, '9001/3', $target);

    expect($issue?->issueStatus?->id)->toBe($expected['state']);
    Http::assertSent(fn (Request $request) => $request->method() === 'PATCH'
        && $request->url() === 'https://api.github.com/repos/acme/api/issues/3'
        && $request->data() === $expected);
})->with([
    'close' => ['open', ExternalIssueState::Done, ['state' => 'closed', 'state_reason' => 'completed']],
    'reopen' => ['closed', ExternalIssueState::Open, ['state' => 'open']],
]);

it('answers null for issues the source no longer has', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    $integration = TeamIntegration::factory()->gitHub()->create();
    fakeGitHubTrackerApi(['api.github.com/repositories/9001/issues/3' => Http::response(['message' => 'Not Found'], 404)]);

    expect(app(Trackers::class)->syncing(IntegrationProvider::GitHub)->transition($integration, '9001/3', ExternalIssueState::Done))->toBeNull();
    Http::assertNotSent(fn (Request $request) => $request->method() === 'PATCH');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IssueTransitionsTest.php`
Expected: FAIL — `Call to undefined method …::transition()` / class `StatusPushRejected` not found.

- [ ] **Step 3: The rejection and the interface**

Create `app/Support/Integrations/Exceptions/StatusPushRejected.php`:

```php
<?php

namespace App\Support\Integrations\Exceptions;

use App\Enums\ExternalIssueState;
use App\Enums\IntegrationProvider;

/**
 * The source cannot take the status change skrum asks for (spec 8 §5.2);
 * retrying would not help, so the push fails with this reason.
 */
class StatusPushRejected extends IntegrationException
{
    public static function unavailable(IntegrationProvider $provider, string $key, ExternalIssueState $target): self
    {
        return new self($provider, $target === ExternalIssueState::Done
            ? __('No transition to a done status is available for :key.', ['key' => $key])
            : __('No transition to an open status is available for :key.', ['key' => $key]));
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

In `app/Support/Integrations/Trackers/SyncsIssueStatus.php`, add `use App\Enums\ExternalIssueState;`, `use App\Support\Integrations\Exceptions\StatusPushRejected;` and:

```php
    /**
     * Moves the issue to open or done (spec 8 §5.2) unless it is there
     * already, and returns it as the source now has it; null when the
     * source no longer has the issue.
     *
     * @throws StatusPushRejected when no transition or state can be used
     */
    public function transition(TeamIntegration $integration, string $externalId, ExternalIssueState $target): ?TrackerIssue;
```

- [ ] **Step 4: Jira transitions**

Create `app/Support/Integrations/Jira/JiraTransitions.php`:

```php
<?php

namespace App\Support\Integrations\Jira;

use App\Enums\ExternalIssueState;
use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\StatusPushRejected;
use App\Support\Integrations\Trackers\DoneMapping;

/**
 * Chooses the Jira transition for a status push (spec 8 §5.2): the
 * configured target, else a done-category target preferring "Done",
 * "Closed", "Resolved" (restricted to the project's done statuses), or for
 * a reopen the first `new`, then `indeterminate` target.
 */
class JiraTransitions
{
    private const PreferredDoneNames = ['Done', 'Closed', 'Resolved'];

    private const PreferredResolutions = ['Done', 'Fixed'];

    private const ReopenCategories = ['new', 'indeterminate'];

    /**
     * @param  array<array-key, mixed>  $transitions  as `GET issue/{id}/transitions?expand=transitions.fields` lists them
     * @return array<array-key, mixed>|null
     */
    public static function choose(TeamIntegration $integration, ?string $project, array $transitions, ExternalIssueState $target): ?array
    {
        $available = array_values(array_filter($transitions, fn (mixed $transition): bool => is_array($transition)
            && (is_string($transition['id'] ?? null) || is_int($transition['id'] ?? null))
            && is_array($transition['to'] ?? null)));

        $configured = DoneMapping::configured($integration, $project, $target === ExternalIssueState::Done ? 'completeStatusId' : 'reopenStatusId');

        foreach ($available as $transition) {
            if ($configured !== null && self::targetId($transition) === $configured) {
                return $transition;
            }
        }

        return $target === ExternalIssueState::Done
            ? self::doneTransition($integration, $project, $available)
            : self::reopenTransition($available);
    }

    /**
     * Fields the transition screen requires: `resolution` is filled with
     * "Done", else "Fixed", else the first allowed value; any other
     * required field without a default stops the push.
     *
     * @param  array<array-key, mixed>  $transition
     * @return array<string, mixed>
     */
    public static function requiredFields(IntegrationProvider $provider, array $transition, string $key, ExternalIssueState $target): array
    {
        $fields = [];

        foreach ((array) ($transition['fields'] ?? []) as $fieldId => $field) {
            if (! is_array($field) || ($field['required'] ?? false) !== true || ($field['hasDefaultValue'] ?? false) === true) {
                continue;
            }

            $resolution = $fieldId === 'resolution' ? self::resolution($field) : null;

            if ($resolution === null) {
                throw new StatusPushRejected($provider, $target === ExternalIssueState::Done
                    ? __('Jira requires more fields to close :key. Close it in Jira.', ['key' => $key])
                    : __('Jira requires more fields to reopen :key. Reopen it in Jira.', ['key' => $key]));
            }

            $fields['resolution'] = ['name' => $resolution];
        }

        return $fields;
    }

    /**
     * @param  array<int, array<array-key, mixed>>  $available
     * @return array<array-key, mixed>|null
     */
    private static function doneTransition(TeamIntegration $integration, ?string $project, array $available): ?array
    {
        $doneIds = DoneMapping::doneStatusIds($integration, $project);
        $candidates = array_values(array_filter($available, fn (array $transition): bool => self::category($transition) === 'done'
            && ($doneIds === null || in_array(self::targetId($transition), $doneIds, true))));

        foreach (self::PreferredDoneNames as $name) {
            foreach ($candidates as $transition) {
                if (data_get($transition, 'to.name') === $name) {
                    return $transition;
                }
            }
        }

        return $candidates[0] ?? null;
    }

    /**
     * @param  array<int, array<array-key, mixed>>  $available
     * @return array<array-key, mixed>|null
     */
    private static function reopenTransition(array $available): ?array
    {
        foreach (self::ReopenCategories as $category) {
            foreach ($available as $transition) {
                if (self::category($transition) === $category) {
                    return $transition;
                }
            }
        }

        return null;
    }

    /**
     * @param  array<array-key, mixed>  $field
     */
    private static function resolution(array $field): ?string
    {
        $names = collect((array) ($field['allowedValues'] ?? []))
            ->map(fn (mixed $value): mixed => data_get($value, 'name'))
            ->filter(fn (mixed $name): bool => is_string($name) && $name !== '')
            ->values();

        foreach (self::PreferredResolutions as $preferred) {
            if ($names->contains($preferred)) {
                return $preferred;
            }
        }

        $first = $names->first();

        return is_string($first) ? $first : null;
    }

    /**
     * @param  array<array-key, mixed>  $transition
     */
    private static function targetId(array $transition): string
    {
        $id = data_get($transition, 'to.id');

        return is_string($id) || is_int($id) ? (string) $id : '';
    }

    /**
     * @param  array<array-key, mixed>  $transition
     */
    private static function category(array $transition): ?string
    {
        $key = data_get($transition, 'to.statusCategory.key');

        return is_string($key) ? $key : null;
    }
}
```

In `app/Support/Integrations/Trackers/JiraIssueTracker.php`, add the imports `App\Enums\ExternalIssueState`, `App\Support\Integrations\Exceptions\StatusPushRejected`, `App\Support\Integrations\Jira\JiraTransitions`, and after `statuses()`:

```php
    public function transition(TeamIntegration $integration, string $externalId, ExternalIssueState $target): ?TrackerIssue
    {
        $issue = ctype_digit($externalId) ? ($this->issues($integration, [$externalId])[$externalId] ?? null) : null;

        if ($issue === null || $issue->issueStatus === null) {
            return null;
        }

        if (DoneMapping::state($integration, $issue->issueStatus) === $target) {
            return $issue;
        }

        $path = $this->api()->apiPath("issue/{$externalId}/transitions");
        $transitions = (array) ($this->api()->get($integration, $path, ['expand' => 'transitions.fields'])['transitions'] ?? []);
        $transition = JiraTransitions::choose($integration, $issue->issueStatus->container, $transitions, $target)
            ?? throw StatusPushRejected::unavailable($integration->provider, $issue->key, $target);

        $body = ['transition' => ['id' => (string) $transition['id']]];
        $fields = JiraTransitions::requiredFields($integration->provider, $transition, $issue->key, $target);

        if ($fields !== []) {
            $body['fields'] = $fields;
        }

        $this->api()->post($integration, $path, $body);

        return $this->issues($integration, [$externalId])[$externalId] ?? $issue;
    }
```

- [ ] **Step 5: Linear and GitHub transitions**

In `app/Support/Integrations/Trackers/LinearTracker.php`, add the imports `App\Enums\ExternalIssueState` and `App\Support\Integrations\Exceptions\StatusPushRejected`, and after `statuses()`:

```php
    public function transition(TeamIntegration $integration, string $externalId, ExternalIssueState $target): ?TrackerIssue
    {
        $issue = $this->issues($integration, [$externalId])[$externalId] ?? null;

        if ($issue === null || $issue->issueStatus === null) {
            return null;
        }

        if (DoneMapping::state($integration, $issue->issueStatus) === $target) {
            return $issue;
        }

        $data = $this->client->query(
            $integration,
            'query($id: String!) { issue(id: $id) { team { states(first: 100) { nodes { id name type position } } } } }',
            ['id' => $externalId],
        );
        $stateId = $this->targetState($integration, $issue->issueStatus->container, self::states((array) data_get($data, 'issue.team.states.nodes', [])), $target)
            ?? throw StatusPushRejected::unavailable($integration->provider, $issue->key, $target);

        $result = $this->client->query(
            $integration,
            'mutation($id: String!, $stateId: String!) { issueUpdate(id: $id, input: {stateId: $stateId}) { success } }',
            ['id' => $externalId, 'stateId' => $stateId],
        );

        if (data_get($result, 'issueUpdate.success') !== true) {
            throw new StatusPushRejected($integration->provider, __('Linear did not accept this status change.'));
        }

        return $this->issues($integration, [$externalId])[$externalId] ?? $issue;
    }

    /**
     * The configured state when the team still has it, else the first
     * `completed` state, or for a reopen the first `unstarted`, then
     * `backlog` state, in workflow order.
     *
     * @param  array<int, array{id: string, name: string, type: string, position: float}>  $states
     */
    private function targetState(TeamIntegration $integration, ?string $team, array $states, ExternalIssueState $target): ?string
    {
        $configured = DoneMapping::configured($integration, $team, $target === ExternalIssueState::Done ? 'completeStateId' : 'reopenStateId');

        if ($configured !== null && in_array($configured, array_column($states, 'id'), true)) {
            return $configured;
        }

        foreach ($target === ExternalIssueState::Done ? ['completed'] : ['unstarted', 'backlog'] as $type) {
            foreach ($states as $state) {
                if ($state['type'] === $type) {
                    return $state['id'];
                }
            }
        }

        return null;
    }
```

In `app/Support/Integrations/Trackers/GitHubTracker.php`, add `use App\Enums\ExternalIssueState;` and after `statuses()`:

```php
    public function transition(TeamIntegration $integration, string $externalId, ExternalIssueState $target): ?TrackerIssue
    {
        $reference = self::issueReference($externalId);
        $raw = $reference === null ? null : $this->fetch($integration, $reference[0], $reference[1]);
        $fullName = $raw === null ? null : self::fullName($raw);
        $issue = $raw === null || $reference === null ? null : $this->issue($reference[0], $raw);

        if ($reference === null || $fullName === null || $issue === null || $issue->issueStatus === null) {
            return null;
        }

        if (DoneMapping::state($integration, $issue->issueStatus) === $target) {
            return $issue;
        }

        $updated = $this->client->patch($integration, "repos/{$fullName}/issues/{$reference[1]}", $target === ExternalIssueState::Done
            ? ['state' => 'closed', 'state_reason' => 'completed']
            : ['state' => 'open']);

        return $this->issue($reference[0], $updated) ?? $issue;
    }
```

- [ ] **Step 6: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `No transition to a done status is available for :key.` | `Aucune transition vers un statut terminé n’est disponible pour :key.` | `No hay ninguna transición a un estado terminado disponible para :key.` | `Für :key ist kein Übergang in einen erledigten Status verfügbar.` |
| `No transition to an open status is available for :key.` | `Aucune transition vers un statut ouvert n’est disponible pour :key.` | `No hay ninguna transición a un estado abierto disponible para :key.` | `Für :key ist kein Übergang in einen offenen Status verfügbar.` |
| `Jira requires more fields to close :key. Close it in Jira.` | `Jira exige d’autres champs pour fermer :key. Fermez-le dans Jira.` | `Jira necesita más campos para cerrar :key. Ciérralo en Jira.` | `Jira verlangt weitere Felder, um :key zu schließen. Schließe es in Jira.` |
| `Jira requires more fields to reopen :key. Reopen it in Jira.` | `Jira exige d’autres champs pour rouvrir :key. Rouvrez-le dans Jira.` | `Jira necesita más campos para reabrir :key. Reábrelo en Jira.` | `Jira verlangt weitere Felder, um :key wieder zu öffnen. Öffne es in Jira wieder.` |
| `Linear did not accept this status change.` | `Linear n’a pas accepté ce changement de statut.` | `Linear no aceptó este cambio de estado.` | `Linear hat diese Statusänderung nicht angenommen.` |

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IssueTransitionsTest.php tests/Feature/Integrations/IssueStatusReadsTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 8: Commit**

```bash
git add app/Support/Integrations/Trackers app/Support/Integrations/Jira/JiraTransitions.php app/Support/Integrations/Exceptions/StatusPushRejected.php tests/Feature/Integrations/IssueTransitionsTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): move tracker issues to their done or open status"
```

---

### Task 3: Pushing skrum completions and reopenings to the source

A skrum-origin completion or reopening marks every link of the item as locally changed and queues one `PushActionItemState` per link whose connection syncs; the job reads the item's current state, transitions the issue and records the outcome; managers can retry.

**Files:**
- Create: `app/Support/Integrations/StatusSync.php`, `app/Actions/Integrations/{LinkStatusSync,RequestActionItemPush}.php`, `app/Listeners/QueueActionItemStatusPushes.php`, `app/Jobs/Integrations/PushActionItemState.php`, `app/Http/Controllers/Integrations/{RetroActionItemLinkSyncsController,WorkspaceActionItemLinkSyncsController}.php`, `tests/Feature/Integrations/ActionItemStatusPushTest.php`
- Modify: `app/Providers/AppServiceProvider.php`, `routes/web.php`, `tests/Pest.php`

**Interfaces:**
- Consumes: Task 2 (`Trackers::syncing()->transition()`, `StatusPushRejected`), Task 1 (`DoneMapping`), 14b (`ActionItemCompleted`/`ActionItemReopened` with `origin` and `actor`; the explicit `Event::listen` block in `AppServiceProvider::boot()`), `ActionItemExportGuard::authorize()`, `BroadcastActionItemChange`, `IntegrationErrors::sanitize()`, 14a link columns.
- Produces: `StatusSync::{isOn, webhookWatchedSince}`; `LinkStatusSync::integration(ActionItemExternalLink, Team): ?TeamIntegration`; `PushActionItemState($linkId)`; `QueueActionItemStatusPushes::{onActionItemCompleted, onActionItemReopened}`; routes `retros.action-items.external-links.sync.store`, `workspaces.actionItemLinkSyncs.store`; Pest helpers `statusSyncLink()`, `statusSyncIssue()`, `runStatusPush()`.

- [ ] **Step 1: Write the failing test**

Add to `tests/Pest.php` (import `App\Models\ActionItemExternalLink`, `App\Support\Integrations\Trackers\IssueStatus`, `App\Support\Integrations\Trackers\TrackerIssue`, `App\Jobs\Integrations\PushActionItemState`, `Carbon\CarbonImmutable` and `Illuminate\Support\Str` when missing):

```php
/**
 * An item of a completed retro exported to Jira `cloud-1` as PROJ-1
 * (issue 10001), with status sync on. The author created it on the board
 * and owns it on the workspace pages too.
 *
 * @param  array<string, mixed>  $link
 * @param  array<string, mixed>  $item
 * @return array{integration: TeamIntegration, item: ActionItem, link: ActionItemExternalLink, retro: Retro, author: User}
 */
function statusSyncLink(array $link = [], IntegrationAccess $access = IntegrationAccess::Write, array $item = [], bool $syncOn = true): array
{
    enableIntegrations(IntegrationProvider::Jira);
    [$retro, $actionItem, $author] = exportBoardItem($item);
    $actionItem->forceFill(['created_by_user_id' => $author->id])->save();
    $integration = TeamIntegration::factory()->jira($access)->create(['team_id' => $retro->team_id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => $syncOn, 'statusSyncSince' => '2026-10-01T00:00:00+00:00']])->save();
    $externalLink = ActionItemExternalLink::factory()->create([
        'action_item_id' => $actionItem->id,
        'external_id' => '10001',
        'external_key' => 'PROJ-1',
        'external_url' => 'https://acme.atlassian.net/browse/PROJ-1',
    ]);
    $externalLink->forceFill($link)->save();

    return [
        'integration' => $integration->fresh() ?? $integration,
        'item' => $actionItem->fresh() ?? $actionItem,
        'link' => $externalLink->fresh() ?? $externalLink,
        'retro' => $retro,
        'author' => $author,
    ];
}

/**
 * A tracker read as the trackers return it; `$kind` is the provider's
 * category (Jira `new`/`indeterminate`/`done`, Linear state type, GitHub
 * `open`/`completed`/`not_planned`).
 *
 * @param  array<string, mixed>  $overrides
 */
function statusSyncIssue(string $externalId, string $key, string $kind, ?string $updatedAt = '2026-10-07T10:00:00+00:00', array $overrides = []): TrackerIssue
{
    $name = (string) ($overrides['status'] ?? ($kind === 'done' || $kind === 'completed' ? 'Done' : 'To Do'));

    return new TrackerIssue(
        externalId: $externalId,
        key: $key,
        title: (string) ($overrides['title'] ?? "Issue {$key}"),
        description: $overrides['description'] ?? null,
        url: (string) ($overrides['url'] ?? "https://acme.atlassian.net/browse/{$key}"),
        assignee: $overrides['assignee'] ?? null,
        estimate: $overrides['estimate'] ?? null,
        status: $name,
        issueStatus: new IssueStatus(
            id: (string) ($overrides['statusId'] ?? ($kind === 'done' ? '10002' : '10000')),
            name: $name,
            kind: $kind,
            container: (string) ($overrides['container'] ?? Str::before($key, '-')),
            updatedAt: $updatedAt === null ? null : CarbonImmutable::parse($updatedAt),
        ),
    );
}

function runStatusPush(ActionItemExternalLink $link): PushActionItemState
{
    $job = (new PushActionItemState($link->id))->withFakeQueueInteractions();

    app()->call([$job, 'handle']);

    return $job;
}
```

Create `tests/Feature/Integrations/ActionItemStatusPushTest.php`:

```php
<?php

use App\Actions\ActionItems\ExternalSyncActor;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Enums\ActionItemStatus;
use App\Enums\ExternalIssueState;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Jobs\Integrations\PushActionItemState;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Participant;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
    $this->open = ['status' => ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']], 'project' => ['key' => 'PROJ']];
    $this->done = ['status' => ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']], 'project' => ['key' => 'PROJ']];
});

it('queues a push when a manager completes a synced item', function () {
    Queue::fake();
    ['item' => $item, 'retro' => $retro, 'author' => $author, 'link' => $link] = statusSyncLink();

    $this->actingAs($author)
        ->patchJson(route('workspaces.actionItems.update', [$retro->team->workspace, $item]), ['status' => 'completed'])
        ->assertOk();

    Queue::assertPushed(PushActionItemState::class, fn (PushActionItemState $job) => $job->linkId === $link->id);
    expect($link->fresh()->local_state_changed_at?->toIso8601String())->toBe('2026-10-07T10:30:00+00:00');
});

it('records the change but pushes nothing while sync is off', function () {
    Queue::fake();
    ['item' => $item, 'retro' => $retro, 'author' => $author, 'link' => $link] = statusSyncLink(syncOn: false);

    $this->actingAs($author)
        ->patchJson(route('workspaces.actionItems.update', [$retro->team->workspace, $item]), ['status' => 'completed'])
        ->assertOk();

    Queue::assertNotPushed(PushActionItemState::class);
    expect($link->fresh()->local_state_changed_at)->not->toBeNull();
});

it('does not push changes that came from the source', function () {
    Queue::fake();
    ['item' => $item, 'link' => $link] = statusSyncLink();

    DB::transaction(fn () => app(SetActionItemStatus::class)->handle(
        ActionItem::query()->whereKey($item->id)->lockForUpdate()->firstOrFail(),
        new ExternalSyncActor('jira', 'PROJ-1'),
        ActionItemStatus::Completed,
    ));

    Queue::assertNotPushed(PushActionItemState::class);
    expect($link->fresh()->local_state_changed_at)->toBeNull();
});

it('marks read-only connections instead of pushing', function () {
    Queue::fake();
    ['item' => $item, 'retro' => $retro, 'author' => $author, 'link' => $link] = statusSyncLink(access: IntegrationAccess::Read);

    $this->actingAs($author)
        ->patchJson(route('workspaces.actionItems.update', [$retro->team->workspace, $item]), ['status' => 'completed'])
        ->assertOk();

    Queue::assertNotPushed(PushActionItemState::class);
    expect($link->fresh()->sync_error)->toBe('This Jira connection is read-only.');
});

it('pushes the current item state and records the result', function () {
    Event::fake([TeamActionItemSaved::class]);
    ['item' => $item, 'link' => $link] = statusSyncLink(['sync_error' => 'Old failure']);
    $item->forceFill(['completed_at' => now()])->save();
    fakeJiraTransitions($this->open, $this->done, [jiraTransition('31', '10002', 'Done', 'done')]);

    runStatusPush($link);

    $link->refresh();
    expect($link->last_pushed_state)->toBe(ExternalIssueState::Done)
        ->and($link->last_pushed_at?->toIso8601String())->toBe('2026-10-07T10:30:00+00:00')
        ->and($link->external_state)->toBe(ExternalIssueState::Done)
        ->and($link->external_status_name)->toBe('Done')
        ->and($link->last_synced_at)->not->toBeNull()
        ->and($link->sync_error)->toBeNull();
    Event::assertDispatched(TeamActionItemSaved::class);
});

it('skips the transition when the issue is already in that state', function () {
    ['item' => $item, 'link' => $link] = statusSyncLink();
    $item->forceFill(['completed_at' => now()])->save();
    fakeJiraTransitions($this->done, $this->done, []);

    runStatusPush($link);

    Http::assertNotSent(fn (Request $request) => str_contains($request->url(), '/transitions'));
    expect($link->fresh()->external_state)->toBe(ExternalIssueState::Done);
});

it('records a push the source refuses', function () {
    ['item' => $item, 'link' => $link] = statusSyncLink();
    $item->forceFill(['completed_at' => now()])->save();
    fakeJiraTransitions($this->open, $this->done, [jiraTransition('11', '3', 'In Progress', 'indeterminate')]);

    runStatusPush($link);

    expect($link->fresh()->sync_error)->toBe('No transition to a done status is available for PROJ-1.');
});

it('marks a link missing when the issue is gone', function () {
    ['item' => $item, 'link' => $link] = statusSyncLink();
    $item->forceFill(['completed_at' => now()])->save();
    Http::fake([jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [], 'isLast' => true])]);

    runStatusPush($link);

    expect($link->fresh()->missing_at)->not->toBeNull()
        ->and($link->fresh()->sync_error)->toBeNull();
});

it('waits when the source rate limits', function () {
    ['item' => $item, 'link' => $link] = statusSyncLink();
    $item->forceFill(['completed_at' => now()])->save();
    Http::fake([jiraApiUrl('rest/api/3/search/jql') => Http::response(['errorMessages' => ['Slow down']], 429, ['Retry-After' => '30'])]);

    runStatusPush($link)->assertReleased(delay: 30);

    expect($link->fresh()->sync_error)->toBeNull();
});

it('records the final failure', function () {
    ['link' => $link] = statusSyncLink();

    (new PushActionItemState($link->id))->failed(new ProviderUnavailable(IntegrationProvider::Jira, 'down'));

    expect($link->fresh()->sync_error)->toBe((new ProviderUnavailable(IntegrationProvider::Jira, 'down'))->userMessage());
});

it('calls nothing when sync is off or the connection needs a reconnect', function () {
    ['link' => $off] = statusSyncLink(syncOn: false);
    ['link' => $reconnect, 'integration' => $integration] = statusSyncLink();
    $integration->forceFill(['status' => IntegrationStatus::ReconnectRequired])->save();

    runStatusPush($off);
    runStatusPush($reconnect);

    Http::assertNothingSent();
    expect($off->fresh()->sync_error)->toBeNull()
        ->and($reconnect->fresh()->sync_error)->toBe('Reconnect Jira in the team settings.');
});

it('lets managers retry a failed push from the board and the workspace', function () {
    Queue::fake();
    ['item' => $item, 'retro' => $retro, 'author' => $author, 'link' => $link] = statusSyncLink(['sync_error' => 'Boom']);

    $this->actingAs($author)
        ->postJson(route('retros.action-items.external-links.sync.store', [$retro, $item, $link]))
        ->assertStatus(202)
        ->assertJsonPath('actionItem.id', $item->id);

    $this->actingAs($author)
        ->postJson(route('workspaces.actionItemLinkSyncs.store', [$retro->team->workspace, $item, $link]))
        ->assertStatus(202);

    Queue::assertPushed(PushActionItemState::class, 2);
    expect($link->fresh()->sync_error)->toBeNull();
});

it('refuses guests and non-managers before anything else', function () {
    Queue::fake();
    ['item' => $item, 'retro' => $retro, 'link' => $link, 'integration' => $integration] = statusSyncLink();
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => false]])->save();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    [$member] = retroMember($retro);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->postJson(route('retros.action-items.external-links.sync.store', [$retro, $item, $link]))
        ->assertForbidden();

    $this->actingAs($member)
        ->postJson(route('retros.action-items.external-links.sync.store', [$retro, $item, $link]))
        ->assertForbidden();

    Queue::assertNothingPushed();
});

it('answers 409 when the push cannot happen and 404 for a link of another item', function () {
    Queue::fake();
    ['item' => $item, 'retro' => $retro, 'author' => $author, 'link' => $link, 'integration' => $integration] = statusSyncLink();
    $route = route('retros.action-items.external-links.sync.store', [$retro, $item, $link]);

    $integration->forceFill(['access' => IntegrationAccess::Read])->save();
    $this->actingAs($author)->postJson($route)->assertStatus(409);

    $integration->forceFill(['access' => IntegrationAccess::Write, 'settings' => [...$integration->settings, 'statusSync' => false]])->save();
    $this->actingAs($author)->postJson($route)->assertStatus(409)->assertJsonPath('message', 'Turn on status sync for Jira first.');

    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => true]])->save();
    $link->forceFill(['external_site' => 'cloud-2'])->save();
    $this->actingAs($author)->postJson($route)->assertStatus(409)->assertJsonPath('message', 'This issue belongs to another Jira site.');

    $other = ActionItemExternalLink::factory()->create();
    $this->actingAs($author)
        ->postJson(route('retros.action-items.external-links.sync.store', [$retro, $item, $other]))
        ->assertNotFound();

    Queue::assertNothingPushed();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ActionItemStatusPushTest.php`
Expected: FAIL — class `App\Jobs\Integrations\PushActionItemState` not found.

- [ ] **Step 3: The opt-in and the link's connection**

Create `app/Support/Integrations/StatusSync.php`:

```php
<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationCapability;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\IssueStatus;
use Carbon\CarbonImmutable;

/**
 * The opt-in of spec 8 §5.1, read the same way everywhere.
 */
class StatusSync
{
    public static function isOn(TeamIntegration $integration): bool
    {
        return $integration->provider->can(IntegrationCapability::StatusSync)
            && $integration->setting('statusSync') === true;
    }

    /**
     * Since when webhooks should have been arriving: their registration,
     * else the moment sync was turned on.
     */
    public static function webhookWatchedSince(TeamIntegration $integration): ?CarbonImmutable
    {
        return IssueStatus::time($integration->setting('webhookRegisteredAt'))
            ?? IssueStatus::time($integration->setting('statusSyncSince'));
    }
}
```

Create `app/Actions/Integrations/LinkStatusSync.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\ActionItemExternalLink;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Support\Integrations\StatusSync;

/**
 * Which connection syncs a link (spec 8 §5.1): the team's connection of
 * the link's provider, enabled, with sync on and on the link's site —
 * whatever its connection state, which callers check themselves.
 */
class LinkStatusSync
{
    public static function integration(ActionItemExternalLink $link, Team $team): ?TeamIntegration
    {
        if (! $link->source->isEnabled()) {
            return null;
        }

        $integration = $team->relationLoaded('integrations')
            ? $team->integrations->first(fn (TeamIntegration $candidate): bool => $candidate->provider === $link->source)
            : $team->integration($link->source);

        if ($integration === null || ! StatusSync::isOn($integration) || $integration->site() !== $link->external_site) {
            return null;
        }

        return $integration;
    }
}
```

- [ ] **Step 4: The push job**

Create `app/Jobs/Integrations/PushActionItemState.php`:

```php
<?php

namespace App\Jobs\Integrations;

use App\Actions\ActionItems\BroadcastActionItemChange;
use App\Actions\Integrations\LinkStatusSync;
use App\Enums\ExternalIssueState;
use App\Enums\IntegrationStatus;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\IntegrationErrors;
use App\Support\Integrations\Trackers\DoneMapping;
use App\Support\Integrations\Trackers\TrackerIssue;
use App\Support\Integrations\Trackers\Trackers;
use DateTimeInterface;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Writes the item's current open/done state to its linked issue (spec 8
 * §5.6). It reads the item when it runs, so quick toggles coalesce and the
 * last state wins; pushes of one link never overlap. Waiting for another
 * push or a rate limit releases the job: the five tries are counted as
 * exceptions within an hour, as for estimate write-backs.
 */
class PushActionItemState implements ShouldBeUniqueUntilProcessing, ShouldQueue
{
    use Queueable;

    public int $maxExceptions = 5;

    public int $uniqueFor = 300;

    /** @var array<int, int> */
    public array $backoff = [10, 30, 120, 600];

    public function __construct(public string $linkId) {}

    public function uniqueId(): string
    {
        return $this->linkId;
    }

    /** @return array<int, object> */
    public function middleware(): array
    {
        return [(new WithoutOverlapping("action-item-link:{$this->linkId}"))->releaseAfter(10)->expireAfter(120)];
    }

    public function retryUntil(): DateTimeInterface
    {
        return now()->addHour();
    }

    public function handle(Trackers $trackers, BroadcastActionItemChange $broadcast): void
    {
        $link = ActionItemExternalLink::query()->with('actionItem.team')->find($this->linkId);

        if ($link === null || $link->external_id === '') {
            return;
        }

        $item = $link->actionItem;
        $integration = LinkStatusSync::integration($link, $item->team);

        if ($integration === null) {
            return;
        }

        $label = ['provider' => $integration->provider->label()];

        if ($integration->status === IntegrationStatus::ReconnectRequired) {
            $this->recordFailure(__('Reconnect :provider in the team settings.', $label));
            $this->announce($broadcast, $item);

            return;
        }

        if (! $integration->isActive()) {
            return;
        }

        if (! $integration->canWrite()) {
            $this->recordFailure(__('This :provider connection is read-only.', $label));
            $this->announce($broadcast, $item);

            return;
        }

        $target = $item->isCompleted() ? ExternalIssueState::Done : ExternalIssueState::Open;

        try {
            $issue = $trackers->syncing($integration->provider)->transition($integration, $link->external_id, $target);
        } catch (RateLimited $exception) {
            $this->release($exception->retryAfter);

            return;
        } catch (ProviderUnavailable $exception) {
            throw $exception;
        } catch (IntegrationException $exception) {
            $this->recordFailure($exception->userMessage());
            $this->announce($broadcast, $item);

            return;
        }

        $this->recordOutcome($integration, $target, $issue);
        $this->announce($broadcast, $item);
    }

    public function failed(?Throwable $exception): void
    {
        $this->recordFailure($exception instanceof IntegrationException
            ? $exception->userMessage()
            : __('The status could not be written. Try again.'));

        $item = ActionItemExternalLink::query()->find($this->linkId)?->actionItem;

        if ($item !== null) {
            $this->announce(app(BroadcastActionItemChange::class), $item);
        }
    }

    private function recordOutcome(TeamIntegration $integration, ExternalIssueState $target, ?TrackerIssue $issue): void
    {
        DB::transaction(function () use ($integration, $target, $issue): void {
            $link = ActionItemExternalLink::query()->whereKey($this->linkId)->lockForUpdate()->first();

            if ($link === null) {
                return;
            }

            if ($issue === null) {
                $link->forceFill(['missing_at' => $link->missing_at ?? now(), 'sync_error' => null])->save();

                return;
            }

            $link->forceFill([
                'last_pushed_state' => $target,
                'last_pushed_at' => now(),
                'external_state' => $issue->issueStatus === null ? $target : DoneMapping::state($integration, $issue->issueStatus),
                'external_status_name' => $issue->status,
                'external_updated_at' => $issue->issueStatus?->updatedAt,
                'last_synced_at' => now(),
                'sync_error' => null,
                'missing_at' => null,
            ])->save();
        });
    }

    private function recordFailure(string $message): void
    {
        ActionItemExternalLink::query()->whereKey($this->linkId)->update(['sync_error' => IntegrationErrors::sanitize($message)]);
    }

    private function announce(BroadcastActionItemChange $broadcast, ActionItem $item): void
    {
        rescue(function () use ($broadcast, $item): void {
            $fresh = $item->fresh() ?? $item;

            $broadcast->saved($fresh);
            $broadcast->externalLinksChanged($fresh);
        });
    }
}
```

- [ ] **Step 5: The listener**

Create `app/Listeners/QueueActionItemStatusPushes.php`:

```php
<?php

namespace App\Listeners;

use App\Actions\ActionItems\BroadcastActionItemChange;
use App\Actions\Integrations\LinkStatusSync;
use App\Enums\ActionItemEventOrigin;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemReopened;
use App\Jobs\Integrations\PushActionItemState;
use App\Models\ActionItem;

/**
 * Spec 8 §5.6: every status change made in skrum is remembered on the
 * item's links (the conflict rule compares it) and pushed where the
 * connection syncs. Changes that came from the source are never pushed
 * back, which is what stops loops.
 */
class QueueActionItemStatusPushes
{
    public function __construct(private BroadcastActionItemChange $broadcast) {}

    public function onActionItemCompleted(ActionItemCompleted $event): void
    {
        $this->queue($event->actionItem, $event->origin);
    }

    public function onActionItemReopened(ActionItemReopened $event): void
    {
        $this->queue($event->actionItem, $event->origin);
    }

    private function queue(ActionItem $item, ActionItemEventOrigin $origin): void
    {
        if ($origin !== ActionItemEventOrigin::Skrum) {
            return;
        }

        $links = $item->externalLinks()->get();

        if ($links->isEmpty()) {
            return;
        }

        $item->externalLinks()->update(['local_state_changed_at' => now()]);
        $refused = false;

        foreach ($links as $link) {
            $integration = LinkStatusSync::integration($link, $item->team);

            if ($integration === null || ! $integration->isActive()) {
                continue;
            }

            if (! $integration->canWrite()) {
                $link->forceFill(['sync_error' => __('This :provider connection is read-only.', ['provider' => $integration->provider->label()])])->save();
                $refused = true;

                continue;
            }

            PushActionItemState::dispatch($link->id)->afterCommit();
        }

        if ($refused) {
            rescue(fn () => $this->broadcast->externalLinksChanged($item));
        }
    }
}
```

In `app/Providers/AppServiceProvider.php`, import `App\Listeners\QueueActionItemStatusPushes` (and the two events if 14b's block did not already), and add next to 14b's `Event::listen` lines for the same events:

```php
        Event::listen(ActionItemCompleted::class, [QueueActionItemStatusPushes::class, 'onActionItemCompleted']);
        Event::listen(ActionItemReopened::class, [QueueActionItemStatusPushes::class, 'onActionItemReopened']);
```

- [ ] **Step 6: The retry endpoints**

Create `app/Actions/Integrations/RequestActionItemPush.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Jobs\Integrations\PushActionItemState;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\StatusSync;

/**
 * Spec 8 §5.6: the managers' "Retry", which is also how a conflict is
 * resolved in skrum's favour.
 */
class RequestActionItemPush
{
    public function __construct(private ActionItemExportGuard $guard) {}

    public function handle(ActionItem $item, ActionItemExternalLink $link, ActionItemActor $actor): ActionItem
    {
        $this->guard->authorize($item, $actor);

        $provider = $link->source;

        abort_unless($provider->isEnabled(), 404);

        $integration = $item->team->integration($provider) ?? throw new NotConnected($provider);

        $integration->ensureWritable();

        $label = ['provider' => $provider->label()];

        if (! StatusSync::isOn($integration)) {
            abort(409, __('Turn on status sync for :provider first.', $label));
        }

        if ($integration->site() !== $link->external_site) {
            abort(409, __('This issue belongs to another :provider site.', $label));
        }

        $link->forceFill(['sync_error' => null])->save();

        PushActionItemState::dispatch($link->id);

        return $item->loadForPresentation();
    }
}
```

Create `app/Http/Controllers/Integrations/RetroActionItemLinkSyncsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\Integrations\RequestActionItemPush;
use App\Actions\Retros\PresentActionItem;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RetroActionItemLinkSyncsController extends Controller
{
    public function __construct(
        private RequestActionItemPush $requestActionItemPush,
        private PresentActionItem $presentActionItem,
    ) {}

    public function store(Request $request, Retro $retro, ActionItem $actionItem, ActionItemExternalLink $externalLink): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $item = $this->requestActionItemPush->handle($actionItem, $externalLink, $actor);

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)], 202);
    }
}
```

Create `app/Http/Controllers/Integrations/WorkspaceActionItemLinkSyncsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Actions\Integrations\RequestActionItemPush;
use App\Actions\Retros\PresentActionItem;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkspaceActionItemLinkSyncsController extends Controller
{
    public function __construct(
        private RequestActionItemPush $requestActionItemPush,
        private PresentActionItem $presentActionItem,
    ) {}

    public function store(Request $request, Workspace $workspace, ActionItem $actionItem, ActionItemExternalLink $externalLink): JsonResponse
    {
        $user = $request->user();

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        $actor = ActionItemActor::forUser($user);
        $item = $this->requestActionItemPush->handle($actionItem, $externalLink, $actor);

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)], 202);
    }
}
```

In `routes/web.php`, import both controllers; in the `retros/{retro}` group, after the `retros.action-items.exports.store` route:

```php
        Route::post('action-items/{actionItem}/external-links/{externalLink}/sync', [RetroActionItemLinkSyncsController::class, 'store'])
            ->middleware([EnsureIntegrationProviderEnabled::class, 'throttle:10,1,actionItemLinkSyncs'])
            ->name('retros.action-items.external-links.sync.store')
            ->whereUuid(['actionItem', 'externalLink']);
```

and in the `w/{workspace}` group, after the `workspaces.actionItemExports.store` route:

```php
            Route::post('action-items/{actionItem}/external-links/{externalLink}/sync', [WorkspaceActionItemLinkSyncsController::class, 'store'])
                ->middleware([EnsureIntegrationProviderEnabled::class, 'throttle:10,1,actionItemLinkSyncs'])
                ->name('workspaces.actionItemLinkSyncs.store')
                ->whereUuid(['actionItem', 'externalLink']);
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 7: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `The status could not be written. Try again.` | `Le statut n’a pas pu être écrit. Réessayez.` | `No se pudo escribir el estado. Inténtalo de nuevo.` | `Der Status konnte nicht geschrieben werden. Versuche es erneut.` |
| `Turn on status sync for :provider first.` | `Activez d’abord la synchronisation des statuts pour :provider.` | `Activa primero la sincronización de estados para :provider.` | `Aktiviere zuerst die Statussynchronisierung für :provider.` |
| `This issue belongs to another :provider site.` | `Ce ticket appartient à un autre site :provider.` | `Esta incidencia pertenece a otro sitio de :provider.` | `Dieses Issue gehört zu einer anderen :provider-Site.` |

- [ ] **Step 8: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ActionItemStatusPushTest.php tests/Feature/Integrations/WebhookEventsTest.php tests/Feature/ActionItems tests/Feature/TranslationKeysTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 9: Commit**

```bash
git add app/Support/Integrations/StatusSync.php app/Actions/Integrations/LinkStatusSync.php app/Actions/Integrations/RequestActionItemPush.php app/Listeners/QueueActionItemStatusPushes.php app/Jobs/Integrations/PushActionItemState.php app/Http/Controllers/Integrations/RetroActionItemLinkSyncsController.php app/Http/Controllers/Integrations/WorkspaceActionItemLinkSyncsController.php app/Providers/AppServiceProvider.php routes/web.php tests/Pest.php tests/Feature/Integrations/ActionItemStatusPushTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): push action item completions to synced issues"
```

---

### Task 4: Applying source changes to action items and poker tasks

One service applies what a read returned: links get the source state, items follow the source through the system actor unless an unpushed newer skrum change wins, missing issues are flagged, and imported tasks of running games refresh their fields and status.

**Files:**
- Create: `database/migrations/2026_10_07_100300_add_completed_via_source_to_action_items.php`, `app/Actions/Integrations/{TrackedIssues,ApplyIssueChanges,ApplyPokerTaskIssues}.php`, `tests/Feature/Integrations/ApplyIssueChangesTest.php`
- Modify: `app/Models/ActionItem.php`, `app/Actions/ActionItems/SetActionItemStatus.php`, `app/Actions/Integrations/{RefreshPokerTasks,ImportPokerTasks}.php`

**Interfaces:**
- Consumes: Tasks 1–3 (`DoneMapping`, `TrackerIssue::$issueStatus`, `PushActionItemState`), `SetActionItemStatus`, `ExternalSyncActor`, `BroadcastActionItemChange`, `PresentPokerTask`, `PokerTaskSaved`, `PokerGameChanged`.
- Produces: `TrackedIssues` (`RecentlyCompletedDays = 90`, `ContainerKeyPattern`, `links()`, `tasks()`, `ids()`, `among()`, `inRepositories()`, `containerKeys()`); `ApplyIssueChanges::handle(TeamIntegration, array $externalIds, array $issues, bool $complete, bool $sourceWins = false): void` (`BroadcastEachTaskUpTo = 10`); `ApplyPokerTaskIssues::handle(PokerGame, Collection $tasks, array $issues, bool $complete): array{found: int, missing: int, changed: array<int, PokerTask>}`; column `action_items.completed_via_source`; Pest helper `applyStatusSyncIssues()` (local to the test file).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/ApplyIssueChangesTest.php`:

```php
<?php

use App\Actions\Integrations\ApplyIssueChanges;
use App\Actions\Integrations\RefreshPokerTasks;
use App\Enums\ActionItemEventOrigin;
use App\Enums\ActionItemRecurrence;
use App\Enums\ExternalIssueState;
use App\Enums\ExternalStatusCategory;
use App\Enums\RetroPhase;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemReopened;
use App\Events\Poker\PokerGameChanged;
use App\Events\Poker\PokerTaskSaved;
use App\Jobs\Integrations\PushActionItemState;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\TrackerIssue;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
});

/**
 * @param  array<int, TrackerIssue>  $issues
 * @param  array<int, string>  $ids
 */
function applyStatusSyncIssues(TeamIntegration $integration, array $issues, array $ids = ['10001'], bool $complete = true, bool $sourceWins = false): void
{
    $keyed = [];

    foreach ($issues as $issue) {
        $keyed[$issue->externalId] = $issue;
    }

    app(ApplyIssueChanges::class)->handle($integration, $ids, $keyed, $complete, $sourceWins);
}

function syncedPokerTable(): array
{
    $table = trackerTable();
    $table['integration']->forceFill(['settings' => [...$table['integration']->settings, 'statusSync' => true]])->save();

    return $table;
}

it('completes the item as the system when the source is done', function () {
    Event::fake([ActionItemCompleted::class]);
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink();

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'done', '2026-10-07T10:20:00+00:00')]);

    $item->refresh();
    $link->refresh();
    expect($item->completed_at)->not->toBeNull()
        ->and($item->completed_via_source)->toBe('jira')
        ->and($link->external_state)->toBe(ExternalIssueState::Done)
        ->and($link->external_status_name)->toBe('Done')
        ->and($link->external_updated_at?->toIso8601String())->toBe('2026-10-07T10:20:00+00:00')
        ->and($link->last_synced_at?->toIso8601String())->toBe('2026-10-07T10:30:00+00:00');
    Event::assertDispatched(ActionItemCompleted::class, fn (ActionItemCompleted $event) => $event->origin === ActionItemEventOrigin::External);
    Queue::assertNotPushed(PushActionItemState::class);
});

it('completes an item on a locked board as the system and keeps recurrences', function () {
    ['integration' => $integration, 'item' => $item, 'retro' => $retro] = statusSyncLink(item: [
        'recurrence' => ActionItemRecurrence::Weekly,
        'due_on' => '2026-10-10',
    ]);
    $retro->forceFill(['phase' => RetroPhase::Discussing, 'is_locked' => true])->save();

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'done')]);

    expect($item->fresh()->completed_at)->not->toBeNull()
        ->and(ActionItem::query()->where('previous_occurrence_id', $item->id)->count())->toBe(1);
});

it('reopens the item when the source reopens', function () {
    Event::fake([ActionItemReopened::class]);
    ['integration' => $integration, 'item' => $item] = statusSyncLink(item: ['completed_at' => '2026-10-06 09:00:00']);

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new')]);

    expect($item->fresh()->completed_at)->toBeNull()
        ->and($item->fresh()->completed_via_source)->toBeNull();
    Event::assertDispatched(ActionItemReopened::class, fn (ActionItemReopened $event) => $event->origin === ActionItemEventOrigin::External);
});

it('only records the read when both sides agree', function () {
    Event::fake([ActionItemCompleted::class, ActionItemReopened::class]);
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink();

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'indeterminate', overrides: ['status' => 'In Review'])]);

    expect($item->fresh()->completed_at)->toBeNull()
        ->and($link->fresh()->external_state)->toBe(ExternalIssueState::Open)
        ->and($link->fresh()->external_status_name)->toBe('In Review');
    Event::assertNotDispatched(ActionItemCompleted::class);
    Event::assertNotDispatched(ActionItemReopened::class);
});

it('keeps a newer unpushed skrum change and pushes it', function () {
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:25:00'],
        item: ['completed_at' => '2026-10-07 10:25:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')]);

    expect($item->fresh()->completed_at)->not->toBeNull()
        ->and($link->fresh()->external_state)->toBe(ExternalIssueState::Open);
    Queue::assertPushed(PushActionItemState::class, fn (PushActionItemState $job) => $job->linkId === $link->id);
});

it('lets a newer source change win', function () {
    ['integration' => $integration, 'item' => $item] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:15:00'],
        item: ['completed_at' => '2026-10-07 10:15:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')]);

    expect($item->fresh()->completed_at)->toBeNull();
    Queue::assertNotPushed(PushActionItemState::class);
});

it('gives a tie to skrum', function () {
    ['integration' => $integration, 'item' => $item] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:20:00'],
        item: ['completed_at' => '2026-10-07 10:20:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')]);

    expect($item->fresh()->completed_at)->not->toBeNull();
    Queue::assertPushed(PushActionItemState::class);
});

it('applies the source when the local change was already pushed', function () {
    ['integration' => $integration, 'item' => $item] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:15:00', 'last_pushed_at' => '2026-10-07 10:16:00', 'last_pushed_state' => ExternalIssueState::Done],
        item: ['completed_at' => '2026-10-07 10:15:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:10:00+00:00')]);

    expect($item->fresh()->completed_at)->toBeNull();
});

it('lets the source win on the first read', function () {
    ['integration' => $integration, 'item' => $item] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:25:00'],
        item: ['completed_at' => '2026-10-07 10:25:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')], sourceWins: true);

    expect($item->fresh()->completed_at)->toBeNull();
    Queue::assertNotPushed(PushActionItemState::class);
});

it('marks missing issues only when every id was read, and clears the flag when they return', function () {
    ['integration' => $integration, 'link' => $link] = statusSyncLink();

    applyStatusSyncIssues($integration, [], complete: false);
    expect($link->fresh()->missing_at)->toBeNull();

    applyStatusSyncIssues($integration, []);
    expect($link->fresh()->missing_at?->toIso8601String())->toBe('2026-10-07T10:30:00+00:00');

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new')]);
    expect($link->fresh()->missing_at)->toBeNull();
});

it('ignores links of other teams, other sites and items completed long ago', function () {
    ['integration' => $integration] = statusSyncLink();
    ['link' => $otherTeam] = statusSyncLink();
    ['link' => $otherSite, 'integration' => $other] = statusSyncLink(['external_site' => 'cloud-2']);
    $old = ActionItemExternalLink::factory()->create([
        'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id, 'completed_at' => now()->subDays(100)])->id,
        'external_id' => '10001',
    ]);

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'done')]);

    expect($otherTeam->fresh()->last_synced_at)->toBeNull()
        ->and($otherSite->fresh()->last_synced_at)->toBeNull()
        ->and($old->fresh()->last_synced_at)->toBeNull()
        ->and($other->team_id)->not->toBe($integration->team_id);
});

it('refreshes imported tasks of running games with their status', function () {
    Event::fake([PokerTaskSaved::class, PokerGameChanged::class]);
    $table = syncedPokerTable();
    $task = importedPokerTask($table['game']);

    applyStatusSyncIssues($table['integration'], [statusSyncIssue($task->external_id, $task->external_key, 'indeterminate', '2026-10-07T10:05:00+00:00', [
        'status' => 'In Review',
        'title' => 'Renamed in Jira',
        'estimate' => '8',
        'url' => $task->external_url,
    ])], [$task->external_id]);

    $task->refresh();
    expect($task->title)->toBe('Renamed in Jira')
        ->and($task->external_estimate)->toBe('8')
        ->and($task->external_status_name)->toBe('In Review')
        ->and($task->external_status_category)->toBe(ExternalStatusCategory::InProgress)
        ->and($task->external_updated_at?->toIso8601String())->toBe('2026-10-07T10:05:00+00:00')
        ->and($task->external_missing_at)->toBeNull();
    Event::assertDispatchedTimes(PokerTaskSaved::class, 1);
    Event::assertNotDispatched(PokerGameChanged::class);
});

it('leaves ended games alone', function () {
    $table = syncedPokerTable();
    $task = importedPokerTask($table['game']);
    $table['game']->forceFill(['ended_at' => now()->subHour()])->save();

    applyStatusSyncIssues($table['integration'], [statusSyncIssue($task->external_id, $task->external_key, 'done', overrides: ['title' => 'Changed'])], [$task->external_id]);

    expect($task->fresh()->title)->not->toBe('Changed')
        ->and($task->fresh()->external_status_category)->toBeNull();
});

it('announces more than ten changed tasks as one game change', function () {
    Event::fake([PokerTaskSaved::class, PokerGameChanged::class]);
    $table = syncedPokerTable();
    $tasks = collect(range(1, 11))->map(fn () => importedPokerTask($table['game']));

    applyStatusSyncIssues(
        $table['integration'],
        $tasks->map(fn (PokerTask $task) => statusSyncIssue($task->external_id, $task->external_key, 'done'))->all(),
        $tasks->pluck('external_id')->all(),
    );

    Event::assertDispatchedTimes(PokerGameChanged::class, 1);
    Event::assertNotDispatched(PokerTaskSaved::class);
});

it('persists "Not found" when a manual refresh misses an issue', function () {
    $table = trackerTable();
    $task = importedPokerTask($table['game']);
    fakeJiraTrackerApi([]);

    $result = app(RefreshPokerTasks::class)->handle($table['game'], $table['facilitatorPlayer']);

    expect($result)->toBe(['refreshed' => 0, 'missing' => 1])
        ->and($task->fresh()->external_missing_at)->not->toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ApplyIssueChangesTest.php`
Expected: FAIL — class `App\Actions\Integrations\ApplyIssueChanges` not found.

- [ ] **Step 3: Remember completions made by the sync**

Create `database/migrations/2026_10_07_100300_add_completed_via_source_to_action_items.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "Completed in :source" (spec 8 §9): the tracker whose status sync
     * completed the item; cleared by any other status change.
     */
    public function up(): void
    {
        Schema::table('action_items', function (Blueprint $table) {
            $table->string('completed_via_source', 20)->nullable();
        });
    }
};
```

In `app/Models/ActionItem.php`, add `@property string|null $completed_via_source` after the `completed_at` property line (the column is not fillable: only `SetActionItemStatus` writes it).

In `app/Actions/ActionItems/SetActionItemStatus.php`, replace `$locked->update(['completed_at' => $completing ? now() : null]);` with:

```php
        $locked->forceFill([
            'completed_at' => $completing ? now() : null,
            'completed_via_source' => $completing && $actor instanceof ExternalSyncActor ? $actor->source : null,
        ])->save();
```

- [ ] **Step 4: Which issues are tracked**

Create `app/Actions/Integrations/TrackedIssues.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\ActionItemExternalLink;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use Illuminate\Database\Eloquent\Builder;

/**
 * Spec 8 §5.4: a connection follows the links of its team's items that are
 * open or were completed within 90 days, and the imported tasks of its
 * team's games that are not ended — on its own site only.
 */
class TrackedIssues
{
    public const RecentlyCompletedDays = 90;

    public const ContainerKeyPattern = '/^[A-Z][A-Z0-9_]{0,49}\z/';

    private const IssueKeyPattern = '/^([A-Z][A-Z0-9_]{0,49})-\d+\z/';

    private const RepositoryIdPattern = '/^\d{1,20}\z/';

    /**
     * @return Builder<ActionItemExternalLink>
     */
    public function links(TeamIntegration $integration): Builder
    {
        return ActionItemExternalLink::query()
            ->where('source', $integration->provider->value)
            ->where('external_site', (string) $integration->site())
            ->where('external_id', '!=', '')
            ->whereHas('actionItem', fn ($items) => $items
                ->where('team_id', $integration->team_id)
                ->where(fn ($state) => $state
                    ->whereNull('completed_at')
                    ->orWhere('completed_at', '>=', now()->subDays(self::RecentlyCompletedDays))));
    }

    /**
     * @return Builder<PokerTask>
     */
    public function tasks(TeamIntegration $integration): Builder
    {
        return PokerTask::query()
            ->where('external_source', $integration->provider->value)
            ->where('external_site', (string) $integration->site())
            ->whereNotNull('external_id')
            ->whereHas('game', fn ($games) => $games
                ->where('team_id', $integration->team_id)
                ->whereNull('ended_at'));
    }

    /**
     * @return array<int, string>
     */
    public function ids(TeamIntegration $integration): array
    {
        return $this->externalIds($integration);
    }

    /**
     * The given ids that the connection tracks.
     *
     * @param  array<int, string>  $externalIds
     * @return array<int, string>
     */
    public function among(TeamIntegration $integration, array $externalIds): array
    {
        return $externalIds === [] ? [] : $this->externalIds($integration, array_map('strval', $externalIds));
    }

    /**
     * Tracked GitHub issues (`{repositoryId}/{number}`) of these repositories.
     *
     * @param  array<int, string>  $repositoryIds
     * @return array<int, string>
     */
    public function inRepositories(TeamIntegration $integration, array $repositoryIds): array
    {
        $valid = array_values(array_filter($repositoryIds, fn (string $id): bool => preg_match(self::RepositoryIdPattern, $id) === 1));

        return $valid === [] ? [] : $this->externalIds($integration, null, $valid);
    }

    /**
     * Jira project keys or Linear team keys of the tracked issues, from
     * their keys (`PROJ-12` → `PROJ`).
     *
     * @return array<int, string>
     */
    public function containerKeys(TeamIntegration $integration): array
    {
        $keys = [];

        foreach ([$this->links($integration), $this->tasks($integration)] as $query) {
            foreach ($query->pluck('external_key') as $key) {
                if (is_string($key) && preg_match(self::IssueKeyPattern, $key, $match) === 1) {
                    $keys[$match[1]] = true;
                }
            }
        }

        $keys = array_map('strval', array_keys($keys));
        sort($keys);

        return $keys;
    }

    /**
     * @param  array<int, string>|null  $ids
     * @param  array<int, string>  $repositoryIds
     * @return array<int, string>
     */
    private function externalIds(TeamIntegration $integration, ?array $ids = null, array $repositoryIds = []): array
    {
        $found = [];

        foreach ([$this->links($integration), $this->tasks($integration)] as $query) {
            if ($ids !== null) {
                $query->whereIn('external_id', $ids);
            }

            if ($repositoryIds !== []) {
                $query->where(function ($any) use ($repositoryIds): void {
                    foreach ($repositoryIds as $repositoryId) {
                        $any->orWhere('external_id', 'like', "{$repositoryId}/%");
                    }
                });
            }

            foreach ($query->pluck('external_id') as $id) {
                if (is_string($id) && $id !== '') {
                    $found[$id] = true;
                }
            }
        }

        return array_map('strval', array_keys($found));
    }
}
```

- [ ] **Step 5: Applying reads to poker tasks**

Create `app/Actions/Integrations/ApplyPokerTaskIssues.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Support\Integrations\Trackers\DoneMapping;
use App\Support\Integrations\Trackers\TrackerIssue;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Spec 6 §6.4 and spec 8 §5.7: title, description, assignee, source
 * estimate and status follow the source; the skrum estimate never
 * changes; ended games are frozen. Used by the manual refresh and by the
 * automatic sync.
 */
class ApplyPokerTaskIssues
{
    /**
     * @param  Collection<int, PokerTask>  $tasks
     * @param  array<string, TrackerIssue>  $issues
     * @param  bool  $complete  every task's issue was asked for, so an absent one is gone
     * @return array{found: int, missing: int, changed: array<int, PokerTask>}
     */
    public function handle(PokerGame $game, Collection $tasks, array $issues, bool $complete): array
    {
        return DB::transaction(function () use ($game, $tasks, $issues, $complete): array {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->first();
            $result = ['found' => 0, 'missing' => 0, 'changed' => []];

            if ($locked === null || $locked->isEnded()) {
                return $result;
            }

            $query = PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($tasks->pluck('id')->all());

            foreach ($query->get() as $task) {
                $issue = $issues[(string) $task->external_id] ?? null;

                if ($issue === null) {
                    $result['missing']++;

                    if ($complete && $task->external_missing_at === null) {
                        $task->forceFill(['external_missing_at' => now()])->save();
                        $result['changed'][] = $task;
                    }

                    continue;
                }

                $result['found']++;
                $task->forceFill($this->fields($task, $issue));
                $changed = $task->isDirty();
                $task->forceFill(['external_refreshed_at' => now()])->save();

                if ($changed) {
                    $result['changed'][] = $task;
                }
            }

            return $result;
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function fields(PokerTask $task, TrackerIssue $issue): array
    {
        $provider = IntegrationProvider::from((string) $task->external_source);

        return [
            'title' => $issue->title,
            'description' => $issue->description,
            'external_key' => $issue->key,
            'external_url' => $issue->url,
            'external_assignee' => $issue->assignee,
            'external_estimate' => $issue->estimate,
            'external_status_name' => $issue->status,
            'external_status_category' => $issue->issueStatus === null
                ? $task->external_status_category
                : DoneMapping::category($provider, $issue->issueStatus->kind),
            'external_updated_at' => $issue->issueStatus?->updatedAt ?? $task->external_updated_at,
            'external_missing_at' => null,
        ];
    }
}
```

In `app/Actions/Integrations/RefreshPokerTasks.php`: inject `private ApplyPokerTaskIssues $applyPokerTaskIssues` next to `Trackers`; replace

```php
            [$updated, $notFound] = $this->apply($game, $onSite, $issues);
            $refreshed += $updated;
            $missing += $notFound;
```

with

```php
            $applied = $this->applyPokerTaskIssues->handle($game, $onSite, $issues, complete: true);
            $refreshed += $applied['found'];
            $missing += $applied['missing'];
```

delete the private `apply()` method, and remove the imports it alone used (`PokerTask`, `TrackerIssue`, `Collection`, `DB` when unused). Update the class docblock's last sentence to: "Issues the source no longer returns keep their data and show "Not found in :source"."

In `app/Actions/Integrations/ImportPokerTasks.php`, import `App\Support\Integrations\Trackers\DoneMapping` and add to the `forceFill([...])` of each new task, after `'external_refreshed_at' => now(),`:

```php
                    'external_status_name' => $issue->status,
                    'external_status_category' => $issue->issueStatus === null ? null : DoneMapping::category($integration->provider, $issue->issueStatus->kind),
                    'external_updated_at' => $issue->issueStatus?->updatedAt,
```

- [ ] **Step 6: Applying reads to action items**

Create `app/Actions/Integrations/ApplyIssueChanges.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Actions\ActionItems\BroadcastActionItemChange;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Actions\Poker\PresentPokerTask;
use App\Enums\ActionItemStatus;
use App\Enums\ExternalIssueState;
use App\Events\Poker\PokerGameChanged;
use App\Events\Poker\PokerTaskSaved;
use App\Jobs\Integrations\PushActionItemState;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\DoneMapping;
use App\Support\Integrations\Trackers\TrackerIssue;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Spec 8 §5.5, §5.7, §5.8: what a read returned becomes the links' source
 * state; items follow the source through the system actor (no permission,
 * lock or phase applies) unless an unpushed skrum change is at least as
 * recent, in which case skrum's state is pushed. Each item is applied
 * under its own row lock, then its links' locks.
 */
class ApplyIssueChanges
{
    public const BroadcastEachTaskUpTo = 10;

    public function __construct(
        private TrackedIssues $trackedIssues,
        private SetActionItemStatus $setActionItemStatus,
        private BroadcastActionItemChange $broadcast,
        private ApplyPokerTaskIssues $applyPokerTaskIssues,
        private PresentPokerTask $presentPokerTask,
    ) {}

    /**
     * @param  array<int, string>  $externalIds  the ids that were read
     * @param  array<string, TrackerIssue>  $issues  what the source returned for them
     * @param  bool  $complete  every id was asked for by itself, so an absent issue is gone
     * @param  bool  $sourceWins  the first read after sync was turned on (spec 8 §5.1)
     */
    public function handle(TeamIntegration $integration, array $externalIds, array $issues, bool $complete, bool $sourceWins = false): void
    {
        $ids = array_values(array_unique(array_map('strval', $externalIds)));

        if ($ids === []) {
            return;
        }

        $this->applyToActionItems($integration, $ids, $issues, $complete, $sourceWins);
        $this->applyToPokerTasks($integration, $ids, $issues, $complete);
    }

    /**
     * @param  array<int, string>  $ids
     * @param  array<string, TrackerIssue>  $issues
     */
    private function applyToActionItems(TeamIntegration $integration, array $ids, array $issues, bool $complete, bool $sourceWins): void
    {
        $links = $this->trackedIssues->links($integration)->whereIn('external_id', $ids)->get();

        foreach ($links->groupBy('action_item_id') as $itemId => $itemLinks) {
            /** @var array<int, string> $pushes */
            $pushes = DB::transaction(fn (): array => $this->applyToItem(
                $integration,
                (string) $itemId,
                $itemLinks->pluck('id')->all(),
                $issues,
                $complete,
                $sourceWins,
            ));

            foreach ($pushes as $linkId) {
                PushActionItemState::dispatch($linkId);
            }

            $item = ActionItem::query()->find($itemId);

            if ($item !== null) {
                rescue(fn () => $this->broadcast->externalLinksChanged($item));
            }
        }
    }

    /**
     * @param  array<int, string>  $linkIds
     * @param  array<string, TrackerIssue>  $issues
     * @return array<int, string> links whose skrum state won and must be pushed
     */
    private function applyToItem(TeamIntegration $integration, string $itemId, array $linkIds, array $issues, bool $complete, bool $sourceWins): array
    {
        $item = ActionItem::query()->whereKey($itemId)->lockForUpdate()->first();

        if ($item === null) {
            return [];
        }

        $pushes = [];

        foreach (ActionItemExternalLink::query()->whereKey($linkIds)->lockForUpdate()->get() as $link) {
            $issue = $issues[$link->external_id] ?? null;

            if ($issue === null || $issue->issueStatus === null) {
                if ($complete && $link->missing_at === null) {
                    $link->forceFill(['missing_at' => now()])->save();
                }

                continue;
            }

            $state = DoneMapping::state($integration, $issue->issueStatus);

            $link->forceFill([
                'external_state' => $state,
                'external_status_name' => $issue->status,
                'external_updated_at' => $issue->issueStatus->updatedAt,
                'last_synced_at' => now(),
                'missing_at' => null,
            ])->save();

            $itemState = $item->isCompleted() ? ExternalIssueState::Done : ExternalIssueState::Open;

            if ($state === $itemState) {
                continue;
            }

            if (! $sourceWins && $this->skrumWins($link, $issue->issueStatus->updatedAt)) {
                $pushes[] = $link->id;

                continue;
            }

            $item = $this->setActionItemStatus->handle(
                $item,
                new ExternalSyncActor($integration->provider->value, $link->external_key),
                $state === ExternalIssueState::Done ? ActionItemStatus::Completed : ActionItemStatus::Open,
            );
        }

        return $pushes;
    }

    /**
     * Decision 2: an unpushed skrum change (never pushed since, or its push
     * failed) wins when it is at least as recent as the source's change.
     */
    private function skrumWins(ActionItemExternalLink $link, ?CarbonImmutable $sourceChangedAt): bool
    {
        $localChangedAt = $link->local_state_changed_at;

        if ($localChangedAt === null) {
            return false;
        }

        $unpushed = $link->last_pushed_at === null
            || $localChangedAt->gt($link->last_pushed_at)
            || $link->sync_error !== null;

        return $unpushed && $sourceChangedAt !== null && $sourceChangedAt->lte($localChangedAt);
    }

    /**
     * @param  array<int, string>  $ids
     * @param  array<string, TrackerIssue>  $issues
     */
    private function applyToPokerTasks(TeamIntegration $integration, array $ids, array $issues, bool $complete): void
    {
        $tasks = $this->trackedIssues->tasks($integration)->whereIn('external_id', $ids)->get();

        foreach ($tasks->groupBy('poker_game_id') as $gameId => $gameTasks) {
            $game = PokerGame::query()->find($gameId);

            if ($game === null) {
                continue;
            }

            $this->announce($game, $this->applyPokerTaskIssues->handle($game, $gameTasks, $issues, $complete)['changed']);
        }
    }

    /**
     * @param  array<int, PokerTask>  $changed
     */
    private function announce(PokerGame $game, array $changed): void
    {
        if ($changed === []) {
            return;
        }

        if (count($changed) > self::BroadcastEachTaskUpTo) {
            rescue(fn () => broadcast(new PokerGameChanged($game->id)));

            return;
        }

        foreach ($changed as $task) {
            $task->loadCount('rounds');
            $payload = $this->presentPokerTask->handle($task);

            rescue(fn () => broadcast(new PokerTaskSaved($game->id, $payload)));
        }
    }
}
```

`$link->local_state_changed_at` and `$link->last_pushed_at` are `CarbonImmutable` (14a casts them `datetime`; `Date::use(CarbonImmutable::class)` is set in `AppServiceProvider`).

- [ ] **Step 7: Migrate and run the tests**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Integrations/ApplyIssueChangesTest.php tests/Feature/Integrations/PokerImportTest.php tests/Feature/Integrations/PokerTaskExternalTest.php tests/Feature/ActionItems tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 8: Commit**

```bash
git add database/migrations/2026_10_07_100300_add_completed_via_source_to_action_items.php app/Models/ActionItem.php app/Actions/ActionItems/SetActionItemStatus.php app/Actions/Integrations/TrackedIssues.php app/Actions/Integrations/ApplyIssueChanges.php app/Actions/Integrations/ApplyPokerTaskIssues.php app/Actions/Integrations/RefreshPokerTasks.php app/Actions/Integrations/ImportPokerTasks.php tests/Feature/Integrations/ApplyIssueChangesTest.php
git commit -m "feat(integrations): apply source status changes to action items and poker tasks"
```

---

### Task 5: Polling, reconciliation and the daily full read

Every minute the poller refreshes each synced connection's inbound mode and queues a read for the due ones; the read job asks for tracked issues updated since the cursor (or all of them for the daily and initial full reads), applies them, moves the cursor, honours 429 and flags silent webhooks.

**Files:**
- Create: `app/Support/Integrations/{InboundModes,IntegrationPolls}.php`, `app/Jobs/Integrations/ReadTrackedIssues.php`, `app/Console/Commands/PollIntegrationsCommand.php`, `tests/Feature/Integrations/PollIntegrationsTest.php`
- Modify: `app/Console/Commands/CheckIntegrationsCommand.php`, `routes/console.php`

**Interfaces:**
- Consumes: Tasks 1, 3, 4 (`SyncsIssueStatus::changedIssues`, `StatusSync`, `TrackedIssues`, `ApplyIssueChanges`); 14a `InboundReachability::{isPublic, pollIntervalMinutes}`, `IntegrationInboundMode`, `IntegrationWebhookStatus`, the `team_integrations` sync columns.
- Produces: `InboundModes` (`JiraWebhookScope = 'manage:jira-webhook'`, `for()`, `acceptsWebhooks(IntegrationProvider)`, `refresh()`, `hint()`); `IntegrationPolls` (`ReconciliationMinutes = 60`, `CursorOverlapMinutes = 2`, `intervalMinutes()`, `isDue()`, `pause()`); `ReadTrackedIssues($integrationId, bool $full = false, bool $initial = false)` (`SilentWebhookHours = 24`); command `skrum:poll-integrations`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/PollIntegrationsTest.php`:

```php
<?php

use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\IntegrationWebhookStatus;
use App\Jobs\Integrations\ReadTrackedIssues;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\IntegrationPolls;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
    config(['services.integrations.inbound_webhooks' => 'off', 'services.integrations.poll_minutes' => 5]);
});

/**
 * @param  array<string, mixed>  $attributes
 * @param  array<string, mixed>  $settings
 */
function pollingIntegration(array $attributes = [], array $settings = [], IntegrationProvider $provider = IntegrationProvider::Jira): TeamIntegration
{
    enableIntegrations($provider);
    $factory = TeamIntegration::factory();
    $integration = ($provider === IntegrationProvider::Linear ? $factory->linear() : $factory->jira())->create();
    $integration->forceFill([
        'settings' => [...$integration->settings, 'statusSync' => true, 'statusSyncSince' => '2026-10-01T00:00:00+00:00', ...$settings],
        'inbound_mode' => IntegrationInboundMode::Polling,
        ...$attributes,
    ])->save();

    return $integration->fresh() ?? $integration;
}

function trackedJiraLink(TeamIntegration $integration, string $externalId, array $item = []): ActionItemExternalLink
{
    return ActionItemExternalLink::factory()->create([
        'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id, ...$item])->id,
        'external_id' => $externalId,
        'external_key' => 'PROJ-'.substr($externalId, -1),
    ]);
}

function runTrackedRead(TeamIntegration $integration, bool $full = false): void
{
    app()->call([(new ReadTrackedIssues($integration->id, $full))->withFakeQueueInteractions(), 'handle']);
}

it('queues reads of due integrations only', function () {
    Queue::fake();
    $due = pollingIntegration(['last_polled_at' => now()->subMinutes(6)]);
    pollingIntegration(['last_polled_at' => now()->subMinutes(4)]);
    $never = pollingIntegration(['last_polled_at' => null]);
    pollingIntegration(['last_polled_at' => null], ['statusSync' => false]);
    pollingIntegration(['last_polled_at' => null, 'status' => IntegrationStatus::ReconnectRequired]);

    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    Queue::assertPushed(ReadTrackedIssues::class, 2);
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->integrationId === $due->id && ! $job->full);
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->integrationId === $never->id);
});

it('reads healthy webhook integrations hourly and failing ones at the polling interval', function () {
    Queue::fake();
    config(['services.integrations.inbound_webhooks' => 'on', 'services.linear.webhook_secret' => 'linear-webhook-secret']);
    $healthy = pollingIntegration(['last_polled_at' => now()->subMinutes(59), 'webhook_status' => IntegrationWebhookStatus::Active], provider: IntegrationProvider::Linear);
    $stale = pollingIntegration(['last_polled_at' => now()->subMinutes(61), 'webhook_status' => IntegrationWebhookStatus::Active], provider: IntegrationProvider::Linear);
    $failing = pollingIntegration(['last_polled_at' => now()->subMinutes(6), 'webhook_status' => IntegrationWebhookStatus::Failing], provider: IntegrationProvider::Linear);

    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    Queue::assertPushed(ReadTrackedIssues::class, 2);
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->integrationId === $stale->id);
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->integrationId === $failing->id);
    expect($healthy->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Webhook);
});

it('falls back to polling when webhooks cannot reach the instance', function () {
    Queue::fake();
    $integration = pollingIntegration(['inbound_mode' => IntegrationInboundMode::Webhook, 'webhook_status' => IntegrationWebhookStatus::Active, 'last_polled_at' => now()->subMinutes(6)]);

    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    expect($integration->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Polling);
    Queue::assertPushed(ReadTrackedIssues::class, 1);
});

it('waits while the source asks to', function () {
    Queue::fake();
    $integration = pollingIntegration(['last_polled_at' => null]);
    IntegrationPolls::pause($integration->id, 120);

    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    Queue::assertNothingPushed();
});

it('reads the tracked issues updated since the cursor and moves the cursor', function () {
    $integration = pollingIntegration(['poll_cursor' => '2026-10-07 10:15:00']);
    $link = trackedJiraLink($integration, '10001');
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', [
        'status' => ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']],
        'project' => ['key' => 'PROJ'],
        'updated' => '2026-10-07T10:25:00.000+0000',
    ])]);

    runTrackedRead($integration);

    Http::assertSent(fn (Request $request) => ($request['jql'] ?? null) === 'id in (10001) AND updated >= "-17m"');
    expect($link->actionItem->fresh()->completed_at)->not->toBeNull()
        ->and($integration->fresh()->poll_cursor?->toIso8601String())->toBe('2026-10-07T10:30:00+00:00')
        ->and($integration->fresh()->last_polled_at?->toIso8601String())->toBe('2026-10-07T10:30:00+00:00');
});

it('reads every tracked issue on a full read and flags the missing ones', function () {
    $integration = pollingIntegration();
    $link = trackedJiraLink($integration, '10001');
    fakeJiraTrackerApi([]);

    runTrackedRead($integration, full: true);

    Http::assertSent(fn (Request $request) => ($request['jql'] ?? null) === 'id in (10001)');
    expect($link->fresh()->missing_at)->not->toBeNull();
});

it('reads open items, items completed within 90 days and tasks of running games only', function () {
    $integration = pollingIntegration();
    trackedJiraLink($integration, '10001');
    trackedJiraLink($integration, '10002', ['completed_at' => now()->subDays(30)]);
    trackedJiraLink($integration, '10003', ['completed_at' => now()->subDays(100)]);
    $ended = PokerGame::factory()->create(['team_id' => $integration->team_id, 'ended_at' => now()->subDay()]);
    PokerTask::factory()->imported()->create(['poker_game_id' => $ended->id])->forceFill(['external_id' => '10004'])->save();
    fakeJiraTrackerApi([]);

    runTrackedRead($integration, full: true);

    Http::assertSent(function (Request $request) {
        $jql = (string) ($request['jql'] ?? '');

        return str_contains($jql, '10001') && str_contains($jql, '10002')
            && ! str_contains($jql, '10003') && ! str_contains($jql, '10004');
    });
});

it('postpones the integration when the source rate limits', function () {
    $integration = pollingIntegration(['poll_cursor' => '2026-10-07 10:15:00', 'last_polled_at' => now()->subMinutes(10)]);
    trackedJiraLink($integration, '10001');
    Http::fake([jiraApiUrl('rest/api/3/search/jql') => Http::response(['errorMessages' => ['Slow down']], 429, ['Retry-After' => '120'])]);

    runTrackedRead($integration);

    expect(IntegrationPolls::isDue($integration->fresh()))->toBeFalse()
        ->and($integration->fresh()->poll_cursor?->toIso8601String())->toBe('2026-10-07T10:15:00+00:00');
});

it('flags webhooks that stay silent while the source changes', function (?string $lastInboundAt, IntegrationWebhookStatus $expected) {
    $integration = pollingIntegration([
        'inbound_mode' => IntegrationInboundMode::Webhook,
        'webhook_status' => IntegrationWebhookStatus::Active,
        'last_inbound_at' => $lastInboundAt,
        'poll_cursor' => '2026-10-07 09:30:00',
    ]);
    trackedJiraLink($integration, '10001');
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', ['updated' => '2026-10-07T10:00:00.000+0000', 'project' => ['key' => 'PROJ']])]);

    runTrackedRead($integration);

    expect($integration->fresh()->webhook_status)->toBe($expected);
})->with([
    'silent for a day' => ['2026-10-06 09:00:00', IntegrationWebhookStatus::Failing],
    'heard an hour ago' => ['2026-10-07 09:30:00', IntegrationWebhookStatus::Active],
]);

it('queues the daily full read of synced integrations after their check', function () {
    Queue::fake();
    $synced = pollingIntegration();
    pollingIntegration(settings: ['statusSync' => false]);
    Http::fake(['api.atlassian.com/oauth/token/accessible-resources' => Http::response([
        ['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme', 'scopes' => ['read:jira-work']],
    ])]);

    $this->artisan('skrum:check-integrations')->assertSuccessful();

    Queue::assertPushed(ReadTrackedIssues::class, 1);
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->integrationId === $synced->id && $job->full && ! $job->initial);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PollIntegrationsTest.php`
Expected: FAIL — command `skrum:poll-integrations` is not defined / class `ReadTrackedIssues` not found.

- [ ] **Step 3: Inbound modes and due-ness**

Create `app/Support/Integrations/InboundModes.php`:

```php
<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationWebhookStatus;
use App\Models\TeamIntegration;

/**
 * Spec 8 §2.3: a synced connection listens to webhooks when this instance
 * is reachable and the provider's inbound channel is set up, and polls
 * otherwise.
 */
class InboundModes
{
    public const JiraWebhookScope = 'manage:jira-webhook';

    public const HintReconnect = 'reconnect';

    public const HintManual = 'manual';

    public function __construct(private InboundReachability $reachability) {}

    public function for(TeamIntegration $integration): IntegrationInboundMode
    {
        if (! StatusSync::isOn($integration)) {
            return IntegrationInboundMode::Off;
        }

        return $this->webhooksReach($integration) ? IntegrationInboundMode::Webhook : IntegrationInboundMode::Polling;
    }

    /**
     * Whether this instance can receive this provider's webhooks at all;
     * the inbound routes answer 404 otherwise.
     */
    public function acceptsWebhooks(IntegrationProvider $provider): bool
    {
        if (! $provider->isEnabled() || ! $this->reachability->isPublic()) {
            return false;
        }

        return match ($provider) {
            IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter => true,
            IntegrationProvider::Linear => (string) config('services.linear.webhook_secret') !== '',
            IntegrationProvider::GitHub => (string) config('services.github_app.webhook_secret') !== '',
            default => false,
        };
    }

    public function refresh(TeamIntegration $integration): TeamIntegration
    {
        $mode = $this->for($integration);

        if ($integration->inbound_mode !== $mode) {
            $integration->forceFill(['inbound_mode' => $mode])->save();
        }

        return $integration;
    }

    /**
     * Why live updates are not flowing although the instance could get
     * them: the Jira Cloud connection predates the webhook scope, or a Jira
     * Data Center administrator has to register the webhook.
     */
    public function hint(TeamIntegration $integration): ?string
    {
        if (! StatusSync::isOn($integration) || ! $this->acceptsWebhooks($integration->provider)) {
            return null;
        }

        if ($integration->provider === IntegrationProvider::Jira && ! $integration->hasScope(self::JiraWebhookScope)) {
            return self::HintReconnect;
        }

        if ($integration->provider === IntegrationProvider::JiraDataCenter && $integration->setting('webhookManual') === true) {
            return self::HintManual;
        }

        return null;
    }

    private function webhooksReach(TeamIntegration $integration): bool
    {
        if (! $this->acceptsWebhooks($integration->provider)) {
            return false;
        }

        return match ($integration->provider) {
            IntegrationProvider::Jira => $integration->hasScope(self::JiraWebhookScope),
            IntegrationProvider::JiraDataCenter => $integration->webhook_status instanceof IntegrationWebhookStatus,
            default => true,
        };
    }
}
```

Create `app/Support/Integrations/IntegrationPolls.php`:

```php
<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationWebhookStatus;
use App\Models\TeamIntegration;
use Illuminate\Support\Facades\Cache;

/**
 * Spec 8 §5.4: webhook connections are reconciled hourly while their
 * webhook is pending or active; everything else is read every
 * INTEGRATIONS_POLL_MINUTES. A 429 pauses the connection until its
 * Retry-After.
 */
class IntegrationPolls
{
    public const ReconciliationMinutes = 60;

    public const CursorOverlapMinutes = 2;

    public static function intervalMinutes(TeamIntegration $integration): int
    {
        $healthyWebhook = $integration->inbound_mode === IntegrationInboundMode::Webhook
            && in_array($integration->webhook_status, [IntegrationWebhookStatus::Pending, IntegrationWebhookStatus::Active], true);

        return $healthyWebhook ? self::ReconciliationMinutes : InboundReachability::pollIntervalMinutes();
    }

    public static function isDue(TeamIntegration $integration): bool
    {
        if (Cache::has(self::pauseKey($integration->id))) {
            return false;
        }

        return $integration->last_polled_at === null
            || $integration->last_polled_at->lte(now()->subMinutes(self::intervalMinutes($integration)));
    }

    public static function pause(string $integrationId, int $seconds): void
    {
        Cache::put(self::pauseKey($integrationId), true, now()->addSeconds($seconds));
    }

    private static function pauseKey(string $integrationId): string
    {
        return "integration-poll-paused:{$integrationId}";
    }
}
```

- [ ] **Step 4: The read job**

Create `app/Jobs/Integrations/ReadTrackedIssues.php`:

```php
<?php

namespace App\Jobs\Integrations;

use App\Actions\Integrations\ApplyIssueChanges;
use App\Actions\Integrations\TrackedIssues;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationWebhookStatus;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationPolls;
use App\Support\Integrations\StatusSync;
use App\Support\Integrations\Trackers\Trackers;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;

/**
 * Spec 8 §5.4: an incremental poll (issues updated since the cursor minus
 * two minutes), or a full read of every tracked issue that also detects
 * deletions — daily, and when sync is turned on (the source then wins).
 * Reads of one connection never overlap; a failed poll waits for the next
 * run.
 */
class ReadTrackedIssues implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public const SilentWebhookHours = 24;

    public int $maxExceptions = 1;

    public int $uniqueFor = 900;

    public int $timeout = 300;

    public function __construct(public string $integrationId, public bool $full = false, public bool $initial = false) {}

    public function uniqueId(): string
    {
        return $this->integrationId.($this->full ? ':full' : ':changes');
    }

    /** @return array<int, object> */
    public function middleware(): array
    {
        return [(new WithoutOverlapping("tracked-issues:{$this->integrationId}"))->releaseAfter(30)->expireAfter(600)];
    }

    public function retryUntil(): DateTimeInterface
    {
        return now()->addMinutes(15);
    }

    public function handle(Trackers $trackers, TrackedIssues $trackedIssues, ApplyIssueChanges $applyIssueChanges): void
    {
        $integration = TeamIntegration::query()->find($this->integrationId);

        if ($integration === null || ! $integration->provider->isEnabled() || ! $integration->isActive() || ! StatusSync::isOn($integration)) {
            return;
        }

        $startedAt = now();
        $ids = $trackedIssues->ids($integration);

        try {
            if ($ids !== []) {
                $this->read($integration, $ids, $trackers, $applyIssueChanges);
            }
        } catch (RateLimited $exception) {
            IntegrationPolls::pause($integration->id, $exception->retryAfter);

            return;
        } catch (ReconnectRequired) {
            return;
        }

        $integration->forceFill(['last_polled_at' => now(), 'poll_cursor' => $startedAt])->save();
    }

    /**
     * @param  array<int, string>  $ids
     */
    private function read(TeamIntegration $integration, array $ids, Trackers $trackers, ApplyIssueChanges $applyIssueChanges): void
    {
        if ($this->full) {
            $issues = $trackers->for($integration->provider)->issues($integration, $ids);
            $applyIssueChanges->handle($integration, $ids, $issues, complete: true, sourceWins: $this->initial);

            return;
        }

        $cursor = $integration->poll_cursor ?? now()->subMinutes(IntegrationPolls::intervalMinutes($integration));
        $since = CarbonImmutable::instance($cursor)->subMinutes(IntegrationPolls::CursorOverlapMinutes);
        $issues = $trackers->syncing($integration->provider)->changedIssues($integration, $ids, $since);

        $applyIssueChanges->handle($integration, array_map('strval', array_keys($issues)), $issues, complete: false);

        $this->watchWebhooks($integration, $issues !== []);
    }

    /**
     * Spec 8 §5.3: source changes while nothing arrived for a day mean the
     * webhook does not reach skrum; the connection then polls at the
     * polling interval until an event arrives again.
     */
    private function watchWebhooks(TeamIntegration $integration, bool $foundChanges): void
    {
        $watched = $integration->inbound_mode === IntegrationInboundMode::Webhook
            && in_array($integration->webhook_status, [IntegrationWebhookStatus::Pending, IntegrationWebhookStatus::Active], true);

        if (! $foundChanges || ! $watched) {
            return;
        }

        $quietSince = $integration->last_inbound_at ?? StatusSync::webhookWatchedSince($integration);

        if ($quietSince !== null && $quietSince->gt(now()->subHours(self::SilentWebhookHours))) {
            return;
        }

        $integration->forceFill(['webhook_status' => IntegrationWebhookStatus::Failing])->save();
    }
}
```

- [ ] **Step 5: The poller, the daily read and the schedule**

Create `app/Console/Commands/PollIntegrationsCommand.php`:

```php
<?php

namespace App\Console\Commands;

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Jobs\Integrations\ReadTrackedIssues;
use App\Models\TeamIntegration;
use App\Support\Integrations\InboundModes;
use App\Support\Integrations\IntegrationPolls;
use Illuminate\Console\Command;

class PollIntegrationsCommand extends Command
{
    protected $signature = 'skrum:poll-integrations';

    protected $description = 'Queue a read of every synced tracker integration that is due';

    public function handle(InboundModes $inboundModes): int
    {
        $trackers = array_map(
            fn (IntegrationProvider $provider): string => $provider->value,
            array_filter(IntegrationProvider::enabled(), fn (IntegrationProvider $provider): bool => $provider->isTracker()),
        );
        $queued = 0;

        TeamIntegration::query()
            ->where('status', IntegrationStatus::Active->value)
            ->whereIn('provider', $trackers)
            ->where('settings->statusSync', true)
            ->lazyById()
            ->each(function (TeamIntegration $integration) use ($inboundModes, &$queued): void {
                $inboundModes->refresh($integration);

                if (! IntegrationPolls::isDue($integration)) {
                    return;
                }

                $this->info("Queueing a read of {$integration->provider->label()} integration `{$integration->id}`…");
                ReadTrackedIssues::dispatch($integration->id);
                $queued++;
            });

        $this->comment("Queued {$queued} integration reads.");

        return self::SUCCESS;
    }
}
```

In `app/Console/Commands/CheckIntegrationsCommand.php`, import `App\Jobs\Integrations\ReadTrackedIssues` and `App\Support\Integrations\StatusSync`, and add right after `$checkIntegration->handle($integration);`:

```php
                    if (StatusSync::isOn($integration)) {
                        ReadTrackedIssues::dispatch($integration->id, true);
                    }
```

In `routes/console.php`, add after the `skrum:telegram-poll` schedule:

```php
Schedule::command('skrum:poll-integrations')
    ->everyMinute()
    ->withoutOverlapping(5)
    ->runInBackground()
    ->onOneServer();
```

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PollIntegrationsTest.php tests/Feature/Integrations/IntegrationMaintenanceTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 7: Commit**

```bash
git add app/Support/Integrations/InboundModes.php app/Support/Integrations/IntegrationPolls.php app/Jobs/Integrations/ReadTrackedIssues.php app/Console/Commands/PollIntegrationsCommand.php app/Console/Commands/CheckIntegrationsCommand.php routes/console.php tests/Feature/Integrations/PollIntegrationsTest.php
git commit -m "feat(integrations): poll synced trackers and reconcile them daily"
```

---

### Task 6: Inbound webhook endpoints

Four public routes verify each delivery (URL token, Atlassian JWT, HMAC signatures, Linear timestamp), de-duplicate it by delivery id, keep only a payload-free row, and queue a re-read of the tracked issues it names; GitHub installation removals ask for a reconnect.

**Files:**
- Create: `routes/webhooks.php`, `app/Http/Middleware/EnsureInboundWebhooks.php`, `app/Http/Controllers/Integrations/InboundWebhooksController.php`, `app/Support/Integrations/Inbound/{InboundEvent,ReadInboundEvent,InboundSignatureInvalid,JiraWebhookJwt}.php`, `app/Jobs/Integrations/ApplyInboundIssueChanges.php`, `tests/Feature/Integrations/InboundWebhooksTest.php`
- Modify: `bootstrap/app.php`, `app/Support/Integrations/IntegrationErrors.php`

**Interfaces:**
- Consumes: Tasks 4–5 (`TrackedIssues::{among, inRepositories}`, `ApplyIssueChanges`, `InboundModes::acceptsWebhooks`, `StatusSync`); 14a `IntegrationInboundEvent`, `InboundEventStatus`, `IntegrationWebhookStatus`; 14c `GitHubClient::forgetInstallationToken()` and the GitHub reconnect messages.
- Produces: routes `integrations.webhooks.tracker.store` (`POST integrations/webhooks/{source}/{integration}/{token}`, `source` ∈ `jira`, `jira-dc`) and `integrations.webhooks.store` (`POST integrations/webhooks/{source}`, `source` ∈ `linear`, `github`); `ReadInboundEvent::provider(string $source)`; `ApplyInboundIssueChanges($integrationId, array $externalIds, ?string $eventId = null)`; `JiraWebhookJwt::{isValid, encode}`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/InboundWebhooksTest.php`:

```php
<?php

use App\Enums\InboundEventStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\IntegrationWebhookStatus;
use App\Jobs\Integrations\ApplyInboundIssueChanges;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationInboundEvent;
use App\Models\TeamIntegration;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

const InboundJiraToken = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd';

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
    config([
        'services.integrations.inbound_webhooks' => 'on',
        'services.linear.webhook_secret' => 'linear-webhook-secret',
        'services.github_app.webhook_secret' => 'github-webhook-secret',
    ]);
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter, IntegrationProvider::Linear, IntegrationProvider::GitHub);
});

function jiraWebhookToken(TeamIntegration $integration, ?string $secret = null): TeamIntegration
{
    $integration->forceFill(['credentials' => [
        ...(array) $integration->readableCredentials(),
        'webhookToken' => InboundJiraToken,
        ...($secret === null ? [] : ['webhookSecret' => $secret]),
    ]])->save();

    return $integration;
}

function inboundJiraUrl(TeamIntegration $integration, string $token = InboundJiraToken, string $source = 'jira'): string
{
    return route('integrations.webhooks.tracker.store', ['source' => $source, 'integration' => $integration->id, 'token' => $token]);
}

function jiraWebhookBody(string $issueId = '10001'): string
{
    return json_encode(['webhookEvent' => 'jira:issue_updated', 'issue' => ['id' => $issueId, 'key' => 'PROJ-1', 'fields' => ['status' => ['name' => 'Done']]]], JSON_THROW_ON_ERROR);
}

/**
 * @param  array<string, string>  $headers
 */
function postInboundWebhook(string $url, string $body, array $headers = []): TestResponse
{
    $server = ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'];

    foreach ($headers as $name => $value) {
        $server['HTTP_'.strtoupper(str_replace('-', '_', $name))] = $value;
    }

    return test()->call('POST', $url, [], [], [], $server, $body);
}

/**
 * @param  array<string, mixed>  $payload
 * @return array{0: string, 1: array<string, string>}
 */
function signedLinearWebhook(array $payload = [], string $delivery = 'linear-delivery-1'): array
{
    $body = json_encode([
        'action' => 'update',
        'type' => 'Issue',
        'organizationId' => 'org-1',
        'data' => ['id' => 'lin-1'],
        'webhookTimestamp' => now()->getTimestampMs(),
        ...$payload,
    ], JSON_THROW_ON_ERROR);

    return [$body, ['Linear-Delivery' => $delivery, 'Linear-Signature' => hash_hmac('sha256', $body, 'linear-webhook-secret')]];
}

/**
 * @param  array<string, mixed>  $payload
 * @return array{0: string, 1: array<string, string>}
 */
function signedGitHubWebhook(string $event, array $payload, string $delivery = 'github-delivery-1'): array
{
    $body = json_encode(['installation' => ['id' => 4242], ...$payload], JSON_THROW_ON_ERROR);

    return [$body, [
        'X-GitHub-Event' => $event,
        'X-GitHub-Delivery' => $delivery,
        'X-Hub-Signature-256' => 'sha256='.hash_hmac('sha256', $body, 'github-webhook-secret'),
    ]];
}

/**
 * @param  array<string, mixed>  $claims
 */
function hs256Jwt(array $claims, string $secret): string
{
    $encode = fn (string $value): string => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    $header = $encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
    $payload = $encode(json_encode($claims, JSON_THROW_ON_ERROR));

    return "{$header}.{$payload}.".$encode(hash_hmac('sha256', "{$header}.{$payload}", $secret, true));
}

function withStatusSync(TeamIntegration $integration): TeamIntegration
{
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => true]])->save();

    return $integration;
}

it('accepts a Jira event with its URL token and queues a re-read', function () {
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);

    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody(), ['X-Atlassian-Webhook-Identifier' => 'delivery-1'])
        ->assertStatus(202)
        ->assertCookieMissing(config('session.cookie'));

    Queue::assertPushed(ApplyInboundIssueChanges::class, fn (ApplyInboundIssueChanges $job) => $job->integrationId === $integration->id
        && $job->externalIds === ['10001']);
    $event = IntegrationInboundEvent::query()->sole();
    expect($event->event_key)->toBe('delivery-1')
        ->and($event->event_type)->toBe('jira:issue_updated')
        ->and($event->status)->toBe(InboundEventStatus::Applied)
        ->and($event->team_integration_id)->toBe($integration->id)
        ->and($integration->fresh()->last_inbound_at?->toIso8601String())->toBe('2026-10-07T10:30:00+00:00');
});

it('refuses a wrong token and logs once an hour', function () {
    Log::spy();
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);

    postInboundWebhook(inboundJiraUrl($integration, str_repeat('x', 40)), jiraWebhookBody())->assertUnauthorized();
    postInboundWebhook(inboundJiraUrl($integration, str_repeat('y', 40)), jiraWebhookBody('10002'))->assertUnauthorized();

    Queue::assertNothingPushed();
    $rejected = IntegrationInboundEvent::query()->where('status', InboundEventStatus::Rejected->value)->get();
    expect($rejected)->toHaveCount(2)
        ->and($rejected->pluck('event_key')->every(fn (string $key) => str_starts_with($key, 'rejected:')))->toBeTrue()
        ->and($rejected->toJson())->not->toContain('PROJ-1')->not->toContain('10001');
    Log::shouldHaveReceived('warning')->once();
});

it('verifies the Atlassian JWT when one is sent', function (string $secret, int $expiresIn, int $status) {
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);
    $jwt = hs256Jwt(['iss' => 'jira', 'exp' => now()->addSeconds($expiresIn)->getTimestamp()], $secret);

    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody(), ['Authorization' => "Bearer {$jwt}"])->assertStatus($status);
})->with([
    'valid' => ['jira-secret', 60, 202],
    'other secret' => ['not-the-secret', 60, 401],
    'expired' => ['jira-secret', -300, 401],
]);

it('answers duplicates with 200 and no job', function () {
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);

    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody(), ['X-Atlassian-Webhook-Identifier' => 'same'])->assertStatus(202);
    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody(), ['X-Atlassian-Webhook-Identifier' => 'same'])->assertOk();

    Queue::assertPushed(ApplyInboundIssueChanges::class, 1);
});

it('ignores issues skrum does not track', function () {
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);

    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody('99999'))->assertStatus(202);

    Queue::assertNothingPushed();
    expect(IntegrationInboundEvent::query()->sole()->status)->toBe(InboundEventStatus::Ignored);
});

it('refuses bodies over 1 MB', function () {
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);

    postInboundWebhook(inboundJiraUrl($integration), str_repeat('a', 1_048_577))->assertStatus(413);

    expect(IntegrationInboundEvent::query()->count())->toBe(0);
});

it('answers 404 where this instance cannot take the provider’s webhooks', function () {
    ['integration' => $integration] = statusSyncLink();
    jiraWebhookToken($integration);
    [$linearBody, $linearHeaders] = signedLinearWebhook();

    config(['services.linear.webhook_secret' => '']);
    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'linear']), $linearBody, $linearHeaders)->assertNotFound();

    config(['services.integrations.inbound_webhooks' => 'off']);
    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody())->assertNotFound();

    config(['services.integrations.inbound_webhooks' => 'on']);
    disableIntegrations();
    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody())->assertNotFound();
});

it('checks the Jira Data Center signature when one is sent', function (?string $signatureSecret, int $status) {
    $integration = withStatusSync(TeamIntegration::factory()->jiraDataCenter()->create());
    jiraWebhookToken($integration, 'dc-webhook-secret');
    $body = jiraWebhookBody();
    $headers = $signatureSecret === null ? [] : ['X-Hub-Signature' => 'sha256='.hash_hmac('sha256', $body, $signatureSecret)];

    postInboundWebhook(inboundJiraUrl($integration, source: 'jira-dc'), $body, $headers)->assertStatus($status);
})->with([
    'signed' => ['dc-webhook-secret', 202],
    'badly signed' => ['another-secret', 401],
    'unsigned' => [null, 202],
]);

it('routes Linear events by organization to every synced team', function () {
    $first = withStatusSync(TeamIntegration::factory()->linear()->create());
    $second = withStatusSync(TeamIntegration::factory()->linear()->create());
    $off = TeamIntegration::factory()->linear()->create();

    foreach ([$first, $second, $off] as $integration) {
        ActionItemExternalLink::factory()->linear()->create([
            'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id])->id,
            'external_id' => 'lin-1',
        ]);
    }

    [$body, $headers] = signedLinearWebhook();

    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'linear']), $body, $headers)->assertStatus(202);

    Queue::assertPushed(ApplyInboundIssueChanges::class, 2);
    Queue::assertNotPushed(ApplyInboundIssueChanges::class, fn (ApplyInboundIssueChanges $job) => $job->integrationId === $off->id);
});

it('refuses stale or badly signed Linear deliveries', function () {
    withStatusSync(TeamIntegration::factory()->linear()->create());
    [$stale, $staleHeaders] = signedLinearWebhook(['webhookTimestamp' => now()->subMinutes(2)->getTimestampMs()]);
    [$body] = signedLinearWebhook(delivery: 'linear-delivery-2');

    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'linear']), $stale, $staleHeaders)->assertUnauthorized();
    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'linear']), $body, ['Linear-Signature' => str_repeat('0', 64)])->assertUnauthorized();

    Queue::assertNothingPushed();
});

it('queues a re-read for GitHub issue events of the installation', function () {
    $integration = withStatusSync(TeamIntegration::factory()->gitHub()->create());
    ActionItemExternalLink::factory()->create([
        'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id])->id,
        'source' => IntegrationProvider::GitHub,
        'external_site' => '4242',
        'external_id' => '9001/12',
        'external_key' => 'acme/api#12',
        'external_url' => 'https://github.com/acme/api/issues/12',
    ]);
    [$body, $headers] = signedGitHubWebhook('issues', ['action' => 'closed', 'issue' => ['number' => 12], 'repository' => ['id' => 9001, 'full_name' => 'acme/api']]);

    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'github']), $body, $headers)->assertStatus(202);

    Queue::assertPushed(ApplyInboundIssueChanges::class, fn (ApplyInboundIssueChanges $job) => $job->externalIds === ['9001/12']);
});

it('re-reads the issues of repositories removed from the installation', function () {
    $integration = withStatusSync(TeamIntegration::factory()->gitHub()->create());
    ActionItemExternalLink::factory()->create([
        'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id])->id,
        'source' => IntegrationProvider::GitHub,
        'external_site' => '4242',
        'external_id' => '9001/12',
        'external_key' => 'acme/api#12',
        'external_url' => 'https://github.com/acme/api/issues/12',
    ]);
    [$body, $headers] = signedGitHubWebhook('installation_repositories', ['action' => 'removed', 'repositories_removed' => [['id' => 9001]]]);

    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'github']), $body, $headers)->assertStatus(202);

    Queue::assertPushed(ApplyInboundIssueChanges::class, fn (ApplyInboundIssueChanges $job) => $job->externalIds === ['9001/12']);
});

it('asks every team to reconnect when the GitHub App is uninstalled or suspended', function (string $action, string $message) {
    $first = TeamIntegration::factory()->gitHub()->create();
    $second = TeamIntegration::factory()->gitHub()->create();
    Cache::put('github-installation-token:4242', 'cached', now()->addMinutes(50));
    [$body, $headers] = signedGitHubWebhook('installation', ['action' => $action]);

    postInboundWebhook(route('integrations.webhooks.store', ['source' => 'github']), $body, $headers)->assertStatus(202);

    expect($first->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($second->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($first->fresh()->last_error)->toBe($message)
        ->and(Cache::has('github-installation-token:4242'))->toBeFalse();
})->with([
    'deleted' => ['deleted', 'The GitHub App was uninstalled from acme.'],
    'suspended' => ['suspend', 'The GitHub App is suspended on acme.'],
]);

it('marks the webhook active on its first verified event', function () {
    ['integration' => $integration] = statusSyncLink();
    $integration->forceFill(['webhook_status' => IntegrationWebhookStatus::Pending])->save();
    jiraWebhookToken($integration);

    postInboundWebhook(inboundJiraUrl($integration), jiraWebhookBody())->assertStatus(202);

    expect($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Active);
});

it('trusts the API, not the payload', function () {
    ['integration' => $integration, 'item' => $item] = statusSyncLink();
    $event = IntegrationInboundEvent::factory()->create(['team_integration_id' => $integration->id, 'status' => InboundEventStatus::Applied]);
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', [
        'status' => ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']],
        'project' => ['key' => 'PROJ'],
    ])]);

    app()->call([(new ApplyInboundIssueChanges($integration->id, ['10001'], $event->id))->withFakeQueueInteractions(), 'handle']);

    expect($item->fresh()->completed_at)->toBeNull()
        ->and($event->fresh()->status)->toBe(InboundEventStatus::Applied);
});

it('reads nothing for connections whose sync was turned off meanwhile', function () {
    ['integration' => $integration] = statusSyncLink(syncOn: false);
    $event = IntegrationInboundEvent::factory()->create(['team_integration_id' => $integration->id]);

    app()->call([(new ApplyInboundIssueChanges($integration->id, ['10001'], $event->id))->withFakeQueueInteractions(), 'handle']);

    Http::assertNothingSent();
    expect($event->fresh()->status)->toBe(InboundEventStatus::Ignored);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/InboundWebhooksTest.php`
Expected: FAIL — `Route [integrations.webhooks.tracker.store] not defined.`

- [ ] **Step 3: Read and verify a delivery**

Create `app/Support/Integrations/Inbound/InboundEvent.php`:

```php
<?php

namespace App\Support\Integrations\Inbound;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use Illuminate\Support\Collection;

/**
 * What a verified delivery says, and nothing more (spec 8 §5.3): its key,
 * type, the connections it concerns and the issues to re-read.
 */
class InboundEvent
{
    /**
     * @param  Collection<int, TeamIntegration>  $integrations
     * @param  array<int, string>  $externalIds
     * @param  array<int, string>  $removedRepositoryIds
     * @param  'deleted'|'suspend'|null  $installationRemoved
     */
    public function __construct(
        public IntegrationProvider $provider,
        public string $key,
        public string $type,
        public Collection $integrations,
        public array $externalIds = [],
        public array $removedRepositoryIds = [],
        public ?string $installationRemoved = null,
        public ?string $installationId = null,
    ) {}
}
```

Create `app/Support/Integrations/Inbound/InboundSignatureInvalid.php`:

```php
<?php

namespace App\Support\Integrations\Inbound;

use App\Models\TeamIntegration;
use RuntimeException;

class InboundSignatureInvalid extends RuntimeException
{
    public function __construct(public ?TeamIntegration $integration = null)
    {
        parent::__construct('The webhook signature or token did not match.');
    }
}
```

Create `app/Support/Integrations/Inbound/JiraWebhookJwt.php`:

```php
<?php

namespace App\Support\Integrations\Inbound;

/**
 * The JWT Atlassian may send with dynamic webhooks of OAuth 2.0 apps,
 * signed HS256 with the app's client secret.
 */
class JiraWebhookJwt
{
    private const LeewaySeconds = 60;

    public static function isValid(string $token, string $secret): bool
    {
        $parts = explode('.', $token);

        if (count($parts) !== 3 || $secret === '') {
            return false;
        }

        [$header, $payload, $signature] = $parts;
        $decodedHeader = json_decode(self::decode($header), true);

        if (! is_array($decodedHeader) || ($decodedHeader['alg'] ?? null) !== 'HS256') {
            return false;
        }

        if (! hash_equals(self::encode(hash_hmac('sha256', "{$header}.{$payload}", $secret, true)), $signature)) {
            return false;
        }

        $claims = json_decode(self::decode($payload), true);

        if (! is_array($claims)) {
            return false;
        }

        $expiresAt = $claims['exp'] ?? null;

        return ! is_int($expiresAt) || $expiresAt + self::LeewaySeconds >= now()->getTimestamp();
    }

    public static function encode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function decode(string $value): string
    {
        $padded = str_pad($value, strlen($value) + (4 - strlen($value) % 4) % 4, '=');
        $decoded = base64_decode(strtr($padded, '-_', '+/'), true);

        return $decoded === false ? '' : $decoded;
    }
}
```

Create `app/Support/Integrations/Inbound/ReadInboundEvent.php`:

```php
<?php

namespace App\Support\Integrations\Inbound;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use Illuminate\Http\Request;

/**
 * Verifies a provider delivery and extracts its key, type, target
 * connections and issue ids (spec 8 §5.3). Payloads are hints: nothing
 * else is read from them, and they are never kept.
 */
class ReadInboundEvent
{
    private const KeyLength = 191;

    private const TypeLength = 100;

    private const TimestampToleranceMs = 60_000;

    public static function provider(string $source): IntegrationProvider
    {
        return match ($source) {
            'jira' => IntegrationProvider::Jira,
            'jira-dc' => IntegrationProvider::JiraDataCenter,
            'linear' => IntegrationProvider::Linear,
            'github' => IntegrationProvider::GitHub,
            default => abort(404),
        };
    }

    /**
     * @throws InboundSignatureInvalid
     */
    public function handle(IntegrationProvider $provider, Request $request, ?string $integrationId, ?string $token): InboundEvent
    {
        return match ($provider) {
            IntegrationProvider::Jira => $this->jira($request, $integrationId, $token),
            IntegrationProvider::JiraDataCenter => $this->jiraDataCenter($request, $integrationId, $token),
            IntegrationProvider::Linear => $this->linear($request),
            IntegrationProvider::GitHub => $this->gitHub($request),
            default => abort(404),
        };
    }

    private function jira(Request $request, ?string $integrationId, ?string $token): InboundEvent
    {
        $integration = $this->integrationWithToken(IntegrationProvider::Jira, $integrationId, $token);
        $jwt = $request->bearerToken();

        if ($jwt !== null && ! JiraWebhookJwt::isValid($jwt, (string) config('services.jira.client_secret'))) {
            throw new InboundSignatureInvalid($integration);
        }

        return $this->jiraEvent(IntegrationProvider::Jira, $request, $integration);
    }

    private function jiraDataCenter(Request $request, ?string $integrationId, ?string $token): InboundEvent
    {
        $integration = $this->integrationWithToken(IntegrationProvider::JiraDataCenter, $integrationId, $token);
        $signature = (string) $request->header('X-Hub-Signature', '');

        if ($signature !== '') {
            $secret = $integration->credential('webhookSecret');

            if (! is_string($secret) || $secret === '' || ! hash_equals('sha256='.hash_hmac('sha256', $request->getContent(), $secret), $signature)) {
                throw new InboundSignatureInvalid($integration);
            }
        }

        return $this->jiraEvent(IntegrationProvider::JiraDataCenter, $request, $integration);
    }

    private function linear(Request $request): InboundEvent
    {
        $secret = (string) config('services.linear.webhook_secret');
        $signature = (string) $request->header('Linear-Signature', '');

        if ($secret === '' || $signature === '' || ! hash_equals(hash_hmac('sha256', $request->getContent(), $secret), $signature)) {
            throw new InboundSignatureInvalid;
        }

        $payload = $this->payload($request);
        $sentAt = $payload['webhookTimestamp'] ?? null;

        if (! is_int($sentAt) || abs(now()->getTimestampMs() - $sentAt) > self::TimestampToleranceMs) {
            throw new InboundSignatureInvalid;
        }

        $organizationId = $payload['organizationId'] ?? null;
        $issueId = ($payload['type'] ?? null) === 'Issue' ? data_get($payload, 'data.id') : null;
        $type = implode('.', array_filter([$payload['type'] ?? null, $payload['action'] ?? null], 'is_string'));

        return new InboundEvent(
            provider: IntegrationProvider::Linear,
            key: $this->key($request, 'Linear-Delivery'),
            type: $this->type($type),
            integrations: is_string($organizationId)
                ? TeamIntegration::query()->where('provider', IntegrationProvider::Linear->value)->where('settings->organizationId', $organizationId)->get()
                : collect(),
            externalIds: is_string($issueId) && $issueId !== '' ? [$issueId] : [],
        );
    }

    private function gitHub(Request $request): InboundEvent
    {
        $secret = (string) config('services.github_app.webhook_secret');
        $signature = (string) $request->header('X-Hub-Signature-256', '');

        if ($secret === '' || ! hash_equals('sha256='.hash_hmac('sha256', $request->getContent(), $secret), $signature)) {
            throw new InboundSignatureInvalid;
        }

        $payload = $this->payload($request);
        $event = (string) $request->header('X-GitHub-Event', '');
        $action = is_string($payload['action'] ?? null) ? $payload['action'] : '';
        $installationId = data_get($payload, 'installation.id');
        $number = data_get($payload, 'issue.number');
        $repositoryId = data_get($payload, 'repository.id');

        return new InboundEvent(
            provider: IntegrationProvider::GitHub,
            key: $this->key($request, 'X-GitHub-Delivery'),
            type: $this->type("{$event}.{$action}"),
            integrations: is_int($installationId)
                ? TeamIntegration::query()->where('provider', IntegrationProvider::GitHub->value)->where('settings->installationId', (string) $installationId)->get()
                : collect(),
            externalIds: $event === 'issues' && is_int($number) && is_int($repositoryId) ? ["{$repositoryId}/{$number}"] : [],
            removedRepositoryIds: $event === 'installation_repositories' && $action === 'removed'
                ? $this->repositoryIds($payload['repositories_removed'] ?? [])
                : [],
            installationRemoved: $event === 'installation' && in_array($action, ['deleted', 'suspend'], true) ? $action : null,
            installationId: is_int($installationId) ? (string) $installationId : null,
        );
    }

    private function integrationWithToken(IntegrationProvider $provider, ?string $integrationId, ?string $token): TeamIntegration
    {
        $integration = $integrationId === null
            ? null
            : TeamIntegration::query()->where('provider', $provider->value)->find($integrationId);
        $expected = $integration?->readableCredentials()['webhookToken'] ?? null;

        if ($integration === null || ! is_string($expected) || $expected === '' || ! is_string($token) || ! hash_equals($expected, $token)) {
            throw new InboundSignatureInvalid($integration);
        }

        return $integration;
    }

    private function jiraEvent(IntegrationProvider $provider, Request $request, TeamIntegration $integration): InboundEvent
    {
        $payload = $this->payload($request);
        $issueId = data_get($payload, 'issue.id');
        $issueId = is_int($issueId) ? (string) $issueId : $issueId;

        return new InboundEvent(
            provider: $provider,
            key: $this->key($request, 'X-Atlassian-Webhook-Identifier'),
            type: $this->type($payload['webhookEvent'] ?? null),
            integrations: collect([$integration]),
            externalIds: is_string($issueId) && ctype_digit($issueId) ? [$issueId] : [],
        );
    }

    /**
     * @return array<int, string>
     */
    private function repositoryIds(mixed $repositories): array
    {
        $ids = [];

        foreach ((array) $repositories as $repository) {
            $id = data_get($repository, 'id');

            if (is_int($id)) {
                $ids[] = (string) $id;
            }
        }

        return $ids;
    }

    private function key(Request $request, string $header): string
    {
        $delivery = trim((string) $request->header($header, ''));

        return $delivery !== '' ? mb_substr($delivery, 0, self::KeyLength) : hash('sha256', $request->getContent());
    }

    private function type(mixed $type): string
    {
        return is_string($type) && $type !== '' ? mb_substr($type, 0, self::TypeLength) : 'unknown';
    }

    /**
     * @return array<array-key, mixed>
     */
    private function payload(Request $request): array
    {
        $decoded = json_decode($request->getContent(), true);

        return is_array($decoded) ? $decoded : [];
    }
}
```

- [ ] **Step 4: The routes, middleware and controller**

Create `app/Http/Middleware/EnsureInboundWebhooks.php`:

```php
<?php

namespace App\Http\Middleware;

use App\Support\Integrations\Inbound\ReadInboundEvent;
use App\Support\Integrations\InboundModes;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Inbound routes exist only while the provider is enabled and this
 * instance can receive its webhooks (spec 8 §5.3); otherwise 404.
 */
class EnsureInboundWebhooks
{
    public function __construct(private InboundModes $inboundModes) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $provider = ReadInboundEvent::provider((string) $request->route('source'));

        abort_unless($this->inboundModes->acceptsWebhooks($provider), 404);

        return $next($request);
    }
}
```

Create `app/Http/Controllers/Integrations/InboundWebhooksController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\TrackedIssues;
use App\Enums\InboundEventStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\IntegrationWebhookStatus;
use App\Http\Controllers\Controller;
use App\Jobs\Integrations\ApplyInboundIssueChanges;
use App\Models\IntegrationInboundEvent;
use App\Models\TeamIntegration;
use App\Support\Integrations\GitHub\GitHubClient;
use App\Support\Integrations\Inbound\InboundEvent;
use App\Support\Integrations\Inbound\InboundSignatureInvalid;
use App\Support\Integrations\Inbound\ReadInboundEvent;
use App\Support\Integrations\StatusSync;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Spec 8 §5.3: webhooks are hints, the API is the truth. A verified
 * delivery is recorded once by key (no payload) and only queues a re-read
 * of the issues the connections track.
 */
class InboundWebhooksController extends Controller
{
    private const MaxBodyBytes = 1_048_576;

    public function __construct(
        private ReadInboundEvent $readInboundEvent,
        private TrackedIssues $trackedIssues,
        private GitHubClient $gitHub,
    ) {}

    public function store(Request $request, string $source, ?string $integration = null, ?string $token = null): JsonResponse
    {
        if ((int) $request->header('Content-Length', '0') > self::MaxBodyBytes || strlen($request->getContent()) > self::MaxBodyBytes) {
            abort(413);
        }

        $provider = ReadInboundEvent::provider($source);

        try {
            $event = $this->readInboundEvent->handle($provider, $request, $integration, $token);
        } catch (InboundSignatureInvalid $exception) {
            $this->reject($provider, $request, $exception->integration);

            return response()->json(['message' => __('Invalid signature.')], 401);
        }

        $row = IntegrationInboundEvent::query()->createOrFirst(
            ['provider' => $provider, 'event_key' => $event->key],
            [
                'team_integration_id' => $event->integrations->first()?->id,
                'event_type' => $event->type,
                'status' => InboundEventStatus::Ignored,
                'received_at' => now(),
            ],
        );

        if (! $row->wasRecentlyCreated) {
            return response()->json(['status' => 'duplicate']);
        }

        $this->markHeard($event);

        if ($event->installationRemoved !== null) {
            $this->removeInstallation($event);
            $row->update(['status' => InboundEventStatus::Applied]);

            return response()->json(['status' => 'accepted'], 202);
        }

        $batches = $this->batches($event);

        if ($batches !== []) {
            $row->update(['status' => InboundEventStatus::Applied]);
        }

        foreach ($batches as $integrationId => $externalIds) {
            ApplyInboundIssueChanges::dispatch((string) $integrationId, $externalIds, $row->id);
        }

        return response()->json(['status' => 'accepted'], 202);
    }

    /**
     * @return array<string, array<int, string>> tracked ids per synced connection
     */
    private function batches(InboundEvent $event): array
    {
        $batches = [];

        foreach ($event->integrations as $integration) {
            if (! $integration->isActive() || ! StatusSync::isOn($integration)) {
                continue;
            }

            $ids = $event->removedRepositoryIds !== []
                ? $this->trackedIssues->inRepositories($integration, $event->removedRepositoryIds)
                : $this->trackedIssues->among($integration, $event->externalIds);

            if ($ids !== []) {
                $batches[$integration->id] = $ids;
            }
        }

        return $batches;
    }

    private function markHeard(InboundEvent $event): void
    {
        foreach ($event->integrations as $integration) {
            $integration->forceFill([
                'last_inbound_at' => now(),
                'webhook_status' => $integration->webhook_status === null ? null : IntegrationWebhookStatus::Active,
            ])->save();
        }
    }

    private function removeInstallation(InboundEvent $event): void
    {
        foreach ($event->integrations as $integration) {
            if ($integration->status === IntegrationStatus::ReconnectRequired) {
                continue;
            }

            $account = ['account' => (string) $integration->setting('accountLogin', 'GitHub')];

            $integration->markReconnectRequired($event->installationRemoved === 'suspend'
                ? __('The GitHub App is suspended on :account.', $account)
                : __('The GitHub App was uninstalled from :account.', $account));
        }

        if ($event->installationId !== null) {
            $this->gitHub->forgetInstallationToken($event->installationId);
        }
    }

    /**
     * Rejected rows use their own key space, so a forged request can never
     * occupy the delivery id of a genuine one.
     */
    private function reject(IntegrationProvider $provider, Request $request, ?TeamIntegration $integration): void
    {
        IntegrationInboundEvent::query()->createOrFirst(
            ['provider' => $provider, 'event_key' => 'rejected:'.hash('sha256', $request->getContent())],
            [
                'team_integration_id' => $integration?->id,
                'event_type' => 'rejected',
                'status' => InboundEventStatus::Rejected,
                'detail' => 'signature_mismatch',
                'received_at' => now(),
            ],
        );

        if (Cache::add("inbound-webhook-rejected:{$provider->value}", true, now()->addHour())) {
            Log::warning("Rejected an inbound {$provider->label()} webhook: its signature or token did not match.");
        }
    }
}
```

Create `routes/webhooks.php`:

```php
<?php

use App\Http\Controllers\Integrations\InboundWebhooksController;
use App\Http\Middleware\EnsureInboundWebhooks;
use Illuminate\Support\Facades\Route;

/*
 * Provider webhooks (spec 8 §5.3): outside the web group, so no session,
 * cookie or CSRF token; every request proves itself with its URL token or
 * signature.
 */
Route::middleware(['throttle:120,1,integrationWebhooks', EnsureInboundWebhooks::class])->group(function () {
    Route::post('integrations/webhooks/{source}/{integration}/{token}', [InboundWebhooksController::class, 'store'])
        ->whereIn('source', ['jira', 'jira-dc'])
        ->whereUuid('integration')
        ->where('token', '[A-Za-z0-9]{40}')
        ->name('integrations.webhooks.tracker.store');

    Route::post('integrations/webhooks/{source}', [InboundWebhooksController::class, 'store'])
        ->whereIn('source', ['linear', 'github'])
        ->name('integrations.webhooks.store');
});
```

In `bootstrap/app.php`, add `use Illuminate\Support\Facades\Route;` and the `then` argument of `withRouting()`:

```php
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            Route::group([], base_path('routes/webhooks.php'));
        },
    )
```

In `app/Support/Integrations/IntegrationErrors.php`, add to `Patterns` (before the query-string pattern):

```php
        '#(/integrations/webhooks/jira(?:-dc)?/[0-9a-f-]{36}/)[A-Za-z0-9]{40}#i' => '$1***',
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 5: The re-read job**

Create `app/Jobs/Integrations/ApplyInboundIssueChanges.php`:

```php
<?php

namespace App\Jobs\Integrations;

use App\Actions\Integrations\ApplyIssueChanges;
use App\Actions\Integrations\TrackedIssues;
use App\Enums\InboundEventStatus;
use App\Models\IntegrationInboundEvent;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationErrors;
use App\Support\Integrations\StatusSync;
use App\Support\Integrations\Trackers\Trackers;
use DateTimeInterface;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Throwable;

/**
 * Re-reads the issues a webhook named with the connection's own
 * credentials and applies what the source says (spec 8 §5.3, §5.5).
 */
class ApplyInboundIssueChanges implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $maxExceptions = 3;

    public int $uniqueFor = 300;

    /** @var array<int, int> */
    public array $backoff = [10, 60];

    /**
     * @param  array<int, string>  $externalIds
     */
    public function __construct(public string $integrationId, public array $externalIds, public ?string $eventId = null) {}

    public function uniqueId(): string
    {
        $ids = $this->externalIds;
        sort($ids);

        return $this->integrationId.':'.sha1(implode(',', $ids));
    }

    /** @return array<int, object> */
    public function middleware(): array
    {
        return [(new WithoutOverlapping("inbound-issues:{$this->integrationId}"))->releaseAfter(5)->expireAfter(120)];
    }

    public function retryUntil(): DateTimeInterface
    {
        return now()->addMinutes(15);
    }

    public function handle(Trackers $trackers, TrackedIssues $trackedIssues, ApplyIssueChanges $applyIssueChanges): void
    {
        $integration = TeamIntegration::query()->find($this->integrationId);

        if ($integration === null || ! $integration->provider->isEnabled() || ! $integration->isActive() || ! StatusSync::isOn($integration)) {
            $this->mark(InboundEventStatus::Ignored);

            return;
        }

        $ids = $trackedIssues->among($integration, $this->externalIds);

        if ($ids === []) {
            $this->mark(InboundEventStatus::Ignored);

            return;
        }

        try {
            $issues = $trackers->for($integration->provider)->issues($integration, $ids);
        } catch (RateLimited $exception) {
            $this->release($exception->retryAfter);

            return;
        } catch (ReconnectRequired $exception) {
            $this->mark(InboundEventStatus::Failed, $exception->userMessage());

            return;
        }

        $applyIssueChanges->handle($integration, $ids, $issues, complete: true);

        $this->mark(InboundEventStatus::Applied);
    }

    public function failed(?Throwable $exception): void
    {
        $this->mark(InboundEventStatus::Failed, $exception instanceof IntegrationException ? $exception->userMessage() : null);
    }

    private function mark(InboundEventStatus $status, ?string $detail = null): void
    {
        if ($this->eventId === null) {
            return;
        }

        IntegrationInboundEvent::query()->whereKey($this->eventId)->update([
            'status' => $status->value,
            'detail' => $detail === null ? null : IntegrationErrors::sanitize($detail),
        ]);
    }
}
```

- [ ] **Step 6: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Invalid signature.` | `Signature invalide.` | `Firma no válida.` | `Ungültige Signatur.` |

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/InboundWebhooksTest.php tests/Feature/Integrations/IntegrationErrorsTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 8: Commit**

```bash
git add routes/webhooks.php bootstrap/app.php app/Http/Middleware/EnsureInboundWebhooks.php app/Http/Controllers/Integrations/InboundWebhooksController.php app/Support/Integrations/Inbound app/Jobs/Integrations/ApplyInboundIssueChanges.php app/Support/Integrations/IntegrationErrors.php tests/Feature/Integrations/InboundWebhooksTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): receive verified tracker webhooks and re-read their issues"
```

---

### Task 7: Registering, refreshing and removing tracker webhooks

skrum registers Jira Cloud dynamic webhooks (and Jira DC webhooks when the account administers Jira) for the projects of tracked issues, re-registers when a project appears, refreshes Cloud webhooks before their 30 days run out and deletes them when sync is turned off or the connection is removed; Jira DC admins without that right get the details to register it by hand.

**Files:**
- Create: `app/Support/Integrations/TrackerWebhooks.php`, `app/Jobs/Integrations/{RegisterTrackerWebhooks,RemoveTrackerWebhooks}.php`, `app/Http/Controllers/Integrations/TrackerWebhooksController.php`, `tests/Feature/Integrations/TrackerWebhooksTest.php`
- Modify: `app/Models/TeamIntegration.php`, `app/Support/Integrations/Jira/{JiraApi,JiraClient}.php`, `app/Support/Integrations/JiraDataCenter/JiraDataCenterClient.php`, `app/Actions/Integrations/DisconnectIntegration.php`, `app/Console/Commands/CheckIntegrationsCommand.php`, `app/Jobs/Integrations/ReadTrackedIssues.php`, `routes/web.php`, `tests/Feature/Integrations/{ConnectJiraTest,IntegrationTokensTest}.php`

**Interfaces:**
- Consumes: Tasks 4–6 (`TrackedIssues::containerKeys`, `InboundModes`, `StatusSync`, route `integrations.webhooks.tracker.store`); 14c `JiraApis::for()`, `JiraApi::apiPath()`.
- Produces: `TeamIntegration::mergeSettings(array $changes): static` (row-locked merge); `JiraApi::delete()`; `JiraClient::ReadScopes` gains `manage:jira-webhook`; `TrackerWebhooks` (`Events`, `RefreshWithinDays = 7`, `jql()`, `ids()`, `url()`, `canRegister()`, `isCurrent()`, `expiresSoon()`, `register()`, `refresh()`, `remove()`, `removeQuietly()`, `registerIfProjectsChanged()`, `manualDetails()`, `confirmManual()`); jobs `RegisterTrackerWebhooks($integrationId)`, `RemoveTrackerWebhooks($integrationId, array $webhookIds)`; routes `teams.integrations.trackerWebhook.show` (`GET …/{integration}/webhook`) and `teams.integrations.trackerWebhook.store` (`POST …/{integration}/webhook`).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/TrackerWebhooksTest.php`:

```php
<?php

use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationWebhookStatus;
use App\Jobs\Integrations\RegisterTrackerWebhooks;
use App\Jobs\Integrations\RemoveTrackerWebhooks;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\InboundModes;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use App\Support\Integrations\TrackerWebhooks;
use Carbon\CarbonImmutable;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
    config(['services.integrations.inbound_webhooks' => 'on']);
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter);
});

/**
 * A synced connection tracking PROJ-1 and ENG-3.
 *
 * @param  array<string, mixed>  $settings
 */
function webhookIntegration(IntegrationProvider $provider = IntegrationProvider::Jira, array $settings = [], array $attributes = []): TeamIntegration
{
    $factory = TeamIntegration::factory();
    $integration = ($provider === IntegrationProvider::JiraDataCenter ? $factory->jiraDataCenter() : $factory->jira())->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => true, ...$settings], ...$attributes])->save();
    $site = $provider === IntegrationProvider::JiraDataCenter ? JiraDataCenterServer::key(TeamIntegrationFactory::JiraDataCenterUrl) : 'cloud-1';

    foreach (['10001' => 'PROJ-1', '10003' => 'ENG-3'] as $id => $key) {
        ActionItemExternalLink::factory()->create([
            'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id])->id,
            'source' => $provider,
            'external_site' => $site,
            'external_id' => $id,
            'external_key' => $key,
        ]);
    }

    return $integration->fresh() ?? $integration;
}

function runWebhookRegistration(TeamIntegration $integration): void
{
    app()->call([(new RegisterTrackerWebhooks($integration->id))->withFakeQueueInteractions(), 'handle']);
}

it('registers a Jira Cloud webhook for the projects of tracked issues', function () {
    $integration = webhookIntegration();
    Http::fake([jiraApiUrl('rest/api/3/webhook') => Http::response(['webhookRegistrationResult' => [['createdWebhookId' => 7001]]])]);

    runWebhookRegistration($integration);

    $integration->refresh();
    $token = $integration->credential('webhookToken');
    expect($token)->toBeString()->toHaveLength(40)
        ->and($integration->setting('webhookIds'))->toBe(['7001'])
        ->and($integration->setting('webhookProjects'))->toBe(['ENG', 'PROJ'])
        ->and($integration->webhook_status)->toBe(IntegrationWebhookStatus::Pending)
        ->and($integration->webhook_expires_at?->toDateString())->toBe('2026-11-06')
        ->and($integration->inbound_mode)->toBe(IntegrationInboundMode::Webhook);
    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/webhook')
        && $request['url'] === route('integrations.webhooks.tracker.store', ['source' => 'jira', 'integration' => $integration->id, 'token' => $token])
        && $request['webhooks'] === [['events' => ['jira:issue_updated', 'jira:issue_deleted'], 'jqlFilter' => 'project in (ENG, PROJ)']]);
});

it('re-registers when a new project appears and deletes the old webhook', function () {
    $integration = webhookIntegration(settings: ['webhookIds' => ['7001'], 'webhookProjects' => ['PROJ']]);
    Http::fake([jiraApiUrl('rest/api/3/webhook') => fn (Request $request) => $request->method() === 'DELETE'
        ? Http::response(null, 202)
        : Http::response(['webhookRegistrationResult' => [['createdWebhookId' => 7002]]])]);

    app(TrackerWebhooks::class)->registerIfProjectsChanged($integration);
    Queue::assertPushed(RegisterTrackerWebhooks::class, fn (RegisterTrackerWebhooks $job) => $job->integrationId === $integration->id);

    runWebhookRegistration($integration);

    expect($integration->fresh()->setting('webhookIds'))->toBe(['7002']);
    Http::assertSent(fn (Request $request) => $request->method() === 'DELETE' && $request['webhookIds'] === [7001]);
});

it('refreshes Jira webhooks that expire within a week', function () {
    $integration = webhookIntegration(
        settings: ['webhookIds' => ['7001'], 'webhookProjects' => ['ENG', 'PROJ']],
        attributes: ['webhook_expires_at' => now()->addDays(5), 'webhook_status' => IntegrationWebhookStatus::Active],
    );
    Http::fake([
        'api.atlassian.com/oauth/token/accessible-resources' => Http::response([['id' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme', 'scopes' => ['read:jira-work']]]),
        jiraApiUrl('rest/api/3/webhook/refresh') => Http::response(['expirationDate' => '2026-11-06T10:30:00.000+0000']),
    ]);

    $this->artisan('skrum:check-integrations')->assertSuccessful();
    Queue::assertPushed(RegisterTrackerWebhooks::class);

    runWebhookRegistration($integration);

    expect($integration->fresh()->webhook_expires_at?->toIso8601String())->toBe('2026-11-06T10:30:00+00:00');
    Http::assertSent(fn (Request $request) => $request->method() === 'PUT' && $request['webhookIds'] === [7001]);
});

it('marks the webhook failing when its registration keeps failing', function () {
    $integration = webhookIntegration();

    (new RegisterTrackerWebhooks($integration->id))->failed(new ProviderRejected(IntegrationProvider::Jira, 'nope', 403));

    expect($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Failing);
});

it('registers Jira Data Center webhooks only for Jira administrators', function (bool $administers) {
    $integration = webhookIntegration(IntegrationProvider::JiraDataCenter);
    Http::fake([
        jiraDataCenterUrl('rest/api/2/mypermissions*') => Http::response(['permissions' => ['ADMINISTER' => ['havePermission' => $administers]]]),
        jiraDataCenterUrl('rest/webhooks/1.0/webhook') => Http::response(['self' => 'https://jira.example.com/rest/webhooks/1.0/webhook/12'], 201),
    ]);

    runWebhookRegistration($integration);

    $integration->refresh();
    expect($integration->credential('webhookSecret'))->toBeString()->toHaveLength(40)
        ->and($integration->setting('webhookIds'))->toBe($administers ? ['12'] : [])
        ->and($integration->setting('webhookManual'))->toBe(! $administers)
        ->and($integration->webhook_status)->toBe($administers ? IntegrationWebhookStatus::Pending : null)
        ->and(app(InboundModes::class)->hint($integration))->toBe($administers ? null : InboundModes::HintManual);
    $administers
        ? Http::assertSent(fn (Request $request) => $request->method() === 'POST' && $request['filters'] === ['issue-related-events-section' => 'project in (ENG, PROJ)'])
        : Http::assertNotSent(fn (Request $request) => $request->method() === 'POST');
})->with(['administrator' => [true], 'not an administrator' => [false]]);

it('shows the manual webhook details to owners and admins only', function () {
    $integration = webhookIntegration(IntegrationProvider::JiraDataCenter, ['webhookManual' => true]);
    $team = $integration->team;
    $route = route('teams.integrations.trackerWebhook.show', [$team->workspace, $team, $integration]);

    $this->actingAs(teamMember($team))->getJson($route)->assertForbidden();

    $response = $this->actingAs(integrationAdmin($team))->getJson($route)->assertOk();

    $integration->refresh();
    expect($response->json())->toBe([
        'url' => route('integrations.webhooks.tracker.store', ['source' => 'jira-dc', 'integration' => $integration->id, 'token' => $integration->credential('webhookToken')]),
        'secret' => $integration->credential('webhookSecret'),
        'events' => ['jira:issue_updated', 'jira:issue_deleted'],
        'jql' => 'project in (ENG, PROJ)',
    ])
        ->and($response->headers->get('Cache-Control'))->toContain('no-store');

    $cloud = webhookIntegration();
    $this->actingAs(integrationAdmin($cloud->team))
        ->getJson(route('teams.integrations.trackerWebhook.show', [$cloud->team->workspace, $cloud->team, $cloud]))
        ->assertNotFound();
});

it('confirms a webhook registered by hand', function () {
    $integration = webhookIntegration(IntegrationProvider::JiraDataCenter, ['webhookManual' => true]);
    $team = $integration->team;

    $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.trackerWebhook.store', [$team->workspace, $team, $integration]), ['registered' => true])
        ->assertStatus(202);

    expect($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Pending)
        ->and($integration->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Webhook);
});

it('queues a registration on request, refused while sync is off', function () {
    $integration = webhookIntegration();
    $team = $integration->team;
    $admin = integrationAdmin($team);
    $route = route('teams.integrations.trackerWebhook.store', [$team->workspace, $team, $integration]);

    $this->actingAs($admin)->postJson($route, ['registered' => true])->assertUnprocessable();
    $this->actingAs($admin)->postJson($route)->assertStatus(202);
    Queue::assertPushed(RegisterTrackerWebhooks::class, 1);

    $integration->mergeSettings(['statusSync' => false]);
    $this->actingAs($admin)->postJson($route)->assertStatus(409)->assertJsonPath('message', 'Turn on status sync for Jira first.');
    $this->actingAs(teamMember($team))->postJson($route, ['registered' => 'nonsense'])->assertForbidden();
});

it('never exposes the webhook token or secret outside the details endpoint', function () {
    $integration = webhookIntegration(IntegrationProvider::JiraDataCenter, ['webhookManual' => true]);
    $team = $integration->team;
    $admin = integrationAdmin($team);
    $this->actingAs($admin)->getJson(route('teams.integrations.trackerWebhook.show', [$team->workspace, $team, $integration]))->assertOk();
    $integration->refresh();
    $secrets = [$integration->credential('webhookToken'), $integration->credential('webhookSecret')];

    $page = $this->actingAs($admin)->get(route('teams.integrations.index', [$team->workspace, $team]))->assertOk()->getContent();
    $json = $this->actingAs($admin)->patchJson(route('teams.integrations.update', [$team->workspace, $team, $integration]), [])->assertOk()->getContent();

    foreach ($secrets as $secret) {
        expect($page)->not->toContain($secret)
            ->and($json)->not->toContain($secret)
            ->and(serialize(new RegisterTrackerWebhooks($integration->id)))->not->toContain($secret);
    }
});

it('deletes the webhooks when the connection is removed, best effort', function () {
    $integration = webhookIntegration(settings: ['webhookIds' => ['7001']]);
    $team = $integration->team;
    Http::fake([jiraApiUrl('rest/api/3/webhook') => Http::response(['errorMessages' => ['down']], 500)]);

    $this->actingAs(integrationAdmin($team))
        ->deleteJson(route('teams.integrations.destroy', [$team->workspace, $team, $integration]))
        ->assertNoContent();

    expect(TeamIntegration::query()->find($integration->id))->toBeNull();
    Http::assertSent(fn (Request $request) => $request->method() === 'DELETE' && $request['webhookIds'] === [7001]);
});

it('removes the given webhooks', function () {
    $integration = webhookIntegration(IntegrationProvider::JiraDataCenter);
    Http::fake([jiraDataCenterUrl('rest/webhooks/1.0/webhook/12') => Http::response(null, 204)]);

    app()->call([new RemoveTrackerWebhooks($integration->id, ['12', '../x']), 'handle']);

    Http::assertSentCount(1);
    Http::assertSent(fn (Request $request) => $request->method() === 'DELETE' && $request->url() === 'https://jira.example.com/rest/webhooks/1.0/webhook/12');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/TrackerWebhooksTest.php`
Expected: FAIL — class `App\Jobs\Integrations\RegisterTrackerWebhooks` not found.

- [ ] **Step 3: Settings merge, DELETE and the webhook scope**

In `app/Models/TeamIntegration.php`, add `use Illuminate\Support\Facades\DB;` and after `setting()`:

```php
    /**
     * Merges settings under a row lock, so concurrent writers (token
     * refresh, exports, sync bookkeeping) never overwrite each other.
     *
     * @param  array<string, mixed>  $changes
     */
    public function mergeSettings(array $changes): static
    {
        return DB::transaction(function () use ($changes): static {
            $locked = static::query()->whereKey($this->id)->lockForUpdate()->firstOrFail();
            $locked->forceFill(['settings' => [...$locked->settings, ...$changes]])->save();

            $this->setRawAttributes($locked->getAttributes(), true);

            return $this;
        });
    }
```

In `app/Support/Integrations/Jira/JiraApi.php`, add:

```php
    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function delete(TeamIntegration $integration, string $path, array $body = []): array;
```

In `app/Support/Integrations/Jira/JiraClient.php`, add after `put()`:

```php
    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function delete(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->request($integration, 'DELETE', $path, $body);
    }
```

and append `'manage:jira-webhook'` to `ReadScopes` (last element). In `app/Support/Integrations/JiraDataCenter/JiraDataCenterClient.php`, add after `put()`:

```php
    public function delete(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->request($integration, 'DELETE', $path, $body);
    }
```

Update the requested scope strings: in `tests/Feature/Integrations/ConnectJiraTest.php` (the `read`/`write` dataset of the authorization URL) and `tests/Feature/Integrations/IntegrationTokensTest.php` ("builds authorization URLs…"), insert ` manage:jira-webhook` right after `read:sprint:jira-software` in every expected scope string (read: `…read:sprint:jira-software manage:jira-webhook`; write: `…read:sprint:jira-software manage:jira-webhook write:jira-work read:jira-user`). The fake token responses that echo granted scopes stay as they are.

- [ ] **Step 4: The webhook service and jobs**

Create `app/Support/Integrations/TrackerWebhooks.php`:

```php
<?php

namespace App\Support\Integrations;

use App\Actions\Integrations\TrackedIssues;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationWebhookStatus;
use App\Jobs\Integrations\RegisterTrackerWebhooks;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Jira\JiraApis;
use App\Support\Integrations\Trackers\IssueStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Spec 8 §4.1, §5.3: Jira Cloud dynamic webhooks (30-day expiry, refreshed
 * within 7 days) and Jira Data Center webhooks (registered by skrum when
 * the account administers Jira, else by hand), filtered to the projects of
 * tracked issues. The URL token and the Data Center secret are generated
 * here and only ever leave through `manualDetails()`.
 */
class TrackerWebhooks
{
    public const Events = ['jira:issue_updated', 'jira:issue_deleted'];

    public const RefreshWithinDays = 7;

    private const LifetimeDays = 30;

    private const SecretLength = 40;

    private const WebhookIdPattern = '/^\d{1,20}\z/';

    public function __construct(
        private JiraApis $jiraApis,
        private TrackedIssues $trackedIssues,
        private InboundModes $inboundModes,
    ) {}

    /**
     * @param  array<int, string>  $projectKeys  validated project keys
     */
    public static function jql(array $projectKeys): string
    {
        return 'project in ('.implode(', ', $projectKeys).')';
    }

    /**
     * @return array<int, string>
     */
    public static function ids(TeamIntegration $integration): array
    {
        $ids = [];

        foreach ((array) $integration->setting('webhookIds', []) as $id) {
            if ((is_string($id) || is_int($id)) && preg_match(self::WebhookIdPattern, (string) $id) === 1) {
                $ids[] = (string) $id;
            }
        }

        return $ids;
    }

    public function url(TeamIntegration $integration): string
    {
        return route('integrations.webhooks.tracker.store', [
            'source' => $integration->provider === IntegrationProvider::JiraDataCenter ? 'jira-dc' : 'jira',
            'integration' => $integration->id,
            'token' => (string) $integration->credential('webhookToken'),
        ]);
    }

    /**
     * Whether skrum registers this connection's webhooks itself right now.
     */
    public function canRegister(TeamIntegration $integration): bool
    {
        if (! in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true)) {
            return false;
        }

        if (! StatusSync::isOn($integration) || ! $integration->isActive() || ! $this->inboundModes->acceptsWebhooks($integration->provider)) {
            return false;
        }

        return $integration->provider !== IntegrationProvider::Jira || $integration->hasScope(InboundModes::JiraWebhookScope);
    }

    public function isCurrent(TeamIntegration $integration): bool
    {
        return self::ids($integration) !== []
            && (array) $integration->setting('webhookProjects', []) === $this->trackedIssues->containerKeys($integration);
    }

    public function expiresSoon(TeamIntegration $integration): bool
    {
        return $integration->provider === IntegrationProvider::Jira
            && $integration->webhook_expires_at !== null
            && $integration->webhook_expires_at->lte(now()->addDays(self::RefreshWithinDays));
    }

    public function register(TeamIntegration $integration): void
    {
        $integration = $this->ensureSecrets($integration);
        $projects = $this->trackedIssues->containerKeys($integration);

        $this->removeQuietly($integration, self::ids($integration));

        if ($projects === []) {
            $this->saveRegistration($integration, [], []);

            return;
        }

        $ids = $integration->provider === IntegrationProvider::Jira
            ? $this->registerCloud($integration, $projects)
            : $this->registerDataCenter($integration, $projects);

        if ($ids === null) {
            $integration->mergeSettings(['webhookManual' => true, 'webhookIds' => [], 'webhookProjects' => []]);
            $this->inboundModes->refresh($integration);

            return;
        }

        $this->saveRegistration($integration, $ids, $projects);
    }

    public function refresh(TeamIntegration $integration): void
    {
        $ids = self::ids($integration);

        if ($ids === []) {
            return;
        }

        $api = $this->jiraApis->for($integration);
        $response = $api->put($integration, $api->apiPath('webhook/refresh'), ['webhookIds' => array_map('intval', $ids)]);

        $integration->forceFill([
            'webhook_expires_at' => IssueStatus::time($response['expirationDate'] ?? null) ?? now()->addDays(self::LifetimeDays),
        ])->save();
    }

    /**
     * @param  array<int, string>  $ids
     */
    public function remove(TeamIntegration $integration, array $ids): void
    {
        $ids = array_values(array_filter($ids, fn (string $id): bool => preg_match(self::WebhookIdPattern, $id) === 1));

        if ($ids === []) {
            return;
        }

        $api = $this->jiraApis->for($integration);

        if ($integration->provider === IntegrationProvider::Jira) {
            $api->delete($integration, $api->apiPath('webhook'), ['webhookIds' => array_map('intval', $ids)]);

            return;
        }

        foreach ($ids as $id) {
            $api->delete($integration, "rest/webhooks/1.0/webhook/{$id}");
        }
    }

    /**
     * @param  array<int, string>  $ids
     */
    public function removeQuietly(TeamIntegration $integration, array $ids): void
    {
        try {
            $this->remove($integration, $ids);
        } catch (IntegrationException) {
            // Best effort: a leftover webhook only delivers events skrum ignores.
        }
    }

    public function registerIfProjectsChanged(TeamIntegration $integration): void
    {
        if (! $this->canRegister($integration) || $integration->setting('webhookManual') === true) {
            return;
        }

        if ((array) $integration->setting('webhookProjects', []) === $this->trackedIssues->containerKeys($integration)) {
            return;
        }

        RegisterTrackerWebhooks::dispatch($integration->id);
    }

    /**
     * @return array{url: string, secret: string, events: array<int, string>, jql: ?string}
     */
    public function manualDetails(TeamIntegration $integration): array
    {
        $integration = $this->ensureSecrets($integration);
        $projects = $this->trackedIssues->containerKeys($integration);

        return [
            'url' => $this->url($integration),
            'secret' => (string) $integration->credential('webhookSecret'),
            'events' => self::Events,
            'jql' => $projects === [] ? null : self::jql($projects),
        ];
    }

    public function confirmManual(TeamIntegration $integration): TeamIntegration
    {
        $integration = $this->ensureSecrets($integration);
        $integration->mergeSettings(['webhookManual' => true, 'webhookRegisteredAt' => now()->toIso8601String()]);
        $integration->forceFill([
            'webhook_status' => $integration->webhook_status === IntegrationWebhookStatus::Active
                ? IntegrationWebhookStatus::Active
                : IntegrationWebhookStatus::Pending,
        ])->save();

        return $this->inboundModes->refresh($integration);
    }

    /**
     * @param  array<int, string>  $projects
     * @return array<int, string>
     */
    private function registerCloud(TeamIntegration $integration, array $projects): array
    {
        $api = $this->jiraApis->for($integration);
        $response = $api->post($integration, $api->apiPath('webhook'), [
            'url' => $this->url($integration),
            'webhooks' => [['events' => self::Events, 'jqlFilter' => self::jql($projects)]],
        ]);
        $ids = [];

        foreach ((array) ($response['webhookRegistrationResult'] ?? []) as $result) {
            $id = data_get($result, 'createdWebhookId');

            if (is_int($id) || (is_string($id) && ctype_digit($id))) {
                $ids[] = (string) $id;
            }
        }

        if ($ids === []) {
            $error = data_get($response, 'webhookRegistrationResult.0.errors.0');

            throw new ProviderRejected(IntegrationProvider::Jira, is_string($error) ? $error : 'webhook_not_registered');
        }

        return $ids;
    }

    /**
     * @param  array<int, string>  $projects
     * @return array<int, string>|null null when the account does not administer Jira
     */
    private function registerDataCenter(TeamIntegration $integration, array $projects): ?array
    {
        $api = $this->jiraApis->for($integration);
        $permissions = $api->get($integration, $api->apiPath('mypermissions'), ['permissions' => 'ADMINISTER']);

        if (data_get($permissions, 'permissions.ADMINISTER.havePermission') !== true) {
            return null;
        }

        $response = $api->post($integration, 'rest/webhooks/1.0/webhook', [
            'name' => Str::limit("skrum · {$integration->team->name}", 100, ''),
            'url' => $this->url($integration),
            'events' => self::Events,
            'filters' => ['issue-related-events-section' => self::jql($projects)],
            'excludeBody' => false,
        ]);
        $self = $response['self'] ?? null;
        $id = is_string($self) ? basename($self) : '';

        if (preg_match(self::WebhookIdPattern, $id) !== 1) {
            throw new ProviderRejected(IntegrationProvider::JiraDataCenter, 'webhook_not_registered');
        }

        return [$id];
    }

    /**
     * @param  array<int, string>  $ids
     * @param  array<int, string>  $projects
     */
    private function saveRegistration(TeamIntegration $integration, array $ids, array $projects): void
    {
        $registered = $ids !== [];

        $integration->mergeSettings([
            'webhookIds' => $ids,
            'webhookProjects' => $projects,
            'webhookManual' => false,
            'webhookRegisteredAt' => $registered ? now()->toIso8601String() : $integration->setting('webhookRegisteredAt'),
        ]);

        $integration->forceFill([
            'webhook_status' => match (true) {
                ! $registered => $integration->webhook_status,
                $integration->webhook_status === IntegrationWebhookStatus::Active => IntegrationWebhookStatus::Active,
                default => IntegrationWebhookStatus::Pending,
            },
            'webhook_expires_at' => $registered && $integration->provider === IntegrationProvider::Jira ? now()->addDays(self::LifetimeDays) : null,
        ])->save();

        $this->inboundModes->refresh($integration);
    }

    /**
     * The URL token (and the Data Center signing secret) exist before any
     * registration; generated once, kept across re-registrations. Written
     * under the row lock so a concurrent token refresh is never lost.
     */
    private function ensureSecrets(TeamIntegration $integration): TeamIntegration
    {
        if ($integration->readableCredentials() === null) {
            throw new ReconnectRequired($integration->provider, $integration->last_error);
        }

        $keys = $integration->provider === IntegrationProvider::JiraDataCenter ? ['webhookToken', 'webhookSecret'] : ['webhookToken'];

        return DB::transaction(function () use ($integration, $keys): TeamIntegration {
            $locked = TeamIntegration::query()->whereKey($integration->id)->lockForUpdate()->firstOrFail();
            $credentials = (array) $locked->readableCredentials();
            $changed = false;

            foreach ($keys as $key) {
                if (! is_string($credentials[$key] ?? null) || $credentials[$key] === '') {
                    $credentials[$key] = Str::random(self::SecretLength);
                    $changed = true;
                }
            }

            if ($changed) {
                $locked->forceFill(['credentials' => $credentials])->save();
            }

            $integration->setRawAttributes($locked->getAttributes(), true);

            return $integration;
        });
    }
}
```

Create `app/Jobs/Integrations/RegisterTrackerWebhooks.php`:

```php
<?php

namespace App\Jobs\Integrations;

use App\Enums\IntegrationWebhookStatus;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\StatusSync;
use App\Support\Integrations\TrackerWebhooks;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Throwable;

/**
 * Registers the connection's webhooks when its projects changed (or none
 * exist yet) and refreshes Jira Cloud ones close to expiry (spec 8 §5.3).
 */
class RegisterTrackerWebhooks implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $uniqueFor = 300;

    /** @var array<int, int> */
    public array $backoff = [30, 120];

    public function __construct(public string $integrationId) {}

    public function uniqueId(): string
    {
        return $this->integrationId;
    }

    /** @return array<int, object> */
    public function middleware(): array
    {
        return [(new WithoutOverlapping("tracker-webhooks:{$this->integrationId}"))->dontRelease()->expireAfter(120)];
    }

    public function handle(TrackerWebhooks $webhooks): void
    {
        $integration = TeamIntegration::query()->find($this->integrationId);

        if ($integration === null || ! $webhooks->canRegister($integration)) {
            return;
        }

        try {
            if (! $webhooks->isCurrent($integration)) {
                $webhooks->register($integration);

                return;
            }

            if ($webhooks->expiresSoon($integration)) {
                $webhooks->refresh($integration);
            }
        } catch (RateLimited $exception) {
            $this->release($exception->retryAfter);
        }
    }

    public function failed(?Throwable $exception): void
    {
        $integration = TeamIntegration::query()->find($this->integrationId);

        if ($integration === null || ! StatusSync::isOn($integration)) {
            return;
        }

        $integration->forceFill(['webhook_status' => IntegrationWebhookStatus::Failing])->save();
    }
}
```

Create `app/Jobs/Integrations/RemoveTrackerWebhooks.php`:

```php
<?php

namespace App\Jobs\Integrations;

use App\Models\TeamIntegration;
use App\Support\Integrations\TrackerWebhooks;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Deletes webhooks after sync was turned off (spec 8 §5.3), best effort:
 * a leftover webhook only delivers events skrum ignores.
 */
class RemoveTrackerWebhooks implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [30, 120];

    /**
     * @param  array<int, string>  $webhookIds
     */
    public function __construct(public string $integrationId, public array $webhookIds) {}

    public function handle(TrackerWebhooks $webhooks): void
    {
        $integration = TeamIntegration::query()->find($this->integrationId);

        if ($integration === null || ! $integration->provider->isEnabled() || ! $integration->isActive()) {
            return;
        }

        $webhooks->remove($integration, $this->webhookIds);
    }
}
```

- [ ] **Step 5: Endpoints, disconnect, daily refresh and new projects**

Create `app/Http/Controllers/Integrations/TrackerWebhooksController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\PresentTeamIntegration;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Jobs\Integrations\RegisterTrackerWebhooks;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use App\Support\Integrations\InboundModes;
use App\Support\Integrations\StatusSync;
use App\Support\Integrations\TrackerWebhooks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Spec 8 §4.1, §7: the Jira Data Center manual registration details (the
 * only response carrying the URL token and secret, never cached), the
 * "I've registered it" confirmation and on-demand (re)registration.
 */
class TrackerWebhooksController extends Controller
{
    public function __construct(
        private TrackerWebhooks $webhooks,
        private InboundModes $inboundModes,
        private PresentTeamIntegration $presentTeamIntegration,
    ) {}

    public function show(Workspace $workspace, Team $team, TeamIntegration $integration): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        abort_unless($integration->provider === IntegrationProvider::JiraDataCenter, 404);

        $integration->ensureActive();

        return response()->json($this->webhooks->manualDetails($integration))->header('Cache-Control', 'no-store, private');
    }

    public function store(Request $request, Workspace $workspace, Team $team, TeamIntegration $integration): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        abort_unless(in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true), 404);

        $request->validate([
            'registered' => [$integration->provider === IntegrationProvider::JiraDataCenter ? 'sometimes' : 'prohibited', 'accepted'],
        ]);

        $integration->ensureActive();

        $label = ['provider' => $integration->provider->label()];

        if (! StatusSync::isOn($integration)) {
            abort(409, __('Turn on status sync for :provider first.', $label));
        }

        if (! $this->inboundModes->acceptsWebhooks($integration->provider)) {
            abort(409, __("This skrum instance can't receive webhooks; it checks :provider regularly instead.", $label));
        }

        if ($request->boolean('registered')) {
            $integration = $this->webhooks->confirmManual($integration);
        } else {
            RegisterTrackerWebhooks::dispatch($integration->id);
        }

        return response()->json($this->presentTeamIntegration->handle($integration->load('connectedBy')), 202);
    }
}
```

In `routes/web.php`, import the controller and add inside the integrations group, after the `teams.integrations.test.store` route:

```php
                Route::get('teams/{team}/integrations/{integration}/webhook', [TrackerWebhooksController::class, 'show'])
                    ->whereUuid('integration')
                    ->middleware('throttle:10,1,trackerWebhookDetails')
                    ->name('teams.integrations.trackerWebhook.show');
                Route::post('teams/{team}/integrations/{integration}/webhook', [TrackerWebhooksController::class, 'store'])
                    ->whereUuid('integration')
                    ->middleware('throttle:10,1,trackerWebhooks')
                    ->name('teams.integrations.trackerWebhook.store');
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

In `app/Actions/Integrations/DisconnectIntegration.php`, inject `private TrackerWebhooks $trackerWebhooks` and make the `Jira` arm — and the `JiraDataCenter` arm Plan 14c left — remove the webhooks first:

```php
            IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter => fn () => $this->trackerWebhooks->removeQuietly($integration, TrackerWebhooks::ids($integration)),
```

(Keep every other arm as Plans 14a–14c left them; if the `JiraDataCenter` arm was grouped with other providers, split it out.)

In `app/Console/Commands/CheckIntegrationsCommand.php`, inject `TrackerWebhooks $trackerWebhooks` into `handle()`, pass it into the `each` closure, and extend Task 5's block:

```php
                    if (StatusSync::isOn($integration)) {
                        ReadTrackedIssues::dispatch($integration->id, true);
                    }

                    if (StatusSync::isOn($integration) && $trackerWebhooks->expiresSoon($integration)) {
                        RegisterTrackerWebhooks::dispatch($integration->id);
                    }
```

In `app/Jobs/Integrations/ReadTrackedIssues.php`, add `TrackerWebhooks $trackerWebhooks` as last parameter of `handle()` and, after the final `forceFill([...])->save();`:

```php
        $trackerWebhooks->registerIfProjectsChanged($integration);
```

- [ ] **Step 6: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `This skrum instance can't receive webhooks; it checks :provider regularly instead.` | `Cette instance de skrum ne peut pas recevoir de webhooks ; elle interroge :provider régulièrement à la place.` | `Esta instancia de skrum no puede recibir webhooks; en su lugar consulta :provider con regularidad.` | `Diese skrum-Instanz kann keine Webhooks empfangen; sie fragt :provider stattdessen regelmäßig ab.` |

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/TrackerWebhooksTest.php tests/Feature/Integrations/PollIntegrationsTest.php tests/Feature/Integrations/ConnectJiraTest.php tests/Feature/Integrations/IntegrationTokensTest.php tests/Feature/Integrations/ConnectJiraDataCenterTest.php tests/Feature/Integrations/IntegrationMaintenanceTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 8: Commit**

```bash
git add app/Models/TeamIntegration.php app/Support/Integrations/Jira/JiraApi.php app/Support/Integrations/Jira/JiraClient.php app/Support/Integrations/JiraDataCenter/JiraDataCenterClient.php app/Support/Integrations/TrackerWebhooks.php app/Jobs/Integrations/RegisterTrackerWebhooks.php app/Jobs/Integrations/RemoveTrackerWebhooks.php app/Jobs/Integrations/ReadTrackedIssues.php app/Http/Controllers/Integrations/TrackerWebhooksController.php app/Actions/Integrations/DisconnectIntegration.php app/Console/Commands/CheckIntegrationsCommand.php routes/web.php tests/Feature/Integrations/TrackerWebhooksTest.php tests/Feature/Integrations/ConnectJiraTest.php tests/Feature/Integrations/IntegrationTokensTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): register, refresh and remove Jira webhooks for status sync"
```

---

### Task 8: Turning sync on and off, mappings, statuses and the presented state

Owners/Admins switch "Sync status" on (full read where the source wins, webhooks registered where possible) or off (webhooks removed), set "Treat canceled as done" and per-project/team mappings, list statuses to map, and see the sync state on the integrations page.

**Files:**
- Create: `app/Actions/Integrations/{ToggleStatusSync,UpdateStatusSyncSettings}.php`, `app/Http/Controllers/Integrations/IntegrationStatusesController.php`, `tests/Feature/Integrations/StatusSyncSettingsTest.php`
- Modify: `app/Actions/Integrations/{UpdateTeamIntegration,PresentTeamIntegration}.php`, `app/Http/Controllers/Integrations/TeamIntegrationsController.php`, `routes/web.php`

**Interfaces:**
- Consumes: Tasks 4–7 (`TrackedIssues`, `InboundModes`, `ReadTrackedIssues`, `TrackerWebhooks`, `RegisterTrackerWebhooks`, `RemoveTrackerWebhooks`, `TeamIntegration::mergeSettings()`), Task 1 (`Trackers::syncing()->statuses()`); 14c `UpdateTeamIntegration` provider arms and `PresentTeamIntegration::SettingKeys`; 14b's top-level `webhook` presenter key; `InboundReachability::pollIntervalMinutes()`.
- Produces: `PATCH …/integrations/{integration}` fields `status_sync`, `treat_canceled_as_done` (Linear, GitHub), `status_mapping` (Jira, Jira DC, Linear); `ToggleStatusSync::handle(TeamIntegration, bool): TeamIntegration`; route `teams.integrations.statuses.index` (`GET …/{integration}/statuses[?container=]`); presenter keys `statusSync`, `inboundMode`, `webhookStatus`, `lastInboundAt`, `lastPolledAt`, `inboundHint`; settings keys `treatCanceledAsDone`, `statusMapping` presented; page prop `pollMinutes`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/StatusSyncSettingsTest.php`:

```php
<?php

use App\Actions\Integrations\ListPokerSources;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\IntegrationWebhookStatus;
use App\Jobs\Integrations\PushActionItemState;
use App\Jobs\Integrations\ReadTrackedIssues;
use App\Jobs\Integrations\RegisterTrackerWebhooks;
use App\Jobs\Integrations\RemoveTrackerWebhooks;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\TeamIntegration;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
    config(['services.integrations.inbound_webhooks' => 'off', 'services.integrations.poll_minutes' => 5]);
});

function syncSettingsIntegration(IntegrationProvider $provider = IntegrationProvider::Jira, array $settings = [], array $attributes = []): TeamIntegration
{
    enableIntegrations($provider);
    $factory = TeamIntegration::factory();
    $integration = match ($provider) {
        IntegrationProvider::Linear => $factory->linear(),
        IntegrationProvider::GitHub => $factory->gitHub(),
        IntegrationProvider::JiraDataCenter => $factory->jiraDataCenter(),
        default => $factory->jira(),
    }->create();
    $integration->forceFill(['settings' => [...$integration->settings, ...$settings], ...$attributes])->save();

    return $integration->fresh() ?? $integration;
}

function syncSettingsRoute(TeamIntegration $integration): string
{
    return route('teams.integrations.update', [$integration->team->workspace, $integration->team, $integration]);
}

it('reserves status sync to owners and admins, before validation', function () {
    $integration = syncSettingsIntegration();

    $this->actingAs(teamMember($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_sync' => 'nonsense'])
        ->assertForbidden();

    expect($integration->fresh()->setting('statusSync'))->toBeNull();
});

it('turns sync on with a first full read and no push', function () {
    $integration = syncSettingsIntegration();

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_sync' => true])
        ->assertOk()
        ->assertJsonPath('statusSync', true)
        ->assertJsonPath('inboundMode', 'polling')
        ->assertJsonPath('webhookStatus', null);

    expect($integration->fresh()->setting('statusSyncSince'))->toBe('2026-10-07T10:30:00+00:00');
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->integrationId === $integration->id && $job->full && $job->initial);
    Queue::assertNotPushed(PushActionItemState::class);
    Queue::assertNotPushed(RegisterTrackerWebhooks::class);
});

it('registers Jira webhooks when the instance can receive them', function () {
    config(['services.integrations.inbound_webhooks' => 'on']);
    $integration = syncSettingsIntegration();

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_sync' => true])
        ->assertOk()
        ->assertJsonPath('inboundMode', 'webhook');

    Queue::assertPushed(RegisterTrackerWebhooks::class);
});

it('starts Linear and GitHub webhooks as pending', function (IntegrationProvider $provider) {
    config([
        'services.integrations.inbound_webhooks' => 'on',
        'services.linear.webhook_secret' => 'linear-webhook-secret',
        'services.github_app.webhook_secret' => 'github-webhook-secret',
    ]);
    $integration = syncSettingsIntegration($provider);

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_sync' => true])
        ->assertOk()
        ->assertJsonPath('inboundMode', 'webhook')
        ->assertJsonPath('webhookStatus', 'pending');
})->with([IntegrationProvider::Linear, IntegrationProvider::GitHub]);

it('refuses to turn sync on for a connection that needs a reconnect', function () {
    $integration = syncSettingsIntegration(attributes: ['status' => IntegrationStatus::ReconnectRequired]);

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_sync' => true])
        ->assertStatus(409);

    Queue::assertNothingPushed();
});

it('turns sync off and removes the registered webhooks', function () {
    $integration = syncSettingsIntegration(
        settings: ['statusSync' => true, 'webhookIds' => ['7001'], 'webhookProjects' => ['PROJ']],
        attributes: ['inbound_mode' => IntegrationInboundMode::Webhook, 'webhook_status' => IntegrationWebhookStatus::Active],
    );

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_sync' => false])
        ->assertOk()
        ->assertJsonPath('statusSync', false)
        ->assertJsonPath('inboundMode', 'off');

    expect($integration->fresh()->webhook_status)->toBeNull()
        ->and($integration->fresh()->setting('webhookIds'))->toBe([]);
    Queue::assertPushed(RemoveTrackerWebhooks::class, fn (RemoveTrackerWebhooks $job) => $job->webhookIds === ['7001']);
});

it('saves "Treat canceled as done" for Linear and GitHub only, and re-reads', function () {
    $linear = syncSettingsIntegration(IntegrationProvider::Linear, ['statusSync' => true]);
    $jira = syncSettingsIntegration(IntegrationProvider::Jira, ['statusSync' => true]);

    $this->actingAs(integrationAdmin($linear->team))
        ->patchJson(syncSettingsRoute($linear), ['treat_canceled_as_done' => false])
        ->assertOk()
        ->assertJsonPath('settings.treatCanceledAsDone', false);

    $this->actingAs(integrationAdmin($jira->team))
        ->patchJson(syncSettingsRoute($jira), ['treat_canceled_as_done' => false])
        ->assertOk();

    expect($jira->fresh()->setting('treatCanceledAsDone'))->toBeNull();
    Queue::assertPushed(ReadTrackedIssues::class, fn (ReadTrackedIssues $job) => $job->integrationId === $linear->id && $job->full && ! $job->initial);
});

it('saves and resets a status mapping per project', function () {
    $integration = syncSettingsIntegration();
    $admin = integrationAdmin($integration->team);

    $this->actingAs($admin)->patchJson(syncSettingsRoute($integration), ['status_mapping' => [
        'container' => 'PROJ',
        'done_status_ids' => ['10002', '10005'],
        'complete_status_id' => '10002',
    ]])->assertOk();

    expect($integration->fresh()->setting('statusMapping'))->toBe(['projects' => ['PROJ' => [
        'doneStatusIds' => ['10002', '10005'],
        'completeStatusId' => '10002',
        'reopenStatusId' => null,
    ]]]);

    $this->actingAs($admin)->patchJson(syncSettingsRoute($integration), ['status_mapping' => ['container' => 'PROJ']])->assertOk();

    expect($integration->fresh()->setting('statusMapping'))->toBe(['projects' => []]);
});

it('validates status mappings', function (IntegrationProvider $provider, array $mapping) {
    $integration = syncSettingsIntegration($provider);

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_mapping' => $mapping])
        ->assertUnprocessable();
})->with([
    'unsafe container' => [IntegrationProvider::Jira, ['container' => '../PROJ']],
    'jira status id' => [IntegrationProvider::Jira, ['container' => 'PROJ', 'complete_status_id' => 'abc']],
    'unknown key' => [IntegrationProvider::Jira, ['container' => 'PROJ', 'complete_state_id' => 'x']],
    'linear state id' => [IntegrationProvider::Linear, ['container' => 'ENG', 'complete_state_id' => 'has spaces']],
]);

it('lists the projects of tracked issues and their statuses', function () {
    $integration = syncSettingsIntegration(settings: ['statusSync' => true]);
    ActionItemExternalLink::factory()->create([
        'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id])->id,
        'external_key' => 'PROJ-4',
    ]);
    Http::fake([jiraApiUrl('rest/api/3/project/PROJ/statuses') => Http::response([
        ['id' => '1', 'name' => 'Story', 'statuses' => [['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']]]],
    ])]);
    $team = $integration->team;
    $admin = integrationAdmin($team);
    $route = route('teams.integrations.statuses.index', [$team->workspace, $team, $integration]);

    $this->actingAs(teamMember($team))->getJson($route)->assertForbidden();
    $this->actingAs($admin)->getJson($route)->assertOk()->assertExactJson(['containers' => ['PROJ']]);
    $this->actingAs($admin)->getJson($route.'?container=PROJ')->assertOk()->assertExactJson([
        'statuses' => [['id' => '10002', 'name' => 'Done', 'category' => 'done']],
    ]);
    $this->actingAs($admin)->getJson($route.'?container=..%2Fx')->assertUnprocessable();

    $gitHub = syncSettingsIntegration(IntegrationProvider::GitHub);
    $this->actingAs(integrationAdmin($gitHub->team))
        ->getJson(route('teams.integrations.statuses.index', [$gitHub->team->workspace, $gitHub->team, $gitHub]))
        ->assertNotFound();
});

it('presents the sync state without secrets', function () {
    $integration = syncSettingsIntegration(
        settings: ['statusSync' => true],
        attributes: ['inbound_mode' => IntegrationInboundMode::Polling, 'last_polled_at' => '2026-10-07 10:25:00'],
    );
    $integration->forceFill(['credentials' => [...(array) $integration->readableCredentials(), 'webhookToken' => 'TopSecretWebhookToken0123456789abcdefgh']])->save();
    $team = $integration->team;

    $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.index', [$team->workspace, $team]))
        ->assertOk()
        ->assertDontSee('TopSecretWebhookToken0123456789abcdefgh')
        ->assertInertia(fn (Assert $page) => $page
            ->where('pollMinutes', 5)
            ->where('providers.0.connection.statusSync', true)
            ->where('providers.0.connection.inboundMode', 'polling')
            ->where('providers.0.connection.webhookStatus', null)
            ->where('providers.0.connection.lastPolledAt', '2026-10-07T10:25:00+00:00')
            ->where('providers.0.connection.lastInboundAt', null)
            ->where('providers.0.connection.inboundHint', null));
});

it('tells MCP clients which trackers sync and how', function () {
    $integration = syncSettingsIntegration();

    $this->actingAs(integrationAdmin($integration->team))
        ->patchJson(syncSettingsRoute($integration), ['status_sync' => true])
        ->assertOk();

    expect(app(ListPokerSources::class)->handle($integration->team->fresh())[0])
        ->toMatchArray(['source' => 'jira', 'canSyncStatus' => true, 'syncMode' => 'polling']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/StatusSyncSettingsTest.php`
Expected: FAIL — `status_sync` is ignored (`statusSync` missing from the JSON) and the route `teams.integrations.statuses.index` is not defined.

- [ ] **Step 3: The switch**

Create `app/Actions/Integrations/ToggleStatusSync.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationWebhookStatus;
use App\Jobs\Integrations\ReadTrackedIssues;
use App\Jobs\Integrations\RegisterTrackerWebhooks;
use App\Jobs\Integrations\RemoveTrackerWebhooks;
use App\Models\TeamIntegration;
use App\Support\Integrations\InboundModes;
use App\Support\Integrations\StatusSync;
use App\Support\Integrations\TrackerWebhooks;

/**
 * Spec 8 §5.1: turning sync on reads every tracked issue (the source wins
 * that first read; nothing is pushed) and sets up webhooks where possible;
 * turning it off stops everything and removes the webhooks skrum made.
 */
class ToggleStatusSync
{
    public function __construct(
        private InboundModes $inboundModes,
        private TrackerWebhooks $trackerWebhooks,
    ) {}

    public function handle(TeamIntegration $integration, bool $on): TeamIntegration
    {
        if ($on === StatusSync::isOn($integration)) {
            return $integration;
        }

        return $on ? $this->turnOn($integration) : $this->turnOff($integration);
    }

    private function turnOn(TeamIntegration $integration): TeamIntegration
    {
        $integration->ensureActive();

        $integration->mergeSettings(['statusSync' => true, 'statusSyncSince' => now()->toIso8601String()]);

        $mode = $this->inboundModes->for($integration);
        $pendingWithoutRegistration = $mode === IntegrationInboundMode::Webhook
            && in_array($integration->provider, [IntegrationProvider::Linear, IntegrationProvider::GitHub], true);

        $integration->forceFill([
            'inbound_mode' => $mode,
            'webhook_status' => $pendingWithoutRegistration ? IntegrationWebhookStatus::Pending : null,
            'last_polled_at' => now(),
            'poll_cursor' => now(),
        ])->save();

        if ($this->trackerWebhooks->canRegister($integration)) {
            RegisterTrackerWebhooks::dispatch($integration->id);
        }

        ReadTrackedIssues::dispatch($integration->id, true, true);

        return $integration;
    }

    private function turnOff(TeamIntegration $integration): TeamIntegration
    {
        $webhookIds = TrackerWebhooks::ids($integration);

        $integration->mergeSettings(['statusSync' => false, 'webhookIds' => [], 'webhookProjects' => []]);
        $integration->forceFill([
            'inbound_mode' => IntegrationInboundMode::Off,
            'webhook_status' => null,
            'webhook_expires_at' => null,
        ])->save();

        if ($webhookIds !== []) {
            RemoveTrackerWebhooks::dispatch($integration->id, $webhookIds);
        }

        return $integration;
    }
}
```

- [ ] **Step 4: Settings rules and handling**

Create `app/Actions/Integrations/UpdateStatusSyncSettings.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationCapability;
use App\Enums\IntegrationProvider;
use App\Jobs\Integrations\ReadTrackedIssues;
use App\Models\TeamIntegration;
use App\Support\Integrations\StatusSync;
use Illuminate\Support\Facades\DB;

/**
 * Spec 8 §5.1, §5.2: the sync switch, "Treat canceled as done" (Linear,
 * GitHub) and one project's or team's mapping per request. Changing how
 * states map re-reads every tracked issue.
 */
class UpdateStatusSyncSettings
{
    private const JiraStatusIdRule = 'regex:/^\d{1,20}\z/';

    private const LinearStateIdRule = 'regex:/^[A-Za-z0-9-]{1,64}\z/';

    public function __construct(private ToggleStatusSync $toggleStatusSync) {}

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(TeamIntegration $integration): array
    {
        $provider = $integration->provider;

        if (! $provider->can(IntegrationCapability::StatusSync)) {
            return [];
        }

        $rules = ['status_sync' => ['sometimes', 'boolean']];
        $container = ['required_with:status_mapping', 'string', 'regex:'.TrackedIssues::ContainerKeyPattern];

        if (in_array($provider, [IntegrationProvider::Linear, IntegrationProvider::GitHub], true)) {
            $rules['treat_canceled_as_done'] = ['sometimes', 'boolean'];
        }

        if (in_array($provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true)) {
            return [
                ...$rules,
                'status_mapping' => ['sometimes', 'array:container,done_status_ids,complete_status_id,reopen_status_id'],
                'status_mapping.container' => $container,
                'status_mapping.done_status_ids' => ['nullable', 'array', 'max:50'],
                'status_mapping.done_status_ids.*' => ['string', self::JiraStatusIdRule],
                'status_mapping.complete_status_id' => ['nullable', 'string', self::JiraStatusIdRule],
                'status_mapping.reopen_status_id' => ['nullable', 'string', self::JiraStatusIdRule],
            ];
        }

        if ($provider === IntegrationProvider::Linear) {
            return [
                ...$rules,
                'status_mapping' => ['sometimes', 'array:container,complete_state_id,reopen_state_id'],
                'status_mapping.container' => $container,
                'status_mapping.complete_state_id' => ['nullable', 'string', self::LinearStateIdRule],
                'status_mapping.reopen_state_id' => ['nullable', 'string', self::LinearStateIdRule],
            ];
        }

        return $rules;
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function handle(TeamIntegration $integration, array $validated): TeamIntegration
    {
        $remapped = false;

        if (array_key_exists('treat_canceled_as_done', $validated)) {
            $integration->mergeSettings(['treatCanceledAsDone' => (bool) $validated['treat_canceled_as_done']]);
            $remapped = true;
        }

        if (is_array($validated['status_mapping'] ?? null)) {
            $this->saveMapping($integration, $validated['status_mapping']);
            $remapped = true;
        }

        if (array_key_exists('status_sync', $validated)) {
            return $this->toggleStatusSync->handle($integration, (bool) $validated['status_sync']);
        }

        if ($remapped && StatusSync::isOn($integration)) {
            ReadTrackedIssues::dispatch($integration->id, true);
        }

        return $integration;
    }

    /**
     * An omitted value is the default rule; a container without any value
     * is removed.
     *
     * @param  array<array-key, mixed>  $mapping
     */
    private function saveMapping(TeamIntegration $integration, array $mapping): void
    {
        $isJira = in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true);
        $group = $isJira ? 'projects' : 'teams';
        $container = (string) $mapping['container'];
        $doneIds = is_array($mapping['done_status_ids'] ?? null) ? array_values(array_unique(array_map('strval', $mapping['done_status_ids']))) : [];

        $entry = $isJira ? [
            'doneStatusIds' => $doneIds === [] ? null : $doneIds,
            'completeStatusId' => $mapping['complete_status_id'] ?? null,
            'reopenStatusId' => $mapping['reopen_status_id'] ?? null,
        ] : [
            'completeStateId' => $mapping['complete_state_id'] ?? null,
            'reopenStateId' => $mapping['reopen_state_id'] ?? null,
        ];

        DB::transaction(function () use ($integration, $group, $container, $entry): void {
            $locked = TeamIntegration::query()->whereKey($integration->id)->lockForUpdate()->firstOrFail();
            $current = (array) $locked->setting('statusMapping', []);
            $containers = (array) ($current[$group] ?? []);

            if (array_filter($entry, fn (mixed $value): bool => $value !== null) === []) {
                unset($containers[$container]);
            } else {
                $containers[$container] = $entry;
            }

            $locked->forceFill(['settings' => [...$locked->settings, 'statusMapping' => [...$current, $group => $containers]]])->save();
            $integration->setRawAttributes($locked->getAttributes(), true);
        });
    }
}
```

In `app/Actions/Integrations/UpdateTeamIntegration.php`:

1. Add `private UpdateStatusSyncSettings $updateStatusSyncSettings,` to the constructor.
2. In `rules()`, change `return match ($integration->provider) {` to `$rules = match ($integration->provider) {` and add after the `match` (keeping every arm Plans 14a–14c added):

```php
        return [...$rules, ...$this->updateStatusSyncSettings->rules($integration)];
```

3. In `handle()`, add right before the final `return $integration->refresh();`:

```php
        $integration = $this->updateStatusSyncSettings->handle($integration, $validated);
```

(If a 14a/14b branch returns early for URL channels or the generic webhook, leave it: those providers have no status sync.)

- [ ] **Step 5: Statuses endpoint, presenter and page prop**

Create `app/Http/Controllers/Integrations/IntegrationStatusesController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\TrackedIssues;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use App\Support\Integrations\Trackers\Trackers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Spec 8 §5.2, §7: the projects (Jira) or teams (Linear) holding tracked
 * issues, and the statuses one of them can be mapped to.
 */
class IntegrationStatusesController extends Controller
{
    public function index(Request $request, Workspace $workspace, Team $team, TeamIntegration $integration, TrackedIssues $trackedIssues, Trackers $trackers): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        abort_unless(in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter, IntegrationProvider::Linear], true), 404);

        $validated = $request->validate([
            'container' => ['sometimes', 'string', 'regex:'.TrackedIssues::ContainerKeyPattern],
        ]);

        $integration->ensureActive();

        if (! isset($validated['container'])) {
            return response()->json(['containers' => $trackedIssues->containerKeys($integration)]);
        }

        return response()->json([
            'statuses' => $trackers->syncing($integration->provider)->statuses($integration, (string) $validated['container']),
        ]);
    }
}
```

In `routes/web.php`, import it and add inside the integrations group, after the `teams.integrations.priorities.index` route:

```php
                Route::get('teams/{team}/integrations/{integration}/statuses', [IntegrationStatusesController::class, 'index'])
                    ->whereUuid('integration')
                    ->middleware('throttle:30,1,integrationStatuses')
                    ->name('teams.integrations.statuses.index');
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

In `app/Actions/Integrations/PresentTeamIntegration.php`:

1. Append `'treatCanceledAsDone', 'statusMapping'` to the `SettingKeys` lists of `jira`, `jira_dc`, `linear` and `github` (keeping the keys Plans 14a–14c put there).
2. Give the class a constructor `public function __construct(private InboundModes $inboundModes) {}` (add the argument to the existing constructor if 14b or 14c created one) and import `App\Support\Integrations\InboundModes` and `App\Support\Integrations\StatusSync`.
3. Add to the returned array of `handle()`, after 14b's `webhook` key:

```php
            'statusSync' => StatusSync::isOn($integration),
            'inboundMode' => $integration->inbound_mode->value,
            'webhookStatus' => $integration->webhook_status?->value,
            'lastInboundAt' => $integration->last_inbound_at?->toIso8601String(),
            'lastPolledAt' => $integration->last_polled_at?->toIso8601String(),
            'inboundHint' => $this->inboundModes->hint($integration),
```

and the matching lines to its array-shape docblock:

```php
     *     statusSync: bool,
     *     inboundMode: string,
     *     webhookStatus: ?string,
     *     lastInboundAt: ?string,
     *     lastPolledAt: ?string,
     *     inboundHint: ?string
```

In `app/Http/Controllers/Integrations/TeamIntegrationsController.php`, import `App\Support\Integrations\InboundReachability` and add to the `Inertia::render('teams/integrations', [...])` props:

```php
            'pollMinutes' => InboundReachability::pollIntervalMinutes(),
```

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/StatusSyncSettingsTest.php tests/Feature/Integrations/IntegrationsPageTest.php tests/Feature/Integrations/PriorityMappingTest.php tests/Feature/Integrations/ConnectJiraTest.php tests/Feature/Integrations/ConnectUrlChannelTest.php tests/Feature/Integrations/ConnectOutgoingWebhookTest.php tests/Feature/Mcp/TrackerToolsTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 7: Commit**

```bash
git add app/Actions/Integrations/ToggleStatusSync.php app/Actions/Integrations/UpdateStatusSyncSettings.php app/Actions/Integrations/UpdateTeamIntegration.php app/Actions/Integrations/PresentTeamIntegration.php app/Http/Controllers/Integrations/IntegrationStatusesController.php app/Http/Controllers/Integrations/TeamIntegrationsController.php routes/web.php tests/Feature/Integrations/StatusSyncSettingsTest.php
git commit -m "feat(integrations): let owners turn status sync on and map done statuses"
```

---

### Task 9: Sync state in action item payloads

Members see each link's source state, status name, sync state (`off`, `synced`, `pending`, `failed`, `missing`), error and last sync time, plus which tracker completed an item.

**Files:**
- Create: `tests/Feature/Integrations/ActionItemSyncPayloadTest.php`
- Modify: `app/Actions/Integrations/LinkStatusSync.php`, `app/Actions/Retros/PresentActionItem.php`, `app/Models/ActionItem.php`, `app/Events/Retros/ActionItemExternalLinksChanged.php`, `tests/Feature/Integrations/{ExternalLinksPresentationTest,ActionItemExportTest}.php`, `tests/Feature/ActionItems/PresentActionItemTest.php`

**Interfaces:**
- Consumes: Tasks 3–4 (`LinkStatusSync::integration`, `completed_via_source`).
- Produces: `LinkStatusSync::state(ActionItemExternalLink, ActionItem): string` and constants `Off`, `Synced`, `Pending`, `Failed`, `Missing`; `externalLinks[]` items `{id, source, key, url, state, statusName, syncState, syncError, lastSyncedAt}`; `completedVia: ?string` after `completedAt` in every presented action item.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/ActionItemSyncPayloadTest.php`:

```php
<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Actions\Retros\PresentActionItem;
use App\Enums\ActionItemStatus;
use App\Enums\ExternalIssueState;
use App\Models\ActionItem;
use App\Models\Participant;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
});

it('presents the sync state of each link to members', function (array $link, bool $syncOn, string $expected) {
    ['item' => $item, 'retro' => $retro] = statusSyncLink($link, syncOn: $syncOn);
    [, $member] = retroMember($retro);

    $presented = app(PresentActionItem::class)->handle($item->fresh()->loadForPresentation(), ActionItemActor::forParticipant($member));

    expect($presented['externalLinks'][0]['syncState'])->toBe($expected);
})->with([
    'sync off' => [['external_state' => ExternalIssueState::Open], false, 'off'],
    'synced' => [['external_state' => ExternalIssueState::Open], true, 'synced'],
    'never read' => [[], true, 'pending'],
    'states differ' => [['external_state' => ExternalIssueState::Done], true, 'pending'],
    'failed' => [['external_state' => ExternalIssueState::Open, 'sync_error' => 'Boom'], true, 'failed'],
    'missing' => [['external_state' => ExternalIssueState::Open, 'missing_at' => '2026-10-07 10:00:00'], true, 'missing'],
]);

it('presents every sync field of a link', function () {
    ['item' => $item, 'retro' => $retro, 'link' => $link] = statusSyncLink([
        'external_state' => ExternalIssueState::Open,
        'external_status_name' => 'In Review',
        'last_synced_at' => '2026-10-07 10:20:00',
    ]);
    [, $member] = retroMember($retro);

    expect(app(PresentActionItem::class)->handle($item->fresh()->loadForPresentation(), ActionItemActor::forParticipant($member))['externalLinks'])->toBe([[
        'id' => $link->id,
        'source' => 'jira',
        'key' => 'PROJ-1',
        'url' => 'https://acme.atlassian.net/browse/PROJ-1',
        'state' => 'open',
        'statusName' => 'In Review',
        'syncState' => 'synced',
        'syncError' => null,
        'lastSyncedAt' => '2026-10-07T10:20:00+00:00',
    ]]);
});

it('gives guests no links and broadcasts none', function () {
    ['item' => $item, 'retro' => $retro] = statusSyncLink(['sync_error' => 'Secret failure detail']);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $present = app(PresentActionItem::class);
    $loaded = $item->fresh()->loadForPresentation();

    expect($present->handle($loaded, ActionItemActor::forParticipant($guest))['externalLinks'])->toBe([])
        ->and($present->handle($loaded)['externalLinks'])->toBeNull();

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->assertDontSee('Secret failure detail');
});

it('says which tracker completed an item until it changes again', function () {
    ['item' => $item, 'retro' => $retro] = statusSyncLink();
    [, $member] = retroMember($retro);
    $setStatus = fn (ActionItemActor|ExternalSyncActor $actor, ActionItemStatus $status) => DB::transaction(
        fn () => app(SetActionItemStatus::class)->handle(ActionItem::query()->whereKey($item->id)->lockForUpdate()->firstOrFail(), $actor, $status),
    );

    $setStatus(new ExternalSyncActor('jira', 'PROJ-1'), ActionItemStatus::Completed);
    $loaded = $item->fresh()->loadForPresentation();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $present = app(PresentActionItem::class);

    expect($present->handle($loaded, ActionItemActor::forParticipant($member))['completedVia'])->toBe('jira')
        ->and($present->handle($loaded, ActionItemActor::forParticipant($guest))['completedVia'])->toBeNull()
        ->and($present->handle($loaded)['completedVia'])->toBeNull();

    $setStatus(new ExternalSyncActor('jira', 'PROJ-1'), ActionItemStatus::Open);
    expect($item->fresh()->completed_via_source)->toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ActionItemSyncPayloadTest.php`
Expected: FAIL — `Undefined array key "syncState"` / `"completedVia"`.

- [ ] **Step 3: The link state**

In `app/Actions/Integrations/LinkStatusSync.php`, add the imports `App\Enums\ExternalIssueState` and `App\Models\ActionItem`, the constants, and `state()`:

```php
    public const Off = 'off';

    public const Synced = 'synced';

    public const Pending = 'pending';

    public const Failed = 'failed';

    public const Missing = 'missing';

    /**
     * Spec 8 §7: `pending` until the source was read or while its state
     * differs from the item's (a push or a read is on its way).
     */
    public static function state(ActionItemExternalLink $link, ActionItem $item): string
    {
        $integration = self::integration($link, $item->team);

        if ($integration === null || ! $integration->isActive()) {
            return self::Off;
        }

        if ($link->missing_at !== null) {
            return self::Missing;
        }

        if ($link->sync_error !== null) {
            return self::Failed;
        }

        $itemState = $item->isCompleted() ? ExternalIssueState::Done : ExternalIssueState::Open;

        return $link->external_state === $itemState ? self::Synced : self::Pending;
    }
```

- [ ] **Step 4: Present it**

In `app/Models/ActionItem.php`, add `'team.integrations'` to the list returned by `presentationRelations()` (after `'team.members'`), so presenting many items reads each team's connections once.

In `app/Actions/Retros/PresentActionItem.php`, import `App\Actions\Integrations\LinkStatusSync`, then:

1. In the `handle()` docblock, add `completedVia: ?string,` after `completedAt: ?string,` and replace the `externalLinks` line with:

```php
     *     externalLinks: ?array<int, array{id: string, source: string, key: string, url: string, state: ?string, statusName: ?string, syncState: string, syncError: ?string, lastSyncedAt: ?string}>,
```

2. In the returned array, add after `'completedAt' => …,`:

```php
            'completedVia' => $viewer?->user === null ? null : $item->completed_via_source,
```

Members see the tracker; guests and viewer-less payloads (broadcasts, which guests also receive) get `null`, as `externalLinks` does. Extend the class docblock sentence on external links with "and so is `completedVia`".

3. Replace `presentExternalLinks()` and the return docblock of `externalLinksFor()`:

```php
    /**
     * @return array<int, array{id: string, source: string, key: string, url: string, state: ?string, statusName: ?string, syncState: string, syncError: ?string, lastSyncedAt: ?string}>
     */
    public function presentExternalLinks(ActionItem $item): array
    {
        return $item->externalLinks
            ->sortBy(fn (ActionItemExternalLink $link): string => $link->source->value)
            ->map(function (ActionItemExternalLink $link) use ($item): array {
                $syncState = LinkStatusSync::state($link, $item);

                return [
                    'id' => $link->id,
                    'source' => $link->source->value,
                    'key' => $link->external_key,
                    'url' => $link->external_url,
                    'state' => $link->external_state?->value,
                    'statusName' => $link->external_status_name,
                    'syncState' => $syncState,
                    'syncError' => $syncState === LinkStatusSync::Failed ? $link->sync_error : null,
                    'lastSyncedAt' => $link->last_synced_at?->toIso8601String(),
                ];
            })
            ->values()
            ->all();
    }
```

```php
    /**
     * @return ?array<int, array{id: string, source: string, key: string, url: string, state: ?string, statusName: ?string, syncState: string, syncError: ?string, lastSyncedAt: ?string}>
     */
```

In `app/Events/Retros/ActionItemExternalLinksChanged.php`, change the constructor docblock to `@param  array<int, array<string, mixed>>  $externalLinks` and the property type accordingly.

- [ ] **Step 5: Update the shape assertions**

- `tests/Feature/ActionItems/PresentActionItemTest.php`: in every exact expectation of a presented item ("presents every field of a board item"), add `'completedVia' => null,` right after `'completedAt' => null,`.
- `tests/Feature/Integrations/ExternalLinksPresentationTest.php` (add `use Illuminate\Support\Arr;`): in "presents external links to members only" replace the first expectation with

```php
    expect(collect($present->handle($loaded, ActionItemActor::forParticipant($member))['externalLinks'])
        ->map(fn (array $link): array => Arr::only($link, ['source', 'key', 'url', 'syncState']))
        ->all())->toBe([
            ['source' => 'jira', 'key' => 'PROJ-12', 'url' => 'https://acme.atlassian.net/browse/PROJ-12', 'syncState' => 'off'],
            ['source' => 'linear', 'key' => 'ENG-7', 'url' => 'https://linear.app/acme/issue/ENG-7', 'syncState' => 'off'],
        ])
```

(keeping its two `->and(...)` lines), and in "announces new links on the member channels…" replace the `broadcastWith() === [...]` condition with

```php
        && $event->broadcastWith()['actionItemId'] === $item->id
        && Arr::only($event->broadcastWith()['externalLinks'][0], ['source', 'key', 'url']) === ['source' => 'jira', 'key' => 'PROJ-3', 'url' => $item->externalLinks()->first()->external_url]);
```

- `tests/Feature/Integrations/ActionItemExportTest.php`: replace `->assertJsonPath('actionItem.externalLinks', [['source' => 'jira', 'key' => 'PROJ-42', 'url' => 'https://acme.atlassian.net/browse/PROJ-42']])` with

```php
        ->assertJsonCount(1, 'actionItem.externalLinks')
        ->assertJsonPath('actionItem.externalLinks.0.source', 'jira')
        ->assertJsonPath('actionItem.externalLinks.0.key', 'PROJ-42')
        ->assertJsonPath('actionItem.externalLinks.0.url', 'https://acme.atlassian.net/browse/PROJ-42')
        ->assertJsonPath('actionItem.externalLinks.0.syncState', 'off')
```

and any other exact `externalLinks` expectation the same way (`grep -rn "externalLinks'" tests` — Plan 14c's GitHub and Jira DC export tests included).

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ActionItemSyncPayloadTest.php tests/Feature/Integrations/ExternalLinksPresentationTest.php tests/Feature/Integrations/ActionItemExportTest.php tests/Feature/Integrations/JiraDataCenterExportTest.php tests/Feature/Integrations/GitHubExportTest.php tests/Feature/ActionItems tests/Feature/Retros tests/Feature/Mcp`
Expected: PASS (fix any other exact action item shape the same way: add `completedVia` after `completedAt`). Then pint and phpstan (0 errors).

- [ ] **Step 7: Commit**

```bash
git add app/Actions/Integrations/LinkStatusSync.php app/Actions/Retros/PresentActionItem.php app/Models/ActionItem.php app/Events/Retros/ActionItemExternalLinksChanged.php tests/Feature/Integrations/ActionItemSyncPayloadTest.php tests/Feature/Integrations/ExternalLinksPresentationTest.php tests/Feature/Integrations/ActionItemExportTest.php tests/Feature/ActionItems/PresentActionItemTest.php
git commit -m "feat(action-items): show the sync state of linked issues"
```

(Stage any other test file Step 6 had to adjust.)

---

### Task 10: Poker status, estimate conflicts and MCP

Non-guest players see each imported task's source status, category, missing flag, sync mode and estimate conflict; the facilitator keeps skrum's estimate or takes the source's; MCP task lists expose the same.

**Files:**
- Create: `app/Actions/Integrations/ResolvePokerEstimateConflict.php`, `app/Http/Controllers/Integrations/PokerEstimateConflictsController.php`, `tests/Feature/Integrations/PokerStatusSyncTest.php`
- Modify: `app/Actions/Integrations/PokerTaskSync.php`, `app/Actions/Poker/{PresentPokerTask,SetPokerEstimate}.php`, `app/Mcp/Presenters/McpPokerGame.php`, `routes/web.php`, `tests/Feature/Integrations/PokerTaskExternalTest.php`

**Interfaces:**
- Consumes: Task 4 (task status columns filled by imports, refreshes and the sync), `StatusSync`, `RequestEstimateSync::retry()`, 14c `PokerTaskSync::writesAnyDeck()`.
- Produces: `PokerTaskSync::{syncMode, estimateConflict, matchingCard}`; poker `external` (non-guest) keys `status`, `statusCategory`, `missing`, `estimateConflict: {sourceEstimate, matchingCard}|null`, `syncMode`; `SetPokerEstimate::fromSource()`; `ResolvePokerEstimateConflict` (`KeepSkrum = 'keepSkrum'`, `UseSource = 'useSource'`); route `poker.tasks.estimate-conflict.store` (`POST poker/{game}/tasks/{task}/estimate-conflict`); MCP `poker.game.tasks.list` `external.{statusCategory, missing, estimateConflict}`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/PokerStatusSyncTest.php`:

```php
<?php

use App\Enums\ExternalStatusCategory;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\PokerDeck;
use App\Jobs\SyncTaskEstimate;
use App\Mcp\Presenters\McpPokerGame;
use App\Models\PokerTask;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
});

/**
 * An imported task estimated 5 in skrum, synced at 09:00, whose source
 * estimate became `$sourceEstimate` at 10:00.
 *
 * @param  array<string, mixed>  $table
 * @param  array<string, mixed>  $attributes
 */
function conflictingTask(array $table, string $sourceEstimate = '8', array $attributes = []): PokerTask
{
    $table['integration']->mergeSettings(['statusSync' => true]);

    return importedPokerTask($table['game'], [
        'estimate' => '5',
        'estimate_numeric' => 5,
        'estimated_at' => '2026-10-07 08:55:00',
        'external_estimate' => $sourceEstimate,
        'external_updated_at' => '2026-10-07 10:00:00',
        'synced_at' => '2026-10-07 09:00:00',
        ...$attributes,
    ], $table['integration']->provider);
}

function conflictRoute(array $table, PokerTask $task): string
{
    return route('poker.tasks.estimate-conflict.store', [$table['game'], $task]);
}

it('shows the source status, missing flag and sync mode to members only', function () {
    $table = trackerTable();
    $table['integration']->mergeSettings(['statusSync' => true]);
    $table['integration']->forceFill(['inbound_mode' => IntegrationInboundMode::Polling])->save();
    importedPokerTask($table['game'], [
        'external_status_name' => 'In Review',
        'external_status_category' => ExternalStatusCategory::InProgress,
        'external_missing_at' => '2026-10-07 10:00:00',
    ]);
    $guest = pokerGuest($table['game']);

    $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.external.status', 'In Review')
        ->assertJsonPath('tasks.0.external.statusCategory', 'in_progress')
        ->assertJsonPath('tasks.0.external.missing', true)
        ->assertJsonPath('tasks.0.external.estimateConflict', null)
        ->assertJsonPath('tasks.0.external.syncMode', 'polling');

    $guestView = $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk();

    expect($guestView->json('tasks.0.external'))->not->toHaveKey('status')
        ->and($guestView->getContent())->not->toContain('In Review');
});

it('flags a source estimate that changed after the last sync', function () {
    $table = trackerTable();
    conflictingTask($table);

    $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.external.estimateConflict', ['sourceEstimate' => '8', 'matchingCard' => '8']);
});

it('does not flag equal, pending, older or unestimated values', function (array $attributes) {
    $table = trackerTable();
    conflictingTask($table, attributes: $attributes);

    $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.external.estimateConflict', null);
})->with([
    'same value' => [['external_estimate' => '5']],
    'write-back pending' => [['needs_sync' => true]],
    'changed before the sync' => [['external_updated_at' => '2026-10-07 08:00:00']],
    'no skrum estimate' => [['estimate' => null, 'estimate_numeric' => null, 'estimated_at' => null]],
    'never synced, unchanged since import' => [['synced_at' => null]],
]);

it('keeps the skrum estimate by writing it again', function () {
    $table = trackerTable();
    $task = conflictingTask($table);

    $this->actingAs($table['facilitator'])
        ->postJson(conflictRoute($table, $task), ['resolution' => 'keepSkrum'])
        ->assertOk()
        ->assertJsonPath('estimate', '5')
        ->assertJsonPath('external.estimateConflict', null);

    expect($task->fresh()->needs_sync)->toBeTrue();
    Queue::assertPushed(SyncTaskEstimate::class, fn (SyncTaskEstimate $job) => $job->taskId === $task->id);
});

it('uses the source estimate without a new round', function () {
    $table = trackerTable();
    $task = conflictingTask($table);

    $this->actingAs($table['facilitator'])
        ->postJson(conflictRoute($table, $task), ['resolution' => 'useSource'])
        ->assertOk()
        ->assertJsonPath('estimate', '8');

    expect($task->fresh()->estimate)->toBe('8');
});

it('refuses a source estimate that is not in the deck', function () {
    $table = trackerTable();
    $task = conflictingTask($table, '7');

    $this->actingAs($table['facilitator'])
        ->postJson(conflictRoute($table, $task), ['resolution' => 'useSource'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['resolution' => '7 is not in this deck.']);

    expect($task->fresh()->estimate)->toBe('5');
});

it('answers 409 when the estimate is already in sync', function () {
    $table = trackerTable();
    $task = conflictingTask($table, '5');

    $this->actingAs($table['facilitator'])
        ->postJson(conflictRoute($table, $task), ['resolution' => 'useSource'])
        ->assertStatus(409)
        ->assertJsonPath('message', 'This estimate is already in sync.');
});

it('reserves conflict resolution to the facilitator', function () {
    $table = trackerTable();
    $task = conflictingTask($table);
    $guest = pokerGuest($table['game']);

    $this->actingAs($table['member'])->postJson(conflictRoute($table, $task), ['resolution' => 'nonsense'])->assertForbidden();
    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->postJson(conflictRoute($table, $task), ['resolution' => 'useSource'])
        ->assertForbidden();

    expect($task->fresh()->estimate)->toBe('5');
});

it('matches GitHub estimates to card labels exactly', function (string $sourceEstimate, ?string $matchingCard) {
    enableIntegrations(IntegrationProvider::GitHub);
    $table = trackerTable(IntegrationProvider::GitHub, deck: PokerDeck::Tshirt);
    conflictingTask($table, $sourceEstimate, ['estimate' => 'M', 'estimate_numeric' => null]);

    $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.external.estimateConflict', ['sourceEstimate' => $sourceEstimate, 'matchingCard' => $matchingCard]);
})->with([
    'same label' => ['L', 'L'],
    'other case' => ['l', null],
]);

it('exposes the status and conflict to MCP clients', function () {
    $table = trackerTable();
    conflictingTask($table, attributes: ['external_status_category' => ExternalStatusCategory::Done]);

    $tasks = app(McpPokerGame::class)->tasks($table['game']->fresh(), $table['memberPlayer']);

    expect($tasks[0]['external'])->toMatchArray([
        'statusCategory' => 'done',
        'missing' => false,
        'estimateConflict' => ['sourceEstimate' => '8', 'matchingCard' => '8'],
    ]);
});
```

In `tests/Feature/Integrations/PokerTaskExternalTest.php` ("shows the full external object…"), add to the expected `external` array, between `'unsupportedReason' => null,` and `'isManaged' => true,`:

```php
        'status' => null,
        'statusCategory' => null,
        'missing' => false,
        'estimateConflict' => null,
        'syncMode' => 'off',
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PokerStatusSyncTest.php`
Expected: FAIL — `Route [poker.tasks.estimate-conflict.store] not defined.` and missing `external.status`.

- [ ] **Step 3: Sync mode and conflicts**

In `app/Actions/Integrations/PokerTaskSync.php`, import `App\Enums\IntegrationInboundMode`, `App\Enums\PokerDeck` and `App\Support\Integrations\StatusSync`, and add after `state()`:

```php
    public function syncMode(PokerTask $task): string
    {
        $integration = $task->external_source === null ? null : $this->integration($task->external_source);

        if ($integration === null || ! StatusSync::isOn($integration) || $integration->site() !== $task->external_site) {
            return IntegrationInboundMode::Off->value;
        }

        return $integration->inbound_mode->value;
    }

    /**
     * Spec 8 §5.8: the source estimate changed after the last write-back
     * (or after the import) and differs from skrum's. Nothing is flagged
     * while a write-back is on its way or cannot happen.
     *
     * @return array{sourceEstimate: string, matchingCard: ?string}|null
     */
    public function estimateConflict(PokerTask $task): ?array
    {
        $provider = IntegrationProvider::tryFrom((string) $task->external_source);

        if ($provider === null || $task->estimate === null || $task->external_estimate === null) {
            return null;
        }

        if (self::sameEstimate($provider, $task->estimate, $task->external_estimate)) {
            return null;
        }

        if (in_array($this->state($task), [self::Pending, self::Unsupported], true)) {
            return null;
        }

        $baseline = $task->synced_at ?? $task->created_at;

        if ($task->external_updated_at === null || ($baseline !== null && $task->external_updated_at->lte($baseline))) {
            return null;
        }

        return [
            'sourceEstimate' => $task->external_estimate,
            'matchingCard' => self::matchingCard($this->game, $provider, $task->external_estimate),
        ];
    }

    /**
     * The deck card holding the source's value: the same number for Jira
     * and Linear, the same label (case-sensitive) for GitHub.
     */
    public static function matchingCard(PokerGame $game, IntegrationProvider $provider, string $sourceEstimate): ?string
    {
        foreach ($game->cards as $card) {
            if (! PokerDeck::isSpecial($card) && self::sameEstimate($provider, $card, $sourceEstimate)) {
                return $card;
            }
        }

        return null;
    }

    private static function sameEstimate(IntegrationProvider $provider, string $skrum, string $source): bool
    {
        if ($skrum === $source) {
            return true;
        }

        if (self::writesAnyDeck($provider)) {
            return false;
        }

        $number = PokerDeck::numericValue($skrum);

        return $number !== null && $number === PokerDeck::numericValue($source);
    }
```

In `app/Actions/Poker/PresentPokerTask.php`, add to the `TaskExternal` phpstan type, before `isManaged: true`:

```php
 *     status?: ?string,
 *     statusCategory?: ?string,
 *     missing?: bool,
 *     estimateConflict?: array{sourceEstimate: string, matchingCard: ?string}|null,
 *     syncMode?: string,
```

and to the non-guest array of `external()`, between `'unsupportedReason' => …,` and `'isManaged' => true,`:

```php
            'status' => $task->external_status_name,
            'statusCategory' => $task->external_status_category?->value,
            'missing' => $task->external_missing_at !== null,
            'estimateConflict' => $sync->estimateConflict($task),
            'syncMode' => $sync->syncMode($task),
```

- [ ] **Step 4: Setting the source's estimate**

Replace the body of `app/Actions/Poker/SetPokerEstimate.php` from `public function handle(` up to (not including) `private function ensureEstimable(` with:

```php
    public function handle(PokerGame $locked, PokerTask $task, ?string $value): PokerTask
    {
        if ($value !== null) {
            $this->ensureEstimable($locked, $task, $value);
        }

        return $this->apply($locked, $task, $value);
    }

    /**
     * "Use :source estimate" (spec 8 §5.8): the same deck check, write-back
     * and broadcasts as the facilitator's pick, without a revealed round —
     * the task already has an estimate.
     */
    public function fromSource(PokerGame $locked, PokerTask $task, string $card): PokerTask
    {
        if (! in_array($card, $locked->cards, true) || PokerDeck::isSpecial($card)) {
            throw ValidationException::withMessages(['value' => __('Choose a card from the deck.')]);
        }

        return $this->apply($locked, $task, $card);
    }

    private function apply(PokerGame $locked, PokerTask $task, ?string $value): PokerTask
    {
        $previous = $task->estimate;

        if ($value === null) {
            $task->update([
                'estimate' => null,
                'estimate_numeric' => null,
                'estimated_at' => null,
            ]);
        }

        if ($value !== null && $value !== $previous) {
            $task->update([
                'estimate' => $value,
                'estimate_numeric' => PokerDeck::numericValue($value),
                'estimated_at' => now(),
            ]);
        }

        if ($task->estimate !== $previous) {
            $this->requestEstimateSync->afterEstimateChange($locked, $task);
        }

        $task->loadCount('rounds');

        (new PokerTaskSaved($locked->id, $this->presentPokerTask->handle($task)))->sendToOthers();

        if ($value !== null && $value !== $previous) {
            PokerTaskEstimated::dispatch($task);
        }

        return $task;
    }
```

(If Plan 14b changed the `PokerTaskEstimated` line, keep its version inside `apply()`.)

- [ ] **Step 5: The resolution endpoint**

Create `app/Actions/Integrations/ResolvePokerEstimateConflict.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PresentPokerTask;
use App\Actions\Poker\SetPokerEstimate;
use App\Events\Poker\PokerTaskSaved;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Validation\ValidationException;

/**
 * Spec 8 §5.8: nothing is overwritten silently; the facilitator keeps
 * skrum's estimate (written back again) or takes the source's card.
 */
class ResolvePokerEstimateConflict
{
    public const KeepSkrum = 'keepSkrum';

    public const UseSource = 'useSource';

    public function __construct(
        private RequestEstimateSync $requestEstimateSync,
        private SetPokerEstimate $setPokerEstimate,
        private PresentPokerTask $presentPokerTask,
    ) {}

    public function handle(PokerGame $locked, PokerTask $task, PokerPlayer $player, string $resolution): PokerTask
    {
        PokerGuard::notEnded($locked);

        $conflict = PokerTaskSync::for($locked)->estimateConflict($task);

        if ($conflict === null) {
            abort(409, __('This estimate is already in sync.'));
        }

        if ($resolution === self::KeepSkrum) {
            $this->requestEstimateSync->retry($locked, $task, $player);

            $task->loadCount('rounds');
            (new PokerTaskSaved($locked->id, $this->presentPokerTask->handle($task)))->sendToOthers();

            return $task;
        }

        if ($conflict['matchingCard'] === null) {
            throw ValidationException::withMessages(['resolution' => __(':value is not in this deck.', ['value' => $conflict['sourceEstimate']])]);
        }

        return $this->setPokerEstimate->fromSource($locked, $task, $conflict['matchingCard']);
    }
}
```

Create `app/Http/Controllers/Integrations/PokerEstimateConflictsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\PokerTaskSync;
use App\Actions\Integrations\ResolvePokerEstimateConflict;
use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PresentPokerTask;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PokerEstimateConflictsController extends Controller
{
    public function store(Request $request, PokerGame $game, PokerTask $task, ResolvePokerEstimateConflict $resolvePokerEstimateConflict, PresentPokerTask $presentPokerTask): JsonResponse
    {
        $player = PokerPlayer::current($request);

        abort_if($player->isGuest(), 403);
        PokerGuard::facilitator($game, $player);

        $validated = $request->validate([
            'resolution' => ['required', 'string', Rule::in([ResolvePokerEstimateConflict::KeepSkrum, ResolvePokerEstimateConflict::UseSource])],
        ]);

        $resolved = DB::transaction(function () use ($game, $task, $player, $validated, $resolvePokerEstimateConflict): PokerTask {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $lockedTask = PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($task->id)->lockForUpdate()->firstOrFail();

            return $resolvePokerEstimateConflict->handle($locked, $lockedTask, $player, (string) $validated['resolution']);
        });

        $resolved->loadCount('rounds');

        return response()->json($presentPokerTask->handle($resolved, PokerTaskSync::for($game->fresh() ?? $game)));
    }
}
```

In `routes/web.php`, import it and add to the `poker/{game}` group after `poker.tasks.sync.store`:

```php
        Route::post('tasks/{task}/estimate-conflict', [PokerEstimateConflictsController::class, 'store'])->name('poker.tasks.estimate-conflict.store')->whereUuid('task');
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

In `app/Mcp/Presenters/McpPokerGame.php`, extend the `external` array of `tasks()` after `'syncError' => …,`:

```php
                    'statusCategory' => $presented['external']['statusCategory'] ?? null,
                    'missing' => $presented['external']['missing'] ?? false,
                    'estimateConflict' => $presented['external']['estimateConflict'] ?? null,
```

- [ ] **Step 6: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `This estimate is already in sync.` | `Cette estimation est déjà synchronisée.` | `Esta estimación ya está sincronizada.` | `Diese Schätzung ist bereits synchronisiert.` |
| `:value is not in this deck.` | `:value ne fait pas partie de ce jeu.` | `:value no está en esta baraja.` | `:value ist nicht in diesem Deck.` |

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PokerStatusSyncTest.php tests/Feature/Integrations/PokerTaskExternalTest.php tests/Feature/Integrations/PokerEstimateSyncTest.php tests/Feature/Integrations/GitHubTrackerTest.php tests/Feature/Poker tests/Feature/Mcp tests/Feature/TranslationKeysTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 8: Commit**

```bash
git add app/Actions/Integrations/PokerTaskSync.php app/Actions/Integrations/ResolvePokerEstimateConflict.php app/Actions/Poker/PresentPokerTask.php app/Actions/Poker/SetPokerEstimate.php app/Http/Controllers/Integrations/PokerEstimateConflictsController.php app/Mcp/Presenters/McpPokerGame.php routes/web.php tests/Feature/Integrations/PokerStatusSyncTest.php tests/Feature/Integrations/PokerTaskExternalTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(poker): show source status and resolve estimate conflicts"
```

---

### Task 11: Status sync on the integrations page, link chips and poker tasks

Tracker cards gain a Status sync section (switch, mode line, last sync, "Treat canceled as done", mapping editor, Jira DC manual webhook panel); action item chips show the source state with a tooltip and Retry; completed-by-sync items say so; poker tasks show a status chip, "Not found", and the conflict badge with its two actions.

**Files:**
- Create: `resources/js/components/integrations/{status-sync-section,status-mapping-panel,jira-data-center-webhook-panel}.tsx`, `resources/js/components/poker/estimate-conflict.tsx`
- Modify: `resources/js/types/integrations.ts`, `resources/js/lib/retro/types.ts`, `resources/js/lib/poker/types.ts`, `resources/js/lib/action-items/endpoints.ts`, `resources/js/components/action-items/{external-link-chips,action-item-card}.tsx`, `resources/js/components/integrations/{jira-integration,linear-integration}.tsx`, `resources/js/pages/teams/integrations.tsx`, `resources/js/components/poker/{task-source-details,task-source-chip}.tsx`

**Interfaces:**
- Consumes: Tasks 3, 7, 8, 9, 10 (routes `retros.action-items.external-links.sync.store`, `workspaces.actionItemLinkSyncs.store`, `teams.integrations.statuses.index`, `teams.integrations.trackerWebhook.{show,store}`, `poker.tasks.estimate-conflict.store`, the new payload fields, page prop `pollMinutes`); 14c `statusSection` prop of `JiraDataCenterIntegration` / `GitHubIntegration`, `TrackerLabels` with four sources.
- Produces: `StatusSyncSection` (`scope`, `card`, `connection`), `StatusMappingPanel`, `JiraDataCenterWebhookPanel`, `EstimateConflict`; `ActionItemEndpoints.syncLink(actionItemId, externalLinkId)`; `ExternalLinkChips` prop `onRetry?`.

- [ ] **Step 1: Types and endpoints**

In `resources/js/types/integrations.ts`:

1. Replace `ExternalLink` with:

```ts
export type ExternalLinkSyncState =
    | 'off'
    | 'synced'
    | 'pending'
    | 'failed'
    | 'missing';

export type ExternalLink = {
    id: string;
    source: TrackerProviderKey;
    key: string;
    url: string;
    state: 'open' | 'done' | null;
    statusName: string | null;
    syncState: ExternalLinkSyncState;
    syncError: string | null;
    lastSyncedAt: string | null;
};
```

2. Add after `IntegrationPriorityMap`:

```ts
export type InboundMode = 'webhook' | 'polling' | 'off';

export type WebhookStatus = 'pending' | 'active' | 'failing';

export type JiraStatusMapping = {
    doneStatusIds: string[] | null;
    completeStatusId: string | null;
    reopenStatusId: string | null;
};

export type LinearStatusMapping = {
    completeStateId: string | null;
    reopenStateId: string | null;
};

export type StatusMapping = {
    projects?: Record<string, JiraStatusMapping>;
    teams?: Record<string, LinearStatusMapping>;
};

export type TrackerStatus = {
    id: string;
    name: string;
    category: 'todo' | 'in_progress' | 'done';
};

export type TrackerWebhookDetails = {
    url: string;
    secret: string;
    events: string[];
    jql: string | null;
};
```

3. Add to `IntegrationSettings`: `treatCanceledAsDone?: boolean;` and `statusMapping?: StatusMapping;`. Add to `TeamIntegration`:

```ts
    statusSync: boolean;
    inboundMode: InboundMode;
    webhookStatus: WebhookStatus | null;
    lastInboundAt: string | null;
    lastPolledAt: string | null;
    inboundHint: 'reconnect' | 'manual' | null;
```

In `resources/js/lib/retro/types.ts`, import `TrackerProviderKey` from `@/types/integrations` (next to `ExportSource, ExternalLink`) and add to `ActionItem` after `completedAt`:

```ts
    /** The tracker whose status sync completed the item. */
    completedVia: TrackerProviderKey | null;
```

Add `completedVia: null` wherever the type checker reports an `ActionItem` literal without it.

Broadcast payloads carry `completedVia: null` (guests receive them), so merge it like `externalLinks`, keeping the known value only while the item stays completed. In `resources/js/lib/retro/board-reducer.ts`, next to `externalLinks: incoming.externalLinks ?? existing.externalLinks,` add:

```ts
                  completedVia:
                      incoming.completedAt === null
                          ? null
                          : (incoming.completedVia ?? existing.completedVia),
```

and in `resources/js/pages/action-items/index.tsx`, next to `externalLinks: incoming.externalLinks ?? item.externalLinks,`:

```ts
                  completedVia:
                      incoming.completedAt === null
                          ? null
                          : (incoming.completedVia ?? item.completedVia),
```

In `resources/js/lib/poker/types.ts`, add before `PokerTaskExternal` and to it:

```ts
export type PokerEstimateConflict = {
    sourceEstimate: string;
    matchingCard: string | null;
};
```

```ts
    status?: string | null;
    statusCategory?: 'todo' | 'in_progress' | 'done' | null;
    missing?: boolean;
    estimateConflict?: PokerEstimateConflict | null;
    syncMode?: 'webhook' | 'polling' | 'off';
```

In `resources/js/lib/action-items/endpoints.ts`, import `RetroActionItemLinkSyncsController` and `WorkspaceActionItemLinkSyncsController` from `@/actions/App/Http/Controllers/Integrations/…`, add to `ActionItemEndpoints`:

```ts
    syncLink: (actionItemId: string, externalLinkId: string) => EndpointRoute;
```

to `boardActionItemEndpoints()`:

```ts
        syncLink: (actionItem, externalLink) =>
            RetroActionItemLinkSyncsController.store({
                retro: retroId,
                actionItem,
                externalLink,
            }),
```

and to `workspaceActionItemEndpoints()`:

```ts
        syncLink: (actionItem, externalLink) =>
            WorkspaceActionItemLinkSyncsController.store({
                workspace,
                actionItem,
                externalLink,
            }),
```

- [ ] **Step 2: Link chips and "Completed in :source"**

Replace `resources/js/components/action-items/external-link-chips.tsx`:

```tsx
import { usePage } from '@inertiajs/react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { formatRelativeTime } from '@/lib/action-items/format';
import { TrackerLabels } from '@/lib/poker/types';
import type { ExternalLink } from '@/types';

type Props = {
    links: ExternalLink[] | null;
    onRetry?: (link: ExternalLink) => Promise<void>;
};

export function ExternalLinkChips({ links, onRetry }: Props) {
    if (links === null || links.length === 0) {
        return null;
    }

    return (
        <>
            {links.map((link) => (
                <ExternalLinkChip
                    key={link.source}
                    link={link}
                    onRetry={onRetry}
                />
            ))}
        </>
    );
}

function ExternalLinkChip({
    link,
    onRetry,
}: {
    link: ExternalLink;
    onRetry?: (link: ExternalLink) => Promise<void>;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [busy, setBusy] = useState(false);
    const [openedAt, setOpenedAt] = useState(0);
    const source = TrackerLabels[link.source];
    const status =
        link.statusName ?? t(link.state === 'done' ? 'Done' : 'Not done');

    const summary = (): string | null => {
        switch (link.syncState) {
            case 'off':
                return null;
            case 'synced':
                return t(':status in :source', { status, source });
            case 'pending':
                return t('Sync pending');
            case 'failed':
                return t('Sync failed: :error', {
                    error: link.syncError ?? '',
                });
            case 'missing':
                return t('Not found in :source', { source });
        }
    };

    const description = summary();
    const detail =
        link.syncState === 'synced' &&
        link.lastSyncedAt !== null &&
        openedAt > 0
            ? t(':status in :source · synced :time', {
                  status,
                  source,
                  time: formatRelativeTime(link.lastSyncedAt, locale, openedAt),
              })
            : description;

    const retry = async () => {
        if (!onRetry) {
            return;
        }

        setBusy(true);

        try {
            await onRetry(link);
        } finally {
            setBusy(false);
        }
    };

    const chip = (
        <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xs text-foreground hover:bg-muted"
        >
            {link.syncState !== 'off' && link.state !== null && (
                <span
                    aria-hidden
                    className={`size-1.5 rounded-full ${
                        link.state === 'done'
                            ? 'bg-emerald-500'
                            : 'border border-muted-foreground'
                    }`}
                />
            )}
            {link.key}
            <ArrowUpRight className="size-3" aria-hidden />
            {description !== null && (
                <span className="sr-only">{description}</span>
            )}
        </a>
    );

    return (
        <span className="inline-flex items-center gap-0.5">
            {description === null ? (
                chip
            ) : (
                <Tooltip
                    onOpenChange={(open) => {
                        if (open) {
                            setOpenedAt(Date.now());
                        }
                    }}
                >
                    <TooltipTrigger asChild>{chip}</TooltipTrigger>
                    <TooltipContent>{detail}</TooltipContent>
                </Tooltip>
            )}
            {link.syncState === 'failed' && onRetry && (
                <Button
                    size="icon"
                    variant="ghost"
                    className="size-5"
                    disabled={busy}
                    aria-label={t('Retry the sync of :key', { key: link.key })}
                    onClick={() => void retry()}
                >
                    <RefreshCw className="size-3" />
                </Button>
            )}
        </span>
    );
}
```

In `resources/js/components/action-items/action-item-card.tsx`:

1. Import `toast` from `sonner`, `TrackerLabels` from `@/lib/poker/types` and the type `ExternalLink` from `@/types`.
2. Add inside the component, after `remove`:

```tsx
    const retrySync = async (link: ExternalLink) => {
        const response = await run(
            retroRequest<{ actionItem: ActionItem }>(
                endpoints.syncLink(item.id, link.id),
            ),
        );

        if (response) {
            onSaved(response.actionItem);
            toast.success(t('Sync requested.'));
        }
    };
```

3. Replace `<ExternalLinkChips links={item.externalLinks} />` with:

```tsx
                        <ExternalLinkChips
                            links={item.externalLinks}
                            onRetry={manages ? retrySync : undefined}
                        />
                        {completed && item.completedVia && (
                            <span>
                                {t('Completed in :source', {
                                    source: TrackerLabels[item.completedVia],
                                })}
                            </span>
                        )}
```

- [ ] **Step 3: The Status sync section**

Create `resources/js/components/integrations/status-sync-section.tsx`:

```tsx
import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { Checkbox } from '@/components/ui/checkbox';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    TeamIntegration,
} from '@/types';
import { JiraDataCenterWebhookPanel } from './jira-data-center-webhook-panel';
import { StatusMappingPanel } from './status-mapping-panel';

type Props = {
    scope: IntegrationScope;
    card: IntegrationProviderCard;
    connection: TeamIntegration;
};

/**
 * Spec 8 §9: opt-in two-way status sync of a tracker connection.
 */
export function StatusSyncSection({ scope, card, connection }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const { pollMinutes } = usePage<{ pollMinutes?: number }>().props;
    const [busy, setBusy] = useState(false);
    const minutes = pollMinutes ?? 5;
    const treatsCanceled =
        connection.provider === 'linear' || connection.provider === 'github';
    const mapsStatuses =
        connection.provider === 'jira' ||
        connection.provider === 'jira_dc' ||
        connection.provider === 'linear';
    const lastSync = [connection.lastPolledAt, connection.lastInboundAt]
        .filter((value): value is string => value !== null)
        .sort()
        .at(-1);

    const save = async (data: Record<string, unknown>, success: string) => {
        setBusy(true);

        try {
            await retroRequest(
                TeamIntegrationsController.update({
                    workspace: scope.workspace,
                    team: scope.team,
                    integration: connection.id,
                }),
                data,
            );
            toast.success(success);
            router.reload({ only: ['providers'] });
        } catch (failure) {
            toast.error(
                integrationErrorMessage(failure, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    const modeLine = (): string => {
        if (
            connection.inboundMode === 'webhook' &&
            connection.webhookStatus === 'failing'
        ) {
            return t(
                "Webhooks aren't reaching skrum; checking every :n minutes.",
                { n: minutes },
            );
        }

        if (connection.inboundMode === 'webhook') {
            return t('Live updates (webhooks)');
        }

        return t('Checking every :n minutes.', { n: minutes });
    };

    return (
        <section className="space-y-3 border-t pt-4">
            <div>
                <h3 className="text-sm font-medium">{t('Status sync')}</h3>
                <p className="text-xs text-muted-foreground">
                    {t(
                        'Completing an action item moves its :provider issue to done, and closing the issue completes the item. Imported poker tasks follow their issue.',
                        { provider: card.label },
                    )}
                </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
                <Checkbox
                    checked={connection.statusSync}
                    disabled={busy}
                    onCheckedChange={(checked) =>
                        void save(
                            { status_sync: checked === true },
                            checked === true
                                ? t('Status sync is on.')
                                : t('Status sync is off.'),
                        )
                    }
                />
                {t('Sync status')}
            </label>
            {connection.statusSync && (
                <>
                    <p className="text-sm text-muted-foreground">
                        {modeLine()}
                    </p>
                    {lastSync !== undefined && (
                        <p className="text-xs text-muted-foreground">
                            {t('Last sync: :time', {
                                time: new Intl.DateTimeFormat(locale, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                }).format(new Date(lastSync)),
                            })}
                        </p>
                    )}
                    {connection.inboundHint === 'reconnect' && (
                        <p className="text-xs text-muted-foreground">
                            {t('Reconnect :provider to receive live updates.', {
                                provider: card.label,
                            })}
                        </p>
                    )}
                    {connection.inboundHint === 'manual' && (
                        <JiraDataCenterWebhookPanel
                            scope={scope}
                            connection={connection}
                        />
                    )}
                    {treatsCanceled && (
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={
                                    connection.settings.treatCanceledAsDone !==
                                    false
                                }
                                disabled={busy}
                                onCheckedChange={(checked) =>
                                    void save(
                                        {
                                            treat_canceled_as_done:
                                                checked === true,
                                        },
                                        t('Status sync setting saved.'),
                                    )
                                }
                            />
                            {t('Treat canceled as done')}
                        </label>
                    )}
                    {mapsStatuses && (
                        <StatusMappingPanel
                            scope={scope}
                            connection={connection}
                        />
                    )}
                </>
            )}
        </section>
    );
}
```

- [ ] **Step 4: The mapping editor**

Create `resources/js/components/integrations/status-mapping-panel.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import IntegrationStatusesController from '@/actions/App/Http/Controllers/Integrations/IntegrationStatusesController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationScope,
    TeamIntegration,
    TrackerStatus,
} from '@/types';

const Automatic = 'automatic';

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

/**
 * Spec 8 §5.2: per project (Jira) or team (Linear) of the tracked issues,
 * which statuses count as done and where a push moves the issue.
 */
export function StatusMappingPanel({ scope, connection }: Props) {
    const { t } = useTrans();
    const [containers, setContainers] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { workspace, team } = scope;
    const integration = connection.id;

    useEffect(() => {
        let cancelled = false;

        retroRequest<{ containers: string[] }>(
            IntegrationStatusesController.index({
                workspace,
                team,
                integration,
            }),
        )
            .then((loaded) => {
                if (!cancelled) {
                    setContainers(loaded.containers);
                    setError(null);
                }
            })
            .catch((failure: unknown) => {
                if (!cancelled) {
                    setError(
                        integrationErrorMessage(
                            failure,
                            t('Something went wrong.'),
                        ),
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [workspace, team, integration, t]);

    return (
        <div className="space-y-2">
            <div>
                <h4 className="text-sm font-medium">{t('Status mapping')}</h4>
                <p className="text-xs text-muted-foreground">
                    {t(
                        'Automatic uses the done statuses of each workflow. Choose other statuses per project or team if yours differ.',
                    )}
                </p>
            </div>
            {error !== null && (
                <p className="text-sm text-destructive">{error}</p>
            )}
            {containers === null && error === null && <Spinner />}
            {containers !== null && containers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                    {t(
                        'Export an action item or import a task to map its statuses.',
                    )}
                </p>
            )}
            {containers?.map((container) => (
                <ContainerMapping
                    key={container}
                    scope={scope}
                    connection={connection}
                    container={container}
                />
            ))}
        </div>
    );
}

function ContainerMapping({
    scope,
    connection,
    container,
}: Props & { container: string }) {
    const { t } = useTrans();
    const [statuses, setStatuses] = useState<TrackerStatus[] | null>(null);
    const [busy, setBusy] = useState(false);
    const isJira = connection.provider !== 'linear';
    const jira = connection.settings.statusMapping?.projects?.[container];
    const linear = connection.settings.statusMapping?.teams?.[container];
    const params = {
        workspace: scope.workspace,
        team: scope.team,
        integration: connection.id,
    };
    const current: Record<string, string | string[] | null> = isJira
        ? {
              done_status_ids: jira?.doneStatusIds ?? null,
              complete_status_id: jira?.completeStatusId ?? null,
              reopen_status_id: jira?.reopenStatusId ?? null,
          }
        : {
              complete_state_id: linear?.completeStateId ?? null,
              reopen_state_id: linear?.reopenStateId ?? null,
          };
    const completeKey = isJira ? 'complete_status_id' : 'complete_state_id';
    const reopenKey = isJira ? 'reopen_status_id' : 'reopen_state_id';
    const doneStatuses = (statuses ?? []).filter(
        (status) => status.category === 'done',
    );
    const doneIds = jira?.doneStatusIds ?? null;

    const load = async () => {
        setBusy(true);

        try {
            const loaded = await retroRequest<{ statuses: TrackerStatus[] }>(
                IntegrationStatusesController.index(params, {
                    query: { container },
                }),
            );
            setStatuses(loaded.statuses);
        } catch (failure) {
            toast.error(
                integrationErrorMessage(failure, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    const save = async (change: Record<string, string | string[] | null>) => {
        setBusy(true);

        try {
            await retroRequest(TeamIntegrationsController.update(params), {
                status_mapping: { container, ...current, ...change },
            });
            toast.success(t('Status mapping saved.'));
            router.reload({ only: ['providers'] });
        } catch (failure) {
            toast.error(
                integrationErrorMessage(failure, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    const toggleDone = (id: string, checked: boolean) => {
        const all = doneStatuses.map((status) => status.id);
        const base = doneIds ?? all;
        const next = checked
            ? [...new Set([...base, id])]
            : base.filter((doneId) => doneId !== id);

        void save({
            done_status_ids: next.length === all.length ? null : next,
        });
    };

    const targetSelect = (key: string, label: string) => (
        <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <Select
                value={(current[key] as string | null) ?? Automatic}
                disabled={busy}
                onValueChange={(value) =>
                    void save({ [key]: value === Automatic ? null : value })
                }
            >
                <SelectTrigger className="w-full" aria-label={label}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={Automatic}>{t('Automatic')}</SelectItem>
                    {(statuses ?? []).map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                            {status.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );

    return (
        <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm">{container}</span>
                {statuses === null && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void load()}
                    >
                        {t('Edit mapping')}
                    </Button>
                )}
            </div>
            {statuses !== null && (
                <>
                    {isJira && doneStatuses.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                                {t('Counts as done')}
                            </p>
                            {doneStatuses.map((status) => (
                                <label
                                    key={status.id}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <Checkbox
                                        checked={
                                            doneIds === null ||
                                            doneIds.includes(status.id)
                                        }
                                        disabled={busy}
                                        onCheckedChange={(checked) =>
                                            toggleDone(
                                                status.id,
                                                checked === true,
                                            )
                                        }
                                    />
                                    {status.name}
                                </label>
                            ))}
                        </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                        {targetSelect(completeKey, t('Complete to'))}
                        {targetSelect(reopenKey, t('Reopen to'))}
                    </div>
                </>
            )}
        </div>
    );
}
```

- [ ] **Step 5: The Jira Data Center manual webhook panel**

Create `resources/js/components/integrations/jira-data-center-webhook-panel.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import TrackerWebhooksController from '@/actions/App/Http/Controllers/Integrations/TrackerWebhooksController';
import { Button } from '@/components/ui/button';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationScope,
    TeamIntegration,
    TrackerWebhookDetails,
} from '@/types';

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

/**
 * Spec 8 §4.1: Data Center webhooks need a Jira administrator. The URL
 * (with its token) and the secret are fetched on demand, never kept in
 * page props.
 */
export function JiraDataCenterWebhookPanel({ scope, connection }: Props) {
    const { t } = useTrans();
    const [details, setDetails] = useState<TrackerWebhookDetails | null>(
        null,
    );
    const [busy, setBusy] = useState(false);
    const params = {
        workspace: scope.workspace,
        team: scope.team,
        integration: connection.id,
    };

    const show = async () => {
        setBusy(true);

        try {
            setDetails(
                await retroRequest<TrackerWebhookDetails>(
                    TrackerWebhooksController.show(params),
                ),
            );
        } catch (failure) {
            toast.error(
                integrationErrorMessage(failure, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    const confirm = async () => {
        setBusy(true);

        try {
            await retroRequest(TrackerWebhooksController.store(params), {
                registered: true,
            });
            toast.success(t('skrum now waits for the first event.'));
            router.reload({ only: ['providers'] });
        } catch (failure) {
            toast.error(
                integrationErrorMessage(failure, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-2 rounded-md bg-muted/50 p-3 text-sm">
            <p>
                {t(
                    'Only a Jira administrator can register the webhook. Ask one to add it in Jira (System → WebHooks) with these details.',
                )}
            </p>
            {details === null ? (
                <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void show()}
                >
                    {t('Show webhook details')}
                </Button>
            ) : (
                <dl className="space-y-2">
                    <CopyRow label={t('Webhook URL')} value={details.url} />
                    <CopyRow
                        label={t('Events')}
                        value={details.events.join(', ')}
                    />
                    {details.jql !== null && (
                        <CopyRow label={t('JQL filter')} value={details.jql} />
                    )}
                    <CopyRow
                        label={t('Secret (for Jira versions that sign)')}
                        value={details.secret}
                    />
                </dl>
            )}
            {connection.webhookStatus === null && (
                <Button size="sm" disabled={busy} onClick={() => void confirm()}>
                    {t("I've registered it")}
                </Button>
            )}
        </div>
    );
}

function CopyRow({ label, value }: { label: string; value: string }) {
    const { t } = useTrans();
    const [, copy] = useClipboard();

    const copyValue = async () => {
        if (await copy(value)) {
            toast.success(t(':label copied.', { label }));

            return;
        }

        toast.error(t('Something went wrong. Please try again.'));
    };

    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-xs">
                    {value}
                </code>
                <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label={t('Copy :label', { label })}
                    onClick={() => void copyValue()}
                >
                    <Copy className="size-3.5" />
                </Button>
            </dd>
        </div>
    );
}
```

- [ ] **Step 6: Mount the section on the tracker cards**

In `resources/js/components/integrations/jira-integration.tsx` and `linear-integration.tsx`, import `StatusSyncSection` from `./status-sync-section` and render it as the last child of the connected card (after the `connection.status === 'active' && connection.access === 'write' && (…)` block):

```tsx
            {connection.status === 'active' && (
                <StatusSyncSection
                    scope={scope}
                    card={card}
                    connection={connection}
                />
            )}
```

(In `jira-integration.tsx` it goes inside the fragment that holds the People and Priorities panels, after that block.)

In `resources/js/pages/teams/integrations.tsx`, import `StatusSyncSection` and pass it to the Plan 14c cards:

```tsx
                        case 'jira_dc':
                            return (
                                <JiraDataCenterIntegration
                                    key={card.provider}
                                    card={card}
                                    scope={scope}
                                    statusSection={
                                        card.connection && (
                                            <StatusSyncSection
                                                scope={scope}
                                                card={card}
                                                connection={card.connection}
                                            />
                                        )
                                    }
                                />
                            );
```

and the same `statusSection` prop on `GitHubIntegration` (keep the other props Plan 14c passes).

- [ ] **Step 7: Poker status chip, missing flag and conflict**

Replace `resources/js/components/poker/task-source-chip.tsx`:

```tsx
import { CircleCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { TrackerLabels, type PokerTaskExternal } from '@/lib/poker/types';

export function TaskSourceChip({ external }: { external: PokerTaskExternal }) {
    const { t } = useTrans();

    return (
        <Badge variant="outline" className="shrink-0 gap-1 font-mono text-[11px]">
            {external.statusCategory === 'done' && (
                <CircleCheck
                    className="size-3 text-emerald-600"
                    aria-label={t('Done in :source', {
                        source: TrackerLabels[external.source],
                    })}
                />
            )}
            {external.key}
        </Badge>
    );
}
```

Create `resources/js/components/poker/estimate-conflict.tsx`:

```tsx
import { useState } from 'react';
import PokerEstimateConflictsController from '@/actions/App/Http/Controllers/Integrations/PokerEstimateConflictsController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { PokerEstimateConflict, PokerTask } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

type Props = {
    task: PokerTask;
    conflict: PokerEstimateConflict;
    source: string;
};

/**
 * Spec 8 §5.8: a diverging source estimate is flagged, never applied
 * silently; the facilitator decides.
 */
export function EstimateConflict({ task, conflict, source }: Props) {
    const { snapshot, apply, run } = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const notInDeck = t(':value is not in this deck.', {
        value: conflict.sourceEstimate,
    });

    const resolve = async (resolution: 'keepSkrum' | 'useSource') => {
        setBusy(true);

        try {
            const result = await run(
                retroRequest<PokerTask>(
                    PokerEstimateConflictsController.store({
                        game: snapshot.game.id,
                        task: task.id,
                    }),
                    { resolution },
                ),
            );

            if (result) {
                apply({ type: 'task.upsert', task: result });
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Badge
                variant="outline"
                className="border-amber-500 text-amber-700 dark:text-amber-400"
            >
                {t('Changed in :source to :value', {
                    source,
                    value: conflict.sourceEstimate,
                })}
            </Badge>
            {snapshot.me.isFacilitator && (
                <>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void resolve('keepSkrum')}
                    >
                        {t('Keep skrum estimate')}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || conflict.matchingCard === null}
                        title={
                            conflict.matchingCard === null
                                ? notInDeck
                                : undefined
                        }
                        onClick={() => void resolve('useSource')}
                    >
                        {t('Use :source estimate', { source })}
                    </Button>
                    {conflict.matchingCard === null && (
                        <span className="text-xs text-muted-foreground">
                            {notInDeck}
                        </span>
                    )}
                </>
            )}
        </div>
    );
}
```

In `resources/js/components/poker/task-source-details.tsx`, import `EstimateConflict` from `./estimate-conflict`; in the first flex row, after `<SyncBadge external={external} source={source} />`, add:

```tsx
                {external.statusCategory === 'done' && (
                    <Badge variant="secondary">
                        {t('Done in :source', { source })}
                    </Badge>
                )}
                {external.statusCategory !== 'done' && external.status && (
                    <Badge variant="outline">
                        {t(':status in :source', {
                            status: external.status,
                            source,
                        })}
                    </Badge>
                )}
                {external.missing && (
                    <Badge variant="destructive">
                        {t('Not found in :source', { source })}
                    </Badge>
                )}
```

and after that row's closing `</div>`:

```tsx
            {external.estimateConflict && (
                <EstimateConflict
                    task={task}
                    conflict={external.estimateConflict}
                    source={source}
                />
            )}
```

- [ ] **Step 8: Add the translations**

Add only the keys still missing at execution time (`Sync pending`, `Sync requested.`, `Something went wrong.`, `Something went wrong. Please try again.`, `Done` exist already).

| Key (en) | fr | es | de |
|---|---|---|---|
| `Not done` | `Pas terminé` | `Sin terminar` | `Nicht erledigt` |
| `:status in :source` | `:status dans :source` | `:status en :source` | `:status in :source` |
| `:status in :source · synced :time` | `:status dans :source · synchronisé :time` | `:status en :source · sincronizado :time` | `:status in :source · synchronisiert :time` |
| `Sync failed: :error` | `Échec de la synchronisation : :error` | `Error de sincronización: :error` | `Synchronisierung fehlgeschlagen: :error` |
| `Not found in :source` | `Introuvable dans :source` | `No encontrado en :source` | `In :source nicht gefunden` |
| `Retry the sync of :key` | `Relancer la synchronisation de :key` | `Reintentar la sincronización de :key` | `Synchronisierung von :key erneut versuchen` |
| `Completed in :source` | `Terminée dans :source` | `Completada en :source` | `In :source erledigt` |
| `Status sync` | `Synchronisation des statuts` | `Sincronización de estados` | `Statussynchronisierung` |
| `Completing an action item moves its :provider issue to done, and closing the issue completes the item. Imported poker tasks follow their issue.` | `Terminer une action passe son ticket :provider à l’état terminé, et fermer le ticket termine l’action. Les tâches de poker importées suivent leur ticket.` | `Completar una acción pasa su incidencia de :provider a terminada, y cerrar la incidencia completa la acción. Las tareas de póker importadas siguen a su incidencia.` | `Wenn du einen Aktionspunkt erledigst, wird sein :provider-Issue erledigt, und wenn das Issue geschlossen wird, ist der Aktionspunkt erledigt. Importierte Poker-Aufgaben folgen ihrem Issue.` |
| `Sync status` | `Synchroniser les statuts` | `Sincronizar estados` | `Status synchronisieren` |
| `Status sync is on.` | `La synchronisation des statuts est activée.` | `La sincronización de estados está activada.` | `Die Statussynchronisierung ist aktiv.` |
| `Status sync is off.` | `La synchronisation des statuts est désactivée.` | `La sincronización de estados está desactivada.` | `Die Statussynchronisierung ist aus.` |
| `Webhooks aren't reaching skrum; checking every :n minutes.` | `Les webhooks n’atteignent pas skrum ; vérification toutes les :n minutes.` | `Los webhooks no llegan a skrum; se comprueba cada :n minutos.` | `Webhooks erreichen skrum nicht; Prüfung alle :n Minuten.` |
| `Live updates (webhooks)` | `Mises à jour en direct (webhooks)` | `Actualizaciones en directo (webhooks)` | `Live-Aktualisierungen (Webhooks)` |
| `Checking every :n minutes.` | `Vérification toutes les :n minutes.` | `Se comprueba cada :n minutos.` | `Prüfung alle :n Minuten.` |
| `Last sync: :time` | `Dernière synchronisation : :time` | `Última sincronización: :time` | `Letzte Synchronisierung: :time` |
| `Reconnect :provider to receive live updates.` | `Reconnectez :provider pour recevoir les mises à jour en direct.` | `Vuelve a conectar :provider para recibir actualizaciones en directo.` | `Verbinde :provider neu, um Live-Aktualisierungen zu erhalten.` |
| `Treat canceled as done` | `Considérer les annulés comme terminés` | `Tratar los cancelados como terminados` | `Abgebrochene als erledigt behandeln` |
| `Status sync setting saved.` | `Réglage de synchronisation enregistré.` | `Ajuste de sincronización guardado.` | `Synchronisierungseinstellung gespeichert.` |
| `Status mapping` | `Correspondance des statuts` | `Asignación de estados` | `Statuszuordnung` |
| `Automatic uses the done statuses of each workflow. Choose other statuses per project or team if yours differ.` | `Automatique utilise les statuts terminés de chaque workflow. Choisissez d’autres statuts par projet ou équipe si les vôtres diffèrent.` | `Automático usa los estados terminados de cada flujo. Elige otros estados por proyecto o equipo si los tuyos son distintos.` | `Automatisch nutzt die Erledigt-Status jedes Workflows. Wähle andere Status pro Projekt oder Team, wenn deine abweichen.` |
| `Export an action item or import a task to map its statuses.` | `Exportez une action ou importez une tâche pour faire correspondre ses statuts.` | `Exporta una acción o importa una tarea para asignar sus estados.` | `Exportiere einen Aktionspunkt oder importiere eine Aufgabe, um ihre Status zuzuordnen.` |
| `Status mapping saved.` | `Correspondance des statuts enregistrée.` | `Asignación de estados guardada.` | `Statuszuordnung gespeichert.` |
| `Automatic` | `Automatique` | `Automático` | `Automatisch` |
| `Edit mapping` | `Modifier la correspondance` | `Editar asignación` | `Zuordnung bearbeiten` |
| `Counts as done` | `Compte comme terminé` | `Cuenta como terminado` | `Zählt als erledigt` |
| `Complete to` | `Terminer vers` | `Completar a` | `Erledigen nach` |
| `Reopen to` | `Rouvrir vers` | `Reabrir a` | `Wieder öffnen nach` |
| `skrum now waits for the first event.` | `skrum attend maintenant le premier événement.` | `skrum espera ahora el primer evento.` | `skrum wartet jetzt auf das erste Ereignis.` |
| `Only a Jira administrator can register the webhook. Ask one to add it in Jira (System → WebHooks) with these details.` | `Seul un administrateur Jira peut enregistrer le webhook. Demandez-lui de l’ajouter dans Jira (Système → WebHooks) avec ces informations.` | `Solo un administrador de Jira puede registrar el webhook. Pide a uno que lo añada en Jira (Sistema → WebHooks) con estos datos.` | `Nur ein Jira-Administrator kann den Webhook registrieren. Bitte eine Person mit diesem Recht, ihn in Jira (System → WebHooks) mit diesen Angaben anzulegen.` |
| `Show webhook details` | `Afficher les informations du webhook` | `Mostrar los datos del webhook` | `Webhook-Angaben anzeigen` |
| `Webhook URL` | `URL du webhook` | `URL del webhook` | `Webhook-URL` |
| `Events` | `Événements` | `Eventos` | `Ereignisse` |
| `JQL filter` | `Filtre JQL` | `Filtro JQL` | `JQL-Filter` |
| `Secret (for Jira versions that sign)` | `Secret (pour les versions de Jira qui signent)` | `Secreto (para las versiones de Jira que firman)` | `Secret (für Jira-Versionen, die signieren)` |
| `I've registered it` | `Je l’ai enregistré` | `Ya lo he registrado` | `Ich habe ihn registriert` |
| `:label copied.` | `:label copié.` | `:label copiado.` | `:label kopiert.` |
| `Copy :label` | `Copier :label` | `Copiar :label` | `:label kopieren` |
| `Done in :source` | `Terminé dans :source` | `Terminado en :source` | `In :source erledigt` |
| `Changed in :source to :value` | `Modifié dans :source en :value` | `Cambiado en :source a :value` | `In :source auf :value geändert` |
| `Keep skrum estimate` | `Garder l’estimation skrum` | `Mantener la estimación de skrum` | `skrum-Schätzung behalten` |
| `Use :source estimate` | `Utiliser l’estimation de :source` | `Usar la estimación de :source` | `:source-Schätzung übernehmen` |

- [ ] **Step 9: Verify**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check` (pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`), `npx vp check --fix <touched files>`, then `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`.
Expected: no new type or lint error; PASS.

- [ ] **Step 10: Commit**

```bash
git add resources/js/types/integrations.ts resources/js/lib/retro/types.ts resources/js/lib/retro/board-reducer.ts resources/js/pages/action-items/index.tsx resources/js/lib/poker/types.ts resources/js/lib/action-items/endpoints.ts resources/js/components/action-items/external-link-chips.tsx resources/js/components/action-items/action-item-card.tsx resources/js/components/integrations/status-sync-section.tsx resources/js/components/integrations/status-mapping-panel.tsx resources/js/components/integrations/jira-data-center-webhook-panel.tsx resources/js/components/integrations/jira-integration.tsx resources/js/components/integrations/linear-integration.tsx resources/js/pages/teams/integrations.tsx resources/js/components/poker/task-source-chip.tsx resources/js/components/poker/estimate-conflict.tsx resources/js/components/poker/task-source-details.tsx lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): status sync controls, link sync chips and poker conflicts"
```

(Stage any other file the type checker made you touch for `completedVia`.)

---

### Task 12: Verification and spec alignment

- [ ] **Step 1: Run every check**

Run:

```bash
export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"
vendor/bin/sail artisan migrate:fresh --no-interaction
vendor/bin/sail artisan wayfinder:generate --with-form
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
vendor/bin/sail artisan test --compact --parallel --processes=4
npm run types:check && npm run check && npm run build
```

Expected: phpstan 0 errors; the whole suite green (rerun any "max_locks_per_transaction" setup failure without `--parallel`); only the known pre-existing lint findings in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`.

- [ ] **Step 2: Check secrets, loops and locks by search**

Run and read each hit:

```bash
grep -rn "webhookToken\|webhookSecret" app resources/js | grep -v "credential(\|readableCredentials\|TrackerWebhooks.php\|ReadInboundEvent.php"
grep -rn "Log::" app/Http/Controllers/Integrations/InboundWebhooksController.php app/Support/Integrations/Inbound
grep -rn "PushActionItemState::dispatch" app
grep -rn "lockForUpdate" app/Jobs/Integrations/PushActionItemState.php app/Actions/Integrations/ApplyIssueChanges.php app/Actions/Integrations/ApplyPokerTaskIssues.php
```

Expected: no token or secret outside credentials access, `TrackerWebhooks` and `ReadInboundEvent`; the one warning log carries no payload; pushes are dispatched only by the listener (origin `skrum`), `ApplyIssueChanges` (skrum won a conflict) and `RequestActionItemPush`; locks follow the order of the Global Constraints (item → links; game → tasks; link alone after the provider call).

- [ ] **Step 3: Align the spec**

Update `docs/superpowers/specs/2026-09-30-integrations-extended-design.md` with the amendments listed at the top of this plan:

- §3: `settings` bookkeeping keys (`statusSyncSince`, `webhookRegisteredAt`, `webhookProjects`, `webhookManual`); `statusMapping` keyed by project/team key; `action_items.completed_via_source` (amendment 7).
- §5.2: mapping keys, reopen and Linear messages (amendments 1, 11).
- §5.3: `manage:jira-webhook` scope, `rejected:` keys, 401 for unknown integrations, 40-character token route constraint, `routes/webhooks.php`, `installation_repositories` re-read, healthy = pending/active, silence measured from `last_inbound_at` / `webhookRegisteredAt` / `statusSyncSince` (amendments 2, 4, 5, 12, 14).
- §5.4: Jira issue-by-issue fallback; mapping changes trigger a full read (amendments 10, 13).
- §5.6: job semantics and the retry route parameter `{externalLink}` (amendments 6, 9).
- §5.8: `estimateConflict.matchingCard`, `SetPokerEstimate::fromSource()`, no conflict while pending/unsupported (amendment 8).
- §7: request fields `status_sync`, `treat_canceled_as_done`, `status_mapping` (one container); `GET {integration}/statuses` responses; `GET {integration}/webhook` (details, Owners/Admins, `no-store`); `externalLinks[].id`; `completedVia`; page props `inboundHint`, `pollMinutes`; link `syncState` rules (amendments 1, 3, 6, 7, 15).
- §9: the manual webhook panel fetches its details on demand; workspace page link states refresh on load (amendments 3, 16).
- §11: the added 409 messages (amendment 11).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-30-integrations-extended-design.md
git commit -m "docs(integrations): align the extended integrations spec with status sync"
```

- [ ] **Step 5: Walkthrough (for the user; not automatable here)**

With a public `APP_URL` and each provider's webhook set up (`.env.example`): turn on "Sync status" for Jira Cloud (reconnect first so the webhook scope is granted), export an action item, close the issue in Jira → the item completes within seconds with "Completed in Jira"; complete another item in skrum → its issue moves to Done (with a required resolution screen, "Done"/"Fixed" is filled); reopen both ways; complete in skrum and close in Jira within the same minute to see the newer change win. Map a custom done status and reopen target. Repeat on Linear (canceled issue with and without "Treat canceled as done") and GitHub (close as not planned). On Jira Data Center with an administrator token the webhook registers itself; with a non-admin account the card shows the manual panel — register it in Jira and click "I've registered it". Import a sprint into a running poker game, change an issue's status and story points in the source: the task shows "In progress in Jira", then the "Changed in Jira to 8" badge; try both resolutions and a value missing from the deck. Set `INTEGRATIONS_INBOUND_WEBHOOKS=off`: cards say "Checking every 5 minutes." and changes arrive by polling. Uninstall the GitHub App: the card asks for a reconnect.

---

## Self-review

- **Spec coverage:** §5.1 → Tasks 3, 8 (switch, sync-on full read with source winning, read-only stops pushes); §5.2 → Tasks 1, 2, 8 (done mapping, transitions, resolution, messages, mapping editor); §5.3 → Tasks 6, 7 (routes, verification, keys, rejected rows, registration/refresh/delete, health); §5.4 → Task 5 (due-ness, tracked set, incremental/full reads, 429, reconnect); §5.5 → Task 4 (link fields, equal-state no-op, system actor, locked boards, missing); §5.6 → Task 3 (listener, job, retry endpoints); §5.7 → Tasks 4, 10 (automatic refresh, `task.saved`/`game.changed`, chips); §5.8 → Tasks 4, 10 (decision 2, estimate conflict and both resolutions); §5.9 → Tasks 3, 4, 6 (origin, equal-state, unique jobs, keys); §6 → Tasks 3, 7, 8, 10 (Owners/Admins, managers, facilitator, guests 403 first); §7 → Tasks 6–10; §7.1 → Tasks 8, 10; §9 → Task 11; §10 → Tasks 3, 5, 6, 7; §11 → Tasks 3, 6, 7, 10; §13 Inbound/Polling/Status sync/Poker sync → the ten test files; §14 criteria 5–7 → Tasks 3–7, 10.
- **Placeholders:** none; every step has the code or the exact edit anchor.
- **Type consistency:** `TrackerIssue::$issueStatus`, `IssueStatus::{id,name,kind,container,updatedAt}`, `DoneMapping::{state,category}`, `SyncsIssueStatus::{changedIssues,statuses,transition}`, `ApplyIssueChanges::handle(…, bool $complete, bool $sourceWins)`, `ReadTrackedIssues($id, $full, $initial)`, `ApplyInboundIssueChanges($id, $ids, $eventId)`, `PushActionItemState($linkId)`, `RegisterTrackerWebhooks($id)`, `RemoveTrackerWebhooks($id, $ids)`, `LinkStatusSync::{integration,state}`, `PokerTaskSync::{syncMode,estimateConflict,matchingCard}` are used with the same names and signatures in every task and test.
