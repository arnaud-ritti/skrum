# Plan 16c — Retro flow extras walkthroughs (plans 8a to 8e) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate the walkthroughs of plans 8a (flow and templates), 8b (health check), 8c (surveys), 8d (results) and 8e (LLM features) as browser tests, with the LLM provider faked in process.

**Architecture:** Browser tests live in `tests/Browser/Walkthroughs`, one file per walkthrough, bound to `Tests\BrowserTestCase` (built assets, a Reverb server started by the suite, authentication reset after every request so several browser contexts act as different users). Each walkthrough step maps to a test whose title starts with the step's identifier; the mapping is recorded in `docs/superpowers/walkthroughs/coverage.md`, and what cannot be automated in `residual-manual-checklist.md`. Tests sign in and join through the real interface, wait on `data-realtime` instead of sleeping, and arrange their own state with factories.

**Tech Stack:** PHP 8.4, Laravel 13, Pest 5 with `pestphp/pest-plugin-browser` 5.x (Playwright, Chromium), Laravel Reverb, Inertia v3 with React 19, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md` (this plan is one of its "later slices", §1). Read it, and read `docs/superpowers/walkthroughs/harness-findings.md`: it holds the facts proven by running the browser plugin against this application, and it overrides this plan's text where they differ.

**Depends on:** Plan 16a merged, and plan 16b Task 1 (`$this->workQueue()` in `InteractsWithBrowser`).

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
- The LLM provider is faked with `Http::fake()`; LLM features are switched on per test with `config([...])` (`services.llm.*`, read by `App\Support\Llm\Llm::isConfigured()`). No real key is ever used.
- Tests that run queued jobs set `config(['queue.default' => 'database'])` and call `$this->workQueue()`.

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
| 1 | Flow and templates walkthrough, creation dialog and workspace templates (plan 8a, steps 1 and 7) |
| 2 | Flow and templates walkthrough, Icebreaker phase, redaction, settings errors and automatic vote limit (plan 8a, steps 2 to 6) |
| 3 | Health check walkthrough (plan 8b) |
| 4 | Surveys walkthrough, part 1 (creating and answering the three survey kinds) |
| 5 | Surveys walkthrough, part 2 (close, show who answered, discussion, withdraw, completed and reopened retro) |
| 6 | Results walkthrough (group names, ROTI, the Results view, live refresh, reduced motion) |
| 7 | LLM features walkthrough, without a provider (plan 8e, Step 2) and the configuration switch |
| 8 | LLM features walkthrough, with a provider (plan 8e, Step 3) |
| 9 | Coverage table and residual checklist |
| 10 | Final verification |

## Review Focus

Conditions the spec implies that a happy-path reading could miss, each pinned by a test.

1. With no LLM configured, no LLM control appears anywhere and every screen works. Pinned by the "without a key" tests of Task 7.
2. A request to the LLM carries no author name and no hidden content. Expected: `Http::assertSent` on the request body. Pinned by the summary tests of Task 8.
3. Another participant's health score never reaches a browser. Expected: absent from the DOM and from the snapshot fetched in the page. Pinned by the snapshot test of Task 3.
4. A setting changed from a stale dialog is refused with the translated message, and the board resyncs. Pinned by the stale-dialog test of Task 2.
5. A provider failure ends in a visible failed state with a retry, never an endless pending state; a pending summary older than ten minutes reads as failed. Pinned by the failure and stale-summary tests of Task 8.

---

### Task 1: Flow and templates walkthrough, creation dialog and workspace templates (plan 8a, steps 1 and 7)

This task automates steps 1 and 7 of the plan 8a walkthrough (`docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md`, lines 6295 and 6301): the creation dialog with its template catalogue, and the workspace templates page for a member and for an Owner. No product file changes, so no frontend build is needed beyond the existing `public/build`.

Facts about the interface that the selectors rely on (all read from the current code):

- The creation dialog is `resources/js/components/teams/new-retro-dialog.tsx`. The title input is `#new-retro-title`; the search field is `<input type="search" aria-label="Search templates">`; the category chips are buttons with `aria-pressed` inside `<div role="group" aria-label="Category">`, "All" first; every template is a `<li><button aria-pressed>` inside the dialog, so `[role="dialog"] li button` counts the visible templates. The catalogue has 52 built-in templates plus "Custom" (`app/Support/RetroTemplates/TemplateCatalogue.php`), so the list has 53 buttons under "All", and 9 under "Themed & fun".
- The search matches the template name and its column titles only. "sail" matches one template, "Sailboat".
- "Custom" has no category and shows "Empty board" instead of column titles; it is the only item with that text.
- The preview is the `<div>` whose direct child is `<h3>Preview</h3>`. Each column is a `<li>` with a colour swatch `<span>` (`bg-emerald-500`, `bg-rose-500`, `bg-sky-500`, `bg-amber-500`, `bg-violet-500`, `bg-slate-500`, from `resources/js/lib/retro/colors.ts`), its title and its description.
- The "Settings" block of the dialog is a collapsible; its checkboxes are Radix buttons with ids `#new-retro-health-check`, `#new-retro-icebreaker` and `#new-retro-votes-auto`, each carrying `aria-checked`. The only `type="submit"` button of the dialog is "Start".
- The stepper is `<ol aria-label="Phases">` in the board header; the current step carries `aria-current="step"`.
- The templates page is `resources/js/pages/workspaces/templates.tsx`. A template is a `<li>` with its name, a category badge and column chips; "Edit" and "Delete" buttons exist only when `canManage` is true, and so does the "New template" button. The editor dialog has `#template-source` (Radix select "Start from a built-in template", present once the optional `catalogue` prop has loaded), `#template-name`, `#template-category` (Radix select), and one `<div>` per column as direct children of the `<fieldset>`, each with `aria-label="Column title"`, `"Move up"`, `"Move down"` and `"Remove column"`.
- The sidebar link to the templates page is the only link whose `href` ends with `/templates` (`resources/js/components/app-sidebar.tsx`).
- The plugin treats text that contains a comma, parentheses or `&` inside a CSS selector normally, but a bare text such as `Start, Stop, Continue` cannot be passed to `click()`; the tests use `:has-text("…")`.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php`
- Test: `tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` bound to `tests/Browser`, with `$this->signIn(User $user, string $to): mixed`.
  - Existing helpers in `tests/Pest.php`: `teamMember(Team $team): User`, `workspaceManager(Workspace $workspace, WorkspaceRole $role = WorkspaceRole::Admin): User`, `retroFacilitator(Retro $retro): array{0: User, 1: Participant}`.
  - Factories: `WorkspaceTemplateFactory`, `WorkspaceTemplateColumnFactory`, `RetroFactory`, `ColumnFactory`, `TeamFactory`.
  - Existing hook `data-test="retro-column-{id}"` on the board column (`resources/js/components/retro/retro-column.tsx`).
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php` (global functions; other files must not redeclare them): `p08aMember(Team $team, string $name = 'Alice Martin'): User`, `p08aOwner(Team $team, string $name = 'Olivia Owner'): User`, `p08aTeamPath(Team $team): string`, `p08aTemplate(Workspace $workspace): WorkspaceTemplate`, `p08aPhaseOrder(): string`, `p08aColumnTitles(): string`.
  - No new `data-test` hook.

- [ ] **Step 1: Create the test file with its helpers and the creation dialog tests (step 1)**

`php artisan make:test` cannot create files under `tests/Browser`, so create `tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php` directly with this content:

```php
<?php

use App\Enums\ColumnColor;
use App\Enums\RetroPhase;
use App\Enums\TemplateCategory;
use App\Enums\WorkspaceRole;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;

function p08aMember(Team $team, string $name = 'Alice Martin'): User
{
    $user = teamMember($team);

    $user->update(['name' => $name, 'locale' => 'en']);

    return $user;
}

function p08aOwner(Team $team, string $name = 'Olivia Owner'): User
{
    $user = workspaceManager($team->workspace, WorkspaceRole::Owner);

    $user->update(['name' => $name, 'locale' => 'en']);

    return $user;
}

function p08aTeamPath(Team $team): string
{
    return route('teams.show', [$team->workspace, $team], false);
}

function p08aTemplate(Workspace $workspace): WorkspaceTemplate
{
    $template = WorkspaceTemplate::factory()->create([
        'workspace_id' => $workspace->id,
        'name' => 'Team pulse',
        'category' => TemplateCategory::TeamMood,
    ]);

    $columns = [
        ['Energy', 'How much energy the sprint left us', ColumnColor::Green],
        ['Blockers', 'What kept slowing us down', ColumnColor::Red],
    ];

    foreach ($columns as $position => [$title, $description, $color]) {
        WorkspaceTemplateColumn::factory()->create([
            'workspace_template_id' => $template->id,
            'title' => $title,
            'description' => $description,
            'color' => $color,
            'position' => $position,
        ]);
    }

    return $template->fresh();
}

function p08aPhaseOrder(): string
{
    return "[...document.querySelectorAll('header ol[aria-label=\"Phases\"] li')].map((step) => step.textContent).join(' > ')";
}

function p08aColumnTitles(): string
{
    return "[...document.querySelectorAll('[data-test^=\"retro-column-\"] h2')].map((title) => title.textContent).join(' | ')";
}

it('[P08a-01a] prefills the title and filters the template catalogue by search and by category', function () {
    $team = Team::factory()->create();
    $alice = p08aMember($team);
    $templates = '[role="dialog"] li button';
    $all = '[role="dialog"] [aria-label="Category"] button:first-child';
    $themed = '[role="dialog"] [aria-label="Category"] button:has-text("Themed & fun")';
    $search = '[aria-label="Search templates"]';
    $preview = '[role="dialog"] div:has(> h3:has-text("Preview"))';
    $prefilledTitle = "document.querySelector('#new-retro-title').value === 'Retro ' + new Date().toLocaleDateString('en', { dateStyle: 'medium' })";
    $swatches = "[...[...document.querySelectorAll('[role=\"dialog\"] h3')].find((heading) => heading.textContent === 'Preview').parentElement.querySelectorAll('li > span')].map((swatch) => [...swatch.classList].find((name) => name.startsWith('bg-'))).join(',')";

    $page = $this->signIn($alice, p08aTeamPath($team));

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->assertScript($prefilledTitle, true)
        ->assertSeeIn('[role="dialog"]', 'Common templates')
        ->assertSeeIn('[role="dialog"]', 'More templates')
        ->assertCount($templates, 53)
        ->assertCount("{$templates}:has-text(\"Empty board\")", 1)
        ->assertAttribute($all, 'aria-pressed', 'true');

    $page->fill($search, 'sail')
        ->assertCount($templates, 1)
        ->assertSeeIn($templates, 'Sailboat')
        ->assertSeeIn($templates, 'Themed & fun')
        ->assertSeeIn($templates, 'What anchors are holding us back?')
        ->assertSeeIn($preview, 'Sailboat')
        ->assertCount("{$preview} li", 4)
        ->assertSeeIn($preview, 'What anchors are holding us back?')
        ->assertSeeIn($preview, 'What slows us down and adds drag every sprint')
        ->assertSeeIn($preview, 'What is our ideal island destination?')
        ->assertScript($swatches, 'bg-emerald-500,bg-rose-500,bg-amber-500,bg-sky-500');

    $page->fill($search, 'no such template')
        ->assertSeeIn('[role="dialog"]', 'No templates match your search.')
        ->assertNotPresent($templates)
        ->fill($search, '')
        ->assertCount($templates, 53);

    $page->click($themed)
        ->assertAttribute($themed, 'aria-pressed', 'true')
        ->assertAttribute($all, 'aria-pressed', 'false')
        ->assertCount($templates, 9)
        ->assertCount("{$templates}:has-text(\"Sailboat\")", 1)
        ->assertNotPresent("{$templates}:has-text(\"Empty board\")")
        ->assertNotPresent("{$templates}:has-text(\"Start, Stop, Continue\")")
        ->click($all)
        ->assertCount($templates, 53)
        ->click("{$templates}:has-text(\"Empty board\")")
        ->assertSeeIn($preview, 'Custom')
        ->assertSeeIn($preview, 'Start with an empty board and add your own columns.');

    expect(Retro::query()->count())->toBe(0);
});

it('[P08a-01b] starts a retro in the Icebreaker phase with the automatic vote limit from the creation dialog', function () {
    $team = Team::factory()->create();
    $alice = p08aMember($team);
    $templates = '[role="dialog"] li button';

    $page = $this->signIn($alice, p08aTeamPath($team));

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 14 retro')
        ->fill('[aria-label="Search templates"]', 'sail')
        ->assertCount($templates, 1)
        ->click($templates)
        ->assertAttribute($templates, 'aria-pressed', 'true')
        ->click('[role="dialog"] button:has-text("Settings")')
        ->assertVisible('#new-retro-icebreaker')
        ->assertAttribute('#new-retro-icebreaker', 'aria-checked', 'false')
        ->assertAttribute('#new-retro-health-check', 'aria-checked', 'false')
        ->assertAttribute('#new-retro-votes-auto', 'aria-checked', 'true')
        ->assertSeeIn('[role="dialog"]', 'Automatic: number of cards plus 3, at most 10.')
        ->click('#new-retro-icebreaker')
        ->assertAttribute('#new-retro-icebreaker', 'aria-checked', 'true')
        ->assertVisible('#new-retro-icebreaker-game')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header > h1', 'Sprint 14 retro')
        ->assertSeeIn('[aria-current="step"]', 'Icebreaker')
        ->assertScript(p08aPhaseOrder(), 'Icebreaker > Writing > Grouping > Voting > Discussing > Completed')
        ->assertPresent('section[aria-label="Icebreaker game"]')
        ->assertPresent('[aria-label="Facilitator menu"]');

    $retro = Retro::query()->where('title', 'Sprint 14 retro')->firstOrFail();

    expect($retro->template)->toBe('sailboat')
        ->and($retro->phase)->toBe(RetroPhase::Icebreaker)
        ->and($retro->icebreaker_enabled)->toBeTrue()
        ->and($retro->health_check_enabled)->toBeFalse()
        ->and($retro->votes_per_participant)->toBeNull()
        ->and($retro->facilitator->user_id)->toBe($alice->id)
        ->and($retro->columns->pluck('title')->all())->toBe([
            'What is the wind pushing our sails that makes us go fast?',
            'What anchors are holding us back?',
            'What rocks are ahead of us that risk our future?',
            'What is our ideal island destination?',
        ])
        ->and($retro->columns->pluck('description')->all())->toBe([
            'What pushed us forward and we could repeat on purpose',
            'What slows us down and adds drag every sprint',
            'Risks ahead that will hurt us if nothing changes',
            'The goal we are sailing to — agree on this before the rest',
        ]);
});
```

`[P08a-01a]` checks the colours of the preview through the swatch classes. `[P08a-01b]` ends on the Icebreaker phase of the new board, which is where step 2 of the walkthrough starts; the content of that phase is covered in Task 2.

- [ ] **Step 2: Run the creation dialog tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php --filter='P08a-01'`
Expected: PASS (2 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If the preview selector `div:has(> h3:has-text("Preview"))` or the settings toggle fails, see the harness findings.

- [ ] **Step 3: Append the workspace templates tests (step 7)**

Add `use App\Models\Column;` to the imports of `tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php`, between `use App\Enums\WorkspaceRole;` and `use App\Models\Retro;`. Then append these tests at the end of the file:

```php
it('[P08a-07a] shows the workspace templates to a member as a read-only list', function () {
    $team = Team::factory()->create();
    $alice = p08aMember($team);
    p08aTemplate($team->workspace);
    $row = 'li:has-text("Team pulse")';

    $page = $this->signIn($alice, p08aTeamPath($team));

    $page->assertPresent('a[href$="/templates"]')
        ->click('a[href$="/templates"]')
        ->assertPathIs("/w/{$team->workspace->slug}/templates")
        ->assertSee('Templates shared by every team of this workspace')
        ->assertSeeIn($row, 'Team pulse')
        ->assertSeeIn($row, 'Team & mood')
        ->assertSeeIn($row, 'Energy')
        ->assertSeeIn($row, 'Blockers')
        ->assertNotPresent("{$row} button")
        ->assertNotPresent('button:has-text("New template")');

    expect(WorkspaceTemplate::query()->count())->toBe(1);
});

