# Plan 12c — Poker import, refresh, estimate write-back and MCP tracker tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poker players who can add tasks import Jira sprint/JQL issues and Linear cycle/search issues into a game (title, description, assignee, source estimate; duplicates skipped, 200-task limit atomic), refresh them from the source on demand, and every estimate the facilitator saves on an imported task is written back to Jira's story points field or Linear's estimate by a queued job with pending/failed/unsupported states and a retry — the same services back the four MCP tracker tools `poker.sources.list`, `poker.iterations.list`, `poker.game.tasks.import` and `poker.game.task.sync`.

**Architecture:** Provider specifics live behind one `App\Support\Integrations\Trackers\IssueTracker` interface (`JiraTracker`, `LinearTracker`, resolved by `Trackers::for()`), built on Plan 12a's `JiraClient::get/post/put` and `LinearClient::query`; Jira descriptions go through `AdfToMarkdown`. Actions in `app/Actions/Integrations/` (`ResolvePokerTracker`, `ListPokerIterations`, `PreviewPokerImport`, `ImportPokerTasks`, `RefreshPokerTasks`, `ListPokerSources`, `RequestEstimateSync`, `PokerTaskSync`) are called by thin controllers in `app/Http/Controllers/Integrations/` and by the MCP tools, so rules, limits and errors are identical on both surfaces. `PokerTaskSync` is the single place that decides a task's `syncState` and unsupported reason; `PresentPokerTask` serializes the full `external` object only when given a `PokerTaskSync` (non-guest viewers) and the reduced `{source, key, url, isManaged}` otherwise — broadcasts always carry the reduced form and non-guest clients refetch their snapshot when an imported task changes. `SetPokerEstimate` calls `RequestEstimateSync::afterEstimateChange()`, which marks `needs_sync` and dispatches `App\Jobs\SyncTaskEstimate` after commit (`ShouldBeUniqueUntilProcessing`, reads the latest estimate at run time, only clears `needs_sync` when the written value is still current).

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL, Pest, Laravel HTTP client (`Http::`), queued jobs, `laravel/mcp`, React 19 + Inertia v3, Wayfinder, Tailwind 4, lucide, Radix dialog/select/checkbox/dropdown/toggle-group (all installed).

**Spec:** `docs/superpowers/specs/2026-09-29-integrations-design.md` — §6 (6.1–6.6), §8 rows "Browse, import, refresh (poker)" and "Retry an estimate sync", §9 "Poker" rows `imports/{source}/containers`, `imports/{source}/iterations`, `imports/{source}/preview`, `imports/{source}`, `imports/refresh`, `tasks/{task}/sync` and the browse throttle, §9.1 (all four services and tools), §9 "Events and snapshot additions" poker `integrations`, §10.1 rows "Jira / Linear import" and "write-back", §10.2 "Imported descriptions", §11 "Poker" (import dialog, refresh, key chips, task detail, sync badges), §12 row `SyncTaskEstimate`, §13 (managed edits, 200 limit, provider errors on interactive calls), §15 groups Permissions (import), Import, Refresh, MCP services, Write-back, Translations, and §16 criteria 7, 8, 11 and the poker parts of 10 and 12. Also `docs/superpowers/specs/2026-09-29-mcp-server-design.md` §2.4 (`Trackers` feature), §6.2/§6.3 (the four tracker tools and the `external` of `poker.game.tasks.list`), §6.5 (catalogue of 29 tools), §10 (tracker errors). Plans 12a (foundation, done), 12b (sharing, done before this plan) and 12d (export and mapping, after this plan) are not in scope. Parent: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md`.

## Global Constraints

- Work on branch `feat/plan-12-integrations`, continuing after Plans 12a and 12b (execution order 12a → 12b → 12c → 12d). Do not create a new branch.
- Shells: prefix commands with `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH";`. Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host.
- Tests run on PostgreSQL (the Sail `testing` database, `QUEUE_CONNECTION=sync`). This plan adds **no migration**: every column it writes (`poker_tasks.external_*`, `needs_sync`, `sync_error`, `synced_at`) was created by Plan 12a. The spec's reserved unique key (`poker_game_id`, `external_source`, `external_id`) already exists.
- **No new Composer or npm dependency.** Provider calls go only through Plan 12a's `JiraClient` (`get`, `post`, `put`, paths relative to `https://api.atlassian.com/ex/jira/{cloudId}/`) and `LinearClient::query()`; no user-supplied URL is ever requested (Jira paths are built from ids with `rawurlencode`).
- Every integration test file starts with `beforeEach(fn () => Http::preventStrayRequests());` (plus its own fakes) and fakes each provider call explicitly.
- `poker_tasks` integration columns are **not fillable**: write them with `forceFill`. Client-sent `external_*` fields stay ignored everywhere (the existing `PokerTasksTest` "ignores client-sent external fields" must stay green).
- The server never trusts client-sent titles, descriptions, keys or estimates of issues: imports re-fetch the selected ids from the source.
- Guests never receive tracker metadata beyond `external: {source, key, url, isManaged}` and `integrations: null`; every tracker endpoint answers 403 to guests (`PokerGuard::canEditTasks`), 404 when the provider is disabled, 409 when the team's connection is missing or not active (Plan 12a's `NotConnected` / `ReconnectRequired`).
- Provider errors surface through Plan 12a's exception hierarchy, which renders itself (`ProviderRejected` 422 with the sanitized provider text — e.g. JQL errors —, `ProviderUnavailable` 502, `RateLimited` 429, `ReconnectRequired`/`NotConnected`/`ReadOnlyConnection` 409). Stored errors (`sync_error`) pass through `IntegrationErrors::sanitize()`.
- **Request fields are snake_case** (`q`, `page`, `container`, `mode`, `iteration_id`, `query`, `external_ids`); responses camelCase exactly as spec §6.2/§6.6/§9.
- Route names: `poker.imports.containers.index`, `poker.imports.iterations.index`, `poker.imports.preview.store`, `poker.imports.store`, `poker.imports.refresh.store`, `poker.tasks.sync.store`. Controllers in `app/Http/Controllers/Integrations/`.
- Every user-facing string via `t()` / `__()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"), appended at the end of each file, keeping every existing value. Each task lists its own rows; add only keys that are missing at execution time (Plans 12a/12b already added `Connect :provider in the team settings.`, `Reconnect :provider in the team settings.`, `This :provider connection is read-only.`, `No story points field found.`, `:provider did not respond. Try again later.`). Provider names are never translated. `tests/Feature/TranslationKeysTest.php` stays green.
- Wayfinder: run `vendor/bin/sail artisan wayfinder:generate --with-form` after every route change. `resources/js/actions` and `resources/js/routes` are gitignored — never stage them. Frontend imports use the generated controllers (`@/actions/App/Http/Controllers/Integrations/…`), never hard-coded URLs.
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp check --fix <paths>`.
- React: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `useGame()` for game state, `retroRequest()` from `@/lib/retro/api` for JSON calls, `toast` from `sonner`, `usePage().props.locale` for `Intl` formatting.
- PHP: constructor promotion, typed everything, array-shape docblocks on presenter return values, early returns, curly braces, no comments restating code, class constants in PascalCase. Test helper functions are global in Pest: every new helper name below is unique in `tests/`.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Spec amendments made with this plan

Plan writing found these gaps; the spec is updated to match (§6.4, §6.5, §6.6, §9):

1. **Broadcasts carry the guest-safe `external`.** `task.saved` reaches every player of the presence channel, guests included, so its task payload always has the reduced `{source, key, url, isManaged}`; non-guest clients refetch their snapshot when they receive a `task.saved` for an imported task (spec §6.6 "Guests receive … only" holds on every transport).
2. **"Not found in :source" is reported, not persisted.** Without spec 8's `external_missing_at`, `POST imports/refresh` answers `{refreshed, missing}` and the UI shows a toast ":missing tasks were not found in :source."; the tasks keep their data (spec §6.4 already says the state is persisted only by spec 8).
3. **Unsupported reasons.** Besides the three reasons of §6.5, a task is `unsupported` while the team's connection for its source is `Reconnect required` / `Setup required` ("Reconnect :provider in the team settings." / "Connect :provider in the team settings."), and for Jira when no story points field was found ("No story points field found."); no job is dispatched in those states and the retry endpoint answers 422 with the reason.
4. **`SyncTaskEstimate` is `ShouldBeUniqueUntilProcessing`**, not `ShouldBeUnique`: an estimate changed while a write is running must queue one more write instead of being dropped by the unique lock. Quick changes made before the job starts still coalesce into one write; the job clears `needs_sync` only when the estimate it wrote is still the current one.
5. **Refresh scope.** `POST imports/refresh` refreshes every imported task whose source has an `Active` connection on the same site; tasks from another site or a disconnected source are skipped. When no source could be refreshed because of the connection state, it answers the 409 of the first such source.
6. **Unknown ids on import** (deleted or no longer visible between preview and import) are counted in `skipped`, like duplicates.
7. **MCP `poker.game.tasks.import` with `iteration_id` on Jira** accepts `container_id` but does not need it (a sprint id is unique on a Jira site); GitHub's container requirement belongs to spec 8.

## Review Focus

1. **A task deleted, re-estimated or re-imported while its write-back job is queued** → a deleted task makes the job a no-op; an estimate changed during the write leaves `needs_sync = true` so the newer job writes the newer value; nothing throws. Pinned in Task 6 ("does nothing for a deleted task", "keeps needs_sync when the estimate changed during the write").
2. **The integration is disconnected, downgraded or moved to another Jira site between import and write-back** → the task shows `unsupported` with the reason, no job is dispatched, the retry answers 422 with the same reason, and a job already queued records the reason instead of calling the provider. Pinned in Task 3 ("marks tasks unsupported for …") and Task 6 ("records the reason instead of calling a provider that no longer covers the task").
3. **Import requests racing each other or the 200-task limit** (two players importing overlapping selections, an import that would exceed 200 with only part of it new) → the unique key plus the locked game row keep one task per issue; the limit counts only new issues and an overflowing batch imports nothing. Pinned in Task 5 ("skips issues already imported", "refuses a batch that would exceed 200 tasks without importing any").
4. **Hostile issue content** — a Linear description with `<script>` or a remote image, a Jira summary of 300 characters, a Markdown description longer than 10 000 characters, ADF with an unknown node type or a `javascript:` link → escaped HTML, link instead of image, title trimmed to 200, description truncated with "…", unknown nodes rendered through their children, unsafe links as plain text. Pinned in Task 1 ("renders unknown nodes through their children", "keeps unsafe links as plain text", "escapes HTML and Markdown characters") and Task 5 ("renders imported descriptions safely", "trims long titles and descriptions").
5. **A guest or a stale client touching tracker features** — a guest opening the import endpoints, a guest's snapshot or a `task.saved` broadcast carrying assignee or sync errors, a member editing the title of an imported task → 403, reduced `external`, 422 "This task is managed in :source.". Pinned in Task 3 ("gives guests the reduced external object", "broadcasts the reduced external object", "refuses edits of imported tasks") and Task 4 ("refuses guests and ended games").

## File map

| Area | Files |
|---|---|
| Tracker layer | `app/Support/Integrations/Jira/AdfToMarkdown.php`; `app/Support/Integrations/Trackers/{IssueTracker,TrackerIssue,TrackerIssueList,JiraTracker,LinearTracker,Trackers,EstimateRejected}.php`; `app/Support/Integrations/TrackerBrowseLimit.php` |
| Actions | `app/Actions/Integrations/{PokerTaskSync,ResolvePokerTracker,ListPokerIterations,PreviewPokerImport,ImportPokerTasks,RefreshPokerTasks,RequestEstimateSync,ListPokerSources}.php` |
| Poker changes | `app/Actions/Poker/{PresentPokerTask,BuildPokerSnapshot,SetPokerEstimate,PokerGuard}.php`; `app/Http/Controllers/Poker/{PokerTasksController,PokerTaskEstimatesController}.php` |
| Job | `app/Jobs/SyncTaskEstimate.php` |
| HTTP | `app/Http/Controllers/Integrations/{PokerImportContainersController,PokerImportIterationsController,PokerImportPreviewsController,PokerImportsController,PokerImportRefreshesController,PokerTaskSyncsController}.php`; `routes/web.php` |
| MCP | `app/Mcp/{McpFeature,McpTrackers}.php`; `app/Providers/AppServiceProvider.php`; `app/Mcp/Tools/SkrumTool.php`; `app/Mcp/Tools/Poker/{ListSources,ListIterations,ImportTasks,SyncTask}.php`; `app/Mcp/Servers/SkrumServer.php`; `app/Mcp/Presenters/McpPokerGame.php` |
| Frontend | `resources/js/lib/poker/types.ts`; `resources/js/hooks/use-poker-game.ts`; `resources/js/components/poker/{task-source-chip,task-source-details,import-tasks-dialog,tasks-pane,task-detail}.tsx` |
| Tests | `tests/Pest.php`; `tests/Unit/Integrations/AdfToMarkdownTest.php`; `tests/Feature/Integrations/{IssueTrackersTest,PokerTaskExternalTest,PokerImportBrowsingTest,PokerImportTest,PokerEstimateSyncTest}.php`; `tests/Feature/Mcp/{TrackerToolsTest,CatalogueTest,ToolBaseTest,McpSweepTest,PokerReadToolsTest}.php` |
| Translations | `lang/{en,fr,es,de}.json` (rows inside each task) |

**Files shared with Plans 12b and 12d** (execution order 12b → 12c → 12d): `routes/web.php` (12b adds `poker.shares.store` inside the same `poker/{game}` group — add this plan's routes after it), `app/Actions/Poker/BuildPokerSnapshot.php` and `resources/js/lib/poker/types.ts` (12b adds `share` and `deliveries`; this plan adds `integrations` next to them and changes the task presentation only), `tests/Pest.php` (append helpers at the end), `lang/*.json` (append). 12d touches `app/Actions/Retros/PresentActionItem.php` and the integrations page, not the files above.

## Contract for Plan 12d

Plan 12d does not build on this plan's classes. It relies only on Plan 12a's contract; the two exceptions it must not break:

- `SkrumTool::handle()` maps `App\Support\Integrations\Exceptions\IntegrationException` to a tool error (Task 7); 12d adds no MCP tool.
- `tests/Pest.php` gains the helpers `jiraTrackerIssue()`, `linearTrackerIssue()`, `fakeLinearGraphql()`, `fakeJiraTrackerApi()` and `trackerTable()`; 12d must not reuse these names.

---

### Task 1: Jira ADF to Markdown (`AdfToMarkdown`)

**Files:**
- Create: `app/Support/Integrations/Jira/AdfToMarkdown.php`
- Test: `tests/Unit/Integrations/AdfToMarkdownTest.php`

**Interfaces:**
- Consumes: nothing.
- Produces: `App\Support\Integrations\Jira\AdfToMarkdown` with `public const MaxLength = 10000`, `convert(?array $document): ?string` (null for a missing or empty document) and `static truncate(string $markdown): string` (≤ 10 000 characters, the last one "…" when cut). Text is escaped with a backslash before `` \ ` * _ [ ] < > | ~ ``; marks: strong `**x**`, em `*x*`, strike `~~x~~`, code `` `x` ``, link `[x](href)` for `http`, `https` and `mailto` only (other links stay plain text); headings `#`×level; bullet lists `- `, ordered lists `n. ` from `attrs.order`, nested items indented by the marker width; code blocks fenced with the language; blockquotes and panels `> `; rules `---`; tables as pipe rows with a `| --- |` separator after the first row; media → `[attachment]`; mentions `attrs.text`; emoji `attrs.text` or `attrs.shortName`; inline/block cards as links; status text; dates as `Y-m-d`; expand blocks `**title**` then content; unknown nodes through their children. Blocks are separated by a blank line.

- [ ] **Step 1: Write the failing test**

Create `tests/Unit/Integrations/AdfToMarkdownTest.php`:

```php
<?php

use App\Support\Integrations\Jira\AdfToMarkdown;

/**
 * @param  array<int, array<string, mixed>>  $content
 * @return array<string, mixed>
 */
function adfDocument(array $content): array
{
    return ['type' => 'doc', 'version' => 1, 'content' => $content];
}

/**
 * @param  array<int, array<string, mixed>>  $marks
 * @return array<string, mixed>
 */
function adfText(string $text, array $marks = []): array
{
    return $marks === [] ? ['type' => 'text', 'text' => $text] : ['type' => 'text', 'text' => $text, 'marks' => $marks];
}

/**
 * @param  array<int, array<string, mixed>>  $content
 * @return array<string, mixed>
 */
function adfParagraph(array $content): array
{
    return ['type' => 'paragraph', 'content' => $content];
}

it('converts marks and links', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([adfParagraph([
        adfText('Hello '),
        adfText('bold', [['type' => 'strong']]),
        adfText(' and '),
        adfText('it', [['type' => 'em']]),
        adfText(' '),
        adfText('gone', [['type' => 'strike']]),
        adfText(' '),
        adfText('code()', [['type' => 'code']]),
        adfText(' '),
        adfText('site', [['type' => 'link', 'attrs' => ['href' => 'https://example.com']]]),
    ])]));

    expect($markdown)->toBe('Hello **bold** and *it* ~~gone~~ `code()` [site](https://example.com)');
});

it('converts headings, quotes, rules and code blocks', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([
        ['type' => 'heading', 'attrs' => ['level' => 2], 'content' => [adfText('Goal')]],
        ['type' => 'blockquote', 'content' => [adfParagraph([adfText('Quoted')]), adfParagraph([adfText('Twice')])]],
        ['type' => 'rule'],
        ['type' => 'codeBlock', 'attrs' => ['language' => 'php'], 'content' => [adfText("echo 1;\necho 2;")]],
    ]));

    expect($markdown)->toBe("## Goal\n\n> Quoted\n>\n> Twice\n\n---\n\n```php\necho 1;\necho 2;\n```");
});

it('converts nested lists', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([
        ['type' => 'bulletList', 'content' => [
            ['type' => 'listItem', 'content' => [
                adfParagraph([adfText('One')]),
                ['type' => 'orderedList', 'attrs' => ['order' => 3], 'content' => [
                    ['type' => 'listItem', 'content' => [adfParagraph([adfText('Three')])]],
                    ['type' => 'listItem', 'content' => [adfParagraph([adfText('Four')])]],
                ]],
            ]],
            ['type' => 'listItem', 'content' => [adfParagraph([adfText('Two')])]],
        ]],
    ]));

    expect($markdown)->toBe("- One\n  3. Three\n  4. Four\n- Two");
});

it('converts mentions, emoji, media and tables', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([
        adfParagraph([
            adfText('Ping '),
            ['type' => 'mention', 'attrs' => ['id' => 'abc', 'text' => '@Jane']],
            adfText(' '),
            ['type' => 'emoji', 'attrs' => ['shortName' => ':tada:', 'text' => '🎉']],
        ]),
        ['type' => 'mediaSingle', 'content' => [['type' => 'media', 'attrs' => ['id' => 'x', 'type' => 'file']]]],
        ['type' => 'table', 'content' => [
            ['type' => 'tableRow', 'content' => [
                ['type' => 'tableHeader', 'content' => [adfParagraph([adfText('Name')])]],
                ['type' => 'tableHeader', 'content' => [adfParagraph([adfText('Size')])]],
            ]],
            ['type' => 'tableRow', 'content' => [
                ['type' => 'tableCell', 'content' => [adfParagraph([adfText('a|b')])]],
                ['type' => 'tableCell', 'content' => [adfParagraph([adfText('3')])]],
            ]],
        ]],
    ]));

    expect($markdown)->toBe("Ping @Jane 🎉\n\n[attachment]\n\n| Name | Size |\n| --- | --- |\n| a\\|b | 3 |");
});

it('escapes HTML and Markdown characters', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([adfParagraph([adfText('<script>alert(1)</script> *not bold* [x]')])]));

    expect($markdown)->toBe('\<script\>alert(1)\</script\> \*not bold\* \[x\]');
});

it('keeps unsafe links as plain text', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([adfParagraph([
        adfText('click', [['type' => 'link', 'attrs' => ['href' => 'javascript:alert(1)']]]),
    ])]));

    expect($markdown)->toBe('click');
});

it('renders unknown nodes through their children', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([
        ['type' => 'layoutSection', 'content' => [
            ['type' => 'layoutColumn', 'content' => [adfParagraph([adfText('Left')])]],
            ['type' => 'layoutColumn', 'content' => [adfParagraph([adfText('Right')])]],
        ]],
        adfParagraph([['type' => 'status', 'attrs' => ['text' => 'DONE']], adfText(' on '), ['type' => 'date', 'attrs' => ['timestamp' => '1767225600000']]]),
        ['type' => 'expand', 'attrs' => ['title' => 'Details'], 'content' => [adfParagraph([adfText('Hidden')])]],
    ]));

    expect($markdown)->toBe("Left\n\nRight\n\nDONE on 2026-01-01\n\n**Details**\n\nHidden");
});

it('returns null for missing or empty documents', function () {
    expect((new AdfToMarkdown)->convert(null))->toBeNull()
        ->and((new AdfToMarkdown)->convert(adfDocument([])))->toBeNull()
        ->and((new AdfToMarkdown)->convert(adfDocument([adfParagraph([])])))->toBeNull();
});

it('truncates long descriptions', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([adfParagraph([adfText(str_repeat('a', 10050))])]));

    expect(mb_strlen((string) $markdown))->toBe(AdfToMarkdown::MaxLength)
        ->and($markdown)->toEndWith('a…')
        ->and(AdfToMarkdown::truncate('short'))->toBe('short');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Integrations/AdfToMarkdownTest.php`
Expected: FAIL with `Class "App\Support\Integrations\Jira\AdfToMarkdown" not found`.

- [ ] **Step 3: Write the converter**

Create `app/Support/Integrations/Jira/AdfToMarkdown.php`:

```php
<?php

namespace App\Support\Integrations\Jira;

use Carbon\CarbonImmutable;

/**
 * Jira descriptions arrive as Atlassian Document Format. Poker tasks store
 * Markdown, which RenderTaskMarkdown escapes and renders; media is never
 * fetched, it becomes "[attachment]".
 */
class AdfToMarkdown
{
    public const MaxLength = 10000;

    private const SafeLinkSchemes = ['http', 'https', 'mailto'];

    /**
     * @param  array<array-key, mixed>|null  $document
     */
    public function convert(?array $document): ?string
    {
        if ($document === null) {
            return null;
        }

        $markdown = trim($this->blocks($this->children($document)));

        if ($markdown === '') {
            return null;
        }

        return self::truncate($markdown);
    }

    public static function truncate(string $markdown): string
    {
        if (mb_strlen($markdown) <= self::MaxLength) {
            return $markdown;
        }

        return mb_substr($markdown, 0, self::MaxLength - 1).'…';
    }

    /**
     * @param  array<int, mixed>  $nodes
     */
    private function blocks(array $nodes): string
    {
        $rendered = [];

        foreach ($nodes as $node) {
            if (! is_array($node)) {
                continue;
            }

            $block = $this->block($node);

            if (trim($block) !== '') {
                $rendered[] = $block;
            }
        }

        return implode("\n\n", $rendered);
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function block(array $node): string
    {
        $children = $this->children($node);

        return match ($node['type'] ?? null) {
            'paragraph' => $this->inline($children),
            'heading' => str_repeat('#', $this->headingLevel($node)).' '.$this->inline($children),
            'bulletList' => $this->list($children, null),
            'orderedList' => $this->list($children, $this->startNumber($node)),
            'codeBlock' => $this->codeBlock($node, $children),
            'blockquote', 'panel' => $this->quote($this->blocks($children)),
            'rule' => '---',
            'table' => $this->table($children),
            'mediaSingle', 'mediaGroup', 'media' => '[attachment]',
            'blockCard', 'embedCard' => $this->cardLink($node),
            'expand', 'nestedExpand' => $this->expand($node, $children),
            'text', 'hardBreak', 'mention', 'emoji', 'inlineCard', 'status', 'date' => $this->inline([$node]),
            default => $this->blocks($children),
        };
    }

    /**
     * @param  array<int, mixed>  $nodes
     */
    private function inline(array $nodes): string
    {
        $rendered = '';

        foreach ($nodes as $node) {
            if (! is_array($node)) {
                continue;
            }

            $rendered .= match ($node['type'] ?? null) {
                'text' => $this->text($node),
                'hardBreak' => "  \n",
                'mention' => $this->escape($this->attribute($node, 'text') ?? '@'.($this->attribute($node, 'id') ?? '')),
                'emoji' => $this->attribute($node, 'text') ?? $this->attribute($node, 'shortName') ?? '',
                'inlineCard' => $this->cardLink($node),
                'status' => $this->escape($this->attribute($node, 'text') ?? ''),
                'date' => $this->date($node),
                'media', 'mediaInline' => '[attachment]',
                default => $this->inline($this->children($node)),
            };
        }

        return $rendered;
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function text(array $node): string
    {
        $text = is_string($node['text'] ?? null) ? $node['text'] : '';

        if ($text === '') {
            return '';
        }

        $marks = array_values(array_filter(
            is_array($node['marks'] ?? null) ? $node['marks'] : [],
            fn (mixed $mark): bool => is_array($mark),
        ));
        $types = array_map(fn (array $mark): mixed => $mark['type'] ?? null, $marks);

        if (in_array('code', $types, true)) {
            return str_contains($text, '`') ? "`` {$text} ``" : "`{$text}`";
        }

        $rendered = $this->escape($text);

        if (in_array('strike', $types, true)) {
            $rendered = "~~{$rendered}~~";
        }

        if (in_array('em', $types, true)) {
            $rendered = "*{$rendered}*";
        }

        if (in_array('strong', $types, true)) {
            $rendered = "**{$rendered}**";
        }

        foreach ($marks as $mark) {
            if (($mark['type'] ?? null) !== 'link') {
                continue;
            }

            $href = data_get($mark, 'attrs.href');

            if (is_string($href) && $this->isSafeLink($href)) {
                $rendered = "[{$rendered}]({$href})";
            }
        }

        return $rendered;
    }

    /**
     * @param  array<int, mixed>  $items
     */
    private function list(array $items, ?int $start): string
    {
        $lines = [];
        $number = $start ?? 1;

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $marker = $start === null ? '- ' : ($number++).'. ';
            $indent = str_repeat(' ', strlen($marker));
            $itemLines = explode("\n", $this->listItem($this->children($item)));

            $lines[] = rtrim($marker.array_shift($itemLines));

            foreach ($itemLines as $line) {
                $lines[] = $line === '' ? '' : $indent.$line;
            }
        }

        return implode("\n", $lines);
    }

    /**
     * @param  array<int, mixed>  $children
     */
    private function listItem(array $children): string
    {
        $parts = [];

        foreach ($children as $child) {
            if (! is_array($child)) {
                continue;
            }

            $block = $this->block($child);

            if ($block !== '') {
                $parts[] = $block;
            }
        }

        return implode("\n", $parts);
    }

    /**
     * @param  array<array-key, mixed>  $node
     * @param  array<int, mixed>  $children
     */
    private function codeBlock(array $node, array $children): string
    {
        $code = '';

        foreach ($children as $child) {
            if (is_array($child) && is_string($child['text'] ?? null)) {
                $code .= $child['text'];
            }
        }

        $fence = str_contains($code, '```') ? '~~~~' : '```';
        $language = $this->attribute($node, 'language') ?? '';

        return "{$fence}{$language}\n{$code}\n{$fence}";
    }

    private function quote(string $content): string
    {
        if ($content === '') {
            return '';
        }

        return implode("\n", array_map(
            fn (string $line): string => $line === '' ? '>' : "> {$line}",
            explode("\n", $content),
        ));
    }

    /**
     * @param  array<int, mixed>  $rows
     */
    private function table(array $rows): string
    {
        $lines = [];

        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }

            $cells = [];

            foreach ($this->children($row) as $cell) {
                if (is_array($cell)) {
                    $cells[] = str_replace("\n", ' ', $this->blocks($this->children($cell)));
                }
            }

            $lines[] = '| '.implode(' | ', $cells).' |';

            if (count($lines) === 1) {
                $lines[] = '| '.implode(' | ', array_fill(0, max(count($cells), 1), '---')).' |';
            }
        }

        return implode("\n", $lines);
    }

    /**
     * @param  array<array-key, mixed>  $node
     * @param  array<int, mixed>  $children
     */
    private function expand(array $node, array $children): string
    {
        $title = $this->attribute($node, 'title');
        $content = $this->blocks($children);

        if ($title === null || $title === '') {
            return $content;
        }

        return trim('**'.$this->escape($title)."**\n\n".$content);
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function cardLink(array $node): string
    {
        $url = $this->attribute($node, 'url');

        if ($url === null || ! $this->isSafeLink($url)) {
            return '';
        }

        return '['.$this->escape($url)."]({$url})";
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function date(array $node): string
    {
        $timestamp = $this->attribute($node, 'timestamp');

        if ($timestamp === null || ! ctype_digit($timestamp)) {
            return '';
        }

        return CarbonImmutable::createFromTimestampMs((int) $timestamp, 'UTC')->toDateString();
    }

    private function escape(string $text): string
    {
        return (string) preg_replace('/[\\\\`*_\[\]<>|~]/', '\\\\$0', $text);
    }

    private function isSafeLink(string $href): bool
    {
        $scheme = parse_url($href, PHP_URL_SCHEME);

        return is_string($scheme) && in_array(strtolower($scheme), self::SafeLinkSchemes, true);
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function headingLevel(array $node): int
    {
        $level = data_get($node, 'attrs.level');

        return is_int($level) ? max(1, min(6, $level)) : 1;
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function startNumber(array $node): int
    {
        $order = data_get($node, 'attrs.order');

        return is_int($order) && $order > 0 ? $order : 1;
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function attribute(array $node, string $key): ?string
    {
        $value = data_get($node, "attrs.{$key}");

        if (is_int($value)) {
            return (string) $value;
        }

        return is_string($value) ? $value : null;
    }

    /**
     * @param  array<array-key, mixed>  $node
     * @return array<int, mixed>
     */
    private function children(array $node): array
    {
        return is_array($node['content'] ?? null) ? array_values($node['content']) : [];
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Integrations/AdfToMarkdownTest.php`
Expected: PASS (9 tests).

- [ ] **Step 5: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Integrations/Jira/AdfToMarkdown.php tests/Unit/Integrations/AdfToMarkdownTest.php
git commit -m "feat: convert Jira ADF descriptions to Markdown

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 2: Issue trackers (`IssueTracker`, `JiraTracker`, `LinearTracker`, `Trackers`)

**Files:**
- Create: `app/Support/Integrations/Trackers/{IssueTracker,TrackerIssue,TrackerIssueList,JiraTracker,LinearTracker,Trackers,EstimateRejected}.php`
- Modify: `tests/Pest.php` (helpers), `lang/{en,fr,es,de}.json`
- Test: `tests/Feature/Integrations/IssueTrackersTest.php`

**Interfaces:**
- Consumes: Plan 12a `JiraClient::{get, post, put}`, `LinearClient::query`, `TeamIntegration::{setting, provider}`, `ProviderRejected`; Task 1 `AdfToMarkdown`; `App\Enums\PokerDeck::numericValue()`.
- Produces:
  - `TrackerIssue` (public promoted `string $externalId, string $key, string $title, ?string $description, string $url, ?string $assignee, ?string $estimate, ?string $status`), `static title(mixed $value, string $fallback): string` (trimmed, ≤ 200), `static formatEstimate(mixed $value): ?string` (`5.0` → `"5"`, `0.5` → `"0.5"`), `static shorten(mixed $value, int $length): ?string`, `preview(bool $alreadyImported): array{externalId, key, title, assignee, estimate, status, alreadyImported}`.
  - `TrackerIssueList` (public `array<int, TrackerIssue> $issues`, `bool $truncated`).
  - interface `IssueTracker` with `PreviewLimit = 100`, `ContainerPageSize = 50` and `containers(TeamIntegration, ?string $query, int $page): array{containers: array<int, array{id: string, name: string}>, hasMore: bool}`, `iterations(TeamIntegration, string $containerId): array<int, array{id: string, name: string, state: 'active'|'upcoming', startsOn: ?string, endsOn: ?string}>`, `iterationIssues(TeamIntegration, string $iterationId): TrackerIssueList`, `search(TeamIntegration, string $query): TrackerIssueList`, `issues(TeamIntegration, array $externalIds): array<string, TrackerIssue>` (keyed by external id, missing ids absent), `writeEstimate(TeamIntegration, string $externalId, ?string $estimate): void` (Task 6 fills the bodies; this task throws `LogicException` in them).
  - `Trackers::for(IntegrationProvider): IssueTracker` (Jira, Linear; `InvalidArgumentException` otherwise).
  - `EstimateRejected extends RuntimeException` (translated message).
  - Pest helpers `jiraTrackerIssue(string $id, string $key, array $fields = []): array`, `linearTrackerIssue(string $id, string $identifier, array $overrides = []): array`, `fakeLinearGraphql(array $responses): void` (keys are substrings of the GraphQL query, values the `data` object or a `Closure(array $variables): array`).

- [ ] **Step 1: Add the test helpers**

Append to `tests/Pest.php` (import `Illuminate\Http\Client\Request as HttpRequest` at the top of the file if the alias is not there yet):

```php
/**
 * A Jira issue as `/rest/api/3/search/jql` returns it.
 *
 * @param  array<string, mixed>  $fields
 * @return array<string, mixed>
 */
function jiraTrackerIssue(string $id, string $key, array $fields = []): array
{
    return [
        'id' => $id,
        'key' => $key,
        'fields' => [
            'summary' => "Story {$key}",
            'description' => ['type' => 'doc', 'version' => 1, 'content' => [
                ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => "About {$key}"]]],
            ]],
            'assignee' => ['displayName' => 'Jane Doe'],
            'status' => ['name' => 'To Do'],
            'customfield_10016' => 3,
            ...$fields,
        ],
    ];
}

/**
 * A Linear issue node with the fields the trackers request.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function linearTrackerIssue(string $id, string $identifier, array $overrides = []): array
{
    return [
        'id' => $id,
        'identifier' => $identifier,
        'title' => "Issue {$identifier}",
        'description' => "About **{$identifier}**",
        'url' => "https://linear.app/acme/issue/{$identifier}",
        'estimate' => 2,
        'assignee' => ['displayName' => 'Sam Lee'],
        'state' => ['name' => 'Todo'],
        ...$overrides,
    ];
}

/**
 * Answers Linear GraphQL calls by the first key found in the query text.
 *
 * @param  array<string, array<string, mixed>|Closure(array<string, mixed>): array<string, mixed>>  $responses
 */
function fakeLinearGraphql(array $responses): void
{
    Http::fake(['api.linear.app/graphql' => function (HttpRequest $request) use ($responses) {
        $query = (string) $request['query'];
        $variables = (array) ($request['variables'] ?? []);

        foreach ($responses as $needle => $data) {
            if (str_contains($query, $needle)) {
                return Http::response(['data' => $data instanceof Closure ? $data($variables) : $data]);
            }
        }

        return Http::response(['errors' => [['message' => "Unexpected query: {$query}"]]], 400);
    }]);
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Integrations/IssueTrackersTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Trackers\JiraTracker;
use App\Support\Integrations\Trackers\LinearTracker;
use App\Support\Integrations\Trackers\Trackers;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear);
});

it('resolves the tracker of each provider', function () {
    expect(app(Trackers::class)->for(IntegrationProvider::Jira))->toBeInstanceOf(JiraTracker::class)
        ->and(app(Trackers::class)->for(IntegrationProvider::Linear))->toBeInstanceOf(LinearTracker::class)
        ->and(fn () => app(Trackers::class)->for(IntegrationProvider::Slack))->toThrow(InvalidArgumentException::class);
});

it('lists Jira scrum boards by page and name', function () {
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/agile/1.0/board*' => Http::response([
        'values' => [['id' => 7, 'name' => 'Team board'], ['id' => 9, 'name' => 'Other board']],
        'isLast' => false,
    ])]);
    $integration = TeamIntegration::factory()->jira()->create();

    $result = app(JiraTracker::class)->containers($integration, 'board', 2);

    expect($result)->toBe([
        'containers' => [['id' => '7', 'name' => 'Team board'], ['id' => '9', 'name' => 'Other board']],
        'hasMore' => true,
    ]);
    Http::assertSent(fn (Request $request) => str_contains($request->url(), 'type=scrum')
        && str_contains($request->url(), 'name=board')
        && str_contains($request->url(), 'startAt=50')
        && str_contains($request->url(), 'maxResults=50'));
});

