# Plan 14c — Integrations extended: Jira Server/Data Center and GitHub Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Workspace Owners/Admins connect a team to one Jira Server/Data Center server (OAuth 2.0 application link with PKCE, or a pasted personal access token as fallback) and to one GitHub App installation; players import Jira DC and GitHub issues into planning poker (containers, iterations, search, refresh), estimates are written back (Jira DC story points; GitHub into one managed `<!-- skrum:estimate -->` block of the issue body, every deck), action items are exported with assignee mapping (Jira DC by email, GitHub by SSO link or manually) and priority mapping (Jira DC priorities, GitHub labels), and the MCP tracker tools list and use both — with spec 6's behaviour unchanged for Jira Cloud and Linear, and nothing of status sync (Plan 14d) yet.

**Architecture:** `IntegrationProvider::Unreleased` is deleted, so both providers are enabled by their env alone. Every Jira call goes through a new `Jira\JiraApi` interface (`get/post/put`, `apiPath()` → `rest/api/3/…` or `rest/api/2/…`, `browseUrl()`), implemented by the existing `JiraClient` (Cloud) and a new `JiraDataCenter\JiraDataCenterClient` (one admin-trusted base URL, redirects off, OAuth tokens refreshed under `IntegrationTokens`' locks, or `Bearer` personal access token; a stored `serverKey` must match the configured server before any credential is sent). `Jira\JiraApis::for($integration)` picks the client, so story points detection, createmeta, priorities, export targets, export and accounts serve both. The Jira tracker becomes an abstract `JiraIssueTracker` with Cloud (`JiraTracker`: `search/jql`, ADF) and Data Center (`JiraDataCenterTracker`: `rest/api/2/search`, `WikiMarkupToMarkdown`) subclasses. OAuth grows PKCE: `OAuthState` stores a code verifier, `OAuthConnector::authorizationUrl()` receives the S256 challenge and `connect()` an `OAuthCallback` (`code`, `codeVerifier`, `installationId`). GitHub uses `GitHub\GitHubAppJwt` (RS256 with `openssl_sign`) and `GitHub\GitHubClient` (installation tokens cached 50 min encrypted under a lock, `api.github.com` only, validated path segments, rate limits mapped to `RateLimited`); `ConnectGitHub` accepts an installation only when `GET /user/installations` lists it for the person, then discards the user token. `GitHub\EstimateBlock` is a pure parser/rewriter of the managed body block; `GitHubTracker::writeEstimate()` runs read-modify-write with verification, at most 3 times. `IssueTracker::search()` gains an optional container (GitHub searches one repository). Export gains `ExportToGitHub` and a Data Center branch in `ExportToJira` (`MarkdownToWikiMarkup`, assignee `name`). `IntegrationUserAccounts` gains Data Center (username search) and GitHub (SSO via `social_accounts`, `matched_by = sso`; manual search in org members or repository collaborators). The frontend gains `JiraDataCenterIntegration` (OAuth + token dialog with the acting-as warning) and `GitHubIntegration` (installation, priority labels), and the import and export dialogs learn both sources.

**Tech Stack:** Laravel 13 (PHP 8.4, ext-openssl), PostgreSQL, Pest, Laravel HTTP client, Laravel MCP, Inertia v3 + React 19, Wayfinder, Tailwind 4, lucide (all installed).

**Spec:** `docs/superpowers/specs/2026-09-30-integrations-extended-design.md` — §2.1 (Jira DC and GitHub availability, `authMethods()`, redirect URIs), §2.2 rows Jira Data Center and GitHub Issues (all but status sync), §3 (settings of both, `external_key` room for `owner/repo#n`, `IntegrationUserMatch::Sso` use), §4.1 (both methods, API differences, check, disconnect — **not** "Inbound"), §4.2 (instance setup, connect, API auth, poker import, estimate write-back, export, assignee mapping, check — **not** "Status" and "Inbound"), §6 rows for Jira DC/GitHub connect/configure/PAT/import/export, §7 rows `GET {jira_dc|github}/connect`, `POST jira-dc/token`, `PATCH {integration}` (`priority_labels`), `GET /integrations/{jira-dc|github}/callback`, `imports/{source}/…` for `jira_dc|github`, "Payload and snapshot additions" (Jira DC `authMethod`, `authMethods`, `tokenOwner`, `tokenSavedAt`), §7.1 (all rows; `canSyncStatus`/`syncMode` read the columns 14d fills), §8.1 rows GitHub estimate write-back, Jira DC PAT, Jira DC/GitHub export, Jira DC email matching, GitHub, §8.3 PAT secrecy, §9 Integrations page cards Jira Data Center and GitHub, Import dialog, GitHub poker sync states, §10 row "GitHub estimate write-back", §11 GitHub callback, Jira DC PAT and GitHub estimate rows, §13 bullets Jira DC (all but webhook registration), GitHub (all but status), MCP, Secrets, Translations, §14 criteria 1 (Jira DC/GitHub part), 2 (all but status sync), 8 (tracker listing), 9 (PAT and tokens). **Plan 14d** owns §2.3 inbound modes, §4.1 "Inbound", §4.2 "Status" and "Inbound", §5, and the status parts of §7/§9/§13.

## Global Constraints

Plan 14a's Global Constraints apply unchanged (branch `feat/plan-14-integrations-extended` continued after Plans 14a and 14b, Sail commands, PostgreSQL tests, no new dependency, `ProviderHttp` for every call, `Http::preventStrayRequests()` in every integration test, secrets never serialized, authorize before validating, snake_case request fields, named throttles, translations in `lang/{en,fr,es,de}.json` appended before the closing `}` keeping existing values, Wayfinder `--with-form` after route changes, frontend checks, React conventions, PHP conventions, explicit staging, Conventional Commits with the attribution trailer of the model that writes the commit and the `Claude-Session` line). Additionally:

- Migration filenames use the prefix `2026_10_07_1002xx`; only `up()`.
- **Every id placed in a provider URL path is validated first**: Jira ids `^[A-Za-z0-9_-]+$` (issue ids/keys) or `^\d{1,20}\z` (projects, issue types, boards, sprints); GitHub repository ids and installation ids `^\d{1,20}\z`, issue/milestone numbers `^\d{1,10}\z`, owners `^[A-Za-z0-9-]{1,39}\z`, repository names `^[A-Za-z0-9._-]{1,100}\z` and never `.`/`..`; label names are `rawurlencode`d and never `.`/`..` (`rawurlencode` keeps `..`).
- **Jira DC**: only `config('services.jira_dc.base_url')` is ever called for Jira DC, with `->withoutRedirecting()`; a connection whose `settings.serverKey` differs from the configured server's key sends nothing and becomes `ReconnectRequired`. The personal access token is read only through `TeamIntegration::credential('personalAccessToken')` inside `JiraDataCenterClient`.
- **GitHub**: only `https://api.github.com` and `https://github.com/login/oauth/access_token` are called. The user token of the callback is a local variable and never stored, cached, logged or returned. Installation tokens live only in the cache, encrypted with `Crypt::encryptString`, key `github-installation-token:{installationId}`, 50 minutes, minted under `Cache::lock('github-installation-token:{id}:lock')`.
- Jobs keep `SyncTaskEstimate`'s guarantees (`ShouldBeUniqueUntilProcessing`, `WithoutOverlapping` per task, `maxExceptions`, `retryUntil`); the GitHub read-modify-write restarts happen inside one attempt.
- New Pest helper names (checked unique in `tests/` at plan time): `gitHubTestPrivateKey`, `jiraDataCenterUrl`, `jiraDataCenterCallback`, `fakeJiraDataCenterOAuth`, `jiraDataCenterIssue`, `fakeJiraDataCenterTrackerApi`, `postJiraDataCenterToken`, `fakeJiraDataCenterTokenCheck`, `fakeGitHubInstallationToken`, `fakeGitHubUserInstallations`, `gitHubIssue`, `gitHubRepository`, `fakeGitHubTrackerApi`, `gitHubCallback`, `fakeGitHubExport`, `gitHubCreatedIssuePayload`, `gitHubSyncTask`, `runGitHubSync`, `gitHubPatches`, `renderedEstimateBlock`; test constant `JiraDataCenterPastedToken`.

## Spec amendments made with this plan

Plan writing found these gaps; Task 12 updates the spec (§2.1, §3, §4.1, §4.2, §7, §7.1, §9, §11) to match:

1. **Release:** `IntegrationProvider::Unreleased` is deleted (14a amendment 2 ends here): Jira DC and GitHub are enabled by their env alone.
2. **PAT route is kebab-case:** `POST w/{workspace}/teams/{team}/integrations/jira-dc/token` (§4.1 wrote `jira-dc`, §7 `jira_dc`), name `teams.integrations.jiraDataCenterToken.store`, `throttle:10,1,jiraDataCenterTokens`. The connect route keeps the enum value (`…/integrations/jira_dc/connect`, `…/integrations/github/connect`).
3. **Jira DC site identity:** `settings.serverKey` = the first 40 hex characters of `sha256(rtrim(JIRA_DC_BASE_URL, '/'))` is the connection's `site()` and the `external_site` of imported tasks and exported links (the base URL can exceed the 100-character column); `settings.baseUrl` keeps the URL for display. A connection made for another base URL becomes `ReconnectRequired` ("skrum is now configured for another Jira server. Reconnect.") before any credential is sent.
4. **PAT turned off later:** a `pat` connection while `JIRA_DC_PERSONAL_TOKENS` is false becomes `ReconnectRequired` ("Personal access tokens are turned off on this skrum instance. Connect with OAuth.") before any call.
5. **Acting-as warning before saving** says "its owner"/"them" (the owner's name is only known once Jira validated the token); the connected card shows the named sentence of §4.1.
6. **`external_key` widened to 150 characters** on `poker_tasks` and `action_item_external_links` (GitHub keys are `owner/repo#n`, up to 39 + 1 + 100 + 11 characters).
7. **GitHub ids:** container id = repository id; iteration id = `{repositoryId}/{milestoneNumber}`; export target `repository_id` (digits). Query mode sends `container` (web) / `container_id` (MCP); user qualifiers `repo:`, `org:`, `user:` are removed from the text before `repo:{owner}/{repo} is:issue` is appended.
8. **GitHub assignee login** is re-read at export with `GET /user/{id}` (the mapping stores the numeric id, spec §3), so renamed accounts still work; a failed lookup exports unassigned with `assigneeRejected`.
9. **GitHub export body neutralizes mentions** (`@` followed by a zero-width space) so an action item cannot ping GitHub users or teams; Linear's body is unchanged.
10. **GitHub `priority_labels`** is validated as `{high, medium, low: string ≤ 50 | null}`, never `.`/`..`; the Priorities panel of GitHub is three text inputs (labels are free text in GitHub).
11. **MCP `poker.sources.list`** returns `canSyncStatus` (`settings.statusSync === true` and `Active`) and `syncMode` (`inbound_mode`) from Plan 14c on, so Plan 14d changes no MCP code; before 14d they are `false` / `'off'`.
12. **`?`/`☕` defence:** `EstimateBlock::apply()` throws for them and the tracker reports "This card is not an estimate." (unreachable through spec 4, kept as a guard).

## Review Focus

1. **Forged GitHub installations and token handling** — the callback accepts `installation_id` only when `/user/installations` lists it for the person; the user token is never stored; installation tokens are cached encrypted and minted under a lock; the JWT verifies with the app's public key. Pinned in Task 6 ("refuses an installation the person cannot see", "never stores the user token", "caches the installation token encrypted and reuses it", "signs a verifiable app JWT").
2. **The PAT is a secret that acts as a person** — encrypted (ciphertext ≠ token), only sent as `Bearer` to the configured server, absent from props/JSON/jobs, `acknowledged` required, 401 later → `ReconnectRequired` with the paste-a-new-one message, OAuth connect erases it, 404 when tokens are off, authorize before validate. Pinned in Task 3.
3. **The managed estimate block** never touches bytes outside itself, never duplicates, collapses copies, removes cleanly, escapes labels, writes any deck but never `?`/`☕`, and detects concurrent edits (3 attempts). Pinned in Task 7 (unit) and Task 8 ("rewrites only the managed block", "restarts when the description changed meanwhile", "gives up after three changed descriptions").
4. **Provider path safety** — every id in a Jira DC or GitHub URL path is validated (`..` refused), labels encoded. Pinned in Task 4 ("refuses unsafe ids"), Task 8 ("refuses unsafe GitHub references") and Task 9 ("never builds a label path from . or ..").
5. **Jira Cloud and Linear unchanged** — the `JiraIssueTracker` refactor, `JiraApi`, `OAuthConnector` change and `IssueTracker::search()` signature keep every spec 6 test green (`IssueTrackersTest`, `PokerImportTest`, `PokerEstimateSyncTest`, `ConnectJiraTest`, `ConnectLinearTest`, `ConnectSlackTest`, `ActionItemExportTest`, `ExportTargetsTest`, `PriorityMappingTest`, `UserMappingEndpointsTest`, `MatchIntegrationUsersTest`, `TrackerToolsTest`). Each task lists them in its run step.

## File map

Execution order on the branch: **14a → 14b → 14c → 14d**. Files marked ◆ are also edited by 14a, 14b or 14d; edit them by the anchors given (never by line numbers) and keep what the earlier plans added.

| Area | Files |
|---|---|
| Availability & identity | ◆ `app/Enums/IntegrationProvider.php`; ◆ `app/Models/TeamIntegration.php` (`site()`); `database/migrations/2026_10_07_100200_widen_external_keys_for_repository_issues.php`; ◆ `database/factories/TeamIntegrationFactory.php`; `database/factories/PokerTaskFactory.php`; ◆ `tests/Pest.php`; `app/Support/Integrations/JiraDataCenter/JiraDataCenterServer.php` |
| OAuth plumbing | `app/Support/Integrations/OAuthState.php`; `app/Actions/Integrations/{OAuthConnector,OAuthCallback,OAuthConnectors,ConnectSlack,ConnectJira,ConnectLinear}.php`; `app/Http/Controllers/Integrations/{IntegrationAuthorizationsController,IntegrationCallbacksController}.php`; ◆ `routes/web.php` |
| Jira DC | `app/Support/Integrations/Jira/{JiraApi,JiraApis}.php`; `app/Support/Integrations/Jira/JiraClient.php`; `app/Support/Integrations/JiraDataCenter/{JiraDataCenterClient,WikiMarkupToMarkdown,MarkdownToWikiMarkup}.php`; `app/Support/Integrations/IntegrationTokens.php`; `app/Actions/Integrations/{ConnectJiraDataCenter,ConnectJiraDataCenterToken}.php`; `app/Http/Controllers/Integrations/JiraDataCenterTokensController.php` |
| Trackers | `app/Support/Integrations/Trackers/{IssueTracker,JiraIssueTracker,JiraTracker,JiraDataCenterTracker,LinearTracker,GitHubTracker,Trackers}.php`; `app/Actions/Integrations/{PokerTaskSync,PreviewPokerImport,ImportPokerTasks,DetectJiraStoryPointFields}.php`; `app/Http/Controllers/Integrations/{PokerImportPreviewsController,JiraFieldDetectionsController}.php`; `app/Jobs/SyncTaskEstimate.php` (unchanged, covered by tests) |
| GitHub | `app/Support/Integrations/GitHub/{GitHubAppJwt,GitHubClient,EstimateBlock}.php`; `app/Actions/Integrations/{ConnectGitHub,ExportToGitHub}.php` |
| Export, accounts, priorities | `app/Actions/Integrations/{ExportActionItem,ExportActionItemRules,ActionItemExportGuard,ExportToJira,ListExportTargets,ListProviderPriorities,ResolveExportPriority,ResolveExportAssignee,PreviewActionItemExport,MatchIntegrationUserAccounts,IssueDraft}.php`; `app/Support/Integrations/Jira/JiraCreateMeta.php`; `app/Support/Integrations/IntegrationUserAccounts.php`; `app/Http/Controllers/Integrations/IntegrationTargetsController.php` |
| Connections | ◆ `app/Actions/Integrations/{CheckIntegration,UpdateTeamIntegration,PresentTeamIntegration}.php`; ◆ `app/Http/Controllers/Integrations/{IntegrationTestsController,TeamIntegrationsController}.php` |
| MCP | `app/Actions/Integrations/ListPokerSources.php`; `app/Mcp/Tools/Poker/{ListSources,ListIterations,ImportTasks}.php`; `app/Mcp/PokerTrackerSources.php` |
| Frontend | ◆ `resources/js/types/integrations.ts`; `resources/js/lib/poker/types.ts`; ◆ `resources/js/pages/teams/integrations.tsx`; ◆ `resources/js/components/integrations/integration-actions.tsx`; `resources/js/components/integrations/{jira-data-center-integration,jira-token-dialog,github-integration,github-priority-labels}.tsx`; `resources/js/components/integrations/{people-panel,priorities-panel}.tsx`; `resources/js/components/poker/{import-tasks-dialog,task-source-details}.tsx`; `resources/js/components/action-items/export-action-item-dialog.tsx` |
| Tests | new: `tests/Feature/Integrations/{ExtendedTrackersAvailabilityTest,ConnectJiraDataCenterTest,JiraDataCenterTokenTest,JiraDataCenterTrackerTest,JiraDataCenterExportTest,ConnectGitHubTest,GitHubTrackerTest,GitHubExportTest}.php`, `tests/Unit/Integrations/{WikiMarkupToMarkdownTest,MarkdownToWikiMarkupTest,EstimateBlockTest}.php`; updated: ◆ `tests/Feature/Integrations/IntegrationsExtendedAvailabilityTest.php`, `tests/Feature/Integrations/IssueTrackersTest.php`, `tests/Feature/Mcp/TrackerToolsTest.php` |
| Translations | ◆ `lang/{en,fr,es,de}.json` (rows inside each task) |
| Spec | ◆ `docs/superpowers/specs/2026-09-30-integrations-extended-design.md` (Task 12) |

## Contract for Plan 14d

Plan 14d (two-way status sync) builds on exactly these names:

- **Providers:** `IntegrationProvider::JiraDataCenter` and `::GitHub` are enabled by env; no `Unreleased` list exists.
- **Site identity:** `TeamIntegration::site()` is `settings.serverKey` (Jira DC) and `settings.installationId` (GitHub, a digit string). GitHub inbound events route by `TeamIntegration::query()->where('provider', 'github')->where('settings->installationId', (string) $installationId)`. `JiraDataCenterServer::key()` / `::url(string $path)` / `::baseUrl()`.
- **Jira clients:** `Jira\JiraApi` (`get`, `post`, `put`, `apiPath(string $resource): string`, `browseUrl(TeamIntegration, string $key): string`), resolved with `app(Jira\JiraApis::class)->for($integration)`; transitions and statuses are `apiPath("issue/{$id}/transitions")`, `apiPath("project/{$id}/statuses")`. `JiraDataCenterClient::get($integration, 'rest/api/2/mypermissions', ['permissions' => 'ADMINISTER'])` is how 14d decides webhook registration; `JiraDataCenterClient` exposes `post()` for `rest/webhooks/1.0/webhook` (absolute `rest/…` paths are accepted).
- **Trackers:** `IssueTracker::search(TeamIntegration, string $query, ?string $containerId = null)`. `JiraIssueTracker::requestedFields(TeamIntegration): array` (protected) is where 14d adds `updated`; `JiraIssueTracker::issue()` and `GitHubTracker::issue()` (protected) are where 14d fills its new `TrackerIssue` fields (status category, updated time) from `fields.status.statusCategory.key` / `fields.updated` and `state` / `state_reason` / `updated_at`. `GitHubTracker::issueReference(string $externalId): ?array{0: string, 1: string}` (public static) parses `{repositoryId}/{number}`; `GitHubTracker::fullName(array $issue): ?string` (public static) reads a validated `owner/repo` from `repository_url`.
- **GitHub client:** `GitHubClient::get/post/patch(TeamIntegration, string $path, array $data = [])`, `::response(TeamIntegration, string $method, string $path, array $data = []): Response`, `::installation(TeamIntegration): array` (app JWT; 14d adds an app-level helper next to it if it needs other `app/…` endpoints), `::forgetInstallationToken(string $installationId): void` (14d calls it on `installation` `deleted`/`suspend`), `::repositoryName(TeamIntegration, string $repositoryId): string`. `GitHubAppJwt::token(): string`.
- **Settings keys (reserved, untouched by 14c):** `statusSync`, `treatCanceledAsDone`, `statusMapping`, `webhookIds` — 14c never writes them; `ConnectJiraDataCenter`, `ConnectJiraDataCenterToken` and `ConnectGitHub` keep every existing setting of the same server/installation, so 14d's settings survive a reconnect.
- **Connections:** `UpdateTeamIntegration::rules()` has a `IntegrationProvider::JiraDataCenter` arm (story points, priority map) and a `IntegrationProvider::GitHub` arm (`priority_labels`) — 14d appends its keys to both. `CheckIntegration` arms: Jira DC `rest/api/2/myself`, GitHub `GitHubClient::installation()` (uninstalled/suspended → `ReconnectRequired`) — 14d's daily full read runs after them. `PresentTeamIntegration::settings()` (private) builds the settings array; 14d adds its top-level keys next to `'settings'`.
- **MCP:** `ListPokerSources` already returns `canSyncStatus` and `syncMode`; `App\Mcp\PokerTrackerSources::Values` (`['jira', 'jira_dc', 'linear', 'github']`) is the enum of every tracker tool.
- **Poker:** `PokerTaskSync::writesAnyDeck(IntegrationProvider): bool` (GitHub true) and `IntegrationProvider`-aware `storyPointsReason()`; `external_missing_at` is not written by 14c (14d persists "Not found").
- **Frontend:** `PokerTrackerSource` = `'jira' | 'linear' | 'jira_dc' | 'github'`, `TrackerLabels` has all four; `TrackerProviderKey` the same four; `UserMapping.matchedBy` includes `'sso'`; `JiraDataCenterIntegration` and `GitHubIntegration` render `children` slots after the details, where 14d mounts its Status sync section (`statusSection?: ReactNode` prop, rendered only when connected and active).

---

### Task 1: Release Jira Data Center and GitHub, identify their sites

**Files:**
- Create: `app/Support/Integrations/JiraDataCenter/JiraDataCenterServer.php`, `database/migrations/2026_10_07_100200_widen_external_keys_for_repository_issues.php` (with `vendor/bin/sail artisan make:migration widen_external_keys_for_repository_issues --no-interaction`, renamed to the fixed prefix)
- Modify: `app/Enums/IntegrationProvider.php`, `app/Models/TeamIntegration.php`, `database/factories/TeamIntegrationFactory.php`, `database/factories/PokerTaskFactory.php`, `tests/Pest.php`, `tests/Feature/Integrations/IntegrationsExtendedAvailabilityTest.php`
- Test: create `tests/Feature/Integrations/ExtendedTrackersAvailabilityTest.php`

**Interfaces:**
- Consumes: 14a's `IntegrationProvider::isConfigured()`, `Unreleased`, `enableIntegrations()`/`disableIntegrations()`; `TeamIntegration::site()`; `PokerTaskFactory::imported()`; `trackerTable()`, `importedPokerTask()`.
- Produces: `JiraDataCenterServer::{baseUrl, key, url}`; `site()` for both providers; factory states `jiraDataCenter(IntegrationAccess $access = Write, string $authMethod = 'oauth')`, `gitHub(IntegrationAccess $access = Write)` and constants `TeamIntegrationFactory::JiraDataCenterUrl`, `::JiraDataCenterToken`, `::GitHubInstallationId`; `imported()` for `jira_dc`/`github`; Pest helpers `gitHubTestPrivateKey()`, `jiraDataCenterUrl()`; `trackerTable()`/`importedPokerTask()` for the four trackers; `external_key` 150 characters.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/ExtendedTrackersAvailabilityTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Models\ActionItemExternalLink;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('enables Jira Data Center and GitHub from their env alone', function () {
    disableIntegrations();

    expect(IntegrationProvider::enabled())->toBe([]);

    enableIntegrations(IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub);

    expect(IntegrationProvider::enabled())->toBe([IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub])
        ->and(IntegrationProvider::JiraDataCenter->isTracker())->toBeTrue()
        ->and(IntegrationProvider::GitHub->isTracker())->toBeTrue();
});

it('identifies the Jira server and the GitHub installation of a connection', function () {
    enableIntegrations(IntegrationProvider::JiraDataCenter);
    $jira = TeamIntegration::factory()->jiraDataCenter()->create();
    $gitHub = TeamIntegration::factory()->gitHub()->create();

    expect($jira->site())->toBe(JiraDataCenterServer::key())
        ->and(JiraDataCenterServer::key())->toHaveLength(40)
        ->and(JiraDataCenterServer::key(TeamIntegrationFactory::JiraDataCenterUrl.'/'))->toBe(JiraDataCenterServer::key())
        ->and(JiraDataCenterServer::key('https://other.example.com'))->not->toBe(JiraDataCenterServer::key())
        ->and(JiraDataCenterServer::url('/rest/api/2/myself'))->toBe('https://jira.example.com/rest/api/2/myself')
        ->and($gitHub->site())->toBe(TeamIntegrationFactory::GitHubInstallationId);
});

it('stores GitHub issue keys longer than Jira keys', function () {
    $key = str_repeat('o', 39).'/'.str_repeat('r', 100).'#1234567';
    $task = PokerTask::factory()->imported(IntegrationProvider::GitHub, TeamIntegrationFactory::GitHubInstallationId)->create();
    $task->forceFill(['external_key' => $key])->save();
    $link = ActionItemExternalLink::factory()->create([
        'source' => IntegrationProvider::GitHub,
        'external_site' => TeamIntegrationFactory::GitHubInstallationId,
        'external_key' => $key,
    ]);

    expect($task->fresh()?->external_key)->toBe($key)
        ->and($link->fresh()?->external_key)->toBe($key)
        ->and($task->external_url)->toStartWith('https://github.com/acme/api/issues/');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ExtendedTrackersAvailabilityTest.php`
Expected: FAIL — `Class "App\Support\Integrations\JiraDataCenter\JiraDataCenterServer" not found` (and `Call to undefined method … jiraDataCenter()`).

- [ ] **Step 3: Release the providers**

In `app/Enums/IntegrationProvider.php`, delete the `Unreleased` constant with its docblock (after Plan 14b it lists `self::JiraDataCenter, self::GitHub`) and make `isEnabled()`:

```php
    public function isEnabled(): bool
    {
        return $this->isConfigured();
    }
```

In `tests/Feature/Integrations/IntegrationsExtendedAvailabilityTest.php`, replace the test that expects Jira Data Center and GitHub to stay hidden (14a named it `keeps Jira Data Center, GitHub and webhooks hidden until their plans ship`; Plan 14b may have renamed it after releasing webhooks) with:

```php
it('enables every extended provider from its env', function () {
    disableIntegrations();
    enableIntegrations(IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub, IntegrationProvider::Webhook);

    expect(IntegrationProvider::JiraDataCenter->isEnabled())->toBeTrue()
        ->and(IntegrationProvider::GitHub->isEnabled())->toBeTrue()
        ->and(IntegrationProvider::Webhook->isEnabled())->toBeTrue();
});
```

- [ ] **Step 4: Add the server identity**

Create `app/Support/Integrations/JiraDataCenter/JiraDataCenterServer.php`:

```php
<?php

namespace App\Support\Integrations\JiraDataCenter;

/**
 * The one Jira Server/Data Center of this instance (spec 8 §2.1). Its key
 * identifies the server in `site()` and in imported references: the base
 * URL itself may be longer than the `external_site` columns.
 */
class JiraDataCenterServer
{
    private const KeyLength = 40;

    public static function baseUrl(): string
    {
        return rtrim((string) config('services.jira_dc.base_url'), '/');
    }

    public static function key(?string $baseUrl = null): string
    {
        return substr(hash('sha256', rtrim($baseUrl ?? self::baseUrl(), '/')), 0, self::KeyLength);
    }

    public static function url(string $path): string
    {
        return self::baseUrl().'/'.ltrim($path, '/');
    }
}
```

In `app/Models/TeamIntegration.php`, extend the `match` of `site()`:

```php
        $site = match ($this->provider) {
            IntegrationProvider::Jira => $this->setting('cloudId'),
            IntegrationProvider::Linear => $this->setting('organizationId'),
            IntegrationProvider::JiraDataCenter => $this->setting('serverKey'),
            IntegrationProvider::GitHub => $this->setting('installationId'),
            default => null,
        };
```

- [ ] **Step 5: Widen the external keys**

`database/migrations/2026_10_07_100200_widen_external_keys_for_repository_issues.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * GitHub issue keys are `owner/repo#number` (spec 8 §4.2).
     */
    public function up(): void
    {
        Schema::table('poker_tasks', function (Blueprint $table) {
            $table->string('external_key', 150)->nullable()->change();
        });

        Schema::table('action_item_external_links', function (Blueprint $table) {
            $table->string('external_key', 150)->change();
        });
    }
};
```

- [ ] **Step 6: Add the factory states and fixtures**

In `database/factories/TeamIntegrationFactory.php`, add `use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;`, the constants next to 14a's and 14b's:

```php
    public const JiraDataCenterUrl = 'https://jira.example.com';

    public const JiraDataCenterToken = 'jira-dc-personal-token-0123456789';

    public const GitHubInstallationId = '4242';
```

and the states after `linear()`:

```php
    public function jiraDataCenter(IntegrationAccess $access = IntegrationAccess::Write, string $authMethod = 'oauth'): static
    {
        $usesToken = $authMethod === 'pat';

        return $this->state(fn () => [
            'provider' => IntegrationProvider::JiraDataCenter,
            'status' => IntegrationStatus::Active,
            'access' => $access,
            'credentials' => $usesToken
                ? ['personalAccessToken' => self::JiraDataCenterToken]
                : ['access_token' => 'jira-dc-access', 'refresh_token' => 'jira-dc-refresh', 'expires_at' => now()->addHour()->getTimestamp()],
            'settings' => [
                'authMethod' => $authMethod,
                'serverKey' => JiraDataCenterServer::key(self::JiraDataCenterUrl),
                'baseUrl' => self::JiraDataCenterUrl,
                'serverTitle' => 'Acme Jira',
                'version' => '9.12.2',
                'storyPointFields' => [['id' => 'customfield_10002', 'name' => 'Story Points']],
                'numberFields' => [['id' => 'customfield_10002', 'name' => 'Story Points']],
                ...($usesToken ? [
                    'tokenOwner' => ['name' => 'jdoe', 'displayName' => 'Jane Doe'],
                    'tokenSavedAt' => '2026-10-01T09:00:00+00:00',
                ] : []),
            ],
            'scopes' => $usesToken ? [] : [$access === IntegrationAccess::Write ? 'WRITE' : 'READ'],
        ]);
    }

    public function gitHub(IntegrationAccess $access = IntegrationAccess::Write): static
    {
        return $this->state(fn () => [
            'provider' => IntegrationProvider::GitHub,
            'status' => IntegrationStatus::Active,
            'access' => $access,
            'credentials' => [],
            'settings' => ['installationId' => self::GitHubInstallationId, 'accountLogin' => 'acme', 'accountType' => 'Organization'],
            'scopes' => [],
        ]);
    }
```

In `database/factories/PokerTaskFactory.php`, replace `imported()` with:

```php
    public function imported(IntegrationProvider $source = IntegrationProvider::Jira, string $site = 'cloud-1'): static
    {
        return $this->state(function () use ($source, $site) {
            $number = fake()->unique()->numberBetween(1, 99999);

            [$id, $key, $url] = match ($source) {
                IntegrationProvider::Linear => [fake()->uuid(), "ENG-{$number}", "https://linear.app/acme/issue/ENG-{$number}"],
                IntegrationProvider::JiraDataCenter => [(string) (10000 + $number), "PROJ-{$number}", "https://jira.example.com/browse/PROJ-{$number}"],
                IntegrationProvider::GitHub => ["9001/{$number}", "acme/api#{$number}", "https://github.com/acme/api/issues/{$number}"],
                default => [(string) (10000 + $number), "PROJ-{$number}", "https://acme.atlassian.net/browse/PROJ-{$number}"],
            };

            return [
                'external_source' => $source->value,
                'external_id' => $id,
                'external_url' => $url,
                'external_site' => $site,
                'external_key' => $key,
                'external_refreshed_at' => now(),
            ];
        });
    }
```

- [ ] **Step 7: Extend the Pest helpers**

In `tests/Pest.php`:

1. In `enableIntegrations()`, change the GitHub arm's key to `'services.github_app.private_key' => gitHubTestPrivateKey(),`.
2. Replace the factory line of `trackerTable()` and the site of `importedPokerTask()`:

```php
    $integration = match ($source) {
        IntegrationProvider::Linear => $factory->linear($access),
        IntegrationProvider::JiraDataCenter => $factory->jiraDataCenter($access),
        IntegrationProvider::GitHub => $factory->gitHub($access),
        default => $factory->jira($access),
    }->create(['team_id' => $game->team_id]);
```

```php
    $site = match ($source) {
        IntegrationProvider::Linear => 'org-1',
        IntegrationProvider::JiraDataCenter => JiraDataCenterServer::key(TeamIntegrationFactory::JiraDataCenterUrl),
        IntegrationProvider::GitHub => TeamIntegrationFactory::GitHubInstallationId,
        default => 'cloud-1',
    };

    $task = PokerTask::factory()
        ->imported($source, $site)
        ->create(['poker_game_id' => $game->id]);
```

3. Add at the end (with `use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;` and `use Database\Factories\TeamIntegrationFactory;` at the top):

```php
/**
 * A real RSA key, generated once per process, so GitHub App JWTs can be
 * signed and verified in tests.
 */
function gitHubTestPrivateKey(): string
{
    static $pem = null;

    if (is_string($pem)) {
        return $pem;
    }

    $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);

    if ($key === false || ! openssl_pkey_export($key, $exported)) {
        throw new RuntimeException('Could not create the GitHub test key.');
    }

    return $pem = $exported;
}

function jiraDataCenterUrl(string $path): string
{
    return 'jira.example.com/'.ltrim($path, '/');
}
```

- [ ] **Step 8: Migrate and run the tests**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Integrations/ExtendedTrackersAvailabilityTest.php tests/Feature/Integrations/IntegrationsExtendedAvailabilityTest.php tests/Feature/Integrations/IntegrationModelsTest.php tests/Feature/Integrations/PokerImportTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS. Then `vendor/bin/sail bin pint --dirty --format agent` and `vendor/bin/sail bin phpstan analyse --no-progress` (0 errors).

- [ ] **Step 9: Commit**

```bash
git add app/Enums/IntegrationProvider.php app/Models/TeamIntegration.php app/Support/Integrations/JiraDataCenter/JiraDataCenterServer.php database/migrations/2026_10_07_100200_widen_external_keys_for_repository_issues.php database/factories/TeamIntegrationFactory.php database/factories/PokerTaskFactory.php tests/Pest.php tests/Feature/Integrations/ExtendedTrackersAvailabilityTest.php tests/Feature/Integrations/IntegrationsExtendedAvailabilityTest.php
git commit -m "feat(integrations): release Jira Data Center and GitHub and identify their sites

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 2: Jira Data Center client and OAuth 2.0 with PKCE

**Files:**
- Create: `app/Support/Integrations/Jira/JiraApi.php`, `app/Support/Integrations/Jira/JiraApis.php`, `app/Support/Integrations/JiraDataCenter/JiraDataCenterClient.php`, `app/Actions/Integrations/OAuthCallback.php`, `app/Actions/Integrations/ConnectJiraDataCenter.php`
- Modify: `app/Support/Integrations/Jira/JiraClient.php`, `app/Support/Integrations/IntegrationTokens.php`, `app/Support/Integrations/OAuthState.php`, `app/Actions/Integrations/{OAuthConnector,OAuthConnectors,ConnectSlack,ConnectJira,ConnectLinear,ExportActionItem,CheckIntegration,DetectJiraStoryPointFields}.php`, `app/Http/Controllers/Integrations/{IntegrationAuthorizationsController,IntegrationCallbacksController,IntegrationTestsController}.php`, `routes/web.php`, `tests/Pest.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/ConnectJiraDataCenterTest.php`

**Interfaces:**
- Consumes: Task 1; `IntegrationTokens::{accessToken, refresh}` (cache + row lock), `OAuthTokens`, `ProviderHttp`, `SaveTeamIntegration`, `DetectJiraStoryPointFields::handleQuietly()`, `integrationOAuthSession()`.
- Produces: `JiraApi`, `JiraApis::for()`, `JiraDataCenterClient` (`AuthMethodOAuth = 'oauth'`, `AuthMethodToken = 'pat'`, `authorizationUrl`, `exchangeCode`, `refreshTokens`, `probe(string $token, string $path)`, `get/post/put`, `apiPath`, `browseUrl`), `IntegrationTokens::prepare()`, `OAuthState::{codeChallenge, challenge}` and `consume()['codeVerifier']`, `OAuthCallback`, the new `OAuthConnector` signatures, `ConnectJiraDataCenter::{keptSettings, serverSettings}`, route `integrations.jiraDataCenter.callback`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/ConnectJiraDataCenterTest.php`:

```php
<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use App\Support\Integrations\OAuthState;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::JiraDataCenter);
});