it('[P08a-07b] lets an Owner create a workspace template from a built-in one', function () {
    $team = Team::factory()->create();
    $olivia = p08aOwner($team);
    $row = 'li:has-text("Team pulse")';
    $titles = "[...document.querySelectorAll('[role=\"dialog\"] [aria-label=\"Column title\"]')].map((input) => input.value).join(' | ')";
    $moveFirstDown = '[role="dialog"] fieldset > div:nth-of-type(1) [aria-label="Move down"]';
    $removeThird = '[role="dialog"] fieldset > div:nth-of-type(3) [aria-label="Remove column"]';

    $page = $this->signIn($olivia, "/w/{$team->workspace->slug}/templates");

    $page->assertSee('No workspace templates yet.')
        ->click('button:has-text("New template")')
        ->assertVisible('#template-name')
        ->assertVisible('#template-source')
        ->click('#template-source')
        ->assertPresent('[role="listbox"]')
        ->click('[role="option"]:has-text("Start, Stop, Continue")')
        ->assertNotPresent('[role="listbox"]')
        ->assertValue('#template-name', 'Start, Stop, Continue')
        ->assertScript($titles, 'Start | Stop | Continue');

    $page->fill('#template-name', 'Team pulse')
        ->click('#template-category')
        ->assertPresent('[role="listbox"]')
        ->click('[role="option"]:has-text("Team & mood")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('#template-category', 'Team & mood')
        ->click($moveFirstDown)
        ->assertScript($titles, 'Stop | Start | Continue')
        ->click($removeThird)
        ->assertScript($titles, 'Stop | Start')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertSee('Template saved.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($row, 'Team & mood')
        ->assertSeeIn($row, 'Stop')
        ->assertSeeIn($row, 'Start')
        ->assertDontSeeIn($row, 'Continue')
        ->assertPresent("{$row} button:has-text(\"Edit\")")
        ->assertPresent("{$row} button:has-text(\"Delete\")");

    $template = WorkspaceTemplate::query()->where('name', 'Team pulse')->firstOrFail();

    expect($template->workspace_id)->toBe($team->workspace_id)
        ->and($template->category)->toBe(TemplateCategory::TeamMood)
        ->and($template->created_by_user_id)->toBe($olivia->id)
        ->and($template->columns->pluck('title')->all())->toBe(['Stop', 'Start'])
        ->and($template->columns->pluck('description')->all())->toBe([
            'Habits that get in the way and should end now',
            'New practices worth trying in the next cycle',
        ]);
});

it('[P08a-07c] starts a retro from a workspace template found under its category', function () {
    $team = Team::factory()->create();
    $alice = p08aMember($team);
    $template = p08aTemplate($team->workspace);
    $templates = '[role="dialog"] li button';
    $preview = '[role="dialog"] div:has(> h3:has-text("Preview"))';
    $firstTemplate = "document.querySelector('[role=\"dialog\"] li button').innerText.includes('Team pulse')";

    $page = $this->signIn($alice, p08aTeamPath($team));

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Pulse check')
        ->assertSeeIn('[role="dialog"]', 'Workspace templates')
        ->assertCount($templates, 54)
        ->click('[role="dialog"] [aria-label="Category"] button:has-text("Team & mood")')
        ->assertCount($templates, 9)
        ->assertScript($firstTemplate, true)
        ->click("{$templates}:has-text(\"Team pulse\")")
        ->assertAttribute("{$templates}:has-text(\"Team pulse\")", 'aria-pressed', 'true')
        ->assertSeeIn($preview, 'Team pulse')
        ->assertSeeIn($preview, 'How much energy the sprint left us')
        ->assertSeeIn($preview, 'What kept slowing us down')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header > h1', 'Pulse check')
        ->assertCount('[data-test^="retro-column-"]', 2)
        ->assertScript(p08aColumnTitles(), 'Energy | Blockers')
        ->assertSee('How much energy the sprint left us')
        ->assertSee('What kept slowing us down');

    $retro = Retro::query()->where('title', 'Pulse check')->firstOrFail();

    expect($retro->template)->toBe('workspace')
        ->and($retro->workspace_template_id)->toBe($template->id)
        ->and($retro->phase)->toBe(RetroPhase::Writing)
        ->and($retro->columns->pluck('title')->all())->toBe(['Energy', 'Blockers'])
        ->and($retro->columns->pluck('description')->all())->toBe([
            'How much energy the sprint left us',
            'What kept slowing us down',
        ]);
});

it('[P08a-07d] keeps the columns of a retro when its workspace template is deleted', function () {
    $team = Team::factory()->create();
    $olivia = p08aOwner($team);
    $template = p08aTemplate($team->workspace);
    $retro = Retro::factory()->create([
        'team_id' => $team->id,
        'title' => 'Pulse check',
        'template' => 'workspace',
        'workspace_template_id' => $template->id,
    ]);

    foreach (['Energy', 'Blockers'] as $position => $title) {
        Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'position' => $position,
        ]);
    }

    retroFacilitator($retro);
    $row = 'li:has-text("Team pulse")';

    $page = $this->signIn($olivia, "/w/{$team->workspace->slug}/templates");

    $page->assertSeeIn($row, 'Energy')
        ->click("{$row} button:has-text(\"Delete\")")
        ->assertSeeIn('[role="dialog"]', 'Delete this template?')
        ->assertSeeIn('[role="dialog"]', 'Retrospectives created from it keep their columns.')
        ->click('[role="dialog"] button:has-text("Delete")')
        ->assertSee('Template deleted.')
        ->assertSee('No workspace templates yet.')
        ->navigate("/retros/{$retro->id}")
        ->assertSeeIn('header > h1', 'Pulse check')
        ->assertCount('[data-test^="retro-column-"]', 2)
        ->assertScript(p08aColumnTitles(), 'Energy | Blockers');

    expect(WorkspaceTemplate::query()->whereKey($template->id)->exists())->toBeFalse()
        ->and($retro->fresh()->workspace_template_id)->toBeNull()
        ->and($retro->fresh()->template)->toBe('workspace')
        ->and($retro->columns()->count())->toBe(2);
});
```

`[P08a-07c]` and `[P08a-07d]` arrange the "Team pulse" template with factories instead of reusing the one `[P08a-07b]` creates, so that each test stands alone. `[P08a-07d]` arranges the retro "created from it" with factories (`template = workspace`, `workspace_template_id` set), which is the state `CreateRetro` leaves.

- [ ] **Step 4: Run the workspace templates tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php --filter='P08a-07'`
Expected: PASS (4 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If the sidebar link `a[href$="/templates"]` matches more than one element, or a Radix select does not open, see the harness findings.

- [ ] **Step 5: Format and check**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `vendor/bin/phpstan analyse --no-progress`
Expected: no error.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector` and keep its result.

- [ ] **Step 6: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php
git commit -m "test(browser): cover the flow and templates walkthrough: creation dialog and workspace templates"
```

### Task 2: Flow and templates walkthrough, Icebreaker phase, redaction, settings errors and automatic vote limit (plan 8a, steps 2 to 6)

This task automates steps 2 to 6 of the plan 8a walkthrough (lines 6296 to 6300 of the plan 8a file) in the file Task 1 created. The product has moved on since that walkthrough was written, and the tests follow today's interface and the feature spec (`docs/superpowers/specs/2026-09-29-retro-flow-extras-design.md`, §2 and §7.1):

- The Icebreaker phase no longer shows the "Warm-up" question. Spec §2.5 says the game panel of the games spec replaces it, and `resources/js/components/retro/board.tsx` renders `IcebreakerStage` instead of the columns while the phase is `icebreaker`. `[P08a-02a]` therefore asserts the game stage (`<section aria-label="Icebreaker game">`), the same game name in both browsers and the shared timer. The games themselves belong to the plan 13 walkthroughs.
- Because the columns are not rendered during Icebreaker, "the facilitator adds a column with a description; the guest sees it" is checked in Writing (`[P08a-02b]`), and "Previous → Icebreaker: the other browser's cards are hidden again" is checked as: hidden again in Writing after a return from Grouping, then absent from the whole document in Icebreaker, then still hidden when Writing is entered again (`[P08a-03]`).
- The add-column form has a title and a colour only; a description is set through the column menu, "Edit description".
- The settings dialog disables the Icebreaker checkbox while the retro is in Icebreaker (`settings-dialog.tsx`: `disabled={engagementLocked || retro.phase === 'icebreaker'}`), so the message "Move to another phase before turning this phase off." can only come from the server when the dialog is stale. `[P08a-04a]` asserts the disabled checkbox; `[P08a-04b]` opens the dialog in Writing, moves the retro to Icebreaker through the model without a broadcast (the way `[P04-13]` arranges a refused vote), saves, and asserts the message in the dialog.

Other facts the selectors rely on:

- Phase buttons: `header button:has-text("Next")` and `header button:has-text("Previous")`. The header scope matters: the icebreaker game has its own "Next round" button.
- Settings dialog (`settings-dialog.tsx`): Radix checkboxes `#retro-icebreaker`, `#retro-health-check`, `#retro-votes-auto` with `aria-checked`; the only `type="submit"` button is "Save"; a refused save shows the server's message inside the dialog and leaves it open.
- Column menu (`column-header.tsx`): trigger `[aria-label="Column menu"]` (facilitator only, phases Health check, Icebreaker and Writing); items are `[role="menuitem"]` ("Rename", "Edit description", "Move left", "Move right", "Delete column"), the colour swatches are `[role="menuitemradio"]`; a disabled item carries `aria-disabled="true"`. "Edit description" opens a dialog titled "Column description" with one `<textarea>`.
- Vote counter (`vote-progress.tsx`): "Votes left: N" and "C of T votes cast", where T is the number of participants times the limit.
- Starting the timer during Icebreaker also schedules the icebreaker expiry job (`RetroTimersController`); `[P08a-02a]` switches to the `database` queue first so that job is stored and not run.

**Files:**
- Modify: `tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php`
- Test: `tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn(User $user, string $to): mixed`, `$this->joinAsGuest(string $joinUrl, string $name): mixed`, `$this->awaitRealtime(mixed $page): mixed`.
  - `data-realtime` on the root of `retros/show`; `data-test="retro-column-{id}"` on the board column.
  - Existing helpers in `tests/Pest.php`: `retroFacilitator(Retro $retro): array{0: User, 1: Participant}`, `retroMember(Retro $retro): array{0: User, 1: Participant}`.
  - Factory states: `RetroFactory::inPhase(RetroPhase $phase)`, `withIcebreaker()`, `withGuestAccess()`.
  - Helpers of Task 1 in the same file: `p08aPhaseOrder(): string`.
- Produces:
  - File-level helpers: `p08aBoard(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array`, `p08aCard(Retro $retro, Column $column, Participant $author, string $content, int $position = 0): Card`, `p08aColumn(Column $column): string`, `p08aOpenSettings(mixed $page): mixed`.
  - No new `data-test` hook.

- [ ] **Step 1: Add the board helpers**

In `tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php`, add these two imports, `use App\Models\Card;` before `use App\Models\Column;` and `use App\Models\Participant;` between `use App\Models\Column;` and `use App\Models\Retro;`, so that the model imports read:

```php
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;
```

Then insert these functions after `p08aColumnTitles()` and before the first `it(`:

```php
/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: array<int, Column>,
 *     2: User,
 *     3: User,
 *     4: Participant,
 *     5: Participant
 * }
 */
function p08aBoard(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->withIcebreaker()
        ->withGuestAccess()
        ->create(['title' => 'Sprint 14', ...$attributes]);

    $columns = [];

    foreach (['Start', 'Stop', 'Continue'] as $position => $title) {
        $columns[] = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'position' => $position,
        ]);
    }

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $columns, $alice, $bob, $aliceParticipant, $bobParticipant];
}

function p08aCard(Retro $retro, Column $column, Participant $author, string $content, int $position = 0): Card
{
    return Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => $content,
        'position' => $position,
    ]);
}

function p08aColumn(Column $column): string
{
    return "[data-test=\"retro-column-{$column->id}\"]";
}

function p08aOpenSettings(mixed $page): mixed
{
    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSeeIn('[role="dialog"]', 'Retrospective settings')
        ->assertNotPresent('[role="menu"]');

    return $page;
}
```

Every board of this file has the Icebreaker enabled (`withIcebreaker()`), so the stepper reads "Icebreaker, Writing, …" in every phase.

- [ ] **Step 2: Append the Icebreaker phase and redaction tests (steps 2 and 3)**

Append at the end of the file:

```php
it('[P08a-02a] shows the Icebreaker phase with its game and the shared timer to the facilitator and a guest', function () {
    [$retro, , $alice] = p08aBoard(RetroPhase::Icebreaker);
    config(['queue.default' => 'database']);
    $stage = 'section[aria-label="Icebreaker game"]';
    $isCountingDown = "/^(1:00|0:[3-5]\\d)$/.test(document.querySelector('[role=\"timer\"]').innerText.trim())";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Icebreaker')
            ->assertScript(p08aPhaseOrder(), 'Icebreaker > Writing > Grouping > Voting > Discussing > Completed')
            ->assertPresent($stage)
            ->assertNotPresent('[data-test^="retro-column-"]')
            ->assertNotPresent('[role="timer"]');
    }

    $alicePage->assertSeeIn('[aria-label="Game"]', 'Draw & Guess')
        ->assertPresent('header button:has-text("Next")')
        ->assertNotPresent('header button:has-text("Previous")');
    $carolPage->assertSeeIn($stage, 'Draw & Guess')
        ->assertNotPresent('[aria-label="Game"]')
        ->assertNotPresent('header button:has-text("Next")');

    $alicePage->click('[aria-label="Timer"]')
        ->assertPresent('[role="menu"]')
        ->click('[role="menuitem"]:has-text("1 min")')
        ->assertNotPresent('[role="menu"]');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertPresent('[role="timer"]')->assertScript($isCountingDown, true);
    }

    expect($retro->fresh()->timer_ends_at)->not->toBeNull()
        ->and($retro->fresh()->phase)->toBe(RetroPhase::Icebreaker);
});

it('[P08a-02b] shows a column and its description added by the facilitator to a guest', function () {
    [$retro, , $alice] = p08aBoard();
    $columns = '[data-test^="retro-column-"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertCount($columns, 3)
        ->assertNotPresent('input[aria-label="Column title"]');

    $alicePage->assertVisible('input[aria-label="Column title"]')
        ->fill('input[aria-label="Column title"]', 'Kudos')
        ->click('button:has-text("Add column")')
        ->assertCount($columns, 4);

    $column = Column::query()->where('retro_id', $retro->id)->where('title', 'Kudos')->firstOrFail();
    $kudos = p08aColumn($column);

    $carolPage->assertCount($columns, 4)
        ->assertSeeIn("{$kudos} h2", 'Kudos');

    $alicePage->click("{$kudos} [aria-label=\"Column menu\"]")
        ->assertPresent('[role="menu"]')
        ->click('[role="menuitem"]:has-text("Edit description")')
        ->assertSeeIn('[role="dialog"]', 'Column description')
        ->fill('[role="dialog"] textarea', 'Thank a teammate for something specific')
        ->click('[role="dialog"] button:has-text("Save")')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($kudos, 'Thank a teammate for something specific');

    $carolPage->assertSeeIn($kudos, 'Thank a teammate for something specific')
        ->assertNotPresent('[aria-label="Column menu"]');

    expect($column->fresh()->description)->toBe('Thank a teammate for something specific')
        ->and($column->fresh()->position)->toBe(3);
});

it('[P08a-03] hides the cards of others again each time the retro moves back to Writing or to Icebreaker', function () {
    [$retro, $columns, $alice] = p08aBoard(RetroPhase::Icebreaker);
    $start = p08aColumn($columns[0]);
    $composer = "{$start} textarea";
    $add = "{$start} form button:not([type=\"button\"])";
    $next = 'header button:has-text("Next")';
    $previous = 'header button:has-text("Previous")';
    $current = '[aria-current="step"]';
    $stage = 'section[aria-label="Icebreaker game"]';
    $aliceCard = 'Ship smaller pull requests';
    $carolCard = 'Keep the demo on Fridays';
    $inDocument = fn (string $text): string => "document.documentElement.outerHTML.includes(\"{$text}\")";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->assertPresent($stage)
        ->click($next)
        ->assertSeeIn($current, 'Writing');
    $carolPage->assertSeeIn($current, 'Writing')
        ->assertCount('[aria-label="Add a card…"]', 3);

    $alicePage->fill($composer, $aliceCard)
        ->click($add)
        ->assertSee($aliceCard);
    $carolPage->assertSee('Hidden until writing ends')
        ->fill($composer, $carolCard)
        ->click($add)
        ->assertSee($carolCard)
        ->assertDontSee($aliceCard);
    $alicePage->assertCount('article[id^="card-"]', 2)
        ->assertSee('Hidden until writing ends')
        ->assertDontSee($carolCard);

    $alicePage->click($next)
        ->assertSeeIn($current, 'Grouping')
        ->assertSee($carolCard);
    $carolPage->assertSeeIn($current, 'Grouping')
        ->assertSee($aliceCard)
        ->assertDontSee('Hidden until writing ends');

    $alicePage->click($previous)
        ->assertSeeIn($current, 'Writing')
        ->assertSee('Hidden until writing ends')
        ->assertSee($aliceCard)
        ->assertDontSee($carolCard)
        ->assertScript($inDocument($carolCard), false);
    $carolPage->assertSeeIn($current, 'Writing')
        ->assertSee('Hidden until writing ends')
        ->assertSee($carolCard)
        ->assertDontSee($aliceCard)
        ->assertScript($inDocument($aliceCard), false);

    $alicePage->click($previous)
        ->assertSeeIn($current, 'Icebreaker')
        ->assertPresent($stage)
        ->assertNotPresent('[data-test^="retro-column-"]')
        ->assertScript($inDocument($carolCard), false);
    $carolPage->assertSeeIn($current, 'Icebreaker')
        ->assertPresent($stage)
        ->assertNotPresent('[data-test^="retro-column-"]')
        ->assertScript($inDocument($aliceCard), false);

    $alicePage->click($next)
        ->assertSeeIn($current, 'Writing')
        ->assertSee($aliceCard)
        ->assertSee('Hidden until writing ends')
        ->assertDontSee($carolCard);
    $carolPage->assertSeeIn($current, 'Writing')
        ->assertSee($carolCard)
        ->assertSee('Hidden until writing ends')
        ->assertDontSee($aliceCard);

    expect($retro->cards()->count())->toBe(2)
        ->and($retro->fresh()->phase)->toBe(RetroPhase::Writing);
});
```

- [ ] **Step 3: Run the tests of steps 2 and 3**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php --filter='P08a-02|P08a-03'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If the timer of `[P08a-02a]` or the document scan of `[P08a-03]` fails, see the harness findings.

- [ ] **Step 4: Append the settings, vote limit and column description tests (steps 4 to 6)**

Append at the end of the file:

```php
it('[P08a-04a] does not let the facilitator turn the Icebreaker off while the retro is in it', function () {
    [$retro, , $alice] = p08aBoard(RetroPhase::Icebreaker);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    p08aOpenSettings($page)
        ->assertAttribute('#retro-icebreaker', 'aria-checked', 'true')
        ->assertDisabled('#retro-icebreaker')
        ->assertEnabled('#retro-health-check');

    expect($retro->fresh()->icebreaker_enabled)->toBeTrue();
});

it('[P08a-04b] shows the refusal of the server when the Icebreaker is turned off in its own phase', function () {
    [$retro, , $alice] = p08aBoard();

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    p08aOpenSettings($page)
        ->assertEnabled('#retro-icebreaker')
        ->click('#retro-icebreaker')
        ->assertAttribute('#retro-icebreaker', 'aria-checked', 'false');

    $retro->update(['phase' => RetroPhase::Icebreaker]);

    $page->click('[role="dialog"] button[type="submit"]')
        ->assertSeeIn('[role="dialog"]', 'Move to another phase before turning this phase off.');

    expect($retro->fresh()->icebreaker_enabled)->toBeTrue();
});

it('[P08a-04c] drops the Icebreaker step for everyone when it is turned off during Writing', function () {
    [$retro, , $alice, $bob] = p08aBoard();
    $stepper = 'header ol[aria-label="Phases"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertScript(p08aPhaseOrder(), 'Icebreaker > Writing > Grouping > Voting > Discussing > Completed');
    $alicePage->assertPresent('header button:has-text("Previous")');

    p08aOpenSettings($alicePage)
        ->click('#retro-icebreaker')
        ->assertAttribute('#retro-icebreaker', 'aria-checked', 'false')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertScript(p08aPhaseOrder(), 'Writing > Grouping > Voting > Discussing > Completed')
        ->assertNotPresent('header button:has-text("Previous")');

    $bobPage->assertScript(p08aPhaseOrder(), 'Writing > Grouping > Voting > Discussing > Completed')
        ->assertDontSeeIn($stepper, 'Icebreaker')
        ->assertSeeIn('[aria-current="step"]', 'Writing');

    expect($retro->fresh()->icebreaker_enabled)->toBeFalse()
        ->and($retro->fresh()->phase)->toBe(RetroPhase::Writing);
});

it('[P08a-05] sets the automatic vote limit to the number of top-level cards plus three, at most ten', function (int $topLevelCards, int $limit) {
    [$retro, $columns, $alice, $bob, $aliceParticipant] = p08aBoard(RetroPhase::Grouping, [
        'votes_per_participant' => null,
    ]);
    $cards = [];

    foreach (range(1, $topLevelCards) as $position) {
        $cards[] = p08aCard($retro, $columns[0], $aliceParticipant, "Topic {$position}", $position);
    }

    Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $columns[0]->id,
        'participant_id' => $aliceParticipant->id,
        'parent_card_id' => $cards[0]->id,
        'content' => 'Grouped under the first topic',
    ]);
    $total = $limit * 2;

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    p08aOpenSettings($alicePage)
        ->assertAttribute('#retro-votes-auto', 'aria-checked', 'true')
        ->assertEnabled('#retro-votes-auto')
        ->assertSeeIn('[role="dialog"]', 'Automatic: number of cards plus 3, at most 10.')
        ->click('[role="dialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="dialog"]');

    $alicePage->click('header button:has-text("Next")')
        ->assertSeeIn('[aria-current="step"]', 'Voting')
        ->assertSee("Votes left: {$limit}")
        ->assertSee("0 of {$total} votes cast");
    $bobPage->assertSeeIn('[aria-current="step"]', 'Voting')
        ->assertSee("Votes left: {$limit}")
        ->assertSee("0 of {$total} votes cast");

    p08aOpenSettings($alicePage)
        ->assertAttribute('#retro-votes-auto', 'aria-checked', 'true')
        ->assertDisabled('#retro-votes-auto');

    expect($retro->fresh()->votes_per_participant)->toBeNull()
        ->and($retro->fresh()->voteLimit())->toBe($limit);
})->with([
    'two top-level cards' => [2, 5],
    'nine top-level cards' => [9, 10],
]);

it('[P08a-06] edits the description of a column that has cards and keeps Rename disabled', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = p08aBoard();
    p08aCard($retro, $columns[0], $bobParticipant, 'Pair on reviews');
    $start = p08aColumn($columns[0]);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->click("{$start} [aria-label=\"Column menu\"]")
        ->assertPresent('[role="menu"]')
        ->assertAttribute('[role="menuitem"]:has-text("Rename")', 'aria-disabled', 'true')
        ->assertAttribute('[role="menuitem"]:has-text("Delete column")', 'aria-disabled', 'true')
        ->assertSeeIn('[role="menu"]', 'Only empty columns can be renamed, recoloured or deleted.')
        ->click('[role="menuitem"]:has-text("Edit description")')
        ->assertSeeIn('[role="dialog"]', 'Column description')
        ->fill('[role="dialog"] textarea', 'What we should begin doing next sprint')
        ->click('[role="dialog"] button:has-text("Save")')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($start, 'What we should begin doing next sprint');

    $bobPage->assertSeeIn($start, 'What we should begin doing next sprint')
        ->assertSeeIn("{$start} h2", 'Start')
        ->assertNotPresent('[aria-label="Column menu"]');

    expect($columns[0]->fresh()->description)->toBe('What we should begin doing next sprint')
        ->and($columns[0]->fresh()->title)->toBe('Start');
});
```

`[P08a-05]` adds one grouped card under the first topic in both cases: only top-level cards count, so two topics give 5 votes and nine topics give 10 (the cap), not 6 and 10.

- [ ] **Step 5: Run the tests of steps 4 to 6**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php --filter='P08a-04|P08a-05|P08a-06'`
Expected: PASS (6 tests: three for step 4, two data sets for step 5, one for step 6); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 6: Format and check**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `vendor/bin/phpstan analyse --no-progress`
Expected: no error.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector` and keep its result.

- [ ] **Step 7: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php`
Expected: PASS (15 tests: 6 from Task 1, 9 from this task).

- [ ] **Step 8: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php
git commit -m "test(browser): cover the flow and templates walkthrough: icebreaker phase, redaction, settings and vote limit"
```

### Task 3: Health check walkthrough (plan 8b)

This task automates the seven steps of the plan 8b walkthrough (`docs/superpowers/plans/2026-09-30-plan-8b-health-check.md`, lines 3682 to 3688). Feature spec: `docs/superpowers/specs/2026-09-29-retro-flow-extras-design.md`, §4. No product file changes, so no frontend build is needed.

Substitutions and arrangements:

- Step 3 asked to inspect the `health.answered` websocket frame and the snapshot JSON. The plugin cannot read frames (browser test spec §3.6), so `[P08b-03a]` asserts that the other participant's page shows the count and who answered and never a score (no selected score button, no "Answered" mark), and it reads the snapshot itself: the page fetches `/retros/{id}/snapshot` through `script()` and the test asserts that each statement carries only `answeredBy`, `count`, `isBuiltin`, `key`, `label`, `myScore`, `text`, with `myScore` null for a participant who has not answered. Payload redaction of the frame stays proved by the feature tests under `tests/Feature/Retros`.
- Steps 5 and 6 ("server answers 423 if forced", "answering in Writing is refused (403 toast)") arrange the server state through the model without a broadcast and then click, the way `[P04-13]` does in `Plan04RetroCoreTest.php`: the page still shows enabled score buttons, the server refuses, the page shows the translated toast and resyncs.
- Step 3's "Enable guest access" is arranged with `RetroFactory::withGuestAccess()`; the guest link dialog is covered by `[P04-10]`.
- Step 7's "toggle the health check off/on" is done in Writing: the settings dialog disables the Health check checkbox while the retro is in the Health check phase.

Facts about the interface that the selectors rely on (all read from the current code):

- Team page section (`resources/js/components/teams/health-statements-section.tsx`): an `<ol>` of active statements inside the `<section>` whose `<h2>` is "Health check statements"; each row shows the statement text, then its axis label and a "Built-in" badge. For a manager each row has `<button aria-label="Drag to reorder">`, an "Archive" button, and "Edit" on custom statements only; the add form has `aria-label="Statement"` and `aria-label="Axis label"` inputs and an "Add statement" button; archived statements sit in a collapsible opened by a button "Archived (n)", each with "Restore". A member sees the list only. A row being edited is the only `<li>` that contains an input.
- A team that never changed its statements shows the six built-ins without stored rows; the first change stores them (`ManageTeamHealthStatements::materialize`).
- Board panel (`resources/js/components/retro/health-check-panel.tsx`): one `<li>` per statement inside an `<ol>`, with `<div role="radiogroup" aria-label="{statement text}">` holding ten `<button role="radio" aria-label="Score N" aria-checked>`, a line "N answered", one `<img alt="{participant name}">` per respondent (none on anonymous retros), a "Clear" button and an `aria-label="Answered"` mark once the viewer has answered. The buttons are disabled when the board is closed for editing. The grid is five columns below 640 px and ten from 640 px.
- The facilitator's add-column form also contains a `role="radiogroup"` (the colour picker) during the Health check phase, so every health selector is scoped to `ol > li`.
- A refused request shows the server's message as a toast and refetches the board (`use-retro-board.ts`, `run`): 423 "The board is closed for editing.", 403 "This action is not available in the current phase.".
- The lock badge reads "Board closed for editing" (`lock-badge.tsx`); the setting is the checkbox `#retro-locked`, the health check toggle is `#retro-health-check`.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php`
- Test: `tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn(User $user, string $to): mixed`, `$this->joinAsGuest(string $joinUrl, string $name): mixed`, `$this->awaitRealtime(mixed $page): mixed`, and `$this->dragWithKeyboard(mixed $page, string $handleSelector, array $keys, bool $handleRemains = true): mixed` (the fourth parameter comes from plan 16b Task 1; this task only relies on its default).
  - `data-realtime` on the root of `retros/show`.
  - Existing helpers in `tests/Pest.php`: `teamMember(Team $team): User`, `workspaceManager(Workspace $workspace, WorkspaceRole $role = WorkspaceRole::Admin): User`, `retroFacilitator(Retro $retro): array{0: User, 1: Participant}`, `retroMember(Retro $retro): array{0: User, 1: Participant}`.
  - Factory states: `RetroFactory::inPhase()`, `withHealthCheck()`, `withGuestAccess()`; `TeamHealthStatementFactory::builtin(HealthStatement $statement)`, `archived()`; `HealthCheckAnswerFactory`.
  - `App\Actions\HealthCheck\FreezeHealthStatements::handle(Retro $retro): void`, to give an arranged retro the frozen set that `CreateRetro` gives a real one.
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php` (global functions; other files must not redeclare them): `p08bBoard(array $attributes = [], RetroPhase $phase = RetroPhase::HealthCheck): array`, `p08bAnswer(Retro $retro, Participant $participant, HealthStatement $statement, int $score): HealthCheckAnswer`, `p08bRow(string $statement): string`, `p08bScore(string $statement, int $score): string`, `p08bChecked(): string`, `p08bBuiltIns(): string`, `p08bTeamStatements(): string`, `p08bBoardStatements(): string`, `p08bHealthSnapshot(mixed $page, Retro $retro): array`, `p08bOpenSettings(mixed $page): mixed`.
  - No new `data-test` hook.

- [ ] **Step 1: Create the test file with its helpers and the team statements tests (steps 1 and 2)**

Create `tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php` directly with this content:

```php
<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Enums\HealthStatement;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\Column;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use App\Models\User;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: array<int, Column>,
 *     2: User,
 *     3: User,
 *     4: Participant,
 *     5: Participant
 * }
 */
function p08bBoard(array $attributes = [], RetroPhase $phase = RetroPhase::HealthCheck): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->withHealthCheck()
        ->withGuestAccess()
        ->create(['title' => 'Sprint 15', ...$attributes]);

    $columns = [];

    foreach (['Start', 'Stop', 'Continue'] as $position => $title) {
        $columns[] = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'position' => $position,
        ]);
    }

    resolve(FreezeHealthStatements::class)->handle($retro);

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $columns, $alice, $bob, $aliceParticipant, $bobParticipant];
}

function p08bAnswer(Retro $retro, Participant $participant, HealthStatement $statement, int $score): HealthCheckAnswer
{
    return HealthCheckAnswer::factory()->create([
        'retro_id' => $retro->id,
        'participant_id' => $participant->id,
        'statement' => $statement->value,
        'score' => $score,
    ]);
}

function p08bRow(string $statement): string
{
    return "ol > li:has([role=\"radiogroup\"][aria-label=\"{$statement}\"])";
}

function p08bScore(string $statement, int $score): string
{
    return "ol > li [role=\"radiogroup\"][aria-label=\"{$statement}\"] [aria-label=\"Score {$score}\"]";
}

function p08bChecked(): string
{
    return 'ol > li [role="radio"][aria-checked="true"]';
}

function p08bBuiltIns(): string
{
    return implode(' | ', [
        'Interaction with colleagues was productive',
        'Tasks assigned to me were clear',
        'My manager was understanding and supportive',
        'The vision and goals are clear to me',
        'Our processes let me work without blockers',
        'I felt motivated in my work',
    ]);
}

function p08bTeamStatements(): string
{
    return "[...[...document.querySelectorAll('section')].find((section) => section.querySelector('h2')?.textContent === 'Health check statements').querySelectorAll('ol > li')].map((row) => row.querySelector('div > div').textContent).join(' | ')";
}

function p08bBoardStatements(): string
{
    return "[...document.querySelectorAll('ol > li > [role=\"radiogroup\"]')].map((group) => group.getAttribute('aria-label')).join(' | ')";
}

/**
 * @return array{
 *     keys: string,
 *     fields: string,
 *     myScores: array<int, ?int>,
 *     counts: array<int, int>,
 *     answeredBy: array<int, string>
 * }
 */
function p08bHealthSnapshot(mixed $page, Retro $retro): array
{
    $json = $page->script("() => fetch('/retros/{$retro->id}/snapshot', { headers: { Accept: 'application/json' } }).then((response) => response.json()).then((snapshot) => JSON.stringify({ keys: Object.keys(snapshot.healthCheck).join(','), fields: [...new Set(snapshot.healthCheck.statements.flatMap((statement) => Object.keys(statement)))].sort().join(','), myScores: snapshot.healthCheck.statements.map((statement) => statement.myScore), counts: snapshot.healthCheck.statements.map((statement) => statement.count), answeredBy: snapshot.healthCheck.statements[0].answeredBy }))");

    return json_decode((string) $json, true, flags: JSON_THROW_ON_ERROR);
}

function p08bOpenSettings(mixed $page): mixed
{
    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSeeIn('[role="dialog"]', 'Retrospective settings')
        ->assertNotPresent('[role="menu"]');

    return $page;
}

it('[P08b-01a] lets an Owner add, archive, reorder, reword and restore the health check statements of a team', function () {
    $team = Team::factory()->create();
    $olivia = workspaceManager($team->workspace, WorkspaceRole::Owner);
    $olivia->update(['name' => 'Olivia Owner', 'locale' => 'en']);
    $active = 'li:has([aria-label="Drag to reorder"])';
    $manager = 'li:has-text("My manager was understanding and supportive")';
    $custom = 'li:has-text("We shipped what we promised")';
    $editing = 'li:has(input[aria-label="Statement"])';
    $handle = 'li:has-text("Interaction with colleagues was productive") [aria-label="Drag to reorder"]';
    $archivedToggle = 'button:has-text("Archived (1)")';

    $page = $this->signIn($olivia, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('Health check statements')
        ->assertSee('Changes apply to retros that have not collected answers yet.')
        ->assertCount($active, 6)
        ->assertScript(p08bTeamStatements(), p08bBuiltIns())
        ->assertNotPresent("{$manager} button:has-text(\"Edit\")");

    $page->fill('[aria-label="Statement"]', 'We shipped what we promised')
        ->fill('[aria-label="Axis label"]', 'Delivery')
        ->click('button:has-text("Add statement")')
        ->assertSee('Statement added.')
        ->assertCount($active, 7)
        ->assertSeeIn($custom, 'Delivery')
        ->assertPresent("{$custom} button:has-text(\"Edit\")");

    $page->click("{$manager} button:has-text(\"Archive\")")
        ->assertPresent($archivedToggle)
        ->assertCount($active, 6);

    $this->dragWithKeyboard($page, $handle, ['Space', 'ArrowDown', 'Space']);

    $page->assertScript(p08bTeamStatements(), implode(' | ', [
        'Tasks assigned to me were clear',
        'Interaction with colleagues was productive',
        'The vision and goals are clear to me',
        'Our processes let me work without blockers',
        'I felt motivated in my work',
        'We shipped what we promised',
    ]));

    $page->click("{$custom} button:has-text(\"Edit\")")
        ->assertVisible("{$editing} input[name=\"text\"]")
        ->fill("{$editing} input[name=\"text\"]", 'We delivered what we promised')
        ->click("{$editing} button:has-text(\"Save\")")
        ->assertSee('Statement updated.')
        ->assertNotPresent($editing)
        ->assertSeeIn('li:has-text("We delivered what we promised")', 'Delivery');

    $page->click($archivedToggle)
        ->assertVisible('button:has-text("Restore")')
        ->click('button:has-text("Restore")')
        ->assertCount($active, 7)
        ->assertNotPresent($archivedToggle)
        ->assertPresent("{$manager} button:has-text(\"Archive\")")
        ->click("{$manager} button:has-text(\"Archive\")")
        ->assertPresent($archivedToggle)
        ->assertCount($active, 6);

    $statements = $team->healthStatements()->get();

    expect($statements)->toHaveCount(7)
        ->and($statements->firstWhere('builtin', HealthStatement::ManagerSupport)->archived_at)->not->toBeNull()
        ->and($statements->whereNull('builtin')->sole()->text)->toBe('We delivered what we promised')
        ->and($statements->whereNull('builtin')->sole()->label)->toBe('Delivery')
        ->and($statements->whereNull('archived_at')->first()->builtin)->toBe(HealthStatement::TaskClarity);
});

it('[P08b-01b] shows the health check statements to a plain member as a read-only list', function () {
    $team = Team::factory()->create();
    $bob = teamMember($team);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    $page = $this->signIn($bob, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('Health check statements')
        ->assertSee('Changes apply to retros that have not collected answers yet.')
        ->assertScript(p08bTeamStatements(), p08bBuiltIns())
        ->assertNotPresent('[aria-label="Drag to reorder"]')
        ->assertNotPresent('[aria-label="Statement"]')
        ->assertNotPresent('button:has-text("Add statement")')
        ->assertNotPresent('button:has-text("Archive")')
        ->assertNotPresent('button:has-text("Restore")');

    expect($team->healthStatements()->count())->toBe(0);
});

it('[P08b-02] starts a retro on the Health check with the active statements of the team in their order', function () {
    $team = Team::factory()->create();
    $alice = teamMember($team);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    TeamHealthStatement::factory()->builtin(HealthStatement::Vision)->create(['team_id' => $team->id, 'position' => 0]);
    $custom = TeamHealthStatement::factory()->create([
        'team_id' => $team->id,
        'text' => 'We shipped what we promised',
        'label' => 'Delivery',
        'position' => 1,
    ]);
    TeamHealthStatement::factory()->builtin(HealthStatement::Motivation)->create(['team_id' => $team->id, 'position' => 2]);
    TeamHealthStatement::factory()->builtin(HealthStatement::Interaction)->create(['team_id' => $team->id, 'position' => 3]);
    TeamHealthStatement::factory()->builtin(HealthStatement::ManagerSupport)->archived()->create(['team_id' => $team->id, 'position' => 4]);
    $phaseOrder = "[...document.querySelectorAll('header ol[aria-label=\"Phases\"] li')].map((step) => step.textContent).join(' > ')";

    $page = $this->signIn($alice, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 15 retro')
        ->assertCount('[role="dialog"] li button[aria-pressed="true"]', 1)
        ->click('[role="dialog"] button:has-text("Settings")')
        ->assertVisible('#new-retro-health-check')
        ->click('#new-retro-health-check')
        ->assertAttribute('#new-retro-health-check', 'aria-checked', 'true')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header > h1', 'Sprint 15 retro')
        ->assertSeeIn('[aria-current="step"]', 'Health check')
        ->assertScript($phaseOrder, 'Health check > Writing > Grouping > Voting > Discussing > Completed')
        ->assertSee('Rate each statement from 1 (Awful) to 10 (Great). Only you see your own scores.')
        ->assertScript(p08bBoardStatements(), implode(' | ', [
            'The vision and goals are clear to me',
            'We shipped what we promised',
            'I felt motivated in my work',
            'Interaction with colleagues was productive',
        ]))
        ->assertDontSee('My manager was understanding and supportive');

    $retro = Retro::query()->where('title', 'Sprint 15 retro')->firstOrFail();

    expect($retro->phase)->toBe(RetroPhase::HealthCheck)
        ->and($retro->health_check_enabled)->toBeTrue()
        ->and($retro->healthStatements->pluck('key')->all())->toBe(['vision', $custom->id, 'motivation', 'interaction']);
});
```

- [ ] **Step 2: Run the tests of steps 1 and 2**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php --filter='P08b-01|P08b-02'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If the keyboard drag of `[P08b-01a]` does not change the order, see the harness findings (probe c).

- [ ] **Step 3: Append the answering and anonymity tests (steps 3 and 4)**

Append at the end of the file:

```php
it('[P08b-03a] shows who answered and how many, and never a score of someone else', function () {
    [$retro, , $alice, , $aliceParticipant] = p08bBoard();
    $interaction = 'Interaction with colleagues was productive';
    $row = p08bRow($interaction);
    $fields = 'answeredBy,count,isBuiltin,key,label,myScore,text';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertSeeIn('[aria-current="step"]', 'Health check')
        ->assertSeeIn($row, '0 answered');

    $alicePage->click(p08bScore($interaction, 7))
        ->assertAttribute(p08bScore($interaction, 7), 'aria-checked', 'true')
        ->assertSeeIn($row, '1 answered')
        ->assertPresent("{$row} img[alt=\"Alice Martin\"]")
        ->assertPresent("{$row} [aria-label=\"Answered\"]");

    $carolPage->assertSeeIn($row, '1 answered')
        ->assertPresent("{$row} img[alt=\"Alice Martin\"]")
        ->assertNotPresent(p08bChecked())
        ->assertNotPresent('[aria-label="Answered"]')
        ->assertNotPresent("{$row} button:has-text(\"Clear\")");

    $carolView = p08bHealthSnapshot($carolPage, $retro);

    expect($carolView['keys'])->toBe('statements')
        ->and($carolView['fields'])->toBe($fields)
        ->and($carolView['myScores'])->toBe([null, null, null, null, null, null])
        ->and($carolView['counts'])->toBe([1, 0, 0, 0, 0, 0])
        ->and($carolView['answeredBy'])->toBe([$aliceParticipant->id]);

    $carolPage->click(p08bScore($interaction, 3))
        ->assertAttribute(p08bScore($interaction, 3), 'aria-checked', 'true')
        ->assertAttribute(p08bScore($interaction, 7), 'aria-checked', 'false')
        ->assertCount(p08bChecked(), 1)
        ->assertSeeIn($row, '2 answered');

    $alicePage->assertSeeIn($row, '2 answered')
        ->assertPresent("{$row} img[alt=\"Carol Guest\"]")
        ->assertAttribute(p08bScore($interaction, 7), 'aria-checked', 'true')
        ->assertAttribute(p08bScore($interaction, 3), 'aria-checked', 'false')
        ->assertCount(p08bChecked(), 1);

    $aliceView = p08bHealthSnapshot($alicePage, $retro);

    expect($aliceView['fields'])->toBe($fields)
        ->and($aliceView['myScores'])->toBe([7, null, null, null, null, null])
        ->and($aliceView['counts'])->toBe([2, 0, 0, 0, 0, 0])
        ->and($aliceView['answeredBy'])->toHaveCount(2)
        ->and($retro->healthCheckAnswers()->orderBy('score')->pluck('score')->all())->toBe([3, 7]);
});

it('[P08b-03b] removes the own answer with Clear', function () {
    [$retro, , $alice, $bob, $aliceParticipant, $bobParticipant] = p08bBoard();
    p08bAnswer($retro, $aliceParticipant, HealthStatement::Interaction, 8);
    p08bAnswer($retro, $bobParticipant, HealthStatement::Interaction, 5);
    $interaction = 'Interaction with colleagues was productive';
    $row = p08bRow($interaction);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertSeeIn($row, '2 answered');

    $bobPage->assertAttribute(p08bScore($interaction, 5), 'aria-checked', 'true')
        ->assertSeeIn($row, '2 answered')
        ->click("{$row} button:has-text(\"Clear\")")
        ->assertNotPresent(p08bChecked())
        ->assertSeeIn($row, '1 answered')
        ->assertNotPresent("{$row} img[alt=\"Bob Stone\"]")
        ->assertNotPresent("{$row} button:has-text(\"Clear\")");

    $alicePage->assertSeeIn($row, '1 answered')
        ->assertNotPresent("{$row} img[alt=\"Bob Stone\"]")
        ->assertAttribute(p08bScore($interaction, 8), 'aria-checked', 'true');

    expect($retro->healthCheckAnswers()->where('participant_id', $bobParticipant->id)->exists())->toBeFalse()
        ->and($retro->healthCheckAnswers()->where('participant_id', $aliceParticipant->id)->value('score'))->toBe(8);
});

it('[P08b-03c] wraps the ten score buttons to two rows of five on a narrow window', function () {
    [$retro, , , $bob] = p08bBoard();
    $rows = "(() => { const tops = [...document.querySelectorAll('ol > li [role=\"radiogroup\"][aria-label=\"Interaction with colleagues was productive\"] [role=\"radio\"]')].map((button) => Math.round(button.getBoundingClientRect().top)); return [...new Set(tops)].map((top) => tops.filter((value) => value === top).length).join(','); })()";

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    $page->assertSeeIn('[aria-current="step"]', 'Health check')
        ->assertScript($rows, '10')
        ->resize(375, 812)
        ->assertScript($rows, '5,5')
        ->resize(1280, 800)
        ->assertScript($rows, '10');
});

it('[P08b-04] shows counts only and no avatar on an anonymous retro', function () {
    [$retro, , $alice, $bob] = p08bBoard(['is_anonymous' => true]);
    $interaction = 'Interaction with colleagues was productive';
    $row = p08bRow($interaction);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->click(p08bScore($interaction, 7))
        ->assertAttribute(p08bScore($interaction, 7), 'aria-checked', 'true')
        ->assertSeeIn($row, '1 answered')
        ->assertNotPresent('ol > li:has([role="radiogroup"]) img');

    $bobPage->assertSeeIn($row, '1 answered')
        ->assertNotPresent('ol > li:has([role="radiogroup"]) img')
        ->assertNotPresent(p08bChecked());

    $bobView = p08bHealthSnapshot($bobPage, $retro);

    expect($bobView['counts'])->toBe([1, 0, 0, 0, 0, 0])
        ->and($bobView['answeredBy'])->toBe([])
        ->and($bobView['myScores'])->toBe([null, null, null, null, null, null]);
});
```

The exact script `p08bHealthSnapshot()` runs in the page is `() => fetch('/retros/{id}/snapshot', { headers: { Accept: 'application/json' } }).then((response) => response.json()).then((snapshot) => JSON.stringify({ … }))`: it reduces the snapshot to the top-level keys of `healthCheck`, the sorted set of fields found on its statements, every `myScore`, every `count` and the `answeredBy` of the first statement, and returns that as a JSON string, which the helper decodes. The request carries the page's own session or guest cookie, so it is the snapshot that participant receives.

- [ ] **Step 4: Run the tests of steps 3 and 4**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php --filter='P08b-03|P08b-04'`
Expected: PASS (4 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. A snapshot that carries any other field on a statement, or a non-null `myScore` for a participant who has not answered, is a product defect (spec §4.2 and §4.3). If `script()` does not return the string of the fetch, see the harness findings.

- [ ] **Step 5: Append the lock, phase guard and frozen set tests (steps 5 to 7)**

Append at the end of the file:

```php
it('[P08b-05a] disables the score buttons for everyone when the board is closed for editing', function () {
    [$retro, , $alice, $bob] = p08bBoard();
    $interaction = 'Interaction with colleagues was productive';
    $disabled = "document.querySelectorAll('ol > li [role=\"radio\"]:disabled').length";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertEnabled(p08bScore($interaction, 7))
        ->assertScript($disabled, 0);

    p08bOpenSettings($alicePage)
        ->click('#retro-locked')
        ->assertAttribute('#retro-locked', 'aria-checked', 'true')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Board closed for editing')
        ->assertScript($disabled, 60);

    $bobPage->assertSee('Board closed for editing')
        ->assertDisabled(p08bScore($interaction, 7))
        ->assertScript($disabled, 60);

    expect($retro->fresh()->is_locked)->toBeTrue()
        ->and($retro->healthCheckAnswers()->count())->toBe(0);
});

it('[P08b-05b] shows the refusal and resyncs when an answer is sent to a board closed for editing', function () {
    [$retro, , , $bob] = p08bBoard();
    $interaction = 'Interaction with colleagues was productive';

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertEnabled(p08bScore($interaction, 7));

    $retro->update(['is_locked' => true]);

    $page->click(p08bScore($interaction, 7))
        ->assertSee('The board is closed for editing.')
        ->assertSee('Board closed for editing')
        ->assertDisabled(p08bScore($interaction, 7))
        ->assertNotPresent(p08bChecked())
        ->assertSeeIn(p08bRow($interaction), '0 answered');

    expect($retro->healthCheckAnswers()->count())->toBe(0);
});

it('[P08b-06] refuses an answer once the retro is in Writing and accepts it again back in the Health check', function () {
    [$retro, , $alice, $bob, , $bobParticipant] = p08bBoard();
    $interaction = 'Interaction with colleagues was productive';
    $current = '[aria-current="step"]';

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertEnabled(p08bScore($interaction, 7));

    $retro->update(['phase' => RetroPhase::Writing]);

    $bobPage->click(p08bScore($interaction, 7))
        ->assertSee('This action is not available in the current phase.')
        ->assertSeeIn($current, 'Writing')
        ->assertNotPresent('ol > li [role="radiogroup"]')
        ->assertCount('[aria-label="Add a card…"]', 3);

    expect($retro->healthCheckAnswers()->count())->toBe(0);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $alicePage->assertSeeIn($current, 'Writing')
        ->click('header button:has-text("Previous")')
        ->assertSeeIn($current, 'Health check');

    $bobPage->assertSeeIn($current, 'Health check')
        ->click(p08bScore($interaction, 7))
        ->assertAttribute(p08bScore($interaction, 7), 'aria-checked', 'true')
        ->assertSeeIn(p08bRow($interaction), '1 answered');

    $alicePage->assertSeeIn(p08bRow($interaction), '1 answered');

    expect($retro->healthCheckAnswers()->where('participant_id', $bobParticipant->id)->value('score'))->toBe(7);
});

it('[P08b-07] keeps the statements a retro froze once it has answers', function () {
    [$retro, , $alice, , , $bobParticipant] = p08bBoard([], RetroPhase::Writing);
    p08bAnswer($retro, $bobParticipant, HealthStatement::Interaction, 6);
    $olivia = workspaceManager($retro->team->workspace, WorkspaceRole::Owner);
    $olivia->update(['name' => 'Olivia Owner', 'locale' => 'en']);
    $interaction = 'Interaction with colleagues was productive';
    $stepper = 'header ol[aria-label="Phases"]';
    $frozenKeys = ['interaction', 'task_clarity', 'manager_support', 'vision', 'processes', 'motivation'];

    $teamPage = $this->signIn($olivia, route('teams.show', [$retro->team->workspace, $retro->team], false));

    $teamPage->assertVisible('[aria-label="Statement"]')
        ->fill('[aria-label="Statement"]', 'We shipped what we promised')
        ->fill('[aria-label="Axis label"]', 'Delivery')
        ->click('button:has-text("Add statement")')
        ->assertSee('Statement added.')
        ->assertCount('li:has([aria-label="Drag to reorder"])', 7);

    expect($retro->team->healthStatements()->count())->toBe(7)
        ->and($retro->healthStatements()->pluck('key')->all())->toBe($frozenKeys);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $alicePage->assertSeeIn($stepper, 'Health check');

    p08bOpenSettings($alicePage)
        ->assertAttribute('#retro-health-check', 'aria-checked', 'true')
        ->click('#retro-health-check')
        ->assertAttribute('#retro-health-check', 'aria-checked', 'false')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertDontSeeIn($stepper, 'Health check');

    expect($retro->fresh()->health_check_enabled)->toBeFalse();

    p08bOpenSettings($alicePage)
        ->click('#retro-health-check')
        ->assertAttribute('#retro-health-check', 'aria-checked', 'true')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($stepper, 'Health check')
        ->click('header button:has-text("Previous")')
        ->assertSeeIn('[aria-current="step"]', 'Health check')
        ->assertScript(p08bBoardStatements(), p08bBuiltIns())
        ->assertDontSee('We shipped what we promised')
        ->assertSeeIn(p08bRow($interaction), '1 answered')
        ->assertPresent(p08bRow($interaction).' img[alt="Bob Stone"]');

    expect($retro->fresh()->health_check_enabled)->toBeTrue()
        ->and($retro->healthStatements()->pluck('key')->all())->toBe($frozenKeys)
        ->and($retro->healthCheckAnswers()->count())->toBe(1);
});
```

In `[P08b-06]` the facilitator signs in only after the member's refused click: her page then loads in Writing, so her "Previous" button really moves the retro back, and the member's page follows through the broadcast.

- [ ] **Step 6: Run the tests of steps 5 to 7**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php --filter='P08b-05|P08b-06|P08b-07'`
Expected: PASS (4 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 7: Format and check**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `vendor/bin/phpstan analyse --no-progress`
Expected: no error.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector` and keep its result.

- [ ] **Step 8: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php`
Expected: PASS (11 tests).

- [ ] **Step 9: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php
git commit -m "test(browser): cover the health check walkthrough"
```

### Task 4: Surveys walkthrough, part 1 (creating and answering the three survey kinds)

This task automates the first half of the plan 8c walkthrough (`docs/superpowers/plans/2026-09-30-plan-8c-surveys.md`, line 5728, one paragraph): "create a single, a multiple and a free-text survey; results appear in each browser only after answering". The walkthrough uses two browsers, one of them a guest. The tests use the facilitator (Alice Martin), a team member (Bob Stone) and a guest (Carol Guest) who joins through the guest link.

Facts about the interface that the selectors rely on (all read from the current code):

- A survey card is `<article aria-label="{question}">` (`resources/js/components/retro/survey-card.tsx`). The question is therefore the handle of a card: `article[aria-label="How was the sprint?"]`. The questions used in the tests contain no quote character.
- The surveys column is `<section aria-label="Surveys">` (`surveys-column.tsx`). It is rendered only in Writing to Discussing and only when the retro has at least one survey.
- The facilitator's button is the text `Add survey` in the board header (`board-header.tsx`, `surveys-column.tsx`). The dialog (`survey-dialog.tsx`) has `#survey-kind` (a Radix select whose options are `[role="option"]` with the texts `Single choice`, `Multiple choice`, `Free text`), `#survey-question`, `#survey-description`, option inputs `[aria-label="Option 1"]`, `[aria-label="Option 2"]`, …, the text button `Add option`, the Radix checkbox `#survey-show-voters`, and a submit button (`[role="dialog"] button[type="submit"]`).
- Each option of a choice survey is one `<li>`. A single choice option is a `<button aria-pressed>`; a multiple choice option is a `<label>` holding a Radix checkbox (`button[role="checkbox"]`), and the card has a `Submit` button that becomes `Update answer` once the viewer has answered. A free text survey has a textarea `[aria-label="Your answer"]` with the same `Submit` / `Update answer` button.
- When the viewer may see the results, each option `<li>` also shows `{percent}% · {count}` (for example `50% · 1`), and a free text survey shows `<ul aria-label="Answers">`. Before that, the card contains no `%` character at all, and its last line reads `{n} · Answer to join the discussion`.
- The number of responses is always shown: `0 responses`, `1 response`, `2 responses`.
- A viewer whose results are visible receives a `survey.changed` broadcast and refetches the survey one second later (`resources/js/lib/retro/survey-api.ts`, `SurveyRefetchDelayMs`). The assertions on the other page wait for that; no sleep is needed.
- No product file changes in this task and in Task 5: every target is reachable by an aria-label, an id, a role or English text. No frontend build is needed beyond the one the suite already requires.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan08cSurveysTest.php`
- Test: `tests/Browser/Walkthroughs/Plan08cSurveysTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` bound to `tests/Browser` (plan 16a), with `$this->signIn(User $user, string $to): mixed`, `$this->joinAsGuest(string $joinUrl, string $name): mixed`, `$this->awaitRealtime(mixed $page): mixed`.
  - `data-realtime` on the root of `retros/show` (plan 16a).
  - Existing helpers in `tests/Pest.php`: `retroFacilitator(Retro $retro): array{0: User, 1: Participant}`, `retroMember(Retro $retro): array{0: User, 1: Participant}`.
  - Factories: `RetroFactory::inPhase()`, `RetroFactory::withGuestAccess()`, `SurveyFactory::withOptions(array $labels)`, `ColumnFactory`.
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan08cSurveysTest.php` (global functions; later files must not redeclare them): `p08cBoard(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array`, `p08cSurvey(Retro $retro, Participant $creator, string $question, SurveyKind $kind = SurveyKind::Single, array $options = ['Great', 'Fine', 'Rough'], array $attributes = []): Survey`, `p08cCard(string $question): string`, `p08cOption(string $question, string $label): string`, `p08cShowsResults(string $question): string`, `p08cTextAnswers(string $question): string`.
  - Stable selectors that need no hook, reused by Task 5 and Task 6: survey card `article[aria-label="<question>"]`; option row `article[aria-label="<question>"] li:has-text("<label>")`; survey menu `[aria-label="Survey actions"]`; answers list `ul[aria-label="Answers"]`; comments toggle `button[aria-label^="Comments"]`; reaction chip `[aria-label="<emoji>, 1 reaction"]`.

- [ ] **Step 1: Create the test file with its helpers and the creation test**

`php artisan make:test` cannot write under `tests/Browser`, so create `tests/Browser/Walkthroughs/Plan08cSurveysTest.php` directly with this content:

```php
<?php

use App\Enums\RetroPhase;
use App\Enums\SurveyKind;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\User;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: User,
 *     3: Participant,
 *     4: Participant
 * }
 */
function p08cBoard(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->withGuestAccess()
        ->create(['title' => 'Sprint 12', ...$attributes]);

    Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Start', 'position' => 0]);

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $alice, $bob, $aliceParticipant, $bobParticipant];
}

/**
 * @param  array<int, string>  $options
 * @param  array<string, mixed>  $attributes
 */
function p08cSurvey(Retro $retro, Participant $creator, string $question, SurveyKind $kind = SurveyKind::Single, array $options = ['Great', 'Fine', 'Rough'], array $attributes = []): Survey
{
    $factory = Survey::factory()->state(['kind' => $kind]);

    if ($kind !== SurveyKind::Text) {
        $factory = $factory->withOptions($options);
    }

    return $factory->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $creator->id,
        'question' => $question,
        'position' => $retro->surveys()->count(),
        ...$attributes,
    ]);
}

function p08cCard(string $question): string
{
    return "article[aria-label=\"{$question}\"]";
}

function p08cOption(string $question, string $label): string
{
    return p08cCard($question)." li:has-text(\"{$label}\")";
}

function p08cShowsResults(string $question): string
{
    $card = p08cCard($question);

    return "document.querySelector('{$card}').innerText.includes('%')";
}

function p08cTextAnswers(string $question): string
{
    $answers = p08cCard($question).' ul[aria-label="Answers"] li';

    return "[...document.querySelectorAll('{$answers}')].map((answer) => answer.firstChild.textContent).join(' | ')";
}

it('[P08c-01] creates a single choice, a multiple choice and a free text survey that a guest sees without reloading', function () {
    [$retro, $alice] = p08cBoard();
    $single = p08cCard('How was the sprint?');
    $multiple = p08cCard('Which practices helped?');
    $text = p08cCard('What should we try next?');
    $save = '[role="dialog"] button[type="submit"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertNotPresent('section[aria-label="Surveys"]')
        ->assertDontSee('Add survey');

    $alicePage->assertSee('Add survey')
        ->click('Add survey')
        ->assertVisible('#survey-question')
        ->fill('#survey-question', 'How was the sprint?')
        ->fill('#survey-description', 'One answer each.')
        ->fill('[aria-label="Option 1"]', 'Great')
        ->fill('[aria-label="Option 2"]', 'Fine')
        ->click('Add option')
        ->assertVisible('[aria-label="Option 3"]')
        ->fill('[aria-label="Option 3"]', 'Rough')
        ->click($save)
        ->assertNotPresent('[role="dialog"]')
        ->assertPresent($single);

    $carolPage->assertPresent($single)
        ->assertSeeIn($single, 'One answer each.')
        ->assertCount("{$single} button[aria-pressed]", 3)
        ->assertSeeIn($single, '0 responses')
        ->assertSeeIn($single, 'Answer to join the discussion');

    $alicePage->click('Add survey')
        ->assertVisible('#survey-kind')
        ->click('#survey-kind')
        ->assertPresent('[role="listbox"]')
        ->click('[role="option"]:has-text("Multiple choice")')
        ->assertNotPresent('[role="listbox"]')
        ->fill('#survey-question', 'Which practices helped?')
        ->fill('[aria-label="Option 1"]', 'Pairing')
        ->fill('[aria-label="Option 2"]', 'Demos')
        ->click($save)
        ->assertNotPresent('[role="dialog"]')
        ->assertPresent($multiple);

    $carolPage->assertPresent($multiple)
        ->assertSeeIn($multiple, 'Several answers allowed')
        ->assertCount("{$multiple} button[role=\"checkbox\"]", 2)
        ->assertDisabled("{$multiple} button:has-text(\"Submit\")");

    $alicePage->click('Add survey')
        ->assertVisible('#survey-kind')
        ->click('#survey-kind')
        ->assertPresent('[role="listbox"]')
        ->click('[role="option"]:has-text("Free text")')
        ->assertNotPresent('[role="listbox"]')
        ->assertNotPresent('[aria-label="Option 1"]')
        ->fill('#survey-question', 'What should we try next?')
        ->click($save)
        ->assertNotPresent('[role="dialog"]')
        ->assertPresent($text);

    $carolPage->assertPresent($text)
        ->assertPresent("{$text} [aria-label=\"Your answer\"]")
        ->assertNotPresent("{$text} ul[aria-label=\"Answers\"]")
        ->assertCount('section[aria-label="Surveys"] article', 3)
        ->assertNotPresent('[aria-label="Survey actions"]');

    $alicePage->assertCount('[aria-label="Survey actions"]', 3);

    $surveys = $retro->surveys()->get();

    expect($surveys->map(fn (Survey $survey): string => $survey->kind->value)->all())->toBe(['single', 'multiple', 'text'])
        ->and($surveys[0]->options->pluck('label')->all())->toBe(['Great', 'Fine', 'Rough'])
        ->and($surveys[0]->description)->toBe('One answer each.')
        ->and($surveys[1]->options->pluck('label')->all())->toBe(['Pairing', 'Demos'])
        ->and($surveys[2]->options)->toHaveCount(0);
});
```

- [ ] **Step 2: Run the creation test**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08cSurveysTest.php --filter='P08c-01'`
Expected: PASS (1 test); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If this fails on a selector the plugin refuses, see the harness findings (`docs/superpowers/walkthroughs/harness-findings.md`, "Selectors").

- [ ] **Step 3: Add the three answering tests (results appear only after answering)**

Append to `tests/Browser/Walkthroughs/Plan08cSurveysTest.php` (no new import is needed):

```php
it('[P08c-02a] shows the results of a single choice survey only to those who answered', function () {
    [$retro, , $bob, $aliceParticipant] = p08cBoard();
    $survey = p08cSurvey($retro, $aliceParticipant, 'How was the sprint?');
    $card = p08cCard('How was the sprint?');
    $great = p08cOption('How was the sprint?', 'Great');
    $fine = p08cOption('How was the sprint?', 'Fine');
    $rough = p08cOption('How was the sprint?', 'Rough');
    $showsResults = p08cShowsResults('How was the sprint?');

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertSeeIn($card, '0 responses')
            ->assertScript($showsResults, false);
    }

    $bobPage->click("{$great} button")
        ->assertAriaAttribute("{$great} button", 'pressed', 'true')
        ->assertSeeIn($great, '100% · 1')
        ->assertSeeIn($fine, '0% · 0')
        ->assertSeeIn($card, '1 response')
        ->assertSeeIn($card, 'Withdraw my answer');

    $carolPage->assertSeeIn($card, '1 response')
        ->assertScript($showsResults, false)
        ->assertDontSeeIn($card, 'Withdraw my answer');

    $carolPage->click("{$rough} button")
        ->assertAriaAttribute("{$rough} button", 'pressed', 'true')
        ->assertSeeIn($great, '50% · 1')
        ->assertSeeIn($rough, '50% · 1')
        ->assertSeeIn($card, '2 responses');

    $bobPage->assertSeeIn($great, '50% · 1')
        ->assertSeeIn($rough, '50% · 1')
        ->assertSeeIn($card, '2 responses');

    $bobPage->click("{$fine} button")
        ->assertAriaAttribute("{$fine} button", 'pressed', 'true')
        ->assertSeeIn($fine, '50% · 1')
        ->assertSeeIn($great, '0% · 0');

    $carolPage->assertSeeIn($fine, '50% · 1')
        ->assertSeeIn($great, '0% · 0')
        ->assertSeeIn($card, '2 responses');

    expect($survey->responses()->count())->toBe(2);
});

it('[P08c-02b] takes several answers on a multiple choice survey and shows its results only to those who answered', function () {
    [$retro, , $bob, $aliceParticipant] = p08cBoard();
    $survey = p08cSurvey($retro, $aliceParticipant, 'Which practices helped?', SurveyKind::Multiple, ['Pairing', 'Code review', 'Demos']);
    $card = p08cCard('Which practices helped?');
    $pairing = p08cOption('Which practices helped?', 'Pairing');
    $review = p08cOption('Which practices helped?', 'Code review');
    $demos = p08cOption('Which practices helped?', 'Demos');
    $submit = "{$card} button:has-text(\"Submit\")";
    $showsResults = p08cShowsResults('Which practices helped?');

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $bobPage->assertSeeIn($card, 'Several answers allowed')
        ->assertDisabled($submit)
        ->click("{$pairing} button[role=\"checkbox\"]")
        ->click("{$demos} button[role=\"checkbox\"]")
        ->click($submit)
        ->assertSeeIn($pairing, '100% · 1')
        ->assertSeeIn($demos, '100% · 1')
        ->assertSeeIn($review, '0% · 0')
        ->assertSeeIn($card, '1 response')
        ->assertAriaAttribute("{$pairing} button[role=\"checkbox\"]", 'checked', 'true')
        ->assertDisabled("{$card} button:has-text(\"Update answer\")");

    $carolPage->assertSeeIn($card, '1 response')
        ->assertScript($showsResults, false);

    $carolPage->click("{$pairing} button[role=\"checkbox\"]")
        ->click($submit)
        ->assertSeeIn($pairing, '100% · 2')
        ->assertSeeIn($demos, '50% · 1')
        ->assertSeeIn($review, '0% · 0')
        ->assertSeeIn($card, '2 responses');

    $bobPage->assertSeeIn($pairing, '100% · 2')
        ->assertSeeIn($demos, '50% · 1')
        ->assertSeeIn($card, '2 responses');

    expect($survey->responses()->count())->toBe(3)
        ->and($survey->responseCount())->toBe(2);
});

it('[P08c-02c] lists the free text answers, sorted by text and without names, only to those who answered', function () {
    [$retro, , $bob, $aliceParticipant] = p08cBoard();
    $survey = p08cSurvey($retro, $aliceParticipant, 'What should we try next?', SurveyKind::Text);
    $card = p08cCard('What should we try next?');
    $input = "{$card} [aria-label=\"Your answer\"]";
    $list = "{$card} ul[aria-label=\"Answers\"]";
    $answers = p08cTextAnswers('What should we try next?');

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $bobPage->fill($input, 'Shorter standups')
        ->click("{$card} button:has-text(\"Submit\")")
        ->assertSeeIn($list, 'Shorter standups')
        ->assertSeeIn("{$list} li", 'Your answer')
        ->assertSeeIn($card, '1 response');

    $carolPage->assertSeeIn($card, '1 response')
        ->assertNotPresent($list)
        ->assertScript('document.documentElement.outerHTML.includes("Shorter standups")', false);

    $carolPage->fill($input, 'Automate the changelog')
        ->click("{$card} button:has-text(\"Submit\")")
        ->assertScript($answers, 'Automate the changelog | Shorter standups')
        ->assertDontSeeIn($list, 'Bob Stone')
        ->assertSeeIn($card, '2 responses');

    $bobPage->assertScript($answers, 'Automate the changelog | Shorter standups')
        ->assertDontSeeIn($list, 'Carol Guest');

    $bobPage->fill($input, 'Zero meetings on Fridays')
        ->click("{$card} button:has-text(\"Update answer\")")
        ->assertScript($answers, 'Automate the changelog | Zero meetings on Fridays')
        ->assertSeeIn($card, '2 responses');

    $carolPage->assertScript($answers, 'Automate the changelog | Zero meetings on Fridays');

    expect($survey->textAnswers()->pluck('content')->sort()->values()->all())
        ->toBe(['Automate the changelog', 'Zero meetings on Fridays']);
});
```

- [ ] **Step 4: Run the answering tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08cSurveysTest.php --filter='P08c-02'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. The assertions on the second page wait for the survey refetch, which starts one second after the broadcast; if one of them times out, see the harness findings.

- [ ] **Step 5: Format and check Rector**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector`, then `vendor/bin/pint --dirty --format agent` again.

- [ ] **Step 6: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08cSurveysTest.php`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan08cSurveysTest.php
git commit -m "test(browser): cover the surveys walkthrough: creating and answering the three kinds"
```

### Task 5: Surveys walkthrough, part 2 (close, show who answered, discussion, withdraw, completed and reopened retro)

This task automates the second half of the plan 8c walkthrough (same paragraph, line 5728): "close one survey (results appear for the other browser without answering); 'Show who answered' shows avatars (and text authors) only once counts are visible and is disabled on an anonymous retro; react and comment (hidden before answering in the other browser); withdraw an answer (results and discussion hide again); complete the retro (every survey closed), reopen it (surveys stay closed, answering refused)".

Facts about the interface that the selectors rely on (all read from the current code):

- The facilitator's survey menu is `<button aria-label="Survey actions">` inside the card (`survey-menu.tsx`); it is not rendered for other participants, nor once the retro is Completed. Its items are `Edit survey`, the checkbox item `Show who answered` (`[role="menuitemcheckbox"]`, the only one on the page), `Close survey` or `Reopen survey`, and `Delete survey`. The trigger is disabled while a request of the menu is in flight, so `assertEnabled` on the trigger waits for the request to end.
- A closed survey shows the badge `Closed`, and its option buttons, checkboxes and textarea are disabled or absent.
- With "Show who answered" on, each option row whose count is visible lists `<img alt="{participant name}">`; a free text answer shows the author's name in its `<li>` (`survey-card.tsx`, `OptionResult`, `TextAnswerList`). On an anonymous retro the menu item carries `aria-disabled="true"`, the dialog's checkbox `#survey-show-voters` is disabled, and the dialog shows "Names are never shown on anonymous retros."
- The discussion (`survey-discussion.tsx`): when the results are visible, the card shows the reaction chips (`<button aria-label="🎉, 1 reaction" aria-pressed>`), the picker trigger `[aria-label="Add a reaction"]` (a menu whose quick items are `[role="menuitem"]` with the emoji as text), and the comments toggle `<button aria-label="Comments (1)">`. The opened thread has the textarea `[aria-label="Write a comment…"]` (Enter submits) and the note "Your name is shown with your comment." When the results are not visible, the card shows only `{n} · Answer to join the discussion`.
- In the Results view (retro Completed) each survey is again `<article aria-label="{question}">`, inside the section whose heading is `Surveys` (`results/survey-result.tsx`, `results/results-section.tsx`); the surveys column is not rendered in Completed, so the card selector stays unique.
- `Complete` and `Reopen` are the facilitator's buttons of the phase stepper, as in `[P04-07]`.
- "Answering refused" is asserted as the interface shows it (disabled controls on a closed survey). The server's own refusal (422 "This survey is closed.") stays covered by `tests/Feature/Retros/SurveyAnswersTest.php`.

**Files:**
- Modify: `tests/Browser/Walkthroughs/Plan08cSurveysTest.php`
- Test: `tests/Browser/Walkthroughs/Plan08cSurveysTest.php`

**Interfaces:**
- Consumes:
  - Task 4's helpers in the same file: `p08cBoard()`, `p08cSurvey()`, `p08cCard()`, `p08cOption()`, `p08cShowsResults()`.
  - `tests/Pest.php`: `answerSurvey(Survey $survey, Participant $participant, int ...$optionIndexes): void`.
  - Factories: `SurveyTextAnswerFactory`, `SurveyReactionFactory`, `SurveyCommentFactory`, `RetroFactory` attribute `is_anonymous`.
- Produces: nothing for other tasks beyond the tests.

- [ ] **Step 1: Add the close test and the two "Show who answered" tests**

In `tests/Browser/Walkthroughs/Plan08cSurveysTest.php`, add this import to the `use` block (keep the block in alphabetical order):

```php
use App\Models\SurveyTextAnswer;
```

Append to the file:

```php
it('[P08c-03] shows the results to someone who has not answered once the facilitator closes the survey', function () {
    [$retro, $alice, , $aliceParticipant, $bobParticipant] = p08cBoard();
    $survey = p08cSurvey($retro, $aliceParticipant, 'How was the sprint?');
    answerSurvey($survey, $bobParticipant, 0);
    $card = p08cCard('How was the sprint?');
    $great = p08cOption('How was the sprint?', 'Great');
    $actions = "{$card} [aria-label=\"Survey actions\"]";
    $showsResults = p08cShowsResults('How was the sprint?');

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertSeeIn($card, '1 response')
        ->assertScript($showsResults, false);

    $alicePage->click($actions)
        ->assertSee('Close survey')
        ->click('Close survey')
        ->assertNotPresent('[role="menu"]')
        ->assertSeeIn($card, 'Closed')
        ->assertSeeIn($great, '100% · 1');

    $carolPage->assertSeeIn($card, 'Closed')
        ->assertSeeIn($great, '100% · 1')
        ->assertDisabled("{$great} button")
        ->assertPresent("{$card} button[aria-label^=\"Comments\"]");

    expect($survey->fresh()->is_closed)->toBeTrue();

    $alicePage->click($actions)
        ->assertSee('Reopen survey')
        ->click('Reopen survey')
        ->assertNotPresent('[role="menu"]')
        ->assertDontSeeIn($card, 'Closed');

    $carolPage->assertDontSeeIn($card, 'Closed')
        ->assertScript($showsResults, false)
        ->assertEnabled("{$great} button");

    expect($survey->fresh()->is_closed)->toBeFalse()
        ->and($survey->responses()->count())->toBe(1);
});

it('[P08c-04a] shows who answered, and who wrote a free text answer, only once the viewer may see the results', function () {
    [$retro, $alice, , $aliceParticipant, $bobParticipant] = p08cBoard();
    $choice = p08cSurvey($retro, $aliceParticipant, 'How was the sprint?');
    $freeText = p08cSurvey($retro, $aliceParticipant, 'What should we try next?', SurveyKind::Text);
    answerSurvey($choice, $bobParticipant, 0);
    SurveyTextAnswer::factory()->create([
        'survey_id' => $freeText->id,
        'participant_id' => $bobParticipant->id,
        'content' => 'Shorter standups',
    ]);
    $single = p08cCard('How was the sprint?');
    $text = p08cCard('What should we try next?');
    $great = p08cOption('How was the sprint?', 'Great');
    $rough = p08cOption('How was the sprint?', 'Rough');
    $answers = "{$text} ul[aria-label=\"Answers\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->click("{$single} [aria-label=\"Survey actions\"]")
        ->assertPresent('[role="menuitemcheckbox"]')
        ->click('[role="menuitemcheckbox"]')
        ->assertNotPresent('[role="menu"]')
        ->assertEnabled("{$single} [aria-label=\"Survey actions\"]")
        ->assertNotPresent("{$single} img");

    $alicePage->click("{$great} button")
        ->assertSeeIn($great, '100% · 2')
        ->assertPresent("{$great} img[alt=\"Bob Stone\"]")
        ->assertPresent("{$great} img[alt=\"Alice Martin\"]");

    $carolPage->assertSeeIn($single, '2 responses')
        ->assertNotPresent("{$single} img");

    $carolPage->click("{$rough} button")
        ->assertSeeIn($rough, '33% · 1')
        ->assertPresent("{$great} img[alt=\"Bob Stone\"]")
        ->assertPresent("{$great} img[alt=\"Alice Martin\"]")
        ->assertPresent("{$rough} img[alt=\"Carol Guest\"]")
        ->assertNotPresent("{$rough} img[alt=\"Bob Stone\"]");

    $alicePage->click("{$text} [aria-label=\"Survey actions\"]")
        ->assertPresent('[role="menuitemcheckbox"]')
        ->click('[role="menuitemcheckbox"]')
        ->assertNotPresent('[role="menu"]')
        ->assertEnabled("{$text} [aria-label=\"Survey actions\"]");

    $carolPage->assertNotPresent($answers)
        ->assertDontSeeIn($text, 'Shorter standups');

    $carolPage->fill("{$text} [aria-label=\"Your answer\"]", 'Automate the changelog')
        ->click("{$text} button:has-text(\"Submit\")")
        ->assertSeeIn("{$answers} li:has-text(\"Shorter standups\")", 'Bob Stone')
        ->assertSeeIn("{$answers} li:has-text(\"Automate the changelog\")", 'Carol Guest');

    expect($choice->fresh()->show_voters)->toBeTrue()
        ->and($freeText->fresh()->show_voters)->toBeTrue();
});

it('[P08c-04b] never offers or shows who answered on an anonymous retro', function () {
    [$retro, $alice, , $aliceParticipant, $bobParticipant] = p08cBoard(RetroPhase::Writing, ['is_anonymous' => true]);
    $survey = p08cSurvey($retro, $aliceParticipant, 'How was the sprint?', attributes: ['show_voters' => true]);
    answerSurvey($survey, $bobParticipant, 0);
    $card = p08cCard('How was the sprint?');
    $great = p08cOption('How was the sprint?', 'Great');

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->click("{$card} [aria-label=\"Survey actions\"]")
        ->assertAttribute('[role="menuitemcheckbox"]', 'aria-disabled', 'true')
        ->assertAriaAttribute('[role="menuitemcheckbox"]', 'checked', 'false')
        ->keys('[role="menu"]', 'Escape')
        ->assertNotPresent('[role="menu"]');

    $page->click("{$great} button")
        ->assertSeeIn($great, '100% · 2')
        ->assertNotPresent("{$card} img");

    $page->click('Add survey')
        ->assertVisible('#survey-show-voters')
        ->assertDisabled('#survey-show-voters')
        ->assertAriaAttribute('#survey-show-voters', 'checked', 'false')
        ->assertSee('Names are never shown on anonymous retros.');
});
```

- [ ] **Step 2: Run the close and "Show who answered" tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08cSurveysTest.php --filter='P08c-0[34]'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If the menu is still open when it is clicked a second time, see the harness findings and the Radix note of the plan header (`assertNotPresent('[role="menu"]')` before reopening).

- [ ] **Step 3: Add the discussion, withdraw and completion tests**

In `tests/Browser/Walkthroughs/Plan08cSurveysTest.php`, add these imports to the `use` block (keep the block in alphabetical order):

```php
use App\Models\SurveyComment;
use App\Models\SurveyReaction;
```

Append to the file:

```php
it('[P08c-05] hides the reactions and comments of a survey from someone who has not answered it', function () {
    [$retro, , $bob, $aliceParticipant, $bobParticipant] = p08cBoard();
    $survey = p08cSurvey($retro, $aliceParticipant, 'How was the sprint?');
    answerSurvey($survey, $bobParticipant, 0);
    $card = p08cCard('How was the sprint?');
    $fine = p08cOption('How was the sprint?', 'Fine');
    $comments = "{$card} button[aria-label^=\"Comments\"]";
    $composer = "{$card} [aria-label=\"Write a comment…\"]";

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $bobPage->click("{$card} [aria-label=\"Add a reaction\"]")
        ->assertPresent('[role="menu"]')
        ->click('[role="menuitem"]:has-text("🎉")')
        ->assertNotPresent('[role="menu"]')
        ->assertAriaAttribute("{$card} [aria-label=\"🎉, 1 reaction\"]", 'pressed', 'true');

    $bobPage->click($comments)
        ->assertSeeIn($card, 'Your name is shown with your comment.')
        ->fill($composer, 'Pairing saved us')
        ->keys($composer, 'Enter')
        ->assertSeeIn($card, 'Pairing saved us')
        ->assertSeeIn($card, 'Bob Stone')
        ->assertPresent("{$card} button[aria-label=\"Comments (1)\"]");

    $carolPage->assertSeeIn($card, '1 · Answer to join the discussion')
        ->assertDontSeeIn($card, 'Pairing saved us')
        ->assertNotPresent("{$card} [aria-label^=\"🎉\"]")
        ->assertNotPresent("{$card} [aria-label=\"Add a reaction\"]")
        ->assertNotPresent($comments)
        ->assertScript('document.documentElement.outerHTML.includes("Pairing saved us")', false);

    $carolPage->click("{$fine} button")
        ->assertSeeIn($fine, '50% · 1')
        ->assertAriaAttribute("{$card} [aria-label=\"🎉, 1 reaction\"]", 'pressed', 'false')
        ->click($comments)
        ->assertSeeIn($card, 'Pairing saved us')
        ->assertSeeIn($card, 'Bob Stone');

    $carolPage->click("{$card} [aria-label=\"🎉, 1 reaction\"]")
        ->assertAriaAttribute("{$card} [aria-label=\"🎉, 2 reactions\"]", 'pressed', 'true');

    $carolPage->fill($composer, 'Same here')
        ->keys($composer, 'Enter')
        ->assertSeeIn($card, 'Same here')
        ->assertPresent("{$card} button[aria-label=\"Comments (2)\"]");

    $bobPage->assertPresent("{$card} [aria-label=\"🎉, 2 reactions\"]")
        ->assertSeeIn($card, 'Same here')
        ->assertSeeIn($card, 'Carol Guest')
        ->assertPresent("{$card} button[aria-label=\"Comments (2)\"]");

    expect($survey->reactions()->count())->toBe(2)
        ->and($survey->comments()->pluck('content')->all())->toBe(['Pairing saved us', 'Same here']);
});

it('[P08c-06] hides the results and the discussion again when an answer is withdrawn', function () {
    [$retro, , $bob, $aliceParticipant, $bobParticipant] = p08cBoard();
    $survey = p08cSurvey($retro, $aliceParticipant, 'How was the sprint?');
    answerSurvey($survey, $aliceParticipant, 0);
    answerSurvey($survey, $bobParticipant, 1);
    SurveyReaction::factory()->create([
        'retro_id' => $retro->id,
        'survey_id' => $survey->id,
        'participant_id' => $aliceParticipant->id,
        'emoji' => '👍',
    ]);
    SurveyComment::factory()->create([
        'retro_id' => $retro->id,
        'survey_id' => $survey->id,
        'participant_id' => $aliceParticipant->id,
        'content' => 'Pairing saved us',
    ]);
    $card = p08cCard('How was the sprint?');
    $rough = p08cOption('How was the sprint?', 'Rough');
    $comments = "{$card} button[aria-label^=\"Comments\"]";
    $showsResults = p08cShowsResults('How was the sprint?');

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->click("{$rough} button")
        ->assertSeeIn($rough, '33% · 1')
        ->assertSeeIn($card, '3 responses')
        ->assertPresent("{$card} [aria-label=\"👍, 1 reaction\"]")
        ->click($comments)
        ->assertSeeIn($card, 'Pairing saved us');

    $bobPage->assertSeeIn($rough, '33% · 1')
        ->assertSeeIn($card, '3 responses');

    $carolPage->click("{$card} button:has-text(\"Withdraw my answer\")")
        ->assertSeeIn($card, '2 responses')
        ->assertScript($showsResults, false)
        ->assertSeeIn($card, '1 · Answer to join the discussion')
        ->assertDontSeeIn($card, 'Pairing saved us')
        ->assertNotPresent("{$card} [aria-label=\"👍, 1 reaction\"]")
        ->assertNotPresent($comments)
        ->assertCount("{$card} button[aria-pressed=\"true\"]", 0)
        ->assertDontSeeIn($card, 'Withdraw my answer');

    $bobPage->assertSeeIn($card, '2 responses')
        ->assertSeeIn($rough, '0% · 0');

    expect($survey->responses()->count())->toBe(2)
        ->and($survey->reactions()->count())->toBe(1)
        ->and($survey->comments()->count())->toBe(1);
});

it('[P08c-07] closes every survey when the retro is completed and keeps them closed after a reopen', function () {
    [$retro, $alice, , $aliceParticipant, $bobParticipant] = p08cBoard(RetroPhase::Discussing);
    $choice = p08cSurvey($retro, $aliceParticipant, 'How was the sprint?');
    p08cSurvey($retro, $aliceParticipant, 'Which practices helped?', SurveyKind::Multiple, ['Pairing', 'Demos']);
    p08cSurvey($retro, $aliceParticipant, 'What should we try next?', SurveyKind::Text);
    answerSurvey($choice, $bobParticipant, 0);
    $single = p08cCard('How was the sprint?');
    $multiple = p08cCard('Which practices helped?');
    $text = p08cCard('What should we try next?');
    $great = p08cOption('How was the sprint?', 'Great');
    $pairing = p08cOption('Which practices helped?', 'Pairing');
    $results = 'section:has(h2:has-text("Surveys"))';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertCount('section[aria-label="Surveys"] article', 3)
        ->assertDontSeeIn($single, 'Closed');

    $alicePage->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Completed')
            ->assertCount("{$results} article", 3)
            ->assertSeeIn($great, '100% · 1')
            ->assertSeeIn($single, '1 response')
            ->assertSeeIn($text, 'No answers yet.')
            ->assertNotPresent('[aria-label="Survey actions"]')
            ->assertNotPresent('[aria-label="Your answer"]');
    }

    expect($retro->surveys()->where('is_closed', false)->count())->toBe(0);

    $alicePage->press('Reopen')
        ->assertSeeIn('[aria-current="step"]', 'Discussing');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Discussing')
            ->assertCount('section[aria-label="Surveys"] article', 3)
            ->assertSeeIn($single, 'Closed')
            ->assertSeeIn($multiple, 'Closed')
            ->assertSeeIn($text, 'Closed')
            ->assertSeeIn($great, '100% · 1')
            ->assertDisabled("{$great} button")
            ->assertDisabled("{$pairing} button[role=\"checkbox\"]")
            ->assertNotPresent("{$multiple} button:has-text(\"Submit\")")
            ->assertNotPresent("{$text} [aria-label=\"Your answer\"]");
    }

    $alicePage->click("{$single} [aria-label=\"Survey actions\"]")
        ->assertSee('Reopen survey')
        ->keys('[role="menu"]', 'Escape')
        ->assertNotPresent('[role="menu"]');

    expect($retro->surveys()->where('is_closed', false)->count())->toBe(0)
        ->and($choice->responses()->count())->toBe(1)
        ->and($retro->fresh()->phase)->toBe(RetroPhase::Discussing);
});
```

- [ ] **Step 4: Run the discussion, withdraw and completion tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08cSurveysTest.php --filter='P08c-0[567]'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If the emoji menu item cannot be clicked by its text, see the harness findings.

- [ ] **Step 5: Format and check Rector**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue; keep Pint's result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector`, then `vendor/bin/pint --dirty --format agent` again.

- [ ] **Step 6: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08cSurveysTest.php`
Expected: PASS (10 tests).

- [ ] **Step 7: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan08cSurveysTest.php
git commit -m "test(browser): cover the surveys walkthrough: close, voters, discussion, withdraw, completion"
```

### Task 6: Results walkthrough (group names, ROTI, the Results view, live refresh, reduced motion)

This task automates the plan 8d walkthrough (`docs/superpowers/plans/2026-09-30-plan-8d-results.md`, lines 3014 to 3019, six steps, "one member, one guest"). The member is the facilitator (Alice Martin) or a team member (Bob Stone); the guest is Carol Guest.

How each step is tested, and what is substituted:

- Step 1 (group names during Grouping). The group itself is arranged with factories (dragging one card onto another is `[P04-03]`); the test names it as the guest. "Drag the only grouped card out" is done with the card's `Ungroup` button, as in `[P04-03]`: a grouped card has no keyboard drag handle (`retro-column.tsx` wraps only top-level cards in `GroupableCard`). Grouping a named group onto another named group uses the keyboard recipe that `[P04-03]` inlines, because the drop removes the handle.
- Step 4 (the Results view). The charts are inline SVG (`results/health-radar.tsx`, `results/health-trend.tsx`). The tests assert what the charts expose in the DOM: the radar's `<desc>` (one `label: average/10` per axis, "No answers" for a gap), its axis labels, the number of points and of drawn segments, the trend's `<title>` per point, the hollow point's class, the links and the delta sentence. Whether the charts look right is a residual row. The health trend needs several completed retros of one team: they are arranged with factories and `FreezeHealthStatements`, and the statement change is made with `ManageTeamHealthStatements::archive()`, as `tests/Feature/Retros/HealthTrendTest.php` does.
- Step 6 (OS "reduce motion"). `signIn()` builds its own browser context, so the test opens the guest link by hand with `visit($joinPath, ['reducedMotion' => 'reduce'])`, which the plugin passes to Playwright's `newContext`. The only motion in the Results view is the width transition of the ROTI bars (`results/roti-section.tsx`, class `motion-safe:transition-[width]`); the survey bars and both charts have none. The test asserts the computed `transition-duration` of a ROTI bar (`0s` under reduced motion, not `0s` in a default context) and that the radar's shapes carry no CSS animation or transition and the page no SVG animation element. This row is `auto-substituted`; the context option has not been run against this application yet.

Facts about the interface that the selectors rely on (all read from the current code):

- A card is `<article id="card-{id}">`; a grouped card is rendered inside its lead's article. A group without a name shows the button `Name this group`, a named group the button `[aria-label="Rename group"]`; the inline editor is `[aria-label="Group name"]` and saves on Enter (`group-name.tsx`). In Grouping, a top-level card's drag handle is `@retro-card-handle-{id}` (plan 16a).
- Presentation mode (`presentation-overlay.tsx`) is a dialog shown to everyone when the retro has `presentation_mode` and the facilitator clicks `Discuss` on a card in Discussing. The group name is the dialog's first `<p>`, rendered in upper case by CSS, so the test reads `textContent`, which CSS does not change.
- ROTI (`roti-control.tsx`): `[role="group"][aria-label="How was this retro?"]` with five buttons (`aria-pressed`) whose texts are `Time wasted`, `Not really worth it`, `Break-even`, `Good use of time`, `Excellent use of time`, followed by `1 rating` / `2 ratings`. Clicking the pressed button removes the rating. In Discussing it sits at the bottom of the action items panel; in Completed it is in the Results section "Return on time invested", next to "No ratings yet." or `Average: 4.5/5` and five rows `{score} · {label}` with a bar and a count.
- The locked board shows the badge "Board closed for editing"; the facilitator locks it in the settings dialog (Facilitator menu, `Settings…`, checkbox `#retro-locked`, submit).
- Completed (`board.tsx`, `results/completed-tabs.tsx`): tabs `#completed-tab-results` and `#completed-tab-board` with `aria-selected`; the Results view is a stack of `<section>` elements, each with one `<h2>`: "Thanks for participating", "Team health", "Surveys", "Top topics", "Action items", "Return on time invested". The sections are not nested, so `section:has(h2:has-text("Top topics"))` matches exactly one.
- The radar is `svg[aria-label="Team health radar"]`; the trend is `svg[aria-label="Trend across retros"]` inside the "Team health" section, rendered only when the server sends a trend (never to a guest).
- A rating changed in Completed broadcasts `roti.changed`; the other pages refetch the board one second later (`use-retro-board.ts`, `DebouncedRefetchMs`).
- No product file changes in this task.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan08dResultsTest.php`
- Test: `tests/Browser/Walkthroughs/Plan08dResultsTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` (plan 16a): `$this->signIn()`, `$this->joinAsGuest()`, `$this->awaitRealtime()`; the global `visit(string $url, array $options = [])` of the plugin.
  - `data-realtime` on `retros/show`, `data-test="retro-card-handle-{id}"` and `data-test="retro-column-{id}"` (plan 16a).
  - `tests/Pest.php`: `retroFacilitator()`, `retroMember()`, `answerSurvey()`.
  - Factories: `RetroFactory` (`inPhase()`, `withGuestAccess()`, `withHealthCheck()`), `CardFactory`, `ColumnFactory`, `VoteFactory`, `ActionItemFactory`, `HealthCheckAnswerFactory`, `RotiVoteFactory`, `SurveyFactory` (`closed()`, `text()`, `withOptions()`), `SurveyTextAnswerFactory`, `SurveyReactionFactory`, `SurveyCommentFactory`, `ParticipantFactory`.
  - Actions: `App\Actions\HealthCheck\FreezeHealthStatements::handle(Retro $retro): void`, `App\Actions\HealthCheck\ManageTeamHealthStatements::archive(Team $team, string $statement): void`.
  - This task does not need `$this->workQueue()` (plan 16b Task 1): nothing in these walkthroughs is queued or delayed.
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan08dResultsTest.php` (global functions; later files must not redeclare them): `p08dBoard(RetroPhase $phase = RetroPhase::Discussing, array $attributes = [], ?Team $team = null): array`, `p08dCard(Retro $retro, Column $column, Participant $author, string $content, array $attributes = []): Card`, `p08dSection(string $title): string`, `p08dInSection(string $title, string $expression): string`, `p08dHealthAnswers(Retro $retro, Participant $participant, array $scores): void`, `p08dPastRetro(Team $team, string $title, CarbonInterface $completedAt, array $scores): Retro`, `p08dRadar(string $expression): string`.

- [ ] **Step 1: Create the test file with its helpers and the group name tests (walkthrough steps 1 and 2)**

Create `tests/Browser/Walkthroughs/Plan08dResultsTest.php` directly with this content:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: array<int, Column>,
 *     2: User,
 *     3: User,
 *     4: Participant,
 *     5: Participant
 * }
 */
