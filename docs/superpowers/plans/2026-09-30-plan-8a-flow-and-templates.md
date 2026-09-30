# Plan 8a — Retro flow and template catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two optional pre-writing phases (Health check slot, Icebreaker with a Warm-up panel) driven by per-retro toggles, the automatic vote limit, column descriptions, the 52-template catalogue with categories in four languages, workspace templates, and a creation dialog with search, category filter and preview.

**Architecture:** The phase list becomes a property of the retro (`Retro::phases()` over its toggles); adjacency moves from the enum to the model, and the whole transition moves into one action, `ChangeRetroPhase`, that later plans (8c, 8d, 8e) extend with one step each. Hard-coded phase lists in guards are replaced by two enum helpers (`isOpen`, `hidesOthersCards`) and a new `RetroGuard::open`. The `RetroTemplate` enum is replaced by `TemplateCatalogue` (definitions in PHP, texts in the `templates` PHP translation group) plus database-backed workspace templates; `CreateRetro` takes a `NewRetro` value object. The catalogue reaches the browser as an Inertia optional prop, loaded when the creation dialog (team page) or template editor (workspace page) opens.

**Tech Stack:** Laravel 13 (PHP 8.4), Pest, Inertia v3 (`Inertia::optional`, `router.reload({ only })`, `useForm`), React 19, Wayfinder, Tailwind 4, lucide.

**Spec:** `docs/superpowers/specs/2026-09-29-retro-flow-extras-design.md` (§2, §7.1, §8, the matching parts of §3, §10.3, §12, §13, §15). Cross-plan contract: plans 8b–8e consume the names in each task's **Interfaces → Produces** block; do not rename them.

## Global Constraints

- Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host.
- No new Composer or npm dependency.
- Migrations: only `up()`, filenames `2026_10_01_1000xx_…` (this plan's range `100000`–`100099`).
- Every mutation keeps the controller pattern: guards on the route-bound retro, then again on the `lockForUpdate` retro inside `DB::transaction`, broadcasts via `->sendToOthers()` inside the transaction.
- Redaction invariant: nobody but the author receives card content while the retro is in `HealthCheck`, `Icebreaker` or `Writing`.
- Every user-facing string via `t()` / `__()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"); template names, column titles, column descriptions and category labels in `lang/{en,fr,es,de}/templates.php`; `tests/Feature/TranslationKeysTest.php` stays green.
- PHP code reads a `templates.*` line only with a double-quoted, interpolated key (`__("templates.{$key}.name")`): single-quoted `__('…')` literals are scanned by `TranslationKeysTest` as JSON keys.
- Board API calls go through `retroRequest()`; Wayfinder route functions, no hard-coded URLs. Run `vendor/bin/sail artisan wayfinder:generate --with-form` after route changes.
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp fmt <files>`.
- React style: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `useBoard()` for board state.
- PHP style: constructor promotion, typed everything, array-shape docblocks, early returns, curly braces always, no comments that restate code.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Review Focus

1. **Facilitator turns off the phase the retro is currently in** (e.g. Icebreaker while in Icebreaker) → 422 "Move to another phase before turning this phase off.", the toggle stays on and the stepper is unchanged. Pinned in Task 2 ("refuses to turn off the current phase").
2. **Facilitator moves back from `Writing` to `Icebreaker` after cards were written** → others' cards are hidden again in the snapshot (content, author and GIF `null`). Pinned in Task 2 ("hides others cards again in the pre-writing phases").
3. **Automatic vote limit falls below votes already cast** (moved back to Grouping and grouped cards) → existing votes kept, `remainingVotes` is `0`, not negative, and a new vote is refused. Pinned in Task 3 ("keeps votes already cast when the automatic limit drops").
4. **Tampered template key at creation** (`workspace:` + another workspace's template id, `workspace:not-a-uuid`, unknown key) → 422 on `template`, no retro created, no SQL error on the malformed id. Pinned in Task 8 ("refuses templates outside the catalogue and the workspace").
5. **A locale misses a template line** (e.g. a column added in English only) → `TemplateCatalogueTest` fails because every definition's column count must equal the translated column count in all four locales. Pinned in Task 6.

## File map

| Area | Files |
|---|---|
| Phases | `app/Enums/RetroPhase.php`, `app/Models/Retro.php`, `app/Actions/Retros/ChangeRetroPhase.php` (new), `app/Actions/Retros/RetroGuard.php`, `app/Http/Controllers/Retros/{RetroPhasesController,RetroSettingsController,RetroTimersController,ColumnsController,ColumnOrdersController}.php`, `app/Actions/Retros/PresentCard.php`, migration `2026_10_01_100000_add_phase_toggles_to_retros_table`, `database/factories/RetroFactory.php` |
| Vote limit | migration `2026_10_01_100100_make_votes_per_participant_nullable_on_retros_table`, `Retro::voteLimit()`, `CardVotesController`, `BuildBoardSnapshot` |
| Column descriptions | migration `2026_10_01_100200_add_description_to_columns_table`, `app/Models/Column.php`, `ColumnsController`, `PresentColumns` |
| Catalogue | `app/Enums/TemplateCategory.php`, `app/Support/RetroTemplates/{TemplateCatalogue,TemplateDefinition}.php`, `lang/{en,fr,es,de}/templates.php`, `tests/Feature/Retros/TemplateCatalogueTest.php`, `tests/Feature/TranslationKeysTest.php` |
| Workspace templates | migrations `2026_10_01_100300_create_workspace_templates_table`, `…100400_create_workspace_template_columns_table`, `…100500_add_workspace_template_id_to_retros_table`, `app/Models/{WorkspaceTemplate,WorkspaceTemplateColumn,Workspace}.php`, factories, `app/Policies/WorkspacePolicy.php`, `app/Http/Requests/WorkspaceTemplateRequest.php`, `app/Http/Controllers/WorkspaceTemplatesController.php`, `routes/web.php` |
| Creation | `app/Actions/Retros/{NewRetro,CreateRetro,BuildTemplateCatalogue}.php`, `app/Http/Controllers/{TeamRetrosController,TeamsController}.php`, delete `app/Enums/RetroTemplate.php`, `database/seeders/DemoSeeder.php` |
| Frontend board | `resources/js/lib/retro/types.ts`, `components/retro/{phase-stepper,phase-panel,icebreaker-panel,settings-dialog,column-header,board,add-column}.tsx` |
| Frontend pages | `resources/js/types/workspaces.ts`, `components/teams/new-retro-dialog.tsx`, `components/templates/template-chips.tsx`, `pages/teams/show.tsx`, `pages/workspaces/templates.tsx`, `components/app-sidebar.tsx` |

---
### Task 1: Pre-writing phases, enabled phase list and `ChangeRetroPhase`

**Files:**
- Create: `database/migrations/2026_10_01_100000_add_phase_toggles_to_retros_table.php`, `app/Actions/Retros/ChangeRetroPhase.php`
- Modify: `app/Enums/RetroPhase.php`, `app/Models/Retro.php`, `app/Http/Controllers/Retros/RetroPhasesController.php`, `database/factories/RetroFactory.php`, `lang/{en,fr,es,de}.json`
- Test: `tests/Feature/Retros/RetroModelTest.php`, `tests/Feature/Retros/FacilitationTest.php`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `RetroPhase` cases in order `HealthCheck = 'health_check'`, `Icebreaker = 'icebreaker'`, `Writing`, `Grouping`, `Voting`, `Discussing`, `Completed`; `RetroPhase::isOpen(): bool` (every case but `Completed`); `RetroPhase::hidesOthersCards(): bool` (`HealthCheck`, `Icebreaker`, `Writing`); `label()` adds "Health check", "Icebreaker". `next()`, `previous()`, `isAdjacentTo()` are removed.
  - `retros.health_check_enabled` / `retros.icebreaker_enabled` (bool, default false), fillable and cast on `Retro`.
  - `Retro::phases(): array<int, RetroPhase>`, `Retro::firstPhase(): RetroPhase`, `Retro::nextPhase(): ?RetroPhase`, `Retro::previousPhase(): ?RetroPhase`, `Retro::canMoveTo(RetroPhase $phase): bool`.
  - `App\Actions\Retros\ChangeRetroPhase::handle(Retro $locked, RetroPhase $phase): void` — runs inside the caller's transaction on the locked row; private steps `ensureReachable`, `move`, `broadcast`. Plans 8c/8d/8e add one private step each (close surveys, dispatch `RetroCompleted`, queue the summary) between `move` and `broadcast`.
  - `RetroFactory` states `withHealthCheck()`, `withIcebreaker()`.

- [ ] **Step 1: Write the failing tests**

In `tests/Feature/Retros/RetroModelTest.php`, replace the test `it('moves between adjacent phases only', …)` with:

```php
it('lists the enabled phases in order', function (bool $healthCheck, bool $icebreaker, array $expected) {
    $retro = Retro::factory()->make(['health_check_enabled' => $healthCheck, 'icebreaker_enabled' => $icebreaker]);

    expect(array_map(fn (RetroPhase $phase) => $phase->value, $retro->phases()))->toBe($expected)
        ->and($retro->firstPhase()->value)->toBe($expected[0]);
})->with([
    'neither' => [false, false, ['writing', 'grouping', 'voting', 'discussing', 'completed']],
    'health check' => [true, false, ['health_check', 'writing', 'grouping', 'voting', 'discussing', 'completed']],
    'icebreaker' => [false, true, ['icebreaker', 'writing', 'grouping', 'voting', 'discussing', 'completed']],
    'both' => [true, true, ['health_check', 'icebreaker', 'writing', 'grouping', 'voting', 'discussing', 'completed']],
]);

it('moves only to neighbours among the enabled phases', function () {
    $retro = Retro::factory()->withIcebreaker()->make(['phase' => RetroPhase::Writing]);

    expect($retro->previousPhase())->toBe(RetroPhase::Icebreaker)
        ->and($retro->nextPhase())->toBe(RetroPhase::Grouping)
        ->and($retro->canMoveTo(RetroPhase::Icebreaker))->toBeTrue()
        ->and($retro->canMoveTo(RetroPhase::Grouping))->toBeTrue()
        ->and($retro->canMoveTo(RetroPhase::HealthCheck))->toBeFalse()
        ->and($retro->canMoveTo(RetroPhase::Voting))->toBeFalse()
        ->and($retro->canMoveTo(RetroPhase::Writing))->toBeFalse();

    $retro->icebreaker_enabled = false;

    expect($retro->previousPhase())->toBeNull();

    $retro->phase = RetroPhase::Completed;

    expect($retro->nextPhase())->toBeNull()
        ->and($retro->canMoveTo(RetroPhase::Discussing))->toBeTrue();
});

it('knows which phases are open and which hide the cards of others', function () {
    $hiding = array_values(array_filter(RetroPhase::cases(), fn (RetroPhase $phase) => $phase->hidesOthersCards()));
    $open = array_values(array_filter(RetroPhase::cases(), fn (RetroPhase $phase) => $phase->isOpen()));

    expect(array_map(fn (RetroPhase $phase) => $phase->value, $hiding))->toBe(['health_check', 'icebreaker', 'writing'])
        ->and($open)->not->toContain(RetroPhase::Completed)
        ->and($open)->toHaveCount(6);
});
```

Append to `tests/Feature/Retros/FacilitationTest.php`:

```php
it('moves through the enabled pre-writing phases', function () {
    $retro = Retro::factory()->withHealthCheck()->withIcebreaker()->inPhase(RetroPhase::HealthCheck)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'writing'])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'icebreaker'])->assertOk();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'writing'])->assertOk();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'icebreaker'])->assertOk();

    expect($retro->fresh()->phase)->toBe(RetroPhase::Icebreaker);
    Event::assertDispatched(PhaseChanged::class, 3);
});

it('never moves into a disabled phase', function () {
    [$retro, $user] = facilitatedRetro();

    $this->actingAs($user)
        ->putJson(route('retros.phase.update', $retro), ['phase' => 'icebreaker'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['phase' => 'The retrospective can only move to the previous or next phase.']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/RetroModelTest.php tests/Feature/Retros/FacilitationTest.php`
Expected: FAIL — `Call to undefined method … withIcebreaker()` / unknown column `health_check_enabled`.

- [ ] **Step 3: Add the migration**

`vendor/bin/sail artisan make:migration add_phase_toggles_to_retros_table --no-interaction`, then rename the file to `database/migrations/2026_10_01_100000_add_phase_toggles_to_retros_table.php` with:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retros', function (Blueprint $table) {
            $table->boolean('health_check_enabled')->default(false);
            $table->boolean('icebreaker_enabled')->default(false);
        });
    }
};
```

- [ ] **Step 4: Rewrite the phase enum**

`app/Enums/RetroPhase.php`:

```php
<?php

namespace App\Enums;

enum RetroPhase: string
{
    case HealthCheck = 'health_check';
    case Icebreaker = 'icebreaker';
    case Writing = 'writing';
    case Grouping = 'grouping';
    case Voting = 'voting';
    case Discussing = 'discussing';
    case Completed = 'completed';

    public function isOpen(): bool
    {
        return $this !== self::Completed;
    }

    public function hidesOthersCards(): bool
    {
        return in_array($this, [self::HealthCheck, self::Icebreaker, self::Writing], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::HealthCheck => __('Health check'),
            self::Icebreaker => __('Icebreaker'),
            self::Writing => __('Writing'),
            self::Grouping => __('Grouping'),
            self::Voting => __('Voting'),
            self::Discussing => __('Discussing'),
            self::Completed => __('Completed'),
        };
    }
}
```

- [ ] **Step 5: Add the phase list to the retro model**

In `app/Models/Retro.php`:
- docblock: add `@property bool $health_check_enabled` and `@property bool $icebreaker_enabled`;
- `#[Fillable([...])]`: append `'health_check_enabled', 'icebreaker_enabled'`;
- `casts()`: add `'health_check_enabled' => 'boolean'` and `'icebreaker_enabled' => 'boolean'`;
- add these methods after `isFacilitator()`:

```php
    /**
     * @return array<int, RetroPhase>
     */
    public function phases(): array
    {
        return array_values(array_filter(RetroPhase::cases(), fn (RetroPhase $phase): bool => match ($phase) {
            RetroPhase::HealthCheck => (bool) $this->health_check_enabled,
            RetroPhase::Icebreaker => (bool) $this->icebreaker_enabled,
            default => true,
        }));
    }

    public function firstPhase(): RetroPhase
    {
        return $this->phases()[0];
    }

    public function nextPhase(): ?RetroPhase
    {
        return $this->neighbourPhase(1);
    }

    public function previousPhase(): ?RetroPhase
    {
        return $this->neighbourPhase(-1);
    }

    public function canMoveTo(RetroPhase $phase): bool
    {
        return $phase === $this->nextPhase() || $phase === $this->previousPhase();
    }

    private function neighbourPhase(int $offset): ?RetroPhase
    {
        $phases = $this->phases();
        $index = array_search($this->phase, $phases, true);

        if ($index === false) {
            return null;
        }

        return $phases[$index + $offset] ?? null;
    }
```

- [ ] **Step 6: Extract the transition into `ChangeRetroPhase`**

Create `app/Actions/Retros/ChangeRetroPhase.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Events\Retros\PhaseChanged;
use App\Models\Retro;
use Illuminate\Validation\ValidationException;

class ChangeRetroPhase
{
    /**
     * Runs inside the caller's transaction, on a retro row locked for update.
     */
    public function handle(Retro $locked, RetroPhase $phase): void
    {
        $this->ensureReachable($locked, $phase);
        $this->move($locked, $phase);
        $this->broadcast($locked, $phase);
    }

    private function ensureReachable(Retro $locked, RetroPhase $phase): void
    {
        if ($locked->canMoveTo($phase)) {
            return;
        }

        throw ValidationException::withMessages(['phase' => __('The retrospective can only move to the previous or next phase.')]);
    }

    private function move(Retro $locked, RetroPhase $phase): void
    {
        $isCompleting = $phase === RetroPhase::Completed;
        $isLeavingDiscussing = $locked->phase === RetroPhase::Discussing;

        $locked->update([
            'phase' => $phase,
            'highlighted_card_id' => $isLeavingDiscussing ? null : $locked->highlighted_card_id,
            'completed_at' => $isCompleting ? now() : null,
            'timer_ends_at' => $isCompleting ? null : $locked->timer_ends_at,
        ]);
    }

    private function broadcast(Retro $locked, RetroPhase $phase): void
    {
        (new PhaseChanged($locked->id, $phase->value))->sendToOthers();
    }
}
```

Replace `app/Http/Controllers/Retros/RetroPhasesController.php` with:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\ChangeRetroPhase;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RetroPhasesController extends Controller
{
    public function __construct(private ChangeRetroPhase $changeRetroPhase) {}

    public function update(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);

        $validated = $request->validate([
            'phase' => ['required', Rule::enum(RetroPhase::class)],
        ]);

        $phase = RetroPhase::from($validated['phase']);

        DB::transaction(function () use ($retro, $participant, $phase): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);

            $this->changeRetroPhase->handle($locked, $phase);
        });

        return response()->json(['phase' => $phase->value]);
    }
}
```

- [ ] **Step 7: Factory states and translations**

In `database/factories/RetroFactory.php` add:

```php
    public function withHealthCheck(): static
    {
        return $this->state(fn () => ['health_check_enabled' => true]);
    }

    public function withIcebreaker(): static
    {
        return $this->state(fn () => ['icebreaker_enabled' => true]);
    }
```

Add to `lang/{en,fr,es,de}.json` (keys alphabetical position does not matter; keep valid JSON):

| key | en | fr | es | de |
|---|---|---|---|---|
| `Health check` | Health check | Bilan de santé | Chequeo de salud | Gesundheitscheck |
| `Icebreaker` | Icebreaker | Brise-glace | Rompehielos | Eisbrecher |

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Retros/RetroModelTest.php tests/Feature/Retros/FacilitationTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Enums/RetroPhase.php app/Models/Retro.php app/Actions/Retros/ChangeRetroPhase.php app/Http/Controllers/Retros/RetroPhasesController.php database/migrations/2026_10_01_100000_add_phase_toggles_to_retros_table.php database/factories/RetroFactory.php lang tests/Feature/Retros/RetroModelTest.php tests/Feature/Retros/FacilitationTest.php
git commit -m "feat: add optional health check and icebreaker phases before writing

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 2: Phase toggles, phase helpers in guards, redaction and snapshot

**Files:**
- Modify: `app/Actions/Retros/RetroGuard.php`, `app/Http/Controllers/Retros/{RetroSettingsController,RetroTimersController,ColumnsController,ColumnOrdersController}.php`, `app/Actions/Retros/PresentCard.php`, `app/Actions/Retros/BuildBoardSnapshot.php`, `lang/{en,fr,es,de}.json`
- Test: `tests/Feature/Retros/FacilitationTest.php`, `tests/Feature/Retros/BoardSnapshotTest.php`, `tests/Feature/Retros/ColumnsTest.php`, `tests/Feature/Retros/RetroGuardTest.php`

**Interfaces:**
- Consumes: Task 1 (`isOpen`, `hidesOthersCards`, `phases()`).
- Produces:
  - `RetroGuard::open(Retro $retro): void` — 403 "This action is not available in the current phase." when `Completed`.
  - `PATCH /retros/{retro}/settings` accepts `health_check_enabled`, `icebreaker_enabled` (booleans, facilitator, any open phase, 422 `Move to another phase before turning this phase off.` on the current phase), broadcasting `settings.changed`. Private method `RetroSettingsController::ensureCurrentPhaseStaysOn(Retro $retro, array $validated): void`. Plan 8b calls `FreezeHealthStatements` after `$locked->update($validated)` when `health_check_enabled` becomes true; plan 8e adds `ai_summary_enabled`.
  - Snapshot `retro.phases: string[]`, `retro.healthCheckEnabled: bool`, `retro.icebreakerEnabled: bool`.
  - Column edits and column order allowed in `HealthCheck`, `Icebreaker`, `Writing`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Feature/Retros/RetroGuardTest.php`:

```php
it('allows actions in every phase but completed', function () {
    $retro = Retro::factory()->make(['phase' => RetroPhase::HealthCheck]);

    RetroGuard::open($retro);

    $retro->phase = RetroPhase::Completed;

    expect(fn () => RetroGuard::open($retro))
        ->toThrow(AuthorizationException::class, 'This action is not available in the current phase.');
});
```

(`RetroPhase`, `AuthorizationException` and `RetroGuard` are already imported in that file; add any missing `use` line.)

Append to `tests/Feature/Retros/FacilitationTest.php`:

```php
it('turns the pre-writing phases on and off', function () {
    [$retro, $user] = facilitatedRetro();

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), [
        'health_check_enabled' => true,
        'icebreaker_enabled' => true,
    ])->assertNoContent();

    expect($retro->fresh()->only(['health_check_enabled', 'icebreaker_enabled']))->toBe([
        'health_check_enabled' => true,
        'icebreaker_enabled' => true,
    ]);
    Event::assertDispatched(RetroSettingsChanged::class);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'icebreaker'])->assertOk();

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['health_check_enabled' => false])->assertNoContent();

    expect($retro->fresh()->health_check_enabled)->toBeFalse();
});

it('refuses to turn off the current phase', function (RetroPhase $phase, string $setting) {
    $retro = Retro::factory()->withHealthCheck()->withIcebreaker()->inPhase($phase)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)
        ->patchJson(route('retros.settings.update', $retro), [$setting => false])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$setting => 'Move to another phase before turning this phase off.']);

    expect($retro->fresh()->{$setting})->toBeTrue();
})->with([
    'health check' => [RetroPhase::HealthCheck, 'health_check_enabled'],
    'icebreaker' => [RetroPhase::Icebreaker, 'icebreaker_enabled'],
]);

it('refuses phase toggles from others and once completed', function (string $setting) {
    [$retro, $facilitator] = facilitatedRetro();
    [$member] = retroMember($retro);

    $this->actingAs($member)->patchJson(route('retros.settings.update', $retro), [$setting => true])->assertForbidden();

    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($facilitator)->patchJson(route('retros.settings.update', $retro), [$setting => true])->assertForbidden();
})->with(['health_check_enabled', 'icebreaker_enabled']);

it('accepts the timer and engagement settings in the pre-writing phases', function (RetroPhase $phase) {
    $retro = Retro::factory()->withHealthCheck()->withIcebreaker()->inPhase($phase)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => 120])->assertOk();
    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['cursors_enabled' => false])->assertNoContent();
})->with([RetroPhase::HealthCheck, RetroPhase::Icebreaker]);
```

Append to `tests/Feature/Retros/BoardSnapshotTest.php`:

```php
it('hides others cards again in the pre-writing phases', function (RetroPhase $phase) {
    $retro = Retro::factory()->withHealthCheck()->withIcebreaker()->inPhase($phase)->create();
    [, $viewer] = retroMember($retro);
    $othersCard = Card::factory()->create(['retro_id' => $retro->id, 'content' => 'written before moving back']);

    $snapshot = snapshotFor($retro, $viewer);

    expect(snapshotCard($snapshot, $othersCard))->toMatchArray(['hidden' => true, 'content' => null, 'author' => null, 'gif' => null])
        ->and(json_encode($snapshot))->not->toContain('written before moving back');
})->with([RetroPhase::HealthCheck, RetroPhase::Icebreaker]);

it('exposes the enabled phases and toggles', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create();
    [, $viewer] = retroMember($retro);

    expect(snapshotFor($retro, $viewer)['retro'])->toMatchArray([
        'phase' => 'icebreaker',
        'phases' => ['icebreaker', 'writing', 'grouping', 'voting', 'discussing', 'completed'],
        'healthCheckEnabled' => false,
        'icebreakerEnabled' => true,
    ]);
});
```

Append to `tests/Feature/Retros/ColumnsTest.php`:

```php
it('lets the facilitator prepare columns before writing', function (RetroPhase $phase) {
    [$retro, $user, $first, $second] = columnsRetro();
    $retro->update(['health_check_enabled' => true, 'icebreaker_enabled' => true, 'phase' => $phase]);

    $this->actingAs($user)->postJson(route('retros.columns.store', $retro), ['title' => 'Kudos', 'color' => 'purple'])->assertCreated();
    $this->actingAs($user)
        ->putJson(route('retros.columns.order.update', $retro), ['column_ids' => [$second->id, $first->id, Column::query()->where('retro_id', $retro->id)->where('title', 'Kudos')->value('id')]])
        ->assertOk();
})->with([RetroPhase::HealthCheck, RetroPhase::Icebreaker]);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/RetroGuardTest.php tests/Feature/Retros/FacilitationTest.php tests/Feature/Retros/BoardSnapshotTest.php tests/Feature/Retros/ColumnsTest.php`
Expected: FAIL — `RetroGuard::open` undefined, toggles ignored, 403 on timer in `health_check`, cards visible in `icebreaker`.

- [ ] **Step 3: Add `RetroGuard::open`**

In `app/Actions/Retros/RetroGuard.php`, after `phase()`:

```php
    public static function open(Retro $retro): void
    {
        if ($retro->phase->isOpen()) {
            return;
        }

        throw new AuthorizationException(__('This action is not available in the current phase.'));
    }
```

- [ ] **Step 4: Toggles and helpers in the settings controller**

Replace `app/Http/Controllers/Retros/RetroSettingsController.php` with:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\RetroSettingsChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RetroSettingsController extends Controller
{
    private const OpenPhaseSettings = [
        'reactions_enabled', 'cursors_enabled', 'gifs_enabled', 'hide_vote_counts', 'is_locked', 'presentation_mode',
        'health_check_enabled', 'icebreaker_enabled',
    ];

    public function update(Request $request, Retro $retro): Response
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'is_anonymous' => ['sometimes', 'boolean'],
            'votes_per_participant' => ['sometimes', 'integer', 'min:1', 'max:20'],
            'guest_access_enabled' => ['sometimes', 'boolean'],
            'reactions_enabled' => ['sometimes', 'boolean'],
            'cursors_enabled' => ['sometimes', 'boolean'],
            'gifs_enabled' => ['sometimes', 'boolean'],
            'hide_vote_counts' => ['sometimes', 'boolean'],
            'is_locked' => ['sometimes', 'boolean'],
            'presentation_mode' => ['sometimes', 'boolean'],
            'health_check_enabled' => ['sometimes', 'boolean'],
            'icebreaker_enabled' => ['sometimes', 'boolean'],
        ]);

        DB::transaction(function () use ($retro, $participant, $validated): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);

            if (array_intersect(array_keys($validated), self::OpenPhaseSettings) !== []) {
                RetroGuard::open($locked);
            }

            if (array_key_exists('votes_per_participant', $validated)) {
                RetroGuard::phase($locked, RetroPhase::Writing, RetroPhase::Grouping);
            }

            $this->ensureCurrentPhaseStaysOn($locked, $validated);

            $isDisablingAnonymity = array_key_exists('is_anonymous', $validated)
                && ! $validated['is_anonymous']
                && $locked->is_anonymous;

            if ($isDisablingAnonymity && $locked->cards()->exists()) {
                throw ValidationException::withMessages(['is_anonymous' => __('Anonymity can only be turned off before any card is written.')]);
            }

            $locked->update($validated);

            (new RetroSettingsChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function ensureCurrentPhaseStaysOn(Retro $retro, array $validated): void
    {
        $toggles = [
            'health_check_enabled' => RetroPhase::HealthCheck,
            'icebreaker_enabled' => RetroPhase::Icebreaker,
        ];

        foreach ($toggles as $setting => $phase) {
            if (($validated[$setting] ?? true) !== false) {
                continue;
            }

            if ($retro->phase !== $phase) {
                continue;
            }

            throw ValidationException::withMessages([$setting => __('Move to another phase before turning this phase off.')]);
        }
    }
}
```

(Task 3 changes the `votes_per_participant` rule and phase list.)

- [ ] **Step 5: Timer, columns and card redaction**

`app/Http/Controllers/Retros/RetroTimersController.php`: replace both `RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing);` and the `$locked` one with `RetroGuard::open($retro);` / `RetroGuard::open($locked);`, and remove the now unused `use App\Enums\RetroPhase;`.

`app/Http/Controllers/Retros/ColumnsController.php`, `authorizeEditing()`:

```php
    private function authorizeEditing(Retro $retro, Participant $participant): void
    {
        RetroGuard::facilitator($retro, $participant);
        RetroGuard::phase($retro, RetroPhase::HealthCheck, RetroPhase::Icebreaker, RetroPhase::Writing);
    }
```

`app/Http/Controllers/Retros/ColumnOrdersController.php`: replace both `RetroGuard::phase(…, RetroPhase::Writing);` calls with `RetroGuard::phase(…, RetroPhase::HealthCheck, RetroPhase::Icebreaker, RetroPhase::Writing);`.

`app/Actions/Retros/PresentCard.php`: replace

```php
        $isHidden = ! $isMine && $retro->phase === RetroPhase::Writing;
```

with

```php
        $isHidden = ! $isMine && $retro->phase->hidesOthersCards();
```

and remove the unused `use App\Enums\RetroPhase;`.

- [ ] **Step 6: Snapshot fields**

In `app/Actions/Retros/BuildBoardSnapshot.php`, inside `'retro' => [ … ]`, after `'phase' => $retro->phase->value,` add:

```php
                'phases' => array_map(fn (RetroPhase $phase) => $phase->value, $retro->phases()),
                'healthCheckEnabled' => $retro->health_check_enabled,
                'icebreakerEnabled' => $retro->icebreaker_enabled,
```

- [ ] **Step 7: Translations**

Add to `lang/{en,fr,es,de}.json`:

| key | fr | es | de |
|---|---|---|---|
| `Move to another phase before turning this phase off.` | Passez à une autre phase avant de désactiver celle-ci. | Pasa a otra fase antes de desactivar esta. | Wechsle in eine andere Phase, bevor du diese ausschaltest. |

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros`
Expected: PASS (the whole folder, because redaction, timer and column rules are shared).

- [ ] **Step 9: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app lang tests/Feature/Retros
git commit -m "feat: toggle the pre-writing phases and hide cards in them

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 3: Automatic vote limit

**Files:**
- Create: `database/migrations/2026_10_01_100100_make_votes_per_participant_nullable_on_retros_table.php`
- Modify: `app/Models/Retro.php`, `app/Http/Controllers/Retros/CardVotesController.php`, `app/Http/Controllers/Retros/RetroSettingsController.php`, `app/Actions/Retros/BuildBoardSnapshot.php`
- Test: `tests/Feature/Retros/VotingTest.php`, `tests/Feature/Retros/FacilitationTest.php`, `tests/Feature/Retros/BoardSnapshotTest.php`

**Interfaces:**
- Consumes: Task 1/2.
- Produces: `retros.votes_per_participant` nullable (`null` = automatic); `Retro::voteLimit(): int` = explicit value, else `min(10, top-level cards + 3)` (uses the loaded `cards` relation when present); settings accept `votes_per_participant: null|1–20` in `HealthCheck`, `Icebreaker`, `Writing`, `Grouping`; snapshot `retro.votesPerParticipant` = effective limit, `retro.votesAuto: bool`, `viewer.remainingVotes = max(0, voteLimit − used)`.

- [ ] **Step 1: Write the failing tests**

In `tests/Feature/Retros/VotingTest.php`, add `use App\Actions\Retros\BuildBoardSnapshot;` and `use App\Models\Participant;` to the imports, add this helper after `votingRetro()`:

```php
function votingSnapshot(Retro $retro, Participant $viewer): array
{
    return app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer);
}
```

and append:

```php
it('derives the automatic limit from the top-level cards', function (int $cards, int $expected) {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => null]);
    Card::factory()->count($cards)->create(['retro_id' => $retro->id]);

    expect($retro->fresh()->voteLimit())->toBe($expected);
})->with([
    'no cards' => [0, 3],
    'four cards' => [4, 7],
    'seven cards' => [7, 10],
    'twenty cards' => [20, 10],
]);

it('counts a group once in the automatic limit', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => null]);
    $lead = Card::factory()->create(['retro_id' => $retro->id]);
    Card::factory()->count(3)->create(['retro_id' => $retro->id, 'parent_card_id' => $lead->id]);

    expect($retro->fresh()->voteLimit())->toBe(4);
});

it('keeps a fixed limit unchanged', function () {
    $retro = Retro::factory()->create(['votes_per_participant' => 7]);
    Card::factory()->count(20)->create(['retro_id' => $retro->id]);

    expect($retro->fresh()->voteLimit())->toBe(7);
});

it('refuses votes beyond the automatic limit', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => null]);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated()->assertJsonPath('remainingVotes', 0);
    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertUnprocessable();
});

it('keeps votes already cast when the automatic limit drops', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => null]);
    [$user, $participant] = retroMember($retro);
    $cards = Card::factory()->count(4)->create(['retro_id' => $retro->id]);
    Vote::factory()->count(6)->create(['retro_id' => $retro->id, 'card_id' => $cards[0]->id, 'participant_id' => $participant->id]);
    $cards[1]->update(['parent_card_id' => $cards[0]->id]);
    $cards[2]->update(['parent_card_id' => $cards[0]->id]);

    expect($retro->fresh()->voteLimit())->toBe(5)
        ->and(Vote::query()->where('participant_id', $participant->id)->count())->toBe(6)
        ->and(votingSnapshot($retro, $participant)['viewer']['remainingVotes'])->toBe(0);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $cards[0]]))->assertUnprocessable();
});
```

