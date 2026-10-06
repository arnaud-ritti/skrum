# Public site — B. Capture pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The owner's standing instruction is that plans run through the Workflow tool.

**Goal:** A browser test can sign a person of a fixed story into the application, crop one element of a page at twice the pixel density, and keep the picture under `website/src/assets/screenshots/` only when it changed.

**Architecture:** One trait on `Tests\BrowserTestCase` (`CapturesDocs`) beside the existing `CapturesVisuals`, re-using its settle script and `CaptureFile::replaceWhenPictureDiffers()`. One plain class (`DocsWorld`) builds the story from the existing factories. One test file proves both and cleans up after itself.

**Tech Stack:** Pest 5, `pestphp/pest-plugin-browser` 5.0.1 (Playwright), PHP 8.4, GD (already used by `CaptureFile`).

**Spec:** `docs/superpowers/specs/2026-10-06-public-docs-site-design.md` (§5.6, §9 criteria 13 and 14).

## Global Constraints

- Work in the worktree `.claude/worktrees/public-docs-site`, branch `public-docs-site`. Never `cd` to the main checkout; never run `git` against it.
- No application code changes: nothing under `app/`, `resources/`, `routes/`, `config/`, `database/`. A capture that would need a new `data-slot` or `data-test` hook is reported, not worked around.
- Browser tests sign in through the form. `actingAs`, `be`, `login`, `loginUsingId`, `withCookie` and a blanket `Event::fake()` are forbidden under `tests/Browser` by `tests/Arch/BrowserTestRulesTest.php`.
- `Tests\BrowserTestCase` calls `Http::preventStrayRequests()`: every outbound call is faked.
- Captures are light theme, `en-US`, reduced motion, 1440 × 900, device scale factor 2.
- Tests carry no comment. A test's name says what the picture shows. No plan or ticket identifier in code, test names or commit subjects.
- PHP follows the project's guidelines: typed properties and return types, constructor promotion, string interpolation, curly braces everywhere, early returns, PascalCase constants, docblocks only for generics or array shapes.
- Run `vendor/bin/pint --dirty --format agent` before every commit.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Nothing is pushed.

## Review Focus

1. Two captures of an unchanged page that differ by a few anti-aliased pixels. Expected: the tracked file is not rewritten (this is what `CaptureFile` exists for; the trait must go through it, never `rename` directly). Pinned by the proof test's "second capture keeps the file" assertion (Task 2).
2. A selector that matches nothing. Expected: the test fails with the selector's name, and no half-written file is left in `website/src/assets/screenshots/`. Pinned by the test "leaves nothing behind when the element is missing" (Task 2).
3. A capture name with a section folder that does not exist yet. Expected: the folder is created. Pinned by the proof test, which writes into a folder it deletes afterwards (Task 2).
4. Eight people signing in during one test file trips the login rate limiter. Expected: `docsVisit` lifts the limit, as the visual tests do. Covered by `docsVisit` itself; pinned by the story test signing in two people in one test (Task 2).
5. A capture taken at the wrong density (the context option silently ignored). Expected: the picture is exactly twice the element's CSS width. Pinned by the proof test's width assertion (Task 2).

---

## File structure

| File | Responsibility |
|---|---|
| `tests/Browser/Support/CapturesDocs.php` | open a page for the documentation, capture one element |
| `tests/Browser/Support/DocsWorld.php` | the story: workspace Nordlys, team Atlas, eight people, three sprints |
| `tests/BrowserTestCase.php` | one more `use` line |
| `tests/Browser/Docs/CaptureDocsTest.php` | proves the two above; writes into `_selftest/` and removes it |

---

### Task 1: A worktree that can run browser tests

The worktree was created without dependencies. This task changes no tracked file.

**Files:** none tracked. Creates `.env`, `vendor/`, `node_modules/`, `public/build/` (all ignored).

- [ ] **Step 1: Install and build**

```bash
cp ../../../.env .env
composer install --no-interaction
npm ci
npm run build
```

`../../../.env` is the owner's local environment file in the main checkout (the worktree lives in `.claude/worktrees/public-docs-site`). It is ignored by git and never leaves the machine. If it does not exist, stop and ask the owner for the database settings of the Sail container.

- [ ] **Step 2: Check that the browser can be driven**

```bash
npx playwright install chromium
DB_CONNECTION=pgsql DB_DATABASE=testing vendor/bin/pest tests/Browser/Smoke/HarnessTest.php
```