function fakeJiraDataCenterOAuth(): void
{
    Http::fake([
        jiraDataCenterUrl('rest/oauth2/latest/token') => Http::response([
            'access_token' => 'jira-dc-access-new',
            'refresh_token' => 'jira-dc-refresh-new',
            'expires_in' => 7200,
            'token_type' => 'bearer',
            'scope' => 'WRITE',
        ]),
        jiraDataCenterUrl('rest/api/2/serverInfo') => Http::response(['serverTitle' => 'Acme Jira', 'version' => '9.12.2', 'versionNumbers' => [9, 12, 2]]),
        jiraDataCenterUrl('rest/api/2/field') => Http::response([
            ['id' => 'customfield_10002', 'name' => 'Story Points', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.atlassian.jira.plugin.system.customfieldtypes:float']],
        ]),
        jiraDataCenterUrl('rest/api/2/myself') => Http::response(['name' => 'jdoe', 'displayName' => 'Jane Doe']),
    ]);
}

/**
 * @param  array<string, mixed>|null  $session
 */
function jiraDataCenterCallback(User $user, Team $team, IntegrationAccess $access = IntegrationAccess::Write, ?array $session = null): TestResponse
{
    return test()->actingAs($user)
        ->withSession($session ?? integrationOAuthSession($team, IntegrationProvider::JiraDataCenter, $access))
        ->get(route('integrations.jiraDataCenter.callback', ['code' => 'jira-dc-code', 'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu']));
}

it('asks Jira Data Center for read or write access with PKCE', function (string $access, string $scope) {
    $team = Team::factory()->create();

    $response = $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.connect', [$team->workspace, $team, 'jira_dc', 'access' => $access]));

    $location = (string) $response->headers->get('Location');
    parse_str((string) parse_url($location, PHP_URL_QUERY), $query);

    expect($location)->toStartWith('https://jira.example.com/rest/oauth2/latest/authorize?')
        ->and($query['scope'])->toBe($scope)
        ->and($query['client_id'])->toBe('jira-dc-client')
        ->and($query['redirect_uri'])->toEndWith('/integrations/jira-dc/callback')
        ->and($query['code_challenge_method'])->toBe('S256')
        ->and($query['code_challenge'])->toBe(OAuthState::challenge((string) session('integrations.oauth.codeVerifier')))
        ->and(session('integrations.oauth.codeVerifier'))->toHaveLength(64);
})->with([
    'read' => ['read', 'READ'],
    'write' => ['write', 'WRITE'],
]);

it('connects with OAuth and exchanges the code with its verifier', function () {
    fakeJiraDataCenterOAuth();
    $team = Team::factory()->create();

    jiraDataCenterCallback(integrationAdmin($team), $team)
        ->assertInertiaFlash('toast', ['type' => 'success', 'message' => 'Jira Data Center connected.']);

    $integration = TeamIntegration::query()->sole();

    expect($integration->provider)->toBe(IntegrationProvider::JiraDataCenter)
        ->and($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->access)->toBe(IntegrationAccess::Write)
        ->and($integration->credential('access_token'))->toBe('jira-dc-access-new')
        ->and($integration->site())->toBe(JiraDataCenterServer::key())
        ->and($integration->setting('authMethod'))->toBe('oauth')
        ->and($integration->setting('baseUrl'))->toBe('https://jira.example.com')
        ->and($integration->setting('serverTitle'))->toBe('Acme Jira')
        ->and($integration->setting('version'))->toBe('9.12.2')
        ->and($integration->setting('storyPointFields'))->toBe([['id' => 'customfield_10002', 'name' => 'Story Points']]);

    Http::assertSent(fn (Request $request) => $request->url() === 'https://jira.example.com/rest/oauth2/latest/token'
        && $request['grant_type'] === 'authorization_code'
        && $request['code'] === 'jira-dc-code'
        && $request['code_verifier'] === str_repeat('v', 64)
        && str_ends_with((string) $request['redirect_uri'], '/integrations/jira-dc/callback'));
    Http::assertSent(fn (Request $request) => $request->url() === 'https://jira.example.com/rest/api/2/serverInfo'
        && $request->hasHeader('Authorization', 'Bearer jira-dc-access-new'));
});

it('refuses a callback without a code verifier', function () {
    $team = Team::factory()->create();
    $session = integrationOAuthSession($team, IntegrationProvider::JiraDataCenter);
    unset($session[OAuthState::SessionKey]['codeVerifier']);

    jiraDataCenterCallback(integrationAdmin($team), $team, session: $session)
        ->assertInertiaFlash('toast', ['type' => 'error', 'message' => 'Could not connect Jira Data Center. Try again.']);

    expect(TeamIntegration::query()->count())->toBe(0);
    Http::assertNothingSent();
});

it('replaces a personal access token when connecting with OAuth', function () {
    fakeJiraDataCenterOAuth();
    $team = Team::factory()->create();
    $existing = TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Write, 'pat')->create(['team_id' => $team->id]);
    $existing->forceFill(['settings' => [...$existing->settings, 'priorityMap' => ['high' => null]]])->save();

    jiraDataCenterCallback(integrationAdmin($team), $team)->assertRedirect();

    $integration = $existing->fresh();

    expect($integration?->credential('personalAccessToken'))->toBeNull()
        ->and($integration?->credential('access_token'))->toBe('jira-dc-access-new')
        ->and($integration?->setting('authMethod'))->toBe('oauth')
        ->and($integration?->setting('tokenOwner'))->toBeNull()
        ->and($integration?->setting('tokenSavedAt'))->toBeNull()
        ->and($integration?->setting('priorityMap'))->toBe(['high' => null]);
});

it('refreshes an expiring Data Center token', function () {
    fakeJiraDataCenterOAuth();
    $integration = TeamIntegration::factory()->jiraDataCenter()->expiring()->create();

    app(JiraDataCenterClient::class)->get($integration, 'rest/api/2/myself');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://jira.example.com/rest/oauth2/latest/token'
        && $request['grant_type'] === 'refresh_token'
        && $request['refresh_token'] === 'jira-dc-refresh'
        && $request['client_secret'] === 'jira-dc-secret');
    Http::assertSent(fn (Request $request) => $request->url() === 'https://jira.example.com/rest/api/2/myself'
        && $request->hasHeader('Authorization', 'Bearer jira-dc-access-new'));
    expect($integration->fresh()?->credential('refresh_token'))->toBe('jira-dc-refresh-new');
});

it('never sends credentials to another Jira server than the configured one', function () {
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    config(['services.jira_dc.base_url' => 'https://jira.other.example.com']);

    expect(fn () => app(JiraDataCenterClient::class)->get($integration, 'rest/api/2/myself'))
        ->toThrow(ReconnectRequired::class);

    expect($integration->fresh()?->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()?->last_error)->toBe('skrum is now configured for another Jira server. Reconnect.');
    Http::assertNothingSent();
});

it('does not follow redirects from the Jira server', function () {
    Http::fake([jiraDataCenterUrl('rest/api/2/myself') => Http::response('', 302, ['Location' => 'https://evil.example.com/steal'])]);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();

    expect(fn () => app(JiraDataCenterClient::class)->get($integration, 'rest/api/2/myself'))
        ->toThrow(ProviderRejected::class);

    Http::assertSentCount(1);
});

it('offers OAuth only when it is configured, after authorizing', function () {
    config(['services.jira_dc.client_id' => null]);
    $team = Team::factory()->create();
    $url = route('teams.integrations.connect', [$team->workspace, $team, 'jira_dc']);

    $this->actingAs(teamMember($team))->get($url)->assertForbidden();
    $this->actingAs(integrationAdmin($team))->get($url)->assertNotFound();
});