Append to `tests/Feature/Retros/FacilitationTest.php`:

```php
it('switches the vote limit to automatic before voting', function (RetroPhase $phase) {
    $retro = Retro::factory()->withHealthCheck()->withIcebreaker()->inPhase($phase)->create(['votes_per_participant' => 5]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['votes_per_participant' => null])->assertNoContent();

    expect($retro->fresh()->votes_per_participant)->toBeNull();
})->with([RetroPhase::HealthCheck, RetroPhase::Icebreaker, RetroPhase::Writing, RetroPhase::Grouping]);
```

Append to `tests/Feature/Retros/BoardSnapshotTest.php`:

```php
it('sends the effective vote limit and whether it is automatic', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => null]);
    [, $viewer] = retroMember($retro);
    Card::factory()->count(2)->create(['retro_id' => $retro->id]);

    $snapshot = snapshotFor($retro, $viewer);

    expect($snapshot['retro'])->toMatchArray(['votesPerParticipant' => 5, 'votesAuto' => true])
        ->and($snapshot['viewer']['remainingVotes'])->toBe(5);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/VotingTest.php tests/Feature/Retros/FacilitationTest.php tests/Feature/Retros/BoardSnapshotTest.php`
Expected: FAIL — not-null violation on `votes_per_participant`, `voteLimit()` undefined.

- [ ] **Step 3: Migration**

`database/migrations/2026_10_01_100100_make_votes_per_participant_nullable_on_retros_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retros', function (Blueprint $table) {
            $table->unsignedSmallInteger('votes_per_participant')->nullable()->default(null)->change();
        });
    }
};
```

- [ ] **Step 4: `Retro::voteLimit()`**

In `app/Models/Retro.php`: docblock `@property int|null $votes_per_participant`; add:

```php
    public function voteLimit(): int
    {
        if ($this->votes_per_participant !== null) {
            return $this->votes_per_participant;
        }

        $topLevelCards = $this->relationLoaded('cards')
            ? $this->cards->whereNull('parent_card_id')->count()
            : $this->cards()->whereNull('parent_card_id')->count();

        return min(10, $topLevelCards + 3);
    }
```

- [ ] **Step 5: Use it everywhere**

`CardVotesController::store`: replace `if ($used >= $locked->votes_per_participant) {` with `if ($used >= $locked->voteLimit()) {`.
`CardVotesController::tally`: replace `max(0, $retro->votes_per_participant - $used)` with `max(0, $retro->voteLimit() - $used)`.

`RetroSettingsController`: the rule becomes

```php
            'votes_per_participant' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:20'],
```

and the phase check

```php
            if (array_key_exists('votes_per_participant', $validated)) {
                RetroGuard::phase($locked, RetroPhase::HealthCheck, RetroPhase::Icebreaker, RetroPhase::Writing, RetroPhase::Grouping);
            }
```

`BuildBoardSnapshot`: replace `'votesPerParticipant' => $retro->votes_per_participant,` with

```php
                'votesPerParticipant' => $retro->voteLimit(),
                'votesAuto' => $retro->votes_per_participant === null,
```

and `'remainingVotes' => max(0, $retro->votes_per_participant - (int) $myVotes->sum()),` with `'remainingVotes' => max(0, $retro->voteLimit() - (int) $myVotes->sum()),`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Retros`
Expected: PASS.

- [ ] **Step 7: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app database/migrations tests/Feature/Retros
git commit -m "feat: derive the vote limit from the cards when set to automatic

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 4: Column descriptions and longer titles

**Files:**
- Create: `database/migrations/2026_10_01_100200_add_description_to_columns_table.php`
- Modify: `app/Models/Column.php`, `app/Http/Controllers/Retros/ColumnsController.php`, `app/Actions/Retros/PresentColumns.php`, `lang/{en,fr,es,de}.json`
- Test: `tests/Feature/Retros/ColumnsTest.php`

**Interfaces:**
- Consumes: Task 2 (`authorizeEditing` phases).
- Produces: `columns.description` (nullable string ≤ 200), `columns.title` ≤ 100; `Column::$description`; `PresentColumns` items `{id, title, description, color, position}`; `POST/PATCH /retros/{retro}/columns…` accept `description` (nullable, ≤ 200); the description may change when the column has cards, title and colour may not.

- [ ] **Step 1: Write the failing tests**

In `tests/Feature/Retros/ColumnsTest.php`, change the dataset row `[['title' => str_repeat('a', 61), 'color' => 'green']],` to `[['title' => str_repeat('a', 101), 'color' => 'green']],`, add a row `[['title' => 'Ok', 'color' => 'green', 'description' => str_repeat('a', 201)]],`, and append:

```php
it('accepts titles up to 100 characters and a description', function () {
    [$retro, $user] = columnsRetro();

    $this->actingAs($user)
        ->postJson(route('retros.columns.store', $retro), [
            'title' => str_repeat('a', 100),
            'color' => 'green',
            'description' => 'What pushed us forward',
        ])
        ->assertCreated()
        ->assertJsonPath('columns.2.description', 'What pushed us forward');
});

it('edits the description of a column with cards but not its title', function () {
    [$retro, $user, $first] = columnsRetro();
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $first->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.columns.update', [$retro, $first]), ['description' => 'Clarified'])
        ->assertOk()
        ->assertJsonPath('columns.0.description', 'Clarified');

    $this->actingAs($user)
        ->patchJson(route('retros.columns.update', [$retro, $first]), ['title' => 'Renamed', 'description' => 'Again'])
        ->assertUnprocessable();

    expect($first->fresh()->only(['title', 'description']))->toBe(['title' => 'First', 'description' => 'Clarified']);
    Event::assertDispatched(ColumnsChanged::class, fn (ColumnsChanged $event) => $event->columns[0]['description'] === 'Clarified');
});

it('clears a description with null', function () {
    [$retro, $user, $first] = columnsRetro();
    $first->update(['description' => 'Old']);

    $this->actingAs($user)->patchJson(route('retros.columns.update', [$retro, $first]), ['description' => null])->assertOk();

    expect($first->fresh()->description)->toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/ColumnsTest.php`
Expected: FAIL — unknown column `description`, and the 100-character title is refused (422).

- [ ] **Step 3: Migration**

`database/migrations/2026_10_01_100200_add_description_to_columns_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('columns', function (Blueprint $table) {
            $table->string('title', 100)->change();
            $table->string('description', 200)->nullable();
        });
    }
};
```

- [ ] **Step 4: Model, controller, presenter**

`app/Models/Column.php`: docblock `@property string|null $description`; `#[Fillable(['title', 'description', 'color', 'position'])]`.

`app/Http/Controllers/Retros/ColumnsController.php`:

```php
    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        $this->authorizeEditing($retro, $participant);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:200'],
            'color' => ['required', Rule::enum(ColumnColor::class)],
        ]);

        return $this->respond($retro, $participant, function (Retro $locked) use ($validated): void {
            $locked->columns()->create([
                ...$validated,
                'position' => $locked->columns()->count(),
            ]);
        }, 201);
    }

    public function update(Request $request, Retro $retro, Column $column): JsonResponse
    {
        $participant = Participant::current($request);

        $this->authorizeEditing($retro, $participant);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:100'],
            'description' => ['sometimes', 'nullable', 'string', 'max:200'],
            'color' => ['sometimes', Rule::enum(ColumnColor::class)],
        ]);

        return $this->respond($retro, $participant, function (Retro $locked) use ($column, $validated): void {
            $lockedColumn = $locked->columns()->whereKey($column->id)->firstOrFail();

            if (array_diff(array_keys($validated), ['description']) !== []) {
                $this->ensureEmpty($lockedColumn);
            }

            $lockedColumn->update($validated);
        });
    }
```

`app/Actions/Retros/PresentColumns.php`:

```php
    /**
     * @return array<int, array{
     *     id: string,
     *     title: string,
     *     description: ?string,
     *     color: string,
     *     position: int
     * }>
     */
    public function handle(Retro $retro): array
    {
        return $retro->columns()->get()->map(fn (Column $column) => [
            'id' => $column->id,
            'title' => $column->title,
            'description' => $column->description,
            'color' => $column->color->value,
            'position' => $column->position,
        ])->values()->all();
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Retros/ColumnsTest.php tests/Feature/Retros/BoardSnapshotTest.php`
Expected: PASS.

- [ ] **Step 6: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app database/migrations tests/Feature/Retros/ColumnsTest.php
git commit -m "feat: describe columns and allow longer column titles

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 5: Template categories, catalogue definitions and English texts

**Files:**
- Create: `app/Enums/TemplateCategory.php`, `app/Support/RetroTemplates/TemplateDefinition.php`, `app/Support/RetroTemplates/TemplateCatalogue.php`, `lang/en/templates.php`
- Test: create `tests/Feature/Retros/TemplateCatalogueTest.php`

**Interfaces:**
- Consumes: `App\Enums\ColumnColor`.
- Produces:
  - `App\Enums\TemplateCategory`: `Essentials = 'essentials'`, `TeamMood = 'team_mood'`, `Themed = 'themed'`, `Ideas = 'ideas'`, `Analysis = 'analysis'`; `label(): string`; `static options(): array<int, array{value: string, label: string}>`.
  - `App\Support\RetroTemplates\TemplateDefinition` (public `string $key`, `bool $isCommon`, `?TemplateCategory $category`, `array<int, array{color: ColumnColor, emoji: ?string}> $columns`; `name(): string`; `translatedColumns(): array<int, array{title: string, description: string, color: ColumnColor}>` in the current locale, emoji prefixed to the title).
  - `App\Support\RetroTemplates\TemplateCatalogue::all(): array<int, TemplateDefinition>` (catalogue order, `custom` last), `find(string $key): ?TemplateDefinition`, `has(string $key): bool`, constant `TemplateCatalogue::Custom = 'custom'`.
  - `lang/en/templates.php`: `categories.{value}`, `{key}.name`, `{key}.columns.{index}.title|description`.

Key ↔ `templates.md` number: 1 `went_well_to_improve_actions`, 2 `start_stop_continue`, 3 `four_ls`, 4 `sailboat`, 5 `mad_sad_glad`, 6 `thumbs_up_down_ideas_recognition`, 7 `lean_coffee`, 8 `original_four`, 9 `starfish`, 10 `three_little_pigs`, 11 `dot_voting`, 12 `speed_car`, 13 `happy_meh_sad`, 14 `idea_prioritization`, 15 `harry_potter`, 16 `kalm`, 17 `marie_kondo`, 18 `game_of_thrones`, 19 `love_want_hate_learn`, 20 `kudos`, 21 `pros_and_cons`, 22 `sprint_diagnostics`, 23 `three_ls`, 24 `daki`, 25 `swot`, 26 `good_bad_ugly`, 27 `kanban`, 28 `six_thinking_hats`, 29 `post_mortem`, 30 `rose_bud_thorn`, 31 `hopes_and_fears`, 32 `good_bad_better_best`, 33 `likes_wishes_wonders`, 34 `okr`, 35 `www`, 36 `safety_check`, 37 `fishbone`, 38 `wrap`, 39 `learning_matrix`, 40 `raid`, 41 `liked_lacked_change`, 42 `time_added_stolen_restored`, 43 `appreciation`, 44 `christmas`, 45 `good_bad_learned_learning`, 46 `halloween`, 47 `plus_delta`, 48 `energy_levels`, 49 `weather_forecast`, 50 `esvp`, 51 `soar`, 52 `pre_mortem`. The five existing keys keep their current names and column titles (no emoji); obvious typos of the research copy are fixed ("stong", "Strenghts", "Didn't Worked", "realtor meeting").

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Retros/TemplateCatalogueTest.php`:

```php
<?php

use App\Enums\ColumnColor;
use App\Enums\TemplateCategory;
use App\Support\RetroTemplates\TemplateCatalogue;
use App\Support\RetroTemplates\TemplateDefinition;

function catalogueKeys(): array
{
    return array_map(fn (TemplateDefinition $definition) => $definition->key, TemplateCatalogue::all());
}

it('lists the 52 templates in catalogue order with custom last', function () {
    $keys = catalogueKeys();

    expect($keys)->toHaveCount(53)
        ->and(array_unique($keys))->toBe($keys)
        ->and(array_slice($keys, 0, 8))->toBe([
            'went_well_to_improve_actions', 'start_stop_continue', 'four_ls', 'sailboat',
            'mad_sad_glad', 'thumbs_up_down_ideas_recognition', 'lean_coffee', 'original_four',
        ])
        ->and($keys[52])->toBe(TemplateCatalogue::Custom);

    foreach ($keys as $key) {
        expect($key)->toMatch('/^[a-z0-9_]+$/');
    }
});

it('marks the first eight templates as common', function () {
    $common = array_values(array_filter(TemplateCatalogue::all(), fn (TemplateDefinition $definition) => $definition->isCommon));

    expect(array_map(fn (TemplateDefinition $definition) => $definition->key, $common))->toBe(array_slice(catalogueKeys(), 0, 8));
});

it('assigns every built-in template but custom to exactly one category', function () {
    $counts = collect(TemplateCatalogue::all())
        ->reject(fn (TemplateDefinition $definition) => $definition->key === TemplateCatalogue::Custom)
        ->countBy(fn (TemplateDefinition $definition) => $definition->category?->value)
        ->all();

    expect($counts)->toEqual(['essentials' => 23, 'team_mood' => 8, 'themed' => 9, 'ideas' => 6, 'analysis' => 6])
        ->and(TemplateCatalogue::find('custom')?->category)->toBeNull()
        ->and(TemplateCatalogue::find('custom')?->columns)->toBe([])
        ->and(TemplateCatalogue::find('sailboat')?->category)->toBe(TemplateCategory::Themed)
        ->and(TemplateCatalogue::find('kudos')?->category)->toBe(TemplateCategory::TeamMood)
        ->and(TemplateCatalogue::find('lean_coffee')?->category)->toBe(TemplateCategory::Ideas)
        ->and(TemplateCatalogue::find('pre_mortem')?->category)->toBe(TemplateCategory::Analysis)
        ->and(TemplateCatalogue::find('plus_delta')?->category)->toBe(TemplateCategory::Essentials);
});

it('keeps the five original templates, names and columns', function () {
    app()->setLocale('en');

    $titles = fn (string $key) => array_column(TemplateCatalogue::find($key)?->translatedColumns() ?? [], 'title');

    expect(TemplateCatalogue::find('start_stop_continue')?->name())->toBe('Start, Stop, Continue')
        ->and($titles('start_stop_continue'))->toBe(['Start', 'Stop', 'Continue'])
        ->and($titles('mad_sad_glad'))->toBe(['Mad', 'Sad', 'Glad'])
        ->and($titles('four_ls'))->toBe(['Liked', 'Learned', 'Lacked', 'Longed for'])
        ->and($titles('went_well_to_improve_actions'))->toBe(['Went well', 'To improve', 'Action ideas'])
        ->and(array_column(TemplateCatalogue::find('mad_sad_glad')?->translatedColumns() ?? [], 'color'))
        ->toBe([ColumnColor::Red, ColumnColor::Blue, ColumnColor::Green]);
});

it('puts the column emoji in front of the title', function () {
    app()->setLocale('en');

    expect(TemplateCatalogue::find('thumbs_up_down_ideas_recognition')?->translatedColumns()[0]['title'])->toBe('👍 Thumbs up');
});

it('finds only known keys', function () {
    expect(TemplateCatalogue::has('sailboat'))->toBeTrue()
        ->and(TemplateCatalogue::has('workspace'))->toBeFalse()
        ->and(TemplateCatalogue::find('nope'))->toBeNull();
});

it('translates every template within the column limits', function (string $locale) {
    app()->setLocale($locale);

    foreach (TemplateCatalogue::all() as $definition) {
        $translatedColumns = trans("templates.{$definition->key}.columns", [], $locale);

        expect($definition->name())->not->toBe("templates.{$definition->key}.name")
            ->and(is_array($translatedColumns) ? count($translatedColumns) : 0)->toBe(count($definition->columns), $definition->key);

        foreach ($definition->translatedColumns() as $column) {
            expect(mb_strlen($column['title']))->toBeGreaterThan(0)->toBeLessThanOrEqual(100)
                ->and(mb_strlen($column['description']))->toBeGreaterThan(0)->toBeLessThanOrEqual(200);
        }
    }

    foreach (TemplateCategory::cases() as $category) {
        expect($category->label())->not->toBe("templates.categories.{$category->value}");
    }
})->with(['en']);
```

(`custom` has no columns: `trans('templates.custom.columns')` returns `[]`, count 0.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/TemplateCatalogueTest.php`
Expected: FAIL — `Class "App\Support\RetroTemplates\TemplateCatalogue" not found`.

- [ ] **Step 3: Category enum**

`vendor/bin/sail artisan make:enum TemplateCategory --no-interaction` (or create the file) — `app/Enums/TemplateCategory.php`:

```php
<?php

namespace App\Enums;

enum TemplateCategory: string
{
    case Essentials = 'essentials';
    case TeamMood = 'team_mood';
    case Themed = 'themed';
    case Ideas = 'ideas';
    case Analysis = 'analysis';

    public function label(): string
    {
        $line = __("templates.categories.{$this->value}");

        return is_string($line) ? $line : $this->value;
    }

    /**
     * @return array<int, array{
     *     value: string,
     *     label: string
     * }>
     */
    public static function options(): array
    {
        return array_map(fn (self $category) => [
            'value' => $category->value,
            'label' => $category->label(),
        ], self::cases());
    }
}
```

- [ ] **Step 4: Definition value object**

`app/Support/RetroTemplates/TemplateDefinition.php`:

```php
<?php

namespace App\Support\RetroTemplates;

use App\Enums\ColumnColor;
use App\Enums\TemplateCategory;

class TemplateDefinition
{
    /**
     * @param  array<int, array{color: ColumnColor, emoji: ?string}>  $columns
     */
    public function __construct(
        public string $key,
        public bool $isCommon,
        public ?TemplateCategory $category,
        public array $columns,
    ) {}

    public function name(): string
    {
        return $this->line("templates.{$this->key}.name");
    }

    /**
     * @return array<int, array{
     *     title: string,
     *     description: string,
     *     color: ColumnColor
     * }>
     */
    public function translatedColumns(): array
    {
        $columns = [];

        foreach ($this->columns as $index => $column) {
            $title = $this->line("templates.{$this->key}.columns.{$index}.title");

            $columns[] = [
                'title' => $column['emoji'] === null ? $title : "{$column['emoji']} {$title}",
                'description' => $this->line("templates.{$this->key}.columns.{$index}.description"),
                'color' => $column['color'],
            ];
        }

        return $columns;
    }

    private function line(string $key): string
    {
        $line = __($key);

        return is_string($line) ? $line : $key;
    }
}
```

- [ ] **Step 5: The catalogue**

`app/Support/RetroTemplates/TemplateCatalogue.php`:

```php
<?php

namespace App\Support\RetroTemplates;

use App\Enums\ColumnColor;
use App\Enums\TemplateCategory;

class TemplateCatalogue
{
    public const Custom = 'custom';

    private const CommonCount = 8;

    /**
     * Key => [category, column colours], in the order of docs/superpowers/research/qretro/templates.md.
     * Positive columns are green, negative ones red.
     */
    private const Templates = [
        'went_well_to_improve_actions' => ['essentials', ['green', 'amber', 'blue']],
        'start_stop_continue' => ['essentials', ['green', 'red', 'blue']],
        'four_ls' => ['essentials', ['green', 'blue', 'amber', 'purple']],
        'sailboat' => ['themed', ['green', 'red', 'amber', 'blue']],
        'mad_sad_glad' => ['essentials', ['red', 'blue', 'green']],
        'thumbs_up_down_ideas_recognition' => ['essentials', ['green', 'red', 'blue', 'purple']],
        'lean_coffee' => ['ideas', ['blue', 'amber', 'purple']],
        'original_four' => ['essentials', ['green', 'red', 'blue', 'amber']],
        'starfish' => ['essentials', ['green', 'amber', 'blue', 'purple', 'red']],
        'three_little_pigs' => ['themed', ['red', 'amber', 'green']],
        'dot_voting' => ['ideas', ['blue']],
        'speed_car' => ['themed', ['green', 'red']],
        'happy_meh_sad' => ['team_mood', ['green', 'amber', 'red']],
        'idea_prioritization' => ['ideas', ['blue', 'amber', 'purple']],
        'harry_potter' => ['themed', ['green', 'blue', 'red', 'purple', 'amber']],
        'kalm' => ['essentials', ['green', 'blue', 'amber', 'purple']],
        'marie_kondo' => ['themed', ['green', 'red', 'blue']],
        'game_of_thrones' => ['themed', ['green', 'red', 'blue', 'amber']],
        'love_want_hate_learn' => ['essentials', ['green', 'blue', 'red', 'amber']],
        'kudos' => ['team_mood', ['purple', 'green', 'amber', 'blue']],
        'pros_and_cons' => ['ideas', ['green', 'red']],
        'sprint_diagnostics' => ['essentials', ['blue', 'amber', 'purple', 'slate']],
        'three_ls' => ['essentials', ['green', 'blue', 'amber']],
        'daki' => ['essentials', ['red', 'blue', 'green', 'amber']],
        'swot' => ['analysis', ['green', 'red', 'blue', 'amber']],
        'good_bad_ugly' => ['essentials', ['green', 'red', 'slate']],
        'kanban' => ['ideas', ['blue', 'amber', 'green']],
        'six_thinking_hats' => ['themed', ['green', 'blue', 'slate', 'red', 'purple', 'amber']],
        'post_mortem' => ['analysis', ['green', 'red', 'blue', 'amber', 'purple']],
        'rose_bud_thorn' => ['essentials', ['green', 'blue', 'red']],
        'hopes_and_fears' => ['team_mood', ['green', 'red']],
        'good_bad_better_best' => ['essentials', ['green', 'red', 'blue', 'purple']],
        'likes_wishes_wonders' => ['essentials', ['green', 'blue', 'amber']],
        'okr' => ['ideas', ['blue', 'amber', 'purple']],
        'www' => ['essentials', ['green', 'amber', 'red']],
        'safety_check' => ['team_mood', ['green', 'blue', 'amber', 'purple', 'red']],
        'fishbone' => ['analysis', ['blue', 'amber', 'purple', 'slate', 'red', 'green']],
        'wrap' => ['essentials', ['blue', 'green', 'red', 'amber']],
        'learning_matrix' => ['essentials', ['green', 'red', 'blue', 'purple']],
        'raid' => ['analysis', ['red', 'amber', 'purple', 'blue']],
        'liked_lacked_change' => ['essentials', ['green', 'red', 'blue', 'amber']],
        'time_added_stolen_restored' => ['essentials', ['green', 'red', 'blue']],
        'appreciation' => ['team_mood', ['green', 'blue', 'red', 'amber', 'purple']],
        'christmas' => ['themed', ['amber', 'green', 'blue', 'purple']],
        'good_bad_learned_learning' => ['essentials', ['green', 'red', 'blue', 'amber']],
        'halloween' => ['themed', ['purple', 'slate', 'amber', 'blue', 'green']],
        'plus_delta' => ['essentials', ['green', 'amber']],
        'energy_levels' => ['team_mood', ['green', 'amber', 'red', 'blue']],
        'weather_forecast' => ['team_mood', ['red', 'amber', 'blue', 'green']],
        'esvp' => ['team_mood', ['blue', 'amber', 'purple', 'slate']],
        'soar' => ['analysis', ['green', 'blue', 'purple', 'amber']],
        'pre_mortem' => ['analysis', ['red', 'amber', 'purple', 'blue']],
        self::Custom => [null, []],
    ];

    private const ColumnEmoji = [
        'thumbs_up_down_ideas_recognition' => ['👍', '👎', '💡', '🏆'],
        'wrap' => ['😇', '🤗', '😨', '😵'],
        'appreciation' => ['😃', '🤔', '😢', '✅', '🙏'],
    ];

    /**
     * @return array<int, TemplateDefinition>
     */
    public static function all(): array
    {
        $definitions = [];

        foreach (array_keys(self::Templates) as $position => $key) {
            [$category, $colors] = self::Templates[$key];
            $emoji = self::ColumnEmoji[$key] ?? [];

            $definitions[] = new TemplateDefinition(
                key: $key,
                isCommon: $position < self::CommonCount,
                category: $category === null ? null : TemplateCategory::from($category),
                columns: array_map(
                    fn (string $color, int $index): array => ['color' => ColumnColor::from($color), 'emoji' => $emoji[$index] ?? null],
                    $colors,
                    array_keys($colors),
                ),
            );
        }

        return $definitions;
    }

    public static function find(string $key): ?TemplateDefinition
    {
        foreach (self::all() as $definition) {
            if ($definition->key === $key) {
                return $definition;
            }
        }

        return null;
    }

    public static function has(string $key): bool
    {
        return self::find($key) !== null;
    }
}
```

- [ ] **Step 6: English texts**

`lang/en/templates.php`:

```php
<?php

return [
    'categories' => [
        'essentials' => 'Essentials',
        'team_mood' => 'Team & mood',
        'themed' => 'Themed & fun',
        'ideas' => 'Ideas & planning',
        'analysis' => 'Analysis',
    ],
    'went_well_to_improve_actions' => [
        'name' => 'Went well, To improve, Action ideas',
        'columns' => [
            ['title' => 'Went well', 'description' => 'What worked and is worth repeating on purpose next sprint'],
            ['title' => 'To improve', 'description' => 'Where the team lost momentum — problems, not people'],
            ['title' => 'Action ideas', 'description' => 'Concrete steps with an owner and a date, not intentions'],
        ],
    ],
    'start_stop_continue' => [
        'name' => 'Start, Stop, Continue',
        'columns' => [
            ['title' => 'Start', 'description' => 'New practices worth trying in the next cycle'],
            ['title' => 'Stop', 'description' => 'Habits that get in the way and should end now'],
            ['title' => 'Continue', 'description' => 'What already works and must survive the next change'],
        ],
    ],
    'four_ls' => [
        'name' => 'Liked, Learned, Lacked, Longed for',
        'columns' => [
            ['title' => 'Liked', 'description' => 'What you enjoyed or valued about the period'],
            ['title' => 'Learned', 'description' => 'What you know now that you did not know before'],
            ['title' => 'Lacked', 'description' => 'What was missing and made the work harder'],
            ['title' => 'Longed for', 'description' => 'What you wish existed, even if it is not ours to build'],
        ],
    ],
    'sailboat' => [
        'name' => 'Sailboat',
        'columns' => [
            ['title' => 'What is the wind pushing our sails that makes us go fast?', 'description' => 'What pushed us forward and we could repeat on purpose'],
            ['title' => 'What anchors are holding us back?', 'description' => 'What slows us down and adds drag every sprint'],
            ['title' => 'What rocks are ahead of us that risk our future?', 'description' => 'Risks ahead that will hurt us if nothing changes'],
            ['title' => 'What is our ideal island destination?', 'description' => 'The goal we are sailing to — agree on this before the rest'],
        ],
    ],
    'mad_sad_glad' => [
        'name' => 'Mad, Sad, Glad',
        'columns' => [
            ['title' => 'Mad', 'description' => 'What made you angry — the things that went wrong more than once'],
            ['title' => 'Sad', 'description' => 'What was disappointing — expectations that were never met'],
            ['title' => 'Glad', 'description' => 'What went well and is worth protecting next sprint'],
        ],
    ],
    'thumbs_up_down_ideas_recognition' => [
        'name' => 'Thumbs up, Thumbs down, New ideas, Recognition',
        'columns' => [
            ['title' => 'Thumbs up', 'description' => 'What went well this sprint'],
            ['title' => 'Thumbs down', 'description' => 'What went wrong or felt frustrating'],
            ['title' => 'New ideas', 'description' => 'Ideas worth trying, even half-formed ones'],
            ['title' => 'Recognition', 'description' => "Credit for people who made someone else's work easier"],
        ],
    ],
    'lean_coffee' => [
        'name' => 'Lean Coffee',
        'columns' => [
            ['title' => 'To discuss', 'description' => 'Proposed topics, ranked by votes'],
            ['title' => 'Discussing', 'description' => 'The single topic in play right now'],
            ['title' => 'Discussed', 'description' => 'Finished topics — check each one for a commitment'],
        ],
    ],
    'original_four' => [
        'name' => 'Original 4',
        'columns' => [
            ['title' => 'What went well?', 'description' => 'Successes worth naming out loud, however small'],
            ['title' => "What didn't go so well?", 'description' => 'Problems and misses — the facts, before the reasons'],
            ['title' => 'What have I learned?', 'description' => 'Insights you would pass to a teammate starting the same work'],
            ['title' => 'What still puzzles me?', 'description' => 'Open questions the team has not answered yet'],
        ],
    ],
    'starfish' => [
        'name' => 'Starfish',
        'columns' => [
            ['title' => 'Keep doing', 'description' => 'Working at the right level — protect it when we get busy'],
            ['title' => 'Less of', 'description' => 'Valuable in smaller doses, not something to abolish'],
            ['title' => 'More of', 'description' => 'Already happens occasionally, deserves a bigger share of the week'],
            ['title' => 'Start doing', 'description' => 'A new practice to try — one or two per sprint, no more'],
            ['title' => 'Stop doing', 'description' => 'No remaining value at all'],
        ],
    ],
    'three_little_pigs' => [
        'name' => 'Three Little Pigs',
        'columns' => [
            ['title' => 'House of straw', 'description' => 'Things that could easily fall apart'],
            ['title' => 'House of sticks', 'description' => 'Things that are working but could be improved'],
            ['title' => 'House of bricks', 'description' => 'Things that are strong and stable'],
        ],
    ],
    'dot_voting' => [
        'name' => 'Dot Voting',
        'columns' => [
            ['title' => 'Topics and ideas', 'description' => 'Every option under consideration — one card per option, then vote'],
        ],
    ],
    'speed_car' => [
        'name' => 'Speed Car',
        'columns' => [
            ['title' => 'Engine', 'description' => 'What makes us move faster?'],
            ['title' => 'Parachute', 'description' => 'What is slowing us down?'],
        ],
    ],
    'happy_meh_sad' => [
        'name' => 'Happy, Meh, Sad',
        'columns' => [
            ['title' => 'Happy :)', 'description' => 'Moments that gave the team energy'],
            ['title' => 'Meh :|', 'description' => 'Things that were neither good nor bad — and that is the signal'],
            ['title' => 'Sad :(', 'description' => 'What drained the team or went clearly wrong'],
        ],
    ],
    'idea_prioritization' => [
        'name' => 'Idea Prioritization',
        'columns' => [
            ['title' => 'Low priority', 'description' => 'Worth doing eventually, nothing breaks if it waits'],
            ['title' => 'Medium priority', 'description' => 'Should happen in the next cycle or two'],
            ['title' => 'High priority', 'description' => 'Costs the team or customers now — pick these up first'],
        ],
    ],
    'harry_potter' => [
        'name' => 'Harry Potter',
        'columns' => [
            ['title' => 'Felix Felicis', 'description' => 'Good things!'],
            ['title' => "Baruffio's Brain Elixir", 'description' => 'What we learned!'],
            ['title' => 'Petrificus Totalus', 'description' => 'What slowed us down?'],
            ['title' => 'Triwizard Cup', 'description' => 'Shout-outs!'],
            ['title' => 'Action items', 'description' => 'Things to take into consideration'],
        ],
    ],
    'kalm' => [
        'name' => 'KALM (Keep, Add, More, Less)',
        'columns' => [
            ['title' => 'Keep', 'description' => 'Works today and we would lose it first under pressure'],
            ['title' => 'Add', 'description' => 'Something we do not have yet and want to try'],
            ['title' => 'More', 'description' => 'Already happens occasionally and should happen routinely'],
            ['title' => 'Less', 'description' => 'Useful in smaller doses — reduce it rather than abolish it'],
        ],
    ],
    'marie_kondo' => [
        'name' => 'Marie Kondo',
        'columns' => [
            ['title' => 'Brings you joy', 'description' => 'What went well and is happy to stay'],
            ['title' => 'Throw out', 'description' => 'What went wrong and should not stay'],
            ['title' => 'Recycle', 'description' => 'What you want to improve and reuse'],
        ],
    ],
    'game_of_thrones' => [
        'name' => 'Game of Thrones',
        'columns' => [
            ['title' => 'The castle', 'description' => 'What are we great at?'],
            ['title' => 'The hole', 'description' => 'What are the current issues and problems?'],
            ['title' => 'The wall', 'description' => 'What could make us a better team?'],
            ['title' => 'The White Walkers', 'description' => 'What are the potential risks and challenges?'],
        ],
    ],
    'love_want_hate_learn' => [
        'name' => 'Love, Want, Hate, Learn',
        'columns' => [
            ['title' => 'I love…', 'description' => 'What you genuinely enjoy about how the team works'],
            ['title' => 'I want to…', 'description' => 'Changes you want, phrased as your own wish'],
            ['title' => 'I hate…', 'description' => 'What frustrates you — the honest, unfiltered version'],
            ['title' => 'Now I know that…', 'description' => 'Discoveries from this sprint the whole team should share'],
        ],
    ],
    'kudos' => [
        'name' => 'Kudos',
        'columns' => [
            ['title' => 'Kudos', 'description' => 'Thank a specific person for something specific'],
            ['title' => 'Went well', 'description' => 'What worked and should be protected next sprint'],
            ['title' => 'To improve', 'description' => 'Where the team lost time or quality'],
            ['title' => 'Action items', 'description' => 'Steps with an owner, taken out of the column above'],
        ],
    ],
    'pros_and_cons' => [
        'name' => 'Pros and Cons',
        'columns' => [
            ['title' => 'Pros', 'description' => 'Arguments for the option — benefits, not hopes'],
            ['title' => 'Cons', 'description' => 'Costs, risks and what the option locks the team into'],
        ],
    ],
    'sprint_diagnostics' => [
        'name' => 'Sprint Diagnostics',
        'columns' => [
            ['title' => 'How was this sprint? Rate it 1–10 (communication, collaboration, quality, pressure)', 'description' => 'A number plus one sentence on what drove it'],
            ['title' => 'Big like or big dislike', 'description' => 'The single strongest positive or negative moment of the sprint'],
            ['title' => 'What could we do even better or differently? How?', 'description' => 'Improvements phrased as a change, not a complaint'],
            ['title' => 'Actions', 'description' => 'Owner and date for each change the team agreed on'],
        ],
    ],
    'three_ls' => [
        'name' => '3 Ls (Like, Learned, Lacked)',
        'columns' => [
            ['title' => 'Like', 'description' => 'What you appreciated about the sprint'],
            ['title' => 'Learned', 'description' => 'New knowledge — about the product, the system or the team'],
            ['title' => 'Lacked', 'description' => 'What was missing: information, time, access or a decision'],
        ],
    ],
    'daki' => [
        'name' => 'DAKI (Drop, Add, Keep, Improve)',
        'columns' => [
            ['title' => 'Drop', 'description' => 'No remaining value — a report nobody reads, a step already automated'],
            ['title' => 'Add', 'description' => 'A new practice to try, one or two per sprint'],
            ['title' => 'Keep', 'description' => 'Works today and should be defended under pressure'],
            ['title' => 'Improve', 'description' => 'Nearly right — needs fixing rather than removing'],
        ],
    ],
    'swot' => [
        'name' => 'SWOT Analysis',
        'columns' => [
            ['title' => 'Strengths', 'description' => 'Internal advantages the team can rely on'],
            ['title' => 'Weaknesses', 'description' => 'Internal gaps that cost the team time or quality'],
            ['title' => 'Opportunities', 'description' => 'External openings worth taking while they are open'],
            ['title' => 'Threats', 'description' => 'External risks that would hurt if nothing changes'],
        ],
    ],
    'good_bad_ugly' => [
        'name' => 'The Good, the Bad and the Ugly',
        'columns' => [
            ['title' => 'The good', 'description' => 'What went well or worked well'],
            ['title' => 'The bad', 'description' => "What didn't go as planned, or problems that surfaced"],
            ['title' => 'The ugly', 'description' => "Things the team couldn't change but should be able to call out"],
        ],
    ],
    'kanban' => [
        'name' => 'Kanban',
        'columns' => [
            ['title' => 'To do', 'description' => 'Agreed work not started yet'],
            ['title' => 'Doing', 'description' => 'In progress right now, with a name attached'],
            ['title' => 'Done', 'description' => 'Finished and verified — proof the team moves'],
        ],
    ],
    'six_thinking_hats' => [
        'name' => 'Six Thinking Hats',
        'columns' => [
            ['title' => 'Green hat', 'description' => 'Creativity: alternatives and ideas, no judgement yet'],
            ['title' => 'Blue hat', 'description' => 'Process: what this discussion is for and what stays out of it'],
            ['title' => 'White hat', 'description' => 'Facts: numbers and observations, no interpretation'],
            ['title' => 'Red hat', 'description' => 'Feelings: gut reactions, no justification required'],
            ['title' => 'Black hat', 'description' => 'Caution: risks and what could go wrong'],
            ['title' => 'Yellow hat', 'description' => 'Benefits: value and what already works'],
        ],
    ],
    'post_mortem' => [
        'name' => 'Post-mortem',
        'columns' => [
            ['title' => 'What we liked', 'description' => 'What held up under pressure and should stay'],
            ['title' => 'What we missed', 'description' => 'Gaps the incident exposed: alerts, docs, access'],
            ['title' => 'What I learned', 'description' => 'What each person now knows that they did not before'],
            ['title' => 'For next time', 'description' => 'Follow-ups with an owner so the same failure is caught earlier'],
            ['title' => 'Appreciations', 'description' => 'Credit for people who carried the incident'],
        ],
    ],
    'rose_bud_thorn' => [
        'name' => 'Rose, Bud, Thorn',
        'columns' => [
            ['title' => 'Rose', 'description' => 'What is clearly working right now'],
            ['title' => 'Bud', 'description' => 'Early signs worth investing in before they fade'],
            ['title' => 'Thorn', 'description' => 'What hurts and keeps hurting until someone fixes it'],
        ],
    ],
    'hopes_and_fears' => [
        'name' => 'Hopes and Fears',
        'columns' => [
            ['title' => 'Hopes', 'description' => 'What the team wants this project or cycle to become'],
            ['title' => 'Fears', 'description' => 'What could go wrong — said out loud while it is still cheap'],
        ],
    ],
    'good_bad_better_best' => [
        'name' => 'Good, Bad, Better, Best',
        'columns' => [
            ['title' => 'Good', 'description' => 'Went well'],
            ['title' => 'Bad', 'description' => 'Went poorly'],
            ['title' => 'Better', 'description' => 'Improvement opportunities'],
            ['title' => 'Best', 'description' => 'Outstanding results, performances, actions and people'],
        ],
    ],
    'likes_wishes_wonders' => [
        'name' => 'Likes, Wishes, Wonders',
        'columns' => [
            ['title' => 'Likes', 'description' => 'What you appreciate about how the team works today'],
            ['title' => 'Wishes', 'description' => 'Changes you would like, phrased as a wish rather than a demand'],
            ['title' => 'Wonders', 'description' => 'Open questions and doubts nobody has answered yet'],
        ],
    ],
    'okr' => [
        'name' => 'OKR (Objectives and Key Results)',
        'columns' => [
            ['title' => 'Key results', 'description' => 'Measurable outcomes that prove the objective is met'],
            ['title' => 'Initiatives', 'description' => 'Work the team will actually do to move those numbers'],
            ['title' => 'Objectives', 'description' => 'Where the team wants to be — qualitative and ambitious'],
        ],
    ],
    'www' => [
        'name' => "WWW (Worked well, Kinda worked, Didn't work)",
        'columns' => [
            ['title' => 'Worked well', 'description' => 'Clear successes to keep deliberately'],
            ['title' => 'Kinda worked', 'description' => 'Half-successes: the idea was right, the execution was not'],
            ['title' => "Didn't work", 'description' => 'What failed and should not be repeated as is'],
        ],
    ],
    'safety_check' => [
        'name' => 'Safety Check',
        'columns' => [
            ['title' => '5', 'description' => 'No problem — I will say anything, including uncomfortable things'],
            ['title' => '4', 'description' => 'Mostly comfortable — I would soften how I phrase one or two topics'],
            ['title' => '3', 'description' => 'Selective — I will talk about process, not about people or my own mistakes'],
            ['title' => '2', 'description' => 'Guarded — I will agree with others but raise nothing myself'],
            ['title' => '1', 'description' => 'Silent — I will say nothing meaningful in this session'],
        ],
    ],
    'fishbone' => [
        'name' => 'Fishbone Analysis',
        'columns' => [
            ['title' => 'People', 'description' => 'Causes rooted in skills, staffing or knowledge held by one person'],
            ['title' => 'Process', 'description' => 'Causes in how the team works: steps skipped, rules unwritten'],
            ['title' => 'Tools', 'description' => 'Causes in tooling: gaps in alerts, tests, environments'],
            ['title' => 'Program', 'description' => 'Causes in planning: scope, funding, deadlines'],
            ['title' => 'Environment', 'description' => 'Causes outside the team: vendors, traffic, org changes'],
            ['title' => 'Solutions', 'description' => 'Fixes that address the causes above, with an owner'],
        ],
    ],
    'wrap' => [
        'name' => 'WRAP (Wishes, Risks, Appreciations, Puzzles)',
        'columns' => [
            ['title' => 'What are your wishes?', 'description' => 'What you want for the team going forward'],
            ['title' => 'What do you appreciate?', 'description' => 'Credit for people whose work made yours easier'],
            ['title' => 'What risks do you see?', 'description' => 'Risks you can see coming that nobody is handling yet'],
            ['title' => 'What is puzzling you?', 'description' => 'Things that do not add up and deserve a closer look'],
        ],
    ],
    'learning_matrix' => [
        'name' => 'Learning Matrix',
        'columns' => [
            ['title' => ':)', 'description' => 'What went well and is worth repeating'],
            ['title' => ':(', 'description' => 'What went badly and cost the team'],
            ['title' => 'Idea!', 'description' => 'Proposals for the next sprint'],
            ['title' => 'Appreciation', 'description' => 'Thanks addressed to specific people'],
        ],
    ],
    'raid' => [
        'name' => 'RAID Log (Risks, Assumptions, Issues, Dependencies)',
        'columns' => [
            ['title' => 'Risks', 'description' => 'Things that may go wrong later — not yet real'],
            ['title' => 'Assumptions', 'description' => 'What the plan takes for granted and nobody verified'],
            ['title' => 'Issues', 'description' => 'Problems that are already happening and need an owner'],
            ['title' => 'Dependencies', 'description' => 'External work or decisions the team is waiting on'],
        ],
    ],
    'liked_lacked_change' => [
        'name' => 'Liked, Lacked, Change',
        'columns' => [
            ['title' => 'Liked', 'description' => 'What helped us move forward?'],
            ['title' => 'Lacked', 'description' => 'What held us back?'],
            ['title' => 'What can I change?', 'description' => 'What should I do differently?'],
            ['title' => 'What can we change?', 'description' => 'What should we do differently as a team?'],
        ],
    ],
    'time_added_stolen_restored' => [
        'name' => 'Time: Added, Stolen, Restored',
        'columns' => [
            ['title' => 'Which of your plans or choices add time to your day?', 'description' => 'Habits and choices that give you back hours'],
            ['title' => 'Which personal choices steal time from your day?', 'description' => 'Where your time leaks: interruptions, meetings, rework'],
            ['title' => 'How do or would you reclaim lost time?', 'description' => 'Concrete ways to reclaim the hours listed above'],
        ],
    ],
    'appreciation' => [
        'name' => 'Appreciation Retro',
        'columns' => [
            ['title' => "I'm glad that…", 'description' => 'What made you glad this sprint, however small'],
            ['title' => "I'm wondering…", 'description' => 'Open questions and doubts you carry into the next sprint'],
            ['title' => "It wasn't so great that…", 'description' => 'What disappointed you — the problem, not the person'],
            ['title' => 'Action items', 'description' => 'Follow-ups with an owner and a date'],
            ['title' => 'I appreciate…', 'description' => 'Thanks for specific help from specific people'],
        ],
    ],
    'christmas' => [
        'name' => 'Christmas Retro',
        'columns' => [
            ['title' => 'Christmas past', 'description' => 'Things you think could have been different'],
            ['title' => 'Christmas present', 'description' => 'Things that work great, and appreciation for colleagues'],
            ['title' => 'Christmas future', 'description' => 'Things you want to have in the future'],
            ['title' => 'Christmas foodie', 'description' => 'Share your favourite Christmas food'],
        ],
    ],
    'good_bad_learned_learning' => [
        'name' => 'Good, Bad, Learned, Learning',
        'columns' => [
            ['title' => 'What went well?', 'description' => 'Successes worth repeating on purpose'],
            ['title' => "What didn't go so well?", 'description' => 'What went wrong or cost the team time'],
            ['title' => 'What did I want to learn this sprint, and did I?', 'description' => 'Learning goals you set for this sprint and how they went'],
            ['title' => 'What do I want to learn next sprint?', 'description' => 'What you want to learn next and what you need for it'],
        ],
    ],
    'halloween' => [
        'name' => 'Halloween: Spooky Sprint',
        'columns' => [
            ['title' => 'Halloween treats!', 'description' => 'Set the scene'],
            ['title' => 'Ghost stories!', 'description' => 'Gather data'],
            ['title' => 'Trick or treat!', 'description' => 'Generate insights'],
            ['title' => 'Pick a door!', 'description' => 'Decide what to do'],
            ['title' => 'Spook of the sprint!', 'description' => 'Close the retrospective'],
        ],
    ],
    'plus_delta' => [
        'name' => 'Plus / Delta',
        'columns' => [
            ['title' => 'Plus', 'description' => 'Everything that is going well and should be repeated'],
            ['title' => 'Delta', 'description' => 'Everything you want to change or that can be improved'],
        ],
    ],
    'energy_levels' => [
        'name' => 'Energy Levels',
        'columns' => [
            ['title' => 'Fully charged', 'description' => 'What gave you energy and kept you going'],
            ['title' => 'Medium power', 'description' => 'Steady but unremarkable — the sprint neither lifted nor drained you'],
            ['title' => 'Low battery', 'description' => 'What exhausted you or drained your motivation'],
            ['title' => 'Sprint energy', 'description' => "How the team's energy moved across the sprint as a whole"],
        ],
    ],
    'weather_forecast' => [
        'name' => 'Weather Forecast',
        'columns' => [
            ['title' => 'Stormy', 'description' => 'What has been tempestuous? What issues did you face, and what stopped the team from moving forward?'],
            ['title' => 'Rainy', 'description' => 'What has been troublesome? What challenges did you face, and how did you overcome them?'],
            ['title' => 'Cloudy', 'description' => 'What has been rosy? What positive experiences did you have, and did colleagues support you?'],
            ['title' => 'Sunny', 'description' => 'What has been bright? Were the sprint goals met, and do you feel good about your contribution?'],
        ],
    ],
    'esvp' => [
        'name' => 'ESVP (Explorers, Shoppers, Vacationers, Prisoners)',
        'columns' => [
            ['title' => 'Explorers', 'description' => 'Want to discover new ideas and insights'],
            ['title' => 'Shoppers', 'description' => 'Look at what is on offer and want to leave with at least one useful idea'],
            ['title' => 'Vacationers', 'description' => 'Are not interested in retrospectives, but like a break from the daily grind'],
            ['title' => 'Prisoners', 'description' => 'Feel forced to attend and would prefer doing something else'],
        ],
    ],
    'soar' => [
        'name' => 'SOAR Analysis',
        'columns' => [
            ['title' => 'Strengths', 'description' => 'What do we excel at?'],
            ['title' => 'Opportunities', 'description' => 'Which niches and opportunities can we use?'],
            ['title' => 'Aspirations', 'description' => 'What do we want to achieve?'],
            ['title' => 'Results', 'description' => 'How will we measure that the goals and aspirations were achieved?'],
        ],
    ],
    'pre_mortem' => [
        'name' => 'Pre-mortem',
        'columns' => [
            ['title' => '(Hypothetically) The project failed! What went wrong?', 'description' => 'Imagine the project already failed — describe how it happened'],
            ['title' => "What didn't we do?", 'description' => 'Steps the team skipped on the way to that failure'],
            ['title' => 'What current problems remain?', 'description' => 'Problems that exist today and would make the failure worse'],
            ['title' => 'Any other concerns?', 'description' => 'Anything else that nags at you and has no owner'],
        ],
    ],
    'custom' => [
        'name' => 'Custom',
        'columns' => [],
    ],
];
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/TemplateCatalogueTest.php`
Expected: PASS.

- [ ] **Step 8: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Enums/TemplateCategory.php app/Support/RetroTemplates lang/en/templates.php tests/Feature/Retros/TemplateCatalogueTest.php
git commit -m "feat: define the 52-template catalogue with categories

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 6: French, Spanish and German template texts

**Files:**
- Create: `lang/fr/templates.php`, `lang/es/templates.php`, `lang/de/templates.php`
- Modify: `tests/Feature/Retros/TemplateCatalogueTest.php`, `tests/Feature/TranslationKeysTest.php`
- Test: same

**Interfaces:**
- Consumes: Task 5 keys (same structure, same column counts and order).
- Produces: the `templates` translation group in all four locales.

- [ ] **Step 1: Write the failing tests**

In `tests/Feature/Retros/TemplateCatalogueTest.php`, change the dataset of `it('translates every template within the column limits', …)` from `->with(['en'])` to `->with(['en', 'fr', 'es', 'de'])`, and add:

```php
it('copies the existing french titles of the original templates', function () {
    app()->setLocale('fr');

    expect(array_column(TemplateCatalogue::find('start_stop_continue')?->translatedColumns() ?? [], 'title'))
        ->toBe(['Commencer', 'Arrêter', 'Continuer'])
        ->and(TemplateCatalogue::find('mad_sad_glad')?->name())->toBe('En colère, Triste, Content');
});
```

Append to `tests/Feature/TranslationKeysTest.php`:

```php
it('keeps every template line in every other locale', function (string $locale) {
    $english = array_keys(Arr::dot(require lang_path('en/templates.php')));
    $translated = array_keys(Arr::dot(require lang_path("{$locale}/templates.php")));

    expect(array_values(array_diff($english, $translated)))->toBe([])
        ->and(array_values(array_diff($translated, $english)))->toBe([]);
})->with(['fr', 'es', 'de']);
```

and add `use Illuminate\Support\Arr;` to its imports.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/TemplateCatalogueTest.php tests/Feature/TranslationKeysTest.php`
Expected: FAIL — `templates.sailboat.name` returned as the key in `fr`, missing file `lang/fr/templates.php`.

- [ ] **Step 3: French**

`lang/fr/templates.php`:

```php
<?php