function p08dBoard(RetroPhase $phase = RetroPhase::Discussing, array $attributes = [], ?Team $team = null): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->withGuestAccess()
        ->create([
            'team_id' => $team ?? Team::factory(),
            'title' => 'Sprint 12',
            'completed_at' => $phase === RetroPhase::Completed ? now() : null,
            ...$attributes,
        ]);

    $columns = [];

    foreach (['Start', 'Stop'] as $position => $title) {
        $columns[] = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'position' => $position,
        ]);
    }

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $columns, $alice, $bob, $aliceParticipant, $bobParticipant];
}

/**
 * @param  array<string, mixed>  $attributes
 */
function p08dCard(Retro $retro, Column $column, Participant $author, string $content, array $attributes = []): Card
{
    return Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => $content,
        'position' => 0,
        ...$attributes,
    ]);
}

function p08dSection(string $title): string
{
    return "section:has(h2:has-text(\"{$title}\"))";
}

function p08dInSection(string $title, string $expression): string
{
    return "(() => { const section = [...document.querySelectorAll('section')].find((candidate) => candidate.querySelector('h2')?.textContent === '{$title}'); return {$expression}; })()";
}

it('[P08d-01a] shows a group name typed by a guest to the member without reloading', function () {
    [$retro, $columns, $alice, , , $bobParticipant] = p08dBoard(RetroPhase::Grouping);
    $lead = p08dCard($retro, $columns[0], $bobParticipant, 'Slow CI');
    p08dCard($retro, $columns[0], $bobParticipant, 'Flaky tests', ['parent_card_id' => $lead->id]);
    $group = "#card-{$lead->id}";
    $editor = '[aria-label="Group name"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->assertPresent("{$group} button:has-text(\"Name this group\")");

    $carolPage->assertPresent("{$group} button:has-text(\"Name this group\")")
        ->click("{$group} button:has-text(\"Name this group\")")
        ->assertVisible($editor)
        ->fill($editor, 'Pipeline')
        ->keys($editor, 'Enter')
        ->assertNotPresent($editor)
        ->assertSeeIn("{$group} [aria-label=\"Rename group\"]", 'Pipeline');

    $alicePage->assertSeeIn("{$group} [aria-label=\"Rename group\"]", 'Pipeline')
        ->assertNotPresent("{$group} button:has-text(\"Name this group\")");

    expect($lead->fresh()->group_name)->toBe('Pipeline');
});