it('checks a Data Center connection with its myself endpoint', function () {
    fakeJiraDataCenterOAuth();
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->jiraDataCenter()->create(['team_id' => $team->id]);

    $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertJsonPath('provider', 'jira_dc');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://jira.example.com/rest/api/2/myself'
        && $request->hasHeader('Authorization', 'Bearer jira-dc-access'));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ConnectJiraDataCenterTest.php`
Expected: FAIL — `Route [integrations.jiraDataCenter.callback] not defined.` and 404 on the connect route.

- [ ] **Step 3: One surface for both Jira APIs**

Create `app/Support/Integrations/Jira/JiraApi.php`:

```php
<?php

namespace App\Support\Integrations\Jira;

use App\Models\TeamIntegration;

/**
 * Jira Cloud (REST v3) and Jira Server/Data Center (REST v2) behind one
 * surface; token handling, reconnect states and error mapping stay in each
 * client.
 */
interface JiraApi
{
    /**
     * @param  array<string, mixed>  $query
     * @return array<array-key, mixed>
     */
    public function get(TeamIntegration $integration, string $path, array $query = []): array;

    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function post(TeamIntegration $integration, string $path, array $body = []): array;

    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function put(TeamIntegration $integration, string $path, array $body = []): array;

    /**
     * `rest/api/3/{resource}` on Cloud, `rest/api/2/{resource}` on Data Center.
     */
    public function apiPath(string $resource): string;

    public function browseUrl(TeamIntegration $integration, string $key): string;
}
```

Create `app/Support/Integrations/Jira/JiraApis.php`:

```php
<?php

namespace App\Support\Integrations\Jira;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use InvalidArgumentException;

class JiraApis
{
    public function for(TeamIntegration $integration): JiraApi
    {
        return match ($integration->provider) {
            IntegrationProvider::Jira => app(JiraClient::class),
            IntegrationProvider::JiraDataCenter => app(JiraDataCenterClient::class),
            default => throw new InvalidArgumentException("{$integration->provider->value} is not a Jira connection."),
        };
    }
}
```

In `app/Support/Integrations/Jira/JiraClient.php`: `class JiraClient implements JiraApi, RefreshesTokens`, and add after `put()`:

```php
    public function apiPath(string $resource): string
    {
        return 'rest/api/3/'.ltrim($resource, '/');
    }

    public function browseUrl(TeamIntegration $integration, string $key): string
    {
        return rtrim((string) $integration->setting('siteUrl', ''), '/')."/browse/{$key}";
    }
```

- [ ] **Step 4: Create the Data Center client**

Create `app/Support/Integrations/JiraDataCenter/JiraDataCenterClient.php`:

```php
<?php

namespace App\Support\Integrations\JiraDataCenter;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ConnectionRefused;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationTokens;
use App\Support\Integrations\Jira\JiraApi;
use App\Support\Integrations\OAuthTokens;
use App\Support\Integrations\ProviderHttp;
use App\Support\Integrations\RefreshesTokens;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;

/**
 * Jira Server/Data Center (spec 8 §4.1): REST v2 on the one admin-trusted
 * server, with OAuth 2.0 tokens or a personal access token. Redirects are
 * never followed and a connection made for another server sends nothing,
 * so a credential cannot reach another host.
 */
class JiraDataCenterClient implements JiraApi, RefreshesTokens
{
    public const AuthMethodOAuth = 'oauth';

    public const AuthMethodToken = 'pat';

    private const Provider = IntegrationProvider::JiraDataCenter;

    public function __construct(private IntegrationTokens $tokens) {}

    public function authorizationUrl(string $state, IntegrationAccess $access, string $codeChallenge): string
    {
        return JiraDataCenterServer::url('rest/oauth2/latest/authorize').'?'.http_build_query([
            'client_id' => (string) config('services.jira_dc.client_id'),
            'redirect_uri' => (string) config('services.jira_dc.redirect'),
            'response_type' => 'code',
            'scope' => $access === IntegrationAccess::Write ? 'WRITE' : 'READ',
            'state' => $state,
            'code_challenge' => $codeChallenge,
            'code_challenge_method' => 'S256',
        ], '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}
     */
    public function exchangeCode(string $code, string $codeVerifier): array
    {
        return $this->tokenRequest(['grant_type' => 'authorization_code', 'code' => $code, 'code_verifier' => $codeVerifier]);
    }

    public function refreshTokens(string $refreshToken): array
    {
        return $this->tokenRequest(['grant_type' => 'refresh_token', 'refresh_token' => $refreshToken]);
    }

    /**
     * A call with a token that is not stored yet: 401 and 403 mean Jira
     * refuses the token.
     *
     * @return array<array-key, mixed>
     */
    public function probe(string $token, string $path): array
    {
        $response = $this->send('GET', $path, [], $token);

        if (in_array($response->status(), [401, 403], true)) {
            throw new ConnectionRefused(__("Jira didn't accept this token."));
        }

        if (! $response->successful()) {
            ProviderHttp::fail(self::Provider, $response);
        }

        return $this->decode($response);
    }

    public function get(TeamIntegration $integration, string $path, array $query = []): array
    {
        return $this->request($integration, 'GET', $path, $query);
    }

    public function post(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->request($integration, 'POST', $path, $body);
    }

    public function put(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->request($integration, 'PUT', $path, $body);
    }

    public function apiPath(string $resource): string
    {
        return 'rest/api/2/'.ltrim($resource, '/');
    }

    public function browseUrl(TeamIntegration $integration, string $key): string
    {
        return JiraDataCenterServer::url("browse/{$key}");
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<array-key, mixed>
     */
    private function request(TeamIntegration $integration, string $method, string $path, array $data): array
    {
        return $integration->withReconnectHandling(function () use ($integration, $method, $path, $data): array {
            if ($integration->setting('serverKey') !== JiraDataCenterServer::key()) {
                throw new ReconnectRequired(self::Provider, __('skrum is now configured for another Jira server. Reconnect.'));
            }

            $response = $integration->setting('authMethod') === self::AuthMethodToken
                ? $this->withPersonalToken($integration, $method, $path, $data)
                : $this->withOAuthToken($integration, $method, $path, $data);

            if (! $response->successful()) {
                ProviderHttp::fail(self::Provider, $response);
            }

            return $this->decode($response);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function withOAuthToken(TeamIntegration $integration, string $method, string $path, array $data): Response
    {
        $token = $this->tokens->accessToken($integration);
        $response = $this->send($method, $path, $data, $token);

        if ($response->status() !== 401) {
            return $response;
        }

        return $this->send($method, $path, $data, $this->tokens->refresh($integration, $token));
    }

    /**
     * Personal access tokens have no refresh: a 401 means revoked or expired.
     *
     * @param  array<string, mixed>  $data
     */
    private function withPersonalToken(TeamIntegration $integration, string $method, string $path, array $data): Response
    {
        if (! in_array(self::AuthMethodToken, self::Provider->authMethods(), true)) {
            throw new ReconnectRequired(self::Provider, __('Personal access tokens are turned off on this skrum instance. Connect with OAuth.'));
        }

        $token = $integration->credential('personalAccessToken');

        if (! is_string($token) || $token === '') {
            throw new ReconnectRequired(self::Provider, 'missing_personal_access_token');
        }

        $response = $this->send($method, $path, $data, $token);

        if ($response->status() === 401) {
            throw new ReconnectRequired(self::Provider, __('The Jira personal access token was revoked or has expired. Paste a new one.'));
        }

        return $response;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function send(string $method, string $path, array $data, string $token): Response
    {
        $options = $method === 'GET' ? ['query' => $data] : ['json' => $data];

        return ProviderHttp::send(self::Provider, fn () => $this->http()->withToken($token)->send($method, JiraDataCenterServer::url($path), $options));
    }

    private function http(): PendingRequest
    {
        return ProviderHttp::request()->withoutRedirecting();
    }

    /**
     * @param  array<string, string>  $params
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}
     */
    private function tokenRequest(array $params): array
    {
        $response = ProviderHttp::send(self::Provider, fn () => $this->http()->asForm()->post(JiraDataCenterServer::url('rest/oauth2/latest/token'), [
            ...$params,
            'client_id' => (string) config('services.jira_dc.client_id'),
            'client_secret' => (string) config('services.jira_dc.client_secret'),
            'redirect_uri' => (string) config('services.jira_dc.redirect'),
        ]));

        if (! $response->successful()) {
            OAuthTokens::failTokenRequest(self::Provider, $response);
        }

        return OAuthTokens::fromResponse(self::Provider, (array) $response->json());
    }

    /**
     * @return array<array-key, mixed>
     */
    private function decode(Response $response): array
    {
        $json = $response->json();

        return is_array($json) ? $json : [];
    }
}
```

In `app/Support/Integrations/IntegrationTokens.php`, add `use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;`, the arm `IntegrationProvider::JiraDataCenter => app(JiraDataCenterClient::class),` to `client()`, and after `refresh()`:

```php
    /**
     * Refreshes an expiring OAuth token before the caller takes row locks.
     * Jira DC personal access tokens and GitHub installations have none.
     */
    public function prepare(TeamIntegration $integration): void
    {
        $refreshes = match ($integration->provider) {
            IntegrationProvider::Jira, IntegrationProvider::Linear => true,
            IntegrationProvider::JiraDataCenter => $integration->setting('authMethod') === JiraDataCenterClient::AuthMethodOAuth,
            default => false,
        };

        if ($refreshes) {
            $this->accessToken($integration);
        }
    }
```

In `app/Actions/Integrations/ExportActionItem.php`, replace `$this->tokens->accessToken($integration);` with `$this->tokens->prepare($integration);`.

In `app/Actions/Integrations/DetectJiraStoryPointFields.php`, replace the constructor with `public function __construct(private JiraApis $jiraApis) {}` (import `App\Support\Integrations\Jira\JiraApis`, drop the `JiraClient` import) and the field request with:

```php
        $api = $this->jiraApis->for($integration);

        foreach ($api->get($integration, $api->apiPath('field')) as $field) {
```

- [ ] **Step 5: PKCE in the OAuth state and the connectors**

In `app/Support/Integrations/OAuthState.php`: add `private const VerifierLength = 64;`; in `issue()` add `'codeVerifier' => Str::random(self::VerifierLength),` to the stored array; in `consume()` change the return docblock to `@return array{teamId: string, access: IntegrationAccess, codeVerifier: ?string}|null` and the return to:

```php
        return [
            'teamId' => $stored['teamId'],
            'access' => $access,
            'codeVerifier' => is_string($stored['codeVerifier'] ?? null) ? $stored['codeVerifier'] : null,
        ];
```

and add:

```php
    /**
     * The PKCE S256 challenge of the verifier issued with the current state.
     */
    public function codeChallenge(Request $request): string
    {
        $verifier = data_get($request->session()->get(self::SessionKey), 'codeVerifier');

        return self::challenge(is_string($verifier) ? $verifier : '');
    }

    public static function challenge(string $verifier): string
    {
        return rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
    }
```

Create `app/Actions/Integrations/OAuthCallback.php`:

```php
<?php

namespace App\Actions\Integrations;

/**
 * What a provider's redirect brought back: the code, the PKCE verifier
 * issued with the state, and GitHub's installation id.
 */
class OAuthCallback
{
    public function __construct(
        public string $code,
        public ?string $codeVerifier = null,
        public ?string $installationId = null,
    ) {}
}
```

Replace `app/Actions/Integrations/OAuthConnector.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;

interface OAuthConnector
{
    public function authorizationUrl(string $state, IntegrationAccess $access, string $codeChallenge): string;

    public function connect(Team $team, User $user, IntegrationAccess $access, OAuthCallback $callback): TeamIntegration;
}
```

In `ConnectSlack`, `ConnectJira` and `ConnectLinear`: add `string $codeChallenge` as third parameter of `authorizationUrl()` (unused), change `connect(…, string $code)` to `connect(…, OAuthCallback $callback)` and use `$callback->code` where `$code` was used.

In `OAuthConnectors::for()`, add `IntegrationProvider::JiraDataCenter => app(ConnectJiraDataCenter::class),`.

Create `app/Actions/Integrations/ConnectJiraDataCenter.php`:

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
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use App\Support\Integrations\OAuthTokens;
use Illuminate\Support\Arr;

/**
 * OAuth 2.0 application link (spec 8 §4.1). Connecting with OAuth replaces
 * a stored personal access token: the credentials are rewritten whole.
 */
class ConnectJiraDataCenter implements OAuthConnector
{
    private const TokenSettings = ['tokenOwner', 'tokenSavedAt'];

    public function __construct(
        private JiraDataCenterClient $client,
        private SaveTeamIntegration $saveTeamIntegration,
        private DetectJiraStoryPointFields $detectStoryPointFields,
    ) {}

    /**
     * On the same server everything the admin chose is kept (story points
     * field, export target, priority map, status sync settings).
     *
     * @param  array<string, mixed>  $current
     * @return array<string, mixed>
     */
    public static function keptSettings(array $current): array
    {
        return ($current['serverKey'] ?? null) === JiraDataCenterServer::key()
            ? Arr::except($current, self::TokenSettings)
            : [];
    }

    /**
     * @param  array<array-key, mixed>  $serverInfo
     * @return array{serverKey: string, baseUrl: string, serverTitle: string, version: string}
     */
    public static function serverSettings(array $serverInfo): array
    {
        $title = $serverInfo['serverTitle'] ?? null;

        return [
            'serverKey' => JiraDataCenterServer::key(),
            'baseUrl' => JiraDataCenterServer::baseUrl(),
            'serverTitle' => is_string($title) && trim($title) !== '' ? mb_substr(trim($title), 0, 100) : 'Jira',
            'version' => is_string($serverInfo['version'] ?? null) ? mb_substr($serverInfo['version'], 0, 30) : '',
        ];
    }

    public function authorizationUrl(string $state, IntegrationAccess $access, string $codeChallenge): string
    {
        return $this->client->authorizationUrl($state, $access, $codeChallenge);
    }

    public function connect(Team $team, User $user, IntegrationAccess $access, OAuthCallback $callback): TeamIntegration
    {
        if ($callback->codeVerifier === null) {
            throw new ConnectionRefused(__('Could not connect :provider. Try again.', ['provider' => IntegrationProvider::JiraDataCenter->label()]));
        }

        $tokens = $this->client->exchangeCode($callback->code, $callback->codeVerifier);
        $serverInfo = $this->client->probe($tokens['access_token'], 'rest/api/2/serverInfo');
        $current = $team->integration(IntegrationProvider::JiraDataCenter)->settings ?? [];

        $integration = $this->saveTeamIntegration->handle($team, IntegrationProvider::JiraDataCenter, $user, [
            'status' => IntegrationStatus::Active,
            'access' => $access,
            'credentials' => OAuthTokens::credentials($tokens),
            'settings' => [
                ...self::keptSettings($current),
                ...self::serverSettings($serverInfo),
                'authMethod' => JiraDataCenterClient::AuthMethodOAuth,
            ],
            'scopes' => $tokens['scopes'],
        ]);

        $this->detectStoryPointFields->handleQuietly($integration);

        return $integration;
    }
}
```

- [ ] **Step 6: Controllers, routes and checks**

`IntegrationAuthorizationsController::create()` — after `Gate::authorize(…)` add:

```php
        abort_if(
            $provider === IntegrationProvider::JiraDataCenter && ! in_array(JiraDataCenterClient::AuthMethodOAuth, $provider->authMethods(), true),
            404,
        );
```

and change the redirect to `redirect()->away($this->connectors->for($provider)->authorizationUrl($state, $access, $this->oauthState->codeChallenge($request)))` (import `App\Support\Integrations\JiraDataCenter\JiraDataCenterClient`).

`IntegrationCallbacksController::show()` — replace the connect call with:

```php
        $installationId = $request->query('installation_id');

        try {
            $integration = $this->connectors->for($provider)->connect($team, $request->user(), $state['access'], new OAuthCallback(
                $code,
                $state['codeVerifier'],
                is_string($installationId) ? $installationId : null,
            ));
```

(import `App\Actions\Integrations\OAuthCallback`).

In `routes/web.php`, before the `integrations/{provider}/callback` route:

```php
    Route::get('integrations/jira-dc/callback', [IntegrationCallbacksController::class, 'show'])
        ->defaults('provider', 'jira_dc')
        ->middleware(EnsureIntegrationProviderEnabled::class)
        ->name('integrations.jiraDataCenter.callback');
```

and add `'jira_dc'` to the `whereIn('provider', …)` of `teams.integrations.connect`.

`CheckIntegration`: inject `private JiraDataCenterClient $jiraDataCenter`, remove `IntegrationProvider::JiraDataCenter` from the arm that throws `NotConnected` (keep every other case it lists) and add:

```php
            IntegrationProvider::JiraDataCenter => fn () => $this->jiraDataCenter->get($integration, 'rest/api/2/myself'),
```

`IntegrationTestsController::store()`: remove `IntegrationProvider::JiraDataCenter` from the arm that throws `NotConnected` and add it to the tracker arm: `IntegrationProvider::Jira, IntegrationProvider::Linear, IntegrationProvider::JiraDataCenter => fn () => $checkIntegration->handle($integration),`.

In `tests/Pest.php`, add `'codeVerifier' => str_repeat('v', 64),` to the array returned by `integrationOAuthSession()`.

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 7: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `skrum is now configured for another Jira server. Reconnect.` | `skrum est désormais configuré pour un autre serveur Jira. Reconnectez-vous.` | `skrum ahora está configurado para otro servidor de Jira. Vuelve a conectarte.` | `skrum ist jetzt für einen anderen Jira-Server eingerichtet. Verbinde dich erneut.` |
| `Personal access tokens are turned off on this skrum instance. Connect with OAuth.` | `Les jetons d'accès personnels sont désactivés sur cette instance de skrum. Connectez-vous avec OAuth.` | `Los tokens de acceso personal están desactivados en esta instancia de skrum. Conéctate con OAuth.` | `Persönliche Zugriffstoken sind auf dieser skrum-Instanz deaktiviert. Verbinde dich mit OAuth.` |
| `The Jira personal access token was revoked or has expired. Paste a new one.` | `Le jeton d'accès personnel Jira a été révoqué ou a expiré. Collez-en un nouveau.` | `El token de acceso personal de Jira se revocó o caducó. Pega uno nuevo.` | `Das persönliche Jira-Zugriffstoken wurde widerrufen oder ist abgelaufen. Füge ein neues ein.` |
| `Jira didn't accept this token.` | `Jira n'a pas accepté ce jeton.` | `Jira no aceptó este token.` | `Jira hat dieses Token nicht akzeptiert.` |

(`Could not connect :provider. Try again.` and `:provider connected.` exist.)

- [ ] **Step 8: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ConnectJiraDataCenterTest.php tests/Feature/Integrations/ConnectJiraTest.php tests/Feature/Integrations/ConnectLinearTest.php tests/Feature/Integrations/ConnectSlackTest.php tests/Feature/Integrations/IntegrationTokensTest.php tests/Feature/Integrations/ActionItemExportTest.php tests/Feature/Integrations/IntegrationMaintenanceTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS (if `IntegrationTokensTest` calls `JiraClient::authorizationUrl()` directly it is unaffected: only connectors changed). Then pint and phpstan (0 errors).

- [ ] **Step 9: Commit**

```bash
git add app/Support/Integrations/Jira/JiraApi.php app/Support/Integrations/Jira/JiraApis.php app/Support/Integrations/Jira/JiraClient.php app/Support/Integrations/JiraDataCenter/JiraDataCenterClient.php app/Support/Integrations/IntegrationTokens.php app/Support/Integrations/OAuthState.php app/Actions/Integrations/OAuthCallback.php app/Actions/Integrations/OAuthConnector.php app/Actions/Integrations/OAuthConnectors.php app/Actions/Integrations/ConnectSlack.php app/Actions/Integrations/ConnectJira.php app/Actions/Integrations/ConnectLinear.php app/Actions/Integrations/ConnectJiraDataCenter.php app/Actions/Integrations/ExportActionItem.php app/Actions/Integrations/CheckIntegration.php app/Actions/Integrations/DetectJiraStoryPointFields.php app/Http/Controllers/Integrations/IntegrationAuthorizationsController.php app/Http/Controllers/Integrations/IntegrationCallbacksController.php app/Http/Controllers/Integrations/IntegrationTestsController.php routes/web.php tests/Pest.php tests/Feature/Integrations/ConnectJiraDataCenterTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): connect Jira Data Center with OAuth 2.0 and PKCE

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 3: Jira Data Center personal access tokens

**Files:**
- Create: `app/Actions/Integrations/ConnectJiraDataCenterToken.php`, `app/Http/Controllers/Integrations/JiraDataCenterTokensController.php`
- Modify: `app/Actions/Integrations/PresentTeamIntegration.php`, `app/Http/Controllers/Integrations/TeamIntegrationsController.php`, `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/JiraDataCenterTokenTest.php`

**Interfaces:**
- Consumes: Task 2 (`JiraDataCenterClient::probe()`, `ConnectJiraDataCenter::{keptSettings, serverSettings}`), `SaveTeamIntegration`, `PresentTeamIntegration`, `PokerTaskSync::writeBackUnavailableReason()`.
- Produces: `ConnectJiraDataCenterToken::{rules, handle}`; route `POST w/{workspace}/teams/{team}/integrations/jira-dc/token` (`teams.integrations.jiraDataCenterToken.store`, 201 with the presented integration); presenter settings `serverTitle`, `version`, `baseUrl`, `authMethod`, `tokenOwner` (display name only), `tokenSavedAt`, `storyPointFields`, `numberFields`, `priorityMap` for `jira_dc`; page prop `providers[].authMethods`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/JiraDataCenterTokenTest.php`:

```php
<?php

use App\Actions\Integrations\PokerTaskSync;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;

const JiraDataCenterPastedToken = 'pasted-jira-token-abcdefghijklmnop';

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::JiraDataCenter);
});

/**
 * @param  array<string, mixed>  $body
 */
function postJiraDataCenterToken(User $user, Team $team, array $body = []): TestResponse
{
    return test()->actingAs($user)->postJson(
        route('teams.integrations.jiraDataCenterToken.store', [$team->workspace, $team]),
        ['token' => '  '.JiraDataCenterPastedToken.'  ', 'access' => 'write', 'acknowledged' => true, ...$body],
    );
}

/**
 * @param  array<int, int>  $versionNumbers
 */
function fakeJiraDataCenterTokenCheck(int $myselfStatus = 200, array $versionNumbers = [8, 20, 1]): void
{
    Http::fake([
        jiraDataCenterUrl('rest/api/2/myself') => Http::response(['name' => 'jdoe', 'displayName' => 'Jane Doe', 'emailAddress' => 'jane@example.com'], $myselfStatus),
        jiraDataCenterUrl('rest/api/2/serverInfo') => Http::response(['serverTitle' => 'Acme Jira', 'version' => implode('.', $versionNumbers), 'versionNumbers' => $versionNumbers]),
        jiraDataCenterUrl('rest/api/2/field') => Http::response([]),
    ]);
}

it('saves a personal access token that acts as its owner', function () {
    fakeJiraDataCenterTokenCheck();
    $team = Team::factory()->create();

    $response = postJiraDataCenterToken(integrationAdmin($team), $team)
        ->assertCreated()
        ->assertJsonPath('provider', 'jira_dc')
        ->assertJsonPath('access', 'write')
        ->assertJsonPath('settings.authMethod', 'pat')
        ->assertJsonPath('settings.tokenOwner', 'Jane Doe')
        ->assertJsonPath('settings.serverTitle', 'Acme Jira')
        ->assertJsonPath('settings.version', '8.20.1');

    $integration = TeamIntegration::query()->sole();

    expect($response->getContent())->not->toContain(JiraDataCenterPastedToken)
        ->and($response->json('settings.tokenSavedAt'))->toBeString()
        ->and($integration->credential('personalAccessToken'))->toBe(JiraDataCenterPastedToken)
        ->and((string) DB::table('team_integrations')->value('credentials'))->not->toContain(JiraDataCenterPastedToken)
        ->and($integration->setting('tokenOwner'))->toBe(['name' => 'jdoe', 'displayName' => 'Jane Doe'])
        ->and($integration->scopes)->toBe([]);

    foreach (['rest/api/2/myself', 'rest/api/2/serverInfo', 'rest/api/2/field'] as $path) {
        Http::assertSent(fn (Request $request) => $request->url() === "https://jira.example.com/{$path}"
            && $request->hasHeader('Authorization', 'Bearer '.JiraDataCenterPastedToken));
    }
});

it('requires the acknowledgement that the token acts as a person', function () {
    $team = Team::factory()->create();

    postJiraDataCenterToken(integrationAdmin($team), $team, ['acknowledged' => false])
        ->assertJsonValidationErrors('acknowledged');

    Http::assertNothingSent();
});

it('rejects tokens Jira refuses', function (int $status) {
    fakeJiraDataCenterTokenCheck($status);
    $team = Team::factory()->create();

    postJiraDataCenterToken(integrationAdmin($team), $team)
        ->assertJsonValidationErrors(['token' => "Jira didn't accept this token."]);

    expect(TeamIntegration::query()->count())->toBe(0);
})->with([401, 403]);

it('rejects servers older than Jira 8.14', function () {
    fakeJiraDataCenterTokenCheck(versionNumbers: [8, 13, 5]);
    $team = Team::factory()->create();

    postJiraDataCenterToken(integrationAdmin($team), $team)
        ->assertJsonValidationErrors(['token' => 'Personal access tokens need Jira 8.14 or later.']);
});

it('validates the token length', function (string $token) {
    $team = Team::factory()->create();

    postJiraDataCenterToken(integrationAdmin($team), $team, ['token' => $token])->assertJsonValidationErrors('token');
})->with([
    'too short' => [str_repeat('a', 19)],
    'too long' => [str_repeat('a', 256)],
]);

it('refuses non-admins before validating and answers 404 while tokens are off', function () {
    $team = Team::factory()->create();

    postJiraDataCenterToken(teamMember($team), $team, ['token' => 'x'])->assertForbidden();

    config(['services.jira_dc.personal_tokens' => false]);

    postJiraDataCenterToken(teamMember($team), $team)->assertForbidden();
    postJiraDataCenterToken(integrationAdmin($team), $team)->assertNotFound();
    Http::assertNothingSent();
});

it('never shows the token on the integrations page', function () {
    $team = Team::factory()->create();
    TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Write, 'pat')->create(['team_id' => $team->id]);

    $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.index', [$team->workspace, $team]))
        ->assertOk()
        ->assertDontSee(TeamIntegrationFactory::JiraDataCenterToken)
        ->assertInertia(fn (Assert $page) => $page
            ->where('providers.0.provider', 'jira_dc')
            ->where('providers.0.authMethods', ['oauth', 'pat'])
            ->where('providers.0.connection.settings.tokenOwner', 'Jane Doe')
            ->where('providers.0.connection.settings.tokenSavedAt', '2026-10-01T09:00:00+00:00'));
});

it('offers only the token when OAuth is not configured', function () {
    config(['services.jira_dc.client_id' => null]);
    $team = Team::factory()->create();

    $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.index', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('providers.0.authMethods', ['pat']));
});

it('lets read-only tokens write nothing', function () {
    $integration = TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Read, 'pat')->create();

    expect(PokerTaskSync::writeBackUnavailableReason(IntegrationProvider::JiraDataCenter, $integration))
        ->toBe('This Jira Data Center connection is read-only.');
});

it('asks for a new token once Jira revokes it', function () {
    Http::fake([jiraDataCenterUrl('rest/api/2/myself') => Http::response(['errorMessages' => ['Unauthorized']], 401)]);
    $integration = TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Write, 'pat')->create();

    expect(fn () => app(JiraDataCenterClient::class)->get($integration, 'rest/api/2/myself'))->toThrow(ReconnectRequired::class);

    expect($integration->fresh()?->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()?->last_error)->toBe('The Jira personal access token was revoked or has expired. Paste a new one.');
    Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer '.TeamIntegrationFactory::JiraDataCenterToken));
});

it('stops using stored tokens once they are turned off', function () {
    config(['services.jira_dc.personal_tokens' => false]);
    $integration = TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Write, 'pat')->create();

    expect(fn () => app(JiraDataCenterClient::class)->get($integration, 'rest/api/2/myself'))->toThrow(ReconnectRequired::class);

    Http::assertNothingSent();
});

it('removes the token with the connection', function () {
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Write, 'pat')->create(['team_id' => $team->id]);

    $this->actingAs(integrationAdmin($team))
        ->deleteJson(route('teams.integrations.destroy', [$team->workspace, $team, $integration]))
        ->assertNoContent();

    expect(TeamIntegration::query()->count())->toBe(0);
    Http::assertNothingSent();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/JiraDataCenterTokenTest.php`
Expected: FAIL — `Route [teams.integrations.jiraDataCenterToken.store] not defined.`

- [ ] **Step 3: Implement the token connection**

Create `app/Actions/Integrations/ConnectJiraDataCenterToken.php`:

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
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Spec 8 §4.1 fallback: a token pasted by an Owner/Admin acts as the person
 * who created it. It is stored encrypted in the credentials and never shown
 * again; `read` access makes skrum refuse every write itself.
 */
class ConnectJiraDataCenterToken
{
    private const MinimumVersion = '8.14';

    public function __construct(
        private JiraDataCenterClient $client,
        private SaveTeamIntegration $saveTeamIntegration,
        private DetectJiraStoryPointFields $detectStoryPointFields,
    ) {}

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function rules(): array
    {
        return [
            'token' => ['required', 'string', 'min:20', 'max:255'],
            'access' => ['required', Rule::enum(IntegrationAccess::class)],
            'acknowledged' => ['required', 'accepted'],
        ];
    }

    public function handle(Team $team, User $user, string $token, IntegrationAccess $access): TeamIntegration
    {
        try {
            $owner = $this->client->probe($token, 'rest/api/2/myself');
            $serverInfo = $this->client->probe($token, 'rest/api/2/serverInfo');
        } catch (ConnectionRefused $exception) {
            throw ValidationException::withMessages(['token' => $exception->getMessage()]);
        }

        if (! self::supportsTokens($serverInfo)) {
            throw ValidationException::withMessages(['token' => __('Personal access tokens need Jira 8.14 or later.')]);
        }

        $current = $team->integration(IntegrationProvider::JiraDataCenter)->settings ?? [];

        $integration = $this->saveTeamIntegration->handle($team, IntegrationProvider::JiraDataCenter, $user, [
            'status' => IntegrationStatus::Active,
            'access' => $access,
            'credentials' => ['personalAccessToken' => $token],
            'settings' => [
                ...ConnectJiraDataCenter::keptSettings($current),
                ...ConnectJiraDataCenter::serverSettings($serverInfo),
                'authMethod' => JiraDataCenterClient::AuthMethodToken,
                'tokenOwner' => self::owner($owner),
                'tokenSavedAt' => now()->toIso8601String(),
            ],
            'scopes' => [],
        ]);

        $this->detectStoryPointFields->handleQuietly($integration);

        return $integration;
    }

    /**
     * @param  array<array-key, mixed>  $serverInfo
     */
    private static function supportsTokens(array $serverInfo): bool
    {
        $numbers = array_values(array_filter((array) ($serverInfo['versionNumbers'] ?? []), 'is_int'));

        if (count($numbers) < 2) {
            return false;
        }

        return version_compare("{$numbers[0]}.{$numbers[1]}", self::MinimumVersion, '>=');
    }

    /**
     * @param  array<array-key, mixed>  $myself
     * @return array{name: string, displayName: string}
     */
    private static function owner(array $myself): array
    {
        $name = is_string($myself['name'] ?? null) ? mb_substr($myself['name'], 0, 255) : '';
        $displayName = is_string($myself['displayName'] ?? null) && trim($myself['displayName']) !== ''
            ? mb_substr(trim($myself['displayName']), 0, 255)
            : $name;

        return ['name' => $name, 'displayName' => $displayName];
    }
}
```

Create `app/Http/Controllers/Integrations/JiraDataCenterTokensController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\ConnectJiraDataCenterToken;
use App\Actions\Integrations\PresentTeamIntegration;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class JiraDataCenterTokensController extends Controller
{
    public function store(
        Request $request,
        Workspace $workspace,
        Team $team,
        ConnectJiraDataCenterToken $connectToken,
        PresentTeamIntegration $presentTeamIntegration,
    ): JsonResponse {
        Gate::authorize('manageIntegrations', $team);

        abort_unless(in_array(JiraDataCenterClient::AuthMethodToken, IntegrationProvider::JiraDataCenter->authMethods(), true), 404);

        $validated = $request->validate(ConnectJiraDataCenterToken::rules());

        $integration = $connectToken->handle(
            $team,
            $request->user(),
            trim((string) $validated['token']),
            IntegrationAccess::from($validated['access']),
        );

        return response()->json($presentTeamIntegration->handle($integration->load('connectedBy')), 201);
    }
}
```

In `routes/web.php`, inside the `EnsureIntegrationProviderEnabled` group, after the Telegram code route:

```php
                Route::post('teams/{team}/integrations/jira-dc/token', [JiraDataCenterTokensController::class, 'store'])
                    ->middleware([EnsureIntegrationProviderEnabled::class.':jira_dc', 'throttle:10,1,jiraDataCenterTokens'])
                    ->name('teams.integrations.jiraDataCenterToken.store');
```

(import the controller). Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 4: Present the token without revealing it**

In `app/Actions/Integrations/PresentTeamIntegration.php`, set `'jira_dc' => ['serverTitle', 'version', 'baseUrl', 'authMethod', 'storyPointFields', 'numberFields', 'priorityMap'],` in `SettingKeys`, replace the `'settings' => Arr::only($integration->settings, self::SettingKeys[$integration->provider->value]),` entry with `'settings' => $this->settings($integration),` (if Plan 14b already moved this expression into a helper, add the Jira DC branch below to that helper instead) and add:

```php
    /**
     * @return array<string, mixed>
     */
    private function settings(TeamIntegration $integration): array
    {
        $settings = Arr::only($integration->settings, self::SettingKeys[$integration->provider->value]);

        if ($integration->provider === IntegrationProvider::JiraDataCenter && $integration->setting('authMethod') === JiraDataCenterClient::AuthMethodToken) {
            $settings['tokenOwner'] = $integration->setting('tokenOwner.displayName');
            $settings['tokenSavedAt'] = $integration->setting('tokenSavedAt');
        }

        return $settings;
    }
```

(imports `App\Enums\IntegrationProvider`, `App\Support\Integrations\JiraDataCenter\JiraDataCenterClient`).

In `TeamIntegrationsController::index()`, add `'authMethods' => $provider->authMethods(),` to each provider entry after `'isTracker'`.

- [ ] **Step 5: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Personal access tokens need Jira 8.14 or later.` | `Les jetons d'accès personnels nécessitent Jira 8.14 ou ultérieur.` | `Los tokens de acceso personal requieren Jira 8.14 o posterior.` | `Persönliche Zugriffstoken benötigen Jira 8.14 oder neuer.` |

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/JiraDataCenterTokenTest.php tests/Feature/Integrations/IntegrationsPageTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 7: Commit**

```bash
git add app/Actions/Integrations/ConnectJiraDataCenterToken.php app/Http/Controllers/Integrations/JiraDataCenterTokensController.php app/Actions/Integrations/PresentTeamIntegration.php app/Http/Controllers/Integrations/TeamIntegrationsController.php routes/web.php tests/Feature/Integrations/JiraDataCenterTokenTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): connect Jira Data Center with a personal access token

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 4: Jira Data Center poker import, refresh and story points write-back

**Files:**
- Create: `app/Support/Integrations/JiraDataCenter/WikiMarkupToMarkdown.php`, `app/Support/Integrations/Trackers/JiraIssueTracker.php`, `app/Support/Integrations/Trackers/JiraDataCenterTracker.php`
- Modify: `app/Support/Integrations/Trackers/{JiraTracker,Trackers}.php`, `app/Actions/Integrations/PokerTaskSync.php`, `app/Http/Controllers/Integrations/JiraFieldDetectionsController.php`, `routes/web.php`
- Test: create `tests/Unit/Integrations/WikiMarkupToMarkdownTest.php`, `tests/Feature/Integrations/JiraDataCenterTrackerTest.php`; update `tests/Feature/Integrations/IssueTrackersTest.php`

**Interfaces:**
- Consumes: Task 2 (`JiraApi`, `JiraDataCenterClient`), `AdfToMarkdown::{convert, truncate}`, `TrackerIssue`, `TrackerIssueList`, `EstimateRejected`, `PokerDeck::numericValue()`, the poker import controllers and `SyncTaskEstimate`.
- Produces: `WikiMarkupToMarkdown::convert(?string): ?string`; abstract `JiraIssueTracker` (public API of the old `JiraTracker`, `static storyPointFieldIds()`, protected `api()`, `description()`, `searchJql()`, `requestedFields()`, `issueList()`, `issue()`); `JiraTracker` (Cloud) and `JiraDataCenterTracker`; `Trackers::for(JiraDataCenter)`; poker import routes accept `jira_dc`; story points reasons and detection for Jira DC.

- [ ] **Step 1: Write the failing tests**

Create `tests/Unit/Integrations/WikiMarkupToMarkdownTest.php`:

```php
<?php

use App\Support\Integrations\JiraDataCenter\WikiMarkupToMarkdown;

it('converts headings and inline formatting', function () {
    expect((new WikiMarkupToMarkdown)->convert("h1. Title\n\nSome *bold*, _italic_ and -gone- text with {{a*b*c}}."))
        ->toBe("# Title\n\nSome **bold**, *italic* and ~~gone~~ text with `a*b*c`.");
});

it('keeps code and noformat blocks verbatim', function () {
    expect((new WikiMarkupToMarkdown)->convert("{code:java}\nint *a* = b_c_d;\n{code}\nAfter"))
        ->toBe("```java\nint *a* = b_c_d;\n```\n\nAfter")
        ->and((new WikiMarkupToMarkdown)->convert("{noformat}\n[x|y] *raw*\n{noformat}"))
        ->toBe("```\n[x|y] *raw*\n```")
        ->and((new WikiMarkupToMarkdown)->convert("{code:title=Foo.java|borderStyle=solid}\nx\n{code}"))
        ->toBe("```\nx\n```");
});

it('converts quotes and lists', function () {
    expect((new WikiMarkupToMarkdown)->convert("{quote}\nfirst\nsecond\n{quote}\nbq. short"))
        ->toBe("> first\n> second\n\n> short")
        ->and((new WikiMarkupToMarkdown)->convert("* one\n** nested\n# first\n## second\n- dash"))
        ->toBe("- one\n  - nested\n1. first\n  1. second\n- dash");
});

it('keeps safe links only', function () {
    expect((new WikiMarkupToMarkdown)->convert('See [the docs|https://example.com/a_b_c], [https://example.com/x] and [bad|javascript:alert(1)].'))
        ->toBe('See [the docs](https://example.com/a_b_c), [https://example.com/x](https://example.com/x) and bad.');
});

it('converts tables and replaces images', function () {
    expect((new WikiMarkupToMarkdown)->convert("||Name||Points||\n|Login|3|\n|[Docs|https://example.com]|5|"))
        ->toBe("| Name | Points |\n| --- | --- |\n| Login | 3 |\n| [Docs](https://example.com) | 5 |")
        ->and((new WikiMarkupToMarkdown)->convert('Screenshot: !screen.png|thumbnail! done. Wow! Great!'))
        ->toBe('Screenshot: [attachment] done. Wow! Great!');
});

it('returns nothing for empty descriptions and truncates long ones', function () {
    $long = (new WikiMarkupToMarkdown)->convert(str_repeat('a', 10001));

    expect((new WikiMarkupToMarkdown)->convert(null))->toBeNull()
        ->and((new WikiMarkupToMarkdown)->convert("  \n "))->toBeNull()
        ->and(mb_strlen((string) $long))->toBe(10000)
        ->and($long)->toEndWith('…');
});
```

Create `tests/Feature/Integrations/JiraDataCenterTrackerTest.php`:

```php
<?php

use App\Actions\Integrations\PokerTaskSync;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\PokerDeck;
use App\Jobs\SyncTaskEstimate;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use App\Support\Integrations\Trackers\EstimateRejected;
use App\Support\Integrations\Trackers\JiraDataCenterTracker;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

/**
 * An issue as `POST /rest/api/2/search` returns it: the description is wiki markup.
 *
 * @param  array<string, mixed>  $fields
 * @return array<string, mixed>
 */
function jiraDataCenterIssue(string $id, string $key, array $fields = []): array
{
    return [
        'id' => $id,
        'key' => $key,
        'fields' => [
            'summary' => "Story {$key}",
            'description' => "*Bold* intro\n* first\n* second",
            'assignee' => ['name' => 'jdoe', 'displayName' => 'Jane Doe'],
            'status' => ['name' => 'To Do'],
            'customfield_10002' => 5,
            ...$fields,
        ],
    ];
}

/**
 * @param  array<int, array<string, mixed>>|null  $issues
 */
function fakeJiraDataCenterTrackerApi(?array $issues = null, ?int $total = null): void
{
    $issues ??= [jiraDataCenterIssue('10001', 'PROJ-1'), jiraDataCenterIssue('10002', 'PROJ-2')];

    Http::fake([
        jiraDataCenterUrl('rest/agile/1.0/board/*/sprint*') => Http::response(['values' => [
            ['id' => 31, 'name' => 'Sprint 31', 'state' => 'active', 'startDate' => '2026-10-01T09:00:00.000+02:00', 'endDate' => '2026-10-14T17:00:00.000+02:00'],
        ]]),
        jiraDataCenterUrl('rest/agile/1.0/board*') => Http::response(['values' => [['id' => 7, 'name' => 'Team board']], 'isLast' => true]),
        jiraDataCenterUrl('rest/api/2/search') => Http::response(['issues' => $issues, 'total' => $total ?? count($issues), 'startAt' => 0, 'maxResults' => 100]),
        jiraDataCenterUrl('rest/api/2/issue/*/editmeta') => Http::response(['fields' => ['customfield_10002' => ['name' => 'Story Points']]]),
        jiraDataCenterUrl('rest/api/2/issue/*') => Http::response(null, 204),
        jiraDataCenterUrl('rest/api/2/field') => Http::response([
            ['id' => 'customfield_10002', 'name' => 'Story Points', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.atlassian.jira.plugin.system.customfieldtypes:float']],
        ]),
    ]);
}

it('lists boards, sprints and issues of the Data Center server', function () {
    $table = trackerTable(IntegrationProvider::JiraDataCenter);
    fakeJiraDataCenterTrackerApi();

    $this->actingAs($table['member'])
        ->getJson(route('poker.imports.containers.index', [$table['game'], 'jira_dc', 'q' => 'Team']))
        ->assertOk()
        ->assertExactJson(['containers' => [['id' => '7', 'name' => 'Team board']], 'hasMore' => false]);

    $this->actingAs($table['member'])
        ->getJson(route('poker.imports.iterations.index', [$table['game'], 'jira_dc', 'container' => '7']))
        ->assertOk()
        ->assertExactJson([['id' => '31', 'name' => 'Sprint 31', 'state' => 'active', 'startsOn' => '2026-10-01', 'endsOn' => '2026-10-14']]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.preview.store', [$table['game'], 'jira_dc']), ['mode' => 'iteration', 'iteration_id' => '31'])
        ->assertOk()
        ->assertJsonPath('truncated', false)
        ->assertJsonPath('issues.0.key', 'PROJ-1')
        ->assertJsonPath('issues.0.estimate', '5')
        ->assertJsonPath('issues.0.assignee', 'Jane Doe');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://jira.example.com/rest/api/2/search'
        && $request['jql'] === 'sprint = 31 ORDER BY Rank ASC'
        && $request['startAt'] === 0
        && in_array('customfield_10002', $request['fields'], true)
        && $request->hasHeader('Authorization', 'Bearer jira-dc-access'));
});

it('imports Data Center issues with wiki descriptions as Markdown', function () {
    $table = trackerTable(IntegrationProvider::JiraDataCenter);
    fakeJiraDataCenterTrackerApi([jiraDataCenterIssue('10001', 'PROJ-1')]);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira_dc']), ['external_ids' => ['10001']])
        ->assertCreated()
        ->assertExactJson(['imported' => 1, 'skipped' => 0]);

    $task = PokerTask::query()->where('poker_game_id', $table['game']->id)->sole();

    expect($task->description)->toBe("**Bold** intro\n- first\n- second")
        ->and($task->external_source)->toBe('jira_dc')
        ->and($task->external_site)->toBe(JiraDataCenterServer::key())
        ->and($task->external_url)->toBe('https://jira.example.com/browse/PROJ-1')
        ->and($task->external_estimate)->toBe('5');

    Http::assertSent(fn (Request $request) => ($request['jql'] ?? null) === 'id in (10001)');
});

it('reports truncated searches from the total', function () {
    $table = trackerTable(IntegrationProvider::JiraDataCenter);
    fakeJiraDataCenterTrackerApi([jiraDataCenterIssue('10001', 'PROJ-1')], total: 150);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.preview.store', [$table['game'], 'jira_dc']), ['mode' => 'query', 'query' => 'project = PROJ'])
        ->assertOk()
        ->assertJsonPath('truncated', true);
});

it('writes story points back to the Data Center issue', function () {
    $table = trackerTable(IntegrationProvider::JiraDataCenter);
    fakeJiraDataCenterTrackerApi();
    $task = importedPokerTask($table['game'], [
        'external_id' => '10001',
        'estimate' => '8',
        'estimate_numeric' => 8,
        'estimated_at' => now(),
        'needs_sync' => true,
    ], IntegrationProvider::JiraDataCenter);

    app()->call([new SyncTaskEstimate($task->id), 'handle']);

    expect($task->fresh()?->needs_sync)->toBeFalse()
        ->and($task->fresh()?->synced_at)->not->toBeNull();
    Http::assertSent(fn (Request $request) => $request->method() === 'PUT'
        && $request->url() === 'https://jira.example.com/rest/api/2/issue/10001'
        && $request['fields']['customfield_10002'] == 8);
});

it('refuses unsafe ids before calling the server', function () {
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    $tracker = app(JiraDataCenterTracker::class);

    expect($tracker->iterations($integration, '../7'))->toBe([])
        ->and(fn () => $tracker->writeEstimate($integration, '../10001', '3'))->toThrow(EstimateRejected::class, 'This issue was not found in Jira Data Center.');

    Http::assertNothingSent();
});

it('explains why T-shirt games and servers without story points cannot sync', function () {
    $tshirt = trackerTable(IntegrationProvider::JiraDataCenter, IntegrationAccess::Write, PokerDeck::Tshirt);
    $task = importedPokerTask($tshirt['game'], [], IntegrationProvider::JiraDataCenter);

    expect(PokerTaskSync::for($tshirt['game'])->unsupportedReason($task))->toBe("T-shirt estimates can't be written to Jira Data Center.");

    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'storyPointFields' => []]])->save();

    expect(PokerTaskSync::writeBackUnavailableReason(IntegrationProvider::JiraDataCenter, $integration))->toBe('No story points field found.');
});

it('detects story points on Data Center connections', function () {
    enableIntegrations(IntegrationProvider::JiraDataCenter);
    fakeJiraDataCenterTrackerApi();
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    $team = $integration->team;

    $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.detection.store', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertJsonPath('settings.storyPointFields', [['id' => 'customfield_10002', 'name' => 'Story Points']]);
});
```

In `tests/Feature/Integrations/IssueTrackersTest.php`, extend the first expectation (the `Trackers::for()` map) with `->and(app(Trackers::class)->for(IntegrationProvider::JiraDataCenter))->toBeInstanceOf(JiraDataCenterTracker::class)` (import `App\Support\Integrations\Trackers\JiraDataCenterTracker`).

- [ ] **Step 2: Run them to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Integrations/WikiMarkupToMarkdownTest.php tests/Feature/Integrations/JiraDataCenterTrackerTest.php`
Expected: FAIL — `Class "App\Support\Integrations\JiraDataCenter\WikiMarkupToMarkdown" not found` and 404 on the `jira_dc` import routes.

- [ ] **Step 3: Convert wiki markup**

Create `app/Support/Integrations/JiraDataCenter/WikiMarkupToMarkdown.php`:

```php
<?php

namespace App\Support\Integrations\JiraDataCenter;

use App\Support\Integrations\Jira\AdfToMarkdown;

/**
 * Jira Server/Data Center descriptions are wiki markup (spec 8 §4.1). The
 * Markdown is rendered by RenderTaskMarkdown like any imported description;
 * links keep safe schemes only and images become a placeholder. Code,
 * noformat blocks and inline code are kept verbatim.
 */
class WikiMarkupToMarkdown
{
    private const SafeLinkSchemes = ['http', 'https', 'mailto'];

    private const BlockMarker = "\u{E000}";

    private const InlineMarker = "\u{E001}";

    public function convert(?string $wiki): ?string
    {
        if ($wiki === null || trim($wiki) === '') {
            return null;
        }

        $blocks = [];
        $text = str_replace(["\r\n", "\r"], "\n", $wiki);

        $text = (string) preg_replace_callback('/\{(code|noformat)(?::([^}]*))?\}(.*?)\{\1\}/s', function (array $match) use (&$blocks): string {
            $language = $match[1] === 'code' ? $this->language($match[2]) : '';
            $blocks[] = "```{$language}\n".trim($match[3], "\n")."\n```";

            return "\n".self::BlockMarker.(count($blocks) - 1).self::BlockMarker."\n";
        }, $text);

        $text = (string) preg_replace_callback('/\{quote\}(.*?)\{quote\}/s', fn (array $match): string => "\n".implode("\n", array_map(
            fn (string $line): string => rtrim("> {$line}"),
            explode("\n", trim($match[1], "\n")),
        ))."\n", $text);

        $lines = [];

        foreach (explode("\n", $text) as $line) {
            array_push($lines, ...$this->line($line));
        }

        $markdown = (string) preg_replace_callback(
            '/'.self::BlockMarker.'(\d+)'.self::BlockMarker.'/u',
            fn (array $match): string => $blocks[(int) $match[1]] ?? '',
            implode("\n", $lines),
        );

        $markdown = trim((string) preg_replace("/\n{3,}/", "\n\n", $markdown));

        return $markdown === '' ? null : AdfToMarkdown::truncate($markdown);
    }

    /**
     * @return array<int, string>
     */
    private function line(string $line): array
    {
        if (preg_match('/^\s*h([1-6])\.\s+(.*)$/', $line, $match) === 1) {
            return [str_repeat('#', (int) $match[1]).' '.$this->inline($match[2])];
        }

        if (preg_match('/^\s*bq\.\s+(.*)$/', $line, $match) === 1) {
            return ['> '.$this->inline($match[1])];
        }

        if (preg_match('/^\s*([*#]+|-)\s+(.*)$/', $line, $match) === 1) {
            $marker = str_ends_with($match[1], '#') ? '1.' : '-';

            return [str_repeat('  ', strlen($match[1]) - 1)."{$marker} ".$this->inline($match[2])];
        }

        if (preg_match('/^\s*\|\|(.*)\|\|\s*$/', $line, $match) === 1) {
            $cells = array_map(fn (string $cell): string => $this->inline(trim($cell)), explode('||', $match[1]));

            return ['| '.implode(' | ', $cells).' |', '|'.str_repeat(' --- |', count($cells))];
        }

        if (preg_match('/^\s*\|(.*)\|\s*$/', $line, $match) === 1) {
            $cells = array_map('trim', explode('|', $this->inline($match[1])));

            return ['| '.implode(' | ', $cells).' |'];
        }

        return [$this->inline($line)];
    }

    private function inline(string $text): string
    {
        $kept = [];
        $keep = function (string $markdown) use (&$kept): string {
            $kept[] = $markdown;

            return self::InlineMarker.(count($kept) - 1).self::InlineMarker;
        };

        $text = (string) preg_replace('/!([^!\s][^!\n]*)!/', '[attachment]', $text);
        $text = (string) preg_replace_callback('/\{\{(.+?)\}\}/', fn (array $match): string => $keep("`{$match[1]}`"), $text);
        $text = (string) preg_replace_callback('/\[([^\]|\n]*)\|([^\]\n]+)\]/', fn (array $match): string => $keep($this->link(trim($match[1]), trim($match[2]))), $text);
        $text = (string) preg_replace_callback('/\[((?:https?|mailto):[^\]\s]+)\]/i', fn (array $match): string => $keep($this->link($match[1], $match[1])), $text);
        $text = (string) preg_replace('/(?<![\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/u', '**$1**', $text);
        $text = (string) preg_replace('/(?<![\w_])_(?=\S)([^_\n]*?\S)_(?![\w_])/u', '*$1*', $text);
        $text = (string) preg_replace('/(?<![\w-])-(?=\S)([^-\n]*?\S)-(?![\w-])/u', '~~$1~~', $text);
        $text = (string) preg_replace('/\{color(?::[^}]*)?\}/', '', $text);

        return (string) preg_replace_callback(
            '/'.self::InlineMarker.'(\d+)'.self::InlineMarker.'/u',
            fn (array $match): string => $kept[(int) $match[1]] ?? '',
            $text,
        );
    }

    private function link(string $label, string $url): string
    {
        $text = $label === '' ? $url : $label;
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));

        if (! in_array($scheme, self::SafeLinkSchemes, true)) {
            return $text;
        }

        return '['.str_replace(['[', ']'], ['\[', '\]'], $text).']('.str_replace(['(', ')', ' '], ['%28', '%29', '%20'], $url).')';
    }

    private function language(string $options): string
    {
        foreach (explode('|', $options) as $option) {
            $candidate = trim($option);
            $candidate = str_starts_with($candidate, 'language=') ? substr($candidate, 9) : $candidate;

            if (preg_match('/^[A-Za-z0-9+#-]{1,20}$/', $candidate) === 1) {
                return strtolower($candidate);
            }
        }

        return '';
    }
}
```

- [ ] **Step 4: Split the Jira tracker by deployment**

Create `app/Support/Integrations/Trackers/JiraIssueTracker.php` (the old `JiraTracker` body, with its client calls going through `api()`):

```php
<?php

namespace App\Support\Integrations\Trackers;

use App\Enums\PokerDeck;
use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraApi;

/**
 * Jira Cloud and Jira Server/Data Center share boards, sprints, JQL and
 * story points; they differ in the search endpoint, the description format
 * and the REST version, which the subclasses provide.
 */
abstract class JiraIssueTracker implements IssueTracker
{
    private const BaseFields = ['summary', 'description', 'assignee', 'status'];

    private const IssueIdPattern = '/^[A-Za-z0-9_-]+$/';

    abstract protected function api(): JiraApi;

    abstract protected function description(mixed $value): ?string;

    abstract protected function searchJql(TeamIntegration $integration, string $jql): TrackerIssueList;

    public function containers(TeamIntegration $integration, ?string $query, int $page): array
    {
        $parameters = [
            'type' => 'scrum',
            'startAt' => (max($page, 1) - 1) * self::ContainerPageSize,
            'maxResults' => self::ContainerPageSize,
        ];

        if ($query !== null && trim($query) !== '') {
            $parameters['name'] = trim($query);
        }

        $response = $this->api()->get($integration, 'rest/agile/1.0/board', $parameters);
        $containers = [];

        foreach ((array) ($response['values'] ?? []) as $board) {
            if (! is_array($board) || ! isset($board['id'])) {
                continue;
            }

            $containers[] = [
                'id' => (string) $board['id'],
                'name' => is_string($board['name'] ?? null) ? $board['name'] : (string) $board['id'],
            ];
        }

        return ['containers' => $containers, 'hasMore' => ($response['isLast'] ?? true) === false];
    }

    public function iterations(TeamIntegration $integration, string $containerId): array
    {
        if (! ctype_digit($containerId)) {
            return [];
        }

        $response = $this->api()->get($integration, "rest/agile/1.0/board/{$containerId}/sprint", [
            'state' => 'active,future',
            'maxResults' => self::ContainerPageSize,
        ]);
        $iterations = [];

        foreach ((array) ($response['values'] ?? []) as $sprint) {
            if (! is_array($sprint) || ! isset($sprint['id'])) {
                continue;
            }

            $iterations[] = [
                'id' => (string) $sprint['id'],
                'name' => is_string($sprint['name'] ?? null) ? $sprint['name'] : (string) $sprint['id'],
                'state' => ($sprint['state'] ?? null) === 'active' ? 'active' : 'upcoming',
                'startsOn' => $this->day($sprint['startDate'] ?? null),
                'endsOn' => $this->day($sprint['endDate'] ?? null),
            ];
        }

        return $iterations;
    }

    public function iterationIssues(TeamIntegration $integration, string $iterationId): TrackerIssueList
    {
        return $this->searchJql($integration, 'sprint = '.(int) $iterationId.' ORDER BY Rank ASC');
    }

    public function search(TeamIntegration $integration, string $query): TrackerIssueList
    {
        return $this->searchJql($integration, $query);
    }

    public function issues(TeamIntegration $integration, array $externalIds): array
    {
        $ids = array_values(array_unique(array_filter($externalIds, fn (string $id): bool => ctype_digit($id))));
        $issues = [];

        foreach (array_chunk($ids, self::PreviewLimit) as $chunk) {
            foreach ($this->searchJql($integration, 'id in ('.implode(',', $chunk).')')->issues as $issue) {
                $issues[$issue->externalId] = $issue;
            }
        }

        return $issues;
    }

    public function writeEstimate(TeamIntegration $integration, string $externalId, ?string $estimate): void
    {
        $source = $integration->provider->label();
        $value = $estimate === null ? null : PokerDeck::numericValue($estimate);

        if ($estimate !== null && $value === null) {
            throw new EstimateRejected(__("T-shirt estimates can't be written to :source.", ['source' => $source]));
        }

        if (preg_match(self::IssueIdPattern, $externalId) !== 1) {
            throw new EstimateRejected(__('This issue was not found in :source.', ['source' => $source]));
        }

        $issuePath = $this->api()->apiPath('issue/'.rawurlencode($externalId));
        $editable = (array) ($this->api()->get($integration, "{$issuePath}/editmeta")['fields'] ?? []);
        $fieldId = collect(self::storyPointFieldIds($integration))
            ->first(fn (string $id): bool => array_key_exists($id, $editable));

        if ($fieldId === null) {
            throw new EstimateRejected(__('This issue has no story points field on its edit screen.'));
        }

        $this->api()->put($integration, $issuePath, ['fields' => [$fieldId => $value]]);
    }

    /**
     * @return array<int, string>
     */
    public static function storyPointFieldIds(TeamIntegration $integration): array
    {
        $ids = [];

        foreach ((array) $integration->setting('storyPointFields', []) as $field) {
            if (is_array($field) && is_string($field['id'] ?? null)) {
                $ids[] = $field['id'];
            }
        }

        return $ids;
    }

    /**
     * @return array<int, string>
     */
    protected function requestedFields(TeamIntegration $integration): array
    {
        return [...self::BaseFields, ...self::storyPointFieldIds($integration)];
    }

    /**
     * @param  array<array-key, mixed>  $rawIssues
     */
    protected function issueList(TeamIntegration $integration, array $rawIssues, bool $truncated): TrackerIssueList
    {
        $issues = [];

        foreach ($rawIssues as $raw) {
            if (is_array($raw) && ($issue = $this->issue($integration, $raw)) !== null) {
                $issues[] = $issue;
            }
        }

        return new TrackerIssueList($issues, $truncated);
    }

    /**
     * @param  array<array-key, mixed>  $raw
     */
    protected function issue(TeamIntegration $integration, array $raw): ?TrackerIssue
    {
        $id = $raw['id'] ?? null;
        $key = $raw['key'] ?? null;

        if ((! is_string($id) && ! is_int($id)) || ! is_string($key)) {
            return null;
        }

        $fields = is_array($raw['fields'] ?? null) ? $raw['fields'] : [];

        return new TrackerIssue(
            externalId: (string) $id,
            key: $key,
            title: TrackerIssue::title($fields['summary'] ?? null, $key),
            description: $this->description($fields['description'] ?? null),
            url: $this->api()->browseUrl($integration, $key),
            assignee: TrackerIssue::shorten(data_get($fields, 'assignee.displayName'), TrackerIssue::AssigneeLength),
            estimate: $this->estimate($integration, $fields),
            status: TrackerIssue::shorten(data_get($fields, 'status.name'), TrackerIssue::AssigneeLength),
        );
    }

    /**
     * @param  array<array-key, mixed>  $fields
     */
    private function estimate(TeamIntegration $integration, array $fields): ?string
    {
        foreach (self::storyPointFieldIds($integration) as $fieldId) {
            $estimate = TrackerIssue::formatEstimate($fields[$fieldId] ?? null);

            if ($estimate !== null) {
                return $estimate;
            }
        }

        return null;
    }

    private function day(mixed $value): ?string
    {
        return is_string($value) && strlen($value) >= 10 ? substr($value, 0, 10) : null;
    }
}
```

Replace `app/Support/Integrations/Trackers/JiraTracker.php`:

```php
<?php

namespace App\Support\Integrations\Trackers;

use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\AdfToMarkdown;
use App\Support\Integrations\Jira\JiraApi;
use App\Support\Integrations\Jira\JiraClient;

class JiraTracker extends JiraIssueTracker
{
    public function __construct(private JiraClient $client, private AdfToMarkdown $adfToMarkdown) {}

    protected function api(): JiraApi
    {
        return $this->client;
    }

    protected function description(mixed $value): ?string
    {
        return $this->adfToMarkdown->convert(is_array($value) ? $value : null);
    }

    protected function searchJql(TeamIntegration $integration, string $jql): TrackerIssueList
    {
        $response = $this->client->post($integration, 'rest/api/3/search/jql', [
            'jql' => $jql,
            'fields' => $this->requestedFields($integration),
            'maxResults' => self::PreviewLimit,
        ]);

        $nextPageToken = $response['nextPageToken'] ?? null;
        $truncated = (is_string($nextPageToken) && $nextPageToken !== '') || ($response['isLast'] ?? true) === false;

        return $this->issueList($integration, (array) ($response['issues'] ?? []), $truncated);
    }
}
```

Create `app/Support/Integrations/Trackers/JiraDataCenterTracker.php`:

```php
<?php

namespace App\Support\Integrations\Trackers;

use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraApi;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use App\Support\Integrations\JiraDataCenter\WikiMarkupToMarkdown;

class JiraDataCenterTracker extends JiraIssueTracker
{
    public function __construct(private JiraDataCenterClient $client, private WikiMarkupToMarkdown $wikiMarkupToMarkdown) {}

    protected function api(): JiraApi
    {
        return $this->client;
    }

    protected function description(mixed $value): ?string
    {
        return $this->wikiMarkupToMarkdown->convert(is_string($value) ? $value : null);
    }

    protected function searchJql(TeamIntegration $integration, string $jql): TrackerIssueList
    {
        $response = $this->client->post($integration, 'rest/api/2/search', [
            'jql' => $jql,
            'startAt' => 0,
            'maxResults' => self::PreviewLimit,
            'fields' => $this->requestedFields($integration),
        ]);

        $issues = (array) ($response['issues'] ?? []);

        return $this->issueList($integration, $issues, (int) ($response['total'] ?? 0) > count($issues));
    }
}
```

In `Trackers::for()`, add `IntegrationProvider::JiraDataCenter => app(JiraDataCenterTracker::class),`.

- [ ] **Step 5: Story points reasons, detection and routes**

In `PokerTaskSync::storyPointsReason()`, replace `$provider === IntegrationProvider::Jira` with `in_array($provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true)`.

In `JiraFieldDetectionsController::store()`, replace the `abort_unless` with `abort_unless(in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true), 404);`.

In `routes/web.php`, change `->where('source', 'jira|linear')` to `->where('source', 'jira|linear|jira_dc')` on the four `poker.imports.*` routes that have it.

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Integrations/WikiMarkupToMarkdownTest.php tests/Feature/Integrations/JiraDataCenterTrackerTest.php tests/Feature/Integrations/IssueTrackersTest.php tests/Feature/Integrations/PokerImportTest.php tests/Feature/Integrations/PokerImportBrowsingTest.php tests/Feature/Integrations/PokerEstimateSyncTest.php tests/Feature/Integrations/PokerTaskExternalTest.php tests/Feature/Integrations/ConnectJiraTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 7: Commit**

```bash
git add app/Support/Integrations/JiraDataCenter/WikiMarkupToMarkdown.php app/Support/Integrations/Trackers/JiraIssueTracker.php app/Support/Integrations/Trackers/JiraTracker.php app/Support/Integrations/Trackers/JiraDataCenterTracker.php app/Support/Integrations/Trackers/Trackers.php app/Actions/Integrations/PokerTaskSync.php app/Http/Controllers/Integrations/JiraFieldDetectionsController.php routes/web.php tests/Unit/Integrations/WikiMarkupToMarkdownTest.php tests/Feature/Integrations/JiraDataCenterTrackerTest.php tests/Feature/Integrations/IssueTrackersTest.php
git commit -m "feat(integrations): import and estimate Jira Data Center issues in poker

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 5: Jira Data Center export, priorities and people

**Files:**
- Create: `app/Support/Integrations/JiraDataCenter/MarkdownToWikiMarkup.php`
- Modify: `app/Support/Integrations/Jira/JiraCreateMeta.php`, `app/Actions/Integrations/{ExportToJira,ExportActionItem,ExportActionItemRules,ActionItemExportGuard,ListExportTargets,ListProviderPriorities,UpdateTeamIntegration}.php`, `app/Support/Integrations/IntegrationUserAccounts.php`
- Test: create `tests/Unit/Integrations/MarkdownToWikiMarkupTest.php`, `tests/Feature/Integrations/JiraDataCenterExportTest.php`

**Interfaces:**
- Consumes: Task 2 (`JiraApis`, `JiraDataCenterClient`), `IssueDraft`, `ExportAssignee`, `ResolveExportPriority`, `JiraCreateFields`, `IssueCreationUncertain`, `ExportWarningCode`, `IntegrationUserAccounts`, `ExternalAccount`, `UpdateTeamIntegration` (14a's URL-channel branch and 14b's webhook branch stay).
- Produces: `MarkdownToWikiMarkup::{escape, draft}`; export, targets, priorities, priority map, story points choice and people for `jira_dc`; `ExportActionItemRules` and `ActionItemExportGuard::sourceRules()` accept `jira_dc`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Unit/Integrations/MarkdownToWikiMarkupTest.php`:

```php
<?php

use App\Actions\Integrations\IssueDraft;
use App\Support\Integrations\JiraDataCenter\MarkdownToWikiMarkup;

it('escapes every wiki special in user content', function () {
    expect(MarkdownToWikiMarkup::escape('Fix {code} [x|y] *now* !img! a_b ~s~ ^t^ -u- +v+ \\ #1'))
        ->toBe('Fix \{code\} \[x\|y\] \*now\* \!img\! a\_b \~s\~ \^t\^ \-u\- \+v\+ \\\\ \#1');
});

it('builds the issue description as wiki paragraphs with the link back', function () {
    $draft = new IssueDraft('Buy milk', ['Buy milk', 'Call *Bob*'], 'From the retrospective "Sprint 1" on October 1, 2026:', 'https://skrum.test/w/acme/action-items?item=1', null);

    expect(MarkdownToWikiMarkup::draft($draft))->toBe(
        "Buy milk\n\nCall \\*Bob\\*\n\nFrom the retrospective \"Sprint 1\" on October 1, 2026: [https://skrum.test/w/acme/action-items?item=1]"
    );
});
```

Create `tests/Feature/Integrations/JiraDataCenterExportTest.php`:

```php
<?php

use App\Enums\ActionItemPriority;
use App\Enums\IntegrationProvider;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Events\Retros\ActionItemExternalLinksChanged;
use App\Events\Retros\ActionItemSaved;
use App\Events\Retros\CarriedActionItemSaved;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationUserMapping;
use App\Models\TeamIntegration;
use App\Support\Integrations\ExternalAccount;
use App\Support\Integrations\IntegrationUserAccounts;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    Event::fake([ActionItemSaved::class, TeamActionItemSaved::class, CarriedActionItemSaved::class, ActionItemExternalLinksChanged::class]);
    enableIntegrations(IntegrationProvider::JiraDataCenter);
});

it('exports an action item to Jira Data Center with wiki markup and a name assignee', function () {
    Http::fake([
        jiraDataCenterUrl('rest/api/2/issue/createmeta/*') => Http::response(['values' => jiraCreateMeta()['fields']]),
        jiraDataCenterUrl('rest/api/2/issue') => Http::response(['id' => '10042', 'key' => 'PROJ-42'], 201),
    ]);
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::High, 'due_on' => '2026-10-20', 'content' => "Speed up CI\nUse *cache* [now]"]);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create(['team_id' => $retro->team_id]);
    $assignee = teamMember($retro->team);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $assignee->id, 'external_account_id' => 'jdoe']);
    $item->update(['assignee_user_id' => $assignee->id]);

    $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'jira_dc', 'project_id' => '10000', 'issue_type_id' => '11'])
        ->assertCreated()
        ->assertJsonPath('actionItem.externalLinks', [['source' => 'jira_dc', 'key' => 'PROJ-42', 'url' => 'https://jira.example.com/browse/PROJ-42']])
        ->assertJsonPath('warnings', []);

    Http::assertSent(function (Request $request) {
        if ($request->url() !== 'https://jira.example.com/rest/api/2/issue') {
            return false;
        }

        $fields = $request['fields'];

        return $fields['project'] === ['id' => '10000']
            && $fields['summary'] === 'Speed up CI'
            && $fields['duedate'] === '2026-10-20'
            && $fields['priority'] === ['id' => '2']
            && $fields['assignee'] === ['name' => 'jdoe']
            && str_starts_with($fields['description'], "Speed up CI\n\nUse \\*cache\\* \\[now\\]\n\nFrom the retrospective \"Sprint 12\"");
    });
    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://jira.example.com/rest/api/2/issue/createmeta/10000/issuetypes/11'));

    expect(ActionItemExternalLink::query()->sole()->external_site)->toBe(JiraDataCenterServer::key())
        ->and($integration->fresh()?->setting('exportProjectId'))->toBe('10000');
});

it('lists Data Center projects, issue types and priorities', function () {
    Http::fake([
        jiraDataCenterUrl('rest/api/2/project') => Http::response([
            ['id' => '10001', 'key' => 'WEB', 'name' => 'Website'],
            ['id' => '10000', 'key' => 'API', 'name' => 'API platform'],
        ]),
        jiraDataCenterUrl('rest/api/2/issue/createmeta/10000/issuetypes') => Http::response(['values' => [
            ['id' => '10', 'name' => 'Story', 'subtask' => false],
            ['id' => '11', 'name' => 'Task', 'subtask' => false],
            ['id' => '12', 'name' => 'Sub-task', 'subtask' => true],
        ]]),
        jiraDataCenterUrl('rest/api/2/priority') => Http::response([['id' => '1', 'name' => 'Blocker'], ['id' => '2', 'name' => 'High']]),
    ]);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    $team = $integration->team;
    $admin = integrationAdmin($team);

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.targets.index', [$team->workspace, $team, $integration, 'q' => 'api']))
        ->assertOk()
        ->assertExactJson([
            'projects' => [['id' => '10000', 'key' => 'API', 'name' => 'API platform']],
            'issueTypes' => [['id' => '10', 'name' => 'Story'], ['id' => '11', 'name' => 'Task']],
            'defaults' => ['projectId' => '10000', 'issueTypeId' => '11'],
        ]);

    $this->actingAs($admin)
        ->getJson(route('teams.integrations.priorities.index', [$team->workspace, $team, $integration]))
        ->assertOk()
        ->assertExactJson([['id' => '1', 'name' => 'Blocker'], ['id' => '2', 'name' => 'High']]);

    $this->actingAs($admin)
        ->patchJson(route('teams.integrations.update', [$team->workspace, $team, $integration]), ['priority_map' => ['high' => '1'], 'story_point_field_id' => 'customfield_10002'])
        ->assertOk()
        ->assertJsonPath('settings.priorityMap.high', ['id' => '1', 'name' => 'Blocker']);
});

it('matches people by username search with exactly one equal email', function () {
    Http::fake([
        jiraDataCenterUrl('rest/api/2/user/search*') => fn (Request $request) => Http::response(str_starts_with(strtolower((string) $request['username']), 'ann') ? [
            ['name' => 'ann', 'displayName' => 'Ann Lee', 'emailAddress' => 'ann@example.com', 'active' => true],
            ['name' => 'anna', 'displayName' => 'Anna Bell', 'emailAddress' => 'anna@example.com', 'active' => true],
        ] : [
            ['name' => 'bob', 'displayName' => 'Bob', 'emailAddress' => 'bob@example.com', 'active' => false],
        ]),
        jiraDataCenterUrl('rest/api/2/user?*') => Http::response(['name' => 'ann', 'displayName' => 'Ann Lee', 'active' => true]),
    ]);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create();
    $accounts = app(IntegrationUserAccounts::class);

    $matches = $accounts->matchEmails($integration, ['Ann@example.com', 'bob@example.com']);

    expect(array_keys($matches))->toBe(['ann@example.com'])
        ->and($matches['ann@example.com']->id)->toBe('ann')
        ->and($accounts->find($integration, 'ann'))->toBeInstanceOf(ExternalAccount::class)
        ->and(array_map(fn (ExternalAccount $account): array => $account->toArray(), $accounts->search($integration, 'ann')))
        ->toBe([['accountId' => 'ann', 'displayName' => 'Ann Lee'], ['accountId' => 'anna', 'displayName' => 'Anna Bell']]);

    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://jira.example.com/rest/api/2/user/search')
        && $request['username'] === 'Ann@example.com'
        && (int) $request['maxResults'] === 2);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Integrations/MarkdownToWikiMarkupTest.php tests/Feature/Integrations/JiraDataCenterExportTest.php`
Expected: FAIL — `Class "App\Support\Integrations\JiraDataCenter\MarkdownToWikiMarkup" not found` and 422 for `source = jira_dc`.

- [ ] **Step 3: Build wiki descriptions**

Create `app/Support/Integrations/JiraDataCenter/MarkdownToWikiMarkup.php`:

```php
<?php

namespace App\Support\Integrations\JiraDataCenter;

use App\Actions\Integrations\IssueDraft;

/**
 * Export bodies for Jira Server/Data Center (spec 8 §4.1): plain
 * paragraphs and the link back to skrum, with every wiki special of the
 * user's text backslash-escaped so it cannot format, link or embed.
 */
class MarkdownToWikiMarkup
{
    public static function escape(string $text): string
    {
        return (string) preg_replace('/([\\\\{}\[\]*_\-+^~!|#])/', '\\\\$1', $text);
    }

    public static function draft(IssueDraft $draft): string
    {
        $paragraphs = array_map(self::escape(...), $draft->lines);
        $paragraphs[] = self::escape($draft->origin)." [{$draft->link}]";

        return implode("\n\n", $paragraphs);
    }
}
```

- [ ] **Step 4: Route every Jira export call through `JiraApis`**

`app/Support/Integrations/Jira/JiraCreateMeta.php`: constructor `public function __construct(private JiraApis $jiraApis) {}`; in `fetch()` replace the request with:

```php
        $api = $this->jiraApis->for($integration);

        $response = $api->get(
            $integration,
            $api->apiPath("issue/createmeta/{$project}/issuetypes/{$issueType}"),
            ['maxResults' => self::FieldLimit],
        );
```

`app/Actions/Integrations/ExportToJira.php`: constructor `private JiraApis $jiraApis, private JiraCreateMeta $createMeta, private ResolveExportPriority $resolvePriority` (import `App\Support\Integrations\Jira\JiraApis`, `App\Enums\IntegrationProvider` stays, add `App\Support\Integrations\JiraDataCenter\MarkdownToWikiMarkup`); in `create()`:

```php
        $isDataCenter = $integration->provider === IntegrationProvider::JiraDataCenter;

        $payload = array_filter([
            'project' => ['id' => $target['project_id']],
            'issuetype' => ['id' => $target['issue_type_id']],
            'summary' => $draft->title,
            'description' => $isDataCenter ? MarkdownToWikiMarkup::draft($draft) : $draft->adf(),
            'duedate' => $draft->dueOn,
            'priority' => $priority->value === null ? null : ['id' => (string) $priority->value],
            'assignee' => $assignee->accountId === null ? null : [$isDataCenter ? 'name' : 'accountId' => $assignee->accountId],
        ], fn (mixed $value): bool => $value !== null);
```

replace the uncertain-response throw's provider with `$integration->provider` and the URL with:

```php
        return new ExportOutcome(new CreatedIssue($id, $key, $this->jiraApis->for($integration)->browseUrl($integration, $key)), $assignee, $priority);
```

and `send()` with:

```php
    private function send(TeamIntegration $integration, array $fields): array
    {
        $api = $this->jiraApis->for($integration);

        try {
            return $api->post($integration, $api->apiPath('issue'), ['fields' => $fields]);
        } catch (ProviderUnavailable $exception) {
            if ($exception->timedOut) {
                throw new IssueCreationUncertain($integration->provider, $exception->detail());
            }

            throw $exception;
        }
    }
```

(drop the `JiraClient` import).

`app/Actions/Integrations/ExportActionItem.php` — replace the `$outcome = …` ternary with:

```php
        $outcome = match ($integration->provider) {
            IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter => $this->exportToJira->create($integration, $locked, $draft, $assignee, [
                'project_id' => $this->targetId($target, 'project_id'),
                'issue_type_id' => $this->targetId($target, 'issue_type_id'),
            ]),
            IntegrationProvider::Linear => $this->exportToLinear->create($integration, $locked, $draft, $assignee, ['team_id' => $this->targetId($target, 'team_id')]),
            default => throw new InvalidArgumentException("{$integration->provider->value} does not export action items."),
        };
```

and in `rememberTarget()`:

```php
        $saved = match ($integration->provider) {
            IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter => ['exportProjectId' => $target['project_id'], 'exportIssueTypeId' => $target['issue_type_id']],
            default => ['exportTeamId' => $target['team_id']],
        };
```

`ExportActionItemRules::rules()`:

```php
        return [
            'source' => ['required', 'string', Rule::in(ActionItemExportGuard::Sources)],
            'project_id' => ['exclude_unless:source,jira,jira_dc', 'required', 'string', 'regex:/^\d{1,20}\z/'],
            'issue_type_id' => ['exclude_unless:source,jira,jira_dc', 'required', 'string', 'regex:/^\d{1,20}\z/'],
            'team_id' => ['exclude_unless:source,linear', 'required', 'uuid'],
        ];
```

`ActionItemExportGuard`: add

```php
    /**
     * Trackers that take exported action items; the enum value is the `source`.
     */
    public const Sources = ['jira', 'jira_dc', 'linear'];
```

and make `sourceRules()` return `['source' => ['required', 'string', Rule::in(self::Sources)]]` (Task 9 appends `'github'`).

`ListProviderPriorities`: constructor `private JiraApis $jiraApis`; body after the Linear return:

```php
        $api = $this->jiraApis->for($integration);

        $listed = $integration->provider === IntegrationProvider::JiraDataCenter
            ? $api->get($integration, $api->apiPath('priority'))
            : (array) ($api->get($integration, $api->apiPath('priority/search'), ['maxResults' => self::JiraLimit])['values'] ?? []);

        $priorities = [];

        foreach ($listed as $priority) {
            if (! is_array($priority) || ! is_string($priority['id'] ?? null) || ! is_string($priority['name'] ?? null)) {
                continue;
            }

            $priorities[] = ['id' => $priority['id'], 'name' => $priority['name']];
        }

        return $priorities;
```

`ListExportTargets`: constructor `private JiraApis $jiraApis, private LinearClient $linear`; `handle()` becomes

```php
        return match ($integration->provider) {
            IntegrationProvider::Linear => $this->linearTargets($integration),
            default => $this->jiraTargets($integration, $projectId, $query),
        };
```

in `jiraTargets()` replace the project request and loop with `$projects = $this->jiraProjects($integration, $query);`, replace the loop in `issueTypes()` source with

```php
        $api = $this->jiraApis->for($integration);

        $listed = $integration->provider === IntegrationProvider::JiraDataCenter
            ? (array) ($api->get($integration, $api->apiPath('issue/createmeta/'.rawurlencode($projectId).'/issuetypes'))['values'] ?? [])
            : $api->get($integration, $api->apiPath('issuetype/project'), ['projectId' => $projectId]);

        foreach ($listed as $type) {
```

and add

```php
    /**
     * Data Center 8.x has no project search: all projects the person can
     * see are filtered and sorted here.
     *
     * @return array<int, array{id: string, key: string, name: string}>
     */
    private function jiraProjects(TeamIntegration $integration, ?string $query): array
    {
        $api = $this->jiraApis->for($integration);

        if ($integration->provider === IntegrationProvider::JiraDataCenter) {
            $needle = Str::lower(trim((string) $query));
            $listed = array_filter(
                $api->get($integration, $api->apiPath('project')),
                fn (mixed $project): bool => is_array($project)
                    && ($needle === '' || str_contains(Str::lower(($project['name'] ?? '').' '.($project['key'] ?? '')), $needle)),
            );
            usort($listed, fn (array $first, array $second): int => strcasecmp((string) ($first['name'] ?? ''), (string) ($second['name'] ?? '')));
            $listed = array_slice($listed, 0, self::ProjectLimit);
        } else {
            $listed = (array) ($api->get($integration, $api->apiPath('project/search'), array_filter([
                'maxResults' => self::ProjectLimit,
                'orderBy' => 'name',
                'action' => 'create',
                'query' => $query,
            ], fn (mixed $value): bool => $value !== null))['values'] ?? []);
        }

        $projects = [];

        foreach ($listed as $project) {
            if (! is_array($project) || ! is_string($project['id'] ?? null)) {
                continue;
            }

            $projects[] = ['id' => $project['id'], 'key' => (string) ($project['key'] ?? ''), 'name' => (string) ($project['name'] ?? '')];
        }

        return $projects;
    }
```

`UpdateTeamIntegration::rules()` — add after the Jira arm:

```php
            IntegrationProvider::JiraDataCenter => [
                'story_point_field_id' => ['sometimes', 'required', 'string', Rule::in($this->ids($integration->setting('numberFields', []), 'id'))],
                'priority_map' => ['sometimes', 'array:high,medium,low'],
                'priority_map.*' => ['nullable', 'string', 'max:50', $this->jiraPriorityRule($integration)],
            ],
```

and in `savePriorityMap()` replace `$integration->provider === IntegrationProvider::Jira` with `in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true)`.

- [ ] **Step 5: Data Center accounts**

In `app/Support/Integrations/IntegrationUserAccounts.php`: constructor `private JiraClient $jira, private LinearClient $linear, private JiraDataCenterClient $jiraDataCenter`; in `find()` add the arm

```php
                IntegrationProvider::JiraDataCenter => $this->jiraDataCenterAccount($this->jiraDataCenter->get($integration, 'rest/api/2/user', ['username' => $accountId])),
```

in `matchEmails()` replace `$account = $this->matchJiraEmail($integration, $email);` with

```php
            $account = $integration->provider === IntegrationProvider::JiraDataCenter
                ? $this->matchJiraDataCenterEmail($integration, $email)
                : $this->matchJiraEmail($integration, $email);
```

in `search()`, before the Jira Cloud request:

```php
        if ($integration->provider === IntegrationProvider::JiraDataCenter) {
            return $this->activeJiraDataCenterAccounts($this->jiraDataCenter->get($integration, 'rest/api/2/user/search', ['username' => $query, 'maxResults' => self::SearchLimit]));
        }
```

and add

```php
    /**
     * Spec 8 §4.1: accepted when exactly one active result has the
     * member's email.
     */
    private function matchJiraDataCenterEmail(TeamIntegration $integration, string $email): ?ExternalAccount
    {
        $results = $this->jiraDataCenter->get($integration, 'rest/api/2/user/search', ['username' => $email, 'maxResults' => self::JiraMatchLimit]);
        $candidates = array_values(array_filter(
            $this->activeJiraDataCenterAccounts($results),
            fn (ExternalAccount $account): bool => $account->email() !== null && Str::lower($account->email()) === Str::lower($email),
        ));

        return count($candidates) === 1 ? $candidates[0] : null;
    }

    /**
     * @param  array<array-key, mixed>  $users
     * @return array<int, ExternalAccount>
     */
    private function activeJiraDataCenterAccounts(array $users): array
    {
        return array_values(array_filter(
            array_map(fn (mixed $user): ?ExternalAccount => $this->jiraDataCenterAccount($user), $users),
            fn (?ExternalAccount $account): bool => $account !== null && $account->active,
        ));
    }

    private function jiraDataCenterAccount(mixed $user): ?ExternalAccount
    {
        if (! is_array($user) || ! is_string($user['name'] ?? null) || $user['name'] === '') {
            return null;
        }

        $email = $user['emailAddress'] ?? null;

        return new ExternalAccount(
            $user['name'],
            is_string($user['displayName'] ?? null) && $user['displayName'] !== '' ? $user['displayName'] : $user['name'],
            ($user['active'] ?? false) === true,
            is_string($email) && $email !== '' ? $email : null,
        );
    }
```

Update the class docblock to "Accounts of the team's Jira site, Jira server or Linear workspace." (GitHub joins in Task 9.)

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Integrations/MarkdownToWikiMarkupTest.php tests/Feature/Integrations/JiraDataCenterExportTest.php tests/Feature/Integrations/ActionItemExportTest.php tests/Feature/Integrations/ExportTargetsTest.php tests/Feature/Integrations/ExportResolutionTest.php tests/Feature/Integrations/PriorityMappingTest.php tests/Feature/Integrations/IntegrationUserAccountsTest.php tests/Feature/Integrations/UserMappingEndpointsTest.php tests/Feature/Integrations/MatchIntegrationUsersTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 7: Commit**

```bash
git add app/Support/Integrations/JiraDataCenter/MarkdownToWikiMarkup.php app/Support/Integrations/Jira/JiraCreateMeta.php app/Actions/Integrations/ExportToJira.php app/Actions/Integrations/ExportActionItem.php app/Actions/Integrations/ExportActionItemRules.php app/Actions/Integrations/ActionItemExportGuard.php app/Actions/Integrations/ListExportTargets.php app/Actions/Integrations/ListProviderPriorities.php app/Actions/Integrations/UpdateTeamIntegration.php app/Support/Integrations/IntegrationUserAccounts.php tests/Unit/Integrations/MarkdownToWikiMarkupTest.php tests/Feature/Integrations/JiraDataCenterExportTest.php
git commit -m "feat(integrations): export action items to Jira Data Center with mapped people and priorities

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 6: GitHub App authentication and installation connect

**Files:**
- Create: `app/Support/Integrations/GitHub/GitHubAppJwt.php`, `app/Support/Integrations/GitHub/GitHubClient.php`, `app/Actions/Integrations/ConnectGitHub.php`
- Modify: `app/Actions/Integrations/{OAuthConnectors,CheckIntegration}.php`, `app/Http/Controllers/Integrations/IntegrationTestsController.php`, `routes/web.php`, `tests/Pest.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/ConnectGitHubTest.php`

**Interfaces:**
- Consumes: Task 2 (`OAuthConnector`, `OAuthCallback`, callback controller passing `installation_id`), `SaveTeamIntegration`, `ProviderHttp`, `ConnectionRefused`, `gitHubTestPrivateKey()`.
- Produces: `GitHubAppJwt::{token, base64Url}`; `GitHubClient` (`ApiUrl`, `installationUrl`, `exchangeCode`, `userInstallations`, `installation`, `get/post/patch`, `response`, `repositoryName`, `repositories`, `forgetInstallationToken`, static `safeFullName`, `isLogin`, `hasNextPage`); `ConnectGitHub`; routes `integrations.callback` and `teams.integrations.connect` accept `github`; Pest helper `fakeGitHubInstallationToken()`.

- [ ] **Step 1: Write the failing test**

Add to `tests/Pest.php`:

```php
function fakeGitHubInstallationToken(string $token = 'ghs_installation_token'): void
{
    Http::fake(['api.github.com/app/installations/*/access_tokens' => Http::response(['token' => $token, 'expires_at' => now()->addHour()->toIso8601String()], 201)]);
}
```

Create `tests/Feature/Integrations/ConnectGitHubTest.php`:

```php
<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\GitHub\GitHubAppJwt;
use App\Support\Integrations\GitHub\GitHubClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::GitHub);
});

/**
 * @param  array<string, string>  $query
 */
function gitHubCallback(User $user, Team $team, array $query = []): TestResponse
{
    return test()->actingAs($user)
        ->withSession(integrationOAuthSession($team, IntegrationProvider::GitHub, IntegrationAccess::Read))
        ->get(route('integrations.callback', [
            'provider' => 'github',
            'code' => 'github-code',
            'state' => 'oauth-state-0123456789abcdefghijklmnopqrstu',
            'installation_id' => '4242',
            'setup_action' => 'install',
            ...$query,
        ]));
}

/**
 * @param  array<int, array<string, mixed>>  $installations
 */
function fakeGitHubUserInstallations(array $installations): void
{
    Http::fake([
        'github.com/login/oauth/access_token' => Http::response(['access_token' => 'ghu_user_token', 'token_type' => 'bearer']),
        'api.github.com/user/installations*' => Http::response(['total_count' => count($installations), 'installations' => $installations]),
    ]);
}

it('sends admins to the GitHub App installation page', function () {
    $team = Team::factory()->create();

    $response = $this->actingAs(integrationAdmin($team))
        ->get(route('teams.integrations.connect', [$team->workspace, $team, 'github']));

    expect((string) $response->headers->get('Location'))
        ->toBe('https://github.com/apps/skrum-test/installations/new?state='.session('integrations.oauth.state'));
});

it('connects the installation listed for the person and never stores their token', function () {
    fakeGitHubUserInstallations([
        ['id' => 4242, 'account' => ['login' => 'acme', 'type' => 'Organization'], 'permissions' => ['issues' => 'write', 'metadata' => 'read']],
    ]);
    $team = Team::factory()->create();

    gitHubCallback(integrationAdmin($team), $team)
        ->assertInertiaFlash('toast', ['type' => 'success', 'message' => 'GitHub connected.']);

    $integration = TeamIntegration::query()->sole();

    expect($integration->provider)->toBe(IntegrationProvider::GitHub)
        ->and($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->access)->toBe(IntegrationAccess::Write)
        ->and($integration->site())->toBe('4242')
        ->and($integration->settings)->toEqual(['installationId' => '4242', 'accountLogin' => 'acme', 'accountType' => 'Organization'])
        ->and($integration->readableCredentials())->toBe([])
        ->and((string) DB::table('team_integrations')->value('credentials'))->not->toContain('ghu_user_token')
        ->and(Cache::has('github-installation-token:4242'))->toBeFalse();

    Http::assertSent(fn (Request $request) => $request->url() === 'https://github.com/login/oauth/access_token'
        && $request['code'] === 'github-code'
        && $request['client_secret'] === 'github-secret');
    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/user/installations')
        && $request->hasHeader('Authorization', 'Bearer ghu_user_token')
        && $request->hasHeader('X-GitHub-Api-Version', '2022-11-28'));
});

it('refuses an installation the person cannot see', function (string $installationId) {
    fakeGitHubUserInstallations([
        ['id' => 999, 'account' => ['login' => 'someone-else', 'type' => 'User'], 'permissions' => ['issues' => 'write']],
    ]);
    $team = Team::factory()->create();

    gitHubCallback(integrationAdmin($team), $team, ['installation_id' => $installationId])
        ->assertInertiaFlash('toast', ['type' => 'error', 'message' => "This GitHub installation isn't available to your account."]);

    expect(TeamIntegration::query()->count())->toBe(0);
})->with(['forged id' => ['4242'], 'not a number' => ['../4242']]);

it('connects read only when the app cannot write issues', function () {
    fakeGitHubUserInstallations([
        ['id' => 4242, 'account' => ['login' => 'jane', 'type' => 'User'], 'permissions' => ['issues' => 'read']],
    ]);
    $team = Team::factory()->create();

    gitHubCallback(integrationAdmin($team), $team);

    expect(TeamIntegration::query()->sole()->access)->toBe(IntegrationAccess::Read)
        ->and(TeamIntegration::query()->sole()->setting('accountType'))->toBe('User');
});

it('signs a verifiable app JWT', function () {
    $this->freezeTime();

    [$header, $payload, $signature] = explode('.', app(GitHubAppJwt::class)->token());
    $decode = fn (string $segment): array => json_decode((string) base64_decode(strtr($segment, '-_', '+/')), true);
    $publicKey = openssl_pkey_get_details(openssl_pkey_get_private(gitHubTestPrivateKey()))['key'];

    expect($decode($header))->toBe(['alg' => 'RS256', 'typ' => 'JWT'])
        ->and($decode($payload))->toBe(['iat' => now()->getTimestamp() - 60, 'exp' => now()->getTimestamp() + 540, 'iss' => 12345])
        ->and(openssl_verify("{$header}.{$payload}", (string) base64_decode(strtr($signature, '-_', '+/')), $publicKey, OPENSSL_ALGO_SHA256))->toBe(1);
});

it('caches the installation token encrypted and reuses it', function () {
    fakeGitHubInstallationToken();
    Http::fake(['api.github.com/installation/repositories*' => Http::response([
        'total_count' => 1,
        'repositories' => [['id' => 9001, 'full_name' => 'acme/api']],
    ])]);
    $integration = TeamIntegration::factory()->gitHub()->create();
    $client = app(GitHubClient::class);

    expect($client->repositories($integration))->toBe([['id' => '9001', 'name' => 'acme/api']])
        ->and($client->repositories($integration))->toBe([['id' => '9001', 'name' => 'acme/api']]);

    $cached = Cache::get('github-installation-token:4242');

    expect($cached)->toBeString()->not->toBe('ghs_installation_token')
        ->and(Crypt::decryptString($cached))->toBe('ghs_installation_token');
    Http::assertSentCount(3);
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/app/installations/4242/access_tokens')
        && str_starts_with((string) $request->header('Authorization')[0], 'Bearer eyJ'));
    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/installation/repositories')
        && $request->hasHeader('Authorization', 'Bearer ghs_installation_token')
        && $request->hasHeader('Accept', 'application/vnd.github+json'));
});

it('mints a new token once GitHub refuses the cached one', function () {
    Cache::put('github-installation-token:4242', Crypt::encryptString('ghs_stale'), now()->addMinutes(10));
    fakeGitHubInstallationToken('ghs_fresh');
    Http::fake(['api.github.com/installation/repositories*' => Http::sequence()
        ->push(['message' => 'Bad credentials'], 401)
        ->push(['total_count' => 0, 'repositories' => []])]);
    $integration = TeamIntegration::factory()->gitHub()->create();

    expect(app(GitHubClient::class)->repositories($integration))->toBe([]);

    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/installation/repositories')
        && $request->hasHeader('Authorization', 'Bearer ghs_fresh'));
    expect(Crypt::decryptString(Cache::get('github-installation-token:4242')))->toBe('ghs_fresh');
});