it('lists active and future Jira sprints', function () {
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/agile/1.0/board/7/sprint*' => Http::response(['values' => [
        ['id' => 31, 'name' => 'Sprint 31', 'state' => 'active', 'startDate' => '2026-09-28T08:00:00.000Z', 'endDate' => '2026-10-12T08:00:00.000Z'],
        ['id' => 32, 'name' => 'Sprint 32', 'state' => 'future'],
    ]])]);
    $integration = TeamIntegration::factory()->jira()->create();

    expect(app(JiraTracker::class)->iterations($integration, '7'))->toBe([
        ['id' => '31', 'name' => 'Sprint 31', 'state' => 'active', 'startsOn' => '2026-09-28', 'endsOn' => '2026-10-12'],
        ['id' => '32', 'name' => 'Sprint 32', 'state' => 'upcoming', 'startsOn' => null, 'endsOn' => null],
    ]);
    Http::assertSent(fn (Request $request) => str_contains($request->url(), 'state=active%2Cfuture'));
});

it('maps the issues of a Jira sprint with the story point candidates', function () {
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::response([
        'issues' => [
            jiraTrackerIssue('10001', 'PROJ-1', ['customfield_10016' => 5.0]),
            jiraTrackerIssue('10002', 'PROJ-2', ['assignee' => null, 'customfield_10016' => null, 'summary' => '  ']),
        ],
        'nextPageToken' => 'next',
    ])]);
    $integration = TeamIntegration::factory()->jira()->create();

    $list = app(JiraTracker::class)->iterationIssues($integration, '31');

    expect($list->truncated)->toBeTrue()
        ->and($list->issues)->toHaveCount(2)
        ->and($list->issues[0]->preview(false))->toBe([
            'externalId' => '10001',
            'key' => 'PROJ-1',
            'title' => 'Story PROJ-1',
            'assignee' => 'Jane Doe',
            'estimate' => '5',
            'status' => 'To Do',
            'alreadyImported' => false,
        ])
        ->and($list->issues[0]->description)->toBe('About PROJ-1')
        ->and($list->issues[0]->url)->toBe('https://acme.atlassian.net/browse/PROJ-1')
        ->and($list->issues[1]->title)->toBe('PROJ-2')
        ->and($list->issues[1]->assignee)->toBeNull()
        ->and($list->issues[1]->estimate)->toBeNull();

    Http::assertSent(fn (Request $request) => $request['jql'] === 'sprint = 31 ORDER BY Rank ASC'
        && $request['maxResults'] === 100
        && $request['fields'] === ['summary', 'description', 'assignee', 'status', 'customfield_10016']);
});

it('surfaces Jira JQL errors', function () {
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::response([
        'errorMessages' => ["Field 'nope' does not exist."],
    ], 400)]);
    $integration = TeamIntegration::factory()->jira()->create();

    expect(fn () => app(JiraTracker::class)->search($integration, 'nope = 1'))
        ->toThrow(ProviderRejected::class, "Field 'nope' does not exist.");
});

it('fetches Jira issues by id in batches of 100', function () {
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::sequence()
        ->push(['issues' => array_map(fn (int $n) => jiraTrackerIssue((string) (10000 + $n), "PROJ-{$n}"), range(1, 100))])
        ->push(['issues' => [jiraTrackerIssue('10101', 'PROJ-101')]])]);
    $integration = TeamIntegration::factory()->jira()->create();
    $ids = array_map(fn (int $n) => (string) (10000 + $n), range(1, 102));

    $issues = app(JiraTracker::class)->issues($integration, [...$ids, 'not-a-jira-id']);

    expect($issues)->toHaveCount(101)
        ->and($issues['10101']->key)->toBe('PROJ-101')
        ->and($issues)->not->toHaveKey('10102');
    Http::assertSentCount(2);
    Http::assertSent(fn (Request $request) => str_starts_with((string) $request['jql'], 'id in (10001,10002,'));
});

it('lists Linear teams filtered by name and paged in memory', function () {
    fakeLinearGraphql(['teams(' => fn (array $variables) => [
        'teams' => ['nodes' => array_map(fn (int $n) => ['id' => "team-{$n}", 'name' => "Team {$n}"], range(1, 60))],
    ]]);
    $integration = TeamIntegration::factory()->linear()->create();

    $first = app(LinearTracker::class)->containers($integration, 'team', 1);
    $second = app(LinearTracker::class)->containers($integration, 'team', 2);

    expect($first['containers'])->toHaveCount(50)
        ->and($first['hasMore'])->toBeTrue()
        ->and($second['containers'])->toHaveCount(10)
        ->and($second['containers'][0])->toBe(['id' => 'team-51', 'name' => 'Team 51'])
        ->and($second['hasMore'])->toBeFalse();
    Http::assertSent(fn (Request $request) => data_get($request->data(), 'variables.filter.name.containsIgnoreCase') === 'team');
});

it('lists active and upcoming Linear cycles', function () {
    fakeLinearGraphql(['cycles(' => ['team' => ['cycles' => ['nodes' => [
        ['id' => 'cycle-2', 'name' => null, 'number' => 13, 'startsAt' => '2026-10-12T00:00:00.000Z', 'endsAt' => '2026-10-26T00:00:00.000Z', 'isActive' => false],
        ['id' => 'cycle-1', 'name' => 'Launch', 'number' => 12, 'startsAt' => '2026-09-28T00:00:00.000Z', 'endsAt' => '2026-10-12T00:00:00.000Z', 'isActive' => true],
    ]]]]]);
    $integration = TeamIntegration::factory()->linear()->create();

    expect(app(LinearTracker::class)->iterations($integration, 'team-1'))->toBe([
        ['id' => 'cycle-1', 'name' => 'Launch', 'state' => 'active', 'startsOn' => '2026-09-28', 'endsOn' => '2026-10-12'],
        ['id' => 'cycle-2', 'name' => 'Cycle 13', 'state' => 'upcoming', 'startsOn' => '2026-10-12', 'endsOn' => '2026-10-26'],
    ]);
});

it('maps Linear cycle issues and search results', function () {
    fakeLinearGraphql([
        'cycle(' => ['cycle' => ['issues' => [
            'nodes' => [linearTrackerIssue('uuid-1', 'ENG-1'), linearTrackerIssue('uuid-2', 'ENG-2', ['assignee' => null, 'estimate' => null])],
            'pageInfo' => ['hasNextPage' => true],
        ]]],
        'searchIssues(' => ['searchIssues' => [
            'nodes' => [linearTrackerIssue('uuid-3', 'ENG-3', ['estimate' => 0.5])],
            'pageInfo' => ['hasNextPage' => false],
        ]],
    ]);
    $integration = TeamIntegration::factory()->linear()->create();

    $cycle = app(LinearTracker::class)->iterationIssues($integration, 'cycle-1');
    $search = app(LinearTracker::class)->search($integration, 'login');

    expect($cycle->truncated)->toBeTrue()
        ->and($cycle->issues[0]->preview(true))->toBe([
            'externalId' => 'uuid-1',
            'key' => 'ENG-1',
            'title' => 'Issue ENG-1',
            'assignee' => 'Sam Lee',
            'estimate' => '2',
            'status' => 'Todo',
            'alreadyImported' => true,
        ])
        ->and($cycle->issues[0]->description)->toBe('About **ENG-1**')
        ->and($cycle->issues[0]->url)->toBe('https://linear.app/acme/issue/ENG-1')
        ->and($cycle->issues[1]->assignee)->toBeNull()
        ->and($search->truncated)->toBeFalse()
        ->and($search->issues[0]->estimate)->toBe('0.5');
    Http::assertSent(fn (Request $request) => data_get($request->data(), 'variables.term') === 'login');
});

