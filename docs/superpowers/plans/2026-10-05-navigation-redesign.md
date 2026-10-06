# Navigation redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does: one writer, tasks in order, a review after each task, a whole-branch review at the end). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Owner decisions**, **Global Constraints** and its own task before anything else, then `docs/database.md` ("Rules for database code") when its task touches PHP.

**Status:** draft, awaiting the owner's review (2026-10-05).

**Goal:** One job per screen: a sidebar whose every entry is a page, a Home that answers "what now", one Sessions list grouped by sprint, an Insights page with tabs, Members as its own page, no sidebar inside a session and a leave dialog for the facilitator.

**Architecture:** No table changes. The back end adds one shared prop (the live count), one reading of `ListTeamSessions` that is not bound to a state (`timeline`), two pages (`teams.insights.show`, `teams.rituals.show`), opens `teams.members.index` to every member and slims `teams.show`. The front moves existing components to their new page instead of rewriting them; the per-kind sections of the team page are deleted once their functions are re-homed (spec §9.9).

**Tech Stack:** Laravel 13, PHP 8.4, Pest (feature, arch, browser), Inertia 3, React 19, Tailwind 4, vite-plus (Vitest), Wayfinder; PostgreSQL through `bin/test-db pgsql`. Run `composer show --direct` and read `package.json` before relying on a package API.

**Spec:** `docs/superpowers/specs/2026-10-05-navigation-redesign-design.md`. Executors read both; a "§" below is a section of the spec.

**Not in this plan:** spec §3 (workspace screens, the switcher's menu, scheduling, live refresh, new charts, thumbnails in the list).

**Tasks:** 46. Order of execution (numbers are not the order): Step A, back end: 1 to 5. Step B, front: 6 to 14. Then 19, 20 and 21, added on 2026-10-06 (the owner's answers and the loose ends of the task reviews). Final: 15 to 18. Then 22, 23 (the team's activity) 24 (ROTI in colour), 25 and 26 (eNPS), 27 (the deck picker), 28 (the retro form's columns), 29 (the sign-in screens' brand panel), 30 (the settings split), 31 (the Members dialog), 32 (the Templates page), 33 (the Activity page's person filter), 34 (the whiteboard form), 35 (the Sessions rows), 36 (the room's settings dialog), 37 (the retro card composer), 38 (the side panel's edge), 39 (the board's scrollbar), 40 (the session's top bar), 41 (the leave dialog), 42 (branding on save), 43 (avatars in lists of people), 44 (the emoji picker), 45 (check for a version now), 46 (the whiteboard's top bar), asked on 2026-10-06 while the Final step was running.

## Branch and run

- Branch `navigation-redesign`, cut from `main` at `8258b3d3` (the plan was written from a reading at `15bb4fec`; `main` had one more commit when the branch was cut); the spec is its first commit. No merge into `main`, no push: the owner merges after the 2026-10-18 release (spec §15.3).
- One writer, tasks in order. No lanes: nearly every front task touches `app-sidebar.tsx`, `app-layout.tsx` or `team-page.tsx`.
- This plan was written from `main` at `15bb4fec`. **Every task re-reads the files it touches**; a line or a body quoted here that no longer matches is followed in spirit and reported.

## Owner decisions

Spec §4 (approved 2026-10-05) binds every task. Spec §15 was not answered point by point; the plan follows its recommendations:

| # | Question | Built |
|---|---|---|
| 15.1 | The topbar title repeats the page's heading | both stay; the topbar title is small and muted (Task 7) |
| 15.2 | The mockups contradict the app | one pointer line at the top of four READMEs (Task 17) |
| 15.3 | Merge date | after the release; this plan never merges |

Two consequences of existing rules that the owner has not seen spelled out. They are built as written and listed in the report of Task 18:

| # | Consequence | Built |
|---|---|---|
| N-1 | **Answered by the owner on 2026-10-06 (spec §17.1).** The premise was false: the server refused `completed` from an earlier phase. The owner chose to allow it. | Task 19 |
| N-2 | An open survey is "live" by the rule of `ListTeamSessions`. A team with a survey open for a week shows the sidebar's dot for a week. | as said: the count uses the Live rule unchanged |
| N-3 | **Answered by the owner on 2026-10-06 (spec §17.2).** An icebreaker room stayed live for ever. | Task 20: live for 15 minutes after its last activity |

## File structure

| File | Responsibility | Task |
|---|---|---|
| `app/Actions/Sessions/CountLiveTeamSessions.php` (new) | the number of live sessions of a team a viewer may see | 1 |
| `app/Http/Middleware/HandleInertiaRequests.php` | shares `liveSessions` | 1 |
| `app/Actions/Sessions/ListTeamSessions.php` | gains `timeline()` and the row's new fields | 2 |
| `app/Http/Controllers/TeamSessionsController.php` | `kind` in, `tab` out; the new props | 2 |
| `app/Http/Controllers/TeamMembersController.php` | `index`: people only, `view` | 3 |
| `app/Http/Controllers/TeamRitualsController.php` | gains `show` (it has `update`) | 3 |
| `app/Actions/Teams/TeamSettingsSections.php` | key `rituals` replaces `members` | 3 |
| `app/Http/Controllers/TeamInsightsController.php` (new) | the Mood & ROTI tab | 4 |
| `app/Http/Controllers/TeamHealthChecksController.php`, `TeamGameRoomsController.php` | props that leave | 4 |
| `app/Http/Controllers/TeamsController.php` | `show`: fewer props, three new | 5 |
| `routes/web.php` | two routes | 3, 4 |
| `resources/js/components/skrum/app-sidebar.tsx`, `hooks/use-sidebar-model.ts`, `components/workspaces/command-menu.tsx` | the new entries | 6 |
| `resources/js/layouts/skrum/app-layout.tsx`, `components/skrum/app-topbar.tsx` | `title` in place of `breadcrumbs` | 7 |
| `resources/js/components/teams/sessions-page.tsx`, `components/skrum/session-row.tsx`, `lib/teams/sessions.ts` | the Sessions list | 8 |
| `resources/js/components/teams/team-page.tsx` and the cards it keeps | Home | 9 |
| `resources/js/pages/teams/insights.tsx` (new), `components/teams/insights-tabs.tsx` (new) | Insights | 10 |
| `resources/js/pages/teams/members.tsx`, `pages/teams/rituals.tsx` (new), `components/team-settings/team-settings-shell.tsx` | Members, Settings | 11 |
| `resources/js/pages/action-items/index.tsx` | the scope switch | 12 |
| `resources/js/components/skrum/frames.tsx`, `layouts/skrum/session-layout.tsx`, `components/session/session-title.tsx`, `components/session/leave-session-dialog.tsx` (new) | no sidebar, the leave dialog | 13 |
| `resources/js/components/skrum/mobile-tab-bar.tsx` | the phone bar | 14 |

## Global Constraints

- **The spec first.** Where a mockup of `docs/design-system/` differs from the spec on a screen the spec names, the spec wins (owner, 2026-10-05). Everywhere else the front rules of `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` §5 hold: tokens only, rem, Tailwind scale, no overflow from 20rem to 60rem, visible focus, contrast, reduced motion, lucide icons, literal `t('…')`, presentational `skrum/` components (no network, no router).
- **Move, do not rewrite.** `SessionRow`, `SubNav`, `LoadMoreFeed`, `EmptyState`, `TeamOpenActionsCard`, `TeamActivityCard`, `TeamRotiCard`, `TeamMoodCard`, `TeamCreateTiles`, `ConfirmDialog`, `MembersTable`, `TeamInviteDialog`, `GamesLeaderboard`, `EstimationHistory`, `TeamHealthManager`, `SprintsCard`, `DefaultFacilitatorsCard`, `RetroTemplatesCard`, `DefaultColumnsCard` exist. A task that feels the need for a new component of this kind stops and re-reads this line.
- **Database: Eloquent and the standard query builder only.** `docs/database.md` rules 1 to 12; `tests/Arch/DatabasePortabilityTest.php` enforces them. No raw query, no driver test, an explicit tie-breaker on every sort. No migration in this plan; a task that finds it needs one stops and asks.
- **Tests per task, on PostgreSQL.** Each task runs what it wrote or touched with `bin/test-db pgsql -- <paths>`. The red step may run once in memory: `vendor/bin/sail artisan test --compact <path>`. Vitest: `npm run test -- <pattern>`.
- **Browser walkthroughs** are not touched before Task 16, which rewrites them in one pass. Until then a red walkthrough that follows an old path is expected; nobody "fixes" one early.
- **No test is deleted** without the owner's approval. A test whose subject moved is moved and rewritten; a test whose subject is gone (a status tab, an anchor) is listed in the task's report for the owner, not removed.
- **No new dependency**, PHP or JS.
- **Four languages, informal.** Every new `__('…')` and `t('…')` key goes into `lang/en.json`, `fr.json`, `es.json`, `de.json` in the commit that introduces it (`tests/Feature/TranslationKeysTest.php`), French "tu", Spanish "tú", German "du" (`tests/Feature/InformalRegisterTest.php`). A key that exists keeps its value.
- **No plan or task identifier** in code, tests, test names or commit subjects.
- Files created with `vendor/bin/sail artisan make:… --no-interaction`; controllers plural with CRUD names (`tests/Arch/ArchTest.php`); route names camelCase, URLs kebab-case, tuple notation; every rendered page has its file under `resources/js/pages` (`tests/Arch/FrontEndPagesTest.php`).
- PHP style: early returns, no `else`, happy path last, typed everything, PascalCase constants, constructor promotion, no comment that restates code; before each commit `vendor/bin/pint --dirty --format agent` and `vendor/bin/sail composer types:check`.
- Octane is installed: no static or per-request singleton state.
- Front gates after every task that touches the front: `npm run types:check`, `npm run check`, `npm run build` (it regenerates Wayfinder, needed after every new route the front uses).
- **Commits:** one per task, in the repository's style (`feat(sessions): …`, `refactor(team): …`, `test: …`), each ending with:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

- **Never push, never merge into `main`.**

## Review Focus

1. **A session on a page boundary** while ten lists (five kinds, two states) share timestamps: "Load more" twice gives no duplicate and no gap. Walk test in Task 2.
2. **A session that goes live between two loads**: it is in `live` on the fresh page and may still be in the rows already merged. The page shows it once, in "Live now". Vitest in Task 8.
3. **A draft survey of someone else**: not listed, not counted in a chip, not counted in "All". Feature test in Task 2.
4. **"End it" that fails** (the viewer lost the role, the network dropped): the dialog stays open with the error, nobody is sent to Home. Vitest in Task 13.
5. **A plain member on Members**: the page's props carry no invitation link and no pending invitation. Feature test in Task 3.
6. **Old links**: `?tab=finished` on Sessions shows the list and no validation error; `?new=retro` on Home still opens the dialog on that kind. Feature test in Task 2, Vitest in Task 6.
7. **A team with no sprint, and a session outside every sprint**: grouped by month, and under "Outside a sprint". Feature test in Task 2, Vitest in Task 8.

---

## Step A — back end

### Task 1: The live count, shared

**Files:**
- Create: `app/Actions/Sessions/CountLiveTeamSessions.php`
- Modify: `app/Http/Middleware/HandleInertiaRequests.php` (`share`, one private method)
- Modify: `resources/js/types/` (the shared props type: find `overdueAssignedCount`)
- Test: `tests/Feature/SharedPropsTest.php`

**Interfaces:**
- Produces: `CountLiveTeamSessions::handle(Team $team, User $viewer): int`; shared prop `liveSessions: { count: number } | null`.

- [ ] **Step 1: Write the failing tests** (append to `tests/Feature/SharedPropsTest.php`; add the imports `App\Enums\RetroPhase`, `App\Models\PokerGame`, `App\Models\Retro`)

```php
it('shares the number of live sessions of the current team', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    Retro::factory()->for($team)->started()->create();
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create();
    Retro::factory()->for($team)->create();
    openPokerRound(PokerGame::factory()->for($team)->create());

    $this->actingAs($member)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('liveSessions.count', 2));
});

it('shares no live count without a current team', function () {
    $workspace = Workspace::factory()->create();

    $this->actingAs(workspaceMember($workspace))
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('liveSessions', null));
});

it('shares no live count for a visitor', function () {
    $this->get(route('login'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('liveSessions', null));
});

it('does not count the live sessions of another team', function () {
    $team = Team::factory()->create();
    Retro::factory()->for(Team::factory()->for($team->workspace))->started()->create();

    $this->actingAs(teamMember($team))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('liveSessions.count', 0));
});
```

- [ ] **Step 2: Run them, see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/SharedPropsTest.php`
Expected: the four new tests fail on the missing `liveSessions` prop.

- [ ] **Step 3: Write the action**

```php
<?php

namespace App\Actions\Sessions;

use App\Enums\SessionState;
use App\Models\Team;
use App\Models\User;

class CountLiveTeamSessions
{
    public function __construct(private ListTeamSessions $sessions) {}

    /**
     * ponytail: five counts on every full page visit; cache per team for a few seconds if it shows in a profile.
     */
    public function handle(Team $team, User $viewer): int
    {
        $live = SessionState::Live;

        return $this->sessions->retros($team, $live)->count()
            + $this->sessions->pokerGames($team, $live)->count()
            + $this->sessions->surveys($team, $viewer, $live)->count()
            + $this->sessions->whiteboards($team, $live)->count()
            + $this->sessions->rooms($team, $live)->count();
    }
}
```

- [ ] **Step 4: Share it.** In `share()`, after `'actionItems'`:

```php
'liveSessions' => fn (): ?array => $this->liveSessions($teamResolver, $request),
```

and the method, beside `currentTeam`:

```php
/**
 * @return array{count: int}|null
 */
private function liveSessions(CurrentTeamResolver $resolver, Request $request): ?array
{
    $team = $resolver->currentTeam();
    $user = $request->user();

    if ($team === null || $user === null) {
        return null;
    }

    return ['count' => resolve(CountLiveTeamSessions::class)->handle($team, $user)];
}
```

Add `liveSessions: { count: number } | null` to the shared props type where `actionItems` is declared.

- [ ] **Step 5: Run and gate**

Run: `bin/test-db pgsql -- tests/Feature/SharedPropsTest.php tests/Arch`, then `vendor/bin/pint --dirty --format agent`, `vendor/bin/sail composer types:check`, `npm run types:check`.
Expected: green.

- [ ] **Step 6: Commit** — `feat(sessions): share the number of live sessions of the current team`

### Task 2: The Sessions list — live apart, everything else by date, counts by kind

**Files:**
- Modify: `app/Actions/Sessions/ListTeamSessions.php`
- Modify: `app/Http/Controllers/TeamSessionsController.php`
- Test: `tests/Feature/Sessions/ListTeamSessionsTest.php`, `tests/Feature/Sessions/TeamSessionsTest.php`

**Interfaces:**
- Produces:

```php
public const array Kinds = ['retro', 'poker', 'survey', 'whiteboard', 'icebreaker'];
public const int LiveLimit = 100;

/**
 * @param  SessionKind|null  $kind
 * @return array{
 *     live: list<TeamSession>,
 *     sessions: list<TeamSession>,
 *     counts: array{all: int, retro: int, poker: int, survey: int, whiteboard: int, icebreaker: int},
 *     total: int,
 *     nextCursor: ?string
 * }
 */
public function timeline(Team $team, User $viewer, ?string $kind = null, ?SessionCursor $before = null, int $limit = self::PageSize, ?string $search = null): array
```

- A row (`TeamSession`) keeps its thirteen fields and gains: `sprint: array{number: int, startsOn: string, endsOn: string}|null`, `roti: ?float`, `actions: ?int`, `points: ?float`, `canDelete: bool`, `canDuplicate: bool`. `people` is now also filled for an icebreaker room (its players).
- `total` is the number of non-live rows under the filter (what "Load more" walks). `counts` include live rows and ignore `kind`.
- Page props of `teams/sessions`: `workspace`, `team`, `kind` (`?string`), `q`, `live`, `sessions` (merged, matched on `id`), `counts`, `total`, `nextCursor`, `hasSprints` (`bool`), plus the new-session options. `tab` is gone.

`handle()` stays as it is: its tests stand and `ListRecentTeamSessions` relies on the class. Removing it is a later cleanup the owner approves.

- [ ] **Step 1: Write the failing tests of the action** (append to `tests/Feature/Sessions/ListTeamSessionsTest.php`, which already defines `playedRoom` and travels to the start of the minute; add the imports `App\Models\ActionItem`, `App\Models\RotiVote`, `App\Models\TeamSprint` after reading their factories)

```php
function timelineOf(Team $team, User $viewer, ?string $kind = null, ?string $before = null, ?string $search = null): array
{
    return resolve(ListTeamSessions::class)->timeline($team, $viewer, $kind, SessionCursor::parse($before), search: $search);
}

it('lists live sessions apart and every other session below', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    Retro::factory()->for($team)->started()->create(['title' => 'live retro']);
    Retro::factory()->for($team)->create(['title' => 'retro not started']);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'retro done']);
    PokerGame::factory()->for($team)->ended()->create(['title' => 'poker done']);

    $page = timelineOf($team, $viewer);

    expect(array_column($page['live'], 'title'))->toBe(['live retro'])
        ->and(array_column($page['sessions'], 'title'))->toEqualCanonicalizing(['retro not started', 'retro done', 'poker done'])
        ->and(array_column($page['sessions'], 'state', 'title'))->toMatchArray(['retro not started' => 'upcoming', 'retro done' => 'finished'])
        ->and($page['total'])->toBe(3)
        ->and($page['counts'])->toMatchArray(['all' => 4, 'retro' => 3, 'poker' => 1, 'survey' => 0, 'whiteboard' => 0, 'icebreaker' => 0])
        ->and($page['nextCursor'])->toBeNull();
});

it('keeps one kind when asked and still counts every kind', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    Retro::factory()->for($team)->started()->create(['title' => 'live retro']);
    openPokerRound(PokerGame::factory()->for($team)->create(['title' => 'live poker']));
    PokerGame::factory()->for($team)->ended()->create(['title' => 'poker done']);

    $page = timelineOf($team, $viewer, 'poker');

    expect(array_column($page['live'], 'title'))->toBe(['live poker'])
        ->and(array_column($page['sessions'], 'title'))->toBe(['poker done'])
        ->and($page['total'])->toBe(1)
        ->and($page['counts'])->toMatchArray(['all' => 3, 'retro' => 1, 'poker' => 2]);
});

it('walks 45 sessions of five kinds in pages of 20 with no duplicate and no gap', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);

    foreach (range(1, 9) as $index) {
        Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => "retro {$index}"]);
        PokerGame::factory()->for($team)->ended()->create(['title' => "poker {$index}"]);
        TeamSurvey::factory()->for($team)->closed()->create(['title' => "poll {$index}"]);
        Whiteboard::factory()->for($team)->create(['title' => "board {$index}"]);
        playedRoom($team, "room {$index}");
    }

    $first = timelineOf($team, $viewer);
    $second = timelineOf($team, $viewer, before: $first['nextCursor']);
    $third = timelineOf($team, $viewer, before: $second['nextCursor']);
    $ids = array_column([...$first['sessions'], ...$second['sessions'], ...$third['sessions']], 'id');

    expect($first['sessions'])->toHaveCount(20)
        ->and($second['sessions'])->toHaveCount(20)
        ->and($third['sessions'])->toHaveCount(5)
        ->and($third['nextCursor'])->toBeNull()
        ->and($ids)->toHaveCount(45)
        ->and(array_unique($ids))->toHaveCount(45)
        ->and($first['total'])->toBe(45);
});

it('neither lists nor counts a draft poll its viewer may not edit', function () {
    $team = Team::factory()->create();
    TeamSurvey::factory()->for($team)->draft()->create(['title' => 'someone else\'s draft']);

    $page = timelineOf($team, teamMember($team));

    expect($page['sessions'])->toBe([])
        ->and($page['counts']['survey'])->toBe(0)
        ->and($page['counts']['all'])->toBe(0);
});

it('gives each row the sprint that holds its last change, or none', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    TeamSprint::factory()->for($team)->create(['number' => 7, 'starts_on' => now()->subDays(3)->toDateString(), 'ends_on' => now()->addDays(10)->toDateString()]);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'in the sprint']);
    $this->travel(-30)->days();
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'before the sprints']);
    $this->travelBack();

    $rows = array_column(timelineOf($team, $viewer)['sessions'], 'sprint', 'title');

    expect($rows['in the sprint'])->toMatchArray(['number' => 7])
        ->and($rows['before the sprints'])->toBeNull();
});