it('asks to reconnect uninstalled and suspended installations', function (array $response, int $status, string $error) {
    Http::fake(['api.github.com/app/installations/4242' => Http::response($response, $status)]);
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $team->id]);

    $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.test.store', [$team->workspace, $team, $integration]))
        ->assertConflict();

    expect($integration->fresh()?->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()?->last_error)->toBe($error);
})->with([
    'uninstalled' => [['message' => 'Not Found'], 404, 'The GitHub App was uninstalled from acme.'],
    'suspended' => [['id' => 4242, 'suspended_at' => '2026-10-01T09:00:00Z'], 200, 'The GitHub App is suspended on acme.'],
]);

it('turns GitHub rate limits into a wait', function () {
    $this->freezeTime();
    fakeGitHubInstallationToken();
    Http::fake(['api.github.com/installation/repositories*' => Http::response(['message' => 'API rate limit exceeded'], 403, [
        'x-ratelimit-remaining' => '0',
        'x-ratelimit-reset' => (string) (now()->getTimestamp() + 120),
    ])]);
    $integration = TeamIntegration::factory()->gitHub()->create();

    try {
        app(GitHubClient::class)->repositories($integration);
        $this->fail('The rate limit was not reported.');
    } catch (RateLimited $exception) {
        expect($exception->retryAfter)->toBe(120);
    }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ConnectGitHubTest.php`
Expected: FAIL — 404 on `…/integrations/github/connect` and `Class "App\Support\Integrations\GitHub\GitHubAppJwt" not found`.

- [ ] **Step 3: Sign app JWTs**

Create `app/Support/Integrations/GitHub/GitHubAppJwt.php`:

```php
<?php

namespace App\Support\Integrations\GitHub;

use App\Enums\IntegrationProvider;
use App\Support\Integrations\Exceptions\ProviderRejected;

/**
 * The GitHub App's own identity (spec 8 §4.2): an RS256 JWT signed with
 * ext-openssl, valid from a minute ago for nine minutes.
 */
class GitHubAppJwt
{
    private const ClockSkewSeconds = 60;

    private const LifetimeSeconds = 540;

    public function token(): string
    {
        $now = now()->getTimestamp();
        $appId = (string) config('services.github_app.app_id');
        $segments = [
            self::encode(['alg' => 'RS256', 'typ' => 'JWT']),
            self::encode([
                'iat' => $now - self::ClockSkewSeconds,
                'exp' => $now + self::LifetimeSeconds,
                'iss' => ctype_digit($appId) ? (int) $appId : $appId,
            ]),
        ];

        $pem = $this->privateKey();
        $key = $pem === '' ? false : openssl_pkey_get_private($pem);

        if ($key === false || ! openssl_sign(implode('.', $segments), $signature, $key, OPENSSL_ALGO_SHA256)) {
            throw new ProviderRejected(IntegrationProvider::GitHub, 'github_app_key_unusable');
        }

        return implode('.', [...$segments, self::base64Url($signature)]);
    }

    public static function base64Url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function privateKey(): string
    {
        $key = (string) config('services.github_app.private_key');

        if ($key !== '') {
            return $key;
        }

        $path = (string) config('services.github_app.private_key_path');
        $contents = $path !== '' && is_readable($path) ? file_get_contents($path) : false;

        return is_string($contents) ? $contents : '';
    }

    /**
     * @param  array<string, int|string>  $data
     */
    private static function encode(array $data): string
    {
        return self::base64Url((string) json_encode($data));
    }
}
```

- [ ] **Step 4: Create the GitHub client**

Create `app/Support/Integrations/GitHub/GitHubClient.php`:

```php
<?php

namespace App\Support\Integrations\GitHub;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\ProviderHttp;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;

/**
 * GitHub Issues through the GitHub App (spec 8 §4.2). Installation tokens
 * live only in the cache, encrypted, minted under a lock; the user token of
 * the install callback is used once and never kept. Every value placed in
 * a path is validated first.
 */
class GitHubClient
{
    public const ApiUrl = 'https://api.github.com/';

    public const OAuthTokenUrl = 'https://github.com/login/oauth/access_token';

    public const ApiVersion = '2022-11-28';

    private const Provider = IntegrationProvider::GitHub;

    private const TokenMinutes = 50;

    private const LockSeconds = 30;

    private const LockWaitSeconds = 20;

    private const PageSize = 100;

    private const MaxPages = 10;

    private const MaxRetryAfterSeconds = 3600;

    private const IdPattern = '/^\d{1,20}\z/';

    private const LoginPattern = '/^[A-Za-z0-9-]{1,39}\z/';

    private const RepositoryPattern = '/^[A-Za-z0-9._-]{1,100}\z/';

    public function __construct(private GitHubAppJwt $jwt) {}

    public function installationUrl(string $state): string
    {
        return 'https://github.com/apps/'.rawurlencode((string) config('services.github_app.slug')).'/installations/new?'
            .http_build_query(['state' => $state], '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * The person's user token, to be used for the installation check only.
     */
    public function exchangeCode(string $code): string
    {
        $response = ProviderHttp::send(self::Provider, fn () => ProviderHttp::request()->post(self::OAuthTokenUrl, [
            'client_id' => (string) config('services.github_app.client_id'),
            'client_secret' => (string) config('services.github_app.client_secret'),
            'code' => $code,
            'redirect_uri' => (string) config('services.github_app.redirect'),
        ]));

        $token = $response->json('access_token');

        if (! $response->successful() || ! is_string($token) || $token === '') {
            throw new ProviderRejected(self::Provider, 'code_exchange_failed');
        }

        return $token;
    }

    /**
     * @return array<int, array{id: string, accountLogin: string, accountType: 'Organization'|'User', canWriteIssues: bool}>
     */
    public function userInstallations(string $userToken): array
    {
        $installations = [];

        for ($page = 1; $page <= self::MaxPages; $page++) {
            $response = $this->call('GET', 'user/installations', ['per_page' => self::PageSize, 'page' => $page], $userToken);

            if (! $response->successful()) {
                $this->fail($response);
            }

            foreach ((array) $response->json('installations', []) as $installation) {
                $summary = self::installationSummary($installation);

                if ($summary !== null) {
                    $installations[] = $summary;
                }
            }

            if (! self::hasNextPage($response)) {
                break;
            }
        }

        return $installations;
    }

    /**
     * The installation as the app sees it; an uninstalled or suspended
     * installation needs a reconnect.
     *
     * @return array<array-key, mixed>
     */
    public function installation(TeamIntegration $integration): array
    {
        return $integration->withReconnectHandling(function () use ($integration): array {
            $installationId = $this->installationId($integration);
            $response = $this->call('GET', "app/installations/{$installationId}", [], $this->jwt->token());

            if ($response->status() === 404) {
                throw new ReconnectRequired(self::Provider, $this->uninstalledMessage($integration));
            }

            if (! $response->successful()) {
                $this->fail($response);
            }

            if ($response->json('suspended_at') !== null) {
                throw new ReconnectRequired(self::Provider, $this->suspendedMessage($integration));
            }

            return (array) $response->json();
        });
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<array-key, mixed>
     */
    public function get(TeamIntegration $integration, string $path, array $query = []): array
    {
        return $this->decode($this->response($integration, 'GET', $path, $query));
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function post(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->decode($this->response($integration, 'POST', $path, $body));
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function patch(TeamIntegration $integration, string $path, array $body = []): array
    {
        return $this->decode($this->response($integration, 'PATCH', $path, $body));
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function response(TeamIntegration $integration, string $method, string $path, array $data = []): Response
    {
        return $integration->withReconnectHandling(function () use ($integration, $method, $path, $data): Response {
            $response = $this->call($method, $path, $data, $this->installationToken($integration));

            if ($response->status() === 401) {
                $this->forgetInstallationToken($this->installationId($integration));
                $response = $this->call($method, $path, $data, $this->installationToken($integration));
            }

            if (! $response->successful()) {
                $this->fail($response);
            }

            return $response;
        });
    }

    /**
     * `owner/repo` re-read by id, so renamed repositories keep working.
     */
    public function repositoryName(TeamIntegration $integration, string $repositoryId): string
    {
        if (preg_match(self::IdPattern, $repositoryId) !== 1) {
            throw new ProviderRejected(self::Provider, 'invalid_repository', 404);
        }

        $fullName = self::safeFullName($this->get($integration, "repositories/{$repositoryId}")['full_name'] ?? null);

        if ($fullName === null) {
            throw new ProviderRejected(self::Provider, 'invalid_repository', 404);
        }

        return $fullName;
    }

    /**
     * Every repository the installation can see (at most 1 000).
     *
     * @return array<int, array{id: string, name: string}>
     */
    public function repositories(TeamIntegration $integration): array
    {
        $repositories = [];

        for ($page = 1; $page <= self::MaxPages; $page++) {
            $response = $this->response($integration, 'GET', 'installation/repositories', ['per_page' => self::PageSize, 'page' => $page]);

            foreach ((array) $response->json('repositories', []) as $repository) {
                $fullName = is_array($repository) ? self::safeFullName($repository['full_name'] ?? null) : null;

                if ($fullName !== null && is_int($repository['id'] ?? null)) {
                    $repositories[] = ['id' => (string) $repository['id'], 'name' => $fullName];
                }
            }

            if (! self::hasNextPage($response)) {
                break;
            }
        }

        return $repositories;
    }

    public function forgetInstallationToken(string $installationId): void
    {
        Cache::forget(self::tokenKey($installationId));
    }

    public static function safeFullName(mixed $fullName): ?string
    {
        if (! is_string($fullName) || substr_count($fullName, '/') !== 1) {
            return null;
        }

        [$owner, $repository] = explode('/', $fullName);

        if (! self::isLogin($owner) || preg_match(self::RepositoryPattern, $repository) !== 1 || in_array($repository, ['.', '..'], true)) {
            return null;
        }

        return $fullName;
    }

    /**
     * @phpstan-assert-if-true string $login
     */
    public static function isLogin(mixed $login): bool
    {
        return is_string($login) && preg_match(self::LoginPattern, $login) === 1;
    }

    public static function hasNextPage(Response $response): bool
    {
        return str_contains($response->header('Link'), 'rel="next"');
    }

    /**
     * @return array{id: string, accountLogin: string, accountType: 'Organization'|'User', canWriteIssues: bool}|null
     */
    private static function installationSummary(mixed $installation): ?array
    {
        if (! is_array($installation) || ! is_int($installation['id'] ?? null)) {
            return null;
        }

        $login = data_get($installation, 'account.login');

        if (! self::isLogin($login)) {
            return null;
        }

        return [
            'id' => (string) $installation['id'],
            'accountLogin' => $login,
            'accountType' => data_get($installation, 'account.type') === 'Organization' ? 'Organization' : 'User',
            'canWriteIssues' => data_get($installation, 'permissions.issues') === 'write',
        ];
    }

    private function installationToken(TeamIntegration $integration): string
    {
        $installationId = $this->installationId($integration);
        $key = self::tokenKey($installationId);

        $cached = $this->cachedToken($key);

        if ($cached !== null) {
            return $cached;
        }

        try {
            return Cache::lock("{$key}:lock", self::LockSeconds)->block(
                self::LockWaitSeconds,
                fn (): string => $this->cachedToken($key) ?? $this->mintToken($integration, $installationId, $key),
            );
        } catch (LockTimeoutException) {
            throw new ProviderUnavailable(self::Provider, 'installation_token_busy');
        }
    }

    private function mintToken(TeamIntegration $integration, string $installationId, string $key): string
    {
        $response = $this->call('POST', "app/installations/{$installationId}/access_tokens", [], $this->jwt->token());

        if ($response->status() === 404) {
            throw new ReconnectRequired(self::Provider, $this->uninstalledMessage($integration));
        }

        if ($response->status() === 403) {
            throw new ReconnectRequired(self::Provider, $this->suspendedMessage($integration));
        }

        if (! $response->successful()) {
            $this->fail($response);
        }

        $token = $response->json('token');

        if (! is_string($token) || $token === '') {
            throw new ProviderRejected(self::Provider, 'missing_installation_token');
        }

        Cache::put($key, Crypt::encryptString($token), now()->addMinutes(self::TokenMinutes));

        return $token;
    }

    private function cachedToken(string $key): ?string
    {
        $stored = Cache::get($key);

        if (! is_string($stored)) {
            return null;
        }

        try {
            return Crypt::decryptString($stored);
        } catch (DecryptException) {
            Cache::forget($key);

            return null;
        }
    }

    private function installationId(TeamIntegration $integration): string
    {
        $installationId = $integration->setting('installationId');

        if (! is_string($installationId) || preg_match(self::IdPattern, $installationId) !== 1) {
            throw new NotConnected(self::Provider);
        }

        return $installationId;
    }

    private static function tokenKey(string $installationId): string
    {
        return "github-installation-token:{$installationId}";
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function call(string $method, string $path, array $data, string $token): Response
    {
        $options = $method === 'GET' ? ['query' => $data] : ['json' => $data];

        return ProviderHttp::send(self::Provider, fn () => $this->http()->withToken($token)->send($method, self::ApiUrl.ltrim($path, '/'), $options));
    }

    private function http(): PendingRequest
    {
        return ProviderHttp::request()
            ->withoutRedirecting()
            ->withHeaders(['Accept' => 'application/vnd.github+json', 'X-GitHub-Api-Version' => self::ApiVersion]);
    }

    private function fail(Response $response): never
    {
        $limited = $response->status() === 429
            || ($response->status() === 403 && ($response->header('x-ratelimit-remaining') === '0' || $response->header('Retry-After') !== ''));

        if ($limited) {
            throw new RateLimited(self::Provider, $this->retryAfter($response), ProviderHttp::message($response));
        }

        ProviderHttp::fail(self::Provider, $response);
    }

    private function retryAfter(Response $response): int
    {
        $retryAfter = $response->header('Retry-After');
        $reset = $response->header('x-ratelimit-reset');

        $seconds = match (true) {
            is_numeric($retryAfter) => (int) $retryAfter,
            is_numeric($reset) => (int) $reset - now()->getTimestamp(),
            default => 60,
        };

        return min(self::MaxRetryAfterSeconds, max(1, $seconds));
    }

    private function uninstalledMessage(TeamIntegration $integration): string
    {
        return __('The GitHub App was uninstalled from :account.', ['account' => (string) $integration->setting('accountLogin', 'GitHub')]);
    }

    private function suspendedMessage(TeamIntegration $integration): string
    {
        return __('The GitHub App is suspended on :account.', ['account' => (string) $integration->setting('accountLogin', 'GitHub')]);
    }

    /**
     * @return array<array-key, mixed>
     */
    private function decode(Response $response): array
    {
        $json = $response->json();

        return is_array($json) ? $json : [];
    }
}
```

- [ ] **Step 5: Connect the installation**

Create `app/Actions/Integrations/ConnectGitHub.php`:

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
use App\Support\Integrations\GitHub\GitHubClient;

/**
 * Spec 8 §4.2. The installation id comes from the browser, so it is
 * accepted only when the person's own token lists it; that token is then
 * dropped. Access follows the installation's `issues` permission.
 */
class ConnectGitHub implements OAuthConnector
{
    private const InstallationIdPattern = '/^\d{1,20}\z/';

    public function __construct(private GitHubClient $client, private SaveTeamIntegration $saveTeamIntegration) {}

    public function authorizationUrl(string $state, IntegrationAccess $access, string $codeChallenge): string
    {
        return $this->client->installationUrl($state);
    }

    public function connect(Team $team, User $user, IntegrationAccess $access, OAuthCallback $callback): TeamIntegration
    {
        $installationId = $callback->installationId;

        if ($installationId === null || preg_match(self::InstallationIdPattern, $installationId) !== 1) {
            throw new ConnectionRefused(__("This GitHub installation isn't available to your account."));
        }

        $installation = collect($this->client->userInstallations($this->client->exchangeCode($callback->code)))
            ->first(fn (array $candidate): bool => $candidate['id'] === $installationId);

        if ($installation === null) {
            throw new ConnectionRefused(__("This GitHub installation isn't available to your account."));
        }

        $current = $team->integration(IntegrationProvider::GitHub)->settings ?? [];
        $kept = ($current['installationId'] ?? null) === $installationId ? $current : [];

        $integration = $this->saveTeamIntegration->handle($team, IntegrationProvider::GitHub, $user, [
            'status' => IntegrationStatus::Active,
            'access' => $installation['canWriteIssues'] ? IntegrationAccess::Write : IntegrationAccess::Read,
            'credentials' => [],
            'settings' => [
                ...$kept,
                'installationId' => $installationId,
                'accountLogin' => $installation['accountLogin'],
                'accountType' => $installation['accountType'],
            ],
            'scopes' => [],
        ]);

        $this->client->forgetInstallationToken($installationId);

        return $integration;
    }
}
```

In `OAuthConnectors::for()` add `IntegrationProvider::GitHub => app(ConnectGitHub::class),`. In `routes/web.php` add `'github'` to the `whereIn('provider', …)` of `integrations.callback` and of `teams.integrations.connect`.

`CheckIntegration`: inject `private GitHubClient $gitHub`, remove `IntegrationProvider::GitHub` from the arm that throws `NotConnected` (if no case is left in that arm, delete it) and add `IntegrationProvider::GitHub => fn () => $this->gitHub->installation($integration),`. `IntegrationTestsController::store()`: same removal, and add `IntegrationProvider::GitHub` to the tracker arm.

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 6: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `This GitHub installation isn't available to your account.` | `Cette installation GitHub n'est pas accessible à votre compte.` | `Esta instalación de GitHub no está disponible para tu cuenta.` | `Diese GitHub-Installation ist für dein Konto nicht verfügbar.` |
| `The GitHub App was uninstalled from :account.` | `L'application GitHub a été désinstallée de :account.` | `La aplicación de GitHub se desinstaló de :account.` | `Die GitHub-App wurde von :account deinstalliert.` |
| `The GitHub App is suspended on :account.` | `L'application GitHub est suspendue sur :account.` | `La aplicación de GitHub está suspendida en :account.` | `Die GitHub-App ist auf :account gesperrt.` |

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ConnectGitHubTest.php tests/Feature/Integrations/ConnectJiraDataCenterTest.php tests/Feature/Integrations/ConnectSlackTest.php tests/Feature/Integrations/IntegrationMaintenanceTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 8: Commit**

```bash
git add app/Support/Integrations/GitHub/GitHubAppJwt.php app/Support/Integrations/GitHub/GitHubClient.php app/Actions/Integrations/ConnectGitHub.php app/Actions/Integrations/OAuthConnectors.php app/Actions/Integrations/CheckIntegration.php app/Http/Controllers/Integrations/IntegrationTestsController.php routes/web.php tests/Pest.php tests/Feature/Integrations/ConnectGitHubTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): connect GitHub App installations with verified ownership

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 7: The managed estimate block of GitHub issue bodies

**Files:**
- Create: `app/Support/Integrations/GitHub/EstimateBlock.php`
- Modify: `tests/Pest.php`
- Test: create `tests/Unit/Integrations/EstimateBlockTest.php`

**Interfaces:**
- Consumes: nothing (pure string code).
- Produces: `EstimateBlock::{Open, Close, MaxBodyLength, value, count, strip, apply, render, escape}`; Pest helper `renderedEstimateBlock(string $value): string`.

- [ ] **Step 1: Write the failing test**

Add to `tests/Pest.php`:

```php
function renderedEstimateBlock(string $value): string
{
    return "<!-- skrum:estimate -->\n**Estimate:** {$value}\n<!-- /skrum:estimate -->";
}
```

Create `tests/Unit/Integrations/EstimateBlockTest.php`:

```php
<?php

use App\Support\Integrations\GitHub\EstimateBlock;

it('appends the block once after the trimmed body', function () {
    expect(EstimateBlock::apply("Fix the login.\n\n  ", '5'))->toBe("Fix the login.\n\n".renderedEstimateBlock('5'))
        ->and(EstimateBlock::apply(null, '5'))->toBe(renderedEstimateBlock('5'))
        ->and(EstimateBlock::apply('', '½'))->toBe(renderedEstimateBlock('½'));
});

it('updates the block in place and keeps every other byte', function () {
    $body = "Intro\r\n\r\n".renderedEstimateBlock('3')."\r\n\r\n- [ ] keep *this*\r\ntrailing  ";

    $updated = EstimateBlock::apply($body, '8');

    expect($updated)->toBe(str_replace('**Estimate:** 3', '**Estimate:** 8', $body))
        ->and(EstimateBlock::strip($updated))->toBe(EstimateBlock::strip($body))
        ->and(EstimateBlock::apply($updated, '8'))->toBe($updated);
});

it('collapses copies into the first block', function () {
    $body = "A\n\n".renderedEstimateBlock('3')."\n\nB\n\n".renderedEstimateBlock('5')."\n\nC";

    $updated = EstimateBlock::apply($body, '8');

    expect($updated)->toBe("A\n\n".renderedEstimateBlock('8')."\n\nB\n\nC")
        ->and(EstimateBlock::count($updated))->toBe(1);
});

it('removes the block and its separator when the estimate is cleared', function () {
    expect(EstimateBlock::apply("Fix it.\n\n".renderedEstimateBlock('5'), null))->toBe('Fix it.')
        ->and(EstimateBlock::apply(renderedEstimateBlock('5')."\n\nAfter", null))->toBe('After')
        ->and(EstimateBlock::apply("Fix it.\n", null))->toBe("Fix it.\n");
});

it('reads the value with whitespace around the markers', function () {
    $body = "Body\n\n  <!-- skrum:estimate -->  \n**Estimate:**  XL \n\t<!-- /skrum:estimate -->";

    expect(EstimateBlock::value($body))->toBe('XL')
        ->and(EstimateBlock::count($body))->toBe(1)
        ->and(EstimateBlock::strip($body))->toBe('Body');
});

it('escapes Markdown in labels and reads them back', function () {
    expect(EstimateBlock::render('*_[x]`'))->toBe("<!-- skrum:estimate -->\n**Estimate:** \\*\\_\\[x\\]\\`\n<!-- /skrum:estimate -->")
        ->and(EstimateBlock::value(EstimateBlock::render('*_[x]`')))->toBe('*_[x]`')
        ->and(EstimateBlock::value(EstimateBlock::render('<3|#')))->toBe('<3|#');
});

it('never writes ? or ☕', function (string $card) {
    expect(fn () => EstimateBlock::apply('Body', $card))->toThrow(InvalidArgumentException::class);
})->with(['?', '☕']);

it('ignores markers that are not a block', function (string $body) {
    expect(EstimateBlock::value($body))->toBeNull()
        ->and(EstimateBlock::count($body))->toBe(0)
        ->and(EstimateBlock::strip($body))->toBe($body);
})->with([
    'other case' => ["<!-- SKRUM:estimate -->\n**Estimate:** 3\n<!-- /SKRUM:estimate -->"],
    'unclosed' => ["<!-- skrum:estimate -->\n**Estimate:** 3"],
    'inline marker' => ["see <!-- skrum:estimate --> here\n**Estimate:** 3\n<!-- /skrum:estimate -->"],
]);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Integrations/EstimateBlockTest.php`
Expected: FAIL — `Class "App\Support\Integrations\GitHub\EstimateBlock" not found`.

- [ ] **Step 3: Implement the block**

Create `app/Support/Integrations/GitHub/EstimateBlock.php`:

```php
<?php

namespace App\Support\Integrations\GitHub;

use InvalidArgumentException;

/**
 * The one block of a GitHub issue body skrum owns (spec 8 §4.2):
 *
 *     <!-- skrum:estimate -->
 *     **Estimate:** 5
 *     <!-- /skrum:estimate -->
 *
 * Markers must stand on their own lines and match case-sensitively. Every
 * byte outside the block is preserved; hand-made copies collapse into the
 * first block; clearing removes the block with the blank line before it.
 */
class EstimateBlock
{
    public const Open = '<!-- skrum:estimate -->';

    public const Close = '<!-- /skrum:estimate -->';

    public const MaxBodyLength = 65536;

    private const Label = '**Estimate:**';

    private const NeverWritten = ['?', '☕'];

    private const BlockPattern = '~^[ \t]*<!-- skrum:estimate -->[ \t]*\r?\n.*?^[ \t]*<!-- /skrum:estimate -->[ \t]*(?=\r?\n|\z)~ms';

    private const ValuePattern = '~^[ \t]*\*\*Estimate:\*\*(.*?)[ \t]*\r?$~m';

    private const Specials = '\\\\*_\[\]()#<>~|`';

    public static function value(?string $body): ?string
    {
        $blocks = self::blocks((string) $body);

        if ($blocks === [] || preg_match(self::ValuePattern, $blocks[0][0], $match) !== 1) {
            return null;
        }

        $value = (string) preg_replace('/\\\\(['.self::Specials.'])/', '$1', trim($match[1]));

        return $value === '' ? null : $value;
    }

    public static function count(?string $body): int
    {
        return count(self::blocks((string) $body));
    }

    public static function strip(?string $body): string
    {
        $body = (string) $body;

        foreach (array_reverse(self::blocks($body)) as [$text, $offset]) {
            $body = self::remove($body, $offset, strlen($text));
        }

        return $body;
    }

    /**
     * The body holding exactly one block with this estimate, or none when
     * the estimate is cleared.
     */
    public static function apply(?string $body, ?string $estimate): string
    {
        $body = (string) $body;

        if ($estimate === null) {
            return self::strip($body);
        }

        $block = self::render($estimate);
        $blocks = self::blocks($body);

        if ($blocks === []) {
            $trimmed = rtrim($body);

            return $trimmed === '' ? $block : "{$trimmed}\n\n{$block}";
        }

        foreach (array_reverse(array_slice($blocks, 1)) as [$text, $offset]) {
            $body = self::remove($body, $offset, strlen($text));
        }

        [$first, $offset] = $blocks[0];

        return substr_replace($body, $block, $offset, strlen($first));
    }

    public static function render(string $estimate): string
    {
        if (trim($estimate) === '' || in_array($estimate, self::NeverWritten, true)) {
            throw new InvalidArgumentException('Only deck cards that are estimates can be written.');
        }

        return self::Open."\n".self::Label.' '.self::escape($estimate)."\n".self::Close;
    }

    public static function escape(string $label): string
    {
        return (string) preg_replace('/(['.self::Specials.'])/', '\\\\$1', $label);
    }

    /**
     * @return array<int, array{0: string, 1: int}>
     */
    private static function blocks(string $body): array
    {
        preg_match_all(self::BlockPattern, $body, $matches, PREG_OFFSET_CAPTURE);

        return $matches[0];
    }

    /**
     * Drops the block and the blank line before it (the separator skrum
     * inserts), or the one after it when the block starts the body.
     */
    private static function remove(string $body, int $offset, int $length): string
    {
        $before = substr($body, 0, $offset);
        $after = substr($body, $offset + $length);

        foreach (["\r\n\r\n", "\n\n"] as $separator) {
            if (str_ends_with($before, $separator)) {
                return substr($before, 0, -strlen($separator)).$after;
            }

            if ($before === '' && str_starts_with($after, $separator)) {
                return substr($after, strlen($separator));
            }
        }

        return $before.$after;
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Integrations/EstimateBlockTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 5: Commit**

```bash
git add app/Support/Integrations/GitHub/EstimateBlock.php tests/Pest.php tests/Unit/Integrations/EstimateBlockTest.php
git commit -m "feat(integrations): parse and rewrite the managed estimate block of GitHub issues

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 8: GitHub poker import, refresh and estimate write-back

**Files:**
- Create: `app/Support/Integrations/Trackers/GitHubTracker.php`
- Modify: `app/Support/Integrations/Trackers/{IssueTracker,JiraIssueTracker,LinearTracker,Trackers}.php`, `app/Actions/Integrations/{PreviewPokerImport,ImportPokerTasks,PokerTaskSync}.php`, `app/Http/Controllers/Integrations/PokerImportPreviewsController.php`, `routes/web.php`, `tests/Pest.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/GitHubTrackerTest.php`; update `tests/Feature/Integrations/IssueTrackersTest.php`

**Interfaces:**
- Consumes: Task 6 (`GitHubClient`), Task 7 (`EstimateBlock`), `SyncTaskEstimate`, `TrackerIssue`, `AdfToMarkdown::truncate()`.
- Produces: `GitHubTracker` (with public static `issueReference()` and `fullName()`, protected `issue()`); `IssueTracker::search(TeamIntegration, string, ?string $containerId = null)`; `PreviewPokerImport::fetch/handle` and `ImportPokerTasks::fromSource` take `?string $containerId = null`; preview request field `container`; import routes accept `github`; `PokerTaskSync::writesAnyDeck()`; Pest helpers `gitHubRepository()`, `gitHubIssue()`, `fakeGitHubTrackerApi()`, `gitHubGraphqlIssues()`.
- Ruling (plan writing): `GitHubTracker::issues()` (import, refresh, later polls) never reads issues one REST call at a time; it sends one GraphQL request per repository and 100 issues (aliased `issue(number:)` fields, reshaped to the REST issue). The per-issue REST `fetch()` stays for the estimate write-back's read-modify-write.

- [ ] **Step 1: Write the failing test**

Add to `tests/Pest.php`:

```php
/**
 * @return array<string, mixed>
 */
function gitHubRepository(int $id, string $fullName): array
{
    return ['id' => $id, 'full_name' => $fullName, 'name' => explode('/', $fullName)[1]];
}

/**
 * An issue as the GitHub REST API returns it, in `acme/api`.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function gitHubIssue(int $number, array $overrides = []): array
{
    return [
        'number' => $number,
        'title' => "Issue {$number}",
        'body' => "About issue {$number}",
        'html_url' => "https://github.com/acme/api/issues/{$number}",
        'repository_url' => 'https://api.github.com/repos/acme/api',
        'state' => 'open',
        'assignees' => [['login' => 'octocat', 'id' => 583231]],
        ...$overrides,
    ];
}

/**
 * Fakes the GitHub endpoints poker uses for repository 9001 (`acme/api`).
 * Routes given first win.
 *
 * @param  array<string, mixed>  $routes
 */
function fakeGitHubTrackerApi(array $routes = []): void
{
    Http::fake([
        ...$routes,
        'api.github.com/app/installations/*/access_tokens' => Http::response(['token' => 'ghs_installation_token', 'expires_at' => now()->addHour()->toIso8601String()], 201),
        'api.github.com/installation/repositories*' => Http::response([
            'total_count' => 2,
            'repositories' => [gitHubRepository(9001, 'acme/api'), gitHubRepository(9002, 'acme/web')],
        ]),
        'api.github.com/repositories/9001' => Http::response(gitHubRepository(9001, 'acme/api')),
        'api.github.com/repos/acme/api/milestones*' => Http::response([
            ['number' => 3, 'title' => 'Sprint 3', 'due_on' => '2026-10-20T07:00:00Z'],
            ['number' => 2, 'title' => 'Sprint 2', 'due_on' => '2026-10-10T07:00:00Z'],
            ['number' => 4, 'title' => 'Someday', 'due_on' => null],
            ['number' => 1, 'title' => 'Late', 'due_on' => '2026-09-01T07:00:00Z'],
        ]),
        'api.github.com/repos/acme/api/issues?*' => Http::response([
            gitHubIssue(1),
            gitHubIssue(5, ['pull_request' => ['url' => 'https://api.github.com/repos/acme/api/pulls/5']]),
            gitHubIssue(2),
        ]),
        'api.github.com/search/issues*' => Http::response(['total_count' => 1, 'incomplete_results' => false, 'items' => [gitHubIssue(7)]]),
        'api.github.com/repositories/9001/issues/*' => fn (HttpRequest $request) => Http::response(gitHubIssue((int) basename($request->url()))),
        'api.github.com/graphql' => gitHubGraphqlIssues(),
    ]);
}

/**
 * Answers `GitHubTracker::issues()`'s batched GraphQL read from REST-shaped
 * fixtures (`gitHubIssue()`); a number missing from `$issues` comes back
 * null with a NOT_FOUND error, as GitHub answers for deleted issues and
 * pull requests. Without `$issues`, every requested number exists.
 *
 * @param  array<int, array<string, mixed>>|null  $issues
 */
function gitHubGraphqlIssues(?array $issues = null): Closure
{
    return function (HttpRequest $request) use ($issues) {
        preg_match_all('/\bi(\d+): issue\(number: \d+\)/', (string) $request['query'], $matches);
        $repository = [];
        $errors = [];

        foreach ($matches[1] as $number) {
            $raw = $issues === null ? gitHubIssue((int) $number) : ($issues[(int) $number] ?? null);

            if ($raw === null) {
                $repository["i{$number}"] = null;
                $errors[] = ['type' => 'NOT_FOUND', 'path' => ['repository', "i{$number}"], 'message' => 'Could not resolve to an Issue.'];

                continue;
            }

            $repository["i{$number}"] = [
                'number' => $raw['number'],
                'title' => $raw['title'],
                'body' => $raw['body'],
                'url' => $raw['html_url'],
                'state' => strtoupper($raw['state']),
                'stateReason' => isset($raw['state_reason']) ? strtoupper($raw['state_reason']) : null,
                'updatedAt' => $raw['updated_at'] ?? '2026-10-07T09:00:00Z',
                'assignees' => ['nodes' => array_map(fn (array $assignee): array => ['login' => $assignee['login']], $raw['assignees'])],
            ];
        }

        return Http::response(['data' => ['repository' => $repository], ...($errors === [] ? [] : ['errors' => $errors])]);
    };
}
```

Create `tests/Feature/Integrations/GitHubTrackerTest.php`:

```php
<?php

use App\Actions\Integrations\PokerTaskSync;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\PokerDeck;
use App\Jobs\SyncTaskEstimate;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Trackers\EstimateRejected;
use App\Support\Integrations\Trackers\GitHubTracker;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    $this->travelTo(Carbon::parse('2026-10-07 12:00:00'));
});

/**
 * @param  array<string, mixed>  $table
 */
function gitHubSyncTask(array $table, ?string $estimate, int $number = 7): PokerTask
{
    return importedPokerTask($table['game'], [
        'external_id' => "9001/{$number}",
        'external_key' => "acme/api#{$number}",
        'estimate' => $estimate,
        'estimate_numeric' => $estimate === null ? null : PokerDeck::numericValue($estimate),
        'estimated_at' => $estimate === null ? null : now(),
        'needs_sync' => true,
    ], IntegrationProvider::GitHub);
}

function runGitHubSync(PokerTask $task): PokerTask
{
    app()->call([new SyncTaskEstimate($task->id), 'handle']);

    return $task->fresh() ?? $task;
}

/**
 * @return array<int, Request>
 */
function gitHubPatches(): array
{
    return collect(Http::recorded())
        ->map(fn (array $pair): Request => $pair[0])
        ->filter(fn (Request $request): bool => $request->method() === 'PATCH')
        ->values()
        ->all();
}

it('lists repositories and open milestones', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi();

    $this->actingAs($table['member'])
        ->getJson(route('poker.imports.containers.index', [$table['game'], 'github', 'q' => 'API']))
        ->assertOk()
        ->assertExactJson(['containers' => [['id' => '9001', 'name' => 'acme/api']], 'hasMore' => false]);

    $this->actingAs($table['member'])
        ->getJson(route('poker.imports.iterations.index', [$table['game'], 'github', 'container' => '9001']))
        ->assertOk()
        ->assertExactJson([
            ['id' => '9001/3', 'name' => 'Sprint 3', 'state' => 'upcoming', 'startsOn' => null, 'endsOn' => '2026-10-20'],
            ['id' => '9001/2', 'name' => 'Sprint 2', 'state' => 'active', 'startsOn' => null, 'endsOn' => '2026-10-10'],
            ['id' => '9001/4', 'name' => 'Someday', 'state' => 'upcoming', 'startsOn' => null, 'endsOn' => null],
            ['id' => '9001/1', 'name' => 'Late', 'state' => 'upcoming', 'startsOn' => null, 'endsOn' => '2026-09-01'],
        ]);
});

it('previews the open issues of a milestone without pull requests', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi();

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.preview.store', [$table['game'], 'github']), ['mode' => 'iteration', 'iteration_id' => '9001/2'])
        ->assertOk()
        ->assertJsonPath('truncated', false)
        ->assertJsonCount(2, 'issues')
        ->assertJsonPath('issues.0.externalId', '9001/1')
        ->assertJsonPath('issues.0.key', 'acme/api#1')
        ->assertJsonPath('issues.0.assignee', 'octocat')
        ->assertJsonPath('issues.1.key', 'acme/api#2');

    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/repos/acme/api/issues?')
        && $request['milestone'] === '2'
        && $request['state'] === 'open');
});

it('searches one repository only', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi();
    $url = route('poker.imports.preview.store', [$table['game'], 'github']);

    $this->actingAs($table['member'])->postJson($url, ['mode' => 'query', 'query' => 'login bug'])
        ->assertJsonValidationErrors(['container' => 'Choose a repository to search in.']);

    $this->actingAs($table['member'])
        ->postJson($url, ['mode' => 'query', 'query' => 'login bug repo:evil/secrets org:evil', 'container' => '9001'])
        ->assertOk()
        ->assertJsonPath('issues.0.key', 'acme/api#7');

    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/search/issues')
        && $request['q'] === 'login bug repo:acme/api is:issue');
});

it('imports issues with the block removed from the description and read as the source estimate', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/graphql' => gitHubGraphqlIssues([7 => gitHubIssue(7, ['body' => "Steps\n\n".renderedEstimateBlock('XL')])]),
    ]);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.imports.store', [$table['game'], 'github']), ['external_ids' => ['9001/7']])
        ->assertCreated()
        ->assertExactJson(['imported' => 1, 'skipped' => 0]);

    $task = PokerTask::query()->where('poker_game_id', $table['game']->id)->sole();

    expect($task->description)->toBe('Steps')
        ->and($task->external_estimate)->toBe('XL')
        ->and($task->external_key)->toBe('acme/api#7')
        ->and($task->external_site)->toBe('4242')
        ->and($task->external_url)->toBe('https://github.com/acme/api/issues/7');
});

it('rewrites only the managed block, for any deck', function () {
    $table = trackerTable(IntegrationProvider::GitHub, IntegrationAccess::Write, PokerDeck::Tshirt);
    $body = "Keep *this*\r\n\r\nexactly.";
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => $body])),
        'api.github.com/repos/acme/api/issues/7' => fn (Request $request) => Http::response(gitHubIssue(7, ['body' => $request['body']])),
    ]);
    $task = gitHubSyncTask($table, 'XL');

    expect(PokerTaskSync::for($table['game'])->unsupportedReason($task))->toBeNull()
        ->and(runGitHubSync($task)->synced_at)->not->toBeNull();

    expect(gitHubPatches())->toHaveCount(1)
        ->and(gitHubPatches()[0]['body'])->toBe("{$body}\n\n".renderedEstimateBlock('XL'));
});