it('[P08d-01b] drops the group name in both browsers when the only grouped card leaves the group', function () {
    [$retro, $columns, $alice, , , $bobParticipant] = p08dBoard(RetroPhase::Grouping);
    $lead = p08dCard($retro, $columns[0], $bobParticipant, 'Slow CI', ['group_name' => 'Pipeline']);
    $child = p08dCard($retro, $columns[0], $bobParticipant, 'Flaky tests', ['parent_card_id' => $lead->id]);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn("#card-{$lead->id} [aria-label=\"Rename group\"]", 'Pipeline');
    }

    $carolPage->click("#card-{$child->id} [aria-label=\"Ungroup\"]");

    foreach ([$carolPage, $alicePage] as $page) {
        $page->assertNotPresent("#card-{$lead->id} #card-{$child->id}")
            ->assertPresent("#card-{$child->id}")
            ->assertDontSee('Pipeline')
            ->assertNotPresent('[aria-label="Rename group"]')
            ->assertNotPresent('button:has-text("Name this group")');
    }

    expect($lead->fresh()->group_name)->toBeNull()
        ->and($child->fresh()->parent_card_id)->toBeNull();
});

it('[P08d-01c] keeps only the target name when a named group is grouped onto another named group', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = p08dBoard(RetroPhase::Grouping);
    $deploys = p08dCard($retro, $columns[0], $bobParticipant, 'Slow CI', ['group_name' => 'Deploys', 'position' => 0]);
    $deploysChild = p08dCard($retro, $columns[0], $bobParticipant, 'Manual releases', ['parent_card_id' => $deploys->id]);
    $quality = p08dCard($retro, $columns[0], $bobParticipant, 'Missing tests', ['group_name' => 'Quality', 'position' => 1]);
    p08dCard($retro, $columns[0], $bobParticipant, 'No code review', ['parent_card_id' => $quality->id]);
    $handle = "@retro-card-handle-{$deploys->id}";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertSeeIn("#card-{$deploys->id} [aria-label=\"Rename group\"]", 'Deploys')
        ->assertSeeIn("#card-{$quality->id} [aria-label=\"Rename group\"]", 'Quality')
        ->assertPresent($handle);

    $bobPage->keys($handle, 'Space')
        ->assertAttribute($handle, 'aria-pressed', 'true');
    $bobPage->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 0))');
    $bobPage->keys($handle, 'ArrowDown');
    $bobPage->script('() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
    $bobPage->keys($handle, 'Space')
        ->assertNotPresent($handle);

    foreach ([$bobPage, $alicePage] as $page) {
        $page->assertPresent("#card-{$quality->id} #card-{$deploys->id}")
            ->assertPresent("#card-{$quality->id} #card-{$deploysChild->id}")
            ->assertSeeIn("#card-{$quality->id} [aria-label=\"Rename group\"]", 'Quality')
            ->assertCount('[aria-label="Rename group"]', 1)
            ->assertDontSee('Deploys');
    }

    expect($deploys->fresh()->parent_card_id)->toBe($quality->id)
        ->and($deploys->fresh()->group_name)->toBeNull()
        ->and($deploysChild->fresh()->parent_card_id)->toBe($quality->id)
        ->and($quality->fresh()->group_name)->toBe('Quality');
});