Expected: PASS. If the database refuses the connection, the Sail container `skrum-pgsql-1` is not running: ask the owner to start it (`vendor/bin/sail up -d pgsql` in the main checkout). If another session is running browser tests against the same `testing` database or the same Reverb port at this moment, wait for it: the two would corrupt each other.

- [ ] **Step 3: Confirm the tree is still clean**

Run: `git status --short`
Expected: no output.

---

### Task 2: The capture trait and the story

**Files:**
- Create: `tests/Browser/Support/CapturesDocs.php`
- Create: `tests/Browser/Support/DocsWorld.php`
- Create: `tests/Browser/Docs/CaptureDocsTest.php`
- Modify: `tests/BrowserTestCase.php` (imports and the `use` block at the top of the class)

**Interfaces:**
- Consumes: `visualSignIn(User $user, string $path, array $options): mixed` and `teamSprint(Team $team, int $number, string $startsOn, string $endsOn): TeamSprint` from `tests/Pest.php`; `CaptureFile::replaceWhenPictureDiffers(string $candidate, string $tracked): bool`; the private constant `SettleScript` of `CapturesVisuals` (reachable because both traits are used by the same class); the plugin's `$page->screenshotElement(string $selector, ?string $filename)`, which writes `tests/Browser/Screenshots/<filename>` and adds `.png` only when the name has no extension.
- Produces, on every test under `tests/Browser`:
  - `$this->docsVisit(User $user, string $path): mixed` — signs `$user` in through the form, opens `$path`, returns the page.
  - `$this->docsOpen(string $path): mixed` — opens `$path` signed out (sign-in page, guest join pages), returns the page.
  - `$this->docShot(mixed $page, string $name, string $selector): void` — `$name` is `<section>/<picture>` without extension; the picture lands in `website/src/assets/screenshots/<section>/<picture>.png`.
- Produces `Tests\Browser\Support\DocsWorld`:
  - `DocsWorld::create(): self`
  - `public Workspace $workspace` (name `Nordlys`, slug `nordlys`), `public Team $team` (name `Atlas`, slug `atlas`), `public Collection $people` (`Collection<string, User>` keyed by first name)
  - `person(string $firstName): User`
  - The cast, in order: Camille Roux (workspace admin, team owner), Théo Martin (member, facilitator), Inès Benali, Malik Kone, Sofia Lindqvist, Noa Kim, Lucas Durand (members), Yuki Tanaka (member, observer). Every password is `password`. Addresses are `<first name in ASCII lower case>@nordlys.example`.
  - Sprints 41, 42 (past) and 43 (current), fourteen days each.

- [ ] **Step 1: Write the failing tests**

`tests/Browser/Docs/CaptureDocsTest.php`:

```php
<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use Illuminate\Support\Facades\File;
use Tests\Browser\Support\DocsWorld;

afterEach(function () {
    File::deleteDirectory(base_path('website/src/assets/screenshots/_selftest'));
});

it('gives the story its workspace, its team, eight people with their roles and three sprints', function () {
    $world = DocsWorld::create();

    $workspaceAdmins = $world->workspace->members()->wherePivot('role', WorkspaceRole::Admin->value)->pluck('users.name')->all();
    $teamRole = fn (TeamRole $role): array => $world->team->members()->wherePivot('role', $role->value)->pluck('users.name')->all();

    expect($world->workspace->only('name', 'slug'))->toBe(['name' => 'Nordlys', 'slug' => 'nordlys'])
        ->and($world->team->only('name', 'slug'))->toBe(['name' => 'Atlas', 'slug' => 'atlas'])
        ->and($world->people->keys()->all())->toBe(['Camille', 'Théo', 'Inès', 'Malik', 'Sofia', 'Noa', 'Lucas', 'Yuki'])
        ->and($world->person('Inès')->email)->toBe('ines@nordlys.example')
        ->and($workspaceAdmins)->toBe(['Camille Roux'])
        ->and($teamRole(TeamRole::Owner))->toBe(['Camille Roux'])
        ->and($teamRole(TeamRole::Facilitator))->toBe(['Théo Martin'])
        ->and($teamRole(TeamRole::Observer))->toBe(['Yuki Tanaka'])
        ->and($world->team->members()->count())->toBe(8)
        ->and($world->team->sprints()->orderBy('number')->pluck('number')->all())->toBe([41, 42, 43]);
});

it('saves an element of the team page at twice its size and keeps the file when nothing changed', function () {
    $world = DocsWorld::create();
    $picture = base_path('website/src/assets/screenshots/_selftest/team-page.png');

    $page = $this->docsVisit($world->person('Camille'), route('teams.show', [$world->workspace, $world->team], false))
        ->assertPresent('[data-slot="team-page"]');

    $this->docShot($page, '_selftest/team-page', '[data-slot="team-page"]');

    $width = (int) $page->script('() => Math.round(document.querySelector(\'[data-slot="team-page"]\').getBoundingClientRect().width)');
    $firstCapture = hash_file('xxh128', $picture);

    $this->docShot($page, '_selftest/team-page', '[data-slot="team-page"]');

    expect(getimagesize($picture)[0])->toBe($width * 2)
        ->and(hash_file('xxh128', $picture))->toBe($firstCapture)
        ->and(File::glob(base_path('tests/Browser/Screenshots/docs-*')))->toBe([]);
});

it('signs a second person of the story in and opens a page signed out', function () {
    $world = DocsWorld::create();
    $path = route('teams.show', [$world->workspace, $world->team], false);

    $this->docsVisit($world->person('Camille'), $path)->assertPresent('[data-slot="team-page"]');
    $this->docsVisit($world->person('Yuki'), $path)->assertPresent('[data-slot="team-page"]');
    $this->docsOpen('/login')->assertPresent('#email');
});

it('leaves nothing behind when the element is missing', function () {
    $world = DocsWorld::create();

    $page = $this->docsVisit($world->person('Camille'), route('teams.show', [$world->workspace, $world->team], false))
        ->assertPresent('[data-slot="team-page"]');

    expect(fn () => $this->docShot($page, '_selftest/missing', '[data-slot="no-such-slot"]'))->toThrow(Throwable::class)
        ->and(is_file(base_path('website/src/assets/screenshots/_selftest/missing.png')))->toBeFalse();
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `DB_CONNECTION=pgsql DB_DATABASE=testing vendor/bin/pest tests/Browser/Docs/CaptureDocsTest.php`
Expected: FAIL, `Class "Tests\Browser\Support\DocsWorld" not found`.

- [ ] **Step 3: Write the story**

`tests/Browser/Support/DocsWorld.php`:

```php
<?php

namespace Tests\Browser\Support;

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Collection;
use InvalidArgumentException;

class DocsWorld
{
    /** @var array<int, array{0: string, 1: WorkspaceRole, 2: TeamRole}> */
    private const array Cast = [
        ['Camille Roux', WorkspaceRole::Admin, TeamRole::Owner],
        ['Théo Martin', WorkspaceRole::Member, TeamRole::Facilitator],
        ['Inès Benali', WorkspaceRole::Member, TeamRole::Member],
        ['Malik Kone', WorkspaceRole::Member, TeamRole::Member],
        ['Sofia Lindqvist', WorkspaceRole::Member, TeamRole::Member],
        ['Noa Kim', WorkspaceRole::Member, TeamRole::Member],
        ['Lucas Durand', WorkspaceRole::Member, TeamRole::Member],
        ['Yuki Tanaka', WorkspaceRole::Member, TeamRole::Observer],
    ];

    /**
     * @param  Collection<string, User>  $people
     */
    public function __construct(
        public Workspace $workspace,
        public Team $team,
        public Collection $people,
    ) {}

    public static function create(): self
    {
        config(['app.name' => 'Skrum']);

        $workspace = Workspace::factory()->create(['name' => 'Nordlys', 'slug' => 'nordlys']);
        $team = Team::factory()->for($workspace)->create(['name' => 'Atlas', 'slug' => 'atlas']);
        $people = collect();

        foreach (self::Cast as $index => [$name, $workspaceRole, $teamRole]) {
            $firstName = str($name)->before(' ')->toString();

            $person = User::factory()->create([
                'id' => sprintf('0199d0c5-0000-7000-8000-%012d', $index + 1),
                'name' => $name,
                'email' => str($firstName)->ascii()->lower()->append('@nordlys.example')->toString(),
            ]);

            $workspace->members()->attach($person, ['role' => $workspaceRole->value]);
            $team->members()->attach($person, ['role' => $teamRole->value]);

            $people->put($firstName, $person);
        }

        teamSprint($team, 41, now()->subDays(32)->toDateString(), now()->subDays(19)->toDateString());
        teamSprint($team, 42, now()->subDays(18)->toDateString(), now()->subDays(5)->toDateString());
        teamSprint($team, 43, now()->subDays(4)->toDateString(), now()->addDays(9)->toDateString());

        return new self($workspace, $team, $people);
    }