it('fetches Linear issues by id', function () {
    fakeLinearGraphql(['issues(' => fn (array $variables) => ['issues' => ['nodes' => array_map(
        fn (string $id) => linearTrackerIssue($id, 'ENG-'.substr($id, -1)),
        array_values(array_diff($variables['ids'], ['uuid-gone'])),
    )]]]);
    $integration = TeamIntegration::factory()->linear()->create();

    $issues = app(LinearTracker::class)->issues($integration, ['uuid-1', 'uuid-gone']);

    expect(array_keys($issues))->toBe(['uuid-1']);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IssueTrackersTest.php`
Expected: FAIL with `Class "App\Support\Integrations\Trackers\Trackers" not found`.

- [ ] **Step 4: Create the value objects, the interface and the registry**

Create `app/Support/Integrations/Trackers/TrackerIssue.php`:

```php
<?php

namespace App\Support\Integrations\Trackers;

class TrackerIssue
{
    public const TitleLength = 200;

    public const AssigneeLength = 100;

    public const EstimateLength = 16;

    public function __construct(
        public string $externalId,
        public string $key,
        public string $title,
        public ?string $description,
        public string $url,
        public ?string $assignee,
        public ?string $estimate,
        public ?string $status,
    ) {}

    public static function title(mixed $value, string $fallback): string
    {
        $title = is_string($value) ? trim($value) : '';

        return mb_substr($title === '' ? $fallback : $title, 0, self::TitleLength);
    }

    public static function formatEstimate(mixed $value): ?string
    {
        if (! is_int($value) && ! is_float($value)) {
            return null;
        }

        $formatted = rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.');

        return mb_substr($formatted === '-0' ? '0' : $formatted, 0, self::EstimateLength);
    }

    public static function shorten(mixed $value, int $length): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        return mb_substr(trim($value), 0, $length);
    }

    /**
     * @return array{
     *     externalId: string,
     *     key: string,
     *     title: string,
     *     assignee: ?string,
     *     estimate: ?string,
     *     status: ?string,
     *     alreadyImported: bool
     * }
     */
    public function preview(bool $alreadyImported): array
    {
        return [
            'externalId' => $this->externalId,
            'key' => $this->key,
            'title' => $this->title,
            'assignee' => $this->assignee,
            'estimate' => $this->estimate,
            'status' => $this->status,
            'alreadyImported' => $alreadyImported,
        ];
    }
}
```

Create `app/Support/Integrations/Trackers/TrackerIssueList.php`:

```php
<?php

namespace App\Support\Integrations\Trackers;

class TrackerIssueList
{
    /**
     * @param  array<int, TrackerIssue>  $issues
     */
    public function __construct(public array $issues, public bool $truncated) {}
}
```

Create `app/Support/Integrations/Trackers/IssueTracker.php`:

```php
<?php

namespace App\Support\Integrations\Trackers;

use App\Models\TeamIntegration;

/**
 * One implementation per issue tracker. Every call goes through the
 * provider client of the connection, so token refresh, reconnect states and
 * error mapping are the client's (Plan 12a).
 */
interface IssueTracker
{
    public const PreviewLimit = 100;

    public const ContainerPageSize = 50;

    /**
     * @return array{containers: array<int, array{id: string, name: string}>, hasMore: bool}
     */
    public function containers(TeamIntegration $integration, ?string $query, int $page): array;

    /**
     * @return array<int, array{id: string, name: string, state: 'active'|'upcoming', startsOn: ?string, endsOn: ?string}>
     */
    public function iterations(TeamIntegration $integration, string $containerId): array;

    public function iterationIssues(TeamIntegration $integration, string $iterationId): TrackerIssueList;

    public function search(TeamIntegration $integration, string $query): TrackerIssueList;

    /**
     * @param  array<int, string>  $externalIds
     * @return array<string, TrackerIssue>
     */
    public function issues(TeamIntegration $integration, array $externalIds): array;

    /**
     * @throws EstimateRejected when the source cannot hold this estimate
     */
    public function writeEstimate(TeamIntegration $integration, string $externalId, ?string $estimate): void;
}
```

Create `app/Support/Integrations/Trackers/EstimateRejected.php`:

```php
<?php

namespace App\Support\Integrations\Trackers;

use RuntimeException;

/**
 * The source refuses this estimate for a reason retrying cannot fix; the
 * message is translated and shown on the task.
 */
class EstimateRejected extends RuntimeException {}
```

Create `app/Support/Integrations/Trackers/Trackers.php`:

```php
<?php

namespace App\Support\Integrations\Trackers;

use App\Enums\IntegrationProvider;
use InvalidArgumentException;

class Trackers
{
    public function for(IntegrationProvider $provider): IssueTracker
    {
        return match ($provider) {
            IntegrationProvider::Jira => app(JiraTracker::class),
            IntegrationProvider::Linear => app(LinearTracker::class),
            default => throw new InvalidArgumentException("{$provider->value} is not an issue tracker."),
        };
    }
}
```

- [ ] **Step 5: Create the Jira tracker**

Create `app/Support/Integrations/Trackers/JiraTracker.php`:

```php
<?php

namespace App\Support\Integrations\Trackers;

use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\AdfToMarkdown;
use App\Support\Integrations\Jira\JiraClient;
use LogicException;

class JiraTracker implements IssueTracker
{
    private const BaseFields = ['summary', 'description', 'assignee', 'status'];

    public function __construct(
        private JiraClient $client,
        private AdfToMarkdown $adfToMarkdown,
    ) {}

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

        $response = $this->client->get($integration, 'rest/agile/1.0/board', $parameters);
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
        $response = $this->client->get($integration, 'rest/agile/1.0/board/'.rawurlencode($containerId).'/sprint', [
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
        throw new LogicException('Implemented by Plan 12c Task 6.');
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

    private function searchJql(TeamIntegration $integration, string $jql): TrackerIssueList
    {
        $response = $this->client->post($integration, 'rest/api/3/search/jql', [
            'jql' => $jql,
            'fields' => [...self::BaseFields, ...self::storyPointFieldIds($integration)],
            'maxResults' => self::PreviewLimit,
        ]);
        $issues = [];

        foreach ((array) ($response['issues'] ?? []) as $raw) {
            if (is_array($raw) && ($issue = $this->issue($integration, $raw)) !== null) {
                $issues[] = $issue;
            }
        }

        $nextPageToken = $response['nextPageToken'] ?? null;
        $truncated = (is_string($nextPageToken) && $nextPageToken !== '') || ($response['isLast'] ?? true) === false;

        return new TrackerIssueList($issues, $truncated);
    }

    /**
     * @param  array<array-key, mixed>  $raw
     */
    private function issue(TeamIntegration $integration, array $raw): ?TrackerIssue
    {
        $id = $raw['id'] ?? null;
        $key = $raw['key'] ?? null;

        if ((! is_string($id) && ! is_int($id)) || ! is_string($key)) {
            return null;
        }

        $fields = is_array($raw['fields'] ?? null) ? $raw['fields'] : [];
        $description = $fields['description'] ?? null;
        $siteUrl = rtrim((string) $integration->setting('siteUrl', ''), '/');

        return new TrackerIssue(
            externalId: (string) $id,
            key: $key,
            title: TrackerIssue::title($fields['summary'] ?? null, $key),
            description: $this->adfToMarkdown->convert(is_array($description) ? $description : null),
            url: "{$siteUrl}/browse/{$key}",
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

- [ ] **Step 6: Create the Linear tracker**

Create `app/Support/Integrations/Trackers/LinearTracker.php`:

```php
<?php

namespace App\Support\Integrations\Trackers;

use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\AdfToMarkdown;
use App\Support\Integrations\Linear\LinearClient;
use LogicException;

class LinearTracker implements IssueTracker
{
    private const IssueFields = 'id identifier title description url estimate assignee { displayName } state { name }';

    private const MaxTeams = 250;

    public function __construct(private LinearClient $client) {}

    public function containers(TeamIntegration $integration, ?string $query, int $page): array
    {
        $filter = $query !== null && trim($query) !== '' ? ['name' => ['containsIgnoreCase' => trim($query)]] : null;

        $data = $this->client->query(
            $integration,
            'query($filter: TeamFilter) { teams(first: '.self::MaxTeams.', filter: $filter) { nodes { id name } } }',
            ['filter' => $filter],
        );

        $teams = [];

        foreach ((array) data_get($data, 'teams.nodes', []) as $team) {
            if (is_array($team) && is_string($team['id'] ?? null)) {
                $teams[] = ['id' => $team['id'], 'name' => is_string($team['name'] ?? null) ? $team['name'] : $team['id']];
            }
        }

        $offset = (max($page, 1) - 1) * self::ContainerPageSize;

        return [
            'containers' => array_slice($teams, $offset, self::ContainerPageSize),
            'hasMore' => count($teams) > $offset + self::ContainerPageSize,
        ];
    }

    public function iterations(TeamIntegration $integration, string $containerId): array
    {
        $data = $this->client->query(
            $integration,
            'query($id: String!) { team(id: $id) { cycles(first: 50, filter: {or: [{isActive: {eq: true}}, {isFuture: {eq: true}}]}) { nodes { id name number startsAt endsAt isActive } } } }',
            ['id' => $containerId],
        );

        $cycles = array_values(array_filter(
            (array) data_get($data, 'team.cycles.nodes', []),
            fn (mixed $cycle): bool => is_array($cycle) && is_string($cycle['id'] ?? null),
        ));

        usort($cycles, fn (array $first, array $second): int => strcmp((string) ($first['startsAt'] ?? ''), (string) ($second['startsAt'] ?? '')));

        return array_map(fn (array $cycle): array => [
            'id' => $cycle['id'],
            'name' => is_string($cycle['name'] ?? null) && $cycle['name'] !== ''
                ? $cycle['name']
                : __('Cycle :number', ['number' => (string) ($cycle['number'] ?? '')]),
            'state' => ($cycle['isActive'] ?? false) === true ? 'active' : 'upcoming',
            'startsOn' => $this->day($cycle['startsAt'] ?? null),
            'endsOn' => $this->day($cycle['endsAt'] ?? null),
        ], $cycles);
    }

    public function iterationIssues(TeamIntegration $integration, string $iterationId): TrackerIssueList
    {
        $data = $this->client->query(
            $integration,
            'query($id: String!) { cycle(id: $id) { issues(first: '.self::PreviewLimit.') { nodes { '.self::IssueFields.' } pageInfo { hasNextPage } } } }',
            ['id' => $iterationId],
        );

        return $this->list((array) data_get($data, 'cycle.issues', []));
    }

    public function search(TeamIntegration $integration, string $query): TrackerIssueList
    {
        $data = $this->client->query(
            $integration,
            'query($term: String!) { searchIssues(term: $term, first: '.self::PreviewLimit.') { nodes { '.self::IssueFields.' } pageInfo { hasNextPage } } }',
            ['term' => $query],
        );

        return $this->list((array) data_get($data, 'searchIssues', []));
    }

    public function issues(TeamIntegration $integration, array $externalIds): array
    {
        $issues = [];

        foreach (array_chunk(array_values(array_unique($externalIds)), self::PreviewLimit) as $chunk) {
            $data = $this->client->query(
                $integration,
                'query($ids: [ID!]) { issues(first: '.self::PreviewLimit.', filter: {id: {in: $ids}}) { nodes { '.self::IssueFields.' } } }',
                ['ids' => $chunk],
            );

            foreach ($this->list((array) data_get($data, 'issues', []))->issues as $issue) {
                $issues[$issue->externalId] = $issue;
            }
        }

        return $issues;
    }

    public function writeEstimate(TeamIntegration $integration, string $externalId, ?string $estimate): void
    {
        throw new LogicException('Implemented by Plan 12c Task 6.');
    }

    /**
     * @param  array<array-key, mixed>  $connection
     */
    private function list(array $connection): TrackerIssueList
    {
        $issues = [];

        foreach ((array) ($connection['nodes'] ?? []) as $node) {
            if (is_array($node) && ($issue = $this->issue($node)) !== null) {
                $issues[] = $issue;
            }
        }

        return new TrackerIssueList($issues, data_get($connection, 'pageInfo.hasNextPage') === true);
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function issue(array $node): ?TrackerIssue
    {
        $id = $node['id'] ?? null;
        $key = $node['identifier'] ?? null;
        $url = $node['url'] ?? null;

        if (! is_string($id) || ! is_string($key) || ! is_string($url)) {
            return null;
        }

        $description = is_string($node['description'] ?? null) && trim($node['description']) !== ''
            ? AdfToMarkdown::truncate(trim($node['description']))
            : null;

        return new TrackerIssue(
            externalId: $id,
            key: $key,
            title: TrackerIssue::title($node['title'] ?? null, $key),
            description: $description,
            url: $url,
            assignee: TrackerIssue::shorten(data_get($node, 'assignee.displayName'), TrackerIssue::AssigneeLength),
            estimate: TrackerIssue::formatEstimate($node['estimate'] ?? null),
            status: TrackerIssue::shorten(data_get($node, 'state.name'), TrackerIssue::AssigneeLength),
        );
    }

    private function day(mixed $value): ?string
    {
        return is_string($value) && strlen($value) >= 10 ? substr($value, 0, 10) : null;
    }
}
```

- [ ] **Step 7: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `Cycle :number` | `Cycle :number` | `Ciclo :number` | `Zyklus :number` |

- [ ] **Step 8: Run the test to verify it passes**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IssueTrackersTest.php`
Expected: PASS (10 tests).

- [ ] **Step 9: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Integrations/Trackers tests/Pest.php tests/Feature/Integrations/IssueTrackersTest.php lang
git commit -m "feat: read Jira and Linear boards, iterations and issues

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 3: Presenting imported tasks (`PokerTaskSync`, `external`, snapshot `integrations`, managed tasks)

**Files:**
- Create: `app/Actions/Integrations/PokerTaskSync.php`
- Modify: `app/Actions/Poker/PresentPokerTask.php`, `app/Actions/Poker/BuildPokerSnapshot.php`, `app/Actions/Poker/PokerGuard.php`, `app/Http/Controllers/Poker/PokerTasksController.php`, `app/Http/Controllers/Poker/PokerTaskEstimatesController.php`, `tests/Pest.php`, `lang/{en,fr,es,de}.json`
- Test: `tests/Feature/Integrations/PokerTaskExternalTest.php`

**Interfaces:**
- Consumes: Plan 12a `TeamIntegration::{isActive, canWrite, site, access, status}`, `Team::integrations()`, `IntegrationProvider::{isTracker, isEnabled, label}`, `PokerTask::factory()->imported()`; Task 2 `JiraTracker::storyPointFieldIds()`.
- Produces:
  - `App\Actions\Integrations\PokerTaskSync` with constants `Synced`, `Pending`, `Failed`, `Unsupported`; `static for(PokerGame): self` (loads `team.integrations` once), `static trackerProviders(): array<int, IntegrationProvider>`, `integration(string $source): ?TeamIntegration` (null when the provider is disabled or not connected), `summary(): array<string, array{connected: bool, canWrite: bool}|null>` (keys `jira`, `linear`; null for a disabled provider), `unsupportedReason(PokerTask): ?string`, `state(PokerTask): ?string`.
  - `PresentPokerTask::handle(PokerTask $task, ?PokerTaskSync $sync = null)`: `external` is `null` for a non-imported task, `{source, key, url, isManaged: true}` without `$sync` (broadcasts, guests), and `{source, key, url, assignee, sourceEstimate, refreshedAt, syncState, syncError, unsupportedReason, isManaged: true}` with it (`syncError` only when `failed`, `unsupportedReason` only when `unsupported`).
  - `BuildPokerSnapshot` snapshot key `integrations` (`PokerTaskSync::summary()` for non-guests, `null` for guests) and full `external` for non-guests.
  - `PokerGuard::notManaged(PokerTask): void` (422 on `title`, "This task is managed in :source.").
  - Pest helpers `trackerTable(IntegrationProvider $source = Jira, IntegrationAccess $access = Write, PokerDeck $deck = Fibonacci): array{game, integration, facilitator, facilitatorPlayer, member, memberPlayer}` (enables only `$source`; game with guest access) and `importedPokerTask(PokerGame $game, array $attributes = [], IntegrationProvider $source = Jira): PokerTask` (site `cloud-1` for Jira, `org-1` for Linear, attributes force-filled).

- [ ] **Step 1: Add the test helpers**

Append to `tests/Pest.php` (import `App\Enums\IntegrationAccess`, `App\Enums\IntegrationProvider`, `App\Models\TeamIntegration` at the top of the file if they are not there yet):

```php
/**
 * A game (guest access on) whose team is connected to a tracker, with a
 * facilitator and a member. Only `$source` is enabled on the instance.
 *
 * @return array{
 *     game: PokerGame,
 *     integration: TeamIntegration,
 *     facilitator: User,
 *     facilitatorPlayer: PokerPlayer,
 *     member: User,
 *     memberPlayer: PokerPlayer
 * }
 */
function trackerTable(IntegrationProvider $source = IntegrationProvider::Jira, IntegrationAccess $access = IntegrationAccess::Write, PokerDeck $deck = PokerDeck::Fibonacci): array
{
    enableIntegrations($source);

    $game = PokerGame::factory()->deck($deck)->withGuestAccess()->create();
    $factory = TeamIntegration::factory();
    $integration = ($source === IntegrationProvider::Jira ? $factory->jira($access) : $factory->linear($access))
        ->create(['team_id' => $game->team_id]);
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);
    [$member, $memberPlayer] = pokerMember($game);

    return [
        'game' => $game,
        'integration' => $integration,
        'facilitator' => $facilitator,
        'facilitatorPlayer' => $facilitatorPlayer,
        'member' => $member,
        'memberPlayer' => $memberPlayer,
    ];
}

/**
 * @param  array<string, mixed>  $attributes
 */
function importedPokerTask(PokerGame $game, array $attributes = [], IntegrationProvider $source = IntegrationProvider::Jira): PokerTask
{
    $task = PokerTask::factory()
        ->imported($source, $source === IntegrationProvider::Jira ? 'cloud-1' : 'org-1')
        ->create(['poker_game_id' => $game->id]);

    $task->forceFill($attributes)->save();

    return $task->fresh() ?? $task;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Integrations/PokerTaskExternalTest.php`:

```php
<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationStatus;
use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerTaskSaved;
use App\Models\PokerTask;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Http::preventStrayRequests());

it('shows the full external object and the connections to non-guest players', function () {
    $table = trackerTable();
    $task = importedPokerTask($table['game'], ['external_assignee' => 'Jane Doe', 'external_estimate' => '3', 'synced_at' => now()]);

    $response = $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))->assertOk();

    expect($response->json('tasks.0.external'))->toBe([
        'source' => 'jira',
        'key' => $task->external_key,
        'url' => $task->external_url,
        'assignee' => 'Jane Doe',
        'sourceEstimate' => '3',
        'refreshedAt' => $task->external_refreshed_at?->toIso8601String(),
        'syncState' => 'synced',
        'syncError' => null,
        'unsupportedReason' => null,
        'isManaged' => true,
    ])
        ->and($response->json('integrations'))->toBe(['jira' => ['connected' => true, 'canWrite' => true], 'linear' => null])
        ->and($response->json('tasks.0.external.syncState'))->toBe('synced');
});

it('gives guests the reduced external object and no connections', function () {
    $table = trackerTable();
    $task = importedPokerTask($table['game'], ['external_assignee' => 'Jane Doe', 'sync_error' => 'Boom', 'needs_sync' => true]);
    $guest = pokerGuest($table['game']);

    $response = $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk();

    expect($response->json('tasks.0.external'))->toBe([
        'source' => 'jira',
        'key' => $task->external_key,
        'url' => $task->external_url,
        'isManaged' => true,
    ])
        ->and($response->json('integrations'))->toBeNull()
        ->and($response->getContent())->not->toContain('Jane Doe')->not->toContain('Boom');
});

it('keeps external null for tasks that were not imported', function () {
    $table = trackerTable();
    PokerTask::factory()->create(['poker_game_id' => $table['game']->id]);

    $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.external', null);
});

it('broadcasts the reduced external object and answers the full one', function () {
    Queue::fake();
    Event::fake([PokerTaskSaved::class]);
    $table = trackerTable();
    $task = importedPokerTask($table['game'], ['external_estimate' => '3']);
    $round = openPokerRound($table['game'], $task);
    pokerVote($round, $table['facilitatorPlayer'], '5');
    $round->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $task]), ['value' => '5'])
        ->assertOk()
        ->assertJsonPath('external.sourceEstimate', '3')
        ->assertJsonPath('external.isManaged', true);

    Event::assertDispatched(PokerTaskSaved::class, fn (PokerTaskSaved $event) => $event->task['external'] === [
        'source' => 'jira',
        'key' => $task->external_key,
        'url' => $task->external_url,
        'isManaged' => true,
    ]);
});

it('computes the write-back state', function (array $attributes, ?string $state, ?string $error) {
    $table = trackerTable();
    importedPokerTask($table['game'], $attributes);

    $external = $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))->json('tasks.0.external');

    expect($external['syncState'])->toBe($state)
        ->and($external['syncError'])->toBe($error)
        ->and($external['unsupportedReason'])->toBeNull();
})->with([
    'never written' => [[], null, null],
    'pending' => [['needs_sync' => true], 'pending', null],
    'failed' => [['needs_sync' => true, 'sync_error' => 'Boom'], 'failed', 'Boom'],
    'synced' => [['synced_at' => now()], 'synced', null],
]);

it('marks tasks unsupported for …', function (Closure $arrange, string $reason) {
    $table = trackerTable();
    $task = importedPokerTask($table['game']);
    $arrange($table, $task);

    $external = $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))->json('tasks.0.external');

    expect($external['syncState'])->toBe('unsupported')
        ->and($external['unsupportedReason'])->toBe($reason);
})->with([
    'a T-shirt deck' => [fn (array $table) => $table['game']->forceFill(['deck' => PokerDeck::Tshirt, 'cards' => PokerDeck::Tshirt->cards()])->save(), "T-shirt estimates can't be written to Jira."],
    'a read-only connection' => [fn (array $table) => $table['integration']->forceFill(['access' => IntegrationAccess::Read])->save(), 'This Jira connection is read-only.'],
    'another site' => [fn (array $table, PokerTask $task) => $task->forceFill(['external_site' => 'cloud-9'])->save(), 'This task comes from another Jira site.'],
    'no story points field' => [fn (array $table) => $table['integration']->forceFill(['settings' => [...$table['integration']->settings, 'storyPointFields' => []]])->save(), 'No story points field found.'],
    'a lost connection' => [fn (array $table) => $table['integration']->forceFill(['status' => IntegrationStatus::ReconnectRequired])->save(), 'Reconnect Jira in the team settings.'],
    'no connection' => [fn (array $table) => $table['integration']->delete(), 'Connect Jira in the team settings.'],
]);