it('does not write when the block already holds the estimate', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => "Text\n\n".renderedEstimateBlock('5')])),
    ]);

    expect(runGitHubSync(gitHubSyncTask($table, '5'))->needs_sync)->toBeFalse()
        ->and(gitHubPatches())->toBe([]);
});

it('removes the block when the estimate is cleared', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => "Text\n\n".renderedEstimateBlock('3')])),
        'api.github.com/repos/acme/api/issues/7' => fn (Request $request) => Http::response(gitHubIssue(7, ['body' => $request['body']])),
    ]);

    runGitHubSync(gitHubSyncTask($table, null));

    expect(gitHubPatches()[0]['body'])->toBe('Text');
});

it('restarts when the description changed meanwhile', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    $patches = 0;
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::sequence()
            ->push(gitHubIssue(7, ['body' => 'First']))
            ->push(gitHubIssue(7, ['body' => 'Second'])),
        'api.github.com/repos/acme/api/issues/7' => function (Request $request) use (&$patches) {
            $patches++;

            return Http::response(gitHubIssue(7, ['body' => $patches === 1 ? 'Edited meanwhile' : $request['body']]));
        },
    ]);

    expect(runGitHubSync(gitHubSyncTask($table, '8'))->synced_at)->not->toBeNull()
        ->and(gitHubPatches())->toHaveCount(2)
        ->and(gitHubPatches()[1]['body'])->toBe("Second\n\n".renderedEstimateBlock('8'));
});

