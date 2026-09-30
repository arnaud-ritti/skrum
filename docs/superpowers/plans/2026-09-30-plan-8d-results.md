# Plan 8d — Results view, ROTI and group names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A completed retro opens on a Results view (participants, team health radar and trend, survey results, top topics, action items, ROTI) next to the read-only board; participants rate the meeting (ROTI); anyone who can group names card groups; every transition into `Completed` fires the plain `RetroCompleted` event.

**Architecture:** Server-side read model `BuildResults` (composes Plan 8b's `SummarizeHealthCheck` / `BuildHealthTrend` and Plan 8c's `PresentSurvey::many`, plus a SQL ROTI aggregate) is added to the board snapshot as `results` (only in `Completed`) next to a small `roti` block. ROTI and group names are ordinary board mutations (`RetroGuard` + `lockForUpdate` + `RetroBroadcastEvent::sendToOthers()`). The group-name lifecycle lives in `GroupCard`, `PlaceCard` and `CardsController::destroy` through one model helper, `Card::clearGroupNameWhenEmpty()`. The frontend adds a Results/Board tab switch in `Completed`, inline-SVG charts without animation, a ROTI control and an inline group-name editor; `results.changed` / `roti.changed` trigger a debounced snapshot refetch.

**Tech Stack:** Laravel 13 (PHP 8.4), Pest, Reverb, React 19, Inertia v3, `@laravel/echo-react`, Wayfinder, Tailwind 4, lucide, Radix collapsible (already installed).

**Spec:** `docs/superpowers/specs/2026-09-29-retro-flow-extras-design.md` (§6.1, §6.2, §6.4, §7.2 without LLM, §10, §11, §13, §14, §15). Cross-plan contract: Plan 8 contract (8a → 8b → 8c → 8d → 8e). Parent: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md`.

## Global Constraints

- Plans 8a, 8b and 8c are implemented. This plan consumes exactly: `RetroPhase` (with `HealthCheck`, `Icebreaker`, `isOpen()`, `hidesOthersCards()`), `ChangeRetroPhase::handle(Retro $locked, RetroPhase $phase): void`, `App\Actions\HealthCheck\SummarizeHealthCheck::handle(Retro $retro): ?array`, `App\Actions\HealthCheck\BuildHealthTrend::forViewer(Retro $retro, Participant $viewer): ?array` (null for guests), `App\Actions\Surveys\PresentSurvey::many(Retro $retro, Participant $viewer): array`, the frontend type `SurveyPayload` (spec §5.2 shape) and snapshot `surveys`.
- Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host.
- No new Composer or npm dependency. Charts are inline SVG.
- Migration filenames use the prefix `2026_10_01_1300xx`; only `up()` methods.
- Every mutation: guards on the route-bound retro, again on the `lockForUpdate` retro inside `DB::transaction`, broadcast with `->sendToOthers()` inside the transaction.
- Exceptions to "Completed is read-only" introduced here: ROTI only (spec §6.4). ROTI is also not blocked by `is_locked`.
- Redaction: individual ROTI ratings are never sent to anyone but their author; ROTI distribution and average only inside `results` (only in `Completed`); `groupName` is `null` on hidden cards; broadcasts never carry a score. `healthTrend` is `null` for guests.
- Every user-facing string via `t()` / `__()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"). Add only keys that are missing at execution time (8b/8c may already have added some); `tests/Feature/TranslationKeysTest.php` stays green.
- Board API calls through `retroRequest()` and Wayfinder route functions. Run `vendor/bin/sail artisan wayfinder:generate --with-form` after route changes.
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp fmt <files>`.
- React: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `useBoard()` for board state, `prefers-reduced-motion` respected (no chart animation; bar widths only animate under `motion-safe:`).
- PHP: constructor promotion, typed everything, array-shape docblocks on presenter return values, early returns, curly braces, no comments restating code.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Review Focus

1. **Group-name request on a grouped child, or on a card without grouped cards** → 422 "Only groups can be named.", nothing stored; a card of another retro → 404. Pinned in Task 3 ("refuses to name a card that does not lead a group", "returns 404 for cards of another retro").
2. **A named lead is grouped onto a lead that already has a name** → the target keeps its own name and the moved card's name is cleared (never two names in one group, never a name on a child). Pinned in Task 4 ("keeps the target name when both groups are named").
3. **The last grouped card leaves its lead by drag-to-column (position endpoint) or by deletion, not through the Ungroup button** → the lead's name is cleared and others are told. Pinned in Task 4 ("clears the name when the last grouped card is moved out" / "…is deleted").
4. **A guest opens a completed retro through a still-enabled guest link** → `results` is present, `healthTrend` is `null`, the rest identical. Pinned in Task 5 ("hides the health trend from guests").
5. **Rating the meeting while the facilitator closed the board for editing, or right after a reopen** → accepted in `Discussing` and `Completed` even when locked; the distribution never appears before `Completed`. Pinned in Task 2 ("accepts ratings in discussing and completed even when locked", "shows only the own score and the respondent count before completion").

## File map

| Area | Files |
|---|---|
| Completion event | `app/Events/RetroCompleted.php`, `app/Events/Retros/ResultsChanged.php`, `app/Actions/Retros/ChangeRetroPhase.php` |
| ROTI | migration `2026_10_01_130000_create_roti_votes_table`, `app/Models/RotiVote.php`, `database/factories/RotiVoteFactory.php`, `app/Models/Retro.php`, `app/Http/Controllers/Retros/RetroRotiController.php`, `app/Events/Retros/RotiChanged.php`, `routes/web.php`, `app/Actions/Retros/BuildBoardSnapshot.php` |
| Group names | migration `2026_10_01_130100_add_group_name_to_cards_table`, `app/Models/Card.php`, `app/Http/Controllers/Retros/CardGroupNamesController.php`, `app/Events/Retros/CardGroupNamed.php`, `app/Actions/Retros/PresentCard.php`, `app/Actions/Retros/GroupCard.php`, `app/Actions/Retros/PlaceCard.php`, `app/Http/Controllers/Retros/CardsController.php`, `routes/web.php` |
| Results read model | `app/Actions/Retros/BuildResults.php`, `app/Actions/Retros/BuildBoardSnapshot.php` |
| Frontend core | `resources/js/lib/retro/types.ts`, `resources/js/lib/retro/board-reducer.ts`, `resources/js/hooks/use-retro-channel.ts`, `resources/js/hooks/use-retro-board.ts` |
| Frontend UI | `resources/js/components/retro/group-name.tsx`, `retro-card.tsx`, `presentation-overlay.tsx`, `roti-control.tsx`, `action-items-panel.tsx`, `board.tsx`, `results/{results-view,results-section,completed-tabs,participants-section,health-section,health-radar,health-trend,survey-result,top-topics,action-items-results,roti-section}.tsx`; delete `completed-summary.tsx` |
| Tests | `tests/Feature/Retros/RetroCompletedTest.php`, `RotiTest.php`, `GroupNamesTest.php`, `ResultsTest.php` |
| Translations | `lang/{en,fr,es,de}.json` |

---

### Task 1: `RetroCompleted` and `results.changed`

**Files:**
- Create: `app/Events/RetroCompleted.php`, `app/Events/Retros/ResultsChanged.php`
- Modify: `app/Actions/Retros/ChangeRetroPhase.php`
- Test: create `tests/Feature/Retros/RetroCompletedTest.php`

**Interfaces:**
- Consumes: `ChangeRetroPhase::handle(Retro $locked, RetroPhase $phase): void` (Plan 8a).
- Produces: `App\Events\RetroCompleted` (`public Retro $retro`, implements `ShouldDispatchAfterCommit`), dispatched once per transition into `Completed`; `App\Events\Retros\ResultsChanged` (`new ResultsChanged(string $retroId)`, `broadcastAs(): 'results.changed'`, payload `[]`) — used by Plan 8e and spec 6.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Retros/RetroCompletedTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\RetroCompleted;
use App\Events\Retros\ResultsChanged;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('dispatches RetroCompleted once per transition into completed', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroFacilitator($retro);
    $phaseRoute = route('retros.phase.update', $retro);

    $this->actingAs($user)->putJson($phaseRoute, ['phase' => 'completed'])->assertOk();

    Event::assertDispatchedTimes(RetroCompleted::class, 1);
    Event::assertDispatched(RetroCompleted::class, fn (RetroCompleted $event) => $event->retro->is($retro));

    $this->actingAs($user)->putJson($phaseRoute, ['phase' => 'discussing'])->assertOk();
    $this->actingAs($user)->putJson($phaseRoute, ['phase' => 'completed'])->assertOk();

    Event::assertDispatchedTimes(RetroCompleted::class, 2);
});

it('does not dispatch RetroCompleted on other phase changes', function () {
    $retro = Retro::factory()->create();
    [$user] = retroFacilitator($retro);
    $phaseRoute = route('retros.phase.update', $retro);

    foreach (['grouping', 'voting', 'discussing', 'voting'] as $phase) {
        $this->actingAs($user)->putJson($phaseRoute, ['phase' => $phase])->assertOk();
    }

    Event::assertNotDispatched(RetroCompleted::class);
});

it('broadcasts an empty results refresh', function () {
    $event = new ResultsChanged('retro-id');

    expect($event->broadcastAs())->toBe('results.changed')
        ->and($event->broadcastWith())->toBe([])
        ->and($event->broadcastOn()->name)->toBe('presence-retro.retro-id');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/RetroCompletedTest.php`
Expected: FAIL with "Class "App\Events\RetroCompleted" not found".

- [ ] **Step 3: Create the events**

`app/Events/RetroCompleted.php`:

```php
<?php

namespace App\Events;

use App\Models\Retro;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RetroCompleted implements ShouldDispatchAfterCommit
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public Retro $retro) {}
}
```

`app/Events/Retros/ResultsChanged.php`:

```php
<?php

namespace App\Events\Retros;

class ResultsChanged extends RetroBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'results.changed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
```

- [ ] **Step 4: Dispatch from `ChangeRetroPhase`**