it('refuses edits of imported tasks but lets the facilitator delete them', function () {
    $table = trackerTable();
    $task = importedPokerTask($table['game']);

    $this->actingAs($table['member'])
        ->patchJson(route('poker.tasks.update', [$table['game'], $task]), ['title' => 'Renamed'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['title' => 'This task is managed in Jira.']);

    expect($task->fresh()?->title)->not->toBe('Renamed');

    $this->actingAs($table['facilitator'])
        ->deleteJson(route('poker.tasks.destroy', [$table['game'], $task]))
        ->assertNoContent();

    Http::assertNothingSent();
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PokerTaskExternalTest.php`
Expected: FAIL (`tasks.0.external` is `null`, `integrations` missing).

- [ ] **Step 4: Create `PokerTaskSync`**

Create `app/Actions/Integrations/PokerTaskSync.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\JiraTracker;

/**
 * The single place that decides whether the estimate of an imported task
 * can be written back, and which write-back state it shows (spec 6 §6.5,
 * §6.6). Built once per game so presenting many tasks costs one query.
 */
class PokerTaskSync
{
    public const Synced = 'synced';

    public const Pending = 'pending';

    public const Failed = 'failed';

    public const Unsupported = 'unsupported';

    /**
     * @param  array<string, ?TeamIntegration>  $integrations  keyed by tracker provider value
     */
    private function __construct(private PokerGame $game, private array $integrations) {}

    public static function for(PokerGame $game): self
    {
        $game->loadMissing('team.integrations');

        $integrations = [];

        foreach (self::trackerProviders() as $provider) {
            $integrations[$provider->value] = $provider->isEnabled()
                ? $game->team->integrations->first(fn (TeamIntegration $integration): bool => $integration->provider === $provider)
                : null;
        }

        return new self($game, $integrations);
    }

    /**
     * @return array<int, IntegrationProvider>
     */
    public static function trackerProviders(): array
    {
        return array_values(array_filter(
            IntegrationProvider::cases(),
            fn (IntegrationProvider $provider): bool => $provider->isTracker(),
        ));
    }

    public function integration(string $source): ?TeamIntegration
    {
        return $this->integrations[$source] ?? null;
    }

    /**
     * @return array<string, array{connected: bool, canWrite: bool}|null>
     */
    public function summary(): array
    {
        $summary = [];

        foreach (self::trackerProviders() as $provider) {
            $integration = $this->integrations[$provider->value] ?? null;

            $summary[$provider->value] = $provider->isEnabled() ? [
                'connected' => $integration?->isActive() ?? false,
                'canWrite' => $integration?->canWrite() ?? false,
            ] : null;
        }

        return $summary;
    }

    public function unsupportedReason(PokerTask $task): ?string
    {
        $provider = IntegrationProvider::tryFrom((string) $task->external_source);

        if ($provider === null || ! $provider->isTracker()) {
            return __('This task can no longer be synced.');
        }

        $label = ['provider' => $provider->label()];
        $integration = $this->integrations[$provider->value] ?? null;

        if ($integration === null) {
            return __('Connect :provider in the team settings.', $label);
        }

        if ($integration->status === IntegrationStatus::ReconnectRequired) {
            return __('Reconnect :provider in the team settings.', $label);
        }

        if (! $integration->isActive()) {
            return __('Connect :provider in the team settings.', $label);
        }

        if ($integration->site() !== $task->external_site) {
            return __('This task comes from another :provider site.', $label);
        }

        if ($integration->access !== IntegrationAccess::Write) {
            return __('This :provider connection is read-only.', $label);
        }

        if (! $this->game->isNumeric()) {
            return __("T-shirt estimates can't be written to :source.", ['source' => $provider->label()]);
        }

        if ($provider === IntegrationProvider::Jira && JiraTracker::storyPointFieldIds($integration) === []) {
            return __('No story points field found.');
        }

        return null;
    }

    public function state(PokerTask $task): ?string
    {
        if ($task->external_source === null) {
            return null;
        }

        if ($this->unsupportedReason($task) !== null) {
            return self::Unsupported;
        }

        if ($task->needs_sync && $task->sync_error !== null) {
            return self::Failed;
        }

        if ($task->needs_sync) {
            return self::Pending;
        }

        return $task->synced_at !== null ? self::Synced : null;
    }
}
```

- [ ] **Step 5: Present the `external` object**

Replace `app/Actions/Poker/PresentPokerTask.php` with:

```php
<?php

namespace App\Actions\Poker;

use App\Actions\Integrations\PokerTaskSync;
use App\Models\PokerTask;
use Illuminate\Support\Facades\Cache;

/**
 * @phpstan-type TaskExternal array{
 *     source: string,
 *     key: string,
 *     url: string,
 *     assignee?: ?string,
 *     sourceEstimate?: ?string,
 *     refreshedAt?: ?string,
 *     syncState?: ?string,
 *     syncError?: ?string,
 *     unsupportedReason?: ?string,
 *     isManaged: true
 * }
 * @phpstan-type Task array{
 *     id: string,
 *     title: string,
 *     description: ?string,
 *     descriptionHtml: string,
 *     position: int,
 *     estimate: ?string,
 *     estimatedAt: ?string,
 *     roundsCount: int,
 *     external: ?TaskExternal
 * }
 */
class PresentPokerTask
{
    public function __construct(private RenderTaskMarkdown $renderTaskMarkdown) {}

    /**
     * Without a PokerTaskSync (broadcasts, guests) an imported task only
     * shows its source, key and link: assignee names and sync errors stay
     * with the team (spec 6 §6.6).
     *
     * @return Task
     */
    public function handle(PokerTask $task, ?PokerTaskSync $sync = null): array
    {
        $roundsCount = $task->getAttribute('rounds_count');

        return [
            'id' => $task->id,
            'title' => $task->title,
            'description' => $task->description,
            'descriptionHtml' => $this->descriptionHtml($task),
            'position' => $task->position,
            'estimate' => $task->estimate,
            'estimatedAt' => $task->estimated_at?->toIso8601String(),
            'roundsCount' => $roundsCount === null ? $task->rounds()->count() : (int) $roundsCount,
            'external' => $this->external($task, $sync),
        ];
    }

    /**
     * @return ?TaskExternal
     */
    private function external(PokerTask $task, ?PokerTaskSync $sync): ?array
    {
        if ($task->external_source === null || $task->external_key === null || $task->external_url === null) {
            return null;
        }

        if ($sync === null) {
            return [
                'source' => $task->external_source,
                'key' => $task->external_key,
                'url' => $task->external_url,
                'isManaged' => true,
            ];
        }

        $state = $sync->state($task);

        return [
            'source' => $task->external_source,
            'key' => $task->external_key,
            'url' => $task->external_url,
            'assignee' => $task->external_assignee,
            'sourceEstimate' => $task->external_estimate,
            'refreshedAt' => $task->external_refreshed_at?->toIso8601String(),
            'syncState' => $state,
            'syncError' => $state === PokerTaskSync::Failed ? $task->sync_error : null,
            'unsupportedReason' => $state === PokerTaskSync::Unsupported ? $sync->unsupportedReason($task) : null,
            'isManaged' => true,
        ];
    }

    private function descriptionHtml(PokerTask $task): string
    {
        if ($task->description === null || $task->description === '') {
            return '';
        }

        $key = 'poker-task-description:'.$task->id.':'.hash('xxh128', $task->description);

        return Cache::rememberForever($key, fn (): string => $this->renderTaskMarkdown->handle($task->description));
    }
}
```

- [ ] **Step 6: Add `integrations` to the snapshot**

In `app/Actions/Poker/BuildPokerSnapshot.php`:

1. Import `App\Actions\Integrations\PokerTaskSync`.
2. In the `Snapshot` phpstan type, add after `links: array{team: ?string},` (after Plan 12b's `share`/`deliveries` entries if they sit there):

```php
 *     integrations: ?array<string, array{connected: bool, canWrite: bool}|null>,
```

3. In `handle()`, after `$team = $game->team;`, add:

```php
        $sync = $isGuest ? null : PokerTaskSync::for($game);
```

4. Replace the `'tasks' => …` entry with:

```php
            'tasks' => $game->tasks->map(fn (PokerTask $task): array => $this->presentPokerTask->handle($task, $sync))->values()->all(),
```

5. Add right after the `'links' => [...]` entry (keep Plan 12b's `share` and `deliveries` entries where they are):

```php
            'integrations' => $sync?->summary(),
```

- [ ] **Step 7: Refuse edits of imported tasks and answer the full task to editors**

In `app/Actions/Poker/PokerGuard.php`, import `App\Enums\IntegrationProvider` and `App\Models\PokerTask`, then add:

```php
    public static function notManaged(PokerTask $task): void
    {
        if ($task->external_source === null) {
            return;
        }

        $source = IntegrationProvider::tryFrom($task->external_source)?->label() ?? $task->external_source;

        throw ValidationException::withMessages(['title' => __('This task is managed in :source.', ['source' => $source])]);
    }
```

Replace `app/Http/Controllers/Poker/PokerTasksController.php` with:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Integrations\PokerTaskSync;
use App\Actions\Poker\AddPokerTask;
use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PresentPokerTask;
use App\Events\Poker\PokerTaskDeleted;
use App\Events\Poker\PokerTaskSaved;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class PokerTasksController extends Controller
{
    public function __construct(private PresentPokerTask $presentPokerTask) {}

    public function store(Request $request, PokerGame $game, AddPokerTask $addPokerTask): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:10000'],
        ]);

        $task = DB::transaction(function () use ($game, $validated, $addPokerTask): PokerTask {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);

            return $addPokerTask->handle($locked, $validated['title'], $validated['description'] ?? null);
        });

        return response()->json($this->presentPokerTask->handle($task, PokerTaskSync::for($game)), 201);
    }

    public function update(Request $request, PokerGame $game, PokerTask $task): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);
        PokerGuard::notManaged($task);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],
        ]);

        $task = DB::transaction(function () use ($game, $task, $validated): PokerTask {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);

            $lockedTask = PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($task->id)->firstOrFail();

            PokerGuard::notManaged($lockedTask);

            $lockedTask->update($validated);
            $lockedTask->loadCount('rounds');

            (new PokerTaskSaved($locked->id, $this->presentPokerTask->handle($lockedTask)))->sendToOthers();

            return $lockedTask;
        });

        return response()->json($this->presentPokerTask->handle($task, PokerTaskSync::for($game)));
    }

    public function destroy(Request $request, PokerGame $game, PokerTask $task): Response
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        DB::transaction(function () use ($game, $task, $player): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $lockedTask = PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($task->id)->firstOrFail();
            $taskId = $lockedTask->id;

            $lockedTask->delete();

            (new PokerTaskDeleted($locked->id, $taskId))->sendToOthers();
        });

        return response()->noContent();
    }
}
```

In `app/Http/Controllers/Poker/PokerTaskEstimatesController.php`, import `App\Actions\Integrations\PokerTaskSync` and replace the last line of `update()` with:

```php
        return response()->json($presentPokerTask->handle($estimated, PokerTaskSync::for($game)));
```

- [ ] **Step 8: Add the translations**

Append to `lang/{en,fr,es,de}.json` (skip keys that already exist):

| Key (en) | fr | es | de |
|---|---|---|---|
| `This task is managed in :source.` | `Cette tâche est gérée dans :source.` | `Esta tarea se gestiona en :source.` | `Diese Aufgabe wird in :source verwaltet.` |
| `This task can no longer be synced.` | `Cette tâche ne peut plus être synchronisée.` | `Esta tarea ya no se puede sincronizar.` | `Diese Aufgabe kann nicht mehr synchronisiert werden.` |
| `This task comes from another :provider site.` | `Cette tâche provient d’un autre site :provider.` | `Esta tarea viene de otro sitio de :provider.` | `Diese Aufgabe stammt von einer anderen :provider-Site.` |
| `T-shirt estimates can't be written to :source.` | `Les estimations en tailles de T-shirt ne peuvent pas être écrites dans :source.` | `Las estimaciones en tallas de camiseta no se pueden escribir en :source.` | `T-Shirt-Schätzungen können nicht in :source geschrieben werden.` |
| `No story points field found.` | `Aucun champ de story points trouvé.` | `No se encontró ningún campo de story points.` | `Kein Story-Points-Feld gefunden.` |

- [ ] **Step 9: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PokerTaskExternalTest.php tests/Feature/Poker`
Expected: PASS (the existing poker suites unchanged: non-imported tasks still carry `external: null`).

- [ ] **Step 10: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Integrations/PokerTaskSync.php app/Actions/Poker app/Http/Controllers/Poker tests/Pest.php tests/Feature/Integrations/PokerTaskExternalTest.php lang
git commit -m "feat: present imported poker tasks and their write-back state

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 4: Browsing the source (containers, iterations, preview)

**Files:**
- Create: `app/Actions/Integrations/{ResolvePokerTracker,ListPokerIterations,PreviewPokerImport}.php`, `app/Support/Integrations/TrackerBrowseLimit.php`, `app/Http/Controllers/Integrations/{PokerImportContainersController,PokerImportIterationsController,PokerImportPreviewsController}.php`
- Modify: `routes/web.php`, `tests/Pest.php`
- Test: `tests/Feature/Integrations/PokerImportBrowsingTest.php`

**Interfaces:**
- Consumes: Task 2 `Trackers`, `IssueTracker`, `TrackerIssueList`; Plan 12a `Team::integration()`, `TeamIntegration::ensureActive()`, `NotConnected`; `PokerGuard::{notEnded, canEditTasks}`, `PokerPlayer::current()`.
- Produces:
  - `ResolvePokerTracker::handle(Team $team, string $source): TeamIntegration` (404 unless `$source` is an enabled tracker provider; `NotConnected` 409 without a row; `ensureActive()` otherwise) and `teamHasTracker(Team): bool` (an `Active` integration of an enabled tracker provider).
  - `TrackerBrowseLimit::hit(string $actorId): void` (30 per minute per key `tracker-browse:{actorId}`, `ThrottleRequestsException` "Too many requests, wait a moment." with `Retry-After`). Callers pass the user id (`$player->user_id ?? $player->id` on HTTP, the MCP user id), so HTTP and MCP share the limit.
  - `ListPokerIterations::{containers(TeamIntegration, ?string $query = null, int $page = 1), iterations(TeamIntegration, string $containerId), handle(TeamIntegration, ?string $containerId): array{containers: ?array, iterations: array}}`.
  - `PreviewPokerImport` with constants `ModeIteration = 'iteration'`, `ModeQuery = 'query'`, `fetch(TeamIntegration, string $mode, ?string $iterationId, ?string $query): TrackerIssueList` and `handle(PokerGame, TeamIntegration, string $mode, ?string $iterationId, ?string $query): array{issues: array<int, array{externalId, key, title, assignee, estimate, status, alreadyImported}>, truncated: bool}`.
  - Routes `poker.imports.containers.index` (GET `imports/{source}/containers?q=&page=`), `poker.imports.iterations.index` (GET `imports/{source}/iterations?container=`), `poker.imports.preview.store` (POST `imports/{source}/preview`), `{source}` constrained to `jira|linear`.
  - Pest helper `fakeJiraTrackerApi(?array $issues = null): void` (boards → one board `7` "Sweep scrum board", sprints → `31` "Sprint 31", `search/jql` → `$issues` or PROJ-1/PROJ-2, `editmeta` → `customfield_10016`, issue PUT → 204).

- [ ] **Step 1: Add the Jira fake helper**

Append to `tests/Pest.php`:

```php
/**
 * Fakes every Jira endpoint the poker import and write-back use on the
 * `cloud-1` site. More specific patterns come first: the first match wins.
 *
 * @param  array<int, array<string, mixed>>|null  $issues
 */
function fakeJiraTrackerApi(?array $issues = null): void
{
    $issues ??= [jiraTrackerIssue('10001', 'PROJ-1'), jiraTrackerIssue('10002', 'PROJ-2')];

    Http::fake([
        'api.atlassian.com/ex/jira/cloud-1/rest/agile/1.0/board/*/sprint*' => Http::response(['values' => [
            ['id' => 31, 'name' => 'Sprint 31', 'state' => 'active'],
        ]]),
        'api.atlassian.com/ex/jira/cloud-1/rest/agile/1.0/board*' => Http::response([
            'values' => [['id' => 7, 'name' => 'Sweep scrum board']],
            'isLast' => true,
        ]),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::response(['issues' => $issues, 'isLast' => true]),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*/editmeta' => Http::response(['fields' => [
            'customfield_10016' => ['name' => 'Story point estimate'],
        ]]),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*' => Http::response(null, 204),
    ]);
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Integrations/PokerImportBrowsingTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('lists boards, sprints and sprint issues for players who can add tasks', function () {
    $table = trackerTable();
    fakeJiraTrackerApi();
    importedPokerTask($table['game'], ['external_id' => '10001', 'external_key' => 'PROJ-1']);

    $this->actingAs($table['member'])
        ->getJson(route('poker.imports.containers.index', [$table['game'], 'jira', 'q' => 'Sweep']))
        ->assertOk()
        ->assertExactJson(['containers' => [['id' => '7', 'name' => 'Sweep scrum board']], 'hasMore' => false]);

    $this->actingAs($table['member'])
        ->getJson(route('poker.imports.iterations.index', [$table['game'], 'jira', 'container' => '7']))
        ->assertOk()
        ->assertJsonPath('0.id', '31')
        ->assertJsonPath('0.name', 'Sprint 31')
        ->assertJsonPath('0.state', 'active');

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.preview.store', [$table['game'], 'jira']), ['mode' => 'iteration', 'iteration_id' => '31'])
        ->assertOk()
        ->assertJsonPath('truncated', false)
        ->assertJsonPath('issues.0.key', 'PROJ-1')
        ->assertJsonPath('issues.0.alreadyImported', true)
        ->assertJsonPath('issues.1.key', 'PROJ-2')
        ->assertJsonPath('issues.1.alreadyImported', false);

    Http::assertSent(fn (Request $request) => str_contains($request->url(), 'name=Sweep'));
    Http::assertSent(fn (Request $request) => ($request['jql'] ?? null) === 'sprint = 31 ORDER BY Rank ASC');
});

it('previews a JQL query and surfaces Jira errors', function () {
    $table = trackerTable();
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::sequence()
        ->push(['issues' => array_map(fn (int $n) => jiraTrackerIssue((string) (10000 + $n), "PROJ-{$n}"), range(1, 100)), 'nextPageToken' => 'more'])
        ->push(['errorMessages' => ["Error in the JQL Query: 'project' is a reserved word."]], 400)]);
    $url = route('poker.imports.preview.store', [$table['game'], 'jira']);

    $this->actingAs($table['member'])->postJson($url, ['mode' => 'iteration'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('iteration_id');

    $this->actingAs($table['member'])->postJson($url, ['mode' => 'query', 'query' => 'project = PROJ'])
        ->assertOk()
        ->assertJsonCount(100, 'issues')
        ->assertJsonPath('truncated', true);

    $this->actingAs($table['member'])->postJson($url, ['mode' => 'query', 'query' => 'project ='])
        ->assertUnprocessable()
        ->assertJsonPath('message', "Error in the JQL Query: 'project' is a reserved word.");

    Http::assertSent(fn (Request $request) => $request['jql'] === 'project = PROJ');
});

it('previews a Linear cycle', function () {
    $table = trackerTable(IntegrationProvider::Linear);
    fakeLinearGraphql(['cycle(' => ['cycle' => ['issues' => [
        'nodes' => [linearTrackerIssue('uuid-1', 'ENG-1')],
        'pageInfo' => ['hasNextPage' => false],
    ]]]]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.preview.store', [$table['game'], 'linear']), ['mode' => 'iteration', 'iteration_id' => 'cycle-1'])
        ->assertOk()
        ->assertJsonPath('issues.0.key', 'ENG-1')
        ->assertJsonPath('issues.0.estimate', '2')
        ->assertJsonPath('issues.0.assignee', 'Sam Lee');
});

it('refuses guests and ended games', function () {
    $table = trackerTable();
    $guest = pokerGuest($table['game']);
    $url = route('poker.imports.containers.index', [$table['game'], 'jira']);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()->getJson($url)->assertForbidden();

    $table['game']->forceFill(['ended_at' => now()])->save();

    $this->actingAs($table['member'])->getJson($url)->assertForbidden();

    Http::assertNothingSent();
});

it('answers 404 for a disabled provider and 409 without an active connection', function () {
    $table = trackerTable();
    $url = fn (string $source) => route('poker.imports.containers.index', [$table['game'], $source]);

    $this->actingAs($table['member'])->getJson($url('linear'))->assertNotFound();

    enableIntegrations(IntegrationProvider::Linear);

    $this->actingAs($table['member'])->getJson($url('linear'))
        ->assertConflict()
        ->assertJsonPath('message', 'Connect Linear in the team settings.');

    $table['integration']->forceFill(['status' => IntegrationStatus::ReconnectRequired])->save();

    $this->actingAs($table['member'])->getJson($url('jira'))
        ->assertConflict()
        ->assertJsonPath('message', 'Reconnect Jira in the team settings.');

    $this->actingAs($table['member'])->getJson("/poker/{$table['game']->id}/imports/github/containers")->assertNotFound();

    Http::assertNothingSent();
});

it('throttles browsing at 30 requests a minute per player', function () {
    $table = trackerTable();
    fakeJiraTrackerApi();
    $url = route('poker.imports.containers.index', [$table['game'], 'jira']);

    foreach (range(1, 30) as $attempt) {
        $this->actingAs($table['member'])->getJson($url)->assertOk();
    }

    $this->actingAs($table['member'])->getJson($url)
        ->assertTooManyRequests()
        ->assertJsonPath('message', 'Too many requests, wait a moment.');

    $this->actingAs($table['facilitator'])->getJson($url)->assertOk();
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PokerImportBrowsingTest.php`
Expected: FAIL with `Route [poker.imports.containers.index] not defined.`

- [ ] **Step 4: Create the resolver, the limit and the services**

Create `app/Actions/Integrations/ResolvePokerTracker.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\NotConnected;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ResolvePokerTracker
{
    public function handle(Team $team, string $source): TeamIntegration
    {
        $provider = IntegrationProvider::tryFrom($source);

        if ($provider === null || ! $provider->isTracker() || ! $provider->isEnabled()) {
            throw new NotFoundHttpException;
        }

        $integration = $team->integration($provider);

        if ($integration === null) {
            throw new NotConnected($provider);
        }

        $integration->ensureActive();

        return $integration;
    }

    public function teamHasTracker(Team $team): bool
    {
        $providers = array_map(
            fn (IntegrationProvider $provider): string => $provider->value,
            array_values(array_filter(IntegrationProvider::enabled(), fn (IntegrationProvider $provider): bool => $provider->isTracker())),
        );

        if ($providers === []) {
            return false;
        }

        return $team->integrations()
            ->whereIn('provider', $providers)
            ->where('status', IntegrationStatus::Active->value)
            ->exists();
    }
}
```

Create `app/Support/Integrations/TrackerBrowseLimit.php`:

```php
<?php

namespace App\Support\Integrations;

use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Spec 6 §9: browsing a tracker is limited per person, whether through the
 * game page or MCP. Throttled in code because the route middleware runs
 * before the player is resolved.
 */
class TrackerBrowseLimit
{
    public const MaxAttempts = 30;

    public static function hit(string $actorId): void
    {
        $key = "tracker-browse:{$actorId}";

        if (RateLimiter::tooManyAttempts($key, self::MaxAttempts)) {
            throw new ThrottleRequestsException(__('Too many requests, wait a moment.'), null, ['Retry-After' => RateLimiter::availableIn($key)]);
        }

        RateLimiter::hit($key);
    }
}
```

Create `app/Actions/Integrations/ListPokerIterations.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\Trackers;

class ListPokerIterations
{
    public function __construct(private Trackers $trackers) {}

    /**
     * @return array{containers: array<int, array{id: string, name: string}>, hasMore: bool}
     */
    public function containers(TeamIntegration $integration, ?string $query = null, int $page = 1): array
    {
        return $this->trackers->for($integration->provider)->containers($integration, $query, $page);
    }

    /**
     * @return array<int, array{id: string, name: string, state: 'active'|'upcoming', startsOn: ?string, endsOn: ?string}>
     */
    public function iterations(TeamIntegration $integration, string $containerId): array
    {
        return $this->trackers->for($integration->provider)->iterations($integration, $containerId);
    }

    /**
     * The MCP `poker.iterations.list` shape (spec 5 §6.2).
     *
     * @return array{
     *     containers: array<int, array{id: string, name: string}>|null,
     *     iterations: array<int, array{id: string, name: string, state: 'active'|'upcoming', startsOn: ?string, endsOn: ?string}>
     * }
     */
    public function handle(TeamIntegration $integration, ?string $containerId): array
    {
        if ($containerId === null) {
            return ['containers' => $this->containers($integration)['containers'], 'iterations' => []];
        }

        return ['containers' => null, 'iterations' => $this->iterations($integration, $containerId)];
    }
}
```

Create `app/Actions/Integrations/PreviewPokerImport.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\PokerGame;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\TrackerIssue;
use App\Support\Integrations\Trackers\TrackerIssueList;
use App\Support\Integrations\Trackers\Trackers;

class PreviewPokerImport
{
    public const ModeIteration = 'iteration';

    public const ModeQuery = 'query';

    public function __construct(private Trackers $trackers) {}

    public function fetch(TeamIntegration $integration, string $mode, ?string $iterationId, ?string $query): TrackerIssueList
    {
        $tracker = $this->trackers->for($integration->provider);

        return $mode === self::ModeIteration
            ? $tracker->iterationIssues($integration, (string) $iterationId)
            : $tracker->search($integration, (string) $query);
    }

    /**
     * @return array{
     *     issues: array<int, array{externalId: string, key: string, title: string, assignee: ?string, estimate: ?string, status: ?string, alreadyImported: bool}>,
     *     truncated: bool
     * }
     */
    public function handle(PokerGame $game, TeamIntegration $integration, string $mode, ?string $iterationId, ?string $query): array
    {
        $list = $this->fetch($integration, $mode, $iterationId, $query);

        $imported = $game->tasks()
            ->where('external_source', $integration->provider->value)
            ->whereIn('external_id', array_map(fn (TrackerIssue $issue): string => $issue->externalId, $list->issues))
            ->pluck('external_id')
            ->flip();

        return [
            'issues' => array_map(fn (TrackerIssue $issue): array => $issue->preview($imported->has($issue->externalId)), $list->issues),
            'truncated' => $list->truncated,
        ];
    }
}
```

- [ ] **Step 5: Create the controllers**

Create `app/Http/Controllers/Integrations/PokerImportContainersController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\ListPokerIterations;
use App\Actions\Integrations\ResolvePokerTracker;
use App\Actions\Poker\PokerGuard;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Support\Integrations\TrackerBrowseLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PokerImportContainersController extends Controller
{
    public function index(Request $request, PokerGame $game, string $source, ResolvePokerTracker $resolvePokerTracker, ListPokerIterations $listPokerIterations): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $integration = $resolvePokerTracker->handle($game->team, $source);

        TrackerBrowseLimit::hit($player->user_id ?? $player->id);

        return response()->json($listPokerIterations->containers($integration, $validated['q'] ?? null, (int) ($validated['page'] ?? 1)));
    }
}
```

Create `app/Http/Controllers/Integrations/PokerImportIterationsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\ListPokerIterations;
use App\Actions\Integrations\ResolvePokerTracker;
use App\Actions\Poker\PokerGuard;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Support\Integrations\TrackerBrowseLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PokerImportIterationsController extends Controller
{
    public function index(Request $request, PokerGame $game, string $source, ResolvePokerTracker $resolvePokerTracker, ListPokerIterations $listPokerIterations): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $validated = $request->validate([
            'container' => ['required', 'string', 'max:100'],
        ]);

        $integration = $resolvePokerTracker->handle($game->team, $source);

        TrackerBrowseLimit::hit($player->user_id ?? $player->id);

        return response()->json($listPokerIterations->iterations($integration, (string) $validated['container']));
    }
}
```

Create `app/Http/Controllers/Integrations/PokerImportPreviewsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\PreviewPokerImport;
use App\Actions\Integrations\ResolvePokerTracker;
use App\Actions\Poker\PokerGuard;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Support\Integrations\TrackerBrowseLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PokerImportPreviewsController extends Controller
{
    public function store(Request $request, PokerGame $game, string $source, ResolvePokerTracker $resolvePokerTracker, PreviewPokerImport $previewPokerImport): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $validated = $request->validate([
            'mode' => ['required', Rule::in([PreviewPokerImport::ModeIteration, PreviewPokerImport::ModeQuery])],
            'iteration_id' => ['required_if:mode,iteration', 'nullable', 'string', 'max:100'],
            'query' => ['required_if:mode,query', 'nullable', 'string', 'max:1000'],
        ]);

        $integration = $resolvePokerTracker->handle($game->team, $source);

        TrackerBrowseLimit::hit($player->user_id ?? $player->id);

        return response()->json($previewPokerImport->handle(
            $game,
            $integration,
            $validated['mode'],
            $validated['iteration_id'] ?? null,
            $validated['query'] ?? null,
        ));
    }
}
```

- [ ] **Step 6: Register the routes**

In `routes/web.php`, import the three controllers and add inside the `poker/{game}` group, after the `settings`/`saved-decks` routes (and after Plan 12b's `shares` route):

```php
        Route::get('imports/{source}/containers', [PokerImportContainersController::class, 'index'])->name('poker.imports.containers.index')->where('source', 'jira|linear');
        Route::get('imports/{source}/iterations', [PokerImportIterationsController::class, 'index'])->name('poker.imports.iterations.index')->where('source', 'jira|linear');
        Route::post('imports/{source}/preview', [PokerImportPreviewsController::class, 'store'])->name('poker.imports.preview.store')->where('source', 'jira|linear');
```

Regenerate Wayfinder: `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 7: Run the test to verify it passes**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PokerImportBrowsingTest.php`
Expected: PASS (6 tests).

- [ ] **Step 8: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Integrations app/Support/Integrations/TrackerBrowseLimit.php app/Http/Controllers/Integrations routes/web.php tests/Pest.php tests/Feature/Integrations/PokerImportBrowsingTest.php
git commit -m "feat: browse Jira and Linear sources from a poker game

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 5: Importing and refreshing tasks (`ImportPokerTasks`, `RefreshPokerTasks`)

**Files:**
- Create: `app/Actions/Integrations/{ImportPokerTasks,RefreshPokerTasks}.php`, `app/Http/Controllers/Integrations/{PokerImportsController,PokerImportRefreshesController}.php`
- Modify: `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: `tests/Feature/Integrations/PokerImportTest.php`

**Interfaces:**
- Consumes: Task 2 `Trackers::for()->issues()`, `TrackerIssue`; Task 4 `ResolvePokerTracker`, `PreviewPokerImport::fetch()`; `AddPokerTask::MaxTasks`, `PokerGuard`, `PokerGameChanged`.
- Produces:
  - `ImportPokerTasks::handle(PokerGame $game, PokerPlayer $player, TeamIntegration $integration, array $externalIds): array{imported: int, skipped: int}` (re-fetches the ids, appends new tasks in the given order in one transaction with the game locked; duplicates and ids the source no longer returns count as skipped; 422 on `external_ids` "This game can hold 200 tasks at most." when the new ones do not fit; `game.changed` to others when something was imported).
  - `ImportPokerTasks::fromSource(PokerGame, PokerPlayer, TeamIntegration, string $mode, ?string $iterationId, ?string $query): array{imported: int, skipped: int, truncated: bool}` (whole iteration or query, capped at 100, for MCP).
  - `RefreshPokerTasks::handle(PokerGame, PokerPlayer): array{refreshed: int, missing: int}`.
  - Routes `poker.imports.store` (POST `imports/{source}`, body `external_ids`), `poker.imports.refresh.store` (POST `imports/refresh`, registered before `imports/{source}`).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/PokerImportTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\Poker\PokerGameChanged;
use App\Models\PokerTask;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('imports the selected Jira issues in the given order from the source', function () {
    Event::fake([PokerGameChanged::class]);
    $table = trackerTable();
    PokerTask::factory()->create(['poker_game_id' => $table['game']->id, 'title' => 'Existing']);
    fakeJiraTrackerApi([
        jiraTrackerIssue('10002', 'PROJ-2', ['summary' => str_repeat('T', 300)]),
        jiraTrackerIssue('10001', 'PROJ-1', ['customfield_10016' => 0.5]),
    ]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira']), ['external_ids' => ['10001', '10002'], 'title' => 'Client title'])
        ->assertCreated()
        ->assertExactJson(['imported' => 2, 'skipped' => 0]);

    $tasks = $table['game']->tasks()->orderBy('position')->get();

    expect($tasks->pluck('external_key')->all())->toBe([null, 'PROJ-1', 'PROJ-2'])
        ->and($tasks[1]->title)->toBe('Story PROJ-1')
        ->and($tasks[1]->description)->toBe('About PROJ-1')
        ->and($tasks[1]->only(['external_source', 'external_id', 'external_site', 'external_url', 'external_assignee', 'external_estimate']))->toBe([
            'external_source' => 'jira',
            'external_id' => '10001',
            'external_site' => 'cloud-1',
            'external_url' => 'https://acme.atlassian.net/browse/PROJ-1',
            'external_assignee' => 'Jane Doe',
            'external_estimate' => '0.5',
        ])
        ->and($tasks[1]->external_refreshed_at)->not->toBeNull()
        ->and($tasks[1]->estimate)->toBeNull()
        ->and(mb_strlen($tasks[2]->title))->toBe(200);

    Http::assertSent(fn (Request $request) => $request['jql'] === 'id in (10001,10002)');
    Event::assertDispatched(PokerGameChanged::class, fn (PokerGameChanged $event) => $event->gameId === $table['game']->id);
});

it('skips issues already imported and issues the source no longer returns', function () {
    $table = trackerTable();
    importedPokerTask($table['game'], ['external_id' => '10001', 'external_key' => 'PROJ-1']);
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1'), jiraTrackerIssue('10002', 'PROJ-2')]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira']), ['external_ids' => ['10001', '10002', '10404']])
        ->assertCreated()
        ->assertExactJson(['imported' => 1, 'skipped' => 2]);

    expect($table['game']->tasks()->count())->toBe(2);
});

it('refuses a batch that would exceed 200 tasks without importing any', function () {
    $table = trackerTable();
    PokerTask::factory()->count(199)->create(['poker_game_id' => $table['game']->id]);
    fakeJiraTrackerApi();

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira']), ['external_ids' => ['10001', '10002']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['external_ids' => 'This game can hold 200 tasks at most.']);

    expect($table['game']->tasks()->count())->toBe(199);
});

it('renders imported descriptions safely and trims long titles and descriptions', function () {
    $table = trackerTable(IntegrationProvider::Linear);
    fakeLinearGraphql(['issues(' => ['issues' => ['nodes' => [
        linearTrackerIssue('uuid-1', 'ENG-1', ['description' => "<script>alert(1)</script>\n\n![pixel](https://tracker.example/pixel.png)"]),
        linearTrackerIssue('uuid-2', 'ENG-2', ['description' => str_repeat('b', 10050), 'title' => str_repeat('L', 250)]),
    ]]]]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'linear']), ['external_ids' => ['uuid-1', 'uuid-2']])
        ->assertCreated()
        ->assertExactJson(['imported' => 2, 'skipped' => 0]);

    $html = $this->actingAs($table['member'])->getJson(route('poker.snapshot.show', $table['game']))->json('tasks.0.descriptionHtml');
    $long = $table['game']->tasks()->where('external_id', 'uuid-2')->sole();

    expect($html)->not->toContain('<script')->not->toContain('<img')
        ->and($html)->toContain('https://tracker.example/pixel.png')
        ->and(mb_strlen((string) $long->description))->toBe(10000)
        ->and($long->description)->toEndWith('…')
        ->and(mb_strlen($long->title))->toBe(200)
        ->and($long->external_site)->toBe('org-1')
        ->and($long->external_url)->toBe('https://linear.app/acme/issue/ENG-2');
});

it('refuses guests, ended games and malformed selections', function () {
    $table = trackerTable();
    $guest = pokerGuest($table['game']);
    $url = route('poker.imports.store', [$table['game'], 'jira']);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()->postJson($url, ['external_ids' => ['10001']])->assertForbidden();

    $this->actingAs($table['member'])->postJson($url, ['external_ids' => []])->assertJsonValidationErrors('external_ids');
    $this->actingAs($table['member'])->postJson($url, ['external_ids' => array_map('strval', range(1, 101))])->assertJsonValidationErrors('external_ids');
    $this->actingAs($table['member'])->postJson($url, ['external_ids' => ['1', '1']])->assertJsonValidationErrors('external_ids.0');

    $table['game']->forceFill(['ended_at' => now()])->save();

    $this->actingAs($table['member'])->postJson($url, ['external_ids' => ['10001']])->assertForbidden();

    Http::assertNothingSent();
});

it('refreshes imported tasks from the source and reports missing issues', function () {
    Event::fake([PokerGameChanged::class]);
    $table = trackerTable();
    $kept = importedPokerTask($table['game'], [
        'external_id' => '10001',
        'external_key' => 'PROJ-1',
        'title' => 'Old title',
        'estimate' => '8',
        'estimate_numeric' => 8,
        'external_refreshed_at' => now()->subDay(),
    ]);
    $gone = importedPokerTask($table['game'], ['external_id' => '10002', 'external_key' => 'PROJ-2', 'title' => 'Deleted in Jira']);
    $otherSite = importedPokerTask($table['game'], ['external_id' => '10003', 'external_key' => 'PROJ-3', 'external_site' => 'cloud-9', 'title' => 'Other site']);
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', ['summary' => 'New title', 'assignee' => ['displayName' => 'Ann'], 'customfield_10016' => 13])]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.refresh.store', $table['game']))
        ->assertOk()
        ->assertExactJson(['refreshed' => 1, 'missing' => 1]);

    $kept->refresh();

    expect($kept->title)->toBe('New title')
        ->and($kept->description)->toBe('About PROJ-1')
        ->and($kept->external_assignee)->toBe('Ann')
        ->and($kept->external_estimate)->toBe('13')
        ->and($kept->estimate)->toBe('8')
        ->and($kept->external_refreshed_at?->isToday())->toBeTrue()
        ->and($gone->fresh()?->title)->toBe('Deleted in Jira')
        ->and($otherSite->fresh()?->title)->toBe('Other site');

    Http::assertSent(fn (Request $request) => $request['jql'] === 'id in (10001,10002)');
    Event::assertDispatched(PokerGameChanged::class);
});