it('gives up after three changed descriptions', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => 'Body'])),
        'api.github.com/repos/acme/api/issues/7' => Http::response(gitHubIssue(7, ['body' => 'Someone else'])),
    ]);

    $task = runGitHubSync(gitHubSyncTask($table, '8'));

    expect($task->needs_sync)->toBeTrue()
        ->and($task->sync_error)->toBe('The issue description kept changing. Try again.')
        ->and(gitHubPatches())->toHaveCount(3);
});

it('refuses bodies over the GitHub limit and missing issues', function () {
    $table = trackerTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => str_repeat('a', 65530)])),
        'api.github.com/repositories/9001/issues/8' => Http::response(['message' => 'Not Found'], 404),
    ]);

    expect(runGitHubSync(gitHubSyncTask($table, '8'))->sync_error)->toBe('The issue description is too long to add the estimate.')
        ->and(runGitHubSync(gitHubSyncTask($table, '8', 8))->sync_error)->toBe('This issue was not found in GitHub.')
        ->and(gitHubPatches())->toBe([]);
});

it('marks tasks of read-only GitHub connections as unsupported', function () {
    $table = trackerTable(IntegrationProvider::GitHub, IntegrationAccess::Read);
    $task = gitHubSyncTask($table, '5');

    expect(PokerTaskSync::for($table['game'])->unsupportedReason($task))->toBe('This GitHub connection is read-only.');
});

it('reads tracked issues in batches of 100 per repository', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/graphql' => gitHubGraphqlIssues(collect(range(1, 150))->reject(fn (int $number) => $number === 42)->mapWithKeys(fn (int $number) => [$number => gitHubIssue($number)])->all()),
    ]);
    $integration = TeamIntegration::factory()->gitHub()->create();
    $ids = array_map(fn (int $number): string => "9001/{$number}", range(1, 150));

    $issues = app(GitHubTracker::class)->issues($integration, $ids);

    expect($issues)->toHaveCount(149)
        ->and($issues)->not->toHaveKey('9001/42')
        ->and($issues['9001/7']->key)->toBe('acme/api#7');
    expect(Http::recorded(fn (Request $request) => $request->url() === 'https://api.github.com/graphql'))->toHaveCount(2);
    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.github.com/graphql'
        && $request['variables'] === ['owner' => 'acme', 'name' => 'api']
        && substr_count($request['query'], ': issue(number: ') === 100);
    Http::assertNotSent(fn (Request $request) => str_contains($request->url(), '/repositories/9001/issues/'));
});

it('refuses unsafe GitHub references', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9003' => Http::response(gitHubRepository(9003, 'acme/..')),
    ]);
    $integration = TeamIntegration::factory()->gitHub()->create();
    $tracker = app(GitHubTracker::class);

    expect($tracker->iterations($integration, '../9001'))->toBe([])
        ->and($tracker->iterationIssues($integration, '9001/../2')->issues)->toBe([])
        ->and($tracker->issues($integration, ['../1', '9001/abc']))->toBe([])
        ->and(fn () => $tracker->writeEstimate($integration, '9001/../7', '3'))->toThrow(EstimateRejected::class)
        ->and(fn () => $tracker->iterations($integration, '9003'))->toThrow(ProviderRejected::class);

    Http::assertNotSent(fn (Request $request) => str_contains($request->url(), '/milestones'));
});
```

In `tests/Feature/Integrations/IssueTrackersTest.php`, add `->and(app(Trackers::class)->for(IntegrationProvider::GitHub))->toBeInstanceOf(GitHubTracker::class)` to the map expectation.

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/GitHubTrackerTest.php`
Expected: FAIL — 404 on the `github` import routes.

- [ ] **Step 3: Search within a container**

In `IssueTracker`, change the search signature to:

```php
    /**
     * `$containerId` scopes the search where the source needs it (GitHub
     * searches one repository).
     */
    public function search(TeamIntegration $integration, string $query, ?string $containerId = null): TrackerIssueList;
```

and give `JiraIssueTracker::search()` and `LinearTracker::search()` the same trailing `?string $containerId = null` parameter (unused).

`PreviewPokerImport`: add `?string $containerId = null` as last parameter of `fetch()` and `handle()`, pass it to `$tracker->search($integration, (string) $query, $containerId)` and from `handle()` to `fetch()`. `ImportPokerTasks::fromSource()`: add `?string $containerId = null` last and pass it to `fetch()`.

`PokerImportPreviewsController::store()`: add `'container' => ['nullable', 'string', 'max:100'],` to the rules and pass `$validated['container'] ?? null` as last argument of `handle()`.

In `routes/web.php`, change the four `->where('source', 'jira|linear|jira_dc')` to `->where('source', 'jira|linear|jira_dc|github')`. Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 4: Implement the GitHub tracker**

Create `app/Support/Integrations/Trackers/GitHubTracker.php`:

```php
<?php

namespace App\Support\Integrations\Trackers;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\GitHub\EstimateBlock;
use App\Support\Integrations\GitHub\GitHubClient;
use App\Support\Integrations\Jira\AdfToMarkdown;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * GitHub Issues (spec 8 §4.2): repositories are containers, open
 * milestones iterations (`{repositoryId}/{milestone}`), issues are
 * `{repositoryId}/{number}` so renames do not break them, and the estimate
 * lives in the managed block of the body.
 */
class GitHubTracker implements IssueTracker
{
    private const Source = 'GitHub';

    private const WriteAttempts = 3;

    private const IssueBatch = 100;

    private const IssueFields = 'fragment IssueFields on Issue { number title body url state stateReason updatedAt assignees(first: 1) { nodes { login } } }';

    private const ReferencePattern = '~^(\d{1,20})/(\d{1,10})\z~';

    private const RepositoryIdPattern = '/^\d{1,20}\z/';

    private const ApiRepositoryPrefix = 'https://api.github.com/repos/';

    private const WebPrefix = 'https://github.com/';

    private const ScopeQualifiers = '/(?:^|\s)-?(?:repo|org|user|owner):\S+/i';

    public function __construct(private GitHubClient $client) {}

    public function containers(TeamIntegration $integration, ?string $query, int $page): array
    {
        $needle = Str::lower(trim((string) $query));
        $repositories = array_values(array_filter(
            $this->client->repositories($integration),
            fn (array $repository): bool => $needle === '' || str_contains(Str::lower($repository['name']), $needle),
        ));
        $offset = (max($page, 1) - 1) * self::ContainerPageSize;

        return [
            'containers' => array_slice($repositories, $offset, self::ContainerPageSize),
            'hasMore' => count($repositories) > $offset + self::ContainerPageSize,
        ];
    }

    /**
     * The open milestone with the earliest due date from today is active.
     */
    public function iterations(TeamIntegration $integration, string $containerId): array
    {
        if (preg_match(self::RepositoryIdPattern, $containerId) !== 1) {
            return [];
        }

        $fullName = $this->client->repositoryName($integration, $containerId);
        $milestones = array_values(array_filter(
            $this->client->get($integration, "repos/{$fullName}/milestones", ['state' => 'open', 'sort' => 'due_on', 'direction' => 'asc', 'per_page' => self::PreviewLimit]),
            fn (mixed $milestone): bool => is_array($milestone) && is_int($milestone['number'] ?? null),
        ));
        $today = now()->toDateString();
        $active = collect($milestones)
            ->filter(fn (array $milestone): bool => ($this->day($milestone['due_on'] ?? null) ?? '') >= $today)
            ->sortBy(fn (array $milestone): string => (string) $this->day($milestone['due_on'] ?? null))
            ->first();

        return array_map(fn (array $milestone): array => [
            'id' => "{$containerId}/{$milestone['number']}",
            'name' => is_string($milestone['title'] ?? null) && $milestone['title'] !== ''
                ? $milestone['title']
                : __('Milestone :number', ['number' => (string) $milestone['number']]),
            'state' => $active !== null && $active['number'] === $milestone['number'] ? 'active' : 'upcoming',
            'startsOn' => null,
            'endsOn' => $this->day($milestone['due_on'] ?? null),
        ], $milestones);
    }

    public function iterationIssues(TeamIntegration $integration, string $iterationId): TrackerIssueList
    {
        $reference = self::issueReference($iterationId);

        if ($reference === null) {
            return new TrackerIssueList([], false);
        }

        [$repositoryId, $milestone] = $reference;
        $fullName = $this->client->repositoryName($integration, $repositoryId);
        $response = $this->client->response($integration, 'GET', "repos/{$fullName}/issues", [
            'milestone' => $milestone,
            'state' => 'open',
            'per_page' => self::PreviewLimit,
        ]);

        return $this->list($repositoryId, (array) $response->json(), GitHubClient::hasNextPage($response));
    }

    public function search(TeamIntegration $integration, string $query, ?string $containerId = null): TrackerIssueList
    {
        if ($containerId === null || preg_match(self::RepositoryIdPattern, $containerId) !== 1) {
            throw ValidationException::withMessages(['container' => __('Choose a repository to search in.')]);
        }

        $fullName = $this->client->repositoryName($integration, $containerId);
        $text = trim((string) preg_replace(self::ScopeQualifiers, ' ', $query));
        $response = $this->client->get($integration, 'search/issues', [
            'q' => trim("{$text} repo:{$fullName} is:issue"),
            'per_page' => self::PreviewLimit,
        ]);
        $items = (array) ($response['items'] ?? []);

        return $this->list($containerId, $items, (int) ($response['total_count'] ?? 0) > count($items) || ($response['incomplete_results'] ?? false) === true);
    }

    /**
     * Refreshes and polls read many issues: one GraphQL request per
     * repository and 100 issues instead of one REST call per issue.
     */
    public function issues(TeamIntegration $integration, array $externalIds): array
    {
        $numbersByRepository = [];

        foreach (array_unique($externalIds) as $externalId) {
            $reference = self::issueReference($externalId);

            if ($reference !== null) {
                $numbersByRepository[$reference[0]][] = $reference[1];
            }
        }

        $issues = [];

        foreach ($numbersByRepository as $repositoryId => $numbers) {
            foreach (array_chunk($numbers, self::IssueBatch) as $batch) {
                foreach ($this->fetchMany($integration, (string) $repositoryId, $batch) as $raw) {
                    $issue = $this->issue((string) $repositoryId, $raw);

                    if ($issue !== null) {
                        $issues[$issue->externalId] = $issue;
                    }
                }
            }
        }

        return $issues;
    }

    /**
     * Read-modify-write on the freshest body; the written body must come
     * back with exactly the new block and the text that was read around it,
     * otherwise an edit landed in between and the write starts over.
     */
    public function writeEstimate(TeamIntegration $integration, string $externalId, ?string $estimate): void
    {
        $reference = self::issueReference($externalId);

        if ($reference === null) {
            throw new EstimateRejected(__('This issue was not found in :source.', ['source' => self::Source]));
        }

        $integration->ensureWritable();

        for ($attempt = 1; $attempt <= self::WriteAttempts; $attempt++) {
            $issue = $this->fetch($integration, $reference[0], $reference[1]);
            $fullName = $issue === null ? null : self::fullName($issue);

            if ($issue === null || $fullName === null) {
                throw new EstimateRejected(__('This issue was not found in :source.', ['source' => self::Source]));
            }

            $body = is_string($issue['body'] ?? null) ? $issue['body'] : '';

            try {
                $written = EstimateBlock::apply($body, $estimate);
            } catch (InvalidArgumentException) {
                throw new EstimateRejected(__('This card is not an estimate.'));
            }

            if ($written === $body) {
                return;
            }

            if (mb_strlen($written) > EstimateBlock::MaxBodyLength) {
                throw new EstimateRejected(__('The issue description is too long to add the estimate.'));
            }

            $updated = $this->client->patch($integration, "repos/{$fullName}/issues/{$reference[1]}", ['body' => $written]);

            if (self::landed($updated['body'] ?? null, $written, $estimate)) {
                return;
            }
        }

        throw new EstimateRejected(__('The issue description kept changing. Try again.'));
    }

    /**
     * @return array{0: string, 1: string}|null
     */
    public static function issueReference(string $externalId): ?array
    {
        return preg_match(self::ReferencePattern, $externalId, $match) === 1 ? [$match[1], $match[2]] : null;
    }

    /**
     * @param  array<array-key, mixed>  $issue
     */
    public static function fullName(array $issue): ?string
    {
        $url = $issue['repository_url'] ?? null;

        if (! is_string($url) || ! str_starts_with($url, self::ApiRepositoryPrefix)) {
            return null;
        }

        return GitHubClient::safeFullName(substr($url, strlen(self::ApiRepositoryPrefix)));
    }

    /**
     * @param  array<array-key, mixed>  $raw
     */
    protected function issue(string $repositoryId, array $raw): ?TrackerIssue
    {
        $number = $raw['number'] ?? null;
        $fullName = self::fullName($raw);
        $url = $raw['html_url'] ?? null;

        if (! is_int($number) || $fullName === null || ! is_string($url) || ! str_starts_with($url, self::WebPrefix."{$fullName}/issues/")) {
            return null;
        }

        $key = "{$fullName}#{$number}";
        $body = is_string($raw['body'] ?? null) ? $raw['body'] : '';
        $description = trim(EstimateBlock::strip($body));
        $estimate = EstimateBlock::value($body);

        return new TrackerIssue(
            externalId: "{$repositoryId}/{$number}",
            key: $key,
            title: TrackerIssue::title($raw['title'] ?? null, $key),
            description: $description === '' ? null : AdfToMarkdown::truncate($description),
            url: $url,
            assignee: TrackerIssue::shorten(data_get($raw, 'assignees.0.login'), TrackerIssue::AssigneeLength),
            estimate: $estimate === null ? null : mb_substr($estimate, 0, TrackerIssue::EstimateLength),
            status: TrackerIssue::shorten($raw['state'] ?? null, TrackerIssue::AssigneeLength),
        );
    }

    /**
     * @return array<array-key, mixed>|null
     */
    private function fetch(TeamIntegration $integration, string $repositoryId, string $number): ?array
    {
        try {
            $issue = $this->client->get($integration, "repositories/{$repositoryId}/issues/{$number}");
        } catch (ProviderRejected $exception) {
            if (in_array($exception->httpStatus, [404, 410], true)) {
                return null;
            }

            throw $exception;
        }

        return isset($issue['pull_request']) ? null : $issue;
    }

    /**
     * Up to 100 issues of one repository in one GraphQL request, reshaped
     * like the REST issue so `issue()` reads both. Deleted issues and pull
     * requests come back null with a NOT_FOUND error and are left out, as is
     * a repository the installation no longer sees.
     *
     * @param  array<int, string>  $numbers  digits only (`ReferencePattern`)
     * @return array<int, array<string, mixed>>
     */
    private function fetchMany(TeamIntegration $integration, string $repositoryId, array $numbers): array
    {
        try {
            $fullName = $this->client->repositoryName($integration, $repositoryId);
        } catch (ProviderRejected $exception) {
            if (in_array($exception->httpStatus, [404, 410], true)) {
                return [];
            }

            throw $exception;
        }

        [$owner, $name] = explode('/', $fullName, 2);
        $aliases = implode(' ', array_map(fn (string $number): string => "i{$number}: issue(number: {$number}) { ...IssueFields }", $numbers));
        $response = $this->client->post($integration, 'graphql', [
            'query' => "query(\$owner: String!, \$name: String!) { repository(owner: \$owner, name: \$name) { {$aliases} } } ".self::IssueFields,
            'variables' => ['owner' => $owner, 'name' => $name],
        ]);
        $errors = array_filter((array) ($response['errors'] ?? []), fn (mixed $error): bool => data_get($error, 'type') !== 'NOT_FOUND');

        if ($errors !== []) {
            throw new ProviderRejected(IntegrationProvider::GitHub, 'graphql_error', 502, array_values($errors));
        }

        $issues = [];

        foreach ((array) data_get($response, 'data.repository', []) as $node) {
            if (! is_array($node)) {
                continue;
            }

            $issues[] = [
                'number' => $node['number'] ?? null,
                'title' => $node['title'] ?? null,
                'body' => $node['body'] ?? null,
                'html_url' => $node['url'] ?? null,
                'repository_url' => self::ApiRepositoryPrefix.$fullName,
                'state' => strtolower((string) ($node['state'] ?? '')),
                'state_reason' => is_string($node['stateReason'] ?? null) ? strtolower($node['stateReason']) : null,
                'updated_at' => $node['updatedAt'] ?? null,
                'assignees' => array_map(fn (mixed $assignee): array => ['login' => data_get($assignee, 'login')], (array) data_get($node, 'assignees.nodes', [])),
            ];
        }

        return $issues;
    }

    private static function landed(mixed $body, string $written, ?string $estimate): bool
    {
        $body = is_string($body) ? $body : '';

        return EstimateBlock::count($body) === ($estimate === null ? 0 : 1)
            && EstimateBlock::value($body) === $estimate
            && EstimateBlock::strip($body) === EstimateBlock::strip($written);
    }

    /**
     * @param  array<array-key, mixed>  $items
     */
    private function list(string $repositoryId, array $items, bool $truncated): TrackerIssueList
    {
        $issues = [];

        foreach ($items as $raw) {
            if (is_array($raw) && ! isset($raw['pull_request']) && ($issue = $this->issue($repositoryId, $raw)) !== null) {
                $issues[] = $issue;
            }
        }

        return new TrackerIssueList($issues, $truncated);
    }

    private function day(mixed $value): ?string
    {
        return is_string($value) && strlen($value) >= 10 ? substr($value, 0, 10) : null;
    }
}
```

In `Trackers::for()`, add `IntegrationProvider::GitHub => app(GitHubTracker::class),`.

In `PokerTaskSync`, add

```php
    /**
     * GitHub keeps the card label as text, so every deck can be written
     * (spec 8 §4.2); Jira and Linear hold numbers only.
     */
    public static function writesAnyDeck(IntegrationProvider $provider): bool
    {
        return $provider === IntegrationProvider::GitHub;
    }
```

and change the deck check of `unsupportedReason()` to `if (! $this->game->isNumeric() && ! self::writesAnyDeck($provider)) {`.

- [ ] **Step 5: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Milestone :number` | `Jalon :number` | `Hito :number` | `Meilenstein :number` |
| `Choose a repository to search in.` | `Choisissez un dépôt dans lequel chercher.` | `Elige un repositorio en el que buscar.` | `Wähle ein Repository für die Suche.` |
| `This card is not an estimate.` | `Cette carte n'est pas une estimation.` | `Esta carta no es una estimación.` | `Diese Karte ist keine Schätzung.` |
| `The issue description is too long to add the estimate.` | `La description du ticket est trop longue pour y ajouter l'estimation.` | `La descripción de la incidencia es demasiado larga para añadir la estimación.` | `Die Issue-Beschreibung ist zu lang, um die Schätzung hinzuzufügen.` |
| `The issue description kept changing. Try again.` | `La description du ticket n'a pas cessé de changer. Réessayez.` | `La descripción de la incidencia no dejó de cambiar. Inténtalo de nuevo.` | `Die Issue-Beschreibung hat sich ständig geändert. Versuche es erneut.` |

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/GitHubTrackerTest.php tests/Feature/Integrations/IssueTrackersTest.php tests/Feature/Integrations/PokerImportTest.php tests/Feature/Integrations/PokerImportBrowsingTest.php tests/Feature/Integrations/PokerEstimateSyncTest.php tests/Feature/Integrations/JiraDataCenterTrackerTest.php tests/Feature/Mcp/TrackerToolsTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 7: Commit**

```bash
git add app/Support/Integrations/Trackers/GitHubTracker.php app/Support/Integrations/Trackers/IssueTracker.php app/Support/Integrations/Trackers/JiraIssueTracker.php app/Support/Integrations/Trackers/LinearTracker.php app/Support/Integrations/Trackers/Trackers.php app/Actions/Integrations/PreviewPokerImport.php app/Actions/Integrations/ImportPokerTasks.php app/Actions/Integrations/PokerTaskSync.php app/Http/Controllers/Integrations/PokerImportPreviewsController.php routes/web.php tests/Pest.php tests/Feature/Integrations/GitHubTrackerTest.php tests/Feature/Integrations/IssueTrackersTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): import GitHub issues and write estimates into their managed block

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 9: GitHub action item export, priority labels and SSO-linked people

**Files:**
- Create: `app/Actions/Integrations/ExportToGitHub.php`
- Modify: `app/Actions/Integrations/{ExportActionItem,ExportActionItemRules,ActionItemExportGuard,ListExportTargets,ListProviderPriorities,ResolveExportPriority,ResolveExportAssignee,PreviewActionItemExport,MatchIntegrationUserAccounts,UpdateTeamIntegration,PresentTeamIntegration}.php`, `app/Support/Integrations/IntegrationUserAccounts.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Integrations/GitHubExportTest.php`

**Interfaces:**
- Consumes: Tasks 5, 6, 8; `IssueDraft`, `ExportAssignee`, `ExportPriority`, `ExportOutcome`, `CreatedIssue`, `ExportWarningCode`, `IntegrationUserMatch::Sso` (14a), `SocialAccount` (`provider = github`, `provider_user_id` = GitHub user id).
- Produces: `ExportToGitHub::create()`; `repository_id` export target, `exportRepositoryId`; `ListExportTargets` GitHub shape `{repositories: [{id, name}], defaults: {repositoryId}}`; `ResolveExportPriority::gitHubLabel()`; `ResolveExportAssignee::canLookUp()`; `IntegrationUserAccounts::matchSso()` and GitHub `find`/`search`; SSO matching with `matched_by = sso`; `priority_labels` setting; presenter keys for `github`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/GitHubExportTest.php`:

```php
<?php

use App\Actions\Integrations\MatchIntegrationUserAccounts;
use App\Enums\ActionItemPriority;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Events\Retros\ActionItemExternalLinksChanged;
use App\Events\Retros\ActionItemSaved;
use App\Events\Retros\CarriedActionItemSaved;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationUserMapping;
use App\Models\SocialAccount;
use App\Models\TeamIntegration;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    Event::fake([ActionItemSaved::class, TeamActionItemSaved::class, CarriedActionItemSaved::class, ActionItemExternalLinksChanged::class]);
    enableIntegrations(IntegrationProvider::GitHub);
});

/**
 * @param  array<string, mixed>  $routes
 */
function fakeGitHubExport(array $routes = []): void
{
    fakeGitHubTrackerApi([
        ...$routes,
        'api.github.com/user/583231' => Http::response(['id' => 583231, 'login' => 'octocat', 'type' => 'User']),
        'api.github.com/repos/acme/api/labels/*' => Http::response(['name' => 'priority: high']),
        'api.github.com/repos/acme/api/issues' => Http::response([
            'number' => 12,
            'html_url' => 'https://github.com/acme/api/issues/12',
            'assignees' => [['login' => 'octocat']],
        ], 201),
    ]);
}

function gitHubCreatedIssuePayload(): array
{
    $request = collect(Http::recorded())
        ->map(fn (array $pair): Request => $pair[0])
        ->first(fn (Request $request): bool => $request->method() === 'POST' && $request->url() === 'https://api.github.com/repos/acme/api/issues');

    return $request?->data() ?? [];
}

it('exports an action item to a GitHub repository', function () {
    fakeGitHubExport();
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::High, 'due_on' => '2026-10-20', 'content' => "Speed up CI\nPing @core-team"]);
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $retro->team_id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'priorityLabels' => ['high' => 'priority: high']]])->save();
    $assignee = teamMember($retro->team);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $assignee->id, 'external_account_id' => '583231']);
    $item->update(['assignee_user_id' => $assignee->id]);

    $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'github', 'repository_id' => '9001'])
        ->assertCreated()
        ->assertJsonPath('actionItem.externalLinks', [['source' => 'github', 'key' => 'acme/api#12', 'url' => 'https://github.com/acme/api/issues/12']])
        ->assertJsonPath('warnings', []);

    $payload = gitHubCreatedIssuePayload();

    expect($payload['title'])->toBe('Speed up CI')
        ->and($payload['assignees'])->toBe(['octocat'])
        ->and($payload['labels'])->toBe(['priority: high'])
        ->and($payload['body'])->toContain("Ping @\u{200B}core-team")
        ->and($payload['body'])->not->toContain('@core-team')
        ->and($payload['body'])->toContain('From the retrospective "Sprint 12"')
        ->and($payload['body'])->toEndWith("\n\nDue: 2026-10-20");

    $link = ActionItemExternalLink::query()->sole();

    expect($link->external_id)->toBe('9001/12')
        ->and($link->external_site)->toBe('4242')
        ->and($integration->fresh()?->setting('exportRepositoryId'))->toBe('9001');
    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.github.com/repos/acme/api/labels/priority%3A%20high');
});

it('warns when GitHub drops the assignee and the label is missing', function () {
    fakeGitHubExport([
        'api.github.com/repos/acme/api/labels/*' => Http::response(['message' => 'Not Found'], 404),
        'api.github.com/repos/acme/api/issues' => Http::response(['number' => 12, 'html_url' => 'https://github.com/acme/api/issues/12', 'assignees' => []], 201),
    ]);
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::High]);
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $retro->team_id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'priorityLabels' => ['high' => 'urgent']]])->save();
    $assignee = teamMember($retro->team);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $assignee->id, 'external_account_id' => '583231']);
    $item->update(['assignee_user_id' => $assignee->id]);

    $response = $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'github', 'repository_id' => '9001'])
        ->assertCreated();

    expect(array_column($response->json('warnings'), 'code'))->toBe(['assigneeRejected', 'priorityUnavailable'])
        ->and(gitHubCreatedIssuePayload())->not->toHaveKey('labels');
});

it('never builds a label path from . or ..', function () {
    fakeGitHubExport();
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::High]);
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $retro->team_id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'priorityLabels' => ['high' => '..']]])->save();

    $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'github', 'repository_id' => '9001'])
        ->assertCreated()
        ->assertJsonPath('warnings.0.code', 'priorityUnavailable');

    Http::assertNotSent(fn (Request $request) => str_contains($request->url(), '/labels/'));
});

it('validates the repository id before calling GitHub', function () {
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->gitHub()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'github', 'repository_id' => '../9001'])
        ->assertJsonValidationErrors('repository_id');

    Http::assertNothingSent();
});

it('lists repositories as export targets', function () {
    fakeGitHubTrackerApi();
    $integration = TeamIntegration::factory()->gitHub()->create();
    $team = $integration->team;

    $this->actingAs(integrationAdmin($team))
        ->getJson(route('teams.integrations.targets.index', [$team->workspace, $team, $integration, 'q' => 'web']))
        ->assertOk()
        ->assertExactJson(['repositories' => [['id' => '9002', 'name' => 'acme/web']], 'defaults' => ['repositoryId' => '9002']]);
});

it('maps members through their GitHub sign-in only', function () {
    fakeGitHubExport();
    $integration = TeamIntegration::factory()->gitHub()->create();
    $linked = teamMember($integration->team);
    $unlinked = teamMember($integration->team);
    SocialAccount::factory()->create(['user_id' => $linked->id, 'provider' => 'github', 'provider_user_id' => '583231']);
    SocialAccount::factory()->create(['user_id' => $unlinked->id, 'provider' => 'google', 'provider_user_id' => '583231']);

    app(MatchIntegrationUserAccounts::class)->handle($integration);

    $mapping = $integration->userMappings()->sole();

    expect($mapping->user_id)->toBe($linked->id)
        ->and($mapping->matched_by)->toBe(IntegrationUserMatch::Sso)
        ->and($mapping->external_account_id)->toBe('583231')
        ->and($mapping->external_display_name)->toBe('octocat');
    Http::assertNotSent(fn (Request $request) => str_contains($request->url(), 'search'));
});

it('searches organization members for manual mappings', function () {
    fakeGitHubTrackerApi([
        'api.github.com/orgs/acme/members*' => Http::response([
            ['id' => 583231, 'login' => 'octocat', 'type' => 'User'],
            ['id' => 2, 'login' => 'hubot', 'type' => 'User'],
        ]),
    ]);
    $integration = TeamIntegration::factory()->gitHub()->create();
    $team = $integration->team;

    $this->actingAs(integrationAdmin($team))
        ->getJson(route('teams.integrations.accounts.index', [$team->workspace, $team, $integration, 'q' => 'oct']))
        ->assertOk()
        ->assertExactJson([['accountId' => '583231', 'displayName' => 'octocat']]);
});

it('saves priority labels but never . or ..', function () {
    $integration = TeamIntegration::factory()->gitHub()->create();
    $team = $integration->team;
    $admin = integrationAdmin($team);
    $url = route('teams.integrations.update', [$team->workspace, $team, $integration]);

    $this->actingAs($admin)->patchJson($url, ['priority_labels' => ['high' => 'priority: high', 'low' => '..']])
        ->assertJsonValidationErrors('priority_labels.low');

    $this->actingAs($admin)->patchJson($url, ['priority_labels' => ['high' => ' priority: high ', 'medium' => null]])
        ->assertOk()
        ->assertJsonPath('settings.priorityLabels.high', 'priority: high')
        ->assertJsonPath('settings.priorityLabels.medium', null);

    $this->actingAs(teamMember($team))->patchJson($url, ['priority_labels' => ['high' => 'x']])->assertForbidden();
});

it('announces the sign-in match and the label in the export preview', function () {
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::High]);
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $retro->team_id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'priorityLabels' => ['high' => 'priority: high']]])->save();
    $assignee = teamMember($retro->team);
    SocialAccount::factory()->create(['user_id' => $assignee->id, 'provider' => 'github', 'provider_user_id' => '583231']);
    $item->update(['assignee_user_id' => $assignee->id]);

    $this->actingAs($author)
        ->getJson(route('retros.action-items.exports.preview', [$retro, $item, 'source' => 'github']))
        ->assertOk()
        ->assertExactJson(['assignee' => ['state' => 'willMatch', 'displayName' => $assignee->name], 'priority' => ['name' => 'priority: high']]);

    Http::assertNothingSent();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/GitHubExportTest.php`
Expected: FAIL — `source` `github` refused (422) and `Class "App\Actions\Integrations\ExportToGitHub" not found`.

- [ ] **Step 3: Export to GitHub**