return [
    'categories' => [
        'essentials' => 'Incontournables',
        'team_mood' => 'Équipe et humeur',
        'themed' => 'Thèmes et jeux',
        'ideas' => 'Idées et planification',
        'analysis' => 'Analyse',
    ],
    'went_well_to_improve_actions' => [
        'name' => "Ce qui a bien fonctionné, À améliorer, Idées d'action",
        'columns' => [
            ['title' => "Ce qui s'est bien passé", 'description' => 'Ce qui a fonctionné et mérite d’être répété volontairement au prochain sprint'],
            ['title' => 'À améliorer', 'description' => "Là où l'équipe a perdu de l'élan — des problèmes, pas des personnes"],
            ['title' => "Idées d'action", 'description' => 'Des étapes concrètes avec un responsable et une date, pas des intentions'],
        ],
    ],
    'start_stop_continue' => [
        'name' => 'Démarrer, Arrêter, Continuer',
        'columns' => [
            ['title' => 'Commencer', 'description' => 'De nouvelles pratiques à essayer au prochain cycle'],
            ['title' => 'Arrêter', 'description' => 'Des habitudes qui gênent et doivent cesser maintenant'],
            ['title' => 'Continuer', 'description' => 'Ce qui fonctionne déjà et doit survivre au prochain changement'],
        ],
    ],
    'four_ls' => [
        'name' => 'Aimé, Appris, Manqué, Désiré',
        'columns' => [
            ['title' => "Ce que j'ai aimé", 'description' => 'Ce que vous avez apprécié ou trouvé utile pendant la période'],
            ['title' => "Ce que j'ai appris", 'description' => 'Ce que vous savez maintenant et ne saviez pas avant'],
            ['title' => 'Ce qui a manqué', 'description' => 'Ce qui manquait et a rendu le travail plus difficile'],
            ['title' => "Ce que j'aurais voulu", 'description' => "Ce que vous aimeriez voir exister, même si ce n'est pas à nous de le construire"],
        ],
    ],
    'sailboat' => [
        'name' => 'Voilier',
        'columns' => [
            ['title' => 'Quel vent gonfle nos voiles et nous fait avancer vite ?', 'description' => 'Ce qui nous a fait avancer et que nous pourrions répéter volontairement'],
            ['title' => 'Quelles ancres nous retiennent ?', 'description' => 'Ce qui nous ralentit et nous freine à chaque sprint'],
            ['title' => 'Quels rochers devant nous menacent notre avenir ?', 'description' => 'Les risques à venir qui nous feront mal si rien ne change'],
            ['title' => 'Quelle est notre île idéale ?', 'description' => 'Le but vers lequel nous naviguons — mettez-vous d’accord dessus avant le reste'],
        ],
    ],
    'mad_sad_glad' => [
        'name' => 'En colère, Triste, Content',
        'columns' => [
            ['title' => 'En colère', 'description' => 'Ce qui vous a mis en colère — ce qui a mal tourné plus d’une fois'],
            ['title' => 'Triste', 'description' => 'Ce qui a déçu — des attentes jamais satisfaites'],
            ['title' => 'Content', 'description' => 'Ce qui s’est bien passé et mérite d’être protégé au prochain sprint'],
        ],
    ],
    'thumbs_up_down_ideas_recognition' => [
        'name' => 'Pouce en haut, Pouce en bas, Nouvelles idées, Reconnaissance',
        'columns' => [
            ['title' => 'Pouce en haut', 'description' => 'Ce qui s’est bien passé pendant ce sprint'],
            ['title' => 'Pouce en bas', 'description' => 'Ce qui a mal tourné ou a été frustrant'],
            ['title' => 'Nouvelles idées', 'description' => 'Des idées à essayer, même à moitié formées'],
            ['title' => 'Reconnaissance', 'description' => 'Des remerciements pour celles et ceux qui ont facilité le travail des autres'],
        ],
    ],
    'lean_coffee' => [
        'name' => 'Lean Coffee',
        'columns' => [
            ['title' => 'À discuter', 'description' => 'Les sujets proposés, classés par votes'],
            ['title' => 'En discussion', 'description' => 'Le seul sujet en cours en ce moment'],
            ['title' => 'Discutés', 'description' => 'Les sujets terminés — vérifiez pour chacun s’il y a un engagement'],
        ],
    ],
    'original_four' => [
        'name' => 'Les 4 questions originales',
        'columns' => [
            ['title' => 'Qu’est-ce qui s’est bien passé ?', 'description' => 'Les réussites à nommer à voix haute, même petites'],
            ['title' => 'Qu’est-ce qui ne s’est pas si bien passé ?', 'description' => 'Problèmes et ratés — les faits, avant les raisons'],
            ['title' => 'Qu’ai-je appris ?', 'description' => 'Ce que vous transmettriez à quelqu’un qui commence le même travail'],
            ['title' => 'Qu’est-ce qui m’intrigue encore ?', 'description' => 'Les questions auxquelles l’équipe n’a pas encore répondu'],
        ],
    ],
    'starfish' => [
        'name' => 'Étoile de mer',
        'columns' => [
            ['title' => 'Continuer à faire', 'description' => 'Au bon niveau — à protéger quand nous sommes débordés'],
            ['title' => 'Faire moins', 'description' => 'Utile à petite dose, pas à supprimer'],
            ['title' => 'Faire plus', 'description' => 'Arrive déjà parfois et mérite une plus grande place dans la semaine'],
            ['title' => 'Commencer à faire', 'description' => 'Une nouvelle pratique à essayer — une ou deux par sprint, pas plus'],
            ['title' => 'Arrêter de faire', 'description' => 'N’apporte plus aucune valeur'],
        ],
    ],
    'three_little_pigs' => [
        'name' => 'Les trois petits cochons',
        'columns' => [
            ['title' => 'Maison de paille', 'description' => 'Ce qui pourrait facilement s’effondrer'],
            ['title' => 'Maison de bois', 'description' => 'Ce qui fonctionne mais pourrait être amélioré'],
            ['title' => 'Maison de briques', 'description' => 'Ce qui est solide et stable'],
        ],
    ],
    'dot_voting' => [
        'name' => 'Vote par points',
        'columns' => [
            ['title' => 'Sujets et idées', 'description' => 'Toutes les options envisagées — une carte par option, puis votez'],
        ],
    ],
    'speed_car' => [
        'name' => 'Voiture de course',
        'columns' => [
            ['title' => 'Moteur', 'description' => 'Qu’est-ce qui nous fait avancer plus vite ?'],
            ['title' => 'Parachute', 'description' => 'Qu’est-ce qui nous ralentit ?'],
        ],
    ],
    'happy_meh_sad' => [
        'name' => 'Content, Bof, Triste',
        'columns' => [
            ['title' => 'Content :)', 'description' => 'Les moments qui ont donné de l’énergie à l’équipe'],
            ['title' => 'Bof :|', 'description' => 'Ni bien ni mal — et c’est justement le signal'],
            ['title' => 'Triste :(', 'description' => 'Ce qui a épuisé l’équipe ou a clairement mal tourné'],
        ],
    ],
    'idea_prioritization' => [
        'name' => 'Priorisation des idées',
        'columns' => [
            ['title' => 'Priorité basse', 'description' => 'À faire un jour, rien ne casse si ça attend'],
            ['title' => 'Priorité moyenne', 'description' => 'À faire dans le prochain cycle ou le suivant'],
            ['title' => 'Priorité haute', 'description' => 'Coûte à l’équipe ou aux clients dès maintenant — à traiter en premier'],
        ],
    ],
    'harry_potter' => [
        'name' => 'Harry Potter',
        'columns' => [
            ['title' => 'Felix Felicis', 'description' => 'Les bonnes choses !'],
            ['title' => 'Élixir de Baruffio', 'description' => 'Ce que nous avons appris !'],
            ['title' => 'Petrificus Totalus', 'description' => 'Qu’est-ce qui nous a ralentis ?'],
            ['title' => 'Coupe des Trois Sorciers', 'description' => 'Les remerciements !'],
            ['title' => 'Actions', 'description' => 'Ce qu’il faut prendre en compte'],
        ],
    ],
    'kalm' => [
        'name' => 'KALM (Garder, Ajouter, Plus, Moins)',
        'columns' => [
            ['title' => 'Garder', 'description' => 'Fonctionne aujourd’hui et serait la première chose perdue sous pression'],
            ['title' => 'Ajouter', 'description' => 'Quelque chose que nous n’avons pas encore et voulons essayer'],
            ['title' => 'Plus', 'description' => 'Arrive déjà parfois et devrait devenir une habitude'],
            ['title' => 'Moins', 'description' => 'Utile à petite dose — à réduire plutôt qu’à supprimer'],
        ],
    ],
    'marie_kondo' => [
        'name' => 'Méthode Marie Kondo',
        'columns' => [
            ['title' => 'Source de joie', 'description' => 'Ce qui s’est bien passé et que l’on garde volontiers'],
            ['title' => 'À jeter', 'description' => 'Ce qui a mal tourné et que l’on ne veut pas garder'],
            ['title' => 'À recycler', 'description' => 'Ce que vous voulez améliorer et réutiliser'],
        ],
    ],
    'game_of_thrones' => [
        'name' => 'Game of Thrones',
        'columns' => [
            ['title' => 'Le château', 'description' => 'En quoi sommes-nous excellents ?'],
            ['title' => 'Le trou', 'description' => 'Quels sont les problèmes actuels ?'],
            ['title' => 'Le Mur', 'description' => 'Qu’est-ce qui ferait de nous une meilleure équipe ?'],
            ['title' => 'Les Marcheurs blancs', 'description' => 'Quels sont les risques et défis possibles ?'],
        ],
    ],
    'love_want_hate_learn' => [
        'name' => 'J’aime, Je veux, Je déteste, J’ai appris',
        'columns' => [
            ['title' => 'J’aime…', 'description' => 'Ce que vous appréciez vraiment dans notre façon de travailler'],
            ['title' => 'Je veux…', 'description' => 'Les changements que vous souhaitez, formulés comme votre propre souhait'],
            ['title' => 'Je déteste…', 'description' => 'Ce qui vous frustre — la version honnête, sans filtre'],
            ['title' => 'Maintenant, je sais que…', 'description' => 'Les découvertes du sprint que toute l’équipe devrait partager'],
        ],
    ],
    'kudos' => [
        'name' => 'Kudos',
        'columns' => [
            ['title' => 'Kudos', 'description' => 'Remerciez une personne précise pour quelque chose de précis'],
            ['title' => 'Ce qui s’est bien passé', 'description' => 'Ce qui a fonctionné et doit être protégé au prochain sprint'],
            ['title' => 'À améliorer', 'description' => 'Là où l’équipe a perdu du temps ou de la qualité'],
            ['title' => 'Actions', 'description' => 'Des étapes avec un responsable, tirées de la colonne précédente'],
        ],
    ],
    'pros_and_cons' => [
        'name' => 'Pour et contre',
        'columns' => [
            ['title' => 'Pour', 'description' => 'Les arguments en faveur de l’option — des bénéfices, pas des espoirs'],
            ['title' => 'Contre', 'description' => 'Les coûts, les risques et ce à quoi l’option engage l’équipe'],
        ],
    ],
    'sprint_diagnostics' => [
        'name' => 'Diagnostic du sprint',
        'columns' => [
            ['title' => 'Comment était ce sprint ? Note de 1 à 10 (communication, collaboration, qualité, pression)', 'description' => 'Une note et une phrase sur ce qui l’explique'],
            ['title' => 'Grand coup de cœur ou grosse déception', 'description' => 'Le moment le plus fort du sprint, positif ou négatif'],
            ['title' => 'Que pourrions-nous faire encore mieux ou autrement ? Comment ?', 'description' => 'Des améliorations formulées comme un changement, pas une plainte'],
            ['title' => 'Actions', 'description' => 'Un responsable et une date pour chaque changement décidé'],
        ],
    ],
    'three_ls' => [
        'name' => 'Les 3 A (Aimé, Appris, Manqué)',
        'columns' => [
            ['title' => 'Aimé', 'description' => 'Ce que vous avez apprécié pendant le sprint'],
            ['title' => 'Appris', 'description' => 'Des connaissances nouvelles — sur le produit, le système ou l’équipe'],
            ['title' => 'Manqué', 'description' => 'Ce qui manquait : information, temps, accès ou décision'],
        ],
    ],
    'daki' => [
        'name' => 'DAKI (Abandonner, Ajouter, Garder, Améliorer)',
        'columns' => [
            ['title' => 'Abandonner', 'description' => 'Plus aucune valeur — un rapport que personne ne lit, une étape déjà automatisée'],
            ['title' => 'Ajouter', 'description' => 'Une nouvelle pratique à essayer, une ou deux par sprint'],
            ['title' => 'Garder', 'description' => 'Fonctionne aujourd’hui et doit être défendu sous pression'],
            ['title' => 'Améliorer', 'description' => 'Presque bien — à corriger plutôt qu’à supprimer'],
        ],
    ],
    'swot' => [
        'name' => 'Analyse SWOT',
        'columns' => [
            ['title' => 'Forces', 'description' => 'Les atouts internes sur lesquels l’équipe peut compter'],
            ['title' => 'Faiblesses', 'description' => 'Les lacunes internes qui coûtent du temps ou de la qualité'],
            ['title' => 'Opportunités', 'description' => 'Les ouvertures externes à saisir tant qu’elles existent'],
            ['title' => 'Menaces', 'description' => 'Les risques externes qui feraient mal si rien ne change'],
        ],
    ],
    'good_bad_ugly' => [
        'name' => 'Le Bon, la Brute et le Truand',
        'columns' => [
            ['title' => 'Le bon', 'description' => 'Ce qui s’est bien passé ou a bien fonctionné'],
            ['title' => 'La brute', 'description' => 'Ce qui ne s’est pas passé comme prévu, ou les problèmes apparus'],
            ['title' => 'Le truand', 'description' => 'Ce que l’équipe ne pouvait pas changer mais doit pouvoir signaler'],
        ],
    ],
    'kanban' => [
        'name' => 'Kanban',
        'columns' => [
            ['title' => 'À faire', 'description' => 'Le travail convenu pas encore commencé'],
            ['title' => 'En cours', 'description' => 'En cours en ce moment, avec un nom associé'],
            ['title' => 'Terminé', 'description' => 'Fini et vérifié — la preuve que l’équipe avance'],
        ],
    ],
    'six_thinking_hats' => [
        'name' => 'Les six chapeaux de la réflexion',
        'columns' => [
            ['title' => 'Chapeau vert', 'description' => 'Créativité : alternatives et idées, sans jugement pour l’instant'],
            ['title' => 'Chapeau bleu', 'description' => 'Processus : à quoi sert cette discussion et ce qui en est exclu'],
            ['title' => 'Chapeau blanc', 'description' => 'Faits : chiffres et observations, sans interprétation'],
            ['title' => 'Chapeau rouge', 'description' => 'Émotions : réactions instinctives, sans justification'],
            ['title' => 'Chapeau noir', 'description' => 'Prudence : les risques et ce qui pourrait mal tourner'],
            ['title' => 'Chapeau jaune', 'description' => 'Bénéfices : la valeur et ce qui fonctionne déjà'],
        ],
    ],
    'post_mortem' => [
        'name' => 'Post-mortem',
        'columns' => [
            ['title' => 'Ce que nous avons aimé', 'description' => 'Ce qui a tenu sous pression et doit rester'],
            ['title' => 'Ce qui nous a manqué', 'description' => 'Les lacunes révélées par l’incident : alertes, docs, accès'],
            ['title' => 'Ce que j’ai appris', 'description' => 'Ce que chacun sait maintenant et ne savait pas avant'],
            ['title' => 'Pour la prochaine fois', 'description' => 'Des suites avec un responsable pour détecter plus tôt la même panne'],
            ['title' => 'Remerciements', 'description' => 'La reconnaissance pour celles et ceux qui ont porté l’incident'],
        ],
    ],
    'rose_bud_thorn' => [
        'name' => 'Rose, Bourgeon, Épine',
        'columns' => [
            ['title' => 'Rose', 'description' => 'Ce qui fonctionne clairement en ce moment'],
            ['title' => 'Bourgeon', 'description' => 'Des signes prometteurs à soutenir avant qu’ils ne s’estompent'],
            ['title' => 'Épine', 'description' => 'Ce qui fait mal et continuera tant que personne ne le corrige'],
        ],
    ],
    'hopes_and_fears' => [
        'name' => 'Espoirs et craintes',
        'columns' => [
            ['title' => 'Espoirs', 'description' => 'Ce que l’équipe veut que ce projet ou ce cycle devienne'],
            ['title' => 'Craintes', 'description' => 'Ce qui pourrait mal tourner — dit à voix haute tant que ça coûte peu'],
        ],
    ],
    'good_bad_better_best' => [
        'name' => 'Bien, Mal, Mieux, Le meilleur',
        'columns' => [
            ['title' => 'Bien', 'description' => 'Ce qui s’est bien passé'],
            ['title' => 'Mal', 'description' => 'Ce qui s’est mal passé'],
            ['title' => 'Mieux', 'description' => 'Les pistes d’amélioration'],
            ['title' => 'Le meilleur', 'description' => 'Résultats, performances, actions et personnes remarquables'],
        ],
    ],
    'likes_wishes_wonders' => [
        'name' => 'J’aime, Je souhaite, Je me demande',
        'columns' => [
            ['title' => 'J’aime', 'description' => 'Ce que vous appréciez dans notre façon de travailler aujourd’hui'],
            ['title' => 'Je souhaite', 'description' => 'Les changements voulus, formulés comme un souhait plutôt qu’une exigence'],
            ['title' => 'Je me demande', 'description' => 'Les questions et doutes auxquels personne n’a répondu'],
        ],
    ],
    'okr' => [
        'name' => 'OKR (Objectifs et résultats clés)',
        'columns' => [
            ['title' => 'Résultats clés', 'description' => 'Des résultats mesurables qui prouvent que l’objectif est atteint'],
            ['title' => 'Initiatives', 'description' => 'Le travail que l’équipe fera réellement pour faire bouger ces chiffres'],
            ['title' => 'Objectifs', 'description' => 'Où l’équipe veut aller — qualitatif et ambitieux'],
        ],
    ],
    'www' => [
        'name' => 'WWW (A bien marché, A à moitié marché, N’a pas marché)',
        'columns' => [
            ['title' => 'A bien marché', 'description' => 'Des réussites nettes à conserver délibérément'],
            ['title' => 'A à moitié marché', 'description' => 'Des demi-réussites : la bonne idée, une exécution ratée'],
            ['title' => 'N’a pas marché', 'description' => 'Ce qui a échoué et ne doit pas être refait tel quel'],
        ],
    ],
    'safety_check' => [
        'name' => 'Vérification de sécurité',
        'columns' => [
            ['title' => '5', 'description' => 'Aucun problème — je dirai tout, même ce qui dérange'],
            ['title' => '4', 'description' => 'Plutôt à l’aise — j’adoucirais la formulation d’un ou deux sujets'],
            ['title' => '3', 'description' => 'Sélectif — je parlerai du processus, pas des personnes ni de mes erreurs'],
            ['title' => '2', 'description' => 'Sur la réserve — j’approuverai les autres sans rien soulever moi-même'],
            ['title' => '1', 'description' => 'Silencieux — je ne dirai rien d’important pendant cette séance'],
        ],
    ],
    'fishbone' => [
        'name' => 'Diagramme d’Ishikawa',
        'columns' => [
            ['title' => 'Personnes', 'description' => 'Causes liées aux compétences, aux effectifs ou au savoir d’une seule personne'],
            ['title' => 'Processus', 'description' => 'Causes dans notre façon de travailler : étapes sautées, règles non écrites'],
            ['title' => 'Outils', 'description' => 'Causes dans l’outillage : alertes, tests, environnements manquants'],
            ['title' => 'Programme', 'description' => 'Causes dans la planification : périmètre, budget, échéances'],
            ['title' => 'Environnement', 'description' => 'Causes extérieures à l’équipe : fournisseurs, trafic, réorganisations'],
            ['title' => 'Solutions', 'description' => 'Des correctifs qui traitent les causes ci-dessus, avec un responsable'],
        ],
    ],
    'wrap' => [
        'name' => 'WRAP (Souhaits, Risques, Remerciements, Énigmes)',
        'columns' => [
            ['title' => 'Quels sont vos souhaits ?', 'description' => 'Ce que vous voulez pour l’équipe à l’avenir'],
            ['title' => 'Qu’appréciez-vous ?', 'description' => 'La reconnaissance pour celles et ceux qui vous ont facilité le travail'],
            ['title' => 'Quels risques voyez-vous ?', 'description' => 'Des risques visibles dont personne ne s’occupe encore'],
            ['title' => 'Qu’est-ce qui vous intrigue ?', 'description' => 'Ce qui ne colle pas et mérite un examen plus attentif'],
        ],
    ],
    'learning_matrix' => [
        'name' => 'Matrice d’apprentissage',
        'columns' => [
            ['title' => ':)', 'description' => 'Ce qui s’est bien passé et mérite d’être répété'],
            ['title' => ':(', 'description' => 'Ce qui s’est mal passé et a coûté à l’équipe'],
            ['title' => 'Idée !', 'description' => 'Des propositions pour le prochain sprint'],
            ['title' => 'Remerciements', 'description' => 'Des remerciements adressés à des personnes précises'],
        ],
    ],
    'raid' => [
        'name' => 'Registre RAID (Risques, Hypothèses, Problèmes, Dépendances)',
        'columns' => [
            ['title' => 'Risques', 'description' => 'Ce qui pourrait mal tourner plus tard — pas encore réel'],
            ['title' => 'Hypothèses', 'description' => 'Ce que le plan tient pour acquis sans que personne l’ait vérifié'],
            ['title' => 'Problèmes', 'description' => 'Des problèmes déjà présents qui ont besoin d’un responsable'],
            ['title' => 'Dépendances', 'description' => 'Le travail ou les décisions extérieurs que l’équipe attend'],
        ],
    ],
    'liked_lacked_change' => [
        'name' => 'Aimé, Manqué, Changer',
        'columns' => [
            ['title' => 'Aimé', 'description' => 'Qu’est-ce qui nous a aidés à avancer ?'],
            ['title' => 'Manqué', 'description' => 'Qu’est-ce qui nous a freinés ?'],
            ['title' => 'Que puis-je changer ?', 'description' => 'Que devrais-je faire autrement ?'],
            ['title' => 'Que pouvons-nous changer ?', 'description' => 'Que devrions-nous faire autrement en équipe ?'],
        ],
    ],
    'time_added_stolen_restored' => [
        'name' => 'Temps : gagné, volé, récupéré',
        'columns' => [
            ['title' => 'Quels projets ou choix vous font gagner du temps dans la journée ?', 'description' => 'Les habitudes et choix qui vous rendent des heures'],
            ['title' => 'Quels choix personnels vous volent du temps ?', 'description' => 'Là où votre temps fuit : interruptions, réunions, reprises'],
            ['title' => 'Comment récupérez-vous ou récupéreriez-vous le temps perdu ?', 'description' => 'Des moyens concrets de récupérer les heures listées plus haut'],
        ],
    ],
    'appreciation' => [
        'name' => 'Rétro de reconnaissance',
        'columns' => [
            ['title' => 'Je suis content que…', 'description' => 'Ce qui vous a fait plaisir pendant ce sprint, même petit'],
            ['title' => 'Je me demande…', 'description' => 'Les questions et doutes que vous emportez au prochain sprint'],
            ['title' => 'Ce n’était pas génial que…', 'description' => 'Ce qui vous a déçu — le problème, pas la personne'],
            ['title' => 'Actions', 'description' => 'Des suites avec un responsable et une date'],
            ['title' => 'Je remercie…', 'description' => 'Des remerciements pour une aide précise de personnes précises'],
        ],
    ],
    'christmas' => [
        'name' => 'Rétro de Noël',
        'columns' => [
            ['title' => 'Noël passé', 'description' => 'Ce qui, selon vous, aurait pu se passer autrement'],
            ['title' => 'Noël présent', 'description' => 'Ce qui fonctionne très bien, et vos remerciements aux collègues'],
            ['title' => 'Noël futur', 'description' => 'Ce que vous voulez avoir à l’avenir'],
            ['title' => 'Gourmandises de Noël', 'description' => 'Partagez votre plat de Noël préféré'],
        ],
    ],
    'good_bad_learned_learning' => [
        'name' => 'Bien, Mal, Appris, À apprendre',
        'columns' => [
            ['title' => 'Qu’est-ce qui s’est bien passé ?', 'description' => 'Les réussites à répéter volontairement'],
            ['title' => 'Qu’est-ce qui ne s’est pas si bien passé ?', 'description' => 'Ce qui a mal tourné ou a coûté du temps à l’équipe'],
            ['title' => 'Que voulais-je apprendre pendant ce sprint, et l’ai-je fait ?', 'description' => 'Vos objectifs d’apprentissage du sprint et comment ils se sont passés'],
            ['title' => 'Que veux-je apprendre au prochain sprint ?', 'description' => 'Ce que vous voulez apprendre ensuite et ce dont vous avez besoin pour cela'],
        ],
    ],
    'halloween' => [
        'name' => 'Halloween : le sprint qui fait peur',
        'columns' => [
            ['title' => 'Friandises d’Halloween !', 'description' => 'Planter le décor'],
            ['title' => 'Histoires de fantômes !', 'description' => 'Recueillir les faits'],
            ['title' => 'Un bonbon ou un sort !', 'description' => 'Tirer des enseignements'],
            ['title' => 'Choisissez une porte !', 'description' => 'Décider quoi faire'],
            ['title' => 'La frayeur du sprint !', 'description' => 'Clôturer la rétrospective'],
        ],
    ],
    'plus_delta' => [
        'name' => 'Plus / Delta',
        'columns' => [
            ['title' => 'Plus', 'description' => 'Tout ce qui se passe bien et doit être répété'],
            ['title' => 'Delta', 'description' => 'Tout ce que vous voulez changer ou qui peut être amélioré'],
        ],
    ],
    'energy_levels' => [
        'name' => 'Niveaux d’énergie',
        'columns' => [
            ['title' => 'Pleine charge', 'description' => 'Ce qui vous a donné de l’énergie et vous a fait avancer'],
            ['title' => 'Charge moyenne', 'description' => 'Stable mais sans relief — le sprint ne vous a ni porté ni épuisé'],
            ['title' => 'Batterie faible', 'description' => 'Ce qui vous a épuisé ou a sapé votre motivation'],
            ['title' => 'Énergie du sprint', 'description' => 'Comment l’énergie de l’équipe a évolué sur l’ensemble du sprint'],
        ],
    ],
    'weather_forecast' => [
        'name' => 'Bulletin météo',
        'columns' => [
            ['title' => 'Orageux', 'description' => 'Qu’est-ce qui a été tempétueux ? Quels problèmes avez-vous rencontrés, et qu’est-ce qui a empêché l’équipe d’avancer ?'],
            ['title' => 'Pluvieux', 'description' => 'Qu’est-ce qui a été pénible ? Quelles difficultés avez-vous rencontrées, et comment les avez-vous surmontées ?'],
            ['title' => 'Nuageux', 'description' => 'Qu’est-ce qui a été agréable ? Quelles expériences positives avez-vous vécues, et vos collègues vous ont-ils soutenu ?'],
            ['title' => 'Ensoleillé', 'description' => 'Qu’est-ce qui a été lumineux ? Les objectifs du sprint sont-ils atteints, et êtes-vous satisfait de votre contribution ?'],
        ],
    ],
    'esvp' => [
        'name' => 'ESVP (Explorateurs, Acheteurs, Vacanciers, Prisonniers)',
        'columns' => [
            ['title' => 'Explorateurs', 'description' => 'Veulent découvrir de nouvelles idées et de nouvelles pistes'],
            ['title' => 'Acheteurs', 'description' => 'Regardent ce qui est proposé et veulent repartir avec au moins une idée utile'],
            ['title' => 'Vacanciers', 'description' => 'Ne s’intéressent pas aux rétrospectives, mais apprécient une pause dans le quotidien'],
            ['title' => 'Prisonniers', 'description' => 'Se sentent obligés d’être là et préféreraient faire autre chose'],
        ],
    ],
    'soar' => [
        'name' => 'Analyse SOAR',
        'columns' => [
            ['title' => 'Forces', 'description' => 'En quoi excellons-nous ?'],
            ['title' => 'Opportunités', 'description' => 'Quelles niches et opportunités pouvons-nous exploiter ?'],
            ['title' => 'Aspirations', 'description' => 'Que voulons-nous accomplir ?'],
            ['title' => 'Résultats', 'description' => 'Comment mesurerons-nous que les objectifs et aspirations sont atteints ?'],
        ],
    ],
    'pre_mortem' => [
        'name' => 'Pré-mortem',
        'columns' => [
            ['title' => '(Hypothèse) Le projet a échoué ! Qu’est-ce qui a mal tourné ?', 'description' => 'Imaginez que le projet a déjà échoué — décrivez comment c’est arrivé'],
            ['title' => 'Qu’est-ce que nous n’avons pas fait ?', 'description' => 'Les étapes sautées par l’équipe sur le chemin de cet échec'],
            ['title' => 'Quels problèmes actuels subsistent ?', 'description' => 'Les problèmes qui existent aujourd’hui et aggraveraient l’échec'],
            ['title' => 'D’autres inquiétudes ?', 'description' => 'Tout ce qui vous tracasse encore et n’a pas de responsable'],
        ],
    ],
    'custom' => [
        'name' => 'Personnalisé',
        'columns' => [],
    ],
];
```

- [ ] **Step 4: Spanish**

`lang/es/templates.php`:

```php
<?php

return [
    'categories' => [
        'essentials' => 'Imprescindibles',
        'team_mood' => 'Equipo y ánimo',
        'themed' => 'Temáticas y divertidas',
        'ideas' => 'Ideas y planificación',
        'analysis' => 'Análisis',
    ],
    'went_well_to_improve_actions' => [
        'name' => 'Lo que fue bien, A mejorar, Ideas de acción',
        'columns' => [
            ['title' => 'Lo que fue bien', 'description' => 'Lo que funcionó y vale la pena repetir a propósito en el próximo sprint'],
            ['title' => 'A mejorar', 'description' => 'Donde el equipo perdió impulso — problemas, no personas'],
            ['title' => 'Ideas de acción', 'description' => 'Pasos concretos con responsable y fecha, no intenciones'],
        ],
    ],
    'start_stop_continue' => [
        'name' => 'Empezar, Parar, Continuar',
        'columns' => [
            ['title' => 'Empezar', 'description' => 'Nuevas prácticas que vale la pena probar en el próximo ciclo'],
            ['title' => 'Parar', 'description' => 'Hábitos que estorban y deben terminar ya'],
            ['title' => 'Continuar', 'description' => 'Lo que ya funciona y debe sobrevivir al próximo cambio'],
        ],
    ],
    'four_ls' => [
        'name' => 'Lo que gustó, Lo que aprendimos, Lo que faltó, Lo que deseamos',
        'columns' => [
            ['title' => 'Lo que gustó', 'description' => 'Lo que disfrutaste o valoraste del periodo'],
            ['title' => 'Lo que aprendimos', 'description' => 'Lo que sabes ahora y no sabías antes'],
            ['title' => 'Lo que faltó', 'description' => 'Lo que faltaba e hizo el trabajo más difícil'],
            ['title' => 'Lo que deseamos', 'description' => 'Lo que te gustaría que existiera, aunque no nos toque construirlo'],
        ],
    ],
    'sailboat' => [
        'name' => 'Velero',
        'columns' => [
            ['title' => '¿Qué viento empuja nuestras velas y nos hace ir rápido?', 'description' => 'Lo que nos impulsó y podríamos repetir a propósito'],
            ['title' => '¿Qué anclas nos frenan?', 'description' => 'Lo que nos ralentiza y nos lastra en cada sprint'],
            ['title' => '¿Qué rocas tenemos delante que ponen en riesgo nuestro futuro?', 'description' => 'Riesgos que nos harán daño si nada cambia'],
            ['title' => '¿Cuál es nuestra isla ideal?', 'description' => 'El destino hacia el que navegamos — poneos de acuerdo en esto antes que en lo demás'],
        ],
    ],
    'mad_sad_glad' => [
        'name' => 'Enfadado, Triste, Contento',
        'columns' => [
            ['title' => 'Enfadado', 'description' => 'Lo que te enfadó — lo que salió mal más de una vez'],
            ['title' => 'Triste', 'description' => 'Lo que decepcionó — expectativas que nunca se cumplieron'],
            ['title' => 'Contento', 'description' => 'Lo que salió bien y vale la pena proteger en el próximo sprint'],
        ],
    ],
    'thumbs_up_down_ideas_recognition' => [
        'name' => 'Pulgar arriba, Pulgar abajo, Nuevas ideas, Reconocimiento',
        'columns' => [
            ['title' => 'Pulgar arriba', 'description' => 'Lo que salió bien en este sprint'],
            ['title' => 'Pulgar abajo', 'description' => 'Lo que salió mal o resultó frustrante'],
            ['title' => 'Nuevas ideas', 'description' => 'Ideas que vale la pena probar, aunque estén a medias'],
            ['title' => 'Reconocimiento', 'description' => 'Reconocimiento para quienes facilitaron el trabajo de los demás'],
        ],
    ],
    'lean_coffee' => [
        'name' => 'Lean Coffee',
        'columns' => [
            ['title' => 'Por tratar', 'description' => 'Temas propuestos, ordenados por votos'],
            ['title' => 'En discusión', 'description' => 'El único tema que se trata ahora mismo'],
            ['title' => 'Tratados', 'description' => 'Temas terminados — revisa si cada uno deja un compromiso'],
        ],
    ],
    'original_four' => [
        'name' => 'Las 4 preguntas originales',
        'columns' => [
            ['title' => '¿Qué salió bien?', 'description' => 'Éxitos que merece la pena decir en voz alta, por pequeños que sean'],
            ['title' => '¿Qué no salió tan bien?', 'description' => 'Problemas y fallos — los hechos, antes que las razones'],
            ['title' => '¿Qué he aprendido?', 'description' => 'Lo que le contarías a alguien que empieza el mismo trabajo'],
            ['title' => '¿Qué me sigue desconcertando?', 'description' => 'Preguntas que el equipo aún no ha respondido'],
        ],
    ],
    'starfish' => [
        'name' => 'Estrella de mar',
        'columns' => [
            ['title' => 'Seguir haciendo', 'description' => 'Funciona en su justa medida — protégelo cuando haya mucho trabajo'],
            ['title' => 'Hacer menos', 'description' => 'Valioso en dosis pequeñas, no algo que eliminar'],
            ['title' => 'Hacer más', 'description' => 'Ya ocurre a veces y merece más espacio en la semana'],
            ['title' => 'Empezar a hacer', 'description' => 'Una práctica nueva que probar — una o dos por sprint, no más'],
            ['title' => 'Dejar de hacer', 'description' => 'Ya no aporta ningún valor'],
        ],
    ],
    'three_little_pigs' => [
        'name' => 'Los tres cerditos',
        'columns' => [
            ['title' => 'Casa de paja', 'description' => 'Lo que podría derrumbarse fácilmente'],
            ['title' => 'Casa de madera', 'description' => 'Lo que funciona pero podría mejorar'],
            ['title' => 'Casa de ladrillo', 'description' => 'Lo que es sólido y estable'],
        ],
    ],
    'dot_voting' => [
        'name' => 'Votación por puntos',
        'columns' => [
            ['title' => 'Temas e ideas', 'description' => 'Todas las opciones consideradas — una tarjeta por opción y luego se vota'],
        ],
    ],
    'speed_car' => [
        'name' => 'Coche de carreras',
        'columns' => [
            ['title' => 'Motor', 'description' => '¿Qué nos hace avanzar más rápido?'],
            ['title' => 'Paracaídas', 'description' => '¿Qué nos está frenando?'],
        ],
    ],
    'happy_meh_sad' => [
        'name' => 'Contento, Meh, Triste',
        'columns' => [
            ['title' => 'Contento :)', 'description' => 'Momentos que dieron energía al equipo'],
            ['title' => 'Meh :|', 'description' => 'Ni bueno ni malo — y justo esa es la señal'],
            ['title' => 'Triste :(', 'description' => 'Lo que agotó al equipo o salió claramente mal'],
        ],
    ],
    'idea_prioritization' => [
        'name' => 'Priorización de ideas',
        'columns' => [
            ['title' => 'Prioridad baja', 'description' => 'Vale la pena algún día, nada se rompe si espera'],
            ['title' => 'Prioridad media', 'description' => 'Debería hacerse en el próximo ciclo o el siguiente'],
            ['title' => 'Prioridad alta', 'description' => 'Le cuesta al equipo o a los clientes ahora — empieza por aquí'],
        ],
    ],
    'harry_potter' => [
        'name' => 'Harry Potter',
        'columns' => [
            ['title' => 'Felix Felicis', 'description' => '¡Cosas buenas!'],
            ['title' => 'Elixir cerebral de Baruffio', 'description' => '¡Lo que aprendimos!'],
            ['title' => 'Petrificus Totalus', 'description' => '¿Qué nos frenó?'],
            ['title' => 'Copa de los Tres Magos', 'description' => '¡Reconocimientos!'],
            ['title' => 'Acciones', 'description' => 'Cosas a tener en cuenta'],
        ],
    ],
    'kalm' => [
        'name' => 'KALM (Mantener, Añadir, Más, Menos)',
        'columns' => [
            ['title' => 'Mantener', 'description' => 'Funciona hoy y sería lo primero que perderíamos bajo presión'],
            ['title' => 'Añadir', 'description' => 'Algo que aún no tenemos y queremos probar'],
            ['title' => 'Más', 'description' => 'Ya ocurre a veces y debería ser habitual'],
            ['title' => 'Menos', 'description' => 'Útil en dosis pequeñas — redúcelo en lugar de eliminarlo'],
        ],
    ],
    'marie_kondo' => [
        'name' => 'Método Marie Kondo',
        'columns' => [
            ['title' => 'Da alegría', 'description' => 'Lo que salió bien y nos alegra conservar'],
            ['title' => 'Tirar', 'description' => 'Lo que salió mal y no queremos conservar'],
            ['title' => 'Reciclar', 'description' => 'Lo que quieres mejorar y reutilizar'],
        ],
    ],
    'game_of_thrones' => [
        'name' => 'Juego de Tronos',
        'columns' => [
            ['title' => 'El castillo', 'description' => '¿En qué somos muy buenos?'],
            ['title' => 'El agujero', 'description' => '¿Cuáles son los problemas actuales?'],
            ['title' => 'El Muro', 'description' => '¿Qué nos haría mejor equipo?'],
            ['title' => 'Los Caminantes Blancos', 'description' => '¿Cuáles son los riesgos y retos posibles?'],
        ],
    ],
    'love_want_hate_learn' => [
        'name' => 'Me encanta, Quiero, Odio, Aprendí',
        'columns' => [
            ['title' => 'Me encanta…', 'description' => 'Lo que de verdad disfrutas de cómo trabaja el equipo'],
            ['title' => 'Quiero…', 'description' => 'Cambios que quieres, formulados como tu propio deseo'],
            ['title' => 'Odio…', 'description' => 'Lo que te frustra — la versión sincera, sin filtros'],
            ['title' => 'Ahora sé que…', 'description' => 'Descubrimientos del sprint que todo el equipo debería conocer'],
        ],
    ],
    'kudos' => [
        'name' => 'Kudos',
        'columns' => [
            ['title' => 'Kudos', 'description' => 'Agradece algo concreto a una persona concreta'],
            ['title' => 'Lo que fue bien', 'description' => 'Lo que funcionó y hay que proteger en el próximo sprint'],
            ['title' => 'A mejorar', 'description' => 'Donde el equipo perdió tiempo o calidad'],
            ['title' => 'Acciones', 'description' => 'Pasos con responsable, sacados de la columna anterior'],
        ],
    ],
    'pros_and_cons' => [
        'name' => 'Pros y contras',
        'columns' => [
            ['title' => 'Pros', 'description' => 'Argumentos a favor de la opción — beneficios, no esperanzas'],
            ['title' => 'Contras', 'description' => 'Costes, riesgos y a qué compromete la opción al equipo'],
        ],
    ],
    'sprint_diagnostics' => [
        'name' => 'Diagnóstico del sprint',
        'columns' => [
            ['title' => '¿Cómo fue este sprint? Puntúalo de 1 a 10 (comunicación, colaboración, calidad, presión)', 'description' => 'Un número y una frase sobre lo que lo explica'],
            ['title' => 'Lo que más gustó o lo que más disgustó', 'description' => 'El momento más fuerte del sprint, positivo o negativo'],
            ['title' => '¿Qué podríamos hacer aún mejor o de otra forma? ¿Cómo?', 'description' => 'Mejoras formuladas como un cambio, no como una queja'],
            ['title' => 'Acciones', 'description' => 'Responsable y fecha para cada cambio acordado'],
        ],
    ],
    'three_ls' => [
        'name' => 'Las 3 L (Gustó, Aprendí, Faltó)',
        'columns' => [
            ['title' => 'Gustó', 'description' => 'Lo que apreciaste del sprint'],
            ['title' => 'Aprendí', 'description' => 'Conocimientos nuevos — sobre el producto, el sistema o el equipo'],
            ['title' => 'Faltó', 'description' => 'Lo que faltaba: información, tiempo, acceso o una decisión'],
        ],
    ],
    'daki' => [
        'name' => 'DAKI (Dejar, Añadir, Mantener, Mejorar)',
        'columns' => [
            ['title' => 'Dejar', 'description' => 'Sin valor ya — un informe que nadie lee, un paso ya automatizado'],
            ['title' => 'Añadir', 'description' => 'Una práctica nueva que probar, una o dos por sprint'],
            ['title' => 'Mantener', 'description' => 'Funciona hoy y hay que defenderlo bajo presión'],
            ['title' => 'Mejorar', 'description' => 'Casi bien — hay que arreglarlo en lugar de quitarlo'],
        ],
    ],
    'swot' => [
        'name' => 'Análisis DAFO',
        'columns' => [
            ['title' => 'Fortalezas', 'description' => 'Ventajas internas con las que el equipo puede contar'],
            ['title' => 'Debilidades', 'description' => 'Carencias internas que cuestan tiempo o calidad'],
            ['title' => 'Oportunidades', 'description' => 'Aperturas externas que conviene aprovechar mientras duren'],
            ['title' => 'Amenazas', 'description' => 'Riesgos externos que harían daño si nada cambia'],
        ],
    ],
    'good_bad_ugly' => [
        'name' => 'El bueno, el feo y el malo',
        'columns' => [
            ['title' => 'Lo bueno', 'description' => 'Lo que salió bien o funcionó bien'],
            ['title' => 'Lo malo', 'description' => 'Lo que no salió según lo previsto, o problemas que surgieron'],
            ['title' => 'Lo feo', 'description' => 'Lo que el equipo no podía cambiar pero debería poder señalar'],
        ],
    ],
    'kanban' => [
        'name' => 'Kanban',
        'columns' => [
            ['title' => 'Por hacer', 'description' => 'Trabajo acordado que aún no ha empezado'],
            ['title' => 'En curso', 'description' => 'En marcha ahora mismo, con un nombre asignado'],
            ['title' => 'Hecho', 'description' => 'Terminado y verificado — prueba de que el equipo avanza'],
        ],
    ],
    'six_thinking_hats' => [
        'name' => 'Seis sombreros para pensar',
        'columns' => [
            ['title' => 'Sombrero verde', 'description' => 'Creatividad: alternativas e ideas, sin juzgar todavía'],
            ['title' => 'Sombrero azul', 'description' => 'Proceso: para qué es esta conversación y qué queda fuera'],
            ['title' => 'Sombrero blanco', 'description' => 'Hechos: cifras y observaciones, sin interpretación'],
            ['title' => 'Sombrero rojo', 'description' => 'Emociones: reacciones instintivas, sin justificar'],
            ['title' => 'Sombrero negro', 'description' => 'Precaución: riesgos y lo que podría salir mal'],
            ['title' => 'Sombrero amarillo', 'description' => 'Beneficios: el valor y lo que ya funciona'],
        ],
    ],
    'post_mortem' => [
        'name' => 'Post mortem',
        'columns' => [
            ['title' => 'Lo que nos gustó', 'description' => 'Lo que aguantó bajo presión y debe quedarse'],
            ['title' => 'Lo que echamos en falta', 'description' => 'Carencias que reveló el incidente: alertas, documentación, accesos'],
            ['title' => 'Lo que aprendí', 'description' => 'Lo que cada persona sabe ahora y no sabía antes'],
            ['title' => 'Para la próxima vez', 'description' => 'Seguimientos con responsable para detectar antes el mismo fallo'],
            ['title' => 'Agradecimientos', 'description' => 'Reconocimiento para quienes sacaron adelante el incidente'],
        ],
    ],
    'rose_bud_thorn' => [
        'name' => 'Rosa, Brote, Espina',
        'columns' => [
            ['title' => 'Rosa', 'description' => 'Lo que claramente funciona ahora mismo'],
            ['title' => 'Brote', 'description' => 'Señales tempranas en las que invertir antes de que se apaguen'],
            ['title' => 'Espina', 'description' => 'Lo que duele y seguirá doliendo hasta que alguien lo arregle'],
        ],
    ],
    'hopes_and_fears' => [
        'name' => 'Esperanzas y miedos',
        'columns' => [
            ['title' => 'Esperanzas', 'description' => 'En qué quiere el equipo que se convierta este proyecto o ciclo'],
            ['title' => 'Miedos', 'description' => 'Lo que podría salir mal — dicho en voz alta mientras aún sale barato'],
        ],
    ],
    'good_bad_better_best' => [
        'name' => 'Bien, Mal, Mejor, Lo mejor',
        'columns' => [
            ['title' => 'Bien', 'description' => 'Salió bien'],
            ['title' => 'Mal', 'description' => 'Salió mal'],
            ['title' => 'Mejor', 'description' => 'Oportunidades de mejora'],
            ['title' => 'Lo mejor', 'description' => 'Resultados, desempeños, acciones y personas destacados'],
        ],
    ],
    'likes_wishes_wonders' => [
        'name' => 'Me gusta, Deseo, Me pregunto',
        'columns' => [
            ['title' => 'Me gusta', 'description' => 'Lo que aprecias de cómo trabaja hoy el equipo'],
            ['title' => 'Deseo', 'description' => 'Cambios que te gustarían, como deseo y no como exigencia'],
            ['title' => 'Me pregunto', 'description' => 'Preguntas y dudas que nadie ha respondido'],
        ],
    ],
    'okr' => [
        'name' => 'OKR (Objetivos y resultados clave)',
        'columns' => [
            ['title' => 'Resultados clave', 'description' => 'Resultados medibles que demuestran que se cumple el objetivo'],
            ['title' => 'Iniciativas', 'description' => 'El trabajo que el equipo hará de verdad para mover esas cifras'],
            ['title' => 'Objetivos', 'description' => 'Dónde quiere estar el equipo — cualitativo y ambicioso'],
        ],
    ],
    'www' => [
        'name' => 'WWW (Funcionó bien, Funcionó a medias, No funcionó)',
        'columns' => [
            ['title' => 'Funcionó bien', 'description' => 'Éxitos claros que conservar a propósito'],
            ['title' => 'Funcionó a medias', 'description' => 'Medios éxitos: la idea era buena, la ejecución no'],
            ['title' => 'No funcionó', 'description' => 'Lo que falló y no debe repetirse tal cual'],
        ],
    ],
    'safety_check' => [
        'name' => 'Control de seguridad',
        'columns' => [
            ['title' => '5', 'description' => 'Sin problema — diré cualquier cosa, incluso lo incómodo'],
            ['title' => '4', 'description' => 'Bastante cómodo — suavizaría cómo planteo uno o dos temas'],
            ['title' => '3', 'description' => 'Selectivo — hablaré del proceso, no de personas ni de mis errores'],
            ['title' => '2', 'description' => 'Reservado — estaré de acuerdo con los demás pero no plantearé nada'],
            ['title' => '1', 'description' => 'En silencio — no diré nada importante en esta sesión'],
        ],
    ],
    'fishbone' => [
        'name' => 'Diagrama de Ishikawa',
        'columns' => [
            ['title' => 'Personas', 'description' => 'Causas en habilidades, plantilla o conocimiento en manos de una sola persona'],
            ['title' => 'Proceso', 'description' => 'Causas en cómo trabajamos: pasos omitidos, reglas no escritas'],
            ['title' => 'Herramientas', 'description' => 'Causas en las herramientas: carencias en alertas, pruebas, entornos'],
            ['title' => 'Programa', 'description' => 'Causas en la planificación: alcance, presupuesto, plazos'],
            ['title' => 'Entorno', 'description' => 'Causas ajenas al equipo: proveedores, tráfico, cambios en la organización'],
            ['title' => 'Soluciones', 'description' => 'Arreglos que atacan las causas anteriores, con responsable'],
        ],
    ],
    'wrap' => [
        'name' => 'WRAP (Deseos, Riesgos, Agradecimientos, Enigmas)',
        'columns' => [
            ['title' => '¿Cuáles son tus deseos?', 'description' => 'Lo que quieres para el equipo de aquí en adelante'],
            ['title' => '¿Qué agradeces?', 'description' => 'Reconocimiento para quienes te facilitaron el trabajo'],
            ['title' => '¿Qué riesgos ves?', 'description' => 'Riesgos que ves venir y de los que nadie se ocupa aún'],
            ['title' => '¿Qué te desconcierta?', 'description' => 'Cosas que no cuadran y merecen una mirada más atenta'],
        ],
    ],
    'learning_matrix' => [
        'name' => 'Matriz de aprendizaje',
        'columns' => [
            ['title' => ':)', 'description' => 'Lo que salió bien y merece repetirse'],
            ['title' => ':(', 'description' => 'Lo que salió mal y le costó al equipo'],
            ['title' => '¡Idea!', 'description' => 'Propuestas para el próximo sprint'],
            ['title' => 'Agradecimientos', 'description' => 'Gracias dirigidas a personas concretas'],
        ],
    ],
    'raid' => [
        'name' => 'Registro RAID (Riesgos, Supuestos, Problemas, Dependencias)',
        'columns' => [
            ['title' => 'Riesgos', 'description' => 'Lo que podría salir mal más adelante — aún no es real'],
            ['title' => 'Supuestos', 'description' => 'Lo que el plan da por hecho sin que nadie lo haya verificado'],
            ['title' => 'Problemas', 'description' => 'Problemas que ya están ocurriendo y necesitan un responsable'],
            ['title' => 'Dependencias', 'description' => 'Trabajo o decisiones externas que el equipo está esperando'],
        ],
    ],
    'liked_lacked_change' => [
        'name' => 'Gustó, Faltó, Cambiar',
        'columns' => [
            ['title' => 'Gustó', 'description' => '¿Qué nos ayudó a avanzar?'],
            ['title' => 'Faltó', 'description' => '¿Qué nos frenó?'],
            ['title' => '¿Qué puedo cambiar yo?', 'description' => '¿Qué debería hacer de otra forma?'],
            ['title' => '¿Qué podemos cambiar?', 'description' => '¿Qué deberíamos hacer de otra forma como equipo?'],
        ],
    ],
    'time_added_stolen_restored' => [
        'name' => 'Tiempo: ganado, robado, recuperado',
        'columns' => [
            ['title' => '¿Qué planes o decisiones te dan más tiempo en el día?', 'description' => 'Hábitos y decisiones que te devuelven horas'],
            ['title' => '¿Qué decisiones personales te roban tiempo?', 'description' => 'Por dónde se escapa tu tiempo: interrupciones, reuniones, retrabajo'],
            ['title' => '¿Cómo recuperas o recuperarías el tiempo perdido?', 'description' => 'Formas concretas de recuperar las horas de arriba'],
        ],
    ],
    'appreciation' => [
        'name' => 'Retro de agradecimiento',
        'columns' => [
            ['title' => 'Me alegra que…', 'description' => 'Lo que te alegró en este sprint, por pequeño que sea'],
            ['title' => 'Me pregunto…', 'description' => 'Preguntas y dudas que llevas al próximo sprint'],
            ['title' => 'No estuvo tan bien que…', 'description' => 'Lo que te decepcionó — el problema, no la persona'],
            ['title' => 'Acciones', 'description' => 'Seguimientos con responsable y fecha'],
            ['title' => 'Agradezco…', 'description' => 'Gracias por una ayuda concreta de personas concretas'],
        ],
    ],
    'christmas' => [
        'name' => 'Retro navideña',
        'columns' => [
            ['title' => 'Navidades pasadas', 'description' => 'Lo que crees que podría haber sido distinto'],
            ['title' => 'Navidad presente', 'description' => 'Lo que funciona genial, y tu agradecimiento a los compañeros'],
            ['title' => 'Navidades futuras', 'description' => 'Lo que quieres tener en el futuro'],
            ['title' => 'Delicias navideñas', 'description' => 'Comparte tu comida navideña favorita'],
        ],
    ],
    'good_bad_learned_learning' => [
        'name' => 'Bien, Mal, Aprendido, Por aprender',
        'columns' => [
            ['title' => '¿Qué salió bien?', 'description' => 'Éxitos que vale la pena repetir a propósito'],
            ['title' => '¿Qué no salió tan bien?', 'description' => 'Lo que salió mal o le costó tiempo al equipo'],
            ['title' => '¿Qué quería aprender en este sprint y lo logré?', 'description' => 'Tus objetivos de aprendizaje del sprint y cómo fueron'],
            ['title' => '¿Qué quiero aprender el próximo sprint?', 'description' => 'Lo que quieres aprender después y lo que necesitas para ello'],
        ],
    ],
    'halloween' => [
        'name' => 'Halloween: el sprint del miedo',
        'columns' => [
            ['title' => '¡Dulces de Halloween!', 'description' => 'Preparar el ambiente'],
            ['title' => '¡Historias de fantasmas!', 'description' => 'Reunir datos'],
            ['title' => '¡Truco o trato!', 'description' => 'Generar ideas'],
            ['title' => '¡Elige una puerta!', 'description' => 'Decidir qué hacer'],
            ['title' => '¡El susto del sprint!', 'description' => 'Cerrar la retrospectiva'],
        ],
    ],
    'plus_delta' => [
        'name' => 'Más / Delta',
        'columns' => [
            ['title' => 'Más', 'description' => 'Todo lo que va bien y debería repetirse'],
            ['title' => 'Delta', 'description' => 'Todo lo que quieres cambiar o que se puede mejorar'],
        ],
    ],
    'energy_levels' => [
        'name' => 'Niveles de energía',
        'columns' => [
            ['title' => 'Carga completa', 'description' => 'Lo que te dio energía y te mantuvo en marcha'],
            ['title' => 'Carga media', 'description' => 'Estable pero sin más — el sprint ni te animó ni te agotó'],
            ['title' => 'Batería baja', 'description' => 'Lo que te agotó o te quitó la motivación'],
            ['title' => 'Energía del sprint', 'description' => 'Cómo cambió la energía del equipo a lo largo del sprint'],
        ],
    ],
    'weather_forecast' => [
        'name' => 'Previsión del tiempo',
        'columns' => [
            ['title' => 'Tormenta', 'description' => '¿Qué ha sido tempestuoso? ¿Qué problemas encontraste y qué impidió avanzar al equipo?'],
            ['title' => 'Lluvia', 'description' => '¿Qué ha sido complicado? ¿Qué retos tuviste y cómo los superaste?'],
            ['title' => 'Nublado', 'description' => '¿Qué ha ido sobre ruedas? ¿Qué experiencias positivas tuviste y te apoyaron tus compañeros?'],
            ['title' => 'Soleado', 'description' => '¿Qué ha sido brillante? ¿Se cumplieron los objetivos del sprint y estás contento con tu aportación?'],
        ],
    ],
    'esvp' => [
        'name' => 'ESVP (Exploradores, Compradores, Vacacionistas, Prisioneros)',
        'columns' => [
            ['title' => 'Exploradores', 'description' => 'Quieren descubrir ideas y perspectivas nuevas'],
            ['title' => 'Compradores', 'description' => 'Miran lo que se ofrece y quieren irse con al menos una idea útil'],
            ['title' => 'Vacacionistas', 'description' => 'No les interesan las retrospectivas, pero les gusta salir de la rutina'],
            ['title' => 'Prisioneros', 'description' => 'Se sienten obligados a asistir y preferirían hacer otra cosa'],
        ],
    ],
    'soar' => [
        'name' => 'Análisis SOAR',
        'columns' => [
            ['title' => 'Fortalezas', 'description' => '¿En qué destacamos?'],
            ['title' => 'Oportunidades', 'description' => '¿Qué nichos y oportunidades podemos aprovechar?'],
            ['title' => 'Aspiraciones', 'description' => '¿Qué queremos lograr?'],
            ['title' => 'Resultados', 'description' => '¿Cómo mediremos que se lograron los objetivos y aspiraciones?'],
        ],
    ],
    'pre_mortem' => [
        'name' => 'Pre mortem',
        'columns' => [
            ['title' => '(Hipotéticamente) ¡El proyecto fracasó! ¿Qué salió mal?', 'description' => 'Imagina que el proyecto ya fracasó — describe cómo ocurrió'],
            ['title' => '¿Qué no hicimos?', 'description' => 'Pasos que el equipo se saltó camino de ese fracaso'],
            ['title' => '¿Qué problemas actuales siguen ahí?', 'description' => 'Problemas que existen hoy y empeorarían el fracaso'],
            ['title' => '¿Alguna otra preocupación?', 'description' => 'Cualquier otra cosa que te inquiete y no tenga responsable'],
        ],
    ],
    'custom' => [
        'name' => 'Personalizado',
        'columns' => [],
    ],
];
```

- [ ] **Step 5: German**

`lang/de/templates.php`:

```php
<?php

