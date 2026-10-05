# Navigation redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does: one writer, tasks in order, a review after each task, a whole-branch review at the end). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Owner decisions**, **Global Constraints** and its own task before anything else, then `docs/database.md` ("Rules for database code") when its task touches PHP.

**Status:** draft, awaiting the owner's review (2026-10-05).

**Goal:** One job per screen: a sidebar whose every entry is a page, a Home that answers "what now", one Sessions list grouped by sprint, an Insights page with tabs, Members as its own page, no sidebar inside a session and a leave dialog for the facilitator.

**Architecture:** No table changes. The back end adds one shared prop (the live count), one reading of `ListTeamSessions` that is not bound to a state (`timeline`), two pages (`teams.insights.show`, `teams.rituals.show`), opens `teams.members.index` to every member and slims `teams.show`. The front moves existing components to their new page instead of rewriting them; the per-kind sections of the team page are deleted once their functions are re-homed (spec §9.9).

**Tech Stack:** Laravel 13, PHP 8.4, Pest (feature, arch, browser), Inertia 3, React 19, Tailwind 4, vite-plus (Vitest), Wayfinder; PostgreSQL through `bin/test-db pgsql`. Run `composer show --direct` and read `package.json` before relying on a package API.

**Spec:** `docs/superpowers/specs/2026-10-05-navigation-redesign-design.md`. Executors read both; a "§" below is a section of the spec.

**Not in this plan:** spec §3 (workspace screens, the switcher's menu, scheduling, live refresh, new charts, thumbnails in the list).

**Tasks:** 18, in order. Step A, back end: 1 to 5. Step B, front: 6 to 14. Final: 15 to 18.

## Branch and run

- Branch `navigation-redesign`, cut from `main` at `15bb4fec`; the spec is its first commit. No merge into `main`, no push: the owner merges after the 2026-10-18 release (spec §15.3).
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
| N-1 | "End it" on a retro sends the phase `completed` (the request the facilitator's dock already makes at its last step). A retro ended from an earlier phase skips the phases left, ROTI included. | as said; the dialog's text for a retro adds "The remaining phases are skipped." |
| N-2 | An open survey is "live" by the rule of `ListTeamSessions`. A team with a survey open for a week shows the sidebar's dot for a week. | as said: the count uses the Live rule unchanged |

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

## Self-review (done while writing)

- **Spec coverage:** §6.1 → Task 1; §6.2, §9.3 → Tasks 2, 8; §6.3, §9.2 → Tasks 5, 9; §7 → Tasks 3, 4, 6 (`canCreateSession`), 11, 13; §9.1 → Task 6; §9.4 → Tasks 4, 10; §9.5, §9.6 → Tasks 3, 11; §9.7 → Task 13; §9.8 → Tasks 7, 14; §9.9 → Tasks 8 (row menu, kind links), 10, 11; §9.10 → Task 12; §11 → Tasks 2, 3, 4; §12 criteria 1–21 → the tasks above, 22 → Task 17, 23 → Task 18; §13 → Task 16; §15 → Owner decisions; §16 → Tasks 6 (16.3), 8 (16.2), 9 (16.4), 13 (16.1), and the walk of Task 16 (16.5).
- **Names checked across tasks:** `liveSessions` is the shared count (Tasks 1, 6, 14); `liveNow` is Home's list (Tasks 5, 9); `timeline` (Task 2) feeds `live` / `sessions` / `counts` (Task 8); `sections.rituals` (Tasks 3, 11); `active="insights"` (Tasks 6, 10) — Task 4's stub passes `"mood"` only until Task 6 changes the key.
- **Known soft spots, each owned by a task's "read first":** the factories' relation names in Task 2's tests; how a board's and a survey's delete right is decided today (Task 2); the capture tooling (Task 17).