it('[P08d-02a] renames a group inline for everyone', function (string $phase) {
    [$retro, $columns, $alice, , , $bobParticipant] = p08dBoard(RetroPhase::from($phase));
    $lead = p08dCard($retro, $columns[0], $bobParticipant, 'Slow CI', ['group_name' => 'Pipeline']);
    p08dCard($retro, $columns[0], $bobParticipant, 'Flaky tests', ['parent_card_id' => $lead->id]);
    $rename = "#card-{$lead->id} [aria-label=\"Rename group\"]";
    $editor = '[aria-label="Group name"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->assertSeeIn($rename, 'Pipeline');

    $carolPage->assertSeeIn($rename, 'Pipeline')
        ->click($rename)
        ->assertValue($editor, 'Pipeline')
        ->fill($editor, 'Delivery')
        ->keys($editor, 'Enter')
        ->assertNotPresent($editor)
        ->assertSeeIn($rename, 'Delivery');

    $alicePage->assertSeeIn($rename, 'Delivery')
        ->assertDontSee('Pipeline');

    expect($lead->fresh()->group_name)->toBe('Delivery');
})->with(['voting', 'discussing']);

it('[P08d-02b] shows the group name above the card in presentation mode', function () {
    [$retro, $columns, $alice, , , $bobParticipant] = p08dBoard(RetroPhase::Discussing, ['presentation_mode' => true]);
    $lead = p08dCard($retro, $columns[0], $bobParticipant, 'Slow CI', ['group_name' => 'Pipeline']);
    p08dCard($retro, $columns[0], $bobParticipant, 'Flaky tests', ['parent_card_id' => $lead->id]);
    $firstLines = '[...document.querySelectorAll(\'[role="dialog"] p\')].slice(0, 2).map((line) => line.textContent).join(" > ")';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertNotPresent('[role="dialog"]');

    $alicePage->click("#card-{$lead->id} button:has-text(\"Discuss\")");

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertPresent('[role="dialog"]')
            ->assertScript($firstLines, 'Pipeline > Slow CI')
            ->assertSeeIn('[role="dialog"]', 'Flaky tests');
    }

    expect($retro->fresh()->highlighted_card_id)->toBe($lead->id);
});
```

- [ ] **Step 2: Run the group name tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08dResultsTest.php --filter='P08d-0[12]'`
Expected: PASS (6 tests: five `it()` blocks, one of them run for two phases); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If `[P08d-01c]` drops the group where it started, see the harness findings ("Keyboard drag").

- [ ] **Step 3: Add the ROTI test of the Discussing phase (walkthrough step 3)**

In `tests/Browser/Walkthroughs/Plan08dResultsTest.php`, add this import to the `use` block (keep the block in alphabetical order):

```php
use App\Models\RotiVote;
```

Append to the file:

```php
it('[P08d-03] counts the ratings live during Discussing, shows no distribution and still takes a rating on a locked board', function () {
    [$retro, , $alice] = p08dBoard();
    $control = '[role="group"][aria-label="How was this retro?"]';
    $rate = fn (string $label): string => "{$control} button:has-text(\"{$label}\")";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertPresent($control)
            ->assertSee('0 ratings');
    }

    $carolPage->click($rate('Good use of time'))
        ->assertAriaAttribute($rate('Good use of time'), 'pressed', 'true')
        ->assertSee('1 rating');

    $alicePage->assertSee('1 rating')
        ->assertNotPresent("{$control} button[aria-pressed=\"true\"]");

    $alicePage->click($rate('Excellent use of time'))
        ->assertAriaAttribute($rate('Excellent use of time'), 'pressed', 'true')
        ->assertSee('2 ratings');

    $carolPage->assertSee('2 ratings')
        ->assertAriaAttribute($rate('Excellent use of time'), 'pressed', 'false');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertDontSee('Average:')
            ->assertDontSee('Return on time invested')
            ->assertNotPresent('svg[aria-label="Team health radar"]');
    }

    $alicePage->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertVisible('#retro-locked')
        ->click('#retro-locked')
        ->assertAriaAttribute('#retro-locked', 'checked', 'true')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Board closed for editing');

    $carolPage->assertSee('Board closed for editing')
        ->click($rate('Break-even'))
        ->assertAriaAttribute($rate('Break-even'), 'pressed', 'true')
        ->assertAriaAttribute($rate('Good use of time'), 'pressed', 'false')
        ->assertSee('2 ratings');

    expect(RotiVote::query()->where('retro_id', $retro->id)->orderBy('score')->pluck('score')->all())->toBe([3, 5]);

    $carolPage->click($rate('Break-even'))
        ->assertAriaAttribute($rate('Break-even'), 'pressed', 'false')
        ->assertSee('1 rating');

    $alicePage->assertSee('1 rating');

    expect($retro->fresh()->is_locked)->toBeTrue()
        ->and(RotiVote::query()->where('retro_id', $retro->id)->pluck('score')->all())->toBe([5]);
});
```

- [ ] **Step 4: Run the ROTI test**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08dResultsTest.php --filter='P08d-03'`
Expected: PASS (1 test); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Add the health helpers and the Results view tests (walkthrough step 4)**

In `tests/Browser/Walkthroughs/Plan08dResultsTest.php`, add these imports to the `use` block (keep the block in alphabetical order):

```php
use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Models\ActionItem;
use App\Models\HealthCheckAnswer;
use App\Models\Survey;
use App\Models\SurveyComment;
use App\Models\SurveyReaction;
use App\Models\SurveyTextAnswer;
use App\Models\Vote;
use Carbon\CarbonInterface;
```

Insert these helpers after `p08dInSection()` and before the first `it(`:

```php
/**
 * @param  array<string, int>  $scores
 */
function p08dHealthAnswers(Retro $retro, Participant $participant, array $scores): void
{
    foreach ($scores as $statement => $score) {
        HealthCheckAnswer::factory()->create([
            'retro_id' => $retro->id,
            'participant_id' => $participant->id,
            'statement' => $statement,
            'score' => $score,
        ]);
    }
}

/**
 * @param  array<string, int>  $scores
 */
function p08dPastRetro(Team $team, string $title, CarbonInterface $completedAt, array $scores): Retro
{
    $retro = Retro::factory()
        ->withHealthCheck()
        ->inPhase(RetroPhase::Completed)
        ->create(['team_id' => $team->id, 'title' => $title, 'completed_at' => $completedAt]);

    resolve(FreezeHealthStatements::class)->handle($retro);

    p08dHealthAnswers($retro, Participant::factory()->create(['retro_id' => $retro->id]), $scores);

    return $retro;
}

function p08dRadar(string $expression): string
{
    return "(() => { const svg = document.querySelector('svg[aria-label=\"Team health radar\"]'); return {$expression}; })()";
}
```

Append to the file:

```php
it('[P08d-04a] lands a member and a guest on the Results tab when the retro is completed', function () {
    [$retro, , $alice] = p08dBoard();
    $participants = p08dInSection('Thanks for participating', '[...section.querySelectorAll("li")].map((person) => [...person.querySelectorAll("span")].map((part) => part.textContent).join(" ")).sort().join(" | ")');

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertNotPresent('#completed-tab-results');

    $alicePage->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Completed')
            ->assertAriaAttribute('#completed-tab-results', 'selected', 'true')
            ->assertAriaAttribute('#completed-tab-board', 'selected', 'false')
            ->assertSee('Retrospective completed on')
            ->assertScript($participants, 'Alice Martin | Bob Stone | Carol Guest Guest')
            ->assertPresent(p08dSection('Top topics'))
            ->assertPresent(p08dSection('Action items'))
            ->assertPresent(p08dSection('Return on time invested'))
            ->assertNotPresent('[data-test^="retro-column-"]');
    }

    $alicePage->assertSee('Reopen');
    $carolPage->assertDontSee('Reopen');

    expect($retro->fresh()->phase)->toBe(RetroPhase::Completed);
});

it('[P08d-04b] exposes the team health radar, figures and trend to a member and no trend to a guest', function () {
    $team = Team::factory()->create();
    $first = p08dPastRetro($team, 'Sprint 10', now()->subWeeks(4), ['vision' => 6, 'motivation' => 6]);
    resolve(ManageTeamHealthStatements::class)->archive($team, 'motivation');
    $second = p08dPastRetro($team, 'Sprint 11', now()->subWeeks(2), ['vision' => 6, 'interaction' => 7]);
    [$retro, , , $bob, $aliceParticipant, $bobParticipant] = p08dBoard(RetroPhase::Completed, ['health_check_enabled' => true], $team);
    resolve(FreezeHealthStatements::class)->handle($retro);
    p08dHealthAnswers($retro, $aliceParticipant, ['interaction' => 8, 'task_clarity' => 6, 'manager_support' => 9, 'vision' => 4]);
    p08dHealthAnswers($retro, $bobParticipant, ['interaction' => 8, 'task_clarity' => 8, 'manager_support' => 9, 'vision' => 4]);
    $health = p08dSection('Team health');
    $figures = p08dInSection('Team health', '[...section.querySelectorAll("dl > div")].map((figure) => [...figure.children].map((part) => part.textContent).join(" ")).join(" | ")');
    $trend = fn (string $expression): string => "(() => { const svg = document.querySelector('svg[aria-label=\"Trend across retros\"]'); return {$expression}; })()";

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertPresent('svg[aria-label="Team health radar"]')
            ->assertScript(p08dRadar('svg.querySelector("desc").textContent'), 'Interaction: 8.0/10; Clear tasks: 7.0/10; Manager support: 9.0/10; Vision: 4.0/10; Processes: No answers')
            ->assertScript(p08dRadar('[...svg.querySelectorAll("text")].map((label) => label.firstChild.textContent).join(", ")'), 'Interaction, Clear tasks, Manager support, Vision, Processes')
            ->assertScript(p08dRadar('[...svg.querySelectorAll("tspan")].map((gap) => gap.textContent).join(", ")'), 'No answers')
            ->assertScript(p08dRadar('svg.querySelectorAll("circle").length'), 4)
            ->assertScript(p08dRadar('svg.querySelectorAll("line.stroke-primary").length'), 3)
            ->assertScript(p08dRadar('svg.querySelectorAll("polygon.stroke-primary").length'), 0)
            ->assertScript($figures, 'Score 7.0/10 | Participation 2 / 3 participants | Top strength Manager support 9.0/10 | Growth area Vision 4.0/10 | Alignment 9/10 High team consensus')
            ->assertSeeIn($health, 'Good')
            ->assertSeeIn($health, 'Most health scores are above average. Keep the momentum going.')
            ->assertSeeIn("{$health} li:has-text(\"Tasks assigned to me were clear\")", '7.0/10')
            ->assertSeeIn("{$health} li:has-text(\"Our processes let me work without blockers\")", 'No answers');
    }

    $bobPage->assertSeeIn($health, 'Trend across retros')
        ->assertScript($trend('[...svg.querySelectorAll("circle title")].map((point) => point.textContent).join(" | ")'), 'Sprint 10: 6.0/10 | Sprint 11: 6.5/10 — The statements changed since the previous retro | Sprint 12: 7.0/10')
        ->assertScript($trend('[...svg.querySelectorAll("circle")].map((point) => point.classList.contains("fill-background")).join(",")'), 'false,true,false')
        ->assertScript($trend('[...svg.querySelectorAll("a")].map((link) => link.getAttribute("href").split("/retros/")[1]).join(",")'), "{$first->id},{$second->id},{$retro->id}")
        ->assertScript($trend('svg.querySelector("polyline").getAttribute("points").split(" ").length'), 3)
        ->assertSeeIn($health, '+0.5 since the previous retro');

    $carolPage->assertNotPresent('svg[aria-label="Trend across retros"]')
        ->assertDontSeeIn($health, 'Trend across retros')
        ->assertDontSeeIn($health, 'since the previous retro')
        ->assertScript('document.documentElement.outerHTML.includes("Sprint 11")', false);
});

it('[P08d-04c] shows every survey with bars, percentages, voters, text answers, reactions and read-only comments', function () {
    [$retro, , , $bob, $aliceParticipant, $bobParticipant] = p08dBoard(RetroPhase::Completed);
    $choice = Survey::factory()->closed()->withOptions(['Great', 'Fine', 'Rough'])->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $aliceParticipant->id,
        'question' => 'How was the sprint?',
        'show_voters' => true,
        'position' => 0,
    ]);
    $freeText = Survey::factory()->text()->closed()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $aliceParticipant->id,
        'question' => 'What should we try next?',
        'show_voters' => true,
        'position' => 1,
    ]);
    answerSurvey($choice, $aliceParticipant, 0);
    answerSurvey($choice, $bobParticipant, 0);
    SurveyTextAnswer::factory()->create(['survey_id' => $freeText->id, 'participant_id' => $bobParticipant->id, 'content' => 'Shorter standups']);
    SurveyReaction::factory()->create(['retro_id' => $retro->id, 'survey_id' => $choice->id, 'participant_id' => $aliceParticipant->id, 'emoji' => '👍']);
    SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $choice->id, 'participant_id' => $aliceParticipant->id, 'content' => 'Pairing saved us']);
    $surveys = p08dSection('Surveys');
    $single = 'article[aria-label="How was the sprint?"]';
    $text = 'article[aria-label="What should we try next?"]';
    $great = "{$single} li:has-text(\"Great\")";
    $fine = "{$single} li:has-text(\"Fine\")";
    $barWidths = "[...document.querySelectorAll('{$single} li div.bg-primary')].map((bar) => bar.style.width).join(',')";

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertCount("{$surveys} article", 2)
            ->assertSeeIn($great, '100% · 2')
            ->assertSeeIn($fine, '0% · 0')
            ->assertScript($barWidths, '100%,0%,0%')
            ->assertPresent("{$great} img[alt=\"Alice Martin\"]")
            ->assertPresent("{$great} img[alt=\"Bob Stone\"]")
            ->assertNotPresent("{$fine} img")
            ->assertSeeIn($single, '2 responses')
            ->assertSeeIn("{$text} ul[aria-label=\"Answers\"] li", 'Shorter standups')
            ->assertSeeIn("{$text} ul[aria-label=\"Answers\"] li", 'Bob Stone')
            ->assertSeeIn($text, '1 response')
            ->assertDisabled("{$single} [aria-label=\"👍, 1 reaction\"]")
            ->assertNotPresent('[aria-label="Add a reaction"]')
            ->assertNotPresent('[aria-label="Survey actions"]')
            ->assertDontSeeIn($single, 'Pairing saved us')
            ->click("{$single} button[aria-label=\"Comments (1)\"]")
            ->assertSeeIn($single, 'Pairing saved us')
            ->assertSeeIn($single, 'Alice Martin')
            ->assertNotPresent('[aria-label="Write a comment…"]');
    }
});

it('[P08d-04d] lists the top topics with their group name and grouped count, and the action items', function () {
    [$retro, $columns, , $bob, $aliceParticipant, $bobParticipant] = p08dBoard(RetroPhase::Completed);
    $lead = p08dCard($retro, $columns[0], $aliceParticipant, 'Slow CI', ['group_name' => 'Pipeline']);
    p08dCard($retro, $columns[0], $aliceParticipant, 'Flaky tests', ['parent_card_id' => $lead->id]);
    p08dCard($retro, $columns[0], $aliceParticipant, 'Manual releases', ['parent_card_id' => $lead->id, 'position' => 1]);
    $single = p08dCard($retro, $columns[1], $bobParticipant, 'Too many meetings');
    p08dCard($retro, $columns[1], $bobParticipant, 'Nobody reads the wiki', ['position' => 1]);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $lead->id, 'participant_id' => $bobParticipant->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $single->id, 'participant_id' => $aliceParticipant->id]);
    ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Buy a faster runner',
        'created_by_participant_id' => $aliceParticipant->id,
    ]);
    $topics = p08dInSection('Top topics', '[...section.querySelectorAll("ol > li")].map((topic) => [...topic.querySelectorAll("p, span")].map((part) => part.textContent).join(" / ")).join(" | ")');

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertScript($topics, 'Pipeline / Slow CI / 2 grouped cards / 3 | Too many meetings / 1 | Nobody reads the wiki / 0')
            ->assertSeeIn(p08dSection('Action items'), 'Buy a faster runner')
            ->assertNotPresent('[aria-label="Add an action item…"]')
            ->assertNotPresent('[aria-label="Rename group"]');
    }
});