In `app/Actions/Retros/ChangeRetroPhase.php` (8a steps plus 8c's `closeSurveys` step and constructor), add `use App\Events\RetroCompleted;` and replace `handle()` with:

```php
    public function handle(Retro $locked, RetroPhase $phase): void
    {
        $this->ensureReachable($locked, $phase);
        $this->move($locked, $phase);
        $this->closeSurveys($locked, $phase);
        $this->broadcast($locked, $phase);
        $this->announceCompletion($locked, $phase);
    }
```

Add the private step:

```php
    private function announceCompletion(Retro $retro, RetroPhase $phase): void
    {
        if ($phase !== RetroPhase::Completed) {
            return;
        }

        event(new RetroCompleted($retro));
    }
```

`ShouldDispatchAfterCommit` delays listeners until the phase transaction commits, so a rolled-back transition never announces a completion.

- [ ] **Step 5: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/RetroCompletedTest.php tests/Feature/Retros/FacilitationTest.php`
Expected: PASS.

- [ ] **Step 6: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Events/RetroCompleted.php app/Events/Retros/ResultsChanged.php app/Actions/Retros/ChangeRetroPhase.php tests/Feature/Retros/RetroCompletedTest.php
git commit -m "feat: announce every retro completion with a RetroCompleted event

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 2: ROTI backend (rating endpoints, broadcast, snapshot `roti`)

**Files:**
- Create: `database/migrations/2026_10_01_130000_create_roti_votes_table.php`, `app/Models/RotiVote.php`, `database/factories/RotiVoteFactory.php`, `app/Http/Controllers/Retros/RetroRotiController.php`, `app/Events/Retros/RotiChanged.php`
- Modify: `app/Models/Retro.php`, `routes/web.php`, `app/Actions/Retros/BuildBoardSnapshot.php`
- Test: create `tests/Feature/Retros/RotiTest.php`

**Interfaces:**
- Produces: table `roti_votes` (`id`, `retro_id`, `participant_id`, `score` 1–5, unique `retro_id`+`participant_id`); `App\Models\RotiVote`; `Retro::rotiVotes(): HasMany`; routes `retros.roti.update` (`PUT /retros/{retro}/roti {score}` → `{myScore, respondents}`) and `retros.roti.destroy` (`DELETE` → `{myScore: null, respondents}`); broadcast `roti.changed {respondents}` (`App\Events\Retros\RotiChanged`); snapshot `roti: {myScore: ?int, respondents: int}`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Retros/RotiTest.php`:

```php
<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\RetroPhase;
use App\Events\Retros\RotiChanged;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function rotiRetro(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user, $participant] = retroMember($retro);

    return [$retro, $user, $participant];
}

it('rates, changes and withdraws the own rating', function () {
    [$retro, $user, $participant] = rotiRetro();

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 4])
        ->assertOk()
        ->assertExactJson(['myScore' => 4, 'respondents' => 1]);
    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 2])
        ->assertOk()
        ->assertExactJson(['myScore' => 2, 'respondents' => 1]);

    expect(RotiVote::sole()->only(['participant_id', 'score']))->toBe(['participant_id' => $participant->id, 'score' => 2]);

    $this->actingAs($user)->deleteJson(route('retros.roti.destroy', $retro))
        ->assertOk()
        ->assertExactJson(['myScore' => null, 'respondents' => 0]);

    expect(RotiVote::count())->toBe(0);
});

it('broadcasts the respondent count and never a score', function () {
    [$retro, $user] = rotiRetro();
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 1]);

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 5])->assertOk();

    Event::assertDispatched(RotiChanged::class, fn (RotiChanged $event) => $event->broadcastAs() === 'roti.changed'
        && $event->broadcastWith() === ['respondents' => 2]);
});

it('accepts ratings in discussing and completed even when locked', function (RetroPhase $phase) {
    [$retro, $user] = rotiRetro($phase, ['is_locked' => true]);

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 3])->assertOk();
    $this->actingAs($user)->deleteJson(route('retros.roti.destroy', $retro))->assertOk();
})->with([RetroPhase::Discussing, RetroPhase::Completed]);

it('refuses ratings in the other phases', function (RetroPhase $phase) {
    [$retro, $user] = rotiRetro($phase);

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 3])->assertForbidden();
    $this->actingAs($user)->deleteJson(route('retros.roti.destroy', $retro))->assertForbidden();
})->with([RetroPhase::HealthCheck, RetroPhase::Icebreaker, RetroPhase::Writing, RetroPhase::Grouping, RetroPhase::Voting]);

it('validates the score', function (mixed $score) {
    [$retro, $user] = rotiRetro();

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => $score])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('score');
})->with([0, 6, 'great', null]);

it('accepts ratings from guests', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCredentials()->withCookies(retroGuestCookie($guest))
        ->putJson(route('retros.roti.update', $retro), ['score' => 5])
        ->assertOk();

    expect(RotiVote::sole()->participant_id)->toBe($guest->id);
});

it('shows only the own score and the respondent count before completion', function () {
    [$retro, , $participant] = rotiRetro();
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'score' => 4]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 1]);

    $snapshot = app(BuildBoardSnapshot::class)->handle($retro->fresh(), $participant);

    expect($snapshot['roti'])->toBe(['myScore' => 4, 'respondents' => 2])
        ->and($snapshot['results'])->toBeNull();
});
```

`$snapshot['results']` is added in Task 5; until then that last test fails on the missing key, which is expected — keep the assertion and let Task 5 turn it green. To keep this task's run green, run it with `--filter` excluding that test in Step 4 (see below).

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/RotiTest.php`
Expected: FAIL with `Route [retros.roti.update] not defined.`

- [ ] **Step 3: Migration, model, factory, relation**

`database/migrations/2026_10_01_130000_create_roti_votes_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roti_votes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('participant_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('score');
            $table->timestamps();

            $table->unique(['retro_id', 'participant_id']);
        });
    }
};
```

`app/Models/RotiVote.php`:

```php
<?php

namespace App\Models;

use Database\Factories\RotiVoteFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $participant_id
 * @property int $score
 */
#[Fillable(['participant_id', 'score'])]
class RotiVote extends Model
{
    /** @use HasFactory<RotiVoteFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    protected function casts(): array
    {
        return ['score' => 'integer'];
    }
}
```

`database/factories/RotiVoteFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RotiVote>
 */
class RotiVoteFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'score' => fake()->numberBetween(1, 5),
        ];
    }
}
```

In `app/Models/Retro.php` add:

```php
    /** @return HasMany<RotiVote, $this> */
    public function rotiVotes(): HasMany
    {
        return $this->hasMany(RotiVote::class);
    }
```

- [ ] **Step 4: Event, controller, routes, snapshot**

`app/Events/Retros/RotiChanged.php`:

```php
<?php

namespace App\Events\Retros;

class RotiChanged extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public int $respondents)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'roti.changed';
    }

    public function broadcastWith(): array
    {
        return ['respondents' => $this->respondents];
    }
}
```

`app/Http/Controllers/Retros/RetroRotiController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\RotiChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RetroRotiController extends Controller
{
    public function update(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $validated = $request->validate([
            'score' => ['required', 'integer', 'between:1,5'],
        ]);

        $score = (int) $validated['score'];

        $respondents = DB::transaction(function () use ($retro, $participant, $score): int {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $locked->rotiVotes()->updateOrCreate(['participant_id' => $participant->id], ['score' => $score]);

            return $this->announce($locked);
        });

        return response()->json(['myScore' => $score, 'respondents' => $respondents]);
    }

    public function destroy(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $respondents = DB::transaction(function () use ($retro, $participant): int {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $locked->rotiVotes()->where('participant_id', $participant->id)->delete();

            return $this->announce($locked);
        });

        return response()->json(['myScore' => null, 'respondents' => $respondents]);
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::phase($retro, RetroPhase::Discussing, RetroPhase::Completed);
    }

    private function announce(Retro $retro): int
    {
        $respondents = $retro->rotiVotes()->count();

        (new RotiChanged($retro->id, $respondents))->sendToOthers();

        return $respondents;
    }
}
```

No `RetroGuard::unlocked()`: ROTI is feedback on the meeting, not board content (spec §6.4).

In `routes/web.php`, add `use App\Http\Controllers\Retros\RetroRotiController;` and inside the `retros/{retro}` group:

```php
        Route::put('roti', [RetroRotiController::class, 'update'])->name('retros.roti.update');
        Route::delete('roti', [RetroRotiController::class, 'destroy'])->name('retros.roti.destroy');
```

In `app/Actions/Retros/BuildBoardSnapshot.php`, add a top-level key after `actionItems`:

```php
            'roti' => $this->roti($retro, $viewer),