it('asks to reconnect when no source can be refreshed', function () {
    $table = trackerTable();
    importedPokerTask($table['game']);
    $table['integration']->forceFill(['status' => IntegrationStatus::ReconnectRequired])->save();

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.refresh.store', $table['game']))
        ->assertConflict()
        ->assertJsonPath('message', 'Reconnect Jira in the team settings.');

    Http::assertNothingSent();
});

it('refreshes nothing in a game without imported tasks', function () {
    $table = trackerTable();

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.refresh.store', $table['game']))
        ->assertOk()
        ->assertExactJson(['refreshed' => 0, 'missing' => 0]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PokerImportTest.php`
Expected: FAIL with `Route [poker.imports.store] not defined.`

- [ ] **Step 3: Create the import action**

Create `app/Actions/Integrations/ImportPokerTasks.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Actions\Poker\AddPokerTask;
use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerGameChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\TrackerIssue;
use App\Support\Integrations\Trackers\Trackers;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Spec 6 §6.3. Issues are always fetched again from the source: nothing a
 * client sends about an issue is trusted, only its id.
 */
class ImportPokerTasks
{
    public function __construct(
        private Trackers $trackers,
        private PreviewPokerImport $previewPokerImport,
    ) {}

    /**
     * @param  array<int, string>  $externalIds
     * @return array{imported: int, skipped: int}
     */
    public function handle(PokerGame $game, PokerPlayer $player, TeamIntegration $integration, array $externalIds): array
    {
        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $externalIds = array_values(array_unique($externalIds));
        $issues = $this->trackers->for($integration->provider)->issues($integration, $externalIds);

        return $this->store($game, $player, $integration, $externalIds, $issues);
    }

    /**
     * @return array{imported: int, skipped: int, truncated: bool}
     */
    public function fromSource(PokerGame $game, PokerPlayer $player, TeamIntegration $integration, string $mode, ?string $iterationId, ?string $query): array
    {
        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $list = $this->previewPokerImport->fetch($integration, $mode, $iterationId, $query);
        $issues = [];

        foreach ($list->issues as $issue) {
            $issues[$issue->externalId] = $issue;
        }

        return [
            ...$this->store($game, $player, $integration, array_keys($issues), $issues),
            'truncated' => $list->truncated,
        ];
    }

    /**
     * @param  array<int, string>  $externalIds
     * @param  array<string, TrackerIssue>  $issues
     * @return array{imported: int, skipped: int}
     */
    private function store(PokerGame $game, PokerPlayer $player, TeamIntegration $integration, array $externalIds, array $issues): array
    {
        return DB::transaction(function () use ($game, $player, $integration, $externalIds, $issues): array {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::canEditTasks($player);

            $source = $integration->provider->value;
            $existing = $locked->tasks()
                ->where('external_source', $source)
                ->whereIn('external_id', $externalIds)
                ->pluck('external_id')
                ->flip();

            $new = array_values(array_filter(
                $externalIds,
                fn (string $id): bool => isset($issues[$id]) && ! $existing->has($id),
            ));

            if ($locked->tasks()->count() + count($new) > AddPokerTask::MaxTasks) {
                throw ValidationException::withMessages(['external_ids' => __('This game can hold 200 tasks at most.')]);
            }

            $position = (int) $locked->tasks()->max('position');

            foreach ($new as $id) {
                $issue = $issues[$id];
                $task = new PokerTask([
                    'title' => $issue->title,
                    'description' => $issue->description,
                    'position' => ++$position,
                ]);

                $task->forceFill([
                    'poker_game_id' => $locked->id,
                    'external_source' => $source,
                    'external_id' => $issue->externalId,
                    'external_url' => $issue->url,
                    'external_site' => $integration->site(),
                    'external_key' => $issue->key,
                    'external_assignee' => $issue->assignee,
                    'external_estimate' => $issue->estimate,
                    'external_refreshed_at' => now(),
                ])->save();
            }

            if ($new !== []) {
                (new PokerGameChanged($locked->id))->sendToOthers();
            }

            return ['imported' => count($new), 'skipped' => count($externalIds) - count($new)];
        });
    }
}
```

- [ ] **Step 4: Create the refresh action**

Create `app/Actions/Integrations/RefreshPokerTasks.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Actions\Poker\PokerGuard;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\Poker\PokerGameChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Trackers\TrackerIssue;
use App\Support\Integrations\Trackers\Trackers;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Spec 6 §6.4: title, description, assignee and source estimate follow the
 * source on demand; the skrum estimate never changes. Issues the source no
 * longer returns keep their data and are only counted.
 */
class RefreshPokerTasks
{
    public function __construct(private Trackers $trackers) {}

    /**
     * @return array{refreshed: int, missing: int}
     */
    public function handle(PokerGame $game, PokerPlayer $player): array
    {
        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $refreshed = 0;
        $missing = 0;
        $attempted = false;
        $problem = null;

        foreach ($game->tasks()->whereNotNull('external_source')->get()->groupBy('external_source') as $source => $tasks) {
            $provider = IntegrationProvider::tryFrom((string) $source);

            if ($provider === null || ! $provider->isTracker() || ! $provider->isEnabled()) {
                continue;
            }

            $integration = $game->team->integration($provider);

            if ($integration === null || ! $integration->isActive()) {
                $problem ??= $this->connectionProblem($provider, $integration?->status, $integration?->last_error);

                continue;
            }

            $onSite = $tasks->where('external_site', $integration->site());

            if ($onSite->isEmpty()) {
                continue;
            }

            $attempted = true;
            $issues = $this->trackers->for($provider)->issues($integration, $onSite->pluck('external_id')->filter()->values()->all());

            [$updated, $notFound] = $this->apply($game, $onSite, $issues);
            $refreshed += $updated;
            $missing += $notFound;
        }

        if (! $attempted && $problem !== null) {
            throw $problem;
        }

        if ($refreshed > 0) {
            (new PokerGameChanged($game->id))->sendToOthers();
        }

        return ['refreshed' => $refreshed, 'missing' => $missing];
    }

    /**
     * @param  Collection<int, PokerTask>  $tasks
     * @param  array<string, TrackerIssue>  $issues
     * @return array{0: int, 1: int}
     */
    private function apply(PokerGame $game, Collection $tasks, array $issues): array
    {
        return DB::transaction(function () use ($game, $tasks, $issues): array {
            PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            $updated = 0;
            $notFound = 0;

            foreach (PokerTask::query()->whereKey($tasks->pluck('id')->all())->get() as $task) {
                $issue = $issues[(string) $task->external_id] ?? null;

                if ($issue === null) {
                    $notFound++;

                    continue;
                }

                $task->forceFill([
                    'title' => $issue->title,
                    'description' => $issue->description,
                    'external_key' => $issue->key,
                    'external_url' => $issue->url,
                    'external_assignee' => $issue->assignee,
                    'external_estimate' => $issue->estimate,
                    'external_refreshed_at' => now(),
                ])->save();

                $updated++;
            }

            return [$updated, $notFound];
        });
    }

    private function connectionProblem(IntegrationProvider $provider, ?IntegrationStatus $status, ?string $error): IntegrationException
    {
        return $status === IntegrationStatus::ReconnectRequired
            ? new ReconnectRequired($provider, $error)
            : new NotConnected($provider);
    }
}
```

- [ ] **Step 5: Create the controllers and routes**

Create `app/Http/Controllers/Integrations/PokerImportsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\ImportPokerTasks;
use App\Actions\Integrations\ResolvePokerTracker;
use App\Actions\Poker\PokerGuard;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PokerImportsController extends Controller
{
    public function store(Request $request, PokerGame $game, string $source, ResolvePokerTracker $resolvePokerTracker, ImportPokerTasks $importPokerTasks): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $validated = $request->validate([
            'external_ids' => ['required', 'array', 'min:1', 'max:100'],
            'external_ids.*' => ['required', 'string', 'max:100', 'distinct'],
        ]);

        $integration = $resolvePokerTracker->handle($game->team, $source);

        return response()->json(
            $importPokerTasks->handle($game, $player, $integration, array_values($validated['external_ids'])),
            201,
        );
    }
}
```

Create `app/Http/Controllers/Integrations/PokerImportRefreshesController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\RefreshPokerTasks;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PokerImportRefreshesController extends Controller
{
    public function store(Request $request, PokerGame $game, RefreshPokerTasks $refreshPokerTasks): JsonResponse
    {
        return response()->json($refreshPokerTasks->handle($game, PokerPlayer::current($request)));
    }
}
```

In `routes/web.php`, import both controllers and add right after the three browse routes of Task 4 (the refresh route must come before `imports/{source}`):

```php
        Route::post('imports/refresh', [PokerImportRefreshesController::class, 'store'])->name('poker.imports.refresh.store');
        Route::post('imports/{source}', [PokerImportsController::class, 'store'])->name('poker.imports.store')->where('source', 'jira|linear');
```

Regenerate Wayfinder: `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 6: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `This game can hold 200 tasks at most.` | `Cette partie peut contenir 200 tâches au maximum.` | `Esta partida puede tener 200 tareas como máximo.` | `Dieses Spiel kann höchstens 200 Aufgaben enthalten.` |

- [ ] **Step 7: Run the test to verify it passes**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PokerImportTest.php`
Expected: PASS (8 tests).

- [ ] **Step 8: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Integrations app/Http/Controllers/Integrations routes/web.php tests/Feature/Integrations/PokerImportTest.php lang
git commit -m "feat: import and refresh poker tasks from Jira and Linear

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 6: Estimate write-back (`writeEstimate`, `SyncTaskEstimate`, `RequestEstimateSync`, retry endpoint)

**Files:**
- Create: `app/Actions/Integrations/RequestEstimateSync.php`, `app/Jobs/SyncTaskEstimate.php`, `app/Http/Controllers/Integrations/PokerTaskSyncsController.php`
- Modify: `app/Support/Integrations/Trackers/{JiraTracker,LinearTracker}.php` (`writeEstimate`), `app/Actions/Poker/SetPokerEstimate.php`, `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: `tests/Feature/Integrations/PokerEstimateSyncTest.php`

**Interfaces:**
- Consumes: Task 2 `IssueTracker::writeEstimate`, `EstimateRejected`, `JiraTracker::storyPointFieldIds()`; Task 3 `PokerTaskSync::{for, unsupportedReason, integration}`, `PresentPokerTask::handle()`; Plan 12a `IntegrationException` hierarchy (`RateLimited::$retryAfter`, `ProviderUnavailable`), `IntegrationErrors::sanitize()`; `PokerDeck::numericValue()`; `PokerTaskSaved`.
- Produces:
  - `JiraTracker::writeEstimate()`: `GET issue/{id}/editmeta`, first `storyPointFields` candidate on the edit screen, `PUT issue/{id}` `{"fields": {"<field>": number|null}}` (`½` → 0.5); `EstimateRejected` "This issue has no story points field on its edit screen." or the T-shirt message.
  - `LinearTracker::writeEstimate()`: team `issueEstimationType` / `issueEstimationAllowZero` first; `notUsed`, fractions, values outside 0–64 → `EstimateRejected`; `0` → `null` when zero is not allowed; `issueUpdate` rejection → "Linear rejected this estimate: {message}".
  - `RequestEstimateSync::afterEstimateChange(PokerGame $game, PokerTask $task): void` (imported and supported only: `needs_sync = true`, `sync_error = null`, job after commit) and `retry(PokerGame $game, PokerTask $task, PokerPlayer $player): void` (facilitator; 422 on `task`: "This task was not imported from a tracker.", "Set an estimate before syncing it.", or the unsupported reason; forces a write whether `needs_sync` is true or false).
  - `App\Jobs\SyncTaskEstimate` (`public string $taskId`, `ShouldQueue`, `ShouldBeUniqueUntilProcessing`, `uniqueId()` = task id, `$tries = 5`, `$backoff = [10, 30, 120, 600]`, `failed(?Throwable)`): writes the task's current estimate; success → `needs_sync = false`, `synced_at`, `sync_error = null` only while the estimate is still the written one; `RateLimited` → `release(retryAfter)`; `ProviderUnavailable` → rethrown (retries, then `failed()` records it); `EstimateRejected` and other integration errors → `sync_error` recorded, no retry; every outcome broadcasts `task.saved` (reduced `external`) to every player.
  - Route `poker.tasks.sync.store` (POST `tasks/{task}/sync`) → 202 with the task (full `external`).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Integrations/PokerEstimateSyncTest.php`:

```php
<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerTaskSaved;
use App\Jobs\SyncTaskEstimate;
use App\Models\PokerTask;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(fn () => Http::preventStrayRequests());

/**
 * @param  array<string, mixed>  $table
 */
function revealImportedTask(array $table, PokerTask $task, string ...$values): void
{
    $round = openPokerRound($table['game'], $task);
    $players = [$table['facilitatorPlayer'], $table['memberPlayer']];

    foreach ($values as $index => $value) {
        pokerVote($round, $players[$index], $value);
    }

    $round->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);
}

/**
 * @param  array<string, mixed>  $table
 */
function pendingSyncTask(array $table, ?string $estimate, IntegrationProvider $source = IntegrationProvider::Jira): PokerTask
{
    return importedPokerTask($table['game'], [
        'estimate' => $estimate,
        'estimate_numeric' => $estimate === null ? null : PokerDeck::numericValue($estimate),
        'estimated_at' => $estimate === null ? null : now(),
        'needs_sync' => true,
    ], $source);
}

function runEstimateSync(PokerTask $task): void
{
    app()->call([new SyncTaskEstimate($task->id), 'handle']);
}

it('is a unique, retried job', function () {
    $job = new SyncTaskEstimate('task-id');

    expect($job)->toBeInstanceOf(ShouldBeUniqueUntilProcessing::class)
        ->and($job->uniqueId())->toBe('task-id')
        ->and($job->tries)->toBe(5)
        ->and($job->backoff)->toBe([10, 30, 120, 600]);
});

it('queues a write-back when the facilitator sets the estimate of an imported task', function () {
    Queue::fake();
    $table = trackerTable();
    $task = importedPokerTask($table['game']);
    revealImportedTask($table, $task, '5');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $task]), ['value' => '5'])
        ->assertOk()
        ->assertJsonPath('external.syncState', 'pending');

    expect($task->fresh()?->needs_sync)->toBeTrue();
    Queue::assertPushed(SyncTaskEstimate::class, fn (SyncTaskEstimate $job) => $job->taskId === $task->id);
});

it('queues a write-back when the facilitator clears the estimate', function () {
    Queue::fake();
    $table = trackerTable();
    $task = importedPokerTask($table['game'], ['estimate' => '5', 'estimate_numeric' => 5, 'estimated_at' => now(), 'synced_at' => now()]);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $task]), ['value' => null])
        ->assertOk()
        ->assertJsonPath('external.syncState', 'pending');

    Queue::assertPushed(SyncTaskEstimate::class, 1);
});

it('coalesces quick estimate changes into one queued write', function () {
    Queue::fake();
    $table = trackerTable();
    $task = importedPokerTask($table['game']);
    revealImportedTask($table, $task, '5', '8');
    $url = route('poker.tasks.estimate.update', [$table['game'], $task]);

    $this->actingAs($table['facilitator'])->putJson($url, ['value' => '5'])->assertOk();
    $this->actingAs($table['facilitator'])->putJson($url, ['value' => '8'])->assertOk();

    Queue::assertPushed(SyncTaskEstimate::class, 1);
});

it('queues nothing for tasks it cannot write back', function () {
    Queue::fake();
    $table = trackerTable(deck: PokerDeck::Tshirt);
    $imported = importedPokerTask($table['game']);
    $local = PokerTask::factory()->create(['poker_game_id' => $table['game']->id]);
    revealImportedTask($table, $imported, 'M');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $imported]), ['value' => 'M'])
        ->assertOk()
        ->assertJsonPath('external.syncState', 'unsupported')
        ->assertJsonPath('external.unsupportedReason', "T-shirt estimates can't be written to Jira.");

    revealImportedTask($table, $local, 'L');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $local]), ['value' => 'L'])
        ->assertOk();

    Queue::assertNothingPushed();
    expect($imported->fresh()?->needs_sync)->toBeFalse();
});

it('writes the estimate to the first story points field on the Jira edit screen', function () {
    Event::fake([PokerTaskSaved::class]);
    $table = trackerTable();
    $table['integration']->forceFill(['settings' => [...$table['integration']->settings, 'storyPointFields' => [
        ['id' => 'customfield_10026', 'name' => 'Story Points'],
        ['id' => 'customfield_10016', 'name' => 'Story point estimate'],
    ]]])->save();
    $task = pendingSyncTask($table, '5');
    fakeJiraTrackerApi();

    runEstimateSync($task);

    $task->refresh();

    expect($task->needs_sync)->toBeFalse()
        ->and($task->synced_at)->not->toBeNull()
        ->and($task->sync_error)->toBeNull();

    Http::assertSent(fn (Request $request) => $request->method() === 'PUT'
        && str_ends_with($request->url(), "/rest/api/3/issue/{$task->external_id}")
        && $request->data() == ['fields' => ['customfield_10016' => 5.0]]);
    Event::assertDispatched(PokerTaskSaved::class, fn (PokerTaskSaved $event) => $event->task['id'] === $task->id
        && $event->task['external'] === ['source' => 'jira', 'key' => $task->external_key, 'url' => $task->external_url, 'isManaged' => true]);
});

it('writes half points and cleared estimates to Jira', function (?string $estimate, ?float $sent) {
    $table = trackerTable(deck: PokerDeck::ModifiedFibonacci);
    $task = pendingSyncTask($table, $estimate);
    fakeJiraTrackerApi();

    runEstimateSync($task);

    expect($task->fresh()?->needs_sync)->toBeFalse();
    Http::assertSent(fn (Request $request) => $request->method() === 'PUT'
        && array_key_exists('customfield_10016', (array) data_get($request->data(), 'fields'))
        && data_get($request->data(), 'fields.customfield_10016') === $sent);
})->with([
    'half a point' => ['½', 0.5],
    'a cleared estimate' => [null, null],
]);

it('fails when no story points field is on the Jira edit screen', function () {
    $table = trackerTable();
    $task = pendingSyncTask($table, '5');
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*/editmeta' => Http::response(['fields' => ['summary' => []]])]);

    runEstimateSync($task);

    $task->refresh();

    expect($task->sync_error)->toBe('This issue has no story points field on its edit screen.')
        ->and($task->needs_sync)->toBeTrue()
        ->and($task->synced_at)->toBeNull();
    Http::assertNotSent(fn (Request $request) => $request->method() === 'PUT');
});

it('records the Jira error when the write is refused', function () {
    $table = trackerTable();
    $task = pendingSyncTask($table, '5');
    Http::fake([
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*/editmeta' => Http::response(['fields' => ['customfield_10016' => []]]),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*' => Http::response(['errorMessages' => ['Field cannot be set.']], 400),
    ]);

    runEstimateSync($task);

    expect($task->fresh()?->sync_error)->toBe('Field cannot be set.');
});

it('writes Linear estimates within its scale', function (PokerDeck $deck, string $estimate, bool $allowsZero, ?int $sent) {
    $table = trackerTable(IntegrationProvider::Linear, deck: $deck);
    $task = pendingSyncTask($table, $estimate, IntegrationProvider::Linear);
    fakeLinearGraphql([
        'issueEstimationType' => ['issue' => ['team' => ['issueEstimationType' => 'fibonacci', 'issueEstimationAllowZero' => $allowsZero]]],
        'issueUpdate(' => ['issueUpdate' => ['success' => true]],
    ]);

    runEstimateSync($task);

    expect($task->fresh()?->needs_sync)->toBeFalse();
    Http::assertSent(fn (Request $request) => str_contains((string) $request['query'], 'issueUpdate(')
        && data_get($request->data(), 'variables.id') === $task->external_id
        && data_get($request->data(), 'variables.estimate') === $sent);
})->with([
    'a whole number' => [PokerDeck::Fibonacci, '3', false, 3],
    'zero when the team allows it' => [PokerDeck::Fibonacci, '0', true, 0],
    'zero cleared when the team does not' => [PokerDeck::Fibonacci, '0', false, null],
]);

it('refuses estimates Linear cannot hold', function (PokerDeck $deck, string $estimate, string $type, string $error) {
    $table = trackerTable(IntegrationProvider::Linear, deck: $deck);
    $task = pendingSyncTask($table, $estimate, IntegrationProvider::Linear);
    fakeLinearGraphql(['issueEstimationType' => ['issue' => ['team' => ['issueEstimationType' => $type, 'issueEstimationAllowZero' => true]]]]);

    runEstimateSync($task);

    expect($task->fresh()?->sync_error)->toBe($error)
        ->and($task->fresh()?->needs_sync)->toBeTrue();
    Http::assertNotSent(fn (Request $request) => str_contains((string) $request['query'], 'issueUpdate('));
})->with([
    'estimates turned off' => [PokerDeck::Fibonacci, '3', 'notUsed', 'Estimates are turned off for this Linear team.'],
    'a half point' => [PokerDeck::ModifiedFibonacci, '½', 'fibonacci', 'Linear only accepts whole-number estimates.'],
    'more than 64' => [PokerDeck::Fibonacci, '89', 'exponential', 'Linear accepts estimates from 0 to 64.'],
]);

it('shows the reason Linear rejects an estimate', function () {
    $table = trackerTable(IntegrationProvider::Linear);
    $task = pendingSyncTask($table, '21', IntegrationProvider::Linear);
    Http::fake(['api.linear.app/graphql' => function (Request $request) {
        if (str_contains((string) $request['query'], 'issueEstimationType')) {
            return Http::response(['data' => ['issue' => ['team' => ['issueEstimationType' => 'fibonacci', 'issueEstimationAllowZero' => false]]]]);
        }

        return Http::response(['errors' => [['message' => 'Estimate is not valid for this team', 'extensions' => ['code' => 'INVALID_INPUT']]]], 400);
    }]);

    runEstimateSync($task);

    expect($task->fresh()?->sync_error)->toBe('Linear rejected this estimate: Estimate is not valid for this team');
});

it('waits for the rate limit before retrying', function () {
    $table = trackerTable();
    $task = pendingSyncTask($table, '5');
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*/editmeta' => Http::response([], 429, ['Retry-After' => '42'])]);

    $job = (new SyncTaskEstimate($task->id))->withFakeQueueInteractions();
    app()->call([$job, 'handle']);

    $job->assertReleased(42);
    expect($task->fresh()?->sync_error)->toBeNull();
});

it('retries while the source is unavailable and records the final failure', function () {
    $table = trackerTable();
    $task = pendingSyncTask($table, '5');
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/*' => Http::response([], 503)]);
    $job = new SyncTaskEstimate($task->id);

    expect(fn () => app()->call([$job, 'handle']))->toThrow(ProviderUnavailable::class)
        ->and($task->fresh()?->sync_error)->toBeNull();

    $job->failed(new ProviderUnavailable(IntegrationProvider::Jira));

    expect($task->fresh()?->sync_error)->toBe('Jira did not respond. Try again later.')
        ->and($task->fresh()?->needs_sync)->toBeTrue();
});

it('records the reason instead of calling a provider that no longer covers the task', function () {
    $table = trackerTable();
    $task = pendingSyncTask($table, '5');
    $table['integration']->forceFill(['access' => IntegrationAccess::Read])->save();

    runEstimateSync($task);

    expect($task->fresh()?->sync_error)->toBe('This Jira connection is read-only.');
    Http::assertNothingSent();
});

it('does nothing for a deleted task or one already written', function () {
    $table = trackerTable();
    $written = importedPokerTask($table['game'], ['estimate' => '5', 'needs_sync' => false]);

    app()->call([new SyncTaskEstimate((string) Str::uuid()), 'handle']);
    runEstimateSync($written);

    Http::assertNothingSent();
});

it('keeps needs_sync when the estimate changed during the write', function () {
    $table = trackerTable();
    $task = pendingSyncTask($table, '5');
    Http::fake([
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*/editmeta' => Http::response(['fields' => ['customfield_10016' => []]]),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/*' => function () use ($task) {
            PokerTask::query()->whereKey($task->id)->update(['estimate' => '8', 'estimate_numeric' => 8]);

            return Http::response(null, 204);
        },
    ]);

    runEstimateSync($task);

    expect($task->fresh()?->needs_sync)->toBeTrue()
        ->and($task->fresh()?->synced_at)->toBeNull();
});

it('lets only the facilitator force a write-back', function () {
    Queue::fake();
    $table = trackerTable();
    $task = importedPokerTask($table['game'], ['estimate' => '5', 'estimate_numeric' => 5, 'synced_at' => now()]);
    $url = route('poker.tasks.sync.store', [$table['game'], $task]);

    $this->actingAs($table['member'])->postJson($url)->assertForbidden();

    $this->actingAs($table['facilitator'])->postJson($url)
        ->assertAccepted()
        ->assertJsonPath('external.syncState', 'pending');

    expect($task->fresh()?->needs_sync)->toBeTrue();
    Queue::assertPushed(SyncTaskEstimate::class, fn (SyncTaskEstimate $job) => $job->taskId === $task->id);
});

it('retries a failed write-back', function () {
    Queue::fake();
    $table = trackerTable();
    $task = importedPokerTask($table['game'], ['estimate' => '5', 'estimate_numeric' => 5, 'needs_sync' => true, 'sync_error' => 'Boom']);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.sync.store', [$table['game'], $task]))
        ->assertAccepted();

    expect($task->fresh()?->sync_error)->toBeNull();
    Queue::assertPushed(SyncTaskEstimate::class, 1);
});