return [
    'categories' => [
        'essentials' => 'Klassiker',
        'team_mood' => 'Team und Stimmung',
        'themed' => 'Themen und Spaß',
        'ideas' => 'Ideen und Planung',
        'analysis' => 'Analyse',
    ],
    'went_well_to_improve_actions' => [
        'name' => 'Lief gut, Zu verbessern, Aktionsideen',
        'columns' => [
            ['title' => 'Lief gut', 'description' => 'Was funktioniert hat und sich im nächsten Sprint bewusst wiederholen lässt'],
            ['title' => 'Zu verbessern', 'description' => 'Wo das Team an Schwung verloren hat — Probleme, nicht Personen'],
            ['title' => 'Aktionsideen', 'description' => 'Konkrete Schritte mit Verantwortlichen und Datum, keine Absichten'],
        ],
    ],
    'start_stop_continue' => [
        'name' => 'Starten, Stoppen, Weitermachen',
        'columns' => [
            ['title' => 'Starten', 'description' => 'Neue Praktiken, die sich im nächsten Zyklus auszuprobieren lohnen'],
            ['title' => 'Stoppen', 'description' => 'Gewohnheiten, die im Weg stehen und jetzt enden sollten'],
            ['title' => 'Weitermachen', 'description' => 'Was schon funktioniert und die nächste Änderung überstehen muss'],
        ],
    ],
    'four_ls' => [
        'name' => 'Gemocht, Gelernt, Vermisst, Gewünscht',
        'columns' => [
            ['title' => 'Gut gefallen', 'description' => 'Was dir in diesem Zeitraum gefallen hat oder wertvoll war'],
            ['title' => 'Gelernt', 'description' => 'Was du jetzt weißt und vorher nicht wusstest'],
            ['title' => 'Vermisst', 'description' => 'Was gefehlt und die Arbeit erschwert hat'],
            ['title' => 'Gewünscht', 'description' => 'Was du dir wünschst, auch wenn wir es nicht selbst bauen können'],
        ],
    ],
    'sailboat' => [
        'name' => 'Segelboot',
        'columns' => [
            ['title' => 'Welcher Wind bläst in unsere Segel und macht uns schnell?', 'description' => 'Was uns vorangebracht hat und sich bewusst wiederholen lässt'],
            ['title' => 'Welche Anker halten uns zurück?', 'description' => 'Was uns bremst und in jedem Sprint Widerstand erzeugt'],
            ['title' => 'Welche Felsen vor uns gefährden unsere Zukunft?', 'description' => 'Risiken, die uns schaden, wenn sich nichts ändert'],
            ['title' => 'Was ist unsere ideale Trauminsel?', 'description' => 'Das Ziel, auf das wir zusteuern — einigt euch darauf vor allem anderen'],
        ],
    ],
    'mad_sad_glad' => [
        'name' => 'Wütend, Traurig, Froh',
        'columns' => [
            ['title' => 'Wütend', 'description' => 'Was dich wütend gemacht hat — Dinge, die mehr als einmal schiefgingen'],
            ['title' => 'Traurig', 'description' => 'Was enttäuscht hat — Erwartungen, die nie erfüllt wurden'],
            ['title' => 'Froh', 'description' => 'Was gut lief und im nächsten Sprint geschützt werden sollte'],
        ],
    ],
    'thumbs_up_down_ideas_recognition' => [
        'name' => 'Daumen hoch, Daumen runter, Neue Ideen, Anerkennung',
        'columns' => [
            ['title' => 'Daumen hoch', 'description' => 'Was in diesem Sprint gut lief'],
            ['title' => 'Daumen runter', 'description' => 'Was schiefging oder frustrierend war'],
            ['title' => 'Neue Ideen', 'description' => 'Ideen, die einen Versuch wert sind, auch halb fertige'],
            ['title' => 'Anerkennung', 'description' => 'Dank an Menschen, die anderen die Arbeit leichter gemacht haben'],
        ],
    ],
    'lean_coffee' => [
        'name' => 'Lean Coffee',
        'columns' => [
            ['title' => 'Zu besprechen', 'description' => 'Vorgeschlagene Themen, nach Stimmen sortiert'],
            ['title' => 'In Besprechung', 'description' => 'Das eine Thema, das gerade dran ist'],
            ['title' => 'Besprochen', 'description' => 'Abgeschlossene Themen — prüfe bei jedem, ob es eine Zusage gibt'],
        ],
    ],
    'original_four' => [
        'name' => 'Die ursprünglichen 4 Fragen',
        'columns' => [
            ['title' => 'Was lief gut?', 'description' => 'Erfolge, die laut ausgesprochen werden sollten, egal wie klein'],
            ['title' => 'Was lief nicht so gut?', 'description' => 'Probleme und Fehlschläge — erst die Fakten, dann die Gründe'],
            ['title' => 'Was habe ich gelernt?', 'description' => 'Erkenntnisse, die du jemandem mitgeben würdest, der dieselbe Arbeit beginnt'],
            ['title' => 'Was verwirrt mich noch?', 'description' => 'Offene Fragen, die das Team noch nicht beantwortet hat'],
        ],
    ],
    'starfish' => [
        'name' => 'Seestern',
        'columns' => [
            ['title' => 'Weitermachen', 'description' => 'Im richtigen Maß — schütze es, wenn es hektisch wird'],
            ['title' => 'Weniger davon', 'description' => 'In kleinen Dosen wertvoll, aber nichts zum Abschaffen'],
            ['title' => 'Mehr davon', 'description' => 'Passiert schon gelegentlich und verdient mehr Raum in der Woche'],
            ['title' => 'Anfangen', 'description' => 'Eine neue Praxis zum Ausprobieren — eine oder zwei pro Sprint, nicht mehr'],
            ['title' => 'Aufhören', 'description' => 'Hat überhaupt keinen Wert mehr'],
        ],
    ],
    'three_little_pigs' => [
        'name' => 'Die drei kleinen Schweinchen',
        'columns' => [
            ['title' => 'Haus aus Stroh', 'description' => 'Was leicht zusammenbrechen könnte'],
            ['title' => 'Haus aus Holz', 'description' => 'Was funktioniert, aber besser werden könnte'],
            ['title' => 'Haus aus Stein', 'description' => 'Was stark und stabil ist'],
        ],
    ],
    'dot_voting' => [
        'name' => 'Punktabstimmung',
        'columns' => [
            ['title' => 'Themen und Ideen', 'description' => 'Alle Optionen, die infrage kommen — eine Karte pro Option, dann abstimmen'],
        ],
    ],
    'speed_car' => [
        'name' => 'Rennwagen',
        'columns' => [
            ['title' => 'Motor', 'description' => 'Was macht uns schneller?'],
            ['title' => 'Fallschirm', 'description' => 'Was bremst uns aus?'],
        ],
    ],
    'happy_meh_sad' => [
        'name' => 'Froh, Naja, Traurig',
        'columns' => [
            ['title' => 'Froh :)', 'description' => 'Momente, die dem Team Energie gegeben haben'],
            ['title' => 'Naja :|', 'description' => 'Weder gut noch schlecht — und genau das ist das Signal'],
            ['title' => 'Traurig :(', 'description' => 'Was das Team ausgelaugt hat oder klar schiefging'],
        ],
    ],
    'idea_prioritization' => [
        'name' => 'Ideen priorisieren',
        'columns' => [
            ['title' => 'Niedrige Priorität', 'description' => 'Irgendwann sinnvoll, nichts geht kaputt, wenn es wartet'],
            ['title' => 'Mittlere Priorität', 'description' => 'Sollte im nächsten oder übernächsten Zyklus passieren'],
            ['title' => 'Hohe Priorität', 'description' => 'Kostet Team oder Kundschaft schon jetzt — zuerst angehen'],
        ],
    ],
    'harry_potter' => [
        'name' => 'Harry Potter',
        'columns' => [
            ['title' => 'Felix Felicis', 'description' => 'Gute Dinge!'],
            ['title' => 'Baruffios Hirnelixier', 'description' => 'Was wir gelernt haben!'],
            ['title' => 'Petrificus Totalus', 'description' => 'Was hat uns ausgebremst?'],
            ['title' => 'Trimagischer Pokal', 'description' => 'Dankeschöns!'],
            ['title' => 'Maßnahmen', 'description' => 'Dinge, die wir berücksichtigen sollten'],
        ],
    ],
    'kalm' => [
        'name' => 'KALM (Behalten, Hinzufügen, Mehr, Weniger)',
        'columns' => [
            ['title' => 'Behalten', 'description' => 'Funktioniert heute und ginge unter Druck als Erstes verloren'],
            ['title' => 'Hinzufügen', 'description' => 'Etwas, das wir noch nicht haben und ausprobieren wollen'],
            ['title' => 'Mehr', 'description' => 'Passiert schon gelegentlich und sollte zur Routine werden'],
            ['title' => 'Weniger', 'description' => 'In kleinen Dosen nützlich — reduzieren statt abschaffen'],
        ],
    ],
    'marie_kondo' => [
        'name' => 'Marie-Kondo-Methode',
        'columns' => [
            ['title' => 'Macht Freude', 'description' => 'Was gut lief und gerne bleiben darf'],
            ['title' => 'Wegwerfen', 'description' => 'Was schiefging und nicht bleiben soll'],
            ['title' => 'Recyceln', 'description' => 'Was du verbessern und wiederverwenden willst'],
        ],
    ],
    'game_of_thrones' => [
        'name' => 'Game of Thrones',
        'columns' => [
            ['title' => 'Die Burg', 'description' => 'Worin sind wir richtig gut?'],
            ['title' => 'Das Loch', 'description' => 'Was sind die aktuellen Probleme?'],
            ['title' => 'Die Mauer', 'description' => 'Was würde uns zu einem besseren Team machen?'],
            ['title' => 'Die Weißen Wanderer', 'description' => 'Welche Risiken und Herausforderungen drohen?'],
        ],
    ],
    'love_want_hate_learn' => [
        'name' => 'Liebe, Will, Hasse, Gelernt',
        'columns' => [
            ['title' => 'Ich liebe …', 'description' => 'Was du an der Arbeitsweise des Teams wirklich magst'],
            ['title' => 'Ich will …', 'description' => 'Änderungen, die du willst, als dein eigener Wunsch formuliert'],
            ['title' => 'Ich hasse …', 'description' => 'Was dich frustriert — ehrlich und ungefiltert'],
            ['title' => 'Jetzt weiß ich, dass …', 'description' => 'Entdeckungen aus diesem Sprint, die das ganze Team kennen sollte'],
        ],
    ],
    'kudos' => [
        'name' => 'Kudos',
        'columns' => [
            ['title' => 'Kudos', 'description' => 'Danke einer bestimmten Person für etwas Bestimmtes'],
            ['title' => 'Lief gut', 'description' => 'Was funktioniert hat und im nächsten Sprint geschützt werden sollte'],
            ['title' => 'Zu verbessern', 'description' => 'Wo das Team Zeit oder Qualität verloren hat'],
            ['title' => 'Maßnahmen', 'description' => 'Schritte mit Verantwortlichen, abgeleitet aus der Spalte davor'],
        ],
    ],
    'pros_and_cons' => [
        'name' => 'Pro und Contra',
        'columns' => [
            ['title' => 'Pro', 'description' => 'Argumente für die Option — Vorteile, keine Hoffnungen'],
            ['title' => 'Contra', 'description' => 'Kosten, Risiken und worauf die Option das Team festlegt'],
        ],
    ],
    'sprint_diagnostics' => [
        'name' => 'Sprint-Diagnose',
        'columns' => [
            ['title' => 'Wie war dieser Sprint? Bewerte ihn von 1 bis 10 (Kommunikation, Zusammenarbeit, Qualität, Druck)', 'description' => 'Eine Zahl und ein Satz dazu, was sie bestimmt hat'],
            ['title' => 'Größtes Highlight oder größter Frust', 'description' => 'Der stärkste positive oder negative Moment des Sprints'],
            ['title' => 'Was könnten wir noch besser oder anders machen? Wie?', 'description' => 'Verbesserungen als Änderung formuliert, nicht als Beschwerde'],
            ['title' => 'Maßnahmen', 'description' => 'Verantwortliche und Datum für jede vereinbarte Änderung'],
        ],
    ],
    'three_ls' => [
        'name' => '3 L (Gefallen, Gelernt, Gefehlt)',
        'columns' => [
            ['title' => 'Gefallen', 'description' => 'Was du am Sprint geschätzt hast'],
            ['title' => 'Gelernt', 'description' => 'Neues Wissen — über das Produkt, das System oder das Team'],
            ['title' => 'Gefehlt', 'description' => 'Was fehlte: Information, Zeit, Zugang oder eine Entscheidung'],
        ],
    ],
    'daki' => [
        'name' => 'DAKI (Weglassen, Hinzufügen, Behalten, Verbessern)',
        'columns' => [
            ['title' => 'Weglassen', 'description' => 'Kein Wert mehr — ein Bericht, den niemand liest, ein längst automatisierter Schritt'],
            ['title' => 'Hinzufügen', 'description' => 'Eine neue Praxis zum Ausprobieren, eine oder zwei pro Sprint'],
            ['title' => 'Behalten', 'description' => 'Funktioniert heute und sollte unter Druck verteidigt werden'],
            ['title' => 'Verbessern', 'description' => 'Fast richtig — reparieren statt entfernen'],
        ],
    ],
    'swot' => [
        'name' => 'SWOT-Analyse',
        'columns' => [
            ['title' => 'Stärken', 'description' => 'Interne Vorteile, auf die sich das Team verlassen kann'],
            ['title' => 'Schwächen', 'description' => 'Interne Lücken, die Zeit oder Qualität kosten'],
            ['title' => 'Chancen', 'description' => 'Externe Gelegenheiten, die man nutzen sollte, solange sie da sind'],
            ['title' => 'Risiken', 'description' => 'Externe Gefahren, die schaden, wenn sich nichts ändert'],
        ],
    ],
    'good_bad_ugly' => [
        'name' => 'Zwei glorreiche Halunken',
        'columns' => [
            ['title' => 'Das Gute', 'description' => 'Was gut lief oder gut funktioniert hat'],
            ['title' => 'Das Schlechte', 'description' => 'Was nicht wie geplant lief, oder Probleme, die aufgetaucht sind'],
            ['title' => 'Das Hässliche', 'description' => 'Was das Team nicht ändern konnte, aber ansprechen können sollte'],
        ],
    ],
    'kanban' => [
        'name' => 'Kanban',
        'columns' => [
            ['title' => 'Zu erledigen', 'description' => 'Vereinbarte Arbeit, die noch nicht begonnen hat'],
            ['title' => 'In Arbeit', 'description' => 'Läuft gerade, mit einem Namen daran'],
            ['title' => 'Erledigt', 'description' => 'Fertig und geprüft — der Beweis, dass das Team vorankommt'],
        ],
    ],
    'six_thinking_hats' => [
        'name' => 'Sechs Denkhüte',
        'columns' => [
            ['title' => 'Grüner Hut', 'description' => 'Kreativität: Alternativen und Ideen, noch ohne Bewertung'],
            ['title' => 'Blauer Hut', 'description' => 'Prozess: wozu dieses Gespräch dient und was draußen bleibt'],
            ['title' => 'Weißer Hut', 'description' => 'Fakten: Zahlen und Beobachtungen, ohne Interpretation'],
            ['title' => 'Roter Hut', 'description' => 'Gefühle: Bauchreaktionen, ohne Begründung'],
            ['title' => 'Schwarzer Hut', 'description' => 'Vorsicht: Risiken und was schiefgehen könnte'],
            ['title' => 'Gelber Hut', 'description' => 'Nutzen: der Wert und was schon funktioniert'],
        ],
    ],
    'post_mortem' => [
        'name' => 'Post-Mortem',
        'columns' => [
            ['title' => 'Was uns gefallen hat', 'description' => 'Was unter Druck gehalten hat und bleiben sollte'],
            ['title' => 'Was uns gefehlt hat', 'description' => 'Lücken, die der Vorfall offengelegt hat: Alarme, Doku, Zugänge'],
            ['title' => 'Was ich gelernt habe', 'description' => 'Was jede Person jetzt weiß und vorher nicht wusste'],
            ['title' => 'Für das nächste Mal', 'description' => 'Folgeaufgaben mit Verantwortlichen, damit derselbe Fehler früher auffällt'],
            ['title' => 'Dank', 'description' => 'Anerkennung für die Menschen, die den Vorfall getragen haben'],
        ],
    ],
    'rose_bud_thorn' => [
        'name' => 'Rose, Knospe, Dorn',
        'columns' => [
            ['title' => 'Rose', 'description' => 'Was gerade eindeutig funktioniert'],
            ['title' => 'Knospe', 'description' => 'Frühe Anzeichen, in die es sich zu investieren lohnt, bevor sie verblassen'],
            ['title' => 'Dorn', 'description' => 'Was wehtut und weiter wehtut, bis es jemand behebt'],
        ],
    ],
    'hopes_and_fears' => [
        'name' => 'Hoffnungen und Ängste',
        'columns' => [
            ['title' => 'Hoffnungen', 'description' => 'Was das Team aus diesem Projekt oder Zyklus machen will'],
            ['title' => 'Ängste', 'description' => 'Was schiefgehen könnte — laut ausgesprochen, solange es noch billig ist'],
        ],
    ],
    'good_bad_better_best' => [
        'name' => 'Gut, Schlecht, Besser, Am besten',
        'columns' => [
            ['title' => 'Gut', 'description' => 'Lief gut'],
            ['title' => 'Schlecht', 'description' => 'Lief schlecht'],
            ['title' => 'Besser', 'description' => 'Verbesserungsmöglichkeiten'],
            ['title' => 'Am besten', 'description' => 'Herausragende Ergebnisse, Leistungen, Aktionen und Menschen'],
        ],
    ],
    'likes_wishes_wonders' => [
        'name' => 'Gefällt mir, Wünsche, Fragen',
        'columns' => [
            ['title' => 'Gefällt mir', 'description' => 'Was du an der heutigen Arbeitsweise des Teams schätzt'],
            ['title' => 'Wünsche', 'description' => 'Änderungen, die du dir wünschst — als Wunsch, nicht als Forderung'],
            ['title' => 'Fragen', 'description' => 'Offene Fragen und Zweifel, die noch niemand beantwortet hat'],
        ],
    ],
    'okr' => [
        'name' => 'OKR (Objectives and Key Results)',
        'columns' => [
            ['title' => 'Schlüsselergebnisse', 'description' => 'Messbare Ergebnisse, die belegen, dass das Ziel erreicht ist'],
            ['title' => 'Initiativen', 'description' => 'Die Arbeit, die das Team wirklich tut, um diese Zahlen zu bewegen'],
            ['title' => 'Ziele', 'description' => 'Wo das Team hinwill — qualitativ und ehrgeizig'],
        ],
    ],
    'www' => [
        'name' => 'WWW (Lief gut, Lief halbwegs, Lief nicht)',
        'columns' => [
            ['title' => 'Lief gut', 'description' => 'Klare Erfolge, die wir bewusst beibehalten'],
            ['title' => 'Lief halbwegs', 'description' => 'Halbe Erfolge: richtige Idee, falsche Umsetzung'],
            ['title' => 'Lief nicht', 'description' => 'Was gescheitert ist und so nicht wiederholt werden sollte'],
        ],
    ],
    'safety_check' => [
        'name' => 'Sicherheitscheck',
        'columns' => [
            ['title' => '5', 'description' => 'Kein Problem — ich sage alles, auch Unangenehmes'],
            ['title' => '4', 'description' => 'Meist entspannt — bei ein oder zwei Themen würde ich vorsichtiger formulieren'],
            ['title' => '3', 'description' => 'Wählerisch — ich rede über den Prozess, nicht über Menschen oder eigene Fehler'],
            ['title' => '2', 'description' => 'Zurückhaltend — ich stimme anderen zu, bringe aber selbst nichts ein'],
            ['title' => '1', 'description' => 'Still — ich werde in dieser Sitzung nichts Wesentliches sagen'],
        ],
    ],
    'fishbone' => [
        'name' => 'Fischgräten-Analyse',
        'columns' => [
            ['title' => 'Menschen', 'description' => 'Ursachen in Fähigkeiten, Besetzung oder Wissen, das nur eine Person hat'],
            ['title' => 'Prozess', 'description' => 'Ursachen in unserer Arbeitsweise: übersprungene Schritte, ungeschriebene Regeln'],
            ['title' => 'Werkzeuge', 'description' => 'Ursachen in den Werkzeugen: Lücken bei Alarmen, Tests, Umgebungen'],
            ['title' => 'Programm', 'description' => 'Ursachen in der Planung: Umfang, Budget, Fristen'],
            ['title' => 'Umfeld', 'description' => 'Ursachen außerhalb des Teams: Lieferanten, Last, Umstrukturierungen'],
            ['title' => 'Lösungen', 'description' => 'Korrekturen, die die Ursachen oben angehen, mit Verantwortlichen'],
        ],
    ],
    'wrap' => [
        'name' => 'WRAP (Wünsche, Risiken, Anerkennung, Rätsel)',
        'columns' => [
            ['title' => 'Was wünschst du dir?', 'description' => 'Was du dir für das Team in Zukunft wünschst'],
            ['title' => 'Was schätzt du?', 'description' => 'Anerkennung für Menschen, die dir die Arbeit erleichtert haben'],
            ['title' => 'Welche Risiken siehst du?', 'description' => 'Risiken, die du kommen siehst und um die sich noch niemand kümmert'],
            ['title' => 'Was gibt dir Rätsel auf?', 'description' => 'Dinge, die nicht zusammenpassen und einen genaueren Blick verdienen'],
        ],
    ],
    'learning_matrix' => [
        'name' => 'Lernmatrix',
        'columns' => [
            ['title' => ':)', 'description' => 'Was gut lief und wiederholt werden sollte'],
            ['title' => ':(', 'description' => 'Was schlecht lief und das Team etwas gekostet hat'],
            ['title' => 'Idee!', 'description' => 'Vorschläge für den nächsten Sprint'],
            ['title' => 'Anerkennung', 'description' => 'Dank an bestimmte Menschen'],
        ],
    ],
    'raid' => [
        'name' => 'RAID-Log (Risiken, Annahmen, Probleme, Abhängigkeiten)',
        'columns' => [
            ['title' => 'Risiken', 'description' => 'Was später schiefgehen könnte — noch nicht eingetreten'],
            ['title' => 'Annahmen', 'description' => 'Was der Plan voraussetzt, ohne dass es jemand geprüft hat'],
            ['title' => 'Probleme', 'description' => 'Probleme, die schon auftreten und Verantwortliche brauchen'],
            ['title' => 'Abhängigkeiten', 'description' => 'Externe Arbeit oder Entscheidungen, auf die das Team wartet'],
        ],
    ],
    'liked_lacked_change' => [
        'name' => 'Gefallen, Gefehlt, Ändern',
        'columns' => [
            ['title' => 'Gefallen', 'description' => 'Was hat uns vorangebracht?'],
            ['title' => 'Gefehlt', 'description' => 'Was hat uns zurückgehalten?'],
            ['title' => 'Was kann ich ändern?', 'description' => 'Was sollte ich anders machen?'],
            ['title' => 'Was können wir ändern?', 'description' => 'Was sollten wir als Team anders machen?'],
        ],
    ],
    'time_added_stolen_restored' => [
        'name' => 'Zeit: gewonnen, gestohlen, zurückgeholt',
        'columns' => [
            ['title' => 'Welche Pläne oder Entscheidungen schenken dir Zeit am Tag?', 'description' => 'Gewohnheiten und Entscheidungen, die dir Stunden zurückgeben'],
            ['title' => 'Welche persönlichen Entscheidungen stehlen dir Zeit?', 'description' => 'Wo deine Zeit versickert: Unterbrechungen, Meetings, Nacharbeit'],
            ['title' => 'Wie holst du verlorene Zeit zurück?', 'description' => 'Konkrete Wege, die oben genannten Stunden zurückzuholen'],
        ],
    ],
    'appreciation' => [
        'name' => 'Wertschätzungs-Retro',
        'columns' => [
            ['title' => 'Ich bin froh, dass …', 'description' => 'Was dich in diesem Sprint gefreut hat, egal wie klein'],
            ['title' => 'Ich frage mich …', 'description' => 'Offene Fragen und Zweifel, die du in den nächsten Sprint mitnimmst'],
            ['title' => 'Es war nicht so toll, dass …', 'description' => 'Was dich enttäuscht hat — das Problem, nicht die Person'],
            ['title' => 'Maßnahmen', 'description' => 'Folgeaufgaben mit Verantwortlichen und Datum'],
            ['title' => 'Ich schätze …', 'description' => 'Dank für konkrete Hilfe von bestimmten Menschen'],
        ],
    ],
    'christmas' => [
        'name' => 'Weihnachts-Retro',
        'columns' => [
            ['title' => 'Vergangene Weihnacht', 'description' => 'Was deiner Meinung nach anders hätte laufen können'],
            ['title' => 'Gegenwärtige Weihnacht', 'description' => 'Was großartig funktioniert, und Dank an Kolleginnen und Kollegen'],
            ['title' => 'Zukünftige Weihnacht', 'description' => 'Was du dir für die Zukunft wünschst'],
            ['title' => 'Weihnachtsschmaus', 'description' => 'Teile dein liebstes Weihnachtsessen'],
        ],
    ],
    'good_bad_learned_learning' => [
        'name' => 'Gut, Schlecht, Gelernt, Lernen',
        'columns' => [
            ['title' => 'Was lief gut?', 'description' => 'Erfolge, die sich bewusst wiederholen lassen'],
            ['title' => 'Was lief nicht so gut?', 'description' => 'Was schiefging oder das Team Zeit gekostet hat'],
            ['title' => 'Was wollte ich in diesem Sprint lernen, und habe ich es gelernt?', 'description' => 'Deine Lernziele für diesen Sprint und wie es gelaufen ist'],
            ['title' => 'Was will ich im nächsten Sprint lernen?', 'description' => 'Was du als Nächstes lernen willst und was du dafür brauchst'],
        ],
    ],
    'halloween' => [
        'name' => 'Halloween: gruseliger Sprint',
        'columns' => [
            ['title' => 'Halloween-Leckereien!', 'description' => 'Die Bühne bereiten'],
            ['title' => 'Geistergeschichten!', 'description' => 'Daten sammeln'],
            ['title' => 'Süßes oder Saures!', 'description' => 'Erkenntnisse gewinnen'],
            ['title' => 'Wähle eine Tür!', 'description' => 'Entscheiden, was zu tun ist'],
            ['title' => 'Schreck des Sprints!', 'description' => 'Die Retrospektive abschließen'],
        ],
    ],
    'plus_delta' => [
        'name' => 'Plus / Delta',
        'columns' => [
            ['title' => 'Plus', 'description' => 'Alles, was gut läuft und wiederholt werden sollte'],
            ['title' => 'Delta', 'description' => 'Alles, was du ändern willst oder was sich verbessern lässt'],
        ],
    ],
    'energy_levels' => [
        'name' => 'Energielevel',
        'columns' => [
            ['title' => 'Voll geladen', 'description' => 'Was dir Energie gegeben und dich angetrieben hat'],
            ['title' => 'Halb geladen', 'description' => 'Stabil, aber unauffällig — der Sprint hat dich weder beflügelt noch ausgelaugt'],
            ['title' => 'Akku schwach', 'description' => 'Was dich erschöpft oder deine Motivation geraubt hat'],
            ['title' => 'Sprint-Energie', 'description' => 'Wie sich die Energie des Teams über den ganzen Sprint entwickelt hat'],
        ],
    ],
    'weather_forecast' => [
        'name' => 'Wettervorhersage',
        'columns' => [
            ['title' => 'Stürmisch', 'description' => 'Was war stürmisch? Mit welchen Problemen hattest du zu tun, und was hat das Team am Vorankommen gehindert?'],
            ['title' => 'Regnerisch', 'description' => 'Was war mühsam? Welche Herausforderungen hattest du, und wie hast du sie gemeistert?'],
            ['title' => 'Bewölkt', 'description' => 'Was war erfreulich? Welche positiven Erfahrungen hast du gemacht, und haben dich andere unterstützt?'],
            ['title' => 'Sonnig', 'description' => 'Was war strahlend? Wurden die Sprintziele erreicht, und bist du mit deinem Beitrag zufrieden?'],
        ],
    ],
    'esvp' => [
        'name' => 'ESVP (Entdecker, Shopper, Urlauber, Gefangene)',
        'columns' => [
            ['title' => 'Entdecker', 'description' => 'Wollen neue Ideen und Einsichten entdecken'],
            ['title' => 'Shopper', 'description' => 'Schauen sich das Angebot an und wollen mindestens eine nützliche Idee mitnehmen'],
            ['title' => 'Urlauber', 'description' => 'Interessieren sich nicht für Retrospektiven, genießen aber die Pause vom Alltag'],
            ['title' => 'Gefangene', 'description' => 'Fühlen sich zur Teilnahme gezwungen und würden lieber etwas anderes tun'],
        ],
    ],
    'soar' => [
        'name' => 'SOAR-Analyse',
        'columns' => [
            ['title' => 'Stärken', 'description' => 'Worin sind wir hervorragend?'],
            ['title' => 'Chancen', 'description' => 'Welche Nischen und Gelegenheiten können wir nutzen?'],
            ['title' => 'Ambitionen', 'description' => 'Was wollen wir erreichen?'],
            ['title' => 'Ergebnisse', 'description' => 'Wie messen wir, dass Ziele und Ambitionen erreicht wurden?'],
        ],
    ],
    'pre_mortem' => [
        'name' => 'Pre-Mortem',
        'columns' => [
            ['title' => '(Hypothetisch) Das Projekt ist gescheitert! Was ist schiefgelaufen?', 'description' => 'Stell dir vor, das Projekt ist bereits gescheitert — beschreibe, wie es dazu kam'],
            ['title' => 'Was haben wir nicht getan?', 'description' => 'Schritte, die das Team auf dem Weg zu diesem Scheitern ausgelassen hat'],
            ['title' => 'Welche aktuellen Probleme bestehen weiter?', 'description' => 'Probleme, die heute bestehen und das Scheitern verschlimmern würden'],
            ['title' => 'Weitere Bedenken?', 'description' => 'Alles andere, was dich beschäftigt und niemandem gehört'],
        ],
    ],
    'custom' => [
        'name' => 'Benutzerdefiniert',
        'columns' => [],
    ],
];
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/TemplateCatalogueTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS. If a title or description exceeds its limit, shorten that translation (never the English limit).