it('[P08d-04e] shows the ROTI average, distribution and respondent count in the Results view', function () {
    [$retro, , , $bob, $aliceParticipant, $bobParticipant] = p08dBoard(RetroPhase::Completed);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $aliceParticipant->id, 'score' => 4]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $bobParticipant->id, 'score' => 5]);
    $roti = p08dSection('Return on time invested');
    $control = '[role="group"][aria-label="How was this retro?"]';
    $rows = p08dInSection('Return on time invested', '[...section.querySelectorAll("ul li")].map((row) => row.firstElementChild.textContent + " = " + row.lastElementChild.textContent).join(" | ")');
    $bars = p08dInSection('Return on time invested', '[...section.querySelectorAll("ul li div > div")].map((bar) => bar.style.width).join(",")');

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertSeeIn($roti, 'Average: 4.5/5')
            ->assertSeeIn($roti, '2 ratings')
            ->assertScript($rows, '1 · Time wasted = 0 | 2 · Not really worth it = 0 | 3 · Break-even = 0 | 4 · Good use of time = 1 | 5 · Excellent use of time = 1')
            ->assertScript($bars, '0%,0%,0%,100%,100%');
    }

    $bobPage->assertAriaAttribute("{$control} button:has-text(\"Excellent use of time\")", 'pressed', 'true');
    $carolPage->assertNotPresent("{$control} button[aria-pressed=\"true\"]");
});
```

- [ ] **Step 6: Run the Results view tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08dResultsTest.php --filter='P08d-04'`
Expected: PASS (5 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. The figures of `[P08d-04b]` follow `SummarizeHealthCheck` and `BuildHealthTrend`: averages 8.0, 7.0, 9.0 and 4.0 give the score 7.0; the consensus values 10, 7.8, 10 and 10 give the alignment 9; the trend scores are 6.0, 6.5 and 7.0. If a figure differs, recompute it from those two classes before changing the expectation.

- [ ] **Step 7: Add the live refresh, tab and reduced motion tests (walkthrough steps 5 and 6)**

Append to `tests/Browser/Walkthroughs/Plan08dResultsTest.php` (no new import is needed):

```php
it('[P08d-05a] refreshes the Results view of the other browser when a rating is given or changed', function () {
    [$retro, , $alice] = p08dBoard(RetroPhase::Completed);
    $roti = p08dSection('Return on time invested');
    $control = '[role="group"][aria-label="How was this retro?"]';
    $rate = fn (string $label): string => "{$control} button:has-text(\"{$label}\")";
    $counts = p08dInSection('Return on time invested', '[...section.querySelectorAll("ul li")].map((row) => row.lastElementChild.textContent).join(",")');

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($roti, 'No ratings yet.')
            ->assertSeeIn($roti, '0 ratings');
    }

    $carolPage->click($rate('Good use of time'))
        ->assertAriaAttribute($rate('Good use of time'), 'pressed', 'true')
        ->assertSeeIn($roti, 'Average: 4.0/5')
        ->assertScript($counts, '0,0,0,1,0');

    $alicePage->assertSeeIn($roti, 'Average: 4.0/5')
        ->assertSeeIn($roti, '1 rating')
        ->assertScript($counts, '0,0,0,1,0')
        ->assertNotPresent("{$control} button[aria-pressed=\"true\"]");

    $carolPage->click($rate('Not really worth it'))
        ->assertAriaAttribute($rate('Not really worth it'), 'pressed', 'true')
        ->assertSeeIn($roti, 'Average: 2.0/5');

    $alicePage->assertSeeIn($roti, 'Average: 2.0/5')
        ->assertSeeIn($roti, '1 rating')
        ->assertScript($counts, '0,1,0,0,0');

    expect(RotiVote::query()->where('retro_id', $retro->id)->pluck('score')->all())->toBe([2]);
});

it('[P08d-05b] switches between the Results and Board tabs and selects Results again after a reopen and a new completion', function () {
    [$retro, $columns, $alice, , $aliceParticipant] = p08dBoard(RetroPhase::Completed);
    $card = p08dCard($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $thanks = p08dSection('Thanks for participating');

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertAriaAttribute('#completed-tab-results', 'selected', 'true')
        ->assertPresent($thanks)
        ->click('#completed-tab-board')
        ->assertAriaAttribute('#completed-tab-board', 'selected', 'true')
        ->assertPresent("#card-{$card->id}")
        ->assertNotPresent($thanks)
        ->click('#completed-tab-results')
        ->assertAriaAttribute('#completed-tab-results', 'selected', 'true')
        ->assertPresent($thanks)
        ->assertNotPresent("#card-{$card->id}");

    foreach ([$alicePage, $carolPage] as $page) {
        $page->click('#completed-tab-board')
            ->assertAriaAttribute('#completed-tab-board', 'selected', 'true')
            ->assertPresent("#card-{$card->id}");
    }

    $alicePage->press('Reopen')
        ->assertSeeIn('[aria-current="step"]', 'Discussing');

    $carolPage->assertSeeIn('[aria-current="step"]', 'Discussing')
        ->assertNotPresent('#completed-tab-results')
        ->assertPresent('[aria-label="Add an action item…"]');

    $alicePage->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Completed')
            ->assertAriaAttribute('#completed-tab-results', 'selected', 'true')
            ->assertPresent($thanks)
            ->assertNotPresent("#card-{$card->id}");
    }

    expect($retro->fresh()->phase)->toBe(RetroPhase::Completed);
});

it('[P08d-06] gives the result bars no transition and the charts no animation when the viewer prefers reduced motion', function () {
    [$retro, , , , $aliceParticipant] = p08dBoard(RetroPhase::Completed, ['health_check_enabled' => true]);
    resolve(FreezeHealthStatements::class)->handle($retro);
    p08dHealthAnswers($retro, $aliceParticipant, ['vision' => 8, 'interaction' => 6]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $aliceParticipant->id, 'score' => 4]);
    $joinPath = "/join/{$retro->guest_token}";
    $prefersReducedMotion = 'window.matchMedia("(prefers-reduced-motion: reduce)").matches';
    $barTransition = p08dInSection('Return on time invested', 'getComputedStyle(section.querySelector("ul li div > div")).transitionDuration');
    $barHasTransition = p08dInSection('Return on time invested', 'getComputedStyle(section.querySelector("ul li div > div")).transitionDuration !== "0s"');
    $chartIsStill = p08dRadar('[...svg.querySelectorAll("polygon, line, circle")].every((shape) => getComputedStyle(shape).animationName === "none" && getComputedStyle(shape).transitionDuration === "0s")');
    $animationElements = 'document.querySelectorAll("svg animate, svg animateTransform, svg animateMotion, svg set").length';

    $reducedPage = visit($joinPath, ['reducedMotion' => 'reduce']);

    $reducedPage->fill('#name', 'Carol Guest')
        ->click('Join')
        ->assertPathIsNot($joinPath);

    $reducedPage->assertSee('Return on time invested')
        ->assertPresent('svg[aria-label="Team health radar"]')
        ->assertScript($prefersReducedMotion, true)
        ->assertScript($barTransition, '0s')
        ->assertScript($chartIsStill, true)
        ->assertScript($animationElements, 0);

    $defaultPage = $this->joinAsGuest($joinPath, 'Dave Guest');

    $defaultPage->assertSee('Return on time invested')
        ->assertScript($prefersReducedMotion, false)
        ->assertScript($barHasTransition, true)
        ->assertScript($chartIsStill, true)
        ->assertScript($animationElements, 0);
});
```

- [ ] **Step 8: Run the live refresh, tab and reduced motion tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08dResultsTest.php --filter='P08d-0[56]'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. `[P08d-06]` is the first use of a context option in this suite. If `window.matchMedia("(prefers-reduced-motion: reduce)").matches` is `false` on the first page, the plugin did not pass `reducedMotion` to the browser context: see the harness findings, record the finding there, remove the test, and change the `P08d-06` coverage row to `residual` with the text given in this plan's residual entry for `P08d-06v`.

- [ ] **Step 9: Format and check Rector**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue; keep Pint's result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector`, then `vendor/bin/pint --dirty --format agent` again.

- [ ] **Step 10: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08dResultsTest.php`
Expected: PASS (15 tests: fourteen `it()` blocks, `[P08d-02a]` run for two phases).

- [ ] **Step 11: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan08dResultsTest.php
git commit -m "test(browser): cover the results walkthrough: group names, ROTI, Results view, reduced motion"
```

### Task 7: LLM features walkthrough, without a provider (plan 8e, Step 2) and the configuration switch

This task automates the three "without a key" items of the plan 8e walkthrough (`docs/superpowers/plans/2026-09-30-plan-8e-llm.md`, lines 5505 to 5509) and proves the switch that Task 8 relies on: setting `services.llm` in the test makes the LLM controls appear in the browser.

Facts read from the current code that the tests rely on:

- The LLM features exist only when `App\Support\Llm\Llm::isConfigured()` is true: `services.llm.provider` is `anthropic` or `openai`, and `services.llm.key` and `services.llm.model` are non-empty strings (`app/Support/Llm/Llm.php`). `phpunit.xml` empties `SKRUM_LLM_PROVIDER` and `SKRUM_LLM_API_KEY` only, so the tests of this task set the whole `services.llm` array themselves and do not depend on the machine's `.env`.
- Nothing about the LLM is in the Inertia shared props (`HandleInertiaRequests` has no LLM key). Two places carry it: the team page prop `llm: {enabled, provider}` (`TeamsController::show`) and the board snapshot `features: {llm, llmProvider}` (`BuildBoardSnapshot`). Both are computed per request from configuration, and the application runs in the test process, so `config([...])` in the test applies to the next browser request. No asset rebuild is needed.
- `tests/Pest.php` already has `configureLlm(string $provider = 'anthropic', ?string $baseUrl = null): void` (provider `anthropic`, key `llm-secret-key`, model `test-model`), `fakeLlmReply(array|string $reply): void`, `fakeLlmFailure(): void` and `llmRequestBodies(): string`. With no base URL the provider is displayed as `Anthropic`.
- The creation switch is `<button role="checkbox" id="new-retro-ai-summary">` inside the dialog's collapsed "Settings" block (`resources/js/components/teams/new-retro-dialog.tsx`); the block's trigger is the only `[data-slot="collapsible-trigger"]` in the dialog. The settings switch is `#retro-ai-summary` (`resources/js/components/retro/settings-dialog.tsx`). The survey draft field is `#survey-draft-prompt` (`survey-draft-field.tsx`). The summary section is `<section aria-labelledby="results-summary">` (`insights/summary-section.tsx`). The Discussing panel is `<aside aria-label="Suggestions">` (`suggestions-panel.tsx`). A card's sentiment is an `<svg role="img" aria-label="Positive|Neutral|Negative">` and its category a badge inside `#card-<id>` (`card-insight.tsx`). None of these needs a `data-test` hook.
- A group lead shows "Name this group" in Grouping, Voting and Discussing (`group-name.tsx`), which gives the "no Suggest group names button" assertion something visible to wait for.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan08eLlmTest.php`
- Test: `tests/Browser/Walkthroughs/Plan08eLlmTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn(User $user, string $to): mixed` and `$this->awaitRealtime(mixed $page): mixed` (plan 16a).
  - Helpers in `tests/Pest.php`: `teamMember(Team $team): User`, `retroFacilitator(Retro $retro): array{0: User, 1: Participant}`, `retroMember(Retro $retro): array{0: User, 1: Participant}`, `configureLlm(string $provider = 'anthropic', ?string $baseUrl = null): void`.
  - Factories: `RetroFactory::inPhase()`, `RetroFactory::withGuestAccess()`, `ColumnFactory`, `CardFactory`, `RetroThemeFactory`, `SuggestedActionFactory`.
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan08eLlmTest.php` (global functions; later files may call them but must not redeclare them): `p08eWithoutLlm(): void`, `p08eBoard(RetroPhase $phase, array $attributes = []): array{0: Retro, 1: array<int, Column>, 2: User, 3: Participant, 4: Participant}` (retro "Sprint 12" with guest access and `ai_summary_enabled = true`, columns "Went well" and "To improve", facilitator "Alice Martin", member "Bob Stone"), `p08eCard(Retro $retro, Column $column, Participant $author, string $content, int $position = 0, array $attributes = []): Card`, `p08eGroup(Retro $retro, Column $column, Participant $author, string $lead, string $child, int $position = 0): Card`.
  - No product hook.

- [ ] **Step 1: Create the test file with its helpers and the "without a key" tests**

`php artisan make:test` cannot write under `tests/Browser`, so create `tests/Browser/Walkthroughs/Plan08eLlmTest.php` directly with this content:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\SuggestedAction;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Http;

function p08eWithoutLlm(): void
{
    config(['services.llm' => ['provider' => null, 'key' => null, 'model' => null, 'base_url' => null]]);
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: array<int, Column>,
 *     2: User,
 *     3: Participant,
 *     4: Participant
 * }
 */
function p08eBoard(RetroPhase $phase, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->withGuestAccess()
        ->create(['title' => 'Sprint 12', 'ai_summary_enabled' => true, ...$attributes]);

    $columns = [];

    foreach (['Went well', 'To improve'] as $position => $title) {
        $columns[] = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'position' => $position,
        ]);
    }

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $columns, $alice, $aliceParticipant, $bobParticipant];
}

/**
 * @param  array<string, mixed>  $attributes
 */
function p08eCard(Retro $retro, Column $column, Participant $author, string $content, int $position = 0, array $attributes = []): Card
{
    return Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => $content,
        'position' => $position,
        ...$attributes,
    ]);
}

function p08eGroup(Retro $retro, Column $column, Participant $author, string $lead, string $child, int $position = 0): Card
{
    $leadCard = p08eCard($retro, $column, $author, $lead, $position);

    p08eCard($retro, $column, $author, $child, 0, ['parent_card_id' => $leadCard->id]);

    return $leadCard;
}

it('[P08e-01a] offers no AI summary switch in the new retrospective dialog without a complete provider configuration', function (array $llm) {
    config(['services.llm' => $llm]);

    $team = Team::factory()->create();
    $alice = teamMember($team);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);

    $page = $this->signIn($alice, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->click('[role="dialog"] [data-slot="collapsible-trigger"]')
        ->assertVisible('#new-retro-votes-auto')
        ->assertNotPresent('#new-retro-ai-summary')
        ->assertDontSee('Automatic AI summary');
})->with([
    'nothing configured' => [['provider' => null, 'key' => null, 'model' => null, 'base_url' => null]],
    'a key without a model' => [['provider' => 'anthropic', 'key' => 'llm-secret-key', 'model' => null, 'base_url' => null]],
]);

it('[P08e-01b] offers no AI summary switch in the board settings without a provider', function () {
    p08eWithoutLlm();

    [$retro, , $alice] = p08eBoard(RetroPhase::Writing);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSee('Retrospective settings')
        ->assertPresent('#retro-locked')
        ->assertNotPresent('#retro-ai-summary')
        ->assertDontSee('Automatic AI summary');
});

it('[P08e-02a] offers no "Generate from a prompt" field in the survey dialog without a provider', function () {
    p08eWithoutLlm();

    [$retro, , $alice] = p08eBoard(RetroPhase::Writing);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->assertSee('Add survey')
        ->click('Add survey')
        ->assertSee('New survey')
        ->assertVisible('#survey-question')
        ->assertNotPresent('#survey-draft-prompt')
        ->assertDontSee('Generate from a prompt');
});

it('[P08e-02b] offers no "Suggest group names" button during Grouping without a provider', function () {
    p08eWithoutLlm();

    [$retro, $columns, $alice, , $bobParticipant] = p08eBoard(RetroPhase::Grouping);
    $lead = p08eGroup($retro, $columns[1], $bobParticipant, 'Deploys are slow', 'CI is flaky');

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->assertSeeIn("#card-{$lead->id}", 'Name this group')
        ->assertDontSee('Suggest group names')
        ->assertDontSee('Card contents of these groups are sent to');
});

it('[P08e-03a] completes a retro without a provider: no summary section, no card insight, nothing sent', function () {
    p08eWithoutLlm();
    Http::fake();

    [$retro, $columns, $alice, , $bobParticipant] = p08eBoard(RetroPhase::Discussing);
    $card = p08eCard($retro, $columns[1], $bobParticipant, 'Deploys are slow', 0, [
        'sentiment' => 'negative',
        'category' => 'Tooling',
    ]);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed')
        ->assertSee('Top topics')
        ->assertNotPresent('[aria-labelledby="results-summary"]')
        ->assertDontSee('Generate summary')
        ->assertDontSee('Generating the summary…')
        ->click('#completed-tab-board')
        ->assertSeeIn("#card-{$card->id}", 'Deploys are slow')
        ->assertNotPresent("#card-{$card->id} [aria-label=\"Negative\"]")
        ->assertDontSeeIn("#card-{$card->id}", 'Tooling');

    Http::assertNothingSent();

    expect($retro->fresh()->summary_status)->toBeNull()
        ->and($retro->fresh()->summary)->toBeNull();
});

it('[P08e-03b] shows no Suggestions panel in Discussing without a provider, and shows it once a provider is configured', function () {
    p08eWithoutLlm();

    [$retro, $columns, $alice, , $bobParticipant] = p08eBoard(RetroPhase::Discussing);
    $card = p08eCard($retro, $columns[1], $bobParticipant, 'Deploys are slow', 0, [
        'sentiment' => 'negative',
        'category' => 'Tooling',
    ]);
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Release pain']);
    $theme->cards()->attach($card->id);
    SuggestedAction::factory()->create([
        'retro_id' => $retro->id,
        'theme_id' => $theme->id,
        'content' => 'Automate releases',
    ]);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->assertPresent('[aria-label="Add an action item…"]')
        ->assertNotPresent('aside[aria-label="Suggestions"]')
        ->assertDontSee('Automate releases')
        ->assertNotPresent("#card-{$card->id} [aria-label=\"Negative\"]");

    configureLlm();

    $page->navigate("/retros/{$retro->id}")
        ->assertSeeIn('aside[aria-label="Suggestions"]', 'Release pain')
        ->assertSeeIn('aside[aria-label="Suggestions"]', 'Automate releases')
        ->assertPresent("#card-{$card->id} [aria-label=\"Negative\"]")
        ->assertSeeIn("#card-{$card->id}", 'Tooling');
});
```

`[P08e-03a]` and `[P08e-03b]` put a sentiment, a category, a theme and a suggestion in the database before the page opens, as if a provider had been configured earlier and removed since: without them "no insight is shown" would be true of an empty board too. `[P08e-03b]` then turns the provider on with `configureLlm()` and reloads, which proves that configuration set in the test reaches browser requests; Task 8 depends on that.

- [ ] **Step 2: Run the tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08eLlmTest.php --filter='P08e-0[1-3]'`
Expected: PASS (7 tests: `[P08e-01a]` runs twice). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If `[P08e-03b]` fails only after `configureLlm()`, see the harness findings.

- [ ] **Step 3: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed for `tests/Browser/Walkthroughs/Plan08eLlmTest.php`. If Rector proposes one, run `composer rector` and keep its result.

- [ ] **Step 4: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan08eLlmTest.php
git commit -m "test(browser): cover the LLM walkthrough without a provider"
```

### Task 8: LLM features walkthrough, with a provider (plan 8e, Step 3)

This task automates the eight "with a key" items of the plan 8e walkthrough (`docs/superpowers/plans/2026-09-30-plan-8e-llm.md`, lines 5511 to 5520) in the file created by Task 7. The provider is faked in process with `Http::fake()`; the skrum interface is driven for real, and each test asserts both what the browser shows and what skrum sent.

Facts read from the current code that the tests rely on:

- **Provider request.** With provider `anthropic` and no base URL, `AnthropicClient` posts to `https://api.anthropic.com/v1/messages` with the header `x-api-key` and a JSON body `{model, max_tokens, system, messages: [{role: "user", content: "<JSON string>"}]}`, and reads the reply from `content.0.text`. `fakeLlmReply()` in `tests/Pest.php` fakes exactly that shape for every call; a test that needs different replies in order builds an `Http::sequence()` of the same shape with the helper `p08eAnthropicResponse()` added below.
- **Reply shapes** (copied from `tests/Feature/Retros/RetroSummaryJobTest.php`, `GroupNameSuggestionsTest.php` and `SurveyDraftsTest.php`): summary `{summary, themes: [{name, cardIds}], suggestedActions: [{content, theme?}], cardInsights: [{cardId, sentiment, category}]}`, where the card ids are the per-request indexes 1, 2, … that `BuildSummaryInput` assigns most-voted first, then by position; group names `[{index, name}]`, indexes following the leads' position; survey draft `{question, description, options}`.
- **Synchronous calls.** The survey draft (`SurveyDraftsController`) and the group-name suggestions (`GroupNameSuggestionsController`) call the provider inside the browser request. They need no queue.
- **Queued call.** The summary is the job `App\Jobs\GenerateRetroSummary`, dispatched after commit when the retro is completed with `ai_summary_enabled` (`ChangeRetroPhase::queueSummary`) and by `POST /retros/{retro}/summary` (Generate, Regenerate, Retry). `phpunit.xml` sets the `sync` queue, under which the job would run inside the facilitator's request and "Generating the summary…" would never be visible. Every summary test therefore sets `config(['queue.default' => 'database'])` first and runs the job with `$this->workQueue()`, which also makes the job's broadcasts (`results.changed`, `insights.changed`) reach every page, the facilitator's included.
- **Failure.** The job has `tries = 3` with a backoff of 10 s then 60 s. A provider error throws `LlmUnavailable`, the worker releases the job, and after the third attempt `failed()` sets `summary_status = failed` and broadcasts. The test travels 11 s and 61 s between the three runs.
- **Stale pending.** Nothing marks a stale summary as failed: `Retro::effectiveSummaryStatus()` reads a `pending` whose `summary_requested_at` is older than 10 minutes as `failed` each time the snapshot is built. The page does not poll, so the test travels 11 minutes and reloads. The database still says `pending`.
- **Who sees what** (`summary-section.tsx`). Pending: everyone sees "Generating the summary…". Ready: everyone sees the text and "Generated with Anthropic". Failed or never generated: only the facilitator sees the section, with "Retry" or "Generate summary" and the notice "The board content is sent to Anthropic to write the summary."; another viewer sees the section only if handled suggestions remain.
- **Suggestions** (`insights/suggestions-list.tsx`). A pending suggestion is an `<li>` with the buttons "Promote" and "Reject" for those allowed (in Completed: the facilitator and workspace managers). A promoted one becomes `<a title="Added to action items" href="#action-item-<id>">`. Rejected ones sit under `<summary>Dismissed (1)</summary>`. The action item shows the badge "Theme: Release pain" in the Results view (`results/action-items-results.tsx`, `<li id="action-item-<id>">`).
- **Group names** (`group-name-suggestions.tsx`, `group-name.tsx`). The button "Suggest group names" is in the board header for every participant when the retro has `ai_summary_enabled`, the phase is Grouping, Voting or Discussing, and an unnamed group exists. A suggestion is `<span title="Suggested name">` inside the lead card with the buttons "Use this name" and "Edit this name"; the editor is `<input aria-label="Group name">`.
- A guest joins while the retro is still in Discussing or earlier, and the facilitator completes the retro through the interface; no test joins a guest on an already completed retro.
- No product hook is needed.

**Files:**
- Modify: `tests/Browser/Walkthroughs/Plan08eLlmTest.php`
- Test: `tests/Browser/Walkthroughs/Plan08eLlmTest.php`

**Interfaces:**
- Consumes:
  - `$this->workQueue(): void` from `Tests\Browser\Support\InteractsWithBrowser` (plan 16b Task 1): runs one queued job with `queue:work --once` outside any browser request. If plan 16b has not been merged when this task starts, see "Notes for the lead" for the local replacement.
  - `$this->signIn()`, `$this->joinAsGuest(string $joinUrl, string $name): mixed`, `$this->awaitRealtime()` (plan 16a).
  - `configureLlm()`, `fakeLlmReply(array|string $reply): void`, `llmRequestBodies(): string`, `teamMember()` from `tests/Pest.php`.
  - `p08eBoard()`, `p08eCard()`, `p08eGroup()` from Task 7.
  - Factories: `VoteFactory`, `CardCommentFactory`, `ActionItemFactory`.
- Produces:
  - File-level helpers: `p08eSummaryReply(array $overrides = []): array<string, mixed>`, `p08eAnthropicResponse(array $reply): array<string, mixed>`.

- [ ] **Step 1: Add the imports and the two reply helpers**

In `tests/Browser/Walkthroughs/Plan08eLlmTest.php`, replace the import block at the top of the file:

```php
use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\SuggestedAction;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Http;
```

with:

```php
use App\Enums\RetroPhase;
use App\Enums\SuggestedActionStatus;
use App\Enums\SummaryStatus;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\SuggestedAction;
use App\Models\Survey;
use App\Models\Team;
use App\Models\User;
use App\Models\Vote;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
```

Pint removes an import that nothing uses yet. If you format between the steps of this task, re-add the imports that the next step needs.

Then add these two functions after `p08eGroup()` and before the first `it(`:

```php
/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function p08eSummaryReply(array $overrides = []): array
{
    return [
        'summary' => 'The team shipped but releases hurt.',
        'themes' => [['name' => 'Release pain', 'cardIds' => [1]]],
        'suggestedActions' => [
            ['content' => 'Automate releases', 'theme' => 'Release pain'],
            ['content' => 'Keep pairing'],
        ],
        'cardInsights' => [
            ['cardId' => 1, 'sentiment' => 'negative', 'category' => 'Tooling'],
            ['cardId' => 2, 'sentiment' => 'positive', 'category' => 'Collaboration'],
        ],
        ...$overrides,
    ];
}

/**
 * @param  array<array-key, mixed>  $reply
 * @return array<string, mixed>
 */
function p08eAnthropicResponse(array $reply): array
{
    return ['content' => [['type' => 'text', 'text' => (string) json_encode($reply)]]];
}
```

- [ ] **Step 2: Add the opt-out control tests (walkthrough item 1, spec §6.3)**

Append to the file:

```php
it('[P08e-04a] turns the AI summary on by default in the new retrospective dialog and names the provider in the privacy notice', function () {
    configureLlm();

    $team = Team::factory()->create();
    $alice = teamMember($team);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);

    $page = $this->signIn($alice, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 13 retro')
        ->assertSee('Start, Stop, Continue')
        ->click('[role="dialog"] li button:has-text("Start, Stop, Continue")')
        ->click('[role="dialog"] [data-slot="collapsible-trigger"]')
        ->assertVisible('#new-retro-ai-summary')
        ->assertAriaAttribute('#new-retro-ai-summary', 'checked', 'true')
        ->assertSeeIn('[role="dialog"]', 'Automatic AI summary')
        ->assertSeeIn('[role="dialog"]', 'When the retro is completed, its board content is sent automatically to Anthropic to write a summary. Participants can also ask it to suggest group names. Turn this off to keep it on this server.')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header > h1', 'Sprint 13 retro');

    expect(Retro::query()->where('title', 'Sprint 13 retro')->firstOrFail()->ai_summary_enabled)->toBeTrue();
});

it('[P08e-04b] lets the facilitator turn the AI summary off in the board settings, with the same privacy notice', function () {
    configureLlm();

    [$retro, , $alice] = p08eBoard(RetroPhase::Writing);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSee('Retrospective settings')
        ->assertAriaAttribute('#retro-ai-summary', 'checked', 'true')
        ->assertSeeIn('[role="dialog"]', 'its board content is sent automatically to Anthropic to write a summary')
        ->click('#retro-ai-summary')
        ->assertAriaAttribute('#retro-ai-summary', 'checked', 'false')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]');

    expect($retro->fresh()->ai_summary_enabled)->toBeFalse();

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSee('Retrospective settings')
        ->assertAriaAttribute('#retro-ai-summary', 'checked', 'false');
});

it('[P08e-04c] locks the AI summary switch once the retro is completed', function () {
    configureLlm();

    [$retro, , $alice] = p08eBoard(RetroPhase::Completed, ['completed_at' => now()]);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSee('Retrospective settings')
        ->assertAriaAttribute('#retro-ai-summary', 'checked', 'true')
        ->assertScript("document.querySelector('#retro-ai-summary').disabled", true);
});
```

- [ ] **Step 3: Run the opt-out control tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08eLlmTest.php --filter='P08e-04'`
Expected: PASS (3 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 4: Add the survey draft tests (walkthrough item 2)**

Append to the file:

```php
it('[P08e-05a] fills the survey dialog from a prompt and puts nothing on the board until Save', function () {
    configureLlm();
    fakeLlmReply([
        'question' => 'How was the pace?',
        'description' => 'Think about the whole sprint.',
        'options' => ['Too slow', 'Right', 'Too fast'],
    ]);

    [$retro, , $alice] = p08eBoard(RetroPhase::Writing);
    $surveys = 'section[aria-label="Surveys"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->assertSee('Add survey')
        ->click('Add survey')
        ->assertVisible('#survey-draft-prompt')
        ->assertSeeIn('[role="dialog"]', 'Generate from a prompt')
        ->assertSeeIn('[role="dialog"]', 'Your prompt and the retro title are sent to Anthropic.')
        ->fill('#survey-draft-prompt', 'ask about the sprint pace')
        ->click('[role="dialog"] button:has-text("Generate")')
        ->assertValue('#survey-question', 'How was the pace?')
        ->assertValue('#survey-description', 'Think about the whole sprint.')
        ->assertValue('[aria-label="Option 1"]', 'Too slow')
        ->assertValue('[aria-label="Option 2"]', 'Right')
        ->assertValue('[aria-label="Option 3"]', 'Too fast')
        ->assertNotPresent('[aria-label="Option 4"]')
        ->assertNotPresent($surveys);

    $carolPage->assertNotPresent($surveys)
        ->assertDontSee('How was the pace?');

    expect(Survey::query()->count())->toBe(0);

    Http::assertSentCount(1);
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.anthropic.com/v1/messages'
        && $request->hasHeader('x-api-key', 'llm-secret-key'));

    expect(llmRequestBodies())
        ->toContain('ask about the sprint pace')
        ->toContain('Sprint 12')
        ->toContain('single')
        ->not->toContain('Alice Martin')
        ->not->toContain('Carol Guest')
        ->not->toContain($alice->email);

    $alicePage->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($surveys, 'How was the pace?');

    $carolPage->assertSeeIn($surveys, 'How was the pace?');

    expect(Survey::query()->where('retro_id', $retro->id)->firstOrFail()->options()->count())->toBe(3);
});