it('carries the outcome of each kind', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'retro']);
    RotiVote::factory()->for($retro)->create(['score' => 3]);
    RotiVote::factory()->for($retro)->create(['score' => 4]);
    ActionItem::factory()->for($retro)->create();
    $game = PokerGame::factory()->for($team)->ended()->create(['title' => 'poker']);
    PokerTask::factory()->for($game, 'game')->create(['estimate_numeric' => 21]);
    PokerTask::factory()->for($game, 'game')->create(['estimate_numeric' => 13]);

    $rows = array_column(timelineOf($team, $viewer)['sessions'], null, 'title');

    expect($rows['retro']['roti'])->toBe(3.5)
        ->and($rows['retro']['actions'])->toBe(1)
        ->and($rows['poker']['points'])->toBe(34.0)
        ->and($rows['poker']['tasks'])->toBe(2);
});
```

The factories' relation names (`for($retro)`, `for($game, 'game')`) and the sprint's `number` column are written from the models' names: read `RotiVoteFactory`, `ActionItemFactory`, `PokerTaskFactory`, `TeamSprintFactory` and correct the calls before running.

- [ ] **Step 2: Run them, see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Sessions/ListTeamSessionsTest.php`
Expected: the six new tests fail with "Call to undefined method … timeline()".

- [ ] **Step 3: Write `timeline()`**

Add the two constants, then:

```php
public function timeline(Team $team, User $viewer, ?string $kind = null, ?SessionCursor $before = null, int $limit = self::PageSize, ?string $search = null): array
{
    $counts = array_fill_keys(self::Kinds, 0);
    $live = [];
    $past = [];
    $total = 0;

    foreach (self::Kinds as $each) {
        foreach (SessionState::cases() as $state) {
            $query = $this->kindQuery($each, $team, $viewer, $state, $search);

            if ($kind !== null && $kind !== $each) {
                $counts[$each] += $query->count();

                continue;
            }

            $isLive = $state === SessionState::Live;
            $read = $this->read($each, $query, $isLive ? null : $before, $isLive ? self::LiveLimit : $limit);
            $rows = array_map(fn (array $row): array => [...$row, 'state' => $state], $read['rows']);
            $counts[$each] += $read['total'];

            if ($isLive) {
                $live = [...$live, ...$rows];

                continue;
            }

            $past = [...$past, ...$rows];
            $total += $read['total'];
        }
    }

    $newestFirst = fn (array $first, array $second): int => $this->compare($first['model'], $second['model']);
    usort($live, $newestFirst);
    usort($past, $newestFirst);

    $kept = array_slice($past, 0, $limit);
    $last = end($kept);
    $calendar = $this->calendarOf($team, [...$live, ...$kept]);
    $present = fn (array $row): array => $this->presentInTimeline($row['kind'], $row['model'], $row['state'], $viewer, $calendar);

    return [
        'live' => array_map($present, $live),
        'sessions' => array_map($present, $kept),
        'counts' => ['all' => array_sum($counts), ...$counts],
        'total' => $total,
        'nextCursor' => count($past) > $limit && $last !== false ? SessionCursor::after($last['model'])->toString() : null,
    ];
}
```

Note on the cursor: `read()` asks each list for `limit + 1` rows after the cursor, so a merged page of `limit` rows is the true first page of the union, as in `handle()`. The live block is read without the cursor and capped at `LiveLimit` (`ponytail: a team with more than 100 live sessions sees the newest 100`).

The three helpers:

```php
/**
 * @param  SessionKind  $kind
 * @return Builder<covariant Model>
 */
private function kindQuery(string $kind, Team $team, User $viewer, SessionState $state, ?string $search): Builder
{
    return match ($kind) {
        'retro' => $this->titled($this->retros($team, $state), 'title', $search)
            ->withCount(['participants', 'actionItems'])
            ->withAvg('rotiVotes', 'score'),
        'poker' => $this->titled($this->pokerGames($team, $state), 'title', $search)
            ->withCount('tasks')
            ->withSum('tasks as total_points', 'estimate_numeric'),
        'survey' => $this->surveysTitled($this->surveys($team, $viewer, $state), $search)->withCount([
            'respondents as responses_count' => fn (Builder $respondents) => $respondents->whereHas('answers'),
        ]),
        'whiteboard' => $this->titled($this->whiteboards($team, $state), 'title', $search)->with('facilitator.user'),
        'icebreaker' => $this->titled($this->rooms($team, $state), 'name', $search)->withCount('players'),
    };
}

/**
 * The sprints that cover the rows shown; none when there is no row.
 *
 * @param  list<array{model: Model}>  $rows
 */
private function calendarOf(Team $team, array $rows): ?SprintCalendar
{
    if ($rows === []) {
        return null;
    }

    $moments = array_map(fn (array $row): CarbonImmutable => $this->updatedAt($row['model']), $rows);

    return SprintCalendar::forTeam($team, min($moments), max($moments));
}

/**
 * @param  SessionKind  $kind
 * @return TeamSession
 */
private function presentInTimeline(string $kind, Model $session, SessionState $state, User $viewer, ?SprintCalendar $calendar): array
{
    $sprint = $calendar?->sprintOn($this->updatedAt($session));
    $roti = $session->getAttribute('roti_votes_avg_score');
    $points = $session->getAttribute('total_points');

    return [
        ...$this->present($kind, $session, $state),
        'sprint' => $sprint === null ? null : ['number' => $sprint['number'], 'startsOn' => $sprint['startsOn'], 'endsOn' => $sprint['endsOn']],
        'people' => match (true) {
            $session instanceof Retro => (int) $session->getAttribute('participants_count'),
            $session instanceof GameRoom => (int) $session->getAttribute('players_count'),
            default => null,
        },
        'roti' => $roti === null ? null : round((float) $roti, 1),
        'actions' => $session instanceof Retro ? (int) $session->getAttribute('action_items_count') : null,
        'points' => $points === null ? null : (float) $points,
        'canDelete' => $this->mayDelete($session, $viewer),
        'canDuplicate' => $this->mayDuplicate($session, $viewer),
    ];
}
```

`mayDelete` and `mayDuplicate`: read how the team page decides today — `PresentWhiteboardSummary` for a board's delete, and the presenter behind `TeamSurveysSection` for a survey's delete and duplicate — and call the same policy or the same rule. A retro, a poker game and an icebreaker room return `false` for both: this plan adds no deletion that the team page did not offer. Extend the `TeamSession` phpstan type with the six fields; import `App\Support\Teams\SprintCalendar`.

`SprintCalendar`'s header says a session's sprint is the one of the day it was created. The list uses the day of the last change instead, on purpose (spec §6.2): it is the sort key, so a group is never cut by paging. Leave the class's comment alone and say this in the docblock of `calendarOf`.

- [ ] **Step 4: Run the action's tests**

Run: `bin/test-db pgsql -- tests/Feature/Sessions/ListTeamSessionsTest.php`
Expected: green, old and new.

- [ ] **Step 5: Write the failing tests of the page.** In `tests/Feature/Sessions/TeamSessionsTest.php`, rewrite the tests that read `tab` (they describe a behaviour the spec removes; list each in the report) and add:

```php
it('shows live sessions apart, the rest below, and the counts by kind', function () {
    $team = Team::factory()->create();
    Retro::factory()->for($team)->started()->create(['title' => 'Sprint 42 retro']);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Old retro']);

    $this->actingAs(teamMember($team))
        ->get(route('teams.sessions.index', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/sessions')
            ->where('kind', null)
            ->where('live.0.title', 'Sprint 42 retro')
            ->where('sessions.0.title', 'Old retro')
            ->where('counts.all', 2)
            ->where('counts.retro', 2)
            ->where('total', 1)
            ->where('hasSprints', false)
            ->missing('tab')
            ->has('canCreatePokerGame'));
});

it('filters on a kind, refuses an unknown one, and ignores the tab of an old link', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create();
    PokerGame::factory()->for($team)->ended()->create(['title' => 'Planning']);

    $this->actingAs($member)
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'kind' => 'poker']))
        ->assertInertia(fn (Assert $page) => $page->where('kind', 'poker')->has('sessions', 1)->where('sessions.0.title', 'Planning')->where('counts.all', 2));

    $this->actingAs($member)
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'kind' => 'meeting']))
        ->assertSessionHasErrors('kind');

    $this->actingAs($member)
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'tab' => 'finished']))
        ->assertOk()
        ->assertSessionHasNoErrors()
        ->assertInertia(fn (Assert $page) => $page->has('sessions', 2));
});
```

- [ ] **Step 6: Rewrite the controller's `index`**

```php
$validated = $request->validate([
    'kind' => ['sometimes', 'nullable', Rule::in(ListTeamSessions::Kinds)],
    'before' => ['sometimes', 'nullable', 'string', 'max:80'],
    'q' => ['sometimes', 'nullable', 'string', 'max:255'],
]);

$kind = $validated['kind'] ?? null;
$search = $request->string('q')->trim()->toString();
$search = $search === '' ? null : $search;
$page = $listTeamSessions->timeline($team, $request->user(), $kind, SessionCursor::parse($validated['before'] ?? null), search: $search);

return Inertia::render('teams/sessions', [
    'workspace' => $workspace->only(['id', 'name', 'slug']),
    'team' => $team->only(['id', 'name']),
    'kind' => $kind,
    'q' => $search,
    'live' => $page['live'],
    'sessions' => Inertia::merge($page['sessions'])->matchOn('id'),
    'counts' => $page['counts'],
    'total' => $page['total'],
    'nextCursor' => $page['nextCursor'],
    'hasSprints' => $team->sprints()->exists(),
    ...$presentNewSessionOptions->handle($request->user(), $workspace, $team),
]);
```

Drop the `SessionState` import. The page file `resources/js/pages/teams/sessions.tsx` still reads `tab` until Task 8; `npm run types:check` is not a gate of this task.

- [ ] **Step 7: Run and gate**

Run: `bin/test-db pgsql -- tests/Feature/Sessions tests/Feature/Teams/RecentTeamSessionsTest.php tests/Arch`, then pint and `composer types:check`.
Expected: green.

- [ ] **Step 8: Commit** — `feat(sessions): one list with live sessions apart, counts by kind and the sprint of each row`

### Task 3: Members for every member; Rituals as a settings section

**Files:**
- Modify: `app/Http/Controllers/TeamMembersController.php` (`index`)
- Modify: `app/Http/Controllers/TeamRitualsController.php` (add `show`)
- Modify: `app/Actions/Teams/TeamSettingsSections.php`
- Modify: `routes/web.php` (beside `teams.rituals.update`)
- Test: `tests/Feature/Teams/TeamPagesAccessTest.php`, `tests/Feature/Teams/TeamSettingsPagesTest.php`

**Interfaces:**
- Produces: route `GET w/{workspace}/teams/{team}/rituals` named `teams.rituals.show`, page `teams/rituals`, gate `manageRituals`, props: everything `teams/members` sends today **except** `members`, `canInvite`, `inviteRoles`, `inviteLink`, `pendingInvitations`, `canManageMembers`, `roleOptions`, **plus** `healthStatements` and `canManageHealthStatements` (as `TeamsController@show` builds them today).
- `teams.members.index`: gate `view`; page `teams/members`; props `workspace`, `team`, `members` (with `lastActiveAt`, `isViewer`), `canInvite`, `inviteRoles`, `inviteLink` (optional), `pendingInvitations`, `canManageMembers`, `roleOptions`. No `sections`, no sprint, ritual or template prop.
- `TeamSettingsSections::handle()` returns `array{general: bool, rituals: bool, integrations: bool, data: bool, firstUrl: ?string}`; `firstUrl` leads to `teams.rituals.show` where it led to `teams.members.index`.

- [ ] **Step 1: Write the failing tests.** In `TeamPagesAccessTest.php`, change the dataset rows and add one; add the two routes to the signed-out and the foreign-team datasets:

```php
'Members' => ['teams.members.index', ['manager', 'owner', 'facilitator', 'member', 'observer']],
'Rituals' => ['teams.rituals.show', ['manager', 'owner', 'facilitator']],
```

and, in the same file:

```php
it('shows a plain member the people of the team and nothing about invitations', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    $this->actingAs($member)
        ->get(route('teams.members.index', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('teams/members')
            ->has('members', 1)
            ->where('members.0.isViewer', true)
            ->where('canInvite', false)
            ->where('canManageMembers', false)
            ->where('pendingInvitations', [])
            ->where('roleOptions', [])
            ->missing('sprints')
            ->missing('sections'));
});

it('sends the rituals page the sprints, the facilitators, the templates and the health statements', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamFacilitator($team))
        ->get(route('teams.rituals.show', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('teams/rituals')
            ->has('sprints')
            ->has('rituals')
            ->has('healthStatements')
            ->where('sections.rituals', true)
            ->missing('members')
            ->missing('pendingInvitations'));
});
```

Read `TeamSettingsPagesTest.php`: every assertion on `sections.members` or on ritual props under `teams.members.index` moves to `sections.rituals` and `teams.rituals.show`.

- [ ] **Step 2: Run, see them fail** — `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamPagesAccessTest.php tests/Feature/Teams/TeamSettingsPagesTest.php`. Expected: "Route [teams.rituals.show] not defined".

- [ ] **Step 3: Build.**
  - Route: `Route::get('teams/{team}/rituals', [TeamRitualsController::class, 'show'])->name('teams.rituals.show');`
  - `TeamRitualsController@show`: move the body of `TeamMembersController@index` there, keep `Gate::authorize('manageRituals', $team)`, render `teams/rituals`, drop the people and invitation props, add the two health props with `PresentTeamHealthStatements` as `TeamsController@show` does.
  - `TeamMembersController@index`: `Gate::authorize('view', $team)`; keep only the props listed above; `roleOptions` is `TeamRole::options()` when `canManageMembers`, `[]` otherwise.
  - `TeamSettingsSections`: rename the key and the variable, route `teams.rituals.show`.
  - Create `resources/js/pages/teams/rituals.tsx` as a copy of today's `pages/teams/members.tsx` so that `FrontEndPagesTest` passes; Task 11 gives both pages their final content. Fix every TypeScript read of `sections.members`.

- [ ] **Step 4: Run and gate** — `bin/test-db pgsql -- tests/Feature/Teams tests/Feature/SharedPropsTest.php tests/Arch`, pint, `composer types:check`, `npm run types:check`, `npm run build`.

- [ ] **Step 5: Commit** — `feat(team): members page for every member, rituals as a settings section`

### Task 4: Insights — the Mood & ROTI tab and the three pages that become tabs

**Files:**
- Create: `app/Http/Controllers/TeamInsightsController.php` (`vendor/bin/sail artisan make:controller TeamInsightsController --no-interaction`)
- Modify: `routes/web.php`, `app/Http/Controllers/TeamHealthChecksController.php`, `app/Http/Controllers/TeamGameRoomsController.php`
- Create: `resources/js/pages/teams/insights.tsx` (a stub that renders the trend; Task 10 finishes it)
- Test: `tests/Feature/Teams/TeamInsightsPageTest.php` (`vendor/bin/sail artisan make:test --pest Teams/TeamInsightsPageTest --no-interaction`), `tests/Feature/Teams/TeamPagesAccessTest.php`

**Interfaces:**
- Produces: route `GET w/{workspace}/teams/{team}/insights` named `teams.insights.show`, gate `view`, page `teams/insights`, props `workspace`, `team` (`id`, `name`), `moodTrend` (deferred, group `trend`, `rescue: true`, from `BuildTeamMoodTrend`), `retros` (the completed retros that have a ROTI, newest first: `id`, `title`, `url`, `roti` rounded to one decimal, `closedOn`).
- `teams.healthCheck.show` no longer sends the statements (they are on `teams.rituals.show` since Task 3) and gains `canEditStatements` (`manageRituals`) and `ritualsUrl`.
- `teams.games.index` no longer sends the rooms list; it keeps the leaderboard and the period.

- [ ] **Step 1: Write the failing tests**

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the ROTI of each completed retro, newest first', function () {
    $team = Team::factory()->create();
    $old = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Old']);
    RotiVote::factory()->for($old)->create(['score' => 3]);
    $this->travel(1)->days();
    $new = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'New']);
    RotiVote::factory()->for($new)->create(['score' => 4]);
    RotiVote::factory()->for($new)->create(['score' => 5]);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'No vote']);

    $this->actingAs(teamMember($team))
        ->get(route('teams.insights.show', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/insights')
            ->has('retros', 2)
            ->where('retros.0.title', 'New')
            ->where('retros.0.roti', 4.5)
            ->where('retros.1.title', 'Old')
            ->missing('moodTrend'));
});

it('loads the mood trend after the page', function () {
    $team = Team::factory()->create();

    $page = $this->actingAs(teamMember($team))
        ->get(route('teams.insights.show', [$team->workspace, $team]))
        ->viewData('page');

    expect($page['deferredProps']['trend'])->toBe(['moodTrend']);
});
```

Add `'Insights' => ['teams.insights.show', ['manager', 'owner', 'facilitator', 'member', 'observer']]` to the access dataset of `TeamPagesAccessTest.php`, and the route to its two other datasets. In `tests/Feature/Teams/TeamHealthCheckPageTest.php` and `tests/Feature/Games/GamePagesTest.php`, move the assertions on the props that leave (statements; rooms) to where they now live (Task 3's rituals test; the Sessions list already covers rooms) and list each moved assertion in the report.

- [ ] **Step 2: Run, see them fail** — `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamInsightsPageTest.php`. Expected: "Route [teams.insights.show] not defined".

- [ ] **Step 3: Build the controller**

```php
public function show(Request $request, Workspace $workspace, Team $team, BuildTeamMoodTrend $buildTeamMoodTrend): Response
{
    Gate::authorize('view', $team);

    return Inertia::render('teams/insights', [
        'workspace' => $workspace->only(['id', 'name', 'slug']),
        'team' => $team->only(['id', 'name']),
        'moodTrend' => Inertia::defer(fn (): array => $buildTeamMoodTrend->handle($team), 'trend', rescue: true),
        'retros' => $team->retros()
            ->where('phase', RetroPhase::Completed->value)
            ->whereHas('rotiVotes')
            ->withAvg('rotiVotes', 'score')
            ->latest('updated_at')
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn (Retro $retro): array => [
                'id' => $retro->id,
                'title' => $retro->title,
                'url' => route('retros.show', $retro),
                'roti' => round((float) $retro->getAttribute('roti_votes_avg_score'), 1),
                'closedOn' => $retro->updated_at->toDateString(),
            ])
            ->all(),
    ]);
}
```

`ponytail: the 50 newest retros with a vote; page it if a team outgrows that.` Route, beside `teams.healthCheck.show`: `Route::get('teams/{team}/insights', [TeamInsightsController::class, 'show'])->name('teams.insights.show');`. Then the two controllers' props as said under Interfaces. The stub page renders `DeferredTrend` with `TeamRotiCard` inside `AppLayout active="mood"` (the key changes in Task 6).

- [ ] **Step 4: Run and gate** — `bin/test-db pgsql -- tests/Feature/Teams tests/Feature/Games tests/Arch`, pint, `composer types:check`, `npm run types:check`, `npm run build`.

- [ ] **Step 5: Commit** — `feat(insights): a mood and ROTI page; health check and games pages keep only their insight`

### Task 5: Home's data

**Files:**
- Modify: `app/Http/Controllers/TeamsController.php` (`show` and the private methods it stops using)
- Modify: `app/Actions/Teams/ListRecentTeamSessions.php`
- Test: `tests/Feature/Teams/TeamPageDataTest.php`, `tests/Feature/Teams/RecentTeamSessionsTest.php`

**Interfaces:**
- `ListRecentTeamSessions::handle(Team $team, User $viewer): array{live: list<RecentTeamSession>, recent: list<RecentTeamSession>}` — `live`: every live row, newest first; `recent`: the five newest rows that are not live. A row's shape does not change.
- `teams.show` sends: `workspace`, `team`, `members` (`id`, `name`, `avatarUrl` only: the header's stack), `liveNow` (the `live` rows), `recentSessions` (the `recent` rows), `hasSessions`, `openActionItems`, `openActionItemCount`, `overdueActionItemCount`, `moodTrend` (deferred), `latestHealthScore` (deferred, same group `trend`), `activity`, `schedule`, `hasSprints`, `viewerRole`, `viewerIsObserver`, and the new-session options.
- It stops sending: `retros`, `pokerGames`, `pokerPresence`, `whiteboards`, `whiteboardTemplates`, `healthStatements`, `canManageHealthStatements`, `canInvite`, `inviteRoles`, `inviteLink`, `pendingInvitations`, `availableMembers`, `canManage`, `roleOptions`, `canManageIntegrations`, `canManageRituals`.
- `latestHealthScore: float|null` — the newest point of `BuildHealthTrend` that has a score, or null. Read `BuildTeamMoodTrend` and `BuildHealthTrend` and take the value from their result; do not write a second query for it.

- [ ] **Step 1: Write the failing tests** (in `TeamPageDataTest.php`; rewrite, do not delete, the tests that read a prop that leaves, and list them in the report)

```php
it('sends Home the live sessions apart from the five latest others, and says when a team has none', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    $this->actingAs($member)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('hasSessions', false)
            ->where('liveSessions', ['count' => 0])
            ->where('recentSessions', []));

    Retro::factory()->for($team)->started()->create(['title' => 'Live retro']);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->count(6)->create();

    $this->actingAs($member)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('hasSessions', true)
            ->has('liveNow', 1)
            ->where('liveNow.0.title', 'Live retro')
            ->has('recentSessions', 5)
            ->where('recentSessions.0.state', 'finished'));
});