```

and the private method (add `use App\Models\RotiVote;` is not needed):

```php
    /**
     * @return array{
     *     myScore: ?int,
     *     respondents: int
     * }
     */
    private function roti(Retro $retro, Participant $viewer): array
    {
        $myScore = $retro->rotiVotes()->where('participant_id', $viewer->id)->value('score');

        return [
            'myScore' => $myScore === null ? null : (int) $myScore,
            'respondents' => $retro->rotiVotes()->count(),
        ];
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/RotiTest.php --filter="rates|broadcasts|accepts|refuses|validates"`
Expected: PASS (the snapshot test is completed by Task 5).

- [ ] **Step 6: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add database/migrations/2026_10_01_130000_create_roti_votes_table.php app/Models/RotiVote.php database/factories/RotiVoteFactory.php app/Models/Retro.php app/Http/Controllers/Retros/RetroRotiController.php app/Events/Retros/RotiChanged.php routes/web.php app/Actions/Retros/BuildBoardSnapshot.php tests/Feature/Retros/RotiTest.php
git commit -m "feat: let participants rate the retro's return on time invested

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 3: Naming groups (endpoint, broadcast, `groupName` redaction)

**Files:**
- Create: `database/migrations/2026_10_01_130100_add_group_name_to_cards_table.php`, `app/Http/Controllers/Retros/CardGroupNamesController.php`, `app/Events/Retros/CardGroupNamed.php`
- Modify: `app/Models/Card.php`, `app/Actions/Retros/PresentCard.php`, `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Retros/GroupNamesTest.php`

**Interfaces:**
- Consumes: `RetroPhase::hidesOthersCards()` (Plan 8a) as already used by `PresentCard`.
- Produces: `cards.group_name` (nullable string 60); `Card::clearGroupNameWhenEmpty(): bool` (clears the name when the card has no grouped card; returns true when it cleared one); routes `retros.cards.group-name.update` (`PUT /retros/{retro}/cards/{card}/group-name {name}`) and `retros.cards.group-name.destroy` (`DELETE`), both → `{cardId, groupName}`; broadcast `card.group-named {cardId, groupName}` (`App\Events\Retros\CardGroupNamed(string $retroId, string $cardId, ?string $groupName)`); `PresentCard` field `groupName: ?string` (`null` on hidden cards).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Retros/GroupNamesTest.php`:

```php
<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\RetroPhase;
use App\Events\Retros\CardGroupNamed;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{0: Retro, 1: User, 2: Card, 3: Participant}
 */
function namedGroupRetro(RetroPhase $phase = RetroPhase::Grouping, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user, $participant] = retroMember($retro);
    $lead = Card::factory()->create(['retro_id' => $retro->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $lead->column_id, 'parent_card_id' => $lead->id]);

    return [$retro, $user, $lead, $participant];
}

it('names and clears a group', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $route = route('retros.cards.group-name.update', [$retro, $lead]);

    $this->actingAs($user)->putJson($route, ['name' => '  Deploys  '])
        ->assertOk()
        ->assertExactJson(['cardId' => $lead->id, 'groupName' => 'Deploys']);

    expect($lead->fresh()->group_name)->toBe('Deploys');
    Event::assertDispatched(CardGroupNamed::class, fn (CardGroupNamed $event) => $event->broadcastAs() === 'card.group-named'
        && $event->broadcastWith() === ['cardId' => $lead->id, 'groupName' => 'Deploys']);

    $this->actingAs($user)->deleteJson(route('retros.cards.group-name.destroy', [$retro, $lead]))
        ->assertOk()
        ->assertExactJson(['cardId' => $lead->id, 'groupName' => null]);

    expect($lead->fresh()->group_name)->toBeNull();
});

it('clears the name when it is blank', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys']);

    $this->actingAs($user)->putJson(route('retros.cards.group-name.update', [$retro, $lead]), ['name' => '   '])
        ->assertOk()
        ->assertJsonPath('groupName', null);

    expect($lead->fresh()->group_name)->toBeNull();
});

it('limits names to 60 characters', function () {
    [$retro, $user, $lead] = namedGroupRetro();

    $this->actingAs($user)->putJson(route('retros.cards.group-name.update', [$retro, $lead]), ['name' => str_repeat('a', 61)])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('name');
});

it('lets guests name groups', function () {
    [$retro, , $lead] = namedGroupRetro(RetroPhase::Grouping, ['guest_access_enabled' => true]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCredentials()->withCookies(retroGuestCookie($guest))
        ->putJson(route('retros.cards.group-name.update', [$retro, $lead]), ['name' => 'Tooling'])
        ->assertOk();

    expect($lead->fresh()->group_name)->toBe('Tooling');
});

it('names groups from grouping to discussing only', function (RetroPhase $phase, int $status) {
    [$retro, $user, $lead] = namedGroupRetro($phase);

    $this->actingAs($user)->putJson(route('retros.cards.group-name.update', [$retro, $lead]), ['name' => 'Deploys'])->assertStatus($status);
})->with([
    'health check' => [RetroPhase::HealthCheck, 403],
    'writing' => [RetroPhase::Writing, 403],
    'grouping' => [RetroPhase::Grouping, 200],
    'voting' => [RetroPhase::Voting, 200],
    'discussing' => [RetroPhase::Discussing, 200],
    'completed' => [RetroPhase::Completed, 403],
]);

it('refuses to name groups on a locked board', function () {
    [$retro, $user, $lead] = namedGroupRetro(RetroPhase::Voting, ['is_locked' => true]);

    $this->actingAs($user)->putJson(route('retros.cards.group-name.update', [$retro, $lead]), ['name' => 'Deploys'])->assertStatus(423);
});

it('refuses to name a card that does not lead a group', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $single = Card::factory()->create(['retro_id' => $retro->id]);
    $child = $lead->children()->sole();

    foreach ([$single, $child] as $card) {
        $this->actingAs($user)->putJson(route('retros.cards.group-name.update', [$retro, $card]), ['name' => 'Deploys'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['card' => 'Only groups can be named.']);
    }

    expect(Card::whereNotNull('group_name')->count())->toBe(0);
});

it('returns 404 for cards of another retro', function () {
    [$retro, $user] = namedGroupRetro();
    [, , $foreignLead] = namedGroupRetro();

    $this->actingAs($user)->putJson(route('retros.cards.group-name.update', [$retro, $foreignLead]), ['name' => 'Deploys'])->assertNotFound();
});

it('hides the name of hidden cards and shows it on anonymous retros', function () {
    [$retro, , $lead, $viewer] = namedGroupRetro(RetroPhase::Writing, ['is_anonymous' => true]);
    $lead->update(['group_name' => 'Deploys']);

    $hidden = collect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['cards'])->firstWhere('id', $lead->id);

    $retro->update(['phase' => RetroPhase::Grouping]);

    $revealed = collect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['cards'])->firstWhere('id', $lead->id);

    expect($hidden['groupName'])->toBeNull()
        ->and($revealed['groupName'])->toBe('Deploys')
        ->and($revealed['author'])->toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/GroupNamesTest.php`
Expected: FAIL with `Route [retros.cards.group-name.update] not defined.`

- [ ] **Step 3: Migration and model**

`database/migrations/2026_10_01_130100_add_group_name_to_cards_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cards', function (Blueprint $table) {
            $table->string('group_name', 60)->nullable();
        });
    }
};
```

In `app/Models/Card.php`: add `@property string|null $group_name` to the docblock, add `'group_name'` to `#[Fillable([...])]`, and add:

```php
    public function clearGroupNameWhenEmpty(): bool
    {
        if ($this->group_name === null) {
            return false;
        }

        if ($this->children()->exists()) {
            return false;
        }

        $this->update(['group_name' => null]);

        return true;
    }
```

- [ ] **Step 4: Presenter**

In `app/Actions/Retros/PresentCard.php`, add `groupName: ?string` to the return array shape (after `author`) and to the returned array:

```php
            'groupName' => $isHidden ? null : $card->group_name,
```

- [ ] **Step 5: Event, controller, routes**

`app/Events/Retros/CardGroupNamed.php`:

```php
<?php

namespace App\Events\Retros;

class CardGroupNamed extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $cardId, public ?string $groupName)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'card.group-named';
    }

    public function broadcastWith(): array
    {
        return ['cardId' => $this->cardId, 'groupName' => $this->groupName];
    }
}
```

`app/Http/Controllers/Retros/CardGroupNamesController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\CardGroupNamed;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CardGroupNamesController extends Controller
{
    public function update(Request $request, Retro $retro, Card $card): JsonResponse
    {
        Participant::current($request);

        $this->guard($retro);

        $validated = $request->validate([
            'name' => ['present', 'nullable', 'string', 'max:60'],
        ]);

        return $this->rename($retro, $card, $validated['name']);
    }

    public function destroy(Request $request, Retro $retro, Card $card): JsonResponse
    {
        Participant::current($request);

        $this->guard($retro);

        return $this->rename($retro, $card, null);
    }

    private function rename(Retro $retro, Card $card, ?string $name): JsonResponse
    {
        DB::transaction(function () use ($retro, $card, $name): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $lead = $locked->cards()->whereKey($card->id)->firstOrFail();

            if (! $lead->isTopLevel() || $lead->children()->doesntExist()) {
                throw ValidationException::withMessages(['card' => __('Only groups can be named.')]);
            }

            $lead->update(['group_name' => $name]);

            (new CardGroupNamed($locked->id, $lead->id, $name))->sendToOthers();
        });

        return response()->json(['cardId' => $card->id, 'groupName' => $name]);
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::phase($retro, RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);
    }
}
```

`TrimStrings` and `ConvertEmptyStringsToNull` run on JSON bodies, so `'  Deploys  '` arrives as `'Deploys'` and `'   '` as `null`.

In `routes/web.php`, add `use App\Http\Controllers\Retros\CardGroupNamesController;` and inside the `retros/{retro}` group, after the `cards/{card}/group` routes:

```php
        Route::put('cards/{card}/group-name', [CardGroupNamesController::class, 'update'])->name('retros.cards.group-name.update')->whereUuid('card');
        Route::delete('cards/{card}/group-name', [CardGroupNamesController::class, 'destroy'])->name('retros.cards.group-name.destroy')->whereUuid('card');
```

- [ ] **Step 6: Translation**

Add to `lang/en.json`, `fr.json`, `es.json`, `de.json` (alphabetical position like the rest of each file):

| Key | fr | es | de |
|---|---|---|---|
| `Only groups can be named.` | `Seuls les groupes peuvent être nommés.` | `Solo se pueden nombrar los grupos.` | `Nur Gruppen können benannt werden.` |

- [ ] **Step 7: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/GroupNamesTest.php tests/Feature/Retros/BoardSnapshotTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 8: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add database/migrations/2026_10_01_130100_add_group_name_to_cards_table.php app/Models/Card.php app/Actions/Retros/PresentCard.php app/Events/Retros/CardGroupNamed.php app/Http/Controllers/Retros/CardGroupNamesController.php routes/web.php lang tests/Feature/Retros/GroupNamesTest.php
git commit -m "feat: let participants name card groups

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 4: Group-name lifecycle (grouping, ungrouping, moving out, deleting)

**Files:**
- Modify: `app/Actions/Retros/GroupCard.php`, `app/Actions/Retros/PlaceCard.php`, `app/Http/Controllers/Retros/CardsController.php`
- Test: `tests/Feature/Retros/GroupNamesTest.php`

**Interfaces:**
- Consumes: `Card::clearGroupNameWhenEmpty(): bool`, `CardGroupNamed` (Task 3).
- Produces: `GroupCard::group()` returns the moved cards plus the lead with names already transferred; `GroupCard::ungroup()` now returns `collect([$card, $formerLead])` so `card.ungrouped` carries the lead's updated name; `PlaceCard::handle()` includes the former lead in its changed cards when it cleared its name.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Feature/Retros/GroupNamesTest.php` (add `use App\Events\Retros\CardGrouped;` and `use App\Events\Retros\CardUngrouped;`):

```php
it('moves the name to the target when it has none', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys']);
    $target = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->putJson(route('retros.cards.group.update', [$retro, $lead]), ['parent_card_id' => $target->id])
        ->assertOk()
        ->assertJsonFragment(['id' => $target->id, 'groupName' => 'Deploys']);

    expect($target->fresh()->group_name)->toBe('Deploys')
        ->and($lead->fresh()->group_name)->toBeNull();
    Event::assertDispatched(CardGrouped::class, fn (CardGrouped $event) => collect($event->cards)->firstWhere('id', $target->id)['groupName'] === 'Deploys');
});

it('keeps the target name when both groups are named', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $target = Card::factory()->create(['retro_id' => $retro->id, 'group_name' => 'Tooling']);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $target->column_id, 'parent_card_id' => $target->id]);
    $lead->update(['group_name' => 'Deploys']);

    $this->actingAs($user)->putJson(route('retros.cards.group.update', [$retro, $lead]), ['parent_card_id' => $target->id])->assertOk();

    expect($target->fresh()->group_name)->toBe('Tooling')
        ->and(Card::where('group_name', 'Deploys')->exists())->toBeFalse();
});

it('clears the name when the last grouped card is ungrouped', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys']);
    $child = $lead->children()->sole();

    $this->actingAs($user)->deleteJson(route('retros.cards.group.destroy', [$retro, $child]))
        ->assertOk()
        ->assertJsonFragment(['id' => $lead->id, 'groupName' => null]);

    expect($lead->fresh()->group_name)->toBeNull();
    Event::assertDispatched(CardUngrouped::class, fn (CardUngrouped $event) => collect($event->cards)->contains('id', $lead->id));
});

it('keeps the name while grouped cards remain', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys']);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $lead->column_id, 'parent_card_id' => $lead->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.group.destroy', [$retro, $lead->children()->first()]))->assertOk();

    expect($lead->fresh()->group_name)->toBe('Deploys');
});

it('clears the name when the last grouped card is moved out', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys']);
    $child = $lead->children()->sole();

    $this->actingAs($user)->putJson(route('retros.cards.position.update', [$retro, $child]), ['column_id' => $lead->column_id, 'index' => 0])
        ->assertOk()
        ->assertJsonFragment(['id' => $lead->id, 'groupName' => null]);

    expect($lead->fresh()->group_name)->toBeNull();
});

it('clears the name when the last grouped card is deleted', function () {
    [$retro, $user, $lead, $participant] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys']);
    $lead->children()->sole()->update(['participant_id' => $participant->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.destroy', [$retro, $lead->children()->sole()]))->assertNoContent();

    expect($lead->fresh()->group_name)->toBeNull();
    Event::assertDispatched(CardGroupNamed::class, fn (CardGroupNamed $event) => $event->cardId === $lead->id && $event->groupName === null);
});

it('leaves no name behind when the named lead is deleted', function () {
    [$retro, $user, $lead, $participant] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys', 'participant_id' => $participant->id]);
    $child = $lead->children()->sole();

    $this->actingAs($user)->deleteJson(route('retros.cards.destroy', [$retro, $lead]))->assertNoContent();

    expect($child->fresh()->only(['parent_card_id', 'group_name']))->toBe(['parent_card_id' => null, 'group_name' => null])
        ->and(Card::whereNotNull('group_name')->exists())->toBeFalse();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/GroupNamesTest.php`
Expected: FAIL — "moves the name to the target" (target name null), "clears the name when …" (name still `Deploys`).

- [ ] **Step 3: `GroupCard`**

Replace the body of `group()` after the two guard `if`s with:

```php
        $movedName = $card->group_name;
        $movedCards = $card->children()->get()->push($card);

        Vote::query()->whereIn('card_id', $movedCards->pluck('id'))->update(['card_id' => $lead->id]);

        foreach ($movedCards as $moved) {
            $moved->update([
                'parent_card_id' => $lead->id,
                'column_id' => $lead->column_id,
                'group_name' => null,
            ]);
        }

        if ($lead->group_name === null && $movedName !== null) {
            $lead->update(['group_name' => $movedName]);
        }

        return $movedCards->push($lead);
```

Replace the body of `ungroup()` after its guard with:

```php
        $formerLead = $card->parent()->firstOrFail();

        $lastPosition = Card::query()
            ->where('column_id', $card->column_id)
            ->whereNull('parent_card_id')
            ->max('position');

        $card->update([
            'parent_card_id' => null,
            'position' => $lastPosition === null ? 0 : $lastPosition + 1,
        ]);

        $formerLead->clearGroupNameWhenEmpty();

        return collect([$card, $formerLead]);
```

- [ ] **Step 4: `PlaceCard`**

At the top of `handle()` (before `if (! $card->isTopLevel())`):

```php
        $formerLead = $card->isTopLevel() ? null : $card->parent()->first();
```

Just before the final `return`:

```php
        if ($formerLead !== null && $formerLead->clearGroupNameWhenEmpty()) {
            $changed->push($formerLead);
        }
```

- [ ] **Step 5: `CardsController::destroy`**

Inside the transaction, right after `RetroGuard::author($card, $participant);`, add:

```php
            $formerLeadId = $card->parent_card_id;
```

After `(new CardDeleted($locked->id, $card->id, $ungroupedCards))->sendToOthers();` add:

```php
            $formerLead = $formerLeadId === null ? null : $locked->cards()->whereKey($formerLeadId)->first();

            if ($formerLead !== null && $formerLead->clearGroupNameWhenEmpty()) {
                (new CardGroupNamed($locked->id, $formerLead->id, null))->sendToOthers();
            }
```

and `use App\Events\Retros\CardGroupNamed;`. A deleted lead takes its name with it; its children become top-level cards without a name (existing rule), so no group remains.

- [ ] **Step 6: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/GroupNamesTest.php tests/Feature/Retros/GroupingTest.php tests/Feature/Retros/CardsTest.php`
Expected: PASS.

- [ ] **Step 7: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Retros/GroupCard.php app/Actions/Retros/PlaceCard.php app/Http/Controllers/Retros/CardsController.php tests/Feature/Retros/GroupNamesTest.php
git commit -m "feat: keep group names with their group when cards move

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 5: Results read model and snapshot `results`

**Files:**
- Create: `app/Actions/Retros/BuildResults.php`
- Modify: `app/Actions/Retros/BuildBoardSnapshot.php`
- Test: create `tests/Feature/Retros/ResultsTest.php`; `tests/Feature/Retros/RotiTest.php` (its snapshot test now passes)

**Interfaces:**
- Consumes: `SummarizeHealthCheck::handle(Retro $retro): ?array`, `BuildHealthTrend::forViewer(Retro $retro, Participant $viewer): ?array` (8b; null for guests, calls `handle()` otherwise), `PresentSurvey::many(Retro $retro, Participant $viewer): array` (8c), `Retro::rotiVotes()` (Task 2).
- Produces: `App\Actions\Retros\BuildResults::handle(Retro $retro, Participant $viewer): ?array` → `null` unless `Completed`, else `{participants: [{id, name, avatarUrl, isGuest}], health: ?array, healthTrend: ?array, surveys: array, games: null, roti: {distribution: [{score, count}] (scores 1–5), average: ?float, respondents: int}, summary: null}`; snapshot key `results`. Plan 8e fills `summary`; spec 7's plan fills `games`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Retros/ResultsTest.php`:

```php
<?php

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use Illuminate\Support\Facades\DB;

function resultsOf(Retro $retro, Participant $viewer): ?array
{
    return app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['results'];
}

function fakeHealthSummary(): array
{
    return [
        'statements' => [['key' => 'vision', 'label' => 'Vision', 'text' => 'The vision is clear', 'isBuiltin' => true, 'average' => 7.5, 'count' => 2]],
        'score' => 7.5,
        'participation' => ['respondents' => 2, 'participants' => 3],
        'topStrength' => null,
        'growthArea' => null,
        'alignment' => ['value' => 9, 'level' => 'high', 'label' => 'High team consensus'],
        'assessment' => ['band' => 'good', 'title' => 'Good', 'sentence' => 'Keep the momentum going.'],
    ];
}

it('only builds results once the retro is completed', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    [, $viewer] = retroMember($retro);

    expect(resultsOf($retro, $viewer))->toBeNull();
})->with([RetroPhase::Writing, RetroPhase::Voting, RetroPhase::Discussing]);

it('lists every participant and leaves games and summary empty', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->anonymous()->create();
    [, $viewer] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $results = resultsOf($retro, $viewer);

    expect(collect($results['participants'])->pluck('id')->sort()->values()->all())->toBe(collect([$viewer->id, $guest->id])->sort()->values()->all())
        ->and(collect($results['participants'])->firstWhere('id', $guest->id))->toMatchArray(['name' => $guest->guest_name, 'isGuest' => true])
        ->and($results['games'])->toBeNull()
        ->and($results['summary'])->toBeNull();
});

it('reports the roti distribution and average from the first rating', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [, $viewer] = retroMember($retro);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 4]);

    expect(resultsOf($retro, $viewer)['roti'])->toBe([
        'distribution' => [
            ['score' => 1, 'count' => 0],
            ['score' => 2, 'count' => 0],
            ['score' => 3, 'count' => 0],
            ['score' => 4, 'count' => 1],
            ['score' => 5, 'count' => 0],
        ],
        'average' => 4.0,
        'respondents' => 1,
    ]);

    RotiVote::factory()->count(2)->create(['retro_id' => $retro->id, 'score' => 5]);

    expect(resultsOf($retro, $viewer)['roti']['average'])->toBe(4.7);
});

it('has no roti average without ratings', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [, $viewer] = retroMember($retro);

    expect(resultsOf($retro, $viewer)['roti'])->toMatchArray(['average' => null, 'respondents' => 0]);
});

it('adds the health summary and the team trend for members', function () {
    $trend = [['retroId' => 'r1', 'title' => 'Retro 1', 'completedAt' => '2026-09-01T10:00:00+00:00', 'score' => 7.5, 'url' => '/retros/r1', 'delta' => null, 'sameStatements' => true]];
    $this->mock(SummarizeHealthCheck::class)->shouldReceive('handle')->andReturn(fakeHealthSummary());
    $this->partialMock(BuildHealthTrend::class, fn ($mock) => $mock->shouldReceive('handle')->andReturn($trend));
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [, $viewer] = retroMember($retro);

    $results = resultsOf($retro, $viewer);

    expect($results['health'])->toBe(fakeHealthSummary())
        ->and($results['healthTrend'])->toBe($trend);
});

it('hides the health trend from guests', function () {
    $this->mock(SummarizeHealthCheck::class)->shouldReceive('handle')->andReturn(fakeHealthSummary());
    $this->partialMock(BuildHealthTrend::class, fn ($mock) => $mock->shouldNotReceive('handle'));
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $results = resultsOf($retro, $guest);

    expect($results['health'])->toBe(fakeHealthSummary())
        ->and($results['healthTrend'])->toBeNull();
});

it('has no health section or trend without health answers', function () {
    $this->mock(SummarizeHealthCheck::class)->shouldReceive('handle')->andReturn(null);
    $this->partialMock(BuildHealthTrend::class, fn ($mock) => $mock->shouldNotReceive('handle'));
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [, $viewer] = retroMember($retro);

    expect(resultsOf($retro, $viewer))->toMatchArray(['health' => null, 'healthTrend' => null]);
});

it('keeps the query count constant as ratings and participants grow', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [, $viewer] = retroMember($retro);
    RotiVote::factory()->create(['retro_id' => $retro->id]);

    $count = function () use ($retro, $viewer): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        resultsOf($retro, $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $few = $count();

    RotiVote::factory()->count(6)->create(['retro_id' => $retro->id]);

    expect($count())->toBe($few);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/ResultsTest.php`
Expected: FAIL with `Undefined array key "results"`.

- [ ] **Step 3: Implement `BuildResults`**

`app/Actions/Retros/BuildResults.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Actions\Surveys\PresentSurvey;
use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\Retro;

class BuildResults
{
    public function __construct(
        private SummarizeHealthCheck $summarizeHealthCheck,
        private BuildHealthTrend $buildHealthTrend,
        private PresentSurvey $presentSurvey,
    ) {}

    /**
     * @return array{
     *     participants: array<int, array{id: string, name: string, avatarUrl: string, isGuest: bool}>,
     *     health: ?array<string, mixed>,
     *     healthTrend: ?array<int, array<string, mixed>>,
     *     surveys: array<int, array<string, mixed>>,
     *     games: null,
     *     roti: array{distribution: array<int, array{score: int, count: int}>, average: ?float, respondents: int},
     *     summary: null
     * }|null
     */
    public function handle(Retro $retro, Participant $viewer): ?array
    {
        if ($retro->phase !== RetroPhase::Completed) {
            return null;
        }

        $retro->loadMissing('participants.user');

        $health = $this->summarizeHealthCheck->handle($retro);

        return [
            'participants' => $retro->participants->map(fn (Participant $participant) => [
                'id' => $participant->id,
                'name' => $participant->displayName(),
                'avatarUrl' => $participant->avatarUrl(),
                'isGuest' => $participant->isGuest(),
            ])->values()->all(),
            'health' => $health,
            'healthTrend' => $health === null ? null : $this->buildHealthTrend->forViewer($retro, $viewer),
            'surveys' => $this->presentSurvey->many($retro, $viewer),
            'games' => null,
            'roti' => $this->roti($retro),
            'summary' => null,
        ];
    }

    /**
     * @return array{
     *     distribution: array<int, array{score: int, count: int}>,
     *     average: ?float,
     *     respondents: int
     * }
     */
    private function roti(Retro $retro): array
    {
        $totals = $retro->rotiVotes()
            ->selectRaw('score, count(*) as total')
            ->groupBy('score')
            ->pluck('total', 'score')
            ->mapWithKeys(fn (mixed $total, int|string $score) => [(int) $score => (int) $total]);

        $respondents = (int) $totals->sum();
        $weighted = $totals->map(fn (int $total, int $score) => $score * $total)->sum();

        return [
            'distribution' => collect(range(1, 5))
                ->map(fn (int $score) => ['score' => $score, 'count' => $totals->get($score, 0)])
                ->all(),
            'average' => $respondents === 0 ? null : round($weighted / $respondents, 1),
            'respondents' => $respondents,
        ];
    }
}
```

- [ ] **Step 4: Add `results` to the snapshot**

In `BuildBoardSnapshot`, inject `private BuildResults $buildResults,` in the constructor and add the key after `roti`:

```php
            'results' => $this->buildResults->handle($retro, $viewer),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/ResultsTest.php tests/Feature/Retros/RotiTest.php tests/Feature/Retros/BoardSnapshotTest.php`
Expected: PASS (including the RotiTest snapshot test left open in Task 2).

- [ ] **Step 6: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Retros/BuildResults.php app/Actions/Retros/BuildBoardSnapshot.php tests/Feature/Retros/ResultsTest.php
git commit -m "feat: build the results of completed retros into the board snapshot

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 6: Frontend foundation — types, reducer, events, debounced refetch

**Files:**
- Modify: `resources/js/lib/retro/types.ts`, `resources/js/lib/retro/board-reducer.ts`, `resources/js/hooks/use-retro-channel.ts`, `resources/js/hooks/use-retro-board.ts`
- Generated: `resources/js/actions/**`, `resources/js/routes/**` (Wayfinder)

**Interfaces:**
- Consumes: snapshot keys `roti`, `results`, card `groupName` (Tasks 2–5); type `SurveyPayload` (8c).
- Produces (TypeScript): `CardPayload.groupName: string | null`; types `HealthStatementResult`, `HealthHighlight`, `HealthResults`, `HealthTrendPoint`, `RotiResults`, `Results`, `RotiState`; `Snapshot.roti: RotiState`, `Snapshot.results: Results | null`; reducer actions `{ type: 'roti.set'; respondents: number; myScore?: number | null }` and `{ type: 'card.groupName'; cardId: string; groupName: string | null }`; board events `card.group-named`, `roti.changed`, `results.changed`.

- [ ] **Step 1: Regenerate Wayfinder**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form`
Expected: `resources/js/actions/App/Http/Controllers/Retros/RetroRotiController.ts` and `CardGroupNamesController.ts` exist.

- [ ] **Step 2: Types**

In `resources/js/lib/retro/types.ts`, add `groupName: string | null;` to `CardPayload` (after `author`), then add:

```ts
export type HealthStatementResult = {
    key: string;
    label: string;
    text: string;
    isBuiltin: boolean;
    average: number | null;
    count: number;
};

export type HealthHighlight = { key: string; label: string; average: number };

export type HealthResults = {
    statements: HealthStatementResult[];
    score: number;
    participation: { respondents: number; participants: number };
    topStrength: HealthHighlight | null;
    growthArea: HealthHighlight | null;
    alignment: {
        value: number;
        level: 'high' | 'moderate' | 'divided';
        label: string;
    };
    assessment: {
        band: 'excellent' | 'good' | 'needs_attention' | 'critical';
        title: string;
        sentence: string;
    };
};

export type HealthTrendPoint = {
    retroId: string;
    title: string;
    completedAt: string;
    score: number;
    url: string;
    delta: number | null;
    sameStatements: boolean;
};

export type RotiResults = {
    distribution: Array<{ score: number; count: number }>;
    average: number | null;
    respondents: number;
};

export type RotiState = { myScore: number | null; respondents: number };

export type Results = {
    participants: BoardParticipant[];
    health: HealthResults | null;
    healthTrend: HealthTrendPoint[] | null;
    surveys: SurveyPayload[];
    games: null;
    roti: RotiResults;
    summary: null;
};
```

and in `Snapshot` add:

```ts
    roti: RotiState;
    results: Results | null;
```

- [ ] **Step 3: Reducer**

In `resources/js/lib/retro/board-reducer.ts`, extend `BoardAction`:

```ts
    | { type: 'roti.set'; respondents: number; myScore?: number | null }
    | { type: 'card.groupName'; cardId: string; groupName: string | null }
```

and add the cases to `boardReducer`:

```ts
        case 'roti.set':
            return {
                ...state,
                roti: {
                    myScore:
                        action.myScore === undefined
                            ? state.roti.myScore
                            : action.myScore,
                    respondents: action.respondents,
                },
            };
        case 'card.groupName':
            return updateCard(state, action.cardId, (card) => ({
                ...card,
                groupName: action.groupName,
            }));
```

- [ ] **Step 4: Channel events**

In `resources/js/hooks/use-retro-channel.ts`, append to `RetroEvents`:

```ts
    'card.group-named',
    'roti.changed',
    'results.changed',
```

- [ ] **Step 5: Board hook**

In `resources/js/hooks/use-retro-board.ts`: import `useEffect`; add near the top of the module `const DebouncedRefetchMs = 1_000;`. After `refetch` is defined, add:

```ts
    const pendingRefetch = useRef<ReturnType<typeof setTimeout> | null>(null);

    /**
     * Several viewers rating or a summary finishing produce bursts of
     * events; one snapshot a second later covers them all.
     */
    const scheduleRefetch = useCallback(() => {
        if (pendingRefetch.current !== null) {
            return;
        }

        pendingRefetch.current = setTimeout(() => {
            pendingRefetch.current = null;
            void refetch();
        }, DebouncedRefetchMs);
    }, [refetch]);

    useEffect(
        () => () => {
            if (pendingRefetch.current !== null) {
                clearTimeout(pendingRefetch.current);
            }
        },
        [],
    );
```

Add to the `switch (name)` in `onEvent` and `scheduleRefetch` to its dependency list:

```ts
                case 'card.group-named':
                    apply({
                        type: 'card.groupName',
                        cardId: payload.cardId as string,
                        groupName: payload.groupName as string | null,
                    });
                    break;
                case 'roti.changed':
                    apply({
                        type: 'roti.set',
                        respondents: payload.respondents as number,
                    });

                    if (latestBoard.current.retro.phase === 'completed') {
                        scheduleRefetch();
                    }
                    break;
                case 'results.changed':
                    scheduleRefetch();
                    break;
```

- [ ] **Step 6: Type-check and lint**

Run: `npm run types:check && npm run check`
Expected: PASS apart from the known pre-existing failures. `completed-summary.tsx` still compiles (it does not read the new fields).

- [ ] **Step 7: Format and commit**

```bash
npx vp fmt resources/js/lib/retro/types.ts resources/js/lib/retro/board-reducer.ts resources/js/hooks/use-retro-channel.ts resources/js/hooks/use-retro-board.ts
git add resources/js/lib/retro resources/js/hooks resources/js/actions resources/js/routes
git commit -m "feat: receive results, roti and group names on the board

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 7: Group name editor on groups and in presentation mode

**Files:**
- Create: `resources/js/components/retro/group-name.tsx`
- Modify: `resources/js/components/retro/retro-card.tsx`, `resources/js/components/retro/presentation-overlay.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: `CardGroupNamesController.update/destroy` (Wayfinder), reducer action `card.groupName` (Task 6).
- Produces: `GroupName({ card }: { card: BoardCard })` component.

- [ ] **Step 1: Create the editor**

`resources/js/components/retro/group-name.tsx`:

```tsx
import { Pencil } from 'lucide-react';
import { useRef, useState } from 'react';
import CardGroupNamesController from '@/actions/App/Http/Controllers/Retros/CardGroupNamesController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard, RetroPhase } from '@/lib/retro/types';
import { useBoard } from './board-context';

const NamingPhases: RetroPhase[] = ['grouping', 'voting', 'discussing'];

type GroupNameResponse = { cardId: string; groupName: string | null };

export function GroupName({ card }: { card: BoardCard }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const settled = useRef(false);
    const canName =
        ctx.isEditable && NamingPhases.includes(ctx.board.retro.phase);

    if (!canName && card.groupName === null) {
        return null;
    }

    const save = async (name: string) => {
        if (busy || name === (card.groupName ?? '')) {
            return;
        }

        const groupName = name === '' ? null : name;
        const route = { retro: ctx.board.retro.id, card: card.id };

        setBusy(true);
        ctx.apply({ type: 'card.groupName', cardId: card.id, groupName });

        const response = await ctx.run(
            groupName === null
                ? retroRequest<GroupNameResponse>(
                      CardGroupNamesController.destroy(route),
                  )
                : retroRequest<GroupNameResponse>(
                      CardGroupNamesController.update(route),
                      { name: groupName },
                  ),
        );

        setBusy(false);

        if (response) {
            ctx.apply({
                type: 'card.groupName',
                cardId: response.cardId,
                groupName: response.groupName,
            });
        }
    };

    const startEditing = () => {
        settled.current = false;
        setDraft(card.groupName ?? '');
        setEditing(true);
    };

    const finishEditing = (keeps: boolean) => {
        if (settled.current) {
            return;
        }

        settled.current = true;
        setEditing(false);

        if (keeps) {
            void save(draft.trim());
        }
    };

    if (editing) {
        return (
            <Input
                autoFocus
                value={draft}
                maxLength={60}
                aria-label={t('Group name')}
                className="mb-2 h-8 font-semibold"
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => finishEditing(true)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        finishEditing(true);
                    }

                    if (event.key === 'Escape') {
                        finishEditing(false);
                    }
                }}
            />
        );
    }

    if (!canName) {
        return <p className="mb-2 font-semibold">{card.groupName}</p>;
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            className="mb-2 h-auto w-full justify-start px-1 py-0.5 text-left font-semibold"
            aria-label={card.groupName ? t('Rename group') : undefined}
            disabled={busy}
            onClick={startEditing}
        >
            {card.groupName ?? (
                <span className="font-normal text-muted-foreground italic">
                    {t('Name this group')}
                </span>
            )}
            <Pencil className="ml-auto size-3.5 text-muted-foreground" />
        </Button>
    );
}
```

A failed request goes through `ctx.run`, which toasts the translated error and refetches, rolling back the optimistic name (spec §14).

- [ ] **Step 2: Show it on groups**

In `resources/js/components/retro/retro-card.tsx`: import `GroupName` from `./group-name`; before `return (` add

```tsx
    const groupedCards = isChild ? [] : childrenOf(ctx.board.cards, card.id);
```

insert as the first child of `<article>` (before the `{editing ? (` block):

```tsx
            {groupedCards.length > 0 && !card.hidden && (
                <GroupName card={card} />
            )}
```

and replace the trailing `{!isChild && childrenOf(ctx.board.cards, card.id).map((child) => (` with `{groupedCards.map((child) => (`.

- [ ] **Step 3: Show it in presentation mode**

In `resources/js/components/retro/presentation-overlay.tsx`, right after the `<DialogTitle className="sr-only">…</DialogTitle>`:

```tsx
                {card.groupName && (
                    <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                        {card.groupName}
                    </p>
                )}
```

- [ ] **Step 4: Translations**

Add missing keys to `lang/{en,fr,es,de}.json`:

| Key | fr | es | de |
|---|---|---|---|
| `Name this group` | `Nommer ce groupe` | `Nombrar este grupo` | `Diese Gruppe benennen` |
| `Group name` | `Nom du groupe` | `Nombre del grupo` | `Gruppenname` |
| `Rename group` | `Renommer le groupe` | `Renombrar grupo` | `Gruppe umbenennen` |

- [ ] **Step 5: Checks**

Run: `npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS (known pre-existing lint failures only).

- [ ] **Step 6: Format and commit**

```bash
npx vp fmt resources/js/components/retro/group-name.tsx resources/js/components/retro/retro-card.tsx resources/js/components/retro/presentation-overlay.tsx
git add resources/js/components/retro lang
git commit -m "feat: name card groups inline and show names while presenting

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 8: ROTI control in Discussing

**Files:**
- Create: `resources/js/components/retro/roti-control.tsx`
- Modify: `resources/js/components/retro/action-items-panel.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: `RetroRotiController.update/destroy`, reducer action `roti.set`.
- Produces: `RotiControl()` component (reads `board.roti`), `RotiLabels: readonly string[]` (translation keys for scores 1–5, index = score − 1).

- [ ] **Step 1: Create the control**

`resources/js/components/retro/roti-control.tsx`:

```tsx
import { useState } from 'react';
import RetroRotiController from '@/actions/App/Http/Controllers/Retros/RetroRotiController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { RotiState } from '@/lib/retro/types';
import { useBoard } from './board-context';

export const RotiLabels = [
    'Time wasted',
    'Not really worth it',
    'Break-even',
    'Good use of time',
    'Excellent use of time',
] as const;

export function RotiControl() {
    const ctx = useBoard();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { myScore, respondents } = ctx.board.roti;
    const retroId = ctx.board.retro.id;

    const rate = async (score: number) => {
        if (busy) {
            return;
        }

        setBusy(true);

        const response = await ctx.run(
            score === myScore
                ? retroRequest<RotiState>(RetroRotiController.destroy(retroId))
                : retroRequest<RotiState>(RetroRotiController.update(retroId), {
                      score,
                  }),
        );

        setBusy(false);

        if (!response) {
            return;
        }

        ctx.apply({
            type: 'roti.set',
            myScore: response.myScore,
            respondents: response.respondents,
        });

        if (ctx.board.retro.phase === 'completed') {
            await ctx.refetch();
        }
    };

    return (
        <div className="space-y-2">
            <p className="text-sm font-semibold">{t('How was this retro?')}</p>
            <div
                role="group"
                aria-label={t('How was this retro?')}
                className="grid grid-cols-5 gap-1"
            >
                {RotiLabels.map((label, index) => {
                    const score = index + 1;

                    return (
                        <Button
                            key={label}
                            size="sm"
                            variant={myScore === score ? 'default' : 'outline'}
                            className="h-auto flex-col gap-0.5 px-1 py-1.5 text-[11px] leading-tight whitespace-normal"
                            aria-pressed={myScore === score}
                            disabled={busy}
                            onClick={() => void rate(score)}
                        >
                            <span className="text-sm font-semibold">
                                {score}
                            </span>
                            {t(label)}
                        </Button>
                    );
                })}
            </div>
            <p className="text-xs text-muted-foreground">
                {t(respondents === 1 ? ':count rating' : ':count ratings', {
                    count: respondents,
                })}
            </p>
        </div>
    );
}
```

Clicking the selected score again withdraws the rating. The control ignores `ctx.isEditable`: the lock does not apply to ROTI (spec §6.4).

- [ ] **Step 2: Place it under the action items**

In `resources/js/components/retro/action-items-panel.tsx`, import `RotiControl` from `./roti-control` and add as the last child of the `<aside>` returned by `ActionItemsPanel`:

```tsx
            <div className="border-t pt-3">
                <RotiControl />
            </div>
```

- [ ] **Step 3: Translations**

| Key | fr | es | de |
|---|---|---|---|
| `How was this retro?` | `Comment était cette rétro ?` | `¿Qué tal esta retro?` | `Wie war diese Retro?` |
| `Time wasted` | `Temps perdu` | `Tiempo perdido` | `Zeitverschwendung` |
| `Not really worth it` | `Pas vraiment utile` | `No mereció mucho la pena` | `Hat sich kaum gelohnt` |
| `Break-even` | `Ni gagné ni perdu` | `Ni ganado ni perdido` | `Ausgeglichen` |
| `Good use of time` | `Temps bien utilisé` | `Buen uso del tiempo` | `Gut genutzte Zeit` |
| `Excellent use of time` | `Temps très bien utilisé` | `Uso excelente del tiempo` | `Hervorragend genutzte Zeit` |
| `:count rating` | `:count note` | `:count valoración` | `:count Bewertung` |
| `:count ratings` | `:count notes` | `:count valoraciones` | `:count Bewertungen` |

`RotiLabels` is passed to `t()` through a variable, which `TranslationKeysTest` cannot see (same as `PhaseLabels`); the keys must still be added.

- [ ] **Step 4: Checks, format, commit**

```bash
npm run types:check && npm run check
vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php
npx vp fmt resources/js/components/retro/roti-control.tsx resources/js/components/retro/action-items-panel.tsx
git add resources/js/components/retro lang
git commit -m "feat: ask how the retro was under the action items

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 9: Charts — `HealthRadar` and `HealthTrend`

**Files:**
- Create: `resources/js/components/retro/results/health-radar.tsx`, `resources/js/components/retro/results/health-trend.tsx`
- Modify: `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: `HealthStatementResult`, `HealthTrendPoint` (Task 6).
- Produces: `HealthRadar({ statements }: { statements: HealthStatementResult[] })`, `HealthTrend({ points }: { points: HealthTrendPoint[] })`, `formatScore(score: number): string`.

- [ ] **Step 1: Radar**

`resources/js/components/retro/results/health-radar.tsx`:

```tsx
import { useTrans } from '@/hooks/use-trans';
import type { HealthStatementResult } from '@/lib/retro/types';

const ViewBoxSize = 320;
const Center = ViewBoxSize / 2;
const Radius = 100;
const LabelRadius = 118;
const Rings = [2.5, 5, 7.5, 10];

type Point = { x: number; y: number };

export function formatScore(score: number): string {
    return score.toFixed(1);
}

function angleOf(index: number, total: number): number {
    return -Math.PI / 2 + (2 * Math.PI * index) / total;
}

function pointAt(index: number, total: number, distance: number): Point {
    const angle = angleOf(index, total);

    return {
        x: Center + distance * Math.cos(angle),
        y: Center + distance * Math.sin(angle),
    };
}

function scorePoint(index: number, total: number, score: number): Point {
    return pointAt(index, total, (Radius * score) / 10);
}

function textAnchor(index: number, total: number): 'start' | 'middle' | 'end' {
    const cosine = Math.cos(angleOf(index, total));

    if (cosine > 0.3) {
        return 'start';
    }

    if (cosine < -0.3) {
        return 'end';
    }

    return 'middle';
}

function toPoints(points: Point[]): string {
    return points.map(({ x, y }) => `${x},${y}`).join(' ');
}

export function HealthRadar({
    statements,
}: {
    statements: HealthStatementResult[];
}) {
    const { t } = useTrans();
    const total = statements.length;
    const scored = statements.map((statement, index) =>
        statement.average === null
            ? null
            : scorePoint(index, total, statement.average),
    );
    const answered = scored.filter((point): point is Point => point !== null);
    const isComplete = answered.length === total;
    const segments = scored.flatMap((point, index) => {
        const next = scored[(index + 1) % total];

        return point && next ? [{ from: point, to: next, index }] : [];
    });

    return (
        <svg
            viewBox={`0 0 ${ViewBoxSize} ${ViewBoxSize}`}
            role="img"
            aria-label={t('Team health radar')}
            className="w-full max-w-80 overflow-visible"
        >
            {Rings.map((ring) => (
                <polygon
                    key={ring}
                    points={toPoints(
                        statements.map((_, index) =>
                            scorePoint(index, total, ring),
                        ),
                    )}
                    className="fill-none stroke-border"
                />
            ))}
            {statements.map((statement, index) => {
                const end = scorePoint(index, total, 10);

                return (
                    <line
                        key={statement.key}
                        x1={Center}
                        y1={Center}
                        x2={end.x}
                        y2={end.y}
                        className="stroke-border"
                    />
                );
            })}
            {isComplete ? (
                <polygon
                    points={toPoints(answered)}
                    strokeWidth={2}
                    className="fill-primary/20 stroke-primary"
                />
            ) : (
                segments.map(({ from, to, index }) => (
                    <line
                        key={index}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        strokeWidth={2}
                        className="stroke-primary"
                    />
                ))
            )}
            {answered.map(({ x, y }) => (
                <circle
                    key={`${x}-${y}`}
                    cx={x}
                    cy={y}
                    r={3.5}
                    className="fill-primary"
                />
            ))}
            {statements.map((statement, index) => {
                const label = pointAt(index, total, LabelRadius);

                return (
                    <text
                        key={statement.key}
                        x={label.x}
                        y={label.y}
                        fontSize={11}
                        textAnchor={textAnchor(index, total)}
                        dominantBaseline="middle"
                        className="fill-foreground"
                    >
                        {statement.label}
                        {statement.average === null && (
                            <tspan
                                x={label.x}
                                dy="1.2em"
                                className="fill-muted-foreground"
                            >
                                {t('No answers')}
                            </tspan>
                        )}
                    </text>
                );
            })}
        </svg>
    );
}
```

Axes without answers break the outline (gaps) and carry "No answers"; the chart has no animation, so `prefers-reduced-motion` needs no special case.

- [ ] **Step 2: Trend sparkline**

`resources/js/components/retro/results/health-trend.tsx`:

```tsx
import { useTrans } from '@/hooks/use-trans';
import type { HealthTrendPoint } from '@/lib/retro/types';
import { formatScore } from './health-radar';

const Width = 220;
const Height = 56;
const Padding = 8;

function formatDelta(delta: number): string {
    return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;
}

export function HealthTrend({ points }: { points: HealthTrendPoint[] }) {
    const { t } = useTrans();
    const plotted = points.map((point, index) => ({
        point,
        x:
            points.length === 1
                ? Width / 2
                : Padding + (index * (Width - 2 * Padding)) / (points.length - 1),
        y: Padding + ((10 - point.score) / 10) * (Height - 2 * Padding),
    }));
    const latest = points[points.length - 1];

    return (
        <figure className="space-y-1">
            <figcaption className="text-sm font-medium">
                {t('Trend across retros')}
            </figcaption>
            <svg
                viewBox={`0 0 ${Width} ${Height}`}
                role="img"
                aria-label={t('Trend across retros')}
                className="h-14 w-56 overflow-visible"
            >
                <polyline
                    points={plotted.map(({ x, y }) => `${x},${y}`).join(' ')}
                    strokeWidth={2}
                    className="fill-none stroke-primary"
                />
                {plotted.map(({ point, x, y }) => (
                    <a key={point.retroId} href={point.url}>
                        <circle
                            cx={x}
                            cy={y}
                            r={4}
                            strokeWidth={2}
                            className={
                                point.sameStatements
                                    ? 'fill-primary stroke-primary'
                                    : 'fill-background stroke-primary'
                            }
                        >
                            <title>
                                {`${point.title}: ${formatScore(point.score)}/10`}
                                {point.sameStatements
                                    ? ''
                                    : ` — ${t('The statements changed since the previous retro')}`}
                            </title>
                        </circle>
                    </a>
                ))}
            </svg>
            {latest !== undefined && latest.delta !== null && (
                <p className="text-xs text-muted-foreground">
                    {t(':delta since the previous retro', {
                        delta: formatDelta(latest.delta),
                    })}
                </p>
            )}
        </figure>
    );
}
```

Hollow points mark a changed statement set (spec §4.5, §4.6).

- [ ] **Step 3: Translations**

| Key | fr | es | de |
|---|---|---|---|
| `Team health radar` | `Radar de santé de l'équipe` | `Radar de salud del equipo` | `Teamgesundheits-Radar` |
| `No answers` | `Aucune réponse` | `Sin respuestas` | `Keine Antworten` |
| `Trend across retros` | `Tendance sur les rétros` | `Tendencia entre retros` | `Verlauf über Retros` |
| `The statements changed since the previous retro` | `Les affirmations ont changé depuis la rétro précédente` | `Las afirmaciones cambiaron desde la retro anterior` | `Die Aussagen haben sich seit der letzten Retro geändert` |
| `:delta since the previous retro` | `:delta depuis la rétro précédente` | `:delta desde la retro anterior` | `:delta seit der letzten Retro` |

- [ ] **Step 4: Checks, format, commit**

```bash
npm run types:check && npm run check
vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php
npx vp fmt resources/js/components/retro/results/health-radar.tsx resources/js/components/retro/results/health-trend.tsx
git add resources/js/components/retro/results lang
git commit -m "feat: draw the team health radar and trend as inline svg

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 10: Results view and Results/Board tabs

**Files:**
- Create: `resources/js/components/retro/results/{results-section,completed-tabs,participants-section,health-section,survey-result,top-topics,action-items-results,roti-section,results-view}.tsx`
- Modify: `resources/js/components/retro/board.tsx`, `lang/{en,fr,es,de}.json`
- Delete: `resources/js/components/retro/completed-summary.tsx`

**Interfaces:**
- Consumes: `board.results`, `board.cards`, `board.actionItems`, `board.participants`, `HealthRadar`, `HealthTrend`, `formatScore`, `RotiControl`, `RotiLabels`, `SurveyPayload`.
- Produces: `ResultsView()`, `CompletedTabs({ value, onChange })`, `type CompletedView = 'results' | 'board'`. Plan 8e inserts its summary section between participants and team health; spec 7's plan inserts "Games we played" between action items and ROTI when `results.games !== null`.

- [ ] **Step 1: Shared section wrapper and tabs**

`results/results-section.tsx`:

```tsx
import type { ReactNode } from 'react';

type Props = { title: string; children: ReactNode };

export function ResultsSection({ title, children }: Props) {
    return (
        <section className="space-y-3">
            <h2 className="text-base font-semibold">{title}</h2>
            {children}
        </section>
    );
}
```

`results/completed-tabs.tsx`:

```tsx
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export type CompletedView = 'results' | 'board';

type Props = {
    value: CompletedView;
    onChange: (view: CompletedView) => void;
};

const Views: Array<{ view: CompletedView; label: string }> = [
    { view: 'results', label: 'Results' },
    { view: 'board', label: 'Board' },
];

export function CompletedTabs({ value, onChange }: Props) {
    const { t } = useTrans();

    return (
        <div role="tablist" className="flex gap-1 border-b px-4 py-2">
            {Views.map(({ view, label }) => (
                <Button
                    key={view}
                    role="tab"
                    size="sm"
                    variant={value === view ? 'secondary' : 'ghost'}
                    aria-selected={value === view}
                    onClick={() => onChange(view)}
                >
                    {t(label)}
                </Button>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Participants, top topics, action items**

`results/participants-section.tsx`:

```tsx
import { useTrans } from '@/hooks/use-trans';
import type { BoardParticipant } from '@/lib/retro/types';
import { ResultsSection } from './results-section';

export function ParticipantsSection({
    participants,
}: {
    participants: BoardParticipant[];
}) {
    const { t } = useTrans();

    return (
        <ResultsSection title={t('Thanks for participating')}>
            <ul className="flex flex-wrap gap-3">
                {participants.map((participant) => (
                    <li
                        key={participant.id}
                        className="flex items-center gap-2 text-sm"
                    >
                        <img
                            src={participant.avatarUrl}
                            alt=""
                            className="size-8 rounded-full bg-muted"
                        />
                        <span>{participant.name}</span>
                        {participant.isGuest && (
                            <span className="text-xs text-muted-foreground">
                                {t('Guest')}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </ResultsSection>
    );
}
```

`results/top-topics.tsx`:

```tsx
import { useTrans } from '@/hooks/use-trans';
import { childrenOf, sortByVotes } from '@/lib/retro/board-reducer';
import { useBoard } from '../board-context';
import { ResultsSection } from './results-section';

export function TopTopics() {
    const { board } = useBoard();
    const { t } = useTrans();
    const topCards = sortByVotes(
        board.cards.filter((card) => card.parentCardId === null),
    ).slice(0, 5);

    return (
        <ResultsSection title={t('Top topics')}>
            <ol className="space-y-2">
                {topCards.map((card) => {
                    const groupedCount = childrenOf(board.cards, card.id).length;

                    return (
                        <li
                            key={card.id}
                            className="flex items-start justify-between gap-3 rounded-md border p-2 text-sm"
                        >
                            <div className="min-w-0 space-y-1">
                                {card.groupName && (
                                    <p className="font-semibold">
                                        {card.groupName}
                                    </p>
                                )}
                                {card.content === null && card.gif ? (
                                    <img
                                        src={card.gif.previewUrl}
                                        alt={t('GIF')}
                                        loading="lazy"
                                        className="h-16 w-auto rounded-sm"
                                    />
                                ) : (
                                    <p className="break-words">
                                        {card.content}
                                    </p>
                                )}
                                {groupedCount > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        {t(
                                            groupedCount === 1
                                                ? ':count grouped card'
                                                : ':count grouped cards',
                                            { count: groupedCount },
                                        )}
                                    </p>
                                )}
                            </div>
                            <span className="shrink-0 font-medium tabular-nums">
                                {card.votes ?? 0}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </ResultsSection>
    );
}
```

`results/action-items-results.tsx` (read-only list moved from `completed-summary.tsx`; spec 3's plan adds priority, due date and theme):

```tsx
import { Check } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import { useBoard } from '../board-context';
import { ResultsSection } from './results-section';

export function ActionItemsResults() {
    const { board } = useBoard();
    const { t } = useTrans();

    return (
        <ResultsSection title={t('Action items')}>
            {board.actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('No action items yet.')}
                </p>
            ) : (
                <ul className="space-y-2">
                    {board.actionItems.map((item) => (
                        <li
                            key={item.id}
                            className="flex items-start gap-2 rounded-md border p-2 text-sm"
                        >
                            {item.isDone && (
                                <Check
                                    className="mt-0.5 size-4 shrink-0"
                                    aria-label={t('Done')}
                                />
                            )}
                            <span
                                className={`min-w-0 flex-1 break-words ${item.isDone ? 'text-muted-foreground line-through' : ''}`}
                            >
                                {item.content}
                            </span>
                            {item.assignee && (
                                <span className="shrink-0 text-muted-foreground">
                                    {item.assignee.name}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </ResultsSection>
    );
}
```

- [ ] **Step 3: Team health section**

`results/health-section.tsx`:

```tsx
import { useTrans } from '@/hooks/use-trans';
import type { HealthResults, HealthTrendPoint } from '@/lib/retro/types';
import { formatScore, HealthRadar } from './health-radar';
import { HealthTrend } from './health-trend';
import { ResultsSection } from './results-section';

type Props = { health: HealthResults; trend: HealthTrendPoint[] | null };

function Stat({
    label,
    value,
    detail,
}: {
    label: string;
    value: string;
    detail?: string;
}) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-semibold">{value}</dd>
            {detail && (
                <dd className="text-xs text-muted-foreground">{detail}</dd>
            )}
        </div>
    );
}

export function HealthSection({ health, trend }: Props) {
    const { t } = useTrans();

    return (
        <ResultsSection title={t('Team health')}>
            <div className="grid gap-6 md:grid-cols-[minmax(0,20rem)_1fr]">
                <HealthRadar statements={health.statements} />
                <div className="space-y-4">
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                        <Stat
                            label={t('Score')}
                            value={`${formatScore(health.score)}/10`}
                        />
                        <Stat
                            label={t('Participation')}
                            value={t(
                                ':respondents / :participants participants',
                                health.participation,
                            )}
                        />
                        {health.topStrength && (
                            <Stat
                                label={t('Top strength')}
                                value={health.topStrength.label}
                                detail={`${formatScore(health.topStrength.average)}/10`}
                            />
                        )}
                        {health.growthArea && (
                            <Stat
                                label={t('Growth area')}
                                value={health.growthArea.label}
                                detail={`${formatScore(health.growthArea.average)}/10`}
                            />
                        )}
                        <Stat
                            label={t('Alignment')}
                            value={`${health.alignment.value}/10`}
                            detail={health.alignment.label}
                        />
                    </dl>
                    <p className="text-sm">
                        <strong>{health.assessment.title}</strong>{' '}
                        {health.assessment.sentence}
                    </p>
                    {trend !== null && trend.length > 0 && (
                        <HealthTrend points={trend} />
                    )}
                </div>
            </div>
            <ul className="divide-y rounded-md border text-sm">
                {health.statements.map((statement) => (
                    <li
                        key={statement.key}
                        className="flex items-center justify-between gap-3 p-2"
                    >
                        <span className="min-w-0">{statement.text}</span>
                        <span className="shrink-0 tabular-nums">
                            {statement.average === null
                                ? t('No answers')
                                : `${formatScore(statement.average)}/10`}
                        </span>
                    </li>
                ))}
            </ul>
        </ResultsSection>
    );
}
```

`alignment.label`, `assessment.title` and `assessment.sentence` come translated from Plan 8b's `SummarizeHealthCheck`. The statement list doubles as the accessible text alternative of the radar.

- [ ] **Step 4: Survey result (read-only)**

`results/survey-result.tsx`:

```tsx
import { Check } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { SurveyPayload } from '@/lib/retro/types';
import { useBoard } from '../board-context';

type SurveyComment = SurveyPayload['comments'][number];

function ReadOnlyComment({ comment }: { comment: Omit<SurveyComment, 'replies'> }) {
    const { t } = useTrans();

    if (comment.deleted) {
        return (
            <p className="text-xs text-muted-foreground italic">
                {t('Comment deleted')}
            </p>
        );
    }

    return (
        <div className="text-xs">
            <span className="font-medium">
                {comment.author?.name ?? t('Anonymous')}
            </span>{' '}
            <span className="break-words whitespace-pre-wrap">
                {comment.content}
            </span>
        </div>
    );
}

export function SurveyResult({ survey }: { survey: SurveyPayload }) {
    const { board } = useBoard();
    const { t } = useTrans();
    const names = new Map(
        board.participants.map((participant) => [
            participant.id,
            participant.name,
        ]),
    );
    const percentOf = (count: number | null) =>
        survey.responseCount === 0 || count === null
            ? 0
            : Math.round((count / survey.responseCount) * 100);

    return (
        <article className="space-y-3 rounded-md border p-3 text-sm">
            <header className="space-y-1">
                <h3 className="font-medium">{survey.question}</h3>
                {survey.description && (
                    <p className="text-muted-foreground">
                        {survey.description}
                    </p>
                )}
                {survey.kind === 'multiple' && (
                    <p className="text-xs text-muted-foreground">
                        {t('Several answers allowed')}
                    </p>
                )}
            </header>
            {survey.kind === 'text' ? (
                <ul className="space-y-1">
                    {(survey.textAnswers ?? []).map((answer) => (
                        <li
                            key={answer.id}
                            className="rounded-md bg-muted/50 p-2 break-words whitespace-pre-wrap"
                        >
                            {answer.text}
                            {answer.authorId && (
                                <span className="block text-xs text-muted-foreground">
                                    {names.get(answer.authorId)}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                <ul className="space-y-2">
                    {[...survey.options]
                        .sort((a, b) => a.position - b.position)
                        .map((option) => {
                            const percent = percentOf(option.count);

                            return (
                                <li key={option.id} className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="flex items-center gap-1">
                                            {option.label}
                                            {survey.myOptionIds.includes(
                                                option.id,
                                            ) && (
                                                <Check
                                                    className="size-3.5"
                                                    aria-label={t(
                                                        'Your answer',
                                                    )}
                                                />
                                            )}
                                        </span>
                                        <span className="tabular-nums">
                                            {option.count ?? 0} · {percent}%
                                        </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted">
                                        <div
                                            className="h-2 rounded-full bg-primary motion-safe:transition-[width]"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                    {option.voters &&
                                        option.voters.length > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                {option.voters
                                                    .map(
                                                        (id) =>
                                                            names.get(id) ?? '',
                                                    )
                                                    .join(', ')}
                                            </p>
                                        )}
                                </li>
                            );
                        })}
                </ul>
            )}
            <p className="text-xs text-muted-foreground">
                {t(
                    survey.responseCount === 1
                        ? ':count response'
                        : ':count responses',
                    { count: survey.responseCount },
                )}
            </p>
            {survey.reactions.length > 0 && (
                <ul className="flex flex-wrap gap-1">
                    {survey.reactions.map((reaction) => (
                        <li
                            key={reaction.emoji}
                            title={reaction.names.join(', ')}
                            className="rounded-full border px-2 py-0.5 text-xs"
                        >
                            {reaction.emoji} {reaction.count}
                        </li>
                    ))}
                </ul>
            )}
            {survey.commentCount > 0 && (
                <Collapsible>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2">
                            {t('Comments (:count)', {
                                count: survey.commentCount,
                            })}
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <ul className="space-y-2 pt-2">
                            {survey.comments.map((thread) => (
                                <li key={thread.id} className="space-y-1">
                                    <ReadOnlyComment comment={thread} />
                                    <ul className="ml-4 space-y-1 border-l pl-2">
                                        {thread.replies.map((reply) => (
                                            <li key={reply.id}>
                                                <ReadOnlyComment
                                                    comment={reply}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    </CollapsibleContent>
                </Collapsible>
            )}
        </article>
    );
}
```

This relies only on the spec §5.2 fields of `SurveyPayload`; if Plan 8c named the comment author or text-answer fields differently, follow 8c's `SurveyPayload` (names are dictated by spec §5.2/§5.4/§5.5).

- [ ] **Step 5: ROTI section**

`results/roti-section.tsx`:

```tsx
import { useTrans } from '@/hooks/use-trans';
import type { RotiResults } from '@/lib/retro/types';
import { RotiControl, RotiLabels } from '../roti-control';
import { ResultsSection } from './results-section';

export function RotiSection({ roti }: { roti: RotiResults }) {
    const { t } = useTrans();
    const highest = Math.max(1, ...roti.distribution.map((row) => row.count));

    return (
        <ResultsSection title={t('Return on time invested')}>
            <div className="grid gap-6 md:grid-cols-2">
                <RotiControl />
                {roti.respondents === 0 || roti.average === null ? (
                    <p className="text-sm text-muted-foreground">
                        {t('No ratings yet.')}
                    </p>
                ) : (
                    <div className="space-y-2 text-sm">
                        <p>
                            {t('Average')}:{' '}
                            <strong className="tabular-nums">
                                {roti.average.toFixed(1)}/5
                            </strong>
                        </p>
                        <ul className="space-y-1">
                            {roti.distribution.map(({ score, count }) => (
                                <li
                                    key={score}
                                    className="grid grid-cols-[8rem_1fr_2rem] items-center gap-2"
                                >
                                    <span className="truncate text-xs">
                                        {score} · {t(RotiLabels[score - 1])}
                                    </span>
                                    <div className="h-2 rounded-full bg-muted">
                                        <div
                                            className="h-2 rounded-full bg-primary motion-safe:transition-[width]"
                                            style={{
                                                width: `${(count / highest) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    <span className="text-right tabular-nums">
                                        {count}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </ResultsSection>
    );
}
```

- [ ] **Step 6: Results view**

`results/results-view.tsx`:

```tsx
import { usePage } from '@inertiajs/react';
import { useIsMounted } from '@/hooks/use-is-mounted';
import { useTrans } from '@/hooks/use-trans';
import { useBoard } from '../board-context';
import { ActionItemsResults } from './action-items-results';
import { HealthSection } from './health-section';
import { ParticipantsSection } from './participants-section';
import { ResultsSection } from './results-section';
import { RotiSection } from './roti-section';
import { SurveyResult } from './survey-result';
import { TopTopics } from './top-topics';

export function ResultsView() {
    const { board } = useBoard();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const isMounted = useIsMounted();
    const { results } = board;

    if (results === null) {
        return null;
    }

    const completedAt =
        isMounted && board.retro.completedAt
            ? new Date(board.retro.completedAt).toLocaleString(locale, {
                  dateStyle: 'long',
                  timeStyle: 'short',
              })
            : null;

    return (
        <div className="mx-auto w-full max-w-4xl space-y-8 p-4">
            {completedAt && (
                <p className="text-sm text-muted-foreground">
                    {t('Retrospective completed on :date', {
                        date: completedAt,
                    })}
                </p>
            )}
            <ParticipantsSection participants={results.participants} />
            {results.health && (
                <HealthSection
                    health={results.health}
                    trend={results.healthTrend}
                />
            )}
            {results.surveys.length > 0 && (
                <ResultsSection title={t('Surveys')}>
                    <div className="grid gap-3 md:grid-cols-2">
                        {results.surveys.map((survey) => (
                            <SurveyResult key={survey.id} survey={survey} />
                        ))}
                    </div>
                </ResultsSection>
            )}
            <TopTopics />
            <ActionItemsResults />
            <RotiSection roti={results.roti} />
        </div>
    );
}
```

- [ ] **Step 7: Tabs in the board**

In `resources/js/components/retro/board.tsx`:

1. Replace `import { CompletedSummary } from './completed-summary';` with
   ```tsx
   import { CompletedTabs, type CompletedView } from './results/completed-tabs';
   import { ResultsView } from './results/results-view';
   ```
2. With the other `useState` calls (before the `if (status !== 'active')` early return):
   ```tsx
    const [completedView, setCompletedView] =
        useState<CompletedView>('results');
    const [trackedPhase, setTrackedPhase] = useState(board.retro.phase);

    if (trackedPhase !== board.retro.phase) {
        setTrackedPhase(board.retro.phase);
        setCompletedView('results');
    }
   ```
   so every (re)completion opens on Results.
3. Replace `{board.retro.phase === 'completed' && (<CompletedSummary />)}` with
   ```tsx
                        {board.retro.phase === 'completed' && (
                            <CompletedTabs
                                value={completedView}
                                onChange={setCompletedView}
                            />
                        )}
   ```
   and wrap the element that renders the columns board (the `<div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">` holding `DndContext` and `ActionItemsPanel`; Plan 8a only added `<PhasePanel />` above it, which renders nothing in `Completed`) in:
   ```tsx
                        {board.retro.phase === 'completed' &&
                        completedView === 'results' ? (
                            <ResultsView />
                        ) : (
                            /* existing columns board element, unchanged */
                        )}
                   ```
   (the placeholder comment stands for the existing element; do not leave a comment in the code).

Then delete the old component: `git rm resources/js/components/retro/completed-summary.tsx`.

- [ ] **Step 8: Translations**

| Key | fr | es | de |
|---|---|---|---|
| `Results` | `Résultats` | `Resultados` | `Ergebnisse` |
| `Board` | `Tableau` | `Tablero` | `Board` |
| `Thanks for participating` | `Merci pour votre participation` | `Gracias por participar` | `Danke für deine Teilnahme` |
| `Team health` | `Santé de l'équipe` | `Salud del equipo` | `Teamgesundheit` |
| `Score` | `Score` | `Puntuación` | `Punktzahl` |
| `Participation` | `Participation` | `Participación` | `Beteiligung` |
| `:respondents / :participants participants` | `:respondents / :participants participants` | `:respondents / :participants participantes` | `:respondents / :participants Teilnehmende` |
| `Top strength` | `Point fort` | `Punto fuerte` | `Größte Stärke` |
| `Growth area` | `Axe de progrès` | `Área de mejora` | `Entwicklungsfeld` |
| `Alignment` | `Alignement` | `Alineación` | `Übereinstimmung` |
| `Surveys` | `Sondages` | `Encuestas` | `Umfragen` |
| `Several answers allowed` | `Plusieurs réponses possibles` | `Se permiten varias respuestas` | `Mehrere Antworten möglich` |
| `Your answer` | `Votre réponse` | `Tu respuesta` | `Deine Antwort` |
| `:count response` | `:count réponse` | `:count respuesta` | `:count Antwort` |
| `:count responses` | `:count réponses` | `:count respuestas` | `:count Antworten` |
| `:count grouped card` | `:count carte groupée` | `:count tarjeta agrupada` | `:count gruppierte Karte` |
| `:count grouped cards` | `:count cartes groupées` | `:count tarjetas agrupadas` | `:count gruppierte Karten` |
| `Return on time invested` | `Retour sur le temps investi` | `Retorno del tiempo invertido` | `Return on Time Invested` |
| `Average` | `Moyenne` | `Media` | `Durchschnitt` |
| `No ratings yet.` | `Aucune note pour le moment.` | `Aún no hay valoraciones.` | `Noch keine Bewertungen.` |

Skip any key already present (8b/8c may have added `Surveys`, `:count responses`, `Several answers allowed`). `Results`/`Board` are passed through a variable in `CompletedTabs` and must be added even though `TranslationKeysTest` cannot see them.

- [ ] **Step 9: Checks**

Run: `npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS (known pre-existing lint failures only); no remaining import of `completed-summary`.

- [ ] **Step 10: Format and commit**

```bash
npx vp fmt resources/js/components/retro/results/*.tsx resources/js/components/retro/board.tsx
git add resources/js/components/retro lang
git commit -m "feat: open completed retros on a results view

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 11: Verification (controller-driven)

- [ ] **Step 1:** `vendor/bin/sail artisan test --compact tests/Feature/Retros tests/Feature/TranslationKeysTest.php` — all green.
- [ ] **Step 2:** `vendor/bin/sail bin phpstan analyse --no-progress` — 0 errors; `vendor/bin/sail bin pint --dirty --format agent` — clean.
- [ ] **Step 3:** `npm run types:check && npm run check` — only the known pre-existing failures.
- [ ] **Step 4:** Ask the user to run the full suite: `vendor/bin/sail artisan test --compact`.
- [ ] **Step 5: Two-browser walkthrough** (one member, one guest; `npm run dev` or `npm run build`):
  1. Grouping: group two cards, name the group as the guest; the member sees the name live. Drag the only grouped card out: the name disappears in both browsers. Group again, name it, group this named lead onto another named group: only the target's name remains.
  2. Voting/Discussing: rename the group inline; presentation mode shows the group name above the card.
  3. Discussing: rate the retro in both browsers under the action items; the "n ratings" count updates live; no distribution anywhere. Lock the board: rating still works.
  4. Complete: both land on the Results tab. The member sees participants, team health (radar with gaps for unanswered axes, score, participation, strength, growth area, alignment, assessment, trend with a hollow point after a statement change), surveys with bars/percentages/voters when "Show who answered" is on, top topics with group names and grouped counts, action items, ROTI with distribution and average from the first rating. The guest sees the same without the trend.
  5. Change a rating in Results in one browser: the other refreshes within about a second. Switch to the Board tab and back. Reopen then complete again: Results tab is selected again.
  6. With the OS "reduce motion" setting on, no bar or chart animates.

## Notes

- `results.games` is always `null` here; spec 7's plan adds `BuildGamesPlayed` to `BuildResults` and renders "Games we played" between `ActionItemsResults` and `RotiSection`.
- Plan 8e fills `results.summary`, adds its section after `ParticipantsSection`, and sends `ResultsChanged` (created in Task 1) when the summary state changes.
- Survey closing on completion is Plan 8c's `CloseOpenSurveys` step inside `ChangeRetroPhase`; `RetroCompleted` is dispatched from the same transition.

## Spec coverage

| Spec | Task |
|---|---|
| §6.1 Results/Board tabs, Results default, replaces `completed-summary.tsx`, Reopen in header, guests without trend | 10, 5 |
| §6.1 `RetroCompleted` on every transition into `Completed` | 1 |
| §6.2.1 Thanks for participating (also on anonymous retros) | 5, 10 |
| §6.2.3 Team health (radar with gaps, score, participation, strength, growth area, alignment, assessment, trend members only) | 5, 9, 10 |
| §6.2.4 Surveys (counts, percentages, voters, text answers, reactions, collapsed read-only comments) | 5, 10 |
| §6.2.5 Top topics with group name and grouped count | 10 |
| §6.2.6 Action items (read-only; spec 3 fields added by spec 3's plan) | 10 |
| §6.2.7 Games we played slot (`results.games: null`) | 5, Notes |
| §6.2.8, §6.4 ROTI (endpoints, phases, lock exception, own score + count before `Completed`, distribution/average in `Completed` from the first rating) | 2, 5, 8, 10 |
| §7.2 Group names (endpoint, phases, guests, lock, 422, trim/clear, lifecycle, `groupName` redaction, anonymous, broadcast, inline UI, discussion view, top topics) | 3, 4, 7, 10 |
| §10.1 `PUT/DELETE /roti`, `PUT/DELETE /cards/{card}/group-name` | 2, 3 |
| §10.2 `roti.changed`, `card.group-named`, `results.changed`, debounced refetch | 1, 2, 3, 6 |
| §10.3 snapshot `roti`, `results`, card `groupName`, constant query count | 2, 3, 5 |
| §11 ROTI aggregates only in `Completed`; trend never to guests; group names without author, `null` on hidden cards | 2, 3, 5 |
| §13 ROTI buttons in Discussing and Results; inline-SVG `HealthRadar`/`HealthTrend`, reduced motion; group name UI | 7, 8, 9, 10 |
| §14 rejected mutations roll back + toast (via `ctx.run`) | 7, 8 |
| §15 ROTI, results, group names, `RetroCompleted` tests; walkthrough | 1–5, 11 |