it('[P08e-05b] fills no options when the survey is a free text question', function () {
    configureLlm();
    fakeLlmReply(['question' => 'What should we try next?', 'options' => ['First idea', 'Second idea']]);

    [$retro, , $alice] = p08eBoard(RetroPhase::Writing);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->assertSee('Add survey')
        ->click('Add survey')
        ->assertVisible('#survey-kind')
        ->assertPresent('[aria-label="Option 1"]')
        ->click('#survey-kind')
        ->assertPresent('[role="option"]:has-text("Free text")')
        ->click('[role="option"]:has-text("Free text")')
        ->assertNotPresent('[aria-label="Option 1"]')
        ->fill('#survey-draft-prompt', 'an open question about next steps')
        ->click('[role="dialog"] button:has-text("Generate")')
        ->assertValue('#survey-question', 'What should we try next?')
        ->assertValue('#survey-description', '')
        ->assertNotPresent('[aria-label="Option 1"]')
        ->assertDontSee('First idea');

    Http::assertSent(function (Request $request): bool {
        $sent = json_decode((string) $request['messages'][0]['content'], true);

        return $sent['kind'] === 'text' && $sent['request'] === 'an open question about next steps';
    });

    expect(Survey::query()->count())->toBe(0);
});
```

- [ ] **Step 5: Add the group-name suggestion test (walkthrough item 3)**

Append to the file:

```php
it('[P08e-06] shows suggested group names only to the guest who asked, and applies an accepted or edited name for everyone', function () {
    configureLlm();
    fakeLlmReply([
        ['index' => 1, 'name' => 'Release pain'],
        ['index' => 2, 'name' => 'Team rituals'],
    ]);

    [$retro, $columns, $alice, $aliceParticipant, $bobParticipant] = p08eBoard(RetroPhase::Grouping);
    $release = p08eGroup($retro, $columns[1], $bobParticipant, 'Deploys are slow', 'CI is flaky', 0);
    $rituals = p08eGroup($retro, $columns[0], $aliceParticipant, 'Standups run long', 'Too many meetings', 1);
    $ghost = '[title="Suggested name"]';
    $editor = '[aria-label="Group name"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertSee('Suggest group names')
        ->assertSee('Card contents of these groups are sent to Anthropic.')
        ->click('Suggest group names')
        ->assertCount($ghost, 2)
        ->assertSeeIn("#card-{$release->id} {$ghost}", 'Release pain')
        ->assertSeeIn("#card-{$rituals->id} {$ghost}", 'Team rituals');

    $alicePage->assertSeeIn("#card-{$release->id}", 'Name this group')
        ->assertNotPresent($ghost)
        ->assertDontSee('Release pain')
        ->assertDontSee('Team rituals');

    expect($release->fresh()->group_name)->toBeNull()
        ->and($rituals->fresh()->group_name)->toBeNull();

    Http::assertSentCount(1);
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.anthropic.com/v1/messages'
        && $request->hasHeader('x-api-key', 'llm-secret-key'));

    expect(llmRequestBodies())
        ->toContain('Deploys are slow')
        ->toContain('CI is flaky')
        ->toContain('Standups run long')
        ->toContain('Too many meetings')
        ->not->toContain('Alice Martin')
        ->not->toContain('Bob Stone')
        ->not->toContain('Carol Guest')
        ->not->toContain($release->id)
        ->not->toContain($rituals->id)
        ->not->toContain($aliceParticipant->id)
        ->not->toContain($bobParticipant->id);

    $carolPage->click("#card-{$release->id} button:has-text(\"Use this name\")")
        ->assertPresent("#card-{$release->id} [aria-label=\"Rename group\"]")
        ->assertCount($ghost, 1);

    $alicePage->assertSeeIn("#card-{$release->id}", 'Release pain');
    expect($release->fresh()->group_name)->toBe('Release pain');

    $carolPage->click("#card-{$rituals->id} button:has-text(\"Edit this name\")")
        ->assertValue($editor, 'Team rituals')
        ->assertNotPresent($ghost);

    $alicePage->assertDontSee('Team rituals');

    $carolPage->keys($editor, 'Enter')
        ->assertPresent("#card-{$rituals->id} [aria-label=\"Rename group\"]")
        ->assertDontSee('Suggest group names');

    $alicePage->assertSeeIn("#card-{$rituals->id}", 'Team rituals');
    expect($rituals->fresh()->group_name)->toBe('Team rituals');
});
```

- [ ] **Step 6: Run the survey draft and group-name tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08eLlmTest.php --filter='P08e-0[56]'`
Expected: PASS (3 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 7: Add the summary test (walkthrough item 4)**

Append to the file:

```php
it('[P08e-07] generates the summary, themes, suggested actions and card insights on completion, and sends no name, id, comment or assignee', function () {
    config(['queue.default' => 'database']);
    configureLlm();
    fakeLlmReply(p08eSummaryReply());

    [$retro, $columns, $alice, $aliceParticipant, $bobParticipant] = p08eBoard(RetroPhase::Discussing);
    $slow = p08eCard($retro, $columns[1], $aliceParticipant, 'Deploys are slow', 0);
    $pairing = p08eCard($retro, $columns[0], $bobParticipant, 'Great pairing', 1);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $slow->id, 'participant_id' => $bobParticipant->id]);
    CardComment::factory()->create([
        'retro_id' => $retro->id,
        'card_id' => $slow->id,
        'participant_id' => $bobParticipant->id,
        'content' => 'A private aside on that card',
    ]);
    ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Cache the build',
        'created_by_participant_id' => $aliceParticipant->id,
        'assignee_participant_id' => $bobParticipant->id,
    ]);
    $summary = '[aria-labelledby="results-summary"]';
    $summaryJobs = fn (): int => DB::table('jobs')->where('payload', 'like', '%GenerateRetroSummary%')->count();

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($summary, 'Generating the summary…');
    }

    Http::assertNothingSent();

    expect($summaryJobs())->toBe(1)
        ->and($retro->fresh()->summary_status)->toBe(SummaryStatus::Pending);

    $this->workQueue();

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($summary, 'The team shipped but releases hurt.')
            ->assertSeeIn($summary, 'Generated with Anthropic')
            ->assertDontSee('Generating the summary…')
            ->assertSeeIn($summary, 'Themes')
            ->assertSeeIn($summary, 'Release pain')
            ->assertSeeIn($summary, 'Deploys are slow')
            ->assertSeeIn($summary, 'Tooling')
            ->assertPresent("{$summary} [aria-label=\"Negative\"]")
            ->assertSeeIn($summary, 'Suggested actions')
            ->assertSeeIn($summary, 'Automate releases')
            ->assertSeeIn($summary, 'Theme: Release pain')
            ->assertSeeIn($summary, 'Keep pairing')
            ->assertScript("document.documentElement.outerHTML.includes('llm-secret-key')", false)
            ->click('#completed-tab-board')
            ->assertPresent("#card-{$slow->id} [aria-label=\"Negative\"]")
            ->assertSeeIn("#card-{$slow->id}", 'Tooling')
            ->assertPresent("#card-{$pairing->id} [aria-label=\"Positive\"]")
            ->assertSeeIn("#card-{$pairing->id}", 'Collaboration');
    }

    Http::assertSentCount(1);
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.anthropic.com/v1/messages'
        && $request->hasHeader('x-api-key', 'llm-secret-key')
        && $request['model'] === 'test-model');

    expect(llmRequestBodies())
        ->toContain('Sprint 12')
        ->toContain('To improve')
        ->toContain('Deploys are slow')
        ->toContain('Great pairing')
        ->toContain('Cache the build')
        ->not->toContain('Alice Martin')
        ->not->toContain('Bob Stone')
        ->not->toContain('Carol Guest')
        ->not->toContain($alice->email)
        ->not->toContain($slow->id)
        ->not->toContain($pairing->id)
        ->not->toContain($aliceParticipant->id)
        ->not->toContain($bobParticipant->id)
        ->not->toContain('A private aside on that card');

    expect($retro->fresh()->summary_status)->toBe(SummaryStatus::Ready)
        ->and($summaryJobs())->toBe(0);
});
```

- [ ] **Step 8: Run the summary test**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08eLlmTest.php --filter='P08e-07'`
Expected: PASS (1 test). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If the pages never leave "Generating the summary…" after `$this->workQueue()`, see the harness findings.

- [ ] **Step 9: Add the promote, reject, regenerate and remove tests (walkthrough items 5 and 6)**

Append to the file:

```php
it('[P08e-08] lets the facilitator promote one suggestion and reject another, and gives the guest no button', function () {
    config(['queue.default' => 'database']);
    configureLlm();
    fakeLlmReply(p08eSummaryReply());

    [$retro, $columns, $alice, $aliceParticipant, $bobParticipant] = p08eBoard(RetroPhase::Discussing);
    p08eCard($retro, $columns[1], $aliceParticipant, 'Deploys are slow', 0);
    p08eCard($retro, $columns[0], $bobParticipant, 'Great pairing', 1);
    $summary = '[aria-labelledby="results-summary"]';
    $automate = "{$summary} li:has-text(\"Automate releases\")";
    $keepPairing = "{$summary} li:has-text(\"Keep pairing\")";
    $promoted = "{$summary} a[title=\"Added to action items\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->press('Complete')
        ->assertSeeIn($summary, 'Generating the summary…');

    $this->workQueue();

    $carolPage->assertSeeIn($summary, 'Automate releases')
        ->assertSeeIn($summary, 'Keep pairing')
        ->assertNotPresent("{$summary} button");

    $alicePage->assertSeeIn($automate, 'Theme: Release pain')
        ->assertCount("{$summary} button:has-text(\"Promote\")", 2)
        ->click("{$automate} button:has-text(\"Promote\")")
        ->assertSeeIn($promoted, 'Automate releases')
        ->assertCount("{$summary} button:has-text(\"Promote\")", 1);

    $item = ActionItem::query()->where('retro_id', $retro->id)->where('content', 'Automate releases')->firstOrFail();

    expect($item->theme_name)->toBe('Release pain')
        ->and($item->theme_id)->not->toBeNull();

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertAttribute($promoted, 'href', "#action-item-{$item->id}")
            ->assertSeeIn("#action-item-{$item->id}", 'Automate releases')
            ->assertSeeIn("#action-item-{$item->id}", 'Theme: Release pain');
    }

    $alicePage->click("{$keepPairing} button:has-text(\"Reject\")")
        ->assertSeeIn($summary, 'Dismissed (1)')
        ->assertNotPresent("{$summary} button:has-text(\"Promote\")");

    $carolPage->assertSeeIn($summary, 'Dismissed (1)')
        ->assertNotPresent("{$summary} button");

    $statuses = $retro->suggestedActions()->pluck('status', 'content');

    expect($statuses['Automate releases'])->toBe(SuggestedActionStatus::Promoted)
        ->and($statuses['Keep pairing'])->toBe(SuggestedActionStatus::Rejected);
});

it('[P08e-09] keeps handled suggestions on Regenerate, and on Remove clears the summary, themes and pending suggestions but not the action item\'s theme name', function () {
    config(['queue.default' => 'database']);
    configureLlm();
    Http::fake([
        'api.anthropic.com/*' => Http::sequence()
            ->push(p08eAnthropicResponse(p08eSummaryReply()))
            ->push(p08eAnthropicResponse(p08eSummaryReply([
                'summary' => 'Second take: releases still hurt.',
                'themes' => [['name' => 'Delivery', 'cardIds' => [1]]],
                'suggestedActions' => [
                    ['content' => 'Automate releases', 'theme' => 'Delivery'],
                    ['content' => 'Keep pairing'],
                    ['content' => 'Add a release checklist', 'theme' => 'Delivery'],
                ],
            ]))),
    ]);

    [$retro, $columns, $alice, $aliceParticipant, $bobParticipant] = p08eBoard(RetroPhase::Discussing);
    p08eCard($retro, $columns[1], $aliceParticipant, 'Deploys are slow', 0);
    p08eCard($retro, $columns[0], $bobParticipant, 'Great pairing', 1);
    $summary = '[aria-labelledby="results-summary"]';
    $promoted = "{$summary} a[title=\"Added to action items\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->press('Complete')
        ->assertSeeIn($summary, 'Generating the summary…');

    $this->workQueue();

    $alicePage->assertSeeIn($summary, 'The team shipped but releases hurt.')
        ->click("{$summary} li:has-text(\"Automate releases\") button:has-text(\"Promote\")")
        ->assertSeeIn($promoted, 'Automate releases')
        ->click("{$summary} li:has-text(\"Keep pairing\") button:has-text(\"Reject\")")
        ->assertSeeIn($summary, 'Dismissed (1)');

    $item = ActionItem::query()->where('retro_id', $retro->id)->where('content', 'Automate releases')->firstOrFail();

    $alicePage->click("{$summary} button:has-text(\"Regenerate\")")
        ->assertSeeIn($summary, 'Generating the summary…');

    $this->workQueue();

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($summary, 'Second take: releases still hurt.')
            ->assertDontSee('The team shipped but releases hurt.')
            ->assertSeeIn($summary, 'Delivery')
            ->assertSeeIn($summary, 'Add a release checklist')
            ->assertSeeIn($promoted, 'Automate releases')
            ->assertSeeIn($summary, 'Dismissed (1)');
    }

    $alicePage->assertCount("{$summary} button:has-text(\"Promote\")", 1);

    expect($retro->suggestedActions()->count())->toBe(3);

    $alicePage->click("{$summary} button:has-text(\"Remove\")")
        ->assertSeeIn($summary, 'Generate summary')
        ->assertDontSee('Second take: releases still hurt.')
        ->assertDontSeeIn($summary, 'Delivery')
        ->assertDontSeeIn($summary, 'Add a release checklist')
        ->assertSeeIn($promoted, 'Automate releases')
        ->assertSeeIn($summary, 'Dismissed (1)')
        ->assertSeeIn("#action-item-{$item->id}", 'Theme: Release pain');

    $carolPage->assertDontSee('Second take: releases still hurt.')
        ->assertDontSee('Add a release checklist')
        ->assertSeeIn("#action-item-{$item->id}", 'Theme: Release pain');

    $retro->refresh();

    expect($retro->summary)->toBeNull()
        ->and($retro->summary_status)->toBeNull()
        ->and($retro->themes()->count())->toBe(0)
        ->and($retro->suggestedActions()->where('status', SuggestedActionStatus::Pending)->count())->toBe(0)
        ->and($retro->suggestedActions()->count())->toBe(2)
        ->and($item->fresh()->theme_name)->toBe('Release pain')
        ->and($item->fresh()->theme_id)->toBeNull();

    Http::assertSentCount(2);
});
```

- [ ] **Step 10: Run the promote, reject, regenerate and remove tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08eLlmTest.php --filter='P08e-0[89]'`
Expected: PASS (2 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 11: Add the opted-out retro tests (walkthrough item 7)**

Append to the file:

```php
it('[P08e-10a] creates a retro with the AI summary switched off in the dialog', function () {
    configureLlm();

    $team = Team::factory()->create();
    $alice = teamMember($team);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);

    $page = $this->signIn($alice, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 14 retro')
        ->assertSee('Start, Stop, Continue')
        ->click('[role="dialog"] li button:has-text("Start, Stop, Continue")')
        ->click('[role="dialog"] [data-slot="collapsible-trigger"]')
        ->assertAriaAttribute('#new-retro-ai-summary', 'checked', 'true')
        ->click('#new-retro-ai-summary')
        ->assertAriaAttribute('#new-retro-ai-summary', 'checked', 'false')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header > h1', 'Sprint 14 retro');

    expect(Retro::query()->where('title', 'Sprint 14 retro')->firstOrFail()->ai_summary_enabled)->toBeFalse();
});

it('[P08e-10b] sends nothing when an opted-out retro is completed, until the facilitator clicks "Generate summary"', function () {
    config(['queue.default' => 'database']);
    configureLlm();
    fakeLlmReply(p08eSummaryReply());

    [$retro, $columns, $alice, $aliceParticipant, $bobParticipant] = p08eBoard(RetroPhase::Discussing, ['ai_summary_enabled' => false]);
    p08eCard($retro, $columns[1], $aliceParticipant, 'Deploys are slow', 0);
    p08eCard($retro, $columns[0], $bobParticipant, 'Great pairing', 1);
    $summary = '[aria-labelledby="results-summary"]';
    $summaryJobs = fn (): int => DB::table('jobs')->where('payload', 'like', '%GenerateRetroSummary%')->count();

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed')
        ->assertSeeIn($summary, 'Generate summary')
        ->assertSeeIn($summary, 'The board content is sent to Anthropic to write the summary.')
        ->assertDontSee('Generating the summary…');

    $carolPage->assertSee('Top topics')
        ->assertNotPresent($summary);

    Http::assertNothingSent();

    expect($summaryJobs())->toBe(0)
        ->and($retro->fresh()->summary_status)->toBeNull();

    $alicePage->click("{$summary} button:has-text(\"Generate summary\")")
        ->assertSeeIn($summary, 'Generating the summary…');

    $carolPage->assertSeeIn($summary, 'Generating the summary…');

    $this->workQueue();

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($summary, 'The team shipped but releases hurt.')
            ->assertSeeIn($summary, 'Generated with Anthropic');
    }

    Http::assertSentCount(1);
});

it('[P08e-10c] offers no "Suggest group names" button on an opted-out retro', function () {
    configureLlm();
    Http::fake();

    [$retro, $columns, $alice, , $bobParticipant] = p08eBoard(RetroPhase::Grouping, ['ai_summary_enabled' => false]);
    $lead = p08eGroup($retro, $columns[1], $bobParticipant, 'Deploys are slow', 'CI is flaky');

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->assertSeeIn("#card-{$lead->id}", 'Name this group')
        ->assertDontSee('Suggest group names');

    Http::assertNothingSent();
});
```

- [ ] **Step 12: Run the opted-out retro tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08eLlmTest.php --filter='P08e-10'`
Expected: PASS (3 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 13: Add the failure, retry and stale summary tests (walkthrough item 8, spec §6.3 and §14)**

Append to the file:

```php
it('[P08e-11a] shows the failure to the facilitator after the provider failed three times, and generates the summary on Retry', function () {
    config(['queue.default' => 'database']);
    configureLlm();
    Http::fake([
        'api.anthropic.com/*' => Http::sequence()
            ->push(['error' => ['message' => 'overloaded']], 500)
            ->push(['error' => ['message' => 'overloaded']], 500)
            ->push(['error' => ['message' => 'overloaded']], 500)
            ->push(p08eAnthropicResponse(p08eSummaryReply())),
    ]);

    [$retro, $columns, $alice, $aliceParticipant, $bobParticipant] = p08eBoard(RetroPhase::Discussing);
    p08eCard($retro, $columns[1], $aliceParticipant, 'Deploys are slow', 0);
    p08eCard($retro, $columns[0], $bobParticipant, 'Great pairing', 1);
    $summary = '[aria-labelledby="results-summary"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->press('Complete')
        ->assertSeeIn($summary, 'Generating the summary…');
    $carolPage->assertSeeIn($summary, 'Generating the summary…');

    $this->workQueue();
    $this->travel(11)->seconds();
    $this->workQueue();

    expect($retro->fresh()->summary_status)->toBe(SummaryStatus::Pending);

    $this->travel(61)->seconds();
    $this->workQueue();

    $alicePage->assertSeeIn($summary, 'The summary could not be generated')
        ->assertSeeIn($summary, 'The board content is sent to Anthropic to write the summary.')
        ->assertPresent("{$summary} button:has-text(\"Retry\")")
        ->assertDontSee('Generating the summary…')
        ->assertDontSee('overloaded');

    $carolPage->assertNotPresent($summary)
        ->assertDontSee('The summary could not be generated');

    Http::assertSentCount(3);

    expect($retro->fresh()->summary_status)->toBe(SummaryStatus::Failed)
        ->and($retro->fresh()->summary)->toBeNull();

    $alicePage->click("{$summary} button:has-text(\"Retry\")")
        ->assertSeeIn($summary, 'Generating the summary…');

    $this->workQueue();

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($summary, 'The team shipped but releases hurt.')
            ->assertSeeIn($summary, 'Automate releases');
    }

    Http::assertSentCount(4);

    expect($retro->fresh()->summary_status)->toBe(SummaryStatus::Ready);
});