it('refuses to sync tasks without an estimate, unsupported or not imported', function (Closure $arrange, string $message) {
    Queue::fake();
    $table = trackerTable();
    $task = $arrange($table);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.sync.store', [$table['game'], $task]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['task' => $message]);

    Queue::assertNothingPushed();
})->with([
    'no estimate' => [fn (array $table) => importedPokerTask($table['game']), 'Set an estimate before syncing it.'],
    'another site' => [fn (array $table) => importedPokerTask($table['game'], ['estimate' => '5', 'external_site' => 'cloud-9']), 'This task comes from another Jira site.'],
    'not imported' => [fn (array $table) => PokerTask::factory()->estimated('5')->create(['poker_game_id' => $table['game']->id]), 'This task was not imported from a tracker.'],
]);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PokerEstimateSyncTest.php`
Expected: FAIL with `Class "App\Jobs\SyncTaskEstimate" not found`.

- [ ] **Step 3: Write estimates to Jira and Linear**

In `app/Support/Integrations/Trackers/JiraTracker.php`, replace `use LogicException;` with `use App\Enums\PokerDeck;` and replace the `writeEstimate()` method with:

```php
    public function writeEstimate(TeamIntegration $integration, string $externalId, ?string $estimate): void
    {
        $value = $estimate === null ? null : PokerDeck::numericValue($estimate);

        if ($estimate !== null && $value === null) {
            throw new EstimateRejected(__("T-shirt estimates can't be written to :source.", ['source' => 'Jira']));
        }

        $issuePath = 'rest/api/3/issue/'.rawurlencode($externalId);
        $editable = (array) ($this->client->get($integration, "{$issuePath}/editmeta")['fields'] ?? []);
        $fieldId = collect(self::storyPointFieldIds($integration))
            ->first(fn (string $id): bool => array_key_exists($id, $editable));

        if ($fieldId === null) {
            throw new EstimateRejected(__('This issue has no story points field on its edit screen.'));
        }

        $this->client->put($integration, $issuePath, ['fields' => [$fieldId => $value]]);
    }
```

In `app/Support/Integrations/Trackers/LinearTracker.php`, replace `use LogicException;` with `use App\Enums\PokerDeck;` and `use App\Support\Integrations\Exceptions\ProviderRejected;`, add the constant `private const MaxEstimate = 64;` next to `MaxTeams`, and replace the `writeEstimate()` method with:

```php
    public function writeEstimate(TeamIntegration $integration, string $externalId, ?string $estimate): void
    {
        $data = $this->client->query(
            $integration,
            'query($id: String!) { issue(id: $id) { team { issueEstimationType issueEstimationAllowZero } } }',
            ['id' => $externalId],
        );
        $team = data_get($data, 'issue.team');

        if (! is_array($team)) {
            throw new EstimateRejected(__('This issue was not found in :source.', ['source' => 'Linear']));
        }

        if (($team['issueEstimationType'] ?? 'notUsed') === 'notUsed') {
            throw new EstimateRejected(__('Estimates are turned off for this Linear team.'));
        }

        $value = $this->linearEstimate($estimate, ($team['issueEstimationAllowZero'] ?? false) === true);

        try {
            $result = $this->client->query(
                $integration,
                'mutation($id: String!, $estimate: Int) { issueUpdate(id: $id, input: {estimate: $estimate}) { success } }',
                ['id' => $externalId, 'estimate' => $value],
            );
        } catch (ProviderRejected $exception) {
            throw new EstimateRejected(__('Linear rejected this estimate: :message', ['message' => $exception->userMessage()]));
        }

        if (data_get($result, 'issueUpdate.success') !== true) {
            throw new EstimateRejected(__('Linear rejected this estimate: :message', ['message' => 'issueUpdate']));
        }
    }

    private function linearEstimate(?string $estimate, bool $allowsZero): ?int
    {
        if ($estimate === null) {
            return null;
        }

        $number = PokerDeck::numericValue($estimate);

        if ($number === null) {
            throw new EstimateRejected(__("T-shirt estimates can't be written to :source.", ['source' => 'Linear']));
        }

        if (floor($number) !== $number) {
            throw new EstimateRejected(__('Linear only accepts whole-number estimates.'));
        }

        if ($number < 0 || $number > self::MaxEstimate) {
            throw new EstimateRejected(__('Linear accepts estimates from 0 to 64.'));
        }

        if ($number === 0.0 && ! $allowsZero) {
            return null;
        }

        return (int) $number;
    }
```

- [ ] **Step 4: Create the job**

Create `app/Jobs/SyncTaskEstimate.php`:

```php
<?php

namespace App\Jobs;

use App\Actions\Integrations\PokerTaskSync;
use App\Actions\Poker\PresentPokerTask;
use App\Events\Poker\PokerTaskSaved;
use App\Models\PokerTask;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\IntegrationErrors;
use App\Support\Integrations\Trackers\EstimateRejected;
use App\Support\Integrations\Trackers\Trackers;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Writes the current skrum estimate of an imported task to its source
 * (spec 6 §6.5). Unique until it starts, so quick changes coalesce, while a
 * change made during a write still queues the next one.
 */
class SyncTaskEstimate implements ShouldBeUniqueUntilProcessing, ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    /** @var array<int, int> */
    public array $backoff = [10, 30, 120, 600];

    public function __construct(public string $taskId) {}

    public function uniqueId(): string
    {
        return $this->taskId;
    }

    public function handle(Trackers $trackers): void
    {
        $task = PokerTask::query()->with('game.team.integrations')->find($this->taskId);

        if ($task === null || ! $task->needs_sync || $task->external_source === null || $task->external_id === null) {
            return;
        }

        $sync = PokerTaskSync::for($task->game);
        $reason = $sync->unsupportedReason($task);
        $integration = $sync->integration($task->external_source);

        if ($reason !== null || $integration === null) {
            $this->recordFailure($task, $reason ?? __('This task can no longer be synced.'));

            return;
        }

        $estimate = $task->estimate;

        try {
            $trackers->for($integration->provider)->writeEstimate($integration, $task->external_id, $estimate);
        } catch (RateLimited $exception) {
            $this->release($exception->retryAfter);

            return;
        } catch (EstimateRejected $exception) {
            $this->recordFailure($task, $exception->getMessage());

            return;
        } catch (ProviderUnavailable $exception) {
            throw $exception;
        } catch (IntegrationException $exception) {
            $this->recordFailure($task, $exception->userMessage());

            return;
        }

        $this->markSynced($task, $estimate);
    }

    public function failed(?Throwable $exception): void
    {
        $task = PokerTask::query()->find($this->taskId);

        if ($task === null) {
            return;
        }

        $this->recordFailure($task, $exception instanceof IntegrationException
            ? $exception->userMessage()
            : __('The estimate could not be written. Try again.'));
    }

    private function markSynced(PokerTask $task, ?string $written): void
    {
        $updated = PokerTask::query()
            ->whereKey($task->id)
            ->when(
                $written === null,
                fn ($query) => $query->whereNull('estimate'),
                fn ($query) => $query->where('estimate', $written),
            )
            ->update(['needs_sync' => false, 'sync_error' => null, 'synced_at' => now()]);

        if ($updated === 0) {
            return;
        }

        $this->broadcast($task->fresh() ?? $task);
    }

    private function recordFailure(PokerTask $task, string $error): void
    {
        $task->forceFill(['needs_sync' => true, 'sync_error' => IntegrationErrors::sanitize($error)])->save();

        $this->broadcast($task);
    }

    private function broadcast(PokerTask $task): void
    {
        $task->loadCount('rounds');

        $payload = app(PresentPokerTask::class)->handle($task);

        rescue(fn () => broadcast(new PokerTaskSaved($task->poker_game_id, $payload)));
    }
}
```

- [ ] **Step 5: Request write-backs**

Create `app/Actions/Integrations/RequestEstimateSync.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Actions\Poker\PokerGuard;
use App\Jobs\SyncTaskEstimate;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Validation\ValidationException;

class RequestEstimateSync
{
    /**
     * Spec 6 §6.5: every saved or cleared estimate of an imported task is
     * written back when the connection allows it; otherwise the task shows
     * why it is not synced and nothing is queued.
     */
    public function afterEstimateChange(PokerGame $game, PokerTask $task): void
    {
        if ($task->external_source === null) {
            return;
        }

        if (PokerTaskSync::for($game)->unsupportedReason($task) !== null) {
            return;
        }

        $this->queue($task);
    }

    /**
     * The facilitator's retry, which also forces a rewrite of an estimate
     * already synced (spec 6 §6.5, MCP `poker.game.task.sync`).
     */
    public function retry(PokerGame $game, PokerTask $task, PokerPlayer $player): void
    {
        PokerGuard::facilitator($game, $player);

        if ($task->external_source === null) {
            throw ValidationException::withMessages(['task' => __('This task was not imported from a tracker.')]);
        }

        if ($task->estimate === null) {
            throw ValidationException::withMessages(['task' => __('Set an estimate before syncing it.')]);
        }

        $reason = PokerTaskSync::for($game)->unsupportedReason($task);

        if ($reason !== null) {
            throw ValidationException::withMessages(['task' => $reason]);
        }

        $this->queue($task);
    }

    private function queue(PokerTask $task): void
    {
        $task->forceFill(['needs_sync' => true, 'sync_error' => null])->save();

        SyncTaskEstimate::dispatch($task->id)->afterCommit();
    }
}
```

Replace `app/Actions/Poker/SetPokerEstimate.php` with:

```php
<?php

namespace App\Actions\Poker;

use App\Actions\Integrations\RequestEstimateSync;
use App\Enums\PokerDeck;
use App\Events\Poker\PokerTaskEstimated;
use App\Events\Poker\PokerTaskSaved;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;
use Illuminate\Validation\ValidationException;

class SetPokerEstimate
{
    public function __construct(
        private PresentPokerTask $presentPokerTask,
        private RequestEstimateSync $requestEstimateSync,
    ) {}

    public function handle(PokerGame $locked, PokerTask $task, ?string $value): PokerTask
    {
        $previous = $task->estimate;

        if ($value === null) {
            $task->update([
                'estimate' => null,
                'estimate_numeric' => null,
                'estimated_at' => null,
            ]);
        }

        if ($value !== null) {
            $this->ensureEstimable($locked, $task, $value);

            if ($value !== $previous) {
                $task->update([
                    'estimate' => $value,
                    'estimate_numeric' => PokerDeck::numericValue($value),
                    'estimated_at' => now(),
                ]);
            }
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

    private function ensureEstimable(PokerGame $locked, PokerTask $task, string $value): void
    {
        if (! in_array($value, $locked->cards, true) || PokerDeck::isSpecial($value)) {
            throw ValidationException::withMessages(['value' => __('Choose a card from the deck.')]);
        }

        $latestRound = $task->latestRound()->with('votes')->first();

        if ($latestRound === null || ! $latestRound->isRevealed() || ! $this->hasCountableVote($latestRound)) {
            throw ValidationException::withMessages(['value' => __('Reveal the votes before setting an estimate.')]);
        }
    }

    private function hasCountableVote(PokerRound $round): bool
    {
        return $round->votes->contains(fn (PokerVote $vote): bool => ! PokerDeck::isSpecial($vote->value));
    }
}
```

- [ ] **Step 6: Create the retry endpoint**

Create `app/Http/Controllers/Integrations/PokerTaskSyncsController.php`:

```php
<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\PokerTaskSync;
use App\Actions\Integrations\RequestEstimateSync;
use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PresentPokerTask;
use App\Events\Poker\PokerTaskSaved;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PokerTaskSyncsController extends Controller
{
    public function store(Request $request, PokerGame $game, PokerTask $task, RequestEstimateSync $requestEstimateSync, PresentPokerTask $presentPokerTask): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::facilitator($game, $player);

        $synced = DB::transaction(function () use ($game, $task, $player, $requestEstimateSync, $presentPokerTask): PokerTask {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $lockedTask = PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($task->id)->firstOrFail();

            $requestEstimateSync->retry($locked, $lockedTask, $player);

            $lockedTask->loadCount('rounds');

            (new PokerTaskSaved($locked->id, $presentPokerTask->handle($lockedTask)))->sendToOthers();

            return $lockedTask;
        });

        return response()->json($presentPokerTask->handle($synced, PokerTaskSync::for($game)), 202);
    }
}
```

In `routes/web.php`, import the controller and add inside the `poker/{game}` group, after `tasks/{task}/estimate`:

```php
        Route::post('tasks/{task}/sync', [PokerTaskSyncsController::class, 'store'])->name('poker.tasks.sync.store')->whereUuid('task');
```

Regenerate Wayfinder: `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 7: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `This issue has no story points field on its edit screen.` | `Ce ticket n’a pas de champ de story points sur son écran de modification.` | `Esta incidencia no tiene campo de story points en su pantalla de edición.` | `Dieses Ticket hat kein Story-Points-Feld in seiner Bearbeitungsmaske.` |
| `Estimates are turned off for this Linear team.` | `Les estimations sont désactivées pour cette équipe Linear.` | `Las estimaciones están desactivadas para este equipo de Linear.` | `Schätzungen sind für dieses Linear-Team deaktiviert.` |
| `Linear only accepts whole-number estimates.` | `Linear n’accepte que des estimations entières.` | `Linear solo acepta estimaciones con números enteros.` | `Linear akzeptiert nur ganzzahlige Schätzungen.` |
| `Linear accepts estimates from 0 to 64.` | `Linear accepte les estimations de 0 à 64.` | `Linear acepta estimaciones de 0 a 64.` | `Linear akzeptiert Schätzungen von 0 bis 64.` |
| `Linear rejected this estimate: :message` | `Linear a refusé cette estimation : :message` | `Linear rechazó esta estimación: :message` | `Linear hat diese Schätzung abgelehnt: :message` |
| `This issue was not found in :source.` | `Ce ticket est introuvable dans :source.` | `No se encontró esta incidencia en :source.` | `Dieses Ticket wurde in :source nicht gefunden.` |
| `This task was not imported from a tracker.` | `Cette tâche n’a pas été importée depuis un outil de suivi.` | `Esta tarea no se importó desde un gestor de incidencias.` | `Diese Aufgabe wurde nicht aus einem Tracker importiert.` |
| `Set an estimate before syncing it.` | `Définissez une estimation avant de la synchroniser.` | `Define una estimación antes de sincronizarla.` | `Lege eine Schätzung fest, bevor du sie synchronisierst.` |
| `The estimate could not be written. Try again.` | `L’estimation n’a pas pu être écrite. Réessayez.` | `No se pudo escribir la estimación. Inténtalo de nuevo.` | `Die Schätzung konnte nicht geschrieben werden. Versuch es erneut.` |

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/PokerEstimateSyncTest.php tests/Feature/Integrations/PokerTaskExternalTest.php tests/Feature/Poker/PokerEstimateTest.php tests/Feature/Mcp/PokerWriteToolsTest.php`
Expected: PASS (the MCP reveal tool and the estimate endpoint go through the new `SetPokerEstimate`; non-imported tasks never queue anything).

- [ ] **Step 9: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Integrations/Trackers app/Jobs/SyncTaskEstimate.php app/Actions/Integrations/RequestEstimateSync.php app/Actions/Poker/SetPokerEstimate.php app/Http/Controllers/Integrations/PokerTaskSyncsController.php routes/web.php tests/Feature/Integrations/PokerEstimateSyncTest.php lang
git commit -m "feat: write poker estimates back to Jira and Linear

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 7: MCP tracker tools (`Trackers` feature, `ListPokerSources`, four tools, catalogue of 29)

**Files:**
- Create: `app/Mcp/McpTrackers.php`, `app/Mcp/Concerns/ResolvesTracker.php`, `app/Actions/Integrations/ListPokerSources.php`, `app/Mcp/Tools/Poker/{ListSources,ListIterations,ImportTasks,SyncTask}.php`
- Modify: `app/Mcp/McpFeature.php`, `app/Providers/AppServiceProvider.php`, `app/Mcp/Tools/SkrumTool.php`, `app/Mcp/Servers/SkrumServer.php`, `app/Mcp/Presenters/McpPokerGame.php`, `tests/Pest.php` (`mcpContractToolNames`, `mcpSweepWorld`), `tests/Feature/Mcp/{CatalogueTest,ToolBaseTest,McpSweepTest,PokerReadToolsTest}.php`, `lang/{en,fr,es,de}.json`
- Test: `tests/Feature/Mcp/TrackerToolsTest.php`

**Interfaces:**
- Consumes: Task 4 `ResolvePokerTracker::{handle, teamHasTracker}`, `ListPokerIterations::handle()`, `PreviewPokerImport` modes, `TrackerBrowseLimit::hit()`; Task 5 `ImportPokerTasks::fromSource()`; Task 6 `RequestEstimateSync::retry()`; Task 3 `PokerTaskSync`, `PresentPokerTask`; spec 5 `McpContext`, `VisibleTeams`, `McpGrant`, `SkrumTool`.
- Produces:
  - `App\Mcp\McpTrackers` (scoped): `available(): bool` — a tracker provider is enabled and a team visible to the bound grant has an `Active` integration of one; memoized per token. `McpFeature::Trackers->isAvailable()` delegates to it.
  - `ListPokerSources::handle(Team): array<int, array{source: string, siteName: ?string, status: string, access: string, canImport: bool, canWriteBack: bool, writeBackUnavailableReason: ?string}>` (enabled tracker providers only, in provider order; chat channels never listed).
  - Tools `poker.sources.list` (read, `{items}`), `poker.iterations.list` (read, `{containers, iterations}`), `poker.game.tasks.import` (write, `{imported, skipped, truncated}`), `poker.game.task.sync` (write, `{syncState: "pending"}`), all `#[IsOpenWorld]` and gated by `McpFeature::Trackers`; a team without an `Active` tracker → tool error "This team has no connected tracker.".
  - `SkrumTool` maps `IntegrationException` to a tool error: `userMessage()`, followed by ` ({detail})` when the sanitized detail adds something.
  - `poker.game.tasks.list` items carry `external: null | {source, key, url, syncState, syncError}`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Mcp/TrackerToolsTest.php`:

```php
<?php

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\McpScope;
use App\Jobs\SyncTaskEstimate;
use App\Mcp\Tools\Poker\ImportTasks;
use App\Mcp\Tools\Poker\ListIterations;
use App\Mcp\Tools\Poker\ListSources;
use App\Mcp\Tools\Poker\SyncTask;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Http::preventStrayRequests());

/**
 * @return array{0: Team, 1: User}
 */
function trackerMcpTeam(): array
{
    enableIntegrations(IntegrationProvider::Jira);
    $team = Team::factory()->create();
    $user = teamMember($team);
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);

    return [$team, $user];
}

it('offers the tracker tools only when a visible team has an active tracker', function () {
    $trackerTools = ['poker.game.task.sync', 'poker.game.tasks.import', 'poker.iterations.list', 'poker.sources.list'];
    $team = Team::factory()->create();
    $user = teamMember($team);
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    $listed = fn (array $scopes = [McpScope::Read, McpScope::Write]) => array_values(array_intersect(mcpToolNames(actingAsMcp($user, $scopes)), $trackerTools));

    expect($listed())->toBe([]);

    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Slack);

    expect($listed())->toBe($trackerTools)
        ->and($listed([McpScope::Read]))->toBe(['poker.iterations.list', 'poker.sources.list']);

    $integration->forceFill(['status' => IntegrationStatus::ReconnectRequired])->save();
    TeamIntegration::factory()->jira()->create();
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);

    expect($listed())->toBe([]);

    actingAsMcp($user)->tool(ListSources::class, ['team_id' => $team->id])->assertHasErrors(['Tool [poker.sources.list] not found.']);
});

it('lists the team trackers with their capabilities and nothing secret', function () {
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear, IntegrationProvider::Slack);
    $team = Team::factory()->create();
    $user = teamMember($team);
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->linear(IntegrationAccess::Read)->create(['team_id' => $team->id]);
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);

    $response = actingAsMcp($user)->tool(ListSources::class, ['team_id' => $team->id])->assertOk();

    expect(mcpStructured($response)['items'])->toBe([
        ['source' => 'jira', 'siteName' => 'Acme', 'status' => 'active', 'access' => 'write', 'canImport' => true, 'canWriteBack' => true, 'writeBackUnavailableReason' => null],
        ['source' => 'linear', 'siteName' => 'Acme', 'status' => 'active', 'access' => 'read', 'canImport' => true, 'canWriteBack' => false, 'writeBackUnavailableReason' => 'This Linear connection is read-only.'],
    ]);
    $response->assertDontSee(['jira-access', 'jira-refresh', 'linear-access', 'hooks.slack.com']);
});

it('explains why estimates cannot be written back', function () {
    [$team, $user] = trackerMcpTeam();
    $team->integrations()->sole()->forceFill(['settings' => ['cloudId' => 'cloud-1', 'siteName' => 'Acme', 'storyPointFields' => []]])->save();

    $items = mcpStructured(actingAsMcp($user)->tool(ListSources::class, ['team_id' => $team->id])->assertOk())['items'];

    expect($items[0])->toMatchArray(['canImport' => true, 'canWriteBack' => false, 'writeBackUnavailableReason' => 'No story points field found.']);
});

it('answers an empty list or an error for a team without a connected tracker', function () {
    [$team, $user] = trackerMcpTeam();
    $other = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $other->members()->attach($user);

    expect(mcpStructured(actingAsMcp($user)->tool(ListSources::class, ['team_id' => $other->id])->assertOk())['items'])->toBe([]);

    actingAsMcp($user)->tool(ListIterations::class, ['team_id' => $other->id, 'source' => 'jira'])
        ->assertHasErrors(['This team has no connected tracker.']);

    Http::assertNothingSent();
});

it('lists containers, then the iterations of one', function () {
    [$team, $user] = trackerMcpTeam();
    fakeJiraTrackerApi();

    expect(mcpStructured(actingAsMcp($user)->tool(ListIterations::class, ['team_id' => $team->id, 'source' => 'jira'])->assertOk()))
        ->toBe(['containers' => [['id' => '7', 'name' => 'Sweep scrum board']], 'iterations' => []]);

    expect(mcpStructured(actingAsMcp($user)->tool(ListIterations::class, ['team_id' => $team->id, 'source' => 'jira', 'container_id' => '7'])->assertOk()))
        ->toBe(['containers' => null, 'iterations' => [['id' => '31', 'name' => 'Sprint 31', 'state' => 'active', 'startsOn' => null, 'endsOn' => null]]]);
});

it('turns tracker failures into tool errors', function () {
    [$team, $user] = trackerMcpTeam();
    Http::fake(['api.atlassian.com/*' => Http::response([], 503)]);

    actingAsMcp($user)->tool(ListIterations::class, ['team_id' => $team->id, 'source' => 'jira'])
        ->assertHasErrors(['Jira did not respond. Try again later.']);
});

it('imports a whole sprint or query, skipping existing issues', function () {
    [$team, $user] = trackerMcpTeam();
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    importedPokerTask($game, ['external_id' => '10001', 'external_key' => 'PROJ-1']);
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::response([
        'issues' => [jiraTrackerIssue('10001', 'PROJ-1'), jiraTrackerIssue('10002', 'PROJ-2')],
        'nextPageToken' => 'more',
    ])]);

    expect(mcpStructured(mcpWriter($user)->tool(ImportTasks::class, ['game_id' => $game->id, 'source' => 'jira', 'iteration_id' => '31'])->assertOk()))
        ->toBe(['imported' => 1, 'skipped' => 1, 'truncated' => true])
        ->and($game->tasks()->where('external_key', 'PROJ-2')->exists())->toBeTrue();

    Http::assertSent(fn (Request $request) => $request['jql'] === 'sprint = 31 ORDER BY Rank ASC');

    mcpWriter($user)->tool(ImportTasks::class, ['game_id' => $game->id, 'source' => 'jira'])->assertHasErrors();
    mcpWriter($user)->tool(ImportTasks::class, ['game_id' => $game->id, 'source' => 'jira', 'iteration_id' => '31', 'query' => 'project = PROJ'])->assertHasErrors();
});

it('keeps the 200-task limit and surfaces JQL errors when importing', function () {
    [$team, $user] = trackerMcpTeam();
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    PokerTask::factory()->count(199)->create(['poker_game_id' => $game->id]);
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql' => Http::sequence()
        ->push(['issues' => [jiraTrackerIssue('10001', 'PROJ-1'), jiraTrackerIssue('10002', 'PROJ-2')]])
        ->push(['errorMessages' => ['The JQL query is invalid.']], 400)]);

    mcpWriter($user)->tool(ImportTasks::class, ['game_id' => $game->id, 'source' => 'jira', 'query' => 'project = PROJ'])
        ->assertHasErrors(['This game can hold 200 tasks at most.']);
    mcpWriter($user)->tool(ImportTasks::class, ['game_id' => $game->id, 'source' => 'jira', 'query' => 'project ='])
        ->assertHasErrors(['The JQL query is invalid.']);

    expect($game->tasks()->count())->toBe(199);
});

it('forces or retries a write-back for the facilitator only', function () {
    Queue::fake();
    [$team, $user] = trackerMcpTeam();
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    $player = PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $user->id]);
    $game->forceFill(['facilitator_player_id' => $player->id])->save();
    $synced = importedPokerTask($game, ['estimate' => '5', 'estimate_numeric' => 5, 'synced_at' => now()]);
    $failed = importedPokerTask($game, ['estimate' => '3', 'estimate_numeric' => 3, 'needs_sync' => true, 'sync_error' => 'Boom']);
    $bare = importedPokerTask($game);

    expect(mcpStructured(mcpWriter($user)->tool(SyncTask::class, ['task_id' => $synced->id])->assertOk()))->toBe(['syncState' => 'pending'])
        ->and(mcpStructured(mcpWriter($user)->tool(SyncTask::class, ['task_id' => $failed->id])->assertOk()))->toBe(['syncState' => 'pending'])
        ->and($synced->fresh()?->needs_sync)->toBeTrue()
        ->and($failed->fresh()?->sync_error)->toBeNull();

    mcpWriter($user)->tool(SyncTask::class, ['task_id' => $bare->id])->assertHasErrors(['Set an estimate before syncing it.']);
    mcpWriter(teamMember($team))->tool(SyncTask::class, ['task_id' => $synced->id])->assertHasErrors(['Only the facilitator can do this.']);
    mcpWriter(User::factory()->create())->tool(SyncTask::class, ['task_id' => $synced->id])->assertHasErrors();

    Queue::assertPushed(SyncTaskEstimate::class, 2);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/TrackerToolsTest.php`
Expected: FAIL with `Class "App\Mcp\Tools\Poker\ListSources" not found`.

- [ ] **Step 3: Gate the `Trackers` feature**

Create `app/Mcp/McpTrackers.php`:

```php
<?php