    public function person(string $firstName): User
    {
        return $this->people->get($firstName) ?? throw new InvalidArgumentException("Nobody in the story is called {$firstName}.");
    }
}
```

- [ ] **Step 4: Write the trait**

`tests/Browser/Support/CapturesDocs.php`:

```php
<?php

namespace Tests\Browser\Support;

use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\RateLimiter;

trait CapturesDocs
{
    /** @var array<string, int|string> */
    private const array DocsVisitOptions = [
        'colorScheme' => 'light',
        'locale' => 'en-US',
        'reducedMotion' => 'reduce',
        'deviceScaleFactor' => 2,
    ];

    protected function docsVisit(User $user, string $path): mixed
    {
        RateLimiter::for('login', fn (): Limit => Limit::none());

        return visualSignIn($user, $path, self::DocsVisitOptions)->resize(1440, 900);
    }

    protected function docsOpen(string $path): mixed
    {
        return visit($path, self::DocsVisitOptions)->resize(1440, 900);
    }

    protected function docShot(mixed $page, string $name, string $selector): void
    {
        $candidate = 'docs-'.str_replace('/', '-', $name).'.candidate';
        $tracked = base_path("website/src/assets/screenshots/{$name}.png");

        $page->script(self::SettleScript);
        $page->screenshotElement($selector, $candidate);

        File::ensureDirectoryExists(dirname($tracked));

        CaptureFile::replaceWhenPictureDiffers(base_path("tests/Browser/Screenshots/{$candidate}"), $tracked);
    }
}
```

The folder is created only after the element was captured, so a missing element leaves no empty folder and no file.

- [ ] **Step 5: Use the trait in `tests/BrowserTestCase.php`**

Add the import, in alphabetical order with the others:

```php
use Tests\Browser\Support\CapturesDocs;
```

and the trait, first in the class's `use` block:

```php
abstract class BrowserTestCase extends TestCase
{
    use CapturesDocs;
    use CapturesVisuals;
    use InteractsWithBrowser;
    use InteractsWithWhiteboards;
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `DB_CONNECTION=pgsql DB_DATABASE=testing vendor/bin/pest tests/Browser/Docs/CaptureDocsTest.php`
Expected: 4 tests pass.

If the width assertion fails with the picture as wide as the element (not twice), the plugin did not pass `deviceScaleFactor` to the browser context: read `vendor/pestphp/pest-plugin-browser/src/Api/` for how `visit()` turns its options into a context and report what it accepts; do not scale the picture afterwards.

If the "keeps the file" assertion fails, the page is still moving when it is captured: open the candidate and the tracked file, find what differs, and report it. Do not raise `CaptureFile`'s noise thresholds.

If the first test fails on a slug, `Workspace` or `Team` rewrites the slug it is given: read the model's `booted()` and set the attribute the way the model expects.

- [ ] **Step 7: Run it again, then the rules that guard browser tests**

```bash
DB_CONNECTION=pgsql DB_DATABASE=testing vendor/bin/pest tests/Browser/Docs/CaptureDocsTest.php
vendor/bin/pest tests/Arch
git status --short
```

Expected: 4 pass; the arch tests pass; `git status` lists only the four files of this task (no PNG, no `_selftest` folder, nothing under `tests/Browser/Screenshots`).

- [ ] **Step 8: Format and commit**

```bash
vendor/bin/pint --dirty --format agent
git add tests/Browser/Support/CapturesDocs.php tests/Browser/Support/DocsWorld.php tests/Browser/Docs/CaptureDocsTest.php tests/BrowserTestCase.php
git commit -m "test(browser): captures for the documentation, cropped to one element, from a fixed story

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-review

- Spec §5.6, the trait (`docsVisit`, `docShot`, light, `en-US`, reduced motion, 1440 × 900, scale 2, through `CaptureFile`): Task 2. `docsOpen` is added for pages seen signed out; the spec is amended to name it.
- §5.6, the story (Nordlys, Atlas, eight people, three sprints, from factories, tests only): Task 2.
- §5.6, no `actingAs`, every outbound call faked: Global Constraints; `tests/Arch` run in Task 2 step 7.
- Criterion 13 (a second run leaves the tree clean): the proof test's second capture, and Task 2 step 7.
- Criterion 14: Task 2 step 7.
- Not in this plan: the per-section capture tests and the committed pictures (plan C).