- [ ] **Step 7: Format and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add lang/fr/templates.php lang/es/templates.php lang/de/templates.php tests/Feature/Retros/TemplateCatalogueTest.php tests/Feature/TranslationKeysTest.php
git commit -m "feat: translate the template catalogue into french, spanish and german

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 7: Workspace templates (storage, management endpoints, templates page)

**Files:**
- Create: `database/migrations/2026_10_01_100300_create_workspace_templates_table.php`, `database/migrations/2026_10_01_100400_create_workspace_template_columns_table.php`, `database/migrations/2026_10_01_100500_add_workspace_template_id_to_retros_table.php`, `app/Models/WorkspaceTemplate.php`, `app/Models/WorkspaceTemplateColumn.php`, `database/factories/WorkspaceTemplateFactory.php`, `database/factories/WorkspaceTemplateColumnFactory.php`, `app/Http/Requests/WorkspaceTemplateRequest.php`, `app/Http/Controllers/WorkspaceTemplatesController.php`, `app/Actions/Retros/BuildTemplateCatalogue.php`
- Modify: `app/Models/Workspace.php`, `app/Models/Retro.php`, `app/Policies/WorkspacePolicy.php`, `app/Support/RetroTemplates/TemplateCatalogue.php`, `routes/web.php`, `lang/{en,fr,es,de}.json`, `resources/js/types/workspaces.ts`, `resources/js/components/app-sidebar.tsx`
- Create (frontend): `resources/js/components/templates/template-chips.tsx`, `resources/js/pages/workspaces/templates.tsx`
- Test: create `tests/Feature/Workspaces/WorkspaceTemplatesTest.php`

**Interfaces:**
- Consumes: `TemplateCategory`, `TemplateCatalogue`, `TemplateDefinition` (Task 5), `ColumnColor`.
- Produces:
  - Tables `workspace_templates` (`id`, `workspace_id` cascade, `name` ≤ 80 unique per workspace case-insensitively, `category`, `created_by_user_id` nullable null-on-delete, timestamps) and `workspace_template_columns` (`id`, `workspace_template_id` cascade, `title` ≤ 100, `description` ≤ 200 nullable, `color`, `position`, timestamps); `retros.workspace_template_id` nullable FK null-on-delete.
  - `App\Models\WorkspaceTemplate` (`columns()` ordered by position, `workspace()`, `KeyPrefix = 'workspace:'`, `static idFromKey(string $key): ?string`, `catalogueKey(): string`), `App\Models\WorkspaceTemplateColumn`, `Workspace::templates()`, `Retro::workspaceTemplate()`, factories (`WorkspaceTemplateFactory::withColumns(int $count = 2)`).
  - `TemplateCatalogue::Workspace = 'workspace'` (the `retros.template` value of a retro created from a workspace template).
  - `WorkspacePolicy::manageTemplates(User, Workspace): bool` (= `canManage`).
  - Routes `workspaces.templates.index|store|update|destroy` (`GET|POST /w/{workspace}/templates`, `PATCH|DELETE /w/{workspace}/templates/{template}`), `WorkspaceTemplatesController::MaxTemplates = 100`.
  - `App\Actions\Retros\BuildTemplateCatalogue::handle(Workspace $workspace): array<int, array{key: string, name: string, category: ?string, isCommon: bool, isWorkspace: bool, columns: array<int, array{title: string, description: ?string, color: string}>}>` — workspace templates first (by name, key `workspace:{id}`), then the built-ins in catalogue order in the viewer's locale.
  - Inertia page `workspaces/templates` props: `workspace`, `templates: [{id, name, category, columns: [{title, description, color}]}]`, `categories: [{value, label}]`, `canManage: bool`, optional `catalogue`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Workspaces/WorkspaceTemplatesTest.php`:

```php
<?php

use App\Enums\WorkspaceRole;
use App\Models\Column;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Inertia\Testing\AssertableInertia as Assert;

function templatesWorkspace(WorkspaceRole $role = WorkspaceRole::Admin): array
{
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, $role)->create();

    return [$user, $workspace];
}

function templatePayload(array $overrides = []): array
{
    return [
        'name' => 'Team pulse',
        'category' => 'team_mood',
        'columns' => [
            ['title' => 'Energy', 'description' => 'How charged you feel', 'color' => 'green'],
            ['title' => 'Blockers', 'color' => 'red'],
        ],
        ...$overrides,
    ];
}

it('shows the workspace templates to every member and loads the catalogue on demand', function () {
    [$member, $workspace] = templatesWorkspace(WorkspaceRole::Member);
    $template = WorkspaceTemplate::factory()->withColumns()->for($workspace)->create(['name' => 'Ours']);

    $this->actingAs($member)
        ->get(route('workspaces.templates.index', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->component('workspaces/templates')
            ->where('templates.0.id', $template->id)
            ->has('templates.0.columns', 2)
            ->has('categories', 5)
            ->where('canManage', false)
            ->missing('catalogue')
            ->reloadOnly('catalogue', fn (Assert $reload) => $reload
                ->has('catalogue', 54)
                ->where('catalogue.0.key', "workspace:{$template->id}")
                ->where('catalogue.0.isWorkspace', true)
                ->where('catalogue.1.key', 'went_well_to_improve_actions')
                ->where('catalogue.1.isCommon', true)
                ->where('catalogue.53.key', 'custom')));
});

it('lets owners and admins create a template with its columns', function (WorkspaceRole $role) {
    [$user, $workspace] = templatesWorkspace($role);

    $this->actingAs($user)
        ->post(route('workspaces.templates.store', $workspace), templatePayload())
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $template = $workspace->templates()->sole();

    expect($template->only(['name', 'created_by_user_id']))->toBe(['name' => 'Team pulse', 'created_by_user_id' => $user->id])
        ->and($template->category->value)->toBe('team_mood')
        ->and($template->columns->map->only(['title', 'description', 'position'])->all())->toBe([
            ['title' => 'Energy', 'description' => 'How charged you feel', 'position' => 0],
            ['title' => 'Blockers', 'description' => null, 'position' => 1],
        ]);
})->with([WorkspaceRole::Owner, WorkspaceRole::Admin]);

it('replaces the columns when a template is updated', function () {
    [$admin, $workspace] = templatesWorkspace();
    $template = WorkspaceTemplate::factory()->withColumns(3)->for($workspace)->create();

    $this->actingAs($admin)
        ->patch(route('workspaces.templates.update', [$workspace, $template]), templatePayload([
            'name' => $template->name,
            'columns' => [['title' => 'Only one', 'color' => 'blue']],
        ]))
        ->assertSessionHasNoErrors();

    expect($template->fresh()->columns->pluck('title')->all())->toBe(['Only one']);
});

it('deletes a template without touching retros created from it', function () {
    [$admin, $workspace] = templatesWorkspace();
    $template = WorkspaceTemplate::factory()->withColumns()->for($workspace)->create();
    $retro = Retro::factory()->for(Team::factory()->for($workspace))->create([
        'workspace_template_id' => $template->id,
    ]);
    Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Copied']);

    $this->actingAs($admin)->delete(route('workspaces.templates.destroy', [$workspace, $template]))->assertRedirect();

    expect(WorkspaceTemplate::find($template->id))->toBeNull()
        ->and($retro->fresh()->workspace_template_id)->toBeNull()
        ->and($retro->fresh()->columns->pluck('title')->all())->toBe(['Copied']);
});

it('forbids plain members from managing templates', function () {
    [$member, $workspace] = templatesWorkspace(WorkspaceRole::Member);
    $template = WorkspaceTemplate::factory()->withColumns()->for($workspace)->create();

    $this->actingAs($member)->post(route('workspaces.templates.store', $workspace), templatePayload())->assertForbidden();
    $this->actingAs($member)->patch(route('workspaces.templates.update', [$workspace, $template]), templatePayload())->assertForbidden();
    $this->actingAs($member)->delete(route('workspaces.templates.destroy', [$workspace, $template]))->assertForbidden();
});

it('returns 404 for a template of another workspace', function () {
    [$admin, $workspace] = templatesWorkspace();
    $foreign = WorkspaceTemplate::factory()->withColumns()->create();

    $this->actingAs($admin)->patch(route('workspaces.templates.update', [$workspace, $foreign]), templatePayload())->assertNotFound();
    $this->actingAs($admin)->delete(route('workspaces.templates.destroy', [$workspace, $foreign]))->assertNotFound();
});

it('validates templates', function (array $overrides, string $field) {
    [$admin, $workspace] = templatesWorkspace();

    $this->actingAs($admin)
        ->post(route('workspaces.templates.store', $workspace), templatePayload($overrides))
        ->assertSessionHasErrors($field);

    expect($workspace->templates()->count())->toBe(0);
})->with([
    'no name' => [['name' => ''], 'name'],
    'long name' => [['name' => str_repeat('a', 81)], 'name'],
    'unknown category' => [['category' => 'fun'], 'category'],
    'no columns' => [['columns' => []], 'columns'],
    'eleven columns' => [['columns' => array_fill(0, 11, ['title' => 'X', 'color' => 'green'])], 'columns'],
    'long title' => [['columns' => [['title' => str_repeat('a', 101), 'color' => 'green']]], 'columns.0.title'],
    'long description' => [['columns' => [['title' => 'X', 'description' => str_repeat('a', 201), 'color' => 'green']]], 'columns.0.description'],
    'unknown color' => [['columns' => [['title' => 'X', 'color' => 'pink']]], 'columns.0.color'],
]);

it('refuses a duplicate name whatever its case, except for the template itself', function () {
    [$admin, $workspace] = templatesWorkspace();
    $existing = WorkspaceTemplate::factory()->withColumns()->for($workspace)->create(['name' => 'Team Pulse']);

    $this->actingAs($admin)
        ->post(route('workspaces.templates.store', $workspace), templatePayload(['name' => 'team pulse']))
        ->assertSessionHasErrors(['name' => 'A template with this name already exists.']);

    $this->actingAs($admin)
        ->patch(route('workspaces.templates.update', [$workspace, $existing]), templatePayload(['name' => 'TEAM PULSE']))
        ->assertSessionHasNoErrors();
});

it('refuses a 101st template', function () {
    [$admin, $workspace] = templatesWorkspace();
    WorkspaceTemplate::factory()->count(100)->for($workspace)->create();

    $this->actingAs($admin)
        ->post(route('workspaces.templates.store', $workspace), templatePayload())
        ->assertSessionHasErrors(['name' => 'This workspace already has 100 templates.']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Workspaces/WorkspaceTemplatesTest.php`
Expected: FAIL — `Class "App\Models\WorkspaceTemplate" not found`.

- [ ] **Step 3: Migrations**

`database/migrations/2026_10_01_100300_create_workspace_templates_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspace_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('category');
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        DB::statement('create unique index workspace_templates_workspace_name_unique on workspace_templates (workspace_id, lower(name))');
    }
};
```

`database/migrations/2026_10_01_100400_create_workspace_template_columns_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspace_template_columns', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('workspace_template_id')->constrained()->cascadeOnDelete();
            $table->string('title', 100);
            $table->string('description', 200)->nullable();
            $table->string('color');
            $table->unsignedSmallInteger('position');
            $table->timestamps();

            $table->index(['workspace_template_id', 'position']);
        });
    }
};
```

`database/migrations/2026_10_01_100500_add_workspace_template_id_to_retros_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retros', function (Blueprint $table) {
            $table->foreignUuid('workspace_template_id')->nullable()->constrained()->nullOnDelete();
        });
    }
};
```

- [ ] **Step 4: Models and factories**

`app/Models/WorkspaceTemplate.php`:

```php
<?php

namespace App\Models;

use App\Enums\TemplateCategory;
use Database\Factories\WorkspaceTemplateFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * @property string $id
 * @property string $workspace_id
 * @property string $name
 * @property TemplateCategory $category
 * @property string|null $created_by_user_id
 * @property-read Collection<int, WorkspaceTemplateColumn> $columns
 */
#[Fillable(['name', 'category', 'created_by_user_id'])]
class WorkspaceTemplate extends Model
{
    /** @use HasFactory<WorkspaceTemplateFactory> */
    use HasFactory;

    use HasUuids;

    public const KeyPrefix = 'workspace:';

    public static function idFromKey(string $key): ?string
    {
        if (! str_starts_with($key, self::KeyPrefix)) {
            return null;
        }

        $id = substr($key, strlen(self::KeyPrefix));

        return Str::isUuid($id) ? $id : null;
    }

    public function catalogueKey(): string
    {
        return self::KeyPrefix.$this->id;
    }

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /** @return HasMany<WorkspaceTemplateColumn, $this> */
    public function columns(): HasMany
    {
        return $this->hasMany(WorkspaceTemplateColumn::class)->orderBy('position');
    }

    protected function casts(): array
    {
        return [
            'category' => TemplateCategory::class,
        ];
    }
}
```

`app/Models/WorkspaceTemplateColumn.php`:

```php
<?php

namespace App\Models;

use App\Enums\ColumnColor;
use Database\Factories\WorkspaceTemplateColumnFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $workspace_template_id
 * @property string $title
 * @property string|null $description
 * @property ColumnColor $color
 * @property int $position
 */
#[Fillable(['title', 'description', 'color', 'position'])]
class WorkspaceTemplateColumn extends Model
{
    /** @use HasFactory<WorkspaceTemplateColumnFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<WorkspaceTemplate, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(WorkspaceTemplate::class, 'workspace_template_id');
    }

    protected function casts(): array
    {
        return [
            'color' => ColumnColor::class,
            'position' => 'integer',
        ];
    }
}
```

`database/factories/WorkspaceTemplateFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\TemplateCategory;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Factories\Sequence;

/**
 * @extends Factory<WorkspaceTemplate>
 */
class WorkspaceTemplateFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'name' => fake()->unique()->words(3, true),
            'category' => TemplateCategory::Essentials,
        ];
    }

    public function withColumns(int $count = 2): static
    {
        return $this->has(
            WorkspaceTemplateColumn::factory()->count($count)->state(new Sequence(fn (Sequence $sequence) => ['position' => $sequence->index])),
            'columns',
        );
    }
}
```

`database/factories/WorkspaceTemplateColumnFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\ColumnColor;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WorkspaceTemplateColumn>
 */
class WorkspaceTemplateColumnFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workspace_template_id' => WorkspaceTemplate::factory(),
            'title' => fake()->words(2, true),
            'description' => null,
            'color' => ColumnColor::Green,
            'position' => 0,
        ];
    }
}
```

`app/Models/Workspace.php` — add:

```php
    /** @return HasMany<WorkspaceTemplate, $this> */
    public function templates(): HasMany
    {
        return $this->hasMany(WorkspaceTemplate::class);
    }
```

`app/Models/Retro.php` — docblock `@property string|null $workspace_template_id`, add `'workspace_template_id'` to `#[Fillable]`, and:

```php
    /** @return BelongsTo<WorkspaceTemplate, $this> */
    public function workspaceTemplate(): BelongsTo
    {
        return $this->belongsTo(WorkspaceTemplate::class);
    }
```

`app/Support/RetroTemplates/TemplateCatalogue.php` — below `public const Custom = 'custom';` add:

```php
    public const Workspace = 'workspace';
```

- [ ] **Step 5: Policy, request, catalogue builder, controller, routes**

`app/Policies/WorkspacePolicy.php` — add:

```php
    public function manageTemplates(User $user, Workspace $workspace): bool
    {
        return $user->canManage($workspace);
    }
```

`app/Http/Requests/WorkspaceTemplateRequest.php` (`vendor/bin/sail artisan make:request WorkspaceTemplateRequest --no-interaction`):

```php
<?php

namespace App\Http\Requests;

use App\Enums\ColumnColor;
use App\Enums\TemplateCategory;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class WorkspaceTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manageTemplates', $this->workspace()) ?? false;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:80'],
            'category' => ['required', Rule::enum(TemplateCategory::class)],
            'columns' => ['required', 'array', 'min:1', 'max:10'],
            'columns.*.title' => ['required', 'string', 'max:100'],
            'columns.*.description' => ['nullable', 'string', 'max:200'],
            'columns.*.color' => ['required', Rule::enum(ColumnColor::class)],
        ];
    }

    /**
     * @return array<int, Closure>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->has('name')) {
                    return;
                }

                if (! $this->nameIsTaken()) {
                    return;
                }

                $validator->errors()->add('name', __('A template with this name already exists.'));
            },
        ];
    }

    /**
     * @return array{
     *     name: string,
     *     category: string
     * }
     */
    public function templateAttributes(): array
    {
        return [
            'name' => (string) $this->validated('name'),
            'category' => (string) $this->validated('category'),
        ];
    }

    /**
     * @return array<int, array{
     *     title: string,
     *     description: ?string,
     *     color: string
     * }>
     */
    public function templateColumns(): array
    {
        /** @var array<int, array{title: string, description?: ?string, color: string}> $columns */
        $columns = array_values($this->validated('columns'));

        return array_map(fn (array $column) => [
            'title' => $column['title'],
            'description' => $column['description'] ?? null,
            'color' => $column['color'],
        ], $columns);
    }

    private function workspace(): Workspace
    {
        $workspace = $this->route('workspace');

        abort_unless($workspace instanceof Workspace, 404);

        return $workspace;
    }

    private function nameIsTaken(): bool
    {
        $template = $this->route('template');

        return $this->workspace()->templates()
            ->whereRaw('lower(name) = ?', [mb_strtolower((string) $this->input('name'))])
            ->when($template instanceof WorkspaceTemplate, fn ($query) => $query->whereKeyNot($template->id))
            ->exists();
    }
}
```

`app/Actions/Retros/BuildTemplateCatalogue.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;
use App\Support\RetroTemplates\TemplateCatalogue;
use App\Support\RetroTemplates\TemplateDefinition;

class BuildTemplateCatalogue
{
    /**
     * @return array<int, array{
     *     key: string,
     *     name: string,
     *     category: ?string,
     *     isCommon: bool,
     *     isWorkspace: bool,
     *     columns: array<int, array{title: string, description: ?string, color: string}>
     * }>
     */
    public function handle(Workspace $workspace): array
    {
        $workspaceTemplates = $workspace->templates()->with('columns')->orderBy('name')->get()
            ->map(fn (WorkspaceTemplate $template) => [
                'key' => $template->catalogueKey(),
                'name' => $template->name,
                'category' => $template->category->value,
                'isCommon' => false,
                'isWorkspace' => true,
                'columns' => $template->columns->map(fn (WorkspaceTemplateColumn $column) => [
                    'title' => $column->title,
                    'description' => $column->description,
                    'color' => $column->color->value,
                ])->values()->all(),
            ])
            ->values()
            ->all();

        $builtIns = array_map(fn (TemplateDefinition $definition) => [
            'key' => $definition->key,
            'name' => $definition->name(),
            'category' => $definition->category?->value,
            'isCommon' => $definition->isCommon,
            'isWorkspace' => false,
            'columns' => array_map(fn (array $column) => [
                'title' => $column['title'],
                'description' => $column['description'],
                'color' => $column['color']->value,
            ], $definition->translatedColumns()),
        ], TemplateCatalogue::all());

        return [...$workspaceTemplates, ...$builtIns];
    }
}
```

`app/Http/Controllers/WorkspaceTemplatesController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Retros\BuildTemplateCatalogue;
use App\Enums\TemplateCategory;
use App\Http\Requests\WorkspaceTemplateRequest;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceTemplatesController extends Controller
{
    public const MaxTemplates = 100;

    public function index(Request $request, Workspace $workspace, BuildTemplateCatalogue $buildTemplateCatalogue): Response
    {
        return Inertia::render('workspaces/templates', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'templates' => $workspace->templates()->with('columns')->orderBy('name')->get()
                ->map(fn (WorkspaceTemplate $template) => $this->present($template))
                ->values(),
            'categories' => TemplateCategory::options(),
            'canManage' => $request->user()->canManage($workspace),
            'catalogue' => Inertia::optional(fn () => $buildTemplateCatalogue->handle($workspace)),
        ]);
    }

    public function store(WorkspaceTemplateRequest $request, Workspace $workspace): RedirectResponse
    {
        DB::transaction(function () use ($request, $workspace): void {
            Workspace::query()->whereKey($workspace->id)->lockForUpdate()->first();

            if ($workspace->templates()->count() >= self::MaxTemplates) {
                throw ValidationException::withMessages(['name' => __('This workspace already has 100 templates.')]);
            }

            $template = $workspace->templates()->create([
                ...$request->templateAttributes(),
                'created_by_user_id' => $request->user()?->id,
            ]);

            $this->replaceColumns($template, $request->templateColumns());
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Template saved.')]);

        return back();
    }

    public function update(WorkspaceTemplateRequest $request, Workspace $workspace, WorkspaceTemplate $template): RedirectResponse
    {
        DB::transaction(function () use ($request, $template): void {
            $template->update($request->templateAttributes());

            $this->replaceColumns($template, $request->templateColumns());
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Template saved.')]);

        return back();
    }

    public function destroy(Workspace $workspace, WorkspaceTemplate $template): RedirectResponse
    {
        Gate::authorize('manageTemplates', $workspace);

        $template->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Template deleted.')]);

        return back();
    }

    /**
     * @param  array<int, array{title: string, description: ?string, color: string}>  $columns
     */
    private function replaceColumns(WorkspaceTemplate $template, array $columns): void
    {
        $template->columns()->delete();

        foreach ($columns as $position => $column) {
            $template->columns()->create([...$column, 'position' => $position]);
        }
    }

    /**
     * @return array{
     *     id: string,
     *     name: string,
     *     category: string,
     *     columns: array<int, array{title: string, description: ?string, color: string}>
     * }
     */
    private function present(WorkspaceTemplate $template): array
    {
        return [
            'id' => $template->id,
            'name' => $template->name,
            'category' => $template->category->value,
            'columns' => $template->columns->map(fn (WorkspaceTemplateColumn $column) => [
                'title' => $column->title,
                'description' => $column->description,
                'color' => $column->color->value,
            ])->values()->all(),
        ];
    }
}
```

`routes/web.php` — import `use App\Http\Controllers\WorkspaceTemplatesController;` and add inside the `w/{workspace}` group, after the invitations routes:

```php
            Route::get('templates', [WorkspaceTemplatesController::class, 'index'])->name('workspaces.templates.index');
            Route::post('templates', [WorkspaceTemplatesController::class, 'store'])->name('workspaces.templates.store');
            Route::patch('templates/{template}', [WorkspaceTemplatesController::class, 'update'])->name('workspaces.templates.update')->whereUuid('template');
            Route::delete('templates/{template}', [WorkspaceTemplatesController::class, 'destroy'])->name('workspaces.templates.destroy')->whereUuid('template');
```