namespace App\Mcp;

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\TeamIntegration;

/**
 * Spec 5 §2.4: the tracker tools exist for a token only when a tracker
 * provider is enabled and a team it can see has an active connection.
 */
class McpTrackers
{
    /**
     * @var array<string, bool>
     */
    private array $availableByToken = [];

    public function __construct(private VisibleTeams $visibleTeams) {}

    public function available(): bool
    {
        if (! McpGrant::bound()) {
            return false;
        }

        $grant = McpGrant::current();

        return $this->availableByToken[$grant->tokenId] ??= $this->resolve($grant);
    }

    private function resolve(McpGrant $grant): bool
    {
        $providers = array_map(
            fn (IntegrationProvider $provider): string => $provider->value,
            array_values(array_filter(IntegrationProvider::enabled(), fn (IntegrationProvider $provider): bool => $provider->isTracker())),
        );

        if ($providers === []) {
            return false;
        }

        return TeamIntegration::query()
            ->whereIn('team_id', $this->visibleTeams->ids($grant))
            ->whereIn('provider', $providers)
            ->where('status', IntegrationStatus::Active->value)
            ->exists();
    }
}
```

Replace `app/Mcp/McpFeature.php` with:

```php
<?php

namespace App\Mcp;

use App\Support\Llm\Llm;

enum McpFeature
{
    case Insights;
    case Trackers;

    public function isAvailable(): bool
    {
        return match ($this) {
            self::Insights => app(Llm::class)->isConfigured(),
            self::Trackers => app(McpTrackers::class)->available(),
        };
    }
}
```

In `app/Providers/AppServiceProvider.php`, import `App\Mcp\McpTrackers` and add in `register()` after `$this->app->scoped(VisibleTeams::class);`:

```php
        $this->app->scoped(McpTrackers::class);
```

- [ ] **Step 4: Map integration failures to tool errors**

In `app/Mcp/Tools/SkrumTool.php`, import `App\Support\Integrations\Exceptions\IntegrationException`, add a catch before `catch (Throwable $exception)`:

```php
        } catch (IntegrationException $exception) {
            return Response::error($this->integrationMessage($exception));
```

and add the private method:

```php
    private function integrationMessage(IntegrationException $exception): string
    {
        $message = $exception->userMessage();
        $detail = $exception->detail();

        if ($detail === null || str_contains($message, $detail)) {
            return $message;
        }

        return "{$message} ({$detail})";
    }
```

- [ ] **Step 5: Create the sources service and the tracker concern**

Create `app/Actions/Integrations/ListPokerSources.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\JiraTracker;

/**
 * Spec 6 §9.1 / spec 5 §6.2: status and capabilities of the team's tracker
 * connections, never credentials, settings or provider errors.
 */
class ListPokerSources
{
    /**
     * @return array<int, array{
     *     source: string,
     *     siteName: ?string,
     *     status: string,
     *     access: string,
     *     canImport: bool,
     *     canWriteBack: bool,
     *     writeBackUnavailableReason: ?string
     * }>
     */
    public function handle(Team $team): array
    {
        $team->loadMissing('integrations');

        $sources = [];

        foreach (IntegrationProvider::enabled() as $provider) {
            if (! $provider->isTracker()) {
                continue;
            }

            $integration = $team->integrations->first(fn (TeamIntegration $integration): bool => $integration->provider === $provider);

            if ($integration === null) {
                continue;
            }

            $reason = $this->writeBackUnavailableReason($integration);

            $sources[] = [
                'source' => $provider->value,
                'siteName' => $this->siteName($integration),
                'status' => $integration->status->value,
                'access' => $integration->access->value,
                'canImport' => $integration->isActive(),
                'canWriteBack' => $reason === null,
                'writeBackUnavailableReason' => $reason,
            ];
        }

        return $sources;
    }

    private function writeBackUnavailableReason(TeamIntegration $integration): ?string
    {
        $label = ['provider' => $integration->provider->label()];

        if ($integration->status === IntegrationStatus::ReconnectRequired) {
            return __('Reconnect :provider in the team settings.', $label);
        }

        if (! $integration->isActive()) {
            return __('Connect :provider in the team settings.', $label);
        }

        if ($integration->access !== IntegrationAccess::Write) {
            return __('This :provider connection is read-only.', $label);
        }

        if ($integration->provider === IntegrationProvider::Jira && JiraTracker::storyPointFieldIds($integration) === []) {
            return __('No story points field found.');
        }

        return null;
    }

    private function siteName(TeamIntegration $integration): ?string
    {
        $name = match ($integration->provider) {
            IntegrationProvider::Jira => $integration->setting('siteName'),
            IntegrationProvider::Linear => $integration->setting('organizationName'),
            default => null,
        };

        return is_string($name) ? $name : null;
    }
}
```

Create `app/Mcp/Concerns/ResolvesTracker.php`:

```php
<?php

namespace App\Mcp\Concerns;

use App\Actions\Integrations\ResolvePokerTracker;
use App\Models\Team;
use App\Models\TeamIntegration;
use Illuminate\Validation\ValidationException;

trait ResolvesTracker
{
    /**
     * Spec 5 §2.4: the tool stays listed while another visible team has a
     * tracker, so a team without one gets its own explanation.
     */
    protected function trackerFor(Team $team, string $source): TeamIntegration
    {
        $resolvePokerTracker = app(ResolvePokerTracker::class);

        if (! $resolvePokerTracker->teamHasTracker($team)) {
            throw ValidationException::withMessages(['source' => __('This team has no connected tracker.')]);
        }

        return $resolvePokerTracker->handle($team, $source);
    }
}
```

- [ ] **Step 6: Create the four tools**

Create `app/Mcp/Tools/Poker/ListSources.php`:

```php
<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Integrations\ListPokerSources;
use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\Tools\SkrumTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld]
class ListSources extends SkrumTool
{
    protected string $name = 'poker.sources.list';

    protected string $description = 'List the issue trackers (Jira, Linear) connected to a team for planning poker, with their status and whether tasks can be imported and estimates written back. Credentials and provider errors are never returned.';

    public function __construct(
        private McpContext $context,
        private ListPokerSources $listPokerSources,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'team_id' => $schema->string()->format('uuid')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Trackers;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['team_id' => ['required', 'uuid']]);

        $team = $this->context->team((string) $validated['team_id']);

        return Response::structured(['items' => $this->listPokerSources->handle($team)]);
    }
}
```

Create `app/Mcp/Tools/Poker/ListIterations.php`:

```php
<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Integrations\ListPokerIterations;
use App\Enums\McpScope;
use App\Mcp\Concerns\ResolvesTracker;
use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\Tools\SkrumTool;
use App\Support\Integrations\TrackerBrowseLimit;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld]
class ListIterations extends SkrumTool
{
    use ResolvesTracker;

    protected string $name = 'poker.iterations.list';

    protected string $description = 'Without container_id, list the first 50 containers of a connected tracker (Jira scrum boards, Linear teams). With container_id, list its active and upcoming iterations (Jira sprints, Linear cycles).';

    public function __construct(
        private McpContext $context,
        private ListPokerIterations $listPokerIterations,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'team_id' => $schema->string()->format('uuid')->required(),
            'source' => $schema->string()->enum(['jira', 'linear'])->required(),
            'container_id' => $schema->string()->max(100)->description('A Jira board id or a Linear team id.'),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Trackers;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'team_id' => ['required', 'uuid'],
            'source' => ['required', 'string', Rule::in(['jira', 'linear'])],
            'container_id' => ['nullable', 'string', 'max:100'],
        ]);

        $team = $this->context->team((string) $validated['team_id']);
        $integration = $this->trackerFor($team, (string) $validated['source']);

        TrackerBrowseLimit::hit($this->context->user()->id);

        return Response::structured($this->listPokerIterations->handle($integration, $validated['container_id'] ?? null));
    }
}
```

Create `app/Mcp/Tools/Poker/ImportTasks.php`:

```php
<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Integrations\ImportPokerTasks;
use App\Actions\Integrations\PreviewPokerImport;
use App\Actions\Poker\PokerGuard;
use App\Enums\McpScope;
use App\Mcp\Concerns\ResolvesTracker;
use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\Tools\SkrumTool;
use App\Support\Integrations\TrackerBrowseLimit;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld]
class ImportTasks extends SkrumTool
{
    use ResolvesTracker;

    protected string $name = 'poker.game.tasks.import';

    protected string $description = 'Import the issues of a tracker iteration (iteration_id: a Jira sprint or Linear cycle) or of a query (query: JQL for Jira, a search term for Linear) into a planning poker game, in source order, at most 100 per call. Issues already imported are skipped; a game holds at most 200 tasks.';

    public function __construct(
        private McpContext $context,
        private ImportPokerTasks $importPokerTasks,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'game_id' => $schema->string()->format('uuid')->required(),
            'source' => $schema->string()->enum(['jira', 'linear'])->required(),
            'iteration_id' => $schema->string()->max(100),
            'container_id' => $schema->string()->max(100)->description('Accepted for Jira sprints; not needed.'),
            'query' => $schema->string()->min(1)->max(1000),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Trackers;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'game_id' => ['required', 'uuid'],
            'source' => ['required', 'string', Rule::in(['jira', 'linear'])],
            'iteration_id' => ['nullable', 'string', 'max:100', 'required_without:query', 'prohibits:query'],
            'container_id' => ['nullable', 'string', 'max:100'],
            'query' => ['nullable', 'string', 'max:1000', 'required_without:iteration_id'],
        ]);

        $game = $this->context->pokerGame((string) $validated['game_id']);

        PokerGuard::notEnded($game);

        $integration = $this->trackerFor($game->team, (string) $validated['source']);
        $player = $this->context->pokerPlayerForWrite($game);

        TrackerBrowseLimit::hit($this->context->user()->id);

        $iterationId = $validated['iteration_id'] ?? null;

        return Response::structured($this->importPokerTasks->fromSource(
            $game,
            $player,
            $integration,
            $iterationId === null ? PreviewPokerImport::ModeQuery : PreviewPokerImport::ModeIteration,
            $iterationId,
            $validated['query'] ?? null,
        ));
    }
}
```

Create `app/Mcp/Tools/Poker/SyncTask.php`:

```php
<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Integrations\PokerTaskSync;
use App\Actions\Integrations\RequestEstimateSync;
use App\Actions\Integrations\ResolvePokerTracker;
use App\Actions\Poker\PresentPokerTask;
use App\Enums\McpScope;
use App\Events\Poker\PokerTaskSaved;
use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\Tools\SkrumTool;
use App\Models\PokerGame;
use App\Models\PokerTask;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld]
class SyncTask extends SkrumTool
{
    protected string $name = 'poker.game.task.sync';

    protected string $description = 'Write the estimate of an imported task back to its tracker again (facilitator only): retries a failed write-back or forces a rewrite of the current estimate. The estimate itself cannot be changed with this tool.';

    public function __construct(
        private McpContext $context,
        private ResolvePokerTracker $resolvePokerTracker,
        private RequestEstimateSync $requestEstimateSync,
        private PresentPokerTask $presentPokerTask,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'task_id' => $schema->string()->format('uuid')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Trackers;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['task_id' => ['required', 'uuid']]);

        $task = PokerTask::query()
            ->whereKey($validated['task_id'])
            ->whereHas('game', fn ($query) => $query->whereIn('team_id', $this->context->visibleTeamIds()))
            ->firstOrFail();
        $game = $task->game;

        if (! $this->resolvePokerTracker->teamHasTracker($game->team)) {
            throw ValidationException::withMessages(['task_id' => __('This team has no connected tracker.')]);
        }

        $player = $this->context->pokerPlayer($game) ?? throw new AuthorizationException(__('Only the facilitator can do this.'));

        DB::transaction(function () use ($game, $task, $player): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $lockedTask = PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($task->id)->firstOrFail();

            $this->requestEstimateSync->retry($locked, $lockedTask, $player);

            $lockedTask->loadCount('rounds');

            (new PokerTaskSaved($locked->id, $this->presentPokerTask->handle($lockedTask)))->sendToOthers();
        });

        return Response::structured(['syncState' => PokerTaskSync::Pending]);
    }
}
```

In `app/Mcp/Servers/SkrumServer.php`, import the four classes and append to `$tools` after `RevealTask::class`:

```php
        ListSources::class,
        ListIterations::class,
        ImportTasks::class,
        SyncTask::class,
```

- [ ] **Step 7: Expose the tracker reference in `poker.game.tasks.list`**

In `app/Mcp/Presenters/McpPokerGame.php`, import `App\Actions\Integrations\PokerTaskSync`. In `tasks()`, after the `$names = …` line add:

```php
        $sync = PokerTaskSync::for($game);
```

change the closure's `use` list to `use ($game, $viewer, $names, $sync)`, its first line to:

```php
            $presented = $this->presentPokerTask->handle($task, $sync);
```

and replace `'external' => null,` with:

```php
                'external' => $presented['external'] === null ? null : [
                    'source' => $presented['external']['source'],
                    'key' => $presented['external']['key'],
                    'url' => $presented['external']['url'],
                    'syncState' => $presented['external']['syncState'] ?? null,
                    'syncError' => $presented['external']['syncError'] ?? null,
                ],
```

- [ ] **Step 8: Update the catalogue, sweep and base tests**

In `tests/Pest.php`, replace `mcpContractToolNames()` with:

```php
/**
 * The 29 tools of the QRetro contract. The four tracker tools are listed
 * only while a visible team has an active tracker (spec 5 §2.4).
 *
 * @return array<int, string>
 */
function mcpContractToolNames(): array
{
    $names = [
        'retro.teams.list',
        'retro.team.members.list',
        'retro.boards.list',
        'retro.boards.search',
        'retro.actions.list',
        'retro.board.messages.list',
        'retro.board.summary.get',
        'retro.board.actions.list',
        'retro.board.insights.list',
        'retro.board.health.get',
        'retro.board.roti.get',
        'poker.sources.list',
        'poker.iterations.list',
        'poker.games.list',
        'poker.game.get',
        'poker.game.tasks.list',
        'retro.actions.create',
        'retro.actions.update',
        'retro.actions.complete',
        'retro.board.suggested_actions.promote',
        'retro.board.suggested_actions.reject',
        'retro.board.messages.update',
        'poker.games.create',
        'poker.game.tasks.add',
        'poker.game.tasks.import',
        'poker.game.task.select',
        'poker.game.task.reveal',
        'poker.game.task.sync',
        'retro.board.messages.delete_own',
    ];

    sort($names);

    return $names;
}
```

In `mcpSweepWorld()`, after `pokerVote(openPokerRound($game, $current), $player, '5');` add:

```php
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    $imported = PokerTask::factory()->imported()->estimated('5')->create(['poker_game_id' => $game->id, 'title' => 'Sweep imported story']);
```

add `'imported' => $imported,` to the returned array (after `'next' => $next,`) and `'jira-access', 'jira-refresh',` to its `secrets`.

In `tests/Feature/Mcp/CatalogueTest.php`, import `App\Enums\IntegrationProvider` and `App\Models\TeamIntegration`; replace the first test with:

```php
it('registers exactly the contract tools and prompts', function () {
    configureLlm();
    enableIntegrations(IntegrationProvider::Jira);
    $team = Team::factory()->create();
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    $user = teamMember($team);

    $server = actingAsMcp($user, McpScope::cases());

    expect(mcpToolNames($server))->toBe(mcpContractToolNames())
        ->and(mcpPromptNames($server))->toBe(['analyze-retro', 'team-health']);
});

it('adds only the read tracker tools to a read-only grant', function () use ($readTools) {
    enableIntegrations(IntegrationProvider::Jira);
    $team = Team::factory()->create();
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    $user = teamMember($team);
    configureLlm();

    $expected = [...$readTools, 'poker.iterations.list', 'poker.sources.list'];
    sort($expected);

    expect(mcpToolNames(actingAsMcp($user, [McpScope::Read])))->toBe($expected);
});
```

In `tests/Feature/Mcp/ToolBaseTest.php`, import `App\Enums\IntegrationProvider` and `App\Models\TeamIntegration`, and replace the test `offers insight tools only with an llm provider and tracker tools never` with:

```php
it('offers insight tools only with an llm provider', function () {
    $user = User::factory()->create();
    bindMcpGrant($user);

    expect(mcpToolNames(ToolBaseTestServer::actingAs($user)))->not->toContain('test.insights');

    configureLlm();

    expect(mcpToolNames(ToolBaseTestServer::actingAs($user)))->toContain('test.insights');
});

it('offers tracker tools only when a visible team has an active tracker', function () {
    enableIntegrations(IntegrationProvider::Jira);
    $team = Team::factory()->create();
    $user = teamMember($team);
    TeamIntegration::factory()->jira()->create();

    bindMcpGrant($user);

    expect(McpFeature::Trackers->isAvailable())->toBeFalse()
        ->and(mcpToolNames(ToolBaseTestServer::actingAs($user)))->not->toContain('test.trackers');

    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    bindMcpGrant($user);

    expect(McpFeature::Trackers->isAvailable())->toBeTrue()
        ->and(mcpToolNames(ToolBaseTestServer::actingAs($user)))->toContain('test.trackers');
});
```

In `tests/Feature/Mcp/McpSweepTest.php`, import `App\Enums\IntegrationProvider`; add to `mcpSweepArguments()`:

```php
        'poker.sources.list' => fn (array $w): array => ['team_id' => $w['team']->id],
        'poker.iterations.list' => fn (array $w): array => ['team_id' => $w['team']->id, 'source' => 'jira'],
        'poker.game.tasks.import' => fn (array $w): array => ['game_id' => $w['game']->id, 'source' => 'jira', 'query' => 'project = SWEEP'],
        'poker.game.task.sync' => fn (array $w): array => ['task_id' => $w['imported']->id],
```

and to `mcpSweepMarkers()`:

```php
        'poker.sources.list' => fn (array $w): string => 'Acme',
        'poker.iterations.list' => fn (array $w): string => 'Sweep scrum board',
        'poker.game.tasks.import' => fn (array $w): string => 'truncated',
        'poker.game.task.sync' => fn (array $w): string => 'pending',
```

and start the `never returns an email, a guest token, a guest link or a secret` test with:

```php
    enableIntegrations(IntegrationProvider::Jira);
    fakeJiraTrackerApi();
```

In `tests/Feature/Mcp/PokerReadToolsTest.php`, import `App\Enums\IntegrationProvider` and `App\Models\TeamIntegration`, and add:

```php
it('exposes the tracker reference and write-back state of imported tasks', function () {
    enableIntegrations(IntegrationProvider::Jira);
    $game = PokerGame::factory()->create();
    [$user] = pokerMember($game);
    TeamIntegration::factory()->jira()->create(['team_id' => $game->team_id]);
    $task = importedPokerTask($game, ['needs_sync' => true, 'sync_error' => 'Boom', 'external_assignee' => 'Jane Doe']);

    $result = mcpStructured(actingAsMcp($user)->tool(ListTasks::class, ['game_id' => $game->id])->assertOk());

    expect($result['items'][0]['external'])->toBe([
        'source' => 'jira',
        'key' => $task->external_key,
        'url' => $task->external_url,
        'syncState' => 'failed',
        'syncError' => 'Boom',
    ]);
});
```

- [ ] **Step 9: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `This team has no connected tracker.` | `Cette équipe n’a aucun outil de suivi connecté.` | `Este equipo no tiene ningún gestor de incidencias conectado.` | `Dieses Team hat keinen verbundenen Tracker.` |

- [ ] **Step 10: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp`
Expected: PASS (all MCP suites, including `TrackerToolsTest`, the 29-tool catalogue and the sweep of the four new tools).

- [ ] **Step 11: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Mcp app/Actions/Integrations/ListPokerSources.php app/Providers/AppServiceProvider.php tests/Pest.php tests/Feature/Mcp lang
git commit -m "feat: add the MCP tracker tools for planning poker

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 8: Frontend data, key chips and the task's source details

**Files:**
- Create: `resources/js/components/poker/{task-source-chip,task-source-details}.tsx`
- Modify: `resources/js/lib/poker/types.ts`, `resources/js/hooks/use-poker-game.ts`, `resources/js/components/poker/{tasks-pane,task-detail}.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Task 3 snapshot `integrations` and task `external`; Task 6 route `poker.tasks.sync.store` (Wayfinder `PokerTaskSyncsController.store({game, task})`, 202 with the task).
- Produces:
  - Types in `resources/js/lib/poker/types.ts`: `PokerTrackerSource` (`'jira' | 'linear'`), `PokerSyncState`, `PokerTaskExternal`, `PokerTrackerConnection`, `PokerIntegrations`, `TrackerContainer`, `TrackerIteration`, `TrackerIssuePreview`, `TrackerLabels`, `connectedTrackers(integrations): PokerTrackerSource[]`; `PokerTask.external: PokerTaskExternal | null`; `PokerSnapshot.integrations: PokerIntegrations | null`.
  - `usePokerGame`: a `task.saved` for an imported task makes a non-guest client refetch its snapshot (the broadcast carries the reduced `external`); guests upsert it.
  - `TaskSourceChip({external})`, `TaskSourceDetails({task, external})` (link, assignee, source estimate, sync badge, Retry / Sync again for the facilitator, managed notice). The Edit button is hidden for imported tasks.

This task has no automated test (no frontend test runner); it is checked by `npm run types:check && npm run check` and by the walkthrough of Task 10.

- [ ] **Step 1: Extend the types**

In `resources/js/lib/poker/types.ts`, add before `export type PokerTask`:

```ts
export type PokerTrackerSource = 'jira' | 'linear';

export type PokerSyncState = 'synced' | 'pending' | 'failed' | 'unsupported';

/**
 * Guests and broadcasts only get source, key, url and isManaged; the other
 * fields come with the snapshot of a non-guest player.
 */
export type PokerTaskExternal = {
    source: PokerTrackerSource;
    key: string;
    url: string;
    isManaged: true;
    assignee?: string | null;
    sourceEstimate?: string | null;
    refreshedAt?: string | null;
    syncState?: PokerSyncState | null;
    syncError?: string | null;
    unsupportedReason?: string | null;
};

export type PokerTrackerConnection = { connected: boolean; canWrite: boolean };

export type PokerIntegrations = Record<
    PokerTrackerSource,
    PokerTrackerConnection | null
>;

export type TrackerContainer = { id: string; name: string };

export type TrackerIteration = {
    id: string;
    name: string;
    state: 'active' | 'upcoming';
    startsOn: string | null;
    endsOn: string | null;
};

export type TrackerIssuePreview = {
    externalId: string;
    key: string;
    title: string;
    assignee: string | null;
    estimate: string | null;
    status: string | null;
    alreadyImported: boolean;
};

export const TrackerLabels: Record<PokerTrackerSource, string> = {
    jira: 'Jira',
    linear: 'Linear',
};

export function connectedTrackers(
    integrations: PokerIntegrations | null,
): PokerTrackerSource[] {
    if (!integrations) {
        return [];
    }

    return (Object.keys(TrackerLabels) as PokerTrackerSource[]).filter(
        (source) => integrations[source]?.connected === true,
    );
}
```

In `PokerTask`, replace `external: null;` with `external: PokerTaskExternal | null;`. In `PokerSnapshot`, add after `links: { team: string | null };` (next to Plan 12b's `share`/`deliveries`):

```ts
    integrations: PokerIntegrations | null;
```

- [ ] **Step 2: Refetch on imported-task broadcasts**

In `resources/js/hooks/use-poker-game.ts`, replace the `case 'task.saved':` block with:

```ts
                case 'task.saved': {
                    const task = payload.task as PokerTask;

                    if (
                        task.external !== null &&
                        !latestSnapshot.current.me.isGuest
                    ) {
                        void refetch();
                        break;
                    }

                    apply({ type: 'task.upsert', task });
                    break;
                }
```

- [ ] **Step 3: Create the chip and the source details**

Create `resources/js/components/poker/task-source-chip.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import type { PokerTaskExternal } from '@/lib/poker/types';

export function TaskSourceChip({ external }: { external: PokerTaskExternal }) {
    return (
        <Badge variant="outline" className="shrink-0 font-mono text-[11px]">
            {external.key}
        </Badge>
    );
}
```

Create `resources/js/components/poker/task-source-details.tsx`:

```tsx
import { ExternalLink, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import PokerTaskSyncsController from '@/actions/App/Http/Controllers/Integrations/PokerTaskSyncsController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import {
    TrackerLabels,
    type PokerTask,
    type PokerTaskExternal,
} from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

type Props = { task: PokerTask; external: PokerTaskExternal };

export function TaskSourceDetails({ task, external }: Props) {
    const { snapshot, apply, run } = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const source = TrackerLabels[external.source];
    const canSync =
        snapshot.me.isFacilitator &&
        task.estimate !== null &&
        (external.syncState === 'failed' || external.syncState === 'synced');

    const sync = async () => {
        setBusy(true);

        const result = await run(
            retroRequest<PokerTask>(
                PokerTaskSyncsController.store({
                    game: snapshot.game.id,
                    task: task.id,
                }),
            ),
        );

        setBusy(false);

        if (result) {
            apply({ type: 'task.upsert', task: result });
            toast.success(t('Sync requested.'));
        }
    };

    return (
        <div className="space-y-2 rounded-md bg-muted/50 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <a
                    href={external.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono font-medium underline"
                >
                    {external.key}
                    <ExternalLink className="size-3" aria-hidden />
                    <span className="sr-only">
                        {t('Open in :source', { source })}
                    </span>
                </a>
                {external.assignee && (
                    <span>
                        {t('Assignee: :name', { name: external.assignee })}
                    </span>
                )}
                {external.sourceEstimate && (
                    <span>
                        {t(':source estimate: :value', {
                            source,
                            value: external.sourceEstimate,
                        })}
                    </span>
                )}
                <SyncBadge external={external} source={source} />
                {canSync && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void sync()}
                    >
                        <RefreshCw className="size-3.5" />
                        {external.syncState === 'failed'
                            ? t('Retry')
                            : t('Sync again')}
                    </Button>
                )}
            </div>
            {external.syncState === 'failed' && external.syncError && (
                <p className="text-destructive">{external.syncError}</p>
            )}
            <p className="text-muted-foreground">
                {t(
                    'The title and description are managed in :source. Refresh the tasks to update them.',
                    { source },
                )}
            </p>
        </div>
    );
}