it('no longer sends Home the lists that moved to other pages', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->missing('retros')
            ->missing('pokerGames')
            ->missing('whiteboards')
            ->missing('healthStatements')
            ->missing('pendingInvitations')
            ->missing('members.0.email'));
});
```

The shared prop of Task 1 is already called `liveSessions`: the page's own list of live rows is therefore named **`liveNow`**. Use that name everywhere in Tasks 5 and 9.

- [ ] **Step 2: Run, see them fail** — `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamPageDataTest.php`.

- [ ] **Step 3: Build.** `ListRecentTeamSessions::handle` keeps reading each state of each kind; split the merged rows on `state === 'live'`, sort each part by `[updatedAt, id]` descending, slice `recent` to `Limit`. `hasSessions` is `$recent['live'] !== [] || $recent['recent'] !== []` (an empty read of every state of every kind means the team has none). In `show`, delete the props listed, their injected parameters and the private methods left without a caller (`pokerPresence` among them); leave `PresentTeamRetro`, `PresentPokerGameSummary` and `PresentWhiteboardSummary` in place when another class still uses them (grep before deleting anything).

- [ ] **Step 4: Run and gate** — `bin/test-db pgsql -- tests/Feature/Teams tests/Feature/Invitations tests/Arch`, pint, `composer types:check`. `npm run types:check` fails on `team-page.tsx` until Task 9: note it in the report, do not patch the page here.

- [ ] **Step 5: Commit** — `refactor(team): the team page reads only what Home shows`

---

## Step B — front

Each front task: Vitest written first and seen red (`npm run test -- <file>`), then the component, then the gates (`npm run types:check`, `npm run check`, `npm run build`). New `t('…')` keys go into the four language files in the same commit.

### Task 6: The sidebar, its model, the command palette

**Files:**
- Modify: `resources/js/components/skrum/app-sidebar.tsx`, `resources/js/hooks/use-sidebar-model.ts`, `resources/js/components/workspaces/command-menu.tsx`
- Delete: `resources/js/components/teams/use-team-anchor.ts` (its test is listed for the owner, not deleted)
- Modify: every page that passes `active="mood"`, `"games"` or reads `#mood`, `#members`, `#sessions` (grep)
- Test: `app-sidebar.test.tsx`, `command-menu.test.tsx`, a new `use-sidebar-model.test.ts`

**Interfaces:**
- `NavKey = 'dashboard' | 'sessions' | 'actions' | 'insights' | 'members' | 'settings' | 'templates' | 'teams' | 'admin'`.
- `AppSidebarProps` gains `liveSessions?: number` and `newSessionHref?: NavHref`; loses nothing else.
- `useSidebarModel`: `links.insights = TeamInsightsController.show(team)`, `links.members = TeamMembersController.index(team)`, `links.actions = WorkspaceActionItemsController.index(slug, { query: { team: currentTeam.id } })` when a team is current (unfiltered otherwise), `liveSessions = props.liveSessions?.count ?? 0`, `newSessionHref = TeamsController.show(team, { query: { new: 'session' } })` when the viewer may create a kind.

**Build:**
- Entries, in order (spec §9.1): the group without label Home, Sessions, Actions, Insights (`TrendingUp`); group "Team": Members, Settings (`Settings`, label `t('Settings')`); group "Workspace": Templates, All teams. Administration stays in the footer, above the user card. Without a team: only the Workspace group, with Actions first, as today.
- "New session": a `SidebarMenuButton` under the switcher, `Plus` icon, outline look, a link to `newSessionHref`; tooltip when collapsed. Whether the viewer may create a kind is not a shared prop today: read `PresentNewSessionOptions` and share the smallest thing that answers it (`currentTeam.canCreateSession: bool`, computed from the same policy calls) in `HandleInertiaRequests::currentTeam`, with one assertion added to `SharedPropsTest`.
- `useNewSessionIntent` (in `components/teams/session-create/`): accept `new=session` as "open the dialog on the kind picker"; `new=retro|poker|whiteboard|survey` keep working.
- Live: on the Sessions entry, a `SidebarMenuBadge` with a dot and the count when `liveSessions > 0`, `aria-label` "Sessions, :count live"; collapsed, the dot alone, as `data-slot="overdue-dot"` does for Actions (`data-slot="live-dot"`).
- Command palette: `gotoItems` follows the new keys; "Mood & ROTI" and "Games" leave, "Insights" joins, "Dashboard" reads "Home".

**Vitest (names):** "lists Home, Sessions, Actions, Insights, then Members and Settings under Team, then Templates and All teams"; "shows a dot and the count on Sessions when a session is live, and nothing when none is"; "shows New session only with a link"; "links Actions to the current team"; "has no entry that leads to an anchor" (no `href` holds `#`); "opens the dialog on `new=session` and on `new=retro`"; "offers Insights and neither Mood & ROTI nor Games in the palette".

**Commit** — `feat(nav): a sidebar where every entry is a page`

### Task 7: The topbar shows a title

**Files:**
- Modify: `resources/js/layouts/skrum/app-layout.tsx`, `resources/js/components/skrum/app-topbar.tsx`, every caller of `AppLayout` that passes `breadcrumbs` (grep `breadcrumbs=`)
- Test: `app-layout.test.tsx`, a new `app-topbar.test.tsx`