(`scopeBindings()` resolves `{template}` through `Workspace::templates()`, so another workspace's template is a 404.)

- [ ] **Step 6: Translations**

Add to `lang/{en,fr,es,de}.json`:

| key | fr | es | de |
|---|---|---|---|
| `A template with this name already exists.` | Un modèle porte déjà ce nom. | Ya existe una plantilla con este nombre. | Es gibt bereits eine Vorlage mit diesem Namen. |
| `This workspace already has 100 templates.` | Cet espace de travail a déjà 100 modèles. | Este espacio de trabajo ya tiene 100 plantillas. | Dieser Arbeitsbereich hat bereits 100 Vorlagen. |
| `Template saved.` | Modèle enregistré. | Plantilla guardada. | Vorlage gespeichert. |
| `Template deleted.` | Modèle supprimé. | Plantilla eliminada. | Vorlage gelöscht. |

- [ ] **Step 7: Frontend types, column chips, templates page and navigation**

`config/inertia.php` has `testing.ensure_pages_exist = true`, so the page must exist for Step 8.

Run `vendor/bin/sail artisan wayfinder:generate --with-form` first (new routes).

Append to `resources/js/types/workspaces.ts`:

```ts
import type { ColumnColor } from '@/lib/retro/types';

export type TemplateCategory =
    | 'essentials'
    | 'team_mood'
    | 'themed'
    | 'ideas'
    | 'analysis';

export type CategoryOption = { value: TemplateCategory; label: string };

export type TemplateColumn = {
    title: string;
    description: string | null;
    color: ColumnColor;
};

export type CatalogueTemplate = {
    key: string;
    name: string;
    category: TemplateCategory | null;
    isCommon: boolean;
    isWorkspace: boolean;
    columns: TemplateColumn[];
};

export type WorkspaceTemplateSummary = {
    id: string;
    name: string;
    category: TemplateCategory;
    columns: TemplateColumn[];
};
```

(Put the `import type` line at the top of the file.)

Create `resources/js/components/templates/template-chips.tsx`:

```tsx
import { columnSwatch } from '@/lib/retro/colors';
import { cn } from '@/lib/utils';
import type { TemplateColumn } from '@/types';

type Props = {
    columns: TemplateColumn[];
    withDescriptions?: boolean;
};

export function TemplateChips({ columns, withDescriptions = false }: Props) {
    if (withDescriptions) {
        return (
            <ul className="space-y-3">
                {columns.map((column, index) => (
                    <li key={index} className="flex gap-2">
                        <span
                            className={cn(
                                'mt-1.5 size-2.5 shrink-0 rounded-full',
                                columnSwatch[column.color],
                            )}
                        />
                        <div className="min-w-0">
                            <p className="text-sm font-medium break-words">
                                {column.title}
                            </p>
                            {column.description && (
                                <p className="text-xs text-muted-foreground">
                                    {column.description}
                                </p>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div className="flex flex-wrap gap-1">
            {columns.map((column, index) => (
                <span
                    key={index}
                    className="inline-flex max-w-48 items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                >
                    <span
                        className={cn(
                            'size-2 shrink-0 rounded-full',
                            columnSwatch[column.color],
                        )}
                    />
                    <span className="truncate">{column.title}</span>
                </span>
            ))}
        </div>
    );
}
```

Create `resources/js/pages/workspaces/templates.tsx`:

```tsx
import { Head, router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import WorkspaceTemplatesController from '@/actions/App/Http/Controllers/WorkspaceTemplatesController';
import ConfirmFormDialog from '@/components/confirm-form-dialog';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { TemplateChips } from '@/components/templates/template-chips';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useTrans } from '@/hooks/use-trans';
import { ColumnColors, columnColorLabel } from '@/lib/retro/colors';
import type { ColumnColor } from '@/lib/retro/types';
import type {
    CatalogueTemplate,
    CategoryOption,
    TemplateCategory,
    TemplateColumn,
    WorkspaceSummary,
    WorkspaceTemplateSummary,
} from '@/types';

const MaxColumns = 10;

type Props = {
    workspace: WorkspaceSummary;
    templates: WorkspaceTemplateSummary[];
    categories: CategoryOption[];
    canManage: boolean;
    catalogue?: CatalogueTemplate[];
};

type ColumnDraft = { title: string; description: string; color: ColumnColor };

type TemplateForm = {
    name: string;
    category: TemplateCategory;
    columns: ColumnDraft[];
};

function toDraft(column: TemplateColumn): ColumnDraft {
    return {
        title: column.title,
        description: column.description ?? '',
        color: column.color,
    };
}

export default function WorkspaceTemplates({
    workspace,
    templates,
    categories,
    canManage,
    catalogue,
}: Props) {
    const { t } = useTrans();
    const [editing, setEditing] = useState<{
        template: WorkspaceTemplateSummary | null;
    } | null>(null);
    const categoryLabel = (value: string) =>
        categories.find((category) => category.value === value)?.label ??
        value;

    return (
        <>
            <Head title={t('Templates')} />
            <div className="max-w-3xl space-y-6 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title={t('Templates')}
                        description={t(
                            'Templates shared by every team of this workspace',
                        )}
                    />
                    {canManage && (
                        <Button onClick={() => setEditing({ template: null })}>
                            <Plus />
                            {t('New template')}
                        </Button>
                    )}
                </div>

                {templates.length === 0 && (
                    <p className="text-muted-foreground">
                        {t('No workspace templates yet.')}
                    </p>
                )}

                {templates.length > 0 && (
                    <ul className="divide-y rounded-md border">
                        {templates.map((template) => (
                            <li key={template.id} className="space-y-2 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className="truncate font-medium">
                                            {template.name}
                                        </span>
                                        <Badge variant="secondary">
                                            {categoryLabel(template.category)}
                                        </Badge>
                                    </div>
                                    {canManage && (
                                        <div className="flex shrink-0 gap-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    setEditing({ template })
                                                }
                                            >
                                                {t('Edit')}
                                            </Button>
                                            <ConfirmFormDialog
                                                form={WorkspaceTemplatesController.destroy.form(
                                                    {
                                                        workspace:
                                                            workspace.slug,
                                                        template: template.id,
                                                    },
                                                )}
                                                title={t(
                                                    'Delete this template?',
                                                )}
                                                description={t(
                                                    'Retrospectives created from it keep their columns.',
                                                )}
                                                confirmLabel={t('Delete')}
                                                trigger={
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                    >
                                                        {t('Delete')}
                                                    </Button>
                                                }
                                            />
                                        </div>
                                    )}
                                </div>
                                <TemplateChips columns={template.columns} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {editing && (
                <TemplateEditor
                    key={editing.template?.id ?? 'new'}
                    workspace={workspace}
                    template={editing.template}
                    categories={categories}
                    catalogue={catalogue}
                    onClose={() => setEditing(null)}
                />
            )}
        </>
    );
}

type EditorProps = {
    workspace: WorkspaceSummary;
    template: WorkspaceTemplateSummary | null;
    categories: CategoryOption[];
    catalogue?: CatalogueTemplate[];
    onClose: () => void;
};

function TemplateEditor({
    workspace,
    template,
    categories,
    catalogue,
    onClose,
}: EditorProps) {
    const { t } = useTrans();
    const form = useForm<TemplateForm>({
        name: template?.name ?? '',
        category: template?.category ?? 'essentials',
        columns: template?.columns.map(toDraft) ?? [
            { title: '', description: '', color: 'green' },
        ],
    });
    const errors = form.errors as Record<string, string | undefined>;
    const builtIns = (catalogue ?? []).filter(
        (item) => !item.isWorkspace && item.columns.length > 0,
    );

    useEffect(() => {
        if (template === null && catalogue === undefined) {
            router.reload({ only: ['catalogue'] });
        }
    }, [template, catalogue]);

    const setColumn = (index: number, change: Partial<ColumnDraft>) =>
        form.setData(
            'columns',
            form.data.columns.map((column, position) =>
                position === index ? { ...column, ...change } : column,
            ),
        );

    const moveColumn = (index: number, offset: -1 | 1) => {
        const columns = [...form.data.columns];
        [columns[index], columns[index + offset]] = [
            columns[index + offset],
            columns[index],
        ];
        form.setData('columns', columns);
    };

    const removeColumn = (index: number) =>
        form.setData(
            'columns',
            form.data.columns.filter((_, position) => position !== index),
        );

    const addColumn = () =>
        form.setData('columns', [
            ...form.data.columns,
            {
                title: '',
                description: '',
                color: ColumnColors[
                    form.data.columns.length % ColumnColors.length
                ],
            },
        ]);

    const startFrom = (key: string) => {
        const source = builtIns.find((item) => item.key === key);

        if (!source) {
            return;
        }

        form.setData({
            name: form.data.name || source.name,
            category: source.category ?? 'essentials',
            columns: source.columns.map(toDraft),
        });
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const options = { preserveScroll: true, onSuccess: onClose };

        if (template) {
            form.submit(
                WorkspaceTemplatesController.update({
                    workspace: workspace.slug,
                    template: template.id,
                }),
                options,
            );

            return;
        }

        form.submit(WorkspaceTemplatesController.store(workspace.slug), options);
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                aria-describedby={undefined}
                className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
            >
                <form onSubmit={submit} className="space-y-4">
                    <DialogTitle>
                        {template ? t('Edit template') : t('New template')}
                    </DialogTitle>

                    {template === null && builtIns.length > 0 && (
                        <div className="grid gap-2">
                            <Label htmlFor="template-source">
                                {t('Start from a built-in template')}
                            </Label>
                            <Select onValueChange={startFrom}>
                                <SelectTrigger id="template-source">
                                    <SelectValue
                                        placeholder={t(
                                            'Start from a built-in template',
                                        )}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {builtIns.map((item) => (
                                        <SelectItem key={item.key} value={item.key}>
                                            {item.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="grid gap-2 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="template-name">{t('Name')}</Label>
                            <Input
                                id="template-name"
                                value={form.data.name}
                                maxLength={80}
                                required
                                onChange={(event) =>
                                    form.setData('name', event.target.value)
                                }
                            />
                            <InputError message={errors.name} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="template-category">
                                {t('Category')}
                            </Label>
                            <Select
                                value={form.data.category}
                                onValueChange={(value) =>
                                    form.setData(
                                        'category',
                                        value as TemplateCategory,
                                    )
                                }
                            >
                                <SelectTrigger id="template-category">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((category) => (
                                        <SelectItem
                                            key={category.value}
                                            value={category.value}
                                        >
                                            {category.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={errors.category} />
                        </div>
                    </div>

                    <fieldset className="space-y-3">
                        <legend className="text-sm font-medium">
                            {t('Columns')}
                        </legend>
                        {form.data.columns.map((column, index) => (
                            <div
                                key={index}
                                className="space-y-2 rounded-md border p-3"
                            >
                                <div className="flex items-start gap-2">
                                    <Input
                                        value={column.title}
                                        maxLength={100}
                                        required
                                        aria-label={t('Column title')}
                                        placeholder={t('Column title')}
                                        onChange={(event) =>
                                            setColumn(index, {
                                                title: event.target.value,
                                            })
                                        }
                                    />
                                    <Select
                                        value={column.color}
                                        onValueChange={(value) =>
                                            setColumn(index, {
                                                color: value as ColumnColor,
                                            })
                                        }
                                    >
                                        <SelectTrigger
                                            className="w-32"
                                            aria-label={t('Color')}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ColumnColors.map((color) => (
                                                <SelectItem key={color} value={color}>
                                                    {t(columnColorLabel[color])}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={t('Move up')}
                                        disabled={index === 0}
                                        onClick={() => moveColumn(index, -1)}
                                    >
                                        <ArrowUp />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={t('Move down')}
                                        disabled={
                                            index === form.data.columns.length - 1
                                        }
                                        onClick={() => moveColumn(index, 1)}
                                    >
                                        <ArrowDown />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={t('Remove column')}
                                        disabled={form.data.columns.length === 1}
                                        onClick={() => removeColumn(index)}
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                                <Textarea
                                    value={column.description}
                                    maxLength={200}
                                    rows={2}
                                    aria-label={t('Description')}
                                    placeholder={t('Description (optional)')}
                                    onChange={(event) =>
                                        setColumn(index, {
                                            description: event.target.value,
                                        })
                                    }
                                />
                                <InputError
                                    message={
                                        errors[`columns.${index}.title`] ??
                                        errors[`columns.${index}.description`] ??
                                        errors[`columns.${index}.color`]
                                    }
                                />
                            </div>
                        ))}
                        <InputError message={errors.columns} />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={form.data.columns.length >= MaxColumns}
                            onClick={addColumn}
                        >
                            <Plus />
                            {t('Add column')}
                        </Button>
                    </fieldset>

                    <DialogFooter className="gap-2">
                        <Button type="button" variant="secondary" onClick={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {t('Save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

`resources/js/components/app-sidebar.tsx` — import `LayoutTemplate` from `lucide-react` and `WorkspaceTemplatesController` from `@/actions/App/Http/Controllers/WorkspaceTemplatesController`; after the `mainNavItems` declaration, before the `Members` block, add:

```ts
    if (currentWorkspace) {
        mainNavItems.push({
            title: 'Templates',
            href: WorkspaceTemplatesController.index(currentWorkspace.slug),
            icon: LayoutTemplate,
        });
    }
```

Add to `lang/{en,fr,es,de}.json` (skip a key only if it already exists):

| key | fr | es | de |
|---|---|---|---|
| `Templates` | Modèles | Plantillas | Vorlagen |
| `Templates shared by every team of this workspace` | Modèles partagés par toutes les équipes de cet espace de travail | Plantillas compartidas por todos los equipos de este espacio de trabajo | Vorlagen für alle Teams dieses Arbeitsbereichs |
| `New template` | Nouveau modèle | Nueva plantilla | Neue Vorlage |
| `Edit template` | Modifier le modèle | Editar plantilla | Vorlage bearbeiten |
| `No workspace templates yet.` | Aucun modèle d'espace de travail pour l'instant. | Aún no hay plantillas del espacio de trabajo. | Noch keine Vorlagen im Arbeitsbereich. |
| `Edit` | Modifier | Editar | Bearbeiten |
| `Delete this template?` | Supprimer ce modèle ? | ¿Eliminar esta plantilla? | Diese Vorlage löschen? |
| `Retrospectives created from it keep their columns.` | Les rétrospectives créées à partir de ce modèle conservent leurs colonnes. | Las retrospectivas creadas con ella conservan sus columnas. | Retrospektiven, die daraus erstellt wurden, behalten ihre Spalten. |
| `Start from a built-in template` | Partir d'un modèle intégré | Partir de una plantilla incluida | Mit einer eingebauten Vorlage beginnen |
| `Category` | Catégorie | Categoría | Kategorie |
| `Columns` | Colonnes | Columnas | Spalten |
| `Description` | Description | Descripción | Beschreibung |
| `Description (optional)` | Description (facultative) | Descripción (opcional) | Beschreibung (optional) |
| `Move up` | Monter | Subir | Nach oben |
| `Move down` | Descendre | Bajar | Nach unten |
| `Remove column` | Retirer la colonne | Quitar columna | Spalte entfernen |

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Workspaces tests/Feature/UuidPrimaryKeysTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse, type-check, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
npx vp fmt resources/js/types/workspaces.ts resources/js/components/templates/template-chips.tsx resources/js/pages/workspaces/templates.tsx resources/js/components/app-sidebar.tsx
npm run types:check && npm run check
git add app database routes lang resources/js tests/Feature/Workspaces/WorkspaceTemplatesTest.php
git commit -m "feat: manage workspace templates with categories

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 8: Creating a retro from the catalogue (`NewRetro`, `CreateRetro`, team page props)

**Files:**
- Create: `app/Actions/Retros/NewRetro.php`
- Modify: `app/Actions/Retros/CreateRetro.php`, `app/Http/Controllers/TeamRetrosController.php`, `app/Http/Controllers/TeamsController.php`, `app/Models/Retro.php`, `app/Actions/Retros/BuildBoardSnapshot.php`, `database/factories/RetroFactory.php`, `database/seeders/DemoSeeder.php`, `lang/{en,fr,es,de}.json`
- Delete: `app/Enums/RetroTemplate.php`
- Test: `tests/Feature/Retros/CreateRetroTest.php`, `tests/Feature/Retros/RetroModelTest.php`

**Interfaces:**
- Consumes: `TemplateCatalogue`, `WorkspaceTemplate::idFromKey()`, `BuildTemplateCatalogue` (Task 7), `Retro::firstPhase()` (Task 1).
- Produces:
  - `App\Actions\Retros\NewRetro` — constructor-promoted public `string $title`, `string $template`, `bool $isAnonymous = false`, `bool $healthCheckEnabled = false`, `bool $icebreakerEnabled = false`, `?int $votesPerParticipant = null`. Plan 8e appends `bool $aiSummaryEnabled = false`.
  - `CreateRetro::handle(Team $team, User $creator, NewRetro $data): Retro` — starts in `firstPhase()`, copies catalogue columns (creator's locale, with descriptions) or workspace template columns, sets `template` (`key` or `workspace`) and `workspace_template_id`. Plan 8b calls `FreezeHealthStatements` in it when `healthCheckEnabled`.
  - `POST /w/{workspace}/teams/{team}/retros` accepts `title`, `template`, `is_anonymous`, `health_check_enabled`, `icebreaker_enabled`, `votes_per_participant` (null or 1–20); unknown template → 422 "Choose a template from the list.".
  - `teams/show` props: `templateCategories: [{value, label}]` and optional `catalogue` (shape of `BuildTemplateCatalogue`); the `templates` prop is removed.
  - `retros.template` is a plain string (enum cast removed); snapshot `retro.template` is that string.

- [ ] **Step 1: Write the failing tests**

Replace `tests/Feature/Retros/CreateRetroTest.php` with:

```php
<?php

use App\Actions\Retros\CreateRetro;
use App\Actions\Retros\NewRetro;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Support\RetroTemplates\TemplateCatalogue;
use Inertia\Testing\AssertableInertia as Assert;

function teamWithMember(WorkspaceRole $role = WorkspaceRole::Member, bool $inTeam = true): array
{
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, $role)->create();
    $team = Team::factory()->for($workspace)->create();

    if ($inTeam) {
        $team->members()->attach($user);
    }

    return [$user, $workspace, $team];
}

it('creates a retro with translated template columns and the creator as facilitator', function () {
    [$user, , $team] = teamWithMember();
    app()->setLocale('fr');

    $retro = app(CreateRetro::class)->handle($team, $user, new NewRetro('Sprint 42', 'start_stop_continue'));

    expect($retro->phase)->toBe(RetroPhase::Writing)
        ->and($retro->template)->toBe('start_stop_continue')
        ->and($retro->columns->pluck('title')->all())->toBe(['Commencer', 'Arrêter', 'Continuer'])
        ->and($retro->columns->pluck('description')->all())->toBe([
            'De nouvelles pratiques à essayer au prochain cycle',
            'Des habitudes qui gênent et doivent cesser maintenant',
            'Ce qui fonctionne déjà et doit survivre au prochain changement',
        ])
        ->and($retro->columns->pluck('position')->all())->toBe([0, 1, 2])
        ->and($retro->facilitator->user_id)->toBe($user->id)
        ->and($retro->votes_per_participant)->toBeNull()
        ->and($retro->guest_access_enabled)->toBeFalse()
        ->and(strlen($retro->guest_token))->toBe(40);
});

it('creates a custom retro without columns', function () {
    [$user, , $team] = teamWithMember();

    expect(app(CreateRetro::class)->handle($team, $user, new NewRetro('Free form', 'custom'))->columns)->toHaveCount(0);
});

it('creates a retro from every catalogue template', function () {
    [$user, , $team] = teamWithMember();
    app()->setLocale('de');

    foreach (TemplateCatalogue::all() as $definition) {
        $retro = app(CreateRetro::class)->handle($team, $user, new NewRetro($definition->key, $definition->key));

        expect($retro->columns->map->only(['title', 'description'])->all())
            ->toBe(array_map(fn (array $column) => ['title' => $column['title'], 'description' => $column['description']], $definition->translatedColumns()));
    }
});

it('starts in the first enabled phase with the chosen options', function () {
    [$user, , $team] = teamWithMember();

    $retro = app(CreateRetro::class)->handle($team, $user, new NewRetro(
        title: 'Sprint 43',
        template: 'mad_sad_glad',
        isAnonymous: true,
        icebreakerEnabled: true,
        votesPerParticipant: 4,
    ));

    expect($retro->phase)->toBe(RetroPhase::Icebreaker)
        ->and($retro->is_anonymous)->toBeTrue()
        ->and($retro->icebreaker_enabled)->toBeTrue()
        ->and($retro->health_check_enabled)->toBeFalse()
        ->and($retro->votes_per_participant)->toBe(4);

    $healthCheck = app(CreateRetro::class)->handle($team, $user, new NewRetro('Sprint 44', 'mad_sad_glad', healthCheckEnabled: true, icebreakerEnabled: true));

    expect($healthCheck->phase)->toBe(RetroPhase::HealthCheck);
});

it('copies the columns of a workspace template and remembers it', function () {
    [$user, $workspace, $team] = teamWithMember();
    $template = WorkspaceTemplate::factory()->for($workspace)->create();
    $template->columns()->create(['title' => 'Energy', 'description' => 'How charged you feel', 'color' => 'green', 'position' => 0]);
    $template->columns()->create(['title' => 'Blockers', 'description' => null, 'color' => 'red', 'position' => 1]);

    $retro = app(CreateRetro::class)->handle($team, $user, new NewRetro('Pulse', $template->catalogueKey()));

    expect($retro->template)->toBe(TemplateCatalogue::Workspace)
        ->and($retro->workspace_template_id)->toBe($template->id)
        ->and($retro->columns->map(fn ($column) => [$column->title, $column->description, $column->color->value])->all())->toBe([
            ['Energy', 'How charged you feel', 'green'],
            ['Blockers', null, 'red'],
        ]);

    $template->columns()->delete();
    $template->update(['name' => 'Renamed']);

    expect($retro->fresh()->columns)->toHaveCount(2);
});

it('lets team members create retros with options from the team page', function () {
    [$user, $workspace, $team] = teamWithMember();

    $response = $this->actingAs($user)->post(route('teams.retros.store', [$workspace, $team]), [
        'title' => 'Sprint 42',
        'template' => 'sailboat',
        'is_anonymous' => true,
        'icebreaker_enabled' => true,
        'votes_per_participant' => null,
    ]);

    $retro = $team->retros()->sole();
    $response->assertRedirect(route('retros.show', $retro));

    expect($retro->only(['template', 'is_anonymous', 'icebreaker_enabled', 'votes_per_participant']))->toBe([
        'template' => 'sailboat',
        'is_anonymous' => true,
        'icebreaker_enabled' => true,
        'votes_per_participant' => null,
    ])->and($retro->phase)->toBe(RetroPhase::Icebreaker);
});

it('lets workspace managers create retros in any team', function () {
    [$admin, $workspace, $team] = teamWithMember(WorkspaceRole::Admin, inTeam: false);

    $this->actingAs($admin)
        ->post(route('teams.retros.store', [$workspace, $team]), ['title' => 'X', 'template' => 'four_ls'])
        ->assertRedirect();
});

it('forbids members outside the team', function () {
    [$member, $workspace, $team] = teamWithMember(inTeam: false);

    $this->actingAs($member)
        ->post(route('teams.retros.store', [$workspace, $team]), ['title' => 'X', 'template' => 'four_ls'])
        ->assertForbidden();
});

it('validates the title, template and vote limit', function (array $payload, string $field) {
    [$user, $workspace, $team] = teamWithMember();

    $this->actingAs($user)
        ->post(route('teams.retros.store', [$workspace, $team]), $payload)
        ->assertSessionHasErrors($field);
})->with([
    [['title' => '', 'template' => 'four_ls'], 'title'],
    [['title' => str_repeat('a', 121), 'template' => 'four_ls'], 'title'],
    [['title' => 'X', 'template' => 'nope'], 'template'],
    [['title' => 'X', 'template' => 'four_ls', 'votes_per_participant' => 21], 'votes_per_participant'],
    [['title' => 'X', 'template' => 'four_ls', 'votes_per_participant' => 0], 'votes_per_participant'],
]);

it('refuses templates outside the catalogue and the workspace', function (Closure $template) {
    [$user, $workspace, $team] = teamWithMember();

    $this->actingAs($user)
        ->post(route('teams.retros.store', [$workspace, $team]), ['title' => 'X', 'template' => $template()])
        ->assertSessionHasErrors(['template' => 'Choose a template from the list.']);

    expect(Retro::count())->toBe(0);
})->with([
    'the workspace marker' => [fn () => 'workspace'],
    'a malformed id' => [fn () => 'workspace:not-a-uuid'],
    'an unknown id' => [fn () => 'workspace:'.fake()->uuid()],
    'another workspace' => [fn () => WorkspaceTemplate::factory()->withColumns()->create()->catalogueKey()],
]);

it('lists the team retros newest first and loads the catalogue on demand', function () {
    [$user, $workspace, $team] = teamWithMember();
    $older = app(CreateRetro::class)->handle($team, $user, new NewRetro('Older', 'four_ls'));
    $this->travel(1)->minutes();
    $newer = app(CreateRetro::class)->handle($team, $user, new NewRetro('Newer', 'four_ls'));
    $template = WorkspaceTemplate::factory()->withColumns()->for($workspace)->create();

    $this->actingAs($user)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('retros.0.id', $newer->id)
            ->where('retros.1.id', $older->id)
            ->where('retros.0.phase', 'writing')
            ->where('canCreateRetro', true)
            ->has('templateCategories', 5)
            ->missing('templates')
            ->missing('catalogue')
            ->reloadOnly('catalogue', fn (Assert $reload) => $reload
                ->has('catalogue', 54)
                ->where('catalogue.0.key', $template->catalogueKey())
                ->where('catalogue.1.name', 'Went well, To improve, Action ideas')
                ->where('catalogue.1.columns.0.description', 'What worked and is worth repeating on purpose next sprint')));
});
```

In `tests/Feature/Retros/RetroModelTest.php`, delete the test `it('defines template columns', …)` and its `use App\Enums\RetroTemplate;` import (the enum is removed; `TemplateCatalogueTest` covers the columns).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/CreateRetroTest.php`
Expected: FAIL — `Class "App\Actions\Retros\NewRetro" not found`.

- [ ] **Step 3: `NewRetro` and `CreateRetro`**

`app/Actions/Retros/NewRetro.php`:

```php
<?php

namespace App\Actions\Retros;

class NewRetro
{
    public function __construct(
        public string $title,
        public string $template,
        public bool $isAnonymous = false,
        public bool $healthCheckEnabled = false,
        public bool $icebreakerEnabled = false,
        public ?int $votesPerParticipant = null,
    ) {}
}
```

`app/Actions/Retros/CreateRetro.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Enums\ColumnColor;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;
use App\Support\RetroTemplates\TemplateCatalogue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class CreateRetro
{
    public function handle(Team $team, User $creator, NewRetro $data): Retro
    {
        return DB::transaction(function () use ($team, $creator, $data): Retro {
            $workspaceTemplate = $this->workspaceTemplate($team, $data->template);

            $retro = $team->retros()->make([
                'title' => $data->title,
                'template' => $workspaceTemplate === null ? $data->template : TemplateCatalogue::Workspace,
                'workspace_template_id' => $workspaceTemplate?->id,
                'is_anonymous' => $data->isAnonymous,
                'health_check_enabled' => $data->healthCheckEnabled,
                'icebreaker_enabled' => $data->icebreakerEnabled,
                'votes_per_participant' => $data->votesPerParticipant,
                'guest_token' => Str::random(40),
            ]);

            $retro->phase = $retro->firstPhase();
            $retro->save();

            foreach ($this->columns($data->template, $workspaceTemplate) as $position => $column) {
                $retro->columns()->create([...$column, 'position' => $position]);
            }

            $facilitator = $retro->participants()->create(['user_id' => $creator->id]);

            $retro->update(['facilitator_participant_id' => $facilitator->id]);

            return $retro->fresh(['columns', 'facilitator']);
        });
    }

    private function workspaceTemplate(Team $team, string $template): ?WorkspaceTemplate
    {
        $id = WorkspaceTemplate::idFromKey($template);

        if ($id === null) {
            return null;
        }

        return $team->workspace->templates()->with('columns')->findOrFail($id);
    }

    /**
     * @return array<int, array{
     *     title: string,
     *     description: ?string,
     *     color: ColumnColor
     * }>
     */
    private function columns(string $template, ?WorkspaceTemplate $workspaceTemplate): array
    {
        if ($workspaceTemplate !== null) {
            return $workspaceTemplate->columns->map(fn (WorkspaceTemplateColumn $column) => [
                'title' => $column->title,
                'description' => $column->description,
                'color' => $column->color,
            ])->values()->all();
        }

        $definition = TemplateCatalogue::find($template);

        if ($definition === null) {
            throw new InvalidArgumentException("Unknown retro template [{$template}].");
        }

        return $definition->translatedColumns();
    }
}
```

- [ ] **Step 4: Controllers**

`app/Http/Controllers/TeamRetrosController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Retros\CreateRetro;
use App\Actions\Retros\NewRetro;
use App\Models\Team;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Support\RetroTemplates\TemplateCatalogue;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TeamRetrosController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, CreateRetro $createRetro): RedirectResponse
    {
        Gate::authorize('createRetro', $team);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'template' => ['required', 'string', $this->availableTemplate($workspace)],
            'is_anonymous' => ['sometimes', 'boolean'],
            'health_check_enabled' => ['sometimes', 'boolean'],
            'icebreaker_enabled' => ['sometimes', 'boolean'],
            'votes_per_participant' => ['nullable', 'integer', 'min:1', 'max:20'],
        ]);

        $retro = $createRetro->handle($team, $request->user(), new NewRetro(
            title: $validated['title'],
            template: $validated['template'],
            isAnonymous: (bool) ($validated['is_anonymous'] ?? false),
            healthCheckEnabled: (bool) ($validated['health_check_enabled'] ?? false),
            icebreakerEnabled: (bool) ($validated['icebreaker_enabled'] ?? false),
            votesPerParticipant: isset($validated['votes_per_participant']) ? (int) $validated['votes_per_participant'] : null,
        ));

        return to_route('retros.show', $retro);
    }

    private function availableTemplate(Workspace $workspace): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($workspace): void {
            if ($this->isAvailable($workspace, $value)) {
                return;
            }

            $fail(__('Choose a template from the list.'));
        };
    }

    private function isAvailable(Workspace $workspace, mixed $template): bool
    {
        if (! is_string($template)) {
            return false;
        }

        $workspaceTemplateId = WorkspaceTemplate::idFromKey($template);

        if ($workspaceTemplateId !== null) {
            return $workspace->templates()->whereKey($workspaceTemplateId)->exists();
        }

        return TemplateCatalogue::has($template);
    }
}
```

`app/Http/Controllers/TeamsController.php`:
- replace `use App\Enums\RetroTemplate;` with `use App\Actions\Retros\BuildTemplateCatalogue;` and `use App\Enums\TemplateCategory;`;
- `show()` signature becomes `public function show(Request $request, Workspace $workspace, Team $team, BuildTemplateCatalogue $buildTemplateCatalogue): Response`;
- replace `'templates' => RetroTemplate::options(),` with:

```php
            'templateCategories' => TemplateCategory::options(),
            'catalogue' => Inertia::optional(fn () => $buildTemplateCatalogue->handle($workspace)),
```

- [ ] **Step 5: Remove the enum and its uses**

- Delete `app/Enums/RetroTemplate.php`.
- `app/Models/Retro.php`: remove `use App\Enums\RetroTemplate;`, change the docblock to `@property string $template`, remove `'template' => RetroTemplate::class,` from `casts()`.
- `app/Actions/Retros/BuildBoardSnapshot.php`: `'template' => $retro->template,`.
- `database/factories/RetroFactory.php`: remove the import, `'template' => 'start_stop_continue',`.
- `database/seeders/DemoSeeder.php`: replace `use App\Enums\RetroTemplate;` with `use App\Actions\Retros\NewRetro;` and the call with `$createRetro->handle($team, $fran, new NewRetro('Demo Retrospective', 'start_stop_continue'));`.
- `lang/{en,fr,es,de}.json`: remove the keys `Custom`, `Start, Stop, Continue`, `Mad, Sad, Glad`, `Liked, Learned, Lacked, Longed for`, `Went well, To improve, Action ideas` and the thirteen `Retro column: …` keys (now in `templates.php`); add:

| key | fr | es | de |
|---|---|---|---|
| `Choose a template from the list.` | Choisissez un modèle dans la liste. | Elige una plantilla de la lista. | Wähle eine Vorlage aus der Liste. |

Run `grep -rn "RetroTemplate\|Retro column:" app database resources/js tests` — expected: no output.