it('[P08e-11b] treats a summary still pending after ten minutes as failed and lets the facilitator retry', function () {
    config(['queue.default' => 'database']);
    configureLlm();
    fakeLlmReply(p08eSummaryReply());

    [$retro, $columns, $alice, $aliceParticipant, $bobParticipant] = p08eBoard(RetroPhase::Discussing);
    p08eCard($retro, $columns[1], $aliceParticipant, 'Deploys are slow', 0);
    p08eCard($retro, $columns[0], $bobParticipant, 'Great pairing', 1);
    $summary = '[aria-labelledby="results-summary"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $alicePage->press('Complete')
        ->assertSeeIn($summary, 'Generating the summary…');

    $this->travel(9)->minutes();

    $alicePage->navigate("/retros/{$retro->id}")
        ->assertSeeIn($summary, 'Generating the summary…');

    $this->travel(2)->minutes();

    $alicePage->navigate("/retros/{$retro->id}");
    $this->awaitRealtime($alicePage);

    $alicePage->assertSeeIn($summary, 'The summary could not be generated')
        ->assertPresent("{$summary} button:has-text(\"Retry\")")
        ->assertDontSee('Generating the summary…');

    Http::assertNothingSent();

    expect($retro->fresh()->summary_status)->toBe(SummaryStatus::Pending);

    $alicePage->click("{$summary} button:has-text(\"Retry\")")
        ->assertSeeIn($summary, 'Generating the summary…');

    $this->workQueue();

    $alicePage->assertSeeIn($summary, 'The team shipped but releases hurt.')
        ->assertSeeIn($summary, 'Generated with Anthropic');

    Http::assertSentCount(1);

    expect($retro->fresh()->summary_status)->toBe(SummaryStatus::Ready);
});
```

In `[P08e-11b]` the first job is never run before the clock moves, which is the walkthrough's "stop the queue worker". After "Retry" the queue may hold two jobs for the retro (the first job's uniqueness lock has expired after 11 minutes); the one `$this->workQueue()` call runs the older one, which finds the request pending again and generates the summary. The second job, if any, would find the summary ready and send nothing; the test does not run it, because `queue:work --once` on an empty queue sleeps for three seconds.

- [ ] **Step 14: Run the failure, retry and stale summary tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08eLlmTest.php --filter='P08e-11'`
Expected: PASS (2 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If `[P08e-11a]` fails because the summary status is not `failed` after the third `$this->workQueue()`, see the harness findings.

- [ ] **Step 15: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed for `tests/Browser/Walkthroughs/Plan08eLlmTest.php`. If Rector proposes one, run `composer rector` and keep its result.

- [ ] **Step 16: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan08eLlmTest.php`
Expected: PASS (21 tests: 7 from Task 7 and 14 from this task).

- [ ] **Step 17: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan08eLlmTest.php
git commit -m "test(browser): cover the LLM walkthrough with a faked provider"
```

### Task 9: Coverage table and residual checklist

**Files:**
- Modify: `docs/superpowers/walkthroughs/coverage.md` (summary rows, one section per walkthrough of this plan, notes)
- Modify: `docs/superpowers/walkthroughs/residual-manual-checklist.md` (one section per walkthrough of this plan that has residual steps)

**Interfaces:**
- Consumes: the test identifiers of the walkthrough tasks of this plan, as implemented.
- Produces: the rows acceptance criterion 5 of the spec asks for, for this plan's walkthroughs.

The rows below were written with the plan, before any test ran. Before writing them, read the walkthrough test files as implemented and the task reports: where a test was renamed, split, dropped, or changed status, change its row to match the code. A row is `auto` or `auto-substituted` only if its test exists and passes.

- [ ] **Step 1: Add the summary rows**

In `docs/superpowers/walkthroughs/coverage.md`, in the Summary table, add these rows before the `**Total**` row, and recompute the total row from all rows of the table (this plan adds 73 rows: 58 `auto`, 11 `auto-substituted`, 4 `residual`, as planned):

```markdown
| Plan 8a: flow and templates | 14 | 14 | 0 | 0 |
| Plan 8b: health check | 11 | 10 | 1 | 0 |
| Plan 8c: surveys | 10 | 10 | 0 | 0 |
| Plan 8d: results | 16 | 13 | 1 | 2 |
| Plan 8e: LLM features | 22 | 11 | 9 | 2 |
```

- [ ] **Step 2: Add one section per walkthrough**

In the same file, insert these sections before the `## Notes` section:

````markdown
## Plan 8a: flow and templates

Walkthrough: `docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P08a-01a | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6295 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto |
| P08a-01b | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6295 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto |
| P08a-02a | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6296 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto |
| P08a-02b | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6296 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto |
| P08a-03 | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6297 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto |
| P08a-04a | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6298 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto |
| P08a-04b | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6298 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto |
| P08a-04c | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6298 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto |
| P08a-05 | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6299 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto |
| P08a-06 | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6300 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto |
| P08a-07a | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6301 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto |
| P08a-07b | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6301 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto |
| P08a-07c | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6301 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto |
| P08a-07d | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6301 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto |

## Plan 8b: health check

Walkthrough: `docs/superpowers/plans/2026-09-30-plan-8b-health-check.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P08b-01a | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3682 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto |
| P08b-01b | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3682 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto |
| P08b-02 | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3683 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto |
| P08b-03a | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3684 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto-substituted |
| P08b-03b | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3684 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto |
| P08b-03c | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3684 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto |
| P08b-04 | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3685 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto |
| P08b-05a | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3686 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto |
| P08b-05b | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3686 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto |
| P08b-06 | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3687 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto |
| P08b-07 | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3688 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto |

## Plan 8c: surveys

Walkthrough: `docs/superpowers/plans/2026-09-30-plan-8c-surveys.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P08c-01 | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto |
| P08c-02a | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto |
| P08c-02b | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto |
| P08c-02c | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto |
| P08c-03 | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto |
| P08c-04a | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto |
| P08c-04b | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto |
| P08c-05 | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto |
| P08c-06 | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto |
| P08c-07 | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto |

## Plan 8d: results

Walkthrough: `docs/superpowers/plans/2026-09-30-plan-8d-results.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P08d-01a | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3014 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto |
| P08d-01b | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3014 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto |
| P08d-01c | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3014 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto |
| P08d-02a | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3015 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto |
| P08d-02b | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3015 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto |
| P08d-03 | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3016 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto |
| P08d-04a | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3017 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto |
| P08d-04b | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3017 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto |
| P08d-04c | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3017 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto |
| P08d-04d | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3017 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto |
| P08d-04e | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3017 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto |
| P08d-04v | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3017 | (none) | residual |
| P08d-05a | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3018 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto |
| P08d-05b | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3018 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto |
| P08d-06 | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3019 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto-substituted |
| P08d-06v | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3019 | (none) | residual |

## Plan 8e: LLM features

Walkthrough: `docs/superpowers/plans/2026-09-30-plan-8e-llm.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P08e-01a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5507 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto |
| P08e-01b | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5507 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto |
| P08e-02a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5508 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto |
| P08e-02b | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5508 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto |
| P08e-03a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5509 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto |
| P08e-03b | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5509 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto |
| P08e-04a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5513 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto |
| P08e-04b | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5513 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto |
| P08e-04c | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5513 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto |
| P08e-05a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5514 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-05b | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5514 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-06 | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5515 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-07 | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5516 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-07r | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5516 | (none) | residual |
| P08e-08 | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5517 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-09 | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5518 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-10a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5519 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto |
| P08e-10b | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5519 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-10c | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5519 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto |
| P08e-11a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5520 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-11b | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5520 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-11r | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5511 | (none) | residual |

````

- [ ] **Step 3: Add the notes**

In the same file, append these bullets to the `## Notes` section (drop a bullet whose difference turned out not to exist; add one for each difference found while implementing):

````markdown
- **P08a-02a** — the walkthrough expects "the Warm-up question (same question in both browsers) and the timer". Since the games spec was built, the Icebreaker phase shows the game panel instead (flow extras spec §2.5). The test asserts the icebreaker game stage, the same game name ("Draw & Guess") in both browsers, and the shared timer.
- **P08a-02b** — the walkthrough adds the column during Icebreaker and through one form. Today the columns are not rendered during Icebreaker and the add-column form has no description field. The test adds the column in Writing and sets its description through the column menu's "Edit description".
- **P08a-03** — "Previous → Icebreaker: the other browser's cards are hidden again". The board is not shown during Icebreaker, so the test asserts the cards are hidden again in Writing after a return from Grouping, absent from the whole document in Icebreaker, and still hidden when Writing is entered again.
- **P08a-04a / P08a-04b** — the settings dialog disables the Icebreaker checkbox while the retro is in Icebreaker, so the message "Move to another phase before turning this phase off." cannot be produced by a current dialog. P08a-04a asserts the disabled checkbox; P08a-04b produces the server's message with a dialog opened before the retro was moved to Icebreaker through the model (no broadcast), as P04-13 does for a refused vote.
- **P08a-05** — run with two data sets (2 and 9 top-level cards, each with one grouped card) to cover both "cards + 3" and "max 10".
- **P08a-07b** — "reorder/remove columns": the test starts from "Start, Stop, Continue", moves the first column down and removes the third; the category is changed from "Essentials" to "Team & mood" in the select.
- **P08a-07c / P08a-07d** — the template and, for P08a-07d, the retro created from it are arranged with factories so that each test stands alone.
- **P08b-03a** — the `health.answered` frame is not inspected (browser test spec §3.6); the test asserts absence in the other participant's page and reads the snapshot endpoint from the page. "Enable guest access" is arranged with the factory state; the guest link dialog is covered by P04-10.
- **P08b-05b / P08b-06** — "server answers 423 if forced" and the 403 in Writing are produced by changing the retro through the model without a broadcast and clicking a still-enabled score button.
- **P08b-07** — the health check is toggled off and on in Writing, because the settings dialog disables that checkbox during the Health check phase; "change the team statements" is an Owner adding a custom statement on the team page.
- P08c (all rows): the walkthrough is one paragraph on line 5728; its checks are split into ten tests. It asks for "two browsers, one as a guest"; the tests open the facilitator or a member next to a guest, whichever the check needs.
- P08c-01: the walkthrough does not name the kinds in the interface; today's dialog calls them "Single choice", "Multiple choice" and "Free text" under "Answer type".
- P08c-02b: beyond the walkthrough, the test asserts that a multiple choice survey's percentages are computed per respondent (100% and 50% for two respondents), as the feature spec §5.4 requires.
- P08c-02c, P08c-05: "hidden" is asserted on the visible text and on the document's HTML (the Inertia page data), so the redaction is checked as server-side.
- P08c-03: the test also reopens the survey and asserts that the results hide again for someone who has not answered (feature spec §5.1); the walkthrough only closes.
- P08c-04a: "avatars" are asserted as `<img alt="{name}">` under the option; the names shown on hover (a tooltip) are not asserted. "Text authors" are asserted as the name inside the answer's row.
- P08c-07: "answering refused" is asserted as the interface shows it: on a closed survey the option buttons and checkboxes are disabled and the free text field is absent. The server's 422 for a forced request stays covered by `tests/Feature/Retros/SurveyAnswersTest.php`.
- P08d-01a: the group is arranged with factories instead of being formed by a drag in the test; dragging one card onto another is covered by `[P04-03]`.
- P08d-01b: "Drag the only grouped card out" is done with the card's Ungroup button: a grouped card has no drag handle for the keyboard sensor, and `[P04-03]` ungroups the same way. Both paths end in the same lifecycle rule (feature spec §7.2, "when the last grouped card leaves a lead, its name is cleared").
- P08d-02b: the group name is rendered in upper case by CSS in presentation mode; the test reads the element's text content ("Pipeline"), not the displayed capitals.
- P08d-03: the walkthrough says "Lock the board"; today's control is the "Close for editing" checkbox of the settings dialog, and the badge reads "Board closed for editing".
- P08d-04a to P08d-04e: step 4 is one sentence listing every section of the Results view; it is split into five tests. Health answers, surveys, votes, ratings and the earlier retros of the team are arranged with factories (`FreezeHealthStatements`, `ManageTeamHealthStatements::archive()` for the statement change), because collecting them through the interface would need three completed retros.
- P08d-04b: the walkthrough says "the guest sees the same without the trend"; the test also asserts that the title of another retro of the team is absent from the guest's document.
- P08d-05a: "within about a second" is asserted without a clock: the assertion on the other page waits for the refetch, which the client starts one second after the broadcast.
- P08d-06: the operating system setting is emulated with the Playwright context option `reducedMotion` on a guest's context, opened by hand with `visit()` because `signIn()` and `joinAsGuest()` take no context options. The only motion in the Results view is the width transition of the ROTI bars; the survey bars, the radar and the trend have none in either mode, which the test also asserts.
- P08e-01a to P08e-03b: the walkthrough says "`SKRUM_LLM_*` empty". The tests set `services.llm` to nulls in the test process, and `[P08e-01a]` also runs with a provider and a key but no model, because `Llm::isConfigured()` requires all three (feature spec §9).
- P08e-03a, P08e-03b: the tests put a sentiment, a category, a theme and a suggestion in the database before opening the page, so that "nothing is shown" is checked against existing data and not against an empty board. `[P08e-03b]` then configures a provider and reloads, to prove that the same page shows them.
- P08e-04b, P08e-04c: the walkthrough's item 1 names only the creation dialog. The settings switch and its lock once the retro is completed come from the feature spec (§6.3, acceptance criterion 9) and are tested under the same item.
- P08e-05a: "nothing appears on the board until Save" is asserted on the facilitator's page and on a guest's page, and by the absence of a `surveys` row.
- P08e-06: "ghost names appear only in the guest's browser" is asserted by the absence of the suggested names in the facilitator's page (substitution for looking at a second screen); the request body is checked to hold the card contents and no name or id.
- P08e-07: the provider's reply is faked; the job is run with the `database` queue and `$this->workQueue()` so that "Generating the summary…" is visible first. "Sends no personal data or hidden content" is asserted on the faked request: no participant name, email, participant id or card UUID, no card comment; the full redaction list stays covered by `tests/Feature/Retros/SummaryInputTest.php`.
- P08e-08: "it links to a new action item showing 'Theme: …'" is asserted in the Results view, where the promoted suggestion is a link to `#action-item-<id>` and the item carries the badge "Theme: Release pain".
- P08e-10b: the second retro is arranged with a factory (`ai_summary_enabled = false`); creating it through the dialog with the switch off is `[P08e-10a]`.
- P08e-11a: not a numbered walkthrough item. It covers the provider failing (HTTP 500 three times, feature spec §6.3 and §14) and the Retry the walkthrough's item 8 ends with, using time travel between the job's attempts.
- P08e-11b: "Stop the queue worker, complete a retro, wait 10 minutes" is done by leaving the job in the `database` queue, travelling 11 minutes and reloading the page. Nothing in the product marks the row as failed: `Retro::effectiveSummaryStatus()` reads a pending request older than 10 minutes as failed when the snapshot is built, so the database still says `pending` and the page changes only on reload. The walkthrough's alternative ("set `summary_requested_at` back with tinker") is not used.
````

If a defect was found and fixed under the Defect rule, add its line under `## Defects found`.

- [ ] **Step 4: Add the residual entries**

In `docs/superpowers/walkthroughs/residual-manual-checklist.md`, append a section per walkthrough of this plan (heading `## <walkthrough title>` as in the coverage table) and distribute these entries under them by identifier:

````markdown
- **P08d-04v** — "radar with gaps for unanswered axes, … trend with a hollow point after a statement change, surveys with bars/percentages" (step 4, the charts as drawn). Not automated: whether the radar, the trend line and the bars look right (the polygon's shape matches the scores, a gap reads as a gap, labels do not overlap or leave the chart, the hollow point is distinguishable, bar lengths are proportional) is a judgement of visual quality, out of scope per browser test spec §1. `[P08d-04b]`, `[P08d-04c]` and `[P08d-04e]` assert the data each chart exposes in the DOM (descriptions, labels, point and segment counts, the hollow point's class, bar widths, numbers). Check by hand: complete a retro with the health check on in which one statement has no answer, for a team that has two earlier completed retros and archived a health statement between them; open the Results tab as a member and confirm that the radar draws one axis per statement with a break at the unanswered one, that every axis label is readable, that the trend shows three points of which the second is hollow, and that the survey and ROTI bars are proportional to their counts; repeat in the dark theme.
- **P08d-06v** — "With the OS 'reduce motion' setting on, no bar or chart animates" (step 6, with the real operating system setting). Not automated: the operating system's own setting is out of reach of the suite (browser test spec §1); `[P08d-06]` emulates the preference through the browser context and asserts the computed styles, which does not prove what the eye sees when a value changes. Check by hand: turn on "Reduce motion" in the operating system, open a completed retro's Results tab in two browsers, change the ROTI rating in one and confirm that the bars of the other jump to their new length without sliding and that the radar and the trend never move; turn the setting off and confirm that the ROTI bars slide.
- **P08e-07r** — "Complete the retro: Results shows 'Generating the summary…', then the summary with 'Generated with …', themes with card sentiment icons and category chips, and suggested actions" against a real provider. Not automated: a real LLM provider is out of scope (browser test spec §1); the tests fake the provider's reply, so they cannot judge whether a real model's summary is faithful, whether its themes group the right cards, whether its suggestions are sensible, or whether it answers in the right language and within the limits on a large board. Check by hand: set `SKRUM_LLM_PROVIDER`, `SKRUM_LLM_API_KEY` and `SKRUM_LLM_MODEL`, run a queue worker, fill a board with about 100 cards across several columns with some groups and votes, complete the retro, and confirm that the summary appears within a minute, is plain text in the facilitator's language, describes the cards and no person, that every theme lists cards that belong together, and that each card on the Board tab has a plausible sentiment and category. Repeat "Generate from a prompt" and "Suggest group names" once each and confirm that the draft and the names are usable.
- **P08e-11r** — "set `SKRUM_LLM_PROVIDER`, `SKRUM_LLM_API_KEY`, `SKRUM_LLM_MODEL`; run a queue worker" with a real key and a real worker process. Not automated: the suite sets the configuration in the test process and runs each job with `queue:work --once`; it does not prove that the three environment variables of `.env` reach `config/services.php` in a deployed instance, that an OpenAI-compatible server set through `SKRUM_LLM_BASE_URL` works, or that a long-running worker picks the job up. Check by hand: with the variables set in `.env` and `php artisan queue:work` running, complete a retro and confirm the summary arrives without a reload; then set `SKRUM_LLM_PROVIDER=openai` with an OpenAI-compatible `SKRUM_LLM_BASE_URL`, restart the worker, and confirm that the privacy notice names that host and that a summary is generated.
````

- [ ] **Step 5: Check the table against the tests**

Run: `grep -ohE "\[P[0-9]+[a-z]?-[0-9]{2}[a-z]*\]" tests/Browser/Walkthroughs/*.php | sort -u | wc -l` and `grep -cE "^\| P[0-9]+[a-z]?-" docs/superpowers/walkthroughs/coverage.md`.
Expected: every identifier used in a test title appears in a row (alone or in a row that names its tests); every `auto` or `auto-substituted` row names an identifier that exists in a test title; `grep -cE "\| residual \|$" docs/superpowers/walkthroughs/coverage.md` equals `grep -c "^- \*\*P" docs/superpowers/walkthroughs/residual-manual-checklist.md`.

- [ ] **Step 6: Format the two documents and commit**

Run: `npx vp fmt docs/superpowers/walkthroughs/coverage.md docs/superpowers/walkthroughs/residual-manual-checklist.md`, then check with `git diff --stat` that only these two files changed.

```bash
git add docs/superpowers/walkthroughs/coverage.md docs/superpowers/walkthroughs/residual-manual-checklist.md
git commit -m "docs: add the plan 16c walkthroughs to the coverage table and the residual checklist"
```

### Task 10: Final verification

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
## Verification of plan 16c

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
git commit -m "docs: record the verification of plan 16c"
```

---

## Appendix: notes from drafting

Nothing in this plan was executed while it was written. The notes below record what was read, what could not be verified, and the fallback for each doubt. Where a note says "the lead", read "whoever executes the plan".

### From `16c-1-flow-health.md`

**Facts that differ from the walkthroughs, the spec or the brief (with evidence):**

- The Icebreaker phase renders the game stage, not a Warm-up panel and not the columns: `resources/js/components/retro/board.tsx:271` (`board.retro.phase === 'icebreaker' ? <IcebreakerStage … />`), `resources/js/components/retro/phase-panel.tsx` has a `health_check` branch only. Flow extras spec §2.5 says so; §2.4 still allows column edits in Icebreaker on the server, but the interface offers none there.
- `resources/js/components/retro/add-column.tsx` sends `{ title, color }` only; a description is set in `column-header.tsx` ("Edit description").
- `resources/js/components/retro/settings-dialog.tsx` disables `#retro-icebreaker` when `retro.phase === 'icebreaker'` and `#retro-health-check` when `retro.phase === 'health_check'`; the 422 "Move to another phase before turning this phase off." (`RetroSettingsController::ensureCurrentPhaseStaysOn`) is reachable only from a stale dialog.
- On this branch `dragWithKeyboard()` has three parameters (`tests/Browser/Support/InteractsWithBrowser.php:48`); the fourth (`$handleRemains`) is expected from plan 16b Task 1. `[P08b-01a]` passes three arguments, so it works with either signature. `workQueue()` is not used by these tasks.
- The creation dialog's third section is titled "More templates" (the walkthrough and spec §8.4 only say "the rest").
- The facilitator's add-column form renders a `role="radiogroup"` with `role="radio"` buttons during the Health check phase; health selectors must be scoped to `ol > li` (done in the helpers).

**Hooks:** none. No `data-test` or `data-realtime` attribute is added; no `.tsx` file changes; no build step.

**Dependencies on other sections:** only the harness of plan 16a (`signIn`, `joinAsGuest`, `awaitRealtime`, `dragWithKeyboard`). The two files do not call helpers of other walkthrough files. `[P08a-02a]` only asserts that the icebreaker stage is there; game behaviour is left to the plan 13 section.

**UNVERIFIED items (nothing was run; the repo is read-only for this draft) and their fallbacks:**

- UNVERIFIED: `a[href$="/templates"]` matches exactly one element on the team page (`[P08a-07a]`). Fallback: `[data-sidebar="menu-button"][href$="/templates"]`, or append `>> nth=0`.
- UNVERIFIED: the Playwright selector `[role="dialog"] div:has(> h3:has-text("Preview"))` resolves to the one preview box. Fallback: add `data-test="template-preview"` to that `<div>` in `new-retro-dialog.tsx` (one hook, needs a build).
- UNVERIFIED: `fieldset > div:nth-of-type(n)` addresses the nth column block of the template editor (`[P08a-07b]`). Fallback: `[aria-label="Move down"] >> nth=0` and `[aria-label="Remove column"] >> nth=2`.
- UNVERIFIED: `assertDisabled()` / `assertEnabled()` on Radix checkbox buttons (`#retro-icebreaker`, `#retro-votes-auto`) and on the score buttons. Fallback: `assertScript("document.querySelector('#retro-icebreaker').disabled", true)`.
- UNVERIFIED: `script()` given `() => fetch(…).then(…)` returns the resolved string (`p08bHealthSnapshot`); the findings only prove that a returned promise is awaited. Fallback: store the result with `script("() => fetch(…).then((text) => { window.p08bSnapshot = text; return true; })")` and read it with `assertScript('window.p08bSnapshot', $expected)`.
- UNVERIFIED: starting the board timer during Icebreaker with `queue.default = database` leaves the scheduled expiry job stored and shows the header timer on both pages (`[P08a-02a]`). Fallback: drop the timer part and assert only `[aria-label="Timer"]` for the facilitator; the shared timer is already proved by `[P04-08a]`.
- UNVERIFIED: after cards were revealed in Grouping and hidden again, the other card's text is absent from `document.documentElement.outerHTML` (`[P08a-03]`). A failure here would be a real leak in the client state rendering, or a leftover in a live region; fallback is `assertDontSee()` only, with the reason recorded in the coverage notes.
- UNVERIFIED: the guest's avatar in the health row has `alt="Carol Guest"` (participant name from the guest name) and appears on the facilitator's page that loaded before the guest joined (the board refetches on an unknown presence member, `use-retro-board.ts:361`). Fallback: open the guest's page first.
- UNVERIFIED: a workspace Owner who is not a team member can open `/retros/{id}` (`[P08a-07d]`) and the team page (`[P08b-01a]`, `[P08b-07]`); `TeamPolicy::view` allows it. Fallback: attach the Owner to the team (`$team->members()->attach($olivia)`).
- UNVERIFIED: the keyboard drag on the team page's statement list behaves like the poker task list (same dnd-kit sortable set-up, `health-statements-section.tsx`), and `fill()` works on the uncontrolled inputs of the Inertia `<Form>` rows.
- UNVERIFIED: `resize(375, 812)` puts the score grid on two rows (`grid-cols-5 sm:grid-cols-10`), and the 1728 px default shows one row.
- The exact title check of `[P08a-01a]` compares with the browser's date; it can fail if the test runs across midnight.

### From `16c-2-surveys-results.md`

- **Hooks introduced: none.** Tasks 4, 5 and 6 change no product file, so they contain no `npm run types:check`, `npm run check` or `npm run build` step. They rely on hooks plan 16a already shipped: `data-realtime` (`resources/js/components/retro/board.tsx:230`), `data-test="retro-card-handle-{id}"` (`resources/js/components/retro/dnd.tsx:113` and `:154`).
- **Dependencies on other sections:** none. `$this->workQueue()` (plan 16b Task 1) is not used: nothing in these two walkthroughs is queued or delayed. `[P04-03]` is cited for the grouping drag and `[P04-07]` for the Complete and Reopen buttons; no `plan04*` helper is called.
- **No PHPStan step:** `phpstan.neon` analyses `app/`, `bootstrap/app.php`, `config/`, `database/`, `routes/` only (`phpstan.neon:6-11`), so a test-only task has nothing for it to check. The tasks run Pint and `composer rector:check`.
- **Test counts:** Task 4 has 4 tests, Task 5 has 6 tests (file total 10), Task 6 has 14 `it()` blocks and 15 runs (`[P08d-02a]` runs for Voting and Discussing).
- **Facts that differ from the brief or the walkthrough:**
  - The brief says the plan 8c walkthrough is "around lines 5720–5761"; the walkthrough itself is the single line 5728 (`docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728`), so every P08c row points at that line.
  - The brief suggests the charts may be "SVG/canvas"; both are inline SVG without any animation (`resources/js/components/retro/results/health-radar.tsx`, `health-trend.tsx`). The only motion-dependent class in the Results view is `motion-safe:transition-[width]` on the ROTI bar (`resources/js/components/retro/results/roti-section.tsx:36`); the survey bars have no transition (`resources/js/components/retro/survey-card.tsx:247-251`). The feature spec §13 says "`prefers-reduced-motion` respected (no chart animation)", which the code satisfies by having no chart animation at all. An assertable effect therefore exists only on the ROTI bars, and `[P08d-06]` asserts it.
  - A grouped (child) card has no drag handle: `retro-column.tsx:52-61` wraps only top-level cards in `GroupableCard`. The walkthrough's "drag the only grouped card out" can therefore not be done with the keyboard sensor; `[P08d-01b]` uses the Ungroup button.
  - The walkthrough's "Lock the board" is the settings checkbox labelled "Close for editing" (`resources/js/components/retro/settings-dialog.tsx:317-323`).
- **UNVERIFIED items (nothing was run; every test is drafted from reading the code):**
  - UNVERIFIED: `visit($joinPath, ['reducedMotion' => 'reduce'])` emulates the media query. Evidence: the options are spread into `newContext` (`vendor/pestphp/pest-plugin-browser/src/Api/PendingAwaitablePage.php:175-181`); the same array is also passed to `goto()`, which may or may not tolerate the extra key. Fallback (written in Task 6 Step 8): remove `[P08d-06]`, make the `P08d-06` row `residual` with the `P08d-06v` text, and drop the `P08d-06v` row.
  - UNVERIFIED: the default-context control of `[P08d-06]` expects a non-zero `transition-duration` on the ROTI bar (Tailwind 4's default for `transition-[width]`). Fallback: if the control reads `0s`, the class does not produce a transition at all; that is a product defect against plan 8d's intent only if a transition was intended, so keep the reduced-motion assertions and delete the single line `->assertScript($barHasTransition, true)`.
  - UNVERIFIED: `[P08d-01c]`'s keyboard grouping of a card that already has a grouped child (a taller draggable than in `[P04-03]`) lands on the card below with one `ArrowDown`. Fallback: if the drop target is the column, send two `ArrowDown` keys (each followed by the two-animation-frame wait), or arrange the dragged group with the lead only one line tall by giving its child a short text; if neither works, split the row: keep the database and realtime assertions by calling the grouping through the interface of a single-card lead (name carried by `group_name` on a lead with one child is required by the rule, so the last resort is a `residual` row for the drag itself with the lifecycle covered by `tests/Feature/Retros/GroupNamesTest.php`).
  - UNVERIFIED: `:has(h2:has-text("…"))` inside a CSS selector is accepted by the plugin's selector engine (`:has()` and `:has-text()` are each proven separately in the harness findings, not nested). Fallback: use `p08dInSection()` scripts for the affected assertions, or `section >> nth=N`.
  - UNVERIFIED: clicking a Radix `DropdownMenuCheckboxItem` by `[role="menuitemcheckbox"]` closes the menu (the default of Radix; `[P08c-04a]` then asserts `assertNotPresent('[role="menu"]')`). Fallback: send `Escape` to `[role="menu"]` before that assertion.
  - UNVERIFIED: `assertDisabled()` reports a Radix checkbox (`button[role="checkbox"][disabled]`) and a `disabled` reaction chip as disabled; both render a native `disabled` attribute, which Playwright's `isDisabled()` reads. Fallback: `assertAttribute($selector, 'data-disabled', '')` for the checkbox and `assertScript("document.querySelector('…').disabled", true)` for the chip.
  - UNVERIFIED: `fill()` on the group name editor does not blur it before `keys($editor, 'Enter')`. If it did, the blur handler would already save the name and the `Enter` key would find no editor; the following assertions would still pass because the editor is gone and the name is saved. Fallback: drop the `keys($editor, 'Enter')` line.
  - UNVERIFIED: a guest can join a Completed retro through the guest link (`[P08d-04b]` to `[P08d-06]` join after completion). Evidence: `RetroJoinsController::findRetro()` filters only on `guest_token` and `guest_access_enabled` (`app/Http/Controllers/RetroJoinsController.php:62-68`), and the feature spec §6.1 says guests may open a completed retro "through a still-enabled guest link". Fallback: join during Discussing, then set the phase with the facilitator's Complete button.
  - UNVERIFIED: the participation figure "2 / 3 participants" of `[P08d-04b]` assumes the guest's participant row exists before the member's page loads (the guest joins first in the test) and that no other participant is created by signing in. Fallback: read the expected count from `$retro->participants()->count()` and interpolate it.

### From `16c-3-llm.md`

- **No product hook is introduced.** Every target has an id, an aria-label, a `title` or English text: `#new-retro-ai-summary`, `#retro-ai-summary`, `#survey-draft-prompt`, `#survey-kind`, `#survey-question`, `#survey-description`, `[aria-label="Option N"]`, `[aria-labelledby="results-summary"]`, `aside[aria-label="Suggestions"]`, `[title="Suggested name"]`, `[aria-label="Group name"]`, `[aria-label="Rename group"]`, `a[title="Added to action items"]`, `#action-item-<id>`, `#card-<id> [aria-label="Negative"]`.
- **Dependency on plan 16b Task 1:** every summary test calls `$this->workQueue()` and assumes it takes no argument, runs exactly one job (`queue:work --once`) after rebinding a fresh request, and returns nothing. If its signature differs, adjust the ten calls in Task 8. If plan 16c is implemented before 16b, add to the top of the file `function p08eWorkQueue(TestCase $test): void { app()->instance('request', Request::create('/')); $test->artisan('queue:work', ['--once' => true])->assertSuccessful(); }` (body of `p10bWorkQueueOutsideAnyRequest()` in `Plan10bPokerAdditionsTest.php`, with `Illuminate\Http\Request` imported under an alias because the file already imports `Illuminate\Http\Client\Request`) and replace `$this->workQueue()` by `p08eWorkQueue($this)`.
- **No dependency on another walkthrough file.** The helpers are prefixed `p08e`; `plan04*` helpers are not called.
- **Brief versus code:** the brief's assignment mentions `config/skrum.php` and the `HandleInertiaRequests` shared props as places that decide LLM availability. Neither does: `config/skrum.php` has no LLM key and `HandleInertiaRequests` shares nothing about it. Availability is `Llm::isConfigured()` over `config/services.php:112-117`, exposed by `TeamsController::show` (`app/Http/Controllers/TeamsController.php:74-77`) and `BuildBoardSnapshot` (`app/Actions/Retros/BuildBoardSnapshot.php:180-183`).
- **Stale summary:** there is no scheduled command or job; it is a lazy check on read (`app/Models/Retro.php:273-284`). The walkthrough's "the facilitator sees 'The summary could not be generated'" therefore needs a reload, which the test does.
- **Queue:** `phpunit.xml:33` sets `QUEUE_CONNECTION=sync`, so without `config(['queue.default' => 'database'])` the summary job runs inside the facilitator's "Complete" request. The survey draft and group-name calls are synchronous by design and need no queue.
- **`.env` independence:** `phpunit.xml:38-39` empties only `SKRUM_LLM_PROVIDER` and `SKRUM_LLM_API_KEY`. Every test in the file sets `services.llm` itself (`p08eWithoutLlm()` or `configureLlm()`).
- UNVERIFIED: a failing job run by `queue:work --once` inside the test process is released with the job's backoff and reaches `failed()` on the third run (`[P08e-11a]`). The 16a suite only ran succeeding jobs this way. Fallback: arrange the failed state with `$retro->forceFill(['summary_status' => SummaryStatus::Failed])->save()` on a Completed retro, keep the assertions on the failure text and on Retry, and leave the three attempts to `tests/Feature/Retros/RetroSummaryJobTest.php`; the row stays `auto-substituted`.
- UNVERIFIED: the job's `afterCommit()` dispatch reaches the `jobs` table inside the `RefreshDatabase` transaction (`[P08e-07]` asserts one `GenerateRetroSummary` row before running it). Spec §3.1 states that after-commit dispatch fires inside the test transaction, and `[P10b-08a]` relies on a queued job the same way, but not on one marked `afterCommit()`. Fallback: none needed in the tests if it fails; it would be a harness finding to record, and the job would have to be dispatched by hand with `dispatch(new GenerateRetroSummary($retro->id))` after the "Complete" click.
- UNVERIFIED: `Http::fake()` applying to requests made during a browser request and during `queue:work --once` was listed as "not probed" in the harness findings. The spec (§2 decision 1) states it; if it does not hold, every `auto-substituted` row of this file fails at its first provider call.
- UNVERIFIED: a guest who joined during Discussing keeps access after completion and sees the Results view (`[P08e-07]` to `[P08e-11a]`); `[P04-07]` proves it for a member only. Fallback: replace the guest by the member "Bob Stone" (`$this->signIn($bob, …)`, with `p08eBoard()` also returning the user), who has no Promote or Reject button in Completed either.
- UNVERIFIED: `assertAriaAttribute('#new-retro-ai-summary', 'checked', 'true')` on a Radix checkbox (the idiom is used on `#spectator` in `Plan10bPokerAdditionsTest.php`; whether that one is the same Radix component was not checked). Fallback: `assertAttribute($selector, 'data-state', 'checked')` and `'unchecked'`.
- UNVERIFIED: `click('Add survey')` and `click('Suggest group names')` resolve the header buttons by visible text although each button also holds an icon. Fallback: `header button:has-text("Add survey")` and `header button:has-text("Suggest group names")`.
- Run time: the file has 21 tests; the summary tests open two contexts and run one to four jobs each. No test travels more than 11 minutes.