**Interfaces:**
- `AppLayout` and `AppTopbar` take `title: string` in place of `breadcrumbs`. `components/breadcrumbs.tsx` stays (the session title's crumbs and the admin may use it: grep; delete nothing).

**Build:** the title is a `<p>` in `text-sm font-medium text-muted-foreground truncate` (the page keeps its own `<h1>`: decision 15.1). Titles by page (spec §9.8): Home — the team's name; Sessions; Actions; Insights (every tab); Members; Settings (every section); Templates; the workspace page — the workspace's name; the other pages — the last crumb they passed.

**Vitest (names):** "shows the title and no breadcrumb navigation" (no `nav[aria-label="Breadcrumb"]` in the topbar); "keeps the search place and the actions".

**Commit** — `refactor(nav): the topbar shows the page title`

### Task 8: The Sessions page

**Files:**
- Modify: `resources/js/pages/teams/sessions.tsx`, `resources/js/components/teams/sessions-page.tsx`, `resources/js/components/skrum/session-row.tsx`, `resources/js/lib/teams/sessions.ts`
- Test: `sessions-page.test.tsx`, `session-row.test.tsx`, `lib/teams/sessions.test.ts`

**Interfaces:**
- Consumes Task 2's props and row.
- `lib/teams/sessions.ts` exports: `type TeamSession` (Task 2's row), `SessionKinds` (the five), `sessionsHref(team, { kind?, q? })`, `sessionMeta(row, t)`, `sessionOutcome(row, t): string | null`, `sessionStatus(row, t): string`, `groupSessions(rows, hasSprints, locale, t): { key: string; label: string; rows: TeamSession[] }[]`. `SessionTabs` and `SessionTab` leave.
- `SessionRow` gains optional props `outcome?: string`, `date?: string`, `status?: string`, `action?: ReactNode` (the "Join" button, outside the link's text but inside the card), `menu?: ReactNode`. Without them it renders as today.

**Build (spec §9.3):**
- Chips: a `<nav aria-label="Kinds">` of Inertia `Link`s, "All" then the five kinds in the order of `SessionTypePicker`, each with its count, `aria-current="page"` on the active one. A chip keeps `q`.
- "Live now": rendered when `live` holds a row. Rows carry `action` = a "Join" `Button asChild` linking to the session.
- The list: `live` ids are removed from `sessions` before grouping (Review Focus 2). `groupSessions`: with `hasSprints`, key = the sprint's number, label "Sprint :number · :from → :to" (short dates in the locale), null sprint → "Outside a sprint"; without, key = `YYYY-MM` of `updatedAt`, label the month and year in the locale. Groups keep the order of the rows.
- A row: meta as today; outcome — retro "ROTI :roti · :count actions" (parts absent when null), poker ":count pts", survey ":count answers", icebreaker ":count players"; date in the locale; status "Not started" for `upcoming`, "Draft" when `isDraft`, "Live", otherwise "Ended" ("Completed" for a retro, as the team page said).
- Row menu "…" (a `DropdownMenu`, shown when `canDelete || canDuplicate`): "Delete" with the `ConfirmDialog` and the texts the team page used ("Delete this board?", "Delete this survey?"); "Duplicate" for a survey. Take the requests from `team-whiteboards-section.tsx` and `team-surveys-section.tsx` as they are; after success `router.reload({ only: ['live', 'sessions', 'counts', 'total', 'nextCursor'] })`.
- Under the chips, for one kind: Poker — "Estimation history" (`teams.estimates.index`), "Saved decks" (`teams.pokerDecks.index`); Whiteboard — "Whiteboard templates" (the dialog the team page opened: move `WhiteboardTemplatesDialog` and the props it needs — `teams.sessions.index` then sends `whiteboardTemplates` with the query `TeamsController@show` used, in a `Inertia::optional` prop loaded when the dialog opens; add the assertion to `TeamSessionsTest`); Icebreaker — "Leaderboard" (`teams.games.index`).
- "Load more" as today, with `data: { kind, before, q }`.
- Empty states: no session at all (`counts.all === 0` and no search) — `EmptyState` "No session yet" with "New session"; a chip with nothing — "No :kind yet"; a search with nothing — "No session matches".

**Vitest (names):** "lists live sessions under Live now with Join, and the rest below"; "shows a session once when it is live and still among the loaded rows"; "groups by sprint, with Outside a sprint for a row without one"; "groups by month for a team without sprints"; "shows each chip with its count and marks the active one"; "keeps the search when a chip is chosen"; "shows Not started and Draft as badges"; "shows the outcome of each kind"; "offers Delete on a board the viewer may delete, and no menu otherwise"; "shows the links of the chosen kind only"; "asks for the next page with the kind and the search"; the three empty states.

**Commit** — `feat(sessions): one list by sprint with chips by kind`

### Task 9: Home

**Files:**
- Modify: `resources/js/pages/teams/show.tsx`, `resources/js/components/teams/team-page.tsx`, `team-header.tsx`, `live-session-banner.tsx`, `team-recent-sessions.tsx`
- Create: `resources/js/components/teams/team-pulse-card.tsx`
- Remove from the page (files stay until Task 17's unused-code check): `TeamRetrosSection`, `TeamPokerSection`, `TeamWhiteboardsSection`, `TeamSurveysSection`, `TeamHealthCard`, `TeamMembersCard`, `TeamInviteDialog`
- Test: `team-page.test.tsx`, `team-header.test.tsx`, `live-session-banner.test.tsx`, `team-recent-sessions.test.tsx`, new `team-pulse-card.test.tsx`

**Interfaces:** consumes Task 5's props (`liveNow`, `recentSessions`, `hasSessions`, `latestHealthScore`, `moodTrend`).

**Build (spec §9.2):**
- Header: mark, name, `AvatarStack` of `members` as a link to Members with `aria-label` ":count members", the schedule line, "New session". The three buttons leave.
- `LiveSessionBanner` takes `sessions: RecentSessionRow[]`: the first with "Join", "+:count more" linking to Sessions when there are several; nothing when empty. The "Dismiss" button and the flash prop leave. Grep `liveSession` in `resources/js` and `app/`: when the team page was the only reader, remove `FlashesLiveSession`'s use in the four controllers that redirect to the team page and list the trait for the owner (do not delete the trait's tests).
- Grid, two columns from `lg`: Needs attention (`TeamOpenActionsCard`, five rows, "See all" to Actions on the team) and Team pulse; Recent sessions (`TeamRecentSessions` with `recentSessions`, "All sessions") and `TeamActivityCard`. One column below `lg`, in the order banner, Needs attention, Recent sessions, Team pulse, Activity (`order-*` classes).
- `TeamPulseCard`: the latest average ROTI and its change from `moodTrend` (through `lib/teams/mood-adapter`), a sparkline (reuse the chart of `TeamRotiCard` in a compact variant if it has one; otherwise the number alone — no new chart code), the line "Health check: :score / 5" or "Health check: not run yet", a link "Insights". `DeferredTrend` gives the skeleton.
- `hasSessions === false`: `TeamCreateTiles` in place of the banner, and no Recent sessions card.

**Vitest (names):** "shows the live banner with Join when a session is live, and none otherwise"; "says how many more are live"; "shows the four cards and no per-kind section"; "shows the kind tiles and no recent sessions for a team without session"; "links the members stack to Members"; "shows the health score, or that no health check ran"; "puts Needs attention before Recent sessions on a phone" (DOM order of the `order-*` targets).

**Commit** — `feat(team): Home answers what now`

### Task 10: Insights

**Files:**
- Create: `resources/js/components/teams/insights-tabs.tsx`
- Modify: `resources/js/pages/teams/insights.tsx`, `pages/teams/health-check.tsx`, `components/teams/team-health-check-page.tsx`, `pages/poker/estimates.tsx`, `components/poker/estimation-history.tsx`, `pages/games/index.tsx`, `components/games/team-games.tsx`
- Test: new `insights-tabs.test.tsx`, `team-health-check-page.test.tsx`, `estimation-history.test.tsx`, `team-games.test.tsx`

**Interfaces:** `InsightsTabs({ workspace, team, active }: { workspace: { slug: string }; team: { id: string }; active: 'mood' | 'health' | 'estimates' | 'games' })` renders the heading "Insights" and a `<nav aria-label="Insights">` of four Inertia links (`aria-current="page"` on the active one), in the tabs' look of `ui/tabs`.

**Build (spec §9.4):** each of the four pages renders `AppLayout active="insights" title={t('Insights')}`, then `InsightsTabs`, then its content. Mood & ROTI: `TeamRotiCard` at full width, then the list of `retros` (title as a link, date, "ROTI :roti"), empty state "No retro has a ROTI yet". Health check: `TeamHealthManager` leaves the page (it is on Rituals in Task 11); a link "Edit the statements" to `ritualsUrl` when `canEditStatements`. Estimates and Games: their "Back to the team" leaves; Games keeps the leaderboard and its period only.

**Vitest (names):** "shows four tabs and marks the active one"; "lists the ROTI of each retro, or says none has one"; "offers Edit the statements only to who may"; "shows no Back to the team" (estimates, games); "shows the leaderboard and no rooms list".

**Commit** — `feat(insights): four tabs over the pages that existed`

### Task 11: Members and Settings

**Files:**
- Modify: `resources/js/pages/teams/members.tsx`, `pages/teams/rituals.tsx`, `components/team-settings/team-settings-shell.tsx`
- Test: `pages/teams/members.test.tsx` (rewritten to the people page), new `pages/teams/rituals.test.tsx`, the shell's test

**Build (spec §9.5, §9.6):**
- Members: `AppLayout active="members" title={t('Members')}`, outside the settings shell: heading "Members · :count", "Invitation link" and "Invite" when `canInvite`, `MembersTable` (row actions only when `canManageMembers`), the pending invitations when `canInvite`, the note on roles, `TeamInviteDialog`.
- Rituals: inside `TeamSettingsShell active="rituals"`: `SprintsCard`, `DefaultFacilitatorsCard`, `RetroTemplatesCard`, `DefaultColumnsCard`, then `TeamHealthManager` with `healthStatements`.
- Shell: the entry "Rituals" (`CalendarClock` icon is taken by Sessions: use `Repeat`) to `TeamRitualsController.show`; section key `rituals`; `title={t('Settings')}`.

**Vitest (names):** "shows a member the people and the note on roles, and no invite control"; "shows a facilitator Invite and the pending invitations"; "shows a manager the row actions"; "shows the sprints, the facilitators, the templates and the health statements on Rituals"; "lists General, Rituals, Integrations, Data & export by right".

**Commit** — `feat(team): a members page for everyone; rituals in the settings`

### Task 12: Actions on the team

**Files:**
- Modify: `resources/js/pages/action-items/index.tsx` and the header component it renders (read it first)
- Test: the page's or the header's test file

**Build (spec §9.10):** when a current team exists, a two-option switch in the header, "<team name>" and "All teams", as two Inertia links that set or drop `team` and keep the other filters. On the team: the "Team" filter and the "Team" option of "Group by" are not rendered. `active="actions"` in both scopes.

**Vitest (names):** "offers the team and All teams, and marks the scope in use"; "hides the Team filter and grouping on the team"; "keeps the other filters when the scope changes"; "shows no switch without a current team".

**Commit** — `feat(action-items): open on the current team, switch to all teams`

### Task 13: No sidebar in a session; the leave dialog

**Files:**
- Create: `resources/js/components/session/leave-session-dialog.tsx`
- Modify: `resources/js/components/skrum/frames.tsx` (`SessionFrame`), `resources/js/layouts/skrum/session-layout.tsx`, `resources/js/components/session/session-title.tsx`, `components/retro/board-topbar.tsx`, `components/poker/room-topbar.tsx`, `components/games/room-header.tsx`, and the page-body "Back to the team" of `retro/board-ended.tsx`, `retro/session-end.tsx`, `poker/saved-decks-page.tsx`
- Test: new `leave-session-dialog.test.tsx`, `session-title.test.tsx`, `session-shell.test.tsx`, `board-topbar.test.tsx`, `room-topbar.test.tsx`, the tests of the bodies that lose a button

**Interfaces:**
- `SessionFrame` loses its `sidebar` prop and always renders the bare frame; `SessionLayout` stops calling `useSidebarModel`.
- `SessionTitle` gains `onBack?: () => void`: when given, the arrow is a `<button>` that calls it; otherwise the link of today.
- `LeaveSessionDialog({ open, onOpenChange, title, peopleCount, backHref, onEnd, endNote }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; peopleCount: number; backHref: string; onEnd: () => Promise<void>; endNote?: string })`.

**Build (spec §9.7):**
- The dialog (`ui/dialog`): title "Leave :title?", the lines of the spec (the count line absent when `peopleCount <= 1`), `endNote` when given, three buttons: "Stay" (closes), "Leave, keep running" (`router.visit(backHref)`), "End it" (`variant="destructive"`; `await onEnd()` then `router.visit(backHref)`; while pending the three buttons are disabled; on rejection the dialog stays open and shows "Something went wrong. Please try again." in an `Alert`).
- Who gets it: each topbar passes `onBack` only when its room says the viewer is the facilitator **and** the session is live. Retro (`board-topbar.tsx`): `onEnd` = the request the facilitator's dock makes to close the retro (`PUT retros.phase.update` with `phase: 'completed'`; reuse the function, do not write a second one), `endNote` "The remaining phases are skipped." when the phase is not the last before `completed`. Poker (`room-topbar.tsx`): the end-game function of `use-round-actions.ts` (`PUT poker.status.update`, `ended: true`). Icebreaker (`room-header.tsx`): the close-round function the room already has, only while a round is in play. Survey and whiteboard: no `onBack`.
- Read each of the three controllers' guards (`RetroGuard::facilitator`, `PokerGuard::facilitator`, the round-close guard) and match the front condition to it; write in the report what each condition is (spec §16.1).
- Remove the body buttons listed under Files where the topbar arrow is on screen. Check `surveys/survey-room.tsx`: if its screen has the topbar arrow, remove its body button too; if not, keep it and say so in the report. `room-gone.tsx` and `board-gone.tsx` keep theirs.

**Vitest (names):** "renders no sidebar and no sidebar trigger in a session"; "leaves at once for a member"; "asks a facilitator of a live session, and Stay keeps them in"; "Leave, keep running goes to the team without ending"; "End it ends, then goes to the team"; "stays open and says so when ending fails, and goes nowhere"; "disables the buttons while ending"; "does not ask on an ended session"; "does not ask on a whiteboard or a survey"; "says the remaining phases are skipped on a retro that is not at its last phase".

**Commit** — `feat(session): no sidebar in a session; a facilitator is asked before leaving a live one`

### Task 14: The phone's tab bar

**Files:**
- Modify: `resources/js/components/skrum/mobile-tab-bar.tsx`, `components/skrum/frames.tsx` (`TabBar`)
- Test: `mobile-tab-bar.test.tsx`

**Interfaces:** `MobileTabBar` gains `newSessionHref?: NavHref` and `liveSessions?: number`.

**Build (spec §9.8):** Home, Sessions, the centre button, Actions, More. The centre button is a round primary link to `newSessionHref` with `aria-label` "New session", absent when the prop is; the bar then holds four items. Sessions shows a dot when `liveSessions > 0` (`aria-label` "Sessions, :count live"). The "Mood" tab leaves.

**Vitest (names):** "shows Home, Sessions, New session, Actions and More"; "shows four items to someone who may create nothing"; "marks Sessions when a session is live".

**Commit** — `feat(nav): create from the phone's tab bar`

---

## Final

### Task 15: Translations

Read every key added since `15bb4fec` in `lang/en.json`, `fr.json`, `es.json`, `de.json`: informal register, the elision rules of `tests/Feature/FrenchElisionTest.php`, no key left in English in another file. Remove the keys no file reads any more only if `tests/Feature/TranslationKeysTest.php` requires it. Run `bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php tests/Feature/FrenchElisionTest.php`. Commit — `chore(lang): review the navigation texts`.

### Task 16: Browser walkthroughs

`npm run build`, then `bin/test-browser`. For each red test: when it follows a path this plan moved (spec §9.9), rewrite its steps to the new path and keep its assertions; when its subject is gone (a status tab, an anchor, the sidebar in a session, a breadcrumb), list it for the owner with one line saying why, and mark it `->skip('navigation redesign: awaiting the owner')` — never delete it. Expect about 23 files (the list is in spec §13). Add one walkthrough, `tests/Browser/Walkthroughs/NavigationTest.php`, with five tests: the sidebar's eight entries each open their page; the Sessions page filters by chip and joins a live session; Home's banner joins; a facilitator leaves a live retro through each of the three buttons; a member opens Members and sees no Invite. Run `bin/test-browser` until green apart from the skipped ones. Commit — `test(browser): follow the new navigation`.

### Task 17: Captures, unused code, documents

- Captures (spec criterion 22) with the project's capture tooling (read `tests/Browser/Visual` and `tests/visual`): the sidebar, Home (live, quiet, empty), Sessions (all, one chip), Insights (four tabs), Members, Settings › Rituals, the leave dialog; 1440 and a phone width; light and dark; English and French. The overflow check passes.
- `node bin/front-unused.mjs`: every component this plan left without a caller is listed in the report with its test file; delete a component only when its test file is deleted with the owner's approval — so in this task, delete none and list all.
- One line at the top of `docs/design-system/components/Sidebar/README.md`, `ScreenDashboard/README.md`, `ScreenTeam/README.md`, `MobileDashboard/README.md`: "Navigation superseded on 2026-10-05 by `docs/superpowers/specs/2026-10-05-navigation-redesign-design.md`."
- In the spec: status "built", a section "As built" with every difference found while building and the answers to §16.
- Commit — `docs: captures and as-built notes of the navigation redesign`.

### Task 18: Full suites and report

Run, in order: `vendor/bin/pint --format agent`, `vendor/bin/sail composer types:check`, `npm run types:check`, `npm run check`, `npm run test`, `bin/test-db pgsql`, `bin/test-browser`. Write the report to the owner: what was built per spec criterion (1 to 23, each with the test or capture that proves it), the tests rewritten, the tests skipped or left without a subject (awaiting approval), the components without a caller, N-1 and N-2 of **Owner decisions**, and anything a task reported. No merge, no push.

---

## Added on 2026-10-06 — the owner's answers and the loose ends of the task reviews

These three run after Task 14 and before Task 15.

### Task 19: A facilitator ends a retro from any phase through the leave dialog

Spec §17.1 and §9.7. Closes the finding left open on the leave dialog (ledger, "Task 13: open").

**Files:**
- Modify: `app/Models/Retro.php` (`canMoveTo`), `app/Actions/Retros/BuildBoardSnapshot.php` (or the class that builds the board snapshot: find where `phase` is put into it)
- Modify: `resources/js/components/retro/board-topbar.tsx`, `resources/js/components/session/leave-session-dialog.tsx` (only if `endNote` is not there yet)
- Test: `tests/Unit` or `tests/Feature` file that holds "moves only to neighbours among the enabled phases" (`RetroModelTest`), `tests/Feature/Retros/ActionsPhaseTest.php`, the feature test of `retros.phase.update`, `board-topbar.test.tsx`, `leave-session-dialog.test.tsx`

**Interfaces:**
- `Retro::canMoveTo(RetroPhase $phase): bool` also returns true for `RetroPhase::Completed` from every phase that is not `Completed`. Nothing else of the rule changes.
- The board snapshot carries `startedAt: string | null` (ISO 8601) when it does not already carry what tells a started retro from one nobody began.
- The topbar passes `onBack` when the viewer is the facilitator, the phase is not `completed`, and the retro has begun (`startedAt` set, or the board holds at least one card) — the Live rule of `ListTeamSessions::retros`.

- [ ] **Step 1: Write the failing tests.** Feature, beside the existing phase tests:

```php
it('lets the facilitator complete a retro from any open phase, and skips no other phase', function (RetroPhase $from) {
    $retro = Retro::factory()->inPhase($from)->started()->create();
    [$facilitator] = retroFacilitator($retro);

    $this->actingAs($facilitator)
        ->putJson(route('retros.phase.update', $retro), ['phase' => RetroPhase::Completed->value])
        ->assertOk();

    expect($retro->refresh()->phase)->toBe(RetroPhase::Completed);
})->with([RetroPhase::Writing, RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing, RetroPhase::Actions, RetroPhase::Roti]);

it('still refuses to jump over a phase that is not the end', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->started()->create();
    [$facilitator] = retroFacilitator($retro);

    $this->actingAs($facilitator)
        ->putJson(route('retros.phase.update', $retro), ['phase' => RetroPhase::Voting->value])
        ->assertUnprocessable();
});

it('refuses a member who tries to end the retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->started()->create();
    [$member] = retroMember($retro);

    $this->actingAs($member)
        ->putJson(route('retros.phase.update', $retro), ['phase' => RetroPhase::Completed->value])
        ->assertForbidden();
});
```

Read `retroFacilitator` and `retroMember` in `tests/Pest.php` and the existing phase tests for how a request is authenticated as a participant (a cookie may be needed), which phases a default retro has enabled, and the status a refusal gives; correct the three tests to what the code really does before running them. Then rewrite, not delete, the tests that state the old rule — `ActionsPhaseTest` "skips no phase between discussing and completed" and the model test "moves only to neighbours among the enabled phases" — so that they state the new one (neighbours, plus `completed` from any open phase), and list both in the report. Vitest: rewrite `board-topbar.test.tsx` "does not ask before the last phase…" into "asks the facilitator in every phase of a live retro" and add "says the remaining phases are skipped on a retro that is not at its last phase", "does not say so at the last phase", "does not ask on a retro nobody began".

- [ ] **Step 2: Run them, see them fail** — the feature tests with 422 for the early phases.

- [ ] **Step 3: Build.** One condition in `canMoveTo`. Check what `ChangeRetroPhase` does on arriving at `completed` (recap, summary, activity, broadcast): it must run the same from any phase; if a step assumes ROTI was played (an average over no vote, a recap line), make it hold with no vote and pin it with an assertion. The snapshot's `startedAt`. The topbar's condition; `endNote` = `t('The remaining phases are skipped.')` when the next phase is not `completed`, with the key in four languages.

- [ ] **Step 4: Run and gate** — `bin/test-db pgsql -- tests/Feature/Retros tests/Unit tests/Arch`, `npm run test -- board-topbar leave-session-dialog`, pint, `composer types:check`, the front gates.

- [ ] **Step 5: Commit** — `feat(retro): the facilitator can end a retro from any phase when leaving`

### Task 20: An icebreaker room is live for 15 minutes after its last activity

Spec §17.2.

**Files:**
- Modify: `app/Actions/Sessions/ListTeamSessions.php` (`rooms`)
- Test: `tests/Feature/Sessions/ListTeamSessionsTest.php`, `tests/Feature/SharedPropsTest.php`

**Interfaces:** `rooms($team, SessionState::Live)` = a current round **and** activity within `LiveWithinMinutes`; `Finished` = at least one round and not live; `Upcoming` unchanged (no round ever). The three states still partition the rooms: every room is in exactly one.

- [ ] **Step 1: Decide what "activity" reads, from the code.** A whiteboard uses its own `updated_at`. For a room, find what is written when a round starts, an answer or a vote comes in and a round is closed or revealed (`app/Actions/Games`). Use the room's `updated_at` when those writes touch it. When they do not, compare the newest of the room's `updated_at` and its current round's `updated_at` in the query (`whereHas('currentRound', …)` with an `orWhere` on the room), with no raw SQL. Do not add a column and do not add `touch()` calls to game actions unless neither timestamp moves on a vote; if so, say it in the report and touch the round's room from the one action that records an answer.

- [ ] **Step 2: Write the failing tests** (the file travels to the start of the minute and has `playedRoom`; `activeGameRound($room)` gives a room a current round):

```php
it('counts a room as live only while something happened in it during the last 15 minutes', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    $room = GameRoom::factory()->for($team)->create(['name' => 'quiz']);
    activeGameRound($room);

    expect(titlesIn(sessionsOf($team, $viewer, SessionState::Live)))->toBe(['quiz'])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Finished)))->toBe([]);

    $this->travel(ListTeamSessions::LiveWithinMinutes + 1)->minutes();

    expect(titlesIn(sessionsOf($team, $viewer, SessionState::Live)))->toBe([])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Finished)))->toBe(['quiz'])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Upcoming)))->toBe([]);
});

it('puts every room in exactly one state', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    GameRoom::factory()->for($team)->create(['name' => 'never played']);
    playedRoom($team, 'played, no round in play');
    activeGameRound(GameRoom::factory()->for($team)->create(['name' => 'quiet for an hour']));
    $this->travel(1)->hours();
    activeGameRound(GameRoom::factory()->for($team)->create(['name' => 'in play']));

    $all = [
        ...titlesIn(sessionsOf($team, $viewer, SessionState::Upcoming)),
        ...titlesIn(sessionsOf($team, $viewer, SessionState::Live)),
        ...titlesIn(sessionsOf($team, $viewer, SessionState::Finished)),
    ];

    expect($all)->toEqualCanonicalizing(['never played', 'played, no round in play', 'quiet for an hour', 'in play'])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Live)))->toBe(['in play']);
});
```

and, in `SharedPropsTest.php`, one test: a room with a round in play counts in `liveSessions.count`; an hour later it does not. Existing tests that expect a room with a current round to be live whatever its age are corrected to the new rule and listed.

- [ ] **Step 3: Build** the three branches of `rooms()`; keep the `match`.

- [ ] **Step 4: Run and gate** — `bin/test-db pgsql -- tests/Feature/Sessions tests/Feature/Teams tests/Feature/Games tests/Feature/SharedPropsTest.php tests/Arch`, pint, `composer types:check`.

- [ ] **Step 5: Commit** — `fix(sessions): an icebreaker room stops being live after 15 quiet minutes`

### Task 21: Loose ends of the task reviews

The reviews of Tasks 6 to 14 deferred minor findings (`.superpowers/sdd/2026-10-05-navigation-redesign/deferred-minors.md`). This task fixes the ones below, each with its test, in one commit. It fixes no other: the rest is listed for the owner in Task 17.

1. **"New session" opens in place on Home and on Sessions** (spec §9.1, criterion 4). Today the sidebar's button and the phone's centre button always lead to Home with `?new=session`. On Home and on the Sessions page (both carry the dialog and read the intent — check `useNewSessionIntent` on `pages/teams/sessions.tsx`; add it there if absent) the link leads to the page the viewer is on, with `new=session`, keeping the page's other query; elsewhere, to Home. Vitest in `use-sidebar-model.test.ts`: "opens New session on the Sessions page itself", "on Home itself", "on Home from any other page".
2. **The "invitation declined" notification** links to `teams.members.index`, not to `teams.show#members` (`app/Actions/Notifications/PresentInvitationDeclinedNotifications.php`; correct the assertion of `tests/Feature/Invitations/InvitationDeclineTest.php`).
3. **Two crumbs still lead to an anchor of the team page**: `components/whiteboard/board-header.tsx` (`#sessions`) and `components/surveys/survey-builder.tsx` (`#surveys`). They lead to the Sessions page on their kind (`sessionsHref(team, { kind: 'whiteboard' })`, `{ kind: 'survey' }`). Correct their tests.
4. **The estimation history page** is an Insights tab: check `pages/poker/estimates.tsx` passes `active="insights"` and `title={t('Insights')}`; correct it if a later task did not.
5. **Home's first card reads "Needs attention"** (spec §9.2): `TeamOpenActionsCard` takes an optional `title`, Home passes `t('Needs attention')`; the card keeps "Open action items" elsewhere. Vitest: one assertion in `team-page.test.tsx`.
6. **A signed-in member keeps the user menu inside a session.** The sidebar held it; the session's topbar shows the avatar only. The avatar of the session topbar opens the existing user menu (`UserMenuContent`, as `NavUser` uses it) for a signed-in user; a guest's avatar stays as it is. Vitest in `session-shell.test.tsx`: "opens the user menu from the avatar for a member", "shows a guest no menu".
7. **"Load more" says the right count**: in `sessions-page.tsx`, `remaining` subtracts the rows dropped because they went live. Vitest beside "shows a session once when it is live and still among the loaded rows".
8. **Two leftovers**: the decision identifier "(D-57)" in a docblock of `sessions-page.tsx` goes; `lang/fr.json` "No retro has a ROTI yet" takes the typographic apostrophe its neighbours use.

Gates: `npm run test`, `npm run types:check`, `npm run check`, `npm run build`, `bin/test-db pgsql -- tests/Feature/Invitations tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php tests/Feature/FrenchElisionTest.php tests/Arch`, pint, `composer types:check`.

Commit — `fix(nav): loose ends of the navigation redesign`

---

## Order of execution from 2026-10-06 (owner: "speed up implementations")

Tasks 22 to 27 run **before** Tasks 17 and 18, so that the captures, the full suites, the whole browser folder and the whole-branch review run once, over everything. One writer takes two task sections at a time where they touch the same files: 22 with 23, then 24, then 27, 28 (both in the New session dialog) 29 (the sign-in screens' brand panel) 31 (the Members dialog), 32 (the Templates page) and 34 (the whiteboard form), in the lane, then 25 with 26, then 30 (the settings split) with 33 (the Activity page's person filter), then 35 (the Sessions rows' alignment) with 36 (the room's settings dialog) and 37 (the retro card composer), then 38 (a page's side panel at the window's edge) with 39 (the retro board's scrollbar), then 40 (the session's top bar) with 41 (the leave dialog) 42 (branding applied on save) 43 (avatars in every list of people) and 45 (check for a version now), then 44 (the emoji picker), then 46 (the whiteboard's top bar and facilitator controls); then 17, then 18, then the whole-branch review.

What changes in the task texts below:
- The paragraphs "Closing duties" and "Closing" of Tasks 23, 24, 26 and 27 are void. Each of these tasks runs only the tests it wrote or touched, its gates (pint, `composer types:check`, `npm run types:check`, `npm run check`, `npm run build`), and its own browser test file when it adds one. No capture, no full suite, no run of the whole browser folder.
- "After Task 18 and the whole-branch review", "Runs after Task 23" and "After Task 26" give the order among Tasks 22 to 27 only.
- Task 17 also captures the retro board's card composer, open and near its limit (§31), the icebreaker room's settings dialog (§30), the Sessions list after §29, the whiteboard form of the dialog (§28), the retro form of the dialog with a template chosen (spec §23), the Activity page, Insights › eNPS (with data and empty), Home's Team pulse with its three figures, and the New session dialog's poker form; its "As built" covers spec §17 to §42.1; it also captures the sign-in screen on an instance named Skrum the three settings pages of §25 (in place of Settings › Rituals) the Members page with its dialog open (§26), and the Templates page with the menu open and with the retro editor's dialog open (§27).
- Task 18's report covers the spec's criteria 1 to 89.

## Added on 2026-10-06 — the team's activity (spec §18)

These two run after Task 18 and the whole-branch review, on the same branch. Each carries its own closing duties (translations, a browser test, a capture, the suites), since the Final step has already run.

### Task 22: The team's activity, paged and filtered — back end

**Files:**
- Modify: `app/Actions/Teams/ListTeamActivity.php`, `app/Http/Controllers/TeamsController.php` (`show`: five lines), `routes/web.php`
- Create: `app/Http/Controllers/TeamActivitiesController.php` (`vendor/bin/sail artisan make:controller TeamActivitiesController --no-interaction`), `resources/js/pages/teams/activity.tsx` (a stub that lists the lines; Task 23 finishes it)
- Test: `tests/Feature/Teams/TeamActivityTest.php` (exists: read it first), `tests/Feature/Teams/TeamPagesAccessTest.php`, `tests/Feature/Teams/TeamPageDataTest.php`

**Interfaces:**
- `ListTeamActivity::HomeLimit = 5`, `ListTeamActivity::PageSize = 30`; `handle(Team $team, int $limit = self::HomeLimit): array` (Home; the old `Limit` constant goes, its readers follow).
- `ListTeamActivity::Groups`: `['sessions' => [RetroStarted, RetroCompleted, PokerStarted, PokerEnded, WhiteboardCreated, SurveyPublished, SurveyClosed], 'actions' => [ActionItemCompleted], 'members' => [MemberJoined]]`. A test asserts every case of `TeamActivityKind` is in exactly one group, so a kind added later cannot be forgotten.
- `ListTeamActivity::page(Team $team, ?string $group = null, ?string $actorId = null, ?CarbonImmutable $day = null, ?string $before = null, int $limit = self::PageSize): array{lines: list<ActivityLine>, total: int, nextCursor: ?string}`. A line keeps its fields and gains `day` (`YYYY-MM-DD` in the application's time zone) and `at` (ISO 8601, UTC) when it does not carry them already.
- Route `GET w/{workspace}/teams/{team}/activity` named `teams.activity.index`, gate `view`, page `teams/activity`, props: `workspace`, `team` (`id`, `name`), `lines` (`Inertia::merge(...)->matchOn('id')`), `total`, `nextCursor`, `filters` (`group`, `actor`, `day`, each null when absent), `members` (`id`, `name`, `avatarUrl`, sorted with `Alphabetical`), `today` (`YYYY-MM-DD`, application's time zone).
- Validation: `group` in the three keys; `actor` a uuid that is a member of the team (otherwise an error on `actor`); `day` `date_format:Y-m-d`; `before` a string of at most 80.

**Build notes:**
- Order `created_at` descending then `id` descending; the cursor is the pair, compared as `ListTeamSessions::after()` compares (`<` on the time, or the same time and a smaller id). Read `App\Support\Sessions\SessionCursor`: reuse it if it can carry a `created_at` (give it a named constructor rather than a second class); a second cursor class only if that is impossible, and say why.
- The day is two bounds: `created_at >=` the start of that day and `<` the start of the next, both built in the application's time zone and converted as the stored column expects (read how `ListTeamSessions::after()` moves its bound to the stored zone). No `whereDate`, no date function (`docs/database.md`).
- The actor column: read `TeamActivity` for the name of the user column; a line written by a guest has none and never matches an `actor`.
- `total` is the count under the filters, without the cursor.

- [ ] **Step 1: Write the failing tests.** In `TeamActivityTest.php`, with the factory and helpers that file already uses to record activity (read it; do not invent a factory state):
  - "sends Home the five newest lines" (`teams.show`, `has('activity', 5)`), in `TeamPageDataTest.php`.
  - "pages 65 events by 30 with no duplicate and no gap, even when events share a second" — create 65 lines, several with the same `created_at`; walk `before` twice; 30, 30, 5; 65 distinct ids; `total` 65; the last `nextCursor` null.
  - "keeps the kinds of a group" — one line of each of the nine kinds; `group=sessions` gives seven, `actions` one, `members` one.
  - "puts every kind of activity in exactly one group" (the constant against `TeamActivityKind::cases()`).
  - "keeps the lines of one member, and drops a guest's".
  - "keeps the lines of one day of the application's time zone" — set `config(['app.timezone' => 'Europe/Paris'])` as the existing sprint tests do (read one), write a line at 23:59:30 and one at 00:00:30 local time, ask for each day.
  - "combines the filters and keeps them through the next page".
  - "refuses an unknown group, an actor who is not in the team and a malformed day" (three `assertSessionHasErrors`), "refuses a user who cannot view the team" (403).
  - `'Activity' => ['teams.activity.index', ['manager', 'owner', 'facilitator', 'member', 'observer']]` in the access dataset of `TeamPagesAccessTest.php`, and the route in its two other datasets.
- [ ] **Step 2: Run them, see them fail** — "Route [teams.activity.index] not defined".
- [ ] **Step 3: Build** the action's `page()`, the controller, the route (beside `teams.insights.show`), the stub page (`AppLayout active="settings"` until Task 23 adds the key).
- [ ] **Step 4: Run and gate** — `bin/test-db pgsql -- tests/Feature/Teams tests/Arch`, then the same paths on a second engine (`bin/test-db mariadb -- tests/Feature/Teams/TeamActivityTest.php`, the day bounds are the risk), pint, `composer types:check`, `npm run types:check`, `npm run build`.
- [ ] **Step 5: Commit** — `feat(team): the whole activity of a team, paged and filtered`

### Task 23: The Activity page, the sidebar entry, "Recent activity" on Home

**Files:**
- Modify: `resources/js/pages/teams/activity.tsx`, `resources/js/components/teams/team-activity-card.tsx`, `resources/js/components/skrum/app-sidebar.tsx`, `resources/js/hooks/use-sidebar-model.ts`, `resources/js/components/workspaces/command-menu.tsx`
- Create: `resources/js/components/teams/activity-page.tsx`, `resources/js/lib/teams/activity-days.ts`
- Test: `activity-page.test.tsx`, `lib/teams/activity-days.test.ts`, `team-activity-card.test.tsx`, `app-sidebar.test.tsx`, `use-sidebar-model.test.ts`, `command-menu.test.tsx`; one browser test in `tests/Browser/Walkthroughs/NavigationTest.php`

**Interfaces:**
- `NavKey` gains `'activity'`; `links.activity = TeamActivitiesController.index(team)` when a team is current.
- `groupByDay(lines, today, locale, t): { day: string; label: string; lines: ActivityLine[] }[]` — "Today", "Yesterday", otherwise the date in the locale (with the year when it is not this year's).
- `TeamActivityCard` gains `allHref?: string`; its title is `t('Recent activity')`.

**Build (spec §18):**
- The line: move the row of `TeamActivityCard` into a shared `ActivityLineRow` used by the card and the page; the page shows the time of day (`Intl.DateTimeFormat(locale, { hour, minute })` on `at`) where the card shows "12 hours ago".
- Chips as on the Sessions page (links, `aria-current`); the person select with `ui/select` ("Anyone" first); the day with the app's `DatePicker` (`components/skrum/date-picker.tsx`: read its props; it has a clear control or gains none — a "Any day" reset link beside it is enough). Every filter change is an Inertia visit to `teams.activity.index` with the three filters, no `before`.
- "Load more" with `LoadMoreFeed`, `router.reload({ only: ['lines', 'nextCursor'], data: { ...filters, before } })`, as the Sessions page does.
- Empty states of §18.3; "Clear filters" is a link to the page without query.
- Sidebar: the entry between Members and Settings, `History` icon; palette entry "Activity". `AppLayout active="activity" title={t('Activity')}`.
- Home: `TeamActivityCard` with `allHref`.
- New keys in the four language files, informal: "Recent activity", "All activity", "Activity" (exists: keep its value), "Everything that happened in :team", "Anyone", "Any day", "No activity matches.", "Clear filters", "Today", "Yesterday", ":count events" and its singular — check each for an existing key first.

**Vitest (names):** "titles the card Recent activity and links to all the activity"; "groups the lines under Today, Yesterday and a date"; "shows the time of day beside each line"; "marks the active chip and keeps the other filters in its link"; "asks for a member's lines"; "asks for one day, and for any day again"; "asks for the next page with the filters"; "says nothing has happened, or that nothing matches with a way to clear"; "lists Activity between Members and Settings"; "offers Activity in the palette".

**Browser:** one test added to `NavigationTest.php`: a member opens Activity from the sidebar, filters on Actions, then on a day, and sees only the matching lines.

**Closing duties of this task** (the Final step ran before it): one capture of the page at 1440 and at a phone width, light, English and French, with the tooling Task 17 used; one line in the spec's "As built" for anything built differently from §18; then `npm run test`, `npm run types:check`, `npm run check`, `npm run build`, `bin/test-db pgsql`, and the browser files that name the sidebar's entries (`NavigationTest.php` and any walkthrough that counts or lists them).

**Commit** — `feat(team): an activity page, and recent activity on Home`

---

### Task 24: ROTI values take the colour of their score; Team pulse shows figures of the same weight

Spec §19 and §21. Runs after Task 23.

**Team pulse (spec §21), in this task for ROTI and the health check; Task 26 adds the eNPS figure in the third place:**
- Back end: `TeamsController@show` sends `latestHealth: array{score: float, change: ?float}|null` in place of `latestHealthScore` (same deferred group `trend`; `change` against the previous health check that has a score, from the same `BuildHealthTrend` read, rounded to one decimal). Feature test in `TeamPageDataTest.php`: rewrite the `latestHealthScore` test to the new prop and add the change (two health checks, then one).
- Front: `TeamPulseCard` renders its figures through one small `PulseFigure({ label, href, value, unit, change, changeLabel, empty })` (in the card's file): label, value in the large type, the change chip the card already draws for ROTI, or the muted `empty` text in the value's place. Check `components/skrum/stat-card.tsx` first: use it instead when it already draws this. Three columns from the width where they fit, stacked below, no overflow at 20rem; each figure a link (`TeamInsightsController.show`, `TeamHealthChecksController.show`; the third place is left for Task 26 and is not rendered empty meanwhile).
- Vitest in `team-pulse-card.test.tsx`: "shows the health check as a figure with its change, like ROTI"; "says Not run yet in the place of a figure without data"; "links each figure to its Insights tab".

**Files:**
- Create: `resources/js/components/skrum/roti-value.tsx`, `roti-value.test.tsx`
- Modify: `resources/js/components/teams/insights-tabs.tsx` (or the file that renders the list "Average ROTI per retro": grep `ROTI :roti`), `resources/js/components/teams/sessions-page.tsx` and `resources/js/lib/teams/sessions.ts` (the retro's outcome), `resources/js/components/teams/team-recent-sessions.tsx`, `resources/js/components/teams/team-pulse-card.tsx`

**Interfaces:** `RotiValue({ value, className }: { value: number; className?: string })` renders the value with one decimal in the colour of `Math.round(value)` clamped to 1–5; `rotiStep(value: number): 1 | 2 | 3 | 4 | 5` exported beside it.

**Build:** the five colours exist: `components/skrum/roti-widget.tsx` draws the scale (the numbered marks 1 to 5 of the ROTI screen). Take its text-colour tokens for the five steps — move the map to where both can import it rather than copying it; no new token, no hex. Where the outcome of a Sessions row is one string today ("ROTI 4.0 · 0 actions"), `sessionOutcome` keeps returning the text for the accessible name and the row renders the ROTI part through `RotiValue`; do not parse the string back. Presentational only: no router, no network.

**Vitest (names):** "rounds an average to its step: 3.5 is 4, 3.4 is 3"; "clamps below 1 and above 5"; "renders the value with one decimal in the class of its step"; one assertion in each of the four places that the retro's ROTI is rendered by `RotiValue` (`data-slot="roti-value"`, `data-step`).

**Closing:** `npm run test`, `npm run types:check`, `npm run check`, `npm run build`; the captures of Sessions, Home and Insights › Mood & ROTI retaken with Task 17's tooling (light and dark).

**Commit** — `style(roti): a ROTI value takes the colour of its score`

---

## Added on 2026-10-06 — eNPS (spec §20)

After Task 24. Each task carries its own closing duties.

### Task 25: The eNPS template and the team's eNPS — back end

**Files:**
- Modify: `app/Enums/TeamSurveyTemplate.php`, `app/Support/Surveys/SurveyTemplateCatalogue.php`, `routes/web.php`
- Create: `app/Actions/TeamSurveys/BuildTeamEnps.php` (`make:class`), `app/Http/Controllers/TeamEnpsController.php` (`make:controller`), `resources/js/pages/teams/enps.tsx` (a stub; Task 26 finishes it)
- Test: the feature tests that cover `SurveyTemplateCatalogue` and survey creation from a template (grep `team_pulse` under `tests/Feature`), a new `tests/Feature/Teams/TeamEnpsPageTest.php`, `tests/Feature/Teams/TeamPagesAccessTest.php`

**Interfaces:**
- `TeamSurveyTemplate::Enps = 'enps'`; `hasLockedQuestions()` stays true for the health check only.
- `SurveyTemplateCatalogue::questions(Enps, $team)` returns the three `QuestionDefinition`s of spec §20.1 (`kind`, `label` through `__()`, `matchKey`, `isRequired`; the two NPS questions with `allowsComment: false`, the reason being question 3); `options()` gains the entry after Team pulse (`name` "eNPS", the description of §20.1, `questionCount` 3).
- `BuildTeamEnps::TeamQuestion = 'enps_team'`, `BuildTeamEnps::HistoryLimit = 24`; `handle(Team $team): array{latest: ?EnpsPoint, history: list<EnpsPoint>}` with `EnpsPoint = array{id: string, title: string, url: string, closedOn: string, answers: int, score: int, change: ?int, promoters: int, passives: int, detractors: int}`. `latest` is `history[0]` or null; `change` is the score minus the score of the next older point, null for the oldest.
- Route `GET w/{workspace}/teams/{team}/enps` named `teams.enps.show`, page `teams/enps`, props `workspace`, `team` (`id`, `name`), `enps` (the action's result), `canStart` (`createSurvey` on the team), `startUrl` (Home with `new=survey&template=enps`).

**Build notes:**
- The surveys: `team_id`, `template = enps`, `retro_id` null, `status` closed, `closed_at` not null, `whereHas('questions', kind nps, match key enps_team, with at least one answer)`; `closed_at` descending then `id` descending; limit `HistoryLimit`. Read `BuildHealthTrend::closedHealthChecks` for the names of the columns and relations; do not copy its retro branch.
- The score: call `SummarizeSurveyQuestion` (its NPS branch returns `nps`, `detractors`, `passives`, `promoters`) on the team question of each survey. No second formula. Load the questions and answers of the 24 surveys in a fixed number of queries, not per survey.
- The gate: read `surveys.results.show`'s controller and policy. The tab uses the same ability for a closed standalone survey of the team (when that is `view` on the team, use `view`); if the results page hides figures under a number of answers, apply the same floor per point and say so in the report. Write in the report which rule you found.
- `url` is the survey's results page.
- Home (spec §20.4): `TeamsController@show` sends `latestEnps: array{score: int, change: ?int}|null`, deferred in the group `trend` beside `latestHealthScore`, from `BuildTeamEnps` (its `latest`), null when no survey counts or when the viewer may not read the figures. Tests in `TeamPageDataTest.php`: "sends Home the latest team eNPS with the trend" (deferred group, null, then a score and its change) and "sends no eNPS figure to who may not read survey results" when the gate you found is narrower than `view`.

- [ ] **Step 1: Write the failing tests.** Read first how the existing tests create a closed survey with NPS answers (factories `TeamSurvey`, its question and answer factories, helpers in `tests/Pest.php`); write one local helper `closedEnps(Team $team, array $teamScores, ?CarbonInterface $closedAt = null): TeamSurvey` that creates the survey from the catalogue's three questions and one respondent per score. Then:
  - "offers eNPS among the survey templates, with three questions" (the dialog's options prop).
  - "creates a survey from the eNPS template with its three questions, editable" (kinds, match keys, required flags, order; `hasLockedQuestions` false).
  - "scores the team question: promoters minus detractors" — scores `[10, 10, 9, 9, 9, 8, 7, 3, 0]` give 33, promoters 5, passives 2, detractors 2, answers 9.
  - "says how the score moved since the survey before" — an older survey at 20, the newer at 33: `change` 13 on the newer, null on the older; order newest first.
  - "leaves out a draft, an open survey, another template, a survey attached to a retro, another team's, and an eNPS survey without its team question" — six surveys, `history` empty.
  - "does not count an answer to the company question as a team score".
  - "keeps the 24 newest".
  - "tells who may start an eNPS survey" (`canStart` for a member, false for an observer — read `ObserverSessionCreationTest` for the rule).
  - `'eNPS' => ['teams.enps.show', [...]]` in the access dataset with the roles the gate you found allows, and the route in the two other datasets.
- [ ] **Step 2: Run them, see them fail.**
- [ ] **Step 3: Build** the enum case (every `match` on the enum must stay exhaustive: PHPStan lists them), the catalogue, the action, the controller, the route beside `teams.insights.show`, the stub page.
- [ ] **Step 4: Run and gate** — `bin/test-db pgsql -- tests/Feature/Teams tests/Feature/TeamSurveys tests/Feature/Sessions tests/Arch`, the new test file on `mariadb` too, pint, `composer types:check`, `npm run types:check`, `npm run build`. New `__()` keys in the four language files.
- [ ] **Step 5: Commit** — `feat(surveys): an eNPS template, and the team's eNPS over its closed surveys`

### Task 26: Insights › eNPS, and the template in the dialog

**Files:**
- Modify: `resources/js/pages/teams/enps.tsx`, `resources/js/components/teams/insights-tabs.tsx`, `resources/js/components/teams/session-create/use-new-session-intent.ts`, `resources/js/components/teams/session-create/survey-session-fields.tsx`, `resources/js/lib/surveys/types.ts`, every map from a template key to a label (grep `team_pulse` in `resources/js`)
- Create: `resources/js/components/teams/team-enps-page.tsx`
- Test: `team-enps-page.test.tsx`, `insights-tabs.test.tsx`, the tests of the two session-create files; one browser test in `tests/Browser/Walkthroughs/NavigationTest.php`

**Interfaces:** `InsightsTabs`' `active` gains `'enps'`; order Mood & ROTI, Health check, eNPS, Estimates, Games. The template key union becomes `'health_check' | 'team_pulse' | 'enps' | null`.

**Build (spec §20.2):**
- The split bar exists: `components/skrum/survey-question.tsx` draws promoters, passives and detractors for an NPS question. Export that part (or move it to its own file) and use it for the latest card and, small, on each history line. No new bar.
- The score with its sign ("+32", "0", "−10" with a true minus), the change with the arrow the Team pulse card uses, "since the last one"; the title, the date in the locale, ":count answers".
- History: a list, each line a link to `url`.
- "Start an eNPS survey": a link to `startUrl`, shown when `canStart`.
- Home (spec §20.4 as redrawn by §21): `TeamPulseCard` gains its third `PulseFigure`, "eNPS", with the signed score, its change ("since the last one"), a link to `teams.enps.show`, or "Not run yet"; it reads `latestEnps` inside the same `DeferredTrend`. Vitest in `team-pulse-card.test.tsx`: "shows the latest eNPS with its sign and change, linked to the tab", "says eNPS has not run yet".
- Empty state with `EmptyState`.
- The dialog: `SurveyTemplates` gains `'enps'`; the picker's line for it is ":count questions"; "eNPS" is not translated; the other new keys in the four languages, informal.
- `AppLayout active="insights" title={t('Insights')}`.

**Vitest (names):** "shows eNPS third of five tabs"; "shows the latest score with its sign, its change and the three counts"; "shows no change for a first survey"; "lists the history, each line to its results"; "offers Start an eNPS survey only to who may"; "says no eNPS survey has closed yet"; "opens the dialog on the eNPS template from the intent"; "offers eNPS in the template picker with its three questions".

**Browser:** one test: a facilitator starts an eNPS survey from the Insights tab, two members answer, the facilitator closes it, the tab shows the score.

**Closing duties:** one capture of the tab (with data and empty) at 1440 and a phone width, light and dark, English and French; one line in the spec's "As built" for anything built differently from §20; then `npm run test`, `npm run types:check`, `npm run check`, `npm run build`, `bin/test-db pgsql`, the browser files touched.

**Commit** — `feat(insights): the team's eNPS, and eNPS in the survey templates`

---

### Task 27: The deck picker — two columns, and the chosen deck's cards in a section

Spec §22. After Task 26. Layout and copy only.

**Files:**
- Modify: `resources/js/components/skrum/deck-picker.tsx` (and `resources/js/components/teams/session-create/poker-session-fields.tsx` if the cards' row is drawn there: read both first)
- Test: `deck-picker.test.tsx`

**Build:**
- Grep every use of `DeckPicker` first (the dialog, the room's settings, the saved decks page, the team's default deck). The grid becomes two columns by a container query on the picker (`@container`, two columns from the width where two tiles read in full, one below); no prop per caller unless a caller truly needs another layout, and then say why.
- The preview: wrap the cards of the chosen deck in a `section` with `aria-label` and a visible overline `t('Cards of :deck', { deck })` followed by the count, in a bordered panel with the tint the design system uses for an inset (`bg-muted/…` or the token the dialog's other insets use: read a sibling), cards wrapping. Reuse the card chip already drawn; do not restyle it.
- New keys in the four language files, informal.

**Vitest (names):** "shows the cards of the chosen deck in a section named after it, with their count"; "changes the section with the selection"; "keeps the tiles' order and selection by keyboard" (the existing test, still green).

**Closing:** `npm run test -- deck-picker`, `npm run types:check`, `npm run check`, `npm run build`; the dialog's poker capture retaken at 1440 and at a phone width, light and dark; the visual baselines of the screens that show the picker updated in the same commit.

**Commit** — `style(poker): decks in two columns, the chosen deck's cards in a section`

---

### Task 28: The retro form's Columns block explains the template; the picker's preview leaves the dialog

Spec §23. With Task 27 (same dialog, same writer).

**Files:**
- Modify: `resources/js/components/skrum/retro-template-picker.tsx` (the panel with `aria-label` "Template preview"), `resources/js/components/teams/session-create/retro-columns-editor.tsx`, `resources/js/components/teams/session-create/retro-session-fields.tsx` (or the file that renders both: read it first), `resources/js/components/retro/columns-board.tsx` only if the editor draws its columns through it
- Test: `retro-template-picker.test.tsx`, the columns editor's test file, the retro form's test file

**Interfaces:**
- `RetroTemplatePicker` gains `preview?: boolean` (default `true`); the dialog passes `false`. The workspace's Templates page and any other caller are untouched (grep the callers).
- The columns editor gains `template?: { name: string; category: string | null } | null` for the line under its heading.

**Build:**
- The editor's columns: a two-column grid by a container query (one column below the width where two read well), each column showing its whole title and whole description, wrapped (`break-words`, no `truncate`, no `line-clamp`), its colour treatment unchanged; remove the grey placeholder bars. Keep the drag handle, the selected ring, the keyboard reordering and the colour row exactly as they are: with dnd-kit, a grid needs the rect sorting strategy in place of the horizontal one — check `@dnd-kit/sortable`'s installed version for its name before importing it.
- The line "<template> · <category>" in muted small text under "Columns · n"; when the columns were edited away from the template it still names where they came from.
- No new translation key is expected (the category labels exist); if one is needed, four languages, informal.

**Vitest (names):** "shows no template preview in the dialog, and still shows it on the Templates page"; "names the template and its category above the columns"; "shows a column's whole title and description"; "lays the columns out as a grid and keeps reordering by keyboard"; the existing colour, add and delete tests still green.

**Run:** `npm run test -- retro-template-picker retro-columns-editor`, `npm run types:check`, `npm run check`, `npm run build`.

**Commit** — `style(retro): the columns explain the chosen template in the New session dialog`

---

### Task 29: The brand panel of the sign-in screens — no badge, floating notes

Spec §24. With Tasks 27 and 28 (same writer, one commit each).

**Files:**
- Modify: `resources/js/components/auth/auth-aside.tsx`, `resources/css/app.css` (one keyframe and its `--animate-…` token, beside `card-in`), `config/app.php` (the fallback name)
- Test: `auth-aside.test.tsx` (create it if absent), the test that covers `isRebranded` (`lib/brand.test.ts`), one feature assertion on the fallback name if a test reads `config('app.name')` without `APP_NAME` (do not fight the test environment to write one: say so if it cannot be pinned)

**Build:**
- Remove the `Badge` and its imports (`Badge`, `GitBranch`). The key "Open source · self-hostable" stays in the language files and is listed as left without a caller.
- Floating: the notes keep their own tilt and offset classes, so the movement goes on a wrapper `div` around each (animating the wrapper's `translate`, a few pixels up and back, 6 to 8 seconds, ease-in-out, infinite), each wrapper with its own duration or delay so they are out of step. One `@keyframes float` and one `--animate-float` in the theme, as the existing ones are declared; the per-note delay through the arbitrary `[animation-delay:…]` utility. `motion-reduce:animate-none` on each wrapper. The two retro cards gain `shadow-raised`, which the action item already has.
- `config/app.php`: `env('APP_NAME', 'Skrum')`. Do not edit `.env`.
- Do not change `BrandAside` or `isRebranded`.

**Vitest (names):** "shows the promise and three notes, and no badge"; "floats each note on its own wrapper and stops with reduced motion" (the wrapper's classes); "stays hidden from assistive technology and inert" (existing behaviour, pinned).

**Run:** `npm run test -- auth-aside brand`, `npm run types:check`, `npm run check`, `npm run build`, `bin/test-db pgsql -- tests/Feature/Auth tests/Arch`, pint, `composer types:check`.

**Commit** — `style(auth): the brand panel without its badge, with floating notes`

---

### Task 30: Settings — Sprints, Retrospectives and Health check as three pages

Spec §25. After Tasks 25 and 26, before Task 17. Back end and front in this one task, two commits.

**Files:**
- Modify: `routes/web.php`, `app/Http/Controllers/TeamSprintsController.php` (add `index`), `app/Http/Controllers/TeamHealthStatementsController.php` (add `index`), `app/Http/Controllers/TeamRitualsController.php` (`show` leaves; `update` stays), `app/Actions/Teams/TeamSettingsSections.php`, `app/Http/Controllers/TeamHealthChecksController.php` (the link it sends)
- Create: `app/Http/Controllers/TeamRetroSettingsController.php` (`show`), `resources/js/pages/teams/sprints.tsx`, `resources/js/pages/teams/retro-settings.tsx`, `resources/js/pages/teams/health-statements.tsx`
- Remove: `resources/js/pages/teams/rituals.tsx` (its test file is not deleted: its tests move to the three pages' test files, listed one by one in the report)
- Modify: `resources/js/components/team-settings/team-settings-shell.tsx`, every link to `TeamRitualsController.show` in `resources/js` (grep), `app/` and `tests/`
- Test: `tests/Feature/Teams/TeamPagesAccessTest.php`, `tests/Feature/Teams/TeamSettingsPagesTest.php`, `tests/Feature/Teams/TeamHealthCheckPageTest.php`, `tests/Feature/SharedPropsTest.php` (`settingsUrl`), the Vitest files of the shell and of the three pages, the browser files that open Rituals (grep `rituals` under `tests/Browser`: correct their path and run those files)

**Interfaces:**
- Routes, all GET under `w/{workspace}/teams/{team}`: `sprints` → `teams.sprints.index` (`TeamSprintsController@index`), `retro-settings` → `teams.retroSettings.show` (`TeamRetroSettingsController@show`), `health-statements` → `teams.healthStatements.index` (`TeamHealthStatementsController@index`). Each `Gate::authorize('manageRituals', $team)`. `teams.rituals.show` is removed; `teams.rituals.update` stays.
- `TeamSettingsSections::handle()` returns `array{general: bool, sprints: bool, retros: bool, health: bool, integrations: bool, data: bool, firstUrl: ?string}`; the three new keys are `manageRituals`; `firstUrl` is the first allowed of general, sprints, retros, health, integrations.
- Props: each page receives `workspace`, `team` (as the rituals page did, for the shell's header), `createdAt`, `sections`, and only what its cards read — split the props `TeamRitualsController@show` sends today between the three (read which card reads which prop; nothing is sent to a page that does not use it). The health page keeps `healthStatements` and `canManageHealthStatements`.
- `teams.healthCheck.show` sends `statementsUrl` (`teams.healthStatements.index`) in place of `ritualsUrl`.

- [ ] **Step 1: Write the failing tests.** In `TeamPagesAccessTest.php` the row `'Rituals'` becomes three rows (`'Sprints' => ['teams.sprints.index', ['manager', 'owner', 'facilitator']]`, and the same for `teams.retroSettings.show` and `teams.healthStatements.index`), and the three routes replace `teams.rituals.show` in the two other datasets. One test per page for its props ("sends the sprints page the sprints and the defaults, and nothing of the retros", and so on, with `missing()` for the other pages' props). `sections` and `firstUrl` for a manager (general), a facilitator (sprints), a member (null). "tells who may edit the statements where they are" on the health check tab (`statementsUrl`). "has no route named teams.rituals.show" (`Route::has`). Vitest: "lists General, Sprints, Retrospectives, Health check, Integrations, Data & export by right"; one test per page that it renders its cards and not the others'.
- [ ] **Step 2: Run them, see them fail.**
- [ ] **Step 3: Build** the routes, the three actions (move the body of `TeamRitualsController@show`, do not rewrite the queries), the sections, the three pages inside `TeamSettingsShell` (`active` = `sprints` | `retros` | `health`), the shell's entries (labels "Sprints", "Retrospectives", "Health check" — check each for an existing key; icons `CalendarRange`, `Layers`, `HeartPulse` or the ones the cards already use), `title={t('Settings')}`. Sprints: `SprintsCard`. Retrospectives: `DefaultFacilitatorsCard`, `RetroTemplatesCard`, `DefaultColumnsCard`. Health check: `TeamHealthManager`. Then every link that led to Rituals (Insights' "Edit the statements", Home's schedule line, anything grep finds).
- [ ] **Step 4: Run and gate** — `bin/test-db pgsql -- tests/Feature/Teams tests/Feature/SharedPropsTest.php tests/Arch`, `npm run test`, the front gates, pint, `composer types:check`, the browser files corrected.
- [ ] **Step 5: Commit** — `refactor(team): rituals split into sprints, retrospectives and health check settings` (back end), then `feat(team): three settings pages in place of rituals` (front).

---

### Task 31: Members — "Add a member" becomes a dialog

Spec §26. Front only; no route, no prop changes. Runs in the lane after Tasks 27 to 29.

**Files:**
- Modify: `resources/js/pages/teams/members.tsx`, `resources/js/components/team-settings/members-table.tsx` (an optional prop to drop its title and count)
- Create: `resources/js/components/teams/add-member-dialog.tsx`
- Test: `pages/teams/members.test.tsx`, a new `add-member-dialog.test.tsx`, `members-table.test.tsx`

**Build:**
- Read task-11-report.md first: it says where the "Add a member" form came from (the old members card) and which of its tests (the server's errors, the roles) still run only through that card. Move the form's fields and its submit into `AddMemberDialog` (`ui/dialog`), and move those tests with it into `add-member-dialog.test.tsx`; the old card's test file is not deleted, it is listed for the owner once nothing in it has a subject.
- `AddMemberDialog({ open, onOpenChange, workspace, team, availableMembers, roleOptions })`: the description line, the member picker (the same combobox), the role select (default "Member"), "Cancel" and "Add". Submit as the form did (`teams.members.store`); on success close and `router.reload({ only: ['members', 'availableMembers'] })` unless the form's own visit already refreshes them (read it); on a validation error stay open and show it under its field.
- The member picker shows the avatar beside the name, with the e-mail in muted text, in the options and in the trigger once chosen. `availableMembers` already carries `avatarUrl` (check; if it does not, `AvailableTeamMembers` gains it with one assertion). Reuse the way selects already show avatars (commit `de293d8b`, "status icons, priority marks and avatars in selects and menus": find the option component it added and use it; no second one). Vitest: "shows each person's avatar in the picker and on the chosen value".
- The header: "Invitation link", "Add a member" (`UserPlus` is taken by Invite: use `Users`-family icon the design system has for a group, outline variant), "Invite". The button renders only with `canManageMembers`; disabled with a tooltip and `aria-describedby` when `availableMembers` is empty.
- `MembersTable` gains `bare?: boolean`: without its card title and count. The Members page passes it; other callers do not.
- New keys in the four language files, informal: "Someone already in :workspace joins this team.", "Pick a member", "Everyone in :workspace is already in this team." — check for existing ones first ("Add a member", "Add", "Cancel", "Role", "Member" exist).

**Vitest (names):** "shows no Add a member card"; "opens the dialog from the header for who manages the members, and shows no button to the others"; "adds the picked member with the chosen role and closes"; "shows the server's error under its field and stays open"; "disables the button and says why when nobody is left to add"; "heads the page with Members once".

**Run:** `npm run test -- members add-member-dialog`, `npm run types:check`, `npm run check`, `npm run build`.

**Commit** — `feat(team): add a member from a dialog on the members page`

---

### Task 32: Templates — a "New template" menu; the retro template editor in a dialog

Spec §27. Front only. In the lane, with Task 31 (one commit each).

**Files:**
- Modify: `resources/js/components/workspaces/templates-page.tsx` (the header button), `resources/js/components/workspaces/template-editor-sheet.tsx` (the sheet becomes a dialog; rename the file and the component to `template-editor-dialog` and correct every import, grep `TemplateEditorSheet`), `resources/js/components/skrum/template-editor.tsx` only where its layout assumes a side panel
- Test: `templates-page.test.tsx`, the sheet's test file (renamed with it, its tests kept and corrected), `template-editor.test.tsx`

**Build:**
- The menu: a `DropdownMenu` on the "New template" button (a chevron after the label), two items with the kinds' icons, "Retro template" and "Poker deck". Each calls what the section's own button calls today ("Create a template", "Create a deck"): find those two handlers and reuse them; the sections' buttons stay.
- The dialog: read the "Create a deck" dialog first (`components/skrum/deck-editor.tsx` and its caller) and build the retro editor's container the same way — `ui/dialog`, the same max width, a header (title "New template" or "Edit the template", the kind and the visibility badge the sheet's header shows), a two-column body (`TemplateEditor`'s form, then its live preview) that becomes one column by a container query, a footer with the hint when there is one, "Cancel" and "Save". The body scrolls, the header and the footer do not.
- `TemplateEditor` has `aside={...}` slots (it renders its preview through one): keep its API; only the container changes. Remove nothing of its fields.
- Focus goes to the first field on open and returns to the opener on close; Esc and the close control ask nothing more than the sheet did (if the sheet warned about unsaved changes, the dialog does too).
- Keys: "Retro template", "Poker deck" — check for existing ones; four languages, informal.

**Vitest (names):** "opens a menu with Retro template and Poker deck from New template"; "opens the retro editor in a dialog from the menu and from the section's button"; "opens the deck dialog from the menu"; "shows the form beside its live preview and Cancel and Save in the footer"; "renders no side panel" (no element with the sheet's `data-slot`); the editor's existing tests still green.

**Run:** `npm run test -- templates-page template-editor`, `npm run types:check`, `npm run check`, `npm run build`.

**Commit** — `style(templates): a New template menu, and the retro template editor in a dialog`

---

### Task 33: The Activity page's person filter — avatars, and everyone who acted

Spec §18.5. After Task 30, same writer, one commit.

**Files:**
- Modify: `app/Http/Controllers/TeamActivitiesController.php` (the `members` prop and the `actor` rule), `resources/js/components/teams/activity-page.tsx`
- Test: `tests/Feature/Teams/TeamActivityTest.php`, `activity-page.test.tsx`

**Build:**
- The prop that feeds the filter (read task-22-23-report.md for its name; `members` in the plan) becomes the team's members plus the distinct users who have a line in the team's activity and are not members, each `id`, `name`, `avatarUrl`, sorted together with `Alphabetical`. One query for the extra ids (the distinct actor column of the team's activity, `whereNotIn` the members), one for those users; no query per person.
- The `actor` rule accepts an id of that list and refuses any other, with the error on `actor` as today.
- The select shows the avatar beside the name in the options and in the trigger, with the option component selects already use for people (commit `de293d8b`; the same one Task 31 uses in the lane — if both add a small shared piece, keep one at the merge).

- Empty states (spec §18.6): both use `EmptyState` (`components/skrum/empty-state.tsx`: read how the Sessions page calls it, with which illustration and overline) in place of the bare line and button. Filtered to nothing: overline "Activity", title "No activity matches these filters", line "Try another kind, person or day.", action "Clear filters" (the link to the page without query). Nothing ever happened: title "Nothing has happened in this team yet." (the existing key), line "Sessions, completed actions and new members show up here.", action "New session" (the sidebar's `newSessionHref`) for who may create one. New keys in four languages, informal. Vitest: "shows the centred empty state with Clear filters when nothing matches", "shows the centred empty state with New session when nothing ever happened".

- A third small item, asked by the owner on 2026-10-06 on the list "Average ROTI per retro" ("a bit space": the coloured value touches the word "ROTI"): wherever `RotiValue` follows the word "ROTI" or another label on the same line (the Insights list, a retro's row on Sessions, Home's Recent sessions), the two are separated by the gap the design system uses between a label and its badge (`gap-1.5`; read a sibling such as the status badge of a session row and use the same). One assertion in `roti-value.test.tsx` or in the list's test that the wrapper carries the gap. Its own commit — `style(roti): space between the label and the value`.

- A fourth small item (spec §21.1): on Home's Team pulse the health check's value is rendered with the same five-step colour as ROTI (`RotiValue` takes any score on five: use it, or give it a neutral name if "Roti" in the name of a health score reads wrong — one component, not two), and the eNPS value takes the detractors' tone below zero, the promoters' tone above, the text colour at zero (the two tones are the ones the split bar of `survey-question.tsx` uses; export them from where they are, no new token). Read task-24-report.md and task-25-26-report.md for `PulseFigure`'s props. Vitest in `team-pulse-card.test.tsx`: "colours the health score by its step", "colours the eNPS by its side, and not at zero". Same commit as the spacing item, subject `style(pulse): the health score and the eNPS in colour, space before a ROTI value`.

- A fifth small item, asked by the owner on 2026-10-06 on Insights › Games ("card full width"): the leaderboard card kept the width it had beside the rooms list; it takes the whole width of the page's content, as the cards of the other Insights tabs do (`components/games/team-games.tsx` and the leaderboard's wrapper: remove the grid column or max width left from the two-column layout). One assertion in `team-games.test.tsx` that the leaderboard is not inside a two-column grid. Its own commit — `style(insights): the games leaderboard takes the full width`.

**Tests:** feature — "lists in the person filter a workspace manager who acted in the team without being a member", "filters to that person's lines", "still refuses an id that is neither a member nor an actor"; Vitest — "shows each person's avatar in the filter and on the chosen value, and none for Anyone".

**Run:** `bin/test-db pgsql -- tests/Feature/Teams/TeamActivityTest.php tests/Arch`, `npm run test -- activity-page`, the front gates, pint, `composer types:check`.

**Commit** — `feat(team): avatars and every actor in the activity's person filter`

---

### Task 34: The whiteboard form's templates — two columns, full text

Spec §28. Front only, layout only. In the lane, after Tasks 31 and 32.

**Files:**
- Modify: the whiteboard form of the New session dialog (`resources/js/components/teams/session-create/`: the file that renders the tiles "Blank", "Brainstorming", …; grep `whiteboardTemplates` there) and the tile component it uses if it is shared (grep its other callers first: the templates dialog of the Sessions page may use the same tile)
- Test: that form's test file

**Build:** the grid becomes two columns by a container query, one below the width where two read well, with the same thresholds and the same technique Task 27 used for the deck tiles (read `deck-picker.tsx` in this worktree and reuse its classes; no new utility). The name and the description wrap in full (`break-words`, no `truncate`, no `line-clamp`); the thumbnail keeps its aspect ratio at the tile's width. If the tile is shared with another screen, the change applies there only if it reads better there too; otherwise scope it to the dialog with the container query and say so.

**Also in this task (spec §28.1), a second commit:** the retro template tiles of the picker (`resources/js/components/skrum/retro-template-picker.tsx`, the tile's name) show the whole name wrapped: remove the truncating class on the name, let the row's tiles stretch to the tallest (the grid already aligns rows; check `items-stretch`), keep the colour bars and the columns count where they are. The picker is shared with the workspace's Templates page: the rule applies there too. Vitest in `retro-template-picker.test.tsx`: "shows a template's whole name on its tile". Commit — `style(retro): template tiles show their whole name`.

**Vitest (names):** "lays the whiteboard templates out as a two-column grid" (the grid's classes); "shows a template's whole name and description" (no truncating class on either); the existing selection and keyboard tests still green.

**Run:** `npm run test -- <the form's test file>`, `npm run types:check`, `npm run check`, `npm run build`.

**Commit** — `style(whiteboard): templates in two columns with their full text in the New session dialog`

---

### Task 35: Sessions rows — the right side in aligned columns

Spec §29. After Tasks 30 and 33, before Task 17. Front only, layout only.

**Files:**
- Modify: `resources/js/components/skrum/session-row.tsx`, and `resources/js/components/teams/sessions-page.tsx` / `team-recent-sessions.tsx` only where they pass the row its right-hand content
- Test: `session-row.test.tsx`, `sessions-page.test.tsx`

**Build:** in `SessionRow`, the right-hand block becomes a grid (or flex with fixed-width cells) of four cells present on every row even when empty: date (`text-right`, tabular numbers, a width that holds the longest date of the four locales, e.g. `w-24`), status (`w-20`), action (`w-24`: the "Join" button or the "…" menu, right-aligned in its cell), chevron. `items-center` on the row so the block is centred on the two text lines. The cells keep their `data-slot`s; an empty cell is `aria-hidden`. Below the width where the block no longer fits beside the text (the breakpoint the row already uses to stack: keep it), the date and the status go under the meta line as today. The row's accessible name does not change. Widths come from the Tailwind scale, no arbitrary pixel value.

**Vitest (names):** "keeps the date, status and action cells on every row, empty when it has none"; "centres the right-hand cells on the row"; the existing row tests (Join, menu, badges, link name) still green.

**Run:** `npm run test -- session-row sessions-page team-recent-sessions`, `npm run types:check`, `npm run check`, `npm run build`; the browser files that read a Sessions row's date or status by position (grep `session-row` under `tests/Browser`): correct and run those that break.

**Commit** — `style(sessions): a row's date, status and action sit in aligned columns`

---

### Task 36: The icebreaker room's settings dialog, laid out as the other session settings

Spec §30. With Task 35 (same writer, one commit each). Front only, layout and copy.

**Files:**
- Modify: the component that renders the dialog titled "Room settings" (grep `Room settings` in `resources/js/components/games`)
- Test: that component's test file

**Build:** `SettingRow` exists (`resources/js/components/teams/session-create/`, used by the poker and retro settings; grep `export function SettingRow`): use it for the three rows — label, help line, control on the right; a rule between rows as those dialogs draw it. The name stays a labelled field above the rows. The switch moves into its row's control place and keeps its accessible name ("Reactions") and description. Footer with a top rule, "Cancel" (outline) then "Save" (primary). Help lines: "Who may enter the room with its link or its code.", "The language the games draw their words from." (new keys, four languages, informal — reuse an existing sentence when one says the same); the reactions line exists. Nothing of the form's state, validation or request changes.

**Also in this task (spec §32), its own commit — `style(games): the guest setting of a room is the same switch as the other sessions`:** in `resources/js/components/teams/session-create/icebreaker-session-fields.tsx` the block "Access / Who can join" with its select becomes the block the other forms draw (read `retro-session-fields.tsx` or the shared piece it uses for "Invitation / Allow guests without an account": reuse that piece, same heading, same label, same help line, same icon); the form's state stays `access: 'team' | 'link'`, the switch reads `access === 'link'` and writes one or the other; the request does not change. In `room-settings-dialog.tsx` the first row of spec §30 is that same switch row in place of the select (so the dialog has the name, then three rows: guests, language, reactions). The keys "Who can join", "Team members only", "Anyone with the link" lose these callers: list them if nothing else reads them. Vitest in both files: "shows Allow guests without an account as a switch, off for a room of the team", "sends link when the switch is on and team when it is off". Feature tests are untouched (nothing changes on the server); run `tests/Feature/Games` once to be sure. Browser: grep `Who can join` and `Team members only` under `tests/Browser`, correct and run the files that used the select.

**And (spec §32.1), its own commit — `fix(ui): the switch's thumb is centred in its track`:** in `resources/js/components/ui/switch.tsx` the track is `h-5 w-9` with `border border-transparent`, so its inner box is 18 by 34 pixels; the thumb is `size-4` (16), centred vertically (1 pixel above and below) but placed with `translate-x-0.5` (2 pixels) when off and `translate-x-4` (16, leaving 2) when on. Make the side gap equal to the vertical one: `translate-x-px` when off and `data-[state=checked]:translate-x-4.25` when on (17 pixels: 34 − 16 − 1; Tailwind 4 takes quarter steps of the spacing scale — check the build emits it, and use the nearest scale step that gives equal gaps if it does not). Keep the border, the sizes, the colours and the transition. Then measure in a browser (the dev bench's switch section, `getBoundingClientRect` of the thumb against the track, off and on) and put the four numbers in the report. `switch.test.tsx`: correct an assertion on the old classes if there is one, and add "places the thumb with the same inset off and on" on the two classes.

**Vitest (names):** "shows each setting as a row with its help and its control"; "keeps the switch named Reactions with its description"; the existing save and validation tests still green.

**Run:** `npm run test -- <the dialog's test file>`, `npm run types:check`, `npm run check`, `npm run build`; the browser file that opens the room's settings (grep its title under `tests/Browser`): run it, correct it if it breaks.

**Commit** — `style(games): the room's settings dialog in rows, like the other session settings`

---

### Task 37: The retro board's card composer — one row of actions, honest hints

Spec §31. With Tasks 35 and 36 (same writer, one commit each). Front only.

**Files:**
- Modify: the component that renders the composer (grep the counter `/280` or the hint keys in `resources/js/components/skrum/retro-card.tsx`, `retro-column.tsx` and `resources/js/components/retro/`), used for adding and for editing a card
- Test: that component's test file

**Build:**
- Footer row: the counter (`tabular-nums`, muted) at the left; at the right "Cancel" (ghost) then the primary button, with the gap the design system uses between two buttons of a footer. Read first what Enter does today (the hint says "publish", the button "Save"): the hint line takes the button's verb for the case at hand, through existing keys where they exist; new keys in four languages, informal ("Enter to save", "Enter to add", "Shift+Enter for a new line", "Esc to cancel" — only those whose behaviour the code really has; if Shift+Enter does nothing special today, do not promise it).
- The hint line: under the row, small and muted, `aria-hidden` (the buttons carry the accessible actions); hidden with `@media (hover: none)` (Tailwind's `pointer-coarse:hidden` or the variant the project already uses for touch: grep one) and by a container query when the composer is narrower than the line needs.
- The counter's tone: muted below 90 % of the limit, the warning token from 90 %, the destructive token at the limit; a visually hidden live text says "n characters left" once in the warning range (polite, not on every keystroke: only when it enters the range and at the limit).
- No change to the submit, the validation, the limit or the keyboard handlers.

**Also in this task (spec §31.1), in the composer's commit or its own:** on the card itself (`resources/js/components/skrum/retro-card.tsx`, the "Edit" and "Delete" icon buttons), the gap between the two becomes the tight one of an icon group (`gap-0.5`, or what a sibling icon group of the design system uses) and each icon goes down one step (`size-4` to `size-3.5`, from whatever it is today to the next smaller step of the scale). The buttons keep their size variant (the hit area does not shrink), their `aria-label`, tooltip and focus ring. Vitest: one assertion that both buttons keep their accessible names and the small icon-button size class.

**Also in this task (spec §31.2), its own commit — `style(retro): a card's controls sit together at the right of its footer`:** in `retro-card.tsx` (and `retro/board-card.tsx` where it composes the footer) the footer is `justify-between` with two groups: the author at the left, one controls group at the right (`ms-auto`, the tight gap of §31.1) holding, in this order, votes, comments, edit, delete, drag handle. Find what leaves the hole today — a fixed-width slot, an invisible placeholder kept for an absent control, or a `flex-1` spacer between two controls — and remove it: an absent control renders nothing. Check the card in each phase on the dev bench (writing, grouping, voting, discussing) and as another participant's card. Vitest: "keeps the controls in one group at the end of the footer, in the same order", "renders nothing for a control the viewer does not have". The drag-and-drop tests still green.

**And (spec §31.3), in the footer's commit:** the "Edit" and "Delete" icon buttons are always rendered visible for who may use them — remove the hover and focus-within reveal (`opacity-0 group-hover:opacity-100`, `invisible group-hover:visible` or the like) and give them the muted text tone with the full tone on hover and `focus-visible`. This is what left the hole of §31.2: the hidden icons kept their room. Grep the card for any other control revealed on hover (the reaction adder, the drag handle) and make it always visible in the muted tone too, unless a test documents a reason. Vitest: "shows edit and delete on one's own card without hover" (no hover-reveal class on either), "shows neither on someone else's card". The browser walkthroughs that hover a card before clicking edit keep working (hovering a visible button is harmless): run `RetroCoreTest.php` as said below.

**And (spec §31.4), in the footer's commit:** the footer is `flex flex-wrap items-center justify-between gap-y-1`; the controls block is `flex flex-nowrap shrink-0 ms-auto` so it wraps as a whole under the author and never between two controls; the author group may shrink and truncate the name (`min-w-0`), the block may not. The block's order with every control: votes, ungroup, comments, edit, delete, drag handle. Check on the dev bench a grouped card of the viewer at the narrowest column the board allows, and at 20rem. Vitest: "keeps the controls block from breaking" (`flex-nowrap` and `shrink-0` on the block; the author group has `min-w-0`).

**And (spec §31.5), in the footer's commit:** the vote control (the viewer's dots, the take-back button, the "+ Vote n" button — `components/skrum/vote-dots.tsx` and where `retro-card.tsx` composes them) is wrapped in one `inline-flex flex-nowrap shrink-0 items-center` unit and placed last in the controls block (the block's final order: ungroup, comments, edit, delete, drag handle, vote unit — only the ones the phase shows). The block may break in exactly one place, before the vote unit (the block is `flex-wrap justify-end`, the other controls are one `flex-nowrap` sub-group, the vote unit another): so a card too narrow for everything shows the author, then the small controls, then the vote unit, each line ending at the right edge. Check on the dev bench a card with 0, 1 and the maximum of the viewer's votes at the narrowest column and at 20rem. Vitest: "keeps the dots, the take-back and the vote button in one unit that does not break", "puts the vote unit last in the controls".

**Vitest (names):** "puts Cancel beside the primary button on one row, the counter at the left"; "names the Enter key with the button's verb, when adding and when editing"; "warns from 90 % of the limit and stops at the limit"; the existing keyboard tests (Enter, Esc) still green.

**Run:** `npm run test -- <the composer's test file>`, `npm run types:check`, `npm run check`, `npm run build`; the browser walkthroughs that type a card read the buttons by name and should hold: run `tests/Browser/Walkthroughs/RetroCoreTest.php` and correct what breaks.

**Commit** — `style(retro): the card composer's actions on one row, hints that say what the keys do`

---

### Task 38: A page's side panel reaches the window's edge

Spec §33. After Tasks 35 to 37, before Task 17. Front only.

**Files:**
- Modify: `resources/js/components/skrum/frames.tsx` (`AppFrame`), `resources/js/layouts/skrum/app-layout.tsx`, `resources/js/components/surveys/survey-builder.tsx` and its page, and any other page that pulls a panel to the edge of the page column (grep `-mr-10` and `lg:-mr-` in `resources/js`)
- Test: `frames.test.tsx`, `app-layout.test.tsx`, `survey-builder.test.tsx`

**Interfaces:** `AppFrame` and `AppLayout` gain `bleed?: boolean` (default `false`). With it, `<main>` drops `mx-auto max-w-page` and keeps its paddings; without it nothing changes.

**Build:** `AppFrame`'s main is `mx-auto w-full max-w-page` (75rem): on a wider window the column's own right margin shows beside a panel that was pulled to the column's edge with negative margins. With `bleed`, the page owns its width: in `survey-builder.tsx` the grid (`lg:grid-cols-[minmax(0,1fr)_--spacing(85)]`) keeps its two tracks; the first holds the questions in a wrapper of the width the column gave them before (`max-w-…` from the scale, `mx-auto`), the second is the panel, still pulled over main's right padding and vertical padding as today so that it touches the window's edge and runs from the top bar to the bottom. Do the same for each other page grep finds; a page that has no such panel is not touched. No arbitrary pixel widths.

**Also in this task (spec §33.1), its own commit — `style(surveys): a question is read in full in the editor`:** in the survey editor's question card (`survey-builder.tsx` and the question component it renders, `components/skrum/survey-question.tsx` if the header is there) the question's text loses its truncating class and wraps (`break-words`, `min-w-0`); the header is `flex flex-wrap items-start gap-x-3 gap-y-1` with the text as the growing child and the badges as one `shrink-0` group, so the badges sit at the right of the first line and drop under the text only when the card is too narrow. The number stays aligned with the first line. Check the answer room and the results page for the same truncation (grep `truncate` near the question's label) and correct it there too. Vitest: "shows a question's whole text in the editor" (no truncating class on the label), "keeps the kind and Required badges together".

**And (spec §37), its own commit — `style(surveys): the waiting state of the results is one centred block`:** find the component that renders "Results appear from :count answers" on the results page (grep the key in `resources/js/components/surveys` and `components/skrum/survey-question.tsx`). Lay it out as a centred column (`flex flex-col items-center text-center gap-…`): the icon, the title (the existing sentence split so that the floor is the title — reuse the existing key if it already reads that way), the line ":count so far · :left more to go" ("No answer yet · :left to go" at zero; singular and plural keys, four languages, informal), then one row `flex items-center gap-3` with the progress (`ui/progress`, `w-64 max-w-full`, `aria-label` ":count of :floor answers") and the count in tabular figures. Remove the left-aligned bar and the right-aligned count. Vitest: "centres the waiting state with its bar and count together", "says how many answers are left, and none yet at zero".

**Vitest (names):** "keeps the centred page column by default"; "lets a page take the whole width with bleed"; "keeps the questions in a centred column beside the panel".

**Run:** `npm run test -- frames app-layout survey-builder`, `npm run types:check`, `npm run check`, `npm run build`; then open the survey editor in a browser test at 1440 and 1920 wide and assert the panel's right edge equals the viewport's width (add the assertion to the walkthrough that already opens the survey editor: grep `surveys.edit` under `tests/Browser`) and run that file.

**Commit** — `fix(layout): a page's side panel reaches the window's edge`

---

### Task 39: The retro board's scrollbar — thin, themed, at the bottom edge

Spec §34. With Task 38 (same writer, its own commit). Front only.

**Files:**
- Modify: the component that scrolls the board's columns sideways (grep `overflow-x-auto` in `resources/js/components/retro`), `resources/css/app.css` only if no scrollbar utility exists yet (grep `scrollbar` there first)
- Test: that component's test file

**Build:**
- Position: the sideways scroller takes the height of the canvas (`h-full` / `min-h-0 flex-1` in the session frame's `<main>`) so its scrollbar is at the bottom edge of the window; the room the floating reactions bar and the facilitator's dock need becomes the scroller's bottom padding (read their heights from where they are positioned; use the scale, e.g. `pb-32`, not a pixel value). Columns keep scrolling vertically as they do today.
- Look: `scrollbar-width: thin` and `scrollbar-color: <thumb> transparent` with existing tokens (the border or muted-foreground token at reduced strength: read how the design system colours a divider), through the utility the project already has, or one new utility in the "Integration additions" block of `app.css` — not in the block that is a verbatim copy of `docs/design-system/app.css` (`tests/Feature/DesignTokensTest.php` guards it). No `::-webkit-scrollbar` rules unless Safari needs them to match; never `display: none` on a scrollbar.
- Apply the same utility to the other scrolling areas of the session screens that show the system bar (grep `overflow-y-auto` and `overflow-auto` in `components/retro`, `components/session`): a class, no restructuring.

**Vitest (names):** "scrolls the columns in an area that reaches the bottom of the canvas, with room for the docks"; "uses the thin themed scrollbar on the board".

**Run:** `npm run test -- <the board's test file>`, `npm run types:check`, `npm run check`, `npm run build`, `bin/test-db pgsql -- tests/Feature/DesignTokensTest.php tests/Feature/LightScopeTokensTest.php`; `tests/Browser/Walkthroughs/RetroCoreTest.php` (it drags cards between columns: the scroller's size must not break it).

**Commit** — `style(retro): a thin themed scrollbar at the bottom edge of the board`

---

### Task 40: The session's top bar gives its room away in order, and never scrolls

Spec §35. After Tasks 38 and 39, before Task 17. Front only.

**Files:**
- Modify: `resources/js/components/skrum/frames.tsx` (`SessionFrame`'s header: it is already `@container/session`), `resources/js/components/skrum/phase-stepper.tsx`, `resources/js/components/retro/board-topbar.tsx`, `resources/js/components/session/session-title.tsx`, the presence component the top bar uses, and, with the controls they have, `components/poker/room-topbar.tsx` and `components/games/room-header.tsx`
- Test: `phase-stepper.test.tsx`, `board-topbar.test.tsx`, `session-shell.test.tsx`, `room-topbar.test.tsx`

**Build:**
- Read the header first: the stepper sits in `flex min-w-0 flex-1 justify-center` with `md:min-w-72` and scrolls sideways when squeezed (that is the scrollbar of the capture). Everything is decided by container queries on `@container/session`, with named steps taken from the Tailwind container scale; no JavaScript measuring, no `ResizeObserver`.
- `PhaseStepper` gains a compact rendering, chosen by the container query (both renderings are in the DOM, one hidden with `hidden`/`@…/session:flex`, the hidden one `aria-hidden` and out of the tab order — or one rendering whose labels collapse; pick the one that keeps a single set of focusable controls): "n/total", the current phase's name, between the previous and next buttons the bar already has. For who may change phase, the "n/total" is a button that opens a `DropdownMenu` listing the phases (current one marked), calling the same handler as a click on a step. Remove `overflow-x-auto` from the stepper.
- The title: `min-w-40` (ten characters or so) for the name, `truncate` after that; the overline (team) hidden below the widest step.
- Presence: the label "n online" hides to the number at the medium step; the guests' badge hides and its text joins the presence popover's list ("1 guest").
- Secondary controls: each of pointer mode, settings and keyboard shortcuts is rendered twice by the pattern the project already uses for an overflow menu (grep `DropdownMenu` in `board-topbar.tsx`: the "…" exists) — a button visible from a container step up, and a menu item visible below it; "Share" and the timer join the menu at the narrowest step. One handler per control, shared by its two renderings.
- Poker and icebreaker bars: apply the same order to what they have; do not add controls.

**Also (spec §35.1), same commit:** the stepper has three forms, not two: all steps named; all steps with only the current one named (the others show their number, with the name in a tooltip and in the accessible name); the compact "n/total". `phase-stepper.tsx` holds a `scrollerRef` that scrolls the current step into view (`scrollTo` around line 249): that scroller goes, with its ref and its effect, once no form overflows. The order in which the bar gives room, by container steps from the widest: (a) the words of "Previous", "Next", "Synced", "Share" (icons with `aria-label` and tooltip remain); (b) the names of the steps other than the current one; (c) the team overline, "online", the guests' badge; (d) the secondary controls into "…"; (e) the compact phases; (f) on a phone the current phase's name. Check at 1700, 1440, 1280, 1024, 940, 768, 640, 360 pixels on the dev bench (`pages/dev/sections/session-shell.tsx`) that nothing scrolls and nothing is cut mid-word. Vitest: "names only the current step in the middle form and keeps the others' names accessible", "drops the words of Previous, Next, Synced and Share before any step loses its name" (the classes that hide the labels carry a wider container step than the ones that hide the step names).

**And (spec §35.2), its own commit — `feat(session): a guest sees the instance's mark in the top bar`:** `session-layout.tsx` has a `HeaderLogo` and a `chrome` choice (read them: the logo was meant for the frames without a sidebar); since the sidebar left every session, decide the logo by the viewer, not by the chrome: a guest (no signed-in user; each room's props say so — read how `board-topbar.tsx`, `room-topbar.tsx`, `room-header.tsx`, the whiteboard's header and the survey room tell a guest) gets `BrandLogo` with the `SkrumLogo` symbol as fallback at the small size before the title, as plain content (no link: a guest has nowhere to go), with the brand's name as its accessible text; a member gets the back arrow and no logo. One place decides it (the layout or `SessionTitle`), not five. Vitest in `session-shell.test.tsx`: "shows the instance's mark to a guest, not as a link", "shows a member the back arrow and no mark". Browser: one assertion added to a guest's walkthrough of a game room (grep `play/` or the guest join under `tests/Browser`).

**And (spec §35.3), in the folding commit:** `SessionFrame`'s header is a flex row whose middle child is `flex-1 justify-center`: it centres the phases in the room left between two sides of different widths, not on the bar. Make the header a grid of three tracks, `grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]`: the first cell holds the logo or back arrow and the title (`justify-self-start`, `min-w-0`), the middle cell the phase group (the stepper, the phase's status and its actions — move `status` into that cell when it is the phase's state, keep the connection state "Synced" with the right-hand controls), the third cell the timer, presence, actions and avatar (`justify-self-end`). With equal `1fr` side tracks the middle cell is centred on the bar; when a side's content is wider than its track the grid lets the middle cell shift, which is the behaviour wanted. `SessionFrame`'s props keep their names; the poker and icebreaker bars pass no phases and get an empty middle cell. Browser check added to the top bar's test in `NavigationTest.php`: at 1920 wide the centre of the phase group's box is within 2 pixels of the header's centre. Vitest: "lays the header out in three tracks with the phases in the middle one".

**Vitest (names):** "shows no scrolling area in the top bar" (no `overflow-x-auto` in the header's subtree); "offers the compact phase control with the current phase and opens the list of phases"; "keeps one focusable set of phase controls"; "keeps a minimum width for the session's name"; "offers pointer mode, settings and shortcuts in the menu as well"; "folds the guests into the presence popover".

**Run:** `npm run test -- phase-stepper board-topbar session-shell room-topbar`, `npm run types:check`, `npm run check`, `npm run build`; then a browser check in `tests/Browser/Walkthroughs/NavigationTest.php` (one new test): at 1700, 940, 640 and 360 pixels wide the retro's header and its phase control have `scrollWidth <= clientWidth`, the session's name is visible, and the phase can be advanced from the compact control. Run that file and `RetroCoreTest.php`.

**Commit** — `fix(session): the top bar folds its controls in order and never scrolls`

---

### Task 41: The leave dialog — two choices that each say what they do

Spec §36. With Task 40 (same writer, its own commit). Front only.

**Files:**
- Modify: `resources/js/components/session/leave-session-dialog.tsx`
- Test: `leave-session-dialog.test.tsx`; the browser test of `NavigationTest.php` that leaves a live retro by each of the three buttons

**Build:** the component's props do not change (`open`, `onOpenChange`, `title`, `peopleCount`, `backHref`, `onEnd`, `endNote`); only its body. Two `button`s, full width, stacked with the gap of a list of options, each `flex items-start gap-3 rounded-lg border p-3 text-left` with an icon (`LogOut` for leaving, `CircleStop` or the icon the retro already uses for closing, for ending), a title line (`font-medium`) and a description line (`text-sm text-muted-foreground`, wrapping): "Leave, the session continues" / "It keeps running. You can come back."; "End the session" / "It closes for everyone." followed by `endNote` when given. The second takes the destructive tokens for its border, icon and title, and `aria-describedby` its description. The footer holds "Stay" alone (`variant="outline"`), `autoFocus`. The people line reads "Still running for :count people." (the existing key if it says the same). Keep the pending state (both choices and Stay disabled, a spinner in the destructive choice), the alert on failure above the choices, and `router.visit(backHref)` after leaving or ending. Existing keys keep their values; new ones in four languages, informal.

**Vitest:** the ten tests of the dialog keep their names and are adjusted to the new markup (the buttons are found by their accessible names, which do not change: "Stay", "Leave, keep running" becomes "Leave, the session continues" only if the key's value changes — keep the existing value if the tests and the browser test read it); add "puts each consequence under its choice", "focuses Stay on open", "reaches End after Leave with the keyboard".

**Run:** `npm run test -- leave-session-dialog board-topbar room-topbar`, the front gates, then `tests/Browser/Walkthroughs/NavigationTest.php` (the leave test) and correct its selectors if the names changed.

**Commit** — `style(session): the leave dialog shows each choice with its consequence`

---

### Task 42: Branding — a full page load after a write that changes the brand

Spec §38. With Tasks 40 and 41 (same writer, its own commit). Back end, with one browser test.

**Files:**
- Modify: `app/Http/Controllers/Admin/BrandingController.php` (`update`, and the action behind "Back to Skrüm"), the controllers that upload and remove a brand asset (`php artisan route:list --path=admin/branding` lists them)
- Test: the feature tests of those controllers (`tests/Feature/Admin` or `tests/Feature/Branding`: grep `admin.branding`), one browser test where the branding walkthrough lives (grep `admin.branding` under `tests/Browser`)

**Build:** the brand's CSS and the favicon are printed by `resources/views/app.blade.php` (`BrandStyle::css()`, `BrandAssets`), which an Inertia visit does not render again. After a write that changed something, answer an Inertia request with `Inertia::location(route('admin.branding.edit'))` (the client then loads the page in full) in place of the redirect; keep the redirect for a request that is not an Inertia one and for a write that changed nothing (`$changedKeys === []` in `update`). The toast is flashed before, as today (`Inertia::flash`): check it survives the full load — it is in the session — and if it does not, flash it the way that does. Asset uploads that answer JSON to a fetch (read them) need the front to reload instead: after a successful upload or removal, `window.location.reload()` in the one place that handles their success (grep the upload hook in `resources/js/components/admin`), not a second mechanism.

**Tests:** feature — "answers a brand change with a full page load" (an Inertia `PUT` with a new colour: status 409 and the header `X-Inertia-Location` to the branding page), "keeps the plain redirect when nothing changed", "keeps the form and its error on an invalid colour" (existing: still green); browser — "shows the new primary colour without a manual reload": save a colour, then read the computed background of a primary button and assert it changed, and that the toast is on screen.

**Run:** `bin/test-db pgsql -- tests/Feature/Admin tests/Feature/Branding tests/Arch`, pint, `composer types:check`, the front gates if a front file changed, the browser file.

**Commit** — `fix(admin): the instance shows its new brand as soon as it is saved`

---

### Task 43: Avatars in every list of people

Spec §39. With Tasks 40 to 42 (same writer, its own commit). Front only, unless a list's data lacks `avatarUrl`.

**Files:**
- Modify: `resources/js/components/team-settings/default-facilitators-card.tsx` (its "Add" menu) and every other picker of people found without an avatar
- Test: the test file of each component changed

**Build:** the shared piece exists since the Members dialog and the Activity filter (read task-31-32-report.md and task-30-33-report.md for its name and file): an avatar, the name, optionally a muted second text. Use it in the "Add" menu of the default facilitators. Then look for the others: grep `SelectItem`, `DropdownMenuItem`, `CommandItem` and the combobox across `resources/js/components` and keep the ones whose items are people (the items come from a `members`, `users`, `participants`, `facilitators`, `assignees` or `people` list). For each: when the list's items carry `avatarUrl`, use the shared piece; when they do not, add `avatarUrl` to the prop on the server where the list is built (`$user->avatarUrl()`, with one assertion in that controller's feature test) rather than leaving the place out. Known place, shown by the owner on 2026-10-06: the "Who draws?" select of the drawing game's start screen (`resources/js/components/games`: grep the label), which lists players, guests included — a guest has a generated avatar (the players' list of the room shows it): use it. Do not restyle a picker that already shows avatars. Write in the report the list of places checked, with "had it", "added", or "not people".

**Also in this task (spec §39.1), its own commit — `fix(health-check): the statements' list keeps its rounded corners`:** in the statements manager (`resources/js/components/teams/team-health-manager.tsx`, the `ul`/`ol` of statements) find why the frame's lines do not meet at the corners — a bordered container without radius inside a rounded one, rows that each draw their own side borders, or an `overflow-hidden` parent cutting a child's border — and draw the frame once: the list is `rounded-lg border overflow-hidden` (the radius token the cards of the page use), the rows `divide-y` with no side or top border of their own. Check the row being dragged (the drag overlay keeps its own radius) on the dev bench or the page. Vitest: "frames the statements' list once, with rounded corners" (the list carries the border and the radius; a row carries no side border).

**And (spec §39.2), its own commit — `style(nav): room between the team switcher and New session`:** in `resources/js/components/skrum/app-sidebar.tsx` the "New session" item follows the team switcher inside the same `SidebarMenu` of the header; give it the top margin that equals the gap between two `SidebarGroup`s (read the group's padding in `components/ui/sidebar.tsx` and use the same step of the scale, e.g. `mt-2`), expanded and collapsed. No new test beyond one class assertion in `app-sidebar.test.tsx` ("sets New session apart from the switcher").

**And (spec §39.3), in the sidebar's commit:** the live mark of the Sessions entry (`SidebarMenuBadge` with a dot and a count, added by the sidebar task) becomes one pill built like the overdue badge of Actions in the same file: `rounded-full px-1.5 inline-flex items-center gap-1 tabular-nums`, the positive token at low strength for the background and at full strength for the dot and the figure (the tokens the "Live" status of a session row uses: read `session-row.tsx`), the dot `size-1.5 rounded-full bg-current`. Same height and right offset as the overdue badge. `aria-hidden` on the pill's content; the link's accessible name keeps "Sessions, :count live". Update the existing test "shows a dot and the count on Sessions when a session is live" to find both inside one `data-slot="live-badge"`.

**And (spec §39.4), its own commit — `fix(roti): the figure is centred in its chip`:** in `resources/js/components/skrum/roti-value.tsx` the chip is an inline box whose text sits on the line's baseline, so the figure looks low and off to one side. Make the chip `inline-flex items-center justify-center` with a fixed height from the scale, equal horizontal padding, `leading-none` and `tabular-nums`, and align the chip itself with `align-middle` (or `self-center` where its parent is a flex row) so it sits level with the word beside it. Measure in a browser on the dev bench (the figure's text box against the chip's box, both axes) for "3,5" and "4.0" and put the numbers in the report. Vitest: one assertion on the centring classes.

**And (spec §39.5), its own commit — `feat(nav): the instance's mark in the phone's top bar`:** in `resources/js/components/skrum/app-topbar.tsx` add, before the title and only below `md` (`md:hidden`, the width from which the sidebar is on screen), a link to `homeHref` (the sidebar model has it: pass it from `app-layout.tsx`) holding `BrandLogo` with the `SkrumLogo` symbol as its fallback, as the sidebar's header does, at the small size (`size-6`/`h-6`), `aria-label` the brand's name. The title keeps truncating after it. Vitest in `app-topbar.test.tsx`: "shows the instance's mark before the title on a phone, linking home", "shows the instance's own logo when it has one".

**And (spec §39.6), its own commit — `fix(palette): rounded corners no longer cut the field, the list or the footer`:** in `resources/js/components/ui/command.tsx` and `components/workspaces/command-menu.tsx`: the dialog's container is rounded with `overflow-hidden`, and the input draws a focus border the corners slice. Remove the input's own border, ring and outline inside the palette (`border-0 outline-none ring-0 focus-visible:ring-0`), keep a `border-b` on the input's row; give the list the thin scrollbar utility of the scrollbar task (read task-38-39-report.md for its name) with a right margin so it sits inside the edge, and keep the list between the two rules; check the header's and footer's horizontal padding against the container's radius. The dialog keeps its `aria` wiring and the field its accessible name. Vitest in `command.test.tsx`: "draws no outline on the field inside the palette", existing filtering and keyboard tests still green.

**And (spec §39.7), its own commit — `style(retro): one gap between the blocks of the results`:** on a finished retro's results (`resources/js/components/retro/results/` and `retro/session-end.tsx`: the row of figures, the two columns under it, the cards stacked in each) pick the one gap the columns already use, or the page's standard gap between cards (read a sibling page such as Home), and give it to the figures' grid, to the space under that row, to each column's stack and to the columns' grid: the same class, four places. Measure in a browser at 1440 (four `getBoundingClientRect` differences) and put them in the report. Vitest: one assertion that the four containers carry the same gap class.

**And (spec §39.8), its own commit — `style(retro): sort by votes as a small icon in the column's header`:** in `resources/js/components/skrum/retro-column.tsx` (or `retro/columns-board.tsx` where the button "Sort by votes" is rendered: grep the key) move the control into the header row, right-aligned, before the count badge and the column's "…" menu if it has one: the small icon-button variant (`size="icon-sm"` or the smallest the column header already uses), the same icon without its label, `aria-label` and tooltip "Sort by votes", `aria-pressed` and the pressed style when sorting is on. Same conditions of display as today; same handler. Remove the row it left. Update the existing test that finds the button by its text to find it by its accessible name; add "marks the sort as pressed when it is on". Browser: grep `Sort by votes` under `tests/Browser`; a test that clicks it by text finds it by its label now — correct and run that file.

**And (spec §39.9), its own commit — `style(templates): a template's preview shows its columns' whole text`:** the live preview of the template editor and the "Template preview" of the picker draw a template's columns through one component (find it: the `aside` of `template-editor.tsx`, and `retro/columns-board.tsx` or the preview inside `retro-template-picker.tsx`; if there are two, change both the same way and say so). The column's title and description lose their truncating classes (`truncate`, `line-clamp-*`) for `break-words`; the grid becomes two columns by a container query, one below, with the technique the columns editor of the dialog already uses (`retro-columns-editor.tsx`, from the lane's task: read task-27-28-29-report.md). The placeholder bars stay. Vitest: "shows a column's whole title and description in the preview".

**And (spec §39.10), in the commit that gives the default facilitators' menu its avatars or right after it — `style(team): Add is the default facilitators card's header action`:** in `default-facilitators-card.tsx` move the "Add" trigger (and its menu) into the card's header, right-aligned, built as the sprints card builds "Add a sprint" (read `sprints-card.tsx` and use the same header slot of the settings panel); the body shows the list, or the muted line "No default facilitator yet." (new key, four languages, informal) when it is empty. Vitest: "offers Add in the card's header", "says when there is no default facilitator".

**And (spec §39.11), its own commit — `style: content the team wrote is shown whole`:** first the place the owner showed: `default-columns-card.tsx` (Settings › Retrospectives) — the column pills lose `truncate`, their text wraps (`break-words`, `whitespace-normal`, `text-left`), and the row is `flex flex-wrap` (or a two-column grid by container query when four whole titles do not fit). Then the sweep: grep `truncate` and `line-clamp` across `resources/js/components` and keep the hits whose text is a retro column's title or description, a template's or deck's name, a survey question or statement, or a card's text, in a card, tile, pill, preview or settings list; correct each the same way. Leave alone, by the spec's own exclusions: the sidebar, the top bars and titles, table cells, menu and select items, toasts, and anything already corrected by an earlier task (the dialog's tiles and columns, the survey editor, the template preview). Where a place is excluded but shortens a long name, add `title={…}` if it has no tooltip yet. Write in the report the table of places: file, what text, "shown whole now" / "excluded: why" / "already whole". Vitest: one assertion per corrected component that the text carries no truncating class.

**And (spec §39.12), its own commit — `fix(action-items): Group by stays with its choices on a phone`:** in the Actions page's header (`resources/js/components/action-items/action-items-page.tsx` and the header piece it renders: the scope switch was added there by the scope task) the label "Group by" and its segmented control are siblings of a wrapping flex row, so they part at a narrow width. Wrap the two in one `inline-flex items-center gap-2 shrink-0` group (label first), so the group wraps as a whole; let the header row be `flex flex-wrap items-center gap-2` with the scope switch as its own first item (`w-full sm:w-auto` if it must take the line on a phone). If the segmented control alone is wider than 20rem minus the page's padding, it may scroll inside itself as the Sessions chips do; it must not overflow the page. Vitest: "keeps Group by and its choices in one group".

**And (spec §35.4), its own commit — `style(games): the game in play is centred in the room's top bar`:** since the top bar task, `SessionFrame`'s header has three tracks with a middle cell (read task-40-41-report.md for the prop that fills it — the retro passes its phases there). In `resources/js/components/games/room-header.tsx` the badge naming the game ("Draw and guess", …) is rendered among the title's `badges`: pass it to the middle cell instead (keep it out of the title), with nothing in the middle when no game is chosen. It keeps its `data-slot` and its accessible text. Vitest in the room header's test: "puts the game's badge in the middle of the bar, not beside the title". Browser tests that read the game's badge by text keep working; run the games walkthrough that opens a room (grep `room-header` or the badge's slot under `tests/Browser`).

**Vitest:** in each component changed, one test "shows each person's avatar in the list".

**Run:** `npm run test -- <the files changed>`, `npm run types:check`, `npm run check`, `npm run build`; pint, `composer types:check` and the feature tests touched if a prop gained `avatarUrl`.

**Commit** — `style(people): avatars wherever a person is picked from a list`

---

### Task 44: The emoji picker — search, recents, even rows, a footer that names the emoji

Spec §40. After Tasks 40 to 43, before Task 17. Front only.

**Files:**
- Modify: `resources/js/components/retro/emoji-picker.tsx` (the full picker), `resources/js/components/skrum/reaction-bar.tsx` and `reaction-picker.tsx` (the quick row and its "More emoji…"), `resources/js/components/session/session-reaction-picker.tsx`, and any other caller of the full picker (grep `emoji-picker`)
- Create: `resources/js/lib/emoji/recent.ts` and its test
- Test: `emoji-picker.test.tsx`, `reaction-bar.test.tsx`, `reaction-picker.test.tsx`, `session-reaction-picker.test.tsx`

**Build:**
- The picker is built on `frimousse` (see `package.json` for the installed version, and read its exported parts in `node_modules/frimousse` before writing: the root, the search, the viewport, the list with its `components` for a category header, a row and an emoji, the active emoji, the skin tone selector, the loading and empty parts). Use those parts; add no dependency. `columns` is 8.
- Layout: a column — the search row with a rule under it; the viewport (fixed height from the scale, the thin scrollbar utility of the scrollbar task, a right inset); the footer with a rule above it. Category headers are sticky at the top of the viewport on the popover's background. Cells are one square size with the glyph centred (`size-8`/`size-9` and a text size from the scale), a highlight on hover and on the active (keyboard) cell.
- Footer: the library's active emoji part gives the glyph and its label; show them, or the hint when none is active; the skin tone selector at the right if the installed version exports one.
- "Recent": `lib/emoji/recent.ts` — `readRecent(): string[]`, `pushRecent(emoji: string): string[]` on `localStorage` under one key, most recent first, no duplicate, capped at 16, every access in try/catch returning `[]` (private mode, blocked storage). The picker renders the first 8 as a row with the same cell above the library's list, hidden while a search is typed and when empty; picking from it goes through the same `onEmojiSelect`. `pushRecent` is called on every pick, quick reactions included.
- Quick row: after the six reactions, a "+" icon button (`aria-label` "More emoji", tooltip) that swaps the popover's content to the picker (same popover, focus to the search field); Esc in the picker returns to the quick row, a second Esc closes. Remove the "More emoji…" text field from the quick popover. Locked reactions ("Reactions are locked.") keep disabling both.
- The session's floating reactions bar (spec §40.1; `resources/js/components/session/session-reactions.tsx` and `session-reaction-picker.tsx`): its last button opens today a popover that repeats the bar's six reactions above "More emoji…". It opens the picker directly instead (the popover's content is the picker, anchored above the bar, focus in the search field; Esc closes and returns the focus to the button). The six quick reactions exist once, in the bar. Vitest in `session-reaction-picker.test.tsx`: "opens the picker directly from the bar's last button", "does not repeat the quick reactions".
- Texts in four languages, informal: "Search an emoji…", "Recent", "Pick an emoji", "No emoji matches", "More emoji" (check the existing keys first: "More emoji…" exists; keep its value for the button's name if it reads right).

**Vitest (names):** `recent.test.ts` — "keeps the most recent first without duplicates, capped", "returns nothing when storage is unavailable"; picker — "focuses the search field on opening", "shows Recent after a pick and hides it while searching", "names the active emoji in the footer", "says when nothing matches"; quick row — "opens the picker from More emoji and returns to the quick row with Esc", "has no search field in the quick row", "keeps both locked when reactions are locked".

**Run:** `npm run test -- emoji reaction`, `npm run types:check`, `npm run check`, `npm run build`; the browser walkthroughs that react with an emoji (grep `More emoji` and `emoji` under `tests/Browser`): correct and run those files.

**Commit** — `feat(emoji): a picker with search, recents, even rows and a named footer`

---

### Task 45: Administration — "Check now" for a new version

Spec §41. With Tasks 42 and 43 (same writer, its own commit). Back end and front.

**Files:**
- Create: `app/Actions/Instance/CheckForUpdate.php` (`make:class`; put it where the instance's other actions live — read the folder first), `app/Http/Controllers/Admin/UpdateChecksController.php` (`store`)
- Modify: `app/Console/Commands/CheckForUpdateCommand.php` (it calls the action), `routes/admin.php`, `resources/js/components/admin/general/updates-card.tsx`
- Test: the command's existing test (grep `CheckForUpdate` under `tests`), a new `tests/Feature/Admin/UpdateChecksTest.php`, `updates-card.test.tsx`

**Interfaces:**
- `CheckForUpdate::handle(): ?string` — asks the release feed with the command's timeout and rules (move `latestVersion()` and what it needs out of the command, unchanged), stores `LatestVersion` and `UpdateCheckedAt` when it gets a usable version and returns it; returns null and stores nothing otherwise. It does not read the daily switch: the command keeps that test before calling it.
- `POST admin/update-checks` named `admin.updateChecks.store`, the gate and middleware of the other administration writes (read `routes/admin.php`: use the same group; if writes there require a confirmed administrator, this one does too), `throttle:6,1`. It flashes a toast as the other admin controllers do (`Inertia::flash('toast', …)`) — success "You're on the latest version." or "Version :version is available." by comparing with `InstanceVersion::current()` the way `InstanceVersion::status()` does (reuse its comparison, do not write a second one), error "The release feed could not be reached. Try again later." — and redirects back.

**Tests:** feature, with `Http::fake` as the command's test fakes the feed — "stores the latest version and the date and says a version is available", "says the instance is up to date", "stores nothing and says so when the feed is down", "checks even when the daily check is off", "refuses a user who is not an instance administrator", "refuses the seventh check of a minute"; the command's tests stay green unchanged. Vitest — "offers Check now beside the last check", "shows its progress and cannot be pressed twice".

**Front:** in `updates-card.tsx`, the last-check line and the button on one row (`justify-between`); the button is the project's `LoadingButton`, posting with Inertia's `router.post` (`preserveScroll`), disabled while processing. New keys in four languages, informal.

**Run:** `bin/test-db pgsql -- tests/Feature/Admin tests/Arch` and the command's test, pint, `composer types:check`, `npm run test -- updates-card`, the front gates.

**Commit** — `feat(admin): check for a new version on demand`

---

### Task 46: The whiteboard — the sessions' top bar rules; the facilitator's controls on the board

Spec §42. After Task 44, before Task 17. Front only.

**Files:**
- Modify: `resources/js/components/whiteboard/board-header.tsx` (the top bar), the whiteboard page's shell where the canvas and its floating overlays are placed (`whiteboard-toolbar.tsx`, `whiteboard-view-controls.tsx` are siblings: read how they are positioned), `resources/js/components/skrum/facilitator-bar.tsx` only if its layout assumes the top bar
- Test: `board-header.test.tsx`, the facilitator bar's test, the whiteboard shell's test; the browser walkthroughs of the whiteboard that click "Lock the board" or the timer (`WhiteboardCoreTest.php`, `WhiteboardScreensTest.php`: grep the labels)

**Build:**
- Read task-40-41-report.md first: it says how `SessionFrame`'s header is laid out since the top bar task (three tracks, the middle cell, the container steps at which words, names and controls fold, the "…" pattern). The whiteboard's header uses the same props and the same steps; do not invent a second set.
- Title: the back arrow (`backHref` to the team's Home) and `SessionTitle` with the team as overline and the board's name, the pencil that edits the name kept beside it. The crumbs "Team › Whiteboards › name" go (the sweep task pointed the middle crumb at the Sessions page: it leaves with the crumbs).
- Right cell: connection dot, presence, then Export, Share, "…", shortcuts, avatar; words fold to icons and then into "…" at the same container steps as the retro's bar; "Share" stays out longest.
- The facilitator's pill: render the same component, with the same props and handlers, in an overlay of the canvas — `absolute top-3 right-3 z-…` inside the board's positioned container, at the z-index of the other floating toolbars — instead of in the header. Its labels show in full from the board width where they fit; below, icons with `aria-label` and tooltip, by a container query on the board. Check it does not cover the tools rail, the selection bar (`whiteboard-selection-bar.tsx`), the view controls, or Excalidraw's own top-right UI if any is shown (read the Excalidraw props the page sets); move one or the other by the scale if they meet. Keyboard order: the pill comes after the top bar and before the canvas.
- Guests: the mark of spec §35.2 comes from the shared title logic; check it shows on a whiteboard.

**Also in this task (spec §42.1), its own commit — `feat(session): rename a retro, a poker game or a room from its top bar`:** the whiteboard's header has an in-place editor of the board's name (the pencil). Move it into the shared title (`resources/js/components/session/session-title.tsx`): `SessionTitle` gains `onRename?: (name: string) => Promise<void> | void` and `renameLabel?: string`; when given, the pencil shows after the name and swaps the name for a field (selected, `maxLength` as the server's rule, 120), Enter or blur saves, Esc cancels, an empty or unchanged value does not call `onRename`, a rejected promise shows the field's error and stays in edit mode. The whiteboard passes what it does today. The retro (`board-topbar.tsx`), the poker room (`room-topbar.tsx`) and the icebreaker room (`room-header.tsx`) pass `onRename` only for a viewer who may change the session's settings (the same condition that shows them the settings control), calling the request their settings dialog already uses for the name: `retros.settings.update` and `poker.settings.update` with `title`, `games.update` with `name` — reuse the function, not a second request. The broadcast those routes already send renames the session for the others: check it in each room's snapshot handler and say what you found. Vitest in `session-title.test.tsx`: "renames on Enter and on blur", "keeps the name on Esc", "does not save an empty name", "shows no pencil without onRename"; one test in each of the three top bars that the pencil is there for a facilitator and absent for a member. Browser: one test in `NavigationTest.php` — a facilitator renames a retro from the top bar and a second browser sees the new name.

**Vitest (names):** "shows the board's name with the team above it and no path"; "keeps the name editable"; "shows no facilitator control in the top bar"; "floats the timer, lock and bring-everyone controls on the board for the facilitator"; "shows no pill to a member who does not facilitate"; "folds Export and Share as the other sessions' bars do".

**Run:** `npm run test -- whiteboard board-header facilitator-bar`, `npm run types:check`, `npm run check`, `npm run build`; the whiteboard walkthroughs named above (correct the selectors of the moved controls, run those files); add to `NavigationTest.php`'s top bar test the whiteboard at 1700 and 940 wide: the header has `scrollWidth <= clientWidth`, and the facilitator's pill's box lies inside the canvas's box, in its right half and top quarter.

**Commit** — `style(whiteboard): the sessions' top bar rules, and the facilitator's controls on the board`

---

## Self-review (done while writing)

- **Spec coverage:** §6.1 → Task 1; §6.2, §9.3 → Tasks 2, 8; §6.3, §9.2 → Tasks 5, 9; §7 → Tasks 3, 4, 6 (`canCreateSession`), 11, 13; §9.1 → Task 6; §9.4 → Tasks 4, 10; §9.5, §9.6 → Tasks 3, 11; §9.7 → Task 13; §9.8 → Tasks 7, 14; §9.9 → Tasks 8 (row menu, kind links), 10, 11; §9.10 → Task 12; §11 → Tasks 2, 3, 4; §12 criteria 1–21 → the tasks above, 22 → Task 17, 23 → Task 18; §13 → Task 16; §15 → Owner decisions; §16 → Tasks 6 (16.3), 8 (16.2), 9 (16.4), 13 (16.1), and the walk of Task 16 (16.5).
- **Names checked across tasks:** `liveSessions` is the shared count (Tasks 1, 6, 14); `liveNow` is Home's list (Tasks 5, 9); `timeline` (Task 2) feeds `live` / `sessions` / `counts` (Task 8); `sections.rituals` (Tasks 3, 11); `active="insights"` (Tasks 6, 10) — Task 4's stub passes `"mood"` only until Task 6 changes the key.
- **Known soft spots, each owned by a task's "read first":** the factories' relation names in Task 2's tests; how a board's and a survey's delete right is decided today (Task 2); the capture tooling (Task 17).