(The team page still renders its old inline form, now without template options, until Task 9 replaces it with the creation dialog; run Task 9 right after this one.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros tests/Feature/DemoSeederTest.php tests/Feature/TranslationKeysTest.php tests/Feature/Teams`
Expected: PASS.

- [ ] **Step 7: Format, analyse, Wayfinder, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
vendor/bin/sail artisan wayfinder:generate --with-form
git add -A app database lang resources/js/actions resources/js/routes tests
git commit -m "feat: create retros from the catalogue or a workspace template with options

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 9: "New retrospective" dialog on the team page

**Files:**
- Create: `resources/js/components/teams/new-retro-dialog.tsx`
- Modify: `resources/js/pages/teams/show.tsx`, `resources/js/types/workspaces.ts`, `lang/{en,fr,es,de}.json`
- Test: `tests/Feature/TranslationKeysTest.php` (existing), type-check and lint

**Interfaces:**
- Consumes: `teams/show` props `templateCategories`, optional `catalogue` (Task 8); `TemplateChips`, `CatalogueTemplate`, `CategoryOption`, `TemplateCategory` (Task 7); `TeamRetrosController.store` (Wayfinder).
- Produces: `NewRetroDialog` (`workspaceSlug`, `teamId`, `categories`, `catalogue?`) posting `{title, template, is_anonymous, icebreaker_enabled, votes_per_participant}`. Its form type `RetroForm` and the Settings section are where plan 8b adds `health_check_enabled` and plan 8e adds `ai_summary_enabled` with the privacy notice.

- [ ] **Step 1: Types**

In `resources/js/types/workspaces.ts`, delete the `TemplateOption` type.

- [ ] **Step 2: The dialog**

Create `resources/js/components/teams/new-retro-dialog.tsx`:

```tsx
import { router, useForm, usePage } from '@inertiajs/react';
import { ChevronDown, Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import TeamRetrosController from '@/actions/App/Http/Controllers/TeamRetrosController';
import InputError from '@/components/input-error';
import { TemplateChips } from '@/components/templates/template-chips';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import type {
    CatalogueTemplate,
    CategoryOption,
    TemplateCategory,
} from '@/types';

const DefaultFixedVotes = 5;

type Props = {
    workspaceSlug: string;
    teamId: string;
    categories: CategoryOption[];
    catalogue?: CatalogueTemplate[];
};

type RetroForm = {
    title: string;
    template: string;
    is_anonymous: boolean;
    icebreaker_enabled: boolean;
    votes_per_participant: number | null;
};

export function NewRetroDialog(props: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>{t('New retrospective')}</Button>
            </DialogTrigger>
            <DialogContent
                aria-describedby={undefined}
                className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"
            >
                {open && (
                    <NewRetroForm {...props} onDone={() => setOpen(false)} />
                )}
            </DialogContent>
        </Dialog>
    );
}

function matchesQuery(template: CatalogueTemplate, query: string): boolean {
    const needle = query.trim().toLocaleLowerCase();

    if (needle === '') {
        return true;
    }

    return [template.name, ...template.columns.map((column) => column.title)]
        .some((text) => text.toLocaleLowerCase().includes(needle));
}

function NewRetroForm({
    workspaceSlug,
    teamId,
    categories,
    catalogue,
    onDone,
}: Props & { onDone: () => void }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
    const form = useForm<RetroForm>({
        title: t('Retro :date', {
            date: new Date().toLocaleDateString(locale, { dateStyle: 'medium' }),
        }),
        template: '',
        is_anonymous: false,
        icebreaker_enabled: false,
        votes_per_participant: null,
    });

    useEffect(() => {
        if (catalogue === undefined) {
            router.reload({ only: ['catalogue'] });
        }
    }, [catalogue]);

    const selected =
        catalogue?.find((item) => item.key === form.data.template) ??
        catalogue?.find((item) => !item.isWorkspace) ??
        null;
    const visible = (catalogue ?? []).filter(
        (item) =>
            matchesQuery(item, query) &&
            (category === 'all' || item.category === category),
    );
    const sections = [
        {
            key: 'workspace',
            title: t('Workspace templates'),
            items: visible.filter((item) => item.isWorkspace),
        },
        {
            key: 'common',
            title: t('Common templates'),
            items: visible.filter((item) => item.isCommon),
        },
        {
            key: 'more',
            title: t('More templates'),
            items: visible.filter((item) => !item.isWorkspace && !item.isCommon),
        },
    ].filter((section) => section.items.length > 0);
    const categoryLabel = (value: string) =>
        categories.find((option) => option.value === value)?.label ?? value;
    const votesAuto = form.data.votes_per_participant === null;

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!selected) {
            return;
        }

        form.transform((data) => ({ ...data, template: selected.key }));
        form.submit(
            TeamRetrosController.store({ workspace: workspaceSlug, team: teamId }),
            { onSuccess: onDone },
        );
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <DialogTitle>{t('New retrospective')}</DialogTitle>

            <div className="grid gap-2">
                <Label htmlFor="new-retro-title">{t('Title')}</Label>
                <Input
                    id="new-retro-title"
                    value={form.data.title}
                    maxLength={120}
                    required
                    onChange={(event) => form.setData('title', event.target.value)}
                />
                <InputError message={form.errors.title} />
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            value={query}
                            className="pl-8"
                            placeholder={t('Search templates')}
                            aria-label={t('Search templates')}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </div>
                    <div
                        className="flex flex-wrap gap-1"
                        role="group"
                        aria-label={t('Category')}
                    >
                        {[{ value: 'all' as const, label: t('All') }, ...categories].map(
                            (option) => (
                                <Button
                                    key={option.value}
                                    type="button"
                                    size="sm"
                                    variant={
                                        category === option.value
                                            ? 'secondary'
                                            : 'ghost'
                                    }
                                    aria-pressed={category === option.value}
                                    onClick={() => setCategory(option.value)}
                                >
                                    {option.label}
                                </Button>
                            ),
                        )}
                    </div>
                    <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
                        {catalogue === undefined &&
                            [0, 1, 2, 3].map((row) => (
                                <Skeleton key={row} className="h-14 w-full" />
                            ))}
                        {catalogue !== undefined && sections.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                {t('No templates match your search.')}
                            </p>
                        )}
                        {sections.map((section) => (
                            <div key={section.key} className="space-y-1">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase">
                                    {section.title}
                                </h3>
                                <ul className="space-y-1">
                                    {section.items.map((item) => (
                                        <li key={item.key}>
                                            <button
                                                type="button"
                                                aria-pressed={
                                                    selected?.key === item.key
                                                }
                                                className={cn(
                                                    'w-full rounded-md border p-2 text-left hover:bg-muted',
                                                    selected?.key === item.key &&
                                                        'border-primary bg-muted',
                                                )}
                                                onClick={() =>
                                                    form.setData('template', item.key)
                                                }
                                            >
                                                <span className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-medium">
                                                        {item.name}
                                                    </span>
                                                    {item.category && (
                                                        <span className="shrink-0 text-xs text-muted-foreground">
                                                            {categoryLabel(item.category)}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {item.columns.length === 0
                                                        ? t('Empty board')
                                                        : item.columns
                                                              .map((column) => column.title)
                                                              .join(' · ')}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                    <InputError message={form.errors.template} />
                </div>

                <div className="space-y-3 rounded-md border p-3">
                    <h3 className="text-sm font-semibold">{t('Preview')}</h3>
                    {selected === null && <Skeleton className="h-32 w-full" />}
                    {selected !== null && (
                        <>
                            <p className="font-medium">{selected.name}</p>
                            {selected.columns.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {t(
                                        'Start with an empty board and add your own columns.',
                                    )}
                                </p>
                            ) : (
                                <TemplateChips
                                    columns={selected.columns}
                                    withDescriptions
                                />
                            )}
                        </>
                    )}
                </div>
            </div>

            <Collapsible className="rounded-md border">
                <CollapsibleTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-between"
                    >
                        {t('Settings')}
                        <ChevronDown className="size-4" />
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 px-3 pb-3">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="new-retro-anonymous"
                            checked={form.data.is_anonymous}
                            onCheckedChange={(checked) =>
                                form.setData('is_anonymous', checked === true)
                            }
                        />
                        <Label htmlFor="new-retro-anonymous">
                            {t('Anonymous cards')}
                        </Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="new-retro-icebreaker"
                            checked={form.data.icebreaker_enabled}
                            onCheckedChange={(checked) =>
                                form.setData('icebreaker_enabled', checked === true)
                            }
                        />
                        <Label htmlFor="new-retro-icebreaker">
                            {t('Icebreaker')}
                        </Label>
                    </div>
                    <div className="grid gap-2">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="new-retro-votes-auto"
                                checked={votesAuto}
                                onCheckedChange={(checked) =>
                                    form.setData(
                                        'votes_per_participant',
                                        checked === true ? null : DefaultFixedVotes,
                                    )
                                }
                            />
                            <Label htmlFor="new-retro-votes-auto">
                                {t('Automatic vote limit')}
                            </Label>
                        </div>
                        {votesAuto ? (
                            <p className="text-xs text-muted-foreground">
                                {t('Automatic: number of cards plus 3, at most 10.')}
                            </p>
                        ) : (
                            <Input
                                type="number"
                                min={1}
                                max={20}
                                className="w-24"
                                aria-label={t('Votes per participant')}
                                value={form.data.votes_per_participant ?? ''}
                                onChange={(event) =>
                                    form.setData(
                                        'votes_per_participant',
                                        Number(event.target.value),
                                    )
                                }
                            />
                        )}
                        <InputError message={form.errors.votes_per_participant} />
                    </div>
                </CollapsibleContent>
            </Collapsible>

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button type="submit" disabled={form.processing || selected === null}>
                    {t('Start')}
                </Button>
            </DialogFooter>
        </form>
    );
}
```

- [ ] **Step 3: Use it on the team page**

In `resources/js/pages/teams/show.tsx`:
- imports: remove `TeamRetrosController`, `TemplateOption`; add `import { NewRetroDialog } from '@/components/teams/new-retro-dialog';` and the types `CatalogueTemplate`, `CategoryOption`;
- `Props`: replace `templates: TemplateOption[];` with `templateCategories: CategoryOption[];` and `catalogue?: CatalogueTemplate[];`; destructure `templateCategories` and `catalogue` instead of `templates`;
- replace the whole `{canCreateRetro && ( <Form {...TeamRetrosController.store.form(params)} …> … </Form> )}` block with:

```tsx
                    {canCreateRetro && (
                        <NewRetroDialog
                            workspaceSlug={workspace.slug}
                            teamId={team.id}
                            categories={templateCategories}
                            catalogue={catalogue}
                        />
                    )}
```

Keep the `Select` imports (the member picker still uses them).

- [ ] **Step 4: Translations**

Add to `lang/{en,fr,es,de}.json`:

| key | fr | es | de |
|---|---|---|---|
| `New retrospective` | Nouvelle rétrospective | Nueva retrospectiva | Neue Retrospektive |
| `Retro :date` | Rétro :date | Retro :date | Retro :date |
| `Search templates` | Rechercher un modèle | Buscar plantillas | Vorlagen suchen |
| `All` | Tous | Todas | Alle |
| `Workspace templates` | Modèles de l'espace de travail | Plantillas del espacio de trabajo | Vorlagen des Arbeitsbereichs |
| `Common templates` | Modèles courants | Plantillas habituales | Häufige Vorlagen |
| `More templates` | Autres modèles | Más plantillas | Weitere Vorlagen |
| `No templates match your search.` | Aucun modèle ne correspond à votre recherche. | Ninguna plantilla coincide con tu búsqueda. | Keine Vorlage passt zu deiner Suche. |
| `Empty board` | Tableau vide | Tablero vacío | Leeres Board |
| `Preview` | Aperçu | Vista previa | Vorschau |
| `Start with an empty board and add your own columns.` | Commencez avec un tableau vide et ajoutez vos propres colonnes. | Empieza con un tablero vacío y añade tus propias columnas. | Beginne mit einem leeren Board und füge eigene Spalten hinzu. |
| `Automatic vote limit` | Nombre de votes automatique | Límite de votos automático | Automatisches Stimmenlimit |
| `Automatic: number of cards plus 3, at most 10.` | Automatique : nombre de cartes plus 3, 10 au maximum. | Automático: número de tarjetas más 3, como máximo 10. | Automatisch: Anzahl der Karten plus 3, höchstens 10. |
| `Start` | Commencer | Empezar | Starten |

- [ ] **Step 5: Check**

```bash
npx vp fmt resources/js/components/teams/new-retro-dialog.tsx resources/js/pages/teams/show.tsx resources/js/types/workspaces.ts
npm run types:check && npm run check
vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php tests/Feature/Retros/CreateRetroTest.php
```
Expected: no type or lint errors (besides the known pre-existing ones), tests PASS.

- [ ] **Step 6: Commit**

```bash
git add resources/js lang
git commit -m "feat: pick a template with search, categories and preview in a creation dialog

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 10: Board UI — enabled phases, Warm-up panel, phase toggles, automatic votes, column descriptions

**Files:**
- Create: `resources/js/components/retro/phase-panel.tsx`, `resources/js/components/retro/icebreaker-panel.tsx`
- Modify: `resources/js/lib/retro/types.ts`, `resources/js/components/retro/{phase-stepper,board,settings-dialog,column-header,add-column}.tsx`, `lang/{en,fr,es,de}.json`
- Test: `tests/Feature/TranslationKeysTest.php`, type-check and lint

**Interfaces:**
- Consumes: snapshot `retro.phases`, `retro.healthCheckEnabled`, `retro.icebreakerEnabled`, `retro.votesAuto`, column `description` (Tasks 2–4); `PATCH settings` keys `icebreaker_enabled`, `votes_per_participant: null` (Tasks 2–3).
- Produces:
  - `RetroPhase` TS type with `'health_check' | 'icebreaker'`; `BoardColumn.description: string | null`; `Snapshot.retro.phases: RetroPhase[]`, `healthCheckEnabled`, `icebreakerEnabled`, `votesAuto`. The `Phases` constant is removed.
  - `PhaseLabels` (in `phase-stepper.tsx`) covers every phase.
  - `PhasePanel` — rendered above the columns; `switch` on the phase with a `case 'icebreaker'` branch. Plan 8b adds `case 'health_check': return <HealthCheckPanel />;`; spec 7 replaces the icebreaker branch with its game panel.
  - `ColumnEditPhases: RetroPhase[]` exported from `column-header.tsx` (`health_check`, `icebreaker`, `writing`).
  - Settings dialog: "Icebreaker" switch and "Automatic vote limit"; plan 8b adds the "Health check" switch next to "Icebreaker".

- [ ] **Step 1: Types**

In `resources/js/lib/retro/types.ts`:

```ts
export type RetroPhase =
    | 'health_check'
    | 'icebreaker'
    | 'writing'
    | 'grouping'
    | 'voting'
    | 'discussing'
    | 'completed';
```

`BoardColumn` gains `description: string | null;` (after `title`). In `Snapshot['retro']`, after `phase: RetroPhase;` add:

```ts
        phases: RetroPhase[];
        healthCheckEnabled: boolean;
        icebreakerEnabled: boolean;
        votesAuto: boolean;
```

Delete the `export const Phases: RetroPhase[] = [...]` block at the end of the file.

- [ ] **Step 2: Stepper over the enabled phases**

In `resources/js/components/retro/phase-stepper.tsx`:
- import `type RetroPhase` only: `import type { RetroPhase } from '@/lib/retro/types';`;
- `PhaseLabels`:

```ts
export const PhaseLabels: Record<RetroPhase, string> = {
    health_check: 'Health check',
    icebreaker: 'Icebreaker',
    writing: 'Writing',
    grouping: 'Grouping',
    voting: 'Voting',
    discussing: 'Discussing',
    completed: 'Completed',
};
```

- inside `PhaseStepper`, replace

```ts
    const current = Phases.indexOf(phase);
    const previous = Phases[current - 1];
    const next = Phases[current + 1];
```

with

```ts
    const phases = ctx.board.retro.phases;
    const current = phases.indexOf(phase);
    const previous = phases[current - 1];
    const next = phases[current + 1];
```

(move the three lines below `const ctx = useBoard();`), and render `{phases.map((step, index) => (` instead of `{Phases.map((step, index) => (`.

- [ ] **Step 3: Warm-up panel and phase panel**

Create `resources/js/components/retro/icebreaker-panel.tsx`:

```tsx
import { Sparkles } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import { useBoard } from './board-context';

export function warmUpQuestions(t: (key: string) => string): string[] {
    return [
        t('What was the highlight of your week?'),
        t('What is one small thing that made you smile recently?'),
        t('If this sprint were a movie, what would its title be?'),
        t('What is a skill you would like to learn this year?'),
        t('Which song describes your mood today?'),
        t('What is the best piece of advice you have received at work?'),
        t('If you could have any superpower for one day, which would you choose?'),
        t('What is something you are looking forward to?'),
        t('Describe the last sprint in three words.'),
        t('What is your favourite way to recharge after a busy week?'),
        t('Which tool or habit saved you the most time recently?'),
        t('If our team were a band, what kind of music would we play?'),
    ];
}

export function warmUpIndex(retroId: string, count: number): number {
    let hash = 0;

    for (const character of retroId) {
        hash = (hash * 31 + character.charCodeAt(0)) % 1_000_003;
    }

    return hash % count;
}

export function IcebreakerPanel() {
    const { t } = useTrans();
    const { board } = useBoard();
    const questions = warmUpQuestions(t);
    const question = questions[warmUpIndex(board.retro.id, questions.length)];

    return (
        <section aria-labelledby="warm-up-title" className="border-b p-4">
            <div className="mx-auto max-w-xl space-y-2 rounded-lg border bg-muted/30 p-6 text-center">
                <p
                    id="warm-up-title"
                    className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground"
                >
                    <Sparkles className="size-4" />
                    {t('Warm-up')}
                </p>
                <p className="text-xl font-semibold text-balance">{question}</p>
                <p className="text-sm text-muted-foreground">
                    {t('Take turns answering before the retrospective starts.')}
                </p>
            </div>
        </section>
    );
}
```

Create `resources/js/components/retro/phase-panel.tsx`:

```tsx
import { useBoard } from './board-context';
import { IcebreakerPanel } from './icebreaker-panel';

export function PhasePanel() {
    const { board } = useBoard();

    switch (board.retro.phase) {
        case 'icebreaker':
            return <IcebreakerPanel />;
        default:
            return null;
    }
}
```

In `resources/js/components/retro/board.tsx`:
- import `{ PhasePanel } from './phase-panel'` and `{ ColumnEditPhases } from './column-header'`;
- directly inside `<div className="flex flex-1 flex-col lg:min-h-0">`, before `{board.retro.phase === 'completed' && (`, add `<PhasePanel />`;
- replace the `AddColumn` condition `board.retro.phase === 'writing' && (` with `ColumnEditPhases.includes(board.retro.phase) && (`.

In `resources/js/components/retro/add-column.tsx`, change the title input `maxLength={60}` to `maxLength={100}`.

- [ ] **Step 4: Column header with description**

In `resources/js/components/retro/column-header.tsx`:
- add imports: `import { Textarea } from '@/components/ui/textarea';`, `import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';`, and `type RetroPhase` in the existing `@/lib/retro/types` import;
- above the component:

```ts
export const ColumnEditPhases: RetroPhase[] = [
    'health_check',
    'icebreaker',
    'writing',
];
```

- `canEdit` becomes:

```ts
    const canEdit =
        ctx.board.viewer.isFacilitator &&
        ColumnEditPhases.includes(ctx.board.retro.phase);
```

- new state after `confirmingDelete`:

```ts
    const [editingDescription, setEditingDescription] = useState(false);
    const [descriptionDraft, setDescriptionDraft] = useState(
        column.description ?? '',
    );
```

- `update`'s parameter type becomes `data: { title?: string; color?: ColumnColor; description?: string | null }`;
- add:

```ts
    const startDescriptionEdit = () => {
        setDescriptionDraft(column.description ?? '');
        setEditingDescription(true);
    };

    const saveDescription = async () => {
        const trimmed = descriptionDraft.trim();
        const response = await update({
            description: trimmed === '' ? null : trimmed,
        });

        if (response) {
            setEditingDescription(false);
        }
    };
```

- change `<header className="mb-3 flex items-center justify-between gap-2">` to `<header className="mb-3 flex items-start justify-between gap-2">` and wrap the title part:

```tsx
            <div className="min-w-0 flex-1">
                {editing ? (
                    <Input
                        autoFocus
                        value={draft}
                        maxLength={100}
                        aria-label={t('Column title')}
                        className="h-8"
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={() => finishRename(true)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                finishRename(true);
                            }

                            if (event.key === 'Escape') {
                                finishRename(false);
                            }
                        }}
                    />
                ) : (
                    <h2 className="truncate font-medium">{column.title}</h2>
                )}
                {column.description && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <p
                                tabIndex={0}
                                className="line-clamp-2 text-xs text-muted-foreground"
                            >
                                {column.description}
                            </p>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-64">
                            {column.description}
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
```

- in the dropdown, right after the `Rename` item:

```tsx
                            <DropdownMenuItem
                                disabled={busy}
                                onSelect={startDescriptionEdit}
                            >
                                {t('Edit description')}
                            </DropdownMenuItem>
```

- after the delete `Dialog` (inside the `canEdit &&` fragment area, as a sibling `{canEdit && ( … )}` block):

```tsx
            {canEdit && (
                <Dialog
                    open={editingDescription && !ctx.sessionExpired}
                    onOpenChange={setEditingDescription}
                >
                    <DialogContent>
                        <DialogTitle>{t('Column description')}</DialogTitle>
                        <DialogDescription>
                            {t(
                                'Shown under the column title to guide what people write.',
                            )}
                        </DialogDescription>
                        <Textarea
                            value={descriptionDraft}
                            maxLength={200}
                            rows={3}
                            aria-label={t('Column description')}
                            onChange={(event) =>
                                setDescriptionDraft(event.target.value)
                            }
                        />
                        <DialogFooter className="gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setEditingDescription(false)}
                            >
                                {t('Cancel')}
                            </Button>
                            <Button
                                disabled={busy}
                                onClick={() => void saveDescription()}
                            >
                                {t('Save')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
```

- change the note `'Only empty columns can be edited or deleted.'` to `'Only empty columns can be renamed, recoloured or deleted.'` (the description stays editable).

- [ ] **Step 5: Settings dialog**

In `resources/js/components/retro/settings-dialog.tsx`, in `SettingsForm`:
- replace `const [votes, setVotes] = useState(String(retro.votesPerParticipant));` with:

```ts
    const [votesAuto, setVotesAuto] = useState(retro.votesAuto);
    const [votes, setVotes] = useState(String(retro.votesPerParticipant));
    const [icebreakerEnabled, setIcebreakerEnabled] = useState(
        retro.icebreakerEnabled,
    );
```

- `votesLocked` becomes:

```ts
    const votesLocked = !['health_check', 'icebreaker', 'writing', 'grouping'].includes(
        retro.phase,
    );
```

- replace the `votes_per_participant` change detection with:

```ts
        const votesChanged =
            votesAuto !== retro.votesAuto ||
            (!votesAuto && Number(votes) !== retro.votesPerParticipant);

        if (votesChanged) {
            changes.votes_per_participant = votesAuto ? null : Number(votes);
        }

        if (icebreakerEnabled !== retro.icebreakerEnabled) {
            changes.icebreaker_enabled = icebreakerEnabled;
        }
```

- replace the votes `<div className="grid gap-2"> … retro-votes … </div>` block with:

```tsx
            <div className="grid gap-2">
                <Label htmlFor="retro-votes">
                    {t('Votes per participant')}
                </Label>
                <SettingCheckbox
                    id="retro-votes-auto"
                    label={t('Automatic vote limit')}
                    checked={votesAuto}
                    disabled={votesLocked}
                    onChange={setVotesAuto}
                />
                {votesAuto ? (
                    <p className="text-xs text-muted-foreground">
                        {t('Automatic: number of cards plus 3, at most 10.')}
                    </p>
                ) : (
                    <Input
                        id="retro-votes"
                        type="number"
                        min={1}
                        max={20}
                        value={votes}
                        disabled={votesLocked}
                        onChange={(event) => setVotes(event.target.value)}
                    />
                )}
            </div>

            <div className="grid gap-2">
                <SettingCheckbox
                    id="retro-icebreaker"
                    label={t('Icebreaker')}
                    checked={icebreakerEnabled}
                    disabled={engagementLocked}
                    onChange={setIcebreakerEnabled}
                />
            </div>
```

- [ ] **Step 6: Translations**

Add to `lang/{en,fr,es,de}.json`:

| key | fr | es | de |
|---|---|---|---|
| `Warm-up` | Échauffement | Calentamiento | Aufwärmen |
| `Take turns answering before the retrospective starts.` | Répondez chacun votre tour avant de commencer la rétrospective. | Responded por turnos antes de empezar la retrospectiva. | Antwortet reihum, bevor die Retrospektive beginnt. |
| `What was the highlight of your week?` | Quel a été le meilleur moment de votre semaine ? | ¿Cuál fue el mejor momento de tu semana? | Was war das Highlight deiner Woche? |
| `What is one small thing that made you smile recently?` | Quelle petite chose vous a fait sourire récemment ? | ¿Qué pequeña cosa te hizo sonreír hace poco? | Welche Kleinigkeit hat dich neulich zum Lächeln gebracht? |
| `If this sprint were a movie, what would its title be?` | Si ce sprint était un film, quel en serait le titre ? | Si este sprint fuera una película, ¿cómo se titularía? | Wenn dieser Sprint ein Film wäre, wie hieße er? |
| `What is a skill you would like to learn this year?` | Quelle compétence aimeriez-vous acquérir cette année ? | ¿Qué habilidad te gustaría aprender este año? | Welche Fähigkeit möchtest du dieses Jahr lernen? |
| `Which song describes your mood today?` | Quelle chanson décrit votre humeur aujourd'hui ? | ¿Qué canción describe tu estado de ánimo hoy? | Welcher Song beschreibt deine Stimmung heute? |
| `What is the best piece of advice you have received at work?` | Quel est le meilleur conseil que vous ayez reçu au travail ? | ¿Cuál es el mejor consejo que te han dado en el trabajo? | Was ist der beste Rat, den du bei der Arbeit bekommen hast? |
| `If you could have any superpower for one day, which would you choose?` | Si vous pouviez avoir un super-pouvoir pendant une journée, lequel choisiriez-vous ? | Si pudieras tener un superpoder durante un día, ¿cuál elegirías? | Wenn du einen Tag lang eine Superkraft hättest, welche wäre es? |
| `What is something you are looking forward to?` | Qu'est-ce que vous attendez avec impatience ? | ¿Qué es algo que esperas con ilusión? | Worauf freust du dich gerade? |
| `Describe the last sprint in three words.` | Décrivez le dernier sprint en trois mots. | Describe el último sprint en tres palabras. | Beschreibe den letzten Sprint in drei Wörtern. |
| `What is your favourite way to recharge after a busy week?` | Quelle est votre façon préférée de recharger vos batteries après une semaine chargée ? | ¿Cuál es tu forma favorita de recargar pilas tras una semana intensa? | Wie tankst du nach einer vollen Woche am liebsten auf? |
| `Which tool or habit saved you the most time recently?` | Quel outil ou quelle habitude vous a fait gagner le plus de temps récemment ? | ¿Qué herramienta o hábito te ha ahorrado más tiempo últimamente? | Welches Werkzeug oder welche Gewohnheit hat dir zuletzt am meisten Zeit gespart? |
| `If our team were a band, what kind of music would we play?` | Si notre équipe était un groupe, quel genre de musique jouerait-il ? | Si nuestro equipo fuera una banda, ¿qué música tocaría? | Wenn unser Team eine Band wäre, welche Musik würden wir spielen? |
| `Edit description` | Modifier la description | Editar descripción | Beschreibung bearbeiten |
| `Column description` | Description de la colonne | Descripción de la columna | Spaltenbeschreibung |
| `Shown under the column title to guide what people write.` | Affichée sous le titre de la colonne pour guider ce que chacun écrit. | Se muestra bajo el título de la columna para orientar lo que se escribe. | Wird unter dem Spaltentitel angezeigt und hilft beim Schreiben. |
| `Only empty columns can be renamed, recoloured or deleted.` | Seules les colonnes vides peuvent être renommées, recolorées ou supprimées. | Solo las columnas vacías se pueden renombrar, cambiar de color o eliminar. | Nur leere Spalten können umbenannt, umgefärbt oder gelöscht werden. |

Remove the key `Only empty columns can be edited or deleted.` from the four files if nothing else uses it (`grep -rn "Only empty columns can be edited or deleted" resources/js app` returns nothing).

- [ ] **Step 7: Check**

```bash
npx vp fmt resources/js/lib/retro/types.ts resources/js/components/retro/phase-stepper.tsx resources/js/components/retro/phase-panel.tsx resources/js/components/retro/icebreaker-panel.tsx resources/js/components/retro/board.tsx resources/js/components/retro/add-column.tsx resources/js/components/retro/column-header.tsx resources/js/components/retro/settings-dialog.tsx
npm run types:check && npm run check
vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php
```
Expected: no new type or lint errors, test PASS.

- [ ] **Step 8: Commit**

```bash
git add resources/js lang
git commit -m "feat: show the enabled phases, a warm-up panel and column descriptions on the board

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 11: Verification (controller-driven)

**Files:** none new.

- [ ] **Step 1: Full backend checks**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
vendor/bin/sail artisan test --compact tests/Feature/Retros tests/Feature/Workspaces tests/Feature/Teams tests/Feature/TranslationKeysTest.php tests/Feature/DemoSeederTest.php tests/Feature/UuidPrimaryKeysTest.php
```
Expected: 0 phpstan errors; all tests PASS. Then ask the user to run `php artisan test --compact` (whole suite).

- [ ] **Step 2: Frontend checks**

```bash
npm run types:check && npm run check && npm run build
```
Expected: only the known pre-existing lint failures.

- [ ] **Step 3: Leftover references**

```bash
grep -rn "RetroTemplate\|Retro column:\|isAdjacentTo\|Phases\b" app database resources/js tests --include=*.php --include=*.ts --include=*.tsx
```
Expected: no output except `CursorlessPhases`, `ReactionPhases`, `CommentPhases`, `ColumnEditPhases` identifiers.

- [ ] **Step 4: Manual walkthrough (two browsers, one guest)** — the 8a part of spec §15:
  1. Team page → "New retrospective": title prefilled "Retro <date>"; search "sail" shows Sailboat; category chip "Themed & fun" filters; "Custom" only under "All"; preview shows coloured columns with descriptions; Settings: icebreaker on, vote limit Automatic; Start.
  2. Board opens in "Icebreaker" with the Warm-up question (same question in both browsers) and the timer; stepper shows Icebreaker → Writing …; the facilitator adds a column with a description; the guest sees it.
  3. Next → Writing; write cards in both browsers; Previous → Icebreaker: the other browser's cards are hidden again.
  4. Settings: turning Icebreaker off while in Icebreaker shows "Move to another phase before turning this phase off."; in Writing it works and the stepper drops the step.
  5. Grouping → Voting: the vote counter shows cards + 3 (max 10); Settings shows "Automatic vote limit" disabled.
  6. Column menu → "Edit description" on a column with cards works; Rename is disabled.
  7. Sidebar → Templates as a member: list only; as an Owner: create "Team pulse" in "Team & mood" starting from a built-in template, reorder/remove columns, save; then on the team page filter "Team & mood" and start a retro from it — its columns match; delete the template — the retro keeps its columns.

- [ ] **Step 5: Record the outcome** in the ledger of the executing skill; no commit unless fixes were needed.

---

## Notes

- **Health check phase in the UI:** this plan ships the backend toggle, the phase and its redaction/adjacency rules, but not the Health check switch in the creation and settings dialogs, nor its phase panel (`PhasePanel` has no `health_check` branch yet). Plan 8b adds both together with the questions, so no screen offers an empty phase.
- **`ChangeRetroPhase`** is the single place for transition side effects; later plans must add steps there rather than in `RetroPhasesController`.
- **Templates:** titles and descriptions are copied into `columns` at creation in the creator's locale (unchanged behaviour); the research copy's typos are fixed in the English texts ("stong", "Strenghts", "Didn't Worked", "realtor meeting"); the five original templates keep their names and column titles, and only gain descriptions.
- **Removed test:** `RetroModelTest` "defines template columns" tested the deleted `RetroTemplate` enum; `TemplateCatalogueTest` replaces it.

## Spec coverage

| Spec | Task |
|---|---|
| §2.1 enum and order | 1 |
| §2.2 enabled phases, adjacency, first phase, `retro.phases` | 1, 2, 8, 10 |
| §2.3 toggles (health check, icebreaker; `ai_summary_enabled` → 8e), current-phase rule, turning on after passing | 2, 10 |
| §2.4 `isOpen`, `hidesOthersCards`, column edits before writing, vote limit before voting, card creation unchanged | 2, 3 |
| §2.5 icebreaker placeholder (12 translated questions, deterministic, timer) | 10 |
| §3 `retros` toggles, nullable votes, `template` string, `workspace_template_id`; `columns.description`, title 100; `workspace_templates`, `workspace_template_columns` | 1, 3, 4, 7, 8 |
| §7.1 automatic vote limit, snapshot `votesAuto`, settings `null`, defaults | 3, 8, 9, 10 |
| §8.1 catalogue definitions, keys, colours, `isCommon`, category, custom | 5 |
| §8.2 `templates.php` in four locales, translation test | 5, 6 |
| §8.3 column descriptions shown and edited | 4, 10 |
| §8.4 creation dialog, optional catalogue prop, `POST …/retros` fields | 8, 9 |
| §8.5 workspace templates (page, endpoints, limits, use at creation) | 7, 8 |
| §8.6 categories (enum, labels, assignment table, chips) | 5, 7, 9 |
| §10.3 snapshot `phases`, `healthCheckEnabled`, `icebreakerEnabled`, `votesAuto` | 2, 3 |
| §12 parent changes: phases, redaction in pre-writing phases, catalogue replaces enum, nullable votes | 1–4, 8 |
| §13 stepper, icebreaker panel, settings dialog (phase switch, vote limit), column header, team page dialog, workspace templates page | 7, 9, 10 |
| §15 phases, card redaction, vote limit, templates, workspace templates and categories, translations tests | 1–8 |
| Out of this plan | health check (8b), surveys (8c), results/ROTI/group names/`RetroCompleted` (8d), LLM and `ai_summary_enabled` (8e), `icebreaker_game` and games (spec 7) |