function SyncBadge({
    external,
    source,
}: {
    external: PokerTaskExternal;
    source: string;
}) {
    const { t } = useTrans();

    switch (external.syncState) {
        case 'synced':
            return (
                <Badge variant="secondary">
                    {t('Synced to :source', { source })}
                </Badge>
            );
        case 'pending':
            return <Badge variant="outline">{t('Sync pending')}</Badge>;
        case 'failed':
            return <Badge variant="destructive">{t('Sync failed')}</Badge>;
        case 'unsupported':
            return (
                <Badge variant="outline" className="whitespace-normal">
                    {t('Not synced: :reason', {
                        reason: external.unsupportedReason ?? '',
                    })}
                </Badge>
            );
        default:
            return null;
    }
}
```

- [ ] **Step 4: Show them in the tasks pane and the task detail**

In `resources/js/components/poker/tasks-pane.tsx`, import `{ TaskSourceChip } from './task-source-chip'` and, in `TaskRow`, add right after the title `<span className="min-w-0 flex-1 font-medium break-words">…</span>`:

```tsx
                {task.external && <TaskSourceChip external={task.external} />}
```

In `resources/js/components/poker/task-detail.tsx`, import `{ TaskSourceDetails } from './task-source-details'`; change the Edit button condition from `{me.canEditTasks && !isEnded && (` to:

```tsx
                {me.canEditTasks && !isEnded && task.external === null && (
```

and add right after the closing `</div>` of the header row (before the description):

```tsx
            {task.external && (
                <TaskSourceDetails task={task} external={task.external} />
            )}
```

- [ ] **Step 5: Add the translations**

Append to `lang/{en,fr,es,de}.json`:

| Key (en) | fr | es | de |
|---|---|---|---|
| `Sync requested.` | `Synchronisation demandée.` | `Sincronización solicitada.` | `Synchronisierung angefordert.` |
| `Open in :source` | `Ouvrir dans :source` | `Abrir en :source` | `In :source öffnen` |
| `Assignee: :name` | `Assigné à : :name` | `Asignado a: :name` | `Zugewiesen an: :name` |
| `:source estimate: :value` | `Estimation :source : :value` | `Estimación de :source: :value` | `:source-Schätzung: :value` |
| `Sync again` | `Resynchroniser` | `Volver a sincronizar` | `Erneut synchronisieren` |
| `The title and description are managed in :source. Refresh the tasks to update them.` | `Le titre et la description sont gérés dans :source. Actualisez les tâches pour les mettre à jour.` | `El título y la descripción se gestionan en :source. Actualiza las tareas para ponerlos al día.` | `Titel und Beschreibung werden in :source verwaltet. Aktualisiere die Aufgaben, um sie aufzufrischen.` |
| `Synced to :source` | `Synchronisé avec :source` | `Sincronizado con :source` | `Mit :source synchronisiert` |
| `Sync pending` | `Synchronisation en attente` | `Sincronización pendiente` | `Synchronisierung ausstehend` |
| `Sync failed` | `Échec de la synchronisation` | `Error de sincronización` | `Synchronisierung fehlgeschlagen` |
| `Not synced: :reason` | `Non synchronisé : :reason` | `Sin sincronizar: :reason` | `Nicht synchronisiert: :reason` |

- [ ] **Step 6: Check types and lint**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check`
Expected: no new errors (only the known pre-existing ones listed in the Global Constraints). Format the touched files with `npx vp check --fix resources/js/lib/poker/types.ts resources/js/hooks/use-poker-game.ts resources/js/components/poker/task-source-chip.tsx resources/js/components/poker/task-source-details.tsx resources/js/components/poker/tasks-pane.tsx resources/js/components/poker/task-detail.tsx`.

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add resources/js/lib/poker/types.ts resources/js/hooks/use-poker-game.ts resources/js/components/poker lang
git commit -m "feat: show tracker keys, source details and sync state on poker tasks

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 9: Import dialog and "Refresh from :source"

**Files:**
- Create: `resources/js/components/poker/import-tasks-dialog.tsx`
- Modify: `resources/js/components/poker/tasks-pane.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Task 4 routes (Wayfinder `PokerImportContainersController.index({game, source}, {query: {q, page}})`, `PokerImportIterationsController.index({game, source}, {query: {container}})`, `PokerImportPreviewsController.store({game, source})` with `{mode, iteration_id, query}`), Task 5 routes (`PokerImportsController.store({game, source})` with `{external_ids}` → `{imported, skipped}`, `PokerImportRefreshesController.store(gameId)` → `{refreshed, missing}`); Task 8 types and `connectedTrackers()`; `useGame()`.
- Produces: `ImportTasksDialog({open, onOpenChange, sources})` and the tasks pane header: "Import" next to "Add task" (players who can edit tasks, game not ended, at least one connected tracker) and a menu with "Refresh from :source" when imported tasks of a connected source exist.

This task has no automated test (no frontend test runner); it is checked by the type-check, the lint and the walkthrough of Task 10.

- [ ] **Step 1: Create the dialog**

Create `resources/js/components/poker/import-tasks-dialog.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import PokerImportContainersController from '@/actions/App/Http/Controllers/Integrations/PokerImportContainersController';
import PokerImportIterationsController from '@/actions/App/Http/Controllers/Integrations/PokerImportIterationsController';
import PokerImportPreviewsController from '@/actions/App/Http/Controllers/Integrations/PokerImportPreviewsController';
import PokerImportsController from '@/actions/App/Http/Controllers/Integrations/PokerImportsController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import {
    TrackerLabels,
    type PokerTrackerSource,
    type TrackerContainer,
    type TrackerIssuePreview,
    type TrackerIteration,
} from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

type Mode = 'iteration' | 'query';

type Preview = { issues: TrackerIssuePreview[]; truncated: boolean };

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sources: PokerTrackerSource[];
};

export function ImportTasksDialog({ open, onOpenChange, sources }: Props) {
    const { t } = useTrans();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-2xl"
            >
                <DialogTitle>{t('Import tasks')}</DialogTitle>
                {open && sources.length > 0 && (
                    <ImportForm
                        sources={sources}
                        onDone={() => onOpenChange(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function ImportForm({
    sources,
    onDone,
}: {
    sources: PokerTrackerSource[];
    onDone: () => void;
}) {
    const { snapshot, run, refetch, handleError } = useGame();
    const { t } = useTrans();
    const gameId = snapshot.game.id;
    const [source, setSource] = useState<PokerTrackerSource>(sources[0]);
    const [mode, setMode] = useState<Mode>('iteration');
    const [containerSearch, setContainerSearch] = useState('');
    const [containers, setContainers] = useState<TrackerContainer[]>([]);
    const [container, setContainer] = useState('');
    const [iterations, setIterations] = useState<TrackerIteration[] | null>(
        null,
    );
    const [iteration, setIteration] = useState('');
    const [query, setQuery] = useState('');
    const [preview, setPreview] = useState<Preview | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isJira = source === 'jira';

    const fail = useCallback(
        (caught: unknown) => {
            const message = handleError(caught);

            if (message !== null) {
                setError(message);
            }
        },
        [handleError],
    );

    useEffect(() => {
        if (mode !== 'iteration') {
            return;
        }

        let stale = false;

        const timer = setTimeout(() => {
            retroRequest<{ containers: TrackerContainer[] }>(
                PokerImportContainersController.index(
                    { game: gameId, source },
                    { query: { q: containerSearch, page: 1 } },
                ),
            )
                .then((response) => {
                    if (!stale) {
                        setContainers(response.containers);
                    }
                })
                .catch((caught: unknown) => {
                    if (!stale) {
                        fail(caught);
                    }
                });
        }, 300);

        return () => {
            stale = true;
            clearTimeout(timer);
        };
    }, [gameId, source, mode, containerSearch, fail]);

    const chooseSource = (next: string) => {
        if (next !== 'jira' && next !== 'linear') {
            return;
        }

        setSource(next);
        setContainerSearch('');
        setContainers([]);
        setContainer('');
        setIterations(null);
        setIteration('');
        setPreview(null);
        setSelected(new Set());
        setError(null);
    };

    const chooseContainer = async (next: string) => {
        setContainer(next);
        setIterations(null);
        setIteration('');
        setError(null);

        try {
            setIterations(
                await retroRequest<TrackerIteration[]>(
                    PokerImportIterationsController.index(
                        { game: gameId, source },
                        { query: { container: next } },
                    ),
                ),
            );
        } catch (caught) {
            fail(caught);
        }
    };

    const showIssues = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await retroRequest<Preview>(
                PokerImportPreviewsController.store({ game: gameId, source }),
                mode === 'iteration'
                    ? { mode, iteration_id: iteration }
                    : { mode, query },
            );

            setPreview(response);
            setSelected(
                new Set(
                    response.issues
                        .filter((issue) => !issue.alreadyImported)
                        .map((issue) => issue.externalId),
                ),
            );
        } catch (caught) {
            setPreview(null);
            fail(caught);
        } finally {
            setLoading(false);
        }
    };

    const importable = useMemo(
        () => preview?.issues.filter((issue) => !issue.alreadyImported) ?? [],
        [preview],
    );

    const toggle = (externalId: string, checked: boolean) => {
        setSelected((current) => {
            const next = new Set(current);

            if (checked) {
                next.add(externalId);
            } else {
                next.delete(externalId);
            }

            return next;
        });
    };

    const toggleAll = (checked: boolean) => {
        setSelected(
            checked
                ? new Set(importable.map((issue) => issue.externalId))
                : new Set(),
        );
    };

    const importSelected = async () => {
        const externalIds = importable
            .map((issue) => issue.externalId)
            .filter((id) => selected.has(id));

        setImporting(true);

        const result = await run(
            retroRequest<{ imported: number; skipped: number }>(
                PokerImportsController.store({ game: gameId, source }),
                { external_ids: externalIds },
            ),
        );

        setImporting(false);

        if (result) {
            toast.success(
                t(':imported imported, :skipped skipped.', {
                    imported: result.imported,
                    skipped: result.skipped,
                }),
            );
            await refetch();
            onDone();
        }
    };

    const canShow =
        mode === 'iteration' ? iteration !== '' : query.trim() !== '';

    return (
        <div className="space-y-4">
            {sources.length > 1 && (
                <ToggleGroup
                    type="single"
                    variant="outline"
                    value={source}
                    onValueChange={chooseSource}
                    aria-label={t('Source')}
                >
                    {sources.map((item) => (
                        <ToggleGroupItem key={item} value={item}>
                            {TrackerLabels[item]}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            )}

            <ToggleGroup
                type="single"
                variant="outline"
                value={mode}
                onValueChange={(next) => {
                    if (next === 'iteration' || next === 'query') {
                        setMode(next);
                        setPreview(null);
                        setError(null);
                    }
                }}
                aria-label={t('Import from :source', {
                    source: TrackerLabels[source],
                })}
            >
                <ToggleGroupItem value="iteration">
                    {isJira ? t('Sprint') : t('Cycle')}
                </ToggleGroupItem>
                <ToggleGroupItem value="query">{t('Query')}</ToggleGroupItem>
            </ToggleGroup>

            <form className="space-y-3" onSubmit={(event) => void showIssues(event)}>
                {mode === 'iteration' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="import-container-search">
                                {isJira ? t('Board') : t('Team')}
                            </Label>
                            <Input
                                id="import-container-search"
                                value={containerSearch}
                                placeholder={
                                    isJira
                                        ? t('Search boards')
                                        : t('Search teams')
                                }
                                onChange={(event) =>
                                    setContainerSearch(event.target.value)
                                }
                            />
                            <Select
                                value={container}
                                onValueChange={(next) =>
                                    void chooseContainer(next)
                                }
                            >
                                <SelectTrigger
                                    aria-label={
                                        isJira
                                            ? t('Choose a board')
                                            : t('Choose a team')
                                    }
                                >
                                    <SelectValue
                                        placeholder={
                                            isJira
                                                ? t('Choose a board')
                                                : t('Choose a team')
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {containers.map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                            {item.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>{isJira ? t('Sprint') : t('Cycle')}</Label>
                            <Select
                                value={iteration}
                                onValueChange={setIteration}
                                disabled={iterations === null}
                            >
                                <SelectTrigger
                                    aria-label={
                                        isJira
                                            ? t('Choose a sprint')
                                            : t('Choose a cycle')
                                    }
                                >
                                    <SelectValue
                                        placeholder={
                                            isJira
                                                ? t('Choose a sprint')
                                                : t('Choose a cycle')
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {(iterations ?? []).map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                            {item.name} ·{' '}
                                            {item.state === 'active'
                                                ? t('Active')
                                                : t('Upcoming')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {iterations !== null && iterations.length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                    {isJira
                                        ? t('No active or upcoming sprint.')
                                        : t('No active or upcoming cycle.')}
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        <Label htmlFor="import-query">{t('Query')}</Label>
                        <Textarea
                            id="import-query"
                            value={query}
                            maxLength={1000}
                            rows={2}
                            placeholder={
                                isJira
                                    ? t(
                                          'JQL, for example project = PROJ AND sprint in openSprints()',
                                      )
                                    : t('Search Linear issues')
                            }
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </div>
                )}

                <Button
                    type="submit"
                    variant="secondary"
                    disabled={!canShow || loading}
                >
                    {loading ? t('Loading…') : t('Show issues')}
                </Button>
            </form>

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            {preview && (
                <div className="space-y-2">
                    {preview.issues.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t('No issues found.')}
                        </p>
                    ) : (
                        <>
                            <label className="flex items-center gap-2 text-sm font-medium">
                                <Checkbox
                                    checked={
                                        importable.length > 0 &&
                                        selected.size === importable.length
                                    }
                                    disabled={importable.length === 0}
                                    onCheckedChange={(checked) =>
                                        toggleAll(checked === true)
                                    }
                                />
                                {t('Select all')}
                            </label>
                            <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
                                {preview.issues.map((issue) => (
                                    <li
                                        key={issue.externalId}
                                        className="flex items-start gap-2 p-2 text-sm"
                                    >
                                        <Checkbox
                                            aria-label={issue.key}
                                            className="mt-0.5"
                                            checked={
                                                issue.alreadyImported ||
                                                selected.has(issue.externalId)
                                            }
                                            disabled={issue.alreadyImported}
                                            onCheckedChange={(checked) =>
                                                toggle(
                                                    issue.externalId,
                                                    checked === true,
                                                )
                                            }
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="font-mono text-xs text-muted-foreground">
                                                {issue.key}
                                            </span>{' '}
                                            <span className="break-words">
                                                {issue.title}
                                            </span>
                                            {issue.assignee && (
                                                <span className="block text-xs text-muted-foreground">
                                                    {issue.assignee}
                                                </span>
                                            )}
                                        </span>
                                        {issue.estimate && (
                                            <Badge variant="secondary">
                                                {issue.estimate}
                                            </Badge>
                                        )}
                                        {issue.alreadyImported && (
                                            <Badge variant="outline">
                                                {t('Already imported')}
                                            </Badge>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            {preview.truncated && (
                                <p className="text-xs text-muted-foreground">
                                    {t(
                                        'Showing the first 100. Narrow the query.',
                                    )}
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}

            <DialogFooter className="gap-2">
                <Button variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button
                    disabled={selected.size === 0 || importing}
                    onClick={() => void importSelected()}
                >
                    {t('Import :count tasks', { count: selected.size })}
                </Button>
            </DialogFooter>
        </div>
    );
}
```

- [ ] **Step 2: Add the Import button and the refresh menu**

In `resources/js/components/poker/tasks-pane.tsx`:

1. Add imports:

```tsx
import { Download, MoreHorizontal, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import PokerImportRefreshesController from '@/actions/App/Http/Controllers/Integrations/PokerImportRefreshesController';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    connectedTrackers,
    TrackerLabels,
    type PokerTask,
} from '@/lib/poker/types';
import { ImportTasksDialog } from './import-tasks-dialog';
```

(merge `Download, MoreHorizontal, RefreshCw` into the existing `lucide-react` import and replace the existing `import type { PokerTask } from '@/lib/poker/types';`).

2. In `TasksPane`, add after `const [adding, setAdding] = useState(false);`:

```tsx
    const [importing, setImporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
```

and after `const canSort = me.isFacilitator && !isEnded;` (so `game`, `me` and `isEnded` are declared):

```tsx
    const trackers = connectedTrackers(snapshot.integrations);
    const canImport = me.canEditTasks && !isEnded && trackers.length > 0;
    const refreshableSources = trackers.filter((source) =>
        snapshot.tasks.some((task) => task.external?.source === source),
    );
    const refreshLabel = refreshableSources
        .map((source) => TrackerLabels[source])
        .join(' & ');

    const refresh = async () => {
        setRefreshing(true);

        const result = await run(
            retroRequest<{ refreshed: number; missing: number }>(
                PokerImportRefreshesController.store(game.id),
            ),
        );

        setRefreshing(false);

        if (!result) {
            return;
        }

        toast.success(
            t(':count tasks refreshed.', { count: result.refreshed }),
        );

        if (result.missing > 0) {
            toast.warning(
                t(':count tasks were not found in :source.', {
                    count: result.missing,
                    source: refreshLabel,
                }),
            );
        }

        await refetch();
    };
```

3. Replace the header's `{me.canEditTasks && !isEnded && (<Button …>{t('Add task')}</Button>)}` block with:

```tsx
                <div className="flex items-center gap-1">
                    {canImport && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setImporting(true)}
                        >
                            <Download className="size-4" />
                            {t('Import')}
                        </Button>
                    )}
                    {me.canEditTasks && !isEnded && (
                        <Button size="sm" onClick={() => setAdding(true)}>
                            <Plus className="size-4" />
                            {t('Add task')}
                        </Button>
                    )}
                    {canImport && refreshableSources.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label={t('More task actions')}
                                >
                                    <MoreHorizontal className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    disabled={refreshing}
                                    onSelect={() => void refresh()}
                                >
                                    <RefreshCw className="size-4" />
                                    {t('Refresh from :source', {
                                        source: refreshLabel,
                                    })}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
```

4. Next to `<TaskFormDialog task={null} … />` at the end of the component, add:

```tsx
            <ImportTasksDialog
                open={importing}
                onOpenChange={setImporting}
                sources={trackers}
            />
```

- [ ] **Step 3: Add the translations**

Append to `lang/{en,fr,es,de}.json` (skip keys that already exist, e.g. `Board`, `Team`, `Active`, `Loading…`, `Cancel`):

| Key (en) | fr | es | de |
|---|---|---|---|
| `Import` | `Importer` | `Importar` | `Importieren` |
| `Import tasks` | `Importer des tâches` | `Importar tareas` | `Aufgaben importieren` |
| `Import from :source` | `Importer depuis :source` | `Importar desde :source` | `Aus :source importieren` |
| `Source` | `Source` | `Origen` | `Quelle` |
| `Sprint` | `Sprint` | `Sprint` | `Sprint` |
| `Cycle` | `Cycle` | `Ciclo` | `Zyklus` |
| `Query` | `Requête` | `Consulta` | `Abfrage` |
| `Search boards` | `Rechercher des tableaux` | `Buscar tableros` | `Boards suchen` |
| `Search teams` | `Rechercher des équipes` | `Buscar equipos` | `Teams suchen` |
| `Choose a board` | `Choisir un tableau` | `Elige un tablero` | `Wähle ein Board` |
| `Choose a team` | `Choisir une équipe` | `Elige un equipo` | `Wähle ein Team` |
| `Choose a sprint` | `Choisir un sprint` | `Elige un sprint` | `Wähle einen Sprint` |
| `Choose a cycle` | `Choisir un cycle` | `Elige un ciclo` | `Wähle einen Zyklus` |
| `Upcoming` | `À venir` | `Próximo` | `Anstehend` |
| `No active or upcoming sprint.` | `Aucun sprint en cours ou à venir.` | `No hay ningún sprint activo o próximo.` | `Kein aktiver oder anstehender Sprint.` |
| `No active or upcoming cycle.` | `Aucun cycle en cours ou à venir.` | `No hay ningún ciclo activo o próximo.` | `Kein aktiver oder anstehender Zyklus.` |
| `JQL, for example project = PROJ AND sprint in openSprints()` | `JQL, par exemple project = PROJ AND sprint in openSprints()` | `JQL, por ejemplo project = PROJ AND sprint in openSprints()` | `JQL, zum Beispiel project = PROJ AND sprint in openSprints()` |
| `Search Linear issues` | `Rechercher des tickets Linear` | `Buscar incidencias de Linear` | `Linear-Tickets suchen` |
| `Show issues` | `Afficher les tickets` | `Mostrar incidencias` | `Tickets anzeigen` |
| `No issues found.` | `Aucun ticket trouvé.` | `No se encontraron incidencias.` | `Keine Tickets gefunden.` |
| `Select all` | `Tout sélectionner` | `Seleccionar todo` | `Alle auswählen` |
| `Already imported` | `Déjà importé` | `Ya importado` | `Bereits importiert` |
| `Showing the first 100. Narrow the query.` | `Seuls les 100 premiers sont affichés. Affinez la requête.` | `Se muestran los 100 primeros. Acota la consulta.` | `Die ersten 100 werden angezeigt. Grenze die Abfrage ein.` |
| `Import :count tasks` | `Importer :count tâches` | `Importar :count tareas` | `:count Aufgaben importieren` |
| `:imported imported, :skipped skipped.` | `:imported importées, :skipped ignorées.` | `:imported importadas, :skipped omitidas.` | `:imported importiert, :skipped übersprungen.` |
| `More task actions` | `Autres actions sur les tâches` | `Más acciones de tareas` | `Weitere Aufgabenaktionen` |
| `Refresh from :source` | `Actualiser depuis :source` | `Actualizar desde :source` | `Aus :source aktualisieren` |
| `:count tasks refreshed.` | `:count tâches actualisées.` | `:count tareas actualizadas.` | `:count Aufgaben aktualisiert.` |
| `:count tasks were not found in :source.` | `:count tâches sont introuvables dans :source.` | `No se encontraron :count tareas en :source.` | `:count Aufgaben wurden in :source nicht gefunden.` |

- [ ] **Step 4: Check types and lint**

Run: `npm run types:check && npm run check`
Expected: no new errors. Format with `npx vp check --fix resources/js/components/poker/import-tasks-dialog.tsx resources/js/components/poker/tasks-pane.tsx`.

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add resources/js/components/poker lang
git commit -m "feat: import poker tasks from Jira and Linear and refresh them

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 10: Verification

**Files:** none created; fixes only if a check fails.

- [ ] **Step 1: Run the narrow suites**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Integrations tests/Feature/Integrations tests/Feature/Poker tests/Feature/Mcp tests/Feature/TranslationKeysTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS.

- [ ] **Step 2: Static checks**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: no changes left by Pint, phpstan 0 errors.

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check && npm run build`
Expected: only the known pre-existing lint failures; the build succeeds.

- [ ] **Step 3: Check every acceptance criterion this plan owns**

| Criterion (spec 6 §16 / spec 5) | Evidence |
|---|---|
| 7 — import by sprint/JQL and cycle/search with title, description, assignee, source estimate; duplicates skipped; 200 limit; refresh | `PokerImportBrowsingTest`, `PokerImportTest` |
| 8 — automatic write-back (Jira story points field, Linear 0–64 whole numbers and zero rule), T-shirt never syncs, failures shown with retry that can force | `PokerEstimateSyncTest`, `PokerTaskExternalTest`; walkthrough steps 4–6 |
| 10 — outbound calls server-side, queued write-back with §12 retries | `PokerEstimateSyncTest` ("is a unique, retried job", rate limit, unavailable) |
| 11 — the four MCP tools use the same services and checks | `TrackerToolsTest`, `CatalogueTest`, `McpSweepTest` |
| 12 — translations, suite, phpstan, type-check, lint, no dependency | Steps 1–2, `TranslationKeysTest`; `git diff main -- composer.json package.json` shows no change |
| Guests get the reduced `external`, never import | `PokerTaskExternalTest`, `PokerImportBrowsingTest`, `PokerImportTest` |

- [ ] **Step 4: Ask for the full suite**

Ask the user to run `vendor/bin/sail artisan test --compact` and report the result before the branch is reviewed.

- [ ] **Step 5: Manual walkthrough (with the user, real Jira Cloud and Linear test workspaces)**

1. Connect Jira (read and write) and Linear (read and write) to a team (Plan 12a), then open a Fibonacci poker game of that team.
2. Click "Import", choose a Jira board and an active sprint, "Show issues", keep all selected, import: the tasks appear in sprint order with their `PROJ-n` chips; a second import of the same sprint shows them as "Already imported".
3. Import a Linear cycle and a Linear search the same way; open a task: key link, assignee, "Linear estimate: n", managed notice, no Edit button.
4. Vote, reveal and set 5 on a Jira task: the badge goes "Sync pending" then "Synced to Jira" (queue worker running); Jira shows 5 story points.
5. Set ½ on a Linear task in a Modified Fibonacci game: "Sync failed" with "Linear only accepts whole-number estimates." and a Retry button; set 1 instead: synced.
6. In a T-shirt game, estimate an imported task: "Not synced: T-shirt estimates can't be written to Jira."
7. Rename an issue in Jira, then "Refresh from Jira": the title changes; delete an issue in Jira and refresh: the toast says one task was not found.
8. Open the game as a guest in another browser: key chips only, no import button, no assignee or sync state.
9. From Claude Code with an MCP token: `poker.sources.list`, `poker.iterations.list` (without and with a board id), `poker.game.tasks.import` with a JQL query, `poker.game.task.sync` on the Jira task.

- [ ] **Step 6: Commit any fix**

If a step needed a fix, commit it with a Conventional Commit message ending with the two trailer lines of the Global Constraints.