Create `app/Actions/Integrations/ExportToGitHub.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;
use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\IssueCreationUncertain;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\GitHub\GitHubClient;
use App\Support\Integrations\IntegrationUserAccounts;
use Illuminate\Support\Str;

/**
 * Spec 8 §4.2 export: a Markdown body as Linear's plus the due date, the
 * mapped account's current login, and the priority's label when the
 * repository has it. GitHub silently drops assignees without access, so the
 * response is compared. Mentions in the item are neutralized.
 */
class ExportToGitHub
{
    private const MentionPattern = '/@(?=[A-Za-z0-9])/';

    private const UnsafeLabels = ['.', '..'];

    public function __construct(
        private GitHubClient $client,
        private IntegrationUserAccounts $accounts,
        private ResolveExportPriority $resolvePriority,
    ) {}

    /**
     * @param  array{repository_id: string}  $target
     */
    public function create(TeamIntegration $integration, ActionItem $item, IssueDraft $draft, ExportAssignee $assignee, array $target): ExportOutcome
    {
        $fullName = $this->client->repositoryName($integration, $target['repository_id']);
        $priority = $this->priority($integration, $item, $fullName);
        $login = $assignee->accountId === null ? null : $this->login($integration, $assignee->accountId);

        if ($assignee->accountId !== null && $login === null) {
            $assignee = $assignee->withoutAccount(ExportWarningCode::AssigneeRejected);
        }

        $payload = array_filter([
            'title' => $draft->title,
            'body' => $this->body($draft),
            'assignees' => $login === null ? null : [$login],
            'labels' => $priority->value === null ? null : [(string) $priority->value],
        ], fn (mixed $value): bool => $value !== null);

        try {
            $issue = $this->send($integration, $fullName, $payload);
        } catch (ProviderRejected $exception) {
            if (! isset($payload['assignees']) || $exception->httpStatus !== 422) {
                throw $exception;
            }

            unset($payload['assignees']);
            $assignee = $assignee->withoutAccount(ExportWarningCode::AssigneeRejected);
            $issue = $this->send($integration, $fullName, $payload);
        }

        $number = $issue['number'] ?? null;
        $url = $issue['html_url'] ?? null;

        if (! is_int($number) || ! is_string($url) || ! str_starts_with($url, "https://github.com/{$fullName}/issues/")) {
            throw new IssueCreationUncertain(IntegrationProvider::GitHub, 'invalid_issue_response');
        }

        if (isset($payload['assignees']) && ! $this->isAssigned($issue, (string) $login)) {
            $assignee = $assignee->withoutAccount(ExportWarningCode::AssigneeRejected);
        }

        return new ExportOutcome(
            new CreatedIssue("{$target['repository_id']}/{$number}", "{$fullName}#{$number}", $url),
            $assignee,
            $priority,
        );
    }

    private function body(IssueDraft $draft): string
    {
        $lines = array_map(fn (string $line): string => (string) preg_replace(self::MentionPattern, "@\u{200B}", $line), $draft->lines);
        $body = implode("\n\n", $lines)."\n\n{$draft->origin} {$draft->link}";

        return $draft->dueOn === null ? $body : $body."\n\n".__('Due: :date', ['date' => $draft->dueOn]);
    }

    private function priority(TeamIntegration $integration, ActionItem $item, string $fullName): ExportPriority
    {
        $label = $this->resolvePriority->gitHubLabel($item, $integration);

        if ($label === null) {
            return new ExportPriority(null);
        }

        if (in_array($label, self::UnsafeLabels, true)) {
            return new ExportPriority(null, ExportWarningCode::PriorityUnavailable, $label);
        }

        try {
            $this->client->get($integration, "repos/{$fullName}/labels/".rawurlencode($label));
        } catch (ProviderRejected $exception) {
            if ($exception->httpStatus !== 404) {
                throw $exception;
            }

            return new ExportPriority(null, ExportWarningCode::PriorityUnavailable, $label);
        }

        return new ExportPriority($label, null, $label);
    }

    /**
     * The mapping keeps the numeric id; the login is read now, so renamed
     * accounts are still assigned.
     */
    private function login(TeamIntegration $integration, string $accountId): ?string
    {
        try {
            return $this->accounts->find($integration, $accountId)?->displayName;
        } catch (IntegrationException) {
            return null;
        }
    }

    /**
     * @param  array<array-key, mixed>  $issue
     */
    private function isAssigned(array $issue, string $login): bool
    {
        foreach ((array) ($issue['assignees'] ?? []) as $assigned) {
            if (Str::lower((string) data_get($assigned, 'login')) === Str::lower($login)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<array-key, mixed>
     */
    private function send(TeamIntegration $integration, string $fullName, array $payload): array
    {
        try {
            return $this->client->post($integration, "repos/{$fullName}/issues", $payload);
        } catch (ProviderUnavailable $exception) {
            if ($exception->timedOut) {
                throw new IssueCreationUncertain(IntegrationProvider::GitHub, $exception->detail());
            }

            throw $exception;
        }
    }
}
```

`ExportActionItem`: inject `private ExportToGitHub $exportToGitHub` (after `ExportToLinear`), add the arm `IntegrationProvider::GitHub => $this->exportToGitHub->create($integration, $locked, $draft, $assignee, ['repository_id' => $this->targetId($target, 'repository_id')]),` and to `rememberTarget()`'s match `IntegrationProvider::GitHub => ['exportRepositoryId' => $target['repository_id']],` (before `default`).

`ExportActionItemRules::rules()`: add `'repository_id' => ['exclude_unless:source,github', 'required', 'string', 'regex:/^\d{1,20}\z/'],`. `ActionItemExportGuard::Sources` becomes `['jira', 'jira_dc', 'linear', 'github']`.

`ResolveExportPriority`: add

```php
    /**
     * Spec 8 §4.2: GitHub priorities are labels an admin names per level;
     * none configured means no label.
     */
    public function gitHubLabel(ActionItem $item, TeamIntegration $integration): ?string
    {
        $label = data_get($integration->settings, 'priorityLabels.'.$item->priority->value);

        return is_string($label) && trim($label) !== '' ? trim($label) : null;
    }
```

and at the top of `preview()`:

```php
        if ($integration->provider === IntegrationProvider::GitHub) {
            return $this->gitHubLabel($item, $integration);
        }
```

`ListProviderPriorities::handle()`: add first `if ($integration->provider === IntegrationProvider::GitHub) { return []; }` (GitHub priorities are free-text labels, see `priority_labels`).

`ListExportTargets`: inject `private GitHubClient $gitHub` (third), add `IntegrationProvider::GitHub => $this->gitHubTargets($integration, $query),` to the `match`, and:

```php
    /**
     * @return array{repositories: array<int, array{id: string, name: string}>, defaults: array{repositoryId: ?string}}
     */
    private function gitHubTargets(TeamIntegration $integration, ?string $query): array
    {
        $needle = Str::lower(trim((string) $query));
        $all = $this->gitHub->repositories($integration);
        $listed = array_slice(array_values(array_filter(
            $all,
            fn (array $repository): bool => $needle === '' || str_contains(Str::lower($repository['name']), $needle),
        )), 0, self::ProjectLimit);
        $saved = collect($all)->first(fn (array $repository): bool => $repository['id'] === $integration->setting('exportRepositoryId'));

        if ($saved !== null && $needle === '' && $this->listed($listed, $saved['id']) === null) {
            array_unshift($listed, $saved);
        }

        return [
            'repositories' => $listed,
            'defaults' => ['repositoryId' => $this->listed($listed, $integration->setting('exportRepositoryId')) ?? ($listed[0]['id'] ?? null)],
        ];
    }
```

- [ ] **Step 4: GitHub accounts and SSO matching**

`IntegrationUserAccounts`: add `private GitHubClient $gitHub` to the constructor, `use App\Models\SocialAccount;`, `use App\Models\User;`, `use App\Enums\SsoProvider;`, `use App\Support\Integrations\GitHub\GitHubClient;`. In `find()` add

```php
                IntegrationProvider::GitHub => preg_match('/^\d{1,20}\z/', $accountId) === 1
                    ? $this->gitHubAccount($this->gitHub->get($integration, "user/{$accountId}"))
                    : null,
```

at the start of `matchEmails()` add `if ($integration->provider === IntegrationProvider::GitHub) { return []; }` (GitHub emails are mostly private: SSO links only), at the start of `search()`:

```php
        if ($integration->provider === IntegrationProvider::GitHub) {
            return $this->searchGitHub($integration, Str::lower($query));
        }
```

and add:

```php
    /**
     * Spec 8 §4.2: members who signed in to skrum with GitHub, keyed by
     * user id. No email is ever sent to GitHub.
     *
     * @param  iterable<int, User>  $members
     * @return array<string, ExternalAccount>
     */
    public function matchSso(TeamIntegration $integration, iterable $members): array
    {
        $ids = collect($members)->map(fn (User $member): string => $member->id)->all();
        $linked = SocialAccount::query()
            ->where('provider', SsoProvider::GitHub->value)
            ->whereIn('user_id', $ids)
            ->pluck('provider_user_id', 'user_id');
        $matches = [];

        foreach ($linked as $userId => $gitHubUserId) {
            $account = $this->find($integration, (string) $gitHubUserId);

            if ($account !== null && $account->active) {
                $matches[(string) $userId] = $account;
            }
        }

        return $matches;
    }

    /**
     * Organization members, or the export repository's collaborators for an
     * installation on a personal account; filtered here by login.
     *
     * @return array<int, ExternalAccount>
     */
    private function searchGitHub(TeamIntegration $integration, string $needle): array
    {
        $login = $integration->setting('accountLogin');
        $repositoryId = $integration->setting('exportRepositoryId');

        $users = match (true) {
            $integration->setting('accountType') === 'Organization' && GitHubClient::isLogin($login) => $this->gitHub->get($integration, "orgs/{$login}/members", ['per_page' => 100]),
            is_string($repositoryId) => $this->gitHub->get($integration, 'repos/'.$this->gitHub->repositoryName($integration, $repositoryId).'/collaborators', ['per_page' => 100]),
            default => [],
        };

        $found = array_values(array_filter(
            array_map(fn (mixed $user): ?ExternalAccount => $this->gitHubAccount($user), $users),
            fn (?ExternalAccount $account): bool => $account !== null && $account->active && str_contains(Str::lower($account->displayName), $needle),
        ));

        return array_slice($found, 0, self::SearchLimit);
    }

    /**
     * The display name is the login; bots are never assignable.
     */
    private function gitHubAccount(mixed $user): ?ExternalAccount
    {
        if (! is_array($user) || ! is_int($user['id'] ?? null) || ! GitHubClient::isLogin($user['login'] ?? null)) {
            return null;
        }

        return new ExternalAccount((string) $user['id'], $user['login'], ($user['type'] ?? 'User') === 'User');
    }
```

Update the class docblock to "Accounts of the team's Jira site, Jira server, Linear workspace or GitHub installation. Provider emails are compared here, in memory, and never stored or returned; GitHub is matched through SSO links only."

`MatchIntegrationUserAccounts`: in `recheck()` replace `$mapping->matched_by === IntegrationUserMatch::Email` with `in_array($mapping->matched_by, [IntegrationUserMatch::Email, IntegrationUserMatch::Sso], true)`; at the start of `matchUnmapped()`, after `$mapped` is computed:

```php
        if ($integration->provider === IntegrationProvider::GitHub) {
            $members = $integration->team->members()->whereNotIn('users.id', $mapped)->get();

            foreach ($this->accounts->matchSso($integration, $members) as $userId => $account) {
                $integration->userMappings()->firstOrCreate(['user_id' => $userId], [
                    'external_account_id' => $account->id,
                    'external_display_name' => $account->displayName,
                    'matched_by' => IntegrationUserMatch::Sso,
                    'account_inactive' => false,
                    'checked_at' => now(),
                ]);
            }

            return;
        }
```

`ResolveExportAssignee`: replace `lookUp()` and the `firstOrCreate` `matched_by` value:

```php
            'matched_by' => $integration->provider === IntegrationProvider::GitHub ? IntegrationUserMatch::Sso : IntegrationUserMatch::Email,
```

```php
    /**
     * Whether an export may look this member up: GitHub through their
     * GitHub sign-in, the others by verified email.
     */
    public static function canLookUp(TeamIntegration $integration, User $user): bool
    {
        if ($integration->provider === IntegrationProvider::GitHub) {
            return $user->socialAccounts()->where('provider', SsoProvider::GitHub->value)->exists();
        }

        return $user->email_verified_at !== null && IntegrationMappingGuard::hasAccountScope($integration);
    }

    private function lookUp(TeamIntegration $integration, User $user): ?ExternalAccount
    {
        if (! self::canLookUp($integration, $user)) {
            return null;
        }

        try {
            return $integration->provider === IntegrationProvider::GitHub
                ? $this->accounts->matchSso($integration, [$user])[$user->id] ?? null
                : $this->accounts->matchEmails($integration, [$user->email])[Str::lower($user->email)] ?? null;
        } catch (IntegrationException) {
            return null;
        }
    }
```

(imports `App\Enums\IntegrationProvider`, `App\Enums\SsoProvider`). `PreviewActionItemExport::assignee()`: replace the `willMatch` condition with `if ($mapping === null && ResolveExportAssignee::canLookUp($integration, $user)) {`.

`UpdateTeamIntegration::rules()`: add

```php
            IntegrationProvider::GitHub => [
                'priority_labels' => ['sometimes', 'array:high,medium,low'],
                'priority_labels.*' => ['nullable', 'string', 'max:50', 'not_in:.,..'],
            ],
```

and in `handle()`, before `return $integration->refresh();`:

```php
        if (is_array($validated['priority_labels'] ?? null)) {
            $integration->ensureWritable();

            $labels = (array) $integration->setting('priorityLabels', []);

            foreach ($validated['priority_labels'] as $level => $label) {
                $labels[$level] = is_string($label) && trim($label) !== '' ? trim($label) : null;
            }

            $integration->forceFill(['settings' => [...$integration->settings, 'priorityLabels' => $labels]])->save();
        }
```

`PresentTeamIntegration::SettingKeys`: `'github' => ['installationId', 'accountLogin', 'accountType', 'exportRepositoryId', 'priorityLabels'],`.

- [ ] **Step 5: Add the translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Due: :date` | `Échéance : :date` | `Vence: :date` | `Fällig: :date` |

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/GitHubExportTest.php tests/Feature/Integrations/ActionItemExportTest.php tests/Feature/Integrations/ExportTargetsTest.php tests/Feature/Integrations/ExportResolutionTest.php tests/Feature/Integrations/PriorityMappingTest.php tests/Feature/Integrations/IntegrationUserAccountsTest.php tests/Feature/Integrations/UserMappingEndpointsTest.php tests/Feature/Integrations/MatchIntegrationUsersTest.php tests/Feature/Integrations/JiraDataCenterExportTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS. Then pint and phpstan (0 errors).

- [ ] **Step 7: Commit**

```bash
git add app/Actions/Integrations/ExportToGitHub.php app/Actions/Integrations/ExportActionItem.php app/Actions/Integrations/ExportActionItemRules.php app/Actions/Integrations/ActionItemExportGuard.php app/Actions/Integrations/ListExportTargets.php app/Actions/Integrations/ListProviderPriorities.php app/Actions/Integrations/ResolveExportPriority.php app/Actions/Integrations/ResolveExportAssignee.php app/Actions/Integrations/PreviewActionItemExport.php app/Actions/Integrations/MatchIntegrationUserAccounts.php app/Actions/Integrations/UpdateTeamIntegration.php app/Actions/Integrations/PresentTeamIntegration.php app/Support/Integrations/IntegrationUserAccounts.php tests/Feature/Integrations/GitHubExportTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): export action items to GitHub with SSO-linked assignees and priority labels

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 10: MCP tracker tools for Jira Data Center and GitHub

**Files:**
- Create: `app/Mcp/PokerTrackerSources.php`
- Modify: `app/Actions/Integrations/ListPokerSources.php`, `app/Mcp/Tools/Poker/{ListSources,ListIterations,ImportTasks}.php`
- Test: update `tests/Feature/Mcp/TrackerToolsTest.php`

**Interfaces:**
- Consumes: Tasks 4 and 8 (trackers, `fromSource(…, $containerId)`), `McpTrackers` (already counts every enabled tracker), 14a's `inbound_mode` cast and `settings.statusSync` (read only).
- Produces: `PokerTrackerSources::Values`; `poker.sources.list` items with `canSyncStatus` and `syncMode`; `source` enums with `jira_dc` and `github`; `container_id` required for GitHub queries.

- [ ] **Step 1: Write the failing tests**

In `tests/Feature/Mcp/TrackerToolsTest.php`, add `'canSyncStatus' => false, 'syncMode' => 'off'` at the end of both expected items of `lists the team trackers with their capabilities and nothing secret`, add `use App\Enums\IntegrationInboundMode;` and append:

```php
it('lists Jira Data Center and GitHub sources and never chat channels', function () {
    enableIntegrations(IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub, IntegrationProvider::MicrosoftTeams);
    $team = Team::factory()->create();
    $user = teamMember($team);
    TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Write, 'pat')->create(['team_id' => $team->id]);
    TeamIntegration::factory()->gitHub(IntegrationAccess::Read)->create(['team_id' => $team->id]);
    TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);

    $response = actingAsMcp($user)->tool(ListSources::class, ['team_id' => $team->id])->assertOk();

    expect(mcpStructured($response)['items'])->toBe([
        ['source' => 'jira_dc', 'siteName' => 'Acme Jira', 'status' => 'active', 'access' => 'write', 'canImport' => true, 'canWriteBack' => true, 'writeBackUnavailableReason' => null, 'canSyncStatus' => false, 'syncMode' => 'off'],
        ['source' => 'github', 'siteName' => 'acme', 'status' => 'active', 'access' => 'read', 'canImport' => true, 'canWriteBack' => false, 'writeBackUnavailableReason' => 'This GitHub connection is read-only.', 'canSyncStatus' => false, 'syncMode' => 'off'],
    ]);
    $response->assertDontSee([TeamIntegrationFactory::JiraDataCenterToken, 'logic.azure.com']);
});

it('reports status sync from the connection', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    $team = Team::factory()->create();
    $user = teamMember($team);
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $team->id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => true], 'inbound_mode' => IntegrationInboundMode::Polling])->save();

    expect(mcpStructured(actingAsMcp($user)->tool(ListSources::class, ['team_id' => $team->id])->assertOk())['items'][0])
        ->toMatchArray(['canWriteBack' => true, 'canSyncStatus' => true, 'syncMode' => 'polling']);
});

it('lists GitHub repositories and milestones', function () {
    $this->travelTo(Carbon::parse('2026-10-07 12:00:00'));
    enableIntegrations(IntegrationProvider::GitHub);
    $team = Team::factory()->create();
    $user = teamMember($team);
    TeamIntegration::factory()->gitHub()->create(['team_id' => $team->id]);
    fakeGitHubTrackerApi();

    expect(mcpStructured(actingAsMcp($user)->tool(ListIterations::class, ['team_id' => $team->id, 'source' => 'github'])->assertOk())['containers'])
        ->toBe([['id' => '9001', 'name' => 'acme/api'], ['id' => '9002', 'name' => 'acme/web']]);

    expect(mcpStructured(actingAsMcp($user)->tool(ListIterations::class, ['team_id' => $team->id, 'source' => 'github', 'container_id' => '9001'])->assertOk())['iterations'][1])
        ->toBe(['id' => '9001/2', 'name' => 'Sprint 2', 'state' => 'active', 'startsOn' => null, 'endsOn' => '2026-10-10']);
});

it('requires a repository for GitHub queries', function () {
    enableIntegrations(IntegrationProvider::GitHub);
    $team = Team::factory()->create();
    $user = teamMember($team);
    TeamIntegration::factory()->gitHub()->create(['team_id' => $team->id]);
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    fakeGitHubTrackerApi();

    mcpWriter($user)->tool(ImportTasks::class, ['game_id' => $game->id, 'source' => 'github', 'query' => 'login'])->assertHasErrors();

    expect(mcpStructured(mcpWriter($user)->tool(ImportTasks::class, ['game_id' => $game->id, 'source' => 'github', 'query' => 'login', 'container_id' => '9001'])->assertOk()))
        ->toBe(['imported' => 1, 'skipped' => 0, 'truncated' => false])
        ->and($game->tasks()->where('external_key', 'acme/api#7')->exists())->toBeTrue();
});

it('queues the block write of a GitHub task for the facilitator', function () {
    Queue::fake();
    enableIntegrations(IntegrationProvider::GitHub);
    $team = Team::factory()->create();
    $user = teamMember($team);
    TeamIntegration::factory()->gitHub()->create(['team_id' => $team->id]);
    $game = PokerGame::factory()->deck(PokerDeck::Tshirt)->create(['team_id' => $team->id]);
    $player = PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $user->id]);
    $game->forceFill(['facilitator_player_id' => $player->id])->save();
    $task = importedPokerTask($game, ['estimate' => 'XL', 'synced_at' => now()], IntegrationProvider::GitHub);

    expect(mcpStructured(mcpWriter($user)->tool(SyncTask::class, ['task_id' => $task->id])->assertOk()))->toBe(['syncState' => 'pending']);

    Queue::assertPushed(SyncTaskEstimate::class, fn (SyncTaskEstimate $job) => $job->taskId === $task->id);
});
```

(add `use App\Enums\PokerDeck;`, `use Database\Factories\TeamIntegrationFactory;`, `use Illuminate\Support\Carbon;` if missing).

- [ ] **Step 2: Run them to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/TrackerToolsTest.php`
Expected: FAIL — items lack `canSyncStatus`/`syncMode`; `source` `github` is refused by the tools' validation.

- [ ] **Step 3: Extend the sources and tools**

Create `app/Mcp/PokerTrackerSources.php`:

```php
<?php

namespace App\Mcp;

/**
 * The `source` values of every MCP tracker tool (spec 8 §7.1): trackers
 * only, never chat channels.
 */
class PokerTrackerSources
{
    public const Values = ['jira', 'jira_dc', 'linear', 'github'];
}
```

`ListPokerSources::handle()` — extend the docblock shape with `canSyncStatus: bool, syncMode: string` and each item with

```php
                'canSyncStatus' => $integration->isActive() && $integration->setting('statusSync') === true,
                'syncMode' => $integration->inbound_mode->value,
```

and `siteName()`'s `match` with

```php
            IntegrationProvider::JiraDataCenter => $integration->setting('serverTitle'),
            IntegrationProvider::GitHub => $integration->setting('accountLogin'),
```

`ListSources`: description `'List the issue trackers (Jira, Jira Data Center, Linear, GitHub) connected to a team for planning poker, with their status, whether tasks can be imported and estimates written back (GitHub: into the issue description, for every deck), and whether status sync is on. Chat channels, credentials and provider errors are never returned.'`

`ListIterations`: description `'Without container_id, list the first 50 containers of a connected tracker (Jira boards, Linear teams, GitHub repositories). With container_id, list its active and upcoming iterations (Jira sprints, Linear cycles, GitHub open milestones).'`; schema `'source' => $schema->string()->enum(PokerTrackerSources::Values)->required(),` and `'container_id' => $schema->string()->max(100)->description('A Jira board id, a Linear team id or a GitHub repository id.'),`; rule `'source' => ['required', 'string', Rule::in(PokerTrackerSources::Values)],`.

`ImportTasks`: description `'Import the issues of a tracker iteration (iteration_id: a Jira sprint, Linear cycle or GitHub milestone) or of a query (query: JQL for Jira, a search term for Linear or GitHub) into a planning poker game, in source order, at most 100 per call. GitHub queries need container_id (the repository). Issues already imported are skipped; a game holds at most 200 tasks.'`; schema enum `PokerTrackerSources::Values` and `'container_id' => $schema->string()->max(100)->description('The GitHub repository id for a query; accepted for Jira sprints, not needed.'),`; rules:

```php
            'source' => ['required', 'string', Rule::in(PokerTrackerSources::Values)],
            'container_id' => [
                'nullable',
                'string',
                'max:100',
                Rule::requiredIf(fn (): bool => $request->get('source') === 'github' && $request->get('iteration_id') === null),
            ],
```

and pass `$validated['container_id'] ?? null` as the last argument of `fromSource()`.

- [ ] **Step 4: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/TrackerToolsTest.php tests/Feature/Mcp/CatalogueTest.php tests/Feature/Mcp/McpSweepTest.php`
Expected: PASS (if `CatalogueTest` pins the tool descriptions, update its expected strings to the ones above). Then pint and phpstan (0 errors).

- [ ] **Step 5: Commit**

```bash
git add app/Mcp/PokerTrackerSources.php app/Actions/Integrations/ListPokerSources.php app/Mcp/Tools/Poker/ListSources.php app/Mcp/Tools/Poker/ListIterations.php app/Mcp/Tools/Poker/ImportTasks.php tests/Feature/Mcp/TrackerToolsTest.php
git commit -m "feat(mcp): list and use Jira Data Center and GitHub in the tracker tools

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 11: Integrations page cards, import and export dialogs

**Files:**
- Create: `resources/js/components/integrations/{jira-data-center-integration,jira-token-dialog,story-points-field,github-integration,github-priority-labels}.tsx`
- Modify: `resources/js/types/integrations.ts`, `resources/js/lib/poker/types.ts`, `resources/js/pages/teams/integrations.tsx`, `resources/js/components/integrations/{integration-actions,jira-integration,disconnect-integration-dialog,people-panel,priorities-panel}.tsx`, `resources/js/components/poker/{import-tasks-dialog,task-source-details}.tsx`, `resources/js/components/action-items/export-action-item-dialog.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: routes `teams.integrations.connect` (`jira_dc`, `github`), `teams.integrations.jiraDataCenterToken.store` (Wayfinder `JiraDataCenterTokensController.store`), `teams.integrations.update` (`priority_labels`), `teams.integrations.detection.store`, poker import routes (`container`), targets (`repositories`), presenter settings of Tasks 3 and 9, `providers[].authMethods`.
- Produces: the cards of spec §9 for Jira Data Center and GitHub (with a `statusSection?: ReactNode` slot for Plan 14d), `StoryPointsField` shared by both Jira cards, `DisconnectIntegrationDialog` `label`/`title` props, `isPokerTrackerSource()`, the four-tracker import and export dialogs.

No frontend test runner exists (spec §13); the behaviour behind these screens is covered by Tasks 1–10. Verify with type-check, lint and the walkthrough of Task 12.

- [ ] **Step 1: Extend the types**

In `resources/js/types/integrations.ts`:

```ts
export type IntegrationAuthMethod = 'oauth' | 'pat';
```

add to `IntegrationSettings`:

```ts
    serverTitle?: string;
    version?: string;
    baseUrl?: string;
    authMethod?: IntegrationAuthMethod;
    tokenOwner?: string | null;
    tokenSavedAt?: string | null;
    installationId?: string;
    accountLogin?: string;
    accountType?: 'Organization' | 'User';
    exportRepositoryId?: string;
    priorityLabels?: Partial<Record<PriorityLevel, string | null>>;
```

add `authMethods: IntegrationAuthMethod[];` to `IntegrationProviderCard`, change `TrackerProviderKey` to `'jira' | 'linear' | 'jira_dc' | 'github'`, `UserMapping.matchedBy` to `'email' | 'manual' | 'sso'`, and `ExportTargets` to add `repositories?: ExportTargetOption[];` and `repositoryId?: string | null;` in `defaults`.

In `resources/js/lib/poker/types.ts`:

```ts
export type PokerTrackerSource = 'jira' | 'linear' | 'jira_dc' | 'github';
```

```ts
export const TrackerLabels: Record<PokerTrackerSource, string> = {
    jira: 'Jira',
    linear: 'Linear',
    jira_dc: 'Jira Data Center',
    github: 'GitHub',
};

export function isPokerTrackerSource(value: string): value is PokerTrackerSource {
    return Object.hasOwn(TrackerLabels, value);
}
```

In `integration-actions.tsx`, widen `ConnectLinkProps.provider` to `'slack' | 'jira' | 'linear' | 'jira_dc' | 'github'`.

In `disconnect-integration-dialog.tsx`, add `label?: string; title?: string;` to `Props`, destructure them, and use `label ?? t('Disconnect')` for both buttons and `title ?? t('Disconnect :provider?', { provider: card.label })` for the `DialogTitle`.

- [ ] **Step 2: Share the story points field**

Create `resources/js/components/integrations/story-points-field.tsx` (the story points section of `ConnectedJira`, with its own busy state):

```tsx
import { router } from '@inertiajs/react';
import { RefreshCw } from 'lucide-react';
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
import type { IntegrationScope, TeamIntegration } from '@/types';

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

/** The story points field of a Jira Cloud or Jira Data Center connection. */
export function StoryPointsField({ scope, connection }: Props) {
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const numberFields = connection.settings.numberFields ?? [];
    const storyPointFields = connection.settings.storyPointFields ?? [];
    const target = { ...scope, integration: connection.id };

    const send = async (request: Promise<unknown>, successMessage: string) => {
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
        <div className="space-y-2">
            <p className="text-sm font-medium">{t('Story points field')}</p>
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
                            <SelectValue placeholder={t('Choose a field')} />
                        </SelectTrigger>
                        <SelectContent>
                            {numberFields.map((field) => (
                                <SelectItem key={field.id} value={field.id}>
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
    );
}
```

In `jira-integration.tsx`, replace the `<div className="space-y-2">` block that renders "Story points field" with `<StoryPointsField scope={scope} connection={connection} />`, and delete `chooseField`, `detect`, `numberFields`, `storyPointFields`, the `RefreshCw` icon and the `JiraFieldDetectionsController` import (`busy`/`send` stay for `chooseSite`).

- [ ] **Step 3: Create the Jira Data Center card and token dialog**

Create `resources/js/components/integrations/jira-token-dialog.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import JiraDataCenterTokensController from '@/actions/App/Http/Controllers/Integrations/JiraDataCenterTokensController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { IntegrationAccess, IntegrationScope } from '@/types';

type Props = {
    scope: IntegrationScope;
    label: string;
    variant?: 'default' | 'outline' | 'link';
};

/**
 * Spec 8 §4.1: a pasted personal access token acts as its owner, so saving
 * requires ticking "I understand". The token is never shown again.
 */
export function JiraTokenDialog({ scope, label, variant = 'default' }: Props) {
    const { t } = useTrans();
    const tokenId = useId();
    const acknowledgedId = useId();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [token, setToken] = useState('');
    const [access, setAccess] = useState<IntegrationAccess>('read');
    const [acknowledged, setAcknowledged] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const openDialog = () => {
        setToken('');
        setAccess('read');
        setAcknowledged(false);
        setError(undefined);
        setOpen(true);
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError(undefined);

        try {
            await retroRequest(JiraDataCenterTokensController.store(scope), {
                token,
                access,
                acknowledged,
            });
            setToken('');
            setOpen(false);
            toast.success(t('Token saved.'));
            router.reload({ only: ['providers'] });
        } catch (caught) {
            if (caught instanceof RetroRequestError && caught.status === 422) {
                setError(
                    caught.errors.token?.[0] ??
                        caught.errors.acknowledged?.[0] ??
                        caught.errors.access?.[0],
                );
            } else {
                toast.error(
                    integrationErrorMessage(caught, t('Something went wrong.')),
                );
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Button size="sm" variant={variant} onClick={openDialog}>
                {label}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <form
                        className="space-y-4"
                        onSubmit={(event) => void submit(event)}
                    >
                        <DialogTitle>{t('Personal access token')}</DialogTitle>
                        <DialogDescription>
                            {t(
                                'Create a token in Jira under Profile → Personal Access Tokens, then paste it here.',
                            )}
                        </DialogDescription>
                        <div className="space-y-2">
                            <Label htmlFor={tokenId}>
                                {t('Personal access token')}
                            </Label>
                            <Input
                                id={tokenId}
                                type="password"
                                required
                                minLength={20}
                                maxLength={255}
                                autoComplete="off"
                                value={token}
                                onChange={(event) =>
                                    setToken(event.target.value)
                                }
                            />
                            <InputError message={error} />
                        </div>
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            value={access}
                            onValueChange={(next) => {
                                if (next === 'read' || next === 'write') {
                                    setAccess(next);
                                }
                            }}
                            aria-label={t('Access')}
                        >
                            <ToggleGroupItem value="read">
                                {t('Read only')}
                            </ToggleGroupItem>
                            <ToggleGroupItem value="write">
                                {t('Read and write')}
                            </ToggleGroupItem>
                        </ToggleGroup>
                        <p
                            role="note"
                            className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                        >
                            {t(
                                'This token acts as its owner in Jira. Everything skrum does — imports, estimates, exported issues, status changes — will appear as done by them, and skrum sees only what they can see. Prefer OAuth when your Jira supports it.',
                            )}
                        </p>
                        <label
                            htmlFor={acknowledgedId}
                            className="flex items-center gap-2 text-sm"
                        >
                            <Checkbox
                                id={acknowledgedId}
                                checked={acknowledged}
                                onCheckedChange={(checked) =>
                                    setAcknowledged(checked === true)
                                }
                            />
                            {t('I understand')}
                        </label>
                        <DialogFooter className="gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setOpen(false)}
                            >
                                {t('Cancel')}
                            </Button>
                            <Button
                                type="submit"
                                disabled={busy || !acknowledged}
                            >
                                {busy && <Spinner />}
                                {t('Save token')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
```

Create `resources/js/components/integrations/jira-data-center-integration.tsx`:

```tsx
import { usePage } from '@inertiajs/react';
import { ExternalLink, ServerCog, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    TeamIntegration,
} from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { ConnectLink, TestConnectionButton } from './integration-actions';
import { IntegrationCard } from './integration-card';
import { IntegrationDetails } from './integration-details';
import { JiraTokenDialog } from './jira-token-dialog';
import { PeoplePanel } from './people-panel';
import { PrioritiesPanel } from './priorities-panel';
import { StoryPointsField } from './story-points-field';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
    statusSection?: ReactNode;
};

/**
 * Spec 8 §4.1: OAuth is the primary way in; a personal access token is
 * the fallback for older servers and is clearly labelled as acting as its
 * owner.
 */
export function JiraDataCenterIntegration({
    card,
    scope,
    statusSection,
}: Props) {
    const { t } = useTrans();
    const connection = card.connection;
    const allowsOAuth = card.authMethods.includes('oauth');
    const allowsToken = card.authMethods.includes('pat');

    if (connection === null) {
        return (
            <IntegrationCard
                icon={ServerCog}
                card={card}
                actions={
                    <>
                        {allowsOAuth && (
                            <>
                                <ConnectLink
                                    scope={scope}
                                    provider="jira_dc"
                                    access="read"
                                    label={t('Connect (read only)')}
                                    variant="outline"
                                />
                                <ConnectLink
                                    scope={scope}
                                    provider="jira_dc"
                                    access="write"
                                    label={t('Connect (read and write)')}
                                />
                            </>
                        )}
                        {allowsToken && (
                            <JiraTokenDialog
                                scope={scope}
                                label={
                                    allowsOAuth
                                        ? t(
                                              'Older Jira server? Use a personal access token',
                                          )
                                        : t('Use a personal access token')
                                }
                                variant={allowsOAuth ? 'link' : 'default'}
                            />
                        )}
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
        <ConnectedJiraDataCenter
            card={card}
            scope={scope}
            connection={connection}
            statusSection={statusSection}
        />
    );
}

function ConnectedJiraDataCenter({
    card,
    scope,
    connection,
    statusSection,
}: Props & { connection: TeamIntegration }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const { settings } = connection;
    const usesToken = settings.authMethod === 'pat';
    const owner = settings.tokenOwner ?? '';
    const active = connection.status === 'active';
    const savedOn = settings.tokenSavedAt
        ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
              new Date(settings.tokenSavedAt),
          )
        : '';

    return (
        <IntegrationCard
            icon={ServerCog}
            card={card}
            actions={
                <>
                    {usesToken ? (
                        <JiraTokenDialog
                            scope={scope}
                            label={t('Replace token')}
                            variant="outline"
                        />
                    ) : (
                        <>
                            <ConnectLink
                                scope={scope}
                                provider="jira_dc"
                                access={connection.access}
                                label={t('Reconnect')}
                                variant="outline"
                            />
                            {connection.access === 'read' && (
                                <ConnectLink
                                    scope={scope}
                                    provider="jira_dc"
                                    access="write"
                                    label={t('Upgrade to read and write')}
                                    variant="outline"
                                />
                            )}
                        </>
                    )}
                    {active && (
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
                        label={usesToken ? t('Remove token') : undefined}
                        title={usesToken ? t('Remove the token?') : undefined}
                        description={
                            usesToken
                                ? t(
                                      'skrum deletes the token. Ask :name to also revoke it in Jira under Profile → Personal Access Tokens.',
                                      { name: owner },
                                  )
                                : t(
                                      'Imported tasks and exported issues keep their links but are no longer synced, and the people and priority mappings are deleted. Also revoke skrum under "Authorized applications" in your Jira profile.',
                                  )
                        }
                    />
                </>
            }
        >
            {usesToken && (
                <div
                    role="note"
                    className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                >
                    <TriangleAlert
                        className="mt-0.5 size-4 shrink-0 text-amber-600"
                        aria-hidden
                    />
                    <div className="space-y-1">
                        <p className="font-medium">
                            {t('Acting as :name in Jira', { name: owner })}
                        </p>
                        <p>
                            {t(
                                'This token acts as :name in Jira. Everything skrum does — imports, estimates, exported issues, status changes — will appear as done by :name, and skrum sees only what :name can see. Prefer OAuth when your Jira supports it.',
                                { name: owner },
                            )}
                        </p>
                        <p className="text-muted-foreground">
                            {t('Token saved on :date', { date: savedOn })}
                        </p>
                    </div>
                </div>
            )}
            <IntegrationDetails
                connection={connection}
                rows={[
                    {
                        label: t('Jira server'),
                        value: settings.baseUrl ? (
                            <a
                                href={settings.baseUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 underline"
                            >
                                {settings.serverTitle}
                                <ExternalLink className="size-3" aria-hidden />
                            </a>
                        ) : (
                            settings.serverTitle
                        ),
                    },
                    { label: t('Version'), value: settings.version ?? '—' },
                    {
                        label: t('Access'),
                        value:
                            connection.access === 'write'
                                ? t('Read and write')
                                : t('Read only'),
                    },
                    {
                        label: t('Signed in with'),
                        value: usesToken
                            ? t('Personal access token')
                            : 'OAuth',
                    },
                ]}
            />
            <StoryPointsField scope={scope} connection={connection} />
            {active && connection.access === 'write' && (
                <>
                    <PeoplePanel
                        scope={scope}
                        connection={connection}
                        providerLabel={card.label}
                    />
                    <PrioritiesPanel scope={scope} connection={connection} />
                </>
            )}
            {active && statusSection}
        </IntegrationCard>
    );
}
```

