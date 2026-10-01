# Plan 16e — Integrations walkthroughs (plans 12a to 12d, 14a to 14d, 15) and the API tokens page (plan 11b) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate the walkthroughs of the integration plans (12a to 12d, 14a to 14d), of webhook redelivery (15) and the browser steps of the MCP walkthrough (11b, API tokens page) as browser tests, with every provider faked in process.

**Architecture:** Browser tests live in `tests/Browser/Walkthroughs`, one file per walkthrough, bound to `Tests\BrowserTestCase` (built assets, a Reverb server started by the suite, authentication reset after every request so several browser contexts act as different users). Each walkthrough step maps to a test whose title starts with the step's identifier; the mapping is recorded in `docs/superpowers/walkthroughs/coverage.md`, and what cannot be automated in `residual-manual-checklist.md`. Tests sign in and join through the real interface, wait on `data-realtime` instead of sleeping, and arrange their own state with factories.

**Tech Stack:** PHP 8.4, Laravel 13, Pest 5 with `pestphp/pest-plugin-browser` 5.x (Playwright, Chromium), Laravel Reverb, Inertia v3 with React 19, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md` (this plan is one of its "later slices", §1). Read it, and read `docs/superpowers/walkthroughs/harness-findings.md`: it holds the facts proven by running the browser plugin against this application, and it overrides this plan's text where they differ.

**Depends on:** Plan 16a merged, plan 16b Task 1 (`$this->workQueue()`), and plan 16b Task 6 if a test waits for realtime on the workspace action-items page (`data-realtime` there).

## Global Constraints

- No new dependency and no new base folder.
- Browser tests never call `actingAs()`, `withCookie()`, `withCookies()` or `Event::fake()` without arguments (the Arch source scan fails the build). Members sign in with `$this->signIn(...)`; guests join with `$this->joinAsGuest(...)`. `Http::fake([...])`, `Mail::fake()`, `Notification::fake()`, `Queue::fake()` and `Event::fake([Specific::class])` are allowed and apply to browser requests.
- No fixed sleep for realtime: `$this->awaitRealtime($page)` after opening a live page, act on one page, assert on the other. Assert that an element is visible before acting on it or reading from it. Send one key per `keys()` call where order matters.
- Selectors: English text and aria-labels first, locale English. A string containing `( ) : , = [ ] > + ~ * | ^ #` is CSS and must match exactly one element (except in `assertCount()`, `assertPresent()`, `assertNotPresent()`, `assertDontSeeIn()`); a bare tag name is NOT CSS. After choosing a Radix menu item, assert the menu is gone before reopening it.
- Product code gains only `data-test` attributes and the `data-realtime` attribute (spec criterion 10). Anything else found wrong in the product follows the Defect rule.
- Each test arranges its own state; no test depends on another. No comments in test code. Do not redeclare the global helper functions of other walkthrough files.
- PHP style as in the project guidelines. After editing PHP: `vendor/bin/pint --dirty --format agent`, PHPStan, and `composer rector:check` (if Rector wants to rewrite code the task wrote, apply `composer rector`, re-run Pint and the tests, and say so).
- After editing a `.tsx` or `.ts` file: `npm run types:check`, `npm run check`, `npm run build` (the browser suite serves `public/build`).
- `composer test` must stay free of browser tests; `composer test:arch` and `composer test:browser` must stay green.
- Every provider is faked with `Http::fake([...])`. Unmatched URLs are sent as REAL requests, so each fake list ends with a catch-all for the provider's host (a 404) or the file calls `Http::preventStrayRequests()`; no test may reach a real provider. Reverb is unaffected: the broadcaster uses its own Guzzle client, not the `Http` facade.
- Providers are enabled per test with `config([...])`; connected integrations are arranged with `TeamIntegrationFactory` states. OAuth and app-installation round trips are residual.
- Inbound webhooks are simulated by posting to the webhook routes from the test process with a valid signature; this is a plain test request, not a signed-in browser.
- Deliveries, write-backs and exports are queued: tests set `config(['queue.default' => 'database'])` and call `$this->workQueue()`.

## Environment

- With Sail in the primary checkout: prefix `composer`, `artisan`, `pest` and `npm` with `vendor/bin/sail`.
- In a worktree on host PHP: `export DB_HOST=127.0.0.1 DB_DATABASE=<a test database of its own>` and run Pest as `php -d memory_limit=2G vendor/bin/pest …`.
- The browser suite needs built assets (`npm run build`), no `public/hot`, and port 8097 free (it starts its own Reverb server; an orphan from a killed run must be stopped first: `lsof -i :8097`).
- Run one test: `vendor/bin/pest tests/Browser/Walkthroughs/<File> --filter='<id>'`. Watch it: `--headed`. Pause on failure: `--debug`. Screenshots of failed assertions: `tests/Browser/Screenshots`.

## Defect rule

None of the code in this plan was executed while it was written: it was derived from reading the components, controllers and factories. When a test fails:

1. If the interface text or structure differs from the selector and the behaviour is right, fix the selector (smallest change) and note it in the task report.
2. If the behaviour is wrong against the feature's spec: stop the task, write a failing feature test where the behaviour is server-side, fix the defect in its own commit (`fix(<area>): …`), then return. Record it under "Defects found" in `docs/superpowers/walkthroughs/coverage.md`.
3. If the walkthrough's text and the feature's spec disagree, the feature's spec wins; record the difference in the coverage table's Notes.
4. If a harness assumption is wrong, follow `docs/superpowers/walkthroughs/harness-findings.md`, or stop and report when it has no answer.
5. Coverage statuses in this plan are provisional until the tests run: a row is `auto` or `auto-substituted` only when its test passes.

Run each finished test file twice in a row before committing it.

## Tasks

| # | Task |
|---|---|
| 1 | Plan 12a walkthrough, integrations foundation (the integrations page) |
| 2 | Plan 12b walkthrough, sharing to Slack, Telegram and email |
| 3 | Plan 14a walkthrough, Microsoft Teams and Mattermost |
| 4 | Plan 12c walkthrough, part 1: tracker imports and the guest's view |
| 5 | Plan 12c walkthrough, part 2: estimate write-back, failure and retry, refresh |
| 6 | Plan 12d walkthrough: people and priority mapping, action item export |
| 7 | Outgoing webhooks walkthrough (plan 14b) |
| 8 | Webhook payload history and redelivery walkthrough (plan 15) |
| 9 | API tokens page of the MCP walkthrough (plan 11b) |
| 10 | Plan 14c walkthrough (Jira Data Center and GitHub Issues trackers) |
| 11 | Plan 14d walkthrough (two-way status sync) |
| 12 | Coverage table and residual checklist |
| 13 | Final verification |

## Review Focus

Conditions the spec implies that a happy-path reading could miss, each pinned by a test.

1. No test may send a request to a real provider. Expected: every fake list ends with a host catch-all or stray requests are prevented, and `Http::assertSent` proves what skrum sent. Pinned by each task's fake helper.
2. A member who is not Owner or Admin cannot manage integrations. Expected: read-only controls or a refusal. Pinned by `[P12a-01b]` (Task 1: no Integrations link and 403 on the integrations page) and by `[P14b-07]` (added to the outgoing-webhooks file of Task 7 by the final fix wave: no link, 403 on the page and 403 on a webhook URL posted from the member's page).
3. A revoked or failing connection shows "Reconnect required" and stops further calls. Pinned by the reconnect tests of Tasks 1, 3, 6 and 10.
4. A duplicated export request creates one issue. Pinned by the duplicate-request test of Task 6.
5. A webhook secret and an API token are shown once and never again. Pinned by the secret-rotation test of Task 7 and the token tests of Task 9.

---

### Task 1: Plan 12a walkthrough, integrations foundation (the integrations page)

This task automates the plan 12a walkthrough (`docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md`, lines 8360 to 8366, seven steps). The walkthrough was written for real developer apps. Following spec §3.6 the providers are faked in process with `Http::fake()` and the skrum interface is driven for real. What happens inside a provider's own interface (the OAuth consent screens of Slack, Jira and Linear, adding the Telegram bot to a group, revoking the app in Slack) cannot be driven against a fake and is listed as residual.

Facts about the product that the tests rely on (all read from the current code):

- A provider is shown only when it is configured (`app/Enums/IntegrationProvider.php`, `isConfigured()`). `phpunit.xml` blanks the provider variables, and the helper `disableIntegrations()` in `tests/Pest.php` blanks the configuration; `enableIntegrations(IntegrationProvider ...$providers)` sets the test values. Both act on `config()`, which the browser requests share with the test.
- The integrations page is `GET /w/{workspace}/teams/{team}/integrations` (`teams.integrations.index`). It needs the `manageIntegrations` ability (workspace Owner or Admin, `app/Policies/TeamPolicy.php`); a member gets 403. With no provider configured the route answers 404 (`EnsureIntegrationProviderEnabled`), and the team page hides the "Integrations" link (`canManageIntegrations` in `TeamsController::show`).
- Each provider is one `Card` (`resources/js/components/integrations/integration-card.tsx`). The cards have no id, so Step 1 adds one hook, `data-test="integration-card-<provider>"`. The status badge inside a card is `[data-slot="badge"]` and reads "Not connected", "Connected", "Setup required" or "Reconnect required". "Not connected" contains "connected", so the tests compare the badge's exact text with `assertScript()`.
- "Send a test message" for Slack posts to the stored webhook URL (`SlackClient::postMessage`); for Telegram it calls `sendMessage`. "Test the connection" for Linear runs `query { viewer { id } }`. The daily check for Slack calls `auth.test`.
- The Telegram card asks the server for a code, shows the command in a `<code>` element, and polls the page's `providers` prop every 5 seconds (`usePoll` in `telegram-integration.tsx`). The bot side arrives through `skrum:telegram-poll`, which reads `getUpdates`.
- A Jira or Linear connection with write access renders the people and priorities panels, which call the provider when the page loads. The tests connect both trackers with read access, where those panels are not rendered, so the only provider calls are the ones the test triggers.
- The Reverb broadcaster does not use Laravel's HTTP client: it is the Pusher SDK with its own Guzzle client (`vendor/pusher/pusher-php-server/src/Pusher.php`, line 121). `Http::fake()` and `Http::preventStrayRequests()` therefore never touch the broadcast call to `127.0.0.1:8097`. The file still allows that host explicitly, so the guard stays harmless if the broadcaster ever changes.

**Files:**
- Modify: `resources/js/components/integrations/integration-card.tsx` (adds `data-test="integration-card-<provider>"`)
- Create: `tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php`
- Test: `tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn(User $user, string $to): mixed` (plan 16a).
  - Existing helpers in `tests/Pest.php`: `disableIntegrations(): void`, `enableIntegrations(IntegrationProvider ...$providers): void`, `integrationAdmin(Team $team): User`, `teamMember(Team $team): User`.
  - `TeamIntegrationFactory` states `slack()`, `telegram()`, `jira(IntegrationAccess $access)`, `linear(IntegrationAccess $access)`.
  - `Tests\Browser\Support\ReverbServer::Host` and `ReverbServer::Port`.
- Produces:
  - `data-test="integration-card-<provider>"` on the `Card` of every provider (`slack`, `telegram`, `jira`, `linear`, `jira_dc`, `github`, `msteams`, `mattermost`, `webhook`). Tasks 2 and 3 of this plan, and any later task that opens the integrations page, use it.
  - File-level helpers (global functions; other files must not redeclare them): `p12aAdmin(Team $team, string $name = 'Ada Admin'): User`, `p12aIntegrationsPath(Team $team): string`, `p12aCard(string $provider): string`, `p12aBadge(string $provider): string`, `p12aFakeTelegramBot(): void`.

- [ ] **Step 1: Add the provider card hook**

In `resources/js/components/integrations/integration-card.tsx`, the component currently returns:

```tsx
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
```

Change it to:

```tsx
    return (
        <Card data-test={`integration-card-${card.provider}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
```

`Card` spreads its props onto its `<div>` (`resources/js/components/ui/card.tsx`), so the attribute reaches the DOM.

- [ ] **Step 2: Check and rebuild the frontend**

Run: `npm run types:check`
Expected: no error.

Run: `npm run check`
Expected: only the known pre-existing findings in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`; nothing in `resources/js`.

Run: `npm run build`
Expected: the build succeeds. The browser suite serves `public/build`, so the hook is invisible to the tests until this build has run.

- [ ] **Step 3: Create the test file with its helpers and the tests of steps 1 and 2**

`php artisan make:test` cannot write under `tests/Browser`, so create `tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php` directly with this content:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Browser\Support\ReverbServer;

beforeEach(function () {
    $reverbHost = ReverbServer::Host;
    $reverbPort = ReverbServer::Port;

    Http::preventStrayRequests();
    Http::allowStrayRequests(["http://{$reverbHost}:{$reverbPort}/*"]);
    disableIntegrations();
});

function p12aAdmin(Team $team, string $name = 'Ada Admin'): User
{
    $admin = integrationAdmin($team);

    $admin->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $admin;
}

function p12aIntegrationsPath(Team $team): string
{
    return route('teams.integrations.index', [$team->workspace, $team], false);
}

function p12aCard(string $provider): string
{
    return "[data-test=\"integration-card-{$provider}\"]";
}

function p12aBadge(string $provider): string
{
    return "document.querySelector('[data-test=\"integration-card-{$provider}\"] [data-slot=\"badge\"]').textContent";
}

function p12aFakeTelegramBot(): void
{
    Http::fake([
        'api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']]),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => true]),
    ]);
}

it('[P12a-01a] shows a workspace admin the Integrations link and only the configured providers', function () {
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
    p12aFakeTelegramBot();
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p12aAdmin($team);
    $slack = p12aCard('slack');

    $page = $this->signIn($admin, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('Integrations')
        ->click('Integrations')
        ->assertPathIs(p12aIntegrationsPath($team))
        ->assertSee('Connect Platform to the tools it already uses.')
        ->assertCount('[data-test^="integration-card-"]', 2)
        ->assertSeeIn($slack, 'Slack')
        ->assertSeeIn(p12aCard('telegram'), 'Telegram')
        ->assertScript(p12aBadge('slack'), 'Not connected')
        ->assertScript(p12aBadge('telegram'), 'Not connected')
        ->assertAttributeContains("{$slack} a", 'href', '/integrations/slack/connect')
        ->assertNotPresent(p12aCard('jira'))
        ->assertNotPresent(p12aCard('linear'))
        ->assertNotPresent(p12aCard('msteams'))
        ->assertNotPresent(p12aCard('mattermost'))
        ->assertNotPresent(p12aCard('webhook'));
});

it('[P12a-01b] hides the Integrations link from a team member and refuses the page with 403', function () {
    enableIntegrations(IntegrationProvider::Slack);
    $team = Team::factory()->create(['name' => 'Platform']);
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    $member = teamMember($team);
    $member->forceFill(['name' => 'Bob Member', 'locale' => 'en'])->save();

    $page = $this->signIn($member, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('Games')
        ->assertNotPresent('a[href$="/integrations"]');

    $page->navigate(p12aIntegrationsPath($team))
        ->assertSee('403')
        ->assertNotPresent('[data-test^="integration-card-"]');
});

it('[P12a-01c] has no Integrations link and no integrations page while no provider is configured', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p12aAdmin($team);

    $page = $this->signIn($admin, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('Games')
        ->assertNotPresent('a[href$="/integrations"]');

    $page->navigate(p12aIntegrationsPath($team))
        ->assertSee('404')
        ->assertNotPresent('[data-test^="integration-card-"]');
});

it('[P12a-02a] sends "skrum is connected." to the connected Slack channel', function () {
    enableIntegrations(IntegrationProvider::Slack);
    Http::fake(['hooks.slack.com/*' => Http::response('ok')]);
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p12aAdmin($team);
    $integration = TeamIntegration::factory()->slack()->create([
        'team_id' => $team->id,
        'connected_by_user_id' => $admin->id,
    ]);
    $slack = p12aCard('slack');

    $page = $this->signIn($admin, p12aIntegrationsPath($team));

    $page->assertScript(p12aBadge('slack'), 'Connected')
        ->assertSeeIn($slack, 'Acme')
        ->assertSeeIn($slack, '#retros')
        ->assertSeeIn($slack, 'Ada Admin')
        ->assertSeeIn($slack, 'Never')
        ->click("{$slack} button:has-text(\"Send a test message\")")
        ->assertSee('Test message sent.')
        ->assertDontSeeIn($slack, 'Never');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://hooks.slack.com/services/T000/B000/XXXX'
        && $request['text'] === 'skrum is connected.');
    Http::assertSentCount(1);

    expect($integration->fresh()->last_checked_at)->not->toBeNull();
});
```

Notes on this step:

- `Http::preventStrayRequests()` makes any provider call that a test did not fake fail inside the request instead of reaching the network. Several `Http::fake([...])` calls add up: the first registered pattern that matches a URL answers it, so a specific pattern must be registered before a wider one.
- `[P12a-01a]` checks the Slack "Connect" link by its `href` and does not click it: the link redirects the browser to `slack.com`, which a fake cannot answer.
- The 403 and 404 pages are Laravel's default error views, which print the status code.

- [ ] **Step 4: Run the tests of steps 1 and 2**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php --filter='P12a-0[12]'`
Expected: PASS (4 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Add the Telegram, Jira and Linear tests (steps 3 to 5)**

Add this import to the `use` block of the file, keeping the block sorted:

```php
use App\Enums\IntegrationAccess;
```

Append these tests to the file:

```php
it('[P12a-03a] shows the /connect command, switches to Connected once the bot receives it, and sends a test message', function () {
    enableIntegrations(IntegrationProvider::Telegram);
    $updates = [];
    Http::fake([
        'api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']]),
        'api.telegram.org/*/getUpdates' => function () use (&$updates) {
            return Http::response(['ok' => true, 'result' => $updates]);
        },
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => true]),
    ]);
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p12aAdmin($team);
    $telegram = p12aCard('telegram');

    $page = $this->signIn($admin, p12aIntegrationsPath($team));

    $page->assertScript(p12aBadge('telegram'), 'Not connected')
        ->click("{$telegram} button:has-text(\"Connect\")")
        ->assertVisible("{$telegram} code")
        ->assertSee('Open @skrum_test_bot in Telegram')
        ->assertSee('Waiting for the command…');

    $command = (string) $page->text("{$telegram} code");

    expect($command)->toMatch('/^\/connect@skrum_test_bot [A-HJ-NP-Z2-9]{8}$/');

    $updates = [[
        'update_id' => 1,
        'message' => [
            'message_id' => 1,
            'date' => 1_700_000_000,
            'chat' => ['id' => -100123, 'title' => 'Team chat', 'type' => 'supergroup'],
            'text' => $command,
        ],
    ]];

    $this->artisan('skrum:telegram-poll', ['--timeout' => 0])->assertSuccessful();

    $page->assertScript(p12aBadge('telegram'), 'Connected')
        ->assertSee('Telegram connected.')
        ->assertSeeIn($telegram, 'Team chat')
        ->assertSeeIn($telegram, 'Ada Admin')
        ->assertDontSee('Waiting for the command…')
        ->click("{$telegram} button:has-text(\"Send a test message\")")
        ->assertSee('Test message sent.')
        ->assertDontSeeIn($telegram, 'Never');

    $integration = TeamIntegration::query()->sole();

    expect($integration->provider)->toBe(IntegrationProvider::Telegram)
        ->and($integration->team_id)->toBe($team->id)
        ->and($integration->setting('chatId'))->toBe('-100123');

    Http::assertSent(fn (Request $request): bool => str_ends_with($request->url(), '/sendMessage')
        && $request['chat_id'] === '-100123'
        && $request['text'] === 'skrum is connected.');
});

it('[P12a-04a] shows the Jira site and story points field, offers the upgrade, saves another field and detects again', function () {
    enableIntegrations(IntegrationProvider::Jira);
    Http::fake([
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/field' => Http::response([
            ['id' => 'customfield_10028', 'name' => 'Story Points', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.atlassian.jira.plugin.system.customfieldtypes:float']],
            ['id' => 'customfield_10016', 'name' => 'Story point estimate', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.pyxis.greenhopper.jira:jsw-story-points']],
            ['id' => 'customfield_10050', 'name' => 'Business value', 'custom' => true, 'schema' => ['type' => 'number', 'custom' => 'com.atlassian.jira.plugin.system.customfieldtypes:float']],
        ]),
    ]);
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p12aAdmin($team);
    $integration = TeamIntegration::factory()->jira(IntegrationAccess::Read)->create([
        'team_id' => $team->id,
        'settings' => [
            'cloudId' => 'cloud-1',
            'siteUrl' => 'https://acme.atlassian.net',
            'siteName' => 'Acme',
            'storyPointFields' => [['id' => 'customfield_10016', 'name' => 'Story point estimate']],
            'numberFields' => [
                ['id' => 'customfield_10016', 'name' => 'Story point estimate'],
                ['id' => 'customfield_10050', 'name' => 'Business value'],
            ],
        ],
    ]);
    $jira = p12aCard('jira');
    $field = '[aria-label="Story points field"]';

    $page = $this->signIn($admin, p12aIntegrationsPath($team));

    $page->assertScript(p12aBadge('jira'), 'Connected')
        ->assertSeeIn($jira, 'Acme')
        ->assertSeeIn($jira, 'Read only')
        ->assertSeeIn($field, 'Story point estimate')
        ->assertAttributeContains("{$jira} a:has-text(\"Upgrade to read and write\")", 'href', '/integrations/jira/connect')
        ->assertAttributeContains("{$jira} a:has-text(\"Upgrade to read and write\")", 'href', 'access=write')
        ->click($field)
        ->click('[role="option"]:has-text("Business value")')
        ->assertSee('Story points field saved.')
        ->assertSeeIn($field, 'Business value');

    expect($integration->fresh()->setting('storyPointFields.0.id'))->toBe('customfield_10050');

    $page->click("{$jira} button:has-text(\"Detect again\")")
        ->assertSee('Fields detected again.')
        ->assertSeeIn($field, 'Business value')
        ->click($field)
        ->assertPresent('[role="option"]:has-text("Story Points")');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/field'
        && $request->hasHeader('Authorization', 'Bearer jira-access'));

    expect($integration->fresh()->setting('numberFields'))->toHaveCount(3)
        ->and($integration->fresh()->setting('storyPointFields.0.id'))->toBe('customfield_10050');
});

it('[P12a-05a] tests the Linear connection from its card', function () {
    enableIntegrations(IntegrationProvider::Linear);
    Http::fake(['api.linear.app/graphql' => Http::response(['data' => ['viewer' => ['id' => 'u1']]])]);
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p12aAdmin($team);
    $integration = TeamIntegration::factory()->linear(IntegrationAccess::Read)->create(['team_id' => $team->id]);
    $linear = p12aCard('linear');

    $page = $this->signIn($admin, p12aIntegrationsPath($team));

    $page->assertScript(p12aBadge('linear'), 'Connected')
        ->assertSeeIn($linear, 'Acme')
        ->assertSeeIn($linear, 'Read only')
        ->assertSeeIn($linear, 'Never')
        ->assertAttributeContains("{$linear} a:has-text(\"Upgrade to read and write\")", 'href', 'access=write')
        ->click("{$linear} button:has-text(\"Test the connection\")")
        ->assertSee('The connection works.')
        ->assertDontSeeIn($linear, 'Never');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.linear.app/graphql'
        && str_contains((string) $request['query'], 'viewer'));

    expect($integration->fresh()->last_checked_at)->not->toBeNull();
});
```

Notes on this step:

- In `[P12a-03a]` the `getUpdates` answer is a closure that reads `$updates` by reference, so the test can decide what the bot "received" after it has read the command from the page. The pattern order matters: `getMe` and `getUpdates` are registered before the catch-all `api.telegram.org/*`.
- `skrum:telegram-poll --timeout=0` is the command the scheduler runs; it calls `PollTelegramUpdates`, which hands the update to `HandleTelegramUpdate`. The page's own 5-second poll then picks up the new connection, so `assertScript(p12aBadge('telegram'), 'Connected')` is the wait. If this fails, see the harness findings.
- The trackers are connected with read access: with write access the card also loads people and priorities from the provider, which this walkthrough step does not ask for.

- [ ] **Step 6: Run the tests of steps 3 to 5**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php --filter='P12a-0[345]'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 7: Add the daily check and the disconnect tests (steps 6 and 7)**

Add this import to the `use` block of the file, keeping the block sorted:

```php
use App\Enums\IntegrationStatus;
```

Append these tests to the file:

```php
it('[P12a-06a] shows "Reconnect required" with the error after the daily check finds the Slack token revoked', function () {
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
    Http::fake(['slack.com/api/auth.test' => Http::response(['ok' => false, 'error' => 'token_revoked'])]);
    p12aFakeTelegramBot();
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p12aAdmin($team);
    $slackIntegration = TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    $telegramIntegration = TeamIntegration::factory()->telegram()->create(['team_id' => $team->id]);
    $slack = p12aCard('slack');

    $page = $this->signIn($admin, p12aIntegrationsPath($team));

    $page->assertScript(p12aBadge('slack'), 'Connected')
        ->assertScript(p12aBadge('telegram'), 'Connected')
        ->assertPresent("{$slack} button:has-text(\"Send a test message\")");

    $this->artisan('skrum:check-integrations')->assertSuccessful();

    $page->navigate(p12aIntegrationsPath($team))
        ->assertScript(p12aBadge('slack'), 'Reconnect required')
        ->assertSeeIn($slack, 'token_revoked')
        ->assertSeeIn($slack, 'Reconnect')
        ->assertNotPresent("{$slack} button:has-text(\"Send a test message\")")
        ->assertScript(p12aBadge('telegram'), 'Connected');

    expect($slackIntegration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($slackIntegration->fresh()->last_error)->toBe('token_revoked')
        ->and($telegramIntegration->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and($telegramIntegration->fresh()->last_checked_at)->not->toBeNull();

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://slack.com/api/auth.test'
        && $request->hasHeader('Authorization', 'Bearer xoxp-test-token'));
});

it('[P12a-07a] disconnects every provider, revokes the Slack and Linear access and makes the bot leave the Telegram chat', function () {
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram, IntegrationProvider::Jira, IntegrationProvider::Linear);
    Http::fake([
        'slack.com/api/auth.revoke' => Http::response(['ok' => true]),
        'api.linear.app/oauth/revoke' => Http::response('', 200),
    ]);
    p12aFakeTelegramBot();
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p12aAdmin($team);
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->jira(IntegrationAccess::Read)->create(['team_id' => $team->id]);
    TeamIntegration::factory()->linear(IntegrationAccess::Read)->create(['team_id' => $team->id]);

    $page = $this->signIn($admin, p12aIntegrationsPath($team));

    $page->assertCount('[data-test^="integration-card-"]', 4);

    foreach (['slack' => 'Slack', 'telegram' => 'Telegram', 'jira' => 'Jira', 'linear' => 'Linear'] as $provider => $label) {
        $card = p12aCard($provider);

        $page->assertScript(p12aBadge($provider), 'Connected')
            ->click("{$card} button:has-text(\"Disconnect\")")
            ->assertSee("Disconnect {$label}?")
            ->click('[role="dialog"] button:has-text("Disconnect")')
            ->assertSee("{$label} disconnected.")
            ->assertNotPresent('[role="dialog"]')
            ->assertScript(p12aBadge($provider), 'Not connected');
    }

    expect(TeamIntegration::query()->count())->toBe(0);

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://slack.com/api/auth.revoke');
    Http::assertSent(fn (Request $request): bool => str_ends_with($request->url(), '/leaveChat') && $request['chat_id'] === '-100123');
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.linear.app/oauth/revoke');
});
```

Notes on this step:

- In `[P12a-06a]` the Slack fake is registered before `p12aFakeTelegramBot()`; the two do not overlap. The Telegram catch-all answers `getChat`, so the Telegram connection stays "Connected", which shows the check only marks the provider that refused.
- Jira has no revocation endpoint (`DisconnectIntegration`); with no registered webhook the disconnect sends nothing to Atlassian, so no Atlassian fake is needed and a stray call would fail the test.

- [ ] **Step 8: Run the tests of steps 6 and 7**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php --filter='P12a-0[67]'`
Expected: PASS (2 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 9: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector`, then Pint again.

- [ ] **Step 10: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php`
Expected: PASS (9 tests).

- [ ] **Step 11: Commit**

```bash
git add resources/js/components/integrations/integration-card.tsx tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php
git commit -m "test(browser): cover the plan 12a integrations foundation walkthrough"
```

### Task 2: Plan 12b walkthrough, sharing to Slack, Telegram and email

This task automates the plan 12b walkthrough (`docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md`, lines 4799 to 4804, six steps) and the hand check of its Step 3 (line 4789, "the no-integration path"). Slack and Telegram are faked with `Http::fake()`; the tests assert what skrum shows and the exact payload it sent. No product file changes in this task, so no frontend build is needed.

Facts about the product that the tests rely on (all read from the current code):

- A share creates an `IntegrationDelivery` row with status `queued` and dispatches a job (`QueueShare`, `DeliverToSlack`, `DeliverToTelegram`). The job posts the message, marks the delivery `sent` or `failed`, and broadcasts `results.changed` (retro) or `game.changed` (poker) to the other sockets; the page then refetches and the delivery line changes. `phpunit.xml` sets the queue to `sync`; the tests switch to the `database` queue so that "Sending to Slack…" can be seen before the job runs, and run the job with `$this->workQueue()`, which runs it outside any browser request so the sharer's own page receives the broadcast.
- The retro board shows a "Share" button in the header while the retro is not completed and at least one chat channel is active for the viewer (`share-board-button.tsx`). The dialog "Share the board" holds the section "Post a link" with one button per channel ("Post link to Slack", "Post link to Telegram"), a checkbox "Include the guest link (anyone in the channel can join)" only when guest access is on, and the delivery lines in `ul[aria-live="polite"]`.
- A completed retro opens on its Results view, whose "Share" button is a menu: "Send to email" (only when the mailer delivers: `IntegrationAvailability::emailEnabled()` is false for the `array` and `log` mailers, and `phpunit.xml` sets `array`), "Share to Slack", "Share to Telegram". The delivery lines sit under the completion date.
- The recap dialog says "The summary is still being generated and will not be included." only when an LLM is configured (`PresentRetroSummary` returns `null` otherwise) and the summary is pending with a request less than 10 minutes old.
- The share routes are throttled to 5 per minute per user (`throttle:5,1,shares`); no test posts more than 3 shares.
- When a channel's connection turns "Reconnect required", it leaves the share options. If it was the only channel, the whole share section and the header button disappear, and the failed line with them. The failure test therefore keeps Telegram connected, as the walkthrough does.
- The results email is a queued notification sent with `Notification::send()`; the controller keeps a 10-minute cooldown per retro in the cache and answers 429 with "The results were emailed a few minutes ago.".

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php`
- Test: `tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn(User $user, string $to): mixed`, `$this->awaitRealtime(mixed $page): mixed` (plan 16a) and `$this->workQueue(): void` (plan 16b Task 1: runs one queued job outside any browser request).
  - `data-test="integration-card-<provider>"` (Task 1 of this plan).
  - `data-realtime` on the root of `retros/show` and `poker/show` (plan 16a).
  - Existing helpers in `tests/Pest.php`: `disableIntegrations()`, `enableIntegrations()`, `retroFacilitator(Retro $retro): array{0: User, 1: Participant}`, `retroMember(Retro $retro): array{0: User, 1: Participant}`, `teamMember(Team $team): User`, `integrationAdmin(Team $team): User`, `pokerFacilitator(PokerGame $game): array{0: User, 1: PokerPlayer}`, `configureLlm(): void`.
  - Factories: `RetroFactory::inPhase()`, `ParticipantFactory::guest()`, `ActionItemFactory::assignedTo(User $user)`, `ActionItemFactory::assignedToGuest(Participant $guest)`, `TeamIntegrationFactory::slack()`, `telegram()`.
- Produces:
  - File-level helpers (global functions; other files must not redeclare them): `p12bRetro(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array`, `p12bFakeChats(): void`, `p12bSentTo(string $host): array`, `p12bText(Request $request): string`.
  - Stable selectors that need no hook: the delivery lines `[role="dialog"] ul[aria-live="polite"]` (board and poker dialogs), the guest link checkbox `[role="dialog"] button[role="checkbox"]`, the dialog close button `[role="dialog"] button:has-text("Close")`.

- [ ] **Step 1: Create the test file with its helpers and the tests of steps 1 and 2**

Create `tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php` with this content:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Tests\Browser\Support\ReverbServer;

beforeEach(function () {
    $reverbHost = ReverbServer::Host;
    $reverbPort = ReverbServer::Port;

    Http::preventStrayRequests();
    Http::allowStrayRequests(["http://{$reverbHost}:{$reverbPort}/*"]);
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
    config(['queue.default' => 'database']);
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: Participant
 * }
 */
function p12bRetro(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create([
        'title' => 'Sprint 42',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $retro->team_id]);
    [$fran, $participant] = retroFacilitator($retro);
    $fran->forceFill(['name' => 'Fran Facilitator', 'locale' => 'en'])->save();

    return [$retro->refresh(), $fran, $participant];
}

function p12bFakeChats(): void
{
    Http::fake([
        'hooks.slack.com/*' => Http::response('ok'),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]]),
    ]);
}

/**
 * @return array<int, Request>
 */
function p12bSentTo(string $host): array
{
    return Http::recorded(fn (Request $request): bool => str_contains($request->url(), $host))
        ->map(fn (array $pair): Request => $pair[0])
        ->values()
        ->all();
}

function p12bText(Request $request): string
{
    return implode("\n", array_filter(Arr::flatten($request->data()), is_string(...)));
}

it('[P12b-01a] posts the board link to Slack with the guest link and to Telegram without it', function () {
    p12bFakeChats();
    [$retro, $fran] = p12bRetro(attributes: ['guest_access_enabled' => true]);
    $lines = '[role="dialog"] ul[aria-live="polite"]';
    $guestLink = '[role="dialog"] button[role="checkbox"]';

    $page = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $page->assertSee('Share')
        ->click('Share')
        ->assertSee('Share the board')
        ->assertSee('Post a link')
        ->assertVisible($guestLink)
        ->click($guestLink)
        ->assertAriaAttribute($guestLink, 'checked', 'true')
        ->click('Post link to Slack')
        ->assertSee('The message is on its way.')
        ->assertSeeIn($lines, 'Sending to Slack…');

    $this->workQueue();

    $page->assertSeeIn($lines, 'Sent to Slack')
        ->click($guestLink)
        ->assertAriaAttribute($guestLink, 'checked', 'false')
        ->click('Post link to Telegram')
        ->assertSeeIn($lines, 'Sending to Telegram…');

    $this->workQueue();

    $page->assertSeeIn($lines, 'Sent to Telegram')
        ->assertSeeIn($lines, 'Sent to Slack');

    [$slack] = p12bSentTo('hooks.slack.com');
    [$telegram] = p12bSentTo('api.telegram.org');
    $guestUrl = (string) $slack['blocks'][1]['elements'][0]['url'];

    expect($slack->url())->toBe('https://hooks.slack.com/services/T000/B000/XXXX')
        ->and($slack['text'])->toBe('Fran Facilitator invites you to the retrospective "Sprint 42" (Platform)')
        ->and($slack['blocks'][1]['elements'][0]['type'])->toBe('button')
        ->and($slack['blocks'][1]['elements'][0]['text']['text'])->toBe('Open the retrospective')
        ->and($guestUrl)->toEndWith("/join/{$retro->guest_token}")
        ->and($telegram->url())->toEndWith('/sendMessage')
        ->and($telegram['chat_id'])->toBe('-100123')
        ->and($telegram['text'])->toContain("/retros/{$retro->id}\">Open the retrospective</a>")
        ->and($telegram['text'])->not->toContain($retro->guest_token);

    $guest = visit((string) parse_url($guestUrl, PHP_URL_PATH));

    $guest->assertVisible('#name')
        ->assertSee('Join');
});

it('[P12b-01b] offers the guest link option only when guest access is on, and the Share button only to the facilitator', function () {
    p12bFakeChats();
    [$retro, $fran] = p12bRetro();
    [$bob] = retroMember($retro);
    $bob->forceFill(['name' => 'Bob Stone', 'locale' => 'en'])->save();

    $facilitator = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $facilitator->assertSee('Share')
        ->click('Share')
        ->assertSee('Share the board')
        ->assertSee('Post link to Slack')
        ->assertSee('Post link to Telegram')
        ->assertNotPresent('[role="dialog"] button[role="checkbox"]');

    $member->assertSeeIn('header > h1', 'Sprint 42')
        ->assertNotPresent('button:has-text("Share")');

    Http::assertNothingSent();
});

it('[P12b-01c] offers no share entry on the board, the results or the poker game while no integration is configured', function () {
    disableIntegrations();
    [$retro, $fran] = p12bRetro();
    $game = PokerGame::factory()->create(['title' => 'Sprint 12 sizing', 'team_id' => $retro->team_id]);
    [$ada] = pokerFacilitator($game);
    $ada->forceFill(['name' => 'Ada Facilitator', 'locale' => 'en'])->save();

    $board = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $board->assertSeeIn('header > h1', 'Sprint 42')
        ->assertPresent('[aria-label="Facilitator menu"]')
        ->assertNotPresent('button:has-text("Share")');

    $retro->forceFill(['phase' => RetroPhase::Completed, 'completed_at' => now()])->save();

    $board->navigate("/retros/{$retro->id}");

    $this->awaitRealtime($board)
        ->assertSee('Retrospective completed on')
        ->assertNotPresent('button:has-text("Share")');

    $poker = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $poker->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->assertDontSee('Share…');
});

it('[P12b-02a] escapes a retro title made of Slack and HTML markup in both messages', function () {
    p12bFakeChats();
    [$retro, $fran] = p12bRetro(attributes: ['title' => '<!channel> & <b>test</b>']);
    $lines = '[role="dialog"] ul[aria-live="polite"]';

    $page = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $page->assertSeeIn('header > h1', '<!channel> & <b>test</b>')
        ->click('Share')
        ->assertSee('Share the board')
        ->click('Post link to Slack')
        ->assertSeeIn($lines, 'Sending to Slack…')
        ->click('Post link to Telegram')
        ->assertSeeIn($lines, 'Sending to Telegram…');

    $this->workQueue();
    $this->workQueue();

    $page->assertSeeIn($lines, 'Sent to Slack')
        ->assertSeeIn($lines, 'Sent to Telegram');

    [$slack] = p12bSentTo('hooks.slack.com');
    [$telegram] = p12bSentTo('api.telegram.org');

    expect($slack['text'])->toBe('Fran Facilitator invites you to the retrospective "&lt;!channel&gt; &amp; &lt;b&gt;test&lt;/b&gt;" (Platform)')
        ->and($slack['blocks'][0]['text']['text'])->toBe($slack['text'])
        ->and(p12bText($slack))->not->toContain('<!channel>')
        ->and($telegram['text'])->toStartWith('Fran Facilitator invites you to the retrospective &quot;&lt;!channel&gt; &amp; &lt;b&gt;test&lt;/b&gt;&quot; (Platform)')
        ->and($telegram['text'])->not->toContain('<b>')
        ->and($telegram['text'])->not->toContain('<!channel>')
        ->and($telegram['parse_mode'])->toBe('HTML');
});
```

Notes on this step:

- `click('Share')` matches the header button by its exact visible text. If the board gains another element whose text is exactly "Share", use `header button:has-text("Share")` instead.
- `$this->workQueue()` runs one job per call, so two queued deliveries need two calls. After each job the page receives `results.changed` and refetches about one second later; the `assertSeeIn($lines, 'Sent to …')` call is the wait.
- `[P12b-01a]` opens the URL that was sent to Slack in a fresh browser context and sees the join form, which is the walkthrough's "the guest link opens the join page".
- `[P12b-01c]` keeps the Slack and Telegram connections in the database and only removes the instance configuration, which is the case Step 3 of the plan 12b verification describes.

- [ ] **Step 2: Run the tests of steps 1 and 2**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php --filter='P12b-0[12]'`
Expected: PASS (4 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 3: Add the recap and the results email tests (steps 3 and 4)**

Add these imports to the `use` block of the file, keeping the block sorted:

```php
use App\Enums\SummaryStatus;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\RotiVote;
use App\Models\Vote;
use App\Notifications\RetroResultsNotification;
use Illuminate\Support\Facades\Notification;
```

Append these tests to the file:

```php
it('[P12b-03a] shares the recap of an anonymous retro with counts, named action items and no card author', function () {
    p12bFakeChats();
    configureLlm();
    [$retro, $fran, $franParticipant] = p12bRetro(RetroPhase::Completed, [
        'is_anonymous' => true,
        'completed_at' => now(),
        'summary_status' => SummaryStatus::Pending,
        'summary_requested_at' => now(),
    ]);
    [$bob, $bobParticipant] = retroMember($retro);
    $bob->forceFill(['name' => 'Bob Stone', 'locale' => 'en'])->save();
    [$cara, $caraParticipant] = retroMember($retro);
    $cara->forceFill(['name' => 'Cara Author', 'locale' => 'en'])->save();
    $gus = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Gus']);
    $wins = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Wins', 'position' => 0]);
    $card = Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $wins->id,
        'participant_id' => $caraParticipant->id,
        'content' => 'Faster reviews',
    ]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $bobParticipant->id]);
    ActionItem::factory()->assignedToGuest($gus)->create([
        'content' => 'Write the runbook',
        'created_by_participant_id' => $franParticipant->id,
    ]);
    ActionItem::factory()->assignedTo($bob)->create([
        'retro_id' => $retro->id,
        'content' => 'Tidy the backlog',
        'created_by_participant_id' => $franParticipant->id,
    ]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $bobParticipant->id, 'score' => 4]);

    $page = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $page->assertSee('Retrospective completed on')
        ->click('Share')
        ->assertSee('Share to Slack')
        ->assertSee('Share to Telegram')
        ->assertDontSee('Send to email')
        ->click('Share to Slack')
        ->assertSee('Share the results to Slack')
        ->assertSee('The summary is still being generated and will not be included.')
        ->assertSee('Participants are shown as a count. Action items are shown with names.')
        ->assertSee('Card authors, votes and comments are never shared.')
        ->click('[role="dialog"] button:has-text("Send")')
        ->assertSee('The message is on its way.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Sending to Slack…');

    $this->workQueue();

    $page->assertSee('Sent to Slack')
        ->assertNotPresent('[role="menu"]')
        ->click('Share')
        ->assertSee('Share to Telegram')
        ->click('Share to Telegram')
        ->assertSee('Share the results to Telegram')
        ->click('[role="dialog"] button:has-text("Send")')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Sending to Telegram…');

    $this->workQueue();

    $page->assertSee('Sent to Telegram');

    [$slack] = p12bSentTo('hooks.slack.com');
    [$telegram] = p12bSentTo('api.telegram.org');

    foreach ([p12bText($slack), (string) $telegram['text']] as $recap) {
        expect($recap)->toContain('Results of the retrospective')
            ->toContain('Participants: 4')
            ->toContain('Cards: 1')
            ->toContain('ROTI: 4.0/5 (1 answers)')
            ->toContain('Write the runbook — Gus (guest)')
            ->toContain('Tidy the backlog — Bob Stone')
            ->toContain('Wins — Faster reviews (votes: 1)')
            ->not->toContain('Participants (4)')
            ->not->toContain('Cara Author')
            ->not->toContain('Fran Facilitator')
            ->not->toContain('Summary');
    }
});

it('[P12b-04a] emails the results to participants with an account in their own language, never to guests, and refuses a second send for ten minutes', function () {
    config(['mail.default' => 'smtp']);
    Notification::fake();
    p12bFakeChats();
    [$retro, $fran] = p12bRetro(RetroPhase::Completed, ['completed_at' => now()]);
    [$bob] = retroMember($retro);
    $bob->forceFill(['name' => 'Bob Stone', 'locale' => 'fr'])->save();
    [$dora] = retroMember($retro);
    $dora->forceFill(['name' => 'Dora Klein', 'locale' => 'de'])->save();
    Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Gus']);
    $bystander = teamMember($retro->team);
    $send = '[role="dialog"] button:has-text("Send")';

    $page = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $page->assertSee('Retrospective completed on')
        ->click('Share')
        ->assertSee('Send to email')
        ->click('Send to email')
        ->assertSee('Email the results')
        ->assertSee('Participants with an account (3)')
        ->assertSee('All team members (4)')
        ->assertSee('Guests have no account and are never emailed.')
        ->click($send)
        ->assertSee('The results are on their way.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Emailed to 3 people');

    Notification::assertCount(3);
    Notification::assertSentTo($fran, RetroResultsNotification::class, fn (RetroResultsNotification $notification, array $channels, object $notifiable, ?string $locale): bool => $notification->retroId === $retro->id && $locale === 'en');
    Notification::assertSentTo($bob, RetroResultsNotification::class, fn (RetroResultsNotification $notification, array $channels, object $notifiable, ?string $locale): bool => $locale === 'fr');
    Notification::assertSentTo($dora, RetroResultsNotification::class, fn (RetroResultsNotification $notification, array $channels, object $notifiable, ?string $locale): bool => $locale === 'de');
    Notification::assertNotSentTo($bystander, RetroResultsNotification::class);

    $page->assertNotPresent('[role="menu"]')
        ->click('Share')
        ->click('Send to email')
        ->assertSee('Email the results')
        ->click($send)
        ->assertSee('The results were emailed a few minutes ago.')
        ->click('[role="dialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="dialog"]');

    Notification::assertCount(3);

    $this->travel(11)->minutes();

    $page->assertNotPresent('[role="menu"]')
        ->click('Share')
        ->click('Send to email')
        ->assertSee('Email the results')
        ->click($send)
        ->assertNotPresent('[role="dialog"]');

    Notification::assertCount(6);
});
```

Notes on this step:

- In `[P12b-03a]` the card's author, Cara, is neither the sharer nor an assignee, so her name can only reach the recap as a card author; the test asserts it is absent. Every action item names `created_by_participant_id`, because the factory would otherwise create one more participant and change the count.
- `configureLlm()` only sets configuration. Nothing on the Results view calls the LLM by itself, and a stray call would fail the test.
- `[P12b-04a]` uses `Notification::fake()`: the fake records the locale each notification would be sent in (the recipient's `locale`), and a guest is not a notifiable at all, so `Notification::assertCount(3)` proves that the guest received nothing. The content of the mail is covered by `tests/Feature/Integrations/ResultsEmailTest.php`.
- The dialog closes only when the send succeeded, so `assertNotPresent('[role="dialog"]')` after the third click is the proof that the cooldown ended; it stays open with the error toast on the second send.

- [ ] **Step 4: Run the tests of steps 3 and 4**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php --filter='P12b-0[34]'`
Expected: PASS (2 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Add the poker share and the failed delivery tests (steps 5 and 6)**

Add these imports to the `use` block of the file, keeping the block sorted:

```php
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationStatus;
use App\Models\IntegrationDelivery;
```

Append these tests to the file:

```php
it('[P12b-05] posts the poker game link from "Share…" and removes the item once the game is ended', function () {
    p12bFakeChats();
    $game = PokerGame::factory()->create([
        'title' => 'Sprint 12 sizing',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
    ]);
    TeamIntegration::factory()->slack()->create(['team_id' => $game->team_id]);
    [$ada] = pokerFacilitator($game);
    $ada->forceFill(['name' => 'Ada Facilitator', 'locale' => 'en'])->save();
    $lines = '[role="dialog"] ul[aria-live="polite"]';

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Share…')
        ->click('Share…')
        ->assertSee('Share the game')
        ->assertNotPresent('[role="dialog"] button[role="checkbox"]')
        ->assertNotPresent('[role="dialog"] button:has-text("Post link to Telegram")')
        ->click('Post link to Slack')
        ->assertSee('The message is on its way.')
        ->assertSeeIn($lines, 'Sending to Slack…');

    $this->workQueue();

    $page->assertSeeIn($lines, 'Sent to Slack')
        ->click('[role="dialog"] button:has-text("Close")')
        ->assertNotPresent('[role="dialog"]');

    [$slack] = p12bSentTo('hooks.slack.com');

    expect($slack['text'])->toBe('Ada Facilitator invites you to the planning poker game "Sprint 12 sizing" (Platform)')
        ->and($slack['blocks'][1]['elements'][0]['text']['text'])->toBe('Open the game')
        ->and($slack['blocks'][1]['elements'][0]['url'])->toEndWith("/poker/{$game->id}");

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('End game')
        ->click('End game')
        ->assertSee('End this game?')
        ->click('[role="dialog"] button:has-text("End game")')
        ->assertNotPresent('[role="dialog"]')
        ->assertNotPresent('[role="menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Reopen game')
        ->assertDontSee('Share…');

    expect($game->fresh()->isEnded())->toBeTrue();
});

it('[P12b-06a] turns the delivery line to failed and the Slack card to "Reconnect required" when the channel is gone', function () {
    Http::fake([
        'hooks.slack.com/*' => Http::response('channel_is_archived', 410),
        'api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']]),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]]),
    ]);
    [$retro, $fran] = p12bRetro();
    $admin = integrationAdmin($retro->team);
    $admin->forceFill(['name' => 'Ada Admin', 'locale' => 'en'])->save();
    $lines = '[role="dialog"] ul[aria-live="polite"]';
    $slackCard = '[data-test="integration-card-slack"]';

    $page = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $page->click('Share')
        ->assertSee('Share the board')
        ->click('Post link to Slack')
        ->assertSeeIn($lines, 'Sending to Slack…');

    $this->workQueue();

    $page->assertSeeIn($lines, 'Slack: failed — Reconnect Slack in the team settings.')
        ->assertNotPresent('[role="dialog"] button:has-text("Post link to Slack")')
        ->assertPresent('[role="dialog"] button:has-text("Post link to Telegram")');

    $slack = $retro->team->integration(IntegrationProvider::Slack);

    expect($slack?->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($slack?->last_error)->toBe('channel_is_archived')
        ->and(IntegrationDelivery::query()->sole()->status)->toBe(IntegrationDeliveryStatus::Failed);

    $settings = $this->signIn($admin, route('teams.integrations.index', [$retro->team->workspace, $retro->team], false));

    $settings->assertScript("document.querySelector('[data-test=\"integration-card-slack\"] [data-slot=\"badge\"]').textContent", 'Reconnect required')
        ->assertSeeIn($slackCard, 'channel_is_archived')
        ->assertNotPresent("{$slackCard} button:has-text(\"Send a test message\")")
        ->assertScript("document.querySelector('[data-test=\"integration-card-telegram\"] [data-slot=\"badge\"]').textContent", 'Connected');
});
```

Notes on this step:

- A delivery that the provider refuses for good ends with `$this->fail(...)` inside the job; `queue:work --once` still exits with 0, so `$this->workQueue()` passes. If this fails, see the harness findings.
- In `[P12b-06a]` Slack answers 410 with the body `channel_is_archived`, which `SlackClient::postMessage` maps to "Reconnect required" and stores as the connection's error.

- [ ] **Step 6: Run the tests of steps 5 and 6**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php --filter='P12b-0[56]'`
Expected: PASS (2 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 7: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector`, then Pint again.

- [ ] **Step 8: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php`
Expected: PASS (8 tests).

- [ ] **Step 9: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php
git commit -m "test(browser): cover the plan 12b sharing walkthrough"
```

### Task 3: Plan 14a walkthrough, Microsoft Teams and Mattermost

This task automates the plan 14a walkthrough (`docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md`, line 4142, one sentence split here into five items: connect both channels, send a test message to each, share a board link and a game room invite, share the recap of an anonymous retro, break the Teams URL). Teams and Mattermost connect with a pasted webhook URL, so, unlike the OAuth providers of Task 1, the connection itself is driven in the browser. No product file changes in this task, so no frontend build is needed.

Facts about the product that the tests rely on (all read from the current code):

- Microsoft Teams is enabled by `services.msteams.enabled`; Mattermost by a valid `services.mattermost.url`. `enableIntegrations(IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost)` sets `true` and `https://chat.example.com`.
- A Teams URL is accepted when it is `https`, on port 443 and its host ends with `.logic.azure.com` or `.api.powerplatform.com` (`app/Rules/MicrosoftTeamsWebhookUrl.php`); a Mattermost URL when it is `<server>/hooks/<26 letters or digits>` (`app/Rules/MattermostWebhookUrl.php`). `TeamIntegrationFactory::MicrosoftTeamsUrl` and `TeamIntegrationFactory::MattermostUrl` are valid examples. Connecting sends nothing to the provider; the URL is stored encrypted and never returned to the browser (only the host and the label are).
- The card's dialog has a `type="url"` input and a label input with `maxlength="80"`; their ids come from `useId()`, so the tests address them by those attributes. The submit button reads "Connect" for a new connection and "Save" when replacing the URL.
- A Teams message is an Adaptive Card: the text of the first block is `attachments.0.content.body.0.text`, the button is `attachments.0.content.actions.0`. Markdown characters are escaped with a backslash (`MicrosoftTeamsText`). A Mattermost message is one `text` string; `@` and `~` are followed by a zero-width space so that `@channel` mentions nobody (`MattermostText`).
- Teams answers 400, 401, 403 or 404 when the workflow is gone; skrum then stores "The Teams workflow URL no longer works. Paste a new one." and marks the connection "Reconnect required" (`MicrosoftTeamsClient`).
- A standalone game room shows an "Invite" button in its header for the host when a chat channel is active (`room-invite-button.tsx`); the dialog "Invite to the room" uses the same "Post a link" section as the board.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php`
- Test: `tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn()`, `$this->awaitRealtime()` (plan 16a) and `$this->workQueue(): void` (plan 16b Task 1).
  - `data-test="integration-card-<provider>"` (Task 1 of this plan).
  - `data-realtime` on the root of `retros/show` and `games/show` (plan 16a).
  - Existing helpers in `tests/Pest.php`: `disableIntegrations()`, `enableIntegrations()`, `integrationAdmin(Team $team): User`, `retroFacilitator()`, `retroMember()`, `gameRoomHost(GameRoom $room): array{0: User, 1: GamePlayer}`.
  - Factories: `TeamIntegrationFactory::microsoftTeams()`, `mattermost()`, the constants `TeamIntegrationFactory::MicrosoftTeamsUrl` and `MattermostUrl`.
- Produces:
  - File-level helpers (global functions; other files must not redeclare them): `p14aAdmin(Team $team): User`, `p14aIntegrationsPath(Team $team): string`, `p14aCard(string $provider): string`, `p14aBadge(string $provider): string`, `p14aConnectChats(Team $team): void`, `p14aFakeChats(int $teamsStatus = 202): void`, `p14aSentTo(string $host): array`, `p14aText(Request $request): string`, `p14aRetro(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array`.

- [ ] **Step 1: Create the test file with its helpers and the connect and test message tests**

Create `tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php` with this content:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Tests\Browser\Support\ReverbServer;

beforeEach(function () {
    $reverbHost = ReverbServer::Host;
    $reverbPort = ReverbServer::Port;

    Http::preventStrayRequests();
    Http::allowStrayRequests(["http://{$reverbHost}:{$reverbPort}/*"]);
    disableIntegrations();
    enableIntegrations(IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost);
    config(['queue.default' => 'database']);
});

function p14aAdmin(Team $team): User
{
    $admin = integrationAdmin($team);

    $admin->forceFill(['name' => 'Ada Admin', 'locale' => 'en'])->save();

    return $admin;
}

function p14aIntegrationsPath(Team $team): string
{
    return route('teams.integrations.index', [$team->workspace, $team], false);
}

function p14aCard(string $provider): string
{
    return "[data-test=\"integration-card-{$provider}\"]";
}

function p14aBadge(string $provider): string
{
    return "document.querySelector('[data-test=\"integration-card-{$provider}\"] [data-slot=\"badge\"]').textContent";
}

function p14aConnectChats(Team $team): void
{
    TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->mattermost()->create(['team_id' => $team->id]);
}

function p14aFakeChats(int $teamsStatus = 202): void
{
    Http::fake([
        'prod-12.westeurope.logic.azure.com/*' => Http::response($teamsStatus === 202 ? '' : '{"error":{"code":"WorkflowNotFound"}}', $teamsStatus),
        'chat.example.com/*' => Http::response('ok'),
    ]);
}

/**
 * @return array<int, Request>
 */
function p14aSentTo(string $host): array
{
    return Http::recorded(fn (Request $request): bool => str_contains($request->url(), $host))
        ->map(fn (array $pair): Request => $pair[0])
        ->values()
        ->all();
}

function p14aText(Request $request): string
{
    return implode("\n", array_filter(Arr::flatten($request->data()), is_string(...)));
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: Participant
 * }
 */
function p14aRetro(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create([
        'title' => 'Sprint *42*',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    p14aConnectChats($retro->team);
    [$fran, $participant] = retroFacilitator($retro);
    $fran->forceFill(['name' => 'Fran Facilitator', 'locale' => 'en'])->save();

    return [$retro->refresh(), $fran, $participant];
}

it('[P14a-01a] connects a Microsoft Teams workflow by pasting its URL and never sends the URL back to the browser', function () {
    p14aFakeChats();
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p14aAdmin($team);
    $teams = p14aCard('msteams');
    $url = '[role="dialog"] input[type="url"]';

    $page = $this->signIn($admin, p14aIntegrationsPath($team));

    $page->assertCount('[data-test^="integration-card-"]', 2)
        ->assertSeeIn($teams, 'Microsoft Teams')
        ->assertScript(p14aBadge('msteams'), 'Not connected')
        ->click("{$teams} button:has-text(\"Connect\")")
        ->assertSee('Connect Microsoft Teams')
        ->fill($url, 'https://example.com/workflows/abc')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertSee('Use the workflow URL from Microsoft Teams.')
        ->fill($url, TeamIntegrationFactory::MicrosoftTeamsUrl)
        ->fill('[role="dialog"] input[maxlength="80"]', 'Retro channel')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertSee('Microsoft Teams connected.')
        ->assertNotPresent('[role="dialog"]')
        ->assertScript(p14aBadge('msteams'), 'Connected')
        ->assertSeeIn($teams, 'prod-12.westeurope.logic.azure.com')
        ->assertSeeIn($teams, 'Retro channel')
        ->assertSeeIn($teams, 'Ada Admin')
        ->assertPresent("{$teams} button:has-text(\"Replace URL\")");

    $page->navigate(p14aIntegrationsPath($team))
        ->assertScript(p14aBadge('msteams'), 'Connected')
        ->assertSourceMissing('teams-signature');

    $integration = TeamIntegration::query()->sole();

    expect($integration->provider)->toBe(IntegrationProvider::MicrosoftTeams)
        ->and($integration->credential('url'))->toBe(TeamIntegrationFactory::MicrosoftTeamsUrl)
        ->and($integration->setting('channelLabel'))->toBe('Retro channel');

    Http::assertNothingSent();
});

it('[P14a-01b] connects a Mattermost incoming webhook of the configured server only', function () {
    p14aFakeChats();
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p14aAdmin($team);
    $mattermost = p14aCard('mattermost');
    $url = '[role="dialog"] input[type="url"]';

    $page = $this->signIn($admin, p14aIntegrationsPath($team));

    $page->assertScript(p14aBadge('mattermost'), 'Not connected')
        ->assertSeeIn($mattermost, 'through an incoming webhook of https://chat.example.com.')
        ->click("{$mattermost} button:has-text(\"Connect\")")
        ->assertSee('Connect Mattermost')
        ->fill($url, 'https://other.example.com/hooks/abcdefghijklmnopqrstuvwxyz')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertSee('Use an incoming webhook of https://chat.example.com.')
        ->fill($url, TeamIntegrationFactory::MattermostUrl)
        ->click('[role="dialog"] button[type="submit"]')
        ->assertSee('Mattermost connected.')
        ->assertNotPresent('[role="dialog"]')
        ->assertScript(p14aBadge('mattermost'), 'Connected')
        ->assertSeeIn($mattermost, 'chat.example.com')
        ->assertSeeIn($mattermost, 'Ada Admin');

    $page->navigate(p14aIntegrationsPath($team))
        ->assertScript(p14aBadge('mattermost'), 'Connected')
        ->assertSourceMissing('abcdefghijklmnopqrstuvwxyz');

    $integration = TeamIntegration::query()->sole();

    expect($integration->provider)->toBe(IntegrationProvider::Mattermost)
        ->and($integration->credential('url'))->toBe(TeamIntegrationFactory::MattermostUrl)
        ->and($integration->setting('host'))->toBe('chat.example.com');

    Http::assertNothingSent();
});

it('[P14a-02] sends a test message to Microsoft Teams and to Mattermost', function () {
    p14aFakeChats();
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p14aAdmin($team);
    p14aConnectChats($team);
    $teams = p14aCard('msteams');
    $mattermost = p14aCard('mattermost');

    $page = $this->signIn($admin, p14aIntegrationsPath($team));

    $page->assertScript(p14aBadge('msteams'), 'Connected')
        ->assertScript(p14aBadge('mattermost'), 'Connected')
        ->assertSeeIn($teams, '#retros')
        ->assertSeeIn($mattermost, 'town-square')
        ->assertSeeIn($teams, 'Never')
        ->click("{$teams} button:has-text(\"Send a test message\")")
        ->assertSee('Test message sent.')
        ->assertDontSeeIn($teams, 'Never')
        ->assertSeeIn($mattermost, 'Never')
        ->click("{$mattermost} button:has-text(\"Send a test message\")")
        ->assertDontSeeIn($mattermost, 'Never');

    [$toTeams] = p14aSentTo('prod-12.westeurope.logic.azure.com');
    [$toMattermost] = p14aSentTo('chat.example.com');

    expect($toTeams['type'])->toBe('message')
        ->and($toTeams['attachments'][0]['contentType'])->toBe('application/vnd.microsoft.card.adaptive')
        ->and($toTeams['attachments'][0]['content']['body'][0]['text'])->toBe('skrum is connected.')
        ->and($toMattermost->url())->toBe(TeamIntegrationFactory::MattermostUrl)
        ->and($toMattermost['text'])->toBe('skrum is connected.');

    Http::assertSentCount(2);
});
```

Notes on this step:

- `p14aFakeChats()` is called even where nothing should be sent: `Http::assertNothingSent()` only means something once the fake is recording.
- In `[P14a-01a]` the first URL is a well-formed `https` URL, so the browser's own `type="url"` check lets the form submit and the server's rule answers with its message.
- The page is reloaded with `navigate()` before `assertSourceMissing()`: the first HTML of an Inertia page carries all its props, so a URL that reached the browser would be in the source.

- [ ] **Step 2: Run the connect and test message tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php --filter='P14a-0[12]'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 3: Add the link, room invite and recap tests**

Add these imports to the `use` block of the file, keeping the block sorted:

```php
use App\Enums\GameKind;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\GameRoom;
use App\Models\RotiVote;
use App\Models\Vote;
```

Append these tests to the file:

```php
it('[P14a-03a] posts the board link to Microsoft Teams and to Mattermost with the title escaped', function () {
    p14aFakeChats();
    [$retro, $fran] = p14aRetro();
    $lines = '[role="dialog"] ul[aria-live="polite"]';

    $page = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $page->assertSeeIn('header > h1', 'Sprint *42*')
        ->click('Share')
        ->assertSee('Share the board')
        ->click('Post link to Microsoft Teams')
        ->assertSeeIn($lines, 'Sending to Microsoft Teams…')
        ->click('Post link to Mattermost')
        ->assertSeeIn($lines, 'Sending to Mattermost…');

    $this->workQueue();
    $this->workQueue();

    $page->assertSeeIn($lines, 'Sent to Microsoft Teams')
        ->assertSeeIn($lines, 'Sent to Mattermost');

    [$toTeams] = p14aSentTo('prod-12.westeurope.logic.azure.com');
    [$toMattermost] = p14aSentTo('chat.example.com');

    expect($toTeams['attachments'][0]['content']['body'][0]['text'])->toBe('Fran Facilitator invites you to the retrospective "Sprint \*42\*" \(Platform\)')
        ->and($toTeams['attachments'][0]['content']['actions'][0]['title'])->toBe('Open the retrospective')
        ->and($toTeams['attachments'][0]['content']['actions'][0]['url'])->toEndWith("/retros/{$retro->id}")
        ->and($toMattermost['text'])->toContain('Sprint \*42\*')
        ->and($toMattermost['text'])->toEndWith("/retros/{$retro->id})");
});

it('[P14a-03b] posts a game room invite to Microsoft Teams and to Mattermost', function () {
    p14aFakeChats();
    $room = GameRoom::factory()->create([
        'name' => 'Friday fun',
        'game' => GameKind::Hangman,
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
    ]);
    p14aConnectChats($room->team);
    [$hana] = gameRoomHost($room);
    $hana->forceFill(['name' => 'Hana Host', 'locale' => 'en'])->save();
    $lines = '[role="dialog"] ul[aria-live="polite"]';

    $page = $this->awaitRealtime($this->signIn($hana, "/games/{$room->id}"));

    $page->assertSee('Invite')
        ->click('Invite')
        ->assertSee('Invite to the room')
        ->assertSee('Only members of Platform can join.')
        ->assertNotPresent('[role="dialog"] button[role="checkbox"]')
        ->click('Post link to Microsoft Teams')
        ->assertSeeIn($lines, 'Sending to Microsoft Teams…')
        ->click('Post link to Mattermost')
        ->assertSeeIn($lines, 'Sending to Mattermost…');

    $this->workQueue();
    $this->workQueue();

    $page->assertSeeIn($lines, 'Sent to Microsoft Teams')
        ->assertSeeIn($lines, 'Sent to Mattermost');

    [$toTeams] = p14aSentTo('prod-12.westeurope.logic.azure.com');
    [$toMattermost] = p14aSentTo('chat.example.com');

    expect($toTeams['attachments'][0]['content']['body'][0]['text'])->toBe('Hana Host invites you to play Hangman in "Friday fun" \(Platform\)')
        ->and($toTeams['attachments'][0]['content']['actions'][0]['title'])->toBe('Join the game')
        ->and($toTeams['attachments'][0]['content']['actions'][0]['url'])->toEndWith("/games/{$room->id}")
        ->and($toMattermost['text'])->toContain('Hana Host invites you to play Hangman in "Friday fun"')
        ->and($toMattermost['text'])->toEndWith("/games/{$room->id})");
});

it('[P14a-04a] shares the recap of an anonymous retro to both channels with a count, named action items and a literal @channel', function () {
    p14aFakeChats();
    [$retro, $fran, $franParticipant] = p14aRetro(RetroPhase::Completed, [
        'title' => 'Sprint 42',
        'is_anonymous' => true,
        'completed_at' => now(),
    ]);
    [$bob, $bobParticipant] = retroMember($retro);
    $bob->forceFill(['name' => 'Bob Stone', 'locale' => 'en'])->save();
    [$cara, $caraParticipant] = retroMember($retro);
    $cara->forceFill(['name' => 'Cara Author', 'locale' => 'en'])->save();
    $gus = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Gus']);
    $wins = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Wins', 'position' => 0]);
    $card = Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $wins->id,
        'participant_id' => $caraParticipant->id,
        'content' => 'Ping @channel about reviews',
    ]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $bobParticipant->id]);
    ActionItem::factory()->assignedToGuest($gus)->create([
        'content' => 'Write the runbook',
        'created_by_participant_id' => $franParticipant->id,
    ]);
    ActionItem::factory()->assignedTo($bob)->create([
        'retro_id' => $retro->id,
        'content' => 'Tidy the backlog',
        'created_by_participant_id' => $franParticipant->id,
    ]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $bobParticipant->id, 'score' => 4]);

    $page = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $page->assertSee('Retrospective completed on')
        ->click('Share')
        ->assertSee('Share to Microsoft Teams')
        ->click('Share to Microsoft Teams')
        ->assertSee('Share the results to Microsoft Teams')
        ->assertSee('Participants are shown as a count. Action items are shown with names.')
        ->click('[role="dialog"] button:has-text("Send")')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Sending to Microsoft Teams…');

    $this->workQueue();

    $page->assertSee('Sent to Microsoft Teams')
        ->assertNotPresent('[role="menu"]')
        ->click('Share')
        ->assertSee('Share to Mattermost')
        ->click('Share to Mattermost')
        ->assertSee('Share the results to Mattermost')
        ->click('[role="dialog"] button:has-text("Send")')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Sending to Mattermost…');

    $this->workQueue();

    $page->assertSee('Sent to Mattermost');

    [$toTeams] = p14aSentTo('prod-12.westeurope.logic.azure.com');
    [$toMattermost] = p14aSentTo('chat.example.com');
    $teamsText = p14aText($toTeams);
    $mattermostText = (string) $toMattermost['text'];

    foreach ([$teamsText, $mattermostText] as $recap) {
        expect($recap)->toContain('Participants: 4')
            ->toContain('Write the runbook — Gus \(guest\)')
            ->toContain('Tidy the backlog — Bob Stone')
            ->toContain('about reviews \(votes: 1\)')
            ->not->toContain('Participants \(4\)')
            ->not->toContain('Cara Author')
            ->not->toContain('Fran Facilitator');
    }

    expect($teamsText)->toContain('Wins — Ping @channel about reviews')
        ->and($teamsText)->not->toContain('<at>')
        ->and($toTeams['attachments'][0]['content'])->not->toHaveKey('msteams')
        ->and($mattermostText)->toContain("Wins — Ping @\u{200B}channel about reviews")
        ->and($mattermostText)->not->toContain('@channel');
});
```

Notes on this step:

- The parentheses in the expected texts carry a backslash because both formats escape Markdown characters; the PHP strings are single-quoted, so `'\('` is a backslash followed by a parenthesis.
- A Teams mention needs a `<at>` tag in the text and an `msteams.entities` entry on the card; skrum sends neither, so `@channel` stays plain text there. Mattermost needs no entity, which is why skrum breaks the word with a zero-width space.
- `[P14a-03b]` opens a standalone Hangman room as its host. The room has no round yet; the header and its "Invite" button do not depend on one.

- [ ] **Step 4: Run the link, room invite and recap tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php --filter='P14a-0[34]'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Add the broken Teams URL test**

Add this import to the `use` block of the file, keeping the block sorted:

```php
use App\Enums\IntegrationStatus;
```

Append this test to the file:

```php
it('[P14a-05a] shows "Reconnect required" after a share to a deleted Teams workflow, and connects again when the URL is replaced', function () {
    p14aFakeChats(404);
    [$retro, $fran] = p14aRetro();
    $admin = p14aAdmin($retro->team);
    $lines = '[role="dialog"] ul[aria-live="polite"]';
    $teams = p14aCard('msteams');

    $page = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $page->click('Share')
        ->assertSee('Share the board')
        ->click('Post link to Microsoft Teams')
        ->assertSeeIn($lines, 'Sending to Microsoft Teams…');

    $this->workQueue();

    $page->assertSeeIn($lines, 'Microsoft Teams: failed — Reconnect Microsoft Teams in the team settings.')
        ->assertNotPresent('[role="dialog"] button:has-text("Post link to Microsoft Teams")')
        ->assertPresent('[role="dialog"] button:has-text("Post link to Mattermost")');

    expect($retro->team->integration(IntegrationProvider::MicrosoftTeams)?->status)->toBe(IntegrationStatus::ReconnectRequired);

    $settings = $this->signIn($admin, p14aIntegrationsPath($retro->team));

    $settings->assertScript(p14aBadge('msteams'), 'Reconnect required')
        ->assertSeeIn($teams, 'The Teams workflow URL no longer works. Paste a new one.')
        ->assertNotPresent("{$teams} button:has-text(\"Send a test message\")")
        ->assertScript(p14aBadge('mattermost'), 'Connected')
        ->click("{$teams} button:has-text(\"Replace URL\")")
        ->assertSee('Replace the URL')
        ->fill('[role="dialog"] input[type="url"]', 'https://prod-30.northeurope.logic.azure.com:443/workflows/def456/triggers/manual/paths/invoke?api-version=2016-06-01&sig=new-signature')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertSee('Connection saved.')
        ->assertNotPresent('[role="dialog"]')
        ->assertScript(p14aBadge('msteams'), 'Connected')
        ->assertSeeIn($teams, 'prod-30.northeurope.logic.azure.com')
        ->assertPresent("{$teams} button:has-text(\"Send a test message\")");

    expect($retro->team->integration(IntegrationProvider::MicrosoftTeams)?->status)->toBe(IntegrationStatus::Active);
});
```

Notes on this step:

- `p14aFakeChats(404)` makes the Teams host answer 404 with the body Teams sends for a deleted workflow; Mattermost stays healthy, so the share dialog keeps one channel and the failed line stays visible.
- Replacing the URL is not in the walkthrough's sentence; it is the recovery that "Reconnect required" asks for (extended integrations spec §4.3) and costs four lines here.

- [ ] **Step 6: Run the broken URL test**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php --filter='P14a-05'`
Expected: PASS (1 test); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 7: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector`, then Pint again.

- [ ] **Step 8: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php`
Expected: PASS (7 tests).

- [ ] **Step 9: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php
git commit -m "test(browser): cover the plan 14a Teams and Mattermost walkthrough"
```

### Task 4: Plan 12c walkthrough, part 1: tracker imports and the guest's view

This task automates steps 1, 2, 3 and 8 of the plan 12c walkthrough (`docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md`, lines 6235 to 6237 and 6242). The walkthrough was written for real Jira Cloud and Linear workspaces. Here the two providers are faked in process with `Http::fake()` (spec §3.6), the connections are arranged with `TeamIntegrationFactory` states, and the skrum interface is driven for real. The OAuth connection itself belongs to the plan 12a walkthrough.

Facts the tests rely on (all read from the current code):

- A provider is "enabled" when its client id and secret are configured (`enableIntegrations()` in `tests/Pest.php` sets them; `disableIntegrations()` clears every provider first, so a developer's `.env` cannot add cards or sources).
- `Http::fake([...patterns])` only answers the URLs it lists; any other request made through the `Http` facade is sent for real. A real request to `api.atlassian.com` with the factory's fake token would be answered 401, and skrum would then mark the connection "Reconnect required". Every helper below therefore ends with a catch-all for the provider's host that answers 404 (Jira) or a GraphQL error with status 400 (Linear, through `fakeLinearGraphql()`), which skrum treats as a refusal, never as a lost connection.
- The Reverb broadcast does not go through the `Http` facade (it uses the Pusher SDK with its own Guzzle client), so `Http::fake()` never touches realtime.
- The Import button (`resources/js/components/poker/tasks-pane.tsx`) is shown to every signed-in player (`me.canEditTasks`) of a game whose team has a connected tracker; guests never get it. With two connected trackers the dialog (`import-tasks-dialog.tsx`) shows a "Source" toggle group; with one it does not.
- The dialog's selects are Radix selects: the trigger is `[aria-label="Choose a board"]` / `[aria-label="Choose a sprint"]` (Jira) or `[aria-label="Choose a team"]` / `[aria-label="Choose a cycle"]` (Linear); options are `[role="option"]`. The list of boards or teams is requested 300 ms after the dialog opens; the click on the option is retried until the option exists.
- Each previewed issue is an `<li>` with a checkbox `[role="checkbox"][aria-label="<key>"]`.
- An imported task shows its key in a badge inside its row (`task-source-chip.tsx`); the current task's detail (`task-source-details.tsx`) shows the key as a link to the source, "Assignee: …", "<Source> estimate: …", the write-back badge and the notice "The title and description are managed in <Source>. Refresh the tasks to update them."; the Edit button (`[aria-label="Edit task"]`) is not rendered for an imported task.
- A guest's snapshot carries only `source`, `key` and `url` of an imported task (`PresentPokerTask`), so the guest sees the chip and the link, and neither the assignee, the source estimate nor the write-back state.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php`
- Test: `tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn(User $user, string $to): mixed`, `$this->joinAsGuest(string $joinUrl, string $name): mixed`, `$this->awaitRealtime(mixed $page): mixed`.
  - `data-realtime` on the root of `poker/show` and `data-test="poker-task-row"` on the task row (plan 16a).
  - Helpers of `tests/Pest.php`: `disableIntegrations(): void`, `enableIntegrations(IntegrationProvider ...$providers): void`, `pokerFacilitator(PokerGame $game): array`, `pokerMember(PokerGame $game): array`, `openPokerRound(PokerGame $game, ?PokerTask $task = null): PokerRound`, `importedPokerTask(PokerGame $game, array $attributes = [], IntegrationProvider $source = IntegrationProvider::Jira): PokerTask`, `jiraTrackerIssue(string $id, string $key, array $fields = []): array`, `linearTrackerIssue(string $id, string $identifier, array $overrides = []): array`, `fakeLinearGraphql(array $responses): void`, `jiraApiUrl(string $path): string`.
  - Factories: `TeamIntegrationFactory::jira()`, `TeamIntegrationFactory::linear()`, `PokerGameFactory::deck(PokerDeck $deck)`, `PokerGameFactory::withGuestAccess()`.
- Produces:
  - No product change and no new hook.
  - File-level helpers in `tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php`: `p12cTable(array $sources, PokerDeck $deck = PokerDeck::Fibonacci): array`, `p12cFakeJira(array $issues): void`, `p12cFakeLinear(array $issues): void`, `p12cJiraTask(PokerGame $game, string $id, string $key, string $title, array $attributes = []): PokerTask`, `p12cLinearTask(PokerGame $game, string $id, string $key, string $title, array $attributes = []): PokerTask`, `p12cTaskTitlesScript(): string`, `p12cShowJiraSprintIssues(mixed $page): mixed`.

- [ ] **Step 1: Create the file with its helpers and the tests of steps 1 and 2**

Create `tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

/**
 * @param  array<int, IntegrationProvider>  $sources
 * @return array{
 *     0: PokerGame,
 *     1: User,
 *     2: PokerPlayer,
 *     3: User,
 *     4: PokerPlayer
 * }
 */
function p12cTable(array $sources, PokerDeck $deck = PokerDeck::Fibonacci): array
{
    disableIntegrations();
    enableIntegrations(...$sources);

    $game = PokerGame::factory()
        ->deck($deck)
        ->withGuestAccess()
        ->create(['title' => 'Sprint 31 estimates']);

    foreach ($sources as $source) {
        $factory = TeamIntegration::factory();
        $connected = $source === IntegrationProvider::Linear ? $factory->linear() : $factory->jira();

        $connected->create(['team_id' => $game->team_id]);
    }

    [$ada, $adaPlayer] = pokerFacilitator($game);
    [$bob, $bobPlayer] = pokerMember($game);

    $ada->forceFill(['name' => 'Ada Facilitator', 'locale' => 'en'])->save();
    $bob->forceFill(['name' => 'Bob Member', 'locale' => 'en'])->save();

    return [$game, $ada, $adaPlayer, $bob, $bobPlayer];
}

/**
 * @param  array<int, array<string, mixed>>  $issues
 */
function p12cFakeJira(array $issues): void
{
    Http::fake([
        jiraApiUrl('rest/agile/1.0/board/*/sprint*') => Http::response(['values' => [
            ['id' => 31, 'name' => 'Sprint 31', 'state' => 'active'],
        ]]),
        jiraApiUrl('rest/agile/1.0/board*') => Http::response([
            'values' => [['id' => 7, 'name' => 'Web team board']],
            'isLast' => true,
        ]),
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => $issues, 'isLast' => true]),
        jiraApiUrl('rest/api/3/issue/*/editmeta') => Http::response(['fields' => [
            'customfield_10016' => ['name' => 'Story point estimate'],
        ]]),
        jiraApiUrl('rest/api/3/issue/*') => Http::response(null, 204),
        'api.atlassian.com/*' => Http::response(['errorMessages' => ['Unexpected request in a browser test.']], 404),
    ]);
}

/**
 * @param  array<int, array<string, mixed>>  $issues
 */
function p12cFakeLinear(array $issues): void
{
    fakeLinearGraphql([
        'teams(first' => ['teams' => ['nodes' => [['id' => 'team-1', 'name' => 'Engineering']]]],
        'cycles(first' => ['team' => ['cycles' => ['nodes' => [[
            'id' => 'cycle-1',
            'name' => 'Cycle 12',
            'number' => 12,
            'startsAt' => '2026-10-05T00:00:00.000Z',
            'endsAt' => '2026-10-19T00:00:00.000Z',
            'isActive' => true,
        ]]]]],
        'cycle(id' => ['cycle' => ['issues' => ['nodes' => $issues, 'pageInfo' => ['hasNextPage' => false]]]],
        'searchIssues' => ['searchIssues' => ['nodes' => array_slice($issues, 0, 1), 'pageInfo' => ['hasNextPage' => false]]],
        'issues(first' => fn (array $variables): array => ['issues' => ['nodes' => array_values(array_filter(
            $issues,
            fn (array $issue): bool => in_array($issue['id'], (array) ($variables['ids'] ?? []), true),
        ))]],
        'issueEstimationType' => ['issue' => ['team' => ['issueEstimationType' => 'fibonacci', 'issueEstimationAllowZero' => false]]],
        'issueUpdate(' => ['issueUpdate' => ['success' => true]],
    ]);
}

/**
 * @param  array<string, mixed>  $attributes
 */
function p12cJiraTask(PokerGame $game, string $id, string $key, string $title, array $attributes = []): PokerTask
{
    return importedPokerTask($game, [
        'title' => $title,
        'external_id' => $id,
        'external_key' => $key,
        'external_url' => "https://acme.atlassian.net/browse/{$key}",
        ...$attributes,
    ]);
}

function p12cTaskTitlesScript(): string
{
    return 'Array.from(document.querySelectorAll(\'[data-test="poker-task-row"]\')).map(function (row) { return row.querySelector("span span").textContent; }).join(" / ")';
}

function p12cShowJiraSprintIssues(mixed $page): mixed
{
    $page->assertSee('Import')
        ->click('Import')
        ->assertSee('Import tasks')
        ->assertVisible('[aria-label="Choose a board"]')
        ->click('[aria-label="Choose a board"]')
        ->click('[role="option"]:has-text("Web team board")')
        ->assertEnabled('[aria-label="Choose a sprint"]')
        ->click('[aria-label="Choose a sprint"]')
        ->click('[role="option"]:has-text("Sprint 31")')
        ->assertButtonEnabled('Show issues')
        ->click('Show issues');

    return $page;
}

it('[P12c-01] offers the import from Jira and from Linear in a game of a connected team', function () {
    [$game, $ada] = p12cTable([IntegrationProvider::Jira, IntegrationProvider::Linear]);
    p12cFakeJira([]);
    p12cFakeLinear([]);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Fibonacci')
        ->assertSee('Import')
        ->click('Import')
        ->assertSee('Import tasks')
        ->assertVisible('[aria-label="Source"] button:has-text("Jira")')
        ->assertVisible('[aria-label="Source"] button:has-text("Linear")')
        ->assertVisible('[aria-label="Import from Jira"]')
        ->assertVisible('[aria-label="Choose a board"]')
        ->click('[aria-label="Source"] button:has-text("Linear")')
        ->assertVisible('[aria-label="Import from Linear"]')
        ->assertVisible('[aria-label="Choose a team"]')
        ->click('Cancel')
        ->assertNotPresent('[role="dialog"]');

    expect(PokerTask::query()->where('poker_game_id', $game->id)->count())->toBe(0);
});

it('[P12c-02a] imports an active Jira sprint in sprint order with the issue keys', function () {
    [$game, $ada, , $bob] = p12cTable([IntegrationProvider::Jira]);
    p12cFakeJira([
        jiraTrackerIssue('10001', 'PROJ-1', ['summary' => 'Checkout page']),
        jiraTrackerIssue('10002', 'PROJ-2', ['summary' => 'Payment retries']),
    ]);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    p12cShowJiraSprintIssues($facilitator)
        ->assertNotPresent('[aria-label="Source"]')
        ->assertAttribute('[role="dialog"] [role="checkbox"][aria-label="PROJ-1"]', 'aria-checked', 'true')
        ->assertAttribute('[role="dialog"] [role="checkbox"][aria-label="PROJ-2"]', 'aria-checked', 'true')
        ->assertSeeIn('[role="dialog"] li:has-text("PROJ-1")', 'Checkout page')
        ->assertSeeIn('[role="dialog"] li:has-text("PROJ-1")', 'Jane Doe')
        ->click('Import 2 tasks')
        ->assertSee('2 imported, 0 skipped.')
        ->assertNotPresent('[role="dialog"]')
        ->assertCount('@poker-task-row', 2)
        ->assertScript(p12cTaskTitlesScript(), 'Checkout page / Payment retries')
        ->assertSeeIn('[data-test="poker-task-row"]:has-text("Checkout page")', 'PROJ-1')
        ->assertSeeIn('[data-test="poker-task-row"]:has-text("Payment retries")', 'PROJ-2');

    $member->assertCount('@poker-task-row', 2)
        ->assertScript(p12cTaskTitlesScript(), 'Checkout page / Payment retries')
        ->assertSeeIn('[data-test="poker-task-row"]:has-text("Checkout page")', 'PROJ-1');

    $facilitator->click('Checkout page')
        ->assertPresent('section[aria-labelledby^="poker-task-"] a[href="https://acme.atlassian.net/browse/PROJ-1"]')
        ->assertSee('Assignee: Jane Doe')
        ->assertSee('Jira estimate: 3');

    Http::assertSent(fn (Request $request): bool => str_ends_with($request->url(), '/rest/api/3/search/jql')
        && $request['jql'] === 'sprint = 31 ORDER BY Rank ASC');

    expect(PokerTask::query()->where('poker_game_id', $game->id)->orderBy('position')->pluck('external_key')->all())
        ->toBe(['PROJ-1', 'PROJ-2'])
        ->and(PokerTask::query()->where('poker_game_id', $game->id)->pluck('external_source')->unique()->all())
        ->toBe(['jira']);
});

it('[P12c-02b] shows the issues of a sprint imported before as already imported', function () {
    [$game, $ada] = p12cTable([IntegrationProvider::Jira]);
    p12cFakeJira([
        jiraTrackerIssue('10001', 'PROJ-1', ['summary' => 'Checkout page']),
        jiraTrackerIssue('10002', 'PROJ-2', ['summary' => 'Payment retries']),
    ]);
    p12cJiraTask($game, '10001', 'PROJ-1', 'Checkout page');
    p12cJiraTask($game, '10002', 'PROJ-2', 'Payment retries');

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    p12cShowJiraSprintIssues($page)
        ->assertCount('[role="dialog"] li:has-text("Already imported")', 2)
        ->assertDisabled('[role="dialog"] [role="checkbox"][aria-label="PROJ-1"]')
        ->assertDisabled('[role="dialog"] [role="checkbox"][aria-label="PROJ-2"]')
        ->assertButtonDisabled('Import 0 tasks')
        ->click('Cancel')
        ->assertNotPresent('[role="dialog"]')
        ->assertCount('@poker-task-row', 2);

    expect(PokerTask::query()->where('poker_game_id', $game->id)->count())->toBe(2);
});
```

`[P12c-01]` replaces "Connect Jira and Linear" with connections arranged by the factory: the OAuth round trip cannot be followed against a fake and is checked by the plan 12a walkthrough.

- [ ] **Step 2: Run the tests of steps 1 and 2**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php --filter='P12c-0[12]'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If the board option is not found, see the harness findings ("What retries"): the click on `[role="option"]` is repeated until the list, which is requested 300 ms after the dialog opens, has arrived.

- [ ] **Step 3: Add the Linear helper and the tests of steps 3 and 8**

In `tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php`, add this helper directly after `p12cJiraTask()`:

```php
/**
 * @param  array<string, mixed>  $attributes
 */
function p12cLinearTask(PokerGame $game, string $id, string $key, string $title, array $attributes = []): PokerTask
{
    return importedPokerTask($game, [
        'title' => $title,
        'external_id' => $id,
        'external_key' => $key,
        'external_url' => "https://linear.app/acme/issue/{$key}",
        ...$attributes,
    ], IntegrationProvider::Linear);
}
```

Append these tests at the end of the file:

```php
it('[P12c-03a] imports a Linear cycle after switching the source', function () {
    [$game, $ada] = p12cTable([IntegrationProvider::Jira, IntegrationProvider::Linear]);
    p12cFakeJira([]);
    p12cFakeLinear([
        linearTrackerIssue('lin-1', 'ENG-1', ['title' => 'Login form']),
        linearTrackerIssue('lin-2', 'ENG-2', ['title' => 'Signup form']),
    ]);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Import')
        ->click('Import')
        ->assertVisible('[aria-label="Source"] button:has-text("Linear")')
        ->click('[aria-label="Source"] button:has-text("Linear")')
        ->assertVisible('[aria-label="Choose a team"]')
        ->click('[aria-label="Choose a team"]')
        ->click('[role="option"]:has-text("Engineering")')
        ->assertEnabled('[aria-label="Choose a cycle"]')
        ->click('[aria-label="Choose a cycle"]')
        ->click('[role="option"]:has-text("Cycle 12")')
        ->assertButtonEnabled('Show issues')
        ->click('Show issues')
        ->assertAttribute('[role="dialog"] [role="checkbox"][aria-label="ENG-1"]', 'aria-checked', 'true')
        ->assertSeeIn('[role="dialog"] li:has-text("ENG-2")', 'Signup form')
        ->click('Import 2 tasks')
        ->assertSee('2 imported, 0 skipped.')
        ->assertNotPresent('[role="dialog"]')
        ->assertCount('@poker-task-row', 2)
        ->assertScript(p12cTaskTitlesScript(), 'Login form / Signup form')
        ->assertSeeIn('[data-test="poker-task-row"]:has-text("Login form")', 'ENG-1')
        ->assertSeeIn('[data-test="poker-task-row"]:has-text("Signup form")', 'ENG-2');

    Http::assertSent(fn (Request $request): bool => str_contains((string) $request['query'], 'cycle(id')
        && data_get($request->data(), 'variables.id') === 'cycle-1');

    expect(PokerTask::query()->where('poker_game_id', $game->id)->orderBy('position')->pluck('external_key')->all())
        ->toBe(['ENG-1', 'ENG-2'])
        ->and(PokerTask::query()->where('poker_game_id', $game->id)->pluck('external_source')->unique()->all())
        ->toBe(['linear']);
});

it('[P12c-03b] imports the result of a Linear search', function () {
    [$game, $ada] = p12cTable([IntegrationProvider::Linear]);
    p12cFakeLinear([
        linearTrackerIssue('lin-1', 'ENG-1', ['title' => 'Login form']),
        linearTrackerIssue('lin-2', 'ENG-2', ['title' => 'Signup form']),
    ]);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Import')
        ->click('Import')
        ->assertSee('Import tasks')
        ->assertNotPresent('[aria-label="Source"]')
        ->click('[role="dialog"] button:has-text("Query")')
        ->assertVisible('#import-query')
        ->fill('#import-query', 'login')
        ->assertButtonEnabled('Show issues')
        ->click('Show issues')
        ->assertCount('[role="dialog"] [role="checkbox"][aria-label^="ENG-"]', 1)
        ->assertSeeIn('[role="dialog"] li:has-text("ENG-1")', 'Login form')
        ->click('Import 1 tasks')
        ->assertSee('1 imported, 0 skipped.')
        ->assertNotPresent('[role="dialog"]')
        ->assertCount('@poker-task-row', 1)
        ->assertSeeIn('[data-test="poker-task-row"]:has-text("Login form")', 'ENG-1');

    Http::assertSent(fn (Request $request): bool => str_contains((string) $request['query'], 'searchIssues')
        && data_get($request->data(), 'variables.term') === 'login');

    expect(PokerTask::query()->where('poker_game_id', $game->id)->pluck('external_key')->all())->toBe(['ENG-1']);
});

it('[P12c-03c] shows the source link, the assignee and the source estimate of an imported task, which cannot be edited', function () {
    [$game, $ada] = p12cTable([IntegrationProvider::Linear]);
    p12cLinearTask($game, 'lin-1', 'ENG-1', 'Login form', [
        'description' => 'About **ENG-1**',
        'external_assignee' => 'Sam Lee',
        'external_estimate' => '2',
    ]);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Manual task']);
    $link = 'section[aria-labelledby^="poker-task-"] a[href="https://linear.app/acme/issue/ENG-1"]';

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertCount('@poker-task-row', 2)
        ->click('Login form')
        ->assertPresent($link)
        ->assertSeeIn($link, 'ENG-1')
        ->assertAttribute($link, 'target', '_blank')
        ->assertSee('Assignee: Sam Lee')
        ->assertSee('Linear estimate: 2')
        ->assertSee('The title and description are managed in Linear. Refresh the tasks to update them.')
        ->assertNotPresent('[aria-label="Edit task"]')
        ->assertVisible('[aria-label="Delete task"]');

    $page->click('Manual task')
        ->assertVisible('[aria-label="Edit task"]')
        ->assertNotPresent($link)
        ->assertDontSee('managed in Linear');
});

it('[P12c-08] shows a guest the key chips only, without import, assignee or sync state', function () {
    [$game, , , $bob] = p12cTable([IntegrationProvider::Jira]);
    $task = p12cJiraTask($game, '10001', 'PROJ-1', 'Checkout page', [
        'external_assignee' => 'Jane Doe',
        'external_estimate' => '3',
        'estimate' => '5',
        'estimate_numeric' => 5,
        'estimated_at' => now(),
        'synced_at' => now(),
    ]);
    openPokerRound($game, $task);
    $link = 'section[aria-labelledby^="poker-task-"] a[href="https://acme.atlassian.net/browse/PROJ-1"]';

    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    $member->assertSeeIn('[data-test="poker-task-row"]:has-text("Checkout page")', 'PROJ-1')
        ->assertPresent($link)
        ->assertSee('Assignee: Jane Doe')
        ->assertSee('Jira estimate: 3')
        ->assertSee('Synced to Jira')
        ->assertVisible('button:has-text("Import")');

    $guest->assertSeeIn('[data-test="poker-task-row"]:has-text("Checkout page")', 'PROJ-1')
        ->assertPresent($link)
        ->assertNotPresent('button:has-text("Import")')
        ->assertNotPresent('[aria-label="More task actions"]')
        ->assertDontSee('Jane Doe')
        ->assertDontSee('Jira estimate')
        ->assertDontSee('Synced to Jira')
        ->assertDontSee('Sync pending');
});
```

`[P12c-03c]` and `[P12c-08]` make no provider call (an imported task is presented from the database), so they need no fake.

- [ ] **Step 4: Run the tests of steps 3 and 8**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php --filter='P12c-03|P12c-08'`
Expected: PASS (4 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector`, then `vendor/bin/pint --dirty --format agent` again.

- [ ] **Step 6: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php`
Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php
git commit -m "test(browser): cover the poker tracker imports and the guest's view of imported tasks"
```

### Task 5: Plan 12c walkthrough, part 2: estimate write-back, failure and retry, refresh

This task automates steps 4 to 7 of the plan 12c walkthrough (`docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md`, lines 6238 to 6241) in the file created by Task 4.

Facts the tests rely on (all read from the current code):

- Saving an estimate of an imported task marks it `needs_sync` and dispatches `App\Jobs\SyncTaskEstimate` after the commit (`RequestEstimateSync`). With the suite's `sync` queue the job would run inside the browser's request and the "Sync pending" badge would never be seen, so each test switches to the `database` queue first and runs the job with `$this->workQueue()`.
- The job broadcasts `task.saved` with the reduced task; a signed-in player's page answers it by fetching the snapshot again (`use-poker-game.ts`), which is how the badge changes from "Sync pending" to "Synced to Jira" or "Sync failed" without a reload.
- The facilitator saves an estimate with the "Save estimate" button of the toolbar; the select next to it (`[aria-label="Estimate"]`) is preset to the task's estimate or to the round's nearest card. A revealed round with two equal votes therefore presets the value the test wants.
- A T-shirt deck is never written to Jira or Linear: the task shows "Not synced: T-shirt estimates can't be written to Jira." and no job is queued.
- "Refresh from Jira" is the only item of the menu behind `[aria-label="More task actions"]`; it answers with two toasts, ":count tasks refreshed." and, when an issue is gone, ":count tasks were not found in :source.", and the task that is gone shows the badge "Not found in Jira" in its detail.
- Renaming or deleting an issue happens inside Jira. The tests simulate its effect with the faked answer of the next search (a new summary; an issue left out) and their rows are `auto-substituted`.

**Files:**
- Modify: `tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php`
- Test: `tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php`

**Interfaces:**
- Consumes:
  - `$this->workQueue(): void` of `Tests\Browser\Support\InteractsWithBrowser` (plan 16b, Task 1): it binds a fresh request and runs one queued job with `queue:work --once`.
  - The helpers of Task 4: `p12cTable()`, `p12cFakeJira()`, `p12cFakeLinear()`, `p12cJiraTask()`, `p12cLinearTask()`, `p12cTaskTitlesScript()`.
  - Helpers of `tests/Pest.php`: `pokerVote(PokerRound $round, PokerPlayer $player, string $value): PokerVote`, `openPokerRound(PokerGame $game, ?PokerTask $task = null): PokerRound`, `jiraTrackerIssue()`.
  - Factory: `PokerRoundFactory::revealed()`.
- Produces:
  - File-level helper `p12cRevealedRound(PokerGame $game, PokerTask $task, PokerPlayer $first, PokerPlayer $second, string $value): void`.

- [ ] **Step 1: Add the imports and the round helper**

In `tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php`, add these two imports in alphabetical order with the existing ones:

```php
use App\Models\PokerRound;
use Illuminate\Support\Facades\DB;
```

Add this helper directly after `p12cLinearTask()`:

```php
function p12cRevealedRound(PokerGame $game, PokerTask $task, PokerPlayer $first, PokerPlayer $second, string $value): void
{
    $round = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);

    pokerVote($round, $first, $value);
    pokerVote($round, $second, $value);

    $game->forceFill(['current_task_id' => $task->id])->save();
}
```

- [ ] **Step 2: Add the write-back tests of steps 4 to 6**

Append these tests at the end of the file:

```php
it('[P12c-04] writes a saved estimate back to Jira and shows it pending, then synced', function () {
    config(['queue.default' => 'database']);
    [$game, $ada, $adaPlayer, $bob, $bobPlayer] = p12cTable([IntegrationProvider::Jira]);
    p12cFakeJira([]);
    $task = p12cJiraTask($game, '10001', 'PROJ-1', 'Checkout page');
    p12cRevealedRound($game, $task, $adaPlayer, $bobPlayer, '5');

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $facilitator->assertVisible('[aria-label="Estimate"]')
        ->assertSeeIn('[aria-label="Estimate"]', '5')
        ->click('Save estimate')
        ->assertSee('Estimate: 5')
        ->assertSee('Sync pending');

    $member->assertSee('Estimate: 5')
        ->assertSee('Sync pending');

    Http::assertNothingSent();

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($task->refresh()->needs_sync)->toBeTrue();

    $this->workQueue();

    $facilitator->assertSee('Synced to Jira')
        ->assertDontSee('Sync pending')
        ->assertSee('Sync again');

    $member->assertSee('Synced to Jira')
        ->assertDontSee('Sync pending');

    Http::assertSent(fn (Request $request): bool => $request->method() === 'PUT'
        && str_ends_with($request->url(), '/rest/api/3/issue/10001')
        && $request->data() == ['fields' => ['customfield_10016' => 5.0]]);

    expect($task->refresh()->needs_sync)->toBeFalse()
        ->and($task->synced_at)->not->toBeNull()
        ->and($task->sync_error)->toBeNull();
});

it('[P12c-05a] shows a failed sync for a half point on a Linear task and syncs a whole number', function () {
    config(['queue.default' => 'database']);
    [$game, $ada, $adaPlayer, , $bobPlayer] = p12cTable([IntegrationProvider::Linear], PokerDeck::ModifiedFibonacci);
    p12cFakeLinear([]);
    $task = p12cLinearTask($game, 'lin-1', 'ENG-1', 'Login form');
    p12cRevealedRound($game, $task, $adaPlayer, $bobPlayer, '½');

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertVisible('[aria-label="Estimate"]')
        ->assertSeeIn('[aria-label="Estimate"]', '½')
        ->click('Save estimate')
        ->assertSee('Estimate: ½')
        ->assertSee('Sync pending');

    $this->workQueue();

    $page->assertSee('Sync failed')
        ->assertSee('Linear only accepts whole-number estimates.')
        ->assertVisible('section[aria-labelledby^="poker-task-"] button:has-text("Retry")');

    Http::assertNotSent(fn (Request $request): bool => str_contains((string) $request['query'], 'issueUpdate('));

    expect($task->refresh()->sync_error)->toBe('Linear only accepts whole-number estimates.')
        ->and($task->needs_sync)->toBeTrue();

    $page->click('[aria-label="Estimate"]')
        ->click('[role="option"]:has-text("8")')
        ->assertSeeIn('[aria-label="Estimate"]', '8')
        ->click('Save estimate')
        ->assertSee('Estimate: 8')
        ->assertSee('Sync pending');

    $this->workQueue();

    $page->assertSee('Synced to Linear')
        ->assertDontSee('Sync failed')
        ->assertDontSee('Linear only accepts whole-number estimates.');

    Http::assertSent(fn (Request $request): bool => str_contains((string) $request['query'], 'issueUpdate(')
        && data_get($request->data(), 'variables.id') === 'lin-1'
        && data_get($request->data(), 'variables.estimate') === 8);

    expect($task->refresh()->needs_sync)->toBeFalse()
        ->and($task->sync_error)->toBeNull();
});

it('[P12c-05b] retries a failed write-back and can force a synced estimate again', function () {
    config(['queue.default' => 'database']);
    [$game, $ada] = p12cTable([IntegrationProvider::Jira]);
    p12cFakeJira([]);
    $task = p12cJiraTask($game, '10001', 'PROJ-1', 'Checkout page', [
        'estimate' => '5',
        'estimate_numeric' => 5,
        'estimated_at' => now(),
        'needs_sync' => true,
        'sync_error' => 'Jira is not responding. Try again later.',
    ]);
    openPokerRound($game, $task);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Sync failed')
        ->assertSee('Jira is not responding. Try again later.')
        ->click('Retry')
        ->assertSee('Sync requested.')
        ->assertSee('Sync pending')
        ->assertDontSee('Jira is not responding. Try again later.');

    $this->workQueue();

    $page->assertSee('Synced to Jira')
        ->assertSee('Sync again')
        ->click('Sync again')
        ->assertSee('Sync pending');

    $this->workQueue();

    $page->assertSee('Synced to Jira')
        ->assertDontSee('Sync pending');

    expect(Http::recorded(fn (Request $request): bool => $request->method() === 'PUT'
        && $request->data() == ['fields' => ['customfield_10016' => 5.0]]))->toHaveCount(2)
        ->and($task->refresh()->needs_sync)->toBeFalse();
});

it('[P12c-06] does not write a T-shirt estimate to Jira and says why', function () {
    config(['queue.default' => 'database']);
    [$game, $ada, $adaPlayer, , $bobPlayer] = p12cTable([IntegrationProvider::Jira], PokerDeck::Tshirt);
    p12cFakeJira([]);
    $task = p12cJiraTask($game, '10001', 'PROJ-1', 'Checkout page');
    p12cRevealedRound($game, $task, $adaPlayer, $bobPlayer, 'M');

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertVisible('[aria-label="Estimate"]')
        ->assertSeeIn('[aria-label="Estimate"]', 'M')
        ->click('Save estimate')
        ->assertSee('Estimate: M')
        ->assertSee("Not synced: T-shirt estimates can't be written to Jira.")
        ->assertDontSee('Sync pending')
        ->assertNotPresent('section[aria-labelledby^="poker-task-"] button:has-text("Retry")');

    Http::assertNothingSent();

    expect(DB::table('jobs')->count())->toBe(0)
        ->and($task->refresh()->estimate)->toBe('M')
        ->and($task->needs_sync)->toBeFalse();
});
```

`[P12c-05a]` chooses 8 where the walkthrough says "set 1": in the Modified Fibonacci deck the option "1" shares its text with "13" and "100", while "8" is the only option that contains an 8. The behaviour under test (a whole number is accepted after a half point was refused) is the same.

- [ ] **Step 3: Run the write-back tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php --filter='P12c-0[456]'`
Expected: PASS (4 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If a badge stays on "Sync pending" after `$this->workQueue()`, see the harness findings and the note on queued jobs in the plan header.

- [ ] **Step 4: Add the refresh tests of step 7**

Append these tests at the end of the file:

```php
it('[P12c-07a] takes a title changed in Jira when the tasks are refreshed', function () {
    [$game, $ada, , $bob] = p12cTable([IntegrationProvider::Jira]);
    p12cFakeJira([
        jiraTrackerIssue('10001', 'PROJ-1', ['summary' => 'Checkout page, second version']),
        jiraTrackerIssue('10002', 'PROJ-2', ['summary' => 'Payment retries']),
    ]);
    $renamed = p12cJiraTask($game, '10001', 'PROJ-1', 'Checkout page');
    p12cJiraTask($game, '10002', 'PROJ-2', 'Payment retries');

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $facilitator->assertScript(p12cTaskTitlesScript(), 'Checkout page / Payment retries')
        ->assertVisible('[aria-label="More task actions"]')
        ->click('[aria-label="More task actions"]')
        ->assertSee('Refresh from Jira')
        ->click('Refresh from Jira')
        ->assertSee('2 tasks refreshed.')
        ->assertScript(p12cTaskTitlesScript(), 'Checkout page, second version / Payment retries')
        ->assertDontSee('were not found in Jira');

    $member->assertScript(p12cTaskTitlesScript(), 'Checkout page, second version / Payment retries');

    Http::assertSent(fn (Request $request): bool => str_ends_with($request->url(), '/rest/api/3/search/jql')
        && str_starts_with((string) $request['jql'], 'id in (')
        && str_contains((string) $request['jql'], '10001')
        && str_contains((string) $request['jql'], '10002'));

    expect($renamed->refresh()->title)->toBe('Checkout page, second version');
});

it('[P12c-07b] says that a task was not found when its issue was deleted in Jira', function () {
    [$game, $ada] = p12cTable([IntegrationProvider::Jira]);
    p12cFakeJira([
        jiraTrackerIssue('10001', 'PROJ-1', ['summary' => 'Checkout page']),
    ]);
    p12cJiraTask($game, '10001', 'PROJ-1', 'Checkout page');
    $deleted = p12cJiraTask($game, '10002', 'PROJ-2', 'Payment retries');
    openPokerRound($game, $deleted);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertDontSee('Not found in Jira')
        ->assertVisible('[aria-label="More task actions"]')
        ->click('[aria-label="More task actions"]')
        ->assertSee('Refresh from Jira')
        ->click('Refresh from Jira')
        ->assertSee('1 tasks refreshed.')
        ->assertSee('1 tasks were not found in Jira.')
        ->assertSeeIn('section[aria-labelledby^="poker-task-"]', 'Not found in Jira')
        ->assertCount('@poker-task-row', 2)
        ->assertScript(p12cTaskTitlesScript(), 'Checkout page / Payment retries');

    expect($deleted->refresh()->external_missing_at)->not->toBeNull()
        ->and($deleted->title)->toBe('Payment retries');
});
```

- [ ] **Step 5: Run the refresh tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php --filter='P12c-07'`
Expected: PASS (2 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 6: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector`, then `vendor/bin/pint --dirty --format agent` again.

- [ ] **Step 7: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php`
Expected: PASS (13 tests).

- [ ] **Step 8: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php
git commit -m "test(browser): cover the estimate write-back, its failure and retry, and the refresh of imported tasks"
```

### Task 6: Plan 12d walkthrough: people and priority mapping, action item export

This task automates the seven steps of the plan 12d walkthrough (`docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md`, lines 6431 to 6437). Jira and Linear are faked in process; the connections, and where a step starts from one, the mappings, are arranged with factories.

Facts the tests rely on (all read from the current code):

- The integrations page (`resources/js/pages/teams/integrations.tsx`) renders one card per enabled provider. A card has no label of its own, so the tests address it through the shadcn slots it already carries: `[data-slot="card"]:has([data-slot="card-title"]:has-text("Jira"))`. Only Jira and Linear are enabled in these tests, so "Jira" matches one card.
- The People panel (`people-panel.tsx`) has no "Matching…" text. While the matching job runs, the "Match by email" button is disabled and shows a spinner, and the panel asks the server again every 5 seconds. Each row is an `<li>` with the member's name and email, the provider account's name and one badge: "Not mapped", "Matched by email", "Set manually", "Never assign" or "Account inactive". The row's menu button is `[aria-label="Change the Jira account of <name>"]`, with the items "Choose an account…", "Never assign" and, for a mapped member, "Reset".
- The account search dialog (`account-picker-dialog.tsx`) lists display names only; the fake returns an email address to prove that skrum does not show it.
- The Priorities panel (`priorities-panel.tsx`) has one select per level, `[aria-label="Priority for High"]`, `"Priority for Medium"`, `"Priority for Low"`, in each tracker's card.
- On a board, an action item's export control (`export-action-item-button.tsx`) is one button `[aria-label="Export to <Provider>"]` when a single tracker is left, and a menu behind `[aria-label="Export"]` when two are. It is rendered for the item's author, a facilitator or a workspace manager, never for a guest. The exported item shows a chip, a link to the issue with the key as text, inside `#action-item-<id>`; guests get no external link at all (`PresentActionItem`).
- The export itself is synchronous: no job is queued.
- The Laravel 13 request-forgery middleware accepts a same-origin request by its `Sec-Fetch-Site` header or by its token. The application's client sends the `XSRF-TOKEN` cookie back as the `X-XSRF-TOKEN` header; the forced request of step 5 does the same.
- A 401 from Linear on a connection without a refresh token raises `ReconnectRequired`, which answers 409 "Reconnect Linear in the team settings." and marks the connection "Reconnect required".

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php`
- Test: `tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn()`, `$this->joinAsGuest()`, `$this->awaitRealtime()`, and `$this->workQueue(): void` (plan 16b, Task 1).
  - `data-realtime` on the root of `retros/show` (plan 16a).
  - Helpers of `tests/Pest.php`: `disableIntegrations()`, `enableIntegrations()`, `integrationAdmin(Team $team): User`, `teamMember(Team $team): User`, `retroFacilitator(Retro $retro): array`, `retroMember(Retro $retro): array`, `jiraApiUrl(string $path): string`, `jiraAccount(string $accountId, string $displayName, ?string $email = null, bool $active = true, string $type = 'atlassian'): array`, `jiraCreateMeta(bool $assignee = true, bool $priority = true, ?array $priorities = null): array`, `fakeLinearGraphql(array $responses): void`.
  - Factories: `TeamIntegrationFactory::jira()`, `::linear()`, `IntegrationUserMappingFactory::manual()`, `ActionItemFactory::assignedTo()`, `::assignedToGuest()`, `::priority()`, `::withoutRetro()`, `ParticipantFactory::guest()`, `RetroFactory::inPhase()`, `::withGuestAccess()`.
- Produces:
  - No product change and no new hook.
  - File-level helpers in `tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php`: `p12dPerson(User $user, string $name, string $email): User`, `p12dConnect(Team $team, array $sources): array`, `p12dIntegrationsPath(Team $team): string`, `p12dCard(string $label): string`, `p12dFakeJira(array $routes = []): void`, `p12dFakeLinear(): void`, `p12dLinearTeamId(): string`, `p12dBoard(array $sources): array`.

- [ ] **Step 1: Create the file with its helpers and the tests of steps 1 and 2**

Create `tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Models\IntegrationUserMapping;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

function p12dPerson(User $user, string $name, string $email): User
{
    $user->forceFill(['name' => $name, 'email' => $email, 'locale' => 'en'])->save();

    return $user;
}

/**
 * @param  array<int, IntegrationProvider>  $sources
 * @return array<string, TeamIntegration>
 */
function p12dConnect(Team $team, array $sources): array
{
    disableIntegrations();
    enableIntegrations(...$sources);

    $integrations = [];

    foreach ($sources as $source) {
        $factory = TeamIntegration::factory();
        $connected = $source === IntegrationProvider::Linear ? $factory->linear() : $factory->jira();

        $integrations[$source->value] = $connected->create(['team_id' => $team->id]);
    }

    return $integrations;
}

function p12dIntegrationsPath(Team $team): string
{
    return route('teams.integrations.index', [$team->workspace, $team], false);
}

function p12dCard(string $label): string
{
    return "[data-slot=\"card\"]:has([data-slot=\"card-title\"]:has-text(\"{$label}\"))";
}

/**
 * @param  array<string, mixed>  $routes
 */
function p12dFakeJira(array $routes = []): void
{
    $priorities = [
        ['id' => '1', 'name' => 'Highest'],
        ['id' => '2', 'name' => 'High'],
        ['id' => '3', 'name' => 'Medium'],
        ['id' => '4', 'name' => 'Low'],
    ];

    Http::fake([
        ...$routes,
        jiraApiUrl('rest/api/3/priority/search*') => Http::response(['values' => $priorities]),
        jiraApiUrl('rest/api/3/project/search*') => Http::response(['values' => [
            ['id' => '10000', 'key' => 'PROJ', 'name' => 'Project'],
        ]]),
        jiraApiUrl('rest/api/3/issuetype/project*') => Http::response([
            ['id' => '10', 'name' => 'Bug', 'subtask' => false],
            ['id' => '11', 'name' => 'Task', 'subtask' => false],
        ]),
        jiraApiUrl('rest/api/3/issue/createmeta/*') => Http::response(jiraCreateMeta(priorities: $priorities)),
        jiraApiUrl('rest/api/3/issue') => Http::response([
            'id' => '10042',
            'key' => 'PROJ-42',
            'self' => 'https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/10042',
        ], 201),
        'api.atlassian.com/*' => Http::response(['errorMessages' => ['Unexpected request in a browser test.']], 404),
    ]);
}

it('[P12d-01] matches the members by email from the People panel and leaves a differing email unmapped', function () {
    config(['queue.default' => 'database']);
    $team = Team::factory()->create();
    $integrations = p12dConnect($team, [IntegrationProvider::Jira, IntegrationProvider::Linear]);
    $ada = p12dPerson(integrationAdmin($team), 'Ada Admin', 'ada@example.test');
    $bob = p12dPerson(teamMember($team), 'Bob Member', 'bob@example.test');
    p12dPerson(teamMember($team), 'Cleo Member', 'cleo@example.test');
    p12dFakeJira([
        jiraApiUrl('rest/api/3/user/search*') => fn (Request $request) => Http::response(
            $request['query'] === 'bob@example.test' ? [jiraAccount('acc-bob', 'Bob (Jira)')] : [],
        ),
    ]);
    $jira = p12dCard('Jira');
    $match = "{$jira} button:has-text(\"Match by email\")";

    $page = $this->signIn($ada, p12dIntegrationsPath($team));

    $page->assertSeeIn($jira, 'People')
        ->assertSeeIn($jira, "Jira: members' emails are looked up on your Jira site.")
        ->assertSeeIn(p12dCard('Linear'), 'Linear: emails are compared on this server.')
        ->assertCount("{$jira} li:has-text(\"Not mapped\")", 3)
        ->assertEnabled($match)
        ->click($match)
        ->assertDisabled($match);

    expect(DB::table('jobs')->count())->toBe(1);

    $this->workQueue();

    $page->assertSeeIn("{$jira} li:has-text(\"bob@example.test\")", 'Matched by email')
        ->assertSeeIn("{$jira} li:has-text(\"bob@example.test\")", 'Bob (Jira)')
        ->assertSeeIn("{$jira} li:has-text(\"cleo@example.test\")", 'Not mapped')
        ->assertSeeIn("{$jira} li:has-text(\"ada@example.test\")", 'Not mapped')
        ->assertEnabled($match);

    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), '/rest/api/3/user/search')
        && $request['query'] === 'bob@example.test');

    $mapping = IntegrationUserMapping::query()->where('team_integration_id', $integrations['jira']->id)->sole();

    expect($mapping->user_id)->toBe($bob->id)
        ->and($mapping->external_account_id)->toBe('acc-bob')
        ->and($mapping->matched_by)->toBe(IntegrationUserMatch::Email);
});

it('[P12d-02a] maps a member through the account search, sets another to never assign and resets a third', function () {
    $team = Team::factory()->create();
    $integrations = p12dConnect($team, [IntegrationProvider::Jira]);
    $ada = p12dPerson(integrationAdmin($team), 'Ada Admin', 'ada@example.test');
    $bob = p12dPerson(teamMember($team), 'Bob Member', 'bob@example.test');
    $cleo = p12dPerson(teamMember($team), 'Cleo Member', 'cleo@example.test');
    $dan = p12dPerson(teamMember($team), 'Dan Member', 'dan@example.test');
    IntegrationUserMapping::factory()->create([
        'team_integration_id' => $integrations['jira']->id,
        'user_id' => $dan->id,
        'external_account_id' => 'acc-dan',
        'external_display_name' => 'Dan (Jira)',
    ]);
    p12dFakeJira([
        jiraApiUrl('rest/api/3/user/search*') => Http::response([
            jiraAccount('acc-cleo', 'Cleo Stone', 'cleo.stone@corp.example'),
        ]),
        jiraApiUrl('rest/api/3/user?accountId=acc-cleo') => Http::response(
            jiraAccount('acc-cleo', 'Cleo Stone', 'cleo.stone@corp.example'),
        ),
    ]);
    $jira = p12dCard('Jira');

    $page = $this->signIn($ada, p12dIntegrationsPath($team));

    $page->assertSeeIn("{$jira} li:has-text(\"cleo@example.test\")", 'Not mapped')
        ->click('[aria-label="Change the Jira account of Cleo Member"]')
        ->assertSee('Choose an account…')
        ->click('Choose an account…')
        ->assertSee('Jira account of Cleo Member')
        ->assertSee('Search by name or email. Emails are not shown.')
        ->fill('[role="dialog"] [aria-label="Search"]', 'cleo')
        ->assertVisible('[role="dialog"] button:has-text("Cleo Stone")')
        ->assertDontSeeIn('[role="dialog"]', 'cleo.stone@corp.example')
        ->click('[role="dialog"] button:has-text("Cleo Stone")')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn("{$jira} li:has-text(\"cleo@example.test\")", 'Set manually')
        ->assertSeeIn("{$jira} li:has-text(\"cleo@example.test\")", 'Cleo Stone');

    $page->assertNotPresent('[role="menu"]')
        ->click('[aria-label="Change the Jira account of Bob Member"]')
        ->click('[role="menuitem"]:has-text("Never assign")')
        ->assertSeeIn("{$jira} li:has-text(\"bob@example.test\")", 'Never assign');

    $page->assertNotPresent('[role="menu"]')
        ->assertSeeIn("{$jira} li:has-text(\"dan@example.test\")", 'Matched by email')
        ->click('[aria-label="Change the Jira account of Dan Member"]')
        ->click('[role="menuitem"]:has-text("Reset")')
        ->assertSeeIn("{$jira} li:has-text(\"dan@example.test\")", 'Not mapped');

    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), '/rest/api/3/user/search')
        && $request['query'] === 'cleo');

    $mappings = IntegrationUserMapping::query()
        ->where('team_integration_id', $integrations['jira']->id)
        ->get()
        ->keyBy('user_id');

    expect($mappings)->toHaveCount(2)
        ->and($mappings[$cleo->id]->external_account_id)->toBe('acc-cleo')
        ->and($mappings[$cleo->id]->matched_by)->toBe(IntegrationUserMatch::Manual)
        ->and($mappings[$bob->id]->external_account_id)->toBeNull()
        ->and($mappings[$bob->id]->matched_by)->toBe(IntegrationUserMatch::Manual);
});

it('[P12d-02b] saves a Jira priority for High and no Linear priority for Low', function () {
    $team = Team::factory()->create();
    $integrations = p12dConnect($team, [IntegrationProvider::Jira, IntegrationProvider::Linear]);
    $ada = p12dPerson(integrationAdmin($team), 'Ada Admin', 'ada@example.test');
    p12dFakeJira();
    $jiraHigh = p12dCard('Jira').' [aria-label="Priority for High"]';
    $linearLow = p12dCard('Linear').' [aria-label="Priority for Low"]';

    $page = $this->signIn($ada, p12dIntegrationsPath($team));

    $page->assertSeeIn($jiraHigh, 'Default (High)')
        ->click($jiraHigh)
        ->click('[role="option"]:has-text("Highest")')
        ->assertSee('Priority mapping saved.')
        ->assertSeeIn($jiraHigh, 'Highest');

    expect($integrations['jira']->refresh()->setting('priorityMap'))
        ->toBe(['high' => ['id' => '1', 'name' => 'Highest']]);

    $page->assertSeeIn($linearLow, 'Default (Low)')
        ->click($linearLow)
        ->click('[role="option"]:has-text("No priority")')
        ->assertSeeIn($linearLow, 'No priority');

    expect($integrations['linear']->refresh()->setting('priorityMap'))->toBe(['low' => 0]);
});
```

`[P12d-01]` starts the matching with the "Match by email" button: a connection made through OAuth starts the same job by itself, and that round trip is a residual row.

- [ ] **Step 2: Run the tests of steps 1 and 2**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php --filter='P12d-0[12]'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. `[P12d-01]` takes up to five seconds after the job, because the panel asks for the result every five seconds.

- [ ] **Step 3: Add the board helpers and the tests of steps 3 and 4**

In `tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php`, add these imports in alphabetical order with the existing ones:

```php
use App\Enums\ActionItemPriority;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
```

Add these helpers directly after `p12dFakeJira()`:

```php
function p12dLinearTeamId(): string
{
    return '6a1f0c1e-4e8b-4a55-9b53-3c0b5f1f0a01';
}

function p12dFakeLinear(): void
{
    fakeLinearGraphql([
        'issueCreate' => ['issueCreate' => ['success' => true, 'issue' => [
            'id' => 'lin-issue-7',
            'identifier' => 'ENG-7',
            'url' => 'https://linear.app/acme/issue/ENG-7/write-the-runbook',
        ]]],
        'teams(first' => ['teams' => ['nodes' => [
            ['id' => p12dLinearTeamId(), 'key' => 'ENG', 'name' => 'Engineering'],
        ]]],
        'users(first' => ['users' => ['nodes' => [], 'pageInfo' => ['hasNextPage' => false]]],
    ]);
}

/**
 * @param  array<int, IntegrationProvider>  $sources
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: User,
 *     3: Participant,
 *     4: array<string, TeamIntegration>
 * }
 */
function p12dBoard(array $sources): array
{
    $retro = Retro::factory()
        ->inPhase(RetroPhase::Discussing)
        ->withGuestAccess()
        ->create(['title' => 'Sprint 12']);

    Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Start', 'position' => 0]);

    $integrations = p12dConnect($retro->team, $sources);

    [$alice] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    p12dPerson($alice, 'Alice Martin', 'alice@example.test');
    p12dPerson($bob, 'Bob Stone', 'bob@example.test');

    return [$retro->fresh(), $alice, $bob, $bobParticipant, $integrations];
}
```

Append these tests at the end of the file:

```php
it('[P12d-03] exports a board item to Jira with the mapped assignee and priority and shows the key to members only', function () {
    [$retro, $alice, $bob, $bobParticipant, $integrations] = p12dBoard([IntegrationProvider::Jira, IntegrationProvider::Linear]);
    $integrations['jira']->mergeSettings(['priorityMap' => ['high' => ['id' => '1', 'name' => 'Highest']]]);
    $cleo = p12dPerson(teamMember($retro->team), 'Cleo Member', 'cleo@example.test');
    IntegrationUserMapping::factory()->manual()->create([
        'team_integration_id' => $integrations['jira']->id,
        'user_id' => $cleo->id,
        'external_account_id' => 'acc-cleo',
        'external_display_name' => 'Cleo Stone',
    ]);
    $item = ActionItem::factory()->assignedTo($cleo)->priority(ActionItemPriority::High)->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $bobParticipant->id,
        'content' => 'Speed up CI',
        'due_on' => '2026-10-20',
    ]);
    p12dFakeJira();
    p12dFakeLinear();
    $export = "#action-item-{$item->id} [aria-label=\"Export\"]";
    $chip = "#action-item-{$item->id} a[href=\"https://acme.atlassian.net/browse/PROJ-42\"]";

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $guestPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $guestPage->assertSee('Speed up CI')
        ->assertNotPresent($export);

    $bobPage->assertVisible($export)
        ->click($export)
        ->assertSee('Export to Linear')
        ->click('Export to Jira')
        ->assertSeeIn('[role="dialog"] [aria-label="Project"]', 'PROJ — Project')
        ->assertSeeIn('[role="dialog"] [aria-label="Issue type"]', 'Task')
        ->assertSee('Assignee: Cleo Stone (Jira)')
        ->assertSee('Priority: Highest')
        ->assertEnabled('[role="dialog"] button:has-text("Export")')
        ->click('[role="dialog"] button:has-text("Export")')
        ->assertSee('Exported as PROJ-42.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($chip, 'PROJ-42');

    $alicePage->assertSeeIn($chip, 'PROJ-42');

    $guestPage->assertSee('Speed up CI')
        ->assertNotPresent($chip)
        ->assertDontSee('PROJ-42');

    Http::assertSent(function (Request $request) use ($item): bool {
        if ($request->method() !== 'POST' || ! str_ends_with($request->url(), '/rest/api/3/issue')) {
            return false;
        }

        $fields = $request->data()['fields'];

        return $fields['summary'] === 'Speed up CI'
            && $fields['project'] === ['id' => '10000']
            && $fields['issuetype'] === ['id' => '11']
            && $fields['assignee'] === ['accountId' => 'acc-cleo']
            && $fields['priority'] === ['id' => '1']
            && $fields['duedate'] === '2026-10-20'
            && str_contains((string) json_encode($fields['description']), 'From the retrospective \"Sprint 12\"')
            && str_contains((string) json_encode($fields['description']), "action-items?item={$item->id}");
    });

    $link = ActionItemExternalLink::query()->sole();

    expect($link->action_item_id)->toBe($item->id)
        ->and($link->external_key)->toBe('PROJ-42')
        ->and($link->created_by_user_id)->toBe($bob->id);
});

it('[P12d-04] exports a guest-assigned item to Linear unassigned and warns about it', function () {
    [$retro, , $bob, $bobParticipant, $integrations] = p12dBoard([IntegrationProvider::Linear]);
    $integrations['linear']->mergeSettings(['priorityMap' => ['low' => 0]]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Carol Guest']);
    $item = ActionItem::factory()->assignedToGuest($guest)->priority(ActionItemPriority::Low)->create([
        'created_by_participant_id' => $bobParticipant->id,
        'content' => 'Write the runbook',
    ]);
    p12dFakeLinear();
    $export = "#action-item-{$item->id} [aria-label=\"Export to Linear\"]";
    $chip = "#action-item-{$item->id} a[href=\"https://linear.app/acme/issue/ENG-7/write-the-runbook\"]";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertVisible($export)
        ->click($export)
        ->assertSeeIn('[role="dialog"] [aria-label="Linear team"]', 'ENG — Engineering')
        ->assertSee('Unassigned (guest)')
        ->assertSee('Priority: No priority')
        ->assertEnabled('[role="dialog"] button:has-text("Export")')
        ->click('[role="dialog"] button:has-text("Export")')
        ->assertSee('Exported as ENG-7.')
        ->assertSee('Guests have no Linear account, so the issue is unassigned.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($chip, 'ENG-7')
        ->assertNotPresent($export);

    Http::assertSent(function (Request $request): bool {
        if (! str_contains((string) $request['query'], 'issueCreate')) {
            return false;
        }

        $input = (array) data_get($request->data(), 'variables.input');

        return $input['teamId'] === p12dLinearTeamId()
            && $input['title'] === 'Write the runbook'
            && $input['priority'] === 0
            && ! array_key_exists('assigneeId', $input);
    });

    expect(ActionItemExternalLink::query()->sole()->external_key)->toBe('ENG-7')
        ->and($integrations['linear']->refresh()->setting('exportTeamId'))->toBe(p12dLinearTeamId());
});
```

- [ ] **Step 4: Run the tests of steps 3 and 4**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php --filter='P12d-0[34]'`
Expected: PASS (2 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Add the tests of steps 5 to 7**

In `tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php`, add this import in alphabetical order with the existing ones:

```php
use App\Enums\IntegrationStatus;
```

Append these tests at the end of the file:

```php
it('[P12d-05] creates one issue when the same export is sent twice and takes Jira out of the export menu', function () {
    [$retro, , $bob, $bobParticipant] = p12dBoard([IntegrationProvider::Jira, IntegrationProvider::Linear]);
    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $bobParticipant->id,
        'content' => 'Speed up CI',
    ]);
    p12dFakeJira();
    p12dFakeLinear();
    $exportUrl = route('retros.action-items.exports.store', [$retro, $item], false);
    $chip = "#action-item-{$item->id} a[href=\"https://acme.atlassian.net/browse/PROJ-42\"]";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertVisible("#action-item-{$item->id} [aria-label=\"Export\"]");

    $answers = $page->script(<<<JS
        async () => {
            const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='));
            const token = decodeURIComponent(cookie.slice('XSRF-TOKEN='.length));
            const send = async () => {
                const response = await fetch('{$exportUrl}', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': token,
                    },
                    body: JSON.stringify({ source: 'jira', project_id: '10000', issue_type_id: '11' }),
                });
                const payload = await response.json();

                return response.status + ':' + (payload.message ?? '');
            };
            const first = await send();
            const second = await send();

            return first + ' / ' + second;
        }
        JS);

    expect($answers)->toBe('201: / 409:Already exported as PROJ-42.');

    $page->assertSeeIn($chip, 'PROJ-42')
        ->assertNotPresent("#action-item-{$item->id} [aria-label=\"Export\"]")
        ->assertVisible("#action-item-{$item->id} [aria-label=\"Export to Linear\"]");

    expect(Http::recorded(fn (Request $request): bool => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/issue')))->toHaveCount(1)
        ->and(ActionItemExternalLink::query()->where('action_item_id', $item->id)->count())->toBe(1);
});

it('[P12d-06] exports an item added outside a retro from the global action items page', function () {
    $team = Team::factory()->create();
    p12dConnect($team, [IntegrationProvider::Jira]);
    $bob = p12dPerson(teamMember($team), 'Bob Stone', 'bob@example.test');
    $item = ActionItem::factory()->withoutRetro($team, $bob)->create(['content' => 'Book the room']);
    p12dFakeJira();
    $export = "#action-item-{$item->id} [aria-label=\"Export to Jira\"]";
    $chip = "#action-item-{$item->id} a[href=\"https://acme.atlassian.net/browse/PROJ-42\"]";

    $page = $this->signIn($bob, route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'item' => $item->id], false));

    $page->assertSee('Book the room')
        ->assertVisible($export)
        ->click($export)
        ->assertSeeIn('[role="dialog"] [aria-label="Issue type"]', 'Task')
        ->assertSee('Unassigned')
        ->assertSee('Priority: Medium')
        ->assertEnabled('[role="dialog"] button:has-text("Export")')
        ->click('[role="dialog"] button:has-text("Export")')
        ->assertSee('Exported as PROJ-42.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($chip, 'PROJ-42')
        ->assertNotPresent($export);

    Http::assertSent(function (Request $request): bool {
        if ($request->method() !== 'POST' || ! str_ends_with($request->url(), '/rest/api/3/issue')) {
            return false;
        }

        $fields = $request->data()['fields'];

        return $fields['summary'] === 'Book the room'
            && $fields['priority'] === ['id' => '3']
            && ! array_key_exists('assignee', $fields)
            && str_contains((string) json_encode($fields['description']), 'Added outside a retro on');
    });

    expect(ActionItemExternalLink::query()->sole()->action_item_id)->toBe($item->id);
});

it('[P12d-07] asks to reconnect Linear once its access is revoked and shows it on the integrations page', function () {
    [$retro, , $bob, $bobParticipant, $integrations] = p12dBoard([IntegrationProvider::Linear]);
    $ada = p12dPerson(integrationAdmin($retro->team), 'Ada Admin', 'ada@example.test');
    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $bobParticipant->id,
        'content' => 'Write the runbook',
    ]);
    $revoked = false;
    Http::fake(['api.linear.app/graphql' => function () use (&$revoked) {
        if ($revoked) {
            return Http::response(['errors' => [[
                'message' => 'Authentication required, not authenticated',
                'extensions' => ['code' => 'AUTHENTICATION_ERROR'],
            ]]], 401);
        }

        return Http::response(['data' => ['teams' => ['nodes' => [
            ['id' => p12dLinearTeamId(), 'key' => 'ENG', 'name' => 'Engineering'],
        ]]]]);
    }]);
    $export = "#action-item-{$item->id} [aria-label=\"Export to Linear\"]";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertVisible($export)
        ->click($export)
        ->assertSeeIn('[role="dialog"] [aria-label="Linear team"]', 'ENG — Engineering')
        ->assertEnabled('[role="dialog"] button:has-text("Export")');

    $revoked = true;

    $page->click('[role="dialog"] button:has-text("Export")')
        ->assertSee('Reconnect Linear in the team settings.')
        ->assertDontSee('Exported as');

    expect($integrations['linear']->refresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and(ActionItemExternalLink::query()->count())->toBe(0);

    $linear = p12dCard('Linear');
    $admin = $this->signIn($ada, p12dIntegrationsPath($retro->team));

    $admin->assertSeeIn($linear, 'Reconnect required')
        ->assertSeeIn($linear, 'Reconnect')
        ->assertNotPresent("{$linear} button:has-text(\"Match by email\")");
});
```

`[P12d-05]` replaces "forcing the request (browser devtools)" with the same `POST` sent twice from the page by `fetch()`, with the token header the application's own client sends. `[P12d-07]` replaces "Revoke the skrum app in Linear" with the answer Linear gives after a revocation, a 401 with the code `AUTHENTICATION_ERROR`, from the moment the test sets `$revoked`.

- [ ] **Step 6: Run the tests of steps 5 to 7**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php --filter='P12d-0[567]'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If `[P12d-05]` returns another string than expected, see the harness findings ("Server and requests": JSON request bodies are passed to the application as they are).

- [ ] **Step 7: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls and re-indent the script's heredoc; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector`, then `vendor/bin/pint --dirty --format agent` again.

- [ ] **Step 8: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php`
Expected: PASS (8 tests).

- [ ] **Step 9: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php
git commit -m "test(browser): cover the people and priority mapping and the action item export walkthrough"
```

### Task 7: Outgoing webhooks walkthrough (plan 14b)

This task automates the six bullets of the plan 14b walkthrough (`docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md`, lines 4840 to 4845). The walkthrough asked for a public request inspector. The tests replace it with `Http::fake()` and read what skrum sent with `Http::recorded()` (spec §3.6, "A third-party call"); every row of this task that sends a request is therefore `auto-substituted`.

How a webhook URL is made acceptable in a browser test, and why this is the smallest arrangement:

- `SafeWebhookUrl::resolve()` (`app/Support/Integrations/Webhook/SafeWebhookUrl.php`) accepts only `https`, resolves the host through `App\Support\Integrations\HostResolver` and refuses every address that is not public. The test environment sets `OUTGOING_WEBHOOKS_ENABLED=false`, `OUTGOING_WEBHOOKS_ALLOW_PRIVATE_NETWORKS=false` and `OUTGOING_WEBHOOKS_ALLOW_HTTP=false` (`phpunit.xml`).
- The tests call three existing helpers of `tests/Pest.php`: `disableIntegrations()`, `enableIntegrations(IntegrationProvider::Webhook)` and `outgoingWebhookResolves()`. The last one binds a `HostResolver` that answers `93.184.216.34` (a public address) for every host with `app()->instance(...)`. The browser's requests are served by the test's own application instance, and `SafeWebhookUrl` is resolved from the container on every use, so the binding applies to browser requests. The per-request reset of `Tests\BrowserTestCase` forgets scoped instances only, so the binding stays for the whole test.
- The endpoint is `https://hooks.example.com/skrum/incoming` (`TeamIntegrationFactory::WebhookUrl`), faked with `Http::fake(['hooks.example.com/*' => …])`. No real DNS query and no real request is made.
- `allow_private_networks` and `allow_http` stay `false`. The real refusal of a private address therefore still runs, and `[P14b-01]` proves it with `https://127.0.0.1/skrum` (an IP literal is checked as it is, without the resolver).

Facts about the interface that the selectors rely on (all read from the current code):

- With only the webhook provider enabled, the integrations page (`resources/js/pages/teams/integrations.tsx`) shows one card, so `Connect`, `Replace URL`, `Send a test message`, `Rotate secret` and `Re-enable` are unique texts.
- The connect dialog's inputs get their ids from React's `useId()` (`webhook-integration.tsx`), so they are addressed by type: `[role="dialog"] input[type="url"]` and `[role="dialog"] input[maxlength="80"]`. Its submit button has `type="submit"`.
- The secret dialog shows the secret in `input[aria-label="Signing secret"]` (`webhook-secret.tsx`). The secret leaves the server only in the connect and rotate responses.
- The event checkboxes have ids that contain dots (`webhook-event-action_item.completed`, `webhook-events-panel.tsx`), so they are addressed as `[id="webhook-event-action_item.completed"]`, never with `#`.
- The delivery log is `table[aria-label="Deliveries"]` (`webhook-deliveries-panel.tsx`). It is loaded when "Show deliveries" is clicked and is not live: the tests click "Hide deliveries" then "Show deliveries" to load it again. Its columns are Time, Event, Status, Attempts, Response, Error, Actions.
- The "Send a test message" request is not written to the delivery log (`IntegrationTestsController::store()` calls `WebhookClient::send()` without a delivery).
- An action item appears in the board's panel, and its checkbox changes its label, only after the server has answered (`action-items-panel.tsx`, `action-item-card.tsx`). The webhook listeners run inside that request, so once the page shows the change, the delivery row and its queued job exist.
- Deliveries are queued jobs. The tests set `config(['queue.default' => 'database'])` before the action and run one job with `$this->workQueue()`. A share is tried 4 times with waits of 10, 60 and 300 seconds (`DeliverToChannel`); an automatic event is tried 7 times with waits of 30, 120, 600, 1800, 3600 and 7200 seconds (`DeliverWebhookEvent`). The waits of an event add up to 3 hours 42 minutes, which is longer than the session lifetime, so `[P14b-04a]` signs in again after travelling.
- A delivery that still fails after its last try on a 5xx answer stores the error "Webhook did not respond. Try again later." (`ProviderUnavailable::userMessage()`), not "The receiver answered 500.".

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php`
- Test: `tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php`

No product file changes: every target is reachable by id, aria-label, role or English text.

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn(User $user, string $to): mixed`, `$this->awaitRealtime(mixed $page): mixed` (plan 16a) and `$this->workQueue(): void` (plan 16b Task 1: runs one queued job with `queue:work --once` outside any request).
  - Existing helpers in `tests/Pest.php`: `disableIntegrations(): void`, `enableIntegrations(IntegrationProvider ...$providers): void`, `outgoingWebhookResolves(array $addresses = ['93.184.216.34']): void`, `outgoingWebhookSignatureIsValid(Request $request, string $secret = TeamIntegrationFactory::WebhookSecret): bool`, `integrationAdmin(Team $team): User`, `retroMember(Retro $retro): array{0: User, 1: Participant}`, `webhookTopCard(Retro $retro, Participant $author, Participant $voter): void`, `pokerVote(PokerRound $round, PokerPlayer $player, string $value): PokerVote`.
  - Factories: `TeamIntegrationFactory::webhook(array $events = [])` with the constants `WebhookUrl` and `WebhookSecret`, `RetroFactory::inPhase()`, `ActionItemFactory::assignedTo()`, `PokerRoundFactory::revealed()`.
  - `data-realtime` on the roots of `retros/show`, `poker/show` and `games/show` (plan 16a).
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php` (global functions; later files must not redeclare them): `p14bTeam(): array{0: Team, 1: User}`, `p14bWebhook(Team $team, array $events = []): TeamIntegration`, `p14bIntegrationsPath(Team $team): string`, `p14bRetro(Team $team, User $admin, RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array{0: Retro, 1: Participant}`, `p14bReceiverAnswers(int $status = 204): void`, `p14bSentRequests(): Collection`, `p14bSentEvent(string $event): Request`, `p14bBody(Request $request): array`, `p14bDeliveryCells(string $event): string`.
  - Stable selectors that need no hook: delivery log `table[aria-label="Deliveries"]`; secret `input[aria-label="Signing secret"]`; event checkbox `[id="webhook-event-<event name>"]`.

- [ ] **Step 1: Create the test file with its helpers and the tests of the integrations page (connect, rotate, subscribe)**

`php artisan make:test` only writes under `tests/Feature` or `tests/Unit`, so create `tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php` directly with this content:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Enums\WebhookEvent;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * @return array{
 *     0: Team,
 *     1: User
 * }
 */
function p14bTeam(): array
{
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Webhook);
    outgoingWebhookResolves();

    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = integrationAdmin($team);

    $admin->forceFill(['name' => 'Ada Admin', 'locale' => 'en'])->save();

    return [$team, $admin];
}

/**
 * @param  array<int, string>  $events
 */
function p14bWebhook(Team $team, array $events = []): TeamIntegration
{
    return TeamIntegration::factory()->webhook($events)->create(['team_id' => $team->id]);
}

function p14bIntegrationsPath(Team $team): string
{
    return route('teams.integrations.index', [$team->workspace, $team], false);
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: Participant
 * }
 */
function p14bRetro(Team $team, User $admin, RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->create(['team_id' => $team->id, 'title' => 'Sprint 42', ...$attributes]);

    $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $admin->id]);

    $retro->forceFill(['facilitator_participant_id' => $participant->id])->save();

    Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Ideas', 'position' => 0]);

    return [$retro->fresh(), $participant];
}

function p14bReceiverAnswers(int $status = 204): void
{
    Http::fake(['hooks.example.com/*' => Http::response('', $status)]);
}

/**
 * @return Collection<int, Request>
 */
function p14bSentRequests(): Collection
{
    return collect(Http::recorded())->map(fn (array $pair): Request => $pair[0])->values();
}

function p14bSentEvent(string $event): Request
{
    return p14bSentRequests()->sole(fn (Request $request): bool => $request->header('X-Skrum-Event')[0] === $event);
}

/**
 * @return array<string, mixed>
 */
function p14bBody(Request $request): array
{
    return json_decode($request->body(), true, flags: JSON_THROW_ON_ERROR);
}

function p14bDeliveryCells(string $event): string
{
    return "Array.from(document.querySelectorAll('table[aria-label=\"Deliveries\"] tbody tr')).filter((row) => row.children[1].textContent.startsWith('{$event}')).map((row) => [2, 3, 4, 5].map((index) => row.children[index].textContent).join(' | ')).join(' / ')";
}

it('[P14b-01] connects a webhook, shows the secret once and signs the test message with it', function () {
    [$team, $admin] = p14bTeam();
    p14bReceiverAnswers();

    $page = $this->signIn($admin, p14bIntegrationsPath($team));

    $page->assertSee('Not connected')
        ->click('Connect')
        ->assertSee('Connect Webhook')
        ->fill('[role="dialog"] input[type="url"]', 'https://127.0.0.1/skrum')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertSee('This URL points to a private or invalid address.')
        ->fill('[role="dialog"] input[type="url"]', TeamIntegrationFactory::WebhookUrl)
        ->fill('[role="dialog"] input[maxlength="80"]', 'Ops receiver')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertVisible('input[aria-label="Signing secret"]')
        ->assertSee("Copy this secret now. You won't be able to see it again.")
        ->assertSeeIn('[role="dialog"] pre', 'HMAC-SHA256');

    $secret = $page->value('input[aria-label="Signing secret"]');
    $integration = TeamIntegration::query()->sole();

    expect($secret)->toMatch('/^[0-9a-f]{64}$/')
        ->and($integration->credential('webhookSecret'))->toBe($secret)
        ->and($integration->credential('url'))->toBe(TeamIntegrationFactory::WebhookUrl)
        ->and((string) DB::table('team_integrations')->value('credentials'))->not->toContain($secret);

    $page->click("I've saved the secret")
        ->assertNotPresent('[role="dialog"]')
        ->assertDontSee('Not connected')
        ->assertSee('hooks.example.com')
        ->assertSee('Ops receiver')
        ->assertDontSee('/skrum/incoming')
        ->assertScript("document.documentElement.innerHTML.includes('{$secret}')", false)
        ->click('Send a test message')
        ->assertSee('Test message sent.');

    $request = p14bSentEvent('webhook.test');
    $body = p14bBody($request);

    expect($request->url())->toBe(TeamIntegrationFactory::WebhookUrl)
        ->and(outgoingWebhookSignatureIsValid($request, $secret))->toBeTrue()
        ->and(abs(now()->getTimestamp() - (int) $request->header('X-Skrum-Timestamp')[0]))->toBeLessThanOrEqual(300)
        ->and($request->header('User-Agent')[0])->toBe('skrum-webhooks/1')
        ->and($body['id'])->toBe($request->header('X-Skrum-Delivery')[0])
        ->and($body['team'])->toBe(['id' => $team->id, 'name' => 'Platform'])
        ->and($body['data'])->toBe(['message' => 'skrum is connected.']);

    $page->navigate(p14bIntegrationsPath($team))
        ->assertSee('hooks.example.com')
        ->assertNotPresent('input[aria-label="Signing secret"]')
        ->assertScript("document.documentElement.innerHTML.includes('{$secret}')", false);
});

it('[P14b-06] rotates the secret so that the old one no longer verifies a request', function () {
    [$team, $admin] = p14bTeam();
    $integration = p14bWebhook($team);
    p14bReceiverAnswers();

    $page = $this->signIn($admin, p14bIntegrationsPath($team));

    $page->assertSee('Rotate secret')
        ->click('Rotate secret')
        ->assertSee('Rotate the signing secret?')
        ->assertSee('The current secret stops working immediately. Update your endpoint with the new one.')
        ->click('[role="dialog"] button:has-text("Rotate secret")')
        ->assertVisible('input[aria-label="Signing secret"]');

    $newSecret = $page->value('input[aria-label="Signing secret"]');

    expect($newSecret)->toMatch('/^[0-9a-f]{64}$/')
        ->and($newSecret)->not->toBe(TeamIntegrationFactory::WebhookSecret)
        ->and($integration->fresh()->credential('webhookSecret'))->toBe($newSecret);

    $page->click("I've saved the secret")
        ->assertNotPresent('[role="dialog"]')
        ->click('Send a test message')
        ->assertSee('Test message sent.');

    $request = p14bSentEvent('webhook.test');

    expect(outgoingWebhookSignatureIsValid($request, $newSecret))->toBeTrue()
        ->and(outgoingWebhookSignatureIsValid($request, TeamIntegrationFactory::WebhookSecret))->toBeFalse();
});

it('[P14b-03a] subscribes the webhook to the five automatic events', function () {
    [$team, $admin] = p14bTeam();
    $integration = p14bWebhook($team);

    $page = $this->signIn($admin, p14bIntegrationsPath($team));

    $page->assertSee('Send automatically')
        ->assertCount('[id^="webhook-event-"]', 5)
        ->assertButtonDisabled('Save events');

    foreach (WebhookEvent::values() as $event) {
        $page->click("[id=\"webhook-event-{$event}\"]")
            ->assertAriaAttribute("[id=\"webhook-event-{$event}\"]", 'checked', 'true');
    }

    $page->assertButtonEnabled('Save events')
        ->click('Save events')
        ->assertSee('Events saved.');

    expect($integration->fresh()->setting('events'))->toBe(WebhookEvent::values());

    $page->navigate(p14bIntegrationsPath($team))
        ->assertSee('Send automatically')
        ->assertButtonDisabled('Save events');

    foreach (WebhookEvent::values() as $event) {
        $page->assertAriaAttribute("[id=\"webhook-event-{$event}\"]", 'checked', 'true');
    }
});
```

`[P14b-01]` first submits a loopback address. This is not a walkthrough bullet; it is there to prove that the test reaches the real `SafeWebhookUrl` check and that the faked resolver did not turn the check off.

- [ ] **Step 2: Run the tests of the integrations page**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php --filter='P14b-01|P14b-06|P14b-03a'`
Expected: PASS (3 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If the valid URL is refused with "This URL points to a private or invalid address.", the `HostResolver` binding did not reach the browser's request: see the harness findings.

- [ ] **Step 3: Append the tests of the three shares (bullet 2)**

Add these imports to the `use` block of `tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php`, keeping the block in alphabetical order:

```php
use App\Models\ActionItem;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\IntegrationDelivery;
```

Append to the file:

```php
it('[P14b-02a] sends a board link to the webhook from the board', function () {
    [$team, $admin] = p14bTeam();
    p14bWebhook($team);
    [$retro] = p14bRetro($team, $admin);
    p14bReceiverAnswers();
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertSee('Share')
        ->click('Share')
        ->assertSee('Share the board')
        ->click('Send link to webhook')
        ->assertSee('The message is on its way.')
        ->assertSee('Sending to Webhook…');

    Http::assertNothingSent();

    $this->workQueue();

    $request = p14bSentEvent('retro.link');
    $data = p14bBody($request)['data'];

    expect(outgoingWebhookSignatureIsValid($request))->toBeTrue()
        ->and(array_keys($data))->toBe(['title', 'url', 'sharedBy'])
        ->and($data['title'])->toBe('Sprint 42')
        ->and($data['url'])->toEndWith("/retros/{$retro->id}")
        ->and($data['sharedBy'])->toBe('Ada Admin')
        ->and($request->header('X-Skrum-Delivery')[0])->toBe(IntegrationDelivery::query()->sole()->id);

    $page->assertSee('Sent to Webhook');
});

it('[P14b-02b] sends a game room invite to the webhook without players or game state', function () {
    [$team, $admin] = p14bTeam();
    p14bWebhook($team);
    $room = GameRoom::factory()->create(['team_id' => $team->id, 'name' => 'Friday fun']);
    $host = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $admin->id]);
    $room->forceFill(['host_player_id' => $host->id])->save();
    p14bReceiverAnswers();
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/games/{$room->id}"));

    $page->assertSee('Invite')
        ->click('Invite')
        ->assertSee('Invite to the room')
        ->assertSee('Only members of Platform can join.')
        ->click('Send link to webhook')
        ->assertSee('The message is on its way.');

    $this->workQueue();

    $request = p14bSentEvent('game_room.link');
    $data = p14bBody($request)['data'];

    expect(outgoingWebhookSignatureIsValid($request))->toBeTrue()
        ->and(array_keys($data))->toBe(['title', 'game', 'team', 'url', 'sharedBy'])
        ->and($data['title'])->toBe('Friday fun')
        ->and($data['game'])->toBe('Hangman')
        ->and($data['team'])->toBe('Platform')
        ->and($data['url'])->toEndWith("/games/{$room->id}")
        ->and($data['sharedBy'])->toBe('Ada Admin');
});

it('[P14b-02c] sends the recap of an anonymous retro with a participant count and no card author', function () {
    [$team, $admin] = p14bTeam();
    p14bWebhook($team);
    [$retro, $participant] = p14bRetro($team, $admin, RetroPhase::Completed, [
        'is_anonymous' => true,
        'completed_at' => now(),
    ]);
    [$carla, $carlaParticipant] = retroMember($retro);
    $carla->forceFill(['name' => 'Carla Author', 'locale' => 'en'])->save();
    webhookTopCard($retro, $carlaParticipant, $participant);
    ActionItem::factory()->assignedTo($admin)->create([
        'retro_id' => $retro->id,
        'content' => 'Fix the deploy',
        'created_by_participant_id' => $participant->id,
    ]);
    p14bReceiverAnswers();
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertSee('Share')
        ->click('Share')
        ->assertSee('Send to webhook')
        ->click('Send to webhook')
        ->assertSee('Send the results to the webhook')
        ->assertSee('Participants are shown as a count. Action items are shown with names.')
        ->assertSee('Card authors, votes and comments are never shared.')
        ->click('[role="dialog"] button:has-text("Send")')
        ->assertSee('The message is on its way.');

    $this->workQueue();

    $request = p14bSentEvent('retro.results');
    $data = p14bBody($request)['data'];

    expect(outgoingWebhookSignatureIsValid($request))->toBeTrue()
        ->and($data['title'])->toBe('Sprint 42')
        ->and($data['participants'])->toBe(['count' => 2, 'names' => null])
        ->and($data['actionItems'][0]['content'])->toBe('Fix the deploy')
        ->and($data['actionItems'][0]['assignee'])->toBe('Ada Admin')
        ->and(collect($data['topCards'])->pluck('content')->all())->toContain('Faster reviews')
        ->and($request->body())->not->toContain('Carla Author')
        ->and($request->body())->not->toContain($carla->email)
        ->and($request->body())->not->toContain($admin->email);
});
```

- [ ] **Step 4: Run the share tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php --filter='P14b-02'`
Expected: PASS (3 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If `Http::assertNothingSent()` fails in `[P14b-02a]`, the queue connection was not `database` when the share was queued; if "Sent to Webhook" never appears on the board after `workQueue()`, see the harness findings on jobs that broadcast.

- [ ] **Step 5: Append the tests of the five automatic events and the delivery log (bullet 3)**

Add these imports to the `use` block, keeping it in alphabetical order:

```php
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
```

Append to the file:

```php
it('[P14b-03b] sends created, completed and reopened for an action item and logs the three deliveries', function () {
    [$team, $admin] = p14bTeam();
    p14bWebhook($team, WebhookEvent::values());
    [$retro] = p14bRetro($team, $admin);
    $input = '[aria-label="Add an action item…"]';
    p14bReceiverAnswers();
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertVisible($input)
        ->fill($input, 'Fix the deploy')
        ->keys($input, 'Enter')
        ->assertSeeIn('aside:not([aria-label])', 'Fix the deploy');

    $item = ActionItem::query()->sole();

    $page->click("#action-item-{$item->id} [aria-label=\"Mark as done\"]")
        ->assertPresent("#action-item-{$item->id} [aria-label=\"Reopen\"]")
        ->click("#action-item-{$item->id} [aria-label=\"Reopen\"]")
        ->assertPresent("#action-item-{$item->id} [aria-label=\"Mark as done\"]");

    expect(IntegrationDelivery::query()->count())->toBe(3);
    Http::assertNothingSent();

    $this->workQueue();
    $this->workQueue();
    $this->workQueue();

    $created = p14bSentEvent('action_item.created');
    $completed = p14bSentEvent('action_item.completed');
    $reopened = p14bSentEvent('action_item.reopened');

    expect(p14bSentRequests()->every(fn (Request $request): bool => outgoingWebhookSignatureIsValid($request)))->toBeTrue()
        ->and(p14bSentRequests()->every(fn (Request $request): bool => ! str_contains($request->body(), $admin->email)))->toBeTrue()
        ->and(p14bBody($created)['data']['actionItem']['content'])->toBe('Fix the deploy')
        ->and(p14bBody($created)['data']['actionItem']['status'])->toBe('open')
        ->and(p14bBody($created)['data']['actionItem']['createdBy'])->toBe(['name' => 'Ada Admin'])
        ->and(p14bBody($completed)['data']['actionItem']['status'])->toBe('completed')
        ->and(p14bBody($completed)['data']['actionItem']['completedBy'])->toBe(['name' => 'Ada Admin'])
        ->and(p14bBody($completed)['data']['origin'])->toBe('skrum')
        ->and(p14bBody($reopened)['data']['actionItem']['status'])->toBe('open')
        ->and(p14bBody($reopened)['data']['actionItem']['completedBy'])->toBeNull();

    $page->navigate(p14bIntegrationsPath($team))
        ->assertSee('Show deliveries')
        ->click('Show deliveries')
        ->assertCount('table[aria-label="Deliveries"] tbody tr', 3)
        ->assertScript(p14bDeliveryCells('action_item.created'), 'Sent | 1 | 204 | —')
        ->assertScript(p14bDeliveryCells('action_item.completed'), 'Sent | 1 | 204 | —')
        ->assertScript(p14bDeliveryCells('action_item.reopened'), 'Sent | 1 | 204 | —');
});

it('[P14b-03c] sends retro.completed with the recap and hides who took part in an anonymous retro', function () {
    [$team, $admin] = p14bTeam();
    p14bWebhook($team, WebhookEvent::values());
    [$retro, $participant] = p14bRetro($team, $admin, RetroPhase::Discussing, ['is_anonymous' => true]);
    [$carla, $carlaParticipant] = retroMember($retro);
    $carla->forceFill(['name' => 'Carla Author', 'locale' => 'en'])->save();
    webhookTopCard($retro, $carlaParticipant, $participant);
    p14bReceiverAnswers();
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertSeeIn('[aria-current="step"]', 'Discussing')
        ->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed');

    $this->workQueue();

    $request = p14bSentEvent('retro.completed');
    $data = p14bBody($request)['data'];

    expect(outgoingWebhookSignatureIsValid($request))->toBeTrue()
        ->and($data['retro'])->toBe(['id' => $retro->id])
        ->and($data['title'])->toBe('Sprint 42')
        ->and($data['participants'])->toBe(['count' => 2, 'names' => null])
        ->and(collect($data['topCards'])->pluck('content')->all())->toContain('Faster reviews')
        ->and($request->body())->not->toContain('Carla Author')
        ->and($request->body())->not->toContain($carla->email);

    $page->navigate(p14bIntegrationsPath($team))
        ->assertSee('Show deliveries')
        ->click('Show deliveries')
        ->assertScript(p14bDeliveryCells('retro.completed'), 'Sent | 1 | 204 | —');
});

it('[P14b-03d] sends poker.task.estimated when the facilitator saves an estimate, without players or votes', function () {
    [$team, $admin] = p14bTeam();
    p14bWebhook($team, WebhookEvent::values());
    $game = PokerGame::factory()->create(['team_id' => $team->id, 'title' => 'Sprint 12 sizing']);
    $player = PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $admin->id]);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    $round = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);
    pokerVote($round, $player, '5');
    $game->forceFill(['facilitator_player_id' => $player->id, 'current_task_id' => $task->id])->save();
    p14bReceiverAnswers();
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/poker/{$game->id}"));

    $page->assertVisible('[aria-label="Estimate"]')
        ->assertSeeIn('[aria-label="Estimate"]', '5')
        ->click('Save estimate')
        ->assertSee('Estimate: 5');

    $this->workQueue();

    $request = p14bSentEvent('poker.task.estimated');
    $data = p14bBody($request)['data'];

    expect(outgoingWebhookSignatureIsValid($request))->toBeTrue()
        ->and($data['game']['title'])->toBe('Sprint 12 sizing')
        ->and($data['task']['title'])->toBe('Login page')
        ->and($data['task']['estimate'])->toBe('5')
        ->and($data['task']['external'])->toBeNull()
        ->and(array_keys($data))->toBe(['game', 'task', 'estimatedAt'])
        ->and($request->body())->not->toContain('Ada Admin');

    $page->navigate(p14bIntegrationsPath($team))
        ->assertSee('Show deliveries')
        ->click('Show deliveries')
        ->assertScript(p14bDeliveryCells('poker.task.estimated'), 'Sent | 1 | 204 | —');
});
```

- [ ] **Step 6: Run the event tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php --filter='P14b-03'`
Expected: PASS (4 tests, with `[P14b-03a]` of Step 1). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 7: Append the tests of the failing receiver, the automatic disabling and the 410 answer (bullets 4 and 5)**

Add these imports to the `use` block, keeping it in alphabetical order:

```php
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationStatus;
use App\Support\Integrations\Webhook\WebhookHealth;
```

Append to the file:

```php
it('[P14b-04a] retries an event seven times with the same delivery id against a receiver answering 500', function () {
    [$team, $admin] = p14bTeam();
    $integration = p14bWebhook($team, ['action_item.created']);
    [$retro] = p14bRetro($team, $admin);
    $input = '[aria-label="Add an action item…"]';
    p14bReceiverAnswers(500);
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertVisible($input)
        ->fill($input, 'Retry me')
        ->keys($input, 'Enter')
        ->assertSeeIn('aside:not([aria-label])', 'Retry me');

    $delivery = IntegrationDelivery::query()->sole();

    $this->workQueue();

    $page->navigate(p14bIntegrationsPath($team))
        ->assertSee('Show deliveries')
        ->click('Show deliveries')
        ->assertScript(p14bDeliveryCells('action_item.created'), 'Queued | 1 | 500 | —');

    $this->travel(30)->seconds();
    $this->workQueue();

    $page->click('Hide deliveries')
        ->click('Show deliveries')
        ->assertScript(p14bDeliveryCells('action_item.created'), 'Queued | 2 | 500 | —');

    foreach ([120, 600, 1800, 3600, 7200] as $seconds) {
        $this->travel($seconds)->seconds();
        $this->workQueue();
    }

    $requests = p14bSentRequests();

    expect($requests)->toHaveCount(7)
        ->and($requests->map(fn (Request $request): string => $request->header('X-Skrum-Delivery')[0])->unique()->values()->all())->toBe([$delivery->id])
        ->and($requests->map(fn (Request $request): string => $request->header('X-Skrum-Timestamp')[0])->unique())->toHaveCount(7)
        ->and($requests->every(fn (Request $request): bool => outgoingWebhookSignatureIsValid($request)))->toBeTrue()
        ->and($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($delivery->fresh()->attempts)->toBe(7)
        ->and($integration->fresh()->consecutive_failures)->toBe(1)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::Active);

    $after = $this->signIn($admin, p14bIntegrationsPath($team));

    $after->assertSee('Show deliveries')
        ->assertNotPresent('button:has-text("Re-enable")')
        ->click('Show deliveries')
        ->assertScript(p14bDeliveryCells('action_item.created'), 'Failed | 7 | 500 | Webhook did not respond. Try again later.');
});

it('[P14b-04b] disables the webhook at the tenth failed delivery in a row and sends again once re-enabled', function () {
    [$team, $admin] = p14bTeam();
    $integration = p14bWebhook($team);
    $integration->forceFill(['consecutive_failures' => 9])->save();
    [$retro] = p14bRetro($team, $admin);
    $status = 500;
    Http::fake(['hooks.example.com/*' => function () use (&$status) {
        return Http::response('', $status);
    }]);
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertSee('Share')
        ->click('Share')
        ->assertSee('Share the board')
        ->click('Send link to webhook')
        ->assertSee('The message is on its way.');

    $this->workQueue();

    foreach ([10, 60, 300] as $seconds) {
        $this->travel($seconds)->seconds();
        $this->workQueue();
    }

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->consecutive_failures)->toBe(10)
        ->and($integration->fresh()->setting('disabledReason'))->toBe(WebhookHealth::FailuresReason);
    Http::assertSentCount(4);

    $page->navigate(p14bIntegrationsPath($team))
        ->assertSee('Reconnect required')
        ->assertSee('Disabled after 10 failed deliveries in a row.')
        ->assertSee('Re-enable')
        ->click('Show deliveries')
        ->assertScript(p14bDeliveryCells('retro.link'), 'Failed | 4 | 500 | Webhook did not respond. Try again later.');

    $status = 204;

    $page->click('Re-enable')
        ->assertSee('Webhook re-enabled.')
        ->assertNotPresent('button:has-text("Re-enable")')
        ->assertDontSee('Disabled after 10 failed deliveries in a row.')
        ->click('Send a test message')
        ->assertSee('Test message sent.');

    expect($integration->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and($integration->fresh()->consecutive_failures)->toBe(0)
        ->and($integration->fresh()->setting('disabledReason'))->toBeNull();
    Http::assertSentCount(5);
});

it('[P14b-05] stops at once when the receiver answers 410 and says that the receiver asked to stop', function () {
    [$team, $admin] = p14bTeam();
    $integration = p14bWebhook($team, ['action_item.completed']);
    [$retro, $participant] = p14bRetro($team, $admin);
    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Fix the deploy',
        'created_by_participant_id' => $participant->id,
    ]);
    p14bReceiverAnswers(410);
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertVisible("#action-item-{$item->id} [aria-label=\"Mark as done\"]")
        ->click("#action-item-{$item->id} [aria-label=\"Mark as done\"]")
        ->assertPresent("#action-item-{$item->id} [aria-label=\"Reopen\"]");

    $this->workQueue();

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->setting('disabledReason'))->toBe(WebhookHealth::GoneReason);
    Http::assertSentCount(1);

    $page->navigate(p14bIntegrationsPath($team))
        ->assertSee('Reconnect required')
        ->assertSee('The receiver asked skrum to stop.')
        ->assertSee('Re-enable')
        ->click('Show deliveries')
        ->assertScript(p14bDeliveryCells('action_item.completed'), 'Failed | 1 | 410 | The receiver asked skrum to stop.');
});
```

`[P14b-04a]` travels 3 hours 42 minutes in total, which is longer than the session lifetime, so its last assertions run in a new context opened with `signIn()` after the travel. `[P14b-04b]` arranges nine earlier failures with the factory and drives the tenth through the interface with a share, whose four tries need only 370 seconds of travel, so the same page stays signed in.

- [ ] **Step 8: Run the failure tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php --filter='P14b-04|P14b-05'`
Expected: PASS (3 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If a delivery keeps `attempts` at 1 after the travel, the released job was not picked up by `workQueue()`: see the harness findings on time travel and queued jobs.

- [ ] **Step 9: Format and check Rector**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code of this file, run `composer rector` and keep its result.

- [ ] **Step 10: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php`
Expected: PASS (12 tests).

- [ ] **Step 11: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php
git commit -m "test(browser): cover the outgoing webhooks walkthrough"
```

### Task 8: Webhook payload history and redelivery walkthrough (plan 15)

This task automates the plan 15 walkthrough (`docs/superpowers/plans/2026-10-08-plan-15-webhook-redelivery.md`, line 2505), which is one paragraph. It is split into four items: view a delivery; a failing receiver; redeliver; Redeliver not offered on a disabled webhook. A fifth test covers the three refusal messages of the feature spec (`docs/superpowers/specs/2026-10-01-webhook-redelivery-design.md`, §4.3), which the walkthrough does not list.

The request inspector is replaced by `Http::fake()` exactly as in Task 7 (same three helpers of `tests/Pest.php`, same endpoint `https://hooks.example.com/skrum/incoming`). "Stop the receiver" becomes a receiver answering 503.

Facts about the interface that the selectors rely on (all read from the current code):

- A row of the delivery log shows "View" when its content is kept, and "Redeliver" when in addition the delivery is not still being sent and the webhook is active (`webhook-deliveries-panel.tsx`, `canRedeliver`). A redelivery row shows the word "Redelivery" right after the event name, in the same cell, without a space in the DOM text: the cell's `textContent` is `action_item.completedRedelivery`.
- The details dialog (`webhook-delivery-dialog.tsx`) has two tabs with fixed ids, `#delivery-tab-request` and `#delivery-tab-response`, one panel `#delivery-tabpanel`, and the headers in `table[aria-label="Headers"]`. The stored signature is masked as `sha256=…` followed by the last six characters (`WebhookClient::maskedSignature()`).
- With faked HTTP the response body stands in for the excerpt that curl collects (`ResponseExcerpt::orBodyOf()`).
- The confirmation dialog of Redeliver shows a refusal in `[role="alert"]`. Because the button is hidden for a delivery that cannot be redelivered, a refusal can only be seen when the state changed after the log was loaded: `[P15-05]` loads the log, opens the dialog, changes the state in the database, then confirms.
- The log lists the newest delivery first (`created_at`, then `id`). The helper `p15FailedDelivery()` dates its row five minutes back so that a redelivery made in the test is always the first row.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php`
- Test: `tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php`

No product file changes.

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn()`, `$this->awaitRealtime()` (plan 16a) and `$this->workQueue(): void` (plan 16b Task 1).
  - Existing helpers in `tests/Pest.php`: `disableIntegrations()`, `enableIntegrations()`, `outgoingWebhookResolves()`, `outgoingWebhookSignatureIsValid()`, `integrationAdmin()`.
  - Factories: `TeamIntegrationFactory::webhook()`, `TeamIntegrationFactory::reconnectRequired()`, `IntegrationDeliveryFactory::failed()`.
  - Nothing from Task 7: this file declares its own helpers with the prefix `p15`.
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php` (global functions): `p15Team(): array{0: Team, 1: User}`, `p15Webhook(Team $team, array $events = []): TeamIntegration`, `p15IntegrationsPath(Team $team): string`, `p15Board(Team $team, User $admin): array{0: Retro, 1: ActionItem}`, `p15FailedDelivery(Team $team, TeamIntegration $integration): IntegrationDelivery`, `p15Requests(): Collection`, `p15LogScript(): string`, `p15MakeUnredeliverable(string $case, TeamIntegration $integration, IntegrationDelivery $delivery): void`.

- [ ] **Step 1: Create the test file with its helpers and the tests of viewing a delivery and of the failing receiver**

Create `tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php` with this content:

```php
<?php

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Column;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Webhook\WebhookClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * @return array{
 *     0: Team,
 *     1: User
 * }
 */
function p15Team(): array
{
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Webhook);
    outgoingWebhookResolves();

    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = integrationAdmin($team);

    $admin->forceFill(['name' => 'Ada Admin', 'locale' => 'en'])->save();

    return [$team, $admin];
}

/**
 * @param  array<int, string>  $events
 */
function p15Webhook(Team $team, array $events = []): TeamIntegration
{
    return TeamIntegration::factory()->webhook($events)->create(['team_id' => $team->id]);
}

function p15IntegrationsPath(Team $team): string
{
    return route('teams.integrations.index', [$team->workspace, $team], false);
}

/**
 * @return array{
 *     0: Retro,
 *     1: ActionItem
 * }
 */
function p15Board(Team $team, User $admin): array
{
    $retro = Retro::factory()
        ->inPhase(RetroPhase::Discussing)
        ->create(['team_id' => $team->id, 'title' => 'Sprint 42']);

    $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $admin->id]);

    $retro->forceFill(['facilitator_participant_id' => $participant->id])->save();

    Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Ideas', 'position' => 0]);

    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Fix the deploy',
        'created_by_participant_id' => $participant->id,
    ]);

    return [$retro->fresh(), $item];
}

function p15FailedDelivery(Team $team, TeamIntegration $integration): IntegrationDelivery
{
    $delivery = IntegrationDelivery::factory()
        ->failed('Webhook did not respond. Try again later.')
        ->create([
            'team_id' => $team->id,
            'channel' => IntegrationDeliveryChannel::Webhook,
            'kind' => IntegrationDeliveryKind::Event,
            'event' => 'action_item.completed',
            'team_integration_id' => $integration->id,
            'requested_by_user_id' => null,
            'attempts' => 7,
            'response_status' => 503,
            'created_at' => now()->subMinutes(5),
        ]);

    $delivery->payload()->create(['message' => [
        'id' => $delivery->id,
        'event' => 'action_item.completed',
        'occurredAt' => '2026-10-07T10:00:00Z',
        'data' => ['actionItem' => ['id' => 'item-1', 'content' => 'Fix the deploy']],
    ]]);

    return $delivery;
}

/**
 * @return Collection<int, Request>
 */
function p15Requests(): Collection
{
    return collect(Http::recorded())->map(fn (array $pair): Request => $pair[0])->values();
}

function p15LogScript(): string
{
    return "Array.from(document.querySelectorAll('table[aria-label=\"Deliveries\"] tbody tr')).map((row) => [1, 2, 3, 4].map((index) => row.children[index].textContent).join(' | ')).join(' / ')";
}

function p15MakeUnredeliverable(string $case, TeamIntegration $integration, IntegrationDelivery $delivery): void
{
    if ($case === 'still being sent') {
        $delivery->forceFill(['status' => IntegrationDeliveryStatus::Queued])->save();

        return;
    }

    if ($case === 'webhook disabled') {
        $integration->forceFill(['status' => IntegrationStatus::ReconnectRequired])->save();

        return;
    }

    $delivery->payload()->update(['created_at' => now()->subDays(IntegrationDeliveryPayload::RetentionDays + 1)]);

    Artisan::call('model:prune', ['--model' => [IntegrationDeliveryPayload::class]]);
}

it('[P15-01] shows the request with a masked signature and the response of a delivery', function () {
    [$team, $admin] = p15Team();
    p15Webhook($team, ['action_item.completed']);
    [$retro, $item] = p15Board($team, $admin);
    Http::fake(['hooks.example.com/*' => Http::response('{"received":true}', 200)]);
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertVisible("#action-item-{$item->id} [aria-label=\"Mark as done\"]")
        ->click("#action-item-{$item->id} [aria-label=\"Mark as done\"]")
        ->assertPresent("#action-item-{$item->id} [aria-label=\"Reopen\"]");

    $this->workQueue();

    $delivery = IntegrationDelivery::query()->sole();
    $signature = p15Requests()->sole()->header('X-Skrum-Signature')[0];
    $masked = WebhookClient::maskedSignature($signature);

    expect($delivery->payload->request_headers['X-Skrum-Signature'])->toBe($masked)
        ->and((string) DB::table('integration_delivery_payloads')->value('request_body'))->not->toContain('Fix the deploy');

    $page->navigate(p15IntegrationsPath($team))
        ->assertSee('Show deliveries')
        ->click('Show deliveries')
        ->assertScript(p15LogScript(), 'action_item.completed | Sent | 1 | 200')
        ->click('View')
        ->assertSee('Delivery details')
        ->assertAriaAttribute('#delivery-tab-request', 'selected', 'true')
        ->assertSeeIn('table[aria-label="Headers"]', 'X-Skrum-Event')
        ->assertSeeIn('table[aria-label="Headers"]', 'X-Skrum-Timestamp')
        ->assertSeeIn('table[aria-label="Headers"]', $delivery->id)
        ->assertSeeIn('table[aria-label="Headers"]', $masked)
        ->assertDontSeeIn('[role="dialog"]', $signature)
        ->assertSeeIn('#delivery-tabpanel pre', '"event": "action_item.completed"')
        ->assertSeeIn('#delivery-tabpanel pre', 'Fix the deploy')
        ->click('#delivery-tab-response')
        ->assertAriaAttribute('#delivery-tab-response', 'selected', 'true')
        ->assertSee('Status: 200')
        ->assertSeeIn('#delivery-tabpanel pre', '{"received":true}');
});

it('[P15-02] shows a delivery that failed after its seven tries, with the last answer of the receiver', function () {
    [$team, $admin] = p15Team();
    $integration = p15Webhook($team, ['action_item.completed']);
    [$retro, $item] = p15Board($team, $admin);
    Http::fake(['hooks.example.com/*' => Http::response('upstream down', 503)]);
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertVisible("#action-item-{$item->id} [aria-label=\"Mark as done\"]")
        ->click("#action-item-{$item->id} [aria-label=\"Mark as done\"]")
        ->assertPresent("#action-item-{$item->id} [aria-label=\"Reopen\"]");

    $this->workQueue();

    foreach ([30, 120, 600, 1800, 3600, 7200] as $seconds) {
        $this->travel($seconds)->seconds();
        $this->workQueue();
    }

    expect(IntegrationDelivery::query()->sole()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::Active);
    Http::assertSentCount(7);

    $after = $this->signIn($admin, p15IntegrationsPath($team));

    $after->assertSee('Show deliveries')
        ->click('Show deliveries')
        ->assertScript(p15LogScript(), 'action_item.completed | Failed | 7 | 503')
        ->assertSeeIn('table[aria-label="Deliveries"] tbody tr', 'Webhook did not respond. Try again later.')
        ->assertPresent('table[aria-label="Deliveries"] button:has-text("Redeliver")')
        ->click('View')
        ->assertSee('Delivery details')
        ->click('#delivery-tab-response')
        ->assertSee('Status: 503')
        ->assertSeeIn('#delivery-tabpanel pre', 'upstream down');
});
```

- [ ] **Step 2: Run the two tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php --filter='P15-01|P15-02'`
Expected: PASS (2 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 3: Append the tests of Redeliver, of the disabled webhook and of the refusals**

Add this import to the `use` block of `tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php`, keeping it in alphabetical order:

```php
use App\Support\Integrations\Webhook\WebhookHealth;
```

Append to the file:

```php
it('[P15-03] redelivers a failed delivery with the same id, the redelivery header and a row marked Redelivery', function () {
    [$team, $admin] = p15Team();
    $integration = p15Webhook($team);
    $original = p15FailedDelivery($team, $integration);
    Http::fake(['hooks.example.com/*' => Http::response('', 200)]);
    config(['queue.default' => 'database']);

    $page = $this->signIn($admin, p15IntegrationsPath($team));

    $page->assertSee('Show deliveries')
        ->click('Show deliveries')
        ->assertScript(p15LogScript(), 'action_item.completed | Failed | 7 | 503')
        ->click('Redeliver')
        ->assertSee('Send this delivery again to hooks.example.com?')
        ->click('[role="dialog"] button:has-text("Redeliver")')
        ->assertSee('Delivery queued again.')
        ->assertNotPresent('[role="dialog"]')
        ->assertScript(p15LogScript(), 'action_item.completedRedelivery | Queued | 0 | — / action_item.completed | Failed | 7 | 503');

    Http::assertNothingSent();

    $this->workQueue();

    $page->click('Hide deliveries')
        ->click('Show deliveries')
        ->assertScript(p15LogScript(), 'action_item.completedRedelivery | Sent | 1 | 200 / action_item.completed | Failed | 7 | 503');

    $request = p15Requests()->sole();
    $body = json_decode($request->body(), true, flags: JSON_THROW_ON_ERROR);
    $redelivery = IntegrationDelivery::query()->where('redelivery_of_id', $original->id)->sole();

    expect($request->header('X-Skrum-Delivery')[0])->toBe($original->id)
        ->and($request->header('X-Skrum-Redelivery')[0])->toBe('true')
        ->and($request->header('X-Skrum-Event')[0])->toBe('action_item.completed')
        ->and(outgoingWebhookSignatureIsValid($request))->toBeTrue()
        ->and($body['id'])->toBe($original->id)
        ->and($body['occurredAt'])->toBe('2026-10-07T10:00:00Z')
        ->and($body['data'])->toBe(['actionItem' => ['id' => 'item-1', 'content' => 'Fix the deploy']])
        ->and($redelivery->requested_by_user_id)->toBe($admin->id)
        ->and($original->fresh()->attempts)->toBe(7);
});

it('[P15-04] offers no Redeliver while the webhook is disabled and offers it again once re-enabled', function () {
    [$team, $admin] = p15Team();
    $integration = TeamIntegration::factory()
        ->webhook()
        ->reconnectRequired('Disabled after 10 failed deliveries in a row.')
        ->create(['team_id' => $team->id, 'consecutive_failures' => 10]);
    $integration->forceFill(['settings' => [...$integration->settings, 'disabledReason' => WebhookHealth::FailuresReason]])->save();
    p15FailedDelivery($team, $integration);

    $page = $this->signIn($admin, p15IntegrationsPath($team));

    $page->assertSee('Disabled after 10 failed deliveries in a row.')
        ->click('Show deliveries')
        ->assertScript(p15LogScript(), 'action_item.completed | Failed | 7 | 503')
        ->assertPresent('table[aria-label="Deliveries"] button:has-text("View")')
        ->assertNotPresent('table[aria-label="Deliveries"] button:has-text("Redeliver")')
        ->click('Re-enable')
        ->assertSee('Webhook re-enabled.')
        ->assertPresent('table[aria-label="Deliveries"] button:has-text("Redeliver")');
});

it('[P15-05] explains why a delivery cannot be redelivered', function (string $case, string $message) {
    [$team, $admin] = p15Team();
    $integration = p15Webhook($team);
    $delivery = p15FailedDelivery($team, $integration);
    Http::fake(['hooks.example.com/*' => Http::response('', 200)]);
    config(['queue.default' => 'database']);

    $page = $this->signIn($admin, p15IntegrationsPath($team));

    $page->assertSee('Show deliveries')
        ->click('Show deliveries')
        ->assertScript(p15LogScript(), 'action_item.completed | Failed | 7 | 503')
        ->click('Redeliver')
        ->assertSee('Send this delivery again to hooks.example.com?');

    p15MakeUnredeliverable($case, $integration, $delivery);

    $page->click('[role="dialog"] button:has-text("Redeliver")')
        ->assertSeeIn('[role="dialog"] [role="alert"]', $message);

    expect(IntegrationDelivery::query()->count())->toBe(1);
    Http::assertNothingSent();
})->with([
    'still being sent' => ['still being sent', 'This delivery is still being sent.'],
    'webhook disabled' => ['webhook disabled', 'Turn the webhook back on before redelivering.'],
    'content pruned' => ['content pruned', "This delivery's content is no longer kept."],
]);
```

`[P15-03]` and the two tests after it arrange the failed delivery with the factory instead of driving seven tries again: the failure itself is the subject of `[P15-02]`. In the "content pruned" case the stored content is dated 31 days back and removed by the real `model:prune` command, as the daily schedule does.

- [ ] **Step 4: Run the three tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php --filter='P15-03|P15-04|P15-05'`
Expected: PASS (5 tests: `[P15-05]` runs three times). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Format and check Rector**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code of this file, run `composer rector` and keep its result.

- [ ] **Step 6: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php`
Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php
git commit -m "test(browser): cover the webhook redelivery walkthrough"
```

### Task 9: API tokens page of the MCP walkthrough (plan 11b)

This task automates the browser steps of the plan 11b walkthrough (`docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md`, lines 4522 to 4539). Of its 18 steps, only the settings page is browser work: steps 1 and 2, the "Last used" part of step 3, the token creation of step 15, the revocation of step 16, the feature switch of step 17 and the page translation of step 18. Everything driven by Claude Code is out of scope (spec §1) and goes to the residual checklist; it stays covered by the feature tests under `tests/Feature/Mcp`.

Where a step needs "the next call of the client", the test issues one plain request from the test process with the existing helper `postMcp()` of `tests/Pest.php`, which sends `POST /mcp` with an `Authorization: Bearer` header. This is not `actingAs()` and injects no cookie.

Facts about the interface that the selectors rely on (all read from the current code):

- `GET /settings/api-tokens` and `POST /settings/api-tokens` sit behind `RequirePassword` (`routes/settings.php`, lines 32 to 39). Opening the page therefore sends the user to `/user/confirm-password`; the tests fill `#password` and click `@confirm-password-button` (`resources/js/pages/auth/confirm-password.tsx`), then land on the page. Signing in does not count as a confirmation.
- The settings navigation is `nav[aria-label="Settings"]`; it lists "API tokens" only when the shared prop `features.mcp` is true (`resources/js/layouts/settings/layout.tsx`). `EnsureMcpIsEnabled` reads `config('skrum.mcp.enabled')` on every request, on the settings routes and on `/mcp`.
- The create dialog (`resources/js/components/settings/create-token-dialog.tsx`) has fixed ids: `#token-name`, `#scope-read` (checked and disabled), `#scope-write`, `#scope-delete`, `#token-team`, `#token-expiration`. Its submit button has no `type` attribute and the text "Create token", like the button that opens the dialog, so it is addressed as `[role="dialog"] form button:has-text("Create token")`.
- The new token is shown once in `input[aria-label="API token"]` (`new-token-dialog.tsx`); the value comes from Inertia flash data.
- The table's columns are Name, Permissions, Team, Created, Expires, Last used, Status, Revoke. Dates are formatted in the browser with `Intl.DateTimeFormat(locale, { dateStyle: 'medium' })`, in the browser's time zone, so the tests compare a cell with the same expression evaluated in the page.
- The table header holds a screen-reader-only "Revoke", so the row's button is addressed inside its row.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan11bApiTokensTest.php`
- Test: `tests/Browser/Walkthroughs/Plan11bApiTokensTest.php`

No product file changes.

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn(User $user, string $to): mixed` (plan 16a).
  - Existing helpers in `tests/Pest.php`: `teamMember(Team $team): User`, `issueTestMcpToken(User $user, array $scopes = [McpScope::Read], ?Team $team = null, ?CarbonInterface $expiresAt = null): string` (the token is named "Test client"), `postMcp(?string $token, array $payload = […], array $headers = []): TestResponse`.
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan11bApiTokensTest.php` (global functions): `p11bOwner(string $locale = 'en'): array{0: User, 1: Team}`, `p11bConfirmPassword(mixed $page): mixed`, `p11bRow(string $name): string`, `p11bCellShowsDate(string $name, int $cell, CarbonInterface $date, string $locale = 'en'): string`.

- [ ] **Step 1: Create the test file with its helpers and the tests of the page and of token creation (steps 1, 2, 3 and 15)**

Create `tests/Browser/Walkthroughs/Plan11bApiTokensTest.php` with this content:

```php
<?php

use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonInterface;

/**
 * @return array{
 *     0: User,
 *     1: Team
 * }
 */
function p11bOwner(string $locale = 'en'): array
{
    $team = Team::factory()->create(['name' => 'Demo Team']);
    $user = teamMember($team);

    $user->forceFill(['name' => 'Fran Facilitator', 'locale' => $locale])->save();

    return [$user, $team];
}

function p11bConfirmPassword(mixed $page): mixed
{
    return $page->assertPathIs('/user/confirm-password')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs('/settings/api-tokens');
}

function p11bRow(string $name): string
{
    return "tbody tr:has-text(\"{$name}\")";
}

function p11bCellShowsDate(string $name, int $cell, CarbonInterface $date, string $locale = 'en'): string
{
    $iso = $date->toIso8601String();

    return "Array.from(document.querySelectorAll('tbody tr')).filter((row) => row.textContent.includes('{$name}'))[0].children[{$cell}].textContent === new Intl.DateTimeFormat('{$locale}', { dateStyle: 'medium' }).format(new Date('{$iso}'))";
}

it('[P11b-01] opens the API tokens page from the settings after a password confirmation', function () {
    [$user] = p11bOwner();

    $page = $this->signIn($user, '/settings/profile');

    $page->assertVisible('nav[aria-label="Settings"]')
        ->click('nav[aria-label="Settings"] a:has-text("API tokens")');

    p11bConfirmPassword($page)
        ->assertSee('Connect an AI assistant that supports MCP to skrum with a personal token.')
        ->assertVisible('#mcp-url')
        ->assertSee('Copy')
        ->assertSee('Data you read through this connection is sent to the AI application you use.')
        ->assertSee('Tokens stay valid after a password change. Revoke them here.')
        ->assertSee('No API tokens yet.');

    expect($page->value('#mcp-url'))->toEndWith('/mcp');
});

it('[P11b-02] creates a token with scopes, a team and an expiry, shows it once and stores only its hash', function () {
    [$user, $team] = p11bOwner();

    $page = p11bConfirmPassword($this->signIn($user, '/settings/api-tokens'));

    $page->assertSee('No API tokens yet.')
        ->click('Create token')
        ->assertVisible('#token-name')
        ->assertAriaAttribute('#scope-read', 'checked', 'true')
        ->assertDisabled('#scope-read')
        ->assertSeeIn('#token-team', 'All my teams')
        ->assertSeeIn('#token-expiration', '90 days')
        ->fill('#token-name', 'Walkthrough')
        ->click('#scope-write')
        ->assertAriaAttribute('#scope-write', 'checked', 'true')
        ->click('#scope-delete')
        ->assertAriaAttribute('#scope-delete', 'checked', 'true')
        ->click('#token-team')
        ->click('[role="option"]:has-text("Demo Team")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('#token-team', 'Demo Team')
        ->click('#token-expiration')
        ->click('[role="option"]:has-text("30 days")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('#token-expiration', '30 days')
        ->click('[role="dialog"] form button:has-text("Create token")')
        ->assertVisible('input[aria-label="API token"]')
        ->assertSee("Copy your token now. You won't be able to see it again.");

    $plainText = $page->value('input[aria-label="API token"]');
    $secret = explode('|', $plainText, 2)[1];
    $token = PersonalAccessToken::query()->sole();

    expect($plainText)->toStartWith("{$token->id}|skrum_")
        ->and($token->token)->toBe(hash('sha256', $secret))
        ->and($token->token)->not->toBe($secret)
        ->and($token->abilities)->toBe(['mcp:read', 'mcp:write', 'mcp:delete'])
        ->and($token->team_id)->toBe($team->id)
        ->and($token->token_hint)->toBe(substr($plainText, -4))
        ->and($token->expires_at->isSameDay(now()->addDays(30)))->toBeTrue();

    $page->assertSeeIn('[role="dialog"] [role="tabpanel"]', 'claude mcp add --transport http skrum')
        ->assertSeeIn('[role="dialog"] [role="tabpanel"]', "Authorization: Bearer {$plainText}")
        ->click('[role="tab"]:has-text("Other clients")')
        ->assertSeeIn('[role="dialog"] [role="tabpanel"]', '"mcpServers"')
        ->click('Done')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn(p11bRow('Walkthrough'), "skrum_…{$token->token_hint}")
        ->assertCount(p11bRow('Walkthrough').' td:nth-child(2) [data-slot="badge"]', 3)
        ->assertSeeIn(p11bRow('Walkthrough'), 'Read')
        ->assertSeeIn(p11bRow('Walkthrough'), 'Create and update')
        ->assertSeeIn(p11bRow('Walkthrough'), 'Delete my messages')
        ->assertSeeIn(p11bRow('Walkthrough'), 'Demo Team')
        ->assertSeeIn(p11bRow('Walkthrough'), 'Never')
        ->assertSeeIn(p11bRow('Walkthrough'), 'Active')
        ->assertScript(p11bCellShowsDate('Walkthrough', 4, $token->expires_at), true);

    $page->navigate('/settings/api-tokens')
        ->assertSeeIn(p11bRow('Walkthrough'), 'Demo Team')
        ->assertNotPresent('input[aria-label="API token"]')
        ->assertScript("document.documentElement.innerHTML.includes('{$secret}')", false);
});

it('[P11b-03b] shows when a token was last used after a request made with it', function () {
    [$user] = p11bOwner();
    $plainText = issueTestMcpToken($user);

    $page = p11bConfirmPassword($this->signIn($user, '/settings/api-tokens'));

    $page->assertSeeIn(p11bRow('Test client').' td:nth-child(6)', 'Never');

    postMcp($plainText)->assertOk();

    $token = PersonalAccessToken::query()->sole();

    expect($token->last_used_at)->not->toBeNull();

    $page->navigate('/settings/api-tokens')
        ->assertVisible(p11bRow('Test client'))
        ->assertScript(p11bCellShowsDate('Test client', 5, $token->last_used_at), true);
});

it('[P11b-15a] creates a read-only token bound to another team with the default expiry of 90 days', function () {
    [$user, $team] = p11bOwner();
    $other = Team::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Other Team']);
    $other->members()->attach($user);

    $page = p11bConfirmPassword($this->signIn($user, '/settings/api-tokens'));

    $page->click('Create token')
        ->assertVisible('#token-name')
        ->fill('#token-name', 'Read only')
        ->click('#token-team')
        ->click('[role="option"]:has-text("Other Team")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('#token-team', 'Other Team')
        ->click('[role="dialog"] form button:has-text("Create token")')
        ->assertVisible('input[aria-label="API token"]')
        ->click('Done')
        ->assertNotPresent('[role="dialog"]');

    $token = PersonalAccessToken::query()->sole();

    expect($token->abilities)->toBe(['mcp:read'])
        ->and($token->team_id)->toBe($other->id)
        ->and($token->expires_at->isSameDay(now()->addDays(90)))->toBeTrue();

    $page->assertCount(p11bRow('Read only').' td:nth-child(2) [data-slot="badge"]', 1)
        ->assertSeeIn(p11bRow('Read only').' td:nth-child(2)', 'Read')
        ->assertSeeIn(p11bRow('Read only').' td:nth-child(3)', 'Other Team')
        ->assertScript(p11bCellShowsDate('Read only', 4, $token->expires_at), true);
});
```

- [ ] **Step 2: Run the four tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan11bApiTokensTest.php --filter='P11b-01|P11b-02|P11b-03b|P11b-15a'`
Expected: PASS (4 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If the page opens without asking for the password, or if the token dialog never appears after "Create token", see the harness findings on session and flash data between two requests.

- [ ] **Step 3: Append the tests of revocation, of the feature switch and of the translations (steps 16, 17 and 18)**

Append to `tests/Browser/Walkthroughs/Plan11bApiTokensTest.php` (no new import is needed):

```php
it('[P11b-16] revokes a token, removes its row and refuses the next request made with it', function () {
    [$user] = p11bOwner();
    $plainText = issueTestMcpToken($user);

    postMcp($plainText)->assertOk();

    $page = p11bConfirmPassword($this->signIn($user, '/settings/api-tokens'));

    $page->assertVisible(p11bRow('Test client'))
        ->click(p11bRow('Test client').' button:has-text("Revoke")')
        ->assertSee('Revoke this token?')
        ->assertSee('Clients using "Test client" lose access on their next request.')
        ->click('[role="dialog"] button:has-text("Revoke")')
        ->assertSee('Token revoked.')
        ->assertSee('No API tokens yet.')
        ->assertNotPresent(p11bRow('Test client'));

    expect(PersonalAccessToken::query()->count())->toBe(0);

    postMcp($plainText)->assertUnauthorized();
});

it('[P11b-17] hides the API tokens entry and page and answers 404 on the MCP endpoint when MCP is off', function () {
    [$user] = p11bOwner();
    $plainText = issueTestMcpToken($user);
    config(['skrum.mcp.enabled' => false]);

    $page = $this->signIn($user, '/settings/profile');

    $page->assertVisible('nav[aria-label="Settings"]')
        ->assertSeeIn('nav[aria-label="Settings"]', 'Security')
        ->assertDontSeeIn('nav[aria-label="Settings"]', 'API tokens')
        ->navigate('/settings/api-tokens')
        ->assertSee('Not Found')
        ->assertNotPresent('#mcp-url');

    postMcp($plainText)->assertNotFound();
    postMcp(null)->assertNotFound();
});

it('[P11b-18a] translates the API tokens page and its dialogs', function (string $locale, string $serverUrl, string $empty, string $create, string $expiration, string $allTeams, string $copyNow) {
    [$user] = p11bOwner($locale);

    $page = p11bConfirmPassword($this->signIn($user, '/settings/api-tokens'));

    $page->assertSee($serverUrl)
        ->assertSee($empty)
        ->assertDontSee('No API tokens yet.')
        ->click($create)
        ->assertVisible('#token-name')
        ->assertSee($expiration)
        ->assertSeeIn('#token-team', $allTeams)
        ->fill('#token-name', 'Walkthrough')
        ->click("[role=\"dialog\"] form button:has-text(\"{$create}\")")
        ->assertVisible('[role="dialog"] input[readonly]')
        ->assertSee($copyNow)
        ->assertDontSee('Copy your token now.');
})->with([
    'fr' => ['fr', 'URL du serveur', "Aucun jeton d'API pour le moment.", 'Créer un jeton', 'Expiration', 'Toutes mes équipes', 'Copiez votre jeton maintenant. Vous ne pourrez plus le voir ensuite.'],
    'es' => ['es', 'URL del servidor', 'Aún no hay tokens de API.', 'Crear token', 'Caducidad', 'Todos mis equipos', 'Copia tu token ahora. No podrás volver a verlo.'],
    'de' => ['de', 'Server-URL', 'Noch keine API-Tokens.', 'Token erstellen', 'Ablauf', 'Alle meine Teams', 'Kopiere dein Token jetzt. Du kannst es später nicht mehr sehen.'],
]);
```

The walkthrough's step 17 sets `SKRUM_MCP_ENABLED=false` and restarts. The test sets the configuration value that this variable feeds; the middleware and the shared `features.mcp` prop read it on every request, so no restart is involved.

- [ ] **Step 4: Run the three tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan11bApiTokensTest.php --filter='P11b-16|P11b-17|P11b-18a'`
Expected: PASS (5 tests: `[P11b-18a]` runs three times). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Format and check Rector**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code of this file, run `composer rector` and keep its result.

- [ ] **Step 6: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan11bApiTokensTest.php`
Expected: PASS (9 tests).

- [ ] **Step 7: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan11bApiTokensTest.php
git commit -m "test(browser): cover the API tokens page of the MCP walkthrough"
```

### Task 10: Plan 14c walkthrough (Jira Data Center and GitHub Issues trackers)

This task automates the walkthrough of plan 14c (`docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md`, line 6860, one paragraph). The paragraph is split into 13 items; item 5 and item 9 become several tests. Jira Data Center and GitHub are faked in process with `Http::fake()`; the skrum interface is driven for real. The OAuth round trip of Jira Data Center, the installation of the GitHub App and the clearing of an estimate are residual (see "Residual entries").

Facts the tests rely on (all read from the current code):

- `phpunit.xml` leaves every provider unconfigured. `enableIntegrations(IntegrationProvider::X)` (`tests/Pest.php`) configures one provider, so the integrations page (`resources/js/pages/teams/integrations.tsx`) renders exactly one card and no selector has to name a card. The file helper `p14cEnable()` calls `disableIntegrations()` first, so a local `.env` cannot add a second card.
- The integrations page is `route('teams.integrations.index', [$workspace, $team])` and needs a workspace Owner or Admin (`TeamPolicy::manageIntegrations`). `integrationAdmin($team)` (`tests/Pest.php`) creates one.
- Jira Data Center card (`resources/js/components/integrations/jira-data-center-integration.tsx`): not connected, it shows the links "Connect (read only)" and "Connect (read and write)" and the button "Older Jira server? Use a personal access token". A connection made with OAuth shows "Reconnect" and, with read access, "Upgrade to read and write"; it offers no token dialog. A connection made with a token shows a `role="note"` block "Acting as :name in Jira", "Token saved on :date", and the buttons "Replace token" and "Remove token".
- Token dialog (`jira-token-dialog.tsx`): the token field is the only `input[type="password"]` of the dialog (its id comes from `useId()`), the access choice is a toggle group with the buttons "Read only" and "Read and write", "Save token" is disabled until the "I understand" checkbox is ticked. A refused token shows the server's message under the field.
- `ConnectJiraDataCenterToken` calls `GET /rest/api/2/myself` and `GET /rest/api/2/serverInfo` with `Authorization: Bearer {token}`, then `GET /rest/api/2/field`. The connected card then loads priorities (`GET /rest/api/2/priority`). Every test therefore ends its `Http::fake()` list with a catch-all for `jira.example.com/*`.
- "Test the connection" (`TestConnectionButton`) posts to the test endpoint and reloads the card. A 401 on a token connection stores "The Jira personal access token was revoked or has expired. Paste a new one." and the status "Reconnect required"; a 404 on `GET /app/installations/{id}` stores "The GitHub App was uninstalled from :account."
- Poker import dialog (`resources/js/components/poker/import-tasks-dialog.tsx`): opened by the "Import" button of the tasks pane; the selects are `[aria-label="Choose a board"]` and `[aria-label="Choose a sprint"]` for Jira Data Center, `[aria-label="Choose a repository"]` and `[aria-label="Choose a milestone"]` for GitHub; then "Show issues" and "Import :count tasks".
- The estimate is written back by the queued job `App\Jobs\SyncTaskEstimate`. `phpunit.xml` sets the `sync` queue; the tests set `config(['queue.default' => 'database'])` and run the job with `$this->workQueue()`, so that the job's broadcast reaches the facilitator's page too. The task detail shows "Sync pending", then "Synced to :source" (`task-source-details.tsx`); for GitHub the badge carries `title="Written to the issue description."`.
- The interface has no control that clears an estimate (`facilitator-toolbar.tsx` only offers the deck's cards); `PUT /poker/{game}/tasks/{task}/estimate` with `value: null` exists for the API only. The walkthrough item "clear the estimate (block removed)" is therefore residual; `tests/Feature/Integrations/GitHubTrackerTest.php` ("removes the block when the estimate is cleared") covers the behaviour.
- Export dialog (`export-action-item-dialog.tsx`): opened from the action item by `[aria-label="Export to :provider"]`; it shows the selects `[aria-label="Project"]` and `[aria-label="Issue type"]` (Jira) or `[aria-label="Repository"]` (GitHub), an assignee line and a priority line, and the button "Export". The action items panel is the `aside` of the board, and an item is `#action-item-{id}`.
- The fake helpers of `tests/Pest.php` used here: `jiraDataCenterUrl()`, `jiraCreateMeta()`, `fakeGitHubTrackerApi()`, `gitHubIssue()`, `renderedEstimateBlock()`, `trackerTable()`, `importedPokerTask()`, `openPokerRound()`, `pokerVote()`, `integrationAdmin()`, `teamMember()`, `retroFacilitator()`, `enableIntegrations()`, `disableIntegrations()`. Helpers that are declared inside feature test files (`fakeJiraDataCenterTrackerApi()`, `fakeGitHubExport()`, …) are not loaded with a browser test and are not used.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan14cTrackersTest.php`
- Test: `tests/Browser/Walkthroughs/Plan14cTrackersTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn(User $user, string $to): mixed` and `$this->awaitRealtime(mixed $page): mixed` (plan 16a).
  - `$this->workQueue(): void` from `Tests\Browser\Support\InteractsWithBrowser` (plan 16b Task 1): runs one queued job with `queue:work --once` outside any browser request.
  - `data-realtime` on `retros/show` and `poker/show` (plan 16a Task 3); `data-test="poker-task-row"` (plan 16a Task 10).
  - Factories: `TeamIntegrationFactory::jiraDataCenter(IntegrationAccess $access, string $authMethod)`, `TeamIntegrationFactory::gitHub()`, the constants `TeamIntegrationFactory::JiraDataCenterToken` and `TeamIntegrationFactory::GitHubInstallationId`, `IntegrationUserMappingFactory::manual()`, `SocialAccountFactory`, `PokerRoundFactory::revealed()`.
- Produces:
  - No product change and no new `data-test` hook.
  - File-level helpers in `tests/Browser/Walkthroughs/Plan14cTrackersTest.php` (global functions; other files must not redeclare them): `p14cEnable(IntegrationProvider $provider): void`, `p14cDueJobs(): int`, `p14cAdmin(Team $team): User`, `p14cIntegrationsPath(Team $team): string`, `p14cJiraDataCenterIssue(string $id, string $key): array`, `p14cFakeJiraDataCenter(array $routes = []): void`, `p14cTable(IntegrationProvider $source, PokerDeck $deck = PokerDeck::Fibonacci): array`, `p14cBoardItem(array $attributes = []): array`, `p14cGitHubPatches(): array`.

- [ ] **Step 1: Check that the queue helper of plan 16b exists**

Run: `grep -n "function workQueue" tests/Browser/Support/InteractsWithBrowser.php`
Expected: one line, `protected function workQueue(int $jobs = 1): void`. If the command prints nothing, plan 16b Task 1 is not on this branch: stop and merge it first.

- [ ] **Step 2: Create the test file with its helpers and the Jira Data Center connection tests**

`php artisan make:test` cannot create files under `tests/Browser`, so create `tests/Browser/Walkthroughs/Plan14cTrackersTest.php` directly with this content:

```php
<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\PokerDeck;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

function p14cEnable(IntegrationProvider $provider): void
{
    disableIntegrations();
    enableIntegrations($provider);

    config(['queue.default' => 'database']);

    Http::preventStrayRequests();
}

function p14cDueJobs(): int
{
    return DB::table('jobs')
        ->whereNull('reserved_at')
        ->where('available_at', '<=', now()->getTimestamp())
        ->count();
}

function p14cAdmin(Team $team): User
{
    $admin = integrationAdmin($team);

    $admin->forceFill(['name' => 'Ada Admin', 'locale' => 'en'])->save();

    return $admin;
}

function p14cIntegrationsPath(Team $team): string
{
    return route('teams.integrations.index', [$team->workspace, $team], false);
}

/**
 * @return array<string, mixed>
 */
function p14cJiraDataCenterIssue(string $id, string $key): array
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
        ],
    ];
}

/**
 * @param  array<string, mixed>  $routes
 */
function p14cFakeJiraDataCenter(array $routes = []): void
{
    $defaults = [
        jiraDataCenterUrl('rest/agile/1.0/board/*/sprint*') => Http::response(['values' => [
            ['id' => 31, 'name' => 'Sprint 31', 'state' => 'active', 'startDate' => '2026-10-01T09:00:00.000+02:00', 'endDate' => '2026-10-14T17:00:00.000+02:00'],
        ]]),
        jiraDataCenterUrl('rest/agile/1.0/board*') => Http::response(['values' => [['id' => 7, 'name' => 'Team board']], 'isLast' => true]),
        jiraDataCenterUrl('rest/api/2/search') => Http::response([
            'issues' => [p14cJiraDataCenterIssue('10001', 'PROJ-1'), p14cJiraDataCenterIssue('10002', 'PROJ-2')],
            'total' => 2,
            'startAt' => 0,
            'maxResults' => 100,
        ]),
        jiraDataCenterUrl('rest/api/2/issue/*/editmeta') => Http::response(['fields' => ['customfield_10002' => ['name' => 'Story Points']]]),
        jiraDataCenterUrl('rest/api/2/project') => Http::response([['id' => '10000', 'key' => 'API', 'name' => 'API platform']]),
        jiraDataCenterUrl('rest/api/2/issue/createmeta/10000/issuetypes') => Http::response(['values' => [
            ['id' => '10', 'name' => 'Story', 'subtask' => false],
            ['id' => '11', 'name' => 'Task', 'subtask' => false],
        ]]),
        jiraDataCenterUrl('rest/api/2/issue/createmeta/*') => Http::response(['values' => jiraCreateMeta()['fields']]),
        jiraDataCenterUrl('rest/api/2/issue') => Http::response(['id' => '10042', 'key' => 'PROJ-42'], 201),
        jiraDataCenterUrl('rest/api/2/issue/*') => Http::response(null, 204),
        'jira.example.com/*' => Http::response([]),
    ];

    Http::fake([...$routes, ...array_diff_key($defaults, $routes)]);
}

/**
 * @return array{
 *     game: PokerGame,
 *     integration: TeamIntegration,
 *     facilitator: User,
 *     facilitatorPlayer: PokerPlayer,
 *     member: User,
 *     memberPlayer: PokerPlayer
 * }
 */
function p14cTable(IntegrationProvider $source, PokerDeck $deck = PokerDeck::Fibonacci): array
{
    p14cEnable($source);

    $table = trackerTable($source, IntegrationAccess::Write, $deck);

    $table['game']->forceFill(['title' => 'Sprint 12 estimates'])->save();
    $table['facilitator']->forceFill(['name' => 'Ada Facilitator', 'locale' => 'en'])->save();

    return $table;
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: ActionItem
 * }
 */
function p14cBoardItem(array $attributes = []): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['title' => 'Sprint 12']);
    [$ada, $participant] = retroFacilitator($retro);

    $ada->forceFill(['name' => 'Ada Facilitator', 'locale' => 'en'])->save();

    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $participant->id,
        'content' => 'Speed up CI',
        ...$attributes,
    ]);

    return [$retro, $ada, $item];
}

/**
 * @return array<int, Request>
 */
function p14cGitHubPatches(): array
{
    return Http::recorded(fn (Request $request): bool => $request->method() === 'PATCH')
        ->map(fn (array $pair): Request => $pair[0])
        ->values()
        ->all();
}

it('[P14c-01] offers OAuth first on the Jira Data Center card and shows an OAuth connection with its access', function () {
    p14cEnable(IntegrationProvider::JiraDataCenter);
    Http::fake(['jira.example.com/*' => Http::response([])]);
    $team = Team::factory()->create();
    $admin = p14cAdmin($team);
    $path = p14cIntegrationsPath($team);

    $page = $this->signIn($admin, $path);

    $page->assertSee('Jira Data Center')
        ->assertSee('Not connected')
        ->assertAttributeContains('a:has-text("Connect (read only)")', 'href', '/connect?access=read')
        ->assertAttributeContains('a:has-text("Connect (read and write)")', 'href', '/connect?access=write')
        ->assertVisible('button:has-text("Older Jira server")');

    TeamIntegration::factory()->jiraDataCenter(IntegrationAccess::Read)->create(['team_id' => $team->id]);

    $page->navigate($path)
        ->assertSee('Acme Jira')
        ->assertSee('9.12.2')
        ->assertSee('Read only')
        ->assertSee('OAuth')
        ->assertVisible('a:has-text("Reconnect")')
        ->assertAttributeContains('a:has-text("Upgrade to read and write")', 'href', '/connect?access=write')
        ->assertDontSee('Not connected')
        ->assertDontSee('Acting as')
        ->assertDontSee('Replace token');
});

it('[P14c-05a] connects Jira Data Center with a personal access token and shows whom the token acts as', function () {
    p14cEnable(IntegrationProvider::JiraDataCenter);
    Http::fake([
        jiraDataCenterUrl('rest/api/2/myself') => Http::response(['name' => 'jdoe', 'displayName' => 'Jane Doe', 'emailAddress' => 'jane@example.com']),
        jiraDataCenterUrl('rest/api/2/serverInfo') => Http::response(['serverTitle' => 'Acme Jira', 'version' => '8.20.1', 'versionNumbers' => [8, 20, 1]]),
        'jira.example.com/*' => Http::response([]),
    ]);
    $token = 'pasted-jira-token-abcdefghijklmnop';
    $team = Team::factory()->create();
    $admin = p14cAdmin($team);

    $page = $this->signIn($admin, p14cIntegrationsPath($team));

    $page->assertSee('Not connected')
        ->assertVisible('button:has-text("Older Jira server")')
        ->click('button:has-text("Older Jira server")')
        ->assertSee('Create a token in Jira under Profile → Personal Access Tokens, then paste it here.')
        ->assertSee('This token acts as its owner in Jira.')
        ->assertButtonDisabled('Save token')
        ->fill('[role="dialog"] input[type="password"]', $token)
        ->click('[role="dialog"] button:has-text("Read and write")')
        ->click('[role="dialog"] label:has-text("I understand") button[role="checkbox"]')
        ->assertButtonEnabled('Save token')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertSee('Token saved.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Acting as Jane Doe in Jira')
        ->assertSee('This token acts as Jane Doe in Jira.')
        ->assertSee('Token saved on')
        ->assertSee('Acme Jira')
        ->assertSee('8.20.1')
        ->assertSee('Read and write')
        ->assertSee('Personal access token')
        ->assertSee('Replace token')
        ->assertSee('Remove token')
        ->assertDontSee('Not connected')
        ->assertScript('document.documentElement.innerHTML.includes("'.$token.'")', false);

    $integration = TeamIntegration::query()->sole();

    expect($integration->credential('personalAccessToken'))->toBe($token)
        ->and((string) DB::table('team_integrations')->value('credentials'))->not->toContain($token)
        ->and($integration->setting('authMethod'))->toBe('pat')
        ->and($integration->setting('tokenOwner'))->toBe(['name' => 'jdoe', 'displayName' => 'Jane Doe'])
        ->and($integration->access)->toBe(IntegrationAccess::Write);

    foreach (['rest/api/2/myself', 'rest/api/2/serverInfo'] as $path) {
        Http::assertSent(fn (Request $request) => $request->url() === "https://jira.example.com/{$path}"
            && $request->hasHeader('Authorization', "Bearer {$token}"));
    }
});

it('[P14c-05b] refuses a token Jira rejects and a server older than Jira 8.14', function () {
    p14cEnable(IntegrationProvider::JiraDataCenter);
    $myselfStatus = 401;
    $versionNumbers = [8, 20, 1];
    Http::fake([
        jiraDataCenterUrl('rest/api/2/myself') => function () use (&$myselfStatus) {
            return Http::response(['name' => 'jdoe', 'displayName' => 'Jane Doe'], $myselfStatus);
        },
        jiraDataCenterUrl('rest/api/2/serverInfo') => function () use (&$versionNumbers) {
            return Http::response(['serverTitle' => 'Acme Jira', 'version' => implode('.', $versionNumbers), 'versionNumbers' => $versionNumbers]);
        },
        'jira.example.com/*' => Http::response([]),
    ]);
    $team = Team::factory()->create();
    $admin = p14cAdmin($team);

    $page = $this->signIn($admin, p14cIntegrationsPath($team));

    $page->assertVisible('button:has-text("Older Jira server")')
        ->click('button:has-text("Older Jira server")')
        ->fill('[role="dialog"] input[type="password"]', 'pasted-jira-token-abcdefghijklmnop')
        ->click('[role="dialog"] label:has-text("I understand") button[role="checkbox"]')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertSee("Jira didn't accept this token.");

    $myselfStatus = 200;
    $versionNumbers = [8, 13, 5];

    $page->click('[role="dialog"] button[type="submit"]')
        ->assertSee('Personal access tokens need Jira 8.14 or later.')
        ->click('[role="dialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Not connected');

    expect(TeamIntegration::query()->count())->toBe(0);
});

it('[P14c-06] asks for a new token once Jira answers that the token was revoked', function () {
    p14cEnable(IntegrationProvider::JiraDataCenter);
    Http::fake([
        jiraDataCenterUrl('rest/api/2/myself') => Http::response(['message' => 'Unauthorized'], 401),
        'jira.example.com/*' => Http::response([]),
    ]);
    $team = Team::factory()->create();
    $admin = p14cAdmin($team);
    $integration = TeamIntegration::factory()
        ->jiraDataCenter(IntegrationAccess::Write, 'pat')
        ->create(['team_id' => $team->id]);

    $page = $this->signIn($admin, p14cIntegrationsPath($team));

    $page->assertSee('Acting as Jane Doe in Jira')
        ->assertSee('Test the connection')
        ->click('Test the connection')
        ->assertSee('Reconnect required')
        ->assertSee('The Jira personal access token was revoked or has expired. Paste a new one.')
        ->assertSee('Replace token')
        ->assertDontSee('Test the connection');

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});
```

`[P14c-01]` replaces the first walkthrough item ("connect a Jira DC test server with OAuth (read, then read and write)"): the test cannot follow the redirect to Jira, so it checks the two connect links and the card of a read-only OAuth connection arranged with the factory. The OAuth round trip is the residual row `P14c-01b`.

- [ ] **Step 3: Run the connection tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14cTrackersTest.php --filter='P14c-01|P14c-05a|P14c-05b|P14c-06'`
Expected: PASS (4 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If a page shows a server error after `Http::preventStrayRequests()`, the failure message names the request that was not faked: add it to the test's `Http::fake()` list. If this fails for another reason, see the harness findings.

- [ ] **Step 4: Append the Jira Data Center import, estimate and export tests**

Add these imports to the `use` block of `tests/Browser/Walkthroughs/Plan14cTrackersTest.php`, in alphabetical order:

```php
use App\Enums\ActionItemPriority;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationUserMapping;
use App\Models\PokerTask;
use Database\Factories\TeamIntegrationFactory;
```

Append to the file:

```php
it('[P14c-02] imports the issues of a Jira Data Center sprint into a poker game', function () {
    $table = p14cTable(IntegrationProvider::JiraDataCenter);
    p14cFakeJiraDataCenter();

    $page = $this->awaitRealtime($this->signIn($table['facilitator'], "/poker/{$table['game']->id}"));

    $page->assertVisible('button:has-text("Import")')
        ->click('button:has-text("Import")')
        ->assertVisible('[aria-label="Import from Jira Data Center"]')
        ->click('[aria-label="Choose a board"]')
        ->click('[role="option"]:has-text("Team board")')
        ->assertNotPresent('[role="listbox"]')
        ->assertEnabled('[aria-label="Choose a sprint"]')
        ->click('[aria-label="Choose a sprint"]')
        ->click('[role="option"]:has-text("Sprint 31")')
        ->assertNotPresent('[role="listbox"]')
        ->click('Show issues')
        ->assertSee('Story PROJ-1')
        ->assertSee('Story PROJ-2')
        ->assertSee('Jane Doe')
        ->click('button:has-text("Import 2 tasks")')
        ->assertSee('2 imported, 0 skipped.')
        ->assertNotPresent('[role="dialog"]')
        ->assertCount('@poker-task-row', 2)
        ->assertSeeIn('[data-test="poker-task-row"]:has-text("Story PROJ-1")', 'PROJ-1')
        ->assertSeeIn('[data-test="poker-task-row"]:has-text("Story PROJ-2")', 'PROJ-2');

    $tasks = PokerTask::query()->where('poker_game_id', $table['game']->id)->orderBy('position')->get();

    expect($tasks->pluck('external_key')->all())->toBe(['PROJ-1', 'PROJ-2'])
        ->and($tasks->pluck('external_source')->unique()->all())->toBe(['jira_dc'])
        ->and($tasks->first()->description)->toBe("**Bold** intro\n- first\n- second")
        ->and($tasks->first()->external_estimate)->toBe('5');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://jira.example.com/rest/api/2/search'
        && $request['jql'] === 'sprint = 31 ORDER BY Rank ASC'
        && $request->hasHeader('Authorization', 'Bearer jira-dc-access'));
});

it('[P14c-03] writes the saved estimate to the story points field of the Jira Data Center issue', function () {
    $table = p14cTable(IntegrationProvider::JiraDataCenter);
    p14cFakeJiraDataCenter();
    $task = importedPokerTask($table['game'], [
        'external_id' => '10001',
        'external_key' => 'PROJ-1',
        'external_url' => 'https://jira.example.com/browse/PROJ-1',
        'title' => 'Story PROJ-1',
    ], IntegrationProvider::JiraDataCenter);
    openPokerRound($table['game'], $task);

    $page = $this->awaitRealtime($this->signIn($table['facilitator'], "/poker/{$table['game']->id}"));

    $page->assertEnabled('[aria-label="Play 5"]')
        ->click('[aria-label="Play 5"]')
        ->assertButtonEnabled('Show votes')
        ->click('Show votes')
        ->assertVisible('[aria-label="Estimate"]')
        ->assertSeeIn('[aria-label="Estimate"]', '5')
        ->click('Save estimate')
        ->assertSee('Estimate: 5')
        ->assertSee('Sync pending');

    while (p14cDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertSee('Synced to Jira Data Center')
        ->assertDontSee('Sync pending');

    Http::assertSent(fn (Request $request) => $request->method() === 'PUT'
        && $request->url() === 'https://jira.example.com/rest/api/2/issue/10001'
        && $request['fields']['customfield_10002'] == 5
        && $request->hasHeader('Authorization', 'Bearer jira-dc-access'));

    expect($task->fresh()->synced_at)->not->toBeNull()
        ->and($task->fresh()->needs_sync)->toBeFalse();
});

it('[P14c-04] exports an action item to Jira Data Center with the mapped assignee and the priority', function () {
    p14cEnable(IntegrationProvider::JiraDataCenter);
    p14cFakeJiraDataCenter();
    [$retro, $ada, $item] = p14cBoardItem(['priority' => ActionItemPriority::High]);
    $integration = TeamIntegration::factory()->jiraDataCenter()->create(['team_id' => $retro->team_id]);
    $bob = teamMember($retro->team);
    $bob->forceFill(['name' => 'Bob Dev', 'locale' => 'en'])->save();
    IntegrationUserMapping::factory()->manual()->create([
        'team_integration_id' => $integration->id,
        'user_id' => $bob->id,
        'external_account_id' => 'jdoe',
        'external_display_name' => 'Jane Doe',
    ]);
    $item->update(['assignee_user_id' => $bob->id]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertVisible("{$card} [aria-label=\"Export to Jira Data Center\"]")
        ->click("{$card} [aria-label=\"Export to Jira Data Center\"]")
        ->assertSeeIn('[role="dialog"] [aria-label="Project"]', 'API platform')
        ->assertSeeIn('[role="dialog"] [aria-label="Issue type"]', 'Task')
        ->assertSee('Assignee: Jane Doe (Jira Data Center)')
        ->assertSee('Priority: High')
        ->click('[role="dialog"] button:has-text("Export")')
        ->assertSee('Exported as PROJ-42.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($card, 'PROJ-42')
        ->assertAttribute("{$card} a[href=\"https://jira.example.com/browse/PROJ-42\"]", 'target', '_blank')
        ->assertNotPresent("{$card} [aria-label=\"Export to Jira Data Center\"]");

    Http::assertSent(function (Request $request): bool {
        if ($request->method() !== 'POST' || $request->url() !== 'https://jira.example.com/rest/api/2/issue') {
            return false;
        }

        $fields = $request['fields'];

        return $fields['project'] === ['id' => '10000']
            && $fields['summary'] === 'Speed up CI'
            && $fields['priority'] === ['id' => '2']
            && $fields['assignee'] === ['name' => 'jdoe'];
    });
    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://jira.example.com/rest/api/2/issue/createmeta/10000/issuetypes/11'));

    $link = ActionItemExternalLink::query()->sole();

    expect($link->external_key)->toBe('PROJ-42')
        ->and($link->source)->toBe(IntegrationProvider::JiraDataCenter)
        ->and($link->action_item_id)->toBe($item->id);
});

it('[P14c-05c] creates the exported issue with the personal access token, so Jira records its owner as the author', function () {
    p14cEnable(IntegrationProvider::JiraDataCenter);
    p14cFakeJiraDataCenter();
    [$retro, $ada, $item] = p14cBoardItem();
    TeamIntegration::factory()
        ->jiraDataCenter(IntegrationAccess::Write, 'pat')
        ->create(['team_id' => $retro->team_id]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertVisible("{$card} [aria-label=\"Export to Jira Data Center\"]")
        ->click("{$card} [aria-label=\"Export to Jira Data Center\"]")
        ->assertSeeIn('[role="dialog"] [aria-label="Issue type"]', 'Task')
        ->assertSee('Unassigned')
        ->click('[role="dialog"] button:has-text("Export")')
        ->assertSee('Exported as PROJ-42.')
        ->assertSeeIn($card, 'PROJ-42');

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && $request->url() === 'https://jira.example.com/rest/api/2/issue'
        && $request->hasHeader('Authorization', 'Bearer '.TeamIntegrationFactory::JiraDataCenterToken));
    Http::assertNotSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer jira-dc-access'));
});
```

`[P14c-05c]` replaces "exported issue created as the token owner": who Jira shows as the reporter is decided by Jira from the credential, so the test asserts that every call of the export carries the personal access token and none carries an OAuth token.

- [ ] **Step 5: Run the Jira Data Center tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14cTrackersTest.php --filter='P14c-02|P14c-03|P14c-04|P14c-05c'`
Expected: PASS (4 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If the option "Team board" never appears after the board select was opened, or if "Synced to Jira Data Center" never replaces "Sync pending" after the queue loop, see the harness findings.

- [ ] **Step 6: Append the GitHub tests**

Add these imports to the `use` block, in alphabetical order:

```php
use App\Enums\IntegrationUserMatch;
use App\Models\PokerRound;
use App\Models\SocialAccount;
```

Append to the file:

```php
it('[P14c-07] links the GitHub card to the App installation and shows the connected account', function () {
    p14cEnable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi();
    Http::fake(['api.github.com/*' => Http::response([])]);
    $team = Team::factory()->create();
    $admin = p14cAdmin($team);
    $path = p14cIntegrationsPath($team);

    $page = $this->signIn($admin, $path);

    $page->assertSee('GitHub')
        ->assertSee('Not connected')
        ->assertAttributeContains('a:has-text("Install the GitHub App")', 'href', '/integrations/github/connect');

    TeamIntegration::factory()->gitHub()->create(['team_id' => $team->id]);

    $page->navigate($path)
        ->assertSee('GitHub account')
        ->assertAttribute('a:has-text("acme")', 'href', 'https://github.com/organizations/acme/settings/installations/4242')
        ->assertSee('Read and write')
        ->assertAttributeContains('a:has-text("Manage the installation")', 'href', '/integrations/github/connect')
        ->assertSee('Test the connection')
        ->assertDontSee('Not connected');
});

it('[P14c-08] imports the open issues of a GitHub milestone into a poker game', function () {
    $table = p14cTable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/repos/acme/api/milestones*' => Http::response([
            ['number' => 2, 'title' => 'Sprint 2', 'due_on' => now()->addDays(5)->toIso8601ZuluString()],
        ]),
    ]);
    Http::fake(['api.github.com/*' => Http::response([])]);

    $page = $this->awaitRealtime($this->signIn($table['facilitator'], "/poker/{$table['game']->id}"));

    $page->assertVisible('button:has-text("Import")')
        ->click('button:has-text("Import")')
        ->assertVisible('[aria-label="Import from GitHub"]')
        ->click('[aria-label="Choose a repository"]')
        ->click('[role="option"]:has-text("acme/api")')
        ->assertNotPresent('[role="listbox"]')
        ->assertEnabled('[aria-label="Choose a milestone"]')
        ->click('[aria-label="Choose a milestone"]')
        ->click('[role="option"]:has-text("Sprint 2")')
        ->assertNotPresent('[role="listbox"]')
        ->click('Show issues')
        ->assertSee('acme/api#1')
        ->assertSee('acme/api#2')
        ->assertDontSee('acme/api#5')
        ->click('button:has-text("Import 2 tasks")')
        ->assertSee('2 imported, 0 skipped.')
        ->assertNotPresent('[role="dialog"]')
        ->assertCount('@poker-task-row', 2)
        ->assertSeeIn('[data-test="poker-task-row"]:has-text("Issue 1")', 'acme/api#1')
        ->assertSeeIn('[data-test="poker-task-row"]:has-text("Issue 2")', 'acme/api#2');

    expect(PokerTask::query()->where('poker_game_id', $table['game']->id)->orderBy('position')->pluck('external_id')->all())
        ->toBe(['9001/1', '9001/2']);

    Http::assertSent(fn (Request $request) => str_starts_with($request->url(), 'https://api.github.com/repos/acme/api/issues?')
        && $request['milestone'] === '2'
        && $request['state'] === 'open');
});

it('[P14c-09a] writes the estimate of a Fibonacci game as one block at the end of the GitHub issue body', function () {
    $table = p14cTable(IntegrationProvider::GitHub);
    $body = "Steps to reproduce\n\n1. Open the cart";
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => $body])),
        'api.github.com/repos/acme/api/issues/7' => fn (Request $request) => Http::response(gitHubIssue(7, ['body' => $request['body']])),
    ]);
    $task = importedPokerTask($table['game'], [
        'external_id' => '9001/7',
        'external_key' => 'acme/api#7',
        'external_url' => 'https://github.com/acme/api/issues/7',
        'title' => 'Checkout bug',
    ], IntegrationProvider::GitHub);
    openPokerRound($table['game'], $task);

    $page = $this->awaitRealtime($this->signIn($table['facilitator'], "/poker/{$table['game']->id}"));

    $page->assertEnabled('[aria-label="Play 5"]')
        ->click('[aria-label="Play 5"]')
        ->assertButtonEnabled('Show votes')
        ->click('Show votes')
        ->assertSeeIn('[aria-label="Estimate"]', '5')
        ->click('Save estimate')
        ->assertSee('Estimate: 5')
        ->assertSee('Sync pending');

    while (p14cDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertSee('Synced to GitHub')
        ->assertAttribute('[data-slot="badge"]:has-text("Synced to GitHub")', 'title', 'Written to the issue description.');

    $patches = p14cGitHubPatches();

    expect($patches)->toHaveCount(1)
        ->and($patches[0]->url())->toBe('https://api.github.com/repos/acme/api/issues/7')
        ->and($patches[0]['body'])->toBe("{$body}\n\n".renderedEstimateBlock('5'))
        ->and(substr_count($patches[0]['body'], '<!-- skrum:estimate -->'))->toBe(1);
});

it('[P14c-09b] writes the estimate of a T-shirt game as text into the GitHub issue body', function () {
    $table = p14cTable(IntegrationProvider::GitHub, PokerDeck::Tshirt);
    $body = 'Size this before the sprint';
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => $body])),
        'api.github.com/repos/acme/api/issues/7' => fn (Request $request) => Http::response(gitHubIssue(7, ['body' => $request['body']])),
    ]);
    $task = importedPokerTask($table['game'], [
        'external_id' => '9001/7',
        'external_key' => 'acme/api#7',
        'external_url' => 'https://github.com/acme/api/issues/7',
        'title' => 'Checkout bug',
    ], IntegrationProvider::GitHub);
    openPokerRound($table['game'], $task);

    $page = $this->awaitRealtime($this->signIn($table['facilitator'], "/poker/{$table['game']->id}"));

    $page->assertEnabled('[aria-label="Play XL"]')
        ->click('[aria-label="Play XL"]')
        ->assertButtonEnabled('Show votes')
        ->click('Show votes')
        ->assertSeeIn('[aria-label="Estimate"]', 'XL')
        ->click('Save estimate')
        ->assertSee('Estimate: XL')
        ->assertSee('Sync pending');

    while (p14cDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertSee('Synced to GitHub');

    $patches = p14cGitHubPatches();

    expect($patches)->toHaveCount(1)
        ->and($patches[0]['body'])->toBe("{$body}\n\n".renderedEstimateBlock('XL'))
        ->and(substr_count($patches[0]['body'], '<!-- skrum:estimate -->'))->toBe(1);
});

it('[P14c-10] updates the block in place and keeps the text written around it on GitHub', function () {
    $table = p14cTable(IntegrationProvider::GitHub);
    $body = "Intro edited on GitHub\n\n".renderedEstimateBlock('3')."\n\nNotes added below the block";
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/7' => Http::response(gitHubIssue(7, ['body' => $body])),
        'api.github.com/repos/acme/api/issues/7' => fn (Request $request) => Http::response(gitHubIssue(7, ['body' => $request['body']])),
    ]);
    $task = importedPokerTask($table['game'], [
        'external_id' => '9001/7',
        'external_key' => 'acme/api#7',
        'external_url' => 'https://github.com/acme/api/issues/7',
        'title' => 'Checkout bug',
        'estimate' => '3',
        'estimate_numeric' => 3,
        'estimated_at' => now()->subHour(),
        'synced_at' => now()->subHour(),
        'external_estimate' => '3',
    ], IntegrationProvider::GitHub);
    $round = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);
    pokerVote($round, $table['facilitatorPlayer'], '13');
    $table['game']->forceFill(['current_task_id' => $task->id])->save();

    $page = $this->awaitRealtime($this->signIn($table['facilitator'], "/poker/{$table['game']->id}"));

    $page->assertSee('Estimate: 3')
        ->assertVisible('[aria-label="Estimate"]')
        ->click('[aria-label="Estimate"]')
        ->click('[role="option"]:has-text("13")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('[aria-label="Estimate"]', '13')
        ->click('Save estimate')
        ->assertSee('Estimate: 13')
        ->assertSee('Sync pending');

    while (p14cDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertSee('Synced to GitHub')
        ->assertDontSee('Sync pending');

    $patches = p14cGitHubPatches();

    expect($patches)->toHaveCount(1)
        ->and($patches[0]['body'])->toBe("Intro edited on GitHub\n\n".renderedEstimateBlock('13')."\n\nNotes added below the block")
        ->and(substr_count($patches[0]['body'], '<!-- skrum:estimate -->'))->toBe(1);
});

it('[P14c-12] exports an action item to GitHub for a member linked by GitHub sign-in, with the priority label', function () {
    p14cEnable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/user/583231' => Http::response(['id' => 583231, 'login' => 'octocat', 'type' => 'User']),
        'api.github.com/repos/acme/api/labels/*' => Http::response(['name' => 'priority: high']),
        'api.github.com/repos/acme/api/issues' => Http::response([
            'number' => 12,
            'html_url' => 'https://github.com/acme/api/issues/12',
            'assignees' => [['login' => 'octocat']],
        ], 201),
    ]);
    Http::fake(['api.github.com/*' => Http::response([])]);
    [$retro, $ada, $item] = p14cBoardItem(['priority' => ActionItemPriority::High]);
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $retro->team_id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'priorityLabels' => ['high' => 'priority: high']]])->save();
    $bob = teamMember($retro->team);
    $bob->forceFill(['name' => 'Bob Dev', 'locale' => 'en'])->save();
    SocialAccount::factory()->create(['user_id' => $bob->id, 'provider' => 'github', 'provider_user_id' => '583231']);
    $item->update(['assignee_user_id' => $bob->id]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertVisible("{$card} [aria-label=\"Export to GitHub\"]")
        ->click("{$card} [aria-label=\"Export to GitHub\"]")
        ->assertSeeIn('[role="dialog"] [aria-label="Repository"]', 'acme/api')
        ->assertSee("Assignee: not mapped yet — skrum will use Bob Dev's GitHub sign-in")
        ->assertSee('Priority label: priority: high')
        ->click('[role="dialog"] button:has-text("Export")')
        ->assertSee('Exported as acme/api#12.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($card, 'acme/api#12')
        ->assertAttribute("{$card} a[href=\"https://github.com/acme/api/issues/12\"]", 'target', '_blank');

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && $request->url() === 'https://api.github.com/repos/acme/api/issues'
        && $request['title'] === 'Speed up CI'
        && $request['assignees'] === ['octocat']
        && $request['labels'] === ['priority: high']);

    $mapping = $integration->userMappings()->sole();

    expect($mapping->user_id)->toBe($bob->id)
        ->and($mapping->matched_by)->toBe(IntegrationUserMatch::Sso)
        ->and($mapping->external_account_id)->toBe('583231')
        ->and(ActionItemExternalLink::query()->sole()->external_id)->toBe('9001/12');
});

it('[P14c-13] asks to reconnect once GitHub answers that the App was uninstalled', function () {
    p14cEnable(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/app/installations/4242' => Http::response(['message' => 'Not Found'], 404),
    ]);
    Http::fake(['api.github.com/*' => Http::response([])]);
    $team = Team::factory()->create();
    $admin = p14cAdmin($team);
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $team->id]);

    $page = $this->signIn($admin, p14cIntegrationsPath($team));

    $page->assertSee('GitHub account')
        ->assertSee('Test the connection')
        ->click('Test the connection')
        ->assertSee('Reconnect required')
        ->assertSee('The GitHub App was uninstalled from acme.')
        ->assertVisible('a:has-text("Manage the installation")')
        ->assertDontSee('Test the connection');

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
});
```

Notes on these tests:

- `[P14c-07]` replaces "install the GitHub App on a test org": the installation happens on github.com, so the test checks the install link and the card of a connection arranged with the factory. The installation itself is the residual row `P14c-07b`.
- `[P14c-09a]`, `[P14c-09b]` and `[P14c-10]` replace "see one block in the issue body" and "edit the body around the block in GitHub": the body GitHub holds is the faked answer of `GET /repositories/9001/issues/7`, and what skrum writes is the body of the one `PATCH` request.
- `[P14c-10]` uses the card `13` because the estimate select lists the Fibonacci deck, where `:has-text("13")` matches one option only (`8` would also match `89`).
- `[P14c-13]` replaces "uninstall the app": the uninstallation is the faked 404 of `GET /app/installations/4242`, found when the administrator tests the connection. The same state reached through GitHub's `installation` webhook is `[P14d-12]` (Task 11).

- [ ] **Step 7: Run the GitHub tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14cTrackersTest.php --filter='P14c-07|P14c-08|P14c-09|P14c-10|P14c-12|P14c-13'`
Expected: PASS (7 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If this fails for another reason, see the harness findings.

- [ ] **Step 8: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code of this file, run `composer rector` and keep its result.

- [ ] **Step 9: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14cTrackersTest.php`
Expected: PASS (15 tests).

- [ ] **Step 10: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan14cTrackersTest.php
git commit -m "test(browser): cover the plan 14c walkthrough: Jira Data Center and GitHub Issues trackers"
```

---

### Task 11: Plan 14d walkthrough (two-way status sync)

This task automates the walkthrough of plan 14d (`docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md`, line 8524, one paragraph), split into 13 items. Each provider is replaced by two fakes: `Http::fake()` answers what skrum asks the provider, and the test process posts the webhook the provider would send, with a valid signature or URL token. Real tenants, a public `APP_URL` and the "within seconds" timing are residual.

Facts the tests rely on (all read from the current code):

- **Enabling inbound webhooks.** `phpunit.xml` sets `INTEGRATIONS_INBOUND_WEBHOOKS=off` and leaves `LINEAR_WEBHOOK_SECRET` and `GITHUB_APP_WEBHOOK_SECRET` empty, so `EnsureInboundWebhooks` answers 404. The code reads `config('services.integrations.inbound_webhooks')` (`InboundReachability::mode()`), `config('services.linear.webhook_secret')` and `config('services.github_app.webhook_secret')` (`InboundModes::acceptsWebhooks()`). The file helper `p14dEnable()` sets them to `on`, `linear-webhook-secret` and `github-webhook-secret`, and it runs before anything else in every test, because `InboundModes` reads the mode once per instance.
- **Signing.** `App\Support\Integrations\Inbound\ReadInboundEvent` verifies: GitHub, `X-Hub-Signature-256: sha256=` + HMAC-SHA256 of the raw body with the GitHub secret; Linear, `Linear-Signature` = HMAC-SHA256 of the raw body with the Linear secret, and `webhookTimestamp` within 60 seconds of now; Jira Cloud, the 40-character token of the URL `integrations/webhooks/jira/{integration}/{token}` compared with `credentials.webhookToken`; Jira Data Center, the URL token and, when sent, `X-Hub-Signature: sha256=` + HMAC of the raw body with `credentials.webhookSecret`. The signature is computed on the exact bytes posted, so the helper `p14dPostWebhook()` sends a raw body with `test()->call('POST', …)`, as `tests/Feature/Integrations/InboundWebhooksTest.php` does. This is a plain test request without a user: it is not `actingAs()`.
- **Duplicates.** A delivery is identified by `X-GitHub-Delivery`, `Linear-Delivery` or `X-Atlassian-Webhook-Identifier`; a second post with the same identifier answers 200 and queues nothing. Each event of a test therefore has its own identifier.
- **Webhooks are hints.** The controller queues `App\Jobs\Integrations\ApplyInboundIssueChanges`, which reads the issue again from the provider. The tests fake that read: Jira Cloud `POST /rest/api/3/search/jql`, Jira Data Center `POST /rest/api/2/search`, Linear a GraphQL query containing `issues(`, GitHub `POST /graphql` (helper `gitHubGraphqlIssues()` of `tests/Pest.php`).
- **Queue.** Pushes (`PushActionItemState`), reads (`ReadTrackedIssues`, `ApplyInboundIssueChanges`), registrations (`RegisterTrackerWebhooks`) and estimate write-backs (`SyncTaskEstimate`) are queued jobs that broadcast with `sendToOthers()`. The tests set `config(['queue.default' => 'database'])` (in `p14dEnable()`) and run the jobs with `$this->workQueue()` in a loop over the due jobs, because one action can queue several jobs (turning sync on queues a registration and a first read; a conflict won by skrum queues a push from inside a read).
- **Board.** An exported item shows a chip with the issue key (`resources/js/components/action-items/external-link-chips.tsx`). With sync on, the chip carries a screen-reader text: "Sync pending", ":status in :source" (for example "Done in Jira"), "Sync failed" or "Not found in :source". The text is in a `sr-only` span, so the tests read it with `assertScript()` on the item's `textContent` (helper `p14dCardSays()`). The completion checkbox is `[aria-label="Mark as done"]` on an open item and `[aria-label="Reopen"]` on a completed one.
- **"Completed in :source" needs a reload.** Broadcast payloads are presented without a viewer, so they carry `completedVia: null` (`PresentActionItem`, plan-writing ruling "completedVia hidden from guests") and `upsertActionItem()` keeps what the page already knew. An item completed from the source therefore shows as completed at once on an open board, and shows "Completed in Jira" after the page is loaded again. The tests assert the live completion first, then `navigate()` and assert the label.
- **Status sync section** (`status-sync-section.tsx`): the switch is the checkbox of the label "Sync status"; turning it on opens a dialog "Turn on status sync with :provider?" with the button "Turn on status sync". The mode line is "Live updates (webhooks)" (webhook mode, status `active`), "Setting up live updates…" (webhook mode, status `pending`), "Webhooks aren't reaching skrum; checking every :n minutes." (status `failing`) or "Checking every :n minutes." (everything else). "Treat canceled as done" is shown for Linear and GitHub and is on by default (`DoneMapping`). The mapping panel (`status-mapping-panel.tsx`) lists the Jira projects of tracked issues; "Edit mapping" loads the statuses and shows the selects `[aria-label="Complete to"]` and `[aria-label="Reopen to"]`.
- **Jira Data Center registration.** `TrackerWebhooks::registerDataCenter()` asks `GET /rest/api/2/mypermissions?permissions=ADMINISTER`; with `havePermission: true` it posts `POST /rest/webhooks/1.0/webhook`; otherwise it posts nothing, sets `settings.webhookManual` and the card shows the manual panel (`jira-data-center-webhook-panel.tsx`) with "Show webhook details" and "I've registered it". The non-administrator case is therefore a faked `havePermission: false`, not a 403 on the registration call.
- **Poker.** A member's page fetches the snapshot again on `task.saved` of an imported task (`use-poker-game.ts`), so the status and the conflict badge appear live. The current task's detail (`task-source-details.tsx`) shows ":status in :source" with the tracker's own status name ("In Progress in Jira"), "Done in :source", and the badge "Changed in :source to :value" with "Keep skrum estimate" and "Use :source estimate".
- **Polling.** `php artisan skrum:poll-integrations` queues `ReadTrackedIssues` for a connection whose `last_polled_at` is older than `config('services.integrations.poll_minutes')` minutes; the read asks Jira for `id in (…) AND updated >= "-Nm"`.
- **Time.** The two conflict tests freeze the clock with `$this->travelTo(now()->startOfMinute()->addSeconds(40))` before anything else, then place the two changes at seconds 10 and 30 of that minute. The date is relative on purpose: travelling to a fixed date in the past would give the session cookie an expiry the real browser has already passed.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php`
- Test: `tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn(User $user, string $to): mixed` and `$this->awaitRealtime(mixed $page): mixed` (plan 16a).
  - `$this->workQueue(): void` from `Tests\Browser\Support\InteractsWithBrowser` (plan 16b Task 1).
  - `data-realtime` on `retros/show` and `poker/show` (plan 16a Task 3); `data-test="poker-task-row"` (plan 16a Task 10). The tests do not open the workspace action-items page, so they do not need `data-realtime` on `action-items/index` (plan 16b Task 6).
  - Helpers of `tests/Pest.php`: `enableIntegrations()`, `disableIntegrations()`, `retroFacilitator()`, `trackerTable()`, `importedPokerTask()`, `openPokerRound()`, `jiraApiUrl()`, `jiraDataCenterUrl()`, `jiraTrackerIssue()`, `jiraTransition()`, `fakeJiraTransitions()`, `fakeLinearGraphql()`, `linearTrackerIssue()`, `fakeGitHubTrackerApi()`, `gitHubIssue()`, `gitHubGraphqlIssues()`.
- Produces:
  - No product change and no new `data-test` hook.
  - File-level constants `P14dWebhookToken` and `P14dWebhookSecret`, and helpers in `tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php` (global; other files must not redeclare them): `p14dEnable(IntegrationProvider ...$providers): void`, `p14dDueJobs(): int`, `p14dTurnSyncOn(TeamIntegration $integration, IntegrationInboundMode $mode = IntegrationInboundMode::Webhook): TeamIntegration`, `p14dLinkAttributes(IntegrationProvider $provider): array`, `p14dSyncedItem(IntegrationProvider $provider, array $itemAttributes = [], array $linkAttributes = [], ?IntegrationInboundMode $mode = IntegrationInboundMode::Webhook): array`, `p14dPokerTask(array $taskAttributes = []): array`, `p14dIntegrationsPath(Retro $retro): string`, `p14dCardSays(ActionItem $item, string $text): string`, `p14dSentCount(string $method, string $urlFragment): int`, `p14dJiraFields(string $status = 'new', ?CarbonInterface $updatedAt = null): array`, `p14dJiraIssue(string $status = 'new', ?CarbonInterface $updatedAt = null, array $fields = []): array`, `p14dJiraDataCenterIssue(string $status = 'new'): array`, `p14dLinearIssue(string $type): array`, `p14dPostWebhook(string $url, string $body, array $headers = []): TestResponse`, `p14dJiraEvent(TeamIntegration $integration, string $delivery, string $source = 'jira', string $token = P14dWebhookToken, ?string $secret = null): TestResponse`, `p14dLinearEvent(string $delivery): TestResponse`, `p14dGitHubEvent(string $event, array $payload, string $delivery): TestResponse`.

- [ ] **Step 1: Create the test file with its helpers and the Jira Cloud tests in both directions**

Create `tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php` directly with this content:

```php
<?php

use App\Enums\ExternalIssueState;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationWebhookStatus;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use Carbon\CarbonInterface;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

const P14dWebhookToken = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd';

const P14dWebhookSecret = 'dc-webhook-secret';

function p14dEnable(IntegrationProvider ...$providers): void
{
    disableIntegrations();
    enableIntegrations(...$providers);

    config([
        'queue.default' => 'database',
        'services.integrations.inbound_webhooks' => 'on',
        'services.integrations.poll_minutes' => 5,
        'services.linear.webhook_secret' => 'linear-webhook-secret',
        'services.github_app.webhook_secret' => 'github-webhook-secret',
    ]);

    Http::preventStrayRequests();
}

function p14dDueJobs(): int
{
    return DB::table('jobs')
        ->whereNull('reserved_at')
        ->where('available_at', '<=', now()->getTimestamp())
        ->count();
}

function p14dTurnSyncOn(TeamIntegration $integration, IntegrationInboundMode $mode = IntegrationInboundMode::Webhook): TeamIntegration
{
    $listens = $mode === IntegrationInboundMode::Webhook;
    $registration = match ($integration->provider) {
        IntegrationProvider::Jira => ['webhookIds' => ['7001'], 'webhookProjects' => ['PROJ']],
        IntegrationProvider::JiraDataCenter => ['webhookIds' => ['12'], 'webhookProjects' => ['OPS']],
        default => [],
    };

    $integration->forceFill([
        'settings' => [
            ...$integration->settings,
            'statusSync' => true,
            'statusSyncSince' => now()->toIso8601String(),
            ...($listens ? $registration : []),
        ],
        'credentials' => [
            ...(array) $integration->readableCredentials(),
            'webhookToken' => P14dWebhookToken,
            'webhookSecret' => P14dWebhookSecret,
        ],
        'inbound_mode' => $mode,
        'webhook_status' => $listens ? IntegrationWebhookStatus::Active : null,
        'webhook_expires_at' => $listens && $integration->provider === IntegrationProvider::Jira ? now()->addDays(20) : null,
        'last_polled_at' => now(),
        'poll_cursor' => now(),
    ])->save();

    return $integration;
}

/**
 * @return array<string, mixed>
 */
function p14dLinkAttributes(IntegrationProvider $provider): array
{
    return match ($provider) {
        IntegrationProvider::Linear => [
            'source' => IntegrationProvider::Linear,
            'external_site' => 'org-1',
            'external_id' => 'lin-1',
            'external_key' => 'ENG-1',
            'external_url' => 'https://linear.app/acme/issue/ENG-1',
        ],
        IntegrationProvider::JiraDataCenter => [
            'source' => IntegrationProvider::JiraDataCenter,
            'external_site' => JiraDataCenterServer::key(TeamIntegrationFactory::JiraDataCenterUrl),
            'external_id' => '10001',
            'external_key' => 'OPS-1',
            'external_url' => 'https://jira.example.com/browse/OPS-1',
        ],
        IntegrationProvider::GitHub => [
            'source' => IntegrationProvider::GitHub,
            'external_site' => TeamIntegrationFactory::GitHubInstallationId,
            'external_id' => '9001/3',
            'external_key' => 'acme/api#3',
            'external_url' => 'https://github.com/acme/api/issues/3',
        ],
        default => [
            'source' => IntegrationProvider::Jira,
            'external_site' => 'cloud-1',
            'external_id' => '10001',
            'external_key' => 'PROJ-1',
            'external_url' => 'https://acme.atlassian.net/browse/PROJ-1',
        ],
    };
}

/**
 * @param  array<string, mixed>  $itemAttributes
 * @param  array<string, mixed>  $linkAttributes
 * @return array{
 *     retro: Retro,
 *     ada: User,
 *     integration: TeamIntegration,
 *     item: ActionItem,
 *     link: ActionItemExternalLink
 * }
 */
function p14dSyncedItem(
    IntegrationProvider $provider,
    array $itemAttributes = [],
    array $linkAttributes = [],
    ?IntegrationInboundMode $mode = IntegrationInboundMode::Webhook,
): array {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['title' => 'Sprint 12']);
    [$ada, $participant] = retroFacilitator($retro);

    $ada->forceFill(['name' => 'Ada Admin', 'locale' => 'en'])->save();
    $retro->team->workspace->members()->updateExistingPivot($ada->id, ['role' => WorkspaceRole::Admin->value]);

    $factory = TeamIntegration::factory();
    $integration = (match ($provider) {
        IntegrationProvider::Linear => $factory->linear(),
        IntegrationProvider::JiraDataCenter => $factory->jiraDataCenter(IntegrationAccess::Write, 'pat'),
        IntegrationProvider::GitHub => $factory->gitHub(),
        default => $factory->jira(),
    })->create(['team_id' => $retro->team_id]);

    if ($mode !== null) {
        p14dTurnSyncOn($integration, $mode);
    }

    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $participant->id,
        'content' => 'Speed up CI',
        ...$itemAttributes,
    ]);

    $link = ActionItemExternalLink::factory()->create([
        'action_item_id' => $item->id,
        ...p14dLinkAttributes($provider),
    ]);

    $link->forceFill($linkAttributes)->save();

    return [
        'retro' => $retro,
        'ada' => $ada,
        'integration' => $integration,
        'item' => $item,
        'link' => $link,
    ];
}

/**
 * @param  array<string, mixed>  $taskAttributes
 * @return array{
 *     game: PokerGame,
 *     ada: User,
 *     integration: TeamIntegration,
 *     task: PokerTask
 * }
 */
function p14dPokerTask(array $taskAttributes = []): array
{
    $table = trackerTable(IntegrationProvider::Jira);

    $table['facilitator']->forceFill(['name' => 'Ada Facilitator', 'locale' => 'en'])->save();

    p14dTurnSyncOn($table['integration']);

    $task = importedPokerTask($table['game'], [
        'external_id' => '10001',
        'external_key' => 'PROJ-1',
        'external_url' => 'https://acme.atlassian.net/browse/PROJ-1',
        'title' => 'Checkout flow',
        ...$taskAttributes,
    ]);

    openPokerRound($table['game'], $task);

    return [
        'game' => $table['game'],
        'ada' => $table['facilitator'],
        'integration' => $table['integration'],
        'task' => $task,
    ];
}

function p14dIntegrationsPath(Retro $retro): string
{
    return route('teams.integrations.index', [$retro->team->workspace, $retro->team], false);
}

function p14dCardSays(ActionItem $item, string $text): string
{
    return "document.querySelector('#action-item-{$item->id}').textContent.includes(".json_encode($text).')';
}

function p14dSentCount(string $method, string $urlFragment): int
{
    return Http::recorded(fn (Request $request): bool => $request->method() === $method && str_contains($request->url(), $urlFragment))->count();
}

/**
 * @return array<string, mixed>
 */
function p14dJiraFields(string $status = 'new', ?CarbonInterface $updatedAt = null): array
{
    return [
        'status' => match ($status) {
            'done' => ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']],
            'closed' => ['id' => '10005', 'name' => 'Closed', 'statusCategory' => ['key' => 'done']],
            'indeterminate' => ['id' => '3', 'name' => 'In Progress', 'statusCategory' => ['key' => 'indeterminate']],
            default => ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']],
        },
        'project' => ['key' => 'PROJ'],
        'updated' => ($updatedAt ?? now())->toIso8601String(),
    ];
}

/**
 * @param  array<string, mixed>  $fields
 * @return array<string, mixed>
 */
function p14dJiraIssue(string $status = 'new', ?CarbonInterface $updatedAt = null, array $fields = []): array
{
    return jiraTrackerIssue('10001', 'PROJ-1', [...p14dJiraFields($status, $updatedAt), ...$fields]);
}

/**
 * @return array<string, mixed>
 */
function p14dJiraDataCenterIssue(string $status = 'new'): array
{
    return jiraTrackerIssue('10001', 'OPS-1', [
        ...p14dJiraFields($status),
        'description' => null,
        'project' => ['key' => 'OPS'],
    ]);
}

/**
 * @return array<string, mixed>
 */
function p14dLinearIssue(string $type): array
{
    $name = match ($type) {
        'completed' => 'Done',
        'canceled' => 'Canceled',
        default => 'Todo',
    };

    return linearTrackerIssue('lin-1', 'ENG-1', [
        'state' => ['id' => "st-{$type}", 'name' => $name, 'type' => $type],
        'team' => ['key' => 'ENG'],
        'updatedAt' => now()->toIso8601String(),
    ]);
}

/**
 * @param  array<string, string>  $headers
 */
function p14dPostWebhook(string $url, string $body, array $headers = []): TestResponse
{
    $server = ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'];

    foreach ($headers as $name => $value) {
        $server['HTTP_'.strtoupper(str_replace('-', '_', $name))] = $value;
    }

    return test()->call('POST', $url, [], [], [], $server, $body);
}

function p14dJiraEvent(
    TeamIntegration $integration,
    string $delivery,
    string $source = 'jira',
    string $token = P14dWebhookToken,
    ?string $secret = null,
): TestResponse {
    $body = json_encode(['webhookEvent' => 'jira:issue_updated', 'issue' => ['id' => '10001']], JSON_THROW_ON_ERROR);
    $url = route('integrations.webhooks.tracker.store', ['source' => $source, 'integration' => $integration->id, 'token' => $token], false);
    $headers = ['X-Atlassian-Webhook-Identifier' => $delivery];

    if ($secret !== null) {
        $headers['X-Hub-Signature'] = 'sha256='.hash_hmac('sha256', $body, $secret);
    }

    return p14dPostWebhook($url, $body, $headers);
}

function p14dLinearEvent(string $delivery): TestResponse
{
    $body = json_encode([
        'action' => 'update',
        'type' => 'Issue',
        'organizationId' => 'org-1',
        'data' => ['id' => 'lin-1'],
        'webhookTimestamp' => now()->getTimestampMs(),
    ], JSON_THROW_ON_ERROR);

    return p14dPostWebhook(route('integrations.webhooks.store', ['source' => 'linear'], false), $body, [
        'Linear-Delivery' => $delivery,
        'Linear-Signature' => hash_hmac('sha256', $body, 'linear-webhook-secret'),
    ]);
}

/**
 * @param  array<string, mixed>  $payload
 */
function p14dGitHubEvent(string $event, array $payload, string $delivery): TestResponse
{
    $body = json_encode(['installation' => ['id' => 4242], ...$payload], JSON_THROW_ON_ERROR);

    return p14dPostWebhook(route('integrations.webhooks.store', ['source' => 'github'], false), $body, [
        'X-GitHub-Event' => $event,
        'X-GitHub-Delivery' => $delivery,
        'X-Hub-Signature-256' => 'sha256='.hash_hmac('sha256', $body, 'github-webhook-secret'),
    ]);
}

it('[P14d-01a] turns status sync on for Jira after a confirmation and shows the webhook becoming live', function () {
    p14dEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration] = p14dSyncedItem(IntegrationProvider::Jira, mode: null);
    $integration->forceFill(['credentials' => [...(array) $integration->readableCredentials(), 'webhookToken' => P14dWebhookToken]])->save();
    Http::fake([
        jiraApiUrl('rest/api/3/webhook') => Http::response(['webhookRegistrationResult' => [['createdWebhookId' => 7001]]]),
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [p14dJiraIssue()], 'isLast' => true]),
        'api.atlassian.com/*' => Http::response([]),
    ]);
    $path = p14dIntegrationsPath($retro);
    $switch = 'label:has-text("Sync status") button[role="checkbox"]';

    $page = $this->signIn($ada, $path);

    $page->assertSee('Status sync')
        ->assertAttribute($switch, 'aria-checked', 'false')
        ->click($switch)
        ->assertSee('Turn on status sync with Jira?')
        ->assertSee('The first sync takes the state of every linked Jira issue: existing action items may be completed or reopened to match. After that, the most recent change wins.')
        ->click('[role="dialog"] button:has-text("Turn on status sync")')
        ->assertSee('Status sync is on.')
        ->assertAttribute($switch, 'aria-checked', 'true')
        ->assertSee('Checking every 5 minutes.');

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->navigate($path)
        ->assertSee('Setting up live updates…')
        ->assertSee('Last sync:');

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/webhook')
        && str_contains((string) $request['url'], "/integrations/webhooks/jira/{$integration->id}/".P14dWebhookToken)
        && $request['webhooks'] === [['events' => ['jira:issue_updated', 'jira:issue_deleted'], 'jqlFilter' => 'project in ("PROJ")']]);

    p14dJiraEvent($integration, 'delivery-1')->assertAccepted();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->navigate($path)
        ->assertSee('Live updates (webhooks)');

    expect($integration->fresh()->setting('statusSync'))->toBeTrue()
        ->and($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Active)
        ->and($integration->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Webhook);
});

it('[P14d-01b] asks to reconnect a Jira connection made without the webhook scope and keeps polling', function () {
    p14dEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration] = p14dSyncedItem(IntegrationProvider::Jira, mode: IntegrationInboundMode::Polling);
    $integration->forceFill(['scopes' => ['offline_access', 'read:jira-work', 'write:jira-work']])->save();
    Http::fake(['api.atlassian.com/*' => Http::response([])]);

    $page = $this->signIn($ada, p14dIntegrationsPath($retro));

    $page->assertSee('Status sync')
        ->assertAttribute('label:has-text("Sync status") button[role="checkbox"]', 'aria-checked', 'true')
        ->assertSee('Reconnect Jira to receive live updates.')
        ->assertSee('Checking every 5 minutes.')
        ->assertVisible('a:has-text("Reconnect")')
        ->assertDontSee('Live updates (webhooks)');
});

it('[P14d-02] completes the action item on the open board when its issue is closed in Jira', function () {
    p14dEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item] = p14dSyncedItem(IntegrationProvider::Jira);
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [p14dJiraIssue('done')], 'isLast' => true]),
        'api.atlassian.com/*' => Http::response([]),
    ]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->assertSeeIn($card, 'PROJ-1');

    p14dJiraEvent($integration, 'delivery-1')->assertAccepted();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertScript(p14dCardSays($item, 'Done in Jira'), true);

    $page->navigate("/retros/{$retro->id}")
        ->assertSeeIn($card, 'Completed in Jira');

    expect($item->fresh()->completed_at)->not->toBeNull()
        ->and($item->fresh()->completed_via_source)->toBe('jira')
        ->and(p14dSentCount('POST', '/transitions'))->toBe(0);
});

it('[P14d-03a] moves the Jira issue to Done when the action item is completed on the board', function () {
    p14dEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'item' => $item, 'link' => $link] = p14dSyncedItem(IntegrationProvider::Jira);
    fakeJiraTransitions(p14dJiraFields('new'), p14dJiraFields('done'), [
        jiraTransition('11', '3', 'In Progress', 'indeterminate'),
        jiraTransition('21', '10005', 'Closed', 'done'),
        jiraTransition('31', '10002', 'Done', 'done'),
    ]);
    Http::fake(['api.atlassian.com/*' => Http::response([])]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertScript(p14dCardSays($item, 'Sync pending'), true);

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertScript(p14dCardSays($item, 'Done in Jira'), true);

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/issue/10001/transitions')
        && $request->data() === ['transition' => ['id' => '31']]);

    expect(p14dSentCount('POST', '/transitions'))->toBe(1)
        ->and($link->fresh()->last_pushed_state)->toBe(ExternalIssueState::Done)
        ->and($link->fresh()->sync_error)->toBeNull();
});

it('[P14d-03b] fills the resolution that the Jira transition requires', function (array $allowedValues, string $expected) {
    p14dEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'item' => $item] = p14dSyncedItem(IntegrationProvider::Jira);
    fakeJiraTransitions(p14dJiraFields('new'), p14dJiraFields('done'), [
        jiraTransition('31', '10002', 'Done', 'done', [
            'resolution' => ['required' => true, 'hasDefaultValue' => false, 'allowedValues' => $allowedValues],
        ]),
    ]);
    Http::fake(['api.atlassian.com/*' => Http::response([])]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$card} [aria-label=\"Reopen\"]");

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertScript(p14dCardSays($item, 'Done in Jira'), true);

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/issue/10001/transitions')
        && $request->data() === ['transition' => ['id' => '31'], 'fields' => ['resolution' => ['name' => $expected]]]);
})->with([
    'Done when Jira offers it' => [[['name' => "Won't Do"], ['name' => 'Fixed'], ['name' => 'Done']], 'Done'],
    'Fixed otherwise' => [[['name' => "Won't Do"], ['name' => 'Fixed']], 'Fixed'],
]);

it('[P14d-04a] moves the Jira issue back to an open status when the action item is reopened on the board', function () {
    p14dEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'item' => $item, 'link' => $link] = p14dSyncedItem(
        IntegrationProvider::Jira,
        ['completed_at' => now()->subHour()],
        [
            'external_state' => ExternalIssueState::Done,
            'external_status_name' => 'Done',
            'last_pushed_state' => ExternalIssueState::Done,
            'last_pushed_at' => now()->subHour(),
        ],
    );
    fakeJiraTransitions(p14dJiraFields('done'), p14dJiraFields('new'), [
        jiraTransition('41', '3', 'In Progress', 'indeterminate'),
        jiraTransition('51', '10000', 'To Do', 'new'),
    ]);
    Http::fake(['api.atlassian.com/*' => Http::response([])]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertScript(p14dCardSays($item, 'Done in Jira'), true)
        ->click("{$card} [aria-label=\"Reopen\"]")
        ->assertPresent("{$card} [aria-label=\"Mark as done\"]");

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertScript(p14dCardSays($item, 'To Do in Jira'), true);

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/issue/10001/transitions')
        && $request->data() === ['transition' => ['id' => '51']]);

    expect($link->fresh()->last_pushed_state)->toBe(ExternalIssueState::Open);
});

it('[P14d-04b] reopens the action item on the open board when its issue is reopened in Jira', function () {
    p14dEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item] = p14dSyncedItem(
        IntegrationProvider::Jira,
        ['completed_at' => now()->subHour()],
        ['external_state' => ExternalIssueState::Done, 'external_status_name' => 'Done'],
    );
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [p14dJiraIssue('new')], 'isLast' => true]),
        'api.atlassian.com/*' => Http::response([]),
    ]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]");

    p14dJiraEvent($integration, 'delivery-1')->assertAccepted();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->assertScript(p14dCardSays($item, 'To Do in Jira'), true);

    expect($item->fresh()->completed_at)->toBeNull()
        ->and(p14dSentCount('POST', '/transitions'))->toBe(0);
});
```

Each test destructures only the keys of `p14dSyncedItem()` it uses. In `[P14d-01a]` the connection starts with sync off and with a known URL token (`TrackerWebhooks::ensureSecrets()` keeps an existing token), so the test can post the first event to the URL that skrum registered.

- [ ] **Step 2: Run the Jira Cloud tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php --filter='P14d-0[1-4]'`
Expected: PASS (8 tests: seven titles, `[P14d-03b]` runs twice). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If a webhook post answers 404, `p14dEnable()` did not run first in that test. If the board never shows the change after the queue loop, see the harness findings.

- [ ] **Step 3: Append the conflict and mapping tests**

Append to `tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php` (no new import):

```php
it('[P14d-05a] lets the Jira change win when it is the more recent of two opposite changes in the same minute', function () {
    $this->travelTo(now()->startOfMinute()->addSeconds(40));
    p14dEnable(IntegrationProvider::Jira);
    $reopenedAt = now()->toImmutable()->startOfMinute()->addSeconds(10);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item] = p14dSyncedItem(
        IntegrationProvider::Jira,
        [],
        [
            'local_state_changed_at' => $reopenedAt,
            'last_pushed_at' => $reopenedAt->subHour(),
            'last_pushed_state' => ExternalIssueState::Done,
            'external_state' => ExternalIssueState::Done,
            'external_status_name' => 'Done',
            'external_updated_at' => $reopenedAt->subHour(),
        ],
    );
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [p14dJiraIssue('done', $reopenedAt->addSeconds(20))], 'isLast' => true]),
        'api.atlassian.com/*' => Http::response([]),
    ]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->assertScript(p14dCardSays($item, 'Sync pending'), true);

    p14dJiraEvent($integration, 'delivery-1')->assertAccepted();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]");

    $page->navigate("/retros/{$retro->id}")
        ->assertSeeIn($card, 'Completed in Jira');

    expect($item->fresh()->completed_via_source)->toBe('jira')
        ->and(p14dSentCount('POST', '/transitions'))->toBe(0);
});

it('[P14d-05b] gives a tie to skrum, pushes its state once and does not loop on the echo', function () {
    $this->travelTo(now()->startOfMinute()->addSeconds(40));
    p14dEnable(IntegrationProvider::Jira);
    $completedAt = now()->toImmutable()->startOfMinute()->addSeconds(10);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item, 'link' => $link] = p14dSyncedItem(
        IntegrationProvider::Jira,
        ['completed_at' => $completedAt],
        [
            'local_state_changed_at' => $completedAt,
            'external_state' => ExternalIssueState::Open,
            'external_status_name' => 'To Do',
        ],
    );
    fakeJiraTransitions(p14dJiraFields('new', $completedAt), p14dJiraFields('done', $completedAt->addSeconds(5)), [
        jiraTransition('31', '10002', 'Done', 'done'),
    ]);
    Http::fake(['api.atlassian.com/*' => Http::response([])]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertScript(p14dCardSays($item, 'Sync pending'), true);

    p14dJiraEvent($integration, 'delivery-1')->assertAccepted();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertScript(p14dCardSays($item, 'Done in Jira'), true)
        ->assertPresent("{$card} [aria-label=\"Reopen\"]");

    p14dJiraEvent($integration, 'delivery-2')->assertAccepted();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]");

    expect(p14dSentCount('POST', '/transitions'))->toBe(1)
        ->and($item->fresh()->completed_at)->not->toBeNull()
        ->and($item->fresh()->completed_via_source)->toBeNull()
        ->and($link->fresh()->last_pushed_state)->toBe(ExternalIssueState::Done)
        ->and($link->fresh()->external_state)->toBe(ExternalIssueState::Done);
});

it('[P14d-06] maps a custom done status and reopen target for a Jira project and uses them for pushes', function () {
    p14dEnable(IntegrationProvider::Jira);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item] = p14dSyncedItem(IntegrationProvider::Jira);
    $status = 'new';
    Http::fake([
        jiraApiUrl('rest/api/3/project/PROJ/statuses') => Http::response([
            ['id' => '1', 'name' => 'Task', 'statuses' => [
                ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']],
                ['id' => '3', 'name' => 'In Progress', 'statusCategory' => ['key' => 'indeterminate']],
                ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']],
                ['id' => '10005', 'name' => 'Closed', 'statusCategory' => ['key' => 'done']],
            ]],
        ]),
        jiraApiUrl('rest/api/3/search/jql') => function () use (&$status) {
            return Http::response(['issues' => [p14dJiraIssue($status)], 'isLast' => true]);
        },
        jiraApiUrl('rest/api/3/issue/10001?*') => function () use (&$status) {
            return Http::response(p14dJiraIssue($status));
        },
        jiraApiUrl('rest/api/3/issue/10001/transitions*') => function (Request $request) use (&$status) {
            if ($request->method() !== 'POST') {
                return Http::response(['transitions' => [
                    jiraTransition('31', '10002', 'Done', 'done'),
                    jiraTransition('21', '10005', 'Closed', 'done'),
                    jiraTransition('51', '10000', 'To Do', 'new'),
                    jiraTransition('41', '3', 'In Progress', 'indeterminate'),
                ]]);
            }

            $status = $request['transition']['id'] === '21' ? 'closed' : 'indeterminate';

            return Http::response(null, 204);
        },
        'api.atlassian.com/*' => Http::response([]),
    ]);
    $card = "#action-item-{$item->id}";

    $page = $this->signIn($ada, p14dIntegrationsPath($retro));

    $page->assertSee('Status mapping')
        ->assertSee('Edit mapping')
        ->click('Edit mapping')
        ->assertSee('Counts as done')
        ->assertVisible('[aria-label="Complete to"]')
        ->click('[aria-label="Complete to"]')
        ->click('[role="option"]:has-text("Closed")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('[aria-label="Complete to"]', 'Closed')
        ->assertEnabled('[aria-label="Reopen to"]')
        ->click('[aria-label="Reopen to"]')
        ->click('[role="option"]:has-text("In Progress")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('[aria-label="Reopen to"]', 'In Progress');

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    expect($integration->fresh()->setting('statusMapping.projects.PROJ'))->toBe([
        'doneStatusIds' => null,
        'completeStatusId' => '10005',
        'reopenStatusId' => '3',
    ]);

    $page->navigate("/retros/{$retro->id}");
    $this->awaitRealtime($page);

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$card} [aria-label=\"Reopen\"]");

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertScript(p14dCardSays($item, 'Closed in Jira'), true);

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/issue/10001/transitions')
        && $request->data() === ['transition' => ['id' => '21']]);

    $page->click("{$card} [aria-label=\"Reopen\"]")
        ->assertPresent("{$card} [aria-label=\"Mark as done\"]");

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertScript(p14dCardSays($item, 'In Progress in Jira'), true);

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/issue/10001/transitions')
        && $request->data() === ['transition' => ['id' => '41']]);

    expect(p14dSentCount('POST', '/transitions'))->toBe(2);
});
```

Why the two conflict tests are arranged with the factory and not through the board: a completion made on the board queues its push at once, and the queue would run that push before the webhook's read, so there would be no unpushed change left to conflict with. The tests therefore arrange the state a board change leaves behind before its push runs (`local_state_changed_at` set, nothing pushed since), which is the state §5.8 of the feature spec defines the conflict on.

- `[P14d-05a]`: the item was reopened in skrum at second 10; Jira reports the issue closed at second 30. The more recent side wins, so the item is completed again, from Jira.
- `[P14d-05b]`: the item was completed in skrum at second 10; Jira reports the issue still open, changed in the same second. The tie goes to skrum: one transition to Done is posted. The second event is the echo of that push; it must post nothing.

- [ ] **Step 4: Run the conflict and mapping tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php --filter='P14d-05|P14d-06'`
Expected: PASS (3 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If sign-in fails only in the two tests that call `travelTo()`, see the harness findings.

- [ ] **Step 5: Append the Linear and GitHub tests**

Append to the file (no new import):

```php
it('[P14d-07a] moves the Linear issue to its first completed state when the action item is completed on the board', function () {
    p14dEnable(IntegrationProvider::Linear);
    ['retro' => $retro, 'ada' => $ada, 'item' => $item] = p14dSyncedItem(IntegrationProvider::Linear);
    $type = 'unstarted';
    fakeLinearGraphql([
        'issueUpdate' => function () use (&$type): array {
            $type = 'completed';

            return ['issueUpdate' => ['success' => true]];
        },
        'states(first' => ['issue' => ['team' => ['states' => ['nodes' => [
            ['id' => 'st-shipped', 'name' => 'Shipped', 'type' => 'completed', 'position' => 5],
            ['id' => 'st-completed', 'name' => 'Done', 'type' => 'completed', 'position' => 2],
            ['id' => 'st-unstarted', 'name' => 'Todo', 'type' => 'unstarted', 'position' => 1],
        ]]]]],
        'issues(' => function () use (&$type): array {
            return ['issues' => ['nodes' => [p14dLinearIssue($type)]]];
        },
    ]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->assertSeeIn($card, 'ENG-1')
        ->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$card} [aria-label=\"Reopen\"]");

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertScript(p14dCardSays($item, 'Done in Linear'), true);

    Http::assertSent(fn (Request $request) => str_contains((string) $request['query'], 'issueUpdate')
        && $request['variables'] == ['id' => 'lin-1', 'stateId' => 'st-completed']);
});

it('[P14d-07b] completes the action item when its Linear issue is canceled and canceled counts as done', function () {
    p14dEnable(IntegrationProvider::Linear);
    ['retro' => $retro, 'ada' => $ada, 'item' => $item] = p14dSyncedItem(IntegrationProvider::Linear);
    fakeLinearGraphql([
        'issues(' => ['issues' => ['nodes' => [p14dLinearIssue('canceled')]]],
    ]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]");

    p14dLinearEvent('linear-delivery-1')->assertAccepted();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertScript(p14dCardSays($item, 'Canceled in Linear'), true);

    $page->navigate("/retros/{$retro->id}")
        ->assertSeeIn($card, 'Completed in Linear');

    expect($item->fresh()->completed_via_source)->toBe('linear');
});

it('[P14d-07c] leaves the action item open when its Linear issue is canceled and "Treat canceled as done" is off', function () {
    p14dEnable(IntegrationProvider::Linear);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item] = p14dSyncedItem(IntegrationProvider::Linear);
    fakeLinearGraphql([
        'issues(' => ['issues' => ['nodes' => [p14dLinearIssue('canceled')]]],
    ]);
    $treatCanceled = 'label:has-text("Treat canceled as done") button[role="checkbox"]';
    $card = "#action-item-{$item->id}";

    $page = $this->signIn($ada, p14dIntegrationsPath($retro));

    $page->assertSee('Live updates (webhooks)')
        ->assertAttribute($treatCanceled, 'aria-checked', 'true')
        ->click($treatCanceled)
        ->assertSee('Status sync setting saved.')
        ->assertAttribute($treatCanceled, 'aria-checked', 'false');

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    p14dLinearEvent('linear-delivery-1')->assertAccepted();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->navigate("/retros/{$retro->id}")
        ->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->assertScript(p14dCardSays($item, 'Canceled in Linear'), true)
        ->assertDontSee('Completed in Linear');

    expect($item->fresh()->completed_at)->toBeNull()
        ->and($integration->fresh()->setting('treatCanceledAsDone'))->toBeFalse();
});

it('[P14d-08a] closes the GitHub issue as completed and reopens it from the board', function () {
    p14dEnable(IntegrationProvider::GitHub);
    ['retro' => $retro, 'ada' => $ada, 'item' => $item, 'link' => $link] = p14dSyncedItem(IntegrationProvider::GitHub);
    $state = ['state' => 'open', 'state_reason' => null];
    fakeGitHubTrackerApi([
        'api.github.com/repositories/9001/issues/3' => function () use (&$state) {
            return Http::response(gitHubIssue(3, $state));
        },
        'api.github.com/repos/acme/api/issues/3' => function (Request $request) use (&$state) {
            $state = ['state' => $request['state'], 'state_reason' => $request['state_reason'] ?? null];

            return Http::response(gitHubIssue(3, $state));
        },
    ]);
    Http::fake(['api.github.com/*' => Http::response([])]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->assertSeeIn($card, 'acme/api#3')
        ->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertScript(p14dCardSays($item, 'Sync pending'), true);

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertScript(p14dCardSays($item, 'in GitHub'), true);

    Http::assertSent(fn (Request $request) => $request->method() === 'PATCH'
        && $request->url() === 'https://api.github.com/repos/acme/api/issues/3'
        && $request->data() === ['state' => 'closed', 'state_reason' => 'completed']);

    expect($link->fresh()->last_pushed_state)->toBe(ExternalIssueState::Done);

    $page->click("{$card} [aria-label=\"Reopen\"]")
        ->assertPresent("{$card} [aria-label=\"Mark as done\"]");

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    Http::assertSent(fn (Request $request) => $request->method() === 'PATCH'
        && $request->url() === 'https://api.github.com/repos/acme/api/issues/3'
        && $request->data() === ['state' => 'open']);

    expect($link->fresh()->last_pushed_state)->toBe(ExternalIssueState::Open)
        ->and(p14dSentCount('PATCH', '/repos/acme/api/issues/3'))->toBe(2);
});

it('[P14d-08b] completes the action item when its GitHub issue is closed as not planned', function () {
    p14dEnable(IntegrationProvider::GitHub);
    ['retro' => $retro, 'ada' => $ada, 'item' => $item] = p14dSyncedItem(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/graphql' => gitHubGraphqlIssues([3 => gitHubIssue(3, [
            'state' => 'closed',
            'state_reason' => 'not_planned',
            'updated_at' => now()->toIso8601String(),
        ])]),
    ]);
    Http::fake(['api.github.com/*' => Http::response([])]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]");

    p14dGitHubEvent('issues', [
        'action' => 'closed',
        'issue' => ['number' => 3],
        'repository' => ['id' => 9001, 'full_name' => 'acme/api'],
    ], 'github-delivery-1')->assertAccepted();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]");

    $page->navigate("/retros/{$retro->id}")
        ->assertSeeIn($card, 'Completed in GitHub');

    expect($item->fresh()->completed_via_source)->toBe('github')
        ->and(p14dSentCount('PATCH', '/repos/acme/api/issues/3'))->toBe(0);
});
```

- [ ] **Step 6: Run the Linear and GitHub tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php --filter='P14d-07|P14d-08'`
Expected: PASS (5 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If the Linear webhook answers 401, the body was posted after the clock moved by more than 60 seconds from `webhookTimestamp`. If this fails for another reason, see the harness findings.

- [ ] **Step 7: Append the Jira Data Center webhook tests and the poker tests**

Add this import to the `use` block, in alphabetical order:

```php
use App\Enums\ExternalStatusCategory;
```

Append to the file:

```php
it('[P14d-09a] registers the Jira Data Center webhook itself when the token belongs to a Jira administrator', function () {
    p14dEnable(IntegrationProvider::JiraDataCenter);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration] = p14dSyncedItem(IntegrationProvider::JiraDataCenter, mode: null);
    Http::fake([
        jiraDataCenterUrl('rest/api/2/mypermissions*') => Http::response(['permissions' => ['ADMINISTER' => ['havePermission' => true]]]),
        jiraDataCenterUrl('rest/webhooks/1.0/webhook') => Http::response(['self' => 'https://jira.example.com/rest/webhooks/1.0/webhook/12'], 201),
        jiraDataCenterUrl('rest/api/2/search') => Http::response(['issues' => [p14dJiraDataCenterIssue()], 'total' => 1]),
        'jira.example.com/*' => Http::response([]),
    ]);
    $path = p14dIntegrationsPath($retro);
    $switch = 'label:has-text("Sync status") button[role="checkbox"]';

    $page = $this->signIn($ada, $path);

    $page->assertSee('Acting as Jane Doe in Jira')
        ->assertAttribute($switch, 'aria-checked', 'false')
        ->click($switch)
        ->assertSee('Turn on status sync with Jira Data Center?')
        ->click('[role="dialog"] button:has-text("Turn on status sync")')
        ->assertSee('Status sync is on.')
        ->assertAttribute($switch, 'aria-checked', 'true');

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->navigate($path)
        ->assertSee('Setting up live updates…')
        ->assertDontSee('Only a Jira administrator can register the webhook.')
        ->assertDontSee('Show webhook details');

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && $request->url() === 'https://jira.example.com/rest/webhooks/1.0/webhook'
        && $request['events'] === ['jira:issue_updated', 'jira:issue_deleted']
        && $request['filters'] === ['issue-related-events-section' => 'project in ("OPS")']
        && str_contains((string) $request['url'], "/integrations/webhooks/jira-dc/{$integration->id}/")
        && $request->hasHeader('Authorization', 'Bearer '.TeamIntegrationFactory::JiraDataCenterToken));

    expect($integration->fresh()->setting('webhookIds'))->toBe(['12'])
        ->and($integration->fresh()->setting('webhookManual'))->toBeFalse()
        ->and($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Pending);
});

it('[P14d-09b] shows the manual webhook panel to a non-administrator and goes live after "I\'ve registered it" and the first event', function () {
    p14dEnable(IntegrationProvider::JiraDataCenter);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration] = p14dSyncedItem(IntegrationProvider::JiraDataCenter, mode: null);
    Http::fake([
        jiraDataCenterUrl('rest/api/2/mypermissions*') => Http::response(['permissions' => ['ADMINISTER' => ['havePermission' => false]]]),
        jiraDataCenterUrl('rest/api/2/search') => Http::response(['issues' => [p14dJiraDataCenterIssue()], 'total' => 1]),
        'jira.example.com/*' => Http::response([]),
    ]);
    $path = p14dIntegrationsPath($retro);
    $switch = 'label:has-text("Sync status") button[role="checkbox"]';

    $page = $this->signIn($ada, $path);

    $page->assertAttribute($switch, 'aria-checked', 'false')
        ->click($switch)
        ->click('[role="dialog"] button:has-text("Turn on status sync")')
        ->assertSee('Status sync is on.')
        ->assertAttribute($switch, 'aria-checked', 'true');

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->navigate($path)
        ->assertSee('Only a Jira administrator can register the webhook.')
        ->assertSee('Checking every 5 minutes.')
        ->assertSee('Show webhook details')
        ->click('Show webhook details')
        ->assertSee('Webhook URL');

    $integration->refresh();
    $token = (string) $integration->credential('webhookToken');
    $secret = (string) $integration->credential('webhookSecret');

    $page->assertSee("/integrations/webhooks/jira-dc/{$integration->id}/{$token}")
        ->assertSee('jira:issue_updated, jira:issue_deleted')
        ->assertSee('project in ("OPS")')
        ->assertSee($secret)
        ->assertPresent('[aria-label="Copy Webhook URL"]')
        ->click("I've registered it")
        ->assertSee('skrum now waits for the first event.')
        ->assertSee('Setting up live updates…')
        ->assertDontSee("I've registered it");

    p14dJiraEvent($integration, 'dc-delivery-1', 'jira-dc', $token, $secret)->assertAccepted();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->navigate($path)
        ->assertSee('Live updates (webhooks)')
        ->assertSee('Only a Jira administrator can register the webhook.');

    expect(p14dSentCount('POST', '/rest/webhooks/1.0/webhook'))->toBe(0)
        ->and($integration->fresh()->setting('webhookManual'))->toBeTrue()
        ->and($integration->fresh()->webhook_status)->toBe(IntegrationWebhookStatus::Active);
});

it('[P14d-10a] shows the status of the Jira issue on its imported poker task as it changes in Jira', function () {
    p14dEnable(IntegrationProvider::Jira);
    ['game' => $game, 'ada' => $ada, 'integration' => $integration, 'task' => $task] = p14dPokerTask();
    $status = 'indeterminate';
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => function () use (&$status) {
            return Http::response(['issues' => [p14dJiraIssue($status)], 'isLast' => true]);
        },
        'api.atlassian.com/*' => Http::response([]),
    ]);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Checkout flow')
        ->assertDontSee('In Progress in Jira');

    p14dJiraEvent($integration, 'delivery-1')->assertAccepted();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertSee('In Progress in Jira')
        ->assertSee('Story PROJ-1')
        ->assertDontSee('Checkout flow');

    $status = 'done';

    p14dJiraEvent($integration, 'delivery-2')->assertAccepted();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertSee('Done in Jira')
        ->assertPresent('[data-test="poker-task-row"] [aria-label="Done in Jira"]')
        ->assertDontSee('In Progress in Jira');

    expect($task->fresh()->external_status_category)->toBe(ExternalStatusCategory::Done)
        ->and($task->fresh()->title)->toBe('Story PROJ-1');
});

it('[P14d-10b] flags a story points change made in Jira and takes the Jira value when the facilitator chooses it', function () {
    p14dEnable(IntegrationProvider::Jira);
    ['game' => $game, 'ada' => $ada, 'integration' => $integration, 'task' => $task] = p14dPokerTask([
        'estimate' => '5',
        'estimate_numeric' => 5,
        'estimated_at' => now()->subHour(),
        'synced_at' => now()->subHour(),
        'external_estimate' => '5',
    ]);
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [p14dJiraIssue('new', null, ['customfield_10016' => 8])], 'isLast' => true]),
        'api.atlassian.com/*' => Http::response([]),
    ]);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Estimate: 5')
        ->assertDontSee('Changed in Jira to 8');

    p14dJiraEvent($integration, 'delivery-1')->assertAccepted();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertSee('Changed in Jira to 8')
        ->assertSee('Estimate: 5')
        ->assertSee('Keep skrum estimate')
        ->assertButtonEnabled('Use Jira estimate')
        ->click('Use Jira estimate')
        ->assertSee('Estimate: 8')
        ->assertDontSee('Changed in Jira to 8');

    expect($task->fresh()->estimate)->toBe('8')
        ->and(p14dSentCount('PUT', '/rest/api/3/issue/10001'))->toBe(0);
});

it('[P14d-10c] writes the skrum estimate back to Jira when the facilitator keeps it', function () {
    p14dEnable(IntegrationProvider::Jira);
    ['game' => $game, 'ada' => $ada, 'integration' => $integration, 'task' => $task] = p14dPokerTask([
        'estimate' => '5',
        'estimate_numeric' => 5,
        'estimated_at' => now()->subHour(),
        'synced_at' => now()->subHour(),
        'external_estimate' => '5',
    ]);
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [p14dJiraIssue('new', null, ['customfield_10016' => 8])], 'isLast' => true]),
        jiraApiUrl('rest/api/3/issue/*/editmeta') => Http::response(['fields' => ['customfield_10016' => ['name' => 'Story point estimate']]]),
        jiraApiUrl('rest/api/3/issue/*') => Http::response(null, 204),
        'api.atlassian.com/*' => Http::response([]),
    ]);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Estimate: 5');

    p14dJiraEvent($integration, 'delivery-1')->assertAccepted();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertSee('Changed in Jira to 8')
        ->click('Keep skrum estimate')
        ->assertSee('Sync pending')
        ->assertDontSee('Changed in Jira to 8');

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertSee('Synced to Jira')
        ->assertDontSee('Sync pending')
        ->assertSee('Estimate: 5')
        ->assertDontSee('Changed in Jira to 8');

    Http::assertSent(fn (Request $request) => $request->method() === 'PUT'
        && str_ends_with($request->url(), '/rest/api/3/issue/10001')
        && $request['fields']['customfield_10016'] == 5);

    expect($task->fresh()->estimate)->toBe('5');
});

it('[P14d-10d] cannot take a Jira value that is not a card of the deck', function () {
    p14dEnable(IntegrationProvider::Jira);
    ['game' => $game, 'ada' => $ada, 'integration' => $integration, 'task' => $task] = p14dPokerTask([
        'estimate' => '5',
        'estimate_numeric' => 5,
        'estimated_at' => now()->subHour(),
        'synced_at' => now()->subHour(),
        'external_estimate' => '5',
    ]);
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [p14dJiraIssue('new', null, ['customfield_10016' => 7])], 'isLast' => true]),
        'api.atlassian.com/*' => Http::response([]),
    ]);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Estimate: 5');

    p14dJiraEvent($integration, 'delivery-1')->assertAccepted();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertSee('Changed in Jira to 7')
        ->assertSee('7 is not in this deck.')
        ->assertButtonDisabled('Use Jira estimate')
        ->assertButtonEnabled('Keep skrum estimate');

    expect($task->fresh()->estimate)->toBe('5');
});
```

Notes on these tests:

- `[P14d-09b]`: "register it in Jira" happens in Jira's administration; the test replaces it by posting the event Jira would send to the URL the panel shows, signed with the secret the panel shows. The token and the secret are read from the connection after the panel has loaded them, and the test asserts that the panel shows exactly those values.
- `[P14d-10a]` to `[P14d-10d]` start from an imported task arranged with the factory; importing a sprint through the dialog is covered for Jira Data Center by `[P14c-02]` and for Jira Cloud by the plan 13 walkthrough tests.
- `[P14d-10a]` also asserts that the title follows the source ("Story PROJ-1" replaces "Checkout flow"): the walkthrough's "poker tasks following their source".

- [ ] **Step 8: Run the Jira Data Center webhook tests and the poker tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php --filter='P14d-09|P14d-10'`
Expected: PASS (6 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If this fails for another reason, see the harness findings.

- [ ] **Step 9: Append the polling tests and the GitHub uninstallation test**

Append to the file (no new import):

```php
it('[P14d-11a] says it checks every 5 minutes and answers 404 to webhooks when inbound webhooks are off', function () {
    p14dEnable(IntegrationProvider::GitHub);
    config(['services.integrations.inbound_webhooks' => 'off']);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration] = p14dSyncedItem(IntegrationProvider::GitHub, mode: null);
    fakeGitHubTrackerApi();
    Http::fake(['api.github.com/*' => Http::response([])]);
    $switch = 'label:has-text("Sync status") button[role="checkbox"]';

    $page = $this->signIn($ada, p14dIntegrationsPath($retro));

    $page->assertAttribute($switch, 'aria-checked', 'false')
        ->click($switch)
        ->assertSee('Turn on status sync with GitHub?')
        ->click('[role="dialog"] button:has-text("Turn on status sync")')
        ->assertSee('Status sync is on.')
        ->assertAttribute($switch, 'aria-checked', 'true')
        ->assertSee('Checking every 5 minutes.')
        ->assertSee('Treat canceled as done')
        ->assertDontSee('Live updates (webhooks)')
        ->assertDontSee('Setting up live updates…');

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    p14dGitHubEvent('issues', [
        'action' => 'closed',
        'issue' => ['number' => 3],
        'repository' => ['id' => 9001, 'full_name' => 'acme/api'],
    ], 'github-delivery-1')->assertNotFound();

    expect($integration->fresh()->inbound_mode)->toBe(IntegrationInboundMode::Polling)
        ->and($integration->fresh()->webhook_status)->toBeNull();
});

it('[P14d-11b] completes the action item on the open board when the poll finds its Jira issue closed', function () {
    p14dEnable(IntegrationProvider::Jira);
    config(['services.integrations.inbound_webhooks' => 'off']);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration, 'item' => $item] = p14dSyncedItem(IntegrationProvider::Jira, mode: IntegrationInboundMode::Polling);
    $integration->forceFill(['last_polled_at' => now()->subMinutes(6), 'poll_cursor' => now()->subMinutes(6)])->save();
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [p14dJiraIssue('done')], 'isLast' => true]),
        'api.atlassian.com/*' => Http::response([]),
    ]);
    $card = "#action-item-{$item->id}";

    $page = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));

    $page->assertPresent("{$card} [aria-label=\"Mark as done\"]");

    $this->artisan('skrum:poll-integrations')->assertSuccessful();

    while (p14dDueJobs() > 0) {
        $this->workQueue();
    }

    $page->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertScript(p14dCardSays($item, 'Done in Jira'), true);

    $page->navigate("/retros/{$retro->id}")
        ->assertSeeIn($card, 'Completed in Jira');

    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/rest/api/3/search/jql')
        && str_contains((string) $request['jql'], 'id in (10001) AND updated >= "-'));

    expect($item->fresh()->completed_via_source)->toBe('jira')
        ->and($integration->fresh()->last_polled_at->gt(now()->subMinute()))->toBeTrue();
});

it('[P14d-12] asks to reconnect on the card once GitHub reports that the App was uninstalled', function () {
    p14dEnable(IntegrationProvider::GitHub);
    ['retro' => $retro, 'ada' => $ada, 'integration' => $integration] = p14dSyncedItem(IntegrationProvider::GitHub);
    fakeGitHubTrackerApi([
        'api.github.com/app/installations/4242' => Http::response(['message' => 'Not Found'], 404),
    ]);
    Http::fake(['api.github.com/*' => Http::response([])]);
    $path = p14dIntegrationsPath($retro);

    $page = $this->signIn($ada, $path);

    $page->assertSee('GitHub account')
        ->assertSee('Live updates (webhooks)')
        ->assertDontSee('Reconnect required');

    p14dGitHubEvent('installation', ['action' => 'deleted'], 'github-delivery-1')->assertAccepted();

    $page->navigate($path)
        ->assertSee('Reconnect required')
        ->assertSee('The GitHub App was uninstalled from acme.')
        ->assertDontSee('Sync status');

    expect($integration->fresh()->last_error)->toBe('The GitHub App was uninstalled from acme.');
});
```

In `[P14d-11a]` and `[P14d-11b]` the line `config(['services.integrations.inbound_webhooks' => 'off'])` comes right after `p14dEnable()` and before any model is created or any page is opened, for the reason given in the facts above.

- [ ] **Step 10: Run the polling and uninstallation tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php --filter='P14d-11|P14d-12'`
Expected: PASS (3 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If this fails for another reason, see the harness findings.

- [ ] **Step 11: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code of this file, run `composer rector` and keep its result, except that the closures capturing a variable by reference (`use (&$status)`, `use (&$state)`, `use (&$type)`) must stay closures: an arrow function would capture the value once.

- [ ] **Step 12: Run the whole file twice**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php`
Expected: PASS (25 tests: 24 titles, `[P14d-03b]` runs twice).

Run the same command a second time.
Expected: PASS (25 tests) again. A test that passes once and fails once waits on something that is not guaranteed: see the harness findings before changing the test.

- [ ] **Step 13: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php
git commit -m "test(browser): cover the plan 14d walkthrough: two-way status sync, webhooks and polling"
```

### Task 12: Coverage table and residual checklist

**Files:**
- Modify: `docs/superpowers/walkthroughs/coverage.md` (summary rows, one section per walkthrough of this plan, notes)
- Modify: `docs/superpowers/walkthroughs/residual-manual-checklist.md` (one section per walkthrough of this plan that has residual steps)

**Interfaces:**
- Consumes: the test identifiers of the walkthrough tasks of this plan, as implemented.
- Produces: the rows acceptance criterion 5 of the spec asks for, for this plan's walkthroughs.

The rows below were written with the plan, before any test ran. Before writing them, read the walkthrough test files as implemented and the task reports: where a test was renamed, split, dropped, or changed status, change its row to match the code. A row is `auto` or `auto-substituted` only if its test exists and passes.

- [ ] **Step 1: Add the summary rows**

In `docs/superpowers/walkthroughs/coverage.md`, in the Summary table, add these rows before the `**Total**` row, and recompute the total row from all rows of the table (this plan adds 147 rows: 14 `auto`, 94 `auto-substituted`, 39 `residual`, as planned):

```markdown
| Plan 12a: integrations foundation | 15 | 2 | 7 | 6 |
| Plan 12b: sharing | 13 | 2 | 6 | 5 |
| Plan 14a: Microsoft Teams and Mattermost | 9 | 0 | 7 | 2 |
| Plan 12c: poker trackers | 16 | 3 | 10 | 3 |
| Plan 12d: action item export | 11 | 0 | 8 | 3 |
| Plan 14b: outgoing webhooks | 13 | 1 | 11 | 1 |
| Plan 15: webhook redelivery | 6 | 2 | 3 | 1 |
| Plan 11b: MCP (API tokens page) | 21 | 4 | 3 | 14 |
| Plan 14c: Jira Data Center and GitHub trackers | 18 | 0 | 15 | 3 |
| Plan 14d: status sync | 25 | 0 | 24 | 1 |
```

- [ ] **Step 2: Add one section per walkthrough**

In the same file, insert these sections before the `## Notes` section:

````markdown
## Plan 12a: integrations foundation

Walkthrough: `docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P12a-01a | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8360 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto-substituted |
| P12a-01b | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8360 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto |
| P12a-01c | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8360 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto |
| P12a-02a | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8361 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto-substituted |
| P12a-02b | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8361 | (none) | residual |
| P12a-03a | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8362 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto-substituted |
| P12a-03b | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8362 | (none) | residual |
| P12a-04a | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8363 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto-substituted |
| P12a-04b | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8363 | (none) | residual |
| P12a-05a | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8364 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto-substituted |
| P12a-05b | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8364 | (none) | residual |
| P12a-06a | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8365 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto-substituted |
| P12a-06b | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8365 | (none) | residual |
| P12a-07a | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8366 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto-substituted |
| P12a-07b | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8366 | (none) | residual |

## Plan 12b: sharing

Walkthrough: `docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P12b-01a | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4799 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto-substituted |
| P12b-01b | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4799 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto |
| P12b-01c | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4789 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto |
| P12b-01d | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4799 | (none) | residual |
| P12b-02a | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4800 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto-substituted |
| P12b-02b | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4800 | (none) | residual |
| P12b-03a | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4801 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto-substituted |
| P12b-03b | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4801 | (none) | residual |
| P12b-04a | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4802 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto-substituted |
| P12b-04b | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4802 | (none) | residual |
| P12b-05 | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4803 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto-substituted |
| P12b-06a | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4804 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto-substituted |
| P12b-06b | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4804 | (none) | residual |

## Plan 14a: Microsoft Teams and Mattermost

Walkthrough: `docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P14a-01a | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php | auto-substituted |
| P14a-01b | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php | auto-substituted |
| P14a-02 | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php | auto-substituted |
| P14a-03a | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php | auto-substituted |
| P14a-03b | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php | auto-substituted |
| P14a-04a | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php | auto-substituted |
| P14a-04b | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | (none) | residual |
| P14a-05a | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php | auto-substituted |
| P14a-05b | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | (none) | residual |

## Plan 12c: poker trackers

Walkthrough: `docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P12c-01 | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6235 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-02a | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6236 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-02b | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6236 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-03a | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6237 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-03b | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6237 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-03c | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6237 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto |
| P12c-04 | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6238 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-04r | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6238 | (none) | residual |
| P12c-05a | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6239 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-05b | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6239 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-06 | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6240 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto |
| P12c-07a | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6241 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-07b | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6241 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-07r | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6241 | (none) | residual |
| P12c-08 | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6242 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto |
| P12c-09 | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6243 | (none) | residual |

## Plan 12d: action item export

Walkthrough: `docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P12d-01 | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6431 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-01r | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6431 | (none) | residual |
| P12d-02a | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6432 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-02b | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6432 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-03 | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6433 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-03r | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6433 | (none) | residual |
| P12d-04 | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6434 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-05 | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6435 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-06 | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6436 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-07 | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6437 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-07r | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6437 | (none) | residual |

## Plan 14b: outgoing webhooks

Walkthrough: `docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P14b-01 | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4840 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-01r | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4840 | (none) | residual |
| P14b-02a | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4841 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-02b | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4841 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-02c | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4841 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-03a | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4842 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto |
| P14b-03b | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4842 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-03c | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4842 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-03d | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4842 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-04a | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4843 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-04b | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4843 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-05 | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4844 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-06 | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4845 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |

## Plan 15: webhook redelivery

Walkthrough: `docs/superpowers/plans/2026-10-08-plan-15-webhook-redelivery.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P15-01 | docs/superpowers/plans/2026-10-08-plan-15-webhook-redelivery.md:2505 | tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php | auto-substituted |
| P15-01r | docs/superpowers/plans/2026-10-08-plan-15-webhook-redelivery.md:2505 | (none) | residual |
| P15-02 | docs/superpowers/plans/2026-10-08-plan-15-webhook-redelivery.md:2505 | tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php | auto-substituted |
| P15-03 | docs/superpowers/plans/2026-10-08-plan-15-webhook-redelivery.md:2505 | tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php | auto-substituted |
| P15-04 | docs/superpowers/plans/2026-10-08-plan-15-webhook-redelivery.md:2505 | tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php | auto |
| P15-05 | docs/superpowers/plans/2026-10-08-plan-15-webhook-redelivery.md:2505 | tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php | auto |

## Plan 11b: MCP (API tokens page)

Walkthrough: `docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P11b-01 | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4522 | tests/Browser/Walkthroughs/Plan11bApiTokensTest.php | auto |
| P11b-02 | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4523 | tests/Browser/Walkthroughs/Plan11bApiTokensTest.php | auto |
| P11b-03a | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4524 | (none) | residual |
| P11b-03b | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4524 | tests/Browser/Walkthroughs/Plan11bApiTokensTest.php | auto-substituted |
| P11b-04 | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4525 | (none) | residual |
| P11b-05 | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4526 | (none) | residual |
| P11b-06 | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4527 | (none) | residual |
| P11b-07 | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4528 | (none) | residual |
| P11b-08 | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4529 | (none) | residual |
| P11b-09 | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4530 | (none) | residual |
| P11b-10 | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4531 | (none) | residual |
| P11b-11 | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4532 | (none) | residual |
| P11b-12 | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4533 | (none) | residual |
| P11b-13 | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4534 | (none) | residual |
| P11b-14 | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4535 | (none) | residual |
| P11b-15a | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4536 | tests/Browser/Walkthroughs/Plan11bApiTokensTest.php | auto |
| P11b-15b | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4536 | (none) | residual |
| P11b-16 | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4537 | tests/Browser/Walkthroughs/Plan11bApiTokensTest.php | auto-substituted |
| P11b-17 | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4538 | tests/Browser/Walkthroughs/Plan11bApiTokensTest.php | auto-substituted |
| P11b-18a | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4539 | tests/Browser/Walkthroughs/Plan11bApiTokensTest.php | auto |
| P11b-18b | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4539 | (none) | residual |

## Plan 14c: Jira Data Center and GitHub trackers

Walkthrough: `docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P14c-01 | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-01b | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | (none) | residual |
| P14c-02 | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-03 | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-04 | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-05a | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-05b | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-05c | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-06 | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-07 | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-07b | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | (none) | residual |
| P14c-08 | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-09a | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-09b | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-10 | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-11 | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | (none) | residual |
| P14c-12 | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-13 | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |

## Plan 14d: status sync

Walkthrough: `docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P14d-01a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-01b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-02 | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-03a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-03b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-04a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-04b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-05a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-05b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-06 | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-07a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-07b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-07c | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-08a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-08b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-09a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-09b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-10a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-10b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-10c | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-10d | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-11a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-11b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-12 | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-13 | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | (none) | residual |

````

- [ ] **Step 3: Add the notes**

In the same file, append these bullets to the `## Notes` section (drop a bullet whose difference turned out not to exist; add one for each difference found while implementing):

````markdown
- **P12a-01a to P12a-07a:** the walkthrough asks for real developer apps in `.env`. The tests enable providers with `enableIntegrations()` and answer every provider call with `Http::fake()`; connected integrations are arranged with `TeamIntegrationFactory` states, because an OAuth redirect cannot be followed against a fake.
- **P12a-01b, P12a-01c:** the walkthrough only says "only configured providers appear". The tests add the two boundaries the feature spec names (integrations spec §16, criteria 1 and 2): a team member has no link and gets 403, and with no provider configured the link is absent and the page answers 404.
- **P12a-03a:** "add the bot to a group, send the shown command" becomes: read the command from the card, serve it as the answer of `getUpdates`, run `skrum:telegram-poll --timeout=0`. The page's own 5-second poll then shows "Connected".
- **P12a-04a, P12a-05a:** the trackers are arranged with read access. The walkthrough connects Linear "read and write"; with write access the card also loads people and priorities from the provider, which belongs to the plan 12d walkthrough. "Test the connection" behaves the same for both access levels.
- **P12a-06a:** "the Slack card shows 'Reconnect required' with the error": the error shown is the provider's code, `token_revoked`.
- **P12b-01a to P12b-06a:** "a queue worker running" becomes the `database` queue plus `$this->workQueue()` after each share, so the test sees both "Sending to …" and "Sent to …".
- **P12b-01a:** the walkthrough's "the dialog shows 'Sent to Slack · …'": the test asserts the prefix "Sent to Slack"; the relative time after the dot depends on the browser's clock.
- **P12b-01c:** not a walkthrough step; it automates Step 3 of the plan 12b verification ("confirm in the running app with every integration variable unset that the board header has no 'Share' button, the Results view has no share menu and the poker game menu has no 'Share…' item").
- **P12b-03a:** "a summary still generating" needs a configured LLM for the dialog to mention the summary at all; the test sets the configuration and a pending summary, and no LLM call is made.
- **P12b-04a:** "each participant receives the mail in their own language, guests receive nothing" is asserted on the faked notifications (recipient set and locale), not on rendered mail. The test adds a third send after travelling 11 minutes to show the cooldown ends.
- **P12b-06a:** the walkthrough posts "again" after archiving; the test posts once to a channel that answers 410. Telegram stays connected in the test: with Slack as the only channel, the share section and its failed line disappear as soon as the connection needs reconnecting (`post-link-section.tsx` returns nothing when no channel is left).
- **P14a-01a, P14a-01b:** connecting Teams and Mattermost is driven in the browser, because it is a pasted URL and not an OAuth round trip. Both tests add the refusal of a foreign URL (extended integrations spec §4.3, §4.4) and assert that the stored URL is absent from the page source.
- **P14a-03b:** the invite is posted from a standalone Hangman room opened by its host; the sentence names the game and the room, never the players.
- **P14a-04a:** "names shown as a count, action items named, `@channel` in a card rendered literally" is asserted on the payloads: Teams receives the plain word (a Teams mention needs an entity that skrum never sends), Mattermost receives `@` followed by a zero-width space.
- **P14a-05a:** "break the Teams URL (delete the workflow)" becomes a 404 from the workflow host. The test continues with "Replace URL" to show the recovery, which the walkthrough does not mention.
- P12c-01: the walkthrough connects Jira and Linear by hand; the test starts from connections arranged with `TeamIntegrationFactory` and asserts what follows from them (the Import button and both sources in the dialog). The connection itself is covered by the plan 12a rows.
- P12c-02a: the walkthrough's `PROJ-n` "chips" are asserted as the key inside each task row, and the source link as the `href` of the key in the current task's detail.
- P12c-03c: "open a task" is done by the facilitator choosing it as the current task, which is the only way the product shows a task's detail.
- P12c-04: "queue worker running" is replaced by the `database` queue and one `$this->workQueue()`; "Jira shows 5 story points" is asserted as the `PUT` skrum sends (`customfield_10016` = 5) and is otherwise the residual row P12c-04r. A second member's page is added to prove the badge changes for the other players too.
- P12c-05a: the walkthrough says "set 1 instead"; the test sets 8, because the text of the option "1" is contained in "13" and "100" of the Modified Fibonacci deck and cannot be addressed without a hook. The rule under test is the same.
- P12c-05b: the walkthrough only names the Retry button. The feature spec (integrations design, estimate write-back) says the facilitator's retry can also force an estimate that is already synced, so the test clicks "Retry" on a failed task and then "Sync again", and asserts two writes. The failed state is arranged with the factory.
- P12c-07a and P12c-07b: the product shows two toasts, ":count tasks refreshed." and ":count tasks were not found in Jira."; English has no singular form, so the test asserts "1 tasks were not found in Jira." where the walkthrough says "the toast says one task was not found".
- P12c-08: "no import button" also covers the "More task actions" menu, which a guest does not get either. A team member's page is asserted next to the guest's so that the absence is meaningful.
- P12d-01: the People panel never shows the text "Matching…". The product shows a spinner in the disabled "Match by email" button while the job runs; the test asserts the disabled button, then the badges.
- P12d-02a: the walkthrough resets "a third" member; the test arranges that member's email match with the factory so that the menu offers "Reset".
- P12d-03: the walkthrough's `PROJ-n ↗` is asserted as the link with the issue URL and the key as text; the arrow is an icon. The exporter is the item's author; the second browser is the facilitator.
- P12d-05: "the Jira entry is gone from its menu" is asserted as the menu button being replaced by the single button "Export to Linear", which is what the product renders when one tracker is left. The forced request is sent twice in a row, not in parallel: the suite's server handles one request at a time, so a true race cannot be produced; the lock that makes a parallel double submit safe stays covered by `ActionItemExportTest` ("creates one issue for a double submit").
- P12d-07: the walkthrough revokes first and exports afterwards. With a revoked token the product already fails when the export dialog loads its teams, so the test lets the dialog load, then switches the fake to the revoked answer and clicks Export, which is the request that answers 409 in the walkthrough. The status code is not visible in the interface; the test asserts its message.
- P14b-01, P14b-06: "send Test" is checked with `Http::assertSent`-style inspection of the recorded request; the test message is not written to the delivery log, so no log row is asserted for it.
- P14b-01: the test also submits `https://127.0.0.1/skrum` first and expects "This URL points to a private or invalid address."; this is not a walkthrough bullet, it proves that the URL safety check is not switched off by the faked DNS resolver.
- P14b-02a to P14b-02c: the walkthrough's bullet names three shares; each is one test. The board link and the room invite are sent without the guest link.
- P14b-03b: the three action item events are driven from the retro board's action items panel (Discussing), not from the workspace action items page.
- P14b-04a, P15-02: after its last try on a 5xx answer the delivery's error is "Webhook did not respond. Try again later." (`ProviderUnavailable::userMessage()`); "The receiver answered 500." is the internal detail and is shown only for 4xx answers.
- P14b-04a: "watch the retries" is checked after the first and the second try (the log shows Queued with 1 then 2 attempts), then after the seventh; the waits are travelled, not waited.
- P14b-04b: nine earlier consecutive failures are arranged with the factory; the tenth is a board link shared through the interface (four tries). The walkthrough's "10 failures" are not driven one by one.
- P14b-05: the 410 answer is received by an `action_item.completed` delivery. The interface shows "The receiver asked skrum to stop." under the status "Reconnect required".
- P14b-06: "see the old one fail verification" is asserted on the request sent after the rotation: its signature verifies with the new secret and not with the old one.
- P15-02: "stop the receiver" is replaced by a receiver answering 503.
- P15-03: the failed delivery is arranged with the factory; the redelivery is checked for the same `X-Skrum-Delivery`, `X-Skrum-Redelivery: true`, and the log row "Redelivery".
- P15-05: not a walkthrough item. It covers the refusals of the redelivery spec §4.3 ("still being sent", "Turn the webhook back on before redelivering.", "content is no longer kept"). The interface hides Redeliver in these states, so each case changes the state after the log was loaded. The throttle of redeliveries is not covered here; it is covered by `tests/Feature/Integrations/WebhookRedeliveryTest.php`.
- P11b-01: the server URL is the test server's (`http://127.0.0.1:<port>/mcp`), not `http://localhost/mcp`; the test asserts that it ends with `/mcp`.
- P11b-01, P11b-02: the walkthrough says that "Create token" asks for the password. Today the page itself is behind the password confirmation (`routes/settings.php`), so the password is asked when the page is opened, once, and "Create token" opens the dialog directly.
- P11b-03b, P11b-16, P11b-17: the client's call is one request sent from the test process with `postMcp()` (a bearer token, no session).
- P11b-17: the configuration value `skrum.mcp.enabled` is set in the test instead of `SKRUM_MCP_ENABLED` plus a restart. The page answers with Laravel's default 404 page ("Not Found").
- P11b-18a: three strings of the page and three of its dialogs are checked per language; the revoke dialog is not opened in each language.
- **P14c-05a** — the walkthrough says "replace the connection with a personal access token". A connection made with OAuth offers no token dialog (`jira-data-center-integration.tsx` shows "Replace token" only for a token connection), so the test pastes the token from the not-connected card. The feature spec (§4.1) only requires that an OAuth connection replaces a stored token, not the reverse.
- **P14c-05c** — "exported issue created as the token owner" is asserted as: the export's calls carry `Authorization: Bearer {personal access token}` and none carries an OAuth token. Who Jira then records as the reporter is Jira's behaviour.
- **P14c-06** and **P14c-13** — "revoke the token in Jira" and "uninstall the app" are the faked answers 401 on `GET /rest/api/2/myself` and 404 on `GET /app/installations/4242`, found with "Test the connection".
- **P14c-09a, P14c-09b, P14c-10** — "see one block in the issue body" is asserted on the body of the single `PATCH /repos/acme/api/issues/7` request, with exactly one `<!-- skrum:estimate -->` marker and the surrounding text unchanged.
- **P14c-11** — the walkthrough expects to clear an estimate; today's interface cannot. Residual, with the feature test named in the residual entry.
- **P14d-01a** — after the switch the card says "Checking every 5 minutes." until the registration job has run, then "Setting up live updates…" until the first verified event, then "Live updates (webhooks)". The walkthrough does not describe these three states; the test asserts all three.
- **P14d-01b** — "reconnect first so the webhook scope is granted" is asserted from the other side: a connection without the scope shows "Reconnect Jira to receive live updates." and polls. The reconnection itself is part of residual `P14d-13`.
- **P14d-02, P14d-05a, P14d-07b, P14d-08b, P14d-11b** — the walkthrough says the item completes "with 'Completed in Jira'". On an open board the item is completed at once, but "Completed in :source" appears only after the page is loaded again, because broadcast payloads carry no `completedVia`. The tests assert the live completion, then reload and assert the label.
- **P14d-02** — "within seconds" is not timed; the test waits for the change with the suite's 20-second assertion timeout after running the queued job itself.
- **P14d-05a, P14d-05b** — the walkthrough says "complete in skrum and close in Jira within the same minute to see the newer change win". Both changes lead to the same state, so nothing would conflict. The tests use opposite changes: reopened in skrum then closed in Jira 20 seconds later (Jira wins), and completed in skrum while Jira reports the issue open with a change in the same second (tie, skrum wins, one push, no loop on the echo). The unpushed skrum change is arranged with the factory (see Task 11, Step 3).
- **P14d-08b** — "close as not planned" completes the item because "Treat canceled as done" is on by default for GitHub; the case with the option off is covered for Linear by `P14d-07c`.
- **P14d-09b** — the brief for this plan expected a 403 on the registration call for a non-administrator; the code asks `GET /rest/api/2/mypermissions?permissions=ADMINISTER` and does not attempt the registration when `havePermission` is false. The test fakes that answer and asserts that no registration was posted.
- **P14d-10a** — the walkthrough says the task shows "In progress in Jira"; the interface shows the tracker's own status name, "In Progress in Jira" for a Jira status named "In Progress".
- **P14d-11a** — the walkthrough's "cards say 'Checking every 5 minutes.'" is asserted on the GitHub card, where the test also turns the switch on with webhooks off and checks that the webhook route answers 404.
- **P14d-12** — the uninstallation reaches skrum as GitHub's `installation` `deleted` webhook, confirmed by a faked 404 of `GET /app/installations/4242`; the card is reloaded to show it (the integrations page has no realtime channel).
````

If a defect was found and fixed under the Defect rule, add its line under `## Defects found`.

- [ ] **Step 4: Add the residual entries**

In `docs/superpowers/walkthroughs/residual-manual-checklist.md`, append a section per walkthrough of this plan (heading `## <walkthrough title>` as in the coverage table) and distribute these entries under them by identifier:

````markdown
- **P12a-02b** — "Connect Slack, pick a channel on Slack's screen … 'skrum is connected.' arrives in the channel". Not automated: the OAuth consent and the channel picker are Slack's own pages, and whether the message appears in a channel can only be seen in a real workspace (browser test spec §1, real provider tenants). `P12a-01a` asserts that the "Connect" link points to the authorisation route and `P12a-02a` asserts the request skrum sends. Check by hand: with a real Slack app in `.env`, click "Connect" on the Slack card, choose a channel on Slack's screen, confirm the card turns "Connected" with the workspace and channel names, click "Send a test message" and read "skrum is connected." in that channel.
- **P12a-03b** — "add the bot to a group … 'Send a test message' arrives". Not automated: adding the bot and typing the command happen inside Telegram, and the arrival of the message is only visible there. `P12a-03a` feeds the same command through `skrum:telegram-poll`. Check by hand: with a real bot token and `schedule:work` running, click "Connect", add the bot to a group, send the shown command in the group, confirm the bot answers "Connected to the … team", the card turns "Connected" within seconds, and the test message arrives in the group.
- **P12a-04b** — "Jira: 'Connect (read only)' … 'Upgrade to read and write'". Not automated: both links lead to Atlassian's consent screen. `P12a-04a` starts from a read-only connection and asserts the upgrade link's target. Check by hand: connect Jira read only with a real Atlassian 3LO app, confirm the site and the story points field are shown, click "Upgrade to read and write", accept on Atlassian's screen and confirm the card shows "Read and write" with the people and priorities panels.
- **P12a-05b** — "Linear: connect read and write". Not automated: the consent screen is Linear's. `P12a-05a` covers "Test the connection" on an arranged connection. Check by hand: connect Linear with read and write access using a real Linear OAuth app, confirm the workspace name and "Read and write", then click "Test the connection" and read "The connection works.".
- **P12a-06b** — "Revoke Skrum from Slack's app management page". Not automated: the revocation is done in Slack's interface. `P12a-06a` makes `auth.test` answer `token_revoked`, which is what Slack answers afterwards. Check by hand: remove the app in the Slack workspace's app management page, run `vendor/bin/sail artisan skrum:check-integrations`, reload the integrations page and confirm the Slack card shows "Reconnect required" with Slack's error.
- **P12a-07b** — "the Telegram bot leaves the group". Not automated: only the Telegram group shows that the bot left. `P12a-07a` asserts that skrum called `leaveChat` for the chat. Check by hand: disconnect Telegram on the integrations page and confirm in the group's member list that the bot is gone.
- **P12b-01d** — "Both chats show the invitation with a button". Not automated: how Slack and Telegram render the message is only visible in a real workspace and a real group. `P12b-01a` asserts the text, the button label and the URL of both payloads. Check by hand: with Slack and Telegram connected and a queue worker running, post a board link to both and confirm each chat shows the sentence and a button or link that opens the board, or the join page when "Include the guest link" was ticked.
- **P12b-02b** — "Slack shows the text literally and pings nobody; Telegram shows the tags as text". Not automated: the absence of a notification and the literal rendering are behaviours of Slack and Telegram. `P12b-02a` asserts the escaped payloads. Check by hand: name a retro `<!channel> & <b>test</b>`, post its link to both chats, and confirm that Slack shows the title as typed without notifying the channel and that Telegram shows `<b>test</b>` as text, not in bold.
- **P12b-03b** — "the Slack and Telegram recaps show counts, action items with '(guest)', no author name" as rendered in the chats. Not automated: the layout of the recap blocks in Slack and of the HTML message in Telegram is only visible there. `P12b-03a` asserts the content of both payloads. Check by hand: complete an anonymous retro with cards, votes, an action item assigned to a guest and ROTI answers, share it to both chats, and read the recap in each: a participant count, the action items with their assignees, the top card of each column, and no card author.
- **P12b-04b** — "each participant receives the mail in their own language". Not automated: the browser test fakes notifications, so no mail is rendered or delivered; it asserts the recipients and the locale each mail is sent in. The mail's content is covered by `tests/Feature/Integrations/ResultsEmailTest.php`. Check by hand: with Mailpit as the mailer and a queue worker running, send the results to participants whose accounts use different languages, and read each mail in Mailpit: the subject and body are in the recipient's language and no mail goes to a guest.
- **P12b-06b** — "Archive the Slack channel (or revoke the app)". Not automated: archiving is done in Slack. `P12b-06a` makes the webhook answer 410 `channel_is_archived`, which is Slack's answer for an archived channel. Check by hand: archive the connected channel in Slack, post a board link, and confirm the failed line in the dialog and "Reconnect required" on the integrations page.
- **P14a-04b** — the messages as Teams and Mattermost render them: "`@channel` in a card rendered literally", and the Adaptive Card's escaped Markdown. Not automated: plan 14a's self-review states that the rendering of backslash escapes in an Adaptive Card "is only verifiable in the walkthrough"; whether Mattermost notifies the channel is a behaviour of the server. `P14a-03a`, `P14a-03b` and `P14a-04a` assert the payloads. Check by hand: with a real Teams workflow and a real Mattermost incoming webhook, send a test message, a board link, a room invite and the recap of an anonymous retro whose top card contains `@channel` and `*stars*`; confirm in both tools that the text appears as typed, that nobody is notified, that the button opens skrum, and that participants appear as a count.
- **P14a-05b** — "break the Teams URL (delete the workflow)". Not automated: the workflow is deleted in Power Automate. `P14a-05a` makes the workflow host answer 404, which is what a deleted workflow answers. Check by hand: delete the workflow in Teams, post a board link, and confirm the failed line and "Reconnect required" with "The Teams workflow URL no longer works. Paste a new one." on the integrations page; paste a new workflow URL with "Replace URL" and confirm the card turns "Connected".
- **P12c-04r** — "Jira shows 5 story points" (and, for step 5, Linear shows the whole-number estimate). Not automated: reading the value inside Jira's or Linear's own interface needs a real tenant, which the browser test spec puts out of scope (§1). `[P12c-04]` and `[P12c-05a]` assert the request skrum sends. Check by hand: with a team connected to a Jira Cloud and a Linear test workspace and a queue worker running, save 5 on an imported Jira task and 8 on an imported Linear task; open each issue in its tracker and confirm that the story points field shows 5 and the Linear estimate shows 8.
- **P12c-07r** — "Rename an issue in Jira, then 'Refresh from Jira' … delete an issue in Jira and refresh". Not automated: the rename and the deletion happen inside Jira's interface, and Jira's real answer for a deleted id (a refused `id in (…)` search) is only produced by a real site. `[P12c-07a]` and `[P12c-07b]` simulate the effect with the faked search answer. Check by hand: import two issues of a real sprint, rename one in Jira and choose "Refresh from Jira": the title changes; delete the other in Jira and refresh again: the toast says one task was not found and the task shows "Not found in Jira".
- **P12c-09** — "From Claude Code with an MCP token: `poker.sources.list`, `poker.iterations.list` (without and with a board id), `poker.game.tasks.import` with a JQL query, `poker.game.task.sync` on the Jira task". Not automated: Claude Code or any other MCP client as an actor is out of scope (spec §1); the four tools stay covered by `tests/Feature/Mcp/TrackerToolsTest.php`. Check by hand: issue an MCP token with write scope for a team connected to Jira, add the server to Claude Code, and ask it to list the sources, list the sprints of a board, import the result of a JQL query into a game and sync an estimated Jira task; confirm the tasks appear in the open game and the task shows "Synced to Jira".
- **P12d-01r** — "Connect Jira and Linear with 'Read and write' on a team; the People panel shows 'Matching…' then members matched by email". Not automated: the OAuth redirect to Atlassian and Linear cannot be followed against a fake, and the matching that a new connection starts by itself needs the provider's real user directory. `[P12d-01]` starts the same job with the "Match by email" button against a faked directory. Check by hand: with the Jira and Linear client ids configured, connect both with "Connect (read and write)" on a team whose members exist in both tools; the "Match by email" button shows a spinner and is disabled, then the members whose email matches show "Matched by email" and the one whose Jira email differs stays "Not mapped".
- **P12d-03r** — "the issue exists in Jira with the assignee, the priority, the due date and the link back" (and, for step 4, "the issue is unassigned" in Linear; for step 6, "the issue says 'Added outside a retro on …'"). Not automated: looking at the created issue inside Jira or Linear needs a real tenant. `[P12d-03]`, `[P12d-04]` and `[P12d-06]` assert the creation request skrum sends. Check by hand: export one item to a real Jira project and one guest-assigned item to a real Linear team; open the issues and confirm the assignee, the priority, the due date, the description with the retro's title and the link back to skrum, and that the Linear issue has no assignee.
- **P12d-07r** — "Revoke the skrum app in Linear". Not automated: the revocation is done in Linear's settings. `[P12d-07]` simulates Linear's answer after a revocation. Check by hand: in Linear, open Settings, Applications, and revoke skrum; export another item to Linear: the toast says "Reconnect Linear in the team settings." and the team's integrations page shows "Reconnect required" on the Linear card.
- **P14b-01r** — "Connect a webhook, copy the secret, send Test, and verify the signature with the snippet" against a public request inspector. Not automated: a real receiver is out of scope (spec §1), and `Http::fake()` bypasses curl, so the address pinning, the refusal of redirects and the 10 second timeout of `WebhookClient` are never exercised by a test. `[P14b-01]` proves the signature with the secret shown in the interface. Check by hand: on an instance with `OUTGOING_WEBHOOKS_ENABLED=true`, connect a webhook to a hosted request inspector over HTTPS, copy the secret, send a test message, and recompute `sha256=` + HMAC-SHA256 of `X-Skrum-Timestamp + "." + raw body` with the secret in the inspector or a terminal; it must equal `X-Skrum-Signature`. Then make the inspector answer with a 302 redirect and check that the test message fails without following it.
- **P15-01r** — "open Deliveries → View and check the headers (signature masked), body and response" against a real receiver. Not automated: with faked HTTP the response body stands in for the excerpt that curl's write callback collects, so the 2 KB limit on a real answer is not exercised in the browser suite (the excerpt is covered by `tests/Feature/Integrations/WebhookPayloadsTest.php` and `tests/Feature/Integrations/WebhookClientTest.php`). Check by hand: point the webhook at a receiver that answers with more than 2 KB of text, complete an action item, open Deliveries → View → Response, and check that the excerpt stops at about 2 KB and that the Request tab shows the signature as `sha256=…` plus six characters.
- **P11b-03a** — "claude mcp add … then /mcp: skrum is connected and lists 25 tools (22 without an LLM provider) and the prompts analyze-retro and team-health". Not automated: Claude Code as an actor is out of scope (spec §1). Covered by the MCP feature tests under tests/Feature/Mcp (`CatalogueTest.php`, `McpAuthenticationTest.php`). Check by hand: run the `claude mcp add` command shown in the new-token dialog, then `/mcp` in Claude Code, and count the tools and prompts.
- **P11b-04** — "Ask: What did the Demo Team agree on in its last retrospective? … no email address appears in any tool result". Not automated: Claude Code as an actor. Covered by the MCP feature tests under tests/Feature/Mcp (`RetroListToolsTest.php`, `MessagesAndSummaryTest.php`, `ReadPrivacyTest.php`). Check by hand: ask the question in Claude Code and inspect the tool output for names without email addresses.
- **P11b-05** — "Insights (LLM configured): retro.board.insights.list returns themes and suggested actions". Not automated: Claude Code as an actor and a real LLM provider. Covered by the MCP feature tests under tests/Feature/Mcp (`InsightsHealthRotiTest.php`). Check by hand: complete the demo retro with the AI summary on, wait for the summary, ask Claude for the insights of that retro.
- **P11b-06** — "Promote a suggestion: A sees the new action item appear live; asking again → This suggestion was already handled.". Not automated: Claude Code as an actor. Covered by the MCP feature tests under tests/Feature/Mcp (`SuggestionToolsTest.php`, `McpBroadcastsTest.php`). Check by hand: keep the board open on the Results view, ask Claude to promote one suggested action, watch the item appear without a reload, ask again.
- **P11b-07** — "Overdue items and completion: list my overdue action items, then complete it; A sees the item turn completed live". Not automated: Claude Code as an actor. Covered by the MCP feature tests under tests/Feature/Mcp (`RetroListToolsTest.php`, `ActionItemWriteToolsTest.php`, `McpBroadcastsTest.php`). Check by hand: give an item a past due date in the browser, ask Claude to list overdue items and to complete it, watch the browser.
- **P11b-08** — "Hidden cards: B's card is hidden and Secret draft appears in no result, including retro.boards.search". Not automated: Claude Code as an actor. Covered by the MCP feature tests under tests/Feature/Mcp (`ReadPrivacyTest.php`, `MessagesAndSummaryTest.php`, `SearchBoardsTest.php`). Check by hand: write "Secret draft" as another member during Writing, ask Claude to list that board's messages and to search for "Secret".
- **P11b-09** — "Anonymous authors: the messages list shows the card's content with no author, while action items stay named". Not automated: Claude Code as an actor. Covered by the MCP feature tests under tests/Feature/Mcp (`ReadPrivacyTest.php`, `MessagesAndSummaryTest.php`). Check by hand: on an anonymous retro in Discussing, ask Claude for the messages and the action items.
- **P11b-10** — "Poker tasks: create a poker game MCP game for Demo Team and add five stories". Not automated: Claude Code as an actor. Covered by the MCP feature tests under tests/Feature/Mcp (`PokerWriteToolsTest.php`). Check by hand: ask Claude, then open the game from the team page and check the five tasks in order and the facilitator.
- **P11b-11** — "Select, vote, reveal: no card value before reveal; A and B see the cards turn over live and the estimate 8". Not automated: Claude Code as an actor. Covered by the MCP feature tests under tests/Feature/Mcp (`PokerWriteToolsTest.php`, `PokerReadToolsTest.php`, `McpBroadcastsTest.php`). Check by hand: vote 5 and 8 in two browsers, ask Claude for the state, then to reveal.
- **P11b-12** — "Anonymous round: round.votes carry no one's value except A's own, result.distribution holds both values". Not automated: Claude Code as an actor. Covered by the MCP feature tests under tests/Feature/Mcp (`PokerWriteToolsTest.php`). Check by hand: turn on anonymous votes, re-vote, ask Claude to reveal and read the tool result.
- **P11b-13** — "No voting through MCP: Claude has no tool to vote or to set the estimate directly". Not automated: Claude Code as an actor. Covered by the MCP feature tests under tests/Feature/Mcp (`PokerWriteToolsTest.php`, `CatalogueTest.php`). Check by hand: ask Claude to vote 3 and to set the estimate to 13.
- **P11b-14** — "Delete own message: the card disappears live; deleting B's card → Not found.". Not automated: Claude Code as an actor. Covered by the MCP feature tests under tests/Feature/Mcp (`MessageWriteToolsTest.php`, `McpBroadcastsTest.php`). Check by hand: ask Claude to delete one of your own cards during Writing, then a card of another member.
- **P11b-15b** — "connect it as skrum-ro: only read tools are listed, and asking about Demo Team's boards returns nothing". Not automated: Claude Code as an actor. `[P11b-15a]` covers creating the read-only token bound to another team. Covered by the MCP feature tests under tests/Feature/Mcp (`CatalogueTest.php`, `McpGrantIsolationTest.php`, `ToolBaseTest.php`). Check by hand: add the second token as `skrum-ro` in Claude Code, list its tools, ask about a board of Demo Team.
- **P11b-18b** — "with A's locale French, a refused tool call comes back in French". Not automated: Claude Code as an actor. `[P11b-18a]` covers the page and its dialogs. Covered by the MCP feature tests under tests/Feature/Mcp (`McpAuthenticationTest.php`, "answers in the user locale"). Check by hand: set the language to French, ask Claude to delete a card of another member, read the refusal.
- **P14c-01b** — "connect a Jira DC test server with OAuth (read, then read and write)". Not automated: the consent screen belongs to the Jira server, and a browser test cannot follow a redirect to a faked provider (spec §1, real provider tenants). `[P14c-01]` covers the two connect links and the card of an OAuth connection. Check by hand: with `JIRA_DC_BASE_URL`, `JIRA_DC_CLIENT_ID` and `JIRA_DC_CLIENT_SECRET` pointing at a Jira Data Center 8.22 or later, click "Connect (read only)" as a workspace Admin, approve in Jira, and confirm that the card shows the server title, the version, "Read only" and "Signed in with OAuth"; then click "Upgrade to read and write", approve, and confirm "Read and write".
- **P14c-07b** — "install the GitHub App on a test org". Not automated: the installation and the authorisation happen on github.com (spec §1, real provider tenants). `[P14c-07]` covers the install link and the connected card. Check by hand: with the `GITHUB_APP_*` variables of a real GitHub App set, click "Install the GitHub App", choose a test organisation and a repository on GitHub, and confirm that skrum returns to the integrations page with the account name and "Read and write" on the card.
- **P14c-11** — "clear the estimate (block removed)". Not automated: the interface has no control that clears an estimate; the facilitator toolbar only offers the cards of the deck, and clearing exists on `PUT /poker/{game}/tasks/{task}/estimate` with `value: null` only (planning poker spec §4, item 6). The removal of the block is covered by the feature test "removes the block when the estimate is cleared" in `tests/Feature/Integrations/GitHubTrackerTest.php`. Check by hand: against a real repository, estimate an imported issue, then send `PUT /poker/{game}/tasks/{task}/estimate` with `{"value": null}` from the browser's console as the facilitator, and confirm on GitHub that the block and the blank line before it are gone and the rest of the description is unchanged.
- **P14d-13** — "With a public `APP_URL` and each provider's webhook set up (`.env.example`) … the item completes within seconds". Not automated: real Jira Cloud, Jira Data Center, Linear and GitHub tenants delivering webhooks to a public address, the reachability check on `APP_URL` (DNS resolution to a public address), the reconnection that grants the Jira webhook scope, the registration of a webhook in Jira's administration, and the delay between a change in the provider and the change in skrum (spec §1, real provider tenants). The tests replace the provider by a signed request from the test process. Check by hand: on an instance with a public HTTPS `APP_URL`, connect each tracker, turn "Sync status" on, export one action item per tracker; close and reopen each issue in the provider and confirm that the item follows within a few seconds and shows "Completed in :source"; complete and reopen each item in skrum and confirm that the issue follows; on Jira Data Center with a non-administrator token, register the webhook in Jira (System → WebHooks) with the details of the panel, click "I've registered it", change the issue, and confirm that the card says "Live updates (webhooks)".
````

- [ ] **Step 5: Check the table against the tests**

Run: `grep -ohE "\[P[0-9]+[a-z]?-[0-9]{2}[a-z]*\]" tests/Browser/Walkthroughs/*.php | sort -u | wc -l` and `grep -cE "^\| P[0-9]+[a-z]?-" docs/superpowers/walkthroughs/coverage.md`.
Expected: every identifier used in a test title appears in a row (alone or in a row that names its tests); every `auto` or `auto-substituted` row names an identifier that exists in a test title; `grep -cE "\| residual \|$" docs/superpowers/walkthroughs/coverage.md` equals `grep -c "^- \*\*P" docs/superpowers/walkthroughs/residual-manual-checklist.md`.

- [ ] **Step 6: Format the two documents and commit**

Run: `npx vp fmt docs/superpowers/walkthroughs/coverage.md docs/superpowers/walkthroughs/residual-manual-checklist.md`, then check with `git diff --stat` that only these two files changed.

```bash
git add docs/superpowers/walkthroughs/coverage.md docs/superpowers/walkthroughs/residual-manual-checklist.md
git commit -m "docs: add the plan 16e walkthroughs to the coverage table and the residual checklist"
```

### Task 13: Final verification

**Files:**
- Modify: `docs/superpowers/walkthroughs/coverage.md` (verification record at the end)

**Interfaces:**
- Consumes: everything produced by the tasks of this plan.
- Produces: the evidence that this plan's walkthroughs meet the spec's criterion 5 and leave criteria 1, 2, 6, 7, 9 and 10 intact.

Do not claim a result without the output of its command in front of you.

- [ ] **Step 1: Run the browser suite twice**

Run: `composer test:browser && composer test:browser`
Expected: PASS both times with the same number of tests; `lsof -i :8097` prints nothing afterwards. A test that passes once and fails once is flaky: find the missing wait and fix it before continuing.

- [ ] **Step 2: Run the architecture suite and the source scan**

Run: `composer test:arch`
Expected: PASS.

- [ ] **Step 3: Run the whole existing suite and the static checks**

Run: `composer test`, then `composer rector:check`, then `npm run types:check && npm run check`.
Expected: PASS; no browser test listed by `composer test`; Rector reports no change; `npm run check` lists no file touched by this plan.

- [ ] **Step 4: Check what product code changed**

Run: `git diff <first commit of this plan>^..HEAD -- app routes resources/js | grep -E "^[+-]" | grep -vE "^(\+\+\+|---)" | grep -vE "data-test|data-realtime|realtimeState"`
Expected: nothing, except the re-wrapped lines around an added attribute and any `fix(...)` commit made under the Defect rule (list those in the record).

- [ ] **Step 5: Record the verification**

Append to `docs/superpowers/walkthroughs/coverage.md`:

```markdown
## Verification of plan 16e

Date: <YYYY-MM-DD>

| Check | Evidence |
|---|---|
| Browser suite, twice | <n> tests, <seconds> s and <seconds> s |
| Arch suite and source scan | green |
| `composer test` | green, no browser test listed |
| Rector, types, lint | clean |
| Coverage rows of this plan | <n> rows: <n> `auto`, <n> `auto-substituted`, <n> `residual` |
| Product diff | only `data-test` / `data-realtime` (and these defect fixes: <list or "none">) |
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/walkthroughs/coverage.md
git commit -m "docs: record the verification of plan 16e"
```

---

## Appendix: notes from drafting

Nothing in this plan was executed while it was written. The notes below record what was read, what could not be verified, and the fallback for each doubt. Where a note says "the lead", read "whoever executes the plan".

### From `16e-1-sharing.md`

- **`Http::fake` policy and the Reverb host.** The Reverb broadcaster is `PusherBroadcaster` (`vendor/laravel/framework/src/Illuminate/Broadcasting/BroadcastManager.php:341-355`), and the Pusher SDK posts with its own Guzzle client (`vendor/pusher/pusher-php-server/src/Pusher.php:121`), not through Laravel's HTTP client. `Http::fake()` and `Http::preventStrayRequests()` therefore cannot block the broadcast to `127.0.0.1:8097`. With a pattern list, `Http::fake([...])` lets unmatched requests through to the network (`PendingRequest::buildStubHandler`, lines 1834-1839) unless stray requests are prevented. I chose: every file's `beforeEach` calls `Http::preventStrayRequests()` and `Http::allowStrayRequests(['http://127.0.0.1:8097/*'])` (built from `ReverbServer::Host` and `ReverbServer::Port`), so an unfaked provider call fails inside the request instead of reaching the internet, and the Reverb host is allowed explicitly although it does not need it today.
- **Hooks needed (one):** `data-test="integration-card-<provider>"` → `resources/js/components/integrations/integration-card.tsx` (Task 1 Step 1). Tasks 2 and 3 use it; any other section that opens the integrations page (12c, 12d, 14b to 14d, 15) can reuse it instead of adding its own.
- **Dependencies on other sections:** Tasks 2 and 3 call `$this->workQueue()` (plan 16b Task 1) and assume it takes no argument, runs exactly one queued job with `queue:work --once` after rebinding a fresh request, and asserts a successful exit. If its signature differs, adjust the calls. Task 3 `[P14a-03b]` opens `/games/{room}` and relies on `data-realtime` on `games/show`, which plan 16a added. Tasks 2 and 3 must run after Task 1 (hook and build).
- **Fact differing from the brief's suggestion "sync if the code path is sync":** the delivery jobs broadcast with `sendToOthers()` (`app/Models/Retro.php:220-223`, `app/Events/Concerns/SendsToOthers.php`). On the `sync` queue the job runs inside the sharer's request, so the delivery is already `sent` when the dialog refetches and "Sending to …" is never shown; that would pass too, but the `database` queue shows both states and matches the walkthrough's "a queue worker running".
- **Email entry hidden under PHPUnit:** `phpunit.xml` sets `MAIL_MAILER=array`, and `IntegrationAvailability::emailEnabled()` treats `array` and `log` as non-delivering (`app/Support/Integrations/IntegrationAvailability.php:13-18`). `[P12b-04a]` sets `config(['mail.default' => 'smtp'])` and `Notification::fake()`; `Mail::fake()` would record nothing, because the results mail is a notification, not a mailable.
- **A share section with a single channel vanishes on failure** (`resources/js/components/integrations/share/post-link-section.tsx:41-43`, `share-board-button.tsx:17-19`): the failed line is then never shown. This is arguably a product gap against integrations spec §13 ("the delivery line turns to failed"); the tests avoid it by keeping a second channel, as both walkthroughs do. Flag it for the user if a decision is wanted.
- **The 12a walkthrough's OAuth steps** produce six residual rows; that is the spec's rule (real tenants), not a harness limit that could be lifted cheaply: the state lives in the session and the redirect leaves the application.
- UNVERIFIED: `click('Share')` and `click('Invite')` rely on exact visible-text matching finding the header button first. Fallback: `header button:has-text("Share")`, `header button:has-text("Invite")`.
- UNVERIFIED: `assertSee('403')` and `assertSee('404')` assume Laravel's default error views (no `resources/views/errors` and no Inertia error page exist in this repo). Fallback: assert only `assertNotPresent('[data-test^="integration-card-"]')` plus `assertPathIs(...)`.
- UNVERIFIED: `queue:work --once` exits with 0 when the job ends through `$this->fail()` (`[P12b-06a]`, `[P14a-05a]`). Fallback: in those two tests call `p10bWorkQueueOutsideAnyRequest`-style code without `assertSuccessful()`, or have `workQueue()` not assert the exit code.
- UNVERIFIED: `Notification::fake()` passing the locale as the fourth closure argument is copied from `tests/Feature/Integrations/ResultsEmailTest.php` ("sends each mail in the recipient's locale"); the facilitator's own locale is asserted as `'en'` because the helper sets it. If the fake reports `null` for a user whose locale equals the app locale, drop the `$locale === 'en'` condition.
- UNVERIFIED: the Telegram card's poll (`usePoll(5000, …, { autoStart: false })`, started after the code is issued) reaching the server within the 20-second browser timeout after `skrum:telegram-poll` ran. Fallback: `$page->navigate(p12aIntegrationsPath($team))` before asserting the badge (the "Telegram connected." toast assertion must then be removed, since it only fires on the polling page).
- UNVERIFIED: `$page->text("{$telegram} code")` returning the command without surrounding whitespace. Fallback: wrap it in `trim()`.
- UNVERIFIED: `assertSourceMissing()` reads the document's HTML after `navigate()`; if it reads the live DOM instead, the assertion still holds (the URL is in neither).
- UNVERIFIED: Radix `Select` on the Jira card (`[aria-label="Story points field"]` then `[role="option"]:has-text("Business value")`), by analogy with the brief's Radix select idiom; the last `click($field)` in `[P12a-04a]` reopens the select right after a reload of the `providers` prop, so if the option list is not found, assert the detected fields from the database only (already done on the next lines).
- UNVERIFIED: the standalone Hangman room page renders its header for a host before any round exists (`[P14a-03b]`). Fallback: arrange a round with `activeGameRound($room)` from `tests/Pest.php`.
- I did not run anything (read-only brief); all selectors and texts were read from the `.tsx` and PHP sources named in the task headers.

### From `16e-2-trackers-export.md`

- **Finding on `Http::fake` and the broadcaster.** In Laravel 13.34 `Http::fake([...patterns])` registers one stub callback per pattern (`vendor/laravel/framework/src/Illuminate/Http/Client/Factory.php:331-349`, `stubUrl()` at 395); a URL no pattern matches gets no stub and is sent as a real request, unless `Http::preventStrayRequests()` was called. `tests/TestCase.php` and `tests/BrowserTestCase.php` do not call it. The Reverb broadcast is not affected in either case: `BroadcastManager` builds the Pusher SDK with its own `GuzzleHttp\Client` (`vendor/laravel/framework/src/Illuminate/Broadcasting/BroadcastManager.php:365-376`), and `PusherBroadcaster` never uses the `Http` facade. So faking provider hosts cannot break the call to `127.0.0.1:8097`.
- **Consequence written into the helpers.** A stray request to `api.atlassian.com` with the factory's token would be a real call answered 401, which makes skrum mark the connection "Reconnect required" (`TeamIntegration::withReconnectHandling()`, `app/Models/TeamIntegration.php:211`). `p12cFakeJira()` and `p12dFakeJira()` therefore end with the catch-all `'api.atlassian.com/*' => 404`; Linear has a single URL and `fakeLinearGraphql()` already answers unknown queries with status 400. Because stubs are tried in registration order, each test calls each provider's fake once. I did not use `Http::preventStrayRequests()`: the retro board requests emoji data from a CDN through the `Http` facade (`app/Http/Controllers/EmojiDataController.php:66`), and a blanket prevention would turn that into a 500.
- **Hooks.** None. No product file changes in Tasks 4 to 6.
- **Dependencies.** Tasks 5 and 6 call `$this->workQueue()` and assume the signature `workQueue(): void` running exactly one job (plan 16b, Task 1). If plan 16b names or shapes it differently, replace the six calls (five in `Plan12cPokerTrackersTest.php`, one in `Plan12dActionItemExportTest.php`). If 16e may be executed before 16b, define a local helper with the body of `p10bWorkQueueOutsideAnyRequest()` instead. Task 5 depends on Task 4 (same file). Nothing here calls the `p10a*`, `p10b*` or `plan04*` helpers.
- **Brief vs code.** The brief speaks of a "needs sync" state; the interface's words are "Sync pending", "Sync failed", "Synced to <Source>" and "Not synced: <reason>" (`resources/js/components/poker/task-source-details.tsx`). The brief suggests reading the CSRF token "from the meta tag or cookie": `resources/views/app.blade.php` has no CSRF meta tag, so the script reads the `XSRF-TOKEN` cookie, as the Inertia client does.
- **Import button for members.** Every signed-in player, not only the facilitator, gets the Import button (`canImport = me.canEditTasks && …`, `tasks-pane.tsx`); the walkthrough does not say otherwise, so no test asserts its absence for a member.
- UNVERIFIED: a Radix select opened before its options have loaded (the board and team lists arrive 300 ms after the dialog opens) is expected to render the options when they arrive, and the retried click on `[role="option"]` to find them. Fallback: before opening the select, type the first letters of the name into `#import-container-search` and assert the trigger is visible again, which forces a fresh request, or close and reopen the select with `keys('[aria-label="Choose a board"]', 'Escape')` followed by a second click.
- UNVERIFIED: toasts (sonner) are asserted with `assertSee()` directly after the action; they stay on screen about four seconds. Fallback: drop the toast assertion and keep the state assertion that follows it (every test has one).
- UNVERIFIED: `$page->script()` returning the string resolved by an `async` arrow function (`[P12d-05]`). The harness findings say `script()` awaits a returned promise; a returned value from an async function was not probed. Fallback: have the script store the result in `window.__p12dAnswers` and read it with `assertScript('window.__p12dAnswers', '201: / 409:Already exported as PROJ-42.')`.
- UNVERIFIED: in `[P12d-05]` the page that sent the two `fetch()` requests learns of the new link only through the `action-item.external-links.changed` broadcast (the requests carry no `X-Socket-ID`, so nobody is excluded). Fallback: assert the chip after `$page->navigate("/retros/{$retro->id}")`.
- UNVERIFIED: `p12dCard()` relies on `data-slot="card"` and `data-slot="card-title"` of `resources/js/components/ui/card.tsx`, and on only the enabled providers having a card (`IntegrationProvider::enabled()` in `TeamIntegrationsController::index`). Fallback, if a selector matches two cards: add `data-test={`integration-card-${card.provider}`}` to the `<Card>` in `resources/js/components/integrations/integration-card.tsx` as a hook step and use `@integration-card-jira`.
- UNVERIFIED: `p12dBoard()` creates one column so that the board has something to render; whether `RetroFactory` already creates columns was not checked. A second "Start" column would be harmless.
- UNVERIFIED: `[P12d-06]` opens the global page with `?item=<id>` so that the item is shown whatever the default filters are; the card is expected to carry `id="action-item-<id>"` there as on the board (`action-item-card.tsx:173`). Fallback: address the card by `li:has-text("Book the room")`.
- UNVERIFIED: Pint's `no_unused_imports` counts a class used only in a docblock (`PokerPlayer` in Task 4, Step 1 before Task 5 uses it in a signature) as used, as it does in `Plan10aPokerCoreTest.php`. If Pint removes the import, Task 5 Step 1 adds `use App\Models\PokerPlayer;` back.

### From `16e-3-webhooks-tokens.md`

- **Hooks introduced:** none. All three files use existing ids, aria-labels, roles and English text. No `.tsx` edit, so no `npm run build` step in these tasks.
- **Dependency on plan 16b Task 1:** Tasks 7 and 8 call `$this->workQueue()` with no argument and expect it to run exactly one queued job outside any request (the body of `p10bWorkQueueOutsideAnyRequest()` in `tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php`). It must be callable several times in a row and must return normally when the job throws (a 5xx answer makes `DeliverToChannel::handle()` rethrow `ProviderUnavailable`) and when no job is due. If the helper takes an argument or has another name, adjust the 18 call sites of Tasks 7 and 8.
- **No dependency between Tasks 7, 8 and 9:** each file declares its own helpers (`p14b…`, `p15…`, `p11b…`); `p15Team()`, `p15Webhook()` and `p15IntegrationsPath()` deliberately repeat the bodies of their `p14b` twins so that either file can be run alone.
- **Spec and brief differences found, with evidence:**
  - Password confirmation is on the page, not on the "Create token" button: `routes/settings.php:33-35` puts `RequirePassword` on `GET settings/api-tokens`.
  - `/mcp` answers 404 at run time when `skrum.mcp.enabled` is false, through `EnsureMcpIsEnabled` in the route's middleware (`routes/ai.php:13`); the `if (config('skrum.mcp.enabled'))` around the registration (`routes/ai.php:10`) is evaluated at boot, when the value is still true in tests. `tests/Feature/Mcp/McpAuthenticationTest.php:102` relies on the same behaviour.
  - A delivery that fails after its retries stores "Webhook did not respond. Try again later.": `app/Jobs/Integrations/DeliverToChannel.php:112` uses `userMessage()`, and `app/Exceptions/Integrations/ProviderUnavailable.php` returns that sentence.
  - "Send a test message" writes no delivery row: `app/Http/Controllers/Integrations/IntegrationTestsController.php` calls `$webhooks->send($integration, WebhookMessage::test())` without a delivery.
  - Redeliver is hidden, not refused, for a disabled webhook or a queued delivery (`resources/js/components/integrations/webhook-deliveries-panel.tsx:163`), so the 409 messages need a state change after the log is loaded.
- **Existing helpers of `tests/Pest.php` called from the browser files:** `disableIntegrations`, `enableIntegrations`, `outgoingWebhookResolves`, `outgoingWebhookSignatureIsValid`, `integrationAdmin`, `retroMember`, `teamMember`, `webhookTopCard`, `pokerVote`, `issueTestMcpToken`, `postMcp`. None of them uses `actingAs()` or a cookie. `postMcp()` calls `test()->postJson(...)`; the Arch source scan looks for `actingAs(`, `withCookie(`, `withCookies(` and `Event::fake()` in files under `tests/Browser` only, so it stays green.
- UNVERIFIED: `queue:work --once` (through `$this->workQueue()`) returns exit code 0 when the job throws and is released with its backoff, and the released job is picked up after `$this->travel(n)->seconds()`. Plan 16a proved only the delayed-job case (`[P10b-08a]`). Fallback: in `[P14b-04a]`, `[P14b-04b]` and `[P15-02]`, answer 404 instead of 500/503 (a 4xx fails at once, no retry) and assert `Failed | 1 | 404 | The receiver answered 404.`; move "watch the retries" to the residual checklist with a pointer to `tests/Feature/Integrations/WebhookEventsTest.php` ("keeps X-Skrum-Delivery across retries and signs each attempt").
- UNVERIFIED: a job run by `workQueue()` that calls `announceDeliveryChange()` reaches the board page, so "Sent to Webhook" appears in `[P14b-02a]` without a reload. Fallback: replace that last assertion by `expect(IntegrationDelivery::query()->sole()->status)->toBe(IntegrationDeliveryStatus::Sent)` (and add the `IntegrationDeliveryStatus` import in Step 3 instead of Step 7).
- UNVERIFIED: `test()->postJson('/mcp', …)` issued between two browser requests of the same test does not disturb the browser's session (it fires `RequestHandled`, which only forgets guards and flushes loaded session attributes). Fallback: issue the `postMcp()` calls before the first `signIn()` and after the last page assertion, which `[P11b-16]` and `[P11b-17]` already nearly do; `[P11b-03b]` would then open the page only after the request and lose its "Never" check.
- UNVERIFIED: the games page of a Hangman room with one player renders its header with the "Invite" button for a workspace admin (`[P14b-02b]`); no browser test has opened `games/show` in this file's arrangement. Fallback: take the room arrangement of the plan 13a walkthrough tests once they exist.
- UNVERIFIED: `Http::fake()` with a closure capturing `$status` by reference (`[P14b-04b]`) is evaluated on every request. Fallback: `Http::fakeSequence('hooks.example.com/*')->push('', 500)->push('', 500)->push('', 500)->push('', 500)->push('', 204)`.
- UNVERIFIED: Laravel's default 404 page shows "Not Found" for an authenticated HTML request with `app.debug` forced to false (`[P11b-17]`). Fallback: keep only `assertNotPresent('#mcp-url')` and `assertDontSee('Server URL')`.
- The redelivery throttle (lead's optional item) is left to the feature test; nothing in the browser adds to it.

### From `16e-4-dc-github-sync.md`

- **No product change.** Tasks 10 and 11 add no `data-test` hook and no `data-realtime`: every test enables exactly one provider, so the integrations page shows one card; action items are addressed by their existing `#action-item-{id}`; the chip's `sr-only` text is read with `assertScript()`.
- **Dependencies on other sections.** Both tasks need `$this->workQueue(): void` (plan 16b Task 1); Step 1 of Task 10 checks for it. If plan 16b is not merged first, replace each `$this->workQueue();` by a file-level helper with the body of `p10bWorkQueueOutsideAnyRequest()` (`app()->instance('request', Request::create('/'))` then `$this->artisan('queue:work', ['--once' => true])->assertSuccessful()`). Neither task needs `data-realtime` on `action-items/index` (plan 16b Task 6): all live assertions are on the retro board and the poker page.
- **How inbound webhooks are enabled and signed** (asked for in the assignment): `p14dEnable()` sets `services.integrations.inbound_webhooks` to `on`, `services.linear.webhook_secret` to `linear-webhook-secret` and `services.github_app.webhook_secret` to `github-webhook-secret` with `config([...])`, first thing in each test. Events are raw-body requests from the test process (`test()->call('POST', $url, [], [], [], $server, $body)`), signed as `ReadInboundEvent` verifies them: GitHub `X-Hub-Signature-256` (`sha256=` HMAC), Linear `Linear-Signature` (HMAC) with a fresh `webhookTimestamp`, Jira the 40-character URL token stored in `credentials.webhookToken`, Jira Data Center the URL token plus `X-Hub-Signature`.
- **Facts that differ from the brief or the assignment** (evidence):
  - Non-administrator Jira Data Center accounts are detected by `mypermissions`, not by a 403 on the registration: `app/Support/Integrations/TrackerWebhooks.php:357-364`.
  - `completedVia` is not broadcast, so "Completed in :source" is not live: `app/Actions/Retros/PresentActionItem.php:58`, `resources/js/lib/retro/board-reducer.ts:339-342`. The feature spec (§9) says an item completed from the source "shows 'Completed in :source' next to its completion time" without saying when. If the lead judges that it must appear live, this is a defect to handle under the Defect rule; the tests as written pass either way.
  - The interface cannot clear an estimate (`resources/js/components/poker/facilitator-toolbar.tsx:162-188`), so one walkthrough item of plan 14c is residual for a reason that is not in spec §1's list.
  - The connected OAuth card of Jira Data Center offers no token dialog (`resources/js/components/integrations/jira-data-center-integration.tsx:125-131`).
  - `InboundModes` keeps the reachability answer per instance (`app/Support/Integrations/InboundModes.php:111-119`), which is why the mode is configured before anything else.
- **Design choices worth a second look.**
  - Both helpers call `Http::preventStrayRequests()`, so that a request missing from a fake fails loudly instead of leaving for `jira.example.com`. Each test ends its fakes with a catch-all for the provider's host, because the connected cards load priorities on their own.
  - The queue is drained with `while (p14xDueJobs() > 0) { $this->workQueue(); }`. The loop ends because a failed or released job gets a later `available_at`. If `workQueue()` of plan 16b already drains the queue, the loop simply runs it once.
  - `[P14d-05a]` and `[P14d-05b]` call `travelTo()` with a time inside the current minute, never a fixed date.
- **UNVERIFIED items and their fallbacks** (nothing below was run; the repository was read-only):
  - UNVERIFIED: `test()->call('POST', …)` from inside a browser test (a request through the kernel of the application the plugin also serves). Fallback: replace `p14dPostWebhook()` by `visit()`-free dispatching of what the controller does, `dispatch(new ApplyInboundIssueChanges($integration->id, [$externalId]))`, and keep one signed request per provider as a feature test (they already exist in `tests/Feature/Integrations/InboundWebhooksTest.php`).
  - UNVERIFIED: `Http::preventStrayRequests()` during browser requests (a page of the walkthrough could make a server-side HTTP call that no fake covers). Fallback: remove the call from `p14cEnable()` and `p14dEnable()`; the catch-all fakes stay.
  - UNVERIFIED: a frozen clock (`travelTo()`) through sign-in and a realtime page in `[P14d-05a]` and `[P14d-05b]`. Plan 10b's tests use `travel()` after sign-in, not before. Fallback: drop `travelTo()` and compute the two timestamps from `now()->subSeconds(40)`; the comparison only uses the arranged values.
  - UNVERIFIED: the members-only event `action-item.external-links.changed` reaching the board after `awaitRealtime()` (the private `retro-members.{id}` subscription completes moments after the presence one). It carries the chip texts asserted with `p14dCardSays()`. Fallback: assert the chip text after a `navigate()`, as the tests already do for "Completed in :source".
  - UNVERIFIED: Radix `Select` options that are loaded after the list was opened (the board and repository selects of the import dialog load 300 ms after the dialog opens). Fallback: before opening the select, wait with `assertScript()` on a marker the list produces, or press `Escape` and reopen.
  - UNVERIFIED: the chip text for GitHub. `[P14d-08a]` asserts only "in GitHub" because the status name comes from GitHub's `state` field (`closed`); if the wording differs, assert the link row in the database only.
  - UNVERIFIED: `label:has-text("…") button[role="checkbox"]` for the Radix checkboxes of the status sync section and the token dialog, and `a:has-text("…")` with `assertAttributeContains()`. Fallback: adding an `aria-label` is not allowed by criterion 10, so address the checkbox by position instead (`section:has-text("Status sync") [role="checkbox"] >> nth=0`), or add a `data-test` hook to the two checkboxes in a step of its own.
  - UNVERIFIED: the count in `Expected: PASS (N tests)` for `[P14d-03b]` (a dataset of two runs counted as two tests).