- [ ] **Step 4: Create the GitHub card and priority labels**

Create `resources/js/components/integrations/github-priority-labels.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type {
    IntegrationScope,
    PriorityLevel,
    TeamIntegration,
} from '@/types';

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

const Levels: PriorityLevel[] = ['high', 'medium', 'low'];

/** Spec 8 §4.2: GitHub priorities are labels the repository already has. */
export function GitHubPriorityLabels({ scope, connection }: Props) {
    const { t } = useTrans();
    const id = useId();
    const saved = connection.settings.priorityLabels ?? {};
    const [labels, setLabels] = useState<Record<PriorityLevel, string>>({
        high: saved.high ?? '',
        medium: saved.medium ?? '',
        low: saved.low ?? '',
    });
    const [errors, setErrors] = useState<
        Partial<Record<PriorityLevel, string>>
    >({});
    const [busy, setBusy] = useState(false);
    const levelLabels: Record<PriorityLevel, string> = {
        high: t('High'),
        medium: t('Medium'),
        low: t('Low'),
    };

    const save = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setErrors({});

        try {
            await retroRequest(
                TeamIntegrationsController.update({
                    ...scope,
                    integration: connection.id,
                }),
                {
                    priority_labels: Object.fromEntries(
                        Levels.map((level) => [
                            level,
                            labels[level].trim() === ''
                                ? null
                                : labels[level].trim(),
                        ]),
                    ),
                },
            );
            toast.success(t('Priority labels saved.'));
            router.reload({ only: ['providers'] });
        } catch (error) {
            if (error instanceof RetroRequestError && error.status === 422) {
                setErrors(
                    Object.fromEntries(
                        Levels.map((level) => [
                            level,
                            error.errors[`priority_labels.${level}`]?.[0],
                        ]),
                    ),
                );
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
        <section className="space-y-3 border-t pt-4">
            <div>
                <h3 className="text-sm font-medium">{t('Priority labels')}</h3>
                <p className="text-xs text-muted-foreground">
                    {t(
                        'Label added to exported issues for each priority. Leave empty to add none; skrum never creates labels.',
                    )}
                </p>
            </div>
            <form className="space-y-2" onSubmit={(event) => void save(event)}>
                {Levels.map((level) => (
                    <div
                        key={level}
                        className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:items-center"
                    >
                        <Label htmlFor={`${id}-${level}`}>
                            {levelLabels[level]}
                        </Label>
                        <div>
                            <Input
                                id={`${id}-${level}`}
                                maxLength={50}
                                value={labels[level]}
                                onChange={(event) =>
                                    setLabels({
                                        ...labels,
                                        [level]: event.target.value,
                                    })
                                }
                            />
                            <InputError message={errors[level]} />
                        </div>
                    </div>
                ))}
                <Button type="submit" size="sm" disabled={busy}>
                    {busy && <Spinner />}
                    {t('Save')}
                </Button>
            </form>
        </section>
    );
}
```

Create `resources/js/components/integrations/github-integration.tsx`:

```tsx
import { ExternalLink, GitBranch } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type { IntegrationProviderCard, IntegrationScope } from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { GitHubPriorityLabels } from './github-priority-labels';
import { ConnectLink, TestConnectionButton } from './integration-actions';
import { IntegrationCard } from './integration-card';
import { IntegrationDetails } from './integration-details';
import { PeoplePanel } from './people-panel';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
    statusSection?: ReactNode;
};

/**
 * Spec 8 §4.2: the team connects one installation of the GitHub App; its
 * permissions decide the access. Disconnecting keeps the app installed,
 * since other teams may use it.
 */
export function GitHubIntegration({ card, scope, statusSection }: Props) {
    const { t } = useTrans();
    const connection = card.connection;

    if (connection === null) {
        return (
            <IntegrationCard
                icon={GitBranch}
                card={card}
                actions={
                    <ConnectLink
                        scope={scope}
                        provider="github"
                        label={t('Install the GitHub App')}
                    />
                }
            >
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Import issues into planning poker by milestone or search, write estimates into issue descriptions and export action items.',
                    )}
                </p>
            </IntegrationCard>
        );
    }

    const { settings } = connection;
    const account = settings.accountLogin ?? '';
    const installationUrl =
        settings.accountType === 'Organization'
            ? `https://github.com/organizations/${account}/settings/installations/${settings.installationId}`
            : `https://github.com/settings/installations/${settings.installationId}`;
    const active = connection.status === 'active';

    return (
        <IntegrationCard
            icon={GitBranch}
            card={card}
            actions={
                <>
                    <ConnectLink
                        scope={scope}
                        provider="github"
                        label={t('Manage the installation')}
                        variant="outline"
                    />
                    {active && (
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
                            'Imported tasks and exported issues keep their links but are no longer synced, and the people mappings are deleted. The GitHub App stays installed on :account: uninstall it there if no other team uses it.',
                            { account },
                        )}
                    />
                </>
            }
        >
            <IntegrationDetails
                connection={connection}
                rows={[
                    {
                        label: t('GitHub account'),
                        value: (
                            <a
                                href={installationUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 underline"
                            >
                                {account}
                                <ExternalLink className="size-3" aria-hidden />
                            </a>
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
            {connection.access === 'read' && (
                <p className="text-sm text-muted-foreground">
                    {t(
                        'This installation can only read issues. Give the app "Issues: read and write" on GitHub to write estimates and export action items.',
                    )}
                </p>
            )}
            {active && connection.access === 'write' && (
                <>
                    <PeoplePanel
                        scope={scope}
                        connection={connection}
                        providerLabel={card.label}
                    />
                    <GitHubPriorityLabels scope={scope} connection={connection} />
                </>
            )}
            {active && statusSection}
        </IntegrationCard>
    );
}
```

In `resources/js/pages/teams/integrations.tsx`, import both cards and add before `default:`:

```tsx
                        case 'jira_dc':
                            return (
                                <JiraDataCenterIntegration
                                    key={card.provider}
                                    card={card}
                                    scope={scope}
                                />
                            );
                        case 'github':
                            return (
                                <GitHubIntegration
                                    key={card.provider}
                                    card={card}
                                    scope={scope}
                                />
                            );
```

- [ ] **Step 5: People and priorities panels**

In `people-panel.tsx`: in `MappingBadge`, replace the last `return` with

```tsx
    const matchedBy: Record<UserMapping['matchedBy'], string> = {
        email: t('Matched by email'),
        manual: t('Set manually'),
        sso: t('Linked via GitHub sign-in'),
    };

    return <Badge variant="secondary">{matchedBy[mapping.matchedBy]}</Badge>;
```

replace the provider hint ternary with `{matchingHint(connection.provider, t)}` and the button text `{t('Match by email')}` with `{connection.provider === 'github' ? t('Match GitHub sign-ins') : t('Match by email')}`, and add (import `IntegrationProviderKey`, `UserMapping`):

```tsx
type Translate = ReturnType<typeof useTrans>['t'];

function matchingHint(provider: IntegrationProviderKey, t: Translate): string {
    switch (provider) {
        case 'jira':
            return t("Jira: members' emails are looked up on your Jira site.");
        case 'jira_dc':
            return t(
                "Jira Data Center: members' emails are looked up on your Jira server.",
            );
        case 'github':
            return t(
                'GitHub: members who signed in to skrum with GitHub are matched automatically.',
            );
        default:
            return t('Linear: emails are compared on this server.');
    }
}
```

In `priorities-panel.tsx`, change `const isJira = connection.provider === 'jira';` to `const isJira = connection.provider === 'jira' || connection.provider === 'jira_dc';`.

- [ ] **Step 6: Import dialog**

In `resources/js/components/poker/import-tasks-dialog.tsx`:

1. Import `isPokerTrackerSource` from `@/lib/poker/types`, and add above `ImportTasksDialog`:

```tsx
type Translate = ReturnType<typeof useTrans>['t'];

type ImportTerms = {
    container: string;
    searchContainers: string;
    chooseContainer: string;
    iteration: string;
    chooseIteration: string;
    noIteration: string;
    queryPlaceholder: string;
};

function importTerms(source: PokerTrackerSource, t: Translate): ImportTerms {
    switch (source) {
        case 'jira':
        case 'jira_dc':
            return {
                container: t('Board'),
                searchContainers: t('Search boards'),
                chooseContainer: t('Choose a board'),
                iteration: t('Sprint'),
                chooseIteration: t('Choose a sprint'),
                noIteration: t('No active or upcoming sprint.'),
                queryPlaceholder: t(
                    'JQL, for example project = PROJ AND sprint in openSprints()',
                ),
            };
        case 'github':
            return {
                container: t('Repository'),
                searchContainers: t('Search repositories'),
                chooseContainer: t('Choose a repository'),
                iteration: t('Milestone'),
                chooseIteration: t('Choose a milestone'),
                noIteration: t('No open milestone.'),
                queryPlaceholder: t('Search GitHub issues'),
            };
        default:
            return {
                container: t('Team'),
                searchContainers: t('Search teams'),
                chooseContainer: t('Choose a team'),
                iteration: t('Cycle'),
                chooseIteration: t('Choose a cycle'),
                noIteration: t('No active or upcoming cycle.'),
                queryPlaceholder: t('Search Linear issues'),
            };
    }
}
```

2. In `ImportForm`, replace `const isJira = source === 'jira';` with `const isGitHub = source === 'github';` and `const terms = importTerms(source, t);`, and replace every `isJira ? t('…') : t('…')` with the matching `terms` field (board/team → `terms.container`, search placeholder → `terms.searchContainers`, choose board/team → `terms.chooseContainer`, Sprint/Cycle → `terms.iteration`, choose sprint/cycle → `terms.chooseIteration`, "No active or upcoming …" → `terms.noIteration`, the query placeholder → `terms.queryPlaceholder`).
3. In the containers effect, replace `if (mode !== 'iteration') {` with `if (mode !== 'iteration' && !isGitHub) {` and add `isGitHub` to its dependency list.
4. In `chooseSource`, replace the guard with `if (!isPokerTrackerSource(next)) { return; }`.
5. Move the container column (`Label` + search `Input` + container `Select`) into a `const containerPicker = (<div className="space-y-1.5">…</div>);` declared before `return`, render `{containerPicker}` as the first column of the iteration grid, and in the query branch render it above the query field when `isGitHub`:

```tsx
                ) : (
                    <div className="space-y-3">
                        {isGitHub && containerPicker}
                        <div className="space-y-1.5">
                            <Label htmlFor="import-query">{t('Query')}</Label>
                            {/* the existing Textarea, with placeholder={terms.queryPlaceholder} */}
                        </div>
                    </div>
                )}
```

6. Send the repository with GitHub queries and require it:

```tsx
                mode === 'iteration'
                    ? { mode, iteration_id: iteration }
                    : { mode, query, container: isGitHub ? container : undefined },
```

```tsx
    const canShow =
        mode === 'iteration'
            ? iteration !== ''
            : query.trim() !== '' && (!isGitHub || container !== '');
```

- [ ] **Step 7: Task sync hint and export dialog**

In `task-source-details.tsx`, inside `SyncBadge` add `const hint = external.source === 'github' ? t('Written to the issue description.') : undefined;` and pass `title={hint}` to the `synced`, `pending` and `failed` badges.

In `resources/js/components/action-items/export-action-item-dialog.tsx`:

1. `type Choice` gains `repositoryId: string | null;` (initial state `repositoryId: null`); after loading targets, `setChoice` also sets `repositoryId: loaded.defaults.repositoryId ?? null`.
2. Replace `const isJira = source.source === 'jira';` with

```tsx
    const isJira = source.source === 'jira' || source.source === 'jira_dc';
    const isGitHub = source.source === 'github';
```

3. `ready` ends with `(isJira ? choice.projectId !== null && choice.issueTypeId !== null : isGitHub ? choice.repositoryId !== null : choice.teamId !== null)`; the export body becomes `isJira ? { source: source.source, project_id: choice.projectId, issue_type_id: choice.issueTypeId } : isGitHub ? { source: source.source, repository_id: choice.repositoryId } : { source: source.source, team_id: choice.teamId }`.
4. Replace the Linear branch of the targets JSX with a GitHub branch first:

```tsx
                        ) : isGitHub ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={projectQuery}
                                        maxLength={100}
                                        placeholder={t('Search repositories')}
                                        aria-label={t('Search repositories')}
                                        disabled={busy}
                                        onChange={(event) =>
                                            setProjectQuery(event.target.value)
                                        }
                                    />
                                    {loadingTargets && <Spinner />}
                                </div>
                                {!loadingTargets &&
                                    searchedProjects !== '' &&
                                    (targets.repositories ?? []).length === 0 && (
                                        <p className="text-sm text-muted-foreground">
                                            {t('No repository found.')}
                                        </p>
                                    )}
                                <TargetSelect
                                    label={t('Repository')}
                                    value={choice.repositoryId}
                                    options={targets.repositories ?? []}
                                    disabled={busy || loadingTargets}
                                    onChange={(repositoryId) =>
                                        setChoice({ ...choice, repositoryId })
                                    }
                                />
                            </>
                        ) : (
```

(the existing Linear `TargetSelect` follows unchanged).
5. `assigneeLine()` takes a fourth parameter `isGitHub: boolean`; its `willMatch` case returns `isGitHub ? t("Assignee: not mapped yet — skrum will use :name's GitHub sign-in", { name: preview.assignee.displayName ?? '' }) : …existing…`; pass `isGitHub` at the call site.
6. The priority line becomes:

```tsx
                        <li>
                            {isGitHub
                                ? preview.priority.name === null
                                    ? t('No priority label')
                                    : t('Priority label: :label', {
                                          label: preview.priority.name,
                                      })
                                : preview.priority.name === null
                                  ? t('Priority: :provider default', {
                                        provider: source.label,
                                    })
                                  : t('Priority: :name', {
                                        name: preview.priority.name,
                                    })}
                        </li>
```

- [ ] **Step 8: Add the translations**

Add only the keys missing at execution time (`Version`, `Repository` or others may exist). The English key of the GitHub read-only note contains straight double quotes: write it as `"This installation can only read issues. Give the app \"Issues: read and write\" on GitHub to write estimates and export action items."` in the JSON files (likewise the Jira DC disconnect text with `\"Authorized applications\"`).

| Key (en) | fr | es | de |
|---|---|---|---|
| `Older Jira server? Use a personal access token` | `Ancien serveur Jira ? Utilisez un jeton d'accès personnel` | `¿Servidor de Jira antiguo? Usa un token de acceso personal` | `Älterer Jira-Server? Verwende ein persönliches Zugriffstoken` |
| `Use a personal access token` | `Utiliser un jeton d'accès personnel` | `Usar un token de acceso personal` | `Persönliches Zugriffstoken verwenden` |
| `Personal access token` | `Jeton d'accès personnel` | `Token de acceso personal` | `Persönliches Zugriffstoken` |
| `Create a token in Jira under Profile → Personal Access Tokens, then paste it here.` | `Créez un jeton dans Jira sous Profil → Jetons d'accès personnels, puis collez-le ici.` | `Crea un token en Jira en Perfil → Tokens de acceso personal y pégalo aquí.` | `Erstelle in Jira unter Profil → Persönliche Zugriffstoken ein Token und füge es hier ein.` |
| `This token acts as its owner in Jira. Everything skrum does — imports, estimates, exported issues, status changes — will appear as done by them, and skrum sees only what they can see. Prefer OAuth when your Jira supports it.` | `Ce jeton agit en tant que son propriétaire dans Jira. Tout ce que fait skrum — imports, estimations, tickets exportés, changements de statut — apparaîtra comme fait par cette personne, et skrum ne voit que ce qu'elle peut voir. Préférez OAuth si votre Jira le permet.` | `Este token actúa como su propietario en Jira. Todo lo que haga skrum —importaciones, estimaciones, incidencias exportadas, cambios de estado— aparecerá como hecho por esa persona, y skrum solo verá lo que ella pueda ver. Prefiere OAuth si tu Jira lo admite.` | `Dieses Token handelt in Jira als die Person, der es gehört. Alles, was skrum tut – Importe, Schätzungen, exportierte Issues, Statusänderungen –, erscheint als von dieser Person ausgeführt, und skrum sieht nur, was sie sehen kann. Verwende lieber OAuth, wenn dein Jira es unterstützt.` |
| `This token acts as :name in Jira. Everything skrum does — imports, estimates, exported issues, status changes — will appear as done by :name, and skrum sees only what :name can see. Prefer OAuth when your Jira supports it.` | `Ce jeton agit en tant que :name dans Jira. Tout ce que fait skrum — imports, estimations, tickets exportés, changements de statut — apparaîtra comme fait par :name, et skrum ne voit que ce que :name peut voir. Préférez OAuth si votre Jira le permet.` | `Este token actúa como :name en Jira. Todo lo que haga skrum —importaciones, estimaciones, incidencias exportadas, cambios de estado— aparecerá como hecho por :name, y skrum solo verá lo que :name pueda ver. Prefiere OAuth si tu Jira lo admite.` | `Dieses Token handelt in Jira als :name. Alles, was skrum tut – Importe, Schätzungen, exportierte Issues, Statusänderungen –, erscheint als von :name ausgeführt, und skrum sieht nur, was :name sehen kann. Verwende lieber OAuth, wenn dein Jira es unterstützt.` |
| `I understand` | `J'ai compris` | `Lo entiendo` | `Ich habe verstanden` |
| `Save token` | `Enregistrer le jeton` | `Guardar token` | `Token speichern` |
| `Token saved.` | `Jeton enregistré.` | `Token guardado.` | `Token gespeichert.` |
| `Acting as :name in Jira` | `Agit en tant que :name dans Jira` | `Actúa como :name en Jira` | `Handelt in Jira als :name` |
| `Token saved on :date` | `Jeton enregistré le :date` | `Token guardado el :date` | `Token gespeichert am :date` |
| `Replace token` | `Remplacer le jeton` | `Reemplazar token` | `Token ersetzen` |
| `Remove token` | `Supprimer le jeton` | `Eliminar token` | `Token entfernen` |
| `Remove the token?` | `Supprimer le jeton ?` | `¿Eliminar el token?` | `Token entfernen?` |
| `skrum deletes the token. Ask :name to also revoke it in Jira under Profile → Personal Access Tokens.` | `skrum supprime le jeton. Demandez à :name de le révoquer aussi dans Jira sous Profil → Jetons d'accès personnels.` | `skrum elimina el token. Pide a :name que también lo revoque en Jira en Perfil → Tokens de acceso personal.` | `skrum löscht das Token. Bitte :name, es auch in Jira unter Profil → Persönliche Zugriffstoken zu widerrufen.` |
| `Imported tasks and exported issues keep their links but are no longer synced, and the people and priority mappings are deleted. Also revoke skrum under "Authorized applications" in your Jira profile.` | `Les tâches importées et les tickets exportés gardent leurs liens mais ne sont plus synchronisés, et les correspondances des personnes et des priorités sont supprimées. Révoquez aussi skrum sous « Applications autorisées » dans votre profil Jira.` | `Las tareas importadas y las incidencias exportadas conservan sus enlaces pero dejan de sincronizarse, y se eliminan las asignaciones de personas y prioridades. Revoca también skrum en «Aplicaciones autorizadas» de tu perfil de Jira.` | `Importierte Aufgaben und exportierte Issues behalten ihre Links, werden aber nicht mehr synchronisiert, und die Personen- und Prioritätszuordnungen werden gelöscht. Widerrufe skrum außerdem unter „Autorisierte Anwendungen“ in deinem Jira-Profil.` |
| `Jira server` | `Serveur Jira` | `Servidor de Jira` | `Jira-Server` |
| `Version` | `Version` | `Versión` | `Version` |
| `Signed in with` | `Connecté avec` | `Conectado con` | `Angemeldet mit` |
| `Install the GitHub App` | `Installer l'application GitHub` | `Instalar la aplicación de GitHub` | `GitHub-App installieren` |
| `Import issues into planning poker by milestone or search, write estimates into issue descriptions and export action items.` | `Importez des tickets dans le planning poker par jalon ou par recherche, écrivez les estimations dans la description des tickets et exportez les actions.` | `Importa incidencias al planning poker por hito o búsqueda, escribe las estimaciones en la descripción de las incidencias y exporta las acciones.` | `Importiere Issues nach Meilenstein oder Suche ins Planning Poker, schreibe Schätzungen in die Issue-Beschreibung und exportiere Aktionspunkte.` |
| `Manage the installation` | `Gérer l'installation` | `Gestionar la instalación` | `Installation verwalten` |
| `Imported tasks and exported issues keep their links but are no longer synced, and the people mappings are deleted. The GitHub App stays installed on :account: uninstall it there if no other team uses it.` | `Les tâches importées et les tickets exportés gardent leurs liens mais ne sont plus synchronisés, et les correspondances des personnes sont supprimées. L'application GitHub reste installée sur :account : désinstallez-la là-bas si aucune autre équipe ne l'utilise.` | `Las tareas importadas y las incidencias exportadas conservan sus enlaces pero dejan de sincronizarse, y se eliminan las asignaciones de personas. La aplicación de GitHub sigue instalada en :account: desinstálala allí si ningún otro equipo la usa.` | `Importierte Aufgaben und exportierte Issues behalten ihre Links, werden aber nicht mehr synchronisiert, und die Personenzuordnungen werden gelöscht. Die GitHub-App bleibt auf :account installiert: Deinstalliere sie dort, wenn kein anderes Team sie nutzt.` |
| `GitHub account` | `Compte GitHub` | `Cuenta de GitHub` | `GitHub-Konto` |
| `This installation can only read issues. Give the app "Issues: read and write" on GitHub to write estimates and export action items.` | `Cette installation peut seulement lire les tickets. Donnez à l'application « Issues : lecture et écriture » sur GitHub pour écrire les estimations et exporter les actions.` | `Esta instalación solo puede leer incidencias. Concede a la aplicación «Issues: lectura y escritura» en GitHub para escribir estimaciones y exportar acciones.` | `Diese Installation kann Issues nur lesen. Gib der App auf GitHub „Issues: Lesen und Schreiben“, um Schätzungen zu schreiben und Aktionspunkte zu exportieren.` |
| `Priority labels` | `Libellés de priorité` | `Etiquetas de prioridad` | `Prioritäts-Labels` |
| `Label added to exported issues for each priority. Leave empty to add none; skrum never creates labels.` | `Libellé ajouté aux tickets exportés pour chaque priorité. Laissez vide pour n'en ajouter aucun ; skrum ne crée jamais de libellés.` | `Etiqueta que se añade a las incidencias exportadas para cada prioridad. Déjala vacía para no añadir ninguna; skrum nunca crea etiquetas.` | `Label, das exportierten Issues je Priorität hinzugefügt wird. Leer lassen, um keins hinzuzufügen; skrum erstellt nie Labels.` |
| `Priority labels saved.` | `Libellés de priorité enregistrés.` | `Etiquetas de prioridad guardadas.` | `Prioritäts-Labels gespeichert.` |
| `Linked via GitHub sign-in` | `Lié via la connexion GitHub` | `Vinculado mediante el inicio de sesión con GitHub` | `Über die GitHub-Anmeldung verknüpft` |
| `Jira Data Center: members' emails are looked up on your Jira server.` | `Jira Data Center : les e-mails des membres sont recherchés sur votre serveur Jira.` | `Jira Data Center: los correos de los miembros se buscan en tu servidor de Jira.` | `Jira Data Center: Die E-Mail-Adressen der Mitglieder werden auf deinem Jira-Server gesucht.` |
| `GitHub: members who signed in to skrum with GitHub are matched automatically.` | `GitHub : les membres qui se sont connectés à skrum avec GitHub sont associés automatiquement.` | `GitHub: los miembros que iniciaron sesión en skrum con GitHub se asocian automáticamente.` | `GitHub: Mitglieder, die sich mit GitHub bei skrum angemeldet haben, werden automatisch zugeordnet.` |
| `Match GitHub sign-ins` | `Associer les connexions GitHub` | `Asociar inicios de sesión de GitHub` | `GitHub-Anmeldungen zuordnen` |
| `Repository` | `Dépôt` | `Repositorio` | `Repository` |
| `Search repositories` | `Rechercher des dépôts` | `Buscar repositorios` | `Repositories suchen` |
| `Choose a repository` | `Choisir un dépôt` | `Elige un repositorio` | `Wähle ein Repository` |
| `Milestone` | `Jalon` | `Hito` | `Meilenstein` |
| `Choose a milestone` | `Choisir un jalon` | `Elige un hito` | `Wähle einen Meilenstein` |
| `No open milestone.` | `Aucun jalon ouvert.` | `Ningún hito abierto.` | `Kein offener Meilenstein.` |
| `Search GitHub issues` | `Rechercher des tickets GitHub` | `Buscar incidencias de GitHub` | `GitHub-Issues suchen` |
| `No repository found.` | `Aucun dépôt trouvé.` | `No se encontró ningún repositorio.` | `Kein Repository gefunden.` |
| `Assignee: not mapped yet — skrum will use :name's GitHub sign-in` | `Responsable : pas encore associé — skrum utilisera la connexion GitHub de :name` | `Responsable: aún sin asociar — skrum usará el inicio de sesión con GitHub de :name` | `Verantwortlich: noch nicht zugeordnet — skrum verwendet die GitHub-Anmeldung von :name` |
| `No priority label` | `Aucun libellé de priorité` | `Sin etiqueta de prioridad` | `Kein Prioritäts-Label` |
| `Priority label: :label` | `Libellé de priorité : :label` | `Etiqueta de prioridad: :label` | `Prioritäts-Label: :label` |
| `Written to the issue description.` | `Écrit dans la description du ticket.` | `Escrito en la descripción de la incidencia.` | `In die Issue-Beschreibung geschrieben.` |

- [ ] **Step 9: Verify**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php tests/Feature/Integrations/IntegrationsPageTest.php`
Expected: no type errors; lint clean except the known pre-existing files; PASS. Format with `npx vp check --fix` on every file of this task.

- [ ] **Step 10: Commit**

```bash
git add resources/js/types/integrations.ts resources/js/lib/poker/types.ts resources/js/pages/teams/integrations.tsx resources/js/components/integrations/integration-actions.tsx resources/js/components/integrations/jira-integration.tsx resources/js/components/integrations/disconnect-integration-dialog.tsx resources/js/components/integrations/people-panel.tsx resources/js/components/integrations/priorities-panel.tsx resources/js/components/integrations/story-points-field.tsx resources/js/components/integrations/jira-token-dialog.tsx resources/js/components/integrations/jira-data-center-integration.tsx resources/js/components/integrations/github-priority-labels.tsx resources/js/components/integrations/github-integration.tsx resources/js/components/poker/import-tasks-dialog.tsx resources/js/components/poker/task-source-details.tsx resources/js/components/action-items/export-action-item-dialog.tsx lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat(integrations): Jira Data Center and GitHub cards, import and export dialogs

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 12: Verification and spec alignment

**Files:**
- Modify: `docs/superpowers/specs/2026-09-30-integrations-extended-design.md`

- [ ] **Step 1: Run every check**

```bash
vendor/bin/sail artisan test --compact --parallel --processes=4
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
npm run types:check && npm run check && npm run build
```

Expected: suite green (rerun failures without `--parallel` if Postgres reports `max_locks_per_transaction`), phpstan 0 errors, no type errors, lint clean except the known pre-existing files, build succeeds.

- [ ] **Step 2: Check the secrets and path rules by search**

```bash
grep -rn "personalAccessToken" app | grep -v "JiraDataCenterClient.php\|ConnectJiraDataCenterToken.php"
grep -rn "ghu_\|user_token\|userToken" app | grep -v "GitHubClient.php\|ConnectGitHub.php"
grep -rn "rawurlencode" app/Support/Integrations/GitHub app/Actions/Integrations/ExportToGitHub.php
```

Expected: the first two print nothing; the third lists only the label path of `ExportToGitHub` (guarded against `.`/`..`) and the slug of `installationUrl()`.

- [ ] **Step 3: Align the spec**

Apply the "Spec amendments made with this plan" to `docs/superpowers/specs/2026-09-30-integrations-extended-design.md`:
- §2.1: Jira DC and GitHub are enabled by their env alone (no staged release left); redirect URIs unchanged.
- §3: Jira DC settings gain `serverKey` (site identity) and `baseUrl`; `external_key` of `poker_tasks` and `action_item_external_links` is 150 characters.
- §4.1: `POST …/integrations/jira-dc/token`; the pre-save warning wording; `serverKey` mismatch and PATs turned off later → `ReconnectRequired` with their messages; wiki specials include `#`.
- §4.2: container/iteration/export ids (`repositoryId`, `{repositoryId}/{milestone}`, `repository_id`), qualifier stripping in queries, login re-read at export, mention neutralization, `?`/`☕` guard message.
- §7: the PAT route row uses `jira-dc/token`; `PATCH {integration}` lists `priority_labels` (snake_case, `≤ 50`, never `.`/`..`); poker import preview accepts `container`.
- §7.1: `canSyncStatus`/`syncMode` are returned from Plan 14c on (`false`/`off` until 14d); GitHub queries need `container_id`.
- §9: GitHub priority labels are three text inputs; Jira DC "Remove token" uses the disconnect dialog.
- §11: GitHub search without a repository → 422 "Choose a repository to search in."

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-30-integrations-extended-design.md
git commit -m "docs: align the extended integrations spec with the Jira Data Center and GitHub plan

Co-Authored-By: <model name> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

- [ ] **Step 5: Walkthrough (for the user; not automatable here)**

Spec §13 manual walkthrough, Jira DC and GitHub parts without status sync: connect a Jira DC test server with OAuth (read, then read and write), import a sprint, estimate (story points written), export an item with a mapped assignee and priority; replace the connection with a personal access token (warning and "Acting as" shown, exported issue created as the token owner), revoke the token in Jira → "Reconnect required" with the paste-a-new-one message; install the GitHub App on a test org, import a milestone, estimate a Fibonacci and a T-shirt game and see one block in the issue body, edit the body around the block in GitHub and estimate again (text kept, one block), clear the estimate (block removed), export an item assigned to a member who signed in with GitHub (mapped `sso`) and with a priority label, then uninstall the app → "Reconnect required".

---

## Self-review

- **Spec coverage:** §2.1 availability (Task 1), `authMethods()` in props (Task 3); §4.1 OAuth + PKCE (Task 2), PAT with `acknowledged`, version check, encryption, 401 → reconnect, OAuth erases PAT, 404 when off (Tasks 2–3), REST v2 search, wiki ↔ Markdown, `name` users, email matching, priorities, createmeta, browse links, check, disconnect (Tasks 4–5); §4.2 connect with installation proof and discarded user token, JWT, cached encrypted installation tokens, repositories/milestones/search/import, block write-back for every deck with verification and limits, export with due line, assignee comparison and labels, SSO matching and manual search, check uninstalled/suspended (Tasks 6–9); §7.1 all rows (Task 10); §9 cards, import dialog, sync hint, export dialog (Task 11); §11 GitHub callback/estimate/PAT errors (Tasks 3, 6, 8); §13 Jira DC and GitHub bullets except webhooks/status (Tasks 2–10), MCP (Task 10), Secrets (Tasks 3, 6, 12), Translations (every task). Status sync, inbound webhooks, polling, Jira DC webhook registration and "Done in :source"/conflict UI are left to Plan 14d through the Contract.
- **Placeholder scan:** every new file has full code; edits of existing files name their anchor and give the replacement code; the only instructions without literal code are mechanical renames in `import-tasks-dialog.tsx` (each ternary mapped to a named `terms` field) and moving an existing JSX block into `containerPicker`.
- **Type consistency:** `jira_dc`/`github` are identical in `IntegrationProvider`, routes (`whereIn`, `where('source', …)`), `ActionItemExportGuard::Sources`, `ExportActionItemRules`, `PokerTrackerSources::Values`, `PresentTeamIntegration::SettingKeys`, TS `TrackerProviderKey`/`PokerTrackerSource`/`TrackerLabels`. `IssueTracker::search()` has the same three parameters in the interface and the four trackers; `PreviewPokerImport::fetch/handle` and `ImportPokerTasks::fromSource` append `?string $containerId = null` last, as the controllers and the MCP tool pass it. GitHub ids: container `9001`, iteration and issue `9001/n`, `site()` `'4242'` everywhere (factories, fakes, assertions). `ExternalAccount::displayName` is the GitHub login, which `ExportToGitHub::login()` relies on. Pest helper names are unique (`fakeJiraDataCenterTokenCheck`, `fakeGitHubUserInstallations`, `fakeGitHubExport`, `gitHubCreatedIssuePayload`, `gitHubSyncTask`, `runGitHubSync`, `gitHubPatches`, `renderedEstimateBlock` included).
